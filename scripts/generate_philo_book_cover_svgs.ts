#!/usr/bin/env node
/**
 * Generiert SVG-Buchcover (Stil: weißer Textblock oben, Vollbild unten).
 *
 * Parameter: image, title, subtitle, year, author
 *
 * Einzelcover:
 *   npx tsx scripts/generate_philo_book_cover_svgs.ts \
 *     --title "Die Rätsel der Philosophie" \
 *     --subtitle "in ihrer Geschichte als Umriss dargestellt" \
 *     --year 1918 \
 *     --author "Rudolf Steiner" \
 *     --image books/.../cover.jpg \
 *     --output assets/covers/{book-id}.svg
 *
 * Batch (philo-von-freisinn primary/secondary-books):
 *   npx tsx scripts/generate_philo_book_cover_svgs.ts --batch --image-dir assets/cover-images
 *
 * Bildauflösung für iPad (Retina):
 *   Cover 2048×3072 px (2:3) → Bildbereich ~65 % Höhe → mindestens 2048×1300 px.
 *   Für kleinere Vorschau reicht 1200×780 px (Default-Canvas 1200×1800).
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
const DEFAULT_OUT_DIR = path.join(REPO_ROOT, "assets/covers");

/** 2:3 — scharf auf iPad; upload_covers konvertiert SVG→PNG in dieser Größe. */
const W = 1200;
const H = 1800;
const TOP_RATIO = 0.42;
const TOP_H = Math.round(H * TOP_RATIO);
const IMAGE_H = H - TOP_H;

const MARGIN_X = 48;
const MARGIN_TOP = 80;
/** Abstand Autor/Jahr zum Bild — unverändert zum ursprünglichen Layout. */
const META_OFFSET_FROM_IMAGE = 56;

const BG_WHITE = "#ffffff";
const TEXT_DARK = "#2a2a2a";
const TEXT_MUTED = "#8a8a8a";
const TEXT_LIGHT = "#b0b0b0";

const FONT =
  "system-ui, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif";

/** Empfohlene Mindestgröße für das Cover-Foto (Breite × Höhe). */
export const RECOMMENDED_IMAGE_SIZE = {
  /** Für iPad Retina (12,9″ Pro, volle Cover-Höhe). */
  retina: { width: 2048, height: 1300 },
  /** Für Default-Canvas 1200×1800. */
  standard: { width: 1200, height: 780 },
} as const;

