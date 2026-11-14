// apps/ps-bridge PS-30 / PS-31 / PS-32 (engineer decisions 2026-11-14): the box beams and voided deck slabs of the CTDOT Bridge Design
// Manual plates (engine/sections.js, an app-side correction of the old library in GIRDERS; the moved engine files unchanged).
//   (1) the library: each entry's A, I, y_b, depth, width = the plate (transcribed here again from plates 5.2.1b, PDF p. 327; 5.1.1c,
//       p. 314; 5.1.2c, p. 317), its S_b, S_t (I / y, as the engine) and weight (A × 150 / 144) agree with the plate's; the old six entries
//       are gone and the rest of GIRDERS is unchanged (the frozen library slice);
//   (2) the drawn outline (the engine's halfPolygon and sectionVoids, integrated here) gives A, I, y_b within 2.5 % of the plate's, the box
//       void centred between the 5½ in slabs, the SIV-48 voids Ø12 / Ø10 / Ø12;
//   (3) PS-31 migration of each old name (base design and girder types; idempotent; the old values kept in P.legacySection; the 27 in
//       voided slab an input error naming it), through importJSON (a stored project) and the old-app import (verify with the old entries);
//   (4) the Section properties note and the Report §2 assumption.
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import vm from 'node:vm';
import { loadShared, test, ROOT } from './harness.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const ENG = ['sections', 'model', 'rigid', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'legacy', 'worked', 'worked-stress', 'worked-strength', 'worked-end', 'worked-hdr'].map(n => path.join(APP, `engine/${n}.js`));
const UI = ['outkit', 'vizkit', 'section'].map(n => path.join(APP, `ui/${n}.js`));
const W = loadShared('steps.js', ...PBD, ...ENG, ...UI, 'report.js', ...['fromtab', 'data', 'builders'].map(n => path.join(APP, `report/${n}.js`)));
const W0 = loadShared(...PBD);   // the moved engine alone: the old library
const G = vm.runInContext('GIRDERS', W), G0 = vm.runInContext('GIRDERS', W0), D0 = vm.runInContext('DEFAULTS', W);
const S = W.PSBSections, J = v => JSON.parse(JSON.stringify(v));
const OLD = ['AASHTO BI-36 (12in)', 'AASHTO BII-36 (18in)', 'AASHTO BIII-36 (27in)', 'AASHTO BIV-48 (33in)', 'Deck slab 21×48 (voided)', 'Deck slab 27×48 (voided)'];

/* the plates as printed: [name, h, actual width, A, I, y_b, S_b, S_t, weight lb/ft] */
const PLATE = [
  ['AASHTO BI-36 (27in)', 27, 35.5, 554.6, 49495, 13.35, 3709, 3625, 578], ['AASHTO BI-48 (27in)', 27, 47.5, 686.6, 65085, 13.38, 4886, 4777, 715],
  ['AASHTO BII-36 (33in)', 33, 35.5, 614.6, 83834, 16.30, 5144, 5019, 640], ['AASHTO BII-48 (33in)', 33, 47.5, 746.6, 109127, 16.33, 6681, 6548, 778],
  ['AASHTO BIII-36 (39in)', 39, 35.5, 730.6, 132895, 19.28, 6894, 6738, 761], ['AASHTO BIII-48 (39in)', 39, 47.5, 862.6, 170267, 19.31, 8817, 8648, 899],
  ['AASHTO BIV-36 (42in)', 42, 35.5, 766.6, 161387, 20.76, 7773, 7599, 799], ['AASHTO BIV-48 (42in)', 42, 47.5, 898.6, 205690, 20.80, 9890, 9701, 936],
  ['AASHTO SII-36 (15in)', 15, 35.5, 438, 9728, 7.44, 1309, 1287, 457], ['AASHTO SIII-36 (18in)', 18, 35.5, 473, 16034, 8.92, 1798, 1766, 493],
  ['AASHTO SIV-36 (21in)', 21, 35.5, 511, 24987, 10.40, 2403, 2358, 532], ['AASHTO SII-48 (15in)', 15, 47.5, 553, 12622, 7.45, 1695, 1672, 576],
  ['AASHTO SIII-48 (18in)', 18, 47.5, 611, 21376, 8.94, 2393, 2359, 636], ['AASHTO SIV-48 (21in)', 21, 47.5, 684, 33759, 10.43, 3238, 3193, 713]];
