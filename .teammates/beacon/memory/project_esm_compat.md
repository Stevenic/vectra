---
name: ESM compatibility resolved by removing proxyquire
description: proxyquire was removed project-wide; sinon stubs are now the standard for module-level test stubbing
type: project
---

The proxyquire ESM incompatibility (FileFetcher.spec.ts, WebFetcher.spec.ts, TransformersEmbeddings.spec.ts) was resolved by removing proxyquire entirely and rewriting affected tests to use sinon stubs.

**Why:** proxyquire depends on CommonJS `require()` but Node auto-detected .ts files as ESM. Rather than adding `"type": "commonjs"` to package.json, the cleaner fix was to eliminate the proxyquire dependency.

**How to apply:** For any new test that needs module-level stubbing, use sinon to stub exported functions or module internals directly. Do not reintroduce proxyquire.
