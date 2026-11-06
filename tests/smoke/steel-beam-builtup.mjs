#!/usr/bin/env node
// Steel Beam Design - AISC 15th: a built-up section stays built-up (SBSF, 2026-11-06). Headless, offline.
// Until SBSF, sectionFor() (the Validation tab's design examples / self-tests, and the Report, which builds the Validation tab)
// put S.section back from family / label / grade / ovr only, so section.builtUp became undefined: the next results, the Report,
// the autosave, a Save, Export JSON, Undo and a reload were for a ROLLED section.
//   1. a welded I (24 x 12 x 1/2 flanges, 7/16 web, A572 Gr. 50, all properties overridden), Built-up ticked: phiVn = 283.5 kip
//      (phi_v 0.90, section G2.1(b)), phiMn = 672.75 kip-ft;
//   2. Validation, User Manual and Report tabs, each then Summary: S, AN, the autosave and the Report keep built-up (283.5, not 315);
//   3. an edit, Undo, Redo; Save (Save as), Export JSON, reload: builtUp true everywhere, the box ticked;
//   4. a saved project with an overridden I-shape and no builtUp (saved by the bug): opens as rolled, as before, with a one-line
//      notice in Section & Material; the stored item is not changed; ticking the box clears it. A rolled project with no
//      overrides and no builtUp: no notice. No console errors.
//   node tests/smoke/steel-beam-builtup.mjs [--file <tool html>]
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FILE = path.resolve(REPO, arg('file', 'Steel Beam Design - AISC 15th.html'));
const OVR = { d: 24, bf: 12, tf: 0.5, tw: 0.4375, kdes: 0.5, hClear: 23, A: 22.06, Ix: 2101, Zx: 198.9, Sx: 175.0, rx: 9.758, Iy: 144.2, Zy: 37.10, Sy: 24.03,
  ry: 2.556, J: 1.642, Cw: 19900, rts: 3.111, ho: 23.5, Wno: 70.5, Sw1: 105.8, Qf: 70.5, Qw: 99.43, Wt: 75.07 };
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };

const { b, p, errs } = await openPage(FILE);
const ready = async () => { await p.waitForFunction(() => typeof AN !== 'undefined' && AN && typeof SBPL !== 'undefined' && SBPL); await p.waitForTimeout(700); };
await ready();
const tab = async t => { await p.evaluate(t => [...document.querySelectorAll('#tabBar button')].find(x => x.textContent.trim() === t).click(), t); await p.waitForTimeout(t === 'Report' ? 2500 : 900); };
const st = () => p.evaluate(() => { const c = re => AN.design.checks.find(x => re.test(x.name || x.label || x.id || ''));
  return { S: S.section.builtUp, AN: AN.sect._built, auto: (JSON.parse(localStorage.getItem('sbd_autosave_v1') || '{}').section || {}).builtUp,
    box: document.querySelector('[data-fkey=bltUp]').checked, V: +(+c(/^Shear Vₓ/).cap).toFixed(2), M: +(+c(/^Flexure Mₓ/).cap).toFixed(2) }; });
// the input tab that holds Section & Material (inSect) is shown before its checkbox is clicked
const tick = async () => { await p.evaluate(() => { const pn = document.querySelector('[data-secid="inSect"]').closest('.sbdInPane'); document.getElementById(pn.id.replace('sbdInPane_', 'sbdInTab_')).click(); }); await p.click('[data-fkey=bltUp]'); };
const BU = { S: true, AN: true, auto: true, box: true, V: 283.5, M: 672.75 };

