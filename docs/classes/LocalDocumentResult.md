[Vectra](../README.md) / [Exports](../modules.md) / LocalDocumentResult

# Class: LocalDocumentResult

Represents the result of a document query.

## Hierarchy

- [`LocalDocument`](LocalDocument.md)

  ↳ **`LocalDocumentResult`**

## Table of contents

### Constructors

- [constructor](LocalDocumentResult.md#constructor)

### Accessors

- [chunks](LocalDocumentResult.md#chunks)
- [folderPath](LocalDocumentResult.md#folderpath)
- [id](LocalDocumentResult.md#id)
- [score](LocalDocumentResult.md#score)
- [uri](LocalDocumentResult.md#uri)

### Methods

- [getLength](LocalDocumentResult.md#getlength)
- [getSections](LocalDocumentResult.md#getsections)
- [getText](LocalDocumentResult.md#gettext)
- [hasMetadata](LocalDocumentResult.md#hasmetadata)
- [loadMetadata](LocalDocumentResult.md#loadmetadata)
- [loadText](LocalDocumentResult.md#loadtext)
- [renderAllSections](LocalDocumentResult.md#renderallsections)

## Constructors

### constructor

• **new LocalDocumentResult**(`index`, `documentId`, `uri`, `chunks`, `tokenizer`)

Creates a new instance of LocalDocumentResult.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `index` | [`LocalDocumentIndex`](LocalDocumentIndex.md) | The document index this result belongs to. |
| `documentId` | `string` | The ID of the document. |
| `uri` | `string` | The URI of the document. |
| `chunks` | [`QueryResult`](../interfaces/QueryResult.md)\<[`DocumentChunkMetadata`](../interfaces/DocumentChunkMetadata.md)\>[] | The chunks that matched the query. |
| `tokenizer` | [`Tokenizer`](../interfaces/Tokenizer.md) | The tokenizer to use for text processing. |

#### Overrides

[LocalDocument](LocalDocument.md).[constructor](LocalDocument.md#constructor)

#### Defined in

[LocalDocumentResult.ts:22](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocumentResult.ts#L22)

## Accessors

### chunks

• `get` **chunks**(): [`QueryResult`](../interfaces/QueryResult.md)\<[`DocumentChunkMetadata`](../interfaces/DocumentChunkMetadata.md)\>[]

Returns the chunks of the document that matched the query.

#### Returns

[`QueryResult`](../interfaces/QueryResult.md)\<[`DocumentChunkMetadata`](../interfaces/DocumentChunkMetadata.md)\>[]

#### Defined in

[LocalDocumentResult.ts:36](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocumentResult.ts#L36)

___

### folderPath

• `get` **folderPath**(): `string`

Returns the folder path where the document is stored.

#### Returns

`string`

#### Inherited from

LocalDocument.folderPath

#### Defined in

[LocalDocument.ts:32](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocument.ts#L32)

___

### id

• `get` **id**(): `string`

Returns the ID of the document.

#### Returns

`string`

#### Inherited from

LocalDocument.id

#### Defined in

[LocalDocument.ts:39](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocument.ts#L39)

___

### score

• `get` **score**(): `number`

Returns the average score of the document result.

#### Returns

`number`

#### Defined in

[LocalDocumentResult.ts:43](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocumentResult.ts#L43)

___

### uri

• `get` **uri**(): `string`

Returns the URI of the document.

#### Returns

`string`

#### Inherited from

LocalDocument.uri

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

#### Inherited from

[LocalDocument](LocalDocument.md).[getLength](LocalDocument.md#getlength)

#### Defined in

[LocalDocument.ts:56](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocument.ts#L56)

___

### getSections

▸ **getSections**(`maxTokens?`, `maxSections?`): `Promise`\<[`DocumentTextSection`](../interfaces/DocumentTextSection.md)[]\>

Gets the sections of the document that matched the query.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `maxTokens?` | `number` | Maximum number of tokens per section. |
| `maxSections?` | `number` | Maximum number of sections to return. |

#### Returns

`Promise`\<[`DocumentTextSection`](../interfaces/DocumentTextSection.md)[]\>

Array of document sections.

#### Defined in

[LocalDocumentResult.ts:132](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocumentResult.ts#L132)

___

### getText

▸ **getText**(): `Promise`\<`string`\>

Gets the text of the document.

#### Returns

`Promise`\<`string`\>

The text of the document.

#### Defined in

[LocalDocumentResult.ts:51](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocumentResult.ts#L51)

___

### hasMetadata

▸ **hasMetadata**(): `Promise`\<`boolean`\>

Determines if the document has additional metadata storred on disk.

#### Returns

`Promise`\<`boolean`\>

True if the document has metadata; otherwise, false.

#### Inherited from

[LocalDocument](LocalDocument.md).[hasMetadata](LocalDocument.md#hasmetadata)

#### Defined in

[LocalDocument.ts:69](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocument.ts#L69)

___

### loadMetadata

▸ **loadMetadata**(): `Promise`\<`Record`\<`string`, [`MetadataTypes`](../modules.md#metadatatypes)\>\>

Loads the metadata for the document from disk.

#### Returns

`Promise`\<`Record`\<`string`, [`MetadataTypes`](../modules.md#metadatatypes)\>\>

Metadata for the document.

#### Inherited from

[LocalDocument](LocalDocument.md).[loadMetadata](LocalDocument.md#loadmetadata)

#### Defined in

[LocalDocument.ts:82](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocument.ts#L82)

___

### loadText

▸ **loadText**(): `Promise`\<`string`\>

Loads the text for the document from disk.

#### Returns

`Promise`\<`string`\>

Text for the document.

#### Inherited from

[LocalDocument](LocalDocument.md).[loadText](LocalDocument.md#loadtext)

#### Defined in

[LocalDocument.ts:105](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocument.ts#L105)

___

### renderAllSections

▸ **renderAllSections**(`maxTokens`): `Promise`\<[`DocumentTextSection`](../interfaces/DocumentTextSection.md)[]\>

Renders all of the results chunks as spans of text (sections.)

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `maxTokens` | `number` | Maximum number of tokens per section. |

#### Returns

`Promise`\<[`DocumentTextSection`](../interfaces/DocumentTextSection.md)[]\>

Array of rendered text sections.

**`Remarks`**

The returned sections will be sorted by document order and limited to maxTokens in length.

#### Defined in

[LocalDocumentResult.ts:62](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocumentResult.ts#L62)
