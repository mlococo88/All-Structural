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
  }
  return ctx;
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
