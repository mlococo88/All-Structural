// SB-25 (2026-11-13; engineer decision SB-25): apps/steel-bridge engine/crossframes.js diaFit / diaClr, cfDiaChecks (CFD item "Fit between the
// girders"), cfTypeRec / recGroups (CF10's fit rule), ui/framing.js clrRow, engine/model.js validate. The intermediate diaphragm must fit between
// the girder webs: d ≤ D_0 − c, D_0 the web depth at the first support of the shallower girder of each bay of the frame checked (the least; per
// bay depth group with SB-24's groups), c the clearance in total, crossframes.dia.clr (default 2 in: 1 in top and bottom for clips / welds).
// Not fitting: Fail with a message. CF10's per-group fit uses the same c (was d ≤ D_0). Absent / blank clr: 2 in; clr = 0: the CF10 rule of before.
import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { load } from './gfx-fixture.mjs';

const W = load(), M = W.SBDModel, CF = W.SBDCrossframes, FUI = W.SBDFramingUI, J = o => JSON.parse(JSON.stringify(o));
const setD = (P, gi, D) => P.girders[gi].segments.forEach(s => { s.D = D; });
const two = (Di, De) => { const P = M.newProject(); setD(P, 0, Di); setD(P, 1, De); return P; };
const three = (De, Dm, Dc) => { const P = M.newProject(); P.xs.nb = 6; P.xs.bays = [9.5, 9.5, 9.5, 9.5, 9.5];
  M.setLines(P, 1, [0, 5]); M.setLines(P, 0, [1, 4]); P.girders[0].label = 'Mid'; setD(P, 1, De); setD(P, 0, Dm);
  const c = M.addType(P, 0, { label: 'Core', lines: [2, 3] }); setD(P, c, Dc); return P; };
const dia = (P, sh, o) => { Object.assign(P.crossframes.dia, { on: 'yes', shape: sh }, o || {}); return P; };
const run = (P, gi = 0) => { const B = FUI.build({ P: J(P), g: gi }); return { B, d: B.C.find(c => c.id === 'CFD'), e: B.C.find(c => c.id === 'CFE') }; };
const fit = c => c.items.filter(i => /Fit between the girders/.test(i.loc));
const TR = (P, gi = 0) => CF.cfTypeRec(CF.inputsOf(P, { gi }).p, CF.envOf(P));

test('hand check: W36x135 (d = 35.60 in) between girders of D = 30 in: 35.60 > 30 − 2 = 28.00 in → Fail, with the message; CFE has no fit item', () => {
  const { B, d, e } = run(dia(two(30, 30), 'W36x135')), F = fit(d);
  assert.equal(F.length, 1); assert.equal(F[0].st, 'fail'); assert.equal(F[0].demand, 35.6); assert.equal(F[0].capacity, 28); assert.equal(+F[0].r.toFixed(3), 1.271);
  assert.match(F[0].loc, /does not fit: W36x135 d = 35\.60 in > 30\.00 − 2\.00 = 28\.00 in, a shallower section is needed/); assert.equal(F[0].step, 'cf.cfd.fit');
  assert.equal(d.status, 'fail'); assert.equal(fit(e).length, 0, 'CFE: not checked (SB-25 is the intermediate diaphragm)');
  const s = B.R.steps.find(t => t.id === 'cf.cfd.fit'); assert.equal(s.value, 28); assert.equal(s.sub, '30.00 - 2.00'); assert.equal(s.ok, false); assert.match(s.note, /does not fit \(Fail\)/);
  assert.equal(CF.diaClr({}), 2); assert.equal(CF.DIA_CLR, 2);
});

test('Interior 30 / Exterior 36 (one depth group): W30x99 29.70 > 28.00 Fail, W27x84 26.70 ≤ 28.00 OK; CF10 (one group: no fit test, #1490 decision 2) still W30x99', () => {
  const a = fit(run(dia(two(30, 36), 'W30x99')).d), b = fit(run(dia(two(30, 36), 'W27x84')).d);
  assert.equal(a.length, 1); assert.equal(a[0].st, 'fail'); assert.equal(+a[0].r.toFixed(3), 1.061); assert.match(a[0].loc, /bay G1–G2, shallower girder G2 Interior/);
  assert.equal(b[0].st, 'pass'); assert.equal(+b[0].r.toFixed(3), 0.954);
  assert.equal(TR(two(30, 36)).rec, 'rolled diaphragm W30x99');
});

