---
title: Core Concepts
layout: default
nav_order: 3
---

# Core Concepts
{: .no_toc }

How Vectra stores, indexes, and retrieves data.
{: .fs-6 .fw-300 }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Overview

Vectra keeps a simple, portable model: indexes live as folders on disk, but are fully loaded into memory at query time. You choose whether to work at the **item** level (you supply vectors + metadata) or the **document** level (Vectra chunks, embeds, and retrieves for you).

## Index types

### LocalIndex

- **You bring:** vectors and metadata.
- Configure which metadata fields to "index" (kept inline in `index.json`) vs. store per-item in external JSON.
- Query by vector with optional metadata filtering; results return items sorted by cosine similarity.

### LocalDocumentIndex

- **You bring:** raw text (strings, files, or URLs).
- Vectra splits text into chunks, generates embeddings via your configured provider, stores chunk metadata (`documentId`, `startPos`, `endPos`), and persists the document body to disk.
- Query by text; results are grouped per document with methods to render scored spans for prompts.

Both are folder-backed and portable — any language can read/write the on-disk format.

## Metadata filtering

Vectra uses a Pinecone-compatible subset of MongoDB-style query operators. Filters are evaluated **before** similarity ranking.

### Supported operators

| Category | Operators |
|----------|-----------|
| Logical | `$and`, `$or` |
| Comparison | `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte` |
| Set/string | `$in`, `$nin` |

### Indexed vs. non-indexed fields

| | Indexed fields | Non-indexed fields |
|---|---|---|
| **Location** | Inline in `index.json` | Per-item JSON file on disk |
| **Filterable** | Yes | No |
| **Trade-off** | Speeds filtering but increases `index.json` size | Keeps `index.json` small |

Configure indexed fields at index creation:

```ts
await index.createIndex({
  version: 1,
  metadata_config: { indexed: ['category', 'language'] },
});
```

{: .important }
Only fields listed in `metadata_config.indexed` can be used in query filters. All other metadata is stored per-item on disk and is not available for filtering.

## Hybrid retrieval (documents)

`LocalDocumentIndex` supports two retrieval modes:

1. **Semantic** (default) — ranks chunks by embedding cosine similarity.
2. **Keyword (BM25)** — uses Okapi BM25 to find strong keyword matches.

Enable hybrid mode per query:

```ts
const results = await docs.queryDocuments('search term', {
  maxDocuments: 5,
  maxChunks: 20,
  isBm25: true, // blend keyword matches with semantic results
});
```

Each rendered section includes an `isBm25` flag so you can distinguish keyword matches from semantic matches in your prompts.

## On-disk layout

Vectra's on-disk format is language-agnostic — any tool that reads JSON can work with it.

### Basic index (LocalIndex)

```
my-index/
├── index.json          # vectors, norms, indexed metadata
├── <itemId-1>.json     # non-indexed metadata for item 1
├── <itemId-2>.json     # non-indexed metadata for item 2
└── ...
```

**`index.json`** contains:
- `version` — format version
- `metadata_config` — which fields are indexed
- `items[]` — each with `id`, `vector`, `norm`, `metadata` (indexed fields only), and optional `metadataFile`

### Document index (LocalDocumentIndex)

```
my-doc-index/
├── index.json          # chunk vectors + chunk metadata
├── catalog.json        # uri ↔ documentId mapping
├── <docId>.txt         # document body
├── <docId>.json        # optional document-level metadata
└── ...
```

**`catalog.json`** maps URIs to document IDs and tracks counts. It's portable and easy to inspect or version.

## File-backed vs. in-memory usage

### Persistent usage

Choose a stable folder and reuse it across runs:

```ts
const index = new LocalIndex('./my-index');
```

Create the index once, then upsert/insert items or documents incrementally.

### Ephemeral usage

Use a temporary directory per run and rebuild from source. Useful for CI, notebooks, or demos:

```ts
import os from 'node:os';
import path from 'node:path';
import { LocalIndex } from 'vectra';

const folderPath = path.join(os.tmpdir(), 'vectra-ephemeral');
const index = new LocalIndex(folderPath);
await index.createIndex({
  version: 1,
  deleteIfExists: true, // reset each run
  metadata_config: { indexed: ['category'] },
});
```

{: .note }
Pass `deleteIfExists: true` to `createIndex` to reset the index on each run.
