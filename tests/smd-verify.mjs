#!/usr/bin/env node
// Shear and Moment Diagrams.html: solver regression test (dev tooling only; added 2026-11-07, review S3).
// The solver is inline in the tool, so the tool is driven headless (tests/lib.mjs openPage, file://) through its own globals
// (applyProject, nodeR, shD, moD, deD, env, smdLoadFlags, window.smdBad) and checked against:
//   1. closed forms (simple span, propped cantilever, fixed-fixed, cantilever, couple);
//   2. the independent solver tests/smd/indep.mjs on the 27 review cases in tests/smd/cases.json (R, M, V, δ; case 15 must be flagged unstable);
//   3. the review fixes: combination 3 (CMB3), pattern live load (PATL, also against an exhaustive independent envelope), old saves
//      keeping their own combinations and pattern setting, the envelope moment reaction (MRE), the zero-factor case note (CZF),
//      the solver input check (LV), units (lb / in) and no console errors.
// Usage: node tests/smd-verify.mjs [--file "Shear and Moment Diagrams.html"]   Exit code 0 when every check passes.
import fs from 'fs';
import path from 'path';
import { REPO, HERE, openPage } from './lib.mjs';
import { indep, ext } from './smd/indep.mjs';

const av = process.argv.slice(2), fi = av.indexOf('--file');
const FILE = path.resolve(REPO, fi >= 0 ? av[fi + 1] : 'Shear and Moment Diagrams.html');
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const rel = (a, b, s) => Math.abs(a - b) / Math.max(1e-9, s);
const E = 4176000, I = 0.02, EI = E * I;
const base = { fu: 'kip', lu: 'ft', cid: 'U', secOn: true, Ev: E, Iv: I, cv: 0.5, Av: 0.05, defLim: 360, Fbv: 0, envOn: false };
const U = (lc, mag, x = {}) => ({ type: 'uniform', lc, mag, allSpans: true, si: 0, ...x });
const OLD_DEF = [{ id: 'U', f: { DL: 1, LL: 1, SL: 1, WL: 1 }, on: true }, { id: '14', f: { DL: 1.4 }, on: true }, { id: '12_16', f: { DL: 1.2, LL: 1.6 }, on: true },
  { id: '12_16S', f: { DL: 1.2, LL: 1.6, SL: .5 }, on: true }, { id: '12W', f: { DL: 1.2, LL: 1, SL: .5, WL: 1 }, on: true }, { id: '09W', f: { DL: .9, WL: 1 }, on: true }];

const { b, p, errs } = await openPage(FILE);
await p.waitForFunction(() => typeof applyProject === 'function' && typeof solve === 'function');
await p.waitForTimeout(1000);
// apply a project, recompute synchronously (as schedule() does), read the results
const run = pr => p.evaluate(pr => {
  applyProject(JSON.parse(JSON.stringify(pr))); readIn(); solve(); updStats();
  const R = nodeR.map(r => ({ v: r.v, m: r.m }));
  // the last station is past the closing reaction / end load (V and M close to 0 there): left out of the extremes, as the tool's peak labels do
  const o = { unstable: !!window.unstable, bad: window.smdBad || '', R, sh: shD.slice(0, -1), mo: moD.slice(0, -1), de: deD, flags: typeof smdLoadFlags !== 'undefined' ? smdLoadFlags.slice() : [],   /* older versions (--file) have no input check */ stats: document.getElementById('statsRow').innerText };
  if (env) o.env = { R: env.R, Mmx: Math.max(...env.M.mx.map(q => q.y)), Mmn: Math.min(...env.M.mn.map(q => q.y)), gov: env.R.map(r => [COMBOS[r.mc] ? COMBOS[r.mc].name : '', COMBOS[r.mnc] ? COMBOS[r.mnc].name : '']) };
  return o;
}, pr);
const proj = (spans, nodes, loads, x = {}) => ({ ...base, spans: spans.map(L => ({ L })), nodes: nodes.map(t => ({ t })), loads: loads.map((l, i) => ({ id: i + 1, lc: 'DL', si: 0, ...l })), ...x });

