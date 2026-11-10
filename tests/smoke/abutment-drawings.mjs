#!/usr/bin/env node
// Abutment calculator (abutment_calculator.html): the approach slab in the 3D view (AB3A) and the Drawings tab (ABDW), 2026-11-10.
// Display only: nothing here checks or changes a computed result (tests/smoke/abutment-pile-group-parity.mjs compares LAST_R main vs branch).
//   1. 3D view: no approach slab (panel I-0b off, or the equivalent dead load only) -> no slab mesh and the "Approach slab" layer toggle
//      disabled; slab on -> the slab drawn (conventional, semi-integral, integral) with its top at the top of the backwall / wall, and the
//      toggle hides it; the toggle is a per-browser key (abutcalc_d3ApSlab_v1), S (the saved project) is unchanged by it.
//      ABD2 (2026-11-10): the slab at its skew in plan (L along the roadway at θ; far end parallel to the abutment or square to the
//      roadway) and the shelf (b_S x h_S) under the slab bottom, conventional / semi-integral / integral.
//   2. Drawings: for 9 projects (spread / pile footing, slab on / off, shelf / deck support, skew, water, semi-integral, integral) every
//      sheet is built (the three of ABDW, then the ABD2 detail sheets that apply: approach slab and shelf, seat, joint / pile embedment,
//      wingwall, general notes; numbered N OF M), fits its sheet, the DXF passes SharedDxf.validate, and no text of a sheet's drawing
//      overlaps another text (tests/engine/overlap.mjs textOverlaps, the Steel Bridge app's check; title block apart).
//      ABEL (2026-11-10): the same projects again with a beam seat elevation (panel I-1): the "EL." marks stay clear of every other text.
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
  // ABD2: the slab at its skew (edges along the roadway at θ; far end parallel to the abutment or square to the roadway) on the shelf
  const geo = `() => { build3D(window.LAST_R); const P = window.LAST_R.ap, out = { slab: null, shelf: null };
    D3.group.children.forEach(c => { if (!c.isMesh || !c.material || !c.material.color) return; const h = c.material.color.getHex(); c.geometry.computeBoundingBox(); const b = c.geometry.boundingBox;
      const e = { x: b.max.x - b.min.x, z: b.max.z - b.min.z, y0: b.min.y, y1: b.max.y };
      if (h === 0xcfd8dc) out.slab = e; if (h === 0xb5b5a6) out.shelf = e; });
    return { ...out, L: P.L, Lw: P.Lw, W: P.W, th: P.th, rule: P.rule, t: P.t, bS: P.bS, hS: P.hS, Lab: +S.geom.Lab }; }`;
  for (const [nm, su] of [['conventional 0°', () => { S.apSlab.on = true; S.geom.skew = 0; }], ['conventional 30°, far end follows', () => { S.apSlab.on = true; S.geom.skew = 30; }],
    ['conventional 30°, far end square', () => { S.apSlab.on = true; S.geom.skew = 30; S.apSlab.skew = 'square'; }], ['semi-integral 30°', () => { S.iab.type = 'semi'; S.apSlab.on = true; S.geom.skew = 30; }],
    ['integral 20°', () => { S.iab.type = 'integral'; S.apSlab.on = true; S.geom.skew = 20; }]]) {
    const r = await withCase(p, su, geo); if (r.err) { check(false, `${nm}: ${r.err}`); continue; }
    const c = Math.cos(r.th * Math.PI / 180), sn = Math.sin(r.th * Math.PI / 180), xr = r.rule === 'square' ? (r.L + r.Lw * sn) * c : r.L * c, zr = r.Lw + r.L * sn;   // square: the longest side L + W tan θ ends inside the span of the shortest
    const ok = r.slab && Math.abs(r.slab.x - xr) < 1e-6 && Math.abs(r.slab.z - zr) < 1e-6 && r.shelf && Math.abs(r.shelf.x - r.bS / 12) < 1e-6 && Math.abs(r.shelf.z - Math.min(r.Lw, r.Lab)) < 1e-6
      && Math.abs(r.shelf.y1 - r.slab.y0) < 1e-6 && Math.abs(r.shelf.y1 - r.shelf.y0 - r.hS / 12) < 1e-6;
    check(ok, `${nm}: slab ${r.slab && r.slab.x.toFixed(3)} x ${r.slab && r.slab.z.toFixed(3)} ft in plan (expected ${xr.toFixed(3)} x ${zr.toFixed(3)}: L ${r.L} along the roadway at θ ${r.th}°, ${r.rule}), shelf ${r.bS} in x ${r.hS} in under the slab bottom along ${Math.min(r.Lw, r.Lab).toFixed(2)} ft`);
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
    'stem shelf: backwall offset e = 10 in + slab (ABSH)': () => { S.apSlab.on = true; S.apSlab.t = 0.75; S.geom.tbw = 2; S.geom.tst = 5.5; S.geom.tsb = 5.5; S.geom.bwOff = 10; S.geom.shD = 9; },
    'stem shelf, no slab, pile footing (ABSH)': () => { S.fnd.branch = 'pile'; S.geom.bwOff = 8; S.geom.shD = 12; },
    'semi-integral + slab': () => { S.iab.type = 'semi'; S.apSlab.on = true; }, 'integral + slab': () => { S.iab.type = 'integral'; S.apSlab.on = true; } };
  // ABEL (2026-11-10): every case again with a beam seat elevation (the EL. marks on the section and detail sheets), plus water in front and D_f
  for (const [nm, su] of Object.entries({ ...cases, 'water both sides, passive D_f': () => { S.geom.hw = 6; S.geom.hwFr = 2; S.fnd.usePassive = true; } }))
    cases[nm + ', seat El. 52.00'] = eval('() => { (' + su.toString() + ')(); S.geom.elSeat = 52; }');   // a source text: withCase sends it to the page
  let n = 0;
  for (const [nm, su] of Object.entries(cases)) {
    const r = await withCase(p, su, () => { const B = abdwBuild(window.LAST_R), t = B.D.toDXF({ ltscale: 1 }), G = B.G;
      // ABD2: the sheets expected from the inputs (the first three always; then the detail sheets that apply)
      const want = ['sec', 'plan', 'bars'].concat(G.ap ? ['apslab'] : [], G.integ ? [] : ['seat'], ['joint'], S.wing.on && window.LAST_R.wing ? ['wing'] : [], ['notes']);
      return { valid: SharedDxf.validate(t), want, sheetNo: B.S.map(s => s.sheetEnt.s), sheets: B.S.map(s => ({ id: s.id, k: s.k, over: s.over, E: B.D.E.slice(s.i0, s.iC) })) }; });
    if (r.err) { check(false, `${nm}: ${r.err}`); continue; }
    const ids = r.sheets.map(s => s.id).join(',');
    check(r.valid.ok && ids === r.want.join(',') && r.sheetNo.every((t, j) => t === `${j + 1} OF ${r.sheets.length}`), `${nm}: ${r.sheets.length} sheets (${r.sheets.map(s => s.id + ' 1:' + s.k).join(', ')}), expected ${r.want.join(',')}, numbered N OF ${r.sheets.length}, DXF valid${r.valid.ok ? '' : ': ' + r.valid.errors.slice(0, 3).join('; ')}`);
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
  const a = await p.evaluate(() => ({ svg: !!document.querySelector('.abdwBox svg'), n: document.querySelectorAll('#abdwSheet option').length, nb: ABDW.B.S.length, tab: S.ui.tab, on: ABDW.on }));
  check(a.svg && a.n === a.nb && a.n >= 6 && a.on && a.tab !== 'tab-dwg', `${vw} px: preview shown, ${a.n} sheets in the list, the tab not stored in S.ui.tab (${JSON.stringify(a)})`);
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
