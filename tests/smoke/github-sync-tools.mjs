#!/usr/bin/env node
// GitHub sync (shared/github-sync.js, GHS) in every tool that turns it on (PR 2 roll-out, 2026-11-05). For each tool, with sync set
// up and api.github.com routed to the in-memory GitHub of tests/engine/gh-mock.mjs (nothing reaches the network):
//   1. the tool's own Save path -> the file projects/<tool>/GHS A.json appears on GitHub (background upload), as JSON;
//   2. an input change and the tool's own Save again -> the update goes with the file's sha;
//   3. that file copied on GitHub as "GHS remote" -> listed under "On GitHub only"; Open loads it -> the tool's results equal the
//      results of the project that was saved (the file round trip reads back the same inputs);
//   4. no console errors; the sync keys are bridgeSuite.v1.githubSync and bridgeSuite.v1.githubSync.tool.<tool> only.
// The whole flow (conflicts, offline, delete, token) is tested once in tests/smoke/github-sync.mjs (Spread Footing).
//   node tests/smoke/github-sync-tools.mjs [--tool asce7,baseplate,...]   (keys of tests/smoke/project-library.mjs)
import path from 'path';
import { openPage, REPO, diff } from '../lib.mjs';
import { TOOLS } from './project-library.mjs';
import { makeGitHubMock, gitBlobSha } from '../engine/gh-mock.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
// project-library key -> the tool's folder on GitHub (its ctx.cloud.tool)
const FOLDER = { asce7: 'asce7-load-generator', baseplate: 'base-plate-anchor', bsl: 'bridge-substructure-loading', gusset: 'gusset-plate-rating',
  lightpole: 'light-pole-sign-post', mlg: 'moving-load-generator', retwall: 'retaining-wall-designer', spc: 'section-property-calculator',
  smd: 'shear-moment-diagrams', steelbeam: 'steel-beam-aisc', stonearch: 'stone-arch-rating', timber: 'timber-beam-check',
  rebar: 'aci-rebar-development', spreadfooting: 'spread-footing',
  // GHS2 (2026-11-05): tools with their own project dialog or panel (statusCell + decorate(body, ui, { rows: false }))
  abutment: 'abutment-calculator', edm: 'elastomeric-bearing', bgeo: 'bridge-geometry' };
// Tools with their own project dialog: how to show it (with sync on, the GitHub rows are drawn into it), and whether it is open.
// Default: the shared Saved projects dialog (dialog.spLib).
const OWN = {
  abutment: { show: p => p.evaluate(() => { const d = document.getElementById('dlgProj'); if (d.open) d.close(); document.getElementById('btnManageProj').click(); }),
    open: p => p.evaluate(() => document.getElementById('dlgProj').open),
    del: (p, n) => p.evaluate(n => document.querySelector(`#projList [data-act=del][data-n="${CSS.escape(n)}"]`).click(), n) },
  edm: { show: p => p.evaluate(() => { const d = document.getElementById('dlgProj'); if (d.open) d.close(); document.getElementById('btnManageProj').click(); }),
    open: p => p.evaluate(() => document.getElementById('dlgProj').open),
    del: (p, n) => p.evaluate(n => document.querySelector(`#projList [data-a=del][data-n="${CSS.escape(n)}"]`).click(), n) },
  // Bridge Geometry: a library panel, not a dialog (it stays open after Open: open() is false)
  bgeo: { box: '#lib_panel', show: p => p.evaluate(() => { if (document.getElementById('lib_panel').style.display === 'none') document.getElementById('lib_toggle').click(); else document.getElementById('lib_refresh').click(); }),
    open: () => false,
    del: (p, n) => p.evaluate(n => document.querySelector(`#lib_list [data-lib-del="${encodeURIComponent(n)}"]`).click(), n) }
};
const BOX = key => (OWN[key] && OWN[key].box) || 'dialog[open]';
const showList = (key, p) => OWN[key] ? OWN[key].show(p) : p.evaluate(() => { const d = document.querySelector('dialog.spLib[open]'); if (d) d.close(); [...document.querySelectorAll('button[data-sp]')].find(b => /^(Saved projects|Projects|Saved analyses)…$/.test(b.textContent)).click(); });
const listOpen = (key, p) => OWN[key] ? OWN[key].open(p) : p.evaluate(() => !!document.querySelector('dialog.spLib[open]'));
const list = arg('tool', Object.keys(FOLDER).join(',')).split(',');
const TOKEN = 'github_pat_SMOKE0000000000000000wxyz';
const SET = JSON.stringify({ owner: 'mlococo88', repo: 'structural-projects', branch: 'main', token: TOKEN, device: 'Smoke' });
const until = async (f, ms, what) => { const t0 = Date.now(); for (;;) { if (await f()) return; if (Date.now() - t0 > ms) throw new Error('timeout: ' + what); await new Promise(r => setTimeout(r, 150)); } };
let failed = 0;

