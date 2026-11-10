#!/usr/bin/env node
// Shear and Moment Diagrams.html: cantilever deflection limit regression test (dev tooling only; added 2026-11-10, SMCL / open item O3).
// Engineer's decision 2026-11-10: a cantilever overhang (an end span whose outer end node is Free) is checked against
// l = 2 x the cantilever length (IBC 2018 Table 1604.3 footnote i); every other span keeps l = its own length L.
// The tool is driven headless (tests/lib.mjs openPage, file://) through its own globals (applyProject, deflSpans, updStats,
// renderKaTeX, smrModel) and checked against hand values:
//   1. cantilever, fixed-free, P = 10 kip at the tip: delta = PL^3/3EI; limit L/360 -> 2L/360; NG -> OK;
//   2. the "Cantilever overhang" template (16 ft + 6 ft overhang, W18x50): tip delta by hand; only span 2 uses 2L;
//   3. free-fixed (left cantilever) and a 3-span beam with a right overhang: only the end span with the Free end uses 2L;
//   4. beams without a Free end: every span keeps L (allow = L/x);
//   5. the result card, the Engineering Calculations panel and the Report quote 2L, and the "Span length:" note states the basis;
//   6. no console errors.
// Usage: node tests/smd-cantilever-defl.mjs [--file "Shear and Moment Diagrams.html"]   Exit code 0 when every check passes.
import path from 'path';
import { REPO, openPage } from './lib.mjs';

const av = process.argv.slice(2), fi = av.indexOf('--file');
const FILE = path.resolve(REPO, fi >= 0 ? av[fi + 1] : 'Shear and Moment Diagrams.html');
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const E = 4176000, I = 0.02, EI = E * I;   // kip/ft^2, ft^4: EI = 83,520 kip-ft^2
const base = { fu: 'kip', lu: 'ft', cid: 'U', secOn: true, Ev: E, Iv: I, cv: 0.5, Av: 0.05, defLim: 360, Fbv: 0, envOn: false };
const proj = (spans, nodes, loads, x = {}) => ({ ...base, spans: spans.map(L => ({ L })), nodes: nodes.map(t => ({ t })), loads: loads.map((l, i) => ({ id: i + 1, lc: 'DL', si: 0, ...l })), ...x });

const { b, p, errs } = await openPage(FILE);
await p.waitForFunction(() => typeof applyProject === 'function' && typeof deflSpans === 'function');
await p.waitForTimeout(1000);
const run = pr => p.evaluate(pr => {
  applyProject(JSON.parse(JSON.stringify(pr))); readIn(); solve(); updStats(); renderKaTeX();
  return { d: deflSpans().map(s => ({ i: s.i, L: s.L, cant: !!s.cant, dm: s.dm, allow: s.allow, ratio: s.ratio, ok: s.ok })),
    stats: document.getElementById('statsRow').innerText, calc: document.getElementById('cOut').innerText, report: JSON.stringify(smrModel()) };
}, pr);

