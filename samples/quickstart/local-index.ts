/**
 * Quickstart: LocalIndex
 *
 * Demonstrates inserting items with vectors and metadata,
 * then querying with metadata filtering.
 */
import path from 'node:path';
import { LocalIndex } from 'vectra';
import { OpenAI } from 'openai';

const INDEX_PATH = path.join(process.cwd(), 'my-index');

// 1) Create the index
const index = new LocalIndex(INDEX_PATH);

if (!(await index.isIndexCreated())) {
    await index.createIndex({
        version: 1,
        metadata_config: { indexed: ['category'] },
    });
    console.log('Index created.');
}

// 2) Prepare an embeddings helper
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
async function getVector(text: string): Promise<number[]> {
    const resp = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
    });
    return resp.data[0].embedding;
}

// 3) Insert items
await index.insertItem({
    vector: await getVector('apple'),
    metadata: { text: 'apple', category: 'food' },
});
await index.insertItem({
    vector: await getVector('blue'),
    metadata: { text: 'blue', category: 'color' },
});
await index.insertItem({
    vector: await getVector('banana'),
    metadata: { text: 'banana', category: 'food' },
});
console.log('Inserted 3 items.');

// 4) Query by vector with metadata filter
const queryVector = await getVector('fruit');
const results = await index.queryItems(queryVector, '', 3, {
    category: { $eq: 'food' },
});

console.log('\nQuery: "fruit" (filtered to category=food)');
for (const r of results) {
    console.log(`  ${r.score.toFixed(4)}  ${r.item.metadata.text}`);
}
