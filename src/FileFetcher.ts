import { TextFetcher } from './types';
import fs from 'node:fs';
import * as path from 'node:path';

export class FileFetcher implements TextFetcher {
  public async fetch(
    uri: string,
    onDocument: (uri: string, text: string, docType?: string | undefined) => Promise<boolean>
  ): Promise<boolean> {
    // Does path exist and is it a directory?
    let stat;
    try {
      stat = await fs.promises.stat(uri);
    } catch {
      // Non-existent path: treat as no-op success
      return true;
    }

    if (stat.isDirectory()) {
      // Read directory and recurse. If any child returns false, aggregate to false.
      const entries = await fs.promises.readdir(uri);
      let allOk = true;
      for (const file of entries) {
        const filePath = path.join(uri, file);
        const ok = await this.fetch(filePath, onDocument);
        if (!ok) {
          allOk = false;
        }
      }
      return allOk;
    } else {
      // Read file and invoke onDocument
      const text = await fs.promises.readFile(uri, 'utf8');
      const ext = path.extname(uri);
      const docType =
        ext && ext.length > 1
          ? ext.slice(1).toLowerCase()
          : path.basename(uri).toLowerCase();

      return await onDocument(uri, text, docType);
    }
  }
}
