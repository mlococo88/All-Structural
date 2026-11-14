#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html), 2026-11-14 (planned item 12): the Project tab's Hand-offs card, the old app's bridgeSuite.v1.*
// channels with the same keys and formats (engine/handoffs.js; payload identity with the old page: tests/engine/psbridge-handoffs.test.mjs).
// Headless Chromium, file:// (one localStorage for every tool, as Chrome / Edge):
//   1. a new project: the card replaces the placeholder; it names the girder type and line shown;
//   2. Send: reactions -> bridgeSuite.v1.superReactions, .updatedAt and the copy .by.psbeam (the same text, producer 'PS-Beam'); geometry
//      -> .lldfGeom; section properties -> .psSection (+ .updatedAt); capacity -> .capacity (+ .updatedAt); Share project info -> .projectMeta;
//      each payload = the page's own PSBHandoffs builder on the page's engine inputs and result (producedAt aside); no other key written;
//   3. Receive: an lldf payload as LL & DL publishes it -> "new data" shown; Pull (confirm) -> the type shown gets DF auto off and the
//      factors (saved), the adoption key .lldf.adopted.psbridge; dlLoads on a project that distributes DC2 / DW: refused, nothing changed;
//      entered DC2 / DW: pulled; Use shared project info fills blank fields only;
//   4. the receiving tools read the sent keys as they read the old app's: Bridge Substructure Loading's BridgeXfer reads superReactions.by.psbeam
//      as a valid bridge-super-reactions payload from 'PS-Beam'; LL & DL Distribution reads lldfGeom (bridge-lldf-geometry);
//   5. 0 console errors.
//   node tests/smoke/ps-bridge-handoffs.mjs
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const FILE = path.join(REPO, 'apps/ps-bridge/index.html'), t0 = Date.now();
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const LLDF = { _schema: 'bridge-lldf-factors', schemaVersion: 1, producer: 'LL & DL Distribution', producedAt: '2026-11-14T13:00:00.000Z', project: 'Route 9', Nb: 5,
  governing: { interior: { gM: 0.612345, gV: 0.701234, fatM: 0.41234 }, exterior: { gM: 0.7123, gV: 0.6633, fatM: 0.5 } }, governingNeg: { interior: { gM: 0.655555 }, exterior: { gM: 0.744 } } };
const DLP = { _schema: 'bridge-dl-loads', schemaVersion: 1, producedAt: '2026-11-14T13:10:00.000Z', project: 'Route 9', Nb: 5, beam: { label: 'B2', clsLabel: 'first interior', trib: 8.5 },
  cases: [{ key: 'DC1', udl: 0.9 }, { key: 'DC2', udl: 0.123456 }, { key: 'DW', udl: 0.2345678 }] };

