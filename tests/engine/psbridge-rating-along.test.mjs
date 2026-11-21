// apps/ps-bridge E1 (2026-11-15): the HL-93 rating at every station of the girder (engine/rating-along.js, MBE 4th Ed. (2026)), in Node:
//   1. on every design of psbridge-tab-cases.mjs and of psbridge-midas-cases.mjs (MIDAS files, a custom table): the positive-flexure governing RF is the engine's own (R.rating.RFinv, same station, Object.is);
//      the engine's shear and Service III ratings are rows of the table (the same values) and each governing RF is not above the engine's
//      (more stations can only keep or lower it); the negative-moment rows at an interior support carry the engine's pier demands (R.cont);
//      the shear capacity of the grid rows equals the engine's design-station φV_n at the common stations, and their LL the engine's (contOn);
//   2. the expressions of the rows away from the engine's stations are the engine's: recomputed independently from R at the engine's Service
//      III station they give R.svcRating.RF; at its flexure station R.rating.RFinv;
//   3. the hand checks of the fix log (simple span and continuous, before / after);
//   4. the worked steps: each group's governing row in W.rating (ids rt.al.*), unique ids, their RF = the row's; the Rating tab HTML (tab and
//      Report), the Summary / check column entries (path only where the value is the engine's), the Report §1 table and every reference resolved;
//   5. nothing saved: the project is unchanged by the rating, and an old project (no new field) computes.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import fs from 'node:fs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';
import { MIDAS_CASES, midasFixtures } from './psbridge-midas-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', 'report.js', ...PBDF,
  ...['sections', 'model', 'rigid', 'lldf-fg', 'holddown', 'pierblock', 'demands', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'legacy', 'worked', 'worked-stress', 'worked-strength', 'worked-end', 'rating-along', 'worked-hdr', 'autodesign'].map(n => path.join(APP, `engine/${n}.js`)),
  ...['inputs', 'vizkit', 'vizalong', 'outkit', 'section', 'loads', 'analysis', 'strands', 'losses', 'stresses', 'flexure', 'shear', 'endzone', 'camber', 'handling', 'deck', 'rating', 'dash', 'summary', 'bridgedl'].map(n => path.join(APP, `ui/${n}.js`)),
  ...['fromtab', 'data', 'builders'].map(n => path.join(APP, `report/${n}.js`)));
const AL = W.PSBRatingAlong, M = W.PSBModel;
const CASES = TAB_CASES(() => M.defaultProject());
const run = P => { const inp = W.PSBDesign.inputs(P), R = W.PSBHoldDown.compute(inp); assert.equal(R.error, null); return { inp, R, A: AL.of(R) }; };
const close = (a, b, t, m) => assert.ok(Math.abs(a - b) <= t * Math.max(1, Math.abs(b)), `${m}: ${a} vs ${b}`);

