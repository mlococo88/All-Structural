// apps/ps-bridge batch D1 (2026-11-15): the demand source of each girder type (engine/demands.js, P.demands): this app's analysis, a custom
//   table or a MIDAS demands file, given to the moved engine as the old app gave its MIDAS import (inputs.external with _selSpan; computeAll's
//   own buildExternal). Checked here: (1) the engine inputs of the MIDAS / table designs (tests/engine/psbridge-midas-cases.mjs) and the
//   worked steps = the engine's values; (2) the §4 check case (continuous, span 2 of the old app's 3-span file): before (this app's analysis)
//   and after (the file), Strength I at midspan and at the pier worked by hand from the imported envelopes; (3) a project saved before (no
//   P.demands) is byte-identical through import / export and computes as before; a type set back to this app's analysis is as before;
//   (4) the file reader: removed 2026-11-25 (NOMCT: no MIDAS import; a saved file is converted or kept, tests/engine/psbridge-nomct.test.mjs);
//   (5) the input errors and warnings; (6) the custom table reaches the engine as entered (this app's shear sign);
//   (7) an old bridge model's other cells with MIDAS demands restored as types with their demands, computed = the old app's cell.
//   Harness B (tests/psbridge-compare.mjs) compares every value the tabs show for these designs with the old app's own page.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { MIDAS_CASES, midasFixtures } from './psbridge-midas-cases.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', ...PBDF, ...['sections', 'model', 'rigid', 'lldf-fg', 'holddown', 'pierblock', 'demands', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'legacy', 'worked', 'worked-stress', 'worked-strength', 'worked-end', 'worked-hdr'].map(n => path.join(APP, `engine/${n}.js`)));
const M = W.PSBModel, D = W.PSBDesign, DM = W.PSBDemands, B = W.PSBBridge;
const J = v => JSON.parse(JSON.stringify(v));
const C = v => typeof v === 'number' ? (Object.is(v, -0) ? '-0' : String(v)) : v === null || typeof v !== 'object' ? (typeof v === 'function' ? '' : JSON.stringify(v))
  : Array.isArray(v) ? '[' + v.map(C).join(',') + ']' : '{' + Object.keys(v).filter(k => typeof v[k] !== 'function').map(k => JSON.stringify(k) + ':' + C(v[k])).join(',') + '}';
