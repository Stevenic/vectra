# Vectra: local, file-backed vector database for Node.js

## Overview
Vectra is a file-backed, in-memory vector database for Node.js with an optional gRPC server for cross-language access. It works like a local [Pinecone](https://www.pinecone.io/) or [Qdrant](https://qdrant.tech/): each index is just a folder on disk with an index file containing vectors and any metadata fields you choose to index; all other metadata is stored per-item as separate files. Queries use a Pinecone-compatible subset of [MongoDB-style operators](https://www.mongodb.com/docs/manual/reference/operator/query/) for filtering, then rank matches by cosine similarity. Because the entire index is loaded into memory, lookups are extremely fast (often <1 ms for small indexes, commonly 1-2 ms for larger local sets). It's ideal when you want simple, zero-infrastructure retrieval over a small, mostly static corpus. Pinecone-style namespaces aren't built-in, but you can mimic them by using separate folders (indexes).

Typical use cases:
- Prompt augmentation over a small, mostly static corpus
- Infinite few-shot example libraries
- Single-document or small multi-document Q&A
- Local/dev workflows where hosted vector DBs are overkill
- Cross-language access via the gRPC server and generated client bindings

## Table of Contents
- [What's New in Vectra 0.14](#whats-new-in-vectra-014)
- [Why Vectra](#why-vectra)
- [When to use (and when not)](#when-to-use-and-when-not)
- [Requirements](#requirements)
- [Install](#install)
- [Quick Start](#quick-start)
  - [Path A: LocalIndex (items + metadata)](#path-a-localindex-items--metadata)
  - [Path B: LocalDocumentIndex (documents + chunking + retrieval)](#path-b-localdocumentindex-documents--chunking--retrieval)
- [Embeddings Providers](#embeddings-providers)
  - [OpenAI / Azure OpenAI / OSS](#openai--azure-openai--oss)
  - [Local Embeddings (no API key)](#local-embeddings-no-api-key)
- [CLI Reference](#cli-reference)
  - [Global Options](#global-options)
  - [create](#create)
  - [delete](#delete)
  - [add](#add)
  - [remove](#remove)
  - [query](#query)
  - [stats](#stats)
  - [migrate](#migrate)
  - [serve](#serve)
  - [stop](#stop)
  - [generate](#generate)
- [gRPC Server](#grpc-server)
  - [Starting the Server](#starting-the-server)
  - [Service API](#service-api)
  - [Language Bindings](#language-bindings)
- [Storage Formats](#storage-formats)
  - [JSON (default)](#json-default)
  - [Protocol Buffers](#protocol-buffers)
  - [Migrating Between Formats](#migrating-between-formats)
- [Core Concepts](#core-concepts)
  - [Index Types](#index-types)
  - [Metadata Filtering (Pinecone-compatible subset)](#metadata-filtering-pinecone-compatible-subset)
  - [Hybrid Retrieval (documents)](#hybrid-retrieval-documents)
  - [On-disk Layout](#on-disk-layout)
- [File-backed vs In-memory Usage](#file-backed-vs-in-memory-usage)
- [Best Practices](#best-practices)
- [Performance and Limits](#performance-and-limits)
- [Troubleshooting (quick)](#troubleshooting-quick)
- [API Summary](#api-summary)
- [License](#license)
- Project Links
  - [CONTRIBUTING.md](https://github.com/Stevenic/vectra/blob/main/CONTRIBUTING.md)
  - [CODE_OF_CONDUCT.md](https://github.com/Stevenic/vectra/blob/main/CODE_OF_CONDUCT.md)
  - [LICENSE](https://github.com/Stevenic/vectra/blob/main/LICENSE)

## What's New in Vectra 0.14

### Local Embeddings (no API key required)
Use HuggingFace transformer models to generate embeddings entirely on your machine. No API key, no network calls. Install the optional `@huggingface/transformers` package and use the new `LocalEmbeddings` class:
```ts
import { LocalEmbeddings, LocalDocumentIndex } from 'vectra';

const embeddings = new LocalEmbeddings(); // defaults to Xenova/all-MiniLM-L6-v2
const index = new LocalDocumentIndex({ folderPath: './my-index', embeddings });
```

### Protocol Buffer Storage Format
Indexes can now be stored in Protocol Buffer format for 40-50% smaller files on disk. Use `--format protobuf` when creating an index, or migrate existing indexes with `vectra migrate`. The `protobufjs` package is an optional dependency — install it to enable this feature.

### gRPC Server
Vectra now ships with a built-in gRPC server (`vectra serve`) that exposes all index operations over the network. This enables any language to use Vectra as a vector database without the Node.js library. Supports single-index and multi-index modes, foreground and daemon operation, and 19 RPCs covering index management, item CRUD, document operations, queries, stats, and lifecycle.

### Language Binding Generator
Generate idiomatic client scaffolding for **6 languages** with `vectra generate --language <lang> --output <dir>`. Supported languages: Python, C#, Rust, Go, Java, and TypeScript. Each generated package includes the proto file, a client wrapper, and a README with setup instructions.

### New CLI Commands
- `vectra delete <index>` — delete an existing index
- `vectra migrate <index> --to <format>` — migrate between JSON and protobuf formats
- `vectra serve [index]` — start the gRPC server
- `vectra stop --pid-file <path>` — stop a running daemon
- `vectra generate --language <lang> --output <dir>` — scaffold language bindings
- Global `--storage` and `--storage-root` options for all commands

## Why Vectra
- Zero infrastructure: everything lives in a local folder; no servers, clusters, or managed services required.
- Predictable local performance: full in-memory scans with pre-normalized cosine similarity deliver sub-millisecond to low-millisecond latency for small/medium corpora.
- Simple mental model: one folder per index; the index file holds vectors and indexed fields, while non-indexed metadata is stored per-item.
- Easy portability: the file-based, language-agnostic format means indexes can be written in one language and read in another.
- Pinecone-style filtering: use a familiar subset of MongoDB query operators to filter by metadata before similarity ranking.
- Great for prompt engineering: quickly assemble and retrieve few-shot examples or small static corpora without external dependencies.
- Cross-language access: the gRPC server and generated client bindings let Python, C#, Rust, Go, Java, and TypeScript applications use Vectra indexes.
- Flexible storage: choose between JSON (human-readable) and Protocol Buffer (compact binary) serialization.

## When to use (and when not)
Use Vectra when:
- You have a small, mostly static corpus (e.g., a few hundred to a few thousand chunks).
- You want zero-infrastructure local retrieval with fast, predictable latency.
- You're assembling "infinite few-shot" example libraries or single/small document Q&A.
- You need portable, file-based indexes that other languages can read/write.
- You want simple "namespaces" by using separate folders per dataset.
- You need cross-language access to a local vector store via gRPC.

Avoid Vectra when:
- You need long-term, ever-growing chat memory or very large corpora (the entire index loads into RAM).
- You require multi-tenant, networked, or horizontally scalable serving.
- You need advanced vector DB features like HNSW/IVF indexing, sharding/replication, or distributed operations.

Notes and tips:
- Mimic namespaces via separate index folders.
- Index only the metadata fields you'll filter on; keep everything else in per-item files.
- Rough sizing: a 1536-dim float32 vector is ~6 KB in JSON, ~6 KB as binary float array; savings come from eliminating JSON overhead (brackets, commas, text-encoded floats).

## Requirements
- Node.js 20.x or newer
- A package manager (npm or yarn)
- An embeddings provider for similarity search (pick one):
  - **OpenAI** (API key + model, e.g., `text-embedding-3-large` or compatible)
  - **Azure OpenAI** (endpoint, deployment name, API key)
  - **OpenAI-compatible OSS endpoint** (model name + base URL)
  - **Local embeddings** (no API key — install optional `@huggingface/transformers` package)
- If you plan to ingest web pages via the CLI or API, outbound network access to those URLs
- Optional: `protobufjs` package for Protocol Buffer storage format
- Sufficient RAM to hold your entire index in memory during queries (see [Performance and Limits](#performance-and-limits))

## Install
- npm: `npm install vectra`
- yarn: `yarn add vectra`

Optional dependencies:
```sh
# For local embeddings (no API key needed)
npm install @huggingface/transformers

# For Protocol Buffer storage format
npm install protobufjs
```

CLI usage:
- Run without installing globally: `npx vectra --help`
- Optional global install: `npm install -g vectra` (then use `vectra --help`)

## Quick Start
Two common paths:
- Path A: you already have vectors (or can generate them) and want to store items + metadata.
- Path B: you have raw text documents; Vectra will chunk, embed, and retrieve relevant spans.

### Path A: LocalIndex (items + metadata)
- Create a folder-backed index
- Choose which metadata fields to index (others are stored per-item on disk)
- Insert items (vector + metadata)
- Query by vector with optional metadata filters

TypeScript example:
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
    metadata_config: { indexed: ['category'] }, // only these fields live in the index file; others go to per-item files
  });
}

// 3) Prepare an embeddings helper (use any provider you like)
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
async function query(text: string) {
  const v = await getVector(text);
  const results = await index.queryItems(v, '', 3, { category: { $eq: 'food' } });
  for (const r of results) {
    console.log(r.score.toFixed(4), r.item.metadata.text);
  }
}

await query('banana'); // should surface 'apple' in top results
```

Supported filter operators (subset): `$and`, `$or`, `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`. Only fields listed in `metadata_config.indexed` are stored inline and should be used for filtering (everything else is kept per-item on disk).

### Path B: LocalDocumentIndex (documents + chunking + retrieval)
- Create a document index backed by an embeddings model
- Add documents (raw strings, files, or URLs)
- Query by text; Vectra returns the most relevant chunks grouped by document
- Render top sections for direct drop-in to prompts
- Optional hybrid retrieval: add BM25 keyword matches alongside semantic matches

TypeScript example:
```ts
import path from 'node:path';
import { LocalDocumentIndex, OpenAIEmbeddings } from 'vectra';

// 1) Configure embeddings (OpenAI, Azure OpenAI, OSS, or LocalEmbeddings)
const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'text-embedding-3-small',
  maxTokens: 8000, // batching limit for chunked requests
});

// 2) Create the index
const docs = new LocalDocumentIndex({
  folderPath: path.join(process.cwd(), 'my-doc-index'),
  embeddings,
  // optional: customize chunking (defaults: chunkSize 400, chunkOverlap 40)
  // chunkingConfig: { chunkSize: 400, chunkOverlap: 40, keepSeparators: true }
});

if (!(await docs.isIndexCreated())) {
  await docs.createIndex({ version: 1 });
}

// 3) Add a document (string); you can also add files/URLs via FileFetcher/WebFetcher or the CLI
const uri = 'doc://welcome';
const text = `
Vectra is a file-backed, in-memory vector DB for Node.js. It supports Pinecone-like metadata filtering
and fast local retrieval. It's ideal for small, mostly static corpora and prompt augmentation.
`;
await docs.upsertDocument(uri, text, 'md'); // optional docType hints chunking

// 4) Query and render sections for your prompt
const results = await docs.queryDocuments('What is Vectra best suited for?', {
  maxDocuments: 5,
  maxChunks: 20,
  // isBm25: true, // turn on hybrid (semantic + keyword) retrieval
});

// Take top document and render spans of text
if (results.length > 0) {
  const top = results[0];
  console.log('URI:', top.uri, 'score:', top.score.toFixed(4));
  const sections = await top.renderSections(2000, 1, true); // maxTokens per section, number of sections
  for (const s of sections) {
    console.log('Section score:', s.score.toFixed(4), 'tokens:', s.tokenCount, 'bm25:', s.isBm25);
    console.log(s.text);
  }
}
```

Notes:
- `queryDocuments` returns `LocalDocumentResult` objects, each with scored chunks. `renderSections` merges adjacent chunks, keeps within your token budget, and can optionally add overlapping context for readability.
- Hybrid retrieval: set `isBm25: true` in `queryDocuments` to include keyword-based chunks (Okapi-BM25) alongside semantic chunks. Each rendered section includes `isBm25` to help you distinguish them.

## Embeddings Providers

### OpenAI / Azure OpenAI / OSS
Use the `OpenAIEmbeddings` class with one of three configuration styles:

```ts
import { OpenAIEmbeddings } from 'vectra';

// OpenAI
const openai = new OpenAIEmbeddings({
  apiKey: 'sk-...',
  model: 'text-embedding-3-small',
  maxTokens: 8000,
});

// Azure OpenAI
const azure = new OpenAIEmbeddings({
  azureApiKey: 'xxxxx',
  azureEndpoint: 'https://your-resource-name.openai.azure.com',
  azureDeployment: 'your-embedding-deployment',
  azureApiVersion: '2023-05-15',
  maxTokens: 8000,
});

// OpenAI-compatible OSS
const oss = new OpenAIEmbeddings({
  ossModel: 'text-embedding-3-small',
  ossEndpoint: 'https://your-oss-endpoint.example.com',
  maxTokens: 8000,
});
```

Additional options: `dimensions` (control embedding dimensions), `retryPolicy` (array of retry delay ms, default `[2000, 5000]`), `logRequests` (debug logging).

### Local Embeddings (no API key)
Run embeddings locally using HuggingFace transformer models. Requires the optional `@huggingface/transformers` package. Models are downloaded and cached locally on first use.

```ts
import { LocalEmbeddings, LocalDocumentIndex } from 'vectra';

// Default model: Xenova/all-MiniLM-L6-v2 (384 dimensions, 256 max tokens)
const embeddings = new LocalEmbeddings();

// Or specify a custom HuggingFace model
const custom = new LocalEmbeddings({
  model: 'Xenova/all-MiniLM-L12-v2',
  maxTokens: 512,
});

const index = new LocalDocumentIndex({
  folderPath: './my-index',
  embeddings,
});
```

Any model compatible with the `feature-extraction` pipeline from `@huggingface/transformers` can be used. The pipeline is lazily initialized on the first call to `createEmbeddings()`.

## CLI Reference

### Global Options
All commands accept these options:
- `--storage <local|virtual>` — storage backend to use (default: `local`)
- `--storage-root <path>` — root folder for local storage

### create
Create a new index folder.
```sh
npx vectra create ./my-index
npx vectra create ./my-index --format protobuf   # use Protocol Buffer format
```

### delete
Delete an existing index and all its data.
```sh
npx vectra delete ./my-index
```

### add
Add documents (URLs or local files) to an index. Requires a `keys.json` for your embeddings provider.

**keys.json examples:**

OpenAI:
```json
{ "apiKey": "sk-...", "model": "text-embedding-3-small", "maxTokens": 8000 }
```

Azure OpenAI:
```json
{
  "azureApiKey": "xxxxx",
  "azureEndpoint": "https://your-resource-name.openai.azure.com",
  "azureDeployment": "your-embedding-deployment",
  "azureApiVersion": "2023-05-15",
  "maxTokens": 8000
}
```

OpenAI-compatible OSS:
```json
{ "ossModel": "text-embedding-3-small", "ossEndpoint": "https://your-oss-endpoint.example.com", "maxTokens": 8000 }
```

```sh
# Add a single URL
npx vectra add ./my-index --keys ./keys.json --uri https://example.com/page

# Multiple URIs or local files
npx vectra add ./my-index --keys ./keys.json \
  --uri https://example.com/page1 \
  --uri ./local-docs/guide.md

# From a list file (one URI per line)
npx vectra add ./my-index --keys ./keys.json --list ./uris.txt
```

Flags: `--cookie "<string>"` (auth cookies), `--chunk-size <n>` (chunk size in tokens, default 512).

### remove
Remove documents by URI.
```sh
npx vectra remove ./my-index --uri https://example.com/page
npx vectra remove ./my-index --list ./uris.txt
```

### query
Query an index by text.
```sh
npx vectra query ./my-index "What is Vectra?" --keys ./keys.json
```

Tuning flags:
```sh
npx vectra query ./my-index "hybrid retrieval" \
  --keys ./keys.json \
  --document-count 3 \
  --chunk-count 50 \
  --section-count 1 \
  --tokens 1200 \
  --format sections \
  --overlap true \
  --bm25 true
```

| Flag | Alias | Default | Description |
|------|-------|---------|-------------|
| `--keys` | `-k` | — | Path to keys.json (required) |
| `--document-count` | `-dc` | 10 | Max documents to return |
| `--chunk-count` | `-cc` | 50 | Max chunks to return |
| `--section-count` | `-sc` | 1 | Max sections to render per document |
| `--tokens` | `-t` | 2000 | Max tokens per rendered section |
| `--format` | `-f` | sections | Output format: `sections`, `stats`, `chunks` |
| `--overlap` | `-o` | true | Include overlapping chunks in sections |
| `--bm25` | `-b` | false | Enable hybrid semantic + keyword search |

### stats
Print index statistics.
```sh
npx vectra stats ./my-index
```

### migrate
Migrate an index between serialization formats.
```sh
npx vectra migrate ./my-index --to protobuf
npx vectra migrate ./my-index --to json
```

### serve
Start the gRPC server to serve one or more indexes.
```sh
# Serve a single index
npx vectra serve ./my-index --keys ./keys.json

# Serve all indexes under a root directory
npx vectra serve --root ./indexes --keys ./keys.json --port 50051

# Run as a background daemon
npx vectra serve ./my-index --keys ./keys.json --daemon --pid-file ./vectra.pid
```

| Flag | Default | Description |
|------|---------|-------------|
| `--root <dir>` | — | Directory containing multiple index subdirectories |
| `--port` | 50051 | Port to bind the gRPC server on |
| `--keys` | — | Path to keys.json for server-side embeddings |
| `--daemon` | false | Fork to background as a daemon process |
| `--pid-file` | auto | Path to PID file (daemon mode) |

### stop
Stop a running Vectra daemon.
```sh
npx vectra stop --pid-file ./vectra.pid
```

### generate
Generate language bindings for the gRPC service.
```sh
npx vectra generate --language python --output ./bindings/python
npx vectra generate --language csharp --output ./bindings/csharp
```

Supported languages: `python`, `csharp`, `rust`, `go`, `java`, `typescript`.

Each generated package includes the `.proto` file, an idiomatic client wrapper, and a README with setup instructions.

## gRPC Server

Vectra includes a built-in gRPC server that exposes all index operations over the network. This lets any language use Vectra as a vector database — clients send text, the server computes embeddings and executes operations.

### Starting the Server

**Single-index mode** — serve one index:
```sh
npx vectra serve ./my-index --keys ./keys.json --port 50051
```

**Multi-index mode** — serve all indexes under a directory:
```sh
npx vectra serve --root ./indexes --keys ./keys.json
```
The server auto-detects index subdirectories. New indexes can be created via the `CreateIndex` RPC.

**Daemon mode** — run in the background:
```sh
npx vectra serve ./my-index --keys ./keys.json --daemon --pid-file ./vectra.pid
npx vectra stop --pid-file ./vectra.pid   # stop later
```

The server binds to `127.0.0.1` only (localhost).

### Service API

The `VectraService` gRPC service provides 19 RPCs:

| Category | RPCs |
|----------|------|
| **Index Management** | `CreateIndex`, `DeleteIndex`, `ListIndexes` |
| **Item Operations** | `InsertItem`, `UpsertItem`, `BatchInsertItems`, `GetItem`, `DeleteItem`, `ListItems` |
| **Query** | `QueryItems`, `QueryDocuments` |
| **Document Operations** | `UpsertDocument`, `DeleteDocument`, `ListDocuments` |
| **Stats** | `GetIndexStats`, `GetCatalogStats` |
| **Lifecycle** | `Healthcheck`, `Shutdown` |

The full service definition is in [`proto/vectra_service.proto`](proto/vectra_service.proto).

### Language Bindings

Generate client scaffolding for your language:

```sh
npx vectra generate --language <lang> --output <dir>
```

| Language | Client Class | Notes |
|----------|-------------|-------|
| Python | `VectraClient` | Uses `grpcio`; run `protoc` to generate stubs |
| C# | `VectraClient` | Uses `Grpc.Net.Client`; add Protobuf item to `.csproj` |
| Rust | `vectra-client` crate | Uses `tonic`; `build.rs` generates stubs |
| Go | `VectraClient` | Uses `google.golang.org/grpc`; run `protoc` for stubs |
| Java | `VectraClient` | Uses gRPC Java; place proto in `src/main/proto/` |
| TypeScript | `VectraClient` | Uses `@grpc/grpc-js`; dynamic proto loading, no codegen |

## Storage Formats

Vectra supports two serialization formats for index data.

### JSON (default)
Human-readable, zero dependencies. This is the original format and the default for new indexes.
- Index files use `.json` extension
- Easy to inspect, debug, and version control

### Protocol Buffers
Compact binary format providing 40-50% smaller index files. Requires the optional `protobufjs` package.

```sh
npm install protobufjs
npx vectra create ./my-index --format protobuf
```

In code:
```ts
import { LocalIndex, ProtobufCodec } from 'vectra';

const index = new LocalIndex('./my-index', { codec: new ProtobufCodec() });
```

- Index files use `.pb` extension
- Float32 for vectors, float64 for norms
- Automatic format detection on read (based on file extension)

### Migrating Between Formats
Convert existing indexes between JSON and Protocol Buffer format:

```sh
npx vectra migrate ./my-index --to protobuf
npx vectra migrate ./my-index --to json
```

In code:
```ts
import { migrateIndex } from 'vectra';

await migrateIndex('./my-index', { to: 'protobuf' });
```

## Core Concepts
Vectra keeps a simple, portable model: indexes live as folders on disk, but are fully loaded into memory at query time. You choose whether to work at the "item" level (you supply vectors + metadata) or the "document" level (Vectra chunks, embeds, and retrieves).

### Index Types
- **LocalIndex**
  - You bring vectors and metadata.
  - Configure which metadata fields to "index" (kept inline in the index file) vs store per-item in external files.
  - Query by vector with optional metadata filtering; results return items sorted by cosine similarity.
- **LocalDocumentIndex**
  - You bring raw text (strings, files, or URLs).
  - Vectra splits text into chunks, generates embeddings (via your configured provider), stores chunk metadata (documentId, startPos, endPos), and persists the document body to disk.
  - Query by text; results are grouped per document with methods to render scored spans for prompts.

Both are folder-backed and portable: any language can read/write the on-disk format.

### Metadata Filtering (Pinecone-compatible subset)
- Filters are evaluated before similarity ranking using a subset of MongoDB-style operators:
  - Logical: `$and`, `$or`
  - Comparison: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`
  - Sets/strings: `$in`, `$nin`
- Indexed vs non-indexed fields
  - Fields listed in `metadata_config.indexed` are stored inline in the index file and are ideal for filtering.
  - All other metadata is stored in a per-item file on disk to keep the index file small.
  - Trade-off: indexing more fields speeds filtering but increases index file size.

### Hybrid Retrieval (documents)
- `LocalDocumentIndex` supports semantic retrieval by embeddings and optional keyword retrieval via Okapi-BM25.
- Enable BM25 per query (`isBm25: true`) to blend in strong keyword matches alongside semantic chunks.
- Results and rendered sections flag BM25 spans so you can treat them differently in prompts if desired.

### On-disk Layout
An index folder contains:

**JSON format:**
- `index.json` — version, metadata_config, and an array of items (id, vector, norm, metadata, optional metadataFile)
- `*.json` — per-item metadata files (when not all fields are indexed)
- `catalog.json` — URI-to-ID mapping for document indexes
- `<documentId>.txt` — document body files
- `<documentId>.json` — optional document-level metadata

**Protocol Buffer format:**
- `index.pb` — same data as `index.json`, in binary proto format
- `*.pb` — per-item metadata in binary proto format
- `catalog.pb` — URI-to-ID mapping in binary proto format
- `<documentId>.txt` — document body files (unchanged)

## File-backed vs In-memory Usage
Vectra uses a single, consistent model: indexes persist as files/folders on disk, but are fully loaded into memory for filtering and similarity ranking.

- **Persistent usage**
  - Choose a stable folder and reuse it across runs.
  - Create the index once, then upsert/insert items or documents incrementally.
  - Example: `./my-doc-index` checked into your project or stored on a local volume.

- **Ephemeral usage**
  - Use a temporary directory per run and rebuild from source content.
  - Useful for CI, notebooks, or demos where rebuild cost is low and determinism is desirable.
  - Tip: pass `deleteIfExists: true` on `createIndex` to reset quickly.

Example:
```ts
import path from 'node:path';
import os from 'node:os';
import { LocalIndex } from 'vectra';

const folderPath = process.env.PERSISTENT_INDEX_DIR
  ? process.env.PERSISTENT_INDEX_DIR
  : path.join(os.tmpdir(), 'vectra-ephemeral');

const index = new LocalIndex(folderPath);
await index.createIndex({
  version: 1,
  deleteIfExists: !process.env.PERSISTENT_INDEX_DIR, // reset if ephemeral
  metadata_config: { indexed: ['category'] },
});
```

## Best Practices
- **Index only what you filter on**
  - Put frequently used filter fields in `metadata_config.indexed` to keep the index file small but filterable.
  - Store everything else in per-item files (automatically handled).

- **Use separate folders as namespaces**
  - Mimic Pinecone namespaces by creating one index folder per dataset or tenant.

- **Batch writes when possible**
  - Prefer `batchInsertItems` for item-level bulk adds; it applies all-or-nothing and avoids partial updates.
  - For document flow, `upsertDocument`/`deleteDocument` wrap `beginUpdate`/`endUpdate` for you.

- **Respect the update lock**
  - If you manage updates manually, call `beginUpdate` -> multiple insert/delete -> `endUpdate`.
  - Avoid overlapping updates; calling `beginUpdate` twice throws.

- **Choose chunk sizes sensibly (documents)**
  - Default: `chunkSize` 400 tokens with 40-token overlap.
  - If queries are long or context is important, consider larger overlap; keep `chunkSize` under your embedding provider's `maxTokens` per request batch.
  - `keepSeparators: true` preserves natural boundaries for better section rendering.

- **Tune retrieval to your data**
  - For exact phrases or code terms, enable hybrid retrieval (`isBm25: true`) to add keyword matches to semantic results.
  - Render sections with a realistic token budget for your target LLM; 1000-2000 tokens per section is common.

- **Keep vectors consistent**
  - Use the same embedding model/dimensions across an index.
  - Re-embed and rebuild if you change models.

- **Consider protobuf for large indexes**
  - Protocol Buffer format reduces index file sizes by 40-50%.
  - Use `vectra create --format protobuf` for new indexes or `vectra migrate --to protobuf` for existing ones.

- **Be mindful of memory**
  - The entire index is loaded into RAM; estimate vector + metadata size and stay within budget.
  - Consider multiple smaller indexes instead of one giant index if you have distinct corpora.

## Performance and Limits
- **How it searches**
  - Linear scan over all items with cosine similarity; vectors are pre-normalized and each item caches its norm.
  - Results are sorted by similarity and truncated to topK.
  - Hybrid mode (documents) optionally adds BM25 keyword matches after the semantic pass.

- **Typical latency**
  - Small indexes: often <1 ms per query.
  - Medium local corpora: commonly 1-2 ms; depends on CPU, vector dimensionality, and metadata filtering cost.
  - BM25 adds a small overhead proportional to the number of non-selected chunks it evaluates.

- **Memory model**
  - Entire index is loaded into RAM for querying.
  - Rule-of-thumb sizing per vector (Node.js in-memory):
    - `number[]` uses ~8 bytes per element (JS double) + array/object overhead.
    - Example: 1536-dim vector ~ 12 KB for raw numbers, plus per-item metadata/object overhead.
  - On disk, JSON is larger than binary; protobuf format reduces file sizes by 40-50%.

- **Choose dimensions and fields wisely**
  - Use the smallest embedding dimensionality that meets quality requirements.
  - Index only fields you actually filter on to keep the index file smaller and reduce load/parse time.

- **Limits and cautions**
  - Not intended for large, ever-growing chat memories or multi-million-item corpora.
  - Very large indexes mean high RAM usage and longer (de)serialization times at startup.
  - Sorting all distances is O(n log n); keep n within practical bounds for your machine.
  - Embedding generation is external to Vectra; rate limits and throughput depend on your provider and model.
  - Web ingestion depends on site availability/format; use `--cookie` if needed and respect robots/terms.

## Troubleshooting (quick)
- **Missing/invalid embeddings config**
  - Symptom: "Embeddings model not configured." or provider errors.
  - Fix: For code, pass an `OpenAIEmbeddings` or `LocalEmbeddings` instance. For CLI, supply a valid `keys.json`:
    - OpenAI: `{ "apiKey": "...", "model": "text-embedding-3-small", "maxTokens": 8000 }`
    - Azure OpenAI: `{ "azureApiKey": "...", "azureEndpoint": "https://...", "azureDeployment": "...", "azureApiVersion": "2023-05-15" }`
    - OSS: `{ "ossModel": "text-embedding-3-small", "ossEndpoint": "https://..." }`

- **Rate limits/timeouts when embedding**
  - Symptom: "rate_limited" or provider errors.
  - Fix: Reduce batch size (`chunkSize`), add delay/retries (`OpenAIEmbeddings` has `retryPolicy`), or upgrade your plan.

- **Index already exists**
  - Symptom: "Index already exists".
  - Fix: Pass `deleteIfExists: true` to `createIndex`, or call `deleteIndex` first.

- **Index not found**
  - Symptom: "Index does not exist".
  - Fix: Call `isIndexCreated()` and `createIndex()` before using the index.

- **Update lock misuse**
  - Symptom: "Update already in progress" (double begin) or "No update in progress" (end without begin).
  - Fix: Pair `beginUpdate` -> insert/delete -> `endUpdate`. Prefer `batchInsertItems` or helper methods (`upsertDocument`) to avoid manual locking.

- **Filters return no results**
  - Symptom: Expected items aren't matched by metadata filter.
  - Fix: Only fields listed in `metadata_config.indexed` are filterable inline. Ensure the field is included at index creation and that your operators/values (`$eq`, `$in`, etc.) match actual data types.

- **Dimension mismatch or NaNs**
  - Symptom: Weird scores or NaN.
  - Fix: Keep a single embedding model/dimension per index; re-embed and rebuild if you change models.

- **Node/environment issues**
  - Symptom: Runtime errors on fs or syntax.
  - Fix: Use Node 20.x+, verify file permissions and paths. For local storage, ensure the target folder exists/permissions allow write.

- **Corrupt/invalid data on disk**
  - Symptom: Parse errors reading index or metadata files.
  - Fix: Recreate the index (`deleteIfExists: true`) and re-ingest, or restore from a clean copy.

- **Web fetching problems (CLI)**
  - Symptom: "invalid content type" or 4xx/5xx.
  - Fix: Use `--cookie` for authenticated pages; ensure URL is reachable and returns text/html or other allowed types.

- **BM25 returns nothing**
  - Symptom: No keyword chunks added.
  - Fix: Ensure `isBm25: true` at query time and a non-empty query string. Only topK BM25 results are blended in after semantic selection.

- **protobufjs not found**
  - Symptom: "The protobufjs package is required" error when using protobuf format.
  - Fix: Install the optional dependency: `npm install protobufjs`.

- **@huggingface/transformers not found**
  - Symptom: "The @huggingface/transformers package is required for local embeddings" error.
  - Fix: Install the optional dependency: `npm install @huggingface/transformers`.

## API Summary
Key exports from `vectra`:

| Export | Description |
|--------|-------------|
| `LocalIndex` | Item-level vectors + metadata (createIndex, insertItem, batchInsertItems, queryItems, listItemsByMetadata) |
| `LocalDocumentIndex` | Document ingestion + chunking + retrieval (upsertDocument, queryDocuments, listDocuments, renderSections) |
| `OpenAIEmbeddings` | OpenAI / Azure / OSS embeddings helper (createEmbeddings, retryPolicy, maxTokens) |
| `LocalEmbeddings` | Local HuggingFace embeddings (no API key required) |
| `JsonCodec` | JSON serialization codec (default) |
| `ProtobufCodec` | Protocol Buffer serialization codec |
| `migrateIndex` | Migrate an index between serialization formats |
| `VectraServer` | gRPC server for cross-language access |
| `IndexManager` | Multi-index management for the gRPC server |
| `TextSplitter` | Configurable text chunking |
| `GPT3Tokenizer` | Token counting |
| `ItemSelector` | Item selection utilities |
| `FileFetcher` | Local file ingestion |
| `WebFetcher` | Web page ingestion |
| `LocalFileStorage` | File system storage backend |
| `VirtualFileStorage` | In-memory storage backend |

- CLI reference: `npx vectra --help`
- Get involved:
  - Issues and feature requests: https://github.com/Stevenic/vectra/issues
  - Contributing guide: [CONTRIBUTING.md](https://github.com/Stevenic/vectra/blob/main/CONTRIBUTING.md)
  - Code of Conduct: [CODE_OF_CONDUCT.md](https://github.com/Stevenic/vectra/blob/main/CODE_OF_CONDUCT.md)

## License
Vectra is open-source software licensed under the MIT License.

- Full text: [LICENSE](https://github.com/Stevenic/vectra/blob/main/LICENSE)
- Contributions: By submitting a contribution, you agree it will be licensed under the MIT License. See [CONTRIBUTING](https://github.com/Stevenic/vectra/blob/main/CONTRIBUTING.md)
- Community standards: Please review our [CODE_OF_CONDUCT](https://github.com/Stevenic/vectra/blob/main/CODE_OF_CONDUCT.md)
