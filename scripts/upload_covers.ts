#!/usr/bin/env node
// upload_covers.ts
// Uploads UUID-named covers from assets/covers/ to Supabase Storage bucket 'covers'.
// PNG files are uploaded directly; SVG files are converted to PNG via sharp first.
// If both {uuid}.png and {uuid}.svg exist, PNG takes priority.
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

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('upload_covers: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function ensureBucket(): Promise<void> {
  const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (error && !error.message.includes('already exists')) throw error;
}

/** Returns all UUID cover IDs found in the covers dir (PNG preferred over SVG). */
function allUuidCovers(): string[] {
  const files = readdirSync(COVERS_DIR);
  const ids = new Set<string>();
  for (const f of files) {
    if (f.endsWith('.png') || f.endsWith('.svg')) {
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
      if (name.endsWith('.png') || name.endsWith('.svg')) {
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
  const pngPath = join(COVERS_DIR, `${id}.png`);
  const svgPath = join(COVERS_DIR, `${id}.svg`);

  let pngBuffer: Buffer;
  let source: string;

  // PNG takes priority — upload directly without conversion
  try {
    pngBuffer = readFileSync(pngPath);
    source = 'png';
  } catch {
    // Fall back to SVG → convert to PNG
    const svgBuffer = readFileSync(svgPath);
    pngBuffer = await sharp(svgBuffer).png().toBuffer();
    source = 'svg→png';
  }

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(`${id}.png`, pngBuffer, { contentType: 'image/png', upsert: true });

  if (error) throw new Error(`${id}: ${error.message}`);
  console.log(`  ✓ ${id}.png  (${source})`);
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

  await ensureBucket();
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
