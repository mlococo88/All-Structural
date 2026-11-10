#!/usr/bin/env node
// Gusset Plate Rating: MBE 4th Edition (2026) values adopted by the engineer's decisions of 2026-11-10 (regression test, headless Chromium,
// tests/lib.mjs openPage). Holds the hand-check values of the fix log entries (fixlog/Gusset Plate Rating.md, "MBE 4th Ed. values"):
//   (a) φ_c (Whitmore compression) 0.95, φ_bs (block shear) 1.00, φ_s 0.90 for new projects (MBE 4th Ed. 6A.6.3, 6A.4.2.4, 6A.6.12.6);
//       a project saved with φ_s = 1.0 keeps it and gets the notice; owner RIDOT keeps the LRFD 10th Ed. 6.5.4.2 values (φ_bs 0.80).
//   Validation tab: every hand value matches. 0 console errors.
//   node tests/smoke/gusset-mbe4.mjs
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const FILE = path.join(REPO, 'Gusset Plate Rating.html');
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m}: ${a} vs ${b} (tol ${tol})`);
let fails = 0; const ok = (m, f) => { try { f(); console.log('ok   ' + m); } catch (e) { fails++; console.log('FAIL ' + m + '\n     ' + e.message); } };

// a project saved before 2026-11-10 (φ_s = 1.0 stored with it) in the autosave
const old = await (async () => { const { b, p } = await openPage(FILE); await p.waitForFunction(() => typeof GPR !== 'undefined'); const d = await p.evaluate(() => { const P = GPR.defaults(); P.fac = { phiC: 1.0, phiS: 1.0 }; return JSON.stringify({ data: P, name: '' }); }); await b.close(); return d; })();

const run = async (ls) => {
  const { b, p, errs } = await openPage(FILE, { vw: 1400, ls });
  await p.waitForFunction(() => window.__gprForTest && window.__gprForTest().R, null, { timeout: 60000 });
  await p.waitForTimeout(1200);
  const r = await p.evaluate(() => {
    const pick = (R0) => { const ck = id => R0.checks.find(c => c.id === id), cap = (id, m, d) => ck(id).cap[m][d].C, rf = (id, j) => ck(id).rf[j].RF;
      return { gov: R0.gov.map(g => ({ id: g.c.id, RF: g.r.RF, C: g.r.C })), cap, rf, warn: R0.warnings.map(String), p: R0.p, fac: R0.P.fac }; };
    const D = pick(GPR.compute(GPR.defaults())), V = pick(GPR.compute(GPR.validationModel())), Rd = (() => { const P = GPR.defaults(); P.owner = 'RIDOT'; return pick(GPR.compute(P)); })();
    const cur = window.__gprForTest();
    const out = {
      def: { gov: D.gov, fsC: D.cap('L2-U1-FS', 'lrfr', '-'), wbC: D.cap('L2-U1-WB', 'lrfr', '-'), bsC: D.cap('L2-U3-BS', 'lrfr', '+'), phiS: D.fac.phiS, phiC: D.p.phiC, phiBS: D.p.phiBS, warnS: D.warn.some(w => /System factor φ_s = /.test(w)) },
      val: { gov: V.gov, wb: V.cap('D-WB', 'lrfr', '-'), bs: V.cap('D-BS', 'lrfr', '+'), fs: V.cap('D-FS', 'lrfr', '+') },
      ridot: { gov: Rd.gov, phiBS: Rd.p.phiBS, bsC: Rd.cap('L2-U3-BS', 'lrfr', '+') },
      cur: { phiS: cur.P.fac.phiS, inv: cur.R.gov[0].r.RF, warnS: cur.R.warnings.some(w => /System factor φ_s = 1\.00/.test(String(w))) },
      valTab: (() => { setOTab('validation'); const t = document.querySelector('#tab-validation').innerText; return (t.match(/(\d+) of (\d+) values match/) || []).slice(1).map(Number); })()
    };
    return out;
  });
  await b.close(); return { r, errs };
};

const A = await run(null), B = await run({ 'gussetRating.autosave.v1': old });
const d = A.r.def, v = A.r.val;
// ---- (a) default project, new: φ_s 0.90, φ_c 0.95, φ_bs 1.00 ----
ok('new project defaults: φ_s 0.90, φ_c (Whitmore) 0.95, φ_bs 1.00', () => { assert.equal(d.phiS, 0.9); assert.equal(d.phiC, 0.95); assert.equal(d.phiBS, 1.0); assert.equal(d.warnS, false); });
ok('default: L2-U1-WB φ_cP_n = 694.30 kip (was 657.76 at φ_c 0.90)', () => near(d.wbC, 694.302, 0.01, 'WB'));
ok('default: L2-U3-BS φ_bsR_n = 1146.13 kip (was 916.90 at φ_bs 0.80)', () => near(d.bsC, 1146.125, 0.01, 'BS'));
ok('default: LRFR Inventory L2-U1-FS RF = (0.90 × 531.1 − 1.25 × 150 − 1.50 × 24)/(1.75 × 150) = 0.969', () => { assert.equal(d.gov[0].id, 'L2-U1-FS'); near(d.gov[0].RF, 0.9694, 5e-4, 'RF Inv'); });
ok('default: LRFR Operating L2-U1-FS RF = 1.257', () => { assert.equal(d.gov[1].id, 'L2-U1-FS'); near(d.gov[1].RF, 1.2567, 5e-4, 'RF Op'); });
ok('default: LFR unchanged (SP3-Y 1.164 / 1.944)', () => { near(d.gov[2].RF, 1.1645, 5e-4, 'LFR Inv'); near(d.gov[3].RF, 1.9439, 5e-4, 'LFR Op'); });
// ---- validation model ----
ok('validation: D-WB 0.95 × 2 × 0.6580^0.6037 × 36 × 7.696 = 408.87 kip', () => near(v.wb, 408.87, 0.02, 'D-WB'));
ok('validation: D-BS 1.00 × 2 × min(351.48, 335.24) = 670.48 kip', () => near(v.bs, 670.48, 0.02, 'D-BS'));
ok('validation: LRFR Inventory D-FS RF = (0.90 × 223.21 − 50 − 9)/105 = 1.351', () => near(v.gov[0].RF, 1.3513, 5e-4, 'RF'));
ok('Validation tab: every hand value matches', () => { assert.equal(A.r.valTab.length, 2); assert.equal(A.r.valTab[0], A.r.valTab[1]); });
// ---- owner RIDOT: LRFD 10th Ed. 6.5.4.2 block shear 0.80 kept ----
ok('RIDOT: φ_bs stays 0.80 (L2-U3-BS 916.90 kip); Inventory SP3-Y RF 0.834', () => { assert.equal(A.r.ridot.phiBS, 0.8); near(A.r.ridot.bsC, 916.9, 0.01, 'BS'); assert.equal(A.r.ridot.gov[0].id, 'SP3-Y'); near(A.r.ridot.gov[0].RF, 0.8343, 5e-4, 'RF'); });
// ---- saved project (§5): φ_s = 1.0 kept, notice shown ----
ok('saved project: φ_s 1.0 kept, notice shown, Inventory RF 1.172', () => { assert.equal(B.r.cur.phiS, 1); assert.equal(B.r.cur.warnS, true); near(B.r.cur.inv, 1.1718, 5e-4, 'Inventory RF'); });
ok('page opened without storage: φ_s 0.90, no notice', () => { assert.equal(A.r.cur.phiS, 0.9); assert.equal(A.r.cur.warnS, false); });
ok('0 console errors', () => { assert.deepEqual([...A.errs, ...B.errs], []); });
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
