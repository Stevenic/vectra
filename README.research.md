MEMORY:
SOURCE: src\index.ts
DETAILS: export * from './FileFetcher';
export * from './GPT3Tokenizer';
export * from './ItemSelector';
export * from './LocalIndex';
export * from './LocalDocument';
export * from './LocalDocumentIndex';
export * from './LocalDocumentResult';
export * from './OpenAIEmbeddings';
export * from './TextSplitter';
export * from './types';
export * from './WebFetcher';

MEMORY:
SOURCE: src\LocalIndex.spec.ts
DETAILS: import assert from 'node:assert'
import sinon from 'sinon'
import { LocalIndex } from './LocalIndex'
import { IndexItem } from './types'
import fs from 'fs/promises'
import path from 'path'

describe('LocalIndex', () => {
  const testIndexDir = path.join(__dirname, 'test_index');

  const basicIndexItems: Partial<IndexItem>[] = [
    { id: '1', vector: [1, 2, 3] },
    { id: '2', vector: [2, 3, 4] },
    { id: '3', vector: [3, 4, 5] }
  ];


  beforeEach(async () => {
    await fs.rm(testIndexDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    await fs.rm(testIndexDir, { recursive: true, force: true });
    sinon.restore();
  });

  it('should create a new index', async () => {
    const index = new LocalIndex(testIndexDir);
    await index.createIndex();
    const created = await index.isIndexCreated();
    assert.equal(created, true);
    assert.equal(index.folderPath, testIndexDir);
  });

  it('blocks concurrent operations when lock is held', async () => {
    const index = new LocalIndex(testIndexDir);
    await index.createIndex();
    await index.beginUpdate(); // grab lock for a big update!
    await assert.rejects(async () => {
      await index.beginUpdate(); // try to grab lock again. should fail!
    }, new Error('Update already in progress'))
  })

  describe('createIndex', () => {
    it('checks for existing index on creation', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex(); // create first index.json

      // create without deleteIfExists. Will reject
      await assert.rejects(async () => {
        await index.createIndex()
      }, new Error('Index already exists'))

      // create with deleteIfExists. Should remove old data
      await index.insertItem({id:'1', vector: [1,2,3]})
      const lengthBefore = (await index.listItems()).length
      assert.equal(lengthBefore, 1)
      await index.createIndex({deleteIfExists: true, version: 2, metadata_config: {}})
      const lengthAfter = (await index.listItems()).length
      assert.equal(lengthAfter, 0)
    })

    it('delete index if file creation fails', async () => {
      const index = new LocalIndex(testIndexDir);
      sinon.stub(fs, 'writeFile').rejects(new Error('fs error'))

      await assert.rejects(async () => {
        await index.createIndex();
      }, new Error('Error creating index'))

      await assert.rejects(async () => {
        await index.listItems();
      })
    })
  })

  describe('deleteItem', () => {
    it('does nothing when id not found', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();
      await index.beginUpdate();
      await index.insertItem(basicIndexItems[0])
      await index.insertItem(basicIndexItems[1])
      await index.insertItem(basicIndexItems[2])
      await index.endUpdate();

      await assert.doesNotReject(async () => {
        await index.deleteItem('dne');
      })
      assert.equal((await index.listItems()).length, 3)
    })

    it('leaves existing empty index when last el deleted', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();
      await index.insertItem(basicIndexItems[0]);

      await index.deleteItem(basicIndexItems[0].id ?? '');
      assert.equal(await index.isIndexCreated(), true);
      assert.equal((await index.listItems()).length, 0);
    })

    it('removes elements from any position', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();
      await index.batchInsertItems([
        {id: '1', vector: []},
        {id: '2', vector: []},
        {id: '3', vector: []},
        {id: '4', vector: []},
        {id: '5', vector: []},
      ]);

      await index.beginUpdate();
      await index.deleteItem('1');
      await index.deleteItem('3');
      await index.deleteItem('5');
      await index.endUpdate();

      assert.deepStrictEqual(await index.listItems(), [{id: '2', vector: [], metadata: {}, norm: 0}, {id: '4', vector: [], metadata: {}, norm: 0}])
    })
  })

  describe('endUpdate', () => {
    it('throws an error if no update has begun', async () => {
      const index = new LocalIndex(testIndexDir);

      await assert.rejects(async () => {
        await index.endUpdate();
      }, new Error('No update in progress'));
    })

    it('throws an error if the index could not be saved', async () => {
      const index = new LocalIndex(testIndexDir, 'index.json');
      await index.createIndex();
      await index.beginUpdate();

      sinon.stub(fs, 'writeFile').rejects(new Error('fs error'))

      await assert.rejects(async () => {
        await index.endUpdate();
      }, new Error('Error saving index: Error: fs error'))
    })
  })

  describe('getIndexStats', () => {
    it('reports empty index correctly', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();

      assert.deepStrictEqual(await index.getIndexStats(), {
        version: 1,
        metadata_config: {},
        items: 0
      })
    })

    it('correctly reports non-empty index stats', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex({version: 1, metadata_config: {indexed: []}})
      await index.batchInsertItems(basicIndexItems);

      assert.deepStrictEqual(await index.getIndexStats(), {
        version: 1,
        metadata_config: {indexed: []},
        items: 3
      })
    })
  })

  describe('getItem', () => {
    it('returns undefined when item not found', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();

      assert.equal(await index.getItem('1'), undefined)
    })

    it('returns requested item', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();
      await index.batchInsertItems(basicIndexItems);

      const item2 = await index.getItem('2');
      assert.equal(item2?.id, basicIndexItems[1].id)
      assert.equal(item2?.vector, basicIndexItems[1].vector)
      assert.equal((await index.listItems()).length, 3)
    })
  })

  describe('batchInsertItems', () => {
    it('should insert provided items', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();

      const newItems = await index.batchInsertItems(basicIndexItems);

      assert.equal(newItems.length, 3);

      const retrievedItems = await index.listItems();
      assert.equal(retrievedItems.length, 3);
    });

    it('on id collision - cancel batch insert & bubble up error', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();

      await index.insertItem({ id: '2', vector: [9, 9, 9] });

      // ensures insert error is bubbled up to batchIndexItems caller
      await assert.rejects(
        async () => {
          await index.batchInsertItems(basicIndexItems);
        },
        {
          name: 'Error',
          message: 'Item with id 2 already exists'
        }
      );

      // ensures no partial update is applied
      const storedItems = await index.listItems();
      assert.equal(storedItems.length, 1);
    });
  });

  describe('listItemsByMetadata', () => {
    it('returns items matching metadata filter', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();
      await index.batchInsertItems([
        {id: '1', vector: [], metadata: {category: 'food'}},
        {id: '2', vector: [], metadata: {category: 'food'}},
        {id: '3', vector: [], metadata: {category: 'electronics'}},
        {id: '4', vector: [], metadata: {category: 'drink'}},
        {id: '5', vector: [], metadata: {category: 'food'}},
      ]);

      const foodItems = await index.listItemsByMetadata({category: {'$eq': 'food'}})
      assert.deepStrictEqual(foodItems.map((item) => item.id), ["1", "2", "5"])
      const drinkItems = await index.listItemsByMetadata({category: {'$eq': 'drink'}})
      assert.deepStrictEqual(drinkItems.map((item) => item.id), ["4"])
      const clothingItems = await index.listItemsByMetadata({category: {'$eq': 'clothes'}})
      assert.deepStrictEqual(clothingItems, [])
    })

    it('returns nothing when no items in index', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();

      const items = await index.listItemsByMetadata({});
      assert.deepStrictEqual(items, []);
    })
  });

  describe("queryItems", () => {
    it("returns empty array on empty index search", async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();

      const result = await index.queryItems([1, 2, 3], "", 10);
      assert.deepStrictEqual(result, []);
    });

    it("returns bad match when no better match exists", async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();
      await index.insertItem({ id: "1", vector: [0.9, 0, 0, 0, 0] });

      const result = await index.queryItems([0, 0, 0, 0, 0.1], "", 1);
      assert.equal(result[0]?.score, 0);
      assert.equal(result[0]?.item.id, "1");
    });

    it("returns all vectors when fewer than topK exist", async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();
      await index.batchInsertItems(basicIndexItems);

      const result = await index.queryItems([0, 0, 1], "", 10);
      assert.equal(result.length, 3);
      assert.deepStrictEqual(
        result.map(({ item }) => item.id),
        basicIndexItems.map((item) => item.id),
      );
    });

    it("filters by metadata when filter provided", async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();
      await index.batchInsertItems([
        { id: "1", vector: [1, 0, 0], metadata: { category: "food" } },
        { id: "2", vector: [0, 0, 1], metadata: { category: "drink" } },
      ]);

      const bestGeneralMatch = await index.queryItems([1, 0, 0], "", 1);
      const bestDrinkMatch = await index.queryItems([1, 0, 0], "", 1, {
        category: { $eq: "drink" },
      });

      assert.equal(bestGeneralMatch[0].item.id, "1");
      assert.equal(bestDrinkMatch[0].item.id, "2");
    });

    it("reads item metadata file when provided", async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex({version: 1, metadata_config: {indexed: ['category']}});
      await index.batchInsertItems([
        { id: "1", vector: [1, 0, 0] },
        { id: "2", vector: [0, 0, 1], metadata: {category: 'drink'} },
      ]);

      sinon
        .stub(fs, "readFile")
        .resolves(JSON.stringify({ category: "drink" }));

      const bestDrinkMatch = await index.queryItems([1, 0, 0], "", 2, {category: {'$eq': 'drink'}});

      assert.notEqual(bestDrinkMatch[0].item.metadataFile, undefined);
      assert.equal(bestDrinkMatch[0].item.id, "2");
    });
  });
});

