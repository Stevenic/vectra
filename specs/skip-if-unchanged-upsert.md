# Spec: Skip-If-Unchanged Document Upsert

**Status:** Draft
**Author:** Scribe
**Date:** 2026-05-23
**Scope:** `LocalDocumentIndex.upsertDocument` behavior, `DocumentCatalog` schema, backward compatibility

---

## 1. Problem

`LocalDocumentIndex.upsertDocument` always re-embeds the document when the URI already exists, even when the content is byte-identical to what's already stored. The current implementation (`src/LocalDocumentIndex.ts:222`):

```ts
public async upsertDocument(uri, text, docType?, metadata?) {
    let documentId = await this.getDocumentId(uri);
    if (documentId != undefined) {
        await this.deleteDocument(uri);            // ← always
    } else {
        documentId = v4();
    }
    // … chunk + embed + add …
}
```

There is no content-equality check. Every upsert on an unchanged document does:

1. `deleteDocument(uri)` — rewrites the catalog and removes vectors
2. `TextSplitter.split(text)` — re-chunks
3. `embeddings.createEmbeddings(...)` — re-embeds every chunk (the expensive step)
4. `addDocument(...)` — rewrites the index

When a caller drives Vectra in a "scan every file, upsert each one" pattern (a common sync strategy), the cost scales linearly with corpus size on **every sync pass**, even when nothing has changed. For a 200-file corpus with 8 chunks per file, that's 1,600 embedding API calls per no-op sync — minutes of work and meaningful API spend, both wasted.

Measured impact in the wild: a downstream caller doing a periodic sync against a 100-file corpus saw cumulative ingest time grow linearly from 16 s (corpus = 6 files) to 505 s (corpus = 102 files) on the same +6 new files per sync — pure re-embedding overhead on the 96 unchanged files.

## 2. Goal

Short-circuit `upsertDocument` when the document URI exists and the content + identity-relevant metadata hash matches what's already in the catalog. The change is **non-breaking**:

- Public API is unchanged.
- Behavior for new documents and genuinely-changed documents is identical to today.
- On-disk format gains one optional field per document; old indexes load and run unchanged.
- Callers that explicitly want force-reindex (e.g., after rotating an embeddings model) get an opt-in escape hatch.

The optimistic case (unchanged document) drops from O(chunks) embedding calls plus two index rewrites to a single catalog read.

## 3. Non-Goals

- Detecting changes in the embeddings model itself. A model rotation invalidates every embedding in the index regardless of content; that's a "rebuild from scratch" event, not something this dedup path should try to handle automatically. See §7.1 for the rationale.
- Skipping work in `LocalIndex.upsertItem` (the lower-level vector store). The dedup is at the document layer, not the chunk layer. Chunks are already content-addressed inside a document via UUIDs.
- Changing how `FolderWatcher` works. The watcher's mtime-based skip is complementary (it avoids reading the file at all); this spec's dedup is for callers that aren't using the watcher.
- Compaction or deduplication of the underlying index file. That's a separate concern.

---

## 4. Design

### 4.1 Hash what matters for re-embedding

Compute a SHA-256 hash over the inputs that would change the stored chunks and vectors:

```
hash_input = text || "\0" || (docType ?? "") || "\0" || canonicalJson(metadata ?? {})
```

- `text` — the document body. The most common reason for a real change.
- `docType` — affects which TextSplitter rules apply (overrides the URI-extension default).
- `metadata` — stored on each chunk; an isolated metadata edit is a real change that callers expect to be reflected in queries.

Use a canonical JSON encoding for metadata (sorted keys, no whitespace) so semantically-equal metadata objects produce identical hashes regardless of key order. Node's `crypto.createHash('sha256').update(...).digest('hex')` is the implementation; no new dependencies.

The resulting hash is a 64-character lowercase hex string — small, comparable in O(1), and easy to inspect from the catalog file.

### 4.2 Store the hash in the catalog

Extend `DocumentCatalog` (`src/codecs/IndexCodec.ts:6`) with one new optional map:

```ts
export interface DocumentCatalog {
    version: number;
    count: number;
    uriToId: { [uri: string]: string };
    idToUri: { [id: string]: string };
    uriToHash?: { [uri: string]: string };   // NEW — optional
}
```

`uriToHash` is keyed by URI (consistent with `uriToId`) and contains the SHA-256 hex of each document's last-stored content. When loaded from an old catalog that didn't write this field, it's `undefined` — the next upsert per URI populates it (see §4.4).

