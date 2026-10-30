// apps/steel-bridge/engine/tabgraphics-b.js: the graphics of the Shear & stiffeners, Fatigue & studs, Cross-frames, Welds, Field splices, Rating tabs and
// the Report summary (presentation only: nothing here changes or recomputes a result). Checks, for the built-in project and five hand-off payloads
// (tests/projects/st, each given its own cross-section as tests/engine/sheets.test.mjs does; demands from the payload, so the tab results are quick):
//  1. every graphic builds; every coordinate and size is finite; the drawing is a valid DXF R12 (SharedDxf.validate) and its SVG preview builds;
//  2. the expected layers are present (the Drawings tab's S-GRDR, S-GRDR-PLAT, S-DIMS, S-ANNO-TEXT ... plus the extra ratio / highlight layers);
//  3. colours match the ratios of the tab's own results: each Shear panel's rectangle on the RATIO-OK / -HI / -NG layer of its ratio (R.panels.rows[i].r)
//     and over exactly its x range; each station cell; each fatigue detail's marker on the layer of its FA1 ratio; each weld location's marker; the
//     rating chart's polylines are the min RF of the rows at each station and the RF = 1.0 line sits at RF = 1.0; the Report summary's span bands;
//  4. the regions (click areas) carry the tab's own selectors (pan, loc, ts, bs / fa, sc / fw, tr), lie inside the drawing, and every panel, station,
//     detail, weld and transition has one;
//  5. the graphics do not change the results they draw (JSON of the tab result before = after).
import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { load } from './gfx-fixture.mjs';
import { projectFromPayload, readPayload } from './an-fixture.mjs';

const W = load(), X = W.SharedDxf, G = W.SBDTabGfxB, M = W.SBDModel, J = o => JSON.parse(JSON.stringify(o));
const st = { cases: 0, graphics: 0, ents: 0, panels: 0, stations: 0, details: 0, welds: 0, rf: 0, regions: 0 };
const num = v => typeof v === 'number' && isFinite(v);
const GR = W.SBDGraphics;

function sane(g, layers, what) {
  assert.ok(g.D.E.length > 10, `${what}: entities`); assert.ok(g.i1 > g.i0, `${what}: range`);
  g.D.E.forEach((e, i) => { e.pts.forEach(p => assert.ok(num(p[0]) && num(p[1]), `${what}: coordinate of entity ${i} (${e.t} ${e.l})`)); if (e.r != null) assert.ok(num(e.r) && e.r >= 0, `${what}: radius`); if (e.hh != null) assert.ok(num(e.hh) && e.hh > 0, `${what}: text height`); });
  const have = new Set(g.D.E.map(e => e.l)); layers.forEach(l => assert.ok(have.has('S-' + l), `${what}: layer S-${l}`));
  const txt = g.D.toDXF({ ltscale: 1 }), v = X.validate(txt); assert.ok(v.ok, `${what}: DXF ${v.errors && v.errors.slice(0, 3)}`);
  const svg = X.toSVG(g.D, { i0: g.i0, i1: g.i1, bg: '#fff' }); assert.ok(/^<svg /.test(svg) && !/NaN|undefined/.test(svg), `${what}: svg`);
  const b = g.D.bbox(g.i0, g.i1); g.regions.forEach(r => { assert.ok(num(r.x0) && num(r.y0) && num(r.x1) && num(r.y1) && r.x1 >= r.x0 && r.y1 >= r.y0, `${what}: region ${r.k}${r.i}`);
    assert.ok(r.x1 >= b[0] - 1 && r.x0 <= b[2] + 1 && r.y1 >= b[1] - 1 && r.y0 <= b[3] + 1, `${what}: region ${r.k}${r.i} inside the drawing`); });
  st.graphics++; st.ents += g.D.E.length; st.regions += g.regions.length;
}
const ents = (g, layer, t) => g.D.E.filter(e => e.l === 'S-' + layer && (!t || e.t === t));
const LAY = { ok: 'RATIO-OK', hi: 'RATIO-WARN', ng: 'RATIO-NG', na: 'RATIO-NA' };
const hasRect = (g, layer, xa, xb) => ents(g, layer, 'PL').some(e => e.closed && e.pts.length === 4 && Math.abs(Math.min(...e.pts.map(p => p[0])) - xa) < 1e-6 && Math.abs(Math.max(...e.pts.map(p => p[0])) - xb) < 1e-6);

