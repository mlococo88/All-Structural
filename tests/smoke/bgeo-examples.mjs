#!/usr/bin/env node
// Bridge Geometry example bridges and the standard save (STDS, 2026-11-06; engineer decision: stop seeding the five example bridges into
// the saved list, open them from "Load example…", and do not upload untouched examples; never delete examples a user already has).
//   1. fresh browser: nothing is seeded (no library entry, no examplesSeeded flag); "Load example…" lists the 5 examples and opens one as
//      a new, unsaved bridge (the library is not changed); no console errors;
//   2. a browser with the 5 seeded examples (as older versions left them) + one own bridge, GitHub sync on (in-memory GitHub,
//      tests/engine/gh-mock.mjs): the examples stay in the list; untouched they are held ("this browser only"): Upload all uploads the
//      own bridge only; an example opened, changed and saved uploads; Upload in the dialog uploads an untouched one (the user's choice) and
//      it is not held again; a renamed untouched example stays held;
//   3. a saved name with HTML (<b>…</b>) is shown as text in the dialog.
//   node tests/smoke/bgeo-examples.mjs
import path from 'path';
import { openPage, REPO } from '../lib.mjs';
import { makeGitHubMock } from '../engine/gh-mock.mjs';
const FILE = path.join(REPO, 'Bridge Geometry.html'), LIB = 'bridgeGeomEngine.library.v1', FLAG = 'bridgeGeomEngine.examplesSeeded.v1';
let failed = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) failed++; };
const ready = p => p.waitForFunction(() => typeof ENG !== 'undefined' && ENG && window.BGPB);
const noise = e => /Failed to load resource/.test(e);   // map tiles (no network in the test kit)

// 1. fresh
{ const s = await openPage(FILE, { vw: 1280, vh: 900 }); await ready(s.p); await s.p.waitForTimeout(800);
  const r = await s.p.evaluate(([L, F]) => ({ lib: localStorage.getItem(L), flag: localStorage.getItem(F), opts: [...document.querySelectorAll('#bg_example option')].map(o => o.textContent) }), [LIB, FLAG]);
  ok(!r.lib || r.lib === '{}', 'fresh: no example seeded into the saved list (' + (r.lib || 'no key') + ')');
  ok(r.flag == null, 'fresh: the examplesSeeded flag is not written');
  ok(r.opts.length === 6 && /^Load example/.test(r.opts[0]) && /Example 2/.test(r.opts[2]), 'Load example… lists the 5 examples: ' + r.opts.slice(1).join(' | '));
  await s.p.evaluate(() => { const sel = document.getElementById('bg_example'); sel.value = '1'; sel.dispatchEvent(new Event('change')); }); await s.p.waitForTimeout(800);
  const a = await s.p.evaluate(L => ({ n: UNITS.length, cur: CURRENT_NAME, chip: SharedProjectsUI.bars[0].el.chip.innerText.replace(/\s+/g, ' '), lib: localStorage.getItem(L), st: document.getElementById('save_status').textContent }), LIB);
  ok(a.n === 4 && a.cur === null && /not saved/.test(a.chip) && (!a.lib || a.lib === '{}'), `Example 2 opened as a new, unsaved bridge (4 supports; chip "${a.chip}"; status "${a.st}"; library unchanged)`);
  ok(!s.errs.filter(e => !noise(e)).length, 'fresh: no console errors ' + s.errs.filter(e => !noise(e)).join(' | '));
  await s.b.close(); }

// 2. seeded examples + sync
const TOKEN = 'github_pat_SMOKE0000000000000000wxyz', gh = makeGitHubMock({ token: TOKEN });
const SET = JSON.stringify({ owner: 'mlococo88', repo: 'structural-projects', branch: 'main', token: TOKEN, device: 'Smoke' });
let seeded;
{ const s = await openPage(FILE, { vw: 1280, vh: 900 }); await ready(s.p);
  seeded = await s.p.evaluate(() => { const lib = {}; EXAMPLE_BRIDGES.forEach(p => { lib[p.name] = JSON.parse(JSON.stringify(p)); }); return lib; });
  await s.b.close(); }
