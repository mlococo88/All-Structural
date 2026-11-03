#!/usr/bin/env node
// Light Pole and Sign Post: shaft projection above grade p (LPPJ, added 2026-11-03). Headless Chromium, file://, offline.
// Checks, in both code modes:
//   1. cables: with p = 2 ft every cable value (components; reactions in every combination and azimuth) is identical to p = 0
//      (engineer's hard rule: nothing cable-related changes; cables are not raised by p);
//   2. p = 0 and a save without the field: the Anchorage hand-off payload is byte-identical (no new field, same inputsHash);
//   3. p = 2 ft: the grade actions recomputed here from the page's own pole-base actions and the inputs, by the engineer's
//      formulas (V_F = V + F_s, M_F = B·M + V·p + F_s·p/2, N_F = N + γ_D·W_c; the shaft wind by ASCE 7-22 §29.4 / LRFDLTS
//      Eq. 3.8.1-1 with the C_f / C_d rows chosen by the engineer), equal the page's values; the embedment / Broms L are solved here
//      again from those demands; the hand-off pier depth is the embedment + p;
//   4. sign: the post length is clr + s − p; p ≥ clearance and p < 0 are input errors;
//   5. drawings: the DXF of the p = 2 ft cases is valid, has no NaN and dimensions p; no console errors.
//   node tests/smoke/lightpole-projection.mjs
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

