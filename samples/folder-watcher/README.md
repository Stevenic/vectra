# Folder Watcher Sample

Keeps a Vectra index in sync with a directory of files. Demonstrates both the CLI zero-code path and the programmatic `FolderWatcher` API.

## Prerequisites

- Node.js 22.x or later
- An OpenAI API key (set as `OPENAI_API_KEY` environment variable)

```bash
npm install vectra
```

## Option 1: CLI (zero code)

```bash
# Create the index
npx vectra create ./my-index

# Watch a folder (Ctrl+C to stop)
npx vectra watch ./my-index --keys ./keys.json --uri ./docs
```

Watch multiple folders with file type filtering:

```bash
npx vectra watch ./my-index --keys ./keys.json \
  --uri ./docs \
  --uri ./notes \
  --extensions .md .txt
```

## Option 2: Library

```bash
npx tsx watcher.ts
```

The script watches `./docs` and `./notes` for `.md` and `.txt` files, automatically indexing changes. Press Ctrl+C to stop.

## Offline Mode

See [offline-watcher.ts](./offline-watcher.ts) for a version using `LocalEmbeddings` that requires no API key.

## Learn More

- [Folder Sync tutorial](https://stevenic.github.io/vectra/tutorials/folder-sync)
- [Document Indexing guide](https://stevenic.github.io/vectra/documents)
