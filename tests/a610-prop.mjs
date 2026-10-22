#!/usr/bin/env node
// A610 property test (dev tooling only). Steel Bridge Design keeps one copy of AASHTO LRFD Art. 6.10 expressions that were written out
// identically in several places (the A610 functions in its SBD-SHARED block, used by the modules and by Preliminary sizing). This test takes
// the A610 functions from the tool file and checks, on 10,000 random inputs per function plus the edge cases, that each returns exactly
// (Object.is, bit for bit) what the expression it replaced returned, copied below verbatim from the code before the change (main at cb584ac).
// It also checks that the SBD-SHARED block is well formed and that the Preliminary sizing page holds its placeholder exactly once.
// Usage: node tests/a610-prop.mjs [--file "Steel Bridge Design.html"] [--n 10000]   Exit code 0 when every check passes.
import fs from 'fs';
import path from 'path';
import { REPO } from './lib.mjs';

const av = process.argv.slice(2), arg = k => { const i = av.indexOf(k); return i >= 0 ? av[i + 1] : null; };
const FILE = path.resolve(REPO, arg('--file') || 'Steel Bridge Design.html'), N = +(arg('--n') || 10000);
const html = fs.readFileSync(FILE, 'utf8');
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };

// the shared block, as sbdShared() cuts it
const B = 'SBD-SHARED-BEGIN', E = '/* SBD-SHARED-END */';
const iB = html.indexOf(B), iE = html.indexOf(E);
ok(iB > 0 && iE > iB && html.indexOf(B, iB + 1) < 0, 'one SBD-SHARED block');
const blk = html.slice(html.lastIndexOf('/* ====', iB), iE + E.length);
const pl = html.slice(html.indexOf('<script type="text/plain" id="pl-src">'), html.indexOf('<script type="text/plain" id="st-src">'));
ok((pl.match(/^\/\* @@SBD-SHARED@@ .*\*\/$/mg) || []).length === 1, 'Preliminary sizing page: one placeholder line');
ok(!/function A610_|function feSolve|function sgBeam/.test(pl), 'Preliminary sizing page: no copy of its own (the shared block only)');

// the A610 functions from the block (evaluated alone: they use nothing else)
const A = new Function(blk.slice(0, blk.indexOf('/* Shared analysis engine')) + '\nreturn A610;')();
// the expressions as they were written before (main at cb584ac), verbatim
const REF = {
  shearC: (lam, r, E, k, FyW) => lam <= 1.12 * r ? 1 : lam <= 1.40 * r ? 1.12 * r / lam : 1.57 / lam ** 2 * (E * k / FyW),
  Vp: (Fyw, D, tw) => 0.58 * Fyw * D * tw };

// random inputs in the ranges the tools use, plus edges
let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = (a, b) => a + (b - a) * rnd();
function shearCase() { const D = pick(12, 144), tw = pick(0.25, 1.5), E = rnd() < 0.5 ? 29000 : pick(28000, 30000), Fy = [36, 50, 70, 100][Math.floor(rnd() * 4)] + (rnd() < 0.2 ? pick(-5, 5) : 0);
  const d0 = rnd() < 0.3 ? 0 : pick(0.3, 4) * D, k = d0 > 0 && d0 <= 3 * D ? 5 + 5 / (d0 / D) ** 2 : 5, lam = D / tw, r = Math.sqrt(E * k / Fy); return [lam, r, E, k, Fy]; }
const edges = [[0, 0, 29000, 5, 50], [1.12 * 60, 60, 29000, 5, 50], [1.40 * 60, 60, 29000, 5, 50], [1e6, 1, 29000, 5, 50], [NaN, 1, 29000, 5, 50], [100, Infinity, 29000, 5, 50]];
for (const [name, gen, n] of [['shearC', shearCase, 5], ['Vp', () => [pick(30, 110), pick(12, 144), pick(0.25, 1.5)], 3]]) {
  let m = 0, first = null; const cases = [...Array(N)].map(gen).concat(name === 'shearC' ? edges : [[0, 0, 0], [50, 66, 0.5], [NaN, 1, 1]]);
  for (const c of cases) { const a = A[name](...c), b = REF[name](...c); if (!Object.is(a, b)) { m++; first = first || [c, a, b]; } }
  ok(!m && typeof A[name] === 'function' && A[name].length === n, `A610.${name}: ${cases.length} inputs, bit-identical to the expression it replaced${m ? `; ${m} differ, e.g. ${JSON.stringify(first)}` : ''}`);
}
console.log(bad ? `\n${bad} check(s) failed` : '\nall checks pass');
process.exit(bad ? 1 : 0);
