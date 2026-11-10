#!/usr/bin/env node
// Abutment calculator (abutment_calculator.html): the approach slab in the 3D view (AB3A) and the Drawings tab (ABDW), 2026-11-10.
// Display only: nothing here checks or changes a computed result (tests/smoke/abutment-pile-group-parity.mjs compares LAST_R main vs branch).
//   1. 3D view: no approach slab (panel I-0b off, or the equivalent dead load only) -> no slab mesh and the "Approach slab" layer toggle
//      disabled; slab on -> the slab drawn (conventional, semi-integral, integral) with its top at the top of the backwall / wall, and the
//      toggle hides it; the toggle is a per-browser key (abutcalc_d3ApSlab_v1), S (the saved project) is unchanged by it.
//   2. Drawings: for 9 projects (spread / pile footing, slab on / off, shelf / deck support, skew, water, semi-integral, integral) the three
//      sheets are built, fit their sheet, the DXF passes SharedDxf.validate, and no text of a sheet's drawing overlaps another text
//      (tests/engine/overlap.mjs textOverlaps, the Steel Bridge app's check; title block apart).
//   3. The Drawings tab opens, previews, picks a sheet (per-browser key abutcalc_dwgSheet_v1, not in S), "Download DXF" saves a valid file;
//      no horizontal scroll at 390 px; no console errors.
//   node tests/smoke/abutment-drawings.mjs
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { openPage, REPO } from '../lib.mjs';
import { textOverlaps, describe } from '../engine/overlap.mjs';

