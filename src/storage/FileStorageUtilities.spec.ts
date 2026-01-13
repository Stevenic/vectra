import assert from 'node:assert/strict';
import sinon from 'sinon';
import { FileStorageUtilities } from './FileStorageUtilities';
import type { FileStorage } from './FileStorage';

describe('FileStorageUtilities', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('ensureFolderExists', () => {
    it('does not create the folder when it already exists', async () => {
      const folderPath = '/already/there';
      const storage = {
        pathExists: sinon.stub().resolves(true),
        createFolder: sinon.stub(),
      } as unknown as FileStorage;

      await FileStorageUtilities.ensureFolderExists(storage, folderPath);

      sinon.assert.calledOnceWithExactly((storage as any).pathExists, folderPath);
      sinon.assert.notCalled((storage as any).createFolder);
    });

    it('creates the folder when it does not exist', async () => {
      const folderPath = '/needs/creation';
      const storage = {
        pathExists: sinon.stub().resolves(false),
        createFolder: sinon.stub().resolves(),
      } as unknown as FileStorage;

      await FileStorageUtilities.ensureFolderExists(storage, folderPath);

      sinon.assert.calledOnceWithExactly((storage as any).pathExists, folderPath);
      sinon.assert.calledOnceWithExactly((storage as any).createFolder, folderPath);
    });
  });

  describe('getFileType', () => {
    it('returns type for known extension (lowercase)', () => {
      assert.strictEqual(FileStorageUtilities.getFileType('/any/path/file.txt'), 'txt');
    });

    it('returns type for known extension (case-insensitive)', () => {
      assert.strictEqual(FileStorageUtilities.getFileType('/any/path/FILE.TXT'), 'txt');
    });

    it('returns undefined for unknown extension', () => {
      assert.strictEqual(FileStorageUtilities.getFileType('/any/path/file.unknown'), undefined);
    });

    it('returns undefined when no extension', () => {
      assert.strictEqual(FileStorageUtilities.getFileType('/any/path/filename'), undefined);
    });

    it('returns undefined for trailing dot', () => {
      assert.strictEqual(FileStorageUtilities.getFileType('/any/path/file.'), undefined);
    });
  });

  describe('getFileTypeFromContentType', () => {
    it('returns mapped type when content type is directly mapped', () => {
      assert.strictEqual(FileStorageUtilities.getFileTypeFromContentType('text/plain'), 'txt');
    });

    it('falls back to subtype when not directly mapped', () => {
      // Not directly mapped but subtype is a known extension
      assert.strictEqual(FileStorageUtilities.getFileTypeFromContentType('application/png'), 'png');
    });

    it('handles "+" in subtype by using part before plus (may be unknown)', () => {
      assert.strictEqual(FileStorageUtilities.getFileTypeFromContentType('application/ld+json'), undefined);
    });

    it('returns undefined for invalid content type format (no slash)', () => {
      assert.strictEqual(FileStorageUtilities.getFileTypeFromContentType('invalid'), undefined);
    });
  });

  describe('tryDeleteFile', () => {
    it('returns undefined on successful delete', async () => {
      const filePath = '/tmp/success.bin';
      const storage = {
        deleteFile: sinon.stub().resolves(),
      } as unknown as FileStorage;

      const result = await FileStorageUtilities.tryDeleteFile(storage, filePath);

      sinon.assert.calledOnceWithExactly((storage as any).deleteFile, filePath);
      assert.strictEqual(result, undefined);
    });

    it('returns the error on failed delete', async () => {
      const filePath = '/tmp/fail.bin';
      const error = new Error('boom');
      const storage = {
        deleteFile: sinon.stub().rejects(error),
      } as unknown as FileStorage;

      const result = await FileStorageUtilities.tryDeleteFile(storage, filePath);

      sinon.assert.calledOnceWithExactly((storage as any).deleteFile, filePath);
      assert.strictEqual(result, error);
    });
  });
});