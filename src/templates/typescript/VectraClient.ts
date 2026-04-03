/**
 * Vectra gRPC client — thin idiomatic wrapper over generated stubs.
 *
 * Usage:
 *   import { VectraClient } from './VectraClient';
 *
 *   const client = new VectraClient();
 *   const results = await client.queryDocuments('my-index', 'search query');
 *   client.close();
 *
 * Generate stubs first:
 *   npm install @grpc/grpc-js @grpc/proto-loader
 *   // Proto is loaded dynamically — no separate codegen step required.
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';

// Load proto definition dynamically
const PROTO_PATH = path.join(__dirname, 'vectra_service.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: false,
    longs: Number,
    enums: String,
    defaults: true,
    oneofs: true,
});
const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
const vectra = protoDescriptor.vectra;

// ── Types ────────────────────────────────────────────────

export interface MetadataValue {
    stringValue?: string;
    numberValue?: number;
    boolValue?: boolean;
}

export interface ItemResult {
    id: string;
    metadata: Record<string, string | number | boolean>;
    vector: number[];
    norm: number;
    score: number;
}

export interface DocumentResult {
    uri: string;
    documentId: string;
    score: number;
    chunks: Array<{ text: string; score: number; tokenCount: number }>;
}

export interface IndexInfo {
    name: string;
    format: string;
    isDocumentIndex: boolean;
}

export interface IndexStats {
    version: number;
    format: string;
    itemCount: number;
    metadataConfigCount: number;
}

export interface CatalogStats {
    version: number;
    documentCount: number;
    chunkCount: number;
    metadataCounts: Record<string, number>;
}

export interface HealthcheckResult {
    status: string;
    uptimeSeconds: number;
    loadedIndexes: string[];
}

export interface QueryDocumentsOptions {
    maxDocuments?: number;
    maxChunks?: number;
    filter?: Record<string, any>;
    useBm25?: boolean;
}

export interface QueryItemsOptions {
    text?: string;
    vector?: number[];
    topK?: number;
    filter?: Record<string, any>;
}

// ── Client ───────────────────────────────────────────────

export class VectraClient {
    private readonly _client: any;

    constructor(host: string = '127.0.0.1', port: number = 50051) {
        this._client = new vectra.VectraService(
            `${host}:${port}`,
            grpc.credentials.createInsecure()
        );
    }

    public close(): void {
        this._client.close();
    }

    // ── Index Management ─────────────────────────────────

    public createIndex(
        name: string,
        options?: {
            format?: string;
            isDocumentIndex?: boolean;
            chunkSize?: number;
            chunkOverlap?: number;
        }
    ): Promise<void> {
        const req: any = { indexName: name, format: options?.format ?? 'json' };
        if (options?.isDocumentIndex) {
            req.isDocumentIndex = true;
            req.documentConfig = {
                version: 1,
                chunkSize: options.chunkSize ?? 512,
                chunkOverlap: options.chunkOverlap ?? 0,
            };
        }
        return this._unary('createIndex', req);
    }

    public deleteIndex(name: string): Promise<void> {
        return this._unary('deleteIndex', { indexName: name });
    }

    public async listIndexes(): Promise<IndexInfo[]> {
        const resp = await this._unary('listIndexes', {});
        return (resp.indexes ?? []).map((idx: any) => ({
            name: idx.name,
            format: idx.format,
            isDocumentIndex: idx.isDocumentIndex,
        }));
    }

    // ── Item Operations ──────────────────────────────────

    public async insertItem(
        index: string,
        options: {
            text?: string;
            vector?: number[];
            metadata?: Record<string, string | number | boolean>;
            id?: string;
        }
    ): Promise<string> {
        const req: any = {
            indexName: index,
            text: options.text ?? '',
            id: options.id ?? '',
        };
        if (options.vector) req.vector = options.vector;
        if (options.metadata) req.metadata = toProtoMetadata(options.metadata);
        const resp = await this._unary('insertItem', req);
        return resp.id;
    }

    public async upsertItem(
        index: string,
        id: string,
        options: {
            text?: string;
            vector?: number[];
            metadata?: Record<string, string | number | boolean>;
        }
    ): Promise<string> {
        const req: any = {
            indexName: index,
            id,
            text: options.text ?? '',
        };
        if (options.vector) req.vector = options.vector;
        if (options.metadata) req.metadata = toProtoMetadata(options.metadata);
        const resp = await this._unary('upsertItem', req);
        return resp.id;
    }

    public async getItem(index: string, id: string): Promise<ItemResult | null> {
        const resp = await this._unary('getItem', { indexName: index, id });
        return resp.item ? itemToResult(resp.item) : null;
    }

    public deleteItem(index: string, id: string): Promise<void> {
        return this._unary('deleteItem', { indexName: index, id });
    }

    public async listItems(
        index: string,
        filter?: Record<string, any>
    ): Promise<ItemResult[]> {
        const req: any = { indexName: index };
        if (filter) req.filter = { filterJson: JSON.stringify(filter) };
        const resp = await this._unary('listItems', req);
        return (resp.items ?? []).map(itemToResult);
    }

    // ── Query ────────────────────────────────────────────

    public async queryItems(
        index: string,
        options: QueryItemsOptions
    ): Promise<ItemResult[]> {
        const req: any = {
            indexName: index,
            text: options.text ?? '',
            topK: options.topK ?? 10,
        };
        if (options.vector) req.vector = options.vector;
        if (options.filter) req.filter = { filterJson: JSON.stringify(options.filter) };
        const resp = await this._unary('queryItems', req);
        return (resp.results ?? []).map(itemToResult);
    }

    public async queryDocuments(
        index: string,
        query: string,
        options?: QueryDocumentsOptions
    ): Promise<DocumentResult[]> {
        const req: any = {
            indexName: index,
            query,
            maxDocuments: options?.maxDocuments ?? 10,
            maxChunks: options?.maxChunks ?? 50,
            useBm25: options?.useBm25 ?? false,
        };
        if (options?.filter) req.filter = { filterJson: JSON.stringify(options.filter) };
        const resp = await this._unary('queryDocuments', req);
        return (resp.results ?? []).map((doc: any) => ({
            uri: doc.uri,
            documentId: doc.documentId,
            score: doc.score,
            chunks: (doc.chunks ?? []).map((c: any) => ({
                text: c.text,
                score: c.score,
                tokenCount: c.tokenCount,
            })),
        }));
    }

    // ── Document Operations ──────────────────────────────

    public async upsertDocument(
        index: string,
        uri: string,
        text: string,
        options?: {
            docType?: string;
            metadata?: Record<string, string | number | boolean>;
        }
    ): Promise<string> {
        const req: any = {
            indexName: index,
            uri,
            text,
            docType: options?.docType ?? '',
        };
        if (options?.metadata) req.metadata = toProtoMetadata(options.metadata);
        const resp = await this._unary('upsertDocument', req);
        return resp.documentId;
    }

    public deleteDocument(index: string, uri: string): Promise<void> {
        return this._unary('deleteDocument', { indexName: index, uri });
    }

    public async listDocuments(
        index: string
    ): Promise<Array<{ uri: string; documentId: string }>> {
        const resp = await this._unary('listDocuments', { indexName: index });
        return (resp.documents ?? []).map((d: any) => ({
            uri: d.uri,
            documentId: d.documentId,
        }));
    }

    // ── Stats ────────────────────────────────────────────

    public async getIndexStats(index: string): Promise<IndexStats> {
        const resp = await this._unary('getIndexStats', { indexName: index });
        return {
            version: resp.version,
            format: resp.format,
            itemCount: resp.itemCount,
            metadataConfigCount: resp.metadataConfigCount,
        };
    }

    public async getCatalogStats(index: string): Promise<CatalogStats> {
        const resp = await this._unary('getCatalogStats', { indexName: index });
        return {
            version: resp.version,
            documentCount: resp.documentCount,
            chunkCount: resp.chunkCount,
            metadataCounts: resp.metadataCounts ?? {},
        };
    }

    // ── Lifecycle ────────────────────────────────────────

    public async healthcheck(): Promise<HealthcheckResult> {
        const resp = await this._unary('healthcheck', {});
        return {
            status: resp.status,
            uptimeSeconds: resp.uptimeSeconds,
            loadedIndexes: resp.loadedIndexes ?? [],
        };
    }

    public shutdown(): Promise<void> {
        return this._unary('shutdown', {});
    }

    // ── Internals ────────────────────────────────────────

    private _unary(method: string, request: any): Promise<any> {
        return new Promise((resolve, reject) => {
            this._client[method](request, (err: grpc.ServiceError | null, response: any) => {
                if (err) reject(err);
                else resolve(response);
            });
        });
    }
}

// ── Helpers ──────────────────────────────────────────────

function toProtoMetadata(
    metadata: Record<string, string | number | boolean>
): Record<string, MetadataValue> {
    const result: Record<string, MetadataValue> = {};
    for (const [key, value] of Object.entries(metadata)) {
        if (typeof value === 'boolean') {
            result[key] = { boolValue: value };
        } else if (typeof value === 'number') {
            result[key] = { numberValue: value };
        } else {
            result[key] = { stringValue: String(value) };
        }
    }
    return result;
}

function itemToResult(item: any): ItemResult {
    const metadata: Record<string, string | number | boolean> = {};
    if (item.metadata) {
        for (const [key, val] of Object.entries<any>(item.metadata)) {
            if (val.stringValue !== undefined && val.stringValue !== '') {
                metadata[key] = val.stringValue;
            } else if (val.numberValue !== undefined && val.numberValue !== 0) {
                metadata[key] = val.numberValue;
            } else if (val.boolValue !== undefined) {
                metadata[key] = val.boolValue;
            }
        }
    }
    return {
        id: item.id,
        metadata,
        vector: item.vector ?? [],
        norm: item.norm,
        score: item.score,
    };
}
