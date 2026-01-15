import { FileStorage } from "./FileStorage";
import { FileExt, FileType, ContentTypeMap } from "./FileType";
import * as path from "node:path";

/**
 * Utility functions for working with FileStorage abstractions.
 */
export class FileStorageUtilities {
    /**
     * Ensures that a folder exists in the given storage.
     * @param storage Storage to create the folder in.
     * @param folderPath Path to folder to ensure is created.
     */
    public static async ensureFolderExists(storage: FileStorage, folderPath: string): Promise<void> {
        if (!await storage.pathExists(folderPath)) {
            await storage.createFolder(folderPath);
        }
    }

    /**
     * Returns the file type of a file based on its extension.
     * @remarks
     * The file type is determined by the file extension. Only extensions found in the
     * `FileExt[]` array are returned.
     * @param filePath Path to file to get type for.
     * @returns The file type, or undefined if the file type is unknown.
     */
    public static getFileType(filePath: string): FileType|undefined {
        // Get extension from file
        const ext = path.extname(filePath).toLowerCase();
        if (ext.length > 1) {
            // Ensure the extension is valid
            const fileType = ext.substring(1);
            if (FileExt.includes(fileType)) {
                return fileType as FileType;
            }
        }

        return undefined;
    }

    /**
     * Maps a content type to a file type.
     * @param contentType Content type to map.
     * @returns File type, or undefined if the content type is unknown.
     */
    public static getFileTypeFromContentType(contentType: string): FileType|undefined {
        if (Object.prototype.hasOwnProperty.call(ContentTypeMap, contentType)) {
            return ContentTypeMap[contentType];
        } else {
            // Try to find a matching file type
            const parts = contentType.split('/');
            if (parts.length == 2) {
                const fileType = parts[1].includes('+') ? parts[1].split('+')[0] : parts[1];
                if (FileExt.includes(fileType)) {
                    return fileType as FileType;
                }
            }
        }

        return undefined;
    }

    /**
     * Deletes a file from storage if it exists.
     * @param storage Storage to delete the file from.
     * @param filePath Path to the file to delete.
     * @returns An Error if the file could not be deleted, otherwise undefined.
     */
    public static async tryDeleteFile(storage: FileStorage, filePath: string): Promise<Error|undefined> {
        try {
            await storage.deleteFile(filePath);
            return undefined;
        } catch (err: unknown) {
            return err as Error;
        }
    }
}