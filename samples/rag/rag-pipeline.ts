/**
 * RAG Pipeline
 *
 * Ingest files → query → renderSections → feed to LLM.
 * See the full tutorial: https://stevenic.github.io/vectra/tutorials/rag-pipeline
 */
import path from 'node:path';
import { LocalDocumentIndex, OpenAIEmbeddings, FileFetcher } from 'vectra';
import { OpenAI } from 'openai';

const INDEX_PATH = path.join(process.cwd(), 'rag-index');
const DOCS_PATH = './my-docs';

// --- Setup ---
const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'text-embedding-3-small',
    maxTokens: 8000,
});

const docs = new LocalDocumentIndex({ folderPath: INDEX_PATH, embeddings });

if (!(await docs.isIndexCreated())) {
    await docs.createIndex({ version: 1 });
}

// --- Ingest ---
const fetcher = new FileFetcher();
await fetcher.fetch(DOCS_PATH, async (uri, text, docType) => {
    console.log(`Indexing: ${uri}`);
    await docs.upsertDocument(uri, text, docType);
    return true;
});

// --- Query ---
const question = 'How does Vectra handle chunking?';
const results = await docs.queryDocuments(question, {
    maxDocuments: 3,
    maxChunks: 50,
});

// --- Render context ---
let context = '';
for (const result of results) {
    const sections = await result.renderSections(1500, 1, true);
    for (const section of sections) {
        context += `\n\n--- Source: ${result.uri} (score: ${result.score.toFixed(4)}) ---\n`;
        context += section.text;
    }
}

// --- LLM ---
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
        {
            role: 'system',
            content: `Answer using ONLY this context. If the answer isn't here, say so.\n\nContext:\n${context}`,
        },
        { role: 'user', content: question },
    ],
});

console.log('\nAnswer:', response.choices[0].message.content);
