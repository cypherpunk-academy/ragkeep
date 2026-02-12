#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

type ManifestData = {
  name?: string;
  ["rag-collection"]?: string;
  description?: string;
  ["writing-style"]?: string;
  ["primary-books"]?: unknown;
  ["secondary-books"]?: unknown;
  concepts?: unknown;
  essays?: unknown;
};

type AgentRecord = {
  id: string;
  name: string;
  ragCollection: string;
  description: string;
  writingStyle: string;
  primaryBooks: string[];
  secondaryBooks: string[];
  concepts: string[];
  essays: string[];
};

type BookResolution = {
  bookDir: string;
  absBookDir: string;
  absHtmlDir: string;
};

const REPO_ROOT = process.cwd();
const ASSISTANTS_DIR = path.join(REPO_ROOT, "assistants");
const BOOKS_DIR = path.join(REPO_ROOT, "books");
const APP_PUBLIC_DIR = path.join(REPO_ROOT, "_figma-prototype", "public");
const OUTPUT_DATA_PATH = path.join(APP_PUBLIC_DIR, "data", "assistants.json");
const OUTPUT_BOOKS_DIR = path.join(APP_PUBLIC_DIR, "books");
const OUTPUT_ASSISTANTS_DIR = path.join(APP_PUBLIC_DIR, "assistants");

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function normalizeBookId(bookId: string): string {
  return bookId.replace(/\\#/g, "#").trim();
}

function ensureCleanDir(dirPath: string): void {
  fs.rmSync(dirPath, { recursive: true, force: true });
  fs.mkdirSync(dirPath, { recursive: true });
}

function findHtmlDirForBook(absBookDir: string): string | null {
  const rootHtml = path.join(absBookDir, "html");
  const legacyHtml = path.join(absBookDir, "results", "html");
  const rootIndex = path.join(rootHtml, "index.html");
  const legacyIndex = path.join(legacyHtml, "index.html");

  if (fs.existsSync(rootIndex)) return rootHtml;
  if (fs.existsSync(legacyIndex)) return legacyHtml;
  return null;
}

function resolveBook(bookDir: string): BookResolution | null {
  const absBookDir = path.join(BOOKS_DIR, bookDir);
  if (!fs.existsSync(absBookDir) || !fs.statSync(absBookDir).isDirectory()) {
    return null;
  }
  const absHtmlDir = findHtmlDirForBook(absBookDir);
  if (!absHtmlDir) return null;
  return { bookDir, absBookDir, absHtmlDir };
}

function readManifest(absManifestPath: string): ManifestData {
  const content = fs.readFileSync(absManifestPath, "utf8");
  const parsed = yaml.load(content);
  if (!parsed || typeof parsed !== "object") {
    return {};
  }
  return parsed as ManifestData;
}

function copySelectedFiles(params: {
  sourceDir: string;
  outputDir: string;
  selectedNames: string[];
}): string[] {
  const { sourceDir, outputDir, selectedNames } = params;
  fs.mkdirSync(outputDir, { recursive: true });

  const copied: string[] = [];
  for (const name of selectedNames) {
    const absSource = path.join(sourceDir, name);
    if (!fs.existsSync(absSource) || !fs.statSync(absSource).isFile()) {
      continue;
    }
    const absDest = path.join(outputDir, name);
    fs.cpSync(absSource, absDest, { recursive: false });
    copied.push(name);
  }
  return copied;
}

function collectAgentsAndBooks(): {
  agents: AgentRecord[];
  booksToCopy: Map<string, BookResolution>;
} {
  const agents: AgentRecord[] = [];
  const booksToCopy = new Map<string, BookResolution>();

  if (!fs.existsSync(ASSISTANTS_DIR)) {
    return { agents, booksToCopy };
  }

  const assistantEntries = fs
    .readdirSync(ASSISTANTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  for (const assistantId of assistantEntries) {
    const assistantDir = path.join(ASSISTANTS_DIR, assistantId);
    const manifestPath = path.join(assistantDir, "assistant-manifest.yaml");
    if (!fs.existsSync(manifestPath)) continue;

    const manifest = readManifest(manifestPath);

    const primaryBooksRaw = asStringArray(manifest["primary-books"]).map(normalizeBookId);
    const secondaryBooksRaw = asStringArray(manifest["secondary-books"]).map(normalizeBookId);

    const primaryBooks: string[] = [];
    const secondaryBooks: string[] = [];

    for (const bookDir of primaryBooksRaw) {
      const resolved = resolveBook(bookDir);
      if (!resolved) continue;
      primaryBooks.push(bookDir);
      booksToCopy.set(bookDir, resolved);
    }

    for (const bookDir of secondaryBooksRaw) {
      const resolved = resolveBook(bookDir);
      if (!resolved) continue;
      secondaryBooks.push(bookDir);
      booksToCopy.set(bookDir, resolved);
    }

    const essaysRequested = asStringArray(manifest.essays);
    const conceptsRequested = asStringArray(manifest.concepts);

    const copiedEssays = copySelectedFiles({
      sourceDir: path.join(assistantDir, "essays"),
      outputDir: path.join(OUTPUT_ASSISTANTS_DIR, assistantId, "essays"),
      selectedNames: essaysRequested,
    });

    const copiedConcepts = copySelectedFiles({
      sourceDir: path.join(assistantDir, "concepts"),
      outputDir: path.join(OUTPUT_ASSISTANTS_DIR, assistantId, "concepts"),
      selectedNames: conceptsRequested,
    });

    agents.push({
      id: assistantId,
      name: manifest.name?.trim() || assistantId,
      ragCollection: manifest["rag-collection"]?.trim() || assistantId,
      description: manifest.description?.trim() || "",
      writingStyle: manifest["writing-style"]?.trim() || "",
      primaryBooks,
      secondaryBooks,
      essays: copiedEssays,
      concepts: copiedConcepts,
    });
  }

  return { agents, booksToCopy };
}

function copyReferencedBooks(booksToCopy: Map<string, BookResolution>): void {
  for (const book of booksToCopy.values()) {
    const absDest = path.join(OUTPUT_BOOKS_DIR, book.bookDir);
    fs.mkdirSync(path.dirname(absDest), { recursive: true });
    fs.cpSync(book.absHtmlDir, absDest, { recursive: true });
  }
}

function writeAssistantsJson(agents: AgentRecord[]): void {
  fs.mkdirSync(path.dirname(OUTPUT_DATA_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_DATA_PATH, JSON.stringify(agents, null, 2), "utf8");
}

function main(): void {
  ensureCleanDir(OUTPUT_BOOKS_DIR);
  ensureCleanDir(OUTPUT_ASSISTANTS_DIR);
  fs.mkdirSync(path.dirname(OUTPUT_DATA_PATH), { recursive: true });

  const { agents, booksToCopy } = collectAgentsAndBooks();
  copyReferencedBooks(booksToCopy);
  writeAssistantsJson(agents);

  console.log(
    [
      `Built agent registry: ${agents.length} assistant(s)`,
      `${booksToCopy.size} referenced book(s) copied from books/`,
      `Output: ${path.relative(REPO_ROOT, OUTPUT_DATA_PATH)}`,
    ].join(" | "),
  );
}

main();
