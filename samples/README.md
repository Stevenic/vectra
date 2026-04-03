# Vectra Samples

Runnable examples covering the main Vectra features. Each sample has its own README with setup instructions.

## Samples

| Sample | Description | API Key Required |
|--------|-------------|:----------------:|
| [quickstart](./quickstart/) | Minimal LocalIndex and LocalDocumentIndex examples | Yes (OpenAI) |
| [rag](./rag/) | End-to-end RAG pipeline: ingest → query → render → LLM | Yes (OpenAI) |
| [browser](./browser/) | Browser-based semantic search with IndexedDB + TransformersEmbeddings | No |
| [custom-storage](./custom-storage/) | Implement the FileStorage interface with SQLite | Yes (OpenAI) |
| [grpc-python](./grpc-python/) | Python gRPC client for cross-language access | Yes (OpenAI) |
| [folder-watcher](./folder-watcher/) | Auto-sync a folder to an index (CLI and library) | Yes (OpenAI)* |
| [wikipedia](./wikipedia/) | Build a document index from Wikipedia using the CLI | Yes (OpenAI) |

\* The folder-watcher sample includes an offline variant using `LocalEmbeddings` that requires no API key.

## Getting an API Key

Samples that require an OpenAI key need the `OPENAI_API_KEY` environment variable set:

```bash
export OPENAI_API_KEY=sk-...
```

Generate a key in the [OpenAI Developer Portal](https://platform.openai.com/api-keys).

## Running TypeScript Samples

All TypeScript samples use top-level `await` and can be run with [tsx](https://github.com/privatenumber/tsx):

```bash
npx tsx <script>.ts
```

## Learn More

- [Getting Started guide](https://stevenic.github.io/vectra/getting-started)
- [Tutorials](https://stevenic.github.io/vectra/tutorials/)
- [Full documentation](https://stevenic.github.io/vectra/)
