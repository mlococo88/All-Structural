#!/usr/bin/env node
// Steel Beam Design - AISC 15th: Major Flexure per-combination tables name the compression flange (SBCF, 2026-11-13). Display only.
// Headless, offline. On a 2-span beam with a cantilever (sagging and hogging regions):
//   1. W18X50: column "Compression flange" (no "Flange" column), values top / bottom, the sagging / hogging note under each table,
//      capacity-envelope labels "compression: top flange"; the Report has the column and the note;
//   2. HSS12X6X1/2: values "top wall" / "bottom wall", labels "compression: top wall";
//   3. member-check mode (L_b 10 ft): value "top or bottom", the one-L_b note; no console errors.
//   node tests/smoke/steel-beam-compression-flange.mjs [--file <tool html>]
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FILE = path.resolve(REPO, arg('file', 'Steel Beam Design - AISC 15th.html'));
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const { b, p, errs } = await openPage(FILE);
await p.waitForFunction(() => typeof AN !== 'undefined' && AN && AN.combos); await p.waitForTimeout(700);
const set = async (sec, mode) => { await p.evaluate(([sec, mode]) => {
  S.geom = { spans: [{ L: 20 }, { L: 24 }, { L: 6 }], nodes: [{ t: 'pin' }, { t: 'roller' }, { t: 'roller' }, { t: 'free' }] };
  S.loads = [{ id: 'p1', type: 'point', lc: 'LL', mag: 4, si: 2, pos: 6 }]; S.section = sec; S.mode = mode;
  if (mode === 'member') { S.member.Lb = 10; S.member.L = 20; } if (mode === 'member') S.member.rows = [{ id: 'm1', name: 'LC-1', Mux: 80, Vux: 30, Pu: 0, Muy: 0, Vuy: 0, Tu: 0 }];
  S.ui.tab = 'tabMx'; SBRP.on = false; fullRebuild(); }, [sec, mode]); await p.waitForTimeout(1200); };
const read = () => p.evaluate(() => {
  const secs = [...document.querySelectorAll('#tabPages .sec[data-secid^="mx_"]')];
  const vals = new Set(), heads = new Set(), notes = [];
  secs.forEach(s => { const t = s.querySelector('table.tbl'); if (!t) return; const h = [...t.rows[0].cells].map(c => c.textContent); h.forEach(x => heads.add(x));
    const k = h.indexOf('Compression flange'); [...t.rows].slice(1).forEach(r => vals.add(r.cells[k].textContent));
    const nx = t.nextElementSibling; notes.push(nx ? nx.textContent : ''); });
  const ann = Object.keys(PLOTREG).filter(k => /^capEnv_/.test(k)).flatMap(k => (PLOTREG[k].layout.annotations || []).map(a => a.text.split('<br>')[0]));
  return { n: secs.length, heads: [...heads], vals: [...vals].sort(), notes: [...new Set(notes)], ann: [...new Set(ann)].sort() };
});
const NOTE = 'Sagging moment: top in compression, uses Lᵇ,top; hogging: bottom in compression, uses Lᵇ,bot.';
// 1
await set({ family: 'W', label: 'W18X50', grade: 'A992', builtUp: false, ovr: {} }, 'beam');
let r = await read();
assert.ok(r.n > 0 && r.heads.includes('Compression flange') && !r.heads.includes('Flange'), JSON.stringify(r.heads));
assert.deepEqual(r.vals, ['bottom', 'top']); assert.deepEqual(r.notes, [NOTE]);
assert.deepEqual(r.ann, ['compression: bottom flange', 'compression: top flange']);
ok('W: column "Compression flange", top / bottom, note under each of ' + r.n + ' tables, plot labels');
await p.evaluate(() => [...document.querySelectorAll('#tabBar button')].find(x => x.textContent.trim() === 'Report').click()); await p.waitForTimeout(3000);
const rep = await p.evaluate(() => SharedReport.text(SBRP.doc));
assert.ok(rep.includes('Compression flange') && rep.includes(NOTE));
ok('Report: the column and the note');
// 2
await set({ family: 'HSSR', label: 'HSS12X6X1/2', grade: 'A500B_R', builtUp: false, ovr: {} }, 'beam');
r = await read();
assert.deepEqual(r.vals, ['bottom wall', 'top wall']); assert.deepEqual(r.notes, [NOTE]);
assert.deepEqual(r.ann, ['compression: bottom wall', 'compression: top wall']);
ok('rectangular HSS: top wall / bottom wall, plot labels');
// 3
await set({ family: 'W', label: 'W18X50', grade: 'A992', builtUp: false, ovr: {} }, 'member');
r = await read();
assert.deepEqual(r.vals, ['top or bottom']);
assert.deepEqual(r.notes, ['Member check: one Lᵇ (entered) is used for whichever flange is in compression.']);
ok('member check: "top or bottom" and the one-Lb note');
assert.deepEqual(errs, []);
ok('no console errors');
await b.close();
console.log(n + ' checks passed');
