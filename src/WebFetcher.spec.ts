import assert from "node:assert";
import { describe, it, beforeEach } from "mocha";
import proxyquire from "proxyquire";
import { AxiosRequestConfig } from "axios";

describe("WebFetcher", () => {
  let WebFetcher: any;

  let mockResponse: any;
  let lastUri: string | undefined;
  let lastConfig: AxiosRequestConfig | undefined;

  function resetAxiosRecorder() {
    mockResponse = undefined;
    lastUri = undefined;
    lastConfig = undefined;
  }

  function loadModule() {
    const axiosGet = async (uri: string, config: AxiosRequestConfig) => {
      lastUri = uri;
      lastConfig = config;
      return mockResponse;
    };

    const module = proxyquire.noCallThru().load("./WebFetcher", {
      axios: {
        create: () => ({ get: axiosGet }),
      },
      cheerio: require("cheerio"),
      turndown: require("turndown"),
    });

    WebFetcher = module.WebFetcher;
  }

  beforeEach(() => {
    resetAxiosRecorder();
    loadModule();
  });

  it("constructor uses defaults and merges config", () => {
    const fetcherDefault = new WebFetcher();
    assert.strictEqual(fetcherDefault["_config"].htmlToMarkdown, true);
    assert.strictEqual(fetcherDefault["_config"].summarizeHtml, false);

    const custom = {
      htmlToMarkdown: false,
      summarizeHtml: true,
      headers: { Accept: "custom/type", "User-Agent": "custom-agent" },
      requestConfig: { timeout: 123 },
    };
    const fetcher = new WebFetcher(custom);
    assert.strictEqual(fetcher["_config"].htmlToMarkdown, false);
    assert.strictEqual(fetcher["_config"].summarizeHtml, true);
    assert.deepStrictEqual(fetcher["_config"].headers, {
      Accept: "custom/type",
      "User-Agent": "custom-agent",
    });
    assert.deepStrictEqual(fetcher["_config"].requestConfig, { timeout: 123 });
  });

  it("throws on HTTP error (>=400)", async () => {
    mockResponse = {
      status: 404,
      headers: { "content-type": "text/html" },
      data: "<html></html>",
    };
    const fetcher = new WebFetcher();
    await assert.rejects(
      () => fetcher.fetch("https://example.com/404", async () => true),
      /Site returned an HTTP status of 404/
    );
  });

  it("throws on invalid content-type", async () => {
    mockResponse = {
      status: 200,
      headers: { "content-type": "image/png" },
      data: "…",
    };
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
    mockResponse = {
      status: 200,
      headers: { "content-type": "text/html" },
      data: html,
    };

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
    mockResponse = {
      status: 200,
      headers: { "content-type": "text/html" },
      data: html,
    };

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
    mockResponse = {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
      data: json,
    };
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
    mockResponse = {
      status: 200,
      headers: { "content-type": "application/xml" },
      data: xml,
    };
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
    mockResponse = {
      status: 200,
      headers: { "content-type": "application/javascript" },
      data: js,
    };
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
    mockResponse = {
      status: 200,
      headers: { "content-type": "text/plain" },
      data: text,
    };
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
    mockResponse = {
      status: 200,
      headers: { "content-type": "text/plain" },
      data: "ok",
    };

    const userHeaders: Record<string, string> = {
      Accept: "custom/type",
      "User-Agent": "custom-agent",
    };
    const fetcher = new WebFetcher({ headers: userHeaders });

    const onDocument = async () => true;
    const url = "https://host.example.com/path?q=1";
    const ok = await fetcher.fetch(url, onDocument);
    assert.strictEqual(ok, true);

    assert.strictEqual(lastUri, url);
    assert.ok(lastConfig);
    assert.ok(lastConfig!.headers);

    assert.strictEqual((lastConfig!.headers as any).Host, "host.example.com");
    assert.strictEqual((lastConfig!.headers as any)["Alt-Used"], "host.example.com");

    assert.strictEqual((lastConfig!.headers as any).Accept, "custom/type");
    assert.strictEqual((lastConfig!.headers as any)["User-Agent"], "custom-agent");

    assert.strictEqual((userHeaders as any).Host, undefined);
    assert.strictEqual((userHeaders as any)["Alt-Used"], undefined);
  });

  it("merges requestConfig options into axios.get call", async () => {
    mockResponse = {
      status: 200,
      headers: { "content-type": "text/plain" },
      data: "ok",
    };

    const fetcher = new WebFetcher({
      requestConfig: { timeout: 5000, params: { a: 1 } },
    });
    const ok = await fetcher.fetch("https://example.com", async () => true);
    assert.strictEqual(ok, true);
    assert.strictEqual(lastConfig!.timeout, 5000);
    assert.deepStrictEqual(lastConfig!.params, { a: 1 });
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
    mockResponse = {
      status: 200,
      headers: { "content-type": "text/plain" },
      data: "ok",
    };
    const fetcher = new WebFetcher();
    const yes = await fetcher.fetch("https://example.com/yes", async () => true);
    const no = await fetcher.fetch("https://example.com/no", async () => false);
    assert.strictEqual(yes, true);
    assert.strictEqual(no, false);
  });
});