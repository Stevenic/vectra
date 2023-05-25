# Vectra
Vectra is a local vector database for Node.js with features similar to [Pinecone](https://www.pinecone.io/) or [Qdrant](https://qdrant.tech/) but built using local files. Each Vectra index is a folder on disk. There's an `index.json` file in the folder that contains all the vectors for the index along with any indexed metadata.  When you create an index you can specify which metadata properties to index and only those fields will be stored in the `index.json` file. All of the other metadata for an item will be stored on disk in a separate file keyed by a GUID.

When queryng Vectra you'll be able to use the same subset of [Mongo DB query operators](https://www.mongodb.com/docs/manual/reference/operator/query/) that Pinecone supports and the results will be returned sorted by simularity. Every item in the index will first be filtered by metadata and then ranked for simularity. Even though every item is evaluated its all in memory so it should by nearly instantanious. Likely 1ms - 2ms for even a rather large index. Smaller indexes should be <1ms.

Keep in mind that your entire Vectra index is loaded into memory so it's not well suited for scenarios like long term chat bot memory. Use a real vector DB for that. Vectra is intended to be used in scenarios where you have a small corpus of mostly static data that you'd like to include in your prompt. Infinite few shot examples would be a great use case for Vectra or even just a single document you want to ask questions over.

Pinecone style namespaces aren't directly supported but you could easily mimic them by creating a separate Vectra index (and folder) for each namespace.

## Other Language Bindings
This repo contains the TypeScript/JavaScript binding for Vectra but other language bindings are being created. Since Vectra is file based, any language binding can be used to read or write a Vectra index. That means you can build a Vectra index using JS and then read it using Python.

- [vectra-py](https://github.com/BMS-geodev/vectra-py) - Python version of Vectra.

## Installation

```
$ npm install vectra
```

## Usage

First create an instance of `LocalIndex` with the path to the folder where you want you're items stored:

```typescript
import { LocalIndex } from 'vectra';

const index = new LocalIndex(path.join(__dirname, '..', 'index'));
```

Next, from inside an async function, create your index:

```typescript
if (!await index.isIndexCreated()) {
    await index.createIndex();
}
```

Add some items to your index:

```typescript
import { OpenAIApi, Configuration } from 'openai';

const configuration = new Configuration({
    apiKey: `<YOUR_KEY>`,
});

const api = new OpenAIApi(configuration);

async function getVector(text: string) {
    const response = await api.createEmbedding({
        'model': 'text-embedding-ada-002',
        'input': text,
    });
    return response.data.data[0].embedding;
}

async function addItem(text: string) {
    await index.insertItem({
        vector: await getVector(text),
        metadata: { text }
    });
}

// Add items
await addItem('apple');
await addItem('oranges');
await addItem('red');
await addItem('blue');
```

Then query for items:

```typescript
async function query(text: string) {
    const vector = await getVector(input);
    const results = await index.queryItems(vector, 3);
    if (results.length > 0) {
        for (const result of results) {
            console.log(`[${result.score}] ${result.item.metadata.text}`);
        }
    } else {
        console.log(`No results found.`);
    }
}

await query('green');
/*
[0.9036569942401076] blue
[0.8758153664568566] red
[0.8323828606103998] apple
*/

await query('banana');
/*
[0.9033128691220631] apple
[0.8493374123092652] oranges
[0.8415324469533297] blue
*/
```
