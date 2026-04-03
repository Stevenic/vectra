---
title: Browser & Electron App
layout: default
parent: Tutorials
nav_order: 3
---

# Browser & Electron App
{: .no_toc }

Build a semantic search app that runs entirely in the browser — no server, no API key.
{: .fs-6 .fw-300 }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## What you'll build

A browser-based semantic search application that:

- Runs entirely client-side — no backend server
- Uses `TransformersEmbeddings` for local model inference (no API key)
- Persists data in IndexedDB across page reloads
- Works in Electron with the same code

## Prerequisites

- Node.js 22.x or newer (for bundling)
- A bundler: **Vite** (recommended) or **webpack**
- No API key needed — embeddings run locally

```sh
npm install vectra @huggingface/transformers
```

## Step 1: The vectra/browser entry point

Import from `vectra/browser` instead of `vectra`. This entry point excludes Node-specific modules (`LocalFileStorage`, `FileFetcher`, `WebFetcher`, `FolderWatcher`) and includes browser alternatives.

```ts
import {
  LocalDocumentIndex,
  TransformersEmbeddings,
  IndexedDBStorage,
  BrowserWebFetcher,
} from 'vectra/browser';
```

Bundlers that support conditional `exports` (Vite, webpack 5+) resolve this automatically. If your bundler doesn't, import directly from `vectra/browser`.

## Step 2: Initialize storage and embeddings

```ts
// Persistent storage via IndexedDB — survives page reloads
const storage = new IndexedDBStorage('my-search-app');

// Local embeddings — downloads model on first use, caches it in the browser
const embeddings = await TransformersEmbeddings.create({
  device: 'auto', // WebGPU if available, falls back to WASM
  dtype: 'q8',    // quantized for faster inference + smaller download
  progressCallback: (progress) => {
    console.log(`Model: ${progress.status} ${Math.round(progress.progress || 0)}%`);
  },
});
```

{: .note }
The first run downloads the model (~30 MB for the default `all-MiniLM-L6-v2` with q8 quantization). Subsequent runs load from the browser cache.

### Device selection

| Device | When to use |
|--------|-------------|
| `'auto'` | Let Vectra pick the best option (default) |
| `'gpu'` | Force WebGPU — fastest, but not all browsers support it |
| `'wasm'` | Force WASM — works everywhere, good fallback |
| `'cpu'` | Most compatible, slowest |

### Quantization

| Precision | Model size | Speed | Quality |
|-----------|-----------|-------|---------|
| `'fp32'` | ~90 MB | Baseline | Best |
| `'fp16'` | ~45 MB | Faster with GPU | Very good |
| `'q8'` | ~23 MB | Good balance | Good |
| `'q4'` | ~12 MB | Fastest | Acceptable |

## Step 3: Create the index

```ts
const index = new LocalDocumentIndex({
  folderPath: 'search-index', // logical path inside IndexedDB
  embeddings,
  storage,
});

if (!(await index.isIndexCreated())) {
  await index.createIndex({ version: 1 });
}
```

The `folderPath` is a logical name inside IndexedDB, not a filesystem path.

## Step 4: Add documents

### From text

```ts
await index.upsertDocument('doc://intro', 'Vectra is a local vector database...', 'txt');
await index.upsertDocument('doc://features', 'Vectra supports metadata filtering...', 'txt');
```

### From web pages

Use `BrowserWebFetcher` to fetch and convert web pages to text:

```ts
const fetcher = new BrowserWebFetcher();
await fetcher.fetch('https://example.com/docs', async (uri, text, docType) => {
  await index.upsertDocument(uri, text, docType);
  return true;
});
```

{: .important }
`BrowserWebFetcher` uses `fetch()` + `DOMParser`, so it's subject to CORS restrictions. You can only fetch pages that allow cross-origin requests, or pages from the same origin.

## Step 5: Query and display results

```ts
async function search(query: string): Promise<void> {
  const results = await index.queryDocuments(query, {
    maxDocuments: 5,
    maxChunks: 20,
  });

  for (const result of results) {
    const sections = await result.renderSections(500, 1, true);
    console.log(`[${result.score.toFixed(4)}] ${result.uri}`);
    for (const section of sections) {
      console.log(section.text);
    }
  }
}

await search('What is Vectra?');
```

