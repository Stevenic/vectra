import { FileDetails, FileStorage, ListFilesFilter } from "./FileStorage";
import { FileStorageUtilities } from "./FileStorageUtilities";
import fs from "fs/promises";
import * as path from "node:path";

/**
 * A `FileStorage` implementation that uses the local file system.
 */
export class LocalFileStorage implements FileStorage {
    private _rootFolder: string | undefined;

    /**
     * Creates a new `LocalFileStorage` instance.
     * @param rootFolder Optional. Root folder to use for file operations. If not provided, paths passed to operations should be fully qualified.
     */
    constructor(rootFolder?: string) {
        this._rootFolder = rootFolder;
    }

    async createFile(filePath: string, content: Buffer|string): Promise<void> {
        // Convert content to buffer if it's a string
        if (typeof content == 'string') {
            content = Buffer.from(content, 'utf8');
        }

        // Write the file
        await fs.writeFile(this.getFullPath(filePath), content, { flag: 'wx' });
    }

    async createFolder(folderPath: string): Promise<void> {
        await fs.mkdir(this.getFullPath(folderPath), { recursive: true });
    }

    async deleteFile(filePath: string): Promise<void> {
        await fs.unlink(this.getFullPath(filePath));
    }

    async deleteFolder(folderPath: string): Promise<void> {
        await fs.rm(this.getFullPath(folderPath), { recursive: true });
    }

    async getDetails(fileOrFolderPath: string): Promise<FileDetails> {
        const stats = await fs.stat(this.getFullPath(fileOrFolderPath));
        return {
            name: path.basename(fileOrFolderPath),
            path: fileOrFolderPath,
            isFolder: stats.isDirectory(),
            fileType: stats.isFile() ? FileStorageUtilities.getFileType(fileOrFolderPath) : undefined
        };
    }

    async listFiles(folderPath: string, _filter?: ListFilesFilter | undefined): Promise<FileDetails[]> {
        const folder = this.getFullPath(folderPath);
        const list = await fs.readdir(folder, { withFileTypes: true });
        return list.map((entry) => {
            return {
                name: entry.name,
                path: path.join(folder, entry.name),
                isFolder: entry.isDirectory(),
                fileType: entry.isFile() ? FileStorageUtilities.getFileType(entry.name) : undefined
            };
        });
    }

    async pathExists(fileOrFolderPath: string): Promise<boolean> {
        try {
            await fs.access(this.getFullPath(fileOrFolderPath));
            return true;
        } catch (err: unknown) {
            return false;
        }
    }

    async readFile(filePath: string): Promise<Buffer> {
        return await fs.readFile(this.getFullPath(filePath));
    }

    async upsertFile(filePath: string, content: Buffer|string): Promise<void> {
         // Convert content to buffer if it's a string
         if (typeof content == 'string') {
            content = Buffer.from(content, 'utf8');
        }

        // Write the file
       await fs.writeFile(this.getFullPath(filePath), content, { flag: 'w' });
    }

    private getFullPath(relativePath: string): string {
        if (!this._rootFolder) {
            return relativePath.length > 0 ? relativePath : '.';
        } else if (relativePath.length == 0) {
            return this._rootFolder;
        } else {
            return path.join(this._rootFolder, relativePath);
        }
    }

}