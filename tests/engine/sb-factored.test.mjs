// SBFD (2026-11-19): the factored diagrams of the Analysis tab and the Report (apps/steel-bridge/ui/factored.js; display only).
// 1. Every plotted value is the check demand at that design point: Strength I M_u max / min = the Flexure tab's M_u of the location and the
//    demand of its moment reversal check GS19 (M_u,opp); Service II = M_s; Fatigue I = γ_fat M_FAT± (GS17's moments); the Strength I shear = the
//    demand of GS11 at every Shear & stiffeners station; deck placement M_c = the Constructibility tab's (each sign case), V_u = GS16's demand.
//    Compared with independent builds of the tabs (the same path as each tab, its own analysis run), exactly (Object.is).
// 2. By hand at every location: M_u max = Σ γ_p(sign) M_i + γ_LL M_LL+IM+, min likewise with M_LL+IM−, with the factors of Tables 3.4.1-1/-2.
// 3. Factored reactions = envelopeStrI of the unfactored reactions; Strength I max = the bearing stiffeners' R_u where every component is ≥ 0.
// 4. Built-in example, the example at 28° skew, and the example with the RIDOT owner rules (η, m ≠ 1).
// 5. Report: the Analysis section has the factored subsection, its § references resolve, no duplicate keys, no NaN / undefined.
// 6. The tab card renders every view, with the work line and the links.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const FILES = ['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'report.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'engine/rating.js', 'ui/sub.js', 'ui/flexure.js', 'ui/loads.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/rating.js', 'ui/splices.js', 'ui/constructibility.js', 'engine/welds.js', 'ui/welds.js',
  'ui/factored.js', 'ui/analysis.js', 'engine/sheets.js', 'ui/deflection.js', 'report/data.js', 'report/builders.js'].map(E));
const W = loadShared(...FILES);
W.SBDReportData.install();   // one analysis per project state, as index.html

const PROJ = {
  builtin: () => W.SBDModel.defaultProject(),
  skew28: () => { const P = W.SBDModel.defaultProject(); P.xs.skews = P.xs.skews.map(() => 28); return P; },
  ridot: () => { const P = W.SBDModel.defaultProject(); P.ownerRules = { ...(P.ownerRules || {}), owner: 'RIDOT', eta: {} }; return P; } };
const near = (a, b, tol) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const CASES = new Map();
function run(name) {
  if (CASES.has(name)) return CASES.get(name);
  const P = PROJ[name](), R = W.SBDAnalysis.analyzeGirder(P, 0);
  assert.ok(!(R.errors && R.errors.length), JSON.stringify(R.errors));
  const F = W.SBDFactoredUI.compute(P, 0, R);
  assert.equal(JSON.stringify(F.err), '{}', name);
  // independent builds of the tabs (new objects: the tabs' own path)
  const FX = W.SBDFlexureUI.build({ P, g: 0, src: 'analysis', method: 'auto' }), SH = W.SBDShearUI.build({ P, g: 0, src: 'analysis' }), CN = W.SBDConstrUI.build({ P, g: 0, src: 'project' });
  assert.ok(!FX.err && !SH.err && !CN.err, FX.err || SH.err || CN.err);
  const o = { P, R, F, FX, SH, CN }; CASES.set(name, o); return o;
}
const byX = rows => rows.map((r, i) => ({ r, i })).sort((a, b) => a.r.x - b.r.x || a.i - b.i).map(q => q.r);

