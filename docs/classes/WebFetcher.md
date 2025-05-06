[Vectra](../README.md) / [Exports](../modules.md) / WebFetcher

# Class: WebFetcher

Fetches text content from web pages.

## Implements

- [`TextFetcher`](../interfaces/TextFetcher.md)

## Table of contents

### Constructors

- [constructor](WebFetcher.md#constructor)

### Methods

- [fetch](WebFetcher.md#fetch)

## Constructors

### constructor

• **new WebFetcher**(`config?`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `config?` | `Partial`\<[`WebFetcherConfig`](../interfaces/WebFetcherConfig.md)\> |

#### Defined in

[WebFetcher.ts:49](https://github.com/bartonmalow/vectra/blob/418123d/src/WebFetcher.ts#L49)

## Methods

### fetch

▸ **fetch**(`uri`, `onDocument`): `Promise`\<`boolean`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `uri` | `string` |
| `onDocument` | (`uri`: `string`, `text`: `string`, `docType?`: `string`) => `Promise`\<`boolean`\> |

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[TextFetcher](../interfaces/TextFetcher.md).[fetch](../interfaces/TextFetcher.md#fetch)

#### Defined in

[WebFetcher.ts:56](https://github.com/bartonmalow/vectra/blob/418123d/src/WebFetcher.ts#L56)
