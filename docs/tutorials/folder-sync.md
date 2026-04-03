---
title: Auto-Sync a Folder
layout: default
parent: Tutorials
nav_order: 5
---

# Auto-Sync a Folder
{: .no_toc }

Keep a Vectra index in sync with a directory of files using FolderWatcher and the CLI.
{: .fs-6 .fw-300 }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## What you'll build

An auto-syncing workflow where:

1. Vectra watches one or more directories for file changes
2. New files are automatically ingested and chunked
3. Modified files are re-indexed
4. Deleted files are removed from the index
5. The index stays up to date in real time

You can do this two ways: **CLI** (zero code) or **library** (programmatic control).

## Prerequisites

- Node.js 22.x or newer
- An embeddings provider configured
- A folder of text, markdown, or code files to watch

```sh
npm install vectra
```

## Option A: CLI (zero code)

The `vectra watch` command handles everything — initial sync, real-time monitoring, and cleanup.

### Basic usage

```sh
# Create the index
npx vectra create ./my-index

# Watch a folder (Ctrl+C to stop)
npx vectra watch ./my-index --keys ./keys.json --uri ./docs
```

On startup, `watch` performs a full sync — indexing every matching file. Then it monitors for changes in real time.

### Watch multiple folders with extension filtering

```sh
npx vectra watch ./my-index --keys ./keys.json \
  --uri ./docs \
  --uri ./notes \
  --uri ./src \
  --extensions .md .txt .py .ts
```

### Watch paths from a file

```sh
# watch-paths.txt — one path per line:
# ./docs
# ./notes
# /absolute/path/to/more-docs

npx vectra watch ./my-index --keys ./keys.json --list ./watch-paths.txt
```

### CLI options

| Flag | Default | Description |
|------|---------|-------------|
| `--keys <path>` | — | Embeddings provider config (required) |
| `--uri <path>` | — | Folder or file to watch (repeatable) |
| `--list <path>` | — | File containing paths, one per line |
| `--extensions <ext...>` | all files | File extensions to include (e.g., `.md .txt`) |
| `--chunk-size <n>` | 512 | Token count per chunk |
| `--debounce <ms>` | 500 | Debounce interval for rapid changes |

## Option B: Library (programmatic)

Use `FolderWatcher` for full control over events, error handling, and integration with your application.

### Basic setup

```ts
import path from 'node:path';
import { LocalDocumentIndex, OpenAIEmbeddings, FolderWatcher } from 'vectra';

// Create the index
const docs = new LocalDocumentIndex({
  folderPath: path.join(process.cwd(), 'my-index'),
  embeddings: new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'text-embedding-3-small',
    maxTokens: 8000,
  }),
});

if (!(await docs.isIndexCreated())) {
  await docs.createIndex({ version: 1 });
}

// Watch for changes
const watcher = new FolderWatcher({
  index: docs,
  paths: ['./docs', './notes'],
  extensions: ['.md', '.txt'],
  debounceMs: 500,
});

// Listen to events
watcher.on('sync', (uri, action) => {
  console.log(`${action}: ${uri}`);
});

watcher.on('error', (err, uri) => {
  console.error(`Error processing ${uri}:`, err.message);
});

watcher.on('ready', () => {
  console.log('Initial sync complete. Watching for changes...');
});

// Start watching
await watcher.start();

// Stop when done (e.g., on process exit)
process.on('SIGINT', async () => {
  console.log('Stopping watcher...');
  await watcher.stop();
  process.exit(0);
});
```

### Constructor options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `index` | `LocalDocumentIndex` | — | The index to sync into (required) |
| `paths` | `string[]` | — | Folders or files to watch (required) |
| `extensions` | `string[]?` | all files | File extensions to include |
| `debounceMs` | `number?` | `500` | Debounce interval in milliseconds |

### Events

| Event | Callback signature | When |
|-------|-------------------|------|
| `'sync'` | `(uri: string, action: 'add' \| 'update' \| 'delete') => void` | A file was synced |
| `'error'` | `(error: Error, uri?: string) => void` | An error occurred during sync |
| `'ready'` | `() => void` | Initial sync is complete |

### How it works

1. **Initial sync** — on `start()`, FolderWatcher scans all paths recursively, compares against the index catalog, and ingests/updates/deletes as needed
2. **Real-time monitoring** — uses `fs.watch()` to detect file changes
3. **Debouncing** — rapid changes (e.g., saving a file multiple times) are debounced to avoid redundant re-indexing
4. **Graceful stop** — `stop()` closes file watchers and finishes any in-flight sync operations

## Example: Knowledge base with logging

A more complete example that tracks sync progress and handles errors:

```ts
import path from 'node:path';
import { LocalDocumentIndex, LocalEmbeddings, FolderWatcher } from 'vectra';

const docs = new LocalDocumentIndex({
  folderPath: path.join(process.cwd(), 'knowledge-base'),
  embeddings: new LocalEmbeddings(), // no API key needed
  chunkingConfig: {
    chunkSize: 256,
    chunkOverlap: 50,
    keepSeparators: true,
  },
});

if (!(await docs.isIndexCreated())) {
  await docs.createIndex({ version: 1 });
}

let syncCount = 0;

const watcher = new FolderWatcher({
  index: docs,
  paths: ['./wiki', './team-docs'],
  extensions: ['.md', '.txt', '.html'],
  debounceMs: 1000, // longer debounce for busy directories
});

watcher.on('sync', (uri, action) => {
  syncCount++;
  const timestamp = new Date().toISOString().slice(11, 19);
  console.log(`[${timestamp}] ${action.toUpperCase().padEnd(6)} ${uri} (total: ${syncCount})`);
});

watcher.on('error', (err, uri) => {
  console.error(`[ERROR] ${uri || 'unknown'}: ${err.message}`);
});

watcher.on('ready', async () => {
  const stats = await docs.getCatalogStats();
  console.log(`Ready. ${stats.documentCount} documents indexed. Watching for changes...`);
});

await watcher.start();
```

## Tips

### Extension filtering

Choose extensions carefully to avoid indexing binary files or build artifacts:

```ts
// Good — explicit whitelist
extensions: ['.md', '.txt', '.rst', '.html']

// Also good — code files
extensions: ['.ts', '.js', '.py', '.go', '.rs']
```

Without an `extensions` filter, FolderWatcher processes all files it finds.

### Debounce tuning

- **500 ms** (default) — good for interactive editing
- **1000-2000 ms** — better for directories with automated writes (CI, build tools)
- **100-200 ms** — for near-real-time sync when changes are infrequent

### Local embeddings for offline sync

Pair `FolderWatcher` with `LocalEmbeddings` for a fully offline pipeline — no API key, no network calls:

```ts
import { LocalEmbeddings, LocalDocumentIndex, FolderWatcher } from 'vectra';

const docs = new LocalDocumentIndex({
  folderPath: './offline-index',
  embeddings: new LocalEmbeddings(),
});
```

## Next steps

- **Query the synced index** — see the [RAG Pipeline tutorial](/vectra/tutorials/rag-pipeline) for querying and rendering sections.
- **Hybrid retrieval** — enable `isBm25: true` to add keyword matching. See [Document Indexing](/vectra/documents#hybrid-retrieval-bm25).
- **Protocol Buffers** — use `ProtobufCodec` for 40-50% smaller index files. See [Storage Formats](/vectra/storage#storage-formats).
- **Custom chunking** — tune `chunkSize` and `chunkOverlap` for your content type. See [Chunking](/vectra/documents#chunking).
