// Steel Bridge: governing line per girder type (SBGL, 2026-11-25; display only, no computed value changes):
//   1. report/summary.js govLine: the line with the highest controlling D/C of the Summary cells (RF columns and n/a left out, a ratio not a
//      number the largest), a tie broken by the next largest, then the first line; null while a check is not run
//   2. the Report (ui/report.js buildGov, done here in Node the same way): the governing line worked in full with the table of the other lines
//      (worked line first, each row linked to the worked line's table, the flag where a line differs); no broken link in the governing mode
//      and in "Work the line chosen above the tab (report of before)" (the report of before: the model without the lines, unchanged)
//   3. no computed value changes: the governing line's bundle and summary rows are those of the line computed on its own; the project is not written
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const FILES = ['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'report.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/proportions.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'engine/rating.js', 'ui/sub.js', 'ui/flexure.js', 'ui/loads.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/rating.js', 'ui/splices.js', 'ui/constructibility.js', 'engine/welds.js', 'ui/welds.js',
  'engine/sheets.js', 'ui/deflection.js', 'report/data.js', 'report/builders.js', 'report/summary.js'].map(E));
const W = loadShared(...FILES), M = W.SBDModel, RB = W.SBDReportBuild, SR = W.SharedReport, SM = W.SBDSummary;
W.SBDReportData.install();
const J = v => JSON.parse(JSON.stringify(v));

test('1. govLine: the highest controlling D/C; ties by the next largest, then the first line; RF and n/a left out; null while not run', () => {
  const c = o => { const out = {}; SM.COLS.forEach(k => { out[k.id] = { st: 'na' }; }); Object.entries(o).forEach(([k, v]) => { out[k] = typeof v === 'object' ? v : { st: v > 1 ? 'fail' : 'pass', r: v }; }); return out; };
  const L = (...a) => a.map(([j, o]) => ({ j, cells: c(o) }));
  assert.equal(SM.govLine(L([1, { flexStr: 0.8 }], [2, { flexStr: 0.9 }], [3, { flexStr: 0.85 }])).j, 2);
  assert.equal(SM.govLine(L([1, { flexStr: 0.9, shear: 0.5 }], [2, { flexStr: 0.9, shear: 0.6 }])).j, 2, 'tie: the next largest');
  assert.equal(SM.govLine(L([4, { flexStr: 0.9 }], [2, { flexStr: 0.9 }])).j, 2, 'full tie: the first line');
  assert.equal(SM.govLine(L([1, { flexStr: 0.9, rtInv: { st: 'fail', rf: 0.2, r: null } }], [2, { flexStr: 0.95 }])).j, 2, 'RF columns left out');
  assert.equal(SM.govLine(L([1, { flexStr: 0.9 }], [2, { flexStr: { st: 'review', r: NaN } }])).j, 2, 'a ratio not a number governs');
  assert.equal(SM.govLine(L([1, { flexStr: 0.9 }], [2, { flexStr: { st: 'notrun' } }])), null, 'a check not run: not known');
  assert.equal(SM.govLine([]), null);
  const g = SM.govLine(L([1, { flexStr: 0.8, shear: 0.95 }], [2, { flexStr: 0.9 }])); assert.equal(g.j, 1); assert.equal(g.col, 'shear'); assert.equal(g.r, 0.95);
});

/* a made-up bridge: 60 ft simple span, 10 girders at 4 ft, a mountable 8 in sidewalk on the right (75 psf), RIDOT; two types: Interior on
   G2–G9 (b_eff 54 in, its saved line G2 written by the app), Exterior on G1, G10 */
