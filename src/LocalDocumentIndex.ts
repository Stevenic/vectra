import * as fs from "fs/promises";
import * as path from "path";
import { v4 } from "uuid";
import { GPT3Tokenizer } from "./GPT3Tokenizer";
import { CreateIndexConfig, LocalIndex } from "./LocalIndex";
import { TextSplitter, TextSplitterConfig } from "./TextSplitter";
import { MetadataFilter, EmbeddingsModel, Tokenizer, MetadataTypes, EmbeddingsResponse, QueryResult, DocumentChunkMetadata, DocumentCatalogStats } from "./types";
import { LocalDocumentResult } from "./LocalDocumentResult";
import { LocalDocument } from "./LocalDocument";

/**
 * Options for querying documents.
 * @public
 */
export interface DocumentQueryOptions {
    /**
     * Optional. Maximum number of documents to return.
     * @remarks
     * Default is 10.
     */
    maxDocuments?: number;
    
    /**
     * Maximum number of chunks to return per document.
     * @remarks
     * Default is 50.
     */
    maxChunks?: number;

    /**
     * Optional. Filter to apply to the document metadata.
     */
    filter?: MetadataFilter;

    /**
     * Optional. Turn on bm25 keyword search to perform hybrid search - semantic + keyword
     */
    isBm25?: boolean;

}

/**
 * Configuration for a local document index.
 * @public
 */
export interface LocalDocumentIndexConfig {
    /**
     * Folder path where the index is stored.
     */
    folderPath: string;

    /**
     * Optional. Embeddings model to use for generating document embeddings.
     */
    embeddings?: EmbeddingsModel;

    /**
     * Optional. Tokenizer to use for splitting text into tokens.
     */
    tokenizer?: Tokenizer;

    /**
     * Optional. Configuration settings for splitting text into chunks.
     */
    chunkingConfig?: Partial<TextSplitterConfig>;
}

/**
 * Represents a local index of documents stored on disk.
 * @public
 */
export class LocalDocumentIndex extends LocalIndex<DocumentChunkMetadata> {
    private readonly _embeddings?: EmbeddingsModel;
    private readonly _tokenizer: Tokenizer;
    private readonly _chunkingConfig?: TextSplitterConfig;
    private _catalog?: DocumentCatalog;
    private _newCatalog?: DocumentCatalog;

    /**
     * Creates a new instance of LocalDocumentIndex.
     * @param config - Configuration settings for the document index.
     */
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
     * Gets the embeddings model.
     * @returns The embeddings model
     * @public
     */
    public get embeddings(): EmbeddingsModel | undefined {
        return this._embeddings;
    }

    /**
     * Gets the tokenizer.
     * @returns The tokenizer
     * @public
     */
    public get tokenizer(): Tokenizer {
        return this._tokenizer;
    }

    /**
     * Checks if the document catalog exists.
     * @returns True if the catalog exists, false otherwise
     * @public
     */
    public async isCatalogCreated(): Promise<boolean> {
        try {
            await fs.access(path.join(this.folderPath, "catalog.json"));
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Gets the document ID for a URI.
     * @param uri - The URI to get the document ID for
     * @returns The document ID, or undefined if not found
     * @public
     */
    public async getDocumentId(uri: string): Promise<string | undefined> {
        await this.loadIndexData();
        return this._catalog?.uriToId[uri];
    }

    /**
     * Gets the document URI for a document ID.
     * @param documentId - The document ID to get the URI for
     * @returns The document URI, or undefined if not found
     * @public
     */
    public async getDocumentUri(documentId: string): Promise<string | undefined> {
        await this.loadIndexData();
        return this._catalog?.idToUri[documentId];
    }

    /**
     * Gets the catalog statistics.
     * @returns The catalog statistics
     * @public
     */
    public async getCatalogStats(): Promise<DocumentCatalogStats> {
        const stats = await this.getIndexStats();
        return {
            version: this._catalog!.version,
            documents: this._catalog!.count,
            chunks: stats.items,
            metadata_config: stats.metadata_config
        };
    }

    /**
     * Deletes a document from the index.
     * @param uri - URI of the document to delete.
     */
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
            const chunks = await this.listItemsByMetadata({ documentId });

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
            throw new Error(`Error deleting document "${uri}": ${err instanceof Error ? err.message : String(err)}`);
        }

        // Delete text file from disk
        try {
            await fs.unlink(path.join(this.folderPath, `${documentId}.txt`));
        } catch (err: unknown) {
            throw new Error(`Error removing text file for document "${uri}" from disk: ${err instanceof Error ? err.message : String(err)}`);
        }

        // Delete metadata file from disk
        try {
            await fs.unlink(path.join(this.folderPath, `${documentId}.json`));
        } catch {
            // Ignore error
        }
    }

