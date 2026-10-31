// The output-tab graphics (ui/graphics.js, engine/tabgraphics-b.js, ui/gfxa.js): no text overlaps another text, for the built-in project and the five
// hand-off payloads (tests/projects/st), every graphic of every tab; the ratio colour bands agree with the tables' own classes (green below 0.9, amber 0.9 to
// 1.0 inclusive, red above 1.0 or NG); every coordinate is finite. Presentation only: nothing here checks or changes a computed value.
// The text boxes are the Arial advance widths times the text height, from the baseline to the cap height (tests/engine/overlap.mjs).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { FILES as BFILES } from './gfx-fixture.mjs';
import { projectFromPayload, readPayload } from './an-fixture.mjs';
import { textOverlaps, swatchOverlaps, describe } from './overlap.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const W = loadShared(...BFILES, ...['ui/constructibility.js', 'ui/gfxa.js'].map(E));
const X = W.SharedDxf, M = W.SBDModel, GR = W.SBDGraphics, GA = W.SBDGfxA, GB = W.SBDTabGfxB, SEC = W.SBDSections, OWN = W.SBDOwners;
const J = o => JSON.parse(JSON.stringify(o));
const LIST = !!process.env.OVL_LIST, ONLY = (process.env.OVL_ONLY || '').split(',').filter(Boolean);   // OVL_ONLY=built-in,gd_xsA: a subset while working on the layouts

// a fake DOM slot, and a mount that records the graphics (as tests/engine/gfxa.test.mjs)
const made = [];
GR.mount = (el, build) => { const g = build(); assert.ok(g && !g.errors, 'graphic: ' + (g && g.errors)); made.push(g); return { select() {}, graphic: g }; };
const slot = () => ({ _h: '', set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h; }, querySelector: () => ({ addEventListener() {}, value: '' }), querySelectorAll: () => [] });
const run = (fn, o) => { made.length = 0; fn(slot(), o); return made.slice(); };

function secResult(P, gi, seg, region) {
  const g = P.girders[gi], s = g.segments[seg], G = M.GRADES, m = P.materials, d = P.deck, lf = OWN.loadFactors(P.ownerRules.owner, P.ownerRules.eta, P.xs.nb);
  const nr = SEC.modularRatio(m.concrete.fc, m.concrete.wcE > 0 ? m.concrete.wcE : m.concrete.wc, m.concrete.K1, m.concrete.nRule);
  const plates = { D: s.D, tw: s.tw, topB: s.topB, topT: s.topT, botB: s.botB, botT: s.botT };
  const deck = { composite: d.composite, ts: d.ts, haunch: OWN.haunchInProps(d.haunch, lf), beff: g.beff, rebar: d.rebar };
  const mat = { Fyt: G[m.steel.top].Fy, Fyb: G[m.steel.bot].Fy, Fyw: G[m.steel.web].Fy, Fyr: m.rebar.Fyr, fc: m.concrete.fc };
  return { g, s, nr, lf, c: SEC.card(plates, deck, mat, nr.n, { region, rebarInPositive: d.rebarInPositiveMp }) };
}
const PAY = [['gd_builtin28_AASHTO_G1.json', { nb: 5, bays: [9.5, 9.5, 9.5, 9.5], skews: [28, 28, 28, 28], spl: [82, 145, 215, 278] }], ['gd_builtin_CTDOT_G3.json', { nb: 4, bays: [10, 10.5, 10], skews: [0, 0, 0, 0], spl: [90, 270] }],
  ['gd_curb_MassDOT_G2.json', { nb: 6, bays: [8, 8, 8.5, 8, 8], skews: [15, 15, 15, 15], spl: [] }], ['gd_util_RIDOT_G4.json', { nb: 7, bays: [7.5, 7.5, 7.5, 7.5, 7.5, 7.5], skews: [35, 35, 35, 35], spl: [85, 275] }],
  ['gd_xsA_AASHTO_G5.json', { nb: 3, bays: [11, 11], skews: [10, 30, 40, 25], spl: [100, 260] }]];