const gOf = (name, extra) => W.girderGross(Object.assign(J(D0), { girder: name }, extra || {}));
/* drawnProps(g): A, I, y_b of the shape as drawn: the mirrored halfPolygon (shoelace) less sectionVoids (rectangles, circles) */
function drawnProps(g) {
  const hp = W.halfPolygon(g), P = hp.concat(hp.slice().reverse().map(p => [-p[0], p[1]]));
  let A = 0, Sy = 0, Ix = 0;   // about the soffit (y = 0)
  for (let i = 0; i < P.length; i++) { const [x0, y0] = P[i], [x1, y1] = P[(i + 1) % P.length], c = x0 * y1 - x1 * y0; A += c / 2; Sy += (y0 + y1) * c / 6; Ix += (y0 * y0 + y0 * y1 + y1 * y1) * c / 12; }
  if (A < 0) { A = -A; Sy = -Sy; Ix = -Ix; }
  W.sectionVoids(g).forEach(v => { const a = v.type === 'rect' ? v.w * v.h : Math.PI * v.d * v.d / 4, i0 = v.type === 'rect' ? v.w * v.h ** 3 / 12 : Math.PI * v.d ** 4 / 64;
    A -= a; Sy -= a * v.y; Ix -= i0 + a * v.y * v.y; });
  const yb = Sy / A; return { A, I: Ix - A * yb * yb, yb };
}

test('PS-30 / PS-32 (1): the library = the CTDOT plates (A, I, y_b, h, width; S and weight agree); the old entries removed, the others unchanged', () => {
  for (const [n, h, w, A, I, yb, Sb, St, wt] of PLATE) {
    const e = G[n]; assert.ok(e, n);
    assert.deepEqual([e.h, e.w, e.A, e.I, e.yb], [h, w, A, I, yb], n);
    const g = gOf(n);
    assert.ok(Math.abs(g.Sb / Sb - 1) < 0.005, `${n}: S_b ${g.Sb} vs plate ${Sb}`); assert.ok(Math.abs(g.St / St - 1) < 0.005, `${n}: S_t ${g.St} vs plate ${St}`);
    assert.ok(Math.abs(A * 150 / 144 - wt) < 1, `${n}: weight ${A * 150 / 144} vs plate ${wt}`);
    assert.equal(g.wsw, A / 144 * (+D0.mat.wcLoad || +D0.mat.wc), `${n}: self-weight A / 144 × w_c (the engine's load unit weight)`);
  }
  OLD.forEach(n => { assert.ok(!(n in G), n + ' removed'); assert.deepEqual(J(S.LEGACY[n]), J(G0[n]), n + ': kept in PSBSections.LEGACY byte for byte'); });
  const rest = Object.keys(G0).filter(n => !OLD.includes(n)); rest.forEach(n => assert.deepEqual(J(G[n]), J(G0[n]), n + ' unchanged'));
  assert.deepEqual(Object.keys(G), [...rest.slice(0, rest.indexOf('Deck slab 12×48 (solid)')), ...PLATE.slice(0, 8).map(r => r[0]), 'Deck slab 12×48 (solid)', 'Deck slab 18×48 (solid)', ...PLATE.slice(8).map(r => r[0]), 'Custom'], 'order');
  // the box webs follow from the plate areas: A = w h − (w − 2 t_w)(h − 11) + 18 (void chamfers) − 13.9 (keys, ¾ in chamfers)
  PLATE.slice(0, 8).forEach(([n, h, w, A]) => { const tw = G[n].bw / 2; assert.equal(tw, /BIII|BIV/.test(n) ? 6 : 5, n); assert.ok(Math.abs(w * h - (w - 2 * tw) * (h - 11) + 18 - 13.9 - A) < 0.06, n + ': area from the walls'); });
});

