[Vectra](../README.md) / [Exports](../modules.md) / AzureOpenAIEmbeddingsOptions

# Interface: AzureOpenAIEmbeddingsOptions

Options for Azure OpenAI embeddings.

## Hierarchy

- [`BaseOpenAIEmbeddingsOptions`](BaseOpenAIEmbeddingsOptions.md)

  ↳ **`AzureOpenAIEmbeddingsOptions`**

## Table of contents

### Properties

- [azureApiKey](AzureOpenAIEmbeddingsOptions.md#azureapikey)
- [azureApiVersion](AzureOpenAIEmbeddingsOptions.md#azureapiversion)
- [azureDeployment](AzureOpenAIEmbeddingsOptions.md#azuredeployment)
- [azureEndpoint](AzureOpenAIEmbeddingsOptions.md#azureendpoint)
- [dimensions](AzureOpenAIEmbeddingsOptions.md#dimensions)
- [logRequests](AzureOpenAIEmbeddingsOptions.md#logrequests)
- [maxTokens](AzureOpenAIEmbeddingsOptions.md#maxtokens)
- [requestConfig](AzureOpenAIEmbeddingsOptions.md#requestconfig)
- [retryPolicy](AzureOpenAIEmbeddingsOptions.md#retrypolicy)

## Properties

### azureApiKey

• **azureApiKey**: `string`

API key to use when making requests to Azure OpenAI.

#### Defined in

[OpenAIEmbeddings.ts:99](https://github.com/bartonmalow/vectra/blob/418123d/src/OpenAIEmbeddings.ts#L99)

___

### azureApiVersion

• `Optional` **azureApiVersion**: `string`

Optional. Version of the API being called. Defaults to `2023-05-15`.

#### Defined in

[OpenAIEmbeddings.ts:114](https://github.com/bartonmalow/vectra/blob/418123d/src/OpenAIEmbeddings.ts#L114)

___

### azureDeployment

• **azureDeployment**: `string`

Name of the Azure OpenAI deployment (model) to use.

#### Defined in

[OpenAIEmbeddings.ts:109](https://github.com/bartonmalow/vectra/blob/418123d/src/OpenAIEmbeddings.ts#L109)

___

### azureEndpoint

• **azureEndpoint**: `string`

Deployment endpoint to use.

#### Defined in

[OpenAIEmbeddings.ts:104](https://github.com/bartonmalow/vectra/blob/418123d/src/OpenAIEmbeddings.ts#L104)

___

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
