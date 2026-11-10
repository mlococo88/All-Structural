#!/usr/bin/env node
// Gusset Plate Rating: MBE 4th Edition (2026) values adopted by the engineer's decisions of 2026-11-10 (regression test, headless Chromium,
// tests/lib.mjs openPage). Holds the hand-check values of the fix log entries (fixlog/Gusset Plate Rating.md, G4A, G4B, G4C, G4D, G4E):
//   (a) φ_c (Whitmore compression) 0.95, φ_bs (block shear) 1.00, φ_s 0.90 for new projects (MBE 4th Ed. 6A.6.3, 6A.4.2.4, 6A.6.12.6);
//       a project saved with φ_s = 1.0 keeps it and gets the notice; owner RIDOT keeps the LRFD 10th Ed. 6.5.4.2 values (φ_bs 0.80).
//   (b) rivets φ_sF_uR_1R_2R_3mA_r (Eq. 6A.6.12.5.1-1); bolts φ_s 0.48 / 0.38 F_ub, × 0.80 above 50 in (Eqs. 6A.6.12.6.2-1, -2);
//       A325 F_ub 105 ksi above 1.0 in (Table 6A.6.12.6.2-1); a project with a 3rd Ed. rivet value entered keeps the 3rd Ed. form.
//   (c) DL/LL resistance reduction R_DL (6A.6.12.6.1); bolt slip of slip-critical connections, a Service II rating check (6A.6.12.3, 6A.6.12.6.3),
//       design load at the operating level only (γ_LL 1.00), legal 1.30 (Table 6A.4.2.2-1). (fix log G4C)
//   (d) fastener shear and bearing of the design load rated at the operating level only (6A.6.12.2, 6A.6.12.5); filler λ = A_f/A_p
//       (Eqs. 6A.6.12.5.1-3, 6A.6.12.6.2-3). (fix log G4D)
//   (e) LFR rivets of unknown origin φF_v = 25.0 ksi (engineer decision M6, 2026-11-10: 30 × 50/60); an entered value is kept. (fix log G4E)
//   Validation tab: every hand value matches. 0 console errors.
//   node tests/smoke/gusset-mbe4.mjs
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const FILE = path.join(REPO, 'Gusset Plate Rating.html');
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m}: ${a} vs ${b} (tol ${tol})`);
let fails = 0; const ok = (m, f) => { try { f(); console.log('ok   ' + m); } catch (e) { fails++; console.log('FAIL ' + m + '\n     ' + e.message); } };

// project variants (functions of the default project), evaluated in the page with GPR.compute
const VARS = {
  def: 'P => P',
  ridot: 'P => { P.owner = "RIDOT"; return P; }',
  boltBig: 'P => { P.members.forEach(m => { m.fast.grade = "A325"; m.fast.d = 1.125; m.fast.thr = "incl"; }); return P; }',
  longRiv: 'P => { P.members.forEach(m => { if (m.role === "web") m.fast.nR = 18; }); P.plates.poly = P.plates.poly.map(([x, y]) => [x * 2.2, y * 2.2]); return P; }',
  longBolt: 'P => { P.members.forEach(m => { m.fast.grade = "A325"; if (m.role === "web") m.fast.nR = 18; }); P.plates.poly = P.plates.poly.map(([x, y]) => [x * 2.2, y * 2.2]); return P; }',
  riv3: 'P => { P.code = { FvR0: 23 }; return P; }',
  slipLegal: 'P => { P.slip = { on: true, cls: "A" }; P.members.forEach(m => { m.fast.grade = "A325"; m.F.LL.push(m.F.LL[0] * 0.8); }); P.ll.push({ name: "Legal 3S2", kind: "legal", use: "lrfr", gL: 1.45 }); return P; }',
  slipGov: 'P => { P.slip = { on: true, cls: "A" }; P.members.forEach(m => { m.fast.grade = "A325"; m.fast.d = 0.625; }); return P; }',
  heavyDL: 'P => { P.members.forEach(m => { m.F.DC *= 4; m.F.DW *= 4; }); return P; }',
  m6ovr: 'P => { P.code = { FvR0L: 23.8 }; return P; }',
  filler: 'P => { P.members.forEach(m => { if (m.role === "web") m.fast.tf = 0.375; }); return P; }',
  fillerLoss: 'P => { P.members.forEach(m => { if (m.role === "web") m.fast.tf = 0.375; }); P.plates.loss = { mode: "thk", per: [0, 0.125] }; return P; }',
  fillerArea: 'P => { P.members.forEach(m => { if (m.role === "web") { m.fast.tf = 0.375; m.fast.Af = 9; m.fast.Ap = 6; } }); return P; }',
  valid: 'P => GPR.validationModel()'
};

// a project saved before 2026-11-10 (φ_s = 1.0 stored with it) in the autosave
const old = await (async () => { const { b, p } = await openPage(FILE); await p.waitForFunction(() => typeof GPR !== 'undefined'); const d = await p.evaluate(() => { const P = GPR.defaults(); P.fac = { phiC: 1.0, phiS: 1.0 }; return JSON.stringify({ data: P, name: '' }); }); await b.close(); return d; })();

const run = async (ls) => {
  const { b, p, errs } = await openPage(FILE, { vw: 1400, ls });
  await p.waitForFunction(() => window.__gprForTest && window.__gprForTest().R, null, { timeout: 60000 });
  await p.waitForTimeout(1200);
  const r = await p.evaluate(VARS => {
    const out = {};
    for (const [k, fs] of Object.entries(VARS)) { const R0 = GPR.compute(GPR.normalize(eval(fs)(GPR.defaults())));
      const cap = {}; R0.checks.forEach(c => Object.entries(c.cap || {}).forEach(([m, o]) => Object.entries(o).forEach(([d, q]) => { if (q) cap[`${c.id}|${m}|${d}`] = q.C; })));
      const rf = {}; R0.checks.forEach(c => (c.rf || []).forEach((q, j) => { if (q && !q.err) rf[`${c.id}|${j}`] = q.RF; }));
      out[k] = { gov: R0.gov.map(g => ({ id: g.c.id, RF: g.r.RF })), cap, rf, warn: R0.warnings.map(String), p: { phiC: R0.p.phiC, phiBS: R0.p.phiBS }, phiS: R0.P.fac.phiS }; }
    const cur = window.__gprForTest();
    out.cur = { phiS: cur.P.fac.phiS, inv: cur.R.gov[0].r.RF, invId: cur.R.gov[0].c.id, warnS: cur.R.warnings.some(w => /System factor φ_s = 1\.00/.test(String(w))) };
    setOTab('validation'); const t = document.querySelector('#tab-validation').innerText; out.valTab = (t.match(/(\d+) of (\d+) values match/) || []).slice(1).map(Number);
    return out;
  }, VARS);
  await b.close(); return { r, errs };
};

const A = await run(null), B = await run({ 'gussetRating.autosave.v1': old });
const { def: d, valid: v, ridot: rd } = A.r;
// ---- (a) φ factors and φ_s ----
ok('(a) new project: φ_s 0.90, φ_c (Whitmore) 0.95, φ_bs 1.00, no φ_s notice', () => { assert.equal(d.phiS, 0.9); assert.equal(d.p.phiC, 0.95); assert.equal(d.p.phiBS, 1.0); assert.ok(!d.warn.some(w => /System factor φ_s = /.test(w))); });
ok('(a) L2-U1-WB φ_cP_n = 694.30 kip (657.76 at φ_c 0.90)', () => near(d.cap['L2-U1-WB|lrfr|-'], 694.302, 0.01, 'WB'));
ok('(a) L2-U3-BS φ_bsR_n = 1146.13 kip (916.90 at φ_bs 0.80)', () => near(d.cap['L2-U3-BS|lrfr|+'], 1146.125, 0.01, 'BS'));
ok('(a) RIDOT: φ_bs stays 0.80 (L2-U3-BS 916.90 kip)', () => { assert.equal(rd.p.phiBS, 0.8); near(rd.cap['L2-U3-BS|lrfr|+'], 916.9, 0.01, 'BS'); });
// ---- (b) rivet and bolt shear ----
ok('(b) L2-U1-FS = 0.80 × 48 × (0.67 × 50 × 0.6013) × (1 − 0.25 × 15/50) = 715.52 kip (531.09 3rd Ed.)', () => near(d.cap['L2-U1-FS|lrfr|+'], 715.523, 0.01, 'FS'));
ok('(b) L2-U2-FS = 0.80 × 20 × (0.67 × 50 × 0.6013) × (1 − 0.25 × 14/50) = 299.75 kip', () => near(d.cap['L2-U2-FS|lrfr|+'], 299.746, 0.01, 'FS'));
ok('(b, c, d) L2-U1-FS RF Operating = (0.90 × 0.9968 × 715.52 − 223.5)/202.5 = 2.066 (DL/LL = 174/150 = 1.16); not rated at Inventory', () => { near(d.rf['L2-U1-FS|1'], (0.9 * (1 - 0.1 * 0.16 / 5) * 715.5233 - 223.5) / 202.5, 5e-4, 'RF'); assert.equal(d.rf['L2-U1-FS|0'], undefined); assert.equal(d.rf['L2-U1-BR|0'], undefined); });
// ---- (d) design load fastener checks at Operating; filler λ = A_f/A_p ----
ok('(d) filler 3/8 in: λ = 2(0.375)/1.000 = 0.750, R_3 = 1.75/2.50 = 0.700, L2-U1-FS = 715.52 × 0.700 = 500.87 kip; Inventory now SP3-Y 1.249 (was L2-U1-FS 0.860); Operating L2-U1-FS (0.90 × 0.9968 × 500.87 − 223.5)/202.5 = 1.115', () => { const r = A.r.filler; near(r.cap['L2-U1-FS|lrfr|+'], 500.866, 0.01, 'FS'); assert.equal(r.gov[0].id, 'SP3-Y'); near(r.gov[0].RF, 1.2490, 5e-4, 'Inv'); assert.equal(r.gov[1].id, 'L2-U1-FS'); near(r.gov[1].RF, 1.1152, 5e-4, 'Op'); });
ok('(d) filler with plates 0.5 + 0.375 in: λ = 2(0.375)/0.875 = 0.857 (was 0.375/0.375 = 1.000), R_3 = 0.6842 (0.6667), L2-U1-FS 489.57 kip (477.02)', () => near(A.r.fillerLoss.cap['L2-U1-FS|lrfr|+'], 715.5233 * (1 + 0.75 / 0.875) / (1 + 1.5 / 0.875), 0.01, 'FS'));
ok('(d) filler areas entered A_f 9, A_p 6 in²: λ = 1.5, R_3 = 0.625, L2-U1-FS 447.20 kip', () => near(A.r.fillerArea.cap['L2-U1-FS|lrfr|+'], 715.5233 * 0.625, 0.01, 'FS'));
// ---- (c) DL/LL reduction and slip ----
ok('(c) default LRFR Inventory SP3-Y = (0.90 × 0.9968 × 395.05 − 143.66)/168.73 = 1.249; Operating 210.74/130.16 = 1.619', () => { near(d.gov[0].RF, 1.2490, 5e-4, 'Inv'); near(d.gov[1].RF, 1.6191, 5e-4, 'Op'); });
ok('(c) 4 × dead load: DL/LL = 4.64, R_DL = 1 − 0.10 × 3.64/5 = 0.9272; SP3-Y Inventory −1.452', () => { assert.equal(A.r.heavyDL.gov[0].id, 'SP3-Y'); near(A.r.heavyDL.gov[0].RF, (0.9 * (1 - 0.1 * 3.64 / 5) * 395.0496 - 4 * 143.66303) / 168.73175, 5e-4, 'RF'); near(A.r.heavyDL.gov[0].RF, -1.452, 5e-4, 'RF'); });
ok('(c) slip, A325 7/8 in Class A: L2-U1-SL R_s = 0.33 × 48 × 39 = 617.76 kip; Operating (617.76 − 174)/(1.00 × 150) = 2.958; Legal (1.30, LL 120) 2.845; Inventory not checked', () => { const r = A.r.slipLegal; near(r.cap['L2-U1-SL|lrfr|+'], 617.76, 0.01, 'Rs'); assert.equal(r.rf['L2-U1-SL|0'], undefined); near(r.rf['L2-U1-SL|1'], 2.9584, 5e-4, 'Op'); near(r.rf['L2-U1-SL|4'], 2.8446, 5e-4, 'Legal'); });
ok('(c) slip governs, A325 5/8 in: L2-U1-SL R_s = 0.33 × 48 × 19 = 300.96 kip; Operating (300.96 − 174)/150 = 0.846 governs', () => { const r = A.r.slipGov; near(r.cap['L2-U1-SL|lrfr|+'], 300.96, 0.01, 'Rs'); assert.ok(/-SL$/.test(r.gov[1].id), r.gov[1].id); near(r.gov[1].RF, (300.96 - 174) / 150, 5e-4, 'Op'); });
ok('(b) default: SP3-Y governs (L2-U1-FS no longer)', () => { assert.equal(d.gov[0].id, 'SP3-Y'); assert.equal(d.gov[1].id, 'SP3-Y'); near(d.gov[2].RF, 1.1645, 5e-4, 'LFR Inv'); });
ok('(b) A325 1 1/8 in, threads included: L2-U1-FS = 0.80 × 48 × 0.38 × 105 × 0.9940 = 1523.00 kip', () => near(A.r.boltBig.cap['L2-U1-FS|lrfr|+'], 1522.997, 0.01, 'FS'));
ok('(b) long riveted joint (L = 51 in): L2-U1-FS = 0.80 × 144 × 33.5 × 0.6013 × 0.75 = 1740.46 kip', () => near(A.r.longRiv.cap['L2-U1-FS|lrfr|+'], 1740.462, 0.01, 'FS'));
ok('(b) long bolted joint (L = 51 in, A325 7/8 in): L2-U1-FS = 0.80 × 144 × 0.48 × 120 × 0.6013 × 0.80 = 3192.06 kip', () => near(A.r.longBolt.cap['L2-U1-FS|lrfr|+'], 3192.059, 0.01, 'FS'));
ok('(b) project with a 3rd Ed. rivet value entered: 3rd Ed. form kept (531.09 kip) and warning', () => { near(A.r.riv3.cap['L2-U1-FS|lrfr|+'], 531.086, 0.01, 'FS'); assert.ok(A.r.riv3.warn.some(w => /MBE 3rd Ed\. form/.test(w))); });
// ---- (e) M6 ----
ok('(e) LFR L2-U1-FS = 48 × 25.0 × 0.6013 = 721.58 kip (686.95 at 23.8); LFR Inventory RF (721.58 − 1.3 × 174)/(2.17 × 115) = 1.985; governing LFR stays SP3-Y 1.164', () => { near(d.cap['L2-U1-FS|lfr|+'], 721.585, 0.01, 'FS'); near(d.rf['L2-U1-FS|2'], (721.585 - 1.3 * 174) / (2.17 * 115), 5e-4, 'RF'); assert.equal(d.gov[2].id, 'SP3-Y'); near(d.gov[2].RF, 1.1645, 5e-4, 'gov'); });
ok('(e) filler project LFR Inventory L2-U1-FS = (505.11 − 226.2)/249.55 = 1.118 (1.021 at 23.8)', () => { assert.equal(A.r.filler.gov[2].id, 'L2-U1-FS'); near(A.r.filler.gov[2].RF, 1.1176, 5e-4, 'RF'); });
ok('(e) a project with 23.8 ksi entered keeps it: L2-U1-FS LFR 686.95 kip', () => near(A.r.m6ovr.cap['L2-U1-FS|lfr|+'], 686.949, 0.01, 'FS'));
// ---- validation model ----
ok('validation: D-FS 0.80 × 16 × (0.67 × 60 × 0.6013) × 0.955 = 295.49 kip', () => near(v.cap['D-FS|lrfr|+'], 295.49, 0.02, 'D-FS'));
ok('validation: D-WB 408.87 kip, D-BS 670.48 kip', () => { near(v.cap['D-WB|lrfr|-'], 408.87, 0.02, 'D-WB'); near(v.cap['D-BS|lrfr|+'], 670.48, 0.02, 'D-BS'); });
ok('validation: LRFR Operating D-FS RF = (0.90 × 295.49 − 59)/81 = 2.555; no LRFR Inventory D-FS rating', () => { near(v.rf['D-FS|1'], 2.5548, 5e-4, 'RF'); assert.equal(v.rf['D-FS|0'], undefined); });
ok('Validation tab: every hand value matches', () => { assert.equal(A.r.valTab.length, 2); assert.equal(A.r.valTab[0], A.r.valTab[1]); });
// ---- saved project (§5): φ_s = 1.0 kept, notice shown ----
ok('saved project: φ_s 1.0 kept, notice shown; Inventory SP3-Y (0.9968 × 395.05 − 143.66)/168.73 = 1.482', () => { assert.equal(B.r.cur.phiS, 1); assert.equal(B.r.cur.warnS, true); assert.equal(B.r.cur.invId, 'SP3-Y'); near(B.r.cur.inv, 1.4824, 5e-4, 'Inventory RF'); });
ok('page opened without storage: φ_s 0.90, no notice', () => { assert.equal(A.r.cur.phiS, 0.9); assert.equal(A.r.cur.warnS, false); });
ok('0 console errors', () => { assert.deepEqual([...A.errs, ...B.errs], []); });
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
