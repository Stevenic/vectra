# Spec: Binary Storage Format (Protocol Buffers)

**Status:** Draft  
**Author:** Scribe  
**Date:** 2026-04-02  
**Scope:** On-disk format, public API surface, backward compatibility

---

## 1. Problem

All Vectra index data is stored as JSON via hardcoded `JSON.stringify()`/`JSON.parse()` calls. For large indexes, this is inefficient:

- A 1536-dimensional vector occupies ~8-12 KB as a JSON number array but only ~6 KB as packed binary floats.
- JSON parsing is CPU-intensive for large index files containing thousands of vectors.
- No schema validation — malformed files fail at runtime with cryptic errors.

## 2. Goal

Introduce a **codec abstraction** that decouples the index logic from the serialization format, then provide two implementations:

1. **JSON codec** (default, backward-compatible) — same behavior as today
2. **Protobuf codec** (opt-in) — binary format using Protocol Buffers for smaller files and faster I/O

The change must be **non-breaking** — existing JSON indexes continue to work without migration.

## 3. Non-Goals

- Changing the `FileStorage` interface (it already works with `Buffer` — no changes needed)
- Compressing metadata or document text (the wins are almost entirely in vector storage)
- Supporting formats other than JSON and Protobuf in this iteration
- Mixed-format indexes (a single codec governs all files in an index folder)

## 4. Design

### 4.1 Codec Interface

A new `IndexCodec` interface abstracts serialization for all on-disk structures:

```typescript
// src/codecs/IndexCodec.ts

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
```

### 4.2 JSON Codec

Wraps the existing `JSON.stringify()`/`JSON.parse()` behavior. This is the default codec and preserves full backward compatibility.

```typescript
// src/codecs/JsonCodec.ts

export class JsonCodec implements IndexCodec {
  readonly extension = '.json';

  serializeIndex(data: IndexData): Buffer {
    return Buffer.from(JSON.stringify(data), 'utf-8');
  }

  deserializeIndex(buffer: Buffer): IndexData {
    return JSON.parse(buffer.toString('utf-8'));
  }

  // ... same pattern for catalog and metadata
}
```

### 4.3 Protobuf Codec

Uses Protocol Buffers for binary serialization. Vectors are stored as packed `float` arrays (4 bytes per dimension vs. ~7-8 bytes in JSON text).

```typescript
// src/codecs/ProtobufCodec.ts

export class ProtobufCodec implements IndexCodec {
  readonly extension = '.pb';

  // Uses protobufjs to serialize/deserialize against .proto schemas
  // ...
}
```

### 4.4 Proto Schema Definitions

```protobuf
// src/codecs/schemas/index.proto

syntax = "proto3";

message IndexData {
  uint32 version = 1;
  MetadataConfig metadata_config = 2;
  repeated IndexItem items = 3;
}

message MetadataConfig {
  repeated string indexed = 1;
}

message IndexItem {
  string id = 1;
  map<string, MetadataValue> metadata = 2;
  repeated float vector = 3 [packed = true];
  double norm = 4;
  optional string metadata_file = 5;
}

message MetadataValue {
  oneof value {
    string string_value = 1;
    double number_value = 2;
    bool bool_value = 3;
  }
}

message DocumentCatalog {
  uint32 version = 1;
  uint32 count = 2;
  map<string, string> uri_to_id = 3;
  map<string, string> id_to_uri = 4;
}
```

### 4.5 Integration Points

All serialization touchpoints that must be refactored to use the codec:

| # | File | Line | Current Code | What Changes |
|---|------|------|-------------|-------------|
| 1 | `LocalIndex.ts` | 128 | `JSON.stringify(this._data)` in `createIndex()` | `codec.serializeIndex(this._data)` |
| 2 | `LocalIndex.ts` | 177 | `JSON.stringify(this._update)` in `endUpdate()` | `codec.serializeIndex(this._update)` |
| 3 | `LocalIndex.ts` | 334 | `JSON.parse(metadataBuffer...)` in `queryItems()` | `codec.deserializeMetadata(buffer)` |
| 4 | `LocalIndex.ts` | 419 | `JSON.parse(data...)` in `loadIndexData()` | `codec.deserializeIndex(data)` |
| 5 | `LocalIndex.ts` | 460 | `JSON.stringify(item.metadata)` in `addItemToUpdate()` | `codec.serializeMetadata(item.metadata)` |
| 6 | `LocalDocumentIndex.ts` | 309 | `JSON.stringify(metadata)` in `upsertDocument()` | `codec.serializeMetadata(metadata)` |
| 7 | `LocalDocumentIndex.ts` | 440 | `JSON.stringify(this._newCatalog)` in `endUpdate()` | `codec.serializeCatalog(this._newCatalog)` |
| 8 | `LocalDocumentIndex.ts` | 459 | `JSON.parse(buffer...)` in `loadIndexData()` | `codec.deserializeCatalog(buffer)` |
| 9 | `LocalDocumentIndex.ts` | 469 | `JSON.stringify(this._catalog)` in `loadIndexData()` | `codec.serializeCatalog(this._catalog)` |

