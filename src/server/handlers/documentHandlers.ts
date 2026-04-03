import * as grpc from '@grpc/grpc-js';
import { IndexManager } from '../IndexManager';
import { wrapHandler, grpcError, fromProtoMetadata } from './helpers';

export function createDocumentHandlers(manager: IndexManager) {
    return {
        UpsertDocument: wrapHandler(async (call: grpc.ServerUnaryCall<any, any>) => {
            const req = call.request;
            if (!req.index_name) {
                throw grpcError(grpc.status.INVALID_ARGUMENT, 'index_name is required');
            }
            if (!req.uri) {
                throw grpcError(grpc.status.INVALID_ARGUMENT, 'uri is required');
            }
            if (!req.text) {
                throw grpcError(grpc.status.INVALID_ARGUMENT, 'text is required');
            }
            const { docIndex } = manager.requireDocumentIndex(req.index_name);
            const metadata = fromProtoMetadata(req.metadata);
            const metadataArg = Object.keys(metadata).length > 0 ? metadata : undefined;

            const doc = await docIndex.upsertDocument(
                req.uri,
                req.text,
                req.doc_type || undefined,
                metadataArg
            );
            return { document_id: doc.id };
        }),

        DeleteDocument: wrapHandler(async (call: grpc.ServerUnaryCall<any, any>) => {
            const req = call.request;
            if (!req.index_name) {
                throw grpcError(grpc.status.INVALID_ARGUMENT, 'index_name is required');
            }
            if (!req.uri) {
                throw grpcError(grpc.status.INVALID_ARGUMENT, 'uri is required');
            }
            const { docIndex } = manager.requireDocumentIndex(req.index_name);
            await docIndex.deleteDocument(req.uri);
            return {};
        }),

        ListDocuments: wrapHandler(async (call: grpc.ServerUnaryCall<any, any>) => {
            const req = call.request;
            if (!req.index_name) {
                throw grpcError(grpc.status.INVALID_ARGUMENT, 'index_name is required');
            }
            const { docIndex } = manager.requireDocumentIndex(req.index_name);
            const docs = await docIndex.listDocuments();
            return {
                documents: docs.map(doc => ({
                    uri: doc.uri,
                    document_id: doc.id,
                })),
            };
        }),
    };
}
