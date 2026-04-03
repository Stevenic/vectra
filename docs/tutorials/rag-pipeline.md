---
title: Build a RAG Pipeline
layout: default
parent: Tutorials
nav_order: 1
---

# Build a RAG Pipeline
{: .no_toc }

Ingest documents, query by text, and feed ranked context into an LLM.
{: .fs-6 .fw-300 }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## What you'll build

A Retrieval-Augmented Generation (RAG) pipeline that:

1. Ingests local files into a Vectra document index
2. Queries the index with a user question
3. Renders the top matching sections into a prompt
4. Sends the prompt to an LLM and prints the answer

## Prerequisites

- Node.js 22.x or newer
- An OpenAI API key (for embeddings and chat completions)
- A folder of text or markdown files to index

```sh
npm install vectra openai
```

## Step 1: Create the index and configure embeddings

```ts
import path from 'node:path';
import { LocalDocumentIndex, OpenAIEmbeddings } from 'vectra';
import { OpenAI } from 'openai';

const INDEX_PATH = path.join(process.cwd(), 'rag-index');

const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'text-embedding-3-small',
  maxTokens: 8000,
});

const docs = new LocalDocumentIndex({
  folderPath: INDEX_PATH,
  embeddings,
});

if (!(await docs.isIndexCreated())) {
  await docs.createIndex({ version: 1 });
}
```

`LocalDocumentIndex` handles chunking and embedding automatically — you just provide raw text.

## Step 2: Ingest documents from a folder

Use `FileFetcher` to recursively scan a directory and upsert each file:

```ts
import { FileFetcher } from 'vectra';

const fetcher = new FileFetcher();

await fetcher.fetch('./my-docs', async (uri, text, docType) => {
  console.log(`Indexing: ${uri}`);
  await docs.upsertDocument(uri, text, docType);
  return true; // continue processing
});

console.log('Ingestion complete.');
```

`FileFetcher` reads files recursively and infers `docType` from the file extension (e.g., `.md`, `.txt`, `.py`). The `docType` controls which separators `TextSplitter` uses for chunking.

{: .note }
For web content, use `WebFetcher` instead — it fetches URLs and converts HTML to markdown. See the [Document Indexing](/vectra/documents#ingesting-from-files-and-urls) guide.

## Step 3: Query the index

```ts
const question = 'How does Vectra handle chunking?';

const results = await docs.queryDocuments(question, {
  maxDocuments: 3,
  maxChunks: 50,
});

console.log(`Found ${results.length} matching documents.`);
```

`queryDocuments` embeds your question, searches the index by cosine similarity, and returns documents ranked by relevance.

### Options to tune

| Option | Effect |
|--------|--------|
| `maxDocuments` | Cap on how many documents to return |
| `maxChunks` | Cap on how many chunks to evaluate (higher = more thorough, slower) |
| `isBm25: true` | Add keyword matches alongside semantic results — useful for exact terms like function names |

## Step 4: Render context sections

Each result can render its matched chunks into readable sections within a token budget:

```ts
let context = '';

for (const result of results) {
  const sections = await result.renderSections(
    1500,  // max tokens per section
    1,     // number of sections
    true   // include overlap for context continuity
  );

  for (const section of sections) {
    context += `\n\n--- Source: ${result.uri} (score: ${result.score.toFixed(4)}) ---\n`;
    context += section.text;
  }
}
```

`renderSections` merges adjacent high-scoring chunks into contiguous text, respecting your token budget. This is what you feed to the LLM as context.

## Step 5: Send to an LLM

```ts
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    {
      role: 'system',
      content: `Answer the user's question using ONLY the context below. If the context doesn't contain the answer, say so.\n\nContext:\n${context}`,
    },
    {
      role: 'user',
      content: question,
    },
  ],
});

console.log('\nAnswer:', response.choices[0].message.content);
```

## Putting it all together

Here's the complete script:

```ts
import path from 'node:path';
import { LocalDocumentIndex, OpenAIEmbeddings, FileFetcher } from 'vectra';
import { OpenAI } from 'openai';

const INDEX_PATH = path.join(process.cwd(), 'rag-index');
const DOCS_PATH = './my-docs';

// --- Setup ---
const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'text-embedding-3-small',
  maxTokens: 8000,
});

const docs = new LocalDocumentIndex({ folderPath: INDEX_PATH, embeddings });

if (!(await docs.isIndexCreated())) {
  await docs.createIndex({ version: 1 });
}

// --- Ingest ---
const fetcher = new FileFetcher();
await fetcher.fetch(DOCS_PATH, async (uri, text, docType) => {
  console.log(`Indexing: ${uri}`);
  await docs.upsertDocument(uri, text, docType);
  return true;
});

// --- Query ---
const question = 'How does Vectra handle chunking?';
const results = await docs.queryDocuments(question, {
  maxDocuments: 3,
  maxChunks: 50,
});

// --- Render context ---
let context = '';
for (const result of results) {
  const sections = await result.renderSections(1500, 1, true);
  for (const section of sections) {
    context += `\n\n--- Source: ${result.uri} (score: ${result.score.toFixed(4)}) ---\n`;
    context += section.text;
  }
}

// --- LLM ---
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: `Answer using ONLY this context. If the answer isn't here, say so.\n\nContext:\n${context}` },
    { role: 'user', content: question },
  ],
});

console.log('\nAnswer:', response.choices[0].message.content);
```

## Next steps

- **Tune chunking** — adjust `chunkSize` and `chunkOverlap` in the constructor. See [Chunking](/vectra/documents#chunking) for guidance.
- **Enable hybrid retrieval** — add `isBm25: true` to catch keyword matches. See [Hybrid Retrieval](/vectra/documents#hybrid-retrieval-bm25).
- **Use local embeddings** — replace `OpenAIEmbeddings` with `LocalEmbeddings` for zero API calls. See the [Embeddings Guide](/vectra/embeddings#localembeddings).
- **Auto-sync** — use `FolderWatcher` to keep the index up to date as files change. See the [Folder Sync tutorial](/vectra/tutorials/folder-sync).
- **Use Protocol Buffers** — pass `codec: new ProtobufCodec()` for 40-50% smaller index files. See [Storage Formats](/vectra/storage#storage-formats).
