#!/usr/bin/env node
// Abutment calculator (abutment_calculator.html): backwall offset e and the stem shelf (ABSH, engineer request 2026-11-10).
//   node tests/smoke/abutment-stem-shelf.mjs [--a <git ref, default origin/main>]
// 1. e = 0 (the default, and every saved project without geom.bwOff): LAST_R (JSON), the warnings and the Input ID identical to A over
//    10 projects (default, approach slab on the paving notch / on the deck end with skew, Extreme Event I, MassDOT seismic stop, pile footing,
//    equivalent dead load, semi-integral, integral, water + Coulomb); a saved project without the fields opens with the same results.
// 2. Hand check (the engineer's plan detail): 2'-0" backwall, e = 10 in, slab seat d_sh = 9 in below the top, approach slab t = 9 in,
//    t_st = t_sb = 5.5 ft, the rest the default project. Before (e = 0, paving notch) and after (e = 10 in) against values worked by hand.
//    ABBF (engineer decision 2026-11-10): the bearings stay where they are with e = 0 (x_brg = x_stem,back − t_bw − setback); only the seat
//    between the bearing line and the inset backwall narrows (a_bw = setback − e). The hand-check values below follow that decision.
//    ABBF2 (2026-11-10): the bearing is entered as a_f from the stem front face; this hand check gives it by the setback (1.25 ft, as a
//    project saved before a_f: brgFront removed, a_f = t_st − t_bw − setback = 2.25 ft).
// 3. Input errors: e + t_bw > t_st; e > 0 with no slab and no d_sh. Semi-integral / integral ignore e.
// 4. Drawings (DXF valid, the section has the shelf outline), 3D (the slab top at the top of the backwall), Report builds;
//    no console errors; no horizontal scroll at 390 px.
// 5. ABSS: d_sh = 30 in > t = 15 in — the slab drawn t thick; EE-I backwall slab arm t/2; d_sh < t a check-input warning.
// 6. ABFL (engineer decision 2026-11-10): the step d_sh − t over the slab loaded as fill (EV): hand check of w_EV, R_EV, q_EV, the shelf
//    bearing, the slab design, the stem eccentricity, the shear-friction clamp, the EE-I slab mass and the backwall; none when d_sh ≤ t or blank.
import fs from 'fs';
import os from 'os';
import path from 'path';
import vm from 'vm';
import { execFileSync } from 'child_process';
import { openPage, REPO, diff } from '../lib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const REF = arg('a', 'origin/main');
const sha = execFileSync('git', ['-C', REPO, 'rev-parse', '--short', REF], { encoding: 'utf8' }).trim();
const ADIR = path.join(os.tmpdir(), 'allstruct-tests', 'tree-' + sha);
if (!fs.existsSync(path.join(ADIR, '.done'))) { fs.mkdirSync(ADIR, { recursive: true }); execFileSync('sh', ['-c', `git -C "${REPO}" archive ${sha} | tar -x -C "${ADIR}"`]); fs.writeFileSync(path.join(ADIR, '.done'), sha); }
const FA = path.join(ADIR, 'abutment_calculator.html'), FB = path.join(REPO, 'abutment_calculator.html');
const dctx = { window: {} }; vm.createContext(dctx); vm.runInContext(fs.readFileSync(path.join(REPO, 'shared/dxf.js'), 'utf8'), dctx); const X = dctx.window.SharedDxf;

