import { Console } from "node:console";
import { LocalDocument } from "./LocalDocument";
import { LocalDocumentIndex } from "./LocalDocumentIndex";
import { QueryResult, DocumentChunkMetadata, Tokenizer, DocumentTextSection } from "./types";

/**
 * Represents a search result for a document stored on disk.
 */
export class LocalDocumentResult extends LocalDocument {
  private readonly _chunks: QueryResult<DocumentChunkMetadata>[];
  private readonly _tokenizer: Tokenizer;
  private readonly _score: number;

  /**
   * @private
   * Internal constructor for `LocalDocumentResult` instances.
   */
  public constructor(index: LocalDocumentIndex, id: string, uri: string, chunks: QueryResult<DocumentChunkMetadata>[], tokenizer: Tokenizer) {
    super(index, id, uri);
    this._chunks = chunks;
    this._tokenizer = tokenizer;

    // Compute average score (defensive for empty arrays)
    let score = 0;
    this._chunks.forEach(chunk => score += (chunk?.score ?? 0));
    this._score = this._chunks.length > 0 ? score / this._chunks.length : 0;
  }

  /**
   * Returns the chunks of the document that matched the query.
   */
  public get chunks(): QueryResult<DocumentChunkMetadata>[] {
    return this._chunks;
  }

  /**
   * Returns the average score of the document result.
   */
  public get score(): number {
    return this._score;
  }

  /**
   * Renders all of the results chunks as spans of text (sections.)
   * @remarks
   * The returned sections will be sorted by document order and limited to maxTokens in length.
   * @param maxTokens Maximum number of tokens per section.
   * @returns Array of rendered text sections.
   */
  public async renderAllSections(maxTokens: number): Promise<DocumentTextSection[]> {
    const text = await this.loadText();

    const hasValidMeta = (m: any) =>
      m && Number.isFinite(m.startPos) && Number.isFinite(m.endPos);

    // Split all chunks into <= maxTokens pieces and then pack into sections under the same budget.
    const pieces: SectionChunk[] = [];
    for (const chunk of this._chunks) {
      if (!chunk || !hasValidMeta(chunk.item.metadata)) continue;
      chunk.item.metadata!.isBm25 = false ;;
      const startPos = chunk.item.metadata.startPos as number;
      const endPos = chunk.item.metadata.endPos as number;
      const chunkText = text.substring(startPos, endPos + 1);
      const tokens = this._tokenizer.encode(chunkText);

      let offset = 0;
      while (offset < tokens.length) {
        const len = Math.min(maxTokens, tokens.length - offset);
        pieces.push({
          text: this._tokenizer.decode(tokens.slice(offset, offset + len)),
          startPos: startPos + offset,
          endPos: startPos + offset + len - 1,
          score: chunk.score,
          tokenCount: len,
          isBm25: false
        });
        offset += len;
      }
    }

    if (pieces.length === 0) {
      return [];
    }

    pieces.sort((a, b) => a.startPos - b.startPos);

    const sections: Section[] = [];
    for (const p of pieces) {
      let sec = sections[sections.length - 1];
      if (!sec || sec.tokenCount + p.tokenCount > maxTokens) {
        sec = { chunks: [], score: 0, tokenCount: 0, contribCount: 0 };
        sections.push(sec);
      }
      sec.chunks.push(p);
      sec.score += p.score;
      sec.tokenCount += p.tokenCount;
      sec.contribCount += 1;
    }

    sections.forEach(s => {
      if (s.contribCount > 0) s.score /= s.contribCount;
    });

    return sections.map(s => ({
      text: s.chunks.map(c => c.text).join(''),
      tokenCount: s.tokenCount,
      score: s.score,
      isBm25: false
    }));
  }

