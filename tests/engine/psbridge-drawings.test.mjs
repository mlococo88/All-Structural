// apps/ps-bridge item 10, part 1 (2026-11-14): the Drawings tab's sheets (ui/sheets.js PSBSheets.build): the typical section of each span
//   and the framing plan on sheets with border and title block, one DXF R12 file (shared/dxf.js). Display and export only.
//   1. The sheets of a new project, three spans made continuous with unequal bays and skews, box beams, a curb and sidewalk layout;
//      paper D and B; the DXF passes SharedDxf.validate; every sheet fits its drawing area at its scale (or is marked over).
//   2. The section is the cross-section figure's geometry (PSBXsFig.model): one closed girder outline per type × line of the span with its
//      vertices, the deck, the spacing chain = the overhangs and bays, the d_e dimensions = PSBDesign.deOf; the plan is the framing plan's
//      (PSBPlan.model): a girder line per type × line, a support line per support, the diaphragm lines, the span dimensions = the spans.
//   3. The title block: project name and number, sheet n of N, the scale name.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', 'dxf.js', ...PBD, ...['sections', 'model', 'rigid', 'lldf-fg', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl'].map(n => path.join(APP, `engine/${n}.js`)),
  ...['vizkit', 'strands', 'view3d', 'xsfig', 'plan', 'sheets'].map(n => path.join(APP, `ui/${n}.js`)));
W.PSBSections.install();
const X = W.SharedDxf, SH = W.PSBSheets, J = v => JSON.parse(JSON.stringify(v));
const close = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b)), `${m}: ${a} vs ${b}`);

function layouts() {
  const out = {};
  out.newProject = W.PSBModel.newProject();
  { const P = W.PSBModel.newProject(); P.project.name = 'Route 9 over the Mill River'; P.project.number = 'B-123'; P.spans.lengths = [80, 110, 80]; P.spans.continuity = 'composite'; P.xs.skews = [15, 15, 15, 15];
    P.xs.nb = 6; P.xs.bays = [8, 9, 9.5, 9, 8]; P.types = W.PSBBridge.newTypes(P); W.PSBBridge.syncSpans(P); out.threeSpans = P; }
  { const P = W.PSBModel.newProject(); Object.assign(P.xs.dl.barL, { type: 'curb', cw: 12, ch: 10, rw: 0.05, rp: 1 }); P.xs.dl.swR = { w: 6, t: 12, fence: 0.04, fenceX: 5.5 }; P.xs.dl.med = { w: 2, t: 9 }; out.curbs = P; }
  return out;
}
const fill = P => { if (W.PSBBridge.fill) W.PSBBridge.fill(P); return P; };

test('the sheets: each layout, paper D and B, a valid DXF; every sheet at a scale of the list', () => {
  for (const [name, P0] of Object.entries(layouts())) for (const paper of ['D', 'B']) {
    const P = fill(J(P0)), B = SH.build(P, { paper, date: '2026-11-14' }), ns = P.spans.lengths.length;
    assert.deepEqual(J(B.errors), [], name);
    assert.deepEqual(J(B.sheets.map(s => s.id)), [...(ns > 1 ? P.spans.lengths.map((_, i) => 'sec' + (i + 1)) : ['sec']), 'plan'], name);
    const chk = X.validate(B.D.toDXF({ ltscale: 1 })); assert.ok(chk.ok, name + ' ' + chk.errors.join('; '));
    ['S-GRDR', 'S-DECK', 'S-DIMS', 'S-TEXT', 'S-TBLK', 'S-BRDR', 'S-SUPP'].forEach(l => assert.ok(chk.layers.includes(l), `${name}: layer ${l}`));
    B.sheets.forEach(s => { assert.ok(SH.SCALES.includes(s.k), `${name} ${s.id} k ${s.k}`); const [pw, ph] = SH.PAPER[paper], b = B.D.bbox(s.i0, s.i1);
      assert.ok(b[0] >= s.ox - 1e-6 && b[2] <= s.ox + pw * s.k + 1e-6 && b[1] >= -1e-6 && b[3] <= ph * s.k + 1e-6, `${name} ${s.id}: inside its sheet`);
      if (!s.over) { const d = B.D.bbox(s.i0, s.iC); assert.ok((d[2] - d[0]) / s.k <= pw - 2.25 + 1e-9 && (d[3] - d[1]) / s.k <= ph - 4.55 + 1e-9, `${name} ${s.id}: fits`); } });
    assert.ok(B.miss.some(m => /PART 2/.test(m[1])), 'part 2 listed as not yet');
  }
});