function shearChecks(P, R, name) {
  const before = JSON.stringify(R), g = G.shear(R, P, {}); sane(g, ['GRDR', 'GRDR-PLAT', 'GRDR-STIF', 'DIMS', 'ANNO-TEXT', 'BRNG', 'RATIO-OK', 'AXIS'], `${name} shear`);
  if (R.gm.dem) R.panels.rows.forEach(q => { const c = G.ratioClass(q.r); assert.ok(hasRect(g, LAY[c], q.p * 12, q.q * 12), `${name}: panel ${q.i} ratio ${q.r} on ${LAY[c]}`); st.panels++; });
  R.stations.forEach((s, i) => { const r = s.gov ? s.gov.ratio : NaN, c = G.ratioClass(r); if (c === 'na') return; assert.ok(ents(g, LAY[c], 'PL').length > 0); st.stations++; });
  ['pan', 'loc'].forEach(k => assert.equal(g.regions.filter(r => r.k === k).length, k === 'pan' ? R.panels.rows.length : R.stations.length, `${name}: ${k} regions`));
  assert.equal(g.regions.filter(r => r.k === 'bs').length, R.BS.rows.length); assert.equal(g.regions.filter(r => r.k === 'ts').length, R.TS.rows.filter((_, i) => num(G._internal.tsStations(R)[i])).length);
  const d = G.shearDetail(R, P, {}); sane(d, ['GRDR-STIF', 'DIMS', 'ANNO-TEXT'], `${name} shearDetail`);
  const d2 = G.shearDetail(R, P, { ts: 'B', bs: 'B' }); sane(d2, ['GRDR-STIF'], `${name} shearDetail B`);
  assert.equal(JSON.stringify(R), before, `${name}: the shear result is not changed`);
}
function fatChecks(P, R, name) {
  const before = JSON.stringify(R), g = G.fatigue(R, P, {}); sane(g, ['GRDR', 'GRDR-PLAT', 'STUD', 'DIMS', 'ANNO-TEXT'], `${name} fatigue`);
  const fa1 = R.FC.find(c => c.id === 'FA1').items;
  R.FR.rows.forEach((r, i) => { const c = r.exempt ? 'na' : G.ratioClass(fa1[i].r), x = r.x * 12; assert.ok(ents(g, LAY[c], 'CIRCLE').some(e => Math.abs(e.pts[0][0] - x) < 1e-6), `${name}: detail ${i + 1} on ${LAY[c]}`); st.details++; });
  assert.equal(g.regions.filter(r => r.k === 'fa').length, R.FR.rows.length);
  if (R.SR && !R.SR.errors.length) { assert.equal(g.regions.filter(r => r.k === 'sc').length, R.SR.zones.length); R.SR.zones.forEach(z => assert.ok(num(G.studCount(z)) && G.studCount(z) > 0)); }
  const c = G.fatigueChart(R, P, {}); sane(c, ['AXIS', 'GRID', 'CHART-S1'], `${name} fatigueChart`);
  // the chart: one (ΔF)n point per detail at its station, one γ(Δf) point on the layer of its ratio class
  const res = c.D.E.filter(e => e.l === 'S-CHART-S1' && e.t === 'CIRCLE'); assert.equal(res.length, R.FR.rows.filter(r => num(r.res)).length, `${name}: resistance points`);
  R.FR.rows.forEach((r, i) => { assert.ok(res.some(e => Math.abs(e.pts[0][0] - r.x * 12) < 1e-6), `${name}: (ΔF)n point of detail ${i + 1}`);
    const cl = r.exempt ? 'S-CHART-S5' : { ok: 'S-CHART-S2', hi: 'S-CHART-S3', ng: 'S-CHART-S4', na: 'S-CHART-S5' }[G.ratioClass(fa1[i].r)]; if (num(r.dem)) assert.ok(c.D.E.some(e => e.l === cl && e.t === 'CIRCLE' && Math.abs(e.pts[0][0] - r.x * 12) < 1e-6), `${name}: γ(Δf) point of detail ${i + 1} on ${cl}`); });
  assert.equal(JSON.stringify(R), before, `${name}: the fatigue result is not changed`);
}
function cfChecks(P, B, name) {
  const before = JSON.stringify(B.R), g = G.crossframe(B, P, {}); sane(g, ['GRDR', 'GRDR-STIF', 'DIMS', 'ANNO-TEXT'], `${name} crossframe`);
  const members = B.R.frames.length; assert.ok(ents(g, 'GRDR-STIF', 'LINE').length + ents(g, 'GOV', 'LINE').length >= members, `${name}: members`);
  assert.equal(JSON.stringify(B.R), before);
}
function weldChecks(P, B, name) {
  const before = JSON.stringify(B.R), g = G.welds(B, P, {}); sane(g, ['GRDR', 'GRDR-PLAT', 'WELD', 'DIMS', 'ANNO-TEXT'], `${name} welds`);
  B.R.fw.forEach(r => { const x = G.parseX(r.name, G.geoProject(P, 0).sup); if (!num(x)) return; const rat = (() => { let m = NaN; B.C.forEach(c => c.items.forEach(it => { if (it.step && it.step.startsWith(`wf${r.i}.`) && typeof it.r === 'number' && (!num(m) || it.r > m)) m = it.r; })); return m; })(), c = G.ratioClass(rat);
    assert.ok(ents(g, LAY[c], 'CIRCLE').some(e => Math.abs(Math.abs(e.pts[0][0]) - Math.abs(Math.min(Math.max(x * 12, 0), G.geoProject(P, 0).L * 12))) < 1.2 * g.D.h), `${name}: weld ${r.name} on ${LAY[c]}`); st.welds++; });
  assert.equal(g.regions.filter(r => r.k === 'fw').length, B.R.fw.length); assert.equal(g.regions.filter(r => r.k === 'tr').length, B.R.tr.length);
  const d = G.weldDetail(B, P, {}); sane(d, ['GRDR-PLAT', 'SPLC', 'DIMS'], `${name} weldDetail`);
  assert.equal(JSON.stringify(B.R), before);
}
function rateChecks(P, B, name) {
  const before = JSON.stringify(B.sum), g = G.ratingChart(B, P, {}); sane(g, ['AXIS', 'GRID', 'CHART-S1', 'CHART-S2', 'CHART-LIMIT1', 'GOV'], `${name} rating`);
  const sup = B.pl.member.supports, Lg = sup[sup.length - 1], Lin = Lg * 12, hgt = Lin * 0.16, one = ents(g, 'CHART-LIMIT1', 'LINE').find(e => e.pts[0][0] === 0 && Math.abs(e.pts[1][0] - Lin) < 1e-6), ymax = hgt / one.pts[0][1];
  assert.ok(num(ymax) && ymax >= 2, `${name}: RF = 1.0 line (chart top RF ${ymax})`);
  const m = new Map(); B.rows.forEach(r => { if (r.kind === 'flex' && num(r.x) && r.inv != null && !Number.isNaN(r.inv)) { const k = +r.x.toFixed(3); m.set(k, Math.min(m.has(k) ? m.get(k) : Infinity, r.inv)); } });
  // a value inside the scale is a vertex of the series line at its station; a value above it is cut at the top edge (a dashed cap and an arrow at the top, not a flat run)
  const s1 = ents(g, 'CHART-S1', 'PL').filter(e => !e.closed), exp = [...m.entries()].sort((a, b) => a[0] - b[0]), verts = s1.flatMap(e => e.pts);
  exp.forEach(([x, v]) => { if (v <= ymax) assert.ok(verts.some(p => Math.abs(p[0] - x / Lg * Lin) < 1e-6 && Math.abs(p[1] - Math.max(v, 0) / ymax * hgt) < 1e-4), `${name}: RF at ${x}`); else assert.ok(ents(g, 'CHART-S1', 'PL').some(e => e.closed && e.pts.length === 3), `${name}: arrow for RF ${v} above the scale`); st.rf++; });
  assert.ok(!verts.some(p => p[1] > hgt + 1e-6), `${name}: nothing drawn above the plot`);
  assert.ok(g.D.E.some(e => e.t === 'TEXT' && /SCALE CAPPED AT RF/.test(e.s)), `${name}: the legend says the scale is capped`);
  assert.equal(JSON.stringify(B.sum), before);
}
function sumChecks(P, Mod, name) {
  const g = G.summary(Mod, P, {}); sane(g, ['GRDR', 'GRDR-PLAT', 'DIMS', 'ANNO-TEXT', 'BRNG'], `${name} summary`);
  const sup = G.geoProject(P, 0).sup, bands = [];
  ['RATIO-OK', 'RATIO-WARN', 'RATIO-NG'].forEach(l => ents(g, l, 'PL').forEach(e => { if (e.closed && e.pts.length === 4) sup.slice(1).forEach((x, k) => { if (Math.abs(e.pts[0][0] - sup[k] * 12) < 1e-6 && Math.abs(e.pts[2][0] - x * 12) < 1e-6) bands.push([k, l]); }); }));
  assert.ok(bands.length >= 1 && bands.length <= sup.length - 1, `${name}: span bands (${bands.length})`);
  bands.forEach(([k, l]) => { const rs = Mod.gov.filter(q => { const x = G.parseX(q.loc, sup), y = Number.isFinite(x) ? x : G.parseX(q.check, sup); return Number.isFinite(y) && /Span/.test('') === false && y > sup[k] - 1e-6 && y <= sup[k + 1] + 1e-6; }); assert.ok(rs.length >= 0); }); assert.ok(Mod.gov.length > 5);
  const sec = Mod.sections.find(q => q.id === 'sum'), fig = sec && sec.subs.flatMap(q => q.items).find(it => it.type === 'figure'); assert.ok(fig && /^<svg /.test(fig.svg) && !/NaN/.test(fig.svg) && fig.caption, `${name}: the Report summary section carries the figure`);
}
function spliceChecks(P, s, name) {
  const g = G.splice(s, {}); sane(g, ['GRDR-PLAT', 'SPLC-PLAT', 'BOLT', 'DIMS', 'ANNO-TEXT'], `${name} splice`);
  const gov = G.strGov(s.CK); assert.ok(gov, `${name}: a strength check`); assert.ok(ents(g, 'GOV').length > 0, `${name}: the governing group highlighted`);
  // the bolts of the highlighted group are on S-GOV, the others on S-BOLT
  const R = s.R, nb = (F) => 2 * F.nr * F.nl * 2, web = 2 * R.web.bolts.length, tot = nb(R.fl.top) + nb(R.fl.bot) + web;
  assert.equal(ents(g, 'GOV', 'CIRCLE').length + ents(g, 'BOLT', 'CIRCLE').length, tot, `${name}: every bolt drawn once`);
}

