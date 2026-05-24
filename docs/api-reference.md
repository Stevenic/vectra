---
title: API Reference
layout: default
nav_order: 7
---

# API Reference
{: .no_toc }

Method-level reference for every public TypeScript export. For conceptual walkthroughs, see the [Core Concepts](/vectra/core-concepts), [Document Indexing](/vectra/documents), [Embeddings](/vectra/embeddings), and [Storage](/vectra/storage) guides.
{: .fs-6 .fw-300 }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Indexes

### LocalIndex

Item-level vector storage with metadata filtering. You supply vectors and metadata; Vectra handles storage, filtering, and similarity search.

```ts
import { LocalIndex } from 'vectra';

const index = new LocalIndex('./my-index');
await index.createIndex({ version: 1, metadata_config: { indexed: ['category'] } });
await index.insertItem({ vector: [...], metadata: { text: 'hello', category: 'greeting' } });
const results = await index.queryItems(queryVector, '', 10, { category: { $eq: 'greeting' } });
```

#### Constructor

```ts
new LocalIndex<TMetadata>(folderPath, indexName?, storage?, codec?, options?)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `folderPath` | `string` | Path to the index folder |
| `indexName` | `string?` | Index file name. Defaults to `'index' + codec.extension` |
| `storage` | `FileStorage?` | Storage backend. Defaults to `LocalFileStorage` |
| `codec` | `IndexCodec?` | Serialization codec. Defaults to `JsonCodec` |
| `options` | `{ bm25Factory?, docReader? }` | Dependency-injection hooks for tests |

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `folderPath` | `string` | Path to the index folder |
| `indexName` | `string` | Name of the index file |
| `storage` | `FileStorage` | Storage provider in use |
| `codec` | `IndexCodec` | Codec in use |

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `createIndex(config?)` | `Promise<void>` | Create a new index. Config defaults to `{ version: 1 }`. Throws if the index exists unless `deleteIfExists: true` |
| `deleteIndex()` | `Promise<void>` | Delete the index folder and all contents |
| `isIndexCreated()` | `Promise<boolean>` | True if the index file exists on disk |
| `getIndexStats()` | `Promise<IndexStats>` | Load the index and return `{ version, metadata_config, items }` |
| `insertItem(item)` | `Promise<IndexItem>` | Insert one item. Throws if an item with the same ID exists |
| `upsertItem(item)` | `Promise<IndexItem>` | Insert or replace one item |
| `batchInsertItems(items)` | `Promise<IndexItem[]>` | Insert many items atomically — the whole batch rolls back on any failure |
| `getItem(id)` | `Promise<IndexItem \| undefined>` | Fetch a single item by ID |
| `listItems()` | `Promise<IndexItem[]>` | Return a copy of every item |
| `listItemsByMetadata(filter)` | `Promise<IndexItem[]>` | Return items whose metadata matches the filter |
| `deleteItem(id)` | `Promise<void>` | Delete one item. No-op if the ID is unknown |
| `deleteItems(ids)` | `Promise<void>` | Delete many items in a single O(N) pass |
| `queryItems(vector, query, topK, filter?, isBm25?)` | `Promise<QueryResult[]>` | Top-K cosine similarity. Pass `isBm25: true` to append BM25 keyword matches |
| `beginUpdate()` | `Promise<void>` | Start a manual update batch. Throws if one is already in progress |
| `endUpdate()` | `Promise<void>` | Commit a manual update batch |
| `cancelUpdate()` | `void` | Discard the in-progress update |

#### CreateIndexConfig

```ts
interface CreateIndexConfig {
  version: number;
  deleteIfExists?: boolean;
  metadata_config?: { indexed?: string[] };
}
```

Only fields named in `metadata_config.indexed` participate in filtering — see [Core Concepts](/vectra/core-concepts#indexed-vs-non-indexed-fields).

---

### LocalDocumentIndex

Document-level ingestion with chunking, embedding, and retrieval. Extends `LocalIndex<DocumentChunkMetadata>`.

```ts
import { LocalDocumentIndex, OpenAIEmbeddings } from 'vectra';

