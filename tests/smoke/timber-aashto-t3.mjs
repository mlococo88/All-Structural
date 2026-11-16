#!/usr/bin/env node
// Timber Beam Check, AASHTO LRFD 10th Ed. phase T3 (fix log TBA4, 2026-11-16): the checks, in the working tree (headless Chromium, file://).
// For each case: the AASHTO Checks tab (summary, flexure, shear, notes), every ratio the engine gives (TBC.ac) shown, the OK / NG of each
// check block equal to the engine's, the governing strip and the left column (PASS / FAIL with the governing check), no NaN / undefined,
// no KaTeX errors; the lateral-support inputs on the Factors tab in AASHTO mode; the Report section (steps, summary table with § links);
// 390 px without horizontal page scroll; 0 console errors. Screenshots (deviceScaleFactor 1) with --shots <dir>.
//   node tests/smoke/timber-aashto-t3.mjs [--shots <dir>]
import fs from 'node:fs';
import path from 'node:path';
import { openPage, REPO } from '../lib.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) if (av[i].startsWith('--')) args[av[i].slice(2)] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true;
const FILE = path.join(REPO, 'Timber Beam Check.html');
const fails = []; const ok = (c, msg) => { if (!c) fails.push(msg); };
const { b, p, errs } = await openPage(FILE, { vw: 1400, vh: 1000 });
await p.waitForFunction(() => window.TBC && window.TBC.res, null, { timeout: 30000 }); await p.waitForTimeout(800);
await p.click('#tbcInTab_factors'); await p.selectOption('[data-fkey="dcode"]', 'AASHTO'); await p.waitForTimeout(600);
ok(await p.evaluate(() => !!document.querySelector('[data-fkey="latTop"]') && !!document.querySelector('[data-fkey="latBot"]')), 'Factors tab (AASHTO): lateral-support inputs');
const st = async () => p.evaluate(() => ({ gov: document.getElementById('govStrip').innerText, govCls: document.getElementById('govStrip').className, text: document.getElementById('tabPages').innerText,
  dash: (document.getElementById('tbcDash') || {}).innerText || '', blocks: [...document.querySelectorAll('#tabPages .eqb')].map(e => (e.querySelector('.st') || {}).textContent || ''),
  kerr: document.querySelectorAll('.katex-error').length, AC: TBC.ac }));