  /**
   * Renders the top spans of text (sections) of the document based on the query result.
   * @remarks
   * The returned sections will be sorted by relevance and limited to the top `maxSections`.
   * @param maxTokens Maximum number of tokens per section.
   * @param maxSections Maximum number of sections to return.
   * @param overlappingChunks Optional. If true, overlapping chunks of text will be added to each section until the maxTokens is reached.
   * @returns Array of rendered text sections.
   */
  public async renderSections(maxTokens: number, maxSections: number, overlappingChunks = true): Promise<DocumentTextSection[]> {
    const text = await this.loadText();

    const hasValidMeta = (m: any) =>
      m && Number.isFinite(m.startPos) && Number.isFinite(m.endPos);

    // Whole document fits
    const length = await this.getLength();
    if (length <= maxTokens) {
      return [{
        text,
        tokenCount: length,
        score: 1.0,
        isBm25: false,
      }];
    }

    // Build candidate pieces from chunks:
    // - If a chunk fits, include as-is.
    // - If moderately oversized (<= 2x maxTokens), split into <= maxTokens pieces.
    // - If too large (> 2x), skip (so "fallback to top chunk" can still trigger).
    const candidates: SectionChunk[] = [];
    for (const qr of this._chunks) {
      if (qr && qr.item.metadata && qr.item.metadata.isBm25 == undefined) qr.item.metadata.isBm25 = false;
      if (!qr || !hasValidMeta(qr.item.metadata)) continue;

      const meta = qr.item.metadata!;
      const startPos = meta.startPos as number;
      const endPos = meta.endPos as number;
      const spanText = text.substring(startPos, endPos + 1);
      const tokens = this._tokenizer.encode(spanText);
      const tokenLen = tokens.length;
      const isBm25 = meta.isBm25 == undefined ? false : Boolean(meta.isBm25);

      if (tokenLen <= maxTokens) {
        candidates.push({
          text: spanText,
          startPos, endPos,
          score: qr.score,
          tokenCount: tokenLen,
          isBm25
        });
      } else if (tokenLen <= maxTokens * 2) {
        let offset = 0;
        while (offset < tokenLen) {
          const len = Math.min(maxTokens, tokenLen - offset);
          const piece: SectionChunk = {
            text: this._tokenizer.decode(tokens.slice(offset, offset + len)),
            startPos: startPos + offset,
            endPos: startPos + offset + len - 1,
            score: qr.score,
            tokenCount: len,
            isBm25
          };
          candidates.push(piece);
          offset += len;
        }
      } // else: too large, skip to allow fallback
    }

    // If nothing usable, fallback to the highest-scoring chunk and return its first maxTokens tokens
    if (candidates.length === 0) {
      let topWithMeta: QueryResult<DocumentChunkMetadata> | undefined;
      for (const c of this._chunks) {
        if (c && hasValidMeta(c.item.metadata)) {
          if (!topWithMeta || c.score > topWithMeta.score) {
            topWithMeta = c;
          }
        }
      }

      if (topWithMeta) {
        const s = topWithMeta.item.metadata!.startPos as number;
        const e = topWithMeta.item.metadata!.endPos as number;
        const spanText = text.substring(s, e + 1);
        const toks = this._tokenizer.encode(spanText).slice(0, maxTokens);
        return [{
          text: this._tokenizer.decode(toks),
          tokenCount: toks.length,
          score: topWithMeta.score,
          isBm25: Boolean(topWithMeta.item.metadata?.isBm25 || false)
        }];
      } else {
        // No valid metadata anywhere; fallback to beginning of the document
        const toks = this._tokenizer.encode(text).slice(0, Math.min(maxTokens, length));
        return [{
          text: this._tokenizer.decode(toks),
          tokenCount: toks.length,
          score: this._score || 1.0,
          isBm25: false
        }];
      }
    }

    // Sort by document order
    candidates.sort((a, b) => a.startPos - b.startPos);

    // Partition semantic vs BM25
    const semPieces = candidates.filter(c => !c.isBm25);
    const bmPieces = candidates.filter(c => c.isBm25);

    // Helper to pack pieces into sections up to maxTokens
    const packIntoSections = (pieces: SectionChunk[]): Section[] => {
      const secs: Section[] = [];
      for (const p of pieces) {
        let sec = secs[secs.length - 1];
        if (!sec || sec.tokenCount + p.tokenCount > maxTokens) {
          sec = { chunks: [], score: 0, tokenCount: 0, contribCount: 0 };
          secs.push(sec);
        }
        sec.chunks.push(p);
        sec.score += p.score;
        sec.tokenCount += p.tokenCount;
        sec.contribCount += 1;
      }
      // Merge adjacent chunks within a section (before any connectors/expansion)
      for (const sec of secs) {
        for (let i = 0; i < sec.chunks.length - 1; i++) {
          const a = sec.chunks[i];
          const b = sec.chunks[i + 1];
          if (a.endPos + 1 === b.startPos) {
            a.text += b.text;
            a.endPos = b.endPos;
            a.tokenCount += b.tokenCount;
            // b carries the same isBm25 and a score already counted; only structure changes
            sec.chunks.splice(i + 1, 1);
            i--;
          }
        }
      }
      // Normalize scores (exclude non-content items like connectors later)
      for (const sec of secs) {
        if (sec.contribCount > 0) {
          sec.score /= sec.contribCount;
        }
      }
      return secs;
    };

    let semSections = packIntoSections(semPieces);
    let bmSections = packIntoSections(bmPieces);

    // Overlap handling: connectors and before/after expansion for semantic & bm25 independently
    if (overlappingChunks) {
      const connectorText = '\n\n...\n\n';
      const connectorTokens = this._tokenizer.encode(connectorText);
      const connectorTokenLen = connectorTokens.length;

      const insertConnectorsAndExpand = (secs: Section[]) => {
        for (const sec of secs) {
          // Insert connectors between chunks if multiple remain (post-merge)
          if (sec.chunks.length > 1) {
            // Ensure connectors fit. If not, trim chunks from the end until they do.
            const needed = (sec.chunks.length - 1) * connectorTokenLen;
            while (sec.tokenCount + needed > maxTokens && sec.chunks.length > 1) {
              const last = sec.chunks.pop()!;
              sec.tokenCount -= last.tokenCount;
              sec.contribCount = Math.max(0, sec.contribCount - 1);
              // Recompute needed with new length
            }
            if (sec.chunks.length > 1) {
              // Insert connectors between chunks
              for (let i = 0; i < sec.chunks.length - 1; i++) {
                const conn: SectionChunk = {
                  text: connectorText,
                  startPos: -1,
                  endPos: -1,
                  score: 0,
                  tokenCount: connectorTokenLen,
                  isBm25: false
                };
                sec.chunks.splice(i + 1, 0, conn);
                sec.tokenCount += connectorTokenLen;
                i++; // skip over connector
              }
            }
          }

          // With connectors in place, try to add before/after context if budget allows
          let budget = maxTokens - sec.tokenCount;
          if (budget > 40 && sec.chunks.length > 0) {
            const firstChunk = sec.chunks[0];
            const lastChunk = sec.chunks[sec.chunks.length - 1];

            // Determine section content bounds (ignore virtual connectors which have -1 coords)
            const realFirst = firstChunk.startPos >= 0 ? firstChunk : sec.chunks.find(c => c.startPos >= 0)!;
            const realLast = lastChunk.startPos >= 0 ? lastChunk : [...sec.chunks].reverse().find(c => c.startPos >= 0)!;
            const sectionStart = realFirst.startPos;
            const sectionEnd = realLast.endPos;

            // Before context
            if (sectionStart > 0) {
              const beforeText = text.substring(0, sectionStart);
              const beforeTokens = this.encodeBeforeText(beforeText, Math.ceil(budget / 2));
              const beforeBudget = Math.min(beforeTokens.length, Math.ceil(budget / 2));
              if (beforeBudget > 0) {
                const chunk: SectionChunk = {
                  text: this._tokenizer.decode(beforeTokens.slice(-beforeBudget)),
                  startPos: sectionStart - beforeBudget,
                  endPos: sectionStart - 1,
                  score: 0,
                  tokenCount: beforeBudget,
                  isBm25: false,
                };
                sec.chunks.unshift(chunk);
                sec.tokenCount += chunk.tokenCount;
                budget -= chunk.tokenCount;
              }
            }

            // After context
            if (budget > 0 && sectionEnd < text.length - 1) {
              const afterText = text.substring(sectionEnd + 1);
              const afterTokens = this.encodeAfterText(afterText, budget);
              const afterBudget = Math.min(afterTokens.length, budget);
              if (afterBudget > 0) {
                const chunk: SectionChunk = {
                  text: this._tokenizer.decode(afterTokens.slice(0, afterBudget)),
                  startPos: sectionEnd + 1,
                  endPos: sectionEnd + afterBudget,
                  score: 0,
                  tokenCount: afterBudget,
                  isBm25: false,
                };
                sec.chunks.push(chunk);
                sec.tokenCount += chunk.tokenCount;
                budget -= chunk.tokenCount;
              }
            }
          }
        }
      };

      insertConnectorsAndExpand(semSections);
      insertConnectorsAndExpand(bmSections);
    }

    // Sort by score and limit per-list by maxSections, semantic before bm25
    semSections.sort((a, b) => b.score - a.score);
    bmSections.sort((a, b) => b.score - a.score);
    if (semSections.length > maxSections) semSections.splice(maxSections);
    if (bmSections.length > maxSections) bmSections.splice(maxSections);

    // Materialize
    const semOut: DocumentTextSection[] = semSections.map(s => ({
      text: s.chunks.map(c => c.text).join(''),
      tokenCount: s.tokenCount,
      score: s.score,
      isBm25: false
    }));

    const bmOut: DocumentTextSection[] = bmSections.map(s => ({
      text: s.chunks.map(c => c.text).join(''),
      tokenCount: s.tokenCount,
      score: s.score,
      isBm25: true
    }));

    return [...semOut, ...bmOut];
  }

  private encodeBeforeText(text: string, budget: number): number[] {
    // Guard decode work by clamping to 8x requested budget
    const maxLength = budget * 8;
    const substr = text.length <= maxLength ? text : text.substring(text.length - maxLength);
    return this._tokenizer.encode(substr);
  }

  private encodeAfterText(text: string, budget: number): number[] {
    const maxLength = budget * 8;
    const substr = text.length <= maxLength ? text : text.substring(0, maxLength);
    return this._tokenizer.encode(substr);
  }
}

interface SectionChunk {
  text: string;
  startPos: number;
  endPos: number;
  score: number;
  tokenCount: number;
  isBm25: boolean;
}

interface Section {
  chunks: SectionChunk[];
  score: number;
  tokenCount: number;
  // Number of real content chunks included (excludes connectors/expansion)
  contribCount: number;
}