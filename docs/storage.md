---
title: Storage
layout: default
nav_order: 9
---

# Storage
{: .no_toc }

Pluggable storage backends, custom implementations, and browser support.
{: .fs-6 .fw-300 }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Overview

Vectra separates **index logic** from **file I/O** through the `FileStorage` interface. Every index operation — reading vectors, writing metadata, listing files — goes through this abstraction. You can swap storage backends without changing any index code.

Vectra ships with three built-in implementations:

| Implementation | Environment | Persistence |
|---------------|-------------|-------------|
| `LocalFileStorage` | Node.js | Disk (filesystem) |
| `IndexedDBStorage` | Browser, Electron | IndexedDB |
| `VirtualFileStorage` | Any | In-memory (ephemeral) |

## FileStorage interface

All storage backends implement this interface:

```ts
import { FileStorage } from 'vectra';

interface FileStorage {
  createFile(filePath: string, content: Buffer | string): Promise<void>;
  createFolder(folderPath: string): Promise<void>;
  deleteFile(filePath: string): Promise<void>;
  deleteFolder(folderPath: string): Promise<void>;
  getDetails(fileOrFolderPath: string): Promise<FileDetails>;
  listFiles(folderPath: string, filter?: 'files' | 'folders' | 'all'): Promise<FileDetails[]>;
  pathExists(fileOrFolderPath: string): Promise<boolean>;
  readFile(filePath: string): Promise<Buffer>;
  upsertFile(filePath: string, content: Buffer | string): Promise<void>;
}

interface FileDetails {
  name: string;
  path: string;
  isFolder: boolean;
  fileType?: string;
}
```

Key behaviors:
- `createFile` throws if the file already exists; `upsertFile` creates or overwrites.
- `createFolder` creates parent directories recursively.
- `deleteFolder` removes the folder and all its contents.
- `listFiles` accepts an optional filter: `'files'`, `'folders'`, or `'all'` (default).

## Built-in implementations

### LocalFileStorage

The default for Node.js. Wraps `fs/promises` for direct filesystem access.

```ts
import { LocalIndex, LocalFileStorage } from 'vectra';

// Default — uses the index folder path directly
const index = new LocalIndex('./my-index');

// Explicit — pass a storage instance with a custom root
const storage = new LocalFileStorage('/data/vectra');
const index = new LocalIndex('./my-index', { storage });
```

### IndexedDBStorage

Browser-compatible persistent storage backed by IndexedDB. Works in any modern browser and Electron renderer processes.

```ts
import { LocalIndex, IndexedDBStorage } from 'vectra';

const storage = new IndexedDBStorage('my-app-db'); // database name (default: 'vectra-db')
const index = new LocalIndex('my-index', { storage });
```

IndexedDBStorage stores files and folders in two IndexedDB object stores, with parent-path indexes for efficient directory listing. Paths are normalized to forward slashes.

Additional methods:
- `close()` — close the database connection
- `destroy()` — delete the entire database and all stored data

### VirtualFileStorage

Fully in-memory storage. Works in Node.js and browsers. Useful for testing, CI, and ephemeral workflows where you don't need persistence.

```ts
import { LocalIndex, VirtualFileStorage } from 'vectra';

const storage = new VirtualFileStorage();
const index = new LocalIndex('test-index', { storage });
```

{: .warning }
All data is lost when the process exits. Use this for tests and short-lived demos, not production data.

## Custom implementations

You can implement the `FileStorage` interface to store index data anywhere — S3, SQLite, a remote API, etc.

```ts
import { FileStorage, FileDetails, LocalIndex } from 'vectra';

class S3Storage implements FileStorage {
  constructor(private bucket: string, private prefix: string) {}

  async createFile(filePath: string, content: Buffer | string): Promise<void> {
    // Upload to S3...
  }

  async createFolder(folderPath: string): Promise<void> {
    // S3 doesn't have real folders — create a marker object or no-op
  }

  async deleteFile(filePath: string): Promise<void> {
    // Delete from S3...
  }

  async deleteFolder(folderPath: string): Promise<void> {
    // List and delete all objects with the folder prefix...
  }

  async getDetails(fileOrFolderPath: string): Promise<FileDetails> {
    // HEAD the object and return metadata...
  }

  async listFiles(folderPath: string, filter?: 'files' | 'folders' | 'all'): Promise<FileDetails[]> {
    // List objects under the prefix...
  }

  async pathExists(fileOrFolderPath: string): Promise<boolean> {
    // Check if the S3 key exists...
  }

  async readFile(filePath: string): Promise<Buffer> {
    // Download from S3...
  }

  async upsertFile(filePath: string, content: Buffer | string): Promise<void> {
    // PUT to S3 (create or overwrite)...
  }
}

// Use it like any other storage backend
const storage = new S3Storage('my-bucket', 'vectra/');
const index = new LocalIndex('my-index', { storage });
```