// 1. closed forms (AISC Manual Table 3-23 forms; values by hand)
{
  let t = await run(proj([20], ['pin', 'roller'], [{ type: 'uniform', mag: 2, allSpans: true }]));
  ok(rel(ext(t.mo).max, 100, 100) < 1e-9 && rel(t.R[0].v, 20, 20) < 1e-9, `simple span UDL: M = wL²/8 = 100 (${ext(t.mo).max.toFixed(6)}), R = 20`);
  ok(rel(ext(t.de).abs, 5 * 2 * 20 ** 4 / (384 * EI), 0.05) < 1e-3, `simple span UDL: δ = 5wL⁴/384EI = ${(5 * 2 * 20 ** 4 / (384 * EI)).toFixed(6)} (${ext(t.de).abs.toFixed(6)})`);
  t = await run(proj([20], ['fixed', 'roller'], [{ type: 'uniform', mag: 2, allSpans: true }]));
  ok(rel(t.R[0].v, 25, 25) < 1e-9 && rel(t.R[0].m, 100, 100) < 1e-9, `propped cantilever UDL: R_A = 5wL/8 = 25, M_A = wL²/8 = 100 (${t.R[0].v.toFixed(6)}, ${t.R[0].m.toFixed(6)})`);
  t = await run(proj([20], ['fixed', 'fixed'], [{ type: 'point', mag: 20, pos: 6 }]));
  ok(rel(t.R[0].m, 20 * 6 * 14 ** 2 / 400, 60) < 1e-9 && rel(t.R[1].m, -20 * 36 * 14 / 400, 60) < 1e-9, `fixed-fixed P: M = Pab²/L² = 58.8, Pa²b/L² = 25.2 (${t.R[0].m.toFixed(6)}, ${t.R[1].m.toFixed(6)})`);
  t = await run(proj([10], ['fixed', 'free'], [{ type: 'distributed', sm: 3, em: 0, sx: 0, ex: 10 }]));
  ok(rel(ext(t.mo).min, -50, 50) < 1e-9, `cantilever triangle 3→0: M = wL²/6 = 50 (${ext(t.mo).min.toFixed(6)})`);
  t = await run(proj([20], ['pin', 'roller'], [{ type: 'moment', mag: 10, pos: 5 }]));
  ok(rel(t.R[0].v, 0.5, 1) < 1e-9 && rel(ext(t.mo).min, -7.5, 7.5) < 1e-6 && rel(ext(t.mo).max, 2.5, 7.5) < 1e-6, 'simple span couple 10 at 5 ft: R = ±M/L, M = +2.5 / −7.5 (peak read 1e-6 ft before the couple)');
  t = await run(proj([15, 15], ['pin', 'roller', 'roller'], [{ type: 'uniform', mag: 2.5, allSpans: true }]));
  ok(rel(ext(t.mo).min, -70.3125, 70) < 1e-9 && rel(t.R[1].v, 46.875, 47) < 1e-9, `two equal spans UDL: M_B = −wL²/8 = −70.3125, R_B = 10wL/8 = 46.875 (closed-form FER, FERX) (${ext(t.mo).min.toFixed(6)})`);
}

