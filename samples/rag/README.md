# RAG Pipeline Sample

End-to-end Retrieval Augmented Generation: ingest local files, query the index, render context sections, and feed them to an LLM.

## Prerequisites

- Node.js 22.x or later
- An OpenAI API key (set as `OPENAI_API_KEY` environment variable)

```bash
npm install vectra openai
```

## Usage

1. Create a `my-docs/` folder with some text or markdown files to index.
2. Run the pipeline:

```bash
npx tsx rag-pipeline.ts
```

The script will:
- Create an index in `./rag-index/`
- Ingest all files from `./my-docs/`
- Query the index with a sample question
- Render context sections and send them to GPT-4o
- Print the LLM's answer

Edit the `question` variable in the script to try different queries.

## Learn More

- [RAG Pipeline tutorial](https://stevenic.github.io/vectra/tutorials/rag-pipeline)
- [Document Indexing guide](https://stevenic.github.io/vectra/documents)
- [Embeddings guide](https://stevenic.github.io/vectra/embeddings)
