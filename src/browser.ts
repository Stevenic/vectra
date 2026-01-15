/**
 * Browser entry point for Vectra.
 *
 * This module exports only browser-compatible components.
 * Node-specific components (LocalFileStorage, FileFetcher, WebFetcher) are excluded.
 *
 * For browser usage:
 * - Use `VirtualFileStorage` for in-memory storage (ephemeral)
 * - Use `IndexedDBStorage` for persistent browser storage
 * - Use `BrowserWebFetcher` for fetching web content
 */

// Core index classes
export { LocalIndex, CreateIndexConfig } from './LocalIndex';
export { LocalDocumentIndex, LocalDocumentIndexConfig, DocumentQueryOptions } from './LocalDocumentIndex';

// Document classes
export { LocalDocument } from './LocalDocument';
export { LocalDocumentResult } from './LocalDocumentResult';

// Text processing
export { TextSplitter, TextSplitterConfig } from './TextSplitter';
export { GPT3Tokenizer } from './GPT3Tokenizer';

// Embeddings
export {
    OpenAIEmbeddings,
    OpenAIEmbeddingsOptions,
    AzureOpenAIEmbeddingsOptions,
    OSSEmbeddingsOptions,
    BaseOpenAIEmbeddingsOptions
} from './OpenAIEmbeddings';

// Query utilities
export { ItemSelector } from './ItemSelector';

// Types
export {
    EmbeddingsModel,
    EmbeddingsResponse,
    EmbeddingsResponseStatus,
    TextChunk,
    TextFetcher,
    IndexStats,
    IndexItem,
    MetadataFilter,
    MetadataTypes,
    QueryResult,
    Tokenizer,
    DocumentChunkMetadata,
    DocumentCatalogStats,
    DocumentTextSection,
    IndexData
} from './types';

// Storage - browser compatible
export { FileStorage, FileDetails, ListFilesFilter } from './storage/FileStorage';
export { FileStorageUtilities } from './storage/FileStorageUtilities';
export { FileType } from './storage/FileType';
export { VirtualFileStorage } from './storage/VirtualFileStorage';
export { IndexedDBStorage } from './storage/IndexedDBStorage';

// Browser-compatible fetcher
export { BrowserWebFetcher, BrowserWebFetcherConfig } from './BrowserWebFetcher';

// Utilities
export { pathUtils } from './utils/pathUtils';