const cases = {
  sawnSimple: m => { m.material.size = '10x16'; m.design.aashto.gr = 'No.1'; m.geom.spacing = 24; m.geom.spans = [{ L: 16 }]; m.geom.supports = [0, 1].map(() => ({ t: 'pin', lb: 5.5, cb: false })); Object.assign(m.design.aashto.bl, { tWs: 2 }); },
  sawnBraced: m => { m.material.size = '6x16'; m.design.aashto.gr = 'No.1'; m.geom.spacing = 24; m.geom.spans = [{ L: 20 }]; m.geom.supports = [0, 1].map(() => ({ t: 'pin', lb: 5.5, cb: false })); m.design.latTop = 'Supports'; m.design.luTop = 10; },
  glulamCont: m => { m.material.type = 'glulam'; m.material.glulam.grp = 'DF'; m.material.glulam.b = 6.75; m.material.glulam.nLam = 16; m.geom.spacing = 48; m.geom.spans = [{ L: 30 }, { L: 30 }]; m.geom.supports = [0, 1, 2].map(() => ({ t: 'pin', lb: 5.5, cb: false }));
    Object.assign(m.design.aashto.bl, { deck: 'glpanel', tD: 5.125, tWs: 3 }); m.design.latBot = 'Supports'; m.design.luBot = 10; },
  glulamPermit: m => { m.material.type = 'glulam'; m.material.glulam.grp = 'DF'; m.material.glulam.b = 6.75; m.material.glulam.nLam = 20; m.geom.spacing = 48; m.geom.spans = [{ L: 24 }, { L: 6 }]; m.geom.supports = [{ t: 'pin', lb: 6, cb: false }, { t: 'pin', lb: 6, cb: false }, { t: 'free', lb: 3.5, cb: false }];
    Object.assign(m.design.aashto.bl, { deck: 'glpanel', permit: '20, 30@14, 30@4' }); },
  exterior: m => { m.material.size = '8x16'; m.design.aashto.gr = 'SS'; m.geom.spacing = 24; m.geom.spans = [{ L: 18 }]; m.geom.supports = [0, 1].map(() => ({ t: 'pin', lb: 5.5, cb: false })); Object.assign(m.design.aashto.bl, { pos: 'ext', de: 1.5 }); },
};
for (const [name, fn] of Object.entries(cases)) {
  await p.evaluate(src => { const m = TBC.model; m.material.type = 'sawn'; m.design.latTop = 'Continuous'; m.design.latBot = 'Supports'; m.design.luTop = 0; m.design.luBot = 0; m.design.aashto.bl = tbcAasLoadDefaults(); (0, eval)('(' + src + ')')(m); TBC.fullRebuild(); }, fn.toString());
  await p.waitForTimeout(500);
  await p.click('#tab_aasC'); await p.waitForTimeout(700);
  const s = await st();
  ok(s.AC && s.AC.ok, `${name}: checks: ${s.AC && (s.AC.errors || []).join('; ')}`);
  if (!s.AC || !s.AC.ok) continue;
  ok(s.kerr === 0 && !/NaN|undefined|Infinity/.test(s.text), `${name}: KaTeX errors ${s.kerr}, NaN/undefined ${/NaN|undefined|Infinity/.test(s.text)}`);
  for (const c of ['aasCSum', 'aasFlex', 'aasShr', 'aasCNotes']) ok(await p.$(`#tabPages .sec[data-secid="${c}"]`), `${name}: card ${c}`);
  const all = s.AC.flex.concat(s.AC.shear);
  ok(all.length >= 2, `${name}: ${all.length} check items`);
  all.forEach(it => ok(s.text.includes(it.ratio.toFixed(3)), `${name}: ratio ${it.ratio.toFixed(3)} shown (${it.kind})`));
  all.forEach(it => ok(s.text.includes((it.kind === 'flex' ? it.Mr : it.Vr).toFixed(3)), `${name}: resistance ${(it.kind === 'flex' ? it.Mr : it.Vr).toFixed(3)} shown`));
  const st2 = s.blocks.filter(Boolean);
  ok(st2.length === all.length && st2.every((x, i) => x === ((all[i].rbNG || all[i].ratio > 1) ? 'NG' : 'OK')), `${name}: block statuses ${st2.join(',')} vs engine`);
  const ng = all.some(it => !it.ok);
  ok(/Governing: (Flexure|Shear)/.test(s.gov) && s.gov.includes((s.AC.gov.ratio * 100).toFixed(1) + ' %') && s.govCls.includes(ng ? 'fail' : 'pass') && s.gov.includes(ng ? 'NG' : 'OK'), `${name}: governing strip ${s.gov} (${s.govCls})`);
  ok(/Flexure \[Art\. 8\.6\.2\]/.test(s.dash) && /Shear \[Art\. 8\.7\]/.test(s.dash) && s.dash.includes(s.AC.govFlex.ratio.toFixed(3)), `${name}: left column: ${s.dash.slice(0, 160)}`);
  if (name === 'glulamCont') ok(s.AC.flex.some(it => it.sg < 0 && it.CL < 1) && s.AC.flex.every(it => it.Lz > 0 && it.Lz < 60), 'glulamCont: −M with C_L < 1; C_V lengths from zero-moment points');
  if (name === 'glulamPermit') ok(s.AC.flex.some(it => it.lim === 'StrII') && /Strength II/.test(s.text), 'glulamPermit: Strength II checks');
  if (name === 'sawnBraced') ok(s.AC.flex[0].CL < 1 && /R_?B|RB/.test(s.text.replace(/\s/g, '')), 'sawnBraced: C_L < 1 worked');
  // a click on a left-column line opens its card
  await p.click('#tbcDash .tbcDc'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.querySelector('#tabBar button.on, #tabBar button.active, #tabBar button[aria-selected="true"]')?.textContent.trim() || ''), `${name}: tab after the left-column click`);
  if (args.shots) {
    fs.mkdirSync(args.shots, { recursive: true });
    await p.click('#tab_aasC'); await p.waitForTimeout(300);
    await p.setViewportSize({ width: 1400, height: 7000 }); await p.waitForTimeout(400);
    for (const sec of ['aasCSum', 'aasFlex', 'aasShr']) { const h = await p.$(`#tabPages .sec[data-secid="${sec}"]`); if (h && (name !== 'exterior')) await h.screenshot({ path: path.join(args.shots, `t3-${name}-${sec}.png`) }); }
    await p.setViewportSize({ width: 1400, height: 1000 }); await p.waitForTimeout(300);
    if (name === 'glulamCont') { await p.screenshot({ path: path.join(args.shots, 't3-glulamCont-page.png') }); await p.click('#tbcInTab_factors'); await p.waitForTimeout(200); const pn = await p.$('#tbcInPane_factors'); if (pn) await pn.screenshot({ path: path.join(args.shots, 't3-factors-pane.png') }); }
  }
}
// Report
await p.click('#tab_rpt'); await p.waitForTimeout(1500);
const rt = await p.evaluate(() => typeof TBRP !== 'undefined' && TBRP.doc ? SharedReport.text(TBRP.doc) : '');
ok(/AASHTO checks \(Art\. 8\.6, 8\.7\)/.test(rt) && /Summary of the checks/.test(rt) && /Flexure check/.test(rt) && /Shear check/.test(rt) && !/NaN|undefined/.test(rt), 'Report: checks section: ' + rt.slice(0, 200));
ok(/§\s*\d+\.\d+/.test(rt), 'Report: § references');
ok(await p.evaluate(() => document.querySelectorAll('.katex-error').length) === 0, 'KaTeX errors in the report');
if (args.shots) { const h = await p.$('#tabPages'); if (h) await p.screenshot({ path: path.join(args.shots, 't3-report.png') }); }
// back to NDS: no AASHTO checks, NDS tabs
await p.click('#tbcInTab_factors'); await p.selectOption('[data-fkey="dcode"]', 'NDS'); await p.waitForTimeout(500);
ok(await p.evaluate(() => TBC.ac === null && [...document.querySelectorAll('#tabBar button')][0].textContent.trim() === 'Summary'), 'NDS mode: no AASHTO checks');
await p.selectOption('[data-fkey="dcode"]', 'AASHTO'); await p.waitForTimeout(400);
// 390 px
await p.setViewportSize({ width: 390, height: 900 }); await p.click('#tab_aasC').catch(() => {}); await p.waitForTimeout(600);
ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), '390 px: horizontal page scroll');
ok(!errs.length, 'console errors: ' + errs.join(' | '));
await b.close();
console.log(fails.length ? 'FAIL\n  ' + fails.join('\n  ') : 'PASS');
process.exit(fails.length ? 1 : 0);
