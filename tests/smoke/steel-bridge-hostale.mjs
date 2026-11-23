#!/usr/bin/env node
// Steel Bridge Design (apps/steel-bridge/index.html), SHO (2026-11-23; the PS Bridge app's HO-D2 banner here): the hand-offs stay click
// only and a stale banner names a channel whose data changed since this project last sent or loaded it, with a one-click Send / Load
// (the Hand-offs card's own action). Headless Chromium, file:// (one localStorage for every tool, as Chrome / Edge):
//   1. a project saved before (no record; an LL & DL pull without source.via), other data on the channels: no banner, the card's neutral note;
//   2. Share project info: recorded, "up to date", no Undo step, no tab put out of date; the autosave holds handoffs as its last field
//      while the page's own project text does not;
//   3. the project name changes: the banner above the results names "Project info (projectMeta): changed since last sent" with Send, on
//      every output tab and in the card; its Send shares again and the banner is gone;
//   4. Send to Substructure Loading (Geometry): recorded; the slab thickness changes: "Bridge geometry (superGeometry)" named; Undo of the
//      change: the banner is gone (the send is kept through Undo); Redo and the banner's Send: gone, the shared key holds the new slab;
//   5. Pull from LL & DL (confirm), then LL & DL re-publishes the same factors later: no banner; other factors: "Distribution factors
//      (lldf) of <type>: LL & DL Distribution has newer data than this design uses" with Load; Load opens the pull's own window; Apply:
//      the factors are the new ones, the banner is gone; a payload for another span count: no banner (cannot be compared);
//   6. Send to Substructure Loading (Reactions; the analysis of every line): recorded as the inputs' hash; a rating factor change: no
//      banner; an input error (a span change): not checked; the haunch changes: the reactions and the geometry both named;
//   7. reload: the record is read back from the autosave (the same banners); phone width: the banner fits the page; 0 console errors.
//   node tests/smoke/steel-bridge-hostale.mjs
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const FILE = path.join(REPO, 'apps/steel-bridge/index.html'), t0 = Date.now();
const SHOT = process.env.SBD_SHOT_DIR || '';
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const LLDF = (at, gM, spans) => JSON.stringify({ _schema: 'bridge-lldf-factors', schemaVersion: 1, producer: 'LL & DL Distribution', producerFile: 'lldf.html', producedAt: at, project: '', bridgeType: 'a',
  spans, skew: 0, Nb: 5, units: { df: 'lanes per girder (dimensionless)' },
  governing: { interior: { gM, gV: 0.8123, fatM: 0.4321, fatV: 0.5432 }, exterior: { gM: 0.7123, gV: 0.7633, fatM: 0.5, fatV: 0.51 } },
  governingNeg: { interior: { gM: 0.6789 }, exterior: { gM: 0.7001 } } });

