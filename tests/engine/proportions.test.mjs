// apps/steel-bridge/engine/proportions.js (B3, 2026-11-01): GS1–GS4 and GS22 against GirderDetail's own Girder section checks
// (GM.gs.checks in "Steel Bridge Design.html", run in a vm by gd-source.mjs), as tests/engine/flexure.test.mjs does for GS5–GS19.
//
// Parity: every location of the 100 tests/projects/st/gd_*.json payloads (engine/flexure.js fromPayload: every payload station, both
// sides of each plate change and interior support) and GirderDetail's built-in rows; the same rows go to GirderDetail. For MassDOT
// payloads the owner is set on both sides (GS4's owner citation, GS22). Compared per location and item: ratio and pass/fail (GS1, GS2 ×6,
// GS3, GS4 total), the top-layer share warning (GS4) and GS22's warning. Expected: identical.
// Hand checks: the built-in rows worked by hand (comments). Also: Auto design's full check takes the GS1–GS4 items (deck items drive no plate).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { gdGirderSection, gdRun } from './gd-source.mjs';

const W = loadShared('units.js', 'steps.js', ...['engine/sections.js', 'engine/owners.js', 'engine/proportions.js', 'engine/flexure.js'].map(f => path.join(ROOT, 'apps/steel-bridge', f)));
const FX = W.SBDFlexure, SEC = W.SBDSections, PR = W.SBDProportions;
const DIR = path.join(ROOT, 'tests/projects/st');
const payloads = fs.readdirSync(DIR).filter(f => /^gd_.*\.json$/.test(f)).sort();
const readP = f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')).payload;

