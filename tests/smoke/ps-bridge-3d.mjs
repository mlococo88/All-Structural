#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html), PR 3c: the 3D view tab (ui/view3d.js, window.PSB3DUI; the Steel Bridge app's 3D view pattern).
// Headless Chromium, file://, CDN libraries (three.js r128 + OrbitControls 0.128.0) from tests/libs.
//   For five projects — a new project (one span, Interior / Exterior types), two simple spans with a different shape per span and unequal
//   bays (multi-type), NEXT 36F adjacent beams, a 25° skew with diaphragms, three spans made continuous with a 10° skew — at 1400 and
//   390 px: the tab renders a WebGL canvas with pixels drawn (not blank), the counts of the last build = PSB3DUI.geom of the stored project
//   (girders = the girder type × line cells, diaphragms, continuity diaphragms, strands of the type shown), the key lists every type, the
//   layer toggles hide a group and are kept in psb2.ui (ui.v3d.lay), the camera is kept in psb2.ui and restored on reload; no sideways
//   scroll at 390 px; 0 console errors; only psb2.* keys written.
//   node tests/smoke/ps-bridge-3d.mjs [--file <index.html>] [--shots <dir>]
import fs from 'fs';
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) { if (!av[i].startsWith('--')) continue; const k = av[i].slice(2); args[k] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true; }
const FILE = path.resolve(args.file || path.join(REPO, 'apps/ps-bridge/index.html'));
if (args.shots) fs.mkdirSync(args.shots, { recursive: true });
let failures = 0, checks = 0;
const check = (ok, msg) => { checks++; if (!ok) { failures++; console.log('  FAIL ' + msg); } };

/* the projects, built on the page from defaultProject (spans, bays, skews first; then the girder types and the DC2/DW defaults as newProject) */
const PROJECTS = {
  single: null,
  multitype: { spans: [100, 120], bays: [8, 9.5, 9, 8.5], skews: [0, 0, 0], span2: 'PCI BT-54' },
  next: { spans: [60], bays: [8, 8, 8, 8], skews: [0, 0], girder: 'NEXT 36F', ts: 6, rows: [{ n: 10, y: 2 }, { n: 10, y: 4 }, { n: 6, y: 6, dbnd: 8, nd: 2 }], harp: { n: 4, yEnd: 24, yMid: 10, frac: 0.4 } },
  skewed: { spans: [110], bays: [9, 9, 9, 9], skews: [25, 25], diaph: [{ P: 3, a: 36.67 }, { P: 3, a: 73.33 }] },
  continuous: { spans: [90, 110, 90], bays: [9, 9, 9, 9], skews: [10, 10, 10, 10], cont: 'composite', diaph: [{ P: 2.5, a: 45 }] }
};
const build = (o) => {
  const M = window.PSBModel; if (!o) return M.newProject();
  const P = M.defaultProject(); P.spans.lengths = o.spans; P.spans.continuity = o.cont || 'simple'; P.xs.bays = o.bays; P.xs.nb = o.bays.length + 1; P.xs.skews = o.skews;
  if (o.girder) P.base.girder = o.girder; if (o.ts != null) P.base.ts = o.ts;
  if (o.rows) P.base.rows = o.rows.map(r => ({ dbnd: 0, nd: 0, ...r })); if (o.harp) P.base.harp = o.harp; if (o.diaph) P.base.loads.diaph = o.diaph;
  P.types = window.PSBBridge.newTypes(P); P.design = { g: 2, s: 1 }; P.xs.dl = window.PSBBridgeDL.defaults(P);
  if (o.span2) P.types.forEach(t => { if (t.span === 2) { t.ovr.girder = o.span2; t.ovr['harp.yEnd'] = 44; } });
  return P;
};
const lsSnap = p => p.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
/* the WebGL canvas: the share of pixels that are not the background */
const drawn = p => p.evaluate(() => { const c = document.querySelector('#v3d-host canvas'); if (!c) return -1; const o = document.createElement('canvas'); o.width = c.width; o.height = c.height; const g = o.getContext('2d'); g.drawImage(c, 0, 0);
  const d = g.getImageData(0, 0, o.width, o.height).data; let n = 0; for (let i = 0; i < d.length; i += 16) if (Math.abs(d[i] - 244) + Math.abs(d[i + 1] - 245) + Math.abs(d[i + 2] - 247) > 30) n++; return n / (d.length / 16); });

