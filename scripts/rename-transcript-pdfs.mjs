#!/usr/bin/env node
/**
 * Benennt PDFs in lectures/transscripts um:
 * 1) Hängt (wb|fh|ha|ga) von ".pdf(tag)" vor die Endung: "... .pdf(tag)" -> "... (tag).pdf"
 * 2) Ergänzt Jahrhundert: führendes YYMMDD (6 Stellen) -> 19YYMMDD;
 *    Sonderfall 00YYMMDD vor "(": 18YYMMDD wenn YY>=70 (1870–1899), sonst 19YYMMDD (z. B. 00881109 -> 18881109)
 * 3) Ersetzt Leerzeichen, Bindestriche und runde Klammern im Namen durch _ (aufeinanderfolgende _ werden zu einem);
 *    Unterstriche unmittelbar vor .pdf werden entfernt (_.pdf -> .pdf)
 *
 * Aufruf:
 *   node scripts/rename-transcript-pdfs.mjs           # Dry-Run (nur Ausgabe)
 *   node scripts/rename-transcript-pdfs.mjs --apply   # Umbenennen
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRANSCRIPTS_DIR = path.resolve(__dirname, "..", "lectures", "transscripts");

/** @param {string} name */
function moveTagBeforePdf(name) {
  const m = name.match(/^(.*)\.pdf\((wb|fh|ha|ga)\)$/i);
  if (!m) return name;
  const tag = m[2].toLowerCase();
  return `${m[1]} (${tag}).pdf`;
}

/**
 * @param {string} name Dateiname (mit .pdf)
 */
function addCenturyToPrefix(name) {
  if (!name.toLowerCase().endsWith(".pdf")) return name;

  if (/^(18|19|20)\d{6}(?![0-9])/.test(name)) {
    return name;
  }

  if (/^00\d{6}(?=\()/.test(name)) {
    return name.replace(/^00(\d{6})(?=\()/, (_m, d6) => {
      const yy = Number(d6.slice(0, 2));
      const century = yy >= 70 ? "18" : "19";
      return `${century}${d6}`;
    });
  }

  if (/^\d{6}(?=\()/.test(name)) {
    return name.replace(/^(\d{6})(?=\()/, "19$1");
  }

  if (/^\d{6}[a-zA-Z]/.test(name)) {
    return name.replace(/^(\d{6})(?=[a-zA-Z])/, "19$1");
  }

  return name;
}

/** Ersetzt Leerzeichen, Bindestriche und ( ) durch Unterstriche; keine aufeinanderfolgenden _; kein _ vor .pdf. */
function normalizeSpacesAndHyphens(name) {
  return name
    .replace(/[\s\-()]/g, "_")
    .replace(/_+/g, "_")
    .replace(/_+(\.pdf)$/i, "$1");
}

/** @param {string} name */
function transformName(name) {
  let n = moveTagBeforePdf(name);
  n = addCenturyToPrefix(n);
  n = normalizeSpacesAndHyphens(n);
  return n;
}

function main() {
  const apply = process.argv.includes("--apply");
  if (!fs.existsSync(TRANSCRIPTS_DIR)) {
    console.error(`Verzeichnis fehlt: ${TRANSCRIPTS_DIR}`);
    process.exit(1);
  }

  const entries = fs.readdirSync(TRANSCRIPTS_DIR, { withFileTypes: true });
  const pdfs = entries.filter((e) => {
    if (!e.isFile()) return false;
    const n = e.name.toLowerCase();
    return n.endsWith(".pdf") || /\.pdf\((wb|fh|ha|ga)\)$/i.test(e.name);
  });

  /** @type {{ from: string; to: string }[]} */
  const planned = [];

  for (const e of pdfs) {
    const from = e.name;
    const to = transformName(from);
    if (from !== to) {
      planned.push({ from, to });
    }
  }

  const fromSet = new Set(planned.map((p) => p.from));
  const toCount = new Map();
  for (const p of planned) {
    toCount.set(p.to, (toCount.get(p.to) ?? 0) + 1);
  }
  /** Kollision: gleiches Ziel mehrfach, oder Ziel existiert und wird nicht durch Umbenennung frei */
  const collisions = planned.filter((p) => {
    if ((toCount.get(p.to) ?? 0) > 1) return true;
    const dest = path.join(TRANSCRIPTS_DIR, p.to);
    if (!fs.existsSync(dest)) return false;
    return !fromSet.has(p.to);
  });

  if (collisions.length > 0) {
    console.error("Kollisionen (Ziel existiert bereits):");
    for (const c of collisions.slice(0, 30)) {
      console.error(`  ${c.from} -> ${c.to}`);
    }
    if (collisions.length > 30) {
      console.error(`  ... und ${collisions.length - 30} weitere`);
    }
    process.exit(1);
  }

  console.log(
    apply ? `Wende ${planned.length} Umbenennungen an …` : `Dry-Run: ${planned.length} Umbenennungen (ohne --apply)`,
  );

  let ok = 0;
  for (const { from, to } of planned) {
    const fromPath = path.join(TRANSCRIPTS_DIR, from);
    const toPath = path.join(TRANSCRIPTS_DIR, to);
    if (!apply) {
      console.log(`${from}\n  -> ${to}`);
      ok++;
      continue;
    }
    try {
      fs.renameSync(fromPath, toPath);
      ok++;
    } catch (err) {
      console.error(`Fehler: ${from} -> ${to}:`, err);
      process.exit(1);
    }
  }

  if (apply) {
    console.log(`Fertig: ${ok} Dateien umbenannt.`);
  } else {
    console.log(`Ende Dry-Run (${ok} Umbenennungen). --apply zum Ausführen.`);
  }
}

main();
