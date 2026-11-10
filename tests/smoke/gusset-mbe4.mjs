#!/usr/bin/env node
// Gusset Plate Rating: MBE 4th Edition (2026) values adopted by the engineer's decisions of 2026-11-10 (regression test, headless Chromium,
// tests/lib.mjs openPage). Holds the hand-check values of the fix log entries (fixlog/Gusset Plate Rating.md, G4A, G4B):
//   (a) φ_c (Whitmore compression) 0.95, φ_bs (block shear) 1.00, φ_s 0.90 for new projects (MBE 4th Ed. 6A.6.3, 6A.4.2.4, 6A.6.12.6);
//       a project saved with φ_s = 1.0 keeps it and gets the notice; owner RIDOT keeps the LRFD 10th Ed. 6.5.4.2 values (φ_bs 0.80).
//   (b) rivets φ_sF_uR_1R_2R_3mA_r (Eq. 6A.6.12.5.1-1); bolts φ_s 0.48 / 0.38 F_ub, × 0.80 above 50 in (Eqs. 6A.6.12.6.2-1, -2);
//       A325 F_ub 105 ksi above 1.0 in (Table 6A.6.12.6.2-1); a project with a 3rd Ed. rivet value entered keeps the 3rd Ed. form.
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
ok('(b) L2-U1-FS RF Inventory = (0.90 × 715.52 − 223.5)/262.5 = 1.602', () => near(d.rf['L2-U1-FS|0'], 1.6018, 5e-4, 'RF'));
ok('(b) default governing: LRFR Inventory SP3-Y (0.90 × 395.05 − 143.66)/168.73 = 1.256, Operating 1.628; LFR Inventory 1.164', () => { assert.equal(d.gov[0].id, 'SP3-Y'); near(d.gov[0].RF, 1.2557, 5e-4, 'Inv'); assert.equal(d.gov[1].id, 'SP3-Y'); near(d.gov[1].RF, 1.6278, 5e-4, 'Op'); near(d.gov[2].RF, 1.1645, 5e-4, 'LFR Inv'); });
ok('(b) A325 1 1/8 in, threads included: L2-U1-FS = 0.80 × 48 × 0.38 × 105 × 0.9940 = 1523.00 kip', () => near(A.r.boltBig.cap['L2-U1-FS|lrfr|+'], 1522.997, 0.01, 'FS'));
ok('(b) long riveted joint (L = 51 in): L2-U1-FS = 0.80 × 144 × 33.5 × 0.6013 × 0.75 = 1740.46 kip', () => near(A.r.longRiv.cap['L2-U1-FS|lrfr|+'], 1740.462, 0.01, 'FS'));
ok('(b) long bolted joint (L = 51 in, A325 7/8 in): L2-U1-FS = 0.80 × 144 × 0.48 × 120 × 0.6013 × 0.80 = 3192.06 kip', () => near(A.r.longBolt.cap['L2-U1-FS|lrfr|+'], 3192.059, 0.01, 'FS'));
ok('(b) project with a 3rd Ed. rivet value entered: 3rd Ed. form kept (531.09 kip) and warning', () => { near(A.r.riv3.cap['L2-U1-FS|lrfr|+'], 531.086, 0.01, 'FS'); assert.ok(A.r.riv3.warn.some(w => /MBE 3rd Ed\. form/.test(w))); });
// ---- validation model ----
ok('validation: D-FS 0.80 × 16 × (0.67 × 60 × 0.6013) × 0.955 = 295.49 kip', () => near(v.cap['D-FS|lrfr|+'], 295.49, 0.02, 'D-FS'));
ok('validation: D-WB 408.87 kip, D-BS 670.48 kip', () => { near(v.cap['D-WB|lrfr|-'], 408.87, 0.02, 'D-WB'); near(v.cap['D-BS|lrfr|+'], 670.48, 0.02, 'D-BS'); });
ok('validation: LRFR Inventory D-FS RF = (0.90 × 295.49 − 59)/105 = 1.971', () => near(v.rf['D-FS|0'], 1.9709, 5e-4, 'RF'));
ok('Validation tab: every hand value matches', () => { assert.equal(A.r.valTab.length, 2); assert.equal(A.r.valTab[0], A.r.valTab[1]); });
// ---- saved project (§5): φ_s = 1.0 kept, notice shown ----
ok('saved project: φ_s 1.0 kept, notice shown; Inventory SP3-Y (395.05 − 143.66)/168.73 = 1.490', () => { assert.equal(B.r.cur.phiS, 1); assert.equal(B.r.cur.warnS, true); assert.equal(B.r.cur.invId, 'SP3-Y'); near(B.r.cur.inv, 1.4899, 5e-4, 'Inventory RF'); });
ok('page opened without storage: φ_s 0.90, no notice', () => { assert.equal(A.r.cur.phiS, 0.9); assert.equal(A.r.cur.warnS, false); });
ok('0 console errors', () => { assert.deepEqual([...A.errs, ...B.errs], []); });
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
