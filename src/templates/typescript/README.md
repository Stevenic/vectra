# Vectra TypeScript gRPC Client

A typed client wrapper for communicating with a running `vectra serve` instance over gRPC.

## Prerequisites

- Node.js 18+
- A running Vectra gRPC server (`npx vectra serve <index>`)

## Setup

Install the required gRPC packages:

```bash
npm install @grpc/grpc-js @grpc/proto-loader
```

No separate code generation step is needed — the proto file is loaded dynamically at runtime via `@grpc/proto-loader`.

## Usage

```typescript
import { VectraClient } from './VectraClient';

const client = new VectraClient(); // localhost:50051

// Check server health
const health = await client.healthcheck();
console.log(health.status, health.loadedIndexes);

// Query documents
const results = await client.queryDocuments('my-index', 'what is vector search?', {
    maxDocuments: 5,
});
for (const doc of results) {
    console.log(`${doc.uri} (score: ${doc.score})`);
    for (const chunk of doc.chunks) {
        console.log(`  ${chunk.text}`);
    }
}

// Insert an item with metadata
const id = await client.insertItem('my-index', {
    text: 'hello world',
    metadata: { source: 'example', priority: 1, active: true },
});

// Query items with filter
const items = await client.queryItems('my-index', {
    text: 'hello',
    topK: 5,
    filter: { source: 'example' },
});

// Clean up
client.close();
```

## API

The `VectraClient` class provides typed methods for all 18 Vectra gRPC RPCs:

### Index Management
- `createIndex(name, options?)` — Create a new index
- `deleteIndex(name)` — Delete an index
- `listIndexes()` — List all loaded indexes

### Item Operations
- `insertItem(index, options)` — Insert a new item
- `upsertItem(index, id, options)` — Insert or update an item
- `getItem(index, id)` — Get an item by ID
- `deleteItem(index, id)` — Delete an item
- `listItems(index, filter?)` — List items with optional filter

### Query
- `queryItems(index, options)` — Query by text or vector
- `queryDocuments(index, query, options?)` — Query documents with semantic + optional BM25

### Document Operations
- `upsertDocument(index, uri, text, options?)` — Insert or update a document
- `deleteDocument(index, uri)` — Delete a document
- `listDocuments(index)` — List all documents

### Stats
- `getIndexStats(index)` — Get index statistics
- `getCatalogStats(index)` — Get document catalog statistics

### Lifecycle
- `healthcheck()` — Check server health
- `shutdown()` — Shut down the server

## Custom Connection

```typescript
const client = new VectraClient('192.168.1.100', 9090);
```
