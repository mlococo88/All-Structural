// Helpers for the engine tests (tests/engine/*.test.mjs). Node only, no npm.
//
// loadShared('moving-load.js', ...) evaluates classic scripts from shared/ in
// one fresh vm context, the way a page loads them with <script src>, and
// returns that context (its `window` is the context itself).
// Objects made inside the context have that context's prototypes, so compare
// them with plain()/JSON, not assert.deepStrictEqual against Node objects.
// test(name, fn) registers a test; run.mjs runs them all.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SHARED = path.join(ROOT, 'shared');

export function loadShared(...files) {
  const ctx = { console };
  ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  for (const f of files) {
    const p = path.isAbsolute(f) ? f : path.join(SHARED, f);
    vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: p });
    if (path.basename(p) === 'steps.js') recordSteps(ctx.SharedSteps);
  }
  return ctx;
}

// Every worked step any test makes (SharedSteps.step, work().add) is recorded here, so that tex.test.mjs (run last) can
// parse each step's TeX (sym, eq, sub, unit) with KaTeX. Recording only: the step objects and values are unchanged.
// Digits are folded to '0' (a number parses the same whatever its digits), which keeps the set small.
export const stepTex = new Map();   // folded TeX -> { tex, id, field }
function recordSteps(S) {
  if (!S || S.__recorded) return;
  const keep = s => { if (!s) return; for (const k of ['sym', 'eq', 'sub', 'unit']) { const t = s[k]; if (typeof t !== 'string' || !t) continue;
    const f = t.replace(/\d+/g, '0'); if (!stepTex.has(f)) stepTex.set(f, { tex: t, id: s.id, field: k }); } };
  const step0 = S.step, work0 = S.work;
  S.step = o => { const s = step0(o); keep(s); return s; };
  S.work = prefix => { const w = work0(prefix), add0 = w.add; w.add = o => { const v = add0(o); keep(w.steps[w.steps.length - 1]); return v; }; return w; };
  Object.defineProperty(S, '__recorded', { value: true });
}

// Deep copy into this realm; keeps -0, NaN and ±Infinity distinguishable.
export function plain(v) {
  if (typeof v === 'number') {
    if (Number.isNaN(v)) return 'NaN';
    if (!Number.isFinite(v)) return v > 0 ? 'Inf' : '-Inf';
    return Object.is(v, -0) ? '-0' : v;
  }
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = plain(v[k]); return o; }
  return v;
}

export const tests = [];
export function test(name, fn) { tests.push({ name, fn }); }
