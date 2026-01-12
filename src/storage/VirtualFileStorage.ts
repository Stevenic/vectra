import { FileDetails, FileStorage, ListFilesFilter } from "./FileStorage";
import * as path from "path";
import { FileStorageUtilities } from "./FileStorageUtilities";

/**
 * An in-memory `FileStorage` implementation.
 */
export class VirtualFileStorage implements FileStorage {
    private readonly _entries: Map<string, StoredFile> = new Map();
    
    public createFile(filePath: string, content: Buffer|string): Promise<void> {
        // Check if the file already exists
        const key = path.normalize(filePath);
        if (this._entries.has(key)) {
            throw new Error(`File already exists: ${key}`);
        }

        // Convert content to buffer if it's a string
        if (typeof content == 'string') {
            content = Buffer.from(content, 'utf8');
        }

        // Create the file
        this._entries.set(key, { 
            details: { name: path.basename(key), path: key, isFolder: false, fileType: FileStorageUtilities.getFileType(key) },
            content
        });

        return Promise.resolve();
    }

    public createFolder(folderPath: string): Promise<void> {
        // Check if the folder already exists
        const key = path.normalize(folderPath);
        if (this._entries.has(key)) {
            // Throw error if entry is a file
            if (!this._entries.get(key)!.details.isFolder) {
                throw new Error(`Cannot create folder: ${key} is a file`);
            }
        } else {
            // Create the folder
            this._entries.set(key, {
                details: { name: path.basename(key), path: key, isFolder: true, fileType: undefined }
            });
        }

        return Promise.resolve();
    }

    public deleteFile(filePath: string): Promise<void> {
        // Find entry
        const key = path.normalize(filePath);
        const entry = this._entries.get(key);
        if (entry) {
            // Check for a folder
            if (entry.details.isFolder) {
                throw new Error(`Cannot delete file: ${key} is a folder`);
            }

            // Delete the file
            this._entries.delete(key);
        }

        return Promise.resolve();
    }

    public deleteFolder(folderPath: string): Promise<void> {
        // Find entry
        const key = path.normalize(folderPath);
        const entry = this._entries.get(key);
        if (entry) {
            // Check for a file
            if (!entry.details.isFolder) {
                throw new Error(`Cannot delete folder: ${key} is a file`);
            }

            // Delete the folder
            this._entries.delete(key);
        }

        return Promise.resolve();
    }

    public getDetails(fileOrFolderPath: string): Promise<FileDetails> {
        // Find entry
        const key = path.normalize(fileOrFolderPath);
        const entry = this._entries.get(key);
        if (!entry) {
            throw new Error(`Path not found: ${key}`);
        }
        return Promise.resolve(entry.details);
    }

    public listFiles(folderPath: string, filter: ListFilesFilter = 'all'): Promise<FileDetails[]> {
        // Find entries matching filter
        let baseFolder = folderPath.length > 0 ? path.normalize(folderPath) : '';
        const entries = Array.from(this._entries.values())
            .map(e => e.details)
            .filter(e => {
                // Apply provided filter
                if ((filter == 'files' && e.isFolder) || (filter == 'folders' && !e.isFolder)) {
                    return false;
                }

                // Ensure entry is an immediate child of the folder
                const parts = e.path.split(path.sep);
                const parentFolder = parts.length > 1 ? parts.slice(0, parts.length - 1).join(path.sep)  : '';
                return parentFolder == baseFolder;
            });

        return Promise.resolve(entries);   
    }

    public pathExists(fileOrFolderPath: string): Promise<boolean> {
        const key = path.normalize(fileOrFolderPath);
        return Promise.resolve(this._entries.has(key));
    }

    public readFile(filePath: string): Promise<Buffer> {
        // Find entry
        const key = path.normalize(filePath);
        const entry = this._entries.get(key);
        if (!entry) {
            throw new Error(`File not found: ${key}`);
        } else if (entry.details.isFolder) {
            throw new Error(`Cannot read file: ${key} is a folder`);
        }
        return Promise.resolve(entry.content ?? Buffer.from('', 'utf8'));
    }

    public upsertFile(filePath: string, content: Buffer|string): Promise<void> {
        // Check if the file already exists as a folder
        const key = path.normalize(filePath);
        const entry = this._entries.get(key);
        if (entry && entry.details.isFolder) {
            throw new Error(`Cannot write file: ${key} is a folder`);
        }

        // Convert content to buffer if it's a string
        if (typeof content == 'string') {
            content = Buffer.from(content, 'utf8');
        }

        // Create or update the file
        this._entries.set(key, { 
            details: {
                name: path.basename(key), 
                path: key, 
                isFolder: false, 
                fileType: FileStorageUtilities.getFileType(key)
            },
            content
        });

        return Promise.resolve();
    }
}

/**
 * @private
 */
interface StoredFile {
    details: FileDetails;
    content?: Buffer;
}