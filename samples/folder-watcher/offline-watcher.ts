/**
 * Offline FolderWatcher — Uses LocalEmbeddings (no API key required).
 *
 * Great for local knowledge bases where privacy matters.
 */
import path from 'node:path';
import { LocalDocumentIndex, LocalEmbeddings, FolderWatcher } from 'vectra';

const docs = new LocalDocumentIndex({
    folderPath: path.join(process.cwd(), 'knowledge-base'),
    embeddings: new LocalEmbeddings(),
    chunkingConfig: {
        chunkSize: 256,
        chunkOverlap: 50,
        keepSeparators: true,
    },
});

if (!(await docs.isIndexCreated())) {
    await docs.createIndex({ version: 1 });
}

let syncCount = 0;

const watcher = new FolderWatcher({
    index: docs,
    paths: ['./wiki', './team-docs'],
    extensions: ['.md', '.txt', '.html'],
    debounceMs: 1000,
});

watcher.on('sync', (uri, action) => {
    syncCount++;
    const timestamp = new Date().toISOString().slice(11, 19);
    console.log(
        `[${timestamp}] ${action.toUpperCase().padEnd(6)} ${uri} (total: ${syncCount})`
    );
});

watcher.on('error', (err, uri) => {
    console.error(`[ERROR] ${uri || 'unknown'}: ${err.message}`);
});

watcher.on('ready', async () => {
    const stats = await docs.getCatalogStats();
    console.log(
        `Ready. ${stats.documentCount} documents indexed. Watching for changes...`
    );
});

await watcher.start();

process.on('SIGINT', async () => {
    console.log('Stopping watcher...');
    await watcher.stop();
    process.exit(0);
});
