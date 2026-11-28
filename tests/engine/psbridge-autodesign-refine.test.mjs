// apps/ps-bridge 2026-11-28 (PSAD-A, the engineer's choice of 2026-11-28, items 4 and 7): Auto design's Refine mode and target ratio
// (engine/autodesign.js settings.mode, settings.maxRatio, refine()).
//   1. the settings: absent = mode 'new', target 1.00; a target of 1.00 entered gives the same run as none (the default changes nothing);
//   2. the target ratio: every candidate's every check that is not a RULE check has r ≤ target on every line; the RULE checks pass;
//   3. Refine on a design that passes (over-designed): the entered design is listed first, unchanged; the design with the fewest strands is
//      listed, passes, and at two strands fewer (the same draped strands and drape, the highest strengths) the pattern fails;
//   4. Refine on a design that fails (the new project: the PS-10 hold-down force): the first design keeps the entered strand count, is the
//      nearest by the distance order, and after Apply every check of every line passes;
//   5. distance(): the order |ΔN|, |Δn_h|, the drape change, |Δf′c|, |Δf′ci|.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', ...PBDF, ...['sections', 'model', 'rigid', 'lldf-fg', 'reltension', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'autodesign'].map(n => path.join(APP, `engine/${n}.js`)),
  path.join(APP, 'ui/vizkit.js'), path.join(APP, 'ui/strands.js'));
const M = W.PSBModel, B = W.PSBBridge, AD = W.PSBAutoDesign, J = v => JSON.parse(JSON.stringify(v));
const load = P => M.importJSON(M.exportJSON(P)).project;
const CASES = Object.entries(TAB_CASES(() => M.defaultProject()));
const TYPE4 = () => load(CASES.find(c => c[0].startsWith('AASHTO Type IV exterior'))[1]);
const strip = R => J(R.spans.map(sp => sp.sections.map(e => ({ name: e.name, pass: e.pass, types: e.types.map(q => ({ why: q.res.why, best: q.res.best ? { N: q.res.best.N, nh: q.res.best.nh, rows: q.res.best.rows, harp: q.res.best.harp, fc: q.res.best.fc, fci: q.res.best.fci, gov: q.res.best.ev.gov } : null })) }))));
const allPass = (Q, s) => B.results(Q, inp => W.PSBHoldDown.compute(J(inp))).cells.filter(z => z.s === s);

test('Auto design settings: absent = New design, target 1.00; 1.00 entered = none (the same run); bad values = the defaults', () => {
  const o = AD.settings({}); assert.equal(o.mode, 'new'); assert.equal(o.maxRatio, 1);
  assert.equal(AD.settings({ autodesign: { mode: 'x', maxRatio: 'a' } }).maxRatio, 1); assert.equal(AD.settings({ autodesign: { mode: 'x' } }).mode, 'new');
  assert.equal(AD.settings({ autodesign: { maxRatio: 1.5 } }).maxRatio, 1, 'a target above 1 is the engine pass'); assert.equal(AD.settings({ autodesign: { maxRatio: 0.9 } }).maxRatio, 0.9);
  const P = TYPE4(); P.autodesign = { vars: { section: 'lock', conc: 'lock' } };
  const a = AD.runSync(P, Object.assign(AD.settings(P), { fracs: [0.40, 0.45] }));
  P.autodesign.maxRatio = 1.0; P.autodesign.mode = 'new';
  const b = AD.runSync(P, Object.assign(AD.settings(P), { fracs: [0.40, 0.45] }));
  assert.equal(JSON.stringify(strip(a)), JSON.stringify(strip(b)));
});

