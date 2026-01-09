import assert from 'node:assert'
import { LocalIndex } from './LocalIndex'
import { IndexItem } from './types'
import fs from 'fs/promises'
import path from 'path'

describe('LocalIndex', () => {
  const testIndexDir = path.join(__dirname, 'test_index');

  beforeEach(async () => {
    await fs.rm(testIndexDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    await fs.rm(testIndexDir, { recursive: true, force: true });
  });

  it('should create a new index', async () => {
    const index = new LocalIndex(testIndexDir);
    await index.createIndex();
    const created = await index.isIndexCreated();
    assert.equal(created, true);
  });

  describe('batchInsertItems', () => {
    const indexItems: Partial<IndexItem>[] = [
      { id: '1', vector: [1, 2, 3] },
      { id: '2', vector: [2, 3, 4] },
      { id: '3', vector: [3, 4, 5] }
    ];

    it('should insert provided items', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();

      const newItems = await index.batchInsertItems(indexItems);

      assert.equal(newItems.length, 3);

      const retrievedItems = await index.listItems();
      assert.equal(retrievedItems.length, 3);
    });

    it('on id collision - cancel batch insert & bubble up error', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();

      await index.insertItem({ id: '2', vector: [9, 9, 9] });

      // ensures insert error is bubbled up to batchIndexItems caller
      await assert.rejects(
        async () => {
          await index.batchInsertItems(indexItems);
        },
        {
          name: 'Error',
          message: 'Item with id 2 already exists'
        }
      );

      // ensures no partial update is applied
      const storedItems = await index.listItems();
      assert.equal(storedItems.length, 1);
    });
  });
});
