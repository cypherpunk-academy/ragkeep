#!/usr/bin/env node
/**
 * Generiert SVG-Buchcover (Stil: dunkler Kopf mit Diagramm, cremefarbener Rumpf, Autor unten)
 * aus book-manifest.yaml für alle primary/secondary-books von philo-von-freisinn.
 * Ausgabe: site/assets/covers/{book-id}.svg
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const ASSISTANT_MANIFEST = path.join(
  REPO_ROOT,
  "assistants/philo-von-freisinn/assistant-manifest.yaml"
);
const OUT_DIR = path.join(REPO_ROOT, "assets/covers");

const W = 400;
const H = 630;
const TOP_H = Math.round(H * 0.3);
const BOT_H = Math.round(H * 0.1);
const MID_Y = TOP_H;
const MID_H = H - TOP_H - BOT_H;

const BG_DARK = "#2d2d2d";
const BG_CREAM = "#f7f3ed";
const SUBTITLE_MUTED = "#6b6b6b";
const STROKE_WHITE = "#ffffff";

function fnv1a32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface BookManifest {
  author?: string;
  title?: string;
  subtitle?: string;
  "book-id"?: string;
}

function loadYaml<T>(p: string): T | null {
  if (!fs.existsSync(p)) return null;
  try {
    return yaml.load(fs.readFileSync(p, "utf8")) as T;
  } catch {
    return null;
  }
}

function normalizeWs(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

/** Zeilenumbruch für schmale Cover-Breite (Titel / Untertitel). */
function wrapLines(text: string, maxChars: number, maxLines: number): string[] {
  const t = normalizeWs(text);
  const words = t.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if (lines.length >= maxLines) break;
    const test = line ? `${line} ${w}` : w;
    if (test.length <= maxChars) {
      line = test;
    } else {
      if (line) {
        lines.push(line);
        line = w.length > maxChars ? `${w.slice(0, maxChars - 1)}…` : w;
      } else {
        line = w.length > maxChars ? `${w.slice(0, maxChars - 1)}…` : w;
      }
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === 0 && t) lines.push(t.slice(0, maxChars));
  return lines;
}

/**
 * Explizites subtitle-Feld; sonst Titel nach erstem „. “ teilen (z. B. „Lucifer-Gnosis. Grundlegende …“).
 */
function resolveTitleAndSubtitle(m: BookManifest): { title: string; subtitle: string } {
  const fullTitle = normalizeWs(String(m.title ?? ""));
  const explicit = normalizeWs(String(m.subtitle ?? ""));
  if (explicit) {
    return { title: fullTitle || "Ohne Titel", subtitle: explicit };
  }
  const m2 = fullTitle.match(/^(.+?)\.\s+(.+)$/);
  if (m2 && m2[1].length >= 2 && m2[2].length >= 6) {
    return { title: m2[1].trim(), subtitle: m2[2].trim() };
  }
  return { title: fullTitle || "Ohne Titel", subtitle: "" };
}

function diagramFromSeed(seed: string): {
  circles: number;
  spokes: number;
  rot: number;
  dotMask: number;
} {
  const h = fnv1a32(seed);
  const circles = 2 + (h % 3);
  const spokes = 6 + ((h >>> 8) % 7);
  const rot = ((h >>> 16) % 360) * (Math.PI / 180);
  const dotMask = h >>> 20;
  return { circles, spokes, rot, dotMask };
}

function buildDiagramSvg(cx: number, cy: number, seed: string): string {
  const { circles, spokes, rot, dotMask } = diagramFromSeed(seed);
  const maxR = 78;
  const parts: string[] = [];

  for (let c = 1; c <= circles; c++) {
    const r = (maxR * c) / circles;
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(2)}" fill="none" stroke="${STROKE_WHITE}" stroke-width="0.55" />`
    );
  }

  for (let s = 0; s < spokes; s++) {
    const a = rot + (s * 2 * Math.PI) / spokes;
    const x2 = cx + maxR * Math.cos(a);
    const y2 = cy + maxR * Math.sin(a);
    parts.push(
      `<line x1="${cx}" y1="${cy}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${STROKE_WHITE}" stroke-width="0.55" />`
    );
  }

  for (let s = 0; s < spokes; s++) {
    const a = rot + (s * 2 * Math.PI) / spokes;
    for (let c = 1; c <= circles; c++) {
      const r = (maxR * c) / circles;
      const bit = (dotMask >> ((s * circles + c) % 24)) & 1;
      if (!bit) continue;
      const px = cx + r * Math.cos(a);
      const py = cy + r * Math.sin(a);
      parts.push(`<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="2.2" fill="${STROKE_WHITE}" />`);
    }
  }

  parts.push(`<circle cx="${cx}" cy="${cy}" r="3.5" fill="${STROKE_WHITE}" />`);

  return parts.join("\n    ");
}

