#!/usr/bin/env node
// Bridge Substructure Loading (SubLoads): seismic earth pressure location option (SLPL, engineer-approved 2026-11-11; the Abutment
// Calculator's four options, same values and order: P.br.hEQmode 'sw' | 'static' | 'comb' | 'nonyield', P.br.hAEr for (c), default 0.5;
// absent = 'sw' = as before). Hand check, default project, Abut. 1, A_s = 0.15 (site class D): k_h = 0.5 × 0.15 = 0.075, K_AE = 0.3517,
// H = 20 ft, L = 46.070 ft: P_AE = ½ γ H² K_AE L = 388.819 kip, static P_A = 339.728 kip at z_s = H/3 = 6.667 ft, ΔP_AE = 49.091 kip.
//   (a) ΔP_AE at 0.6H = 12.000 ft: M = 589.093 about the footing base (combined 2853.95 kip-ft, 7.34 ft); EE I M_l max 4210.395 (unchanged)
//   (b) combined at max(H/3, z_s) = 6.667 ft: z_Δ = (388.819 × 6.667 − 339.728 × 6.667) / 49.091 = 6.667, M_Δ = 327.274; EE I 3948.576
//   (c) 0.5H = 10.000 ft: z_Δ = (3888.191 − 2264.854) / 49.091 = 33.068 ft, M_Δ = 1623.338; EE I 5244.639; (c) 0.45H: 9.000 ft, z_Δ 25.148, EE I 4855.820
//   (d) H/2 = 10.000 ft: as (c) 0.5: EE I 5244.639
//   node tests/smoke/bsl-pae-loc.mjs
import assert from 'assert/strict';
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

const FILE = process.env.BSL_FILE || path.join(REPO, 'Bridge Substructure Loading.html');
let fails = 0;
const ok = async (m, f) => { try { await f(); console.log('  ok   ' + m); } catch (e) { fails++; console.log('  FAIL ' + m + ': ' + String(e.message).slice(0, 400)); } };
const near = (a, b, t, m) => assert.ok(Math.abs(a - b) <= t, `${m}: ${a} vs ${b}`);

