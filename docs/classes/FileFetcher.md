[Vectra](../README.md) / [Exports](../modules.md) / FileFetcher

# Class: FileFetcher

Fetches text content from local files.

## Implements

- [`TextFetcher`](../interfaces/TextFetcher.md)

## Table of contents

### Constructors

- [constructor](FileFetcher.md#constructor)

### Methods

- [fetch](FileFetcher.md#fetch)

## Constructors

### constructor

• **new FileFetcher**()

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

[FileFetcher.ts:10](https://github.com/bartonmalow/vectra/blob/418123d/src/FileFetcher.ts#L10)