test('PS-30 / PS-32 (2): the drawn outline (halfPolygon, sectionVoids) gives A, I, y_b within 2.5 % of the plate; box void centred; SIV-48 Ø12/Ø10/Ø12', () => {
  for (const [n, h, , A, I, yb] of PLATE) {
    const g = gOf(n), o = drawnProps(g), so = S.outline(S.STD[n]);
    [['A', o.A, A], ['I', o.I, I], ['y_b', o.yb, yb]].forEach(([k, v, p]) => assert.ok(Math.abs(v / p - 1) <= 0.025, `${n}: drawn ${k} ${v.toFixed(2)} vs plate ${p} (${((v / p - 1) * 100).toFixed(2)} %)`));
    assert.ok(Math.abs(so.A - o.A) < 1e-9 && Math.abs(so.I - o.I) < 1e-6 && Math.abs(so.yb - o.yb) < 1e-9, n + ': PSBSections.outline = the drawn shape');
    const v = W.sectionVoids(g);
    if (g.isBox) { assert.equal(v.length, 1); assert.equal(v[0].y - v[0].h / 2, 5.5); assert.equal(v[0].y + v[0].h / 2, h - 5.5, n + ': void centred between the 5½ in slabs'); }
    else assert.deepEqual(J(v.map(q => [q.x, q.y, q.d])), J(S.STD[n].src.voids.map(q => [q.x, h / 2, q.d])), n);
  }
  assert.deepEqual(J(W.sectionVoids(gOf('AASHTO SIV-48 (21in)')).map(v => v.d)), [12, 10, 12]);
  // A_ct (5.7.3.4.2) of SIV-48 (concrete below h/2 = 10.5 in): 47.5 × 10.5 − (2 × π 6² / 2 + π 5² / 2) = 498.75 − 152.47 = 346.28 in²
  assert.ok(Math.abs(W.tensionSideArea(gOf('AASHTO SIV-48 (21in)')) - (47.5 * 10.5 - (Math.PI * 36 + Math.PI * 25 / 2))) < 1e-9);
  // BIII-36: 35.5 × 19.5 − 23.5 × (19.5 − 5.5) = 692.25 − 329 = 363.25 in²
  assert.equal(W.tensionSideArea(gOf('AASHTO BIII-36 (39in)')), 35.5 * 19.5 - 23.5 * 14);
  // the other shapes keep the engine's own voids (the old 21 in slab, evenly spaced: the moved engine's sectionVoids)
  const legacy = { box: { w: 48, voids: 2, voidD: 12 }, isDeck: true, h: 21 }; assert.deepEqual(J(W.sectionVoids(legacy)), J(W0.sectionVoids(legacy)));
});

const MAPPED = { 'AASHTO BI-36 (12in)': 'AASHTO BI-36 (27in)', 'AASHTO BII-36 (18in)': 'AASHTO BII-36 (33in)', 'AASHTO BIII-36 (27in)': 'AASHTO BIII-36 (39in)',
  'AASHTO BIV-48 (33in)': 'AASHTO BIV-48 (42in)', 'Deck slab 21×48 (voided)': 'AASHTO SIV-48 (21in)' };
const proj = (girder, rows) => { const P = W.PSBModel.newProject(); P.base.girder = girder; P.base.harp.n = 0; P.base.ts = 6; P.xs.bays = [3, 3, 3, 3]; P.spans.lengths = [60];
  P.base.rows = rows || [{ n: 16, y: 2, nd: 0, dbnd: 0 }]; return P; };
test('PS-31 (3): every old name migrates on open (importJSON) to the standard section of the same name; old values kept; idempotent; results computed', () => {
  for (const [from, to] of Object.entries(MAPPED)) {
    const P = proj(from), t = W.PSBModel.exportJSON(P), r = W.PSBModel.importJSON(t), Q = r.project;
    assert.ok(r.ok); assert.equal(Q.base.girder, to, from);
    Q.types.forEach(T => assert.ok(!('girder' in T.ovr), 'the types inherit the base girder'));
    assert.equal(Q.legacySection.items.length, 1);
    const it = Q.legacySection.items[0];
    assert.deepEqual(J(it), { where: 'base', label: 'Base design', from, to, old: { h: S.LEGACY[from].h, w: S.LEGACY[from].w, A: S.LEGACY[from].A, I: S.LEGACY[from].I, yb: S.LEGACY[from].yb },
      now: { h: G[to].h, w: G[to].w, A: G[to].A, I: G[to].I, yb: G[to].yb } });
    assert.ok(r.notes.join(' ').includes(`Girder section corrected on open (PS-31): Base design "${from}" → "${to}". See the notice above the results.`), r.notes.join(' '));
    assert.equal(t, W.PSBModel.exportJSON(P), 'the stored text is not changed by reading it');
    // a second open: nothing more
    const r2 = W.PSBModel.importJSON(W.PSBModel.exportJSON(Q)); assert.deepEqual(J(r2.project.legacySection), J(Q.legacySection)); assert.equal(r2.notes.filter(n => /PS-31/.test(n)).length, 0);
    assert.deepEqual(J(W.PSBInputCheck.collect(Q).errors.map(e => e.msg)), [], to + ': no input error');
    const R = W.PSBHoldDown.compute(W.PSBDesign.inputs(Q)); assert.equal(R.error, null); assert.equal(R.g.A, G[to].A); assert.equal(R.g.I, G[to].I); assert.equal(R.g.yb, G[to].yb);
  }
  // a girder type with its own old shape
  const P = proj('AASHTO BIII-36 (39in)'); P.types[1].ovr.girder = 'AASHTO BI-36 (12in)';
  const Q = W.PSBModel.importJSON(W.PSBModel.exportJSON(P)).project;
  assert.equal(Q.types[1].ovr.girder, 'AASHTO BI-36 (27in)'); assert.equal(Q.base.girder, 'AASHTO BIII-36 (39in)');
  assert.deepEqual(J(Q.legacySection.items.map(i => [i.where, i.label, i.from, i.to])), [[`type:${P.types[1].id}`, `Girder type ${P.types[1].label}`, 'AASHTO BI-36 (12in)', 'AASHTO BI-36 (27in)']]);
});

