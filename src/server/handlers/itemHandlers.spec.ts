import * as assert from 'assert';
import * as sinon from 'sinon';
import * as grpc from '@grpc/grpc-js';
import { createItemHandlers } from './itemHandlers';
import { IndexManager } from '../IndexManager';
import { EmbeddingsModel, EmbeddingsResponse } from '../../types';

function callHandler(handler: any, request: any): Promise<any> {
    return new Promise((resolve, reject) => {
        handler({ request } as any, (err: any, result: any) => {
            if (err) reject(err);
            else resolve(result);
        });
    });
}

describe('itemHandlers', () => {
    let manager: sinon.SinonStubbedInstance<IndexManager>;
    let embeddings: { createEmbeddings: sinon.SinonStub; maxTokens: number };

    beforeEach(() => {
        manager = sinon.createStubInstance(IndexManager);
        embeddings = {
            createEmbeddings: sinon.stub(),
            maxTokens: 8192,
        };
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('InsertItem', () => {
        it('should require index_name', async () => {
            const handlers = createItemHandlers(manager as any);
            try {
                await callHandler(handlers.InsertItem, {});
                assert.fail('Expected error');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.INVALID_ARGUMENT);
                assert.ok(err.message.includes('index_name'));
            }
        });

        it('should insert with vector', async () => {
            const mockIndex = {
                insertItem: sinon.stub().resolves({ id: 'item-1' }),
            };
            manager.requireIndex.returns({ index: mockIndex as any, name: 'test', isDocumentIndex: false, format: 'json' });

            const handlers = createItemHandlers(manager as any);
            const result = await callHandler(handlers.InsertItem, {
                index_name: 'test',
                vector: [0.1, 0.2],
                id: 'item-1',
                metadata: { tag: { string_value: 'a' } },
            });

            assert.strictEqual(result.id, 'item-1');
            const insertedItem = mockIndex.insertItem.firstCall.args[0];
            assert.strictEqual(insertedItem.id, 'item-1');
            assert.deepStrictEqual(insertedItem.vector, [0.1, 0.2]);
            assert.deepStrictEqual(insertedItem.metadata, { tag: 'a' });
        });

        it('should insert with text using embeddings', async () => {
            const mockIndex = {
                insertItem: sinon.stub().resolves({ id: 'item-2' }),
            };
            manager.requireIndex.returns({ index: mockIndex as any, name: 'test', isDocumentIndex: false, format: 'json' });
            embeddings.createEmbeddings.resolves({
                status: 'success',
                output: [[0.3, 0.4]],
            } as EmbeddingsResponse);

            const handlers = createItemHandlers(manager as any, embeddings as any);
            const result = await callHandler(handlers.InsertItem, {
                index_name: 'test',
                text: 'hello',
            });

            assert.ok(result.id); // auto-generated UUID
            const insertedItem = mockIndex.insertItem.firstCall.args[0];
            assert.deepStrictEqual(insertedItem.vector, [0.3, 0.4]);
        });

        it('should fail without text or vector', async () => {
            manager.requireIndex.returns({ index: {} as any, name: 'test', isDocumentIndex: false, format: 'json' });

            const handlers = createItemHandlers(manager as any);
            try {
                await callHandler(handlers.InsertItem, { index_name: 'test' });
                assert.fail('Expected error');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.INVALID_ARGUMENT);
                assert.ok(err.message.includes('text or vector'));
            }
        });

        it('should fail when text provided but no embeddings model', async () => {
            manager.requireIndex.returns({ index: {} as any, name: 'test', isDocumentIndex: false, format: 'json' });

            const handlers = createItemHandlers(manager as any); // no embeddings
            try {
                await callHandler(handlers.InsertItem, { index_name: 'test', text: 'hello' });
                assert.fail('Expected error');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.FAILED_PRECONDITION);
            }
        });

        it('should fail when embeddings returns error', async () => {
            manager.requireIndex.returns({ index: {} as any, name: 'test', isDocumentIndex: false, format: 'json' });
            embeddings.createEmbeddings.resolves({ status: 'error', message: 'quota exceeded' } as EmbeddingsResponse);

            const handlers = createItemHandlers(manager as any, embeddings as any);
            try {
                await callHandler(handlers.InsertItem, { index_name: 'test', text: 'hello' });
                assert.fail('Expected error');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.INTERNAL);
                assert.ok(err.message.includes('quota exceeded'));
            }
        });
    });

    describe('UpsertItem', () => {
        it('should require index_name', async () => {
            const handlers = createItemHandlers(manager as any);
            try {
                await callHandler(handlers.UpsertItem, {});
                assert.fail('Expected error');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.INVALID_ARGUMENT);
            }
        });

        it('should require id', async () => {
            manager.requireIndex.returns({ index: {} as any, name: 'test', isDocumentIndex: false, format: 'json' });

            const handlers = createItemHandlers(manager as any);
            try {
                await callHandler(handlers.UpsertItem, { index_name: 'test' });
                assert.fail('Expected error');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.INVALID_ARGUMENT);
                assert.ok(err.message.includes('id'));
            }
        });

        it('should upsert with vector', async () => {
            const mockIndex = {
                upsertItem: sinon.stub().resolves({ id: 'item-1' }),
            };
            manager.requireIndex.returns({ index: mockIndex as any, name: 'test', isDocumentIndex: false, format: 'json' });

            const handlers = createItemHandlers(manager as any);
            const result = await callHandler(handlers.UpsertItem, {
                index_name: 'test',
                id: 'item-1',
                vector: [0.1, 0.2],
            });

            assert.strictEqual(result.id, 'item-1');
        });
    });

    describe('BatchInsertItems', () => {
        it('should require index_name', async () => {
            const handlers = createItemHandlers(manager as any);
            try {
                await callHandler(handlers.BatchInsertItems, {});
                assert.fail('Expected error');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.INVALID_ARGUMENT);
            }
        });

        it('should batch insert items', async () => {
            const mockIndex = {
                batchInsertItems: sinon.stub().resolves([{ id: 'a' }, { id: 'b' }]),
            };
            manager.requireIndex.returns({ index: mockIndex as any, name: 'test', isDocumentIndex: false, format: 'json' });

            const handlers = createItemHandlers(manager as any);
            const result = await callHandler(handlers.BatchInsertItems, {
                index_name: 'test',
                items: [
                    { vector: [0.1, 0.2], metadata: {}, id: 'a' },
                    { vector: [0.3, 0.4], metadata: {}, id: 'b' },
                ],
            });

            assert.deepStrictEqual(result.ids, ['a', 'b']);
        });

        it('should handle empty items array', async () => {
            const mockIndex = {
                batchInsertItems: sinon.stub().resolves([]),
            };
            manager.requireIndex.returns({ index: mockIndex as any, name: 'test', isDocumentIndex: false, format: 'json' });

            const handlers = createItemHandlers(manager as any);
            const result = await callHandler(handlers.BatchInsertItems, {
                index_name: 'test',
            });

            assert.deepStrictEqual(result.ids, []);
        });
    });

    describe('GetItem', () => {
        it('should require index_name', async () => {
            const handlers = createItemHandlers(manager as any);
            try {
                await callHandler(handlers.GetItem, {});
                assert.fail('Expected error');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.INVALID_ARGUMENT);
            }
        });

        it('should require id', async () => {
            manager.requireIndex.returns({ index: {} as any, name: 'test', isDocumentIndex: false, format: 'json' });

            const handlers = createItemHandlers(manager as any);
            try {
                await callHandler(handlers.GetItem, { index_name: 'test' });
                assert.fail('Expected error');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.INVALID_ARGUMENT);
                assert.ok(err.message.includes('id'));
            }
        });

        it('should return item', async () => {
            const mockIndex = {
                getItem: sinon.stub().resolves({
                    id: 'item-1',
                    metadata: { tag: 'a' },
                    vector: [0.1, 0.2],
                    norm: 1.0,
                }),
            };
            manager.requireIndex.returns({ index: mockIndex as any, name: 'test', isDocumentIndex: false, format: 'json' });

            const handlers = createItemHandlers(manager as any);
            const result = await callHandler(handlers.GetItem, {
                index_name: 'test',
                id: 'item-1',
            });

            assert.strictEqual(result.item.id, 'item-1');
            assert.deepStrictEqual(result.item.vector, [0.1, 0.2]);
        });

        it('should return NOT_FOUND for missing item', async () => {
            const mockIndex = {
                getItem: sinon.stub().resolves(undefined),
            };
            manager.requireIndex.returns({ index: mockIndex as any, name: 'test', isDocumentIndex: false, format: 'json' });

            const handlers = createItemHandlers(manager as any);
            try {
                await callHandler(handlers.GetItem, { index_name: 'test', id: 'missing' });
                assert.fail('Expected error');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.NOT_FOUND);
            }
        });
    });

    describe('DeleteItem', () => {
        it('should require index_name', async () => {
            const handlers = createItemHandlers(manager as any);
            try {
                await callHandler(handlers.DeleteItem, {});
                assert.fail('Expected error');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.INVALID_ARGUMENT);
            }
        });

        it('should require id', async () => {
            manager.requireIndex.returns({ index: {} as any, name: 'test', isDocumentIndex: false, format: 'json' });

            const handlers = createItemHandlers(manager as any);
            try {
                await callHandler(handlers.DeleteItem, { index_name: 'test' });
                assert.fail('Expected error');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.INVALID_ARGUMENT);
            }
        });

        it('should delete item', async () => {
            const mockIndex = {
                deleteItem: sinon.stub().resolves(),
            };
            manager.requireIndex.returns({ index: mockIndex as any, name: 'test', isDocumentIndex: false, format: 'json' });

            const handlers = createItemHandlers(manager as any);
            const result = await callHandler(handlers.DeleteItem, {
                index_name: 'test',
                id: 'item-1',
            });

            assert.deepStrictEqual(result, {});
            assert.ok(mockIndex.deleteItem.calledWith('item-1'));
        });
    });

    describe('ListItems', () => {
        it('should require index_name', async () => {
            const handlers = createItemHandlers(manager as any);
            try {
                await callHandler(handlers.ListItems, {});
                assert.fail('Expected error');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.INVALID_ARGUMENT);
            }
        });

        it('should list all items without filter', async () => {
            const mockIndex = {
                listItems: sinon.stub().resolves([
                    { id: 'a', metadata: {}, vector: [0.1], norm: 1.0 },
                    { id: 'b', metadata: {}, vector: [0.2], norm: 1.0 },
                ]),
            };
            manager.requireIndex.returns({ index: mockIndex as any, name: 'test', isDocumentIndex: false, format: 'json' });

            const handlers = createItemHandlers(manager as any);
            const result = await callHandler(handlers.ListItems, { index_name: 'test' });

            assert.strictEqual(result.items.length, 2);
            assert.ok(mockIndex.listItems.calledOnce);
        });

        it('should list items with filter', async () => {
            const mockIndex = {
                listItemsByMetadata: sinon.stub().resolves([
                    { id: 'a', metadata: { tag: 'x' }, vector: [0.1], norm: 1.0 },
                ]),
            };
            manager.requireIndex.returns({ index: mockIndex as any, name: 'test', isDocumentIndex: false, format: 'json' });

            const handlers = createItemHandlers(manager as any);
            const result = await callHandler(handlers.ListItems, {
                index_name: 'test',
                filter: { filter_json: '{"tag":"x"}' },
            });

            assert.strictEqual(result.items.length, 1);
            assert.ok(mockIndex.listItemsByMetadata.calledWith({ tag: 'x' }));
        });
    });
});
