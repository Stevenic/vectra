---
title: Custom Storage Provider
layout: default
parent: Tutorials
nav_order: 2
---

# Custom Storage Provider (SQLite)
{: .no_toc }

Implement the `FileStorage` interface with SQLite as the backing store.
{: .fs-6 .fw-300 }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## What you'll build

A custom `FileStorage` implementation that stores all Vectra index data in a single SQLite database file. This gives you:

- **Single-file portability** — one `.db` file instead of a folder of JSON/protobuf files
- **Concurrent readers** — SQLite supports multiple simultaneous readers
- **SQL queryability** — inspect index data with standard SQL tools

## Prerequisites

- Node.js 22.x or newer
- An embeddings provider configured (any — OpenAI, local, etc.)

```sh
npm install vectra better-sqlite3
npm install -D @types/better-sqlite3
```

## The FileStorage interface

Every Vectra storage backend implements these 9 methods:

```ts
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
```

Key behavioral contracts:
- `createFile` must throw if the file already exists
- `createFolder` must create parent directories recursively
- `deleteFolder` must remove the folder and all its contents
- `upsertFile` creates or overwrites

## Step 1: Design the schema

We need two tables — one for files, one for folders:

```ts
import Database from 'better-sqlite3';

function initDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL'); // better concurrent read performance

  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      path TEXT PRIMARY KEY,
      content BLOB NOT NULL,
      is_folder INTEGER NOT NULL DEFAULT 0
    );
  `);

  return db;
}
```

We store folders as rows with `is_folder = 1` and empty content. Files have `is_folder = 0` and their content as a BLOB (supports both JSON text and protobuf binary).

## Step 2: Implement the class

```ts
import { FileStorage, FileDetails } from 'vectra';
import Database from 'better-sqlite3';
import { pathUtils } from 'vectra';

export class SQLiteStorage implements FileStorage {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = initDatabase(dbPath);
  }

  async createFile(filePath: string, content: Buffer | string): Promise<void> {
    const normalized = pathUtils.normalize(filePath);
    const existing = this.db.prepare('SELECT 1 FROM files WHERE path = ? AND is_folder = 0').get(normalized);
    if (existing) {
      throw new Error(`File already exists: ${filePath}`);
    }
    const buf = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
    this.db.prepare('INSERT INTO files (path, content, is_folder) VALUES (?, ?, 0)').run(normalized, buf);
  }

  async createFolder(folderPath: string): Promise<void> {
    const normalized = pathUtils.normalize(folderPath);
    // Create parent directories recursively
    const parts = normalized.split('/');
    let current = '';
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      this.db.prepare(
        'INSERT OR IGNORE INTO files (path, content, is_folder) VALUES (?, ?, 1)'
      ).run(current, Buffer.alloc(0));
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    const normalized = pathUtils.normalize(filePath);
    this.db.prepare('DELETE FROM files WHERE path = ? AND is_folder = 0').run(normalized);
  }

  async deleteFolder(folderPath: string): Promise<void> {
    const normalized = pathUtils.normalize(folderPath);
    // Delete the folder and everything under it
    this.db.prepare("DELETE FROM files WHERE path = ? OR path LIKE ?").run(
      normalized,
      `${normalized}/%`
    );
  }

  async getDetails(fileOrFolderPath: string): Promise<FileDetails> {
    const normalized = pathUtils.normalize(fileOrFolderPath);
    const row = this.db.prepare('SELECT path, is_folder FROM files WHERE path = ?').get(normalized) as
      | { path: string; is_folder: number }
      | undefined;

    if (!row) {
      throw new Error(`Not found: ${fileOrFolderPath}`);
    }

    return {
      name: pathUtils.basename(row.path),
      path: row.path,
      isFolder: row.is_folder === 1,
      fileType: row.is_folder === 0 ? pathUtils.basename(row.path).split('.').pop() : undefined,
    };
  }

  async listFiles(folderPath: string, filter?: 'files' | 'folders' | 'all'): Promise<FileDetails[]> {
    const normalized = pathUtils.normalize(folderPath);
    const prefix = normalized ? `${normalized}/` : '';

    // List direct children only (no nested paths)
    const rows = this.db
      .prepare("SELECT path, is_folder FROM files WHERE path LIKE ? AND path NOT LIKE ?")
      .all(`${prefix}%`, `${prefix}%/%`) as Array<{ path: string; is_folder: number }>;

    return rows
      .filter((row) => {
        if (filter === 'files') return row.is_folder === 0;
        if (filter === 'folders') return row.is_folder === 1;
        return true;
      })
      .map((row) => ({
        name: pathUtils.basename(row.path),
        path: row.path,
        isFolder: row.is_folder === 1,
        fileType: row.is_folder === 0 ? pathUtils.basename(row.path).split('.').pop() : undefined,
      }));
  }

  async pathExists(fileOrFolderPath: string): Promise<boolean> {
    const normalized = pathUtils.normalize(fileOrFolderPath);
    const row = this.db.prepare('SELECT 1 FROM files WHERE path = ?').get(normalized);
    return row !== undefined;
  }

  async readFile(filePath: string): Promise<Buffer> {
    const normalized = pathUtils.normalize(filePath);
    const row = this.db.prepare('SELECT content FROM files WHERE path = ? AND is_folder = 0').get(normalized) as
      | { content: Buffer }
      | undefined;

    if (!row) {
      throw new Error(`File not found: ${filePath}`);
    }
    return Buffer.from(row.content);
  }

  async upsertFile(filePath: string, content: Buffer | string): Promise<void> {
    const normalized = pathUtils.normalize(filePath);
    const buf = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
    this.db.prepare(
      'INSERT INTO files (path, content, is_folder) VALUES (?, ?, 0) ON CONFLICT(path) DO UPDATE SET content = excluded.content'
    ).run(normalized, buf);
  }

  /** Close the database connection when done. */
  close(): void {
    this.db.close();
  }
}
```

## Step 3: Use it with Vectra

Plug the custom storage into any Vectra index — no other code changes needed:

```ts
import { LocalDocumentIndex, OpenAIEmbeddings } from 'vectra';
import { SQLiteStorage } from './sqlite-storage';

