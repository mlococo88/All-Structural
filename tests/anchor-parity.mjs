#!/usr/bin/env node
// Anchor parity: the Light Pole and Sign Post tool's anchor engine (anchorBolts, run in Node from the page's own text,
// tests/engine/lp-source.mjs) against the Base Plate & Anchor Designer (headless Chromium) on the same pole anchor groups
// (BC-4, 2026-11-01; the engineer's condition for retiring the Light Pole anchor tab).
//   node tests/anchor-parity.mjs [--out <dir>]
// Cases: the comparison cases C1–C6 (scratchpad anchor comparison, 2026-11-01) and the matrix
// 4 / 6 / 8 / 12 bolts × round / square shaft × torsion 0 / 6 kip·ft × clear standoff 0 / 1.5 in (32 cases).
// Must agree (exit 1 otherwise):
//   - per-bolt tension T_max and the group tension ΣT: elastic bolt group, to 1e-9 relative;
//   - φN_sa, φN_pn, φV_sa per anchor: to 0.1 % (A_se: BP uses the AISC / ASME table value, LP the formula — 0.04 %);
//   - shear per bolt with torsion: BP's vector sum ≤ LP's sum of magnitudes, and equal to the vector sum computed here.
// Listed, with the known cause (not failures): concrete breakout (LP: inscribed circle for a square shaft, no
// §17.6.2.1.2, 24-form N_b only, per-anchor basis), shear breakout and side-face blowout (not computed by LP), pryout.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { openPage, HERE, REPO } from './lib.mjs';
import { lpEngine, lpDefaultInp } from './engine/lp-source.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) { if (!av[i].startsWith('--')) continue; const k = av[i].slice(2); args[k] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true; }
const OUT = args.out || path.join(os.tmpdir(), 'allstruct-tests', 'anchor-parity'); fs.mkdirSync(OUT, { recursive: true });
const BP = path.join(REPO, 'BasePlateAnchorDesigner.html');

/* kip, in; M and T in kip·ft; Mang = azimuth of the tension side (LP's convention), V toward the same azimuth; P + = compression */
const CASES = [
  { id: 'C1', n: 4, d: 1, gr: 55, BC: 12 * Math.SQRT2, th: 45, pier: 'square', b: 36, hef: 18, fc: 4, M: 40, Mang: 90, P: 5, V: 3, T: 0, z: 0 },
  { id: 'C2', n: 4, d: 1, gr: 55, BC: 12 * Math.SQRT2, th: 45, pier: 'round', b: 36, hef: 18, fc: 4, M: 40, Mang: 90, P: 5, V: 3, T: 0, z: 0 },
  { id: 'C3', n: 4, d: 1, gr: 55, BC: 12 * Math.SQRT2, th: 45, pier: 'square', b: 36, hef: 18, fc: 4, M: 40, Mang: 45, P: 5, V: 3, T: 0, z: 0 },
  { id: 'C4', n: 4, d: 1, gr: 55, BC: 12 * Math.SQRT2, th: 45, pier: 'square', b: 24, hef: 18, fc: 4, M: 30, Mang: 90, P: 2, V: 6, T: 0, z: 0 },
  { id: 'C5', n: 4, d: 1, gr: 36, BC: 12 * Math.SQRT2, th: 45, pier: 'square', b: 120, hef: 18, fc: 4, M: 60, Mang: 90, P: 0, V: 4, T: 0, z: 0 },
  { id: 'C6', n: 8, d: 1, gr: 55, BC: 20, th: 22.5, pier: 'round', b: 42, hef: 24, fc: 4, M: 80, Mang: 0, P: 3, V: 5, T: 6, z: 0 },
];
for (const n of [4, 6, 8, 12]) for (const pier of ['round', 'square']) for (const T of [0, 6]) for (const z of [0, 1.5]) {
  const big = n >= 8;
  CASES.push({ id: `n${n}-${pier}-T${T}-z${z}`, n, d: 1, gr: 55, BC: big ? 20 : 16, th: n === 4 ? 45 : 0, pier, b: big ? 42 : 36, hef: 18, fc: 4,
    M: big ? 80 : 40, Mang: 30, P: 4, V: 4, T, z });
}

