import { describe, it } from 'mocha';
import * as assert from 'node:assert';
import { LocalDocumentResult } from './LocalDocumentResult';
import { Tokenizer, QueryResult, DocumentChunkMetadata } from './types';

// Deterministic character tokenizer: 1 token per char, round-trips exactly
const charTokenizer: Tokenizer = {
  encode(text: string): number[] {
    return Array.from(text).map(c => c.codePointAt(0)!);
  },
  decode(tokens: number[]): string {
    return String.fromCodePoint(...tokens);
  }
};

const CONNECTOR = '\n\n...\n\n';
const CONNECTOR_LEN = CONNECTOR.length;

function q(startPos: number, endPos: number, score: number, isBm25?: boolean): QueryResult<DocumentChunkMetadata> {
  return {
    score,
    item: { 
      id: `c_${startPos}_${endPos}_${score}_${isBm25 ? 'bm' : 'sem'}`,
      metadata: { startPos, endPos, isBm25 } as any,
      vector: [],
      norm: 0
    }
  } as any;
}

function makeResult(doc: string, chunks: QueryResult<DocumentChunkMetadata>[]) {
  const res = new LocalDocumentResult({} as any, 'id-1', 'doc://test', chunks, charTokenizer);
  (res as any).loadText = async () => doc;
  (res as any).getLength = async () => charTokenizer.encode(doc).length;
  return res;
}

function tokensOf(s: string) {
  return charTokenizer.encode(s).length;
}

function sliceDoc(doc: string, startPos: number, endPos: number) {
  return doc.slice(startPos, endPos + 1);
}

