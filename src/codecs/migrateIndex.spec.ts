import assert from 'node:assert';
import { VirtualFileStorage } from '../storage';
import { JsonCodec } from './JsonCodec';
import { ProtobufCodec } from './ProtobufCodec';
import { detectCodec, migrateIndex } from './migrateIndex';
import { IndexData } from '../types';
import { DocumentCatalog } from './IndexCodec';

describe('detectCodec', () => {
    it('detects JSON format', async () => {
        const storage = new VirtualFileStorage();
        await storage.createFolder('/idx');
        await storage.upsertFile('/idx/index.json', '{}');
        const codec = await detectCodec('/idx', storage);
        assert.equal(codec.extension, '.json');
    });

    it('detects Protobuf format', async () => {
        const storage = new VirtualFileStorage();
        await storage.createFolder('/idx');
        await storage.upsertFile('/idx/index.pb', Buffer.from([0]));
        const codec = await detectCodec('/idx', storage);
        assert.equal(codec.extension, '.pb');
    });

    it('throws when both formats exist', async () => {
        const storage = new VirtualFileStorage();
        await storage.createFolder('/idx');
        await storage.upsertFile('/idx/index.json', '{}');
        await storage.upsertFile('/idx/index.pb', Buffer.from([0]));
        await assert.rejects(
            () => detectCodec('/idx', storage),
            /Both index\.json and index\.pb found/
        );
    });

    it('throws when no index file exists', async () => {
        const storage = new VirtualFileStorage();
        await storage.createFolder('/idx');
        await assert.rejects(
            () => detectCodec('/idx', storage),
            /No index file found/
        );
    });
});

describe('migrateIndex', () => {
    const json = new JsonCodec();
    const pb = new ProtobufCodec();

    function makeIndexData(): IndexData {
        return {
            version: 1,
            metadata_config: { indexed: ['cat'] },
            items: [
                { id: 'item1', metadata: { cat: 'food' }, vector: [0.1, 0.2, 0.3], norm: 0.374 },
                { id: 'item2', metadata: { cat: 'drink' }, vector: [0.4, 0.5, 0.6], norm: 0.877, metadataFile: 'abc.json' },
            ],
        };
    }

    function makeCatalog(): DocumentCatalog {
        return {
            version: 1,
            count: 1,
            uriToId: { 'doc.txt': 'doc-id-1' },
            idToUri: { 'doc-id-1': 'doc.txt' },
        };
    }

    it('migrates JSON -> Protobuf', async () => {
        const storage = new VirtualFileStorage();
        await storage.createFolder('/idx');
        const data = makeIndexData();
        await storage.upsertFile('/idx/index.json', json.serializeIndex(data));
        await storage.upsertFile('/idx/abc.json', json.serializeMetadata({ cat: 'drink', extra: 'data' }));

        await migrateIndex('/idx', { to: 'protobuf', storage });

        // Old files should be gone
        assert.equal(await storage.pathExists('/idx/index.json'), false);
        assert.equal(await storage.pathExists('/idx/abc.json'), false);

        // New files should exist
        assert.equal(await storage.pathExists('/idx/index.pb'), true);
        assert.equal(await storage.pathExists('/idx/abc.pb'), true);

        // Data should be intact
        const result = pb.deserializeIndex(await storage.readFile('/idx/index.pb'));
        assert.equal(result.items.length, 2);
        assert.equal(result.items[0].id, 'item1');
        assert.equal(result.items[1].metadataFile, 'abc.pb');

        // External metadata should be readable
        const meta = pb.deserializeMetadata(await storage.readFile('/idx/abc.pb'));
        assert.equal(meta.cat, 'drink');
        assert.equal(meta.extra, 'data');
    });

    it('migrates Protobuf -> JSON', async () => {
        const storage = new VirtualFileStorage();
        await storage.createFolder('/idx');
        const data = makeIndexData();
        // Adjust metadataFile extension
        data.items[1].metadataFile = 'abc.pb';
        await storage.upsertFile('/idx/index.pb', pb.serializeIndex(data));
        await storage.upsertFile('/idx/abc.pb', pb.serializeMetadata({ cat: 'drink', extra: 'data' }));

        await migrateIndex('/idx', { to: 'json', storage });

        assert.equal(await storage.pathExists('/idx/index.pb'), false);
        assert.equal(await storage.pathExists('/idx/index.json'), true);

        const result = json.deserializeIndex(await storage.readFile('/idx/index.json'));
        assert.equal(result.items.length, 2);
        assert.equal(result.items[1].metadataFile, 'abc.json');
    });

    it('migrates catalog along with index', async () => {
        const storage = new VirtualFileStorage();
        await storage.createFolder('/idx');
        const data: IndexData = { version: 1, metadata_config: {}, items: [] };
        const catalog = makeCatalog();
        await storage.upsertFile('/idx/index.json', json.serializeIndex(data));
        await storage.upsertFile('/idx/catalog.json', json.serializeCatalog(catalog));

        await migrateIndex('/idx', { to: 'protobuf', storage });

        assert.equal(await storage.pathExists('/idx/catalog.json'), false);
        assert.equal(await storage.pathExists('/idx/catalog.pb'), true);

        const result = pb.deserializeCatalog(await storage.readFile('/idx/catalog.pb'));
        assert.deepStrictEqual(result, catalog);
    });

    it('migrates document metadata files referenced by catalog', async () => {
        const storage = new VirtualFileStorage();
        await storage.createFolder('/idx');
        const data: IndexData = { version: 1, metadata_config: {}, items: [] };
        const catalog = makeCatalog();
        await storage.upsertFile('/idx/index.json', json.serializeIndex(data));
        await storage.upsertFile('/idx/catalog.json', json.serializeCatalog(catalog));
        await storage.upsertFile('/idx/doc-id-1.json', json.serializeMetadata({ author: 'test' }));

        await migrateIndex('/idx', { to: 'protobuf', storage });

        assert.equal(await storage.pathExists('/idx/doc-id-1.json'), false);
        assert.equal(await storage.pathExists('/idx/doc-id-1.pb'), true);
        const meta = pb.deserializeMetadata(await storage.readFile('/idx/doc-id-1.pb'));
        assert.equal(meta.author, 'test');
    });

    it('no-op when already in target format', async () => {
        const storage = new VirtualFileStorage();
        await storage.createFolder('/idx');
        const data: IndexData = { version: 1, metadata_config: {}, items: [] };
        await storage.upsertFile('/idx/index.json', json.serializeIndex(data));

        await migrateIndex('/idx', { to: 'json', storage });

        // Should still be there, unchanged
        assert.equal(await storage.pathExists('/idx/index.json'), true);
    });

    it('interruption detection: dual format raises error on detectCodec', async () => {
        const storage = new VirtualFileStorage();
        await storage.createFolder('/idx');
        await storage.upsertFile('/idx/index.json', '{}');
        await storage.upsertFile('/idx/index.pb', Buffer.from([0]));

        await assert.rejects(
            () => detectCodec('/idx', storage),
            /Both index\.json and index\.pb found/
        );
    });
});
