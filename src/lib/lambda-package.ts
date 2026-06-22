import { strToU8, zipSync } from "fflate";

/**
 * Build a deployment-package zip in the browser from a single inline source
 * file. Lambda accepts a raw zip as `Code.ZipFile`, so this is enough to ship
 * a hello-world function without any server-side packaging.
 */
export function zipInlineCode(filename: string, code: string): Uint8Array {
  return zipSync({ [filename]: strToU8(code) });
}

/**
 * Derive the source filename Lambda expects for a given handler + runtime.
 *
 * The "base" is the part of the handler before the first dot (e.g. `index`
 * from `index.handler`). The extension is chosen from the runtime family:
 *   - nodejs*  → `.mjs` for the `index.handler` default, otherwise `.js`
 *   - python*  → `.py`
 *   - ruby*    → `.rb`
 *   - anything else → `index.js`
 */
export function handlerToFilename(handler: string, runtime: string): string {
  const base = (handler.split(".")[0] || "index").trim() || "index";

  if (runtime.startsWith("nodejs")) {
    // Default node hello-world ships as an ESM module (index.mjs).
    return handler === "index.handler" ? "index.mjs" : `${base}.js`;
  }
  if (runtime.startsWith("python")) {
    return `${base}.py`;
  }
  if (runtime.startsWith("ruby")) {
    return `${base}.rb`;
  }
  return "index.js";
}
