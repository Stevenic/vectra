---
name: Quote globs in npm scripts for cross-platform correctness
description: Unquoted globs in package.json scripts are expanded by /bin/sh on Linux without globstar, silently skipping files at wrong depths
type: feedback
---

Always quote glob patterns in npm script commands (e.g., `"src/**/*.spec.ts"` not `src/**/*.spec.ts`).

**Why:** On Linux, npm runs scripts via `/bin/sh` which lacks `globstar`. Without quotes, `**` is treated as `*`, matching only one directory level. This silently skips files — tests appear to pass but coverage drops because most specs never ran. On Windows, the shell doesn't expand globs so the problem is invisible locally.

**How to apply:** When writing or reviewing any npm script that uses `**` glob patterns, ensure they're quoted. This applies to test runners (mocha, jest), linters (eslint), and any tool that does its own globbing.
