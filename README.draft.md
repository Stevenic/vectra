# Vectra

- A local, file-backed vector database for Node.js with Pinecone-like features and zero external infrastructure. Each index is a folder on disk, loaded into memory for ultra-fast queries.

- Key features
  - Local, file-backed vector database for Node.js
  - In-memory search with cosine similarity (pre-normalized vectors for speed)
  - Metadata filtering (Pinecone-compatible Mongo-style operators)
  - Document indexing with chunking and optional hybrid BM25 keyword search
  - Simple CLI and TypeScript API

- When to use Vectra (and when not)
  - Great for small, mostly static corpora; few-shot examples; single-document Q&A
  - Not suited for long-term, ever-growing chat memory (entire index loads into RAM)
  - Mimic namespaces by using separate folders (one index per folder)

- Language agnostic file format note (indices can be read/written by any language)
  - Indexes are plain JSON and text files on disk; while this package targets Node.js, any language can read/write the folder format.

## Requirements

- Node.js >= 20.x
- NPM or Yarn
- An embeddings provider (OpenAI, Azure OpenAI, or any OpenAI-compatible OSS endpoint)

## Installation

- Library
  - npm install vectra
- CLI
  - Use via npx: npx vectra --help
  - Or install globally: npm install -g vectra

## Quick Start (5 minutes)

### Choose your path

- Option A: Vector Item Index (LocalIndex) — store your own vectors + metadata; run similarity + metadata filters
- Option B: Document Index (LocalDocumentIndex) — chunk raw documents, store on disk, query via embeddings; render relevant sections

### A. LocalIndex (items + metadata)

- Steps
  1) Create an index folder and initialize
  2) Generate embeddings (any provider) and insert items with metadata
  3) Query by vector with optional metadata filter; get topK sorted by similarity

- Example (code)

```ts
import path from 'node:path';
import { LocalIndex } from 'vectra';
import { OpenAI } from 'openai';

const indexPath = path.join(process.cwd(), 'my-localindex');
const index = new LocalIndex(indexPath);

async function ensureIndex() {
  if (!(await index.isIndexCreated())) {
    await index.createIndex({
      version: 1,
      metadata_config: { indexed: ['category'] } // index only fields you need to filter on
    });
  }
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

async function getVector(text: string) {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text
  });
  return res.data[0].embedding;
}

async function addItem(id: string, text: string, category?: string) {
  await index.insertItem({
    id,
    vector: await getVector(text),
    metadata: { text, category }
  });
}

async function main() {
  await ensureIndex();

  await addItem('1', 'apple', 'food');
  await addItem('2', 'oranges', 'food');
  await addItem('3', 'red', 'color');
  await addItem('4', 'blue', 'color');

  const queryVec = await getVector('banana');
  const results = await index.queryItems(queryVec, '', 3); // vector, namespace (unused), topK, [optional filter]

  for (const r of results) {
    console.log(`[${r.score.toFixed(3)}] ${r.item.metadata.text}`);
  }

  // With metadata filter (e.g., only colors)
  const colorResults = await index.queryItems(queryVec, '', 3, { category: { $eq: 'color' } });
  console.log('Only colors:');
  for (const r of colorResults) {
    console.log(`[${r.score.toFixed(3)}] ${r.item.metadata.text}`);
  }
}

main().catch(console.error);
```

### B. LocalDocumentIndex (documents + chunking + retrieval)

- Steps
  1) Configure embeddings via OpenAIEmbeddings (OpenAI, Azure OpenAI, or OSS)
  2) Create index and add documents (from strings, files, or web pages)
  3) Query documents and render top sections

- Example (code)

```ts
import path from 'node:path';
import { LocalDocumentIndex, OpenAIEmbeddings } from 'vectra';

const folderPath = path.join(process.cwd(), 'my-docindex');

const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'text-embedding-3-small',
  // optional: dimensions, requestConfig, retryPolicy, etc.
});

const docIndex = new LocalDocumentIndex({
  folderPath,
  embeddings,
  chunkingConfig: { chunkSize: 512 } // tokens per chunk
});

async function setup() {
  await docIndex.createIndex({ version: 1, deleteIfExists: true });
  await docIndex.upsertDocument(
    'doc://getting-started',
    `
      Vectra is a local vector DB for Node.js.
      It supports metadata filtering and blazing-fast in-memory search.
      Great for small, mostly static corpora.
    `,
    'md'
  );
}

async function search() {
  const results = await docIndex.queryDocuments('How do I use Vectra for small corpora?', {
    maxDocuments: 5,
    maxChunks: 50,
    isBm25: false // set true for hybrid keyword+semantic retrieval
  });

  for (const doc of results) {
    console.log(`\nURI: ${doc.uri} (score: ${doc.score.toFixed(3)})`);
    const sections = await doc.renderSections(800, 1, true); // tokens, section count, overlap
    for (const s of sections) {
      console.log(`Tokens: ${s.tokenCount}, Section score: ${s.score.toFixed(3)}`);
      console.log(s.text.trim());
    }
  }
}

setup().then(search).catch(console.error);
```

