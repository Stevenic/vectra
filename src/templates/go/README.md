# Vectra Go Client

Thin idiomatic Go wrapper over the Vectra gRPC service.

## Prerequisites

- Go 1.21+
- `protoc` (Protocol Buffers compiler) — install via your package manager

```bash
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
```

## Generate gRPC stubs

```bash
protoc --go_out=. --go-grpc_out=. vectra_service.proto
```

This produces `vectra_service.pb.go` and `vectra_service_grpc.pb.go` in the `vectra_service/` directory.

## Setup

1. Update the import path in `vectra_client.go` to match your module (replace `your_module/vectra_service`).
2. Run `go mod init` if you haven't already, then `go mod tidy` to fetch dependencies.

## Usage

```go
package main

import (
    "context"
    "fmt"
    "log"

    vectra "your_module/vectra" // adjust import path
)

func main() {
    client, err := vectra.NewClient("127.0.0.1:50051")
    if err != nil {
        log.Fatal(err)
    }
    defer client.Close()

    ctx := context.Background()

    // Create a document index
    err = client.CreateIndex(ctx, "my-index", "json", true)
    if err != nil {
        log.Fatal(err)
    }

    // Add a document
    _, err = client.UpsertDocument(ctx, "my-index", "doc1.txt", "Hello world...", "", nil)
    if err != nil {
        log.Fatal(err)
    }

    // Query
    results, err := client.QueryDocuments(ctx, "my-index", "hello", nil)
    if err != nil {
        log.Fatal(err)
    }
    for _, doc := range results {
        fmt.Printf("%s (score: %.3f)\n", doc.Uri, doc.Score)
    }
}
```
