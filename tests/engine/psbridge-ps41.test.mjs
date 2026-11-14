// apps/ps-bridge PS-41 (engineer decision 2026-11-14): a MassDOT section defaults to the MassDOT strand row heights (engine/sections.js
// rowGrid / applyRows / rowNote / extrapText; ui/inputs.js onChange; report/builders.js rowNotes):
//   (1) the grid: boxes and deck beams 2.25 / 4.25 / 6.25 in (dwg 9.3.7 / 9.3.8, 10.2.7 / 10.2.8, 10.1.7 / 10.1.8), NEBT / NEDBT / NEXT 2.5 /
//       4.5 / 6.5 in (dwg 9.1.6, 11.1.7, 9.2.5, 11.2.7); CTDOT and the old library: none (the rows as entered);
//   (2) choosing a MassDOT section on the Girders & strands tab moves the rows (in order of height; counts and debonding kept), with a notice;
//       a girder type's own section too (its override); a CTDOT section moves nothing;
//   (3) the sheets' bottom rows fit (PS-28 / PS-39) at those heights;
//   (4) the 48 in box flag: on the tab (#mdRowNote) and in the Report §2 assumptions; not for a 36 in box.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const ENG = ['sections', 'model', 'rigid', 'lldf-fg', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'legacy', 'worked', 'worked-stress', 'worked-strength', 'worked-end', 'worked-hdr'].map(n => path.join(APP, `engine/${n}.js`));
const UI = ['outkit', 'vizkit', 'strands', 'section', 'inputs'].map(n => path.join(APP, `ui/${n}.js`));
const W = loadShared('steps.js', ...PBD, ...ENG, ...UI, 'report.js', ...['fromtab', 'data', 'builders'].map(n => path.join(APP, `report/${n}.js`)));
const S = W.PSBSections, J = v => JSON.parse(JSON.stringify(v));
const rows = (...q) => q.map(([n, y, nd, dbnd]) => ({ n, y, nd: nd || 0, dbnd: dbnd || 0 }));
const change = (P, girder) => { const el = { dataset: { path: 'base.girder', kind: 'sel' }, value: girder }; assert.equal(W.PSBInputsUI.onChange(el, P), true); return W.PSBInputsUI.takeNote(); };

test('PS-41 (1): the row grid of each MassDOT family; none for CTDOT and the old library', () => {
  S.ORDER_MD.forEach(n => { const r = S.rowGrid(n), f = S.MD[n].src.fam;
    assert.equal(r.first, ['nebt', 'nedbt', 'nextf', 'nextd'].includes(f) ? 2.5 : 2.25, n); assert.equal(r.step, 2);
    assert.equal(r.extrap, (f === 'adj' || f === 'spread') && /B48/.test(n), n); assert.equal(r.dwg, S.MD[n].src.strands.dwg); });
  assert.deepEqual(J(S.rowGrid('MassDOT B36-27 adj.')), { first: 2.25, step: 2, dwg: '10.2.7', page: 226, extrap: false });
  assert.deepEqual(J(S.rowGrid('MassDOT B48-42 spread')), { first: 2.25, step: 2, dwg: '9.3.8', page: 157, extrap: true });
  assert.deepEqual(J(S.rowGrid('MassDOT NEBT 1400')), { first: 2.5, step: 2, dwg: '9.1.6', page: 93, extrap: false });
  ['PCI BT-72', 'NEXT 36F', 'AASHTO BIII-36 (39in)', 'AASHTO SIV-48 (21in)', 'Deck slab 12×48 (solid)', 'Custom'].forEach(n => { assert.equal(S.rowGrid(n), null, n); assert.equal(S.rowNote(n), '', n); assert.equal(S.extrapText(n), '', n); });
});

test('PS-41 (2): choosing a MassDOT section moves the rows (order of height, counts and debonding kept) with a notice; CTDOT none; a girder type too', () => {
  const P = W.PSBModel.newProject(); P.base.rows = rows([10, 4], [12, 2, 2, 10], [6, 6]);
  const t = change(P, 'MassDOT B36-27 adj.');
  assert.deepEqual(J(P.base.rows), J(rows([10, 4.25], [12, 2.25, 2, 10], [6, 6.25])));
  assert.equal(t, 'Strand rows moved to the MassDOT row heights of MassDOT B36-27 adj. (PS-41: the bottom row 2.25 in above the soffit, then every 2 in; dwg 10.2.7, p. 226): row 1 y = 4 → 4.25 in, row 2 y = 2 → 2.25 in, row 3 y = 6 → 6.25 in. The counts are kept: check the strand fit on the Girders & strands tab.');
  assert.equal(change(P, 'MassDOT B36-30 adj.'), '', 'already on the grid: nothing');
  const t2 = change(P, 'MassDOT NEBT 1200'); assert.deepEqual(J(P.base.rows.map(r => r.y)), [4.5, 2.5, 6.5]); assert.match(t2, /row 1 y = 4.25 → 4.5 in/);
  const t3 = change(P, 'MassDOT B48-27 spread'); assert.match(t3, /The MassDOT strand pattern sheets for box beams \(dwg 9\.3\.7, p\. 156\) draw the 36 in box: the strand pattern of this 48 in box .* is extrapolated from that sheet/);
  const y0 = J(P.base.rows); assert.equal(change(P, 'AASHTO BIII-36 (39in)'), ''); assert.deepEqual(J(P.base.rows), y0, 'CTDOT: the rows as entered');
  assert.equal(change(P, 'PCI BT-72'), ''); assert.deepEqual(J(P.base.rows), y0);
  // a girder type's own section (the page's type scope: the view's base, then PSBBridge.setOvr)
  const Q = W.PSBModel.newProject(); Q.base.rows = rows([10, 2], [10, 4]);
  const v = Object.assign({}, Q, { base: W.PSBBridge.effBase(Q, 0) });   // index.html viewOf(k)
  change(v, 'MassDOT NEXT 28D'); W.PSBBridge.setOvr(Q, 0, v.base);
  assert.equal(Q.types[0].ovr.girder, 'MassDOT NEXT 28D'); assert.deepEqual(J(Q.types[0].ovr.rows.map(r => r.y)), [2.5, 4.5]); assert.deepEqual(J(Q.base.rows.map(r => r.y)), [2, 4], 'the base design unchanged');
});

