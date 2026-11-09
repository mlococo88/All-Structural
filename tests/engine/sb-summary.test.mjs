// Steel Bridge app, Summary output tab (2026-11-09): report/summary.js. Every cell of the Summary is the module's own governing value.
// For the default project (one girder, three spans, no skew) and a skewed three-span project with two plate girders (exterior G1,
// interior G2; skews 35° / 30° / 30° / 35°), each girder's Summary (SBDSummary.run each module, then cells) is compared, cell by cell,
// with the module's own result, built here independently through each output tab's own build() (the function its Calculate button calls):
//   Flexure       ui/flexure.js build(): Strength I / Service II / proportions = the largest ratio of those checks over every location
//                 (the checks in use, as engine/flexure.js govern()); the largest of the three = the tab's governing ratio (gov.gov.ratio)
//   Shear         ui/shear.js build(): max(web panels gov, stations gov);  Stiffeners: max(transverse gov, bearing gov)
//   Fatigue       ui/fatigue.js build(): max(details gov, GS17 gov);  Studs: scGov
//   Constr.       ui/constructibility.js build(): govAll.ratio
//   Cross-frames  ui/framing.js build(): the largest ratio of the CF items with a pass / fail status
//   Field splices engine/splices.js girder() (as ui/splices.js): the largest strength ratio (TF/BF/WS 1, 2, 4, 5) of every splice
//   Welds         ui/welds.js build(): the largest ratio of every item
//   Deflection    engine/analysis.js analyzeGirder().lld: the largest Δ / limit of a span with a limit
//   Rating        ui/rating.js build(): sum.gov.inv.inv, sum.gov.opr.opr
// Equality is exact (Object.is). Also: the overall verdict counts and the governing check; a module not run is "not run".
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const FILES = ['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'report.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/proportions.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'engine/rating.js', 'ui/flexure.js', 'ui/loads.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/rating.js', 'ui/splices.js', 'ui/constructibility.js', 'engine/welds.js', 'ui/welds.js',
  'report/data.js', 'report/builders.js', 'report/summary.js'].map(E));
const W = loadShared(...FILES);
W.SBDReportData.install();   // as index.html: one analysis per project state for every caller
const S = W.SBDSummary;
const gr = r => (isFinite(r) ? r : Infinity);
const maxBy = (xs, f) => xs.reduce((b, x) => (b == null || gr(f(x)) > gr(f(b)) ? x : b), null);

function skewed() {
  const P = W.SBDModel.defaultProject();
  P.project.name = 'Summary test: skewed three-span';
  P.spans.lengths = [100, 130, 100]; P.xs.skews = [35, 30, 30, 35];
  const pos = { D: 60, tw: 0.5625, topB: 16, topT: 0.75, botB: 18, botT: 1.25 }, neg = { D: 60, tw: 0.5625, topB: 18, topT: 1.5, botB: 18, botT: 2 };
  const segs = () => [{ x0: 0, x1: 80, ...pos }, { x0: 80, x1: 120, ...neg }, { x0: 120, x1: 210, ...pos }, { x0: 210, x1: 250, ...neg }, { x0: 250, x1: 330, ...pos }];
  P.girders = [{ id: 'G1', label: 'G1', position: 'exterior', beff: 102, segments: segs() }, { id: 'G2', label: 'G2', position: 'interior', beff: 114, segments: segs() }];
  P.framing.splices = [70, 165, 260];
  const v = W.SBDModel.validate(P); assert.equal(v.errors.length, 0, JSON.stringify(v.errors));
  return P;
}

/* the modules' own governing values, from each tab's build() */
function own(P, g) {
  const o = {}, AN = W.SBDAnalysis;
  const F = W.SBDFlexureUI.build({ P, g, src: 'analysis', method: 'auto' }); assert.ok(!F.err, F.err);
  for (const col of ['flexStr', 'flexSvc', 'flexProp']) { const all = F.rows.flatMap(r => r.checks.filter(c => c.inUse && c.na == null && c.ratio !== undefined && S.FLEX_CLS(c.id) === col)); const b = maxBy(all, c => c.ratio); o[col] = b ? b.ratio : undefined; }
  o.flexGov = F.gov.gov.ratio;
  const R = W.SBDRatingUI.build({ P, g, src: 'analysis' }); assert.ok(!R.err, R.err); o.rtInv = R.sum.gov.inv.inv; o.rtOpr = R.sum.gov.opr.opr;
  const Sh = W.SBDShearUI.build({ P, g, src: 'analysis' }); assert.ok(!Sh.err, Sh.err);
  o.shear = Math.max(Sh.panels.gov && Sh.gm.dem ? gr(Sh.panels.gov.r) : -Infinity, Sh.stGov ? gr(Sh.stGov.gov.ratio) : -Infinity);
  o.stiff = Math.max(Sh.tsGov ? gr(Sh.tsGov.it.r) : -Infinity, Sh.bsGov ? gr(Sh.bsGov.it.r) : -Infinity);
  const Fa = W.SBDFatigueUI.build({ P, g, src: 'analysis' }); assert.ok(!Fa.err, Fa.err);
  o.fat = Math.max(Fa.faGov ? gr(Fa.faGov.it.r) : -Infinity, Fa.g17 ? gr(Fa.g17.it.r) : -Infinity); o.studs = Fa.scGov ? Fa.scGov.it.r : undefined;
  const Cn = W.SBDConstrUI.build({ P, g, src: 'project' }); assert.ok(!Cn.err, Cn.err); o.cn = Cn.govAll.ratio;
  const Fr = W.SBDFramingUI.build({ P, g }); assert.ok(!Fr.err, Fr.err);
  const cf = (Fr.C || []).flatMap(c => c.items.filter(it => isFinite(it.r) && (it.st === 'pass' || it.st === 'fail'))); o.cf = cf.length ? Math.max(...cf.map(it => it.r)) : undefined;
  const A = AN.analyzeGirder(P, g), Sp = W.SBDSplices.girder(P, g, A, { env: W.SBDSplicesUI.envOf(P) });
  const sp = Sp.list.flatMap(s => (s.CK || []).filter(c => /^(TF|BF)[1245]$|^WS[1245]$/.test(c.id)).flatMap(c => c.items.filter(it => it.r != null && isFinite(it.r)))); o.spl = sp.length ? Math.max(...sp.map(it => it.r)) : undefined;
  const Wd = W.SBDWeldsUI.build({ P, g, src: 'analysis' }); assert.ok(!Wd.err, Wd.err);
  const wd = Wd.C.flatMap(c => c.items.filter(it => typeof it.r === 'number' && isFinite(it.r))); o.wd = wd.length ? Math.max(...wd.map(it => it.r)) : undefined;
  const dl = (A.lld || []).filter(q => q.status !== 'na'); o.defl = dl.length ? Math.max(...dl.map(q => q.d / q.lim)) : undefined;
  return o;
}