// 2. the 27 review cases against the independent solver
const cases = JSON.parse(fs.readFileSync(path.join(HERE, 'smd', 'cases.json'), 'utf8'));
for (const c of cases) {
  const t = await run(proj(c.spans, c.nodes, c.loads));
  const unst = !c.nodes.includes('fixed') && c.nodes.filter(n => n !== 'free').length < 2;
  if (unst) { ok(t.unstable, `${c.name}: flagged unstable`); continue; }
  const nodeX = [0]; c.spans.forEach(L => nodeX.push(nodeX.at(-1) + L)); const tot = nodeX.at(-1);
  const r = indep({ spans: c.spans, sup: c.nodes, EI, loads: c.loads.map(l => { const x0 = nodeX[l.si || 0];
    if (l.type === 'point') return { type: 'point', x: x0 + l.pos, P: l.mag };
    if (l.type === 'moment') return { type: 'moment', x: x0 + l.pos, M: l.mag };
    if (l.type === 'uniform') return l.allSpans ? { type: 'dist', x1: 0, x2: tot, w1: l.mag, w2: l.mag } : { type: 'dist', x1: x0, x2: x0 + c.spans[l.si || 0], w1: l.mag, w2: l.mag };
    return { type: 'dist', x1: x0 + l.sx, x2: x0 + l.ex, w1: l.sm, w2: l.em }; }) });
  const sR = Math.max(1, ...r.R.map(q => Math.abs(q.v))), eR = Math.max(...t.R.map((q, i) => Math.abs(q.v - r.R[i].v))) / sR;
  const sM = Math.max(1, ext(r.M).abs), eM = Math.max(Math.abs(ext(t.mo).max - ext(r.M).max), Math.abs(ext(t.mo).min - ext(r.M).min)) / sM;
  const eMR = Math.max(...t.R.map((q, i) => Math.abs(q.m - r.R[i].m))) / Math.max(sM, 1e-9);
  const sV = Math.max(1, ext(r.V).abs), eV = Math.max(Math.abs(ext(t.sh).max - ext(r.V).max), Math.abs(ext(t.sh).min - ext(r.V).min)) / sV;
  const eD = t.de.length ? Math.abs(ext(t.de).abs - ext(r.D).abs) / Math.max(1e-12, ext(r.D).abs) : 1;
  ok(eR < 1e-5 && eMR < 1e-5 && eM < 5e-4 && eV < 1e-4 && eD < 3e-3, `${c.name}: rel. error R ${eR.toExponential(1)}, M_R ${eMR.toExponential(1)}, M ${eM.toExponential(1)}, V ${eV.toExponential(1)}, δ ${eD.toExponential(1)}`);
}

