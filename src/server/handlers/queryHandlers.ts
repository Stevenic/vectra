import * as grpc from '@grpc/grpc-js';
import { LocalIndex } from '../../LocalIndex';
import { IndexManager } from '../IndexManager';
import { EmbeddingsModel, QueryResult } from '../../types';
import { wrapHandler, grpcError, toProtoMetadata, parseFilterJson } from './helpers';

export function createQueryHandlers(manager: IndexManager, embeddings?: EmbeddingsModel) {
    return {
        QueryItems: wrapHandler(async (call: grpc.ServerUnaryCall<any, any>) => {
            const req = call.request;
            if (!req.index_name) {
                throw grpcError(grpc.status.INVALID_ARGUMENT, 'index_name is required');
            }
            const idx = manager.requireIndex(req.index_name).index as LocalIndex;
            const topK = req.top_k || 10;
            const filter = parseFilterJson(req.filter);

            let vector: number[];
            if (req.vector && req.vector.length > 0) {
                vector = req.vector;
            } else if (req.text && req.text.length > 0) {
                if (!embeddings) {
                    throw grpcError(grpc.status.FAILED_PRECONDITION, 'No embeddings model configured on the server');
                }
                const response = await embeddings.createEmbeddings(req.text);
                if (response.status !== 'success' || !response.output) {
                    throw grpcError(grpc.status.INTERNAL, `Embeddings error: ${response.message || 'unknown'}`);
                }
                vector = response.output[0];
            } else {
                throw grpcError(grpc.status.INVALID_ARGUMENT, 'Either text or vector must be provided');
            }

            const results = await idx.queryItems(vector, req.text || '', topK, filter);
            return {
                results: results.map((r: QueryResult) => ({
                    id: r.item.id,
                    metadata: toProtoMetadata(r.item.metadata as Record<string, any>),
                    vector: Array.from(r.item.vector),
                    norm: r.item.norm,
                    score: r.score,
                })),
            };
        }),

        QueryDocuments: wrapHandler(async (call: grpc.ServerUnaryCall<any, any>) => {
            const req = call.request;
            if (!req.index_name) {
                throw grpcError(grpc.status.INVALID_ARGUMENT, 'index_name is required');
            }
            const { docIndex } = manager.requireDocumentIndex(req.index_name);
            if (!req.query) {
                throw grpcError(grpc.status.INVALID_ARGUMENT, 'query is required');
            }

            const filter = parseFilterJson(req.filter);
            const results = await docIndex.queryDocuments(req.query, {
                maxDocuments: req.max_documents || 10,
                maxChunks: req.max_chunks || 50,
                filter,
                isBm25: req.use_bm25 || false,
            });

            const protoResults = [];
            for (const result of results) {
                const chunks = [];
                for (const chunk of result.chunks) {
                    const text = await (async () => {
                        try {
                            const doc = result;
                            const startPos = (chunk.item.metadata as any).startPos || 0;
                            const endPos = (chunk.item.metadata as any).endPos || 0;
                            const fullText = await doc.loadText();
                            return fullText.substring(startPos, endPos + 1);
                        } catch {
                            return '';
                        }
                    })();
                    chunks.push({
                        text,
                        score: chunk.score,
                        token_count: 0,
                    });
                }
                protoResults.push({
                    uri: result.uri,
                    document_id: result.id,
                    chunks,
                    score: result.score,
                });
            }

            return { results: protoResults };
        }),
    };
}
