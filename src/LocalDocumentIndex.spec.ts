import * as path from 'path';
import { strict as assert } from 'node:assert';
import { describe, it, beforeEach } from 'mocha';
import { LocalDocumentIndex, LocalDocumentIndexConfig } from './LocalDocumentIndex';
import { EmbeddingsModel, EmbeddingsResponse, Tokenizer } from './types';
import { FileStorage, FileDetails } from './storage';

class FakeEmbeddings implements EmbeddingsModel {
  maxTokens = 10;
  createEmbeddingsCalls: (string | string[])[] = [];
  createEmbeddingsResponses: EmbeddingsResponse[] = [];
  async createEmbeddings(inputs: string | string[]): Promise<EmbeddingsResponse> {
    this.createEmbeddingsCalls.push(inputs);
    if (this.createEmbeddingsResponses.length > 0) {
      return this.createEmbeddingsResponses.shift()!;
    }
    const arr = Array.isArray(inputs) ? inputs : [inputs];
    return { status: 'success', output: arr.map(() => [0.1, 0.2]) };
  }
}

class SimpleTokenizer implements Tokenizer {
  encode(text: string): number[] {
    return Array.from(text).map(ch => ch.charCodeAt(0));
  }
  decode(tokens: number[]): string {
    return tokens.map(t => String.fromCharCode(t)).join('');
  }
}

class FakeStorage implements FileStorage {
  files: Map<string, string> = new Map();
  folders: Set<string> = new Set();
  pathExistsCalls: string[] = [];
  readFileCalls: string[] = [];
  upsertFileCalls: { path: string; content: string }[] = [];
  deleteFileCalls: string[] = [];
  createdFolders: string[] = [];
  deletedFolders: string[] = [];
  createdFiles: string[] = [];
  async createFile(filePath: string, content: Buffer | string): Promise<void> {
    if (this.files.has(filePath)) throw new Error('File already exists');
    this.createdFiles.push(filePath);
    const text = Buffer.isBuffer(content) ? content.toString('utf8') : content;
    this.files.set(filePath, text);
  }
  async createFolder(folderPath: string): Promise<void> {
    this.createdFolders.push(folderPath);
    this.folders.add(folderPath);
  }
  async deleteFile(filePath: string): Promise<void> {
    this.deleteFileCalls.push(filePath);
    if (!this.files.has(filePath)) {
      throw new Error('File not found');
    }
    this.files.delete(filePath);
  }
  async deleteFolder(folderPath: string): Promise<void> {
    this.deletedFolders.push(folderPath);
    for (const key of [...this.files.keys()]) {
      if (key.startsWith(folderPath)) this.files.delete(key);
    }
    this.folders.delete(folderPath);
  }
  async getDetails(fileOrFolderPath: string): Promise<FileDetails> {
    if (this.folders.has(fileOrFolderPath)) {
      return { name: path.basename(fileOrFolderPath), path: fileOrFolderPath, isFolder: true };
    }
    if (this.files.has(fileOrFolderPath)) {
      return { name: path.basename(fileOrFolderPath), path: fileOrFolderPath, isFolder: false };
    }
    throw new Error('Path not found');
  }
  async listFiles(folderPath: string, filter: 'files' | 'folders' | 'all' = 'all'): Promise<FileDetails[]> {
    const results: FileDetails[] = [];
    for (const f of this.folders) {
      const parent = path.dirname(f);
      if (parent === folderPath) {
        if (filter === 'all' || filter === 'folders') {
          results.push({ name: path.basename(f), path: f, isFolder: true });
        }
      }
    }
    for (const f of this.files.keys()) {
      const parent = path.dirname(f);
      if (parent === folderPath) {
        if (filter === 'all' || filter === 'files') {
          results.push({ name: path.basename(f), path: f, isFolder: false });
        }
      }
    }
    return results;
  }
  async pathExists(fileOrFolderPath: string): Promise<boolean> {
    this.pathExistsCalls.push(fileOrFolderPath);
    return this.files.has(fileOrFolderPath) || this.folders.has(fileOrFolderPath);
  }
  async readFile(filePath: string): Promise<Buffer> {
    this.readFileCalls.push(filePath);
    if (!this.files.has(filePath)) throw new Error('File not found');
    return Buffer.from(this.files.get(filePath)!, 'utf8');
  }
  async upsertFile(filePath: string, content: Buffer | string): Promise<void> {
    const text = Buffer.isBuffer(content) ? content.toString('utf8') : content;
    this.upsertFileCalls.push({ path: filePath, content: text });
    this.files.set(filePath, text);
  }
}