The field is purely additive; codecs that don't write it produce on-disk files compatible with current readers.

### 4.3 Short-circuit upsert

```ts
public async upsertDocument(
    uri: string,
    text: string,
    docType?: string,
    metadata?: Record<string, MetadataTypes>,
    options?: { force?: boolean },        // NEW — optional, defaults to undefined
): Promise<LocalDocument> {
    if (!this._embeddings) {
        throw new Error(`Embeddings model not configured.`);
    }

    await this.loadCatalog();
    const existingId = this._catalog?.uriToId[uri];
    const newHash = computeContentHash(text, docType, metadata);

    if (existingId !== undefined && !options?.force) {
        const existingHash = this._catalog?.uriToHash?.[uri];
        if (existingHash === newHash) {
            // No-op: return a LocalDocument bound to the existing id.
            return new LocalDocument(this, existingId, uri);
        }
    }

    // … existing delete-or-allocate logic, then chunk + embed + add …
    // After addDocument completes, record the hash:
    this._newCatalog!.uriToHash = this._newCatalog!.uriToHash ?? {};
    this._newCatalog!.uriToHash[uri] = newHash;
    // … existing commit path unchanged …
}
```

The short-circuit returns a `LocalDocument` handle identical to what a real upsert would have produced — same documentId, same URI, same backing store. Callers that immediately query against the returned document see the existing chunks, which by definition match the current content.

### 4.4 Lazy hash population

For an existing index that doesn't have `uriToHash` (old format), the dedup path naturally bootstraps:

- First upsert per URI: `existingHash` is `undefined`, so the short-circuit doesn't fire; the existing delete + re-add path runs once. After the add, `uriToHash[uri] = newHash` is written.
- Subsequent upserts on that URI: `existingHash` matches `newHash` and the short-circuit fires.

So old indexes pay a one-time-per-document re-embed after upgrade. After one full pass, they're as fast as new indexes.

No migration step is required. No new catalog version bump is required (the field is purely additive, and the catalog already carries a `version` field that codecs use to gate future changes).

---

## 5. API surface

### 5.1 What's new

A single new optional parameter on `upsertDocument`:

```ts
upsertDocument(uri, text, docType?, metadata?, options?: { force?: boolean })
```

- `options.force === true` skips the hash check entirely and runs the full delete + re-embed path. Useful when the caller knows the embeddings model has changed, or when debugging an index that may have stale vectors.

### 5.2 What's unchanged

- Four-argument call sites continue to compile and behave the same way (with the added benefit of skip-if-unchanged).
- Return type, throw conditions, and side-effects on changed documents are identical.
- `FolderWatcher`, `LocalIndex`, `LocalDocument`, and the CLI surface require no changes.
- All existing tests should pass without modification. New tests (§8) cover the new short-circuit path.

### 5.3 What it does NOT add

- No `Index.getDocumentHash(uri)` accessor. The hash is an internal implementation detail of upsert dedup; callers that need their own change detection should compute their own. Exposing it invites callers to build features on a field we may later replace with something faster.
- No "list changed documents" API. This spec is about avoiding work, not reporting deltas.

---

## 6. Wire / on-disk compatibility

### 6.1 JSON codec

The default `JsonIndexCodec.serializeCatalog` will start writing the `uriToHash` field. Old readers (pre-this-change) ignore unknown JSON properties and continue to function. New readers tolerate a missing `uriToHash` (`?:` optional).

### 6.2 Protobuf codec (per `specs/binary-storage-format.md`)

Adds a new optional `map<string, string> uri_to_hash = 5;` field on the `DocumentCatalog` proto message. Protobuf's standard backward-compatibility rules apply: new readers see absent values as default; old readers ignore the unknown tag.

### 6.3 No version bump

The catalog's `version` field is for breaking changes (a reader that can't safely ignore unknown content). This addition is purely additive; the on-disk shape remains valid against any current reader. Bumping the version would force a re-write on every old catalog — unnecessary churn.

---

## 7. Open questions

### 7.1 Should the hash include the embeddings model identity?

**Status:** Deferred. The current proposal hashes only `text + docType + metadata`. If the caller swaps embeddings models, the dedup path will short-circuit when it shouldn't — the catalog still has vectors from the old model, but they're now wrong.

Three options:

