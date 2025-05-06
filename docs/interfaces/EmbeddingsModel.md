[Vectra](../README.md) / [Exports](../modules.md) / EmbeddingsModel

# Interface: EmbeddingsModel

Interface for embeddings model.

## Implemented by

- [`OpenAIEmbeddings`](../classes/OpenAIEmbeddings.md)

## Table of contents

### Properties

- [maxTokens](EmbeddingsModel.md#maxtokens)

### Methods

- [createEmbeddings](EmbeddingsModel.md#createembeddings)

## Properties

### maxTokens

• `Readonly` **maxTokens**: `number`

Maximum number of tokens

#### Defined in

[types.ts:9](https://github.com/bartonmalow/vectra/blob/418123d/src/types.ts#L9)

## Methods

### createEmbeddings

▸ **createEmbeddings**(`inputs`): `Promise`\<[`EmbeddingsResponse`](EmbeddingsResponse.md)\>

Creates embeddings for text inputs.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `inputs` | `string` \| `string`[] | Text inputs to create embeddings for. |

#### Returns

`Promise`\<[`EmbeddingsResponse`](EmbeddingsResponse.md)\>

A `EmbeddingsResponse` with a status and the generated embeddings or a message when an error occurs.

#### Defined in

[types.ts:16](https://github.com/bartonmalow/vectra/blob/418123d/src/types.ts#L16)