test('Auto design, target ratio 0.90: every candidate has every demand / capacity ratio ≤ 0.90 on every line; the rules of fact pass', () => {
  const P = TYPE4(); P.autodesign = { vars: { section: 'lock', conc: 'lock' }, maxRatio: 0.9 };
  const o = Object.assign(AD.settings(P), { fracs: [0.40, 0.45] }), R = AD.runSync(P, o), R1 = AD.runSync(Object.assign(J(P), { autodesign: { vars: { section: 'lock', conc: 'lock' } } }), Object.assign(AD.settings({ autodesign: { vars: { section: 'lock', conc: 'lock' } } }), { fracs: [0.40, 0.45] }));
  const sp = R.spans[0]; assert.ok(sp.cands.length, 'a candidate at 0.90');
  const c = sp.cands[0], Q = J(P); AD.apply(Q, R, {});
  allPass(Q, 1).forEach(z => z.R.checks.forEach(q => { assert.ok(q.pass, `${q.n} passes`); if (!AD.RULE.test(q.n)) assert.ok(q.r <= 0.9 + 1e-4, `${z.label} G${z.g}: ${q.n} ${q.r}`); }));
  const b = c.types[0].res.best, b1 = R1.spans[0].cands[0].types[0].res.best;
  assert.ok(b.N >= b1.N, `the target needs at least the strands of 1.00 (${b.N} vs ${b1.N})`);
  assert.ok(b.ev.govT && b.ev.govT.r <= 0.9 + 1e-4 && !AD.RULE.test(b.ev.govT.n), 'govT: the governing check the target applies to');
  console.log(`       (target 0.90: N ${b.N} (${b.nh} draped), governing ${b.ev.govT.n} ${b.ev.govT.r.toFixed(3)} G${b.ev.govT.g}; at 1.00: N ${b1.N} (${b1.nh} draped), ${b1.ev.gov.n} ${b1.ev.gov.r.toFixed(3)})`);
});

test('Auto design, Refine, an over-designed design: the entered design first, unchanged; the fewest strands listed; two fewer fails', () => {
  const P = TYPE4(); P.autodesign = { mode: 'refine', vars: { conc: 'lock' } };
  const k = B.cells(P)[0].k, o = Object.assign(AD.settings(P), { fracs: [0.40, 0.45] });
  // an over-designed design: the new-design search's design at a target ratio of 0.85, refined at 1.00
  const s85 = { vars: { section: 'lock', conc: 'lock' }, maxRatio: 0.85 }, R0 = AD.runSync(Object.assign(J(P), { autodesign: s85 }), Object.assign(AD.settings({ autodesign: s85 }), { fracs: [0.40, 0.45] }));
  const s1 = { vars: { section: 'lock', conc: 'lock' } }, R1 = AD.runSync(Object.assign(J(P), { autodesign: s1 }), Object.assign(AD.settings({ autodesign: s1 }), { fracs: [0.40, 0.45] }));
  const b0 = R1.spans[0].cands[0].types[0].res.best, b85 = R0.spans[0].cands[0].types[0].res.best; AD.apply(P, R0, {}); const add = b85.N - b0.N;
  assert.ok(add > 0, `the design at 0.85 has more strands (${b85.N} vs ${b0.N})`);
  const ctx = { cache: new Map(), fit: new Map(), rows: new Map(), runs: 0, first: {}, stopped: false, o };
  const R = AD.runSync(P, o), sp = R.spans[0]; assert.ok(sp.cands.length >= 2, 'at least two designs');
  const first = sp.cands[0].types[0].res.best; assert.ok(first.entered, 'the entered design first'); assert.deepEqual(J(first.rows), J(B.effBase(P, k).rows)); assert.equal(first.N, b0.N + add);
  console.log(`       (over-designed: ${b85.N} strands, ${add} more than the new design at 1.00)`);
  const few = sp.cands[sp.cands.length - 1].types[0].res.best; assert.ok(few.fewest && few.N < first.N, `the fewest strands listed (${few.N})`);
  assert.ok(few.N <= b0.N, `refine reduces to the new-design count or fewer (${few.N} vs ${b0.N})`);
  const Q = J(P); AD.apply(Q, R, { 1: sp.cands.length - 1 }); allPass(Q, 1).forEach(z => z.R.checks.forEach(q => assert.ok(q.pass, `${z.label}: ${q.n}`)));
  const rw = AD.modRows(P, k, Object.assign(J(B.effBase(P, k)), { girder: few.girder }), few.rows, few.rows.reduce((a, r) => a + r.n, 0) - 2, ctx);
  if (rw) { const e2 = Object.assign(J(few.eff), { rows: rw }); assert.ok(!AD.evalCand(P, k, e2, ctx, true).pass, 'two strands fewer (same drape) fails'); }
  sp.cands.forEach((c, i) => { if (i) assert.ok(AD.cmpDist(sp.cands[i - 1].types[0].res.best.dist, c.types[0].res.best.dist) <= 0 || c.types[0].res.best.fewest, 'ranked by distance'); });
  console.log(`       (Refine, over-designed: entered N ${first.N}; listed ${sp.cands.map(c => c.types[0].res.best.N + '/' + c.types[0].res.best.nh).join(', ')}; ${R.runs} runs, ${(R.ms / 1000).toFixed(1)} s)`);
});

