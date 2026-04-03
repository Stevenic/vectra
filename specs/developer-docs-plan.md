# Developer Documentation Plan

**Status:** Approved
**Date:** 2026-04-02
**Author:** Scribe

---

## Goals

1. **Trim README.md** to a landing page (~80-100 lines): elevator pitch, install, one tiny example, and links to docs
2. **Expand the docs site** into a comprehensive developer resource covering all Vectra features in depth
3. **Add tutorial/cookbook content** so developers can go from zero to working app, not just read API signatures

## Current State

| Page | Lines | Coverage |
|------|-------|----------|
| README.md | 206 | Overview, install, quick start (3 paths), CLI table, API table, breaking changes |
| docs/index.md | 35 | Landing page with feature bullets and nav links |
| docs/getting-started.md | 190 | Requirements, install, quick start (both paths), next steps |
| docs/core-concepts.md | 183 | Index types, metadata filtering, hybrid retrieval, on-disk layout, storage backends |
| docs/cli.md | 273 | All 11 commands with flags and keys.json config |
| docs/api-reference.md | 533 | LocalIndex, LocalDocumentIndex, embeddings, FolderWatcher, storage, codecs, utilities, filter ops |
| docs/best-practices.md | 187 | Index design, write patterns, chunking, retrieval, performance, troubleshooting |
| docs/storage.md | 275 | FileStorage interface, 3 backends, custom impl, browser guide, formats |
| docs/grpc.md | 168 | Server modes, service API, language bindings with examples |

**Total doc site:** ~1,844 lines across 8 pages (including index)

### Gaps Identified

1. **No embeddings guide** — choosing between 4 providers is scattered across API ref and getting-started
2. **No document indexing deep-dive** — chunking strategies, section rendering, BM25 tuning are superficial
3. **No tutorials/cookbook** — no end-to-end walkthrough for common use cases (RAG, browser app, cross-language)
4. **No migration/changelog page** — breaking changes live only in README
5. **No dedicated FolderWatcher guide** — watch/sync workflow only in API ref and CLI
6. **Samples are stale** — `samples/` has only a Wikipedia example from January; doesn't reflect current features
7. **docs/index.md is thin** — feature list doesn't mention gRPC, browser, protobuf, local embeddings

---

## Proposed Documentation Structure

### Phase 1: README Trim + Docs Site Expansion

#### README.md (~80-100 lines)

Trim to just:
- Badges
- One-paragraph overview (2-3 sentences)
- `npm install vectra`
- Single 10-line example (LocalDocumentIndex — the most common path)
- Documentation links table (same as today)
- License + Contributing links

**Move to docs:** Breaking changes, CLI overview table, API summary table, quick start paths A/B/C, optional deps explanation.

#### docs/index.md — Enhanced Landing Page

Expand to be a proper home page:
- Feature grid (all key capabilities including browser, gRPC, protobuf, local embeddings)
- "Choose your path" decision tree: items vs documents, Node vs browser vs cross-language
- Quick links to all doc pages with 1-line descriptions
- What's New / Breaking Changes section (moved from README)

#### docs/embeddings.md — Embeddings Guide (NEW, nav_order: 3.5)

Dedicated guide for choosing and configuring embeddings:
- Decision matrix: OpenAI vs Azure vs OSS vs LocalEmbeddings vs TransformersEmbeddings
- When to use which (cost, latency, privacy, environment)
- Configuration for each provider with full examples
- Switching providers / re-embedding workflow
- Token limits and batching behavior
- Browser vs Node.js compatibility per provider

#### docs/documents.md — Document Indexing Guide (NEW, nav_order: 4)

Deep-dive on the document workflow:
- Document lifecycle: ingest → chunk → embed → store → query → render
- Chunking strategies: size, overlap, separators, docType hints
- TextSplitter configuration and behavior
- Section rendering: maxTokens, sectionCount, overlap, scoring
- Hybrid retrieval (BM25): when to use, how it blends, tuning
- FolderWatcher: setup, events, file filtering, debouncing
- Web and file ingestion: WebFetcher, FileFetcher, BrowserWebFetcher, cookies

