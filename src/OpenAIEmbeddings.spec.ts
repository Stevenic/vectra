import assert from 'node:assert';
import sinon from 'sinon';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  OpenAIEmbeddings,
  AzureOpenAIEmbeddingsOptions,
  OSSEmbeddingsOptions,
  OpenAIEmbeddingsOptions
} from './OpenAIEmbeddings';
import { Colorize } from './internals';

describe('OpenAIEmbeddings', () => {
  let sandbox: sinon.SinonSandbox;
  let postStub: sinon.SinonStub;
  let createdConfig: any;

  function makeAxiosResponse<T>(status: number, data: any, statusText = ''): AxiosResponse<T> {
    return {
      status,
      data,
      statusText,
      headers: {},
      config: {} as any,
      request: {} as any
    } as AxiosResponse<T>;
  }

  const successData = {
    object: 'list',
    model: 'any',
    data: [
      { index: 0, object: 'embedding', embedding: [0.1, 0.2] }
    ],
    usage: { prompt_tokens: 1, total_tokens: 1 }
  };

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    postStub = sandbox.stub();
    createdConfig = undefined;

    sandbox.stub(axios, 'create').callsFake((config: any) => {
      createdConfig = config;
      const instance = { post: postStub } as unknown as AxiosInstance;
      return instance;
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('constructs axios client with validateStatus allowing <400 and 429', () => {
    const inst = new OpenAIEmbeddings({
      apiKey: 'sk',
      model: 'm'
    } as OpenAIEmbeddingsOptions);

    assert.ok(inst); // sanity
    assert.ok(createdConfig && typeof createdConfig.validateStatus === 'function');
    assert.strictEqual(createdConfig.validateStatus(200), true);
    assert.strictEqual(createdConfig.validateStatus(399), true);
    assert.strictEqual(createdConfig.validateStatus(400), false);
    assert.strictEqual(createdConfig.validateStatus(429), true);
    assert.strictEqual(createdConfig.validateStatus(500), false);
  });

  it('Azure: trims trailing slash, enforces https, defaults apiVersion and maxTokens', () => {
    const inst = new OpenAIEmbeddings({
      azureApiKey: 'key',
      azureEndpoint: 'https://example.com/',
      azureDeployment: 'dep'
    } as AzureOpenAIEmbeddingsOptions);

    const opts = (inst as any).options as AzureOpenAIEmbeddingsOptions;
    assert.strictEqual(opts.azureEndpoint, 'https://example.com');
    assert.strictEqual(opts.azureApiVersion, '2023-05-15');
    assert.strictEqual(inst.maxTokens, 500);

    // Private enum: ClientType.AzureOpenAI == 1
    assert.strictEqual((inst as any)._clientType, 1);
  });

  it('Azure: throws for non-https endpoint', () => {
    assert.throws(() => {
      new OpenAIEmbeddings({
        azureApiKey: 'key',
        azureEndpoint: 'http://example.com',
        azureDeployment: 'dep'
      } as AzureOpenAIEmbeddingsOptions);
    }, /Client created with an invalid endpoint of 'http:\/\/example.com'. The endpoint must be a valid HTTPS url\./);
  });

  it('OSS: selects OSS client type, defaults retryPolicy, respects maxTokens', () => {
    const inst = new OpenAIEmbeddings({
      ossModel: 'oss-emb',
      ossEndpoint: 'https://oss.example.com',
      maxTokens: 1234
    } as OSSEmbeddingsOptions);

    const opts = (inst as any).options as OSSEmbeddingsOptions;
    assert.deepStrictEqual(opts.retryPolicy, [2000, 5000]);
    assert.strictEqual(inst.maxTokens, 1234);

    // Private enum: ClientType.OSS == 2
    assert.strictEqual((inst as any)._clientType, 2);
  });

  it('OpenAI: selects OpenAI client type and defaults retryPolicy', () => {
    const inst = new OpenAIEmbeddings({
      apiKey: 'sk',
      model: 'text-embedding-3-small'
    } as OpenAIEmbeddingsOptions);

    const opts = (inst as any).options as OpenAIEmbeddingsOptions;
    assert.deepStrictEqual(opts.retryPolicy, [2000, 5000]);

    // Private enum: ClientType.OpenAI == 0
    assert.strictEqual((inst as any)._clientType, 0);
  });

  it('Azure: URL formation and dimensions passthrough', async () => {
    postStub.resolves(makeAxiosResponse(200, successData));

    const inst = new OpenAIEmbeddings({
      azureApiKey: 'key',
      azureEndpoint: 'https://example.com/',
      azureDeployment: 'dep',
      dimensions: 256
    } as AzureOpenAIEmbeddingsOptions);

    await inst.createEmbeddings('hello');

    // capture args to _httpClient.post(url, body, config)
    const [url, body] = postStub.getCall(0).args;
    assert.strictEqual(url, 'https://example.com/openai/deployments/dep/embeddings?api-version=2023-05-15');
    assert.strictEqual(body.input, 'hello');
    assert.strictEqual(body.dimensions, 256);
  });

  it('OSS: URL formation and model injection', async () => {
    postStub.resolves(makeAxiosResponse(200, successData));

    const inst = new OpenAIEmbeddings({
      ossModel: 'oss-emb',
      ossEndpoint: 'https://oss.example.com'
    } as OSSEmbeddingsOptions);

    await inst.createEmbeddings('text');
    const [url, body] = postStub.getCall(0).args;
    assert.strictEqual(url, 'https://oss.example.com/v1/embeddings');
    assert.strictEqual(body.input, 'text');
    assert.strictEqual(body.model, 'oss-emb');
  });

  it('OpenAI: URL formation (default endpoint) and model injection', async () => {
    postStub.resolves(makeAxiosResponse(200, successData));

    const inst = new OpenAIEmbeddings({
      apiKey: 'sk',
      model: 'm'
    } as OpenAIEmbeddingsOptions);

    await inst.createEmbeddings('x');
    const [url, body] = postStub.getCall(0).args;
    assert.strictEqual(url, 'https://api.openai.com/v1/embeddings');
    assert.strictEqual(body.model, 'm');
  });

  it('OpenAI: URL formation (custom endpoint)', async () => {
    postStub.resolves(makeAxiosResponse(200, successData));

    const inst = new OpenAIEmbeddings({
      apiKey: 'sk',
      model: 'm',
      endpoint: 'https://custom'
    } as OpenAIEmbeddingsOptions);

    await inst.createEmbeddings('x');
    const [url] = postStub.getCall(0).args;
    assert.strictEqual(url, 'https://custom/v1/embeddings');
  });

  it('Azure: headers include Content-Type, User-Agent, api-key', async () => {
    postStub.resolves(makeAxiosResponse(200, successData));

    const inst = new OpenAIEmbeddings({
      azureApiKey: 'key',
      azureEndpoint: 'https://example.com/',
      azureDeployment: 'dep'
    } as AzureOpenAIEmbeddingsOptions);

    await inst.createEmbeddings('x');
    const [, , config] = postStub.getCall(0).args;
    assert.strictEqual(config.headers['Content-Type'], 'application/json');
    assert.strictEqual(config.headers['User-Agent'], 'AlphaWave');
    assert.strictEqual(config.headers['api-key'], 'key');
  });

  it('OpenAI: headers include Authorization and OpenAI-Organization when provided', async () => {
    postStub.resolves(makeAxiosResponse(200, successData));

    const inst = new OpenAIEmbeddings({
      apiKey: 'sk',
      model: 'm',
      organization: 'org1'
    } as OpenAIEmbeddingsOptions);

    await inst.createEmbeddings('x');
    const [, , config] = postStub.getCall(0).args;
    assert.strictEqual(config.headers['Authorization'], 'Bearer sk');
    assert.strictEqual(config.headers['OpenAI-Organization'], 'org1');
  });

  it('Respects pre-supplied headers from requestConfig and does not overwrite them', async () => {
    postStub.resolves(makeAxiosResponse(200, successData));

    const inst = new OpenAIEmbeddings({
      apiKey: 'sk',
      model: 'm',
      requestConfig: {
        headers: {
          'Content-Type': 'application/x-custom',
          'User-Agent': 'MyUA',
          'X-Custom': '1'
        }
      }
    } as OpenAIEmbeddingsOptions);

    await inst.createEmbeddings('x');
    const [, , config] = postStub.getCall(0).args;

    assert.strictEqual(config.headers['Content-Type'], 'application/x-custom'); // preserved
    assert.strictEqual(config.headers['User-Agent'], 'MyUA'); // preserved
    assert.strictEqual(config.headers['X-Custom'], '1'); // preserved
    assert.strictEqual(config.headers['Authorization'], 'Bearer sk'); // added
  });

  it('429 retry path obeys retryPolicy delays and eventually succeeds', async () => {
    const clock = sandbox.useFakeTimers();

    const resp429 = makeAxiosResponse(429, {} as any);
    const resp200 = makeAxiosResponse(200, successData);

    postStub.onCall(0).resolves(resp429);
    postStub.onCall(1).resolves(resp429);
    postStub.onCall(2).resolves(resp200);

    const inst = new OpenAIEmbeddings({
      apiKey: 'sk',
      model: 'm',
      retryPolicy: [10, 20]
    } as OpenAIEmbeddingsOptions);

    const p = inst.createEmbeddings('x');
    await clock.tickAsync(10);
    await clock.tickAsync(20);
    const result = await p;

    assert.strictEqual(postStub.callCount, 3);
    assert.strictEqual(result.status, 'success');

    clock.restore();
  });

  it('429 with empty retryPolicy returns rate_limited', async () => {
    const resp429 = makeAxiosResponse(429, {} as any);
    postStub.resolves(resp429);

    const inst = new OpenAIEmbeddings({
      apiKey: 'sk',
      model: 'm',
      retryPolicy: []
    } as OpenAIEmbeddingsOptions);

    const result = await inst.createEmbeddings('x');
    assert.strictEqual(result.status, 'rate_limited');
    assert.ok((result.message || '').includes('rate limit'));
  });

  it('Success maps embeddings sorted by index', async () => {
    const data = {
      object: 'list',
      model: 'any',
      data: [
        { index: 2, object: 'embedding', embedding: [3] },
        { index: 0, object: 'embedding', embedding: [1] },
        { index: 1, object: 'embedding', embedding: [2] }
      ],
      usage: { prompt_tokens: 1, total_tokens: 1 }
    };
    postStub.resolves(makeAxiosResponse(200, data));

    const inst = new OpenAIEmbeddings({
      apiKey: 'sk',
      model: 'm'
    } as OpenAIEmbeddingsOptions);

    const result = await inst.createEmbeddings(['a', 'b', 'c']);
    assert.strictEqual(result.status, 'success');
    assert.deepStrictEqual(result.output, [[1], [2], [3]]);
  });

  it('Non-429 error returns status error with message', async () => {
    postStub.resolves(makeAxiosResponse(500, {} as any, 'Internal Server Error'));

    const inst = new OpenAIEmbeddings({
      apiKey: 'sk',
      model: 'm'
    } as OpenAIEmbeddingsOptions);

    const result = await inst.createEmbeddings('x');
    assert.strictEqual(result.status, 'error');
    assert.strictEqual(result.message, 'The embeddings API returned an error status of 500: Internal Server Error');
  });

  it('logRequests true logs request and response details', async () => {
    postStub.resolves(makeAxiosResponse(200, successData));
    const logSpy = sandbox.stub(console, 'log');

    const inst = new OpenAIEmbeddings({
      apiKey: 'sk',
      model: 'm',
      logRequests: true
    } as OpenAIEmbeddingsOptions);

    await inst.createEmbeddings('x');

    assert.ok(logSpy.callCount >= 4);
  });

  it('Input handling: string preserved in body', async () => {
    postStub.resolves(makeAxiosResponse(200, successData));

    const inst = new OpenAIEmbeddings({
      apiKey: 'sk',
      model: 'm'
    } as OpenAIEmbeddingsOptions);

    await inst.createEmbeddings('hello');
    const [, body] = postStub.getCall(0).args;
    assert.strictEqual(body.input, 'hello');
  });

  it('Input handling: string[] preserved in body', async () => {
    postStub.resolves(makeAxiosResponse(200, successData));

    const inst = new OpenAIEmbeddings({
      apiKey: 'sk',
      model: 'm'
    } as OpenAIEmbeddingsOptions);

    await inst.createEmbeddings(['a', 'b']);
    const [, body] = postStub.getCall(0).args;
    assert.deepStrictEqual(body.input, ['a', 'b']);
  });

  it('maxTokens default and override', () => {
    const instDefault = new OpenAIEmbeddings({
      apiKey: 'sk',
      model: 'm'
    } as OpenAIEmbeddingsOptions);
    assert.strictEqual(instDefault.maxTokens, 500);

    const instOverride = new OpenAIEmbeddings({
      apiKey: 'sk',
      model: 'm',
      maxTokens: 1024
    } as OpenAIEmbeddingsOptions);
    assert.strictEqual(instOverride.maxTokens, 1024);
  });
});