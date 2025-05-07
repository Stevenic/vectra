import * as fs from "fs/promises";
import * as path from "path";
import { v4 } from "uuid";
import { ItemSelector } from "./ItemSelector";
import { IndexItem, IndexStats, MetadataFilter, MetadataTypes, QueryResult } from "./types";
import bm25 from "wink-bm25-text-search";
import winkNLP from "wink-nlp";
import model from "wink-eng-lite-web-model";

// Define BM25 types
interface BM25Document {
    text: string;
    id: number;
}

interface BM25Result {
    docId: number;
    score: number;
}

interface BM25Instance {
    addDoc(doc: BM25Document): void;
    search(query: string): BM25Result[];
    consolidate(): void;
    config(options: { fld: string }): void;
    defineConfig(options: { fld: string }): void;
    definePrepTasks(tasks: ((text: string) => string | string[])[]): void;
}

/**
 * Configuration for creating a new index.
 * @public
 */
export interface CreateIndexConfig {
    version: number;
    deleteIfExists?: boolean;
    metadata_config?: {
        indexed?: string[];
    };
}

/**
 * Local vector index instance.
 * @remarks
 * This class is used to create, update, and query a local vector index.
 * Each index is a folder on disk containing an index.json file and an optional set of metadata files.
 * @public
 */
export class LocalIndex<TMetadata extends Record<string,MetadataTypes> = Record<string,MetadataTypes>>{
    private readonly _folderPath: string;
    private readonly _indexName: string;

    private _data?: IndexData;
    private _update?: IndexData;
    private _bm25Engine?: BM25Instance;

    /**
     * Creates a new instance of LocalIndex.
     * @param folderPath - Path to the index folder.
     * @param indexName - Optional name of the index file. Defaults to index.json.
     */
    public constructor(folderPath: string, indexName?: string) {
        this._folderPath = folderPath;
        this._indexName = indexName || "index.json";
    }

    /**
     * Path to the index folder.
     */
    public get folderPath(): string {
        return this._folderPath;
    }

    /**
     * Optional name of the index file. 
     */
    public get indexName(): string {
        return this._indexName;
    }

    /**
     * Begins an update to the index.
     * @remarks
     * This method loads the index into memory and prepares it for updates.
     */
    public async beginUpdate(): Promise<void> {
        if (this._update) {
            throw new Error("Update already in progress");
        }

        await this.loadIndexData();
        this._update = Object.assign({}, this._data);
    }

    /**
     * Cancels an update to the index.
     * @remarks
     * This method discards any changes made to the index since the update began.
     */
    public cancelUpdate(): void {
        this._update = undefined;
    }

    /**
     * Creates a new index.
     * @remarks
     * This method creates a new folder on disk containing an index.json file.
     * @param config - Index configuration.
     */
    public async createIndex(config: CreateIndexConfig = {version: 1}): Promise<void> {
        // Delete if exists
        if (await this.isIndexCreated()) {
            if (config.deleteIfExists) {
                await this.deleteIndex();
            } else {
                throw new Error("Index already exists");
            }
        }

        try {
            // Create folder for index
            await fs.mkdir(this._folderPath, { recursive: true });

            // Initialize index.json file
            this._data = {
                version: config.version,
                metadata_config: config.metadata_config ?? {},
                items: []
            };

            await fs.writeFile(path.join(this._folderPath, this._indexName), JSON.stringify(this._data));
        } catch {
            await this.deleteIndex();
            throw new Error("Error creating index");
        }
    }

    /**
     * Deletes the index.
     * @remarks
     * This method deletes the index folder from disk.
     */
    public deleteIndex(): Promise<void> {
        this._data = undefined;
        return fs.rm(this._folderPath, {
            recursive: true,
            maxRetries: 3
        });
    }

    /**
     * Deletes an item from the index.
     * @param id - ID of item to delete.
     */
    public async deleteItem(id: string): Promise<void> {
        if (this._update) {
            const index = this._update.items.findIndex(i => i.id === id);
            if (index >= 0) {
                this._update.items.splice(index, 1);
            }
        } else {
            await this.beginUpdate();
            const index = this._update!.items.findIndex(i => i.id === id);
            if (index >= 0) {
                this._update!.items.splice(index, 1);
            }
            await this.endUpdate();
        }
    }

