import { FileDetails, FileStorage, ListFilesFilter } from "./FileStorage";
import { FileStorageUtilities } from "./FileStorageUtilities";
import { pathUtils } from "../utils/pathUtils";

/**
 * Browser-compatible FileStorage implementation using IndexedDB.
 * @remarks
 * This storage backend works in browsers and Electron renderer processes.
 * Data persists across page reloads and browser sessions.
 */
export class IndexedDBStorage implements FileStorage {
    private readonly _dbName: string;
    private _db: IDBDatabase | undefined;

    /**
     * Creates a new `IndexedDBStorage` instance.
     * @param dbName Name of the IndexedDB database. Defaults to 'vectra-db'.
     */
    constructor(dbName: string = 'vectra-db') {
        this._dbName = dbName;
    }

    /**
     * Opens or creates the IndexedDB database.
     */
    private async getDB(): Promise<IDBDatabase> {
        if (this._db) {
            return this._db;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this._dbName, 1);

            request.onerror = () => reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));

            request.onsuccess = () => {
                this._db = request.result;
                resolve(this._db);
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                // Store for files: { path, content, createdAt, updatedAt }
                if (!db.objectStoreNames.contains('files')) {
                    const fileStore = db.createObjectStore('files', { keyPath: 'path' });
                    fileStore.createIndex('parentPath', 'parentPath', { unique: false });
                }

                // Store for folders: { path, createdAt }
                if (!db.objectStoreNames.contains('folders')) {
                    const folderStore = db.createObjectStore('folders', { keyPath: 'path' });
                    folderStore.createIndex('parentPath', 'parentPath', { unique: false });
                }
            };
        });
    }

    /**
     * Normalizes a path for consistent storage.
     */
    private normalizePath(filePath: string): string {
        // Normalize and ensure forward slashes
        let normalized = pathUtils.normalize(filePath);
        // Remove trailing slash unless it's the root
        if (normalized.length > 1 && normalized.endsWith('/')) {
            normalized = normalized.slice(0, -1);
        }
        return normalized;
    }

    /**
     * Gets the parent path of a given path.
     */
    private getParentPath(filePath: string): string {
        const normalized = this.normalizePath(filePath);
        const parent = pathUtils.dirname(normalized);
        return parent === normalized ? '' : parent;
    }

    async createFile(filePath: string, content: Buffer | string): Promise<void> {
        const db = await this.getDB();
        const normalizedPath = this.normalizePath(filePath);

        // Convert content to ArrayBuffer for storage
        let arrayBuffer: ArrayBuffer;
        if (typeof content === 'string') {
            arrayBuffer = new TextEncoder().encode(content).buffer;
        } else {
            arrayBuffer = content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength);
        }

        return new Promise((resolve, reject) => {
            const tx = db.transaction('files', 'readwrite');
            const store = tx.objectStore('files');

            const record = {
                path: normalizedPath,
                parentPath: this.getParentPath(normalizedPath),
                content: arrayBuffer,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            const request = store.add(record);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error(`File already exists: ${filePath}`));
        });
    }

    async createFolder(folderPath: string): Promise<void> {
        const db = await this.getDB();
        const normalizedPath = this.normalizePath(folderPath);

        // Create all parent folders recursively
        const parts = normalizedPath.split('/').filter(Boolean);
        let currentPath = '';

        const tx = db.transaction('folders', 'readwrite');
        const store = tx.objectStore('folders');

        for (const part of parts) {
            const parentPath = currentPath;
            currentPath = currentPath ? `${currentPath}/${part}` : part;

            // Use put to create or update (idempotent)
            store.put({
                path: currentPath,
                parentPath: parentPath,
                createdAt: Date.now()
            });
        }

        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(new Error(`Failed to create folder: ${folderPath}`));
        });
    }

    async deleteFile(filePath: string): Promise<void> {
        const db = await this.getDB();
        const normalizedPath = this.normalizePath(filePath);

        return new Promise((resolve, reject) => {
            const tx = db.transaction('files', 'readwrite');
            const store = tx.objectStore('files');
            const request = store.delete(normalizedPath);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error(`Failed to delete file: ${filePath}`));
        });
    }

    async deleteFolder(folderPath: string): Promise<void> {
        const db = await this.getDB();
        const normalizedPath = this.normalizePath(folderPath);
        const prefix = normalizedPath + '/';

        return new Promise((resolve, reject) => {
            const tx = db.transaction(['files', 'folders'], 'readwrite');
            const fileStore = tx.objectStore('files');
            const folderStore = tx.objectStore('folders');

            // Delete all files with matching prefix
            const filesCursor = fileStore.openCursor();
            filesCursor.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                    if (cursor.value.path === normalizedPath || cursor.value.path.startsWith(prefix)) {
                        cursor.delete();
                    }
                    cursor.continue();
                }
            };

            // Delete all folders with matching prefix
            const foldersCursor = folderStore.openCursor();
            foldersCursor.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                    if (cursor.value.path === normalizedPath || cursor.value.path.startsWith(prefix)) {
                        cursor.delete();
                    }
                    cursor.continue();
                }
            };

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(new Error(`Failed to delete folder: ${folderPath}`));
        });
    }

    async getDetails(fileOrFolderPath: string): Promise<FileDetails> {
        const db = await this.getDB();
        const normalizedPath = this.normalizePath(fileOrFolderPath);

        // Try to find as file first
        const file = await new Promise<any>((resolve) => {
            const tx = db.transaction('files', 'readonly');
            const store = tx.objectStore('files');
            const request = store.get(normalizedPath);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(undefined);
        });

        if (file) {
            return {
                name: pathUtils.basename(normalizedPath),
                path: normalizedPath,
                isFolder: false,
                fileType: FileStorageUtilities.getFileType(normalizedPath)
            };
        }

        // Try to find as folder
        const folder = await new Promise<any>((resolve) => {
            const tx = db.transaction('folders', 'readonly');
            const store = tx.objectStore('folders');
            const request = store.get(normalizedPath);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(undefined);
        });

        if (folder) {
            return {
                name: pathUtils.basename(normalizedPath),
                path: normalizedPath,
                isFolder: true
            };
        }

        throw new Error(`Path not found: ${fileOrFolderPath}`);
    }

    async listFiles(folderPath: string, filter?: ListFilesFilter): Promise<FileDetails[]> {
        const db = await this.getDB();
        const normalizedPath = this.normalizePath(folderPath);
        const results: FileDetails[] = [];

        // Get files in folder
        if (filter !== 'folders') {
            const files = await new Promise<any[]>((resolve) => {
                const tx = db.transaction('files', 'readonly');
                const store = tx.objectStore('files');
                const index = store.index('parentPath');
                const request = index.getAll(normalizedPath);
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => resolve([]);
            });

            for (const file of files) {
                results.push({
                    name: pathUtils.basename(file.path),
                    path: file.path,
                    isFolder: false,
                    fileType: FileStorageUtilities.getFileType(file.path)
                });
            }
        }

        // Get subfolders
        if (filter !== 'files') {
            const folders = await new Promise<any[]>((resolve) => {
                const tx = db.transaction('folders', 'readonly');
                const store = tx.objectStore('folders');
                const index = store.index('parentPath');
                const request = index.getAll(normalizedPath);
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => resolve([]);
            });

            for (const folder of folders) {
                results.push({
                    name: pathUtils.basename(folder.path),
                    path: folder.path,
                    isFolder: true
                });
            }
        }

        return results;
    }

    async pathExists(fileOrFolderPath: string): Promise<boolean> {
        try {
            await this.getDetails(fileOrFolderPath);
            return true;
        } catch {
            return false;
        }
    }

    async readFile(filePath: string): Promise<Buffer> {
        const db = await this.getDB();
        const normalizedPath = this.normalizePath(filePath);

        const file = await new Promise<any>((resolve, reject) => {
            const tx = db.transaction('files', 'readonly');
            const store = tx.objectStore('files');
            const request = store.get(normalizedPath);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(new Error(`Failed to read file: ${filePath}`));
        });

        if (!file) {
            throw new Error(`File not found: ${filePath}`);
        }

        // Convert ArrayBuffer back to Buffer
        return Buffer.from(file.content);
    }

    async upsertFile(filePath: string, content: Buffer | string): Promise<void> {
        const db = await this.getDB();
        const normalizedPath = this.normalizePath(filePath);

        // Convert content to ArrayBuffer for storage
        let arrayBuffer: ArrayBuffer;
        if (typeof content === 'string') {
            arrayBuffer = new TextEncoder().encode(content).buffer;
        } else {
            arrayBuffer = content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength);
        }

        return new Promise((resolve, reject) => {
            const tx = db.transaction('files', 'readwrite');
            const store = tx.objectStore('files');

            const record = {
                path: normalizedPath,
                parentPath: this.getParentPath(normalizedPath),
                content: arrayBuffer,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            const request = store.put(record);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error(`Failed to write file: ${filePath}`));
        });
    }

    /**
     * Closes the database connection.
     */
    close(): void {
        if (this._db) {
            this._db.close();
            this._db = undefined;
        }
    }

    /**
     * Deletes the entire database.
     */
    async destroy(): Promise<void> {
        this.close();

        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(this._dbName);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error(`Failed to delete database: ${this._dbName}`));
        });
    }
}
