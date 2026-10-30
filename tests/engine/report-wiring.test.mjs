// Report wiring (2026-10-30, the PR after the Report tab #488): the Flexure tab's "This project's analysis" source, the default demand
// source of the output tabs, f_ℓ during deck placement saved in the project, the analysis cache of report/data.js and the every-girder
// report (report/builders.js govRows / allModel).
//
// 1. Flexure, this project's analysis: ui/flexure.js build({ src: 'analysis' }) equals the flexure of ui/rating.js build() (the Rating
//    tab's capacities) at every location: the same locations, M_u, M_s and every check's demand, capacity and ratio (exactly: the same
//    inputs through the same engine). In the report (data.js) the Flexure section is that module's result and the rating's capacity
//    links point at its locations (flexSame).
// 2. Default source: a complete project (SBDAnalysis.ready) → the Flexure, Shear and Fatigue tabs' builds use this project's analysis;
//    an incomplete one → the example. A choice made on the tab is kept.
// 3. Constructibility f_ℓ: P.constr.flC is validated by the model and used by the report (GS14 equal to engine/constructibility.js with
//    that f_ℓ; 0 when absent, as before).
// 4. The analysis cache: same project state → the same result object, not run again; the rating factors do not change the key; any
//    other change does; the cache is bounded.
// 5. Every girder: a two-girder project; each girder's summary rows equal its own report's; the controlling girder of each check group
//    is the one with the largest ratio (smallest RF); the girder's report afterwards does not run the analysis again.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const FILES = ['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'report.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'engine/rating.js', 'ui/flexure.js', 'ui/loads.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/rating.js', 'ui/splices.js', 'ui/constructibility.js', 'engine/welds.js', 'ui/welds.js',
  'report/data.js', 'report/builders.js'].map(E));
const J = v => JSON.parse(JSON.stringify(v));
const katex = (() => { const c = loadShared(path.join(ROOT, 'tests/libs/katex@0.16.9/dist/katex.min.js')); return c.katex; })();

/* one realm for the whole file: the analysis of each project state runs once (report/data.js cache; the modules' own calls go through it
   too, so tab-level builds in this test share it) */
const W = loadShared(...FILES);
const ORIG = W.SBDAnalysis.analyzeGirder;
let runs = 0;
const counted = (P, gi, o) => { runs++; return ORIG(P, gi, o); };
W.SBDAnalysis.analyzeGirder = (P, gi, o) => W.SBDReportData.analysis(P, gi, o, null, counted);