### 4.6 Hardcoded File Names

These file name patterns must respect the codec's `extension` property:

| Current Name | Used In | New Pattern |
|---|---|---|
| `index.json` (default `_indexName`) | `LocalIndex` constructor | `index${codec.extension}` |
| `catalog.json` | `LocalDocumentIndex.isCatalogCreated()`, `loadIndexData()`, `endUpdate()` | `catalog${codec.extension}` |
| `${uuid}.json` (external chunk metadata) | `LocalIndex.addItemToUpdate()` | `${uuid}${codec.extension}` |
| `${documentId}.json` (document metadata) | `LocalDocumentIndex.upsertDocument()`, `deleteDocument()` | `${documentId}${codec.extension}` |
| `${documentId}.txt` (document text) | `LocalDocumentIndex.upsertDocument()`, `deleteDocument()` | **No change** — plain text, not serialized data |

### 4.7 API Changes

The codec is passed through constructors. Both `LocalIndex` and `LocalDocumentIndex` default to `JsonCodec` if no codec is provided.

```typescript
// LocalIndex constructor gains an optional codec parameter
constructor(
  folderPath: string,
  indexName?: string,
  storage?: FileStorage,
  codec?: IndexCodec,    // NEW — defaults to JsonCodec
  options?: { ... }
)

// LocalDocumentIndexConfig gains an optional codec field
interface LocalDocumentIndexConfig {
  folderPath: string;
  indexName?: string;
  embeddings?: EmbeddingsModel;
  tokenizer?: Tokenizer;
  chunkingConfig?: Partial<TextSplitterConfig>;
  storage?: FileStorage;
  codec?: IndexCodec;    // NEW — defaults to JsonCodec
}
```

When `codec` is provided, the default `indexName` changes from `'index.json'` to `'index' + codec.extension`. If `indexName` is explicitly provided, it is used as-is regardless of codec.

### 4.8 CLI Changes

The `vectra create` command gains a `--format` flag:

```bash
# Create a new index in Protobuf format
vectra create --format protobuf ./my-index

# Create a new index in JSON format (default, same as today)
vectra create --format json ./my-index
vectra create ./my-index
```

All other CLI commands (`query`, `upsert`, `delete`, etc.) **infer the format** from the existing index files on disk — no `--format` flag needed after creation.

A new `vectra migrate` command is added (see §5.3 Migration).

## 5. Backward Compatibility

### 5.1 Default Behavior Unchanged

- No constructor parameter changes are required for existing code
- `JsonCodec` is the default — same files, same format, same names
- Existing indexes are readable without any changes

### 5.2 Format Inference (Read Path)

When opening an existing index, the format is **inferred from the file on disk** — the loader checks which extension exists (`index.json` or `index.pb`) and selects the appropriate codec automatically. This means users only specify the format at **creation time**; all subsequent opens detect it.

If both `index.json` and `index.pb` exist in the same folder, the loader raises an error directing the user to run the migration command.

### 5.3 Migration

A `migrate()` function is provided in both the **API** and the **CLI** to convert indexes between formats:

**API:**
```typescript
import { migrateIndex } from 'vectra';

// Migrate a JSON index to Protobuf in-place
await migrateIndex(folderPath, { to: 'protobuf' });

// Migrate back to JSON
await migrateIndex(folderPath, { to: 'json' });
```

**CLI:**
```bash
# Migrate an existing index to Protobuf format
vectra migrate --to protobuf ./my-index

# Migrate back to JSON
vectra migrate --to json ./my-index
```

Migration behavior:
1. Detect the current format from the file on disk
2. Load all index data, catalog, and external metadata files using the source codec
3. Re-serialize everything using the target codec
4. Write the new files alongside the old ones
5. Remove the old-format files only after all new files are written successfully
6. If interrupted, the presence of both formats triggers an error on next open, prompting the user to re-run migration

## 6. Dependencies

| Package | Purpose | Unpacked Size |
|---|---|---|
| `protobufjs` | Protobuf encoding/decoding | **~3 MB** |

This is a significant dependency — 3 MB unpacked for a library that is otherwise lightweight. Decision: **optional dependency**.

- `protobufjs` is listed in `optionalDependencies` in `package.json`
- The `ProtobufCodec` constructor checks for `protobufjs` at runtime via dynamic `require()`/`import()`
- If missing, it throws a clear error: `"ProtobufCodec requires the 'protobufjs' package. Install it with: npm install protobufjs"`
- The `JsonCodec` has zero additional dependencies
- Users who never use Protobuf format pay no size cost