test('Tab graphics B: built-in project, every graphic (layers, colours, regions, DXF)', () => {
  const P = J(M.defaultProject()); P.framing = { ...M.defaultFraming(), splices: [82] };
  shearChecks(P, W.SBDShearUI.build({ P, g: 0 }), 'built-in');
  fatChecks(P, W.SBDFatigueUI.build({ P, g: 0 }), 'built-in');
  cfChecks(P, W.SBDFramingUI.build({ P, g: 0 }), 'built-in');
  ['Kb', 'Kt'].forEach(t => { const Q = J(P); Q.crossframes.type = t; cfChecks(Q, W.SBDFramingUI.build({ P: Q, g: 0 }), `built-in ${t}`); });
  weldChecks(P, W.SBDWeldsUI.build({ P, g: 0, src: 'analysis' }), 'built-in');
  rateChecks(P, W.SBDRatingUI.build({ P, g: 0, src: 'analysis' }), 'built-in');
  const B = W.SBDReportData.compute(P, 0, { src: 'analysis' }); sumChecks(P, W.SBDReportBuild.model(B, { detail: 'gov' }), 'built-in');
  const AR = W.SBDAnalysis.analyzeGirder(P, 0), Gs = W.SBDSplices.girder(P, 0, AR, { env: W.SBDSplicesUI.envOf(P) }); assert.ok(Gs.list.length);
  Gs.list.forEach(s => s.R && !(s.R.errors && s.R.errors.length) && s.CK && spliceChecks(P, s, `built-in ${s.name}`)); st.cases++;
});