/* ---------- Light Pole (Node) ---------- */
const LP = {};
for (const c of CASES) {
  const lp = lpEngine(); lp.set('anchRe', 'no');
  const inp = lpDefaultInp({ boltDia: c.d, boltGrade: c.gr, boltQty: c.n, boltBC: c.BC, boltTheta: c.th, boltHef: c.hef, fc: c.fc * 1000,
    shaftShape: c.pier, b: c.b / 12, poleDiaBase: 10, bpFy: 36, bpT: 1.5 });
  const r = lp.call('anchorBolts', inp, { Mang: c.Mang }, { Mu: c.M * 1000, Pu: c.P * 1000, Vu: c.V * 1000, Tu: c.T * 1000 });
  LP[c.id] = { Tmax: r.Tmax / 1000, Tsum: r.Tsum / 1000, phiNsa: r.phiNsa / 1000, phiNp: r.phiNp / 1000, phiVsa: r.phiVsa / 1000, Vb: r.Vb / 1000,
    phiNcbg: r.phiNcbg / 1000, phiVcp: r.phiVcp / 1000, tr: r.tr, inter: r.inter, nT: r.nT };
}

/* ---------- Base Plate (browser) ---------- */
const { b, p, errs } = await openPage(BP);
await p.waitForFunction(() => typeof S !== 'undefined' && typeof computeAll === 'function' && document.getElementById('tabBar') && document.getElementById('tabBar').children.length > 0, null, { timeout: 60000 });
const BPR = await p.evaluate(CASES => {
  const out = {};
  for (const c of CASES) {
    const s = defaultState();
    s.anchor.pattern = 'circle'; s.anchor.nCircle = c.n; s.anchor.BC = c.BC; s.anchor.theta0 = c.th; s.anchor.dia = c.d; s.anchor.grade = 'f1554_' + c.gr;
    s.anchor.hef = c.hef; s.anchor.head = 'hvyhexhead'; s.anchor.torqued = true;
    s.plate.shape = 'circle'; s.plate.D = c.BC + 6; s.plate.B = s.plate.D; s.plate.N = s.plate.D; s.plate.t = 1.5;
    s.col.custom = false; s.col.shapeType = 'HSS'; s.col.shape = 'HSS8.625 (round)';
    s.conc.shape = c.pier === 'round' ? 'circle' : 'rect'; s.conc.D = c.b; s.conc.Bx = c.b; s.conc.By = c.b; s.conc.H = 120; s.conc.fc = c.fc; s.conc.cracked = true;
    s.grout.present = false; s.forceModel.method = 'elastic'; s.shear.hiltiDist = true;   /* V/n per anchor: LP's steel-shear basis */
    s.standoff.type = 'clamp'; s.standoff.z = c.z;
    const M = c.M * 12, a = c.Mang * Math.PI / 180;
    const o = { name: c.id, P: -c.P, Vx: c.V * Math.cos(a), Vy: c.V * Math.sin(a), Mx: M * Math.sin(a), My: -M * Math.cos(a) };
    if (c.T) o.T = c.T * 12;
    s.combos = [o];
    S = mergeState(s); refreshAll(); CC = computeAll();
    const cb = CC.combos[0], cap = comboCapacities(CC, cb);
    /* the vector sum computed here, independently */
    const pts = anchorCoords(), J = pts.reduce((q, t) => q + t.x * t.x + t.y * t.y, 0);
    const vmax = Math.max(...pts.map(t => Math.hypot(o.Vx / c.n - (o.T || 0) * t.y / J, o.Vy / c.n + (o.T || 0) * t.x / J)));
    const tb = cap.tb, md = {}; cap.tensionModes.concat(cap.shearModes).forEach(m => { md[m.label] = { phi: m.phiN !== undefined ? m.phiN : m.phiV, dem: m.phiN !== undefined ? cap.tDemand(cb, m) : cap.vDemand(cb, m) }; });
    const gT = cap.govTfor(cb), gV = cap.govVfor(cb);
    out[c.id] = { Tmax: cb.Tmax_anchor, Tsum: cb.Tu_group, phiNsa: cap.st.phi * cap.st.Nsa1, phiNp: cap.po.phiNpn, phiVsa: cap.sv.phi * cap.sv.Vsa1 * cap.sv.groutFac,
      Vu: cb.Vu_per, vmaxHere: vmax, phiNcbg: tb.phiNcbg, hef: tb.hef, altPhi: tb.alt && tb.alt.phiNcbg, ANc: tb.ANc, sbk: cap.sbk.phiVcbg, sfb: cap.sfb.na ? null : cap.sfb.phiNsb,
      pry: cap.pry.phiVcpg, la: cap.la ? cap.la.phiVMs : null, it: interaction(cap.tDCR(cb, gT), 1, cap.vDCR(cb, gV), 1).dcr, govT: gT.label, govV: gV.label,
      errs: VALIDATION.errs.map(e => e.msg) };
  }
  return out;
}, CASES);
await b.close();

