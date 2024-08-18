import { TextFetcher } from './types';
import * as fs from './fs';
import * as path from 'path';

export class FileFetcher implements TextFetcher {
    public async fetch(uri: string, onDocument: (uri: string, text: string, docType?: string | undefined) => Promise<boolean>): Promise<boolean> {
        // Does path exist and is it a directory?
        let isDirectory: boolean;
        try {
            const stat = await fs.stat(uri);
            isDirectory = stat.isDirectory();
        } catch {
            return true;
        }

        // If directory, read all files and recurse
        if (isDirectory) {
            const files = await fs.readdir(uri);
            for (const file of files) {
                const filePath = path.join(uri, file);
                await this.fetch(filePath, onDocument);
            }
            return true;
        } else {
            // Read file and call onDocument
            const text = await fs.readText(uri);
            const parts = uri.split('.');
            return await onDocument(uri, text, parts.length > 0 ? parts[parts.length - 1].toLowerCase() : undefined);
        }
    }
}