const mine = Object.assign(JSON.parse(JSON.stringify(seeded['Example 1 — Single-Span Tangent'])), { name: 'Mine', GIRDERS: [-12, 0, 12] });
const lib0 = Object.assign({}, seeded, { Mine: mine, 'HTML <b>bold</b>': mine });
const s = await openPage(FILE, { vw: 1280, vh: 900, ls: { [LIB]: JSON.stringify(lib0), [FLAG]: '1', 'bridgeSuite.v1.githubSync': SET } });
await s.p.route('https://api.github.com/**', async r => { const q = r.request(); const res = gh.handle(q.method(), q.url(), await q.allHeaders(), q.postData()); return r.fulfill({ status: res.status, headers: res.headers, body: res.body }); });
const p = s.p; await ready(p); await p.waitForTimeout(1500);
const E = n => p.evaluate(n => { const e = BGPB.dialog.cloud.engine; return { held: e.held(n), st: e.statusOf(n) }; }, n);
const names = Object.keys(seeded);
const held0 = await Promise.all(names.map(E));
ok(held0.every(x => x.held), 'untouched examples held in this browser: ' + held0.map(x => x.st).join(', '));
ok(Object.keys(JSON.parse(await p.evaluate(L => localStorage.getItem(L), LIB))).length === 7, 'the 5 examples and the own bridges stay in the saved list');
await p.evaluate(() => BGPB.dialog.cloud.engine.uploadAll()); await p.waitForTimeout(2500);
const files = () => [...gh.files.keys()].filter(k => k.startsWith('projects/bridge-geometry/')).sort();
const onGh = n => files().some(k => decodeURIComponent(k) === `projects/bridge-geometry/${n}.json`);
ok(onGh('Mine') && !names.some(n => onGh(n)), 'Upload all: own bridges uploaded, untouched examples not: ' + files().join(', '));
// the dialog: names as text
await p.evaluate(() => BGPB.dialog.show()); await p.waitForTimeout(1500);
const dl = await p.evaluate(() => { const d = document.querySelector('dialog.spLib[open]'); return { bold: d.querySelectorAll('tbody td b').length ? [...d.querySelectorAll('tbody td b')].map(b => b.textContent) : [], txt: [...d.querySelectorAll('tbody tr')].map(tr => tr.querySelector('td').textContent.trim()) }; });
ok(dl.txt.some(t => t === 'HTML <b>bold</b>') && !dl.bold.includes('bold'), 'a saved name with HTML is shown as text: ' + dl.txt.filter(t => /HTML/.test(t)).join(''));
await s.p.screenshot({ path: path.join(process.env.SHOTS || '/tmp', 'bgeo-examples-dialog.png') }).catch(() => {});
// Upload (the user's choice) of an untouched example: uploaded, not held again
const ex3 = names[2];
await p.evaluate(n => document.querySelector(`dialog.spLib[open] [data-ghx=up][data-n="${encodeURIComponent(n)}"]`) ? document.querySelector(`dialog.spLib[open] [data-ghx=up][data-n="${encodeURIComponent(n)}"]`).click() : BGPB.dialog.cloud.engine.upload(n), ex3); await p.waitForTimeout(4500);
ok(onGh(ex3) && !(await E(ex3)).held, 'Upload of an untouched example (the user\'s choice): uploaded and not held again');
await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach(d => d.close()));
// rename an untouched example: still held
const ex4 = names[3];
p.removeAllListeners('dialog'); p.on('dialog', d => d.type() === 'prompt' ? d.accept('Renamed example') : d.dismiss());
await p.evaluate(() => BGPB.dialog.show()); await p.waitForTimeout(500);
await p.evaluate(n => document.querySelector(`dialog.spLib[open] [data-spa=rename][data-n="${encodeURIComponent(n)}"]`).click(), ex4); await p.waitForTimeout(4000);
ok((await E('Renamed example')).held && !onGh('Renamed example'), 'a renamed untouched example stays held (not uploaded)');
await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach(d => d.close()));
p.removeAllListeners('dialog'); p.on('dialog', d => d.accept());
// open an example, change it, Save: uploaded
const ex2 = names[1];
await p.evaluate(n => { BGPB.dialog.show(); document.querySelector(`dialog.spLib[open] [data-spa=open][data-n="${encodeURIComponent(n)}"]`).click(); }, ex2); await p.waitForTimeout(1200);
await p.evaluate(() => { const i = document.querySelector('#spantbl input[data-f="edgeL"]'); i.value = String((Number(i.value) || 0) + 2); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(900);
await p.evaluate(() => BGPB.save()); await p.waitForTimeout(5000);
ok(onGh(ex2) && !(await E(ex2)).held, 'an example opened, changed and saved: uploaded (' + (await E(ex2)).st + ')');
const others = [names[0], names[4]].map(n => onGh(n));
ok(others.every(x => !x), 'the other untouched examples are still not uploaded');
ok(!s.errs.filter(e => !noise(e)).length, 'no console errors ' + s.errs.filter(e => !noise(e)).join(' | '));
await s.b.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASS'); process.exit(failed ? 1 : 0);
