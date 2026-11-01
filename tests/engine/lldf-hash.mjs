#!/usr/bin/env node
// Hash harness for the move of lldf.html's engine into shared/lldf.js (2026-10-29): runs the same input cases through
//   (a) the page's engine as it was before the move (lldf.html at a git revision, default the commit before the move), and
//   (b) shared/lldf.js + the page's code that stays in lldf.html (bridgeWarnings, the computeBridge wrapper, memberSteps),
// and compares SHA-256 hashes of every output: computeBridge (geometry, K_g, skew, every member, warnings), leverAll per girder,
// leverMulti, rigidMethod per side, memberSteps (the KaTeX steps of every girder), designL per region, input errors.
// JSON.stringify writes numbers round-trip exactly, so equal hashes mean bit-identical results.
//   node tests/engine/lldf-hash.mjs [rev]        (exits 1 on any difference)
// Also used by tests/engine/lldf.test.mjs (exported run()).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const BASE_REV = 'de72d9e';   // origin/main before the move (lldf.html with the engine inline)

const between = (src, a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); if (i < 0 || j < 0) throw new Error('marker not found: ' + a.slice(0, 40)); return src.slice(i, j); };
const START = '/* ---------- formatting helpers ---------- */', END = '/* ==================================================================\n   Presentation layer';
const nFromFc = html => between(html, 'function nFromFc(fcB,fcD){', 'function readInputs(){');
const presets = html => between(html, 'const SECTIONS={', 'function applySection(key){');

function context(html, shared) {
  const ctx = { console, Math, JSON }; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext('var state = { truckGaps: [4, 4, 4, 4] };', ctx);
  if (shared) vm.runInContext(fs.readFileSync(path.join(ROOT, 'shared/lldf.js'), 'utf8'), ctx, { filename: 'shared/lldf.js' });
  vm.runInContext('"use strict";\n' + between(html, START, END) + '\n' + nFromFc(html) + '\n' + presets(html) +
    '\nthis.__E = { computeBridge, leverAll, leverMulti, rigidMethod, memberSteps, designL, geometry, inputErrors, SECTIONS, boxJest, rectJ };', ctx, { filename: shared ? 'lldf.html (after)' : 'lldf.html (before)' });
  return ctx;
}

