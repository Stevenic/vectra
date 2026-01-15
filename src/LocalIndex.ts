import * as path from "node:path";
import { v4 } from 'uuid';
import { ItemSelector } from './ItemSelector';
import { IndexItem, IndexStats, MetadataFilter, MetadataTypes, QueryResult } from './types';
import { LocalDocument } from './LocalDocument';
import { LocalDocumentIndex } from './LocalDocumentIndex';
import bm25 from 'wink-bm25-text-search';
import winkNLP from 'wink-nlp';
import model from 'wink-eng-lite-web-model';
import { FileStorage, LocalFileStorage } from './storage';

export interface CreateIndexConfig {
  version: number;
  deleteIfExists?: boolean;
  metadata_config?: {
    indexed?: string[];
  };
}

interface IndexData {
  version: number;
  metadata_config: {
    indexed?: string[];
  };
  items: IndexItem[];
}

type Bm25EngineLike = {
  defineConfig(config: any): any;
  definePrepTasks(tasks: Array<(text: string) => any[]>): any;
  addDoc(doc: any, id: number): any;
  consolidate(): any;
  search(q: string): any;
};

type NlpLike = {
  its: any;
  readDoc(text: string): {
    tokens(): {
      filter(fn: (t: any) => boolean): any;
      each(fn: (t: any) => void): any;
    };
  };
};

type LocalIndexDeps = {
  createBm25Engine?: () => Bm25EngineLike;
  createNlp?: () => NlpLike;
  /** injected for testability (ids and metadata filenames) */
  createId?: () => string;
};

export class LocalIndex<TMetadata extends Record<string, MetadataTypes> = Record<string, MetadataTypes>> {
  private readonly _folderPath: string;
  private readonly _indexName: string = "index.json";
  private readonly _storage: FileStorage;
  private _data?: IndexData;
  private _update?: IndexData;

  private _bm25Engine: any;

  private readonly _deps: Required<LocalIndexDeps>;

  public constructor(folderPath: string, storage?: FileStorage, deps?: LocalIndexDeps) {
    this._folderPath = folderPath;
    this._storage = storage || new LocalFileStorage();

    this._deps = {
      createBm25Engine: deps?.createBm25Engine ?? (() => bm25() as any),
      createNlp: deps?.createNlp ?? (() => (winkNLP(model) as any)),
      createId: deps?.createId ?? (() => v4()),
    };
  }

  public get folderPath(): string {
    return this._folderPath;
  }

  public get indexName(): string {
    return this._indexName;
  }

  public get storage(): FileStorage {
    return this._storage;
  }

  public async beginUpdate(): Promise<void> {
    if (this._update) throw new Error('Update already in progress');
    await this.loadIndexData();
    this._update = structuredClone(this._data);
  }

  public cancelUpdate(): void {
    this._update = undefined;
  }

  public async createIndex(config: CreateIndexConfig = { version: 1 }): Promise<void> {
    if (await this.isIndexCreated()) {
      if (config.deleteIfExists) await this.deleteIndex();
      else throw new Error('Index already exists');
    }

    try {
      await this.storage.createFolder(this._folderPath);

      this._data = {
        version: config.version,
        metadata_config: config.metadata_config ?? {},
        items: []
      };

      await this.storage.upsertFile(path.join(this._folderPath, this._indexName), JSON.stringify(this._data));
    } catch (_err: unknown) {
      await this.deleteIndex();
      throw new Error('Error creating index');
    }
  }

  public async deleteIndex(): Promise<void> {
    this._data = undefined;
    return await this.storage.deleteFolder(this._folderPath);
  }

  public async deleteItem(id: string): Promise<void> {
    if (this._update) {
      const index = this._update.items.findIndex(i => i.id === id);
      if (index >= 0) this._update.items.splice(index, 1);
    } else {
      await this.beginUpdate();
      const index = this._update!.items.findIndex(i => i.id === id);
      if (index >= 0) this._update!.items.splice(index, 1);
      await this.endUpdate();
    }
  }

