---
title: Changelog
layout: default
nav_order: 11
---

# Changelog
{: .no_toc }

Breaking changes, migration guides, and version compatibility.
{: .fs-6 .fw-300 }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## v0.14.x

### Breaking: fetch() replaces axios

All HTTP requests now use the built-in `fetch()` API instead of [axios](https://github.com/axios/axios). This removes axios as a dependency and eliminates third-party code from the HTTP request path.

**Who is affected:** Projects that relied on axios interceptors or custom axios configuration passed through Vectra's HTTP layer.

**Migration:** Remove any axios-specific customization. If you need to customize requests, use the `requestConfig` option (a standard `RequestInit` object) on `OpenAIEmbeddings`:

```ts
const embeddings = new OpenAIEmbeddings({
  apiKey: '...',
  model: 'text-embedding-3-small',
  requestConfig: {
    headers: { 'X-Custom-Header': 'value' },
  },
});
```

### Breaking: Node.js 22.x minimum

The minimum Node.js version is now **22.x** (up from 20.x). This is driven by the `undici@8.0.0` transitive dependency which requires `node >=22.19.0`.

**Who is affected:** Projects running Node.js 20.x or earlier.

**Migration:** Upgrade to Node.js 22.x LTS. Node.js 20.x reached end-of-life on March 26, 2026.

### New features in v0.14.x

- **LocalEmbeddings** — run HuggingFace embeddings locally with no API key
- **TransformersEmbeddings** — async factory with GPU/WASM device selection, quantization, and progress callbacks
- **Protocol Buffer format** — opt-in binary serialization (40-50% smaller files) via `ProtobufCodec`
- **gRPC server** — `vectra serve` exposes 19 RPCs for cross-language access
- **Language binding generator** — `vectra generate` scaffolds clients for Python, C#, Rust, Go, Java, TypeScript
- **Browser & Electron support** — dedicated `vectra/browser` entry point with `IndexedDBStorage` and `TransformersEmbeddings`
- **BrowserWebFetcher** — browser-native web fetcher using Fetch API + DOMParser
- **FolderWatcher** — `vectra watch` CLI and `FolderWatcher` class for auto-syncing directories
- **`vectra delete`** — delete indexes from the CLI
- **`vectra migrate`** — migrate between JSON and protobuf formats
- **TransformersTokenizer** — tokenizer matching TransformersEmbeddings model for chunk alignment

## Version compatibility

| Vectra version | Node.js | Optional dependencies |
|---------------|---------|----------------------|
| 0.14.x | 22.x+ | `@huggingface/transformers` (local embeddings), `protobufjs` (protobuf format) |
| 0.13.x and earlier | 20.x+ | -- |