function gdRow(GS, L, i) {
  const M = L.M, n = L.npr || {};
  return { ...JSON.parse(JSON.stringify(GS.ctx.GM.gs.def.rows[0])), name: L.name, region: L.region, cont: L.cont ? 'yes' : 'no', beff: L.beff, ...L.plates,
    Lb: L.Lb, LbC: L.Lb, Cb: L.Cb, CbC: '', lbB: n.b || 0, lbT: n.t || 0, npr: n.kind || '', lbK: n.K == null ? '' : n.K, lbIr: n.Ir == null ? '' : n.Ir, nprWhy: n.why || '', geA: n.geA || '', ...(n.gov ? { nprG: n.gov } : {}), MDC1: M.DC1, MDCc: 0, MDC2: M.DC2, MDW: M.DW, MLLp: M.LLp, MLLn: M.LLn, MCL: 0, MfP: M.FATp, MfN: M.FATn,
    VDC1: 0, VDC2: 0, VDW: 0, VLL: 0, VCL: 0, Vf: 0, fl: L.fl || 0, flC: 0, do: 0, end: 'no', ut: { MUT: M.UT, MUF: M.UF }, x: L.x, i };
}
function gdModule(GS, prj, rows, over) {
  const d = JSON.parse(JSON.stringify(GS.ctx.GM.gs.def)), dk = prj.deck;
  return { ...d, gT: '50', gB: '50', gW: '50', Fyr: prj.mat.Fyr, fc: prj.mat.fc, wc: prj.wc, K1: 1, nRule: 'exact', rebarMp: 'excl', ts: dk.ts, tdeck: dk.tdeck, hh: dk.haunch,
    Art: dk.rebar.top.A, crt: dk.rebar.top.c, Arb: dk.rebar.bot.A, crb: dk.rebar.bot.c, negM: 'auto', rows, ...(over || {}) };
}
const IDS = new Set(['GS1', 'GS2', 'GS3', 'GS4', 'GS22']);
const stats = { cases: 0, rows: 0, items: 0, diffs: [], worst: 0, ids: {} };
function run(GS, name, prj, locs, skews, owner, over) {
  stats.cases++;
  GS.ctx.P.df.bridge = { skews: skews.slice(), ...(owner ? { owner } : {}) };
  const R = GS.compute(gdModule(GS, prj, locs.map((L, i) => gdRow(GS, L, i)), over), { base: true });
  assert.deepEqual([...(R.errors || [])], [], 'GirderDetail input errors');
  const CK = Array.from(gdRun(GS.ctx, c => c.GM.gs.checks(R), GS.loaded));
  const prj2 = { ...prj, ...(owner ? { owner } : {}), ...(over && over.negM === '6108' ? { a6: { ...prj.a6, method: '6108' } } : {}) };
  const G = FX.girder(locs, prj2, {}), mine = new Map(G.rows.map(r => [r.name, r]));
  stats.rows += G.rows.length;
  const D = (k, a, b) => { stats.items++; if (a === b) return; if (typeof a === 'number' && typeof b === 'number') { const rel = Math.abs(a - b) / Math.max(1e-300, Math.abs(b)); if (rel < 1e-12) { stats.worst = Math.max(stats.worst, rel); return; } } stats.diffs.push(`${name} ${k}: ${a} vs GirderDetail ${b}`); };
  for (const c of CK) { if (!IDS.has(c.id)) continue; stats.ids[c.id] = (stats.ids[c.id] || 0) + c.items.length;
    for (const it of c.items) {
      const m = /^([^,]+?)(?:, (top|bottom), (b\/2t|b ≥ D\/6|t ≥ 1\.1t_w)|, (total)|, (top layer share))?$/.exec(it.loc); assert.ok(m, it.loc);
      const r = mine.get(m[1]); assert.ok(r, `${name}: ${m[1]} missing`);
      const key = c.id === 'GS1' ? 'web' : c.id === 'GS2' ? m[2][0] + { 'b/2t': 'bt', 'b ≥ D/6': 'bD', 't ≥ 1.1t_w': 'tt' }[m[3]] : c.id === 'GS3' ? 'iy' : c.id === 'GS22' ? 'a6own' : m[4] ? 'ar' : 'top';
      const q = r.checks.find(x => x.id === c.id && x.key === key); if (!q) { stats.diffs.push(`${name} ${m[1]} ${c.id} ${key}: missing`); continue; }
      if (c.id === 'GS22' || key === 'top') { D(`${m[1]} ${c.id} ${key} warn`, !!q.warn, it.st === 'warn'); continue; }
      D(`${m[1]} ${c.id} ${key} ratio`, q.ratio, it.r); D(`${m[1]} ${c.id} ${key} pass`, q.ok, it.st === 'pass');
    } }
  // no extra items on our side
  G.rows.forEach(r => r.checks.filter(c => IDS.has(c.id)).forEach(c => { if (!CK.some(k => k.id === c.id)) stats.diffs.push(`${name} ${r.name} ${c.id}: not in GirderDetail`); }));
  return { R, G, CK };
}