## 7. File Structure

New files to create:

```
src/codecs/
  IndexCodec.ts          # Interface definition
  JsonCodec.ts           # JSON implementation (default)
  ProtobufCodec.ts       # Protobuf implementation
  schemas/
    index.proto          # Proto schema definitions
  index.ts               # Barrel export
```

## 8. Testing Strategy

| Test | What It Verifies |
|---|---|
| JSON codec round-trip | `serializeIndex` → `deserializeIndex` produces identical data |
| Protobuf codec round-trip | Same as above, for all data types (strings, numbers, booleans in metadata) |
| Cross-codec compatibility | Data serialized with JSON can be deserialized after re-serializing with Protobuf and vice versa (logical equivalence, not byte equivalence) |
| LocalIndex with ProtobufCodec | Full CRUD operations using Protobuf storage produce correct results |
| LocalDocumentIndex with ProtobufCodec | Document insert/query/delete with Protobuf catalog |
| Format inference | Opening an index auto-detects JSON vs Protobuf from file extension on disk |
| Migration (JSON → Protobuf) | `migrateIndex()` converts all files, old files removed, data integrity preserved |
| Migration (Protobuf → JSON) | Same as above in reverse |
| Migration interruption | Dual-format detection raises clear error, re-running migration completes cleanly |
| External metadata files | Chunk and document metadata files use the correct extension per codec |
| CLI `--format` flag | `vectra create --format protobuf` produces `.pb` files; `vectra create` defaults to JSON |
| CLI `vectra migrate` | End-to-end format conversion from command line |
| Existing tests pass unchanged | All current tests continue to pass with no modifications (they use the default JsonCodec) |

## 9. Rollout

### Phase 1: Codec Abstraction (non-breaking)
- Introduce `IndexCodec` interface and `JsonCodec`
- Refactor all 9 serialization touchpoints to use the codec
- All existing tests pass — behavior is identical

### Phase 2: Protobuf Implementation
- Add `ProtobufCodec` with `.proto` schemas
- Add `protobufjs` as optional dependency
- Add format inference logic (detect `.json` vs `.pb` on disk)
- Add new tests for Protobuf round-trips

### Phase 3: Migration
- Implement `migrateIndex()` API function
- Add `vectra migrate` CLI command
- Add `--format` flag to `vectra create`
- Add migration tests (happy path, interruption recovery, both directions)

### Phase 4: Documentation & Samples
- Update README with codec configuration examples and CLI flags
- Add a sample showing Protobuf index creation
- Document migration workflow

## 10. Resolved Decisions

1. **`protobufjs` is an optional dependency.** At ~3 MB unpacked, it's too large to force on all users. Listed in `optionalDependencies` with a runtime check and clear error message. (See §6)

2. **`--format` flag on `vectra create`, inferred thereafter.** Format is specified only at creation time. All subsequent CLI commands detect the format from files on disk. (See §4.8)

3. **`float` (32-bit) for vectors, `double` (64-bit) for norms.** See precision analysis below. (See §10.1)

4. **No mixed-format indexes. Migration via API and CLI instead.** A `migrateIndex()` function and `vectra migrate` CLI command handle format conversion. (See §5.3)

### 10.1 Float32 vs Float64 — Precision & Size Impact

**Size impact per 1536-dim vector:**

| Format | Vector Storage | Per-Vector Size | Savings vs JSON |
|---|---|---|---|
| JSON (text-encoded float64) | `[0.0023456789012345, ...]` | ~8-12 KB | — |
| Protobuf `double` (64-bit) | 8 bytes × 1536 dims | **12,288 bytes (~12 KB)** | ~20-30% (eliminates text overhead but same byte width) |
| Protobuf `float` (32-bit) | 4 bytes × 1536 dims | **6,144 bytes (~6 KB)** | **~40-50%** |

**Precision impact:**
- `float64`: ~15-16 significant decimal digits
- `float32`: ~7 significant decimal digits
- OpenAI embeddings typically have values like `0.023456789` — the last 8-9 digits are lost with float32

**Impact on cosine similarity:** Negligible. Published research and empirical tests show that float32 quantization of embedding vectors produces cosine similarity errors on the order of **10⁻⁷ to 10⁻⁶** — well below the threshold that would affect ranking or retrieval quality. The `norm` value is stored as `double` to avoid compounding rounding error during the dot-product calculation.

**Decision:** Use `float` (32-bit) for vectors. The ~50% size savings far outweigh the imperceptible precision loss. This matches industry practice — most vector databases (Pinecone, Weaviate, Qdrant) store embeddings as float32 by default.
