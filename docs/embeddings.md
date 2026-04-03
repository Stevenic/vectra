---
title: Embeddings Guide
layout: default
nav_order: 4
---

# Embeddings Guide
{: .no_toc }

Choose and configure an embeddings provider for similarity search.
{: .fs-6 .fw-300 }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Overview

Vectra needs an embeddings provider to convert text into vectors for similarity search. You choose a provider when creating an index (for `LocalDocumentIndex`) or when generating vectors yourself (for `LocalIndex`).

Vectra ships with four built-in providers:

| Provider | API Key | Environment | Dimensions | Install |
|----------|---------|-------------|------------|---------|
| `OpenAIEmbeddings` | Required | Node.js, Browser | Model-dependent (e.g., 1536 or 3072) | Included |
| `OpenAIEmbeddings` (Azure) | Required | Node.js, Browser | Same as OpenAI | Included |
| `LocalEmbeddings` | None | Node.js, Browser | 384 (default model) | `@huggingface/transformers` |
| `TransformersEmbeddings` | None | Node.js, Browser, Electron | 384 (default model) | `@huggingface/transformers` |

All providers implement the `EmbeddingsModel` interface:

```ts
interface EmbeddingsModel {
  maxTokens: number;
  createEmbeddings(inputs: string | string[]): Promise<EmbeddingsResponse>;
}
```

## Choosing a provider

### When to use OpenAIEmbeddings

- You need **high-quality embeddings** from large models (e.g., `text-embedding-3-large` at 3072 dimensions)
- You're already using the OpenAI or Azure OpenAI platform
- Latency of a network round-trip is acceptable
- You want to use a **custom dimensions** parameter to trade quality for size

### When to use LocalEmbeddings

- You want **zero network calls** and no API key
- You need a simple, synchronous-feeling API (pipeline initializes lazily on first call)
- Node.js or browser — works in both
- Default model: `Xenova/all-MiniLM-L6-v2` (384 dimensions, 256 max tokens)

### When to use TransformersEmbeddings

- You want the same **local, no-API-key** benefits as `LocalEmbeddings` but with more control
- You need **GPU acceleration** (WebGPU in browser, CUDA in Node.js) or **quantization** for speed/size trade-offs
- You're building a **browser or Electron app** and want progress callbacks for model download
- You need a matching tokenizer for chunking alignment (`getTokenizer()`)
- Default model: `Xenova/all-MiniLM-L6-v2` (384 dimensions, 512 max tokens)

### When to use an OSS endpoint

- You're running an **OpenAI-compatible embedding server** (e.g., vLLM, Ollama, LiteLLM)
- You want self-hosted embeddings with a familiar API shape

## OpenAIEmbeddings

Supports OpenAI, Azure OpenAI, and any OpenAI-compatible endpoint.

### OpenAI

