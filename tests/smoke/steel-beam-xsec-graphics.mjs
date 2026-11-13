#!/usr/bin/env node
// Steel Beam Design - AISC 15th: the cross-section drawings have no colliding dimension text (SBXD, 2026-11-13). Headless, offline.
// Every cross-section figure (Schematic & Inputs, Mx, Compression and Section Properties tabs; the composite cross section and
// partial elevation) is drawn for rectangular HSS (square, tall, small, large, a wide-flat override), round HSS (small and
// large D/t), W shapes (W8X10 to W44X335), a channel and three composite beams, at 1400 px and 390 px wide, and as the Report
// draws it (Plotly at 2.3 x its height). For each figure:
//   - no two texts (dimension strings, callouts, notes, title) overlap;
//   - no dimension, extension, leader or geometry line runs through a text (a text's own leader excepted);
//   - no text sits on the steel, and no text other than the title sits inside the drawn geometry's box;
//   - every text is inside the plot (the title inside the figure) and at least 10 px.
// Also: no console errors.
//   node tests/smoke/steel-beam-xsec-graphics.mjs [--file <tool html>] [--only <regex of shape names>] [--shots <dir>]
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FILE = path.resolve(REPO, arg('file', 'Steel Beam Design - AISC 15th.html'));
const ONLY = arg('only', null), SHOTS = arg('shots', null);
const SHAPES = [
  ['HSSR', 'HSS8X8X1/2'], ['HSSR', 'HSS12X4X3/16'], ['HSSR', 'HSS2X2X1/8'], ['HSSR', 'HSS20X12X5/8'],
  ['HSSR', 'HSS12X4X3/16', { Ht: 4, B: 12 }, 'HSS4X12 (wide flat, override)'],
  ['HSSP', 'HSS28.000X1.000'], ['HSSP', 'HSS20.000X0.250'], ['HSSP', 'HSS1.660X0.140'],
  ['W', 'W8X10'], ['W', 'W14X22'], ['W', 'W24X62'], ['W', 'W44X335'], ['C', 'C10X15.3'],
  ['W', 'W24X62', null, 'W24X62 composite, deck perpendicular', { on: true, orient: 'perp' }],
  ['W', 'W14X22', null, 'W14X22 composite, solid slab', { on: true, orient: 'none', hr: 0 }],
  ['W', 'W44X335', null, 'W44X335 composite, deck parallel', { on: true, orient: 'para', sLeft: 6, sRight: 6 }],
];
const TABS = ['Schematic & Inputs', 'Mₓ — Major Flexure', 'Compression', 'Section Properties'];
const SEL = '.plotHold[id^=xsec], .plotHold[id^=elev]';

