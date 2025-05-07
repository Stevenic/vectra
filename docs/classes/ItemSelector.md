[Vectra](../README.md) / [Exports](../modules.md) / ItemSelector

# Class: ItemSelector

Utility class for selecting and comparing items.

## Table of contents

### Constructors

- [constructor](ItemSelector.md#constructor)

### Methods

- [cosineSimilarity](ItemSelector.md#cosinesimilarity)
- [normalize](ItemSelector.md#normalize)
- [normalizedCosineSimilarity](ItemSelector.md#normalizedcosinesimilarity)
- [select](ItemSelector.md#select)

## Constructors

### constructor

• **new ItemSelector**()

## Methods

### cosineSimilarity

▸ `Static` **cosineSimilarity**(`vector1`, `vector2`): `number`

Returns the similarity between two vectors using the cosine similarity.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `vector1` | `number`[] | Vector 1 |
| `vector2` | `number`[] | Vector 2 |

#### Returns

`number`

Similarity between the two vectors

#### Defined in

[ItemSelector.ts:15](https://github.com/bartonmalow/vectra/blob/418123d/src/ItemSelector.ts#L15)

___

### normalize

▸ `Static` **normalize**(`vector`): `number`

Normalizes a vector.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `vector` | `number`[] | Vector to normalize |

#### Returns

`number`

Normalized vector

**`Remarks`**

The norm of a vector is the square root of the sum of the squares of the elements.
The LocalIndex pre-normalizes all vectors to improve performance.

#### Defined in

[ItemSelector.ts:29](https://github.com/bartonmalow/vectra/blob/418123d/src/ItemSelector.ts#L29)

___

### normalizedCosineSimilarity

▸ `Static` **normalizedCosineSimilarity**(`vector1`, `vector2`, `norm1`, `norm2`): `number`

Returns the similarity between two vectors using cosine similarity.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `vector1` | `number`[] | Vector 1 |
| `vector2` | `number`[] | Vector 2 |
| `norm1` | `number` | Norm of vector 1 |
| `norm2` | `number` | Norm of vector 2 |

#### Returns

`number`

Similarity between the two vectors

#### Defined in

[ItemSelector.ts:50](https://github.com/bartonmalow/vectra/blob/418123d/src/ItemSelector.ts#L50)

___

### select

▸ `Static` **select**(`metadata`, `filter`): `boolean`

Returns true if the metadata matches the filter.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `metadata` | `Record`\<`string`, [`MetadataTypes`](../modules.md#metadatatypes)\> | Metadata to check |
| `filter` | [`MetadataFilter`](../interfaces/MetadataFilter.md) | Filter to apply |

#### Returns

`boolean`

True if the metadata matches the filter

#### Defined in

[ItemSelector.ts:62](https://github.com/bartonmalow/vectra/blob/418123d/src/ItemSelector.ts#L62)
