import { GPT3Tokenizer } from "./GPT3Tokenizer";
import { TextChunk, Tokenizer } from "./types";

const ALPHANUMERIC_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export interface TextSplitterConfig {
  separators: string[];
  keepSeparators: boolean;
  chunkSize: number;
  chunkOverlap: number;
  tokenizer: Tokenizer;
  docType?: string;
}

export class TextSplitter {
  private readonly _config: TextSplitterConfig;

  public constructor(config?: Partial<TextSplitterConfig>) {
    this._config = Object.assign({
      keepSeparators: false,
      chunkSize: 400,
      chunkOverlap: 40,
    } as TextSplitterConfig, config);

    // Create a default tokenizer if none is provided
    if (!this._config.tokenizer) {
      this._config.tokenizer = new GPT3Tokenizer();
    }

    // Use default separators if none are provided
    if (!this._config.separators || this._config.separators.length === 0) {
      this._config.separators = this.getSeparators(this._config.docType);
    }

    // Validate the config settings
    if (this._config.chunkSize < 1) {
      throw new Error("chunkSize must be >= 1");
    } else if (this._config.chunkOverlap < 0) {
      throw new Error("chunkOverlap must be >= 0");
    } else if (this._config.chunkOverlap > this._config.chunkSize) {
      throw new Error("chunkOverlap must be <= chunkSize");
    }
  }

  public split(text: string): TextChunk[] {
    // Get basic chunks
    const chunks = this.recursiveSplit(text, this._config.separators, 0);

    const that = this;
    function getOverlapTokens(tokens?: number[]): number[] {
      if (tokens != undefined) {
        const len = tokens.length > that._config.chunkOverlap ? that._config.chunkOverlap : tokens.length;
        return tokens.slice(0, len);
      } else {
        return [];
      }
    }

    // Add overlap tokens and text to the start and end of each chunk
    if (this._config.chunkOverlap > 0) {
      for (let i = 1; i < chunks.length; i++) {
        const previousChunk = chunks[i - 1];
        const chunk = chunks[i];
        const nextChunk = i < chunks.length - 1 ? chunks[i + 1] : undefined;

        // Use copies to avoid reversing in place (preserve token order in previous chunks)
        const prevTokensCopy = previousChunk.tokens.slice();
        chunk.startOverlap = getOverlapTokens(prevTokensCopy.reverse()).reverse();
        chunk.endOverlap = getOverlapTokens(nextChunk?.tokens);
      }
    }

    return chunks;
  }

  private recursiveSplit(text: string, separators: string[], startPos: number): TextChunk[] {
    const chunks: TextChunk[] = [];

    if (text.length > 0) {
      // Split text into parts
      let parts: string[];
      let separator = '';
      const nextSeparators = separators.length > 1 ? separators.slice(1) : [];

      if (separators.length > 0) {
        // Split by separator
        separator = separators[0];
        parts = separator == ' ' ? this.splitBySpaces(text) : text.split(separator);
      } else {
        // Cut text in half
        const half = Math.floor(text.length / 2);
        parts = [text.substring(0, half), text.substring(half)];
      }

      // Iterate over parts
      for (let i = 0; i < parts.length; i++) {
        const lastChunk = (i === parts.length - 1);

        // Get chunk text and endPos
        let chunk = parts[i];
        const endPos = (startPos + (chunk.length - 1)) + (lastChunk ? 0 : separator.length);

        if (this._config.keepSeparators && !lastChunk) {
          chunk += separator;
        }

        // Keep chunks that contain any non-whitespace; drop whitespace-only
        if (!/\S/.test(chunk)) {
          // drop whitespace-only chunks
          startPos = endPos + 1;
          continue;
        }

        // Optimization to avoid encoding really large chunks
        if (chunk.length / 6 > this._config.chunkSize) {
          // Break the text into smaller chunks
          const subChunks = this.recursiveSplit(chunk, nextSeparators, startPos);
          chunks.push(...subChunks);
        } else {
          // Encode chunk text
          const tokens = this._config.tokenizer.encode(chunk);
          if (tokens.length > this._config.chunkSize) {
            // Break the text into smaller chunks
            const subChunks = this.recursiveSplit(chunk, nextSeparators, startPos);
            chunks.push(...subChunks);
          } else {
            // Append chunk to output
            chunks.push({
              text: chunk,
              tokens: tokens,
              startPos: startPos,
              endPos: endPos,
              startOverlap: [],
              endOverlap: [],
            });
          }
        }

        // Update startPos
        startPos = endPos + 1;
      }
    }

    return this.combineChunks(chunks);
  }

