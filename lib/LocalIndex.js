"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalIndex = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const uuid_1 = require("uuid");
const ItemSelector_1 = require("./ItemSelector");
/**
 * Local vector index instance.
 * @remarks
 * This class is used to create, update, and query a local vector index.
 * Each index is a folder on disk containing an index.json file and an optional set of metadata files.
 */
class LocalIndex {
    /**
     * Creates a new instance of LocalIndex.
     * @param config - Index configuration
     */
    constructor(config) {
        this._config = Object.assign({}, config);
    }
    /**
     * Begins an update to the index.
     * @remarks
     * This method loads the index into memory and prepares it for updates.
     */
    beginUpdate() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._update) {
                throw new Error('Update already in progress');
            }
            yield this.loadIndexData();
            this._update = Object.assign({}, this._data);
        });
    }
    /**
     * Cancels an update to the index.
     * @remarks
     * This method discards any changes made to the index since the update began.
     */
    cancelUpdate() {
        this._update = undefined;
    }
    /**
     * Creates a new index.
     * @remarks
     * This method creates a new folder on disk containing an index.json file.
     * @param config - Index configuration
     */
    createIndex(config) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            // Delete if exists
            if (yield this.isIndexCreated()) {
                if (config.deleteIfExists) {
                    yield this.deleteIndex();
                }
                else {
                    throw new Error('Index already exists');
                }
            }
            try {
                // Create folder for index
                yield fs.mkdir(this._config.folderPath, { recursive: true });
                // Initialize index.json file
                this._data = {
                    version: config.version,
                    metadata_config: (_a = config.metadata_config) !== null && _a !== void 0 ? _a : {},
                    items: []
                };
                yield fs.writeFile(path.join(this._config.folderPath, 'index.json'), JSON.stringify(this._data));
            }
            catch (err) {
                yield this.deleteIndex();
                throw new Error('Error creating index');
            }
        });
    }
    /**
     * Deletes the index.
     * @remarks
     * This method deletes the index folder from disk.
     */
    deleteIndex() {
        this._data = undefined;
        return fs.rmdir(this._config.folderPath, {
            recursive: true,
            maxRetries: 3
        });
    }
    /**
     * Deletes an item from the index.
     * @param id - Item id
     */
    deleteItem(id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._update) {
                const index = this._update.items.findIndex(i => i.id === id);
                if (index >= 0) {
                    this._update.items.splice(index, 1);
                }
            }
            else {
                yield this.beginUpdate();
                const index = this._update.items.findIndex(i => i.id === id);
                if (index >= 0) {
                    this._update.items.splice(index, 1);
                }
                yield this.endUpdate();
            }
        });
    }
    /**
     * Ends an update to the index.
     * @remarks
     * This method saves the index to disk.
     */
    endUpdate() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this._update) {
                throw new Error('No update in progress');
            }
            try {
                // Save index
                yield fs.writeFile(path.join(this._config.folderPath, 'index.json'), JSON.stringify(this._update));
                this._data = this._update;
                this._update = undefined;
            }
            catch (err) {
                throw new Error(`Error saving index: ${err.toString()}`);
            }
        });
    }
    /**
     * Loads an index from disk and returns its stats.
     * @returns Index stats
     */
    getIndexStats() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.loadIndexData();
            return {
                version: this._data.version,
                metadata_config: this._data.metadata_config,
                items: this._data.items.length
            };
        });
    }
    /**
     * Returns an item from the index given its ID.
     * @param id Item id
     * @returns Item or undefined if not found
     */
    getItem(id) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.loadIndexData();
            return this._data.items.find(i => i.id === id);
        });
    }
    /**
     * Adds an item to the index.
     * @remarks
     * A new update is started if one is not already in progress. If an item with the same ID
     * already exists, an error will be thrown.
     * @param item Item to insert
     * @returns Inserted item
     */
    insertItem(item) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._update) {
                return yield this.addItemToUpdate(item, true);
            }
            else {
                yield this.beginUpdate();
                const newItem = yield this.addItemToUpdate(item, true);
                yield this.endUpdate();
                return newItem;
            }
        });
    }
    /**
     * Returns true if the index exists.
     */
    isIndexCreated() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield fs.access(path.join(this._config.folderPath, 'index.json'));
                return true;
            }
            catch (err) {
                return false;
            }
        });
    }
    /**
     * Returns all items in the index.
     * @remarks
     * This method loads the index into memory and returns all its items. A copy of the items
     * array is returned so no modifications should be made to the array.
     * @returns All items in the index
     */
    listItems() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.loadIndexData();
            return this._data.items.slice();
        });
    }
    /**
     * Returns all items in the index matching the filter.
     * @remarks
     * This method loads the index into memory and returns all its items matching the filter.
     * @param filter Filter to apply
     * @returns Items matching the filter
     */
    listItemsByMetadata(filter) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.loadIndexData();
            return this._data.items.filter(i => ItemSelector_1.ItemSelector.select(i.metadata, filter));
        });
    }
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
    queryItems(vector, topK, filter) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.loadIndexData();
            // Filter items
            let items = this._data.items;
            if (filter) {
                items = items.filter(i => ItemSelector_1.ItemSelector.select(i.metadata, filter));
            }
            // Calculate distances
            const norm = ItemSelector_1.ItemSelector.normalize(vector);
            const distances = [];
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const distance = ItemSelector_1.ItemSelector.normalizedCosineSimilarity(vector, norm, item.vector, item.norm);
                distances.push({ index: i, distance: distance });
            }
            // Sort by distance
            distances.sort((a, b) => a.distance - b.distance);
            // Find top k
            const top = distances.slice(0, topK).map(d => items[d.index]);
            // Load external metadata
            for (const item of top) {
                if (item.metadataFile) {
                    const metadataPath = path.join(this._config.folderPath, item.metadataFile);
                    const metadata = yield fs.readFile(metadataPath);
                    item.metadata = JSON.parse(metadata.toString());
                }
            }
            return top;
        });
    }
    /**
     * Adds or replaces an item in the index.
     * @remarks
     * A new update is started if one is not already in progress. If an item with the same ID
     * already exists, it will be replaced.
     * @param item Item to insert or replace
     * @returns Upserted item
     */
    upsertItem(item) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._update) {
                return yield this.addItemToUpdate(item, false);
            }
            else {
                yield this.beginUpdate();
                const newItem = yield this.addItemToUpdate(item, false);
                yield this.endUpdate();
                return newItem;
            }
        });
    }
    loadIndexData() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._data) {
                return;
            }
            if (!(yield this.isIndexCreated())) {
                throw new Error('Index does not exist');
            }
            const data = yield fs.readFile(path.join(this._config.folderPath, 'index.json'));
            this._data = JSON.parse(data.toString());
        });
    }
    addItemToUpdate(item, unique) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            // Ensure vector is provided
            if (!item.vector) {
                throw new Error('Vector is required');
            }
            // Ensure unique
            const id = (_a = item.id) !== null && _a !== void 0 ? _a : (0, uuid_1.v4)();
            if (unique) {
                const existing = this._update.items.find(i => i.id === id);
                if (existing) {
                    throw new Error(`Item with id ${id} already exists`);
                }
            }
            // Check for indexed metadata
            let metadata = {};
            let metadataFile;
            if (this._update.metadata_config.indexed && this._update.metadata_config.indexed.length > 0 && item.metadata) {
                // Copy only indexed metadata
                for (const key of this._update.metadata_config.indexed) {
                    if (item.metadata && item.metadata[key]) {
                        metadata[key] = item.metadata[key];
                    }
                }
                // Save remaining metadata to disk
                metadataFile = `${uuid_1.v4}.json`;
                const metadataPath = path.join(this._config.folderPath, metadataFile);
                yield fs.writeFile(metadataPath, JSON.stringify(item.metadata));
            }
            // Create new item
            const newItem = {
                id: id,
                metadata: metadata,
                vector: item.vector,
                norm: ItemSelector_1.ItemSelector.normalize(item.vector)
            };
            if (metadataFile) {
                newItem.metadataFile = metadataFile;
            }
            // Add item to index
            if (!unique) {
                const existing = this._update.items.find(i => i.id === id);
                if (existing) {
                    existing.metadata = newItem.metadata;
                    existing.vector = newItem.vector;
                    existing.metadataFile = newItem.metadataFile;
                    return existing;
                }
                else {
                    this._update.items.push(newItem);
                    return newItem;
                }
            }
            else {
                this._update.items.push(newItem);
                return newItem;
            }
        });
    }
}
exports.LocalIndex = LocalIndex;
//# sourceMappingURL=LocalIndex.js.map