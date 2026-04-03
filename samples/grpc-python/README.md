# gRPC Python Client Sample

Demonstrates using Vectra's gRPC server from Python. The server handles embeddings — the client just sends text.

## Prerequisites

- Node.js 22.x or later (for the Vectra server)
- Python 3.9 or later
- An OpenAI API key

## Setup

### 1. Start the gRPC server

```bash
# Create an index
vectra create ./my-index

# Create keys.json
cat > keys.json << 'EOF'
{
  "apiKey": "sk-...",
  "model": "text-embedding-3-small",
  "maxTokens": 8000
}
EOF

# Start the server
vectra serve ./my-index --keys ./keys.json --port 50051
```

### 2. Generate Python bindings

```bash
vectra generate --language python --output ./python-client
```

### 3. Install Python dependencies

```bash
pip install grpcio grpcio-tools
```

### 4. Compile proto stubs

```bash
cd python-client
python -m grpc_tools.protoc \
  -I. \
  --python_out=. \
  --grpc_python_out=. \
  vectra_service.proto
```

### 5. Run the client

```bash
python client.py
```

## Multi-Index Mode

To serve multiple indexes at once:

```bash
vectra serve --root ./indexes --keys ./keys.json --port 50051
```

See [client_multi.py](./client_multi.py) for multi-index operations.

## Learn More

- [Cross-Language gRPC tutorial](https://stevenic.github.io/vectra/tutorials/cross-language)
- [gRPC Server guide](https://stevenic.github.io/vectra/grpc)
