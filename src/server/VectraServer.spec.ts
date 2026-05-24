import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { VectraServer } from './VectraServer';

const TEST_ROOT = path.join(__dirname, '..', '..', '.test-server-root');
const PROTO_PATH = path.join(__dirname, '..', '..', 'proto', 'vectra_service.proto');

function loadClient(port: number): any {
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
        keepCase: true,
        longs: Number,
        enums: String,
        defaults: true,
        oneofs: true,
    });
    const proto = grpc.loadPackageDefinition(packageDefinition) as any;
    return new proto.vectra.VectraService(
        `127.0.0.1:${port}`,
        grpc.credentials.createInsecure()
    );
}

function rpc(client: any, method: string, request: any): Promise<any> {
    return new Promise((resolve, reject) => {
        client[method](request, (err: any, response: any) => {
            if (err) reject(err);
            else resolve(response);
        });
    });
}

function cleanTestDir() {
    if (fs.existsSync(TEST_ROOT)) {
        fs.rmSync(TEST_ROOT, { recursive: true });
    }
    fs.mkdirSync(TEST_ROOT, { recursive: true });
}

describe('VectraServer', function () {
    this.timeout(30000);

    let server: VectraServer;
    let client: any;
    let port: number;

    before(async () => {
        cleanTestDir();
        server = new VectraServer({
            port: 0, // random available port
            rootDir: TEST_ROOT,
            scanInterval: 500,
        });
        port = await server.start();
        client = loadClient(port);
    });

    after(async () => {
        if (client) {
            client.close();
        }
        if (server) {
            await server.shutdown();
        }
        if (fs.existsSync(TEST_ROOT)) {
            fs.rmSync(TEST_ROOT, { recursive: true });
        }
    });

    describe('Lifecycle RPCs', () => {
        it('should respond to Healthcheck', async () => {
            const res = await rpc(client, 'Healthcheck', {});
            assert.strictEqual(res.status, 'ok');
            assert.strictEqual(typeof res.uptime_seconds, 'number');
            assert.strictEqual(typeof res.loaded_indexes, 'number');
        });
    });

    describe('Index Management RPCs', () => {
        it('should create an index', async () => {
            await rpc(client, 'CreateIndex', {
                index_name: 'test-index',
                format: 'json',
                is_document_index: false,
            });

            const list = await rpc(client, 'ListIndexes', {});
            const names = list.indexes.map((i: any) => i.name);
            assert.ok(names.includes('test-index'), `Expected test-index in ${JSON.stringify(names)}`);
        });

        it('should fail to create a duplicate index', async () => {
            try {
                await rpc(client, 'CreateIndex', {
                    index_name: 'test-index',
                    format: 'json',
                    is_document_index: false,
                });
                assert.fail('Expected ALREADY_EXISTS error');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.ALREADY_EXISTS);
            }
        });

        it('should list indexes', async () => {
            const res = await rpc(client, 'ListIndexes', {});
            assert.ok(Array.isArray(res.indexes));
            assert.ok(res.indexes.length >= 1);
        });
    });

    describe('Item Operations RPCs', () => {
        const testVector = new Array(3).fill(0).map((_, i) => (i + 1) * 0.1);

        it('should insert an item', async () => {
            const res = await rpc(client, 'InsertItem', {
                index_name: 'test-index',
                vector: testVector,
                metadata: {
                    category: { string_value: 'test' },
                    score: { number_value: 0.95 },
                },
                id: 'item-1',
            });
            assert.strictEqual(res.id, 'item-1');
        });

        it('should get an item by id', async () => {
            const res = await rpc(client, 'GetItem', {
                index_name: 'test-index',
                id: 'item-1',
            });
            assert.ok(res.item);
            assert.strictEqual(res.item.id, 'item-1');
            assert.ok(res.item.vector.length > 0);
        });

        it('should return NOT_FOUND for missing item', async () => {
            try {
                await rpc(client, 'GetItem', {
                    index_name: 'test-index',
                    id: 'nonexistent',
                });
                assert.fail('Expected NOT_FOUND error');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.NOT_FOUND);
            }
        });

        it('should upsert an item', async () => {
            const newVector = new Array(3).fill(0).map((_, i) => (i + 1) * 0.2);
            const res = await rpc(client, 'UpsertItem', {
                index_name: 'test-index',
                id: 'item-1',
                vector: newVector,
                metadata: {
                    category: { string_value: 'updated' },
                },
            });
            assert.strictEqual(res.id, 'item-1');

            // Verify update
            const getRes = await rpc(client, 'GetItem', {
                index_name: 'test-index',
                id: 'item-1',
            });
            assert.strictEqual(getRes.item.metadata.category.string_value, 'updated');
        });

        it('should batch insert items', async () => {
            const res = await rpc(client, 'BatchInsertItems', {
                index_name: 'test-index',
                items: [
                    { vector: [0.1, 0.2, 0.3], metadata: { tag: { string_value: 'a' } }, id: 'batch-1' },
                    { vector: [0.4, 0.5, 0.6], metadata: { tag: { string_value: 'b' } }, id: 'batch-2' },
                ],
            });
            assert.strictEqual(res.ids.length, 2);
            assert.ok(res.ids.includes('batch-1'));
            assert.ok(res.ids.includes('batch-2'));
        });

        it('should list items', async () => {
            const res = await rpc(client, 'ListItems', {
                index_name: 'test-index',
            });
            assert.ok(res.items.length >= 3); // item-1, batch-1, batch-2
        });

        it('should delete an item', async () => {
            await rpc(client, 'DeleteItem', {
                index_name: 'test-index',
                id: 'batch-2',
            });

            // Verify it's gone
            try {
                await rpc(client, 'GetItem', {
                    index_name: 'test-index',
                    id: 'batch-2',
                });
                assert.fail('Expected NOT_FOUND');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.NOT_FOUND);
            }
        });
    });

    describe('Query RPCs', () => {
        it('should query items by vector', async () => {
            const res = await rpc(client, 'QueryItems', {
                index_name: 'test-index',
                vector: [0.1, 0.2, 0.3],
                top_k: 5,
            });
            assert.ok(Array.isArray(res.results));
            assert.ok(res.results.length > 0);
            // Results should have scores
            assert.ok(typeof res.results[0].score === 'number');
        });
    });

    describe('Stats RPCs', () => {
        it('should get index stats', async () => {
            const res = await rpc(client, 'GetIndexStats', {
                index_name: 'test-index',
            });
            assert.strictEqual(res.version, 1);
            assert.strictEqual(res.format, 'json');
            assert.ok(typeof res.item_count === 'number');
        });
    });

    describe('Error handling', () => {
        it('should return NOT_FOUND for unknown index', async () => {
            try {
                await rpc(client, 'GetIndexStats', {
                    index_name: 'no-such-index',
                });
                assert.fail('Expected NOT_FOUND');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.NOT_FOUND);
            }
        });

        it('should return INVALID_ARGUMENT for missing required fields', async () => {
            try {
                await rpc(client, 'InsertItem', {
                    index_name: 'test-index',
                    // no text or vector
                });
                assert.fail('Expected INVALID_ARGUMENT');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.INVALID_ARGUMENT);
            }
        });

        it('should return FAILED_PRECONDITION for non-document index on document ops', async () => {
            try {
                await rpc(client, 'ListDocuments', {
                    index_name: 'test-index',
                });
                assert.fail('Expected FAILED_PRECONDITION');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.FAILED_PRECONDITION);
            }
        });
    });

    describe('Index deletion', () => {
        it('should delete an index', async () => {
            await rpc(client, 'DeleteIndex', {
                index_name: 'test-index',
            });

            const list = await rpc(client, 'ListIndexes', {});
            const names = list.indexes.map((i: any) => i.name);
            assert.ok(!names.includes('test-index'));
        });
    });

    describe('Auto-detect new indexes', () => {
        it('should detect indexes created on disk', async function () {
            // Create an index directly on disk (outside the gRPC API)
            const indexDir = path.join(TEST_ROOT, 'auto-detected');
            fs.mkdirSync(indexDir, { recursive: true });
            fs.writeFileSync(path.join(indexDir, 'index.json'), JSON.stringify({
                version: 1,
                metadata_config: {},
                items: [],
            }));

            // Wait for the scanner to pick it up
            await new Promise(r => setTimeout(r, 1500));

            const list = await rpc(client, 'ListIndexes', {});
            const names = list.indexes.map((i: any) => i.name);
            assert.ok(names.includes('auto-detected'), `Expected auto-detected in ${JSON.stringify(names)}`);
        });
    });

    describe('Server accessors', () => {
        it('exposes the underlying gRPC server and IndexManager via getters', () => {
            assert.ok(server.server, 'server getter should return the gRPC server');
            assert.ok(server.indexManager, 'indexManager getter should return the manager');
        });
    });

    describe('Handler argument validation', () => {
        it('CreateIndex returns INVALID_ARGUMENT when index_name is missing', async () => {
            try {
                await rpc(client, 'CreateIndex', { format: 'json', is_document_index: false });
                assert.fail('Expected INVALID_ARGUMENT');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.INVALID_ARGUMENT);
            }
        });

        it('DeleteIndex returns INVALID_ARGUMENT when index_name is missing', async () => {
            try {
                await rpc(client, 'DeleteIndex', {});
                assert.fail('Expected INVALID_ARGUMENT');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.INVALID_ARGUMENT);
            }
        });
    });

    describe('Shutdown RPC', () => {
        // Placed last because it triggers server shutdown asynchronously; the
        // top-level after() hook just awaits the same shutdown promise.
        it('Shutdown RPC schedules graceful server shutdown', async () => {
            const res = await rpc(client, 'Shutdown', {});
            assert.deepEqual(res, {});
            // Give nextTick a chance to fire the onShutdown callback.
            await new Promise(r => setTimeout(r, 50));
        });
    });
});

