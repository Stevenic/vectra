# Vectra AI Teammates

Four AI teammates covering software engineering, prompt/retrieval quality, DevOps, and project management for the Vectra local vector database library.

## Roster

<!-- Keep in sync with routing guide below and actual teammate folders -->

| Name | Persona | Primary Ownership | Last Active |
|---|---|---|---|
| **Beacon** | Software Engineer | `src/**/*.ts`, `bin/`, `package.json`, `tsconfig.json` | 2026-04-02 |
| **Lexicon** | Prompt Engineer | `samples/**`, `.teammates/*/SOUL.md` | 2026-04-02 |
| **Pipeline** | DevOps Engineer | `.github/workflows/**`, `.github/**` | 2026-04-02 |
| **Scribe** | Project Manager | `README.md`, `CONTRIBUTING.md`, `samples/**`, `.teammates/*.md` | 2026-04-02 |

## Dependency Flow

```
Beacon (src/ — core library, CLI, storage)
  ↓
Pipeline (.github/ — CI/CD, publish)
  ↓
Scribe (README, samples, docs)
  ↑
Lexicon (retrieval quality, prompt patterns)
```

Beacon produces the library code. Pipeline consumes it to build/test/publish. Scribe documents the shipped API. Lexicon advises on retrieval quality and prompt patterns in samples and documentation.

## Routing Guide

<!-- Keep in sync with roster above -->

| Keywords | Teammate |
|---|---|
| vector, index, embeddings, search, query, metadata, filter, chunk, document, storage, CLI, LocalIndex, LocalDocumentIndex, OpenAIEmbeddings, TextSplitter, BM25, cosine, similarity | **Beacon** |
| prompt, token, distance, compression, attention, RAG, retrieval, chunking strategy, renderSections, hybrid retrieval, sample code | **Lexicon** |
| CI, CD, workflow, GitHub Actions, build, test, publish, release, deploy, coverage, lint, dependabot | **Pipeline** |
| documentation, README, CONTRIBUTING, samples, examples, roadmap, spec, planning, project management, template | **Scribe** |

## Structure

Each teammate folder contains:

- **SOUL.md** — Identity, continuity instructions, principles, boundaries, capabilities, and ownership
- **WISDOM.md** — Distilled principles from compacted memories (read second, after SOUL.md)
- **memory/** — Daily logs (`YYYY-MM-DD.md`) and typed memory files (`<type>_<topic>.md`)
- Additional files as needed (e.g., design docs, bug trackers)

Root-level shared files:

- **[USER.md](USER.md)** — Who the user is (gitignored, stays local)
- **[CROSS-TEAM.md](CROSS-TEAM.md)** — Shared lessons across teammates
- **[PROTOCOL.md](PROTOCOL.md)** — Collaboration rules and handoff conventions
- **[TEMPLATE.md](TEMPLATE.md)** — Template for creating new teammates

See [TEMPLATE.md](TEMPLATE.md) for creating new teammates.
See [PROTOCOL.md](PROTOCOL.md) for collaboration rules.
