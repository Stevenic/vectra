---
title: Cross-Language with gRPC
layout: default
parent: Tutorials
nav_order: 4
---

# Cross-Language with gRPC
{: .no_toc }

Start the Vectra gRPC server and query it from Python.
{: .fs-6 .fw-300 }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## What you'll build

A cross-language setup where:

1. A Vectra gRPC server runs in Node.js, managing indexes and computing embeddings
2. A Python client connects to the server, ingests documents, and runs queries
3. The server handles all the heavy lifting — the Python client just sends text

## Prerequisites

- Node.js 22.x or newer
- Python 3.8 or newer
- An OpenAI API key (for server-side embeddings)

```sh
# Node.js — install Vectra globally for the CLI
npm install -g vectra

# Python — install gRPC
pip install grpcio grpcio-tools
```

## Step 1: Create an index and keys file

```sh
# Create the index
vectra create ./my-index

# Create keys.json for the embeddings provider
cat > keys.json << 'EOF'
{
  "apiKey": "sk-...",
  "model": "text-embedding-3-small",
  "maxTokens": 8000
}
EOF
```

## Step 2: Start the gRPC server

### Single-index mode

Serve one index:

```sh
vectra serve ./my-index --keys ./keys.json --port 50051
```

### Multi-index mode

Serve all indexes under a directory — the server auto-detects index subdirectories:

```sh
vectra serve --root ./indexes --keys ./keys.json --port 50051
```

### Daemon mode

Run in the background:

```sh
vectra serve ./my-index --keys ./keys.json --daemon --pid-file ./vectra.pid

# Stop later
vectra stop --pid-file ./vectra.pid
```

{: .note }
The server binds to `127.0.0.1` (localhost only). There's no authentication in v1 — it's designed for local development and single-machine deployments.

## Step 3: Generate Python bindings

```sh
vectra generate --language python --output ./python-client
```

This creates a directory with:
- `vectra_service.proto` — the gRPC service definition
- `vectra_client.py` — an idiomatic Python wrapper
- `README.md` — setup instructions

Follow the generated README to compile the proto stubs:

```sh
cd python-client
python -m grpc_tools.protoc \
  -I. \
  --python_out=. \
  --grpc_python_out=. \
  vectra_service.proto
```

## Step 4: Write the Python client

```python
from vectra_client import VectraClient

client = VectraClient('localhost:50051')

# --- Ingest documents ---
# The server computes embeddings — you just send text
client.upsert_document(
    index_name='my-index',
    uri='doc://python-guide',
    text='''
    Python is a high-level, general-purpose programming language.
    Its design philosophy emphasizes code readability with the use
    of significant indentation.
    ''',
    doc_type='txt'
)

client.upsert_document(
    index_name='my-index',
    uri='doc://rust-guide',
    text='''
    Rust is a systems programming language focused on safety,
    speed, and concurrency. It achieves memory safety without
    garbage collection.
    ''',
    doc_type='txt'
)

print('Documents ingested.')

# --- Query ---
results = client.query_documents(
    index_name='my-index',
    query='Which language focuses on memory safety?',
    max_documents=3
)

for result in results:
    print(f'URI: {result.uri}  Score: {result.score:.4f}')
    for section in result.sections:
        print(f'  {section.text[:100]}...')
```

## Step 5: Run it

Terminal 1 — start the server:

```sh
vectra serve ./my-index --keys ./keys.json --port 50051
```

Terminal 2 — run the Python client:

```sh
cd python-client
python my_client.py
```

Expected output:

```
Documents ingested.
URI: doc://rust-guide  Score: 0.8932
  Rust is a systems programming language focused on safety, speed, and concurrency...
```

## Multi-index operations

In multi-index mode, you can create and manage indexes from the client:

```python
client = VectraClient('localhost:50051')

# List available indexes
indexes = client.list_indexes()
print('Available indexes:', indexes)

# Create a new index
client.create_index('new-index')

# All operations specify which index to target
client.upsert_document(
    index_name='new-index',
    uri='doc://test',
    text='Test document for the new index.',
    doc_type='txt'
)

# Get index stats
stats = client.get_index_stats('new-index')
print(f'Items: {stats.item_count}')
```

## Service API reference

The gRPC server exposes 19 RPCs across 6 categories:

| Category | RPCs |
|----------|------|
| **Index Management** | `CreateIndex`, `DeleteIndex`, `ListIndexes` |
| **Item Operations** | `InsertItem`, `UpsertItem`, `BatchInsertItems`, `GetItem`, `DeleteItem`, `ListItems` |
| **Query** | `QueryItems`, `QueryDocuments` |
| **Document Operations** | `UpsertDocument`, `DeleteDocument`, `ListDocuments` |
| **Stats** | `GetIndexStats`, `GetCatalogStats` |
| **Lifecycle** | `Healthcheck`, `Shutdown` |

See the [gRPC Server](/vectra/grpc) guide for the full API and examples in C# and Rust.

## Other languages

The `vectra generate` command supports 6 languages:

```sh
vectra generate --language csharp --output ./csharp-client
vectra generate --language rust --output ./rust-client
vectra generate --language go --output ./go-client
vectra generate --language java --output ./java-client
vectra generate --language typescript --output ./ts-client
```

Each generated package includes the proto file, an idiomatic client wrapper, and language-specific setup instructions. See the [gRPC Server — Language Bindings](/vectra/grpc#language-bindings) for client examples in C# and Rust.

## Next steps

- **Daemon mode** — use `--daemon` for production deployments. See [gRPC Server](/vectra/grpc#daemon-mode).
- **Protocol Buffers** — create the index with `vectra create ./my-index --format protobuf` for smaller on-disk files.
- **Monitor** — the `Healthcheck` RPC can be used for liveness probes.
- **Graceful shutdown** — the `Shutdown` RPC and `vectra stop` allow a 5-second draining window for in-flight requests.
