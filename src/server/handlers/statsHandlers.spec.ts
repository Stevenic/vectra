import * as assert from 'assert';
import * as sinon from 'sinon';
import * as grpc from '@grpc/grpc-js';
import { createStatsHandlers } from './statsHandlers';
import { IndexManager } from '../IndexManager';

function callHandler(handler: any, request: any): Promise<any> {
    return new Promise((resolve, reject) => {
        handler({ request } as any, (err: any, result: any) => {
            if (err) reject(err);
            else resolve(result);
        });
    });
}

describe('statsHandlers', () => {
    let manager: sinon.SinonStubbedInstance<IndexManager>;

    beforeEach(() => {
        manager = sinon.createStubInstance(IndexManager);
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('GetIndexStats', () => {
        it('should require index_name', async () => {
            const handlers = createStatsHandlers(manager as any);
            try {
                await callHandler(handlers.GetIndexStats, {});
                assert.fail('Expected error');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.INVALID_ARGUMENT);
            }
        });

        it('should return index stats', async () => {
            const mockIndex = {
                getIndexStats: sinon.stub().resolves({
                    version: 1,
                    items: 42,
                    metadata_config: { indexed: ['tag', 'score'] },
                }),
            };
            manager.requireIndex.returns({ index: mockIndex as any, name: 'test', isDocumentIndex: false, format: 'protobuf' });

            const handlers = createStatsHandlers(manager as any);
            const result = await callHandler(handlers.GetIndexStats, { index_name: 'test' });

            assert.strictEqual(result.version, 1);
            assert.strictEqual(result.format, 'protobuf');
            assert.strictEqual(result.item_count, 42);
            assert.strictEqual(result.metadata_config_count, 2);
        });

        it('should handle missing metadata_config', async () => {
            const mockIndex = {
                getIndexStats: sinon.stub().resolves({
                    version: 1,
                    items: 0,
                    metadata_config: {},
                }),
            };
            manager.requireIndex.returns({ index: mockIndex as any, name: 'test', isDocumentIndex: false, format: 'json' });

            const handlers = createStatsHandlers(manager as any);
            const result = await callHandler(handlers.GetIndexStats, { index_name: 'test' });

            assert.strictEqual(result.metadata_config_count, 0);
        });
    });

    describe('GetCatalogStats', () => {
        it('should require index_name', async () => {
            const handlers = createStatsHandlers(manager as any);
            try {
                await callHandler(handlers.GetCatalogStats, {});
                assert.fail('Expected error');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.INVALID_ARGUMENT);
            }
        });

        it('should return catalog stats', async () => {
            const mockDocIndex = {
                getCatalogStats: sinon.stub().resolves({
                    version: 1,
                    documents: 10,
                    chunks: 150,
                }),
            };
            manager.requireDocumentIndex.returns({ managed: {} as any, docIndex: mockDocIndex as any });

            const handlers = createStatsHandlers(manager as any);
            const result = await callHandler(handlers.GetCatalogStats, { index_name: 'test' });

            assert.strictEqual(result.version, 1);
            assert.strictEqual(result.document_count, 10);
            assert.strictEqual(result.chunk_count, 150);
            assert.deepStrictEqual(result.metadata_counts, {});
        });
    });
});
