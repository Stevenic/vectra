[Vectra](../README.md) / [Exports](../modules.md) / BaseOpenAIEmbeddingsOptions

# Interface: BaseOpenAIEmbeddingsOptions

Base options for OpenAI embeddings.

## Hierarchy

- **`BaseOpenAIEmbeddingsOptions`**

  ↳ [`OSSEmbeddingsOptions`](OSSEmbeddingsOptions.md)

  ↳ [`OpenAIEmbeddingsOptions`](OpenAIEmbeddingsOptions.md)

  ↳ [`AzureOpenAIEmbeddingsOptions`](AzureOpenAIEmbeddingsOptions.md)

## Table of contents

### Properties

- [dimensions](BaseOpenAIEmbeddingsOptions.md#dimensions)
- [logRequests](BaseOpenAIEmbeddingsOptions.md#logrequests)
- [maxTokens](BaseOpenAIEmbeddingsOptions.md#maxtokens)
- [requestConfig](BaseOpenAIEmbeddingsOptions.md#requestconfig)
- [retryPolicy](BaseOpenAIEmbeddingsOptions.md#retrypolicy)

## Properties

### dimensions

• `Optional` **dimensions**: `number`

Optional. Number of embedding dimensions to return.

#### Defined in

[OpenAIEmbeddings.ts:15](https://github.com/bartonmalow/vectra/blob/418123d/src/OpenAIEmbeddings.ts#L15)

___

### logRequests

• `Optional` **logRequests**: `boolean`

Optional. Whether to log requests to the console.

**`Remarks`**

This is useful for debugging prompts and defaults to `false`.

#### Defined in

[OpenAIEmbeddings.ts:22](https://github.com/bartonmalow/vectra/blob/418123d/src/OpenAIEmbeddings.ts#L22)

___

### maxTokens

• `Optional` **maxTokens**: `number`

Optional. Maximum number of tokens that can be sent to the embedding model.

#### Defined in

[OpenAIEmbeddings.ts:27](https://github.com/bartonmalow/vectra/blob/418123d/src/OpenAIEmbeddings.ts#L27)

___

### requestConfig

• `Optional` **requestConfig**: `AxiosRequestConfig`\<`any`\>

Optional. Request options to use when calling the OpenAI API.

#### Defined in

[OpenAIEmbeddings.ts:40](https://github.com/bartonmalow/vectra/blob/418123d/src/OpenAIEmbeddings.ts#L40)

___

### retryPolicy

• `Optional` **retryPolicy**: `number`[]

Optional. Retry policy to use when calling the OpenAI API.

**`Remarks`**

The default retry policy is `[2000, 5000]` which means that the first retry will be after
2 seconds and the second retry will be after 5 seconds.

#### Defined in

[OpenAIEmbeddings.ts:35](https://github.com/bartonmalow/vectra/blob/418123d/src/OpenAIEmbeddings.ts#L35)
