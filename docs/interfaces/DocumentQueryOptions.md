[Vectra](../README.md) / [Exports](../modules.md) / DocumentQueryOptions

# Interface: DocumentQueryOptions

Options for querying documents.

## Table of contents

### Properties

- [filter](DocumentQueryOptions.md#filter)
- [isBm25](DocumentQueryOptions.md#isbm25)
- [maxChunks](DocumentQueryOptions.md#maxchunks)
- [maxDocuments](DocumentQueryOptions.md#maxdocuments)

## Properties

### filter

• `Optional` **filter**: [`MetadataFilter`](MetadataFilter.md)

Optional. Filter to apply to the document metadata.

#### Defined in

[LocalDocumentIndex.ts:33](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocumentIndex.ts#L33)

___

### isBm25

• `Optional` **isBm25**: `boolean`

Optional. Turn on bm25 keyword search to perform hybrid search - semantic + keyword

#### Defined in

[LocalDocumentIndex.ts:38](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocumentIndex.ts#L38)

___

### maxChunks

• `Optional` **maxChunks**: `number`

Maximum number of chunks to return per document.

**`Remarks`**

Default is 50.

#### Defined in

[LocalDocumentIndex.ts:28](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocumentIndex.ts#L28)

___

### maxDocuments

• `Optional` **maxDocuments**: `number`

Optional. Maximum number of documents to return.

**`Remarks`**

Default is 10.

#### Defined in

[LocalDocumentIndex.ts:21](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocumentIndex.ts#L21)
