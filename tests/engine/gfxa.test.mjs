// apps/steel-bridge/ui/gfxa.js: the graphics of the Section properties, Loads & LLDF, Analysis, Flexure and Constructibility tabs.
// Display only. Each graphic is built from the results the tab's own build functions give (never recomputed): here, for the built-in
// project and 5 hand-off payloads (as drawings.test.mjs), every entity coordinate is finite, the expected layers are present, the ratio
// colours match the tab's ratios, stations and values equal the tab's rows, and each file is valid DXF R12.
// The DOM is faked (a slot with innerHTML / querySelector; SBDGraphics.mount replaced by a recorder that calls the build function).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { projectFromPayload, readPayload } from './an-fixture.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const FILES = ['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'dxf.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/rating.js', 'engine/drawings.js', 'ui/flexure.js', 'ui/loads.js', 'ui/shear.js', 'ui/rating.js', 'ui/constructibility.js', 'ui/graphics.js', 'ui/gfxa.js'].map(E));
const W = loadShared(...FILES);
const X = W.SharedDxf, M = W.SBDModel, GR = W.SBDGraphics, GA = W.SBDGfxA, SEC = W.SBDSections, OWN = W.SBDOwners;
const J = o => JSON.parse(JSON.stringify(o));

/* a fake DOM slot, and a mount that records the graphics */
const made = [];
GR.mount = (el, build, opts) => { const g = build(); assert.ok(g && !g.errors, 'graphic: ' + (g && g.errors)); made.push({ g, opts }); return { select() {}, graphic: g }; };
const slot = () => ({ _h: '', set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h; }, querySelector: () => ({ addEventListener() {}, value: '' }), querySelectorAll: () => [] });
const run = (fn, ...a) => { made.length = 0; fn(slot(), ...a); return made.map(m => m.g); };

function finite(D, what) {
  const used = new Set();
  D.E.forEach((e, i) => { used.add(e.l); e.pts.forEach(p => p.forEach(v => assert.ok(Number.isFinite(v), `${what}: entity ${i} ${e.t} ${e.l} non-finite`)));
    if (e.t === 'TEXT') assert.ok(Number.isFinite(e.hh) && e.hh > 0 && !/NaN|undefined|Infinity/.test(e.s), `${what}: text "${e.s}"`); });
  const v = X.validate(D.toDXF({ ltscale: 1 })); assert.ok(v.ok, `${what}: ${v.errors.join('; ')}`); return used;
}
const has = (used, ls, what) => ls.forEach(l => assert.ok(used.has(l), `${what}: layer ${l}`));

/* index.html calc(): the Section properties tab's results */
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
const projects = () => [['built-in', J(M.defaultProject())], ...PAY.map(([f, o]) => { const P = projectFromPayload(readPayload(f)); P.xs = M.defaultXs(P); Object.assign(P.xs, { nb: o.nb, bays: o.bays, skews: o.skews });
  P.framing = { ...M.defaultFraming(), splices: o.spl }; P.stiffeners = M.defaultStiffeners(); P.crossframes = M.defaultCrossframes(); P.ownerRules = P.ownerRules || { owner: 'AASHTO', eta: { D: 'no', R: 'auto', I: 'no', eD: 1, eR: 1, eI: 1 } }; return [f, P]; })];

test('gfxa: Section properties graphic (both regions, all load cases): layers, neutral axes at the table values, finite', () => {
  for (const [name, P] of projects()) for (const region of ['pos', 'neg']) {
    const R = secResult(P, 0, 0, region), gs = [];
    for (const cs of ['steel', '3n', 'n']) { const g = GA.secGraphic(P, R, cs, 1); const u = finite(g.D, `${name} ${region} ${cs}`); has(u, ['S-GRDR', 'S-DECK', 'S-ANNO-TEXT', 'S-DIMS', 'S-STRESS-C', 'S-STRESS-T'], name); gs.push(g); }
    // the axes are at the table's ȳ for steel, 3n, n (lines on their layers at y = value) and the PNA label
    const c = R.c, g = gs[0], ys = lay => g.D.E.filter(e => e.l === lay && e.t === 'LINE').map(e => e.pts[0][1]);
    assert.ok(Math.abs(ys('S-NA-STEEL')[0] - c.s.yb) < 1e-9 && Math.abs(ys('S-NA-3N')[0] - c.c3.yb) < 1e-9 && Math.abs(ys('S-NA-N')[0] - c.cn.yb) < 1e-9, `${name}: ENA lines`);
    assert.ok(g.D.E.some(e => e.t === 'TEXT' && /^PNA/.test(e.s)), `${name}: PNA label`);
    assert.equal(run(GA.section, { P, R, seg: 1 }).length, 1);
  }
});

test('gfxa: Loads & LLDF graphic: lane lines, wheels at the lever-rule values, every girder and region', () => {
  let n = 0;
  for (const [name, P] of projects()) { const R = W.SBDUiLoads.calc(P, 0); if (R.errors && R.errors.length) { console.log('       loads:', name, R.errors[0]); continue; }
    R.regions.forEach((rg, lr) => rg.members.forEach((m, lg) => { const g0 = GA.loadsGraphic(P, R, lg, lr, ''); assert.ok(!g0.errors, name); const u = finite(g0.D, `${name} G${lg + 1} ${lr}`); has(u, ['S-DECK', 'S-GRDR', 'S-LANE', 'S-ANNO-TEXT'], name);
      g0.opts.forEach(([k]) => { const g = GA.loadsGraphic(P, R, lg, lr, k); finite(g.D, `${name} G${lg + 1} ${k}`);
        if (k === 'lever1') { const wh = g.D.E.filter(e => e.l === 'S-LL-WHEEL' && e.t === 'CIRCLE').map(e => e.pts[0][0]); assert.deepEqual(J(wh), J(m.lever1.wheels.map(w => w * 12)), `${name}: wheels = lever1.wheels (ft x 12)`); } n++; }); })); }
  assert.ok(n > 30, 'cases built: ' + n);
});

