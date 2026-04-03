# Vectra: a local vector database

[![npm version](https://img.shields.io/npm/v/vectra.svg)](https://www.npmjs.com/package/vectra)
[![Build](https://github.com/Stevenic/vectra/actions/workflows/ci.yml/badge.svg)](https://github.com/Stevenic/vectra/actions/workflows/ci.yml)
[![Coverage Status](https://coveralls.io/repos/github/Stevenic/vectra/badge.svg?branch=main)](https://coveralls.io/github/Stevenic/vectra?branch=main)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

Vectra is a local, file-backed, in-memory vector database with an optional gRPC server for cross-language access. It works like a local [Pinecone](https://www.pinecone.io/) or [Qdrant](https://qdrant.tech/): each index is just a folder on disk with an index file containing vectors and metadata. Queries use a Pinecone-compatible subset of [MongoDB-style operators](https://www.mongodb.com/docs/manual/reference/operator/query/) for filtering, then rank matches by cosine similarity. Because the entire index is loaded into memory, lookups are extremely fast (often <1 ms for small indexes, commonly 1-2 ms for larger local sets).

**Key capabilities:**

- **Zero infrastructure** — everything lives in a local folder; no servers or managed services required
- **Fast lookups** — sub-millisecond to low-millisecond latency for small/medium corpora
- **Pinecone-style filtering** — familiar MongoDB query operators for metadata filtering
- **Multiple embeddings providers** — OpenAI, Azure OpenAI, OSS endpoints, or local HuggingFace models (no API key needed)
- **Pluggable storage** — filesystem, IndexedDB (browsers), in-memory, or your own custom `FileStorage` implementation
- **Browser compatible** — runs entirely in the browser with IndexedDB persistence and local embeddings
- **CLI included** — manage indexes, serve gRPC, watch folders from the command line
- **Cross-language access** — built-in gRPC server with client bindings for Python, C#, Rust, Go, Java, and TypeScript
- **Flexible serialization** — JSON (human-readable) or Protocol Buffers (40-50% smaller)

Typical use cases: prompt augmentation, infinite few-shot example libraries, single/small-document Q&A, local dev workflows, and cross-language access via gRPC.

## Install

```sh
npm install vectra
```

Optional dependencies:

```sh
npm install @huggingface/transformers  # local embeddings (no API key)
npm install protobufjs                 # Protocol Buffer storage format
```

## Quick Start

### Path A: LocalIndex (items + metadata)

Use `LocalIndex` when you already have vectors and want to store items with metadata.

```ts
import path from 'node:path';
import { LocalIndex } from 'vectra';
import { OpenAI } from 'openai';

const index = new LocalIndex(path.join(process.cwd(), 'my-index'));

if (!(await index.isIndexCreated())) {
  await index.createIndex({
    version: 1,
    metadata_config: { indexed: ['category'] },
  });
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
async function getVector(text: string): Promise<number[]> {
  const resp = await openai.embeddings.create({ model: 'text-embedding-3-small', input: text });
  return resp.data[0].embedding;
}

await index.insertItem({
  vector: await getVector('apple'),
  metadata: { text: 'apple', category: 'food' },
});

const results = await index.queryItems(await getVector('banana'), '', 3, { category: { $eq: 'food' } });
for (const r of results) {
  console.log(r.score.toFixed(4), r.item.metadata.text);
}
```

### Path B: LocalDocumentIndex (documents + chunking + retrieval)

Use `LocalDocumentIndex` when you have raw text and want Vectra to handle chunking, embedding, and retrieval.

```ts
import path from 'node:path';
import { LocalDocumentIndex, OpenAIEmbeddings } from 'vectra';

const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'text-embedding-3-small',
  maxTokens: 8000,
});

const docs = new LocalDocumentIndex({
  folderPath: path.join(process.cwd(), 'my-doc-index'),
  embeddings,
});

if (!(await docs.isIndexCreated())) {
  await docs.createIndex({ version: 1 });
}

await docs.upsertDocument('doc://welcome', 'Vectra is a local vector database...', 'md');

const results = await docs.queryDocuments('What is Vectra?', { maxDocuments: 5, maxChunks: 20 });
if (results.length > 0) {
  const sections = await results[0].renderSections(2000, 1, true);
  for (const s of sections) {
    console.log(s.score.toFixed(4), s.text);
  }
}
```

### Running in the Browser

```ts
import { LocalDocumentIndex, LocalEmbeddings, IndexedDBStorage } from 'vectra';

const storage = new IndexedDBStorage('my-app-vectors');
const embeddings = new LocalEmbeddings(); // runs locally, no API key

const index = new LocalDocumentIndex({ folderPath: 'my-index', embeddings, storage });
```

See the [Storage guide](https://stevenic.github.io/vectra/storage#running-in-the-browser) for full browser setup details.

## Documentation

Full documentation is available at **[stevenic.github.io/vectra](https://stevenic.github.io/vectra/)**:

| Guide | Description |
|-------|-------------|
| [Getting Started](https://stevenic.github.io/vectra/getting-started) | Install, requirements, quick start with both index types |
| [Core Concepts](https://stevenic.github.io/vectra/core-concepts) | Index types, metadata filtering, hybrid retrieval, on-disk layout |
| [CLI Reference](https://stevenic.github.io/vectra/cli) | All CLI commands, flags, and embeddings provider config |
| [API Reference](https://stevenic.github.io/vectra/api-reference) | LocalIndex, LocalDocumentIndex, embeddings, FolderWatcher, utilities |
| [Best Practices](https://stevenic.github.io/vectra/best-practices) | Performance tuning, operational tips, troubleshooting |
| [Storage](https://stevenic.github.io/vectra/storage) | Pluggable backends, custom storage, browser/IndexedDB, serialization formats |
| [gRPC Server](https://stevenic.github.io/vectra/grpc) | Cross-language access, service API, language bindings |

## CLI Overview

```sh
npx vectra --help
```

| Command | Description |
|---------|-------------|
| `create` | Create a new index |
| `delete` | Delete an index |
| `add` | Add documents (URLs or files) |
| `remove` | Remove documents by URI |
| `query` | Query by text |
| `stats` | Print index statistics |
| `watch` | Watch folders and auto-sync changes |
| `migrate` | Migrate between JSON and protobuf formats |
| `serve` | Start the gRPC server |
| `stop` | Stop a running daemon |
| `generate` | Generate language bindings |

See the [CLI Reference](https://stevenic.github.io/vectra/cli) for full usage details.

## API Summary

Key exports from `vectra`:

| Export | Description |
|--------|-------------|
| `LocalIndex` | Item-level vector storage with metadata filtering |
| `LocalDocumentIndex` | Document ingestion, chunking, and retrieval |
| `OpenAIEmbeddings` | OpenAI / Azure / OSS embeddings |
| `LocalEmbeddings` | Local HuggingFace embeddings (no API key) |
| `LocalFileStorage` | Filesystem storage (Node.js, default) |
| `IndexedDBStorage` | IndexedDB storage (browsers) |
| `VirtualFileStorage` | In-memory storage (testing) |
| `JsonCodec` | JSON serialization (default) |
| `ProtobufCodec` | Protocol Buffer serialization |
| `migrateIndex` | Migrate between serialization formats |
| `FolderWatcher` | Watch folders and auto-sync to an index |
| `VectraServer` | gRPC server for cross-language access |
| `TextSplitter` | Configurable text chunking |
| `FileFetcher` | Local file ingestion |
| `WebFetcher` | Web page ingestion |

## License

MIT License. See [LICENSE](LICENSE).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. Please review our [Code of Conduct](CODE_OF_CONDUCT.md).