test('PS-31 (3): Deck slab 27×48 (voided): no standard within ±3 in: kept, an input error naming it, the notice says so; no engine error before', () => {
  const P = proj('Deck slab 27×48 (voided)'), r = W.PSBModel.importJSON(W.PSBModel.exportJSON(P)), Q = r.project;
  assert.equal(Q.base.girder, 'Deck slab 27×48 (voided)'); assert.equal(Q.legacySection.items[0].to, null); assert.equal(Q.legacySection.items[0].now, null);
  const e = W.PSBInputCheck.collect(Q).errors; assert.ok(e.length >= 1);
  assert.equal(e[0].path, 'base.girder'); assert.match(e[0].msg, /^Girder section "Deck slab 27×48 \(voided\)" was removed from the library \(PS-31\)/);
  assert.match(S.text(Q.legacySection.items[0]), /removed from the library \(PS-31\).*no standard voided slab .*within ±3 in/);
  const r2 = W.PSBModel.importJSON(W.PSBModel.exportJSON(Q)); assert.equal(r2.project.legacySection.items.length, 1, 'recorded once');
});

test('PS-31 (3): an old-app design with an old box: import (verify with the old entries: the same), then corrected; GIRDERS clean after', () => {
  const P = proj('AASHTO BIII-36 (39in)'), inp = W.PSBDesign.inputs(P); inp.girder = 'AASHTO BIII-36 (27in)';
  const src = W.PSBLegacy.fromText(JSON.stringify(inp, null, 1), 'old.json'); assert.ok(src.ok);
  const c = W.PSBLegacy.convert(src.src); assert.ok(c.ok); assert.equal(c.project.base.girder, 'AASHTO BIII-36 (27in)', 'convert keeps the old inputs');
  const res = W.PSBLegacy.verify(c); assert.equal(res.error, null); assert.equal(res.values, true, 'the import is faithful (both computed with the old entry)');
  assert.ok(!('AASHTO BIII-36 (27in)' in G), 'the old entry removed again');
  // the page's replace(): PSBBridge.migrate, PSBLegacy.restore, then PSBSections.migrate
  const Q = c.project; W.PSBBridge.migrate(Q); W.PSBLegacy.restore(Q); W.PSBSections.migrate(Q);
  assert.equal(Q.base.girder, 'AASHTO BIII-36 (39in)'); assert.equal(Q.legacySection.items[0].old.I, 97756);
  assert.equal(Q.legacy.inputs.girder, 'AASHTO BIII-36 (27in)', 'the import record keeps the old data as read');
  const R = W.PSBHoldDown.compute(W.PSBDesign.inputs(Q)); assert.equal(R.error, null); assert.equal(R.g.I, 132895);
});