export interface CoverParams {
  image: string;
  title: string;
  subtitle?: string;
  year?: string | number;
  author: string;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeWs(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

/** Zeilenumbruch für linksbündigen Titel. */
function wrapLines(text: string, maxChars: number, maxLines: number): string[] {
  const t = normalizeWs(text);
  if (!t) return [];
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
  if (lines.length === 0) lines.push(t.slice(0, maxChars));
  return lines;
}

function imageToDataUri(imagePath: string): string {
  const abs = path.resolve(imagePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Bild nicht gefunden: ${abs}`);
  }
  const ext = path.extname(abs).slice(1).toLowerCase();
  const mime =
    ext === "jpg" || ext === "jpeg"
      ? "jpeg"
      : ext === "webp"
        ? "webp"
        : ext === "svg"
          ? "svg+xml"
          : "png";
  const b64 = fs.readFileSync(abs).toString("base64");
  return `data:image/${mime};base64,${b64}`;
}

function leftAlignedTspans(
  lines: string[],
  x: number,
  firstY: number,
  lineHeight: number
): string {
  return lines
    .map((ln, i) =>
      i === 0
        ? `<tspan x="${x}" y="${firstY}">${escapeXml(ln)}</tspan>`
        : `<tspan x="${x}" dy="${lineHeight}">${escapeXml(ln)}</tspan>`
    )
    .join("");
}

/** Baut das Cover-SVG aus den übergebenen Parametern. */
export function buildCoverSvg(params: CoverParams): string {
  const title = normalizeWs(params.title) || "Ohne Titel";
  const subtitle = normalizeWs(params.subtitle ?? "");
  const author = normalizeWs(params.author) || "Unbekannt";
  const year = params.year != null && String(params.year).trim() ? String(params.year).trim() : "";
  const imageHref = imageToDataUri(params.image);

  const titleLines = wrapLines(title, 22, 8);
  const titleFontSize =
    titleLines.length === 1 ? 96 : titleLines.length === 2 ? 88 : 78;
  const titleLineHeight = titleFontSize * 1.08;
  const titleFirstY = MARGIN_TOP + titleFontSize;

  const subtitleLines = subtitle ? wrapLines(subtitle, 30, 4) : [];
  const subtitleFontSize = 40;
  const subtitleLineHeight = subtitleFontSize * 1.22;
  const subtitleFirstY =
    titleFirstY + (titleLines.length - 1) * titleLineHeight + titleLineHeight + 24;

  const metaY = TOP_H - META_OFFSET_FROM_IMAGE;
  const authorX = W - MARGIN_X;

  const titleBlock =
    titleLines.length > 0
      ? `<text fill="${TEXT_DARK}" font-family="${FONT}" font-size="${titleFontSize}" font-weight="600" letter-spacing="-0.02em">${leftAlignedTspans(titleLines, MARGIN_X, titleFirstY, titleLineHeight)}</text>`
      : "";

  const subtitleBlock =
    subtitleLines.length > 0
      ? `<text fill="${TEXT_MUTED}" font-family="${FONT}" font-size="${subtitleFontSize}" font-weight="400">${leftAlignedTspans(subtitleLines, MARGIN_X, subtitleFirstY, subtitleLineHeight)}</text>`
      : "";

  const yearBlock = year
    ? `<text x="${MARGIN_X}" y="${metaY}" fill="${TEXT_LIGHT}" font-family="${FONT}" font-size="24" font-weight="400">${escapeXml(year)}</text>`
    : "";

  const authorBlock = `<text x="${authorX}" y="${metaY}" text-anchor="end" fill="${TEXT_MUTED}" font-family="${FONT}" font-size="26" font-weight="400">${escapeXml(author)}</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${TOP_H}" fill="${BG_WHITE}" />
  ${titleBlock}
  ${subtitleBlock}
  ${yearBlock}
  ${authorBlock}
  <image x="0" y="${TOP_H}" width="${W}" height="${IMAGE_H}" href="${imageHref}" preserveAspectRatio="xMidYMid slice" />
</svg>
`;
}

interface BookManifest {
  author?: string;
  title?: string;
  subtitle?: string;
  year?: string | number;
  "book-id"?: string;
  "cover-image"?: string;
}

function loadYaml<T>(p: string): T | null {
  if (!fs.existsSync(p)) return null;
  try {
    return yaml.load(fs.readFileSync(p, "utf8")) as T;
  } catch {
    return null;
  }
}

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

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function resolveImagePath(
  bookDirId: string,
  m: BookManifest,
  imageDir?: string,
  defaultImage?: string
): string | null {
  if (m["cover-image"]) {
    const p = path.isAbsolute(m["cover-image"])
      ? m["cover-image"]
      : path.join(REPO_ROOT, "books", bookDirId, m["cover-image"]);
    if (fs.existsSync(p)) return p;
  }
  if (imageDir && m["book-id"]) {
    for (const ext of ["jpg", "jpeg", "png", "webp"]) {
      const p = path.join(imageDir, `${m["book-id"]}.${ext}`);
      if (fs.existsSync(p)) return p;
    }
  }
  if (defaultImage && fs.existsSync(defaultImage)) return defaultImage;
  return null;
}

async function runBatch(imageDir?: string, defaultImage?: string): Promise<void> {
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

  fs.mkdirSync(DEFAULT_OUT_DIR, { recursive: true });

  for (const bookDirId of ids) {
    const manifestPath = path.join(REPO_ROOT, "books", bookDirId, "book-manifest.yaml");
    const m = loadYaml<BookManifest>(manifestPath);
    if (!m || !m["book-id"]) {
      console.warn(`Überspringe (kein Manifest/book-id): ${bookDirId}`);
      continue;
    }

    const imagePath = resolveImagePath(bookDirId, m, imageDir, defaultImage);
    if (!imagePath) {
      console.warn(`Überspringe (kein Bild): ${bookDirId}`);
      continue;
    }

    const { title, subtitle } = resolveTitleAndSubtitle(m);
    const svg = buildCoverSvg({
      image: imagePath,
      title,
      subtitle,
      year: m.year,
      author: String(m.author ?? "").trim() || "Unbekannt",
    });
    const outPath = path.join(DEFAULT_OUT_DIR, `${m["book-id"]}.svg`);
    fs.writeFileSync(outPath, svg, "utf8");
    console.log(`OK ${m["book-id"]}  (${title})`);
  }
}

async function runSingle(args: Record<string, string | boolean>): Promise<void> {
  const title = String(args.title ?? "");
  const author = String(args.author ?? "");
  const image = String(args.image ?? "");
  const output = String(args.output ?? "");

  if (!title || !author || !image || !output) {
    console.error(
      "Einzelmodus: --title, --author, --image und --output sind Pflicht.\n" +
        "Optional: --subtitle, --year"
    );
    process.exit(1);
  }

  const svg = buildCoverSvg({
    image,
    title,
    subtitle: args.subtitle ? String(args.subtitle) : undefined,
    year: args.year ? String(args.year) : undefined,
    author,
  });

  const outPath = path.isAbsolute(output) ? output : path.join(REPO_ROOT, output);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, svg, "utf8");
  console.log(`OK ${outPath}`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.batch) {
    const imageDir = args["image-dir"]
      ? path.isAbsolute(String(args["image-dir"]))
        ? String(args["image-dir"])
        : path.join(REPO_ROOT, String(args["image-dir"]))
      : undefined;
    const defaultImage = args["default-image"]
      ? path.isAbsolute(String(args["default-image"]))
        ? String(args["default-image"])
        : path.join(REPO_ROOT, String(args["default-image"]))
      : undefined;
    await runBatch(imageDir, defaultImage);
    return;
  }

  if (args.title || args.image || args.output) {
    await runSingle(args);
    return;
  }

  // Kein Modus angegeben → Batch mit Hinweis
  console.log(
    "Cover-Generator\n" +
      "  Einzelcover: --title --author --image --output [--subtitle] [--year]\n" +
      "  Batch:       --batch [--image-dir assets/cover-images] [--default-image path]\n" +
      `\nEmpfohlene Bildgröße (Retina-iPad): ${RECOMMENDED_IMAGE_SIZE.retina.width}×${RECOMMENDED_IMAGE_SIZE.retina.height} px`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
