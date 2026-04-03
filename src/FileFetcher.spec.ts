import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import fs from 'node:fs';
import * as path from 'path';
import { FileFetcher } from './FileFetcher';

describe('FileFetcher', () => {
  let fetcher: FileFetcher;

  let statStub: sinon.SinonStub;
  let readdirStub: sinon.SinonStub;
  let readFileStub: sinon.SinonStub;

  beforeEach(() => {
    statStub = sinon.stub(fs.promises, 'stat') as sinon.SinonStub;
    readdirStub = sinon.stub(fs.promises, 'readdir') as sinon.SinonStub;
    readFileStub = sinon.stub(fs.promises, 'readFile') as sinon.SinonStub;

    fetcher = new FileFetcher();
  });

  afterEach(() => {
    sinon.restore();
  });

  it('resolves true when the path does not exist and does not call onDocument', async () => {
    statStub.rejects(new Error('not found'));
    const onDocument = sinon.fake.resolves(true);

    const result = await fetcher.fetch('/nonexistent', onDocument);

    assert.equal(result, true);
    assert.equal(onDocument.callCount, 0);
  });

  it('recurses a flat directory and calls fetch for each file', async () => {
    statStub.callsFake(async (uri: string) => {
      if (uri === '/dir') return { isDirectory: () => true };
      if (uri === path.join('/dir', 'file1.txt')) return { isDirectory: () => false };
      if (uri === path.join('/dir', 'file2.md')) return { isDirectory: () => false };
      return { isDirectory: () => false };
    });
    readdirStub.callsFake(async (uri: string) => {
      if (uri === '/dir') return ['file1.txt', 'file2.md'];
      return [];
    });
    readFileStub.resolves('content');

    const fetchSpy = sinon.spy(fetcher, 'fetch');
    const onDocument = sinon.fake.resolves(true);

    const result = await fetcher.fetch('/dir', onDocument);

    assert.equal(result, true);
    assert.equal(fetchSpy.callCount, 3); // root + 2 files
    assert(fetchSpy.calledWith(path.join('/dir', 'file1.txt'), sinon.match.func));
    assert(fetchSpy.calledWith(path.join('/dir', 'file2.md'), sinon.match.func));
    assert.equal(onDocument.callCount, 2);
    assert(onDocument.calledWith(path.join('/dir', 'file1.txt'), 'content', 'txt'));
    assert(onDocument.calledWith(path.join('/dir', 'file2.md'), 'content', 'md'));
  });

  it('reads a file and passes correct args to onDocument (uri, text, docType)', async () => {
    statStub.resolves({ isDirectory: () => false });
    readFileStub.resolves('file content');

    const onDocument = sinon.fake.resolves(true);
    const result = await fetcher.fetch('/file.txt', onDocument);

    assert.equal(result, true);
    assert.equal(onDocument.callCount, 1);

    const [uri, text, docType] = onDocument.firstCall.args;
    assert.equal(uri, '/file.txt');
    assert.equal(text, 'file content');
    assert.equal(docType, 'txt');
  });

  it('handles file with no extension by using last path segment as docType', async () => {
    statStub.resolves({ isDirectory: () => false });
    readFileStub.resolves('content');

    const onDocument = sinon.fake.resolves(true);
    const result = await fetcher.fetch('/file', onDocument);

    assert.equal(result, true);
    assert.equal(onDocument.callCount, 1);

    const [uri, text, docType] = onDocument.firstCall.args;
    assert.equal(uri, '/file');
    assert.equal(text, 'content');
    assert.equal(docType, 'file');
  });

  it('awaits onDocument and returns its boolean result (true)', async () => {
    statStub.resolves({ isDirectory: () => false });
    readFileStub.resolves('text');

    const onDocumentTrue = sinon.fake.resolves(true);
    const resultTrue = await fetcher.fetch('/file.txt', onDocumentTrue);

    assert.equal(resultTrue, true);
  });

  it('awaits onDocument and returns its boolean result (false)', async () => {
    statStub.resolves({ isDirectory: () => false });
    readFileStub.resolves('text');

    const onDocumentFalse = sinon.fake.resolves(false);
    const resultFalse = await fetcher.fetch('/file.txt', onDocumentFalse);

    assert.equal(resultFalse, false);
  });

  it('propagates a rejection from onDocument as a rejected promise', async () => {
    statStub.resolves({ isDirectory: () => false });
    readFileStub.resolves('text');

    const onDocument = sinon.fake.rejects(new Error('fail'));
    await assert.rejects(() => fetcher.fetch('/file.txt', onDocument), /fail/);
  });

  it('recurses nested directories and processes files at multiple depths', async () => {
    statStub.callsFake(async (uri: string) => {
      if (uri === '/dir' || uri === path.join('/dir', 'subdir')) return { isDirectory: () => true };
      return { isDirectory: () => false };
    });
    readdirStub.callsFake(async (uri: string) => {
      if (uri === '/dir') return ['file1.txt', 'subdir'];
      if (uri === path.join('/dir', 'subdir')) return ['file2.md'];
      return [];
    });
    readFileStub.resolves('content');

    const onDocument = sinon.fake.resolves(true);
    const result = await fetcher.fetch('/dir', onDocument);

    assert.equal(result, true);
    assert.equal(onDocument.callCount, 2);
    assert(onDocument.calledWith(path.join('/dir', 'file1.txt'), 'content', 'txt'));
    assert(onDocument.calledWith(path.join('/dir', 'subdir', 'file2.md'), 'content', 'md'));
  });

  it('handles an empty directory (no onDocument calls, resolves true)', async () => {
    statStub.resolves({ isDirectory: () => true });
    readdirStub.resolves([]);

    const onDocument = sinon.fake.resolves(true);
    const result = await fetcher.fetch('/emptydir', onDocument);

    assert.equal(result, true);
    assert.equal(onDocument.callCount, 0);
  });

  it('recurses directories that contain only subdirectories (no onDocument calls)', async () => {
    statStub.callsFake(async (uri: string) => {
      if (
        uri === '/dir' ||
        uri === path.join('/dir', 'subdir1') ||
        uri === path.join('/dir', 'subdir2')
      ) {
        return { isDirectory: () => true };
      }
      return { isDirectory: () => false };
    });
    readdirStub.callsFake(async (uri: string) => {
      if (uri === '/dir') return ['subdir1', 'subdir2'];
      if (uri === path.join('/dir', 'subdir1')) return [];
      if (uri === path.join('/dir', 'subdir2')) return [];
      return [];
    });

    const onDocument = sinon.fake.resolves(true);
    const result = await fetcher.fetch('/dir', onDocument);

    assert.equal(result, true);
    assert.equal(onDocument.callCount, 0);
  });

  it('rejects when readdir fails for a directory', async () => {
    statStub.resolves({ isDirectory: () => true });
    readdirStub.rejects(new Error('fail'));

    const onDocument = sinon.fake.resolves(true);
    await assert.rejects(() => fetcher.fetch('/dir', onDocument), /fail/);
  });

  it('rejects when readFile fails for a file', async () => {
    statStub.resolves({ isDirectory: () => false });
    readFileStub.rejects(new Error('fail'));

    const onDocument = sinon.fake.resolves(true);
    await assert.rejects(() => fetcher.fetch('/file.txt', onDocument), /fail/);
  });

  it('extracts docType from multi-part extensions (file.tar.gz -> gz)', async () => {
    statStub.resolves({ isDirectory: () => false });
    readFileStub.resolves('content');

    const onDocument = sinon.fake.resolves(true);
    const result = await fetcher.fetch('/file.tar.gz', onDocument);

    assert.equal(result, true);
    assert.equal(onDocument.callCount, 1);

    const [, , docType] = onDocument.firstCall.args;
    assert.equal(docType, 'gz');
  });

  it('returns false when any child in a directory returns false (aggregates to allOk=false)', async () => {
    statStub.callsFake(async (uri: string) => {
      if (uri === '/dir') return { isDirectory: () => true };
      return { isDirectory: () => false };
    });
    readdirStub.callsFake(async (uri: string) => {
      if (uri === '/dir') return ['good.txt', 'bad.txt'];
      return [];
    });
    readFileStub.resolves('content');

    const onDocument = sinon.stub();
    onDocument.callsFake(async (uri: string) => {
      if (uri === path.join('/dir', 'bad.txt')) return false;
      return true;
    });

    const result = await fetcher.fetch('/dir', onDocument);

    assert.equal(result, false);
    assert.equal(onDocument.callCount, 2);
    assert(onDocument.calledWith(path.join('/dir', 'good.txt'), 'content', 'txt'));
    assert(onDocument.calledWith(path.join('/dir', 'bad.txt'), 'content', 'txt'));
  });
});
