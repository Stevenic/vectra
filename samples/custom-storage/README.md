# Custom Storage Sample

Implements the `FileStorage` interface using SQLite (via `better-sqlite3`) as the backing store. Demonstrates how to swap out Vectra's default file-based storage for a custom backend.

## Prerequisites

- Node.js 22.x or later
- An OpenAI API key (set as `OPENAI_API_KEY` environment variable)

```bash
npm install vectra openai better-sqlite3
npm install -D @types/better-sqlite3
```

## Usage

```bash
npx tsx usage.ts
```

This creates a `my-index.db` SQLite file containing the entire index. You can inspect it with any SQLite tool:

```bash
sqlite3 my-index.db "SELECT path, length(content), is_folder FROM files;"
```

## Run Tests

```bash
npx tsx test.ts
```

Uses an in-memory SQLite database to verify all `FileStorage` operations.

## When to Use SQLite Storage

| Consideration | File-based (default) | SQLite |
|---------------|---------------------|--------|
| Single-file portability | No (directory tree) | Yes (one `.db` file) |
| Concurrent readers | OS-dependent | Built-in WAL mode |
| SQL queryability | No | Yes |
| Setup complexity | Zero | Requires `better-sqlite3` |

## Learn More

- [Custom Storage tutorial](https://stevenic.github.io/vectra/tutorials/custom-storage)
- [Storage guide](https://stevenic.github.io/vectra/storage)
