import * as assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { IndexManager } from './IndexManager';
import { LocalIndex } from '../LocalIndex';
import { LocalDocumentIndex } from '../LocalDocumentIndex';

async function mkTmp(prefix: string): Promise<string> {
    return fs.promises.realpath(
        await fs.promises.mkdtemp(path.join(os.tmpdir(), prefix))
    );
}

describe('IndexManager', () => {
    let tmpRoot: string;

    beforeEach(async () => {
        tmpRoot = await mkTmp('vectra-im-');
    });

    afterEach(async () => {
        await fs.promises.rm(tmpRoot, { recursive: true, force: true });
    });

    describe('mode flags', () => {
        it('isSingleMode reflects whether indexPath is provided', () => {
            const single = new IndexManager({ indexPath: path.join(tmpRoot, 'one') });
            const multi = new IndexManager({ rootDir: tmpRoot });
            assert.equal(single.isSingleMode, true);
            assert.equal(multi.isSingleMode, false);
        });
    });

    describe('initialize / shutdown', () => {
        it('initialize is a no-op when neither indexPath nor rootDir is set', async () => {
            const mgr = new IndexManager({});
            await mgr.initialize();
            assert.equal(mgr.listIndexes().length, 0);
            await mgr.shutdown();
        });

        it('shutdown clears the periodic scan timer', async () => {
            const mgr = new IndexManager({ rootDir: tmpRoot, scanInterval: 200 });
            await mgr.initialize();
            // Internal field check — verifies the timer was set.
            assert.ok((mgr as any)._scanTimer);
            await mgr.shutdown();
            assert.equal((mgr as any)._scanTimer, undefined);
            assert.equal(mgr.listIndexes().length, 0);
        });

        it('initialize in single mode loads the single index by basename', async () => {
            const indexDir = path.join(tmpRoot, 'solo');
            const idx = new LocalIndex(indexDir);
            await idx.createIndex();
            const mgr = new IndexManager({ indexPath: indexDir });
            await mgr.initialize();
            try {
                const list = mgr.listIndexes();
                assert.equal(list.length, 1);
                assert.equal(list[0].name, 'solo');
                assert.equal(list[0].isDocumentIndex, false);
            } finally {
                await mgr.shutdown();
            }
        });

        it('single-mode getIndex returns the loaded index regardless of the name passed', async () => {
            const indexDir = path.join(tmpRoot, 'solo');
            const idx = new LocalIndex(indexDir);
            await idx.createIndex();
            const mgr = new IndexManager({ indexPath: indexDir });
            await mgr.initialize();
            try {
                const a = mgr.getIndex('solo');
                const b = mgr.getIndex('something-else-entirely');
                const c = mgr.getIndex('');
                assert.ok(a);
                assert.equal(a, b);
                assert.equal(a, c);
            } finally {
                await mgr.shutdown();
            }
        });
    });

    describe('scanRootDir', () => {
        it('skips non-directories, dot-prefixed entries, and already-loaded indexes', async () => {
            // One real index, a hidden dir, a stray file, and a junk dir that isn't an index.
            const realIndex = path.join(tmpRoot, 'real');
            await new LocalIndex(realIndex).createIndex();
            await fs.promises.mkdir(path.join(tmpRoot, '.hidden'));
            await fs.promises.writeFile(path.join(tmpRoot, 'stray.txt'), 'x');
            await fs.promises.mkdir(path.join(tmpRoot, 'not-an-index'));

            const mgr = new IndexManager({ rootDir: tmpRoot, scanInterval: 100000 });
            await mgr.initialize();
            try {
                const names = mgr.listIndexes().map(m => m.name).sort();
                assert.deepEqual(names, ['real']);
            } finally {
                await mgr.shutdown();
            }
        });

        it('returns silently when rootDir does not exist on disk', async () => {
            const ghostRoot = path.join(tmpRoot, 'never-created');
            const mgr = new IndexManager({ rootDir: ghostRoot, scanInterval: 100000 });
            await mgr.initialize();
            try {
                assert.equal(mgr.listIndexes().length, 0);
            } finally {
                await mgr.shutdown();
            }
        });

        it('picks up indexes created after initialize via the periodic timer', async () => {
            const mgr = new IndexManager({ rootDir: tmpRoot, scanInterval: 50 });
            await mgr.initialize();
            try {
                assert.equal(mgr.listIndexes().length, 0);
                const newIndex = path.join(tmpRoot, 'late-arrival');
                await new LocalIndex(newIndex).createIndex();
                // Wait for the scanner to tick.
                await new Promise(r => setTimeout(r, 250));
                const names = mgr.listIndexes().map(m => m.name);
                assert.ok(names.includes('late-arrival'), `expected late-arrival in ${JSON.stringify(names)}`);
            } finally {
                await mgr.shutdown();
            }
        });

        it('loads a document index when a catalog file is present', async () => {
            const docDir = path.join(tmpRoot, 'docs');
            const docIndex = new LocalDocumentIndex({ folderPath: docDir });
            await docIndex.createIndex();
            // createIndex on a document index writes catalog.json via loadIndexData,
            // but only when something prompts it. Touch the catalog to be sure.
            await docIndex.isCatalogCreated();

            const mgr = new IndexManager({ rootDir: tmpRoot, scanInterval: 100000 });
            await mgr.initialize();
            try {
                const managed = mgr.getIndex('docs');
                assert.ok(managed, 'docs index should be loaded');
                assert.equal(managed.isDocumentIndex, true);
            } finally {
                await mgr.shutdown();
            }
        });
    });

    describe('createIndex', () => {
        it('throws when no rootDir is configured and not in single mode', async () => {
            const mgr = new IndexManager({});
            await mgr.initialize();
            try {
                await assert.rejects(
                    mgr.createIndex('orphan', 'json', false),
                    /no root directory configured/
                );
            } finally {
                await mgr.shutdown();
            }
        });

        it('throws when the name is already loaded', async () => {
            const mgr = new IndexManager({ rootDir: tmpRoot, scanInterval: 100000 });
            await mgr.initialize();
            try {
                await mgr.createIndex('dup', 'json', false);
                await assert.rejects(
                    mgr.createIndex('dup', 'json', false),
                    /already exists/
                );
            } finally {
                await mgr.shutdown();
            }
        });

        it('creates a document index using the supplied chunking config', async () => {
            const mgr = new IndexManager({ rootDir: tmpRoot, scanInterval: 100000 });
            await mgr.initialize();
            try {
                const managed = await mgr.createIndex('docidx', 'json', true, {
                    version: 1,
                    chunkSize: 256,
                    chunkOverlap: 16,
                });
                assert.equal(managed.isDocumentIndex, true);
                assert.ok(managed.index instanceof LocalDocumentIndex);
            } finally {
                await mgr.shutdown();
            }
        });

        it('honors the protobuf format flag', async () => {
            const mgr = new IndexManager({ rootDir: tmpRoot, scanInterval: 100000 });
            await mgr.initialize();
            try {
                const managed = await mgr.createIndex('pbidx', 'protobuf', false);
                assert.equal(managed.format, 'protobuf');
                assert.equal(managed.index.codec.extension, '.pb');
            } finally {
                await mgr.shutdown();
            }
        });
    });

    describe('requireIndex / requireDocumentIndex', () => {
        it('requireIndex throws for unknown names in multi-index mode', async () => {
            const mgr = new IndexManager({ rootDir: tmpRoot, scanInterval: 100000 });
            await mgr.initialize();
            try {
                assert.throws(() => mgr.requireIndex('missing'), /Index not found/);
            } finally {
                await mgr.shutdown();
            }
        });

        it('requireDocumentIndex throws when the named index is not a document index', async () => {
            const mgr = new IndexManager({ rootDir: tmpRoot, scanInterval: 100000 });
            await mgr.initialize();
            try {
                await mgr.createIndex('flat', 'json', false);
                assert.throws(
                    () => mgr.requireDocumentIndex('flat'),
                    /not a document index/
                );
            } finally {
                await mgr.shutdown();
            }
        });

        it('requireDocumentIndex returns both wrappers for a real document index', async () => {
            const mgr = new IndexManager({ rootDir: tmpRoot, scanInterval: 100000 });
            await mgr.initialize();
            try {
                await mgr.createIndex('docs', 'json', true);
                const { managed, docIndex } = mgr.requireDocumentIndex('docs');
                assert.equal(managed.isDocumentIndex, true);
                assert.ok(docIndex instanceof LocalDocumentIndex);
            } finally {
                await mgr.shutdown();
            }
        });
    });

    describe('deleteIndex', () => {
        it('removes a loaded index from memory and from disk', async () => {
            const mgr = new IndexManager({ rootDir: tmpRoot, scanInterval: 100000 });
            await mgr.initialize();
            try {
                await mgr.createIndex('disposable', 'json', false);
                const folderPath = path.join(tmpRoot, 'disposable');
                assert.ok(fs.existsSync(folderPath));

                await mgr.deleteIndex('disposable');

                assert.equal(mgr.getIndex('disposable'), undefined);
                assert.equal(fs.existsSync(folderPath), false);
            } finally {
                await mgr.shutdown();
            }
        });

        it('throws when deleting an unknown index', async () => {
            const mgr = new IndexManager({ rootDir: tmpRoot, scanInterval: 100000 });
            await mgr.initialize();
            try {
                await assert.rejects(mgr.deleteIndex('nope'), /Index not found/);
            } finally {
                await mgr.shutdown();
            }
        });
    });
});
