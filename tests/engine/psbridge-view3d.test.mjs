// apps/ps-bridge PR 3c: the 3D view's geometry (ui/view3d.js PSB3DUI.geom, no three.js) comes from the model: every girder type × line
//   cell drawn once at its line's offset (the bays, unequal allowed), between the bearings on the skewed support lines (bearing to bearing
//   = the span for equal skews at its two supports; = span + (z − z_mid)(tan θ₂ − tan θ₁) otherwise), past the bearing by opt.endOh at the
//   abutments only; its section = the shape library's (girderGross / halfPolygon / sectionVoids of the cell's engine inputs; NEXT flange from
//   the line's S); the deck from the left to the right deck edge, t_s; diaphragms at a from each line's left bearing; continuity diaphragms
//   on the pier lines of spans made continuous; the strands of the type shown at PSBStrandGfx.xy's positions (NEXT: in the stems), y = the
//   girder soffit + the row's y, count = N per line. Display only: geom reads the project and the engine's pure geometry functions.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', ...PBD, ...['sections', 'model', 'rigid', 'holddown', 'design', 'bridge', 'bridge-dl'].map(n => path.join(APP, `engine/${n}.js`)), ...['vizkit', 'strands', 'view3d'].map(n => path.join(APP, `ui/${n}.js`)));
const J = v => JSON.parse(JSON.stringify(v));
const close = (a, b, msg, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${msg}: ${a} vs ${b}`);
function project(o) {
  const P = W.PSBModel.defaultProject(); Object.assign(P.spans, { lengths: o.spans, continuity: o.cont || 'simple' }); Object.assign(P.xs, { bays: o.bays, nb: o.bays.length + 1, skews: o.skews, ohL: o.ohL ?? 3, ohR: o.ohR ?? 3 });
  if (o.base) Object.assign(P.base, J(o.base)); if (o.opt) Object.assign(P.base.opt, o.opt); if (o.diaph) P.base.loads.diaph = o.diaph;
  P.types = W.PSBBridge.newTypes(P); P.design = { g: 2, s: 1 }; P.xs.dl = W.PSBBridgeDL.defaults(P); return P;
}
/* the common checks of every project */
function common(P, G) {
  const cells = W.PSBBridge.cells(P), ys = [0]; P.xs.bays.forEach(b => ys.push(ys.at(-1) + b)); const yc = ys.at(-1) / 2, sup = [0]; P.spans.lengths.forEach(L => sup.push(sup.at(-1) + L));
  const tn = k => Math.tan((P.xs.skews[k] || 0) * Math.PI / 180), xb = (k, z) => (sup[k] + (z - yc) * tn(k)) * 12, ns = P.spans.lengths.length;
  assert.deepEqual(J(G.errors), []); assert.equal(G.girders.length, cells.length, 'a girder per type × line');
  cells.forEach(c => { const q = G.girders.find(r => r.k === c.k && r.g === c.g && r.s === c.s), inp = W.PSBDesign.cellInputs(P, c.k, c.g), g = W.girderGross(inp), oh = +inp.opt.endOh || 0, tag = `${c.label} G${c.g}`;
    assert.ok(q, tag); close(q.z, ys[c.g - 1] * 12, `${tag} z = the line's offset`);
    close(q.xa, xb(c.s - 1, ys[c.g - 1]), `${tag} left bearing`); close(q.xb, xb(c.s, ys[c.g - 1]), `${tag} right bearing`);
    close(q.xb - q.xa, (P.spans.lengths[c.s - 1] + (ys[c.g - 1] - yc) * (tn(c.s) - tn(c.s - 1))) * 12, `${tag} bearing to bearing`);
    if (P.xs.skews[c.s - 1] === P.xs.skews[c.s]) close(q.xb - q.xa, P.spans.lengths[c.s - 1] * 12, `${tag} = span`);
    close(q.L, P.spans.lengths[c.s - 1], `${tag} the engine's L`);
    close(q.xa - q.x0, c.s === 1 ? oh : 0, `${tag} end past the bearing (abutment)`); close(q.x1 - q.xb, c.s === ns ? oh : 0, `${tag} end past the bearing (abutment)`);
    assert.equal(q.h, g.h); assert.deepEqual(J(q.half), J(W.halfPolygon(g)), `${tag} outline`); assert.deepEqual(J(q.voids), J(W.sectionVoids(g)), `${tag} voids`);
    close(q.yTop - q.yBot, g.h, `${tag} depth`); close(G.deck.yBot - q.yTop, (g.isBox || g.isDeck) ? 0 : +inp.th, `${tag} haunch`); });
  close(G.deck.zR - G.deck.zL, (P.xs.ohL + ys.at(-1) + P.xs.ohR) * 12, 'deck width'); close(G.deck.zL, -P.xs.ohL * 12, 'left deck edge');
  close(G.deck.ts, Math.max(...cells.map(c => +W.PSBDesign.cellInputs(P, c.k, c.g).ts)), 'deck t_s');
  // strands of the type shown, on each of its lines
  const sh = W.PSBBridge.shown(P), sl = cells.filter(c => c.k === sh.k);
  sl.forEach(c => { const q = G.girders.find(r => r.k === c.k && r.g === c.g), R = { g: q.gg, ss: W.strandSys(q.inp, q.gg) }, pts = W.PSBStrandGfx.xy(R, +R.ss.hp.yMid);
    const lines = G.strands.filter(s => s.g === c.g && s.s === c.s), db = pts.filter(p => !p.h && p.db && R.ss.rows[p.ri].dbnd > 0).length;
    assert.equal(lines.length, R.ss.Ntot + 2 * db, `G${c.g}: a line per strand (+ 2 debonded lengths per debonded strand)`);
    pts.filter(p => !p.h).forEach(p => assert.ok(lines.some(s => s.kind !== 'h' && Math.abs(s.pts[0][2] - (q.z - p.x)) < 1e-9 && Math.abs(s.pts[0][1] - (q.yBot + p.y)) < 1e-9), `G${c.g}: strand at x ${p.x}, y ${p.y}`));
    lines.filter(s => s.kind === 'h').forEach(s => { close(s.pts[1][0], q.xa, 'draped at ℄ bearing'); close(s.pts[2][0] - s.pts[1][0], R.ss.hp.frac * q.inp.L * 12, 'hold-down at frac × L'); }); });
  assert.equal(new Set(G.strands.map(s => `${s.s}|${s.g}`)).size, sl.length, 'strands only on the lines of the type shown');
  return { ys, xb };
}

