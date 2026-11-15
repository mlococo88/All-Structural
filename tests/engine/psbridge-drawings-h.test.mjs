// apps/ps-bridge batch H (2026-11-15): the Drawings tab's added sheets (ui/sheets.js PSBSheets.build), each number on a sheet = its model or
// engine value (display and export only; no new calculation):
//   H1. the cover and sheet index (every sheet of the set, numbered, with its title; the sheets left out), the general notes (the
//       specifications and editions named; each girder type's materials = its effective inputs, PSBDesign.cellInputs), the design summary (per
//       girder type and check group the governing check over its lines = the largest engine ratio R.checks[i].r of that group's checks, found
//       here directly from the engine results of every type on every line; the lowest HL-93 inventory RF).
//   H2. the bearing reactions (every line at every support = PSBHandoffs.srAll, the hand-off's values; each span's end share at a pier), the
//       analysis diagrams of each girder type (every plotted point = R.diagrams at the engine's station, the labels its Strength I values).
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { loadShared, test, ROOT } from './harness.mjs';
import { MIDAS_CASES, midasFixtures } from './psbridge-midas-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', 'dxf.js', ...PBD, ...['sections', 'model', 'rigid', 'lldf-fg', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'handoffs', 'rating-along', 'demands'].map(n => path.join(APP, `engine/${n}.js`)),
  ...['vizkit', 'strands', 'view3d', 'xsfig', 'plan', 'dash', 'summary', 'sheets'].map(n => path.join(APP, `ui/${n}.js`)));
W.PSBSections.install();
const X = W.SharedDxf, SH = W.PSBSheets, BR = W.PSBBridge, J = v => JSON.parse(JSON.stringify(v));
const f2 = v => (+v).toFixed(2), f3 = v => (+v).toFixed(3);
const close = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b)), `${m}: ${a} vs ${b}`);
const compute = inp => W.PSBHoldDown.compute(J(inp));

function layouts() {
  const out = {};
  out.newProject = W.PSBModel.newProject();
  { const P = W.PSBModel.newProject(); P.project.name = 'Route 9 over the Mill River'; P.project.number = 'B-123'; P.project.owner = 'Town of Example'; P.spans.lengths = [80, 110, 80]; P.spans.continuity = 'composite'; P.xs.skews = [15, 15, 15, 15];
    P.xs.nb = 6; P.xs.bays = [8, 9, 9.5, 9, 8]; P.types = BR.newTypes(P); BR.syncSpans(P); out.threeSpans = P; }
  { const P = W.PSBModel.newProject(); P.base.owner = 'MassDOT'; P.base.mat.fc = 9; P.base.mat.fci = 7; P.types[1].ovr = Object.assign(P.types[1].ovr || {}, { 'mat.fc': 8 }); out.massdot = P; }
  return out;
}
const fill = P => { BR.fill(P); return P; };
/* the texts of a sheet's drawing (not its title block), and its table rows: TEXT entities of one table row share their y */
const texts = (B, s) => B.D.E.slice(s.i0, s.iC).filter(e => e.t === 'TEXT');
function rows(B, ids) {
  const out = [];
  B.sheets.filter(s => ids.test(s.id)).forEach(s => { const by = new Map();
    texts(B, s).forEach(e => { const y = e.pts[0][1].toFixed(4); if (!by.has(y)) by.set(y, []); by.get(y).push(e); });
    by.forEach(a => out.push(a.sort((p, q) => p.pts[0][0] - q.pts[0][0]).map(e => e.s))); });
  return out;
}
const up = v => X.str(String(v)).toUpperCase();

