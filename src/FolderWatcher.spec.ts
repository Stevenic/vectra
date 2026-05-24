import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as os from 'os';
import * as path from 'path';
import fs from 'node:fs';
import { FolderWatcher } from './FolderWatcher';
import { LocalDocumentIndex } from './LocalDocumentIndex';
import { EmbeddingsModel, EmbeddingsResponse } from './types';
import { LocalFileStorage } from './storage/LocalFileStorage';

// Stub embeddings model that returns deterministic vectors
class StubEmbeddings implements EmbeddingsModel {
    public readonly maxTokens = 8000;
    public async createEmbeddings(inputs: string | string[]): Promise<EmbeddingsResponse> {
        const texts = Array.isArray(inputs) ? inputs : [inputs];
        const output = texts.map(() => {
            const vec = new Array(384).fill(0);
            vec[0] = 1; // unit vector
            return vec;
        });
        return { status: 'success', output };
    }
}

describe('FolderWatcher', () => {
    let tmpDir: string;
    let indexDir: string;
    let watchDir: string;
    let index: LocalDocumentIndex;
    let sandbox: sinon.SinonSandbox;

    beforeEach(async () => {
        sandbox = sinon.createSandbox();
        // realpath the temp dir to resolve Windows 8.3 short names (e.g.,
        // os.tmpdir() returns `C:\Users\STEVEN~1\...` on some boxes). The
        // FolderWatcher canonicalizes internally; matching here keeps tracked
        // URIs aligned with the paths the tests look up.
        tmpDir = await fs.promises.realpath(
            await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vectra-watch-'))
        );
        indexDir = path.join(tmpDir, 'index');
        watchDir = path.join(tmpDir, 'watch');
        await fs.promises.mkdir(indexDir, { recursive: true });
        await fs.promises.mkdir(watchDir, { recursive: true });

        index = new LocalDocumentIndex({
            folderPath: indexDir,
            embeddings: new StubEmbeddings(),
            storage: new LocalFileStorage(),
        });
        await index.createIndex({ version: 1, deleteIfExists: true });
    });

    afterEach(async () => {
        sandbox.restore();
        await fs.promises.rm(tmpDir, { recursive: true, force: true });
    });

    it('should perform initial sync of existing files', async () => {
        // Create files before starting watcher
        await fs.promises.writeFile(path.join(watchDir, 'file1.txt'), 'hello world');
        await fs.promises.writeFile(path.join(watchDir, 'file2.txt'), 'goodbye world');

        const watcher = new FolderWatcher({ index, paths: [watchDir] });
        const synced: string[] = [];
        watcher.on('sync', (uri: string) => synced.push(uri));

        await watcher.start();
        try {
            assert.equal(watcher.trackedFileCount, 2);
            assert.equal(synced.length, 2);
            // Verify documents exist in index
            const id1 = await index.getDocumentId(path.join(watchDir, 'file1.txt'));
            const id2 = await index.getDocumentId(path.join(watchDir, 'file2.txt'));
            assert.ok(id1, 'file1.txt should be indexed');
            assert.ok(id2, 'file2.txt should be indexed');
        } finally {
            await watcher.stop();
        }
    });

    it('should emit ready event after initial sync', async () => {
        const watcher = new FolderWatcher({ index, paths: [watchDir] });
        let ready = false;
        watcher.on('ready', () => { ready = true; });

        await watcher.start();
        try {
            assert.equal(ready, true);
        } finally {
            await watcher.stop();
        }
    });

    it('should filter by extensions', async () => {
        await fs.promises.writeFile(path.join(watchDir, 'include.txt'), 'included');
        await fs.promises.writeFile(path.join(watchDir, 'exclude.js'), 'excluded');
        await fs.promises.writeFile(path.join(watchDir, 'include.md'), 'also included');

        const watcher = new FolderWatcher({
            index,
            paths: [watchDir],
            extensions: ['.txt', '.md']
        });

        await watcher.start();
        try {
            assert.equal(watcher.trackedFileCount, 2);
            const idTxt = await index.getDocumentId(path.join(watchDir, 'include.txt'));
            const idMd = await index.getDocumentId(path.join(watchDir, 'include.md'));
            const idJs = await index.getDocumentId(path.join(watchDir, 'exclude.js'));
            assert.ok(idTxt, 'include.txt should be indexed');
            assert.ok(idMd, 'include.md should be indexed');
            assert.equal(idJs, undefined, 'exclude.js should not be indexed');
        } finally {
            await watcher.stop();
        }
    });

    it('should handle extensions without leading dot', async () => {
        await fs.promises.writeFile(path.join(watchDir, 'test.txt'), 'hello');

        const watcher = new FolderWatcher({
            index,
            paths: [watchDir],
            extensions: ['txt']
        });

        await watcher.start();
        try {
            assert.equal(watcher.trackedFileCount, 1);
        } finally {
            await watcher.stop();
        }
    });

    it('should recurse into subdirectories', async () => {
        const subDir = path.join(watchDir, 'sub');
        await fs.promises.mkdir(subDir, { recursive: true });
        await fs.promises.writeFile(path.join(watchDir, 'root.txt'), 'root');
        await fs.promises.writeFile(path.join(subDir, 'nested.txt'), 'nested');

        const watcher = new FolderWatcher({ index, paths: [watchDir] });

        await watcher.start();
        try {
            assert.equal(watcher.trackedFileCount, 2);
            const idRoot = await index.getDocumentId(path.join(watchDir, 'root.txt'));
            const idNested = await index.getDocumentId(path.join(subDir, 'nested.txt'));
            assert.ok(idRoot, 'root.txt should be indexed');
            assert.ok(idNested, 'nested.txt should be indexed');
        } finally {
            await watcher.stop();
        }
    });

    it('should watch individual files', async () => {
        const singleFile = path.join(tmpDir, 'single.txt');
        await fs.promises.writeFile(singleFile, 'single file');

        const watcher = new FolderWatcher({ index, paths: [singleFile] });

        await watcher.start();
        try {
            assert.equal(watcher.trackedFileCount, 1);
            const id = await index.getDocumentId(singleFile);
            assert.ok(id, 'single.txt should be indexed');
        } finally {
            await watcher.stop();
        }
    });

    it('should watch multiple paths', async () => {
        const dir2 = path.join(tmpDir, 'watch2');
        await fs.promises.mkdir(dir2, { recursive: true });
        await fs.promises.writeFile(path.join(watchDir, 'a.txt'), 'a');
        await fs.promises.writeFile(path.join(dir2, 'b.txt'), 'b');

        const watcher = new FolderWatcher({ index, paths: [watchDir, dir2] });

        await watcher.start();
        try {
            assert.equal(watcher.trackedFileCount, 2);
        } finally {
            await watcher.stop();
        }
    });

    it('should handle sync() detecting deleted files', async () => {
        await fs.promises.writeFile(path.join(watchDir, 'ephemeral.txt'), 'temporary');

        const watcher = new FolderWatcher({ index, paths: [watchDir] });
        await watcher.start();
        assert.equal(watcher.trackedFileCount, 1);

        // Delete the file
        await fs.promises.unlink(path.join(watchDir, 'ephemeral.txt'));

        // Manual sync should detect deletion
        const synced: Array<{ uri: string; action: string }> = [];
        watcher.on('sync', (uri: string, action: string) => synced.push({ uri, action }));
        await watcher.sync();

        try {
            assert.equal(watcher.trackedFileCount, 0);
            const deleted = synced.find(s => s.action === 'deleted');
            assert.ok(deleted, 'should have emitted a delete event');
        } finally {
            await watcher.stop();
        }
    });

    it('should handle sync() detecting updated files', async () => {
        const filePath = path.join(watchDir, 'mutable.txt');
        await fs.promises.writeFile(filePath, 'version 1');

        const watcher = new FolderWatcher({ index, paths: [watchDir] });
        await watcher.start();
        assert.equal(watcher.trackedFileCount, 1);

        // Update the file (ensure mtime changes)
        await new Promise(r => setTimeout(r, 50));
        await fs.promises.writeFile(filePath, 'version 2');

        // Manual sync should detect update
        const synced: Array<{ uri: string; action: string }> = [];
        watcher.on('sync', (uri: string, action: string) => synced.push({ uri, action }));
        await watcher.sync();

        try {
            assert.equal(watcher.trackedFileCount, 1);
            const updated = synced.find(s => s.action === 'updated');
            assert.ok(updated, 'should have emitted an update event');
        } finally {
            await watcher.stop();
        }
    });

    it('should not throw if path does not exist', async () => {
        const watcher = new FolderWatcher({
            index,
            paths: [path.join(tmpDir, 'nonexistent')]
        });

        await watcher.start();
        try {
            assert.equal(watcher.trackedFileCount, 0);
        } finally {
            await watcher.stop();
        }
    });

    it('should throw if started twice', async () => {
        const watcher = new FolderWatcher({ index, paths: [watchDir] });
        await watcher.start();
        try {
            await assert.rejects(() => watcher.start(), /already running/);
        } finally {
            await watcher.stop();
        }
    });

    it('should report isRunning correctly', async () => {
        const watcher = new FolderWatcher({ index, paths: [watchDir] });
        assert.equal(watcher.isRunning, false);
        await watcher.start();
        assert.equal(watcher.isRunning, true);
        await watcher.stop();
        assert.equal(watcher.isRunning, false);
    });

    it('should emit error events for sync failures', async () => {
        await fs.promises.writeFile(path.join(watchDir, 'bad.txt'), 'content');

        // Create watcher with no embeddings to force error
        const badIndex = new LocalDocumentIndex({
            folderPath: indexDir,
            // no embeddings — will throw on upsertDocument
            storage: new LocalFileStorage(),
        });

        const watcher = new FolderWatcher({ index: badIndex, paths: [watchDir] });
        const errors: Array<{ err: Error; uri: string }> = [];
        watcher.on('error', (err: Error, uri: string) => errors.push({ err, uri }));

        await watcher.start();
        try {
            assert.equal(errors.length, 1);
            assert.ok(errors[0].err.message.includes('Embeddings model not configured'));
        } finally {
            await watcher.stop();
        }
    });

    describe('internal event dispatch (white-box)', () => {
        // These tests invoke the private event-dispatch helpers directly so we
        // don't depend on the OS firing fs.watch events at a predictable time.
        // They exercise the same code paths that fs.watch would trigger.

        it('_processEvent on a new subdirectory installs watchers and syncs files inside it', async () => {
            // Stage the subdirectory first so this test is isolated from the
            // race between real fs.watch events and our manual dispatch.
            const subDir = path.join(watchDir, 'new-sub');
            await fs.promises.mkdir(subDir);
            await fs.promises.writeFile(path.join(subDir, 'a.txt'), 'a');
            await fs.promises.writeFile(path.join(subDir, 'b.txt'), 'b');

            const watcher = new FolderWatcher({ index, paths: [watchDir] });
            // Manually enable _running and call _processEvent directly without
            // ever starting the OS fs.watch, so this test is deterministic.
            (watcher as any)._running = true;
            try {
                await (watcher as any)._processEvent(subDir);
                assert.equal(watcher.trackedFileCount, 2);
                assert.ok((watcher as any)._dirWatchers.has(subDir));
            } finally {
                (watcher as any)._running = false;
                for (const w of (watcher as any)._watchers) {
                    try { w.close(); } catch { /* ignore */ }
                }
            }
        });

        it('_processEvent on a deleted watched directory tears down its watcher (and descendants)', async () => {
            const subDir = path.join(watchDir, 'doomed');
            const innerDir = path.join(subDir, 'inner');
            await fs.promises.mkdir(innerDir, { recursive: true });
            await fs.promises.writeFile(path.join(innerDir, 'inside.txt'), 'x');

            const watcher = new FolderWatcher({ index, paths: [watchDir] });
            await watcher.start();
            try {
                assert.ok((watcher as any)._dirWatchers.has(subDir));
                assert.ok((watcher as any)._dirWatchers.has(innerDir));

                // Delete the subdir on disk, then signal the event.
                await fs.promises.rm(subDir, { recursive: true, force: true });
                await (watcher as any)._processEvent(subDir);

                assert.equal((watcher as any)._dirWatchers.has(subDir), false);
                assert.equal((watcher as any)._dirWatchers.has(innerDir), false,
                    'descendant watcher should be cleaned up too');
            } finally {
                await watcher.stop();
            }
        });

        it('_processEvent on a file path debounces a sync', async () => {
            await fs.promises.writeFile(path.join(watchDir, 'existing.txt'), 'v1');
            const watcher = new FolderWatcher({ index, paths: [watchDir], debounceMs: 10 });
            await watcher.start();
            try {
                const filePath = path.join(watchDir, 'existing.txt');
                await fs.promises.writeFile(filePath, 'v2');
                await (watcher as any)._processEvent(filePath);

                // Wait for the debounce timer to fire.
                await new Promise(r => setTimeout(r, 40));

                const tracked = (watcher as any)._tracked.get(filePath);
                assert.ok(tracked, 'file should be tracked after debounce fires');
            } finally {
                await watcher.stop();
            }
        });

        it('_processEvent on a deleted tracked file triggers debouncedSync that deletes it', async () => {
            const filePath = path.join(watchDir, 'goner.txt');
            await fs.promises.writeFile(filePath, 'v1');
            const watcher = new FolderWatcher({ index, paths: [watchDir], debounceMs: 10 });
            await watcher.start();
            try {
                assert.equal(watcher.trackedFileCount, 1);
                await fs.promises.unlink(filePath);
                await (watcher as any)._processEvent(filePath);

                // Wait for the debounce timer to fire and call _deleteFile.
                await new Promise(r => setTimeout(r, 40));

                assert.equal(watcher.trackedFileCount, 0);
            } finally {
                await watcher.stop();
            }
        });

        it('_processEvent ignores files whose extension does not match the filter', async () => {
            const watcher = new FolderWatcher({
                index,
                paths: [watchDir],
                extensions: ['.md'],
                debounceMs: 10,
            });
            await watcher.start();
            try {
                const filePath = path.join(watchDir, 'skip.txt');
                await fs.promises.writeFile(filePath, 'should be skipped');
                await (watcher as any)._processEvent(filePath);
                await new Promise(r => setTimeout(r, 40));
                assert.equal(watcher.trackedFileCount, 0);
            } finally {
                await watcher.stop();
            }
        });

        it('_processEvent does nothing once the watcher has been stopped', async () => {
            const watcher = new FolderWatcher({ index, paths: [watchDir] });
            await watcher.start();
            await watcher.stop();
            const filePath = path.join(watchDir, 'never.txt');
            await fs.promises.writeFile(filePath, 'x');
            await (watcher as any)._processEvent(filePath);
            assert.equal(watcher.trackedFileCount, 0);
        });

        it('error events from a directory watcher remove it from the internal maps', async () => {
            const watcher = new FolderWatcher({ index, paths: [watchDir] });
            await watcher.start();
            try {
                const dirWatcher = (watcher as any)._dirWatchers.get(watchDir);
                assert.ok(dirWatcher, 'watcher should be installed');

                const errors: Array<{ err: Error; uri: string }> = [];
                watcher.on('error', (err: Error, uri: string) => errors.push({ err, uri }));

                dirWatcher.emit('error', new Error('simulated watcher fault'));

                assert.equal(errors.length, 1);
                assert.equal(errors[0].err.message, 'simulated watcher fault');
                assert.equal((watcher as any)._dirWatchers.has(watchDir), false,
                    'the dead watcher should have been removed from the map');
            } finally {
                await watcher.stop();
            }
        });

        it('error events from a single-file watcher are surfaced to consumers', async () => {
            const singleFile = path.join(tmpDir, 'single.txt');
            await fs.promises.writeFile(singleFile, 'hi');
            const watcher = new FolderWatcher({ index, paths: [singleFile] });
            await watcher.start();
            try {
                const fileWatcher = (watcher as any)._watchers[0];
                assert.ok(fileWatcher, 'file watcher should be installed');

                const errors: Array<{ err: Error; uri: string }> = [];
                watcher.on('error', (err: Error, uri: string) => errors.push({ err, uri }));

                fileWatcher.emit('error', new Error('file watcher fault'));

                assert.equal(errors.length, 1);
                assert.equal(errors[0].err.message, 'file watcher fault');
            } finally {
                await watcher.stop();
            }
        });

        it('_addDirectoryWatch emits an error event when fs.watch throws synchronously', async () => {
            const watcher = new FolderWatcher({ index, paths: [watchDir] });
            await watcher.start();
            try {
                const errors: Array<{ err: Error; uri: string }> = [];
                watcher.on('error', (err: Error, uri: string) => errors.push({ err, uri }));

                const stub = sandbox.stub(fs, 'watch').throws(new Error('watch failed'));
                try {
                    (watcher as any)._addDirectoryWatch(path.join(watchDir, 'never-watched'));
                } finally {
                    stub.restore();
                }

                assert.equal(errors.length, 1);
                assert.equal(errors[0].err.message, 'watch failed');
            } finally {
                await watcher.stop();
            }
        });

        it('_watchFile change event fires the debounced sync', async () => {
            const singleFile = path.join(tmpDir, 'single.txt');
            await fs.promises.writeFile(singleFile, 'v1');
            const watcher = new FolderWatcher({
                index,
                paths: [singleFile],
                debounceMs: 10,
            });
            await watcher.start();
            try {
                const fileWatcher = (watcher as any)._watchers[0];
                await fs.promises.writeFile(singleFile, 'v2');
                // FSWatcher emits 'change' events that invoke the callback we
                // registered with fs.watch.
                fileWatcher.emit('change', 'change', path.basename(singleFile));
                await new Promise(r => setTimeout(r, 40));

                const tracked = (watcher as any)._tracked.get(singleFile);
                assert.ok(tracked, 'file should be tracked after debounce fires');
            } finally {
                await watcher.stop();
            }
        });

        it('_watchFile emits an error event when fs.watch throws synchronously', async () => {
            const singleFile = path.join(tmpDir, 'single.txt');
            await fs.promises.writeFile(singleFile, 'hi');
            const watcher = new FolderWatcher({ index, paths: [singleFile] });

            const errors: Array<{ err: Error; uri: string }> = [];
            watcher.on('error', (err: Error, uri: string) => errors.push({ err, uri }));

            const stub = sandbox.stub(fs, 'watch').throws(new Error('file watch failed'));
            try {
                (watcher as any)._watchFile(singleFile);
            } finally {
                stub.restore();
            }
            assert.equal(errors.length, 1);
            assert.equal(errors[0].err.message, 'file watch failed');
        });

        it('_processEvent surfaces exceptions through the error event', async () => {
            const watcher = new FolderWatcher({ index, paths: [watchDir] });
            await watcher.start();
            try {
                const errors: Array<{ err: Error; uri: string }> = [];
                watcher.on('error', (err: Error, uri: string) => errors.push({ err, uri }));
                // Force _processEvent to reject so we exercise the .catch in
                // _handleEvent.
                const stub = sandbox.stub(watcher as any, '_processEvent').rejects(new Error('boom'));
                try {
                    (watcher as any)._handleEvent(path.join(watchDir, 'whatever.txt'));
                    await new Promise(r => setImmediate(r));
                } finally {
                    stub.restore();
                }
                assert.equal(errors.length, 1);
                assert.equal(errors[0].err.message, 'boom');
            } finally {
                await watcher.stop();
            }
        });
    });
});