function buildCoverSvg(m: BookManifest): string {
  const author = String(m.author ?? "").trim() || "Unbekannt";
  const { title, subtitle } = resolveTitleAndSubtitle(m);

  const titleLines = wrapLines(title, 22, 4);
  const titleFirstY = MID_Y + 38;
  const lineHeight = 26;
  const titleEndY = titleFirstY + (titleLines.length - 1) * lineHeight + lineHeight;

  const authorDisplay = author.toUpperCase();

  const cx = W / 2;
  const cy = TOP_H * 0.48;

  const titleTspans = titleLines
    .map((ln, i) =>
      i === 0
        ? `<tspan x="${cx}" y="${titleFirstY}">${escapeXml(ln)}</tspan>`
        : `<tspan x="${cx}" dy="${lineHeight}">${escapeXml(ln)}</tspan>`
    )
    .join("");

  const subSepY = titleEndY + 12;
  const subLineHeight = 14;
  const subtitleLines = subtitle
    ? wrapLines(subtitle, 38, 6)
    : [];
  const subtitleTextY = subSepY + 16;
  const subtitleBlockEndY =
    subtitleLines.length > 0
      ? subtitleTextY + (subtitleLines.length - 1) * subLineHeight + subLineHeight
      : subSepY;

  const subtitleTspans =
    subtitleLines.length > 0
      ? subtitleLines
          .map((ln, i) =>
            i === 0
              ? `<tspan x="${cx}" y="${subtitleTextY}">${escapeXml(ln)}</tspan>`
              : `<tspan x="${cx}" dy="${subLineHeight}">${escapeXml(ln)}</tspan>`
          )
          .join("")
      : "";

  const subtitleBlock =
    subtitleLines.length > 0
      ? `
    <line x1="70" y1="${subSepY}" x2="${W - 70}" y2="${subSepY}" stroke="${SUBTITLE_MUTED}" stroke-width="0.6" />
    <text text-anchor="middle" fill="${SUBTITLE_MUTED}" font-family="Georgia, 'Times New Roman', serif" font-size="11.5">${subtitleTspans}</text>`
      : "";

  const diamondY =
    subtitleLines.length > 0 ? subtitleBlockEndY + 22 : titleEndY + 28;
  const diagram = buildDiagramSvg(cx, cy, title + "|" + author);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${TOP_H}" fill="${BG_DARK}" />
  <rect y="${TOP_H}" width="${W}" height="${MID_H}" fill="${BG_CREAM}" />
  <rect y="${H - BOT_H}" width="${W}" height="${BOT_H}" fill="${BG_DARK}" />

  <line x1="0" y1="${TOP_H}" x2="${W}" y2="${TOP_H}" stroke="#c4b8a8" stroke-width="1" />
  <line x1="0" y1="${TOP_H + 2}" x2="${W}" y2="${TOP_H + 2}" stroke="#c4b8a8" stroke-width="0.5" opacity="0.85" />

  ${diagram}

  <text text-anchor="middle" fill="${BG_DARK}" font-family="Georgia, 'Times New Roman', serif" font-size="21" font-weight="500">${titleTspans}</text>
  ${subtitleBlock}

  <path d="M ${cx} ${diamondY} l 7 7 l -7 7 l -7 -7 Z" fill="none" stroke="${BG_DARK}" stroke-width="1.1" />
  <path d="M ${cx} ${diamondY + 3} l 4 4 l -4 4 l -4 -4 Z" fill="${BG_DARK}" />

  <text x="${cx}" y="${H - BOT_H / 2 + 5}" text-anchor="middle" fill="#ffffff" font-family="Georgia, 'Times New Roman', serif" font-size="11.5" letter-spacing="0.12em">${escapeXml(authorDisplay)}</text>
</svg>
`;
}

async function main(): Promise<void> {
  const assistant = loadYaml<{
    "primary-books"?: string[];
    "secondary-books"?: string[];
  }>(ASSISTANT_MANIFEST);
  if (!assistant) {
    console.error("Assistenten-Manifest fehlt.");
    process.exit(1);
  }

  const ids = [
    ...(assistant["primary-books"] ?? []),
    ...(assistant["secondary-books"] ?? []),
  ];

  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const bookDirId of ids) {
    const manifestPath = path.join(REPO_ROOT, "books", bookDirId, "book-manifest.yaml");
    const m = loadYaml<BookManifest>(manifestPath);
    if (!m || !m["book-id"]) {
      console.warn(`Überspringe (kein Manifest/book-id): ${bookDirId}`);
      continue;
    }
    const svg = buildCoverSvg(m);
    const outPath = path.join(OUT_DIR, `${m["book-id"]}.svg`);
    fs.writeFileSync(outPath, svg, "utf8");
    console.log(`OK ${m["book-id"]}  (${m.title ?? bookDirId})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