for (const vw of [1400, 390]) for (const [name, o] of Object.entries(PROJECTS)) {
  const pg = await openPage(FILE, { vw, vh: vw > 500 ? 1000 : 844, ls: { 'psbeam.inputs.v1': '{"girder":"PCI BT-72"}' } }); const { p } = pg;
  await p.waitForSelector('#tabBar [data-otab]');
  await p.evaluate(o => { const build = new Function('o', 'return (' + o.fn + ')(o.o)'); const P = build(o); window.PSBModel.save(localStorage, P); localStorage.setItem('psb2.ui', JSON.stringify({ itab: 'proj', otab: '3d' })); }, { fn: build.toString(), o });
  await p.reload(); await p.waitForSelector('#tabBar [data-otab]'); await p.waitForSelector('#v3d-host canvas', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(1200);
  const tag = `${name} @ ${vw}`;
  const r = await p.evaluate(() => { const P = window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project, G = window.PSB3DUI.geom(P), st = window.PSB3DUI.state();
    return { st, n: { girders: G.girders.length, dia: G.dia.length, cont: G.cont.length, pads: G.pads.length, strands: G.strands.length, app: G.app.length }, cells: window.PSBBridge.cells(P).length,
      types: window.PSBBridge.types(P).map(t => t.label), key: [...document.querySelectorAll('.v3d-key span')].map(s => s.textContent), err: !!document.querySelector('#v3dHost .alert.err'),
      sideways: document.documentElement.scrollWidth > window.innerWidth + 1, note: (document.querySelector('#v3d-note') || {}).textContent || '' }; });
  check(!r.err && r.st.counts, `${tag}: rendered (${r.note.slice(0, 80)})`);
  check(r.st.counts && JSON.stringify(r.st.counts) === JSON.stringify(r.n), `${tag}: counts = geom ${JSON.stringify(r.st.counts)} vs ${JSON.stringify(r.n)}`);
  check(r.n.girders === r.cells && r.cells >= 5, `${tag}: a girder per type × line (${r.n.girders} / ${r.cells})`);
  check(r.n.strands > 0, `${tag}: strands of the type shown (${r.n.strands})`);
  check(r.key.length === r.types.length && r.types.every((t, i) => r.key[i].startsWith(t + ':')), `${tag}: key ${r.key.join(' | ')}`);
  if (name === 'continuous') check(r.n.cont === 2, `${tag}: continuity diaphragms at the two piers (${r.n.cont})`);
  if (name === 'skewed') check(r.n.dia === 8, `${tag}: 2 diaphragms × 4 bays (${r.n.dia})`);
  if (name === 'next') check(r.n.dia === 0 && r.n.pads === 20, `${tag}: adjacent NEXT (no diaphragm), a pad under each stem (${r.n.dia}, ${r.n.pads})`);
  const px = await drawn(p); check(px > 0.05, `${tag}: canvas drawn (${(px * 100).toFixed(1)} % of pixels)`);
  check(!r.sideways, `${tag}: no sideways scroll`);
  if (args.shots) await (await p.$('#v3dHost')).screenshot({ path: path.join(args.shots, `PR2-3d-${name}-${vw}.png`) });
  if (name === 'single' && vw === 1400) {
    // layer toggle kept in psb2.ui; camera kept and restored on reload
    await p.click('[data-v3d="deck"]'); await p.waitForTimeout(200);
    const ui = JSON.parse((await lsSnap(p))['psb2.ui']); check(ui.v3d && ui.v3d.lay && ui.v3d.lay.deck === false, 'deck layer off kept in psb2.ui');
    const box = await (await p.$('#v3d-host canvas')).boundingBox(); await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await p.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2 + 40, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(400);
    const cam = await p.evaluate(() => window.PSB3DUI.camera()); const ui2 = JSON.parse((await lsSnap(p))['psb2.ui']); check(ui2.v3d.cam && ui2.v3d.cam.p, 'camera kept in psb2.ui');
    if (args.shots) await (await p.$('#v3dHost')).screenshot({ path: path.join(args.shots, 'PR2-3d-single-1400-rotated-nodeck.png') });
    await p.reload(); await p.waitForSelector('#v3d-host canvas', { timeout: 20000 }); await p.waitForTimeout(800);
    const cam2 = await p.evaluate(() => window.PSB3DUI.camera()); check(cam2 && cam2.p.every((v, i) => Math.abs(v - ui2.v3d.cam.p[i]) < 0.6), `camera restored ${JSON.stringify(cam2 && cam2.p)} vs ${JSON.stringify(ui2.v3d.cam.p)}`);
    check(!(await p.$eval('[data-v3d="deck"]', e => e.checked)), 'deck layer still off after reload'); void cam;
    const keys = Object.keys(await lsSnap(p)); check(keys.every(k => /^psb2\./.test(k) || k === 'psbeam.inputs.v1' || k === '__psb2_probe'), 'keys ' + keys.join(','));
  }
  check(pg.errs.length === 0, `${tag}: console errors ${pg.errs.slice(0, 3).join(' | ')}`);
  check(pg.blocked.size === 0, `${tag}: blocked ${[...pg.blocked].join(' ')}`);
  await pg.b.close();
}
console.log(`${checks} checks, ${failures} failed`);
process.exit(failures ? 1 : 0);