describe('VectraServer (isolated lifecycle)', function () {
    this.timeout(10000);

    it('shutdown() is idempotent — concurrent calls share a single shutdown', async () => {
        const dir = path.join(__dirname, '..', '..', '.test-server-idem');
        if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
        fs.mkdirSync(dir, { recursive: true });
        try {
            const s = new VectraServer({ port: 0, rootDir: dir, scanInterval: 1000 });
            await s.start();
            const mgr = s.indexManager;
            let mgrShutdownCalls = 0;
            const realShutdown = mgr.shutdown.bind(mgr);
            mgr.shutdown = async () => { mgrShutdownCalls++; await realShutdown(); };

            await Promise.all([s.shutdown(), s.shutdown(), s.shutdown()]);
            assert.equal(mgrShutdownCalls, 1, 'indexManager.shutdown should fire exactly once');
            assert.equal(s.server, undefined, 'server should be cleared after shutdown');
        } finally {
            if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
        }
    });

    it('shutdown() is a no-op when start() was never called', async () => {
        const dir = path.join(__dirname, '..', '..', '.test-server-nostart');
        if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
        fs.mkdirSync(dir, { recursive: true });
        try {
            const s = new VectraServer({ port: 0, rootDir: dir });
            await s.shutdown(); // should not throw
            assert.equal(s.server, undefined);
        } finally {
            if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
        }
    });

    it('start() rejects when binding an already-bound port', async () => {
        const dirA = path.join(__dirname, '..', '..', '.test-server-bindA');
        const dirB = path.join(__dirname, '..', '..', '.test-server-bindB');
        for (const d of [dirA, dirB]) {
            if (fs.existsSync(d)) fs.rmSync(d, { recursive: true });
            fs.mkdirSync(d, { recursive: true });
        }
        const a = new VectraServer({ port: 0, rootDir: dirA });
        const portA = await a.start();
        const b = new VectraServer({ port: portA, rootDir: dirB });
        try {
            await assert.rejects(b.start());
        } finally {
            await a.shutdown();
            await b.shutdown().catch(() => { /* may not have started */ });
            for (const d of [dirA, dirB]) {
                if (fs.existsSync(d)) fs.rmSync(d, { recursive: true });
            }
        }
    });
});
