#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const OVERRIDES_DIR = path.join(REPO_ROOT, "website", "app-overrides");
const FIGMA_PROTOTYPE_DIR = path.join(REPO_ROOT, "website", "figma-prototype");

const OVERRIDE_MAPPINGS: [string, string][] = [
  ["App.tsx", "src/app/App.tsx"],
  ["pages/AgentListPage.tsx", "src/app/pages/AgentListPage.tsx"],
  ["pages/AgentDetailPage.tsx", "src/app/pages/AgentDetailPage.tsx"],
  ["vite.config.ts", "vite.config.ts"],
];

function applyOverrides(): void {
  for (const [sourceRel, destRel] of OVERRIDE_MAPPINGS) {
    const absSource = path.join(OVERRIDES_DIR, sourceRel);
    const absDest = path.join(FIGMA_PROTOTYPE_DIR, destRel);

    if (!fs.existsSync(absSource)) {
      console.warn(`Override not found: ${sourceRel}`);
      continue;
    }

    fs.mkdirSync(path.dirname(absDest), { recursive: true });
    fs.cpSync(absSource, absDest, { recursive: false });
    console.log(`Applied override: ${sourceRel} -> ${destRel}`);
  }
}

applyOverrides();
