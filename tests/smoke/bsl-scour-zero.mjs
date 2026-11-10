#!/usr/bin/env node
// Bridge Substructure Loading (SubLoads): an entered scour El. of 0.0 is El. 0.0, only a blank scour El. means the ground line
// (SCZ, engineer decision 2026-11-10). waterCase (stream pressure, AASHTO LRFD 10th Ed. 3.7.3) used `nz(scour) || ground`, so 0.0
// became the ground line; scourDrop already took num() (0.0 real). Hand check, default project, Pier 1 (multi-column bent on a
// footing: ground El. 104.5, top of footing El. 101.0, bottom El. 97.0, three round columns D = 3.5 ft, footing 14 ft normal to
// the flow), design flood WSE 110.0, V = 8 ft/s, flow along the line (C_L = 0):
//   column p = 0.7 × 8² / 1000 = 0.0448 ksf; footing p = 1.4 × 8² / 1000 = 0.0896 ksf
//   scour blank (and main with 0.0): wetted column 110.0 − 104.5 = 5.5 ft → 0.0448 × 3.5 × 5.5 = 0.862 kip each; footing 0
//   scour 0.0 (branch):              wetted column 110.0 − 101.0 = 9.0 ft → 1.411 kip each; footing 4.0 ft → 0.0896 × 14 × 4 = 5.018 kip
//   buoyancy unchanged (column 5.403 kip each, footing 154.943 kip); Strength I V_t max, bottom of footing 40.461 → 47.125 kip
// Also: the check flood with a blank scour stays at the ground line; the Water tab and the Units pane carry the note; 0 console errors.
//   node tests/smoke/bsl-scour-zero.mjs
import assert from 'assert/strict';
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

const FILE = process.env.BSL_FILE || path.join(REPO, 'Bridge Substructure Loading.html');
let fails = 0;
const ok = async (m, f) => { try { await f(); console.log('  ok   ' + m); } catch (e) { fails++; console.log('  FAIL ' + m + ': ' + String(e.message).slice(0, 400)); } };
const near = (a, b, t, m) => assert.ok(Math.abs(a - b) <= t, `${m}: ${a} vs ${b}`);

const { b, p, errs } = await openPage(FILE);
try {
  await p.waitForFunction(() => typeof MODEL !== 'undefined' && MODEL && MODEL.G); await p.waitForTimeout(800);
  const run = scour => p.evaluate(async scour => {
    const u = P.units[1]; fillWater(u); Object.assign(u.water, { on: 'yes', wse: 110, v: 8, scour, wseC: 112, vC: 10, scourC: '' }); recompute();
    const d = waterCase(MODEL.G, MODEL.UG, 1, 'd', 1), c = waterCase(MODEL.G, MODEL.UG, 1, 'c', 1), defs = unitRes(1).UM.defs, q = defs.findIndex(x => x.label === 'V<sub>t</sub>, bottom of footing');
    P.ui.sel = 1; showTab('water'); await new Promise(r => setTimeout(r, 200));
    return { zs: d.zs, zc: c.zs, parts: d.parts.map(x => ({ nm: x.nm, h: x.h, Fl: x.Fl, up: x.up })), V: combine(1).StrI.max[q], txt: document.getElementById('tab-water').innerText, ic: SubLoadsInputCheck.collect().length };
  }, scour);
  const blank = await run(''), zero = await run(0), zeroTxt = await run('0.0');
  await ok('blank design scour: ground line El. 104.5, columns 5.5 ft wet, 0.862 kip each, footing dry', async () => {
    assert.equal(blank.zs, 104.5); assert.equal(blank.zc, 104.5); const cols = blank.parts.filter(x => /^Column/.test(x.nm)); assert.equal(cols.length, 3);
    cols.forEach(x => { near(x.h, 5.5, 1e-9, 'h'); near(x.Fl, 0.0448 * 3.5 * 5.5, 1e-9, 'Fl'); near(x.up, 5.403, 0.001, 'buoyancy'); });
    const f = blank.parts.find(x => x.nm === 'Footing'); assert.equal(f.Fl, 0); near(f.up, 154.943, 0.001, 'footing buoyancy');
    near(blank.V, 40.461, 0.001, 'Strength I V_t');
  });
  for (const [nm, r] of [['0', zero], ['"0.0"', zeroTxt]]) await ok(`design scour ${nm}: El. 0.0, columns 9.0 ft wet (1.411 kip), footing 4.0 ft (5.018 kip), buoyancy unchanged`, async () => {
    assert.equal(r.zs, 0); assert.equal(r.zc, 104.5, 'check flood (blank) stays at the ground'); assert.equal(r.ic, 0);
    r.parts.filter(x => /^Column/.test(x.nm)).forEach(x => { near(x.h, 9, 1e-9, 'h'); near(x.Fl, 0.0448 * 3.5 * 9, 1e-9, 'Fl'); near(x.up, 5.403, 0.001, 'buoyancy'); });
    const f = r.parts.find(x => x.nm === 'Footing'); near(f.h, 4, 1e-9, 'footing h'); near(f.Fl, 0.0896 * 14 * 4, 1e-9, 'footing Fl'); near(f.up, 154.943, 0.001, 'footing buoyancy');
    near(r.V, 47.125, 0.001, 'Strength I V_t'); assert.match(r.txt, /scour to El\. 0\.00/);
  });
  await ok('§6 note on the Water tab and the Units pane', async () => {
    assert.match(zero.txt, /blank scour elevation means the ground line \(El\. 104\.50\); an entered 0\.0 is El\. 0\.0/);
    const side = await p.evaluate(async () => { P.ui.sel = 1; P.ui.itab = 'units'; buildSide(); return document.getElementById('sidebar').innerText; });
    assert.match(side, /an entered 0\.0 is El\. 0\.0, not blank/);
  });
  await ok('0 console errors', () => assert.deepEqual(errs, []));
} finally { await b.close(); }
if (fails) { console.log(`${fails} failure(s)`); process.exit(1); }
console.log('all passed');
