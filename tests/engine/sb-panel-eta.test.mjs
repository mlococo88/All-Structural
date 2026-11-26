// Steel Bridge "Web panels" shear check with the owner's load modifiers (sb-panel-eta PR, 2026-11-25; CLAUDE.md §4).
//
// Before: ui/shear.js geom() called SBDShear.demands(pl) without factors, so each panel's V_u (dem.vu) took the plain AASHTO
// Strength I factors 1.25 / 1.50 / 1.75, while the station checks (GS11) took the owner's η and m (SBDShear.factorsOwner).
// After: geom() passes the station checks' factors G (factorsOwner(lf)), so the panel V_u is factored exactly as the stations'.
//
// 1. Hand check, a made-up RIDOT bridge built here (80 ft simple span, 5 girders at 8 ft, web 42 x 7/16 in, stiffened at
//    d_o/D = 1.5, η_I = 1.05 entered: η = 1.05, m = 1.2): the end panel 0–5 ft, V_u = 1.3125(V_DC1 + V_DC2) + 1.575 V_DW +
//    2.205 V_LL+IM = the station GS11 V_u at x = 0.01 ft; the ratio equals GS11's; the worked step shows the equation and the values.
// 2. η = 1 and m = 1 (owner AASHTO, the same bridge): the panel V_u is the AASHTO-factored value, the same numbers as before
//    (factorsOwner with η = m = 1 gives exactly factors()).
// 3. Pedestrian load: m stays off the pedestrian part of the panel V_u (GD45), as at the stations.
// 4. Every other caller of SBDShear.demands keeps its demands (the transverse and bearing stiffener rows take unfactored shears).
// 5. The report's panel steps link to where η and m are worked (Project and owner, Owner load rules): every link resolves.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const W = loadShared(...['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'report.js', 'dxf.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/proportions.js', 'engine/flexure.js',
  'engine/owners.js', 'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js',
  'engine/crossframes.js', 'engine/constructibility.js', 'engine/splices.js', 'engine/rating.js', 'engine/autodesign.js', 'engine/drawings.js', 'ui/flexure.js', 'ui/loads.js', 'ui/shear.js',
  'ui/fatigue.js', 'ui/framing.js', 'ui/rating.js', 'ui/splices.js', 'ui/constructibility.js', 'engine/welds.js', 'ui/welds.js', 'engine/sheets.js', 'ui/deflection.js', 'ui/graphics.js', 'ui/gfxa.js',
  'report/data.js', 'report/builders.js', 'report/summary.js'].map(E)));
