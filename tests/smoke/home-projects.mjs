#!/usr/bin/env node
// Home page "Saved projects" panel (tools.html, HSP, 2026-11-05), headless Chromium, file://, one browser profile (as on the work
// laptop, every file:// page shares one storage origin):
//   1. each tool of shared/project-registry.js saves two projects through its OWN Save path (tests/smoke/project-library.mjs TOOLS);
//      its own Saved projects dialog is read (names, "Last saved" column);
//   2. tools.html#projects lists, for every tool, the same names in the same order with the same saved times (the registry's key /
//      time / sort agree with the tool's own mapStore);
//   3. the home page writes nothing (localStorage byte-identical before / after load, search, filter, refresh) and makes no network
//      request; names are shown as text (a name holding HTML is not markup); an unreadable list is reported and left as it is;
//   4. search and the app filter; at 390 px the page does not scroll sideways; no console errors.
//   node tests/smoke/home-projects.mjs [--tool asce7,spreadfooting,...] [--shots <dir>]
import path from 'path';
import { openPage, REPO } from '../lib.mjs';
import { TOOLS } from './project-library.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SHOTS = arg('shots', process.env.SHOTS);
// project-library key -> the registry entry (ctx.cloud.tool)
export const FOLDER = { mlg: 'moving-load-generator', bsl: 'bridge-substructure-loading', asce7: 'asce7-load-generator', smd: 'shear-moment-diagrams',
  stonearch: 'stone-arch-rating', gusset: 'gusset-plate-rating', retwall: 'retaining-wall-designer', spreadfooting: 'spread-footing',
  lightpole: 'light-pole-sign-post', baseplate: 'base-plate-anchor', steelbeam: 'steel-beam-aisc', timber: 'timber-beam-check',
  spc: 'section-property-calculator', rebar: 'aci-rebar-development', abutment: 'abutment-calculator', edm: 'elastomeric-bearing', bgeo: 'bridge-geometry' };
// own list panels: every row of the list (project-library's ui.rows may pick one row) and the name cell
export const OWN_ROWS = { bgeo: '#lib_list tbody tr' };
const list = arg('tool', Object.keys(FOLDER).join(',')).split(',');
let failed = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) failed++; return c; };
export const NAMES = ['HSP A', 'HSP <b>bold</b> & "q" ü'];

// toolPage(ctx, key): the tool opened in a new tab of the same profile; frame tools get the frame (page methods passed through)
export async function toolPage(ctx, key, errs) {
  const T = TOOLS[key], page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errs.push(`${key}: ${m.text().slice(0, 300)}`); });
  page.on('pageerror', e => errs.push(`${key}: pageerror ${e.message.slice(0, 300)}`));
  page.on('dialog', d => d.accept());
  await page.goto('file://' + path.join(REPO, T.file) + (T.hash || ''));
  let p = page;
  if (T.frame) { await page.waitForSelector(T.frame, { state: 'attached' }); const fr = await (await page.$(T.frame)).contentFrame();
    const via = (o, k) => typeof o[k] === 'function' ? o[k].bind(o) : o[k]; p = new Proxy(fr, { get: (t, k) => k in t ? via(t, k) : via(page, k) }); }
  await T.ready(p); await p.waitForTimeout(700);
  return { page, p, T };
}
// dialogRows(p, T): the tool's Saved projects dialog: [{ name, saved }] (saved: the "Last saved" cell, '' when none). A tool with its
// own Projects dialog (T.ui, project-library.mjs): names in its order; saved = null (its own date format is not compared).
export async function dialogRows(p, T) {
  if (T && T.ui) { await T.ui.open(p); await p.waitForTimeout(300);
    return p.evaluate(sel => { const r = [...document.querySelectorAll(sel)].map(row => { const c = (row.querySelector('.pname') || row.querySelector('td')).cloneNode(true); c.querySelectorAll('span,[data-sp]').forEach(s => s.remove()); const dt = row.querySelector('.pdate') || row.querySelectorAll('td')[1]; const ld = row.querySelector('[data-lib-load]'); return { name: ld ? decodeURIComponent(ld.dataset.libLoad) : c.textContent.trim(), saved: null, own: dt && dt.textContent.trim() ? 'time' : '' }; });
      document.querySelectorAll('dialog[open]').forEach(d => d.close()); return r; }, OWN_ROWS[T.key] || T.ui.rows); }
  await p.evaluate(() => { [...document.querySelectorAll('button[data-sp]')].find(b => /^(Saved projects|Projects|Saved analyses)…$/.test(b.textContent)).click(); });
  await p.waitForTimeout(400);
  return p.evaluate(() => { const d = document.querySelector('dialog.spLib[open]'); const hasT = [...d.querySelectorAll('thead th')].some(t => /Last saved/.test(t.textContent));
    const rows = [...d.querySelectorAll('.spBody > .spScroll tbody tr')].map(tr => { const td = tr.querySelectorAll('td'); const c = td[0].cloneNode(true); c.querySelectorAll('span').forEach(s => s.remove());
      return { name: c.textContent.trim(), saved: hasT ? td[1].textContent.replace('—', '').trim() : '' }; });
    d.close(); return rows; });
}
const homeRows = p => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#spOut .spG[data-tool]')].map(g => [g.dataset.tool,
  [...g.querySelectorAll('li')].map(li => ({ name: li.querySelector('a').textContent, saved: (li.querySelector('.spD') || { textContent: '' }).textContent.replace(/^saved /, '') }))])));
const snap = p => p.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));

