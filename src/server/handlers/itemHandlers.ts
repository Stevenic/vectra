import * as grpc from '@grpc/grpc-js';
import { v4 } from 'uuid';
import { LocalIndex } from '../../LocalIndex';
import { IndexManager } from '../IndexManager';
import { EmbeddingsModel, IndexItem } from '../../types';
import { wrapHandler, grpcError, fromProtoMetadata, toProtoMetadata, parseFilterJson } from './helpers';

async function resolveVector(
    text: string | undefined,
    vector: number[] | undefined,
    embeddings: EmbeddingsModel | undefined
): Promise<number[]> {
    if (vector && vector.length > 0) {
        return vector;
    }
    if (text && text.length > 0) {
        if (!embeddings) {
            throw grpcError(grpc.status.FAILED_PRECONDITION, 'No embeddings model configured on the server');
        }
        const response = await embeddings.createEmbeddings(text);
        if (response.status !== 'success' || !response.output) {
            throw grpcError(grpc.status.INTERNAL, `Embeddings error: ${response.message || 'unknown'}`);
        }
        return response.output[0];
    }
    throw grpcError(grpc.status.INVALID_ARGUMENT, 'Either text or vector must be provided');
}

function asLocalIndex(managed: { index: LocalIndex | any }): LocalIndex {
    return managed.index as LocalIndex;
}

function itemToProto(item: IndexItem) {
    return {
        id: item.id,
        metadata: toProtoMetadata(item.metadata as Record<string, any>),
        vector: Array.from(item.vector),
        norm: item.norm,
        score: 0,
    };
}

export function createItemHandlers(manager: IndexManager, embeddings?: EmbeddingsModel) {
    return {
        InsertItem: wrapHandler(async (call: grpc.ServerUnaryCall<any, any>) => {
            const req = call.request;
            if (!req.index_name) {
                throw grpcError(grpc.status.INVALID_ARGUMENT, 'index_name is required');
            }
            const idx = asLocalIndex(manager.requireIndex(req.index_name));
            const vector = await resolveVector(req.text, req.vector, embeddings);
            const metadata = fromProtoMetadata(req.metadata);
            const id = req.id || v4();

            const item = await idx.insertItem({ id, vector, metadata });
            return { id: item.id };
        }),

        UpsertItem: wrapHandler(async (call: grpc.ServerUnaryCall<any, any>) => {
            const req = call.request;
            if (!req.index_name) {
                throw grpcError(grpc.status.INVALID_ARGUMENT, 'index_name is required');
            }
            if (!req.id) {
                throw grpcError(grpc.status.INVALID_ARGUMENT, 'id is required for upsert');
            }
            const idx = asLocalIndex(manager.requireIndex(req.index_name));
            const vector = await resolveVector(req.text, req.vector, embeddings);
            const metadata = fromProtoMetadata(req.metadata);

            const item = await idx.upsertItem({ id: req.id, vector, metadata });
            return { id: item.id };
        }),

        BatchInsertItems: wrapHandler(async (call: grpc.ServerUnaryCall<any, any>) => {
            const req = call.request;
            if (!req.index_name) {
                throw grpcError(grpc.status.INVALID_ARGUMENT, 'index_name is required');
            }
            const idx = asLocalIndex(manager.requireIndex(req.index_name));
            const items = req.items || [];
            const toInsert: Array<Partial<IndexItem>> = [];

            for (const item of items) {
                const vector = await resolveVector(item.text, item.vector, embeddings);
                const metadata = fromProtoMetadata(item.metadata);
                toInsert.push({ id: item.id || v4(), vector, metadata });
            }

            const inserted = await idx.batchInsertItems(toInsert);
            return { ids: inserted.map((i: IndexItem) => i.id) };
        }),

        GetItem: wrapHandler(async (call: grpc.ServerUnaryCall<any, any>) => {
            const req = call.request;
            if (!req.index_name) {
                throw grpcError(grpc.status.INVALID_ARGUMENT, 'index_name is required');
            }
            if (!req.id) {
                throw grpcError(grpc.status.INVALID_ARGUMENT, 'id is required');
            }
            const idx = asLocalIndex(manager.requireIndex(req.index_name));
            const item = await idx.getItem(req.id);
            if (!item) {
                throw grpcError(grpc.status.NOT_FOUND, `Item not found: ${req.id}`);
            }
            return { item: itemToProto(item) };
        }),

        DeleteItem: wrapHandler(async (call: grpc.ServerUnaryCall<any, any>) => {
            const req = call.request;
            if (!req.index_name) {
                throw grpcError(grpc.status.INVALID_ARGUMENT, 'index_name is required');
            }
            if (!req.id) {
                throw grpcError(grpc.status.INVALID_ARGUMENT, 'id is required');
            }
            const idx = asLocalIndex(manager.requireIndex(req.index_name));
            await idx.deleteItem(req.id);
            return {};
        }),

        ListItems: wrapHandler(async (call: grpc.ServerUnaryCall<any, any>) => {
            const req = call.request;
            if (!req.index_name) {
                throw grpcError(grpc.status.INVALID_ARGUMENT, 'index_name is required');
            }
            const idx = asLocalIndex(manager.requireIndex(req.index_name));
            const filter = parseFilterJson(req.filter);

            const items = filter
                ? await idx.listItemsByMetadata(filter)
                : await idx.listItems();

            return {
                items: items.map((item: IndexItem) => itemToProto(item)),
            };
        }),
    };
}