/* every graphic of every output tab for one project: [{ what, D }] */
function allGraphics(P, name, pl) {
  const out = [], add = (what, g) => { assert.ok(g && g.D, `${name}: ${what} builds`); out.push({ what: `${name} / ${what}`, D: g.D }); };
  const src = pl ? {} : { src: 'analysis' };
  // Section properties, Loads & LLDF
  ['pos', 'neg'].forEach(region => ['steel', '3n', 'n'].forEach(cs => add(`section ${region} ${cs}`, GA.secGraphic(P, secResult(P, 0, 0, region), cs, 1))));
  const LD = W.SBDUiLoads.calc(P, 0); if (!(LD.errors && LD.errors.length)) LD.regions.forEach((rg, lr) => rg.members.forEach((m, lg) => { const g0 = GA.loadsGraphic(P, LD, lg, lr, ''); if (g0.errors) return; add(`loads G${lg + 1} r${lr}`, g0); g0.opts.forEach(([k]) => add(`loads G${lg + 1} r${lr} ${k}`, GA.loadsGraphic(P, LD, lg, lr, k))); }));
  // Analysis, Flexure, Constructibility
  const AR = W.SBDAnalysis.analyzeGirder(P, 0); if (!(AR.errors && AR.errors.length)) run(GA.analysis, { P, gi: 0, R: AR }).forEach((g, i) => add(`analysis ${i}`, g));
  const FX = W.SBDFlexureUI.build({ P, g: 0, ...src }); if (!FX.err) run(GA.flexure, { P, gi: 0, R: FX, sel: 0 }).forEach((g, i) => add(`flexure ${i}`, g));
  const CN = W.SBDConstrUI.build({ P, g: 0 }); if (!CN.err) run(GA.constr, { P, gi: 0, R: CN, sel: 0 }).forEach((g, i) => add(`constructibility ${i}`, g));
  // Shear, Fatigue, Cross-frames, Welds, Rating
  const SH = W.SBDShearUI.build({ P, g: 0, ...(pl ? { pl } : {}) }); if (!SH.err) { add('shear', GB.shear(SH, P, {})); add('shear detail', GB.shearDetail(SH, P, {})); add('shear detail B', GB.shearDetail(SH, P, { ts: 'B' })); SH.BS.rows.forEach((r, i) => add(`shear bearing ${i}`, GB.shearBearing(SH, P, { i }))); }
  const FA = W.SBDFatigueUI.build({ P, g: 0, ...(pl ? { pl } : {}) }); if (!FA.err) { add('fatigue', GB.fatigue(FA, P, {})); add('fatigue chart', GB.fatigueChart(FA, P, {})); }
  const CF = W.SBDFramingUI.build({ P, g: 0 }); add('crossframe', GB.crossframe(CF, P, {}));
  const WB = W.SBDWeldsUI.build({ P, g: 0, ...(pl ? { src: 'file', pl, plName: name } : { src: 'analysis' }) }); if (!WB.err) { add('welds', GB.welds(WB, P, {})); add('weld detail', GB.weldDetail(WB, P, {})); }
  const RT = W.SBDRatingUI.build({ P, g: 0, ...(pl ? { pl } : { src: 'analysis' }) }); if (!RT.err) add('rating', GB.ratingChart(RT, P, {}));
  // Field splices, Report summary (built-in project only: the analysis of the payloads takes long)
  if (!pl) { const Gs = W.SBDSplices.girder(P, 0, AR, { env: W.SBDSplicesUI.envOf(P) }); Gs.list.forEach(s => { if (s.R && !(s.R.errors && s.R.errors.length) && s.CK) add(`splice ${s.name}`, GB.splice(s, {})); });
    const B = W.SBDReportData.compute(P, 0, { src: 'analysis' }); add('summary', GB.summary(W.SBDReportBuild.model(B, { detail: 'gov' }), P, {})); }
  return out;
}
const projects = () => [['built-in', (() => { const P = J(M.defaultProject()); P.framing = { ...M.defaultFraming(), splices: [82] }; return P; })(), null],
  ...PAY.map(([f, o]) => { const pl = readPayload(f), P = projectFromPayload(pl); P.ownerRules = P.ownerRules || { owner: 'AASHTO', eta: { D: 'no', R: 'auto', I: 'no', eD: 1, eR: 1, eI: 1 } }; if (/RIDOT/.test(f)) P.ownerRules = { owner: 'RIDOT', eta: { D: 'no', R: 'auto', I: 'no', eD: 1, eR: 1, eI: 1 } };
    P.xs = M.defaultXs(P); Object.assign(P.xs, { nb: o.nb, bays: o.bays, skews: o.skews }); P.framing = { ...M.defaultFraming(), splices: o.spl }; P.stiffeners = M.defaultStiffeners(); P.crossframes = M.defaultCrossframes();
    P.studs = { ...M.defaultStuds(), zones: [{ x1: 0, x2: 30, nr: 3, p: 9 }, { x1: 30, x2: 360, nr: 3, p: 12 }] }; return [f, P, pl]; })];

test('graphics: no text overlaps another text, built-in project and the 5 payloads, every graphic of every output tab', () => {
  let n = 0, nt = 0; const bad = [];
  for (const [name, P, pl] of projects().filter(q => !ONLY.length || ONLY.some(o => q[0].includes(o)))) for (const { what, D } of allGraphics(P, name, pl)) {
    D.E.forEach((e, i) => e.pts.forEach(p => p.forEach(v => assert.ok(Number.isFinite(v), `${what}: entity ${i} finite`))));
    const ov = textOverlaps(D, X).concat(swatchOverlaps(D, X)); n++; nt += D.E.filter(e => e.t === 'TEXT').length; ov.forEach(o => bad.push(`${what}: ${describe(o)}`)); }
  if (LIST) { const by = {}; bad.forEach(b => { const k = b.split(': ')[0].replace(/^[^/]*\/ /, ''); (by[k] = by[k] || []).push(b); }); Object.keys(by).forEach(k => console.log(k, by[k].length, '\n   ', by[k].slice(0, 6).join('\n    '))); console.log('graphics', n, 'overlaps', bad.length); }
  assert.equal(bad.length, 0, `${bad.length} text overlaps in ${n} graphics:\n${bad.slice(0, 25).join('\n')}`);
  console.log(`       ${n} graphics, ${nt} text entities: no overlapping text`);
});
