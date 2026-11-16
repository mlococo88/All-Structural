#!/usr/bin/env node
// Timber Beam Check, input tabs (TBIT, engineer decision 2026-11-16): Project · Geometry · Member · Loads · Design criteria (were
// Project · Geometry · Loads · Material · Factors), in the working tree (headless Chromium, file://). Display only:
// - each field (data-fkey) is on its new tab, in NDS and AASHTO mode, and nowhere else;
// - the saved input-tab preference (tbc_inputTab_v1): an old id opens its new tab ('material' → Member, 'factors' → Design criteria),
//   the saved value is kept until a tab is clicked;
// - the red tab dot follows the input: NDS (spacing 0 → Geometry, notch ≥ d → Member, glulam flat use → Member, deflection limit 0 →
//   Design criteria) and AASHTO (roadway width 0 → Geometry, glulam flat use → Member, plank deck factor on a 2x10 → Design criteria
//   and Member, deflection limit −1 → Design criteria);
// - switching input tabs changes no result (TBC.res, TBC.ac); 390 px: no horizontal page scroll, every tab button in view; 0 console errors.
//   node tests/smoke/timber-input-tabs.mjs [--shots <dir>]
import fs from 'node:fs';
import path from 'node:path';
import { openPage, REPO } from '../lib.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) if (av[i].startsWith('--')) args[av[i].slice(2)] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true;
const FILE = path.join(REPO, 'Timber Beam Check.html');
const fails = []; const ok = (c, msg) => { if (!c) fails.push(msg); };
const TABS = ['project', 'geom', 'member', 'loads', 'criteria'];
const { b, p, errs } = await openPage(FILE, { vw: 1400, vh: 1000 });
await p.waitForFunction(() => window.TBC && window.TBC.res, null, { timeout: 30000 }); await p.waitForTimeout(800);
const where = () => p.evaluate(TABS => { const o = {}; TABS.forEach(t => { o[t] = [...document.querySelectorAll('#tbcInPane_' + t + ' [data-fkey]')].map(e => e.getAttribute('data-fkey')); }); return o; }, TABS);
const dots = () => p.evaluate(TABS => TABS.filter(t => document.getElementById('tbcInTab_' + t).classList.contains('has-err')), TABS);
const setM = async (fn) => { await p.evaluate(s => { (0, eval)('(' + s + ')')(TBC.model); TBC.fullRebuild(); }, fn.toString()); await p.waitForTimeout(400); };
const expectOn = (w, tab, keys, mode) => keys.forEach(k => { ok(w[tab].includes(k), `${mode}: ${k} on ${tab} (${w[tab].join(',')})`); TABS.filter(t => t !== tab).forEach(t => ok(!w[t].includes(k), `${mode}: ${k} also on ${t}`)); });

