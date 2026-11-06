#!/usr/bin/env node
// The standard save of the Bridge Suite (BSS, 2026-11-06; shared/bridge-suite-projects.js over the shared list bridgeSuite.v1.projects)
// in index.html (MCT generator), lldf.html (LL & DL Distribution) and Prestressed Bridge Design.html. For each app (--app mct,lldf,psb):
//   1. sync off, a seeded suite list (two names, one of them twice, an entry with MIDAS demands and an old "stgirder" part): the page
//      opens on the suite's open project (chip), the standard dialog lists every entry (the older duplicate as "<name> (older, saved …)"),
//      no request leaves the page, and loading the page changes no entry of the list and not the open project;
//   2. Save as a new name: a new entry { name, savedAt, slices: { <this app's parts> } } (the bootstrap's shape, id bp_…), now the open
//      project; Save as an existing name is not a new duplicate ("Replace it": this app's part goes into that entry, its other parts kept);
//   3. an input change -> "unsaved changes" (MCT, which does not autosave into the project) / saved again (lldf, Prestressed autosave);
//      Ctrl+S writes this app's part into the open entry (same id);
//   4. dialog Rename (same id, parts, demands, time), Duplicate (a new id, everything else equal), Delete (the entry is gone; the open
//      project pointer is cleared when it was the one);
//   5. GitHub (mock, --gh): Save uploads projects/bridge-suite/<name>.json at once = { app: 'BridgeSuite', v: 1, name, savedAt, slices }
//      (no demands); a later change of the entry (another app's autosave) is NOT uploaded until the edits pause 30 s, then it is;
//   6. 390 px: no sideways scroll with the dialog open; 0 console errors.
//   node tests/smoke/bridge-suite-save.mjs [--app mct,lldf,psb] [--no-gh] [--shots <dir>]
import path from 'path';
import { openPage, REPO } from '../lib.mjs';
import { makeGitHubMock } from '../engine/gh-mock.mjs';
import { stdSave } from './project-library.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SHOTS = arg('shots', null), GH = !process.argv.includes('--no-gh');
const K = 'bridgeSuite.v1.projects', KC = 'bridgeSuite.v1.currentProjectId';
const APPS = {
  mct: { file: 'index.html', label: 'MIDAS MCT Generator', parts: ['mct'], autosaves: false,
    ready: p => p.waitForFunction(() => window.IXPB && document.querySelector('[data-sp=chip]'), null, { timeout: 120000 }),
    change: async p => { await p.evaluate(() => { const i = [...document.querySelectorAll('input')].find(x => /Route 1 Bridge/.test(x.placeholder || ''));
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, (i.value || '') + 'x'); i.dispatchEvent(new Event('input', { bubbles: true })); }); await p.waitForTimeout(1500); } },
  lldf: { file: 'lldf.html', label: 'LL & DL Distribution', parts: ['lldf'], autosaves: true,
    ready: p => p.waitForFunction(() => window.lldfLast && window.LLPB && document.querySelector('[data-sp=chip]'), null, { timeout: 60000 }),
    change: async p => { await p.evaluate(() => { const i = document.getElementById('skew'); i.value = String((+i.value || 0) + 5); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(1500); } },
  psb: { file: 'Prestressed Bridge Design.html', label: 'Prestressed Bridge Design', parts: ['psbeam', 'psbeamBridge'], autosaves: true,
    ready: p => p.waitForFunction(() => window.PSPB && document.querySelector('[data-sp=chip]'), null, { timeout: 120000 }),
    change: async p => { await p.evaluate(() => { window.PSPB.__edit(); }); await p.waitForTimeout(1800); } }
};
const list = arg('app', Object.keys(APPS).join(',')).split(',');
let failed = 0;
const SEED = () => ({
  bp_test_alpha: { name: 'Alpha', savedAt: '2026-11-01T12:00:00.000Z', slices: { lldf: { app: 'AASHTO-LLDF', inputs: { skew: 0 } }, stgirder: { old: true } }, demands: { kind: 'test', rows: [1, 2, 3] } },
  bp_test_dup1: { name: 'Dup', savedAt: '2026-11-02T12:00:00.000Z', slices: { mct: { projectName: 'old dup' } } },
  bp_test_dup2: { name: 'Dup', savedAt: '2026-11-03T12:00:00.000Z', slices: { mct: { projectName: 'new dup' } }, demands: { kind: 'dup' } }
});
const TOKEN = 'github_pat_SMOKE0000000000000000wxyz';
const SET = JSON.stringify({ owner: 'mlococo88', repo: 'structural-projects', branch: 'main', token: TOKEN, device: 'Smoke' });

for (const key of list) {
  const A = APPS[key]; const out = []; const ok = (c, m) => { out.push((c ? '  ok   ' : '  FAIL ') + m); if (!c) failed++; return c; };
  console.log(`== ${key} (${A.file})`);
  // ---------- sync off ----------
  {
    const seed = SEED(), ls = { [K]: JSON.stringify(seed), [KC]: 'bp_test_alpha' };
    const s = await openPage(path.join(REPO, A.file), { vw: 1400, vh: 900, ls, timeout: 120000 });
    const p = s.p, reqs = []; p.on('request', r => { if (!/^(file|data|about|blob):/.test(r.url())) reqs.push(r.url()); });
    try {
      await A.ready(p); await p.waitForTimeout(1500);
      const reg = () => p.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), K);
      const cur = () => p.evaluate(k => localStorage.getItem(k), KC);
      const r0 = await reg();
      ok(JSON.stringify(Object.keys(r0)) === JSON.stringify(Object.keys(seed)) && ['bp_test_dup1', 'bp_test_dup2'].every(id => JSON.stringify(r0[id]) === JSON.stringify(seed[id])), 'load: the duplicate entries are unchanged');
      ok(JSON.stringify(r0.bp_test_alpha.demands) === JSON.stringify(seed.bp_test_alpha.demands) && JSON.stringify(r0.bp_test_alpha.slices.stgirder) === '{"old":true}', 'load: Alpha keeps its demands and old stgirder part');
      ok(await cur() === 'bp_test_alpha', 'load: the open project is unchanged');
      const chip = await p.evaluate(() => document.querySelector('[data-sp=chip]').textContent);
      ok(/Alpha/.test(chip), `chip names the open project: "${chip.trim()}"`);
      const hdr = await p.evaluate(() => { const c = document.querySelector('[data-sp=chip]'), par = c.parentNode; return [...par.children].filter(e => e.offsetParent !== null || e === c).map(e => (e.dataset.sp || '') + ':' + e.textContent.replace(/Ctrl\+S/, '').trim().slice(0, 24)); });
      out.push('       header: ' + hdr.join(' | '));
      const iC = hdr.findIndex(x => x.startsWith('chip')), iU = hdr.findIndex(x => /Undo$/.test(x)), iR = hdr.findIndex(x => /Redo$/.test(x)), iS = hdr.findIndex(x => x.startsWith('hsave')), iL = hdr.findIndex(x => x.startsWith('hlib'));
      ok(iC >= 0 && iC < iU && iU < iR && iR < iS && iS < iL, 'header order: chip · Undo · Redo · Save · Saved projects…');
      await p.evaluate(() => document.querySelector('[data-sp=hlib]').click()); await p.waitForTimeout(500);
      const rows = await p.evaluate(() => [...document.querySelectorAll('dialog.spLib[open] tbody tr[data-name]')].map(tr => decodeURIComponent(tr.dataset.name)));
      ok(rows.length === 3 && rows[0] === 'Alpha' && rows[1] === 'Dup' && /^Dup \(older, saved .*E[SD]T\)$/.test(rows[2]), 'dialog: ' + JSON.stringify(rows));
      const title = await p.evaluate(() => document.querySelector('dialog.spLib[open] .spHead strong').textContent);
      ok(title === 'Saved projects — ' + A.label, 'dialog title: ' + title);
      if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `bss-${key}-dialog.png`) });
      await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(500);
      const sw = await p.evaluate(() => document.documentElement.scrollWidth);
      ok(sw <= 390, '390 px with the dialog open: scrollWidth ' + sw);
      if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `bss-${key}-dialog-390.png`) });
      await p.evaluate(() => document.querySelector('dialog.spLib[open]').close());
      await p.setViewportSize({ width: 1400, height: 900 }); await p.waitForTimeout(400);
      if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `bss-${key}-page.png`) });
      // Save as a new name
      await stdSave(p, 'Bravo'); await p.waitForTimeout(800);
      let r = await reg(); const bid = Object.keys(r).find(id => r[id].name === 'Bravo');
      ok(!!bid && /^bp_/.test(bid) && JSON.stringify(Object.keys(r[bid])) === '["name","savedAt","slices"]' && A.parts.every(k => r[bid].slices[k] != null) && Object.keys(r[bid].slices).every(k => A.parts.includes(k)),
        'Save as "Bravo": a new entry with this app\'s parts ' + JSON.stringify(bid && Object.keys(r[bid].slices)));
      ok(await cur() === bid, 'Save as: Bravo is the open project');
      // Save as an existing name: Replace it -> this app's part into the newest "Dup"
      await stdSave(p, 'Dup'); await p.waitForTimeout(800);
      r = await reg();
      ok(Object.values(r).filter(e => e.name === 'Dup').length === 2 && !!r.bp_test_dup1 && JSON.stringify(r.bp_test_dup1) === JSON.stringify(seed.bp_test_dup1), 'Save as "Dup": no new duplicate; the older Dup untouched');
      ok(A.parts.every(k => r.bp_test_dup2.slices[k] != null) && JSON.stringify(r.bp_test_dup2.demands) === '{"kind":"dup"}' && (key === 'mct' || JSON.stringify(r.bp_test_dup2.slices.mct) === '{"projectName":"new dup"}'), 'Save as "Dup" (Replace it): this app\'s part in the newest Dup, its other parts and demands kept');
      ok(await cur() === 'bp_test_dup2', 'the newest Dup is the open project');
      // change -> state, Ctrl+S
      await A.change(p);
      const st1 = await p.evaluate(() => document.querySelector('[data-sp=chip]').textContent);
      ok(A.autosaves ? /· saved/.test(st1) : /unsaved changes/.test(st1), 'after an input change: ' + st1.trim());
      const before = JSON.stringify((await reg()).bp_test_dup2.slices[A.parts[0]]);
      await p.keyboard.press('Control+s'); await p.waitForTimeout(900);
      r = await reg(); const st2 = await p.evaluate(() => document.querySelector('[data-sp=chip]').textContent);
      ok(/· saved/.test(st2) && Object.values(r).filter(e => e.name === 'Dup').length === 2, 'Ctrl+S: saved into the open entry: ' + st2.trim());
      ok(A.autosaves || JSON.stringify(r.bp_test_dup2.slices[A.parts[0]]) !== before, 'Ctrl+S wrote the changed part');
      // dialog Rename / Duplicate / Delete
      const act = async (a, n, answer) => { await p.evaluate(() => document.querySelector('[data-sp=hlib]').click()); await p.waitForTimeout(400);
        await p.evaluate(([a, n, ans]) => { const pr = window.prompt, cf = window.confirm; window.prompt = () => ans; window.confirm = () => true;
          try { document.querySelector(`dialog.spLib[open] [data-spa=${a}][data-n="${CSS.escape(encodeURIComponent(n))}"]`).click(); } finally { window.prompt = pr; window.confirm = cf; } }, [a, n, answer]);
        await p.waitForTimeout(500); await p.evaluate(() => { const d = document.querySelector('dialog.spLib[open]'); if (d) d.close(); }); };
      const a0 = (await reg()).bp_test_alpha;
      await act('rename', 'Alpha', 'Alpha 2'); r = await reg();
      ok(r.bp_test_alpha && r.bp_test_alpha.name === 'Alpha 2' && JSON.stringify({ ...r.bp_test_alpha, name: 'Alpha' }) === JSON.stringify(a0), 'Rename: same id, parts, demands, time');
      await act('dup', 'Alpha 2', 'Alpha copy'); r = await reg(); const cid = Object.keys(r).find(id => r[id].name === 'Alpha copy');
      ok(cid && cid !== 'bp_test_alpha' && JSON.stringify({ ...r[cid], name: 'Alpha 2' }) === JSON.stringify(r.bp_test_alpha), 'Duplicate: a new id, everything else equal');
      await act('del', 'Alpha copy'); r = await reg(); ok(!r[cid] && !!r.bp_test_alpha, 'Delete: the copy is gone, Alpha 2 kept');
      await act('del', 'Dup'); r = await reg(); ok(!r.bp_test_dup2 && !!r.bp_test_dup1 && (await cur()) === null, 'Delete the open project: gone; no open project');
      ok(reqs.length === 0, 'sync off: no request (' + reqs.length + ')');
      const keys = await p.evaluate(() => Object.keys(localStorage).filter(k => /githubSync/.test(k)));
      ok(keys.length === 0, 'sync off: no GitHub key written');
      ok(s.errs.filter(e => !/BABEL\] Note/.test(e)).length === 0, 'console errors: ' + JSON.stringify(s.errs.filter(e => !/BABEL\] Note/.test(e)).slice(0, 3)));
    } catch (e) { ok(false, 'threw: ' + e.message); }
    await s.b.close();
  }
  // ---------- GitHub (mock) ----------
  if (GH) {
    const gh = makeGitHubMock({ token: TOKEN });
    const seed = SEED(), ls = { [K]: JSON.stringify(seed), [KC]: 'bp_test_alpha', 'bridgeSuite.v1.githubSync': SET, 'bridgeSuite.v1.githubSync.tool.bridge-suite': JSON.stringify({ v: 1, base: {}, seen: {}, queue: [], conflicts: {}, asked: true }) };
    const s = await openPage(path.join(REPO, A.file), { vw: 1400, vh: 900, ls, timeout: 120000 });
    await s.p.route('https://api.github.com/**', async rt => { const q = rt.request(); const res = gh.handle(q.method(), q.url(), await q.allHeaders(), q.postData()); return rt.fulfill({ status: res.status, headers: res.headers, body: res.body }); });
    const p = s.p, F = n => `projects/bridge-suite/${n}.json`;
    try {
      await A.ready(p); await p.waitForTimeout(1500);
      await stdSave(p, 'Gamma'); const t0 = Date.now();
      for (let i = 0; i < 40 && !gh.files.has(F('Gamma')); i++) await p.waitForTimeout(250);
      ok(gh.files.has(F('Gamma')), `Save uploads at once (${Date.now() - t0} ms)`);
      const f = gh.files.has(F('Gamma')) ? JSON.parse(gh.files.get(F('Gamma'))) : {};
      const e = await p.evaluate(k => Object.values(JSON.parse(localStorage.getItem(k))).find(x => x.name === 'Gamma'), K);
      ok(JSON.stringify(Object.keys(f)) === '["app","v","name","savedAt","slices"]' && f.app === 'BridgeSuite' && f.name === 'Gamma' && f.savedAt === e.savedAt && JSON.stringify(f.slices) === JSON.stringify(e.slices), 'file = { app, v, name, savedAt, slices } of the entry (no demands)');
      // another app's autosave into the open project: waits for the 30 s pause
      const puts0 = gh.log.filter(l => l.method === 'PUT').length;
      await p.evaluate(() => { const id = window.BridgeProjects.current(); window.BridgeProjects.saveSlice(id, undefined, 'otherApp', { n: 1 }); });
      await p.waitForTimeout(12000);
      ok(gh.log.filter(l => l.method === 'PUT').length === puts0, 'a change of the entry is not uploaded within 12 s (settle)');
      for (let i = 0; i < 120 && gh.log.filter(l => l.method === 'PUT').length === puts0; i++) await p.waitForTimeout(500);
      const f2 = JSON.parse(gh.files.get(F('Gamma')));
      ok(f2.slices.otherApp && f2.slices.otherApp.n === 1, 'uploaded after the edits paused (~30 s)');
      ok(!/demands/.test(gh.files.get(F('Gamma'))), 'no MIDAS demands in the file');
      ok(s.errs.filter(e => !/BABEL\] Note/.test(e)).length === 0, 'console errors (GitHub): ' + JSON.stringify(s.errs.filter(e => !/BABEL\] Note/.test(e)).slice(0, 3)));
    } catch (e) { ok(false, 'threw (GitHub): ' + e.message); }
    await s.b.close();
  }
  console.log(out.join('\n'));
}
console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);
