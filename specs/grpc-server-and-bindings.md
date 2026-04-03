# gRPC Server & Language Bindings

| Field       | Value                                |
|-------------|--------------------------------------|
| Status      | Approved                             |
| Author      | Scribe                               |
| Created     | 2026-04-02                           |
| Depends on  | `specs/binary-storage-format.md`     |

---

## 1. Problem

Vectra is a Node.js library. Users working in Python, C#, Rust, or any other language cannot use it. Loading a Vectra index into memory is expensive — CLI invocations pay that cost on every command. A persistent server process that keeps indexes loaded and exposes them over gRPC solves both problems: language-agnostic access and amortized startup cost.

## 2. Goals

1. Add a `vectra serve` CLI command that loads indexes and exposes them via a gRPC API on localhost
2. Support both **single-index** (`vectra serve <index>`) and **multi-index** (`vectra serve --root <dir>`) modes
3. Compute embeddings **server-side** — clients send text, not vectors
4. Support both **foreground** and **daemon** process lifecycle
5. Provide idiomatic client bindings for **Python**, **C#**, and **Rust**
6. Bind to `127.0.0.1` only (no auth required for v1)

## 3. Non-Goals

- Remote/networked access (future)
- Authentication or TLS (future — localhost only for now)
- Streaming large result sets (single unary responses are fine at Vectra's scale)
- Bindings for Go, Java, Ruby (can be added later from the same proto)

---

## 4. Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│  vectra serve <index> [--port 50051]                     │
│  vectra serve --root <dir> [--port 50051]                │
│  vectra serve --root <dir> --daemon [--pid-file ...]     │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  gRPC Server (localhost:50051)                     │  │
│  │                                                    │  │
│  │  VectraService                                     │  │
│  │    ├── Index Management                            │  │
│  │    │     CreateIndex / DeleteIndex / ListIndexes    │  │
│  │    ├── Item Operations                             │  │
│  │    │     InsertItem / UpsertItem / DeleteItem       │  │
│  │    │     GetItem / ListItems / BatchInsertItems     │  │
│  │    ├── Query                                       │  │
│  │    │     QueryItems / QueryDocuments               │  │
│  │    ├── Document Operations                         │  │
│  │    │     UpsertDocument / DeleteDocument            │  │
│  │    │     ListDocuments                              │  │
│  │    ├── Stats                                       │  │
│  │    │     GetIndexStats / GetCatalogStats            │  │
│  │    └── Lifecycle                                   │  │
│  │          Healthcheck / Shutdown                     │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  In-memory: loaded LocalIndex / LocalDocumentIndex       │
│  On-disk:   file-backed storage (JSON or Protobuf)       │
└──────────────────────────────────────────────────────────┘
         ▲              ▲              ▲
         │ gRPC         │ gRPC         │ gRPC
    ┌────┴───┐    ┌─────┴────┐    ┌───┴────┐
    │ Python │    │   C#     │    │  Rust  │
    │ client │    │  client  │    │ client │
    └────────┘    └──────────┘    └────────┘
```

---

## 5. Proto Service Definition

A new file `proto/vectra_service.proto` defines the gRPC service. It imports existing message types from `src/codecs/schemas/index.proto` where applicable and adds request/response wrappers.

```protobuf
syntax = "proto3";

package vectra;

// ─── Shared Types ───────────────────────────────────────

message MetadataValue {
  oneof value {
    string string_value = 1;
    double number_value = 2;
    bool bool_value = 3;
  }
}

message MetadataFilter {
  // JSON-encoded Pinecone-style filter, e.g.:
  //   {"category": {"$eq": "news"}, "score": {"$gte": 0.5}}
  // Kept as JSON string for simplicity — filter DSL is complex
  // and already implemented in JS. Avoids duplicating the AST in proto.
  string filter_json = 1;
}

message ItemResult {
  string id = 1;
  map<string, MetadataValue> metadata = 2;
  repeated float vector = 3;
  double norm = 4;
  double score = 5;  // only populated in query responses
}

// ─── Index Management ───────────────────────────────────

message CreateIndexRequest {
  string index_name = 1;
  // "json" or "protobuf" — maps to CreateIndexConfig.codec
  string format = 2;
  // For LocalDocumentIndex: version, tokenizer, chunking config
  bool is_document_index = 3;
  DocumentIndexConfig document_config = 4;
}

message DocumentIndexConfig {
  uint32 version = 1;
  string embeddings_model = 2;   // e.g. "text-embedding-3-small"
  uint32 chunk_size = 3;         // default 512
  uint32 chunk_overlap = 4;      // default 0
}

message CreateIndexResponse {}

message DeleteIndexRequest {
  string index_name = 1;
}

message DeleteIndexResponse {}

message ListIndexesRequest {}

message ListIndexesResponse {
  repeated IndexInfo indexes = 1;
}

message IndexInfo {
  string name = 1;
  string format = 2;         // "json" or "protobuf"
  bool is_document_index = 3;
}

// ─── Item Operations ────────────────────────────────────

message InsertItemRequest {
  string index_name = 1;
  // Text to embed (server computes the vector)
  string text = 2;
  // OR: raw vector (for LocalIndex users who bring their own vectors)
  repeated float vector = 3;
  map<string, MetadataValue> metadata = 4;
  // Optional: caller-provided ID (server generates UUID if omitted)
  string id = 5;
}

message InsertItemResponse {
  string id = 1;
}

message UpsertItemRequest {
  string index_name = 1;
  string id = 2;
  string text = 3;
  repeated float vector = 4;
  map<string, MetadataValue> metadata = 5;
}

message UpsertItemResponse {
  string id = 1;
}

message BatchInsertItemsRequest {
  string index_name = 1;
  repeated InsertItemRequest items = 2;
}

message BatchInsertItemsResponse {
  repeated string ids = 1;
}

message GetItemRequest {
  string index_name = 1;
  string id = 2;
}

message GetItemResponse {
  ItemResult item = 1;
}

message DeleteItemRequest {
  string index_name = 1;
  string id = 2;
}

message DeleteItemResponse {}

message ListItemsRequest {
  string index_name = 1;
  MetadataFilter filter = 2;  // optional
}

message ListItemsResponse {
  repeated ItemResult items = 1;
}

// ─── Query ──────────────────────────────────────────────

message QueryItemsRequest {
  string index_name = 1;
  string text = 2;               // server computes embedding
  repeated float vector = 3;     // OR: raw vector
  uint32 top_k = 4;              // default 10
  MetadataFilter filter = 5;
}

message QueryItemsResponse {
  repeated ItemResult results = 1;
}

message QueryDocumentsRequest {
  string index_name = 1;
  string query = 2;
  uint32 max_documents = 3;      // default 10
  uint32 max_chunks = 4;         // default 50
  MetadataFilter filter = 5;
  bool use_bm25 = 6;             // hybrid search
}

message DocumentResult {
  string uri = 1;
  string document_id = 2;
  repeated DocumentChunk chunks = 3;
  double score = 4;
}

message DocumentChunk {
  string text = 1;
  double score = 2;
  uint32 token_count = 3;
}

message QueryDocumentsResponse {
  repeated DocumentResult results = 1;
}

// ─── Document Operations ────────────────────────────────

message UpsertDocumentRequest {
  string index_name = 1;
  string uri = 2;
  string text = 3;
  string doc_type = 4;           // optional
  map<string, MetadataValue> metadata = 5;
}

message UpsertDocumentResponse {
  string document_id = 1;
}

message DeleteDocumentRequest {
  string index_name = 1;
  string uri = 2;
}

message DeleteDocumentResponse {}

message ListDocumentsRequest {
  string index_name = 1;
}

message ListDocumentsResponse {
  repeated DocumentInfo documents = 1;
}

message DocumentInfo {
  string uri = 1;
  string document_id = 2;
}

// ─── Stats ──────────────────────────────────────────────

message GetIndexStatsRequest {
  string index_name = 1;
}

message GetIndexStatsResponse {
  uint32 version = 1;
  string format = 2;
  uint32 item_count = 3;
  uint32 metadata_config_count = 4;
}

message GetCatalogStatsRequest {
  string index_name = 1;
}

message GetCatalogStatsResponse {
  uint32 version = 1;
  uint32 document_count = 2;
  uint32 chunk_count = 3;
  map<string, uint32> metadata_counts = 4;
}

// ─── Lifecycle ──────────────────────────────────────────

message HealthcheckRequest {}

message HealthcheckResponse {
  string status = 1;   // "ok"
  uint32 uptime_seconds = 2;
  uint32 loaded_indexes = 3;
}

message ShutdownRequest {}

message ShutdownResponse {}

// ─── Service ────────────────────────────────────────────

service VectraService {
  // Index Management
  rpc CreateIndex(CreateIndexRequest) returns (CreateIndexResponse);
  rpc DeleteIndex(DeleteIndexRequest) returns (DeleteIndexResponse);
  rpc ListIndexes(ListIndexesRequest) returns (ListIndexesResponse);

  // Item Operations
  rpc InsertItem(InsertItemRequest) returns (InsertItemResponse);
  rpc UpsertItem(UpsertItemRequest) returns (UpsertItemResponse);
  rpc BatchInsertItems(BatchInsertItemsRequest) returns (BatchInsertItemsResponse);
  rpc GetItem(GetItemRequest) returns (GetItemResponse);
  rpc DeleteItem(DeleteItemRequest) returns (DeleteItemResponse);
  rpc ListItems(ListItemsRequest) returns (ListItemsResponse);

  // Query
  rpc QueryItems(QueryItemsRequest) returns (QueryItemsResponse);
  rpc QueryDocuments(QueryDocumentsRequest) returns (QueryDocumentsResponse);

  // Document Operations
  rpc UpsertDocument(UpsertDocumentRequest) returns (UpsertDocumentResponse);
  rpc DeleteDocument(DeleteDocumentRequest) returns (DeleteDocumentResponse);
  rpc ListDocuments(ListDocumentsRequest) returns (ListDocumentsResponse);

  // Stats
  rpc GetIndexStats(GetIndexStatsRequest) returns (GetIndexStatsResponse);
  rpc GetCatalogStats(GetCatalogStatsRequest) returns (GetCatalogStatsResponse);

  // Lifecycle
  rpc Healthcheck(HealthcheckRequest) returns (HealthcheckResponse);
  rpc Shutdown(ShutdownRequest) returns (ShutdownResponse);
}
```

---

## 6. CLI Commands

### 6.1 `vectra serve` (new)

```
vectra serve <index>                     # single-index mode, foreground
vectra serve --root <dir>                # multi-index mode, foreground
vectra serve --root <dir> --daemon       # multi-index mode, background
vectra serve --root <dir> --port 50051   # custom port (default: 50051)
vectra serve --root <dir> --pid-file ./vectra.pid
```

| Flag | Default | Description |
|------|---------|-------------|
| `<index>` | — | Path to a single index directory. Mutually exclusive with `--root`. |
| `--root <dir>` | — | Directory containing multiple index subdirectories. Mutually exclusive with positional `<index>`. |
| `--port` | `50051` | Port to bind the gRPC server on `127.0.0.1`. |
| `--daemon` | `false` | Fork to background, write PID file, detach stdio. |
| `--pid-file` | `<root>/.vectra.pid` | Path to PID file (daemon mode only). |
| `--keys` | `./keys.json` | Path to API keys config (for embeddings). |

**Single-index mode:** The index is served as the only entry. `index_name` in all RPCs is ignored (or must match the directory name).

**Multi-index mode:** Each subdirectory under `--root` that contains a valid index is loaded and served. `CreateIndex` creates new subdirectories. `index_name` in RPCs maps to subdirectory names.

### 6.2 `vectra stop` (new)

```
vectra stop [--pid-file ./vectra.pid]    # graceful shutdown of daemon
```

Reads the PID file, sends `SIGTERM`, waits for graceful shutdown (up to 10s), then `SIGKILL` if needed. Alternatively, clients can call the `Shutdown` RPC.

---

## 7. Server Implementation

### 7.1 New Files

| File | Purpose |
|------|---------|
| `proto/vectra_service.proto` | Service definition (§5 above) |
| `src/server/VectraServer.ts` | gRPC server: loads indexes, registers handlers, manages lifecycle |
| `src/server/IndexManager.ts` | Manages loaded indexes (load, unload, create, delete, list) |
| `src/server/handlers/*.ts` | One handler file per RPC group (index, items, query, documents, stats, lifecycle) |
| `src/server/index.ts` | Barrel export |

### 7.2 Dependencies

| Package | Purpose | Required? |
|---------|---------|-----------|
| `@grpc/grpc-js` | gRPC server runtime | Required |
| `@grpc/proto-loader` | Dynamic proto loading | Required |

These are **required** dependencies (not optional) because the server feature is a core part of the bindings story.

### 7.3 Index Manager

The `IndexManager` class:

1. **On startup:** Scans `--root` directory (or loads single index). For each valid index:
   - Detects codec via `detectCodec()`
   - Detects whether it's a document index (has `catalog.json` or `catalog.pb`)
   - Creates `LocalIndex` or `LocalDocumentIndex` instance
   - Calls `beginUpdate()` to load into memory
2. **Auto-detect (multi-index mode):** Watches `--root` directory for new subdirectories. When a new valid index appears on disk, it is automatically loaded without requiring a `CreateIndex` RPC or server restart.
3. **On `CreateIndex` RPC:** Creates new index on disk, loads it
4. **On `DeleteIndex` RPC:** Unloads from memory, deletes from disk
5. **On shutdown:** Calls `endUpdate()` on all loaded indexes to flush pending writes

### 7.4 Embeddings

The server manages a shared `EmbeddingsModel` instance (configured via `--keys` / `keys.json`, same as the existing CLI). When an RPC includes `text` instead of a raw `vector`, the server:

1. Calls `embeddings.createEmbeddings(model, [text])`
2. Uses the resulting vector for the index operation

This keeps all bindings dead simple — clients send text, server handles embeddings.

### 7.5 Process Lifecycle

**Foreground mode (default):**
- Server runs in the terminal
- `Ctrl+C` triggers graceful shutdown
- Logs to stdout

**Daemon mode (`--daemon`):**
- Forks child process, parent exits immediately
- Child writes PID to `--pid-file`
- Logs to `<root>/.vectra-server.log` (or `<index>/../.vectra-server.log`)
- `SIGTERM` triggers graceful shutdown
- `vectra stop` reads PID file and sends `SIGTERM`

### 7.6 Error Handling

gRPC status codes map naturally:

| Condition | gRPC Status |
|-----------|-------------|
| Index not found | `NOT_FOUND` |
| Index already exists | `ALREADY_EXISTS` |
| Missing required field | `INVALID_ARGUMENT` |
| Both `text` and `vector` empty | `INVALID_ARGUMENT` |
| Embeddings API failure | `INTERNAL` |
| Index not a document index | `FAILED_PRECONDITION` |

---

## 8. Language Bindings

> **Revised approach (2026-04-02):** Instead of maintaining separate published packages on PyPI/NuGet/crates.io, bindings are generated locally via `vectra generate`. The proto file ships with the npm package. Each language gets a thin idiomatic wrapper template that is copied alongside the generated gRPC stubs.

### 8.1 CLI Command: `vectra generate`

```bash
vectra generate --language python --output ./my-project/vectra/
vectra generate --language csharp --output ./my-project/VectraClient/
vectra generate --language rust   --output ./my-project/src/vectra/
```

The command:
1. Locates `vectra_service.proto` (shipped in the npm package under `proto/`)
2. Copies it to the output directory
3. Copies the thin idiomatic wrapper template and README for the target language
4. Prints next-step instructions for generating gRPC stubs

Users then run the standard gRPC codegen for their language (e.g., `grpcio-tools` for Python, `Grpc.Tools` for C#, `tonic-build` for Rust).

### 8.2 Template Structure (shipped in npm package)

```
src/templates/
├── python/
│   ├── vectra_client.py              # VectraClient class (~200 lines)
│   └── README.md                     # install + codegen + usage
├── csharp/
│   ├── VectraClient.cs               # VectraClient class (~200 lines)
│   └── README.md                     # NuGet packages + .csproj setup
└── rust/
    ├── lib.rs                        # VectraClient struct (~250 lines)
    ├── build.rs                      # tonic-build proto compilation
    ├── Cargo.toml                    # crate manifest
    └── README.md                     # protoc + cargo build
```

### 8.2 Python Binding

**Package name:** `vectra-client`
**Dependencies:** `grpcio`, `grpcio-tools`, `protobuf`
**Generated with:** `grpcio-tools` (`python -m grpc_tools.protoc`)

```python
from vectra import VectraClient

client = VectraClient(port=50051)

# Query documents (text-based — server handles embeddings)
results = client.query_documents("my-index", "what is vectra?", max_documents=5)
for doc in results:
    print(f"{doc.uri}: {doc.score:.3f}")
    for chunk in doc.chunks:
        print(f"  {chunk.text[:80]}...")

# Insert an item with metadata
client.insert_item("my-index", text="hello world", metadata={"category": "greeting"})

# Query items with filter
results = client.query_items("my-index", text="hello", top_k=5,
                             filter={"category": {"$eq": "greeting"}})
```

**Wrapper API (thin, ~150 lines):**

| Method | Maps to RPC |
|--------|-------------|
| `create_index(name, format, is_document, config)` | `CreateIndex` |
| `delete_index(name)` | `DeleteIndex` |
| `list_indexes()` | `ListIndexes` |
| `insert_item(index, text, metadata, id)` | `InsertItem` |
| `upsert_item(index, id, text, metadata)` | `UpsertItem` |
| `batch_insert_items(index, items)` | `BatchInsertItems` |
| `get_item(index, id)` | `GetItem` |
| `delete_item(index, id)` | `DeleteItem` |
| `list_items(index, filter)` | `ListItems` |
| `query_items(index, text, top_k, filter)` | `QueryItems` |
| `query_documents(index, query, max_documents, max_chunks, filter, use_bm25)` | `QueryDocuments` |
| `upsert_document(index, uri, text, doc_type, metadata)` | `UpsertDocument` |
| `delete_document(index, uri)` | `DeleteDocument` |
| `list_documents(index)` | `ListDocuments` |
| `get_index_stats(index)` | `GetIndexStats` |
| `get_catalog_stats(index)` | `GetCatalogStats` |
| `healthcheck()` | `Healthcheck` |
| `shutdown()` | `Shutdown` |

### 8.3 C# Binding

**Package name:** `Vectra.Client`
**Target:** .NET 8+ (`net8.0`)
**Dependencies:** `Grpc.Net.Client`, `Google.Protobuf`, `Grpc.Tools` (build-time codegen)
**NuGet-publishable:** Yes

```csharp
using Vectra.Client;

var client = new VectraClient(port: 50051);

// Query documents
var results = await client.QueryDocumentsAsync("my-index", "what is vectra?", maxDocuments: 5);
foreach (var doc in results)
{
    Console.WriteLine($"{doc.Uri}: {doc.Score:F3}");
}

// Insert item with metadata
await client.InsertItemAsync("my-index", text: "hello world",
    metadata: new() { ["category"] = "greeting" });
```

Same method surface as Python, using C# idioms (`async/await`, `Dictionary<string, object>` for metadata, nullable parameters).

### 8.4 Rust Binding

**Crate name:** `vectra-client`
**Dependencies:** `tonic` (gRPC), `prost` (protobuf), `tokio` (async runtime)
**Generated with:** `tonic-build` in `build.rs`

```rust
use vectra_client::VectraClient;
use std::collections::HashMap;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = VectraClient::connect(50051).await?;

    // Query documents
    let results = client.query_documents("my-index", "what is vectra?", 5, 50, None, false).await?;
    for doc in &results {
        println!("{}: {:.3}", doc.uri, doc.score);
    }

    // Insert item
    let mut metadata = HashMap::new();
    metadata.insert("category".into(), "greeting".into());
    client.insert_item("my-index", Some("hello world"), None, metadata, None).await?;

    Ok(())
}
```

---

## 9. Rollout Plan

### Phase 1: Proto + Server Core ✅
- Define `proto/vectra_service.proto`
- Implement `VectraServer`, `IndexManager`, and all RPC handlers
- Add `vectra serve` and `vectra stop` CLI commands
- Integration tests: start server, call RPCs via `@grpc/grpc-js` client

### Phase 2: `vectra generate` + Wrapper Templates ✅
- Implement `vectra generate --language <lang> --output <dir>` CLI command
- Create thin idiomatic wrapper templates for Python, C#, and Rust
- Templates shipped in `src/templates/` and copied to `lib/templates/` at build time
- Integration tests: generate bindings for each language, verify output files

### Phase 3: Documentation & Samples
- Update README.md with `vectra generate` usage
- Add sample projects for each language showing end-to-end usage
- Update docs site

---

## 10. Resolved Questions

1. **Generated gRPC stubs: committed or generated at build time?**
   - **Decision:** Generated at build time, **gitignored**. Each binding has a `make generate` (or equivalent) build step. Avoids version drift between proto and stubs. Add `_generated/`, `generated/` patterns to `.gitignore`.

2. **Package publishing pipeline?**
   - **Decision (revised 2026-04-02):** No separate packages. The proto file ships with the npm package. Users generate bindings locally via `vectra generate`. The three publish workflows (Python/C#/Rust) created earlier should be removed — only the npm publish workflow is needed.

3. **Should `vectra serve` auto-detect new indexes at runtime?**
   - **Decision:** **Yes, auto-detect.** When running in multi-index mode (`--root`), the server watches the root directory for new index subdirectories and loads them automatically. No restart or `CreateIndex` RPC required for indexes added to disk externally.

4. **Graceful connection draining on shutdown?**
   - **Decision:** **Yes.** gRPC server waits for in-flight RPCs (up to 5s) before force-closing connections.