  public async endUpdate(): Promise<void> {
    if (!this._update) throw new Error('No update in progress');

    try {
      await this.storage.upsertFile(path.join(this._folderPath, this._indexName), JSON.stringify(this._update));
      this._data = this._update;
      this._update = undefined;
    } catch (err: unknown) {
      throw new Error(`Error saving index: ${(err as any).toString()}`);
    }
  }

  public async getIndexStats(): Promise<IndexStats> {
    await this.loadIndexData();
    return {
      version: this._data!.version,
      metadata_config: this._data!.metadata_config,
      items: this._data!.items.length
    };
  }

  public async getItem<TItemMetadata extends TMetadata = TMetadata>(id: string): Promise<IndexItem<TItemMetadata> | undefined> {
    await this.loadIndexData();
    return this._data!.items.find(i => i.id === id) as any | undefined;
  }

  public async insertItem<TItemMetadata extends TMetadata = TMetadata>(item: Partial<IndexItem<TItemMetadata>>): Promise<IndexItem<TItemMetadata>> {
    if (this._update) {
      return await this.addItemToUpdate(item, true) as any;
    } else {
      await this.beginUpdate();
      const newItem = await this.addItemToUpdate(item, true);
      await this.endUpdate();
      return newItem as any;
    }
  }

  public async batchInsertItems<TItemMetadata extends TMetadata = TMetadata>(items: Partial<IndexItem<TItemMetadata>>[]): Promise<IndexItem[]> {
    await this.beginUpdate();
    try {
      const newItems: IndexItem[] = [];
      for (const item of items) {
        const newItem = await this.addItemToUpdate(item, true);
        newItems.push(newItem);
      }
      await this.endUpdate();
      return newItems;
    } catch (e) {
      await this.cancelUpdate();
      throw e;
    }
  }

  public async isIndexCreated(): Promise<boolean> {
    return await this.storage.pathExists(path.join(this._folderPath, this._indexName));
  }

  public async listItems<TItemMetadata extends TMetadata = TMetadata>(): Promise<IndexItem<TItemMetadata>[]> {
    await this.loadIndexData();
    return this._data!.items.slice() as any;
  }

  public async listItemsByMetadata<TItemMetadata extends TMetadata = TMetadata>(filter: MetadataFilter): Promise<IndexItem<TItemMetadata>[]> {
    await this.loadIndexData();
    return this._data!.items.filter(i => ItemSelector.select(i.metadata, filter)) as any;
  }

  public async queryItems<TItemMetadata extends TMetadata = TMetadata>(
    vector: number[],
    query: string,
    topK: number,
    filter?: MetadataFilter,
    isBm25?: boolean
  ): Promise<QueryResult<TItemMetadata>[]> {
    await this.loadIndexData();

    let items = this._data!.items;
    if (filter) items = items.filter(i => ItemSelector.select(i.metadata, filter));

    const norm = ItemSelector.normalize(vector);
    const distances: { index: number, distance: number }[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const distance = ItemSelector.normalizedCosineSimilarity(vector, norm, item.vector, item.norm);
      distances.push({ index: i, distance });
    }

    distances.sort((a, b) => b.distance - a.distance);

    const top: QueryResult<TItemMetadata>[] = distances.slice(0, topK).map(d => ({
      item: Object.assign({}, items[d.index]) as any,
      score: d.distance
    }));

    for (const item of top) {
      if (item.item.metadataFile) {
        const metadataPath = path.join(this._folderPath, item.item.metadataFile);
        const metadata = await this.storage.readFile(metadataPath);
        item.item.metadata = JSON.parse(metadata.toString('utf-8'));
      }
    }

    if (isBm25) {
      const itemSet = new Set();
      for (const item of top) itemSet.add(item.item.id);

      await this.setupBm25();

      let currDoc;
      let currDocTxt;
      for (let i = 0; i < items.length; i++) {
        if (!itemSet.has(items[i].id)) {
          const item = items[i];
          currDoc = new LocalDocument((this as unknown) as LocalDocumentIndex, item.metadata.documentId.toString(), '');
          currDocTxt = await currDoc.loadText();
          const startPos = item.metadata.startPos;
          const endPos = item.metadata.endPos;
          const chunkText = currDocTxt.substring(Number(startPos), Number(endPos) + 1);
          this._bm25Engine.addDoc({ body: chunkText }, i);
        }
      }

      this._bm25Engine.consolidate();
      const results = await this.bm25Search(query, items, topK);
      results.forEach((res: any) => {
        top.push({
          item: Object.assign({}, { ...items[res[0]], metadata: { ...items[res[0]].metadata, isBm25: true } }) as any,
          score: res[1]
        });
      });
    }

    return top;
  }