  private combineChunks(chunks: TextChunk[]): TextChunk[] {
    const combinedChunks: TextChunk[] = [];
    let currentChunk: TextChunk | undefined;
    let currentLength = 0;

    // When not keeping separators, we previously inserted a space between merged chunks.
    // We will still use a space for normal merges, but we will prevent merging punctuation-only
    // separator chunks (e.g., '---', '***', '====') to preserve them as standalone.
    const separator = this._config.keepSeparators ? '' : ' ';

    const isWhitespaceOnly = (t: string) => !/\S/.test(t);
    const isPunctuationOnly = (t: string) => /\S/.test(t) && !/[a-zA-Z0-9]/.test(t);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      if (!currentChunk) {
        currentChunk = chunk;
        currentLength = chunk.tokens.length;
        continue;
      }

      // If either the current or next chunk is punctuation-only (non-whitespace, no alphanumeric),
      // do not merge; keep them as separate chunks to preserve separators like '---'.
      if (isPunctuationOnly(currentChunk.text) || isPunctuationOnly(chunk.text)) {
        combinedChunks.push(currentChunk);
        currentChunk = chunk;
        currentLength = chunk.tokens.length;
        continue;
      }

      // Normal merge path constrained by token budget
      const length = currentChunk.tokens.length + chunk.tokens.length;
      if (length > this._config.chunkSize) {
        combinedChunks.push(currentChunk);
        currentChunk = chunk;
        currentLength = chunk.tokens.length;
      } else {
        // Only insert separator if neither chunk is whitespace-only (defensive)
        const joiner = (!this._config.keepSeparators && !isWhitespaceOnly(currentChunk.text) && !isWhitespaceOnly(chunk.text)) ? separator : '';
        currentChunk.text += joiner + chunk.text;
        currentChunk.endPos = chunk.endPos;
        currentChunk.tokens.push(...chunk.tokens);
        currentLength += chunk.tokens.length;
      }
    }

    if (currentChunk) {
      combinedChunks.push(currentChunk);
    }

