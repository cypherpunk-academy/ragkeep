#!/usr/bin/env node
/**
 * Konvertiert rudolf-steiner-ga-vortrag-verzeichnis.yaml in CSV.
 * Spalten: id, datum, jahr, ort, vortragstitel, anlass, ga, zyklus
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const YAML_PATH = path.resolve(__dirname, "..", "lectures", "rudolf-steiner-ga-vortrag-verzeichnis.yaml");
const CSV_PATH = path.resolve(__dirname, "..", "lectures", "rudolf-steiner-ga-vortrag-verzeichnis.csv");

const COLUMNS = ["id", "datum", "jahr", "ort", "vortragstitel", "anlass", "ga", "zyklus"];

function escapeCsv(value) {
  if (value == null || value === "") return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

const content = fs.readFileSync(YAML_PATH, "utf-8");
const lines = content.split("\n");

const entries = [];
let current = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const idMatch = line.match(/^\s+-\s+id:\s*(.+)$/);
  const keyMatch = line.match(/^\s+([a-z_-]+):\s*(.*)$/);

  if (idMatch) {
    if (current) entries.push(current);
    current = { id: idMatch[1].trim(), datum: "", jahr: "", ort: "", vortragstitel: "", anlass: "", ga: "", zyklus: "" };
  } else if (current && keyMatch) {
    const key = keyMatch[1];
    let val = keyMatch[2];
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/""/g, '"');
    if (COLUMNS.includes(key)) current[key] = val;
  }
}
if (current) entries.push(current);

const header = COLUMNS.join(",");
const rows = entries.map((e) => COLUMNS.map((c) => escapeCsv(e[c])).join(","));
const csv = [header, ...rows].join("\n");
const BOM = "\uFEFF";

fs.writeFileSync(CSV_PATH, BOM + csv, "utf-8");
console.log(`CSV erstellt: ${CSV_PATH} (${entries.length} Zeilen)`);
