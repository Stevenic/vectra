/**
 * FolderWatcher — Keep an index in sync with local files.
 *
 * See the full tutorial: https://stevenic.github.io/vectra/tutorials/folder-sync
 */
import path from 'node:path';
import { LocalDocumentIndex, OpenAIEmbeddings, FolderWatcher } from 'vectra';

// Create the index
const docs = new LocalDocumentIndex({
    folderPath: path.join(process.cwd(), 'my-index'),
    embeddings: new OpenAIEmbeddings({
        apiKey: process.env.OPENAI_API_KEY!,
        model: 'text-embedding-3-small',
        maxTokens: 8000,
    }),
});

if (!(await docs.isIndexCreated())) {
    await docs.createIndex({ version: 1 });
}

// Watch for changes
const watcher = new FolderWatcher({
    index: docs,
    paths: ['./docs', './notes'],
    extensions: ['.md', '.txt'],
    debounceMs: 500,
});

// Listen to events
watcher.on('sync', (uri, action) => {
    console.log(`${action}: ${uri}`);
});

watcher.on('error', (err, uri) => {
    console.error(`Error processing ${uri}:`, err.message);
});

watcher.on('ready', () => {
    console.log('Initial sync complete. Watching for changes...');
});

// Start watching
await watcher.start();

// Stop on Ctrl+C
process.on('SIGINT', async () => {
    console.log('Stopping watcher...');
    await watcher.stop();
    process.exit(0);
});
