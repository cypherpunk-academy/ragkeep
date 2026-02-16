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
import { buildChunkIndex } from "./static-site/chunkLookup";
import {
  collectConcepts,
  type ConceptEntry,
} from "./static-site/concepts";
import { collectEssays, generateEssayPages, type EssayData } from "./static-site/essays";
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

async function main(): Promise<void> {
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

  const essaysByAgent = new Map<string, Map<string, EssayData>>();
  for (const agent of assistants) {
    if (agent.essays.length > 0) {
      essaysByAgent.set(agent.id, collectEssays(REPO_ROOT, agent));
    }
  }

  const conceptsByAgent = new Map<string, Map<string, ConceptEntry[]>>();
  const chunkIdsByCollection = new Map<string, Set<string>>();
  for (const agent of assistants) {
    if (agent.concepts.length > 0) {
      const concepts = collectConcepts(REPO_ROOT, agent);
      conceptsByAgent.set(agent.id, concepts);
      let collSet = chunkIdsByCollection.get(agent.ragCollection);
      if (!collSet) {
        collSet = new Set<string>();
        chunkIdsByCollection.set(agent.ragCollection, collSet);
      }
      for (const fileConcepts of concepts.values()) {
        for (const entry of fileConcepts) {
          if (entry.references) {
            for (const ref of entry.references) {
              collSet.add(ref.chunk_id);
            }
          }
        }
      }
    }
  }

  const chunkIndex = await buildChunkIndex(
    chunkIdsByCollection,
    REPO_ROOT,
    booksById
  );

  generateHomePage(OUTPUT_DIR, assistants);
  generateAgentPages(
    OUTPUT_DIR,
    assistants,
    booksById,
    essaysByAgent,
    conceptsByAgent,
    chunkIndex
  );
  generateEssayPages(OUTPUT_DIR, assistants, essaysByAgent);

  // eslint-disable-next-line no-console
  console.log(
    `Built static site: ${assistants.length} assistant(s), ${referencedBookIds.size} referenced book(s).`
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