for (const key of list) {
  const T = TOOLS[key], folder = FOLDER[key]; if (!T || !folder) { console.log(`?? ${key}: not a tool with sync`); failed++; continue; }
  const gh = makeGitHubMock({ token: TOKEN }), P = n => `projects/${folder}/${n}.json`;
  const s = await openPage(path.join(REPO, T.file), { vw: 1280, vh: 900, hash: T.hash || '', ls: { 'bridgeSuite.v1.githubSync': SET } });
  await s.p.route('https://api.github.com/**', async r => { const q = r.request(); const res = gh.handle(q.method(), q.url(), await q.allHeaders(), q.postData()); return r.fulfill({ status: res.status, headers: res.headers, body: res.body }); });
  let p = s.p;
  if (T.frame) { const page = s.p; await page.waitForSelector(T.frame, { state: 'attached' }); const fr = await (await page.$(T.frame)).contentFrame();
    const via = (o, k) => typeof o[k] === 'function' ? o[k].bind(o) : o[k]; p = new Proxy(fr, { get: (t, k) => k in t ? via(t, k) : via(page, k) }); }
  const out = []; const ok = (c, m) => { out.push((c ? '  ok   ' : '  FAIL ') + m); if (!c) failed++; return c; };
  try {
    await T.ready(p); await p.waitForTimeout(900);
    await T.save(p, 'GHS A');
    await until(() => gh.files.has(P('GHS A')), 15000, 'upload of the first save');
    let j = null; try { j = JSON.parse(gh.files.get(P('GHS A'))); } catch (e) { /* below */ }
    ok(j && typeof j === 'object', 'Save -> projects/' + folder + '/GHS A.json on GitHub (JSON object)');
    const sha0 = gitBlobSha(gh.files.get(P('GHS A')));
    await T.change(p); await T.save(p, 'GHS A');
    await until(() => gitBlobSha(gh.files.get(P('GHS A'))) !== sha0, 15000, 'upload of the update');
    const put = gh.log.filter(l => l.method === 'PUT' && l.url.includes('GHS%20A')).at(-1);
    ok(JSON.parse(put.body).sha === sha0, 'change + Save -> update sent with the file\'s sha');
    const r1 = await T.results(p);
    gh.setRemote(P('GHS remote'), gh.files.get(P('GHS A')));
    await showList(key, p);
    await until(() => p.evaluate(b => !!document.querySelector(b + ' [data-ghx=open][data-n="GHS%20remote"]'), BOX(key)), 15000, 'cloud-only row');
    ok(await p.evaluate(b => !!document.querySelector(b + ' [data-gh-status=synced]'), BOX(key)), 'the saved project shows "synced" in the list');
    await p.evaluate(b => document.querySelector(b + ' [data-ghx=open][data-n="GHS%20remote"]').click(), BOX(key));
    await until(async () => !(await listOpen(key, p)), 15000, 'Open closes the dialog');
    await p.waitForTimeout(1500);
    // openIgnore (project-library.mjs): fields the tool's own Save changes without a recompute (abutment: the revision added to S.meta
    // changes the input fingerprint), so they are compared there the same way
    const drop = o => { if (!T.openIgnore || !o || typeof o !== 'object') return o; const c = { ...o }; T.openIgnore.forEach(k => delete c[k]); return c; };
    const r2 = await T.results(p); const d = diff(drop(r1), drop(r2));
    ok(!d.length, 'GitHub-only copy opened: results identical to the saved project' + (T.openIgnore ? ' (except ' + T.openIgnore.join(', ') + ')' : '') + (d.length ? ` (${d.length} differences: ${JSON.stringify(d.slice(0, 3)).slice(0, 400)})` : ''));
    const lst = JSON.parse(await p.evaluate(k => localStorage.getItem(k), T.list) || '{}');
    ok('GHS remote' in lst && 'GHS A' in lst, 'the tool\'s own list holds both projects');
    const sk = (await p.evaluate(() => Object.keys(localStorage))).filter(k => /^bridgeSuite\.v1\.githubSync/.test(k)).sort();
    ok(JSON.stringify(sk) === JSON.stringify(['bridgeSuite.v1.githubSync', `bridgeSuite.v1.githubSync.tool.${folder}`]), 'sync keys: bridgeSuite.v1.githubSync and .tool.' + folder + ' only (' + sk.join(', ') + ')');
    if (OWN[key]) {   // own dialog: the settings button in the bar, the first-sync offer, and a delete that asks about the GitHub copy
      await showList(key, p); await p.waitForTimeout(800);
      ok(await p.evaluate(b => !!document.querySelector(b + ' .spGhBar [data-ghx=setup]'), BOX(key)), 'own dialog: "Cloud sync (GitHub)…" button in the sync bar');
      await p.evaluate(k => localStorage.removeItem(k), `bridgeSuite.v1.githubSync.tool.${folder}`);
      const n0 = gh.files.size; gh.files.delete(P('GHS A'));
      await showList(key, p);
      await until(() => p.evaluate(b => !!document.querySelector(b + ' [data-ghx=upall]'), BOX(key)), 15000, 'first-sync offer');
      await p.evaluate(b => document.querySelector(b + ' [data-ghx=upall]').click(), BOX(key));
      await until(() => gh.files.has(P('GHS A')) && gh.files.has(P('GHS remote')), 15000, 'Upload all');
      ok(gh.files.size >= n0, 'first sync on a device: offer shown, Upload all sends the projects already in the list');
      s.dialogs.length = 0;
      await OWN[key].del(p, 'GHS A');
      await until(() => !gh.files.has(P('GHS A')), 15000, 'delete on GitHub after the confirm');
      ok(s.dialogs.some(m => /Also delete "GHS A" from GitHub/.test(m)), 'delete in the tool\'s dialog asks before deleting the GitHub copy (accepted here: file deleted)');
    }
    const errs = s.errs;
    ok(!errs.length, 'no console errors' + (errs.length ? ': ' + errs.join(' | ').slice(0, 400) : ''));
    ok(gh.log.every(l => l.auth === `Bearer ${TOKEN}` && !l.url.includes(TOKEN)), 'token only in the Authorization header');
  } catch (e) { ok(false, String(e.message || e).slice(0, 300)); }
  await s.b.close();
  if (OWN[key]) {   // sync off (no settings): the tool's own Save and its dialog make no request and write no sync key
    const o = await openPage(path.join(REPO, T.file), { vw: 1280, vh: 900, hash: T.hash || '' }); const reqs = [];
    await o.p.route('https://api.github.com/**', r => { reqs.push(r.request().url()); return r.abort(); });
    try {
      await T.ready(o.p); await o.p.waitForTimeout(900); await T.save(o.p, 'GHS off'); await OWN[key].show(o.p); await o.p.waitForTimeout(4000);
      const sk = (await o.p.evaluate(() => Object.keys(localStorage))).filter(k => /^bridgeSuite\.v1\.githubSync/.test(k));
      const bar = await o.p.evaluate(x => { const b = document.querySelector(x + ' .spGhBar'); return b ? b.textContent : ''; }, BOX(key));
      ok(!reqs.length && !sk.length && /Cloud sync \(GitHub\): off/.test(bar), `sync off: Save + dialog -> no request (${reqs.length}), no sync key (${sk.join(', ') || 'none'}), bar says off`);
      ok(!o.errs.length, 'sync off: no console errors' + (o.errs.length ? ': ' + o.errs.join(' | ').slice(0, 400) : ''));
    } catch (e) { ok(false, 'sync off: ' + String(e.message || e).slice(0, 300)); }
    await o.b.close();
  }
  console.log(`${key} (${T.file})\n${out.join('\n')}`);
}
console.log(failed ? `\n${failed} FAILED` : '\nALL PASS'); process.exit(failed ? 1 : 0);