// 3. review fixes
{
  const ss20 = { ...base, envOn: true, spans: [{ L: 20 }], nodes: [{ t: 'pin' }, { t: 'roller' }] };
  let t = await run({ ...ss20, loads: [U('DL', 1), U('SL', 2)] });
  ok(rel(t.env.Mmx, 220, 220) < 1e-9, `CMB3 (H1): D 1, S 2, new project: |M|env = 1.2(1)+1.6(2) = 4.4 × 400/8 = 220 (${t.env.Mmx.toFixed(4)}, ${t.env.gov[0][0]})`);
  t = await run({ ...ss20, combos: OLD_DEF, loads: [U('DL', 1), U('SL', 2)] });
  ok(rel(t.env.Mmx, 150, 150) < 1e-9 && /saved combination list has no/.test(t.stats), `CMB3: an old saved list keeps its results (150) and shows the note (${t.env.Mmx.toFixed(4)})`);
  t = await run({ ...ss20, loads: [U('DL', 1), U('SL', 2), U('WL', 1)] });
  ok(rel(t.env.Mmx, 245, 245) < 1e-9, `CMB3 (M1): + W 1 down: (1.2+3.2+0.5) × 400/8 = 245 (${t.env.Mmx.toFixed(4)})`);
  const tw = { ...base, envOn: true, spans: [{ L: 15 }, { L: 15 }], nodes: [{ t: 'pin' }, { t: 'roller' }, { t: 'roller' }], loads: [U('DL', 1), U('LL', 2)] };
  t = await run({ ...tw, patLL: true });
  ok(rel(t.env.Mmx, 87.5, 87.5) < 2e-4 &&   /* M⁺ between stations: 0.075 ft grid */ rel(t.env.R[0].mx, 27.75, 27.75) < 1e-6 && rel(t.env.R[0].mn, 3.75, 27.75) < 1e-6 && rel(t.env.Mmn, -123.75, 124) < 1e-6,
    `PATL (H2): two 15 ft spans D 1 L 2: M⁺ 87.50 (station grid), R_A 27.75 / 3.75, M_B −123.75 (${t.env.Mmx.toFixed(4)}, ${t.env.R[0].mx.toFixed(4)} / ${t.env.R[0].mn.toFixed(4)}, ${t.env.Mmn.toFixed(4)}; ${t.env.gov[0][0]})`);
  t = await run({ ...tw });   // saved before PATL: no patLL field
  ok(Math.abs(t.env.Mmx - 69.6094) < 1e-3 && /Pattern live load is not generated/.test(t.stats), `PATL: an old save (no patLL) keeps its results (69.609) and shows the warning (${t.env.Mmx.toFixed(4)})`);
  // exhaustive independent envelope, 3 unequal spans with LL per span, default combinations
  const sp3 = [10, 14, 12], X3 = [0, 10, 24, 36], COMB = [{ DL: 1, LL: 1, SL: 1, WL: 1 }, { DL: 1.4 }, { DL: 1.2, LL: 1.6 }, { DL: 1.2, LL: 1.6, SL: .5 }, { DL: 1.2, LL: 1, SL: 1.6 }, { DL: 1.2, SL: 1.6, WL: .5 }, { DL: 1.2, LL: 1, SL: .5, WL: 1 }, { DL: .9, WL: 1 }];
  t = await run({ ...base, envOn: true, patLL: true, spans: sp3.map(L => ({ L })), nodes: ['pin', 'roller', 'roller', 'fixed'].map(t2 => ({ t: t2 })), loads: [U('DL', 1), U('LL', 1.5)] });
  let Mx = -1e9, Mn = 1e9; const R = [0, 1, 2, 3].map(() => [-1e9, 1e9]);
  for (const f of COMB) for (let m = 0; m < 8; m++) { if (!f.LL && m) continue;
    const r = indep({ spans: sp3, sup: ['pin', 'roller', 'roller', 'fixed'], EI, loads: [{ type: 'dist', x1: 0, x2: 36, w1: f.DL || 0, w2: f.DL || 0 }, ...sp3.map((L, i) => ({ type: 'dist', x1: X3[i], x2: X3[i + 1], w1: (m >> i & 1) ? 1.5 * (f.LL || 0) : 0, w2: (m >> i & 1) ? 1.5 * (f.LL || 0) : 0 }))] }, 60);
    Mx = Math.max(Mx, ext(r.M).max); Mn = Math.min(Mn, ext(r.M).min); r.R.forEach((q, j) => { R[j][0] = Math.max(R[j][0], q.v); R[j][1] = Math.min(R[j][1], q.v); }); }
  const eR = Math.max(...R.map((q, j) => Math.max(Math.abs(q[0] - t.env.R[j].mx), Math.abs(q[1] - t.env.R[j].mn)))) / Math.max(...R.map(q => Math.abs(q[0])));
  ok(eR < 1e-5 && rel(t.env.Mmx, Mx, Mx) < 5e-4 && rel(t.env.Mmn, Mn, -Mn) < 5e-4, `PATL: 3 spans 10/14/12, pattern envelope vs exhaustive independent (R ${eR.toExponential(1)}, M⁺ ${t.env.Mmx.toFixed(4)} vs ${Mx.toFixed(4)}, M⁻ ${t.env.Mmn.toFixed(4)} vs ${Mn.toFixed(4)})`);
  t = await run({ ...base, envOn: true, spans: [{ L: 20 }], nodes: [{ t: 'fixed' }, { t: 'roller' }], loads: [U('DL', 1), U('LL', 2), U('WL', -1)] });
  ok(rel(t.env.R[0].mmx, 220, 220) < 1e-9 && rel(t.env.R[0].mmn, -5, 220) < 1e-9, `MRE (L4): fixed–roller 20 ft envelope M_R,A = 4.4 × 400/8 = 220 / (0.9−1) × 400/8 = −5 (${(t.env.R[0].mmx ?? NaN).toFixed(4)} / ${(t.env.R[0].mmn ?? NaN).toFixed(4)})`);
  t = await run({ ...ss20, cases: [{ id: 'DL', name: 'Dead' }, { id: 'LL', name: 'Live' }, { id: 'SL', name: 'Snow' }, { id: 'WL', name: 'Wind' }, { id: 'EQ', name: 'EQ' }], loads: [U('DL', 1), U('EQ', 1)] });
  ok(/Load cases not combined/.test(t.stats) && rel(t.env.Mmx, 70, 70) < 1e-9, 'CZF (M2): a case with no factor in any combination is named; results unchanged (70)');
  const s2 = { ...base, spans: [{ L: 20 }, { L: 10 }], nodes: [{ t: 'pin' }, { t: 'roller' }, { t: 'roller' }] };
  t = await run({ ...s2, loads: [{ id: 1, type: 'distributed', lc: 'DL', sm: 1, em: 1, sx: 12, ex: 4, si: 0 }] });
  ok(rel(t.R.reduce((s, q) => s + q.v, 0), 8, 8) < 1e-9 && t.flags.length === 1, `LV (L1): trapezoid entered 12 → 4 ft is turned round: ΣR = 8, flagged (${t.flags[0] || ''})`);
  t = await run({ ...s2, loads: [{ id: 1, type: 'point', lc: 'DL', mag: 10, pos: 25, si: 0 }] });
  ok(rel(t.R[1].v, 10, 10) < 1e-9 && t.flags.length === 1, 'LV: point load off the span analysed at the support, flagged');
  t = await run({ ...s2, spans: [{ L: 0 }, { L: 10 }], loads: [U('DL', 1)] });
  ok(t.unstable && /length must be a number greater than 0/.test(t.bad + t.stats), 'LV: a zero span stops the analysis with a message');
  t = await run({ ...s2, loads: [{ id: 1, type: 'point', lc: 'DL', mag: 'abc', pos: 5, si: 0 }] });
  ok(t.R.every(q => isFinite(q.v)) && t.flags.length === 1, 'LV: a non-number magnitude is left out (no NaN), flagged');
}
// units: the same beam in kip-ft and lb-in gives the same reactions (lb) and fixed-end moment
{
  const mk = (fu, lu, sc, fs) => ({ ...base, fu, lu, Ev: E * fs / (sc * sc), Iv: I * sc ** 4, spans: [40, 55, 8].map(L => ({ L: L * sc })), nodes: ['fixed', 'roller', 'roller', 'free'].map(t2 => ({ t: t2 })),
    loads: [U('DL', 0.1 * fs / sc), { id: 2, type: 'point', lc: 'DL', mag: 0.5 * fs, pos: 8 * sc, si: 2 }] });
  const a = await run(mk('kip', 'ft', 1, 1)), c = await run(mk('lb', 'in', 12, 1000));
  const e = Math.max(...a.R.map((q, i) => Math.abs(q.v * 1000 - c.R[i].v) / 1000)), em = Math.abs(a.R[0].m * 12000 - c.R[0].m) / Math.abs(a.R[0].m * 12000);
  ok(e < 1e-6 && em < 1e-9, `units: kip-ft and lb-in give the same reactions and fixed-end moment (max diff ${e.toExponential(1)} kip, M ${em.toExponential(1)})`);
}
const ce = errs.filter(e => !/^Failed to load resource/.test(e));
ok(!ce.length, 'no console errors' + (ce.length ? ': ' + ce.slice(0, 3).join(' | ') : ''));
await b.close();
console.log(bad ? `${bad} FAILED` : 'ALL PASS');
process.exit(bad ? 1 : 0);