    /**
     * Ends an update to the index.
     * @remarks
     * This method saves the index to disk.
     */
    public async endUpdate(): Promise<void> {
        if (!this._update) {
            throw new Error("No update in progress");
        }

        try {
            // Save index
            await fs.writeFile(path.join(this._folderPath, this._indexName), JSON.stringify(this._update));
            this._data = this._update;
            this._update = undefined;
        } catch {
            throw new Error("Error saving index");
        }
    }

    /**
     * Loads an index from disk and returns its stats.
     * @returns Index stats.
     */
    public async getIndexStats(): Promise<IndexStats> {
        await this.loadIndexData();
        return {
            version: this._data!.version,
            metadata_config: this._data!.metadata_config,
            items: this._data!.items.length
        };
    }

    /**
     * Returns an item from the index given its ID.
     * @param id - ID of the item to retrieve.
     * @returns Item or undefined if not found.
     */
    public async getItem<TItemMetadata extends TMetadata = TMetadata>(id: string): Promise<IndexItem<TItemMetadata> | undefined> {
        await this.loadIndexData();
        const item = this._data!.items.find(i => i.id === id);
        return item ? { ...item, metadata: item.metadata as TItemMetadata } : undefined;
    }

    /**
     * Adds an item to the index.
     * @remarks
     * A new update is started if one is not already in progress. If an item with the same ID
     * already exists, an error will be thrown.
     * @param item - Item to insert.
     * @returns Inserted item.
     */
    public async insertItem<TItemMetadata extends TMetadata = TMetadata>(item: Partial<IndexItem<TItemMetadata>>): Promise<IndexItem<TItemMetadata>> {
        if (this._update) {
            const newItem = await this.addItemToUpdate(item, true);
            return { ...newItem, metadata: newItem.metadata as TItemMetadata };
        } else {
            await this.beginUpdate();
            const newItem = await this.addItemToUpdate(item, true);
            await this.endUpdate();
            return { ...newItem, metadata: newItem.metadata as TItemMetadata };
        }
    }

