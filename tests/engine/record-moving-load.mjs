#!/usr/bin/env node
// Records EXPECTED in moving-load.test.mjs from the ORIGINAL inline functions of Moving Load Generator.html
// (at ORIGINAL_REF), never from the shared engine. Run only to add cases:  node tests/engine/record-moving-load.mjs
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CASES, runCase, canon, sha, keyValues, originalEngine } from './moving-load.test.mjs';

const O = originalEngine(), exp = {};
for (const c of CASES) {
  const t0 = Date.now(), out = runCase(O, c);
  exp[c[0]] = { sha256: sha(canon(out)), key: keyValues(out) };
  console.log(`${c[0]}  (${Date.now() - t0} ms)`, JSON.stringify(exp[c[0]].key));
}
const f = fileURLToPath(new URL('./moving-load.test.mjs', import.meta.url));
const s = fs.readFileSync(f, 'utf8');
const body = 'export const EXPECTED = ' + JSON.stringify(exp, null, 1) + ';';
fs.writeFileSync(f, s.replace(/\/\/ BEGIN EXPECTED\n[\s\S]*?\/\/ END EXPECTED/, `// BEGIN EXPECTED\n${body}\n// END EXPECTED`));
console.log(`recorded ${CASES.length} cases`);
