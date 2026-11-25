// apps/ps-bridge SH-SP (2026-11-25, §4): the stirrup spacing check and β of AASHTO LRFD 10th Ed. Eq. 5.7.3.4.2-2 where the section has less
// than A_v,min (engine/shear-sp.js window.PSBShearSp; fixlog/ps-bridge.md SH-SP). A made-up bridge built here from the default project.
//   1. The copy of computeAll: every edit anchor found once; a design with at least A_v,min at both spacings gets the engine's own result
//      (tolerance 0) plus the new check (PASS), on every parity case (recorded + 600 seeded + edge).
//   2. The made-up NEXT 24F (45 ft, 6 in deck, A_v = 0.40 in², 6 in end zones over 0.25 L, 18 in between): before, every check passes
//      (Shear 0.444) although the engine's own table has the spacing FAIL; after, the spacing check fails with the spacing reason, the
//      Shear (strength) check passes at 0.531, β = 3.036 by Eq. -2 (hand check).
//   3. The same design with adequate stirrups (9 in between): unchanged.
//   4. The worked steps: values = the engine's; A_v,min, s_x, s_xe and Eq. -2 shown where A_v < A_v,min; the spacing check worked.
//   5. With engine/pl.js / engine/ut.js copies (a pedestrian load, a utility allowance): the anchors are in their copies too.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { recordedCases, seededCases, edgeCases } from './psbridge-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const ENG = ['sections', 'model', 'rigid', 'lldf-fg', 'lldf-opt', 'ut', 'pl', 'applicability', 'deckdist', 'shear-sp', 'holddown', 'pierblock', 'rating-along', 'demands', 'design', 'bridge', 'bridge-dl',
  'fields', 'inputcheck', 'worked', 'worked-stress', 'worked-strength', 'worked-end', 'worked-hdr'];