    return combinedChunks;
  }

  private splitBySpaces(text: string): string[] {
    // Split text by tokens and return parts
    const parts: string[] = [];
    let tokens = this._config.tokenizer.encode(text);

    do {
      if (tokens.length <= this._config.chunkSize) {
        parts.push(this._config.tokenizer.decode(tokens));
        break;
      } else {
        const span = tokens.splice(0, this._config.chunkSize);
        parts.push(this._config.tokenizer.decode(span));
      }
    } while (true);

    return parts;
  }

  private getSeparators(docType?: string): string[] {
    switch (docType ?? '') {
      case "cpp":
        return [
          "\nclass ",
          "\nvoid ",
          "\nint ",
          "\nfloat ",
          "\ndouble ",
          "\nif ",
          "\nfor ",
          "\nwhile ",
          "\nswitch ",
          "\ncase ",
          "\n\n",
          "\n",
        ];
      case "go":
        return [
          "\nfunc ",
          "\nvar ",
          "\nconst ",
          "\ntype ",
          "\nif ",
          "\nfor ",
          "\nswitch ",
          "\ncase ",
          "\n\n",
          "\n",
        ];
      case "java":
      case "c#":
      case "csharp":
      case "cs":
      case "ts":
      case "tsx":
      case "typescript":
        return [
          "// LLM-REGION",
          "/* LLM-REGION",
          "/** LLM-REGION",
          "\nclass ",
          "\npublic ",
          "\nprotected ",
          "\nprivate ",
          "\nstatic ",
          "\nif ",
          "\nfor ",
          "\nwhile ",
          "\nswitch ",
          "\ncase ",
          "\n\n",
          "\n",
          " "
        ];
      case "js":
      case "jsx":
      case "javascript":
        return [
          "// LLM-REGION",
          "/* LLM-REGION",
          "/** LLM-REGION",
          "\nclass ",
          "\nfunction ",
          "\nconst ",
          "\nlet ",
          "\nvar ",
          "\nclass ",
          "\nif ",
          "\nfor ",
          "\nwhile ",
          "\nswitch ",
          "\ncase ",
          "\ndefault ",
          "\n\n",
          "\n",
        ];
      case "php":
        return [
          "\nfunction ",
          "\nclass ",
          "\nif ",
          "\nforeach ",
          "\nwhile ",
          "\ndo ",
          "\nswitch ",
          "\ncase ",
          "\n\n",
          "\n",
        ];
      case "proto":
        return [
          "\nmessage ",
          "\nservice ",
          "\nenum ",
          "\noption ",
          "\nimport ",
          "\nsyntax ",
          "\n\n",
          "\n",
        ];
      case "python":
      case "py":
        return [
          "\nclass ",
          "\ndef ",
          "\n\tdef ",
          "\n\n",
          "\n",
        ];
      case "rst":
        return [
          "\n===\n",
          "\n---\n",
          "\n***\n",
          "\n.. ",
          "\n\n",
          "\n",
        ];
      case "ruby":
        return [
          "\ndef ",
          "\nclass ",
          "\nif ",
          "\nunless ",
          "\nwhile ",
          "\nfor ",
          "\ndo ",
          "\nbegin ",
          "\nrescue ",
          "\n\n",
          "\n",
        ];
      case "rust":
        return [
          "\nfn ",
          "\nconst ",
          "\nlet ",
          "\nif ",
          "\nwhile ",
          "\nfor ",
          "\nloop ",
          "\nmatch ",
          "\nconst ",
          "\n\n",
          "\n",
        ];
      case "scala":
        return [
          "\nclass ",
          "\nobject ",
          "\ndef ",
          "\nval ",
          "\nvar ",
          "\nif ",
          "\nfor ",
          "\nwhile ",
          "\nmatch ",
          "\ncase ",
          "\n\n",
          "\n",
        ];
      case "swift":
        return [
          "\nfunc ",
          "\nclass ",
          "\nstruct ",
          "\nenum ",
          "\nif ",
          "\nfor ",
          "\nwhile ",
          "\ndo ",
          "\nswitch ",
          "\ncase ",
          "\n\n",
          "\n",
        ];
      case "md":
      case "markdown":
        return [
          "\n## ",
          "\n### ",
          "\n#### ",
          "\n##### ",
          "\n###### ",
          "```\n\n",
          "\n\n***\n\n",
          "\n\n---\n\n",
          "\n\n___\n\n",
          "<table>",
          "\n\n",
          "\n",
        ];
      case "latex":
        return [
          "\n\\chapter{",
          "\n\\section{",
          "\n\\subsection{",
          "\n\\subsubsection{",
          "\n\\begin{enumerate}",
          "\n\\begin{itemize}",
          "\n\\begin{description}",
          "\n\\begin{list}",
          "\n\\begin{quote}",
          "\n\\begin{quotation}",
          "\n\\begin{verse}",
          "\n\\begin{verbatim}",
          "\n\\begin{align}",
          "\n\n",
          "\n",
        ];
      case "html":
        return [
          "<body>",
          "<div>",
          "<p>",
          "<br>",
          "<li>",
          "<h1>",
          "<h2>",
          "<h3>",
          "<h4>",
          "<h5>",
          "<h6>",
          "<span>",
          "<table>",
          "<tr>",
          "<td>",
          "<th>",
          "<ul>",
          "<ol>",
          "<header>",
          "<footer>",
          "<nav>",
          "<head>",
          "<style>",
          "<script>",
          "<meta>",
          "<title>",
        ];
      case "sol":
        return [
          "\npragma ",
          "\nusing ",
          "\ncontract ",
          "\ninterface ",
          "\nlibrary ",
          "\nconstructor ",
          "\ntype ",
          "\nfunction ",
          "\nevent ",
          "\nmodifier ",
          "\nerror ",
          "\nstruct ",
          "\nenum ",
          "\nif ",
          "\nfor ",
          "\nwhile ",
          "\ndo while ",
          "\nassembly ",
          "\n\n",
          "\n",
        ];
      default:
        return [
          "\n\n",
          "\n",
        ];
    }
  }
}
