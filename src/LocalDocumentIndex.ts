import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 } from 'uuid';
import { GPT3Tokenizer } from "./GPT3Tokenizer";
import { CreateIndexConfig, LocalIndex } from "./LocalIndex";
import { TextSplitter, TextSplitterConfig } from "./TextSplitter";
import { MetadataFilter, EmbeddingsModel, Tokenizer, MetadataTypes, EmbeddingsResponse, QueryResult, DocumentChunkMetadata, DocumentCatalogStats } from "./types";
import { LocalDocumentResult } from './LocalDocumentResult';
import { LocalDocument } from './LocalDocument';

export interface DocumentQueryOptions {
    maxDocuments?: number;
    maxChunks?: number;
    filter?: MetadataFilter;
}

export interface LocalDocumentIndexConfig {
    folderPath: string;
    embeddings?: EmbeddingsModel;
    tokenizer?: Tokenizer;
    chunkingConfig?: Partial<TextSplitterConfig>;
}

export class LocalDocumentIndex extends LocalIndex {
    private readonly _embeddings?: EmbeddingsModel;
    private readonly _tokenizer: Tokenizer;
    private readonly _chunkingConfig?: TextSplitterConfig;
    private _catalog?: DocumentCatalog;
    private _newCatalog?: DocumentCatalog;


    public constructor(config: LocalDocumentIndexConfig) {
        super(config.folderPath);
        this._embeddings = config.embeddings;
        this._chunkingConfig = Object.assign({
            keepSeparators: true,
            chunkSize: 512,
            chunkOverlap: 0,
        } as TextSplitterConfig, config.chunkingConfig);
        this._tokenizer = config.tokenizer ?? this._chunkingConfig.tokenizer ?? new GPT3Tokenizer();
        this._chunkingConfig.tokenizer = this._tokenizer;
    }

    /**
     * Returns true if the document catalog exists.
     */
    public async isCatalogCreated(): Promise<boolean> {
        try {
            await fs.access(path.join(this.folderPath, 'catalog.json'));
            return true;
        } catch (err: unknown) {
            return false;
        }
    }

    public async getDocumentId(uri: string): Promise<string | undefined> {
        await this.loadIndexData();
        return this._catalog?.uriToId[uri];
    }

    public async getDocumentUri(documentId: string): Promise<string | undefined> {
        await this.loadIndexData();
        return this._catalog?.idToUri[documentId];
    }

    public async createIndex(config?: CreateIndexConfig): Promise<void> {
        await super.createIndex(config);
        await this.loadIndexData();
    }

    public async deleteDocument(uri: string): Promise<void> {
        // Lookup document ID
        const documentId = await this.getDocumentId(uri);
        if (documentId == undefined) {
            return;
        }

        // Delete document chunks from index and remove from catalog
        await this.beginUpdate();
        try {
            // Get list of chunks for document
            const chunks = await this.listItemsByMetadata<DocumentChunkMetadata>({ documentId });

            // Delete chunks
            for (const chunk of chunks) {
                await this.deleteItem(chunk.id);
            }

            // Remove entry from catalog
            delete this._newCatalog!.uriToId[uri];
            delete this._newCatalog!.idToUri[documentId];
            this._newCatalog!.count--;

            // Commit changes
            await this.endUpdate();
        } catch (err: unknown) {
            // Cancel update and raise error
            this.cancelUpdate();
            throw new Error(`Error deleting document "${uri}": ${(err as any).toString()}`);
        }

        // Delete text file from disk
        try {
            await fs.unlink(path.join(this.folderPath, `${documentId}.txt`));
        } catch (err: unknown) {
            throw new Error(`Error removing text file for document "${uri}" from disk: ${(err as any).toString()}`);
        }

        // Delete metadata file from disk
        try {
            await fs.unlink(path.join(this.folderPath, `${documentId}.json`));
        } catch (err: unknown) {
            // Ignore error
        }
    }

    public async getCatalogStats(): Promise<DocumentCatalogStats> {
        const stats = await this.getIndexStats()
        return {
            version: this._catalog!.version,
            documents: this._catalog!.count,
            chunks: stats.items,
            metadata_config: stats.metadata_config
        };
    }

