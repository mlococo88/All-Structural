// apps/ps-bridge (2026-11-14, display only): the Flexure tab's pier section (ui/flexure.js pierFig, the negative moment at the pier of a span
//   made continuous; the Report draws the same figure). The compression block is drawn where the engine puts the compression zone:
//   pbd-compute.js a = A_s f_y / (0.85 f′c b_bf) with b_bf = girderGross's bbf: 2B for a NEXT (the two stems), the bottom flange width of an
//   I-girder, the full width w of a box or deck beam. Checked: the block rectangles drawn (class dt-ng, recorded from the drawing kit) —
//   NEXT: two, one at the bottom of each stem (x = ±stemCC/2 ± B/2), none between the stems; every other shape: one, b_bf wide on the ℄;
//   total width = the engine's b_bf, height = the engine's a; the engine's values the same before and after drawing.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared(...PBD, ...['model', 'holddown', 'design'].map(n => path.join(APP, `engine/${n}.js`)), ...['vizkit', 'flexure'].map(n => path.join(APP, `ui/${n}.js`)));

function record(fn) {
  const VK = W.PSBVizKit, s0 = VK.scene, got = [];
  VK.scene = () => { const S = s0(), r0 = S.rect; S.rect = (x0, y0, x1, y1, cls, o) => { if (cls === 'dt-ng') got.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0: Math.min(y0, y1), y1: Math.max(y0, y1) }); return r0(x0, y0, x1, y1, cls, o); }; return S; };
  try { fn(); } finally { VK.scene = s0; }
  return got;
}
function design(girder, o) {
  const P = W.PSBModel.defaultProject(); P.spans = { lengths: [80, 80], continuity: 'composite' }; P.xs.skews = [0, 0, 0];
  Object.assign(P.base, { girder, ...o });
  const inp = W.PSBDesign.inputs(P), R = W.PSBHoldDown.compute(inp); assert.equal(R.error, null, girder); assert.ok(R.cont, girder + ': the pier section'); return { inp, R };
}
const CASES = {
  'NEXT 36F (default bays)': ['NEXT 36F', { ts: 6, harp: { n: 0, yEnd: 24, yMid: 8, frac: 0.4 } }],
  'NEXT 24F (default bays)': ['NEXT 24F', { ts: 6, harp: { n: 0, yEnd: 16, yMid: 8, frac: 0.4 } }],
  'PCI BT-72': ['PCI BT-72', {}],
  'AASHTO Type IV': ['AASHTO Type IV', { harp: { n: 8, yEnd: 44, yMid: 8, frac: 0.4 } }],
  'AASHTO BIII-36': ['AASHTO BIII-36 (27in)', { ts: 6, harp: { n: 0, yEnd: 20, yMid: 8, frac: 0.4 }, rows: [{ n: 16, y: 2, nd: 0, dbnd: 0 }] }]
};
for (const [name, [girder, o]] of Object.entries(CASES)) test(`pier section compression block where the engine's b_bf is: ${name}`, () => {
  const { inp, R } = design(girder, o), G = R.g, c = R.cont, before = JSON.stringify([c.aN, c.cN, c.phiMnN, c.dc, G.bbf]);
  const bl = record(() => W.PSBUiFlexure.pierFig(R, inp, 640));
  const tot = bl.reduce((s, b) => s + (b.x1 - b.x0), 0);
  assert.ok(Math.abs(tot - G.bbf) < 1e-9, `${name}: drawn width ${tot} = the engine's b_bf ${G.bbf}`);
  bl.forEach(b => { assert.equal(b.y0, 0); assert.ok(Math.abs(b.y1 - Math.min(c.aN, G.h)) < 1e-12, `${name}: height = a`); });
  if (G.isNext) {
    const sC = G.next.stemCC / 2, B = G.next.B;
    assert.equal(G.bbf, 2 * B, 'the engine: b_bf = 2B for a NEXT');
    assert.equal(bl.length, 2, `${name}: one block a stem`);
    assert.deepEqual(bl.map(b => [b.x0, b.x1]).sort((a, b) => a[0] - b[0]), [[-sC - B / 2, -sC + B / 2], [sC - B / 2, sC + B / 2]], `${name}: at the stems`);
    assert.ok(bl.every(b => b.x0 >= sC - B / 2 - 1e-9 || b.x1 <= -(sC - B / 2) + 1e-9), `${name}: none between the stems`);
  } else {
    assert.equal(bl.length, 1); assert.deepEqual([bl[0].x0, bl[0].x1], [-G.bbf / 2, G.bbf / 2], `${name}: b_bf on the ℄`);
  }
  assert.equal(JSON.stringify([c.aN, c.cN, c.phiMnN, c.dc, G.bbf]), before, `${name}: engine values unchanged`);
});

test('pier section, NEXT 36F hand check: stems at ±30 in, B = 13 in: blocks from 23.5 to 36.5 in each side; a = A_s f_y / (0.85 f′c · 26)', () => {
  const { inp, R } = design('NEXT 36F', CASES['NEXT 36F (default bays)'][1]), c = R.cont;
  const bl = record(() => W.PSBUiFlexure.pierFig(R, inp, 640)).map(b => [b.x0, b.x1]).sort((a, b) => a[0] - b[0]);
  assert.deepEqual(bl, [[-36.5, -23.5], [23.5, 36.5]]);
  assert.ok(Math.abs(c.aN - c.As * c.fyr / (0.85 * inp.mat.fc * 26)) < 1e-12, 'a with b = 2 × 13 = 26 in');
  assert.deepEqual(JSON.parse(JSON.stringify(W.PSBUiFlexure.blocks(R.g))), bl);
});
