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

        // Initial sync
        await this._initialSync();
        this.emit('ready');

        // Set up watchers
        for (const watchPath of this._paths) {
            try {
                const stat = await fs.promises.stat(watchPath);
                if (stat.isDirectory()) {
                    this._watchDirectory(watchPath);
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
            watcher.close();
        }
        this._watchers.length = 0;

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

    private _watchDirectory(dirPath: string): void {
        try {
            const watcher = fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
                if (!this._running || !filename) return;
                const fullPath = path.join(dirPath, filename);
                if (this._shouldInclude(fullPath)) {
                    this._debouncedSync(fullPath);
                }
            });
            watcher.on('error', (err) => {
                this.emit('error', err, dirPath);
            });
            this._watchers.push(watcher);
        } catch (err: unknown) {
            this.emit('error', err instanceof Error ? err : new Error(String(err)), dirPath);
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