let fails = 0; const check = (ok, m) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${m}`); if (!ok) fails++; };
const near = (a, b, tol = 1e-3) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const ready = p => p.waitForFunction(() => window.LAST_R, null, { timeout: 60000 });

const CASES = {
  default: () => {},
  slabNotch: () => { S.apSlab.on = true; },
  slabDeckSkew: () => { S.apSlab.on = true; S.apSlab.sup = 'deck'; S.geom.skew = 20; },
  slabEE: () => { S.apSlab.on = true; S.seismic.on = true; S.seismic.As = 0.2; S.own.Ltot = 200; },
  massdotStop: () => { S.own.owner = 'MassDOT'; S.apSlab.on = true; S.seismic.on = true; S.seismic.bwStop = true; },
  pile: () => { S.fnd.branch = 'pile'; S.apSlab.on = true; },
  eqLoad: () => { S.apSlab.on = true; S.apSlab.qEq = 1.2; },
  semi: () => { S.iab.type = 'semi'; S.apSlab.on = true; },
  integral: () => { S.iab.type = 'integral'; S.apSlab.on = true; },
  waterCoulomb: () => { S.geom.hw = 6; S.soil.method = 'coulomb'; },
};
async function snapAll(file) {
  const o = await openPage(file, { vw: 1400, vh: 1000 }); await ready(o.p);
  const out = {};
  for (const [nm, su] of Object.entries(CASES)) {
    out[nm] = await o.p.evaluate(su0 => { const st = JSON.parse(JSON.stringify(S));
      try { eval('(' + su0 + ')')(); migrate(); recalcAll();
        return { R: JSON.parse(JSON.stringify(window.LAST_R, (k, v) => typeof v === 'number' && !isFinite(v) ? String(v) : v)), W: WARNINGS.map(w => w.level + ':' + w.msg), fp: window.LAST_R.fingerprint };
      } finally { Object.keys(S).forEach(k => delete S[k]); Object.assign(S, st); recalcAll(); } }, su.toString());
  }
  // a saved project without the new fields (as main saves it) opens with the same results
  out.saved = await o.p.evaluate(() => { const st = JSON.parse(JSON.stringify(S)); try { S.apSlab.on = true; migrate(); recalcAll();
      const j = JSON.parse(JSON.stringify(S)); delete j.geom.bwOff; delete j.geom.shD; Object.keys(S).forEach(k => delete S[k]); Object.assign(S, j); migrate(); recalcAll();
      return { R: JSON.parse(JSON.stringify(window.LAST_R, (k, v) => typeof v === 'number' && !isFinite(v) ? String(v) : v)), fp: window.LAST_R.fingerprint, bwOff: S.geom.bwOff };
    } finally { Object.keys(S).forEach(k => delete S[k]); Object.assign(S, st); recalcAll(); } });
  const errs = o.errs.slice(); await o.b.close(); return { out, errs };
}

console.log(`1. e = 0: identical to ${REF} (${sha})`);
{ const [a, b] = await Promise.all([snapAll(FA), snapAll(FB)]);
  for (const nm of [...Object.keys(CASES), 'saved']) { const x = a.out[nm], y = b.out[nm], dR = diff(x.R, y.R), dW = diff(x.W || [], y.W || []);
    check(!dR.length && !dW.length && x.fp === y.fp, `${nm}: LAST_R ${dR.length ? dR.length + ' diffs ' + JSON.stringify(dR.slice(0, 2)) : 'identical'} (${JSON.stringify(y.R).length} chars), warnings ${dW.length ? 'DIFF' : 'same'}, Input ID ${y.fp}`); }
  check(b.out.saved.bwOff === 0, 'saved project without geom.bwOff opens with e = 0');
  check(!b.errs.length, `console errors (B): ${b.errs.length} ${b.errs.slice(0, 2).join(' | ')}`); }

console.log('2. Hand check: 2\'-0" backwall, e = 10 in, slab seat 9 in below the top');
{ const o = await openPage(FB, { vw: 1400, vh: 1000 }), p = o.p; await ready(p);
  const r = await p.evaluate(() => {
    const setup = e => { S.apSlab.on = true; S.apSlab.t = 0.75; S.geom.tbw = 2.0; S.geom.tst = 5.5; S.geom.tsb = 5.5; delete S.geom.brgFront; S.geom.bwOff = e; S.geom.shD = e > 0 ? 9 : 0; migrate(); recalcAll(); };
    const perm = l => window.LAST_R.permTables['Strength I'].find(x => x.lbl === l);
    const P1 = '0.90·DC + 0.65·DW + 1.00·EV + 1.50·EH + 1.75·(BR,LS), LL reaction off + 1.00·TU/CR/SH';
    const pick = () => { const R = window.LAST_R, G = R.groups, c = R.checks, q = perm(P1);
      return { geo: R.geo, ap: { x: R.ap.x, RDC: R.ap.RDC, WSh: R.ap.WSh, sup: R.ap.sup, eBw: R.ap.eBw }, parts: R.parts.map(x => ({ n: x.name, W: x.W, x: x.x })),
        DCsub: [G.DCsub.V, G.DCsub.Mv], APdc: [G.APdc.V, G.APdc.Mv], APdw: [G.APdw.V, G.APdw.Mv], DCsup: [G.DCsup.V, G.DCsup.Mv], DW: [G.DW.V, G.DW.Mv],
        stem: { Mu: R.stemDem.Mu, Mecc: R.stemDem.MeccPerFt, Pv: R.stemDem.Pv, Map: R.stemDem.Map, Mself: R.stemDem.MselfEccTot, gDC: R.stemDem.gDCe },
        P1: q ? { V: q.V, Mv: q.Mv, Mh: q.Mh, xbar: q.xbar, e: q.e } : null, ecc: c.ecc.dc, sliding: c.sliding.dc, bearing: c.bearing.dc, stemFlex: c.stemFlex.dcFlex,
        seat: c.seat.Nprov, bs: { cFront: c.bearingSeat.cFront, cBack: c.bearingSeat.cBack, m: c.bearingSeat.m, dc: c.bearingSeat.dc }, bw: { hRet: R.bwDem.hbwRet, MuBW: R.bwDem.MuBW }, ss: R.apStemSh, shelf: !!R.apShelf, err: WARNINGS.filter(w => w.level === 'err').map(w => w.msg) }; };
    setup(0); const a = pick(); setup(10); const b = pick(); S.geom.brgSetback = 1.75; setup(10); const v = pick(); return { a, b, v };
  });
  const { a, b, v } = r, gc = 0.150, Lab = 44, e = 10 / 12;
  // geometry (ft from the toe): x_stem,back = L_toe + t_sb = 3.5 + 5.5 = 9.0
  check(near(a.geo.xBwFront, 7.0) && near(a.geo.xBrg, 5.75) && near(a.geo.seatW, 3.5) && near(a.geo.eBrg, 0.5), `before: x_bw,front = 9 − 2 = 7.000, x_brg = 7 − 1.25 = 5.750, seat 3.500, e_brg 0.500 (${a.geo.xBwFront}, ${a.geo.xBrg}, ${a.geo.seatW}, ${a.geo.eBrg})`);
  // ABBF: was x_brg = x_bw,front − setback = 4.9167, e_brg = 1.3333 (#1373); now the bearing line of e = 0
  check(near(b.geo.xBwFront, 9 - e - 2) && near(b.geo.xBrg, 9 - 2 - 1.25) && near(b.geo.seatW, 5.5 - 2 - e) && near(b.geo.eBrg, 0.5), `after: x_bw,front = 9 − 0.8333 − 2 = 6.1667, x_brg = 9 − 2 − 1.25 = 5.750 (as e = 0), seat 5.5 − 2 − 0.8333 = 2.6667, e_brg = 6.25 − 5.75 = 0.500 (${b.geo.xBwFront.toFixed(4)}, ${b.geo.xBrg.toFixed(4)}, ${b.geo.seatW.toFixed(4)}, ${b.geo.eBrg.toFixed(4)})`);
  check(near(b.geo.off.aBw, 1.25 - e) && near(b.geo.off.cBw, 15 - 10 - 18 / 2), `a_bw = setback − e = 15 − 10 = 5.0 in; c_bw = 5.0 − 18/2 = −4.0 in (the 18 in pad runs into the backwall) (${(b.geo.off.aBw * 12).toFixed(2)}, ${b.geo.off.cBw.toFixed(2)})`);
  // self-weight
  const bwA = a.parts.find(x => x.n === 'Backwall'), bwB = b.parts.find(x => x.n === 'Backwall'), sh = b.parts.find(x => /^Stem shelf/.test(x.n));
  check(near(bwA.W, 2 * 5 * gc * Lab) && near(bwA.x, 8.0) && near(bwB.W, 66) && near(bwB.x, 9 - e - 1), `backwall W = 2 × 5 × 0.150 × 44 = 66.00 kip at x̄ 8.000 → 7.1667 (${bwB.x.toFixed(4)})`);
  check(sh && near(sh.W, e * 4.25 * gc * Lab) && near(sh.x, 9 - e / 2) && !a.parts.some(x => /^Stem shelf/.test(x.n)), `stem shelf W = 0.8333 × (5 − 0.75) × 0.150 × 44 = 23.375 kip at x̄ = 9 − 0.4167 = 8.5833 (${sh && sh.W.toFixed(3)} at ${sh && sh.x.toFixed(4)})`);
  check(near(a.DCsub[0], 851.4) && near(b.DCsub[0], 874.775) && near(b.DCsub[1] - a.DCsub[1], -66 * e + 23.375 * (9 - e / 2)), `ΣDC_sub 851.40 → 874.775 kip; ΔM_v = −66(0.8333) + 23.375(8.5833) = +145.635 kip-ft (${(b.DCsub[1] - a.DCsub[1]).toFixed(3)})`);
  // approach slab: R_DC = 0.150 × 0.75 × 44 × 16/2 = 39.60 kip; before at x = 9 + 6/12 = 9.5 (+ notch 6.60 kip at 9.4583); after at 9 − e/2 = 8.5833, no notch
  check(a.ap.sup === 'shelf' && near(a.ap.x, 9.5) && near(a.ap.WSh, 6.6) && near(a.APdc[1], 39.6 * 9.5 + 6.6 * (9 + 5.5 / 12)), `before: slab R_DC 39.60 kip at 9.500 + notch 6.60 kip at 9.4583 → APdc M_v ${a.APdc[1].toFixed(3)} = 438.625`);
  check(b.ap.sup === 'stem' && near(b.ap.x, 9 - e / 2) && b.ap.WSh === 0 && b.ap.eBw === 0 && near(b.APdc[1], 39.6 * (9 - e / 2)), `after: R_DC 39.60 kip at x_ap = 9 − 0.4167 = 8.5833 (mid-bearing), no notch, e_bw = 0 → APdc M_v ${b.APdc[1].toFixed(3)} = 339.900`);
  check(near(b.DCsup[1], 510 * 5.75) && near(a.DCsup[1], 510 * 5.75), `girder DC 510 kip: M_v 510 × 5.75 = 2932.5, unchanged by e (bearings fixed; #1373 had 510 × 4.9167 = 2507.5) (${b.DCsup[1].toFixed(2)})`);
  // stem base (Strength I governing, per ft): M_ecc = [P_v(x_sc − x_brg) + γ_DC ΣW(x_sc − x̄) + M_ap]/L_ab, x_sc = 6.25
  const meA = (1302 * 0.5 + 0.9 * (-115.5) + (0.9 * (39.6 * 6.25 + 6.6 * 6.25 - 438.625) + 1.5 * (10.56 * 6.25 - 100.32))) / 44;
  const meB = (1480.5 * (6.25 - 5.75) + 1.25 * (66 * (6.25 - (9 - e - 1)) + 23.375 * (6.25 - (9 - e / 2))) + (1.25 * (39.6 * 6.25 - 339.9) + 1.5 * (10.56 * 6.25 - 90.64))) / 44;
  check(near(a.stem.Mecc, meA) && near(b.stem.Mecc, meB), `stem M_ecc = ${a.stem.Mecc.toFixed(4)} (hand ${meA.toFixed(4)}, γ_DC 0.90) → ${b.stem.Mecc.toFixed(4)} (hand ${meB.toFixed(4)}, γ_DC 1.25; #1373: 38.1304 with the arm 1.3333) kip-ft/ft`);
  check(near(b.stem.Mu - a.stem.Mu, meB - meA), `stem M_u ${a.stem.Mu.toFixed(3)} → ${b.stem.Mu.toFixed(3)} kip-ft/ft (Δ = ΔM_ecc = ${(meB - meA).toFixed(3)}; EH, LS, BR unchanged)`);
  // footing: the same Strength I permutation (0.90 DC, 0.65 DW, LL off): ΔV = 0.9(23.375 − 6.6), ΔM_v = 0.9(145.635 − 98.725) + 0.65(−9.68)
  // (ABBF: the girder DC / DW terms −510e and −72e of #1373 drop out, the bearings no longer move)
  const dV = 0.9 * (23.375 - 6.6), dMv = 0.9 * ((-66 * e + 23.375 * (9 - e / 2)) + (339.9 - 438.625)) + 0.65 * (90.64 - 100.32);
  check(a.P1 && b.P1 && near(b.P1.V - a.P1.V, dV) && near(b.P1.Mv - a.P1.Mv, dMv) && near(b.P1.Mh, a.P1.Mh), `footing, Strength I (0.90·DC, LL off): ΔV = ${dV.toFixed(4)} kip, ΔM_v = ${dMv.toFixed(3)} kip-ft (tool ${(b.P1.V - a.P1.V).toFixed(4)}, ${(b.P1.Mv - a.P1.Mv).toFixed(3)}); M_h unchanged`);
  check(near(a.P1.e, 7 - (a.P1.Mv - a.P1.Mh) / a.P1.V) && near(b.P1.e, 7 - (b.P1.Mv - b.P1.Mh) / b.P1.V), `e = B/2 − (M_v − M_h)/V: ${a.P1.e.toFixed(4)} → ${b.P1.e.toFixed(4)} ft (e_lim = 14/3 = 4.667)`);
  // ABBF: #1373 had eccentricity 0.40999 (LL-on, e = 1.9133 ft), bearing 0.83657; sliding does not depend on M_v (0.98842 both)
  check(near(a.ecc, 0.34564, 1e-4) && near(b.ecc, 0.35078, 1e-4) && near(a.sliding, 1.00414, 1e-4) && near(b.sliding, 0.98842, 1e-4) && near(a.bearing, 0.77651, 1e-4) && near(b.bearing, 0.79172, 1e-4),
    `dashboard: eccentricity ${a.ecc.toFixed(4)} → ${b.ecc.toFixed(4)}, sliding ${a.sliding.toFixed(4)} → ${b.sliding.toFixed(4)}, bearing ${a.bearing.toFixed(4)} → ${b.bearing.toFixed(4)}`);
  check(near(b.seat, (5.5 - 2 - e) * 12 - 4) && near(a.seat, 38), `support length N provided = 12(t_st − t_bw − e) − g_end (girder end g_end in front of the inset backwall to the seat front edge) = 38 → ${b.seat.toFixed(2)} in (as #1373)`);
  check(near(b.bs.cFront, 18) && near(b.bs.cBack, 30) && near(b.bs.dc, a.bs.dc), `seat bearing: c_front = (5.5 − 2 − 1.25)(12) − 9 = 18 in, c_back = (1.25 + 2)(12) − 9 = 30 in, D/C ${b.bs.dc.toFixed(4)}: as e = 0 (#1373: 8 / 40 in, 0.1353)`);
  check(near(b.bw.hRet, 0.75) && a.bw.hRet === 5, `backwall retained height above its design section: 5.00 → min(d_sh, 19 − 14 − 4.25) = 0.75 ft`);
  const VuS = 1.25 * 0.9 + 1.5 * 0.24 + 1.75 * 6.354871;   // γ_DC q_DC + γ_DW q_DW + γ_LL q_LL (q of §1.4a: 0.900, 0.240, 6.3549 kip/ft)
  check(b.ss && near(b.ss.qb, b.ss.VuS / 120) && near(b.ss.qR, 0.7 * 0.85 * 4) && !b.shelf && near(VuS, b.ss.VuS), `stem-shelf bearing q_b = V_u,slab/(12e) = ${b.ss.VuS.toFixed(3)}/120 = ${b.ss.qb.toFixed(4)} ksi ≤ 2.38 ksi (D/C ${b.ss.dcB.toFixed(4)}); no bracket checks`);
  check(!a.err.length && b.err.length === 1 && /bearing pad runs into the inset backwall/.test(b.err[0]), `e = 0: no input errors; e = 10 in: only the pad / backwall input error (${b.err.join(' | ').slice(0, 110)})`);
  check(!v.err.length && near(v.geo.xBrg, 9 - 2 - 1.75) && near(v.geo.off.cBw, 21 - 10 - 9) && near(v.geo.eBrg, 1.0), `setback 1.75 ft: x_brg = 5.25, c_bw = 21 − 10 − 9 = 2.0 in, no input error (${v.err.join(' | ')})`);
  check(!o.errs.length, `console errors: ${o.errs.length}`);
  await o.b.close(); }

