// This file intentionally left empty as all types have been moved to the public API.

/**
 * @internal
 */
export interface CreateEmbeddingRequest {
    input: CreateEmbeddingRequestInput;
    dimensions?: number;
    user?: string;
}

/**
 * @internal
 */
export interface OpenAICreateEmbeddingRequest extends CreateEmbeddingRequest {
    model: string;
}

/**
 * @internal
 */
export interface CreateEmbeddingResponse {
    object: string;
    model: string;
    data: Array<CreateEmbeddingResponseDataInner>;
    usage: CreateEmbeddingResponseUsage;
}

/**
 * @internal
 */
export interface CreateEmbeddingResponseDataInner {
    index: number;
    object: string;
    embedding: Array<number>;
}

/**
 * @internal
 */
export interface CreateEmbeddingResponseUsage {
    prompt_tokens: number;
    total_tokens: number;
}

/**
 * @internal
 */
export type CreateEmbeddingRequestInput = Array<string | number | boolean | null | object> | Array<number> | Array<string> | string;
