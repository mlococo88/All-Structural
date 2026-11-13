// shared/aisc-hss.js (window.SharedAiscHss): rectangular / square HSS strength, AISC 360-16 LRFD (2026-11-13, Steel Canopy
// Designer Member Design tab). Three kinds of check:
//   1. hand cases a reviewer can redo, against AISC Steel Construction Manual (15th Ed.) tabulated values;
//   2. the same formulas in Steel Beam Design - AISC 15th.html (read from the file at test time, so a later change there is
//      caught): every rectangular HSS shape, A500 Gr. C and Gr. B, a sweep of lengths: identical numbers;
//   3. the interaction equations and the step output.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { test, loadShared, ROOT } from './harness.mjs';

const H = loadShared('aisc-hss.js').SharedAiscHss;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const rel = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${msg}: ${a} vs ${b}`);

test('table: 525 shapes, both name forms resolve', () => {
  assert.equal(H.rows.length, 525);
  assert.equal(H.find('HSS6X6X1/4')[0], 'HSS6X6X1/4');
  assert.equal(H.find('HSS6X6X.250')[0], 'HSS6X6X1/4');
  assert.equal(H.find('hss 8x4x3/16')[0], 'HSS8X4X3/16');
  assert.equal(H.find('HSS12X8X.500')[0], 'HSS12X8X1/2');
  assert.equal(H.find('W12X26'), null);
});

// AISC Manual 15th Ed.: Table 3-13 (phi_b M_nx), Table 4-4 (phi_c P_n), Table 1-11/1-12 properties. Fy = 50 ksi (A500 Gr. C).
test('hand case HSS6X6X1/4: flexure, shear, compression', () => {
  const p = H.section('HSS6X6X1/4', 'A500C');
  // b = 6 - 3(0.233) = 5.301, b/t = 22.75 (Manual: 22.8): compact (1.12 sqrt(29000/50) = 26.97)
  near(p.bFlat, 5.301, 1e-9, 'b');
  const c = H.capacities(p, { Lcx: 120, Lcy: 120 });
  assert.equal(c.cls.x.flange.cls, 'compact');
  // phi Mn = 0.9 (50)(11.2)/12 = 42.0 kip-ft (Manual Table 3-13: 42.0)
  near(c.fx.phiMn / 12, 42.0, 1e-9, 'phiMnx');
  // phi Vn = 0.9 (0.6)(50)(2)(5.301)(0.233)(1.0) = 66.70 kip
  near(c.vx.phiVn, 0.9 * 0.6 * 50 * 2 * 5.301 * 0.233, 1e-9, 'phiVn');
  // Lc = 10 ft: Lc/r = 120/2.34 = 51.28, Fe = pi^2 29000/51.28^2 = 108.8 ksi, Fcr = 0.658^(50/108.8)(50) = 41.25 ksi,
  // phi Pn = 0.9 (41.25)(5.24) = 194.6 kip (Manual Table 4-4 at 10 ft: 195)
  near(c.comp.phiPn, 194.55, 0.01, 'phiPn 10 ft');
  near(c.comp.phiPn, 195, 1, 'phiPn 10 ft vs Manual');
  // T: h/t 22.75 <= 2.45 sqrt(E/Fy) = 59.0 -> Fcr = 0.6 Fy = 30; phi Tn = 0.9(30)(15.4)/12 = 34.65 kip-ft
  near(c.tor.phiTn / 12, 34.65, 1e-9, 'phiTn');
  // tension: 0.9(50)(5.24) = 235.8 vs 0.75(62)(5.24) = 243.7 -> 235.8
  near(c.ten.phiPn, 235.8, 1e-9, 'phiPt');
});

test('hand case HSS8X8X3/16: slender walls in compression (E7) and slender flange (F7-3)', () => {
  const p = H.section('HSS8X8X3/16', 'A500C');
  const c = H.capacities(p, { Lcx: 0, Lcy: 0 });
  // b/t = (8 - 3(0.174))/0.174 = 42.98 > 1.40 sqrt(E/Fy) = 33.72: slender in compression and in flexure
  assert.equal(c.cls.comp.b.cls, 'slender');
  assert.equal(c.cls.x.flange.cls, 'slender');
  // Lc = 0: Fcr = Fy = 50; b_e per E7-3 with Fel = (1.38(33.72)/42.98)^2 (50) = 58.61 ksi:
  // b_e = 7.478 (1 - 0.20 sqrt(58.61/50)) sqrt(58.61/50) = 6.183 in
  const lr = 1.40 * Math.sqrt(29000 / 50), lam = (8 - 3 * 0.174) / 0.174, Fel = Math.pow(1.38 * lr / lam, 2) * 50;
  const be = 7.478 * (1 - 0.20 * Math.sqrt(Fel / 50)) * Math.sqrt(Fel / 50);
  near(c.comp.wb.be, be, 1e-9, 'be');
  near(c.comp.Ae, p.A - 4 * (7.478 - be) * 0.174, 1e-9, 'Ae');
  assert.equal(c.fx.gov.ref, 'F7-3');
});

test('interaction H1-1a / H1-1b and H3-6', () => {
  const p = H.section('HSS6X6X1/4');
  const c = H.capacities(p, { Lcx: 120, Lcy: 120 });
  const a = H.ratios(c, { P: -0.5 * c.comp.phiPn, Mx: 0.3 * c.fx.phiMn, My: 0.1 * c.fy.phiMn });
  near(a.H1, 0.5 + 8 / 9 * 0.4, 1e-12, 'H1-1a'); assert.equal(a.H1ref, 'H1-1a');
  const b = H.ratios(c, { P: 0.1 * c.ten.phiPn, Mx: 0.5 * c.fx.phiMn });
  near(b.H1, 0.05 + 0.5, 1e-12, 'H1-1b'); assert.equal(b.Pkind, 'tension');
  const t = H.ratios(c, { P: 0, Mx: 0.2 * c.fx.phiMn, Vx: 0.1 * c.vx.phiVn, T: 0.3 * c.tor.phiTn });
  assert.ok(t.torsionOn);
  near(t.H3, 0.2 + Math.pow(0.1 + 0.3, 2), 1e-12, 'H3-6');
  const n = H.ratios(c, { T: 0.1 * c.tor.phiTn });
  assert.equal(n.H3, null);
});

// ---- the Steel Beam Design app's own functions, on the same shapes ----
const SBD = fs.readFileSync(path.join(ROOT, 'Steel Beam Design - AISC 15th.html'), 'utf8');
function grab(name) {
  const i = SBD.indexOf('function ' + name + '(');
  assert.ok(i >= 0, name + ' not found in Steel Beam Design');
  let d = 0, j = SBD.indexOf('{', i);
  for (; j < SBD.length; j++) { if (SBD[j] === '{') d++; else if (SBD[j] === '}') { d--; if (!d) break; } }
  return SBD.slice(i, j + 1);
}
const ctx = { Math, SB_NLW: { set() {} }, fmt: (v) => String(v) };
vm.createContext(ctx);
vm.runInContext('const EKSI=29000,GKSI=11200,PI=Math.PI,SQ=Math.sqrt;\n' +
  ['classifyFlex', 'classifyComp', 'seSlenderRect', 'flexRectHSS', 'finishFlex', 'cv2Of', 'shearMajor', 'shearMinor', 'compStrength', 'tensionStrength', 'torsionHSS'].map(grab).join('\n') +
  '\nthis.api={classifyFlex,flexRectHSS,shearMajor,shearMinor,compStrength,tensionStrength,torsionHSS};', ctx);
const S = ctx.api;
function sbdSection(row, Fy, Fu) {
  const [, , A, Ht, B, tnom, tdes, , , Ix, Zx, Sx, rx, Iy, Zy, Sy, ry, J, Cc] = row;
  const p = { _kind: 'R', mat: { Fy, Fu }, A, Ht, B, tnom, tdes, Ix, Zx, Sx, rx, Iy, Zy, Sy, ry, J, Cc };
  p.bFlat = B - 3 * tdes; p.hFlat = Ht - 3 * tdes; p.btdes = p.bFlat / tdes; p.htdes = p.hFlat / tdes;
  return p;
}

test('every rectangular HSS, A500 Gr. C and B: identical to Steel Beam Design', () => {
  let n = 0;
  for (const g of ['A500C', 'A500B']) {
    const G = H.grades[g];
    for (const row of H.rows) {
      const p = H.section(row[0], g), q = sbdSection(row, G.Fy, G.Fu);
      for (const L of [0, 60, 144, 240, 360]) {
        const c = H.capacities(p, { Lcx: L, Lcy: 0.8 * L, Lb: L, Cb: 1.0 });
        const k = S.compStrength(q, L, 0.8 * L, 0);
        rel(c.comp.phiPn, k.phiPn, 1e-12, `${row[0]} ${g} Pn L=${L}`);
        // square HSS: no LTB here (F7.4 User Note: it does not occur in square sections); Steel Beam Design runs F7.4 for
        // them too, so a square shape is compared at Lb = 0
        const fx = S.flexRectHSS(q, 'x', row[3] > row[4] ? L : 0, 1.0);
        if (!fx.blocked) {
          rel(c.fx.phiMn, fx.phiMn, 1e-12, `${row[0]} ${g} Mnx Lb=${L}`);
        } else assert.ok(c.fx.blocked, `${row[0]} blocked in both`);
        const fy = S.flexRectHSS(q, 'y', 0, 1.0);
        if (!fy.blocked) rel(c.fy.phiMn, fy.phiMn, 1e-12, `${row[0]} ${g} Mny`);
        n++;
      }
      rel(c0(p).vx.phiVn, 0.9 * S.shearMajor(q).Vn, 1e-12, `${row[0]} Vx`);
      rel(c0(p).vy.phiVn, 0.9 * S.shearMinor(q).Vn, 1e-12, `${row[0]} Vy`);
      rel(c0(p).ten.phiPn, S.tensionStrength(q).phiPn, 1e-12, `${row[0]} Pt`);
      rel(c0(p).tor.phiTn, S.torsionHSS(q, 120).phiTn, 1e-12, `${row[0]} Tn`);
    }
  }
  assert.ok(n > 5000);
});
const c0 = (p) => H.capacities(p, {});

test('steps: every step has the step fields, unique ids, finite values', () => {
  const p = H.section('HSS8X4X3/16');
  const c = H.capacities(p, { Lcx: 180, Lcy: 180, Lb: 180 });
  const r = H.ratios(c, { P: -10, Mx: 100, My: 20, Vx: 2, Vy: 1, T: 80 });
  const all = H.capSteps(c, 'm1').concat(H.demandSteps(c, { P: -10, Mx: 100, My: 20, Vx: 2, Vy: 1, T: 80 }, r, 'm1'));
  const ids = new Set();
  for (const s of all) {
    for (const k of ['id', 'label', 'sym', 'eq', 'sub', 'value', 'unit', 'd', 'ref']) assert.ok(k in s, `${s.id} has ${k}`);
    assert.ok(!ids.has(s.id), 'unique ' + s.id); ids.add(s.id);
    assert.ok(typeof s.value === 'string' || Number.isFinite(s.value), `${s.id} value ${s.value}`);
  }
  assert.ok(all.some(s => s.id === 'm1.h3'), 'torsion interaction shown when Tr > 0.2Tc');
});

test('steps: sym, eq, sub, unit and the $...$ in notes parse in KaTeX (strict)', () => {
  const katex = createRequire(import.meta.url)(path.join(ROOT, 'tests/libs/katex@0.16.9/dist/katex.min.js'));
  const W = loadShared('units.js', 'steps.js');
  const parse = t => katex.renderToString(t, { ...W.SharedSteps.katexOpt, throwOnError: true, strict: 'error' });
  const bad = [];
  for (const [name, L, d] of [['HSS8X4X3/16', { Lcx: 180, Lcy: 180, Lb: 180 }, { P: -10, Mx: 100, My: 20, Vx: 2, Vy: 1, T: 80 }],
    ['HSS8X8X3/16', { Lcx: 300, Lcy: 300 }, { P: 30, Mx: 10 }], ['HSS6X6X1/4', { Lcx: 4000, Lcy: 4000 }, { P: -1 }]]) {
    const c = H.capacities(H.section(name), L), r = H.ratios(c, d);
    for (const st of H.capSteps(c, 'm').concat(H.demandSteps(c, d, r, 'm'))) {
      for (const k of ['sym', 'eq', 'sub']) if (st[k]) { try { parse('\\displaystyle ' + st[k]); } catch (e) { bad.push(st.id + ' ' + k + ': ' + st[k]); } }
      if (st.unit) { try { parse('0\\;' + W.SharedSteps.unitTeX(st.unit)); } catch (e) { bad.push(st.id + ' unit'); } }
      String(st.note || '').replace(/\$([^$]+)\$/g, (m, t) => { try { parse(t); } catch (e) { bad.push(st.id + ' note: ' + t); } return m; });
    }
  }
  assert.deepEqual(bad, []);
});
