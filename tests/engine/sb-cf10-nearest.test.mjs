// SB-27 (2026-11-13; engineer decision SB-27): apps/steel-bridge engine/crossframes.js cfTypeRec / recGroups / nearOf / typeRecStep, CF10 —
// CF10 always applies the fit between the girder webs, d ≤ D_0 − c (SB-25), also with one bay depth group (and for a project saved before
// girder types). When no channel or rolled W of the lists meets both the least depth d_req (0.75 × the deeper girder, SB-19 / SB-22) and the
// fit, CF10 names the NEAREST section, the deepest that fits, and flags that it fails the depth requirement (the CF10 item text, the CF10 note
// on the tab and in the Report, the cf.type step); the CFD depth item shows the shortfall. The per-group prefill (SB-24, #1503) and the Shape
// set at the prefill (SBSP, #1516) take the same nearest section (ui/framing.js grpRec reads CF10's per-group sections).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const W = loadShared(...['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'report.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'engine/rating.js', 'ui/flexure.js', 'ui/loads.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/rating.js', 'ui/splices.js', 'ui/constructibility.js', 'engine/welds.js', 'ui/welds.js',
  'engine/sheets.js', 'ui/deflection.js', 'report/data.js', 'report/builders.js'].map(E)));
const M = W.SBDModel, CF = W.SBDCrossframes, FUI = W.SBDFramingUI, J = o => JSON.parse(JSON.stringify(o));
const setD = (P, gi, D) => P.girders[gi].segments.forEach(s => { s.D = D; });
const two = (Di, De) => { const P = M.newProject(); setD(P, 0, Di); setD(P, 1, De); return P; };
const three = (De, Dm, Dc) => { const P = M.newProject(); P.xs.nb = 6; P.xs.bays = [9.5, 9.5, 9.5, 9.5, 9.5];
  M.setLines(P, 1, [0, 5]); M.setLines(P, 0, [1, 4]); P.girders[0].label = 'Mid'; setD(P, 1, De); setD(P, 0, Dm);
  const c = M.addType(P, 0, { label: 'Core', lines: [2, 3] }); setD(P, c, Dc); return P; };
const dia = (P, sh) => { Object.assign(P.crossframes.dia, { on: 'yes', shape: sh }); return P; };
const TR = (P, gi = 0) => CF.cfTypeRec(CF.inputsOf(P, { gi }).p, CF.envOf(P));
const near = (sec, req, D0, lim, d, short, ratio) => `rolled diaphragm ${sec}: the nearest section, FAILS the depth requirement (no channel or W of the list meets both the least depth ${req} in and the fit d ≤ D_0 − c = ${D0} − 2.00 = ${lim} in; the deepest that fits, d = ${d} in, is ${short} in short, ratio ${ratio}; SB-27)`;
const W27 = near('W27x84', '28.41', '30.00', '28.00', '26.70', '1.71', '1.064'), W33 = near('W33x118', '32.91', '36.00', '34.00', '32.90', '0.01', '1.000');
const NO = Object.fromEntries(['sum', 'proj', 'loads', 'an', 'defl', 'sec', 'flex', 'shear', 'fat', 'cn', 'spl', 'wd', 'rt'].map(k => [k, false]));
const ckSub = (P, gi) => { const B = W.SBDReportData.compute(P, gi, { want: { frm: true } }), Mo = W.SBDReportBuild.model(B, { detail: 'gov', include: NO }), doc = W.SharedReport.build(Mo);
  assert.deepEqual(J(doc.unresolved), [], 'every [[key]] resolves'); return Mo.sections[0].subs.find(s => s.id === 'ck'); };

