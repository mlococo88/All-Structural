// apps/steel-bridge/ui/deflection.js (the Deflection output tab, DEFL 2026-11-09) and the report's Deflection section: display only.
// Every value the tab and the report show is the girder analysis' own (engine/analysis.js analyzeGirder: R.lld, R.camber, R.df,
// R.steps): checked on the built-in project and on a skewed three-span project with an owner rule (RIDOT, sidewalk: L/1000).
//   - LL deflection per span: Δ_LL, Δ_lim, g_Δ, per-lane value, x, case, L/… and status are the engine's (same numbers), D/C = Δ_LL/Δ_lim;
//   - dead-load components at every station are the engine's arrays; at a tenth point that is a station, the engine's value exactly;
//     every tenth-point value is SBDSheets.at (the Drawings' camber table); the largest total per span is the engine's step an.camber.s<k>;
//   - the report's Deflection section: the same values; its steps are the engine's an.defl.* / an.camber.* steps, the Analysis section
//     keeps the others; every reference resolves.
//   node tests/engine/run.mjs deflection-tab   (or: node tests/engine/deflection-tab.test.mjs)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test, loadShared, ROOT } from './harness.mjs';

const SB = path.join(ROOT, 'apps/steel-bridge');
const SK = /view3d|ui\/report|ui\/drawings|ui\/graphics|ui\/gfxa|ui\/tabgraphics|ui\/legacy|autodesign/;
const FILES = [...fs.readFileSync(path.join(SB, 'index.html'), 'utf8').matchAll(/(?:<script src="|^ *')((?!http)[^"'?]+\.js)["']/gm)].map(m => path.resolve(SB, m[1])).filter(f => !SK.test(f));

