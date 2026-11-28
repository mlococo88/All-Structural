// apps/ps-bridge 2026-11-28 (PSAD-D, the engineer's choice of 2026-11-28, item 8): Auto design's uniformity options (engine/autodesign.js
// settings.uniform 'none' | 'types' | 'bridge'; evalCand's ctx.group, transfer, summary, cost).
//   1. absent = 'none': the run equals the run with 'none' entered;
//   2. 'types' (the new project, two types): every type of the span takes one design; after Apply every check of every line passes; it has
//      at least the strands of each type's own design; the cost against 'none' is the difference of the two runs' first candidates;
//   3. 'bridge' (two spans, four types): one section and one strand pattern for every type of every span; every check passes after Apply;
//   4. not with Refine (the reason given).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', ...PBDF, ...['sections', 'model', 'rigid', 'lldf-fg', 'reltension', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'autodesign'].map(n => path.join(APP, `engine/${n}.js`)),
  path.join(APP, 'ui/vizkit.js'), path.join(APP, 'ui/strands.js'));
const M = W.PSBModel, B = W.PSBBridge, AD = W.PSBAutoDesign, J = v => JSON.parse(JSON.stringify(v));
const load = P => M.importJSON(M.exportJSON(P)).project;
const strip = R => J(R.spans.map(sp => sp.sections.map(e => ({ name: e.name, pass: e.pass, types: e.types.map(q => ({ why: q.res.why, best: q.res.best ? { N: q.res.best.N, nh: q.res.best.nh, rows: q.res.best.rows, harp: q.res.best.harp, fc: q.res.best.fc, fci: q.res.best.fci, gov: q.res.best.ev.gov } : null })) }))));
const FAST = { vars: { section: 'lock', conc: 'lock' } };
const design = b => JSON.stringify([b.girder, b.rows, b.harp, b.fc, b.fci]);
const allPass = Q => B.results(Q, inp => W.PSBHoldDown.compute(J(inp))).cells.forEach(z => { assert.ok(!z.R.error); z.R.checks.forEach(q => assert.ok(q.pass, `${z.label} G${z.g}: ${q.n} ${q.r}`)); });
const run = (P, set) => { P.autodesign = J(set); return AD.runSync(P, Object.assign(AD.settings(P), { fracs: [0.40, 0.44] })); };

test('Auto design, uniformity: absent = none; the run equals the run with none entered', () => {
  const P = load(M.newProject()); assert.equal(AD.settings(P).uniform, 'none');
  const a = run(P, FAST), b = run(P, Object.assign({ uniform: 'none' }, FAST)); assert.equal(JSON.stringify(strip(a)), JSON.stringify(strip(b))); assert.equal(a.cost, undefined);
});

test('Auto design, uniformity "types" (new project): one design for the interior and exterior types; every check passes; the cost against none', () => {
  const P = load(M.newProject()), R0 = run(J(P), FAST), R = run(P, Object.assign({ uniform: 'types' }, FAST)), c = R.spans[0].cands[0], c0 = R0.spans[0].cands[0];
  assert.ok(c && c0, 'candidates'); assert.equal(R.uni.mode, 'types');
  const ds = c.types.map(q => design(q.res.best)); assert.equal(new Set(ds).size, 1, 'one design');
  c0.types.forEach(q => assert.ok(c.types[0].res.best.N >= q.res.best.N, `at least the strands of ${q.k}'s own design`));
  const Q = J(P); AD.apply(Q, R, {}); allPass(Q); const e = B.types(Q).map((T, k) => design(Object.assign({ girder: B.effBase(Q, k).girder, rows: B.effBase(Q, k).rows, harp: B.effBase(Q, k).harp, fc: B.effBase(Q, k).mat.fc, fci: B.effBase(Q, k).mat.fci })));
  assert.equal(new Set(e).size, 1, 'applied: one design');
  const st = cc => cc.types.reduce((a, q) => a + q.res.best.N * B.typeLines(P, q.k).length, 0), k = R.cost[1];
  assert.equal(k.dN, st(c) - st(c0)); assert.ok(Math.abs(k.dW - (c.W - c0.W)) < 1e-9);
  const g = c.types[0].res.best.ev.gov;
  console.log(`       (types: ${c.name} ${c.types[0].res.best.N} strands (${c.types[0].res.best.nh} draped) for ${c.types.map(q => B.types(P)[q.k].label).join(' and ')}; without: ${c0.types.map(q => q.res.best.N + '/' + q.res.best.nh).join(', ')}; cost ${k.dN} strands, ${k.dW.toFixed(1)} kip; governing ${g.n} ${g.r.toFixed(3)} G${g.g}; ${R.runs} runs, ${(R.ms / 1000).toFixed(1)} s)`);
});

test('Auto design, uniformity "bridge" (two spans, four types): one section and one strand pattern for the bridge; every check passes', () => {
  const P = load(M.newProject()); P.spans.lengths = [100, 120]; P.xs.skews = [0, 0, 0]; B.syncSpans(P);
  assert.ok(B.types(P).filter(T => T.span === 2).length >= 2, 'types in span 2');
  const R = run(P, Object.assign({ uniform: 'bridge' }, FAST)); assert.equal(R.uni.mode, 'bridge'); assert.equal(R.spans.length, 2);
  assert.ok(R.spans.every(sp => sp.cands.length), 'a candidate in each span');
  const ds = R.spans.flatMap(sp => sp.cands[0].types.map(q => JSON.stringify([q.res.best.girder, q.res.best.rows, q.res.best.harp.n, q.res.best.harp.yEnd, q.res.best.harp.yMid, q.res.best.fc, q.res.best.fci])));
  assert.equal(new Set(ds).size, 1, 'one section and pattern');
  const Q = J(P); AD.apply(Q, R, {}); allPass(Q);
  console.log(`       (bridge: ${R.spans[0].cands[0].name}, ${R.spans[0].cands[0].types[0].res.best.N} strands for ${R.spans.reduce((a, sp) => a + sp.types.length, 0)} types; cost ${Object.keys(R.cost).map(s => `span ${s}: ${R.cost[s].dN} strands, ${R.cost[s].dW != null ? R.cost[s].dW.toFixed(1) : '—'} kip`).join('; ')}; ${R.runs} runs)`);
});

test('Auto design, uniformity is not applied with Refine (the reason given)', () => {
  const P = load(M.newProject()); P.autodesign = { uniform: 'types', mode: 'refine', topN: 1 };
  const R = AD.runSync(P, Object.assign(AD.settings(P), { fracs: [0.44] })); assert.equal(R.uni.mode, 'none'); assert.ok(/Refine/.test(R.uni.why));
});
