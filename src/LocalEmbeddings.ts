import { EmbeddingsModel, EmbeddingsResponse } from "./types";

/**
 * Options for configuring a `LocalEmbeddings` instance.
 */
export interface LocalEmbeddingsOptions {
    /**
     * Optional. Model name to use for embeddings.
     * @remarks
     * Defaults to `Xenova/all-MiniLM-L6-v2`. Any model compatible with the
     * `feature-extraction` pipeline from `@huggingface/transformers` can be used.
     */
    model?: string;

    /**
     * Optional. Maximum number of tokens the model supports.
     * @remarks
     * Defaults to 256 for the default model. Adjust when using a model with a
     * different context window.
     */
    maxTokens?: number;
}

/**
 * An `EmbeddingsModel` that runs locally using `@huggingface/transformers`.
 * @remarks
 * Requires the `@huggingface/transformers` package to be installed.
 * The pipeline is lazily initialized on the first call to `createEmbeddings()`.
 * Models are downloaded and cached locally on first use.
 */
export class LocalEmbeddings implements EmbeddingsModel {
    public readonly maxTokens: number;

    private readonly _modelName: string;
    private _pipeline: any = null;
    private _pipelinePromise: Promise<any> | null = null;

    /**
     * Creates a new `LocalEmbeddings` instance.
     * @param options Optional configuration.
     */
    public constructor(options?: LocalEmbeddingsOptions) {
        this._modelName = options?.model ?? 'Xenova/all-MiniLM-L6-v2';
        this.maxTokens = options?.maxTokens ?? 256;
    }

    /**
     * The model name used for embeddings.
     */
    public get model(): string {
        return this._modelName;
    }

    /**
     * Creates embeddings for the given inputs.
     * @param inputs Text inputs to create embeddings for.
     * @returns A `EmbeddingsResponse` with a status and the generated embeddings or a message when an error occurs.
     */
    public async createEmbeddings(inputs: string | string[]): Promise<EmbeddingsResponse> {
        try {
            const pipe = await this.getPipeline();
            const inputArray = Array.isArray(inputs) ? inputs : [inputs];
            const output: number[][] = [];

            for (const input of inputArray) {
                const result = await pipe(input, {
                    pooling: 'mean',
                    normalize: true,
                });
                output.push(Array.from(result.data as Float32Array));
            }

            return { status: 'success', output };
        } catch (err: unknown) {
            return {
                status: 'error',
                message: err instanceof Error ? err.message : String(err),
            };
        }
    }

    /**
     * @private
     * Lazily initializes and returns the transformer.js pipeline.
     * Uses a singleton promise to prevent duplicate initialization.
     */
    private async getPipeline(): Promise<any> {
        if (this._pipeline) {
            return this._pipeline;
        }

        if (!this._pipelinePromise) {
            this._pipelinePromise = this.initPipeline();
        }

        return this._pipelinePromise;
    }

    /**
     * @private
     */
    private async initPipeline(): Promise<any> {
        let transformers: any;
        try {
            transformers = require('@huggingface/transformers');
        } catch {
            throw new Error(
                'The @huggingface/transformers package is required for local embeddings. ' +
                'Install it with: npm install @huggingface/transformers'
            );
        }

        this._pipeline = await transformers.pipeline(
            'feature-extraction',
            this._modelName,
        );

        return this._pipeline;
    }
}