test('the typical section is the cross-section figure: girder outlines, deck, spacing chain, d_e', () => {
  for (const [name, P0] of Object.entries(layouts())) {
    const P = fill(J(P0)), B = SH.build(P, { date: '2026-11-14' });
    B.sheets.filter(s => /^sec/.test(s.id)).forEach(s => {
      const m = W.PSBXsFig.model(P, s.s), E = B.D.E.slice(s.i0, s.iC), dx = E.length ? null : 0;
      const G = E.filter(e => e.t === 'PL' && e.l === 'S-GRDR');
      assert.equal(G.length, m.girders.length, `${name} S${s.s}: one outline per girder`);
      // the drawing was moved onto the sheet: the offset from the deck rectangle
      const deck = E.find(e => e.t === 'PL' && e.l === 'S-DECK'), ox = deck.pts[0][0] - 0, oy = deck.pts[0][1] - m.yD; void dx;
      close(deck.pts[1][0] - deck.pts[0][0], m.Wd, 'deck width');
      m.girders.forEach((q, i) => { const p = G[i].pts; assert.equal(p.length, q.poly.length); p.forEach((v, j) => { close(v[0] - ox, q.poly[j][0], 'x'); close(v[1] - oy, q.poly[j][1], 'y'); }); });
      const dims = E.filter(e => e.t === 'DIM').map(e => e.meas), bays = [P.xs.ohL, ...P.xs.bays, P.xs.ohR].map(v => v * 12);
      // the chain: runs of equal bays are one dimension (n@s); the sum of the chain = the deck width
      const chainSum = E.filter(e => e.t === 'DIM' && !/DECK|DE =/.test(e.s)).reduce((a, e) => a + e.meas, 0);
      close(chainSum, bays.reduce((a, b) => a + b, 0), `${name}: the spacing chain`); assert.ok(dims.some(v => Math.abs(v - m.Wd) < 1e-6), 'the deck width dimension');
      m.faces.forEach(f => { if (Math.abs(f.de) > 1e-9) assert.ok(E.some(e => e.t === 'DIM' && /DE =/.test(e.s) && Math.abs(e.meas - Math.abs(f.de) * 12) < 1e-6), `${name}: d_e of G${f.g}`); close(f.de, W.PSBDesign.deOf(P, f.g), 'd_e = deOf'); });
    });
  }
});

test('the framing plan is the plan figure: girder lines, support lines, diaphragms, spans; the title block', () => {
  for (const [name, P0] of Object.entries(layouts())) {
    const P = fill(J(P0)), B = SH.build(P, { date: '2026-11-14' }), s = B.sheets.find(q => q.id === 'plan'), m = W.PSBPlan.model(P), E = B.D.E.slice(s.i0, s.iC);
    assert.equal(E.filter(e => e.t === 'LINE' && e.l === 'S-GRDR').length, m.girders.length, name + ' girders');
    assert.equal(E.filter(e => e.t === 'LINE' && e.l === 'S-SUPP').length, m.supports.length, name + ' supports');
    assert.equal(E.filter(e => e.t === 'LINE' && e.l === 'S-DIAP').length, m.dia.length + m.cont.length, name + ' diaphragms');
    const spans = E.filter(e => e.t === 'DIM' && /^SPAN/.test(e.s)).map(e => e.meas / 12);
    assert.deepEqual(J(spans.map(v => +v.toFixed(6))), J(P.spans.lengths).map(v => +(+v).toFixed(6)), name + ' spans');
    // the support line of each support at its skew
    E.filter(e => e.l === 'S-SUPP').forEach((e, k) => { const [a, b] = e.pts, th = Math.atan2(b[0] - a[0], -(b[1] - a[1])) * 180 / Math.PI; close(Math.abs(th), Math.abs(m.supports[k].skew), 'skew'); });
    const T = B.D.E.slice(s.iC, s.i1).filter(e => e.t === 'TEXT').map(e => e.s);
    assert.ok(T.includes(`${s.n} OF ${B.sheets.length}`) && T.includes('FRAMING PLAN') && T.some(t => t.startsWith(SH.SCALE_NAME[s.k].replace(/"/g, '"'))), T.join('|'));
    if (P.project.name) assert.ok(T.includes(X.str(P.project.name.toUpperCase())), 'project name');
  }
});
