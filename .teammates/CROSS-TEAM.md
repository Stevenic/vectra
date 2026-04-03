# Cross-Team Notes

Shared lessons that affect multiple teammates. Record here instead of duplicating across individual WISDOM.md files.

This file also serves as a **shared index** — teammates can add pointers to private docs in their folder that other teammates might find useful.

Reverse chronological. Tag affected teammates.

## Ownership Scopes

Every teammate **owns everything** under their `.teammates/<name>/` folder — SOUL.md, WISDOM.md, memory/, and any private docs they create. This is unconditional: no teammate needs permission to edit their own folder, and no other teammate should modify it.

The **Boundary Rule** (see PROTOCOL.md) applies to the **codebase** — source code, configs, and shared framework files — not to a teammate's own `.teammates/<name>/` directory.

| Teammate | Self-owned folder | Codebase ownership (see SOUL.md for full details) |
|---|---|---|
| **Beacon** | `.teammates/beacon/**` | `src/**/*.ts`, `src/storage/**`, `src/internals/**`, `bin/vectra.js`, `package.json`, `tsconfig.json` |
| **Lexicon** | `.teammates/lexicon/**` | `samples/**` (co-owned), `.teammates/*/SOUL.md` (co-owned) |
| **Pipeline** | `.teammates/pipeline/**` | `.github/workflows/**`, `.github/**` |
| **Scribe** | `.teammates/scribe/**` | `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `samples/**` (co-owned), `.teammates/*.md` |

When adding a new teammate, add a row to this table.

## Shared Docs

<!-- Add pointers to docs that other teammates might find useful. -->

_(No shared docs yet.)_

## Notes

_(No cross-team notes yet — add the first one when a cross-team lesson arises.)_
