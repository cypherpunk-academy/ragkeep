#!/usr/bin/env node
/**
 * Ergänzt fehlende GA-Bände in ragprep/config/ga_list.txt.
 *
 * Findet GA-PDFs in ~/GA 180dpi/GA-Acrobat/GA, die noch nicht in ga_list.txt stehen,
 * extrahiert aus den ersten 5 Seiten den Buchtitel (meist Seite 3 unter "Rudolf Steiner")
 * und fügt den Eintrag hinzu. Nur der Titel wird genommen, keine Vortragsanzahl oder Städte.
 *
 * Benötigt: pdftotext (poppler)
 * Verwendung: node add_missing_ga_to_ga_list.mjs [--write] [--range 355,356|355-360]
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAGKEEP_ROOT = path.resolve(__dirname, "..", "..");
const GA_PDF_DIR =
  process.env.GA_PDF_DIR ||
  path.join(process.env.HOME || "", "GA 180dpi", "GA-Acrobat", "GA");
const GA_LIST_PATH =
  process.env.GA_LIST_PATH ||
  path.join(RAGKEEP_ROOT, "..", "ragprep", "config", "ga_list.txt");
const ORTE_PATH = path.join(RAGKEEP_ROOT, "lectures", "rudolf-steiner-ga-vortrag-verzeichnis-orte.yaml");

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const GRAY = "\x1b[90m";
const RESET = "\x1b[0m";

/**
 * Lädt bekannte Orte (Städte) für Filterung
 */
function loadOrte() {
  if (!fs.existsSync(ORTE_PATH)) return new Set();
  const content = fs.readFileSync(ORTE_PATH, "utf-8");
  return new Set(
    content
      .split("\n")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s && !s.startsWith("#"))
  );
}

/**
 * Parst --range "355,356" oder "355-360" oder "68a-68d"
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
 * Lädt ga_list.txt und liefert Set der vorhandenen GA-Nummern
 */
function loadGaList(path) {
  if (!fs.existsSync(path)) return { gas: new Set(), lines: [] };
  const content = fs.readFileSync(path, "utf-8");
  const lines = content.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  const gas = new Set();
  for (const line of lines) {
    const m = line.match(/#([0-9]+[a-z]?)$/i);
    if (m) gas.add(m[1]);
  }
  return { gas, lines };
}

/**
 * Prüft, ob eine Zeile wie Metadaten aussieht (Vorträge, Städte, Datum etc.)
 */
function looksLikeMetadata(line, orte) {
  const t = line.trim();
  if (t.length < 3) return true;
  // Vortragsanzahl
  if (/^\d+\s*Vorträge?/i.test(t)) return true;
  if (/Vorträge?\s*$/i.test(t) && t.length < 50) return true;
  // Datum
  if (/^\d{1,2}\.\s*(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+\d{4}/i.test(t))
    return true;
  if (/^\d{1,2}\.\d{1,2}\.\d{4}/.test(t)) return true;
  // Auflage
  if (/^\d+\s*Aufl\./i.test(t)) return true;
  // Nur Zahlen
  if (/^\d+$/.test(t)) return true;
  // Zeile ist hauptsächlich eine Stadtliste (kurze Wörter mit Kommas)
  const words = t.split(/[\s,]+/).filter((w) => w.length > 1);
  if (words.length >= 2 && words.every((w) => w.length < 20)) {
    const allOrte = words.every((w) => orte.has(w.toLowerCase()));
    if (allOrte) return true;
  }
  // Einzelne bekannte Stadt als ganze Zeile
  if (words.length === 1 && orte.has(words[0].toLowerCase())) return true;
  return false;
}

/**
 * Extrahiert den Buchtitel aus dem Text der ersten 5 Seiten.
 * Sucht "Rudolf Steiner" und nimmt die Zeilen danach als Titel (ohne Metadaten).
 */
function extractTitleFromPdfText(text, orte) {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  let rudolfIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("Rudolf Steiner")) {
      rudolfIdx = i;
      break;
    }
  }
  if (rudolfIdx < 0) return null;

  const titleParts = [];
  const maxLines = 5;
  for (let i = rudolfIdx + 1; i < lines.length && titleParts.length < maxLines; i++) {
    const line = lines[i];
    if (!line) continue;
    if (looksLikeMetadata(line, orte)) break;
    // Zu kurze Zeilen überspringen (Seitennummern, etc.)
    if (line.length < 4) continue;
    titleParts.push(line);
  }
  if (titleParts.length === 0) return null;
  return titleParts.join(" ").trim();
}

/**
 * Entfernt typische Präambeln vom Buchtitel (Band GA N, RUDOLF STEINER etc.)
 */
function stripTitlePreamble(title) {
  return title
    .replace(/^Band\s+GA\s+\d+[a-z]?\s*/gi, "")
    .replace(/^RUDOLF\s+STEINER\s*/gi, "")
    .replace(/^Rudolf\s+Steiner\s*/g, "")
    .trim();
}

/**
 * Konvertiert Titel in ga_list-Format: Leerzeichen -> Unterstriche
 */
function titleToGaListFormat(title) {
  const cleaned = stripTitlePreamble(title);
  return cleaned
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_") // Mehrfache Unterstriche zu einem
    .replace(/^_|_$/g, ""); // Führende/trailing Unterstriche entfernen
}

