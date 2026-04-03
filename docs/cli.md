---
title: CLI Reference
layout: default
nav_order: 4
---

# CLI Reference
{: .no_toc }

Manage indexes from the command line — no code required.
{: .fs-6 .fw-300 }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Usage

```sh
npx vectra <command> [options]

# or, after global install:
vectra <command> [options]
```

## Global options

All commands accept these options:

| Flag | Default | Description |
|------|---------|-------------|
| `--storage <local\|virtual>` | `local` | Storage backend to use |
| `--storage-root <path>` | -- | Root folder for local storage |

## Commands

### create

Create a new index folder.

```sh
npx vectra create ./my-doc-index
npx vectra create ./my-doc-index --format protobuf   # use Protocol Buffer format
```

### delete

Delete an existing index and all its data.

```sh
npx vectra delete ./my-doc-index
```

### add

Add documents to an index. Requires a `keys.json` file for your embeddings provider.

```sh
# Single URL
npx vectra add ./my-doc-index --keys ./keys.json --uri https://example.com/page

# Multiple URIs
npx vectra add ./my-doc-index --keys ./keys.json \
  --uri https://example.com/page1 \
  --uri https://example.com/page2 \
  --uri ./local-docs/guide.md

# From a list file (one URI per line)
npx vectra add ./my-doc-index --keys ./keys.json --list ./uris.txt
```

**Options:**

| Flag | Description |
|------|-------------|
| `--keys <path>` | Path to embeddings provider config (required) |
| `--uri <url>` | URL or local file path to add (repeatable) |
| `--list <path>` | File containing one URI per line |
| `--cookie <string>` | Auth/session cookies for web pages |
| `--chunk-size <n>` | Token count per chunk (default: 512) |

### query

Query an index by text.

```sh
# Basic query
npx vectra query ./my-doc-index "What is Vectra?" --keys ./keys.json
```

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `--keys <path>` | Embeddings provider config | (required) |
| `--document-count <n>` | Max documents to return | 5 |
| `--chunk-count <n>` | Max chunks to evaluate | 50 |
| `--section-count <n>` | Sections to render per document | 1 |
| `--tokens <n>` | Max tokens per rendered section | 2000 |
| `--format <type>` | Output format (`sections`) | sections |
| `--overlap <bool>` | Include overlapping context | false |
| `--bm25 <bool>` | Enable hybrid BM25 retrieval | false |

**Example with all options:**

```sh
npx vectra query ./my-doc-index "hybrid retrieval" \
  --keys ./keys.json \
  --document-count 3 \
  --chunk-count 50 \
  --section-count 1 \
  --tokens 1200 \
  --format sections \
  --overlap true \
  --bm25 true
```

### remove

Remove documents by URI.

```sh
# Single URI
npx vectra remove ./my-doc-index --uri https://example.com/page

# From a list file
npx vectra remove ./my-doc-index --list ./uris.txt
```

### stats

Print index statistics.

```sh
npx vectra stats ./my-doc-index
```

### watch

Watch folders for file changes and automatically sync them into an index. Performs an initial full sync, then monitors for real-time adds, updates, and deletes. Press Ctrl+C to stop.

```sh
# Watch a single folder
npx vectra watch ./my-doc-index --keys ./keys.json --uri ./docs

# Watch multiple paths with extension filtering
npx vectra watch ./my-doc-index --keys ./keys.json \
  --uri ./docs --uri ./notes \
  --extensions .txt .md .html

# Watch paths listed in a file (one per line)
npx vectra watch ./my-doc-index --keys ./keys.json --list ./watch-paths.txt

# Custom debounce interval and chunk size
npx vectra watch ./my-doc-index --keys ./keys.json --uri ./docs \
  --debounce 1000 --chunk-size 256
```

**Options:**

| Flag | Alias | Default | Description |
|------|-------|---------|-------------|
| `--keys <path>` | `-k` | — | Path to embeddings provider config (required) |
| `--uri <path>` | `-u` | — | Folder or file path to watch (repeatable) |
| `--list <path>` | `-l` | — | File containing one path per line |
| `--extensions <ext...>` | `-e` | all files | File extensions to include (e.g., `.txt .md .html`) |
| `--chunk-size <n>` | `-cs` | 512 | Token count per chunk |
| `--debounce <ms>` | — | 500 | Debounce interval in milliseconds |

{: .note }
The `FolderWatcher` class is also exported from the library for programmatic use. See the [API Reference](/vectra/api-reference) for details.

### migrate

Migrate an index between serialization formats.

```sh
npx vectra migrate ./my-doc-index --to protobuf
npx vectra migrate ./my-doc-index --to json
```

### serve

Start the gRPC server to expose index operations over the network. See the [gRPC Server](/vectra/grpc) guide for full details.

```sh
# Serve a single index
npx vectra serve ./my-doc-index --keys ./keys.json

# Serve all indexes under a root directory
npx vectra serve --root ./indexes --keys ./keys.json --port 50051

# Run as a background daemon
npx vectra serve ./my-doc-index --keys ./keys.json --daemon --pid-file ./vectra.pid
```

**Options:**

| Flag | Default | Description |
|------|---------|-------------|
| `--root <dir>` | -- | Directory containing multiple index subdirectories |
| `--port` | 50051 | Port to bind the gRPC server on |
| `--keys` | -- | Path to keys.json for server-side embeddings |
| `--daemon` | false | Fork to background as a daemon process |
| `--pid-file` | auto | Path to PID file (daemon mode) |

### stop

Stop a running Vectra daemon.

```sh
npx vectra stop --pid-file ./vectra.pid
```

### generate

Generate language bindings for the gRPC service. See [Language Bindings](/vectra/grpc#language-bindings) for details on each language.

```sh
npx vectra generate --language python --output ./bindings/python
npx vectra generate --language csharp --output ./bindings/csharp
```

Supported languages: `python`, `csharp`, `rust`, `go`, `java`, `typescript`.

### help

Show all available commands:

```sh
npx vectra --help
```

## Embeddings provider config (keys.json)

The `--keys` flag points to a JSON file with your embeddings provider credentials. Three providers are supported:

### OpenAI

```json
{
  "apiKey": "sk-...",
  "model": "text-embedding-3-small",
  "maxTokens": 8000
}
```

### Azure OpenAI

```json
{
  "azureApiKey": "xxxxx",
  "azureEndpoint": "https://your-resource-name.openai.azure.com",
  "azureDeployment": "your-embedding-deployment",
  "azureApiVersion": "2023-05-15",
  "maxTokens": 8000
}
```

### OpenAI-compatible OSS

```json
{
  "ossModel": "text-embedding-3-small",
  "ossEndpoint": "https://your-oss-endpoint.example.com",
  "maxTokens": 8000
}
```
