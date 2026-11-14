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
console.log(`${checks} checks, ${failures} failed`);
process.exit(failures ? 1 : 0);