const load = list => loadShared('steps.js', 'deck.js', 'barrier.js', ...PBDF, ...list.map(n => path.join(APP, `engine/${n}.js`)));
const W = load(ENG), W0 = load(ENG.filter(n => n !== 'shear-sp'));
const SP = W.PSBShearSp, NAME = 'Stirrup spacing (5.7.2.5, 5.7.2.6)';
const J = v => JSON.parse(JSON.stringify(v));
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''}: ${a} vs ${b}`);
const tag = v => Number.isNaN(v) ? '$NaN' : v === Infinity ? '$+Inf' : v === -Infinity ? '$-Inf' : Object.is(v, -0) ? '$-0' : v;
function canon(v, L, st = []) {
  if (typeof v === 'number') return tag(v);
  if (v === undefined) return '$undef';
  if (typeof v === 'function') { const l = +L > 0 ? +L : 100, a = v.length <= 1 ? [0, 0.5, 2.5, l * 0.1, l * 0.4, l / 2, l * 0.9, l].map(x => [x]) : [[l * 0.3, 250, 170, 1], [l / 2, 262, 160, 0.5]].map(q => q.slice(0, v.length));
    return { $fn: a.map(q => { try { return canon(v(...q), L, st); } catch (e) { return { $throw: String(e && e.message) }; } }) }; }
  if (v === null || typeof v !== 'object') return v;
  if (st.includes(v)) return '$cycle';
  if (ArrayBuffer.isView(v)) return Array.from(v, tag);
  st.push(v); let o; if (Array.isArray(v)) o = v.map(x => canon(x, L, st)); else { o = {}; for (const k of Object.keys(v)) o[k] = canon(v[k], L, st); } st.pop(); return o;
}
/* strip(R): R without what SH-SP adds (the spacing check, the station rows' bq), for comparing with the engine's own result */
const unbq = v => { if (Array.isArray(v)) v.forEach(unbq); else if (v && typeof v === 'object') { delete v.bq; Object.values(v).forEach(unbq); } return v; };
const strip = R => { if (!R || R.error) return R; const o = Object.assign({}, R); if (Array.isArray(R.checks)) o.checks = R.checks.filter(c => c.n !== NAME); return o; };
const text = (R, L, sp) => JSON.stringify(sp ? unbq(canon(strip(R), L)) : canon(R, L));
// the made-up bridge: 5 NEXT 24F at 8 ft, 1.5 ft overhangs, one 45 ft span, 6 in deck, 22 strands (0.6 in): 10 at 2 in and 10 at 4 in (2 of each
// debonded 6 ft), 2 at 6 in; stirrups A_v = 0.40 in² (2 legs), 6 in over 0.25 L at each end, s_int between; bonded release steel 4.0 in²
const next24 = (M, sInt) => { const P = M.defaultProject(); P.project.name = 'SH-SP made-up NEXT 24F'; P.base.girder = 'NEXT 24F'; P.spans.lengths = [45]; P.base.ts = 6; P.base.harp.n = 0;
  Object.assign(P.base.opt, { stirAv: 0.40, sEnd: 6, sInt: sInt == null ? 18 : sInt, endZoneLen: 0.25, relAs: 4 });
  P.xs.nb = 5; P.xs.bays = [8, 8, 8, 8]; P.xs.ohL = 1.5; P.xs.ohR = 1.5; P.xs.skews = [0, 0];
  P.base.rows = [{ n: 10, y: 2, nd: 2, dbnd: 6 }, { n: 10, y: 4, nd: 2, dbnd: 6 }, { n: 2, y: 6, nd: 0, dbnd: 0 }]; return P; };
const run = (Wx, P) => { const i = Wx.PSBDesign.inputs(P); return { i, R: Wx.PSBHoldDown.compute(J(i)) }; };
const ck = (R, n) => R.checks.find(c => c.n === n);

test('the copy of computeAll: every edit anchor once; at least A_v,min at both spacings: the engine\'s result + the spacing check (tolerance 0)', () => {
  const f = SP.engine(W.computeAll); assert.equal(typeof f, 'function'); assert.equal(SP.EDITS.length, 4); assert.equal(SP.engine(W.computeAll), f, 'made once');
  const src = W.computeAll.toString(); SP.EDITS.forEach(([a]) => assert.equal(src.split(a).length - 1, 1, a));
  const all = [...recordedCases(), ...seededCases(600), ...edgeCases()]; let n = 0, same = 0, low = 0, spF = 0;
  for (const c of all) {
    const inp = J(W.mergeInputs(c.saved == null ? null : J(c.saved))); n++;
    const o = inp.opt || {}, m = inp.mat || {}, g = (() => { try { return W.girderGross(inp); } catch (e) { return null; } })();
    const sMinR = g && g.bw > 0 ? +o.stirAv * +o.fy / (0.0316 * Math.sqrt(+m.fc) * g.bw) : NaN;
    if (!(+o.sEnd <= sMinR + 1e-3 && +o.sInt <= sMinR + 1e-3)) {   // less than A_v,min somewhere: station by station, only β (and what it feeds) changes
      let R0, R1; try { R0 = W.computeAll(J(inp)); R1 = f(J(inp)); } catch (e) { continue; }
      if (R0.error || R1.error) { assert.equal(R1.error, R0.error, c.name); continue; }
      low++; assert.equal(R1.shear.length, R0.shear.length, c.name);
      R1.shear.forEach((r, k) => { const q = R0.shear[k]; assert.equal(r.x, q.x); assert.equal(r.es, q.es); assert.equal(r.theta, q.theta); assert.equal(r.Vs, q.Vs); assert.equal(r.Vu, q.Vu);
        assert.equal(r.bq.eq, r.sProv > r.sMinR + 1e-3 ? 2 : 1, c.name + ' Eq.'); if (r.bq.eq === 2) near(r.beta, q.beta * 51 / (39 + Math.min(80, Math.max(12, r.dv * 1.38 / (0.75 + 0.63)))), 1e-12 * q.beta, c.name + ' β Eq. -2 at ' + r.x); else assert.equal(r.beta, q.beta, c.name + ' β at ' + r.x); });
      continue;
    }
    let A, B, R1; try { A = text(W.computeAll(J(inp)), inp.L); } catch (e) { A = 'throw ' + e.message; }
    try { R1 = f(J(inp)); B = text(R1, inp.L, true); } catch (e) { B = 'throw ' + e.message; }
    assert.equal(B, A, c.name);
    if (R1 && !R1.error) { const k = ck(R1, NAME); assert.ok(k, c.name + ': the spacing check'); assert.equal(k.pass, R1.shear.filter(r => !r.isBearing).every(r => r.spOK), c.name + ': PASS exactly where the engine\'s table has no spacing FAIL');
      if (!k.pass) { spF++; assert.match(k.why, /^NG — stirrup spacing /); } assert.ok(R1.shear.every(r => r.bq.eq === 1), c.name + ': Eq. -1 everywhere'); }
    same++;
  }
  assert.ok(same >= 100, 'cases with at least A_v,min ' + same);
  console.log(`  SH-SP: ${same} of ${n} parity cases have at least A_v,min at both spacings: the engine's result + the spacing check (0 differences; ${spF} of them now FAIL on the spacing alone, s > s_max of 5.7.2.6 where the engine's table already said FAIL); ${low} with less: θ, ε_s, V_s, V_u the engine's, β × 51/(39 + s_xe) exactly where A_v < A_v,min`);
});