function walk10() {
  const P = J(M.defaultProject()); P.project.name = 'Made-up walk bridge'; P.spans = { lengths: [60], continuity: 'simple' }; P.xs = M.defaultXs({ spans: P.spans });
  P.xs.nb = 10; P.xs.bays = new Array(9).fill(4); P.xs.ohL = 2; P.xs.ohR = 2; P.xs.sidewalks.R = { w: 6, t: 8, fence: null, fenceX: null }; P.xs.sidewalks.ped = 75;
  P.ownerRules = { owner: 'RIDOT', eta: { D: 'no', R: 'yes', I: 'yes', eD: 1, eR: 1.05, eI: 1.05 } };
  const seg = { x0: 0, x1: 60, D: 30, tw: 0.5, topB: 12, topT: 0.75, botB: 14, botT: 1.0 };
  P.girders = [{ id: 'G1', label: 'Interior', position: 'interior', beff: 54, segments: [{ ...seg }] }, { id: 'G2', label: 'Exterior', position: 'exterior', beff: 51, segments: [{ ...seg, botT: 1.125 }] }];
  M.setLines(P, 0, [1, 2, 3, 4, 5, 6, 7, 8]); M.setLines(P, 1, [0, 9]); P.framing.splices = []; return P;
}
const P = walk10();
/* ui/report.js buildGov, in Node: each line's bundle and summary rows, the governing line, its bundle */
function govRun(P, gi) {
  const list = [], B = new Map();
  M.typeLines(P, gi).forEach(j => { const b = W.SBDReportData.compute(M.atLine(P, gi, j), gi, { src: 'analysis' }), r = RB.govRows(b); B.set(j, b); list.push({ j, rows: r.rows, sum: r.sum, err: r.err }); });
  const gv = SM.govLine(list.map(q => ({ j: q.j, cells: q.sum.cells })));
  return { gv, B: B.get(gv.j), Bs: B, lines: { gi, j: gv.j, list, gv, auto: true } };
}
const RUN = [govRun(P, 0), govRun(P, 1)];

test('2. the Report: the governing line worked in full, the table of the other lines; no broken link in either mode; the full mode as before', () => {
  RUN.forEach(({ gv, B, Bs, lines }, gi) => {
    const L = M.typeLines(P, gi);
    assert.ok(L.includes(gv.j));
    // the worked line has the highest controlling ratio of the Summary cells (by the rule of test 1)
    const top = q => Math.max(...SM.COLS.filter(c => !c.rf).map(c => { const x = q.sum.cells[c.id]; return x && x.st !== 'na' && x.r != null ? (isFinite(x.r) ? x.r : Infinity) : -Infinity; }));
    lines.list.forEach(q => assert.ok(top(q) <= top(lines.list.find(z => z.j === gv.j)) + 1e-12, `G${q.j + 1}`));
    ['gov', 'all'].forEach(det => {
      const m = RB.model(B, { detail: det, lines }), doc = SR.build(m);
      assert.equal(doc.unresolved.length, 0, `governing mode, ${det}: ${JSON.stringify(doc.unresolved.slice(0, 3))}`);
      const sum = m.sections.find(s => s.id === 'sum'), ln = sum.subs.find(q => q.id === 'ln');
      assert.ok(ln && ln.key === 'sum.ln', 'the lines subsection');
      const T = ln.items.find(it => it.type === 'table');
      assert.equal(T.rows.length, L.length); assert.equal(T.rows[0].cells[0], `G${gv.j + 1} (worked)`, 'the worked line first');
      T.rows.forEach(r => { const w = r.cells.at(-2); assert.equal(w.key, 'sum.gov'); assert.ok(doc.index.has('sum.gov')); });
      assert.match(m.subtitle, new RegExp(`on line G${gv.j + 1} \\(governing line\\)`));
      const tx = SR.text(doc); assert.match(tx, new RegExp(`this report works line G${gv.j + 1} in full, its governing line`));
      // "Work the line chosen above the tab": the model without the lines (each line, as before): no broken link, no lines table
      L.forEach(j => { const mf = RB.model(Bs.get(j), { detail: det }), df = SR.build(mf); assert.equal(df.unresolved.length, 0, `full mode G${j + 1}`);
        assert.ok(!mf.sections.find(s => s.id === 'sum').subs.some(q => q.id === 'ln')); assert.ok(!/governing line/.test(mf.subtitle)); });
    });
    // a section left out (the Summary): no link into it from the Executive summary
    const mx = RB.model(B, { detail: 'gov', lines, include: { sum: false } }); assert.equal(SR.build(mx).unresolved.length, 0);
  });
  // the Interior type: the sidewalk is over G9-G10, so G9 governs; the line the app saved (G2) is not the one worked
  assert.equal(RUN[0].gv.j, 8, `Interior governs on G${RUN[0].gv.j + 1}`);
  assert.equal(P.girders[0].line, 1, 'the design line the app saved (G2) is not changed');
});

test('3. no computed value changes: each line\'s bundle is that of the line (the same as computed before), the project not written', () => {
  const q0 = walk10(); assert.deepEqual(P.girders.map(g => [g.line, J(g.lines)]), q0.girders.map(g => [g.line, J(g.lines)]), 'the design lines not written by the runs');
  const j = RUN[0].gv.j, B2 = W.SBDReportData.compute(M.atLine(P, 0, j), 0, { src: 'analysis' });
  assert.equal(JSON.stringify(RB.govRows(B2).rows), JSON.stringify(RUN[0].lines.list.find(q => q.j === j).rows));
});
