// apps/ps-bridge batch G4 (2026-11-15): the Compare tab (engine/compare.js, ui/compare.js), the old app's design sweep (O:8009-8034).
//   (1) presets = the old tab's; (2) for a design the app's engine additions do not touch (AASHTO, equal bays, I-girder, the PS-10 box off)
//   run() = the frozen sweepDesign field by field, in every mode (the same input changes and the same core checks); (3) with the PS-10 check
//   on, the candidate's ratios are the app's engine call's (PSBHoldDown.compute: the hold-down check in Max D/C); (4) spacing drops the
//   unequal-bay rigidX; (5) the tab's HTML: table rows, this design marked, the strand-fit column in the girder sweep.
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', ...PBD, ...['sections', 'model', 'rigid', 'lldf-fg', 'reltension', 'holddown', 'pierblock', 'demands', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'compare'].map(n => path.join(APP, `engine/${n}.js`)),
  ...['vizkit', 'vizalong', 'outkit', 'strands', 'compare'].map(n => path.join(APP, `ui/${n}.js`)));
const plain = o => JSON.parse(JSON.stringify(o));
const base = () => { const P = W.PSBModel.defaultProject(); P.base.opt.hdCheck = false; return P; };

test('G4: the presets are the old tab\'s (span L ± 10, ± 20; every library girder but Custom; spacing S ± 0.5, ± 1)', () => {
  const inp = W.PSBDesign.inputs(base()), C = W.PSBCompare;
  assert.deepEqual(plain(C.presets(inp, 'span')), [inp.L - 20, inp.L - 10, inp.L, inp.L + 10, inp.L + 20]);
  assert.deepEqual(plain(C.presets(inp, 'spacing')), [inp.S - 1, inp.S - 0.5, inp.S, inp.S + 0.5, inp.S + 1]);
  assert.deepEqual(plain(C.presets(inp, 'girder')), plain(vm.runInContext('Object.keys(GIRDERS)', W).filter(k => k !== 'Custom')));
  assert.deepEqual(plain(C.presets(Object.assign({}, inp, { L: 35, S: 3.6 }), 'span')), [25, 35, 45, 55]); assert.deepEqual(plain(C.presets(Object.assign({}, inp, { L: 30 }), 'span')), [30, 40, 50]);
});

test('G4: where the app\'s engine additions do not apply, run() = sweepDesign (span, spacing; girder for the I-girder sections)', () => {
  const inp = W.PSBDesign.inputs(base()), C = W.PSBCompare;
  inp.opt.relBondedReinf = false;   // EZX (2026-11-25): with the bonded release steel the app's T is the exact sum (engine/reltension.js), an addition
  for (const mode of ['span', 'spacing']) {
    const v = C.presets(inp, mode), a = plain(C.run(inp, mode, v)), b = plain(W.sweepDesign(inp, mode, v));
    assert.deepEqual(a.map(({ gov, fails, ...r }) => r), b, mode);
  }
  const iG = C.presets(inp, 'girder').filter(n => { const g = vm.runInContext('GIRDERS', W)[n]; return g && !g.box && !g.deck && !g.next; }).slice(0, 12);
  assert.deepEqual(plain(C.run(inp, 'girder', iG)).map(({ gov, fails, ...r }) => r), plain(W.sweepDesign(inp, 'girder', iG)), 'girder (I sections)');
});

test('G4: the app\'s engine call: the PS-10 hold-down check is a core check of each candidate (default design: F_hd / limit 1.276 fails and is counted)', () => {
  const P = W.PSBModel.defaultProject(), inp = W.PSBDesign.inputs(P), C = W.PSBCompare;
  const row = C.one(inp, 'span', inp.L), R = W.PSBHoldDown.compute(inp), core = R.checks.filter(c => !/Deck|Lifting|Hauling|FS/.test(c.n));
  assert.equal(row.nTot, core.length); assert.ok(core.some(c => c.n === 'Hold-down force (PS-10)'));
  assert.equal(row.maxDC, Math.max(...core.map(c => c.r))); assert.equal(row.pass, core.every(c => c.pass));
  assert.ok(row.fails.includes('Hold-down force (PS-10)'), 'the default design fails PS-10 (ratio 1.276)');
  const raw = W.sweepDesign(inp, 'span', [inp.L])[0]; assert.equal(raw.nTot, row.nTot - 1, 'sweepDesign alone does not see it');
});

test('G4: spacing: equal bays at S (the unequal-bay rigidX dropped); span and girder keep it', () => {
  const C = W.PSBCompare, inp = { L: 100, S: 8, girder: 'PCI BT-72', rigidX: { x: [0, 8, 17], g: 1 } };
  assert.equal(C.inputsOf(inp, 'spacing', 9).rigidX, undefined); assert.equal(C.inputsOf(inp, 'spacing', 9).S, 9);
  assert.ok(C.inputsOf(inp, 'span', 90).rigidX); assert.equal(C.inputsOf(inp, 'girder', 'AASHTO Type IV').girder, 'AASHTO Type IV');
  assert.ok(inp.rigidX && inp.S === 8, 'the inputs are not changed');
});

test('G4: the tab: rows, this design marked, the strand-fit column of the girder sweep; out of date after an input change', () => {
  const P = W.PSBModel.defaultProject(), inp = W.PSBDesign.inputs(P), R = W.PSBHoldDown.compute(inp), U = W.PSBUiCompare;
  const ctx = { P, inp, R, W: {}, ui: { cmpMode: 'span' } };
  assert.ok(/Run sweep/.test(U.output(ctx)) && /id="cmpNone"/.test(U.output(ctx)));
  U.runNow(ctx); let h = U.output(ctx);
  assert.equal((h.match(/<tr/g) || []).length, 1 + 5); assert.ok(h.includes('120.0 ft <b>(this design)</b>')); assert.ok(!/cmpStale/.test(h));
  assert.ok(h.includes('id="gfx_cmp"') && /Hold-down force \(PS-10\)/.test(h));
  ctx.ui.cmpMode = 'girder'; U.runNow(ctx); h = U.output(ctx);
  assert.ok(/<th class="lft">Strand fit<\/th>/.test(h) && /PCI BT-72 <b>\(this design\)<\/b>/.test(h));
  const fit = U.state.fit, names = W.PSBCompare.presets(inp, 'girder'), i72 = names.indexOf('PCI BT-72');
  assert.deepEqual(plain(fit[i72]), [], 'the design\'s own strands fit'); assert.ok(fit.some(f => f.length > 0), 'some sections do not fit the strands');
  const ctx2 = Object.assign({}, ctx, { inp: Object.assign({}, inp, { L: 110 }) });
  assert.ok(/id="cmpStale"/.test(U.output(ctx2)), 'out of date');
});
