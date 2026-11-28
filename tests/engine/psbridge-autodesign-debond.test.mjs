// apps/ps-bridge 2026-11-28 (PSAD-C, the engineer's choice of 2026-11-28, item 3; PS-12 reopened for this option only): Auto design's
// straight strands with debonding (engine/autodesign.js settings.pattern, debCaps, debRows, withDeb, searchStraight, searchPat).
//   1. absent = 'draped': the run equals the run with 'draped' entered (the default changes nothing);
//   2. debCaps: the AASHTO LRFD 10th Ed. 5.9.4.3.3 limits per row (45 %, even, the web width and the outermost bonded, under the voids);
//   3. straight on the default project with 4 in² of bonded release steel: no draped strand; every row within its limits, each debonded
//      row its own length, the lengths 60 d_b apart on the 1 ft grid, the longest ≤ 0.20 L; no 5.9.4.3.3 warning and every check passing
//      after Apply; the fewest debonded strands (two fewer fail the release checks at the longest lengths) and the shortest lengths (1 ft
//      shorter fails a release check);
//   4. 'both': the fewer strands, then the fewer special strands, then draped; MassDOT 3.7.2.2: a box beam takes the straight design.
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
const strip = R => J(R.spans.map(sp => sp.sections.map(e => ({ name: e.name, pass: e.pass, types: e.types.map(q => ({ why: q.res.why, best: q.res.best ? { N: q.res.best.N, nh: q.res.best.nh, rows: q.res.best.rows, harp: q.res.best.harp, fc: q.res.best.fc, fci: q.res.best.fci, gov: q.res.best.ev.gov } : null })) }))));
const RELEASE = ['Release comp', 'Release tens', 'Release tens (+M, bot)', 'Release tens. steel (5.9.2.3.1b)', 'Srv tens (top)'];
const ctx0 = o => ({ cache: new Map(), fit: new Map(), rows: new Map(), runs: 0, first: {}, stopped: false, o });

test('Auto design, strand pattern: absent = draped; the run equals the run with draped entered', () => {
  const P = load(CASES.find(c => c[0].startsWith('CTDOT, debonded rows'))[1]); assert.equal(AD.settings(P).pattern, 'draped');
  P.autodesign = { vars: { section: 'lock', conc: 'lock' } }; const a = AD.runSync(P, Object.assign(AD.settings(P), { fracs: [0.40, 0.45] }));
  P.autodesign.pattern = 'draped'; const b = AD.runSync(P, Object.assign(AD.settings(P), { fracs: [0.40, 0.45] }));
  assert.equal(JSON.stringify(strip(a)), JSON.stringify(strip(b)));
  const c = a.spans[0].sections[0].types[0].res.best; if (c) assert.deepEqual(J(c.rows.map(r => [r.nd, r.dbnd])), J(B.effBase(P, 0).rows.slice().sort((x, y) => x.y - y.y).map(r => [r.nd, r.dbnd])).slice(0, c.rows.length), 'draped keeps the entered debonding (PS-12)');
});

test('Auto design, debonding limits per row (debCaps): 45 %, even, the web width and the outermost bonded, under the voids', () => {
  const P = load(M.defaultProject()), e = B.effBase(P, 0);   // PCI BT-72: b_w = 6 in
  const d = AD.debCaps(P, 0, e, [{ n: 12, y: 2 }, { n: 8, y: 6 }, { n: 2, y: 8 }]);
  assert.deepEqual(J(d.caps), [4, 2, 0], 'row of 12: 45 % → 4 (x = ±5, ±7, ±9 outside the web and inside the outermost); row of 8: x = ±5 only → 2');
  assert.equal(d.dStep, 3, '60 × 0.6 in = 36 in = 3 ft'); assert.equal(d.nTerm(10), 4); assert.equal(d.nTerm(12), 6);
  const bx = load(CASES.find(c => c[0].startsWith('box BIII-36 (39in), CTDOT plate'))[1]), eb = B.effBase(bx, 0), db = AD.debCaps(bx, 0, eb, [{ n: 16, y: 2 }]);
  const g = W.girderGross(AD.lineInputs(bx, 0, B.typeLines(bx, 0)[0], eb)), vw = W.sectionVoids(g)[0].w, under = [...Array(16)].map((_, i) => (i - 7.5) * 2).filter(x => Math.abs(x) < 15 - 1e-9 && Math.abs(x) < vw / 2 - 1e-9).length;
  assert.equal(db.caps[0], Math.min(6, 2 * Math.floor(under / 2)), `box: under the ${vw} in void (${under} strands), 45 % of 16 → 6`);
});

