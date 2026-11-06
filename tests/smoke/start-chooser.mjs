#!/usr/bin/env node
// Start-of-session project chooser (shared/projects-ui.js projectBar ctx.start, START; TRIAL in Spread Footing only, 2026-11-06,
// pending engineer review). Headless Chromium, file://, offline (libraries from tests/libs; api.github.com routed to the in-memory
// GitHub of tests/engine/gh-mock.mjs for the GitHub-only case).
//   1. no saved project, no autosave: nothing (no strip, no dialog);
//   2. autosave + saved projects: the "Recent projects" strip under the header (not over the page, no dialog), "Continue: <name>
//      (autosaved <time> EST/EDT)" after an earlier session's edit, at most 5 Open buttons, most recently saved / opened first;
//   3. Continue keeps the state on screen (inputs and results identical) and closes the strip; × closes it; the first input edit
//      closes it;
//   4. Open from the strip = the dialog's Open (same state, results and storage as opening the same project from Saved projects…);
//      the unsaved-changes question is asked the same way;
//   5. no autosave + saved projects: the standard Saved projects dialog opens by itself (no strip);
//   6. "Show this when the app opens" (in the dialog, off by default): key bridgeSuite.v1.projectsUI.spread-footing.startDialog;
//      on -> the dialog at every start instead of the strip; off -> the key is removed;
//   7. suppressed: a memberReactions / foundationLoads hand-off sent in the last 30 min and not pulled; a URL #hash; print emulation
//      (an old unpulled hand-off, 2 h, does not suppress);
//   8. GitHub sync on: a GitHub-only project appears in the strip, marked "GitHub only", after the background listing; its Open
//      downloads it and opens it; with only GitHub projects and no autosave the dialog opens;
//   9. no existing key changed: sfd_auto / sfd_projects are only read at start (byte-identical after load);
//  10. 390 px: the strip wraps, the page does not scroll sideways; 0 console errors in every case.
//  11. HDRS (2026-11-06): header = chip · Undo · Redo · Auto-calc · Re-analyze · Print (no Save / Saved projects…: in the Project tab's
//      card); a chip click opens the Project tab (title block); Ctrl+Shift+S / Ctrl+S work from another input tab.
//   node tests/smoke/start-chooser.mjs [--file <file>] [--shots <dir>]
import fs from 'fs';
import path from 'path';
import { loadPlaywright, chromiumPath, libFor, resolveFile } from '../lib.mjs';
import { makeGitHubMock } from '../engine/gh-mock.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SRC = resolveFile(arg('file', 'Spread Footing.html'), 'Spread Footing.html');
const SHOTS = arg('shots', process.env.SHOTS);
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const TOKEN = 'github_pat_SMOKE0000000000000000wxyz';
const KD = 'bridgeSuite.v1.projectsUI.spread-footing.startDialog', KS = 'bridgeSuite.v1.projectsUI.spread-footing.start';
let failures = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { failures++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };
const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ executablePath: chromiumPath() });
const TYPES = { '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };

// HDRS (2026-11-06): Saved projects… is in the Project tab's "Save and open" card only (no header button in Spread Footing)
const libBtn = p => p.evaluate(() => document.querySelector('[data-sp=card] [data-sp=lib]').click());
async function open({ ls, vw = 1920, vh = 1080, hash = '', gh = null, media = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 2 });
  await ctx.route('**/*', r => {
    const u = r.request().url();
    if (/^(file|data|about|blob):/.test(u)) return r.continue();
    if (gh && u.startsWith('https://api.github.com/')) { const q = r.request(); const res = gh.handle(q.method(), u, q.headers(), q.postData()); return r.fulfill({ status: res.status, headers: res.headers, body: res.body }); }
    const f = libFor(u);
    if (f && fs.existsSync(f)) return r.fulfill({ path: f, contentType: TYPES[path.extname(f)] || 'application/octet-stream', headers: { 'Access-Control-Allow-Origin': '*' } });
    if (/^https?:\/\/fonts\.(googleapis|gstatic)\.com/.test(u)) return r.fulfill({ body: '', contentType: 'text/css' });
    return r.abort();
  });
  const p = await ctx.newPage(), errs = [], dialogs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 300)));
  p.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });
  if (media) await p.emulateMedia({ media });
  if (ls) await p.addInitScript(o => { if (!sessionStorage.getItem('__seeded')) { sessionStorage.setItem('__seeded', '1'); for (const [k, v] of Object.entries(o)) localStorage.setItem(k, v); } }, ls);
  await p.goto('file://' + SRC.file + hash);
  await p.waitForFunction(() => typeof R !== 'undefined' && R && window.SFPL);
  await p.waitForTimeout(700);
  return { ctx, p, errs, dialogs };
}
const view = p => p.evaluate(() => {
  const s = document.querySelector('.spStart[data-sp]'), d = document.getElementById('spLibDlg'), hdr = document.getElementById('sfdHdr'), main = document.querySelector('.main');
  const r = s && s.getBoundingClientRect();
  return { strip: !!s, text: s ? s.innerText.replace(/\s+/g, ' ').trim() : '', btns: s ? [...s.querySelectorAll('[data-st=open],[data-st=ghopen]')].map(b => b.textContent.trim()) : [],
    dlg: !!(d && d.open), anyDlg: !!document.querySelector('dialog[open]'),
    below: !!(r && r.top >= hdr.getBoundingClientRect().bottom - 1 && r.bottom <= main.getBoundingClientRect().top + 1),
    pos: s ? getComputedStyle(s).position : '', sx: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth };
});
const results = p => p.evaluate(() => { const seen = new WeakSet(); return JSON.stringify({ state, R }, (k, v) => typeof v === 'function' ? undefined : (typeof v === 'number' && !isFinite(v) ? String(v) : v && typeof v === 'object' ? (seen.has(v) ? '[cycle]' : (seen.add(v), v)) : v)); });
const lsDump = p => p.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
const close = async o => { ok(o.errs.length === 0, `0 console errors${o.errs.length ? ': ' + o.errs.join(' | ') : ''}`); await o.ctx.close(); };

