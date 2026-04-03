// Package vectra provides an idiomatic Go client for the Vectra gRPC server.
//
// Usage:
//
//	client, err := vectra.NewClient("127.0.0.1:50051")
//	if err != nil {
//	    log.Fatal(err)
//	}
//	defer client.Close()
//
//	results, err := client.QueryDocuments(ctx, "my-index", "search query", nil)
package vectra

import (
	"context"
	"encoding/json"
	"fmt"

	pb "your_module/vectra_service" // replace with your actual module path

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// Client is an idiomatic Go client for the Vectra gRPC server.
type Client struct {
	conn *grpc.ClientConn
	stub pb.VectraServiceClient
}

// NewClient connects to a Vectra gRPC server at the given address.
func NewClient(addr string) (*Client, error) {
	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("vectra: dial %s: %w", addr, err)
	}
	return &Client{conn: conn, stub: pb.NewVectraServiceClient(conn)}, nil
}

// Close releases the underlying gRPC connection.
func (c *Client) Close() error {
	return c.conn.Close()
}

// ── Index Management ──────────────────────────────────

// CreateIndex creates a new index on the server.
func (c *Client) CreateIndex(ctx context.Context, name, format string, isDocumentIndex bool) error {
	req := &pb.CreateIndexRequest{
		IndexName:       name,
		Format:          format,
		IsDocumentIndex: isDocumentIndex,
	}
	if isDocumentIndex {
		req.DocumentConfig = &pb.DocumentIndexConfig{
			Version:   1,
			ChunkSize: 512,
		}
	}
	_, err := c.stub.CreateIndex(ctx, req)
	return err
}

// DeleteIndex deletes an index from the server.
func (c *Client) DeleteIndex(ctx context.Context, name string) error {
	_, err := c.stub.DeleteIndex(ctx, &pb.DeleteIndexRequest{IndexName: name})
	return err
}

// IndexInfo holds summary information about an index.
type IndexInfo struct {
	Name            string
	Format          string
	IsDocumentIndex bool
}

// ListIndexes returns all indexes managed by the server.
func (c *Client) ListIndexes(ctx context.Context) ([]IndexInfo, error) {
	resp, err := c.stub.ListIndexes(ctx, &pb.ListIndexesRequest{})
	if err != nil {
		return nil, err
	}
	out := make([]IndexInfo, len(resp.Indexes))
	for i, idx := range resp.Indexes {
		out[i] = IndexInfo{Name: idx.Name, Format: idx.Format, IsDocumentIndex: idx.IsDocumentIndex}
	}
	return out, nil
}

// ── Item Operations ───────────────────────────────────

// InsertItem adds a new item to an index. Returns the assigned ID.
func (c *Client) InsertItem(ctx context.Context, index, text string, vector []float32, metadata map[string]*pb.MetadataValue, id string) (string, error) {
	req := &pb.InsertItemRequest{
		IndexName: index,
		Text:      text,
		Vector:    vector,
		Metadata:  metadata,
		Id:        id,
	}
	resp, err := c.stub.InsertItem(ctx, req)
	if err != nil {
		return "", err
	}
	return resp.Id, nil
}

// UpsertItem inserts or updates an item. Returns the ID.
func (c *Client) UpsertItem(ctx context.Context, index, id, text string, vector []float32, metadata map[string]*pb.MetadataValue) (string, error) {
	req := &pb.UpsertItemRequest{
		IndexName: index,
		Id:        id,
		Text:      text,
		Vector:    vector,
		Metadata:  metadata,
	}
	resp, err := c.stub.UpsertItem(ctx, req)
	if err != nil {
		return "", err
	}
	return resp.Id, nil
}

// GetItem retrieves a single item by ID.
func (c *Client) GetItem(ctx context.Context, index, id string) (*pb.ItemResult, error) {
	resp, err := c.stub.GetItem(ctx, &pb.GetItemRequest{IndexName: index, Id: id})
	if err != nil {
		return nil, err
	}
	return resp.Item, nil
}

// DeleteItem removes an item by ID.
func (c *Client) DeleteItem(ctx context.Context, index, id string) error {
	_, err := c.stub.DeleteItem(ctx, &pb.DeleteItemRequest{IndexName: index, Id: id})
	return err
}

// ListItems returns items in an index, optionally filtered.
// filterJSON should be a JSON string with MongoDB-style filter operators, or empty.
func (c *Client) ListItems(ctx context.Context, index, filterJSON string) ([]*pb.ItemResult, error) {
	req := &pb.ListItemsRequest{IndexName: index}
	if filterJSON != "" {
		req.Filter = &pb.MetadataFilter{FilterJson: filterJSON}
	}
	resp, err := c.stub.ListItems(ctx, req)
	if err != nil {
		return nil, err
	}
	return resp.Items, nil
}

// ── Query ─────────────────────────────────────────────

// QueryItems performs a vector similarity query. Returns ranked results.
func (c *Client) QueryItems(ctx context.Context, index, text string, topK uint32, filterJSON string) ([]*pb.ItemResult, error) {
	req := &pb.QueryItemsRequest{
		IndexName: index,
		Text:      text,
		TopK:      topK,
	}
	if filterJSON != "" {
		req.Filter = &pb.MetadataFilter{FilterJson: filterJSON}
	}
	resp, err := c.stub.QueryItems(ctx, req)
	if err != nil {
		return nil, err
	}
	return resp.Results, nil
}

