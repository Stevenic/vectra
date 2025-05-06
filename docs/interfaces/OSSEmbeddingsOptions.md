[Vectra](../README.md) / [Exports](../modules.md) / OSSEmbeddingsOptions

# Interface: OSSEmbeddingsOptions

Options for OSS embeddings.

## Hierarchy

- [`BaseOpenAIEmbeddingsOptions`](BaseOpenAIEmbeddingsOptions.md)

  ↳ **`OSSEmbeddingsOptions`**

## Table of contents

### Properties

- [dimensions](OSSEmbeddingsOptions.md#dimensions)
- [logRequests](OSSEmbeddingsOptions.md#logrequests)
- [maxTokens](OSSEmbeddingsOptions.md#maxtokens)
- [ossEndpoint](OSSEmbeddingsOptions.md#ossendpoint)
- [ossModel](OSSEmbeddingsOptions.md#ossmodel)
- [requestConfig](OSSEmbeddingsOptions.md#requestconfig)
- [retryPolicy](OSSEmbeddingsOptions.md#retrypolicy)

## Properties

### dimensions

• `Optional` **dimensions**: `number`

Optional. Number of embedding dimensions to return.

#### Inherited from

[BaseOpenAIEmbeddingsOptions](BaseOpenAIEmbeddingsOptions.md).[dimensions](BaseOpenAIEmbeddingsOptions.md#dimensions)

#### Defined in

[OpenAIEmbeddings.ts:15](https://github.com/bartonmalow/vectra/blob/418123d/src/OpenAIEmbeddings.ts#L15)

___

### logRequests

• `Optional` **logRequests**: `boolean`

Optional. Whether to log requests to the console.

**`Remarks`**

This is useful for debugging prompts and defaults to `false`.

#### Inherited from

[BaseOpenAIEmbeddingsOptions](BaseOpenAIEmbeddingsOptions.md).[logRequests](BaseOpenAIEmbeddingsOptions.md#logrequests)

#### Defined in

[OpenAIEmbeddings.ts:22](https://github.com/bartonmalow/vectra/blob/418123d/src/OpenAIEmbeddings.ts#L22)

___

### maxTokens

• `Optional` **maxTokens**: `number`

Optional. Maximum number of tokens that can be sent to the embedding model.

#### Inherited from

[BaseOpenAIEmbeddingsOptions](BaseOpenAIEmbeddingsOptions.md).[maxTokens](BaseOpenAIEmbeddingsOptions.md#maxtokens)

#### Defined in

[OpenAIEmbeddings.ts:27](https://github.com/bartonmalow/vectra/blob/418123d/src/OpenAIEmbeddings.ts#L27)

___

### ossEndpoint

• **ossEndpoint**: `string`

Optional. Endpoint to use when calling the OpenAI API.

**`Remarks`**

For Azure OpenAI this is the deployment endpoint.

#### Defined in

[OpenAIEmbeddings.ts:58](https://github.com/bartonmalow/vectra/blob/418123d/src/OpenAIEmbeddings.ts#L58)

___

### ossModel

• **ossModel**: `string`

Model to use for completion.

#### Defined in

[OpenAIEmbeddings.ts:51](https://github.com/bartonmalow/vectra/blob/418123d/src/OpenAIEmbeddings.ts#L51)

___

### requestConfig

• `Optional` **requestConfig**: `AxiosRequestConfig`\<`any`\>

Optional. Request options to use when calling the OpenAI API.

#### Inherited from

[BaseOpenAIEmbeddingsOptions](BaseOpenAIEmbeddingsOptions.md).[requestConfig](BaseOpenAIEmbeddingsOptions.md#requestconfig)

#### Defined in

[OpenAIEmbeddings.ts:40](https://github.com/bartonmalow/vectra/blob/418123d/src/OpenAIEmbeddings.ts#L40)

___

### retryPolicy

• `Optional` **retryPolicy**: `number`[]

Optional. Retry policy to use when calling the OpenAI API.

**`Remarks`**

The default retry policy is `[2000, 5000]` which means that the first retry will be after
2 seconds and the second retry will be after 5 seconds.

#### Inherited from

[BaseOpenAIEmbeddingsOptions](BaseOpenAIEmbeddingsOptions.md).[retryPolicy](BaseOpenAIEmbeddingsOptions.md#retrypolicy)

#### Defined in

[OpenAIEmbeddings.ts:35](https://github.com/bartonmalow/vectra/blob/418123d/src/OpenAIEmbeddings.ts#L35)