test('H1 cover: the sheet index lists every sheet of the set with its number and title; the title block says sheet n of N', () => {
  for (const [name, P0] of Object.entries(layouts())) for (const paper of ['D', 'B']) {
    const P = fill(J(P0)), B = SH.build(P, { paper, date: '2026-11-15' }), R = rows(B, /^cover\d*$/);
    assert.ok(B.sheets[0].id === 'cover', name);
    B.sheets.forEach(s => assert.ok(R.some(r => r[0] === String(s.n) && r[1] === up(s.title)), `${name} ${paper}: sheet ${s.n} ${s.title} in the index`));
    const T = texts(B, B.sheets[0]).map(e => e.s);
    assert.ok(T.includes(up(P.project.name)), name + ' project name');
    if (P.project.owner) assert.ok(T.some(t => t === up('OWNER / CLIENT: ' + P.project.owner)), name + ' owner');
    B.sheets.forEach(s => assert.ok(B.D.E.slice(s.iC, s.i1).some(e => e.t === 'TEXT' && e.s === `${s.n} OF ${B.sheets.length}`), `${name} ${s.id}: n OF N`));
  }
});

test('H1 general notes: the specifications named, the owner manual, and each girder type\'s materials = its inputs', () => {
  for (const [name, P0] of Object.entries(layouts())) {
    const P = fill(J(P0)), B = SH.build(P, { date: '2026-11-15' }), s = B.sheets.find(q => q.id === 'notes'), T = texts(B, s).map(e => e.s).join(' ');
    assert.ok(/AASHTO LRFD BRIDGE DESIGN SPECIFICATIONS, 10TH ED\. \(2024\)/.test(T) && /MBE\), 4TH ED\. \(2026\)/.test(T), name + ' editions');
    if (name === 'massdot') assert.ok(T.includes(up(W.PBD.OWN_RULES.owners.MassDOT.manual)), name + ' owner manual');
    else assert.ok(/OWNER RULES: NONE \(AASHTO\)/.test(T), name);
    assert.ok(T.includes(`FUTURE WEARING SURFACE ${(+P.xs.dl.fws).toFixed(1)} PSF`), name + ' fws');
    const R = rows(B, /^notes\d*$/);
    BR.types(P).forEach((t, k) => { const L = BR.typeLines(P, k); if (!L.length) return; const inp = W.PSBDesign.cellInputs(P, k, L[0]), m = inp.mat, st = inp.str;
      const r = R.find(q => q[0] === up(t.label)); assert.ok(r, `${name}: a row for ${t.label}`);
      assert.deepEqual(r.slice(2, 11), [up(inp.girder), f2(m.fc), f2(m.fci), f2(m.fcd), `${(+m.wcLoad).toFixed(3)} / ${(+m.wcdLoad).toFixed(3)}`, up(String(st.size).replace(/\s*in$/i, '"')), (+st.fpu).toFixed(1), f2(st.jack), String(Math.round(+st.Ep))], `${name} ${t.label}`); });
    if (name === 'massdot') assert.ok(R.some(r => r[0] === 'EXTERIOR S1' && r[3] === '8.00') && R.some(r => r[0] === 'INTERIOR S1' && r[3] === '9.00'), 'a type\'s own f\'c');
  }
});

test('H1 design summary: each row = the largest engine ratio of the group\'s checks over the type\'s lines (found here from the engine), the lowest RF', () => {
  const GR = W.PSBDashUI.GROUPS;
  for (const [name, P0] of Object.entries(layouts())) {
    const P = fill(J(P0)), B = SH.build(P, { date: '2026-11-15' }), R = rows(B, /^summ\d*$/).filter(r => r.length === 12 && r[0] !== 'TYPE');
    let n = 0;
    BR.types(P).forEach((t, k) => { const L = BR.typeLines(P, k); if (!L.length) return;
      const res = L.map(g => ({ g, R: compute(W.PSBDesign.cellInputs(P, k, g)) }));
      GR.forEach(gp => { let best = null;
        res.forEach(({ g, R: Rr }) => Rr.checks.forEach(q => { if (!gp.checks.some(([cn]) => cn === q.n)) return; const bad = x => typeof x !== 'number' || isNaN(x);
          if (!best || (bad(q.r) && !bad(best.q.r)) || (!bad(q.r) && !bad(best.q.r) && q.r > best.q.r)) best = { q, g }; }));
        const row = R.find(r => r[0] === up(t.label) && r[3] === up(gp.name));
        if (!best) { assert.ok(!row, `${name} ${t.label} ${gp.name}: no row`); return; }
        assert.ok(row, `${name} ${t.label} ${gp.name}: a row`); n++;
        assert.equal(row[4], up(best.q.n)); assert.equal(row[5], 'G' + best.g);
        assert.equal(row[7], f3(best.q.v), `${name} ${gp.name} demand`); assert.equal(row[8], f3(best.q.lim), `${name} ${gp.name} limit`); assert.equal(row[10], f3(best.q.r), `${name} ${gp.name} ratio`);
        assert.equal(row[11], !best.q.pass ? 'FAIL' : isFinite(best.q.r) ? 'PASS' : 'REVIEW'); });
      // the lowest HL-93 inventory RF of the type (the Summary tab's, ui/summary.js rfOf over the lines)
      const rf = res.map(({ g, R: Rr }) => W.PSBDashUI.RATING.rf.map(([nm, f]) => ({ nm, v: f(Rr), g })).filter(z => typeof z.v === 'number' && z.v < 99)).flat().reduce((b, z) => !b || z.v < b.v ? z : b, null);
      const rr = R.find(r => r[0] === up(t.label) && r[3] === 'RATING (HL-93 INVENTORY)');
      if (rf) { assert.ok(rr, name + ' RF row'); assert.equal(rr[10], f3(rf.v)); assert.equal(rr[5], 'G' + rf.g); assert.equal(rr[4], up(rf.nm)); }
    });
    assert.ok(n > 5, `${name}: ${n} rows checked`);
  }
});

