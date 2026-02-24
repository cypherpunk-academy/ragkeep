#!/usr/bin/env node
/**
 * Ergänzt fehlende GA-Nummern in rudolf-steiner-ga-vortrag-verzeichnis.yaml.
 *
 * Durchsucht GA-PDFs ab 051, findet Inhaltsverzeichnisse, extrahiert Vortragsdaten
 * (Format: "5. Mai 1919") und prüft, ob im YAML ein Eintrag mit diesem Datum
 * existiert. Fehlt die GA-Nummer, wird sie nur geloggt (hellgrün), nicht eingefügt.
 * Mit --write werden die erkannten GA-Nummern tatsächlich in die YAML geschrieben.
 *
 * Benötigt: pdftotext (poppler)
 * Verwendung: node scripts/add_ga_from_ga_pdf_inhaltsverzeichnis.mjs [--write] [--range 51,52,53|332-337|68a,68b|68a-68c]
 */

import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const GA_PDF_DIR = process.env.GA_PDF_DIR || "/Users/michael/GA 180dpi/GA-Acrobat/GA";
const YAML_PATH = path.join(REPO_ROOT, "lectures", "rudolf-steiner-ga-vortrag-verzeichnis.yaml");
const ORTE_PATH = path.join(REPO_ROOT, "lectures", "rudolf-steiner-ga-vortrag-verzeichnis-orte.yaml");
const BLACKLIST_PATH = path.join(REPO_ROOT, "scripts", "add_ga_from_ga_pdf_inhaltsverzeichnis.blacklist");

/** GA-Nummern ohne Vorträge – werden übersprungen */
const GA_EXCLUDED = new Set([244, 246, 250, 251, 260, 266]);

/** UUID v5 Namespace für add_ga Blacklist (6ba7b810-9dad-11d1-80b4-00c04fd430c8 = DNS) */
const UUID5_NAMESPACE = Buffer.from("6ba7b8109dad11d180b400c04fd430c8", "hex");

/**
 * Erzeugt UUID v5 aus einer Zeichenkette (RFC 4122, SHA-1-basiert)
 */
function uuidv5(name) {
  const hash = createHash("sha1")
    .update(Buffer.concat([UUID5_NAMESPACE, Buffer.from(String(name), "utf-8")]))
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return [
    bytes.subarray(0, 4).toString("hex"),
    bytes.subarray(4, 6).toString("hex"),
    bytes.subarray(6, 8).toString("hex"),
    bytes.subarray(8, 10).toString("hex"),
    bytes.subarray(10, 16).toString("hex"),
  ].join("-");
}

/**
 * Lädt Blacklist-UUIDs aus add_ga_from_ga_pdf_inhaltsverzeichnis.blacklist
 */
function loadBlacklist() {
  if (!fs.existsSync(BLACKLIST_PATH)) return new Set();
  const content = fs.readFileSync(BLACKLIST_PATH, "utf-8");
  return new Set(
    content
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith("#"))
  );
}

/**
 * Lädt Orte aus rudolf-steiner-ga-vortrag-verzeichnis-orte.yaml.
 * Sortiert nach Länge absteigend, damit z.B. "Freiburg i. Br." vor "Freiburg" matcht.
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

const RED = "\x1b[31m";
const BRIGHT_GREEN = "\x1b[92m";
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
 * Formatiert datum "DD.MM.YYYY" zu "DD. Monat YYYY" und liefert id "YYYYMMDD"
 */
function formatDatumForDisplay(datum) {
  const m = datum.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return { display: datum, id: datum.replace(/\./g, "") };
  const [, dd, mm, yyyy] = m;
  const month = MONTHS[parseInt(mm, 10) - 1] || mm;
  return { display: `${parseInt(dd, 10)}. ${month} ${yyyy}`, id: `${yyyy}${mm}${dd}` };
}

