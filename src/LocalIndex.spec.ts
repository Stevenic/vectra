import assert from 'node:assert'
import sinon from 'sinon'
import { LocalIndex } from './LocalIndex'
import { IndexItem } from './types'
import fs from 'fs/promises'
import path from 'path'
import { VirtualFileStorage } from './storage'
import { LocalDocument } from './LocalDocument'

describe('LocalIndex', () => {
  const testIndexDir = path.join(__dirname, 'test_index')

  const basicIndexItems: Partial<IndexItem>[] = [
    { id: '1', vector: [1, 2, 3] },
    { id: '2', vector: [2, 3, 4] },
    { id: '3', vector: [3, 4, 5] }
  ]

  beforeEach(async () => {
    await fs.rm(testIndexDir, { recursive: true, force: true })
  })

  afterEach(async () => {
    await fs.rm(testIndexDir, { recursive: true, force: true })
    sinon.restore()
  })

  it('should create a new index', async () => {
    const index = new LocalIndex(testIndexDir)
    await index.createIndex()
    const created = await index.isIndexCreated()
    assert.equal(created, true)
    assert.equal(index.folderPath, testIndexDir)
  })

  it('exposes getters indexName and storage', async () => {
    const index = new LocalIndex(testIndexDir)
    assert.equal(index.indexName, 'index.json')
    assert.ok(index.storage)
  })

  it('blocks concurrent operations when lock is held', async () => {
    const index = new LocalIndex(testIndexDir)
    await index.createIndex()
    await index.beginUpdate()
    await assert.rejects(async () => {
      await index.beginUpdate()
    }, new Error('Update already in progress'))
  })

  describe('createIndex', () => {
    it('checks for existing index on creation', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex()

      await assert.rejects(async () => {
        await index.createIndex()
      }, new Error('Index already exists'))

      await index.insertItem({ id: '1', vector: [1, 2, 3] })
      const lengthBefore = (await index.listItems()).length
      assert.equal(lengthBefore, 1)
      await index.createIndex({ deleteIfExists: true, version: 2, metadata_config: {} })
      const lengthAfter = (await index.listItems()).length
      assert.equal(lengthAfter, 0)
    })

    it('delete index if file creation fails', async () => {
      const index = new LocalIndex(testIndexDir)
      sinon.stub(fs, 'writeFile').rejects(new Error('fs error'))

      await assert.rejects(async () => {
        await index.createIndex()
      }, new Error('Error creating index'))

      await assert.rejects(async () => {
        await index.listItems()
      })
    })

    it('persists version and metadata_config', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex({ deleteIfExists: true, version: 2, metadata_config: { indexed: [] } })

      const stats = await index.getIndexStats()
      assert.deepStrictEqual(stats, { version: 2, metadata_config: { indexed: [] }, items: 0 })
    })
  })

  describe('deleteIndex and load guard', () => {
    it('listItems before createIndex rejects with not-exist error', async () => {
      const index = new LocalIndex(testIndexDir)
      await assert.rejects(async () => index.listItems(), new Error('Index does not exist'))
    })

    it('deleteIndex removes the index and prevents further reads', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex()
      await index.insertItem({ id: 'a', vector: [1] })

      assert.equal(await index.isIndexCreated(), true)
      await index.deleteIndex()

      assert.equal(await index.isIndexCreated(), false)
      await assert.rejects(async () => index.listItems(), new Error('Index does not exist'))
    })
  })

  describe('insert/upsert validation and behavior', () => {
    it('insertItem validation: requires vector', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex()
      await index.beginUpdate()
      await assert.rejects(
        async () => index.insertItem({ id: 'x' } as any),
        new Error('Vector is required')
      )
      await index.cancelUpdate()
    })

    it('upsertItem inserts when not existing', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex()

      const inserted = await index.upsertItem({ id: 'up', vector: [9, 9] })
      assert.equal(inserted.id, 'up')
      assert.deepStrictEqual(inserted.vector, [9, 9])

      const all = await index.listItems()
      assert.equal(all.length, 1)
      assert.equal(all[0].id, 'up')
    })

    it('upsertItem replaces existing item contents', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex()

      await index.insertItem({ id: 'same', vector: [1], metadata: { a: 1 } })
      const updated = await index.upsertItem({ id: 'same', vector: [2], metadata: { a: 2 } })

      assert.equal(updated.id, 'same')
      assert.deepStrictEqual(updated.vector, [2])
      assert.deepStrictEqual(updated.metadata, { a: 2 })

      const reread = await index.getItem('same')
      assert.deepStrictEqual(reread?.vector, [2])
      assert.deepStrictEqual(reread?.metadata, { a: 2 })
    })

    it('auto-generates id when not provided and does not create metadataFile with no metadata even if indexed config exists', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex({ version: 1, metadata_config: { indexed: ['keep'] } })

      const inserted = await index.insertItem({ vector: [1, 2, 3] } as any)
      assert.ok(inserted.id && typeof inserted.id === 'string')

      const reread = await index.getItem(inserted.id)
      assert.deepStrictEqual(reread?.metadata, {})
      assert.equal((reread as any).metadataFile, undefined)
    })
  })

  describe('cancelUpdate', () => {
    it('discards staged changes', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex()

      await index.beginUpdate()
      await index.insertItem({ id: 'temp', vector: [1, 1, 1] })
      index.cancelUpdate()

      const items = await index.listItems()
      assert.deepStrictEqual(items, [])
    })
  })

  describe('isIndexCreated transitions', () => {
    it('reports false -> true -> false across lifecycle', async () => {
      const index = new LocalIndex(testIndexDir)
      assert.equal(await index.isIndexCreated(), false)

      await index.createIndex()
      assert.equal(await index.isIndexCreated(), true)

      await index.deleteIndex()
      assert.equal(await index.isIndexCreated(), false)
    })
  })

  describe('deleteItem', () => {
    it('does nothing when id not found', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex()
      await index.beginUpdate()
      await index.insertItem(basicIndexItems[0])
      await index.insertItem(basicIndexItems[1])
      await index.insertItem(basicIndexItems[2])
      await index.endUpdate()

      await assert.doesNotReject(async () => {
        await index.deleteItem('dne')
      })
      assert.equal((await index.listItems()).length, 3)
    })

    it('leaves existing empty index when last el deleted', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex()
      await index.insertItem(basicIndexItems[0])

      await index.deleteItem(basicIndexItems[0].id ?? '')
      assert.equal(await index.isIndexCreated(), true)
      assert.equal((await index.listItems()).length, 0)
    })

    it('removes elements from any position', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex()
      await index.batchInsertItems([
        { id: '1', vector: [] },
        { id: '2', vector: [] },
        { id: '3', vector: [] },
        { id: '4', vector: [] },
        { id: '5', vector: [] }
      ])

      await index.beginUpdate()
      await index.deleteItem('1')
      await index.deleteItem('3')
      await index.deleteItem('5')
      await index.endUpdate()

      assert.deepStrictEqual(await index.listItems(), [
        { id: '2', vector: [], metadata: {}, norm: 0 },
        { id: '4', vector: [], metadata: {}, norm: 0 }
      ])
    })

    it('no-op delete while update active when id missing', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex()
      await index.batchInsertItems([
        { id: '1', vector: [1] },
        { id: '2', vector: [2] }
      ])

      await index.beginUpdate()
      await assert.doesNotReject(async () => index.deleteItem('missing'))
      await index.endUpdate()

      const items = await index.listItems()
      assert.deepStrictEqual(items.map(i => i.id), ['1', '2'])
    })
  })

  describe('endUpdate', () => {
    it('throws an error if no update has begun', async () => {
      const index = new LocalIndex(testIndexDir)

      await assert.rejects(async () => {
        await index.endUpdate()
      }, new Error('No update in progress'))
    })

    it('throws an error if the index could not be saved', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex()
      await index.beginUpdate()

      sinon.stub(fs, 'writeFile').rejects(new Error('fs error'))

      await assert.rejects(async () => {
        await index.endUpdate()
      }, new Error('Error saving index: Error: fs error'))
    })
  })

  describe('getIndexStats', () => {
    it('reports empty index correctly', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex()

      assert.deepStrictEqual(await index.getIndexStats(), {
        version: 1,
        metadata_config: {},
        items: 0
      })
    })

    it('correctly reports non-empty index stats', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex({ version: 1, metadata_config: { indexed: [] } })
      await index.batchInsertItems(basicIndexItems)

      assert.deepStrictEqual(await index.getIndexStats(), {
        version: 1,
        metadata_config: { indexed: [] },
        items: 3
      })
    })
  })

  describe('getItem', () => {
    it('returns undefined when item not found', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex()

      assert.equal(await index.getItem('1'), undefined)
    })

    it('returns requested item', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex()
      await index.batchInsertItems(basicIndexItems)

      const item2 = await index.getItem('2')
      assert.equal(item2?.id, basicIndexItems[1].id)
      assert.deepStrictEqual(item2?.vector, basicIndexItems[1].vector)
      assert.equal((await index.listItems()).length, 3)
    })
  })

  describe('batchInsertItems', () => {
    it('should insert provided items', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex()

      const newItems = await index.batchInsertItems(basicIndexItems)

      assert.equal(newItems.length, 3)

      const retrievedItems = await index.listItems()
      assert.equal(retrievedItems.length, 3)
    })

    it('on id collision - cancel batch insert & bubble up error', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex()

      await index.insertItem({ id: '2', vector: [9, 9, 9] })

      await assert.rejects(
        async () => {
          await index.batchInsertItems(basicIndexItems)
        },
        {
          name: 'Error',
          message: 'Item with id 2 already exists'
        }
      )

      const storedItems = await index.listItems()
      assert.equal(storedItems.length, 1)
    })
  })

  describe('listItemsByMetadata', () => {
    it('returns items matching metadata filter', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex()
      await index.batchInsertItems([
        { id: '1', vector: [], metadata: { category: 'food' } },
        { id: '2', vector: [], metadata: { category: 'food' } },
        { id: '3', vector: [], metadata: { category: 'electronics' } },
        { id: '4', vector: [], metadata: { category: 'drink' } },
        { id: '5', vector: [], metadata: { category: 'food' } }
      ])

      const foodItems = await index.listItemsByMetadata({ category: { $eq: 'food' } })
      assert.deepStrictEqual(foodItems.map(item => item.id), ['1', '2', '5'])
      const drinkItems = await index.listItemsByMetadata({ category: { $eq: 'drink' } })
      assert.deepStrictEqual(drinkItems.map(item => item.id), ['4'])
      const clothingItems = await index.listItemsByMetadata({ category: { $eq: 'clothes' } })
      assert.deepStrictEqual(clothingItems, [])
    })

    it('returns nothing when no items in index', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex()

      const items = await index.listItemsByMetadata({})
      assert.deepStrictEqual(items, [])
    })

    it('empty filter {} with items returns all', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex()
      await index.batchInsertItems([
        { id: 'a', vector: [1] },
        { id: 'b', vector: [2] }
      ])

      const items = await index.listItemsByMetadata({})
      assert.deepStrictEqual(items.map(i => i.id), ['a', 'b'])
    })
  })

  describe('metadata indexing behavior', () => {
    it('stores only indexed metadata in index and writes full metadata to external file', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex({ version: 1, metadata_config: { indexed: ['keep'] } })

      const realWriteFile = fs.writeFile.bind(fs)
      const writes: { file: string | Buffer | URL; data: any }[] = []
      sinon.stub(fs, 'writeFile').callsFake(async (file: any, data: any, options?: any) => {
        writes.push({ file, data })
        return realWriteFile(file, data, options as any)
      })

      await index.insertItem({ id: 'm1', vector: [1], metadata: { keep: 'x', drop: 'y' } })

      const items = await index.listItems()
      const stored = items.find(i => i.id === 'm1')!
      assert.deepStrictEqual(stored.metadata, { keep: 'x' })
      assert.ok((stored as any).metadataFile)

      const textPayloads = writes
        .map(w => (typeof w.data === 'string' ? w.data : w.data?.toString?.()))
        .filter(Boolean) as string[]

      const hasFullMetadata = textPayloads.some(t => {
        try {
          const obj = JSON.parse(t)
          return obj && obj.keep === 'x' && obj.drop === 'y'
        } catch {
          return false
        }
      })
      assert.equal(hasFullMetadata, true)
    })

    it('does not write external file when metadata only contains indexed keys', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex({ version: 1, metadata_config: { indexed: ['only'] } })

      await index.insertItem({ id: 'm2', vector: [1], metadata: { only: 'ok' } })
      const item = await index.getItem('m2')

      assert.deepStrictEqual(item?.metadata, { only: 'ok' })
      assert.equal((item as any).metadataFile, undefined)
    })
  })

  describe('queryItems', () => {
    it('upsertItem uses the in-progress update path when _update is present', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex()

      await index.beginUpdate()
      // goes through the if (this._update) early return branch in upsertItem
      const up = await index.upsertItem({ id: 'inplace', vector: [7, 7], metadata: { k: 'v' } })
      // not persisted until endUpdate
      let items = await index.listItems()
      assert.equal(items.length, 0)

      await index.endUpdate()
      items = await index.listItems()
      assert.equal(items.length, 1)
      assert.equal(items[0].id, 'inplace')
      assert.deepStrictEqual(items[0].metadata, { k: 'v' })
    })

    it('with no indexed config, full metadata is stored inline and no metadataFile is written', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex({ version: 1 /* metadata_config undefined => inline */ })

      await index.insertItem({ id: 'fullMd', vector: [1], metadata: { a: 1, b: 2 } })
      const item = await index.getItem('fullMd')
      assert.deepStrictEqual(item?.metadata, { a: 1, b: 2 })
      assert.equal((item as any).metadataFile, undefined)
    })

    it('BM25 uses the default docReader (LocalDocument.loadText) when not injected', async () => {
      // stub LocalDocument.loadText so default docReader path runs without touching disk
      const stub = sinon.stub(LocalDocument.prototype, 'loadText').resolves('Hello default docReader text')
      const addDocSpy = sinon.spy()
      const fakeEngine = {
        defineConfig: sinon.stub(),
        definePrepTasks: sinon.stub(),
        addDoc: (...a: any[]) => addDocSpy(...a),
        consolidate: sinon.stub(),
        search: (_q: string) => []
      }

      const index = new LocalIndex(testIndexDir, undefined, { bm25Factory: () => fakeEngine /* no docReader injected */ })
      await index.createIndex()
      await index.batchInsertItems([
        { id: 'a', vector: [1, 0, 0], metadata: { documentId: 'docA', startPos: 0, endPos: 4 } },
        { id: 'b', vector: [0, 1, 0], metadata: { documentId: 'docB', startPos: 0, endPos: 4 } }
      ])

      await index.queryItems([1, 0, 0], 'kw', 1, undefined, true)
      assert.ok(addDocSpy.called) // default docReader loaded and chunks added
      stub.restore()
    })

    it('executes the prepTask defined in setupBm25 to cover tokenization/negation pipeline', async () => {
      let capturedTasks: ((text: string) => string[])[] = []
      const fakeEngine = {
        defineConfig: sinon.stub(),
        definePrepTasks: (arr: any[]) => { capturedTasks = arr },
        addDoc: sinon.stub(),
        consolidate: sinon.stub(),
        search: (_q: string) => []
      }
      const index = new LocalIndex(testIndexDir, undefined, { bm25Factory: () => fakeEngine, docReader: async () => 'text' })
      await index.createIndex()
      // trigger setupBm25 via a BM25 query
      await index.batchInsertItems([{ id: 'x', vector: [1], metadata: { documentId: 'd', startPos: 0, endPos: 0 } }])
      await index.queryItems([1], 'q', 1, undefined, true)

      assert.ok(Array.isArray(capturedTasks) && capturedTasks.length === 1)
      const tokens = capturedTasks[0]("I don't like complicated tokens!")
      // ensure pipeline ran: non-empty tokens, punctuation removed, possible negation handling
      assert.ok(Array.isArray(tokens) && tokens.length > 0)
    })

    it('upsertItem uses the in-progress update path when _update is present', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex()

      await index.beginUpdate()
      await index.upsertItem({ id: 'inplace', vector: [7, 7], metadata: { k: 'v' } })

      // Not persisted yet because endUpdate not called
      let items = await index.listItems()
      assert.equal(items.length, 0)

      await index.endUpdate()
      items = await index.listItems()
      assert.equal(items.length, 1)
      assert.equal(items[0].id, 'inplace')
      assert.deepStrictEqual(items[0].metadata, { k: 'v' })
    })

    it('with no indexed config, full metadata is stored inline and no metadataFile is written', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex({ version: 1 }) // metadata_config undefined => inline

      await index.insertItem({ id: 'fullMd', vector: [1], metadata: { a: 1, b: 2 } })
      const item = await index.getItem('fullMd')
      assert.deepStrictEqual(item?.metadata, { a: 1, b: 2 })
      assert.equal((item as any).metadataFile, undefined)
    })

    it('BM25 uses the default docReader (LocalDocument.loadText) when not injected', async () => {
      const stub = sinon.stub(LocalDocument.prototype, 'loadText').resolves('Hello default docReader text')
      const addDocSpy = sinon.spy()
      const fakeEngine = {
        defineConfig: sinon.stub(),
        definePrepTasks: sinon.stub(),
        addDoc: (...a: any[]) => addDocSpy(...a),
        consolidate: sinon.stub(),
        search: (_q: string) => []
      }

      const index = new LocalIndex(testIndexDir, undefined, { bm25Factory: () => fakeEngine })
      await index.createIndex()
      await index.batchInsertItems([
        { id: 'a', vector: [1, 0, 0], metadata: { documentId: 'docA', startPos: 0, endPos: 4 } },
        { id: 'b', vector: [0, 1, 0], metadata: { documentId: 'docB', startPos: 0, endPos: 4 } }
      ])

      await index.queryItems([1, 0, 0], 'kw', 1, undefined, true)
      assert.ok(addDocSpy.called)

      stub.restore()
    })

    it('executes the prepTask defined in setupBm25 to cover tokenization/negation pipeline', async () => {
      let capturedTasks: ((text: string) => string[])[] = []
      const fakeEngine = {
        defineConfig: sinon.stub(),
        definePrepTasks: (arr: any[]) => { capturedTasks = arr },
        addDoc: sinon.stub(),
        consolidate: sinon.stub(),
        search: (_q: string) => []
      }

      const index = new LocalIndex(testIndexDir, undefined, { bm25Factory: () => fakeEngine, docReader: async () => 'text' })
      await index.createIndex()
      await index.batchInsertItems([{ id: 'x', vector: [1], metadata: { documentId: 'd', startPos: 0, endPos: 0 } }])
      await index.queryItems([1], 'q', 1, undefined, true)

      assert.ok(Array.isArray(capturedTasks) && capturedTasks.length === 1)
      const tokens = capturedTasks[0]("I don't like complicated tokens!")
      assert.ok(Array.isArray(tokens) && tokens.length > 0)
    })

    it('returns empty array on empty index search', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex()

      const result = await index.queryItems([1, 2, 3], '', 10)
      assert.deepStrictEqual(result, [])
    })

    it('returns bad match when no better match exists', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex()
      await index.insertItem({ id: '1', vector: [0.9, 0, 0, 0, 0] })

      const result = await index.queryItems([0, 0, 0, 0, 0.1], '', 1)
      assert.equal(result[0]?.score, 0)
      assert.equal(result[0]?.item.id, '1')
    })

    it('returns all vectors when fewer than topK exist', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex()
      await index.batchInsertItems(basicIndexItems)

      const result = await index.queryItems([0, 0, 1], '', 10)
      assert.equal(result.length, 3)
      assert.deepStrictEqual(
        result.map(({ item }) => item.id),
        basicIndexItems.map(item => item.id)
      )
    })

    it('limits results to topK when more items exist', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex()
      await index.batchInsertItems([
        { id: 'a', vector: [1, 0, 0] },
        { id: 'b', vector: [0, 1, 0] },
        { id: 'c', vector: [0, 0, 1] },
        { id: 'd', vector: [1, 1, 0] },
        { id: 'e', vector: [0, 1, 1] }
      ])

      const result = await index.queryItems([1, 0, 0], '', 2)
      assert.equal(result.length, 2)
    })

    it('filters by metadata when filter provided', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex()
      await index.batchInsertItems([
        { id: '1', vector: [1, 0, 0], metadata: { category: 'food' } },
        { id: '2', vector: [0, 0, 1], metadata: { category: 'drink' } }
      ])

      const bestGeneralMatch = await index.queryItems([1, 0, 0], '', 1)
      const bestDrinkMatch = await index.queryItems([1, 0, 0], '', 1, {
        category: { $eq: 'drink' }
      })

      assert.equal(bestGeneralMatch[0].item.id, '1')
      assert.equal(bestDrinkMatch[0].item.id, '2')
    })

    it('reads item metadata file when provided', async () => {
      const index = new LocalIndex(testIndexDir)
      await index.createIndex({ version: 1, metadata_config: { indexed: ['category'] } })
      await index.batchInsertItems([
        { id: '1', vector: [1, 0, 0] },
        { id: '2', vector: [0, 0, 1], metadata: { category: 'drink', extra: 'x' } }
      ])

      sinon.stub(fs, 'readFile').resolves(JSON.stringify({ category: 'drink', extra: 'x' }))

      const bestDrinkMatch = await index.queryItems([1, 0, 0], '', 2, { category: { $eq: 'drink' } })

      assert.notEqual(bestDrinkMatch[0].item.metadataFile, undefined)
      assert.equal(bestDrinkMatch[0].item.id, '2')
    })

    it('appends BM25 results when isBm25=true (tuple results)', async () => {
      // Inject a fake BM25 engine and docReader
      const addDocSpy = sinon.spy()
      const consolidateSpy = sinon.spy()
      const fakeEngine = {
        defineConfig: sinon.stub(),
        definePrepTasks: sinon.stub(),
        addDoc: (...a: any[]) => addDocSpy(...a),
        consolidate: (...a: any[]) => consolidateSpy(...a),
        search: (q: string) => {
          void q
          // results as tuples [index, score]
          return [[0, 0.123], [1, 0.122]]
        }
      }
      const index = new LocalIndex(
        testIndexDir,
        undefined,
        {
          bm25Factory: () => fakeEngine,
          docReader: async (_docId: string) => 'SAMPLETEXT'
        }
      )
      await index.createIndex()

      await index.batchInsertItems([
        { id: 's1', vector: [1, 0, 0], metadata: { category: 'alpha', documentId: 'd1', startPos: 0, endPos: 3 } },
        { id: 's2', vector: [0, 1, 0], metadata: { category: 'beta', documentId: 'd2', startPos: 0, endPos: 3 } },
        { id: 's3', vector: [0, 0, 1], metadata: { category: 'gamma', documentId: 'd3', startPos: 0, endPos: 3 } }
      ])

      const topK = 1
      const results = await index.queryItems([1, 0, 0], 'keyword', topK, undefined, true)

      assert.ok(results.length >= 1)
      assert.ok(results.some(r => (r.item.metadata as any)?.isBm25 === true))
      assert.ok(consolidateSpy.calledOnce)
      // only non-top items should have been offered to addDoc (top item excluded)
      assert.ok(addDocSpy.callCount >= 1)
    })

    it('BM25 indexes only non-top items with document metadata, calls consolidate, and swallows load errors', async () => {
      // docReader returns text for docB, throws for docC
      const addDocSpy = sinon.spy()
      const consolidateSpy = sinon.spy()
      const fakeEngine = {
        defineConfig: sinon.stub(),
        definePrepTasks: sinon.stub(),
        addDoc: (...a: any[]) => addDocSpy(...a),
        consolidate: (...a: any[]) => consolidateSpy(...a),
        search: (_q: string) => {
          // invalid tuple index is ignored
          return [[999, 0.77]]
        }
      }
      const docReader = async (docId: string) => {
        if (docId === 'docB') return 'ABCDEFGHIJ'
        if (docId === 'docC') throw new Error('load failed')
        return ''
      }

      const index = new LocalIndex(testIndexDir, undefined, { bm25Factory: () => fakeEngine, docReader })
      await index.createIndex()

      await index.batchInsertItems([
        { id: 'sTop', vector: [1, 0, 0], metadata: { documentId: 'docA', startPos: 0, endPos: 4 } },
        { id: 'd1', vector: [0, 1, 0], metadata: { documentId: 'docB', startPos: 0, endPos: 4 } },
        { id: 'd2', vector: [0, 0, 1], metadata: { documentId: 'docC', startPos: 0, endPos: 4 } }
      ])

      const res = await index.queryItems([1, 0, 0], 'kw', 1, undefined, true)
      assert.equal(addDocSpy.callCount, 1) // only d1 added; d2 threw; sTop excluded
      assert.equal(consolidateSpy.callCount, 1)
      assert.ok(res.length >= 1)
    })

    it('BM25 object results are appended and marked isBm25 even if item is undefined', async () => {
      const fakeEngine = {
        defineConfig: sinon.stub(),
        definePrepTasks: sinon.stub(),
        addDoc: sinon.stub(),
        consolidate: sinon.stub(),
        search: (_q: string) => [{ item: undefined, score: 0.55 }]
      }
      const index = new LocalIndex(
        testIndexDir,
        undefined,
        { bm25Factory: () => fakeEngine, docReader: async () => 'YY' }
      )
      await index.createIndex()
      await index.batchInsertItems([
        { id: 'x1', vector: [1, 0], metadata: { documentId: 'doc1', startPos: 0, endPos: 1 } },
        { id: 'x2', vector: [0, 1], metadata: { documentId: 'doc2', startPos: 0, endPos: 1 } }
      ])

      const res = await index.queryItems([1, 0], 'any', 1, undefined, true)
      assert.ok(res.some(r => (r.item.metadata as any)?.isBm25 === true))
    })

    it('BM25 engine missing addDoc/consolidate does not throw and returns semantic results', async () => {
      const fakeEngine = {
        defineConfig: sinon.stub(),
        definePrepTasks: sinon.stub(),
        search: (_q: string) => []
      }
      const index = new LocalIndex(
        testIndexDir,
        undefined,
        { bm25Factory: () => fakeEngine, docReader: async () => 'YY' }
      )
      await index.createIndex()

      await index.batchInsertItems([
        { id: 's1', vector: [1, 0], metadata: { documentId: 'doc1', startPos: 0, endPos: 1 } },
        { id: 's2', vector: [0, 1], metadata: { documentId: 'doc2', startPos: 0, endPos: 1 } }
      ])

      const res = await index.queryItems([1, 0], 'kw', 1, undefined, true)
      assert.ok(res.length >= 1)
      assert.ok(res.every(r => !(r.item.metadata as any)?.isBm25))
    })
  })

  describe('VirtualFileStorage (in-memory)', () => {
    it('works end-to-end in-memory without touching disk', async () => {
      const storage = new VirtualFileStorage()
      const index = new LocalIndex('mem://idx', storage)
      await index.createIndex({ version: 3, metadata_config: { indexed: ['t'] } })
      await index.insertItem({ vector: [1], metadata: { t: 'x', other: 'y' } })
      const stats = await index.getIndexStats()
      assert.deepStrictEqual(stats, { version: 3, metadata_config: { indexed: ['t'] }, items: 1 })
    })
  })
})