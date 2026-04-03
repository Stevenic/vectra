"""Vectra gRPC client — thin idiomatic wrapper over generated stubs.

Usage:
    from vectra_client import VectraClient

    client = VectraClient()  # localhost:50051
    results = client.query_documents("my-index", "search query")
"""

from __future__ import annotations

import json
from typing import Any

import grpc

# Generated stubs — run `python -m grpc_tools.protoc` to produce these:
#   python -m grpc_tools.protoc -I. --python_out=. --grpc_python_out=. vectra_service.proto
import vectra_service_pb2 as pb2
import vectra_service_pb2_grpc as pb2_grpc


class VectraClient:
    """Idiomatic Python client for the Vectra gRPC server."""

    def __init__(self, host: str = "127.0.0.1", port: int = 50051):
        self._channel = grpc.insecure_channel(f"{host}:{port}")
        self._stub = pb2_grpc.VectraServiceStub(self._channel)

    def close(self) -> None:
        self._channel.close()

    def __enter__(self) -> VectraClient:
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()

    # ── Index Management ──────────────────────────────────

    def create_index(
        self,
        name: str,
        *,
        format: str = "json",
        is_document_index: bool = False,
        chunk_size: int = 512,
        chunk_overlap: int = 0,
    ) -> None:
        doc_config = pb2.DocumentIndexConfig(
            version=1,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        ) if is_document_index else None
        self._stub.CreateIndex(pb2.CreateIndexRequest(
            index_name=name,
            format=format,
            is_document_index=is_document_index,
            document_config=doc_config,
        ))

    def delete_index(self, name: str) -> None:
        self._stub.DeleteIndex(pb2.DeleteIndexRequest(index_name=name))

    def list_indexes(self) -> list[dict[str, Any]]:
        resp = self._stub.ListIndexes(pb2.ListIndexesRequest())
        return [
            {"name": idx.name, "format": idx.format, "is_document_index": idx.is_document_index}
            for idx in resp.indexes
        ]

    # ── Item Operations ───────────────────────────────────

    def insert_item(
        self,
        index: str,
        *,
        text: str = "",
        vector: list[float] | None = None,
        metadata: dict[str, Any] | None = None,
        id: str = "",
    ) -> str:
        req = pb2.InsertItemRequest(
            index_name=index,
            text=text,
            id=id,
        )
        if vector:
            req.vector.extend(vector)
        if metadata:
            _set_metadata(req.metadata, metadata)
        return self._stub.InsertItem(req).id

    def upsert_item(
        self,
        index: str,
        id: str,
        *,
        text: str = "",
        vector: list[float] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> str:
        req = pb2.UpsertItemRequest(
            index_name=index,
            id=id,
            text=text,
        )
        if vector:
            req.vector.extend(vector)
        if metadata:
            _set_metadata(req.metadata, metadata)
        return self._stub.UpsertItem(req).id

    def get_item(self, index: str, id: str) -> dict[str, Any] | None:
        resp = self._stub.GetItem(pb2.GetItemRequest(index_name=index, id=id))
        return _item_to_dict(resp.item) if resp.HasField("item") else None

    def delete_item(self, index: str, id: str) -> None:
        self._stub.DeleteItem(pb2.DeleteItemRequest(index_name=index, id=id))

    def list_items(
        self, index: str, *, filter: dict[str, Any] | None = None
    ) -> list[dict[str, Any]]:
        req = pb2.ListItemsRequest(index_name=index)
        if filter:
            req.filter.CopyFrom(pb2.MetadataFilter(filter_json=json.dumps(filter)))
        resp = self._stub.ListItems(req)
        return [_item_to_dict(item) for item in resp.items]

    # ── Query ─────────────────────────────────────────────

    def query_items(
        self,
        index: str,
        *,
        text: str = "",
        vector: list[float] | None = None,
        top_k: int = 10,
        filter: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        req = pb2.QueryItemsRequest(
            index_name=index,
            text=text,
            top_k=top_k,
        )
        if vector:
            req.vector.extend(vector)
        if filter:
            req.filter.CopyFrom(pb2.MetadataFilter(filter_json=json.dumps(filter)))
        resp = self._stub.QueryItems(req)
        return [_item_to_dict(r) for r in resp.results]

    def query_documents(
        self,
        index: str,
        query: str,
        *,
        max_documents: int = 10,
        max_chunks: int = 50,
        filter: dict[str, Any] | None = None,
        use_bm25: bool = False,
    ) -> list[dict[str, Any]]:
        req = pb2.QueryDocumentsRequest(
            index_name=index,
            query=query,
            max_documents=max_documents,
            max_chunks=max_chunks,
            use_bm25=use_bm25,
        )
        if filter:
            req.filter.CopyFrom(pb2.MetadataFilter(filter_json=json.dumps(filter)))
        resp = self._stub.QueryDocuments(req)
        return [
            {
                "uri": doc.uri,
                "document_id": doc.document_id,
                "score": doc.score,
                "chunks": [
                    {"text": c.text, "score": c.score, "token_count": c.token_count}
                    for c in doc.chunks
                ],
            }
            for doc in resp.results
        ]

    # ── Document Operations ───────────────────────────────

    def upsert_document(
        self,
        index: str,
        uri: str,
        text: str,
        *,
        doc_type: str = "",
        metadata: dict[str, Any] | None = None,
    ) -> str:
        req = pb2.UpsertDocumentRequest(
            index_name=index,
            uri=uri,
            text=text,
            doc_type=doc_type,
        )
        if metadata:
            _set_metadata(req.metadata, metadata)
        return self._stub.UpsertDocument(req).document_id

    def delete_document(self, index: str, uri: str) -> None:
        self._stub.DeleteDocument(pb2.DeleteDocumentRequest(index_name=index, uri=uri))

    def list_documents(self, index: str) -> list[dict[str, Any]]:
        resp = self._stub.ListDocuments(pb2.ListDocumentsRequest(index_name=index))
        return [{"uri": d.uri, "document_id": d.document_id} for d in resp.documents]

    # ── Stats ─────────────────────────────────────────────

    def get_index_stats(self, index: str) -> dict[str, Any]:
        resp = self._stub.GetIndexStats(pb2.GetIndexStatsRequest(index_name=index))
        return {
            "version": resp.version,
            "format": resp.format,
            "item_count": resp.item_count,
            "metadata_config_count": resp.metadata_config_count,
        }

    def get_catalog_stats(self, index: str) -> dict[str, Any]:
        resp = self._stub.GetCatalogStats(pb2.GetCatalogStatsRequest(index_name=index))
        return {
            "version": resp.version,
            "document_count": resp.document_count,
            "chunk_count": resp.chunk_count,
            "metadata_counts": dict(resp.metadata_counts),
        }

    # ── Lifecycle ─────────────────────────────────────────

    def healthcheck(self) -> dict[str, Any]:
        resp = self._stub.Healthcheck(pb2.HealthcheckRequest())
        return {
            "status": resp.status,
            "uptime_seconds": resp.uptime_seconds,
            "loaded_indexes": resp.loaded_indexes,
        }

    def shutdown(self) -> None:
        self._stub.Shutdown(pb2.ShutdownRequest())


# ── Helpers ───────────────────────────────────────────────


def _set_metadata(
    proto_map: Any, metadata: dict[str, Any]
) -> None:
    for key, value in metadata.items():
        if isinstance(value, bool):
            proto_map[key].CopyFrom(pb2.MetadataValue(bool_value=value))
        elif isinstance(value, (int, float)):
            proto_map[key].CopyFrom(pb2.MetadataValue(number_value=value))
        else:
            proto_map[key].CopyFrom(pb2.MetadataValue(string_value=str(value)))


def _item_to_dict(item: Any) -> dict[str, Any]:
    metadata: dict[str, Any] = {}
    for key, val in item.metadata.items():
        which = val.WhichOneof("value")
        if which == "string_value":
            metadata[key] = val.string_value
        elif which == "number_value":
            metadata[key] = val.number_value
        elif which == "bool_value":
            metadata[key] = val.bool_value
    return {
        "id": item.id,
        "metadata": metadata,
        "vector": list(item.vector),
        "norm": item.norm,
        "score": item.score,
    }
