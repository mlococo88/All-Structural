#!/usr/bin/env node
// Abutment Calculator <-> Bridge Substructure Loading: the abutment exchange (ABX, 2026-11-11; HANDOFF.md §4.5 definition block, §4.15).
//   node tests/smoke/abutment-subloads-exchange.mjs [--shots <dir>]
// A. SubLoads -> calculator (abutmentLoads): SubLoads' "Send to Abutment Calculator" writes the channel, its .updatedAt and the
//    per-project copy bridgeSuite.v1.abutmentLoads.by.subloads.<project id>; each abutment carries the additive definition block; the
//    "Export abutments" file has none (format unchanged). The calculator's pull: default ticks per ownership (a default project: geometry
//    and approach slab ticked; soil, seismic settings unticked; a project with its own geometry: geometry unticked and listed under "Not
//    ticked"); L_ftg carried; elevations applied; the project picker when this browser holds copies of two projects (preselects the one
//    named like the open project); Import hand-off (JSON); 390 px; no console errors.
// B. calculator -> SubLoads (abutmentDef): see the second half of the file.
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
check(/Different definitions in the two tools \(information only\)/.test(r.t) && /ΔP_AE height/.test(r.t), 'information rows for the definitions not aligned');
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

/*__PART_B__*/
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