/* ---- 1. fresh: nothing; then build six projects and an autosave through the tool's own paths ---- */
console.log('1. no projects, no autosave');
let o = await open();
let v = await view(o.p);
ok(!v.strip && !v.anyDlg, 'nothing shown (no strip, no dialog)');
await o.p.evaluate(() => { for (let i = 1; i <= 6; i++) { state.meta.project = 'Footing F' + i; state.geom.B = 8 + i; projSave('Footing F' + i); } });
const base = await lsDump(o.p);
await close(o);
const projects = base.sfd_projects;
const P = JSON.parse(projects);
const autoOf = name => JSON.stringify({ state: P[name], collapseState: {} });
ok(Object.keys(P).length === 6, 'six saved projects built with projSave');

/* ---- 2. autosave (= Footing F3) + projects: the strip; an edit stamps the autosave time for the next start ---- */
console.log('2. autosave + projects: the strip');
o = await open({ ls: { sfd_projects: projects, sfd_auto: autoOf('Footing F3') } });
v = await view(o.p);
ok(v.strip && !v.anyDlg, 'strip shown, no dialog');
ok(v.below && v.pos === 'static', 'strip in the page flow between the header and the panels (not over the page)');
ok(/Continue: Footing F3/.test(v.text) && /autosaved in this browser/.test(v.text), `Continue names the saved project the autosave equals ("${v.text.slice(0, 90)}")`);
ok(v.btns.join() === 'Footing F6,Footing F5,Footing F4,Footing F2,Footing F1', `5 Open buttons, last added first, the Continue project not repeated: ${v.btns.join(', ')}`);
ok(/Footing F3/.test(await o.p.$eval('[data-sp=chip]', e => e.textContent)), 'the header chip shows the open project found by content');
{ const d = await lsDump(o.p), nk = Object.keys(d).filter(k => !(k in base) && !['sfd_auto', 'sfd_projects', '__seeded'].includes(k));
  ok(d.sfd_projects === projects && nk.every(k => k === KS), `sfd_projects unchanged; no new key but ${KS} (${nk.join(', ') || 'none'})`); }
