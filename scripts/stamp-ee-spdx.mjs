#!/usr/bin/env node
/**
 * Post-build: restore the Enterprise-Edition commercial-license signal in the
 * published `dist/` artifacts.
 *
 * Every source file under `server/src/ee/` and `admin/src/ee/` carries a per-file
 * SPDX header, but `strapi-plugin build` (tsc + rollup) strips leading comments,
 * so the compiled output otherwise ships with NO commercial marker. The npm
 * tarball is the artifact most likely to be copied, so we re-stamp it here:
 *
 *   - `.d.ts` under any `.../ee/...` path  → pure EE → exact per-file SPDX header.
 *   - runtime `.js`/`.mjs` that contain EE code (the same sentinels
 *     check-ee-bundled.mjs greps for) → a MIXED MIT+EE bundle → a NOTICE banner
 *     that names BOTH licenses.
 *
 * Idempotent: files already carrying the marker are skipped, so re-running (or
 * running against a partially-stamped dist) is safe. Runs BEFORE
 * check-ee-bundled.mjs in `npm run build` so a stamp bug never masks a real
 * tree-shaking regression — the sentinels it relies on stay in the code untouched.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, extname, sep } from 'node:path';

const DIST = 'dist';
const MARKER = 'LicenseRef-FormFlow-EE';
const EE_SENTINELS = ['formflow-ee', '__EE_ADMIN__'];

const DTS_HEADER =
  '/* SPDX-License-Identifier: LicenseRef-FormFlow-EE — Commercial. See LICENSE-EE. Not covered by MIT. */\n';

const BUNDLE_BANNER =
  [
    '/*',
    ' * FormFlow distribution bundle — MIXED LICENSE.',
    ' * Contains BOTH MIT-licensed core code AND commercial Enterprise Edition (EE)',
    ' * code that originates under `ee/` directories.',
    ' *   EE code:   SPDX-License-Identifier: LicenseRef-FormFlow-EE — Commercial. See LICENSE-EE.',
    ' *   Core code: MIT. See LICENSE.',
    ' * Production use of EE (Pro/Business) features requires a valid FormFlow license key.',
    ' */',
    '',
  ].join('\n');

/** Recursively collect every file under `dir`. */
function walk(dir) {
  let out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out; // dir may not exist
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

let dtsCount = 0;
let bundleCount = 0;

for (const file of walk(DIST)) {
  const content = readFileSync(file, 'utf8');
  if (content.includes(MARKER)) continue; // already stamped — idempotent

  const underEe = file.split(sep).includes('ee');

  // 1) EE type declarations are pure EE → exact per-file SPDX header.
  if (file.endsWith('.d.ts') && underEe) {
    writeFileSync(file, DTS_HEADER + content);
    dtsCount++;
    continue;
  }

  // 2) Runtime bundles that actually contain EE code → mixed-license banner.
  const ext = extname(file);
  if ((ext === '.js' || ext === '.mjs') && EE_SENTINELS.some((s) => content.includes(s))) {
    writeFileSync(file, BUNDLE_BANNER + content);
    bundleCount++;
  }
}

console.log(
  `OK: stamped EE license signal into dist — ${dtsCount} .d.ts header(s), ${bundleCount} runtime bundle banner(s).`
);
if (dtsCount === 0 && bundleCount === 0) {
  console.log('   (nothing to stamp — already stamped on a prior run, or no EE artifacts present)');
}
