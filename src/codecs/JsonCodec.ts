import { IndexData, MetadataTypes } from '../types';
import { DocumentCatalog, IndexCodec } from './IndexCodec';

/**
 * JSON codec — default serialization format.
 * @remarks
 * Wraps the existing JSON.stringify/JSON.parse behavior. This preserves
 * full backward compatibility with indexes created before the codec
 * abstraction was introduced.
 */
export class JsonCodec implements IndexCodec {
    readonly extension = '.json';

    serializeIndex(data: IndexData): Buffer {
        return Buffer.from(JSON.stringify(data), 'utf-8');
    }

    deserializeIndex(buffer: Buffer): IndexData {
        return JSON.parse(buffer.toString('utf-8'));
    }

    serializeCatalog(catalog: DocumentCatalog): Buffer {
        return Buffer.from(JSON.stringify(catalog), 'utf-8');
    }

    deserializeCatalog(buffer: Buffer): DocumentCatalog {
        return JSON.parse(buffer.toString('utf-8'));
    }

    serializeMetadata(metadata: Record<string, MetadataTypes>): Buffer {
        return Buffer.from(JSON.stringify(metadata), 'utf-8');
    }

    deserializeMetadata(buffer: Buffer): Record<string, MetadataTypes> {
        return JSON.parse(buffer.toString('utf-8'));
    }
}
