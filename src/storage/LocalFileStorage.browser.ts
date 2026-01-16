/**
 * Browser stub for LocalFileStorage.
 * This module throws an error if LocalFileStorage is used in a browser environment.
 * Use IndexedDBStorage or VirtualFileStorage instead.
 */

import { FileStorage, FileDetails, ListFilesFilter } from "./FileStorage";

export class LocalFileStorage implements FileStorage {
    constructor() {
        throw new Error(
            'LocalFileStorage is not supported in browser environments. ' +
            'Use IndexedDBStorage or VirtualFileStorage instead.'
        );
    }

    createFile(): Promise<void> {
        throw new Error('LocalFileStorage is not supported in browser environments.');
    }

    createFolder(): Promise<void> {
        throw new Error('LocalFileStorage is not supported in browser environments.');
    }

    deleteFile(): Promise<void> {
        throw new Error('LocalFileStorage is not supported in browser environments.');
    }

    deleteFolder(): Promise<void> {
        throw new Error('LocalFileStorage is not supported in browser environments.');
    }

    getDetails(): Promise<FileDetails> {
        throw new Error('LocalFileStorage is not supported in browser environments.');
    }

    listFiles(): Promise<FileDetails[]> {
        throw new Error('LocalFileStorage is not supported in browser environments.');
    }

    pathExists(): Promise<boolean> {
        throw new Error('LocalFileStorage is not supported in browser environments.');
    }

    readFile(): Promise<Buffer> {
        throw new Error('LocalFileStorage is not supported in browser environments.');
    }

    upsertFile(): Promise<void> {
        throw new Error('LocalFileStorage is not supported in browser environments.');
    }
}