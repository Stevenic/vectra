import * as fs from "fs/promises";
import * as path from "path";
import { MetadataTypes } from "./types";
import { LocalDocumentIndex } from "./LocalDocumentIndex";

/**
 * Represents a document stored in a local index.
 * @public
 */
export class LocalDocument {
    private readonly _index: LocalDocumentIndex;
    private readonly _documentId: string;
    private readonly _uri: string;
    private _metadata: Record<string,MetadataTypes>|undefined;
    private _text?: string;

    /**
     * Creates a new instance of LocalDocument.
     * @param index - The document index this document belongs to.
     * @param documentId - The ID of the document.
     * @param uri - The URI of the document.
     */
    public constructor(index: LocalDocumentIndex, documentId: string, uri: string) {
        this._index = index;
        this._documentId = documentId;
        this._uri = uri;
    }

    /**
     * Returns the folder path where the document is stored.
     */
    public get folderPath(): string {
        return this._index.folderPath;
    }

    /**
     * Returns the ID of the document.
     */
    public get id(): string {
        return this._documentId;
    }

    /**
     * Returns the URI of the document.
     */
    public get uri(): string {
        return this._uri;
    }

    /**
     * Returns the length of the document in tokens.
     * @remarks
     * This value will be estimated for documents longer then 40k bytes.
     * @returns Length of the document in tokens.
     */
    public async getLength(): Promise<number> {
        const text = await this.loadText();
        if (text.length <= 40000) {
            return this._index.tokenizer.encode(text).length;
        } else {
            return Math.ceil(text.length / 4);
        }
    }

    /**
     * Determines if the document has additional metadata storred on disk.
     * @returns True if the document has metadata; otherwise, false.
     */
    public async hasMetadata(): Promise<boolean> {
        try {
            await fs.access(path.join(this.folderPath, `${this.id}.json`));
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Loads the metadata for the document from disk.
     * @returns Metadata for the document.
     */
    public async loadMetadata(): Promise<Record<string,MetadataTypes>> {
        if (this._metadata == undefined) {
            let json: string;
            try {
                json = (await fs.readFile(path.join(this.folderPath, `${this.id}.json`))).toString();
            } catch (error: unknown) {
                throw new Error(`Error reading metadata for document "${this.uri}": ${error instanceof Error ? error.message : String(error)}`);
            }

            try {
                this._metadata = JSON.parse(json);
            } catch (error: unknown) {
                throw new Error(`Error parsing metadata for document "${this.uri}": ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        return this._metadata!;
    }

    /**
     * Loads the text for the document from disk.
     * @returns Text for the document.
     */
    public async loadText(): Promise<string> {
        if (this._text == undefined) {
            try {
                this._text = (await fs.readFile(path.join(this.folderPath, `${this.id}.txt`))).toString();
            } catch (error: unknown) {
                throw new Error(`Error reading text file for document "${this.uri}": ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        return this._text;
    }
}