import * as grpc from '@grpc/grpc-js';
import { IndexManager } from '../IndexManager';
import { wrapHandler, grpcError } from './helpers';

export function createIndexHandlers(manager: IndexManager) {
    return {
        CreateIndex: wrapHandler(async (call: grpc.ServerUnaryCall<any, any>) => {
            const req = call.request;
            if (!req.index_name) {
                throw grpcError(grpc.status.INVALID_ARGUMENT, 'index_name is required');
            }
            const format = req.format || 'json';
            const isDoc = req.is_document_index || false;
            const docConfig = req.document_config ? {
                version: req.document_config.version || 1,
                chunkSize: req.document_config.chunk_size || 512,
                chunkOverlap: req.document_config.chunk_overlap || 0,
            } : undefined;

            await manager.createIndex(req.index_name, format, isDoc, docConfig);
            return {};
        }),

        DeleteIndex: wrapHandler(async (call: grpc.ServerUnaryCall<any, any>) => {
            const req = call.request;
            if (!req.index_name) {
                throw grpcError(grpc.status.INVALID_ARGUMENT, 'index_name is required');
            }
            await manager.deleteIndex(req.index_name);
            return {};
        }),

        ListIndexes: wrapHandler(async (_call: grpc.ServerUnaryCall<any, any>) => {
            const indexes = manager.listIndexes();
            return {
                indexes: indexes.map(idx => ({
                    name: idx.name,
                    format: idx.format,
                    is_document_index: idx.isDocumentIndex,
                })),
            };
        }),
    };
}