const storage = new SQLiteStorage('./my-index.db');

const docs = new LocalDocumentIndex({
  folderPath: 'my-index', // logical path inside the database
  embeddings: new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'text-embedding-3-small',
    maxTokens: 8000,
  }),
  storage,
});

if (!(await docs.isIndexCreated())) {
  await docs.createIndex({ version: 1 });
}

await docs.upsertDocument('doc://hello', 'Hello from SQLite storage!', 'txt');

const results = await docs.queryDocuments('hello', { maxDocuments: 5 });
console.log('Results:', results.length);

// Inspect with any SQLite tool:
// sqlite3 my-index.db "SELECT path, length(content), is_folder FROM files;"
```

{: .note }
The `folderPath` becomes a logical prefix inside the database, not an actual filesystem path. Multiple indexes can coexist in one database by using different `folderPath` values.

## Step 4: Test your implementation

A quick smoke test that exercises all the key operations:

```ts
import { SQLiteStorage } from './sqlite-storage';

const storage = new SQLiteStorage(':memory:'); // in-memory for tests

// Folders
await storage.createFolder('test/sub');
console.assert(await storage.pathExists('test'), 'folder should exist');
console.assert(await storage.pathExists('test/sub'), 'subfolder should exist');

// Files
await storage.createFile('test/a.json', '{"hello": "world"}');
console.assert(await storage.pathExists('test/a.json'), 'file should exist');

// Read back
const content = await storage.readFile('test/a.json');
console.assert(content.toString() === '{"hello": "world"}', 'content should match');

// Upsert (overwrite)
await storage.upsertFile('test/a.json', '{"hello": "updated"}');
const updated = await storage.readFile('test/a.json');
console.assert(updated.toString() === '{"hello": "updated"}', 'upsert should overwrite');

// createFile should throw on existing file
try {
  await storage.createFile('test/a.json', 'duplicate');
  console.assert(false, 'should have thrown');
} catch {
  // expected
}

// List files
const files = await storage.listFiles('test', 'files');
console.assert(files.length === 1, 'should list one file');
console.assert(files[0].name === 'a.json', 'file name should match');

// Delete
await storage.deleteFile('test/a.json');
console.assert(!(await storage.pathExists('test/a.json')), 'file should be deleted');

// Delete folder recursively
await storage.createFile('test/sub/b.json', 'data');
await storage.deleteFolder('test');
console.assert(!(await storage.pathExists('test')), 'folder should be deleted');
console.assert(!(await storage.pathExists('test/sub/b.json')), 'nested file should be deleted');

console.log('All tests passed.');
```

## When to choose SQLite

| Scenario | SQLite | LocalFileStorage |
|----------|--------|------------------|
| Single-file backup/transfer | Best — one `.db` file | Requires zipping a folder |
| Concurrent readers | Good — WAL mode | Good — OS-level file locks |
| Inspecting data | SQL queries | Manual JSON/protobuf parsing |
| Maximum I/O performance | Good | Best (direct fs) |
| Browser/Electron | Not available | Use `IndexedDBStorage` instead |

## Next steps

- **Protocol Buffers** — `SQLiteStorage` handles binary content natively, so `ProtobufCodec` works out of the box. Pass `codec: new ProtobufCodec()` to the index constructor.
- **Connection pooling** — for server scenarios, consider pooling `better-sqlite3` connections or using a single shared instance.
- See the [Storage](/vectra/storage) guide for the full `FileStorage` contract and the built-in implementations.
