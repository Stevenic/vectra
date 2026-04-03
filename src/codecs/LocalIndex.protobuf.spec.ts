import assert from 'node:assert';
import { LocalIndex } from '../LocalIndex';
import { VirtualFileStorage } from '../storage';
import { ProtobufCodec } from './ProtobufCodec';

describe('LocalIndex with ProtobufCodec', () => {
    const codec = new ProtobufCodec();

    it('creates index with .pb extension', async () => {
        const storage = new VirtualFileStorage();
        const index = new LocalIndex('mem://idx', undefined, storage, codec);
        assert.equal(index.indexName, 'index.pb');
        await index.createIndex();
        assert.equal(await index.isIndexCreated(), true);
    });

    it('full CRUD operations produce correct results', async () => {
        const storage = new VirtualFileStorage();
        const index = new LocalIndex('mem://idx', undefined, storage, codec);
        await index.createIndex();

        // Insert
        await index.insertItem({ id: 'a', vector: [1, 0, 0], metadata: { cat: 'x' } });
        await index.insertItem({ id: 'b', vector: [0, 1, 0], metadata: { cat: 'y' } });

        // List
        const items = await index.listItems();
        assert.equal(items.length, 2);
        assert.equal(items[0].id, 'a');

        // Get
        const item = await index.getItem('a');
        assert.ok(item);
        assert.equal(item.metadata.cat, 'x');

        // Query
        const results = await index.queryItems([1, 0, 0], '', 1);
        assert.equal(results.length, 1);
        assert.equal(results[0].item.id, 'a');

        // Upsert
        await index.upsertItem({ id: 'a', vector: [0, 0, 1], metadata: { cat: 'z' } });
        const updated = await index.getItem('a');
        assert.equal(updated?.metadata.cat, 'z');

        // Delete
        await index.deleteItem('b');
        const remaining = await index.listItems();
        assert.equal(remaining.length, 1);
        assert.equal(remaining[0].id, 'a');

        // Stats
        const stats = await index.getIndexStats();
        assert.equal(stats.items, 1);
    });

    it('batch insert works', async () => {
        const storage = new VirtualFileStorage();
        const index = new LocalIndex('mem://idx', undefined, storage, codec);
        await index.createIndex();

        await index.batchInsertItems([
            { id: '1', vector: [1, 0, 0] },
            { id: '2', vector: [0, 1, 0] },
            { id: '3', vector: [0, 0, 1] },
        ]);

        const items = await index.listItems();
        assert.equal(items.length, 3);
    });

    it('metadata filtering works with protobuf storage', async () => {
        const storage = new VirtualFileStorage();
        const index = new LocalIndex('mem://idx', undefined, storage, codec);
        await index.createIndex();

        await index.batchInsertItems([
            { id: '1', vector: [1, 0], metadata: { category: 'food' } },
            { id: '2', vector: [0, 1], metadata: { category: 'drink' } },
        ]);

        const food = await index.listItemsByMetadata({ category: { $eq: 'food' } });
        assert.equal(food.length, 1);
        assert.equal(food[0].id, '1');
    });

    it('external metadata files use .pb extension', async () => {
        const storage = new VirtualFileStorage();
        const index = new LocalIndex('mem://idx', undefined, storage, codec);
        await index.createIndex({ version: 1, metadata_config: { indexed: ['keep'] } });

        await index.insertItem({ id: 'm1', vector: [1], metadata: { keep: 'x', extra: 'y' } });

        const items = await index.listItems();
        const stored = items.find(i => i.id === 'm1')!;
        assert.ok(stored.metadataFile);
        assert.ok(stored.metadataFile.endsWith('.pb'), `Expected .pb extension, got: ${stored.metadataFile}`);
    });

    it('persists and reloads across instances', async () => {
        const storage = new VirtualFileStorage();

        // First instance: create and populate
        const idx1 = new LocalIndex('mem://idx', undefined, storage, codec);
        await idx1.createIndex();
        await idx1.insertItem({ id: 'persist', vector: [1, 2, 3], metadata: { key: 'val' } });

        // Second instance: should read persisted data
        const idx2 = new LocalIndex('mem://idx', undefined, storage, codec);
        const item = await idx2.getItem('persist');
        assert.ok(item);
        assert.equal(item.id, 'persist');
        assert.equal(item.metadata.key, 'val');
    });
});
