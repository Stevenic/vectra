# Changelog: v0.10.0 → v0.14.0

> Generated from git history by Pipeline on 2026-04-02. For Scribe to format and add to docs.

**Note:** No `v0.12.3` tag exists. The tags in the repo are `v0.10.0` and `v0.12.0`. The current package version is `0.14.0`. This changelog covers all releases from v0.10.0 through the current v0.14.0.

---

## v0.14.0 (2026-04-02)

### Features
- **Agent Ready support** — Added Agent Ready capabilities (`1b58a2d`)
- **Browser & Electron support** — Full browser and Electron compatibility, replacing Node-specific `path` module with portable `pathUtils` implementation. Includes Webpack build for browser bundle (#99, `acdd2dc`)
- **Local embeddings with Transformers.js** — Added `TransformersEmbeddings` class using Hugging Face `@huggingface/transformers` for fully local embedding generation without API calls (#97, `ab04ce3`)
- **gRPC support** — Added gRPC transport layer (`004ec75`)
- **Protocol buffer storage** — Binary protobuf-based index format achieving 40–50% smaller index files (`3108657`)
- **Watch command & FolderWatcher** — `vectra watch` CLI command and `FolderWatcher` class for automatic re-indexing when files change (`59312d6`)
- **Pluggable storage systems** — Storage abstraction layer allowing custom storage backends (e.g., in-memory, cloud, database) instead of only filesystem (`304db20`, `144cc38`)

### Security
- **Removed axios dependency** — Eliminated axios supply chain vulnerability (`10ff27a`)
- **Fixed security vulnerabilities** — Resolved additional dependency vulnerabilities (`dd5dac0`)

### Infrastructure
- **CI/CD pipeline** — Added GitHub Actions workflow for build, test, lint, and coverage
- **ESLint** — Added linting configuration
- **Developer docs** — Initial set of developer documentation (`c1f7450`)
- **Node.js 22+ required** — Engine requirement bumped from `>=20.x` to `>=22.x` due to `undici@8.0.0` transitive dependency

---

## v0.12.2 (2026-01-11)

### Features
- **Unit test coverage** — Expanded test suite covering `LocalIndex` simple functions and `queryItem` cases (#78, #79, `9109d3b`, `05fb074`)

### Community
- **Code of Conduct** — Added Contributor Covenant (#82, `376f25b`)
- **Contributing guide** — Added `CONTRIBUTING.md` (#83, `4e6a731`)
- **License update** — Updated copyright year (#84, `36b57ea`)
- **README overhaul** — Drafted new readme with updated table of contents (#85, #91, `8bdb6a9`, `0e79d7c`)

### Infrastructure
- **`publish:check` script** — Added clean build + test + dry-run publish script (#92, `3931594`)

---

## v0.12.0 (2026-01-08)

### Features
- **Batch insert** — Added `beginBatchUpdate()` / batch insert function to `LocalIndex` for efficient bulk operations (#73, `9969c70`)

### Bug Fixes
- **Webpack bundling fix** — Replaced `gpt-3-encoder` with `gpt-tokenizer` to resolve `fs.readFileSync` errors when bundling with Webpack (#75, `2e7d6d7`)

### Bug Fixes
- **Build break fix** — Fixed build breaks from batch import PR (`1d2ff92`)

---

## v0.11.1 (2025-05-12)

### Bug Fixes
- **Missing dependency** — Added missing dependency to `package.json` (#71, `dc37abb`)

---

## v0.11.0 (2025-05-07)

### Changes
- **Dependency upgrades** — Upgraded all dependencies (#68, `eb68296`)
- **Node.js engine constraint** — Added `engines` field to `package.json` requiring `>=20.x` (`da41c69`)
