---
title: Document Indexing
layout: default
nav_order: 5
---

# Document Indexing
{: .no_toc }

Ingest, chunk, embed, and retrieve documents with LocalDocumentIndex.
{: .fs-6 .fw-300 }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Overview

`LocalDocumentIndex` handles the full document lifecycle: you provide raw text (strings, files, or URLs), and Vectra splits it into chunks, generates embeddings, stores everything on disk, and retrieves ranked results at query time.

```
ingest → chunk → embed → store → query → rank → render sections
```

This page covers each stage in detail. For the item-level API where you supply your own vectors, see [Core Concepts](/vectra/core-concepts#localindex).

## Creating a document index

```ts
import { LocalDocumentIndex, OpenAIEmbeddings } from 'vectra';

const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'text-embedding-3-small',
  maxTokens: 8000,
});

const docs = new LocalDocumentIndex({
  folderPath: './my-doc-index',
  embeddings,
});

if (!(await docs.isIndexCreated())) {
  await docs.createIndex({ version: 1 });
}
```

### Constructor options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `folderPath` | `string` | -- | Path to the index folder (required) |
| `embeddings` | `EmbeddingsModel?` | -- | Embeddings provider (required for upsert/query) |
| `tokenizer` | `Tokenizer?` | `GPT3Tokenizer` | Tokenizer for chunk counting |
| `chunkingConfig` | `Partial<TextSplitterConfig>?` | See below | Chunking configuration |
| `storage` | `FileStorage?` | `LocalFileStorage` | Storage backend |
| `codec` | `IndexCodec?` | `JsonCodec` | Serialization format |
| `indexName` | `string?` | `'index.json'` | Name of the index file |

## Adding documents

### upsertDocument

Add or update a document. Vectra splits the text into chunks, generates embeddings for each chunk, and stores everything atomically.

```ts
await docs.upsertDocument('doc://readme', 'Full document text here...', 'md');
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `uri` | `string` | Unique document identifier (any string — URLs, file paths, custom IDs) |
| `text` | `string` | Document content |
| `docType` | `string?` | Hint for chunking separators (e.g., `'md'`, `'txt'`, `'html'`, `'py'`) |

If a document with the same URI already exists, it is replaced (old chunks deleted, new chunks inserted).

### Ingesting from files and URLs

Vectra provides fetcher classes to read content before passing it to `upsertDocument`:

**FileFetcher** — Read local files or recursively scan directories (Node.js only):

```ts
import { FileFetcher } from 'vectra';

const fetcher = new FileFetcher();
await fetcher.fetch('./docs/', async (uri, text, docType) => {
  await docs.upsertDocument(uri, text, docType);
  return true; // continue processing
});
```

**WebFetcher** — Fetch web pages and convert HTML to markdown (Node.js only):

```ts
import { WebFetcher } from 'vectra';

const fetcher = new WebFetcher({ htmlToMarkdown: true });
await fetcher.fetch('https://example.com/page', async (uri, text, docType) => {
  await docs.upsertDocument(uri, text, docType);
  return true;
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `htmlToMarkdown` | `boolean` | `true` | Convert HTML to markdown |
| `summarizeHtml` | `boolean` | `false` | Extract summary from HTML |
| `headers` | `Record<string, string>?` | Browser-like defaults | Custom HTTP headers |
| `requestConfig` | `RequestInit?` | -- | Custom fetch options |

**BrowserWebFetcher** — Fetch web pages in browsers/Electron using Fetch API + DOMParser:

```ts
import { BrowserWebFetcher } from 'vectra/browser';

const fetcher = new BrowserWebFetcher();
await fetcher.fetch('https://example.com', async (uri, text, docType) => {
  await docs.upsertDocument(uri, text, docType);
  return true;
});
```

## Chunking

When a document is upserted, Vectra splits it into chunks using `TextSplitter`. Each chunk becomes one item in the underlying vector index.

### How TextSplitter works

1. **Recursive splitting** — tries the first separator in the list. If a resulting piece exceeds `chunkSize` tokens, it recurses with the next separator.
2. **Separators by docType** — markdown files get `\n## `, `\n### `, `\n\n`, `\n`, ` `; Python gets `\nclass `, `\ndef `, `\n\n`, `\n`, ` `; etc.
3. **Overlap** — when `chunkOverlap > 0`, each chunk stores leading/trailing overlap tokens for context continuity.

### Chunking defaults

`LocalDocumentIndex` applies its own defaults, which differ from standalone `TextSplitter`:

| Setting | LocalDocumentIndex | TextSplitter (standalone) |
|---------|-------------------|--------------------------|
| `chunkSize` | 512 | 400 |
| `chunkOverlap` | 0 | 40 |
| `keepSeparators` | `true` | `false` |

### Configuring chunking

```ts
const docs = new LocalDocumentIndex({
  folderPath: './my-index',
  embeddings,
  chunkingConfig: {
    chunkSize: 256,
    chunkOverlap: 50,
    keepSeparators: true,
  },
});
```

| Option | Type | Description |
|--------|------|-------------|
| `chunkSize` | `number` | Maximum tokens per chunk |
| `chunkOverlap` | `number` | Overlap tokens between adjacent chunks |
| `keepSeparators` | `boolean` | Preserve separator text at chunk boundaries |
| `docType` | `string?` | Default document type for separator selection |
| `separators` | `string[]?` | Custom separator list (overrides docType) |
| `tokenizer` | `Tokenizer?` | Custom tokenizer for token counting |

### Chunking tips

- **Start with defaults** (512 tokens, 0 overlap) — they work well for most use cases
- **Smaller chunks** (128-256) improve precision but may lose context
- **Add overlap** (20-50 tokens) when queries need cross-chunk context
- Keep `chunkSize` under your embedding provider's `maxTokens`
- Use `docType` hints (e.g., `'md'`, `'py'`) to get appropriate separators

## Querying documents

### queryDocuments

```ts
const results = await docs.queryDocuments('What is Vectra?', {
  maxDocuments: 5,
  maxChunks: 20,
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxDocuments` | `number?` | `10` | Maximum documents to return |
| `maxChunks` | `number?` | `50` | Maximum chunks to evaluate per query |
| `filter` | `MetadataFilter?` | -- | Metadata filter (on chunk metadata) |
| `isBm25` | `boolean?` | `false` | Enable hybrid BM25 keyword retrieval |

Returns an array of `LocalDocumentResult` objects sorted by relevance score.

### Rendering sections

Each `LocalDocumentResult` can render its matched chunks into readable sections within a token budget — ideal for feeding into an LLM prompt:

```ts
const results = await docs.queryDocuments('search query', { maxDocuments: 3 });

for (const result of results) {
  console.log('Document:', result.uri, 'Score:', result.score.toFixed(4));

  const sections = await result.renderSections(2000, 1, true);
  for (const section of sections) {
    console.log('  Section score:', section.score.toFixed(4));
    console.log('  Tokens:', section.tokenCount);
    console.log('  BM25 match:', section.isBm25);
    console.log(section.text);
  }
}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `maxTokens` | `number` | Token budget per section |
| `sectionCount` | `number` | Number of sections to render |
| `overlap` | `boolean?` | Include overlapping context between sections |

`renderSections` merges adjacent high-scoring chunks into contiguous text sections, respecting the token budget. Each section includes:
- `text` — the rendered text
- `score` — relevance score
- `tokenCount` — actual token count
- `isBm25` — whether this was a keyword (BM25) match

## Hybrid retrieval (BM25)

By default, queries use **semantic retrieval** only — ranking chunks by embedding cosine similarity. Enable **hybrid mode** to also find strong keyword matches using Okapi BM25:

```ts
const results = await docs.queryDocuments('error handling patterns', {
  maxDocuments: 5,
  maxChunks: 20,
  isBm25: true,
});
```

When `isBm25: true`:
1. Semantic search runs first, returning the top chunks by cosine similarity
2. BM25 keyword search runs on remaining chunks
3. Top BM25 matches are appended to results
4. Each rendered section's `isBm25` flag tells you which source it came from

Use hybrid retrieval when:
- Queries contain **exact terms** (function names, error codes, identifiers)
- You want to catch matches that semantic search might miss
- Users search with **short, keyword-heavy queries**

## FolderWatcher

`FolderWatcher` keeps a `LocalDocumentIndex` in sync with a directory of files. It performs an initial full sync, then monitors for real-time changes.

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

// Later:
await watcher.stop();
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `index` | `LocalDocumentIndex` | -- | The index to sync into |
| `paths` | `string[]` | -- | Folders or files to watch |
| `extensions` | `string[]?` | all files | File extensions to include |
| `debounceMs` | `number?` | `500` | Debounce interval in ms |

{: .note }
Node.js only — uses `fs.watch()` for filesystem monitoring. For the CLI equivalent, see [`vectra watch`](/vectra/cli#watch).

## Deleting documents

```ts
await docs.deleteDocument('doc://readme');
```

Removes the document body, all its chunks from the vector index, and updates the catalog. If the URI doesn't exist, this is a no-op.

## Listing documents

```ts
const documents = await docs.listDocuments();
```

Returns all documents in the catalog.

## On-disk layout

A document index folder contains:

```
my-doc-index/
├── index.json          # chunk vectors + chunk metadata (documentId, startPos, endPos)
├── catalog.json        # URI ↔ document ID mapping + document count
├── <docId>.txt         # document body (plain text)
├── <docId>.json        # optional per-chunk metadata
└── ...
```

With Protocol Buffers enabled, `.json` files become `.pb` files (except document bodies which stay `.txt`). See [Storage Formats](/vectra/storage#storage-formats) for details.
