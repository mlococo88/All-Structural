#!/usr/bin/env node
// Timber Beam Check, AASHTO LRFD 10th Ed. phase T2 (TBA2, 2026-11-16): bridge loads, in the working tree (headless Chromium, file://).
// - the code switch: a project switched to AASHTO for the first time is set to wet service (engineer decision 2026-11-16); back to NDS
//   restores the NDS setting (dry) and the NDS results; a TBA1 project (AASHTO, dry, saved before) opens dry, unchanged;
// - the Loads tab shows the bridge-load inputs; an edit creates design.aashto.bl (autosave version 5);
// - the Bridge Loads tab: every card, the values equal to the engine's (AL), no NaN / undefined, no KaTeX errors, no PASS / FAIL on the tab (TBA4: the checks are on the AASHTO Checks tab);
//   interior / exterior / concrete deck / entered DF; the Report section; 390 px without horizontal scroll; 0 console errors.
// Screenshots of the Bridge Loads cards (deviceScaleFactor 1) with --shots <dir>.
//   node tests/smoke/timber-aashto-t2.mjs [--shots <dir>]
import fs from 'node:fs';
import path from 'node:path';
import { openPage, REPO } from '../lib.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) if (av[i].startsWith('--')) args[av[i].slice(2)] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true;
const FILE = path.join(REPO, 'Timber Beam Check.html');
const fails = []; const ok = (c, msg) => { if (!c) fails.push(msg); };
const { b, p, errs } = await openPage(FILE, { vw: 1400, vh: 1000 });
await p.waitForFunction(() => window.TBC && window.TBC.res, null, { timeout: 30000 }); await p.waitForTimeout(800);
const ndsRes = await p.evaluate(() => JSON.stringify(TBC.res));
const st = async () => p.evaluate(() => ({ tabs: [...document.querySelectorAll('#tabBar button')].map(x => x.textContent.trim()), gov: document.getElementById('govStrip').innerText, text: document.getElementById('tabPages').innerText,
  chips: document.querySelectorAll('#tabPages .st.ok, #tabPages .st.ng').length,   // TBA4: the left column has the checks; the Bridge Loads tab has none
  kerr: document.querySelectorAll('.katex-error').length, AL: TBC.al, A: TBC.aas,
  saved: JSON.parse(localStorage.getItem('tbc_autosave_v1')) }));