/* the input cases: p as readInputs() builds it (truckGaps also set in state for the page before the move) */
export function cases(SECTIONS, boxJest, rectJ) {
  const C = [], base = { type: 'a', beamShape: 'steel-i', spans: [120], region: 's0', ts: 8, depth: 54, skew: 0, skewV: null, fcGirder: null, fcDeck: null,
    OL: 3.5, OR: 3.5, rL: 1.5, rR: 1.5, spacings: [9.75, 9.75, 9.75, 9.75], I: 60000, A: 60, eg: 40, n: 8, boxB: 48, boxI: 170000, boxJ: 300000, truckGaps: [4, 4, 4, 4] };
  const add = (name, o) => { const p = { ...base, ...o }; p.Nb = p.spacings.length + 1; if (p.L == null) p.L = p.spans[0]; C.push({ name, p }); };
  // lldf.html DEFAULTS (type k, AASHTO IV)
  add('lldf.html defaults', { type: 'k', beamShape: 'aashto-i', spans: [120], ts: 8, depth: 54, skew: 0, OL: 4, OR: 4, rL: 1.5, rR: 1.5, I: 260730, A: 789, eg: 35.5, n: 1, spacings: [9.75, 9.75, 9.75, 9.75] });
  // FHWA steel girder example-like (5 girders 9.75 ft, overhang 3.25 ft, 8.5 in deck) and PSC example-like
  add('FHWA steel I-girder example (type a)', { type: 'a', spans: [140], L: 140, ts: 8.5, OL: 3.25, OR: 3.25, rL: 1.4167, rR: 1.4167, spacings: [9.75, 9.75, 9.75, 9.75], I: 66340, A: 63.5, eg: 49.4, n: 8 });
  add('FHWA PSC example (type k)', { type: 'k', beamShape: 'bulb-tee', spans: [110], ts: 7.5, OL: 3.5, OR: 3.5, rL: 1.75, rR: 1.75, spacings: [9.667, 9.667, 9.667, 9.667, 9.667], I: 545894, A: 767, eg: 39.4, n: 1.2, fcGirder: 6, fcDeck: 4 });
  // every catalog section (SECTIONS presets), as applySection fills them
  for (const [k, s] of Object.entries(SECTIONS)) {
    if (s.fam === 'steel') add(`preset ${k}`, { type: 'a', beamShape: s.shape, depth: s.d, I: s.I, A: s.A, eg: s.d / 2 + 4, n: 8 });
    else if (s.fam === 'conc') add(`preset ${k}`, { type: 'k', beamShape: s.shape, depth: s.d, I: s.I, A: s.A, eg: (s.d - s.yb) + 4, n: 1 });
    else if (s.fam === 'boxb') { add(`preset ${k} (f)`, { type: 'f', beamShape: s.shape, depth: s.d, boxB: s.b, boxI: s.I, boxJ: boxJest(s.b, s.d), spacings: Array(9).fill(s.b / 12), OL: 0, OR: 0, rL: 1.5, rR: 1.5, spans: [60] });
      add(`preset ${k} (bc)`, { type: 'bc', beamShape: s.shape, depth: s.d, spacings: [9, 9, 9, 9], spans: [90] }); }
    else add(`preset ${k}`, { type: 'g', beamShape: s.shape, depth: s.d, boxB: s.b, boxI: s.I, boxJ: rectJ(s.b, s.d), spacings: Array(7).fill(4), OL: 0, OR: 0, rL: 1.5, rR: 1.5, spans: [40] });
  }
  // a grid over the beam-slab path (girder count, spacing incl. > 16 ft and unequal bays, overhang / face, skew, shear skew, gaps, K_g)
  const types = ['a', 'e', 'k'], nbs = [3, 4, 5, 7], Ss = [4, 8, 9.5, 12, 16, 16.5, 20], ohs = [[1, 1.5], [3.25, 1.5], [5, 0.5], [3, 4.5]], sks = [[0, null], [15, null], [30, null], [45, 20], [65, null], [10, 50]];
  let k = 0;
  for (const t of types) for (const nb of nbs) for (const S of Ss) for (const [oh, r] of ohs) for (const [sk, sv] of sks) {
    k++; if (k % 3 && !(nb === 3 || S > 16)) continue;   // keep every N_b = 3 and S > 16 case, a third of the rest
    const sp = Array.from({ length: nb - 1 }, (_, i) => (k % 5 === 0 ? S + (i % 2 ? 1.5 : -1) : S));
    add(`grid ${t} Nb${nb} S${S} oh${oh}/${r} sk${sk}/${sv}`, { type: t, beamShape: t === 'a' ? 'steel-i' : 'aashto-i', spacings: sp, OL: oh, OR: oh + (k % 7 === 0 ? 1 : 0), rL: r, rR: r, skew: sk, skewV: sv,
      spans: [[40, 100, 200, 250][k % 4]], ts: [7, 8, 9.5, 13][k % 4], I: [20000, 60000, 260730, 900000][k % 4], A: [30, 60, 789, 1085][k % 4], eg: [30, 40, 35.5, 50][k % 4], n: t === 'a' ? 8 : 1,
      truckGaps: k % 4 === 0 ? [6, 4, 8, 5] : [4, 4, 4, 4] });
  }
  // roadways around the 20–24 ft two-half-lanes rule, and lane counts 1 … 6
  for (const w of [16, 19.9, 20, 22, 24, 24.1, 30, 36, 48, 60, 74]) { const nb = Math.max(3, Math.round(w / 9) + 1), S = (w + 3 - 2) / (nb - 1);
    add(`roadway ${w} ft`, { spacings: Array(nb - 1).fill(S), OL: 1, OR: 1, rL: 1.5, rR: 1.5 + (w + 3 - 2 + 2 - 3 - w) }); }
  // continuous spans: every design region (designL)
  for (const reg of ['s0', 'p0', 's1', 'p1', 's2']) add(`continuous 100/130/100 ${reg}`, { spans: [100, 130, 100], region: reg, L: undefined, skew: 20 });
  // other girder types with skew, d_e out of range, Nb
  for (const t of ['f', 'g', 'bc', 'd', 'slab']) for (const sk of [0, 25, 45, 70]) for (const [oh, r] of [[1, 1.5], [3, 0.5], [0, 2.5], [6, 0]]) for (const nb of [3, 5, 9])
    add(`${t} sk${sk} oh${oh}/${r} Nb${nb}`, { type: t, beamShape: t === 'f' || t === 'g' ? 'box' : 'box', depth: [27, 42, 60][nb % 3], spacings: Array(nb - 1).fill(t === 'f' || t === 'g' ? 4 : t === 'bc' ? [7, 12, 19][nb % 3] : 9), OL: oh, OR: oh, rL: r, rR: r, skew: sk, skewV: sk ? sk + 5 : null,
      boxB: [36, 48, 60][nb % 3], boxI: [50000, 170000, 400000][nb % 3], boxJ: [80000, 300000, 500000][nb % 3], spans: [[30, 80, 150][nb % 3]] });
  // concrete girder n check (bridgeWarnings nFromFc) and input errors
  add('concrete girder f\'c 8 / 4 ksi, n 1', { type: 'k', beamShape: 'aashto-i', fcGirder: 8, fcDeck: 4, n: 1, I: 260730, A: 789, eg: 35.5 });
  add('input error: span 0, t_s blank', { spans: [0], ts: 0 });
  add('input error: spacing negative', { spacings: [9, -1, 9] });
  add('input error: box I blank', { type: 'f', boxI: 0, spacings: Array(5).fill(4) });
  return C;
}

