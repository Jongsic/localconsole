import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { handlerToFilename, zipInlineCode } from "./lambda-package";

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
