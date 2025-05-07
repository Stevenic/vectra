[Vectra](../README.md) / [Exports](../modules.md) / OpenAIEmbeddings

# Class: OpenAIEmbeddings

Embeddings model that uses OpenAI's API.

## Implements

- [`EmbeddingsModel`](../interfaces/EmbeddingsModel.md)

## Table of contents

### Constructors

- [constructor](OpenAIEmbeddings.md#constructor)

### Accessors

- [maxTokens](OpenAIEmbeddings.md#maxtokens)

### Methods

- [createEmbeddingRequest](OpenAIEmbeddings.md#createembeddingrequest)
- [createEmbeddings](OpenAIEmbeddings.md#createembeddings)
- [post](OpenAIEmbeddings.md#post)

## Constructors

### constructor

• **new OpenAIEmbeddings**(`options`)

Creates a new instance of OpenAIEmbeddings.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `options` | [`OSSEmbeddingsOptions`](../interfaces/OSSEmbeddingsOptions.md) \| [`OpenAIEmbeddingsOptions`](../interfaces/OpenAIEmbeddingsOptions.md) \| [`AzureOpenAIEmbeddingsOptions`](../interfaces/AzureOpenAIEmbeddingsOptions.md) | Configuration options for the embeddings model. |

#### Defined in

[OpenAIEmbeddings.ts:131](https://github.com/bartonmalow/vectra/blob/418123d/src/OpenAIEmbeddings.ts#L131)

## Accessors

### maxTokens

• `get` **maxTokens**(): `number`

Gets the maximum number of tokens.

#### Returns

`number`

#### Implementation of

[EmbeddingsModel](../interfaces/EmbeddingsModel.md).[maxTokens](../interfaces/EmbeddingsModel.md#maxtokens)

#### Defined in

[OpenAIEmbeddings.ts:145](https://github.com/bartonmalow/vectra/blob/418123d/src/OpenAIEmbeddings.ts#L145)

## Methods

### createEmbeddingRequest

▸ `Protected` **createEmbeddingRequest**(`request`): `Promise`\<`AxiosResponse`\<[`CreateEmbeddingResponse`](../interfaces/CreateEmbeddingResponse.md), `any`\>\>

Creates an embedding request.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `request` | [`CreateEmbeddingRequest`](../interfaces/CreateEmbeddingRequest.md) | The request to create. |

#### Returns

`Promise`\<`AxiosResponse`\<[`CreateEmbeddingResponse`](../interfaces/CreateEmbeddingResponse.md), `any`\>\>

The response from the API.

#### Defined in

[OpenAIEmbeddings.ts:208](https://github.com/bartonmalow/vectra/blob/418123d/src/OpenAIEmbeddings.ts#L208)

___

### createEmbeddings

▸ **createEmbeddings**(`inputs`): `Promise`\<[`EmbeddingsResponse`](../interfaces/EmbeddingsResponse.md)\>

Creates embeddings for the given inputs.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `inputs` | `string` \| `string`[] | Text inputs to create embeddings for. |

#### Returns

`Promise`\<[`EmbeddingsResponse`](../interfaces/EmbeddingsResponse.md)\>

A `EmbeddingsResponse` with a status and the generated embeddings or a message when an error occurs.

#### Implementation of

[EmbeddingsModel](../interfaces/EmbeddingsModel.md).[createEmbeddings](../interfaces/EmbeddingsModel.md#createembeddings)

#### Defined in

[OpenAIEmbeddings.ts:154](https://github.com/bartonmalow/vectra/blob/418123d/src/OpenAIEmbeddings.ts#L154)

___

### post

▸ `Protected` **post**\<`TData`\>(`url`, `body`, `retryCount?`): `Promise`\<`AxiosResponse`\<`TData`, `any`\>\>

Posts a request to the API.

#### Type parameters

| Name |
| :------ |
| `TData` |

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `url` | `string` | `undefined` | The URL to post to. |
| `body` | `object` | `undefined` | The body of the request. |
| `retryCount` | `number` | `0` | The number of retries. |

#### Returns

`Promise`\<`AxiosResponse`\<`TData`, `any`\>\>

The response from the API.

#### Defined in

[OpenAIEmbeddings.ts:237](https://github.com/bartonmalow/vectra/blob/418123d/src/OpenAIEmbeddings.ts#L237)
