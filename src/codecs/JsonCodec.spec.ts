import assert from 'node:assert';
import { JsonCodec } from './JsonCodec';
import { IndexData } from '../types';
import { DocumentCatalog } from './IndexCodec';

describe('JsonCodec', () => {
    const codec = new JsonCodec();

    it('has .json extension', () => {
        assert.equal(codec.extension, '.json');
    });

    describe('serializeIndex / deserializeIndex', () => {
        it('round-trips IndexData', () => {
            const data: IndexData = {
                version: 1,
                metadata_config: { indexed: ['category'] },
                items: [
                    { id: 'a', metadata: { category: 'food', score: 0.9 }, vector: [1.5, 2.5, 3.5], norm: 4.5 },
                    { id: 'b', metadata: {}, vector: [0, 0, 0], norm: 0, metadataFile: 'ext.json' },
                ],
            };
            const buf = codec.serializeIndex(data);
            assert.ok(Buffer.isBuffer(buf));
            const result = codec.deserializeIndex(buf);
            assert.deepStrictEqual(result, data);
        });

        it('handles empty items', () => {
            const data: IndexData = { version: 2, metadata_config: {}, items: [] };
            const result = codec.deserializeIndex(codec.serializeIndex(data));
            assert.deepStrictEqual(result, data);
        });
    });

    describe('serializeCatalog / deserializeCatalog', () => {
        it('round-trips DocumentCatalog', () => {
            const catalog: DocumentCatalog = {
                version: 1,
                count: 2,
                uriToId: { 'http://a': 'id-a', 'http://b': 'id-b' },
                idToUri: { 'id-a': 'http://a', 'id-b': 'http://b' },
            };
            const buf = codec.serializeCatalog(catalog);
            assert.ok(Buffer.isBuffer(buf));
            const result = codec.deserializeCatalog(buf);
            assert.deepStrictEqual(result, catalog);
        });

        it('handles empty catalog', () => {
            const catalog: DocumentCatalog = { version: 1, count: 0, uriToId: {}, idToUri: {} };
            const result = codec.deserializeCatalog(codec.serializeCatalog(catalog));
            assert.deepStrictEqual(result, catalog);
        });
    });

    describe('serializeMetadata / deserializeMetadata', () => {
        it('round-trips metadata with all types', () => {
            const metadata = { name: 'test', score: 42, active: true };
            const buf = codec.serializeMetadata(metadata);
            const result = codec.deserializeMetadata(buf);
            assert.deepStrictEqual(result, metadata);
        });

        it('handles empty metadata', () => {
            const result = codec.deserializeMetadata(codec.serializeMetadata({}));
            assert.deepStrictEqual(result, {});
        });
    });
});