/**
 * Parst --range "51,52,53" oder "332-337" oder "68a,68b" oder "68a-68c"
 * Liefert Set von Strings: "68", "68a", "68b" etc.
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
 * Extrahiert GA-Nummer aus Dateinamen: "GA 051.pdf" -> 51, "GA 293.pdf" -> 293
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
    const out = execSync(
      `pdftotext -f ${fromPage} -l ${toPage} "${pdfPath}" - 2>/dev/null`,
      { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
    );
    return out;
  } catch {
    return "";
  }
}

/**
 * Findet die Seitennummer (1-basiert) mit "Inhalt" oder "Inhaltsverzeichnis" in den ersten 15 Seiten.
 */
function findInhaltsverzeichnisPage(pdfPath) {
  const text = extractPdfPages(pdfPath, 1, 15);
  const pages = text.split(/\f/);
  const tocRe = /^\s*(INHALT|INHALTSVERZEICHNIS)\s*$/im;
  for (let i = 0; i < pages.length; i++) {
    const firstLines = pages[i].split("\n").slice(0, 5).join("\n");
    if (tocRe.test(firstLines)) return i + 1;
  }
  return null;
}

/**
 * Parst Vortragsdaten aus TOC-Text. Format: "5. Mai 1919", "21. August 1919", "22. August" + "1919" (nächste Zeile)
 * Liefert hasCommaBefore: true wenn ein Komma vor dem Datum steht (gültiger Vortragseintrag)
 * Liefert hasOrtBefore: true wenn ein Ort aus der Ortsliste direkt vor dem Datum steht
 */
