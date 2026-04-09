import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import type { Agent, Book } from "./types";
import { fileExists, readScalarFromManifest } from "./utils";

interface LectureVerzeichnisEntry {
  id?: string | number;
  datum?: string;
  ort?: string;
  vortragstitel?: string;
  zyklus?: string | number;
  ga?: string | number;
}

interface LectureZyklusEntry {
  zyklus?: string | number;
  titel?: string;
}

interface LectureCatalogRecord {
  id: string;
  date: string;
  dateValue: number | null;
  location: string;
  title: string;
  zyklus: number | null;
  zyklusTitle: string;
  gaValues: string[];
  gaTitles: string[];
  htmlPath: string | null;
  summary: string | null;
}

interface LectureCatalog {
  byId: Map<string, LectureCatalogRecord>;
  idsByZyklus: Map<number, string[]>;
  idsByGa: Map<string, string[]>;
}

export interface LectureView {
  id: string;
  date: string;
  dateValue: number | null;
  location: string;
  title: string;
  zyklus: number | null;
  zyklusTitle: string;
  ga: string;
  gaTitle: string;
  htmlPath: string | null;
  summary: string | null;
}

export interface AgentLectureSets {
  primaryLectures: LectureView[];
  secondaryLectures: LectureView[];
}

function parseDateValue(date: string): number | null {
  const m = String(date).trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  return Number(`${m[3]}${m[2]}${m[1]}`);
}

function normalizeGaValues(value: string | number | undefined): string[] {
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((part) => /^[0-9]+[a-z]?$/.test(part));
}

function buildGaTitleByGa(booksById: Map<string, Book>): Map<string, string> {
  const map = new Map<string, string>();
  const books = Array.from(booksById.values()).sort((a, b) =>
    a.title.localeCompare(b.title, "de")
  );
  for (const book of books) {
    const parts = String(book.dirName).split("#");
    const gaRaw = String(parts[2] ?? "").trim().toLowerCase();
    if (!gaRaw || !/^[0-9]+[a-z]?$/.test(gaRaw)) continue;
    if (!map.has(gaRaw)) {
      map.set(gaRaw, book.title);
    }
  }
  return map;
}

/**
 * Lädt GA-Titel aus book-manifest.yaml in Buchordnern, auch wenn kein HTML existiert.
 * Ergänzt fehlende Einträge in gaTitleByGa.
 */
function loadGaTitlesFromBookManifests(repoRoot: string): Map<string, string> {
  const result = new Map<string, string>();
  const sources = [
    path.join(repoRoot, "books"),
    path.join(repoRoot, "ragkeep-deutsche-klassik-books-de", "books"),
  ];
  for (const source of sources) {
    if (!fs.existsSync(source)) continue;
    const entries = fs.readdirSync(source, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dirName = entry.name;
      const absBookDir = path.join(source, dirName);
      const manifestPath = path.join(absBookDir, "book-manifest.yaml");
      if (!fileExists(manifestPath)) continue;
      const parts = dirName.split("#");
      const gaRaw = String(parts[2] ?? "").trim().toLowerCase();
      if (!gaRaw || !/^[0-9]+[a-z]?$/.test(gaRaw)) continue;
      const title = readScalarFromManifest(absBookDir, "title").trim();
      if (!title) continue;
      if (!result.has(gaRaw)) {
        result.set(gaRaw, title);
      }
    }
  }
  return result;
}

function loadLectureHtmlById(repoRoot: string): Map<string, string> {
  const htmlDir = path.join(repoRoot, "lectures", "html");
  const result = new Map<string, string>();
  if (!fs.existsSync(htmlDir)) return result;
  const files = fs.readdirSync(htmlDir);
  for (const file of files) {
    if (!file.endsWith(".html")) continue;
    const id = file.split("_")[0]?.trim();
    if (!id) continue;
    if (!result.has(id)) {
      result.set(id, `lectures/html/${file}`);
    }
  }
  return result;
}