const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(REPO, 'shared/dxf.js'), 'utf8'), ctx); const X = ctx.window.SharedDxf;
let fails = 0; const check = (ok, m) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${m}`); if (!ok) fails++; };
const FILE = path.join(REPO, 'abutment_calculator.html');
const ready = p => p.waitForFunction(() => window.LAST_R, null, { timeout: 60000 });
// run setup on a copy of S, give back the result of probe, restore S
const withCase = (p, setup, probe) => p.evaluate(([su, pr]) => { const st = JSON.parse(JSON.stringify(S));
  try { eval('(' + su + ')')(); if (typeof migrate === 'function') migrate(); recalcAll(); return eval('(' + pr + ')')(); }
  catch (e) { return { err: String(e && e.stack || e) }; }
  finally { Object.keys(S).forEach(k => delete S[k]); Object.assign(S, st); recalcAll(); } }, [setup.toString(), probe.toString()]);

console.log('1. 3D view: the approach slab');
{ const o = await openPage(FILE, { vw: 1400, vh: 1000 }), p = o.p; await ready(p);
  await p.evaluate(() => activateTab('tab-3d')); await p.waitForFunction(() => typeof D3 !== 'undefined' && D3.group, null, { timeout: 30000 });
  const slabMeshes = () => { const out = []; D3.group.children.forEach(c => { if (c.isMesh && c.material && c.material.color && c.material.color.getHex() === 0xcfd8dc) { c.geometry.computeBoundingBox(); out.push(c.geometry.boundingBox.max.y); } }); return out; };
  const pr = `() => { build3D(window.LAST_R); const m = (${slabMeshes.toString()})(); const cb = document.querySelector('input[data-d3tog="ap"]'); renderTab3D(window.LAST_R);
    const g = S.geom, top = S.iab.type === 'integral' ? +S.iab.hc + +S.iab.hd : +g.tf + +g.hstem + +g.hbw; return { n: m.length, ymax: m.length ? Math.max(...m) : null, top, dis: cb && cb.disabled, have: !!cb }; }`;
  const off = await withCase(p, () => { S.apSlab.on = false; }, pr);
  check(!off.err && off.have && off.n === 0 && off.dis === true, `slab off: no slab mesh, toggle present and disabled (${JSON.stringify(off)})`);
  const leg = await withCase(p, () => { S.apSlab.on = true; S.apSlab.qEq = 1.5; }, pr);
  check(!leg.err && leg.n === 0 && leg.dis === true, `equivalent dead load only: no slab mesh, toggle disabled (${JSON.stringify(leg)})`);
  for (const [nm, su] of [['conventional', () => { S.apSlab.on = true; }], ['conventional, deck support, 30° skew', () => { S.apSlab.on = true; S.apSlab.sup = 'deck'; S.geom.skew = 30; }],
    ['semi-integral', () => { S.iab.type = 'semi'; S.apSlab.on = true; }], ['integral', () => { S.iab.type = 'integral'; S.apSlab.on = true; }]]) {
    const r = await withCase(p, su, pr);
    check(!r.err && r.n === 1 && Math.abs(r.ymax - r.top) < 1e-6 && r.dis === false, `${nm}: one slab, its top at the top of the wall ${r.top} ft (${JSON.stringify(r)})`);
  }
  const hid = await p.evaluate(() => { const s0 = JSON.stringify(S); S.apSlab.on = true; recalcAll(); renderTab3D(window.LAST_R);
    const cb = document.querySelector('input[data-d3tog="ap"]'); cb.checked = false; cb.dispatchEvent(new Event('change'));
    const color = c => c.isMesh && c.material && c.material.color && c.material.color.getHex() === 0xcfd8dc, n1 = D3.group.children.filter(color).length, key = localStorage.getItem('abutcalc_d3ApSlab_v1');
    const inS = JSON.stringify(S.ui.d3Tog).includes('"ap"'); cb.checked = true; cb.dispatchEvent(new Event('change')); const n2 = D3.group.children.filter(color).length;
    S.apSlab.on = JSON.parse(s0).apSlab.on; recalcAll(); return { n1, n2, key, inS, key2: localStorage.getItem('abutcalc_d3ApSlab_v1') }; });
  check(hid.n1 === 0 && hid.n2 === 1 && hid.key === '0' && hid.key2 === '1' && !hid.inS, `layer toggle hides / shows the slab; per-browser key, not in S.ui.d3Tog (${JSON.stringify(hid)})`);
  check(!o.errs.length, `console errors: ${o.errs.length} ${o.errs.slice(0, 3).join(' | ')}`);
  await o.b.close(); }

console.log('2. Drawings: sheets, DXF validity, no overlapping text');
{ const o = await openPage(FILE, { vw: 1400, vh: 1000 }), p = o.p; await ready(p);
  const cases = {
    'default (spread footing)': () => {}, 'approach slab': () => { S.apSlab.on = true; }, 'pile footing + slab': () => { S.apSlab.on = true; S.fnd.branch = 'pile'; },
    'pile footing, 30° skew, no wings': () => { S.fnd.branch = 'pile'; S.geom.skew = 30; S.wing.on = false; },
    'slab on the deck, 25° skew, far end on soil': () => { S.apSlab.on = true; S.apSlab.sup = 'deck'; S.geom.skew = 25; S.apSlab.far = 'soil'; },
    'water table, in-line wings': () => { S.geom.hw = 6; S.wing.orient = 'inline'; }, 'pile footing, one pile omitted': () => { S.fnd.branch = 'pile'; recalcAll(); S.piles.coords[3].active = false; },
    'semi-integral + slab': () => { S.iab.type = 'semi'; S.apSlab.on = true; }, 'integral + slab': () => { S.iab.type = 'integral'; S.apSlab.on = true; } };
  let n = 0;
  for (const [nm, su] of Object.entries(cases)) {
    const r = await withCase(p, su, () => { const B = abdwBuild(window.LAST_R), t = B.D.toDXF({ ltscale: 1 }); return { valid: SharedDxf.validate(t), sheets: B.S.map(s => ({ id: s.id, k: s.k, over: s.over, E: B.D.E.slice(s.i0, s.iC) })) }; });
    if (r.err) { check(false, `${nm}: ${r.err}`); continue; }
    check(r.valid.ok && r.sheets.length === 3, `${nm}: 3 sheets (${r.sheets.map(s => s.id + ' 1:' + s.k).join(', ')}), DXF valid${r.valid.ok ? '' : ': ' + r.valid.errors.slice(0, 3).join('; ')}`);
    for (const s of r.sheets) { const ov = textOverlaps({ E: s.E }, X); n++;
      check(!s.over && ov.length === 0, `${nm}, ${s.id}: fits the sheet, ${ov.length} text overlaps${ov.length ? ': ' + ov.slice(0, 4).map(describe).join(' | ') : ''}`); }
  }
  console.log(`       ${n} sheet drawings checked`);
  check(!o.errs.length, `console errors: ${o.errs.length} ${o.errs.slice(0, 3).join(' | ')}`);
  await o.b.close(); }

console.log('3. The Drawings tab');
for (const vw of [1440, 390]) {
  const o = await openPage(FILE, { vw, vh: 900 }), p = o.p; await ready(p);
  const s0 = await p.evaluate(() => JSON.stringify(S));
  await p.click('#tabbar .tab[data-tab="tab-dwg"]'); await p.waitForSelector('#abdwSheet .sdx-view, .abdwBox svg', { timeout: 30000 }).catch(() => {});
  const a = await p.evaluate(() => ({ svg: !!document.querySelector('.abdwBox svg'), n: document.querySelectorAll('#abdwSheet option').length, tab: S.ui.tab, on: ABDW.on }));
  check(a.svg && a.n === 3 && a.on && a.tab !== 'tab-dwg', `${vw} px: preview shown, 3 sheets in the list, the tab not stored in S.ui.tab (${JSON.stringify(a)})`);
  await p.selectOption('#abdwSheet', 'plan');
  const b = await p.evaluate(() => ({ cur: ABDW.cur, key: localStorage.getItem('abutcalc_dwgSheet_v1'), head: document.querySelector('.abdwHead').textContent, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  check(b.cur === 'plan' && b.key === 'plan' && /FOOTING PLAN/.test(b.head), `${vw} px: sheet picked and kept per browser (${b.head})`);
  check(b.sw <= b.cw, `${vw} px: no horizontal page scroll (${b.sw} <= ${b.cw})`);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#abdwDxf')]);
  const f = await dl.path(), txt = fs.readFileSync(f, 'utf8'), v = X.validate(txt);
  check(v.ok && /ABUTMENT SECTION/.test(txt) && /_abutment_sheets\.dxf$/.test(dl.suggestedFilename()), `${vw} px: Download DXF: ${dl.suggestedFilename()}, ${txt.length} chars, valid ${v.ok}`);
  const s1 = await p.evaluate(() => JSON.stringify(S));
  check(s0 === s1, `${vw} px: the project (S) unchanged by the Drawings tab`);
  await p.click('#tabbar .tab[data-tab="tab-loads"]');
  const c = await p.evaluate(() => ({ on: ABDW.on, act: document.querySelector('#tabpages .tabpage.active').id }));
  check(!c.on && c.act === 'tab-loads', `${vw} px: back to Tab 1 (${JSON.stringify(c)})`);
  check(!o.errs.length, `${vw} px: console errors: ${o.errs.length} ${o.errs.slice(0, 3).join(' | ')}`);
  await o.b.close();
}
console.log(fails ? `\n${fails} FAILED` : '\nall ok');
process.exit(fails ? 1 : 0);
