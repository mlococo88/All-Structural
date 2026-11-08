#!/usr/bin/env node
// LIVE (2026-11-08): auto-save of the open project, the open project's GitHub check and (LIVE PR 3) presence, with TWO devices:
// two browsers (separate storage, separate device ids) open Spread Footing against one in-memory GitHub (tests/engine/gh-mock.mjs,
// api.github.com routed by Playwright; nothing reaches the network). The LIVE timings are shortened in the pages (SharedGitHubSync.LIVE)
// so the run takes about two minutes instead of ten.
// Steps:
//   0. sync off: a page with no settings makes no request to api.github.com while inputs change;
//   1. device A saves "Pier 1", B opens it from GitHub; A edits: auto-saved and uploaded (the chip says "auto-saved"); an unchanged
//      input text is not uploaded again;
//   2. B gets "Updated on Laptop" without its inputs changing; Load it shows A's inputs; Undo brings B's back;
//   3. A and B edit at the same time: a conflict copy, nothing lost (both versions on GitHub);
//   4. (presence, when the page has it) A sees "Also open on Desktop" while B has it open, and it goes when B closes it; opening a
//      project that another device has open warns first (Open anyway / Cancel);
//   5. a hidden tab makes no request; it checks again when shown.
//   node tests/smoke/github-sync-live.mjs [--shots <dir>]
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';
import { makeGitHubMock } from '../engine/gh-mock.mjs';
import { stdSave } from './project-library.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SHOTS = arg('shots', process.env.SHOTS); if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const TOKEN = 'github_pat_LIVE00000000000000000wxyz', FILE = path.join(REPO, 'Spread Footing.html'), FOLDER = 'spread-footing';
const P = n => `projects/${FOLDER}/${n.replace(/[^A-Za-z0-9 _\-.(),+&'!~=@]/g, c => encodeURIComponent(c))}.json`;
const until = async (f, ms = 30000, what = '') => { const t0 = Date.now(); for (;;) { const v = await f(); if (v) return v; if (Date.now() - t0 > ms) throw new Error('timeout: ' + what); await new Promise(r => setTimeout(r, 250)); } };
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const shot = async (p, f) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, f) }); };

const gh = makeGitHubMock({ token: TOKEN });
const settings = dev => ({ 'bridgeSuite.v1.githubSync': JSON.stringify({ owner: 'mlococo88', repo: 'structural-projects', branch: 'main', token: TOKEN, device: dev }) });
async function open(dev, { sync = true } = {}) {
  const o = await openPage(FILE, { ls: sync ? settings(dev) : undefined });
  const log = [];
  await o.p.route('https://api.github.com/**', async route => {
    const r = route.request(); log.push({ m: r.method(), u: r.url(), t: Date.now() });
    if (gh.offline) return route.abort('internetdisconnected');
    const res = gh.handle(r.method(), r.url(), await r.allHeaders(), r.postData());
    return route.fulfill({ status: res.status, headers: res.headers, body: res.body });
  });
  await o.p.waitForFunction(() => typeof R !== 'undefined' && R && window.SharedProjectsUI && SharedProjectsUI.bars.length);
  await o.p.evaluate(() => { const L = window.SharedGitHubSync && SharedGitHubSync.LIVE; if (L) Object.assign(L, { every: 4000, quiet: 1000, poll: 4000, beat: 5000, stale: 15000 }); });
  return Object.assign(o, { log, dev });
}
const bump = (p, d) => p.evaluate(d => { const i = document.querySelector('#inputPanel input[type=number][data-path]'); i.value = String(Math.round(((Number(i.value) || 0) + d) * 100) / 100); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); return { path: i.dataset.path, v: i.value }; }, d);
const val = p => p.evaluate(() => document.querySelector('#inputPanel input[type=number][data-path]').value);
const chip = p => p.evaluate(() => (document.querySelector('[data-sp=chip]') || {}).textContent || '');
const banner = (p, k) => p.evaluate(k => { const b = document.querySelector(`.spLive [data-lv=${k}]`); return b ? b.textContent : null; }, k);
const click = (p, a) => p.evaluate(a => { const b = document.querySelector(`.spLive [data-lva=${a}]`); if (b) b.click(); return !!b; }, a);
const fileVal = (name, p0) => { const t = gh.files.get(P(name)); if (!t) return null; const j = JSON.parse(t); return p0.split('.').reduce((o, k) => o == null ? o : o[k], j); };
const hasPresence = p => p.evaluate(() => !!(window.SharedGitHubSync && SharedGitHubSync.engine && SharedProjectsUI.bars[0].live && SharedProjectsUI.bars[0].live.presence));

