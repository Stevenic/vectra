[Vectra](../README.md) / [Exports](../modules.md) / CreateEmbeddingRequest

# Interface: CreateEmbeddingRequest

Request to create embeddings.

## Hierarchy

- **`CreateEmbeddingRequest`**

  ↳ [`OpenAICreateEmbeddingRequest`](OpenAICreateEmbeddingRequest.md)

## Table of contents

### Properties

- [dimensions](CreateEmbeddingRequest.md#dimensions)
- [input](CreateEmbeddingRequest.md#input)
- [user](CreateEmbeddingRequest.md#user)

## Properties

### dimensions

• `Optional` **dimensions**: `number`

Optional. Number of dimensions for the embeddings.

#### Defined in

[types.ts:242](https://github.com/bartonmalow/vectra/blob/418123d/src/types.ts#L242)

___

### input

• **input**: [`CreateEmbeddingRequestInput`](../modules.md#createembeddingrequestinput)

Text inputs to create embeddings for.

#### Defined in

[types.ts:237](https://github.com/bartonmalow/vectra/blob/418123d/src/types.ts#L237)

___

### user

• `Optional` **user**: `string`

Optional. User identifier for the request.

#### Defined in

[types.ts:247](https://github.com/bartonmalow/vectra/blob/418123d/src/types.ts#L247)
