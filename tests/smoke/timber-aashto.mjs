#!/usr/bin/env node
// Timber Beam Check, AASHTO LRFD 10th Ed. code switch, phase T1 (TBA1, 2026-11-16). Two parts, one browser at a time:
// 1. NDS parity: a reference copy (default: origin/main with its shared/ folder, extracted with git archive) and the working tree open
//    the same NDS projects (ASD and LRFD; sawn, timber, glulam, SCL; simple, continuous, overhang, cantilever; an input error); for each,
//    every output tab is opened by its tab button and compared: the tab's text, the governing strip, the left column, the Report text
//    (SharedReport.text) and every computed value (TBC.res). Expected: identical.
// 2. AASHTO mode in the working tree: Design code switched with the Factors input tab's select; only the AASHTO Materials and Report tabs;
//    no status chips on the AASHTO Materials tab (TBA4: the governing strip and the left column carry the checks); the shown F_b (Strength I) equals the engine's; no NaN / undefined, no KaTeX errors;
//    the Report; autosave (version 4, design.code) and reload; back to NDS gives the same NDS results; an input error (SCL); 390 px
//    without horizontal scroll; 0 console errors. Screenshots of the AASHTO Materials card (deviceScaleFactor 1) with --shots <dir>.
//   node tests/smoke/timber-aashto.mjs [--a <folder with the reference Timber Beam Check.html and shared/> | --ref <git ref>] [--shots <dir>]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { openPage, REPO } from '../lib.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) if (av[i].startsWith('--')) args[av[i].slice(2)] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true;
const FILE = 'Timber Beam Check.html';
let dirA = args.a;
if (!dirA) {
  const ref = args.ref || 'origin/main', sha = execFileSync('git', ['-C', REPO, 'rev-parse', '--short', ref], { encoding: 'utf8' }).trim();
  dirA = path.join(os.tmpdir(), 'allstruct-tests', 'tbc-' + sha);
  if (!fs.existsSync(path.join(dirA, FILE))) { fs.mkdirSync(dirA, { recursive: true }); execFileSync('sh', ['-c', `git -C "${REPO}" archive ${sha} "${FILE}" shared | tar -x -C "${dirA}"`]); }
}
const fails = []; const ok = (c, msg) => { if (!c) fails.push(msg); };

