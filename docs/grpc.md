---
title: gRPC Server
layout: default
nav_order: 8
---

# gRPC Server
{: .no_toc }

Cross-language access to Vectra indexes via gRPC.
{: .fs-6 .fw-300 }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Overview

Vectra includes a built-in gRPC server that exposes all index operations over the network. This lets any language use Vectra as a vector database — clients send text, the server computes embeddings and executes operations. The server binds to `127.0.0.1` (localhost only).

## Starting the server

### Single-index mode

Serve one index:

```sh
npx vectra serve ./my-index --keys ./keys.json --port 50051
```

### Multi-index mode

Serve all indexes under a directory. The server auto-detects index subdirectories, and new indexes can be created via the `CreateIndex` RPC.

```sh
npx vectra serve --root ./indexes --keys ./keys.json
```

### Daemon mode

Run in the background:

```sh
npx vectra serve ./my-index --keys ./keys.json --daemon --pid-file ./vectra.pid
npx vectra stop --pid-file ./vectra.pid   # stop later
```

### Server options

| Flag | Default | Description |
|------|---------|-------------|
| `--root <dir>` | -- | Directory containing multiple index subdirectories |
| `--port` | 50051 | Port to bind the gRPC server on |
| `--keys` | -- | Path to keys.json for server-side embeddings |
| `--daemon` | false | Fork to background as a daemon process |
| `--pid-file` | auto | Path to PID file (daemon mode) |

## Service API

The `VectraService` gRPC service provides 19 RPCs:

| Category | RPCs |
|----------|------|
| **Index Management** | `CreateIndex`, `DeleteIndex`, `ListIndexes` |
| **Item Operations** | `InsertItem`, `UpsertItem`, `BatchInsertItems`, `GetItem`, `DeleteItem`, `ListItems` |
| **Query** | `QueryItems`, `QueryDocuments` |
| **Document Operations** | `UpsertDocument`, `DeleteDocument`, `ListDocuments` |
| **Stats** | `GetIndexStats`, `GetCatalogStats` |
| **Lifecycle** | `Healthcheck`, `Shutdown` |

The full service definition is in [`proto/vectra_service.proto`](https://github.com/Stevenic/vectra/blob/main/proto/vectra_service.proto).

### Key patterns

- **Embeddings are server-side** — clients send text, the server generates vectors using the configured embeddings provider.
- **Multi-index addressing** — in multi-index mode, RPCs that target a specific index accept an `index_name` field.
- **Graceful shutdown** — the `Shutdown` RPC (and `vectra stop`) allow a 5-second draining window for in-flight requests.

## Language bindings

Generate idiomatic client scaffolding for your language:

```sh
npx vectra generate --language <lang> --output <dir>
```

Each generated package includes the `.proto` file, an idiomatic client wrapper, and a README with setup instructions.

### Supported languages

| Language | Client Class | Package Ecosystem | Notes |
|----------|-------------|-------------------|-------|
| Python | `VectraClient` | `grpcio` | Run `protoc` to generate stubs |
| C# | `VectraClient` | `Grpc.Net.Client` | Add Protobuf item to `.csproj` |
| Rust | `vectra-client` crate | `tonic` | `build.rs` generates stubs |
| Go | `VectraClient` | `google.golang.org/grpc` | Run `protoc` for stubs |
| Java | `VectraClient` | gRPC Java | Place proto in `src/main/proto/` |
| TypeScript | `VectraClient` | `@grpc/grpc-js` | Dynamic proto loading, no codegen |

### Example: Python client

```python
from vectra_client import VectraClient

client = VectraClient('localhost:50051')

# Insert a document (server handles embedding)
client.upsert_document(
    index_name='my-index',
    uri='doc://readme',
    text='Your document text...',
    doc_type='md'
)

# Query by text
results = client.query_documents(
    index_name='my-index',
    query='What is Vectra?',
    max_documents=5
)
```

### Example: C# client

```csharp
using Vectra.Client;

var client = new VectraClient("localhost:50051");

await client.UpsertDocumentAsync(
    indexName: "my-index",
    uri: "doc://readme",
    text: "Your document text...",
    docType: "md"
);

var results = await client.QueryDocumentsAsync(
    indexName: "my-index",
    query: "What is Vectra?",
    maxDocuments: 5
);
```

### Example: Rust client

```rust
use vectra_client::VectraClient;

let client = VectraClient::connect("http://localhost:50051").await?;

client.upsert_document(
    "my-index",
    "doc://readme",
    "Your document text...",
    Some("md"),
).await?;

let results = client.query_documents(
    "my-index",
    "What is Vectra?",
    5,
).await?;
```
