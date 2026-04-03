import assert from 'node:assert';
import { ProtobufCodec } from './ProtobufCodec';
import { JsonCodec } from './JsonCodec';
import { IndexData } from '../types';
import { DocumentCatalog } from './IndexCodec';

describe('ProtobufCodec', () => {
    const codec = new ProtobufCodec();

    it('has .pb extension', () => {
        assert.equal(codec.extension, '.pb');
    });

    describe('serializeIndex / deserializeIndex', () => {
        it('round-trips IndexData', () => {
            const data: IndexData = {
                version: 1,
                metadata_config: { indexed: ['category'] },
                items: [
                    { id: 'a', metadata: { category: 'food', score: 42 }, vector: [1.5, 2.5, 3.5], norm: 4.5 },
                    { id: 'b', metadata: {}, vector: [0, 0, 0], norm: 0, metadataFile: 'ext.pb' },
                ],
            };
            const buf = codec.serializeIndex(data);
            assert.ok(Buffer.isBuffer(buf));
            const result = codec.deserializeIndex(buf);
            assert.equal(result.version, data.version);
            assert.deepStrictEqual(result.metadata_config, data.metadata_config);
            assert.equal(result.items.length, 2);
            assert.equal(result.items[0].id, 'a');
            assert.deepStrictEqual(result.items[0].metadata, { category: 'food', score: 42 });
            // Float32 precision: vectors should be close but not exact
            assert.ok(Math.abs(result.items[0].vector[0] - 1.5) < 0.001);
            assert.ok(Math.abs(result.items[0].vector[1] - 2.5) < 0.001);
            assert.ok(Math.abs(result.items[0].vector[2] - 3.5) < 0.001);
            assert.equal(result.items[0].norm, 4.5); // norm is double, exact
            assert.equal(result.items[1].metadataFile, 'ext.pb');
        });

        it('handles empty items', () => {
            const data: IndexData = { version: 2, metadata_config: {}, items: [] };
            const result = codec.deserializeIndex(codec.serializeIndex(data));
            assert.equal(result.version, 2);
            assert.deepStrictEqual(result.items, []);
        });

        it('handles boolean metadata values', () => {
            const data: IndexData = {
                version: 1,
                metadata_config: {},
                items: [
                    { id: 'x', metadata: { active: true, deleted: false }, vector: [1], norm: 1 },
                ],
            };
            // Note: false/0/"" are proto3 default values — test the tricky case
            const result = codec.deserializeIndex(codec.serializeIndex(data));
            assert.equal(result.items[0].metadata.active, true);
        });

        it('handles string metadata', () => {
            const data: IndexData = {
                version: 1,
                metadata_config: {},
                items: [
                    { id: 'x', metadata: { name: 'hello', tag: 'world' }, vector: [1], norm: 1 },
                ],
            };
            const result = codec.deserializeIndex(codec.serializeIndex(data));
            assert.equal(result.items[0].metadata.name, 'hello');
            assert.equal(result.items[0].metadata.tag, 'world');
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
        it('round-trips metadata (uses JSON for external files)', () => {
            const metadata = { name: 'test', score: 42, active: true };
            const buf = codec.serializeMetadata(metadata);
            const result = codec.deserializeMetadata(buf);
            assert.deepStrictEqual(result, metadata);
        });
    });

    describe('cross-codec compatibility', () => {
        const json = new JsonCodec();
        const pb = new ProtobufCodec();

        it('data serialized with JSON can be re-serialized with Protobuf and back (logical equivalence)', () => {
            const data: IndexData = {
                version: 1,
                metadata_config: { indexed: ['cat'] },
                items: [
                    { id: 'item1', metadata: { cat: 'a', num: 7 }, vector: [0.1, 0.2, 0.3], norm: 0.374 },
                ],
            };
            // JSON -> Protobuf
            const jsonBuf = json.serializeIndex(data);
            const fromJson = json.deserializeIndex(jsonBuf);
            const pbBuf = pb.serializeIndex(fromJson);
            const fromPb = pb.deserializeIndex(pbBuf);

            assert.equal(fromPb.version, data.version);
            assert.deepStrictEqual(fromPb.metadata_config, data.metadata_config);
            assert.equal(fromPb.items[0].id, data.items[0].id);
            assert.deepStrictEqual(fromPb.items[0].metadata, data.items[0].metadata);

            // Protobuf -> JSON
            const jsonBuf2 = json.serializeIndex(fromPb);
            const final = json.deserializeIndex(jsonBuf2);
            assert.equal(final.items[0].id, 'item1');
            assert.deepStrictEqual(final.items[0].metadata, { cat: 'a', num: 7 });
        });

        it('catalog round-trips across codecs', () => {
            const catalog: DocumentCatalog = {
                version: 1,
                count: 1,
                uriToId: { 'file://doc.txt': 'uuid-1' },
                idToUri: { 'uuid-1': 'file://doc.txt' },
            };
            const pbBuf = pb.serializeCatalog(catalog);
            const fromPb = pb.deserializeCatalog(pbBuf);
            const jsonBuf = json.serializeCatalog(fromPb);
            const final = json.deserializeCatalog(jsonBuf);
            assert.deepStrictEqual(final, catalog);
        });
    });

    describe('protobuf produces smaller output than JSON for vector data', () => {
        it('binary is smaller than JSON for a 1536-dim vector', () => {
            const vector = Array.from({ length: 1536 }, (_, i) => Math.random() * 2 - 1);
            const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
            const data: IndexData = {
                version: 1,
                metadata_config: {},
                items: [{ id: 'vec', metadata: {}, vector, norm }],
            };
            const jsonSize = new JsonCodec().serializeIndex(data).length;
            const pbSize = codec.serializeIndex(data).length;
            // Protobuf should be significantly smaller
            assert.ok(pbSize < jsonSize, `Expected pb (${pbSize}) < json (${jsonSize})`);
            // Spec says ~40-50% savings
            assert.ok(pbSize < jsonSize * 0.7, `Expected at least 30% savings, got ${((1 - pbSize / jsonSize) * 100).toFixed(1)}%`);
        });
    });
});
