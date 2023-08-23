import { LocalDocument } from "./LocalDocument";
import { QueryResult, DocumentChunkMetadata, Tokenizer, DocumentTextSection } from "./types";

export class LocalDocumentResult extends LocalDocument {
    private readonly _chunks: QueryResult<DocumentChunkMetadata>[];
    private readonly _tokenizer: Tokenizer;
    private readonly _score: number;

    public constructor(folderPath: string, id: string, uri: string, chunks: QueryResult<DocumentChunkMetadata>[], tokenizer: Tokenizer) {
        super(folderPath, id, uri);
        this._chunks = chunks;
        this._tokenizer = tokenizer;

        // Compute average score
        let score = 0;
        this._chunks.forEach(chunk => score += chunk.score);
        this._score = score / this._chunks.length;
    }

    public get chunks(): QueryResult<DocumentChunkMetadata>[] {
        return this._chunks;
    }

    public get score(): number {
        return this._score;
    }

    public async renderSections(maxTokens: number, maxSections: number): Promise<DocumentTextSection[]> {
        // Load text from disk
        const text = await this.loadText();

        // First check to see if the entire document is less than maxTokens
        const tokens = this._tokenizer.encode(text);
        if (tokens.length < maxTokens) {
            return [{
                text,
                tokenCount: tokens.length,
                score: 1.0
            }];
        }

        // Otherwise, we need to split the document into sections
        // - Add each chunk to a temp array and filter out any chunk that's longer then maxTokens.
        // - Sort the array by startPos to arrange chunks in document order.
        // - Generate a new array of sections by combining chunks until the maxTokens is reached for each section.
        // - Generate an aggregate score for each section by averaging the score of each chunk in the section.
        // - Sort the sections by score and limit to maxSections.
        // - For each remaining section combine adjacent chunks of text.
        // - Dynamically add overlapping chunks of text to each section until the maxTokens is reached.
        const chunks: SectionChunk[] = this._chunks.map(chunk => {
            const startPos = chunk.item.metadata.startPos;
            const endPos = chunk.item.metadata.endPos;
            const chunkText = text.substring(startPos, endPos + 1);
            return {
                text: chunkText,
                startPos,
                endPos,
                score: chunk.score,
                tokenCount: this._tokenizer.encode(chunkText).length
            };
        }).filter(chunk => chunk.tokenCount <= maxTokens).sort((a, b) => a.startPos - b.startPos);

        // Check for no chunks
        if (chunks.length === 0) {
            // Take the top chunk and return a subset of its text
            const topChunk = this._chunks[0];
            const startPos = topChunk.item.metadata.startPos;
            const endPos = topChunk.item.metadata.endPos;
            const chunkText = text.substring(startPos, endPos + 1);
            const tokens = this._tokenizer.encode(chunkText);
            return [{
                text: this._tokenizer.decode(tokens.slice(0, maxTokens)),
                tokenCount: maxTokens,
                score: topChunk.score
            }];
        }

        // Generate sections
        const sections: Section[] = [{
            chunks: [],
            score: 0,
            tokenCount: 0
        }];
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            let section = sections[sections.length - 1];
            if (section.tokenCount + chunk.tokenCount > maxTokens) {
                sections.push({
                    chunks: [],
                    score: 0,
                    tokenCount: 0
                });
            }
            sections[sections.length - 1].chunks.push(chunk);
            sections[sections.length - 1].score += chunk.score;
            sections[sections.length - 1].tokenCount += chunk.tokenCount;
        }

        // Normalize section scores
        sections.forEach(section => section.score /= section.chunks.length);

        // Sort sections by score and limit to maxSections
        sections.sort((a, b) => b.score - a.score);
        if (sections.length > maxSections) {
            sections.splice(maxSections, sections.length - maxSections);
        }

        // Combine adjacent chunks of text
        sections.forEach(section => {
            for (let i = 0; i < section.chunks.length - 1; i++) {
                const chunk = section.chunks[i];
                const nextChunk = section.chunks[i + 1];
                if (chunk.endPos + 1 === nextChunk.startPos) {
                    chunk.text += nextChunk.text;
                    chunk.endPos = nextChunk.endPos;
                    chunk.tokenCount += nextChunk.tokenCount;
                    section.chunks.splice(i + 1, 1);
                    i--;
                }
            }
        });

        // Add overlapping chunks of text to each section until the maxTokens is reached
        const connector: SectionChunk = {
            text: '\n\n...\n\n',
            startPos: -1,
            endPos: -1,
            score: 0,
            tokenCount: this._tokenizer.encode('\n\n...\n\n').length
        };
        sections.forEach(section => {
            // Insert connectors between chunks
            if (section.chunks.length > 1) {
                for (let i = 0; i < section.chunks.length - 1; i++) {
                    section.chunks.splice(i + 1, 0, connector);
                    section.tokenCount += connector.tokenCount;
                    i++;
                }
            }

            // Add chunks to beginning and end of the section until maxTokens is reached
            let budget = maxTokens - section.tokenCount;
            if (budget > 40) {
                const sectionStart = section.chunks[0].startPos;
                const sectionEnd = section.chunks[section.chunks.length - 1].endPos;
                if (sectionStart > 0) {
                    const beforeTex = text.substring(0, section.chunks[0].startPos);
                    const beforeTokens = this._tokenizer.encode(beforeTex);
                    const beforeBudget = sectionEnd < text.length - 1 ? Math.min(beforeTokens.length, Math.ceil(budget/2)) : Math.min(beforeTokens.length, budget);
                    const chunk: SectionChunk = {
                        text: this._tokenizer.decode(beforeTokens.slice(-beforeBudget)),
                        startPos: sectionStart - beforeBudget,
                        endPos: sectionStart - 1,
                        score: 0,
                        tokenCount: beforeBudget
                    };
                    section.chunks.unshift(chunk);
                    section.tokenCount += chunk.tokenCount;
                    budget -= chunk.tokenCount;
                }

                if (sectionEnd < text.length - 1) {
                    const afterText = text.substring(sectionEnd + 1);
                    const afterTokens = this._tokenizer.encode(afterText);
                    const afterBudget = Math.min(afterTokens.length, budget);
                    const chunk: SectionChunk = {
                        text: this._tokenizer.decode(afterTokens.slice(0, afterBudget)),
                        startPos: sectionEnd + 1,
                        endPos: sectionEnd + afterBudget,
                        score: 0,
                        tokenCount: afterBudget
                    };
                    section.chunks.push(chunk);
                    section.tokenCount += chunk.tokenCount;
                    budget -= chunk.tokenCount;
                }
            }
        });

        // Return final rendered sections
        return sections.map(section => {
            let text = '';
            section.chunks.forEach(chunk => text += chunk.text);
            return {
                text: text,
                tokenCount: section.tokenCount,
                score: section.score
            };
        });
    }
}

interface SectionChunk {
    text: string;
    startPos: number;
    endPos: number;
    score: number;
    tokenCount: number;
}

interface Section {
    chunks: SectionChunk[];
    score: number;
    tokenCount: number;
}

