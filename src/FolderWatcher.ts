import { EventEmitter } from 'events';
import fs from 'node:fs';
import * as path from 'path';
import { LocalDocumentIndex } from './LocalDocumentIndex';

/**
 * Configuration for FolderWatcher.
 */
export interface FolderWatcherConfig {
    /**
     * The LocalDocumentIndex to sync files into.
     */
    index: LocalDocumentIndex;

    /**
     * List of folder or file paths to watch.
     */
    paths: string[];

    /**
     * Optional. File extensions to include (e.g., ['.txt', '.md', '.html']).
     * @remarks
     * If not specified, all files are included.
     */
    extensions?: string[];

    /**
     * Optional. Debounce interval in milliseconds for file change events.
     * @remarks
     * Default is 500ms. Multiple rapid changes to the same file are collapsed into one sync.
     */
    debounceMs?: number;
}

/**
 * Events emitted by FolderWatcher.
 *
 * - `sync` — emitted after a file is synced. Args: `(uri: string, action: 'added' | 'updated' | 'deleted')`
 * - `error` — emitted when a sync operation fails. Args: `(error: Error, uri: string)`
 * - `ready` — emitted after the initial sync completes.
 */
export interface FolderWatcherEvents {
    sync: [uri: string, action: 'added' | 'updated' | 'deleted'];
    error: [error: Error, uri: string];
    ready: [];
}

interface TrackedFile {
    uri: string;
    mtimeMs: number;
}

/**
 * Watches folders for file changes and automatically syncs them into a LocalDocumentIndex.
 *
 * @remarks
 * Uses Node.js `fs.watch` for efficient filesystem monitoring with debouncing.
 * Performs an initial full sync on start, then watches for incremental changes.
 */
export class FolderWatcher extends EventEmitter {
    private readonly _index: LocalDocumentIndex;
    private readonly _paths: string[];
    private readonly _extensions?: Set<string>;
    private readonly _debounceMs: number;
    private readonly _tracked: Map<string, TrackedFile> = new Map();
    private readonly _pending: Map<string, NodeJS.Timeout> = new Map();
    private readonly _watchers: fs.FSWatcher[] = [];
    private readonly _dirWatchers: Map<string, fs.FSWatcher> = new Map();
    private _running: boolean = false;

    /**
     * Creates a new FolderWatcher instance.
     * @param config Configuration for the watcher.
     */
    public constructor(config: FolderWatcherConfig) {
        super();
        this._index = config.index;
        this._paths = config.paths.map(p => path.resolve(p));
        this._extensions = config.extensions
            ? new Set(config.extensions.map(e => e.startsWith('.') ? e.toLowerCase() : `.${e.toLowerCase()}`))
            : undefined;
        this._debounceMs = config.debounceMs ?? 500;
    }

    /**
     * Returns true if the watcher is currently running.
     */
    public get isRunning(): boolean {
        return this._running;
    }

    /**
     * Returns the number of tracked files.
     */
    public get trackedFileCount(): number {
        return this._tracked.size;
    }

    /**
     * Starts the watcher: performs an initial sync and then watches for changes.
     */
    public async start(): Promise<void> {
        if (this._running) {
            throw new Error('FolderWatcher is already running');
        }
        this._running = true;

        // Canonicalize watched paths. Windows `fs.watch` will crash inside
        // libuv with a `!_wcsnicmp` assertion in `fs-event.c` when given a
        // path containing an 8.3 short name (e.g., `STEVEN~1`) because
        // ReadDirectoryChangesW reports event filenames with their long-name
        // expansion and libuv's prefix check fails. `os.tmpdir()` is a common
        // source of short names in the wild. Resolving up front keeps the
        // tracked URIs, the initial sync, and the per-directory watchers all
        // consistent on the long-name form.
        for (let i = 0; i < this._paths.length; i++) {
            try {
                this._paths[i] = await fs.promises.realpath(this._paths[i]);
            } catch {
                // Path doesn't exist yet — leave as-is; the watch loop will skip it.
            }
        }

        // Initial sync
        await this._initialSync();
        this.emit('ready');

        // Set up watchers
        for (const watchPath of this._paths) {
            try {
                const stat = await fs.promises.stat(watchPath);
                if (stat.isDirectory()) {
                    await this._watchDirectoryTree(watchPath);
                } else if (stat.isFile()) {
                    this._watchFile(watchPath);
                }
            } catch {
                // Path doesn't exist — skip
            }
        }
    }

