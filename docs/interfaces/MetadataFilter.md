[Vectra](../README.md) / [Exports](../modules.md) / MetadataFilter

# Interface: MetadataFilter

Filter for metadata.

## Indexable

▪ [key: `string`]: `unknown`

## Table of contents

### Properties

- [$and](MetadataFilter.md#$and)
- [$eq](MetadataFilter.md#$eq)
- [$gt](MetadataFilter.md#$gt)
- [$gte](MetadataFilter.md#$gte)
- [$in](MetadataFilter.md#$in)
- [$lt](MetadataFilter.md#$lt)
- [$lte](MetadataFilter.md#$lte)
- [$ne](MetadataFilter.md#$ne)
- [$nin](MetadataFilter.md#$nin)
- [$or](MetadataFilter.md#$or)

## Properties

### $and

• `Optional` **$and**: [`MetadataFilter`](MetadataFilter.md)[]

AND (MetadataFilter[])

#### Defined in

[types.ts:154](https://github.com/bartonmalow/vectra/blob/418123d/src/types.ts#L154)

___

### $eq

• `Optional` **$eq**: `string` \| `number` \| `boolean`

Equal to (number, string, boolean)

#### Defined in

[types.ts:114](https://github.com/bartonmalow/vectra/blob/418123d/src/types.ts#L114)

___

### $gt

• `Optional` **$gt**: `number`

Greater than (number)

#### Defined in

[types.ts:124](https://github.com/bartonmalow/vectra/blob/418123d/src/types.ts#L124)

___

### $gte

• `Optional` **$gte**: `number`

Greater than or equal to (number)

#### Defined in

[types.ts:129](https://github.com/bartonmalow/vectra/blob/418123d/src/types.ts#L129)

___

### $in

• `Optional` **$in**: (`string` \| `number`)[]

In array (string or number)

#### Defined in

[types.ts:144](https://github.com/bartonmalow/vectra/blob/418123d/src/types.ts#L144)

___

### $lt

• `Optional` **$lt**: `number`

Less than (number)

#### Defined in

[types.ts:134](https://github.com/bartonmalow/vectra/blob/418123d/src/types.ts#L134)

___

### $lte

• `Optional` **$lte**: `number`

Less than or equal to (number)

#### Defined in

[types.ts:139](https://github.com/bartonmalow/vectra/blob/418123d/src/types.ts#L139)

___

### $ne

• `Optional` **$ne**: `string` \| `number` \| `boolean`

Not equal to (number, string, boolean)

#### Defined in

[types.ts:119](https://github.com/bartonmalow/vectra/blob/418123d/src/types.ts#L119)

___

### $nin

• `Optional` **$nin**: (`string` \| `number`)[]

Not in array (string or number)

#### Defined in

[types.ts:149](https://github.com/bartonmalow/vectra/blob/418123d/src/types.ts#L149)

___

### $or

• `Optional` **$or**: [`MetadataFilter`](MetadataFilter.md)[]

OR (MetadataFilter[])

#### Defined in

[types.ts:159](https://github.com/bartonmalow/vectra/blob/418123d/src/types.ts#L159)