// first input edit (typed) closes the strip; the autosave is rewritten and its time noted
const inp = o.p.locator('#inputPanel input[data-path="meta.number"]');
await inp.fill('J-1001'); await inp.press('Tab');
await o.p.waitForTimeout(300);
ok(!(await view(o.p)).strip, 'the first input edit closes the strip');
await o.p.waitForTimeout(3500);
const st2 = JSON.parse((await lsDump(o.p))[KS] || '{}');
ok(st2.v === 1 && st2.auto && /^\d{4}-/.test(st2.auto.at), 'the autosave time is noted in ' + KS);
const auto2 = (await lsDump(o.p)).sfd_auto;
// open Footing F4, then Footing F1 from the dialog (recent order), then reload: time shown, F1 = Continue, F4 first in the list
await libBtn(o.p);
await o.p.click('#spLibDlg button[data-spa=open][data-n="' + encodeURIComponent('Footing F4') + '"]');
await o.p.waitForTimeout(400);
ok(o.dialogs.some(d => /unsaved changes/.test(d)), 'dialog Open asked about the unsaved changes (edited Footing F3)');
await libBtn(o.p);
await o.p.click('#spLibDlg button[data-spa=open][data-n="' + encodeURIComponent('Footing F1') + '"]');
await o.p.waitForTimeout(400);
await o.p.reload(); await o.p.waitForFunction(() => typeof R !== 'undefined' && R && window.SFPL); await o.p.waitForTimeout(700);
v = await view(o.p);
ok(/Continue: Footing F1/.test(v.text) && /autosaved [A-Z][a-z]{2} \d+, \d{4}, \d+:\d\d [AP]M E[SD]T/.test(v.text), `after reload: "${v.text.slice(0, 110)}"`);
ok(v.btns.join() === 'Footing F4,Footing F6,Footing F5,Footing F3,Footing F2', `most recently opened first (F4 then F1 opened; F1 is Continue): ${v.btns.join(', ')}`);
if (SHOTS) await o.p.screenshot({ path: path.join(SHOTS, 'start-strip-1920.png') });
await close(o);

/* ---- 3. Continue keeps the state; × closes ---- */
console.log('3. Continue / ×');
o = await open({ ls: { sfd_projects: projects, sfd_auto: auto2 } });
const r0 = await results(o.p);
await o.p.click('.spStart [data-st=continue]'); await o.p.waitForTimeout(500);
ok(!(await view(o.p)).strip && (await results(o.p)) === r0, 'Continue closes the strip; inputs and results identical');
ok(/not saved|unsaved/.test(await o.p.$eval('[data-sp=chip]', e => e.textContent)), 'chip: the edited autosave is not a saved project');
await o.p.reload(); await o.p.waitForFunction(() => window.SFPL); await o.p.waitForTimeout(700);
ok((await view(o.p)).strip, 'strip again at the next start');
await o.p.click('.spStart [data-st=close]'); await o.p.waitForTimeout(200);
ok(!(await view(o.p)).strip && !(await view(o.p)).anyDlg, '× closes it');
await close(o);

/* ---- 4. Open from the strip = Open from the dialog ---- */
console.log('4. Open from the strip vs the dialog');
const seedOpen = { sfd_projects: projects, sfd_auto: autoOf('Footing F3') };
o = await open({ ls: seedOpen });
await o.p.click('.spStart [data-st=open][data-n="' + encodeURIComponent('Footing F5') + '"]'); await o.p.waitForTimeout(800);
const ra = await results(o.p), la = await lsDump(o.p), chipA = await o.p.$eval('[data-sp=chip]', e => e.textContent);
ok(!(await view(o.p)).strip, 'Open closes the strip');
await close(o);
o = await open({ ls: seedOpen });
await libBtn(o.p); await o.p.click('#spLibDlg button[data-spa=open][data-n="' + encodeURIComponent('Footing F5') + '"]'); await o.p.waitForTimeout(800);
const rb = await results(o.p), lb = await lsDump(o.p), chipB = await o.p.$eval('[data-sp=chip]', e => e.textContent);
ok(ra === rb && JSON.parse(ra).state.geom.B === 13, 'state and results identical to the dialog\'s Open (Footing F5, B = 13 ft)');
const strip = x => { const y = { ...x }; delete y[KS]; return y; };
ok(JSON.stringify(strip(la)) === JSON.stringify(strip(lb)) && chipA === chipB, 'storage (sfd_auto, sfd_projects, ...) and chip identical');
await close(o);
// unsaved changes: the same question from the strip
o = await open({ ls: seedOpen });
await o.p.evaluate(() => { state.geom.B = 99; });   // a change the tool has not autosaved yet (no input event: the strip stays)
await o.p.click('.spStart [data-st=open][data-n="' + encodeURIComponent('Footing F5') + '"]'); await o.p.waitForTimeout(500);
ok(o.dialogs.some(d => /unsaved changes \(since "Footing F3" was last saved\)\. Open "Footing F5" anyway\?/.test(d)), 'strip Open asks the dialog\'s unsaved-changes question');
await close(o);

/* ---- 5. no autosave + projects: the dialog opens by itself ---- */
console.log('5. no autosave + projects');
o = await open({ ls: { sfd_projects: projects } });
v = await view(o.p);
ok(v.dlg && !v.strip, 'the standard Saved projects dialog opened, no strip');
ok(!(await o.p.$eval('#spLibDlg .spStartChk', e => e.checked)), '"Show this when the app opens" is off by default');
if (SHOTS) await o.p.screenshot({ path: path.join(SHOTS, 'start-dialog-1920.png') });
await close(o);