const { b, p, errs } = await openPage(FILE);
try {
  await p.waitForFunction(() => typeof MODEL !== 'undefined' && MODEL && MODEL.G); await p.waitForTimeout(800);
  const run = (m, r) => p.evaluate(([m, r]) => { P = defP(); syncSupports(); P.br.eqSa = SA_T.map(T => T === 0 ? 0.15 : Math.min(0.35, 0.12 / Math.max(T, 0.01))).map(v => String(+v.toFixed(4))); P.br.eqSiteClass = 'D';
    if (m) P.br.hEQmode = m; if (r != null) P.br.hAEr = r; MODEL.cacheEE = null; recompute();
    const E = earthAbut(0), vp = E.items.find(i => i.cls === 'EQe' && i.sec === 'bot'), defs = unitRes(0).UM.defs, C = combine(0), q = defs.findIndex(x => x.label === 'M<sub>l</sub>, bottom of footing');
    return { PAE: E.seis.PAE, PA: E.seis.PA, dP: vp.H, zi: vp.z - E.zb, M: vp.H * (vp.z - E.zb), zc: E.seis.zc, EE: C.EEI.max[q], ic: SubLoadsInputCheck.collect().map(x => x.label + ': ' + x.msg) }; }, [m, r]);
  const R = { absent: await run(), sw: await run('sw'), b: await run('static'), c: await run('comb'), c45: await run('comb', 0.45), d: await run('nonyield') };
  await ok('magnitudes: P_AE 388.819, P_A 339.728, ΔP_AE 49.091 kip (every option)', () => Object.values(R).forEach(r => { near(r.PAE, 388.819, 0.001, 'PAE'); near(r.PA, 339.728, 0.001, 'PA'); near(r.dP, 49.091, 0.001, 'dP'); }));
  await ok('(a) absent and sw: ΔP_AE at 12.000 ft, M 589.093, EE I M_l 4210.395 (as before)', () => [R.absent, R.sw].forEach(r => { near(r.zi, 12, 1e-9, 'z'); near(r.M, 589.093, 0.001, 'M'); near(r.EE, 4210.395, 0.001, 'EE'); }));
  await ok('(b) combined at H/3: z_Δ 6.667, M 327.274, EE I 3948.576', () => { near(R.b.zc, 20 / 3, 1e-9, 'zc'); near(R.b.zi, 20 / 3, 1e-9, 'z'); near(R.b.M, 327.274, 0.001, 'M'); near(R.b.EE, 3948.576, 0.001, 'EE'); });
  await ok('(c) 0.5H (default ratio): z_c 10, z_Δ 33.068, M 1623.338, EE I 5244.639; 0.45H: z_c 9, z_Δ 25.148, EE I 4855.820', () => {
    near(R.c.zc, 10, 1e-9, 'zc'); near(R.c.zi, 33.068, 0.001, 'z'); near(R.c.M, 1623.338, 0.001, 'M'); near(R.c.EE, 5244.639, 0.001, 'EE');
    near(R.c45.zc, 9, 1e-9, 'zc45'); near(R.c45.zi, 25.148, 0.001, 'z45'); near(R.c45.EE, 4855.820, 0.001, 'EE45');
    near(R.c.PAE * R.c.zc, R.c.PA * (20 / 3) + R.c.M, 0.001, 'combined moment'); });
  await ok('(d) nonyielding H/2: as (c) 0.5', () => { near(R.d.zc, 10, 1e-9, 'zc'); near(R.d.EE, 5244.639, 0.001, 'EE'); });
  await ok('input check: (c) ratio 0.4 to 0.5', async () => { assert.deepEqual(R.c45.ic, []); const r = await run('comb', 0.6); assert.ok(r.ic.some(x => /^Combined PAE height \/ H: /.test(x)), r.ic.join('\n')); });
  await ok('§6 notes: Bridge pane, Earth loads tab, Report', async () => {
    const t = await p.evaluate(async () => { P = defP(); syncSupports(); P.br.eqSa = SA_T.map(T => T === 0 ? 0.15 : Math.min(0.35, 0.12 / Math.max(T, 0.01))).map(v => String(+v.toFixed(4))); P.br.eqSiteClass = 'D'; P.br.hEQmode = 'static'; MODEL.cacheEE = null; recompute();
      P.ui.itab = document.querySelector('.itab[data-pane=earth]') ? 'earth' : 'bridge'; buildSide();   /* SLIT: the Earth loads input tab */ const side = document.getElementById('sidebar').innerText, opts = [...document.getElementById('f_br_hEQmode').options].map(o => o.value + '|' + o.textContent);
      P.ui.sel = 0; showTab('earth'); await new Promise(r => setTimeout(r, 200)); return { side, opts, tab: document.getElementById('tab-earth').innerText, rpt: JSON.stringify(slrModel()) }; });
    assert.deepEqual(t.opts.map(o => o.split('|')[0]), ['sw', 'static', 'comb', 'nonyield']);
    assert.match(t.opts[0], /\(a\) Seed & Whitman: ΔP_AE at 0\.6H, static P_A at H\/3/); assert.match(t.opts[3], /\(d\) Nonyielding wall: combined P_AE at H\/2 \[C11\.6\.5\.4\]/);
    assert.match(t.side, /Seismic earth pressure location: \(b\) Combined P_AE at H\/3/);
    assert.match(t.tab, /Seismic earth location: \(b\) Combined P_AE at H\/3, not lower than the static resultant \[C11\.6\.5\.3\] \(Bridge tab\): combined PAE = 388\.8 kip at H\/3 \(C11\.6\.5\.3\), not lower than the static resultant: z = 6\.67 ft/);
    assert.match(t.rpt, /Seismic earth pressure location/); assert.match(t.rpt, /combined P_AE = 388\.8 kip at H\/3/);
  });
  await ok('0 console errors', () => assert.deepEqual(errs, []));
} finally { await b.close(); }
if (fails) { console.log(`${fails} failure(s)`); process.exit(1); }
console.log('all passed');
