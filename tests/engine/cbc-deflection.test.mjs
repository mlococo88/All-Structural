// "Concrete Beam Capacity.html", Beam Capacity tab (CBDF, 2026-11-18, engineer decision): ACI 318-19 24.2 deflection from the line loads.
// The tool's functions (cbcDeflNorm, cbcDeflCalc, cbcDeflSec and the section functions it uses: layerGeom, concreteE, servicecalc,
// serviceSteelStress) are taken from the text of the Beam Capacity frame (its srcdoc, decoded) and run in a Node vm. Every expected value
// is worked independently below (closed-form quadratic for kd, the ACI 318-19 expressions written out again), not read from the tool.
//   Table 24.2.3.5(b): I_e = I_cr / [1 − ((2/3)M_cr/M_a)²(1 − I_cr/I_g)] where M_a > (2/3)M_cr, else I_g (a);  M_cr = f_r I_g / y_t (Eq. 24.2.3.5);
//   f_r = 7.5λ√f'c (19.2.3.1); E_c = 57,000√f'c (19.2.2.1(b)); Δ = 5wℓ⁴/(384 E_c I_e) (simple) or wℓ⁴/(8 E_c I_e) (cantilever);
//   λ_Δ = ξ/(1 + 50ρ') (Eq. 24.2.4.1.1), ξ from Table 24.2.4.1.3; limits Table 24.2.2.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test, ROOT } from './harness.mjs';

