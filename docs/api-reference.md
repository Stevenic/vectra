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

## Utilities

| Class | Description |
|-------|-------------|
| `TextSplitter` | Split text into chunks by token count with configurable overlap |
| `FileFetcher` | Read local files for document ingestion |
| `WebFetcher` | Fetch web pages for document ingestion |
| `LocalFileStorage` | File-system-backed storage (default) |
| `VirtualFileStorage` | In-memory storage for testing |

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