## Step 6: Bundler configuration

### Vite

Vite handles WASM and worker files automatically. Minimal config:

```ts
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    exclude: ['@huggingface/transformers'], // let Vite handle WASM files
  },
});
```

### Webpack 5

Enable WASM and async module support:

```js
// webpack.config.js
module.exports = {
  experiments: {
    asyncWebAssembly: true,
  },
  resolve: {
    fallback: {
      fs: false,
      path: false,
    },
  },
};
```

## Complete example

```html
<!DOCTYPE html>
<html>
<head><title>Vectra Browser Search</title></head>
<body>
  <input id="query" placeholder="Search..." />
  <button id="search">Search</button>
  <div id="results"></div>

  <script type="module">
    import {
      LocalDocumentIndex,
      TransformersEmbeddings,
      IndexedDBStorage,
    } from 'vectra/browser';

    const storage = new IndexedDBStorage('search-demo');
    const embeddings = await TransformersEmbeddings.create({
      device: 'auto',
      dtype: 'q8',
      progressCallback: (p) => {
        document.getElementById('results').textContent =
          `Loading model: ${p.status} ${Math.round(p.progress || 0)}%`;
      },
    });

    const index = new LocalDocumentIndex({
      folderPath: 'demo-index',
      embeddings,
      storage,
    });

    if (!(await index.isIndexCreated())) {
      await index.createIndex({ version: 1 });

      // Seed with sample data
      await index.upsertDocument('doc://vectra', 'Vectra is a local vector database with sub-millisecond query latency.', 'txt');
      await index.upsertDocument('doc://features', 'Vectra supports metadata filtering, hybrid BM25 retrieval, and multiple storage backends.', 'txt');
      await index.upsertDocument('doc://browser', 'Vectra runs in browsers using IndexedDB for storage and TransformersEmbeddings for local inference.', 'txt');
    }

    document.getElementById('results').textContent = 'Ready — try a search.';

    document.getElementById('search').addEventListener('click', async () => {
      const query = document.getElementById('query').value;
      if (!query) return;

      const results = await index.queryDocuments(query, { maxDocuments: 5 });
      const el = document.getElementById('results');
      el.innerHTML = '';

      for (const result of results) {
        const sections = await result.renderSections(500, 1, true);
        const div = document.createElement('div');
        div.innerHTML = `<strong>${result.uri}</strong> (${result.score.toFixed(4)})<br>${sections.map(s => s.text).join('<br>')}`;
        el.appendChild(div);
      }
    });
  </script>
</body>
</html>
```

## Electron considerations

The same `vectra/browser` entry point works in Electron renderer processes:

- Use `IndexedDBStorage` for persistence (renderer has IndexedDB access)
- `TransformersEmbeddings` works with both WebGPU and WASM in Electron
- If you need filesystem access, use `contextBridge` to expose `LocalFileStorage` from the main process

```ts
// In Electron renderer — same code as browser
import { LocalDocumentIndex, TransformersEmbeddings, IndexedDBStorage } from 'vectra/browser';
```

{: .note }
If `nodeIntegration` is enabled in your Electron config, you can import from `vectra` directly and use `LocalFileStorage`. But the `vectra/browser` path is recommended for security (renderer shouldn't have full Node access).

## Cleanup

To delete all stored data:

```ts
const storage = new IndexedDBStorage('my-search-app');
await storage.destroy(); // deletes the entire IndexedDB database
```

## Next steps

- **Aligned tokenizer** — use `embeddings.getTokenizer()` to ensure chunk boundaries match the model's tokens. See [Embeddings Guide](/vectra/embeddings#aligned-tokenizer).
- **GPU acceleration** — pass `device: 'gpu'` for WebGPU inference if your users' browsers support it.
- **Offline-first** — since embeddings run locally and data lives in IndexedDB, the app works completely offline after the initial model download.
- See the [Storage guide](/vectra/storage#running-in-the-browser) for the full browser compatibility matrix.
