#!/usr/bin/env node
// Engine test runner: imports every tests/engine/*.test.mjs (or the files whose
// names contain an argument), runs the tests they register, exits 1 on failure.
//   node tests/engine/run.mjs
//   node tests/engine/run.mjs moving-load
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { tests } from './harness.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const filt = process.argv.slice(2);
const files = fs.readdirSync(dir).filter(f => f.endsWith('.test.mjs'))
  .filter(f => !filt.length || filt.some(x => f.includes(x))).sort();
let pass = 0, fail = 0;
for (const f of files) {
  const start = tests.length;
  await import(pathToFileURL(path.join(dir, f)).href);
  for (const t of tests.slice(start)) {
    try { await t.fn(); pass++; console.log(`  ok   ${f} :: ${t.name}`); }
    catch (e) {
      fail++;
      console.log(`  FAIL ${f} :: ${t.name}\n       ${String((e && e.stack) || e).split('\n').slice(0, 8).join('\n       ')}`);
    }
  }
}
console.log(`\n${files.length} file(s), ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