test('made-up NEXT 24F, 18 in between the end zones: NG on the stirrup spacing (not the strength ratio); β by Eq. 5.7.3.4.2-2 (hand check)', () => {
  const P = next24(W.PSBModel);
  assert.equal(W.PSBInputCheck.collect(P).errors.length, 0, 'no input errors');
  const { R: R0 } = run(W0, P), { R } = run(W, P);
  assert.equal(R0.error, null); assert.equal(R.error, null);
  // before: every check passes, while the engine's own table has the spacing FAIL (bug 1)
  assert.equal(R0.checks.filter(c => !c.pass).length, 0, 'every check passes before');
  assert.equal(R0.shear.filter(r => !r.isBearing && !r.spOK).map(r => r.x).join(), '13.5,18,27,31.5', 'the engine\'s table: spacing FAIL');
  near(ck(R0, 'Shear').r, 0.4441, 5e-5, 'Shear before'); assert.equal(ck(R0, NAME), undefined);
  // after: the spacing check fails, and only it; the reason names the spacing
  assert.equal(R.checks.filter(c => !c.pass).map(c => c.n).join('|'), NAME);
  const c = ck(R, NAME);
  assert.equal(c.v, 18); near(c.lim, 9.4729, 5e-5, 's_max,gov'); near(c.r, 18 / 9.472879, 1e-5, 'ratio s / s_max,gov'); assert.equal(c.u, 'in'); assert.equal(c.loc, 11.26);
  assert.equal(c.why, 'NG — stirrup spacing 18 in > 9.47 in at x = 11.3–18.0 and 27.0–33.7 ft');
  const sh = ck(R, 'Shear'); assert.ok(sh.pass); near(sh.r, 0.5307, 5e-5, 'Shear after'); assert.equal(sh.loc, 13.5);
  // the governing station x = 13.5 ft: hand check (f'c = 8.5 ksi, b_v = 27.5 in, d_v = 24.908 in, ε_s = 0.34908e-3, A_v = 0.40 in², s = 18 in)
  const s = R.wShear, s0 = R0.wShear; assert.equal(s.x, 13.5); near(s.dv, 24.9085, 5e-5, 'd_v'); near(s.es, 0.349077e-3, 5e-10, 'ε_s (unchanged)'); assert.equal(s.es, s0.es);
  const AvMin = 0.0316 * Math.sqrt(8.5) * 27.5 * 18 / 60;   // Eq. 5.7.2.5-1 = 0.7601 in² > 0.40: less than A_v,min
  near(AvMin, 0.7601, 5e-5, 'A_v,min'); near(s.bq.AvMin, AvMin, 1e-12, 'bq.AvMin'); assert.equal(s.bq.eq, 2); assert.equal(s.bq.low, true);
  near(s.bq.sxe, 24.9085, 5e-5, 's_xe = 24.908 × 1.38 / (0.75 + 0.63)');
  near(s0.beta, 3.8041, 5e-5, 'β Eq. -1 (before)'); near(s.beta, 3.8041 * 51 / (39 + 24.9085), 5e-4, 'β Eq. -2'); near(s.beta, 3.0357, 5e-5, 'β Eq. -2 = 3.036');
  assert.equal(s.theta, s0.theta, 'θ by Eq. 5.7.3.4.2-3 in both cases'); near(s.theta, 30.2218, 5e-5, 'θ');
  near(s0.Vc, 240.06, 5e-3, 'V_c before'); near(s.Vc, 191.57, 5e-3, 'V_c after'); assert.equal(s.Vs, s0.Vs); near(s.Vs, 57.01, 5e-3, 'V_s');
  near(s0.phiVn, 267.37, 5e-3, 'φV_n before'); near(s.phiVn, 223.73, 5e-3, 'φV_n after');
  // the 5.7.2.3 test with the corrected V_c: the station at 11.26 ft (first past the end zone) now requires stirrups too
  const r1126 = R.shear.find(r => r.x === 11.26), r1126o = R0.shear.find(r => r.x === 11.26);
  assert.equal(r1126o.stirReq, false); assert.equal(r1126.stirReq, true); assert.equal(r1126.spOK, false);
  // stations with at least A_v,min (the 6 in end zones): unchanged
  R.shear.forEach((r, k) => { if (r.bq.eq === 1) { assert.equal(r.beta, R0.shear[k].beta); assert.equal(r.Vc, R0.shear[k].Vc); assert.equal(r.dc, R0.shear[k].dc); } });
  // the shear rating takes the corrected φV_n (the same section)
  assert.equal(R.shrRating.x, R0.shrRating.x); near(R.shrRating.phiVn, s.phiVn, 1e-9, 'shrRating φV_n'); assert.ok(R.shrRating.RFinv < R0.shrRating.RFinv);
  // saved data: nothing new in the project
  assert.equal(W.PSBModel.exportJSON(P), W0.PSBModel.exportJSON(P));
});

