#!/usr/bin/env node
// Bridge Substructure Loading: per-project copies of the foundationLoads send (SLFC, 2026-11-11; HANDOFF.md §4.6, §5.1; as abutmentLoads #1405):
//   - "Send to other tools" in the Send foundation loads dialog writes the channel key, .by.subloads (both as before) and
//     bridgeSuite.v1.foundationLoads.by.subloads.<project id> = the payload exactly as published (project id = SharedHandoffStore.pidOf);
//   - a second project (another name) gets its own copy, the first one is kept; a second send of the same project replaces its copy;
//   - Cloud sync off: no network request, no pending upload; a blank project name and bridge id: no per-project copy (as the store);
//   - FPU (2026-11-11): each send also writes the per-unit copy .by.subloads.<project id>.support-<n> (n = element.unitIndex + 1), so every
//     unit of every project is kept; the per-project copy stays the last unit sent;
//   - FPU with Cloud sync (gh-mock): both copies uploaded (handoffs/foundationLoads/subloads/<pid>.support-<n>.json and <pid>.json);
//   - the payload, Export hand-off (JSON) and every result unchanged (the cases are the dialog's); 0 console errors.
//   node tests/smoke/bsl-fdx-copies.mjs
import assert from 'assert/strict';
import path from 'path';
import { openPage, REPO } from '../lib.mjs';
import { makeGitHubMock } from '../engine/gh-mock.mjs';