// 1. fixed-free cantilever, L = 10 ft, P = 10 kip at the tip
{
  const t = await run(proj([10], ['fixed', 'free'], [{ type: 'point', mag: 10, pos: 10 }]));
  const d = t.d[0], dm = 10 * 10 ** 3 / (3 * EI);   // 10,000 / 250,560 = 0.039910 ft
  ok(near(d.dm, dm), `cantilever P = 10 kip: delta = PL^3/3EI = ${dm.toFixed(6)} ft (${d.dm.toFixed(6)})`);
  ok(d.cant && near(d.allow, 20 / 360), `cantilever: limit 2L/360 = 20/360 = 0.055556 ft (was L/360 = 0.027778) (${d.allow.toFixed(6)})`);
  ok(near(d.ratio, d.dm / (20 / 360)) && near(d.ratio, dm / (20 / 360), 1e-4) && d.ok, `cantilever: ratio ${d.ratio.toFixed(4)} = 0.7184 OK (was 1.4368 NG)`);
  ok(/span 1: 2L\/360=0\.0556 ✓/.test(t.stats), 'result card quotes "span 1: 2L/360=0.0556 ✓"');
  ok(/against 2L\/360 = 2 × 10\/360 = 0\.05556 ft \(cantilever overhang: l = 2L, IBC 2018 Table 1604\.3 footnote i\)/.test(t.report), 'Report step quotes 2L/360 = 2 × 10/360 = 0.05556 ft and the footnote');
  ok(/twice its length, 2L, since IBC 2018 Table 1604\.3 footnote i/.test(t.calc) && /twice its length, 2L, since IBC 2018 Table 1604\.3 footnote i/.test(t.report), '"Span length:" note states the 2L basis on screen and in the Report');
  ok(!/overhang length itself gives the smaller/.test(t.calc + t.report), 'the old O3 wording is gone');
}
// 2. the "Cantilever overhang" template with a W18x50 (I = 800 in^4), Unfactored
{
  const Iw = 800 / 20736, EIw = E * Iw;
  const t = await run({ ...base, Iv: Iw, spans: [{ L: 16 }, { L: 6 }], nodes: [{ t: 'pin' }, { t: 'roller' }, { t: 'free' }],
    loads: [{ id: 1, type: 'uniform', lc: 'DL', mag: 1.5, si: 0, allSpans: true }, { id: 2, type: 'point', lc: 'LL', mag: 8, pos: 6, si: 1 }] });
  // tip: theta_B = (M_B L/3 - wL^3/24)/EI = (75*16/3 - 1.5*16^3/24)/EI = 144/EI; delta = 144*6 + Pa^3/3 + wa^4/8 = 864 + 576 + 243 = 1683/EI
  const dm = 1683 / EIw;
  ok(near(t.d[1].dm, dm, 1e-4), `template: tip delta = 1683/EI = ${dm.toFixed(6)} ft (${t.d[1].dm.toFixed(6)})`);
  ok(!t.d[0].cant && near(t.d[0].allow, 16 / 360), `template span 1 (interior to the overhang) keeps L/360 = 16/360 (${t.d[0].allow.toFixed(6)})`);
  ok(t.d[1].cant && near(t.d[1].allow, 12 / 360) && near(t.d[1].ratio, dm / (12 / 360), 1e-4) && t.d[1].ok,
    `template span 2 (overhang): 2L/360 = 12/360 = 0.033333 ft (was 6/360 = 0.016667), ratio ${t.d[1].ratio.toFixed(4)} (was 0.6268)`);
}
// 3. left cantilever and a right overhang on a 3-span beam
{
  let t = await run(proj([10], ['free', 'fixed'], [{ type: 'point', mag: 5, pos: 0 }]));
  ok(t.d[0].cant && near(t.d[0].allow, 20 / 360), 'free-fixed (left cantilever): 2L/360');
  t = await run(proj([10, 12, 4], ['pin', 'roller', 'roller', 'free'], [{ type: 'uniform', mag: 1, allSpans: true }]));
  ok(t.d.map(s => s.cant).join() === 'false,false,true' && near(t.d[0].allow, 10 / 360) && near(t.d[1].allow, 12 / 360) && near(t.d[2].allow, 8 / 360),
    '3 spans with a right overhang: spans 1 and 2 keep L/360, the overhang uses 2L/360');
  t = await run(proj([6, 8], ['free', 'fixed', 'free'], [{ type: 'uniform', mag: 1, allSpans: true }]));
  ok(t.d.every(s => s.cant) && near(t.d[0].allow, 12 / 360) && near(t.d[1].allow, 16 / 360), 'interior fixed support with two cantilevers: both 2L/360');
}
// 4. no Free end: unchanged (allow = L/x)
{
  for (const [nm, pr] of [['simple span', proj([20], ['pin', 'roller'], [{ type: 'uniform', mag: 2, allSpans: true }])],
    ['propped, L/240', proj([20], ['fixed', 'roller'], [{ type: 'uniform', mag: 2, allSpans: true }], { defLim: 240 })],
    ['3 spans, envelope', proj([10, 14, 12], ['pin', 'roller', 'roller', 'fixed'], [{ type: 'uniform', mag: 1, allSpans: true }, { type: 'uniform', lc: 'LL', mag: 1.5, allSpans: true }], { envOn: true, patLL: true })]]) {
    const t = await run(pr);
    ok(t.d.every(s => !s.cant && near(s.allow, s.L / pr.defLim)) && !/2L\//.test(t.stats + t.calc + t.report), `${nm}: every span L/${pr.defLim}, no 2L shown`);
  }
}
const ce = errs.filter(e => !/^Failed to load resource/.test(e));
ok(!ce.length, 'no console errors' + (ce.length ? ': ' + ce.slice(0, 3).join(' | ') : ''));
await b.close();
console.log(bad ? `${bad} FAILED` : 'ALL PASS');
process.exit(bad ? 1 : 0);
