[Vectra](README.md) / Exports

# Vectra

## Table of contents

### Classes

- [FileFetcher](classes/FileFetcher.md)
- [GPT3Tokenizer](classes/GPT3Tokenizer.md)
- [ItemSelector](classes/ItemSelector.md)
- [LocalDocument](classes/LocalDocument.md)
- [LocalDocumentIndex](classes/LocalDocumentIndex.md)
- [LocalDocumentResult](classes/LocalDocumentResult.md)
- [LocalIndex](classes/LocalIndex.md)
- [OpenAIEmbeddings](classes/OpenAIEmbeddings.md)
- [TextSplitter](classes/TextSplitter.md)
- [WebFetcher](classes/WebFetcher.md)

### Interfaces

- [AzureOpenAIEmbeddingsOptions](interfaces/AzureOpenAIEmbeddingsOptions.md)
- [BaseOpenAIEmbeddingsOptions](interfaces/BaseOpenAIEmbeddingsOptions.md)
- [CreateEmbeddingRequest](interfaces/CreateEmbeddingRequest.md)
- [CreateEmbeddingResponse](interfaces/CreateEmbeddingResponse.md)
- [CreateEmbeddingResponseDataInner](interfaces/CreateEmbeddingResponseDataInner.md)
- [CreateEmbeddingResponseUsage](interfaces/CreateEmbeddingResponseUsage.md)
- [CreateIndexConfig](interfaces/CreateIndexConfig.md)
- [DocumentCatalogStats](interfaces/DocumentCatalogStats.md)
- [DocumentChunkMetadata](interfaces/DocumentChunkMetadata.md)
- [DocumentQueryOptions](interfaces/DocumentQueryOptions.md)
- [DocumentTextSection](interfaces/DocumentTextSection.md)
- [EmbeddingsModel](interfaces/EmbeddingsModel.md)
- [EmbeddingsResponse](interfaces/EmbeddingsResponse.md)
- [IndexItem](interfaces/IndexItem.md)
- [IndexStats](interfaces/IndexStats.md)
- [LocalDocumentIndexConfig](interfaces/LocalDocumentIndexConfig.md)
- [MetadataFilter](interfaces/MetadataFilter.md)
- [OSSEmbeddingsOptions](interfaces/OSSEmbeddingsOptions.md)
- [OpenAICreateEmbeddingRequest](interfaces/OpenAICreateEmbeddingRequest.md)
- [OpenAIEmbeddingsOptions](interfaces/OpenAIEmbeddingsOptions.md)
- [QueryResult](interfaces/QueryResult.md)
- [TextChunk](interfaces/TextChunk.md)
- [TextFetcher](interfaces/TextFetcher.md)
- [TextSplitterConfig](interfaces/TextSplitterConfig.md)
- [Tokenizer](interfaces/Tokenizer.md)
- [WebFetcherConfig](interfaces/WebFetcherConfig.md)

### Type Aliases

- [CreateEmbeddingRequestInput](modules.md#createembeddingrequestinput)
- [EmbeddingsResponseStatus](modules.md#embeddingsresponsestatus)
- [MetadataTypes](modules.md#metadatatypes)

## Type Aliases

### CreateEmbeddingRequestInput

Ƭ **CreateEmbeddingRequestInput**: (`string` \| `number` \| `boolean` \| ``null`` \| `object`)[] \| `number`[] \| `string`[] \| `string`

Request input for creating embeddings.

#### Defined in

[types.ts:227](https://github.com/bartonmalow/vectra/blob/418123d/src/types.ts#L227)

___

### EmbeddingsResponseStatus

Ƭ **EmbeddingsResponseStatus**: ``"success"`` \| ``"error"`` \| ``"rate_limited"`` \| ``"cancelled"``

Status of an embeddings response.

#### Defined in

[types.ts:23](https://github.com/bartonmalow/vectra/blob/418123d/src/types.ts#L23)

___

### MetadataTypes

Ƭ **MetadataTypes**: `number` \| `string` \| `boolean`

Types of metadata values.

#### Defined in

[types.ts:168](https://github.com/bartonmalow/vectra/blob/418123d/src/types.ts#L168)