/* 0. sync off */
{
  const o = await open('Off', { sync: false });
  await bump(o.p, 0.5); await o.p.waitForTimeout(7000); await bump(o.p, 0.5); await o.p.waitForTimeout(5000);
  assert.equal(o.log.length, 0, 'requests with sync off');
  const keys = await o.p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('bridgeSuite.v1.githubSync')));
  assert.deepEqual(keys, []); ok('sync off: no request to api.github.com and no sync key while inputs change (12 s)');
  assert.equal(await o.p.evaluate(() => !!document.querySelector('.spLive')), false); await o.b.close();
}

const A = await open('Laptop'), B = await open('Desktop');
/* 1. auto-save */
await stdSave(A.p, 'Pier 1');
await until(() => gh.files.has(P('Pier 1')), 20000, 'A first upload');
const inPath = (await A.p.evaluate(() => document.querySelector('#inputPanel input[type=number][data-path]').dataset.path));
await B.p.evaluate(() => SharedProjectsUI.bars[0].dialog.show());
await until(() => B.p.evaluate(() => !!document.querySelector('dialog.spLib[open] [data-ghx=open][data-n="Pier%201"]')), 20000, 'B lists Pier 1 on GitHub');
await B.p.evaluate(() => document.querySelector('dialog.spLib[open] [data-ghx=open][data-n="Pier%201"]').click());
await until(async () => (await B.p.evaluate(() => SharedProjectsUI.bars[0].current())) === 'Pier 1', 20000, 'B opened Pier 1');
ok('device B opened "Pier 1" from GitHub');
const v0 = await val(A.p);
const putsA = () => A.log.filter(l => l.m === 'PUT' && l.u.includes('Pier%201.json')).length;
const p0 = putsA();
const e1 = await bump(A.p, 1);
await until(() => String(fileVal('Pier 1', inPath)) === String(Number(e1.v)) || fileVal('Pier 1', inPath) === e1.v, 30000, 'auto-save uploaded A edit');
assert.equal(putsA(), p0 + 1);
assert.match(await chip(A.p), /auto-saved \d\d:\d\d|uploading/); await until(async () => /auto-saved \d\d:\d\d/.test(await chip(A.p)), 10000, 'chip auto-saved');
ok(`auto-save: A's edit (${inPath} ${v0} -> ${e1.v}) saved into "Pier 1" and uploaded once; chip: "${(await chip(A.p)).replace(/\s+/g, ' ').trim()}"`);
await shot(A.p, 'A-chip-autosaved.png');
await A.p.waitForTimeout(9000); assert.equal(putsA(), p0 + 1); ok('no further upload while nothing changes (9 s)');
assert.match(gh.commits.filter(c => c.path === P('Pier 1')).at(-1).message, /\(from Laptop\)$/);

