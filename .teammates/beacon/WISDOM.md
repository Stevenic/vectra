# Beacon - Wisdom

Distilled principles. Read this first every session (after SOUL.md).

Last compacted: 2026-04-02

---

## Previous Projects

Beacon previously owned three packages in the `teammates` monorepo (recall, cli, consolonia). Wisdom entries below are filtered to what's transferable to the Vectra project. Source-project-specific entries (prompt pipelines, feed rendering, terminal UI, mouse tracking, CLI orchestrator architecture) have been removed.

---

## Build & Quality

**Clean dist before rebuilding.**
Always remove `lib/` before `yarn build`. Stale build artifacts hide compile problems and can make a broken source tree look healthy.

**Test after every build.**
Run the full test suite after building. Build-then-test is the required verification loop.

**Verify before logging.**
Do not record a fix until the file is actually written and verified. False "done" entries poison future debugging.

## Index & Storage

**The on-disk format is the API contract.**
`index.json` structure, per-item JSON files, and `catalog.json` are consumed by other languages. Any change to the on-disk layout is a breaking change that requires a version bump.

**Metadata filtering evaluates before similarity ranking.**
Filters narrow the candidate set first, then cosine similarity sorts. Keep filter evaluation fast — it runs on every query.

**Pre-normalized vectors and cached norms are performance-critical.**
Every item stores its vector norm. Cosine similarity skips the normalization step at query time. Never store un-normalized vectors.

**Update locks prevent concurrent corruption.**
`beginUpdate` → writes → `endUpdate` is the only safe mutation path. Double-begin throws, end-without-begin throws. Helper methods like `upsertDocument` wrap this correctly.

## Chunking & Documents

**Chunk boundaries matter for retrieval quality.**
TextSplitter respects token budgets and separator boundaries. Changing chunk size or overlap affects both index size and retrieval relevance — treat these as tuning parameters, not implementation details.

**Document sections merge adjacent chunks for readability.**
`renderSections()` combines neighboring high-scoring chunks within a token budget. This is the primary interface for prompt augmentation — keep it fast and predictable.

**Hybrid retrieval blends semantic and keyword results.**
BM25 keyword matches are added after the semantic pass. Each section flags `isBm25` so consumers can weight or filter them.

## API Design

**Storage backends are pluggable.**
`LocalFileStorage` and `VirtualFileStorage` implement the same interface. Tests should use `VirtualFileStorage` when filesystem access isn't being tested.

**Embeddings model is an interface, not a class.**
`EmbeddingsModel` defines `createEmbeddings()` and `maxTokens`. `OpenAIEmbeddings` is one implementation. Users can provide their own — don't couple library internals to OpenAI specifics.

**CLI is a thin wrapper over the library API.**
`vectra-cli.ts` parses args with yargs and delegates to `LocalDocumentIndex`. Keep CLI logic minimal — business logic belongs in the library classes.

## Process

**Co-located tests are the convention.**
Every `Foo.ts` has a `Foo.spec.ts` next to it. Don't create separate test directories.

**CommonJS modules, not ESM.**
The project uses `"module": "commonjs"` in tsconfig. Use `require`-compatible patterns. Don't introduce ESM-only dependencies.