function load(S) {
  const html = fs.readFileSync(path.join(ROOT, 'Concrete Beam Capacity.html'), 'utf8');
  const a = html.indexOf('id="suite-frame-capacity" srcdoc="'), b = html.indexOf('"></iframe>', a);
  const src = html.slice(a, b).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
  const grab = re => { const m = re.exec(src); assert.ok(m, 'declaration not found: ' + re); const lines = src.slice(m.index + 1).split('\n'), out = [lines[0]];
    for (let i = 1; i < lines.length; i++) { const L = lines[i]; if (/^[\s})\]]/.test(L) || L === '' || L === '\r') out.push(L); else break; } return out.join('\n'); };
  const ctx = { S }; vm.createContext(ctx);
  const v = re => grab(re).replace(/^const /, 'var ').replace(/^let /, 'var ');
  vm.runInContext([v(/\nconst ES=/), v(/\nconst REBAR=/), grab(/\nfunction fmt\(/), grab(/\nfunction sqrtfc_psi\(/), grab(/\nfunction stirDia\(/), grab(/\nfunction layerGeom\(/),
    grab(/\nfunction concreteE\(/), grab(/\nfunction serviceSteelStress\(/), grab(/\nfunction servicecalc\(/),
    v(/\nconst CBDF_MEM=/), v(/\nconst CBDF_MEMK=/), v(/\nconst CBDF_XI=/), grab(/\nfunction cbcDeflNorm\(/), grab(/\nfunction cbcDeflCalc\(/),
    grab(/\nfunction cbcDeflE\(/), grab(/\nfunction cbcDeflSec\(/)].join('\n'), ctx);
  return ctx;
}
const near = (a, b, what, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`);
const state = o => Object.assign({ code: 'ACI', memberType: 'beam', mat: { fc: 4, fy: 60, fyt: 60, lambda: 1, wc: 0 }, cover: { cc: 1.5 }, layerClear: 1.0,
  stir: { present: true, size: '4', legs: 2, s: 10 }, minh: { span: 0, sup: 'simple', wc: 0 } }, o);
// the tool's whole path: section of the deflection check (cbcDeflSec) -> cbcDeflCalc
const run = (S, ll, defl) => { const C = load(S), sec = C.cbcDeflSec(!!ll.cant);
  return { C, sec, R: C.cbcDeflCalc(Object.assign({ cant: !!ll.cant, L: ll.L, w: ll.w, Ec: sec.E.Ec, Ig: sec.sv.Ig, yt: sec.sv.yt, fr: sec.sv.fr, Icr: sec.SS.Icr, Asp: sec.Asp, b: sec.b, d: sec.d }, defl)) }; };
// independent hand values
const Ec = 57000 * Math.sqrt(4000) / 1000, n = 29000 / Ec, fr = 7.5 * Math.sqrt(4000) / 1000;          // 3605.0 ksi, 8.044, 0.47434 ksi
const quad = (A, B, Cc) => (-B + Math.sqrt(B * B - 4 * A * Cc)) / (2 * A);
const level = (w, L, cant, Ig, Icr, Mcr) => { const Ma = Math.abs(w) * L * L * (cant ? 0.5 : 0.125), m = 2 / 3 * Mcr, Ie = Ma > m ? Icr / (1 - (m / Ma) ** 2 * (1 - Icr / Ig)) : Ig;
  return { Ma, Ie, D: (cant ? 1 / 8 : 5 / 384) * (w / 12) * (12 * L) ** 4 / (Ec * Ie) }; };

// Hand check 1 (engineer's case): 20 ft simple span, 12 × 24 in, f'c 4 ksi, 3 #8 bottom (c_c 1.5 in, #4 stirrups: d = 24 − 1.5 − 0.5 − 0.5 = 21.5 in),
// w_D 1.2 klf, w_L 0.5 klf, floor attached to elements not likely to be damaged (ℓ/360, ℓ/240), 0 % sustained live, 5 years (ξ = 2.0).
//   E_c = 57,000√4000 = 3,605 ksi; n = 29,000/3,605 = 8.044; f_r = 7.5√4000 = 474.3 psi
//   I_g = 12(24)³/12 = 13,824 in⁴; y_t = 12 in; M_cr = 0.4743(13,824)/12/12 = 45.54 k-ft; (2/3)M_cr = 30.36 k-ft
//   kd: 6 kd² + nA_s kd − nA_s d = 0, nA_s = 8.044(2.37) = 19.065 -> kd = 6.828 in; I_cr = 12(6.828)³/3 + 19.065(21.5 − 6.828)² = 5,377 in⁴
//   D:   M_a = 1.2(20)²/8 = 60.00 k-ft; I_e = 5,377/[1 − (30.36/60)²(1 − 5,377/13,824)] = 6,375 in⁴; Δ_D = 5(1.2/12)(240)⁴/(384·3,605·6,375) = 0.188 in
//   D+L: M_a = 1.7(20)²/8 = 85.00 k-ft; I_e = 5,377/[1 − (30.36/85)²(0.6110)] = 5,832 in⁴; Δ_D+L = 5(1.7/12)(240)⁴/(384·3,605·5,832) = 0.291 in
//   Δ_L = 0.291 − 0.188 = 0.103 in ≤ ℓ/360 = 240/360 = 0.667 in, ratio 0.155
//   λ_Δ = 2.0/(1 + 50·0) = 2.000; Δ_sus = Δ_D = 0.188; after attachment 2.000(0.188) + 0.103 = 0.479 in ≤ ℓ/240 = 1.000 in, ratio 0.479 (ℓ/480 = 0.500: 0.958)
const C1 = { sec: { type: 'rect', bw: 12, h: 24, bf: 36, hf: 6 }, layers: [{ n: 3, size: '8', face: 'tension', dMan: null }] };
test('hand check 1: 20 ft simple span 12 × 24, 3 #8, w_D 1.2, w_L 0.5 -> Δ_D 0.188, Δ_D+L 0.291, Δ_L 0.103 (ℓ/360: 0.155), after attachment 0.479 (ℓ/240)', () => {
  const { sec, R } = run(state(C1), { L: 20, w: { D: 1.2, L: 0.5 } }, { mem: 'floorNd', sus: 0, dur: 60 });
  const Ig = 13824, Mcr = fr * Ig / 12 / 12, kd = quad(6, n * 2.37, -n * 2.37 * 21.5), Icr = 12 * kd ** 3 / 3 + n * 2.37 * (21.5 - kd) ** 2;
  near(sec.E.Ec, Ec, 'E_c'); near(sec.d, 21.5, 'd'); near(sec.sv.Ig, Ig, 'I_g'); near(sec.sv.yt, 12, 'y_t'); near(R.Mcr, Mcr, 'M_cr'); near(Mcr, 45.5368, 'M_cr hand', 1e-5);
  near(sec.SS.kd, kd, 'kd', 1e-7); near(sec.SS.Icr, Icr, 'I_cr', 1e-7); near(Icr, 5377.45, 'I_cr hand', 1e-5);
  const D = level(1.2, 20, false, Ig, Icr, Mcr), DL = level(1.7, 20, false, Ig, Icr, Mcr);
  near(D.Ie, 6374.54, 'I_e,D hand', 1e-5); near(DL.Ie, 5831.98, 'I_e,D+L hand', 1e-5);
  near(R.D.Ma, 60, 'M_a,D'); near(R.DL.Ma, 85, 'M_a,D+L'); near(R.D.Ie, D.Ie, 'I_e,D', 1e-7); near(R.DL.Ie, DL.Ie, 'I_e,D+L', 1e-7);
  near(R.D.D, D.D, 'Δ_D', 1e-7); near(R.DL.D, DL.D, 'Δ_D+L', 1e-7); near(R.D.D, 0.18799, 'Δ_D hand', 1e-4); near(R.DL.D, 0.29109, 'Δ_D+L hand', 1e-4);
  near(R.dL, DL.D - D.D, 'Δ_L', 1e-7); near(R.dL, 0.10310, 'Δ_L hand', 1e-4);
  near(R.rhoP, 0, "ρ'"); near(R.lam, 2, 'λ_Δ'); near(R.SU.D, R.D.D, 'Δ_sus = Δ_D (0 %)');
  near(R.dA, 2 * D.D + (DL.D - D.D), 'Δ after attachment', 1e-7); near(R.dA, 0.47908, 'Δ after hand', 1e-4);
  assert.deepEqual([...R.chk].map(c => [c.id, c.div]), [['deflI', 360], ['deflA', 240]]);
  near(R.chk[0].lim, 240 / 360, 'ℓ/360'); near(R.chk[0].dcr, R.dL / (240 / 360), 'ratio ℓ/360'); near(R.chk[0].dcr, 0.15466, 'ratio ℓ/360 hand', 1e-4);
  near(R.chk[1].lim, 1, 'ℓ/240'); near(R.chk[1].dcr, 0.47908, 'ratio ℓ/240 hand', 1e-4); assert.ok(R.chk.every(c => c.ok));
  // the same section, floor supporting elements likely to be damaged: ℓ/480 = 0.500 in, ratio 0.958 (still PASS)
  const R2 = run(state(C1), { L: 20, w: { D: 1.2, L: 0.5 } }, { mem: 'floorDmg' }).R;
  assert.deepEqual([...R2.chk].map(c => c.div), [360, 480]); near(R2.chk[1].dcr, 0.47908 / 0.5, 'ratio ℓ/480', 1e-4); assert.ok(R2.chk[1].ok);
});

// Sustained live and duration on hand check 1: 50 % of L sustained, 12 months (ξ = 1.4).
//   w_sus = 1.2 + 0.5(0.5) = 1.45 klf; M_a = 1.45(400)/8 = 72.50 k-ft; I_e = 5,377/[1 − (30.36/72.5)²(0.6110)] = I_e,sus; Δ_sus = 5(1.45/12)(240)⁴/(384·3,605·I_e,sus)
//   after attachment = 1.4 Δ_sus + Δ_L
test('sustained 50 % of L, 12 months (ξ = 1.4): Δ_sus at its own I_e, Δ after attachment = 1.4Δ_sus + Δ_L', () => {
  const { R } = run(state(C1), { L: 20, w: { D: 1.2, L: 0.5 } }, { mem: 'floorDmg', sus: 50, dur: 12 });
  const Ig = 13824, Mcr = fr * Ig / 12 / 12, kd = quad(6, n * 2.37, -n * 2.37 * 21.5), Icr = 12 * kd ** 3 / 3 + n * 2.37 * (21.5 - kd) ** 2;
  const SU = level(1.45, 20, false, Ig, Icr, Mcr), D = level(1.2, 20, false, Ig, Icr, Mcr), DL = level(1.7, 20, false, Ig, Icr, Mcr);
  near(R.SU.w, 1.45, 'w_sus'); near(R.SU.Ma, 72.5, 'M_a,sus'); near(R.SU.Ie, SU.Ie, 'I_e,sus', 1e-7); near(R.SU.D, SU.D, 'Δ_sus', 1e-7);
  near(R.xi, 1.4, 'ξ'); near(R.lam, 1.4, 'λ_Δ'); near(R.dA, 1.4 * SU.D + DL.D - D.D, 'Δ after attachment', 1e-7);
});

// Hand check 2: cantilever L = 8 ft, 12 × 20 in, top 3 #7 (tension at the support; d = 20 − 1.5 − 0.5 − 0.4375 = 17.5625 in), bottom 2 #5
// (compression; d' = 1.5 + 0.5 + 0.3125 = 2.3125 in), w_D 1.0 klf, w_L 0.6 klf, floor supporting elements likely to be damaged (ℓ/360, ℓ/480).
//   I_g = 12(20)³/12 = 8,000 in⁴; y_t = 10 in; M_cr = 0.4743(8,000)/10/12 = 31.62 k-ft; (2/3)M_cr = 21.08 k-ft
//   kd: 6kd² + [(n−1)A'_s + nA_s]kd − [(n−1)A'_s d' + nA_s d] = 0, (n−1)A'_s = 7.044(0.62) = 4.368, nA_s = 8.044(1.80) = 14.480 -> kd = 5.251 in (> d', A'_s in compression)
//   I_cr = 12(5.251)³/3 + 4.368(5.251 − 2.3125)² + 14.480(17.5625 − 5.251)² = 2,812 in⁴
//   D:   M_a = 1.0(8)²/2 = 32.00 k-ft; I_e = 3,913 in⁴; Δ_D = (1.0/12)(96)⁴/(8·3,605·3,913) = 0.0627 in
//   D+L: M_a = 1.6(64)/2 = 51.20 k-ft; I_e = 3,159 in⁴; Δ_D+L = (1.6/12)(96)⁴/(8·3,605·3,159) = 0.1243 in; Δ_L = 0.0616 in ≤ 96/360 = 0.267 in (0.231)
//   ρ' = 0.62/(12 × 17.5625) = 0.002942 (at the support); λ_Δ = 2.0/(1 + 0.1471) = 1.744; after attachment 1.744(0.0627) + 0.0616 = 0.1709 in ≤ 96/480 = 0.200 in (0.855)
test('hand check 2: 8 ft cantilever, top 3 #7 / bottom 2 #5 -> I_cr 2,812, Δ_L 0.0616 (ℓ/360), λ_Δ 1.744, after attachment 0.171 (ℓ/480)', () => {
  const S = state({ sec: { type: 'rect', bw: 12, h: 20, bf: 36, hf: 6 }, layers: [{ n: 3, size: '7', face: 'compression', dMan: null }, { n: 2, size: '5', face: 'tension', dMan: null }] });
  const { sec, R } = run(S, { cant: true, L: 8, w: { D: 1.0, L: 0.6 } }, { mem: 'floorDmg' });
  const b = 12, d = 17.5625, dp = 2.3125, As = 1.8, Asp = 0.62, Ig = 8000, Mcr = fr * Ig / 10 / 12;
  const kd = quad(b / 2, (n - 1) * Asp + n * As, -((n - 1) * Asp * dp + n * As * d)), Icr = b * kd ** 3 / 3 + (n - 1) * Asp * (kd - dp) ** 2 + n * As * (d - kd) ** 2;
  near(sec.d, d, 'd (top steel, −M)'); near(sec.Asp, Asp, "A'_s"); near(sec.b, 12, 'b'); near(sec.sv.yt, 10, 'y_t'); near(R.Mcr, Mcr, 'M_cr'); near(Mcr, 31.6228, 'M_cr hand', 1e-5);
  near(sec.SS.kd, kd, 'kd', 1e-7); near(kd, 5.25097, 'kd hand', 1e-5); near(sec.SS.Icr, Icr, 'I_cr', 1e-7); near(Icr, 2811.62, 'I_cr hand', 1e-5);
  const D = level(1.0, 8, true, Ig, Icr, Mcr), DL = level(1.6, 8, true, Ig, Icr, Mcr);
  near(R.D.Ma, 32, 'M_a,D'); near(R.DL.Ma, 51.2, 'M_a,D+L'); near(R.D.Ie, D.Ie, 'I_e,D', 1e-7); near(R.DL.Ie, DL.Ie, 'I_e,D+L', 1e-7);
  near(R.D.D, D.D, 'Δ_D', 1e-7); near(R.D.D, 0.062717, 'Δ_D hand', 1e-4); near(R.DL.D, 0.124304, 'Δ_D+L hand', 1e-4); near(R.dL, 0.061586, 'Δ_L hand', 1e-4);
  near(R.rhoP, Asp / (b * d), "ρ'"); near(R.lam, 2 / (1 + 50 * Asp / (b * d)), 'λ_Δ'); near(R.lam, 1.74354, 'λ_Δ hand', 1e-5);
  near(R.dA, R.lam * D.D + DL.D - D.D, 'Δ after', 1e-7); near(R.dA, 0.170936, 'Δ after hand', 1e-4);
  near(R.chk[0].lim, 96 / 360, 'ℓ/360 (ℓ = cantilever length)'); near(R.chk[1].lim, 96 / 480, 'ℓ/480'); near(R.chk[1].dcr, 0.170936 / 0.2, 'ratio ℓ/480', 1e-4);
  assert.ok(R.chk.every(c => c.ok));
});

// Hand check 3: T-beam, simple span 24 ft, b_f 48, h_f 4, b_w 12, h 24 in, 4 #9 bottom (d = 24 − 1.5 − 0.5 − 0.564 = 21.436 in), w_D 1.5, w_L 1.0 klf.
//   ȳ_b = [48(4)(22) + 12(20)(10)]/(192 + 240) = 15.333 in = y_t; I_g = 48(4)³/12 + 192(22 − 15.333)² + 12(20)³/12 + 240(10 − 15.333)² = 23,616 in⁴
//   M_cr = 0.4743(23,616)/15.333/12 = 60.88 k-ft; (2/3)M_cr = 40.59 k-ft
//   kd in the web: b_f h_f(kd − h_f/2) + b_w(kd − h_f)²/2 = nA_s(d − kd), nA_s = 8.044(4.00) = 32.18 -> kd = 4.774 in (> h_f = 4 in)
//   I_cr = 48(4.774)³/3 − 36(0.774)³/3 + 32.18(21.436 − 4.774)² = 10,669 in⁴
//   D: M_a = 1.5(24)²/8 = 108.0 k-ft, I_e = 11,564, Δ_D = 0.2686 in; D+L: M_a = 180.0, I_e = 10,974, Δ_D+L = 0.4717 in; Δ_L = 0.2031 in ≤ 288/360 = 0.800 (0.254)
//   ρ' = 0 -> λ_Δ = 2.0; after attachment 2(0.2686) + 0.2031 = 0.7403 in > 288/480 = 0.600 in: ratio 1.234, FAIL (floor, likely damaged)
test('hand check 3: T-beam, NA in the web -> I_cr 10,669, Δ_L 0.203 (ℓ/360 PASS), after attachment 0.740 > ℓ/480 = 0.600 (FAIL)', () => {
  const S = state({ sec: { type: 'tee', bw: 12, h: 24, bf: 48, hf: 4 }, layers: [{ n: 4, size: '9', face: 'tension', dMan: null }] });
  const { sec, R } = run(S, { L: 24, w: { D: 1.5, L: 1.0 } }, { mem: 'floorDmg' });
  const bf = 48, hf = 4, bw = 12, h = 24, d = 21.436, As = 4, A1 = bf * hf, A2 = bw * (h - hf), yb = (A1 * (h - hf / 2) + A2 * (h - hf) / 2) / (A1 + A2);
  const Ig = bf * hf ** 3 / 12 + A1 * (h - hf / 2 - yb) ** 2 + bw * (h - hf) ** 3 / 12 + A2 * ((h - hf) / 2 - yb) ** 2, Mcr = fr * Ig / yb / 12;
  const kd = quad(bw / 2, bf * hf - bw * hf + n * As, -bf * hf * hf / 2 + bw * hf * hf / 2 - n * As * d), Icr = bf * kd ** 3 / 3 - (bf - bw) * (kd - hf) ** 3 / 3 + n * As * (d - kd) ** 2;
  near(Ig, 23616, 'I_g hand'); near(sec.sv.Ig, Ig, 'I_g'); near(sec.sv.yt, yb, 'y_t'); near(sec.d, d, 'd', 1e-9); near(R.Mcr, Mcr, 'M_cr'); near(Mcr, 60.8807, 'M_cr hand', 1e-5);
  assert.ok(sec.SS.kd > hf && sec.SS.tee, 'neutral axis in the web'); near(sec.SS.kd, kd, 'kd', 1e-7); near(kd, 4.77374, 'kd hand', 1e-5);
  near(sec.SS.Icr, Icr, 'I_cr', 1e-7); near(Icr, 10668.5, 'I_cr hand', 1e-5); near(sec.b, 48, 'b for ρ′ = b_f (flange in compression)');
  const D = level(1.5, 24, false, Ig, Icr, Mcr), DL = level(2.5, 24, false, Ig, Icr, Mcr);
  near(R.D.Ie, D.Ie, 'I_e,D', 1e-7); near(R.DL.Ie, DL.Ie, 'I_e,D+L', 1e-7); near(R.D.D, 0.268602, 'Δ_D hand', 1e-4); near(R.DL.D, 0.471716, 'Δ_D+L hand', 1e-4);
  near(R.dL, 0.203114, 'Δ_L hand', 1e-4); near(R.dA, 0.740318, 'Δ after hand', 1e-4);
  assert.equal(R.chk[0].ok, true); near(R.chk[0].dcr, 0.203114 / 0.8, 'ratio ℓ/360', 1e-4);
  assert.equal(R.chk[1].ok, false); near(R.chk[1].dcr, 0.740318 / 0.6, 'ratio ℓ/480', 1e-4);
});

// I_e = I_g where M_a ≤ (2/3)M_cr (Table 24.2.3.5(a)): hand check 1 with w_D = 0.5 klf: M_a = 25.00 ≤ 30.36 k-ft -> I_e = 13,824, Δ_D = 5(0.5/12)(240)⁴/(384·3,605·13,824) = 0.0361 in
test('uncracked (M_a ≤ (2/3)M_cr): I_e = I_g', () => {
  const { R } = run(state(C1), { L: 20, w: { D: 0.5 } }, { mem: 'floor' });
  assert.equal(R.D.cr, false); near(R.D.Ie, 13824, 'I_e = I_g'); near(R.D.D, 5 * (0.5 / 12) * 240 ** 4 / (384 * Ec * 13824), 'Δ_D'); near(R.D.D, 0.036131, 'Δ_D hand', 1e-4);
  assert.deepEqual([...R.chk].map(c => c.id), ['deflI']);   // floor not supporting damageable elements: the immediate check only
});

// Roof: the live-type load is L + the largest of L_r, S, R (Table 24.2.2, flat roofs: the largest of L_r, S and R); ℓ/180
test('roof: w_live = w_L + max(w_Lr, w_S, w_R); flat roof limit ℓ/180; W and E are not used', () => {
  const C = load(state(C1)), base = { cant: false, L: 20, Ec, Ig: 13824, yt: 12, fr, Icr: 5377.45, Asp: 0, b: 12, d: 21.5 };
  const R = C.cbcDeflCalc(Object.assign({}, base, { w: { D: 1.2, Lr: 0.3, S: 0.45, R: 0.1, W: 9, E: 9 }, mem: 'roofFlat' }));
  assert.equal(R.r3.k, 'S'); near(R.wLv, 0.45, 'w_live = w_S'); near(R.DL.w, 1.65, 'w_D+live'); assert.deepEqual([...R.chk].map(c => c.div), [180]);
  const R2 = C.cbcDeflCalc(Object.assign({}, base, { w: { D: 1.2, L: 0.2, Lr: 0.3 }, mem: 'roofDmg' }));
  near(R2.wLv, 0.5, 'w_live = w_L + w_Lr'); assert.deepEqual([...R2.chk].map(c => c.div), [180, 480]);
});

// saved data: S.defl absent (every save before CBDF) or invalid -> the defaults; valid values kept
test('cbcDeflNorm: absent -> floorDmg, 0 %, 60 months; valid values kept; out of range clamped', () => {
  const C = load(state(C1));
  assert.deepEqual({ ...C.cbcDeflNorm(undefined) }, { mem: 'floorDmg', sus: 0, dur: 60 });
  assert.deepEqual({ ...C.cbcDeflNorm({ mem: 'roofNd', sus: 25, dur: 6 }) }, { mem: 'roofNd', sus: 25, dur: 6 });
  assert.deepEqual({ ...C.cbcDeflNorm({ mem: 'x', sus: 150, dur: 7 }) }, { mem: 'floorDmg', sus: 100, dur: 60 });
  assert.deepEqual(Object.keys(C.CBDF_XI).map(k => [+k, C.CBDF_XI[k]]), [[3, 1.0], [6, 1.2], [12, 1.4], [60, 2.0]]);   // Table 24.2.4.1.3
});

// lightweight concrete: E_c = w_c^1.5 · 33√f'c (19.2.2.1(a)), w_c entered (Minimum Thickness) or 90 pcf; crack control's concreteE is unchanged
test('lightweight: E_c = w_c^1.5·33√f′c (90 pcf when not entered); serviceSteelStress without E unchanged', () => {
  const S = state(Object.assign({}, C1, { mat: { fc: 4, fy: 60, fyt: 60, lambda: 0.75, wc: 0 } })), C = load(S);
  near(C.cbcDeflE().Ec, 90 ** 1.5 * 33 * Math.sqrt(4000) / 1000, 'E_c, 90 pcf');   // 1,782 ksi
  S.minh.wc = 110; near(C.cbcDeflE().Ec, 110 ** 1.5 * 33 * Math.sqrt(4000) / 1000, 'E_c, 110 pcf');
  near(C.serviceSteelStress(false, 10).Ec, Ec, 'crack control E_c (57,000√f′c, unchanged)');
});
