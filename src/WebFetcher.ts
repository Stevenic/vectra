import axios, { AxiosRequestConfig } from "axios";
import { TextFetcher } from './types';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

const ALLOWED_CONTENT_TYPES = [
  "text/html",
  "application/json",
  "application/xml",
  "application/javascript",
  "text/plain",
];

const DEFAULT_HEADERS: Record<string, string> = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Encoding": "gzip, deflate, sdch, br",
  "Accept-Language": "en-US,en;q=0.8,ms;q=0.6",
  "Alt-Used": "LEAVE-THIS-KEY-SET-BY-TOOL",
  Connection: "keep-alive",
  Host: "LEAVE-THIS-KEY-SET-BY-TOOL",
  Referer: "https://www.google.com/",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "cross-site",
  "Upgrade-Insecure-Requests": "1",
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36",
};

export interface WebFetcherConfig {
  headers?: Record<string, string>;
  requestConfig?: AxiosRequestConfig;
  htmlToMarkdown: boolean;
  summarizeHtml: boolean;
}

export class WebFetcher implements TextFetcher {
  private readonly _config: WebFetcherConfig;

  public constructor(config?: Partial<WebFetcherConfig>) {
    this._config = Object.assign(
      {
        htmlToMarkdown: true,
        summarizeHtml: false,
      } as WebFetcherConfig,
      config
    );
  }

  public async fetch(
    uri: string,
    onDocument: (uri: string, text: string, docType?: string) => Promise<boolean>
  ): Promise<boolean> {
    const httpClient = axios.create({
      validateStatus: () => true,
    });

    // Clone headers to avoid mutating the original
    const headers: Record<string, string> = {
      ...DEFAULT_HEADERS,
      ...(this._config.headers ?? {}),
    };

    // get hostname from url
    const host = new URL(uri).hostname;
    headers["Host"] = host;
    headers["Alt-Used"] = host;

    // Merge request config
    const requestConfig: AxiosRequestConfig = {
      ...(this._config.requestConfig ?? {}),
      headers,
    };

    // Fetch page and check for errors
    const response = await httpClient.get(uri, requestConfig);
    if (response.status >= 400) {
      throw new Error(`Site returned an HTTP status of ${response.status}`);
    }

    // Check for valid content type
    const contentTypeRaw = String((response.headers as any)?.["content-type"] ?? "");
    const mediaType = contentTypeRaw.split(";")[0]?.trim() || "";
    if (!mediaType || !ALLOWED_CONTENT_TYPES.includes(mediaType)) {
      throw new Error(`Site returned an invalid content type of ${contentTypeRaw}`);
    }

    // Convert content type to doc type
    const docType = mediaType !== "text/plain" ? mediaType.split("/")[1] : undefined;

    if (docType === "html" && this._config.htmlToMarkdown) {
      const text = this.htmlToMarkdown(String(response.data ?? ""), uri);
      return await onDocument(uri, text, "md");
    } else {
      const text = String(response.data ?? "");
      return await onDocument(uri, text, docType);
    }
  }

  private htmlToMarkdown(html: string, baseUrl: string): string {
    // Parse HTML
    const $ = cheerio.load(html, { scriptingEnabled: true });

    // Remove scripts and convert relative links to absolute
    $("script").remove();
    $("a").each((_, elem) => {
      const $el = $(elem);
      const href = $el.attr("href");
      if (href && !href.startsWith("http")) {
        try {
          $el.attr("href", new URL(href, baseUrl).toString());
        } catch {
          // ignore bad URLs
        }
      }
    });

    // Convert to markdown
    const body = $("body").html() ?? "";
    const turndownService = new TurndownService({
      hr: "\n\n---\n\n",
    });
    convertTables(turndownService);
    const md = turndownService.turndown(body);

    // Remove any overly long header text
    const firstSpace = md.indexOf(" ");
    const firstNewline = md.indexOf("\n");
    const candidates = [firstSpace, firstNewline].filter((i) => i >= 0);
    const contentStart = candidates.length ? Math.min(...candidates) : -1;

    if (contentStart > 64) {
      return md.slice(contentStart);
    } else {
      return md;
    }
  }
}

function convertTables(turndownService: TurndownService): void {
  turndownService.addRule("tableCell", {
    filter: ["th", "td"],
    replacement: function (content: string, node: any): string {
      return cell(content, node);
    },
  });

  turndownService.addRule("tableRow", {
    filter: "tr",
    replacement: function (content: string, node: any): string {
      let borderCells = "";
      const alignMap: Record<string, string> = { left: ":--", right: "--:", center: ":-:" };

      if (isHeadingRow(node)) {
        for (let i = 0; i < node.childNodes.length; i++) {
          let border = "---";
          const align: string = (node.childNodes[i].getAttribute?.("align") || "").toLowerCase();
          if (align) border = (alignMap as any)[align] || border;
          borderCells += cell(border, node.childNodes[i]);
        }
      }
      return "\n" + content + (borderCells ? "\n" + borderCells : "");
    },
  });

  turndownService.addRule("table", {
    filter: ["table"],
    replacement: function (content: string): string {
      // Ensure there are no blank lines
      content = content.replace("\n\n", "\n");
      return "\n\n" + content + "\n\n";
    },
  });

  turndownService.addRule("tableSection", {
    filter: ["thead", "tbody", "tfoot"],
    replacement: function (content: string): string {
      return content;
    },
  });
}

const indexOf = Array.prototype.indexOf;
const every = Array.prototype.every;

// A tr is a heading row if:
// - the parent is a THEAD
// - or if its the first child of the TABLE or the first TBODY (possibly
//   following a blank THEAD)
// - and every cell is a TH
function isHeadingRow(tr: any): boolean {
  const parentNode = tr.parentNode;
  return (
    parentNode.nodeName === "THEAD" ||
    (parentNode.firstChild === tr &&
      (parentNode.nodeName === "TABLE" || isFirstTbody(parentNode)) &&
      every.call(parentNode ? tr.childNodes : [], function (n: any) {
        return n.nodeName === "TH";
      }))
  );
}

function isFirstTbody(element: any): boolean {
  const previousSibling = element.previousSibling;
  return (
    element.nodeName === "TBODY" &&
    (!previousSibling ||
      (previousSibling.nodeName === "THEAD" && /^\s*$/i.test(previousSibling.textContent)))
  );
}

function cell(content: string, node: any): string {
  const index = indexOf.call(node.parentNode.childNodes, node);
  let prefix = " ";
  if (index === 0) {
    prefix = "| ";
  }
  return cleanContent(prefix + content + " |");
}

function cleanContent(content: string): string {
  let output = "";
  const chars = ["\n", "\r", "\t", "\f", "\v", "\u00a0", "\u2028", "\u2029", " "];
  for (let i = 0; i < content.length; i++) {
    if (chars.includes(content[i])) {
      if (output[output.length - 1] !== " ") {
        output += " ";
      }
      continue;
    } else {
      output += content[i];
    }
  }
  return output;
} 