import { strFromU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { handlerToFilename, unzipToEntries, zipFromEntries, zipInlineCode } from "./lambda-package";

describe("handlerToFilename", () => {
  it("nodejs default index.handler → index.mjs", () => {
    expect(handlerToFilename("index.handler", "nodejs20.x")).toBe("index.mjs");
  });

  it("nodejs non-default handler → <base>.js", () => {
    expect(handlerToFilename("app.handler", "nodejs22.x")).toBe("app.js");
  });

  it("python → <base>.py", () => {
    expect(handlerToFilename("lambda_function.lambda_handler", "python3.12")).toBe(
      "lambda_function.py",
    );
  });

  it("ruby → <base>.rb", () => {
    expect(handlerToFilename("lambda_function.handler", "ruby3.3")).toBe("lambda_function.rb");
  });

  it("unknown runtime → index.js", () => {
    expect(handlerToFilename("whatever.handler", "go1.x")).toBe("index.js");
  });

  it("empty handler base falls back to index", () => {
    expect(handlerToFilename(".handler", "python3.13")).toBe("index.py");
  });
});

describe("zipInlineCode", () => {
  it("produces a non-empty zip readable back to the original code", () => {
    const code = 'export const handler = async () => ({ statusCode: 200, body: "ok" });\n';
    const bytes = zipInlineCode("index.mjs", code);

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);

    const unzipped = unzipSync(bytes);
    expect(Object.keys(unzipped)).toEqual(["index.mjs"]);
    expect(strFromU8(unzipped["index.mjs"] as Uint8Array)).toBe(code);
  });
});

describe("unzipToEntries", () => {
  it("returns sorted text entries, drops directory markers, flags binary files", () => {
    const bin = new Uint8Array([1, 2, 0, 3, 4]); // contains a NUL → binary
    const zip = zipSync({
      "src/": new Uint8Array(),
      "index.mjs": strToBytes("export const handler = () => {};\n"),
      "data.bin": bin,
    });
    const entries = unzipToEntries(zip);
    expect(entries.map((e) => e.path)).toEqual(["data.bin", "index.mjs"]);
    expect(entries.find((e) => e.path === "index.mjs")?.text).toContain("handler");
    expect(entries.find((e) => e.path === "data.bin")?.text).toBeNull();
  });
});

describe("zipFromEntries", () => {
  it("round-trips edited text and preserves binary entries from the original", () => {
    const bin = new Uint8Array([1, 2, 0, 3, 4]);
    const original = zipSync({
      "index.mjs": strToBytes("old\n"),
      "data.bin": bin,
    });
    const entries = unzipToEntries(original).map((e) =>
      e.path === "index.mjs" ? { ...e, text: "new code\n" } : e,
    );
    const rezipped = zipFromEntries(entries, original);
    const files = unzipSync(rezipped);
    expect(strFromU8(files["index.mjs"] as Uint8Array)).toBe("new code\n");
    expect(Array.from(files["data.bin"] as Uint8Array)).toEqual(Array.from(bin));
  });
});

function strToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}
