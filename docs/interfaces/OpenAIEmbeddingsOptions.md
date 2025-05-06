[Vectra](../README.md) / [Exports](../modules.md) / OpenAIEmbeddingsOptions

# Interface: OpenAIEmbeddingsOptions

Options for OpenAI embeddings.

## Hierarchy

- [`BaseOpenAIEmbeddingsOptions`](BaseOpenAIEmbeddingsOptions.md)

  ↳ **`OpenAIEmbeddingsOptions`**

## Table of contents

### Properties

- [apiKey](OpenAIEmbeddingsOptions.md#apikey)
- [dimensions](OpenAIEmbeddingsOptions.md#dimensions)
- [endpoint](OpenAIEmbeddingsOptions.md#endpoint)
- [logRequests](OpenAIEmbeddingsOptions.md#logrequests)
- [maxTokens](OpenAIEmbeddingsOptions.md#maxtokens)
- [model](OpenAIEmbeddingsOptions.md#model)
- [organization](OpenAIEmbeddingsOptions.md#organization)
- [requestConfig](OpenAIEmbeddingsOptions.md#requestconfig)
- [retryPolicy](OpenAIEmbeddingsOptions.md#retrypolicy)

## Properties

### apiKey

• **apiKey**: `string`

API key to use when calling the OpenAI API.

**`Remarks`**

A new API key can be created at https://platform.openai.com/account/api-keys.

#### Defined in

[OpenAIEmbeddings.ts:71](https://github.com/bartonmalow/vectra/blob/418123d/src/OpenAIEmbeddings.ts#L71)

___

### dimensions

• `Optional` **dimensions**: `number`

Optional. Number of embedding dimensions to return.

#### Inherited from

[BaseOpenAIEmbeddingsOptions](BaseOpenAIEmbeddingsOptions.md).[dimensions](BaseOpenAIEmbeddingsOptions.md#dimensions)

#### Defined in

[OpenAIEmbeddings.ts:15](https://github.com/bartonmalow/vectra/blob/418123d/src/OpenAIEmbeddings.ts#L15)

___

### endpoint

• `Optional` **endpoint**: `string`

Optional. Endpoint to use when calling the OpenAI API.

#### Defined in

[OpenAIEmbeddings.ts:88](https://github.com/bartonmalow/vectra/blob/418123d/src/OpenAIEmbeddings.ts#L88)

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

### model

• **model**: `string`

Model to use for completion.

**`Remarks`**

For Azure OpenAI this is the name of the deployment to use.

#### Defined in

[OpenAIEmbeddings.ts:78](https://github.com/bartonmalow/vectra/blob/418123d/src/OpenAIEmbeddings.ts#L78)

___

### organization

• `Optional` **organization**: `string`

Optional. Organization to use when calling the OpenAI API.

#### Defined in

[OpenAIEmbeddings.ts:83](https://github.com/bartonmalow/vectra/blob/418123d/src/OpenAIEmbeddings.ts#L83)

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