  public async upsertItem<TItemMetadata extends TMetadata = TMetadata>(item: Partial<IndexItem<TItemMetadata>>): Promise<IndexItem> {
    if (this._update) {
      return await this.addItemToUpdate(item, false) as any;
    } else {
      await this.beginUpdate();
      const newItem = await this.addItemToUpdate(item, false);
      await this.endUpdate();
      return newItem as any;
    }
  }

  protected async loadIndexData(): Promise<void> {
    if (this._data) return;

    if (!await this.isIndexCreated()) throw new Error('Index does not exist');

    const data = await this.storage.readFile(path.join(this._folderPath, this.indexName));
    this._data = JSON.parse(data.toString('utf-8'));
  }

  private async addItemToUpdate(item: Partial<IndexItem<any>>, unique: boolean): Promise<IndexItem> {
    if (!item.vector) throw new Error('Vector is required');

    const id = item.id ?? this._deps.createId();

    if (unique) {
      const existing = this._update!.items.find(i => i.id === id);
      if (existing) throw new Error(`Item with id ${id} already exists`);
    }

    let metadata: Record<string, any> = {};
    let metadataFile: string | undefined;

    if (this._update!.metadata_config.indexed && this._update!.metadata_config.indexed.length > 0 && item.metadata) {
      for (const key of this._update!.metadata_config.indexed) {
        if (item.metadata && item.metadata[key]) metadata[key] = item.metadata[key];
      }

      metadataFile = `${this._deps.createId()}.json`;
      const metadataPath = path.join(this._folderPath, metadataFile);
      await this.storage.upsertFile(metadataPath, JSON.stringify(item.metadata));
    } else if (item.metadata) {
      metadata = item.metadata;
    }

    const newItem: IndexItem = {
      id,
      metadata,
      vector: item.vector,
      norm: ItemSelector.normalize(item.vector)
    };

    if (metadataFile) newItem.metadataFile = metadataFile;

    if (!unique) {
      const existing = this._update!.items.find(i => i.id === id);
      if (existing) {
        existing.metadata = newItem.metadata;
        existing.vector = newItem.vector;
        existing.metadataFile = newItem.metadataFile;
        return existing;
      } else {
        this._update!.items.push(newItem);
        return newItem;
      }
    } else {
      this._update!.items.push(newItem);
      return newItem;
    }
  }

  private async setupBm25(): Promise<any> {
    this._bm25Engine = this._deps.createBm25Engine();

    const nlp = this._deps.createNlp();
    const its = nlp.its;

    const prepTask = function (text: string) {
      const tokens: any[] = [];
      nlp.readDoc(text)
        .tokens()
        .filter((t: any) => (t.out(its.type) === 'word' && !t.out(its.stopWordFlag)))
        .each((t: any) => tokens.push((t.out(its.negationFlag)) ? '!' + t.out(its.stem) : t.out(its.stem)));
      return tokens;
    };

    this._bm25Engine.defineConfig({ fldWeights: { body: 1 } });
    this._bm25Engine.definePrepTasks([prepTask]);
  }

  private async bm25Search(searchQuery: string, _items: any, topK: number): Promise<any> {
    const results = this._bm25Engine.search(searchQuery);
    return results.slice(0, topK);
  }
}
