import { TextFetcher } from './types';

/**
 * Configuration options for BrowserWebFetcher.
 */
export interface BrowserWebFetcherConfig {
    /**
     * Optional. Whether to convert HTML to a simplified text/markdown format.
     * @remarks
     * Defaults to `true`.
     */
    htmlToMarkdown?: boolean;

    /**
     * Optional. Additional headers to include in requests.
     */
    headers?: Record<string, string>;

    /**
     * Optional. Request mode for fetch.
     * @remarks
     * Defaults to 'cors'.
     */
    mode?: RequestMode;

    /**
     * Optional. Credentials mode for fetch.
     * @remarks
     * Defaults to 'same-origin'.
     */
    credentials?: RequestCredentials;
}

/**
 * Browser-compatible web fetcher using the native Fetch API.
 * @remarks
 * This fetcher works in browsers and Electron renderer processes.
 * Uses DOMParser instead of cheerio for HTML parsing.
 */
export class BrowserWebFetcher implements TextFetcher {
    private readonly _config: BrowserWebFetcherConfig;

    private static readonly ALLOWED_CONTENT_TYPES = [
        'text/html',
        'application/json',
        'application/xml',
        'application/javascript',
        'text/plain',
        'text/markdown',
        'text/xml'
    ];

    /**
     * Creates a new `BrowserWebFetcher` instance.
     * @param config Optional configuration options.
     */
    constructor(config?: BrowserWebFetcherConfig) {
        this._config = {
            htmlToMarkdown: true,
            mode: 'cors',
            credentials: 'same-origin',
            ...config
        };
    }