/* ---- 6. the setting ---- */
console.log('6. "Show this when the app opens"');
o = await open({ ls: { sfd_projects: projects, sfd_auto: autoOf('Footing F3') } });
await libBtn(o.p); await o.p.check('#spLibDlg .spStartChk');
ok((await lsDump(o.p))[KD] === '1', `on: ${KD} = '1'`);
await o.p.reload(); await o.p.waitForFunction(() => window.SFPL); await o.p.waitForTimeout(700);
v = await view(o.p);
ok(v.dlg && !v.strip, 'on: the dialog opens at start (with an autosave), no strip');
ok(await o.p.$eval('#spLibDlg .spStartChk', e => e.checked), 'the box shows on');
await o.p.uncheck('#spLibDlg .spStartChk');
ok(!((KD) in (await lsDump(o.p))), 'off: the key is removed');
await o.p.reload(); await o.p.waitForFunction(() => window.SFPL); await o.p.waitForTimeout(700);
v = await view(o.p);
ok(v.strip && !v.dlg, 'off: the strip again');
await close(o);

/* ---- 7. suppressed ---- */
console.log('7. suppressed');
const now = new Date().toISOString(), old = new Date(Date.now() - 2 * 3600e3).toISOString();
const mr = at => ({ 'bridgeSuite.v1.memberReactions': JSON.stringify({ _schema: 'bridge-member-reactions', schemaVersion: 1, producer: 'Steel Beam Design', producedAt: at, supports: [] }), 'bridgeSuite.v1.memberReactions.updatedAt': at });
for (const [label, ls, hash, media, want] of [
  ['memberReactions hand-off just sent', { sfd_projects: projects, sfd_auto: autoOf('Footing F3'), ...mr(now) }, '', null, false],
  ['foundationLoads hand-off just sent (no autosave)', { sfd_projects: projects, 'bridgeSuite.v1.foundationLoads': '{}', 'bridgeSuite.v1.foundationLoads.updatedAt': now }, '', null, false],
  ['URL #hash', { sfd_projects: projects, sfd_auto: autoOf('Footing F3') }, '#sec-title', null, false],
  ['print emulation', { sfd_projects: projects }, '', 'print', false],
  ['hand-off 2 h old, not pulled: shown', { sfd_projects: projects, sfd_auto: autoOf('Footing F3'), ...mr(old) }, '', null, true],
  ['hand-off just sent but already pulled: shown', { sfd_projects: projects, sfd_auto: autoOf('Footing F3'), ...mr(now), 'bridgeSuite.v1.memberReactions.adopted.spreadFooting': now }, '', null, true]]) {
  o = await open({ ls, hash, media });
  v = await view(o.p);
  ok(want ? v.strip : (!v.strip && !v.anyDlg), `${label}: ${want ? 'strip' : 'nothing'} (why: ${await o.p.evaluate(() => SFPL.pb.start.why())})`);
  await close(o);
}

/* ---- 8. GitHub sync ---- */
console.log('8. GitHub-only projects');
const gh = makeGitHubMock({ token: TOKEN });
gh.files.set('projects/spread-footing/Remote_R1.json', JSON.stringify({ ...P['Footing F2'], meta: { ...P['Footing F2'].meta, project: 'Remote R1' } }, null, 1));
const sync = { 'bridgeSuite.v1.githubSync': JSON.stringify({ owner: 'mlococo88', repo: 'structural-projects', branch: 'main', token: TOKEN, device: 'smoke' }) };
const two = JSON.stringify({ 'Footing F1': P['Footing F1'], 'Footing F2': P['Footing F2'] });
o = await open({ ls: { sfd_projects: two, sfd_auto: autoOf('Footing F1'), ...sync }, gh });
await o.p.waitForTimeout(800);
v = await view(o.p);
ok(v.strip && v.btns.includes('Remote_R1 GitHub only'), `GitHub-only project listed and marked: ${v.btns.join(', ')}`);
await o.p.click('.spStart [data-st=ghopen]'); await o.p.waitForTimeout(1200);
ok(await o.p.evaluate(() => SFPL.store.has('Remote_R1') && state.meta.project === 'Remote R1'), 'its Open downloads it into this browser and opens it');
await close(o);
o = await open({ ls: { ...sync }, gh });
await o.p.waitForTimeout(1000);
v = await view(o.p);
ok(v.dlg && !v.strip, 'only GitHub projects, no autosave: the dialog opens after the listing');
await close(o);

