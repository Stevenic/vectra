import { GPT3Tokenizer } from "./GPT3Tokenizer";
import { TextChunk, Tokenizer } from "./types";

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

    if (!this._config.tokenizer) {
      this._config.tokenizer = new GPT3Tokenizer();
    }

    if (!this._config.separators || this._config.separators.length === 0) {
      this._config.separators = this.getSeparators(this._config.docType);
    }

    if (this._config.chunkSize < 1) {
      throw new Error("chunkSize must be >= 1");
    } else if (this._config.chunkOverlap < 0) {
      throw new Error("chunkOverlap must be >= 0");
    } else if (this._config.chunkOverlap > this._config.chunkSize) {
      throw new Error("chunkOverlap must be <= chunkSize");
    }
  }

  public split(text: string): TextChunk[] {
    const chunks = this.recursiveSplit(text, this._config.separators, 0);

    if (this._config.chunkOverlap > 0) {
      for (let i = 0; i < chunks.length - 1; i++) {
        const current = chunks[i];
        const next = chunks[i + 1];

        const currTokensCopy = current.tokens.slice();
        const trailing = currTokensCopy.reverse().slice(0, this._config.chunkOverlap).reverse();
        next.startOverlap = trailing;

        const leadLen = Math.min(this._config.chunkOverlap, next.tokens.length);
        current.endOverlap = next.tokens.slice(0, leadLen);
      }
    }

    return chunks;
  }

  private recursiveSplit(text: string, separators: string[], startPos: number): TextChunk[] {
    if (text.length === 0) return [];

    if (separators.length > 0) {
      const sep = separators[0];
      const nextSeparators = separators.length > 1 ? separators.slice(1) : [];

      const parts = sep === ' ' ? this.splitBySpaces(text) : text.split(sep);
      const out: TextChunk[] = [];

      let pos = startPos;
      for (let i = 0; i < parts.length; i++) {
        const lastPart = (i === parts.length - 1);
        let piece = parts[i];

        if (this._config.keepSeparators && !lastPart) {
          piece += sep;
        }

        if (!/\S/.test(piece)) {
          const consumed = parts[i].length + (lastPart ? 0 : sep.length);
          pos += consumed;
          continue;
        }

        const sub = this.recursiveSplit(piece, nextSeparators, pos);
        if (sub.length > 0) {
          out.push(...sub);
        } else {
          out.push(...this.finalizeToChunks(piece, pos));
        }

        const consumed = parts[i].length + (lastPart ? 0 : sep.length);
        pos += consumed;
      }

      const joiner =
        this._config.keepSeparators
          ? ''
          : (sep !== ' ' && (sep.includes('\n') || sep.includes('\t')) ? ' ' : '');

      return this.combineChunks(out, joiner);
    }

    return this.combineChunks(this.finalizeToChunks(text, startPos), '');
  }

  // Strip inline punctuation-only runs when keepSeparators=false.
  // Only removes runs that touch non-whitespace on at least one side (inline),
  // preserving standalone lines like '---' or '***' that are separated by whitespace/newlines.
  private stripInlineSeparators(s: string): string {
    if (this._config.keepSeparators || s.length === 0) return s;
    const re = /(-{3,}|\*{3,}|={3,}|_{3,})/g;
    let out = '';
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      const left = start > 0 ? s[start - 1] : undefined;
      const right = end < s.length ? s[end] : undefined;
      const leftNonWS = left !== undefined && !/\s/.test(left);
      const rightNonWS = right !== undefined && !/\s/.test(right);
      // Inline if touching non-whitespace on at least one side
      if (leftNonWS || rightNonWS) {
        out += s.slice(lastIndex, start);
        lastIndex = end; // drop the run
      }
    }
    out += s.slice(lastIndex);
    return out;
  }

  // Produce one or more chunks under budget.
  private finalizeToChunks(text: string, startPos: number): TextChunk[] {
    const chunks: TextChunk[] = [];
    const tokens = this._config.tokenizer.encode(text);

    // Token-budget splitting
    if (tokens.length > this._config.chunkSize) {
      let remaining = tokens.slice();
      let pos = startPos;

      while (remaining.length > 0) {
        const span = remaining.splice(0, this._config.chunkSize);
        const original = this._config.tokenizer.decode(span);

        const leadingWSMatch = original.match(/^\s+/);
        const leadingWSLen = leadingWSMatch ? leadingWSMatch[0].length : 0;

        let sliceText = leadingWSLen > 0 ? original.slice(leadingWSLen) : original;
        if (sliceText.length === 0) {
          pos += original.length;
          continue;
        }

        // Drop inline punctuation-only runs if configured
        const stripped = this.stripInlineSeparators(sliceText);

        const sliceStart = pos + leadingWSLen;
        const sliceEnd = sliceStart + stripped.length - 1;

        const spanTokens = this._config.tokenizer.encode(stripped);

        chunks.push({
          text: stripped,
          tokens: spanTokens,
          startPos: sliceStart,
          endPos: sliceEnd,
          startOverlap: [],
          endOverlap: [],
        });

        pos += original.length;
      }
      return chunks;
    }

    // If text fits but is a very long unbroken string with no configured separators, fall back to char windows
    if (text.length > this._config.chunkSize) {
      const hasWhitespace = /\s/.test(text);
      const hasAnyConfiguredSep = (this._config.separators || []).some(s => s && text.includes(s));

      if (!hasWhitespace && !hasAnyConfiguredSep) {
        let pos = startPos;
        for (let off = 0; off < text.length; off += this._config.chunkSize) {
          const slice = text.slice(off, off + this._config.chunkSize);
          const stripped = this.stripInlineSeparators(slice);
          const sliceTokens = this._config.tokenizer.encode(stripped);
          const sliceStart = pos;
          const sliceEnd = sliceStart + stripped.length - 1;
          chunks.push({
            text: stripped,
            tokens: sliceTokens,
            startPos: sliceStart,
            endPos: sliceEnd,
            startOverlap: [],
            endOverlap: [],
          });
          pos = sliceEnd + 1;
        }
        return chunks;
      }
    }

    const stripped = this.stripInlineSeparators(text);
    const outTokens = this._config.tokenizer.encode(stripped);

    chunks.push({
      text: stripped,
      tokens: outTokens,
      startPos,
      endPos: startPos + stripped.length - 1,
      startOverlap: [],
      endOverlap: [],
    });
    return chunks;
  }

  private combineChunks(chunks: TextChunk[], joiner: string): TextChunk[] {
    const combined: TextChunk[] = [];
    let current: TextChunk | undefined;

    const isWhitespaceOnly = (t: string) => !/\S/.test(t);
    const isPunctuationOnly = (t: string) => /\S/.test(t) && !/[a-zA-Z0-9]/.test(t);

    for (let i = 0; i < chunks.length; i++) {
      const next = chunks[i];
      if (!current) {
        current = next;
        continue;
      }

      // Keep punctuation-only chunks standalone
      if (isPunctuationOnly(current.text) || isPunctuationOnly(next.text)) {
        combined.push(current);
        current = next;
        continue;
      }

      const tokenLength = current.tokens.length + next.tokens.length;
      const textLength = current.text.length + (joiner ? joiner.length : 0) + next.text.length;

      if (tokenLength > this._config.chunkSize || textLength > this._config.chunkSize) {
        combined.push(current);
        current = next;
      } else {
        const sep = (!this._config.keepSeparators && !isWhitespaceOnly(current.text) && !isWhitespaceOnly(next.text)) ? joiner : '';
        current.text += sep + next.text;
        current.endPos = next.endPos;
        current.tokens.push(...next.tokens);
      }
    }

    if (current) combined.push(current);
    return combined;
  }

  // Token-window splitting utility used for the ' ' logical separator
  private splitBySpaces(text: string): string[] {
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