console.log('3. Input errors and other abutment types');
{ const o = await openPage(FB, { vw: 1400, vh: 1000 }), p = o.p; await ready(p);
  const r = await p.evaluate(() => { const run = su => { const st = JSON.parse(JSON.stringify(S)); try { su(); migrate(); recalcAll(); return { err: WARNINGS.filter(w => w.level === 'err').map(w => w.msg), off: !!window.LAST_R.geo.off }; } finally { Object.keys(S).forEach(k => delete S[k]); Object.assign(S, st); recalcAll(); } };
    const base = JSON.stringify(window.LAST_R);
    return { big: run(() => { S.apSlab.on = true; S.geom.bwOff = 40; }), noD: run(() => { S.geom.bwOff = 6; }), semi: run(() => { S.iab.type = 'semi'; S.geom.bwOff = 10; S.apSlab.on = true; }),
      integ: run(() => { S.iab.type = 'integral'; S.geom.bwOff = 10; S.apSlab.on = true; }), semiRef: run(() => { S.iab.type = 'semi'; S.apSlab.on = true; }) }; });
  check(r.big.err.some(m => /Backwall offset: e \+ t_bw/.test(m)), `e + t_bw > t_st: input error (${r.big.err[0] && r.big.err[0].slice(0, 90)})`);
  check(r.noD.err.some(m => /enter the shelf depth/.test(m)), 'e > 0, no approach slab, d_sh = 0: input error');
  check(!r.semi.off && !r.integ.off && !r.semi.err.length, 'semi-integral and integral: the offset is not used');
  await o.b.close(); }

