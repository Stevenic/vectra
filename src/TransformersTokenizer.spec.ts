import { strict as assert } from 'node:assert';
import { describe, it } from 'mocha';
import { TransformersTokenizer } from './TransformersTokenizer';

describe('TransformersTokenizer', () => {
    // Create a mock tokenizer that mimics Transformers.js behavior
    function createMockTokenizer() {
        const vocab: Map<string, number> = new Map([
            ['hello', 101],
            ['world', 102],
            ['test', 103],
            ['[CLS]', 1],
            ['[SEP]', 2]
        ]);
        const reverseVocab: Map<number, string> = new Map();
        vocab.forEach((v, k) => reverseVocab.set(v, k));

        return {
            // Mimics the callable tokenizer behavior
            __call__: (text: string) => {
                const words = text.toLowerCase().split(/\s+/).filter(w => w);
                const ids = words.map(w => vocab.get(w) ?? 100);
                return {
                    input_ids: {
                        data: BigInt64Array.from(ids.map(id => BigInt(id)))
                    }
                };
            },
            decode: (tokens: number[], options?: { skip_special_tokens?: boolean }) => {
                const words = tokens
                    .filter(t => !options?.skip_special_tokens || (t !== 1 && t !== 2))
                    .map(t => reverseVocab.get(t) ?? '[UNK]');
                return words.join(' ');
            }
        };
    }

    it('encodes text to token array using callable tokenizer', () => {
        const mockTokenizer = createMockTokenizer();
        // Make it callable
        const callableTokenizer = Object.assign(
            (text: string) => mockTokenizer.__call__(text),
            { decode: mockTokenizer.decode }
        ) as any;

        const tokenizer = new TransformersTokenizer(callableTokenizer);
        const tokens = tokenizer.encode('hello world');

        assert.ok(Array.isArray(tokens), 'encode should return an array');
        assert.equal(tokens.length, 2, 'should have 2 tokens');
        assert.deepEqual(tokens, [101, 102], 'tokens should match expected values');
    });

    it('handles BigInt64Array conversion correctly', () => {
        const mockTokenizer = {
            __call__: () => ({
                input_ids: {
                    data: BigInt64Array.from([BigInt(1), BigInt(2), BigInt(3)])
                }
            }),
            decode: () => 'decoded'
        };
        const callableTokenizer = Object.assign(
            () => mockTokenizer.__call__(),
            { decode: mockTokenizer.decode }
        ) as any;

        const tokenizer = new TransformersTokenizer(callableTokenizer);
        const tokens = tokenizer.encode('any text');

        assert.deepEqual(tokens, [1, 2, 3], 'should convert BigInt to number');
        tokens.forEach(t => {
            assert.equal(typeof t, 'number', 'each token should be a number');
        });
    });

    it('decodes tokens back to text', () => {
        const mockTokenizer = {
            __call__: () => ({ input_ids: { data: BigInt64Array.from([]) } }),
            decode: (tokens: number[], opts?: { skip_special_tokens?: boolean }) => {
                if (opts?.skip_special_tokens) {
                    return 'hello world';
                }
                return '[CLS] hello world [SEP]';
            }
        };
        const callableTokenizer = Object.assign(
            () => mockTokenizer.__call__(),
            { decode: mockTokenizer.decode }
        ) as any;

        const tokenizer = new TransformersTokenizer(callableTokenizer);
        const text = tokenizer.decode([1, 101, 102, 2]);

        assert.equal(text, 'hello world', 'should decode with skip_special_tokens=true');
    });

    it('handles empty input', () => {
        const mockTokenizer = {
            __call__: () => ({
                input_ids: { data: BigInt64Array.from([]) }
            }),
            decode: () => ''
        };
        const callableTokenizer = Object.assign(
            () => mockTokenizer.__call__(),
            { decode: mockTokenizer.decode }
        ) as any;

        const tokenizer = new TransformersTokenizer(callableTokenizer);

        const tokens = tokenizer.encode('');
        assert.deepEqual(tokens, [], 'empty input should return empty array');

        const text = tokenizer.decode([]);
        assert.equal(text, '', 'empty tokens should return empty string');
    });

    it('returns consistent results for same input', () => {
        let callCount = 0;
        const mockTokenizer = {
            __call__: () => {
                callCount++;
                return {
                    input_ids: { data: BigInt64Array.from([BigInt(101), BigInt(102)]) }
                };
            },
            decode: () => 'hello world'
        };
        const callableTokenizer = Object.assign(
            () => mockTokenizer.__call__(),
            { decode: mockTokenizer.decode }
        ) as any;

        const tokenizer = new TransformersTokenizer(callableTokenizer);

        const tokens1 = tokenizer.encode('hello world');
        const tokens2 = tokenizer.encode('hello world');

        assert.deepEqual(tokens1, tokens2, 'encode should be deterministic');
        assert.equal(callCount, 2, 'should call underlying tokenizer each time');
    });
});