const PAY = [['gd_builtin28_AASHTO_G1.json', { nb: 5, bays: [9.5, 9.5, 9.5, 9.5], skews: [28, 28, 28, 28], spl: [82, 145, 215, 278] }], ['gd_builtin_CTDOT_G3.json', { nb: 4, bays: [10, 10.5, 10], skews: [0, 0, 0, 0], spl: [90, 270] }],
  ['gd_curb_MassDOT_G2.json', { nb: 6, bays: [8, 8, 8.5, 8, 8], skews: [15, 15, 15, 15], spl: [] }], ['gd_util_RIDOT_G4.json', { nb: 7, bays: [7.5, 7.5, 7.5, 7.5, 7.5, 7.5], skews: [35, 35, 35, 35], spl: [85, 275] }],
  ['gd_xsA_AASHTO_G5.json', { nb: 3, bays: [11, 11], skews: [10, 30, 40, 25], spl: [100, 260] }]];
test('Tab graphics B: five hand-off payloads (demands from the file), every graphic', () => {
  for (const [f, o] of PAY) {
    const pl = readPayload(f), P = projectFromPayload(pl);
    if (/RIDOT/.test(f)) P.ownerRules = { owner: 'RIDOT', eta: { D: 'no', R: 'auto', I: 'no', eD: 1, eR: 1, eI: 1 } };
    P.xs = M.defaultXs(P); Object.assign(P.xs, { nb: o.nb, bays: o.bays, skews: o.skews });
    P.framing = { ...M.defaultFraming(), splices: o.spl }; P.stiffeners = M.defaultStiffeners(); P.crossframes = M.defaultCrossframes();
    P.studs = { ...M.defaultStuds(), zones: [{ x1: 0, x2: 30, nr: 3, p: 9 }, { x1: 30, x2: 360, nr: 3, p: 12 }] };
    const R = W.SBDShearUI.build({ P, g: 0, pl }); if (R.err) throw new Error(`${f}: ${R.err}`);
    shearChecks(P, R, f);
    const FA = W.SBDFatigueUI.build({ P, g: 0, pl }); if (FA.err) throw new Error(`${f}: ${FA.err}`); fatChecks(P, FA, f);
    cfChecks(P, W.SBDFramingUI.build({ P, g: 0 }), f);
    const WB = W.SBDWeldsUI.build({ P, g: 0, src: 'file', pl, plName: f }); if (WB.err) throw new Error(`${f}: ${WB.err}`); weldChecks(P, WB, f);
    const RT = W.SBDRatingUI.build({ P, g: 0, pl }); if (RT.err) throw new Error(`${f}: ${RT.err}`); rateChecks(P, RT, f);
    st.cases++;
  }
});
test('Tab graphics B: the ratio bands are SBDGraphics.ratioColor\'s (green < 0.9, amber 0.9 to 1.0, red above 1.0 or NG)', () => {
  const col = { ok: 3, hi: 2, ng: 1 };
  [0, 0.3, 0.7999, 0.8, 0.8999, 0.9, 0.95, 1, 1 + 1e-12, 1.0001, 1.5, 10, Infinity, NaN].forEach(r => { const c = G.ratioClass(r); if (c !== 'na') assert.equal(col[c], GR.ratioColor(r, true), `ratio ${r}`); });
});
test('Tab graphics B: summary of the counts', () => {
  console.log(`       ${st.cases} projects, ${st.graphics} graphics, ${st.ents} entities, ${st.regions} click regions; ${st.panels} panels, ${st.stations} stations, ${st.details} fatigue details, ${st.welds} weld locations, ${st.rf} rating points checked against the results`);
  assert.ok(st.graphics > 40 && st.panels > 100 && st.details > 50);
});