    /**
     * Fetches content from a URL and passes it to the document handler.
     * @param uri URL to fetch.
     * @param onDocument Callback to handle the fetched document.
     * @returns Promise that resolves to the return value of onDocument.
     */
    async fetch(
        uri: string,
        onDocument: (uri: string, text: string, docType?: string) => Promise<boolean>
    ): Promise<boolean> {
        const response = await fetch(uri, {
            method: 'GET',
            headers: this._config.headers,
            mode: this._config.mode,
            credentials: this._config.credentials
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type') || 'text/plain';
        const mimeType = contentType.split(';')[0].trim().toLowerCase();

        // Validate content type
        if (!BrowserWebFetcher.ALLOWED_CONTENT_TYPES.some(allowed => mimeType.includes(allowed))) {
            throw new Error(`Unsupported content type: ${contentType}`);
        }

        const text = await response.text();

        // Handle HTML content
        if (mimeType.includes('text/html') && this._config.htmlToMarkdown) {
            const markdown = this.htmlToMarkdown(text, uri);
            return onDocument(uri, markdown, 'md');
        }

        // Determine doc type from content type
        const docType = this.getDocTypeFromMime(mimeType);
        return onDocument(uri, text, docType);
    }

    /**
     * Converts HTML to a simplified markdown-like format using DOMParser.
     */
    private htmlToMarkdown(html: string, baseUrl: string): string {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Remove unwanted elements
        const removeSelectors = ['script', 'style', 'noscript', 'iframe', 'svg', 'canvas'];
        removeSelectors.forEach(selector => {
            doc.querySelectorAll(selector).forEach(el => el.remove());
        });

        // Convert relative URLs to absolute
        doc.querySelectorAll('a[href]').forEach(el => {
            const href = el.getAttribute('href');
            if (href && !href.startsWith('http') && !href.startsWith('//') && !href.startsWith('#')) {
                try {
                    el.setAttribute('href', new URL(href, baseUrl).toString());
                } catch {
                    // Leave as-is if URL parsing fails
                }
            }
        });

        // Process the body
        const body = doc.body;
        if (!body) {
            return html;
        }

        const lines: string[] = [];
        this.processNode(body, lines);

        // Clean up the result
        let result = lines.join('\n');

        // Remove excessive newlines
        result = result.replace(/\n{3,}/g, '\n\n');

        // Trim leading/trailing whitespace
        result = result.trim();

        return result;
    }

    /**
     * Recursively processes DOM nodes to extract text content.
     */
    private processNode(node: Node, lines: string[]): void {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent?.trim();
            if (text) {
                lines.push(text);
            }
            return;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
            return;
        }

        const el = node as Element;
        const tagName = el.tagName.toLowerCase();

        // Handle specific elements
        switch (tagName) {
            case 'h1':
                lines.push('');
                lines.push(`# ${this.getTextContent(el)}`);
                lines.push('');
                return;
            case 'h2':
                lines.push('');
                lines.push(`## ${this.getTextContent(el)}`);
                lines.push('');
                return;
            case 'h3':
                lines.push('');
                lines.push(`### ${this.getTextContent(el)}`);
                lines.push('');
                return;
            case 'h4':
                lines.push('');
                lines.push(`#### ${this.getTextContent(el)}`);
                lines.push('');
                return;
            case 'h5':
                lines.push('');
                lines.push(`##### ${this.getTextContent(el)}`);
                lines.push('');
                return;
            case 'h6':
                lines.push('');
                lines.push(`###### ${this.getTextContent(el)}`);
                lines.push('');
                return;
            case 'p':
                lines.push('');
                this.processChildren(el, lines);
                lines.push('');
                return;
            case 'br':
                lines.push('');
                return;
            case 'hr':
                lines.push('');
                lines.push('---');
                lines.push('');
                return;
            case 'a':
                const href = el.getAttribute('href');
                const text = this.getTextContent(el);
                if (href && text) {
                    lines.push(`[${text}](${href})`);
                } else if (text) {
                    lines.push(text);
                }
                return;
            case 'strong':
            case 'b':
                lines.push(`**${this.getTextContent(el)}**`);
                return;
            case 'em':
            case 'i':
                lines.push(`*${this.getTextContent(el)}*`);
                return;
            case 'code':
                lines.push(`\`${this.getTextContent(el)}\``);
                return;
            case 'pre':
                lines.push('');
                lines.push('```');
                lines.push(this.getTextContent(el));
                lines.push('```');
                lines.push('');
                return;
            case 'blockquote':
                lines.push('');
                const quoteText = this.getTextContent(el);
                quoteText.split('\n').forEach(line => {
                    lines.push(`> ${line}`);
                });
                lines.push('');
                return;
            case 'ul':
            case 'ol':
                lines.push('');
                el.querySelectorAll(':scope > li').forEach((li, index) => {
                    const prefix = tagName === 'ol' ? `${index + 1}.` : '-';
                    lines.push(`${prefix} ${this.getTextContent(li)}`);
                });
                lines.push('');
                return;
            case 'table':
                lines.push('');
                this.processTable(el, lines);
                lines.push('');
                return;
            case 'img':
                const alt = el.getAttribute('alt') || 'image';
                const src = el.getAttribute('src');
                if (src) {
                    lines.push(`![${alt}](${src})`);
                }
                return;
            default:
                // For other elements, process children
                this.processChildren(el, lines);
        }
    }

    /**
     * Processes child nodes of an element.
     */
    private processChildren(el: Element, lines: string[]): void {
        el.childNodes.forEach(child => {
            this.processNode(child, lines);
        });
    }

    /**
     * Gets clean text content from an element.
     */
    private getTextContent(el: Element): string {
        return (el.textContent || '').replace(/\s+/g, ' ').trim();
    }

    /**
     * Processes a table element to markdown format.
     */
    private processTable(table: Element, lines: string[]): void {
        const rows = table.querySelectorAll('tr');
        let isFirstRow = true;

        rows.forEach(row => {
            const cells = row.querySelectorAll('th, td');
            const cellContents: string[] = [];

            cells.forEach(cell => {
                cellContents.push(this.getTextContent(cell));
            });

            if (cellContents.length > 0) {
                lines.push(`| ${cellContents.join(' | ')} |`);

                // Add separator after header row
                if (isFirstRow) {
                    lines.push(`| ${cellContents.map(() => '---').join(' | ')} |`);
                    isFirstRow = false;
                }
            }
        });
    }

    /**
     * Maps MIME type to document type.
     */
    private getDocTypeFromMime(mimeType: string): string | undefined {
        const mimeMap: Record<string, string> = {
            'text/html': 'html',
            'text/plain': undefined as any,
            'text/markdown': 'md',
            'text/xml': 'xml',
            'application/json': 'json',
            'application/xml': 'xml',
            'application/javascript': 'js'
        };

        for (const [mime, docType] of Object.entries(mimeMap)) {
            if (mimeType.includes(mime)) {
                return docType;
            }
        }

        return undefined;
    }
}
