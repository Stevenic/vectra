---
title: Changelog
layout: default
nav_order: 11
---

# Changelog
{: .no_toc }

Release history, breaking changes, and migration guides.
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

### Security fixes

- **Removed axios dependency** — eliminated supply chain risk by switching to built-in `fetch()`
- **Fixed dependency vulnerabilities** — resolved additional security issues in transitive dependencies

### Infrastructure

- CI/CD pipeline with GitHub Actions (build, test, lint, coverage)
- ESLint configuration added
- Developer documentation site launched

---

## v0.12.2 (2026-01-11)

### Features

- **Unit test coverage** — expanded test suite covering `LocalIndex` simple functions and `queryItem` cases (#78, #79)

### Community

- **Code of Conduct** — added Contributor Covenant (#82)
- **Contributing guide** — added `CONTRIBUTING.md` (#83)
- **License update** — updated copyright year (#84)
- **README overhaul** — new readme with updated table of contents (#85, #91)

### Infrastructure

- Added `publish:check` script — clean build + test + dry-run publish (#92)

---

## v0.12.0 (2026-01-08)

### Features

- **Batch insert** — `beginBatchUpdate()` for efficient bulk operations on `LocalIndex` (#73)

### Bug fixes

- **Webpack bundling fix** — replaced `gpt-3-encoder` with `gpt-tokenizer` to resolve `fs.readFileSync` errors when bundling with Webpack (#75)
- **Build break fix** — fixed build breaks from batch import PR

---

## v0.11.1 (2025-05-12)

### Bug fixes

- **Missing dependency** — added missing dependency to `package.json` (#71)

---

## v0.11.0 (2025-05-07)

### Changes

- **Dependency upgrades** — upgraded all dependencies (#68)
- **Node.js engine constraint** — added `engines` field to `package.json` requiring `>=20.x`

---

## Version compatibility

| Vectra version | Node.js | Optional dependencies |
|---------------|---------|----------------------|
| 0.14.x | 22.x+ | `@huggingface/transformers` (local embeddings), `protobufjs` (protobuf format) |
| 0.12.x | 20.x+ | -- |
| 0.11.x | 20.x+ | -- |
