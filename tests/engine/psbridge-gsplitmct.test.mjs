// apps/ps-bridge batch G7 / G9 (2026-11-15). G7: the End zone tab's splitting steel orientation figure for slabs and box beams (the old app
//   showed AASHTO Fig. C5.9.4.4.1-2, O:7544-7547; drawn here from the section): the slot only for a slab or a box; a slab drawn with
//   horizontal bars across the width, a box with vertical legs in the webs (the engine's R.splitDir), the end region h/4 = R.splitZone with
//   the provided count; nothing computed (R unchanged). G9: "↩ MCT Analysis" (the old app's bridgeNav(null)): shown only when the page was
//   opened from the MCT Generator (framed, opened from ../../index.html, or #from=mct); framed: the old message to the parent, else the MCT's file.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', ...PBD, ...['sections', 'model', 'rigid', 'lldf-fg', 'holddown', 'pierblock', 'design', 'bridge', 'fields', 'inputcheck', 'worked', 'worked-stress', 'worked-strength', 'worked-end', 'worked-hdr'].map(n => path.join(APP, `engine/${n}.js`)),
  ...['vizkit', 'vizalong', 'outkit', 'endzone', 'mctnav'].map(n => path.join(APP, `ui/${n}.js`)));
const design = (girder, o) => { const P = W.PSBModel.defaultProject(); Object.assign(P.base, { girder, ...(o || {}) }); const inp = W.PSBDesign.inputs(P); return { P, inp, R: W.PSBHoldDown.compute(inp) }; };
const BOX = { ts: 6, harp: { n: 0, yEnd: 8, yMid: 4, frac: 0.4 }, rows: [{ n: 10, y: 2, nd: 0, dbnd: 0 }] };
const ctxOf = d => ({ P: d.P, inp: d.inp, R: d.R, W: { endzone: W.PSBWorkedEnd.endzone(d.inp, d.R) }, ui: {} });

test('G7: the orientation figure slot only for a slab or a box; drawn in the engine\'s direction with h/4 and the provided count', () => {
  for (const [girder, o, has, dir] of [['AASHTO SIV-48 (21in)', BOX, true, 'width'], ['AASHTO BIII-36 (39in)', BOX, true, 'height'], ['PCI BT-72', null, false, 'height']]) {
    const d = design(girder, o), R0 = JSON.stringify(d.R), html = W.PSBUiEndZone.output(ctxOf(d));
    assert.equal(html.includes('id="gfx_ezsplit"'), has, girder); assert.equal(d.R.splitDir, dir, girder);
    if (!has) continue;
    const f = W.PSBUiEndZone.splitFig(d.R, d.inp, 700).html, t = f.replace(/<[^>]+>/g, ' ');
    assert.ok(t.includes(`h/4 = ${(d.R.splitZone).toFixed(1)} in`), girder + ' h/4');
    assert.ok(new RegExp(dir === 'width' ? 'Plan of the end region' : 'Side view of the end region').test(t), girder);
    assert.ok(/End face \(at the member end\)/.test(t), girder);
    const blue = (f.match(/stroke="#1D4ED8"/g) || []).length, nLeg = Math.round(+d.inp.opt.splitN || 0);
    assert.ok(blue >= Math.min(nLeg, 40) + 2, `${girder}: ${blue} blue bars`);
    assert.equal(JSON.stringify(d.R), R0, 'R unchanged');
  }
});

test('G9: "↩ MCT Analysis" shown only when opened from the MCT Generator; framed: the old message, else the MCT file', () => {
  const N = W.PSBMctNav;
  const win = o => { const w = { location: { search: '', hash: '', href: '' }, document: { referrer: '' }, opener: null, posted: [], ...o }; w.self = w; w.top = o && o.top ? o.top : w; w.parent = { postMessage: (m, t) => w.posted.push([m, t]) }; return w; };
  assert.equal(N.fromMct(win()), '', 'opened directly');
  assert.equal(N.fromMct(win({ top: {} })), 'frame');
  assert.equal(N.fromMct(win({ document: { referrer: 'file:///C:/Bridge/All-Structural/index.html' } })), 'tab');
  assert.equal(N.fromMct(win({ document: { referrer: 'file:///C:/Bridge/All-Structural/apps/steel-bridge/index.html' } })), '', 'another app\'s index.html');
  assert.equal(N.fromMct(win({ document: { referrer: 'file:///C:/Bridge/All-Structural/tools.html' } })), '', 'the tools list');
  assert.equal(N.fromMct(win({ location: { search: '', hash: '#from=mct' } })), 'tab');
  assert.equal(N.fromMct(win({ opener: { location: { get href() { throw new Error('blocked'); } } } })), '', 'an opener that cannot be read');
  const f = win({ top: {} }); assert.equal(N.back(f, 'frame'), 'message'); assert.deepEqual(JSON.parse(JSON.stringify(f.posted)), [[{ source: 'bridge-suite', embed: null }, '*']]);
  const t = win(); assert.equal(N.back(t, 'tab'), 'navigate'); assert.equal(t.location.href, '../../index.html');
  const btn = { hidden: true }; assert.equal(N.mount(btn, win()), ''); assert.equal(btn.hidden, true);
  assert.equal(N.mount(btn, win({ location: { search: '?from=mct', hash: '' } })), 'tab'); assert.equal(btn.hidden, false); assert.equal(typeof btn.onclick, 'function');
});
