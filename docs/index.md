---
title: Home
layout: home
nav_order: 1
---

# Vectra

A local, file-backed vector database for Node.js.
{: .fs-6 .fw-300 }

[Get Started](/vectra/getting-started){: .btn .btn-primary .fs-5 .mb-4 .mb-md-0 .mr-2 }
[View on GitHub](https://github.com/Stevenic/vectra){: .btn .fs-5 .mb-4 .mb-md-0 }

---

Vectra works like a local [Pinecone](https://www.pinecone.io/) or [Qdrant](https://qdrant.tech/): each index is just a folder on disk with an `index.json` file containing vectors and metadata. Queries use MongoDB-style operators for filtering, then rank matches by cosine similarity. Because the entire index is loaded into memory, lookups are extremely fast.

## Features

- **Zero infrastructure** — everything lives in a local folder; no servers or managed services required.
- **Fast lookups** — sub-millisecond to low-millisecond latency for small/medium corpora.
- **Pinecone-style filtering** — familiar MongoDB query operators for metadata filtering.
- **Portable** — file-based, language-agnostic format; indexes can be read/written by any language.
- **CLI included** — manage indexes from the command line.

## Documentation

- [Getting Started](/vectra/getting-started) — install, quick start with both index types
- [Core Concepts](/vectra/core-concepts) — index types, metadata filtering, hybrid retrieval, on-disk layout
- [CLI Reference](/vectra/cli) — command-line usage and embeddings config
- [API Reference](/vectra/api-reference) — LocalIndex, LocalDocumentIndex, and utilities
- [Best Practices](/vectra/best-practices) — performance, limits, and troubleshooting