const docs = new LocalDocumentIndex({
  folderPath: './my-index',
  embeddings: new OpenAIEmbeddings({...}),
});
await docs.upsertDocument('doc://readme', 'Full text...', 'md');
const results = await docs.queryDocuments('search query', { maxDocuments: 5, maxChunks: 20 });
```

#### Constructor

```ts
new LocalDocumentIndex(config: LocalDocumentIndexConfig)
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `folderPath` | `string` | — | Path to the index folder (required) |
| `embeddings` | `EmbeddingsModel?` | — | Embeddings provider (required for `upsertDocument`/`queryDocuments`) |
| `tokenizer` | `Tokenizer?` | `GPT3Tokenizer` | Tokenizer for chunking and rendering |
| `chunkingConfig` | `Partial<TextSplitterConfig>?` | See [Document Indexing](/vectra/documents#chunking-defaults) | Chunking configuration |
| `storage` | `FileStorage?` | `LocalFileStorage` | Storage backend |
| `codec` | `IndexCodec?` | `JsonCodec` | Serialization codec |
| `indexName` | `string?` | `'index' + codec.extension` | Name of the index file |

#### Properties

In addition to the inherited `LocalIndex` properties:

| Property | Type | Description |
|----------|------|-------------|
| `embeddings` | `EmbeddingsModel \| undefined` | The configured embeddings model, if any |
| `tokenizer` | `Tokenizer` | The configured tokenizer |

#### Methods

In addition to all inherited `LocalIndex` methods:

| Method | Returns | Description |
|--------|---------|-------------|
| `upsertDocument(uri, text, docType?, metadata?, options?)` | `Promise<LocalDocument>` | Add or replace a document. Skips re-embedding when `text + docType + metadata` is unchanged. Pass `{ force: true }` to bypass the hash check (e.g., after rotating embeddings models) |
| `deleteDocument(uri)` | `Promise<void>` | Remove a document, its chunks, and its on-disk files. No-op if the URI is unknown |
| `queryDocuments(query, options?)` | `Promise<LocalDocumentResult[]>` | Embed and query for similar documents |
| `listDocuments()` | `Promise<LocalDocumentResult[]>` | List every document with all its chunks |
| `getDocumentId(uri)` | `Promise<string \| undefined>` | Look up a document ID by URI |
| `getDocumentUri(documentId)` | `Promise<string \| undefined>` | Look up a URI by document ID |
| `getCatalogStats()` | `Promise<DocumentCatalogStats>` | `{ version, documents, chunks, metadata_config }` |
| `isCatalogCreated()` | `Promise<boolean>` | True if the catalog file exists on disk |

`createIndex`, `beginUpdate`, `endUpdate`, and `cancelUpdate` are overridden to also manage the document catalog.

#### DocumentQueryOptions

```ts
interface DocumentQueryOptions {
  maxDocuments?: number;   // default 10
  maxChunks?: number;      // default 50
  filter?: MetadataFilter; // filter applied to chunk metadata
  isBm25?: boolean;        // enable hybrid BM25 keyword retrieval
}
```

---

### LocalDocument

Read-only handle to a document stored in a `LocalDocumentIndex`. Returned by `upsertDocument` and (as the base class of `LocalDocumentResult`) by `queryDocuments`/`listDocuments`.

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Internal document ID |
| `uri` | `string` | Document URI |
| `folderPath` | `string` | Folder of the parent index |

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getLength()` | `Promise<number>` | Document length in tokens. Estimated as `ceil(bytes / 4)` for documents over 40 KB |
| `hasMetadata()` | `Promise<boolean>` | True if a side-car metadata file exists |
| `loadMetadata()` | `Promise<Record<string, MetadataTypes>>` | Read and cache the document's metadata file |
| `loadText()` | `Promise<string>` | Read and cache the document body |

---

### LocalDocumentResult

A `LocalDocument` paired with matching chunks from a query. Extends `LocalDocument`.

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `chunks` | `QueryResult<DocumentChunkMetadata>[]` | The matched chunks |
| `score` | `number` | Average score across `chunks` |
| `CONNECTOR` | `string` (static) | `"\n\n...\n\n"` — joiner used when rendering non-adjacent sections |

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `renderSections(maxTokens, maxSections, overlappingChunks?)` | `Promise<DocumentTextSection[]>` | Render the top scoring spans of the document. If the document fits within `maxTokens`, returns the whole document as a single section. `overlappingChunks` defaults to `true` and packs adjacent chunks with surrounding context |
| `renderAllSections(maxTokens)` | `Promise<DocumentTextSection[]>` | Render every matched chunk in document order, packing small chunks together and splitting oversize ones |

Each `DocumentTextSection` has `{ text, tokenCount, score, isBm25 }`.

---

## Embeddings

### EmbeddingsModel (interface)

```ts
interface EmbeddingsModel {
  readonly maxTokens: number;
  createEmbeddings(inputs: string | string[]): Promise<EmbeddingsResponse>;
}
```

### EmbeddingsResponse

```ts
interface EmbeddingsResponse {
  status: 'success' | 'error' | 'rate_limited' | 'cancelled';
  output?: number[][];
  message?: string;
  model?: string;
  usage?: Record<string, any>;
}
```

### OpenAIEmbeddings

Works with OpenAI, Azure OpenAI, or any OpenAI-compatible endpoint. The constructor picks a client based on which option keys are present.

```ts
import { OpenAIEmbeddings } from 'vectra';

const openai = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'text-embedding-3-small',
  maxTokens: 8000,
});
```

Properties: `maxTokens` and `options` (the resolved constructor options).

#### Option variants

**OpenAIEmbeddingsOptions** (hosted OpenAI):

| Option | Type | Description |
|--------|------|-------------|
| `apiKey` | `string` | OpenAI API key |
| `model` | `string` | Model name |
| `organization` | `string?` | Organization header |
| `endpoint` | `string?` | Override `https://api.openai.com` |

