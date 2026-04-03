---
title: Home
layout: home
nav_order: 1
---

# Vectra
{: .no_toc }

A local, file-backed vector database with cross-language gRPC access.
{: .fs-6 .fw-300 }

[Get Started](/vectra/getting-started){: .btn .btn-primary .fs-5 .mb-4 .mb-md-0 .mr-2 }
[View on GitHub](https://github.com/Stevenic/vectra){: .btn .fs-5 .mb-4 .mb-md-0 }

---

Vectra works like a local [Pinecone](https://www.pinecone.io/) or [Qdrant](https://qdrant.tech/): each index is a folder on disk, loaded into memory for fast queries. Filter by metadata using MongoDB-style operators, rank by cosine similarity, and get results in under a millisecond for small indexes.

## Key capabilities

| | |
|---|---|
| **Zero infrastructure** | Everything lives in a local folder — no servers or managed services |
| **Fast lookups** | Sub-millisecond to low-millisecond latency |
| **Pinecone-style filtering** | MongoDB query operators for metadata filtering |
| **Multiple embeddings** | OpenAI, Azure, OSS endpoints, or local HuggingFace models (no API key) |
| **Pluggable storage** | Filesystem, IndexedDB (browsers), in-memory, or custom backends |
| **Browser & Electron** | Dedicated `vectra/browser` entry point with local embeddings and IndexedDB |
| **CLI included** | Manage indexes, serve gRPC, watch folders from the terminal |
| **Cross-language** | Built-in gRPC server with bindings for Python, C#, Rust, Go, Java, TypeScript |
| **Flexible format** | JSON (human-readable) or Protocol Buffers (40-50% smaller) |

## Choose your path

| I want to... | Start here |
|--------------|------------|
| Store **items with vectors** I generate myself | [Getting Started — LocalIndex](/vectra/getting-started#path-a-localindex-items--metadata) |
| Ingest **raw text** and let Vectra chunk + embed | [Getting Started — LocalDocumentIndex](/vectra/getting-started#path-b-localdocumentindex-documents--chunking--retrieval) |
| Run in a **browser or Electron** | [Storage — Running in the Browser](/vectra/storage#running-in-the-browser) |
| Access Vectra from **Python, C#, Rust, etc.** | [gRPC Server](/vectra/grpc) |
| Use the **CLI** without writing code | [CLI Reference](/vectra/cli) |

## What's New in v0.14.x

- **Browser & Electron support** — `vectra/browser` entry point with `IndexedDBStorage` and `TransformersEmbeddings`
- **Local embeddings** — `LocalEmbeddings` and `TransformersEmbeddings` run HuggingFace models with no API key
- **Protocol Buffers** — opt-in binary format, 40-50% smaller files
- **gRPC server** — `vectra serve` exposes 19 RPCs for cross-language access
- **FolderWatcher** — auto-sync directories into a document index
- **Language bindings** — `vectra generate` scaffolds clients for 6 languages

See the [Changelog](/vectra/changelog) for breaking changes and migration details.

## Documentation

| Guide | Description |
|-------|-------------|
| [Getting Started](/vectra/getting-started) | Install, requirements, quick start with both index types |
| [Core Concepts](/vectra/core-concepts) | Index types, metadata filtering, on-disk layout, storage backends |
| [Embeddings Guide](/vectra/embeddings) | Choose and configure an embeddings provider |
| [Document Indexing](/vectra/documents) | Chunking, retrieval, hybrid search, FolderWatcher |
| [CLI Reference](/vectra/cli) | All CLI commands, flags, and embeddings provider config |
| [API Reference](/vectra/api-reference) | TypeScript API overview with links to typedoc |
| [Best Practices](/vectra/best-practices) | Performance tuning, operational tips, troubleshooting |
| [Storage](/vectra/storage) | Pluggable backends, custom storage, browser/IndexedDB, formats |
| [gRPC Server](/vectra/grpc) | Cross-language access, service API, language bindings |
| [Changelog](/vectra/changelog) | Breaking changes, migration guides, version compatibility |
| [Tutorials](/vectra/tutorials/) | End-to-end walkthroughs: RAG pipeline, browser app, gRPC, custom storage, folder sync |
