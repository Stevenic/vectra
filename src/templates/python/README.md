# Vectra Python Client

Thin idiomatic Python wrapper over the Vectra gRPC service.

## Prerequisites

```bash
pip install grpcio grpcio-tools
```

## Generate gRPC stubs

```bash
python -m grpc_tools.protoc -I. --python_out=. --grpc_python_out=. vectra_service.proto
```

This produces `vectra_service_pb2.py` and `vectra_service_pb2_grpc.py`.

## Usage

```python
from vectra_client import VectraClient

with VectraClient() as client:
    # Create a document index
    client.create_index("my-index", is_document_index=True)

    # Add a document
    client.upsert_document("my-index", "doc1.txt", "Hello world...")

    # Query
    results = client.query_documents("my-index", "hello")
    for doc in results:
        print(f"{doc['uri']} (score: {doc['score']:.3f})")
        for chunk in doc["chunks"]:
            print(f"  {chunk['text'][:80]}...")
```
