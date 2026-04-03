# Beacon - Wisdom

Distilled principles. Read this first every session (after SOUL.md).

Last compacted: 2026-04-03

---

## Previous Projects

Beacon previously owned three packages in the `teammates` monorepo (recall, cli, consolonia). Wisdom entries below are filtered to what's transferable to the Vectra project. Source-project-specific entries have been removed.

---

## Build & Quality

**Clean dist before rebuilding.**
Always remove `lib/` before `yarn build`. Stale build artifacts (e.g., orphaned JS files from deleted TS sources) hide compile problems and can make a broken source tree look healthy.

**Test after every build.**
Run the full test suite after building. Build-then-test is the required verification loop.

**Verify before logging.**
Do not record a fix until the file is actually written and verified. False "done" entries poison future debugging.

**Lint exits clean (warnings only).**
ESLint v10 flat config (`eslint.config.mjs`) is configured to produce 0 errors. Test files have relaxed rules (`no-explicit-any` off, `no-unused-vars` off). Run `yarn lint` before submitting.

## Index & Storage

**The on-disk format is the API contract.**
`index.json` structure, per-item JSON files, and `catalog.json` are consumed by other languages. Any change to the on-disk layout is a breaking change that requires a version bump.

**Codecs abstract serialization format.**
`JsonCodec` and `ProtobufCodec` implement `IndexCodec`. Proto schemas live in `src/codecs/schemas/`. Migration logic in `migrateIndex.ts` handles format upgrades. Test both codecs when changing serialization.

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
`LocalFileStorage`, `VirtualFileStorage`, and `IndexedDBStorage` implement the same interface. Tests should use `VirtualFileStorage` when filesystem access isn't being tested.

**Embeddings model is an interface, not a class.**
`EmbeddingsModel` defines `createEmbeddings()` and `maxTokens`. `OpenAIEmbeddings` and `LocalEmbeddings` (transformers.js) are implementations. Users can provide their own — don't couple library internals to any specific provider.

**CLI is a thin wrapper over the library API.**
`vectra-cli.ts` parses args with yargs and delegates to `LocalDocumentIndex`. Keep CLI logic minimal — business logic belongs in the library classes.

**Use pathUtils, not Node's `path` module.**
`src/utils/pathUtils.ts` is the cross-platform path abstraction used throughout the codebase (14+ files). It works with both `LocalFileStorage` and `VirtualFileStorage` on any OS. Always import from `pathUtils` instead of `node:path` in library code.

**Browser support requires Node-free paths.**
`src/browser.ts` is the browser entry point. It excludes Node-specific modules (FileFetcher, server, etc.). Any new module that uses `fs`, `path`, or other Node built-ins must be excluded from the browser barrel export.

## Server

**gRPC server wraps the library API.**
`src/server/` exposes Vectra operations via gRPC. Handlers in `src/server/handlers/` are thin wrappers that delegate to `LocalIndex`/`LocalDocumentIndex`. Keep handler logic minimal — same principle as the CLI.

## Process

**Co-located tests are the convention.**
Every `Foo.ts` has a `Foo.spec.ts` next to it. Don't create separate test directories.

**CommonJS modules, not ESM.**
The project uses `"module": "commonjs"` in tsconfig. Use `require`-compatible patterns. Don't introduce ESM-only dependencies.

**Avoid proxyquire — use sinon stubs instead.**
Proxyquire was removed from the project due to ESM compatibility issues. For module-level stubbing, use sinon to stub exported functions or the module's internal references directly.

**Node >= 22 is required.**
`undici@8` (transitive dep) requires Node >= 22.19.0. The `engines` field in `package.json` and CI matrix both target Node 22+.

**Coverage bar is high (~96% statements).**
Server handlers and utility modules have near-100% coverage. New code should maintain this bar with co-located spec files.
