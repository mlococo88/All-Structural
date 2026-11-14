// apps/ps-bridge PS-38 / PS-40 (engineer decisions 2026-11-14, "fix it, with notice"; engine/sections.js, app-side: the moved engine unchanged).
//   PS-38: NEXT 28F at the maximum width (144 in): I 88,218 → 92,836 in⁴ (MassDOT Bridge Manual Part II dwg 9.2.3, p. 124). Every other NEXT F
//          value of the library = the sheet (transcribed here again). withLegacy (the old app's results of an imported design) puts 88,218 back.
//   PS-40: the CTDOT voided slabs' void centres = MassDOT's dimensioned spacing (dwg 10.1.4 / 10.1.5, p. 193 / 194): ±7.75; 0, ±13.75 (SII-48);
//          0, ±14.25 (SIII-48, SIV-48). J of the outline (types (f) / (g), engine/lldf-fg.js) by hand, before / after.
//   Saved data (CLAUDE.md §5): a project opened from before (no secLib) that uses those sections gets a 'rev' item in P.legacySection once (the
//   red notice, the Report §2); secLib = 2 written; a new project has it; a type's own girder too; nothing else changed.
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const ENG = ['sections', 'model', 'rigid', 'lldf-fg', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'legacy', 'worked', 'worked-stress', 'worked-strength', 'worked-end', 'worked-hdr'].map(n => path.join(APP, `engine/${n}.js`));
const UI = ['outkit', 'vizkit', 'section', 'inputs'].map(n => path.join(APP, `ui/${n}.js`));
const W = loadShared('steps.js', ...PBD, ...ENG, ...UI, 'report.js', ...['fromtab', 'data', 'builders'].map(n => path.join(APP, `report/${n}.js`)));
const W0 = loadShared(...PBD);   // the moved engine alone: the old library
const G = vm.runInContext('GIRDERS', W), G0 = vm.runInContext('GIRDERS', W0), S = W.PSBSections, J = v => JSON.parse(JSON.stringify(v));
const near = (a, b, tol = 1e-9, m = '') => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${m} ${a} vs ${b}`);

/* dwg 9.2.3 (p. 124) as printed: [beam, width, B, A, I, y_b, y_t, S_b, S_t] */
const SHEET = [['NEXT 24F', 96, 13.75, 972, 51905, 14.94, 9.06, 3475, 5730], ['NEXT 28F', 96, 13.50, 1082, 80037, 17.23, 10.77, 4646, 7432],
  ['NEXT 32F', 96, 13.25, 1190, 116036, 19.50, 12.50, 5951, 9283], ['NEXT 36F', 96, 13.00, 1296, 160602, 21.75, 14.25, 7384, 11271],
  ['NEXT 24F', 144, 13.75, 1164, 60159, 16.10, 7.90, 3737, 7616], ['NEXT 28F', 144, 13.50, 1274, 92836, 18.55, 9.45, 5005, 9824],
  ['NEXT 32F', 144, 13.25, 1382, 134523, 20.96, 11.04, 6419, 12186], ['NEXT 36F', 144, 13.00, 1488, 186000, 23.34, 12.66, 7970, 14692]];
const proj = (girder, f) => { const P = W.PSBModel.defaultProject(); P.base.girder = girder; P.base.ts = 6; P.base.harp.n = 0; if (f) f(P); return P; };   // defaultProject: no secLib (as saved before)

test('PS-38: every NEXT F value = dwg 9.2.3; only NEXT 28F I at 144 in changed (88,218 → 92,836, the sheet\'s S_b, S_t with it); the old library otherwise kept', () => {
  SHEET.forEach(([n, w, B, A, I, yb, yt, Sb, St]) => {
    const p = G[n][w === 96 ? 'pMin' : 'pMax'];
    assert.deepEqual([p.A, p.I, p.yb, p.yt, G[n].B, G[n].wMin, G[n].wMax], [A, I, yb, yt, B, 96, 144], `${n} ${w}`);
    assert.ok(Math.abs(I / yb - Sb) <= 1 && Math.abs(I / yt - St) <= 1, `${n} ${w}: S = I / y as printed`);
    const p0 = G0[n][w === 96 ? 'pMin' : 'pMax'];
    if (n === 'NEXT 28F' && w === 144) { assert.equal(p0.I, 88218); assert.ok(Math.abs(88218 / 18.55 - 5005) > 200, 'the old value is not the sheet\'s S_b'); }
    else assert.deepEqual(J(p0), J(p), `${n} ${w}: unchanged`);
  });
  assert.deepEqual(J(S.NEXT_FIX), [{ name: 'NEXT 28F', at: 'pMax', key: 'I', old: 88218, now: 92836, w: 144, dwg: '9.2.3', page: 124 }]);
  // the engine interpolates on the flange width S × 12 (96 … 144 in): S = 12 ft: 92,836; 10 ft (t = 0.5): 80,037 + 0.5 (92,836 − 80,037) = 86,436.5; 8 ft: 80,037
  const g = S_ => W.girderGross(Object.assign(J(vm.runInContext('DEFAULTS', W)), { girder: 'NEXT 28F', S: S_ }));
  assert.equal(g(12).I, 92836); near(g(12).Sb, 92836 / 18.55); near(g(12).St, 92836 / 9.45); assert.equal(g(10).I, 86436.5); assert.equal(g(8).I, 80037);
  // withLegacy: the old app's value during fn, the corrected one after
  assert.equal(S.withLegacy(() => g(12).I), 88218); assert.equal(S.withLegacy(() => g(10).I), 84127.5); assert.equal(g(12).I, 92836);
});

test('PS-38 §4 check case: NEXT 28F, S = 12 ft (w = 144 in), 6 in topping: I, S_b, S_t before / after; S = 8 ft (96 in) identical', () => {
  const inp = S_ => W.PSBDesign.inputs(proj('NEXT 28F', P => { P.xs.bays = [S_, S_, S_, S_]; }));
  const R1 = W.PSBHoldDown.compute(J(inp(12))), R0 = S.withLegacy(() => W.PSBHoldDown.compute(J(inp(12))));
  assert.equal(R0.g.I, 88218); assert.equal(R1.g.I, 92836); near(R0.g.Sb, 88218 / 18.55); near(R1.g.Sb, 92836 / 18.55); near(R0.g.St, 88218 / 9.45); near(R1.g.St, 92836 / 9.45);   // 4,755.7 → 5,004.6; 9,335.2 → 9,823.9
  console.log(`    PS-38 check: NEXT 28F w 144 in, t_s 6 in: I 88,218 → 92,836 in⁴, S_b ${R0.g.Sb.toFixed(1)} → ${R1.g.Sb.toFixed(1)}, S_t ${R0.g.St.toFixed(1)} → ${R1.g.St.toFixed(1)} in³, I_c ${R0.cp.Ic.toFixed(0)} → ${R1.cp.Ic.toFixed(0)} in⁴`);
  const a = W.PSBHoldDown.compute(J(inp(8))), b = S.withLegacy(() => W.PSBHoldDown.compute(J(inp(8))));
  assert.deepEqual(J(a), J(b), 'at 96 in nothing changes');
});

test('PS-40: void centres = MassDOT dwg 10.1.4 / 10.1.5; A, I, y_b unchanged; J by hand before / after (SIV-48, 50 ft, no topping, 6 slabs)', () => {
  const want = { 'AASHTO SII-36 (15in)': [-7.75, 7.75], 'AASHTO SIII-36 (18in)': [-7.75, 7.75], 'AASHTO SIV-36 (21in)': [-7.75, 7.75],
    'AASHTO SII-48 (15in)': [-13.75, 0, 13.75], 'AASHTO SIII-48 (18in)': [-14.25, 0, 14.25], 'AASHTO SIV-48 (21in)': [-14.25, 0, 14.25] };
  Object.entries(want).forEach(([n, xs]) => {
    const e = S.STD[n]; assert.deepEqual(J(e.src.voids.map(v => v.x)), xs, n); assert.deepEqual(J(e.src.voidSrc), e.w > 40 ? { dwg: '10.1.5', page: 194 } : { dwg: '10.1.4', page: 193 });
    assert.deepEqual(J(e.src.voidOld), e.w > 40 ? [-14, 0, 14] : [-8, 8]);
    // the sheet's dimensions: edge to first void 10 (36 series, and S48-15) or 9½ in, then 15½ / 13¾ / 14¼ in between
    const edge = e.w / 2 - Math.max(...xs); assert.equal(edge, e.w < 40 || /SII-/.test(n) ? 10 : 9.5, n);
    const g = W.girderGross(Object.assign(J(vm.runInContext('DEFAULTS', W)), { girder: n }));
    assert.deepEqual(J(W.sectionVoids(g)).map(v => v.x), xs, n + ': drawn and used there');
  });
  const P = proj('AASHTO SIV-48 (21in)', P => { P.base.ts = 0; P.base.rows = [{ n: 10, y: 2, nd: 0, dbnd: 0 }]; P.xs.nb = 6; P.xs.bays = Array(5).fill(4); P.xs.ohL = P.xs.ohR = 1.5; P.spans.lengths = [50]; P.design = { g: 2, s: 1 }; });
  const R = W.PSBHoldDown.compute(W.PSBDesign.inputs(P)), f = R.df.fg;
  // after: t_w = 23.75 − 14.25 − 6 = 3.5; t_b = t_t = 10.5 − 6 = 4.5; b0 = 47.5 − 3.5 = 44; h0 = 21 − 4.5 = 16.5; A0 = 726; Σ s/t = 2 (44 / 4.5) + 2 (16.5 / 3.5)
  const Ja = 4 * 726 ** 2 / (2 * 44 / 4.5 + 2 * 16.5 / 3.5); near(f.jw.tw, 3.5); near(f.jw.b0, 44); near(f.J, Ja); near(Ja, 72739.95, 1e-7);
  // before (±14): t_w = 3.75; b0 = 43.75; A0 = 721.875; J = 4 (721.875)² / (2 (43.75 / 4.5) + 2 (16.5 / 3.75)) = 73,799.08
  const Jb = 4 * 721.875 ** 2 / (2 * 43.75 / 4.5 + 2 * 16.5 / 3.75); near(Jb, 73799.08, 1e-7);
  const k = 2.5 * 6 ** -0.2, b = 47.5, L = 50, m2 = J_ => k * (b / 305) ** 0.6 * (b / (12 * L)) ** 0.2 * (33759 / J_) ** 0.06, v2 = J_ => (b / 156) ** 0.4 * (b / (12 * L)) ** 0.1 * (33759 / J_) ** 0.05 * (b / 48 < 1 ? 1 : b / 48);
  near(R.dfm, m2(Ja)); near(R.dfv, v2(Ja)); near(m2(Ja), 0.3291937, 1e-6); near(m2(Jb), 0.3289083, 1e-6); near(v2(Ja), 0.4641012, 1e-6); near(v2(Jb), 0.4637659, 1e-6);
  console.log(`    PS-40 check: SIV-48, 50 ft, no topping, 6 slabs: J ${Jb.toFixed(0)} → ${Ja.toFixed(0)} in⁴, DF_M ${m2(Jb).toFixed(4)} → ${m2(Ja).toFixed(4)}, DF_V ${v2(Jb).toFixed(4)} → ${v2(Ja).toFixed(4)}`);
  assert.equal(R.g.A, 684); assert.equal(R.g.I, 33759); assert.equal(R.g.yb, 10.43);
});

test('PS-38 / PS-40 saved data: the open-time notice once (rev items, secLib), a type\'s own girder, new projects none, idempotent; Report §2', () => {
  // a project saved before (no secLib) on the NEXT 28F
  const old = X => JSON.stringify(X, null, 2);   // a file written before this change (exportJSON now stamps secLib)
  const P = proj('NEXT 28F'); assert.equal(P.secLib, undefined);
  const t = old(P), r = W.PSBModel.importJSON(t), Q = r.project;
  assert.equal(Q.secLib, 2); assert.equal(Q.base.girder, 'NEXT 28F');
  assert.deepEqual(J(Q.legacySection), { decision: 'PS-38 / PS-40 (engineer 2026-11-14)', items: [{ kind: 'rev', rev: 'PS-38', where: 'base', label: 'Base design', from: 'NEXT 28F', to: 'NEXT 28F', old: { I: 88218, w: 144 }, now: { I: 92836, w: 144 } }] });
  assert.ok(r.notes.join(' ').includes('Girder section values revised since this project was saved (PS-38): Base design "NEXT 28F" (I at 144 in). See the notice above the results.'), r.notes.join(' '));
  assert.equal(S.tags(Q), 'PS-38');
  assert.match(S.text(Q.legacySection.items[0]), /^Base design: section value corrected \(PS-38\): "NEXT 28F" at the maximum width \(144 in nominal\): I 88,218 → 92,836 in⁴ \(MassDOT Bridge Manual Part II dwg 9\.2\.3, p\. 124;/);
  assert.equal(t, old(P), 'the stored text not changed by reading it');
  const r2 = W.PSBModel.importJSON(W.PSBModel.exportJSON(Q)); assert.deepEqual(J(r2.project.legacySection), J(Q.legacySection)); assert.equal(r2.notes.length, 0, 'once');
  // a new project: secLib = 2, no notice when it is saved with the NEXT 28F and opened again
  const N = W.PSBModel.newProject(); assert.equal(N.secLib, 2); N.base.girder = 'NEXT 28F';
  const rn = W.PSBModel.importJSON(W.PSBModel.exportJSON(N)); assert.equal(rn.project.legacySection, undefined); assert.equal(rn.notes.length, 0);
  // a project from before on another shape: nothing written (its stored text unchanged by opening and writing it); the NEXT 28F chosen
  // later with today's library: exportJSON writes secLib, no notice when it is opened again
  const B0 = proj('PCI BT-72'), rb = W.PSBModel.importJSON(old(B0)); assert.equal(rb.project.secLib, undefined); assert.equal(rb.project.legacySection, undefined); assert.equal(rb.notes.length, 0);
  assert.equal(JSON.parse(W.PSBModel.exportJSON(rb.project)).secLib, undefined, 'not written');
  rb.project.base.girder = 'NEXT 28F'; const tb = W.PSBModel.exportJSON(rb.project); assert.equal(JSON.parse(tb).secLib, 2);
  const rb2 = W.PSBModel.importJSON(tb); assert.equal(rb2.notes.length, 0); assert.equal(rb2.project.legacySection, undefined);
  // a voided slab (base) and the NEXT 28F as a girder type's own girder
  const P2 = proj('AASHTO SIV-48 (21in)', X => { X.types = W.PSBBridge.newTypes(X); X.types[1].ovr.girder = 'NEXT 28F'; });
  const Q2 = W.PSBModel.importJSON(old(P2)).project;
  assert.deepEqual(J(Q2.legacySection.items.map(i => [i.rev, i.where, i.from, i.old, i.now])), [['PS-40', 'base', 'AASHTO SIV-48 (21in)', { voids: [-14, 0, 14] }, { voids: [-14.25, 0, 14.25] }],
    ['PS-38', `type:${P2.types[1].id}`, 'NEXT 28F', { I: 88218, w: 144 }, { I: 92836, w: 144 }]]);
  assert.equal(S.tags(Q2), 'PS-40, PS-38');
  assert.match(S.text(Q2.legacySection.items[0]), /^Base design: void spacing of "AASHTO SIV-48 \(21in\)" revised \(PS-40\): void centres 0, ±14 → 0, ±14\.25 in from the ℄ \(dimensioned on MassDOT Bridge Manual Part II dwg 10\.1\.5, p\. 194;/);
  // a PS-31 migration in the same open (21×48 voided → SIV-48): told once, by PS-31
  const Q3 = W.PSBModel.importJSON(old(proj('Deck slab 21×48 (voided)'))).project;
  assert.deepEqual(J(Q3.legacySection.items.map(i => [i.rev || 'PS-31', i.from, i.to])), [['PS-31', 'Deck slab 21×48 (voided)', 'AASHTO SIV-48 (21in)']]);
  // the notice's dismissal key: the PS-31 items' as before, a rev item adds its decision
  assert.equal(S.sig(Q2), `base|AASHTO SIV-48 (21in)|AASHTO SIV-48 (21in)|PS-40;type:${P2.types[1].id}|NEXT 28F|NEXT 28F|PS-38`);
  assert.equal(S.sig(Q3), 'base|Deck slab 21×48 (voided)|AASHTO SIV-48 (21in)');
  // the Report §2 assumption
  const B = W.PSBReportData.compute(Q, null, 'gov'); assert.equal(B.err, '');
  const a = W.PSBReportBuild.model(B, {}).sections.find(q => q.id === 'proj').subs.find(q => /Assumptions/.test(q.title)), at = JSON.stringify(a.items);
  assert.ok(at.includes('Base design: section value corrected (PS-38): \\"NEXT 28F\\" at the maximum width (144 in nominal): I 88,218 → 92,836 in⁴'), at.slice(0, 400));
});

test('PS-38: an old-app design on the NEXT 28F at 144 in: the import is faithful (verify with the old value), then the notice', () => {
  const P = proj('NEXT 28F', X => { X.xs.bays = [12, 12, 12, 12]; }), inp = W.PSBDesign.inputs(P);
  const src = W.PSBLegacy.fromText(JSON.stringify(inp, null, 1), 'old.json'); assert.ok(src.ok);
  const c = W.PSBLegacy.convert(src.src); assert.ok(c.ok);
  const res = W.PSBLegacy.verify(c); assert.equal(res.error, null); assert.equal(res.values, true, 'both computed with the old app\'s 88,218');
  assert.equal(G['NEXT 28F'].pMax.I, 92836, 'the corrected value back after');
  const Q = c.project; W.PSBBridge.migrate(Q); W.PSBLegacy.restore(Q); W.PSBSections.migrate(Q);
  assert.deepEqual(J(Q.legacySection.items.map(i => [i.rev, i.where, i.from])), [['PS-38', 'base', 'NEXT 28F']]);
  const R = W.PSBHoldDown.compute(W.PSBDesign.inputs(Q)); assert.equal(R.error, null); assert.equal(R.g.I, 92836);
});