#### docs/core-concepts.md — Refocus

Remove document-specific content (moved to documents.md). Refocus on:
- Index types (overview only — link to documents.md for deep-dive)
- Metadata filtering (keep — this is the right home)
- On-disk layout (keep)
- Storage backends (overview — link to storage.md)

#### docs/getting-started.md — Streamline

- Keep requirements + install
- Keep quick start Path A (LocalIndex) and Path B (LocalDocumentIndex) 
- Move browser quick start to docs/embeddings.md or keep as brief pointer
- Add "Next steps" flow: getting-started → core-concepts → embeddings → documents → cli

#### docs/api-reference.md — Curated Overview + Typedoc Link

Replace the current hand-written API reference with a **curated overview page** that:
- Groups exports into sections (Indexes, Embeddings, Storage, Ingestion, Utilities, Types) with 1-2 sentence descriptions and key usage snippets
- Links each class/function to its **typedoc-generated page** (opens in new tab)
- The typedoc output lives at a separate URL (e.g., `/vectra/api/` or a GitHub Pages sub-path) and is auto-generated from TSDoc comments in the source

**Typedoc setup** (hand off to @beacon/@pipeline):
- Add `typedoc` as a dev dependency
- Configure `typedoc.json` to output HTML to `docs/api/` or a dedicated branch
- CI generates and deploys typedoc output alongside the docs site
- The curated overview page links to typedoc pages with `target="_blank"` so they open in a new tab

#### docs/changelog.md — Changelog / Migration Guide (NEW, nav_order: 9)

- Breaking changes by version (move from README)
- Migration steps for each breaking change
- Version compatibility matrix (Node.js, optional deps)

### Phase 2: Tutorials & Cookbook

#### docs/tutorials/index.md — Tutorials Hub

Parent page linking to tutorials:

#### docs/tutorials/rag-pipeline.md — Build a RAG Pipeline

End-to-end: create index → ingest documents → query → render sections → feed to LLM. Shows the full pattern most Vectra users are after.

#### docs/tutorials/browser-app.md — Browser Vector Search

Build a browser-based semantic search app with IndexedDB + TransformersEmbeddings. Covers bundler setup, async initialization, IndexedDB persistence.

#### docs/tutorials/cross-language.md — Cross-Language with gRPC

Set up the gRPC server, generate Python bindings, build a Python client that queries the index. Covers multi-index mode, daemon, and the client API.

#### docs/tutorials/custom-storage.md — Custom Storage Provider (NEW)

Build a custom `FileStorage` implementation using SQLite as the backing store. Covers:
- The `FileStorage` interface contract (all 9 methods)
- SQLite schema design for key-value blob storage
- Implementing read, write, list, delete, and exists operations
- Handling binary data (protobuf format) and JSON format
- Plugging the custom storage into `LocalIndex` and `LocalDocumentIndex`
- Testing the implementation
- When you'd choose SQLite over the built-in options (single-file portability, concurrent readers, SQL queryability)

#### docs/tutorials/browser-electron.md — Browser & Electron App (NEW)

Build a working vector search app that runs in the browser or Electron. Covers:
- Using the `vectra/browser` entry point and how conditional exports work
- Setting up `IndexedDBStorage` for persistent storage
- Initializing `TransformersEmbeddings` with `create()` (async factory pattern)
- Device selection (GPU vs WASM vs CPU) and quantization options
- Bundler configuration (webpack/vite) for WASM and model files
- `BrowserWebFetcher` for ingesting web content from the browser
- Electron-specific considerations (main vs renderer process, nodeIntegration)
- Offline-capable architecture (no API keys needed)

#### docs/tutorials/folder-sync.md — Auto-Sync a Folder

