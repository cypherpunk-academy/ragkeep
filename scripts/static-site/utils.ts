import fs from "node:fs";
import path from "node:path";

export function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function ensureCleanDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function parseAuthorAndTitle(dirName: string): { author: string; title: string } {
  const parts = dirName.split("#");
  const authorRaw = parts[0] ?? "";
  const titleRaw = parts[1] ?? dirName;
  const decode = (value: string) => value.replace(/_/g, " ");
  return {
    author: decode(authorRaw),
    title: decode(titleRaw),
  };
}

export function normalizeBookId(value: string): string {
  return String(value).replace(/\\#/g, "#").trim();
}

export function parseBookString(bookStr: string): { author: string; title: string; id: string } {
  const decoded = String(bookStr ?? "");
  const parts = decoded.split("#");
  const author = (parts[0] ?? "").replace(/_/g, " ").trim();
  const title = (parts[1] ?? decoded).replace(/_/g, " ").trim();
  const id = (parts[2] ?? "").trim();
  return { author, title, id };
}

export function findHtmlDirForBook(bookRootDir: string): string | null {
  const rootHtml = path.join(bookRootDir, "html");
  const resultsHtml = path.join(bookRootDir, "results", "html");
  const rootIndex = path.join(rootHtml, "index.html");
  const resultsIndex = path.join(resultsHtml, "index.html");
  if (fileExists(rootIndex)) return rootHtml;
  if (fileExists(resultsIndex)) return resultsHtml;
  return null;
}

export function readScalarFromManifest(absBookDir: string, key: string): string {
  const filePath = path.join(absBookDir, "book-manifest.yaml");
  if (!fileExists(filePath)) return "";
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const matcher = new RegExp(`^${key}:\\s*(.*)\\s*$`);

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx] ?? "";
    const match = line.match(matcher);
    if (!match) continue;

    let value = (match[1] ?? "").trim();
    if (!value) return "";

    if (value.startsWith('"')) {
      value = value.slice(1);
      while (true) {
        const endIdx = value.indexOf('"');
        if (endIdx !== -1) {
          value = value.slice(0, endIdx);
          break;
        }
        lineIdx += 1;
        const nextLine = lines[lineIdx];
        if (nextLine == null) break;
        value += ` ${nextLine.trim()}`;
      }
    }

    return value.replace(/\s+/g, " ").trim();
  }

  return "";
}

export function writeTextFile(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
}

export function renderInlineWithEmphasis(value: string): string {
  let text = String(value || "");
  text = text.replace(/<\s*\/\s*em\s*>/gi, "__EM_CLOSE__");
  text = text.replace(/<\s*em\s*>/gi, "__EM_OPEN__");
  text = text.replace(/<\s*\/\s*i\s*>/gi, "__EM_CLOSE__");
  text = text.replace(/<\s*i\s*>/gi, "__EM_OPEN__");
  text = text.replace(/<[^>]*>/g, "");
  text = escapeHtml(text);
  return text.replace(/__EM_OPEN__/g, "<em>").replace(/__EM_CLOSE__/g, "</em>");
}

export function renderSummaryHtml(text: string): string {
  const cleaned = String(text || "").replace(/\*\*/g, "");
  const paras = cleaned
    .split(/\n\s*\n/g)
    .map((item) => item.trim())
    .filter(Boolean);
  const safe = paras
    .map((item) => `<p>${renderInlineWithEmphasis(item).replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return safe || `<p>${renderInlineWithEmphasis(cleaned)}</p>`;
}
