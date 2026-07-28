#!/usr/bin/env node
// upload_covers.ts
// Uploads UUID-named covers from assets/covers/ to Supabase Storage bucket 'covers'.
// JPG files are uploaded directly; SVG files are converted to JPG via sharp first.
// If both {uuid}.jpg and {uuid}.svg exist, JPG takes priority.
// Called from the pre-push hook with: upload_covers.ts <local_sha> <remote_sha>
// With --all flag: uploads all covers regardless of git diff.

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { readFileSync, readdirSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const COVERS_DIR = join(REPO_ROOT, 'assets', 'covers');
const BUCKET = 'covers';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const NULL_SHA = '0000000000000000000000000000000000000000';

// Support multiple targets: comma-separated URLs and keys
// SUPABASE_UPLOAD_URLS=url1,url2  SUPABASE_UPLOAD_KEYS=key1,key2
// Falls back to single EXPO_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
function resolveTargets(): Array<{ url: string; key: string }> {
  const urls = process.env.SUPABASE_UPLOAD_URLS?.split(',').map(s => s.trim()).filter(Boolean);
  const keys = process.env.SUPABASE_UPLOAD_KEYS?.split(',').map(s => s.trim()).filter(Boolean);
  if (urls?.length && keys?.length && urls.length === keys.length) {
    return urls.map((url, i) => ({ url, key: keys[i] }));
  }
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('upload_covers: set SUPABASE_UPLOAD_URLS+KEYS or EXPO_PUBLIC_SUPABASE_URL+SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  return [{ url, key }];
}

const TARGETS = resolveTargets();

async function ensureBucket(url: string, key: string): Promise<void> {
  const sb = createClient(url, key);
  const { error } = await sb.storage.createBucket(BUCKET, { public: true });
  if (error && !error.message.includes('already exists')) throw error;
}

/** Returns all UUID cover IDs found in the covers dir (PNG preferred over SVG). */
function allUuidCovers(): string[] {
  const files = readdirSync(COVERS_DIR);
  const ids = new Set<string>();
  for (const f of files) {
    if (f.endsWith('.jpg') || f.endsWith('.svg')) {
      const id = f.slice(0, -4);
      if (UUID_RE.test(id)) ids.add(id);
    }
  }
  return [...ids];
}

function changedCoversBetween(remoteSha: string, localSha: string): string[] {
  try {
    const out = execSync(`git diff --name-only ${remoteSha} ${localSha} -- assets/covers/`, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    const ids = new Set<string>();
    for (const f of out.split('\n')) {
      const name = basename(f);
      if (name.endsWith('.jpg') || name.endsWith('.svg')) {
        const id = name.slice(0, -4);
        if (UUID_RE.test(id)) ids.add(id);
      }
    }
    return [...ids];
  } catch {
    return [];
  }
}

async function uploadCover(id: string): Promise<void> {
  const jpgPath = join(COVERS_DIR, `${id}.jpg`);
  const svgPath = join(COVERS_DIR, `${id}.svg`);

  let jpgBuffer: Buffer;
  let source: string;

  // SVG takes priority — always convert for correct cover layout (title + image)
  try {
    const svgBuffer = readFileSync(svgPath);
    jpgBuffer = await sharp(svgBuffer).jpeg({ quality: 90 }).toBuffer();
    source = 'svg→jpg';
  } catch {
    // Fall back to JPG if no SVG exists
    jpgBuffer = readFileSync(jpgPath);
    source = 'jpg';
  }

  for (const { url, key } of TARGETS) {
    const sb = createClient(url, key);
    const { error } = await sb.storage
      .from(BUCKET)
      .upload(`${id}.jpg`, jpgBuffer, { contentType: 'image/jpeg', upsert: true });
    if (error) throw new Error(`${id} @ ${url}: ${error.message}`);
  }
  console.log(`  ✓ ${id}.jpg  (${source}, ${TARGETS.length} target(s))`);
}

async function main() {
  const forceAll = process.argv.includes('--all');
  const localSha = process.argv[2];
  const remoteSha = process.argv[3];

  const toUpload =
    forceAll || !localSha || !remoteSha || remoteSha === NULL_SHA
      ? allUuidCovers()
      : changedCoversBetween(remoteSha, localSha);

  if (toUpload.length === 0) {
    console.log('upload_covers: no cover changes, skipping.');
    return;
  }

  for (const { url, key } of TARGETS) await ensureBucket(url, key);
  console.log(`upload_covers: uploading ${toUpload.length} cover(s) to Supabase Storage...`);
  for (const id of toUpload) {
    await uploadCover(id);
  }
  console.log('upload_covers: done.');
}

main().catch((e) => {
  console.error('upload_covers failed:', e.message ?? e);
  process.exit(1);
});