function check(W, P, gi, nm) {
  const AN = W.SBDAnalysis, DU = W.SBDDeflectionUI, SH = W.SBDSheets;
  const R = AN.analyzeGirder(P, gi); assert.ok(!(R.errors && R.errors.length), `${nm}: ${R.errors}`);
  const R2 = AN.analyzeGirder(JSON.parse(JSON.stringify(P)), gi);   // an independent run: the engine's numbers are reproducible
  const Mo = DU.model(R);
  // live load deflection
  assert.equal(Mo.ll.length, R.spans.length, `${nm}: one row per span`);
  Mo.ll.forEach((q, k) => { const e = R.lld[k], e2 = R2.lld[k];
    for (const key of ['k', 'L', 'x', 'gD', 'perLane', 'case', 'd', 'lim', 'ratio', 'pref', 'limP', 'status', 'ok']) assert.equal(q[key], e[key], `${nm} span ${k + 1} ${key}`);
    assert.equal(q.d, e2.d, `${nm} span ${k + 1}: Δ_LL reproducible`);
    assert.equal(q.dc, e.d / e.lim, `${nm} span ${k + 1}: D/C`);
    assert.equal(q.gD, R.df.spans[k].gDef, `${nm} span ${k + 1}: g_Δ`);
    const st = R.steps.find(s => s.id === 'an.defl.LL' + (k + 1)); assert.equal(st.value, q.d, `${nm}: step an.defl.LL${k + 1}`);
    const sl = R.steps.find(s => s.id === 'an.defl.lim' + (k + 1)); assert.equal(sl.value, q.lim, `${nm}: step an.defl.lim${k + 1}`); });
  // dead-load deflections
  const c = R.camber;
  Mo.comps.forEach(o => assert.equal(o.y, c[o.k], `${nm}: ${o.k} is the engine's array`));
  assert.equal(JSON.stringify(Mo.comps.map(o => o.k)), JSON.stringify(['steel', 'wet', 'sd', ...(c.ut ? ['ut'] : [])]));
  assert.equal(Mo.total, c.total);
  c.x.forEach((_, i) => { const s = Mo.comps.reduce((a, o) => a + o.y[i], 0); assert.ok(Math.abs(s - c.total[i]) < 1e-9, `${nm}: components add to the total at ${i}`); });
  assert.equal(Mo.pts.length, R.spans.length * 10 + 1, `${nm}: tenth points`);
  let exact = 0;
  Mo.pts.forEach(t => { [...Mo.comps.map(o => [o.k, o.y]), ['total', c.total]].forEach(([k, y]) => {
    assert.equal(t.v[k], SH.at(c.x, y, t.x), `${nm} ${t.k}/${t.q} ${k}: SBDSheets.at`);
    if (t.node >= 0) { assert.ok(Math.abs(t.v[k] - y[t.node]) <= 1e-12 * Math.max(1, Math.abs(y[t.node])), `${nm} ${t.k}/${t.q} ${k}: the engine value at the station`); } });
    if (t.node >= 0) exact++; });
  Mo.max.forEach(m => { const st = R.steps.find(s => s.id === 'camber.s' + (m.k + 1) || s.id === 'an.camber.s' + (m.k + 1)); assert.equal(st.value, m.total, `${nm}: camber step span ${m.k + 1}`); assert.equal(m.total, c.total[m.i]); });
  // the Analysis tab's one line
  const S = DU.summary(R); assert.equal(S.top.dc, Math.max(...Mo.ll.filter(q => q.status !== 'na').map(q => q.dc))); assert.equal(S.cm.total, Math.max(...Mo.max.map(m => m.total)));
  // the report: Deflection section after Analysis, the engine's values, every reference resolved
  const B = W.SBDReportData.compute(P, gi, { src: 'analysis' }), M = W.SBDReportBuild.model(B, { detail: 'gov' });
  const ids = M.sections.map(s => s.id); assert.equal(ids.indexOf('defl'), ids.indexOf('an') + 1, `${nm}: Deflection after Analysis`);
  const D = M.sections.find(s => s.id === 'defl'), A = M.sections.find(s => s.id === 'an');
  const stepIds = sec => sec.subs.flatMap(q => q.items.filter(it => it.type === 'steps').flatMap(it => it.steps.map(s => s.id)));
  assert.ok(stepIds(D).length > 0 && stepIds(D).every(id => /^an\.(defl\.|camber)/.test(id)), `${nm}: Deflection steps`);
  assert.ok(stepIds(A).every(id => !/^an\.(defl\.|camber)/.test(id)), `${nm}: Analysis steps without deflection`);
  assert.equal(stepIds(D).length + stepIds(A).length, B.an.steps.length, `${nm}: every analysis step once`);
  const llT = D.subs.find(q => q.id === 'd').items.find(it => it.type === 'table');
  llT.rows.forEach((r, k) => { assert.equal(r[6].t, W.SharedUnits.fmt(R.lld[k].d, 3)); assert.equal(r[7].t, W.SharedUnits.fmt(R.lld[k].lim, 3)); assert.equal(r[6].key, 'an.defl.LL' + (k + 1)); });
  const doc = W.SharedReport.build(M); assert.equal(doc.unresolved.length, 0, `${nm}: ${JSON.stringify(doc.unresolved.slice(0, 3))}`);
  assert.ok(!/NaN|undefined|\[object/.test(W.SharedReport.text(doc)), `${nm}: bad text`);
  // Deflection left out: the Analysis note's links go; Analysis left out: the Deflection section still resolves
  for (const inc of [{ defl: false }, { an: false }]) { const d2 = W.SharedReport.build(W.SBDReportBuild.model(B, { include: inc })); assert.equal(d2.unresolved.length, 0, `${nm} ${JSON.stringify(inc)}`); }
  return { R, Mo, exact };
}

test('Deflection tab and report section show the engine\'s values (built-in project; skewed 3-span, RIDOT with sidewalk)', () => {
  const W = loadShared(...FILES), M = W.SBDModel, J = o => JSON.parse(JSON.stringify(o));
  const P = J(M.defaultProject());
  const a = check(W, P, 0, 'built-in');
  const out = a.Mo.ll.map(q => `span ${q.k + 1}: Δ_LL ${q.d.toFixed(3)} in vs L/${q.ratio} ${q.lim.toFixed(3)} in (D/C ${q.dc.toFixed(3)}, ${q.status})`).join('; ');
  console.log(`  built-in: ${out}; camber ${a.Mo.max.map(m => `span ${m.k + 1} ${m.total.toFixed(3)} in at ${m.x.toFixed(1)} ft`).join(', ')}; tenth points on stations ${a.exact}/${a.Mo.pts.length}`);
  const Q = J(M.defaultProject()); Q.xs = Q.xs || M.defaultXs(Q); Q.xs.skews = Q.xs.skews.map(() => 35); Q.spans.lengths = [105, 150, 105];
  Q.ownerRules.owner = 'RIDOT'; Q.analysis = { ...(Q.analysis || {}), deflSidewalk: 'yes', crack: '15' };
  const b = check(W, Q, Math.min(1, Q.girders.length - 1), 'skewed');
  assert.ok(b.Mo.ll.every(q => q.ratio === 1000), 'RIDOT with pedestrians: L/1000');
  assert.ok(b.Mo.pts.some(t => t.node < 0), 'skewed: some tenth points between stations (105 ft spans)');
  assert.ok(b.R.crack.length > 0, 'cracked zones');
  console.log(`  skewed: ${b.Mo.ll.map(q => `span ${q.k + 1} Δ_LL ${q.d.toFixed(3)} / ${q.lim.toFixed(3)} in`).join('; ')}`);
});

// DFG (2026-11-09): every cross-section girder line G1…Gn is selectable; each is analysed with its own dead loads (loads module line j) on
// the plates of its plate girder, by the same engine call (analyzeGirder with "Cross-section girder" = j in a copy); a plate girder's own
// line is the plain analyzeGirder(P, pg) (G1 unchanged); every line's camber (ll: false) equals that line's full analysis camber.
test('Deflection tab: every girder line, its own dead loads; the plate girder\'s own line unchanged; the camber of every girder', () => {
  const W = loadShared(...FILES), M = W.SBDModel, AN = W.SBDAnalysis, DU = W.SBDDeflectionUI, J = o => JSON.parse(JSON.stringify(o)), js = JSON.stringify;
  for (const [nm, P] of [['built-in', J(M.defaultProject())], ['two plate girders', (() => { const Q = J(M.defaultProject()); const e = J(Q.girders[0]); e.id = 'GE'; e.label = 'GE'; e.position = 'exterior'; e.beff = 96; e.line = 0; Q.girders.push(e); return Q; })()]]) {
    const nb = DU.nbOf(P); assert.equal(nb, 5, nm);
    const own = AN.lineOf(P, P.girders[0]), r0 = DU.lineRun(P, own);
    assert.equal(r0.own, true); assert.equal(js(r0.R.camber), js(AN.analyzeGirder(P, 0).camber), `${nm}: own line = analyzeGirder(P, 0)`); assert.equal(js(r0.R.lld), js(AN.analyzeGirder(P, 0).lld));
    const A = DU.allLines(P); assert.equal(A.length, nb);
    const mid = [];
    for (let j = 0; j < nb; j++) {
      const r = DU.lineRun(P, j), pg = DU.plateOf(P, j), g = P.girders[pg]; assert.equal(r.pg, pg);
      const Q = J(P); if (!r.own) Q.girders[pg].line = j;
      const R = AN.analyzeGirder(r.own ? P : Q, pg), mod = AN.moduleOf(r.own ? P : Q, pg);
      assert.equal(js(r.R.camber), js(R.camber), `${nm} G${j + 1}: the engine call`);
      assert.equal(mod.j, j, `${nm} G${j + 1}: loads module line`);
      assert.equal(r.R.loads.DC1wet, mod.G.DC1, `${nm} G${j + 1}: its own DC1 wet`); assert.equal(r.R.loads.DC2, mod.G.DC2); assert.equal(r.R.loads.DW, mod.G.DW);
      assert.equal(js(A[j].camber), js(r.R.camber), `${nm} G${j + 1}: overview camber = the line's analysis`);
      const Mo = DU.model(r.R); mid.push(Mo.pts.find(t => t.k === 1 && t.q === 5).v.total);
      if (nm === 'two plate girders' && j === 0) { assert.equal(pg, 1); assert.equal(r.own, true); assert.equal(r.R.girder.beff, 96); }
    }
    assert.ok(Math.abs(mid[0] - mid[1]) > 1e-3, `${nm}: exterior and interior cambers differ`);
    console.log(`  ${nm}: camber span 2 at 0.5L, G1…G${nb}: ${mid.map(v => v.toFixed(3)).join(', ')} in`);
    // the report: the camber of every girder
    const B = W.SBDReportData.compute(P, 0, { src: 'analysis' }), Mr = W.SBDReportBuild.model(B, { detail: 'gov' }), D = Mr.sections.find(s => s.id === 'defl');
    const T = D.subs.find(q => q.id === 'all').items.find(it => it.type === 'table'); assert.equal(T.head.length, nb + 2);
    const row = T.rows.find(r => r[0] === 'Span 2, 0.5L'); mid.forEach((v, j) => assert.equal(row[2 + j].t, W.SharedUnits.fmt(v, 3), `${nm}: report G${j + 1}`));
    assert.equal(W.SharedReport.build(Mr).unresolved.length, 0);
  }
});

