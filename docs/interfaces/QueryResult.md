[Vectra](../README.md) / [Exports](../modules.md) / QueryResult

# Interface: QueryResult\<TMetadata\>

Result of a query.

## Type parameters

| Name | Type |
| :------ | :------ |
| `TMetadata` | `Record`\<`string`, [`MetadataTypes`](../modules.md#metadatatypes)\> |

## Table of contents

### Properties

- [item](QueryResult.md#item)
- [score](QueryResult.md#score)

## Properties

### item

• **item**: [`IndexItem`](IndexItem.md)\<`TMetadata`\>

#### Defined in

[types.ts:175](https://github.com/bartonmalow/vectra/blob/418123d/src/types.ts#L175)

___

### score

• **score**: `number`

#### Defined in

[types.ts:176](https://github.com/bartonmalow/vectra/blob/418123d/src/types.ts#L176)