// QueryDocumentsOpts holds optional parameters for QueryDocuments.
type QueryDocumentsOpts struct {
	MaxDocuments uint32
	MaxChunks    uint32
	FilterJSON   string
	UseBM25      bool
}

// QueryDocuments performs a document-level semantic search.
func (c *Client) QueryDocuments(ctx context.Context, index, query string, opts *QueryDocumentsOpts) ([]*pb.DocumentResult, error) {
	req := &pb.QueryDocumentsRequest{
		IndexName:    index,
		Query:        query,
		MaxDocuments: 10,
		MaxChunks:    50,
	}
	if opts != nil {
		if opts.MaxDocuments > 0 {
			req.MaxDocuments = opts.MaxDocuments
		}
		if opts.MaxChunks > 0 {
			req.MaxChunks = opts.MaxChunks
		}
		if opts.FilterJSON != "" {
			req.Filter = &pb.MetadataFilter{FilterJson: opts.FilterJSON}
		}
		req.UseBm25 = opts.UseBM25
	}
	resp, err := c.stub.QueryDocuments(ctx, req)
	if err != nil {
		return nil, err
	}
	return resp.Results, nil
}

// ── Document Operations ───────────────────────────────

// UpsertDocument inserts or updates a document. Returns the document ID.
func (c *Client) UpsertDocument(ctx context.Context, index, uri, text, docType string, metadata map[string]*pb.MetadataValue) (string, error) {
	req := &pb.UpsertDocumentRequest{
		IndexName: index,
		Uri:       uri,
		Text:      text,
		DocType:   docType,
		Metadata:  metadata,
	}
	resp, err := c.stub.UpsertDocument(ctx, req)
	if err != nil {
		return "", err
	}
	return resp.DocumentId, nil
}

// DeleteDocument removes a document by URI.
func (c *Client) DeleteDocument(ctx context.Context, index, uri string) error {
	_, err := c.stub.DeleteDocument(ctx, &pb.DeleteDocumentRequest{IndexName: index, Uri: uri})
	return err
}

// DocumentInfo holds summary information about a document.
type DocumentInfo struct {
	URI        string
	DocumentID string
}

// ListDocuments returns all documents in a document index.
func (c *Client) ListDocuments(ctx context.Context, index string) ([]DocumentInfo, error) {
	resp, err := c.stub.ListDocuments(ctx, &pb.ListDocumentsRequest{IndexName: index})
	if err != nil {
		return nil, err
	}
	out := make([]DocumentInfo, len(resp.Documents))
	for i, d := range resp.Documents {
		out[i] = DocumentInfo{URI: d.Uri, DocumentID: d.DocumentId}
	}
	return out, nil
}

// ── Stats ─────────────────────────────────────────────

// GetIndexStats returns statistics for an index.
func (c *Client) GetIndexStats(ctx context.Context, index string) (*pb.GetIndexStatsResponse, error) {
	resp, err := c.stub.GetIndexStats(ctx, &pb.GetIndexStatsRequest{IndexName: index})
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// GetCatalogStats returns catalog statistics for a document index.
func (c *Client) GetCatalogStats(ctx context.Context, index string) (*pb.GetCatalogStatsResponse, error) {
	resp, err := c.stub.GetCatalogStats(ctx, &pb.GetCatalogStatsRequest{IndexName: index})
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// ── Lifecycle ─────────────────────────────────────────

// HealthcheckResult holds the server health status.
type HealthcheckResult struct {
	Status        string
	UptimeSeconds float64
	LoadedIndexes int32
}

// Healthcheck returns the server's health status.
func (c *Client) Healthcheck(ctx context.Context) (*HealthcheckResult, error) {
	resp, err := c.stub.Healthcheck(ctx, &pb.HealthcheckRequest{})
	if err != nil {
		return nil, err
	}
	return &HealthcheckResult{
		Status:        resp.Status,
		UptimeSeconds: resp.UptimeSeconds,
		LoadedIndexes: resp.LoadedIndexes,
	}, nil
}

// Shutdown requests a graceful server shutdown.
func (c *Client) Shutdown(ctx context.Context) error {
	_, err := c.stub.Shutdown(ctx, &pb.ShutdownRequest{})
	return err
}

// ── Helpers ───────────────────────────────────────────

// MetaString creates a string metadata value.
func MetaString(s string) *pb.MetadataValue {
	return &pb.MetadataValue{Value: &pb.MetadataValue_StringValue{StringValue: s}}
}

// MetaNumber creates a numeric metadata value.
func MetaNumber(n float64) *pb.MetadataValue {
	return &pb.MetadataValue{Value: &pb.MetadataValue_NumberValue{NumberValue: n}}
}

// MetaBool creates a boolean metadata value.
func MetaBool(b bool) *pb.MetadataValue {
	return &pb.MetadataValue{Value: &pb.MetadataValue_BoolValue{BoolValue: b}}
}

// FilterJSON marshals a map into a JSON string suitable for filter parameters.
func FilterJSON(filter map[string]interface{}) (string, error) {
	b, err := json.Marshal(filter)
	if err != nil {
		return "", fmt.Errorf("vectra: marshal filter: %w", err)
	}
	return string(b), nil
}
