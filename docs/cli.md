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

## Commands

### create

Create a new index folder.

```sh
npx vectra create ./my-doc-index
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
