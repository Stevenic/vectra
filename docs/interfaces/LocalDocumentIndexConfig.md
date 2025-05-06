[Vectra](../README.md) / [Exports](../modules.md) / LocalDocumentIndexConfig

# Interface: LocalDocumentIndexConfig

Configuration for a local document index.

## Table of contents

### Properties

- [chunkingConfig](LocalDocumentIndexConfig.md#chunkingconfig)
- [embeddings](LocalDocumentIndexConfig.md#embeddings)
- [folderPath](LocalDocumentIndexConfig.md#folderpath)
- [tokenizer](LocalDocumentIndexConfig.md#tokenizer)

## Properties

### chunkingConfig

• `Optional` **chunkingConfig**: `Partial`\<[`TextSplitterConfig`](TextSplitterConfig.md)\>

Optional. Configuration settings for splitting text into chunks.

#### Defined in

[LocalDocumentIndex.ts:65](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocumentIndex.ts#L65)

___

### embeddings

• `Optional` **embeddings**: [`EmbeddingsModel`](EmbeddingsModel.md)

Optional. Embeddings model to use for generating document embeddings.

#### Defined in

[LocalDocumentIndex.ts:55](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocumentIndex.ts#L55)

___

### folderPath

• **folderPath**: `string`

Folder path where the index is stored.

#### Defined in

[LocalDocumentIndex.ts:50](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocumentIndex.ts#L50)

___

### tokenizer

• `Optional` **tokenizer**: [`Tokenizer`](Tokenizer.md)

Optional. Tokenizer to use for splitting text into tokens.

#### Defined in

[LocalDocumentIndex.ts:60](https://github.com/bartonmalow/vectra/blob/418123d/src/LocalDocumentIndex.ts#L60)
