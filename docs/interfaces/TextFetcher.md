[Vectra](../README.md) / [Exports](../modules.md) / TextFetcher

# Interface: TextFetcher

Interface for text fetcher.

## Implemented by

- [`FileFetcher`](../classes/FileFetcher.md)
- [`WebFetcher`](../classes/WebFetcher.md)

## Table of contents

### Methods

- [fetch](TextFetcher.md#fetch)

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

#### Defined in

[types.ts:78](https://github.com/bartonmalow/vectra/blob/418123d/src/types.ts#L78)
