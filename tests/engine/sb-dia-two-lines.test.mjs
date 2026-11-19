// SB2L (2026-11-19; engineer request 2026-11-19): apps/steel-bridge engine/crossframes.js cfDiaNl / cfDiaG / cfDiaEnd / cfDiaFit / cfDiaChecks /
// diaSteps, CF11; ui/framing.js inputs; engine/model.js validate — the rolled-beam or channel diaphragm end connection with two vertical bolt
// lines (crossframes.dia.nl = 2, g apart; the end diaphragms crossframes.dia.eNl). Angle cross-frame members keep one line.
//   1. One line (nl absent, 1, '1', or 1 with a g and a blank eNl): every check item, step and DIA value as with nl absent.
//   2. Hand check, W21x44, 7/8 in A325 threads excluded, 4 bolts per line at 3 in, lines 3 in apart, first line 3.5 in from the web
//      (CF.DEF frame): J, M, the corner bolt force and its ratio; the same diaphragm with one line of 4 (the method before).
//   3. Fit: the outer line's edge distance to the plate's free edge, the line spacing ≥ 3d, the end diaphragms' own lines (eNl).
//   4. CF11 (CTDOT xf.bolts): the total bolts of the connection, n × n_l. 5. validate. 6. the inputs on the Framing & bracing tab.
import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { load } from './gfx-fixture.mjs';

