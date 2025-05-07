[Vectra](../README.md) / [Exports](../modules.md) / EmbeddingsResponse

# Interface: EmbeddingsResponse

Response from an embeddings model.

## Table of contents

### Properties

- [message](EmbeddingsResponse.md#message)
- [model](EmbeddingsResponse.md#model)
- [output](EmbeddingsResponse.md#output)
- [status](EmbeddingsResponse.md#status)
- [usage](EmbeddingsResponse.md#usage)

## Properties

### message

• `Optional` **message**: `string`

Optional. Message when status is not equal to `success`.

#### Defined in

[types.ts:43](https://github.com/bartonmalow/vectra/blob/418123d/src/types.ts#L43)

___

### model

• `Optional` **model**: `string`

Optional. Model used to create the embeddings.

#### Defined in

[types.ts:48](https://github.com/bartonmalow/vectra/blob/418123d/src/types.ts#L48)

___

### output

• `Optional` **output**: `number`[][]

Optional. Embeddings for the given inputs.

#### Defined in

[types.ts:38](https://github.com/bartonmalow/vectra/blob/418123d/src/types.ts#L38)

___

### status

• **status**: [`EmbeddingsResponseStatus`](../modules.md#embeddingsresponsestatus)

Status of the embeddings response.

#### Defined in

[types.ts:33](https://github.com/bartonmalow/vectra/blob/418123d/src/types.ts#L33)

___

### usage

• `Optional` **usage**: `Object`

Optional. Usage statistics for the request.

#### Index signature

▪ [key: `string`]: `number`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `prompt_tokens` | `number` |
| `total_tokens` | `number` |

#### Defined in

[types.ts:53](https://github.com/bartonmalow/vectra/blob/418123d/src/types.ts#L53)