/* ---- 9. 390 px ---- */
console.log('9. 390 px');
o = await open({ ls: { sfd_projects: projects, sfd_auto: autoOf('Footing F3') }, vw: 390, vh: 844 });
v = await view(o.p);
ok(v.strip && v.sx <= 0, `strip shown, no sideways scroll (${v.sx})`);
const wide = await o.p.evaluate(() => [...document.querySelectorAll('.spStart, .spStart *')].filter(e => e.getBoundingClientRect().right > innerWidth + 0.5).length);
ok(wide === 0, 'nothing of the strip beyond the window edge');
if (SHOTS) await o.p.screenshot({ path: path.join(SHOTS, 'start-strip-390.png') });
await close(o);
o = await open({ ls: { sfd_projects: projects }, vw: 390, vh: 844 });
v = await view(o.p);
ok(v.dlg && v.sx <= 0, `dialog at 390 px, no sideways scroll (${v.sx})`);
if (SHOTS) await o.p.screenshot({ path: path.join(SHOTS, 'start-dialog-390.png') });
await close(o);

/* ---- 11. header (HDRS, 2026-11-06; trial in Spread Footing) ---- */
console.log('11. header: chip only, Save in the Project tab');
o = await open({ ls: { sfd_projects: projects, sfd_auto: autoOf('Footing F3') } });
const hdr = await o.p.evaluate(() => [...document.getElementById('sfdHdrA').children].filter(e => !e.hidden).map(e => e.dataset.sp || e.id));
ok(JSON.stringify(hdr) === JSON.stringify(['chip', 'btnUndo', 'btnRedo', 'sfdAcLbl', 'sfdAcBtn', 'btnPrint']), 'header: chip · Undo · Redo · Auto-calc · Re-analyze · Print (' + hdr.join(' · ') + ')');
ok(await o.p.evaluate(() => !document.querySelector('[data-sp=hsave], [data-sp=hlib]') && !!document.querySelector('[data-sp=card] [data-sp=save]') && !!document.querySelector('[data-sp=card] [data-sp=lib]')), 'no header Save / Saved projects…; both in the "Save and open" card');
await o.p.click('.spStart [data-st=close], .spStart [data-st=x]').catch(() => {});
await o.p.evaluate(() => sfdSetInTab('soil', true));
await o.p.click('[data-sp=chip]'); await o.p.waitForTimeout(300);
ok(await o.p.evaluate(() => !document.getElementById('sfdInPane_project').hidden && document.getElementById('sec-title').open && !document.querySelector('dialog[open]')), 'chip click: the Project tab, title block open, no dialog');
ok(/Click: the Project tab/.test(await o.p.$eval('[data-sp=chip]', e => e.title)), 'chip tooltip says where a click goes');
await o.p.evaluate(() => sfdSetInTab('geom', true));
await o.p.keyboard.press('Control+Shift+s'); await o.p.waitForTimeout(200);
ok(await o.p.evaluate(() => !!document.querySelector('dialog.spSave[open]')), 'Ctrl+Shift+S from the Geometry tab opens Save as');
await o.p.fill('dialog.spSave .spName', 'Footing H1'); await o.p.evaluate(() => document.querySelector('dialog.spSave [data-sa=ok]').click()); await o.p.waitForTimeout(300);
ok(await o.p.evaluate(() => SFPL.store.has('Footing H1') && SFPL.pb.current() === 'Footing H1'), 'saved as "Footing H1"');
await o.p.evaluate(() => { const i = document.querySelector('#sfdInPane_geom input[type=number][data-path]'); i.value = String((Number(i.value) || 0) + 0.5); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
await o.p.waitForTimeout(500);
ok(/unsaved changes/.test(await o.p.$eval('[data-sp=chip]', e => e.textContent)), 'an edit: chip "unsaved changes"');
const nd = o.dialogs.length; await o.p.keyboard.press('Control+s'); await o.p.waitForTimeout(400);
ok(/· saved/.test(await o.p.$eval('[data-sp=chip]', e => e.textContent)) && o.dialogs.length === nd && !(await o.p.evaluate(() => !!document.querySelector('dialog[open]'))), 'Ctrl+S from the Geometry tab saves to the open name (no question)');
if (SHOTS) await o.p.screenshot({ path: path.join(SHOTS, 'header-1920.png') });
ok(o.errs.length === 0, 'no console errors: ' + o.errs.join(' | '));
await close(o);

await browser.close();
console.log(failures ? `${failures} of ${n} checks FAILED` : `all ${n} checks pass`);
process.exit(failures ? 1 : 0);