console.log('4. Drawings, 3D, Report, 390 px');
{ const o = await openPage(FB, { vw: 1400, vh: 1000 }), p = o.p; await ready(p);
  await p.evaluate(() => { S.apSlab.on = true; S.apSlab.t = 0.75; S.geom.tbw = 2; S.geom.tst = 5.5; S.geom.tsb = 5.5; S.geom.bwOff = 10; S.geom.shD = 9; migrate(); recalcAll(); buildInputs(); });
  const d = await p.evaluate(() => { const Bd = abdwBuild(window.LAST_R), G = abdwGeo(window.LAST_R); return { valid: SharedDxf.validate(Bd.D.toDXF({ ltscale: 1 })), n: Bd.S.length, G: { xb: G.xb, xbwB: G.xbwB, xbwF: G.xbwF, ySh: G.ySh, yTop: G.yTop, xs: G.xs } }; });
  check(d.n >= 3 && Math.abs(d.G.xb - d.G.xbwB - 10) < 1e-9 && Math.abs(d.G.xbwB - d.G.xbwF - 24) < 1e-9 && Math.abs(d.G.yTop - d.G.ySh - 9) < 1e-9 && d.G.xs === d.G.xbwB, `DXF geometry (in): back face of the backwall 10 in in front of the stem, 24 in thick, shelf 9 in below the top, slab from the backwall (${JSON.stringify(d.G)})`);
  check(d.valid && (d.valid === true || d.valid.ok === true || (Array.isArray(d.valid.errors) && !d.valid.errors.length)), `DXF passes SharedDxf.validate (${JSON.stringify(d.valid).slice(0, 120)})`);
  await p.evaluate(() => activateTab('tab-3d')); await p.waitForFunction(() => typeof D3 !== 'undefined' && D3.group && D3.group.children.length > 5, null, { timeout: 30000 });
  const td = await p.evaluate(() => { build3D(window.LAST_R); let ymax = -1e9, xmin = 1e9; D3.group.children.forEach(c => { if (c.isMesh && c.material && c.material.color && c.material.color.getHex() === 0xcfd8dc) { c.geometry.computeBoundingBox(); ymax = Math.max(ymax, c.geometry.boundingBox.max.y); xmin = Math.min(xmin, c.geometry.boundingBox.min.x); } });
    const g = S.geom, cx = window.LAST_R.geo.B / 2; return { ymax, top: +g.tf + +g.hstem + +g.hbw, xmin, xbw: window.LAST_R.geo.off.xBwBack - cx }; });
  check(Math.abs(td.ymax - td.top) < 1e-6 && Math.abs(td.xmin - td.xbw) < 1e-6, `3D: slab top at the top of the backwall (${td.ymax}), starting at the backwall's back face (${td.xmin.toFixed(4)})`);
  const rp = await p.evaluate(() => { activateTab('tab-struct'); const t = document.getElementById('tab-struct').innerText; activateTab('tab-loads'); const l = document.getElementById('tab-loads').innerText;
    return { sh: /Stem Shelf — Bearing/i.test(t), bw: /design section at the shelf elevation/i.test(t), lev: /positions and lever arms/i.test(l) }; });
  check(rp.sh && rp.bw && rp.lev, `worked steps shown: Tab 1 lever arms ${rp.lev}, Tab 5 backwall section ${rp.bw}, §5.8 shelf bearing ${rp.sh}`);
  const rr = await p.evaluate(async () => { abrShow(); await new Promise(r => setTimeout(r, 2500)); const t = document.body.textContent;
    return { lev: /Backwall offset e: positions and lever arms/.test(t), basis: /Backwall offset \(engineer request 2026-11-10\)/.test(t), brg: /Approach slab on the stem shelf/.test(t) }; });
  check(rr.lev && rr.basis && rr.brg, `Report: basis note ${rr.basis}, lever-arm table ${rr.lev}, shelf bearing worked ${rr.brg}`);
  await p.setViewportSize({ width: 390, height: 900 }); await p.waitForTimeout(500);
  const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(ov <= 0, `390 px: no horizontal scroll (${ov})`);
  check(!o.errs.length, `console errors: ${o.errs.length} ${o.errs.slice(0, 2).join(' | ')}`);
  await o.b.close(); }

