#!/usr/bin/env node
// Abutment Calculator <-> Bridge Substructure Loading: the abutment exchange (ABX, 2026-11-11; HANDOFF.md §4.5 definition block, §4.15).
//   node tests/smoke/abutment-subloads-exchange.mjs [--shots <dir>]
// A. SubLoads -> calculator (abutmentLoads): SubLoads' "Send to Abutment Calculator" writes the channel, its .updatedAt and the
//    per-project copy bridgeSuite.v1.abutmentLoads.by.subloads.<project id>; each abutment carries the additive definition block; the
//    "Export abutments" file has none (format unchanged). The calculator's pull: default ticks per ownership (a default project: geometry
//    and approach slab ticked; soil, seismic settings unticked; a project with its own geometry: geometry unticked and listed under "Not
//    ticked"); L_ftg carried; elevations applied; the project picker when this browser holds copies of two projects (preselects the one
//    named like the open project); Import hand-off (JSON); 390 px; no console errors.
// B. calculator -> SubLoads (abutmentDef): see the second half of the file (part B).
import fs from 'fs';
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

let fails = 0; const check = (ok, m) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${m}`); if (!ok) fails++; };
const SHOTS = (() => { const i = process.argv.indexOf('--shots'); return i > 0 ? process.argv[i + 1] : null; })();
const SLF = path.join(REPO, 'Bridge Substructure Loading.html'), ABF = path.join(REPO, 'abutment_calculator.html');
const NS = 'bridgeSuite.v1.';

async function subloadsSend(setup) {
  const o = await openPage(SLF);
  await o.p.waitForFunction('typeof MODEL !== "undefined" && MODEL.G && MODEL.UG', null, { timeout: 60000 });
  const r = await o.p.evaluate(s => { if (s) { eval('(' + s + ')')(); recompute(); }
    document.getElementById('btn-abx-send').click(); const ls = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^bridgeSuite\.v1\.abutmentLoads/.test(k)) ls[k] = localStorage.getItem(k); }
    const ex = abutExportData(); return { ls, exportHasDef: ex.abutments.some(a => a.definition), exportNotes: ex.abutments[0].notes }; }, setup ? setup.toString() : null);
  await new Promise(res => setTimeout(res, 300));
  r.errs = o.errs; await o.b.close(); return r;
}
const DLG = async (p, fn, arg) => p.evaluate(fn, arg);
const groupsOf = () => Object.fromEntries([...document.getElementById('axh-dlg').querySelectorAll('input[data-axh-g]')].map(c => [c.getAttribute('data-axh-g'), { on: c.checked, dis: c.disabled }]));

console.log('A1. SubLoads send: channel, per-project copy, definition block; Export abutments unchanged');
const s1 = await subloadsSend(() => { P.units[0].abut.Lftg = 50; });
const keys = Object.keys(s1.ls), pay = JSON.parse(s1.ls[NS + 'abutmentLoads']);
check(keys.includes(NS + 'abutmentLoads.updatedAt') && keys.includes(NS + 'abutmentLoads.by.subloads.~Example three-span continuous'), 'channel, .updatedAt and the per-project copy by.subloads.<pid>');
check(pay.schemaVersion === 1 && pay.abutments.every(a => a.definition && a.definition.v === 1), 'schemaVersion stays 1; every abutment has definition v1');
const d0 = pay.abutments[0].definition;
check(d0.lengths.Lftg === 50 && d0.lengths.LftgAuto === false && d0.lengths.LabAuto === true, 'definition: L_ftg = 50 (entered), L_ab auto');
check(d0.soil && d0.soil.gamma === 0.12 && d0.approachSlab && d0.seismic && d0.superstructure.brgHIn === 10.5, 'definition: soil, approach slab, seismic, bearing + pedestal height');
check(!s1.exportHasDef && s1.exportNotes.some(n => /^Earth pressure, soil, and backfill properties are not exported/.test(n)), '"Export abutments" file: no definition, notes as before');
check(s1.errs.length === 0, 'SubLoads: no console errors' + (s1.errs.length ? ': ' + s1.errs.join(' | ') : ''));

console.log('A2. calculator pull, default project: ticks per ownership, apply');
let o = await openPage(ABF, { ls: s1.ls, vw: 1400, vh: 1000 });
await o.p.waitForFunction(() => window.LAST_R, null, { timeout: 60000 });
let r = await o.p.evaluate(G => { document.getElementById('axh-pull').click(); const g = eval('(' + G + ')')(); const t = document.getElementById('axh-dlg').innerText; return { g, t }; }, groupsOf.toString());
check(r.g.geom.on && r.g.aps.on && r.g.bridge.on && r.g.elev.on && r.g.brg.on && r.g.layout.on && r.g.dc.on, 'ticked: geometry, approach slab (default project), bridge data, elevations, bearing, layout, DC');
check(!r.g.soil.on && !r.g.soil.dis && !r.g.seisset.on && !r.g.seisset.dis, 'offered unticked: soil and backfill, seismic settings');
{ const df = (r.t.split('Different definitions in the two tools (information only)')[1] || '');   // ABXM: LS and the seismic location are mapped; TU / WS / WL at the seat in both tools
  check(/Height of BR \(and CE\)/.test(df) && !/TU \/ WS \/ WL/.test(df) && !/only under MassDOT/.test(df) && !/ΔP_AE height|Seismic earth pressure location/.test(df), 'information rows: BR / CE height only (no TU / WS / WL, LS or ΔP_AE row: mapped)'); }
check(/Not ticked: current vs SubLoads for \d+ groups? \(kept as they are\)/.test(r.t), 'unticked groups shown current vs incoming');
if (SHOTS) { await o.p.setViewportSize({ width: 1100, height: 1400 }); await o.p.screenshot({ path: path.join(SHOTS, 'abutment-pull-from-subloads.png'), fullPage: false }); }
r = await o.p.evaluate(() => { document.getElementById('axh-apply').click(); return { g: JSON.parse(JSON.stringify(S.geom)), soil: JSON.parse(JSON.stringify(S.soil)), src: S.subloadsSrc, sk: S.seismic.khRAuto }; });
check(r.g.Lftg === 50 && Math.abs(r.g.Lab - 46.07) < 0.001 && r.g.elSeat > 117 && r.g.elBrgH === 10.5 && r.g.elGird === 63, 'applied: L_ftg 50, L_ab 46.07, elevations');
check(r.soil.gamma === 0.12 && r.soil.phi === 32 && r.sk === true, 'soil and seismic settings untouched');
check(r.src.pid === '~Example three-span continuous' && r.src.groups.includes('elev') && /^[0-9a-f]{8}$/.test(r.src.defHash), 'S.subloadsSrc: pid, groups, defHash');
check(o.errs.length === 0, 'no console errors' + (o.errs.length ? ': ' + o.errs.join(' | ') : ''));
await o.b.close();

console.log('A3. a project with its own geometry: geometry unticked, listed under "Not ticked"');
o = await openPage(ABF, { ls: s1.ls, vw: 1400 });
await o.p.waitForFunction(() => window.LAST_R, null, { timeout: 60000 });
r = await o.p.evaluate(G => { S.geom.tst = 5; S.geom.tsb = 5; migrate(); buildInputs(); recalcAll(); document.getElementById('axh-pull').click(); const g = eval('(' + G + ')')(), d = document.getElementById('axh-dlg'), det = d.querySelector('details.axh-off');
  return { g, t: d.innerText, det: det ? det.textContent : '' }; }, groupsOf.toString());
check(!r.g.geom.on && !r.g.geom.dis && r.g.aps.on, 'geometry unticked (own values), approach slab still ticked (default slab)');
check(/Abutment geometry and lengths — not ticked/.test(r.det) && /Stem thickness, top \(ft\)5\s*4 differs/.test(r.det.replace(/ /g, ' ')), 'the geometry rows: current 5 vs incoming 4, marked "differs"');
check(/Unticked by default: this project has its own abutment geometry/.test(r.t), 'the group says why it is unticked');
r = await o.p.evaluate(() => { document.getElementById('axh-apply').click(); return { t: S.geom.tst, n: S.subloadsSrc.notes || [] }; });
check(r.t === 5 && r.n.some(x => /abutment geometry kept/.test(x)), 'apply: geometry kept, recorded in the source notes');
await o.b.close();

console.log('A4. two projects in this browser: the picker; Import JSON; 390 px');
const other = JSON.parse(JSON.stringify(pay)); other.project = { name: 'Route 9 over Mill Brook', bridgeId: '' }; other.producedAt = new Date(Date.now() + 1000).toISOString(); other.abutments[0].definition.footing.toe = 4.5;
const ls2 = Object.assign({}, s1.ls, { [NS + 'abutmentLoads.by.subloads.~Route 9 over Mill Brook']: JSON.stringify(other) });
o = await openPage(ABF, { ls: ls2, vw: 390, vh: 900 });
await o.p.waitForFunction(() => window.LAST_R, null, { timeout: 60000 });
r = await o.p.evaluate(() => { S.proj.name = 'Route 9 over Mill Brook'; document.getElementById('axh-pull').click(); const pk = document.getElementById('axh-pk');
  const rows = pk ? pk.querySelectorAll('tr[data-axh-pk]').length : 0, sel = pk ? [...pk.querySelectorAll('input[type=radio]')].findIndex(x => x.checked) : -1, t = pk ? pk.innerText : '';
  const fit = document.documentElement.scrollWidth <= window.innerWidth + 1;
  return { rows, sel, t, fit }; });
check(r.rows === 2 && r.sel === 0 && /Preselected: the project named like this one/.test(r.t), 'picker: 2 projects, the one named like this project preselected');
check(r.fit, '390 px: picker, no horizontal page scroll');
if (SHOTS) await o.p.screenshot({ path: path.join(SHOTS, 'abutment-pull-picker-390.png') });
r = await o.p.evaluate(() => { document.getElementById('axh-pk-next').click(); const d = document.getElementById('axh-dlg'); const fit = document.documentElement.scrollWidth <= window.innerWidth + 1;
  const tds = [...d.querySelectorAll('td.axh-note')].every(td => td.scrollWidth <= td.clientWidth + 1);
  return { open: !!d, t: d ? d.innerText : '', fit, tds }; });
check(r.open && /Route 9 over Mill Brook/.test(r.t), 'Next opens the review of the chosen project');
check(r.fit && r.tds, '390 px: review dialog, no horizontal page scroll; note rows wrap');
if (SHOTS) await o.p.screenshot({ path: path.join(SHOTS, 'abutment-pull-from-subloads-390.png') });
r = await o.p.evaluate(() => { document.getElementById('axh-apply').click(); return { toe: S.geom.Ltoe, pid: S.subloadsSrc.pid }; });
check(r.toe === 4.5 && r.pid === '~Route 9 over Mill Brook', 'applied from that project (toe 4.5), pid recorded');
check(o.errs.length === 0, 'no console errors' + (o.errs.length ? ': ' + o.errs.join(' | ') : ''));
await o.b.close();
o = await openPage(ABF, { vw: 1400 });
await o.p.waitForFunction(() => window.LAST_R, null, { timeout: 60000 });
const tmpf = path.join(REPO, 'tests', '.abx-import.json'); fs.writeFileSync(tmpf, JSON.stringify(pay));
await o.p.setInputFiles('#axh-file', tmpf); await o.p.waitForSelector('#axh-dlg', { timeout: 10000 });
r = await o.p.evaluate(() => { document.getElementById('axh-apply').click(); return { via: S.subloadsSrc.via, Lftg: S.geom.Lftg }; });
fs.unlinkSync(tmpf);
check(/^file: /.test(r.via) && r.Lftg === 50, 'Import hand-off (JSON): the same review; via file');
check(o.errs.length === 0, 'no console errors');
await o.b.close();

// ---------------------------------------------------------------------------------------------------------------------------------
// B. calculator -> SubLoads (abutmentDef, HANDOFF.md §4.15): "Send abutment to SubLoads" writes the channel, .updatedAt and the copy
//    bridgeSuite.v1.abutmentDef.by.abutment.<project id>; an integral abutment is refused. SubLoads' "Pull abutment from the Abutment
//    Calculator": project picker (preselects the project named like the open one), target unit, default ticks per ownership (geometry,
//    soil, approach slab ticked; pad, top-of-footing El., bridge-wide unticked), battered-stem note, apply into Abut. 2, P.units[k].abutSrc,
//    the unit pane note and the report row, Import hand-off (JSON), 390 px. Round trip: SubLoads default Abut. 1 -> calculator (default
//    project, default ticks) -> SubLoads (default ticks): no SubLoads input and no result changes (only abutSrc is added).
const grab = re => p => p.evaluate(r => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (new RegExp(r).test(k)) o[k] = localStorage.getItem(k); } return o; }, re);
async function abSend(ls, setup) {
  const o = await openPage(ABF, { ls, vw: 1400 });
  await o.p.waitForFunction(() => window.LAST_R, null, { timeout: 60000 });
  const r = await o.p.evaluate(s => { if (s) { eval('(' + s + ')')(); migrate(); buildInputs(); recalcAll(); }
    document.getElementById('abd-send').click(); return { sent: (document.getElementById('abd-sent') || {}).textContent || '' }; }, setup ? setup.toString() : null);
  await new Promise(res => setTimeout(res, 300)); r.ls = await grab('^bridgeSuite\\.v1\\.abutmentDef')(o.p); r.dialogs = o.dialogs; r.errs = o.errs; await o.b.close(); return r;
}
const SL_SNAP = () => { const o = {}; P.units.forEach((u, k) => { const C = combine(k); o[k] = Object.fromEntries(Object.entries(C).map(([id, c]) => [id, c && c.max ? [Array.from(c.max), Array.from(c.min)] : null])); }); return o; };
async function slPull(ls, { name, pick, unit, vw = 1400, shot, setup } = {}) {
  const o = await openPage(SLF, { ls, vw, vh: 1000 });
  await o.p.waitForFunction('typeof MODEL !== "undefined" && MODEL.G && MODEL.UG', null, { timeout: 60000 });
  const r = await o.p.evaluate(async ([name, pick, unit, snapS, setup]) => {
    const snap = eval('(' + snapS + ')'), w = ms => new Promise(r => setTimeout(r, ms));
    if (setup) { eval('(' + setup + ')')(); recompute(); }
    if (name) P.meta.name = name; P.ui.itab = 'project'; buildSide(); await w(100);
    const P0 = JSON.parse(JSON.stringify(P)), r0 = snap(), marker = !!document.getElementById('abd-new');
    document.getElementById('abd-pull').click(); await w(600);
    const pk = document.getElementById('gxp-modal'), pkRows = pk ? pk.querySelectorAll('tr[data-gxp-row]').length : 0, pkSel = pk ? [...pk.querySelectorAll('input[type=radio]')].findIndex(x => x.checked) : -1;
    if (pick != null) { pk.querySelector(`tr[data-gxp-row="${pick}"]`).click(); await w(100); }
    document.getElementById('gxp-next').click(); await w(200);
    const m = () => document.getElementById('abd-modal');
    if (unit != null) { const sel = m().querySelector('select[data-abd="k"]'); sel.value = String(unit); sel.dispatchEvent(new Event('change', { bubbles: true })); await w(100); }
    const ticks = Object.fromEntries([...m().querySelectorAll('input[data-abd-g]')].map(c => [c.dataset.abdG, c.checked && !c.disabled])), txt = m().innerText;
    const fit = document.documentElement.scrollWidth <= window.innerWidth + 1, box = m().querySelector('.modal-box'), boxFit = box.getBoundingClientRect().right <= window.innerWidth + 1;
    return { P0, r0, marker, pkRows, pkSel, ticks, txt, fit, boxFit };
  }, [name || null, pick == null ? null : pick, unit == null ? null : unit, SL_SNAP.toString(), setup ? setup.toString() : null]);
  if (shot) await o.p.screenshot({ path: shot });
  Object.assign(r, await o.p.evaluate(async snapS => { const snap = eval('(' + snapS + ')');
    document.getElementById('abd-apply').click(); await new Promise(r => setTimeout(r, 500));
    const P1 = JSON.parse(JSON.stringify(P)), r1 = snap(); let rpt = ''; try { rpt = basisExtra(); } catch (e) { rpt = 'ERR ' + e.message; }
    P.ui.itab = 'units'; P.ui.sel = P.units.findIndex(u => u.abutSrc); buildSide(); const note = (document.getElementById('abd-src') || {}).textContent || '';
    return { P1, r1, rpt, note }; }, SL_SNAP.toString()));
  r.errs = o.errs; r.dialogs = o.dialogs; await o.b.close(); return r;
}
const diffP = (a, b) => { const d = []; const walk = (x, y, p) => { if (x && y && typeof x === 'object' && typeof y === 'object') new Set([...Object.keys(x), ...Object.keys(y)]).forEach(k => walk(x[k], y[k], p + '.' + k)); else if (JSON.stringify(x) !== JSON.stringify(y)) d.push(p); }; walk(a, b, 'P'); return d; };

console.log('B1. calculator send; integral refused');
const b1 = await abSend(null);
const bk = Object.keys(b1.ls), dpay = JSON.parse(b1.ls[NS + 'abutmentDef']);
check(bk.includes(NS + 'abutmentDef.updatedAt') && bk.includes(NS + 'abutmentDef.by.abutment.~Example Single-Span Bridge'), 'channel, .updatedAt and the per-project copy by.abutment.<pid>');
check(dpay._schema === 'bridge-abutment-def' && dpay.schemaVersion === 1 && dpay.producer === 'Abutment Calculator' && dpay.abutType === 'conv' && /^[0-9a-f]{8}$/.test(dpay.contentHash), 'envelope: schema, producer, type, content hash');
check(dpay.definition.lengths.Lab === 44 && dpay.definition.stem.tTop === 4.5 && dpay.definition.footing.W === 13 && dpay.definition.info.wingwalls.length === 1, 'definition: L_ab 44, stem 4.5, footing 3.5 + 4.5 + 5 = 13, wingwalls listed');
check(/project "Example Single-Span Bridge"/.test(b1.sent) && b1.errs.length === 0, 'Last sent line; no console errors');
const bI = await abSend(null, () => { S.iab.type = 'integral'; });
check(bI.dialogs.some(d => /Only a conventional abutment can be sent/.test(d)) && !Object.keys(bI.ls).length, 'integral abutment: refused, nothing sent');

console.log('B2. SubLoads pull: picker, target unit, ticks, battered stem, apply into Abut. 2');
const bat = await abSend(null, () => { S.proj.name = 'Route 9 over Mill Brook'; S.geom.tsb = 5.5; S.geom.Lab = 50; S.soil.phi = 34; });
const ls3 = Object.assign({}, b1.ls, bat.ls);
const b2 = await slPull(ls3, { name: 'Route 9 over Mill Brook', unit: 3, shot: SHOTS ? path.join(SHOTS, 'subloads-pull-from-abutment.png') : null });
check(b2.marker, 'Hand-offs: new-data marker before any pull (a copy named like this project)');
check(b2.pkRows === 2 && b2.pkSel === 0, 'picker: 2 projects, the one named like this project preselected');
check(b2.ticks.geom && b2.ticks.soil && b2.ticks.aps && !b2.ticks.brg && !b2.ticks.ftgEl && !b2.ticks.bridgewide, 'ticks: geometry, soil, approach slab; not pad, top of footing, bridge-wide');
check(/Battered stem: the calculator has t_top = 4\.5 ft, t_bot = 5\.5 ft/.test(b2.txt) && /applies to every unit/.test(b2.txt) && /Wingwalls/.test(b2.txt) && /ΔP_AE height/.test(b2.txt), 'battered-stem note, bridge-wide label, wingwalls and definition rows');
{ const inf = b2.txt.split('Not applied (information)')[1] || '';   // ABXM
  check(/Seismic earth pressure location/.test(b2.txt.split('Not applied (information)')[0]) && /Height of BR \(and CE\)/.test(inf) && !/top of bearing\b/.test(inf) && !/only under MassDOT/.test(inf) && !/ΔP_AE height/.test(inf), 'the location offered in the bridge-wide group; information: BR / CE height row, no TU / WS / WL, LS or ΔP_AE row'); }
const u3 = b2.P1.units[3];
check(u3.abut.L === 50 && u3.abut.stemT === 4.5 && u3.ftg.W === 3.5 + 5.5 + 5 && u3.earth.phi === 34 && b2.P1.units[0].abut.L === b2.P0.units[0].abut.L, 'applied to Abut. 2 only: L_ab 50, stem 4.5, footing 14, φ 34');
check(u3.abutSrc && u3.abutSrc.pid === '~Route 9 over Mill Brook' && u3.abutSrc.groups.join() === 'geom,soil,aps' && /battered stem/.test((u3.abutSrc.notes || []).join()), 'P.units[3].abutSrc recorded (pid, groups, battered note)');
check(b2.P1.br.khR === b2.P0.br.khR && b2.P1.units[3].elast.L === b2.P0.units[3].elast.L && b2.P1.units[3].topFtg === b2.P0.units[3].topFtg, 'unticked: bridge-wide, pad and elevations unchanged');
check(/Abutment definition/.test(b2.rpt) && /Abut\. 2: abutment from Abutment Calculator/.test(b2.rpt) && /abutment from Abutment Calculator/.test(b2.note), 'report row and the unit pane note');
check(b2.errs.length === 0, 'no console errors' + (b2.errs.length ? ': ' + b2.errs.join(' | ') : ''));

console.log('B3. round trip: SubLoads default Abut. 1 -> calculator -> SubLoads');
const s0 = await subloadsSend(null);
const o4 = await openPage(ABF, { ls: s0.ls, vw: 1400 }); await o4.p.waitForFunction(() => window.LAST_R, null, { timeout: 60000 });
await o4.p.evaluate(() => { S.proj.name = 'Example three-span continuous'; document.getElementById('axh-pull').click(); document.getElementById('axh-apply').click(); recalcAll(); document.getElementById('abd-send').click(); });
await new Promise(res => setTimeout(res, 300)); const lsRT = await grab('^bridgeSuite\\.v1\\.abutmentDef')(o4.p); await o4.b.close();
const rt = await slPull(lsRT, {});
const dRT = diffP(rt.P0, rt.P1).filter(p => !/^P\.ui\./.test(p));
check(dRT.length === 1 && dRT[0] === 'P.units.0.abutSrc', 'only P.units[0].abutSrc is added: ' + dRT.join(', '));
check(JSON.stringify(rt.r0) === JSON.stringify(rt.r1), 'every unit\'s combinations identical after the round trip');
check(Object.values(rt.ticks).filter(Boolean).length === 3 && !/changes/.test(rt.txt.split('Bearing pad')[0].split('Groups')[1] || ''), 'default ticks; no changed row in the ticked groups');
check(rt.errs.length === 0, 'no console errors');

console.log('B4. Import hand-off (JSON); 390 px');
const o5 = await openPage(SLF, { vw: 390, vh: 900 }); await o5.p.waitForFunction('typeof MODEL !== "undefined" && MODEL.G && MODEL.UG', null, { timeout: 60000 });
await o5.p.evaluate(() => { P.ui.itab = 'project'; buildSide(); });
const tf2 = path.join(REPO, 'tests', '.abx-import-def.json'); fs.writeFileSync(tf2, JSON.stringify(dpay));
await o5.p.setInputFiles('#abd-hf-in', tf2); await o5.p.waitForSelector('#abd-modal .modal-box', { timeout: 10000 }); fs.unlinkSync(tf2);
const r5 = await o5.p.evaluate(() => { const m = document.getElementById('abd-modal'), box = m.querySelector('.modal-box');
  return { via: /via file: /.test(m.innerText), fit: document.documentElement.scrollWidth <= window.innerWidth + 1, box: box.getBoundingClientRect().right <= window.innerWidth + 1 }; });
if (SHOTS) await o5.p.screenshot({ path: path.join(SHOTS, 'subloads-pull-from-abutment-390.png') });
const r5b = await o5.p.evaluate(async () => { document.getElementById('abd-apply').click(); await new Promise(r => setTimeout(r, 400)); return P.units[0].abutSrc && P.units[0].abutSrc.via; });
check(r5.via && /^file: /.test(r5b || ''), 'Import hand-off (JSON): the same review, via file');
check(r5.fit && r5.box, '390 px: no horizontal page scroll; the dialog fits the screen');
check(o5.errs.length === 0, 'no console errors' + (o5.errs.length ? ': ' + o5.errs.join(' | ') : ''));
await o5.b.close();
// C. ABXM (2026-11-11): the LS option with the slab and the seismic earth pressure location, both ways, with the groups ticked
console.log('C1. calculator (c) 0.45, slab on, LS kept -> SubLoads, bridge-wide ticked');
const c1 = await abSend(null, () => { S.proj.name = 'Example three-span continuous'; S.seismic.hEQmode = 'comb'; S.seismic.hAEr = 0.45; S.apSlab.on = true; S.apSlab.lsRed = false; });
const oc = await openPage(SLF, { ls: c1.ls, vw: 1400 }); await oc.p.waitForFunction('typeof MODEL !== "undefined" && MODEL.G && MODEL.UG', null, { timeout: 60000 });
const rc = await oc.p.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); P.br.eqSa = SA_T.map(T => T === 0 ? 0.15 : Math.min(0.35, 0.12 / Math.max(T, 0.01))).map(v => String(+v.toFixed(4))); P.br.eqSiteClass = 'D'; MODEL.cacheEE = null; recompute();   // A_s = 0.15 (as bsl-pae-loc)
  P.ui.itab = 'project'; buildSide(); await w(100);
  const z0 = earthLoads(0).E.seis; document.getElementById('abd-pull').click(); await w(600); document.getElementById('gxp-next').click(); await w(200);
  const m = document.getElementById('abd-modal'), cb = m.querySelector('input[data-abd-g="bridgewide"]'); cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); await w(100);
  const txt = document.getElementById('abd-modal').innerText; document.getElementById('abd-apply').click(); await w(500);
  const E = earthLoads(0).E; return { txt, br: { m: P.br.hEQmode, a: P.br.hAEr }, ls: P.units[0].earth.lsRed, z0: { loc: z0.loc, zi: z0.zi }, z1: { loc: E.seis.loc, zc: E.seis.zc, zi: E.seis.zi, H: E.H } }; });
check(rc.br.m === 'comb' && rc.br.a === 0.45 && rc.ls === 'no', 'applied: P.br.hEQmode comb, hAEr 0.45 (bridge-wide), Abut. 1 earth.lsRed no');
check(rc.z0.loc === 'sw' && rc.z1.loc === 'comb' && Math.abs(rc.z1.zc - 0.45 * rc.z1.H) < 1e-9, 'SubLoads placement: (a) before, the combined P_AE at 0.45H after (' + JSON.stringify(rc.z1) + ')');
check(/LS with the slab/.test(rc.txt) && /changes/.test(rc.txt), 'review: the LS row in the Approach slab group');
check(oc.errs.length === 0, 'no console errors' + (oc.errs.length ? ': ' + oc.errs.join(' | ') : ''));
await oc.b.close();

console.log('C2. SubLoads (d) nonyielding, slab on, LS kept -> calculator, seismic settings ticked');
const c2 = await subloadsSend(() => { P.br.hEQmode = 'nonyield'; P.units[0].earth.asOn = 'yes'; P.units[0].earth.lsRed = 'no'; });
const od = await openPage(ABF, { ls: c2.ls, vw: 1400 }); await od.p.waitForFunction(() => window.LAST_R, null, { timeout: 60000 });
const rd = await od.p.evaluate(() => { document.getElementById('axh-pull').click(); const cb = document.querySelector('#axh-dlg input[data-axh-g="seisset"]'); cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true }));
  const t = document.getElementById('axh-dlg').innerText; document.getElementById('axh-apply').click(); return { t, m: S.seismic.hEQmode, ls: S.apSlab.lsRed, on: S.apSlab.on }; });
check(rd.m === 'nonyield' && rd.on === true && rd.ls === false, 'applied: seismic.hEQmode nonyield, approach slab on with LS kept (apSlab.lsRed false)');
check(/Seismic earth pressure location \(panel I-11\)/.test(rd.t) && /nonyielding wall/.test(rd.t), 'review: the location row with its SubLoads text');
check(od.errs.length === 0, 'no console errors' + (od.errs.length ? ': ' + od.errs.join(' | ') : ''));
await od.b.close();
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