Use FolderWatcher (or `vectra watch` CLI) to keep an index in sync with a directory of markdown files. Event handling, filtering, error recovery.

### Phase 3: Samples Refresh

Update `samples/` to match current features:
- `samples/quickstart/` — minimal LocalIndex + LocalDocumentIndex examples
- `samples/rag/` — RAG pipeline from tutorial
- `samples/browser/` — browser app with IndexedDB (HTML + bundler config + Electron variant)
- `samples/custom-storage/` — SQLite storage provider from tutorial
- `samples/grpc-python/` — Python gRPC client
- `samples/folder-watcher/` — FolderWatcher usage
- Remove or update stale `samples/wikipedia/`

---

## Proposed Nav Order

```
1. Home (index.md)
2. Getting Started
3. Core Concepts
4. Embeddings Guide (NEW)
5. Document Indexing (NEW)
6. CLI Reference
7. API Reference → links to typedoc (opens in new tab)
8. Best Practices
9. Storage
10. gRPC Server
11. Changelog (NEW)
12. Tutorials (NEW — with children)
    12.1 RAG Pipeline
    12.2 Custom Storage Provider (NEW)
    12.3 Browser & Electron App (NEW)
    12.4 Cross-Language gRPC
    12.5 Folder Sync
```

---

## Execution Plan

| Phase | Scope | Owner | Dependencies |
|-------|-------|-------|-------------|
| **1a** | Trim README.md to ~80-100 lines | Scribe | None |
| **1b** | Expand docs/index.md landing page | Scribe | None |
| **1c** | Create docs/embeddings.md | Scribe | Verify against source (@beacon review) |
| **1d** | Create docs/documents.md | Scribe | Verify against source (@beacon review) |
| **1e** | Refocus docs/core-concepts.md | Scribe | After 1d (to avoid duplication) |
| **1f** | Create docs/changelog.md | Scribe | None |
| **1g** | Reorganize docs/api-reference.md | Scribe | After 1c, 1d |
| **1h** | Update docs/getting-started.md | Scribe | After 1c, 1d |
| **1i** | Typedoc setup (config, CI, deploy) | Beacon + Pipeline | None |
| **2a** | Tutorial: RAG Pipeline | Scribe + Lexicon (prompt patterns) | Phase 1 complete |
| **2b** | Tutorial: Custom Storage Provider (SQLite) | Scribe + Beacon (code review) | Phase 1 complete |
| **2c** | Tutorial: Browser & Electron App | Scribe + Beacon (code review) | Phase 1 complete |
| **2d** | Tutorial: Cross-Language gRPC | Scribe + Lexicon | Phase 1 complete |
| **2e** | Tutorial: Folder Sync | Scribe | Phase 1 complete |
| **3** | Samples refresh | Scribe + Beacon (code correctness) | Phase 2 complete |

---

## Resolved Questions

1. **Auto-generated API docs** — Yes, use **typedoc** for the API reference. The generated docs should open in a **new browser tab** (external link with `target="_blank"`), not be inlined in the docs site nav. The hand-written `api-reference.md` page stays as a curated overview linking out to the typedoc output.
2. **Versioned docs** — **Latest only.** No version switcher needed.
3. **Tutorial depth** — **Snippets in main pages, link to tutorials** for full end-to-end code. Main doc pages show focused code snippets; tutorials contain the complete walkthrough.
4. **llms.txt** — Treat as a **terse coding-agent reference.** LLMs don't need detailed explanations — keep it compact. Update alongside README trim in Phase 1 to stay consistent, but keep the content minimal.

---

## Success Criteria

- README is under 100 lines and contains no content that duplicates the docs site
- Every feature in `src/index.ts` exports has a corresponding doc page section
- A developer can go from `npm install` to working RAG pipeline using only the docs site
- No broken internal links between doc pages
- Samples in `samples/` all run against the current library version