MEMORY:
SOURCE: src\OpenAIEmbeddings.ts
DETAILS: import axios, { AxiosInstance, AxiosResponse, AxiosRequestConfig } from 'axios';
import { EmbeddingsModel, EmbeddingsResponse } from "./types";
import { CreateEmbeddingRequest, CreateEmbeddingResponse, OpenAICreateEmbeddingRequest } from "./internals";
import { Colorize } from "./internals";

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
 * Options for configuring an `OpenAIEmbeddings` to generate embeddings using an OSS hosted model.
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
 * Options for configuring an `OpenAIEmbeddings` to generate embeddings using an OpenAI hosted model.
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
 * Options for configuring an `OpenAIEmbeddings` to generate embeddings using an Azure OpenAI hosted model.
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
 * A `PromptCompletionModel` for calling OpenAI and Azure OpenAI hosted models.
 * @remarks
 */
export class OpenAIEmbeddings implements EmbeddingsModel {
    private readonly _httpClient: AxiosInstance;
    private readonly _clientType: ClientType;

    private readonly UserAgent = 'AlphaWave';

    public readonly maxTokens;
    
    /**
     * Options the client was configured with.
     */
    public readonly options: OSSEmbeddingsOptions|OpenAIEmbeddingsOptions|AzureOpenAIEmbeddingsOptions;

    /**
     * Creates a new `OpenAIClient` instance.
     * @param options Options for configuring an `OpenAIClient`.
     */
    public constructor(options: OSSEmbeddingsOptions|OpenAIEmbeddingsOptions|AzureOpenAIEmbeddingsOptions) {
        this.maxTokens = options.maxTokens ?? 500;

        // Check for azure config
        if ((options as AzureOpenAIEmbeddingsOptions).azureApiKey) {
            this._clientType = ClientType.AzureOpenAI;
            this.options = Object.assign({
                retryPolicy: [2000, 5000],
                azureApiVersion: '2023-05-15',
            }, options) as AzureOpenAIEmbeddingsOptions;

            // Cleanup and validate endpoint
            let endpoint = this.options.azureEndpoint.trim();
            if (endpoint.endsWith('/')) {
                endpoint = endpoint.substring(0, endpoint.length - 1);
            }

            if (!endpoint.toLowerCase().startsWith('https://')) {
                throw new Error(`Client created with an invalid endpoint of '${endpoint}'. The endpoint must be a valid HTTPS url.`);
            }

            this.options.azureEndpoint = endpoint;
        } else if ((options as OSSEmbeddingsOptions).ossModel) {
            this._clientType = ClientType.OSS;
            this.options = Object.assign({
                retryPolicy: [2000, 5000]
            }, options) as OSSEmbeddingsOptions;
        } else {
            this._clientType = ClientType.OpenAI;
            this.options = Object.assign({
                retryPolicy: [2000, 5000]
            }, options) as OpenAIEmbeddingsOptions;
        }

        // Create client
        this._httpClient = axios.create({
            validateStatus: (status) => status < 400 || status == 429
        });
    }

    /**
     * Creates embeddings for the given inputs using the OpenAI API.
     * @param model Name of the model to use (or deployment for Azure).
     * @param inputs Text inputs to create embeddings for.
     * @returns A `EmbeddingsResponse` with a status and the generated embeddings or a message when an error occurs.
     */
    public async createEmbeddings(inputs: string | string[]): Promise<EmbeddingsResponse> {
        if (this.options.logRequests) {
            console.log(Colorize.title('EMBEDDINGS REQUEST:'));
            console.log(Colorize.output(inputs));
        }

        const startTime = Date.now();
        const response = await this.createEmbeddingRequest({
            input: inputs,
        });

        if (this.options.logRequests) {
            console.log(Colorize.title('RESPONSE:'));
            console.log(Colorize.value('status', response.status));
            console.log(Colorize.value('duration', Date.now() - startTime, 'ms'));
            console.log(Colorize.output(response.data));
        }


        // Process response
        if (response.status < 300) {
            return { status: 'success', output: response.data.data.sort((a, b) => a.index - b.index).map((item) => item.embedding) };
        } else if (response.status == 429) {
            return { status: 'rate_limited', message: `The embeddings API returned a rate limit error.` }
        } else {
            return { status: 'error', message: `The embeddings API returned an error status of ${response.status}: ${response.statusText}` };
        }
    }

    /**
     * @private
     */
    protected createEmbeddingRequest(request: CreateEmbeddingRequest): Promise<AxiosResponse<CreateEmbeddingResponse>> {
        if (this.options.dimensions) {
            request.dimensions = this.options.dimensions;
        }
        if (this._clientType == ClientType.AzureOpenAI) {
            const options = this.options as AzureOpenAIEmbeddingsOptions;
            const url = `${options.azureEndpoint}/openai/deployments/${options.azureDeployment}/embeddings?api-version=${options.azureApiVersion!}`;
            return this.post(url, request);
        } else if (this._clientType == ClientType.OSS) {
            const options = this.options as OSSEmbeddingsOptions;
            const url = `${options.ossEndpoint}/v1/embeddings`;
            (request as OpenAICreateEmbeddingRequest).model = options.ossModel;
            return this.post(url, request);
        } else {
            const options = this.options as OpenAIEmbeddingsOptions;
            const url = `${options.endpoint ?? 'https://api.openai.com'}/v1/embeddings`;
            (request as OpenAICreateEmbeddingRequest).model = options.model;
            return this.post(url, request);
        }
    }

    /**
     * @private
     */
    protected async post<TData>(url: string, body: object, retryCount = 0): Promise<AxiosResponse<TData>> {
        // Initialize request config
        const requestConfig: AxiosRequestConfig = Object.assign({}, this.options.requestConfig);

        // Initialize request headers
        if (!requestConfig.headers) {
            requestConfig.headers = {};
        }
        if (!requestConfig.headers['Content-Type']) {
            requestConfig.headers['Content-Type'] = 'application/json';
        }
        if (!requestConfig.headers['User-Agent']) {
            requestConfig.headers['User-Agent'] = this.UserAgent;
        }
        if (this._clientType == ClientType.AzureOpenAI) {
            const options = this.options as AzureOpenAIEmbeddingsOptions;
            requestConfig.headers['api-key'] = options.azureApiKey;
        } else if (this._clientType == ClientType.OpenAI) {
            const options = this.options as OpenAIEmbeddingsOptions;
            requestConfig.headers['Authorization'] = `Bearer ${options.apiKey}`;
            if (options.organization) {
                requestConfig.headers['OpenAI-Organization'] = options.organization;
            }
        }

        // Send request
        const response = await this._httpClient.post(url, body, requestConfig);

        // Check for rate limit error
        if (response.status == 429 && Array.isArray(this.options.retryPolicy) && retryCount < this.options.retryPolicy.length) {
            const delay = this.options.retryPolicy[retryCount];
            await new Promise((resolve) => setTimeout(resolve, delay));
            return this.post(url, body, retryCount + 1);
        } else {
            return response;
        }
    }
}

