import assert from 'node:assert';
import * as path from 'path';
import { VirtualFileStorage } from './VirtualFileStorage';
import { FileStorageUtilities } from './FileStorageUtilities';

describe('VirtualFileStorage', () => {
  let storage: VirtualFileStorage;

  beforeEach(() => {
    storage = new VirtualFileStorage();
  });

  describe('createFile', () => {
    it('creates a new file with string content', async () => {
      await storage.createFile('file.txt', 'hello');
      const details = await storage.getDetails('file.txt');
      assert.strictEqual(details.name, 'file.txt');
      assert.strictEqual(details.path, path.normalize('file.txt'));
      assert.strictEqual(details.isFolder, false);
      assert.strictEqual(
        details.fileType,
        FileStorageUtilities.getFileType(path.normalize('file.txt'))
      );
      const content = await storage.readFile('file.txt');
      assert.deepStrictEqual(content, Buffer.from('hello', 'utf8'));
    });

    it('creates a new file with Buffer content', async () => {
      const buf = Buffer.from('buffer content');
      await storage.createFile('bufferfile.bin', buf);
      const content = await storage.readFile('bufferfile.bin');
      assert.deepStrictEqual(content, buf);
    });

    it('throws when file already exists (including folder at path)', async () => {
      await storage.createFile('dup.txt', 'content');
      await assert.rejects(async () => {
        await storage.createFile('dup.txt', 'new content');
      }, /File already exists/);

      await storage.createFolder('folder');
      await assert.rejects(async () => {
        await storage.createFile('folder', 'content');
      }, /File already exists/);
    });

    it('throws when creating file with normalized duplicate path', async () => {
      await storage.createFile('a/../b/file.txt', 'content');
      await assert.rejects(async () => {
        await storage.createFile('b/file.txt', 'content');
      }, /File already exists/);
    });
  });

  describe('createFolder', () => {
    it('creates a new folder', async () => {
      await storage.createFolder('myfolder');
      const details = await storage.getDetails('myfolder');
      assert.strictEqual(details.name, 'myfolder');
      assert.strictEqual(details.isFolder, true);
      assert.strictEqual(details.fileType, undefined);
    });

    it('is idempotent when folder already exists', async () => {
      await storage.createFolder('myfolder');
      await storage.createFolder('myfolder'); // no error
    });

    it('throws when a file exists at that path', async () => {
      await storage.createFile('file.txt', 'content');
      await assert.rejects(async () => {
        await storage.createFolder('file.txt');
      }, /Cannot create folder/);
    });

    it('does not create parent folders automatically', async () => {
      // Implementation creates only the explicit folder entry
      await storage.createFolder('parent/child');

      // Only 'parent/child' exists, not 'parent'
      await assert.rejects(async () => {
        await storage.getDetails('parent');
      }, /Path not found/);

      const details = await storage.getDetails('parent/child');
      assert.strictEqual(details.isFolder, true);
    });
  });

  describe('deleteFile', () => {
    it('deletes an existing file', async () => {
      await storage.createFile('file.txt', 'content');
      await storage.deleteFile('file.txt');
      const exists = await storage.pathExists('file.txt');
      assert.strictEqual(exists, false);
      await assert.rejects(async () => {
        await storage.readFile('file.txt');
      }, /File not found/);
    });

    it('throws when deleting a folder as file', async () => {
      await storage.createFolder('folder');
      await assert.rejects(async () => {
        await storage.deleteFile('folder');
      }, /Cannot delete file/);
    });

    it('no error when deleting non-existent file', async () => {
      await storage.deleteFile('nonexistent');
    });
  });

  describe('deleteFolder', () => {
    it('deletes an existing folder', async () => {
      await storage.createFolder('folder');
      await storage.deleteFolder('folder');
      const exists = await storage.pathExists('folder');
      assert.strictEqual(exists, false);
    });

    it('throws when deleting a file as folder', async () => {
      await storage.createFile('file.txt', 'content');
      await assert.rejects(async () => {
        await storage.deleteFolder('file.txt');
      }, /Cannot delete folder/);
    });

    it('no error when deleting non-existent folder', async () => {
      await storage.deleteFolder('nonexistent');
    });

    it('does not delete children when deleting folder', async () => {
      await storage.createFolder('parent');
      await storage.createFile('parent/child.txt', 'content');
      await storage.deleteFolder('parent');

      // Parent deleted
      const parentExists = await storage.pathExists('parent');
      assert.strictEqual(parentExists, false);

      // Child still exists
      const childExists = await storage.pathExists('parent/child.txt');
      assert.strictEqual(childExists, true);
    });
  });

  describe('getDetails', () => {
    it('returns details for existing file', async () => {
      await storage.createFile('file.txt', 'content');
      const details = await storage.getDetails('file.txt');
      assert.strictEqual(details.name, 'file.txt');
      assert.strictEqual(details.path, path.normalize('file.txt'));
      assert.strictEqual(details.isFolder, false);
      assert.strictEqual(
        details.fileType,
        FileStorageUtilities.getFileType(path.normalize('file.txt'))
      );
    });

    it('returns details for existing folder', async () => {
      await storage.createFolder('folder');
      const details = await storage.getDetails('folder');
      assert.strictEqual(details.name, 'folder');
      assert.strictEqual(details.path, path.normalize('folder'));
      assert.strictEqual(details.isFolder, true);
      assert.strictEqual(details.fileType, undefined);
    });

    it('throws for non-existent path', async () => {
      await assert.rejects(async () => {
        await storage.getDetails('missing');
      }, /Path not found/);
    });
  });

  describe('listFiles', () => {
    beforeEach(async () => {
      await storage.createFolder('a');
      await storage.createFolder('a/b');
      await storage.createFile('a/file1.txt', 'content1');
      await storage.createFile('a/b/file2.txt', 'content2');
      await storage.createFolder('c');
      await storage.createFile('fileRoot.txt', 'root');
    });

    it('returns immediate children only', async () => {
      const listA = await storage.listFiles('a');
      assert(listA.some(e => e.name === 'file1.txt'));
      assert(listA.some(e => e.name === 'b'));
      assert(!listA.some(e => e.name === 'file2.txt'));

      const listRoot = await storage.listFiles('');
      assert(listRoot.some(e => e.name === 'a'));
      assert(listRoot.some(e => e.name === 'c'));
      assert(listRoot.some(e => e.name === 'fileRoot.txt'));
    });

    it('respects filter "all"', async () => {
      const all = await storage.listFiles('a', 'all');
      assert(all.some(e => e.isFolder));
      assert(all.some(e => !e.isFolder));
    });

    it('respects filter "files"', async () => {
      const files = await storage.listFiles('a', 'files');
      assert(files.every(e => !e.isFolder));
      assert(files.some(e => e.name === 'file1.txt'));
      assert(!files.some(e => e.name === 'b'));
    });

    it('respects filter "folders"', async () => {
      const folders = await storage.listFiles('a', 'folders');
      assert(folders.every(e => e.isFolder));
      assert(folders.some(e => e.name === 'b'));
      assert(!folders.some(e => e.name === 'file1.txt'));
    });

    it('normalizes folderPath', async () => {
      const list1 = await storage.listFiles('a/');
      const list2 = await storage.listFiles('a');
      assert.deepStrictEqual(list1, list2);
    });
  });

  describe('pathExists', () => {
    it('returns true for existing file and folder', async () => {
      await storage.createFile('file.txt', 'content');
      await storage.createFolder('folder');
      assert.strictEqual(await storage.pathExists('file.txt'), true);
      assert.strictEqual(await storage.pathExists('folder'), true);
    });

    it('returns false for missing path', async () => {
      assert.strictEqual(await storage.pathExists('missing'), false);
    });
  });

  describe('readFile', () => {
    it('returns exact Buffer written', async () => {
      const buf = Buffer.from('data');
      await storage.createFile('file.txt', buf);
      const read = await storage.readFile('file.txt');
      assert.deepStrictEqual(read, buf);
    });

    it('throws when path does not exist', async () => {
      await assert.rejects(async () => {
        await storage.readFile('missing.txt');
      }, /File not found/);
    });

    it('throws when path is a folder', async () => {
      await storage.createFolder('folder');
      await assert.rejects(async () => {
        await storage.readFile('folder');
      }, /Cannot read file/);
    });

    it('returns empty buffer if content is undefined (forced)', async () => {
      // Force an entry with undefined content to hit the fallback branch
      (storage as any)._entries.set('emptyfile.txt', {
        details: {
          name: 'emptyfile.txt',
          path: path.normalize('emptyfile.txt'),
          isFolder: false,
          fileType: FileStorageUtilities.getFileType(path.normalize('emptyfile.txt')),
        },
        content: undefined,
      });
      const content = await storage.readFile('emptyfile.txt');
      assert.deepStrictEqual(content, Buffer.from('', 'utf8'));
    });
  });

  describe('upsertFile', () => {
    it('creates new file when missing with string content', async () => {
      await storage.upsertFile('newfile.txt', 'content');
      const details = await storage.getDetails('newfile.txt');
      assert.strictEqual(details.isFolder, false);
      assert.strictEqual(
        details.fileType,
        FileStorageUtilities.getFileType(path.normalize('newfile.txt'))
      );
      const content = await storage.readFile('newfile.txt');
      assert.deepStrictEqual(content, Buffer.from('content', 'utf8'));
    });

    it('replaces content of existing file and keeps correct fileType', async () => {
      await storage.createFile('file.txt', 'old');
      await storage.upsertFile('file.txt', Buffer.from('new'));
      const content = await storage.readFile('file.txt');
      assert.deepStrictEqual(content, Buffer.from('new'));
      const details = await storage.getDetails('file.txt');
      assert.strictEqual(
        details.fileType,
        FileStorageUtilities.getFileType(path.normalize('file.txt'))
      );
    });

    it('throws when a folder exists at that path', async () => {
      await storage.createFolder('folder');
      await assert.rejects(async () => {
        await storage.upsertFile('folder', 'content');
      }, /Cannot write file/);
    });
  });
});