/* in the page: the text boxes, the lines (dimension / geometry / leaders) and the steel outline of one drawn figure */
function measure(id) {
  const gd = document.getElementById(id); if (!gd || !gd._fullLayout) return null;
  const xa = gd._fullLayout.xaxis, ya = gd._fullLayout.yaxis, svg = gd.querySelector('.main-svg'), R = svg.getBoundingClientRect();
  const X = x => R.left + xa._offset + xa.l2p(x), Y = y => R.top + ya._offset + ya.l2p(y);
  const iX = px => xa.p2l(px - R.left - xa._offset), iY = py => ya.p2l(py - R.top - ya._offset);
  const box = r => ({ l: r.left, r: r.right, t: r.top, b: r.bottom });
  const L = gd.layout, texts = [], segs = [], geo = [];
  gd.querySelectorAll('g.annotation').forEach(g => {
    if (getComputedStyle(g).display === 'none') return;
    const tx = g.querySelector('.annotation-text-g text'); if (!tx) return;
    const i = +g.getAttribute('data-index');
    texts.push({ i, txt: tx.textContent, fs: parseFloat(getComputedStyle(tx).fontSize), box: box(tx.getBoundingClientRect()) });
  });
  const ttl = gd.querySelector('.gtitle');
  if (ttl && ttl.textContent) texts.push({ i: -1, title: true, txt: ttl.textContent, fs: parseFloat(getComputedStyle(ttl).fontSize), box: box(ttl.getBoundingClientRect()) });
  (L.shapes || []).forEach((s, i) => {
    if (s.xref === 'paper' || s.yref === 'paper') return;
    if (s.type === 'line') segs.push({ i, name: s.name || 'geometry', x0: X(s.x0), y0: Y(s.y0), x1: X(s.x1), y1: Y(s.y1) });
    if (s.name === 'sbxd') return;
    if (s.type === 'line' || s.type === 'rect') geo.push([X(s.x0), X(s.x1), Y(s.y0), Y(s.y1)]);
    if (s.type === 'path') { const n = [...s.path.matchAll(/(-?[\d.eE+-]+),(-?[\d.eE+-]+)/g)]; n.forEach(m => geo.push([X(+m[1]), X(+m[1]), Y(+m[2]), Y(+m[2])])); }
  });
  (L.annotations || []).forEach((a, i) => {
    if (!a.showarrow) return;
    const hx = X(a.x), hy = Y(a.y), tx = a.axref === 'x' ? X(a.ax) : hx + (a.ax || 0), ty = a.ayref === 'y' ? Y(a.ay) : hy + (a.ay || 0);
    segs.push({ i: 'leader' + i, ann: i, name: 'leader', x0: hx, y0: hy, x1: tx, y1: ty });
  });
  const gb = geo.length ? { l: Math.min(...geo.map(g => Math.min(g[0], g[1]))), r: Math.max(...geo.map(g => Math.max(g[0], g[1]))),
    t: Math.min(...geo.map(g => Math.min(g[2], g[3]))), b: Math.max(...geo.map(g => Math.max(g[2], g[3]))) } : null;
  const steel = (L.shapes || []).find(s => s.name === 'steel'), polys = [];
  if (steel) steel.path.split('Z').forEach(sg => { const P = [...sg.matchAll(/(-?[\d.eE+-]+),(-?[\d.eE+-]+)/g)].map(m => [+m[1], +m[2]]); if (P.length > 2) polys.push(P); });
  const inSteel = (x, y) => { let c = false; polys.forEach(P => { for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } }); return c; };
  texts.forEach(t => { let n = 0; const B = t.box; for (let u = 0; u <= 8; u++) for (let v = 0; v <= 2; v++) if (inSteel(iX(B.l + 1 + (B.r - B.l - 2) * u / 8), iY(B.t + 1 + (B.b - B.t - 2) * v / 2))) n++; t.onSteel = n; });
  return { svg: box(R), plot: { l: X(xa.range[0]), r: X(xa.range[1]), t: Y(ya.range[1]), b: Y(ya.range[0]) }, geo: gb, texts, segs, hasSteel: !!steel };
}
/* in the page: draw the registered figure as the Report does (width 2.3 x height, fixed size) and measure it */
async function measureReport(id) {
  const fig = PLOTREG[id]; if (!fig || typeof Plotly === 'undefined') return null;
  const ht = (fig.layout && fig.layout.height) || 320, w = Math.round(ht * 2.3);
  let d = document.getElementById('__sbxdRep'); if (d) { Plotly.purge(d); d.remove(); }
  d = document.createElement('div'); d.id = '__sbxdRep'; d.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${ht}px;background:#fff;z-index:99999`;
  document.body.appendChild(d);
  await Plotly.newPlot(d, fig.data, Object.assign({}, fig.layout, { width: w, height: ht }), { staticPlot: true });
  const m = window.__sbxdMeasure('__sbxdRep'); Plotly.purge(d); d.remove(); return m;
}

const ov = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
const cuts = (s, B) => { for (let k = 0; k <= 60; k++) { const x = s.x0 + (s.x1 - s.x0) * k / 60, y = s.y0 + (s.y1 - s.y0) * k / 60; if (x > B.l + 0.5 && x < B.r - 0.5 && y > B.t + 0.5 && y < B.b - 0.5) return true; } return false; };
function problems(m, id) {
  const P = [], T = m.texts;
  for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) if (ov(T[i].box, T[j].box)) P.push(`texts overlap: "${T[i].txt}" / "${T[j].txt}"`);
  for (const t of T) {
    if (t.fs < 10) P.push(`text under 10 px (${t.fs}): "${t.txt}"`);
    const S = m.svg; if (t.box.l < S.l - 0.5 || t.box.r > S.r + 0.5 || t.box.t < S.t - 0.5 || t.box.b > S.b + 0.5) P.push(`text outside the figure: "${t.txt}"`);
    if (t.title) continue;
    if (t.box.l < m.plot.l - 1 || t.box.r > m.plot.r + 1 || t.box.t < m.plot.t - 1 || t.box.b > m.plot.b + 1) P.push(`text outside the plot area: "${t.txt}"`);
    if (t.onSteel) P.push(`text on the steel: "${t.txt}"`);
    if (m.geo && ov(t.box, m.geo)) P.push(`text inside the drawn geometry: "${t.txt}"`);
    for (const s of m.segs) if (s.ann !== t.i && cuts(s, t.box)) P.push(`${s.name} line through "${t.txt}"`);
  }
  if (!m.hasSteel && !/^elev/.test(id)) P.push('no steel outline found');   // the partial elevation has no section outline
  return P;
}