    /**
     * Stops the watcher and cleans up all resources.
     */
    public async stop(): Promise<void> {
        this._running = false;

        // Close all watchers
        for (const watcher of this._watchers) {
            try { watcher.close(); } catch { /* ignore */ }
        }
        this._watchers.length = 0;
        this._dirWatchers.clear();

        // Clear pending debounced operations
        for (const timeout of this._pending.values()) {
            clearTimeout(timeout);
        }
        this._pending.clear();
    }

    /**
     * Performs a full sync: scans all watched paths and upserts/deletes as needed.
     * @returns Number of files synced (added + updated + deleted).
     */
    public async sync(): Promise<number> {
        let count = 0;

        // Collect current files on disk
        const currentFiles = new Map<string, number>();
        for (const watchPath of this._paths) {
            await this._collectFiles(watchPath, currentFiles);
        }

        // Upsert new or changed files
        for (const [filePath, mtimeMs] of currentFiles) {
            const tracked = this._tracked.get(filePath);
            if (!tracked || tracked.mtimeMs < mtimeMs) {
                const ok = await this._syncFile(filePath, mtimeMs);
                if (ok) count++;
            }
        }

        // Delete files that no longer exist
        for (const [filePath, tracked] of this._tracked) {
            if (!currentFiles.has(filePath)) {
                const ok = await this._deleteFile(tracked.uri);
                if (ok) count++;
            }
        }

        return count;
    }

    // --- Private methods ---

    private async _initialSync(): Promise<void> {
        await this.sync();
    }

    private _shouldInclude(filePath: string): boolean {
        if (!this._extensions) return true;
        const ext = path.extname(filePath).toLowerCase();
        return this._extensions.has(ext);
    }

    private async _collectFiles(dirOrFile: string, out: Map<string, number>): Promise<void> {
        let stat: fs.Stats;
        try {
            stat = await fs.promises.stat(dirOrFile);
        } catch {
            return;
        }

        if (stat.isFile()) {
            if (this._shouldInclude(dirOrFile)) {
                out.set(dirOrFile, stat.mtimeMs);
            }
        } else if (stat.isDirectory()) {
            const entries = await fs.promises.readdir(dirOrFile);
            for (const entry of entries) {
                await this._collectFiles(path.join(dirOrFile, entry), out);
            }
        }
    }

    private async _syncFile(filePath: string, mtimeMs: number): Promise<boolean> {
        const wasTracked = this._tracked.has(filePath);
        const action = wasTracked ? 'updated' : 'added';
        try {
            const text = await fs.promises.readFile(filePath, 'utf-8');
            const ext = path.extname(filePath);
            const docType = ext ? ext.slice(1).toLowerCase() : undefined;
            await this._index.upsertDocument(filePath, text, docType);
            this._tracked.set(filePath, { uri: filePath, mtimeMs });
            this.emit('sync', filePath, action);
            return true;
        } catch (err: unknown) {
            this.emit('error', err instanceof Error ? err : new Error(String(err)), filePath);
            return false;
        }
    }

    private async _deleteFile(uri: string): Promise<boolean> {
        try {
            await this._index.deleteDocument(uri);
            // Find and remove from tracked by URI
            for (const [filePath, tracked] of this._tracked) {
                if (tracked.uri === uri) {
                    this._tracked.delete(filePath);
                    break;
                }
            }
            this.emit('sync', uri, 'deleted');
            return true;
        } catch (err: unknown) {
            this.emit('error', err instanceof Error ? err : new Error(String(err)), uri);
            return false;
        }
    }

    /**
     * Walks a directory tree and installs a non-recursive `fs.watch` on every
     * directory it contains. Non-recursive watching avoids a known libuv bug on
     * Windows (`Assertion failed: !_wcsnicmp` in `fs-event.c`) that fires when
     * `fs.watch(..., { recursive: true })` receives events whose paths libuv's
     * Windows backend can't normalize back to the watch root.
     */
    private async _watchDirectoryTree(rootDir: string): Promise<void> {
        if (!this._running) return;
        this._addDirectoryWatch(rootDir);
        let entries: fs.Dirent[];
        try {
            entries = await fs.promises.readdir(rootDir, { withFileTypes: true });
        } catch {
            // Dir may have been removed mid-walk; nothing to recurse into.
            return;
        }
        for (const entry of entries) {
            if (entry.isDirectory()) {
                await this._watchDirectoryTree(path.join(rootDir, entry.name));
            }
        }
    }