test('parity with GirderDetail Girder section GS1–GS4, GS22 at every location of the 100 gd_*.json payloads + built-in rows', () => {
  const GS = gdGirderSection(), t0 = Date.now();
  ['f0', 'f2', 'f3', 'frac', 'esc'].forEach(k => GS.fn(k));
  const d = GS.ctx.GM.gs.def, nr = SEC.modularRatio(d.fc, d.wc, d.K1, d.nRule).n;
  const prjB = { deck: { ts: d.ts, tdeck: d.tdeck, haunch: d.hh, rebar: { top: { A: d.Art, c: d.crt }, bot: { A: d.Arb, c: d.crb } } }, mat: { Fyt: 50, Fyb: 50, Fyw: 50, Fyr: d.Fyr, fc: d.fc }, n: nr, wc: d.wc, G: FX.factors(), a6: { method: 'auto', skews: [], curved: false } };
  const locsB = d.rows.map((r, i) => ({ name: `@${i}`, x: null, region: r.region, cont: r.cont === 'yes', plates: { D: r.D, tw: r.tw, topB: r.topB, topT: r.topT, botB: r.botB, botT: r.botT }, beff: r.beff, Lb: r.Lb, Cb: r.Cb, fl: 0, npr: null,
    M: { DC1: r.MDC1, DC2: r.MDC2, DW: r.MDW, LLp: r.MLLp, LLn: r.MLLn, UT: 0, UF: 0, FATp: r.MfP, FATn: r.MfN } }));
  run(GS, 'built-in', prjB, locsB, [], null, { gT: '50W', gB: '50W', gW: '50W' });
  run(GS, 'built-in MassDOT (A6)', prjB, locsB, [], 'MassDOT', { gT: '50W', gB: '50W', gW: '50W' });
  run(GS, 'built-in MassDOT 6.10.8', prjB, locsB, [], 'MassDOT', { gT: '50W', gB: '50W', gW: '50W', negM: '6108' });
  run(GS, 'built-in, top share 0.5', { ...prjB, deck: { ...prjB.deck, rebar: { top: { A: 4.9, c: 2.5 }, bot: { A: 4.9, c: 1.75 } } } }, locsB, [], null, { gT: '50W', gB: '50W', gW: '50W' });
  run(GS, 'built-in, rebar 5 in²', { ...prjB, deck: { ...prjB.deck, rebar: { top: { A: 5, c: 2.5 }, bot: { A: 0, c: 1.75 } } } }, locsB, [], null, { gT: '50W', gB: '50W', gW: '50W' });
  for (const f of payloads) {
    const pl = readP(f), owner = /_MassDOT_/.test(f) ? 'MassDOT' : null, dk = pl.girderDetail.deck, F = FX.fromPayload(pl, { rebar: { top: { A: dk.Ar || 0, c: dk.ts / 2 }, bot: { A: 0, c: dk.ts / 2 } } });   // the same A_r, given as the project's (a hand-off alone: GS4 not evaluated, see below)
    run(GS, f, F.prj, F.locs, pl.girderDetail.skew.bySupport, owner);
  }
  console.log(`       ${stats.cases} cases, ${stats.rows} locations, ${stats.items} values compared in ${((Date.now() - t0) / 1000).toFixed(1)} s; items by check: ${Object.entries(stats.ids).map(([k, v]) => `${k} ${v}`).join(', ')}; ${stats.diffs.length} differ; largest relative difference ${stats.worst.toExponential(1)}`);
  stats.diffs.slice(0, 25).forEach(s => console.log('       ' + s));
  assert.equal(stats.diffs.length, 0, 'differences from GirderDetail (listed above)');
  assert.ok(stats.rows > 30000); assert.ok(stats.ids.GS22 > 0 && stats.ids.GS4 > 0);
});

test('a hand-off file alone: GS4 not evaluated (its A_r is an analysis input), the other items as with the project\'s rebar', () => {
  const pl = readP('gd_builtin_AASHTO_G1.json'), F = FX.fromPayload(pl), G = FX.girder(F.locs, F.prj, {});
  const neg = G.rows.filter(r => !r.pos); assert.ok(neg.length > 10);
  neg.forEach(r => { const c = r.checks.find(q => q.id === 'GS4' && q.key === 'ar'); assert.equal(c.inUse, false); assert.ok(Number.isNaN(c.ratio)); assert.match(c.na, /hand-off/); assert.equal(r.checks.filter(q => q.id === 'GS4').length, 1); });
  assert.ok(G.rows.every(r => r.checks.some(q => q.id === 'GS1' && q.inUse)));
});

