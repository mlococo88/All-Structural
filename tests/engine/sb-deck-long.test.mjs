// apps/steel-bridge DKL (2026-11-24, engineer request "The deck is missing the transverse steel"): the longitudinal deck bars and check DK4.
// Made-up bridges only. Engine: engine/deck.js calc(); figure: ui/deck.js figure(); report: report/builders.js (deck section, bill of materials).
//   1. saved data: the new keys (barLongTop, sLongTop, barLongBot, sLongBot) live in P.deckDesign only, are not in DEF, survive export / import;
//      a project without them (every project saved before) gives the same checks, ratios, steps and verdicts as before (DK1 to DK3, no DK4);
//   2. hand check of DK4: A_s,d (9.7.3.2 on S_eff of 9.7.2.3) <= A_s,prov = 12 A_b / s;
//   3. one of a pair entered: a warning, no DK4, nothing else changes;
//   4. the figure: the transverse bars are lines (no circle for them), circles only for the entered longitudinal bars, at their depth;
//   5. the report: DK4 row, the "not checked" row without the bars, the bill of materials lists the entered longitudinal bars.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const W = loadShared(...['units.js', 'steps.js', 'lldf.js', 'deck.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/owners.js', 'engine/lldf.js', 'engine/loads.js', 'engine/deck.js', 'ui/deck.js'].map(E)));
const M = W.SBDModel, DK = W.SBDDeck, UI = W.SBDDeckUI;
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs hand ${b}`);
const J = v => JSON.parse(JSON.stringify(v));
const plates = (P, bf, tw) => P.girders.forEach(g => g.segments.forEach(s => { s.topB = bf; s.tw = tw; }));
// the bridge of DD hand check (b): five girders at 12 ft, b_f 18 in, t_w 0.5625 in, bottom transverse #5 at 6 in
const bridge = o => { const P = M.newProject(); P.xs.bays = P.xs.bays.map(() => 12); plates(P, 18, 0.5625); P.deckDesign = { on: true, ...(o || {}) }; return P; };
const strip = R => J({ checks: R.checks, steps: R.steps.map(s => [s.id, s.value, s.sub]), warn: R.warn, dist: R.dist });

test('saved data: the longitudinal keys are optional (not in DEF), stored in P.deckDesign, and survive export / import', () => {
  ['barLongTop', 'sLongTop', 'barLongBot', 'sLongBot'].forEach(k => assert.equal(k in DK.DEF, false, k));
  const P = bridge({ barLongTop: 0.2, sLongTop: 12, barLongBot: 0.31, sLongBot: 9 }), back = M.importJSON(M.exportJSON(P));
  assert.equal(back.ok, true); assert.deepEqual(J(back.project.deckDesign), { on: true, barLongTop: 0.2, sLongTop: 12, barLongBot: 0.31, sLongBot: 9 });
  assert.equal(JSON.stringify(strip(DK.calc(back.project))), JSON.stringify(strip(DK.calc(P))));
  const old = M.importJSON(M.exportJSON(bridge({ sBot: 8 }))); assert.equal(old.ok, true); assert.deepEqual(J(old.project.deckDesign), { on: true, sBot: 8 });
});

test('a project without longitudinal bars (saved before DKL): DK1 to DK3 as before, no DK4, no new step, no warning', () => {
  [M.newProject(), bridge()].forEach(P0 => { P0.deckDesign = P0.deckDesign || { on: true, sBot: 8 };
    const R = DK.calc(P0); assert.deepEqual([...R.checks.map(c => c.id)], ['DK1', 'DK2', 'DK3', 'DK5', 'DK6']);   // DK5, DK6: DKTS / DKCR (2026-11-24), always
    assert.equal(R.long.top, null); assert.equal(R.long.bot, null); assert.equal(R.long.topPart, false); assert.equal(R.long.botPart, false);
    assert.deepEqual([...R.steps.map(s => s.id).filter(i => /dist/.test(i))], ['dk.distSe', 'dk.dist', 'dk.distAs']);
    assert.ok(!R.warn.some(w => /longitudinal/.test(w)));
    assert.equal(DK.topics(R).find(t => t.key === 'dist').title, 'Distribution reinforcement'); });
  // the default bridge's hand-checked ratios (sb-deck.test.mjs) are unchanged
  const R = DK.calc({ ...M.newProject(), deckDesign: { on: true, sBot: 8 } });
  near(R.checks[0].r, 0.97402, 2e-5, 'DK1'); near(R.checks[1].r, 0.91567, 2e-5, 'DK2'); near(R.checks[2].r, 0.73273, 2e-5, 'DK3');
  // blank inputs (the card's "not entered": the key is deleted) and null (a NaN saved to JSON) read as not entered
  const Rn = DK.calc(bridge({ barLongBot: null, sLongBot: null, barLongTop: null })); assert.equal(Rn.checks.length, 5); assert.equal(Rn.warn.some(w => /longitudinal/.test(w)), false);
});

test('DK4 hand check: S_eff 11.2266 ft -> 65.66 % of 0.620 in²/ft = 0.4071 in²/ft; #5 at 9 in OK (0.985), #4 at 9 in NG (1.527)', () => {
  // A_s,pos = 12(0.31)/6 = 0.620; S_eff = 12 - 18/12 + (18 - 0.5625)/24 = 11.2265625 ft; p_d = 220/sqrt(11.2265625) = 65.65976 %
  // A_s,d = 0.6565976(0.620) = 0.4070905 in²/ft
  const R0 = DK.calc(bridge());
  const R = DK.calc(bridge({ barLongBot: 0.31, sLongBot: 9 }));
  near(R.dist.Seff, 11.2265625, 1e-12); near(R.dist.pct, 65.65976, 1e-5); near(R.dist.As, 0.4070905, 1e-7);
  // #5 at 9 in: A_s,prov = 12(0.31)/9 = 0.413333 in²/ft; ratio 0.4070905/0.413333 = 0.984896 OK
  const c = R.checks[3]; assert.equal(c.id, 'DK4'); assert.equal(c.Mu, null); assert.equal(c.phiMn, null);
  near(c.prov, 0.4133333, 1e-7); near(c.req, 0.4070905, 1e-7); near(c.r, 0.984896, 1e-6); assert.equal(c.ok, true); assert.equal(c.step, 'dk.distR');
  assert.match(c.ref, /9\.7\.3\.2/); assert.match(c.loc, /#5 at 9\.00 in/);
  // the other checks are those without the bars
  assert.equal(JSON.stringify(J(R.checks.slice(0, 3))), JSON.stringify(J(R0.checks.slice(0, 3))));
  // worked steps: symbolic, substituted, result; in the distribution topic
  const sp = R.steps.find(s => s.id === 'dk.distProv'), sr = R.steps.find(s => s.id === 'dk.distR');
  assert.equal(sp.sym, 'A_{s,prov}'); assert.equal(sp.eq, '\\frac{12\\,A_{b}}{s_{L}}'); assert.equal(sp.sub, '\\frac{12(0.31)}{9.00}'); assert.ok(Object.is(sp.value, c.prov));
  assert.equal(sr.sub, '0.407 \\le 0.413'); assert.ok(Object.is(sr.value, c.r)); assert.equal(sr.ok, true);
  assert.deepEqual([...R.steps.map(s => s.id).filter(i => /dist/.test(i))], ['dk.distSe', 'dk.dist', 'dk.distAs', 'dk.distProv', 'dk.distR']);
  assert.match(DK.topics(R).find(t => t.key === 'dist').title, /^DK4 /);
  // #4 at 9 in: A_s,prov = 12(0.20)/9 = 0.266667; ratio 1.526589 NG
  const Q = DK.calc(bridge({ barLongBot: 0.2, sLongBot: 9 })), q = Q.checks[3];
  near(q.prov, 0.2666667, 1e-7); near(q.r, 1.526589, 1e-6); assert.equal(q.ok, false); assert.equal(Q.steps.find(s => s.id === 'dk.distR').sub, '0.407 \\gt 0.267');
  // the top longitudinal bars alone: drawn and reported, not checked
  const T = DK.calc(bridge({ barLongTop: 0.2, sLongTop: 12 })); assert.equal(T.checks.length, 5); assert.ok(!T.checks.some(c => c.id === 'DK4')); assert.equal(T.long.top.s, 12); assert.equal(T.long.bot, null);
});

test('one of a pair entered: a warning, no DK4, the checks unchanged', () => {
  const R0 = DK.calc(bridge());
  const R = DK.calc(bridge({ barLongBot: 0.31 })); assert.equal(R.checks.length, 5); assert.equal(R.long.botPart, true);
  assert.ok(R.warn.some(w => /Bottom longitudinal bars: enter both/.test(w))); assert.equal(JSON.stringify(J(R.checks)), JSON.stringify(J(R0.checks)));
  const T = DK.calc(bridge({ sLongTop: 12, barLongTop: 0 })); assert.ok(T.warn.some(w => /Top longitudinal bars: enter both/.test(w))); assert.equal(T.long.top, null);
});

test('the figure: transverse bars are lines at their cover; circles only for the entered longitudinal bars, inside the transverse bars', () => {
  const R0 = DK.calc(bridge()), s0 = UI.figure(R0, 760);
  assert.equal((s0.match(/<circle/g) || []).length, 0, 'no circle without longitudinal bars');
  assert.equal((s0.match(/data-dkbar="top-tr"/g) || []).length, 1); assert.equal((s0.match(/data-dkbar="bot-tr"/g) || []).length, 1);
  assert.ok(s0.includes('top transverse #5 @ 6.00 in') && s0.includes('bottom transverse #5 @ 6.00 in'));
  assert.ok(s0.includes('Longitudinal bars not entered') && s0.includes('data-dklong="none"'));
  const R = DK.calc(bridge({ barLongTop: 0.2, sLongTop: 12, barLongBot: 0.31, sLongBot: 9 })), s = UI.figure(R, 760);
  const nT = (s.match(/data-dkbar="top-long"/g) || []).length, nB = (s.match(/data-dkbar="bot-long"/g) || []).length;
  assert.equal((s.match(/<circle/g) || []).length, nT + nB, 'every circle is a longitudinal bar');
  // the figure spans x = 0 to x1 = o_h + S + min(0.4 S, 30) in; bars from 3 in at their spacing
  const oh = R.oh.L.O.oh * 12, Sp = 144, x1 = oh + Sp + Math.min(Sp * 0.4, 30), cnt = sp => { let n = 0; for (let x = 3; x < x1 - 1; x += sp) n++; return n; };
  assert.equal(nT, cnt(12)); assert.equal(nB, cnt(9)); assert.ok(nB > nT);
  // depths: bottom longitudinal on the bottom transverse bars, top longitudinal under the top transverse bars
  const cy = t => +s.match(new RegExp(`data-dkbar="${t}" cx="[^"]+" cy="([^"]+)"`))[1], ly = t => +s.match(new RegExp(`data-dkbar="${t}" x1="[^"]+" y1="([^"]+)"`))[1];
  const k = (760 - 14 - 44) / x1, ts = 8, db5 = Math.sqrt(4 * 0.31 / Math.PI), db4 = Math.sqrt(4 * 0.2 / Math.PI), Y = y => 58 + (ts - y) * k;
  near(ly('top-tr'), Y(ts - 2.5 - db5 / 2), 1e-9, 'top transverse at its cover'); near(ly('bot-tr'), Y(1.0 + db5 / 2), 1e-9, 'bottom transverse at its cover');
  near(cy('bot-long'), Y(1.0 + db5 + db5 / 2), 1e-9, 'bottom longitudinal: cover + d_b,tr + d_b,L/2');
  near(cy('top-long'), Y(ts - 2.5 - db5 - db4 / 2), 1e-9, 'top longitudinal: t_s - cover - d_b,tr - d_b,L/2');
  assert.ok(s.includes('Longitudinal bars (circles, inside the transverse bars): top #4 at 12.00 in; bottom #5 at 9.00 in.'));
});

// the report (deck section and bill of materials), as tests/engine/sb-deck-report.test.mjs
const FILES = ['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'report.js', 'deck.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/proportions.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'engine/rating.js', 'ui/flexure.js', 'ui/loads.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/rating.js', 'ui/splices.js', 'ui/constructibility.js', 'engine/welds.js', 'ui/welds.js',
  'engine/deck.js', 'engine/sheets.js', 'ui/deflection.js', 'report/data.js', 'report/builders.js', 'report/summary.js', 'ui/nomen.js', 'ui/deck.js'].map(E));
test('report: DK4 in the checks table, the summary rows and the verdict; "not checked" without the bars; every link resolves; bill of materials', () => {
  const WR = loadShared(...FILES), RB = WR.SBDReportBuild, SM = WR.SBDSummary;
  const P0 = WR.SBDModel.defaultProject(); P0.project.name = 'Made-up Creek Bridge'; P0.deckDesign = { on: true, sBot: 8 };
  const P1 = J(P0); Object.assign(P1.deckDesign, { barLongTop: 0.2, sLongTop: 12, barLongBot: 0.31, sLongBot: 9 });
  const P2 = J(P1); P2.deckDesign.barLongBot = 0.11; P2.deckDesign.sLongBot = 18;   // #3 at 18 in: too little
  const mk = P => { const B = WR.SBDReportData.compute(P, 0, { src: 'analysis', want: { dk: true, loads: true, proj: true } }); return { B, Mx: RB.model(B, { detail: 'gov' }) }; };
  const a = mk(P0), b = mk(P1), c = mk(P2);
  [a, b, c].forEach(({ Mx }, i) => { const doc = WR.SharedReport.build(Mx), txt = WR.SharedReport.text(doc);
    assert.deepEqual(J(doc.unresolved), [], i + ': unresolved'); assert.ok(!/NaN|undefined|\[object|§\?/.test(txt), i + ': text clean'); });
  const sec = Mx => JSON.stringify(Mx.sections.find(s => s.id === 'dk'));
  assert.ok(sec(a.Mx).includes('Not checked: bottom longitudinal bars not entered')); assert.equal(a.Mx.gov.filter(q => q.mod === 'Deck').length, 5);
  assert.ok(sec(b.Mx).includes('DK4 Deck distribution reinforcement, bottom longitudinal bars') && !sec(b.Mx).includes('Not checked: bottom longitudinal'));
  const g = b.Mx.gov.filter(q => q.mod === 'Deck'); assert.equal(g.length, 6); assert.equal(g[3].key, 'dk.distR'); near(g[3].r, 0.31155 / (0.31 * 12 / 9), 1e-5, "default bridge: 67 % of 0.465 = 0.31155 / 0.41333");
  // the Summary verdict: unchanged without the bars; DK4 counted once with them; a failing DK4 fails it
  const gird = [{ gi: 0, label: 'G1', cells: { flexStr: { st: 'pass', r: 0.5, tab: 'flex' } } }];
  // DKDC (2026-11-24, engineer decision: top-bar d_c within t_s): the default bridge's DK6 is 0.833 OK (before, DKCR: 1.075 NG), so DK1 to DK3, DK5, DK6 pass
  assert.equal(SM.overall(P0, gird).n.pass, 1 + 5); assert.equal(SM.overall(P1, gird).n.pass, 1 + 6);
  const f = SM.overall(P2, gird); assert.equal(f.verdict, 'FAIL'); assert.match(f.top.q.check, /^DK4 /);
  // bill of materials: without the bars the distribution row as before; with them the bars (number = ceil(12 W / s) + 1, each of length L)
  const bom = Mx => Mx.sections.find(s => s.id === 'bom').subs.find(q => q.id === 'dk'), rows = Mx => bom(Mx).items.find(i => i.type === 'table').rows;
  assert.ok(rows(a.Mx).some(r => r[0] === 'Distribution (bottom, parallel to the girders)'));
  const Lt = P1.spans.lengths.reduce((s, x) => s + x, 0), Wd = b.B.dk.in.Wd, r1 = rows(b.Mx);
  const top = r1.find(r => /^Top longitudinal/.test(r[0])), bot = r1.find(r => /^Bottom longitudinal/.test(r[0]));
  assert.ok(!r1.some(r => r[0] === 'Distribution (bottom, parallel to the girders)'));
  assert.equal(top[2].t, String(Math.ceil(12 * Wd / 12) + 1)); assert.equal(bot[2].t, String(Math.ceil(12 * Wd / 9) + 1));
  near(+bot[4].t.replace(/,/g, ''), (Math.ceil(12 * Wd / 9) + 1) * Lt * 0.31 * 490 / 144, 0.5, 'bottom longitudinal weight');
  // a project without the bars: the bill-of-materials sub is the one before DKL (its text and numbers)
  assert.ok(JSON.stringify(bom(a.Mx)).includes('the top longitudinal bars, any additional overhang bars'));
});
