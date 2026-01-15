import assert from 'node:assert';
import sinon from 'sinon';
import { LocalIndex } from './LocalIndex';
import { LocalDocument } from './LocalDocument';
import { IndexItem } from './types';
import fs from 'fs/promises';
import path from 'path';
import * as uuid from 'uuid';

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
    }, new Error('Update already in progress'));
  });

  describe('createIndex', () => {
    it('checks for existing index on creation', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex(); // create first index.json

      // create without deleteIfExists. Will reject
      await assert.rejects(async () => {
        await index.createIndex();
      }, new Error('Index already exists'));

      // create with deleteIfExists. Should remove old data
      await index.insertItem({ id: '1', vector: [1, 2, 3] });
      const lengthBefore = (await index.listItems()).length;
      assert.equal(lengthBefore, 1);

      await index.createIndex({ deleteIfExists: true, version: 2, metadata_config: {} });
      const lengthAfter = (await index.listItems()).length;
      assert.equal(lengthAfter, 0);
    });

    it('delete index if file creation fails', async () => {
      const index = new LocalIndex(testIndexDir);
      sinon.stub(fs, 'writeFile').rejects(new Error('fs error'));
      await assert.rejects(async () => {
        await index.createIndex();
      }, new Error('Error creating index'));

      await assert.rejects(async () => {
        await index.listItems();
      });
    });
  });

  describe('deleteItem', () => {
    it('does nothing when id not found', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();
      await index.beginUpdate();
      await index.insertItem(basicIndexItems[0]);
      await index.insertItem(basicIndexItems[1]);
      await index.insertItem(basicIndexItems[2]);
      await index.endUpdate();

      await assert.doesNotReject(async () => {
        await index.deleteItem('dne');
      });

      assert.equal((await index.listItems()).length, 3);
    });

    it('leaves existing empty index when last el deleted', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();
      await index.insertItem(basicIndexItems[0]);
      await index.deleteItem(basicIndexItems[0].id ?? '');
      assert.equal(await index.isIndexCreated(), true);
      assert.equal((await index.listItems()).length, 0);
    });

    it('removes elements from any position', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();
      await index.batchInsertItems([
        { id: '1', vector: [] },
        { id: '2', vector: [] },
        { id: '3', vector: [] },
        { id: '4', vector: [] },
        { id: '5', vector: [] },
      ]);

      await index.beginUpdate();
      await index.deleteItem('1');
      await index.deleteItem('3');
      await index.deleteItem('5');
      await index.endUpdate();

      assert.deepStrictEqual(await index.listItems(), [
        { id: '2', vector: [], metadata: {}, norm: 0 },
        { id: '4', vector: [], metadata: {}, norm: 0 }
      ]);
    });
  });

  describe('endUpdate', () => {
    it('throws an error if no update has begun', async () => {
      const index = new LocalIndex(testIndexDir);
      await assert.rejects(async () => {
        await index.endUpdate();
      }, new Error('No update in progress'));
    });

    it('throws an error if the index could not be saved', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();
      await index.beginUpdate();
      sinon.stub(fs, 'writeFile').rejects(new Error('fs error'));
      await assert.rejects(async () => {
        await index.endUpdate();
      }, new Error('Error saving index: Error: fs error'));
    });
  });

  describe('getIndexStats', () => {
    it('reports empty index correctly', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();
      assert.deepStrictEqual(await index.getIndexStats(), {
        version: 1,
        metadata_config: {},
        items: 0
      });
    });

    it('correctly reports non-empty index stats', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex({ version: 1, metadata_config: { indexed: [] } });
      await index.batchInsertItems(basicIndexItems);
      assert.deepStrictEqual(await index.getIndexStats(), {
        version: 1,
        metadata_config: { indexed: [] },
        items: 3
      });
    });
  });

  describe('getItem', () => {
    it('returns undefined when item not found', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();
      assert.equal(await index.getItem('1'), undefined);
    });

    it('returns requested item', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();
      await index.batchInsertItems(basicIndexItems);
      const item2 = await index.getItem('2');
      assert.equal(item2?.id, basicIndexItems[1].id);
      assert.equal(item2?.vector, basicIndexItems[1].vector);
      assert.equal((await index.listItems()).length, 3);
    });
  });

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
        { id: '1', vector: [], metadata: { category: 'food' } },
        { id: '2', vector: [], metadata: { category: 'food' } },
        { id: '3', vector: [], metadata: { category: 'electronics' } },
        { id: '4', vector: [], metadata: { category: 'drink' } },
        { id: '5', vector: [], metadata: { category: 'food' } },
      ]);

      const foodItems = await index.listItemsByMetadata({ category: { '$eq': 'food' } });
      assert.deepStrictEqual(foodItems.map((item) => item.id), ["1", "2", "5"]);

      const drinkItems = await index.listItemsByMetadata({ category: { '$eq': 'drink' } });
      assert.deepStrictEqual(drinkItems.map((item) => item.id), ["4"]);

      const clothingItems = await index.listItemsByMetadata({ category: { '$eq': 'clothes' } });
      assert.deepStrictEqual(clothingItems, []);
    });

    it('returns nothing when no items in index', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();
      const items = await index.listItemsByMetadata({});
      assert.deepStrictEqual(items, []);
    });
  });

  describe("queryItems", () => {
    it("returns empty array on empty index search", async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();
      const result = await index.queryItems([1, 2, 3], "", 10);
      assert.deepStrictEqual(result, []);
    });

    it("returns bad match when no better match exists", async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();
      await index.insertItem({ id: "1", vector: [0.9, 0, 0, 0, 0] });
      const result = await index.queryItems([0, 0, 0, 0, 0.1], "", 1);
      assert.equal(result[0]?.score, 0);
      assert.equal(result[0]?.item.id, "1");
    });

    it("returns all vectors when fewer than topK exist", async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();
      await index.batchInsertItems(basicIndexItems);
      const result = await index.queryItems([0, 0, 1], "", 10);
      assert.equal(result.length, 3);
      assert.deepStrictEqual(
        result.map(({ item }) => item.id),
        basicIndexItems.map((item) => item.id),
      );
    });

    it("filters by metadata when filter provided", async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();
      await index.batchInsertItems([
        { id: "1", vector: [1, 0, 0], metadata: { category: "food" } },
        { id: "2", vector: [0, 0, 1], metadata: { category: "drink" } },
      ]);

      const bestGeneralMatch = await index.queryItems([1, 0, 0], "", 1);
      const bestDrinkMatch = await index.queryItems([1, 0, 0], "", 1, {
        category: { $eq: "drink" },
      });

      assert.equal(bestGeneralMatch[0].item.id, "1");
      assert.equal(bestDrinkMatch[0].item.id, "2");
    });

    it("reads item metadata file when provided", async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex({ version: 1, metadata_config: { indexed: ['category'] } });
      await index.batchInsertItems([
        { id: "1", vector: [1, 0, 0] },
        { id: "2", vector: [0, 0, 1], metadata: { category: 'drink' } },
      ]);

      sinon
        .stub(fs, "readFile")
        .resolves(JSON.stringify({ category: "drink" }) as any);

      const bestDrinkMatch = await index.queryItems([1, 0, 0], "", 2, { category: { '$eq': 'drink' } });
      assert.notEqual(bestDrinkMatch[0].item.metadataFile, undefined);
      assert.equal(bestDrinkMatch[0].item.id, "2");
    });

    describe('bm25 hybrid search', () => {
      it('uses a stubbed bm25 engine and stubbed document reader (no ctor injection)', async () => {
        const index = new LocalIndex(testIndexDir);
        await index.createIndex();

        // Insert two chunks from same document to enable bm25 doc text lookup
        await index.batchInsertItems([
          { id: 'c1', vector: [1, 0, 0], metadata: { documentId: 'D1', startPos: 0, endPos: 4 } },
          { id: 'c2', vector: [0, 1, 0], metadata: { documentId: 'D1', startPos: 5, endPos: 9 } },
        ]);

        // Fake bm25 engine
        const fakeEngine: any = {
          _docs: [] as any[],
          addDoc(doc: any, id: number) { this._docs.push({ doc, id }); },
          consolidate() { /* no-op */ },
          search(_q: string) {
            // Return the first added doc for determinism
            if (this._docs.length === 0) return [];
            return [[this._docs[0].id, 0.5]];
          }
        };

        // Stub setupBm25 to install our fake engine
        sinon.stub<any, any>(index as any, 'setupBm25').callsFake(async function (this: any) {
          this._bm25Engine = fakeEngine;
        });

        // Stub LocalDocument.prototype.loadText to avoid filesystem
        sinon.stub(LocalDocument.prototype, 'loadText').resolves('SAMPLETEXT');

        // TopK=1 so semantic picks one, bm25 can add the other
        const results = await index.queryItems([1, 0, 0], 'q', 1, undefined, true);

        // Expect at least one bm25-marked result to be appended
        const hasBm25 = results.some(r => (r.item as any).metadata?.isBm25 === true);
        assert.equal(hasBm25, true);
      });

      it('covers setupBm25 + prepTask filter/each callbacks via injected deps', async () => {
        // Build an engine that stores prepTasks and forces them to run inside search()
        let storedPrepTasks: Array<(text: string) => any[]> = [];
        const fakeEngine: any = {
          defineConfig(_cfg: any) { /* no-op */ },
          definePrepTasks(tasks: Array<(text: string) => any[]>) { storedPrepTasks = tasks; },
          _docs: [] as any[],
          addDoc(doc: any, id: number) { this._docs.push({ doc, id }); },
          consolidate() { /* no-op */ },
          search(_q: string) {
            // Force execution of prep task(s) so Istanbul marks inner callbacks covered
            for (const d of this._docs) {
              for (const t of storedPrepTasks) t(d.doc.body);
            }
            return this._docs.length ? [[this._docs[0].id, 0.42]] : [];
          }
        };

        // Fake wink NLP pipeline that calls both filter callback and each callback
        const its = { type: 'type', stopWordFlag: 'stop', negationFlag: 'neg', stem: 'stem' };

        // token factory with out()
        const makeToken = (vals: Record<string, any>) => ({
          out: (k: any) => vals[k]
        });

        const tokens = [
          // passes filter, negation true => "!stem"
          makeToken({ [its.type]: 'word', [its.stopWordFlag]: false, [its.negationFlag]: true, [its.stem]: 'good' }),
          // fails filter (stop word) => dropped
          makeToken({ [its.type]: 'word', [its.stopWordFlag]: true, [its.negationFlag]: false, [its.stem]: 'the' }),
          // passes filter, negation false => "stem"
          makeToken({ [its.type]: 'word', [its.stopWordFlag]: false, [its.negationFlag]: false, [its.stem]: 'day' }),
        ];

        const fakeNlp: any = {
          its,
          readDoc(_text: string) {
            return {
              tokens() {
                return {
                  filter(fn: (t: any) => boolean) {
                    const filtered = tokens.filter(fn);
                    return {
                      each(eachFn: (t: any) => void) {
                        filtered.forEach(eachFn);
                        return undefined as any;
                      }
                    };
                  },
                  each(_fn: any) {
                    throw new Error('unexpected direct each without filter in LocalIndex.setupBm25');
                  }
                };
              }
            };
          }
        };

        const index = new LocalIndex(
          testIndexDir,
          undefined,
          {
            createBm25Engine: () => fakeEngine,
            createNlp: () => fakeNlp
          }
        );

        await index.createIndex();

        // Insert two chunks so semantic takes one and bm25 considers the other
        await index.batchInsertItems([
          { id: 'c1', vector: [1, 0, 0], metadata: { documentId: 'D1', startPos: 0, endPos: 9 } },
          { id: 'c2', vector: [0, 1, 0], metadata: { documentId: 'D1', startPos: 0, endPos: 9 } },
        ]);

        sinon.stub(LocalDocument.prototype, 'loadText').resolves('good the day');

        const results = await index.queryItems([1, 0, 0], 'q', 1, undefined, true);
        assert.ok(results.length >= 1);

        // Also sanity-check that prepTask produced expected stems (not required for coverage, but ensures execution)
        // Because engine runs prepTask on doc bodies, and token list yields "!good" and "day".
        // We can verify by re-running stored task directly:
        const produced = storedPrepTasks[0]('good the day');
        assert.deepStrictEqual(produced, ['!good', 'day']);
      });
    });
  });

  // ---------------------------
  // NEW TESTS FOR FULL COVERAGE
  // ---------------------------

  describe('insertItem/addItemToUpdate uncovered branches', () => {
    it('throws when vector is missing (Vector is required)', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();
      await assert.rejects(async () => {
        await index.insertItem({ id: 'x' } as any);
      }, new Error('Vector is required'));
    });
  });

  describe('upsertItem uncovered branches', () => {
    it('upsertItem: when no update in progress, it begins+ends update and inserts', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();

      await index.upsertItem({ id: 'u1', vector: [1, 0, 0], metadata: { a: 1 } as any });
      const items = await index.listItems();
      assert.equal(items.length, 1);
      assert.equal(items[0].id, 'u1');
      assert.deepStrictEqual(items[0].metadata, { a: 1 });
    });

    it('upsertItem: when update in progress, it does not auto-end update', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();

      await index.beginUpdate();
      await index.upsertItem({ id: 'u2', vector: [0, 1, 0] });
      // still in update; commit explicitly
      await index.endUpdate();

      const items = await index.listItems();
      assert.equal(items.length, 1);
      assert.equal(items[0].id, 'u2');
    });

    it('upsertItem: replaces existing item when id already exists (covers !unique existing branch)', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();

      await index.insertItem({ id: 'same', vector: [1, 0, 0], metadata: { a: 1 } as any });
      await index.upsertItem({ id: 'same', vector: [0, 1, 0], metadata: { a: 2 } as any });

      const item = await index.getItem('same');
      assert.ok(item);
      assert.deepStrictEqual(item!.vector, [0, 1, 0]);
      assert.deepStrictEqual(item!.metadata, { a: 2 });
    });

    it('upsertItem: adds new item when id does not exist (covers !unique else branch + find callback)', async () => {
      const index = new LocalIndex(testIndexDir);
      await index.createIndex();

      await index.insertItem({ id: 'a', vector: [1, 0, 0] });
      await index.upsertItem({ id: 'b', vector: [0, 1, 0] });

      const items = await index.listItems();
      assert.equal(items.length, 2);
      assert.deepStrictEqual(items.map(i => i.id).sort(), ['a', 'b']);
    });
  });
});