const F = midasFixtures(rel => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/projects', rel), 'utf8')));
const CASES = MIDAS_CASES(() => M.defaultProject(), F);
const midOf = R => R.diagrams.reduce((b, r) => Math.abs(r.x - R.L / 2) < Math.abs(b.x - R.L / 2) ? r : b);
const STEPS = (inp, R) => [W.PSBWorked.section(inp, R), W.PSBWorked.loads(inp, R), W.PSBWorked.analysis(inp, R), W.PSBWorkedStress.losses(inp, R), W.PSBWorkedStress.stresses(inp, R),
  W.PSBWorkedStrength.flexure(inp, R), W.PSBWorkedStrength.shear(inp, R), W.PSBWorkedEnd.endzone(inp, R), W.PSBWorkedEnd.camber(inp, R), W.PSBWorkedHDR.rating(inp, R)];
const near = (a, b, t, m) => assert.ok(Math.abs(a - b) <= t, `${m}: ${a} vs ${b}`);

test('D1 designs (5: MIDAS simple / continuous spans 1 and 2, the old app\'s file, a custom table): inputs.external = the file with the span used; the engine reads it; worked steps = engine values', () => {
  assert.equal(Object.keys(CASES).length, 5);
  for (const [name, P] of Object.entries(CASES)) {
    assert.deepEqual(J(W.PSBInputCheck.collect(P).errors.map(e => e.msg)), [], name);
    const inp = D.inputs(P), R = W.PSBHoldDown.compute(J(inp)), T = B.types(P)[0];
    assert.equal(R.error, null, name); assert.equal(R.useExt, true, name);
    const e = P.demands.T1;
    if (e.src === 'midas') {
      const q = W.PBD.extSpans(e.midas.file)[DM.pickOf(P, T) - 1];
      assert.deepEqual(J(inp.external), J(Object.assign({}, e.midas.file, { _selSpan: q })), name + ': the file as read + the span');
      assert.deepEqual(J(R.ext.sel), J(q), name);
    }
    assert.equal(R.L, P.spans.lengths[T.span - 1], name + ': L = the bridge span');
    // every worked step pair (the derivation) = the engine's value
    let n = 0; STEPS(inp, R).forEach(s => s.pairs.forEach(p => { n++; assert.ok(Math.abs(p.shown - p.engine) <= 1e-9 * Math.max(1, Math.abs(p.engine)), `${name} ${p.id}: ${p.shown} vs ${p.engine}`); }));
    assert.ok(n > 80, name + ' pairs ' + n);
    const ids = W.PSBWorked.loads(inp, R).steps.map(s => s.id).concat(W.PSBWorked.analysis(inp, R).steps.map(s => s.id));
    ['ld.xfp', 'ld.xfn', 'ld.xfv', 'ld.MLL', 'ld.VLL', 'an.Mdc2', 'an.Mdw', 'an.Mll', 'an.MuS'].forEach(id => assert.ok(ids.includes(id), name + ': step ' + id));
  }
});

test('§4 check case (continuous 100/120/100, span 2 of the old app\'s file, DF 0.62 / 0.68 / 0.74, m 1.0): before = this app\'s analysis, after = the file; Strength I by hand', () => {
  const P = CASES[Object.keys(CASES)[0]], inp = D.inputs(P), R = W.PSBHoldDown.compute(J(inp)), m = midOf(R);
  const Q = J(P); delete Q.demands; const R0 = W.PSBHoldDown.compute(J(D.inputs(Q))), m0 = midOf(R0);
  // after: the file's span 2 (x = 100 … 220 ft), midspan x = 60 ft = the file's station 160: M_DC2 174.64, M_DW 145.54, M_LL+ 1631.59 kip-ft
  assert.equal(m.x, 60); near(m.M_DC2, 174.64, 1e-9, 'M_DC2'); near(m.M_DW, 145.54, 1e-9, 'M_DW'); near(m.M_LLpos, 0.62 * 1631.59, 1e-9, 'M_LL = 0.62 × 1631.59');
  near(m.M_g, 1486.0625, 1e-9, 'M_g'); near(m.M_DC1, 1957.5, 1e-9, 'M_DC1');
  const MDC = 1486.0625 + 1957.5 + 174.64;   // 3618.2025
  near(m.M_DC, MDC, 1e-9, 'M_DC'); near(m.M_StrI_pos, 1.25 * MDC + 1.5 * 145.54 + 1.75 * 1.0 * 0.62 * 1631.59, 1e-6, 'Strength I M_u (6511.34)'); near(m.M_StrI_pos, 6511.338275, 1e-6, 'M_u');
  // the pier (5.12.3.3): the file's moments at the span ends x = 100 / 220: M_DC2 −365.36 / −365.36, M_DW −304.46 / −304.46, M_LL− −1034.51 / −1336.65
  near(R.cont.MDC2n, 365.36, 1e-9, 'M_DC2,n'); near(R.cont.MDWn, 304.46, 1e-9, 'M_DW,n'); near(R.cont.MLLn, 0.68 * 1336.65, 1e-9, 'M_LL,n = 0.68 × 1336.65');
  near(R.cont.MuN / 12, 1.25 * 365.36 + 1.5 * 304.46 + 1.75 * 0.68 * 1336.65 + R.cont.MrnPier, 1e-6, 'M_u,n'); near(R.cont.MuN / 12, 3108.38278, 1e-4, 'M_u,n (3108.38)'); near(R.cont.MrnPier, 604.37928, 1e-4, 'M_r,n');
  // before (this app: continuous unit, w_DC2 0.30, w_DW 0.25 klf, HL-93 × DF_M 0.7191): the same DC2 / DW (the test file was made with them), the live load differs
  near(m0.M_DC2, 174.642857, 1e-5, 'before M_DC2'); near(m0.M_LLpos, 1627.597877, 1e-5, 'before M_LL'); near(m0.M_StrI_pos, 7589.356553, 1e-5, 'before M_u');
  near(R0.cont.MLLn, 1758.404746, 1e-5, 'before M_LL,n'); near(R0.cont.MuN / 12, 4594.980444, 1e-5, 'before M_u,n');
  assert.equal(R0.useExt, false); assert.equal(R.useExt, true);
});

test('§5: a project saved before (no P.demands) is byte-identical through import / export and computes as before; this app\'s analysis chosen = as before', () => {
  const Ps = Object.values(TAB_CASES(() => M.defaultProject())).concat([M.newProject()]);
  for (const P0 of Ps) {
    const t = M.exportJSON(J(P0)), r = M.importJSON(t); assert.equal(r.ok, true);
    assert.equal('demands' in r.project, false);
    const t2 = M.exportJSON(r.project), r2 = M.importJSON(t2); assert.equal(M.exportJSON(r2.project), t2);
    const inp = D.inputs(r.project); assert.equal(inp.external, null, 'no external without demands');
    // a type set to this app's analysis (with a file kept): the same inputs
    const Q = J(r.project), T = B.types(Q)[0]; Q.demands = { [T.id]: { src: 'midas', midas: { file: J(F.simple), name: 'x.json', at: '2026-11-15T00:00:00Z' } } }; DM.setSrc(Q, T.id, 'app');   // NOMCT: a saved file (no setFile)
    if (B.hasTypes(Q)) { const k = B.types(Q).indexOf(B.types(Q).find(q => q.id === T.id)), g = B.typeLines(Q, k)[0]; if (g) assert.equal(C(D.cellInputs(Q, k, g)), C(D.cellInputs(r.project, k, g))); }
    else assert.equal(C(D.inputs(Q)), C(inp));
  }
  // the saved field: kept through export / import as written
  // (NOMCT: a saved MIDAS file is converted on open when exact, tests/engine/psbridge-nomct.test.mjs; the custom table is kept as written)
  const P = CASES['custom demand table, simple span 120 ft, DF 0.7 / m 1.0'], back = M.importJSON(M.exportJSON(J(P)));
  assert.equal(back.ok, true); assert.deepEqual(J(back.project.demands), J(P.demands)); assert.equal(C(D.inputs(back.project)), C(D.inputs(P)));
  assert.deepEqual(J(M.validate(Object.assign(J(P), { demands: [] })).errors.map(e => e.path)), ['demands']);
});

test('input errors and warnings: no file, a span the file does not have, a short table, x outside the span; span length and continuity warnings', () => {
  const P = M.defaultProject(), T = B.types(P)[0];
  // NOMCT (2026-11-25): a saved file (no setFile / setSpan: the import and the span picker are removed): the same checks, reworded, plus the
  // notice to re-enter the demands (the kept read-only source)
  const file = (f, span) => { P.demands = { T1: Object.assign({ src: 'midas', midas: { file: J(f), name: 's.json', at: '2026-11-15T00:00:00Z' } }, span ? { span } : {}) }; };
  const KEPT = /imported demands kept from an earlier version \(read only/;
  P.demands = { T1: { src: 'midas' } };
  assert.match(DM.checks(P).errors[0].msg, /no readable values are stored/);
  assert.equal(W.PSBFields.tabOf(DM.checks(P).errors[0].path), 'loads');
  assert.ok(W.PSBInputCheck.collect(P).errors.some(e => /no readable values are stored/.test(e.msg)));
  file(F.simple); assert.deepEqual(J(DM.checks(P).errors), []); assert.match(DM.checks(P).warnings.map(w => w.msg).join(' '), KEPT);
  file(F.simple, 2); assert.match(DM.checks(P).errors[0].msg, /have 1 span and no span 2/);
  file(F.simple, 1); P.spans.lengths = [118]; assert.match(DM.checks(P).warnings.map(w => w.msg).join(' '), /span 1 of the imported demands is 120\.00 ft long but span 1 of the bridge is 118\.00 ft/);
  P.spans.lengths = [120]; file(F.mct, 1); P.spans.lengths = [110];
  assert.match(DM.checks(P).warnings.map(w => w.msg).join(' '), /imported member is continuous \(3 spans\) but the bridge has simple spans/);
  DM.setSrc(P, 'T1', 'table'); assert.match(DM.checks(P).errors[0].msg, /at least 2 rows/);
  DM.setTable(P, 'T1', [{ x: 0 }, { x: 130 }]); assert.match(DM.checks(P).errors[0].msg, /outside span 1/);
  DM.setTable(P, 'T1', [{ x: 0 }, { x: '' }]); assert.match(DM.checks(P).errors[0].msg, /enter the station x/);
  assert.equal(DM.anyExt(P), true); DM.setSrc(P, 'T1', 'app'); assert.equal(DM.anyExt(P), false); assert.equal(DM.external(P, T), null);
});

test('custom table: the engine takes the entered values (moments, this app\'s shear sign, the + / − LL branches) × DF m', () => {
  const P = CASES['custom demand table, simple span 120 ft, DF 0.7 / m 1.0'], inp = D.inputs(P), R = W.PSBHoldDown.compute(J(inp)), rows = P.demands.T1.table.rows;
  rows.forEach(r => { const d = R.diagrams.find(q => Math.abs(q.x - r.x) < 1e-9); if (!d) return;
    near(d.M_DC2, r.M_DC2, 1e-9, 'M_DC2 at ' + r.x); near(d.M_DW, r.M_DW, 1e-9, 'M_DW'); near(d.M_LLpos, 0.7 * r.M_LLpos, 1e-9, 'M_LL+');
    near(d.V_DW, r.V_DW, 1e-9, 'V_DW at ' + r.x); near(d.V_LLpos, 0.8 * r.V_LLpos, 1e-9, 'V_LL+ at ' + r.x); near(d.V_LLneg, 0.8 * r.V_LLneg, 1e-9, 'V_LL− at ' + r.x); });
  near(R.VLL, 0.8 * 118, 1e-9, 'V_LL at the support'); near(R.MLL, 0.7 * 3050, 1e-9, 'M_LL at midspan');
  assert.equal(inp.external.source, 'custom table'); assert.deepEqual(J(inp.external.member.supports), [0, 120]);
});

test('an old bridge model with MIDAS demands on its other cells: restored as types with their demands; each computed = the old app\'s cell (PS-18)', () => {
  const base = J(W.mergeInputs(null)), ext = F.ps3;
  const mk = o => Object.assign(J(base), o);
  const on = mk({ L: 120, S: 8, nGirders: 5, proj: { name: 'Old MIDAS', girderId: 'G2 (Interior)' }, external: Object.assign(J(ext), { _selSpan: W.PBD.extSpans(ext)[1] }), loads: Object.assign(J(base.loads), { extDFpos: 0.62 }) });
  const g4 = mk({ L: 120, S: 8, nGirders: 5, proj: { girderId: 'G4 (Interior)' }, external: Object.assign(J(ext), { _selSpan: W.PBD.extSpans(ext)[1] }), loads: Object.assign(J(base.loads), { extDFpos: 0.7 }) });
  const g2s1 = mk({ L: 100, S: 8, nGirders: 5, proj: { girderId: 'G2 (Interior)' }, external: Object.assign(J(ext), { _selSpan: W.PBD.extSpans(ext)[0] }) });
  const br = { v: 1, mode: 'pl', title: { name: 'Old MIDAS' }, spans: [100, 120, 100], nGirders: 5, S: 8, sel: { g: 2, s: 2 }, designs: { 'G2/S2': on, 'G4/S2': g4, 'G2/S1': g2s1 } };
  const r = W.PSBLegacy.convert({ inputs: J(on), bridge: J(br), kind: 'autosave' }); assert.equal(r.ok, true);
  assert.equal(W.PSBLegacy.verify(r).same, true, 'the design on screen');
  const P = r.project; B.migrate(P); const txt = W.PSBLegacy.restore(P);
  assert.ok(P.legacy.restored.cells.length === 2 && P.legacy.restored.cells.every(c => c.same), txt);
  assert.match(txt, /imported demands are their types' demands/);   // NOMCT: reworded (no MIDAS in the text)
  P.legacy.restored.cells.forEach(c => { const k = B.typeAt(P, c.s, c.g), T = P.types[k]; assert.equal(DM.srcOf(P, T.id), 'midas', c.key); assert.equal(DM.pickOf(P, T), c.s); });
});
