# Vectra: local, file‑backed vector database for Node.js

## Overview
Vectra is a file‑backed, in‑memory vector database for Node.js. It works like a local [Pinecone](https://www.pinecone.io/)  [Qdrant](https://qdrant.tech/): each index is just a folder on disk with an `index.json` file containing vectors and any metadata fields you choose to index; all other metadata is stored per‑item as separate JSON files. Queries use a Pinecone‑compatible subset of [MongoDB‑style operators](https://www.mongodb.com/docs/manual/reference/operator/query/) for filtering, then rank matches by cosine similarity. Because the entire index is loaded into memory, lookups are extremely fast (often <1 ms for small indexes, commonly 1–2 ms for larger local sets). It’s ideal when you want simple, zero‑infrastructure retrieval over a small, mostly static corpus. Pinecone‑style namespaces aren’t built‑in, but you can mimic them by using separate folders (indexes).

Typical use cases:
- Prompt augmentation over a small, mostly static corpus
- Infinite few‑shot example libraries
- Single‑document or small multi‑document Q&A
- Local/dev workflows where hosted vector DBs are overkill

Table of contents
- [Why Vectra](#why-vectra)
- [When to use (and when not)](when-to-use-and-when-not)
- [Requirements](requirements)
- [Install](install)
- [Quick Start](quick-start)
  - [Path A: LocalIndex (items + metadata)](path-a-localindex-items--metadata)
  - [Path B: LocalDocumentIndex (documents + chunking + retrieval)](path-b-localdocumentindex-documents--chunking--retrieval)
- [CLI in 60 seconds](cli-in-60-seconds)
- [Core concepts](core-concepts)
  - [Index types](index-types)
  - [Metadata filtering (Pinecone-compatible subset)](metadata-filtering-pinecone-compatible-subset)
  - [Hybrid retrieval (documents)](hybrid-retrieval-documents)
  - [On-disk layout (language-agnostic)](on-disk-layout-language-agnostic)
- [File-backed vs in-memory usage](file-backed-vs-in-memory-usage)
- [Best practices](best-practices)
- [Performance and limits](performance-and-limits)
- [Troubleshooting (quick)](troubleshooting-quick)
- [Next steps](next-steps)
- [License](license)
- Project links
  - [CONTRIBUTING.md](https://github.com/Stevenic/vectra/blob/main/CONTRIBUTING.md)
  - [CODE_OF_CONDUCT.md](https://github.com/Stevenic/vectra/blob/main/CODE_OF_CONDUCT.md)
  - [LICENSE](https://github.com/Stevenic/vectra/blob/main/LICENSE)

## Why Vectra
- Zero infrastructure: everything lives in a local folder; no servers, clusters, or managed services required.
- Predictable local performance: full in‑memory scans with pre‑normalized cosine similarity deliver sub‑millisecond to low‑millisecond latency for small/medium corpora.
- Simple mental model: one folder per index; index.json holds vectors and indexed fields, while non‑indexed metadata is stored as per‑item JSON.
- Easy portability: because the format is file‑based and language‑agnostic, indexes can be written in one language and read in another.
- Pinecone‑style filtering: use a familiar subset of MongoDB query operators to filter by metadata before similarity ranking.
- Great for prompt engineering: quickly assemble and retrieve few‑shot examples or small static corpora without external dependencies.

## When to use (and when not)
Use Vectra when:
- You have a small, mostly static corpus (e.g., a few hundred to a few thousand chunks).
- You want zero‑infrastructure local retrieval with fast, predictable latency.
- You’re assembling “infinite few‑shot” example libraries or single/small document Q&A.
- You need portable, file‑based indexes that other languages can read/write.
- You want simple “namespaces” by using separate folders per dataset.

Avoid Vectra when:
- You need long‑term, ever‑growing chat memory or very large corpora (the entire index loads into RAM).
- You require multi‑tenant, networked, or horizontally scalable serving.
- You need advanced vector DB features like HNSW/IVF indexing, sharding/replication, or distributed operations.

Notes and tips:
- Mimic namespaces via separate index folders.
- Index only the metadata fields you’ll filter on; keep everything else in per‑item JSON.
- Rough sizing: a 1536‑dim float32 vector is ~6 KB, plus JSON/metadata overhead; size indexes accordingly to your RAM budget.

## Requirements
- Node.js 20.x or newer
- A package manager (npm or yarn)
- An embeddings provider for similarity search:
  - OpenAI (API key + model, e.g., text-embedding-3-large or compatible)
  - Azure OpenAI (endpoint, deployment name, API key)
  - OpenAI‑compatible OSS endpoint (model name + base URL)
- If you plan to ingest web pages via the CLI or API, outbound network access to those URLs
- Sufficient RAM to hold your entire index in memory during queries (see “Performance and limits”)

## Install
- npm: `npm install vectra`
- yarn: `yarn add vectra`

CLI usage
- Run without installing globally: `npx vectra --help`
- Optional global install: `npm install -g vectra` (then use `vectra --help`)

## Quick Start
Two common paths:
- Path A: you already have vectors (or can generate them) and want to store items + metadata.
- Path B: you have raw text documents; Vectra will chunk, embed, and retrieve relevant spans.

### Path A: LocalIndex (items + metadata)
- Create a folder‑backed index
- Choose which metadata fields to index (others are stored per‑item on disk)
- Insert items (vector + metadata)
- Query by vector with optional metadata filters

TypeScript example:
```ts
import path from 'node:path';
import { LocalIndex } from 'vectra';
import { OpenAI } from 'openai';

// 1) Create an index folder
const index = new LocalIndex(path.join(process.cwd(), 'my-index'));

// 2) Create the index (set which metadata fields you want searchable)
if (!(await index.isIndexCreated())) {
  await index.createIndex({
    version: 1,
    metadata_config: { indexed: ['category'] }, // only these fields live in index.json; others go to per-item JSON
  });
}

// 3) Prepare an embeddings helper (use any provider you like)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
async function getVector(text: string): Promise<number[]> {
  const resp = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return resp.data[0].embedding;
}

// 4) Insert items
await index.insertItem({
  vector: await getVector('apple'),
  metadata: { text: 'apple', category: 'food', note: 'stored on disk if not indexed' },
});
await index.insertItem({
  vector: await getVector('blue'),
  metadata: { text: 'blue', category: 'color' },
});

// 5) Query by vector, optionally filter by metadata
async function query(text: string) {
  const v = await getVector(text);
  // Signature: queryItems(vector, queryString, topK, filter?)
  const results = await index.queryItems(v, '', 3, { category: { $eq: 'food' } });
  for (const r of results) {
    console.log(r.score.toFixed(4), r.item.metadata.text);
  }
}

await query('banana'); // should surface 'apple' in top results
```

Supported filter operators (subset): $and, $or, $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin. Only fields listed in metadata_config.indexed are stored inline and should be used for filtering (everything else is kept per‑item on disk).

### Path B: LocalDocumentIndex (documents + chunking + retrieval)
- Create a document index backed by an embeddings model
- Add documents (raw strings, files, or URLs)
- Query by text; Vectra returns the most relevant chunks grouped by document
- Render top sections for direct drop‑in to prompts
- Optional hybrid retrieval: add BM25 keyword matches alongside semantic matches

TypeScript example:
```ts
import path from 'node:path';
import { LocalDocumentIndex, OpenAIEmbeddings } from 'vectra';

// 1) Configure embeddings (OpenAI, Azure OpenAI, or OpenAI‑compatible OSS)
const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'text-embedding-3-small',
  maxTokens: 8000, // batching limit for chunked requests
});

// 2) Create the index
const docs = new LocalDocumentIndex({
  folderPath: path.join(process.cwd(), 'my-doc-index'),
  embeddings,
  // optional: customize chunking
  // chunkingConfig: { chunkSize: 512, chunkOverlap: 0, keepSeparators: true }
});

if (!(await docs.isIndexCreated())) {
  await docs.createIndex({ version: 1 });
}

// 3) Add a document (string); you can also add files/URLs via FileFetcher/WebFetcher or the CLI
const uri = 'doc://welcome';
const text = `
Vectra is a file-backed, in-memory vector DB for Node.js. It supports Pinecone-like metadata filtering
and fast local retrieval. It’s ideal for small, mostly static corpora and prompt augmentation.
`;
await docs.upsertDocument(uri, text, 'md'); // optional docType hints chunking

// 4) Query and render sections for your prompt
const results = await docs.queryDocuments('What is Vectra best suited for?', {
  maxDocuments: 5,
  maxChunks: 20,
  // isBm25: true, // turn on hybrid (semantic + keyword) retrieval
});

// Take top document and render spans of text
if (results.length > 0) {
  const top = results[0];
  console.log('URI:', top.uri, 'score:', top.score.toFixed(4));
  const sections = await top.renderSections(2000, 1, true); // maxTokens per section, number of sections
  for (const s of sections) {
    console.log('Section score:', s.score.toFixed(4), 'tokens:', s.tokenCount, 'bm25:', s.isBm25);
    console.log(s.text);
  }
}
```

Notes:
- queryDocuments returns LocalDocumentResult objects, each with scored chunks. renderSections merges adjacent chunks, keeps within your token budget, and can optionally add overlapping context for readability.
- Hybrid retrieval: set isBm25: true in queryDocuments to include keyword‑based chunks (Okapi‑BM25) alongside semantic chunks. Each rendered section includes isBm25 to help you distinguish them.

## CLI in 60 seconds
Three steps: create → add → query. No servers, just a folder.

1) Create an index folder
```sh
npx vectra create ./my-doc-index
# or, after global install:
# vectra create ./my-doc-index
```

2) Add documents (URLs or local files)
- Prepare a keys.json for your embeddings provider.

OpenAI example:
```json
{
  "apiKey": "sk-...",
  "model": "text-embedding-3-small",
  "maxTokens": 8000
}
```

Azure OpenAI example:
```json
{
  "azureApiKey": "xxxxx",
  "azureEndpoint": "https://your-resource-name.openai.azure.com",
  "azureDeployment": "your-embedding-deployment",
  "azureApiVersion": "2023-05-15",
  "maxTokens": 8000
}
```

OpenAI‑compatible OSS example:
```json
{
  "ossModel": "text-embedding-3-small",
  "ossEndpoint": "https://your-oss-endpoint.example.com",
  "maxTokens": 8000
}
```

Add a single URL:
```sh
npx vectra add ./my-doc-index --keys ./keys.json --uri https://example.com/page
```

Add multiple URLs or files:
```sh
# multiple --uri flags
npx vectra add ./my-doc-index --keys ./keys.json \
  --uri https://example.com/page1 \
  --uri https://example.com/page2 \
  --uri ./local-docs/guide.md

# from a list file (one URL or file path per line)
npx vectra add ./my-doc-index --keys ./keys.json --list ./uris.txt
```

Useful flags:
- --cookie "<cookie string>" to pass auth/session cookies for web pages
- --chunk-size 512 to adjust chunking during ingestion

3) Query the index
```sh
# Basic query: returns top documents and renders top sections
npx vectra query ./my-doc-index "What is Vectra best suited for?" --keys ./keys.json
```

Tune output:
```sh
# return up to 3 documents, render 1 section with up to 1200 tokens
npx vectra query ./my-doc-index "hybrid retrieval" \
  --keys ./keys.json \
  --document-count 3 \
  --chunk-count 50 \
  --section-count 1 \
  --tokens 1200 \
  --format sections \
  --overlap true \
  --bm25 true
```

Other commands
- Remove documents by URI:
```sh
npx vectra remove ./my-doc-index --uri https://example.com/page
# or from a list file
npx vectra remove ./my-doc-index --list ./uris.txt
```

- Print index stats:
```sh
npx vectra stats ./my-doc-index
```

- For a full list of commands:
```sh
npx vectra --help
```

## Core concepts
Vectra keeps a simple, portable model: indexes live as folders on disk, but are fully loaded into memory at query time. You choose whether to work at the “item” level (you supply vectors + metadata) or the “document” level (Vectra chunks, embeds, and retrieves).

### Index types
- LocalIndex
  - You bring vectors and metadata.
  - Configure which metadata fields to “index” (kept inline in index.json) vs store per‑item in external JSON.
  - Query by vector with optional metadata filtering; results return items sorted by cosine similarity.
- LocalDocumentIndex
  - You bring raw text (strings, files, or URLs).
  - Vectra splits text into chunks, generates embeddings (via your configured provider), stores chunk metadata (documentId, startPos, endPos), and persists the document body to disk.
  - Query by text; results are grouped per document with handy methods to render scored spans for prompts.

Both are folder‑backed and portable: any language can read/write the on‑disk format.

### Metadata filtering (Pinecone-compatible subset)
- Filters are evaluated before similarity ranking using a subset of MongoDB‑style operators:
  - Logical: $and, $or
  - Comparison: $eq, $ne, $gt, $gte, $lt, $lte
  - Sets/strings: $in, $nin
- Indexed vs non‑indexed fields
  - Fields listed in metadata_config.indexed are stored inline in index.json and are ideal for filtering.
  - All other metadata is stored in a per‑item JSON file on disk to keep index.json small.
  - Trade‑off: indexing more fields speeds filtering but increases index.json size.

### Hybrid retrieval (documents)
- LocalDocumentIndex supports semantic retrieval by embeddings and optional keyword retrieval via Okapi‑BM25.
- Enable BM25 per query (isBm25: true) to blend in strong keyword matches alongside semantic chunks.
- Results and rendered sections flag BM25 spans so you can treat them differently in prompts if desired.

### On-disk layout (language-agnostic)
- index.json
  - version, metadata_config, and an array of items (id, vector, norm, metadata, optional metadataFile).
  - For documents, items are chunk entries with metadata including documentId, startPos, endPos (and optional user metadata).
- Per‑item metadata (.json)
  - When you choose not to index some fields, full metadata is stored in a separate JSON file (referenced by metadataFile).
- Documents
  - Each document body is saved as <documentId>.txt.
  - Optional document‑level metadata is saved as <documentId>.json.
  - A catalog.json maps uri ↔ id and tracks counts (portable and easy to inspect/version).

## File-backed vs in-memory usage
Vectra uses a single, consistent model: indexes persist as files/folders on disk, but are fully loaded into memory for filtering and similarity ranking.

- Persistent usage
  - Choose a stable folder and reuse it across runs.
  - Create the index once, then upsert/insert items or documents incrementally.
  - Example: ./my-doc-index checked into your project or stored on a local volume.

- Ephemeral usage
  - Use a temporary directory per run and rebuild from source content.
  - Useful for CI, notebooks, or demos where rebuild cost is low and determinism is desirable.
  - Tip: pass deleteIfExists: true on createIndex to reset quickly.

Example:
```ts
import path from 'node:path';
import os from 'node:os';
import { LocalIndex } from 'vectra';

const folderPath = process.env.PERSISTENT_INDEX_DIR
  ? process.env.PERSISTENT_INDEX_DIR
  : path.join(os.tmpdir(), 'vectra-ephemeral');

const index = new LocalIndex(folderPath);
await index.createIndex({
  version: 1,
  deleteIfExists: !process.env.PERSISTENT_INDEX_DIR, // reset if ephemeral
  metadata_config: { indexed: ['category'] },
});
```

## Best practices
- Index only what you filter on
  - Put frequently used filter fields in metadata_config.indexed to keep index.json small but filterable.
  - Store everything else in per‑item JSON (automatically handled).

- Use separate folders as namespaces
  - Mimic Pinecone namespaces by creating one index folder per dataset or tenant.

- Batch writes when possible
  - Prefer batchInsertItems for item‑level bulk adds; it applies all‑or‑nothing and avoids partial updates.
  - For document flow, add/remove documents via upsertDocument/deleteDocument which wrap begin/end updates for you.

- Respect the update lock
  - If you manage updates manually, call beginUpdate → multiple insert/delete → endUpdate.
  - Avoid overlapping updates; calling beginUpdate twice throws.

- Choose chunk sizes sensibly (documents)
  - Default chunkSize 512 tokens with 0 overlap is a good starting point.
  - If queries are long or context is important, consider modest overlap; keep chunkSize under your embedding provider’s maxTokens per request batch.
  - KeepSeparators: true preserves natural boundaries for better section rendering.

- Tune retrieval to your data
  - For exact phrases or code terms, enable hybrid retrieval (isBm25: true) to add keyword matches to semantic results.
  - Render sections with a realistic token budget for your target LLM; 1000–2000 tokens per section is common.

- Keep vectors consistent
  - Use the same embedding model/dimensions across an index.
  - Re‑embed and rebuild if you change models.

- Be mindful of memory
  - The entire index is loaded into RAM; estimate vector + metadata size and stay within budget.
  - Consider multiple smaller indexes instead of one giant index if you have distinct corpora.

## Performance and limits
- How it searches
  - Linear scan over all items with cosine similarity; vectors are pre‑normalized and each item caches its norm.
  - Results are sorted by similarity and truncated to topK.
  - Hybrid mode (documents) optionally adds BM25 keyword matches after the semantic pass.

- Typical latency
  - Small indexes: often <1 ms per query.
  - Medium local corpora: commonly 1–2 ms; depends on CPU, vector dimensionality, and metadata filtering cost.
  - BM25 adds a small overhead proportional to the number of non‑selected chunks it evaluates.

- Memory model
  - Entire index is loaded into RAM for querying.
  - Rule‑of‑thumb sizing per vector (Node.js in‑memory):
    - number[] uses ~8 bytes per element (JS double) + array/object overhead.
    - Example: 1536‑dim vector ≈ ~12 KB for raw numbers, plus per‑item metadata/object overhead.
  - On disk, JSON is larger than binary; index.json contains vectors and indexed metadata, while non‑indexed metadata is stored per‑item as separate JSON files.

- Choose dimensions and fields wisely
  - Use the smallest embedding dimensionality that meets quality requirements.
  - Index only fields you actually filter on to keep index.json smaller and reduce load/parse time.

- Limits and cautions
  - Not intended for large, ever‑growing chat memories or multi‑million‑item corpora.
  - Very large indexes mean high RAM usage and longer JSON (de)serialization times at startup.
  - Sorting all distances is O(n log n); keep n within practical bounds for your machine.
  - Embedding generation is external to Vectra; rate limits and throughput depend on your provider and model.
  - Web ingestion depends on site availability/format; use --cookie if needed and respect robots/terms.

## Troubleshooting (quick)
- Missing/invalid embeddings config
  - Symptom: “Embeddings model not configured.” or provider errors.
  - Fix: For code, pass an OpenAIEmbeddings instance. For CLI, supply a valid keys.json:
    - OpenAI: { "apiKey": "...", "model": "text-embedding-3-small", "maxTokens": 8000 }
    - Azure OpenAI: { "azureApiKey": "...", "azureEndpoint": "https://...", "azureDeployment": "...", "azureApiVersion": "2023-05-15" }
    - OSS: { "ossModel": "text-embedding-3-small", "ossEndpoint": "https://..." }

- Rate limits/timeouts when embedding
  - Symptom: “rate_limited” or provider errors.
  - Fix: Reduce batch size (chunkSize), add delay/retries (OpenAIEmbeddings has retryPolicy), or upgrade your plan.

- Index already exists
  - Symptom: “Index already exists”.
  - Fix: Pass deleteIfExists: true to createIndex, or call deleteIndex first.

- Index not found
  - Symptom: “Index does not exist”.
  - Fix: Call isIndexCreated() and createIndex() before using the index.

- Update lock misuse
  - Symptom: “Update already in progress” (double begin) or “No update in progress” (end without begin).
  - Fix: Pair beginUpdate → insert/delete → endUpdate. Prefer batchInsertItems or helper methods (upsertDocument) to avoid manual locking.

- Filters return no results
  - Symptom: Expected items aren’t matched by metadata filter.
  - Fix: Only fields listed in metadata_config.indexed are filterable inline. Ensure the field is included at index creation and that your operators/values ($eq, $in, etc.) match actual data types.

- Dimension mismatch or NaNs
  - Symptom: Weird scores or NaN.
  - Fix: Keep a single embedding model/dimension per index; re‑embed and rebuild if you change models.

- Node/environment issues
  - Symptom: Runtime errors on fs or syntax.
  - Fix: Use Node 20.x+, verify file permissions and paths. For local storage, ensure the target folder exists/permissions allow write.

- Corrupt/invalid JSON on disk
  - Symptom: JSON parse errors reading index.json or metadata files.
  - Fix: Recreate the index (deleteIfExists: true) and re‑ingest, or restore from a clean copy.

- Web fetching problems (CLI)
  - Symptom: “invalid content type” or 4xx/5xx.
  - Fix: Use --cookie for authenticated pages; ensure URL is reachable and returns text/html or other allowed types.

- BM25 returns nothing
  - Symptom: No keyword chunks added.
  - Fix: Ensure isBm25: true at query time and a non‑empty query string. Remember only topK BM25 results are blended in after semantic selection.

## Next steps
- Explore the APIs
  - LocalIndex: item‑level vectors + metadata (createIndex, insertItem, batchInsertItems, queryItems, listItemsByMetadata)
  - LocalDocumentIndex: document ingestion + chunking + retrieval (upsertDocument, queryDocuments, listDocuments, renderSections)
  - OpenAIEmbeddings: OpenAI/Azure/OSS embeddings helper (createEmbeddings, retryPolicy, maxTokens)
  - Utilities: TextSplitter, FileFetcher, WebFetcher, storage backends (LocalFileStorage, VirtualFileStorage)
- Revisit the Quick Start
  - Path A (items): see section 6.1
  - Path B (documents): see section 6.2
- CLI reference
  - npx vectra --help
  - Create, add, query, stats, remove (see section 7 for examples)
- Other language bindings
  - Python: vectra-py — https://github.com/BMS-geodev/vectra-py
- Get involved
  - Issues and feature requests: https://github.com/Stevenic/vectra/issues
  - Contributing guide: ./CONTRIBUTING.md
  - Code of Conduct: ./CODE_OF_CONDUCT.md

## License
Vectra is open‑source software licensed under the MIT License.

- Full text: [LICENSE](https://github.com/Stevenic/vectra/blob/main/LICENSE)
- Contributions: By submitting a contribution, you agree it will be licensed under the MIT License. See [CONTRIBUTING](https://github.com/Stevenic/vectra/blob/main/CONTRIBUTING.md)
- Community standards: Please review our [CODE_OF_CONDUCT](https://github.com/Stevenic/vectra/blob/main/CODE_OF_CONDUCT.md)