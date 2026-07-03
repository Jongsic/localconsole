import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

/**
 * Build a deployment-package zip in the browser from a single inline source
 * file. Lambda accepts a raw zip as `Code.ZipFile`, so this is enough to ship
 * a hello-world function without any server-side packaging.
 */
export function zipInlineCode(filename: string, code: string): Uint8Array {
  return zipSync({ [filename]: strToU8(code) });
}

/** Rough guess at whether a file is binary (has NUL bytes in its first chunk). */
function looksBinary(bytes: Uint8Array): boolean {
  const limit = Math.min(bytes.length, 8000);
  for (let i = 0; i < limit; i++) {
    if (bytes[i] === 0) return true;
  }
  return false;
}

export type ZipEntry = {
  path: string;
  /** Decoded text, or null when the entry looks binary and can't be edited. */
  text: string | null;
  size: number;
};

/** Unzip a deployment package into per-file entries (directories dropped). */
export function unzipToEntries(bytes: Uint8Array): ZipEntry[] {
  const files = unzipSync(bytes);
  const entries: ZipEntry[] = [];
  for (const [path, data] of Object.entries(files)) {
    if (path.endsWith("/")) continue; // directory marker
    entries.push({
      path,
      text: looksBinary(data) ? null : strFromU8(data),
      size: data.length,
    });
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Re-zip a package from edited text entries. Binary entries (text === null) are
 * carried over untouched from the original file map so a save preserves them.
 */
export function zipFromEntries(entries: ZipEntry[], original: Uint8Array): Uint8Array {
  const originalFiles = unzipSync(original);
  const out: Record<string, Uint8Array> = {};
  for (const entry of entries) {
    out[entry.path] =
      entry.text === null ? (originalFiles[entry.path] ?? new Uint8Array()) : strToU8(entry.text);
  }
  return zipSync(out);
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
