import type { AxiosRequestConfig } from "axios";
import axios from "axios";
import { TextFetcher } from "./types";
import * as cheerio from "cheerio";
import type { Node, Element, Text } from "domhandler";
import TurndownService from "turndown";

const ALLOWED_CONTENT_TYPES = [
    "text/html",
    "application/json",
    "application/xml",
    "application/javascript",
    "text/plain",
];

const DEFAULT_HEADERS = {
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

/**
 * Configuration for the WebFetcher.
 * @public
 */
export interface WebFetcherConfig {
    headers?: Record<string,string>;
    requestConfig?: AxiosRequestConfig;
    htmlToMarkdown: boolean;
    summarizeHtml: boolean;
}

/**
 * Fetches text content from web pages.
 * @public
 */
export class WebFetcher implements TextFetcher {
    private readonly _config: WebFetcherConfig;

    public constructor(config?: Partial<WebFetcherConfig>) {
        this._config = Object.assign({
            htmlToMarkdown: true,
            summarizeHtml: false,
        } as WebFetcherConfig, config);
    }

    public async fetch(uri: string, onDocument: (uri: string, text: string, docType?: string) => Promise<boolean>): Promise<boolean> {
        const httpClient = axios.create({
            validateStatus: () => true,
        });

        // Clone headers to avoid mutating the original
        const headers = Object.assign({}, DEFAULT_HEADERS, this._config.headers);

        // get hostname from url
        const host = new URL(uri).hostname;
        headers["Host"] = host;
        headers["Alt-Used"] = host;

        // Fetch page and check for errors
        const response = await httpClient.get(uri, {
            headers,
            ...this._config.requestConfig,
        });
        if (response.status >= 400) {
            throw new Error(`Site returned an HTTP status of ${response.status}`);
        }

        // Check for valid content type
        const contentType = response.headers["content-type"];
        const contentTypeArray = contentType.split(";");
        if (!contentTypeArray[0] || !ALLOWED_CONTENT_TYPES.includes(contentTypeArray[0])) {
            throw new Error(`Site returned an invalid content type of ${contentType}`);
        }

        // Convert content type to doc type
        const docType = contentTypeArray[0] != "text/plain" ? contentTypeArray[0].split("/")[1] : undefined;
        if (docType == "html" && this._config.htmlToMarkdown) {
            const text = this.htmlToMarkdown(response.data as string, uri);
            return await onDocument(uri, text, docType);
        } else {
            const text = response.data as string;
            return await onDocument(uri, text, docType);
        }
    }

    private htmlToMarkdown(html: string, uri: string): string {
        const $ = cheerio.load(html);

        // Remove scripts and convert relative links to absolute
        $("script").remove();
        $("a").each((i, elem) => {
            const $el = $(elem);
            const href = $el.attr("href");
            if (href && !href.startsWith("http")) {
                // Try converting to an absolute link
                try {
                    $el.attr("href", new URL(href, uri).toString());
                } catch {
                    // Leave as is
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
        const contentStart = Math.min(md.indexOf("\n"), md.indexOf(" "));
        if (contentStart > 64) {
            return md.slice(contentStart);
        } else {
            return md;
        }
    }

    private cleanupHtml(node: Element): void {
        if (node.type === "tag" && node.children && node.children.length > 0) {
            for (let i = 0; i < node.children.length; i++) {
                // Remove unused childNode variable
                // ... rest of the function
            }
        }
    }
}

function convertTables(turndownService: TurndownService): void {
    turndownService.addRule("tableCell", {
        filter: ["th", "td"],
        replacement: function (content) {
            return cell(content, this as unknown as Element);
        }
    });

    turndownService.addRule("tableRow", {
        filter: "tr",
        replacement: function (content) {
            let borderCells = "";
            const alignMap: Record<string, string> = { left: ":--", right: "--:", center: ":-:" };

            const element = this as unknown as Element;
            if (element.type === "tag" && isHeadingRow(element)) {
                if (element.children) {
                    for (let i = 0; i < element.children.length; i++) {
                        let border = "---";
                        const child = element.children[i] as Element;
                        if (child.type === "tag") {
                            const align: string = (child.attribs?.align || "").toLowerCase();
                            if (align) border = alignMap[align] || border;
                            borderCells += cell(border, child);
                        }
                    }
                }
            }
            return "\n" + content + (borderCells ? "\n" + borderCells : "");
        }
    });

    turndownService.addRule("table", {
        filter: ["table"],
        replacement: function (content) {
            // Ensure there are no blank lines
            content = content.replace("\n\n", "\n");
            return "\n\n" + content + "\n\n";
        }
    });

    turndownService.addRule("tableSection", {
        filter: ["thead", "tbody", "tfoot"],
        replacement: function (content) {
            return content;
        }
    });
}

const indexOf = Array.prototype.indexOf;
const every = Array.prototype.every;

// A tr is a heading row if:
// - the parent is a THEAD
// - or if its the first child of the TABLE or the first TBODY (possibly
//   following a blank THEAD)
// - and every cell is a TH
function isHeadingRow(tr: Element): boolean {
    if (tr.type !== "tag") return false;
    const parentNode = tr.parent as Element;
    if (!parentNode || parentNode.type !== "tag") return false;
    
    return (
        parentNode.name === "thead" ||
        (
            parentNode.firstChild === tr &&
            (parentNode.name === "table" || isFirstTbody(parentNode)) &&
            every.call(tr.children, function (n) { 
                return (n as Element).type === "tag" && (n as Element).name === "th"; 
            })
        )
    );
}

function isFirstTbody(element: Element): boolean {
    if (element.type !== "tag") return false;
    const previousSibling = element.prev as Element;
    if (!previousSibling || previousSibling.type !== "tag") return false;
    
    return (
        element.name === "tbody" && (
            !previousSibling ||
            (
                previousSibling.name === "thead" &&
                /^\s*$/i.test(previousSibling.children?.map(c => (c as Node).type === "text" ? (c as Text).data : "").join("") || "")
            )
        )
    );
}

function cell(content: string, node: Element): string {
    if (node.type !== "tag" || !node.parent) return content;
    const index = indexOf.call(node.parent.children, node);
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
            if (output[output.length - 1] != " ") {
                output += " ";
            }
            continue;
        } else {
            output += content[i];
        }
    }
    return output;
}
