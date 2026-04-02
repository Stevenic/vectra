import assert from "node:assert";
import { describe, it, beforeEach, afterEach } from "mocha";
import sinon from "sinon";
import { WebFetcher } from "./WebFetcher";

describe("WebFetcher", () => {
  let sandbox: sinon.SinonSandbox;
  let fetchStub: sinon.SinonStub;

  let lastUrl: string | undefined;
  let lastInit: RequestInit | undefined;

  function makeFetchResponse(status: number, data: string, contentType: string): Response {
    return {
      status,
      statusText: status >= 400 ? `HTTP ${status}` : 'OK',
      ok: status >= 200 && status < 300,
      headers: new Headers({ 'content-type': contentType }),
      text: async () => data,
      json: async () => JSON.parse(data),
    } as Response;
  }

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    fetchStub = sandbox.stub(globalThis, 'fetch').callsFake(async (input: any, init?: any) => {
      lastUrl = typeof input === 'string' ? input : input.url;
      lastInit = init;
      return makeFetchResponse(200, 'ok', 'text/plain');
    });
    lastUrl = undefined;
    lastInit = undefined;
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("constructor uses defaults and merges config", () => {
    const fetcherDefault = new WebFetcher();
    assert.strictEqual(fetcherDefault["_config"].htmlToMarkdown, true);
    assert.strictEqual(fetcherDefault["_config"].summarizeHtml, false);

    const custom = {
      htmlToMarkdown: false,
      summarizeHtml: true,
      headers: { Accept: "custom/type", "User-Agent": "custom-agent" },
      requestConfig: { signal: AbortSignal.timeout(123) },
    };
    const fetcher = new WebFetcher(custom);
    assert.strictEqual(fetcher["_config"].htmlToMarkdown, false);
    assert.strictEqual(fetcher["_config"].summarizeHtml, true);
    assert.deepStrictEqual(fetcher["_config"].headers, {
      Accept: "custom/type",
      "User-Agent": "custom-agent",
    });
    assert.ok(fetcher["_config"].requestConfig);
  });

  it("throws on HTTP error (>=400)", async () => {
    fetchStub.resolves(makeFetchResponse(404, '<html></html>', 'text/html'));
    const fetcher = new WebFetcher();
    await assert.rejects(
      () => fetcher.fetch("https://example.com/404", async () => true),
      /Site returned an HTTP status of 404/
    );
  });

  it("throws on invalid content-type", async () => {
    fetchStub.resolves(makeFetchResponse(200, '…', 'image/png'));
    const fetcher = new WebFetcher();
    await assert.rejects(
      () => fetcher.fetch("https://example.com/img", async () => true),
      /Site returned an invalid content type of image\/png/
    );
  });

  it("handles text/html with htmlToMarkdown=true with tables, alignments, and link rewriting", async () => {
    const html = `
      <html><body>
        <script>evil()</script>
        <a href="/rel">relative</a>
        <a href="//cdn.example.com/lib.js">proto-rel</a>
        <table>
          <thead>
            <tr>
              <th align="left">H1</th>
              <th align="right">H2</th>
              <th align="center">H3</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Cell&nbsp;1</td>
              <td>Cell\t2</td>
              <td>Cell\n3</td>
            </tr>
          </tbody>
        </table>
        <table>
          <tbody>
            <tr><th>A</th><th>B</th></tr>
            <tr><td>a</td><td>b</td></tr>
          </tbody>
        </table>
      </body></html>
    `;
    fetchStub.resolves(makeFetchResponse(200, html, 'text/html'));

    const fetcher = new WebFetcher({ htmlToMarkdown: true });
    const calls: any[] = [];
    const onDocument = async (uri: string, text: string, docType?: string) => {
      calls.push([uri, text, docType]);
      return true;
    };

    const ok = await fetcher.fetch("https://example.com/page", onDocument);
    assert.strictEqual(ok, true);
    assert.strictEqual(calls.length, 1);

    const [uri, md, docType] = calls[0];
    assert.strictEqual(uri, "https://example.com/page");
    assert.strictEqual(docType, "md");

    assert.ok(!String(md).includes("<script>"));
    assert.ok(String(md).includes("https://example.com/rel"));
    assert.ok(String(md).includes("https://cdn.example.com/lib.js"));
    assert.ok(String(md).includes("| H1 | H2 | H3 |"));
    assert.ok(String(md).includes("| :-- | --: | :-: |"));
    assert.ok(String(md).includes("| Cell 1 | Cell 2 | Cell 3 |"));
    assert.ok(String(md).includes("| A | B |"));
  });

  it("handles text/html with htmlToMarkdown=false (passes raw html, docType 'html')", async () => {
    const html = "<html><body><p>content</p></body></html>";
    fetchStub.resolves(makeFetchResponse(200, html, 'text/html'));

    const fetcher = new WebFetcher({ htmlToMarkdown: false });
    const calls: any[] = [];
    const onDocument = async (uri: string, text: string, docType?: string) => {
      calls.push([uri, text, docType]);
      return true;
    };

    const ok = await fetcher.fetch("https://example.com/raw", onDocument);
    assert.strictEqual(ok, true);
    assert.strictEqual(calls.length, 1);

    const [_, text, docType] = calls[0];
    assert.strictEqual(docType, "html");
    assert.strictEqual(text, html);
  });

  it("handles application/json; charset=… (docType 'json')", async () => {
    const json = '{"a":1}';
    fetchStub.resolves(makeFetchResponse(200, json, 'application/json; charset=utf-8'));
    const fetcher = new WebFetcher();
    const calls: any[] = [];
    const onDocument = async (...args: any[]) => {
      calls.push(args);
      return true;
    };
    const ok = await fetcher.fetch("https://example.com/data", onDocument);
    assert.strictEqual(ok, true);
    assert.strictEqual(calls[0][2], "json");
    assert.strictEqual(calls[0][1], json);
  });

  it("handles application/xml (docType 'xml')", async () => {
    const xml = "<root/>";
    fetchStub.resolves(makeFetchResponse(200, xml, 'application/xml'));
    const fetcher = new WebFetcher();
    const calls: any[] = [];
    const onDocument = async (...args: any[]) => {
      calls.push(args);
      return true;
    };
    const ok = await fetcher.fetch("https://example.com/xml", onDocument);
    assert.strictEqual(ok, true);
    assert.strictEqual(calls[0][2], "xml");
    assert.strictEqual(calls[0][1], xml);
  });

  it("handles application/javascript (docType 'javascript')", async () => {
    const js = "console.log('hi');";
    fetchStub.resolves(makeFetchResponse(200, js, 'application/javascript'));
    const fetcher = new WebFetcher();
    const calls: any[] = [];
    const onDocument = async (...args: any[]) => {
      calls.push(args);
      return true;
    };
    const ok = await fetcher.fetch("https://example.com/app.js", onDocument);
    assert.strictEqual(ok, true);
    assert.strictEqual(calls[0][2], "javascript");
    assert.strictEqual(calls[0][1], js);
  });

  it("handles text/plain (docType undefined)", async () => {
    const text = "plain";
    fetchStub.resolves(makeFetchResponse(200, text, 'text/plain'));
    const fetcher = new WebFetcher();
    const calls: any[] = [];
    const onDocument = async (...args: any[]) => {
      calls.push(args);
      return true;
    };
    const ok = await fetcher.fetch("https://example.com/txt", onDocument);
    assert.strictEqual(ok, true);
    assert.strictEqual(calls[0][2], undefined);
    assert.strictEqual(calls[0][1], text);
  });

  it("sets Host and Alt-Used to request hostname; merges and does not mutate caller headers", async () => {
    let capturedUrl: string | undefined;
    let capturedInit: RequestInit | undefined;
    fetchStub.callsFake(async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedInit = init;
      return makeFetchResponse(200, 'ok', 'text/plain');
    });

    const userHeaders: Record<string, string> = {
      Accept: "custom/type",
      "User-Agent": "custom-agent",
    };
    const fetcher = new WebFetcher({ headers: userHeaders });

    const onDocument = async () => true;
    const url = "https://host.example.com/path?q=1";
    const ok = await fetcher.fetch(url, onDocument);
    assert.strictEqual(ok, true);

    assert.strictEqual(capturedUrl, url);
    assert.ok(capturedInit);
    assert.ok(capturedInit!.headers);

    const headers = capturedInit!.headers as Record<string, string>;
    assert.strictEqual(headers.Host, "host.example.com");
    assert.strictEqual(headers["Alt-Used"], "host.example.com");

    assert.strictEqual(headers.Accept, "custom/type");
    assert.strictEqual(headers["User-Agent"], "custom-agent");

    assert.strictEqual((userHeaders as any).Host, undefined);
    assert.strictEqual((userHeaders as any)["Alt-Used"], undefined);
  });

  it("merges requestConfig options into fetch call", async () => {
    let capturedInit: RequestInit | undefined;
    fetchStub.callsFake(async (_url: string, init?: RequestInit) => {
      capturedInit = init;
      return makeFetchResponse(200, 'ok', 'text/plain');
    });

    const fetcher = new WebFetcher({
      requestConfig: { keepalive: true },
    });
    const ok = await fetcher.fetch("https://example.com", async () => true);
    assert.strictEqual(ok, true);
    assert.strictEqual(capturedInit!.keepalive, true);
  });

  it("htmlToMarkdown trims overly long header text when first space/newline index > 64", () => {
    const fetcher = new WebFetcher();
    const longText = "a".repeat(70) + " rest\nmore";
    const html = `<html><body><p>${longText}</p></body></html>`;
    const md = (fetcher as any)["htmlToMarkdown"](html, "https://example.com");
    assert.ok(!md.startsWith("a".repeat(70)));
    assert.ok(md.includes("rest"));
  });

  it("htmlToMarkdown leaves short content unchanged", () => {
    const fetcher = new WebFetcher();
    const html = `<html><body><p>short text</p></body></html>`;
    const md = (fetcher as any)["htmlToMarkdown"](html, "https://example.com");
    assert.ok(md.includes("short text"));
  });

  it("propagates onDocument return value (true/false)", async () => {
    fetchStub.resolves(makeFetchResponse(200, 'ok', 'text/plain'));
    const fetcher = new WebFetcher();
    const yes = await fetcher.fetch("https://example.com/yes", async () => true);
    const no = await fetcher.fetch("https://example.com/no", async () => false);
    assert.strictEqual(yes, true);
    assert.strictEqual(no, false);
  });
});