test('H2 bearing reactions: every girder line at every support = the hand-off srAll values; the pier shares', () => {
  for (const [name, P0] of Object.entries(layouts())) {
    const P = fill(J(P0)), B = SH.build(P, { date: '2026-11-15' }), A = BR.results(P, compute), r = W.PSBHandoffs.srAll(P, A.cells), R = rows(B, /^reac\d*$/).filter(q => q.length === 6);
    assert.ok(r.ok, name); const S = r.payload.supports, ns = S.length - 1, sup = k => k === 0 ? 'ABUT. 1' : k === ns ? 'ABUT. 2' : `PIER ${k}`;
    let n = 0;
    S.forEach((s, k) => s.girders.forEach(g => { assert.ok(R.some(q => q[0] === g.label && q[1] === sup(k) && q[2] === f2(s.x) && q[3] === f3(g.DC1) && q[4] === f3(g.DC2) && q[5] === f3(g.DW)), `${name} ${g.label} ${sup(k)}`); n++; }));
    assert.equal(n, (ns + 1) * P.xs.nb);
    if (ns > 1) for (let k = 1; k < ns; k++) r.shares[k].forEach((a, i) => a.forEach(q => assert.ok(R.some(z => z[0] === `G${i + 1}` && z[1] === sup(k) && z[2] === `SPAN ${q.s} ${q.end === 'right' ? 'RIGHT' : 'LEFT'} END` && z[3] === f3(q.DC1) && z[4] === f3(q.DC2) && z[5] === f3(q.DW)), `${name} share G${i + 1} ${sup(k)} S${q.s}`)));
  }
});