for (const name of Object.keys(PROJ)) {
  test(`${name}: plotted Strength I, Service II and Fatigue I moments = the Flexure tab's demands at every location`, () => {
    const { F, FX } = run(name), rows = byX(FX.rows);
    assert.equal(F.M.x.length, rows.length);
    let n = 0;
    rows.forEach((r, i) => {
      assert.ok(Object.is(F.M.x[i], r.x), `x ${i}`);
      const mU = r.pos ? F.M.max[i] : F.M.min[i], mO = r.pos ? F.M.min[i] : F.M.max[i];
      assert.ok(Object.is(mU, r.Mu), `${name} ${r.name}: M_u plotted ${mU} vs check ${r.Mu}`);
      const rev = r.checks.find(c => c.id === 'GS19');
      assert.ok(Object.is(mO, rev.demand), `${name} ${r.name}: M_u,opp plotted ${mO} vs GS19 ${rev.demand}`);
      assert.ok(Object.is(F.M.sv[i], r.Ms), `${name} ${r.name}: M_s`);
      assert.ok(Object.is(F.M.fP[i], r.gfat * r.MfP) && Object.is(F.M.fN[i], r.gfat * r.MfN), `${name} ${r.name}: fatigue`);
      assert.ok(F.M.max[i] >= F.M.min[i] - 1e-9, `${name} ${r.name}: max ≥ min`);
      n++; });
    console.log(`       ${name}: ${n} locations, M_u max ${Math.max(...F.M.max).toFixed(1)}, min ${Math.min(...F.M.min).toFixed(1)} kip-ft`);
  });

  test(`${name}: M_u max / min by hand from the unfactored moments (Tables 3.4.1-1, 3.4.1-2)`, () => {
    const { F } = run(name), G = F.M.G;
    F.M.rows.forEach((r, i) => {
      const g = (M, s) => (s * M >= 0 ? 1 : 0), fac = (M, mx, mn, s) => (g(M, s) ? mx : mn) * M;
      const one = (s, LL) => fac(r.MDC1, G.dc, G.dcMin, s) + fac(r.MDC2, G.dc, G.dcMin, s) + fac(r.MDW, G.dw, G.dwMin, s) + G.ll * LL + fac(r.MUT, G.dw, G.dwMin, s) + (s * r.MUF >= 0 ? G.dc * r.MUF : 0);
      assert.ok(near(F.M.max[i], one(1, r.MLLp), 1e-12), `${name} ${r.name}: max ${F.M.max[i]} vs ${one(1, r.MLLp)}`);
      assert.ok(near(F.M.min[i], one(-1, r.MLLn), 1e-12), `${name} ${r.name}: min ${F.M.min[i]} vs ${one(-1, r.MLLn)}`);
      assert.ok(near(F.M.sv[i], r.MDC1 + r.MDC2 + r.MDW + G.sll * (r.pos ? r.MLLp : r.MLLn) + r.MUT + r.svU * r.MUF, 1e-12), `${name} ${r.name}: M_s`);
    });
    if (name === 'ridot') assert.ok(G.own.eta !== 1 || G.own.m !== 1, 'RIDOT: owner factors applied');
  });

  test(`${name}: plotted shears = the Shear & stiffeners tab's GS11, GS18 demands; deck placement = the Constructibility tab's`, () => {
    const { F, SH, CN } = run(name), st = byX(SH.stations);
    assert.equal(F.V.x.length, st.length);
    st.forEach((r, i) => { const c = r.checks.find(q => q.id === 'GS11');
      assert.ok(Object.is(F.V.x[i], r.x) && Object.is(F.V.Vck[i], c.demand), `${name} ${r.name}: V_u ${F.V.Vck[i]} vs GS11 ${c.demand}`);
      assert.ok(Object.is(F.V.Vu[i], r.Vu) && Object.is(F.V.VuF[i], r.VuF) && Object.is(F.V.Vf[i], r.G.fat * r.Vf), `${name} ${r.name}: V`); });
    const cr = byX(CN.rows);
    assert.equal(F.C.x.length, cr.length);
    cr.forEach((r, i) => { const ms = r.cases ? r.cases.map(q => q.Mc) : [r.Mc];
      assert.ok(Object.is(F.C.max[i], Math.max(...ms)) && Object.is(F.C.min[i], Math.min(...ms)) && ms.includes(r.Mc), `${name} ${r.name}: M_c`);
      const v = r.checks.find(q => q.id === 'GS16'); if (v && isFinite(v.demand)) assert.ok(Object.is(F.C.V[i], v.demand), `${name} ${r.name}: GS16 ${F.C.V[i]} vs ${v.demand}`); });
  });

  test(`${name}: factored reactions from the unfactored reactions; Strength I max = the bearing stiffeners' R_u`, () => {
    const { F, R } = run(name), G = F.M.G;
    assert.equal(F.Rx.length, R.sup.length);
    F.Rx.forEach((q, k) => {
      const e = W.SBDFlexure.envelopeStrI({ DC1: R.st.DC1.R[k], DC2: R.st.DC2.R[k], DW: R.st.DW.R[k], LLp: R.llR[k].max, LLn: R.llR[k].min, UT: 0, UF: 0 }, G);
      assert.ok(Object.is(q.max, e.max) && Object.is(q.min, e.min), `${name} ${q.name}`);
      assert.ok(near(q.svMax, R.st.DC1.R[k] + R.st.DC2.R[k] + R.st.DW.R[k] + G.sll * R.llR[k].max, 1e-12), `${name} ${q.name}: Service II`);
      if (q.Ru != null && [R.st.DC1.R[k], R.st.DC2.R[k], R.st.DW.R[k]].every(v => v >= 0)) assert.ok(near(q.max, q.Ru, 1e-9), `${name} ${q.name}: ${q.max} vs R_u ${q.Ru}`);
    });
    if (name === 'builtin') assert.ok(F.Rx.every(q => q.Ru != null), 'every support has a bearing stiffener R_u');
  });
}

