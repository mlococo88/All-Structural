// Steel Bridge Design (apps/steel-bridge), Auto design per girder type (SB-2 PR 3, 2026-11-13; engineer decision SB-2, 2026-11-12):
//   1. A new project (Interior on G2–G4, Exterior on G1 and G5): the Auto design input tab offers "Every girder type" (default) and "The
//      selected type only", not the one-design run of before; the note names the variables locked. Refine, every type: one run per type,
//      the output tab's type table (a row per type, its lines, the governing check with its line), Apply #1 of every type writes each
//      type's plates and nothing else; Undo the last Apply puts every type's plates back.
//   2. The one-girder built-in project saved before girder types: no "Design" choice, no type note (Auto design as before).
//   3. A two-girder project saved before girder types (no lines): the choice offered, "One plate design for every plate girder" first.
//   0 console errors.   node tests/smoke/steel-bridge-adtypes.mjs [--shots <dir>]
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';
import { SBD_SEED, SBD_DEFAULT } from './sbd-seed.mjs';

const ai = process.argv.indexOf('--shots'), SHOTS = ai > 0 ? process.argv[ai + 1] : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const shot = async (p, n, o) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + '.png'), ...(o || {}) }); };
const FILE = path.join(REPO, 'apps/steel-bridge/index.html');
const t0 = Date.now(), allErrs = [];
const saved = p => p.evaluate(() => JSON.parse(localStorage.getItem('sbd2.project.current')));
const scopeOpts = p => p.evaluate(() => { const s = document.getElementById('ad_scope'); return s ? [...s.options].map(o => o.value) : null; });

{ // 1. a new project
  const { b, p, errs } = await openPage(FILE, { vw: 1400, vh: 1000, ls: { 'sbd2.ui': JSON.stringify({ itab: 'ad', otab: 'ad' }) } });
  try {
    await p.waitForSelector('#ad_run');
    assert.deepEqual(await scopeOpts(p), ['each', 'sel']);
    assert.match(await p.textContent('#ad_scopeNote'), /Locked at the current values .*Girder count Nb; Deck overhang/);
    await p.selectOption('#mode', 'refine'); await p.waitForTimeout(300);
    const P0 = await saved(p);
    assert.deepEqual(P0.girders.map(g => [g.label, g.lines]), [['Interior', [1, 2, 3]], ['Exterior', [0, 4]]]);
    await p.click('#ad_run');
    await p.waitForSelector('#ad_types', { timeout: 900000 });
    const T = await p.evaluate(() => [...document.querySelectorAll('#ad_types tbody tr')].map(tr => [...tr.cells].map(c => c.textContent.trim())));
    assert.equal(T.length, 2); assert.equal(T[0][0], 'Interior (G2, G3, G4)'); assert.equal(T[1][0], 'Exterior (G1, G5)');
    T.forEach(r => assert.ok(+r[1] >= 1, `${r[0]}: a candidate (${r.join(' | ')})`));
    assert.match(T[1][5], /\(Exterior on G[15]\)/, 'the governing line named');
    assert.match(await p.textContent('#out .ad-list thead'), /Weight \(lb, its 3 lines\)/, 'Interior: the weight of its lines');
    await shot(p, 'autodesign-types-1400');
    await p.click('#ad_applyAll');
    await p.waitForFunction(() => { const P = JSON.parse(localStorage.getItem('sbd2.project.current')); return P.autodesign && P.autodesign.undo; }, null, { timeout: 30000 });
    const P1 = await saved(p), strip = g => ({ ...g, segments: null });
    assert.deepEqual(P1.girders.map(strip), P0.girders.map(strip), 'only the plates of the types');
    ['xs', 'framing', 'splices', 'stiffeners', 'crossframes', 'studs', 'welds', 'constr'].forEach(k => assert.deepEqual(P1[k], P0[k], k));
    assert.deepEqual(P1.autodesign.undo, { girders: P0.girders }); assert.deepEqual(P1.autodesign.applied.types.map(q => q.t), [0, 1]);
    const ch = P1.girders.map((g, i) => JSON.stringify(g.segments) !== JSON.stringify(P0.girders[i].segments));
    await p.click('#ad_undo'); await p.waitForTimeout(500);
    const P2 = await saved(p); assert.deepEqual(P2.girders, P0.girders, 'Undo: every type as before'); assert.ok(!P2.autodesign.undo);
    console.log(`  ok   new project: Refine per type (${T.map(r => `${r[0]}: D ${r[2]} in, ${r[3]} lb, ratio ${r[4]}, ${r[5]}`).join('; ')}); Apply all (plates changed: ${ch}); Undo`);
    allErrs.push(...errs);
  } finally { await b.close(); }
}
{ // 2. the one-girder project saved before girder types
  const { b, p, errs } = await openPage(FILE, { vw: 1400, vh: 1000, ls: { ...SBD_SEED, 'sbd2.ui': JSON.stringify({ itab: 'ad' }) } });
  try {
    await p.waitForSelector('#ad_run');
    assert.equal(await scopeOpts(p), null); assert.equal(await p.$('#ad_scopeNote'), null);
    console.log('  ok   one-girder saved project: no type choice (Auto design as before)');
    allErrs.push(...errs);
  } finally { await b.close(); }
}
{ // 3. two plate girders saved before girder types
  const P = JSON.parse(JSON.stringify(SBD_DEFAULT)), g = JSON.parse(JSON.stringify(P.girders[0])); Object.assign(g, { id: 'G2', label: 'G2', position: 'exterior', beff: 96 }); P.girders.push(g);
  const { b, p, errs } = await openPage(FILE, { vw: 1400, vh: 1000, ls: { 'sbd2.project.current': JSON.stringify(P), 'sbd2.ui': JSON.stringify({ itab: 'ad' }) } });
  try {
    await p.waitForSelector('#ad_run');
    assert.deepEqual(await scopeOpts(p), ['together', 'each', 'sel']); assert.equal(await p.$eval('#ad_scope', e => e.value), 'together'); assert.equal(await p.$('#ad_scopeNote'), null);
    await p.selectOption('#ad_scope', 'each'); await p.waitForSelector('#ad_scopeNote');
    assert.equal(JSON.stringify(await saved(p)), JSON.stringify(P), 'nothing written (the choice is this page view\'s)');
    console.log('  ok   two girders saved before types: "One plate design for every plate girder" first; the per-type choice offered, not saved');
    allErrs.push(...errs);
  } finally { await b.close(); }
}
assert.deepEqual(allErrs, [], 'console errors');
console.log(`steel-bridge-adtypes: all passed, 0 console errors (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