    /**
     * Returns true if the index exists.
     */
    public async isIndexCreated(): Promise<boolean> {
        try {
            await fs.access(path.join(this._folderPath, this.indexName));
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Returns all items in the index.
     * @remarks
     * This method loads the index into memory and returns all its items. A copy of the items
     * array is returned so no modifications should be made to the array.
     * @returns Array of all items in the index.
     */
    public async listItems<TItemMetadata extends TMetadata = TMetadata>(): Promise<IndexItem<TItemMetadata>[]> {
        await this.loadIndexData();
        return this._data!.items.map(item => ({ ...item, metadata: item.metadata as TItemMetadata }));
    }

    /**
     * Returns all items in the index matching the filter.
     * @remarks
     * This method loads the index into memory and returns all its items matching the filter.
     * @param filter - Filter to apply.
     * @returns Array of items matching the filter.
     */
    public async listItemsByMetadata<TItemMetadata extends TMetadata = TMetadata>(filter: MetadataFilter): Promise<IndexItem<TItemMetadata>[]> {
        await this.loadIndexData();
        return this._data!.items
            .filter(i => ItemSelector.select(i.metadata, filter))
            .map(item => ({ ...item, metadata: item.metadata as TItemMetadata }));
    }

    /**
     * Finds the top k items in the index that are most similar to the vector.
     * @remarks
     * This method loads the index into memory and returns the top k items that are most similar.
     * An optional filter can be applied to the metadata of the items.
     * @param vector - Vector to query against.
     * @param query - Query text for BM25 search.
     * @param topK - Number of items to return.
     * @param filter - Optional. Filter to apply.
     * @param isBm25 - Optional. Whether to use BM25 search.
     * @returns Similar items to the vector that match the supplied filter.
     */
    public async queryItems<TItemMetadata extends TMetadata = TMetadata>(
        vector: number[],
        query: string,
        topK: number,
        filter?: MetadataFilter,
        isBm25?: boolean
    ): Promise<QueryResult<TItemMetadata>[]> {
        await this.loadIndexData();

        // Filter items by metadata
        const items = filter
            ? this._data!.items.filter(i => ItemSelector.select(i.metadata, filter))
            : this._data!.items;

        // If BM25 is enabled, perform hybrid search
        if (isBm25) {
            const bm25Results = await this.bm25Search(query, items as IndexItem<TMetadata>[], topK);
            return bm25Results.map(result => ({
                item: { ...result.item, metadata: result.item.metadata as TItemMetadata },
                score: result.score
            }));
        }

        // Calculate similarity scores
        const results = items.map(item => ({
            item: { ...item, metadata: item.metadata as TItemMetadata },
            score: ItemSelector.cosineSimilarity(vector, item.vector)
        }));

        // Sort by score and return top results
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
    }

    /**
     * Adds or replaces an item in the index.
     * @remarks
     * A new update is started if one is not already in progress. If an item with the same ID
     * already exists, it will be replaced.
     * @param item - Item to insert or replace.
     * @returns Upserted item.
     */
    public async upsertItem<TItemMetadata extends TMetadata = TMetadata>(item: Partial<IndexItem<TItemMetadata>>): Promise<IndexItem<TItemMetadata>> {
        if (this._update) {
            return await this.addItemToUpdate(item, false) as IndexItem<TItemMetadata>;
        } else {
            await this.beginUpdate();
            const newItem = await this.addItemToUpdate(item, false);
            await this.endUpdate();
            return newItem as IndexItem<TItemMetadata>;
        }
    }

    /**
     * Ensures that the index has been loaded into memory.
     */
    protected async loadIndexData(): Promise<void> {
        if (!this._data) {
            try {
                const json = await fs.readFile(path.join(this._folderPath, this._indexName), "utf-8");
                this._data = JSON.parse(json) as IndexData;
            } catch {
                throw new Error("Error loading index data");
            }
        }
    }

    private async addItemToUpdate(item: Partial<IndexItem<TMetadata>>, unique: boolean): Promise<IndexItem<TMetadata>> {
        // Ensure update in progress
        if (!this._update) {
            throw new Error("No update in progress");
        }

        // Generate ID if not provided
        const id = item.id || v4();
        if (unique && this._update.items.some(i => i.id === id)) {
            throw new Error("Item with same ID already exists");
        }

        // Create new item
        const newItem: IndexItem<TMetadata> = {
            id,
            metadata: item.metadata || {} as TMetadata,
            vector: item.vector || [],
            norm: item.norm || 0
        };

        // Add item to index
        this._update.items.push(newItem);
        return newItem;
    }

    private async setupbm25(): Promise<BM25Instance> {
        const nlp = winkNLP(model);
        const its = nlp.its;
        const as = nlp.as;
        const bm25Instance = bm25() as BM25Instance;
        // Define the configuration for BM25, specifying the field to index (in this case, "text").
        bm25Instance.defineConfig({ fld: "text" });

        // Define preprocessing tasks for BM25:
        // 1. Convert the text to lowercase for case-insensitive matching.
        // 2. Tokenize the text using Wink NLP and extract normalized tokens as an array.
        bm25Instance.definePrepTasks([
            (text: string) => String(text).toLowerCase(),
            (text: string) => nlp.readDoc(text).tokens().out(its.normal, as.array)
        ]);
        return bm25Instance;
    }

    private async bm25Search(searchQuery: string, items: IndexItem<TMetadata>[], topK: number): Promise<QueryResult<TMetadata>[]> {
        if (!this._bm25Engine) {
            this._bm25Engine = await this.setupbm25();
            items.forEach((item, idx) => {
                const text = typeof item.metadata.text === "string" ? item.metadata.text : "";
                this._bm25Engine!.addDoc({ text, id: idx });
            });
            this._bm25Engine.consolidate();
        }
        const results = this._bm25Engine.search(searchQuery).slice(0, topK);
        return results.map(result => ({
            item: items[result.docId],
            score: result.score
        }));
    }

}

interface IndexData {
    version: number;
    metadata_config: {
        indexed?: string[];
    };
    items: IndexItem[];
}
