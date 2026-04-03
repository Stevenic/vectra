import * as assert from 'assert';
import * as sinon from 'sinon';
import * as grpc from '@grpc/grpc-js';
import { createQueryHandlers } from './queryHandlers';
import { IndexManager } from '../IndexManager';
import { EmbeddingsModel, EmbeddingsResponse } from '../../types';

function makeCall(request: any): any {
    return { request } as any;
}

function callHandler(handler: any, request: any): Promise<any> {
    return new Promise((resolve, reject) => {
        handler(makeCall(request), (err: any, result: any) => {
            if (err) reject(err);
            else resolve(result);
        });
    });
}

describe('queryHandlers', () => {
    let manager: sinon.SinonStubbedInstance<IndexManager>;
    let embeddings: sinon.SinonStubbedInstance<EmbeddingsModel>;

    beforeEach(() => {
        manager = sinon.createStubInstance(IndexManager);
        embeddings = {
            createEmbeddings: sinon.stub(),
            maxTokens: 8192,
        } as any;
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('QueryItems', () => {
        it('should require index_name', async () => {
            const handlers = createQueryHandlers(manager as any);
            try {
                await callHandler(handlers.QueryItems, {});
                assert.fail('Expected error');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.INVALID_ARGUMENT);
                assert.ok(err.message.includes('index_name'));
            }
        });

        it('should query by vector', async () => {
            const mockIndex = {
                queryItems: sinon.stub().resolves([
                    {
                        item: { id: 'item-1', metadata: { tag: 'a' }, vector: [0.1, 0.2], norm: 1.0 },
                        score: 0.95,
                    },
                ]),
            };
            manager.requireIndex.returns({ index: mockIndex as any, name: 'test', isDocumentIndex: false, format: 'json' });

            const handlers = createQueryHandlers(manager as any);
            const result = await callHandler(handlers.QueryItems, {
                index_name: 'test',
                vector: [0.1, 0.2],
                top_k: 5,
            });

            assert.strictEqual(result.results.length, 1);
            assert.strictEqual(result.results[0].id, 'item-1');
            assert.strictEqual(result.results[0].score, 0.95);
            assert.ok(mockIndex.queryItems.calledOnce);
            assert.deepStrictEqual(mockIndex.queryItems.firstCall.args[0], [0.1, 0.2]);
            assert.strictEqual(mockIndex.queryItems.firstCall.args[2], 5);
        });

        it('should default top_k to 10', async () => {
            const mockIndex = { queryItems: sinon.stub().resolves([]) };
            manager.requireIndex.returns({ index: mockIndex as any, name: 'test', isDocumentIndex: false, format: 'json' });

            const handlers = createQueryHandlers(manager as any);
            await callHandler(handlers.QueryItems, {
                index_name: 'test',
                vector: [0.1, 0.2],
            });

            assert.strictEqual(mockIndex.queryItems.firstCall.args[2], 10);
        });

        it('should query by text using embeddings', async () => {
            const mockIndex = { queryItems: sinon.stub().resolves([]) };
            manager.requireIndex.returns({ index: mockIndex as any, name: 'test', isDocumentIndex: false, format: 'json' });
            (embeddings.createEmbeddings as sinon.SinonStub).resolves({
                status: 'success',
                output: [[0.5, 0.6]],
            } as EmbeddingsResponse);

            const handlers = createQueryHandlers(manager as any, embeddings as any);
            await callHandler(handlers.QueryItems, {
                index_name: 'test',
                text: 'hello world',
            });

            assert.ok((embeddings.createEmbeddings as sinon.SinonStub).calledWith('hello world'));
            assert.deepStrictEqual(mockIndex.queryItems.firstCall.args[0], [0.5, 0.6]);
        });

        it('should fail when text provided but no embeddings model', async () => {
            manager.requireIndex.returns({ index: {} as any, name: 'test', isDocumentIndex: false, format: 'json' });

            const handlers = createQueryHandlers(manager as any); // no embeddings
            try {
                await callHandler(handlers.QueryItems, {
                    index_name: 'test',
                    text: 'hello',
                });
                assert.fail('Expected error');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.FAILED_PRECONDITION);
                assert.ok(err.message.includes('No embeddings model'));
            }
        });

        it('should fail when embeddings returns error', async () => {
            manager.requireIndex.returns({ index: {} as any, name: 'test', isDocumentIndex: false, format: 'json' });
            (embeddings.createEmbeddings as sinon.SinonStub).resolves({
                status: 'error',
                message: 'rate limited',
            } as EmbeddingsResponse);

            const handlers = createQueryHandlers(manager as any, embeddings as any);
            try {
                await callHandler(handlers.QueryItems, {
                    index_name: 'test',
                    text: 'hello',
                });
                assert.fail('Expected error');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.INTERNAL);
                assert.ok(err.message.includes('rate limited'));
            }
        });

        it('should require text or vector', async () => {
            manager.requireIndex.returns({ index: {} as any, name: 'test', isDocumentIndex: false, format: 'json' });

            const handlers = createQueryHandlers(manager as any);
            try {
                await callHandler(handlers.QueryItems, {
                    index_name: 'test',
                });
                assert.fail('Expected error');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.INVALID_ARGUMENT);
                assert.ok(err.message.includes('text or vector'));
            }
        });

        it('should pass filter to queryItems', async () => {
            const mockIndex = { queryItems: sinon.stub().resolves([]) };
            manager.requireIndex.returns({ index: mockIndex as any, name: 'test', isDocumentIndex: false, format: 'json' });

            const handlers = createQueryHandlers(manager as any);
            await callHandler(handlers.QueryItems, {
                index_name: 'test',
                vector: [0.1],
                filter: { filter_json: '{"tag":"a"}' },
            });

            assert.deepStrictEqual(mockIndex.queryItems.firstCall.args[3], { tag: 'a' });
        });
    });

    describe('QueryDocuments', () => {
        it('should require index_name', async () => {
            const handlers = createQueryHandlers(manager as any);
            try {
                await callHandler(handlers.QueryDocuments, {});
                assert.fail('Expected error');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.INVALID_ARGUMENT);
            }
        });

        it('should require query', async () => {
            const mockDocIndex = {};
            manager.requireDocumentIndex.returns({ managed: {} as any, docIndex: mockDocIndex as any });

            const handlers = createQueryHandlers(manager as any);
            try {
                await callHandler(handlers.QueryDocuments, {
                    index_name: 'test',
                });
                assert.fail('Expected error');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.INVALID_ARGUMENT);
                assert.ok(err.message.includes('query'));
            }
        });

        it('should query documents and return results', async () => {
            const mockDocIndex = {
                queryDocuments: sinon.stub().resolves([
                    {
                        uri: 'doc1.txt',
                        id: 'doc-1',
                        score: 0.9,
                        chunks: [
                            {
                                item: { metadata: { startPos: 0, endPos: 4 } },
                                score: 0.9,
                            },
                        ],
                        loadText: sinon.stub().resolves('hello world'),
                    },
                ]),
            };
            manager.requireDocumentIndex.returns({ managed: {} as any, docIndex: mockDocIndex as any });

            const handlers = createQueryHandlers(manager as any);
            const result = await callHandler(handlers.QueryDocuments, {
                index_name: 'test',
                query: 'search term',
                max_documents: 5,
                max_chunks: 20,
            });

            assert.strictEqual(result.results.length, 1);
            assert.strictEqual(result.results[0].uri, 'doc1.txt');
            assert.strictEqual(result.results[0].document_id, 'doc-1');
            assert.strictEqual(result.results[0].score, 0.9);
            assert.strictEqual(result.results[0].chunks.length, 1);
            assert.strictEqual(result.results[0].chunks[0].text, 'hello');
            assert.strictEqual(result.results[0].chunks[0].score, 0.9);
        });

        it('should handle chunk text loading failure gracefully', async () => {
            const mockDocIndex = {
                queryDocuments: sinon.stub().resolves([
                    {
                        uri: 'doc1.txt',
                        id: 'doc-1',
                        score: 0.8,
                        chunks: [
                            {
                                item: { metadata: { startPos: 0, endPos: 4 } },
                                score: 0.8,
                            },
                        ],
                        loadText: sinon.stub().rejects(new Error('file gone')),
                    },
                ]),
            };
            manager.requireDocumentIndex.returns({ managed: {} as any, docIndex: mockDocIndex as any });

            const handlers = createQueryHandlers(manager as any);
            const result = await callHandler(handlers.QueryDocuments, {
                index_name: 'test',
                query: 'search',
            });

            assert.strictEqual(result.results[0].chunks[0].text, '');
        });

        it('should pass filter and bm25 options', async () => {
            const mockDocIndex = { queryDocuments: sinon.stub().resolves([]) };
            manager.requireDocumentIndex.returns({ managed: {} as any, docIndex: mockDocIndex as any });

            const handlers = createQueryHandlers(manager as any);
            await callHandler(handlers.QueryDocuments, {
                index_name: 'test',
                query: 'search',
                filter: { filter_json: '{"tag":"b"}' },
                use_bm25: true,
            });

            const opts = mockDocIndex.queryDocuments.firstCall.args[1];
            assert.deepStrictEqual(opts.filter, { tag: 'b' });
            assert.strictEqual(opts.isBm25, true);
        });
    });
});