enum ClientType {
    OpenAI,
    AzureOpenAI,
    OSS
}

MEMORY:
SOURCE: src\ItemSelector.ts
DETAILS: import { MetadataFilter, MetadataTypes } from './types';

export class ItemSelector {
    /**
     * Returns the similarity between two vectors using the cosine similarity.
     * @param vector1 Vector 1
     * @param vector2 Vector 2
     * @returns Similarity between the two vectors
     */
    public static cosineSimilarity(vector1: number[], vector2: number[]) {
        // Return the quotient of the dot product and the product of the norms
        return this.dotProduct(vector1, vector2) / (this.normalize(vector1) * this.normalize(vector2));
    }

    /**
     * Normalizes a vector.
     * @remarks
     * The norm of a vector is the square root of the sum of the squares of the elements.
     * The LocalIndex pre-normalizes all vectors to improve performance.
     * @param vector Vector to normalize
     * @returns Normalized vector
     */
    public static normalize(vector: number[]) {
        // Initialize a variable to store the sum of the squares
        let sum = 0;
        // Loop through the elements of the array
        for (let i = 0; i < vector.length; i++) {
            // Square the element and add it to the sum
            sum += vector[i] * vector[i];
        }
        // Return the square root of the sum
        return Math.sqrt(sum);
    }

    /**
     * Returns the similarity between two vectors using cosine similarity.
     * @remarks
     * The LocalIndex pre-normalizes all vectors to improve performance.
     * This method uses the pre-calculated norms to improve performance.
     * @param vector1 Vector 1
     * @param norm1 Norm of vector 1
     * @param vector2 Vector 2
     * @param norm2 Norm of vector 2
     * @returns Similarity between the two vectors
     */
    public static normalizedCosineSimilarity(vector1: number[], norm1: number, vector2: number[], norm2: number) {
        // Return the quotient of the dot product and the product of the norms
        return this.dotProduct(vector1, vector2) / (norm1 * norm2);
    }

    /**
     * Applies a filter to the metadata of an item.
     * @param metadata Metadata of the item
     * @param filter Filter to apply
     * @returns True if the item matches the filter, false otherwise
     */
    public static select(metadata: Record<string, MetadataTypes>, filter: MetadataFilter): boolean {
        if (filter === undefined || filter === null) {
            return true;
        }

        for (const key in filter) {
            switch (key) {
                case '$and':
                    if (!filter[key]!.every((f: MetadataFilter) => this.select(metadata, f))) {
                        return false;
                    }
                    break;
                case '$or':
                    if (!filter[key]!.some((f: MetadataFilter) => this.select(metadata, f))) {
                        return false;
                    }
                    break;
                default:
                    const value = filter[key];
                    if (value === undefined || value === null) {
                        return false;
                    } else if (typeof value == 'object') {
                        if (!this.metadataFilter(metadata[key], value as MetadataFilter)) {
                            return false;
                        }
                    } else {
                        if (metadata[key] !== value) {
                            return false;
                        }
                    }
                    break;
            }
        }
        return true;
    }

    private static dotProduct(arr1: number[], arr2: number[]) {
        // Initialize a variable to store the sum of the products
        let sum = 0;
        // Loop through the elements of the arrays
        for (let i = 0; i < arr1.length; i++) {
            // Multiply the corresponding elements and add them to the sum
            sum += arr1[i] * arr2[i];
        }
        // Return the sum
        return sum;
    }

    private static metadataFilter(value: MetadataTypes, filter: MetadataFilter): boolean {
        if (value === undefined || value === null) {
            return false;
        }

        for (const key in filter) {
            switch (key) {
                case '$eq':
                    if (value !== filter[key]) {
                        return false;
                    }
                    break;
                case '$ne':
                    if (value === filter[key]) {
                        return false;
                    }
                    break;
                case '$gt':
                    if (typeof value != 'number' || value <= filter[key]!) {
                        return false;
                    }
                    break;
                case '$gte':
                    if (typeof value != 'number' || value < filter[key]!) {
                        return false;
                    }
                    break;
                case '$lt':
                    if (typeof value != 'number' || value >= filter[key]!) {
                        return false;
                    }
                    break;
                case '$lte':
                    if (typeof value != 'number' || value > filter[key]!) {
                        return false;
                    }
                    break;
                case '$in':
                    if (typeof value == 'boolean') {
                        return false;
                    } else if(typeof value == 'string' && !filter[key]!.includes(value)){
                        return false
                    } else if(!filter[key]!.some(val => typeof val == 'string' && val.includes(value as string))){
                        return false
                    }
                    break;
                case '$nin':
                    if (typeof value == 'boolean') {
                        return false;
                    }
                    else if (typeof value == 'string' && filter[key]!.includes(value)) {
                        return false;
                    }
                    else if (filter[key]!.some(val => typeof val == 'string' && val.includes(value as string))) {
                        return false;
                    }
                    break;
                default:
                    return value === filter[key];
            }
        }
        return true;
    }
}