test('Flexure tab, this project\'s analysis: equal to the Rating tab\'s flexure at every location (built-in project)', () => {
  const P = W.SBDModel.defaultProject();
  const F = W.SBDFlexureUI.build({ P, g: 0, src: 'analysis', fl: 0, method: 'auto' }), R = W.SBDRatingUI.build({ P, g: 0, src: 'analysis' });
  assert.ok(!F.err && !R.err, F.err || R.err);
  assert.equal(F.rows.length, R.flex.rows.length);
  let nChk = 0, maxD = 0;
  F.rows.forEach((r, i) => { const q = R.flex.rows[i];
    assert.equal(r.name, q.name); assert.equal(r.x, q.x); assert.equal(r.pos, q.pos); assert.equal(r.Mu, q.Mu); assert.equal(r.Ms, q.Ms);
    assert.equal(r.checks.length, q.checks.length, r.name);
    r.checks.forEach((c, j) => { const d = q.checks[j]; assert.equal(c.id, d.id);
      ['demand', 'capacity', 'ratio'].forEach(k => { assert.ok(Object.is(c[k], d[k]), `${r.name} ${c.id} ${k}: ${c[k]} vs ${d[k]}`); if (isFinite(c[k])) maxD = Math.max(maxD, Math.abs(c[k] - d[k])); }); nChk++; }); });
  assert.equal(F.gov.gov.ratio, R.flex.gov.gov.ratio); assert.equal(F.gov.x, R.flex.gov.x);
  assert.ok(W.SBDReportData.sameFlex(F, R.flex));
  assert.match(F.what, /^This project's analysis of G1/);
  // the rating's governing flexure row is rated on these capacities: its location is a Flexure location
  const gi = R.sum.gov.inv, at = R.cap.get(gi); assert.ok(at && F.rows.some(r => r.x === at.x && r.name === at.name));
  // an f_ℓ entered on the tab enters the flexure (as with a file); 0 = the rating's
  const F2 = W.SBDFlexureUI.build({ P, g: 0, src: 'analysis', fl: 2, method: 'auto' }); assert.ok(F2.rows.every(r => r.fl === 2)); assert.ok(F.rows.every(r => r.fl === 0));
  console.log(`       ${F.rows.length} locations, ${nChk} checks equal (largest difference ${maxD}); governing ${F.gov.gov.id} ${F.gov.gov.ratio.toFixed(3)} at x = ${F.gov.x} ft; Inventory RF ${gi.inv.toFixed(3)} at ${at.name}`);
});

test('Report: the Flexure section is the Flexure module\'s result; the rating links its capacities there', () => {
  const P = W.SBDModel.defaultProject(), n0 = runs;
  const B = W.SBDReportData.compute(P, 0);
  assert.equal(JSON.stringify(B.err), '{}');
  assert.equal(B.flexSame, true);
  assert.notEqual(B.flex, B.rating.flex, 'the report\'s flexure comes from ui/flexure.js, not from the rating');
  const fx = new Set(B.flex.rows); let n = 0;
  B.rating.cap.forEach((r, q) => { if (q.kind === 'flex' || q.kind === 'svc' || q.kind === 'fat') { assert.ok(fx.has(r), q.name); n++; } });
  assert.ok(n > 0);
  const M = W.SBDReportBuild.model(B, { detail: 'gov' }), doc = W.SharedReport.build(M);
  assert.deepEqual(J(doc.unresolved), []);
  const row = M.gov.find(q => q.mod === 'Flexure'); assert.equal(row.r, B.flex.gov.gov.ratio); assert.equal(row.r, B.rating.flex.gov.gov.ratio);
  // the governing rating row's capacity is the Flexure section's location (linked there, not worked again in the rating section)
  const at = B.rating.cap.get(B.rating.sum.gov.inv), cap = (M.sections.find(s => s.id === 'rt').subs.find(q => q.id === 'cap') || { items: [] }).items;
  assert.ok(fx.has(at)); assert.ok(!cap.some(it => it.title === `Capacity: flexure at ${at.name}`), 'the governing capacity is not re-worked in the rating section');
  assert.ok(M.sections.find(s => s.id === 'flex').subs.some(q => q.id === 'flex@' + B.flex.rows.indexOf(at)), 'it is worked in the Flexure section');
  assert.equal(runs - n0, 1, 'the full analysis of this project state was cached by the first test: only the dead-load run (constructibility) is new');
});

test('Default demand source: this project\'s analysis when the project is complete, else the example', () => {
  const P = W.SBDModel.defaultProject();
  assert.deepEqual(J(W.SBDAnalysis.ready(P, 0)), { ok: true, why: [] });
  const F = W.SBDFlexureUI.build({ P, g: 0 }); assert.match(F.what, /^This project's analysis/);
  const SH = W.SBDShearUI.build({ P, g: 0 }); assert.match(SH.what, /^This project's analysis/);
  const FA = W.SBDFatigueUI.build({ P, g: 0 }); assert.match(FA.what, /^This project's analysis/);
  // incomplete: invalid analysis settings; no dead loads and no distribution factors
  const P2 = W.SBDModel.defaultProject(); P2.analysis = { deflLimit: -1 };
  const r2 = W.SBDAnalysis.ready(P2, 0); assert.equal(r2.ok, false); assert.match(r2.why.join(' '), /analysis settings/);
  assert.match(W.SBDFlexureUI.build({ P: P2, g: 0 }).what, /^Example/);
  assert.match(W.SBDShearUI.build({ P: P2, g: 0 }).what, /^Example/);
  assert.match(W.SBDFatigueUI.build({ P: P2, g: 0 }).what, /^Example/);
  const P3 = W.SBDModel.defaultProject(); P3.xs.nb = 1;   // the loads module fails: nothing entered either
  const r3 = W.SBDAnalysis.ready(P3, 0); assert.equal(r3.ok, false); assert.match(r3.why.join(' '), /No dead loads/); assert.match(r3.why.join(' '), /distribution factors/);
  P3.girders[0].loadsManual = { DC1wet: 1, DC2: 0.2, DW: 0.3 }; P3.girders[0].dfManual = { gM: 0.6, gV: 0.8, fatM: 0.4, fatV: 0.5 };
  assert.equal(W.SBDAnalysis.ready(P3, 0).ok, true, 'entered loads and factors complete the project');
  const P4 = W.SBDModel.defaultProject(); P4.girders[0].segments = []; assert.match(W.SBDAnalysis.ready(P4, 0).why.join(' '), /no plates/);
  // the caller's choice wins
  assert.match(W.SBDFlexureUI.build({ P, g: 0, src: 'example' }).what, /^Example/);
});

test('Constructibility f_ℓ: saved in the project (P.constr.flC), validated, used by the report', () => {
  const M = W.SBDModel, P = M.defaultProject();
  assert.equal(M.validate(P).errors.length, 0);
  P.constr = { flC: 'x' }; assert.ok(M.validate(P).errors.some(e => e.path === 'constr.flC'));
  P.constr = { flC: 2.5 }; assert.equal(M.validate(P).errors.length, 0);
  const rt = M.importJSON(M.exportJSON(P)); assert.ok(rt.ok, rt.error); assert.equal(rt.project.constr.flC, 2.5, 'kept through export / import');
  const C = W.SBDConstr, cn = (Q, fl) => { const AR = W.SBDAnalysis.analyzeGirder(Q, 0, { ll: false }), frA = W.SBDFraming.forGirder(Q, { gi: 0 }, null);
    const F = C.fromAnalysis(Q, 0, AR, { flC: fl, oh: { ...C.OH_DEF, ...((Q.constr && Q.constr.oh) || {}) }, braces: frA.braces }); return C.girder(F.locs, F.prj, { supports: F.supports, oh: F.oh }); };
  const B = W.SBDReportData.compute(P, 0, { want: { cn: true } }), ref = cn(P, 2.5), P0 = M.defaultProject(), B0 = W.SBDReportData.compute(P0, 0, { want: { cn: true } }), ref0 = cn(P0, 0);
  assert.equal(B.cn.govAll.ratio, ref.govAll.ratio); assert.equal(B0.cn.govAll.ratio, ref0.govAll.ratio);
  assert.ok(B.cn.govAll.ratio > B0.cn.govAll.ratio, 'f_ℓ = 2.5 ksi raises the governing deck-placement ratio');
  console.log(`       constructibility governing ratio: f_ℓ = 0 → ${B0.cn.govAll.ratio.toFixed(3)} (${B0.cn.govAll.check.id}); f_ℓ = 2.5 ksi → ${B.cn.govAll.ratio.toFixed(3)} (${B.cn.govAll.check.id})`);
});

test('Analysis cache: keyed by project state, girder and options; bounded', () => {
  const D = W.SBDReportData, P = W.SBDModel.defaultProject(), n0 = runs;
  const a = D.analysis(P, 0, { ll: false }, null, counted), b = D.analysis(P, 0, { ll: false }, null, counted);
  assert.equal(a, b); assert.equal(runs, n0, 'cached by the earlier tests (same project state)');
  P.rating = { phiC: 0.95, phiS: 1 }; assert.equal(D.analysis(P, 0, { ll: false }, null, counted), a, 'the rating factors are not in the key'); assert.equal(runs, n0);
  P.deck.haunch += 0.5; const c = D.analysis(P, 0, { ll: false }, null, counted); assert.notEqual(c, a); assert.equal(runs, n0 + 1, 'a changed project runs again');
  assert.equal(JSON.stringify(c), JSON.stringify(ORIG(P, 0, { ll: false })), 'the cached result is the analysis of that state');
  const max = 2 * P.girders.length + 4; for (let i = 0; i < max + 3; i++) { P.deck.haunch += 0.01; D.analysis(P, 0, { ll: false }, null, counted); }
  assert.ok(D.cache.size <= max, `cache size ${D.cache.size} ≤ ${max}`);
});

test('Every girder: governing ratio per girder per check group, the controlling girder marked; cached', () => {
  const M = W.SBDModel, P = M.defaultProject();
  // a second girder: the exterior girder of the cross-section, a thicker bottom flange in the positive regions
  const g2 = JSON.parse(JSON.stringify(P.girders[0])); g2.id = 'G2'; g2.label = 'G2'; g2.position = 'exterior'; g2.segments.forEach(s => { if (s.botT < 1.5) s.botT += 0.25; });
  P.girders.push(g2); assert.equal(M.validate(P).errors.length, 0);
  const t0 = Date.now(), n0 = runs, list = P.girders.map((g, gi) => { const B = W.SBDReportData.compute(P, gi), r = W.SBDReportBuild.govRows(B); return { gi, label: g.label, rows: r.rows, err: r.err, B }; });
  const t1 = Date.now(), nRun = runs - n0;
  list.forEach(G => assert.equal(JSON.stringify(G.err), '{}', G.label));
  list.forEach(G => assert.equal(G.B.flexSame, true, `${G.label}: the Flexure module equals the rating's flexure`));
  const AM = W.SBDReportBuild.allModel(P, list), doc = W.SharedReport.build(AM), txt = W.SharedReport.text(doc);
  assert.deepEqual(J(doc.unresolved), []); assert.deepEqual(J(doc.dup), []);
  assert.ok(!/NaN|undefined|\[object/.test(txt), 'bad text');
  // each group: the controlling girder is the largest ratio (smallest RF) of the girders' own summary values
  const grps = [...new Set(list.flatMap(G => G.rows.map(q => q.grp)))];
  assert.ok(grps.length >= 12, grps.join(' | '));
  grps.forEach(gp => { const v = list.map(G => { const q = G.rows.find(z => z.grp === gp); return q ? (q.rf != null ? q.rf : q.r) : NaN; }), rf = list.some(G => G.rows.some(z => z.grp === gp && z.rf != null));
    const best = v.reduce((b, x, i) => (isFinite(x) && (b < 0 || (rf ? x < v[b] : x > v[b])) ? i : b), -1), c = AM.ctl.get(gp);
    assert.equal(c.G, list[best], gp); });
  // the girders' rows are their reports' own values (flexure and inventory RF)
  list.forEach(G => { assert.equal(G.rows.find(q => q.mod === 'Flexure').r, G.B.flex.gov.gov.ratio); assert.equal(G.rows.find(q => q.grp === 'Rating: Inventory RF').rf, G.B.rating.sum.gov.inv.inv); });
  const top = list.flatMap(G => G.rows.filter(q => q.rf == null && isFinite(q.r)).map(q => ({ G, q }))).reduce((a, b) => (b.q.r > a.q.r ? b : a));
  assert.equal(AM.top.G, top.G); assert.match(txt, new RegExp(`Controlling girder: ${top.G.label}`));
  assert.match(txt, /◆/);
  // every $…$ parses
  const tex = new Set(); const grab = t => String(t == null ? '' : t).replace(/\$([^$]+)\$/g, (m, x) => { tex.add(x); return m; });
  AM.sections.forEach(s => s.subs.forEach(q => q.items.forEach(it => { grab(it.text); (it.head || []).forEach(grab); (it.rows || []).forEach(r => (Array.isArray(r) ? r : r.cells).forEach(c => grab(c && typeof c === 'object' ? c.t : c))); })));
  tex.forEach(t => assert.doesNotThrow(() => katex.renderToString(t, { throwOnError: true, strict: 'ignore' }), t));
  // cache: G1's analysis came from the earlier tests (same state as the built-in project + G2: a new key, so G1 runs once more), G2's
  // ran once; a second build of every girder, and the selected girder's report afterwards, run no analysis
  assert.ok(nRun <= 4, `analysis runs for 2 girders: ${nRun}`);
  const n1 = runs, t2 = Date.now(); P.girders.forEach((g, gi) => W.SBDReportData.compute(P, gi)); const t3 = Date.now();
  assert.equal(runs, n1, 'no analysis is run again');
  console.log(`       2 girders: ${grps.length} check groups; controlling girder ${top.G.label} (${top.q.mod}, ${top.q.r.toFixed(3)}); first build ${((t1 - t0) / 1000).toFixed(1)} s (${nRun} analysis runs), again ${((t3 - t2) / 1000).toFixed(1)} s (0 runs)`);
  grps.forEach(gp => console.log(`         ${gp}: ${list.map(G => { const q = G.rows.find(z => z.grp === gp); return q ? (q.rf != null ? 'RF ' + q.rf.toFixed(3) : q.r.toFixed(3)) : '—'; }).join(' / ')} → ${AM.ctl.get(gp).G.label}`));
});