/* 2. B: Updated on Laptop -> Load it -> Undo */
const bBefore = await val(B.p);
await until(() => banner(B.p, 'upd'), 20000, 'B update banner');
const ub = await banner(B.p, 'upd'); assert.match(ub, /Updated on Laptop at \d\d:\d\d/); assert.equal(await val(B.p), bBefore, 'B inputs unchanged before Load it');
ok(`device B: "${ub.replace(/\s+/g, ' ').slice(0, 90)}…"; its inputs are not changed`);
await shot(B.p, 'B-updated-banner.png');
await click(B.p, 'load');
await until(async () => (await val(B.p)) === e1.v, 15000, 'B shows A value');
await until(() => banner(B.p, 'undo'), 5000, 'undo banner'); await shot(B.p, 'B-loaded-undo.png');
ok(`Load it: B shows A's ${inPath} = ${e1.v}; banner "${(await banner(B.p, 'undo')).replace(/\s+/g, ' ').trim()}"`);
await click(B.p, 'undo');
await until(async () => (await val(B.p)) === bBefore, 10000, 'B undo');
assert.equal(String(fileVal('Pier 1', inPath)), String(Number(e1.v)), 'GitHub unchanged by Undo');
ok(`Undo: B shows its previous ${inPath} = ${bBefore} again; GitHub's file still has ${e1.v}`);
await B.p.waitForTimeout(6000); assert.equal(await banner(B.p, 'upd'), null, 'not offered again for the same GitHub version'); ok('the banner is not offered again for the same GitHub version');
// B now takes GitHub's version for the next step
await B.p.evaluate(() => SharedProjectsUI.bars[0].dialog.cloud.engine.useCloud('Pier 1')); await B.p.evaluate(() => SharedProjectsUI.bars[0].dialog.show());
await B.p.evaluate(() => { const b = document.querySelector('dialog.spLib[open] [data-spa=open][data-n="Pier%201"]'); if (b) b.click(); });
await until(async () => (await val(B.p)) === e1.v, 15000, 'B reopened');
await B.p.evaluate(() => { const d = document.querySelector('dialog.spLib[open]'); if (d) d.close(); });

/* 3. simultaneous edits */
const before = new Set(gh.files.keys());
const ea = await bump(A.p, 10), eb = await bump(B.p, 20);
await until(() => [...gh.files.keys()].some(k => k.startsWith(`projects/${FOLDER}/Pier 1 (conflict`)), 40000, 'conflict copy');
await A.p.waitForTimeout(6000);
const vals = [...gh.files.entries()].filter(([k]) => k.startsWith(`projects/${FOLDER}/Pier 1`) && !k.includes('.presence')).map(([k, t]) => [k.split('/').pop(), String(inPath.split('.').reduce((o, x) => o == null ? o : o[x], JSON.parse(t)))]);
for (const v of [ea.v, eb.v]) assert.ok(vals.some(x => Number(x[1]) === Number(v)), `${v} kept on GitHub: ${JSON.stringify(vals)}`);
ok(`simultaneous edits (A ${ea.v}, B ${eb.v}): both kept on GitHub ${JSON.stringify(vals)}; nothing overwritten`);
void before;

