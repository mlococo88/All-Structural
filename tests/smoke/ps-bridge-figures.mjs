#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html): the bridge figures added in the catch-up to the Steel Bridge app (2026-11-14). Headless Chromium,
// file://, CDN libraries from tests/libs.
//   Cross-section (ui/xsfig.js PSBXsFig, the Loads & LLDF tab and the Report's figure of §4): for an I-girder bridge (two spans made
//   continuous, unequal bays, a 6 ft × 12 in sidewalk on the right), NEXT 36F, adjacent box beams BIII-36 and voided slabs SIV-48, at 1400
//   and 390 px: the figure is drawn with one outline per girder type × line of the span shown (= PSBXsFig.model), the voids of the boxes
//   and slabs, the line shown outlined, the d_e labels = PSBDesign.deOf, "Deck" with its width; to scale (one scale: the drawn deck width /
//   depth ratio = the model's); the Report (each type's governing line) holds the same figure for each unit; no sideways scroll at 390 px;
//   0 console errors; only psb2.* keys written.
//   node tests/smoke/ps-bridge-figures.mjs [--file <index.html>] [--shots <dir>]
import fs from 'fs';
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) { if (!av[i].startsWith('--')) continue; const k = av[i].slice(2); args[k] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true; }
const FILE = path.resolve(args.file || path.join(REPO, 'apps/ps-bridge/index.html'));
if (args.shots) fs.mkdirSync(args.shots, { recursive: true });
let failures = 0, checks = 0;
const check = (ok, msg) => { checks++; if (!ok) { failures++; console.log('  FAIL ' + msg); } };

const HARP0 = { n: 0, yEnd: 24, yMid: 6, frac: 0.4 };
export const PROJECTS = {
  ibeam: { spans: [110, 130], cont: 'composite', bays: [8.5, 9.5, 9.5, 8.5], ohL: 3.5, ohR: 3, skews: [15, 15, 20], swR: { w: 6, t: 12 } },
  next: { spans: [60], bays: [8, 8, 8, 8], ohL: 4, ohR: 4, skews: [0, 0], girder: 'NEXT 36F', ts: 6, rows: [{ n: 10, y: 2 }, { n: 10, y: 4 }], harp: HARP0 },
  box: { spans: [80], bays: [3, 3, 3, 3, 3, 3, 3, 3, 3], ohL: 1.5, ohR: 1.5, skews: [0, 0], girder: 'AASHTO BIII-36 (39in)', ts: 6, rows: [{ n: 16, y: 2 }], harp: HARP0 },
  slab: { spans: [45], bays: [4, 4, 4, 4, 4], ohL: 2, ohR: 2, skews: [0, 0], girder: 'AASHTO SIV-48 (21in)', ts: 5, rows: [{ n: 20, y: 2 }], harp: HARP0 }
};
export const build = (o) => {
  const M = window.PSBModel; if (!o) return M.newProject();
  const P = M.defaultProject(); P.spans.lengths = o.spans; P.spans.continuity = o.cont || 'simple'; P.xs.bays = o.bays; P.xs.nb = o.bays.length + 1; P.xs.skews = o.skews;
  if (o.ohL != null) P.xs.ohL = o.ohL; if (o.ohR != null) P.xs.ohR = o.ohR;
  if (o.girder) P.base.girder = o.girder; if (o.ts != null) P.base.ts = o.ts;
  if (o.rows) P.base.rows = o.rows.map(r => ({ dbnd: 0, nd: 0, ...r })); if (o.harp) P.base.harp = o.harp;
  P.types = window.PSBBridge.newTypes(P); P.design = { g: 2, s: 1 }; P.xs.dl = window.PSBBridgeDL.defaults(P); if (o.swR) P.xs.dl.swR = o.swR;
  return P;
};
const lsSnap = p => p.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
async function open(name, vw, otab) {
  const pg = await openPage(FILE, { vw, vh: vw > 500 ? 1000 : 844 }); const { p } = pg;
  await p.waitForSelector('#tabBar [data-otab]');
  await p.evaluate(([o, fn, t]) => { const b = new Function('o', 'return (' + fn + ')(o)'); window.PSBModel.save(localStorage, b(o)); localStorage.setItem('psb2.ui', JSON.stringify({ itab: 'proj', otab: t })); }, [PROJECTS[name], build.toString(), otab]);
  await p.reload(); await p.waitForSelector('#tabBar [data-otab]'); await p.waitForTimeout(900);
  return pg;
}