let n = 0, bad = [];
const ok = msg => { n++; console.log('  ok  ', msg); };
for (const vw of [1400, 390]) {
  const { b, p, errs } = await openPage(FILE, { vw });
  await p.waitForFunction(() => typeof AN !== 'undefined' && AN && typeof Plotly !== 'undefined', null, { timeout: 30000 });
  await p.waitForTimeout(800);
  await p.evaluate(`window.__sbxdMeasure=${measure.toString()};window.__sbxdMeasureReport=${measureReport.toString()};`);
  const tab = async t => { await p.evaluate(t => [...document.querySelectorAll('#tabBar button')].find(x => x.textContent.trim() === t).click(), t); await p.waitForTimeout(700); };
  for (const [fam, lbl, ovr, name, comp] of SHAPES) {
    const nm = name || lbl;
    if (ONLY && !new RegExp(ONLY).test(nm)) continue;
    const found = await p.evaluate(([fam, lbl, ovr, comp]) => {
      if (!DB[fam].some(r => r[0] === lbl)) return false;
      S.section = { family: fam, label: lbl, grade: famMeta(fam).defMat, builtUp: !!ovr, ovr: ovr || {} };
      S.composite = comp ? Object.assign({}, comp) : { on: false }; fullRebuild(); return true;
    }, [fam, lbl, ovr, comp]);
    assert.ok(found, lbl + ' is in the database');
    await p.waitForTimeout(400);
    let figs = 0;
    for (const t of TABS) {
      await tab(t);
      await p.waitForFunction(sel => [...document.querySelectorAll(sel)].every(d => d.querySelector('.main-svg')), SEL, { timeout: 8000 }).catch(() => {});
      await p.waitForTimeout(200);
      const ids = await p.evaluate(sel => [...document.querySelectorAll(sel)].filter(d => d.offsetParent).map(d => d.id), SEL);
      for (const id of ids) {
        const views = [['screen', await p.evaluate(id => window.__sbxdMeasure(id), id)]];
        if (vw === 1400) views.push(['Report', await p.evaluate(id => window.__sbxdMeasureReport(id), id)]);
        for (const [v, m] of views) {
          assert.ok(m, `${nm} ${id} (${v}) drawn`);
          problems(m, id).forEach(x => bad.push(`${nm} | ${t} #${id} | ${vw} px ${v}: ${x}`));
          figs++;
        }
        if (SHOTS) {
          await p.evaluate(id => document.getElementById(id).scrollIntoView({ block: 'center' }), id); await p.waitForTimeout(100);
          await p.locator('#' + id).screenshot({ path: path.join(SHOTS, `${vw}-${nm.replace(/[^\w.-]+/g, '_')}-${id}.png`) });
        }
      }
    }
    assert.ok(figs >= 3, `${nm}: at least 3 cross-section figures measured at ${vw} px (got ${figs}; a channel has no Compression-tab drawing)`);
    ok(`${vw} px: ${nm}: ${figs} figure views measured`);
  }
  assert.deepEqual(errs, [], 'no console errors');
  await b.close();
}
if (bad.length) { console.log(bad.map(x => '  FAIL  ' + x).join('\n')); }
assert.equal(bad.length, 0, bad.length + ' layout problem(s) in the cross-section drawings');
ok('no overlapping texts, no line through a text, no text on the steel or outside the figure, all texts >= 10 px');
console.log(`\n${n} checks passed`);
