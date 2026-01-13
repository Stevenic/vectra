import { strict as assert } from 'node:assert';
import { describe, it } from 'mocha';
import { GPT3Tokenizer } from '../src/GPT3Tokenizer';

describe('GPT3Tokenizer', () => {
  const tokenizer = new GPT3Tokenizer();

  it('encodes empty string to [] and decodes [] to empty string', () => {
    const tokens = tokenizer.encode('');
    assert.deepEqual(tokens, [], 'encode("") should return []');

    const text = tokenizer.decode([]);
    assert.equal(text, '', 'decode([]) should return empty string');
  });

  it('round-trips various strings including unicode and punctuation', () => {
    const samples = [
      'Hello, world!',
      'Café 😊 こんにちは 𠜎𠜱𠝹𠱓',
      'Newlines\nand\ttabs with   multiple   spaces.',
      '--- *** ===='
    ];

    for (const s of samples) {
      const tokens = tokenizer.encode(s);
      const decoded = tokenizer.decode(tokens);
      assert.equal(decoded, s, `decode(encode(s)) should equal s for: ${JSON.stringify(s)}`);

      // Validate token array shape: array of non-negative integers
      assert.ok(Array.isArray(tokens), 'encode should return an array');
      for (const t of tokens) {
        assert.equal(typeof t, 'number', 'each token should be a number');
        assert.ok(Number.isInteger(t), 'each token should be an integer');
        assert.ok(t >= 0, 'each token should be non-negative');
      }

      // Encoding should be stable across calls for the same input
      const tokens2 = tokenizer.encode(s);
      assert.deepEqual(tokens2, tokens, 'encode should be deterministic for the same input');
    }
  });

  it('produces non-empty tokens for typical non-empty input', () => {
    const s = 'This is a simple test.';
    const tokens = tokenizer.encode(s);
    assert.ok(tokens.length > 0, 'expected some tokens for non-empty input');
    const decoded = tokenizer.decode(tokens);
    assert.equal(decoded, s, 'decoded text should match original input');
  });
});