console.log('5. ABSS (engineer report 2026-11-10): d_sh = 30 in > t = 15 in, e = 10 in — the slab t thick on the shelf, its top 15 in below the top of the backwall');
{ const o = await openPage(FB, { vw: 1400, vh: 1000 }), p = o.p; await p.waitForFunction(() => window.LAST_R, null, { timeout: 60000 });
  const run = su => p.evaluate(su => { const s0 = JSON.stringify(S); eval(su); recalcAll(); const R = window.LAST_R, P = R.ap, O = R.geo.off, ee = R.bwEE && R.bwEE.ee;
    const r = { RDC: P.RDC, qDC: P.qDC, qDW: P.qDW, wDC: P.wDC, zSh: O.zSh, zSlab: P.zSlab0 ?? P.zSlab, hC: O.hC, hSh: O.hSh, ee: ee ? { Mu: ee.Mu - (ee.apE.Wf || 0) * (ee.apE.zF || 0), Wa: ee.apE.Wa, zA: ee.apE.zA } : null, W: WARNINGS.map(w => w.level + '|' + w.msg),   // ABFL: the slab's own height and M_u without the fill term (the fill: section 6)
      sec: (() => { const B = abdwBuild(R); const sh = B.S.find(x => x.id === 'sec'); return B.D.E.slice(sh.i0, sh.iC).filter(e => e.t === 'PL' && /APPROACH-SLAB/.test(e.l)).map(e => e.pts.map(q => q[1])); })() };
    const st = JSON.parse(s0); Object.keys(S).forEach(k => delete S[k]); Object.assign(S, st); recalcAll(); return r; }, su);
  const base = 'S.apSlab.on = true; S.apSlab.t = 1.25; S.geom.bwOff = 10; S.geom.shD = 30;';
  const a = await run(base);
  // hand check: w_DC = 0.150(1.25) = 0.1875 ksf; q_DC = 0.1875(16)/2 = 1.500 kip/ft; h_sh = 5 − 30/12 = 2.50 ft; z_sh = 3 + 14 + 2.5 = 19.50 ft;
  // z_slab = 19.50 + 1.25/2 = 20.125 ft; h_c = d_sh = 2.50 ft (backwall design height)
  check(near(a.wDC, 0.1875) && near(a.qDC, 1.5) && near(a.hSh, 2.5) && near(a.zSh, 19.5) && near(a.zSlab, 20.125) && near(a.hC, 2.5),
    `slab weight from t: w_DC ${a.wDC}, q_DC ${a.qDC}; shelf h_sh ${a.hSh}, z_sh ${a.zSh}; EQ slab height z = z_sh + t/2 = ${a.zSlab}; backwall h_c = d_sh ${a.hC}`);
  const ys = a.sec.flat(), yT = Math.max(...ys), yB = Math.min(...ys);   // sheet units (in): the slab outline on sheet 1
  check(near(yT - yB, 15, 1e-6), `sheet 1: the slab drawn t = 15 in thick (${(yT - yB).toFixed(3)} in), not d_sh`);
  check(!a.W.some(w => /Stem shelf: the shelf depth d_sh = 30\.0 in exceeds/.test(w)), 'ABFL: d_sh > t raises no advisory warning (the fill over the slab is now loaded, section 6)');
  const e = await run(base + ' S.seismic.on = true; S.geom.HsupMode = "wall";');
  // Extreme Event I backwall: W_a = f_I k_h (q_DC + q_DW) = 1.0(0.075)(1.500 + 0.240) = 0.1305 kip/ft at z_A = t/2 = 0.625 ft above the shelf
  // (was d_sh − t/2 = 1.875 ft): M_u 0.39344 -> 0.39344 − 0.1305(1.875 − 0.625) = 0.23032 kip-ft/ft
  check(e.ee && near(e.ee.Wa, 0.1305) && near(e.ee.zA, 0.625) && near(e.ee.Mu, 0.39344 - 0.1305 * 1.25, 1e-4), `EE-I backwall: slab inertia ${e.ee && e.ee.Wa} kip/ft at t/2 = ${e.ee && e.ee.zA} ft, M_u ${e.ee && e.ee.Mu.toFixed(5)} (hand 0.23032)`);
  const u = await run('S.apSlab.on = true; S.apSlab.t = 1.25; S.geom.bwOff = 10; S.geom.shD = 12;');
  check(u.W.some(w => /^warn\|Check input — Stem shelf: the shelf depth d_sh = 12\.0 in is less than .* 3\.0 in ABOVE/.test(w)) && !u.W.some(w => /^err\|.*Stem shelf: the shelf depth/.test(w)), 'd_sh < t: a check-input warning (not an input error), the slab top 3 in above the backwall');
  const q = await run('S.apSlab.on = true; S.apSlab.t = 1.25; S.geom.bwOff = 10; S.geom.shD = 0;');
  check(!q.W.some(w => /Stem shelf: the shelf depth/.test(w)), 'd_sh = 0 (= t): no step warning');
  check(!o.errs.length, `console errors: ${o.errs.length}`);
  await o.b.close(); }

