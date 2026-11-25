#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html), HO-D2 (engineer decision 2026-11-21): the hand-offs stay click only and a stale banner names a
// channel whose data changed since this project last sent or loaded it, with a one-click Send / Load (the card's own action).
// Headless Chromium, file:// (one localStorage for every tool, as Chrome / Edge):
//   1. a project saved before (no record), with other projects' hand-offs in storage: no banner, the card says nothing was recorded;
//   2. Send section properties: no banner, "up to date"; no Undo step;
//   3. an input change (a girder spacing): the banner above the output tabs names "Girder section (psSection) … changed since last sent to
//      LL & DL" with Send, on every tab (input and output); the card shows it too;
//   4. the banner's Send: the section is sent (the same alert as the card's), the banner is gone, the shared key holds the new section;
//   5. Pull distribution factors, then LL & DL re-publishes the same factors later: no banner; newer factors: "Distribution factors (lldf):
//      the LLDF tool has newer data than this design uses" with Load; Load (confirm): applied to the type, the banner is gone;
//   6. Undo of the Load: the earlier pull's record (the lldf banner again), the send kept (no false psSection banner);
//   7. Send to Substructure Loading (NOMCT 2026-11-25: no capacity send), a span change: each named; a banner's Send clears its own channel; 0 console errors.
//   node tests/smoke/ps-bridge-hostale.mjs
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const FILE = path.join(REPO, 'apps/ps-bridge/index.html'), t0 = Date.now();
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const LLDF = (at, gM) => JSON.stringify({ _schema: 'bridge-lldf-factors', schemaVersion: 1, producer: 'LL & DL Distribution', producedAt: at, project: 'Route 9', Nb: 5,
  governing: { interior: { gM, gV: 0.701234, fatM: 0.41234 }, exterior: { gM: 0.7123, gV: 0.6633, fatM: 0.5 } } });

