---
title: Getting Started
layout: default
nav_order: 2
---

# Getting Started
{: .no_toc }

Install Vectra and run your first queries in minutes.
{: .fs-6 .fw-300 }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Requirements

- **Node.js 20.x** or newer (for the TypeScript library and CLI)
- A package manager (**npm** or **yarn**)
- An embeddings provider for similarity search:
  - OpenAI (API key + model, e.g., `text-embedding-3-large`)
  - Azure OpenAI (endpoint, deployment name, API key)
  - OpenAI-compatible OSS endpoint (model name + base URL)
- Sufficient RAM to hold your index in memory during queries (see [Performance and limits](/vectra/best-practices#performance-and-limits))

## Install

```sh
# npm
npm install vectra

# yarn
yarn add vectra
```

For CLI usage without a global install:

```sh
npx vectra --help
```

Or install globally:

```sh
npm install -g vectra
vectra --help
```

## Quick Start

Vectra offers two paths depending on your use case:

| Path | You bring | Vectra handles |
|------|-----------|----------------|
| **A — LocalIndex** | Vectors + metadata | Storage, filtering, similarity search |
| **B — LocalDocumentIndex** | Raw text (strings, files, URLs) | Chunking, embedding, retrieval |

---

### Path A: LocalIndex (items + metadata)

Use `LocalIndex` when you already have vectors (or can generate them) and want to store items with metadata.

```ts
import path from 'node:path';
import { LocalIndex } from 'vectra';
import { OpenAI } from 'openai';

// 1) Create an index folder
const index = new LocalIndex(path.join(process.cwd(), 'my-index'));

// 2) Create the index (set which metadata fields you want searchable)
if (!(await index.isIndexCreated())) {
  await index.createIndex({
    version: 1,
    metadata_config: { indexed: ['category'] },
  });
}

// 3) Prepare an embeddings helper
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
async function getVector(text: string): Promise<number[]> {
  const resp = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return resp.data[0].embedding;
}

// 4) Insert items
await index.insertItem({
  vector: await getVector('apple'),
  metadata: { text: 'apple', category: 'food', note: 'stored on disk if not indexed' },
});
await index.insertItem({
  vector: await getVector('blue'),
  metadata: { text: 'blue', category: 'color' },
});

// 5) Query by vector, optionally filter by metadata
const v = await getVector('banana');
const results = await index.queryItems(v, '', 3, { category: { $eq: 'food' } });
for (const r of results) {
  console.log(r.score.toFixed(4), r.item.metadata.text);
}
```

Only fields listed in `metadata_config.indexed` are stored inline and available for filtering. Everything else is kept in per-item JSON files on disk.

---

### Path B: LocalDocumentIndex (documents + chunking + retrieval)

Use `LocalDocumentIndex` when you have raw text and want Vectra to handle chunking, embedding, and retrieval.

```ts
import path from 'node:path';
import { LocalDocumentIndex, OpenAIEmbeddings } from 'vectra';

// 1) Configure embeddings
const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'text-embedding-3-small',
  maxTokens: 8000,
});

// 2) Create the index
const docs = new LocalDocumentIndex({
  folderPath: path.join(process.cwd(), 'my-doc-index'),
  embeddings,
});

if (!(await docs.isIndexCreated())) {
  await docs.createIndex({ version: 1 });
}

// 3) Add a document
await docs.upsertDocument('doc://welcome', `
Vectra is a local, file-backed, in-memory vector database.
It supports Pinecone-like metadata filtering and fast local retrieval.
`, 'md');

// 4) Query and render sections for your prompt
const results = await docs.queryDocuments('What is Vectra best suited for?', {
  maxDocuments: 5,
  maxChunks: 20,
});

if (results.length > 0) {
  const top = results[0];
  console.log('URI:', top.uri, 'score:', top.score.toFixed(4));
  const sections = await top.renderSections(2000, 1, true);
  for (const s of sections) {
    console.log('Section score:', s.score.toFixed(4), 'tokens:', s.tokenCount);
    console.log(s.text);
  }
}
```

{: .note }
Set `isBm25: true` in `queryDocuments` options to enable [hybrid retrieval](/vectra/core-concepts#hybrid-retrieval-documents) — blending keyword matches alongside semantic results.

## Next steps

- [Core Concepts](/vectra/core-concepts) — understand index types, metadata filtering, and on-disk layout
- [CLI Reference](/vectra/cli) — manage indexes from the command line
- [API Reference](/vectra/api-reference) — full API documentation
- [Best Practices](/vectra/best-practices) — performance tuning and troubleshooting
