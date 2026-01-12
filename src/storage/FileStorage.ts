import { FileType } from "./FileType";

/**
 * Filter to apply when listing files.
 */
export type ListFilesFilter = 'files' | 'folders' | 'all';

/**
 * Interface implemented by storage plugins.
 */
export interface FileStorage {
    /**
     * Creates a new file with the given path and content.
     * @remarks
     * Throws an error if the file already exists.
     * @param filePath Path to file to create.
     * @param content Content to write to the file.
     */
    createFile(filePath: string, content: Buffer|string): Promise<void>;

    /**
     * Creates a folder with the given path.
     * @remarks
     * Any missing parent folders will also be created.
     * @param folderPath Path to folder to create.
     */
    createFolder(folderPath: string): Promise<void>;

    /**
     * Deletes the file at the given path if it exists.
     * @param filePath Path to file to delete.
     */
    deleteFile(filePath: string): Promise<void>;

    /**
     * Deletes the folder at the given path if it exists.
     * @remarks
     * All files and folders within the folder will also be deleted.
     * @param folderPath Path to folder to delete.
     */
    deleteFolder(folderPath: string): Promise<void>;

    /**
     * Returns the details of an existing file or folder.
     * @remarks
     * Throws an error if the file or folder does not exist.
     * @param fileOrFolderPath File or folder path to get details for.
     * @returns Details of the file or folder.
     */
    getDetails(fileOrFolderPath: string): Promise<FileDetails>;

    /**
     * Lists all files in the given folder.
     * @param folderPath Folder to list files in.
     * @param filter Optional. Type of entries to return. Defaults to 'all'.
     */
    listFiles(folderPath: string, filter?: ListFilesFilter): Promise<FileDetails[]>;

    /**
     * Returns true if a file or folder exists at the given path.
     * @param fileOrFolderPath File or folder path to check.
     */
    pathExists(fileOrFolderPath: string): Promise<boolean>;

    /**
     * Reads the file at the given path.
     * @param filePath Path to file to read.
     */
    readFile(filePath: string): Promise<Buffer>;

    /**
     * Creates or replaces the file at the given path with the given content.
     * @param filePath Path to file to write.
     * @param content Content to write to the file.
     */
    upsertFile(filePath: string, content: Buffer|string): Promise<void>;
}

/**
 * Details of a file or folder.
 */
export interface FileDetails {
    /**
     * Name of the file or folder.
     */
    name: string;

    /**
     * Path to the file or folder.
     */
    path: string;

    /**
     * True if the entry is a folder.
     */
    isFolder: boolean;

    /**
     * The files type if known.
     * @remarks
     * Based off the file extension. This will be undefined for folders and for extensions that are not
     * in the `FileExt[]` array. 
     */
    fileType?: FileType;
}