## CLI

- Installation
  - Global: npm install -g vectra
  - One-off: npx vectra --help

- keys.json formats
  - OpenAI
    {
      "apiKey": "sk-...",
      "model": "text-embedding-3-small"
      // optional: "organization": "org_...", "endpoint": "https://api.openai.com",
      // optional: "dimensions": 1536, "logRequests": false, "maxTokens": 8000,
      // optional: "retryPolicy": [2000, 5000], "requestConfig": { "timeout": 60000 }
    }
    - Note: If you omit model when using the CLI, it defaults to "text-embedding-ada-002" (with maxTokens 8000).
  - Azure OpenAI
    {
      "azureApiKey": "<YOUR_AZURE_OPENAI_KEY>",
      "azureEndpoint": "https://<your-resource-name>.openai.azure.com",
      "azureDeployment": "<your-deployment-name>",
      "azureApiVersion": "2023-05-15",
      // optional: "dimensions": 1536, "logRequests": false, "maxTokens": 8000,
      // optional: "retryPolicy": [2000, 5000], "requestConfig": { "timeout": 60000 }
    }
  - OSS (OpenAI-compatible)
    {
      "ossEndpoint": "https://api.your-oss-endpoint.com",
      "ossModel": "text-embedding-3-small",
      // optional: "dimensions": 1536, "logRequests": false, "maxTokens": 8000,
      // optional: "retryPolicy": [2000, 5000], "requestConfig": { "timeout": 60000 }
    }

- Commands
  - vectra create <index>
    - Create a new local document index (folder). Overwrite with --deleteIfExists via API; CLI create always creates a fresh catalog.
    - Example: npx vectra create ./my-docindex
  - vectra delete <index>
    - Delete an existing document index folder.
    - Example: npx vectra delete ./my-docindex
  - vectra add <index> --keys keys.json [--uri <url-or-file> ...] [--list file] [--cookie str] [--chunk-size N]
    - Add one or more web pages or local files to the index. Auto-detects http/https vs file path.
    - Example (single URL): npx vectra add ./my-docindex --keys keys.json --uri https://example.com/docs/intro
    - Example (local file): npx vectra add ./my-docindex --keys keys.json --uri ./docs/guide.md
    - Example (list file): npx vectra add ./my-docindex --keys keys.json --list urls.txt
    - Example (with cookie): npx vectra add ./my-docindex --keys keys.json --uri https://site.com/protected --cookie "sessionid=abc; other=xyz"
    - Example (custom chunk size): npx vectra add ./my-docindex --keys keys.json --uri https://example.com --chunk-size 512
  - vectra remove <index> --uri <uri> [--list file]
    - Remove one or more documents (by stored URI) from the index.
    - Example: npx vectra remove ./my-docindex --uri https://example.com/docs/intro
    - Example (list): npx vectra remove ./my-docindex --list uris-to-remove.txt
  - vectra stats <index>
    - Print catalog stats (version, doc count, etc.).
    - Example: npx vectra stats ./my-docindex
  - vectra query <index> "<query>" --keys keys.json [--document-count N] [--chunk-count N] [--section-count N] [--tokens N] [--format sections|stats|chunks] [--overlap] [--bm25]
    - Query the index and render results.
    - Example (default sections view): npx vectra query ./my-docindex "how do I get started?" --keys keys.json
    - Example (limit docs/sections/tokens): npx vectra query ./my-docindex "hybrid search" --keys keys.json --document-count 5 --section-count 2 --tokens 800
    - Example (show chunks): npx vectra query ./my-docindex "metadata filtering" --keys keys.json --format chunks
    - Example (enable hybrid keyword+semantic): npx vectra query ./my-docindex "install steps" --keys keys.json --bm25

## Data Model & On-Disk Layout

- Index folder structure overview
  - A Vectra index is a single folder on disk you choose.
  - Core files
    - index.json — the in-memory index snapshot (vectors + selected metadata + config).
    - For item/document payloads
      - <id>.json — non-indexed metadata for an item or document.
      - <id>.txt — raw document text when using LocalDocumentIndex.

