#!/usr/bin/env node
/**
 * Gegenprüfung: liste.pdf vs. rudolf-steiner-ga-vortrag-verzeichnis.yaml
 *
 * Liest die Vortragsliste aus liste.pdf, sammelt Zeilen mit GA oder "Zuordnung noch offen",
 * vergleicht mit dem YAML-Verzeichnis und markiert Abweichungen (grün/orange/rot).
 *
 * Benötigt: pdftotext (poppler)
 * Verwendung: node scripts/verify_ga_against_liste.mjs
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const LISTE_PDF = path.join(REPO_ROOT, "liste.pdf");
const YAML_PATH = path.join(REPO_ROOT, "lectures", "rudolf-steiner-ga-vortrag-verzeichnis.yaml");

const RED = "\x1b[31m";
const BRIGHT_GREEN = "\x1b[92m";
const ORANGE = "\x1b[38;5;208m";
const GRAY = "\x1b[90m";
const RESET = "\x1b[0m";

// Mit -layout: Zeilen können mit Leerzeichen beginnen; Datum + Ort + GA in derselben Zeile/Block
const DATE_RE = /^\s*(\d{2})\.(\d{2})\.(\d{4})\s+([^\t\n]+?)(?:\s{2,}|\t|$)/;
const GA_RE = /GA\s+(\d+[a-z]?(?:\/\d+)?)/gi;
// Nur Abdruck-Wert, nicht die Legende "Zuordnung noch offen = Publikation geplant..."
const ZUORDNUNG_OFFEN = /Zuordnung\s+noch\s+offen(?!\s*=)/i;
// Nur Abdruck-Wert, nicht die Legende "Kein Material vorhanden = gemäss..."
const KEIN_MATERIAL = /Kein\s+Material\s+vorhanden(?!\s*=)/i;

// GA-Nummern, deren Einträge nicht ausgegeben werden
const GA_EXCLUDE = new Set([
  "37", "38_1", "38_2", "38_3", "38/1", "38/2", "38/3",
  "41a", "41", "41b", "68a", "68b", "68c", "68d",
  "69b", "69c", "69d", "69e", "70a", "70b", "71a", "71b",
  "80a", "80b", "80c", "85", "87", "90a", "90b", "90c",
  "9", "91", "111", "117a", "244", "246", "250", "251",
  "291a", "332b", "336",
]);

/**
 * Prüft ob gaValue eine GA aus der Ausschlussliste enthält
 */
function gaContainsExcluded(gaValue) {
  if (!gaValue) return false;
  const parts = String(gaValue).split(/[\s,]+/).map((p) => p.replace(/['']/g, "").trim()).filter(Boolean);
  for (const p of parts) {
    const norm = normalizeGa(p);
    if (GA_EXCLUDE.has(p) || GA_EXCLUDE.has(norm)) return true;
  }
  return false;
}

/**
 * Extrahiert Text aus PDF
 */