{: .important }
Your implementation must match the behavioral contract: `createFile` must throw if the file exists, `createFolder` must be recursive, and `deleteFolder` must remove contents. See the built-in implementations for reference.

## Running in the browser

Vectra can run entirely in the browser or Electron — no Node.js required. Use `IndexedDBStorage` for persistence or `VirtualFileStorage` for ephemeral use.

### Setup

Import from `vectra/browser` (or just `vectra` — bundlers that support conditional exports will resolve automatically). This entry point excludes Node-specific modules (`LocalFileStorage`, `FileFetcher`, `WebFetcher`, `FolderWatcher`) and includes browser alternatives like `BrowserWebFetcher`.

If you accidentally import `LocalFileStorage` in a browser bundle, the stub throws a helpful error directing you to use `IndexedDBStorage` or `VirtualFileStorage` instead.

### Browser example with IndexedDB

```ts
import { LocalDocumentIndex, TransformersEmbeddings, IndexedDBStorage } from 'vectra/browser';

// Persistent browser storage via IndexedDB
const storage = new IndexedDBStorage('my-app-vectors');

// Local embeddings run entirely in the browser — no API key needed
const embeddings = await TransformersEmbeddings.create();

const index = new LocalDocumentIndex({
  folderPath: 'my-index',
  embeddings,
  storage,
});

if (!(await index.isIndexCreated())) {
  await index.createIndex({ version: 1 });
}

await index.upsertDocument('doc://notes', 'Your document text here...', 'txt');

const results = await index.queryDocuments('search query', {
  maxDocuments: 5,
  maxChunks: 10,
});
```

### What works in the browser

| Feature | Browser support |
|---------|----------------|
| LocalIndex | Yes (with IndexedDBStorage or VirtualFileStorage) |
| LocalDocumentIndex | Yes |
| LocalEmbeddings | Yes (uses @huggingface/transformers) |
| TransformersEmbeddings | Yes (async factory, GPU/WASM device options, quantization) |
| OpenAIEmbeddings | Yes (makes fetch requests to API) |
| Metadata filtering | Yes |
| VirtualFileStorage | Yes |
| IndexedDBStorage | Yes |
| BrowserWebFetcher | Yes (uses Fetch API + DOMParser) |
| LocalFileStorage | No (Node.js only) |
| FileFetcher | No (Node.js only) |
| WebFetcher | No (Node.js only — uses cheerio) |
| FolderWatcher | No (Node.js only — uses fs.watch) |
| CLI | No (Node.js only) |

### Cross-platform paths

Vectra includes a `pathUtils` module that normalizes paths across Node.js and browsers. All storage implementations use forward-slash separators internally, so paths like `my-index/items/abc.json` work consistently everywhere.

```ts
import { pathUtils } from 'vectra';

pathUtils.join('my-index', 'items', 'abc.json'); // 'my-index/items/abc.json'
pathUtils.basename('my-index/items/abc.json');    // 'abc.json'
pathUtils.dirname('my-index/items/abc.json');     // 'my-index/items'
```

## Storage formats

Vectra supports two serialization formats for index data. The storage format is independent of the storage backend — you can use protobuf with LocalFileStorage, IndexedDBStorage, or any custom implementation.

### JSON (default)

Human-readable, zero dependencies. Files use `.json` extension.

### Protocol Buffers

Compact binary format providing 40-50% smaller index files. Requires the optional `protobufjs` package. Files use `.pb` extension.

```sh
npm install protobufjs
```

```ts
import { LocalIndex, ProtobufCodec } from 'vectra';

const index = new LocalIndex('./my-index', { codec: new ProtobufCodec() });
```

### Migrating between formats

```sh
npx vectra migrate ./my-index --to protobuf
npx vectra migrate ./my-index --to json
```

```ts
import { migrateIndex } from 'vectra';

await migrateIndex('./my-index', { to: 'protobuf' });
```

See the [CLI Reference](/vectra/cli#migrate) for details.