// Imported for FOLDER / toolPage / dialogRows (tests/smoke/home-sync.mjs): the run below happens only when this file is the script run.
if (/home-projects\.mjs$/.test(process.argv[1] || '')) await main();
async function main() {
const { b, ctx, p: home, errs } = await openPage(path.join(REPO, 'tools.html'), { vw: 1280, vh: 900 });
const reqs = []; home.on('request', r => { if (!/^(file|data|about|blob):/.test(r.url())) reqs.push(r.url().slice(0, 120)); });
const expect = {};
for (const key of list) {
  const terrs = [];
  try {
    const { page, p, T } = await toolPage(ctx, key, terrs);
    for (const n of NAMES) await T.save(p, n);
    expect[FOLDER[key]] = await dialogRows(p, { ...T, key });
    await page.close();
  } catch (e) { ok(false, `${key}: ${String(e.message || e).slice(0, 300)}`); }
  ok(expect[FOLDER[key]] && expect[FOLDER[key]].length >= 2, `${key}: two projects saved through the tool's own Save (its dialog lists ${expect[FOLDER[key]] ? expect[FOLDER[key]].map(r => r.name).join(' | ') : '-'})`);
}
await home.evaluate(() => { location.hash = '#projects'; location.reload(); });
await home.waitForTimeout(800);
const before = await snap(home);
ok(await home.evaluate(() => document.getElementById('projects').open), '#projects opens the panel');
const got = await homeRows(home);
for (const key of list) {
  const t = FOLDER[key], e = expect[t] || [], g0 = got[t] || [];
  const own = e.length && e[0].saved === null, srt = a => own ? a.slice().sort((x, y) => x.name < y.name ? -1 : 1) : a;
  const g = own ? g0.map(r => ({ name: r.name, saved: null, own: r.saved ? 'time' : '' })) : g0;   // own dialog / panel: the same names, a time shown
  e.splice(0, e.length, ...srt(e)); g.splice(0, g.length, ...srt(g));
  ok(JSON.stringify(e) === JSON.stringify(g), `${key}: home page lists the same names, order and saved times as the tool's dialog` + (JSON.stringify(e) === JSON.stringify(g) ? '' : `\n         tool: ${JSON.stringify(e)}\n         home: ${JSON.stringify(g)}`));
}
ok(await home.evaluate(() => !document.querySelector('#spOut b') && [...document.querySelectorAll('#spOut li a')].some(a => a.textContent.includes('<b>bold</b>'))), 'a name holding HTML is shown as text');
const hrefs = await home.evaluate(() => Object.fromEntries([...document.querySelectorAll('#spOut .spG')].map(g => [g.dataset.tool, [g.querySelector('h3 a').getAttribute('href'), ...[...g.querySelectorAll('li a')].map(a => a.getAttribute('href') + '|' + a.target)]])));
if (hrefs['spread-footing']) ok(hrefs['spread-footing'][0] === 'Spread%20Footing.html' && hrefs['spread-footing'].slice(1).every(h => h === 'Spread%20Footing.html|_blank'), 'a project opens its app in a new tab (Spread Footing.html)');
if (hrefs['aci-rebar-development']) ok(hrefs['aci-rebar-development'][0] === 'Concrete%20Beam%20Capacity.html#dev', 'the rebar projects open the Development & Splice tab of Concrete Beam Capacity');
// search and app filter
await home.fill('#spq', 'hsp a'); await home.waitForTimeout(150);
let r = await homeRows(home); ok(Object.values(r).every(a => a.length === 1 && a[0].name === 'HSP A') && Object.keys(r).length === list.length, 'search "hsp a" -> one project per app');
await home.fill('#spq', ''); await home.selectOption('#spApp', FOLDER[list[0]]); await home.waitForTimeout(150);
r = await homeRows(home); ok(Object.keys(r).join() === FOLDER[list[0]], 'app filter -> that app only');
await home.selectOption('#spApp', ''); await home.click('#spReload'); await home.waitForTimeout(150);
const sumText = await home.textContent('#spSum'); ok(new RegExp(`\\(${list.reduce((a, k) => a + (expect[FOLDER[k]] || []).length, 0)} in this browser, ${list.length} apps?\\)`).test(sumText), 'summary: ' + sumText);
if (SHOTS) await home.screenshot({ path: path.join(SHOTS, 'home-projects-1280.png'), fullPage: false });
await home.setViewportSize({ width: 390, height: 800 }); await home.waitForTimeout(300);
ok(await home.evaluate(() => document.documentElement.scrollWidth <= 390), '390 px: no sideways scroll (' + await home.evaluate(() => document.documentElement.scrollWidth) + ')');
if (SHOTS) { await home.evaluate(() => document.getElementById('projects').scrollIntoView()); await home.screenshot({ path: path.join(SHOTS, 'home-projects-390.png'), fullPage: false }); }
ok(before === await snap(home), 'the home page wrote nothing to storage (load, search, filter, refresh)');
// an unreadable list: reported, left as it is
const k0 = 'sfd_projects', bad = '{not json';
await home.evaluate(([k, v]) => localStorage.setItem(k, v), [k0, bad]); await home.click('#spReload'); await home.waitForTimeout(150);
await home.selectOption('#spApp', 'spread-footing').catch(() => {}); await home.waitForTimeout(100);
ok(await home.evaluate(() => /could not be read/.test(document.getElementById('spOut').textContent)) && await home.evaluate(k => localStorage.getItem(k), k0) === bad, 'an unreadable list is reported and left unchanged');
ok(!reqs.length, 'no network request from the home page (' + reqs.join(', ') + ')');
ok(!errs.length, 'no console errors on the home page' + (errs.length ? ': ' + errs.join(' | ') : ''));
await b.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASS'); process.exit(failed ? 1 : 0);
}