for (const vw of [1400, 390]) for (const name of Object.keys(PROJECTS)) {
  const tag = `${name} @ ${vw}`, pg = await open(name, vw, 'lds'), { p } = pg;
  const r = await p.evaluate(() => {
    const P = window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project, d = window.PSBDesign.sel(P), m = window.PSBXsFig.model(P, d.s);
    const svg = document.querySelector('#ldFig svg'), vb = svg ? svg.viewBox.baseVal : null;
    const outl = svg ? [...svg.querySelectorAll('polygon.xs-g')] : [], deckEl = svg && svg.querySelector('polygon.dt-cc');
    const db = deckEl ? deckEl.getBBox() : null;
    return { cells: window.PSBBridge.cells(P).filter(c => c.s === d.s).length, n: outl.length, shown: outl.filter(e => e.getAttribute('stroke') === '#2563EB').length,
      voids: svg ? svg.querySelectorAll('.xs-v').length : 0, mv: m.girders.reduce((a, q) => a + q.voids.length, 0), txt: svg ? svg.textContent : '',
      de: m.faces.map(f => ({ g: f.g, de: f.de, eng: window.PSBDesign.deOf(P, f.g) })), Wd: m.Wd, ts: m.ts, deckRatio: db ? db.width / db.height : 0,
      cap: (document.querySelector('#ldFig .vk-cap') || {}).textContent || '', sideways: document.documentElement.scrollWidth > window.innerWidth + 1, err: !!document.querySelector('#out .alert.err') };
  });
  check(!r.err, `${tag}: no error alert`);
  check(r.n === r.cells && r.n >= 4, `${tag}: one section outline per type × line of the span (${r.n} / ${r.cells})`);
  check(r.shown === 1, `${tag}: the line shown outlined (${r.shown})`);
  check(r.voids === r.mv, `${tag}: voids drawn = model (${r.voids} / ${r.mv})`);
  if (name === 'box' || name === 'slab') check(r.mv >= r.cells, `${tag}: every box / slab has its voids (${r.mv})`);
  r.de.forEach(f => { check(Math.abs(f.de - f.eng) < 1e-9, `${tag}: G${f.g} d_e = deOf (${f.de} / ${f.eng})`); check(r.txt.includes(`= ${f.de.toFixed(2)} ft`), `${tag}: G${f.g} d_e label ${f.de.toFixed(2)}`); });
  check(r.txt.includes(`Deck ${(r.Wd / 12).toFixed(2)} ft`), `${tag}: deck width label`);
  if (r.ts > 0) check(Math.abs(r.deckRatio - r.Wd / r.ts) / (r.Wd / r.ts) < 0.02, `${tag}: true scale (deck ${r.deckRatio.toFixed(1)} vs ${(r.Wd / r.ts).toFixed(1)})`);
  check(/Drawn to scale/.test(r.cap) && /schematic/.test(r.cap), `${tag}: caption states the scale and the schematic barrier`);
  check(!r.sideways, `${tag}: no sideways scroll`);
  if (args.shots) await (await p.$('#ldFig')).screenshot({ path: path.join(args.shots, `xs-lds-${name}-${vw}.png`) });
  if (vw === 1400 && name === 'ibeam') {
    // the Report: the same figure in §4 of each unit (each type's governing line)
    await p.click('#tabBar [data-otab="rpt"]'); await p.waitForTimeout(2500);
    const q = await p.evaluate(() => { const s = [...document.querySelectorAll('#rptHost svg[aria-label^="Bridge cross-section"]')].filter(e => e.getBoundingClientRect().width > 0);
      return { n: s.length, outl: s.map(e => e.querySelectorAll('polygon.xs-g').length), cap: [...document.querySelectorAll('#rptHost')].map(e => e.textContent).join('').includes('Cross-section: girder sections') }; });
    check(q.n >= 1 && q.outl.every(k => k === 5), `Report: the cross-section figure in each unit (${q.n}, outlines ${q.outl.join(',')})`);
    check(q.cap, 'Report: the figure caption');
    const keys = Object.keys(await lsSnap(p)); check(keys.every(k => /^psb2\./.test(k) || k === '__psb2_probe'), 'keys ' + keys.join(','));
  }
  check(pg.errs.length === 0, `${tag}: console errors ${pg.errs.slice(0, 3).join(' | ')}`);
  check(pg.blocked.size === 0, `${tag}: blocked ${[...pg.blocked].join(' ')}`);
  await pg.b.close();
}

