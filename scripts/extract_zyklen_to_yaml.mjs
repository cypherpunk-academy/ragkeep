#!/usr/bin/env node
/**
 * Extrahiert alle 50 Zyklen (1–50) aus rudolf-steiner-ga-vortrag-verzeichnis.yaml
 * und schreibt sie nach rudolf-steiner-ga-vortrag-zyklus.yaml.
 *
 * Format pro Eintrag:
 *   - titel: <Reihentitel>
 *     anzahl: <Anzahl Vorträge>
 *     zyklus: <Zyklus-Nummer>
 *
 * Verwendung: node scripts/extract_zyklen_to_yaml.mjs [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const VERZEICHNIS_PATH = path.join(REPO_ROOT, 'lectures', 'rudolf-steiner-ga-vortrag-verzeichnis.yaml');
const ZYKLUS_PATH = path.join(REPO_ROOT, 'lectures', 'rudolf-steiner-ga-vortrag-zyklus.yaml');

/**
 * Parst die Verzeichnis-YAML zeilenbasiert (wegen doppelter Keys in der Quelle).
 */
function parseVerzeichnis(content) {
  const lectures = [];
  let current = {};

  for (const line of content.split('\n')) {
    const itemMatch = line.match(/^\s+-\s+id:\s*(.+)$/);
    const reiheMatch = line.match(/^\s+reihe:\s*(.+)$/);
    const zyklusMatch = line.match(/^\s+zyklus:\s*(.+)$/);

    if (itemMatch) {
      if (Object.keys(current).length > 0) {
        lectures.push(current);
      }
      current = { id: itemMatch[1].trim() };
    } else if (reiheMatch && !current.reihe) {
      current.reihe = reiheMatch[1].trim().replace(/^["']|["']$/g, '');
    } else if (zyklusMatch) {
      const val = zyklusMatch[1].trim();
      const num = parseInt(val, 10);
      if (!Number.isNaN(num)) current.zyklus = num;
    }
  }
  if (Object.keys(current).length > 0) {
    lectures.push(current);
  }
  return lectures;
}

function main() {
  const dryRun = process.argv.includes('--dry-run');

  if (!fs.existsSync(VERZEICHNIS_PATH)) {
    console.error(`Fehler: ${VERZEICHNIS_PATH} nicht gefunden.`);
    process.exit(1);
  }

  const content = fs.readFileSync(VERZEICHNIS_PATH, 'utf-8');
  const lectures = parseVerzeichnis(content);

  /** @type {Map<number, { titel: string; count: number }>} */
  const zyklusMap = new Map();

  for (const lecture of lectures) {
    const zyklus = lecture.zyklus;
    if (zyklus == null || zyklus < 1 || zyklus > 50) {
      continue;
    }

    const titel = lecture.reihe ?? '(ohne Titel)';

    if (!zyklusMap.has(zyklus)) {
      zyklusMap.set(zyklus, { titel, count: 0 });
    }
    zyklusMap.get(zyklus).count += 1;
  }

  const zyklen = [];
  for (let z = 1; z <= 50; z++) {
    const entry = zyklusMap.get(z);
    if (entry) {
      zyklen.push({
        titel: entry.titel,
        anzahl: entry.count,
        zyklus: z,
      });
    }
  }

  const output = {
    zyklen,
  };

  const yamlOut = yaml.dump(output, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });

  if (dryRun) {
    console.log('Dry-run – würde schreiben nach', ZYKLUS_PATH);
    console.log(yamlOut);
    return;
  }

  fs.writeFileSync(ZYKLUS_PATH, yamlOut, 'utf-8');
  console.log(`${zyklen.length} Zyklen nach ${ZYKLUS_PATH} geschrieben.`);
}

main();
