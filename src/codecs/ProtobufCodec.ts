import * as path from 'path';
import { IndexData, IndexItem, MetadataTypes } from '../types';
import { DocumentCatalog, IndexCodec } from './IndexCodec';

let protobuf: typeof import('protobufjs') | undefined;

function loadProtobuf(): typeof import('protobufjs') {
    if (!protobuf) {
        try {
            protobuf = require('protobufjs');
        } catch {
            throw new Error(
                "ProtobufCodec requires the 'protobufjs' package. Install it with: npm install protobufjs"
            );
        }
    }
    return protobuf!;
}

// Cached proto root — loaded once per process
let cachedRoot: any;

function getRoot(): any {
    if (!cachedRoot) {
        const pb = loadProtobuf();
        cachedRoot = pb.loadSync(path.join(__dirname, 'schemas', 'index.proto'));
    }
    return cachedRoot;
}

/** Convert MetadataTypes value to protobuf MetadataValue shape */
function toProtoMetadataValue(value: MetadataTypes): Record<string, any> {
    if (typeof value === 'string') return { stringValue: value };
    if (typeof value === 'number') return { numberValue: value };
    if (typeof value === 'boolean') return { boolValue: value };
    return { stringValue: String(value) };
}

/** Convert protobuf MetadataValue back to MetadataTypes */
function fromProtoMetadataValue(mv: any): MetadataTypes {
    if (mv.stringValue !== undefined && mv.stringValue !== '') return mv.stringValue;
    if (mv.numberValue !== undefined && mv.numberValue !== 0) return mv.numberValue;
    if (mv.boolValue !== undefined && mv.boolValue !== false) return mv.boolValue;
    // Disambiguate zero-value fields by checking which oneof field is set
    if (mv.value === 'boolValue') return false;
    if (mv.value === 'numberValue') return 0;
    if (mv.value === 'stringValue') return '';
    // Fallback — proto3 defaults make this tricky; prefer string empty
    return '';
}

/** Convert JS IndexItem to proto-friendly shape */
function toProtoItem(item: IndexItem): Record<string, any> {
    const metadata: Record<string, any> = {};
    if (item.metadata) {
        for (const [k, v] of Object.entries(item.metadata)) {
            metadata[k] = toProtoMetadataValue(v as MetadataTypes);
        }
    }
    const out: Record<string, any> = {
        id: item.id,
        metadata,
        vector: item.vector,
        norm: item.norm,
    };
    if (item.metadataFile) {
        out.metadataFile = item.metadataFile;
    }
    return out;
}

/** Convert proto IndexItem back to JS IndexItem */
function fromProtoItem(pi: any): IndexItem {
    const metadata: Record<string, MetadataTypes> = {};
    if (pi.metadata) {
        for (const [k, v] of Object.entries(pi.metadata as Record<string, any>)) {
            metadata[k] = fromProtoMetadataValue(v);
        }
    }
    // proto packed float → JS number[]; ensure plain array
    const vector: number[] = pi.vector ? Array.from(pi.vector as number[]) : [];
    const item: IndexItem = {
        id: pi.id,
        metadata,
        vector,
        norm: pi.norm,
    };
    if (pi.metadataFile) {
        item.metadataFile = pi.metadataFile;
    }
    return item;
}

/**
 * Protocol Buffers codec — opt-in binary format.
 * @remarks
 * Vectors are stored as packed float32 arrays (~50% smaller than JSON).
 * Norms are stored as float64 to avoid compounding rounding error.
 * Requires the `protobufjs` package to be installed.
 */
export class ProtobufCodec implements IndexCodec {
    readonly extension = '.pb';

    constructor() {
        // Eagerly validate that protobufjs is available
        loadProtobuf();
    }

    serializeIndex(data: IndexData): Buffer {
        const root = getRoot();
        const IndexDataMsg = root.lookupType('IndexData');
        const payload = {
            version: data.version,
            metadataConfig: {
                indexed: data.metadata_config?.indexed ?? [],
            },
            items: data.items.map(toProtoItem),
        };
        const err = IndexDataMsg.verify(payload);
        if (err) throw new Error(`Protobuf verify error: ${err}`);
        const message = IndexDataMsg.create(payload);
        return Buffer.from(IndexDataMsg.encode(message).finish());
    }

    deserializeIndex(buffer: Buffer): IndexData {
        const root = getRoot();
        const IndexDataMsg = root.lookupType('IndexData');
        const decoded = IndexDataMsg.decode(new Uint8Array(buffer));
        const obj = IndexDataMsg.toObject(decoded, {
            longs: Number,
            enums: String,
            defaults: true,
            oneofs: true,
        });
        return {
            version: obj.version,
            metadata_config: {
                indexed: obj.metadataConfig?.indexed ?? [],
            },
            items: (obj.items || []).map(fromProtoItem),
        };
    }

    serializeCatalog(catalog: DocumentCatalog): Buffer {
        const root = getRoot();
        const CatalogMsg = root.lookupType('DocumentCatalog');
        const payload = {
            version: catalog.version,
            count: catalog.count,
            uriToId: catalog.uriToId,
            idToUri: catalog.idToUri,
        };
        const err = CatalogMsg.verify(payload);
        if (err) throw new Error(`Protobuf verify error: ${err}`);
        const message = CatalogMsg.create(payload);
        return Buffer.from(CatalogMsg.encode(message).finish());
    }

    deserializeCatalog(buffer: Buffer): DocumentCatalog {
        const root = getRoot();
        const CatalogMsg = root.lookupType('DocumentCatalog');
        const decoded = CatalogMsg.decode(new Uint8Array(buffer));
        const obj = CatalogMsg.toObject(decoded, {
            longs: Number,
            enums: String,
            defaults: true,
            oneofs: true,
        });
        return {
            version: obj.version,
            count: obj.count,
            uriToId: obj.uriToId || {},
            idToUri: obj.idToUri || {},
        };
    }

    serializeMetadata(metadata: Record<string, MetadataTypes>): Buffer {
        // Metadata is a flat key-value map. We encode it as a JSON buffer
        // wrapped in a simple length-prefixed envelope to stay self-describing
        // while keeping the main index binary.
        //
        // We reuse the IndexItem metadata map encoding for consistency:
        // encode as { entries: map<string, MetadataValue> }.
        // However, since there's no standalone proto message for this,
        // we just use JSON for external metadata files — the size savings
        // from protobuf on small metadata objects are negligible.
        return Buffer.from(JSON.stringify(metadata), 'utf-8');
    }

    deserializeMetadata(buffer: Buffer): Record<string, MetadataTypes> {
        return JSON.parse(buffer.toString('utf-8'));
    }
}
