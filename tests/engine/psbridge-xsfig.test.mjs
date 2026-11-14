// apps/ps-bridge 2026-11-14: the whole-bridge cross-section figure (ui/xsfig.js PSBXsFig, the Loads & LLDF tab and the Report): each line's
//   girder section (the library outline halfPolygon mirrored, sectionVoids) at its offset from the left deck edge (overhang + the bays,
//   unequal allowed), the deck from edge to edge on the deepest girder + haunch, the haunch over each I-girder top flange (none on boxes and
//   slabs), the barriers (width = the traffic face) and sidewalks of the Cross-section tab, the traffic faces at the d_e the engine uses
//   (PSBDesign.deOf, PS-20; without the cross-section barriers the entered d_e), the lines with no type listed. Display only.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', ...PBD, ...['sections', 'model', 'rigid', 'lldf-fg', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl'].map(n => path.join(APP, `engine/${n}.js`)), ...['vizkit', 'strands', 'view3d', 'xsfig'].map(n => path.join(APP, `ui/${n}.js`)));
const J = v => JSON.parse(JSON.stringify(v));
const close = (a, b, msg, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${msg}: ${a} vs ${b}`);
function project(o) {
  const P = W.PSBModel.defaultProject(); Object.assign(P.spans, { lengths: o.spans || [100], continuity: 'simple' });
  Object.assign(P.xs, { bays: o.bays, nb: o.bays.length + 1, skews: (o.spans || [100]).concat(0).map(() => 0), ohL: o.ohL ?? 3, ohR: o.ohR ?? 3 });
  if (o.base) Object.assign(P.base, J(o.base));
  P.types = W.PSBBridge.newTypes(P); P.design = { g: 2, s: 1 }; P.xs.dl = W.PSBBridgeDL.defaults(P); return P;
}
/* the checks of every figure: outline, voids, offsets, deck, haunch, faces */
function common(P, s) {
  const m = W.PSBXsFig.model(P, s), off = W.PSBModel.girderOffsets(P).map(x => x * 12), cells = W.PSBBridge.cells(P).filter(c => c.s === s);
  assert.deepEqual(J(m.errors), []); assert.equal(m.girders.length, cells.length, 'a section per type × line of the span');
  close(m.Wd, (P.xs.ohL + P.xs.bays.reduce((a, b) => a + b, 0) + P.xs.ohR) * 12, 'deck width');
  const yD = Math.max(...cells.map(c => { const inp = W.PSBDesign.cellInputs(P, c.k, c.g), g = W.girderGross(inp); return g.h + ((g.isBox || g.isDeck) ? 0 : +inp.th); }));
  close(m.yD, yD, 'deck soffit on the deepest girder + haunch');
  cells.forEach(c => {
    const q = m.girders.find(r => r.g === c.g), inp = W.PSBDesign.cellInputs(P, c.k, c.g), g = W.girderGross(inp), half = W.halfPolygon(g), tag = `${c.label} G${c.g}`;
    close(q.x, off[c.g - 1], `${tag} at its offset`); close(q.x, (P.xs.ohL + P.xs.bays.slice(0, c.g - 1).reduce((a, b) => a + b, 0)) * 12, `${tag} = overhang + bays`);
    const th = (g.isBox || g.isDeck) ? 0 : +inp.th; close(q.yTop + th, m.yD, `${tag} top + haunch = deck soffit`); close(q.yTop - q.yBot, g.h, `${tag} depth`);
    assert.equal(q.poly.length, 2 * half.length, `${tag} outline: both halves`);
    half.forEach((p, i) => { close(q.poly[i][0], q.x + p[0], `${tag} right half x`); close(q.poly[i][1], q.yBot + p[1], `${tag} right half y`);
      const r = q.poly[2 * half.length - 1 - i]; close(r[0], q.x - p[0], `${tag} left half x`); close(r[1], q.yBot + p[1], `${tag} left half y`); });
    const v = W.sectionVoids(g); assert.equal(q.voids.length, v.length, `${tag} voids`);
    v.forEach((z, i) => { close(q.voids[i].x, q.x + z.x, `${tag} void x`); close(q.voids[i].y, q.yBot + z.y, `${tag} void y`); });
    const hh = m.haunch.find(h => h.g === c.g); if (th > 0) { assert.ok(hh, `${tag} haunch`); close(hh.x1 - hh.x0, g.isNext ? g.btf : g.btf, `${tag} haunch width = top flange`); close(hh.y1 - hh.y0, th, `${tag} haunch t_h`); } else assert.ok(!hh, `${tag} no haunch`);
  });
  m.faces.forEach(f => { close(Math.abs(f.x - f.xg) / 12, Math.abs(f.de), `G${f.g} face at d_e`); assert.equal(f.side === 'L' ? f.xg - f.x >= 0 : f.x - f.xg >= 0, f.de >= 0, `G${f.g} d_e sign`); });
  const out = W.PSBXsFig.svg(P, s, 700, { shown: 2 }); assert.ok(/^<svg/.test(out.svg), 'svg drawn');
  assert.ok((out.svg.match(/class="xs-g"/g) || []).length === cells.length, 'one outline per section');
  return m;
}

test('xsfig: new project (BT-72 × 5 at 9 ft, barriers 1.75 ft): sections at the offsets, haunch, d_e = deOf', () => {
  const P = W.PSBModel.newProject(), m = common(P, 1);
  assert.equal(m.faces.length, 2);
  m.faces.forEach(f => { close(f.de, W.PSBDesign.deOf(P, f.g), `G${f.g} d_e = deOf`); assert.match(f.src, /cross-section/); });
  close(m.faces[0].x, P.xs.dl.barL.bw * 12, 'left traffic face = barrier width'); close(m.faces[1].x, m.Wd - P.xs.dl.barR.bw * 12, 'right traffic face');
  assert.equal(m.app.filter(a => a.kind === 'bar').length, 2); assert.deepEqual(J(m.missing), []);
});
test('xsfig: unequal bays, a sidewalk 6 ft × 12 in (curb face), the barrier on it', () => {
  const P = project({ bays: [8, 10, 9.5, 8.5], ohL: 4, ohR: 2.5 }); P.xs.dl.swL = { w: 6, t: 12 };
  const m = common(P, 1), L = m.faces.find(f => f.g === 1), sw = m.app.find(a => a.kind === 'sw'), bar = m.app.find(a => a.kind === 'bar' && a.side === 'L');
  close(L.x, 72, 'left face at the curb (6 ft)'); close(L.de, 4 - 6, 'd_e = 4 − 6 = −2 ft'); close(L.de, W.PSBDesign.deOf(P, 1), 'deOf');
  close(sw.x1 - sw.x0, 72, 'sidewalk width'); close(sw.y1 - sw.y0, 12, 'sidewalk t'); close(bar.y0, sw.y1, 'barrier on the sidewalk');
  assert.deepEqual(J(m.girders.map(q => q.x / 12)), [4, 12, 22, 31.5, 40]);
});
test('xsfig: no cross-section barriers (project saved before them): the entered d_e, the base barrier width', () => {
  const P = project({ bays: [9, 9, 9], base: {} }); delete P.xs.dl; P.base.loads.de = 1.25;
  const m = common(P, 1);
  m.faces.forEach(f => { close(f.de, 1.25, 'entered d_e'); assert.match(f.src, /entered/); });
  close(m.app.find(a => a.kind === 'bar').x1 - m.app.find(a => a.kind === 'bar').x0, +P.base.deck.bBar || 0, 'barrier = base bBar');
});
test('xsfig: NEXT 36F (both stems), box BIII-36 (void, no haunch), voided slab (two voids), solid slab', () => {
  const N = project({ bays: [10, 10, 10, 10], base: { girder: 'NEXT 36F', ts: 6 } }), mn = common(N, 1);
  assert.equal(mn.girders[0].poly.length, 16, 'NEXT: two stems and the flange'); assert.equal(mn.girders[0].kind, 'next');
  const B = project({ bays: [3, 3, 3, 3, 3], ohL: 1.5, ohR: 1.5, base: { girder: 'AASHTO BIII-36 (39in)', ts: 0 } }), mb = common(B, 1);
  assert.ok(mb.girders.every(q => q.kind === 'box' && q.voids.length >= 1)); assert.equal(mb.haunch.length, 0); close(mb.ts, 0, 'no topping');
  const V = project({ bays: [4, 4, 4], ohL: 2, ohR: 2, base: { girder: 'Deck slab 21×48 (voided)', ts: 5 } }), mv = common(V, 1);
  assert.ok(mv.girders.every(q => q.voids.length === 2 && q.kind === 'deck'));
  const S = project({ bays: [4, 4, 4], ohL: 2, ohR: 2, base: { girder: 'Deck slab 18×48 (solid)', ts: 5 } }), ms = common(S, 1);
  assert.ok(ms.girders.every(q => q.voids.length === 0 && q.kind === 'solid'));
});
test('xsfig: two spans with different shapes; a line with no type listed (dashed ℄), not drawn', () => {
  const P = project({ spans: [100, 120], bays: [8, 9.5, 9, 8.5] });
  P.types.forEach(t => { if (t.span === 2) t.ovr.girder = 'PCI BT-54'; });
  const m1 = common(P, 1), m2 = common(P, 2);
  assert.ok(m1.girders.every(q => q.h === 72)); assert.ok(m2.girders.every(q => q.h === 54));
  const T = P.types.find(t => t.span === 1 && t.lines.includes(3)); T.lines = T.lines.filter(g => g !== 3);
  const m = common(P, 1); assert.deepEqual(J(m.missing.map(q => q.g)), [3]); assert.equal(m.girders.length, 4);
  assert.match(W.PSBXsFig.legend(m), /no type on G3/);
});
