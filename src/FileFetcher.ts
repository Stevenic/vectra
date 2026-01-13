import { TextFetcher } from './types';
import * as fs from 'fs/promises';
import * as path from 'path';

export class FileFetcher implements TextFetcher {
  public async fetch(
    uri: string,
    onDocument: (uri: string, text: string, docType?: string | undefined) => Promise<boolean>
  ): Promise<boolean> {
    // If the path doesn't exist, resolve true and do not call onDocument
    let stat: { isDirectory: () => boolean };
    try {
      stat = await fs.stat(uri);
    } catch {
      return true;
    }

    if (stat.isDirectory()) {
      // Read directory and recurse. If any child returns false, aggregate to false.
      const entries = await fs.readdir(uri);
      let allOk = true;
      for (const entry of entries) {
        const childPath = path.join(uri, entry);
        const ok = await this.fetch(childPath, onDocument);
        if (!ok) {
          allOk = false;
        }
      }
      return allOk;
    } else {
      // Read file and invoke onDocument
      const text = await fs.readFile(uri, 'utf8');
      const ext = path.extname(uri);
      const docType = ext ? ext.slice(1).toLowerCase() : path.basename(uri).toLowerCase();
      return onDocument(uri, text, docType);
    }
  }
} 