let fail = false;
const rel = (a, x) => Math.abs(a - x) / Math.max(1e-12, Math.abs(x));
const rows = [];
console.log('Case                      T_max LP/BP        ΣT LP/BP          φN_sa  φN_pn  φV_sa  V/bolt LP ≥ BP (vector)   φN_cbg LP | BP (h_ef)            BP only: φV_cbg  φN_sb  φV_cpg  stand-off φV^M_s  interaction LP | BP');
for (const c of CASES) {
  const L = LP[c.id], B = BPR[c.id];
  const okT = rel(B.Tmax, L.Tmax) < 1e-9 && rel(B.Tsum, L.Tsum) < 1e-9;
  const okS = rel(B.phiNsa, L.phiNsa) < 1e-3 && rel(B.phiNp, L.phiNp) < 1e-3 && rel(B.phiVsa, L.phiVsa) < 1e-3;
  const okV = B.Vu <= L.Vb + 1e-9 && rel(B.Vu, B.vmaxHere) < 1e-9;
  const okE = !B.errs.length;
  if (!(okT && okS && okV && okE)) fail = true;
  rows.push({ id: c.id, L, B, okT, okS, okV });
  console.log(`${c.id.padEnd(24)} ${L.Tmax.toFixed(3)}/${B.Tmax.toFixed(3)} ${okT ? 'ok' : 'XX'}   ${L.Tsum.toFixed(2)}/${B.Tsum.toFixed(2)}   ` +
    `${(rel(B.phiNsa, L.phiNsa) * 100).toFixed(3)}% ${(rel(B.phiNp, L.phiNp) * 100).toFixed(3)}% ${(rel(B.phiVsa, L.phiVsa) * 100).toFixed(3)}% ${okS ? 'ok' : 'XX'}   ` +
    `${L.Vb.toFixed(3)} ≥ ${B.Vu.toFixed(3)} ${okV ? 'ok' : 'XX'}   ${L.phiNcbg.toFixed(2)} | ${B.phiNcbg.toFixed(2)} (${B.hef.toFixed(2)}${B.altPhi ? '; without §17.6.2.1.2 ' + B.altPhi.toFixed(2) : ''})   ` +
    `${B.sbk.toFixed(2)}  ${B.sfb == null ? 'n/a' : B.sfb.toFixed(2)}  ${B.pry.toFixed(1)}  ${B.la == null ? '—' : B.la.toFixed(3)}   ${L.inter.toFixed(3)} | ${B.it.toFixed(3)}` + (okE ? '' : '   VALIDATION: ' + B.errs.join(' | ')));
}
fs.writeFileSync(path.join(OUT, 'parity.json'), JSON.stringify(rows, null, 1));
console.log(`\nKnown causes of the concrete differences (not failures): LP clips a square shaft by its inscribed circle, does not apply §17.6.2.1.2,
uses the 24-form N_b only and compares T_max with φN_cbg/n_T; LP does not compute shear breakout or side-face blowout, nor the rod
bending over a stand-off (BP's lever-arm column). BP's interaction is the worse of trilinear and parabolic.`);
const pe = errs.filter(e => !/Failed to load resource|ERR_FAILED|net::/.test(e));
console.log(`${CASES.length} cases; console errors ${pe.length}`); pe.slice(0, 5).forEach(e => console.log('  ' + e));
if (pe.length) fail = true;
console.log(fail ? '\nFAIL' : '\nPASS');
process.exit(fail ? 1 : 0);