// 1. NDS: tab labels and fields
ok(await p.evaluate(() => [...document.querySelectorAll('#tbcInTabs .tbcInTab')].map(x => x.id.slice(9) + ':' + x.textContent.trim()).join('|')) === 'project:Project|geom:Geometry|member:Member|loads:Loads|criteria:Design criteria', 'NDS input tabs');
const ndsRes = await p.evaluate(() => JSON.stringify(TBC.res));
await setM(m => { m.design.latTop = 'Supports'; m.design.latBot = 'Supports'; m.design.method = 'LRFD'; });
let w = await where();
expectOn(w, 'project', ['dcode', 'projNotes'], 'NDS');
expectOn(w, 'geom', ['spanL0', 'latTop', 'luTop', 'latBot', 'luBot', 'spacing'], 'NDS');
expectOn(w, 'member', ['mtype', 'species', 'size', 'flat', 'notch', 'cost'], 'NDS');
expectOn(w, 'loads', ['load_D', 'load_L'], 'NDS');
expectOn(w, 'criteria', ['method', 'lrfdLive', 'wet', 'temp', 'incised', 'repetitive', 'creep', 'deflLL', 'deflTL'], 'NDS');
ok(await p.evaluate(() => [...document.querySelectorAll('#tbcInPane_geom .sec')].map(s => s.getAttribute('data-secid')).join(',')) === 'inLayout,inStab,inSpacing', 'NDS Geometry cards: spans and supports, lateral support, member spacing');
ok(await p.evaluate(() => [...document.querySelectorAll('#tbcInPane_member .sec')].map(s => s.getAttribute('data-secid')).join(',')) === 'inMat,inOrient,inNotch,inCost', 'NDS Member cards');
ok(await p.evaluate(() => [...document.querySelectorAll('#tbcInPane_criteria .sec')].map(s => s.getAttribute('data-secid')).join(',')) === 'inMethod,inService,inDefl', 'NDS Design criteria cards');
await setM(m => { m.design.latTop = 'Continuous'; m.design.latBot = 'Supports'; m.design.method = 'ASD'; });
ok(await p.evaluate(() => JSON.stringify(TBC.res)) === ndsRes, 'NDS: results back to the default after the round trip');
// switching tabs: no change
for (const t of TABS) { await p.click('#tbcInTab_' + t); await p.waitForTimeout(80); }
ok(await p.evaluate(() => JSON.stringify(TBC.res)) === ndsRes, 'NDS: switching input tabs changes no result');
// 2. the saved preference
for (const [old, now] of [['factors', 'criteria'], ['material', 'member'], ['loads', 'loads'], ['geom', 'geom'], ['bogus', 'project']]) {
  await p.evaluate(v => localStorage.setItem('tbc_inputTab_v1', v), old); await p.reload(); await p.waitForFunction(() => window.TBC && window.TBC.res, null, { timeout: 30000 }); await p.waitForTimeout(500);
  const sel = await p.evaluate(() => (document.querySelector('#tbcInTabs .tbcInTab[aria-selected="true"]') || {}).id);
  ok(sel === 'tbcInTab_' + now, `saved '${old}' opens ${now} (${sel})`);
  ok(await p.evaluate(() => localStorage.getItem('tbc_inputTab_v1')) === old, `saved '${old}' kept until a click`);
}
await p.click('#tbcInTab_member'); ok(await p.evaluate(() => localStorage.getItem('tbc_inputTab_v1')) === 'member', 'a click saves the new id');
// 3. NDS tab dots
for (const [fn, want, what] of [[m => { m.geom.spacing = 0; }, ['geom'], 'spacing 0'], [m => { m.material.notch = 20; }, ['member'], 'notch ≥ d'],
  [m => { m.material.type = 'glulam'; m.design.flatUse = true; }, ['member'], 'glulam flat use'], [m => { m.design.deflLL = 0; }, ['criteria'], 'deflection limit 0']]) {
  await p.evaluate(() => { TBC.load(TBC.migrate({ _schema: 'timber-beam-check', version: 2 }).model); }); await p.waitForTimeout(300);
  await setM(fn); const d = await dots();
  ok(JSON.stringify(d) === JSON.stringify(want), `NDS ${what}: dots ${d.join(',')} (want ${want.join(',')})`);
}
await p.evaluate(() => { TBC.load(TBC.migrate({ _schema: 'timber-beam-check', version: 2 }).model); }); await p.waitForTimeout(300);
ok((await dots()).length === 0, 'NDS default: no dots');
// 4. AASHTO
await p.click('#tbcInTab_project'); await p.selectOption('[data-fkey="dcode"]', 'AASHTO'); await p.waitForTimeout(600);
await setM(m => { m.design.aashto.bl = tbcAasLoadDefaults(); m.design.aashto.bl.pos = 'ext'; m.design.aashto.bl.de = 1.5; m.design.latTop = 'Supports'; m.design.aashto.dLim = 425; });
const acRes = await p.evaluate(() => JSON.stringify([TBC.aas, TBC.al && TBC.al.df, TBC.ac && TBC.ac.gov]));
w = await where();
expectOn(w, 'geom', ['spanL0', 'latTop', 'luTop', 'latBot', 'spacing', 'aasBDeck', 'aasPos', 'aasWRd', 'aasDe', 'aasNB'], 'AASHTO');
expectOn(w, 'member', ['mtype', 'aasSp', 'aasGr', 'size', 'flat', 'cost'], 'AASHTO');
expectOn(w, 'loads', ['aasGW', 'aasTD', 'aasGD', 'aasTWs', 'aasGWs', 'aasRail', 'aasTrib', 'aasDfMode', 'aasIM', 'aasPermit'], 'AASHTO');
expectOn(w, 'criteria', ['wet', 'incised', 'aasDeck', 'aasDLim'], 'AASHTO');
ok(await p.evaluate(() => [...document.querySelectorAll('#tbcInPane_geom .sec')].map(s => s.getAttribute('data-secid')).join(',')) === 'inLayout,inStab,inSpacing,inAasXs', 'AASHTO Geometry cards');
ok(await p.evaluate(() => [...document.querySelectorAll('#tbcInPane_criteria .sec')].map(s => s.getAttribute('data-secid')).join(',')) === 'inAasFac,inAasDefl,inAasNot', 'AASHTO Design criteria cards');
for (const t of TABS) { await p.click('#tbcInTab_' + t); await p.waitForTimeout(80); }
ok(await p.evaluate(() => JSON.stringify([TBC.aas, TBC.al && TBC.al.df, TBC.ac && TBC.ac.gov])) === acRes, 'AASHTO: switching input tabs changes no result');
ok((await dots()).length === 0, 'AASHTO exterior: no dots');
for (const [fn, want, what] of [[m => { m.design.aashto.bl.wRd = 0; }, ['geom'], 'roadway width 0'], [m => { m.material.type = 'glulam'; m.design.flatUse = true; }, ['member'], 'glulam flat use'],
  [m => { m.material.type = 'sawn'; m.material.size = '2x10'; m.design.flatUse = true; m.design.aashto.deck = 'plank'; }, ['member', 'criteria'], 'plank deck factor, 2x10'], [m => { m.design.aashto.dLim = -1; }, ['criteria'], 'deflection limit −1']]) {
  await setM(m => { m.material.type = 'sawn'; m.material.size = '2x10'; m.design.flatUse = false; m.design.aashto.deck = 'none'; m.design.aashto.dLim = 425; m.design.aashto.bl.wRd = 24; });
  await setM(fn); const d = await dots();
  ok(JSON.stringify(d) === JSON.stringify(want), `AASHTO ${what}: dots ${d.join(',')} (want ${want.join(',')})`);
}
// 5. 390 px
await p.setViewportSize({ width: 390, height: 900 }); await p.waitForTimeout(500);
ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 390, '390 px: no horizontal page scroll');
ok(await p.evaluate(() => [...document.querySelectorAll('#tbcInTabs .tbcInTab')].every(x => { const r = x.getBoundingClientRect(); return r.left >= 0 && r.right <= 390; })), '390 px: every input tab button in view');
if (args.shots) {
  fs.mkdirSync(args.shots, { recursive: true });
  await setM(m => { m.material.type = 'sawn'; m.material.size = '6x16'; m.design.aashto.gr = 'No.1'; m.design.flatUse = false; m.design.aashto.deck = 'none'; m.design.aashto.dLim = 425; m.design.aashto.bl.wRd = 24; });
  await p.click('#tbcInTab_geom'); await p.waitForTimeout(200); await p.screenshot({ path: path.join(args.shots, 'gfx-tabs-aashto-geom-390.png'), fullPage: true });
  await p.setViewportSize({ width: 1400, height: 1000 }); await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(args.shots, 'gfx-tabs-aashto-geom-desktop.png') });
  await p.click('#tbcInTab_project'); await p.selectOption('[data-fkey="dcode"]', 'NDS'); await p.waitForTimeout(600);
  for (const t of ['member', 'criteria']) { await p.click('#tbcInTab_' + t); await p.waitForTimeout(200); await p.screenshot({ path: path.join(args.shots, `gfx-tabs-nds-${t}-desktop.png`) }); }
}
ok(!errs.length, 'console errors: ' + errs.join(' | '));
await b.close();
if (fails.length) { console.log('FAIL\n' + fails.join('\n')); process.exit(1); }
console.log('timber-input-tabs: PASS');
