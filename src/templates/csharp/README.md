# Vectra C# Client

Thin idiomatic C# wrapper over the Vectra gRPC service.

## Prerequisites

Add these NuGet packages to your project:

```bash
dotnet add package Grpc.Net.Client
dotnet add package Google.Protobuf
dotnet add package Grpc.Tools
```

## Generate gRPC stubs

Add to your `.csproj`:

```xml
<ItemGroup>
  <Protobuf Include="vectra_service.proto" GrpcServices="Client" />
</ItemGroup>
```

The stubs are generated automatically at build time by `Grpc.Tools`.

## Usage

```csharp
using Vectra.Client;

using var client = new VectraClient();

// Create a document index
await client.CreateIndexAsync("my-index", isDocumentIndex: true);

// Add a document
await client.UpsertDocumentAsync("my-index", "doc1.txt", "Hello world...");

// Query
var results = await client.QueryDocumentsAsync("my-index", "hello");
foreach (var doc in results)
{
    Console.WriteLine($"{doc.Uri} (score: {doc.Score:F3})");
    foreach (var chunk in doc.Chunks)
        Console.WriteLine($"  {chunk.Text[..Math.Min(80, chunk.Text.Length)]}...");
}
```
