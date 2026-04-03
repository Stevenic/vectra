import * as grpc from '@grpc/grpc-js';
import { IndexManager } from '../IndexManager';
import { LocalDocumentIndex } from '../../LocalDocumentIndex';
import { wrapHandler, grpcError } from './helpers';

export function createStatsHandlers(manager: IndexManager) {
    return {
        GetIndexStats: wrapHandler(async (call: grpc.ServerUnaryCall<any, any>) => {
            const req = call.request;
            if (!req.index_name) {
                throw grpcError(grpc.status.INVALID_ARGUMENT, 'index_name is required');
            }
            const managed = manager.requireIndex(req.index_name);
            const stats = await managed.index.getIndexStats();
            return {
                version: stats.version,
                format: managed.format,
                item_count: stats.items,
                metadata_config_count: stats.metadata_config?.indexed?.length || 0,
            };
        }),

        GetCatalogStats: wrapHandler(async (call: grpc.ServerUnaryCall<any, any>) => {
            const req = call.request;
            if (!req.index_name) {
                throw grpcError(grpc.status.INVALID_ARGUMENT, 'index_name is required');
            }
            const { docIndex } = manager.requireDocumentIndex(req.index_name);
            const stats = await docIndex.getCatalogStats();
            return {
                version: stats.version,
                document_count: stats.documents,
                chunk_count: stats.chunks,
                metadata_counts: {},
            };
        }),
    };
}
