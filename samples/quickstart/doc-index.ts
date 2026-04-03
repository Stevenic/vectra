/**
 * Quickstart: LocalDocumentIndex
 *
 * Demonstrates ingesting documents, querying, and rendering
 * sections for use in an LLM prompt.
 */
import path from 'node:path';
import { LocalDocumentIndex, OpenAIEmbeddings } from 'vectra';

const INDEX_PATH = path.join(process.cwd(), 'my-doc-index');

// 1) Configure embeddings
const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'text-embedding-3-small',
    maxTokens: 8000,
});

// 2) Create the index
const docs = new LocalDocumentIndex({
    folderPath: INDEX_PATH,
    embeddings,
});

if (!(await docs.isIndexCreated())) {
    await docs.createIndex({ version: 1 });
    console.log('Index created.');
}

// 3) Add a document
await docs.upsertDocument(
    'doc://welcome',
    `Vectra is a local, file-backed, in-memory vector database.
It supports Pinecone-like metadata filtering and fast local retrieval.
Documents are automatically chunked and embedded for semantic search.`,
    'md'
);
console.log('Document upserted.');

// 4) Query and render sections
const results = await docs.queryDocuments('What is Vectra best suited for?', {
    maxDocuments: 5,
    maxChunks: 20,
});

if (results.length > 0) {
    const top = results[0];
    console.log(`\nTop result: ${top.uri} (score: ${top.score.toFixed(4)})`);

    const sections = await top.renderSections(2000, 1, true);
    for (const s of sections) {
        console.log(`  Section score: ${s.score.toFixed(4)}, tokens: ${s.tokenCount}`);
        console.log(`  ${s.text}\n`);
    }
} else {
    console.log('No results found.');
}
