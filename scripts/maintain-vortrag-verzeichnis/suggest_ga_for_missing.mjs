#!/usr/bin/env node
/**
 * GA-Vorschläge für Einträge ohne GA-Nummer.
 *
 * Lädt YAML-Einträge ohne ga-Feld, durchsucht die ersten 60 Seiten aller GA-PDFs
 * nach Vortragsdaten (dd. mmm yyyy) und schlägt passende GA-Bände vor.
 *
 * Benötigt: pdftotext (poppler)
 * Verwendung: node scripts/suggest_ga_for_missing.mjs [--range 51,52,68a-68d]
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const GA_PDF_DIR =
  process.env.GA_PDF_DIR ||
  path.join(process.env.HOME || "", "GA 180dpi", "GA-Acrobat", "GA");
const YAML_PATH = path.join(REPO_ROOT, "lectures", "rudolf-steiner-ga-vortrag-verzeichnis.yaml");
const ORTE_PATH = path.join(REPO_ROOT, "lectures", "rudolf-steiner-ga-vortrag-verzeichnis-orte.yaml");

const RED = "\x1b[31m";
const BRIGHT_RED = "\x1b[91m";
const YELLOW = "\x1b[33m";
const ORANGE = "\x1b[38;5;208m";
const GRAY = "\x1b[90m";
const RESET = "\x1b[0m";

const MONTHS = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

/**
 * Lädt Orte aus rudolf-steiner-ga-vortrag-verzeichnis-orte.yaml
 */
function loadOrte() {
  if (!fs.existsSync(ORTE_PATH)) return [];
  const content = fs.readFileSync(ORTE_PATH, "utf-8");
  return content
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("#"))
    .sort((a, b) => b.length - a.length);
}

/**
 * Parst --range "51,52,53" oder "332-337" oder "68a,68b"
 */
function parseRangeArg(rangeStr) {
  if (!rangeStr) return null;
  const result = new Set();

  function parseGaPart(s) {
    const m = String(s).trim().match(/^(\d+)([a-z])?$/i);
    if (!m) return null;
    return { num: parseInt(m[1], 10), letter: m[2] || "" };
  }

  for (const part of rangeStr.split(",").map((s) => s.trim())) {
    const dash = part.indexOf("-");
    if (dash >= 0) {
      const startPart = parseGaPart(part.slice(0, dash));
      const endPart = parseGaPart(part.slice(dash + 1));
      if (!startPart || !endPart) continue;

      if (startPart.num === endPart.num) {
        if (startPart.letter && endPart.letter) {
          for (let c = startPart.letter.charCodeAt(0); c <= endPart.letter.charCodeAt(0); c++) {
            result.add(`${startPart.num}${String.fromCharCode(c)}`);
          }
        } else if (!startPart.letter && endPart.letter) {
          result.add(String(startPart.num));
          for (let c = 97; c <= endPart.letter.toLowerCase().charCodeAt(0); c++) {
            result.add(`${startPart.num}${String.fromCharCode(c)}`);
          }
        } else {
          result.add(String(startPart.num));
        }
      } else {
        for (let n = startPart.num; n <= endPart.num; n++) {
          result.add(String(n));
        }
      }
    } else {
      const p = parseGaPart(part);
      if (p) result.add(p.letter ? `${p.num}${p.letter}` : String(p.num));
    }
  }
  return result.size > 0 ? result : null;
}

/**
 * Extrahiert GA-Nummer aus Dateinamen: "GA 051.pdf" -> 51, "GA 068a.pdf" -> 68a
 */
function gaNumberFromFilename(filename) {
  const m = filename.match(/GA\s+0*(\d+)([a-z])?\.pdf$/i);
  if (!m) return null;
  const num = parseInt(m[1], 10);
  const suffix = m[2] || "";
  return suffix ? `${num}${suffix}` : String(num);
}

/**
 * Liefert Text aus PDF-Seiten [fromPage, toPage] (1-basiert)
 */