const W = load(), CF = W.SBDCrossframes, M = W.SBDModel, FUI = W.SBDFramingUI, J = o => JSON.parse(JSON.stringify(o));
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m}: ${a} vs ${b}`);
const run = (dia, mut) => { const p = J(CF.DEF); p.dia = { ...p.dia, on: 'yes', ...dia }; p.conn.thr = 'excl'; if (mut) mut(p); const R = CF.compute(p, null), C = CF.checks(R); return { R, C, D: R.DIA.i, E: R.DIA.e, d: C.find(c => c.id === 'CFD'), e: C.find(c => c.id === 'CFE') }; };
const HC = { shape: 'W21x44', nb: 4, pitch: 3, ecc: 3.5 };

test('1. one bolt line: identical to a project saved before (nl absent)', () => {
  const vs = [HC, { shape: 'MC18x42.7' }, { shape: 'W24x55', eShape: 'MC18x42.7', eNb: 5, end: 'yes', Rj: 120, aj: 14 }, { shape: 'C15x33.9', nb: 2, pitch: 6, gr: '36', ecc: 5 }];
  for (const v of vs) { const a = run(v), s = x => JSON.stringify({ C: x.C, st: x.R.steps, D: x.R.DIA });
    for (const o of [{ nl: 1 }, { nl: '1' }, { nl: 1, g: 5, eNl: '' }, { nl: '', g: NaN }, { nl: 3 }]) assert.equal(s(run({ ...v, ...o })), s(a), `${v.shape} ${JSON.stringify(o)}`); }
});

test('2. hand check: W21x44, 2 lines × 4 bolts at 3 in, g = 3 in, 7/8 in A325-X; vs 1 line × 4', () => {
  const two = run({ ...HC, nl: 2, g: 3 }), one = run(HC), D = two.D, D1 = one.D;
  // V = 2M_br/S = 2(583.84)/114 = 10.243 kip (CF.DEF frame, stability bracing during deck placement)
  near(D.Mbr, 583.84, 0.01, 'M_br'); near(D.Vt, 10.243, 1e-3, 'V');
  // φR_n: shear 0.80(0.56)(0.6013)(120) = 32.33 kip; bearing 0.80(2.4)(0.875)(0.35)(65) = 38.22 kip
  near(D.res, 32.33, 5e-3, 'φR_n'); near(D.phiRb, 38.22, 1e-9, 'bearing');
  // two lines: J = 2(45) + 4(2)(1.5²) = 108 in²; e_c = 3.5 + 3/2 = 5.0 in; M = 583.84 + 10.243(5.0) = 635.05 kip-in
  assert.equal(D.J, 108); assert.equal(D.ec, 5); assert.equal(D.N, 8); near(D.M, 635.05, 0.01, 'M');
  // corner bolt: vertical 10.243/8 + 635.05(1.5)/108 = 1.2804 + 8.8202 = 10.1006; horizontal 635.05(4.5)/108 = 26.460; f = 28.32 kip
  near(D.fmax, Math.hypot(10.2428 / 8 + 635.053 * 1.5 / 108, 635.053 * 4.5 / 108), 1e-3, 'f'); near(D.fmax, 28.32, 5e-3, 'f'); near(D.fmax / D.res, 0.876, 1e-3, 'ratio');
  // one line (before): M = 583.84 + 10.243(3.5) = 619.69; f = √((10.243/4)² + (619.69(4.5)/45)²) = √(2.561² + 61.969²) = 62.02 kip, ratio 1.919
  near(D1.M, 619.69, 0.01, 'M, one line'); near(D1.fmax, 62.02, 5e-3, 'f, one line'); near(D1.fmax / D1.res, 1.919, 1e-3, 'ratio, one line');
  const it = c => c.items.find(i => /^Bolted connection: /.test(i.loc));
  assert.equal(it(one.d).st, 'fail'); assert.equal(it(two.d).st, 'pass'); assert.match(it(two.d).loc, /^Bolted connection: 2 lines of 4 bolts \(8 per end\) at 3\.00 in pitch, lines 3\.00 in apart/);
  assert.equal(it(two.d).step, 'cf.cfd.bolt');
  // wind: M_c = 228.85 + 4.015(5.0) = 248.93; f_w = √((4.015/8 + 248.93(1.5)/108)² + (248.93(4.5)/108 + 3.662/8)²) = 11.53 kip
  near(D.Mc, 248.93, 0.01, 'M_c'); near(D.fw, Math.hypot(D.Vw / 8 + D.Mc * 1.5 / 108, D.Mc * 4.5 / 108 + D.Fw / 8), 1e-12, 'f_w'); near(D.fw, 11.53, 5e-3, 'f_w');
  // the work: J, M, f, f_w worked (equation, values, result)
  const st = id => two.R.steps.find(s => s.id === id);
  assert.equal(st('cf.cfd.boltJ').sub, '2(45.00) + 4(2)(1.500)^{2}'); assert.equal(st('cf.cfd.boltJ').value, 108);
  assert.equal(st('cf.cfd.boltM').sub, '584 + 10.24(5.00)'); assert.match(st('cf.cfd.bolt').sub, /^\\sqrt\{\(10\.24\/8 \+ 635\(1\.500\)\/108\.00\)\^\{2\} \+ \(635\(4\.50\)\/108\.00\)\^\{2\}\}$/);
  assert.ok(st('cf.cfd.boltw')); assert.match(st('cf.cfd.bolt').ref, /6\.13\.1, 6\.13\.2/);
});

test('3. fit: the outer line to the plate free edge, g ≥ 3d, the end diaphragms\' lines', () => {
  // the 5 in plate of CF.DEF: outer line 3.5 + 3 = 6.5 in from the web, free edge at 0.5625/2 + 5 = 5.28 in: outside, fail
  const a = run({ ...HC, nl: 2, g: 3 }); assert.deepEqual(J(a.D.G.bad), ['outer bolt line 6.50 in from the web is outside the 5 in plate (free edge at 5.28 in)']);
  assert.equal(a.d.items.find(i => /^Connection plate fit: bolt lines 3\.50 and 6\.50 in/.test(i.loc)).st, 'fail');
  // an 8 in plate: edge 0.28125 + 8 − 6.5 = 1.78 in ≥ 1 1/8 in: fits
  const b = run({ ...HC, nl: 2, g: 3 }, p => { p.sb.bs = 8; }); near(b.D.G.edge, 1.78125, 1e-12, 'edge'); assert.deepEqual(J(b.D.G.bad), []);
  assert.equal(b.d.items.find(i => /^Connection plate fit: bolt lines/.test(i.loc)).st, 'pass');
  // g = 2.5 in < 3d = 2.625 in: the spacing item fails and the fit lists it
  const c = run({ ...HC, nl: 2, g: 2.5 }, p => { p.sb.bs = 8; }); assert.equal(c.d.items.find(i => /^Bolt lines: spacing/.test(i.loc)).st, 'fail');
  assert.ok(c.D.G.bad.includes('bolt line spacing 2.50 in < 3d = 2.63 in'));
  // end diaphragms: eNl = 2 with one intermediate line, and eNl = 1 with two
  const e1 = run({ ...HC, eNl: 2 }); assert.equal(e1.D.nl, undefined); assert.equal(e1.E.nl, 2);
  const e2 = run({ ...HC, nl: 2, eNl: '1' }); assert.equal(e2.D.nl, 2); assert.equal(e2.E.nl, undefined);
  const e3 = run({ ...HC, nl: 2 }); assert.equal(e3.E.nl, 2, 'blank eNl: as the intermediate');
  // the diaphragm end and the weight are unchanged by the second line (dia.ecc to the first line)
  assert.equal(CF.cfDiaGap({ ...HC, nl: 2, g: 3 }), CF.cfDiaGap(HC));
});

test('4. CF11 (CTDOT, at least 4 bolts per connection): the total, n × n_l', () => {
  const r = dia => { const p = J(CF.DEF); p.dia = { ...p.dia, on: 'yes', ...dia }; const C = CF.checks(CF.compute(p, { owner: 'CTDOT' })); return C.find(c => c.id === 'CF11').items.find(i => i.loc === 'Bolts per diaphragm end'); };
  assert.deepEqual(J(r({ nb: 2 }).cells), ['2', 'at least 4']); assert.equal(r({ nb: 2 }).st, 'warn');
  const t = r({ nb: 2, nl: 2 }); assert.deepEqual(J(t.cells), ['4 (2 lines of 2)', 'at least 4']); assert.equal(t.st, 'pass');
});

test('5. validate: nl, eNl 1 or 2 (or blank), g positive (or blank)', () => {
  const P = M.newProject(), err = () => J(M.validate(P).errors.filter(e => /dia\.(nl|eNl|g)$/.test(e.path)).map(e => e.path));
  assert.deepEqual(err(), []); Object.assign(P.crossframes.dia, { nl: '2', g: 3.5, eNl: '' }); assert.deepEqual(err(), []);
  Object.assign(P.crossframes.dia, { nl: 3, g: -1, eNl: 4 }); assert.deepEqual(err().sort(), ['crossframes.dia.eNl', 'crossframes.dia.g', 'crossframes.dia.nl']);
});

test('6. inputs: the lines select next to the bolts and pitch; the spacing with two lines only; the convention stated', () => {
  const h = { num: (p, l) => `<input data-path="${p}" aria-label="${l}">`, sel: (p, l, o, cur) => `<select data-path="${p}" data-cur="${cur}">`, card: (t, b) => b, esc: s => String(s) };
  const P = M.newProject(); Object.assign(P.crossframes.dia, { on: 'yes', shape: 'W21x44' });
  let html = FUI.inputs(P, h); const i = html.indexOf('data-path="crossframes.dia.pitch"'), j = html.indexOf('data-path="crossframes.dia.nl" data-cur="1"');
  assert.ok(i > 0 && j > i); assert.ok(!html.includes('crossframes.dia.g"')); assert.ok(html.includes(FUI.LINES_HINT)); assert.match(FUI.LINES_HINT, /from the girder web centerline to the first line/);
  P.crossframes.dia.nl = '2'; html = FUI.inputs(P, h); assert.ok(html.includes('data-path="crossframes.dia.g"') && html.includes('placeholder="3"')); assert.ok(html.includes('First bolt line from the girder web'));
});