const NDS = {
  default: m => { },
  glulam2: m => { m.material.type = 'glulam'; m.material.glulam.combo = '24F-1.8E'; m.geom.spacing = 96; m.geom.spans = [{ L: 22 }, { L: 18 }]; m.geom.supports = [{ t: 'pin', lb: 3.5, cb: false }, { t: 'pin', lb: 5.5, cb: true }, { t: 'pin', lb: 3.5, cb: false }]; m.loads.L = 0; m.loads.S = 30; m.material.notch = 1; },
  lrfdOverhang: m => { m.design.method = 'LRFD'; m.material.size = '2x12'; m.material.grade = 'No.1'; m.geom.spans = [{ L: 14 }, { L: 3 }]; m.geom.supports = [{ t: 'pin', lb: 3.5, cb: false }, { t: 'pin', lb: 3.5, cb: true }, { t: 'free', lb: 3.5, cb: false }]; m.loads.W = -40; m.loads.points = [{ mag: 600, loc: 16.5, type: 'L' }]; m.material.notch = 1.5; m.design.shearXd = true; },
  sclCant: m => { m.material.type = 'scl'; Object.assign(m.material.scl, { Fb: 2600, Fv: 285, Fcp: 750, E: 1900000, Emin: 966000, n: 0.111, dens: 42 }); m.geom.spans = [{ L: 6 }]; m.geom.supports = [{ t: 'fixed', lb: 3.5, cb: false }, { t: 'free', lb: 3.5, cb: false }]; },
  timberWetFlat: m => { m.material.size = '6x12'; m.material.grade = 'No.1'; m.design.moisture = 'Wet'; m.design.flatUse = true; m.geom.spacing = 48; },
  error: m => { m.geom.spacing = 0; },
};
const TABS = ['sum', 'sch', 'ana', 'dv', 'bend', 'shear', 'bear', 'defl', 'refv', 'val', 'man', 'rpt'];
async function collect(file) {
  const { b, p, errs } = await openPage(file, { vw: 1400, vh: 1000 });
  await p.waitForFunction(() => window.TBC && window.TBC.res, null, { timeout: 30000 }); await p.waitForTimeout(800);
  const out = {};
  for (const [name, fn] of Object.entries(NDS)) {
    await p.evaluate(s => { const d = JSON.parse(JSON.stringify(TBC.migrate({ _schema: 'timber-beam-check', version: 2 }).model)); (0, eval)('(' + s + ')')(d); d.version = 3; TBC.load(d); }, fn.toString()).catch(e => fails.push(name + ': ' + e.message));
    await p.waitForTimeout(400);
    const rec = { res: await p.evaluate(() => JSON.stringify(TBC.res, (k, x) => typeof x === 'number' && !isFinite(x) ? String(x) : x)) };
    for (const t of TABS) {
      await p.click('#tab_' + t); await p.waitForTimeout(t === 'rpt' ? 1500 : 250);
      rec[t] = await p.evaluate(t => ({ tab: document.getElementById('tabPages').innerText.replace(/\s+/g, ' '), gov: document.getElementById('govStrip').innerText, dash: (document.getElementById('tbcDash') || {}).innerText || '',
        rpt: t === 'rpt' && typeof TBRP !== 'undefined' && TBRP.doc ? SharedReport.text(TBRP.doc) : '' }), t);
    }
    out[name] = rec;
  }
  await b.close();
  return { out, errs };
}
// ---------- part 1 ----------
// the same starting model in both pages: the working tree's default model
const A = await collect(path.join(dirA, FILE));
const B = await collect(path.join(REPO, FILE));
let nCmp = 0, nDiff = 0;
for (const name of Object.keys(NDS)) {
  const a = A.out[name], b = B.out[name];
  nCmp++; if (a.res !== b.res) { nDiff++; fails.push(`NDS ${name}: TBC.res differs`); }
  ok(a.rpt.rpt.length > 1000 && b.rpt.rpt.length > 1000 || name === 'error', `NDS ${name}: Report text read (${a.rpt.rpt.length}, ${b.rpt.rpt.length} chars)`);
  for (const t of TABS) for (const k of ['tab', 'gov', 'dash', 'rpt']) { nCmp++; if (a[t][k] !== b[t][k]) { nDiff++; fails.push(`NDS ${name} / ${t} / ${k} differs`); } }
}
ok(!A.errs.length && !B.errs.length, 'console errors (NDS part): ' + [...A.errs, ...B.errs].join(' | '));
console.log(`part 1 (NDS parity, ${dirA} vs working tree): ${Object.keys(NDS).length} projects × ${TABS.length} tabs, ${nCmp} comparisons, ${nDiff} differences`);