test('PS-41 (3): the sheets\' bottom rows fit at the MassDOT heights (no strand-fit error)', () => {
  const fit = (girder, rs, S_) => { const P = W.PSBModel.newProject(); P.base.girder = girder; P.base.rows = rows(...rs); P.base.harp.n = 0; P.types.forEach(T => { T.ovr = {}; });
    const e = S.MD[girder]; P.base.ts = e.box || e.deck ? 0 : 8; P.xs.bays = Array(4).fill(S_ || (e.box || e.deck ? e.w / 12 : 9)); P.spans.lengths = [60];
    return J(W.PSBInputCheck.collect(P).errors).filter(x => /do not fit/.test(x.msg)).map(x => x.msg); };
  // adjacent / spread boxes: 16 (36 in) / 22 (48 in) at 2.25 in, 14 / 20 at 4.25 in (dwg 10.2.7, 9.3.7: 2¾ in to the outer face)
  ['MassDOT B36-27 adj.', 'MassDOT B36-42 adj.', 'MassDOT B36-27 spread', 'MassDOT B36-45 spread'].forEach(n => assert.deepEqual(fit(n, [[16, 2.25], [14, 4.25]]), [], n));
  ['MassDOT B48-27 adj.', 'MassDOT B48-48 adj.', 'MassDOT B48-30 spread'].forEach(n => assert.deepEqual(fit(n, [[22, 2.25], [20, 4.25]]), [], n));
  // deck beams: S36-12 16 strands at 2.25 and 4.25 in; S48-21 22 at 2.25 in
  assert.deepEqual(fit('MassDOT S36-12', [[16, 2.25], [16, 4.25]]), []); assert.deepEqual(fit('MassDOT S48-21', [[22, 2.25]]), []);
  // NEBT / NEDBT: 14 at 2.5 and 4.5 in (2.95 in to the bottom flange edge, dwg 9.1.6 / 11.1.7); NEXT D / F: 10 a row (5 a stem) at 2.5 / 4.5 in
  ['MassDOT NEBT 1000', 'MassDOT NEDBT 64'].forEach(n => assert.deepEqual(fit(n, [[14, 2.5], [14, 4.5]]), [], n));
  ['MassDOT NEXT 28D', 'MassDOT NEXT 36F'].forEach(n => assert.deepEqual(fit(n, [[10, 2.5], [10, 4.5]], n === 'MassDOT NEXT 28D' ? 109 / 12 : 8), [], n));
});

test('PS-41 (4): the 48 in box flag on the Girders & strands tab and in the Report §2; the 36 in box: the heights only', () => {
  const tab = girder => { const P = W.PSBModel.newProject(); P.base.girder = girder; P.base.ts = 0; P.base.harp.n = 0; P.base.rows = rows([16, 2.25]); return { P, h: W.PSBInputsUI.cards('gird', P) }; };
  const a = tab('MassDOT B48-33 adj.').h, b = tab('MassDOT B36-33 adj.').h, c = tab('AASHTO BIII-36 (39in)').h;
  assert.ok(a.includes('id="mdRowNote">MassDOT strand rows (PS-41): the bottom row 2.25 in above the soffit and the rows above every 2 in (2.25 / 4.25 / 6.25 in), as on dwg 10.2.7 (p. 226)'), 'heights');
  assert.ok(a.includes('<b>The MassDOT strand pattern sheets for box beams (dwg 10.2.7, p. 226) draw the 36 in box: the strand pattern of this 48 in box'), '48 in flag');
  assert.ok(b.includes('id="mdRowNote"') && !b.includes('draw the 36 in box'), '36 in: no flag');
  assert.ok(!c.includes('mdRowNote'), 'CTDOT: none');
  const { P } = tab('MassDOT B48-33 adj.'); P.types.forEach(T => { T.ovr = {}; }); P.xs.bays = Array(4).fill(47.5 / 12);
  const B = W.PSBReportData.compute(P, null, 'gov'); assert.equal(B.err, '');
  const at = JSON.stringify(W.PSBReportBuild.model(B, {}).sections.find(q => q.id === 'proj').subs.find(q => /Assumptions/.test(q.title)).items);
  assert.ok(at.includes('MassDOT B48-33 adj.: The MassDOT strand pattern sheets for box beams (dwg 10.2.7, p. 226) draw the 36 in box') && at.includes('(see [[rs.sec]])'), at.slice(0, 300));
});
