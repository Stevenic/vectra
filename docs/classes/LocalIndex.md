[Vectra](../README.md) / [Exports](../modules.md) / LocalIndex

# Class: LocalIndex\<TMetadata\>

Local vector index instance.

**`Remarks`**

This class is used to create, update, and query a local vector index.
Each index is a folder on disk containing an index.json file and an optional set of metadata files.

## Type parameters

| Name | Type |
| :------ | :------ |
| `TMetadata` | extends `Record`\<`string`, [`MetadataTypes`](../modules.md#metadatatypes)\> = `Record`\<`string`, [`MetadataTypes`](../modules.md#metadatatypes)\> |

## Hierarchy

- **`LocalIndex`**

  ↳ [`LocalDocumentIndex`](LocalDocumentIndex.md)

## Table of contents

### Constructors

- [constructor](LocalIndex.md#constructor)

### Accessors

- [folderPath](LocalIndex.md#folderpath)
- [indexName](LocalIndex.md#indexname)

### Methods

- [beginUpdate](LocalIndex.md#beginupdate)
- [cancelUpdate](LocalIndex.md#cancelupdate)
- [createIndex](LocalIndex.md#createindex)
- [deleteIndex](LocalIndex.md#deleteindex)
- [deleteItem](LocalIndex.md#deleteitem)
- [endUpdate](LocalIndex.md#endupdate)
- [getIndexStats](LocalIndex.md#getindexstats)
- [getItem](LocalIndex.md#getitem)
- [insertItem](LocalIndex.md#insertitem)
- [isIndexCreated](LocalIndex.md#isindexcreated)
- [listItems](LocalIndex.md#listitems)
- [listItemsByMetadata](LocalIndex.md#listitemsbymetadata)
- [loadIndexData](LocalIndex.md#loadindexdata)
- [queryItems](LocalIndex.md#queryitems)
- [upsertItem](LocalIndex.md#upsertitem)

## Constructors

### constructor

• **new LocalIndex**\<`TMetadata`\>(`folderPath`, `indexName?`)

Creates a new instance of LocalIndex.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `TMetadata` | extends `Record`\<`string`, [`MetadataTypes`](../modules.md#metadatatypes)\> = `Record`\<`string`, [`MetadataTypes`](../modules.md#metadatatypes)\> |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `folderPath` | `string` | Path to the index folder. |
| `indexName?` | `string` | Optional name of the index file. Defaults to index.json. |

#### Defined in

[LocalIndex.ts:62](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalIndex.ts#L62)

## Accessors

### folderPath

• `get` **folderPath**(): `string`

Path to the index folder.

#### Returns

`string`

#### Defined in

[LocalIndex.ts:70](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalIndex.ts#L70)

___

### indexName

• `get` **indexName**(): `string`

Optional name of the index file.

#### Returns

`string`

#### Defined in

[LocalIndex.ts:77](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalIndex.ts#L77)

## Methods

### beginUpdate

▸ **beginUpdate**(): `Promise`\<`void`\>

Begins an update to the index.

#### Returns

`Promise`\<`void`\>

**`Remarks`**

This method loads the index into memory and prepares it for updates.

#### Defined in

[LocalIndex.ts:86](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalIndex.ts#L86)

___

### cancelUpdate

▸ **cancelUpdate**(): `void`

Cancels an update to the index.

#### Returns

`void`

**`Remarks`**

This method discards any changes made to the index since the update began.

#### Defined in

[LocalIndex.ts:100](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalIndex.ts#L100)

___

### createIndex

▸ **createIndex**(`config?`): `Promise`\<`void`\>

Creates a new index.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `config` | [`CreateIndexConfig`](../interfaces/CreateIndexConfig.md) | Index configuration. |

#### Returns

`Promise`\<`void`\>

**`Remarks`**

This method creates a new folder on disk containing an index.json file.

#### Defined in

[LocalIndex.ts:110](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalIndex.ts#L110)

___

### deleteIndex

▸ **deleteIndex**(): `Promise`\<`void`\>

Deletes the index.

#### Returns

`Promise`\<`void`\>

**`Remarks`**

This method deletes the index folder from disk.

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

#### Defined in

[LocalIndex.ts:176](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalIndex.ts#L176)

___

### getIndexStats

▸ **getIndexStats**(): `Promise`\<[`IndexStats`](../interfaces/IndexStats.md)\>

Loads an index from disk and returns its stats.

#### Returns

`Promise`\<[`IndexStats`](../interfaces/IndexStats.md)\>

Index stats.

#### Defined in

[LocalIndex.ts:195](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalIndex.ts#L195)

___

### getItem

▸ **getItem**\<`TItemMetadata`\>(`id`): `Promise`\<[`IndexItem`](../interfaces/IndexItem.md)\<`TItemMetadata`\>\>

Returns an item from the index given its ID.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `TItemMetadata` | extends `Record`\<`string`, [`MetadataTypes`](../modules.md#metadatatypes)\> = `TMetadata` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `id` | `string` | ID of the item to retrieve. |

#### Returns

`Promise`\<[`IndexItem`](../interfaces/IndexItem.md)\<`TItemMetadata`\>\>

Item or undefined if not found.

#### Defined in

[LocalIndex.ts:209](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalIndex.ts#L209)

___

### insertItem

▸ **insertItem**\<`TItemMetadata`\>(`item`): `Promise`\<[`IndexItem`](../interfaces/IndexItem.md)\<`TItemMetadata`\>\>

Adds an item to the index.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `TItemMetadata` | extends `Record`\<`string`, [`MetadataTypes`](../modules.md#metadatatypes)\> = `TMetadata` |

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

#### Defined in

[LocalIndex.ts:223](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalIndex.ts#L223)

___

### isIndexCreated

▸ **isIndexCreated**(): `Promise`\<`boolean`\>

Returns true if the index exists.

#### Returns

`Promise`\<`boolean`\>

#### Defined in

[LocalIndex.ts:238](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalIndex.ts#L238)

___

### listItems

▸ **listItems**\<`TItemMetadata`\>(): `Promise`\<[`IndexItem`](../interfaces/IndexItem.md)\<`TItemMetadata`\>[]\>

Returns all items in the index.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `TItemMetadata` | extends `Record`\<`string`, [`MetadataTypes`](../modules.md#metadatatypes)\> = `TMetadata` |

#### Returns

`Promise`\<[`IndexItem`](../interfaces/IndexItem.md)\<`TItemMetadata`\>[]\>

Array of all items in the index.

**`Remarks`**

This method loads the index into memory and returns all its items. A copy of the items
array is returned so no modifications should be made to the array.

#### Defined in

[LocalIndex.ts:254](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalIndex.ts#L254)

___

### listItemsByMetadata

▸ **listItemsByMetadata**\<`TItemMetadata`\>(`filter`): `Promise`\<[`IndexItem`](../interfaces/IndexItem.md)\<`TItemMetadata`\>[]\>

Returns all items in the index matching the filter.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `TItemMetadata` | extends `Record`\<`string`, [`MetadataTypes`](../modules.md#metadatatypes)\> = `TMetadata` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `filter` | [`MetadataFilter`](../interfaces/MetadataFilter.md) | Filter to apply. |

#### Returns

`Promise`\<[`IndexItem`](../interfaces/IndexItem.md)\<`TItemMetadata`\>[]\>

Array of items matching the filter.

**`Remarks`**

This method loads the index into memory and returns all its items matching the filter.

#### Defined in

[LocalIndex.ts:266](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalIndex.ts#L266)

___

### loadIndexData

▸ `Protected` **loadIndexData**(): `Promise`\<`void`\>

Ensures that the index has been loaded into memory.

#### Returns

`Promise`\<`void`\>

#### Defined in

[LocalIndex.ts:342](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalIndex.ts#L342)

___

### queryItems

▸ **queryItems**\<`TItemMetadata`\>(`vector`, `query`, `topK`, `filter?`, `isBm25?`): `Promise`\<[`QueryResult`](../interfaces/QueryResult.md)\<`TItemMetadata`\>[]\>

Finds the top k items in the index that are most similar to the vector.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `TItemMetadata` | extends `Record`\<`string`, [`MetadataTypes`](../modules.md#metadatatypes)\> = `TMetadata` |

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

#### Defined in

[LocalIndex.ts:285](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalIndex.ts#L285)

___

### upsertItem

▸ **upsertItem**\<`TItemMetadata`\>(`item`): `Promise`\<[`IndexItem`](../interfaces/IndexItem.md)\<`TItemMetadata`\>\>

Adds or replaces an item in the index.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `TItemMetadata` | extends `Record`\<`string`, [`MetadataTypes`](../modules.md#metadatatypes)\> = `TMetadata` |

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

#### Defined in

[LocalIndex.ts:328](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalIndex.ts#L328)