test('PR 3c 3D geometry: new project (one 120 ft span, 5 BT-72 at 9 ft, Interior / Exterior types)', () => {
  const P = W.PSBModel.newProject(), G = W.PSB3DUI.geom(P); common(P, G);
  assert.equal(G.girders.length, 5); assert.deepEqual(J(G.girders.map(q => q.z).sort((a, b) => a - b)), [0, 108, 216, 324, 432]);
  G.girders.forEach(q => { assert.equal(q.xa, 0); assert.equal(q.xb, 1440); }); assert.equal(G.dia.length, 0); assert.equal(G.cont.length, 0);
  assert.equal(G.app.filter(a => a.kind === 'bar').length, 2); close(G.app[0].z1 - G.app[0].z0, P.xs.dl.barL.bw * 12, 'barrier width');
});
test('PR 3c 3D geometry: two simple spans, a different shape in span 2, unequal bays, girder end past the bearing', () => {
  const P = project({ spans: [100, 120], bays: [8, 9.5, 9, 8.5], skews: [0, 0, 0], opt: { endOh: 9 } });
  P.types.forEach(t => { if (t.span === 2) Object.assign(t.ovr, { girder: 'PCI BT-54', 'harp.yEnd': 44 }); });
  const G = W.PSB3DUI.geom(P); common(P, G);
  assert.deepEqual(J([...new Set(G.girders.map(q => q.z))].sort((a, b) => a - b)), [0, 96, 210, 318, 420]);
  assert.ok(G.girders.filter(q => q.s === 2).every(q => q.girder === 'PCI BT-54' && q.h === 54 && q.xa === 1200)); assert.ok(G.girders.filter(q => q.s === 1).every(q => q.h === 72));
  close(G.deck.yBot, 72 + 2, 'deck soffit over the deepest girder + haunch');
});
test('PR 3c 3D geometry: NEXT 36F adjacent (S = 8 ft): stems, no diaphragm, a pad under each stem, strands in the stems', () => {
  const P = project({ spans: [60], bays: [8, 8, 8, 8], skews: [0, 0], base: { girder: 'NEXT 36F', ts: 6, rows: [{ n: 10, y: 2, dbnd: 0, nd: 0 }, { n: 10, y: 4, dbnd: 0, nd: 0 }, { n: 6, y: 6, dbnd: 8, nd: 2 }], harp: { n: 4, yEnd: 24, yMid: 10, frac: 0.4 } }, diaph: [{ P: 2, a: 30 }] });
  const G = W.PSB3DUI.geom(P); common(P, G);
  assert.ok(G.girders.every(q => q.kind === 'next' && q.top === 96)); assert.equal(G.dia.length, 0, 'adjacent: no room for a diaphragm'); assert.equal(G.pads.length, 5 * 2 * 2);
  G.girders.filter(q => q.shown).forEach(q => G.strands.filter(s => s.g === q.g).forEach(s => { const u = Math.abs(s.pts[0][2] - q.z); assert.ok(u >= 30 - 6.5 + 2 && u <= 30 + 6.5 - 2, `strand ${u} in from the ℄ of G${q.g}: in a stem`); }));
});
test('PR 3c 3D geometry: 25° skew, diaphragms at the third points; unequal skews 10° / 20°', () => {
  const P = project({ spans: [110], bays: [9, 9, 9, 9], skews: [25, 25], diaph: [{ P: 3, a: 110 / 3 }, { P: 3, a: 220 / 3 }] }), G = W.PSB3DUI.geom(P), { ys, xb } = common(P, G);
  assert.equal(G.dia.length, 8); G.dia.forEach(d => { const A = G.girders.find(q => q.g === d.bay), B = G.girders.find(q => q.g === d.bay + 1); close(d.xa, A.xa + d.a * 12, 'diaphragm on line a'); close(d.xc, B.xa + d.a * 12, 'diaphragm on line b'); close(d.za, A.z, 'za'); close(d.zc, B.z, 'zc'); });
  close(G.girders.find(q => q.g === 1).xa, xb(0, ys[0]), 'G1 bearing on the skewed line'); assert.ok(G.girders.find(q => q.g === 1).xa < 0 && G.girders.find(q => q.g === 5).xa > 0);
  const Q = project({ spans: [110], bays: [9, 9, 9, 9], skews: [10, 20] }); common(Q, W.PSB3DUI.geom(Q));
});
test('PR 3c 3D geometry: three spans made continuous (10° skew): continuity diaphragms on the two pier lines', () => {
  const P = project({ spans: [90, 110, 90], bays: [9, 9, 9, 9], skews: [10, 10, 10, 10], cont: 'composite', diaph: [{ P: 2.5, a: 45 }] }), G = W.PSB3DUI.geom(P), { ys, xb } = common(P, G);
  assert.equal(G.cont.length, 2); G.cont.forEach(c => { close(c.xa, xb(c.k, ys[0]), 'on the pier line (G1)'); close(c.xc, xb(c.k, ys.at(-1)), 'on the pier line (G5)'); });
  assert.equal(G.seats.length, 4); assert.equal(G.dia.length, 3 * 4);
  const S = project({ spans: [90, 110, 90], bays: [9, 9, 9, 9], skews: [10, 10, 10, 10] }); assert.equal(W.PSB3DUI.geom(S).cont.length, 0, 'simple spans: none');
});