test('PS-30 / PS-31 (4): the Section properties note (plate, void, drawn outline check) and the Report §2 assumption', () => {
  const g = gOf('AASHTO BIII-36 (39in)'), t = W.PSBUiSection.voidNote(g);
  assert.match(t, /^Void: one 23\.5 × 28\.0 in cell, y = 5\.5 to 33\.5 in above the soffit, centred between the 5\.5 in top and bottom slabs; webs 6\.0 in; actual width 35\.5 in \(nominal 36 in\) \(CTDOT BDM plate 5\.2\.1a, PDF p\. 326\)/);
  assert.match(t, /plate's values \(AASHTO BIII-36, CTDOT BDM plate 5\.2\.1b, PDF p\. 327\); the drawn outline .* gives A = 726\.5 in² \(−0\.6 %\), I = 132,496 in⁴ \(−0\.3 %\)/);
  const s = W.PSBUiSection.voidNote(gOf('AASHTO SIV-48 (21in)'));
  assert.match(s, /^Voids: Ø12\.0 in at x = -14\.0 in, Ø10\.0 in at x = 0\.0 in, Ø12\.0 in at x = 14\.0 in, on mid-depth \(y = 10\.5 in\)/);
  assert.equal(W.PSBUiSection.voidNote(gOf('PCI BT-72')), '');
  const P = W.PSBModel.importJSON(W.PSBModel.exportJSON(proj('AASHTO BIII-36 (27in)'))).project, B = W.PSBReportData.compute(P, null, 'gov'); assert.equal(B.err, '');
  const M = W.PSBReportBuild.model(B, {}), doc = W.SharedReport.build(M), a = M.sections.find(q => q.id === 'proj').subs.find(q => /Assumptions/.test(q.title)), at = JSON.stringify(a.items);
  assert.ok(at.includes('Base design: section corrected (PS-31): \\"AASHTO BIII-36 (27in)\\" → \\"AASHTO BIII-36 (39in)\\" (CTDOT BDM plate 5.2.1b, PDF p. 327): h 27 → 39 in, A 812.0 → 730.6 in², I 97,756 → 132,895 in⁴, $y_b$ 13.14 → 19.28 in'), at.slice(0, 600));
  assert.ok(/section corrected \(PS-31\).*?legacySection\)\. \(see \[\[rs\.sec\]\]\)/.test(at), at.slice(0, 900));
  assert.ok(!doc.unresolved.some(u => u.key === 'rs.sec'), 'the §3 link resolves');   // (the other tabs' anchors need their ui/*.js, not loaded here)
  const html = W.PSBUiSection.output({ P: B.P, inp: B.inp, R: B.R, W: B.W, ui: {} });
  assert.ok(html.includes('AASHTO BIII-36: A, I, y<sub>b</sub> from CTDOT Bridge Design Manual plate 5.2.1b (PDF p. 327)'));
  // no PS-31 assumption for a project that never had an old name
  const B2 = W.PSBReportData.compute(proj('AASHTO BIII-36 (39in)'), null), a2 = W.PSBReportBuild.model(B2).sections.find(q => q.id === 'proj').subs.find(q => /Assumptions/.test(q.title));
  assert.ok(!/PS-31/.test(JSON.stringify(a2.items)));
});

/* §4 check cases (the PR's before / after): harness B "box BIII-36 with a 6 in topping" and a default-strand BI-36. "Before" = the old library
   entry (computed with the moved engine and the old entry, as the old app did), "after" = the plate entry. Printed for the record. */
test('PS-31 §4 check cases: before / after (printed)', () => {
  const rows = [];
  const run = (label, P, oldName) => {
    const inp = W.PSBDesign.inputs(P), Rn = W.PSBHoldDown.compute(inp), io = Object.assign(J(inp), { girder: oldName }), Ro = S.withLegacy(() => W.PSBHoldDown.compute(io));
    assert.equal(Rn.error, null); assert.equal(Ro.error, null);
    const k = R => { const mid = R.stress && R.stress.mid ? R.stress.mid : null; void mid;
      const fl = R.checks.filter(c => /Flexure/.test(c.n)).map(c => c.r), sv = R.checks.filter(c => /Service|tension|compression/i.test(c.n)).map(c => c.r);
      return { h: R.g.h, A: R.g.A, I: R.g.I, yb: R.g.yb, Sb: R.g.Sb, St: R.g.St, wsw: R.g.wsw, phiMn: R.fMid.phiMn / 12, Mu: R.MuMid / 12, maxR: Math.max(...R.checks.map(c => c.r)), fl, sv,
        relTop: R.relTop, relBot: R.relBot, fpe: R.fpe, totalLoss: R.totalLoss, eMid: R.ss.eMid, cgsMid: R.ss.cgsMid, Aps: R.ss.Aps, L: R.L, Ic: R.cp.Ic, ybc: R.cp.ybc, Sbc: R.cp.Sbc, dfm: R.dfm,
        checks: R.checks.map(c => `${c.n}: v ${(+c.v).toFixed(3)} lim ${(+c.lim).toFixed(3)} r ${(+c.r).toFixed(3)} ${c.pass ? 'PASS' : 'FAIL'}`) }; };
    rows.push({ label, before: k(Ro), after: k(Rn) });
  };
  const P1 = TAB_CASES(() => W.PSBModel.defaultProject())['box BIII-36 with a 6 in topping, deck on (S below 4 ft), handling on'];   // the harness B design
  run('BIII-36 with a 6 in topping (harness B)', P1, 'AASHTO BIII-36 (27in)');
  const P2 = W.PSBModel.defaultProject(); P2.base.girder = 'AASHTO BI-36 (27in)'; P2.xs.bays = [3, 3, 3, 3]; P2.spans.lengths = [60]; P2.base.harp.n = 0; P2.base.ts = 6;
  run('BI-36 default strand rows, 6 in topping, 60 ft', P2, 'AASHTO BI-36 (12in)');
  fs.writeFileSync(path.join(process.env.TMPDIR || '/tmp', 'ps31-checkcases.json'), JSON.stringify(rows, null, 1));
});