describe('LocalDocumentIndex', () => {
  let storage: FakeStorage;
  let embeddings: FakeEmbeddings;
  let tokenizer: SimpleTokenizer;
  let index: LocalDocumentIndex;
  const folderPath = '/fake/path';
  const indexJsonPath = path.join(folderPath, 'index.json');

  beforeEach(() => {
    storage = new FakeStorage();
    embeddings = new FakeEmbeddings();
    tokenizer = new SimpleTokenizer();
    storage.files.set(indexJsonPath, JSON.stringify({ version: 1, metadata_config: {}, items: [] }));
    const config: LocalDocumentIndexConfig = { folderPath, embeddings, tokenizer, storage };
    index = new LocalDocumentIndex(config);
  });

  describe('constructor and getters', () => {
    it('uses defaults when not provided (GPT3Tokenizer, undefined embeddings)', () => {
      const idx = new LocalDocumentIndex({ folderPath });
      assert.equal(idx.tokenizer.constructor.name, 'GPT3Tokenizer');
      assert.equal(idx.embeddings, undefined);
    });
    it('uses provided tokenizer and embeddings', () => {
      const fakeTok: Tokenizer = new SimpleTokenizer();
      const idx = new LocalDocumentIndex({ folderPath, tokenizer: fakeTok, embeddings, storage });
      assert.equal(idx.tokenizer, fakeTok);
      assert.equal(idx.embeddings, embeddings);
    });
  });

  describe('isCatalogCreated', () => {
    it('returns true if catalog.json exists at correct path', async () => {
      const catalogPath = path.join(folderPath, 'catalog.json');
      storage.files.set(catalogPath, '{}');
      const exists = await index.isCatalogCreated();
      assert.equal(exists, true);
      assert.equal(storage.pathExistsCalls[0], catalogPath);
    });
    it('returns false if catalog.json does not exist', async () => {
      const exists = await index.isCatalogCreated();
      assert.equal(exists, false);
    });
  });

  describe('loadIndexData', () => {
    it('early returns if catalog already loaded (no catalog read)', async () => {
      (index as any)._catalog = { version: 1, count: 0, uriToId: {}, idToUri: {} };
      await (index as any).loadIndexData(); // base will read index.json; catalog should not be read
      const catalogPath = path.join(folderPath, 'catalog.json');
      const catalogReads = storage.readFileCalls.filter(p => p === catalogPath).length;
      assert.equal(catalogReads, 0);
    });

    it('loads existing catalog from storage', async () => {
      const catalogPath = path.join(folderPath, 'catalog.json');
      const catalogData = JSON.stringify({ version: 1, count: 2, uriToId: { a: 'id1' }, idToUri: { id1: 'a' } });
      storage.files.set(catalogPath, catalogData);
      const loaded = new LocalDocumentIndex({ folderPath, storage, tokenizer });
      (storage.files).set(indexJsonPath, JSON.stringify({ version: 1, metadata_config: {}, items: [] }));
      await (loaded as any).loadIndexData();
      assert.deepEqual((loaded as any)._catalog, JSON.parse(catalogData));
    });

    it('creates new catalog if none exists and persists it', async () => {
      const newIndex = new LocalDocumentIndex({ folderPath, storage, tokenizer });
      await (newIndex as any).loadIndexData();
      const catalogPath = path.join(folderPath, 'catalog.json');
      assert(storage.upsertFileCalls.some(c => c.path === catalogPath));
      const catalog = (newIndex as any)._catalog;
      assert.equal(catalog.version, 1);
      assert.equal(catalog.count, 0);
      assert.deepEqual(catalog.uriToId, {});
      assert.deepEqual(catalog.idToUri, {});
    });

    it('wraps error when failing to create catalog', async () => {
      const failing = new LocalDocumentIndex({ folderPath, storage, tokenizer });
      const orig = storage.upsertFile.bind(storage);
      storage.upsertFile = async (p, c) => {
        if (p.endsWith('catalog.json')) throw new Error('disk error');
        return orig(p, c);
      };
      await assert.rejects((failing as any).loadIndexData(), /Error creating document catalog: Error: disk error/);
    });
  });

  describe('getDocumentId and getDocumentUri', () => {
    beforeEach(() => {
      (index as any)._catalog = { version: 1, count: 1, uriToId: { doc1: 'id1' }, idToUri: { id1: 'doc1' } };
    });
    it('returns id for known uri', async () => {
      assert.equal(await index.getDocumentId('doc1'), 'id1');
    });
    it('returns undefined for unknown uri', async () => {
      assert.equal(await index.getDocumentId('nope'), undefined);
    });
    it('returns uri for known id', async () => {
      assert.equal(await index.getDocumentUri('id1'), 'doc1');
    });
    it('returns undefined for unknown id', async () => {
      assert.equal(await index.getDocumentUri('nope'), undefined);
    });
  });

  describe('getCatalogStats', () => {
    it('returns catalog stats merged with index stats', async () => {
      (index as any)._catalog = { version: 1, count: 2, uriToId: {}, idToUri: {} };
      (index as any).getIndexStats = async () => ({ items: 5, metadata_config: { indexed: ['a'] } });
      const stats = await index.getCatalogStats();
      assert.equal(stats.version, 1);
      assert.equal(stats.documents, 2);
      assert.equal(stats.chunks, 5);
      assert.deepEqual(stats.metadata_config, { indexed: ['a'] });
    });
  });

  describe('deleteDocument', () => {
    it('returns early if document not found', async () => {
      const result = await index.deleteDocument('missing');
      assert.equal(result, undefined);
    });

    it('successfully deletes chunks, updates catalog, and removes files', async () => {
      const uri = 'doc://one';
      const documentId = 'id-1';
      (index as any)._catalog = { version: 1, count: 1, uriToId: { [uri]: documentId }, idToUri: { [documentId]: uri } };
      storage.files.set(path.join(folderPath, `${documentId}.txt`), 'hello');
      storage.files.set(path.join(folderPath, `${documentId}.json`), '{"k":"v"}');
      (index as any).listItemsByMetadata = async () => [{ id: 'chunk-1', metadata: { documentId } }];
      (index as any).deleteItem = async () => {};
      await index.deleteDocument(uri);
      assert(!storage.files.has(path.join(folderPath, `${documentId}.txt`)));
      assert(!storage.files.has(path.join(folderPath, `${documentId}.json`)));
      assert.equal((index as any)._catalog.count, 0);
      assert.equal((index as any)._catalog.uriToId[uri], undefined);
      assert.equal((index as any)._catalog.idToUri[documentId], undefined);
    });

    it('cancels update and throws when deleteItem fails', async () => {
      const uri = 'doc://err';
      const documentId = 'id-err';
      (index as any)._catalog = { version: 1, count: 1, uriToId: { [uri]: documentId }, idToUri: { [documentId]: uri } };
      (index as any).listItemsByMetadata = async () => [{ id: 'chunk-1', metadata: { documentId } }];
      (index as any).deleteItem = async () => { throw new Error('delete error'); };
      await assert.rejects(index.deleteDocument(uri), /Error deleting document "doc:\/\/err": Error: delete error/);
    });

    it('wraps error when deleting text file fails and ignores metadata deletion failures', async () => {
      const uri = 'doc://bad-delete';
      const documentId = 'id-text-err';
      (index as any)._catalog = { version: 1, count: 1, uriToId: { [uri]: documentId }, idToUri: { [documentId]: uri } };
      (index as any).listItemsByMetadata = async () => [];
      (index as any).deleteItem = async () => {};
      const originalDelete = storage.deleteFile.bind(storage);
      storage.deleteFile = async (filePath: string) => {
        if (filePath.endsWith('.txt')) throw new Error('delete text error');
        return originalDelete(filePath);
      };
      await assert.rejects(index.deleteDocument(uri), /Error removing text file for document "doc:\/\/bad-delete" from disk: Error: delete text error/);

      (index as any)._catalog = { version: 1, count: 1, uriToId: { [uri]: documentId }, idToUri: { [documentId]: uri } };
      storage.files.set(path.join(folderPath, `${documentId}.txt`), 'x');
      storage.files.set(path.join(folderPath, `${documentId}.json`), '{}');
      storage.deleteFile = async (filePath: string) => {
        if (filePath.endsWith('.json')) throw new Error('delete json error');
        return originalDelete(filePath);
      };
      await index.deleteDocument(uri);
      assert(!storage.files.has(path.join(folderPath, `${documentId}.txt`)));
    });
  });

  describe('upsertDocument', () => {
    it('throws if embeddings not configured', async () => {
      const idx = new LocalDocumentIndex({ folderPath, storage, tokenizer });
      await assert.rejects(idx.upsertDocument('uri', 'text'), /Embeddings model not configured/);
    });

    it('deletes existing document when re-inserting same uri', async () => {
      const uri = 'doc://exists';
      const existingId = 'doc-1';
      (index as any)._catalog = { version: 1, count: 1, uriToId: { [uri]: existingId }, idToUri: { [existingId]: uri } };
      let deleteCalled = false;
      (index as any).deleteDocument = async () => { deleteCalled = true; };
      (index as any).insertItem = async () => {};
      embeddings.createEmbeddingsResponses.push({ status: 'success', output: [[0.01, 0.02]] });
      const doc = await index.upsertDocument(uri, 'hello world');
      assert(deleteCalled);
      assert.equal(doc.uri, uri);
    });

    it('infers docType from uri when not provided and writes files, updates catalog', async () => {
      (index as any).insertItem = async () => {};
      embeddings.createEmbeddingsResponses.push({ status: 'success', output: [[0.1, 0.2]] });
      const metadata = { author: 'test' };
      const doc = await index.upsertDocument('file.md', 'content here', undefined, metadata);
      const textPath = path.join(folderPath, `${doc.id}.txt`);
      const metaPath = path.join(folderPath, `${doc.id}.json`);
      assert(storage.files.has(textPath));
      assert(storage.files.has(metaPath));
      assert.equal((index as any)._catalog.count, 1);
      assert.equal((index as any)._catalog.idToUri[doc.id], 'file.md');
      assert.equal((index as any)._catalog.uriToId['file.md'], doc.id);
    });

    it('batches chunk embeddings using embeddings.maxTokens and calls createEmbeddings per batch', async () => {
      const longText = 'a '.repeat(30);
      const calls: (string | string[])[] = [];
      embeddings.createEmbeddings = async (inputs: string | string[]) => {
        calls.push(inputs);
        const arr = Array.isArray(inputs) ? inputs : [inputs];
        return { status: 'success', output: arr.map(() => [0.1, 0.2]) };
      };
      (index as any).insertItem = async () => {};
      await index.upsertDocument('file.txt', longText);
      assert(calls.length > 1);
    });

    it('wraps embedding generation errors and non-success statuses', async () => {
      embeddings.createEmbeddings = async () => { throw new Error('fail'); };
      await assert.rejects(index.upsertDocument('u', 't'), /Error generating embeddings: Error: fail/);
      embeddings.createEmbeddings = async () => ({ status: 'error', message: 'bad' } as any);
      await assert.rejects(index.upsertDocument('u', 't'), /Error generating embeddings: bad/);
    });

    it('cancels update and throws when insertItem fails', async () => {
      embeddings.createEmbeddingsResponses.push({ status: 'success', output: [[0.1, 0.2]] });
      (index as any).insertItem = async () => { throw new Error('insert error'); };
      await assert.rejects(index.upsertDocument('u', 't'), /Error adding document "u": Error: insert error/);
    });
  });

  describe('listDocuments', () => {
    it('returns empty list when no chunks', async () => {
      (index as any).listItems = async () => [];
      const docs = await index.listDocuments();
      assert.deepEqual(docs, []);
    });

    it('groups chunks per document and produces LocalDocumentResult', async () => {
      const docId = 'idx-1';
      const uri = 'doc://1';
      (index as any)._catalog = { version: 1, count: 1, uriToId: { [uri]: docId }, idToUri: { [docId]: uri } };
      (index as any).listItems = async () => [
        { id: 'c1', metadata: { documentId: docId, startPos: 0, endPos: 9 }, vector: [0], norm: 1 },
        { id: 'c2', metadata: { documentId: docId, startPos: 10, endPos: 19 }, vector: [0], norm: 1 },
      ];
      const docs = await index.listDocuments();
      assert.equal(docs.length, 1);
      assert.equal(docs[0].id, docId);
      assert.equal(docs[0].uri, uri);
      assert.ok(docs[0].score >= 0);
    });
  });

  describe('queryDocuments', () => {
    it('throws if embeddings not configured', async () => {
      const idx = new LocalDocumentIndex({ folderPath, storage, tokenizer });
      await assert.rejects(idx.queryDocuments('q'), /Embeddings model not configured/);
    });

    it('uses default options, normalizes query for embeddings, and forwards to queryItems', async () => {
      let received: { emb: number[]; query: string; maxChunks: number; filter: any; isBm25?: boolean } | undefined;
      embeddings.createEmbeddingsResponses.push({ status: 'success', output: [[0.5, 0.6]] });
      (index as any).queryItems = async (emb: number[], q: string, maxChunks: number, filter: any, isBm25?: boolean) => {
        received = { emb, query: q, maxChunks, filter, isBm25 };
        return [];
      };
      await index.queryDocuments('a\nb\nc');
      assert(received);
      assert.equal(received!.query, 'a\nb\nc');
      assert.equal(received!.maxChunks, 50);
      assert.equal(received!.filter, undefined);
      assert.equal(received!.isBm25, undefined);
      const lastEmbCall = (embeddings.createEmbeddingsCalls.pop() as string).toString();
      assert.equal(lastEmbCall, 'a b c');
    });

    it('wraps errors in query embedding generation and non-success status', async () => {
      embeddings.createEmbeddings = async () => { throw new Error('fail'); };
      await assert.rejects(index.queryDocuments('q'), /Error generating embeddings for query: Error: fail/);
      embeddings.createEmbeddings = async () => ({ status: 'error', message: 'bad' } as any);
      await assert.rejects(index.queryDocuments('q'), /Error generating embeddings for query: bad/);
    });

    it('groups results by document, sorts by score, returns top N, and forwards filter/isBm25', async () => {
      embeddings.createEmbeddingsResponses.push({ status: 'success', output: [[0.9, 0.8]] });
      const docId1 = 'd1', docId2 = 'd2';
      (index as any)._catalog = { version: 1, count: 2, uriToId: {}, idToUri: { [docId1]: 'u1', [docId2]: 'u2' } };
      let forwarded = { filter: undefined as any, isBm25: undefined as any };
      (index as any).queryItems = async (_e: number[], q: string, k: number, f: any, isBm25?: boolean) => {
        forwarded.filter = f;
        forwarded.isBm25 = isBm25;
        return [
          { item: { id: 'c1', metadata: { documentId: docId1 }, vector: [0], norm: 1 }, score: 0.85 },
          { item: { id: 'c2', metadata: { documentId: docId2 }, vector: [0], norm: 1 }, score: 0.95 },
          { item: { id: 'c3', metadata: { documentId: docId1 }, vector: [0], norm: 1 }, score: 0.8 },
        ];
      };
      const results = await index.queryDocuments('q', { maxDocuments: 1, filter: { key: 'v' } as any, isBm25: true });
      assert.equal(results.length, 1);
      assert.equal(results[0].id, docId2);
      assert.deepEqual(forwarded.filter, { key: 'v' });
      assert.equal(forwarded.isBm25, true);
    });
  });

  describe('update transaction overrides', () => {
    it('beginUpdate clones catalog; cancelUpdate clears; endUpdate persists and clears new catalog', async () => {
      (index as any)._catalog = { version: 1, count: 0, uriToId: {}, idToUri: {} };
      await index.beginUpdate();
      assert.notEqual((index as any)._newCatalog, (index as any)._catalog);
      assert.deepEqual((index as any)._newCatalog, (index as any)._catalog);
      index.cancelUpdate();
      assert.equal((index as any)._newCatalog, undefined);
      await index.beginUpdate();
      (index as any)._newCatalog.count = 1;
      await index.endUpdate();
      const catalogPath = path.join(folderPath, 'catalog.json');
      assert(storage.upsertFileCalls.some(c => c.path === catalogPath));
      assert.equal((index as any)._newCatalog, undefined);
      assert.equal((index as any)._catalog.count, 1);
    });

    it('endUpdate wraps storage errors when saving catalog', async () => {
      (index as any)._catalog = { version: 1, count: 0, uriToId: {}, idToUri: {} };
      await index.beginUpdate();
      const orig = storage.upsertFile.bind(storage);
      storage.upsertFile = async (p: string, c: any) => {
        if (p.endsWith('index.json')) return orig(p, c);
        if (p.endsWith('catalog.json')) throw new Error('fail');
        return orig(p, c);
      };
      await assert.rejects(index.endUpdate(), /Error saving document catalog: Error: fail/);
      assert((index as any)._newCatalog);
    });

    it('createIndex calls super then loads catalog', async () => {
      let loadCalled = false;
      (index as any).loadIndexData = async () => { loadCalled = true; };
      await index.createIndex({ version: 1, deleteIfExists: true }); // ensure we don't fail if index.json exists [[2]]
      assert(loadCalled);
    });
  });

  describe('file path correctness across operations', () => {
    it('uses correct joined paths for catalog, text, and metadata files', async () => {
      const uri = 'doc://paths.txt';
      const docId = 'id-paths';
      (index as any)._catalog = { version: 1, count: 1, uriToId: { [uri]: docId }, idToUri: { [docId]: uri } };
      storage.files.set(path.join(folderPath, `${docId}.txt`), 'text');
      storage.files.set(path.join(folderPath, `${docId}.json`), '{}');
      (index as any).listItemsByMetadata = async () => [];
      (index as any).deleteItem = async () => {};
      await index.deleteDocument(uri);
      assert(storage.deleteFileCalls.includes(path.join(folderPath, `${docId}.txt`)));
      assert(storage.deleteFileCalls.includes(path.join(folderPath, `${docId}.json`)));
      (index as any).insertItem = async () => {};
      embeddings.createEmbeddingsResponses.push({ status: 'success', output: [[0.1, 0.2]] });
      const newDoc = await index.upsertDocument(uri, 'text', 'txt', { key: 'value' });
      const metaPath = path.join(folderPath, `${newDoc.id}.json`);
      const textPath = path.join(folderPath, `${newDoc.id}.txt`);
      assert(storage.upsertFileCalls.some(c => c.path === metaPath));
      assert(storage.upsertFileCalls.some(c => c.path === textPath));
      await index.beginUpdate();
      await index.endUpdate();
      const catalogPath = path.join(folderPath, 'catalog.json');
      assert(storage.upsertFileCalls.some(c => c.path === catalogPath));
    });
  });
});
