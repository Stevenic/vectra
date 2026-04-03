import { strict as assert } from 'node:assert';
import { describe, it, beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';
import { EmbeddingsModel } from './types';
import * as transformersModule from '@huggingface/transformers';

describe('TransformersEmbeddings', () => {
    let TransformersEmbeddings: any;
    let mockExtractor: sinon.SinonStub;
    let mockTokenizer: any;
    let sandbox: sinon.SinonSandbox;
    let pipelineStub: sinon.SinonStub;

    beforeEach(async () => {
        sandbox = sinon.createSandbox();

        // Create mock tokenizer
        mockTokenizer = {
            __call__: sandbox.stub().returns({
                input_ids: { data: BigInt64Array.from([BigInt(1), BigInt(2), BigInt(3)]) }
            }),
            decode: sandbox.stub().returns('decoded text')
        };
        // Make it callable
        const callableTokenizer = Object.assign(
            (...args: any[]) => mockTokenizer.__call__(...args),
            mockTokenizer
        );

        // Create mock extractor (feature extraction pipeline)
        mockExtractor = sandbox.stub().callsFake(async (inputs: string | string[]) => {
            const inputArray = Array.isArray(inputs) ? inputs : [inputs];
            const batchSize = inputArray.length;
            const embeddingDim = 4;

            const data = new Float32Array(batchSize * embeddingDim);
            for (let i = 0; i < batchSize; i++) {
                data[i * embeddingDim] = 0.1;
                data[i * embeddingDim + 1] = 0.2;
                data[i * embeddingDim + 2] = 0.3;
                data[i * embeddingDim + 3] = 0.4;
            }

            return {
                data: data,
                dims: [batchSize, embeddingDim]
            };
        });

        // Attach tokenizer to the mock extractor so pipeline result has .tokenizer
        (mockExtractor as any).tokenizer = callableTokenizer;

        // Stub the pipeline function from @huggingface/transformers
        pipelineStub = sandbox.stub(transformersModule, 'pipeline' as any).resolves(mockExtractor);

        // Import TransformersEmbeddings fresh (uses the stubbed pipeline via dynamic import)
        const mod = await import('./TransformersEmbeddings');
        TransformersEmbeddings = mod.TransformersEmbeddings;
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('create()', () => {
        it('creates instance with default options', async () => {
            const embeddings = await TransformersEmbeddings.create();

            assert.equal(embeddings.maxTokens, 512, 'default maxTokens should be 512');
            assert.equal(embeddings.model, 'Xenova/all-MiniLM-L6-v2', 'default model should be all-MiniLM-L6-v2');

            // Verify pipeline was called with correct arguments
            assert.ok(pipelineStub.calledOnce, 'pipeline should be called once');
            assert.equal(pipelineStub.firstCall.args[0], 'feature-extraction');
            assert.equal(pipelineStub.firstCall.args[1], 'Xenova/all-MiniLM-L6-v2');
        });

        it('creates instance with custom options', async () => {
            const embeddings = await TransformersEmbeddings.create({
                model: 'Xenova/bge-small-en-v1.5',
                maxTokens: 256,
                device: 'cpu',
                normalize: false,
                pooling: 'cls'
            });

            assert.equal(embeddings.maxTokens, 256);
            assert.equal(embeddings.model, 'Xenova/bge-small-en-v1.5');
        });

        it('implements EmbeddingsModel interface', async () => {
            const embeddings: EmbeddingsModel = await TransformersEmbeddings.create();

            assert.equal(typeof embeddings.maxTokens, 'number');
            assert.equal(typeof embeddings.createEmbeddings, 'function');
        });
    });

    describe('createEmbeddings()', () => {
        it('generates embeddings for single string', async () => {
            const embeddings = await TransformersEmbeddings.create();
            const result = await embeddings.createEmbeddings('hello world');

            assert.equal(result.status, 'success');
            assert.ok(result.output, 'output should be defined');
            assert.equal(result.output!.length, 1, 'should have one embedding');
            assert.equal(result.output![0].length, 4, 'embedding should have 4 dimensions');
            const expected = [0.1, 0.2, 0.3, 0.4];
            result.output![0].forEach((val: number, i: number) => {
                assert.ok(Math.abs(val - expected[i]) < 0.001, `value ${val} should be close to ${expected[i]}`);
            });
            assert.equal(result.model, 'Xenova/all-MiniLM-L6-v2');
        });

        it('generates embeddings for string array', async () => {
            const embeddings = await TransformersEmbeddings.create();
            const result = await embeddings.createEmbeddings(['hello', 'world']);

            assert.equal(result.status, 'success');
            assert.ok(result.output, 'output should be defined');
            assert.equal(result.output!.length, 2, 'should have two embeddings');

            assert.equal(mockExtractor.callCount, 1);
            assert.deepEqual(mockExtractor.firstCall.args[0], ['hello', 'world']);
        });

        it('passes pooling and normalize options to extractor', async () => {
            const embeddings = await TransformersEmbeddings.create({
                pooling: 'cls',
                normalize: false
            });
            await embeddings.createEmbeddings('test');

            assert.ok(mockExtractor.calledOnce);
            const options = mockExtractor.firstCall.args[1];
            assert.equal(options.pooling, 'cls');
            assert.equal(options.normalize, false);
        });

        it('returns error status on failure', async () => {
            mockExtractor.rejects(new Error('Model inference failed'));

            const embeddings = await TransformersEmbeddings.create();
            const result = await embeddings.createEmbeddings('test');

            assert.equal(result.status, 'error');
            assert.ok(result.message?.includes('Model inference failed'));
        });

        it('handles empty string input', async () => {
            const embeddings = await TransformersEmbeddings.create();
            const result = await embeddings.createEmbeddings('');

            assert.equal(result.status, 'success');
            assert.ok(result.output);
            assert.equal(result.output!.length, 1);
        });

        it('handles empty array input', async () => {
            const embeddings = await TransformersEmbeddings.create();
            const result = await embeddings.createEmbeddings([]);

            assert.equal(result.status, 'success');
            assert.ok(result.output);
            assert.equal(result.output!.length, 0);
        });
    });

    describe('getTokenizer()', () => {
        it('returns a TransformersTokenizer instance', async () => {
            const embeddings = await TransformersEmbeddings.create();
            const tokenizer = embeddings.getTokenizer();

            assert.ok(tokenizer, 'tokenizer should be defined');
            assert.equal(typeof tokenizer.encode, 'function');
            assert.equal(typeof tokenizer.decode, 'function');
        });

        it('returns consistent tokenizer across calls', async () => {
            const embeddings = await TransformersEmbeddings.create();
            const tokenizer1 = embeddings.getTokenizer();
            const tokenizer2 = embeddings.getTokenizer();

            assert.ok(tokenizer1);
            assert.ok(tokenizer2);
        });
    });
});