test('hand check 1: Interior 30 / Exterior 36 (one depth group): d_req 28.41 > D_0 − c = 28.00 → the nearest W27x84 (26.70 in), 1.71 in short, ratio 1.064', () => {
  for (const gi of [0, 1]) { const T = TR(two(30, 36), gi);
    assert.ok(!T.grp); assert.equal(T.fit.lim, 28); assert.ok(Math.abs(T.req - 28.41) < 5e-3);
    assert.equal(T.rec, W27); assert.equal(T.w, 'W27x84'); assert.equal(T.ch, 'MC18x42.7', 'the channel family: the deepest channel that fits');
    assert.equal(T.near.sec[0], 'W27x84'); assert.equal(+T.near.short.toFixed(2), 1.71); assert.equal(+(T.near.req / T.near.sec[1]).toFixed(3), 1.064); }
  // the cf.type step works it; the CF10 note flags it; the Diaphragm switch takes it
  const B = FUI.build({ P: two(30, 36), g: 0 }), st = B.R.steps.find(s => s.id === 'cf.type');
  assert.match(st.note, /One section for every bay: rolled W27x84 \(d = 26\.70 in\): the NEAREST section, the deepest of the list with d ≤ D_0 − c = 30\.00 − 2\.00 = 28\.00 in; no channel or W of the list has 28\.41 ≤ d ≤ 28\.00 in, so it FAILS the depth requirement: d_req − d = 28\.41 − 26\.70 = 1\.71 in short, d_req\/d = 28\.41\/26\.70 = 1\.064 \(engineer decision SB-27\); the fit d ≤ D_0 − c of SB-25 applies to the one section too \(SB-27\), D_0 of bay G1–G2, shallower girder G2 Interior/);
  const n = B.C.find(c => c.id === 'CF10').note; assert.match(n, /Fit \(engineer decision SB-27, 2026-11-13\)/); assert.match(n, /W27x84, d = 26\.70 in < d_req = 28\.41 in, 1\.71 in short\): it FAILS the depth requirement/);
  const P = two(30, 36); P.crossframes.dia.shape = 'MC18x42.7'; FUI.setBrace(P, 'w'); assert.equal(P.crossframes.dia.shape, 'W27x84'); assert.equal(P.crossframes.dia.grp, undefined);
  // CFD with it: depth warning 28.41/26.70 = 1.064 with the shortfall, fit OK 26.70/28.00 = 0.954
  const D = FUI.build({ P: dia(two(30, 36), 'W27x84'), g: 0 }).C.find(c => c.id === 'CFD').items, dep = D.find(i => /^Depth/.test(i.loc)), fit = D.find(i => /^Fit/.test(i.loc));
  assert.equal(dep.st, 'warn'); assert.equal(+dep.r.toFixed(3), 1.064); assert.match(dep.loc, /W27x84 is 1\.71 in short, SB-27\)$/); assert.equal(fit.st, 'pass'); assert.equal(+fit.r.toFixed(3), 0.954);
});

test('hand check 2: Exterior 30 / Interior 36 (two groups): G1–G2, G4–G5 the nearest W27x84; G2–G3, G3–G4 W30x99 (meets both); prefill and Shape', () => {
  const T = TR(two(36, 30));
  assert.equal(T.rec, `by bay depth (one section does not fit every bay): G1–G2, G4–G5: ${W27}; G2–G3, G3–G4: rolled diaphragm W30x99`);
  assert.deepEqual(J(T.grp.map(g => [g.bays.join(), g.lim, g.w[0], !!g.near])), [['0,3', 28, 'W27x84', true], ['1,2', 34, 'W30x99', false]]);
  const P = two(36, 30); FUI.setBrace(P, 'w'); assert.deepEqual(J(P.crossframes.dia.grp), { '0,3': 'W27x84', '1,2': 'W30x99' });
  assert.equal(P.crossframes.dia.shape, 'W27x84', 'SBSP: both groups d_req 28.41 in, the first in bay order');
  const D = FUI.build({ P: J(P), g: 0 }).C.find(c => c.id === 'CFD').items.filter(i => /: (Depth|Fit)/.test(i.loc)).map(i => [i.loc.split(':')[0], i.loc.match(/: (\w+)/)[1], i.st, +i.r.toFixed(3)]);
  assert.deepEqual(J(D), [['G1–G2, G4–G5 (W27x84)', 'Depth', 'warn', 1.064], ['G1–G2, G4–G5 (W27x84)', 'Fit', 'pass', 0.954], ['G2–G3, G3–G4 (W30x99)', 'Depth', 'pass', 0.957], ['G2–G3, G3–G4 (W30x99)', 'Fit', 'pass', 0.874]]);
});

