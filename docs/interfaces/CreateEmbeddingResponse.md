[Vectra](../README.md) / [Exports](../modules.md) / CreateEmbeddingResponse

# Interface: CreateEmbeddingResponse

Response from creating embeddings.

## Table of contents

### Properties

- [data](CreateEmbeddingResponse.md#data)
- [model](CreateEmbeddingResponse.md#model)
- [object](CreateEmbeddingResponse.md#object)
- [usage](CreateEmbeddingResponse.md#usage)

## Properties

### data

• **data**: [`CreateEmbeddingResponseDataInner`](CreateEmbeddingResponseDataInner.md)[]

Array of embeddings.

#### Defined in

[types.ts:316](https://github.com/bartonmalow/vectra/blob/418123d/src/types.ts#L316)

___

### model

• **model**: `string`

Model used to create the embeddings.

#### Defined in

[types.ts:311](https://github.com/bartonmalow/vectra/blob/418123d/src/types.ts#L311)

___

### object

• **object**: `string`

Type of the object.

#### Defined in

[types.ts:306](https://github.com/bartonmalow/vectra/blob/418123d/src/types.ts#L306)

___

### usage

• **usage**: [`CreateEmbeddingResponseUsage`](CreateEmbeddingResponseUsage.md)

Usage statistics.

#### Defined in

[types.ts:321](https://github.com/bartonmalow/vectra/blob/418123d/src/types.ts#L321)
