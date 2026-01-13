import { strict as assert } from "node:assert";
import * as path from "path";
import { describe, it, beforeEach } from "mocha";
import * as LocalDocumentModule from "../src/LocalDocument";

// Support both default and named export styles
type LocalDocumentCtor = new (index: any, id: string, uri: string) => any;
const LocalDocument: LocalDocumentCtor =
  (LocalDocumentModule as any).LocalDocument ??
  (LocalDocumentModule as any).default;

if (!LocalDocument) {
  throw new Error(
    'Unable to import LocalDocument (neither named "LocalDocument" nor default export found).'
  );
}

describe("LocalDocument", () => {
  let calls: { method: string; args: any[] }[];
  let indexStub: any;
  let storageStub: any;
  let tokenizerStub: any;
  let doc: InstanceType<LocalDocumentCtor>;
  const folderPath = "/folder";
  const id = "doc1";
  const uri = "file:///doc1";

  beforeEach(() => {
    calls = [];
    storageStub = {
      readFile: async (filePath: string) => {
        calls.push({ method: "readFile", args: [filePath] });
        if (filePath.endsWith(".txt")) {
          return Buffer.from("hello world", "utf8");
        }
        if (filePath.endsWith(".json")) {
          return Buffer.from(JSON.stringify({ key: "value" }), "utf8");
        }
        throw new Error("File not found");
      },
      pathExists: async (filePath: string) => {
        calls.push({ method: "pathExists", args: [filePath] });
        return filePath.endsWith(".json");
      },
    };
    tokenizerStub = {
      encode: (text: string) => {
        calls.push({ method: "encode", args: [text] });
        return Array.from(text);
      },
    };
    indexStub = {
      folderPath,
      storage: storageStub,
      tokenizer: tokenizerStub,
    };
    doc = new LocalDocument(indexStub, id, uri);
  });

  it("constructor and getters", () => {
    assert.equal(doc.id, id);
    assert.equal(doc.uri, uri);
    assert.equal(doc.folderPath, folderPath);
  });

  describe("loadText", () => {
    it("loads and caches text", async () => {
      const text1 = await doc.loadText();
      const text2 = await doc.loadText();
      assert.equal(text1, "hello world");
      assert.equal(text2, "hello world");

      const readFileCalls = calls.filter((c) => c.method === "readFile");
      assert.equal(readFileCalls.length, 1);
      assert.equal(
        readFileCalls[0].args[0],
        path.join(folderPath, `${id}.txt`)
      );
    });

    it("throws on read error with uri in message", async () => {
      storageStub.readFile = async (filePath: string) => {
        calls.push({ method: "readFile", args: [filePath] });
        throw new Error("read error");
      };
      const doc2 = new LocalDocument(indexStub, id, uri);
      await assert.rejects(
        () => doc2.loadText(),
        (err: any) =>
          String(err.message).includes(
            `Error reading text file for document "${uri}":`
          )
      );
    });
  });

  describe("hasMetadata", () => {
    it("returns true if metadata exists, using correct path", async () => {
      const result = await doc.hasMetadata();
      assert.equal(result, true);
      const pe = calls.find((c) => c.method === "pathExists");
      assert.ok(pe);
      assert.equal(pe!.args[0], path.join(folderPath, `${id}.json`));
    });

    it("returns false if metadata does not exist", async () => {
      storageStub.pathExists = async (filePath: string) => {
        calls.push({ method: "pathExists", args: [filePath] });
        return false;
      };
      const doc2 = new LocalDocument(indexStub, id, uri);
      const result = await doc2.hasMetadata();
      assert.equal(result, false);
    });
  });

  describe("loadMetadata", () => {
    it("loads and caches metadata, using correct path", async () => {
      const meta1 = await doc.loadMetadata();
      const meta2 = await doc.loadMetadata();
      assert.deepEqual(meta1, { key: "value" });
      assert.equal(meta1, meta2);

      const jsonCalls = calls.filter(
        (c) => c.method === "readFile" && c.args[0].endsWith(".json")
      );
      assert.equal(jsonCalls.length, 1);
      assert.equal(jsonCalls[0].args[0], path.join(folderPath, `${id}.json`));
    });

    it("throws on read error with uri in message", async () => {
      storageStub.readFile = async (filePath: string) => {
        calls.push({ method: "readFile", args: [filePath] });
        if (filePath.endsWith(".json")) throw new Error("read error");
        return Buffer.from("ok", "utf8");
      };
      const doc2 = new LocalDocument(indexStub, id, uri);
      await assert.rejects(
        () => doc2.loadMetadata(),
        (err: any) =>
          String(err.message).includes(
            `Error reading metadata for document "${uri}":`
          )
      );
    });

    it("throws on parse error with uri in message", async () => {
      storageStub.readFile = async (filePath: string) => {
        calls.push({ method: "readFile", args: [filePath] });
        if (filePath.endsWith(".json")) return Buffer.from("{", "utf8");
        return Buffer.from("ok", "utf8");
      };
      const doc2 = new LocalDocument(indexStub, id, uri);
      await assert.rejects(
        () => doc2.loadMetadata(),
        (err: any) =>
          String(err.message).includes(
            `Error parsing metadata for document "${uri}":`
          )
      );
    });
  });

  describe("getLength", () => {
    it("uses tokenizer.encode for small text (≤ 40,000 chars)", async () => {
      tokenizerStub.encode = (text: string) => {
        calls.push({ method: "encode", args: [text] });
        return new Array(5);
      };
      storageStub.readFile = async (filePath: string) => {
        calls.push({ method: "readFile", args: [filePath] });
        return Buffer.from("small text", "utf8");
      };
      const doc2 = new LocalDocument(indexStub, id, uri);
      const length = await doc2.getLength();
      assert.equal(length, 5);
      assert.ok(calls.some((c) => c.method === "encode"));
    });

    it("estimates length for large text (> 40,000 chars) without encoding", async () => {
      const largeText = "a".repeat(40001);
      storageStub.readFile = async (filePath: string) => {
        calls.push({ method: "readFile", args: [filePath] });
        return Buffer.from(largeText, "utf8");
      };
      tokenizerStub.encode = () => {
        throw new Error("encode should not be called for large text");
      };
      const doc2 = new LocalDocument(indexStub, id, uri);
      const length = await doc2.getLength();
      assert.equal(length, Math.ceil(40001 / 4));
    });

    it("reuses cached text across calls (no extra reads)", async () => {
      tokenizerStub.encode = (text: string) => new Array(text.length);
      storageStub.readFile = async (filePath: string) => {
        calls.push({ method: "readFile", args: [filePath] });
        return Buffer.from("small text", "utf8");
      };
      const doc2 = new LocalDocument(indexStub, id, uri);

      const length1 = await doc2.getLength();
      const length2 = await doc2.getLength();
      assert.equal(length1, length2);

      const readFileCalls = calls.filter((c) => c.method === "readFile");
      assert.equal(readFileCalls.length, 1);
      assert.equal(readFileCalls[0].args[0], path.join(folderPath, `${id}.txt`));
    });
  });
});