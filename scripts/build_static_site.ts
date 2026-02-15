#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { copyAssistantFiles, loadAssistants } from "./static-site/assistants";
import {
  buildBookLookup,
  collectBooks,
  collectReferencedBookIds,
  copyBookHtmlToSite,
} from "./static-site/books";
import { writeSiteAssets } from "./static-site/assets";
import { generateAgentPages, generateHomePage } from "./static-site/pages";
import fs from "node:fs";
import { ensureDir, writeTextFile } from "./static-site/utils";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(REPO_ROOT, "site");

const KEEP_IN_SITE = ["data"];

function cleanSiteOutput(outputDir: string): void {
  if (!fs.existsSync(outputDir)) {
    ensureDir(outputDir);
    return;
  }
  const entries = fs.readdirSync(outputDir, { withFileTypes: true });
  for (const entry of entries) {
    if (KEEP_IN_SITE.includes(entry.name)) continue;
    const p = path.join(outputDir, entry.name);
    fs.rmSync(p, { recursive: true, force: true });
  }
}

function writeMetaFiles(outputDir: string): void {
  writeTextFile(path.join(outputDir, ".nojekyll"), "");
  writeTextFile(path.join(outputDir, "robots.txt"), "User-agent: *\nAllow: /\n");
}

function main(): void {
  cleanSiteOutput(OUTPUT_DIR);
  writeSiteAssets(OUTPUT_DIR);
  writeMetaFiles(OUTPUT_DIR);

  const assistants = loadAssistants(REPO_ROOT);
  const books = collectBooks(REPO_ROOT);
  const booksById = buildBookLookup(books);
  const referencedBookIds = collectReferencedBookIds(assistants);

  for (const id of referencedBookIds) {
    const book = booksById.get(id);
    if (!book) continue;
    copyBookHtmlToSite(book, OUTPUT_DIR);
  }

  copyAssistantFiles(REPO_ROOT, OUTPUT_DIR, assistants);
  generateHomePage(OUTPUT_DIR, assistants);
  generateAgentPages(OUTPUT_DIR, assistants, booksById);

  // eslint-disable-next-line no-console
  console.log(
    `Built static site: ${assistants.length} assistant(s), ${referencedBookIds.size} referenced book(s).`
  );
}

main();