describe('LocalDocumentResult - full coverage', () => {
  const doc = '0123456789'.repeat(22); // length 220

  describe('constructor and getters', () => {
    it('computes average score across chunks and exposes chunks getter', () => {
      const chunks = [q(0, 9, 0.2), q(20, 29, 0.6)];
      const res = makeResult(doc, chunks);
      assert.strictEqual(res.score, 0.4); // (0.2 + 0.6) / 2
      assert.strictEqual(res.chunks, chunks);
    });

    it('single chunk score passthrough', () => {
      const chunks = [q(5, 15, 0.9)];
      const res = makeResult(doc, chunks);
      assert.strictEqual(res.score, 0.9);
      assert.strictEqual(res.chunks.length, 1);
    });
  });

  describe('renderAllSections', () => {
    it('no splitting needed -> returns one section mirroring the chunk', async () => {
      const c = q(10, 19, 0.75);
      const res = makeResult(doc, [c]);
      const maxTokens = 20; // chunk len = 10
      const sections = await res.renderAllSections(maxTokens);
      assert.strictEqual(sections.length, 1);
      const expectedText = sliceDoc(doc, 10, 19);
      assert.strictEqual(sections[0].text, expectedText);
      assert.strictEqual(sections[0].tokenCount, tokensOf(expectedText));
      assert.strictEqual(+sections[0].score.toFixed(6), +c.score.toFixed(6));
      assert.strictEqual(sections[0].isBm25, false);
    });

    it('splits an oversized chunk into multiple parts and packs under budget', async () => {
      // One large chunk of 35 chars, budget 10
      const start = 30;
      const end = 64; // inclusive => len 35
      const c = q(start, end, 0.5);
      const res = makeResult(doc, [c]);
      const sections = await res.renderAllSections(10);

      // Each section must respect budget; with typical packing rule, we expect multiple sections
      assert.ok(sections.length >= 3);
      for (const s of sections) {
        assert.ok(s.tokenCount <= 10);
        // All parts share same score; averaging over itself should be the same
        assert.strictEqual(+s.score.toFixed(6), +0.5.toFixed(6));
      }

      // Concatenate all section texts should reconstruct the original chunk text in order
      const got = sections.map(s => s.text).join('');
      assert.strictEqual(got, sliceDoc(doc, start, end));
    });

    it('sorts chunks by startPos and normalizes scores when packing', async () => {
      // Two small chunks out of order; both fit into a single section under budget
      const a = q(80, 84, 0.2);  // "01234" (len 5)
      const b = q(70, 74, 0.8);  // "01234" (len 5), earlier in doc
      const res = makeResult(doc, [a, b]);
      const sections = await res.renderAllSections(15); // 5 + 5 fits
      assert.strictEqual(sections.length, 1);

      // Should be in document order: b (70..74) then a (80..84)
      const expected = sliceDoc(doc, 70, 74) + sliceDoc(doc, 80, 84);
      assert.strictEqual(sections[0].text, expected);
      // Score is arithmetic mean of chunk scores
      assert.strictEqual(+sections[0].score.toFixed(6), +((0.8 + 0.2) / 2).toFixed(6));
    });
  });

  describe('renderSections', () => {
    it('whole-document short-circuit when doc length <= maxTokens', async () => {
      const res = makeResult(doc, [q(0, 9, 0.1)]);
      (res as any).getLength = async () => tokensOf(doc); // ensure getLength matches
      const sections = await res.renderSections(tokensOf(doc), 3, true);
      assert.strictEqual(sections.length, 1);
      assert.strictEqual(sections[0].text, doc);
      assert.strictEqual(sections[0].tokenCount, tokensOf(doc));
      assert.strictEqual(+sections[0].score.toFixed(6), +1.0.toFixed(6));
      assert.strictEqual(sections[0].isBm25, false);
    });

    it('all candidate chunks filtered out -> fallback to top chunk, exactly maxTokens tokens', async () => {
      // Two big chunks, both > maxTokens; filter removes them; fallback to top score (0.9)
      const big1 = q(10, 90, 0.9);
      const big2 = q(100, 190, 0.2);
      const res = makeResult(doc, [big2, big1]); // out of score order intentionally
      const maxTokens = 25;
      const sections = await res.renderSections(maxTokens, 2, true);
      assert.strictEqual(sections.length, 1);
      const s = sections[0];
      assert.strictEqual(s.tokenCount, maxTokens);
      assert.strictEqual(+s.score.toFixed(6), +0.9.toFixed(6));
      assert.strictEqual(s.isBm25, false);
      // Should be exactly the first maxTokens tokens from the top chunk's span
      const topSpan = sliceDoc(doc, big1.item.metadata!.startPos!, big1.item.metadata!.endPos!);
      assert.strictEqual(s.text, charTokenizer.decode(charTokenizer.encode(topSpan).slice(0, maxTokens)));
    });

    it('separates semantic and BM25 sections and averages scores', async () => {
      // Build mixes that will produce at least two sections each under tight budgets
      const sem1 = q(10, 24, 0.6, undefined);  // 15 chars
      const sem2 = q(40, 54, 0.4, false);      // 15 chars
      const bm1  = q(80,  94, 0.7, true);      // 15 chars
      const bm2  = q(110,124, 0.5, true);      // 15 chars

      const res = makeResult(doc, [sem2, bm2, sem1, bm1]); // scrambled
      const maxTokens = 12; // forces splitting into multiple sections
      const sections = await res.renderSections(maxTokens, 10, true);

      // Basic sanity: should include both semantic (isBm25=false) and bm25 (isBm25=true)
      const haveSem = sections.some(s => !s.isBm25);
      const haveBm  = sections.some(s =>  s.isBm25);
      assert.ok(haveSem && haveBm);

      // Scores should be averaged within each produced section
      for (const s of sections) {
        assert.ok(s.score >= 0 && s.score <= 1);
        assert.ok(s.tokenCount <= maxTokens);
      }
    });

    it('limits per-list by maxSections and sorts by score desc; semantic before BM25', async () => {
      const semA = q(10, 29, 0.1, false);
      const semB = q(30, 49, 0.9, false);
      const semC = q(50, 69, 0.5, false);
      const bmA  = q(80,  99, 0.8, true);
      const bmB  = q(100,119, 0.3, true);
      const bmC  = q(120,139, 0.7, true);

      const res = makeResult(doc, [semA, semB, semC, bmA, bmB, bmC]);
      const sections = await res.renderSections(30, 1, true); // only 1 per list

      // Expect exactly two sections: [top semantic], [top bm25]
      assert.strictEqual(sections.length, 2);
      assert.strictEqual(sections[0].isBm25, false);
      assert.strictEqual(sections[1].isBm25, true);
      // Top semantic is semB (~0.9), top bm25 is bmA (~0.8)
      assert.ok(sections[0].score >= sections[1].score);
      assert.ok(sections[0].score >= 0.8);
    });

    it('merges adjacent chunks where endPos + 1 === next.startPos', async () => {
      // Two adjacent semantic chunks should be merged before connector insertion
      const a = q(20, 29, 0.6, false);
      const b = q(30, 39, 0.6, false); // adjacent to a
      const res = makeResult(doc, [a, b]);
      const sections = await res.renderSections(40, 3, false); // overlapping=false to avoid connectors
      assert.strictEqual(sections.length, 1);
      const s = sections[0];

      // Expect a single contiguous text without connector, covering 20..39
      const expected = sliceDoc(doc, 20, 39);
      assert.strictEqual(s.text, expected);
      assert.strictEqual(s.tokenCount, tokensOf(expected));
    });

    it('overlappingChunks=false inserts no connectors or expansions', async () => {
      const a = q(50, 54, 0.3, false); // 5
      const b = q(60, 64, 0.7, false); // 5 (gap -> not merged)
      const res = makeResult(doc, [a, b]);
      const sections = await res.renderSections(30, 2, false);
      assert.strictEqual(sections.length, 1);
      const s = sections[0];

      const expected = sliceDoc(doc, 50, 54) + sliceDoc(doc, 60, 64);
      assert.strictEqual(s.text, expected);
      assert.strictEqual(s.tokenCount, tokensOf(expected));
      assert.ok(!s.text.includes('...'));
    });

    it('overlappingChunks=true with small remaining budget inserts connectors only', async () => {
      const a = q(70, 79, 0.4, false); // 10
      const b = q(90, 99, 0.6, false); // 10
      const res = makeResult(doc, [a, b]);

      // Budget just fits two chunks + connector; remaining <= 40 triggers no before/after expansion
      const maxTokens = 10 + 10 + CONNECTOR_LEN;
      const sections = await res.renderSections(maxTokens, 2, true);
      assert.strictEqual(sections.length, 1);
      const s = sections[0];

      const expected = sliceDoc(doc, 70, 79) + CONNECTOR + sliceDoc(doc, 90, 99);
      assert.strictEqual(s.text, expected);
      assert.strictEqual(s.tokenCount, tokensOf(expected));
    });

    it('overlappingChunks=true with large budget adds both-side expansion via encodeBefore/After', async () => {
      // Place the section away from doc edges to allow both before/after context
      const a = q(100, 109, 0.5, false); // 10
      const b = q(120, 129, 0.5, false); // 10 (gap to ensure not merged)
      const res = makeResult(doc, [a, b]);

      const maxTokens = 120; // generous budget -> remaining > 40
      const sections = await res.renderSections(maxTokens, 2, true);
      assert.strictEqual(sections.length, 1);
      const s = sections[0];

      // Should include connector and added before/after context
      const baseInner = sliceDoc(doc, 100, 109) + CONNECTOR + sliceDoc(doc, 120, 129);
      assert.ok(s.text.includes(baseInner)); // inner appears within expanded text
      assert.ok(s.tokenCount > tokensOf(baseInner)); // expansion increases tokenCount

      // Validate "before" expansion is tail of doc[0..firstChunkStart)
      const firstChunkStart = 100;
      const beforeRegion = doc.slice(0, firstChunkStart);
      const beforeInsertedLen = s.text.indexOf(sliceDoc(doc, 100, 109)); // prefix length
      assert.ok(beforeInsertedLen > 0, 'should have non-empty before context');

      const expectedBeforeTail = beforeRegion.slice(beforeRegion.length - beforeInsertedLen);
      assert.strictEqual(s.text.slice(0, beforeInsertedLen), expectedBeforeTail);

      // Validate "after" expansion is head of doc[(lastChunkEnd+1)..end)
      const lastChunkEnd = 129;
      const afterRegion = doc.slice(lastChunkEnd + 1);
      const afterStartInSection = s.text.indexOf(sliceDoc(doc, 120, 129)) + tokensOf(sliceDoc(doc, 120, 129)) + s.text.split(baseInner)[1].indexOf(sliceDoc(doc, 120, 129)) >= 0 ? (s.text.lastIndexOf(sliceDoc(doc, 120, 129)) + tokensOf(sliceDoc(doc, 120, 129))) : (s.text.indexOf(sliceDoc(doc, 120, 129)) + tokensOf(sliceDoc(doc, 120, 129)));
      // Find suffix length as trailing after-context
      const afterInsertedLen = s.text.length - (s.text.lastIndexOf(sliceDoc(doc, 120, 129)) + tokensOf(sliceDoc(doc, 120, 129)));
      assert.ok(afterInsertedLen > 0, 'should have non-empty after context');
      const expectedAfterHead = afterRegion.slice(0, afterInsertedLen);
      assert.strictEqual(s.text.slice(-afterInsertedLen), expectedAfterHead);

      // Indirect helper constraints: before chunk not exceeding half of remaining and after chunk <= remaining
      // Compute total budgets actually used for expansions:
      const usedBefore = beforeInsertedLen;
      const usedAfter = afterInsertedLen;
      const remain = maxTokens - tokensOf(baseInner);
      assert.ok(remain > 40, 'scenario must have large remaining budget');
      assert.ok(usedBefore <= Math.ceil(remain / 2));
      assert.ok(usedAfter <= remain);
    });

    it('undefined isBm25 metadata is treated as semantic', async () => {
      const semUndef = { 
        item: { id: 'x', metadata: { startPos: 10, endPos: 19 } } as any 
      , score: 0.9 };
      const res = makeResult(doc, [semUndef]);
      const sections = await res.renderSections(50, 3, true);
      assert.ok(sections.length >= 1);
      assert.strictEqual(sections[0].isBm25, false);
    });
  });
});