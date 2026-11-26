// apps/ps-bridge batch H (2026-11-15): the Drawings tab's added sheets (ui/sheets.js PSBSheets.build), each number on a sheet = its model or
// engine value (display and export only; no new calculation):
//   H1. the cover and sheet index (every sheet of the set, numbered, with its title; the sheets left out), the general notes (the
//       specifications and editions named; each girder type's materials = its effective inputs, PSBDesign.cellInputs), the design summary (per
//       girder type and check group the governing check over its lines = the largest engine ratio R.checks[i].r of that group's checks, found
//       here directly from the engine results of every type on every line; the lowest HL-93 inventory RF).
//   H2. the bearing reactions (every line at every support = PSBHandoffs.srAll, the hand-off's values; each span's end share at a pier), the
//       analysis diagrams of each girder type (every plotted point = R.diagrams at the engine's station, the labels its Strength I values).
//   H3. camber and haunch (the curves and the tenth-point table = R.haunch, the stages = R.cam), end zone (the splitting zone = R.splitZone,
//       the confinement chain = R.conf.provExt at R.conf.s, 1.5d = R.conf.reqExt, the checks), diaphragms (each entered a, L − a, P; a line
//       per diaphragm), deck (overhang, S, t, the bars' effective depths, the negative design section = R.deck; each type's ratios).
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { loadShared, test, ROOT } from './harness.mjs';
import { MIDAS_CASES, midasFixtures } from './psbridge-midas-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', 'dxf.js', ...PBD, ...['sections', 'model', 'rigid', 'lldf-fg', 'haunch', 'reltension', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'handoffs', 'rating-along', 'demands'].map(n => path.join(APP, `engine/${n}.js`)),
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
  B.sheets.filter(s => ids.test(s.id)).forEach(s => { const E = B.D.E.slice(s.i0, s.iC), by = new Map();
    // the tables: their horizontal lines (S-TBL) span the table's width; a text belongs to the table whose x range holds it at that y
    const tb = new Map(); E.filter(e => e.t === 'LINE' && e.l === 'S-TBL' && Math.abs(e.pts[0][1] - e.pts[1][1]) < 1e-9).forEach(e => { const x0 = Math.min(e.pts[0][0], e.pts[1][0]), x1 = Math.max(e.pts[0][0], e.pts[1][0]), key = `${x0.toFixed(4)}|${x1.toFixed(4)}`;
      const q = tb.get(key) || { x0, x1, y0: Infinity, y1: -Infinity }; q.y0 = Math.min(q.y0, e.pts[0][1]); q.y1 = Math.max(q.y1, e.pts[0][1]); tb.set(key, q); });
    const T = [...tb.values()], tOf = e => T.findIndex(q => e.pts[0][0] >= q.x0 && e.pts[0][0] <= q.x1 && e.pts[0][1] >= q.y0 && e.pts[0][1] <= q.y1);
    E.filter(e => e.t === 'TEXT').forEach(e => { const y = `${tOf(e)}|${e.pts[0][1].toFixed(4)}`; if (!by.has(y)) by.set(y, []); by.get(y).push(e); });
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

const dims = (B, s) => B.D.E.slice(s.i0, s.iC).filter(e => e.t === 'DIM');
function h3() {
  const out = layouts();
  { const P = W.PSBModel.newProject(); P.base.deck.on = true; P.base.loads.diaph = [{ P: 5, a: 40 }, { P: 4.5, a: 80 }]; P.base.opt.endOh = 9; out.deckDia = P; }
  { const P = W.PSBModel.newProject(); P.base.girder = 'AASHTO BIII-36 (39in)'; P.base.ts = 6; P.base.harp.n = 0; P.base.rows = [{ n: 16, y: 2, nd: 4, dbnd: 8 }, { n: 4, y: 37, nd: 0, dbnd: 0 }];
    P.xs.bays = [3, 3, 3, 3]; P.xs.ohL = 1.5; P.xs.ohR = 1.5; P.spans.lengths = [70]; P.base.opt.endOh = 6; out.box = P; }
  return out;
}

test('H3 camber and haunch: the curves and the tenth-point table = R.haunch; the midspan stages and components = R.cam', () => {
  for (const [name, P0] of Object.entries(h3())) for (const paper of ['D', 'B']) {
    const P = fill(J(P0)), B = SH.build(P, { paper, date: '2026-11-15' }), TM = SH.typeModels(P, {}), amp = paper === 'B' ? 0.7 : 1.1;
    TM.types.forEach(t => { const s = B.sheets.find(q => q.id === 'camb' + t.k), R = compute(W.PSBDesign.cellInputs(P, t.k, t.lines[0])), Hn = R.haunch, lab = `${name} ${paper} ${t.label}`;
      assert.ok(s && !s.over, lab); const E = B.D.E.slice(s.i0, s.iC), ax = E.find(e => e.t === 'LINE' && e.l === 'S-DIAG-AXIS');
      const ser = [['S-CAMB-ERECT', 'camErect'], ['S-CAMB-DECK', 'camDeck'], ['S-CAMB-SEAT', 'camSeat'], ['S-HAUNCH', 'buildup']], mx = Math.max(...Hn.flatMap(r => ser.map(q => Math.abs(r[q[1]])))), vs = amp * s.k / mx;
      ser.forEach(([l, f]) => { const pl = E.find(e => e.t === 'PL' && e.l === l); assert.equal(pl.pts.length, Hn.length, lab + l);
        pl.pts.forEach((p, i) => { close(p[0] - ax.pts[0][0], Hn[i].x * 12, lab + ' x'); close((p[1] - ax.pts[0][1]) / vs, Hn[i][f], `${lab} ${f} at ${Hn[i].x}`); }); });
      const R6 = rows(B, new RegExp('^camb' + t.k + '$'));
      Hn.forEach(r => assert.ok(R6.some(q => q.join('|') === [r.x.toFixed(1), f3(r.par), f3(r.camErect), f3(r.camDeck), f3(r.camSeat), r.buildup.toFixed(2)].join('|')), `${lab}: haunch row x = ${r.x}`));
      [['RELEASE', R.cam.rel], ['ERECTION', R.cam.erect], ['DECK PLACEMENT', R.cam.afterDeck], ['BEAM SEAT', R.cam.seat], ['FINAL', R.cam.final]].forEach(([a, v]) => assert.ok(R6.some(q => q[0] === a && q[1] === f3(v)), `${lab} ${a}`));
      [['PRESTRESS', R.cam.dPS], ['SELF-WEIGHT', R.cam.dSW], ['DECK + HAUNCH', R.cam.dDK], ['DC2 + DW', R.cam.dSD], ['LL + IM', R.cam.dLL], ['LL LIMIT', R.cam.llLim]].forEach(([a, v]) => assert.ok(R6.some(q => q[0] === a && q[1] === f3(v)), `${lab} ${a}`));
      const T = texts(B, s).map(e => e.s).join(' ').replace(/\s+/g, ' ');
      assert.ok(T.includes(`AT THE CL BEARINGS ${Hn[0].buildup.toFixed(2)} AND ${Hn[Hn.length - 1].buildup.toFixed(2)} IN, AT MIDSPAN ${Hn[5].buildup.toFixed(2)} IN`), lab + ' haunch at the supports and midspan');
      // HP (2026-11-25, engine/haunch.js): t_h is the minimum haunch at midspan; toward the bearings t_h + Δ_deck (Δ_deck < 0 too, engineer 2026-11-26)
      const th = +t.inp.th, dd = R.cam.afterDeck; assert.ok(R.hp, lab + ' HP applied');
      close(Hn[5].buildup, Math.max(th, 0.5), lab + ' midspan haunch'); close(Hn[0].buildup, Math.max(th + dd, 0.5), lab + ' bearing haunch');
      assert.ok(T.includes('IS THE MINIMUM, AT MIDSPAN AT THE GIRDER CENTRELINE'), lab + ' haunch note');
    });
  }
});

test('H3 end zone: splitting zone, confinement chain and 1.5d, CL bearing, the tables and checks = the engine', () => {
  for (const [name, P0] of Object.entries(h3())) for (const paper of ['D', 'B']) {
    const P = fill(J(P0)), B = SH.build(P, { paper, date: '2026-11-15' }), TM = SH.typeModels(P, {});
    TM.types.forEach(t => { const s = B.sheets.find(q => q.id === 'endz' + t.k), R = compute(W.PSBDesign.cellInputs(P, t.k, t.lines[0])), cf = R.conf, lab = `${name} ${paper} ${t.label}`, o = t.inp.opt;
      assert.ok(s && !s.over, lab); const Dm = dims(B, s), T = rows(B, new RegExp('^endz' + t.k + '$'));
      close(Dm.find(e => /^SPLITTING ZONE/.test(e.s)).meas, R.splitZone, lab + ' h/4');
      if (t.oh > 0) close(Dm.find(e => /^E_END/.test(e.s)).meas, t.oh, lab + ' e_end'); else assert.ok(!Dm.some(e => /^E_END/.test(e.s)), lab);
      if (!cf.exempt) { const ch = Dm.filter(e => e.s.indexOf('@') >= 0 || (!/=/.test(e.s) && Math.abs(e.ang) < 1e-9 && !/ZONE|1\.5D|E_END/.test(e.s)));
        close(ch.reduce((a, e) => a + e.meas, 0), cf.provExt, lab + ' (n - 1) s'); close(Dm.find(e => /^REQUIRED 1\.5D/.test(e.s)).meas, cf.reqExt, lab + ' 1.5d');
        assert.equal(B.D.E.slice(s.i0, s.iC).filter(e => e.t === 'LINE' && e.l === 'S-REBAR').length, Math.round(cf.n), lab + ' a line per confinement bar');
        assert.ok(T.some(q => q[0] === 'BAR' && q[1] === `NO. ${cf.barNo.toFixed(0)} AT ${cf.s.toFixed(2)}`) && T.some(q => q[0] === 'EXTENT PROVIDED (N - 1) S' && q[1] === cf.provExt.toFixed(1)), lab); }
      assert.ok(T.some(q => q[0] === 'AS REQUIRED' && q[1] === R.AsSplit.toFixed(2)) && T.some(q => q[0] === 'LEGS X AREA PROVIDED' && q[1] === `${(+o.splitN).toFixed(0)} X ${(+o.splitAv).toFixed(2)} = ${R.AsSplitProv.toFixed(2)}`), lab + ' splitting');
      ['Splitting steel (5.9.4.4)', 'Confinement steel (5.9.4.4.2)', 'Release tens. steel (5.9.2.3.1b)'].forEach(n => { const q = R.checks.find(c => c.n === n); if (q) assert.ok(T.some(r => r[0] === up(n) && r[4] === f3(q.r) && r[1] === f3(q.v)), `${lab} ${n}`); });
    });
  }
});

test('H3 diaphragms and deck: each diaphragm at its entered a (and L - a, P); the deck section dimensions and ratios = R.deck', () => {
  for (const [name, P0] of Object.entries(h3())) for (const paper of ['D', 'B']) {
    const P = fill(J(P0)), B = SH.build(P, { paper, date: '2026-11-15' }), TM = SH.typeModels(P, {}), lab = `${name} ${paper}`;
    const any = TM.types.some(t => (t.inp.loads.diaph || []).length) || (P.spans.lengths.length > 1 && P.spans.continuity === 'composite');
    const sd = B.sheets.find(q => q.id === 'diaph');
    if (!any) { assert.ok(!sd && B.miss.some(q => q[0] === 'DIAPHRAGM DETAILS'), lab); }
    else { assert.ok(sd && !sd.over, lab); const E = B.D.E.slice(sd.i0, sd.iC), R = rows(B, /^diapht\d*$/);
      assert.equal(E.filter(e => e.t === 'LINE' && e.l === 'S-DIAP').length, TM.types.reduce((a, t) => a + (t.inp.loads.diaph || []).length, 0), lab + ' a line per diaphragm');
      TM.types.forEach(t => (t.inp.loads.diaph || []).forEach((d, i) => assert.ok(R.some(q => q[0] === up(t.label) && q[3] === String(i + 1) && q[4] === f2(d.a) && q[5] === f2(t.L - d.a) && q[6] === f2(d.P)), `${lab} ${t.label} diaphragm ${i + 1}`)));
      const ch = E.filter(e => e.t === 'DIM'); close(ch.reduce((a, e) => a + e.meas, 0), TM.types.reduce((a, t) => a + t.L * 12, 0), lab + ' the chains = L of each type'); }
    const ex = TM.types.find(t => t.R.deck && t.lines.includes(1)), sk = B.sheets.find(q => q.id === 'deck');
    if (!ex) { assert.ok(!sk && B.miss.some(q => q[0] === 'DECK REINFORCEMENT AND OVERHANG'), lab); continue; }
    assert.ok(sk && !sk.over, lab); const Dk = compute(W.PSBDesign.cellInputs(P, ex.k, ex.lines[0])).deck, Dm = dims(B, sk), at = re => Dm.find(e => re.test(e.s)).meas;
    close(at(/^OVERHANG/), Dk.oh * 12, 'overhang'); close(at(/^S = /), Dk.Ls * 12, 'S'); close(at(/^T = /), Dk.ts, 't'); close(at(/^D TOP/), Dk.neg.dEff, 'd top'); close(at(/^D BOT/), Dk.pos.dEff, 'd bot');
    if (Dk.xneg > 0) close(at(/^NEG\. DESIGN SECTION/), Dk.xneg, 'x neg'); if (Dk.bBar > 0) close(at(/^BARRIER/), Dk.bBar, 'barrier');
    const R = rows(B, /^deck$/);
    TM.types.forEach(t => { if (!t.R.deck) return; const q = compute(W.PSBDesign.cellInputs(P, t.k, t.lines[0])), ck = n => q.checks.find(c => c.n === n).r;
      assert.ok(R.some(r => r[0] === up(t.label) && r[3] === q.deck.Mu_pos.toFixed(2) && r[4] === q.deck.pos.phiMn.toFixed(2) && r[5] === f3(ck('Deck +M')) && r[8] === f3(ck('Deck −M')) && r[11] === f3(ck('Deck overhang'))), `${lab} deck row ${t.label}`); });
  }
});
