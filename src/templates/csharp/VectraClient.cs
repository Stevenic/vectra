// Vectra gRPC client — thin idiomatic wrapper over generated stubs.
//
// Usage:
//   using var client = new VectraClient();
//   var results = await client.QueryDocumentsAsync("my-index", "search query");
//
// Generate stubs first (see README.md).

using System.Text.Json;
using Grpc.Net.Client;
using Vectra;

namespace Vectra.Client;

/// <summary>Idiomatic C# client for the Vectra gRPC server.</summary>
public sealed class VectraClient : IDisposable
{
    private readonly GrpcChannel _channel;
    private readonly VectraService.VectraServiceClient _stub;

    public VectraClient(string host = "127.0.0.1", int port = 50051)
    {
        _channel = GrpcChannel.ForAddress($"http://{host}:{port}");
        _stub = new VectraService.VectraServiceClient(_channel);
    }

    public void Dispose() => _channel.Dispose();

    // ── Index Management ──────────────────────────────────

    public async Task CreateIndexAsync(
        string name,
        string format = "json",
        bool isDocumentIndex = false,
        uint chunkSize = 512,
        uint chunkOverlap = 0)
    {
        var req = new CreateIndexRequest
        {
            IndexName = name,
            Format = format,
            IsDocumentIndex = isDocumentIndex,
        };
        if (isDocumentIndex)
        {
            req.DocumentConfig = new DocumentIndexConfig
            {
                Version = 1,
                ChunkSize = chunkSize,
                ChunkOverlap = chunkOverlap,
            };
        }
        await _stub.CreateIndexAsync(req);
    }

    public async Task DeleteIndexAsync(string name)
        => await _stub.DeleteIndexAsync(new DeleteIndexRequest { IndexName = name });

    public async Task<List<IndexInfo>> ListIndexesAsync()
    {
        var resp = await _stub.ListIndexesAsync(new ListIndexesRequest());
        return resp.Indexes.ToList();
    }

    // ── Item Operations ───────────────────────────────────

    public async Task<string> InsertItemAsync(
        string index,
        string text = "",
        IEnumerable<float>? vector = null,
        Dictionary<string, object>? metadata = null,
        string id = "")
    {
        var req = new InsertItemRequest
        {
            IndexName = index,
            Text = text,
            Id = id,
        };
        if (vector != null) req.Vector.AddRange(vector);
        if (metadata != null) SetMetadata(req.Metadata, metadata);
        var resp = await _stub.InsertItemAsync(req);
        return resp.Id;
    }

    public async Task<string> UpsertItemAsync(
        string index,
        string id,
        string text = "",
        IEnumerable<float>? vector = null,
        Dictionary<string, object>? metadata = null)
    {
        var req = new UpsertItemRequest
        {
            IndexName = index,
            Id = id,
            Text = text,
        };
        if (vector != null) req.Vector.AddRange(vector);
        if (metadata != null) SetMetadata(req.Metadata, metadata);
        var resp = await _stub.UpsertItemAsync(req);
        return resp.Id;
    }

    public async Task<ItemResult?> GetItemAsync(string index, string id)
    {
        var resp = await _stub.GetItemAsync(new GetItemRequest { IndexName = index, Id = id });
        return resp.Item;
    }

    public async Task DeleteItemAsync(string index, string id)
        => await _stub.DeleteItemAsync(new DeleteItemRequest { IndexName = index, Id = id });

    public async Task<List<ItemResult>> ListItemsAsync(
        string index,
        Dictionary<string, object>? filter = null)
    {
        var req = new ListItemsRequest { IndexName = index };
        if (filter != null)
            req.Filter = new MetadataFilter { FilterJson = JsonSerializer.Serialize(filter) };
        var resp = await _stub.ListItemsAsync(req);
        return resp.Items.ToList();
    }

    // ── Query ─────────────────────────────────────────────

    public async Task<List<ItemResult>> QueryItemsAsync(
        string index,
        string text = "",
        IEnumerable<float>? vector = null,
        uint topK = 10,
        Dictionary<string, object>? filter = null)
    {
        var req = new QueryItemsRequest
        {
            IndexName = index,
            Text = text,
            TopK = topK,
        };
        if (vector != null) req.Vector.AddRange(vector);
        if (filter != null)
            req.Filter = new MetadataFilter { FilterJson = JsonSerializer.Serialize(filter) };
        var resp = await _stub.QueryItemsAsync(req);
        return resp.Results.ToList();
    }

    public async Task<List<DocumentResult>> QueryDocumentsAsync(
        string index,
        string query,
        uint maxDocuments = 10,
        uint maxChunks = 50,
        Dictionary<string, object>? filter = null,
        bool useBm25 = false)
    {
        var req = new QueryDocumentsRequest
        {
            IndexName = index,
            Query = query,
            MaxDocuments = maxDocuments,
            MaxChunks = maxChunks,
            UseBm25 = useBm25,
        };
        if (filter != null)
            req.Filter = new MetadataFilter { FilterJson = JsonSerializer.Serialize(filter) };
        var resp = await _stub.QueryDocumentsAsync(req);
        return resp.Results.ToList();
    }

    // ── Document Operations ───────────────────────────────

    public async Task<string> UpsertDocumentAsync(
        string index,
        string uri,
        string text,
        string docType = "",
        Dictionary<string, object>? metadata = null)
    {
        var req = new UpsertDocumentRequest
        {
            IndexName = index,
            Uri = uri,
            Text = text,
            DocType = docType,
        };
        if (metadata != null) SetMetadata(req.Metadata, metadata);
        var resp = await _stub.UpsertDocumentAsync(req);
        return resp.DocumentId;
    }

    public async Task DeleteDocumentAsync(string index, string uri)
        => await _stub.DeleteDocumentAsync(new DeleteDocumentRequest { IndexName = index, Uri = uri });

    public async Task<List<DocumentInfo>> ListDocumentsAsync(string index)
    {
        var resp = await _stub.ListDocumentsAsync(new ListDocumentsRequest { IndexName = index });
        return resp.Documents.ToList();
    }

    // ── Stats ─────────────────────────────────────────────

    public async Task<GetIndexStatsResponse> GetIndexStatsAsync(string index)
        => await _stub.GetIndexStatsAsync(new GetIndexStatsRequest { IndexName = index });

    public async Task<GetCatalogStatsResponse> GetCatalogStatsAsync(string index)
        => await _stub.GetCatalogStatsAsync(new GetCatalogStatsRequest { IndexName = index });

    // ── Lifecycle ─────────────────────────────────────────

    public async Task<HealthcheckResponse> HealthcheckAsync()
        => await _stub.HealthcheckAsync(new HealthcheckRequest());

    public async Task ShutdownAsync()
        => await _stub.ShutdownAsync(new ShutdownRequest());

    // ── Helpers ───────────────────────────────────────────

    private static void SetMetadata(
        Google.Protobuf.Collections.MapField<string, MetadataValue> protoMap,
        Dictionary<string, object> metadata)
    {
        foreach (var (key, value) in metadata)
        {
            protoMap[key] = value switch
            {
                bool b => new MetadataValue { BoolValue = b },
                int i => new MetadataValue { NumberValue = i },
                long l => new MetadataValue { NumberValue = l },
                float f => new MetadataValue { NumberValue = f },
                double d => new MetadataValue { NumberValue = d },
                _ => new MetadataValue { StringValue = value?.ToString() ?? "" },
            };
        }
    }
}