test('Exterior 30 / Interior 36 (two groups): CF10 before W30x99, now per group (none fits the exterior bays: 28.41 > 28.00); CFD fit per group', () => {
  assert.equal(TR(two(36, 30)).rec, 'by bay depth (one section does not fit every bay): G1–G2, G4–G5: no section fits (the least depth 28.41 in exceeds the fit limit, web depth 30.00 − clearance 2.00 = 28.00 in, SB-25); G2–G3, G3–G4: rolled diaphragm W30x99');
  const P0 = two(36, 30); P0.crossframes.dia.clr = 0; assert.equal(TR(P0).rec, 'rolled diaphragm W30x99', 'c = 0: as before (#1490)');
  const F = fit(run(dia(two(36, 30), 'W30x99')).d);
  assert.deepEqual(J(F.map(i => [i.loc.split(':')[0], i.capacity, i.st, i.step])), [['G1–G2, G4–G5 (W30x99)', 28, 'fail', 'cf.cfd.g1.fit'], ['G2–G3, G3–G4 (W30x99)', 34, 'pass', 'cf.cfd.g2.fit']]);
});

test('three types 30 / 36 / 42: CF10 per group with the clearance; the prefill; W36x135 everywhere fails the Exterior and Mid groups', () => {
  const P = three(30, 36, 42);
  assert.equal(TR(P).rec, 'by bay depth (one section does not fit every bay): G1–G2, G5–G6: no section fits (the least depth 28.41 in exceeds the fit limit, web depth 30.00 − clearance 2.00 = 28.00 in, SB-25); G2–G3, G4–G5: no channel or W of the list between 32.91 and 34.00 in; G3–G4: rolled diaphragm W36x135');
  assert.deepEqual(J(TR(P).grp.map(g => [g.bays.join(), g.top, g.clr, g.lim])), [['0,4', 30, 2, 28], ['1,3', 36, 2, 34], ['2', 42, 2, 40]]);
  const F = fit(run(dia(three(30, 36, 42), 'W36x135'), 1).d);
  assert.deepEqual(J(F.map(i => [i.loc.split(':')[0], i.capacity, i.st, +i.r.toFixed(3)])), [['G1–G2, G5–G6 (W36x135)', 28, 'fail', 1.271], ['G2–G3, G4–G5 (W36x135)', 34, 'fail', 1.047], ['G3–G4 (W36x135)', 40, 'pass', 0.89]]);
  const st = run(P, 0).B.R.steps.find(s => s.id === 'cf.type'); assert.match(st.note, /D_0 − c = 30\.00 − 2\.00 = 28\.00 in; d_req = 28\.41 in\): no section fits/);
});

test('the clearance input: absent, null, blank, NaN → 2 in; 0.25 in lets W30x99 fit 30 in webs; the input row and the validation', () => {
  for (const v of [undefined, null, '', NaN, 'abc', -1]) assert.equal(CF.diaClr({ clr: v }), 2, String(v));
  assert.equal(CF.diaClr({ clr: 0 }), 0); assert.equal(CF.diaClr({ clr: '1.5' }), 1.5);
  const F = fit(run(dia(two(30, 36), 'W30x99', { clr: 0.25 })).d); assert.equal(F[0].capacity, 29.75); assert.equal(F[0].st, 'pass');
  const val = clr => { const P = M.newProject(); P.crossframes.dia.clr = clr; return M.validate(P).errors.filter(e => e.path === 'crossframes.dia.clr').length; };
  assert.equal(val(undefined), 0); assert.equal(val(null), 0); assert.equal(val(''), 0); assert.equal(val(NaN), 0); assert.equal(val(1), 0); assert.equal(val(-1), 1); assert.equal(val('x'), 1);
  const P = dia(M.newProject(), 'W21x44'), h = { num: () => '', sel: () => '', card: (t, b) => b, esc: s => String(s) };
  assert.match(FUI.inputs(P, h), /data-path="crossframes\.dia\.clr" data-kind="num" value="" placeholder="2"/);
  P.crossframes.dia.clr = 1.5; assert.match(FUI.inputs(P, h), /data-path="crossframes\.dia\.clr" data-kind="num" value="1\.5"/);
});

test('a project saved before girder types (the built-in): D_0 of the girder at the first support, 60 − 2 = 58 in, W21x44 fits', () => {
  const F = fit(run(dia(M.defaultProject(), 'W21x44')).d);
  assert.equal(F.length, 1); assert.equal(F[0].capacity, 58); assert.equal(F[0].st, 'pass'); assert.match(F[0].loc, /the girder at the first support/);
});