test('Auto design, Refine, the new project (fails the hold-down force): the entered strand count kept, the nearest design; after Apply every check passes', () => {
  const P = load(M.newProject()); P.autodesign = { mode: 'refine', topN: 2 };
  const R = AD.runSync(P, Object.assign(AD.settings(P), { fracs: [0.38, 0.40, 0.42, 0.44] })), sp = R.spans[0];
  assert.ok(!R.cur[0].ev.pass && R.cur[0].ev.fails.some(n => /^Hold-down/.test(n)), 'the entered design fails the hold-down force');
  assert.ok(sp.cands.length, 'a design'); assert.equal(sp.cands[0].name, B.effBase(P, 0).girder, 'the section kept');
  sp.cands[0].types.forEach(({ k, res }) => { const b = res.best; assert.equal(b.dist[0], 0, 'N kept'); assert.equal(b.N, AD.countOf(B.effBase(P, k)));
    assert.equal(b.nh, +B.effBase(P, k).harp.n, 'n_h kept'); });
  const Q = J(P); AD.apply(Q, R, {}); allPass(Q, 1).forEach(z => z.R.checks.forEach(q => assert.ok(q.pass, `${z.label} G${z.g}: ${q.n} ${q.r}`)));
  const b = sp.cands[0].types[0].res.best;
  console.log(`       (Refine, new project: ${b.N} strands (${b.nh} draped), y_end ${b.harp.yEnd} (entered ${B.effBase(P, 0).harp.yEnd}), frac ${b.harp.frac}, f′c ${b.fc} / f′ci ${b.fci}; dist ${b.dist.join(', ')}; ${R.runs} runs, ${(R.ms / 1000).toFixed(1)} s)`);
});

test('Auto design, Refine distance: |ΔN| first, then |Δn_h|, the drape change, |Δf′c|, |Δf′ci|', () => {
  const d0 = { N: 40, nh: 12, yEnd: 60, frac: 0.4, fc: 8.5, fci: 6.8 }, mk = (N, nh, yEnd, frac, fc, fci) => AD.distance(d0, { N, nh, harp: { yEnd, yMid: 10, frac }, fc, fci });
  const L = [mk(40, 12, 60, 0.4, 8.5, 6.8), mk(40, 12, 60, 0.4, 8.5, 7.3), mk(40, 12, 60, 0.4, 9, 6.8), mk(40, 12, 58, 0.4, 8.5, 6.8), mk(40, 12, 60, 0.44, 8.5, 6.8), mk(40, 10, 60, 0.4, 8.5, 6.8), mk(38, 12, 60, 0.4, 8.5, 6.8)];
  assert.deepEqual(J(L[0]), [0, 0, 0, 0, 0, 0]);
  const s = L.slice().sort(AD.cmpDist); assert.deepEqual(s.map(x => L.indexOf(x)), [0, 1, 2, 4, 3, 5, 6]);
});
