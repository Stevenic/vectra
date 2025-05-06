[Vectra](../README.md) / [Exports](../modules.md) / OpenAICreateEmbeddingRequest

# Interface: OpenAICreateEmbeddingRequest

OpenAI-specific embedding request.

## Hierarchy

- [`CreateEmbeddingRequest`](CreateEmbeddingRequest.md)

  ↳ **`OpenAICreateEmbeddingRequest`**

## Table of contents

### Properties

- [dimensions](OpenAICreateEmbeddingRequest.md#dimensions)
- [input](OpenAICreateEmbeddingRequest.md#input)
- [model](OpenAICreateEmbeddingRequest.md#model)
- [user](OpenAICreateEmbeddingRequest.md#user)

## Properties

### dimensions

• `Optional` **dimensions**: `number`

Optional. Number of dimensions for the embeddings.

#### Inherited from

[CreateEmbeddingRequest](CreateEmbeddingRequest.md).[dimensions](CreateEmbeddingRequest.md#dimensions)

#### Defined in

[types.ts:242](https://github.com/bartonmalow/vectra/blob/418123d/src/types.ts#L242)

___

### input

• **input**: [`CreateEmbeddingRequestInput`](../modules.md#createembeddingrequestinput)

Text inputs to create embeddings for.

#### Inherited from

[CreateEmbeddingRequest](CreateEmbeddingRequest.md).[input](CreateEmbeddingRequest.md#input)

#### Defined in

[types.ts:237](https://github.com/bartonmalow/vectra/blob/418123d/src/types.ts#L237)

___

### model

• **model**: `string`

Model to use for creating embeddings.

#### Defined in

[types.ts:258](https://github.com/bartonmalow/vectra/blob/418123d/src/types.ts#L258)

___

### user

• `Optional` **user**: `string`

Optional. User identifier for the request.

#### Inherited from

[CreateEmbeddingRequest](CreateEmbeddingRequest.md).[user](CreateEmbeddingRequest.md#user)

#### Defined in

[types.ts:247](https://github.com/bartonmalow/vectra/blob/418123d/src/types.ts#L247)