const MCASES = MIDAS_CASES(() => M.defaultProject(), midasFixtures(rel => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/projects', rel), 'utf8'))));
for (const [name, P] of [...Object.entries(CASES), ...Object.entries(MCASES).map(([n, q]) => ['(demands) ' + n, q])]) {
  test(`rating along the girder: ${name}`, () => {
    const { R, A } = run(P), L = R.L;
    assert.ok(A && A.rows.length > 100, 'every station rated');
    const byK = k => A.rows.filter(r => r.kind === k);
    // flexure +: the engine's governing value and station
    assert.ok(Object.is(A.gov.flexP.inv, R.rating.RFinv), `flexP ${A.gov.flexP.inv} vs ${R.rating.RFinv}`);
    assert.equal(A.gov.flexP.x, R.rating.x); assert.ok(Object.is(A.gov.flexP.opr, R.rating.RFopr));
    assert.equal(byK('flexP').length, R.flexFull.filter(r => r.mLLpos > 1e-6 && r.phiMn > 0).length);
    // shear: the engine's row, the lowest not above it, the rows from the critical section to its mirror
    const sh = R.shrRating, eng = byK('shear').filter(r => r.src === 'engine');
    assert.equal(eng.length, 1, 'one engine shear row');
    if (sh.RFinv < 99) { assert.ok(Object.is(eng[0].inv, sh.RFinv)); assert.ok(A.gov.shear.inv <= sh.RFinv); }
    const nb = R.shear.filter(q => !q.isBearing).map(q => q.x);
    byK('shear').forEach(r => assert.ok(r.x >= Math.min(...nb) - 1e-9 && r.x <= Math.max(...nb) + 1e-9, 'shear from the critical section'));
    R.shear.filter(q => !q.isBearing).forEach(q => { const j = R.grid.findIndex(g => Math.abs(g.x - q.x) < 1e-9); if (j < 0) return;
      close(R.shearDiag[j].phiVn, q.phiVn, 1e-12, `φV_n at x = ${q.x}`);
      const r = byK('shear').find(z => Math.abs(z.x - q.x) < 1e-9); assert.ok(r, 'a row at the design station ' + q.x);
      if (q.vc) { close(r.LL, Math.abs(q.vc.ll), 1e-12, 'V_LL'); close(r.DC, Math.abs(q.vc.g + q.vc.dc1 + q.vc.dc2), 1e-12, 'V_DC'); } });
    // Service III: the engine's row, the lowest not above it
    const sv = R.svcRating, s3e = byK('s3').filter(r => r.src === 'engine');
    if (sv.fLL > 1e-6) { assert.equal(s3e.length, 1); assert.ok(Object.is(s3e[0].inv, sv.RF)); assert.ok(A.gov.s3.inv <= sv.RF); }
    else assert.equal(s3e.length, 0, 'no live-load tension at the engine\'s Service III section: not a row');
    // an independent recomputation at the engine's Service III station and flexure station (the expressions of every other row)
    { const j = R.grid.findIndex(g => g.x === sv.x), q = R.grid[j], d = R.diagrams[j], fLL = q.Mll / R.cp.Sbc;
      if (fLL > 1e-6) { const Pe = q.Aps * R.fpe, fPS = Pe / R.g.A + Pe * q.e / R.g.Sb, fDC = (q.Mg + q.Mdk) / R.g.Sb + d.M_DC2 * 12 / R.cp.Sbc, fDW = d.M_DW * 12 / R.cp.Sbc;
        close((sv.fr + fPS - fDC - fDW) / (0.8 * fLL), sv.RF, 1e-9, 'Service III expression'); } }
    // negative flexure: continuity on only; at an interior support the engine's pier demands
    if (R.cont) {
      const U = R.cont.unit, ends = [U.s > 1 ? 0 : null, U.s < U.spans.length ? L : null].filter(v => v != null);
      // the continuous unit (R.fe): the engine's pier demands at each interior support; a MIDAS file (R.useExt): each end its own (the file's)
      // values; the engine's pier check takes the most negative of the two ends for each effect (pbd-external.js pierNegM), the LL of one of them
      ends.forEach(x => { const r = byK('flexN').find(z => z.x === x); assert.ok(r, 'a pier row at x = ' + x);
        const d = R.diagrams.find(q => q.x === x); close(r.parts.h2, -d.M_DC2, 1e-12, 'M_DC2 at the pier'); close(r.parts.hW, -d.M_DW, 1e-12, 'M_DW at the pier'); close(r.LL, -d.M_LLneg, 1e-12, 'M_LL at the pier');
        if (!R.useExt) { close(r.parts.h2, R.cont.MDC2n, 1e-12, 'engine M_DC2 at the pier'); close(r.parts.hW, R.cont.MDWn, 1e-12, 'engine M_DW'); close(r.LL, R.cont.MLLn, 1e-9, 'engine M_LL'); }
        close(r.C, R.rating.phiCS * R.cont.phiMnN / 12, 1e-12, 'C at the pier'); });
      if (R.useExt) close(Math.max(...ends.map(x => byK('flexN').find(z => z.x === x).LL)), R.cont.MLLn, 1e-9, 'the engine\'s pier LL: the more negative end');
      byK('flexN').forEach(r => assert.ok((U.s > 1 && r.x <= L / 2 + 1e-9) || (U.s < U.spans.length && r.x >= L / 2 - 1e-9), 'the half span next to an interior support'));
    } else assert.equal(byK('flexN').length, 0);
    // the governing rows
    const lo = A.rows.filter(r => Number.isFinite(r.inv)).reduce((a, r) => Math.min(a, r.inv), Infinity);
    assert.equal(A.inv.inv, lo);
    // the worked steps of each governing row
    ['flexP', 'flexN', 'shear', 's3'].forEach(k => { const q = A.gov[k]; if (!q) return; const pf = { flexP: 'fp', flexN: 'fn', shear: 'v', s3: 's3' }[k], st = AL.steps(A, q, 'rt.al.' + pf);
      const rf = st.find(s => s.id === `rt.al.${pf}.${k === 's3' ? 'RF' : 'RFinv'}`); assert.ok(rf, 'RF step'); assert.ok(Object.is(rf.value, q.inv));
      const c = st.find(s => s.id === `rt.al.${pf}.${k === 's3' ? 'fr' : 'C'}`); assert.ok(Object.is(c.value, q.C));
      assert.ok(st.every(s => /^MBE 4th Ed\. \(2026\)|^$/.test(s.ref)), 'MBE 4th Ed. refs'); });
    const Wr = W.PSBWorkedHDR.rating(W.PSBDesign.inputs(P), R), ids = Wr.steps.map(s => s.id);
    assert.equal(new Set(ids).size, ids.length, 'unique step ids');
    assert.ok(ids.includes('rt.al.fp.RFinv') && ids.includes('rt.al.v.RFinv'), 'the governing steps in the Rating tab\'s work');
    assert.equal(ids.includes('rt.al.fn.RFinv'), !!A.gov.flexN);
    // every step in a topic of the tab
    const G = W.PSBOutKit.groups(Wr.steps, W.PSBUiRating.TOPICS), n = G.reduce((a, g) => a + g.steps.length, 0);
    assert.equal(n, Wr.steps.length, 'every step in a topic');
  });
}

test('rating along the girder: hand checks (simple span; continuous, pier) and before / after', () => {
  // simple span, the default BT-72 interior girder, L = 120 ft: flexure + at x = 58 ft (unchanged: the engine's governing station)
  { const { R, A } = run(CASES['default (BT-72, interior, simple)']), q = A.gov.flexP;
    assert.equal(q.x, 58); close(q.parts.mSW, 1484.411, 1e-6, 'M_g'); close(q.parts.mDC1, 1955.325, 1e-6, 'M_DC1'); close(q.parts.mDC2, 539.4, 1e-9, 'M_DC2'); close(q.DW, 449.5, 1e-9, 'M_DW');
    close(q.LL, 2628.734, 1e-6, 'M_LL'); close(q.C, 13638.909, 1e-6, 'φM_n'); close(A.phiCS, 1, 0, 'φcφs');
    close((13638.909 - 1.25 * (1484.411 + 1955.325 + 539.4) - 1.50 * 449.5) / (1.75 * 2628.734), q.inv, 1e-5, 'hand RF_inv');
    close(q.inv, 1.7370, 1e-4, 'RF_inv'); close(q.opr, 2.2517, 1e-4, 'RF_opr');
    // before = after for every group of this design (shear and Service III at the engine's sections)
    close(A.gov.shear.inv, R.shrRating.RFinv, 0, 'shear'); close(A.gov.s3.inv, R.svcRating.RF, 0, 'S III'); close(A.inv.inv, 1.4300, 1e-4, 'governing'); assert.equal(A.inv.kind, 's3'); }
  // continuous, 3 spans 100 / 125 / 100 ft, exterior G6 in span 2: negative flexure at the left pier (x = 0), new
  { const { R, A } = run(CASES['continuous 3 spans, exterior G6 in span 2, skew 35°, restraint, haunch in the section']), q = A.gov.flexN;
    assert.equal(q.x, 0); const c = R.cont;
    close(c.As, 16, 0, 'A_s'); close(c.fyr, 60, 0, 'f_y'); close(c.dN, 77.5, 1e-9, 'd'); close(c.aN, 5.1105, 1e-4, 'a'); close(c.phiN, 0.9, 0, 'φ');
    close(0.9 * 16 * 60 * (77.5 - c.aN / 2) / 12, q.C, 1e-9, 'φM_n,neg');
    close(q.C, 5396.02, 1e-6, 'C'); close(q.parts.h2, 385.190, 1e-6, 'M_DC2'); close(q.parts.hW, 320.992, 1e-6, 'M_DW'); close(q.LL, 1859.531, 1e-6, 'M_LL');
    close((5396.023 - 1.25 * 385.190 - 1.50 * 320.992) / (1.75 * 1859.531), q.inv, 1e-5, 'hand RF_inv'); close(q.inv, 1.3623, 1e-4, 'RF_inv'); close(q.opr, 1.7659, 1e-4, 'RF_opr');
    // before: the lowest of the engine's three, shear 2.032; after: the pier, 1.362; Service III 8.165 at the girder end -> 2.621 at midspan
    close(Math.min(R.rating.RFinv, R.shrRating.RFinv, R.svcRating.RF), 2.0321, 1e-4, 'before'); assert.equal(A.inv, q);
    close(R.svcRating.RF, 8.1645, 1e-4, 'S III before'); close(A.gov.s3.inv, 2.6206, 1e-4, 'S III after'); assert.equal(A.gov.s3.x, 62.5); }
  // Service III where the engine finds no live-load tension at its section (the girder end): 99 (—) before, rated at midspan after
  { const { R, A } = run(CASES['AASHTO Type IV exterior G1, 85 ft, entered DF, separate deck thickness']);
    assert.equal(R.svcRating.RF, 99); close(A.gov.s3.inv, 2.9662, 1e-4, 'S III after'); }
  // shear lower than the engine's governing section: x = 86 ft against 84 ft
  { const { R, A } = run(CASES['cracked under Service III (few strands), continuous with top steel, two spans']);
    close(R.shrRating.RFinv, 0.6083, 1e-4, 'shear before'); close(A.gov.shear.inv, 0.5991, 1e-4, 'shear after'); assert.equal(A.gov.shear.x, 86); }
});

test('rating along the girder: the Rating tab, the check column, the Summary and the Report', () => {
  const P = M.importJSON(M.exportJSON(CASES['continuous 3 spans, exterior G6 in span 2, skew 35°, restraint, haunch in the section'])).project, P0 = JSON.stringify(P);
  const B = W.PSBReportData.compute(P, null), { R } = B, A = AL.of(R);
  // the tab (on screen: ctx.redraw) and the Report's reading of it
  const tab = W.PSBUiRating.output({ P, inp: B.inp, R, W: B.W, ui: {}, redraw() {} }), rpt = W.PSBUiRating.output({ P, inp: B.inp, R, W: B.W, ui: {} });
  assert.match(tab, /id="card-rtal"/); assert.match(tab, /id="gfx_rtal"/); assert.match(tab, /id="rt_selwork"/);
  assert.equal((tab.match(/data-rti="/g) || []).length, A.rows.length, 'a row per location');
  assert.ok(!/data-rti="/.test(rpt), 'the Report: the governing rows, the table with Detail "every station"');
  const rptE = W.PSBUiRating.output({ P, inp: B.inp, R, W: B.W, ui: { every: true } }); assert.equal((rptE.match(/data-rti="/g) || []).length, A.rows.length);
  assert.ok(!/NaN|undefined|\[object|pending/i.test(tab), 'no NaN / undefined / pending');
  assert.match(tab, /Flexure, negative \(pier\)/);
  // the check column's Rating entries: the lowest of each group, an engine path only where it is the engine's value
  const RT = W.PSBDashUI.RATING, e = RT.rf.map(([n, f, st, p]) => ({ n, v: f(R), st, p: p(R) }));
  assert.equal(e[0].v, R.rating.RFinv); assert.equal(e[0].p, 'rating.RFinv');
  assert.equal(e[1].v, A.gov.flexN.inv); assert.equal(e[1].p, null);
  assert.equal(e[2].v, R.shrRating.RFinv); assert.equal(e[2].p, 'shrRating.RFinv');
  assert.equal(e[3].v, A.gov.s3.inv); assert.equal(e[3].p, null, 'Service III along the girder is not the engine\'s value');
  // the Report: §1's table, every reference resolved, the rating section with the along-girder cards and steps
  const Mo = W.PSBReportBuild.model(B), doc = W.SharedReport.build(Mo), T = W.SharedReport.text(doc);
  assert.deepEqual(JSON.parse(JSON.stringify(doc.unresolved)), [], 'every reference resolves');
  const s1 = Mo.sections.find(s => s.id === 'sum'), t1 = s1.subs[0].items.find(i => i.type === 'table' && /^HL-93 inventory rating factor$/.test(i.head[0]));
  assert.ok(t1, '§1 rating table'); assert.equal(t1.head[1], 'Lowest RF along the girder'); assert.equal(t1.rows.length, 4);
  assert.equal(t1.rows[1][1].t, A.gov.flexN.inv.toFixed(3)); assert.equal(t1.rows[1][3].t, '—');
  assert.match(T, /Load rating along the girder: governing/); assert.match(T, /Along the girder: negative flexure over the pier, governing location/);
  assert.equal(JSON.stringify(P), P0, 'the project unchanged (nothing saved)');
  // the recorded values (harness B compares them with the old app): the same engine paths as without this file
  const paths = new Set(Mo.vals.map(v => v.path));
  ['rating.RFinv', 'shrRating.RFinv', 'svcRating.RF'].forEach(p => assert.ok(paths.has(p), p));
  // the Summary: the lowest RF of the girder types along the girder; data-sv only with an engine path (every data-sv holds its path's value)
  const BR = W.PSBBridge, AA = BR.results(P, inp => W.PSBHoldDown.compute(JSON.parse(JSON.stringify(inp)))), h = W.PSBSummaryUI.html({ P, A: AA, run: {}, shown: '' });
  assert.match(h, /Lowest HL-93 inventory rating factor:<\/b> Flexure \(negative, pier region\), inventory RF/);
  assert.ok(!/data-sv="[^"]*\|(null)?"/.test(h), 'no data-sv without an engine path');
});

test('rating along the girder: an old project (no new field) computes, and a single span has no negative-moment rating', () => {
  const P = M.defaultProject(), j = JSON.parse(M.exportJSON(P)), P2 = M.importJSON(JSON.stringify(j)).project, { A } = run(P2);
  assert.ok(A.gov.flexP && A.gov.shear && A.gov.s3); assert.equal(A.gov.flexN, null); assert.equal(A.negNote, '');
});

// E1-D4 / E1-D5 (engineer decisions 2026-11-21; engine/rating-along.js apply): the engine's rating without the apply (the moved engine's own)
const raw = inp => { const ap = AL.apply; AL.apply = (i, R) => R; try { return W.PSBHoldDown.compute(JSON.parse(JSON.stringify(inp))); } finally { AL.apply = ap; } };
const nums = o => JSON.parse(JSON.stringify(o, (k, v) => (['phiCSv', 'phiCSvFloor', 'dl', 'cs'].includes(k) ? undefined : v)));

test('E1-D5 / E1-D4: identity where nothing changes (every dead-load part adds; φ_s = 1.00): the engine\'s rating values bit for bit', () => {
  let nRel = 0;
  for (const [name, P] of [...Object.entries(CASES), ...Object.entries(MCASES)]) {
    const inp = W.PSBDesign.inputs(P); inp.rateVeh = (inp.rateVeh || []).concat([{ name: 'T', M: 1500, V: 60, W: 25 }]);
    const R1 = W.PSBHoldDown.compute(JSON.parse(JSON.stringify(inp))), R0 = raw(inp), A = AL.of(R1), cs = R1.rating.phiCS;
    // every positive-flexure row whose parts all add: the engine's rateAt expression, in its order of operations (Object.is)
    A.rows.filter(r => r.kind === 'flexP').forEach(r => { const p = r.parts;
      if (p.dl.max) { const cap = cs * p.Rn - 1.25 * (p.mSW + p.mDC1 + p.mDC2) - 1.50 * r.DW; assert.ok(Object.is(r.inv, cap / (1.75 * r.LL)) && Object.is(r.opr, cap / (1.35 * r.LL)), `${name} x = ${r.x}`); }
      else { nRel++; assert.ok(p.dl.sNC < 0 || p.dl.s2 < 0 || p.dl.sW < 0, 'a relieving part'); } });
    if (R1.rating.phiS === 1) {
      // φ_s = 1.00 and no governing station with a relieving part (true on every design here): R.rating, R.shrRating, R.vehRatings unchanged
      assert.ok(!R1.rating.dl || R1.rating.dl.max, `${name}: the governing flexure station has every part adding`);
      assert.deepEqual(nums(R1.rating), nums(R0.rating), name); assert.deepEqual(nums(R1.shrRating), nums(R0.shrRating), name); assert.deepEqual(nums(R1.vehRatings), nums(R0.vehRatings), name);
      assert.ok(Object.is(R1.rating.phiCSv, R1.rating.phiCS), 'shear factor = flexure factor when φ_s = 1.00');
    }
    if (!R1.cont && !R1.fe && !R1.useExt) assert.ok(A.rows.filter(r => r.kind === 'flexP').every(r => r.parts.dl.max), `${name}: a simple span has no relieving part`);
  }
  assert.ok(nRel > 100, 'the continuous designs have stations with a relieving part: ' + nRel);
});

test('E1-D5 hand check: continuous 3 spans 100 / 125 / 100 ft, x = 12.5 ft from the left pier (DC2 and DW relieve the positive moment)', () => {
  const { R, A } = run(CASES['continuous 3 spans, exterior G6 in span 2, skew 35°, restraint, haunch in the section']), q = A.rows.find(r => r.kind === 'flexP' && r.x === 12.5), p = q.parts, dl = p.dl;
  close(q.C, 11531.840, 1e-5, 'φM_n'); close(p.mSW + p.mDC1, 1239.673, 1e-5, 'M_g + M_DC1'); close(p.mDC2, -174.253, 1e-5, 'M_DC2'); close(q.DW, -145.211, 1e-5, 'M_DW'); close(q.LL, 348.458, 1e-5, 'M_LL+IM');
  assert.equal(dl.gNC, 1.25); assert.equal(dl.g2, 0.90); assert.equal(dl.gW, 0.65); assert.equal(dl.max, false);
  // before (1.25 on the net DC, 1.50 on DW): (11531.840 − 1.25 × 1065.420 + 1.50 × 145.211)/(1.75 × 348.458) = 10417.880/609.801 = 17.084
  const before = (q.C - 1.25 * q.DC - 1.50 * q.DW) / (1.75 * q.LL); close(before, 17.0841, 1e-4, 'before');
  // after: D = 1.25 × 1239.673 + 0.90 × (−174.253) + 0.65 × (−145.211) = 1549.591 − 156.827 − 94.387 = 1298.377; (11531.840 − 1298.377)/609.801 = 16.782
  close(dl.D, 1298.377, 1e-5, 'D_u'); close((11531.840 - 1298.377) / (1.75 * 348.458), q.inv, 1e-5, 'hand RF_inv'); close(q.inv, 16.7816, 1e-4, 'RF_inv'); close(q.opr, 21.7540, 1e-4, 'RF_opr');
  // the governing positive-flexure RF of the design is unchanged (midspan of span 2, every part adding): the engine's, after the apply
  assert.equal(R.rating.x, 62.5); close(R.rating.RFinv, 2.9416, 1e-4, 'governing'); assert.ok(Object.is(A.gov.flexP.inv, R.rating.RFinv)); assert.equal(R.rating.dl.max, true);
  // the worked step shows the factor of each part and why
  const st = AL.steps(A, q, 'rt.sel'), d = st.find(s => s.id === 'rt.sel.D');
  assert.ok(d && Object.is(d.value, dl.D)); assert.match(d.note, /M_DC2 = -174\.3: relieves: 0\.90/); assert.match(d.note, /M_DW = -145\.2: relieves: 0\.65/); assert.match(d.note, /M_g \+ M_DC1 = 1239\.7: adds: 1\.25/);
  assert.match(d.sub, /^1\.25\(1239\.7\) \+ 0\.90\(-174\.3\) \+ 0\.65\(-145\.2\)$/);
  // a station where every part adds: no D step, the engine's expression and the "adds" note
  const g = AL.steps(A, A.gov.flexP, 'rt.al.fp'); assert.ok(!g.some(s => s.id === 'rt.al.fp.D')); assert.match(g.find(s => s.id === 'rt.al.fp.RFinv').note, /M_DC2 = [0-9.]+: adds: 1\.25/);
});

test('E1-D5: a station of the engine\'s rating that governs with a relieving part (made-up demands): R.rating and the along-girder row agree', () => {
  // the engine's result of the 3-span design with M_DC2 and M_DW at x = 12.5 ft scaled so that this station governs, through apply
  const inp = W.PSBDesign.inputs(CASES['continuous 3 spans, exterior G6 in span 2, skew 35°, restraint, haunch in the section']), R = raw(inp);
  const r = R.flexFull.find(q => q.x === 12.5); r.phiMn = 12 * 1400; r.mDC2 = -400; r.mDW = -300;
  W.PSBRatingAlong.apply(inp, R); const A = AL.of(R), q = A.gov.flexP;
  assert.equal(R.rating.x, 12.5); assert.equal(q.x, 12.5); assert.ok(Object.is(q.inv, R.rating.RFinv)); assert.ok(Object.is(q.opr, R.rating.RFopr));
  const D = 1.25 * (r.mSW + r.mDC1) + 0.90 * -400 + 0.65 * -300; close(R.rating.RFinv, (1400 - D) / (1.75 * r.mLLpos), 1e-12, 'RF_inv');
  close(R.rating.RFinv, (1400 - (1549.591 - 360 - 195)) / (1.75 * 348.458), 1e-5, 'hand');
  const before = (1400 - 1.25 * (r.mSW + r.mDC1 - 400) + 1.50 * 300) / (1.75 * r.mLLpos); assert.ok(R.rating.RFinv < before, `after ${R.rating.RFinv} < before ${before}`);
  const Wr = W.PSBWorkedHDR.rating(inp, R), s = Wr.steps.find(z => z.id === 'rt.RFinv');
  assert.ok(Object.is(s.value, R.rating.RFinv)); assert.match(s.sub, /\[1\.25\(1239\.7\) \+ 0\.90\(-400\.0\) \+ 0\.65\(-300\.0\)\]/); assert.match(s.note, /relieves: 0\.90/);
  Wr.pairs.forEach(z => close(z.shown, z.engine, 1e-9, z.id));
});

test('E1-D4 hand check: φ_s = 0.85 entered, the default BT-72 simple span: shear C = φ_c φV_n (φ_s = 1.0, MBE 4th Ed. Art. 6A.4.2.4)', () => {
  const inp = W.PSBDesign.inputs(CASES['default (BT-72, interior, simple)']); inp.opt.rtPhiS = 0.85; inp.rateVeh = [{ name: 'T', M: 1500, V: 60, W: 25 }];
  const R = W.PSBHoldDown.compute(JSON.parse(JSON.stringify(inp))), R0 = raw(inp), sh = R.shrRating, rt = R.rating;
  assert.equal(rt.phiCS, 0.85); assert.equal(rt.phiCSv, 1); assert.equal(sh.x, 30.01);
  close(sh.phiVn, 334.550, 1e-5, 'φV_n'); close(sh.VDC, 66.371, 1e-5, 'V_DC'); close(sh.VDW, 7.4975, 1e-9, 'V_DW'); close(sh.VLL, 83.989, 1e-5, 'V_LL');
  // before: (0.85 × 334.550 − 1.25 × 66.371 − 1.50 × 7.498)/(1.75 × 83.989) = (284.368 − 82.963 − 11.246)/146.981 = 190.158/146.981 = 1.2938
  close(R0.shrRating.RFinv, (0.85 * 334.550 - 1.25 * 66.371 - 1.50 * 7.4975) / (1.75 * 83.989), 1e-5, 'hand before'); close(R0.shrRating.RFinv, 1.2938, 1e-4, 'before');
  // after: (1.00 × 334.550 − 82.963 − 11.246)/146.981 = 240.341/146.981 = 1.6352; operating 240.341/113.385 = 2.1197
  close(sh.RFinv, (334.550 - 1.25 * 66.371 - 1.50 * 7.4975) / (1.75 * 83.989), 1e-5, 'hand after'); close(sh.RFinv, 1.6352, 1e-4, 'after'); close(sh.RFopr, 2.1197, 1e-4, 'opr');
  // flexure and Service III keep the entered φ_s (unchanged); the vehicle's shear takes φ_c too
  assert.ok(Object.is(rt.RFinv, R0.rating.RFinv)); assert.ok(Object.is(R.svcRating.RF, R0.svcRating.RF)); assert.ok(Object.is(R.vehRatings[0].RFm, R0.vehRatings[0].RFm));
  close(R.vehRatings[0].RFv, (334.550 - 1.25 * 66.371 - 1.50 * 7.4975) / 60, 1e-5, 'vehicle RF_V');
  // along the girder: the shear rows with φ_c (the engine's row the same value), flexure with φ_c φ_s
  const A = AL.of(R); assert.equal(A.phiCSv, 1); assert.ok(Object.is(A.rows.find(r => r.kind === 'shear' && r.src === 'engine').inv, sh.RFinv)); assert.ok(Object.is(A.gov.flexP.inv, rt.RFinv));
  // the worked steps: φ_s = 1.0 stated, the substituted values = the engine's
  const Wr = W.PSBWorkedHDR.rating(inp, R), v = Wr.steps.find(s => s.id === 'rt.phiCSv'), c = AL.steps(A, A.gov.shear, 'rt.al.v').find(s => s.id === 'rt.al.v.C');
  assert.ok(v && v.value === 1 && /φ_s = 1\.0 \(MBE 6A\.4\.2\.4\)/.test(v.note)); assert.match(c.note, /φ_s = 1\.0 \(MBE 6A\.4\.2\.4/); assert.match(Wr.steps.find(s => s.id === 'rt.RFvInv').sub, /^\\frac\{1\.000\(334\.6\)/);
  Wr.pairs.forEach(z => close(z.shown, z.engine, 1e-9, z.id));
  // φ_c below 0.85: the lower limit on φ_c × 1.0 (φ_c = 0.80, φ_s = 0.90: flexure 0.85, shear 0.85)
  const i2 = JSON.parse(JSON.stringify(inp)); i2.opt.rtPhiC = 0.80; i2.opt.rtPhiS = 0.90; const R2 = W.PSBHoldDown.compute(i2); assert.equal(R2.rating.phiCS, 0.85); assert.equal(R2.rating.phiCSv, 0.85); assert.equal(R2.rating.phiCSvFloor, true);
  // the Rating tab states it
  const tab = W.PSBUiRating.output({ P: CASES['default (BT-72, interior, simple)'], inp, R, W: { rating: Wr }, ui: {}, redraw() {} });
  assert.match(tab, /φ<sub>c<\/sub>\(1\.0\) used, shear \(φ<sub>s<\/sub> = 1\.0, MBE 4th Ed\. Art\. 6A\.4\.2\.4\)/);
});
