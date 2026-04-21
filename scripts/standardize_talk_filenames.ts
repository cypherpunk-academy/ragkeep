#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type RenamePair = { from: string; to: string };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_TALKS_DIR = path.join(
  REPO_ROOT,
  "assistants",
  "philo-von-freisinn",
  "talks",
);

function parseArgs(): { targetDir: string; apply: boolean } {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const positional = args.filter((a) => !a.startsWith("--"));
  const targetDir = positional[0]
    ? path.resolve(process.cwd(), positional[0])
    : DEFAULT_TALKS_DIR;
  return { targetDir, apply };
}

async function collectMarkdownFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectMarkdownFiles(full)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

function buildRenamePlan(files: string[]): RenamePair[] {
  const plan: RenamePair[] = [];
  for (const full of files) {
    const dir = path.dirname(full);
    const base = path.basename(full);
    if (!base.includes("_")) continue;
    const standardized = base.replaceAll("_", "-");
    const to = path.join(dir, standardized);
    if (to === full) continue;
    plan.push({ from: full, to });
  }
  return plan;
}

async function validateNoCollisions(plan: RenamePair[]): Promise<void> {
  const targets = new Set<string>();
  for (const pair of plan) {
    if (targets.has(pair.to)) {
      throw new Error(`Doppeltes Ziel im Plan: ${pair.to}`);
    }
    targets.add(pair.to);

    try {
      await fs.access(pair.to);
      throw new Error(`Zieldatei existiert bereits: ${pair.to}`);
    } catch (err) {
      // Expected when target does not exist.
      if (!(err instanceof Error) || !String(err.message).includes("ENOENT")) {
        throw err;
      }
    }
  }
}

async function run(): Promise<void> {
  const { targetDir, apply } = parseArgs();
  const st = await fs.stat(targetDir).catch(() => null);
  if (!st || !st.isDirectory()) {
    throw new Error(`Talks-Verzeichnis nicht gefunden: ${targetDir}`);
  }

  const files = await collectMarkdownFiles(targetDir);
  const plan = buildRenamePlan(files);

  if (plan.length === 0) {
    console.log("Keine Dateien mit '_' gefunden. Nichts zu tun.");
    return;
  }

  await validateNoCollisions(plan);

  console.log(
    `${apply ? "APPLY" : "DRY-RUN"}: ${plan.length} Datei(en) würden umbenannt.`,
  );
  for (const pair of plan) {
    const fromRel = path.relative(targetDir, pair.from);
    const toRel = path.relative(targetDir, pair.to);
    console.log(`- ${fromRel} -> ${toRel}`);
  }

  if (!apply) {
    console.log(
      "\nDry-run beendet. Mit --apply wird die Umbenennung ausgeführt.",
    );
    return;
  }

  for (const pair of plan) {
    await fs.rename(pair.from, pair.to);
  }
  console.log("\nUmbenennung abgeschlossen.");
}

run().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

