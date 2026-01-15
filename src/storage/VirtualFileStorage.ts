// src/storage/VirtualFileStorage.ts
import { FileDetails, FileStorage, ListFilesFilter } from "./FileStorage";
import { pathUtils as path } from "../utils/pathUtils";
import { FileStorageUtilities } from "./FileStorageUtilities";

/**
 * An in-memory `FileStorage` implementation.
 */
export class VirtualFileStorage implements FileStorage {
  private readonly _entries: Map<string, StoredFile> = new Map();

  // Normalize keys consistently across all operations:
  // - path.normalize to resolve dot segments
  // - remove trailing separator (except for root) so 'a' and 'a/' match
  // - preserve '' to represent the root namespace in this storage
  private normalizeKey(key: string): string {
    if (key.length === 0) return "";
    let normalized = path.normalize(key);
    if (normalized.endsWith(path.sep) && normalized !== path.sep) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  }

  public async createFile(filePath: string, content: Buffer | string): Promise<void> {
    const key = this.normalizeKey(filePath);
    if (this._entries.has(key)) {
      throw new Error(`File already exists: ${key}`);
    }
    const buffer = typeof content === "string" ? Buffer.from(content, "utf8") : content;
    this._entries.set(key, {
      details: {
        name: path.basename(key),
        path: key,
        isFolder: false,
        fileType: FileStorageUtilities.getFileType(key),
      },
      // Clone to avoid external mutation of stored buffers (and keep Buffer type)
      content: Buffer.from(buffer),
    });
  }

  public async createFolder(folderPath: string): Promise<void> {
    const key = this.normalizeKey(folderPath);
    const existing = this._entries.get(key);
    if (existing) {
      if (!existing.details.isFolder) {
        throw new Error(`Cannot create folder: ${key} is a file`);
      }
      // Idempotent if the folder already exists
      return;
    }
    this._entries.set(key, {
      details: {
        name: path.basename(key),
        path: key,
        isFolder: true,
        fileType: undefined,
      },
    });
  }

  public async deleteFile(filePath: string): Promise<void> {
    const key = this.normalizeKey(filePath);
    const existing = this._entries.get(key);
    if (!existing) {
      // no-op if not exists
      return;
    }
    if (existing.details.isFolder) {
      throw new Error(`Cannot delete file: ${key} is a folder`);
    }
    this._entries.delete(key);
  }

  public async deleteFolder(folderPath: string): Promise<void> {
    const key = this.normalizeKey(folderPath);
    const existing = this._entries.get(key);
    if (!existing) {
      // no-op if not exists
      return;
    }
    if (!existing.details.isFolder) {
      throw new Error(`Cannot delete folder: ${key} is a file`);
    }
    // Note: does not cascade delete children per current implementation
    this._entries.delete(key);
  }

  public async getDetails(fileOrFolderPath: string): Promise<FileDetails> {
    const key = this.normalizeKey(fileOrFolderPath);
    const existing = this._entries.get(key);
    if (!existing) {
      throw new Error(`Path not found: ${key}`);
    }
    // Return a shallow copy to avoid external mutation of returned metadata
    return { ...existing.details };
  }

  public async listFiles(
    folderPath: string,
    filter: ListFilesFilter = "all"
  ): Promise<FileDetails[]> {
    const baseFolder = this.normalizeKey(folderPath);

    const results: FileDetails[] = [];
    for (const [, entry] of this._entries) {
      const parts = entry.details.path.split(path.sep);
      const parentFolder =
        parts.length > 1 ? parts.slice(0, parts.length - 1).join(path.sep) : "";
      if (parentFolder === baseFolder) {
        if (
          filter === "all" ||
          (filter === "files" && !entry.details.isFolder) ||
          (filter === "folders" && entry.details.isFolder)
        ) {
          // Return a shallow copy to avoid external mutation of returned metadata
          results.push({ ...entry.details });
        }
      }
    }
    return results;
  }

  public async pathExists(fileOrFolderPath: string): Promise<boolean> {
    const key = this.normalizeKey(fileOrFolderPath);
    return this._entries.has(key);
  }

  public async readFile(filePath: string): Promise<Buffer> {
    const key = this.normalizeKey(filePath);
    const existing = this._entries.get(key);
    if (!existing) {
      throw new Error(`File not found: ${key}`);
    }
    if (existing.details.isFolder) {
      throw new Error(`Cannot read file: ${key} is a folder`);
    }
    // Return a copy of the buffer to protect internal buffer from external mutation; fall back to empty buffer
    const content = existing.content ?? Buffer.from("", "utf8");
    return Buffer.from(content);
  }

  public async upsertFile(filePath: string, content: Buffer | string): Promise<void> {
    const key = this.normalizeKey(filePath);
    const existing = this._entries.get(key);
    if (existing && existing.details.isFolder) {
      throw new Error(`Cannot write file: ${key} is a folder`);
    }
    const buffer = typeof content === "string" ? Buffer.from(content, "utf8") : content;
    this._entries.set(key, {
      details: {
        name: path.basename(key),
        path: key,
        isFolder: false,
        fileType: FileStorageUtilities.getFileType(key),
      },
      // Clone to avoid external mutation of stored buffers (and keep Buffer type)
      content: Buffer.from(buffer),
    });
  }
}

/**
 * @private
 */
interface StoredFile {
  details: FileDetails;
  content?: Buffer;
}
