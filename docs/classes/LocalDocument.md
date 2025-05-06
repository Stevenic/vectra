[Vectra](../README.md) / [Exports](../modules.md) / LocalDocument

# Class: LocalDocument

Represents a document stored in a local index.

## Hierarchy

- **`LocalDocument`**

  ↳ [`LocalDocumentResult`](LocalDocumentResult.md)

## Table of contents

### Constructors

- [constructor](LocalDocument.md#constructor)

### Accessors

- [folderPath](LocalDocument.md#folderpath)
- [id](LocalDocument.md#id)
- [uri](LocalDocument.md#uri)

### Methods

- [getLength](LocalDocument.md#getlength)
- [hasMetadata](LocalDocument.md#hasmetadata)
- [loadMetadata](LocalDocument.md#loadmetadata)
- [loadText](LocalDocument.md#loadtext)

## Constructors

### constructor

• **new LocalDocument**(`index`, `documentId`, `uri`)

Creates a new instance of LocalDocument.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `index` | [`LocalDocumentIndex`](LocalDocumentIndex.md) | The document index this document belongs to. |
| `documentId` | `string` | The ID of the document. |
| `uri` | `string` | The URI of the document. |

#### Defined in

[LocalDocument.ts:23](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocument.ts#L23)

## Accessors

### folderPath

• `get` **folderPath**(): `string`

Returns the folder path where the document is stored.

#### Returns

`string`

#### Defined in

[LocalDocument.ts:32](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocument.ts#L32)

___

### id

• `get` **id**(): `string`

Returns the ID of the document.

#### Returns

`string`

#### Defined in

[LocalDocument.ts:39](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocument.ts#L39)

___

### uri

• `get` **uri**(): `string`

Returns the URI of the document.

#### Returns

`string`

#### Defined in

[LocalDocument.ts:46](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocument.ts#L46)

## Methods

### getLength

▸ **getLength**(): `Promise`\<`number`\>

Returns the length of the document in tokens.

#### Returns

`Promise`\<`number`\>

Length of the document in tokens.

**`Remarks`**

This value will be estimated for documents longer then 40k bytes.

#### Defined in

[LocalDocument.ts:56](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocument.ts#L56)

___

### hasMetadata

▸ **hasMetadata**(): `Promise`\<`boolean`\>

Determines if the document has additional metadata storred on disk.

#### Returns

`Promise`\<`boolean`\>

True if the document has metadata; otherwise, false.

#### Defined in

[LocalDocument.ts:69](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocument.ts#L69)

___

### loadMetadata

▸ **loadMetadata**(): `Promise`\<`Record`\<`string`, [`MetadataTypes`](../modules.md#metadatatypes)\>\>

Loads the metadata for the document from disk.

#### Returns

`Promise`\<`Record`\<`string`, [`MetadataTypes`](../modules.md#metadatatypes)\>\>

Metadata for the document.

#### Defined in

[LocalDocument.ts:82](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocument.ts#L82)

___

### loadText

▸ **loadText**(): `Promise`\<`string`\>

Loads the text for the document from disk.

#### Returns

`Promise`\<`string`\>

Text for the document.

#### Defined in

[LocalDocument.ts:105](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocument.ts#L105)
