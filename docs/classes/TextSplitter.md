[Vectra](../README.md) / [Exports](../modules.md) / TextSplitter

# Class: TextSplitter

Splits text into chunks.

## Table of contents

### Constructors

- [constructor](TextSplitter.md#constructor)

### Methods

- [split](TextSplitter.md#split)

## Constructors

### constructor

• **new TextSplitter**(`config?`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `config?` | `Partial`\<[`TextSplitterConfig`](../interfaces/TextSplitterConfig.md)\> |

#### Defined in

[TextSplitter.ts:26](https://github.com/bartonmalow/vectra/blob/418123d/src/TextSplitter.ts#L26)

## Methods

### split

▸ **split**(`text`): [`TextChunk`](../interfaces/TextChunk.md)[]

#### Parameters

| Name | Type |
| :------ | :------ |
| `text` | `string` |

#### Returns

[`TextChunk`](../interfaces/TextChunk.md)[]

#### Defined in

[TextSplitter.ts:53](https://github.com/bartonmalow/vectra/blob/418123d/src/TextSplitter.ts#L53)