// 1. wet default on the first switch; back to NDS: dry and the NDS results
await p.click('#tbcInTab_factors'); await p.selectOption('[data-fkey="dcode"]', 'AASHTO'); await p.waitForTimeout(600);
let s = await st();
ok(s.saved.design.moisture === 'Wet' && s.saved.design.aashto.ndsMoist === 'Dry', `first switch to AASHTO: wet (saved ${s.saved.design.moisture}, ndsMoist ${s.saved.design.aashto.ndsMoist})`);
ok(await p.evaluate(() => document.querySelector('[data-fkey="wet"]').checked), 'Wet service box ticked');
ok(s.saved.version === 5, 'version 5 with the kept NDS setting: ' + s.saved.version);
ok(s.tabs.join('|') === 'AASHTO Materials|Bridge Loads|AASHTO Checks|Report', 'tabs: ' + s.tabs.join('|'));   // TBA4
// untick wet in AASHTO, back to NDS, to AASHTO again: the AASHTO setting (dry) comes back; NDS stays dry
await p.click('[data-fkey="wet"]'); await p.waitForTimeout(400);
await p.selectOption('[data-fkey="dcode"]', 'NDS'); await p.waitForTimeout(500);
ok(await p.evaluate(() => JSON.stringify(TBC.res)) === ndsRes, 'NDS results after AASHTO wet / dry and back');
await p.selectOption('[data-fkey="dcode"]', 'AASHTO'); await p.waitForTimeout(500);
ok(await p.evaluate(() => TBC.model.design.moisture) === 'Dry', 'second switch: the AASHTO setting kept (dry)');
await p.click('[data-fkey="wet"]'); await p.waitForTimeout(300);
await p.selectOption('[data-fkey="dcode"]', 'NDS'); await p.waitForTimeout(400);
ok(await p.evaluate(() => TBC.model.design.moisture === 'Dry' && TBC.model.design.aashto.moist === 'Wet'), 'NDS: dry; the AASHTO wet setting kept in design.aashto.moist');
ok(await p.evaluate(() => JSON.stringify(TBC.res)) === ndsRes, 'NDS results unchanged');
await p.selectOption('[data-fkey="dcode"]', 'AASHTO'); await p.waitForTimeout(400);
ok(await p.evaluate(() => TBC.model.design.moisture) === 'Wet', 'third switch: wet again (as left in AASHTO)');
// a TBA1 project (AASHTO, dry, version 4) opens dry and unchanged
await p.evaluate(() => { const d = JSON.parse(JSON.stringify(TBC.migrate({ _schema: 'timber-beam-check', version: 2 }).model)); d.design.code = 'AASHTO'; d.design.aashto = { sp: 'DF-L', gr: 'No.2', gl: '24F-V4 DF/DF', deck: 'none', noTL: false }; d.version = 4; TBC.load(d); });
await p.waitForTimeout(500); s = await st();
ok(s.saved.design.moisture === 'Dry' && s.saved.version === 4 && !s.saved.design.aashto.bl, `TBA1 project: dry, version 4, no bridge-load field (${s.saved.design.moisture}, ${s.saved.version})`);
// 2. Loads tab: an edit creates the inputs
await p.click('#tbcInTab_loads'); await p.waitForTimeout(200);
ok(await p.evaluate(() => !!document.querySelector('[data-fkey="aasBDeck"]') && !document.querySelector('[data-fkey="load_D"]')), 'Loads tab: bridge-load inputs, no building loads');
await p.fill('[data-fkey="aasTWs"]', '2'); await p.waitForTimeout(500);
s = await st(); ok(s.saved.version === 5 && s.saved.design.aashto.bl && s.saved.design.aashto.bl.tWs === 2, 'edit: design.aashto.bl saved, version 5');
// 3. Bridge Loads tab for several cases
const cases = {
  interiorPlank: m => { m.material.size = '6x16'; m.design.aashto.gr = 'No.1'; m.geom.spacing = 24; Object.assign(m.design.aashto.bl, { tWs: 2, wRail: 0.05 }); },
  exterior: m => { m.material.size = '6x16'; m.design.aashto.gr = 'No.1'; m.geom.spacing = 24; Object.assign(m.design.aashto.bl, { pos: 'ext', de: 1.5, nB: 12 }); },
  concrete: m => { m.material.type = 'glulam'; m.geom.spacing = 72; Object.assign(m.design.aashto.bl, { deck: 'concrete', tD: 8, wRd: 30 }); },
  plankBeyond: m => { m.material.size = '8x16'; m.geom.spacing = 72; },
  twoSpanPermit: m => { m.material.size = '6x16'; m.design.aashto.gr = 'No.1'; m.geom.spans = [{ L: 24 }, { L: 24 }]; m.geom.supports = [{ t: 'pin', lb: 3.5, cb: false }, { t: 'pin', lb: 5.5, cb: true }, { t: 'pin', lb: 3.5, cb: false }]; m.design.aashto.bl.permit = '20, 30@14, 30@4'; },
  overhang: m => { m.material.type = 'glulam'; m.geom.spacing = 48; m.geom.spans = [{ L: 20 }, { L: 4 }]; m.geom.supports = [{ t: 'pin', lb: 3.5, cb: false }, { t: 'pin', lb: 5.5, cb: true }, { t: 'free', lb: 3.5, cb: false }]; Object.assign(m.design.aashto.bl, { deck: 'glpanel', nB: 8 }); },
  entered: m => { m.material.size = '6x16'; Object.assign(m.design.aashto.bl, { dfMode: 'entered', gM: 0.35, gV: 0.4, im: 33 }); },
};
for (const [name, fn] of Object.entries(cases)) {
  await p.evaluate(src => { const m = TBC.model; m.material.type = 'sawn'; m.geom.spacing = 24; m.design.aashto.bl = tbcAasLoadDefaults(); (0, eval)('(' + src + ')')(m); TBC.fullRebuild(); }, fn.toString());
  await p.waitForTimeout(400);
  await p.click('#tab_aasL'); await p.waitForTimeout(500);
  s = await st();
  ok(s.AL && s.AL.ok, `${name}: bridge loads: ${s.AL && (s.AL.errors || []).join('; ')}`);
  ok(s.chips === 0 && s.kerr === 0 && !/NaN|undefined/.test(s.text), `${name}: chips ${s.chips}, KaTeX errors ${s.kerr}, NaN/undefined ${/NaN|undefined/.test(s.text)}`);
  if (s.AL && s.AL.ok) {
    ok(s.text.includes(s.AL.wDC.toFixed(4)) && s.text.includes(s.AL.df.gM.toFixed(4)), `${name}: w_DC ${s.AL.wDC.toFixed(4)} and g_M ${s.AL.df.gM.toFixed(4)} shown`);
    for (const c of ['aasDL', 'aasLL', 'aasDF', 'aasCmb', 'aasEnv', 'aasWV', 'aasFE', 'aasDem']) ok(await p.$(`#tabPages .sec[data-secid="${c}"]`), `${name}: card ${c}`);
    // TBA3: the demands shown are the engine's; the diagrams drawn; the left column lists them
    const ad = await p.evaluate(() => TBC.ad);
    ok(ad && ad.Mpos && s.text.includes(ad.Mpos.v.toFixed(2)) && (!ad.Vu || s.text.includes(ad.Vu.Vu.toFixed(3))), `${name}: M_u / V_u shown (${ad && ad.Mpos && ad.Mpos.v})`);
    ok(await p.evaluate(() => document.querySelectorAll('#tabPages .plotHold.js-plotly-plot').length) === 2, `${name}: two envelope diagrams`);
    ok(await p.evaluate(() => /M\s*u\+?/.test((document.getElementById('tbcDash') || {}).innerText || '')), `${name}: demands in the left column`);
    if (name === 'twoSpanPermit') ok(ad.Mpos2 && /Strength II/.test(s.text), 'permit: Strength II shown');
  }
  if (args.shots) {
    fs.mkdirSync(args.shots, { recursive: true });
    await p.setViewportSize({ width: 1400, height: 6000 }); await p.waitForTimeout(400);
    for (const sec of ['aasEnv', 'aasWV', 'aasFE', 'aasDem']) { const h = await p.$(`#tabPages .sec[data-secid="${sec}"]`); if (h && ['interiorPlank', 'twoSpanPermit', 'overhang'].includes(name)) await h.screenshot({ path: path.join(args.shots, `t2-${name}-${sec}.png`) }); }
    for (const sec of ['aasDL', 'aasDF']) { const h = await p.$(`#tabPages .sec[data-secid="${sec}"]`); if (h && (name === 'interiorPlank' || name === 'exterior' || sec === 'aasDF')) await h.screenshot({ path: path.join(args.shots, `t2-${name}-${sec}.png`) }); }
    if (name === 'interiorPlank') { const h = await p.$('#tabPages .sec[data-secid="aasCmb"]'); if (h) await h.screenshot({ path: path.join(args.shots, 't2-combos.png') }); const pn = await p.$('#tbcInPane_loads'); if (pn) await pn.screenshot({ path: path.join(args.shots, 't2-loads-inputs.png') }); }
    await p.setViewportSize({ width: 1400, height: 1000 });
  }
}
// Report
await p.click('#tab_rpt'); await p.waitForTimeout(1500);
const rt = await p.evaluate(() => typeof TBRP !== 'undefined' && TBRP.doc ? SharedReport.text(TBRP.doc) : '');
ok(/Bridge loads/.test(rt) && /Table 4\.6\.2\.2\.2a-1|lever rule|entered/i.test(rt) && !/NaN|undefined/.test(rt), 'Report: bridge loads section: ' + rt.slice(0, 200));
ok(await p.evaluate(() => document.querySelectorAll('.katex-error').length) === 0, 'KaTeX errors in the report');
// 390 px
await p.setViewportSize({ width: 390, height: 900 }); await p.click('#tab_aasL').catch(() => {}); await p.waitForTimeout(500);
ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), '390 px: horizontal page scroll');
ok(!errs.length, 'console errors: ' + errs.join(' | '));
await b.close();
console.log(fails.length ? 'FAIL\n  ' + fails.join('\n  ') : 'PASS');
process.exit(fails.length ? 1 : 0);