MEMORY:
SOURCE: src\TextSplitter.ts
DETAILS: import { GPT3Tokenizer } from "./GPT3Tokenizer";
import { TextChunk, Tokenizer } from "./types";
const ALPHANUMERIC_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export interface TextSplitterConfig {
    separators: string[];
    keepSeparators: boolean;
    chunkSize: number;
    chunkOverlap: number;
    tokenizer: Tokenizer;
    docType?: string;
export class TextSplitter {
    private readonly _config: TextSplitterConfig;
    public constructor(config?: Partial<TextSplitterConfig>) {
        this._config = Object.assign({
            keepSeparators: false,
            chunkSize: 400,
            chunkOverlap: 40,
        } as TextSplitterConfig, config);
        // Create a default tokenizer if none is provided
        if (!this._config.tokenizer) {
            this._config.tokenizer = new GPT3Tokenizer();
        // Use default separators if none are provided
        if (!this._config.separators || this._config.separators.length === 0) {
            this._config.separators = this.getSeparators(this._config.docType);
        // Validate the config settings
        if (this._config.chunkSize < 1) {
            throw new Error("chunkSize must be >= 1");
        } else if (this._config.chunkOverlap < 0) {
            throw new Error("chunkOverlap must be >= 0");
        } else if (this._config.chunkOverlap > this._config.chunkSize) {
            throw new Error("chunkOverlap must be <= chunkSize");
    public split(text: string): TextChunk[] {
        // Get basic chunks
        const chunks = this.recursiveSplit(text, this._config.separators, 0);
        const that = this;
        function getOverlapTokens(tokens?: number[]): number[] {
            if (tokens != undefined) {
                const len = tokens.length > that._config.chunkOverlap ? that._config.chunkOverlap : tokens.length;
                return tokens.slice(0, len);
            } else {
                return [];
        // Add overlap tokens and text to the start and end of each chunk
        if (this._config.chunkOverlap > 0) {
            for (let i = 1; i < chunks.length; i++) {
                const previousChunk = chunks[i - 1];
                const chunk = chunks[i];
                const nextChunk = i < chunks.length - 1 ? chunks[i + 1] : undefined;
                chunk.startOverlap = getOverlapTokens(previousChunk.tokens.reverse()).reverse();
                chunk.endOverlap = getOverlapTokens(nextChunk?.tokens);
        return chunks;
    private recursiveSplit(text: string, separators: string[], startPos: number): TextChunk[] {
        const chunks: TextChunk[] = [];
        if (text.length > 0) {
            // Split text into parts
            let parts: string[];
            let separator = '';
            const nextSeparators = separators.length > 1 ? separators.slice(1) : [];
            if (separators.length > 0) {
                // Split by separator
                separator = separators[0];
                parts = separator == ' ' ? this.splitBySpaces(text) : text.split(separator);
            } else {
                // Cut text in half
                const half = Math.floor(text.length / 2);
                parts = [text.substring(0, half), text.substring(half)];
            // Iterate over parts
            for (let i = 0; i < parts.length; i++) {
                const lastChunk = (i === parts.length - 1);
                // Get chunk text and endPos
                let chunk = parts[i];
                const endPos = (startPos + (chunk.length - 1)) + (lastChunk ? 0 : separator.length);
                if (this._config.keepSeparators && !lastChunk) {
                    chunk += separator;
                // Ensure chunk contains text
                if (!this.containsAlphanumeric(chunk)) {
                    continue;
                // Optimization to avoid encoding really large chunks
                if (chunk.length / 6 > this._config.chunkSize) {
                    // Break the text into smaller chunks
                    const subChunks = this.recursiveSplit(chunk, nextSeparators, startPos);
                    chunks.push(...subChunks);
                } else {
                    // Encode chunk text
                    const tokens = this._config.tokenizer.encode(chunk);
                    if (tokens.length > this._config.chunkSize) {
                        // Break the text into smaller chunks
                        const subChunks = this.recursiveSplit(chunk, nextSeparators, startPos);
                        chunks.push(...subChunks);
                    } else {
                        // Append chunk to output
                        chunks.push({
                            text: chunk,
                            tokens: tokens,
                            startPos: startPos,
                            endPos: endPos,
                            startOverlap: [],
                            endOverlap: [],
                        });
                // Update startPos
                startPos = endPos + 1;
        return this.combineChunks(chunks);
    private combineChunks(chunks: TextChunk[]): TextChunk[] {
        const combinedChunks: TextChunk[] = [];
        let currentChunk: TextChunk|undefined;
        let currentLength = 0;
        const separator = this._config.keepSeparators ? '' : ' ';
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            if (currentChunk) {
                const length = currentChunk.tokens.length + chunk.tokens.length;
                if (length > this._config.chunkSize) {
                    combinedChunks.push(currentChunk);
                    currentChunk = chunk;
                    currentLength = chunk.tokens.length;
                } else {
                    currentChunk.text += separator + chunk.text;
                    currentChunk.endPos = chunk.endPos;
                    currentChunk.tokens.push(...chunk.tokens);
                    currentLength += chunk.tokens.length;
                }
            } else {
                currentChunk = chunk;
                currentLength = chunk.tokens.length;
        if (currentChunk) {
            combinedChunks.push(currentChunk);
        return combinedChunks;
    private containsAlphanumeric(text: string): boolean {
        for (let i = 0; i < text.length; i++) {
            if (ALPHANUMERIC_CHARS.includes(text[i])) {
                return true;
            }
        }
        return false;
    }
    private splitBySpaces(text: string): string[] {
        // Split text by tokens and return parts
        const parts: string[] = [];
        let tokens = this._config.tokenizer.encode(text);
        do {
            if (tokens.length <= this._config.chunkSize) {
                parts.push(this._config.tokenizer.decode(tokens));
                break;
            } else {
                const span = tokens.splice(0, this._config.chunkSize);
                parts.push(this._config.tokenizer.decode(span));
        } while (true);
        return parts;
    }
    private getSeparators(docType?: string): string[] {
        switch (docType ?? '') {
            case "cpp":
                return [
                    // Split along class definitions
                    "\nclass ",
                    // Split along function definitions
                    "\nvoid ",
                    "\nint ",
                    "\nfloat ",
                    "\ndouble ",
                    // Split along control flow statements
                    "\nif ",
                    "\nfor ",
                    "\nwhile ",
                    "\nswitch ",
                    "\ncase ",
                    // Split by the normal type of lines
                    "\n\n",
                    "\n",
                ];
            case "go":
                return [
                    // Split along function definitions
                    "\nfunc ",
                    "\nvar ",
                    "\nconst ",
                    "\ntype ",
                    // Split along control flow statements
                    "\nif ",
                    "\nfor ",
                    "\nswitch ",
                    "\ncase ",
                    // Split by the normal type of lines
                    "\n\n",
                    "\n",
                ];
            case "java":
            case "c#":
            case "csharp":
            case "cs":
            case "ts":
            case "tsx":
            case "typescript":
                return [
                    // split along regions
                    "// LLM-REGION",
                    "/* LLM-REGION",
                    "/** LLM-REGION",
                    // Split along class definitions
                    "\nclass ",
                    // Split along method definitions
                    "\npublic ",
                    "\nprotected ",
                    "\nprivate ",
                    "\nstatic ",
                    // Split along control flow statements
                    "\nif ",
                    "\nfor ",
                    "\nwhile ",
                    "\nswitch ",
                    "\ncase ",
                    // Split by the normal type of lines
                    "\n\n",
                    "\n",
                    " "
                ];
            case "js":
            case "jsx":
            case "javascript":
                return [
                    // split along regions
                    "// LLM-REGION",
                    "/* LLM-REGION",
                    "/** LLM-REGION",
                    // Split along class definitions
                    "\nclass ",
                    // Split along function definitions
                    "\nfunction ",
                    "\nconst ",
                    "\nlet ",
                    "\nvar ",
                    "\nclass ",
                    // Split along control flow statements
                    "\nif ",
                    "\nfor ",
                    "\nwhile ",
                    "\nswitch ",
                    "\ncase ",
                    "\ndefault ",
                    // Split by the normal type of lines
                    "\n\n",
                    "\n",
                ];
            case "php":
                return [
                    // Split along function definitions
                    "\nfunction ",
                    // Split along class definitions
                    "\nclass ",
                    // Split along control flow statements
                    "\nif ",
                    "\nforeach ",
                    "\nwhile ",
                    "\ndo ",
                    "\nswitch ",
                    "\ncase ",
                    // Split by the normal type of lines
                    "\n\n",
                    "\n",
                ];
            case "proto":
                return [
                    // Split along message definitions
                    "\nmessage ",
                    // Split along service definitions
                    "\nservice ",
                    // Split along enum definitions
                    "\nenum ",
                    // Split along option definitions
                    "\noption ",
                    // Split along import statements
                    "\nimport ",
                    // Split along syntax declarations
                    "\nsyntax ",
                    // Split by the normal type of lines
                    "\n\n",
                    "\n",
                ];
            case "python":
            case "py":
                return [
                    // First, try to split along class definitions
                    "\nclass ",
                    "\ndef ",
                    "\n\tdef ",
                    // Now split by the normal type of lines
                    "\n\n",
                    "\n",
                ];
            case "rst":
                return [
                    // Split along section titles
                    "\n===\n",
                    "\n---\n",
                    "\n***\n",
                    // Split along directive markers
                    "\n.. ",
                    // Split by the normal type of lines
                    "\n\n",
                    "\n",
                ];
            case "ruby":
                return [
                    // Split along method definitions
                    "\ndef ",
                    "\nclass ",
                    // Split along control flow statements
                    "\nif ",
                    "\nunless ",
                    "\nwhile ",
                    "\nfor ",
                    "\ndo ",
                    "\nbegin ",
                    "\nrescue ",
                    // Split by the normal type of lines
                    "\n\n",
                    "\n",
                ];
            case "rust":
                return [
                    // Split along function definitions
                    "\nfn ",
                    "\nconst ",
                    "\nlet ",
                    // Split along control flow statements
                    "\nif ",
                    "\nwhile ",
                    "\nfor ",
                    "\nloop ",
                    "\nmatch ",
                    "\nconst ",
                    // Split by the normal type of lines
                    "\n\n",
                    "\n",
                ];
            case "scala":
                return [
                    // Split along class definitions
                    "\nclass ",
                    "\nobject ",
                    // Split along method definitions
                    "\ndef ",
                    "\nval ",
                    "\nvar ",
                    // Split along control flow statements
                    "\nif ",
                    "\nfor ",
                    "\nwhile ",
                    "\nmatch ",
                    "\ncase ",
                    // Split by the normal type of lines
                    "\n\n",
                    "\n",
                ];
            case "swift":
                return [
                    // Split along function definitions
                    "\nfunc ",
                    // Split along class definitions
                    "\nclass ",
                    "\nstruct ",
                    "\nenum ",
                    // Split along control flow statements
                    "\nif ",
                    "\nfor ",
                    "\nwhile ",
                    "\ndo ",
                    "\nswitch ",
                    "\ncase ",
                    // Split by the normal type of lines
                    "\n\n",
                    "\n",
                ];
            case "md":
            case "markdown":
                return [
                    // First, try to split along Markdown headings (starting with level 2)
                    "\n## ",
                    "\n### ",
                    "\n#### ",
                    "\n##### ",
                    "\n###### ",
                    // Note the alternative syntax for headings (below) is not handled here
                    // Heading level 2
                    // End of code block
                    "```\n\n",
                    // Horizontal lines
                    "\n\n***\n\n",
                    "\n\n---\n\n",
                    "\n\n___\n\n",
                    // Note that this splitter doesn't handle horizontal lines defined
                    // by *three or more* of ***, ---, or ___, but this is not handled
                    // Github tables
                    "<table>",
                    // "<tr>",
                    // "<td>",
                    // "<td ",
                    "\n\n",
                    "\n",
                ];
            case "latex":
                return [
                    // First, try to split along Latex sections
                    "\n\\chapter{",
                    "\n\\section{",
                    "\n\\subsection{",
                    "\n\\subsubsection{",
                    // Now split by environments
                    "\n\\begin{enumerate}",
                    "\n\\begin{itemize}",
                    "\n\\begin{description}",
                    "\n\\begin{list}",
                    "\n\\begin{quote}",
                    "\n\\begin{quotation}",
                    "\n\\begin{verse}",
                    "\n\\begin{verbatim}",
                    // Now split by math environments
                    "\n\\begin{align}",
                    // Now split by the normal type of lines
                    "\n\n",
                    "\n",
                ];
            case "html":
                return [
                    // First, try to split along HTML tags
                    "<body>",
                    "<div>",
                    "<p>",
                    "<br>",
                    "<li>",
                    "<h1>",
                    "<h2>",
                    "<h3>",
                    "<h4>",
                    "<h5>",
                    "<h6>",
                    "<span>",
                    "<table>",
                    "<tr>",
                    "<td>",
                    "<th>",
                    "<ul>",
                    "<ol>",
                    "<header>",
                    "<footer>",
                    "<nav>",
                    // Head
                    "<head>",
                    "<style>",
                    "<script>",
                    "<meta>",
                    "<title>",
                    // Normal type of lines
                    "\n\n",
                    "\n",
                ];
            case "sol":
                return [
                    // Split along compiler informations definitions
                    "\npragma ",
                    "\nusing ",
                    // Split along contract definitions
                    "\ncontract ",
                    "\ninterface ",
                    "\nlibrary ",
                    // Split along method definitions
                    "\nconstructor ",
                    "\ntype ",
                    "\nfunction ",
                    "\nevent ",
                    "\nmodifier ",
                    "\nerror ",
                    "\nstruct ",
                    "\nenum ",
                    // Split along control flow statements
                    "\nif ",
                    "\nfor ",
                    "\nwhile ",
                    "\ndo while ",
                    "\nassembly ",
                    // Split by the normal type of lines
                    "\n\n",
                    "\n",
                ];
            default:
                return [
                    // Split by the normal type of lines
                    "\n\n",
                    "\n",
                ];
        }
    }
}

MEMORY:
SOURCE: src\LocalDocument.ts
DETAILS: import * as fs from 'fs/promises';
import * as path from 'path';
import { MetadataTypes } from './types';
import { LocalDocumentIndex } from './LocalDocumentIndex';

/**
 * Represents an indexed document stored on disk.
 */
export class LocalDocument {
    private readonly _index: LocalDocumentIndex;
    private readonly _id: string;
    private readonly _uri: string;
    private _metadata: Record<string,MetadataTypes>|undefined;
    private _text: string|undefined;

    /**
     * Creates a new `LocalDocument` instance.
     * @param index Parent index that contains the document.
     * @param id ID of the document.
     * @param uri URI of the document.
     */
    public constructor(index: LocalDocumentIndex, id: string, uri: string) {
        this._index = index;
        this._id = id;
        this._uri = uri;
    }

    /**
     * Returns the folder path where the document is stored.
     */
    public get folderPath(): string {
        return this._index.folderPath;
    }

    /**
     * Returns the ID of the document.
     */
    public get id(): string {
        return this._id;
    }

    /**
     * Returns the URI of the document.
     */
    public get uri(): string {
        return this._uri;
    }

    /**
     * Returns the length of the document in tokens.
     * @remarks
     * This value will be estimated for documents longer then 40k bytes.
     * @returns Length of the document in tokens.
     */
    public async getLength(): Promise<number> {
        const text = await this.loadText();
        if (text.length <= 40000) {
            return this._index.tokenizer.encode(text).length;
        } else {
            return Math.ceil(text.length / 4);
        }
    }

    /**
     * Determines if the document has additional metadata storred on disk.
     * @returns True if the document has metadata; otherwise, false.
     */
    public async hasMetadata(): Promise<boolean> {
        try {
            await fs.access(path.join(this.folderPath, `${this.id}.json`));
            return true;
        } catch (err: unknown) {
            return false;
        }
    }

    /**
     * Loads the metadata for the document from disk.
     * @returns Metadata for the document.
     */
    public async loadMetadata(): Promise<Record<string,MetadataTypes>> {
        if (this._metadata == undefined) {
            let json: string;
            try {
                json = (await fs.readFile(path.join(this.folderPath, `${this.id}.json`))).toString();
            } catch (err: unknown) {
                throw new Error(`Error reading metadata for document "${this.uri}": ${(err as any).toString()}`);
            }

            try {
                this._metadata = JSON.parse(json);
            } catch (err: unknown) {
                throw new Error(`Error parsing metadata for document "${this.uri}": ${(err as any).toString()}`);
            }
        }

        return this._metadata!;
    }

    /**
     * Loads the text for the document from disk.
     * @returns Text for the document.
     */
    public async loadText(): Promise<string> {
        if (this._text == undefined) {
            try {
                this._text = (await fs.readFile(path.join(this.folderPath, `${this.id}.txt`))).toString();
            } catch (err: unknown) {
                throw new Error(`Error reading text file for document "${this.uri}": ${(err as any).toString()}`);
            }
        }

        return this._text;
    }
}

MEMORY:
SOURCE: src\LocalDocumentResult.ts
DETAILS: import { LocalDocument } from "./LocalDocument";
import { LocalDocumentIndex } from "./LocalDocumentIndex";
import { QueryResult, DocumentChunkMetadata, Tokenizer, DocumentTextSection } from "./types";
/**
 * Represents a search result for a document stored on disk.
 */
export class LocalDocumentResult extends LocalDocument {
    private readonly _chunks: QueryResult<DocumentChunkMetadata>[];
    private readonly _tokenizer: Tokenizer;
    private readonly _score: number;

    /**
     * @private
     * Internal constructor for `LocalDocumentResult` instances.
     */
    public constructor(index: LocalDocumentIndex, id: string, uri: string, chunks: QueryResult<DocumentChunkMetadata>[], tokenizer: Tokenizer) {
        super(index, id, uri);
        this._chunks = chunks;
        this._tokenizer = tokenizer;
        // Compute average score
        let score = 0;
        this._chunks.forEach(chunk => score += chunk.score);
        this._score = score / this._chunks.length;
    }

    /**
     * Returns the chunks of the document that matched the query.
     */
    public get chunks(): QueryResult<DocumentChunkMetadata>[] {
        return this._chunks;
    }

    /**
     * Returns the average score of the document result.
     */
    public get score(): number {
        return this._score;
    }

    /**
     * Renders all of the results chunks as spans of text (sections.)
     * @remarks
     * The returned sections will be sorted by document order and limited to maxTokens in length.
     * @param maxTokens Maximum number of tokens per section.
     * @returns Array of rendered text sections.
     */
    public async renderAllSections(maxTokens: number): Promise<DocumentTextSection[]> {
        // Load text from disk
        const text = await this.loadText();
        // Add chunks to a temp array and split any chunks that are longer than maxTokens.
        const chunks: SectionChunk[]  = [];
        for (let i = 0; i < this._chunks.length; i++) {
            const chunk = this._chunks[i];
            const startPos = chunk.item.metadata.startPos;
            const endPos = chunk.item.metadata.endPos;
            const chunkText = text.substring(startPos, endPos + 1);
            const tokens = this._tokenizer.encode(chunkText);
            let offset = 0;
            while (offset < tokens.length) {
                const chunkLength = Math.min(maxTokens, tokens.length - offset);
                chunks.push({
                    text: this._tokenizer.decode(tokens.slice(offset, offset + chunkLength)),
                    startPos: startPos + offset,
                    endPos: startPos + offset + chunkLength - 1,
                    score: chunk.score,
                    tokenCount: chunkLength,
                    isBm25: false
                });
                offset += chunkLength;
            }
        }
        // Sort chunks by startPos
        const sorted = chunks.sort((a, b) => a.startPos - b.startPos);
        // Generate sections
        const sections: Section[] = [];
        for (let i = 0; i < sorted.length; i++) {
            const chunk = sorted[i];
            let section = sections[sections.length - 1];
            if (!section || section.tokenCount + chunk.tokenCount > maxTokens) {
                section = {
                    chunks: [],
                    score: 0,
                    tokenCount: 0
                };
                sections.push(section);
            }
            section.chunks.push(chunk);
            section.score += chunk.score;
            section.tokenCount += chunk.tokenCount;
        }
        // Normalize section scores
        sections.forEach(section => section.score /= section.chunks.length);
        // Return final rendered sections
        return sections.map(section => {
            let text = '';
            section.chunks.forEach(chunk => text += chunk.text);
            return {
                text: text,
                tokenCount: section.tokenCount,
                score: section.score,
                isBm25: false,
            };
        });
    }

    /**
     * Renders the top spans of text (sections) of the document based on the query result.
     * @remarks
     * The returned sections will be sorted by relevance and limited to the top `maxSections`.
     * @param maxTokens Maximum number of tokens per section.
     * @param maxSections Maximum number of sections to return.
     * @param overlappingChunks Optional. If true, overlapping chunks of text will be added to each section until the maxTokens is reached.
     * @returns Array of rendered text sections.
     */
    public async renderSections(maxTokens: number, maxSections: number, overlappingChunks = true): Promise<DocumentTextSection[]> {
        // Load text from disk
        const text = await this.loadText();
        // First check to see if the entire document is shorter than maxTokens
        const length = await this.getLength();
        if (length <= maxTokens) {
            return [{
                text,
                tokenCount: length,
                score: 1.0,
                isBm25: false,
            }];
        }
        // Otherwise, we need to split the document into sections
        // - Add each chunk to a temp array and filter out any chunk that's longer then maxTokens.
        // - Sort the array by startPos to arrange chunks in document order.
        // - Generate a new array of sections by combining chunks until the maxTokens is reached for each section.
        // - Generate an aggregate score for each section by averaging the score of each chunk in the section.
        // - Sort the sections by score and limit to maxSections.
        // - For each remaining section combine adjacent chunks of text.
        // - Dynamically add overlapping chunks of text to each section until the maxTokens is reached.
        const chunks: SectionChunk[] = this._chunks.map(chunk => {
            const startPos = chunk.item.metadata.startPos;
            const endPos = chunk.item.metadata.endPos;
            const chunkText = text.substring(startPos, endPos + 1);
            return {
                text: chunkText,
                startPos,
                endPos,
                score: chunk.score,
                tokenCount: this._tokenizer.encode(chunkText).length,
                isBm25: Boolean(chunk.item.metadata.isBm25),
            };
        }).filter(chunk => chunk.tokenCount <= maxTokens).sort((a, b) => a.startPos - b.startPos);
        // Check for no chunks
        if (chunks.length === 0) {
            // Take the top chunk and return a subset of its text
            const topChunk = this._chunks[0];
            const startPos = topChunk.item.metadata.startPos;
            const endPos = topChunk.item.metadata.endPos;
            const chunkText = text.substring(startPos, endPos + 1);
            const tokens = this._tokenizer.encode(chunkText);
            return [{
                text: this._tokenizer.decode(tokens.slice(0, maxTokens)),
                tokenCount: maxTokens,
                score: topChunk.score,
                isBm25: false,
            }];
        }
        // Generate semantic sections
        const sections: Section[] = [];
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            let section = sections[sections.length - 1];
            if (!chunk.isBm25) {
                if (!section || section.tokenCount + chunk.tokenCount > maxTokens) {
                    section = {
                        chunks: [],
                        score: 0,
                        tokenCount: 0
                    };
                    sections.push(section);
                }
                section.chunks.push(chunk);
                section.score += chunk.score;
                section.tokenCount += chunk.tokenCount;
            }
        }
        // Generate bm25 sections
        const bm25Sections: Section[] = [];
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            let section = bm25Sections[bm25Sections.length -

MEMORY:
SOURCE: README.md
DETAILS: # Vectra

Vectra is a local vector database for Node.js with features similar to [Pinecone](https://www.pinecone.io/) or [Qdrant](https://qdrant.tech/) but built using local files. Each Vectra index is a folder on disk. There's an `index.json` file in the folder that contains all the vectors for the index along with any indexed metadata. When you create an index you can specify which metadata properties to index and only those fields will be stored in the `index.json` file. All of the other metadata for an item will be stored on disk in a separate file keyed by a GUID.

When queryng Vectra you'll be able to use the same subset of [Mongo DB query operators](https://www.mongodb.com/docs/manual/reference/operator/query/) that Pinecone supports and the results will be returned sorted by simularity. Every item in the index will first be filtered by metadata and then ranked for simularity. Even though every item is evaluated its all in memory so it should by nearly instantanious. Likely 1ms - 2ms for even a rather large index. Smaller indexes should be <1ms.

Keep in mind that your entire Vectra index is loaded into memory so it's not well suited for scenarios like long term chat bot memory. Use a real vector DB for that. Vectra is intended to be used in scenarios where you have a small corpus of mostly static data that you'd like to include in your prompt. Infinite few shot examples would be a great use case for Vectra or even just a single document you want to ask questions over.

Pinecone style namespaces aren't directly supported but you could easily mimic them by creating a separate Vectra index (and folder) for each namespace.

## Other Language Bindings

This repo contains the TypeScript/JavaScript binding for Vectra but other language bindings are being created. Since Vectra is file based, any language binding can be used to read or write a Vectra index. That means you can build a Vectra index using JS and then read it using Python.

-   [vectra-py](https://github.com/BMS-geodev/vectra-py) - Python version of Vectra.

## Installation

```
$ npm install vectra
```

## Usage

First create an instance of `LocalIndex` with the path to the folder where you want you're items stored:

```typescript
import { LocalIndex } from 'vectra';

const index = new LocalIndex(path.join(__dirname, '..', 'index'));
```

Next, from inside an async function, create your index:

```typescript
if (!(await index.isIndexCreated())) {
    await index.createIndex();
}
```

Add some items to your index:

```typescript
import { OpenAI } from 'openai';

const openai = new OpenAI({
    apiKey: `<YOUR_KEY>`,
});

async function getVector(text: string) {
    const response = await openai.embeddings.create({
        'model': 'text-embedding-ada-002',
        'input': text,
    });
    return response.data[0].embedding;
}

async function addItem(text: string) {
    await index.insertItem({
        vector: await getVector(text),
        metadata: { text },
    });
}

// Add items
await addItem('apple');
await addItem('oranges');
await addItem('red');
await addItem('blue');
```

Then query for items:

```typescript
async function query(text: string) {
    const vector = await getVector(text);
    const results = await index.queryItems(vector, 3);
    if (results.length > 0) {
        for (const result of results) {
            console.log(`[${result.score}] ${result.item.metadata.text}`);
        }
    } else {
        console.log(`No results found.`);
    }
}

await query('green');
/*
[0.9036569942401076] blue
[0.8758153664568566] red
[0.8323828606103998] apple
*/

await query('banana');
/*
[0.9033128691220631] apple
[0.8493374123092652] oranges
[0.8415324469533297] blue
*/
```


MEMORY:
SOURCE: package.json
DETAILS: {
    "name": "vectra",
    "author": "Steven Ickman",
    "description": "A vector database that uses the local file system for storage.",
    "version": "0.12.2",
    "license": "MIT",
    "keywords": [
        "gpt"
    ],
    "bugs": {
        "url": "https://github.com/Stevenic/vectra/issues"
    },
    "repository": {
        "type": "git",
        "url": "https://github.com/Stevenic/vectra.git"
    },
    "main": "./lib/index.js",
    "types": "./lib/index.d.ts",
    "bin": {
        "vectra": "./bin/vectra.js"
    },
    "engines": {
        "node": ">=20.x"
    },
    "typesVersions": {
        "<3.9": {
            "*": [
                "_ts3.4/*"
            ]
        }
    },
    "dependencies": {
        "axios": "^1.9.0",
        "cheerio": "^1.0.0",
        "dotenv": "^16.5.0",
        "gpt-tokenizer": "^3.4.0",
        "json-colorizer": "^3.0.1",
        "openai": "^4.97.0",
        "turndown": "^7.2.0",
        "uuid": "^11.1.0",
        "wink-bm25-text-search": "^3.1.2",
        "wink-nlp": "^2.3.2",
        "yargs": "^17.7.2"
    },
    "resolutions": {},
    "devDependencies": {
        "@types/assert": "^1.5.11",
        "@types/mocha": "^10.0.10",
        "@types/node": "^22.15.11",
        "@types/sinon": "^21.0.0",
        "@types/turndown": "^5.0.5",
        "@types/uuid": "10.0.0",
        "@types/yargs": "17.0.33",
        "mocha": "11.2.2",
        "npm-run-all": "^4.1.5",
        "nyc": "^17.1.0",
        "rimraf": "^5.0.1",
        "shx": "^0.4.0",
        "sinon": "^21.0.1",
        "ts-mocha": "11.1.0",
        "ts-node": "^10.9.1",
        "typescript": "^5.8.3",
        "wink-bm25-text-search": "^3.1.2"
    },
    "scripts": {
        "build": "tsc -b",
        "build-docs": "typedoc --theme markdown --entryPoint botbuilder-m365 --excludePrivate --includeDeclarations --ignoreCompilerErrors --module amd --out ..\\..\\doc\\botbuilder-ai .\\lib\\index.d.ts --hideGenerator --name \"Bot Builder SDK - AI\" --readme none",
        "build:rollup": "yarn clean && yarn build && api-extractor run --verbose --local",
        "clean": "rimraf _ts3.4 lib tsconfig.tsbuildinfo node_modules",
        "depcheck": "depcheck --config ../../.depcheckrc",
        "lint": "eslint **/src/**/*.{j,t}s{,x} --fix --no-error-on-unmatched-pattern",
        "test": "npm-run-all build test:mocha",
        "test:mocha": "nyc ts-mocha src/**/*.spec.ts --timeout 10000",
        "test:compat": "api-extractor run --verbose"
    },
    "files": [
        "_ts3.4",
        "lib",
        "src"
    ],
    "packageManager": "yarn@1.22.22+sha512.a6b2f7906b721bba3d67d4aff083df04dad64c399707841b7acf00f6b133b7ac24255f2652fa22ae3534329dc6180534e98d17432037ff6fd140556e2bb3137e"
}


MEMORY:
SOURCE: src\vectra-cli.ts
DETAILS: import * as fs from 'fs/promises';
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { LocalDocumentIndex } from "./LocalDocumentIndex";
import { WebFetcher } from './WebFetcher';
import { AzureOpenAIEmbeddingsOptions, OSSEmbeddingsOptions, OpenAIEmbeddings, OpenAIEmbeddingsOptions } from './OpenAIEmbeddings';
import { Colorize } from './internals';
import { FileFetcher } from './FileFetcher';
export async function run() {
    // prettier-ignore
    const args = await yargs(hideBin(process.argv))
        .scriptName('vectra')
        .command('create <index>', `create a new local index`, {}, async (args) => {
            const folderPath = args.index as string;
            const index = new LocalDocumentIndex({ folderPath });
            console.log(Colorize.output(`creating index at ${folderPath}`));
            await index.createIndex({ version: 1, deleteIfExists: true });
        .command('delete <index>', `delete an existing local index`, {}, async (args) => {
            const folderPath = args.index as string;
            console.log(Colorize.output(`deleting index at ${folderPath}`));
            const index = new LocalDocumentIndex({ folderPath });
            await index.deleteIndex();
        .command('add <index>', `adds one or more web pages to an index`, (yargs) => {
            return yargs
                .option('keys', {
                    alias: 'k',
                    describe: 'path of a JSON file containing the model keys to use for generating embeddings',
                    type: 'string'
                .option('uri', {
                    alias: 'u',
                    array: true,
                    describe: 'http/https link to a web page to add',
                    type: 'string'
                .option('list', {
                    alias: 'l',
                    describe: 'path to a file containing a list of web pages to add',
                    type: 'string'
                .option('cookie', {
                    alias: 'c',
                    describe: 'optional cookies to add to web fetch requests',
                    type: 'string'
                .option('chunk-size', {
                    alias: 'cs',
                    describe: 'size of the generated chunks in tokens (defaults to 512)',
                    type: 'number',
                    default: 512
                .check((argv) => {
                    if (Array.isArray(argv.uri) && argv.uri.length > 0) {
                        return true;
                    } else if (typeof argv.list == 'string' && argv.list.trim().length > 0) {
                        return true;
                    } else {
                        throw new Error(`you must specify either one or more "--uri <link>" for the pages to add or a "--list <file path>" for a file containing the list of pages to add.`);
                .demandOption(['keys']);
        }, async (args) => {
            console.log(Colorize.title('Adding Web Pages to Index'));
            // Get embedding options
            const options: OpenAIEmbeddingsOptions|AzureOpenAIEmbeddingsOptions|OSSEmbeddingsOptions = JSON.parse(await fs.readFile(args.keys as string, 'utf-8'));
            if ((options as OpenAIEmbeddingsOptions).apiKey && !(options as OpenAIEmbeddingsOptions).model) {
                (options as OpenAIEmbeddingsOptions).model = 'text-embedding-ada-002';
                (options as OpenAIEmbeddingsOptions).maxTokens = 8000;
            // Create embeddings
            const embeddings = new OpenAIEmbeddings(options);
            // Initialize index
            const folderPath = args.index as string;
            const index = new LocalDocumentIndex({
                folderPath,
                embeddings,
                chunkingConfig: {
                    chunkSize: args.chunkSize
            // Get list of url's
            const uris = await getItemList(args.uri as string[], args.list as string, 'web page');
            // Fetch documents
            const fileFetcher = new FileFetcher();
            const webFetcher = args.cookie ? new WebFetcher({ headers: { "cookie": args.cookie }}) : new WebFetcher();
            for (const path of uris) {
                try {
                    console.log(Colorize.progress(`fetching ${path}`));
                    const fetcher = path.startsWith('http') ? webFetcher : fileFetcher;
                    await fetcher.fetch(path, async (uri, text, docType) => {
                        console.log(Colorize.replaceLine(Colorize.progress(`indexing ${uri}`)));
                        await index.upsertDocument(uri, text, docType);
                        console.log(Colorize.replaceLine(Colorize.success(`added ${uri}`)));
                        return true;
                } catch (err: unknown) {
                    console.log(Colorize.replaceLine(Colorize.error(`Error adding: ${path}\n${(err as Error).message}`)));
        .command('remove <index>', `removes one or more documents from an index`, (yargs) => {
            return yargs
                .option('uri', {
                    alias: 'u',
                    array: true,
                    describe: 'uri of a document to remove',
                    type: 'string'
                .option('list', {
                    alias: 'l',
                    describe: 'path to a file containing a list of documents to remove',
                    type: 'string'
                .check((argv) => {
                    if (Array.isArray(argv.uri) && argv.uri.length > 0) {
                        return true;
                    } else if (typeof argv.list == 'string' && argv.list.trim().length > 0) {
                        return true;
                    } else {
                        throw new Error(`you must specify either one or more "--uri <link>" for the pages to add or a "--list <file path>" for a file containing the list of pages to add.`);
        }, async (args) => {
            // Initialize index
            const folderPath = args.index as string;
            const index = new LocalDocumentIndex({ folderPath });
            // Get list of uri's
            const uris = await getItemList(args.uri as string[], args.list as string, 'document');
            // Remove documents
            for (const uri of uris) {
                console.log(`removing ${uri}`);
                await index.deleteDocument(uri);
        .command('stats <index>', `prints the stats for a local index`, {}, async (args) => {
            const folderPath = args.index as string;
            const index = new LocalDocumentIndex({ folderPath });
            const stats = await index.getCatalogStats();
            console.log(Colorize.title('Index Stats'));
            console.log(Colorize.output(stats));
        .command('query <index> <query>', `queries a local index`, (yargs) => {
            return yargs
                .option('keys', {
                    alias: 'k',
                    describe: 'path of a JSON file containing the model keys to use for generating embeddings'
                .option('document-count', {
                    alias: 'dc',
                    describe: 'max number of documents to return (defaults to 10)',
                    type: 'number',
                    default: 10
                .option('chunk-count', {
                    alias: 'cc',
                    describe: 'max number of chunks to return (defaults to 50)',
                    type: 'number',
                    default: 50
                .option('section-count', {
                    alias: 'sc',
                    describe: 'max number of document sections to render (defaults to 1)',
                    type: 'number',
                    default: 1
                .option('tokens', {
                    alias: 't',
                    describe: 'max number of tokens to render for each document section (defaults to 2000)',
                    type: 'number',
                    default: 2000
                .option('format', {
                    alias: 'f',
                    describe: `format of the rendered results. Defaults to 'sections'`,
                    choices: ['sections', 'stats', 'chunks'],
                    default: 'sections'
                .option('overlap', {
                    alias: 'o',
                    describe: `whether to add overlapping chunks to sections.`,
                    type: 'boolean',
                    default: true
                .option('bm25', {
                    alias: 'b',
                    describe: 'Use Okapi-bm25 keyword search alogrithm to perform hybrid search - semantic + keyword. Displayed in blue during search.',
                    type: 'boolean',
                    default: false      
                .demandOption(['keys']);
        }, async (args) => {
            console.log(Colorize.title('Querying Index'));
            // Get embedding options
            const options: OpenAIEmbeddingsOptions|AzureOpenAIEmbeddingsOptions|OSSEmbeddingsOptions = JSON.parse(await fs.readFile(args.keys as string, 'utf-8'));
            if ((options as OpenAIEmbeddingsOptions).apiKey && !(options as OpenAIEmbeddingsOptions).model) {
                (options as OpenAIEmbeddingsOptions).model = 'text-embedding-ada-002';
                (options as OpenAIEmbeddingsOptions).maxTokens = 8000;
            // Create embeddings
            const embeddings = new OpenAIEmbeddings(options);
            // Initialize index
            const folderPath = args.index as string;
            const index = new LocalDocumentIndex({
                folderPath,
                embeddings
            // Query index
            const query = args.query as string;
            const results = await index.queryDocuments(query, {
                maxDocuments: args.documentCount,
                maxChunks: args.chunkCount,
                isBm25: args.bm25 as boolean,
            // Render results
            for (const result of results) {
                console.log(Colorize.output(result.uri));
                console.log(Colorize.value('score', result.score));
                console.log(Colorize.value('chunks', result.chunks.length));
                if (args.format == 'sections') {
                    const sections = await result.renderSections(args.tokens, args.sectionCount, args.overlap);
                    console.log(sections.length);
                    for (let i = 0; i < sections.length; i++) {
                        const section = sections[i];
                        const isBm25 = sections[i].isBm25;
                        console.log(isBm25);
                        console.log(Colorize.title(args.sectionCount == 1 ? 'Section' : `Section ${i + 1}`));
                        console.log(Colorize.value('score', section.score));
                        console.log(Colorize.value('tokens', section.tokenCount));
                        console.log(Colorize.output(section.text, isBm25));
                } else if (args.format == 'chunks') {
                    const text = await result.loadText();
                    for (let i = 0; i < result.chunks.length; i++) {
                        const chunk = result.chunks[i];
                        const startPos = chunk.item.metadata.startPos;
                        const endPos = chunk.item.metadata.endPos;
                        const isBm25 = Boolean(chunk.item.metadata.isBm25);
                        console.log(Colorize.title(`Chunk ${i + 1}`));
                        console.log(Colorize.value('score', chunk.score));
                        console.log(Colorize.value('startPos', startPos));
                        console.log(Colorize.value('endPos', endPos));
                        console.log(Colorize.output(text.substring(startPos, endPos + 1), isBm25));
        .help()
        .demandCommand()
        .parseAsync();
async function getItemList(items: string[], listFile: string, uriType: string): Promise<string[]> {
    if (Array.isArray(items) && items.length > 0) {
        return items;
    } else if (typeof listFile == 'string' && listFile.trim().length > 0) {
        const list = await fs.readFile(listFile, 'utf-8');
        return list.split('\n').map((item) => item.trim()).filter((item) => item.length > 0);
    } else {
        throw new Error(`you must specify either one or more "--uri <${uriType}>" for the items or a "--list <file path>" for a file containing the items.`)


MEMORY:
SOURCE: CONTRIBUTING.md
DETAILS: # Contribution Guidelines

## 1. Introduction

Thank you for your interest in contributing to Vectra! This project is an open-source local vector database for Node.js, licensed under the MIT License. These guidelines are intended to help you understand how to contribute effectively, maintain code quality, and foster a welcoming and productive community. Please read them carefully before making contributions.

## 2. Code of Conduct

All contributors are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it to understand the standards of behavior expected in this community.

## 3. How to Contribute

### Reporting Bugs

- If you find a bug, please [open an issue](https://github.com/Stevenic/vectra/issues) and provide as much detail as possible, including steps to reproduce, expected behavior, and your environment (Node.js version, OS, etc.).

### Suggesting Enhancements

- To suggest a new feature or enhancement, [open an issue](https://github.com/Stevenic/vectra/issues) and describe your idea clearly. Include your use case and any relevant examples.

### Submitting Pull Requests

- Fork the repository and create your branch from `main`.
- Make your changes in a logical, self-contained commit.
- Ensure your code follows the project’s coding standards and passes all tests.
- Submit a pull request (PR) with a clear description of your changes and reference any related issues.

## 4. Development Setup

### Prerequisites

- **Node.js**: Version 20.x or higher is required.
- **Package Manager**: [Yarn](https://classic.yarnpkg.com/en/docs/install/) is recommended (see `packageManager` in `package.json`).

### Installation Steps

1. **Clone the repository:**
    ```sh
    git clone https://github.com/Stevenic/vectra.git
    cd vectra
    ```

2. **Install dependencies:**
    ```sh
    yarn install
    ```

### Running Tests and Linting

- **Build the project:**
    ```sh
    yarn build
    ```

- **Run tests:**
    ```sh
    yarn test
    ```

- **Run linter and auto-fix issues:**
    ```sh
    yarn lint
    ```

## 5. Coding Standards

### Code Style and Formatting

- Use consistent code style as enforced by the linter (`yarn lint`).
- Prefer TypeScript for all source files.
- Follow the existing file and folder structure in the `src/` directory.

### Commit Message Guidelines

- Write clear, concise commit messages.
- Use the present tense (“Add feature” not “Added feature”).
- Reference issues or PRs when relevant (e.g., `Fix #123: Correct vector normalization`).

### File and Folder Structure

- Place all source code in the `src/` directory.
- Tests should be placed alongside source files as a `*.spec.ts` file.
- Keep documentation and configuration files in the project root or as specified by existing structure.

## 6. Pull Request Process

### Branching Model

- Create a feature or fix branch from `main` (e.g., `feature/add-metadata-filter` or `fix/vector-similarity-bug`).
- Keep your branch focused on a single topic or issue.

### How to Submit a Pull Request

1. Push your branch to your forked repository.
2. Open a pull request (PR) against the `main` branch of the upstream repository.
3. Provide a clear and descriptive title and summary for your PR.
4. Reference any related issues by number (e.g., `Closes #45`).

### Review Process

- All PRs will be reviewed by maintainers or other contributors.
- Address any requested changes and update your PR as needed.
- PRs must pass all tests and linting checks before being merged.
- Once approved, a maintainer will merge your PR.

## 7. Testing

### How to Run Tests

- To run the full test suite, use:
    ```sh
    yarn test
    ```
- This will build the project and run all tests using Mocha and NYC for coverage.

### Writing New Tests

- Add new tests for any new features or bug fixes.
- Place test files alongside the relevant source files or in the `src/` directory with a `.spec.ts` suffix.
- Use [Mocha](https://mochajs.org/) and [Sinon](https://sinonjs.org/) for writing and mocking in tests.
- Ensure all tests pass before submitting a pull request.

## 8. Documentation

### Updating/Adding Documentation

- Update the `README.md` or other relevant documentation files when you add features or make changes.
- Ensure that usage examples and API references are clear and accurate.

### Generating API Docs

- API documentation can be generated using [TypeDoc](https://typedoc.org/).
- To generate docs, run:
    ```sh
    yarn build-docs
    ```
- Generated documentation will be output as specified in the `build-docs` script in `package.json`.

## 9. License

By contributing to this project, you agree that your contributions will be licensed under the [MIT License](LICENSE). Please ensure that you have the right to submit your code and that it does not violate any third-party licenses or agreements.

## 10. Contact

If you have questions, need help, or want to discuss ideas, please open an issue on [GitHub](https://github.com/Stevenic/vectra/issues). For sensitive matters, you may contact the maintainer at ickman@gmail.com.

## 11. Acknowledgements

- Vectra is inspired by other vector databases such as [Pinecone](https://www.pinecone.io/) and [Qdrant](https://qdrant.tech/).
- Portions of this project and its documentation may reuse or adapt content and tools from the open-source community. See individual files for additional attributions where applicable.