const LP = path.join(REPO, 'Light Pole and Sign Post.html');
let fails = 0; const check = (ok, m) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${m}`); if (!ok) fails++; };
const near = (a, b, t = 1e-9) => Math.abs(a - b) <= t * Math.max(1, Math.abs(a), Math.abs(b));

async function run(mut, p, fn) {
  const o = await openPage(LP, { vw: 1280, vh: 900 });
  try {
    await o.p.waitForFunction(() => typeof window.applyState === 'function', null, { timeout: 20000 });
    const r = await o.p.evaluate(([m, p, src]) => {
      const st = JSON.parse(JSON.stringify(DEFAULT_STATE)); Object.assign(st.inputs, m.inputs || {}); Object.assign(st, m.top || {}); if (m.cables) st.cables = m.cables;
      if (p === null) delete st.inputs.shaftProj; else st.inputs.shaftProj = String(p);
      applyState(st);
      // eslint-disable-next-line no-new-func
      return new Function('return (' + src + ')()')();
    }, [mut, p, fn.toString()]);
    r.errs = o.errs.slice();
    return r;
  } finally { await o.b.close(); }
}

// ---- in-page readers (run with new Function in the page) ----
const CABLES = () => {
  const L = LPP_LAST, inp = L.inp, pick = (o, ks) => { const r = {}; ks.forEach(k => { r[k] = o[k]; }); return r; };
  const comps = cablesEnabled ? cables.map(c => cableComponents(c, inp)) : [];
  return { n: comps.length, json: JSON.stringify({ components: comps.map(cp => pick(cp, ['wIce', 'KzC', 'qW', 'qWI', 'D_v', 'Di_v', 'W_h', 'Wi_h', 'A_cable'])),
    combos: Object.fromEntries(L.allCombos.map(r => [r.key, (r.dirs || [r]).map(d => ({ phi: d.phi, ...pick(d, ['cableRes', 'cableAng', 'hcEff', 'sV', 'cableWindH', 'cableWindM', 'M_cable']),
      per: (d.per || []).map(x => pick(x, ['wv', 'wh', 'Ht', 'Hpull', 'Vc', 'Hw', 'Hx', 'Hy', 'wRes'])) }))])) }) };
};
const PAYLOAD = () => { const r = lppAnchorPayload(); return { json: r.payload ? JSON.stringify(Object.assign({}, r.payload, { producedAt: 0 })) : r.error, err: document.getElementById('lppInErr').textContent }; };
const IBC = () => {
  const c = LPP_SUMCTX, s = c.stacks[0], f = s.found, inp = c.inp, a = s.asd, l = f.proj && f.proj.lrfd;
  const pl = lppAnchorPayload();
  return { inp: { V: inp.V, Vice: inp.Vice, Kzt: inp.Kzt, Kd: inp.Kd, G: inp.G, b: inp.b, expo: inp.expo, sq: inp.shaftShape === 'square', S1: inp.S1, iso: isoFac, con: constraint, c: inp.bromsC, phiR: inp.bromsPhiR, lam: inp.bromsOL, tIce: inp.tIce },
    sp: f.proj ? f.proj.sp : null, a: { P: a.P, M: a.M, h: a.h, N: a.axial, Vx: a.Vx, Vy: a.Vy, Mx: a.Mx, My: a.My, phi: a.phi, g: a.grade }, d: f.d,
    l: l ? { P: l.P, M: l.M, N: l.axial, Vx: l.Vx, Vy: l.Vy, Mx: l.Mx, My: l.My, phi: l.phi, g: l.grade } : null, Mu: f.Mu, Vu: f.Vu, Pu: f.Pu, br: s.broms ? s.broms.L : null,
    pier: pl.payload ? pl.payload.groups[0].pier.depth : null, err: document.getElementById('lppInErr').textContent };
};
const LTS = () => {
  const X = lppLtsLast, fd = X.fd, g = fd.gov, pl = lppAnchorPayload();
  return { V: X.L.V, Kd: LpLts.kd(X.g.shape), b: X.inp.b, sq: X.inp.shaftShape === 'square', c: X.inp.bromsC, phiR: X.inp.bromsPhiR, lam: X.inp.bromsOL, H: X.g.H, clr: X.inp.signClr, s: X.inp.signS,
    r: g.r, B: g.B, gl: g.gl || null, L: g.br.L, MF: g.br.MF, VF: g.br.VF, pier: pl.payload ? pl.payload.groups.map(x => x.pier.depth) : pl.error, err: document.getElementById('lppInErr').textContent };
};
const DXF = () => { const d = (appMode === 'sign') ? lpsvData() : LPP_SUMCTX; const B = lpdBuild(appMode === 'sign' ? d : null), t = B.D.toDXF({ ltscale: 1 }), v = SharedDxf.validate(t);
  switchTab('report'); const rp = (document.getElementById('page-report').textContent || ''); switchTab('drawings');
  return { ok: v.ok, nan: /NaN|undefined|Infinity/.test(t), p: B.D.E.some(e => e.t === 'DIM' && /^p = /.test(e.s)), H: (LPP_SUMCTX && LPP_SUMCTX.inp.H), rpt: /projection/i.test(rp) && /M_?F|groundline|at grade/.test(rp) }; };
const ERR = () => ({ err: document.getElementById('lppInErr').textContent, H: lppLastInp ? lppLastInp.H : null, clr: num('signClr'), s: num('signS') });

// ---- independent formulas (Node) ----
const Kz7 = (z, e) => { const P = { B: [7.0, 1200], C: [9.5, 900], D: [11.5, 700] }[e]; return 2.01 * Math.pow(Math.max(z, 15) / P[1], 2 / P[0]); };   // ASCE 7-22 Table 26.10-1
const kzL = z => 2.0 * Math.pow(Math.max(z, 16) / 900, 2 / 9.5);                                                                     // LRFDLTS Eq. 3.8.4-1
const cf2941 = (row, hD) => { const v = { rough: [0.7, 0.8, 0.9], square: [1.3, 1.4, 2.0] }[row], x = [1, 7, 25]; if (hD <= 1) return v[0]; if (hD >= 25) return v[2]; const i = hD < 7 ? 0 : 1; return v[i] + (v[i + 1] - v[i]) * (hD - x[i]) / (x[i + 1] - x[i]); };
const cdCyl = x => (x <= 39 ? 1.10 : x < 78 ? 129 / Math.pow(x, 1.3) : 0.45);
const bromsCoh = (MF, VF, D, c) => { const H = MF / VF, q = VF / (9 * c * D); return 1.5 * D + q * (1 + Math.sqrt(2 + (4 * H + 6 * D) / q)); };   // LRFDLTS Eq. C13.6.1.1-1, -3
const ibcEmbed = (P, h, S1c, b) => { let d = 6; for (let i = 0; i < 60; i++) { const S1 = S1c * Math.min(d / 3, 15), A = 2.34 * P / (S1 * b), dn = 0.5 * A * (1 + Math.sqrt(1 + 4.36 * h / A)); if (Math.abs(dn - d) < 0.004) return dn; d = 0.5 * d + 0.5 * dn; } return d; };   // IBC §1807.3.2.1

// ===== 1. cables identical, p = 0 vs 2 ft =====
console.log('1 · cable values, p = 0 vs p = 2 ft');
for (const [name, mut] of Object.entries({ default: {}, cable45: { cables: [{ hc: 32, th: 45, L: 80, s: 4, D: 0.75, g: 0.35 }] }, ice: { inputs: { tIce: '1.0', Vice: '60' } }, ltspole: { inputs: { bromsSoil: 'cohesive', bromsC: '1.0' }, top: { codeMode: 'lts' } } })) {
  const a = await run(mut, 0, CABLES), b = await run(mut, 2, CABLES);
  check(a.n > 0 && a.json === b.json, `${name}: ${a.n} cable(s), every cable value identical with p = 2 ft (${a.json.length} chars)`);
  check(!a.errs.length && !b.errs.length, `${name}: no console errors`);
}

// ===== 2. p = 0 and an old save without the field: the hand-off payload is byte-identical =====
console.log('2 · hand-off payload, old save (no field) vs p = 0');
for (const [name, mut] of Object.entries({ pole: {}, sign2: { inputs: { signB: '16', signS: '5' }, top: { appMode: 'sign', signPosts: 2 } },
  ltssign2: { inputs: { signB: '16', signS: '5', bromsSoil: 'cohesive', bromsC: '1.0' }, top: { codeMode: 'lts', appMode: 'sign', signPosts: 2 } } })) {
  const a = await run(mut, null, PAYLOAD), b = await run(mut, 0, PAYLOAD), c = await run(mut, 2, PAYLOAD);
  check(a.json === b.json && /"inputsHash"/.test(a.json), `${name}: payload byte-identical (${a.json.length} chars)`);
  check(c.json !== a.json, `${name}: p = 2 ft changes the payload (pier depth)`);
}

// ===== 3a. IBC pole, p = 2 ft: the grade actions by hand =====
console.log('3 · grade actions recomputed from the base actions, p = 2 ft');
{ const mut = { inputs: { bromsSoil: 'cohesive', bromsC: '1.0' }, top: { cablesEnabled: false } };
  const r = await run(mut, 2, IBC), i = r.inp, sp = r.sp, p = 2;
  const qz = 0.00256 * Kz7(p / 2, i.expo) * i.Kzt * i.Kd * i.V * i.V, cf = cf2941(i.sq ? 'square' : 'rough', p / i.b), F = qz * i.G * cf * i.b * p;
  const Wc = 150 * (i.sq ? i.b * i.b : Math.PI / 4 * i.b * i.b) * p;
  check(near(sp.qz, qz) && near(sp.cf, cf) && near(sp.F, F) && near(sp.Wc, Wc), `IBC pole: q_z(1 ft) ${qz.toFixed(3)} psf, C_f ${cf} (rough), F_s ${F.toFixed(2)} lb, W_c ${Wc.toFixed(1)} lb`);
  const g = r.a.g, c = Math.cos(r.a.phi * Math.PI / 180), s = Math.sin(r.a.phi * Math.PI / 180), Fs = g.fW * F + g.fWi * sp.FI;
  const Vx = g.V0x + Fs * c, Vy = g.V0y + Fs * s, Mx = g.B * g.M0x + g.V0x * p + Fs * c * p / 2, My = g.B * g.M0y + g.V0y * p + Fs * s * p / 2;
  check(g.B === 1 && near(r.a.P, Math.hypot(Vx, Vy)) && near(r.a.M, Math.hypot(Mx, My)) && near(r.a.N, g.N0 + g.fD * Wc + g.fDi * sp.Wice),
    `IBC pole ASD: V_F ${r.a.P.toFixed(1)} lb, M_F = M + V·p + F_s·p/2 = ${r.a.M.toFixed(1)} lb·ft, N_F ${r.a.N.toFixed(1)} lb`);
  const d = ibcEmbed(r.a.P, r.a.M / r.a.P, i.S1 * i.iso, i.b);
  check(i.con === 'non' && Math.abs(d - r.d) < 1e-9, `IBC pole: embedment from the grade demand ${d.toFixed(4)} ft = tool ${r.d.toFixed(4)} ft`);
  const q = r.l.g, Fl = q.fW * F + q.fWi * sp.FI, cl = Math.cos(r.l.phi * Math.PI / 180), sl = Math.sin(r.l.phi * Math.PI / 180);
  const MF = Math.hypot(q.B * q.M0x + q.V0x * p + Fl * cl * p / 2, q.B * q.M0y + q.V0y * p + Fl * sl * p / 2);
  check(q.B > 1 && near(r.l.M, MF) && near(r.Mu, MF) && near(r.Vu, Math.hypot(q.V0x + Fl * cl, q.V0y + Fl * sl)) && near(r.Pu, q.N0 + q.fD * Wc),
    `IBC pole LRFD shaft: M_u = B·M + V·p + F_s·p/2 = ${q.B.toFixed(4)}·${q.M0.toFixed(1)} + ${q.P0.toFixed(1)}·2 + ${Fl.toFixed(2)}·1 = ${MF.toFixed(1)} lb·ft, P_u ${r.Pu.toFixed(0)} lb`);
  const L = bromsCoh(i.lam * r.Mu / 1000, i.lam * r.Vu / 1000, i.b, i.c * i.phiR);
  check(Math.abs(L - r.br) < 1e-9, `IBC pole: Broms L from M_u, V_u at grade ${L.toFixed(4)} ft = tool ${r.br.toFixed(4)} ft`);
  check(near(r.pier, (r.d + p) * 12), `IBC pole: hand-off pier depth (d + p)·12 = ${r.pier.toFixed(2)} in`);
  check(!r.errs.length, 'IBC pole: no console errors');
}
// ===== 3b. LRFDLTS two-post sign, p = 2 ft =====
{ const mut = { inputs: { signB: '16', signS: '5', bromsSoil: 'cohesive', bromsC: '1.0' }, top: { codeMode: 'lts', appMode: 'sign', signPosts: 2 } };
  const r = await run(mut, 2, LTS), p = 2, x = r.gl, rr = r.r;
  check(near(r.H, r.clr + r.s - p), `LTS two-post: post length clr + s − p = ${r.H.toFixed(2)} ft`);
  const xv = 0.8 * r.V * r.b, Cd = r.sq ? 2.0 : cdCyl(xv), Pz = 0.00256 * kzL(p / 2) * r.Kd * 1.14 * r.V * r.V * Cd, Ws = Pz * r.b * p;
  check(near(x.sw.F, Ws) && near(x.sw.Cd, Cd), `LTS: C_d ${Cd} (C_v·V·b = ${xv}), P_z(16 ft) ${Pz.toFixed(3)} psf, W_s = ${Ws.toFixed(2)} lb`);
  const Fx = rr.lc === 'n0' ? Ws : NaN, MF = r.B * rr.Mx + rr.Vx * p + Fx * p / 2;
  check(rr.lc === 'n0' && near(x.MF, MF) && near(x.VF, rr.Vx + Fx) && near(x.PF, rr.P + 1.1 * 150 * Math.PI / 4 * r.b * r.b * p),
    `LTS ${rr.name}, ${rr.lcName}: M_F = ${r.B.toFixed(4)}·${rr.Mx.toFixed(1)} + ${rr.Vx.toFixed(1)}·2 + ${Ws.toFixed(2)}·1 = ${MF.toFixed(1)} lb·ft, V_F ${x.VF.toFixed(1)} lb, P_F ${x.PF.toFixed(1)} lb`);
  const L = bromsCoh(r.lam * x.MF / 1000, r.lam * x.VF / 1000, r.b, r.c * r.phiR);
  check(Math.abs(L - r.L) < 1e-9 && near(r.MF, x.MF / 1000), `LTS: Broms L from M_F, V_F ${L.toFixed(4)} ft = tool ${r.L.toFixed(4)} ft`);
  check(r.pier.every(v => near(v, (r.L + p) * 12)), `LTS: hand-off pier depth (L + p)·12 = ${r.pier[0].toFixed(2)} in, both posts`);
  // a diagonal load case: the shaft wind follows the 0.75 + 0.75 parts
  const d = await run(mut, 2, () => { const X = lppLtsLast, sh = X.fd.sh, rows = LpLts.groundline(X.ba, X.mc.Bs, X.g, X.L, sh); const q = rows.find(y => y.r.lc === 'd45' && y.r.combo === 'E1max'); return { Fx: q.Fx, Fy: q.Fy, F: q.sw.F }; });
  check(near(d.Fx, 0.75 * d.F) && near(d.Fy, 0.75 * d.F), `LTS Case 3 (d45): W_s,x = W_s,y = 0.75·W_s = ${d.Fx.toFixed(2)} lb`);
  check(!r.errs.length, 'LTS: no console errors');
}

// ===== 4. sign post length and input errors =====
console.log('4 · sign: post length and input errors');
{ const s1 = { top: { appMode: 'sign', signPosts: 1 } };
  const a = await run(s1, 2, ERR), b = await run(s1, 10, ERR), c = await run({}, -1, ERR);
  check(!a.err && near(a.H, a.clr + a.s - 2), `IBC monopost: post H = clr + s − p = ${a.clr} + ${a.s} − 2 = ${a.H} ft, no input error`);
  check(b.clr === 10 && /must be less than the clearance/.test(b.err), 'p = clearance (10 ft): input error');
  check(/must be 0 or more/.test(c.err), 'p < 0: input error');
}

// ===== 5. drawings with p = 2 ft =====
console.log('5 · drawings, p = 2 ft');
for (const [name, mut] of Object.entries({ pole: {}, sign1: { top: { appMode: 'sign', signPosts: 1 } }, sign2lts: { inputs: { signB: '16', signS: '5', bromsSoil: 'cohesive', bromsC: '1.0' }, top: { codeMode: 'lts', appMode: 'sign', signPosts: 2 } } })) {
  const r = await run(mut, 2, DXF);
  check(r.ok && !r.nan && r.p, `${name}: DXF valid, no NaN, the projection p is dimensioned`);
  check(r.rpt, `${name}: the Report tab works the grade actions (shaft projection)`);
  check(!r.errs.length, `${name}: no console errors ${r.errs.slice(0, 2).join(' | ')}`);
}
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