const { b, ctx, p, errs, dialogs } = await openPage(FILE, { vw: 1400, vh: 1000 });
try {
  const ready = () => p.waitForFunction(() => window.PSBHandoffUI && document.querySelector('#inTabs [data-itab="proj"]') && document.getElementById('out').innerText.length > 50, null, { timeout: 120000 });
  await ready();
  await p.click('#inTabs [data-itab="proj"]'); await p.waitForSelector('#psbHo');
  const keys = () => p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('bridgeSuite.')).sort());
  const click = async a => { const d0 = dialogs.length; await p.click(`#psbHo [data-ho="${a}"]`); await p.waitForTimeout(400); return dialogs.slice(d0); };
  // 1. the card
  const cell = await p.textContent('#hoCell'); assert.match(cell, /^.+ on G\d+, span \d+$/, cell);
  assert.equal(await p.locator('#inPanes .ph', { hasText: 'Hand-offs' }).count(), 0, 'placeholder gone'); ok(`card on the Project tab, for ${cell}`);
  assert.deepEqual(await keys(), [], 'no bridgeSuite key before a click'); ok('nothing written on open');
  // 2. sends
  let d = await click('srSend'); assert.match(d.at(-1) || '', /Reactions sent to Substructure Loading/);
  let st = await p.evaluate(() => ({ a: localStorage.getItem('bridgeSuite.v1.superReactions'), c: localStorage.getItem('bridgeSuite.v1.superReactions.by.psbeam'), u: localStorage.getItem('bridgeSuite.v1.superReactions.updatedAt') }));
  assert.equal(st.a, st.c, 'copy by.psbeam = the channel text'); const sr = JSON.parse(st.a); assert.equal(sr.producer, 'PS-Beam'); assert.equal(sr.producerFile, 'apps/ps-bridge/index.html'); assert.equal(st.u, sr.producedAt);
  const own = await p.evaluate(() => { const PSB = window.PSBHandoffs, D = window.PSBDesign, P = PSBModel.load(localStorage).project, inp = D.inputs(P), R = PSBHoldDown.compute(JSON.parse(JSON.stringify(inp)));
    return { sr: PSB.srPayload(inp, R).payload, sec: PSB.psSection(inp, R, 'T'), cap: PSB.capacity(inp, R, 'T').payload, geo: PSB.lldfGeom(inp, R, 'T').payload }; });
  const strip = (o, extra = []) => { const c = JSON.parse(JSON.stringify(o)); ['producedAt', 'producer', 'producerFile', 'schemaVersion', 'notes', ...extra].forEach(k => delete c[k]); return c; };
  assert.deepEqual(strip(sr), strip(own.sr)); assert.deepEqual(sr.notes, own.sr.notes); ok(`superReactions + .by.psbeam: the page's builder, producer PS-Beam (${sr.supports.length} supports, DC1 ${sr.supports[0].girders[0].DC1} kip)`);
  await click('geoSend'); await click('secSend'); await click('capSend'); await click('pmShare');
  const got = await p.evaluate(() => Object.fromEntries(['lldfGeom', 'psSection', 'capacity', 'projectMeta'].map(k => [k, JSON.parse(localStorage.getItem('bridgeSuite.v1.' + k))])));
  assert.deepEqual(strip(got.lldfGeom), strip(own.geo)); assert.deepEqual(strip(got.psSection), strip(own.sec)); assert.deepEqual(strip(got.capacity), strip(own.cap));
  assert.equal(got.projectMeta._schema, 'bridge-project-meta'); assert.equal(got.projectMeta.fields.projectName, await p.evaluate(() => PSBModel.load(localStorage).project.project.name));
  assert.deepEqual(await keys(), ['bridgeSuite.v1.capacity', 'bridgeSuite.v1.capacity.updatedAt', 'bridgeSuite.v1.lldfGeom', 'bridgeSuite.v1.projectMeta', 'bridgeSuite.v1.projectMeta.updatedAt',
    'bridgeSuite.v1.psSection', 'bridgeSuite.v1.psSection.updatedAt', 'bridgeSuite.v1.superReactions', 'bridgeSuite.v1.superReactions.by.psbeam', 'bridgeSuite.v1.superReactions.updatedAt']);
  ok(`lldfGeom, psSection, capacity (${got.capacity.stationCount} stations), projectMeta: the page's builders; the old app's keys only`);
  // 3. receive: lldf
  await p.evaluate(([a, b]) => { localStorage.setItem('bridgeSuite.v1.lldf', a); localStorage.setItem('bridgeSuite.v1.lldf.updatedAt', JSON.parse(a).producedAt); localStorage.setItem('bridgeSuite.v1.dlLoads', b); }, [JSON.stringify(LLDF), JSON.stringify(DLP)]);
  await p.click('#inTabs [data-itab="layout"]'); await p.click('#inTabs [data-itab="proj"]'); await p.waitForSelector('#psbHo');
  assert.equal(await p.isVisible('[data-ho-new="lldf"]'), true, 'new data shown'); ok('lldf payload: "new data" shown');
  const before = await p.evaluate(() => { const P = PSBModel.load(localStorage).project, c = PSBBridge.shown(P); return { k: c.k, pos: PSBDesign.inputs(P).loads.pos, other: JSON.stringify(P.types.filter((t, k) => k !== c.k)) }; });
  d = await click('lldfPull'); assert.match(d.at(-1) || '', /Pull from LL & DL Distribution/); assert.match(d.at(-1), /DFm = g_M\(\+M\)/);
  const after = await p.evaluate(() => { const P = PSBModel.load(localStorage).project, c = PSBBridge.shown(P), inp = PSBDesign.inputs(P); return { ovr: P.types[c.k].ovr, loads: inp.loads, other: JSON.stringify(P.types.filter((t, k) => k !== c.k)), adopted: localStorage.getItem('bridgeSuite.v1.lldf.adopted.psbridge') }; });
  const want = before.pos === 'exterior' ? LLDF.governing.exterior : LLDF.governing.interior;
  assert.equal(after.loads.dfAuto, false); assert.equal(after.loads.dfm, +want.gM.toFixed(4)); assert.equal(after.loads.dfv, +want.gV.toFixed(4)); assert.equal(after.loads.fatM, +want.fatM.toFixed(4));
  assert.equal(after.other, before.other, 'other types unchanged'); assert.equal(after.adopted, LLDF.producedAt);
  assert.equal(await p.isVisible('[data-ho-new="lldf"]'), false, 'no new data after the pull'); ok(`lldf pull: the type shown (${before.pos}) DFm ${after.loads.dfm}, DFv ${after.loads.dfv}, fatigue ${after.loads.fatM}; adopted marker`);
  // dlLoads: a new project distributes DC2 / DW: refused
  const t1 = await p.evaluate(() => localStorage.getItem('psb2.project.current'));
  d = await click('dlPull'); assert.match(d.at(-1) || '', /distributes DC2 and DW to the girder lines itself/); assert.equal(await p.evaluate(() => localStorage.getItem('psb2.project.current')), t1, 'unchanged');
  ok('dlLoads pull refused while the project distributes DC2 / DW');
  await p.evaluate(() => { const P = PSBModel.load(localStorage).project; P.xs.dl.mode = 'entered'; PSBModel.save(localStorage, P); }); await p.reload(); await ready();
  await p.click('#inTabs [data-itab="proj"]'); await p.waitForSelector('#psbHo');
  d = await click('dlPull'); assert.match(d.at(-1) || '', /Apply the DC2 and DW values\?/);
  const dl = await p.evaluate(() => PSBDesign.inputs(PSBModel.load(localStorage).project).loads); assert.equal(dl.wBar, 0.1235); assert.equal(dl.wDW, 0.2346); ok(`dlLoads pull (entered): DC2 ${dl.wBar}, DW ${dl.wDW} klf`);
  // projectMeta: Use fills a blank field only
  await p.evaluate(() => { const m = JSON.parse(localStorage.getItem('bridgeSuite.v1.projectMeta')); m.fields.checkedBy = 'CD'; m.fields.projectName = ''; localStorage.setItem('bridgeSuite.v1.projectMeta', JSON.stringify(m)); });
  const nm = await p.evaluate(() => PSBModel.load(localStorage).project.project.name);
  d = await click('pmUse'); assert.match(d.at(-1) || '', /Checker: "\(blank\)" → "CD"/);
  const pr = await p.evaluate(() => PSBModel.load(localStorage).project.project); assert.equal(pr.checker, 'CD'); assert.equal(pr.name, nm, 'a blank shared name keeps the name'); ok('Use shared project info: blank shared field ignored, checker filled');
  // 4. the receiving tools read the keys (their own BridgeXfer copy)
  for (const [file, ch, sch] of [['Bridge Substructure Loading.html', 'superReactions.by.psbeam', 'bridge-super-reactions'], ['lldf.html', 'lldfGeom', 'bridge-lldf-geometry']]) {
    const q = await ctx.newPage(); q.on('dialog', x => x.dismiss()); await q.goto('file://' + path.join(REPO, file)); await q.waitForFunction(() => window.BridgeXfer, null, { timeout: 120000 });
    const r = await q.evaluate(([c, s]) => { const x = BridgeXfer.read(c, s, 1); return { ok: !!x.ok, producer: x.payload && x.payload.producer, err: x.error || '' }; }, [ch, sch]);
    assert.equal(r.ok, true, file + ' ' + r.err); assert.equal(r.producer, 'PS-Beam'); await q.close(); ok(`${file} reads ${ch} (${sch}) from PS-Beam`);
  }
  assert.deepEqual(errs, []); ok('0 console errors');
  console.log(`ps-bridge-handoffs: ${n} checks passed (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
} finally { await b.close(); }
