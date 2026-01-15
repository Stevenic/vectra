import { TextFetcher } from './types';
import * as fs from 'fs/promises';
import * as path from 'node:path';

export class FileFetcher implements TextFetcher {
  public async fetch(
    uri: string,
    onDocument: (uri: string, text: string, docType?: string | undefined) => Promise<boolean>
  ): Promise<boolean> {
    // Does path exist and is it a directory?
    let isDirectory: boolean;
    try {
      const stat = await fs.stat(uri);
      isDirectory = stat.isDirectory();
    } catch {
      // Non-existent path: treat as no-op success
      return true;
    }

    if (isDirectory) {
      const files = await fs.readdir(uri);
      let allOk = true;
      for (const file of files) {
        const filePath = path.join(uri, file);
        const ok = await this.fetch(filePath, onDocument);
        if (!ok) {
          allOk = false;
        }
      }
      return allOk;
    } else {
      // Read file and call onDocument
      const text = await fs.readFile(uri, 'utf8');

      // Determine docType:
      // - if extension exists, use it (without dot)
      // - otherwise, use last path segment (basename)
      const ext = path.extname(uri);
      const docType =
        ext && ext.length > 1
          ? ext.slice(1).toLowerCase()
          : path.basename(uri).toLowerCase();

      return await onDocument(uri, text, docType);
    }
  }
}