function extractPdfText(pdfPath) {
  try {
    return execSync(`pdftotext -layout "${pdfPath}" - 2>/dev/null`, {
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch {
    return "";
  }
}

/**
 * Normalisiert GA-Nummer: 266/1 -> 266a, 266/2 -> 266b
 */
function normalizeGa(ga) {
  if (!ga) return ga;
  const m = String(ga).match(/^(\d+)\/(\d+)$/);
  if (m) {
    const letter = String.fromCharCode(96 + parseInt(m[2], 10));
    return `${m[1]}${letter}`;
  }
  return String(ga);
}

/**
 * Prüft ob gaValue die gaNum enthält (266/1 = 266a)
 */
function gaContainsNumber(gaValue, gaNum) {
  if (!gaValue) return false;
  const s = String(gaValue);
  const n = String(gaNum).replace(/^0+/, "");
  const nNorm = normalizeGa(n);
  const re1 = new RegExp(
    `(?:^|[\\s,/])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[\\s,/']|$)`,
    "u"
  );
  const re2 = new RegExp(
    `(?:^|[\\s,/])${nNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[\\s,/']|$)`,
    "u"
  );
  return re1.test(s) || re2.test(s);
}

/**
 * Parst liste.pdf und sammelt Einträge mit GA oder Zuordnung noch offen
 */
function parseListePdf(text) {
  const entries = [];
  // Zeilenumbrüche normalisieren (\r\n, \r -> \n)
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const dateMatch = line.match(DATE_RE);
    if (!dateMatch) {
      i++;
      continue;
    }

    const [, dd, mm, yyyy, ortPart] = dateMatch;
    const datum = `${dd}.${mm}.${yyyy}`;
    const ort = ortPart.trim();

    const blockLines = [line];
    let j = i + 1;
    // Stopp vor nächster Tabellenzeile: Zeile mit nur Ort (ohne Datum), z.B. "                Berlin\t"
    // pdftotext -layout gibt oft jedes Wort auf eigener Zeile aus
    const NEXT_ROW_RE = /^\s{10,}[A-Z][a-zäöüß]+\s*[\t]?$/;
    while (j < lines.length && !lines[j].match(DATE_RE) && !lines[j].match(/^--\s+\d+\s+of\s+\d+\s+--/)) {
      if (NEXT_ROW_RE.test(lines[j])) break;
      blockLines.push(lines[j]);
      j++;
    }

    const blockText = blockLines.join("\n");
    const blockNorm = blockText.replace(/\s+/g, " ");
    let gaNum = null;
    let zuordnungOffen = false;

    const gaMatch = blockNorm.match(GA_RE);
    if (gaMatch) {
      gaNum = gaMatch[gaMatch.length - 1].replace(/^GA\s+/i, "").trim();
    }
    if (ZUORDNUNG_OFFEN.test(blockNorm)) {
      zuordnungOffen = true;
    }
    if (KEIN_MATERIAL.test(blockNorm) && !gaNum && !zuordnungOffen) {
      i = j;
      continue;
    }
    if (!gaNum && !zuordnungOffen) {
      i = j;
      continue;
    }

    if (gaNum || zuordnungOffen) {
      entries.push({ datum, ort, gaNum, zuordnungOffen, blockText: blockLines[0] });
    }
    i = j;
  }

  return entries;
}

/**
 * Baut YAML-Index: datum -> [{ id, ort, vortragstitel, gaValue, hasGa }]
 */
function buildYamlIndex(lines) {
  const byDatum = new Map();
  const allEntries = [];
  let i = 0;
  let currentEntry = null;

  while (i < lines.length) {
    const line = lines[i];
    const idMatch = line.match(/^\s+-\s+id:\s*(.+)$/);
    if (idMatch) {
      if (currentEntry) {
        currentEntry.lineEnd = i - 1;
        if (currentEntry.datum) {
          if (!byDatum.has(currentEntry.datum)) byDatum.set(currentEntry.datum, []);
          byDatum.get(currentEntry.datum).push(currentEntry);
        }
        allEntries.push(currentEntry);
      }
      currentEntry = {
        lineStart: i,
        lineEnd: -1,
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
    i++;
  }

  if (currentEntry) {
    currentEntry.lineEnd = lines.length - 1;
    if (currentEntry.datum) {
      if (!byDatum.has(currentEntry.datum)) byDatum.set(currentEntry.datum, []);
      byDatum.get(currentEntry.datum).push(currentEntry);
    }
    allEntries.push(currentEntry);
  }

  return { byDatum, allEntries };
}

function main() {
  if (!fs.existsSync(LISTE_PDF)) {
    console.error(`${RED}Fehler: liste.pdf nicht gefunden: ${LISTE_PDF}${RESET}`);
    process.exit(1);
  }
  if (!fs.existsSync(YAML_PATH)) {
    console.error(`${RED}Fehler: YAML nicht gefunden: ${YAML_PATH}${RESET}`);
    process.exit(1);
  }

  const pdfText = extractPdfText(LISTE_PDF);
  const listeEntries = parseListePdf(pdfText);

  const withGa = listeEntries.filter((e) => e.gaNum);
  const withZuordnungOffen = listeEntries.filter((e) => e.zuordnungOffen && !e.gaNum);

  console.log("Schritt 1: Liste.pdf geparst");
  console.log(`  Zeilen mit GA-Nummer: ${withGa.length}`);
  console.log(`  Zeilen mit Zuordnung noch offen: ${withZuordnungOffen.length}`);
  console.log(`  Gesamt gesammelt: ${listeEntries.length}`);
  console.log("");

  const yamlContent = fs.readFileSync(YAML_PATH, "utf-8");
  const yamlLines = yamlContent.split("\n");
  const { byDatum, allEntries } = buildYamlIndex(yamlLines);

  const checkedDatums = new Set();

  console.log("Schritt 2: Abgleich mit Verzeichnis");
  for (const entry of listeEntries) {
    const { datum, ort, gaNum, zuordnungOffen } = entry;
    checkedDatums.add(datum);

    const yamlEntries = byDatum.get(datum) || [];

    if (yamlEntries.length === 0) {
      if (gaNum && gaContainsExcluded(gaNum)) continue;
      console.log(`${RED}  ${datum} ${ort}: Kein Eintrag im Verzeichnis${RESET}`);
      if (entry.blockText) console.log(`${GRAY}    ${entry.blockText.slice(0, 80)}...${RESET}`);
      continue;
    }

    let match = null;
    if (gaNum) {
      match = yamlEntries.find((e) => e.hasGa && gaContainsNumber(e.gaValue, gaNum));
      if (!match && yamlEntries.length > 1) {
        match = yamlEntries.find((e) => gaContainsNumber(e.gaValue, gaNum));
      }
    }
    if (!match && yamlEntries.length === 1) {
      match = yamlEntries[0];
    }
    if (!match) {
      match = yamlEntries[0];
    }

    if (gaNum) {
      if (match.hasGa && gaContainsNumber(match.gaValue, gaNum)) {
        continue;
      }
      if (match.hasGa && !gaContainsNumber(match.gaValue, gaNum)) {
        if (gaContainsExcluded(gaNum) || gaContainsExcluded(match.gaValue)) continue;
        console.log(
          `${RED}  ${datum} ${ort}: Falsche GA – Liste: ${gaNum}, Verzeichnis: ${match.gaValue}${RESET}`
        );
        console.log(`${GRAY}    ${match.id} ${match.vortragstitel || ""}${RESET}`);
        continue;
      }
      if (!match.hasGa) {
        if (gaContainsExcluded(gaNum)) continue;
        console.log(`${ORANGE}  ${datum} ${ort}: Keine GA im Verzeichnis – Liste: ${gaNum}${RESET}`);
        console.log(`${GRAY}    ${match.id} ${match.vortragstitel || ""}${RESET}`);
        continue;
      }
    }

    if (zuordnungOffen) {
      if (match.hasGa) {
        if (gaContainsExcluded(match.gaValue)) continue;
        console.log(
          `${BRIGHT_GREEN}  ${datum} ${ort}: Zuordnung offen in Liste, Verzeichnis hat ga: ${match.gaValue}${RESET}`
        );
        console.log(`${GRAY}    ${match.id} ${match.vortragstitel || ""}${RESET}`);
      } else {
        console.log(`${ORANGE}  ${datum} ${ort}: Zuordnung offen, keine GA im Verzeichnis${RESET}`);
        console.log(`${GRAY}    ${match.id} ${match.vortragstitel || ""}${RESET}`);
      }
    }
  }

  console.log("");
  console.log("Schritt 3: Nicht in Liste geprüft (Verzeichnis-Einträge)");
  const notChecked = allEntries.filter(
    (e) => e.datum && !checkedDatums.has(e.datum) && !gaContainsExcluded(e.gaValue)
  );
  for (const e of notChecked) {
    console.log(
      `${GRAY}  ${e.id} | ${e.datum} | ${e.ort || ""} | ${(e.vortragstitel || "").slice(0, 50)}... | ga: ${e.gaValue || "-"}${RESET}`
    );
  }
  console.log(`  Gesamt: ${notChecked.length} Einträge`);
}

main();
