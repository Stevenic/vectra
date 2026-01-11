import assert from 'node:assert'
import sinon from 'sinon'
import { LocalIndex } from './LocalIndex'
import { IndexItem } from './types'
import fs from 'fs/promises'
import path from 'path'

describe('LocalIndex', () => {
  const testIndexDir = path.join(__dirname, 'test_index');

  const basicIndexItems: Partial<IndexItem>[] = [
    { id: '1', vector: [1, 2, 3] },
    { id: '2', vector: [2, 3, 4] },
    { id: '3', vector: [3, 4, 5] }
  ];


  beforeEach(async () => {
    await fs.rm(testIndexDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    await fs.rm(testIndexDir, { recursive: true, force: true });
    sinon.restore();
  });

  it('should create a new index', async () => {
    const index = new LocalIndex(testIndexDir);
    await index.createIndex();
    const created = await index.isIndexCreated();
    assert.equal(created, true);
    assert.equal(index.folderPath, testIndexDir);
  });

  it('blocks concurrent operations when lock is held', async () => {
    const index = new LocalIndex(testIndexDir);
    await index.createIndex();
    await index.beginUpdate(); // grab lock for a big update!
    await assert.rejects(async () => {
      await index.beginUpdate(); // try to grab lock again. should fail!
    }, new Error('Update already in progress'))
  })

  describe('createIndex', () => {
    it('checks for existing index on creation', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex(); // create first index.json

      // create without deleteIfExists. Will reject
      await assert.rejects(async () => {
        await index.createIndex()
      }, new Error('Index already exists'))

      // create with deleteIfExists. Should remove old data
      await index.insertItem({id:'1', vector: [1,2,3]})
      const lengthBefore = (await index.listItems()).length
      assert.equal(lengthBefore, 1)
      await index.createIndex({deleteIfExists: true, version: 2, metadata_config: {}})
      const lengthAfter = (await index.listItems()).length
      assert.equal(lengthAfter, 0)
    })

    it('delete index if file creation fails', async () => {
      const index = new LocalIndex(testIndexDir);
      sinon.stub(fs, 'writeFile').rejects(new Error('fs error'))

      await assert.rejects(async () => {
        await index.createIndex();
      }, new Error('Error creating index'))

      await assert.rejects(async () => {
        await index.listItems();
      })
    })
  })

  describe('deleteItem', () => {
    it('does nothing when id not found', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();
      await index.beginUpdate();
      await index.insertItem(basicIndexItems[0])
      await index.insertItem(basicIndexItems[1])
      await index.insertItem(basicIndexItems[2])
      await index.endUpdate();

      await assert.doesNotReject(async () => {
        await index.deleteItem('dne');
      })
      assert.equal((await index.listItems()).length, 3)
    })

    it('leaves existing empty index when last el deleted', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();
      await index.insertItem(basicIndexItems[0]);

      await index.deleteItem(basicIndexItems[0].id ?? '');
      assert.equal(await index.isIndexCreated(), true);
      assert.equal((await index.listItems()).length, 0);
    })

    it('removes elements from any position', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();
      await index.batchInsertItems([
        {id: '1', vector: []},
        {id: '2', vector: []},
        {id: '3', vector: []},
        {id: '4', vector: []},
        {id: '5', vector: []},
      ]);

      await index.beginUpdate();
      await index.deleteItem('1');
      await index.deleteItem('3');
      await index.deleteItem('5');
      await index.endUpdate();

      assert.deepStrictEqual(await index.listItems(), [{id: '2', vector: [], metadata: {}, norm: 0}, {id: '4', vector: [], metadata: {}, norm: 0}])
    })
  })

  describe('endUpdate', () => {
    it('throws an error if no update has begun', async () => {
      const index = new LocalIndex(testIndexDir);

      await assert.rejects(async () => {
        await index.endUpdate();
      }, new Error('No update in progress'));
    })

    it('throws an error if the index could not be saved', async () => {
      const index = new LocalIndex(testIndexDir, 'index.json');
      await index.createIndex();
      await index.beginUpdate();

      sinon.stub(fs, 'writeFile').rejects(new Error('fs error'))

      await assert.rejects(async () => {
        await index.endUpdate();
      }, new Error('Error saving index: Error: fs error'))
    })
  })

  describe('getIndexStats', () => {
    it('reports empty index correctly', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();

      assert.deepStrictEqual(await index.getIndexStats(), {
        version: 1,
        metadata_config: {},
        items: 0
      })
    })

    it('correctly reports non-empty index stats', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex({version: 1, metadata_config: {indexed: []}})
      await index.batchInsertItems(basicIndexItems);

      assert.deepStrictEqual(await index.getIndexStats(), {
        version: 1,
        metadata_config: {indexed: []},
        items: 3
      })
    })
  })

  describe('getItem', () => {
    it('returns undefined when item not found', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();

      assert.equal(await index.getItem('1'), undefined)
    })

    it('returns requested item', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();
      await index.batchInsertItems(basicIndexItems);

      const item2 = await index.getItem('2');
      assert.equal(item2?.id, basicIndexItems[1].id)
      assert.equal(item2?.vector, basicIndexItems[1].vector)
      assert.equal((await index.listItems()).length, 3)
    })
  })

  describe('batchInsertItems', () => {
    it('should insert provided items', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();

      const newItems = await index.batchInsertItems(basicIndexItems);

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
          await index.batchInsertItems(basicIndexItems);
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

  describe('listItemsByMetadata', () => {
    it('returns items matching metadata filter', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();
      await index.batchInsertItems([
        {id: '1', vector: [], metadata: {category: 'food'}},
        {id: '2', vector: [], metadata: {category: 'food'}},
        {id: '3', vector: [], metadata: {category: 'electronics'}},
        {id: '4', vector: [], metadata: {category: 'drink'}},
        {id: '5', vector: [], metadata: {category: 'food'}},
      ]);

      const foodItems = await index.listItemsByMetadata({category: {'$eq': 'food'}})
      assert.deepStrictEqual(foodItems.map((item) => item.id), ["1", "2", "5"])
      const drinkItems = await index.listItemsByMetadata({category: {'$eq': 'drink'}})
      assert.deepStrictEqual(drinkItems.map((item) => item.id), ["4"])
      const clothingItems = await index.listItemsByMetadata({category: {'$eq': 'clothes'}})
      assert.deepStrictEqual(clothingItems, [])
    })

    it('returns nothing when no items in index', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();

      const items = await index.listItemsByMetadata({});
      assert.deepStrictEqual(items, []);
    })
  });
});