test('hand check: GirderDetail\'s built-in rows', () => {
  // Span 1 (positive): D = 60, t_w = 0.5625; top 16 × 0.75, bottom 16 × 1.125; b_eff = 114 in.
  //   GS1: 60/0.5625 = 106.67 ≤ 150, ratio 0.7111.
  //   GS2 top: 16/(2·0.75) = 10.667 ≤ 12 (0.8889); 16 ≥ 60/6 = 10 (0.6250); 0.75 ≥ 1.1(0.5625) = 0.61875 (0.8250).
  //   GS3 (positive: compression = top): I_yc = 0.75(16)³/12 = 256, I_yt = 1.125(16)³/12 = 384, ratio 0.6667: ratio max(0.1/0.6667, 0.6667/10) = 0.15.
  // Pier 1 (negative): top 18 × 1.5, bottom 18 × 2; t_deck = 8.5 in; A_r = 6.6 + 3.2 = 9.8 in².
  //   GS3 (negative: compression = bottom): I_yc = 2(18)³/12 = 972, I_yt = 1.5(18)³/12 = 729, 1.3333: ratio 0.13333.
  //   GS4: 0.01(114)(8.5) = 9.69 in² ≤ 9.8: ratio 9.69/9.8 = 0.98878; top share 6.6/9.8 = 0.673 ≥ 0.667: no warning.
  const prj = { deck: { ts: 8, tdeck: 8.5, haunch: 2, rebar: { top: { A: 6.6, c: 2.5 }, bot: { A: 3.2, c: 1.75 } } }, mat: { Fyt: 50, Fyb: 50, Fyw: 50, Fyr: 60, fc: 4 }, n: SEC.modularRatio(4, 0.15, 1, 'exact').n, G: FX.factors(), a6: { method: 'auto', skews: [] } };
  const M0 = { DC1: 1450, DC2: 210, DW: 240, LLp: 1650, LLn: -400, UT: 0, UF: 0, FATp: 620, FATn: -150 }, M1 = { DC1: -2300, DC2: -330, DW: -380, LLp: 250, LLn: -2400, UT: 0, UF: 0, FATp: 120, FATn: -520 };
  const a = FX.location({ name: 'S1', region: 'pos', cont: true, plates: { D: 60, tw: 0.5625, topB: 16, topT: 0.75, botB: 16, botT: 1.125 }, beff: 114, Lb: 25, Cb: 1, fl: 0, M: M0 }, prj);
  const b = FX.location({ name: 'P1', region: 'neg', cont: true, plates: { D: 60, tw: 0.5625, topB: 18, topT: 1.5, botB: 18, botT: 2 }, beff: 114, Lb: 20, Cb: 1, fl: 0, M: M1 }, prj);
  const g = (r, id, key) => r.checks.find(c => c.id === id && (!key || c.key === key));
  const near = (v, w) => assert.ok(Math.abs(v - w) < 5e-5, `${v} vs ${w}`);
  near(g(a, 'GS1').ratio, 0.71111); near(g(a, 'GS2', 'tbt').ratio, 0.88889); near(g(a, 'GS2', 'tbD').ratio, 0.625); near(g(a, 'GS2', 'ttt').ratio, 0.825); near(g(a, 'GS3').ratio, 0.15);
  near(g(b, 'GS3').ratio, 0.13333); near(g(b, 'GS4', 'ar').ratio, 0.98878); assert.equal(g(b, 'GS4', 'top').warn, false);
  assert.equal(g(a, 'GS4'), undefined);   // positive flexure: no GS4
  // the steps: every item's step is in the location's steps, and the topic of the Flexure tab holds them
  for (const r of [a, b]) { const ids = new Set(r.steps.map(s => s.id)); r.checks.filter(c => /^GS(1|2|3|4|22)$/.test(c.id)).forEach(c => assert.ok(ids.has(c.step), `${r.name} ${c.id} ${c.step}`)); }
  // MassDOT: GS22 warning with App. A6 in use, the owner's citation on GS4
  const c = FX.location({ name: 'P1', region: 'neg', cont: true, plates: { D: 60, tw: 0.5625, topB: 18, topT: 1.5, botB: 18, botT: 2 }, beff: 114, Lb: 20, Cb: 1, fl: 0, M: M1 }, { ...prj, owner: 'MassDOT' });
  assert.equal(c.useA6, true); assert.equal(g(c, 'GS22').warn, true); assert.match(g(c, 'GS4', 'ar').ref, /MassDOT/);
  // the girder summary
  const S = PR.summary([a, b]); assert.deepEqual(JSON.parse(JSON.stringify(S.gov.map(q => q.id))), ['GS1', 'GS2', 'GS3', 'GS4']); near(S.gov.find(q => q.id === 'GS4').c.ratio, 0.98878);
});