// ---------- part 2 ----------
{
  const { b, p, errs } = await openPage(path.join(REPO, FILE), { vw: 1400, vh: 1000 });
  await p.waitForFunction(() => window.TBC && window.TBC.res, null, { timeout: 30000 }); await p.waitForTimeout(800);
  const ndsRes = await p.evaluate(() => JSON.stringify(TBC.res));
  await p.click('#tbcInTab_factors'); await p.selectOption('[data-fkey="dcode"]', 'AASHTO'); await p.waitForTimeout(600);
  const st = async () => p.evaluate(() => ({ tabs: [...document.querySelectorAll('#tabBar button')].map(x => x.textContent.trim()), gov: document.getElementById('govStrip').innerText, text: document.getElementById('tabPages').innerText,
    chips: document.querySelectorAll('#tabPages .st.ok, #tabPages .st.ng').length, dashChk: document.querySelectorAll('#tbcDash .tbcDc.pass, #tbcDash .tbcDc.fail').length, kerr: document.querySelectorAll('.katex-error').length, A: TBC.aas, AC: TBC.ac, h1: document.querySelector('h1').textContent }));
  // straight back to NDS and to AASHTO again: the NDS results as before the switch
  await p.selectOption('[data-fkey="dcode"]', 'NDS'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => JSON.stringify(TBC.res)) === ndsRes, 'NDS results unchanged after visiting AASHTO mode');
  ok(await p.evaluate(() => !('code' in JSON.parse(localStorage.getItem('tbc_autosave_v1')).design)), 'NDS: no design.code saved');
  await p.selectOption('[data-fkey="dcode"]', 'AASHTO'); await p.waitForTimeout(500);
  let s = await st();
  ok(s.tabs.join('|') === 'AASHTO Materials|Bridge Loads|AASHTO Checks|Report', 'AASHTO tabs: ' + s.tabs.join('|'));   // TBA2: Bridge Loads tab; TBA4: AASHTO Checks tab
  ok(s.AC && s.AC.ok && /Governing: (Flexure|Shear)/.test(s.gov) && /\b(OK|NG)\b/.test(s.gov) && s.dashChk >= 2, 'governing strip and left column with the checks (TBA4): ' + s.gov); ok(/AASHTO LRFD 10th Ed/.test(s.h1), 'header: ' + s.h1);
  ok(s.chips === 0, 'status chips on the AASHTO Materials tab: ' + s.chips); ok(s.kerr === 0, 'KaTeX errors: ' + s.kerr); ok(!/NaN|undefined/.test(s.text), 'NaN / undefined in the AASHTO tab');
  ok(s.A.ok && s.text.includes('= ' + s.A.lims[0].Fb.toFixed(4) + ' ksi'), 'F_b Strength I shown as the engine value ' + (s.A.lims && s.A.lims[0].Fb));
  const cases = {
    sawnWet: m => { m.material.size = '6x16'; m.design.aashto.gr = 'No.1'; m.design.moisture = 'Wet'; m.design.incising = true; },
    glulam: m => { m.material.type = 'glulam'; m.geom.spans = [{ L: 24 }, { L: 6 }]; m.geom.supports = [{ t: 'pin', lb: 3.5, cb: false }, { t: 'pin', lb: 5.5, cb: true }, { t: 'free', lb: 3.5, cb: false }]; m.design.moisture = 'Wet'; m.design.aashto.noTL = true; },
    glulamT2: m => { m.material.type = 'glulam'; m.material.glulam.nLam = 12; m.design.aashto.gl = 'T2-5'; },
    spTimber: m => { m.material.type = 'sawn'; m.design.aashto.sp = 'SP'; m.material.size = '8x16'; m.design.aashto.gr = 'SS'; m.design.flatUse = true; },
    plank: m => { m.material.size = '4x6'; m.design.flatUse = true; m.design.aashto.deck = 'plank'; m.design.aashto.sp = 'HF'; m.design.aashto.gr = 'No.2'; },
  };
  for (const [name, fn] of Object.entries(cases)) {
    await p.evaluate(src => { const m = TBC.model; m.material.type = 'sawn'; m.material.size = '2x10'; m.design.moisture = 'Dry'; m.design.incising = false; m.design.flatUse = false; m.design.aashto = { sp: 'DF-L', gr: 'No.2', gl: '24F-V4 DF/DF', deck: 'none', noTL: false };
      (0, eval)('(' + src + ')')(m); TBC.fullRebuild(); }, fn.toString());
    await p.waitForTimeout(500);
    s = await st();
    ok(s.A.ok, `${name}: AASHTO result: ${(s.A.errors || []).join('; ')}`); ok(s.chips === 0 && s.kerr === 0 && !/NaN|undefined/.test(s.text), `${name}: chips ${s.chips}, KaTeX errors ${s.kerr}, NaN/undefined ${/NaN|undefined/.test(s.text)}`);
    if (s.A.ok) ok(s.text.includes('= ' + s.A.lims[0].Fb.toFixed(4) + ' ksi'), `${name}: F_b shown`);
    if (args.shots && (name === 'sawnWet' || name === 'glulam')) {
      fs.mkdirSync(args.shots, { recursive: true });
      await p.setViewportSize({ width: 1400, height: 6000 }); await p.waitForTimeout(400);   // the whole card in view (deviceScaleFactor 1)
      for (const sec of ['aasRef', 'aasFac', 'aasAdj']) { const h = await p.$(`#tabPages .sec[data-secid="${sec}"]`); if (h) await h.screenshot({ path: path.join(args.shots, `t1-${name}-${sec}.png`) }); }
      await p.setViewportSize({ width: 1400, height: 1000 });
    }
  }
  // Report
  await p.click('#tab_rpt'); await p.waitForTimeout(1200);
  const rt = await p.evaluate(() => typeof TBRP !== 'undefined' && TBRP.doc ? SharedReport.text(TBRP.doc) : '');
  ok(/AASHTO LRFD/.test(rt) && /Result: (OK — governing|NG — governing|No checks: )/.test(rt)   /* TBA4: the result line of the checks */ && !/NaN|undefined/.test(rt), 'AASHTO report text: ' + rt.slice(0, 300));
  ok(await p.evaluate(() => document.querySelectorAll('.katex-error').length) === 0, 'KaTeX errors in the report');
  // input error: SCL
  await p.evaluate(() => { TBC.model.material.type = 'scl'; TBC.fullRebuild(); }); await p.waitForTimeout(400);
  s = await st(); ok(!s.A.ok && /SCL/.test(s.gov + s.text) || /input/.test(s.gov), 'SCL error shown: ' + s.gov);
  ok(await p.evaluate(() => document.getElementById('tbcInTab_material').classList.contains('has-err')), 'SCL error marks the Material input tab');
  await p.evaluate(() => { TBC.model.material.type = 'glulam'; TBC.fullRebuild(); }); await p.waitForTimeout(300);
  // autosave and reload
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('tbc_autosave_v1')));
  ok(saved.version === 4 && saved.design.code === 'AASHTO' && saved.design.aashto, 'autosave: version 4 with design.code');
  const before = await p.evaluate(() => JSON.stringify(TBC.aas));
  await p.reload(); await p.waitForFunction(() => window.TBC && window.TBC.res, null, { timeout: 30000 }); await p.waitForTimeout(800);
  ok(await p.evaluate(() => JSON.stringify(TBC.aas)) === before, 'reload: the same AASHTO result');
  // 390 px
  await p.setViewportSize({ width: 390, height: 900 }); await p.click('#tab_aas').catch(() => {}); await p.waitForTimeout(500);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), '390 px: horizontal page scroll');
  await p.setViewportSize({ width: 1400, height: 1000 });
  // back to NDS: the NDS results of the default project as before the switch
  await p.evaluate(() => { const m = TBC.model; m.material.type = 'sawn'; m.material.size = '2x10'; m.design.moisture = 'Dry'; m.design.incising = false; m.design.flatUse = false; TBC.fullRebuild(); });
  await p.click('#tbcInTab_factors'); await p.selectOption('[data-fkey="dcode"]', 'NDS'); await p.waitForTimeout(600);
  s = await st();
  ok(s.tabs[0] === 'Summary' && s.tabs.length === 12, 'NDS tabs back: ' + s.tabs.join('|')); ok(!/AASHTO/.test(s.h1), 'NDS header back');
  ok(await p.evaluate(() => TBC.res.ok && !('code' in JSON.parse(localStorage.getItem('tbc_autosave_v1')).design)), 'back to NDS: results, no design.code saved');
  ok(!errs.length, 'console errors (AASHTO part): ' + errs.join(' | '));
  await b.close();
  console.log(`part 2 (AASHTO mode): ${Object.keys(cases).length + 1} members, report, input error, autosave / reload, 390 px, back to NDS`);
}
console.log(fails.length ? 'FAIL\n  ' + fails.join('\n  ') : 'PASS');
process.exit(fails.length ? 1 : 0);
