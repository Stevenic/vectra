/**
 * Interface for embeddings model.
 * @public
 */
export interface EmbeddingsModel {
    /**
     * Maximum number of tokens
     */
    readonly maxTokens: number;

    /**
     * Creates embeddings for text inputs.
     * @param inputs - Text inputs to create embeddings for.
     * @returns A `EmbeddingsResponse` with a status and the generated embeddings or a message when an error occurs.
     */
    createEmbeddings(inputs: string|string[]): Promise<EmbeddingsResponse>;
}

/**
 * Status of an embeddings response.
 * @public
 */
export type EmbeddingsResponseStatus = "success" | "error" | "rate_limited" | "cancelled";

/**
 * Response from an embeddings model.
 * @public
 */
export interface EmbeddingsResponse {
    /**
     * Status of the embeddings response.
     */
    status: EmbeddingsResponseStatus;

    /**
     * Optional. Embeddings for the given inputs.
     */
    output?: number[][];

    /**
     * Optional. Message when status is not equal to `success`.
     */
    message?: string;

    /**
     * Optional. Model used to create the embeddings.
     */
    model?: string;

    /**
     * Optional. Usage statistics for the request.
     */
    usage?: {
        prompt_tokens: number;
        total_tokens: number;
        [key: string]: number;
    };
}

/**
 * Represents a chunk of text.
 * @public
 */
export interface TextChunk {
    text: string;
    tokens: number[];
    startPos: number;
    endPos: number;
    startOverlap: number[];
    endOverlap: number[];
}

/**
 * Interface for text fetcher.
 * @public
 */
export interface TextFetcher {
    fetch(uri: string, onDocument: (uri: string, text: string, docType?: string) => Promise<boolean>): Promise<boolean>;
}

/**
 * Statistics for an index.
 * @public
 */
export interface IndexStats {
    version: number;
    metadata_config: {
        indexed?: string[];
    };
    items: number;
}

/**
 * Represents an item in the index.
 * @public
 */
export interface IndexItem<TMetadata = Record<string,MetadataTypes>> {
    id: string;
    metadata: TMetadata;
    vector: number[];
    norm: number;
    metadataFile?: string;
}

/**
 * Filter for metadata.
 * @public
 */
export interface MetadataFilter {

    /**
     * Equal to (number, string, boolean)
     */
    "$eq"?: number|string|boolean;

    /**
     * Not equal to (number, string, boolean)
     */
    "$ne"?: number|string|boolean;

    /**
     * Greater than (number)
     */
    "$gt"?: number;

    /**
     * Greater than or equal to (number)
     */
    "$gte"?: number;

    /**
     * Less than (number)
     */
    "$lt"?: number;

    /**
     * Less than or equal to (number)
     */
    "$lte"?: number;

    /**
     * In array (string or number)
     */
    "$in"?: (number|string)[];

    /**
     * Not in array (string or number)
     */
    "$nin"?: (number|string)[];

    /**
     * AND (MetadataFilter[])
     */
    "$and"?: MetadataFilter[];

    /**
     * OR (MetadataFilter[])
     */
    "$or"?: MetadataFilter[];

    [key: string]: unknown;
}

/**
 * Types of metadata values.
 * @public
 */
export type MetadataTypes = number|string|boolean;

/**
 * Result of a query.
 * @public
 */
export interface QueryResult<TMetadata = Record<string,MetadataTypes>> {
    item: IndexItem<TMetadata>;
    score: number;
}

/**
 * Interface for tokenizer.
 * @public
 */
export interface Tokenizer {
    decode(tokens: number[]): string;
    encode(text: string): number[];
}

/**
 * Metadata for a document chunk.
 * @public
 */
export interface DocumentChunkMetadata {
    documentId: string;
    startPos: number;
    endPos: number;
    [key: string]: MetadataTypes;
}

/**
 * Statistics for a document catalog.
 * @public
 */
export interface DocumentCatalogStats {
    version: number;
    documents: number;
    chunks: number;
    metadata_config: {
        indexed?: string[];
    };
}

/**
 * Represents a section of document text.
 * @public
 */
export interface DocumentTextSection {
    text: string;
    tokenCount: number;
    score: number;
    isBm25: boolean;
}

/**
 * Request input for creating embeddings.
 * @public
 */
export type CreateEmbeddingRequestInput = Array<string | number | boolean | null | object> | Array<number> | Array<string> | string;

/**
 * Request to create embeddings.
 * @public
 */
export interface CreateEmbeddingRequest {
    /**
     * Text inputs to create embeddings for.
     */
    input: CreateEmbeddingRequestInput;

    /**
     * Optional. Number of dimensions for the embeddings.
     */
    dimensions?: number;

    /**
     * Optional. User identifier for the request.
     */
    user?: string;
}

/**
 * OpenAI-specific embedding request.
 * @public
 */
export interface OpenAICreateEmbeddingRequest extends CreateEmbeddingRequest {
    /**
     * Model to use for creating embeddings.
     */
    model: string;
}

/**
 * Response data for a single embedding.
 * @public
 */
export interface CreateEmbeddingResponseDataInner {
    /**
     * Index of the embedding in the response.
     */
    index: number;

    /**
     * Type of the object.
     */
    object: string;

    /**
     * The embedding vector.
     */
    embedding: Array<number>;
}

/**
 * Usage statistics for embedding creation.
 * @public
 */
export interface CreateEmbeddingResponseUsage {
    /**
     * Number of tokens in the prompt.
     */
    prompt_tokens: number;

    /**
     * Total number of tokens used.
     */
    total_tokens: number;
}

/**
 * Response from creating embeddings.
 * @public
 */
export interface CreateEmbeddingResponse {
    /**
     * Type of the object.
     */
    object: string;

    /**
     * Model used to create the embeddings.
     */
    model: string;

    /**
     * Array of embeddings.
     */
    data: Array<CreateEmbeddingResponseDataInner>;

    /**
     * Usage statistics.
     */
    usage: CreateEmbeddingResponseUsage;
}