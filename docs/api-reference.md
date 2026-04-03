---
title: API Reference
layout: default
nav_order: 7
---

# API Reference
{: .no_toc }

TypeScript API overview. Each section summarizes key usage patterns — see detailed guides for full documentation.
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

| Method | Description |
|--------|-------------|
| `createIndex(config)` | Create a new index (throws if exists unless `deleteIfExists: true`) |
| `deleteIndex()` | Delete the index and all contents |
| `isIndexCreated()` | Check if the index exists on disk |
| `insertItem(item)` | Insert a single item |
| `batchInsertItems(items)` | Insert multiple items atomically |
| `queryItems(vector, query, topK, filter?)` | Query by vector with optional metadata filter |
| `listItemsByMetadata(filter)` | List items matching a metadata filter |
| `getItem(id)` | Get a single item by ID |
| `deleteItem(id)` | Delete a single item |
| `beginUpdate() / endUpdate()` | Manual update locking for batch operations |

### LocalDocumentIndex

Document-level ingestion with chunking, embedding, and retrieval. Extends `LocalIndex`.

```ts
import { LocalDocumentIndex, OpenAIEmbeddings } from 'vectra';

const docs = new LocalDocumentIndex({ folderPath: './my-index', embeddings: new OpenAIEmbeddings({...}) });
await docs.upsertDocument('doc://readme', 'Full text...', 'md');
const results = await docs.queryDocuments('search query', { maxDocuments: 5, maxChunks: 20 });
```

| Method | Description |
|--------|-------------|
| `upsertDocument(uri, text, docType?)` | Add or update a document |
| `deleteDocument(uri)` | Remove a document and its chunks |
| `queryDocuments(query, options)` | Query by text, returns `LocalDocumentResult[]` |
| `listDocuments()` | List all documents |
| `getDocumentId(uri)` / `getDocumentUri(id)` | URI/ID lookups |
| `getCatalogStats()` | Document and chunk counts |

See the [Document Indexing](/vectra/documents) guide for chunking, retrieval, and FolderWatcher details.

---

## Embeddings

| Class | Description |
|-------|-------------|
| `OpenAIEmbeddings` | OpenAI, Azure OpenAI, or any OpenAI-compatible endpoint |
| `LocalEmbeddings` | Local HuggingFace models (384 dims default, 256 max tokens) |
| `TransformersEmbeddings` | Async factory with GPU/WASM, quantization, pooling (384 dims default, 512 max tokens) |

All implement the `EmbeddingsModel` interface with `createEmbeddings(inputs)`.

See the [Embeddings Guide](/vectra/embeddings) for configuration options, provider comparison, and browser compatibility.

---

## Storage

| Class | Environment | Description |
|-------|-------------|-------------|
| `LocalFileStorage` | Node.js | Filesystem storage (default) |
| `IndexedDBStorage` | Browser, Electron | IndexedDB-backed persistent storage |
| `VirtualFileStorage` | Any | In-memory storage for testing |

All implement the `FileStorage` interface. See the [Storage](/vectra/storage) guide for the full interface, custom implementations, and browser setup.

---

## Codecs

| Class | Description |
|-------|-------------|
| `JsonCodec` | JSON serialization (default, human-readable) |
| `ProtobufCodec` | Protocol Buffer serialization (40-50% smaller, requires `protobufjs`) |

```ts
import { LocalIndex, ProtobufCodec } from 'vectra';
const index = new LocalIndex('./my-index', { codec: new ProtobufCodec() });
```

See [Storage — Formats](/vectra/storage#storage-formats) for migration instructions.

---

## Ingestion

| Class | Environment | Description |
|-------|-------------|-------------|
| `FileFetcher` | Node.js | Read local files and recursively scan directories |
| `WebFetcher` | Node.js | Fetch web pages, convert HTML to markdown (uses cheerio) |
| `BrowserWebFetcher` | Browser, Electron | Fetch web pages using Fetch API + DOMParser |
| `FolderWatcher` | Node.js | Watch directories and auto-sync into a `LocalDocumentIndex` |
| `TextSplitter` | Any | Split text into chunks by token count with configurable overlap |

See [Document Indexing](/vectra/documents) for usage examples and configuration.

---

## Utilities

| Export | Description |
|--------|-------------|
| `GPT3Tokenizer` | Token counting (GPT-3/GPT-4 compatible) |
| `TransformersTokenizer` | Tokenizer matching a `TransformersEmbeddings` model |
| `ItemSelector` | Item selection utilities |
| `pathUtils` | Cross-platform path utilities (works in Node.js and browsers) |
| `migrateIndex` | Migrate an index between serialization formats |
| `VectraServer` | gRPC server for cross-language access |
| `IndexManager` | Multi-index management for the gRPC server |

---

## Types

### EmbeddingsModel

Interface implemented by all embeddings providers:

```ts
interface EmbeddingsModel {
  maxTokens: number;
  createEmbeddings(inputs: string | string[]): Promise<EmbeddingsResponse>;
}
```

### FileStorage

Interface implemented by all storage backends. See [Storage](/vectra/storage#filestorage-interface) for the full 9-method contract.

### IndexCodec

Interface implemented by serialization codecs (`JsonCodec`, `ProtobufCodec`).

### Filter operators

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