    private _addDirectoryWatch(dirPath: string): void {
        if (this._dirWatchers.has(dirPath)) return;
        try {
            const watcher = fs.watch(dirPath, (_eventType, filename) => {
                if (!this._running || !filename) return;
                const fullPath = path.join(dirPath, filename);
                this._handleEvent(fullPath);
            });
            watcher.on('error', (err) => {
                this.emit('error', err, dirPath);
                // Clean up so we don't leak a dead handle in our maps.
                this._stopWatchingDir(dirPath);
            });
            this._dirWatchers.set(dirPath, watcher);
            this._watchers.push(watcher);
        } catch (err: unknown) {
            this.emit('error', err instanceof Error ? err : new Error(String(err)), dirPath);
        }
    }

    /**
     * Dispatch a single change event from one of the per-directory watchers.
     * - File path: feed to the existing debounced file-sync pipeline.
     * - New subdirectory: install watchers for it and sync its contents.
     * - Path that used to be a watched subdirectory and no longer exists:
     *   tear down its watchers (and any descendants) and mark affected
     *   tracked files for deletion.
     */
    private _handleEvent(fullPath: string): void {
        // fs.watch callbacks must return quickly; do the work async without
        // awaiting and route exceptions to the error event.
        void this._processEvent(fullPath).catch((err) => {
            this.emit('error', err instanceof Error ? err : new Error(String(err)), fullPath);
        });
    }

    private async _processEvent(fullPath: string): Promise<void> {
        if (!this._running) return;
        let stat: fs.Stats;
        try {
            stat = await fs.promises.stat(fullPath);
        } catch {
            // Path no longer exists. If it was a watched subdir, tear down.
            if (this._dirWatchers.has(fullPath)) {
                this._stopWatchingDir(fullPath);
            }
            // If a tracked file disappeared, debouncedSync will pick it up
            // (its timer stats, fails, and calls _deleteFile).
            if (this._tracked.has(fullPath)) {
                this._debouncedSync(fullPath);
            }
            return;
        }

        if (stat.isDirectory()) {
            if (!this._dirWatchers.has(fullPath)) {
                // New subdirectory: watch it (and any descendants) and sync
                // files that already exist inside it.
                await this._watchDirectoryTree(fullPath);
                const files = new Map<string, number>();
                await this._collectFiles(fullPath, files);
                for (const [filePath, mtimeMs] of files) {
                    if (!this._running) return;
                    await this._syncFile(filePath, mtimeMs);
                }
            }
        } else if (stat.isFile() && this._shouldInclude(fullPath)) {
            this._debouncedSync(fullPath);
        }
    }

    private _stopWatchingDir(dirPath: string): void {
        const prefix = dirPath + path.sep;
        const doomed: string[] = [];
        for (const watched of this._dirWatchers.keys()) {
            if (watched === dirPath || watched.startsWith(prefix)) {
                doomed.push(watched);
            }
        }
        for (const watched of doomed) {
            const watcher = this._dirWatchers.get(watched);
            if (watcher) {
                try { watcher.close(); } catch { /* ignore */ }
                this._dirWatchers.delete(watched);
                const idx = this._watchers.indexOf(watcher);
                if (idx >= 0) this._watchers.splice(idx, 1);
            }
        }
    }

    private _watchFile(filePath: string): void {
        try {
            const watcher = fs.watch(filePath, (eventType) => {
                if (!this._running) return;
                this._debouncedSync(filePath);
            });
            watcher.on('error', (err) => {
                this.emit('error', err, filePath);
            });
            this._watchers.push(watcher);
        } catch (err: unknown) {
            this.emit('error', err instanceof Error ? err : new Error(String(err)), filePath);
        }
    }

    private _debouncedSync(filePath: string): void {
        // Cancel any pending sync for this file
        const existing = this._pending.get(filePath);
        if (existing) {
            clearTimeout(existing);
        }

        const timeout = setTimeout(async () => {
            this._pending.delete(filePath);
            if (!this._running) return;

            try {
                const stat = await fs.promises.stat(filePath);
                if (stat.isFile()) {
                    await this._syncFile(filePath, stat.mtimeMs);
                }
            } catch {
                // File was deleted
                if (this._tracked.has(filePath)) {
                    await this._deleteFile(filePath);
                }
            }
        }, this._debounceMs);

        this._pending.set(filePath, timeout);
    }
}
