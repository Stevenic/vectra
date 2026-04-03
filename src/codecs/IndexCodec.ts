import { IndexData, MetadataTypes } from '../types';

/**
 * Catalog structure for document indexes.
 */
export interface DocumentCatalog {
    version: number;
    count: number;
    uriToId: { [uri: string]: string };
    idToUri: { [id: string]: string };
}

/**
 * Abstraction for index serialization format.
 * @remarks
 * Implementations control how index data, catalogs, and metadata are
 * serialized to and from Buffers written by the storage backend.
 */
export interface IndexCodec {
    /** File extension used for index files (e.g., '.json', '.pb') */
    readonly extension: string;

    /** Serialize IndexData to a Buffer for writing to storage */
    serializeIndex(data: IndexData): Buffer;

    /** Deserialize a Buffer read from storage into IndexData */
    deserializeIndex(buffer: Buffer): IndexData;

    /** Serialize a DocumentCatalog to a Buffer */
    serializeCatalog(catalog: DocumentCatalog): Buffer;

    /** Deserialize a Buffer into a DocumentCatalog */
    deserializeCatalog(buffer: Buffer): DocumentCatalog;

    /** Serialize arbitrary metadata to a Buffer */
    serializeMetadata(metadata: Record<string, MetadataTypes>): Buffer;

    /** Deserialize a Buffer into metadata */
    deserializeMetadata(buffer: Buffer): Record<string, MetadataTypes>;
}
