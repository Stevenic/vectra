[Vectra](../README.md) / [Exports](../modules.md) / LocalDocumentIndex

# Class: LocalDocumentIndex

Represents a local index of documents stored on disk.

## Hierarchy

- [`LocalIndex`](LocalIndex.md)\<[`DocumentChunkMetadata`](../interfaces/DocumentChunkMetadata.md)\>

  ↳ **`LocalDocumentIndex`**

## Table of contents

### Constructors

- [constructor](LocalDocumentIndex.md#constructor)

### Accessors

- [embeddings](LocalDocumentIndex.md#embeddings)
- [folderPath](LocalDocumentIndex.md#folderpath)
- [indexName](LocalDocumentIndex.md#indexname)
- [tokenizer](LocalDocumentIndex.md#tokenizer)

### Methods

- [beginUpdate](LocalDocumentIndex.md#beginupdate)
- [cancelUpdate](LocalDocumentIndex.md#cancelupdate)
- [createIndex](LocalDocumentIndex.md#createindex)
- [deleteDocument](LocalDocumentIndex.md#deletedocument)
- [deleteIndex](LocalDocumentIndex.md#deleteindex)
- [deleteItem](LocalDocumentIndex.md#deleteitem)
- [endUpdate](LocalDocumentIndex.md#endupdate)
- [getCatalogStats](LocalDocumentIndex.md#getcatalogstats)
- [getDocumentId](LocalDocumentIndex.md#getdocumentid)
- [getDocumentUri](LocalDocumentIndex.md#getdocumenturi)
- [getIndexStats](LocalDocumentIndex.md#getindexstats)
- [getItem](LocalDocumentIndex.md#getitem)
- [insertItem](LocalDocumentIndex.md#insertitem)
- [isCatalogCreated](LocalDocumentIndex.md#iscatalogcreated)
- [isIndexCreated](LocalDocumentIndex.md#isindexcreated)
- [listDocuments](LocalDocumentIndex.md#listdocuments)
- [listItems](LocalDocumentIndex.md#listitems)
- [listItemsByMetadata](LocalDocumentIndex.md#listitemsbymetadata)
- [loadIndexData](LocalDocumentIndex.md#loadindexdata)
- [queryDocuments](LocalDocumentIndex.md#querydocuments)
- [queryItems](LocalDocumentIndex.md#queryitems)
- [upsertDocument](LocalDocumentIndex.md#upsertdocument)
- [upsertItem](LocalDocumentIndex.md#upsertitem)

## Constructors

### constructor

• **new LocalDocumentIndex**(`config`)

Creates a new instance of LocalDocumentIndex.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `config` | [`LocalDocumentIndexConfig`](../interfaces/LocalDocumentIndexConfig.md) | Configuration settings for the document index. |

#### Overrides

[LocalIndex](LocalIndex.md).[constructor](LocalIndex.md#constructor)

#### Defined in

[LocalDocumentIndex.ts:83](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocumentIndex.ts#L83)

## Accessors

### embeddings

• `get` **embeddings**(): [`EmbeddingsModel`](../interfaces/EmbeddingsModel.md)

Gets the embeddings model.

#### Returns

[`EmbeddingsModel`](../interfaces/EmbeddingsModel.md)

The embeddings model

#### Defined in

[LocalDocumentIndex.ts:100](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocumentIndex.ts#L100)

___

### folderPath

• `get` **folderPath**(): `string`

Path to the index folder.

#### Returns

`string`

#### Inherited from

LocalIndex.folderPath

#### Defined in

[LocalIndex.ts:70](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalIndex.ts#L70)

___

### indexName

• `get` **indexName**(): `string`

Optional name of the index file.

#### Returns

`string`

#### Inherited from

LocalIndex.indexName

#### Defined in

[LocalIndex.ts:77](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalIndex.ts#L77)

___

### tokenizer

• `get` **tokenizer**(): [`Tokenizer`](../interfaces/Tokenizer.md)

Gets the tokenizer.

#### Returns

[`Tokenizer`](../interfaces/Tokenizer.md)

The tokenizer

#### Defined in

[LocalDocumentIndex.ts:109](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocumentIndex.ts#L109)

## Methods

### beginUpdate

▸ **beginUpdate**(): `Promise`\<`void`\>

Begins an update to the index.

#### Returns

`Promise`\<`void`\>

**`Remarks`**

This method loads the index into memory and prepares it for updates.

#### Overrides

[LocalIndex](LocalIndex.md).[beginUpdate](LocalIndex.md#beginupdate)

#### Defined in

[LocalDocumentIndex.ts:418](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocumentIndex.ts#L418)

___

### cancelUpdate

▸ **cancelUpdate**(): `void`

Cancels an update to the index.

#### Returns

`void`

**`Remarks`**

This method discards any changes made to the index since the update began.

#### Overrides

[LocalIndex](LocalIndex.md).[cancelUpdate](LocalIndex.md#cancelupdate)

#### Defined in

[LocalDocumentIndex.ts:423](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocumentIndex.ts#L423)

___

### createIndex

▸ **createIndex**(`config?`): `Promise`\<`void`\>

Creates a new index.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `config?` | [`CreateIndexConfig`](../interfaces/CreateIndexConfig.md) | Index configuration. |

#### Returns

`Promise`\<`void`\>

**`Remarks`**

This method creates a new folder on disk containing an index.json file.

#### Overrides

[LocalIndex](LocalIndex.md).[createIndex](LocalIndex.md#createindex)

#### Defined in

[LocalDocumentIndex.ts:428](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocumentIndex.ts#L428)

___

### deleteDocument

▸ **deleteDocument**(`uri`): `Promise`\<`void`\>

Deletes a document from the index.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `uri` | `string` | URI of the document to delete. |

#### Returns

`Promise`\<`void`\>

#### Defined in

[LocalDocumentIndex.ts:168](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocumentIndex.ts#L168)

___

### deleteIndex

▸ **deleteIndex**(): `Promise`\<`void`\>

Deletes the index.

#### Returns

`Promise`\<`void`\>

**`Remarks`**

This method deletes the index folder from disk.

#### Inherited from

[LocalIndex](LocalIndex.md).[deleteIndex](LocalIndex.md#deleteindex)

#### Defined in

[LocalIndex.ts:143](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalIndex.ts#L143)

___

### deleteItem

▸ **deleteItem**(`id`): `Promise`\<`void`\>

Deletes an item from the index.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `id` | `string` | ID of item to delete. |

#### Returns

`Promise`\<`void`\>

#### Inherited from

[LocalIndex](LocalIndex.md).[deleteItem](LocalIndex.md#deleteitem)

#### Defined in

[LocalIndex.ts:155](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalIndex.ts#L155)

___

### endUpdate

▸ **endUpdate**(): `Promise`\<`void`\>

Ends an update to the index.

#### Returns

`Promise`\<`void`\>

**`Remarks`**

This method saves the index to disk.

#### Overrides

[LocalIndex](LocalIndex.md).[endUpdate](LocalIndex.md#endupdate)

#### Defined in

[LocalDocumentIndex.ts:433](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocumentIndex.ts#L433)

___

### getCatalogStats

▸ **getCatalogStats**(): `Promise`\<[`DocumentCatalogStats`](../interfaces/DocumentCatalogStats.md)\>

Gets the catalog statistics.

#### Returns

`Promise`\<[`DocumentCatalogStats`](../interfaces/DocumentCatalogStats.md)\>

The catalog statistics

#### Defined in

[LocalDocumentIndex.ts:154](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocumentIndex.ts#L154)

___

### getDocumentId

▸ **getDocumentId**(`uri`): `Promise`\<`string`\>

Gets the document ID for a URI.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `uri` | `string` | The URI to get the document ID for |

#### Returns

`Promise`\<`string`\>

The document ID, or undefined if not found

#### Defined in

[LocalDocumentIndex.ts:133](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocumentIndex.ts#L133)

___

### getDocumentUri

▸ **getDocumentUri**(`documentId`): `Promise`\<`string`\>

Gets the document URI for a document ID.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `documentId` | `string` | The document ID to get the URI for |

#### Returns

`Promise`\<`string`\>

The document URI, or undefined if not found

#### Defined in

[LocalDocumentIndex.ts:144](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocumentIndex.ts#L144)

___

### getIndexStats

▸ **getIndexStats**(): `Promise`\<[`IndexStats`](../interfaces/IndexStats.md)\>

Loads an index from disk and returns its stats.

#### Returns

`Promise`\<[`IndexStats`](../interfaces/IndexStats.md)\>

Index stats.

#### Inherited from

[LocalIndex](LocalIndex.md).[getIndexStats](LocalIndex.md#getindexstats)

#### Defined in

[LocalIndex.ts:195](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalIndex.ts#L195)

___

### getItem

▸ **getItem**\<`TItemMetadata`\>(`id`): `Promise`\<[`IndexItem`](../interfaces/IndexItem.md)\<`TItemMetadata`\>\>

Returns an item from the index given its ID.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `TItemMetadata` | extends [`DocumentChunkMetadata`](../interfaces/DocumentChunkMetadata.md) = [`DocumentChunkMetadata`](../interfaces/DocumentChunkMetadata.md) |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `id` | `string` | ID of the item to retrieve. |

#### Returns

`Promise`\<[`IndexItem`](../interfaces/IndexItem.md)\<`TItemMetadata`\>\>

Item or undefined if not found.

#### Inherited from

[LocalIndex](LocalIndex.md).[getItem](LocalIndex.md#getitem)

#### Defined in

[LocalIndex.ts:209](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalIndex.ts#L209)

___

### insertItem

▸ **insertItem**\<`TItemMetadata`\>(`item`): `Promise`\<[`IndexItem`](../interfaces/IndexItem.md)\<`TItemMetadata`\>\>

Adds an item to the index.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `TItemMetadata` | extends [`DocumentChunkMetadata`](../interfaces/DocumentChunkMetadata.md) = [`DocumentChunkMetadata`](../interfaces/DocumentChunkMetadata.md) |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `item` | `Partial`\<[`IndexItem`](../interfaces/IndexItem.md)\<`TItemMetadata`\>\> | Item to insert. |

#### Returns

`Promise`\<[`IndexItem`](../interfaces/IndexItem.md)\<`TItemMetadata`\>\>

Inserted item.

**`Remarks`**

A new update is started if one is not already in progress. If an item with the same ID
already exists, an error will be thrown.

#### Inherited from

[LocalIndex](LocalIndex.md).[insertItem](LocalIndex.md#insertitem)

#### Defined in

[LocalIndex.ts:223](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalIndex.ts#L223)

___

### isCatalogCreated

▸ **isCatalogCreated**(): `Promise`\<`boolean`\>

Checks if the document catalog exists.

#### Returns

`Promise`\<`boolean`\>

True if the catalog exists, false otherwise

#### Defined in

[LocalDocumentIndex.ts:118](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocumentIndex.ts#L118)

___

### isIndexCreated

▸ **isIndexCreated**(): `Promise`\<`boolean`\>

Returns true if the index exists.

#### Returns

`Promise`\<`boolean`\>

#### Inherited from

[LocalIndex](LocalIndex.md).[isIndexCreated](LocalIndex.md#isindexcreated)

#### Defined in

[LocalIndex.ts:238](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalIndex.ts#L238)

___

### listDocuments

▸ **listDocuments**(): `Promise`\<[`LocalDocumentResult`](LocalDocumentResult.md)[]\>

Lists all documents in the index.

#### Returns

`Promise`\<[`LocalDocumentResult`](LocalDocumentResult.md)[]\>

Array of document results

#### Defined in

[LocalDocumentIndex.ts:341](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocumentIndex.ts#L341)

___

### listItems

▸ **listItems**\<`TItemMetadata`\>(): `Promise`\<[`IndexItem`](../interfaces/IndexItem.md)\<`TItemMetadata`\>[]\>

Returns all items in the index.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `TItemMetadata` | extends [`DocumentChunkMetadata`](../interfaces/DocumentChunkMetadata.md) = [`DocumentChunkMetadata`](../interfaces/DocumentChunkMetadata.md) |

#### Returns

`Promise`\<[`IndexItem`](../interfaces/IndexItem.md)\<`TItemMetadata`\>[]\>

Array of all items in the index.

**`Remarks`**

This method loads the index into memory and returns all its items. A copy of the items
array is returned so no modifications should be made to the array.

#### Inherited from

[LocalIndex](LocalIndex.md).[listItems](LocalIndex.md#listitems)

#### Defined in

[LocalIndex.ts:254](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalIndex.ts#L254)

___

### listItemsByMetadata

▸ **listItemsByMetadata**\<`TItemMetadata`\>(`filter`): `Promise`\<[`IndexItem`](../interfaces/IndexItem.md)\<`TItemMetadata`\>[]\>

Returns all items in the index matching the filter.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `TItemMetadata` | extends [`DocumentChunkMetadata`](../interfaces/DocumentChunkMetadata.md) = [`DocumentChunkMetadata`](../interfaces/DocumentChunkMetadata.md) |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `filter` | [`MetadataFilter`](../interfaces/MetadataFilter.md) | Filter to apply. |

#### Returns

`Promise`\<[`IndexItem`](../interfaces/IndexItem.md)\<`TItemMetadata`\>[]\>

Array of items matching the filter.

**`Remarks`**

This method loads the index into memory and returns all its items matching the filter.

#### Inherited from

[LocalIndex](LocalIndex.md).[listItemsByMetadata](LocalIndex.md#listitemsbymetadata)

#### Defined in

[LocalIndex.ts:266](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalIndex.ts#L266)

___

### loadIndexData

▸ `Protected` **loadIndexData**(): `Promise`\<`void`\>

Ensures that the index has been loaded into memory.

#### Returns

`Promise`\<`void`\>

#### Overrides

[LocalIndex](LocalIndex.md).[loadIndexData](LocalIndex.md#loadindexdata)

#### Defined in

[LocalDocumentIndex.ts:446](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocumentIndex.ts#L446)

___

### queryDocuments

▸ **queryDocuments**(`query`, `options?`): `Promise`\<[`LocalDocumentResult`](LocalDocumentResult.md)[]\>

Queries the index for documents similar to the given query.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `query` | `string` | Text to query for |
| `options?` | [`DocumentQueryOptions`](../interfaces/DocumentQueryOptions.md) | Optional. Query options |

#### Returns

`Promise`\<[`LocalDocumentResult`](LocalDocumentResult.md)[]\>

Array of document results

#### Defined in

[LocalDocumentIndex.ts:371](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocumentIndex.ts#L371)

___

### queryItems

▸ **queryItems**\<`TItemMetadata`\>(`vector`, `query`, `topK`, `filter?`, `isBm25?`): `Promise`\<[`QueryResult`](../interfaces/QueryResult.md)\<`TItemMetadata`\>[]\>

Finds the top k items in the index that are most similar to the vector.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `TItemMetadata` | extends [`DocumentChunkMetadata`](../interfaces/DocumentChunkMetadata.md) = [`DocumentChunkMetadata`](../interfaces/DocumentChunkMetadata.md) |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `vector` | `number`[] | Vector to query against. |
| `query` | `string` | Query text for BM25 search. |
| `topK` | `number` | Number of items to return. |
| `filter?` | [`MetadataFilter`](../interfaces/MetadataFilter.md) | Optional. Filter to apply. |
| `isBm25?` | `boolean` | Optional. Whether to use BM25 search. |

#### Returns

`Promise`\<[`QueryResult`](../interfaces/QueryResult.md)\<`TItemMetadata`\>[]\>

Similar items to the vector that match the supplied filter.

**`Remarks`**

This method loads the index into memory and returns the top k items that are most similar.
An optional filter can be applied to the metadata of the items.

#### Inherited from

[LocalIndex](LocalIndex.md).[queryItems](LocalIndex.md#queryitems)

#### Defined in

[LocalIndex.ts:285](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalIndex.ts#L285)

___

### upsertDocument

▸ **upsertDocument**(`uri`, `text`, `docType?`, `metadata?`): `Promise`\<[`LocalDocument`](LocalDocument.md)\>

Upserts a document into the index.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `uri` | `string` | URI of the document |
| `text` | `string` | Text of the document |
| `docType?` | `string` | Optional. Type of the document |
| `metadata?` | `Record`\<`string`, [`MetadataTypes`](../modules.md#metadatatypes)\> | Optional. Metadata for the document |

#### Returns

`Promise`\<[`LocalDocument`](LocalDocument.md)\>

The upserted document

#### Defined in

[LocalDocumentIndex.ts:223](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocumentIndex.ts#L223)

___

### upsertItem

▸ **upsertItem**\<`TItemMetadata`\>(`item`): `Promise`\<[`IndexItem`](../interfaces/IndexItem.md)\<`TItemMetadata`\>\>

Adds or replaces an item in the index.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `TItemMetadata` | extends [`DocumentChunkMetadata`](../interfaces/DocumentChunkMetadata.md) = [`DocumentChunkMetadata`](../interfaces/DocumentChunkMetadata.md) |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `item` | `Partial`\<[`IndexItem`](../interfaces/IndexItem.md)\<`TItemMetadata`\>\> | Item to insert or replace. |

#### Returns

`Promise`\<[`IndexItem`](../interfaces/IndexItem.md)\<`TItemMetadata`\>\>

Upserted item.

**`Remarks`**

A new update is started if one is not already in progress. If an item with the same ID
already exists, it will be replaced.

#### Inherited from

[LocalIndex](LocalIndex.md).[upsertItem](LocalIndex.md#upsertitem)

#### Defined in

[LocalIndex.ts:328](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalIndex.ts#L328)