test('hand check 3: three types 30 / 36 / 42: W27x84 (nearest), W33x118 (nearest, 0.01 in short), W36x135; prefill and Shape', () => {
  const T = TR(three(30, 36, 42), 1);
  assert.equal(T.rec, `by bay depth (one section does not fit every bay): G1–G2, G5–G6: ${W27}; G2–G3, G4–G5: ${W33}; G3–G4: rolled diaphragm W36x135`);
  const P = three(30, 36, 42); FUI.setBrace(P, 'w'); assert.deepEqual(J(P.crossframes.dia.grp), { '0,4': 'W27x84', '1,3': 'W33x118', 2: 'W36x135' }); assert.equal(P.crossframes.dia.shape, 'W33x118');
  const st = FUI.build({ P: three(30, 36, 42), g: 0 }).R.steps.find(s => s.id === 'cf.type');
  assert.match(st.note, /G2–G3, G4–G5 \(shallower G2 Mid, D_0 − c = 36\.00 − 2\.00 = 34\.00 in; d_req = 32\.91 in\): rolled W33x118 \(d = 32\.90 in\): the NEAREST section/);
  assert.match(st.note, /G3–G4 \(shallower G3 Core, D_0 − c = 42\.00 − 2\.00 = 40\.00 in; d_req = 32\.91 in\): rolled W36x135 \(d = 35\.60 in, the first W of the list with 32\.91 ≤ d ≤ 40\.00 in\)/);
  // the Report: the CF10 item cell and the note
  const sub = ckSub(three(30, 36, 42), 0), row = sub.items.find(i => i.type === 'table').rows.find(r => /^CF10 /.test(r[0]));
  assert.ok(row[1].includes('Recommended: by bay depth (one section does not fit every bay): G1–G2, G5–G6: rolled diaphragm W27x84: the nearest section, FAILS the depth requirement'), row[1]);   // the Report sets D_0 as math
  assert.ok(sub.items.some(i => i.type === 'note' && /^CF10: .*Fit \(engineer decision SB-27, 2026-11-13\).*W33x118, d = 32\.90 in < .*32\.91 in, 0\.01 in short\): it FAILS the depth requirement/.test(i.text)));
});

test('unchanged where a section meets both the depth and the fit: equal depths, c = 0, the built-in project; no SB-27 text', () => {
  const c0 = P => { P.crossframes.dia.clr = 0; return P; };
  assert.equal(TR(two(30, 30)).rec, 'rolled diaphragm W27x84'); assert.equal(TR(two(30, 30)).near, null);
  assert.equal(TR(c0(two(30, 36))).rec, 'rolled diaphragm W30x99', 'c = 0: W30x99 (29.70 ≤ 30.00) meets both, as #1490');
  assert.equal(TR(c0(three(30, 36, 42))).rec, 'by bay depth (one section does not fit every bay): G1–G2, G5–G6: rolled diaphragm W30x99; G2–G3, G4–G5: rolled diaphragm W36x135; G3–G4: rolled diaphragm W36x135');
  for (const P of [M.defaultProject(), two(30, 30), c0(two(30, 36))]) { const B = FUI.build({ P, g: 0 }); assert.ok(!/SB-27/.test(B.C.find(c => c.id === 'CF10').note)); }
  assert.equal(TR(M.defaultProject()).deep, true, 'the built-in: cross-frames, no diaphragm recommended');
});

test('a project saved before girder types: the fit with D_0 of the girder at the first support; the nearest section and its step', () => {
  const P = M.defaultProject(); P.girders.forEach(g => g.segments.forEach(s => { s.D = 16; }));
  const T = TR(P); assert.equal(T.DQ, undefined); assert.equal(T.fit.lim, 14);
  // d_req = 0.75 × 17.88 = 13.41 in ≤ D_0 − c = 16 − 2 = 14.00 in, but no section of the lists between 13.41 and 14.00 in (C12x20.7 12.00, C15x33.9 15.00)
  assert.match(T.rec, /^channel diaphragm C12x20\.7: the nearest section, FAILS the depth requirement \(no channel or W of the list meets both the least depth 13\.41 in and the fit d ≤ D_0 − c = 16\.00 − 2\.00 = 14\.00 in; the deepest that fits, d = 12\.00 in, is 1\.41 in short/);
  const st = FUI.build({ P, g: 0 }).R.steps.find(s => s.id === 'cf.type'); assert.ok(st); assert.equal(+st.value.toFixed(2), 13.41); assert.match(st.note, /D_0 of the girder at the first support/);
  const Q = M.defaultProject(); Q.girders.forEach(g => g.segments.forEach(s => { s.D = 18; })); const T2 = TR(Q);
  assert.equal(T2.near, null); assert.equal(T2.rec, 'channel diaphragm C15x33.9 (or a rolled W)', 'D = 18: C15x33.9 meets both, as before');
  assert.ok(!FUI.build({ P: Q, g: 0 }).R.steps.some(s => s.id === 'cf.type'), 'no step where nothing is named nearest');
});
