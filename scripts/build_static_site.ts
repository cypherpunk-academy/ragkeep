#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lookup } from "node:dns/promises";
import { execSync } from "node:child_process";
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
  collectTypologies,
  type ConceptEntry,
} from "./static-site/concepts";
import {
  collectTalks,
  collectTalksFromDb,
  extractTalkChunkIds,
  generateTalkPages,
  type TalkData,
} from "./static-site/talks";
import { writeSiteAssets } from "./static-site/assets";
import { generateAgentPages, generateHomePage } from "./static-site/pages";
import fs from "node:fs";
import { ensureDir, writeTextFile } from "./static-site/utils";
import {
  collectLecturesByAgent,
  copyLecturesHtmlToSite,
} from "./static-site/lectures";
import { collectQuotesForAgent } from "./static-site/quotes";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(REPO_ROOT, "site");

const KEEP_IN_SITE = ["data"];
function _extractDockerMappedPostgresPort(): number | null {
  try {
    const out = execSync("docker port ragrun-postgres 5432/tcp", {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const m = out.match(/:(\d+)\s*$/m);
    if (!m) return null;
    const p = Number(m[1]);
    return Number.isFinite(p) && p > 0 ? p : null;
  } catch {
    return null;
  }
}

async function normalizePostgresEnvForHost(): Promise<void> {
  const candidates = ["RAGRUN_POSTGRES_DSN", "DATABASE_URL", "POSTGRES_URL"] as const;
  const key = candidates.find((k) => {
    const v = process.env[k];
    return typeof v === "string" && v.trim() !== "";
  });
  if (!key) return;
  const raw = process.env[key]!;
  const pgUrl = raw.replace(/^postgresql\+[^:]+:\/\//, "postgresql://");
  let url: URL;
  try {
    url = new URL(pgUrl);
  } catch {
    return;
  }
  if (url.hostname !== "postgres") return;

  let postgresResolvable = true;
  try {
    await lookup("postgres");
  } catch {
    postgresResolvable = false;
  }
  if (postgresResolvable) {
    return;
  }

  const mappedPort = _extractDockerMappedPostgresPort();
  url.hostname = "localhost";
  if (mappedPort) {
    url.port = String(mappedPort);
  }
  const normalizedPg = url.toString();
  const normalizedWithDriver = raw.includes("postgresql+")
    ? normalizedPg.replace(/^postgresql:\/\//, "postgresql+psycopg://")
    : normalizedPg;

  process.env[key] = normalizedWithDriver;
  process.env.POSTGRES_URL = normalizedPg;
  process.env.DATABASE_URL = normalizedPg;
  process.env.RAGRUN_POSTGRES_DSN = normalizedWithDriver;
}

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

/** Buchcover-SVGs (assets/covers/*.svg) → site/assets/covers/ für Talk- und Reader-Referenzen. */
function copyBookCoverSvgs(repoRoot: string, outputDir: string): void {
  const src = path.join(repoRoot, "assets", "covers");
  if (!fs.existsSync(src)) return;
  const dest = path.join(outputDir, "assets", "covers");
  ensureDir(dest);
  fs.cpSync(src, dest, { recursive: true });
}

function copyFavicon(
  repoRoot: string,
  outputDir: string,
  assistants: { avatarUrl?: string }[]
): void {
  const agentWithAvatar = assistants.find((a) => a.avatarUrl);
  if (!agentWithAvatar?.avatarUrl) return;
  const relPath = agentWithAvatar.avatarUrl.replace(/^assistants\//, "");
  const sourcePath = path.join(repoRoot, "assistants", relPath);
  if (!fs.existsSync(sourcePath)) return;
  fs.copyFileSync(sourcePath, path.join(outputDir, "favicon.png"));
  fs.copyFileSync(sourcePath, path.join(outputDir, "favicon.ico"));
}

async function main(): Promise<void> {
  await normalizePostgresEnvForHost();
  cleanSiteOutput(OUTPUT_DIR);
  writeSiteAssets(OUTPUT_DIR);
  copyBookCoverSvgs(REPO_ROOT, OUTPUT_DIR);
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
  copyFavicon(REPO_ROOT, OUTPUT_DIR, assistants);
  copyLecturesHtmlToSite(REPO_ROOT, OUTPUT_DIR);

  const hasDb = Boolean(
    process.env["RAGRUN_POSTGRES_DSN"] ??
    process.env["DATABASE_URL"] ??
    process.env["POSTGRES_URL"]
  );

  const talksByAgent = new Map<string, Map<string, TalkData>>();
  for (const agent of assistants) {
    if (hasDb) {
      const dbTalks = await collectTalksFromDb(agent.ragCollection, agent.name);
      if (dbTalks.size > 0) talksByAgent.set(agent.id, dbTalks);
    } else if (agent.talks.length > 0) {
      talksByAgent.set(agent.id, collectTalks(REPO_ROOT, agent));
    }
  }

  const conceptsByAgent = new Map<string, Map<string, ConceptEntry[]>>();
  const typologiesByAgent = new Map<string, Map<string, ConceptEntry[]>>();
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
    if (agent.typologies.length > 0) {
      const typologies = collectTypologies(REPO_ROOT, agent);
      typologiesByAgent.set(agent.id, typologies);
      let collSet = chunkIdsByCollection.get(agent.ragCollection);
      if (!collSet) {
        collSet = new Set<string>();
        chunkIdsByCollection.set(agent.ragCollection, collSet);
      }
      for (const fileEntries of typologies.values()) {
        for (const entry of fileEntries) {
          if (entry.references) {
            for (const ref of entry.references) {
              collSet.add(ref.chunk_id);
            }
          }
        }
      }
    }
  }

  for (const agent of assistants) {
    const talks = talksByAgent.get(agent.id);
    if (!talks || talks.size === 0) continue;
    let collSet = chunkIdsByCollection.get(agent.ragCollection);
    if (!collSet) {
      collSet = new Set<string>();
      chunkIdsByCollection.set(agent.ragCollection, collSet);
    }
    for (const talk of talks.values()) {
      for (const cid of extractTalkChunkIds(talk.body)) {
        collSet.add(cid);
      }
    }
  }

  const chunkIndex = await buildChunkIndex(
    chunkIdsByCollection,
    REPO_ROOT,
    booksById
  );
  const lecturesByAgent = collectLecturesByAgent(REPO_ROOT, assistants, booksById);

  const quotesByAgent = new Map<string, ReturnType<typeof collectQuotesForAgent>>();
  for (const agent of assistants) {
    quotesByAgent.set(
      agent.id,
      collectQuotesForAgent(agent, booksById, lecturesByAgent, REPO_ROOT)
    );
  }

  generateHomePage(OUTPUT_DIR, assistants, lecturesByAgent, talksByAgent);
  generateAgentPages(
    OUTPUT_DIR,
    assistants,
    booksById,
    talksByAgent,
    conceptsByAgent,
    chunkIndex,
    typologiesByAgent,
    lecturesByAgent,
    quotesByAgent
  );
  generateTalkPages(OUTPUT_DIR, assistants, talksByAgent, chunkIndex);

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
