---
title: Best Practices
layout: default
nav_order: 6
---

# Best Practices
{: .no_toc }

Performance tuning, operational tips, and troubleshooting.
{: .fs-6 .fw-300 }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Index design

### Index only what you filter on

Put frequently used filter fields in `metadata_config.indexed` to keep `index.json` small but filterable. Everything else is automatically stored in per-item JSON files on disk.

### Use separate folders as namespaces

Mimic Pinecone namespaces by creating one index folder per dataset or tenant.

### Keep vectors consistent

Use the same embedding model and dimensions across an index. If you change models, re-embed and rebuild the index.

## Write patterns

### Batch writes when possible

Prefer `batchInsertItems` for item-level bulk adds — it applies all-or-nothing and avoids partial updates.

For document flow, use `upsertDocument` / `deleteDocument` which manage update locking automatically.

### Respect the update lock

If you manage updates manually, call `beginUpdate` → multiple insert/delete → `endUpdate`. Calling `beginUpdate` twice throws.

## Chunking (documents)

- Default `chunkSize` of **512 tokens** with **0 overlap** is a good starting point.
- If queries are long or context matters, consider modest overlap.
- Keep `chunkSize` under your embedding provider's `maxTokens` per request batch.
- `keepSeparators: true` preserves natural boundaries for better section rendering.

## Retrieval tuning

- For exact phrases or code terms, enable **hybrid retrieval** (`isBm25: true`) to add keyword matches alongside semantic results.
- Render sections with a realistic token budget for your target LLM — **1000–2000 tokens** per section is common.

## Memory management

- The entire index is loaded into RAM. Estimate vector + metadata size and stay within budget.
- Consider multiple smaller indexes instead of one large index if you have distinct corpora.
- Rough sizing: a 1536-dim float32 vector is ~12 KB in memory (JS doubles) plus per-item metadata overhead.

---

## Performance and limits

### How Vectra searches

1. Linear scan over all items with cosine similarity (vectors are pre-normalized; each item caches its norm).
2. Results sorted by similarity and truncated to `topK`.
3. Hybrid mode optionally adds BM25 keyword matches after the semantic pass.

### Typical latency

| Index size | Expected latency |
|------------|-----------------|
| Small (hundreds of items) | < 1 ms |
| Medium (thousands of items) | 1–2 ms |
| BM25 addition | Small overhead proportional to non-selected chunk count |

### Limits and cautions

- **Not intended** for large, ever-growing chat memories or multi-million-item corpora.
- Very large indexes mean high RAM usage and longer JSON serialization times at startup.
- Sorting all distances is O(n log n) — keep `n` within practical bounds for your machine.
- Embedding generation is external to Vectra; rate limits and throughput depend on your provider.
- Web ingestion depends on site availability; use `--cookie` for authenticated pages and respect robots.txt/terms.

---

## Troubleshooting

### Missing or invalid embeddings config

**Symptom:** "Embeddings model not configured." or provider errors.

**Fix:** For code, pass an `OpenAIEmbeddings` instance. For CLI, supply a valid `keys.json` — see [Embeddings provider config](/vectra/cli#embeddings-provider-config-keysjson).

### Rate limits or timeouts when embedding

**Symptom:** "rate_limited" or provider errors.

**Fix:** Reduce batch size (`chunkSize`), add delay/retries (`OpenAIEmbeddings` has `retryPolicy`), or upgrade your plan.

### Index already exists

**Symptom:** "Index already exists".

**Fix:** Pass `deleteIfExists: true` to `createIndex`, or call `deleteIndex()` first.

### Index not found

**Symptom:** "Index does not exist".

**Fix:** Call `isIndexCreated()` and `createIndex()` before using the index.

### Update lock misuse

**Symptom:** "Update already in progress" or "No update in progress".

**Fix:** Pair `beginUpdate` → insert/delete → `endUpdate`. Prefer `batchInsertItems` or document-level helpers to avoid manual locking.

### Filters return no results

**Symptom:** Expected items aren't matched by a metadata filter.

**Fix:** Only fields in `metadata_config.indexed` are filterable. Ensure the field is included at index creation and your operators/values match actual data types.

### Dimension mismatch or NaN scores

**Symptom:** Weird scores or NaN.

**Fix:** Keep a single embedding model/dimension per index. Re-embed and rebuild if you change models.

### Node.js or environment issues

**Symptom:** Runtime errors on `fs` or syntax errors.

**Fix:** Use Node 20.x+. Verify file permissions and that the target folder exists.

### Corrupt JSON on disk

**Symptom:** JSON parse errors reading `index.json` or metadata files.

**Fix:** Recreate the index (`deleteIfExists: true`) and re-ingest, or restore from a clean backup.

### Web fetching problems (CLI)

**Symptom:** "invalid content type" or HTTP 4xx/5xx.

**Fix:** Use `--cookie` for authenticated pages. Ensure the URL is reachable and returns an allowed content type.

### BM25 returns nothing

**Symptom:** No keyword chunks added to results.

**Fix:** Ensure `isBm25: true` is set at query time and you pass a non-empty query string. Only `topK` BM25 results are blended in after semantic selection.