// 1
await p.evaluate(o => { S.section = { family: 'W', label: 'W24X55', grade: 'A572_50', builtUp: false, ovr: o }; fullRebuild(); }, OVR);
await p.waitForTimeout(500);
await tick(); await p.waitForTimeout(900);
assert.deepEqual(await st(), BU);
ok('built-up welded I: phiVn 283.5 kip, phiMn 672.75 kip-ft, S / AN / autosave / box built-up');
// 2
for (const t of ['Validation', 'User Manual', 'Report']) {
  await tab(t);
  if (t === 'Report') { const txt = await p.evaluate(() => document.getElementById('tabPages').innerText); assert.ok(txt.includes('283.5') && !/\b315\.0?\b/.test(txt), 'Report shows the built-up phiVn'); }
  await tab('Summary');
  assert.deepEqual(await st(), BU, 'after ' + t);
  ok(t + ' tab, then Summary: still built-up' + (t === 'Report' ? ' (the Report shows phiVn 283.5)' : ''));
}
// 3
const L0 = await p.evaluate(() => S.geom.spans[0].L);
await p.evaluate(() => { const i = document.querySelector('[data-fkey=spanL0]'); i.value = '24'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
await p.waitForTimeout(1200);
assert.equal(await p.evaluate(() => S.geom.spans[0].L), 24); assert.equal((await st()).S, true);
await p.keyboard.press('Control+z'); await p.waitForTimeout(900);
assert.equal(await p.evaluate(() => S.geom.spans[0].L), L0); assert.deepEqual(await st(), BU);
await p.keyboard.press('Control+y'); await p.waitForTimeout(900);
assert.equal(await p.evaluate(() => S.geom.spans[0].L), 24); assert.equal((await st()).S, true); assert.equal((await st()).V, 283.5);
ok('edit (span 24 ft), Undo, Redo: built-up kept');
await p.evaluate(() => { const pb = SharedProjectsUI.bars[0]; pb.saveAs(); const d = document.querySelector('dialog.spSave[open]'); d.querySelector('.spName').value = 'BU girder'; d.querySelector('[data-sa=ok]').click(); });
await p.waitForTimeout(400);
assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('sbd_projects_v1'))['BU girder'].d.section.builtUp), true);
const [dl] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => sbExportJSON('bu'))]);
const ex = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
assert.equal(ex.section.builtUp, true); assert.deepEqual(ex.section.ovr, OVR);
ok('Save as "BU girder" and Export JSON: section.builtUp true, overrides intact');
await p.reload(); await ready();
assert.deepEqual(await st(), { ...BU, auto: true });
ok('reload: built-up restored from the autosave, box ticked, phiVn 283.5');
// 4
const lost = { v: 2, section: { family: 'W', label: 'W24X55', grade: 'A572_50', ovr: OVR } };
const plain = { v: 2, section: { family: 'W', label: 'W21X44', grade: 'A992', ovr: {} } };
await p.evaluate(([a, c]) => { const pr = JSON.parse(localStorage.getItem('sbd_projects_v1')); pr['Lost flag'] = { t: 1, d: a }; pr['Plain'] = { t: 2, d: c }; localStorage.setItem('sbd_projects_v1', JSON.stringify(pr)); }, [lost, plain]);
const before = await p.evaluate(() => localStorage.getItem('sbd_projects_v1'));
const openP = async nm => { await p.evaluate(() => { const d = document.getElementById('sbLibDlg'); if (d && d.open) d.close(); document.querySelector('[data-sp=chip]').click(); document.querySelector('#sbSaveCard [data-sp=lib]').click(); }); await p.waitForTimeout(300);   // HDRS (#891): chip → Project tab → the card's Saved projects…
  await p.evaluate(nm => document.querySelector(`#sbLibDlg [data-spa=open][data-n="${CSS.escape(encodeURIComponent(nm))}"]`).click(), nm); await p.waitForTimeout(900); };
const note = () => p.evaluate(() => [...document.querySelectorAll('.warnBox')].some(x => /saved without the built-up setting/.test(x.textContent)));
await openP('Lost flag');
assert.equal(await note(), true); const s4 = await st(); assert.equal(s4.S, false); assert.equal(s4.AN, false); assert.equal(s4.V, 315);
assert.equal(await p.evaluate(() => localStorage.getItem('sbd_projects_v1')), before, 'stored projects unchanged');
ok('a save without builtUp (overridden I-shape): opens as rolled (phiVn 315, as before), notice shown, stored item unchanged');
await tick(); await p.waitForTimeout(900);
assert.equal(await note(), false); assert.equal((await st()).V, 283.5);
ok('ticking Built-up clears the notice (phiVn 283.5)');
await openP('Plain');
assert.equal(await note(), false);
ok('a rolled save without overrides and without builtUp: no notice');
assert.deepEqual(errs, []);
ok('no console errors');
await b.close();
console.log(`steel-beam-builtup: ${n} checks passed`);
