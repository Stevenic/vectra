import { describe, it } from 'mocha';
import * as assert from 'node:assert';
import { TextSplitter } from './TextSplitter';

describe('TextSplitter', () => {
  const makeSplitter = (opts?: Partial<ConstructorParameters<typeof TextSplitter>[0]>) =>
    new TextSplitter({ chunkSize: 16, chunkOverlap: 0, ...opts });

  it('keeps a leading punctuation-only chunk ("---")', () => {
    const splitter = makeSplitter({ chunkSize: 3, chunkOverlap: 0 });
    const chunks = splitter.split('---');
    assert.deepStrictEqual(chunks.map(c => c.text), ['---']);
  });

  it('keeps punctuation-only separators (---, ***, ====) at start, middle, and end', () => {
    const splitter = makeSplitter({ chunkSize: 4, chunkOverlap: 0 });
    const text = ['---', 'Hello world', '***', 'Middle', '===='].join('\n');
    const chunks = splitter.split(text);

    assert.ok(chunks.some(c => c.text.includes('---')));
    assert.ok(chunks.some(c => c.text.includes('***')));
    assert.ok(chunks.some(c => c.text.includes('====')));
  });

  it('preserves frontmatter delimiters when chunk size is small and overlap is zero', () => {
    const splitter = makeSplitter({ chunkSize: 12, chunkOverlap: 0 });
    const md = [
      '---',
      'title: Test',
      'tags: [a, b]',
      '---',
      '# Heading',
      'Body text goes here.'
    ].join('\n');

    const chunks = splitter.split(md);
    const joined = chunks.map(c => c.text).join('\n');

    const delimiterCount = (joined.match(/^---$/gm) ?? []).length;
    assert.strictEqual(delimiterCount, 2);
  });

  it('keeps trailing punctuation-only chunk', () => {
    const splitter = makeSplitter({ chunkSize: 4, chunkOverlap: 0 });
    const chunks = splitter.split('Content\n---');
    assert.ok(chunks.some(c => c.text.includes('---')));
  });

  it('drops pure whitespace-only chunks', () => {
    const splitter = makeSplitter({ chunkSize: 10, chunkOverlap: 0 });
    const chunks1 = splitter.split('   \t  ');
    const chunks2 = splitter.split('\n\n');
    const chunks3 = splitter.split(' \n \n  ');
    assert.strictEqual(chunks1.length, 0);
    assert.strictEqual(chunks2.length, 0);
    assert.strictEqual(chunks3.length, 0);
  });

  it('still returns alphanumeric chunks normally', () => {
    const splitter = makeSplitter({ chunkSize: 5, chunkOverlap: 0 });
    const chunks = splitter.split('abcde fghij');
    assert.ok(chunks.length > 0);
    assert.ok(chunks.map(c => c.text).join(' ').includes('abcde'));
    assert.ok(chunks.map(c => c.text).join(' ').includes('fghij'));
  });

  it('does not regress with non-zero overlap', () => {
    const splitter = makeSplitter({ chunkSize: 5, chunkOverlap: 2 });
    const chunks = splitter.split('---\nabcdef');
    assert.ok(chunks.some(c => c.text.includes('---')));
  });

  it('handles multiple punctuation-only separators interleaved with content', () => {
    const splitter = makeSplitter({ chunkSize: 8, chunkOverlap: 0 });
    const text = ['***', 'A', '---', 'B', '====', 'C'].join('\n');
    const chunks = splitter.split(text);

    assert.ok(chunks.some(c => c.text.includes('***')));
    assert.ok(chunks.some(c => c.text.includes('---')));
    assert.ok(chunks.some(c => c.text.includes('====')));

    const joined = chunks.map(c => c.text).join('\n');
    assert.ok(joined.includes('\nA\n'));
    assert.ok(joined.includes('\nB\n'));
    assert.ok(joined.includes('\nC'));
  });
});
