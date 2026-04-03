---
title: API Reference
layout: default
nav_order: 5
---

# API Reference
{: .no_toc }

TypeScript API for LocalIndex, LocalDocumentIndex, and supporting classes.
{: .fs-6 .fw-300 }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## LocalIndex

Item-level vector storage with metadata filtering.

### Constructor

```ts
import { LocalIndex } from 'vectra';

const index = new LocalIndex(folderPath: string);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `folderPath` | `string` | Path to the index folder on disk |

### Methods

#### createIndex(config)

Create a new index. Throws if the index already exists (unless `deleteIfExists` is set).

```ts
await index.createIndex({
  version: 1,
  metadata_config: { indexed: ['category', 'language'] },
  deleteIfExists: false, // optional: wipe and recreate
});
```

#### deleteIndex()

Delete the index folder and all its contents.

```ts
await index.deleteIndex();
```

#### isIndexCreated()

Check whether the index exists on disk.

```ts
const exists: boolean = await index.isIndexCreated();
```

#### insertItem(item)

Insert a single item into the index.

```ts
await index.insertItem({
  vector: number[],
  metadata: Record<string, any>,
});
```

Returns the inserted item's ID.

#### batchInsertItems(items)

Insert multiple items atomically (all-or-nothing).

```ts
await index.batchInsertItems([
  { vector: [...], metadata: { category: 'food', text: 'apple' } },
  { vector: [...], metadata: { category: 'color', text: 'blue' } },
]);
```

#### queryItems(vector, queryString, topK, filter?)

Query the index by vector similarity with optional metadata filtering.

```ts
const results = await index.queryItems(
  vector,      // query vector (number[])
  '',          // query string (unused for LocalIndex)
  10,          // topK results
  { category: { $eq: 'food' } }  // optional filter
);
```

Returns an array of `{ item, score }` sorted by descending cosine similarity.

#### listItemsByMetadata(filter)

List items matching a metadata filter without vector similarity ranking.

```ts
const items = await index.listItemsByMetadata({ category: { $eq: 'food' } });
```

#### beginUpdate() / endUpdate()

Manual update locking for batch operations.

```ts
await index.beginUpdate();
// ... multiple insert/delete operations
await index.endUpdate();
```

{: .warning }
Calling `beginUpdate()` twice without `endUpdate()` throws. Prefer `batchInsertItems` or the document-level helpers which manage locking automatically.

---

## LocalDocumentIndex

Document-level ingestion with chunking, embedding, and retrieval.

### Constructor

```ts
import { LocalDocumentIndex, OpenAIEmbeddings } from 'vectra';

const docs = new LocalDocumentIndex({
  folderPath: string,
  embeddings: OpenAIEmbeddings,
  chunkingConfig?: {
    chunkSize?: number,      // default: 512
    chunkOverlap?: number,   // default: 0
    keepSeparators?: boolean, // default: true
  },
});
```

### Methods

#### createIndex(config)

Create the document index.

```ts
await docs.createIndex({ version: 1 });
```

#### isIndexCreated()

Check whether the index exists on disk.

```ts
const exists: boolean = await docs.isIndexCreated();
```

#### upsertDocument(uri, text, docType?)

Add or update a document. Vectra splits the text into chunks and generates embeddings.

```ts
await docs.upsertDocument('doc://readme', 'Full document text...', 'md');
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `uri` | `string` | Unique document identifier |
| `text` | `string` | Document content |
| `docType` | `string?` | Hint for chunking (e.g., `'md'`, `'txt'`) |

#### deleteDocument(uri)

Remove a document and its chunks from the index.

```ts
await docs.deleteDocument('doc://readme');
```

#### queryDocuments(query, options)

Query by text. Returns documents with scored chunks.

```ts
const results = await docs.queryDocuments('search query', {
  maxDocuments: 5,
  maxChunks: 20,
  isBm25: false,  // set true for hybrid retrieval
});
```

Returns an array of `LocalDocumentResult` objects sorted by relevance.

#### listDocuments()

List all documents in the index.

```ts
const documents = await docs.listDocuments();
```

### LocalDocumentResult

Returned by `queryDocuments`. Each result represents a matched document.

| Property | Type | Description |
|----------|------|-------------|
| `uri` | `string` | Document URI |
| `score` | `number` | Relevance score |

#### renderSections(maxTokens, sectionCount, overlap?)

Merge adjacent chunks into readable sections within a token budget.

```ts
const sections = await result.renderSections(2000, 1, true);
for (const s of sections) {
  console.log(s.score, s.tokenCount, s.isBm25);
  console.log(s.text);
}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `maxTokens` | `number` | Max tokens per section |
| `sectionCount` | `number` | Number of sections to render |
| `overlap` | `boolean?` | Include overlapping context |

---

## OpenAIEmbeddings

Embeddings helper supporting OpenAI, Azure OpenAI, and OpenAI-compatible endpoints.

### Constructor

```ts
import { OpenAIEmbeddings } from 'vectra';