```ts
import { OpenAIEmbeddings } from 'vectra';

const embeddings = new OpenAIEmbeddings({
  apiKey: 'sk-...',
  model: 'text-embedding-3-small',
  maxTokens: 8000,
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | -- | OpenAI API key (required) |
| `model` | `string` | -- | Model name (required) |
| `maxTokens` | `number?` | `500` | Max tokens per input |
| `dimensions` | `number?` | -- | Output dimensions (model must support it) |
| `organization` | `string?` | -- | OpenAI organization ID |
| `endpoint` | `string?` | -- | Custom API endpoint |
| `retryPolicy` | `number[]?` | `[2000, 5000]` | Retry delays in ms |
| `logRequests` | `boolean?` | `false` | Log requests to console |
| `requestConfig` | `RequestInit?` | -- | Custom fetch options |

### Azure OpenAI

```ts
const embeddings = new OpenAIEmbeddings({
  azureApiKey: '...',
  azureEndpoint: 'https://your-resource.openai.azure.com',
  azureDeployment: 'your-embedding-deployment',
  azureApiVersion: '2023-05-15',
  maxTokens: 8000,
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `azureApiKey` | `string` | -- | Azure API key (required) |
| `azureEndpoint` | `string` | -- | Resource endpoint URL (required) |
| `azureDeployment` | `string` | -- | Deployment name (required) |
| `azureApiVersion` | `string?` | `'2023-05-15'` | API version |
| `maxTokens` | `number?` | `500` | Max tokens per input |
| `dimensions` | `number?` | -- | Output dimensions |

### OSS / Compatible endpoint

```ts
const embeddings = new OpenAIEmbeddings({
  ossModel: 'text-embedding-3-small',
  ossEndpoint: 'https://your-endpoint.example.com',
  maxTokens: 8000,
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ossModel` | `string` | -- | Model name (required) |
| `ossEndpoint` | `string` | -- | Endpoint URL (required) |
| `maxTokens` | `number?` | `500` | Max tokens per input |

### CLI keys.json

The CLI uses a `keys.json` file instead of constructor options. See the [CLI Reference](/vectra/cli#embeddings-provider-config-keysjson) for all three formats.

## LocalEmbeddings

Run embeddings locally using HuggingFace transformer models. No API key or network calls required. The pipeline initializes lazily on first call — models are downloaded and cached locally.

```ts
import { LocalEmbeddings } from 'vectra';

// Default: Xenova/all-MiniLM-L6-v2 (384 dims, 256 max tokens)
const embeddings = new LocalEmbeddings();

// Custom model
const embeddings = new LocalEmbeddings({
  model: 'Xenova/all-MiniLM-L12-v2',
  maxTokens: 512,
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | `string?` | `'Xenova/all-MiniLM-L6-v2'` | HuggingFace model ID (must support `feature-extraction` pipeline) |
| `maxTokens` | `number?` | `256` | Max tokens per input |

{: .note }
Requires `@huggingface/transformers`: `npm install @huggingface/transformers`

## TransformersEmbeddings

Full-featured local embeddings with device selection, quantization, pooling control, and progress callbacks. Works in Node.js, browsers, and Electron.

{: .important }
Use the async `create()` factory method — the constructor is private.

```ts
import { TransformersEmbeddings } from 'vectra';

// Default: Xenova/all-MiniLM-L6-v2 (384 dims, 512 max tokens)
const embeddings = await TransformersEmbeddings.create();

// Full options
const embeddings = await TransformersEmbeddings.create({
  model: 'Xenova/bge-small-en-v1.5',
  maxTokens: 512,
  device: 'gpu',
  dtype: 'q8',
  pooling: 'mean',
  normalize: true,
  progressCallback: (p) => console.log(p.status, p.progress),
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | `string?` | `'Xenova/all-MiniLM-L6-v2'` | HuggingFace model ID |
| `maxTokens` | `number?` | `512` | Max tokens per input |
| `device` | `'auto' \| 'gpu' \| 'cpu' \| 'wasm'` | `'auto'` | Inference device |
| `dtype` | `'fp32' \| 'fp16' \| 'q8' \| 'q4'` | `'fp32'` | Model weight precision |
| `normalize` | `boolean?` | `true` | Normalize to unit length |
| `pooling` | `'mean' \| 'cls'` | `'mean'` | Token pooling strategy |
| `progressCallback` | `function?` | -- | Download/load progress callback |

### Device selection

| Device | Environment | Notes |
|--------|-------------|-------|
| `'auto'` | Any | Uses best available: WebGPU in browser, CUDA in Node.js, falls back to WASM/CPU |
| `'gpu'` | Browser (WebGPU), Node.js (CUDA) | Fastest when available |
| `'cpu'` | Any | Most compatible, slowest |
| `'wasm'` | Any | Good browser fallback when WebGPU unavailable |

### Quantization

| Precision | Size vs fp32 | Quality | Best for |
|-----------|-------------|---------|----------|
| `'fp32'` | 1x (baseline) | Best | Accuracy-critical workloads |
| `'fp16'` | ~0.5x | Very good | General use with GPU |
| `'q8'` | ~0.25x | Good | Speed/size balance |
| `'q4'` | ~0.125x | Acceptable | Maximum speed, resource-constrained |

### Aligned tokenizer

`TransformersEmbeddings` can produce a matching tokenizer for text chunking. This ensures chunk boundaries align with the model's token boundaries:

```ts
const embeddings = await TransformersEmbeddings.create();
const tokenizer = embeddings.getTokenizer();

// Use with LocalDocumentIndex for aligned chunking
const docs = new LocalDocumentIndex({
  folderPath: './my-index',
  embeddings,
  tokenizer,
});
```

{: .note }
Requires `@huggingface/transformers`: `npm install @huggingface/transformers`

## Switching providers

Changing embedding providers requires re-embedding all data because different models produce incompatible vector spaces. The workflow:

1. Create a new index with the new provider
2. Re-ingest all documents or items
3. Delete the old index

{: .warning }
Never mix embeddings from different models in the same index. Cosine similarity scores will be meaningless across different vector spaces.

## Browser compatibility

| Provider | Browser | Notes |
|----------|---------|-------|
| `OpenAIEmbeddings` | Yes | Makes fetch requests to API — requires API key exposed to client |
| `LocalEmbeddings` | Yes | Runs in-browser via `@huggingface/transformers` |
| `TransformersEmbeddings` | Yes | Best browser option — GPU/WASM support, progress callbacks |
| `BrowserWebFetcher` | Yes | Web content ingestion using Fetch API + DOMParser |

For browser usage, import from `vectra/browser`:

```ts
import { TransformersEmbeddings, IndexedDBStorage, LocalDocumentIndex } from 'vectra/browser';
```

See the [Storage guide](/vectra/storage#running-in-the-browser) for full browser setup.
