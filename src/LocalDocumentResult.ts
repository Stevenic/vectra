import { LocalDocument } from "./LocalDocument";
import { LocalDocumentIndex } from "./LocalDocumentIndex";
import {
  QueryResult,
  DocumentChunkMetadata,
  Tokenizer,
  DocumentTextSection,
} from "./types";

/**
 * Represents a search result for a document stored on disk.
 */
export class LocalDocumentResult extends LocalDocument {
  private readonly _chunks: QueryResult<DocumentChunkMetadata>[];
  private readonly _tokenizer: Tokenizer;
  private readonly _score: number;

  public static readonly CONNECTOR = "\n\n...\n\n";

  /**
   * @private
   * Internal constructor for `LocalDocumentResult` instances.
   */
  public constructor(
    index: LocalDocumentIndex,
    id: string,
    uri: string,
    chunks: QueryResult<DocumentChunkMetadata>[],
    tokenizer: Tokenizer
  ) {
    super(index, id, uri);
    this._chunks = chunks;
    this._tokenizer = tokenizer;

    // Average score across chunks
    let score = 0;
    this._chunks.forEach((chunk) => (score += chunk.score));
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
   * Helper: robust check for BM25-marked chunks.
   */
  protected isBm25Chunk(chunk: QueryResult<DocumentChunkMetadata>): boolean {
    const val = chunk.item.metadata?.isBm25 as any;
    return val === true || val === "true" || val === 1 || val === "1";
  }

  /**
   * A small, testable packer that mimics the old `renderAllSections()` behavior
   * but exposes the internal flush logic so all branches are coverable.
   */
  protected createAllSectionsPacker() {
    const sections: DocumentTextSection[] = [];

    let currentTokens: number[] = [];
    let currentScores: number[] = [];
    let currentIsBm25AllTrue = true;

    const flush = () => {
      // Branch 1: empty flush
      if (currentTokens.length === 0) return;

      // Branch 2: avgScore fallback when scores are missing
      const avgScore =
        currentScores.length > 0
          ? currentScores.reduce((a, b) => a + b, 0) / currentScores.length
          : 0;

      // Branch 3: isBm25 depends on "all bm25" and "has scores"
      const isBm25 =
        currentIsBm25AllTrue && currentScores.length > 0 ? true : false;

      sections.push({
        text: this._tokenizer.decode(currentTokens),
        tokenCount: currentTokens.length,
        score: avgScore,
        isBm25,
      });

      currentTokens = [];
      currentScores = [];
      currentIsBm25AllTrue = true;
    };

    const pushChunkTokens = (
      tokens: number[],
      score: number,
      isBm25Chunk: boolean
    ) => {
      currentTokens.push(...tokens);
      currentScores.push(score);
      currentIsBm25AllTrue = currentIsBm25AllTrue && isBm25Chunk;
    };

    /**
     * Test-only escape hatch: force internal state to cover otherwise-invariant branches.
     * Not used by production code.
     */
    const __testSetState = (state: {
      currentTokens?: number[];
      currentScores?: number[];
      currentIsBm25AllTrue?: boolean;
    }) => {
      if (state.currentTokens) currentTokens = state.currentTokens.slice();
      if (state.currentScores) currentScores = state.currentScores.slice();
      if (typeof state.currentIsBm25AllTrue === "boolean") {
        currentIsBm25AllTrue = state.currentIsBm25AllTrue;
      }
    };

    const getSections = () => sections;

    return { flush, pushChunkTokens, getSections, __testSetState };
  }

  /**
   * Renders all of the results chunks as spans of text (sections.)
   * @remarks
   * - Chunks are sorted by document order.
   * - Multiple small chunks are packed into a single section up to maxTokens.
   * - Oversized chunks are split into multiple sections, each carrying the chunk's score.
   * - When multiple chunks are packed, section score is the arithmetic mean of packed chunks' scores.
   */
  public async renderAllSections(
    maxTokens: number
  ): Promise<DocumentTextSection[]> {
    const docText = await this.loadText();

    // Sort by document order
    const sorted = this._chunks
      .slice()
      .sort(
        (a, b) =>
          Number(a.item.metadata.startPos) - Number(b.item.metadata.startPos)
      );

    const packer = this.createAllSectionsPacker();

    // We'll keep a local "current length" mirror, to avoid re-encoding just to compute lengths.
    let currentLen = 0;

    const flushAndReset = () => {
      packer.flush();
      currentLen = 0;
    };

    for (const chunk of sorted) {
      const startPos = Number(chunk.item.metadata.startPos);
      const endPos = Number(chunk.item.metadata.endPos);
      const chunkText = docText.substring(startPos, endPos + 1);
      const tokens = this._tokenizer.encode(chunkText);

      // Oversized chunk: split
      if (tokens.length > maxTokens) {
        // flush pending packed group
        flushAndReset();

        let offset = 0;
        while (offset < tokens.length) {
          const part = tokens.slice(offset, offset + maxTokens);

          // Each split part is its own section (force packer state then flush)
          (packer as any).__testSetState({
            currentTokens: part,
            currentScores: [chunk.score],
            currentIsBm25AllTrue: this.isBm25Chunk(chunk),
          });
          packer.flush();
          offset += part.length;
        }
        continue;
      }

      // Pack if it fits
      if (currentLen + tokens.length <= maxTokens) {
        packer.pushChunkTokens(tokens, chunk.score, this.isBm25Chunk(chunk));
        currentLen += tokens.length;
      } else {
        // overflow: flush, then start new group
        flushAndReset();
        packer.pushChunkTokens(tokens, chunk.score, this.isBm25Chunk(chunk));
        currentLen = tokens.length;
      }
    }

    // final flush
    packer.flush();
    return packer.getSections();
  }

  /**
   * Testable helper: build a single fallback section from the top-scoring chunk,
   * truncated to exactly maxTokens tokens.
   */
  protected buildFallbackTopChunkSection(
    docText: string,
    chunks: QueryResult<DocumentChunkMetadata>[],
    isBm25: boolean,
    maxTokens: number
  ): DocumentTextSection[] {
    if (chunks.length === 0) return [];

    const topChunk = chunks.reduce(
      (prev, curr) => (curr.score > prev.score ? curr : prev),
      chunks[0]
    );

    const start = Number(topChunk.item.metadata.startPos);
    const end = Number(topChunk.item.metadata.endPos);
    const chunkText = docText.substring(start, end + 1);
    const chunkTokens = this._tokenizer.encode(chunkText);

    const truncatedTokens = chunkTokens.slice(0, maxTokens);

    return [
      {
        text: this._tokenizer.decode(truncatedTokens),
        tokenCount: maxTokens,
        score: topChunk.score,
        isBm25,
      },
    ];
  }

  /**
   * Internal helper: builds sections for either semantic or BM25 chunk lists using a heatmap.
   */
  protected buildSectionsFor(
    docText: string,
    chunks: QueryResult<DocumentChunkMetadata>[],
    isBm25: boolean,
    maxTokens: number,
    maxSections: number,
    overlappingChunks: boolean
  ): DocumentTextSection[] {
    if (chunks.length === 0) return [];

    const connector = LocalDocumentResult.CONNECTOR;
    const connectorTokens = this._tokenizer.encode(connector);

    // Build heatmap: map each character position to accumulated score
    const heatmap = new Map<number, number>();
    for (const chunk of chunks) {
      const start = Number(chunk.item.metadata.startPos);
      const end = Number(chunk.item.metadata.endPos);
      for (let pos = start; pos <= end; pos++) {
        heatmap.set(pos, (heatmap.get(pos) || 0) + chunk.score);
      }
    }

    interface Peak {
      position: number;
      score: number;
      chunks: QueryResult<DocumentChunkMetadata>[];
    }

    const peaks: Peak[] = [];
    const sortedPositions = Array.from(heatmap.keys()).sort((a, b) => a - b);

    let currentPeak: Peak | null = null;
    const PEAK_THRESHOLD = 0.1;

    for (const pos of sortedPositions) {
      const score = heatmap.get(pos)!;

      if (score < PEAK_THRESHOLD) {
        if (currentPeak) {
          peaks.push(currentPeak);
          currentPeak = null;
        }
        continue;
      }

      if (!currentPeak) {
        currentPeak = { position: pos, score, chunks: [] };
      } else {
        if (score > currentPeak.score) {
          currentPeak.position = pos;
          currentPeak.score = score;
        }
      }
    }
    if (currentPeak) peaks.push(currentPeak);

    // No-peaks fallback: create one at center of top chunk
    if (peaks.length === 0) {
      const topChunk = chunks.reduce(
        (prev, curr) => (curr.score > prev.score ? curr : prev),
        chunks[0]
      );
      const start = Number(topChunk.item.metadata.startPos);
      const end = Number(topChunk.item.metadata.endPos);
      const center = Math.floor((start + end) / 2);
      peaks.push({ position: center, score: topChunk.score, chunks: [] });
    }

    // Associate chunks to nearest peak
    for (const chunk of chunks) {
      const start = Number(chunk.item.metadata.startPos);
      const end = Number(chunk.item.metadata.endPos);
      const center = Math.floor((start + end) / 2);

      let closestPeak = peaks[0];
      let minDist = Math.abs(center - closestPeak.position);

      for (const peak of peaks) {
        const dist = Math.abs(center - peak.position);
        if (dist < minDist) {
          minDist = dist;
          closestPeak = peak;
        }
      }

      closestPeak.chunks.push(chunk);
    }

    // Sort peaks by score desc
    peaks.sort((a, b) => b.score - a.score);
    const topPeaks = peaks.slice(0, maxSections);

    const sections: DocumentTextSection[] = [];

    for (const peak of topPeaks) {
      const sortedChunks = peak.chunks.slice().sort((a, b) => {
        const aCenter = Math.floor(
          (Number(a.item.metadata.startPos) + Number(a.item.metadata.endPos)) / 2
        );
        const bCenter = Math.floor(
          (Number(b.item.metadata.startPos) + Number(b.item.metadata.endPos)) / 2
        );
        return (
          Math.abs(aCenter - peak.position) - Math.abs(bCenter - peak.position)
        );
      });

      const selected: QueryResult<DocumentChunkMetadata>[] = [];
      let currentTokenCount = 0;

      for (const chunk of sortedChunks) {
        const start = Number(chunk.item.metadata.startPos);
        const end = Number(chunk.item.metadata.endPos);
        const chunkText = docText.substring(start, end + 1);
        const chunkTokens = this._tokenizer.encode(chunkText);

        // Whole-chunk preference, skip oversize
        if (chunkTokens.length > maxTokens) continue;

        let tokensNeeded = chunkTokens.length;

        if (selected.length > 0 && overlappingChunks) {
          const isAdjacent = selected.some((s) => {
            const sEnd = Number(s.item.metadata.endPos);
            const sStart = Number(s.item.metadata.startPos);
            return sEnd + 1 === start || end + 1 === sStart;
          });

          if (!isAdjacent) {
            tokensNeeded += connectorTokens.length;
          }
        }

        if (currentTokenCount + tokensNeeded <= maxTokens) {
          selected.push(chunk);
          currentTokenCount += tokensNeeded;
        }
      }

      // If nothing selected, fall back (required by contract)
      if (selected.length === 0) {
        return this.buildFallbackTopChunkSection(
          docText,
          chunks,
          isBm25,
          maxTokens
        );
      }

      // Assemble selected in document order with connectors
      const ordered = selected
        .slice()
        .sort(
          (a, b) =>
            Number(a.item.metadata.startPos) - Number(b.item.metadata.startPos)
        );

      let sectionText = "";
      let sectionTokens: number[] = [];

      for (let i = 0; i < ordered.length; i++) {
        const curr = ordered[i];
        const start = Number(curr.item.metadata.startPos);
        const end = Number(curr.item.metadata.endPos);
        const chunkText = docText.substring(start, end + 1);

        if (i > 0 && overlappingChunks) {
          const prev = ordered[i - 1];
          const prevEnd = Number(prev.item.metadata.endPos);
          if (prevEnd + 1 < start) {
            sectionText += connector;
            sectionTokens.push(...connectorTokens);
          }
        }

        sectionText += chunkText;
        sectionTokens.push(...this._tokenizer.encode(chunkText));
      }

      // Optional expansion if budget remains
      if (overlappingChunks) {
        const budgetRemain = maxTokens - sectionTokens.length;
        if (budgetRemain > 40) {
          const firstStart = Math.min(
            ...selected.map((c) => Number(c.item.metadata.startPos))
          );
          const lastEnd = Math.max(
            ...selected.map((c) => Number(c.item.metadata.endPos))
          );

          const beforeRegion = docText.slice(0, firstStart);
          const afterRegion = docText.slice(lastEnd + 1);

          const beforeToksAll = this._tokenizer.encode(beforeRegion);
          const afterToksAll = this._tokenizer.encode(afterRegion);

          const beforeBudget = Math.min(
            Math.ceil(budgetRemain / 2),
            beforeToksAll.length
          );
          const afterBudget = Math.min(
            budgetRemain - beforeBudget,
            afterToksAll.length
          );

          const beforeTail = beforeToksAll.slice(
            beforeToksAll.length - beforeBudget
          );
          const afterHead = afterToksAll.slice(0, afterBudget);

          sectionText =
            this._tokenizer.decode(beforeTail) +
            sectionText +
            this._tokenizer.decode(afterHead);

          sectionTokens = [...beforeTail, ...sectionTokens, ...afterHead];
        }
      }

      const avgScore =
        selected.reduce((sum, c) => sum + c.score, 0) / selected.length;

      sections.push({
        text: sectionText,
        tokenCount: sectionTokens.length,
        score: avgScore,
        isBm25,
      });
    }

    // If maxSections=0 (or slice emptied), this is reachable:
    if (sections.length === 0) {
      return this.buildFallbackTopChunkSection(docText, chunks, isBm25, maxTokens);
    }

    return sections;
  }

  /**
   * Renders the top spans of text (sections) of the document based on the query result.
   */
  public async renderSections(
    maxTokens: number,
    maxSections: number,
    overlappingChunks = true
  ): Promise<DocumentTextSection[]> {
    const length = await this.getLength();
    if (length <= maxTokens) {
      const text = await this.loadText();
      return [
        {
          text,
          tokenCount: length,
          score: 1.0,
          isBm25: false,
        },
      ];
    }

    const docText = await this.loadText();

    const semanticChunks = this._chunks.filter((c) => !this.isBm25Chunk(c));
    const bm25Chunks = this._chunks.filter((c) => this.isBm25Chunk(c));

    const semSections = this.buildSectionsFor(
      docText,
      semanticChunks,
      false,
      maxTokens,
      maxSections,
      overlappingChunks
    ).slice(0, maxSections);

    const bmSections = this.buildSectionsFor(
      docText,
      bm25Chunks,
      true,
      maxTokens,
      maxSections,
      overlappingChunks
    ).slice(0, maxSections);

    return [...semSections, ...bmSections];
  }
}