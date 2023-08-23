import * as fs from 'fs/promises';
import * as path from 'path';
import { MetadataTypes } from './types';

export class LocalDocument {
    private readonly _folderPath: string;
    private readonly _id: string;
    private readonly _uri: string;
    private _metadata: Record<string,MetadataTypes>|undefined;
    private _text: string|undefined;

    public constructor(folderPath: string, id: string, uri: string) {
        this._folderPath = folderPath;
        this._id = id;
        this._uri = uri;
    }

    public get folderPath(): string {
        return this._folderPath;
    }

    public get id(): string {
        return this._id;
    }

    public get uri(): string {
        return this._uri;
    }

    public async hasMetadata(): Promise<boolean> {
        try {
            await fs.access(path.join(this.folderPath, `${this.id}.json`));
            return true;
        } catch (err: unknown) {
            return false;
        }
    }

    public async loadMetadata(): Promise<Record<string,MetadataTypes>> {
        if (this._metadata == undefined) {
            let json: string;
            try {
                json = (await fs.readFile(path.join(this.folderPath, `${this.id}.json`))).toString();
            } catch (err: unknown) {
                throw new Error(`Error reading metadata for document "${this.uri}": ${(err as any).toString()}`);
            }

            try {
                this._metadata = JSON.parse(json);
            } catch (err: unknown) {
                throw new Error(`Error parsing metadata for document "${this.uri}": ${(err as any).toString()}`);
            }
        }

        return this._metadata!;
    }

    public async loadText(): Promise<string> {
        if (this._text == undefined) {
            try {
                this._text = (await fs.readFile(path.join(this.folderPath, `${this.id}.txt`))).toString();
            } catch (err: unknown) {
                throw new Error(`Error reading text file for document "${this.uri}": ${(err as any).toString()}`);
            }
        }

        return this._text;
    }

}