    /**
     * Adds a document to the catalog.
     * @remarks
     * A new update is started if one is not already in progress. If an document with the same uri
     * already exists, it will be replaced.
     * @param uri - Document URI
     * @param text - Document text
     * @param docType - Optional. Document type
     * @param metadata - Optional. Document metadata to index
     * @returns Inserted document
     */
    public async upsertDocument(uri: string, text: string, docType?: string, metadata?: Record<string, MetadataTypes>): Promise<LocalDocument> {
        // Ensure embeddings configured
        if (!this._embeddings) {
            throw new Error(`Embeddings model not configured.`);
        }

        // Check for existing document ID
        let documentId = await this.getDocumentId(uri);
        if (documentId != undefined) {
            // Delete existing document
            await this.deleteDocument(uri);
        } else {
            // Generate new document ID
            documentId = v4();
        }

        // Initialize text splitter settings
        const config = Object.assign({ docType }, this._chunkingConfig);
        if (config.docType == undefined) {
            // Populate docType based on extension
            const pos = uri.lastIndexOf('.');
            if (pos >= 0) {
                const ext = uri.substring(pos + 1).toLowerCase();
                config.docType = ext;
            }
        }

        // Split text into chunks
        const splitter = new TextSplitter(config);
        const chunks = splitter.split(text);

        // Break chunks into batches for embedding generation
        let totalTokens = 0;
        const chunkBatches: string[][] = [];
        let currentBatch: string[] = [];
        for (const chunk of chunks) {
            totalTokens += chunk.tokens.length;
            if (totalTokens > this._embeddings.maxTokens) {
                chunkBatches.push(currentBatch);
                currentBatch = [];
                totalTokens = chunk.tokens.length;
            }
            currentBatch.push(chunk.text.replace(/\n/g, ' '));
        }
        if (currentBatch.length > 0) {
            chunkBatches.push(currentBatch);
        }

        // Generate embeddings for chunks
        const embeddings: number[][] = [];
        for (const batch of chunkBatches) {
            let response: EmbeddingsResponse;
            try {
                response = await this._embeddings.createEmbeddings(batch);
            } catch (err: unknown) {
                throw new Error(`Error generating embeddings: ${(err as any).toString()}`);
            }

            // Check for error
            if (response.status != 'success') {
                throw new Error(`Error generating embeddings: ${response.message}`);
            }

            // Add embeddings to output
            for (const embedding of response.output!) {
                embeddings.push(embedding);
            }
        }

        // Add document chunks to index
        await this.beginUpdate();
        try {
            // Add chunks to index
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const embedding = embeddings[i];
                const chunkMetadata: DocumentChunkMetadata = Object.assign({
                    documentId,
                    startPos: chunk.startPos,
                    endPos: chunk.endPos,
                }, metadata);
                await this.insertItem({
                    id: v4(),
                    metadata: chunkMetadata,
                    vector: embedding,
                });
            }

            // Save metadata file to disk
            if (metadata != undefined) {
                await fs.writeFile(path.join(this.folderPath, `${documentId}.json`), JSON.stringify(metadata));
            }

            // Save text file to disk
            await fs.writeFile(path.join(this.folderPath, `${documentId}.txt`), text);

            // Add entry to catalog
            this._newCatalog!.uriToId[uri] = documentId;
            this._newCatalog!.idToUri[documentId] = uri;
            this._newCatalog!.count++;

            // Commit changes
            await this.endUpdate();
        } catch (err: unknown) {
            // Cancel update and raise error
            this.cancelUpdate();
            throw new Error(`Error adding document "${uri}": ${(err as any).toString()}`);
        }

        // Return document
        return new LocalDocument(this.folderPath, documentId, uri);
    }


    public async queryDocuments(query: string, options?: DocumentQueryOptions): Promise<LocalDocumentResult[]> {
        // Ensure embeddings configured
        if (!this._embeddings) {
            throw new Error(`Embeddings model not configured.`);
        }

        // Ensure options are defined
        options = Object.assign({
            maxDocuments: 10,
            maxChunks: 50,
        }, options);

        // Generate embeddings for query
        let embeddings: EmbeddingsResponse;
        try {
            embeddings = await this._embeddings.createEmbeddings(query.replace(/\n/g, ' '));
        } catch (err: unknown) {
            throw new Error(`Error generating embeddings for query: ${(err as any).toString()}`);
        }

        // Check for error
        if (embeddings.status != 'success') {
            throw new Error(`Error generating embeddings for query: ${embeddings.message}`);
        }

        // Query index for chunks
        const results = await this.queryItems<DocumentChunkMetadata>(embeddings.output![0], options.maxChunks!, options.filter);

        // Group chunks by document
        const documentChunks: { [documentId: string]: QueryResult<DocumentChunkMetadata>[]; } = {};
        for (const result  of results) {
            const metadata = result.item.metadata;
            if (documentChunks[metadata.documentId] == undefined) {
                documentChunks[metadata.documentId] = [];
            }
            documentChunks[metadata.documentId].push(result);
        }

        // Create a document result for each document
        const documentResults: LocalDocumentResult[] = [];
        for (const documentId in documentChunks) {
            const chunks = documentChunks[documentId];
            const uri = await this.getDocumentUri(documentId) as string;
            const documentResult = new LocalDocumentResult(this.folderPath, documentId, uri, chunks, this._tokenizer);
            documentResults.push(documentResult);
        }

        // Sort document results by score and return top results
        return documentResults.sort((a, b) => b.score - a.score).slice(0, options.maxDocuments!);
    }

    // Overrides

    public async beginUpdate(): Promise<void> {
        await super.beginUpdate();
        this._newCatalog = Object.assign({}, this._catalog);
    }

    public cancelUpdate(): void {
        super.cancelUpdate();
        this._newCatalog = undefined;
    }

    public async endUpdate(): Promise<void> {
        await super.endUpdate();

        try {
            // Save catalog
            await fs.writeFile(path.join(this.folderPath, 'catalog.json'), JSON.stringify(this._newCatalog));
            this._catalog = this._newCatalog;
            this._newCatalog = undefined;
        } catch(err: unknown) {
            throw new Error(`Error saving document catalog: ${(err as any).toString()}`);
        }
    }

    protected async loadIndexData(): Promise<void> {
        await super.loadIndexData();

        if (this._catalog) {
            return;
        }

        const catalogPath = path.join(this.folderPath, 'catalog.json');
        if (await this.isCatalogCreated()) {
            // Load catalog
            const buffer = await fs.readFile(catalogPath);
            this._catalog = JSON.parse(buffer.toString());
        } else {
            try {
                // Initialize catalog
                this._catalog = {
                    version: 1,
                    count: 0,
                    uriToId: {},
                    idToUri: {},
                };
                await fs.writeFile(catalogPath, JSON.stringify(this._catalog));
            } catch(err: unknown) {
                throw new Error(`Error creating document catalog: ${(err as any).toString()}`);
            }
        }
    }
}

interface DocumentCatalog {
    version: number;
    count: number;
    uriToId: { [uri: string]: string; };
    idToUri: { [id: string]: string; };
}
