#!/usr/bin/env node
// Abutment calculator (abutment_calculator.html): backwall offset e and the stem shelf (ABSH, engineer request 2026-11-10).
//   node tests/smoke/abutment-stem-shelf.mjs [--a <git ref, default origin/main>]
// 1. e = 0 (the default, and every saved project without geom.bwOff): LAST_R (JSON), the warnings and the Input ID identical to A over
//    10 projects (default, approach slab on the paving notch / on the deck end with skew, Extreme Event I, MassDOT seismic stop, pile footing,
//    equivalent dead load, semi-integral, integral, water + Coulomb); a saved project without the fields opens with the same results.
// 2. Hand check (the engineer's plan detail): 2'-0" backwall, e = 10 in, slab seat d_sh = 9 in below the top, approach slab t = 9 in,
//    t_st = t_sb = 5.5 ft, the rest the default project. Before (e = 0, paving notch) and after (e = 10 in) against values worked by hand.
// 3. Input errors: e + t_bw > t_st; e > 0 with no slab and no d_sh. Semi-integral / integral ignore e.
// 4. Drawings (DXF valid, the section has the shelf outline), 3D (the slab top at the top of the backwall), Report builds;
//    no console errors; no horizontal scroll at 390 px.
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
    const setup = e => { S.apSlab.on = true; S.apSlab.t = 0.75; S.geom.tbw = 2.0; S.geom.tst = 5.5; S.geom.tsb = 5.5; S.geom.bwOff = e; S.geom.shD = e > 0 ? 9 : 0; migrate(); recalcAll(); };
    const perm = l => window.LAST_R.permTables['Strength I'].find(x => x.lbl === l);
    const P1 = '0.90·DC + 0.65·DW + 1.00·EV + 1.50·EH + 1.75·(BR,LS), LL reaction off + 1.00·TU/CR/SH';
    const pick = () => { const R = window.LAST_R, G = R.groups, c = R.checks, q = perm(P1);
      return { geo: R.geo, ap: { x: R.ap.x, RDC: R.ap.RDC, WSh: R.ap.WSh, sup: R.ap.sup, eBw: R.ap.eBw }, parts: R.parts.map(x => ({ n: x.name, W: x.W, x: x.x })),
        DCsub: [G.DCsub.V, G.DCsub.Mv], APdc: [G.APdc.V, G.APdc.Mv], APdw: [G.APdw.V, G.APdw.Mv], DCsup: [G.DCsup.V, G.DCsup.Mv], DW: [G.DW.V, G.DW.Mv],
        stem: { Mu: R.stemDem.Mu, Mecc: R.stemDem.MeccPerFt, Pv: R.stemDem.Pv, Map: R.stemDem.Map, Mself: R.stemDem.MselfEccTot, gDC: R.stemDem.gDCe },
        P1: q ? { V: q.V, Mv: q.Mv, Mh: q.Mh, xbar: q.xbar, e: q.e } : null, ecc: c.ecc.dc, sliding: c.sliding.dc, bearing: c.bearing.dc, stemFlex: c.stemFlex.dcFlex,
        seat: c.seat.Nprov, bw: { hRet: R.bwDem.hbwRet, MuBW: R.bwDem.MuBW }, ss: R.apStemSh, shelf: !!R.apShelf, err: WARNINGS.filter(w => w.level === 'err').map(w => w.msg) }; };
    setup(0); const a = pick(); setup(10); const b = pick(); return { a, b };
  });
  const { a, b } = r, gc = 0.150, Lab = 44, e = 10 / 12;
  // geometry (ft from the toe): x_stem,back = L_toe + t_sb = 3.5 + 5.5 = 9.0
  check(near(a.geo.xBwFront, 7.0) && near(a.geo.xBrg, 5.75) && near(a.geo.seatW, 3.5) && near(a.geo.eBrg, 0.5), `before: x_bw,front = 9 − 2 = 7.000, x_brg = 7 − 1.25 = 5.750, seat 3.500, e_brg 0.500 (${a.geo.xBwFront}, ${a.geo.xBrg}, ${a.geo.seatW}, ${a.geo.eBrg})`);
  check(near(b.geo.xBwFront, 9 - e - 2) && near(b.geo.xBrg, 9 - e - 2 - 1.25) && near(b.geo.seatW, 5.5 - 2 - e) && near(b.geo.eBrg, e + 2 + 1.25 - 2.75), `after: x_bw,front = 9 − 0.8333 − 2 = 6.1667, x_brg = 4.9167, seat 5.5 − 2 − 0.8333 = 2.6667, e_brg = 1.3333 (${b.geo.xBwFront.toFixed(4)}, ${b.geo.xBrg.toFixed(4)}, ${b.geo.seatW.toFixed(4)}, ${b.geo.eBrg.toFixed(4)})`);
  // self-weight
  const bwA = a.parts.find(x => x.n === 'Backwall'), bwB = b.parts.find(x => x.n === 'Backwall'), sh = b.parts.find(x => /^Stem shelf/.test(x.n));
  check(near(bwA.W, 2 * 5 * gc * Lab) && near(bwA.x, 8.0) && near(bwB.W, 66) && near(bwB.x, 9 - e - 1), `backwall W = 2 × 5 × 0.150 × 44 = 66.00 kip at x̄ 8.000 → 7.1667 (${bwB.x.toFixed(4)})`);
  check(sh && near(sh.W, e * 4.25 * gc * Lab) && near(sh.x, 9 - e / 2) && !a.parts.some(x => /^Stem shelf/.test(x.n)), `stem shelf W = 0.8333 × (5 − 0.75) × 0.150 × 44 = 23.375 kip at x̄ = 9 − 0.4167 = 8.5833 (${sh && sh.W.toFixed(3)} at ${sh && sh.x.toFixed(4)})`);
  check(near(a.DCsub[0], 851.4) && near(b.DCsub[0], 874.775) && near(b.DCsub[1] - a.DCsub[1], -66 * e + 23.375 * (9 - e / 2)), `ΣDC_sub 851.40 → 874.775 kip; ΔM_v = −66(0.8333) + 23.375(8.5833) = +145.635 kip-ft (${(b.DCsub[1] - a.DCsub[1]).toFixed(3)})`);
  // approach slab: R_DC = 0.150 × 0.75 × 44 × 16/2 = 39.60 kip; before at x = 9 + 6/12 = 9.5 (+ notch 6.60 kip at 9.4583); after at 9 − e/2 = 8.5833, no notch
  check(a.ap.sup === 'shelf' && near(a.ap.x, 9.5) && near(a.ap.WSh, 6.6) && near(a.APdc[1], 39.6 * 9.5 + 6.6 * (9 + 5.5 / 12)), `before: slab R_DC 39.60 kip at 9.500 + notch 6.60 kip at 9.4583 → APdc M_v ${a.APdc[1].toFixed(3)} = 438.625`);
  check(b.ap.sup === 'stem' && near(b.ap.x, 9 - e / 2) && b.ap.WSh === 0 && b.ap.eBw === 0 && near(b.APdc[1], 39.6 * (9 - e / 2)), `after: R_DC 39.60 kip at x_ap = 9 − 0.4167 = 8.5833 (mid-bearing), no notch, e_bw = 0 → APdc M_v ${b.APdc[1].toFixed(3)} = 339.900`);
  check(near(b.DCsup[1], 510 * (9 - e - 3.25)) && near(a.DCsup[1], 510 * 5.75), `girder DC 510 kip: M_v 510 × 5.75 = 2932.5 → 510 × 4.9167 = 2507.5 (${b.DCsup[1].toFixed(2)})`);
  // stem base (Strength I governing, per ft): M_ecc = [P_v(x_sc − x_brg) + γ_DC ΣW(x_sc − x̄) + M_ap]/L_ab, x_sc = 6.25
  const meA = (1302 * 0.5 + 0.9 * (-115.5) + (0.9 * (39.6 * 6.25 + 6.6 * 6.25 - 438.625) + 1.5 * (10.56 * 6.25 - 100.32))) / 44;
  const meB = (1480.5 * (6.25 - (9 - e - 3.25)) + 1.25 * (66 * (6.25 - (9 - e - 1)) + 23.375 * (6.25 - (9 - e / 2))) + (1.25 * (39.6 * 6.25 - 339.9) + 1.5 * (10.56 * 6.25 - 90.64))) / 44;
  check(near(a.stem.Mecc, meA) && near(b.stem.Mecc, meB), `stem M_ecc = ${a.stem.Mecc.toFixed(4)} (hand ${meA.toFixed(4)}, γ_DC 0.90) → ${b.stem.Mecc.toFixed(4)} (hand ${meB.toFixed(4)}, γ_DC 1.25) kip-ft/ft`);
  check(near(b.stem.Mu - a.stem.Mu, meB - meA), `stem M_u ${a.stem.Mu.toFixed(3)} → ${b.stem.Mu.toFixed(3)} kip-ft/ft (Δ = ΔM_ecc = ${(meB - meA).toFixed(3)}; EH, LS, BR unchanged)`);
  // footing: the same Strength I permutation (0.90 DC, 0.65 DW, LL off): ΔV = 0.9(23.375 − 6.6), ΔM_v = 0.9(145.635 − 98.725 − 425) + 0.65(−60 − 9.68)
  const dV = 0.9 * (23.375 - 6.6), dMv = 0.9 * ((-66 * e + 23.375 * (9 - e / 2)) + (339.9 - 438.625) + (-510 * e)) + 0.65 * (-72 * e + (90.64 - 100.32));
  check(a.P1 && b.P1 && near(b.P1.V - a.P1.V, dV) && near(b.P1.Mv - a.P1.Mv, dMv) && near(b.P1.Mh, a.P1.Mh), `footing, Strength I (0.90·DC, LL off): ΔV = ${dV.toFixed(4)} kip, ΔM_v = ${dMv.toFixed(3)} kip-ft (tool ${(b.P1.V - a.P1.V).toFixed(4)}, ${(b.P1.Mv - a.P1.Mv).toFixed(3)}); M_h unchanged`);
  check(near(a.P1.e, 7 - (a.P1.Mv - a.P1.Mh) / a.P1.V) && near(b.P1.e, 7 - (b.P1.Mv - b.P1.Mh) / b.P1.V), `e = B/2 − (M_v − M_h)/V: ${a.P1.e.toFixed(4)} → ${b.P1.e.toFixed(4)} ft (e_lim = 14/3 = 4.667)`);
  check(near(a.ecc, 0.34564, 1e-4) && near(b.ecc, 0.40999, 1e-4) && near(a.sliding, 1.00414, 1e-4) && near(b.sliding, 0.98842, 1e-4) && near(a.bearing, 0.77651, 1e-4) && near(b.bearing, 0.83657, 1e-4),
    `dashboard: eccentricity ${a.ecc.toFixed(4)} → ${b.ecc.toFixed(4)}, sliding ${a.sliding.toFixed(4)} → ${b.sliding.toFixed(4)}, bearing ${a.bearing.toFixed(4)} → ${b.bearing.toFixed(4)}`);
  check(near(b.seat, (5.5 - 2 - e) * 12 - 4) && near(a.seat, 38), `support length N provided = seat × 12 − 4 = 38 → ${b.seat.toFixed(2)} in`);
  check(near(b.bw.hRet, 0.75) && a.bw.hRet === 5, `backwall retained height above its design section: 5.00 → min(d_sh, 19 − 14 − 4.25) = 0.75 ft`);
  const VuS = 1.25 * 0.9 + 1.5 * 0.24 + 1.75 * 6.354871;   // γ_DC q_DC + γ_DW q_DW + γ_LL q_LL (q of §1.4a: 0.900, 0.240, 6.3549 kip/ft)
  check(b.ss && near(b.ss.qb, b.ss.VuS / 120) && near(b.ss.qR, 0.7 * 0.85 * 4) && !b.shelf && near(VuS, b.ss.VuS), `stem-shelf bearing q_b = V_u,slab/(12e) = ${b.ss.VuS.toFixed(3)}/120 = ${b.ss.qb.toFixed(4)} ksi ≤ 2.38 ksi (D/C ${b.ss.dcB.toFixed(4)}); no bracket checks`);
  check(!a.err.length && !b.err.length, `no input errors (${[...a.err, ...b.err].join(' | ')})`);
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
  check(d.n === 3 && Math.abs(d.G.xb - d.G.xbwB - 10) < 1e-9 && Math.abs(d.G.xbwB - d.G.xbwF - 24) < 1e-9 && Math.abs(d.G.yTop - d.G.ySh - 9) < 1e-9 && d.G.xs === d.G.xbwB, `DXF geometry (in): back face of the backwall 10 in in front of the stem, 24 in thick, shelf 9 in below the top, slab from the backwall (${JSON.stringify(d.G)})`);
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

console.log(fails ? `\n${fails} FAILED` : '\nall ok');
process.exit(fails ? 1 : 0);
