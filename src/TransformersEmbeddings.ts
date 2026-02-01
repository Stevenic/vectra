import { EmbeddingsModel, EmbeddingsResponse } from "./types";
import { TransformersTokenizer } from "./TransformersTokenizer";
import { FeatureExtractionPipeline, PreTrainedTokenizer } from "@huggingface/transformers";


const DEFAULT_MODEL = 'Xenova/all-MiniLM-L6-v2';

/**
 * Type definition for the Transformers.js library.
 * Used for dynamic import and type safety.
 */
type TransformersLibrary = typeof import('@huggingface/transformers');

/**
 * Configuration options for TransformersEmbeddings.
 */
export interface TransformersEmbeddingsOptions {
    /**
     * Optional. Model name/path to use for embeddings.
     * @remarks
     * Common models:
     * - 'Xenova/all-MiniLM-L6-v2' (384 dimensions, fast, good quality)
     * - 'Xenova/bge-small-en-v1.5' (384 dimensions, better quality)
     * - 'Xenova/bge-base-en-v1.5' (768 dimensions, best quality)
     * @default 'Xenova/all-MiniLM-L6-v2'
     */
    model?: string;

    /**
     * Optional. Maximum number of tokens that can be sent to the embedding model.
     * @remarks
     * This affects batching behavior in LocalDocumentIndex.
     * Most small models support 512 tokens.
     * @default 512
     */
    maxTokens?: number;

    /**
     * Optional. Device to run inference on.
     * @remarks
     * - 'auto': Automatically select the best available device
     * - 'gpu': Use GPU (WebGPU in browser, CUDA in Node.js if available)
     * - 'cpu': Use CPU (most compatible)
     * - 'wasm': Use WebAssembly
     * @default 'auto'
     */
    device?: 'auto' | 'gpu' | 'cpu' | 'wasm';

    /**
     * Optional. Data type for model weights.
     * @remarks
     * - 'fp32': Full precision (best quality, largest size)
     * - 'fp16': Half precision (good quality, smaller)
     * - 'q8': 8-bit quantization (good quality, smaller)
     * - 'q4': 4-bit quantization (fastest, smallest, lower quality)
     * @default 'fp32'
     */
    dtype?: 'fp32' | 'fp16' | 'q8' | 'q4';

    /**
     * Optional. Whether to normalize embeddings to unit length.
     * @default true
     */
    normalize?: boolean;

    /**
     * Optional. Pooling strategy for token embeddings.
     * @remarks
     * - 'mean': Mean pooling (default, recommended)
     * - 'cls': Use [CLS] token embedding
     * @default 'mean'
     */
    pooling?: 'mean' | 'cls';

    /**
     * Optional. Callback for tracking model download/load progress.
     */
    progressCallback?: (progress: { status: string; progress?: number; file?: string }) => void;
}

/**
 * An embeddings model using Transformers.js for local, offline inference.
 * @remarks
 * Requires @huggingface/transformers as a peer dependency.
 * Use the static `create()` method to instantiate.
 *
 * @example
 * ```typescript
 * const embeddings = await TransformersEmbeddings.create({
 *     model: 'Xenova/all-MiniLM-L6-v2'
 * });
 *
 * const index = new LocalDocumentIndex({
 *     folderPath: 'my-index',
 *     embeddings: embeddings,
 *     tokenizer: embeddings.getTokenizer()
 * });
 * ```
 */
export class TransformersEmbeddings implements EmbeddingsModel {
    private readonly _extractor: FeatureExtractionPipeline;
    private readonly _tokenizer: PreTrainedTokenizer;
    private readonly _options: Required<Omit<TransformersEmbeddingsOptions, 'progressCallback'>> & Pick<TransformersEmbeddingsOptions, 'progressCallback'>;

    public readonly maxTokens: number;

    /**
     * Private constructor - use TransformersEmbeddings.create() instead.
     */
    private constructor(
        extractor: FeatureExtractionPipeline,
        tokenizer: PreTrainedTokenizer,
        options: Required<Omit<TransformersEmbeddingsOptions, 'progressCallback'>> & Pick<TransformersEmbeddingsOptions, 'progressCallback'>
    ) {
        this._extractor = extractor;
        this._tokenizer = tokenizer;
        this._options = options;
        this.maxTokens = options.maxTokens;
    }

    /**
     * Creates a new TransformersEmbeddings instance.
     * @param options Configuration options.
     * @returns Promise resolving to initialized TransformersEmbeddings instance.
     * @throws Error if @huggingface/transformers is not installed.
     */
    public static async create(options?: TransformersEmbeddingsOptions): Promise<TransformersEmbeddings> {
        // Dynamically import to allow optional dependency
        let transformers: TransformersLibrary;

        try {
            transformers = await import('@huggingface/transformers');
        } catch (e) {
            throw new Error(
                'TransformersEmbeddings requires @huggingface/transformers. ' +
                'Install it with: npm install @huggingface/transformers'
            );
        }

        const { pipeline } = transformers;

        // Apply defaults
        const opts = {
            model: options?.model ?? DEFAULT_MODEL,
            maxTokens: options?.maxTokens ?? 512,
            device: options?.device ?? 'auto',
            dtype: options?.dtype ?? 'fp32',
            normalize: options?.normalize ?? true,
            pooling: options?.pooling ?? 'mean',
            progressCallback: options?.progressCallback
        };

        // Build pipeline options
        const pipelineOptions: any = {
            device: opts.device,
            dtype: opts.dtype
        };

        if (opts.progressCallback) {
            pipelineOptions.progress_callback = opts.progressCallback;
        }

        // Load the feature extraction pipeline
        const extractor = await pipeline(
            'feature-extraction',
            opts.model,
            pipelineOptions
        );

        // Load the tokenizer separately for use with TextSplitter
        const tokenizer = extractor.tokenizer;

        return new TransformersEmbeddings(extractor, tokenizer, opts);
    }

    /**
     * Returns a tokenizer that uses the same tokenization as this embedding model.
     * @remarks
     * Use this tokenizer with LocalDocumentIndex to ensure text chunking
     * aligns with the embedding model's token boundaries.
     * @returns TransformersTokenizer instance.
     */
    public getTokenizer(): TransformersTokenizer {
        return new TransformersTokenizer(this._tokenizer);
    }

    /**
     * Creates embeddings for the given inputs.
     * @param inputs Text inputs to create embeddings for.
     * @returns EmbeddingsResponse with status and generated embeddings.
     */
    public async createEmbeddings(inputs: string | string[]): Promise<EmbeddingsResponse> {
        try {
            const inputArray = Array.isArray(inputs) ? inputs : [inputs];

            // Process all inputs in a single batch
            const output = await this._extractor(inputArray, {
                pooling: this._options.pooling,
                normalize: this._options.normalize
            });

            const [batchSize, embeddingDim] = output.dims;
            const data = output.data as Float32Array;

            // Slice the flat array into individual embeddings
            const embeddings: number[][] = [];
            for (let i = 0; i < batchSize; i++) {
                const start = i * embeddingDim;
                const end = start + embeddingDim;
                embeddings.push(Array.from(data.slice(start, end)));
            }

            return {
                status: 'success',
                output: embeddings,
                model: this._options.model
            };
        } catch (error: unknown) {
            return {
                status: 'error',
                message: `Error generating embeddings: ${(error as Error).message}`
            };
        }
    }

    /**
     * Returns the model name being used.
     */
    public get model(): string {
        return this._options.model;
    }
}