**AzureOpenAIEmbeddingsOptions** (Azure):

| Option | Type | Description |
|--------|------|-------------|
| `azureApiKey` | `string` | Azure API key |
| `azureEndpoint` | `string` | Azure resource endpoint (must be HTTPS) |
| `azureDeployment` | `string` | Deployment name |
| `azureApiVersion` | `string?` | Default `'2023-05-15'` |

**OSSEmbeddingsOptions** (self-hosted / OpenAI-compatible):

| Option | Type | Description |
|--------|------|-------------|
| `ossModel` | `string` | Model name |
| `ossEndpoint` | `string` | Base URL of the OpenAI-compatible server |

**BaseOpenAIEmbeddingsOptions** (shared across all three):

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxTokens` | `number?` | `500` | Token budget per request |
| `dimensions` | `number?` | — | Requested embedding dimensions |
| `retryPolicy` | `number[]?` | `[2000, 5000]` | Retry delays in ms on HTTP 429 |
| `requestConfig` | `RequestInit?` | — | Custom fetch options |
| `logRequests` | `boolean?` | `false` | Log requests/responses to the console |

### LocalEmbeddings

In-process embeddings via `@huggingface/transformers`. The pipeline is lazily initialised on the first call. Requires `npm install @huggingface/transformers`.

```ts
import { LocalEmbeddings } from 'vectra';

const local = new LocalEmbeddings({
  model: 'Xenova/all-MiniLM-L6-v2',
  maxTokens: 256,
});
```

| Option | Type | Default |
|--------|------|---------|
| `model` | `string?` | `'Xenova/all-MiniLM-L6-v2'` |
| `maxTokens` | `number?` | `256` |

Read-only property: `model`.

### TransformersEmbeddings

Async factory pattern — instantiate with the static `create()` method, not `new`.

```ts
import { TransformersEmbeddings } from 'vectra';