- LocalIndex
  - index.json contents (high level)
    - version — schema/versioning number.
    - metadata_config — which metadata fields are stored in-memory for filtering (indexed).
    - items — array of items:
      - id — your ID (or auto-generated if omitted).
      - vector — numeric array embedding.
      - norm — precomputed vector norm for fast cosine similarity.
      - metadata — only the fields listed in metadata_config.indexed.
  - Non-indexed metadata
    - Stored separately as <id>.json on disk.
    - At query time, Vectra filters first by the in-memory indexed metadata. If a filter refers to a field not present in memory, Vectra may read the item’s metadata file to evaluate the filter.
  - Namespaces
    - Not directly supported; create a separate folder per “namespace”.

- LocalDocumentIndex
  - What’s stored
    - index.json — embedding vectors and metadata for document chunks and catalog info.
    - <id>.txt — full document text (enables section rendering and context extraction).
    - <id>.json — additional document-level metadata you provide (optional).
  - Document identity
    - Documents are addressed by a URI you supply (e.g., https://example.com/page or doc://my-doc).
    - Internally, Vectra uses an ID to store files (<id>.txt/.json) and tracks the URI↔ID mapping in the index.
  - Chunk metadata
    - startPos and endPos — byte or character offsets into the <id>.txt content for the chunk.
    - Optional flags (e.g., isBm25) used for hybrid retrieval.
  - Chunking
    - Documents are split into token-based chunks using a configurable chunk size and optional overlap logic when rendering.

## Search & Filtering

- Similarity
  - Cosine similarity with pre-normalized vectors for speed.
  - For LocalIndex: all items are filtered by metadata first, then scored and returned sorted by similarity.
  - For LocalDocumentIndex: chunk-level scoring aggregates into document-level results.

- Metadata filters (Pinecone-compatible subset)
  - Logical operators: $and, $or
  - Comparison operators: $eq, $ne, $gt, $gte, $lt, $lte
  - Set operators: $in, $nin
  - Filters apply to fields defined in metadata_config.indexed; non-indexed fields are stored per-item/per-doc in <id>.json and may be read during filtering when needed.

- Hybrid search (BM25) for documents
  - Optional keyword scoring combined with semantic matches to improve recall.
  - Enable via CLI flag --bm25 or corresponding API options when querying LocalDocumentIndex.

- Result rendering
  - LocalDocumentResult
    - renderSections(maxTokens, maxSections, overlap?): returns top sections with aggregated scores; can optionally include overlapping chunks.
    - renderAllSections(maxTokens): renders all matched spans split into sections up to maxTokens each.
  - Sections include token counts and per-section scores, enabling easy prompt assembly.

## API Overview

- Core exports
  - LocalIndex
  - LocalDocumentIndex
  - LocalDocument
  - LocalDocumentResult
  - OpenAIEmbeddings
  - TextSplitter
  - ItemSelector
  - FileFetcher, WebFetcher
  - GPT3Tokenizer
  - types (shared type definitions)

- LocalIndex (vectors + metadata)
  - Purpose: Store your own vectors and metadata; run cosine similarity + metadata filters in-memory.
  - Key methods
    - createIndex(options?: { version?: number; deleteIfExists?: boolean; metadata_config?: { indexed?: string[] } })
    - isIndexCreated(): Promise<boolean>
    - getIndexStats(): Promise<{ version: number; metadata_config: object; items: number }>
    - insertItem(item: { id?: string; vector: number[]; metadata?: Record<string, any> }): Promise<IndexItem>
    - batchInsertItems(items: Partial<IndexItem>[]): Promise<IndexItem[]>
    - deleteItem(id: string): Promise<void>
    - listItems(): Promise<IndexItem[]>
    - listItemsByMetadata(filter: MetadataFilter): Promise<IndexItem[]>
    - getItem(id: string): Promise<IndexItem | undefined>
    - queryItems(vector: number[], namespace: string, topK: number, filter?: MetadataFilter): Promise<Array<{ item: IndexItem; score: number }>>
    - beginUpdate(): Promise<void> / endUpdate(): Promise<void> (optional batching and atomic save)
  - Notes
    - metadata_config.indexed controls which fields are kept in-memory for fast filtering.
    - Non-indexed metadata is stored as <id>.json and may be read during filtering.

- LocalDocumentIndex (document chunking + retrieval)
  - Purpose: Ingest raw documents (strings, files, web pages), chunk and embed them, then query by text.
  - Constructor options
    - { folderPath: string; embeddings?: EmbeddingsModel; chunkingConfig?: { chunkSize?: number; chunkOverlap?: number; docType?: string } }
  - Key methods
    - createIndex(options?: { version?: number; deleteIfExists?: boolean }): Promise<void>
    - deleteIndex(): Promise<void>
    - getCatalogStats(): Promise<any>
    - upsertDocument(uri: string, text: string, docType?: string): Promise<void>
    - deleteDocument(uri: string): Promise<void>
    - queryDocuments(query: string, options?: { maxDocuments?: number; maxChunks?: number; isBm25?: boolean }): Promise<LocalDocumentResult[]>

- LocalDocument
  - Properties: id, uri, folderPath
  - Methods
    - getLength(): Promise<number>
    - hasMetadata(): Promise<boolean>
    - loadMetadata(): Promise<Record<string, any>>
    - loadText(): Promise<string>

- LocalDocumentResult (extends LocalDocument)
  - Properties
    - chunks: QueryResult<DocumentChunkMetadata>[]
    - score: number (average score across matching chunks)
  - Methods
    - renderSections(maxTokens: number, maxSections: number, overlap?: boolean): Promise<DocumentTextSection[]>
    - renderAllSections(maxTokens: number): Promise<DocumentTextSection[]>

- OpenAIEmbeddings
  - Purpose: Generate embeddings via OpenAI, Azure OpenAI, or an OSS OpenAI-compatible endpoint.
  - Constructors
    - OpenAI: { apiKey: string; model: string; organization?, endpoint?, dimensions?, logRequests?, maxTokens?, retryPolicy?, requestConfig? }
    - Azure: { azureApiKey: string; azureEndpoint: string; azureDeployment: string; azureApiVersion?, dimensions?, logRequests?, maxTokens?, retryPolicy?, requestConfig? }
    - OSS: { ossEndpoint: string; ossModel: string; dimensions?, logRequests?, maxTokens?, retryPolicy?, requestConfig? }
  - Methods
    - createEmbeddings(input: string | string[]): Promise<{ status: 'success'|'error'|'rate_limited'; output?: number[][]; message?: string }>

- TextSplitter
  - Purpose: Token-aware splitting by separators with configurable chunk size and overlap.
  - Constructor config
    - { separators?: string[]; keepSeparators?: boolean; chunkSize?: number; chunkOverlap?: number; tokenizer?: Tokenizer; docType?: string }
  - Methods
    - split(text: string): TextChunk[]

- ItemSelector
  - Static helpers
    - cosineSimilarity(a: number[], b: number[]): number
    - normalizedCosineSimilarity(a: number[], normA: number, b: number[], normB: number): number
    - select(metadata: Record<string, any>, filter: MetadataFilter): boolean

- Fetchers and utilities
  - FileFetcher: Read local files and infer docType.
  - WebFetcher: Fetch and clean webpages (supports custom headers like cookies).
  - GPT3Tokenizer: Default tokenizer used for chunking.

- Types (high level)
  - IndexItem: { id: string; vector: number[]; norm: number; metadata: Record<string, any>; metadataFile?: string }
  - MetadataFilter: Mongo/Pinecone-style filter object ($and, $or, $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin)
  - TextChunk: { text: string; tokens: number[]; startPos: number; endPos: number; startOverlap: number[]; endOverlap: number[] }
  - QueryResult<T>: { item: { id: string; metadata: T }; score: number }
  - DocumentChunkMetadata: { startPos: number; endPos: number; isBm25?: boolean }
  - DocumentTextSection: { text: string; tokenCount: number; score: number; isBm25: boolean }

## Performance & Limits

- In-memory design
  - Entire index.json is loaded into memory for ultra-fast filtering and cosine scoring.
  - Linear scan with pre-normalized vectors keeps per-query latency low for small to medium corpora.

- Typical latency
  - Small indexes: often sub-millisecond on a modern laptop.
  - Medium indexes: commonly 1–2ms per query.
  - Note: No ANN/approximate indexing; performance scales linearly with item count and vector dimension.

- Memory footprint (rule of thumb)
  - Roughly items × dims × 8 bytes for vectors (JavaScript numbers are 64-bit) + per-item metadata overhead + norms.
  - Example: 50k items × 1536 dims ≈ ~600 MB just for vectors (plus overhead).
  - Keep indexes modest; consider separate folders to partition data.

- DocumentIndex specifics
  - Adds .txt bodies on disk and chunk metadata in index.json.
  - Query time aggregates chunk scores to document results and supports optional BM25.

- Concurrency and durability
  - beginUpdate/endUpdate guards against concurrent writes; endUpdate writes atomically to index.json.
  - Batch operations are faster and safer than many small writes.

- Not for growing chat memory
  - Because everything lives in RAM, use Vectra for small, mostly static corpora. For large or ever-growing datasets, use a hosted vector DB.

## Best Practices

- Use separate folders to mimic namespaces
  - Create one index folder per logical dataset (e.g., ./indexes/support, ./indexes/blog). This keeps memory usage predictable and lets you target queries precisely.

- Index only metadata fields you need for filtering
  - Configure metadata_config.indexed with the minimal set of fields you’ll filter on. This keeps index.json small and speeds up filtering; store everything else in the per-item .json files.

- Batch inserts and use beginUpdate/endUpdate for bulk changes
  - For many writes, call beginUpdate(), perform your inserts/deletes, then endUpdate() once. This reduces disk I/O and ensures atomic saves. Avoid concurrent writes; the lock prevents overlapping updates.

- Choose appropriate chunk size/overlap for documents
  - For LocalDocumentIndex, start with chunkSize ~512 tokens and overlap during rendering only (overlap=true in renderSections). If documents are highly structured or short, smaller chunks (256–384) can help precision; for long prose, larger chunks (768–1024) can improve continuity.

## Troubleshooting

- Common issues
  - Missing keys.json or API keys
    - Symptom: CLI add/query fails or embeddings return error.
    - Fix: Provide --keys keys.json with the correct fields for your provider. Ensure environment variables are loaded if you construct OpenAIEmbeddings in code.
  - Invalid endpoint or deployment (Azure/OSS)
    - Symptom: “Client created with an invalid endpoint…” or 404/401 from API.
    - Fix: Use a valid https:// endpoint. For Azure, set azureEndpoint, azureDeployment, and (optionally) azureApiVersion correctly.
  - File permissions or locked files
    - Symptom: Error creating/saving index, or reading .txt/.json files.
    - Fix: Ensure the index folder exists and is writable. Avoid opening the same index folder with multiple processes for writes.
  - Rate limits
    - Symptom: Embeddings API returns 429.
    - Fix: OpenAIEmbeddings retries per retryPolicy (default [2000, 5000] ms). Increase backoff or reduce concurrency. Consider caching embeddings.
  - Update lock errors
    - Error: “Update already in progress”
      - Cause: A write is already in flight between beginUpdate() and endUpdate().
      - Fix: Avoid concurrent writes. Use a single critical section for batch updates.
    - Error: “No update in progress”
      - Cause: endUpdate() called without a matching beginUpdate().
      - Fix: Ensure you pair beginUpdate()/endUpdate() calls.
  - Index already exists / create vs. recreate
    - Error: “Index already exists”
      - Fix: Pass deleteIfExists: true to createIndex() if you intend to recreate. For CLI, you can delete and re-create: npx vectra delete ./index && npx vectra create ./index
  - Partial writes or index corruption
    - Symptom: Errors reading index.json after a failed write.
    - Fix: Recreate the index folder and re-ingest data. Batch operations reduce risk: beginUpdate() … endUpdate().
  - Metadata filters not matching
    - Symptom: listItemsByMetadata or queryItems returns no results.
    - Fix: Ensure the fields you filter on are included in metadata_config.indexed or present in the per-item .json. Verify filter syntax ($eq, $in, etc.).
  - Node version mismatch
    - Symptom: Build/runtime errors.
    - Fix: Use Node.js >= 20.x as required.

## Contributing

- Getting started
  - Requirements: Node.js >= 20.x, Yarn or NPM
  - Clone the repo: git clone https://github.com/Stevenic/vectra.git && cd vectra
  - Install dependencies: yarn install (or npm install)

- Build, test, lint
  - Build: yarn build
  - Run tests: yarn test
  - Lint and auto-fix: yarn lint
  - Clean: yarn clean

- Submitting changes
  - Fork the repository and create a feature/fix branch from main (e.g., feature/add-bm25-option, fix/metadata-filter).
  - Write focused, self-contained commits; include tests for new features or bug fixes.
  - Ensure all tests pass and lint issues are resolved.
  - Open a Pull Request with a clear description and reference related issues (e.g., Closes #123).

- Reporting bugs and requesting features
  - Open an issue with steps to reproduce, expected behavior, and environment details (OS, Node.js version).
  - For enhancements, describe the use case and proposed solution.

- Code of Conduct
  - Please be respectful and follow our community guidelines.

## License

- MIT License
- See the LICENSE file in this repository for full text.

## Acknowledgements

- Inspiration from Pinecone and Qdrant for vector database concepts and APIs.
- Thanks to the open-source ecosystem and libraries used in this project, including (but not limited to): axios, openai, gpt-tokenizer, wink-bm25-text-search, wink-nlp, cheerio, turndown, yargs, uuid, json-colorizer.