test('the same design with adequate stirrups (9 in between the end zones, A_v ≥ A_v,min): unchanged, the spacing check passes', () => {
  const P = next24(W.PSBModel, 9), { R: R0 } = run(W0, P), { R } = run(W, P);
  assert.equal(text(R, R.L, true), text(R0, R0.L));
  const c = ck(R, NAME); assert.ok(c.pass); assert.equal(c.why, ''); near(c.r, 9 / 9.472879, 1e-5, 'ratio');
  assert.ok(R.shear.every(r => r.bq.eq === 1));
});

test('worked steps: the engine\'s values; A_v,min, s_x, s_xe and Eq. 5.7.3.4.2-2 where A_v < A_v,min; the spacing check worked with its reason', () => {
  const at = (o, p) => p.split('.').reduce((a, k) => a == null ? a : a[k], o);
  for (const [sInt, eq2] of [[18, true], [9, false]]) {
    const { i, R } = run(W, next24(W.PSBModel, sInt)), out = W.PSBWorkedStrength.shear(i, R), st = id => out.steps.find(s => s.id === 'sh.' + id);
    out.pairs.forEach(p => near(p.shown, p.engine, 1e-9 * Math.max(1, Math.abs(p.engine)), p.id));
    Object.entries(out.paths).forEach(([id, p]) => { const s = out.steps.find(q => q.id === id); if (s && typeof s.value === 'number') assert.equal(s.value, at(R, p), id + ' = ' + p); });
    assert.equal(st('xg').value, R.wShear.x, 'the steps work the governing station');
    assert.ok(st('AvMin'), 'A_v,min step');
    if (eq2) {
      assert.match(st('beta').ref, /Eq\. 5\.7\.3\.4\.2-2$/); assert.match(st('beta').eq, /\\frac\{51\}\{39 \+ s_\{xe\}\}/); assert.match(st('beta').note, /less than A_v,min/);
      assert.match(st('AvMin').note, /0\.400 in² < A_v,min/); assert.ok(st('sx') && st('sxe')); assert.match(st('sxe').ref, /Eq\. 5\.7\.3\.4\.2-7/);
      assert.equal(st('spr').ok, false); assert.match(st('spr').note, /NG — stirrup spacing 18 in > 9\.47 in at x = 11\.3–18\.0 and 27\.0–33\.7 ft/);
      assert.match(st('gov').note, /§sh\.spr/); assert.equal(st('gov').ok, true);
    } else {
      assert.match(st('beta').ref, /Eq\. 5\.7\.3\.4\.2-1$/); assert.equal(st('sx'), undefined); assert.equal(st('sxe'), undefined); assert.equal(st('spr').ok, true);
    }
  }
});

test('with the copies of engine/pl.js and engine/ut.js (a pedestrian load, a utility allowance): the anchors are found and the check is made', () => {
  const fPL = W.PSBPL.engine(), fSP = SP.engine(fPL); assert.notEqual(fSP, fPL); assert.equal(SP.engine(fSP), fSP, 'a copy is not copied again');
  const fUT = W.PSBUT.engine(fPL); assert.equal(typeof SP.engine(fUT), 'function');
  const P = next24(W.PSBModel); if (!P.xs.dl) P.xs.dl = W.PSBBridgeDL.defaults(P); P.xs.dl.swL = { w: 6, t: 9 }; P.xs.dl.ped = 75;
  const { i, R } = run(W, P); assert.ok(i.pl && i.pl.w > 0, 'pedestrian load on the line'); assert.ok(R.pl); assert.ok(ck(R, NAME), 'the spacing check with the pedestrian load');
  assert.ok(R.shear.some(r => r.bq.eq === 2));
});
