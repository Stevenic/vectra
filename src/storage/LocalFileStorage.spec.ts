import assert from 'node:assert';
import sinon from 'sinon';
import fs from 'fs/promises';
import path from 'path';
import { LocalFileStorage } from './LocalFileStorage';
import { FileStorageUtilities } from './FileStorageUtilities';

describe('LocalFileStorage', () => {
  let storage: LocalFileStorage;

  afterEach(async () => {
    sinon.restore();
  });

  describe('constructor and getFullPath', () => {
    it('returns relativePath if no rootFolder and relativePath non-empty', () => {
      storage = new LocalFileStorage();
      // @ts-ignore access private for test
      assert.strictEqual(storage['getFullPath']('some/path'), 'some/path');
    });

    it("returns '.' if no rootFolder and relativePath empty", () => {
      storage = new LocalFileStorage();
      // @ts-ignore access private for test
      assert.strictEqual(storage['getFullPath'](''), '.');
    });

    it('returns rootFolder if rootFolder set and relativePath empty', () => {
      storage = new LocalFileStorage('/root');
      // @ts-ignore access private for test
      assert.strictEqual(storage['getFullPath'](''), '/root');
    });

    it('joins rootFolder and relativePath if both set', () => {
      storage = new LocalFileStorage('/root');
      // @ts-ignore access private for test
      assert.strictEqual(storage['getFullPath']('sub/folder'), path.join('/root', 'sub/folder'));
    });
  });

  describe('createFile', () => {
    beforeEach(() => {
      storage = new LocalFileStorage('/root');
    });

    it('writes a new file with Buffer content', async () => {
      const writeFileStub = sinon.stub(fs, 'writeFile').resolves();
      const content = Buffer.from('hello');
      await storage.createFile('file.txt', content);
      sinon.assert.calledWith(writeFileStub, path.join('/root', 'file.txt'), content, { flag: 'wx' });
    });

    it('writes a new file with string content as UTF-8', async () => {
      const writeFileStub = sinon.stub(fs, 'writeFile').resolves();
      const content = 'hello';
      await storage.createFile('file.txt', content);
      sinon.assert.calledWith(
        writeFileStub,
        path.join('/root', 'file.txt'),
        Buffer.from(content, 'utf8'),
        { flag: 'wx' }
      );
    });

    it('bubbles up error if file already exists', async () => {
      sinon.stub(fs, 'writeFile').rejects(new Error('EEXIST'));
      await assert.rejects(async () => {
        await storage.createFile('file.txt', 'content');
      });
    });

    it('bubbles up error if parent directory does not exist', async () => {
      sinon.stub(fs, 'writeFile').rejects(new Error('ENOENT'));
      await assert.rejects(async () => {
        await storage.createFile('nonexistent/file.txt', 'content');
      });
    });
  });

  describe('createFolder', () => {
    beforeEach(() => {
      storage = new LocalFileStorage('/root');
    });

    it('creates nested directory structure recursively', async () => {
      const mkdirStub = sinon.stub(fs, 'mkdir').resolves();
      await storage.createFolder('nested/folder');
      sinon.assert.calledWith(mkdirStub, path.join('/root', 'nested/folder'), { recursive: true });
    });

    it('calling again on same path still calls mkdir (idempotent due to recursive:true)', async () => {
      const mkdirStub = sinon.stub(fs, 'mkdir').resolves();
      await storage.createFolder('nested/folder');
      await storage.createFolder('nested/folder');
      sinon.assert.calledTwice(mkdirStub);
    });
  });

  describe('deleteFile', () => {
    beforeEach(() => {
      storage = new LocalFileStorage('/root');
    });

    it('deletes existing file', async () => {
      const unlinkStub = sinon.stub(fs, 'unlink').resolves();
      await storage.deleteFile('file.txt');
      sinon.assert.calledWith(unlinkStub, path.join('/root', 'file.txt'));
    });

    it('bubbles up error when file does not exist', async () => {
      sinon.stub(fs, 'unlink').rejects(new Error('ENOENT'));
      await assert.rejects(async () => {
        await storage.deleteFile('missing.txt');
      });
    });
  });

  describe('deleteFolder', () => {
    beforeEach(() => {
      storage = new LocalFileStorage('/root');
    });

    it('deletes existing folder recursively', async () => {
      const rmStub = sinon.stub(fs, 'rm').resolves();
      await storage.deleteFolder('folder');
      sinon.assert.calledWith(rmStub, path.join('/root', 'folder'), { recursive: true });
    });

    it('bubbles up error when folder does not exist', async () => {
      sinon.stub(fs, 'rm').rejects(new Error('ENOENT'));
      await assert.rejects(async () => {
        await storage.deleteFolder('missing');
      });
    });
  });

  describe('getDetails', () => {
    beforeEach(() => {
      storage = new LocalFileStorage('/root');
    });

    it('returns correct details for file', async () => {
      const statStub = sinon.stub(fs, 'stat').resolves({
        isDirectory: () => false,
        isFile: () => true,
      } as any);
      const getFileTypeStub = sinon.stub(FileStorageUtilities, 'getFileType').returns('txt');

      const details = await storage.getDetails('file.txt');
      assert.strictEqual(details.name, 'file.txt');
      assert.strictEqual(details.path, 'file.txt');
      assert.strictEqual(details.isFolder, false);
      assert.strictEqual(details.fileType, 'txt');

      sinon.assert.calledWith(statStub, path.join('/root', 'file.txt'));
      sinon.assert.calledWith(getFileTypeStub, 'file.txt');
    });

    it('returns correct details for folder', async () => {
      sinon.stub(fs, 'stat').resolves({
        isDirectory: () => true,
        isFile: () => false,
      } as any);

      const details = await storage.getDetails('folder');
      assert.strictEqual(details.name, 'folder');
      assert.strictEqual(details.path, 'folder');
      assert.strictEqual(details.isFolder, true);
      assert.strictEqual(details.fileType, undefined);
    });

    it('bubbles up error for non-existent path', async () => {
      sinon.stub(fs, 'stat').rejects(new Error('ENOENT'));
      await assert.rejects(async () => {
        await storage.getDetails('missing');
      });
    });
  });

  describe('listFiles', () => {
    beforeEach(() => {
      storage = new LocalFileStorage('/root');
    });

    it('returns entries for folder with files and subfolders', async () => {
      const dirents = [
        { name: 'file1.txt', isDirectory: () => false, isFile: () => true },
        { name: 'subfolder', isDirectory: () => true, isFile: () => false },
      ];
      sinon.stub(fs, 'readdir').resolves(dirents as any);
      const getFileTypeStub = sinon.stub(FileStorageUtilities, 'getFileType').callsFake((name: string) => {
        if (name === 'file1.txt') return 'txt';
        return undefined;
      });

      const results = await storage.listFiles('folder');
      assert.strictEqual(results.length, 2);

      assert.strictEqual(results[0].name, 'file1.txt');
      assert.strictEqual(results[0].path, path.join('/root', 'folder', 'file1.txt'));
      assert.strictEqual(results[0].isFolder, false);
      assert.strictEqual(results[0].fileType, 'txt');

      assert.strictEqual(results[1].name, 'subfolder');
      assert.strictEqual(results[1].path, path.join('/root', 'folder', 'subfolder'));
      assert.strictEqual(results[1].isFolder, true);
      assert.strictEqual(results[1].fileType, undefined);

      sinon.assert.calledWith(getFileTypeStub, 'file1.txt');
    });

    it('ignores filter argument', async () => {
      sinon.stub(fs, 'readdir').resolves([]);
      const results = await storage.listFiles('folder', { any: true } as any);
      assert.ok(Array.isArray(results));
      assert.strictEqual(results.length, 0);
    });
  });

  describe('pathExists', () => {
    beforeEach(() => {
      storage = new LocalFileStorage('/root');
    });

    it('returns true for existing file or folder', async () => {
      sinon.stub(fs, 'access').resolves();
      const exists = await storage.pathExists('file.txt');
      assert.strictEqual(exists, true);
    });

    it('returns false for non-existent path', async () => {
      sinon.stub(fs, 'access').rejects(new Error('ENOENT'));
      const exists = await storage.pathExists('missing');
      assert.strictEqual(exists, false);
    });
  });

  describe('readFile', () => {
    beforeEach(() => {
      storage = new LocalFileStorage('/root');
    });

    it('reads and returns exact bytes', async () => {
      const content = Buffer.from('hello');
      sinon.stub(fs, 'readFile').resolves(content);
      const result = await storage.readFile('file.txt');
      assert.strictEqual(result, content);
    });

    it('bubbles up error when file does not exist', async () => {
      sinon.stub(fs, 'readFile').rejects(new Error('ENOENT'));
      await assert.rejects(async () => {
        await storage.readFile('missing.txt');
      });
    });
  });

  describe('upsertFile', () => {
    beforeEach(() => {
      storage = new LocalFileStorage('/root');
    });

    it('creates new file when absent', async () => {
      const writeFileStub = sinon.stub(fs, 'writeFile').resolves();
      await storage.upsertFile('file.txt', 'content');
      sinon.assert.calledWith(
        writeFileStub,
        path.join('/root', 'file.txt'),
        Buffer.from('content', 'utf8'),
        { flag: 'w' }
      );
    });

    it('overwrites existing file', async () => {
      const writeFileStub = sinon.stub(fs, 'writeFile').resolves();
      await storage.upsertFile('file.txt', Buffer.from('new content'));
      sinon.assert.calledWith(
        writeFileStub,
        path.join('/root', 'file.txt'),
        Buffer.from('new content'),
        { flag: 'w' }
      );
    });

    it('bubbles up error if parent directory does not exist', async () => {
      sinon.stub(fs, 'writeFile').rejects(new Error('ENOENT'));
      await assert.rejects(async () => {
        await storage.upsertFile('nonexistent/file.txt', 'content');
      });
    });
  });
});