function parseLectureDatesFromToc(text, orte = []) {
  const results = [];
  const lines = text.split("\n");
  let lastYear = null;
  let pending = null;

  const dateRe = new RegExp(
    `(\\d{1,2})\\.\\s+(${MONTHS.join("|")})\\s*(\\d{4})?`,
    "gi"
  );

  function getContextWords(line, matchStart, matchEnd) {
    const before = line.slice(0, matchStart).trim();
    const after = line.slice(matchEnd).trim();
    const wordsBefore = before ? before.split(/\s+/).slice(-5) : [];
    const wordsAfter = after ? after.split(/\s+/).slice(0, 5) : [];
    return { wordsBefore, wordsAfter };
  }

  function output(day, monthIdx, year, line, match, lineIndex) {
    const month = monthIdx + 1;
    const dd = String(day).padStart(2, "0");
    const mm = String(month).padStart(2, "0");
    const datum = `${dd}.${mm}.${year}`;
    let textBefore = line.slice(0, match.index);
    const lineStartsWithDate = textBefore.trim() === "";
    if (lineStartsWithDate && lineIndex > 0) {
      textBefore = lines[lineIndex - 1] + "\n" + textBefore;
    }
    const hasCommaBefore = /[,\u00BB\u203A\u201C\u201D;]\s*$/.test(textBefore);
    const hasOrtBefore = orte.some((ort) => textBefore.trim().endsWith(ort));
    const hasVortragBefore = /(?:V\s*O\s*R\s*T\s*R\s*A\s*G|VORTRAG)\s*$/i.test(textBefore.trim());
    const hasZumVortragVom = /(?:Zum Vortrag|Zu den Vorträgen) vom\s*$/i.test(textBefore);
    const openParens = (textBefore.match(/\(/g) || []).length;
    const closeParens = (textBefore.match(/\)/g) || []).length;
    const inParentheses = openParens > closeParens;
    const { wordsBefore, wordsAfter } = getContextWords(line, match.index, match.index + match[0].length);
    const sourceLine =
      textBefore.trim() === "" && lineIndex > 0
        ? `${lines[lineIndex - 1].trim()} ${line.trim()}`
        : line.trim();
    results.push({ datum, hasCommaBefore, hasOrtBefore, hasVortragBefore, hasZumVortragVom, lineStartsWithDate, inParentheses, wordsBefore, wordsAfter, sourceLine });
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
      const monthIdx = MONTHS.findIndex(
        (mo) => mo.toLowerCase() === monthName.toLowerCase()
      );
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
 * Prüft, ob ga-Feld die GA-Nummer enthält (z.B. "ga: 51" oder "ga: 293,300/1'" enthält 293)
 */
function gaContainsNumber(gaValue, gaNum) {
  if (!gaValue) return false;
  const s = String(gaValue);
  const n = String(gaNum).replace(/^0+/, "");
  const re = new RegExp(`(?:^|[\\s,/])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[\\s,/']|$)`, "u");
  return re.test(s);
}

/**
 * Parst YAML und baut Index: datum -> [{ lineStart, lineEnd, hasGa, gaValue }]
 */
function buildYamlIndex(lines) {
  const byDatum = new Map();
  let i = 0;
  let currentEntry = null;

  while (i < lines.length) {
    const line = lines[i];
    const idMatch = line.match(/^\s+-\s+id:\s*(.+)$/);
    if (idMatch) {
      if (currentEntry) {
        currentEntry.lineEnd = i - 1;
        const datum = currentEntry.datum;
        if (datum) {
          if (!byDatum.has(datum)) byDatum.set(datum, []);
          byDatum.get(datum).push(currentEntry);
        }
      }
      currentEntry = { lineStart: i, lineEnd: -1, datum: null, hasGa: false, gaValue: null, gaLineIndex: null };
    }

    if (currentEntry) {
      const datumMatch = line.match(/^\s+datum:\s*(.+)$/);
      if (datumMatch) currentEntry.datum = datumMatch[1].trim();

      const gaMatch = line.match(/^\s+ga:\s*(.+)$/);
      if (gaMatch) {
        currentEntry.hasGa = true;
        currentEntry.gaValue = gaMatch[1].trim();
        currentEntry.gaLineIndex = i;
      }
    }
    i++;
  }

  if (currentEntry) {
    currentEntry.lineEnd = lines.length - 1;
    const datum = currentEntry.datum;
    if (datum) {
      if (!byDatum.has(datum)) byDatum.set(datum, []);
      byDatum.get(datum).push(currentEntry);
    }
  }

  return byDatum;
}

/**
 * Fügt ga: <nummer> in einen YAML-Eintrag ein (nach der letzten Zeile des Eintrags)
 */
function insertGaIntoEntry(lines, entry, gaNum) {
  const insertLine = entry.lineEnd + 1;
  const indent = "    ";
  const gaLine = `${indent}ga: ${gaNum}`;
  const newLines = [...lines.slice(0, insertLine), gaLine, ...lines.slice(insertLine)];
  return newLines;
}

/**
 * Hängt gaNum an bestehende ga-Zeile an (z.B. "51" -> "51,90a")
 */
function appendGaToEntry(lines, entry, gaNum) {
  if (entry.gaLineIndex == null) return lines;
  const line = lines[entry.gaLineIndex];
  const m = line.match(/^(\s+ga:\s*)(.+)$/);
  if (!m) return lines;
  const newValue = `${m[2].trim()},${gaNum}`;
  const newLine = `${m[1]}${newValue}`;
  const newLines = [...lines];
  newLines[entry.gaLineIndex] = newLine;
  return newLines;
}

/**
 * Sammelt alle GA-PDFs ab 051, alphabetisch sortiert
 */
function listGaPdfs() {
  if (!fs.existsSync(GA_PDF_DIR)) return [];
  const files = fs.readdirSync(GA_PDF_DIR);
  return files
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
      return num >= 51 && !GA_EXCLUDED.has(num);
    });
}

