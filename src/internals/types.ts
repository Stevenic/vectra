/**
 * @private
 */
export interface CreateEmbeddingRequest {
    input: CreateEmbeddingRequestInput;
    user?: string;
}

/**
 * @private
 */
export interface OpenAICreateEmbeddingRequest extends CreateEmbeddingRequest {
    model: string;
}

/**
 * @private
 */
export interface CreateEmbeddingResponse {
    object: string;
    model: string;
    data: Array<CreateEmbeddingResponseDataInner>;
    usage: CreateEmbeddingResponseUsage;
}

/**
 * @private
 */
export interface CreateEmbeddingResponseDataInner {
    index: number;
    object: string;
    embedding: Array<number>;
}

/**
 * @private
 */
export interface CreateEmbeddingResponseUsage {
    prompt_tokens: number;
    total_tokens: number;
}

/**
 * @private
 */
export type CreateEmbeddingRequestInput = Array<any> | Array<number> | Array<string> | string;
