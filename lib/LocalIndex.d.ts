export interface LocalIndexConfig {
    folderPath: string;
}
export interface CreateIndexConfig {
    version: number;
    deleteIfExists?: boolean;
    metadata_config?: {
        indexed?: string[];
    };
}
export interface IndexStats {
    version: number;
    metadata_config: {
        indexed?: string[];
    };
    items: number;
}
export interface IndexItem {
    id: string;
    metadata: Record<string, MetadataTypes>;
    vector: number[];
    norm: number;
    metadataFile?: string;
}
export interface MetadataFilter {
    [key: string]: MetadataTypes | MetadataFilter | (number | string)[] | MetadataFilter[];
    /**
     * Equal to (number, string, boolean)
     */
    '$eq': number | string | boolean;
    /**
     * Not equal to (number, string, boolean)
     */
    '$ne': number | string | boolean;
    /**
     * Greater than (number)
     */
    '$gt': number;
    /**
     * Greater than or equal to (number)
     */
    '$gte': number;
    /**
     * Less than (number)
     */
    '$lt': number;
    /**
     * Less than or equal to (number)
     */
    '$lte': number;
    /**
     * In array (string or number)
     */
    '$in': (number | string)[];
    /**
     * Not in array (string or number)
     */
    '$nin': (number | string)[];
    /**
     * AND (MetadataFilter[])
     */
    '$and': MetadataFilter[];
    /**
     * OR (MetadataFilter[])
     */
    '$or': MetadataFilter[];
}
export declare type MetadataTypes = number | string | boolean;
/**
 * Local vector index instance.
 * @remarks
 * This class is used to create, update, and query a local vector index.
 * Each index is a folder on disk containing an index.json file and an optional set of metadata files.
 */
export declare class LocalIndex {
    private readonly _config;
    private _data?;
    private _update?;
    /**
     * Creates a new instance of LocalIndex.
     * @param config - Index configuration
     */
    constructor(config: LocalIndexConfig);
    /**
     * Begins an update to the index.
     * @remarks
     * This method loads the index into memory and prepares it for updates.
     */
    beginUpdate(): Promise<void>;
    /**
     * Cancels an update to the index.
     * @remarks
     * This method discards any changes made to the index since the update began.
     */
    cancelUpdate(): void;
    /**
     * Creates a new index.
     * @remarks
     * This method creates a new folder on disk containing an index.json file.
     * @param config - Index configuration
     */
    createIndex(config: CreateIndexConfig): Promise<void>;
    /**
     * Deletes the index.
     * @remarks
     * This method deletes the index folder from disk.
     */
    deleteIndex(): Promise<void>;
    /**
     * Deletes an item from the index.
     * @param id - Item id
     */
    deleteItem(id: string): Promise<void>;
    /**
     * Ends an update to the index.
     * @remarks
     * This method saves the index to disk.
     */
    endUpdate(): Promise<void>;
    /**
     * Loads an index from disk and returns its stats.
     * @returns Index stats
     */
    getIndexStats(): Promise<IndexStats>;
    /**
     * Returns an item from the index given its ID.
     * @param id Item id
     * @returns Item or undefined if not found
     */
    getItem(id: string): Promise<IndexItem | undefined>;
    /**
     * Adds an item to the index.
     * @remarks
     * A new update is started if one is not already in progress. If an item with the same ID
     * already exists, an error will be thrown.
     * @param item Item to insert
     * @returns Inserted item
     */
    insertItem(item: Partial<IndexItem>): Promise<IndexItem>;
    /**
     * Returns true if the index exists.
     */
    isIndexCreated(): Promise<boolean>;
    /**
     * Returns all items in the index.
     * @remarks
     * This method loads the index into memory and returns all its items. A copy of the items
     * array is returned so no modifications should be made to the array.
     * @returns All items in the index
     */
    listItems(): Promise<IndexItem[]>;
    /**
     * Returns all items in the index matching the filter.
     * @remarks
     * This method loads the index into memory and returns all its items matching the filter.
     * @param filter Filter to apply
     * @returns Items matching the filter
     */
    listItemsByMetadata(filter: MetadataFilter): Promise<IndexItem[]>;
    /**
     * Finds the top k items in the index that are most similar to the vector.
     * @remarks
     * This method loads the index into memory and returns the top k items that are most similar.
     * An optional filter can be applied to the metadata of the items.
     * @param vector Vector to query against
     * @param topK Number of items to return
     * @param filter Optional filter to apply
     * @returns Similar items to the vector that match the filter
     */
    queryItems(vector: number[], topK: number, filter?: MetadataFilter): Promise<IndexItem[]>;
    /**
     * Adds or replaces an item in the index.
     * @remarks
     * A new update is started if one is not already in progress. If an item with the same ID
     * already exists, it will be replaced.
     * @param item Item to insert or replace
     * @returns Upserted item
     */
    upsertItem(item: Partial<IndexItem>): Promise<IndexItem>;
    private loadIndexData;
    private addItemToUpdate;
}
//# sourceMappingURL=LocalIndex.d.ts.map