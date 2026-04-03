import * as path from 'path';
import * as fs from 'fs';
import { LocalIndex, CreateIndexConfig } from '../LocalIndex';
import { LocalDocumentIndex, LocalDocumentIndexConfig } from '../LocalDocumentIndex';
import { LocalFileStorage } from '../storage/LocalFileStorage';
import { FileStorage } from '../storage';
import { EmbeddingsModel, MetadataTypes } from '../types';
import { detectCodec, IndexCodec, JsonCodec, ProtobufCodec } from '../codecs';

export interface ManagedIndex {
    name: string;
    index: LocalIndex | LocalDocumentIndex;
    isDocumentIndex: boolean;
    format: string;
}

export interface IndexManagerConfig {
    /** Single index path (mutually exclusive with rootDir). */
    indexPath?: string;
    /** Root directory containing multiple index subdirectories. */
    rootDir?: string;
    /** Embeddings model for server-side embedding computation. */
    embeddings?: EmbeddingsModel;
    /** Polling interval in ms for auto-detecting new indexes (default: 3000). */
    scanInterval?: number;
}

/**
 * Manages loaded indexes for the gRPC server.
 * Supports single-index and multi-index modes with auto-detection of new indexes.
 */
export class IndexManager {
    private readonly _config: IndexManagerConfig;
    private readonly _indexes: Map<string, ManagedIndex> = new Map();
    private _scanTimer?: ReturnType<typeof setInterval>;
    private _singleMode: boolean;

    constructor(config: IndexManagerConfig) {
        this._config = config;
        this._singleMode = !!config.indexPath;
    }

    /** Returns all currently loaded indexes. */
    public get indexes(): Map<string, ManagedIndex> {
        return this._indexes;
    }

    /** Returns true if running in single-index mode. */
    public get isSingleMode(): boolean {
        return this._singleMode;
    }

    /**
     * Initializes the index manager: loads existing indexes and starts auto-detection.
     */
    public async initialize(): Promise<void> {
        if (this._singleMode && this._config.indexPath) {
            await this.loadSingleIndex(this._config.indexPath);
        } else if (this._config.rootDir) {
            await this.scanRootDir();
            // Start periodic scanning for new indexes
            const interval = this._config.scanInterval ?? 3000;
            this._scanTimer = setInterval(() => {
                this.scanRootDir().catch(() => {/* ignore scan errors */});
            }, interval);
        }
    }

    /**
     * Shuts down the index manager: stops scanning and flushes all indexes.
     */
    public async shutdown(): Promise<void> {
        if (this._scanTimer) {
            clearInterval(this._scanTimer);
            this._scanTimer = undefined;
        }
        // No special flush needed — LocalIndex writes on endUpdate()
        this._indexes.clear();
    }

    /**
     * Gets a managed index by name.
     * In single-index mode, any name (or empty string) returns the single index.
     */
    public getIndex(name: string): ManagedIndex | undefined {
        if (this._singleMode) {
            // Return the single loaded index regardless of the name provided
            const entries = Array.from(this._indexes.values());
            return entries[0];
        }
        return this._indexes.get(name);
    }

    /**
     * Gets a managed index, throwing NOT_FOUND-appropriate error if missing.
     */
    public requireIndex(name: string): ManagedIndex {
        const managed = this.getIndex(name);
        if (!managed) {
            throw new Error(`Index not found: ${name}`);
        }
        return managed;
    }

    /**
     * Gets a managed document index, throwing if missing or not a document index.
     */
    public requireDocumentIndex(name: string): { managed: ManagedIndex; docIndex: LocalDocumentIndex } {
        const managed = this.requireIndex(name);
        if (!managed.isDocumentIndex) {
            throw new Error(`Index "${name}" is not a document index`);
        }
        return { managed, docIndex: managed.index as LocalDocumentIndex };
    }

    /**
     * Creates a new index on disk and loads it.
     */
    public async createIndex(
        name: string,
        format: string,
        isDocumentIndex: boolean,
        documentConfig?: { version?: number; chunkSize?: number; chunkOverlap?: number }
    ): Promise<ManagedIndex> {
        if (this._indexes.has(name)) {
            throw new Error(`Index already exists: ${name}`);
        }

        const rootDir = this._config.rootDir;
        if (!rootDir && !this._singleMode) {
            throw new Error('Cannot create index: no root directory configured');
        }

        const folderPath = rootDir ? path.join(rootDir, name) : name;
        const storage = new LocalFileStorage();
        const codec = format === 'protobuf' ? new ProtobufCodec() : new JsonCodec();

        let index: LocalIndex | LocalDocumentIndex;
        if (isDocumentIndex) {
            const config: LocalDocumentIndexConfig = {
                folderPath,
                storage,
                codec,
                embeddings: this._config.embeddings,
                chunkingConfig: {
                    chunkSize: documentConfig?.chunkSize || 512,
                    chunkOverlap: documentConfig?.chunkOverlap || 0,
                },
            };
            index = new LocalDocumentIndex(config);
        } else {
            index = new LocalIndex(folderPath, undefined, storage, codec);
        }

        const createConfig: CreateIndexConfig = {
            version: documentConfig?.version || 1,
            deleteIfExists: false,
        };
        await index.createIndex(createConfig);

        const managed: ManagedIndex = {
            name,
            index,
            isDocumentIndex,
            format: format || 'json',
        };
        this._indexes.set(name, managed);
        return managed;
    }

    /**
     * Deletes an index from disk and unloads it.
     */
    public async deleteIndex(name: string): Promise<void> {
        const managed = this.requireIndex(name);
        await managed.index.deleteIndex();
        this._indexes.delete(name);
    }

    /**
     * Lists all loaded indexes.
     */
    public listIndexes(): ManagedIndex[] {
        return Array.from(this._indexes.values());
    }

    private async loadSingleIndex(indexPath: string): Promise<void> {
        const name = path.basename(indexPath);
        await this.loadIndex(name, indexPath);
    }

    private async scanRootDir(): Promise<void> {
        const rootDir = this._config.rootDir!;
        if (!fs.existsSync(rootDir)) return;

        const entries = fs.readdirSync(rootDir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            if (entry.name.startsWith('.')) continue;
            if (this._indexes.has(entry.name)) continue;

            const folderPath = path.join(rootDir, entry.name);
            try {
                await this.loadIndex(entry.name, folderPath);
            } catch {
                // Skip directories that aren't valid indexes
            }
        }
    }

    private async loadIndex(name: string, folderPath: string): Promise<void> {
        const storage = new LocalFileStorage();

        // Detect codec — throws if no index file found
        const codec = await detectCodec(folderPath, storage);
        const format = codec.extension === '.pb' ? 'protobuf' : 'json';

        // Detect if it's a document index (has catalog file)
        const hasCatalogJson = await storage.pathExists(path.join(folderPath, 'catalog.json'));
        const hasCatalogPb = await storage.pathExists(path.join(folderPath, 'catalog.pb'));
        const isDocumentIndex = hasCatalogJson || hasCatalogPb;

        let index: LocalIndex | LocalDocumentIndex;
        if (isDocumentIndex) {
            index = new LocalDocumentIndex({
                folderPath,
                storage,
                codec,
                embeddings: this._config.embeddings,
            });
        } else {
            index = new LocalIndex(folderPath, undefined, storage, codec);
        }

        const managed: ManagedIndex = {
            name,
            index,
            isDocumentIndex,
            format,
        };
        this._indexes.set(name, managed);
    }
}
