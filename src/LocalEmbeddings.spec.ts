import * as assert from 'assert';
import * as sinon from 'sinon';
import { LocalEmbeddings } from './LocalEmbeddings';

describe('LocalEmbeddings', () => {
    let requireStub: sinon.SinonStub;
    let fakePipeline: sinon.SinonStub;
    let fakePipelineFn: sinon.SinonStub;

    beforeEach(() => {
        // Create a fake pipeline function that returns tensor-like results
        fakePipelineFn = sinon.stub();
        fakePipeline = sinon.stub().resolves(fakePipelineFn);

        // Stub require to intercept @huggingface/transformers
        requireStub = sinon.stub(module.constructor.prototype, 'require');
        requireStub.callThrough(); // Allow all other requires to pass through
        requireStub.withArgs('@huggingface/transformers').returns({
            pipeline: fakePipeline,
        });
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('constructor', () => {
        it('should use default model and maxTokens', () => {
            const embeddings = new LocalEmbeddings();
            assert.strictEqual(embeddings.model, 'Xenova/all-MiniLM-L6-v2');
            assert.strictEqual(embeddings.maxTokens, 256);
        });

        it('should accept custom model name', () => {
            const embeddings = new LocalEmbeddings({ model: 'custom/model' });
            assert.strictEqual(embeddings.model, 'custom/model');
        });

        it('should accept custom maxTokens', () => {
            const embeddings = new LocalEmbeddings({ maxTokens: 512 });
            assert.strictEqual(embeddings.maxTokens, 512);
        });
    });

    describe('createEmbeddings', () => {
        it('should create embeddings for a single string input', async () => {
            const fakeVector = new Float32Array([0.1, 0.2, 0.3]);
            fakePipelineFn.resolves({ data: fakeVector });

            const embeddings = new LocalEmbeddings();
            const result = await embeddings.createEmbeddings('hello world');

            assert.strictEqual(result.status, 'success');
            assert.ok(result.output);
            assert.strictEqual(result.output!.length, 1);
            assert.deepStrictEqual(result.output![0], [0.10000000149011612, 0.20000000298023224, 0.30000001192092896]);
        });

        it('should create embeddings for an array of inputs', async () => {
            const vec1 = new Float32Array([0.1, 0.2, 0.3]);
            const vec2 = new Float32Array([0.4, 0.5, 0.6]);
            fakePipelineFn.onFirstCall().resolves({ data: vec1 });
            fakePipelineFn.onSecondCall().resolves({ data: vec2 });

            const embeddings = new LocalEmbeddings();
            const result = await embeddings.createEmbeddings(['hello', 'world']);

            assert.strictEqual(result.status, 'success');
            assert.ok(result.output);
            assert.strictEqual(result.output!.length, 2);
        });

        it('should call pipeline with mean pooling and normalize', async () => {
            const fakeVector = new Float32Array([0.5, 0.5]);
            fakePipelineFn.resolves({ data: fakeVector });

            const embeddings = new LocalEmbeddings();
            await embeddings.createEmbeddings('test');

            assert.ok(fakePipelineFn.calledOnce);
            const [input, options] = fakePipelineFn.firstCall.args;
            assert.strictEqual(input, 'test');
            assert.deepStrictEqual(options, { pooling: 'mean', normalize: true });
        });

        it('should initialize the pipeline with correct model name', async () => {
            const fakeVector = new Float32Array([0.5]);
            fakePipelineFn.resolves({ data: fakeVector });

            const embeddings = new LocalEmbeddings({ model: 'my/model' });
            await embeddings.createEmbeddings('test');

            assert.ok(fakePipeline.calledOnce);
            const [task, model] = fakePipeline.firstCall.args;
            assert.strictEqual(task, 'feature-extraction');
            assert.strictEqual(model, 'my/model');
        });

        it('should reuse the pipeline across calls', async () => {
            const fakeVector = new Float32Array([0.5]);
            fakePipelineFn.resolves({ data: fakeVector });

            const embeddings = new LocalEmbeddings();
            await embeddings.createEmbeddings('first');
            await embeddings.createEmbeddings('second');

            // Pipeline should only be created once
            assert.ok(fakePipeline.calledOnce);
            // But the pipeline function should be called twice
            assert.strictEqual(fakePipelineFn.callCount, 2);
        });

        it('should return error status when pipeline fails', async () => {
            fakePipelineFn.rejects(new Error('Model not found'));

            const embeddings = new LocalEmbeddings();
            const result = await embeddings.createEmbeddings('test');

            assert.strictEqual(result.status, 'error');
            assert.ok(result.message);
            assert.ok(result.message!.includes('Model not found'));
        });
    });

    describe('optional dependency', () => {
        it('should return error when @huggingface/transformers is not installed', async () => {
            requireStub.withArgs('@huggingface/transformers').throws(new Error('Cannot find module'));

            const embeddings = new LocalEmbeddings();
            const result = await embeddings.createEmbeddings('test');

            assert.strictEqual(result.status, 'error');
            assert.ok(result.message);
            assert.ok(result.message!.includes('@huggingface/transformers'));
            assert.ok(result.message!.includes('npm install'));
        });
    });
});
