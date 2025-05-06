[Vectra](../README.md) / [Exports](../modules.md) / GPT3Tokenizer

# Class: GPT3Tokenizer

Tokenizer that uses the GPT-3 tokenizer.

## Implements

- [`Tokenizer`](../interfaces/Tokenizer.md)

## Table of contents

### Constructors

- [constructor](GPT3Tokenizer.md#constructor)

### Methods

- [decode](GPT3Tokenizer.md#decode)
- [encode](GPT3Tokenizer.md#encode)

## Constructors

### constructor

• **new GPT3Tokenizer**()

## Methods

### decode

▸ **decode**(`tokens`): `string`

#### Parameters

| Name | Type |
| :------ | :------ |
| `tokens` | `number`[] |

#### Returns

`string`

#### Implementation of

[Tokenizer](../interfaces/Tokenizer.md).[decode](../interfaces/Tokenizer.md#decode)

#### Defined in

[GPT3Tokenizer.ts:9](https://github.com/bartonmalow/vectra/blob/418123d/src/GPT3Tokenizer.ts#L9)

___

### encode

▸ **encode**(`text`): `number`[]

#### Parameters

| Name | Type |
| :------ | :------ |
| `text` | `string` |

#### Returns

`number`[]

#### Implementation of

[Tokenizer](../interfaces/Tokenizer.md).[encode](../interfaces/Tokenizer.md#encode)

#### Defined in

[GPT3Tokenizer.ts:13](https://github.com/bartonmalow/vectra/blob/418123d/src/GPT3Tokenizer.ts#L13)
