/** Map a source filename to a Monaco language id. Kept free of any monaco
 * import so it can be used without pulling the editor into the bundle. */
export function languageForFile(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
  switch (ext) {
    case "js":
    case "mjs":
    case "cjs":
      return "javascript";
    case "ts":
      return "typescript";
    case "py":
      return "python";
    case "rb":
      return "ruby";
    case "go":
      return "go";
    case "java":
      return "java";
    case "json":
      return "json";
    case "yaml":
    case "yml":
      return "yaml";
    case "sh":
      return "shell";
    case "html":
      return "html";
    case "css":
      return "css";
    case "md":
      return "markdown";
    default:
      return "plaintext";
  }
}
