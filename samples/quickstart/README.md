# Quickstart Samples

Minimal examples showing both Vectra index types.

## Prerequisites

- Node.js 22.x or later
- An OpenAI API key (set as `OPENAI_API_KEY` environment variable)

```bash
npm install vectra openai
```

## LocalIndex (items + metadata)

Low-level index where you manage vectors yourself. Best for pre-computed embeddings or custom pipelines.

```bash
npx tsx local-index.ts
```

See [local-index.ts](./local-index.ts) for the full source.

## LocalDocumentIndex (documents + chunking + retrieval)

High-level index that handles chunking, embedding, and section rendering. Best for RAG workflows.

```bash
npx tsx doc-index.ts
```

See [doc-index.ts](./doc-index.ts) for the full source.

## Learn More

- [Getting Started guide](https://stevenic.github.io/vectra/getting-started)
- [Core Concepts](https://stevenic.github.io/vectra/core-concepts)
- [Embeddings Guide](https://stevenic.github.io/vectra/embeddings)
