#!/usr/bin/env node
/**
 * Fügt das Attribut `zyklus` zu Einträgen in vortragsverzeichnis_mit_material.yaml hinzu.
 *
 * Extrahiert aus Handbuch.pdf alle Zeilen mit "(Zyklus x)" (x = 1–50), ermittelt die
 * GA-Nummer (erste Zahl in der Zeile), sucht in der YAML nach Einträgen mit "GA {nummer}"
 * im abdruck-Feld und fügt zyklus: {x} hinzu.
 *
 * Benötigt: pdftotext (poppler)
 * Verwendung: node scripts/add_zyklus_from_handbuch.mjs [--dry-run]
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const PDF_PATH = path.join(REPO_ROOT, 'lectures', 'Handbuch.pdf');
const YAML_PATH = path.join(REPO_ROOT, 'lectures', 'vortragsverzeichnis_mit_material.yaml');

function extractTextFromPdf() {
  const tmpPath = path.join(REPO_ROOT, '.handbuch_extract.txt');
  execSync(`pdftotext "${PDF_PATH}" "${tmpPath}" 2>/dev/null || true`, { encoding: 'utf-8' });
  const text = fs.readFileSync(tmpPath, 'utf-8');
  fs.unlinkSync(tmpPath);
  return text;
}

/**
 * Parst Handbuch-Text, baut Mapping GA-Nummer -> Zyklus (1-50).
 */
function parseGaZyklusMapping(text) {
  const gaToZyklus = new Map();
  let currentGa = null;
  const gaPattern = /^(\d+[a-z]?)\s/;
  const zyklusRe = /\((?:Alte Bezeichnung: |früher: )?Zyklus\s+(\d+)(?:\s*,\s*(\d+))?(?:\s*und\s*(\d+))?\)/g;

  for (const line of text.split('\n')) {
    const gaMatch = gaPattern.exec(line.trim());
    if (gaMatch) {
      currentGa = gaMatch[1];
    }

    for (const m of line.matchAll(zyklusRe)) {
      const nums = [parseInt(m[1], 10)];
      if (m[2]) nums.push(parseInt(m[2], 10));
      if (m[3]) nums.push(parseInt(m[3], 10));
      const firstValid = nums.find((n) => n >= 1 && n <= 50);
      if (firstValid != null && currentGa && !gaToZyklus.has(currentGa)) {
        gaToZyklus.set(currentGa, firstValid);
      }
      break;
    }
  }
  return Object.fromEntries(gaToZyklus);
}

function gaMatchesAbdruck(ga, abdruck) {
  if (!abdruck) return false;
  const pattern = new RegExp(`(?:^|[\\s,/])GA\\s+${ga.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[\\s,/]|$)`, 'u');
  return pattern.test(abdruck);
}

function main() {
  const dryRun = process.argv.includes('--dry-run');

  if (!fs.existsSync(PDF_PATH)) {
    console.error(`Fehler: ${PDF_PATH} nicht gefunden.`);
    process.exit(1);
  }
  if (!fs.existsSync(YAML_PATH)) {
    console.error(`Fehler: ${YAML_PATH} nicht gefunden.`);
    process.exit(1);
  }

  const text = extractTextFromPdf();
  const gaToZyklus = parseGaZyklusMapping(text);

  if (Object.keys(gaToZyklus).length !== 50) {
    console.error(
      `Warnung: Erwartet 50 GA-Zyklus-Zuordnungen, gefunden: ${Object.keys(gaToZyklus).length}`
    );
  }

  // Textbasiert bearbeiten, um YAML-Parsing-Probleme (z.B. \' in Titeln) zu vermeiden
  const lines = fs.readFileSync(YAML_PATH, 'utf-8').split('\n');
  const result = [];
  let updated = 0;

  for (let i = 0; i < lines.length; i++) {
    result.push(lines[i]);
    const abdruckMatch = lines[i].match(/^\s+abdruck:\s*['"](.*)['"]\s*$/);
    if (abdruckMatch) {
      const abdruck = abdruckMatch[1];
      const nextLine = lines[i + 1] || '';
      const hasZyklus = /^\s+zyklus:/.test(nextLine);
      if (!hasZyklus) {
        for (const [ga, zyklus] of Object.entries(gaToZyklus)) {
          if (gaMatchesAbdruck(ga, abdruck)) {
            const indent = lines[i].match(/^(\s*)/)[1];
            result.push(`${indent}zyklus: ${zyklus}`);
            updated += 1;
            break;
          }
        }
      }
    }
  }

  if (dryRun) {
    console.log(`Dry-run: ${updated} Einträge würden zyklus erhalten.`);
    return;
  }

  fs.writeFileSync(YAML_PATH, result.join('\n'), 'utf-8');
  console.log(`Zyklus hinzugefügt für ${updated} Einträge.`);
}

main();