console.log('6. ABFL (engineer decision 2026-11-10, "use fill"): d_sh = 30 in > t = 15 in, e = 10 in — the step d_sh − t over the slab loaded as fill (EV)');
{ const o = await openPage(FB, { vw: 1400, vh: 1000 }), p = o.p; await p.waitForFunction(() => window.LAST_R, null, { timeout: 60000 });
  const run = su => p.evaluate(su => { const s0 = JSON.stringify(S); eval(su); recalcAll(); const R = window.LAST_R, P = R.ap, ee = R.bwEE && R.bwEE.ee;
    const r = { hF: P.hF, gs: P.gs, wEV: P.wEV, REV: P.REV, qEV: P.qEV, zF: P.zF, Wi: P.Wi, zSlab: P.zSlab, APev: R.groups.APev ? { V: R.groups.APev.V, Mv: R.groups.APev.Mv, cls: R.groups.APev.cls } : null, x: P.x,
      VuS: R.apStemSh && R.apStemSh.VuS, sMu: R.apDes && R.apDes.Mu, sVu: R.apDes && R.apDes.Vu, sMs: R.apDes && R.apDes.Ms, Map: R.stemDem.Map, Mecc: R.stemDem.MeccPerFt, stMu: R.stemDem.Mu, gEVe: R.stemDem.gEVe,
      Pc: R.checks.shearFric && R.checks.shearFric.Pc, apI: R.seis && R.seis.apI, ee: ee ? { Mu: ee.Mu, Vu: ee.Vu, Wf: ee.apE.Wf, zF: ee.apE.zF } : null,
      W: WARNINGS.map(w => w.level + '|' + w.msg) };
    let html = ''; try { html = document.body.innerHTML; } catch (e) {} r.noDW = !/put its weight in the slab|include it in the (slab )?wearing surface/.test(html);
    const st = JSON.parse(s0); Object.keys(S).forEach(k => delete S[k]); Object.assign(S, st); recalcAll(); return r; }, su);
  const base = 'S.apSlab.on = true; S.apSlab.t = 1.25; S.geom.bwOff = 10; S.geom.shD = 30;';
  const a = await run(base);
  // hand check (default project: γ_s = 0.120 kcf, W = L_ab = 44 ft, L = 16 ft, θ = 0, t_sb = 4.5 ft, γ_EV = 1.35 / 1.00, γ_DC = 1.25 / 0.90):
  // h_F = 30/12 − 1.25 = 1.25 ft; w_EV = 0.120(1.25) = 0.150 ksf; R_EV = 0.150(44)(16)/2 = 52.80 kip; q_EV = 0.150(16)/2 = 1.200 kip/ft
  check(near(a.hF, 1.25) && near(a.gs, 0.12) && near(a.wEV, 0.15) && near(a.REV, 52.8) && near(a.qEV, 1.2), `fill: h_F ${a.hF}, γ_s ${a.gs}, w_EV ${a.wEV} ksf, R_EV ${a.REV} kip, q_EV ${a.qEV} kip/ft (hand 1.25, 0.120, 0.150, 52.80, 1.200)`);
  check(a.APev && a.APev.cls === 'EV' && near(a.APev.V, 52.8) && near(a.APev.Mv, 52.8 * a.x), `load group APev: EV, V = ${a.APev && a.APev.V} kip at x_ap = ${a.x.toFixed(4)} ft`);
  // stem shelf bearing: V_u,slab = 13.356 (main) + 1.35(1.200) = 14.976 kip/ft
  check(near(a.VuS, 13.35602 + 1.62, 1e-5), `stem shelf V_u,slab ${a.VuS.toFixed(4)} (hand 13.356 + 1.35·1.200 = 14.976)`);
  // slab design: M_EV = 0.150(16)²/8 = 4.800; M_u 48.313 + 1.35(4.8) = 54.793; V_u 13.356 + 1.35(1.2) = 14.976; M_s 29.459 + 4.8 = 34.259
  check(near(a.sMu, 48.31329 + 6.48, 1e-5) && near(a.sVu, 13.35602 + 1.62, 1e-5) && near(a.sMs, 29.45903 + 4.8, 1e-5), `slab design M_u ${a.sMu.toFixed(3)} (54.793), V_u ${a.sVu.toFixed(3)} (14.976), M_s ${a.sMs.toFixed(3)} (34.259)`);
  // stem: x_sc − x_ap = −4.5/2 + 10/24 = −1.8333 ft; γ_EV = 1.00 governs (relieves the back face): M_ap −180.29 + 1.00(52.8)(−1.8333) = −277.09;
  // M_ecc 11.0727 − 96.8/44 = 8.8727; stem M_u 83.962 − 2.200 = 81.762 kip-ft/ft
  check(a.gEVe === 1 && near(a.Map, -180.29 - 96.8, 1e-5) && near(a.Mecc, 11.07272 - 2.2, 1e-5) && near(a.stMu, 83.96208 - 2.2, 1e-5), `stem: γ_EV ${a.gEVe}, M_ap ${a.Map.toFixed(3)} (−277.09), M_ecc ${a.Mecc.toFixed(4)} (8.8727), M_u ${a.stMu.toFixed(3)} (81.762)`);
  check(near(a.Pc, 21.58057 + 1.2, 1e-5), `shear friction P_c ${a.Pc.toFixed(4)} (21.5806 + 1.00·52.8/44 = 22.7806)`);
  check(!a.W.some(w => /Stem shelf: the shelf depth d_sh = 30/.test(w)) && a.noDW, 'no advisory warning; no note tells the user to add the fill to DW');
  const e = await run(base + ' S.seismic.on = true; S.geom.HsupMode = "wall";');
  // EE-I: W_ap = 66.0 + 10.56 + 52.8 = 129.36 kip at z = (76.56·20.125 + 52.8·21.375)/129.36 = 20.635 ft; k_hW_ap = 0.075(129.36) = 9.702 kip
  // backwall: W_F = 1.0(0.075)(1.200) = 0.090 kip/ft at min(2.5, 1.25 + 1.25/2) = 1.875 ft: M_u 0.23032 + 0.16875 = 0.39907, V_u 0.28790 + 0.090 = 0.37790
  check(near(e.Wi, 129.36) && near(e.zSlab, (76.56 * 20.125 + 52.8 * 21.375) / 129.36, 1e-6) && near(e.apI, 9.702), `EE-I slab + fill mass W_ap ${e.Wi} kip at z ${e.zSlab.toFixed(4)} (20.6352), k_hW_ap ${e.apI.toFixed(3)} (9.702)`);
  check(e.ee && near(e.ee.Wf, 0.09) && near(e.ee.zF, 1.875) && near(e.ee.Mu, 0.23032 + 0.16875, 1e-4) && near(e.ee.Vu, 0.28790 + 0.09, 1e-4), `EE-I backwall: W_F ${e.ee && e.ee.Wf} at ${e.ee && e.ee.zF} ft, M_u ${e.ee && e.ee.Mu.toFixed(5)} (hand 0.39907), V_u ${e.ee && e.ee.Vu.toFixed(5)} (0.37790)`);
  for (const [lbl, su] of [['d_sh = t', 'S.apSlab.on = true; S.apSlab.t = 1.25; S.geom.bwOff = 10; S.geom.shD = 15;'], ['d_sh blank', 'S.apSlab.on = true; S.apSlab.t = 1.25; S.geom.bwOff = 10; S.geom.shD = 0;'], ['d_sh < t', 'S.apSlab.on = true; S.apSlab.t = 1.25; S.geom.bwOff = 10; S.geom.shD = 12;']]) {
    const q = await run(su); check(q.REV === undefined && !q.APev && q.ee === null && q.gEVe === undefined, `${lbl}: no fill load (no R_EV, no APev group)`); }
  const rr = await p.evaluate(async base => { eval(base); recalcAll(); abrShow(); await new Promise(r => setTimeout(r, 2500)); const t = document.body.textContent;
    return { note: /loaded on the slab as vertical earth load EV/.test(t) && /R_EV = w_EV·W·L̄\/2 = 52\.80 kip/.test(t) && /see §1\.4a/.test(t), blk: /Fill on the slab \(stem shelf deeper than the slab/.test(t), dw: /include it in the slab wearing surface/.test(t) }; }, base);
  check(rr.note && rr.blk && !rr.dw, `Report: geometry note with the worked fill (R_EV = 52.80 kip, see §1.4a) ${rr.note}, §1.4a fill block ${rr.blk}, no DW advice ${!rr.dw}`);
  check(!o.errs.length, `console errors: ${o.errs.length}`);
  await o.b.close(); }

console.log(fails ? `\n${fails} FAILED` : '\nall ok');
process.exit(fails ? 1 : 0);