test('H2 analysis diagrams: each girder type\'s envelopes = R.diagrams at every station; the labels = its Strength I values', () => {
  for (const [name, P0] of Object.entries(layouts())) for (const paper of ['D', 'B']) {
    const P = fill(J(P0)), B = SH.build(P, { paper, date: '2026-11-15' }), TM = SH.typeModels(P, {}), amp = paper === 'B' ? 0.7 : 1.1;
    TM.types.forEach(t => {
      const s = B.sheets.find(q => q.id === 'diag' + t.k), E = B.D.E.slice(s.i0, s.iC), R = compute(W.PSBDesign.cellInputs(P, t.k, t.lines[0])), Dg = R.diagrams, lab = `${name} ${paper} ${t.label}`;
      assert.ok(!s.over, lab + ' fits');
      const ax = E.filter(e => e.t === 'LINE' && e.l === 'S-DIAG-AXIS' && Math.abs(e.pts[0][1] - e.pts[1][1]) < 1e-9);   // the two axes (moment, shear)
      assert.equal(ax.length, 2, lab); close(ax[0].pts[1][0] - ax[0].pts[0][0], R.L * 12, lab + ' axis = L');
      const PL = E.filter(e => e.t === 'PL' && /^S-DIAG-/.test(e.l));
      assert.equal(PL.length, 13, lab + ' 7 moment + 6 shear curves');
      const M = [Dg.map(r => r.M_g + r.M_DC1), ...['M_DC2', 'M_DW', 'M_LLpos', 'M_LLneg', 'M_StrI_pos', 'M_StrI_neg'].map(f => Dg.map(r => r[f]))], V = ['V_DC', 'V_DW', 'V_LLpos', 'V_LLneg', 'V_StrI_pos', 'V_StrI_neg'].map(f => Dg.map(r => r[f]));
      [[M, PL.slice(0, 7), ax[0]], [V, PL.slice(7), ax[1]]].forEach(([ser, pls, a]) => { const mx = Math.max(...ser.flat().map(Math.abs)), vs = amp * s.k / mx, x0 = a.pts[0][0], y0 = a.pts[0][1];
        ser.forEach((ys, j) => { assert.equal(pls[j].pts.length, Dg.length, lab); pls[j].pts.forEach((p, i) => { close(p[0] - x0, Dg[i].x * 12, lab + ' x'); close((p[1] - y0) / vs, ys[i], `${lab} curve ${j} at x = ${Dg[i].x}`); }); }); });
      const T = E.filter(e => e.t === 'TEXT').map(e => e.s), near = x => Dg.reduce((b, r, i) => Math.abs(r.x - x) < Math.abs(Dg[b].x - x) ? i : b, 0);
      for (let i = 0; i <= 10; i++) { const v = Dg[near(i * R.L / 10)].M_StrI_pos; if (Math.abs(v) > 1e-6) assert.ok(T.includes(v.toFixed(0)), `${lab}: M_u at ${i}/10 L = ${v.toFixed(0)}`); }
      assert.ok(T.includes(Dg[0].V_StrI_pos.toFixed(1)) && T.includes(Dg[Dg.length - 1].V_StrI_neg.toFixed(1)), lab + ' end shears');
      assert.ok(T.some(x => /^DEMANDS: THIS APP'S ANALYSIS/.test(x)), lab + ' demand source');
    });
  }
});

test('H2 analysis diagrams of a girder type with MIDAS demands: the file named, DC2 / DW / LL from it, the curves = R.diagrams', () => {
  const F = midasFixtures(rel => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/projects', rel), 'utf8')));
  const CS = MIDAS_CASES(() => W.PSBModel.newProject(), F);
  let n = 0;
  for (const [name, P0] of Object.entries(CS)) {
    const P = fill(J(P0)), B = SH.build(P, { date: '2026-11-15' }), TM = SH.typeModels(P, {});
    TM.types.forEach(t => { const R = compute(W.PSBDesign.cellInputs(P, t.k, t.lines[0])), s = B.sheets.find(q => q.id === 'diag' + t.k), T = texts(B, s).map(e => e.s).join(' ');
      const d = W.PSBDemands.describe(P, t.T);
      assert.ok(T.includes(up(`DEMANDS: ${d.what}`)), `${name} ${t.label}: ${d.what}`);
      if (R.useExt) { assert.ok(/FROM THE IMPORTED FILE/.test(T), name); n++; }
      const PL = B.D.E.slice(s.i0, s.iC).filter(e => e.t === 'PL' && e.l === 'S-DIAG-STR'), ax = B.D.E.slice(s.i0, s.iC).find(e => e.t === 'LINE' && e.l === 'S-DIAG-AXIS');
      const Dg = R.diagrams, ser = [Dg.map(r => r.M_g + r.M_DC1), ...['M_DC2', 'M_DW', 'M_LLpos', 'M_LLneg', 'M_StrI_pos', 'M_StrI_neg'].map(f => Dg.map(r => r[f]))], vs = 1.1 * s.k / Math.max(...ser.flat().map(Math.abs));
      PL[0].pts.forEach((p, i) => close((p[1] - ax.pts[0][1]) / vs, Dg[i].M_StrI_pos, `${name} M_u at ${Dg[i].x}`)); });
  }
  assert.ok(n >= 4, 'MIDAS / table designs drawn: ' + n);
});