function main() {
  const args = process.argv.slice(2);
  const doWrite = args.includes("--write");
  const rangeIdx = args.indexOf("--range");
  const rangeSet =
    rangeIdx >= 0 && args[rangeIdx + 1]
      ? parseRangeArg(args[rangeIdx + 1])
      : null;

  if (!fs.existsSync(GA_PDF_DIR)) {
    console.error(`${RED}Fehler: GA-PDF-Verzeichnis nicht gefunden: ${GA_PDF_DIR}${RESET}`);
    process.exit(1);
  }
  if (!fs.existsSync(YAML_PATH)) {
    console.error(`${RED}Fehler: YAML nicht gefunden: ${YAML_PATH}${RESET}`);
    process.exit(1);
  }

  let allPdfs = listGaPdfs();
  if (rangeSet) {
    allPdfs = allPdfs.filter((f) => {
      const ga = gaNumberFromFilename(f);
      return ga && rangeSet.has(ga);
    });
  }

  const total = allPdfs.length;
  if (total === 0) {
    console.log("Keine GA-PDFs im Bereich gefunden.");
    return;
  }

  let yamlLines = fs.readFileSync(YAML_PATH, "utf-8").split("\n");
  const blacklist = loadBlacklist();
  const orte = loadOrte();
  let totalInserted = 0;
  let totalErrors = 0;
  let totalChecked = 0;
  let totalFound = 0;

  for (let idx = 0; idx < total; idx++) {
    const filename = allPdfs[idx];
    const gaNum = gaNumberFromFilename(filename);
    if (!gaNum) continue;

    const pct = total > 1 ? Math.round(((idx + 1) / total) * 100) : 100;
    const barLen = 20;
    const filled = Math.round((idx + 1) / total * barLen);
    const bar =
      "=".repeat(filled) +
      (filled < barLen ? ">" : "") +
      " ".repeat(Math.max(0, barLen - filled - 1));
    const progress = `[${bar}] ${idx + 1}/${total} (${pct}%)`;
    process.stdout.write(`${progress} GA ${gaNum} ... `);

    const pdfPath = path.join(GA_PDF_DIR, filename);
    if (!fs.existsSync(pdfPath)) {
      console.log("PDF nicht gefunden, überspringe.");
      continue;
    }

    const tocPage = findInhaltsverzeichnisPage(pdfPath);
    if (!tocPage) {
      console.log("Kein Inhaltsverzeichnis in den ersten 15 Seiten.");
      continue;
    }

    const tocText = extractPdfPages(pdfPath, tocPage, tocPage + 19);
    const lectures = parseLectureDatesFromToc(tocText, orte);

    if (lectures.length === 0) {
      console.log("Keine Vortragsdaten im TOC gefunden.");
      continue;
    }

    const byDatum = buildYamlIndex(yamlLines);
    let inserted = 0;
    let errors = 0;
    let checked = 0;
    let found = 0;
    const pendingInserts = [];

    for (const lecture of lectures) {
      const { datum, hasCommaBefore, hasOrtBefore, hasVortragBefore, hasZumVortragVom, lineStartsWithDate, inParentheses, wordsBefore, wordsAfter, sourceLine } = lecture;

      if (inParentheses) continue;

      if (!hasCommaBefore && !hasOrtBefore && !hasVortragBefore && !lineStartsWithDate) {
        if (hasZumVortragVom) continue;
        console.log("");
        console.log(`${YELLOW}  Warnung – könnte ein Datum sein: GA ${gaNum}${RESET}`);
        if (sourceLine) {
          console.log(`${GRAY}  Zeile: ${sourceLine}${RESET}`);
        }
        continue;
      }

      checked++;
      const entries = byDatum.get(datum) || [];
      if (entries.length > 0) found++;

      const withGa = entries.find((e) => e.hasGa && gaContainsNumber(e.gaValue, gaNum));
      if (withGa) continue;

      const withoutGa = entries.filter((e) => !e.hasGa);
      const withGaButNotOurs = entries.filter((e) => e.hasGa && !gaContainsNumber(e.gaValue, gaNum));

      if (withoutGa.length === 0 && withGaButNotOurs.length === 0) {
        const lineId = sourceLine ? uuidv5(sourceLine) : null;
        if (lineId && blacklist.has(lineId)) continue;

        console.log("");
        const { display, id } = formatDatumForDisplay(datum);
        const prefix = lineId ? `[${lineId}] ` : "";
        console.error(`${RED}${prefix}Fehler: GA ${gaNum}, Datum ${display} (${id}) ${datum} – kein Eintrag ohne GA-Nummer gefunden.${RESET}`);
        if (sourceLine) {
          console.error(`${ORANGE}  Zeile: ${sourceLine}${RESET}`);
        }
        errors++;
        totalErrors++;
        continue;
      }

      const lineId = sourceLine ? uuidv5(sourceLine) : null;
      if (lineId && blacklist.has(lineId)) continue;

      const targetEntry = withoutGa.length > 0 ? withoutGa[0] : withGaButNotOurs[0];
      const isAppend = withoutGa.length === 0; // An bestehende ga-Zeile anhängen

      if ((withoutGa.length > 1 || withGaButNotOurs.length > 1) && !isAppend) {
        console.log("");
        process.stdout.write(`  Warnung: ${withoutGa.length} Einträge ohne GA am ${datum}, nehme ersten. `);
      } else if (withGaButNotOurs.length > 1) {
        console.log("");
        process.stdout.write(`  Warnung: ${withGaButNotOurs.length} Einträge mit anderer GA am ${datum}, nehme ersten. `);
      }

      inserted++;
      totalInserted++;
      pendingInserts.push({ entry: targetEntry, gaNum, append: isAppend });
      const { display, id } = formatDatumForDisplay(datum);
      const prefix = lineId ? `[${lineId}] ` : "";
      console.log("");
      const action = isAppend ? (doWrite ? "ergänzt" : "würde ergänzt") : (doWrite ? "eingefügt" : "würde eingefügt");
      console.log(
        `${BRIGHT_GREEN}  ${prefix}GA-Nummer ${action}: ga: ${gaNum} für ${display} (${id})${RESET}`
      );
      if (sourceLine) {
        console.log(`${GRAY}  Zeile: ${sourceLine}${RESET}`);
      }
    }

    if (doWrite && pendingInserts.length > 0) {
      const appends = pendingInserts.filter((p) => p.append);
      const inserts = pendingInserts.filter((p) => !p.append);
      for (const { entry, gaNum } of appends) {
        yamlLines = appendGaToEntry(yamlLines, entry, gaNum);
      }
      const sortedInserts = [...inserts].sort((a, b) => b.entry.lineEnd - a.entry.lineEnd);
      for (const { entry, gaNum } of sortedInserts) {
        yamlLines = insertGaIntoEntry(yamlLines, entry, gaNum);
      }
      fs.writeFileSync(YAML_PATH, yamlLines.join("\n"), "utf-8");
    }

    if (inserted === 0 && errors === 0) {
      console.log(`OK (${checked} geprüft, ${found} gefunden, alle bereits mit GA).`);
    } else if (inserted > 0 && errors === 0) {
      console.log(`  ${inserted} GA-Nummer(n) ${doWrite ? "eingefügt" : "würden eingefügt"} (${checked} geprüft, ${found} gefunden).`);
    } else if (checked > 0) {
      console.log(`  (${checked} geprüft, ${found} gefunden)`);
    }
    totalChecked += checked;
    totalFound += found;
  }

  if (totalInserted > 0) {
    console.log(
      `\n${totalInserted} GA-Nummer(n) ${doWrite ? "eingefügt" : "würden eingefügt (keine Änderung – nur Log)"}.`
    );
  }

  if (totalErrors > 0) {
    console.error(`\n${RED}${totalErrors} Fehler (kein passender Eintrag gefunden).${RESET}`);
  }

  if (totalChecked > 0) {
    console.log(`\nGesamt: ${totalChecked} geprüft, ${totalFound} gefunden.`);
  }
}

main();
