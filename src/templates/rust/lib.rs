//! Vectra gRPC client — thin idiomatic wrapper over generated stubs.
//!
//! # Usage
//!
//! ```rust,no_run
//! use vectra_client::VectraClient;
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     let mut client = VectraClient::connect("http://127.0.0.1:50051").await?;
//!     let results = client.query_documents("my-index", "search query", None).await?;
//!     for doc in &results {
//!         println!("{} (score: {:.3})", doc.uri, doc.score);
//!     }
//!     Ok(())
//! }
//! ```

pub mod vectra_service {
    tonic::include_proto!("vectra");
}

use std::collections::HashMap;
use vectra_service::vectra_service_client::VectraServiceClient;
use vectra_service::*;

/// Idiomatic Rust client for the Vectra gRPC server.
pub struct VectraClient {
    inner: VectraServiceClient<tonic::transport::Channel>,
}

impl VectraClient {
    /// Connect to a Vectra gRPC server.
    pub async fn connect(addr: &str) -> Result<Self, tonic::transport::Error> {
        let inner = VectraServiceClient::connect(addr.to_string()).await?;
        Ok(Self { inner })
    }

    // ── Index Management ──────────────────────────────────

    pub async fn create_index(
        &mut self,
        name: &str,
        format: &str,
        is_document_index: bool,
    ) -> Result<(), tonic::Status> {
        let document_config = if is_document_index {
            Some(DocumentIndexConfig {
                version: 1,
                chunk_size: 512,
                chunk_overlap: 0,
                embeddings_model: String::new(),
            })
        } else {
            None
        };
        self.inner
            .create_index(CreateIndexRequest {
                index_name: name.to_string(),
                format: format.to_string(),
                is_document_index,
                document_config,
            })
            .await?;
        Ok(())
    }

    pub async fn delete_index(&mut self, name: &str) -> Result<(), tonic::Status> {
        self.inner
            .delete_index(DeleteIndexRequest {
                index_name: name.to_string(),
            })
            .await?;
        Ok(())
    }

    pub async fn list_indexes(&mut self) -> Result<Vec<IndexInfo>, tonic::Status> {
        let resp = self.inner.list_indexes(ListIndexesRequest {}).await?;
        Ok(resp.into_inner().indexes)
    }

    // ── Item Operations ───────────────────────────────────

    pub async fn insert_item(
        &mut self,
        index: &str,
        text: &str,
        vector: Option<Vec<f32>>,
        metadata: Option<HashMap<String, MetadataValue>>,
        id: Option<&str>,
    ) -> Result<String, tonic::Status> {
        let resp = self
            .inner
            .insert_item(InsertItemRequest {
                index_name: index.to_string(),
                text: text.to_string(),
                vector: vector.unwrap_or_default(),
                metadata: metadata.unwrap_or_default(),
                id: id.unwrap_or_default().to_string(),
            })
            .await?;
        Ok(resp.into_inner().id)
    }

    pub async fn get_item(
        &mut self,
        index: &str,
        id: &str,
    ) -> Result<Option<ItemResult>, tonic::Status> {
        let resp = self
            .inner
            .get_item(GetItemRequest {
                index_name: index.to_string(),
                id: id.to_string(),
            })
            .await?;
        Ok(resp.into_inner().item)
    }

    pub async fn delete_item(&mut self, index: &str, id: &str) -> Result<(), tonic::Status> {
        self.inner
            .delete_item(DeleteItemRequest {
                index_name: index.to_string(),
                id: id.to_string(),
            })
            .await?;
        Ok(())
    }

    // ── Query ─────────────────────────────────────────────

    pub async fn query_items(
        &mut self,
        index: &str,
        text: &str,
        top_k: u32,
        filter: Option<&str>,
    ) -> Result<Vec<ItemResult>, tonic::Status> {
        let resp = self
            .inner
            .query_items(QueryItemsRequest {
                index_name: index.to_string(),
                text: text.to_string(),
                vector: vec![],
                top_k,
                filter: filter.map(|f| MetadataFilter {
                    filter_json: f.to_string(),
                }),
            })
            .await?;
        Ok(resp.into_inner().results)
    }

