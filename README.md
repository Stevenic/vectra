# Vectra: a local vector database

[![npm version](https://img.shields.io/npm/v/vectra.svg)](https://www.npmjs.com/package/vectra)
[![Build](https://github.com/Stevenic/vectra/actions/workflows/ci.yml/badge.svg)](https://github.com/Stevenic/vectra/actions/workflows/ci.yml)
[![Coverage Status](https://coveralls.io/repos/github/Stevenic/vectra/badge.svg?branch=main)](https://coveralls.io/github/Stevenic/vectra?branch=main)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Agent Ready](https://img.shields.io/badge/Agent-Ready-blue.svg)](#agent-ready)

Vectra is a local, file-backed, in-memory vector database with an optional gRPC server for cross-language access. Each index is a folder on disk — queries use MongoDB-style metadata filtering and cosine similarity ranking, with sub-millisecond latency for small indexes.

## What's New in Vectra 0.14

- **Browser & Electron support** — `vectra/browser` entry point with `IndexedDBStorage` and `TransformersEmbeddings`
- **Local embeddings** — `LocalEmbeddings` and `TransformersEmbeddings` run HuggingFace models with no API key
- **Protocol Buffers** — opt-in binary format, 40-50% smaller files
- **gRPC server** — `vectra serve` exposes 19 RPCs for cross-language access
- **FolderWatcher** — auto-sync directories into a document index
- **Language bindings** — `vectra generate` scaffolds clients for 6 languages

See the [Changelog](https://stevenic.github.io/vectra/changelog) for breaking changes and migration details.

## Install

```sh
npm install vectra
```

## Quick Example

```ts
import { LocalDocumentIndex, OpenAIEmbeddings } from 'vectra';

const docs = new LocalDocumentIndex({
  folderPath: './my-index',
  embeddings: new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'text-embedding-3-small',
    maxTokens: 8000,
  }),
});

if (!(await docs.isIndexCreated())) {
  await docs.createIndex({ version: 1 });
}

await docs.upsertDocument('doc://readme', 'Vectra is a local vector database...', 'md');

const results = await docs.queryDocuments('What is Vectra?', { maxDocuments: 5 });
if (results.length > 0) {
  const sections = await results[0].renderSections(2000, 1, true);
  console.log(sections[0].text);
}
```

## Documentation

Full docs at **[stevenic.github.io/vectra](https://stevenic.github.io/vectra/)**:

| Guide | Description |
|-------|-------------|
| [Getting Started](https://stevenic.github.io/vectra/getting-started) | Install, requirements, quick start with both index types |
| [Core Concepts](https://stevenic.github.io/vectra/core-concepts) | Index types, metadata filtering, on-disk layout |
| [Embeddings Guide](https://stevenic.github.io/vectra/embeddings) | Choose and configure an embeddings provider |
| [Document Indexing](https://stevenic.github.io/vectra/documents) | Chunking, retrieval, hybrid search, FolderWatcher |
| [CLI Reference](https://stevenic.github.io/vectra/cli) | All CLI commands, flags, and provider config |
| [API Reference](https://stevenic.github.io/vectra/api-reference) | TypeScript API overview |
| [Best Practices](https://stevenic.github.io/vectra/best-practices) | Performance tuning, troubleshooting |
| [Storage](https://stevenic.github.io/vectra/storage) | Pluggable backends, browser/IndexedDB, serialization formats |
| [gRPC Server](https://stevenic.github.io/vectra/grpc) | Cross-language access and language bindings |
| [Changelog](https://stevenic.github.io/vectra/changelog) | Breaking changes and migration guides |
| [Tutorials](https://stevenic.github.io/vectra/tutorials/) | RAG pipeline, browser app, gRPC, custom storage, folder sync |
| [Samples](./samples/) | Runnable examples: quickstart, RAG, browser, SQLite storage, gRPC, folder watcher |

## Agent Ready

Vectra ships an [`llms.txt`](https://github.com/Stevenic/vectra/blob/main/llms.txt) file that gives coding agents everything they need to integrate Vectra into your project. Point your agent at it and let it do the work:

```
Read the llms.txt file at https://raw.githubusercontent.com/Stevenic/vectra/main/llms.txt
and then add Vectra support to this project. Use LocalDocumentIndex for document
storage and retrieval.
```

The `llms.txt` file covers all exports, index types, CLI commands, gRPC bindings, and on-disk format — enough for any coding agent to scaffold a working integration without browsing docs.

## License

MIT License. See [LICENSE](LICENSE).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. Please review our [Code of Conduct](CODE_OF_CONDUCT.md).