// OpenAI
const embeddings = new OpenAIEmbeddings({
  apiKey: 'sk-...',
  model: 'text-embedding-3-small',
  maxTokens: 8000,
});

// Azure OpenAI
const embeddings = new OpenAIEmbeddings({
  azureApiKey: '...',
  azureEndpoint: 'https://your-resource.openai.azure.com',
  azureDeployment: 'your-deployment',
  azureApiVersion: '2023-05-15',
  maxTokens: 8000,
});

// OSS compatible
const embeddings = new OpenAIEmbeddings({
  ossModel: 'text-embedding-3-small',
  ossEndpoint: 'https://your-endpoint.example.com',
  maxTokens: 8000,
});
```

### Methods

#### createEmbeddings(texts)

Generate embeddings for an array of text strings. Handles batching automatically.

---

## LocalEmbeddings

Run embeddings locally using HuggingFace transformer models. No API key or network calls required. Requires the optional `@huggingface/transformers` package.

### Constructor

```ts
import { LocalEmbeddings } from 'vectra';

// Default model: Xenova/all-MiniLM-L6-v2 (384 dimensions, 256 max tokens)
const embeddings = new LocalEmbeddings();

// Custom model
const embeddings = new LocalEmbeddings({
  model: 'Xenova/all-MiniLM-L12-v2',
  maxTokens: 512,
});
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model` | `string?` | `'Xenova/all-MiniLM-L6-v2'` | HuggingFace model ID (must support `feature-extraction` pipeline) |
| `maxTokens` | `number?` | `256` | Maximum tokens per input |

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `model` | `string` | The model ID in use |
| `maxTokens` | `number` | Maximum tokens per input |

### Methods

#### createEmbeddings(inputs)

Generate embeddings for one or more text strings. The pipeline is lazily initialized on first call — models are downloaded and cached locally.

```ts
const response = await embeddings.createEmbeddings(['hello', 'world']);
// response.status: 'success' | 'error'
// response.output: number[][] (one vector per input)
```

---

## TransformersEmbeddings

Run embeddings locally using Transformers.js with full control over device, quantization, and pooling. Works in Node.js, browsers, and Electron. Requires the optional `@huggingface/transformers` package.

### Factory method

```ts
import { TransformersEmbeddings } from 'vectra';

// Default: Xenova/all-MiniLM-L6-v2 (384 dims, 512 max tokens)
const embeddings = await TransformersEmbeddings.create();

// Custom options
const embeddings = await TransformersEmbeddings.create({
  model: 'Xenova/bge-small-en-v1.5',
  maxTokens: 512,
  device: 'gpu',
  dtype: 'q8',
  pooling: 'mean',
  normalize: true,
  progressCallback: (p) => console.log(p.status, p.progress),
});
```

{: .note }
Use the async `create()` factory — the constructor is private. The model is downloaded and cached on first call.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | `string?` | `'Xenova/all-MiniLM-L6-v2'` | HuggingFace model ID (must support `feature-extraction` pipeline) |
| `maxTokens` | `number?` | `512` | Maximum tokens per input |
| `device` | `'auto' \| 'gpu' \| 'cpu' \| 'wasm'` | `'auto'` | Inference device (WebGPU in browser, CUDA in Node.js if available) |
| `dtype` | `'fp32' \| 'fp16' \| 'q8' \| 'q4'` | `'fp32'` | Model weight precision — lower precision trades quality for speed/size |
| `normalize` | `boolean?` | `true` | Normalize embeddings to unit length |
| `pooling` | `'mean' \| 'cls'` | `'mean'` | Token pooling strategy |
| `progressCallback` | `function?` | -- | Callback for model download/load progress |

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `model` | `string` | The model ID in use |
| `maxTokens` | `number` | Maximum tokens per input |

### Methods

#### createEmbeddings(inputs)

Generate embeddings for one or more text strings.

```ts
const response = await embeddings.createEmbeddings(['hello', 'world']);
// response.status: 'success' | 'error'
// response.output: number[][] (one vector per input)
```

#### getTokenizer()

Returns a `TransformersTokenizer` that uses the same tokenization as this embedding model. Use it with `LocalDocumentIndex` to ensure text chunking aligns with the model's token boundaries.

```ts
const tokenizer = embeddings.getTokenizer();
const tokens = tokenizer.encode('hello world');
const text = tokenizer.decode(tokens);
```

---

## FolderWatcher

Watch folders for file changes and automatically sync them into a `LocalDocumentIndex`. Performs an initial full sync on start, then monitors for real-time adds, updates, and deletes.

{: .note }
Node.js only — uses `fs.watch()` for filesystem monitoring.

### Constructor

```ts
import { FolderWatcher } from 'vectra';

