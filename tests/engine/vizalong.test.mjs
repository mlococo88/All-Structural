// apps/steel-bridge/ui/vizalong.js and ui/alonggfx.js (SBVZB, 2026-11-10: the graphics along the girder in the data-viz style; display only).
// Checks in Node (no DOM): 1. render() of an along-girder spec (elevation, band, chart with a cap, text) at desktop and phone widths gives an SVG without
// NaN / undefined, and its click areas lie inside it; 2. the Report / Summary figure (summarySpec, summarySvg) for the built-in project and four hand-off
// payloads: every flag and band value is one the old drawing (engine/tabgraphics-b.js summary(), what Download DXF exported) also prints, the band classes
// are SBDGraphics.ratioColor's, and the static SVG carries its own style sheet (print grey / hatch).
import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { E, FILES } from './gfx-fixture.mjs';
import { loadShared } from './harness.mjs';
import { projectFromPayload, readPayload } from './an-fixture.mjs';

const W = loadShared(...FILES, E('ui/vizalong.js'), E('ui/alonggfx.js')), VA = W.SBDVizAlong, AG = W.SBDAlongGfx, G = W.SBDTabGfxB, M = W.SBDModel, J = o => JSON.parse(JSON.stringify(o));
const nums = s => (String(s).match(/\d+(\.\d+)?/g) || []);

test('vizalong: render() of an elevation, a band and a capped chart (desktop and phone)', () => {
  const P = J(M.defaultProject()); P.framing = { ...M.defaultFraming(), splices: [82] }; const g = AG.geo(P, 0); assert.equal(g.errors.length, 0);
  const sp = { L0: g.L0, L1: g.L1, sup: g.sup, sel: 120, selLabel: 'x = 120.00 ft', rows: [
    { kind: 'elev', geo: g, fill: [{ x0: 0, x1: 100, cls: 'ok' }, { x0: 100, x1: 120, cls: 'ng' }], marks: [{ x: 50, y: 'mid', cls: 'hi', reg: { v: 1, lab: 'a' } }], above: [{ t: 'flags', items: [{ x: 50, y: 'mid', text: 'F1 0.95', cls: 'hi' }, { x: 50, y: 'mid', text: 'F2 0.20' }] }, { t: 'dims', items: [{ x0: 0, x1: 110, texts: ['10 @ 11\'-0"'] }] }] },
    { kind: 'band', label: 'Ratio', items: [{ x0: 0, x1: 360, cls: 'ok', text: '0.50' }], flag: { x: 100, text: 'Governs: 0.50' } },
    { kind: 'chart', label: 'M_DC1, kip-ft', series: [{ key: 'a', pts: [[0, 0], [100, 9], [200, 2], [360, 0]] }], cap: 5, yr: [0, 5], limits: [{ y: 1, label: 'RF = 1.0' }], govLabels: [{ x: 200, y: 2, text: 'Inventory RF 2.00' }], regs: [{ x0: 0, x1: 10, v: 2, lab: 'b' }] },
    { kind: 'text', lines: ['XF CF3 0.904'] }] };
  [1400, 390].forEach(w => { const R = VA.render(sp, w); assert.ok(/^<svg /.test(R.svg) && !/NaN|undefined/.test(R.svg), `svg at ${w}`); assert.ok(R.regs.length >= 2);
    R.regs.forEach(r => assert.ok(r.x0 >= -1 && r.x1 <= R.W + 1 && r.y0 >= -1 && r.y1 <= R.H + 1, `area inside at ${w}`)); assert.ok(/class="cap s0"/.test(R.svg) && /class="arw f0"/.test(R.svg), 'the capped run'); });
  const st = VA.staticSvg(sp, 760); assert.ok(/<style>svg\.va\{/.test(st) && /@media print/.test(st) && /id="vk-ht"/.test(st), 'static figure: style inside, print hatch');
});

function sumCheck(P, name) {
  const B = W.SBDReportData.compute(P, 0, { src: 'analysis' }), Mod = W.SBDReportBuild.model(B, { detail: 'gov' }), sp = AG.summarySpec(Mod, P, 0), old = G.summary(Mod, P, {});
  assert.ok(sp, `${name}: spec`); const oldTxt = old.D.E.filter(e => e.t === 'TEXT').map(e => e.s).join(' '), have = new Set(nums(oldTxt));
  const el = sp.rows[0], band = sp.rows.find(r => r && r.kind === 'band'), gen = sp.rows.find(r => r && r.kind === 'text');
  el.above[0].items.forEach(f => { assert.ok(oldTxt.includes(f.text.replace(/ RF /, ' RF ')), `${name}: flag "${f.text}" in the old drawing`); });
  if (band) band.items.forEach(b => { const v = b.text.split(': ')[1]; assert.ok(v === 'NG' || have.has(v), `${name}: band ${b.text}`); assert.ok(['ok', 'hi', 'ng'].includes(b.cls)); });
  if (gen) gen.lines.forEach(l => nums(l.split(': ').slice(-1)[0]).slice(-1).forEach(v => assert.ok(have.has(v), `${name}: ${l}`)));
  const svg = AG.summarySvg(Mod, P, 0); assert.ok(/^<svg /.test(svg) && !/NaN|undefined/.test(svg), `${name}: static svg`);
  return el.above[0].items.length;
}
test('vizalong: the Report summary figure has the old drawing\'s values (built-in project and four payloads)', () => {
  const P = J(M.defaultProject()); P.framing = { ...M.defaultFraming(), splices: [82] }; let n = sumCheck(P, 'built-in');
  for (const [f, o] of [['gd_builtin_CTDOT_G3.json', { nb: 4, bays: [10, 10.5, 10], skews: [0, 0, 0, 0], spl: [90, 270] }], ['gd_curb_MassDOT_G2.json', { nb: 6, bays: [8, 8, 8.5, 8, 8], skews: [15, 15, 15, 15], spl: [] }],
    ['gd_util_RIDOT_G4.json', { nb: 7, bays: [7.5, 7.5, 7.5, 7.5, 7.5, 7.5], skews: [35, 35, 35, 35], spl: [85, 275] }], ['gd_xsA_AASHTO_G5.json', { nb: 3, bays: [11, 11], skews: [10, 30, 40, 25], spl: [100, 260] }]]) {
    const pl = readPayload(f), Q = projectFromPayload(pl); Q.xs = M.defaultXs(Q); Object.assign(Q.xs, { nb: o.nb, bays: o.bays, skews: o.skews }); Q.framing = { ...M.defaultFraming(), splices: o.spl };
    n += sumCheck(Q, f); }
  console.log(`       ${n} governing-check flags checked against the old drawing`);
});
