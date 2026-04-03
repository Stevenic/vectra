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
        tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vectra-watch-'));
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
});