const watcher = new FolderWatcher({
  index: myDocumentIndex,           // LocalDocumentIndex instance
  paths: ['./docs', './notes'],     // folders or files to watch
  extensions: ['.txt', '.md'],      // optional: filter by extension
  debounceMs: 500,                  // optional: debounce interval (default: 500)
});
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `index` | `LocalDocumentIndex` | -- | The index to sync files into |
| `paths` | `string[]` | -- | Folders or files to watch |
| `extensions` | `string[]?` | all files | File extensions to include (e.g., `['.txt', '.md']`) |
| `debounceMs` | `number?` | `500` | Debounce interval in milliseconds |

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `isRunning` | `boolean` | Whether the watcher is actively monitoring |
| `trackedFileCount` | `number` | Number of files currently tracked |

### Methods

#### start()

Begin watching. Performs an initial full sync, then emits events for changes.

```ts
await watcher.start();
```

#### stop()

Stop watching and clean up file watchers.

```ts
await watcher.stop();
```

#### sync()

Manually trigger a full sync. Returns the number of files synced.

```ts
const count = await watcher.sync();
```

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `sync` | `(uri: string, action: 'added' \| 'updated' \| 'deleted')` | Fired for each file synced |
| `error` | `(error: Error, uri: string)` | Fired when a sync operation fails |
| `ready` | -- | Fired after the initial sync completes |

```ts
watcher.on('sync', (uri, action) => console.log(`${action}: ${uri}`));
watcher.on('error', (err, uri) => console.error(`Error syncing ${uri}:`, err));
watcher.on('ready', () => console.log('Initial sync complete'));
```

---

## Storage classes

For full documentation on the `FileStorage` interface, built-in implementations, custom storage, and browser support, see the [Storage](/vectra/storage) guide.

| Class | Environment | Description |
|-------|-------------|-------------|
| `LocalFileStorage` | Node.js | File-system-backed storage (default) |
| `VirtualFileStorage` | Any | In-memory storage for testing |
| `IndexedDBStorage` | Browser, Electron | IndexedDB-backed persistent storage |

---

## Codecs

Vectra supports pluggable serialization via the `IndexCodec` interface.

| Class | Description |
|-------|-------------|
| `JsonCodec` | JSON serialization (default, human-readable) |
| `ProtobufCodec` | Protocol Buffer serialization (40-50% smaller, requires `protobufjs`) |

```ts
import { LocalIndex, ProtobufCodec } from 'vectra';

const index = new LocalIndex('./my-index', { codec: new ProtobufCodec() });
```

See [Storage Formats](/vectra/storage#storage-formats) for details and migration instructions.

---

## Utilities

| Class | Description |
|-------|-------------|
| `TextSplitter` | Split text into chunks by token count with configurable overlap |
| `GPT3Tokenizer` | Token counting |
| `ItemSelector` | Item selection utilities |
| `FileFetcher` | Read local files for document ingestion (Node.js only) |
| `WebFetcher` | Fetch web pages for document ingestion (Node.js only) |
| `BrowserWebFetcher` | Fetch web pages in browsers/Electron using Fetch API + DOMParser |
| `TransformersTokenizer` | Tokenizer matching a `TransformersEmbeddings` model (encode/decode) |
| `pathUtils` | Cross-platform path utilities (works in Node.js and browsers) |
| `migrateIndex` | Migrate an index between serialization formats |

---

## Filter operators

Used with `queryItems` and `listItemsByMetadata`. Only works on [indexed fields](/vectra/core-concepts#indexed-vs-non-indexed-fields).

| Operator | Description | Example |
|----------|-------------|---------|
| `$eq` | Equal | `{ status: { $eq: 'active' } }` |
| `$ne` | Not equal | `{ status: { $ne: 'archived' } }` |
| `$gt` | Greater than | `{ score: { $gt: 0.8 } }` |
| `$gte` | Greater than or equal | `{ score: { $gte: 0.8 } }` |
| `$lt` | Less than | `{ count: { $lt: 10 } }` |
| `$lte` | Less than or equal | `{ count: { $lte: 10 } }` |
| `$in` | In set | `{ category: { $in: ['a', 'b'] } }` |
| `$nin` | Not in set | `{ category: { $nin: ['x'] } }` |
| `$and` | Logical AND | `{ $and: [{ a: { $eq: 1 } }, { b: { $gt: 2 } }] }` |
| `$or` | Logical OR | `{ $or: [{ a: { $eq: 1 } }, { a: { $eq: 2 } }] }` |