function loadLectureSummariesById(repoRoot: string): Map<string, string> {
  const summariesDir = path.join(repoRoot, "lectures", "chunks", "summaries");
  const result = new Map<string, string>();
  if (!fs.existsSync(summariesDir)) return result;
  const files = fs.readdirSync(summariesDir);
  for (const file of files) {
    if (!file.endsWith(".summaries.jsonl")) continue;
    const id = file.split("_")[0]?.trim();
    if (!id || result.has(id)) continue;
    const absPath = path.join(summariesDir, file);
    try {
      const lines = fs
        .readFileSync(absPath, "utf8")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line) as { text?: unknown };
          const text = String(parsed.text ?? "").trim();
          if (text) {
            result.set(id, text);
            break;
          }
        } catch {
          // ignore malformed line
        }
      }
    } catch {
      // ignore read errors
    }
  }
  return result;
}

function readVerzeichnis(repoRoot: string): LectureVerzeichnisEntry[] {
  const filePath = path.join(
    repoRoot,
    "lectures",
    "rudolf-steiner-ga-vortrag-verzeichnis.yaml"
  );
  if (!fs.existsSync(filePath)) return [];
  try {
    const parsed = yaml.load(fs.readFileSync(filePath, "utf8")) as
      | { lectures?: LectureVerzeichnisEntry[] }
      | undefined;
    if (!parsed?.lectures || !Array.isArray(parsed.lectures)) return [];
    return parsed.lectures;
  } catch {
    return [];
  }
}

function readZyklen(repoRoot: string): Map<number, string> {
  const filePath = path.join(
    repoRoot,
    "lectures",
    "rudolf-steiner-ga-vortrag-zyklus.yaml"
  );
  const result = new Map<number, string>();
  if (!fs.existsSync(filePath)) return result;
  try {
    const parsed = yaml.load(fs.readFileSync(filePath, "utf8")) as
      | { zyklen?: LectureZyklusEntry[] }
      | undefined;
    const list = parsed?.zyklen;
    if (!list || !Array.isArray(list)) return result;
    for (const entry of list) {
      const zyklusNum = Number(entry.zyklus);
      if (!Number.isFinite(zyklusNum)) continue;
      const title = String(entry.titel ?? "").trim();
      if (!title) continue;
      result.set(zyklusNum, title);
    }
  } catch {
    // ignore parse errors
  }
  return result;
}

function sortLectureIds(ids: string[], byId: Map<string, LectureCatalogRecord>): string[] {
  return ids.sort((a, b) => {
    const aRec = byId.get(a);
    const bRec = byId.get(b);
    const aDate = aRec?.dateValue ?? Number.MAX_SAFE_INTEGER;
    const bDate = bRec?.dateValue ?? Number.MAX_SAFE_INTEGER;
    if (aDate !== bDate) return aDate - bDate;
    return a.localeCompare(b, "de");
  });
}

function buildLectureCatalog(repoRoot: string, booksById: Map<string, Book>): LectureCatalog {
  const byId = new Map<string, LectureCatalogRecord>();
  const idsByZyklus = new Map<number, string[]>();
  const idsByGa = new Map<string, string[]>();
  const verzeichnis = readVerzeichnis(repoRoot);
  const zyklusTitles = readZyklen(repoRoot);
  const htmlById = loadLectureHtmlById(repoRoot);
  const summaryById = loadLectureSummariesById(repoRoot);
  const gaTitleByGa = buildGaTitleByGa(booksById);
  const manifestGaTitles = loadGaTitlesFromBookManifests(repoRoot);
  for (const [ga, title] of manifestGaTitles) {
    if (!gaTitleByGa.has(ga)) {
      gaTitleByGa.set(ga, title);
    }
  }

  for (const lecture of verzeichnis) {
    const id = String(lecture.id ?? "").trim().replace(/^lecture:/, "");
    if (!id) continue;
    const gaValues = normalizeGaValues(lecture.ga);
    const gaTitles = gaValues.map((ga) => gaTitleByGa.get(ga) ?? "").filter(Boolean);
    const zyklusRaw = String(lecture.zyklus ?? "").trim();
    const zyklus = zyklusRaw ? Number(zyklusRaw) : NaN;
    const hasZyklus = Number.isFinite(zyklus);
    const record: LectureCatalogRecord = {
      id,
      date: String(lecture.datum ?? "").trim(),
      dateValue: parseDateValue(String(lecture.datum ?? "").trim()),
      location: String(lecture.ort ?? "").trim(),
      title: String(lecture.vortragstitel ?? "").trim() || "(Ohne Titel)",
      zyklus: hasZyklus ? zyklus : null,
      zyklusTitle: hasZyklus ? String(zyklusTitles.get(zyklus) ?? "").trim() : "",
      gaValues,
      gaTitles,
      htmlPath: htmlById.get(id) ?? null,
      summary: summaryById.get(id) ?? null,
    };
    byId.set(id, record);
    if (record.zyklus != null) {
      const list = idsByZyklus.get(record.zyklus) ?? [];
      list.push(id);
      idsByZyklus.set(record.zyklus, list);
    }
    for (const ga of gaValues) {
      const list = idsByGa.get(ga) ?? [];
      list.push(id);
      idsByGa.set(ga, list);
    }
  }

  for (const [key, ids] of idsByZyklus) {
    idsByZyklus.set(key, sortLectureIds(ids, byId));
  }
  for (const [key, ids] of idsByGa) {
    idsByGa.set(key, sortLectureIds(ids, byId));
  }

  return { byId, idsByZyklus, idsByGa };
}