W.SBDReportData.install();
const SH = W.SBDShear, close = (a, b, what, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`);

/* the hand-check bridge (made up, built here from the app's new project) */
function proj(owner, o = {}) {
  const P = W.SBDModel.newProject();
  P.spans = { lengths: [80], continuity: 'simple' };
  P.xs.nb = 5; P.xs.bays = [8, 8, 8, 8]; P.xs.ohL = 3; P.xs.ohR = 3; P.xs.skews = [0, 0];
  P.ownerRules = { owner, eta: { D: 'no', R: 'auto', I: 'yes', eD: 1, eR: 1, eI: 1 } }; P.project.owner = owner;
  P.girders.forEach(g => { g.segments = [{ x0: 0, x1: 80, D: 42, tw: 0.4375, topB: 14, topT: 0.75, botB: 16, botT: 1.0 }]; g.beff = 96; });
  P.stiffeners.layout = { web: 'stiffened', mode: 'uniform', doRatio: 1.5, bays: [], frames: { Lb: 20 } };
  // 12 in thick: not mountable by the app's 12 in rule, so the pedestrian load acts with the vehicles (AASHTO 3.6.1.6) on this branch and
  // with claude/sb-ridot-curb (RIDOT BDM 3.4.1.1.1 two cases apply to a mountable sidewalk only); an 8 in sidewalk there takes case 1, no PL
  if (o.ped) { P.xs.sidewalks.L = { w: 6, t: 12, fence: null, fenceX: null }; P.xs.sidewalks.ped = 75; }
  return P;
}
const memo = new Map(), build = (owner, o = {}, gi = 0) => { const k = JSON.stringify([owner, o, gi]); if (!memo.has(k)) { const P = proj(owner, o), B = W.SBDShearUI.build({ P, g: gi, src: 'analysis' }); assert.ok(!B.err, B.err); memo.set(k, { P, B }); } return memo.get(k); };

test('hand check (RIDOT, η = 1.05, m = 1.2): the end panel V_u = 1.3125(V_DC1 + V_DC2) + 1.575 V_DW + 2.205 V_LL+IM, the station GS11 V_u', () => {
  const { B } = build('RIDOT'), lf = B.lf;
  close(lf.eta, 1.05, 'η'); close(lf.m, 1.2, 'm'); close(B.G.dc, 1.3125, 'γ_DC'); close(B.G.dw, 1.575, 'γ_DW'); close(B.G.ll, 2.205, 'γ_LL');
  const q = B.panels.rows[0]; assert.equal(q.p, 0); assert.equal(q.q, 5); assert.equal(q.end, true); assert.equal(q.d, 60);
  const s = B.stations.find(r => r.x < 0.02);   // x = 0.01 ft, in the end panel
  const hand = 1.3125 * (s.VDC1 + s.VDC2) + 1.575 * s.VDW + 2.205 * s.VLL;
  close(q.Vu, hand, 'panel V_u by hand', 1e-12); close(q.Vu, s.Vu, 'panel V_u = station V_u', 1e-12);
  // the numbers of the hand check (Analysis tab shears at the bearing, rounded): 46.35, 10.05, 7.00, 89.74 kip (DC1: steel, cross-frames, wet deck)
  close(s.VDC1, 46.348, 'V_DC1', 1e-4); close(s.VDC2, 10.050, 'V_DC2', 1e-4); close(s.VDW, 7.000, 'V_DW', 1e-4); close(s.VLL, 89.740, 'V_LL+IM', 1e-4);
  close(q.Vu, 282.92, 'V_u', 1e-4); close(q.phVn, 392.25, 'φV_n = V_cr (end panel)', 1e-4); close(q.r, 0.7213, 'ratio', 1e-4);
  close(q.r, s.gov.ratio, 'panel ratio = GS11 ratio', 1e-12);
  // before this PR the panel took 1.25 / 1.50 / 1.75: 238.04 kip, ratio 0.607
  const before = 1.25 * (s.VDC1 + s.VDC2) + 1.50 * s.VDW + 1.75 * s.VLL; close(before, 238.04, 'V_u before', 1e-4); close(before / q.phVn, 0.6069, 'ratio before', 1e-4);
  // the Shear tab's governing item is this panel (equal to the station, listed first)
  assert.equal(B.panels.gov, q);
});

test('worked step of the panel V_u: the equation, the factors with η and m substituted, the value; the station steps show 1.3125, not 1.31', () => {
  const { B } = build('RIDOT'), q = B.panels.rows[0], st = q.steps, v = st.find(x => x.id === 'pn.Vu');
  assert.ok(v, 'pn.Vu'); assert.match(v.eq, /\\gamma_\{DC\}\(V_\{DC1\} \+ V_\{DC2\}\) \+ \\gamma_\{DW\}V_\{DW\} \+ \\gamma_\{LL\}V_\{LL\+IM\}/);
  assert.match(v.sub, /1\.3125\(-46\.35 \+ \(-10\.05\)\) \+ 1\.5750\(-7\.00\) \+ 2\.2050\(-89\.74\)/, v.sub);
  assert.equal(v.value, q.Vu); assert.match(v.ref, /1\.3\.2\.1/); assert.match(v.note, /1\.75ηm/);
  assert.match(v.label, /x = 0\.00 ft, negative LL\+IM envelope/);
  const sv = B.stations.find(r => r.x < 0.02).steps.find(x => x.id === 'sh.Vu'); assert.match(sv.sub, /^1\.3125\(46\.35 \+ 10\.05\) \+ 1\.5750\(7\.00\) \+ 2\.205\(89\.74\)$/, sv.sub);
});

test('η = 1, m = 1 (AASHTO): the panel V_u is the AASHTO-factored value, identical to demands(pl) without factors (unchanged)', () => {
  const { B, P } = build('AASHTO'); close(B.lf.eta, 1, 'η'); close(B.lf.m, 1, 'm');
  const A = W.SBDShearUI.fromAnalysis(P, 0), d0 = SH.demands(A.pl), d1 = SH.demands(A.pl, B.G);
  assert.deepEqual(d1.VuE, d0.VuE);   // exact, every station
  B.panels.rows.forEach(q => assert.equal(q.Vu, d0.vu(q.p, q.q)));
  const s = B.stations.find(r => r.x < 0.02), q = B.panels.rows[0];
  close(q.Vu, 1.25 * (s.VDC1 + s.VDC2) + 1.50 * s.VDW + 1.75 * s.VLL, 'AASHTO panel V_u', 1e-12);
  assert.match(q.steps.find(x => x.id === 'pn.Vu').sub, /^\\left\|1\.25\(.*\) \+ 1\.50\(.*\) \+ 1\.75\(.*\)\\right\|$/);
});

test('pedestrian load (RIDOT, 75 psf on a 6 ft left sidewalk): m stays off the pedestrian part of the panel V_u, as at the stations (GD45)', () => {
  const { B } = build('RIDOT', { ped: true }, 1);   // the exterior girder type (line G1) carries the sidewalk
  const q = B.panels.rows[0], s = B.stations.find(r => r.x < 0.02), T = B.gm.dem.vuAt(q.p, q.q);
  assert.ok(Math.abs(T.q) > 1, `pedestrian part ${T.q}`); close(T.VLL, T.VLL0 - T.q + T.q / 1.2, 'V_LL used');
  close(q.Vu, s.VuP, 'panel V_u = station V_u (with the pedestrian part divided by m)', 1e-12);
  const st = q.steps; assert.ok(st.find(x => x.id === 'pn.pl'), 'the pedestrian step'); assert.ok(s.plAdj && s.plAdj.length, 'the station adjusts the same way');
  close(T.Vu, q.Vu, 'the terms give V_u', 1e-12);
});

test('the other callers of the shear demands are unchanged: the stiffener and bearing rows take unfactored shears (η, m in engine/stiffeners.js)', () => {
  const { P, B } = build('RIDOT'), A = W.SBDShearUI.fromAnalysis(P, 0), d0 = SH.demands(A.pl), SB = W.SBDStiffeners;
  const rows0 = SB.stiffenerRows(B.bays, d0.zAt, d0, { label: B.gm.gLab }), rows1 = SB.stiffenerRows(B.bays, B.gm.dem.zAt, B.gm.dem, { label: B.gm.gLab });
  assert.deepEqual(JSON.parse(JSON.stringify(rows1)), JSON.parse(JSON.stringify(rows0)));
  const x0 = B.gm.sup[0]; assert.deepEqual(B.gm.dem.reaction(x0), d0.reaction(x0)); assert.deepEqual(B.gm.dem.inPanel(0, 5), d0.inPanel(0, 5));
});

test('report: the panel and station steps link to η and m (Project and owner, Owner load rules); every link resolves', () => {
  const P = proj('RIDOT'), Bd = W.SBDReportData.compute(P, 0, { src: 'analysis' }), Md = W.SBDReportBuild.model(Bd, { detail: 'gov' }), doc = W.SharedReport.build(Md);
  assert.deepEqual(JSON.parse(JSON.stringify(doc.unresolved)), []);
  const sh = Md.sections.find(s => s.id === 'shear'), pan = sh.subs.find(q => q.id === 'pan'), st = sh.subs.find(q => q.id === 'st');
  [pan, st].forEach(q => assert.ok(q.items.some(it => it.type === 'note' && /\[\[own\.eta\]\]/.test(it.text) && /\[\[own\.m\]\]/.test(it.text)), q.id));
  const txt = W.SharedReport.text(doc); assert.match(txt, /with η \(see §\d+\.\d+\) and m \(see §\d+\.\d+\) of the owner load rules/);
  // a report without the Project and owner section: no link left dangling (the note is left out)
  const Md2 = W.SBDReportBuild.model(Bd, { detail: 'gov', include: { proj: false } }), doc2 = W.SharedReport.build(Md2);
  assert.deepEqual(JSON.parse(JSON.stringify(doc2.unresolved)), []);
});
