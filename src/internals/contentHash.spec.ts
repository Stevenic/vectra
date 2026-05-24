import { strict as assert } from 'node:assert';
import { describe, it } from 'mocha';
import { computeContentHash } from './contentHash';

describe('computeContentHash', () => {
    it('returns a 64-character lowercase hex string', () => {
        const h = computeContentHash('hello');
        assert.match(h, /^[0-9a-f]{64}$/);
    });

    it('produces the same hash for identical inputs', () => {
        const a = computeContentHash('text', 'md', { author: 'x', n: 1 });
        const b = computeContentHash('text', 'md', { author: 'x', n: 1 });
        assert.equal(a, b);
    });

    it('changes when the text changes', () => {
        const a = computeContentHash('one');
        const b = computeContentHash('two');
        assert.notEqual(a, b);
    });

    it('changes when docType changes', () => {
        const a = computeContentHash('same', 'md');
        const b = computeContentHash('same', 'txt');
        assert.notEqual(a, b);
    });

    it('changes when metadata values change', () => {
        const a = computeContentHash('t', undefined, { k: 'v1' });
        const b = computeContentHash('t', undefined, { k: 'v2' });
        assert.notEqual(a, b);
    });

    it('is independent of metadata key order', () => {
        const a = computeContentHash('t', 'md', { a: 1, b: 2, c: 3 });
        const b = computeContentHash('t', 'md', { c: 3, a: 1, b: 2 });
        assert.equal(a, b);
    });

    it('treats undefined metadata and empty metadata as equivalent', () => {
        const a = computeContentHash('t', 'md', undefined);
        const b = computeContentHash('t', 'md', {});
        assert.equal(a, b);
    });

    it('treats undefined docType and empty docType as equivalent', () => {
        const a = computeContentHash('t');
        const b = computeContentHash('t', '');
        assert.equal(a, b);
    });

    it('avoids cross-field collisions via null-byte separators', () => {
        // "ab" + "" + "{}" vs "a" + "b" + "{}" — without separators these could hash the same.
        const a = computeContentHash('ab', '');
        const b = computeContentHash('a', 'b');
        assert.notEqual(a, b);
    });
});