    pub async fn query_documents(
        &mut self,
        index: &str,
        query: &str,
        filter: Option<&str>,
    ) -> Result<Vec<DocumentResult>, tonic::Status> {
        self.query_documents_opts(index, query, 10, 50, filter, false)
            .await
    }

    pub async fn query_documents_opts(
        &mut self,
        index: &str,
        query: &str,
        max_documents: u32,
        max_chunks: u32,
        filter: Option<&str>,
        use_bm25: bool,
    ) -> Result<Vec<DocumentResult>, tonic::Status> {
        let resp = self
            .inner
            .query_documents(QueryDocumentsRequest {
                index_name: index.to_string(),
                query: query.to_string(),
                max_documents,
                max_chunks,
                filter: filter.map(|f| MetadataFilter {
                    filter_json: f.to_string(),
                }),
                use_bm25,
            })
            .await?;
        Ok(resp.into_inner().results)
    }

    // ── Document Operations ───────────────────────────────

    pub async fn upsert_document(
        &mut self,
        index: &str,
        uri: &str,
        text: &str,
        doc_type: Option<&str>,
        metadata: Option<HashMap<String, MetadataValue>>,
    ) -> Result<String, tonic::Status> {
        let resp = self
            .inner
            .upsert_document(UpsertDocumentRequest {
                index_name: index.to_string(),
                uri: uri.to_string(),
                text: text.to_string(),
                doc_type: doc_type.unwrap_or_default().to_string(),
                metadata: metadata.unwrap_or_default(),
            })
            .await?;
        Ok(resp.into_inner().document_id)
    }

    pub async fn delete_document(&mut self, index: &str, uri: &str) -> Result<(), tonic::Status> {
        self.inner
            .delete_document(DeleteDocumentRequest {
                index_name: index.to_string(),
                uri: uri.to_string(),
            })
            .await?;
        Ok(())
    }

    pub async fn list_documents(
        &mut self,
        index: &str,
    ) -> Result<Vec<DocumentInfo>, tonic::Status> {
        let resp = self
            .inner
            .list_documents(ListDocumentsRequest {
                index_name: index.to_string(),
            })
            .await?;
        Ok(resp.into_inner().documents)
    }

    // ── Stats ─────────────────────────────────────────────

    pub async fn get_index_stats(
        &mut self,
        index: &str,
    ) -> Result<GetIndexStatsResponse, tonic::Status> {
        let resp = self
            .inner
            .get_index_stats(GetIndexStatsRequest {
                index_name: index.to_string(),
            })
            .await?;
        Ok(resp.into_inner())
    }

    // ── Lifecycle ─────────────────────────────────────────

    pub async fn healthcheck(&mut self) -> Result<HealthcheckResponse, tonic::Status> {
        let resp = self.inner.healthcheck(HealthcheckRequest {}).await?;
        Ok(resp.into_inner())
    }

    pub async fn shutdown(&mut self) -> Result<(), tonic::Status> {
        self.inner.shutdown(ShutdownRequest {}).await?;
        Ok(())
    }
}

// ── Helpers ───────────────────────────────────────────────

/// Create a string metadata value.
pub fn meta_string(s: &str) -> MetadataValue {
    MetadataValue {
        value: Some(metadata_value::Value::StringValue(s.to_string())),
    }
}

/// Create a numeric metadata value.
pub fn meta_number(n: f64) -> MetadataValue {
    MetadataValue {
        value: Some(metadata_value::Value::NumberValue(n)),
    }
}

/// Create a boolean metadata value.
pub fn meta_bool(b: bool) -> MetadataValue {
    MetadataValue {
        value: Some(metadata_value::Value::BoolValue(b)),
    }
}
