#!/usr/bin/env node
/**
 * Build script for ragkeep Agent Registry.
 * Reads assistant manifests, generates site/data/assistants.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SITE_DIR = path.join(REPO_ROOT, 'site');
const BOOKS_SOURCE = path.join(REPO_ROOT, 'books');
const ASSISTANTS_DIR = path.join(REPO_ROOT, 'assistants');
const ASSISTANTS_JSON = path.join(SITE_DIR, 'data', 'assistants.json');

interface AssistantManifest {
  name?: string;
  'rag-collection'?: string;
  description?: string;
  'writing-style'?: string;
  'primary-books'?: string[];
  'secondary-books'?: string[];
  concepts?: string[];
  essays?: string[];
  'cover-image'?: string;
  'avatar-image'?: string;
}

interface Agent {
  id: string;
  name: string;
  ragCollection: string;
  description: string;
  writingStyle: string;
  primaryBooks: string[];
  secondaryBooks: string[];
  concepts: string[];
  essays: string[];
  avatarUrl?: string;
  coverUrl?: string;
}

interface BookInfo {
  dirName: string;
  absBookDir: string;
  absHtmlDir: string;
  author: string;
  title: string;
}

function fileExists(p: string): boolean {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function findHtmlDirForBook(bookRootDir: string): string | null {
  const rootHtml = path.join(bookRootDir, 'html');
  const resultsHtml = path.join(bookRootDir, 'results', 'html');
  const rootIndex = path.join(rootHtml, 'index.html');
  const resultsIndex = path.join(resultsHtml, 'index.html');
  if (fileExists(rootIndex)) return rootHtml;
  if (fileExists(resultsIndex)) return resultsHtml;
  return null;
}

function readScalarFromManifest(absBookDir: string, key: string): string {
  const p = path.join(absBookDir, 'book-manifest.yaml');
  if (!fileExists(p)) return '';
  const content = fs.readFileSync(p, 'utf8');
  const lines = content.split('\n');
  const re = new RegExp(`^${key}:\\s*(.*)\\s*$`);
  for (const line of lines) {
    const m = line.match(re);
    if (!m) continue;
    let v = (m[1] ?? '').trim();
    if (!v) return '';
    if (v.startsWith('"')) {
      v = v.slice(1);
      const lineIdx = lines.indexOf(line);
      for (let i = lineIdx + 1; i < lines.length; i++) {
        const endIdx = v.indexOf('"');
        if (endIdx !== -1) {
          v = v.slice(0, endIdx);
          break;
        }
        v += ' ' + (lines[i] ?? '').trim();
      }
    }
    return v.replace(/\s+/g, ' ').trim();
  }
  return '';
}

function parseAuthorAndTitle(dirName: string): { author: string; title: string } {
  const parts = dirName.split('#');
  const authorRaw = parts[0] ?? '';
  const titleRaw = parts[1] ?? dirName;
  const decode = (s: string) => s.replace(/_/g, ' ');
  return { author: decode(authorRaw), title: decode(titleRaw) };
}

function normalizeBookId(s: string): string {
  return String(s).replace(/\\#/g, '#').trim();
}

function loadAssistants(): Agent[] {
  const agents: Agent[] = [];
  if (!fileExists(ASSISTANTS_DIR)) return agents;

  const entries = fs.readdirSync(ASSISTANTS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(ASSISTANTS_DIR, entry.name, 'assistant-manifest.yaml');
    if (!fileExists(manifestPath)) continue;

    const raw = fs.readFileSync(manifestPath, 'utf8');
    const manifest = yaml.load(raw) as AssistantManifest | null;
    if (!manifest) continue;

    const id = entry.name;
    const ragCollection = manifest['rag-collection'] ?? id;
    const primaryBooks = (manifest['primary-books'] ?? []).map(normalizeBookId);
    const secondaryBooks = (manifest['secondary-books'] ?? []).map(normalizeBookId);

    const avatarPath = manifest['avatar-image'];
    const coverPath = manifest['cover-image'];

    agents.push({
      id,
      name: manifest.name ?? id,
      ragCollection,
      description: (manifest.description ?? '').replace(/\s+/g, ' ').trim(),
      writingStyle: (manifest['writing-style'] ?? '').replace(/\s+/g, ' ').trim(),
      primaryBooks,
      secondaryBooks,
      concepts: manifest.concepts ?? [],
      essays: manifest.essays ?? [],
      avatarUrl: avatarPath ? `assistants/${id}/${avatarPath}` : undefined,
      coverUrl: coverPath ? `assistants/${id}/${coverPath}` : undefined,
    });
  }
  return agents;
}

function collectReferencedBooks(agents: Agent[]): Set<string> {
  const bookIds = new Set<string>();
  for (const a of agents) {
    for (const b of a.primaryBooks) bookIds.add(b);
    for (const b of a.secondaryBooks) bookIds.add(b);
  }
  return bookIds;
}

function getBookInfo(dirName: string): BookInfo | null {
  const absBookDir = path.join(BOOKS_SOURCE, dirName);
  if (!fileExists(absBookDir)) return null;
  const absHtmlDir = findHtmlDirForBook(absBookDir);
  if (!absHtmlDir) return null;
  const parsed = parseAuthorAndTitle(dirName);
  const author = readScalarFromManifest(absBookDir, 'author') || parsed.author;
  const title = readScalarFromManifest(absBookDir, 'title') || parsed.title;
  return { dirName, absBookDir, absHtmlDir, author, title };
}

function main(): void {
  const agents = loadAssistants();
  const referencedBooks = collectReferencedBooks(agents);
  const existingBooks = new Set<string>();

  for (const bookId of referencedBooks) {
    const book = getBookInfo(bookId);
    if (book) existingBooks.add(bookId);
  }

  const filteredAgents = agents.map((a) => ({
    ...a,
    primaryBooks: a.primaryBooks.filter((b) => existingBooks.has(b)),
    secondaryBooks: a.secondaryBooks.filter((b) => existingBooks.has(b)),
  }));

  fs.mkdirSync(path.dirname(ASSISTANTS_JSON), { recursive: true });
  fs.writeFileSync(ASSISTANTS_JSON, JSON.stringify(filteredAgents, null, 2), 'utf8');
  console.log(`Wrote ${filteredAgents.length} assistant(s) to ${path.relative(REPO_ROOT, ASSISTANTS_JSON)}`);
}

main();
