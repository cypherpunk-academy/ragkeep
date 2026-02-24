#!/usr/bin/env node
/**
 * Sortiert die lectures in rudolf-steiner-ga-vortrag-verzeichnis.yaml nach id aufsteigend.
 * Erhält das exakte Textformat.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const YAML_PATH = path.resolve(__dirname, "..", "lectures", "rudolf-steiner-ga-vortrag-verzeichnis.yaml");

const content = fs.readFileSync(YAML_PATH, "utf-8");
const lines = content.split("\n");

const entries = [];
let i = 0;
let current = null;

while (i < lines.length) {
  const line = lines[i];
  const idMatch = line.match(/^\s+-\s+id:\s*(.+)$/);
  if (idMatch) {
    if (current) entries.push(current);
    current = { id: idMatch[1].trim(), lines: [line] };
  } else if (current) {
    current.lines.push(line);
  }
  i++;
}
if (current) entries.push(current);

entries.sort((a, b) => {
  const idA = String(a.id);
  const idB = String(b.id);
  return idA.localeCompare(idB, undefined, { numeric: true });
});

const header = lines[0];
const result = [header, ...entries.flatMap((e) => e.lines)].join("\n");
fs.writeFileSync(YAML_PATH, result, "utf-8");
console.log(`Sortiert: ${entries.length} Einträge nach id ASC.`);