const { b, p, errs, dialogs } = await openPage(FILE, { vw: 1400, vh: 1000, ...(SHOT ? { dsf: 2 } : {}) });
try {
  const ready = () => p.waitForFunction(() => window.SBDHandoffUI && document.querySelector('#inTabs [data-itab="proj"]') && document.getElementById('out').innerText.length > 20, null, { timeout: 120000 });
  await ready();
  const itab = t => p.evaluate(t => document.querySelector(`#inTabs [data-itab="${t}"]`).click(), t);
  const otab = async t => { await p.evaluate(t => document.querySelector(`#tabBar [data-otab="${t}"]`).click(), t); await p.waitForTimeout(150); };
  const bar = () => p.evaluate(() => { const e = document.getElementById('sbdHoBar'); return e && !e.hidden ? e.innerText : ''; });
  const cardSt = () => p.evaluate(() => { const e = document.getElementById('hoStale'); return e ? e.innerText : null; });
  const cardN = () => p.evaluate(() => document.querySelectorAll('#hoStale .hoStaleN').length);
  const click = async (sel, ms) => { const d0 = dialogs.length; await p.click(sel); await p.waitForTimeout(ms || 300); return dialogs.slice(d0); };
  const proj = async () => JSON.parse(await p.evaluate(() => localStorage.getItem('sbd2.project.current')));
  const setIn = async (tab, pth, v) => { await itab(tab); await p.evaluate(([q, t]) => { const el = document.querySelector(q); el.value = t; el.dispatchEvent(new Event('change', { bubbles: true })); }, [`[id="i_${pth}"]`, String(v)]); await p.waitForTimeout(200); };
  const undoOff = () => p.evaluate(() => document.getElementById('bUndo').disabled);
  const shot = async name => { if (SHOT) await p.screenshot({ path: path.join(SHOT, name) }); };

  // 1. a project saved before: written as an older copy of the app wrote it (no handoffs; a pull without source.via); other data on the channels
  const spans = await p.evaluate(([l1, l2]) => {
    const P = SBDModel.newProject(); P.project.name = 'Saved before SHO';
    const sp = P.spans.lengths.map(Number);
    P.girders[0].dfPull = { use: true, spans: sp.map(() => ({ gM: 0.6, gV: 0.8 })), piers: sp.slice(1).map(() => ({ gM: 0.65 })),
      source: { producer: 'LL & DL Distribution', producerFile: 'lldf.html', producedAt: '2026-11-01T08:00:00.000Z', project: '', line: 1, girder: 'G2', basis: 'type', basisLbl: 'for G2', adoptedAt: '2026-11-01T09:00:00.000Z' } };
    localStorage.setItem('sbd2.project.current', SBDModel.exportJSON(P));
    const Q = SBDModel.newProject(); Q.project.name = 'Another bridge'; Q.deck.ts = 9; const g = SBDHandoffs.sgPayload(Q).payload; g.producedAt = '2026-11-20T08:00:00.000Z';
    localStorage.setItem('bridgeSuite.v1.superGeometry', JSON.stringify(g));
    localStorage.setItem('bridgeSuite.v1.projectMeta', JSON.stringify({ _schema: 'bridge-project-meta', schemaVersion: 1, producer: 'LL & DL Distribution', producedAt: '2026-11-20T08:10:00.000Z', fields: { projectName: 'Another bridge' } }));
    return sp;
  }, []);
  await p.evaluate(raw => { localStorage.setItem('bridgeSuite.v1.lldf', raw); localStorage.setItem('bridgeSuite.v1.lldf.updatedAt', JSON.parse(raw).producedAt); }, LLDF('2026-11-20T08:30:00.000Z', 0.7, spans));
  await p.reload(); await ready(); await itab('proj'); await p.waitForSelector('#sbdHo');
  const P0 = await proj(); assert.equal(P0.project.name, 'Saved before SHO'); assert.equal(P0.handoffs, undefined);
  assert.equal(await bar(), '', 'no banner'); assert.equal(await cardN(), 0); assert.match(await cardSt(), /nothing sent or loaded from this project yet/);
  for (const t of ['sum', 'sec', 'an', 'rpt']) { await otab(t); assert.equal(await bar(), '', `no banner on ${t}`); }
  ok('a project saved before (no record; an LL & DL pull without source.via), other bridges\' superGeometry / projectMeta / lldf in storage: no banner on any tab, the card\'s neutral note');

  // 2. Share project info: recorded; no Undo step; no tab out of date; the file text holds handoffs last, the page's own text does not
  await otab('sec'); await p.waitForFunction(() => { const a = document.querySelector('#out .alert.stale'); return a && a.hidden; }, null, { timeout: 60000 });
  const und0 = await undoOff();
  let d = await click('#sbdHo [data-ho="pmShare"]'); assert.match(d.at(-1) || '', /Project info shared/);
  const P1 = await proj(); assert.ok(P1.handoffs && P1.handoffs.sent.projectMeta.sig, 'recorded');
  assert.equal(P1.handoffs.sent.projectMeta.at, JSON.parse(await p.evaluate(() => localStorage.getItem('bridgeSuite.v1.projectMeta'))).producedAt);
  assert.equal(Object.keys(P1).at(-1), 'handoffs', 'the last field of the file'); for (const k of ['project', 'spans', 'materials', 'deck', 'girders']) assert.deepEqual(P1[k], P0[k], `${k} unchanged`);
  assert.equal(await bar(), ''); assert.equal(await cardN(), 0); assert.match(await cardSt(), /Project info \(projectMeta\): sent .+ — up to date/);
  assert.equal(await undoOff(), und0, 'a send is no Undo step');
  assert.equal(await p.evaluate(() => { const a = document.querySelector('#out .alert.stale'); return !!a && a.hidden; }), true, 'the open tab is not put out of date by a send');
  ok(`Share project info: recorded (handoffs, the file's last field), no banner; the card: "${(await cardSt()).split('\n').pop()}"; no Undo step, no tab out of date`);

  // 3. the name changes: the banner on every output tab and in the card; its Send
  await setIn('proj', 'project.name', 'Made-up Creek Bridge');
  let t = await bar(); assert.match(t, /Hand-offs out of date/); assert.match(t, /Project info \(projectMeta\): changed since last sent to the other tools/);
  assert.equal(await p.locator('#sbdHoBar [data-hos="projectMeta"]').innerText(), 'Send');
  for (const tb of ['sum', 'flex', 'an', 'rpt', '3d', 'sec']) { await otab(tb); assert.match(await bar(), /Project info \(projectMeta\)/, `banner on ${tb}`); }
  await itab('proj'); assert.equal(await cardN(), 1); assert.match(await cardSt(), /Project info \(projectMeta\): sent .+ — out of date/);
  await shot('steel-hostale-1-banner.png');
  d = await click('#sbdHoBar [data-hos="projectMeta"]'); assert.match(d.at(-1) || '', /Project info shared/);
  assert.equal(await bar(), ''); assert.equal(await cardN(), 0);
  assert.equal(JSON.parse(await p.evaluate(() => localStorage.getItem('bridgeSuite.v1.projectMeta'))).fields.projectName, 'Made-up Creek Bridge');
  ok('project name changed: "Project info (projectMeta): changed since last sent to the other tools" above every output tab and in the card; the banner\'s Send shares it and the banner is gone');

  // 4. geometry: send, change, Undo / Redo, the banner's Send
  await itab('proj'); await p.evaluate(() => { const c = document.querySelector('#sbdHo [data-ho-opt="rx"]'); if (c.checked) c.click(); });
  d = await click('#sbdHo [data-ho="subSend"]', 800); assert.match(d.at(-1) || '', /Geometry sent/); assert.doesNotMatch(d.at(-1), /Reactions sent/);
  let Pg = await proj(); assert.ok(Pg.handoffs.sent.superGeometry.sig); assert.equal(Pg.handoffs.sent.superReactions, undefined);
  assert.equal(await bar(), ''); assert.match(await cardSt(), /Bridge geometry \(superGeometry\): sent .+ — up to date/);
  const ts0 = Pg.deck.ts;
  await setIn('xsec', 'deck.ts', ts0 + 0.5);
  t = await bar(); assert.match(t, /Bridge geometry \(superGeometry\): changed since last sent to Substructure Loading/); assert.doesNotMatch(t, /projectMeta/);
  await p.click('#bUndo'); await p.waitForTimeout(300); assert.equal(await bar(), '', 'Undo of the change: what was sent is current again (the send is kept through Undo)');
  assert.ok((await proj()).handoffs.sent.superGeometry.sig, 'the record stays through Undo');
  await p.click('#bRedo'); await p.waitForTimeout(300); assert.match(await bar(), /superGeometry/);
  d = await click('#sbdHoBar [data-hos="superGeometry"]', 800); assert.match(d.at(-1) || '', /Geometry sent/); assert.doesNotMatch(d.at(-1), /Reactions sent/);
  assert.equal(await bar(), ''); assert.equal(JSON.parse(await p.evaluate(() => localStorage.getItem('bridgeSuite.v1.superGeometry'))).deck.ts, ts0 + 0.5);
  ok(`geometry sent; slab ${ts0} -> ${ts0 + 0.5} in: "Bridge geometry (superGeometry): changed since last sent to Substructure Loading"; Undo: no banner, Redo: banner; the banner's Send sends the geometry only and clears it`);

  // 5. LL & DL: pull, the same values later, other values, Load; another bridge on the channel
  await itab('proj');
  await p.click('#sbdHo [data-ho="lldfPull"]'); await p.waitForSelector('#sbdHoDlg[open] [data-hod="apply"]'); await p.click('#sbdHoDlg [data-hod="apply"]'); await p.waitForTimeout(300);
  let Pl = await proj(); assert.equal(Pl.girders[0].dfPull.source.via, 'shared browser storage'); assert.equal(Pl.girders[0].dfPull.spans[0].gM, 0.7);
  assert.equal(await bar(), ''); assert.match(await cardSt(), /Distribution factors \(lldf\) of .+: loaded .+ — up to date/);
  const pub = async (at, gM, sp) => { await p.evaluate(raw => { localStorage.setItem('bridgeSuite.v1.lldf', raw); localStorage.setItem('bridgeSuite.v1.lldf.updatedAt', JSON.parse(raw).producedAt); window.dispatchEvent(new StorageEvent('storage', { key: 'bridgeSuite.v1.lldf' })); }, LLDF(at, gM, sp || spans)); await p.waitForTimeout(200); };
  await pub('2026-11-21T10:00:00.000Z', 0.7); assert.equal(await bar(), '', 're-published with the same values: no banner');
  await pub('2026-11-21T11:00:00.000Z', 0.7556);
  t = await bar(); assert.match(t, /Distribution factors \(lldf\) of .+: LL & DL Distribution has newer data than this design uses/);
  assert.equal(await p.locator('#sbdHoBar [data-hos="lldf"]').innerText(), 'Load');
  await pub('2026-11-21T11:30:00.000Z', 0.9, spans.concat([50])); assert.equal(await bar(), '', 'a payload for another span count: cannot be compared, no banner');
  assert.match(await cardSt(), /Distribution factors \(lldf\).+cannot be checked now/);
  await pub('2026-11-21T11:00:00.000Z', 0.7556); assert.match(await bar(), /lldf/);
  await shot('steel-hostale-2-lldf.png');
  await p.click('#sbdHoBar [data-hos="lldf"]'); await p.waitForSelector('#sbdHoDlg[open] [data-hod="apply"]');
  assert.match(await p.locator('#sbdHoDlg').innerText(), /0\.756/);
  await p.click('#sbdHoDlg [data-hod="apply"]'); await p.waitForTimeout(300);
  Pl = await proj(); assert.equal(Pl.girders[0].dfPull.spans[0].gM, 0.7556); assert.equal(await bar(), '');
  ok('LL & DL pull (source.via kept); re-published with the same factors: no banner; g_M 0.700 -> 0.7556: "Distribution factors (lldf) … LL & DL Distribution has newer data than this design uses"; Load opens the pull window, Apply: 0.7556, banner gone; another span count on the channel: no banner');

  // 6. reactions: the inputs' hash
  await itab('proj'); await p.evaluate(() => { const c = document.querySelector('#sbdHo [data-ho-opt="rx"]'); if (!c.checked) c.click(); const g = document.querySelector('#sbdHo [data-ho-opt="geo"]'); if (g.checked) g.click(); });
  const d0 = dialogs.length; await p.click('#sbdHo [data-ho="subSend"]');
  await p.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem('sbd2.project.current')).handoffs.sent.superReactions; } catch (e) { return false; } }, null, { timeout: 300000 });
  await p.waitForTimeout(300); assert.match(dialogs.slice(d0).at(-1) || '', /Reactions sent/);
  let Pr = await proj(); assert.match(Pr.handoffs.sent.superReactions.sig, /^inp:[0-9a-f]{8}:\d+$/);
  assert.equal(await bar(), ''); assert.match(await cardSt(), /Reactions of every girder line \(superReactions\): sent .+ — up to date/);
  await p.evaluate(() => { const c = document.querySelector('#sbdHo [data-ho-opt="geo"]'); if (!c.checked) c.click(); });
  await otab('rt'); await p.waitForSelector('#out input, #out select', { timeout: 60000 });
  const rtSet = await p.evaluate(() => { const el = document.querySelector('#out [data-path="rating.phiC"], #out #rt_phiC, #out input[type=number]'); if (!el) return ''; el.value = '0.95'; el.dispatchEvent(new Event('change', { bubbles: true })); return el.id || el.dataset.path || 'input'; });
  await p.waitForTimeout(300);
  const Prt = await proj(); assert.ok(JSON.stringify(Prt.rating) !== JSON.stringify(Pr.rating), `a rating factor changed (${rtSet})`); assert.equal(await bar(), '', 'a rating factor is not an input of the reactions');
  await otab('sec');
  await setIn('layout', 'spans', spans.map((L, i) => i ? L : L - 2).join(', '));   // the plates no longer end at the bridge end: an input error
  assert.equal(await bar(), '', 'while an input error exists the outgoing channels cannot be checked: no banner'); await itab('proj'); assert.match(await cardSt(), /superReactions\): sent .+ — cannot be checked now/);
  await p.click('#bUndo'); await p.waitForTimeout(300); assert.equal(await bar(), '');
  await setIn('xsec', 'deck.haunch', Pr.deck.haunch + 0.5);
  t = await bar(); assert.match(t, /Reactions of every girder line \(superReactions\): the inputs its analysis reads changed since last sent to Substructure Loading/); assert.match(t, /Bridge geometry \(superGeometry\)/);
  await itab('proj'); assert.equal(await cardN(), 2);
  await shot('steel-hostale-3-card.png');
  ok('reactions sent (recorded as the hash of the analysis inputs); a rating factor change: no banner; an input error: not checked; haunch + 0.5 in: the reactions and the geometry are both named, in the bar and the card');

  // 7. reload: the record is read back; phone width
  await p.reload(); await ready();
  t = await bar(); assert.match(t, /superReactions/); assert.match(t, /superGeometry/);
  assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('sbd2.project.current')).handoffs.sent.superReactions.sig), Pr.handoffs.sent.superReactions.sig);
  await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(300);
  const fit = await p.evaluate(() => { const e = document.getElementById('sbdHoBar'), r = e.getBoundingClientRect(); return { l: r.left, r: r.right, w: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth }; });
  assert.ok(fit.l >= 0 && fit.r <= fit.w + 1 && fit.sw <= fit.w + 1, `the banner fits a 390 px page: ${JSON.stringify(fit)}`);
  await shot('steel-hostale-4-phone.png');
  ok(`after a reload the record is read from the autosave (the same banners); at 390 px the banner fits the page (${Math.round(fit.r - fit.l)} px wide)`);

  assert.deepEqual(errs, [], 'console / page errors');
  console.log(`\n${n} checks passed, 0 console errors (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
} finally { await b.close(); }