function resolveSelectionEntry(entry: string, catalog: LectureCatalog): string[] {
  const trimmed = String(entry).trim();
  if (!trimmed) return [];

  const zyklusMatch = trimmed.match(/^Zyklus\s+(\d+)(?:[,\s].*)?$/i);
  if (zyklusMatch) {
    const zyklus = Number(zyklusMatch[1]);
    return catalog.idsByZyklus.get(zyklus) ?? [];
  }

  const gaMatch = trimmed.match(/^GA\s+([0-9]+[a-z]?)(?:[,\s].*)?$/i);
  if (gaMatch) {
    const ga = gaMatch[1].toLowerCase();
    return catalog.idsByGa.get(ga) ?? [];
  }

  const directId = trimmed.replace(/^lecture:/, "");
  return catalog.byId.has(directId) ? [directId] : [];
}

function toLectureView(record: LectureCatalogRecord): LectureView {
  return {
    id: record.id,
    date: record.date,
    dateValue: record.dateValue,
    location: record.location,
    title: record.title,
    zyklus: record.zyklus,
    zyklusTitle: record.zyklusTitle,
    ga: record.gaValues[0] ?? "",
    gaTitle: record.gaTitles[0] ?? "",
    htmlPath: record.htmlPath,
    summary: record.summary,
  };
}

function resolveLectureSelection(entries: string[], catalog: LectureCatalog): LectureView[] {
  const selectedIds = new Set<string>();
  for (const entry of entries) {
    const resolvedIds = resolveSelectionEntry(entry, catalog);
    for (const id of resolvedIds) selectedIds.add(id);
  }
  const sorted = sortLectureIds(Array.from(selectedIds), catalog.byId);
  return sorted
    .map((id) => catalog.byId.get(id))
    .filter((record): record is LectureCatalogRecord => record != null)
    .map(toLectureView);
}

export function collectLecturesByAgent(
  repoRoot: string,
  agents: Agent[],
  booksById: Map<string, Book>
): Map<string, AgentLectureSets> {
  const catalog = buildLectureCatalog(repoRoot, booksById);
  const result = new Map<string, AgentLectureSets>();
  for (const agent of agents) {
    result.set(agent.id, {
      primaryLectures: resolveLectureSelection(agent.primaryLectures, catalog),
      secondaryLectures: resolveLectureSelection(agent.secondaryLectures, catalog),
    });
  }
  return result;
}

/** Anzahl der im Verzeichnis aufgelösten, eindeutigen Vorträge (Primär + Sekundär). */
export function countDistinctLectureViews(sets: AgentLectureSets): number {
  const ids = new Set<string>();
  for (const v of sets.primaryLectures) ids.add(v.id);
  for (const v of sets.secondaryLectures) ids.add(v.id);
  return ids.size;
}

export function copyLecturesHtmlToSite(repoRoot: string, outputDir: string): void {
  const source = path.join(repoRoot, "lectures", "html");
  if (!fs.existsSync(source)) return;
  const destination = path.join(outputDir, "lectures", "html");
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
}
