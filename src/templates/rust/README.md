# Vectra Rust Client

Thin idiomatic Rust wrapper over the Vectra gRPC service.

## Prerequisites

- Rust toolchain (`rustup`)
- `protoc` (Protocol Buffers compiler) — install via your package manager

## Setup

1. Copy the generated files (`vectra_service.proto`, `build.rs`, `Cargo.toml`, `lib.rs`) into your project.
2. Place `vectra_service.proto` in the crate root (next to `Cargo.toml`).
3. `tonic-build` in `build.rs` generates the stubs at compile time.

## Usage

```rust
use vectra_client::VectraClient;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut client = VectraClient::connect("http://127.0.0.1:50051").await?;

    // Create a document index
    client.create_index("my-index", "json", true).await?;

    // Add a document
    client.upsert_document("my-index", "doc1.txt", "Hello world...", None, None).await?;

    // Query
    let results = client.query_documents("my-index", "hello", None).await?;
    for doc in &results {
        println!("{} (score: {:.3})", doc.uri, doc.score);
    }

    Ok(())
}
```