1. **Status quo (this spec):** Don't track model identity. Swapping models requires a manual reindex (`force: true` per doc, or wipe + rebuild). Model swaps are rare and the failure mode is loud (queries return the wrong neighbors), so detect-by-symptom is acceptable.
2. **Hash includes model id:** Requires `EmbeddingsModel` to expose an `identity()` method (e.g., `"openai:text-embedding-3-small@v1"`). Most models could derive this from their constructor config. Adds a small API surface on every embeddings implementation.
3. **Track model identity at the index level, not per-doc:** Store the embeddings model identity in the catalog header. On open, compare against the configured model; if they differ, ignore `uriToHash` (treat every upsert as a force-reindex on first touch). Cleaner separation of concerns and one comparison per index-open instead of per-upsert.

Recommend option (1) for v1 of this spec, with (3) as a follow-up if model swaps become a real operational issue.

### 7.2 Should `metadata: undefined` and `metadata: {}` hash the same?

Currently the implementation reads `metadata ?? {}` so they collapse to the same canonical JSON `"{}"`. That matches the index's behavior (no metadata vs empty metadata are indistinguishable in `LocalDocument.metadata`). Document the equivalence and move on.

### 7.3 Should bulk-add API also dedup?

`LocalDocumentIndex.beginUpdate` / `endUpdate` exposes a batching API. The natural extension is for `upsertDocument` inside a batch to use the same dedup. Since `beginUpdate` already swaps the catalog through `_newCatalog`, the design already handles this — `uriToHash` lives on the catalog and is read/written via the same `_newCatalog` reference. No additional work.

---

## 8. Test plan

New tests in `src/LocalDocumentIndex.spec.ts`:

| Case | Expected behavior |
|---|---|
| Upsert new URI | Hash is written to `uriToHash`. Document added. Same as today plus the hash side-effect. |
| Upsert existing URI, identical text + metadata | No `deleteDocument` call. No `embeddings.createEmbeddings` call. Returns a `LocalDocument` bound to the existing id. `uriToHash[uri]` unchanged. |
| Upsert existing URI, changed text | Full delete + re-embed. `uriToHash[uri]` updated. |
| Upsert existing URI, changed metadata (text identical) | Full delete + re-embed. (Hash changes because metadata is in the input.) |
| Upsert existing URI, changed docType (text+metadata identical) | Full delete + re-embed. |
| Upsert existing URI with `force: true` | Always re-embeds, even when hash matches. `uriToHash[uri]` set to current hash. |
| Old catalog (no `uriToHash`) loaded, then upsert with identical content | Falls through to re-embed once (first call), populates `uriToHash`. Second call short-circuits. |
| Metadata key order differs but values identical | Hash matches → short-circuit (canonical JSON serialization). |

Spy on `embeddings.createEmbeddings` to count invocations; the short-circuit case should have zero new calls compared to the baseline upsert.

Performance regression test: build a 100-document index, then run a no-op sync (upsert every doc with identical content). Assert total embeddings calls = 0 and wall time < 1 s on local embeddings.

---

## 9. Implementation phases

1. **Hash computation utility.** Add a private helper (or a new file `src/internal/contentHash.ts`) that exposes `computeContentHash(text, docType, metadata)`. Pure function, unit-tested in isolation. ~30 lines.
2. **Catalog schema extension.** Add `uriToHash?` to `DocumentCatalog`. Update `JsonIndexCodec` to serialize/deserialize the field. The protobuf codec (when it lands) adds the corresponding optional field.
3. **`upsertDocument` short-circuit.** Wire the helper in, add the `force` option, write the hash after successful add. Cover all the test-plan cases.
4. **Documentation pass.** Update `docs/api-reference.md` (the `upsertDocument` row) and `docs/best-practices.md` (the "Write Patterns" section) to mention the new behavior.

Each phase is independently shippable. The whole change is small enough — ~60 LOC of production code + ~150 LOC of tests — that it can land as one PR.

---

## 10. Success criteria

- All existing tests pass without modification.
- New tests in §8 pass.
- A scripted benchmark (100 documents × 10 sync passes with no changes) shows zero embedding calls after the first pass and finishes in under 2 s wall time on local embeddings (was ~minutes in the same setup pre-change).
- An old (pre-upgrade) index loads, runs one sync, and then short-circuits on subsequent identical syncs — verified by inspecting `uriToHash` in the catalog file after each pass.
- No breaking changes to any public type signature; downstream consumers compile against the new version without code changes.
