#!/usr/bin/env node
/**
 * Post-build guard: verify that EE runtime code was NOT tree-shaken out.
 *
 * Scans only .js/.mjs runtime files — deliberately excludes .d.ts type
 * declarations, which always contain the sentinel names even when the runtime
 * code has been DCE'd.
 *
 * Server: sentinel is expected in dist/server/index.{js,mjs} (entry bundle).
 * Admin:  sentinel is expected in dist/admin/index.{js,mjs} OR any
 *         dist/_chunks/*.{js,mjs} (lazy-loaded admin chunks).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

/** Walk a directory and return all files with a .js or .mjs extension. */
function runtimeFiles(dir) {
  const files = [];
  let entries;
  try {
    entries = readdirSync(dir, { recursive: true });
  } catch {
    return files; // directory may not exist
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isFile()) {
      const ext = extname(full);
      if (ext === '.js' || ext === '.mjs') {
        files.push(full);
      }
    }
  }
  return files;
}

/** Returns true if any file in the given list contains the needle string. */
function grepFiles(files, needle) {
  for (const file of files) {
    if (readFileSync(file, 'utf8').includes(needle)) return true;
  }
  return false;
}

// --- Server: scan dist/server runtime files ---
const serverFiles = runtimeFiles('dist/server');
const serverOk = grepFiles(serverFiles, 'formflow-ee');

// --- Admin: scan dist/admin entry + dist/_chunks (lazy-loaded EE code) ---
const adminFiles = [
  ...runtimeFiles('dist/admin'),
  ...runtimeFiles('dist/_chunks'),
];
const adminOk = grepFiles(adminFiles, '__EE_ADMIN__');

if (!serverOk) {
  console.error('FAIL: sentinel "formflow-ee" not found in dist/server runtime .js/.mjs files — server/src/ee/ was tree-shaken out of the build.');
  console.error('      Check that server/src/index.ts contains `import \'./ee\';` and server/src/ee/index.ts exports EE_SENTINEL with value "formflow-ee".');
  console.error(`      Scanned ${serverFiles.length} file(s): ${serverFiles.map(f => f.replace('dist/', 'dist/')).join(', ')}`);
}
if (!adminOk) {
  console.error('FAIL: sentinel "__EE_ADMIN__" not found in dist/admin or dist/_chunks runtime .js/.mjs files — admin/src/ee/ was tree-shaken out of the build.');
  console.error('      Check that admin/src/index.ts contains `import \'./ee\';`, admin/src/ee/index.ts exports __EE_ADMIN__ as a string,');
  console.error('      and admin/src/ee/context/LicenseContext.ts has the DCE-guard: LicenseContext.displayName = \'__EE_ADMIN__\'.');
  console.error(`      Scanned ${adminFiles.length} file(s) across dist/admin and dist/_chunks.`);
}

if (serverOk && adminOk) {
  console.log(`OK: EE sentinels found in runtime .js/.mjs files — ee/ modules are bundled correctly.`);
  console.log(`    Server: "formflow-ee" present in dist/server runtime output.`);
  console.log(`    Admin:  "__EE_ADMIN__" present in dist/admin or dist/_chunks runtime output.`);
  process.exit(0);
} else {
  process.exit(1);
}
