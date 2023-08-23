import axios, { AxiosRequestConfig } from "axios";
import * as cheerio from "cheerio";
import { TextFetcher } from './types';


const ALLOWED_CONTENT_TYPES = [
    "text/html",
    "application/json",
    "application/xml",
    "application/javascript",
    "text/plain",
];


const DEFAULT_HEADERS = {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate",
    "Accept-Language": "en-US,en;q=0.5",
    "Alt-Used": "LEAVE-THIS-KEY-SET-BY-TOOL",
    Connection: "keep-alive",
    Host: "LEAVE-THIS-KEY-SET-BY-TOOL",
    Referer: "https://www.google.com/",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "cross-site",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/111.0",
};

export interface WebFetcherConfig {
    headers?: Record<string,string>;
    requestConfig?: AxiosRequestConfig;
    htmlToText: boolean;
    summarizeHtml: boolean;
}

export class WebFetcher implements TextFetcher {
    private readonly _config: WebFetcherConfig;

    public constructor(config?: Partial<WebFetcherConfig>) {
        this._config = Object.assign({
            htmlToText: true,
            summarizeHtml: false,
        } as WebFetcherConfig, config);
    }

    public async fetch(uri: string): Promise<string> {
        const {data, contentType} = await this.fetchPage(uri);
        if (contentType === "text/html" && this._config.htmlToText) {
            return this.extractText(data, uri, this._config.summarizeHtml);
        } else {
            return data;
        }
    }

    private extractText(html: string, baseUrl: string, summarize: boolean): string {
        // Parse all elements including <noscript> tags
        const $ = cheerio.load(html, { scriptingEnabled: true });

        // If we want a summary, just get use the <body/>
        let text = '';
        $(`${summarize ? 'body ' : '*'}:not(style):not(script):not(svg)`).each((i, elem: any) => {
            // Remove any children to avoid duplicate text
            let content = $(elem).clone().children().remove().end().text().trim();
            const $el = $(elem);

            // Print links in markdown format
            let href = $el.attr("href");
            if ($el.prop("tagName")?.toLowerCase() === "a" && href) {
                if (!href.startsWith("http")) {
                    // Try converting to a relevant link
                    try {
                        href = new URL(href, baseUrl).toString();
                    } catch {
                        // Leave as is
                    }
                }

                // If the link has content, use that as the text
                const altText = $el.find("img[alt]").attr("alt")?.trim();
                if (altText) {
                    content += ` ${altText}`;
                }

                text += ` [${content}](${href})`;
            }
            // otherwise just print the content
            else if (content !== "") {
                text += ` ${content}`;
            }
        });

        // Remove newlines
        return text.trim().replace(/\n+/g, ' ');
    }

    private async fetchPage(baseUrl: string): Promise<{data: string; contentType: string;}> {
        const httpClient = axios.create({
            validateStatus: () => true,
        });

        // Clone headers to avoid mutating the original
        const headers = Object.assign({}, DEFAULT_HEADERS, this._config.headers)

        // get hostname from url
        const host = new URL(baseUrl).hostname;
        headers['Host'] = host;
        headers['Alt-Used'] = host;

        // Fetch page and check for errors
        const response = await httpClient.get(baseUrl, {
            headers,
            ...this._config.requestConfig,
        });
        if (response.status >= 400) {
            throw new Error(`Site returned an HTTP status of ${response.status}`);
        }

        // Check for valid content type
        const contentType = response.headers['content-type'];
        const contentTypeArray = contentType.split(';');
        if (!contentTypeArray[0] || !ALLOWED_CONTENT_TYPES.includes(contentTypeArray[0])) {
            throw new Error(`Site returned an invalid content type of ${contentType}`);
        }

        return {data: response.data, contentType: contentTypeArray[0]};
    }
}