test('Check case (built-in example): one station by hand = plotted = check demand', () => {
  const { F, FX, R } = run('builtin');
  const i = F.M.max.reduce((b, v, j) => (v > F.M.max[b] ? j : b), 0), r = F.M.rows[i], G = F.M.G;
  const k = R.x.findIndex(x => Math.abs(x - r.x) < 1e-9);
  assert.ok(k >= 0, 'the governing location is an analysis station');
  assert.ok(Object.is(R.st.DC1.M[k], r.MDC1) && Object.is(R.st.DC2.M[k], r.MDC2) && Object.is(R.st.DW.M[k], r.MDW) && Object.is(R.ll.Mpos[k], r.MLLp), 'the station table values are the check\'s');
  const hand = 1.25 * r.MDC1 + 1.25 * r.MDC2 + 1.50 * r.MDW + 1.75 * r.MLLp;
  assert.ok(near(hand, F.M.max[i], 1e-12) && Object.is(F.M.max[i], r.Mu));
  console.log(`       x = ${r.x} ft: M_DC1 ${r.MDC1.toFixed(2)}, M_DC2 ${r.MDC2.toFixed(2)}, M_DW ${r.MDW.toFixed(2)}, M_LL+IM+ ${r.MLLp.toFixed(2)}, M_LL+IM- ${r.MLLn.toFixed(2)} kip-ft;`
    + ` 1.25(${r.MDC1.toFixed(2)}) + 1.25(${r.MDC2.toFixed(2)}) + 1.50(${r.MDW.toFixed(2)}) + 1.75(${r.MLLp.toFixed(2)}) = ${hand.toFixed(2)} = plotted ${F.M.max[i].toFixed(2)} = check M_u ${r.Mu.toFixed(2)};`
    + ` min ${F.M.min[i].toFixed(2)} (GS19 ${r.Mrev.toFixed(2)}), M_s ${r.Ms.toFixed(2)}; γ ${G.dc}/${G.dcMin}, ${G.dw}/${G.dwMin}, ${G.ll}, ${G.sll}`);
  const j = F.M.min.reduce((b, v, q) => (v < F.M.min[b] ? q : b), 0), s = F.M.rows[j];
  console.log(`       min at x = ${s.x} ft (${s.pos ? 'pos' : 'neg'}): M_DC1 ${s.MDC1.toFixed(2)}, M_DC2 ${s.MDC2.toFixed(2)}, M_DW ${s.MDW.toFixed(2)}, M_LL+IM- ${s.MLLn.toFixed(2)};`
    + ` γ ${s.gm.DC1}, ${s.gm.DC2}, ${s.gm.DW} -> ${F.M.min[j].toFixed(2)} = check M_u ${s.Mu.toFixed(2)}`);
});

test('Report: the Analysis section has the factored subsection; its references resolve; no duplicate keys; no NaN', () => {
  const P = W.SBDModel.defaultProject(), B = W.SBDReportData.compute(P, 0);
  const M = W.SBDReportBuild.model(B, { detail: 'gov' }), an = M.sections.find(s => s.id === 'an');
  const sub = an.subs.find(q => q.id === 'fdg');
  assert.ok(sub, 'factored subsection');
  assert.equal(sub.items.filter(it => it.type === 'figure').length, 5);
  assert.ok(sub.items.filter(it => it.type === 'steps').length >= 4);
  const doc = W.SharedReport.build(M);
  assert.deepEqual(JSON.parse(JSON.stringify(doc.unresolved)), []);
  assert.deepEqual(JSON.parse(JSON.stringify(doc.dup)), []);
  const txt = W.SharedReport.text(doc), part = txt.slice(txt.indexOf('Factored moment and shear diagrams'));
  assert.ok(!/NaN|undefined/.test(part.slice(0, 20000)), 'no NaN / undefined');
  assert.match(part, /§\d+\.\d+/);
  // the report's subsection takes the same values as the tab's compute
  const F = W.SBDFactoredUI.compute(P, 0, B.an), F2 = W.SBDFactoredUI.compute(P, 0, B.an, { flex: B.flex, shear: B.shear, cn: B.cn });
  assert.deepEqual([F.M.max, F.M.min, F.V.Vck, F.C.max], [F2.M.max, F2.M.min, F2.V.Vck, F2.C.max]);
});

test('Tab card: every view renders, with the work line, the factors and the links', () => {
  const { F } = run('builtin');
  const chart = W.SBDAnalysisUI.chart;
  W.SBDFactoredUI.VIEWS.forEach(([v]) => { const h = W.SBDFactoredUI.card(F, { view: v, chart });
    assert.match(h, /<svg/); assert.match(h, /<circle/); assert.match(h, /data-gotab="(flex|shear|cn)"/); assert.ok(!/NaN|undefined/.test(h), v);
    assert.match(h, /Worked at x = /); });
  const h = W.SBDFactoredUI.card(F, { view: 'strI', chart });
  assert.match(h, /3\.4\.1-2/); assert.match(h, /1\.25 max \/ 0\.90 min/); assert.match(h, /Strength I max/);
  assert.match(h, /id="an_fac"/);
});
