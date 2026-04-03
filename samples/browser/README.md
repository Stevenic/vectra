# Browser Sample

A browser-based semantic search app using IndexedDB for storage and TransformersEmbeddings for local inference. No API keys required — everything runs client-side.

## Prerequisites

- A modern browser with WebGPU or WASM support (Chrome 113+, Edge 113+, Firefox 120+)

## Quick Start

Serve `index.html` with any static file server:

```bash
npx serve .
```

Then open `http://localhost:3000` in your browser.

On first load, the app downloads a quantized embedding model (~30 MB). Subsequent loads use the cached model.

## What It Does

1. Creates a `LocalDocumentIndex` backed by IndexedDB
2. Initializes `TransformersEmbeddings` with automatic device selection (WebGPU → WASM fallback)
3. Seeds the index with sample documents on first run
4. Lets you search the index with natural language queries

## Bundler Projects

If you're integrating into a Vite or webpack project, see the [Browser & Electron tutorial](https://stevenic.github.io/vectra/tutorials/browser-electron) for bundler configuration.

## Electron

The same `vectra/browser` entry point works in Electron's renderer process. See the tutorial for Electron-specific considerations.

## Learn More

- [Browser & Electron tutorial](https://stevenic.github.io/vectra/tutorials/browser-electron)
- [Storage guide](https://stevenic.github.io/vectra/storage)
- [Embeddings guide](https://stevenic.github.io/vectra/embeddings)
