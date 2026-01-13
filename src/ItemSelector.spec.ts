import { strict as assert } from 'node:assert';
import { ItemSelector } from './ItemSelector';

function almostEqual(actual: number, expected: number, eps = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= eps, `actual ${actual} not within ${eps} of expected ${expected}`);
}

describe('ItemSelector', () => {
  describe('normalize', () => {
    it('returns correct norm for typical vector', () => {
      assert.equal(ItemSelector.normalize([3, 4]), 5);
    });

    it('handles negatives', () => {
      assert.equal(ItemSelector.normalize([-2, -3]), Math.sqrt(13));
    });

    it('returns 0 for zero vector', () => {
      assert.equal(ItemSelector.normalize([0, 0]), 0);
    });

    it('returns 0 for empty vector', () => {
      assert.equal(ItemSelector.normalize([]), 0);
    });
  });

  describe('cosineSimilarity', () => {
    it('returns ~1 for identical vectors', () => {
      const actual = ItemSelector.cosineSimilarity([1, 2], [1, 2]);
      almostEqual(actual, 1);
    });

    it('returns ~0 for orthogonal vectors', () => {
      const actual = ItemSelector.cosineSimilarity([1, 0], [0, 1]);
      almostEqual(actual, 0);
    });

    it('returns ~-1 for opposite vectors', () => {
      const actual = ItemSelector.cosineSimilarity([1, 0], [-1, 0]);
      almostEqual(actual, -1);
    });

    it('returns NaN if one vector is zero', () => {
      assert.ok(Number.isNaN(ItemSelector.cosineSimilarity([0, 0], [1, 2])));
    });

    it('returns NaN if both vectors are zero', () => {
      assert.ok(Number.isNaN(ItemSelector.cosineSimilarity([0, 0], [0, 0])));
    });

    it('handles different lengths by ignoring extra elements (including in norms)', () => {
      const v1 = [1, 2, 3];
      const v2 = [4, 5];
      const minLen = Math.min(v1.length, v2.length);

      const dot = v1.slice(0, minLen).reduce((sum, val, i) => sum + val * v2[i], 0);
      const norm1 = ItemSelector.normalize(v1.slice(0, minLen));
      const norm2 = ItemSelector.normalize(v2.slice(0, minLen));
      const expected = dot / (norm1 * norm2);

      const result = ItemSelector.cosineSimilarity(v1, v2);
      almostEqual(result, expected);
    });
  });

  describe('normalizedCosineSimilarity', () => {
    it('returns correct similarity with valid norms', () => {
      const v1 = [1, 2];
      const v2 = [2, 3];
      const norm1 = ItemSelector.normalize(v1);
      const norm2 = ItemSelector.normalize(v2);
      const expected = (v1[0] * v2[0] + v1[1] * v2[1]) / (norm1 * norm2);
      const actual = ItemSelector.normalizedCosineSimilarity(v1, norm1, v2, norm2);
      almostEqual(actual, expected);
    });

    it('returns NaN if norm1 is zero', () => {
      assert.ok(Number.isNaN(ItemSelector.normalizedCosineSimilarity([1, 2], 0, [2, 3], 1)));
    });

    it('returns NaN if norm2 is zero', () => {
      assert.ok(Number.isNaN(ItemSelector.normalizedCosineSimilarity([1, 2], 1, [2, 3], 0)));
    });
  });

  describe('select', () => {
    it('returns true for empty filter object', () => {
      assert.equal(ItemSelector.select({ a: 1 }, {} as any), true);
    });

    it('returns false if unknown key and metadata missing key', () => {
      assert.equal(ItemSelector.select({}, { unknown: 'value' } as any), false);
    });

    it('returns true if unknown key and metadata has equal value', () => {
      assert.equal(ItemSelector.select({ unknown: 'value' }, { unknown: 'value' } as any), true);
    });

    it('returns false if filter value is undefined or null', () => {
      assert.equal(ItemSelector.select({ name: 'alice' }, { name: undefined } as any), false);
      assert.equal(ItemSelector.select({ name: 'alice' }, { name: null } as any), false);
    });

    it('handles $and with all subfilters passing', () => {
      const filter = { $and: [{ a: 1 }, { b: 2 }] } as any;
      const metadata = { a: 1, b: 2 };
      assert.equal(ItemSelector.select(metadata, filter), true);
    });

    it('handles $and with one subfilter failing', () => {
      const filter = { $and: [{ a: 1 }, { b: 3 }] } as any;
      const metadata = { a: 1, b: 2 };
      assert.equal(ItemSelector.select(metadata, filter), false);
    });

    it('handles empty $and array', () => {
      assert.equal(ItemSelector.select({}, { $and: [] } as any), true);
    });

    it('handles nested $and/$or combinations', () => {
      const filter = { $and: [{ $or: [{ a: 1 }, { b: 2 }] }, { c: 3 }] } as any;
      const metadata1 = { a: 1, c: 3 };
      const metadata2 = { b: 2, c: 3 };
      const metadata3 = { a: 1, c: 4 };
      assert.equal(ItemSelector.select(metadata1, filter), true);
      assert.equal(ItemSelector.select(metadata2, filter), true);
      assert.equal(ItemSelector.select(metadata3, filter), false);
    });

    it('handles $or with at least one subfilter passing', () => {
      const filter = { $or: [{ a: 1 }, { b: 2 }] } as any;
      const metadata = { a: 1, b: 3 };
      assert.equal(ItemSelector.select(metadata, filter), true);
    });

    it('handles $or with all subfilters failing', () => {
      const filter = { $or: [{ a: 2 }, { b: 3 }] } as any;
      const metadata = { a: 1, b: 2 };
      assert.equal(ItemSelector.select(metadata, filter), false);
    });

    it('handles empty $or array', () => {
      assert.equal(ItemSelector.select({}, { $or: [] } as any), false);
    });

    it('handles metadataFilter numeric comparisons', () => {
      const metadata = { num: 5, str: 'hello' };

      assert.equal(ItemSelector.select(metadata, { num: { $eq: 5 } } as any), true);
      assert.equal(ItemSelector.select(metadata, { num: { $eq: 4 } } as any), false);

      assert.equal(ItemSelector.select(metadata, { num: { $ne: 4 } } as any), true);
      assert.equal(ItemSelector.select(metadata, { num: { $ne: 5 } } as any), false);

      assert.equal(ItemSelector.select(metadata, { num: { $gt: 4 } } as any), true);
      assert.equal(ItemSelector.select(metadata, { num: { $gt: 5 } } as any), false);
      assert.equal(ItemSelector.select(metadata, { num: { $gt: 4.9 } } as any), true);
      assert.equal(ItemSelector.select(metadata, { str: { $gt: 'a' } } as any), false);

      assert.equal(ItemSelector.select(metadata, { num: { $gte: 5 } } as any), true);
      assert.equal(ItemSelector.select(metadata, { num: { $gte: 6 } } as any), false);
      assert.equal(ItemSelector.select(metadata, { str: { $gte: 'a' } } as any), false);

      assert.equal(ItemSelector.select(metadata, { num: { $lt: 6 } } as any), true);
      assert.equal(ItemSelector.select(metadata, { num: { $lt: 5 } } as any), false);
      assert.equal(ItemSelector.select(metadata, { str: { $lt: 'z' } } as any), false);

      assert.equal(ItemSelector.select(metadata, { num: { $lte: 5 } } as any), true);
      assert.equal(ItemSelector.select(metadata, { num: { $lte: 4 } } as any), false);
      assert.equal(ItemSelector.select(metadata, { str: { $lte: 'z' } } as any), false);
    });

    it('$in behavior matches implementation (booleans false, exact match for strings, substring for strings, numbers via substring in array strings)', () => {
      const metadataBool = { val: true };
      const metadataStr = { val: 'foo' };
      const metadataStr2 = { val: 'oo' };
      const metadataNum = { val: 42 };
      const arrStr = ['foo', 'bar'];
      const arrMixedNo = ['foobar', 'baz'];
      const arrMixedYes = ['x42y', 'baz'];

      // boolean always false
      assert.equal(ItemSelector.select(metadataBool, { val: { $in: ['foo'] } } as any), false);

      // string exact includes
      assert.equal(ItemSelector.select(metadataStr, { val: { $in: arrStr } } as any), true);

      // string not included
      assert.equal(ItemSelector.select(metadataStr2, { val: { $in: arrStr } } as any), false);

      // number: true only if some array string includes the number as a substring
      assert.equal(ItemSelector.select(metadataNum, { val: { $in: arrMixedNo } } as any), false);
      assert.equal(ItemSelector.select(metadataNum, { val: { $in: arrMixedYes } } as any), true);

      // array of numbers does not include string '42'
      assert.equal(ItemSelector.select({ val: '42' }, { val: { $in: [1, 2] } } as any), false);
    });

    it('$nin behavior matches implementation (booleans false, blocks exact/substring for strings, numbers only blocked by substring in array strings)', () => {
      const metadataBool = { val: true };
      const metadataStr = { val: 'foo' };
      const metadataStrSub = { val: 'oo' };
      const metadataNum = { val: 42 };
      const arrStr = ['foo', 'bar'];
      const arrMixedNo = ['foobar', 'baz'];
      const arrMixedYes = ['baz', 'z42z'];
      const arrNum = [42];

      // boolean always false
      assert.equal(ItemSelector.select(metadataBool, { val: { $nin: ['foo'] } } as any), false);

      // string exact match present -> false
      assert.equal(ItemSelector.select(metadataStr, { val: { $nin: arrStr } } as any), false);

      // string is a substring of an element -> false
      assert.equal(ItemSelector.select(metadataStrSub, { val: { $nin: arrMixedNo } } as any), false);

      // number: true if no array string includes the number as substring
      assert.equal(ItemSelector.select(metadataNum, { val: { $nin: arrMixedNo } } as any), true);

      // number: false if some array string includes the number as substring
      assert.equal(ItemSelector.select(metadataNum, { val: { $nin: arrMixedYes } } as any), false);

      // array of numbers does not block number (implementation detail)
      assert.equal(ItemSelector.select(metadataNum, { val: { $nin: arrNum } } as any), true);
    });

    it('handles default operator fall-through (unknown operator compares equality to its value)', () => {
      const metadata = { field: 'bar' };
      // Unknown operator compares metadata value to the operator's value
      assert.equal(ItemSelector.select(metadata, { field: { $foo: 'bar' } } as any), true);
      assert.equal(ItemSelector.select(metadata, { field: { $foo: 'baz' } } as any), false);

      // Direct scalar equality
      assert.equal(ItemSelector.select(metadata, { field: 'bar' } as any), true);
      assert.equal(ItemSelector.select(metadata, { field: 'baz' } as any), false);
    });

    it('returns false if metadata key missing in object filter', () => {
      const metadata = {};
      assert.equal(ItemSelector.select(metadata, { age: { $gt: 18 } } as any), false);
    });

    it('handles multi-field filter with mixed scalar and operator filters', () => {
      const metadata = { a: 1, b: 2, c: 3 };
      const filter = { a: 1, b: { $gt: 1 }, c: { $lt: 4 } } as any;
      assert.equal(ItemSelector.select(metadata, filter), true);
      const filterFail = { a: 1, b: { $gt: 2 }, c: { $lt: 4 } } as any;
      assert.equal(ItemSelector.select(metadata, filterFail), false);
    });
  });
});