/**
 * Listet alle GA-PDFs im Verzeichnis
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
    });

  if (rangeSet) {
    result = result.filter((f) => {
      const ga = gaNumberFromFilename(f);
      return ga && rangeSet.has(ga);
    });
  }
  return result;
}

const HELP_TEXT = `Ergänzt fehlende GA-Bände in ragprep/config/ga_list.txt.

Findet GA-PDFs, die noch nicht in ga_list.txt stehen, extrahiert den Buchtitel
aus den ersten 5 Seiten (meist Seite 3 unter "Rudolf Steiner") und fügt den
Eintrag hinzu. Nur der Titel, keine Vortragsanzahl oder Städte.

Benötigt: pdftotext (poppler)

Verwendung:
  node add_missing_ga_to_ga_list.mjs [Optionen]

Optionen:
  --help, -h     Diese Hilfe anzeigen
  --write        Änderungen in ga_list.txt schreiben (ohne: nur Vorschau)
  --range RANGE  Nur bestimmte GA-Bände verarbeiten
                 Beispiele: 355,356  oder  355-360  oder  68a-68d

Umgebungsvariablen:
  GA_PDF_DIR     Pfad zum GA-PDF-Verzeichnis (Standard: ~/GA 180dpi/GA-Acrobat/GA)
  GA_LIST_PATH   Pfad zu ga_list.txt (Standard: ../ragprep/config/ga_list.txt)
`;

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP_TEXT);
    return;
  }
  const doWrite = args.includes("--write");
  const rangeIdx = args.indexOf("--range");
  const rangeSet =
    rangeIdx >= 0 && args[rangeIdx + 1] ? parseRangeArg(args[rangeIdx + 1]) : null;

  const gaDir = GA_PDF_DIR.replace(/^~/, process.env.HOME || "");
  if (!fs.existsSync(gaDir)) {
    console.error(`${RED}Fehler: GA-PDF-Verzeichnis nicht gefunden: ${gaDir}${RESET}`);
    process.exit(1);
  }

  const gaListResolved = path.resolve(GA_LIST_PATH);
  if (!fs.existsSync(gaListResolved)) {
    console.error(`${RED}Fehler: ga_list.txt nicht gefunden: ${gaListResolved}${RESET}`);
    process.exit(1);
  }

  const { gas: existingGas, lines: gaListLines } = loadGaList(gaListResolved);
  const orte = loadOrte();
  const allPdfs = listGaPdfs(rangeSet);
  const missingPdfs = allPdfs.filter((f) => {
    const ga = gaNumberFromFilename(f);
    return ga && !existingGas.has(ga);
  });

  if (missingPdfs.length === 0) {
    console.log(
      rangeSet
        ? `Keine fehlenden GAs im Bereich ${[...rangeSet].sort().join(", ")}.`
        : "Alle GA-PDFs sind bereits in ga_list.txt enthalten."
    );
    return;
  }

  console.log(
    `\n${missingPdfs.length} GA-Bände fehlen in ga_list.txt. Extrahiere Titel aus ersten 5 Seiten...\n`
  );

  const toAdd = [];
  for (let idx = 0; idx < missingPdfs.length; idx++) {
    const filename = missingPdfs[idx];
    const gaNum = gaNumberFromFilename(filename);
    if (!gaNum) continue;

    const pdfPath = path.join(gaDir, filename);
    const text = extractPdfPages(pdfPath, 1, 5);
    const rawTitle = extractTitleFromPdfText(text, orte);

    if (!rawTitle) {
      console.log(`${YELLOW}GA ${gaNum}:${RESET} Titel nicht gefunden (Rudolf Steiner auf S. 3?)`);
      continue;
    }

    const titleFormatted = titleToGaListFormat(rawTitle);
    const entry = `Rudolf_Steiner#${titleFormatted}#${gaNum}`;
    toAdd.push({ gaNum, rawTitle, entry });

    const pct =
      missingPdfs.length > 1 ? Math.round(((idx + 1) / missingPdfs.length) * 100) : 100;
    process.stdout.write(
      `\r[${idx + 1}/${missingPdfs.length}] (${pct}%) GA ${gaNum}: ${rawTitle.slice(0, 50)}...    `
    );
  }
  console.log("\n");

  if (toAdd.length === 0) {
    console.log("Keine Titel extrahiert.");
    return;
  }

  console.log(`${GREEN}Gefundene Einträge:${RESET}\n`);
  for (const { gaNum, rawTitle, entry } of toAdd) {
    console.log(`${GRAY}GA ${gaNum}:${RESET} ${rawTitle}`);
    console.log(`  → ${entry}\n`);
  }

  if (doWrite) {
    const newLines = [...gaListLines];
    for (const { entry } of toAdd) {
      newLines.push(entry);
    }
    newLines.sort((a, b) => {
      const gaA = (a.match(/#([0-9]+[a-z]?)$/i) || [])[1] || "";
      const gaB = (b.match(/#([0-9]+[a-z]?)$/i) || [])[1] || "";
      const numA = parseInt(String(gaA).replace(/\D/g, ""), 10) || 0;
      const numB = parseInt(String(gaB).replace(/\D/g, ""), 10) || 0;
      if (numA !== numB) return numA - numB;
      return gaA.localeCompare(gaB);
    });
    const content = (newLines.join("\n") + "\n").replace(/^\n+/, "\n");
    fs.writeFileSync(gaListResolved, content, "utf-8");
    console.log(`${GREEN}${toAdd.length} Einträge in ${gaListResolved} geschrieben.${RESET}`);
  } else {
    console.log(
      `${YELLOW}Hinweis: Ohne --write wurden keine Änderungen geschrieben.${RESET}`
    );
  }
}

main();
