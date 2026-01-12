# Vectra

- One-line description
- Key features
  - Local, file-backed vector database for Node.js
  - In-memory search with cosine similarity
  - Metadata filtering (Pinecone-compatible Mongo-style operators)
  - Document indexing with chunking and optional hybrid BM25
  - Simple CLI and TypeScript API
- When to use Vectra (and when not)
  - Great for small, mostly static corpora; few-shot examples; single-doc QA
  - Not suited for long-term, ever-growing chat memory (index fully in memory)
  - Mimic namespaces by using separate folders (one index per folder)
- Language agnostic file format note (indices can be read/written by any language)

## Requirements

- Node.js >= 20.x
- NPM or Yarn
- An embeddings model/provider (OpenAI, Azure OpenAI, or OSS OpenAI-compatible)

## Installation

- npm install vectra
- Optional global CLI install or npx usage

## Quick Start (5 minutes)

### Choose your path

- Option A: Vector Item Index (LocalIndex) — store your own vectors + metadata; run similarity + metadata filters
- Option B: Document Index (LocalDocumentIndex) — chunk raw documents, store on disk, query via embeddings; render relevant sections

### A. LocalIndex (items + metadata)

- Steps
  1) Create an index folder and initialize
  2) Generate embeddings (any provider) and insert items with metadata
  3) Query by vector with optional metadata filter; get topK sorted by similarity
- Example (code)
  - Create index
  - Insert items with vector + metadata
  - Query with and without filter

### B. LocalDocumentIndex (documents + chunking + retrieval)

- Steps
  1) Configure embeddings via OpenAIEmbeddings (OpenAI, Azure OpenAI, or OSS)
  2) Create index and add documents (from strings, files, or web pages)
  3) Query documents and render top sections
- Example (code)
  - Initialize embeddings
  - Create index with chunking config
  - Upsert documents (uri, text, docType)
  - Query and render sections (with overlap option)

## CLI

- Installation
  - Global install or use npx
- keys.json formats
  - OpenAI (apiKey, model)
  - Azure OpenAI (azureApiKey, azureEndpoint, azureDeployment, optional api-version)
  - OSS (ossEndpoint, ossModel)
- Commands
  - vectra create <index>
  - vectra delete <index>
  - vectra add <index> --keys keys.json --uri <url-or-file> [--list file] [--cookie str] [--chunk-size N]
  - vectra remove <index> --uri <uri> [--list file]
  - vectra stats <index>
  - vectra query <index> "<query>" --keys keys.json [--document-count N] [--chunk-count N] [--section-count N] [--tokens N] [--format sections|stats|chunks] [--overlap] [--bm25]
- Usage examples
  - Create, add web pages, query, render sections

## Data Model & On-Disk Layout

- Index folder structure overview
  - index.json
  - Per-item or per-document files
- LocalIndex
  - Stored vectors
  - Indexed vs non-indexed metadata (metadata_config)
  - Unindexed metadata file-by-id
- LocalDocumentIndex
  - Document .txt and .json files
  - Chunk metadata (startPos, endPos, overlaps)
  - Catalog and index management

## Search & Filtering

- Similarity
  - Cosine similarity with pre-normalized vectors
- Metadata filters (Pinecone-compatible subset)
  - $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $and, $or
- Hybrid search (BM25) for documents
  - Optional keyword scoring and combination with semantic matches
- Result rendering
  - Render sections with token limits and optional overlap
  - Sorting by score; multiple sections per document

## API Overview

- Core exports
  - LocalIndex
    - createIndex, isIndexCreated, getIndexStats
    - insertItem, batchInsertItems, deleteItem, listItems, listItemsByMetadata, getItem
    - queryItems(vector, topK, filter?)
    - beginUpdate/endUpdate (batched changes)
  - LocalDocumentIndex
    - createIndex/deleteIndex/getCatalogStats
    - upsertDocument(uri, text, docType?)
    - deleteDocument(uri)
    - queryDocuments(query, { maxDocuments, maxChunks, isBm25 })
  - LocalDocumentResult
    - chunks, score
    - loadText, loadMetadata
    - renderSections(maxTokens, maxSections, overlap?)
    - renderAllSections(maxTokens)
  - OpenAIEmbeddings (OpenAI, Azure OpenAI, OSS)
  - TextSplitter, FileFetcher, WebFetcher
  - Tokenizer utilities (GPT3Tokenizer)
  - ItemSelector (cosine similarity, metadata selection)
- Types summary (high level)
  - IndexItem, MetadataFilter, Embeddings options

## Performance & Limits

- Entire index loaded in memory for ultra-fast filtering + scoring
- Typical latency expectations for small to medium corpora
- Guidance on index size and memory footprint

## Best Practices

- Use separate folders to mimic namespaces
- Index only metadata fields you need for filtering
- Batch inserts and use beginUpdate/endUpdate for bulk changes
- Choose appropriate chunk size/overlap for documents

## Troubleshooting

- Common issues (missing keys.json, invalid endpoint, file permissions)
- Rate limiting and retry behavior
- Index corruption or partial updates (how to recreate)

## Contributing

- How to build, test, and lint
  - yarn install, yarn build, yarn test, yarn lint
- Open issues and PR guidelines
- Code of Conduct
- Link to CONTRIBUTING.md

## License

- MIT License

## Acknowledgements

- Inspiration from Pinecone and Qdrant
- Libraries used in this repo