function extractPdfPages(pdfPath, fromPage, toPage) {
  try {
    return execSync(`pdftotext -f ${fromPage} -l ${toPage} "${pdfPath}" - 2>/dev/null`, {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch {
    return "";
  }
}

/**
 * Parst YAML: Einträge ohne GA + GAs pro Datum
 */
function loadYamlEntriesWithoutGa(yamlContent) {
  const entriesWithoutGa = [];
  const gasPerDatum = new Map(); // datum -> Set<gaNum>

  const lines = yamlContent.split("\n");
  let currentEntry = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const idMatch = line.match(/^\s+-\s+id:\s*(.+)$/);
    if (idMatch) {
      if (currentEntry) {
        if (currentEntry.datum) {
          if (currentEntry.hasGa && currentEntry.gaValue) {
            const parts = currentEntry.gaValue.split(/[\s,]+/).map((p) => p.replace(/['']/g, "").trim()).filter(Boolean);
            if (!gasPerDatum.has(currentEntry.datum)) gasPerDatum.set(currentEntry.datum, new Set());
            for (const p of parts) {
              gasPerDatum.get(currentEntry.datum).add(p);
            }
          }
        }
        if (!currentEntry.hasGa) {
          entriesWithoutGa.push({
            id: currentEntry.id,
            datum: currentEntry.datum,
            ort: currentEntry.ort,
            vortragstitel: currentEntry.vortragstitel || "",
          });
        }
      }
      currentEntry = {
        id: idMatch[1].trim(),
        datum: null,
        ort: null,
        vortragstitel: null,
        hasGa: false,
        gaValue: null,
      };
    }

    if (currentEntry) {
      const datumMatch = line.match(/^\s+datum:\s*(.+)$/);
      if (datumMatch) currentEntry.datum = datumMatch[1].trim();

      const ortMatch = line.match(/^\s+ort:\s*(.+)$/);
      if (ortMatch) currentEntry.ort = ortMatch[1].trim();

      const titelMatch = line.match(/^\s+vortragstitel:\s*(.+)$/);
      if (titelMatch) currentEntry.vortragstitel = titelMatch[1].trim();

      const gaMatch = line.match(/^\s+ga:\s*(.+)$/);
      if (gaMatch) {
        currentEntry.hasGa = true;
        currentEntry.gaValue = gaMatch[1].trim();
      }
    }
  }

  if (currentEntry) {
    if (currentEntry.datum && currentEntry.hasGa && currentEntry.gaValue) {
      const parts = currentEntry.gaValue.split(/[\s,]+/).map((p) => p.replace(/['']/g, "").trim()).filter(Boolean);
      if (!gasPerDatum.has(currentEntry.datum)) gasPerDatum.set(currentEntry.datum, new Set());
      for (const p of parts) {
        gasPerDatum.get(currentEntry.datum).add(p);
      }
    }
    if (!currentEntry.hasGa) {
      entriesWithoutGa.push({
        id: currentEntry.id,
        datum: currentEntry.datum,
        ort: currentEntry.ort,
        vortragstitel: currentEntry.vortragstitel || "",
      });
    }
  }

  return { entriesWithoutGa, gasPerDatum };
}

/**
 * Extrahiert Datumseinträge aus TOC-Text.
 * Nur Datum am Zeilenanfang oder mit Ort davor.
 * Liefert { datum, lineBefore, lineOf, lineAfter }[]
 */
function parseDatesFromToc(text, orte = []) {
  const results = [];
  const lines = text.split("\n");
  let lastYear = null;
  let pending = null;

  const dateRe = new RegExp(`(\\d{1,2})\\.\\s+(${MONTHS.join("|")})\\s*(\\d{4})?`, "gi");

  function output(day, monthIdx, year, line, match, lineIndex) {
    const month = monthIdx + 1;
    const dd = String(day).padStart(2, "0");
    const mm = String(month).padStart(2, "0");
    const datum = `${dd}.${mm}.${year}`;
    const textBefore = line.slice(0, match.index).trim();
    const lineStartsWithDate = textBefore === "";
    let effectiveBefore = textBefore;
    if (lineStartsWithDate && lineIndex > 0) {
      effectiveBefore = lines[lineIndex - 1].trim();
    }
    const hasOrtBefore = orte.some((ort) => effectiveBefore.endsWith(ort) || effectiveBefore.endsWith(ort + ","));
    const openParens = (effectiveBefore.match(/\(/g) || []).length;
    const closeParens = (effectiveBefore.match(/\)/g) || []).length;
    const inParentheses = openParens > closeParens;

    if (inParentheses) return;

    if (!lineStartsWithDate && !hasOrtBefore) return;

    const lineBefore = lineIndex > 0 ? lines[lineIndex - 1].trim() : "";
    const lineOf = line.trim();
    const lineAfter = lineIndex < lines.length - 1 ? lines[lineIndex + 1].trim() : "";

    results.push({ datum, lineBefore, lineOf, lineAfter });
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const yearOnly = /^\s*(\d{4})\s*$/.exec(trimmed);
    if (yearOnly) {
      lastYear = parseInt(yearOnly[1], 10);
      if (pending) {
        output(pending.day, pending.monthIdx, lastYear, pending.line, pending.match, pending.lineIndex);
        pending = null;
      }
    } else {
      lastYear = null;
    }

    for (const m of line.matchAll(dateRe)) {
      const day = parseInt(m[1], 10);
      const monthName = m[2];
      const yearStr = m[3];
      const monthIdx = MONTHS.findIndex((mo) => mo.toLowerCase() === monthName.toLowerCase());
      if (monthIdx < 0) continue;

      if (yearStr) {
        const year = parseInt(yearStr, 10);
        output(day, monthIdx, year, line, m, i);
        pending = null;
      } else {
        if (lastYear) {
          output(day, monthIdx, lastYear, line, m, i);
        } else {
          pending = { day, monthIdx, match: m, line, lineIndex: i };
        }
      }
    }
  }

  return results;
}

/**
 * Sammelt alle GA-PDFs ab 051
 */
function listGaPdfs(rangeSet = null) {
  const dir = GA_PDF_DIR.replace(/^~/, process.env.HOME || "");
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir);
  let result = files
    .filter((f) => /^GA\s+0*\d+[a-z]?\.pdf$/i.test(f))
    .sort((a, b) => {
      const gaA = gaNumberFromFilename(a);
      const gaB = gaNumberFromFilename(b);
      const numA = parseInt(String(gaA).replace(/\D/g, ""), 10) || 0;
      const numB = parseInt(String(gaB).replace(/\D/g, ""), 10) || 0;
      if (numA !== numB) return numA - numB;
      return (gaA || "").localeCompare(gaB || "");
    })
    .filter((f) => {
      const n = gaNumberFromFilename(f);
      if (!n) return false;
      const num = parseInt(String(n).replace(/\D/g, ""), 10);
      return num >= 51;
    });

  if (rangeSet) {
    result = result.filter((f) => {
      const ga = gaNumberFromFilename(f);
      return ga && rangeSet.has(ga);
    });
  }
  return result;
}

const HELP_TEXT = `GA-Vorschläge für Einträge ohne GA-Nummer.

Lädt YAML-Einträge ohne ga-Feld, durchsucht die ersten 60 Seiten aller GA-PDFs
nach Vortragsdaten (dd. Monat yyyy) und schlägt passende GA-Bände vor.

Benötigt: pdftotext (poppler)

Verwendung:
  node suggest_ga_for_missing.mjs [Optionen]

Optionen:
  --help, -h     Diese Hilfe anzeigen
  --range RANGE  Nur bestimmte GA-Bände durchsuchen
                 Beispiele: 51,52,53  oder  332-337  oder  68a-68d

Umgebungsvariable:
  GA_PDF_DIR     Pfad zum GA-PDF-Verzeichnis (Standard: ~/GA 180dpi/GA-Acrobat/GA)
`;

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP_TEXT);
    return;
  }
  const rangeIdx = args.indexOf("--range");
  const rangeSet =
    rangeIdx >= 0 && args[rangeIdx + 1] ? parseRangeArg(args[rangeIdx + 1]) : null;

  const gaDir = GA_PDF_DIR.replace(/^~/, process.env.HOME || "");
  if (!fs.existsSync(gaDir)) {
    console.error(`${RED}Fehler: GA-PDF-Verzeichnis nicht gefunden: ${gaDir}${RESET}`);
    process.exit(1);
  }
  if (!fs.existsSync(YAML_PATH)) {
    console.error(`${RED}Fehler: YAML nicht gefunden: ${YAML_PATH}${RESET}`);
    process.exit(1);
  }

  const yamlContent = fs.readFileSync(YAML_PATH, "utf-8");
  const { entriesWithoutGa, gasPerDatum } = loadYamlEntriesWithoutGa(yamlContent);
  const orte = loadOrte();

  console.log(`Einträge ohne GA: ${entriesWithoutGa.length}`);
  if (entriesWithoutGa.length === 0) {
    console.log("Keine Einträge ohne GA-Nummer.");
    return;
  }

  const allPdfs = listGaPdfs(rangeSet);
  if (allPdfs.length === 0) {
    console.error(`${RED}Keine GA-PDFs gefunden.${RESET}`);
    return;
  }

  /** Map<gaNum, Array<{ datum, lineBefore, lineOf, lineAfter }>> */
  const gaToDates = new Map();
  const allExtractions = []; // Für Vielleicht-Suche: { gaNum, datum, lineBefore, lineOf, lineAfter }

  console.log(`\nDurchsuche ${allPdfs.length} GA-Bände (Seiten 1–60)...`);
  for (let idx = 0; idx < allPdfs.length; idx++) {
    const filename = allPdfs[idx];
    const gaNum = gaNumberFromFilename(filename);
    if (!gaNum) continue;

    const pct = allPdfs.length > 1 ? Math.round(((idx + 1) / allPdfs.length) * 100) : 100;
    const barLen = 20;
    const filled = Math.round(((idx + 1) / allPdfs.length) * barLen);
    const bar =
      "=".repeat(filled) +
      (filled < barLen ? ">" : "") +
      " ".repeat(Math.max(0, barLen - filled - 1));
    process.stdout.write(`\r[${bar}] ${idx + 1}/${allPdfs.length} (${pct}%) GA ${gaNum}    `);

    const pdfPath = path.join(gaDir, filename);
    const text = extractPdfPages(pdfPath, 1, 60);
    const dates = parseDatesFromToc(text, orte);

    gaToDates.set(gaNum, dates);
    for (const d of dates) {
      allExtractions.push({ gaNum, ...d });
    }
  }
  console.log("\n");

  /** Findet GA-Bände mit diesem Datum, die noch nicht vergeben sind */
  function findFreeGasForDatum(datum) {
    const assigned = gasPerDatum.get(datum) || new Set();
    const candidates = [];
    for (const [gaNum, dates] of gaToDates) {
      if (assigned.has(gaNum)) continue;
      const match = dates.find((d) => d.datum === datum);
      if (match) candidates.push({ gaNum, ...match });
    }
    return candidates;
  }

  /** Sucht Vielleicht-Treffer: Titel (erste 80 Zeichen) in GA-Text, anderes Datum */
  function findVielleicht(titlePrefix, excludeDatum) {
    const prefix = (titlePrefix || "").slice(0, 80).trim();
    if (prefix.length < 10) return [];
    const prefixLower = prefix.toLowerCase();
    const results = [];
    const seen = new Set();
    for (const ex of allExtractions) {
      if (ex.datum === excludeDatum) continue;
      const combined = `${ex.lineOf} ${ex.lineAfter}`.toLowerCase();
      if (combined.includes(prefixLower)) {
        const key = `${ex.gaNum}:${ex.datum}:${ex.lineOf}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push(ex);
        }
      }
    }
    return results;
  }

  console.log("Ausgabe pro Eintrag ohne GA:\n");

  for (const entry of entriesWithoutGa) {
    const { id, datum, ort, vortragstitel } = entry;
    if (!datum) continue;

    const candidates = findFreeGasForDatum(datum);

    if (candidates.length > 0) {
      for (const c of candidates) {
        console.log(
          `${YELLOW}${id}, ${datum}, ${(vortragstitel || "").slice(0, 60)}${RESET}`
        );
        console.log(`${BRIGHT_RED}  GA ${c.gaNum}${RESET}`);
        console.log(`${GRAY}  Zeile davor: ${c.lineBefore || "(leer)"}${RESET}`);
        console.log(`${GRAY}  Zeile: ${c.lineOf}${RESET}`);
        console.log(`${GRAY}  Zeile danach: ${c.lineAfter || "(leer)"}${RESET}`);
        console.log("");
      }
    } else {
      const assigned = gasPerDatum.get(datum) || new Set();
      const hasAnyAtDatum = [...gaToDates.entries()].some(([gaNum, dates]) =>
        dates.some((d) => d.datum === datum)
      );

      const msg = hasAnyAtDatum
        ? "Kein freier Eintrag gefunden"
        : "Eintrag nicht gefunden";
      console.log(
        `${RED}${msg}: ${datum} ${(vortragstitel || "").slice(0, 80)}${RESET}`
      );

      const vielleicht = findVielleicht(vortragstitel, datum);
      for (const v of vielleicht) {
        const fullTitle = `${v.lineOf} ${v.lineAfter}`.trim().slice(0, 120);
        console.log(
          `${ORANGE}  Vielleicht: ${v.datum}, ${fullTitle}${RESET}`
        );
      }
      if (vielleicht.length > 0) console.log("");
    }
  }
}

main();
