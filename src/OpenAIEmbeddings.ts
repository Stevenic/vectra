import type { AxiosResponse, AxiosRequestConfig } from "axios/index";
import axios from "axios";
import { EmbeddingsModel, EmbeddingsResponse, CreateEmbeddingRequest, CreateEmbeddingResponse, OpenAICreateEmbeddingRequest } from "./types";
import { Colorize } from "./internals";
import OpenAI from "openai";

/**
 * Base options for OpenAI embeddings.
 * @public
 */
export interface BaseOpenAIEmbeddingsOptions {
    /**
     * Optional. Number of embedding dimensions to return.
     */
    dimensions?: number;

    /**
     * Optional. Whether to log requests to the console.
     * @remarks
     * This is useful for debugging prompts and defaults to `false`.
     */
    logRequests?: boolean;

    /**
     * Optional. Maximum number of tokens that can be sent to the embedding model.
     */
    maxTokens?: number;

    /**
     * Optional. Retry policy to use when calling the OpenAI API.
     * @remarks
     * The default retry policy is `[2000, 5000]` which means that the first retry will be after
     * 2 seconds and the second retry will be after 5 seconds.
     */
    retryPolicy?: number[];

    /**
     * Optional. Request options to use when calling the OpenAI API.
     */
    requestConfig?: AxiosRequestConfig;
}

/**
 * Options for OSS embeddings.
 * @public
 */
export interface OSSEmbeddingsOptions extends BaseOpenAIEmbeddingsOptions {
    /**
     * Model to use for completion.
     */
    ossModel: string;

    /**
     * Optional. Endpoint to use when calling the OpenAI API.
     * @remarks
     * For Azure OpenAI this is the deployment endpoint.
     */
    ossEndpoint: string;
}

/**
 * Options for OpenAI embeddings.
 * @public
 */
export interface OpenAIEmbeddingsOptions extends BaseOpenAIEmbeddingsOptions {
    /**
     * API key to use when calling the OpenAI API.
     * @remarks
     * A new API key can be created at https://platform.openai.com/account/api-keys.
     */
    apiKey: string;

    /**
     * Model to use for completion.
     * @remarks
     * For Azure OpenAI this is the name of the deployment to use.
     */
    model: string;

    /**
     * Optional. Organization to use when calling the OpenAI API.
     */
    organization?: string;

    /**
     * Optional. Endpoint to use when calling the OpenAI API.
     */
    endpoint?: string;
}

/**
 * Options for Azure OpenAI embeddings.
 * @public
 */
export interface AzureOpenAIEmbeddingsOptions extends BaseOpenAIEmbeddingsOptions {
    /**
     * API key to use when making requests to Azure OpenAI.
     */
    azureApiKey: string;

    /**
     * Deployment endpoint to use.
     */
    azureEndpoint: string;

    /**
     * Name of the Azure OpenAI deployment (model) to use.
     */
    azureDeployment: string;

    /**
     * Optional. Version of the API being called. Defaults to `2023-05-15`.
     */
    azureApiVersion?: string;
}

/**
 * Embeddings model that uses OpenAI's API.
 * @public
 */
export class OpenAIEmbeddings implements EmbeddingsModel {
    private readonly _options: OpenAIEmbeddingsOptions | AzureOpenAIEmbeddingsOptions | OSSEmbeddingsOptions;
    private readonly _client: OpenAI;
    private readonly UserAgent = "AlphaWave";

    /**
     * Sets up headers for the API request.
     * @param headers - Existing headers to merge with.
     * @returns The updated headers object.
     */
    private setupHeaders(headers: Record<string, string> = {}): Record<string, string> {
        headers["User-Agent"] = headers["User-Agent"] || this.UserAgent;

        if ("azureApiKey" in this._options) {
            const options = this._options as AzureOpenAIEmbeddingsOptions;
            headers["api-key"] = options.azureApiKey;
        } else if ("apiKey" in this._options) {
            const options = this._options as OpenAIEmbeddingsOptions;
            headers["Authorization"] = `Bearer ${options.apiKey}`;
            if (options.organization) {
                headers["OpenAI-Organization"] = options.organization;
            }
        }

        return headers;
    }