/* 4. presence (LIVE PR 3) */
if (await hasPresence(A.p)) {
  await until(() => banner(A.p, 'pres'), 30000, 'A sees B');
  assert.match(await banner(A.p, 'pres'), /Also open on Desktop/); await shot(A.p, 'A-also-open.png');
  ok(`presence: A shows "${(await banner(A.p, 'pres')).replace(/\s+/g, ' ').trim()}"`);
  const pres = [...gh.files.keys()].filter(k => k.includes('/.presence/')); assert.ok(pres.length >= 2, pres.join());
  const f = JSON.parse(gh.files.get(pres[0])); assert.deepEqual(Object.keys(f), ['v', 'app', 'tool', 'project', 'device', 'id', 'since', 'at']);
  ok(`heartbeat files: ${pres.map(x => x.split('/').pop()).join(', ')}`);
  // A's dialog does not list them
  await A.p.evaluate(() => SharedProjectsUI.bars[0].dialog.show()); await A.p.waitForTimeout(1500);
  assert.equal(await A.p.evaluate(() => /presence/.test(document.querySelector('dialog.spLib[open]').textContent)), false); ok('Saved projects lists no presence file');
  await A.p.evaluate(() => document.querySelector('dialog.spLib[open]').close());
  // B saves another project; A opens Pier 2 while B has it open -> warning
  await stdSave(B.p, 'Pier 2'); await until(() => gh.files.has(P('Pier 2')), 20000, 'Pier 2 up');
  await until(() => [...gh.files.keys()].some(k => k.includes('/.presence/Pier 2.')), 20000, 'B heartbeat Pier 2');
  await until(async () => !(await banner(A.p, 'pres')), 30000, 'A banner gone after B left Pier 1');
  ok('the "Also open" banner goes when B opens another project (B\'s heartbeat of Pier 1 deleted)');
  await A.p.evaluate(() => SharedProjectsUI.bars[0].dialog.show());
  await until(() => A.p.evaluate(() => !!document.querySelector('dialog.spLib[open] [data-ghx=open][data-n="Pier%202"]')), 20000, 'A lists Pier 2');
  await A.p.evaluate(() => document.querySelector('dialog.spLib[open] [data-ghx=open][data-n="Pier%202"]').click());
  await until(() => A.p.evaluate(() => !!document.querySelector('dialog[data-sp=presence][open]')), 20000, 'presence warning');
  const w = await A.p.evaluate(() => document.querySelector('dialog[data-sp=presence][open]').textContent);
  assert.match(w, /Open on Desktop since \d\d:\d\d/); assert.match(w, /edits on both may conflict/); await shot(A.p, 'A-open-warning.png');
  assert.equal(await A.p.evaluate(() => SharedProjectsUI.bars[0].current()), 'Pier 1');
  await A.p.evaluate(() => document.querySelector('dialog[data-sp=presence][open] [data-pw=cancel]').click());
  await A.p.waitForTimeout(500); assert.equal(await A.p.evaluate(() => SharedProjectsUI.bars[0].current()), 'Pier 1');
  ok(`opening "Pier 2" warns first ("${w.replace(/\s+/g, ' ').trim().slice(0, 80)}…"); Cancel keeps "Pier 1" open`);
  await A.p.evaluate(() => { SharedProjectsUI.bars[0].dialog.show(); });
  await A.p.evaluate(() => document.querySelector('dialog.spLib[open] [data-spa=open][data-n="Pier%202"]').click());
  await until(() => A.p.evaluate(() => !!document.querySelector('dialog[data-sp=presence][open]')), 20000, 'presence warning 2');
  await A.p.evaluate(() => document.querySelector('dialog[data-sp=presence][open] [data-pw=open]').click());
  await until(async () => (await A.p.evaluate(() => SharedProjectsUI.bars[0].current())) === 'Pier 2', 10000, 'A opened Pier 2');
  await until(() => banner(A.p, 'pres'), 30000, 'A sees B on Pier 2'); ok('Open anyway opens it; the banner "Also open on Desktop" is shown');
  // B closes the page: its heartbeat is deleted, A's banner goes
  await B.p.close({ runBeforeUnload: true }); await new Promise(r => setTimeout(r, 1500));
  assert.ok(![...gh.files.keys()].some(k => k.includes('/.presence/Pier 2.') && JSON.parse(gh.files.get(k)).device === 'Desktop'), 'B heartbeat deleted on close');
  await until(async () => !(await banner(A.p, 'pres')), 30000, 'A banner gone'); ok('B closed: its heartbeat file is deleted and A\'s banner goes');
} else console.log('  --   presence: not in this page (LIVE PR 3)');

/* 5. hidden tab pauses */
const hide = (p, h) => p.evaluate(h => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => h ? 'hidden' : 'visible' }); Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); document.dispatchEvent(new Event('visibilitychange')); }, h);
await A.p.waitForTimeout(3000); await hide(A.p, true); await A.p.waitForTimeout(1000);
const h0 = A.log.length; await A.p.waitForTimeout(14000);
assert.equal(A.log.length, h0, 'requests while hidden: ' + JSON.stringify(A.log.slice(h0).map(l => l.m + ' ' + l.u.slice(60))));
ok('hidden tab: no request for 14 s (no check, no heartbeat)');
await hide(A.p, false); await until(() => A.log.length > h0, 10000, 'poll resumes'); ok('shown again: it checks GitHub again at once');

for (const o of [A, B]) assert.deepEqual(o.errs.filter(e => !/internet|ERR_/.test(e)), [], o.dev + ' console errors');
for (const l of gh.log) { assert.ok(!l.url.includes(TOKEN)); if (l.body) assert.ok(!l.body.includes(TOKEN)); }
for (const t of gh.files.values()) assert.ok(!t.includes(TOKEN));
ok('no console errors; the token only in the Authorization header');
await A.b.close(); await B.b.close().catch(() => {});
console.log(`\nALL PASS (${n} checks)`);
