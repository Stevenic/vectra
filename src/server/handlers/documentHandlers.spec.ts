import * as assert from 'assert';
import * as sinon from 'sinon';
import * as grpc from '@grpc/grpc-js';
import { createDocumentHandlers } from './documentHandlers';
import { IndexManager } from '../IndexManager';

function callHandler(handler: any, request: any): Promise<any> {
    return new Promise((resolve, reject) => {
        handler({ request } as any, (err: any, result: any) => {
            if (err) reject(err);
            else resolve(result);
        });
    });
}

describe('documentHandlers', () => {
    let manager: sinon.SinonStubbedInstance<IndexManager>;

    beforeEach(() => {
        manager = sinon.createStubInstance(IndexManager);
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('UpsertDocument', () => {
        it('should require index_name', async () => {
            const handlers = createDocumentHandlers(manager as any);
            try {
                await callHandler(handlers.UpsertDocument, {});
                assert.fail('Expected error');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.INVALID_ARGUMENT);
                assert.ok(err.message.includes('index_name'));
            }
        });

        it('should require uri', async () => {
            const handlers = createDocumentHandlers(manager as any);
            try {
                await callHandler(handlers.UpsertDocument, { index_name: 'test' });
                assert.fail('Expected error');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.INVALID_ARGUMENT);
                assert.ok(err.message.includes('uri'));
            }
        });

        it('should require text', async () => {
            const handlers = createDocumentHandlers(manager as any);
            try {
                await callHandler(handlers.UpsertDocument, { index_name: 'test', uri: 'doc.txt' });
                assert.fail('Expected error');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.INVALID_ARGUMENT);
                assert.ok(err.message.includes('text'));
            }
        });

        it('should upsert a document and return id', async () => {
            const mockDocIndex = {
                upsertDocument: sinon.stub().resolves({ id: 'doc-123' }),
            };
            manager.requireDocumentIndex.returns({ managed: {} as any, docIndex: mockDocIndex as any });

            const handlers = createDocumentHandlers(manager as any);
            const result = await callHandler(handlers.UpsertDocument, {
                index_name: 'test',
                uri: 'doc.txt',
                text: 'Hello world',
            });

            assert.strictEqual(result.document_id, 'doc-123');
            assert.ok(mockDocIndex.upsertDocument.calledOnce);
            assert.strictEqual(mockDocIndex.upsertDocument.firstCall.args[0], 'doc.txt');
            assert.strictEqual(mockDocIndex.upsertDocument.firstCall.args[1], 'Hello world');
        });

        it('should pass doc_type when provided', async () => {
            const mockDocIndex = {
                upsertDocument: sinon.stub().resolves({ id: 'doc-123' }),
            };
            manager.requireDocumentIndex.returns({ managed: {} as any, docIndex: mockDocIndex as any });

            const handlers = createDocumentHandlers(manager as any);
            await callHandler(handlers.UpsertDocument, {
                index_name: 'test',
                uri: 'doc.md',
                text: '# Title',
                doc_type: 'markdown',
            });

            assert.strictEqual(mockDocIndex.upsertDocument.firstCall.args[2], 'markdown');
        });

        it('should pass metadata when provided', async () => {
            const mockDocIndex = {
                upsertDocument: sinon.stub().resolves({ id: 'doc-123' }),
            };
            manager.requireDocumentIndex.returns({ managed: {} as any, docIndex: mockDocIndex as any });

            const handlers = createDocumentHandlers(manager as any);
            await callHandler(handlers.UpsertDocument, {
                index_name: 'test',
                uri: 'doc.txt',
                text: 'content',
                metadata: { author: { string_value: 'alice' } },
            });

            assert.deepStrictEqual(mockDocIndex.upsertDocument.firstCall.args[3], { author: 'alice' });
        });

        it('should pass undefined metadata when empty', async () => {
            const mockDocIndex = {
                upsertDocument: sinon.stub().resolves({ id: 'doc-123' }),
            };
            manager.requireDocumentIndex.returns({ managed: {} as any, docIndex: mockDocIndex as any });

            const handlers = createDocumentHandlers(manager as any);
            await callHandler(handlers.UpsertDocument, {
                index_name: 'test',
                uri: 'doc.txt',
                text: 'content',
                metadata: {},
            });

            assert.strictEqual(mockDocIndex.upsertDocument.firstCall.args[3], undefined);
        });
    });

    describe('DeleteDocument', () => {
        it('should require index_name', async () => {
            const handlers = createDocumentHandlers(manager as any);
            try {
                await callHandler(handlers.DeleteDocument, {});
                assert.fail('Expected error');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.INVALID_ARGUMENT);
            }
        });

        it('should require uri', async () => {
            const handlers = createDocumentHandlers(manager as any);
            try {
                await callHandler(handlers.DeleteDocument, { index_name: 'test' });
                assert.fail('Expected error');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.INVALID_ARGUMENT);
                assert.ok(err.message.includes('uri'));
            }
        });

        it('should delete a document', async () => {
            const mockDocIndex = {
                deleteDocument: sinon.stub().resolves(),
            };
            manager.requireDocumentIndex.returns({ managed: {} as any, docIndex: mockDocIndex as any });

            const handlers = createDocumentHandlers(manager as any);
            const result = await callHandler(handlers.DeleteDocument, {
                index_name: 'test',
                uri: 'doc.txt',
            });

            assert.deepStrictEqual(result, {});
            assert.ok(mockDocIndex.deleteDocument.calledWith('doc.txt'));
        });
    });

    describe('ListDocuments', () => {
        it('should require index_name', async () => {
            const handlers = createDocumentHandlers(manager as any);
            try {
                await callHandler(handlers.ListDocuments, {});
                assert.fail('Expected error');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.INVALID_ARGUMENT);
            }
        });

        it('should list documents', async () => {
            const mockDocIndex = {
                listDocuments: sinon.stub().resolves([
                    { uri: 'a.txt', id: 'doc-1' },
                    { uri: 'b.txt', id: 'doc-2' },
                ]),
            };
            manager.requireDocumentIndex.returns({ managed: {} as any, docIndex: mockDocIndex as any });

            const handlers = createDocumentHandlers(manager as any);
            const result = await callHandler(handlers.ListDocuments, {
                index_name: 'test',
            });

            assert.strictEqual(result.documents.length, 2);
            assert.strictEqual(result.documents[0].uri, 'a.txt');
            assert.strictEqual(result.documents[0].document_id, 'doc-1');
            assert.strictEqual(result.documents[1].uri, 'b.txt');
        });
    });
});