    /**
     * Creates a new instance of OpenAIEmbeddings.
     * @param options - Configuration options for the embeddings model.
     */
    public constructor(options: OpenAIEmbeddingsOptions | AzureOpenAIEmbeddingsOptions | OSSEmbeddingsOptions) {
        this._options = options;
        this._client = new OpenAI({
            apiKey: "apiKey" in options ? options.apiKey : undefined,
            organization: "organization" in options ? options.organization : undefined,
            baseURL: "endpoint" in options ? options.endpoint : undefined,
            defaultQuery: "apiVersion" in options ? { "api-version": options.apiVersion as string } : undefined,
            defaultHeaders: "deploymentName" in options ? { "x-ms-useragent": this.UserAgent } : undefined,
        });
    }

    /**
     * Gets the maximum number of tokens.
     */
    public get maxTokens(): number {
        return this._options.maxTokens;
    }

    /**
     * Creates embeddings for the given inputs.
     * @param inputs - Text inputs to create embeddings for.
     * @returns A `EmbeddingsResponse` with a status and the generated embeddings or a message when an error occurs.
     */
    public async createEmbeddings(inputs: string|string[]): Promise<EmbeddingsResponse> {
        if (this._options.logRequests) {
            console.log(Colorize.title("EMBEDDINGS REQUEST:"));
            console.log(Colorize.output(inputs));
        }

        try {
            if ("model" in this._options) {
                const result = await this._client.embeddings.create({
                    model: this._options.model,
                    input: inputs,
                    dimensions: this._options.dimensions,
                });
                
                return {
                    status: "success",
                    output: result.data.map(item => item.embedding),
                    model: result.model,
                    usage: result.usage as { [key: string]: number; prompt_tokens: number; total_tokens: number }
                };
            } else {
                // Use existing implementation for Azure and OSS
                const response = await this.createEmbeddingRequest({
                    input: inputs,
                });

                if (response.status >= 400) {
                    return {
                        status: "error",
                        message: `Error: ${response.status} ${response.statusText}`
                    };
                }

                const result = response.data;
                return {
                    status: "success",
                    output: result.data.map(item => item.embedding),
                    model: result.model,
                    usage: result.usage as { [key: string]: number; prompt_tokens: number; total_tokens: number }
                };
            }
        } catch (err: unknown) {
            return {
                status: "error",
                message: (err as Error).message
            };
        }
    }

    /**
     * Creates an embedding request.
     * @param request - The request to create.
     * @returns The response from the API.
     */
    protected createEmbeddingRequest(request: CreateEmbeddingRequest): Promise<AxiosResponse<CreateEmbeddingResponse>> {
        if (this._options.dimensions) {
            request.dimensions = this._options.dimensions;
        }

        if ("azureEndpoint" in this._options) {
            const options = this._options as AzureOpenAIEmbeddingsOptions;
            const url = `${options.azureEndpoint}/openai/deployments/${options.azureDeployment}/embeddings?api-version=${options.azureApiVersion!}`;
            return this.post(url, request);
        } else if ("ossEndpoint" in this._options) {
            const options = this._options as OSSEmbeddingsOptions;
            const url = `${options.ossEndpoint}/v1/embeddings`;
            (request as OpenAICreateEmbeddingRequest).model = options.ossModel;
            return this.post(url, request);
        } else {
            const options = this._options as OpenAIEmbeddingsOptions;
            const url = `${options.endpoint ?? "https://api.openai.com"}/v1/embeddings`;
            (request as OpenAICreateEmbeddingRequest).model = options.model;
            return this.post(url, request);
        }
    }

    /**
     * Posts a request to the API.
     * @param url - The URL to post to.
     * @param body - The body of the request.
     * @param retryCount - The number of retries.
     * @returns The response from the API.
     */
    protected async post<TData>(url: string, body: object, retryCount = 0): Promise<AxiosResponse<TData>> {
        // Initialize request config
        const requestConfig: AxiosRequestConfig = Object.assign({}, this._options.requestConfig);

        // Initialize request headers
        requestConfig.headers = this.setupHeaders(requestConfig.headers as Record<string, string>);

        // Send request
        const response = await axios.post(url, body, requestConfig);

        // Check for rate limit error
        if (response.status == 429 && Array.isArray(this._options.retryPolicy) && retryCount < this._options.retryPolicy.length) {
            const delay = this._options.retryPolicy[retryCount];
            await new Promise((resolve) => setTimeout(resolve, delay));
            return this.post(url, body, retryCount + 1);
        }

        return response;
    }
}