// ---------- 2026-11-14 (item 3): the Bridge layout tab: the framing plan, the list tables, equal spacing, the girder type of each line ----------
for (const vw of [1400, 390]) {
  const tag = `layout @ ${vw}`, pg = await open('ibeam', vw, 'lds'), { p } = pg;
  const before = (await lsSnap(p))['psb2.project.current'];
  await p.click('#inTabs [data-itab="layout"]'); await p.waitForTimeout(400);
  check((await lsSnap(p))['psb2.project.current'] === before, `${tag}: opening the tab changes nothing saved`);
  const r = await p.evaluate(() => { const P = window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project, m = window.PSBPlan.model(P), svg = document.querySelector('#planFig svg');
    return { cells: window.PSBBridge.cells(P).length, gl: svg ? svg.querySelectorAll('line.xs-gl').length : -1, dia: svg ? svg.querySelectorAll('line.xs-dia').length : -1, cd: svg ? svg.querySelectorAll('line.xs-cd').length : -1,
      mdia: m.dia.length, mcd: m.cont.length, txt: svg ? svg.textContent : '', h: svg ? svg.viewBox.baseVal.height : 0, label: svg ? svg.getAttribute('aria-label') : '', sideways: document.documentElement.scrollWidth > window.innerWidth + 1,
      tables: ['spans.lengths', 'xs.skews'].map(id => { const el = document.getElementById('i_' + id); return !!(el && el.nextElementSibling && el.nextElementSibling.querySelector('table.sli-t')); }) }; });
  check(r.gl === r.cells && r.cells === 10, `${tag}: plan: a girder line per type × line (${r.gl} / ${r.cells})`);
  check(r.cd === r.mcd && r.mcd === 1, `${tag}: plan: the continuity diaphragm on the pier (${r.cd})`);
  check(r.dia === r.mdia, `${tag}: plan: diaphragms = model (${r.dia} / ${r.mdia})`);
  check(['Abut. 1', 'Pier 1', 'Abut. 2', 'θ = 15.0°', 'θ = 20.0°', 'Span 1: 110.00 ft', 'Span 2: 130.00 ft'].every(t => r.txt.includes(t)), `${tag}: plan labels (${r.txt.slice(0, 120)})`);
  check(!/exaggerated/.test(r.label), `${tag}: plan true scale by default`);
  check(r.tables.every(Boolean), `${tag}: spans and skews are tables of rows`);
  await p.click('#planFig [data-vkseg="2"]'); await p.waitForTimeout(300);
  const x2 = await p.evaluate(() => { const svg = document.querySelector('#planFig svg'); return { h: svg.viewBox.baseVal.height, label: svg.getAttribute('aria-label'), cap: (document.querySelector('#planFig [data-plancap]') || {}).textContent || '', on: (document.querySelector('#planFig [data-vkseg="2"]') || {}).getAttribute('aria-pressed') }; });
  check(/exaggerated ×2/.test(x2.label) && x2.h > r.h && /angles are not to scale/.test(x2.cap) && x2.on === 'true', `${tag}: Width ×2 (${r.h} → ${x2.h} high)`);
  check((await lsSnap(p))['psb2.project.current'] === before, `${tag}: Width ×2 is not saved`);
  check(!r.sideways, `${tag}: no sideways scroll`);
  if (args.shots) await (await p.$('#psbPlan')).screenshot({ path: path.join(args.shots, `plan-ibeam-${vw}.png`) });
  if (vw === 1400) {
    // a span typed into its row (the table writes the text back, the page reads it): 110 → 115; + Add: a third span and a fourth skew
    const cell = await p.$('[id="i_spans.lengths"] + [data-sli="host"] tr[data-sli-r="0"] input.sli-in'); await cell.fill('115'); await cell.press('Tab'); await p.click('#inTabs [data-itab="layout"]'); await p.waitForTimeout(400);
    let Q = await p.evaluate(() => window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project);
    check(JSON.stringify(Q.spans.lengths) === '[115,130]' && Q.xs.skews.length === 3, `typed span saved as a number array (${JSON.stringify(Q.spans.lengths)})`);
    await p.click('[id="i_spans.lengths"] + [data-sli="host"] button.sli-add'); const c3 = await p.$('[id="i_spans.lengths"] + [data-sli="host"] tr[data-sli-r="2"] input.sli-in'); await c3.fill('90'); await c3.press('Tab'); await p.click('#inTabs [data-itab="layout"]'); await p.waitForTimeout(500);
    Q = await p.evaluate(() => window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project);
    check(JSON.stringify(Q.spans.lengths) === '[115,130,90]' && Q.xs.skews.length === 4, `a span added: ${JSON.stringify(Q.spans.lengths)}, ${Q.xs.skews.length} skews`);
    // equal spacing: W_cc = Σ bays first, then 38 ft → 9.5 ft bays, the worked step; back to individual keeps them
    await p.click('#inTabs [data-itab="xsec"]'); await p.selectOption('[id="i_xs.spMode"]', 'equal'); await p.waitForTimeout(300);
    Q = await p.evaluate(() => window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project);
    check(Q.xs.spMode === 'equal' && Math.abs(Q.xs.Wcc - 36) < 1e-9 && Q.xs.bays.every(b => Math.abs(b - 9) < 1e-9), `equal: W_cc = Σ bays 36 → S 9 (${JSON.stringify(Q.xs.bays)})`);
    await p.fill('[id="i_xs.Wcc"]', '38'); await p.press('[id="i_xs.Wcc"]', 'Tab'); await p.waitForTimeout(300);
    Q = await p.evaluate(() => window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project);
    const stx = await p.evaluate(() => (document.getElementById('st-xs.eqS') || {}).textContent || '');
    check(JSON.stringify(Q.xs.bays) === '[9.5,9.5,9.5,9.5]' && /9\.500/.test(stx), `W_cc 38: bays ${JSON.stringify(Q.xs.bays)}; step "${stx.slice(0, 60)}"`);
    check(!(await p.$('[id="i_xs.bays"]')), 'equal: no bay list');
    await p.selectOption('[id="i_xs.spMode"]', 'individual'); await p.waitForTimeout(300);
    Q = await p.evaluate(() => window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project);
    check(Q.xs.spMode === 'individual' && JSON.stringify(Q.xs.bays) === '[9.5,9.5,9.5,9.5]' && !!(await p.$('[id="i_xs.bays"]')), 'back to individual keeps the bays');
    // the girder type of each line: G3 in span 1 to the exterior type; the Girders & strands tab's line box follows
    const k = await p.evaluate(() => { const P = window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project; return P.types.findIndex(t => t.span === 1 && t.lines.includes(1)); });
    await p.selectOption('select[data-lt="1|3"]', String(k)); await p.waitForTimeout(300);
    Q = await p.evaluate(() => window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project);
    check(Q.types[k].lines.includes(3) && Q.types.filter(t => t.span === 1 && t.lines.includes(3)).length === 1, `G3 / span 1 moved to type ${k} (${JSON.stringify(Q.types.map(t => [t.span, t.lines]))})`);
    await p.click('#inTabs [data-itab="gird"]'); await p.waitForTimeout(300);
    check(await p.evaluate(kk => { const b = document.querySelector(`input[data-ty="line"][data-k="${kk}"][data-g="3"]`); return !!(b && b.checked); }, k), 'the Girders & strands line box of G3 is ticked for that type');
  }
  check(pg.errs.length === 0, `${tag}: console errors ${pg.errs.slice(0, 3).join(' | ')}`);
  await pg.b.close();
}
console.log(`${checks} checks, ${failures} failed`);
process.exit(failures ? 1 : 0);