const { b, p, errs, dialogs } = await openPage(FILE, { vw: 1400, vh: 1000 });
try {
  const ready = () => p.waitForFunction(() => window.PSBHandoffUI && document.querySelector('#inTabs [data-itab="proj"]') && document.getElementById('out').innerText.length > 50, null, { timeout: 120000 });
  await ready();
  const itab = t => p.evaluate(t => document.querySelector(`#inTabs [data-itab="${t}"]`).click(), t);
  const otab = t => p.evaluate(t => document.querySelector(`#tabBar [data-otab="${t}"]`).click(), t);
  const bar = () => p.evaluate(() => { const e = document.getElementById('hoStaleBar'); return e ? e.innerText : ''; });
  const cardSt = () => p.evaluate(() => { const e = document.getElementById('hoStale'); return e ? e.innerText : null; });
  const cardN = () => p.evaluate(() => document.querySelectorAll('#hoStale .notice').length);
  const click = async sel => { const d0 = dialogs.length; await p.click(sel); await p.waitForTimeout(400); return dialogs.slice(d0); };
  const proj = async () => JSON.parse(await p.evaluate(() => localStorage.getItem('psb2.project.current')));
  const setList = async (tab, pth, v) => { await itab(tab); await p.evaluate(([q, t]) => { const el = document.querySelector(q); el.value = t; el.dispatchEvent(new Event('change', { bubbles: true })); }, [`[id="i_${pth}"]`, String(v)]); await p.waitForTimeout(150); };

  // 1. a project saved before (written as an older copy of the app wrote it: no P.handoffs), other projects' hand-offs in storage
  await p.evaluate(([raw]) => {
    const P = PSBModel.newProject(); P.project.name = 'Saved before HO-D2'; localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P));
    const Q = PSBModel.newProject(); Q.project.name = 'Another project'; Q.xs.bays = [8, 8, 8, 8]; const inp = PSBDesign.inputs(Q), R = PSBHoldDown.compute(JSON.parse(JSON.stringify(inp)));
    const s = PSBHandoffs.psSection(inp, R, '2026-11-20T08:00:00.000Z'); localStorage.setItem('bridgeSuite.v1.psSection', JSON.stringify(s)); localStorage.setItem('bridgeSuite.v1.psSection.updatedAt', s.producedAt);
    localStorage.setItem('bridgeSuite.v1.lldf', raw); localStorage.setItem('bridgeSuite.v1.lldf.updatedAt', JSON.parse(raw).producedAt);
  }, [LLDF('2026-11-20T08:30:00.000Z', 0.6)]);
  await p.reload(); await ready(); await itab('proj'); await p.waitForSelector('#psbHo');
  const P0 = await proj(); assert.equal(P0.project.name, 'Saved before HO-D2'); assert.equal(P0.handoffs, undefined);
  assert.equal(await bar(), '', 'no banner'); assert.equal(await cardN(), 0); assert.match(await cardSt(), /nothing sent or loaded from this project yet/);
  ok('a project saved before, other projects\' psSection / lldf in storage: no banner (no record = unknown), the card\'s neutral note');

  // 2. send: no banner, no Undo step
  const und0 = await p.evaluate(() => document.getElementById('bUndo').disabled);
  let d = await click('#psbHo [data-ho="secSend"]'); assert.match(d.at(-1) || '', /Section properties sent/);
  const P1 = await proj(); assert.ok(P1.handoffs && P1.handoffs.sent.psSection.sig, 'recorded'); assert.equal(P1.handoffs.sent.psSection.at, JSON.parse(await p.evaluate(() => localStorage.getItem('bridgeSuite.v1.psSection'))).producedAt);
  assert.equal(await bar(), ''); assert.equal(await cardN(), 0); assert.match(await cardSt(), /Girder section \(psSection\) of .+ on G\d: sent .+ — up to date/);
  assert.equal(await p.evaluate(() => document.getElementById('bUndo').disabled), und0, 'a send is no Undo step');
  ok(`Send section properties: no banner; the card: "${(await cardSt()).split('\n').pop()}"; no Undo step`);

  // 3. an input change: the banner, on every tab
  await setList('xsec', 'xs.bays', '9.5, 9.5, 9.5, 9.5');
  let t = await bar(); assert.match(t, /Hand-offs out of date/); assert.match(t, /Girder section \(psSection\) of .+ on G\d: changed since last sent to LL & DL/);
  assert.equal(await p.locator('#hoStaleBar [data-hos="psSection"]').innerText(), 'Send');
  await otab('flex'); await itab('loads'); await p.waitForTimeout(150); assert.match(await bar(), /psSection/, 'shown from another output and input tab');
  await otab('sum'); await itab('proj'); await p.waitForTimeout(150); assert.equal(await cardN(), 1); assert.match(await cardSt(), /out of date/);
  ok('a girder spacing changed: "Girder section (psSection) … changed since last sent to LL & DL — Send" above the output tabs (every tab) and in the card');

  // 4. the banner's Send
  const s0 = await p.evaluate(() => localStorage.getItem('bridgeSuite.v1.psSection'));
  d = await click('#hoStaleBar [data-hos="psSection"]'); assert.match(d.at(-1) || '', /Section properties sent/);
  assert.equal(await bar(), ''); assert.equal(await cardN(), 0);
  const s1 = await p.evaluate(() => localStorage.getItem('bridgeSuite.v1.psSection')); assert.notEqual(s1, s0);
  assert.equal(JSON.parse(s1).Ic, await p.evaluate(() => { const P = PSBModel.load(localStorage).project, inp = PSBDesign.inputs(P); return PSBHandoffs.psSection(inp, PSBHoldDown.compute(JSON.parse(JSON.stringify(inp))), 'T').Ic; }));
  ok(`the banner's Send: sent (Ic ${Math.round(JSON.parse(s0).Ic)} -> ${Math.round(JSON.parse(s1).Ic)} in4), the banner gone`);

  // 5. lldf: pull, re-published with the same factors (no banner), newer factors (Load banner), Load
  await p.evaluate(raw => { localStorage.setItem('bridgeSuite.v1.lldf', raw); localStorage.setItem('bridgeSuite.v1.lldf.updatedAt', JSON.parse(raw).producedAt); }, LLDF('2026-11-21T09:00:00.000Z', 0.612345));
  await itab('layout'); await itab('proj');
  d = await click('#psbHo [data-ho="lldfPull"]'); assert.match(d.at(-1) || '', /Pull from LL & DL Distribution/);
  assert.equal((await proj()).handoffs.loaded.lldf.at, '2026-11-21T09:00:00.000Z'); assert.equal(await bar(), '');
  const pub = raw => p.evaluate(raw => { localStorage.setItem('bridgeSuite.v1.lldf', raw); localStorage.setItem('bridgeSuite.v1.lldf.updatedAt', JSON.parse(raw).producedAt); document.querySelector('#tabBar [data-otab="sum"]').click(); }, raw);
  await pub(LLDF('2026-11-21T10:00:00.000Z', 0.612345)); await p.waitForTimeout(150); assert.equal(await bar(), '', 're-published, same factors');
  await pub(LLDF('2026-11-21T11:00:00.000Z', 0.655)); await p.waitForTimeout(150);
  t = await bar(); assert.match(t, /Distribution factors \(lldf\) of .+ on G\d: the LLDF tool has newer data than this design uses/); assert.equal(await p.locator('#hoStaleBar [data-hos="lldf"]').innerText(), 'Load');
  d = await click('#hoStaleBar [data-hos="lldf"]'); assert.match(d.at(-1) || '', /g_M \+M \(moment DF\)   = 0\.655/);
  assert.equal(await bar(), ''); const P3 = await proj(), c = await p.evaluate(() => { const P = PSBModel.load(localStorage).project; return PSBDesign.inputs(P).loads.dfm; });
  assert.equal(c, 0.655); assert.equal(P3.handoffs.loaded.lldf.at, '2026-11-21T11:00:00.000Z');
  ok('lldf: pulled; re-published with the same factors: no banner; newer factors: "Distribution factors (lldf) … the LLDF tool has newer data than this design uses — Load"; Load (confirm): DFm 0.655, the banner gone');

  // 6. Undo after a send: the send stays sent (no false banner); Undo of the lldf load: its record goes with it (no banner: unknown)
  await p.click('#bUndo'); await p.waitForTimeout(300);
  assert.match(await bar(), /Distribution factors \(lldf\)/, 'Undo of the load: the design uses the earlier factors again, so LL & DL\'s are newer'); assert.doesNotMatch(await bar(), /psSection/); const P4 = await proj(); assert.equal(P4.handoffs.loaded.lldf.at, '2026-11-21T09:00:00.000Z', 'the record of the first pull'); assert.ok(P4.handoffs.sent.psSection);
  assert.equal(P4.handoffs.sent.psSection.sig, P3.handoffs.sent.psSection.sig, 'the send kept');
  ok('Undo of the load: the earlier pull\'s record (so the lldf banner again), the send kept (no psSection banner)');
  // 7. every girder line (Send to Substructure Loading); NOMCT: no capacity send: a span change names each; one banner Send clears its own channel only
  await p.click('#hoStaleBar [data-hos="lldf"]'); await p.waitForTimeout(400);   // the lldf banner of step 6 (Load again: φVn of the capacity follows the demands)
  await itab('proj'); d = await click('#psbHo [data-ho="subSend"]'); await p.waitForTimeout(600); assert.match(dialogs.at(-1) || '', /Geometry sent/);
  assert.equal(await p.locator('#psbHo [data-ho="capSend"]').count(), 0, 'no capacity send (NOMCT)');
  assert.equal(await bar(), '', 'every recorded channel up to date');
  await setList('layout', 'spans.lengths', '118'); await p.waitForTimeout(400);
  t = await bar(); for (const re of [/Bridge geometry \(superGeometry\): changed since last sent to Substructure Loading/, /Reactions of every girder line \(superReactions\): changed since last sent to Substructure Loading/]) assert.match(t, re); assert.doesNotMatch(t, /capacity|MCT/);
  assert.doesNotMatch(t, /psSection/, 'the section does not depend on the span length');
  await p.click('#hoStaleBar [data-hos="superGeometry"]'); await p.waitForTimeout(800);
  t = await bar(); assert.doesNotMatch(t, /superGeometry/); assert.match(t, /Reactions of every girder line/);
  ok('Send to Substructure Loading recorded (no capacity send); span 120 -> 118 ft: superGeometry, superReactions (every line) named (not psSection: the same section); the banner\'s Send of superGeometry clears that one only');
  assert.deepEqual(errs, [], 'console errors: ' + errs.join(' | ')); ok('0 console errors');
  console.log(`\n${n} checks passed (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
} finally { await b.close(); }