function runAll(ctx, C) {
  const E = ctx.__E, out = [];
  for (const c of C) {
    const p = JSON.parse(JSON.stringify(c.p)); if (c.p.skewV === null) p.skewV = null; if (c.p.L === undefined) { const d = E.designL(p.spans, p.region); p.L = d.L; p.Ltex = d.tex; p.Ldesc = d.desc; }
    ctx.state.truckGaps = p.truckGaps.slice();
    const o = { name: c.name };
    try {
      const R = E.computeBridge(p); o.R = R;
      o.lever = R.members.map(m => E.leverAll(p, R.geo, m.j)); o.multi = R.members.map(m => E.leverMulti(p, R.geo, m.j));
      o.rig = ['L', 'R'].map(s => E.rigidMethod(p, R.geo, s));
      o.steps = R.members.map(m => E.memberSteps(p, R.geo, R.Kg, R.skew, m));
    } catch (e) { o.err = String(e && e.message); o.inErr = E.inputErrors(p); }
    o.designL = ['s0', 'p0', 's1', 'p1'].map(r => E.designL(p.spans, r));
    out.push(o);
  }
  return out;
}
// Read-only outputs added to SharedLLDF after the move (for apps/steel-bridge's worked steps); not part of the page's results, so
// left out of the hash: rigidMethod's ecc (the lane eccentricities it already computed).
export const ADDED = ['ecc'];
// Calculation changes made on purpose after the move (engineer's decisions); those cases are expected to differ and are reported apart:
//   LLSW (2026-11-01): the CIP slab strip width (Art. 4.6.2.3) uses W = the physical edge-to-edge width, not the clear roadway width.
export const CHANGED = [/^slab /];
const hash = o => crypto.createHash('sha256').update(JSON.stringify(o, (k, v) => ADDED.includes(k) ? undefined : v)).digest('hex');

export function run(rev = BASE_REV) {
  const oldHtml = execFileSync('git', ['show', `${rev}:lldf.html`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
  const newHtml = fs.readFileSync(path.join(ROOT, 'lldf.html'), 'utf8');
  const A = context(oldHtml, false), B = context(newHtml, true);
  const C = cases(A.__E.SECTIONS, A.__E.boxJest, A.__E.rectJ);
  const ra = runAll(A, C), rb = runAll(B, C), diffs = [];
  let nOut = 0;
  const changed = [], keep = o => !CHANGED.some(re => re.test(o.name));
  ra.forEach((a, i) => { const b = rb[i]; for (const k of Object.keys(a)) { nOut++; if (hash(a[k]) !== hash(b[k])) (keep(a) ? diffs : changed).push(`${a.name}: ${k}`); } });
  return { cases: C.length, outputs: nOut, diffs, changed, changedCases: ra.filter(o => !keep(o)).length, hashBefore: hash(ra.filter(keep)), hashAfter: hash(rb.filter(keep)), errors: ra.filter(o => o.err).length,
    members: ra.reduce((s, o) => s + (o.R ? o.R.members.length : 0), 0), steps: ra.reduce((s, o) => s + (o.steps ? o.steps.reduce((t, x) => t + x.length, 0) : 0), 0) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = run(process.argv[2] || BASE_REV);
  console.log(`${r.cases} cases (${r.errors} input-error cases), ${r.members} girders, ${r.steps} worked steps, ${r.outputs} outputs hashed`);
  console.log(`${r.changedCases} cases changed on purpose (CHANGED), ${r.changed.length} of their outputs differ`);
  console.log(`before ${r.hashBefore}\nafter  ${r.hashAfter}\n${r.diffs.length} differ${r.diffs.length ? ':\n' + r.diffs.slice(0, 30).join('\n') : ''}`);
  process.exit(r.diffs.length ? 1 : 0);
}