test('Auto design, straight with debonding (default project, 4 in² bonded release steel): the limits hold, every check passes, the fewest debonded, the shortest lengths', () => {
  const P = load(M.defaultProject()); P.base.opt.relAs = 4; P.autodesign = { pattern: 'straight', vars: { section: 'lock' } };
  const o = AD.settings(P), R = AD.runSync(P, o), c = R.spans[0].cands[0]; assert.ok(c, 'a straight candidate');
  const b = c.types[0].res.best; assert.equal(b.pattern, 'straight'); assert.equal(b.nh, 0); assert.ok(b.nDeb > 0, 'debonding needed');
  const L = 120, low = b.rows.filter(r => r.y < 36), d = AD.debCaps(P, 0, b.eff, low), deb = low.filter(r => r.nd > 0);
  low.forEach((r, i) => { assert.equal(r.nd % 2, 0); assert.ok(r.nd <= 0.45 * r.n + 1e-9 && r.nd <= d.caps[i] && r.nd <= d.nTerm(b.nDeb), `row ${i}`); });
  const ls = deb.map(r => r.dbnd).sort((x, y) => x - y); assert.equal(new Set(ls).size, ls.length, 'one termination section per row');
  ls.forEach((l, i) => { assert.equal(l, Math.round(l), '1 ft grid'); if (i) assert.ok((l - ls[i - 1]) * 12 >= 60 * 0.6 - 1e-9, '60 d_b apart'); }); assert.ok(ls[ls.length - 1] <= 0.20 * L);
  const Q = J(P); AD.apply(Q, R, {});
  B.results(Q, inp => W.PSBHoldDown.compute(J(inp))).cells.forEach(z => { assert.ok(!z.R.warns.some(w => AD.DEB_W.test(w)), `${z.label}: no 5.9.4.3.3 warning`); z.R.checks.forEach(q => assert.ok(q.pass, `${z.label} G${z.g}: ${q.n} ${q.r}`)); });
  const ctx = ctx0(o), rw = low.map(r => Object.assign({}, r, { nd: 0, dbnd: 0 })), ev = rows => AD.evalCand(P, 0, Object.assign(J(b.eff), { rows: rows.concat(b.rows.filter(r => r.y >= 36)) }), ctx, true, true);
  const nd2 = AD.debRows(rw, d.caps, b.nDeb - 2, d.nTerm(b.nDeb - 2));
  if (nd2) { const nr = nd2.filter(x => x > 0).length, l1 = Math.floor(0.2 * L) - (nr - 1) * d.dStep, r = ev(AD.withDeb(rw, nd2, l1, d.dStep)); assert.ok(r.fails.some(n => RELEASE.includes(n)), 'two debonded fewer fail a release check at the longest lengths'); }
  const l0 = ls[0]; if (l0 > 1) { const nd = AD.debRows(rw, d.caps, b.nDeb, d.nTerm(b.nDeb)), r = ev(AD.withDeb(rw, nd, l0 - 1, d.dStep)); assert.ok(!r.pass, 'the lengths 1 ft shorter fail'); }
  const R1 = B.results(Q, inp => W.PSBHoldDown.compute(J(inp))).cells[0].R, gv = R1.checks.filter(q => !AD.RULE.test(q.n)).sort((x, y) => y.r - x.r)[0];
  console.log(`       (straight: N ${b.N}, ${b.nDeb} debonded: ${deb.map(r => `${r.nd} of ${r.n} at y ${r.y} in for ${r.dbnd} ft`).join(', ')}; f′c ${b.fc} / f′ci ${b.fci}; governing ${gv.n} ${gv.v.toFixed(3)} / ${gv.lim.toFixed(3)} = ${gv.r.toFixed(3)} at ${(+gv.loc).toFixed(2)} ft; ${R.runs} runs, ${(R.ms / 1000).toFixed(1)} s)`);
});

test('Auto design, both: fewer strands, then fewer special strands, then draped; MassDOT 3.7.2.2: a box beam takes the straight design', () => {
  const P = load(M.defaultProject()); P.base.opt.relAs = 4; P.autodesign = { pattern: 'both', vars: { section: 'lock' } };
  const R = AD.runSync(P), q = R.spans[0].cands[0].types[0].res, a = q.alt, best = q.best;
  assert.ok(a && a.best, 'the other pattern searched too');
  const sd = best.pattern === 'straight' ? best : a.best, dr = best.pattern === 'straight' ? a.best : best;
  const want = sd.N < dr.N || (sd.N === dr.N && sd.nDeb < dr.nh) ? 'straight' : 'draped'; assert.equal(best.pattern || 'draped', want);
  const X = load(CASES.find(c => c[0].startsWith('box BIII-36 (39in), CTDOT plate'))[1]); X.base.owner = 'MassDOT'; X.autodesign = { pattern: 'both', vars: { section: 'lock', conc: 'lock' } };
  const RX = AD.runSync(X), cx = RX.spans[0].cands[0];
  if (cx) assert.equal(cx.types[0].res.best.pattern, 'straight', 'MassDOT box: straight');
  console.log(`       (both, BT-72: ${best.pattern || 'draped'} N ${best.N} (draped ${dr.N}/${dr.nh}, straight ${sd.N}/${sd.nDeb} debonded); MassDOT box: ${cx ? cx.types[0].res.best.pattern + ' N ' + cx.types[0].res.best.N : 'none: ' + RX.spans[0].sections.map(e => e.types.map(z => z.res.why).join()).join()})`);
});