function summaryOf(P) {
  const list = P.girders.map((_, gi) => { const parts = {}; S.MODS.forEach(m => { parts[m.k] = S.run(P, gi, m.k); }); return S.cells(P, gi, parts); });
  return { list, ov: S.overall(P, list) };
}

for (const [name, mk] of [['default project', () => W.SBDModel.defaultProject()], ['skewed three-span, two girders', skewed]]) {
  test(`Summary: every cell equals the module's own governing value (${name})`, () => {
    const P = mk(), t0 = Date.now(), { list, ov } = summaryOf(P), t1 = Date.now();
    let n = 0;
    list.forEach((G, gi) => {
      const o = own(P, gi);
      S.COLS.forEach(c => {
        const q = G.cells[c.id]; assert.ok(q, `${G.label} ${c.id}: no cell`);
        if (o[c.id] === undefined) { assert.equal(q.st, 'na', `${G.label} ${c.id}: the module has no value, the cell is ${q.st}`); return; }
        assert.notEqual(q.st, 'notrun'); assert.notEqual(q.st, 'na', `${G.label} ${c.id}: ${q.why}`);
        const v = c.rf ? q.rf : q.r; assert.ok(Object.is(v, o[c.id]), `${G.label} ${c.id}: Summary ${v} vs module ${o[c.id]}`);
        assert.equal(q.st, c.rf ? (v < 1 - 1e-9 ? 'fail' : 'pass') : !isFinite(v) ? 'review' : v > 1 + 1e-9 ? 'fail' : q.st === 'review' ? 'review' : 'pass', `${G.label} ${c.id} status`);
        assert.equal(q.tab, c.tab); assert.ok(q.step, `${G.label} ${c.id}: a step to link to`);
        n++;
      });
      // the Flexure tab's own governing ratio is the largest of the three flexure columns
      assert.ok(Object.is(Math.max(gr(G.cells.flexStr.r), gr(G.cells.flexSvc.r), gr(G.cells.flexProp.r)), gr(o.flexGov)), `${G.label}: flexure governing ${o.flexGov}`);
    });
    // the verdict: the counts are the cells' statuses; the governing check is the largest ratio of any cell
    const all = list.flatMap(G => Object.values(G.cells));
    ['pass', 'fail', 'review'].forEach(k => assert.equal(ov.n[k], all.filter(q => q.st === k).length));
    const big = Math.max(...all.filter(q => q.r != null && isFinite(q.r)).map(q => q.r));
    assert.ok(Object.is(ov.top.q.r, big)); assert.equal(ov.nan.length, all.filter(q => q.r != null && !isFinite(q.r)).length); assert.equal(ov.verdict, ov.n.fail ? 'FAIL' : ov.n.review ? 'REVIEW' : 'PASS');
    console.log(`       ${P.girders.length} girder(s), ${n} cells equal; ${ov.n.fail} FAIL, ${ov.n.review} REVIEW, ${ov.n.pass} PASS; governing ${ov.top.c.id} ${ov.top.G.label} ${ov.top.q.r.toFixed(3)}; not a number: ${ov.nan.map(z => z.c.id + ' ' + z.G.label).join(', ') || 'none'}; ${t1 - t0} ms`);
  });
}

test('Summary: a module not run is "not run"; the Report rows are the same values', () => {
  const P = W.SBDModel.defaultProject(), G = S.cells(P, 0, { shear: S.run(P, 0, 'shear') });
  assert.equal(G.cells.flexStr.st, 'notrun'); assert.equal(G.cells.rtInv.st, 'notrun'); assert.ok(['pass', 'fail', 'review'].includes(G.cells.shear.st));
  // the Report's every-girder rows (govRows) carry the same values for the groups the Summary takes whole
  const B = W.SBDReportData.compute(P, 0, { src: 'analysis' }), rows = W.SBDReportBuild.govRows(B).rows, full = summaryOf(P).list[0];
  const r = g => rows.find(q => q.grp === g);
  assert.ok(Object.is(full.cells.cn.r, r('Constructibility (deck placement)').r)); assert.ok(Object.is(full.cells.cf.r, r('Cross-frames').r));
  assert.ok(Object.is(full.cells.spl.r, r('Field splices').r)); assert.ok(Object.is(full.cells.rtInv.rf, r('Rating: Inventory RF').rf));
  assert.ok(Object.is(full.cells.studs.r, r('Fatigue & studs: Studs').r));
});