const FILE = process.env.BSL_FILE || path.join(REPO, 'Bridge Substructure Loading.html');
let fails = 0; const ok = async (m, f) => { try { await f(); console.log('  ok   ' + m); } catch (e) { fails++; console.log('  FAIL ' + m + ': ' + String(e.message).slice(0, 500)); } };
const o = await openPage(FILE, { vw: 1440, vh: 1000 }), { p } = o;
try {
  await p.waitForFunction(() => typeof MODEL !== 'undefined' && MODEL && MODEL.G && window.SubLoadsFoundationHandoff && window.SharedHandoffStore); await p.waitForTimeout(700);
  const send = (name, k) => p.evaluate(async ([name, k]) => { P.meta.name = name; P.ui.sel = k; recompute(); const H = SubLoadsFoundationHandoff; H.open(); await new Promise(r => setTimeout(r, 50));
    const built = JSON.parse(JSON.stringify(H.state().b.p)); document.getElementById('fdx-send').click(); await new Promise(r => setTimeout(r, 300));
    const ks = Object.keys(localStorage).filter(x => /^bridgeSuite\.v1\.foundationLoads/.test(x)).sort(), get = x => JSON.parse(localStorage.getItem(x) || 'null');
    const pid = SharedHandoffStore.pidOf({ name, bridgeId: (get('bridgeSuite.v1.foundationLoads') || {}).project?.bridgeId || '' });
    return { ks, pid, ch: get('bridgeSuite.v1.foundationLoads'), by: get('bridgeSuite.v1.foundationLoads.by.subloads'), copy: pid ? get('bridgeSuite.v1.foundationLoads.by.subloads.' + pid) : null,
      units: pid ? Object.fromEntries(ks.filter(x => x.indexOf('bridgeSuite.v1.foundationLoads.by.subloads.' + pid + '.') === 0).map(x => [x.split('.').pop(), get(x)])) : null, built, pend: localStorage.getItem('bridgeSuite.v1.handoffStore.pending') }; }, [name, k]);
  const a = await send('Bridge A', 1);
  await ok('send: channel key, .by.subloads and .by.subloads.<pid> hold the same published payload (Pier 1, the dialog\'s cases)', () => {
    assert.ok(a.pid && a.pid.includes('~'), 'pid ' + a.pid); assert.deepEqual(a.copy, a.ch); assert.deepEqual(a.by, a.ch);
    assert.equal(a.ch.element.label, 'Pier 1'); assert.deepEqual(a.ch.cases, a.built.cases); assert.equal(a.ch.project.name, 'Bridge A');
    assert.ok(a.ks.includes('bridgeSuite.v1.foundationLoads.by.subloads.' + a.pid)); });
  const b = await send('Bridge B', 2);
  await ok('another project: its own copy; the first project\'s copy kept', () => {
    assert.notEqual(b.pid, a.pid); assert.equal(b.copy.element.label, 'Pier 2'); assert.ok(b.ks.includes('bridgeSuite.v1.foundationLoads.by.subloads.' + a.pid)); });
  const c = await send('Bridge A', 0);
  await ok('the same project again: its copy replaced by the last unit sent', () => { assert.equal(c.pid, a.pid); assert.equal(c.copy.element.label, 'Abut. 1'); assert.deepEqual(c.copy, c.ch); });
  await ok('FPU: a copy per unit: Bridge A keeps Pier 1 (support-2) and Abut. 1 (support-1), each exactly as published; Bridge B its Pier 2 (support-3)', () => {
    assert.deepEqual(Object.keys(c.units).sort(), ['support-1', 'support-2']); assert.deepEqual(c.units['support-1'], c.ch); assert.deepEqual(c.units['support-2'], a.ch);
    assert.deepEqual(Object.keys(b.units), ['support-3']); assert.deepEqual(b.units['support-3'], b.ch); });
  const d = await send('', 1);
  await ok('blank project name and bridge id: no per-project copy (the channel key as before)', () => { assert.equal(d.pid, ''); assert.equal(d.ch.element.label, 'Pier 1'); assert.equal(d.ks.filter(x => /\.by\.subloads\./.test(x)).length, 2 + 3); });
  await ok('Cloud sync off: no network request, no pending upload', () => { assert.deepEqual([...o.blocked], []); assert.equal(d.pend, null); });
  await ok('0 console errors', () => assert.deepEqual(o.errs, []));
} finally { await o.b.close(); }
// FPU (2026-11-11), Cloud sync set up (api.github.com routed to the in-memory GitHub of tests/engine/gh-mock.mjs): each send uploads the unit copy
// handoffs/foundationLoads/subloads/<pid>.support-<n>.json and the project copy <pid>.json (as before), both = the published payload.
{
  const TOKEN = 'github_pat_SMOKE0000000000000000wxyz', gh = makeGitHubMock({ token: TOKEN });
  const s = await openPage(FILE, { vw: 1440, vh: 1000, ls: { 'bridgeSuite.v1.githubSync': JSON.stringify({ owner: 'mlococo88', repo: 'structural-projects', branch: 'main', token: TOKEN, device: 'Smoke' }) } });
  try {
    await s.p.route('https://api.github.com/**', async r => { const q = r.request(); const res = gh.handle(q.method(), q.url(), await q.allHeaders(), q.postData()); return r.fulfill({ status: res.status, headers: res.headers, body: res.body }); });
    await s.p.waitForFunction(() => typeof MODEL !== 'undefined' && MODEL && MODEL.G && window.SubLoadsFoundationHandoff && window.SharedHandoffStore); await s.p.waitForTimeout(700);
    const sendC = (k) => s.p.evaluate(async k => { P.meta.name = 'Bridge C'; P.ui.sel = k; recompute(); SubLoadsFoundationHandoff.open(); await new Promise(r => setTimeout(r, 50));
      document.getElementById('fdx-send').click(); for (let i = 0; i < 60 && localStorage.getItem('bridgeSuite.v1.handoffStore.pending') !== null; i++) await new Promise(r => setTimeout(r, 100));
      await new Promise(r => setTimeout(r, 1500)); return localStorage.getItem('bridgeSuite.v1.foundationLoads'); }, k);
    const c1 = await sendC(1), c0 = await sendC(0), F = 'handoffs/foundationLoads/subloads/~Bridge C';
    await ok('Cloud sync: a unit copy per send (support-2, support-1) and the project copy (the last unit) uploaded, each = the published payload', () => {
      const t = x => gh.files.get(x) ? JSON.parse(gh.files.get(x)) : null;
      assert.deepEqual(t(F + '.support-2.json'), JSON.parse(c1)); assert.deepEqual(t(F + '.support-1.json'), JSON.parse(c0)); assert.deepEqual(t(F + '.json'), JSON.parse(c0));
      assert.ok(gh.commits.some(c => /^Hand-off foundationLoads from subloads: "Bridge C" \(from Smoke\)$/.test(c.message)), gh.commits.map(c => c.message).join('; ')); });
    await s.p.waitForTimeout(500);
    await ok('Cloud sync: nothing left pending; 0 console errors', async () => { assert.equal(await s.p.evaluate(() => localStorage.getItem('bridgeSuite.v1.handoffStore.pending')), null); assert.deepEqual(s.errs, []); });
  } finally { await s.b.close(); }
}
if (fails) { console.log(`${fails} failure(s)`); process.exit(1); }
console.log('all passed');
