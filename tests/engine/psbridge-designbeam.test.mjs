// apps/ps-bridge batch F3 (2026-11-15): the old app's "Design beam" chip, read only (engine/handoffs.js dbState).
//   The shared keys bridgeSuite.v1.designBeam / beamRoster are read as the old page's BridgeBeam reads them (its own code, cut from
//   "Prestressed Bridge Design.html" and run on the same stored texts): get(), roster() and mismatch(nb) give the same answers; the line
//   of the beam's number, its girder type in the span shown, the interior / exterior class against the line's position.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', ...PBDF, ...['sections', 'model', 'rigid', 'lldf-fg', 'reltension', 'holddown', 'pierblock', 'demands', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'handoffs'].map(n => path.join(APP, `engine/${n}.js`)));
const M = W.PSBModel, H = W.PSBHandoffs;

// the old page's BridgeBeam (its IIFE, from `(function(){` before `var NS='bridgeSuite.v1', K_SEL` to its window.addEventListener line)
const OLD = fs.readFileSync(path.join(ROOT, 'Prestressed Bridge Design.html'), 'utf8');
function oldBB(store) {
  const a = OLD.indexOf("var NS='bridgeSuite.v1', K_SEL=NS+'.designBeam'"), i = OLD.lastIndexOf('(function(){', a), j = OLD.indexOf("window.addEventListener('storage',function(e){ if(!e.key||e.key===K_SEL", i);
  assert.ok(i > 0 && j > a, 'old BridgeBeam anchors');
  const C = { localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)) }, JSON, Math, Object };
  C.window = C; vm.createContext(C); vm.runInContext(OLD.slice(i, j) + '})();', C); return C.BridgeBeam;
}
const roster = nb => ({ _schema: 'bridge-beam-roster', schemaVersion: 1, Nb: nb, producer: 'LL & DL Distribution',
  beams: Array.from({ length: nb }, (_, k) => ({ i: k + 1, label: 'B' + (k + 1), type: k === 0 || k === nb - 1 ? 'ext' : 'int', cls: k === 1 ? 'first-int' : k === 0 || k === nb - 1 ? 'ext-curb' : 'interior', clsLabel: k === 1 ? '1st interior roadway beam' : '' })) });
const sel = (i, nb, type) => ({ _schema: 'bridge-design-beam', schemaVersion: 1, index: i, label: 'B' + i, type, clsLabel: '', Nb: nb, setBy: 'LL & DL' });

test('dbState = the old page\'s BridgeBeam on the same keys (get, roster, mismatch); the line, its type, the class check', () => {
  const P = M.newProject(), nb = P.xs.nb;
  const cases = [['nothing', {}], ['roster only', { r: roster(nb) }], ['beam 2, same count', { r: roster(nb), s: sel(2, nb, 'int') }], ['beam 1 exterior', { r: roster(nb), s: sel(1, nb, 'ext') }],
    ['count differs', { r: roster(nb + 1), s: sel(2, nb + 1, 'int') }], ['class differs', { r: roster(nb), s: sel(3, nb, 'ext') }], ['no roster', { s: sel(2, null, 'int') }],
    ['newer version (unreadable)', { s: Object.assign(sel(2, nb, 'int'), { schemaVersion: 2 }) }], ['wrong schema', { s: Object.assign(sel(2, nb, 'int'), { _schema: 'x' }) }]];
  for (const [nm, c] of cases) {
    const st = new Map(); if (c.r) st.set('bridgeSuite.v1.beamRoster', JSON.stringify(c.r)); if (c.s) st.set('bridgeSuite.v1.designBeam', JSON.stringify(c.s));
    const BB = oldBB(st), d = H.dbState(P, k => st.has(k) ? st.get(k) : null);
    const J = v => v == null ? null : JSON.parse(JSON.stringify(v)), og = J(BB.get()), orr = J(BB.roster()), om = J(BB.mismatch(nb));
    if (!og && !orr) { assert.equal(d, null, nm); continue; }
    assert.deepEqual(JSON.parse(JSON.stringify(d.sel)), og, nm + ' sel'); assert.deepEqual(JSON.parse(JSON.stringify(d.roster)), orr, nm + ' roster');
    assert.deepEqual(d.mismatch ? JSON.parse(JSON.stringify(d.mismatch)) : null, om, nm + ' mismatch');
    if (nm === 'beam 2, same count') { assert.equal(d.g, 2); assert.equal(d.pos, 'interior'); assert.equal(d.posWarn, false); assert.equal(W.PSBBridge.types(P)[d.k].lines.includes(2), true); }
    if (nm === 'beam 1 exterior') { assert.equal(d.g, 1); assert.equal(d.pos, 'exterior'); assert.equal(d.posWarn, false); }
    if (nm === 'count differs') assert.equal(d.g, null);
    if (nm === 'class differs') { assert.equal(d.g, 3); assert.equal(d.posWarn, true); assert.equal(d.theirs, 'exterior'); }
  }
});