test('gfxa: Analysis graphic: stations, supports and diagrams from the analysis result', () => {
  for (const [name, P] of projects()) { const R = W.SBDAnalysis.analyzeGirder(P, 0); if (R.errors && R.errors.length) continue;
    const gs = run(GA.analysis, { P, gi: 0, R }); assert.equal(gs.length, 1); const u = finite(gs[0].D, name); has(u, ['S-GRDR-PLAT', 'S-BRNG', 'S-AXIS', 'S-GRID', 'S-CHART-S1', 'S-CHART-S2'], name);
    const br = gs[0].D.E.filter(e => e.l === 'S-BRNG').map(e => e.pts[0][0]); assert.deepEqual(J(br), J(R.sup.map(v => v * 12)), `${name}: supports`);
    const k = Math.floor(R.x.length / 2); assert.match(gs[0].readout(k), new RegExp(`x = ${R.x[k].toFixed(2)} ft`)); assert.equal(gs[0].pick(R.x[k] * 12, 0), k);
    // the M_DC1 series has one point per station of the table
    const poly = gs[0].D.E.find(e => e.l === 'S-CHART-S1' && e.t === 'PL'); assert.equal(poly.pts.length, R.x.length, `${name}: M_DC1 points`); }
});

test('gfxa: Flexure graphics: bands coloured by the table ratios; stress checks and LTB sketch', () => {
  for (const [name, P] of projects()) { const R = W.SBDFlexureUI.build({ P, g: 0, src: name === 'built-in' ? 'analysis' : 'example' }); if (R.err) continue;
    const gs = run(GA.flexure, { P, gi: 0, R, sel: 0 }); assert.equal(gs.length, 3, name); gs.forEach((g, i) => finite(g.D, `${name} fx${i}`));
    const col = r => GR.ratioColor(r.gov ? r.gov.ratio : NaN, r.gov ? !(r.gov.ng && !Number.isFinite(r.gov.ratio)) : false), want = { 3: 0, 2: 0, 1: 0 }; R.rows.forEach(r => want[col(r)]++);
    const lay = { 3: 'S-RATIO-OK', 2: 'S-RATIO-WARN', 1: 'S-RATIO-NG' };
    // one band (a closed 4-point polyline on the ratio layer) per run of neighbouring locations of the same colour class (GR.mergeBands: the tables' classes, amber from 0.9), plus one legend box per colour
    const rects = c => gs[0].D.E.filter(e => e.l === lay[c] && e.t === 'PL' && e.closed && e.pts.length === 4).length;
    const srt = R.rows.map(r => ({ x: r.x, ratio: r.gov ? r.gov.ratio : NaN, ok: r.gov ? !(r.gov.ng && !Number.isFinite(r.gov.ratio)) : false })).filter(q => Number.isFinite(q.x)), merged = GR.mergeBands(srt, { x0: 0, x1: 360 }), wantB = { 3: 0, 2: 0, 1: 0 };
    merged.forEach(b => wantB[GR.ratioColor(b.ratio, b.ok)]++); assert.ok(merged.length <= srt.length && merged.length < 40, `${name}: merged ${srt.length} locations into ${merged.length} bands`);
    [3, 2, 1].forEach(c => assert.equal(rects(c), wantB[c] + 1, `${name}: bands of colour ${c}`));
    // the classes are the tables': 0.8999 green, 0.9 amber, 1.0 amber, 1.0001 red
    [[0.8999, 3], [0.9, 2], [1, 2], [1.0001, 1]].forEach(([r, c]) => assert.equal(GR.ratioColor(r, true), c));
    assert.ok(R.rows.length > 0 && gs[0].pick(R.rows[0].x * 12, 0) === 0, `${name}: click on the first row`); has(finite(gs[1].D, name), ['S-AXIS', 'S-GRID', 'S-CHART-S1'], name); has(finite(gs[2].D, name), ['S-ANNO-TEXT'], name); }
});

test('gfxa: Constructibility graphics: pours, M_DCc envelope, overhang bracket', () => {
  let nPour = 0;
  for (const [name, P] of projects()) { const R = W.SBDConstrUI.build({ P, g: 0 }); if (R.err) continue;
    const gs = run(GA.constr, { P, gi: 0, R, sel: 0 }); assert.equal(gs.length, 2, name); gs.forEach((g, i) => finite(g.D, `${name} cn${i}`));
    const sq = R.F.AR && R.F.AR.seq; if (sq) { nPour++; const pr = gs[0].D.E.filter(e => e.l === 'S-POUR' && e.t === 'PL' && e.closed); assert.equal(pr.length, sq.pours.length, `${name}: one rectangle per pour`);
      pr.forEach((r, k) => { assert.ok(Math.abs(r.pts[0][0] - sq.pours[k].a * 12) < 1e-6 && Math.abs(r.pts[1][0] - sq.pours[k].b * 12) < 1e-6, `${name}: pour ${k + 1} stations`); }); has(finite(gs[0].D, name), ['S-CHART-S1', 'S-CHART-S2'], name); } }
  assert.ok(nPour >= 1, 'a project with a pour sequence');
});