const embeddings = await TransformersEmbeddings.create({
  model: 'Xenova/all-MiniLM-L6-v2',
  device: 'gpu',
  dtype: 'fp16',
});

const docs = new LocalDocumentIndex({
  folderPath: './my-index',
  embeddings,
  tokenizer: embeddings.getTokenizer(),
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | `string?` | `'Xenova/all-MiniLM-L6-v2'` | Hugging Face model id |
| `maxTokens` | `number?` | `512` | Token budget (affects batching) |
| `device` | `'auto' \| 'gpu' \| 'cpu' \| 'wasm'?` | `'auto'` | Execution device |
| `dtype` | `'fp32' \| 'fp16' \| 'q8' \| 'q4'?` | `'fp32'` | Weight precision/quantization |
| `normalize` | `boolean?` | `true` | Normalize embeddings to unit length |
| `pooling` | `'mean' \| 'cls'?` | `'mean'` | Pooling strategy |
| `progressCallback` | `(p) => void` | — | Download/load progress |

| Method / Property | Description |
|-------------------|-------------|
| `static create(options?)` | Async factory — resolves to an initialised instance |
| `getTokenizer()` | Returns a `TransformersTokenizer` aligned with this model |
| `createEmbeddings(inputs)` | Implements `EmbeddingsModel` |
| `model` (property) | The active model name |

See the [Embeddings Guide](/vectra/embeddings) for provider tradeoffs.

---

## Tokenizers

### Tokenizer (interface)

```ts
interface Tokenizer {
  encode(text: string): number[];
  decode(tokens: number[]): string;
}
```

### GPT3Tokenizer

Default tokenizer. Uses `gpt-tokenizer` for GPT-3/GPT-4 compatible counts. No constructor arguments.

### TransformersTokenizer

Wraps a `@huggingface/transformers` `PreTrainedTokenizer`. Typically obtained via `TransformersEmbeddings.getTokenizer()` rather than constructed directly. Skips special tokens on decode.

---

## Text processing

### TextSplitter

Recursive text splitter that respects document structure via per-language separator lists.

```ts
import { TextSplitter } from 'vectra';

const splitter = new TextSplitter({ chunkSize: 256, chunkOverlap: 40, docType: 'md' });
const chunks = splitter.split(text);
```

#### TextSplitterConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `chunkSize` | `number` | `400` | Max tokens per chunk (must be ≥ 1) |
| `chunkOverlap` | `number` | `40` | Overlap tokens between chunks (0 ≤ overlap ≤ chunkSize) |
| `keepSeparators` | `boolean` | `false` | Preserve separator text at chunk boundaries |
| `separators` | `string[]?` | Derived from `docType` | Custom separator list |
| `docType` | `string?` | — | Hint for separator selection. Supported: `md`, `markdown`, `py`, `python`, `js`, `jsx`, `javascript`, `ts`, `tsx`, `typescript`, `java`, `cs`, `csharp`, `c#`, `cpp`, `go`, `php`, `proto`, `rb` (ruby), `rust`, `scala`, `swift`, `latex`, `html`, `rst`, `sol` |
| `tokenizer` | `Tokenizer?` | `GPT3Tokenizer` | Tokenizer used for length calculations |

Method: `split(text: string): TextChunk[]`.

Note: `LocalDocumentIndex` applies its own defaults (`chunkSize: 512`, `chunkOverlap: 0`, `keepSeparators: true`) — see [Document Indexing](/vectra/documents#chunking-defaults).

### TextChunk

```ts
interface TextChunk {
  text: string;
  tokens: number[];
  startPos: number;
  endPos: number;
  startOverlap: number[];
  endOverlap: number[];
}
```

---

## Ingestion

### TextFetcher (interface)

```ts
interface TextFetcher {
  fetch(
    uri: string,
    onDocument: (uri: string, text: string, docType?: string) => Promise<boolean>
  ): Promise<boolean>;
}
```

Implementations call `onDocument` for each fetched item. Returning `false` from the callback aggregates to a `false` overall result (used by `FileFetcher` to short-circuit directory walks).

### FileFetcher

Node.js only. Reads a single file or recursively walks a directory.

```ts
import { FileFetcher } from 'vectra';

const fetcher = new FileFetcher();
await fetcher.fetch('./docs', async (uri, text, docType) => {
  await docs.upsertDocument(uri, text, docType);
  return true;
});
```

`docType` is derived from the file extension (lower-cased, without the leading dot). No constructor arguments.

### WebFetcher

Node.js only. Fetches URLs with `cheerio` + `turndown` for HTML → markdown conversion.

```ts
import { WebFetcher } from 'vectra';

const fetcher = new WebFetcher({ htmlToMarkdown: true });
await fetcher.fetch('https://example.com', async (uri, text, docType) => {
  await docs.upsertDocument(uri, text, docType);
  return true;
});
```

#### WebFetcherConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `htmlToMarkdown` | `boolean` | `true` | Convert HTML responses to markdown |
| `summarizeHtml` | `boolean` | `false` | Trim leading non-content text |
| `headers` | `Record<string, string>?` | Browser-like defaults | Custom HTTP headers |
| `requestConfig` | `RequestInit?` | — | Forwarded to `fetch` |

Allowed content types: `text/html`, `application/json`, `application/xml`, `application/javascript`, `text/plain`. Other types throw.

### BrowserWebFetcher

Browser/Electron. Uses the native Fetch API and `DOMParser` for HTML → markdown.

```ts
import { BrowserWebFetcher } from 'vectra/browser';

const fetcher = new BrowserWebFetcher({ mode: 'cors' });
```

#### BrowserWebFetcherConfig

| Option | Type | Default |
|--------|------|---------|
| `htmlToMarkdown` | `boolean?` | `true` |
| `headers` | `Record<string, string>?` | — |
| `mode` | `RequestMode?` | `'cors'` |
| `credentials` | `RequestCredentials?` | `'same-origin'` |

Allowed content types include `text/markdown` and `text/xml` in addition to those accepted by `WebFetcher`.

### FolderWatcher

Node.js only. Watches one or more folders and keeps a `LocalDocumentIndex` in sync. Extends Node's `EventEmitter`.

```ts
import { FolderWatcher } from 'vectra';

const watcher = new FolderWatcher({
  index: docs,
  paths: ['./docs', './notes'],
  extensions: ['.txt', '.md'],
  debounceMs: 500,
});

watcher.on('sync', (uri, action) => console.log(`${action}: ${uri}`));
watcher.on('error', (err, uri) => console.error(`Error: ${uri}`, err));
watcher.on('ready', () => console.log('Initial sync complete'));

await watcher.start();
// ... later
await watcher.stop();
```

#### FolderWatcherConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `index` | `LocalDocumentIndex` | — | The index to sync into (required) |
| `paths` | `string[]` | — | Folders or files to watch (required) |
| `extensions` | `string[]?` | all files | File extensions to include (with or without leading dot) |
| `debounceMs` | `number?` | `500` | Debounce window for rapid change events |

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `isRunning` | `boolean` | True between `start()` and `stop()` |
| `trackedFileCount` | `number` | Number of files currently tracked |

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `start()` | `Promise<void>` | Run the initial sync, then install file watchers. Throws if already running |
| `stop()` | `Promise<void>` | Tear down all watchers and pending debounced syncs |
| `sync()` | `Promise<number>` | Force a full re-scan. Returns the number of files added, updated, or deleted |

#### Events

| Event | Args | When |
|-------|------|------|
| `'ready'` | `()` | Emitted once the initial sync completes |
| `'sync'` | `(uri: string, action: 'added' \| 'updated' \| 'deleted')` | After each file change is applied to the index |
| `'error'` | `(error: Error, uri: string)` | When a sync, watcher, or filesystem operation fails |

{: .note }
Uses non-recursive `fs.watch` per directory to avoid a known libuv crash on Windows when watching paths that contain 8.3 short names. Watched paths are canonicalised via `fs.realpath` on `start()`.

---

## Storage

### FileStorage (interface)

Implemented by every storage backend.

| Method | Returns | Description |
|--------|---------|-------------|
| `createFile(filePath, content)` | `Promise<void>` | Create a file. Throws if it exists |
| `upsertFile(filePath, content)` | `Promise<void>` | Create or overwrite a file |
| `readFile(filePath)` | `Promise<Buffer>` | Read a file as a Buffer |
| `deleteFile(filePath)` | `Promise<void>` | Delete a file if it exists |
| `pathExists(path)` | `Promise<boolean>` | Check existence of a file or folder |
| `createFolder(folderPath)` | `Promise<void>` | Create a folder and any missing parents |
| `deleteFolder(folderPath)` | `Promise<void>` | Recursively delete a folder |
| `getDetails(path)` | `Promise<FileDetails>` | File or folder details. Throws if missing |
| `listFiles(folderPath, filter?)` | `Promise<FileDetails[]>` | List contents. Filter: `'files'`, `'folders'`, or `'all'` |

`FileDetails`: `{ name, path, isFolder, fileType? }`. `ListFilesFilter`: `'files' | 'folders' | 'all'`.

### Storage backends

| Class | Environment | Notes |
|-------|-------------|-------|
| `LocalFileStorage` | Node.js | Filesystem (default). No constructor arguments |
| `IndexedDBStorage` | Browser, Electron | Persistent storage. Database name configurable via constructor |
| `VirtualFileStorage` | Any | In-memory; ephemeral. Ideal for tests |

See the [Storage](/vectra/storage) guide for setup, custom backends, and the full interface contract.

### FileStorageUtilities

Static helpers for working with any `FileStorage` implementation.

| Method | Description |
|--------|-------------|
| `ensureFolderExists(storage, folderPath)` | Create the folder if missing |
| `getFileType(filePath)` | Map a file path to a `FileType` via its extension |
| `getFileTypeFromContentType(contentType)` | Map a MIME type to a `FileType` |
| `tryDeleteFile(storage, filePath)` | Delete a file, returning the `Error` instead of throwing |

### FileType

Type alias for known file extensions plus `'folder'`. Constants exported alongside it: `ImageFileExt`, `VideoFileExt`, `AudioFileExt`, `MediaFileExt`, `ModelFileExt`, `ArchiveFileExt`, `SystemFileExt`, `DatabaseFileExt`, `BinaryFileExt`, `DocumentFileExt`, `TextDocumentFileExt`, `CodeFileExt`, `PlainTextFileExt`, `FileExt`, and `ContentTypeMap`.

---

## Codecs

### IndexCodec (interface)

```ts
interface IndexCodec {
  readonly extension: string;
  serializeIndex(data: IndexData): Buffer;
  deserializeIndex(buffer: Buffer): IndexData;
  serializeCatalog(catalog: DocumentCatalog): Buffer;
  deserializeCatalog(buffer: Buffer): DocumentCatalog;
  serializeMetadata(metadata: Record<string, MetadataTypes>): Buffer;
  deserializeMetadata(buffer: Buffer): Record<string, MetadataTypes>;
}
```

| Class | Extension | Notes |
|-------|-----------|-------|
| `JsonCodec` | `.json` | Default. Human-readable, backward-compatible |
| `ProtobufCodec` | `.pb` | 40–50% smaller. Requires `npm install protobufjs` |

### DocumentCatalog

```ts
interface DocumentCatalog {
  version: number;
  count: number;
  uriToId: { [uri: string]: string };
  idToUri: { [id: string]: string };
  uriToHash?: { [uri: string]: string };
}
```

`uriToHash` is populated lazily — older catalogs may omit it.

### Migration helpers

| Export | Signature | Description |
|--------|-----------|-------------|
| `migrateIndex` | `(folderPath, options: MigrateOptions) => Promise<void>` | Convert an index folder between formats |
| `detectCodec` | `(folderPath, storage: FileStorage) => Promise<IndexCodec>` | Detect the codec by probing for `index.json`/`index.pb` |
| `MigrateOptions` | `{ to: FormatName; storage?: FileStorage }` | Options for `migrateIndex` |
| `FormatName` | `'json' \| 'protobuf'` | Target format |

```ts
import { migrateIndex } from 'vectra';
await migrateIndex('./my-index', { to: 'protobuf' });
```

See [Storage — Formats](/vectra/storage#storage-formats) for the CLI equivalent and migration semantics.

---

## gRPC server

### VectraServer

```ts
import { VectraServer } from 'vectra';

const server = new VectraServer({
  rootDir: './indexes',
  port: 50051,
  embeddings: openai,
});
const port = await server.start();
// ... later
await server.shutdown();
```

#### VectraServerConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | `number?` | `50051` | Port to bind |
| `indexPath` | `string?` | — | Single index path (mutually exclusive with `rootDir`) |
| `rootDir` | `string?` | — | Root directory containing index subfolders |
| `embeddings` | `EmbeddingsModel?` | — | Server-side embeddings model |
| `scanInterval` | `number?` | `3000` | Polling interval (ms) for new indexes in `rootDir` mode |

Properties: `indexManager`, `server`. Methods: `start()` (returns the bound port), `shutdown()` (graceful, 5 s drain timeout).

### IndexManager

Manages the set of indexes a `VectraServer` exposes. Supports single-index and multi-index modes with periodic auto-detection.

```ts
interface ManagedIndex {
  name: string;
  index: LocalIndex | LocalDocumentIndex;
  isDocumentIndex: boolean;
  format: string;
}
```

| Method | Description |
|--------|-------------|
| `initialize()` | Load existing indexes; start scan timer in multi-index mode |
| `shutdown()` | Stop scanning and unload indexes |
| `getIndex(name)` | Return a managed index by name (or the single index in single-index mode) |
| `requireIndex(name)` | Same as `getIndex` but throws if missing |
| `requireDocumentIndex(name)` | Throws if not a document index; returns both the wrapper and the typed index |
| `createIndex(name, format, isDocumentIndex, documentConfig?)` | Create and register a new index on disk |
| `deleteIndex(name)` | Delete an index from disk and unregister it |
| `listIndexes()` | Snapshot of currently loaded indexes |

Properties: `indexes` (the underlying Map), `isSingleMode`.

`IndexManagerConfig` accepts the same `indexPath`, `rootDir`, `embeddings`, and `scanInterval` fields as `VectraServerConfig`.

See the [gRPC Server guide](/vectra/grpc) for service definitions and language bindings.

---

## Utilities

### ItemSelector

Static helpers for vector math and metadata filtering.

| Method | Description |
|--------|-------------|
| `cosineSimilarity(v1, v2)` | Cosine similarity. Returns `NaN` if either vector has zero norm. Uses the overlapping prefix when vectors differ in length |
| `normalize(vector)` | Euclidean norm of a vector |
| `normalizedCosineSimilarity(v1, norm1, v2, norm2)` | Fast cosine using pre-computed norms (Vectra pre-normalizes on insert) |
| `select(metadata, filter)` | Evaluate a `MetadataFilter` against an item's metadata |

### pathUtils

Cross-platform path helpers that work in Node and the browser. Useful when building custom `FileStorage` implementations.

| Member | Description |
|--------|-------------|
| `sep` | Always `'/'` |
| `join(...parts)` | Join segments using `/` |
| `basename(path, ext?)` | Last segment, optionally with the extension stripped |
| `dirname(path)` | Directory portion |
| `extname(path)` | Extension including the leading dot |
| `normalize(path)` | Resolve `.` and `..` |
| `isAbsolute(path)` | True for `/foo` or `C:\foo` |
| `relative(from, to)` | Relative path between two normalized paths |

---

## Shared types

### IndexItem

```ts
interface IndexItem<TMetadata = Record<string, MetadataTypes>> {
  id: string;
  metadata: TMetadata;
  vector: number[];
  norm: number;
  metadataFile?: string;
}
```

`metadataFile` is populated when the item has non-indexed metadata stored in a side-car file.

### QueryResult

```ts
interface QueryResult<TMetadata = Record<string, MetadataTypes>> {
  item: IndexItem<TMetadata>;
  score: number;
}
```

### IndexStats

```ts
interface IndexStats {
  version: number;
  metadata_config: { indexed?: string[] };
  items: number;
}
```

### IndexData

```ts
interface IndexData {
  version: number;
  metadata_config: { indexed?: string[] };
  items: IndexItem[];
}
```

### DocumentChunkMetadata

```ts
interface DocumentChunkMetadata {
  documentId: string;
  startPos: number;
  endPos: number;
  [key: string]: MetadataTypes;
}
```

### DocumentCatalogStats

```ts
interface DocumentCatalogStats {
  version: number;
  documents: number;
  chunks: number;
  metadata_config: { indexed?: string[] };
}
```

### DocumentTextSection

```ts
interface DocumentTextSection {
  text: string;
  tokenCount: number;
  score: number;
  isBm25: boolean;
}
```

### MetadataTypes

```ts
type MetadataTypes = number | string | boolean;
```

---

## Filter operators

Used with `queryItems`, `queryDocuments`, and `listItemsByMetadata`. Operators only apply to fields named in `metadata_config.indexed` — see [Core Concepts](/vectra/core-concepts#indexed-vs-non-indexed-fields).

| Operator | Description | Example |
|----------|-------------|---------|
| `$eq` | Equal | `{ status: { $eq: 'active' } }` |
| `$ne` | Not equal | `{ status: { $ne: 'archived' } }` |
| `$gt` | Greater than | `{ score: { $gt: 0.8 } }` |
| `$gte` | Greater than or equal | `{ score: { $gte: 0.8 } }` |
| `$lt` | Less than | `{ count: { $lt: 10 } }` |
| `$lte` | Less than or equal | `{ count: { $lte: 10 } }` |
| `$in` | Value in array | `{ category: { $in: ['a', 'b'] } }` |
| `$nin` | Value not in array | `{ category: { $nin: ['x'] } }` |
| `$and` | Logical AND | `{ $and: [{ a: { $eq: 1 } }, { b: { $gt: 2 } }] }` |
| `$or` | Logical OR | `{ $or: [{ a: { $eq: 1 } }, { a: { $eq: 2 } }] }` |

A shorthand `{ key: value }` is treated as `{ key: { $eq: value } }`.

---

## Browser entry point

Importing from `vectra/browser` excludes Node-only modules. The browser entry exports the same indexes, embeddings (except `LocalEmbeddings`), tokenizers, splitter, codecs, types, `ItemSelector`, `pathUtils`, `VirtualFileStorage`, `IndexedDBStorage`, and `BrowserWebFetcher`. Excluded: `LocalFileStorage`, `FileFetcher`, `WebFetcher`, `FolderWatcher`, `VectraServer`, `IndexManager`, `LocalEmbeddings`, `migrateIndex`.

Bundlers that respect package conditional exports auto-resolve `vectra` to the browser entry point when targeting browsers.
