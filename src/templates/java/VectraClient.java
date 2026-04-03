// Vectra gRPC client — thin idiomatic wrapper over generated stubs.
//
// Usage:
//   try (VectraClient client = new VectraClient()) {
//       List<DocumentResult> results = client.queryDocuments("my-index", "search query");
//   }
//
// Generate stubs first (see README.md).

package io.github.vectra.client;

import com.google.protobuf.util.JsonFormat;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import vectra.VectraServiceGrpc;
import vectra.VectraServiceProto.*;

import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * Idiomatic Java client for the Vectra gRPC server.
 */
public class VectraClient implements AutoCloseable {
    private final ManagedChannel channel;
    private final VectraServiceGrpc.VectraServiceBlockingStub stub;

    public VectraClient() {
        this("127.0.0.1", 50051);
    }

    public VectraClient(String host, int port) {
        this.channel = ManagedChannelBuilder.forAddress(host, port)
                .usePlaintext()
                .build();
        this.stub = VectraServiceGrpc.newBlockingStub(channel);
    }

    @Override
    public void close() {
        try {
            channel.shutdown().awaitTermination(5, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            channel.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }

    // ── Index Management ──────────────────────────────────

    public void createIndex(String name) {
        createIndex(name, "json", false, 512, 0);
    }

    public void createIndex(String name, String format, boolean isDocumentIndex,
                            int chunkSize, int chunkOverlap) {
        CreateIndexRequest.Builder req = CreateIndexRequest.newBuilder()
                .setIndexName(name)
                .setFormat(format)
                .setIsDocumentIndex(isDocumentIndex);
        if (isDocumentIndex) {
            req.setDocumentConfig(DocumentIndexConfig.newBuilder()
                    .setVersion(1)
                    .setChunkSize(chunkSize)
                    .setChunkOverlap(chunkOverlap)
                    .build());
        }
        stub.createIndex(req.build());
    }

    public void deleteIndex(String name) {
        stub.deleteIndex(DeleteIndexRequest.newBuilder().setIndexName(name).build());
    }

    public List<IndexInfo> listIndexes() {
        ListIndexesResponse resp = stub.listIndexes(ListIndexesRequest.getDefaultInstance());
        return resp.getIndexesList();
    }

    // ── Item Operations ───────────────────────────────────

    public String insertItem(String index, String text) {
        return insertItem(index, text, null, null, "");
    }

    public String insertItem(String index, String text, List<Float> vector,
                             Map<String, MetadataValue> metadata, String id) {
        InsertItemRequest.Builder req = InsertItemRequest.newBuilder()
                .setIndexName(index)
                .setText(text)
                .setId(id != null ? id : "");
        if (vector != null) req.addAllVector(vector);
        if (metadata != null) req.putAllMetadata(metadata);
        return stub.insertItem(req.build()).getId();
    }

    public String upsertItem(String index, String id, String text, List<Float> vector,
                             Map<String, MetadataValue> metadata) {
        UpsertItemRequest.Builder req = UpsertItemRequest.newBuilder()
                .setIndexName(index)
                .setId(id)
                .setText(text);
        if (vector != null) req.addAllVector(vector);
        if (metadata != null) req.putAllMetadata(metadata);
        return stub.upsertItem(req.build()).getId();
    }

    public ItemResult getItem(String index, String id) {
        GetItemResponse resp = stub.getItem(
                GetItemRequest.newBuilder().setIndexName(index).setId(id).build());
        return resp.hasItem() ? resp.getItem() : null;
    }

    public void deleteItem(String index, String id) {
        stub.deleteItem(DeleteItemRequest.newBuilder().setIndexName(index).setId(id).build());
    }

    public List<ItemResult> listItems(String index) {
        return listItems(index, null);
    }

    public List<ItemResult> listItems(String index, String filterJson) {
        ListItemsRequest.Builder req = ListItemsRequest.newBuilder().setIndexName(index);
        if (filterJson != null && !filterJson.isEmpty()) {
            req.setFilter(MetadataFilter.newBuilder().setFilterJson(filterJson).build());
        }
        return stub.listItems(req.build()).getItemsList();
    }

    // ── Query ─────────────────────────────────────────────

    public List<ItemResult> queryItems(String index, String text, int topK) {
        return queryItems(index, text, topK, null);
    }

    public List<ItemResult> queryItems(String index, String text, int topK, String filterJson) {
        QueryItemsRequest.Builder req = QueryItemsRequest.newBuilder()
                .setIndexName(index)
                .setText(text)
                .setTopK(topK);
        if (filterJson != null && !filterJson.isEmpty()) {
            req.setFilter(MetadataFilter.newBuilder().setFilterJson(filterJson).build());
        }
        return stub.queryItems(req.build()).getResultsList();
    }

    public List<DocumentResult> queryDocuments(String index, String query) {
        return queryDocuments(index, query, 10, 50, null, false);
    }

    public List<DocumentResult> queryDocuments(String index, String query,
                                                int maxDocuments, int maxChunks,
                                                String filterJson, boolean useBm25) {
        QueryDocumentsRequest.Builder req = QueryDocumentsRequest.newBuilder()
                .setIndexName(index)
                .setQuery(query)
                .setMaxDocuments(maxDocuments)
                .setMaxChunks(maxChunks)
                .setUseBm25(useBm25);
        if (filterJson != null && !filterJson.isEmpty()) {
            req.setFilter(MetadataFilter.newBuilder().setFilterJson(filterJson).build());
        }
        return stub.queryDocuments(req.build()).getResultsList();
    }

    // ── Document Operations ───────────────────────────────

    public String upsertDocument(String index, String uri, String text) {
        return upsertDocument(index, uri, text, "", null);
    }

    public String upsertDocument(String index, String uri, String text,
                                  String docType, Map<String, MetadataValue> metadata) {
        UpsertDocumentRequest.Builder req = UpsertDocumentRequest.newBuilder()
                .setIndexName(index)
                .setUri(uri)
                .setText(text)
                .setDocType(docType != null ? docType : "");
        if (metadata != null) req.putAllMetadata(metadata);
        return stub.upsertDocument(req.build()).getDocumentId();
    }

    public void deleteDocument(String index, String uri) {
        stub.deleteDocument(DeleteDocumentRequest.newBuilder()
                .setIndexName(index).setUri(uri).build());
    }

    public List<DocumentInfo> listDocuments(String index) {
        return stub.listDocuments(ListDocumentsRequest.newBuilder()
                .setIndexName(index).build()).getDocumentsList();
    }

    // ── Stats ─────────────────────────────────────────────

    public GetIndexStatsResponse getIndexStats(String index) {
        return stub.getIndexStats(
                GetIndexStatsRequest.newBuilder().setIndexName(index).build());
    }

    public GetCatalogStatsResponse getCatalogStats(String index) {
        return stub.getCatalogStats(
                GetCatalogStatsRequest.newBuilder().setIndexName(index).build());
    }

    // ── Lifecycle ─────────────────────────────────────────

    public HealthcheckResponse healthcheck() {
        return stub.healthcheck(HealthcheckRequest.getDefaultInstance());
    }

    public void shutdown() {
        stub.shutdown(ShutdownRequest.getDefaultInstance());
    }

    // ── Helpers ───────────────────────────────────────────

    /** Create a string metadata value. */
    public static MetadataValue metaString(String s) {
        return MetadataValue.newBuilder().setStringValue(s).build();
    }

    /** Create a numeric metadata value. */
    public static MetadataValue metaNumber(double n) {
        return MetadataValue.newBuilder().setNumberValue(n).build();
    }

    /** Create a boolean metadata value. */
    public static MetadataValue metaBool(boolean b) {
        return MetadataValue.newBuilder().setBoolValue(b).build();
    }
}
