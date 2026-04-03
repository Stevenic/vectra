/**
 * Usage example: LocalDocumentIndex with SQLiteStorage
 */
import { LocalDocumentIndex, OpenAIEmbeddings } from 'vectra';
import { SQLiteStorage } from './sqlite-storage';

const storage = new SQLiteStorage('./my-index.db');

const docs = new LocalDocumentIndex({
    folderPath: 'my-index',
    embeddings: new OpenAIEmbeddings({
        apiKey: process.env.OPENAI_API_KEY!,
        model: 'text-embedding-3-small',
        maxTokens: 8000,
    }),
    storage,
});

if (!(await docs.isIndexCreated())) {
    await docs.createIndex({ version: 1 });
}

await docs.upsertDocument('doc://hello', 'Hello from SQLite storage!', 'txt');

const results = await docs.queryDocuments('hello', { maxDocuments: 5 });
console.log('Results:', results.length);

for (const r of results) {
    console.log(`  ${r.uri} (score: ${r.score.toFixed(4)})`);
}
