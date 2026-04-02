---
name: ESM compatibility issue with proxyquire tests
description: FileFetcher.spec.ts and WebFetcher.spec.ts fail because proxyquire uses require() but Node auto-detects .ts files as ESM
type: project
---

FileFetcher.spec.ts and WebFetcher.spec.ts fail with "require is not defined" / "Cannot read properties of undefined (reading 'require')".

**Why:** Node auto-detects these files as ESM (no `"type"` field in package.json), but proxyquire depends on CommonJS `require()`. The project convention is CommonJS but the test runner loads files as ESM.

**How to apply:** Either add `"type": "commonjs"` to package.json, or migrate these two test files away from proxyquire to a stubbing approach that works with ESM (e.g., sinon stubs on the imported module).