    /**
     * Upserts a document into the index.
     * @param uri - URI of the document
     * @param text - Text of the document
     * @param docType - Optional. Type of the document
     * @param metadata - Optional. Metadata for the document
     * @returns The upserted document
     * @public
     */
    public async upsertDocument(uri: string, text: string, docType?: string, metadata?: Record<string, MetadataTypes>): Promise<LocalDocument> {
        // Ensure embeddings configured
        if (!this._embeddings) {
            throw new Error("Embeddings model not configured.");
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
            const pos = uri.lastIndexOf(".");
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
            currentBatch.push(chunk.text.replace(/\n/g, " "));
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
                throw new Error(`Error generating embeddings: ${err instanceof Error ? err.message : String(err)}`);
            }

            // Check for error
            if (response.status != "success") {
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
            throw new Error(`Error adding document "${uri}": ${err instanceof Error ? err.message : String(err)}`);
        }

        // Return document
        return new LocalDocument(this, documentId, uri);
    }
    
    /**
     * Lists all documents in the index.
     * @returns Array of document results
     * @public
     */
    public async listDocuments(): Promise<LocalDocumentResult[]> {
        // Sort chunks by document ID
        const docs: { [documentId: string]: QueryResult<DocumentChunkMetadata>[]; } = {};
        const chunks = await this.listItems();
        chunks.forEach(chunk => {
            const metadata = chunk.metadata;
            if (docs[metadata.documentId] == undefined) {
                docs[metadata.documentId] = [];
            }
            docs[metadata.documentId].push({ item: chunk, score: 1.0 });
        });

        // Create document results
        const results: LocalDocumentResult[] = [];
        for (const documentId in docs) {
            const uri = await this.getDocumentUri(documentId) as string;
            const documentResult = new LocalDocumentResult(this, documentId, uri, docs[documentId], this._tokenizer);
            results.push(documentResult);
        }

        return results;
    }

    /**
     * Queries the index for documents similar to the given query.
     * @param query - Text to query for
     * @param options - Optional. Query options
     * @returns Array of document results
     * @public
     */
    public async queryDocuments(query: string, options?: DocumentQueryOptions): Promise<LocalDocumentResult[]> {
        // Ensure embeddings configured
        if (!this._embeddings) {
            throw new Error("Embeddings model not configured.");
        }

        // Get query options
        const maxDocuments = options?.maxDocuments ?? 10;
        const maxChunks = options?.maxChunks ?? 50;
        const filter = options?.filter;
        const isBm25 = options?.isBm25 ?? false;

        // Create query embedding
        const response = await this._embeddings.createEmbeddings(query);
        if (response.status !== "success") {
            throw new Error(`Error creating query embedding: ${response.message}`);
        }

        // Query index
        const queryVector = response.output![0];
        const chunks = await this.queryItems<DocumentChunkMetadata>(queryVector, query, maxChunks, filter, isBm25);

        // Group chunks by document
        const documents = new Map<string, { uri: string; chunks: QueryResult<DocumentChunkMetadata>[]; score: number }>();
        for (const chunk of chunks) {
            const documentId = chunk.item.metadata.documentId;
            const uri = await this.getDocumentUri(documentId);
            if (uri) {
                let document = documents.get(documentId);
                if (!document) {
                    document = { uri, chunks: [], score: 0 };
                    documents.set(documentId, document);
                }
                document.chunks.push(chunk);
                document.score = Math.max(document.score, chunk.score);
            }
        }

        // Sort documents by score and return results
        return Array.from(documents.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, maxDocuments)
            .map(doc => new LocalDocumentResult(this, doc.uri, doc.uri, doc.chunks, this._tokenizer));
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

    public async createIndex(config?: CreateIndexConfig): Promise<void> {
        await super.createIndex(config);
        await this.loadIndexData();
    }

    public async endUpdate(): Promise<void> {
        await super.endUpdate();

        try {
            // Save catalog
            await fs.writeFile(path.join(this.folderPath, "catalog.json"), JSON.stringify(this._newCatalog));
            this._catalog = this._newCatalog;
            this._newCatalog = undefined;
        } catch (err: unknown) {
            throw new Error(`Error saving document catalog: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    protected async loadIndexData(): Promise<void> {
        await super.loadIndexData();

        if (this._catalog) {
            return;
        }

        const catalogPath = path.join(this.folderPath, "catalog.json");
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
            } catch (err: unknown) {
                throw new Error(`Error creating document catalog: ${err instanceof Error ? err.message : String(err)}`);
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
