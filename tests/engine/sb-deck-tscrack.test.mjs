// apps/steel-bridge DKTS / DKCR (2026-11-24, engineer request): deck checks DK5 (shrinkage and temperature reinforcement, AASHTO LRFD 10th Ed.
// Art. 5.10.6) and DK6 (crack control of the transverse bars, Art. 5.6.7, Service I); the Summary's deck card shows the demand / limit of
// DK4 to DK6 (before: '—'). Made-up bridges only. Engine: engine/deck.js; UI: ui/deck.js; report: report/builders.js, report/summary.js.
//   1. saved data: the new input exposure (crack control exposure class) lives in P.deckDesign only, is not in DEF; absent reads Class 1;
//      export / import keeps it; a project saved before is exported unchanged;
//   2. hand check DK6 (independent arithmetic below): 8.5 in slab, f_y 60 ksi, f'c 4 ksi, w_c 0.150 kcf, S = 9 ft, #5 at 6 in bottom
//      transverse with 1.0 in clear cover, Table A4-1 +M 6.29 kip-ft/ft; Class 1 and Class 2;
//   3. hand check DK5: #4 at 12 in top longitudinal, h 8.5 in, b = the deck width;
//   4. bars not entered: "not checked"; a thick slab (f_t <= 0.8 f_r): DK6 not required; a bar stress over 0.60 f_y: NG;
//   5. the steps: every check's step exists with its ratio; every value is worked; topics group every step;
//   6. the Summary card and the report: DK4 to DK6 demand / limit cells, the DK5 / DK6 tables, every link resolves.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const W = loadShared(...['units.js', 'steps.js', 'lldf.js', 'deck.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/owners.js', 'engine/lldf.js', 'engine/loads.js', 'engine/deck.js', 'ui/deck.js'].map(E)));
const M = W.SBDModel, DK = W.SBDDeck;
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs hand ${b}`);
const J = v => JSON.parse(JSON.stringify(v));
// the hand-check bridge: 5 girders at 9 ft, an 8.5 in slab (no dead-load-only layer), the default materials (f'c 4, w_c 0.150, F_yr 60)
const hand = o => { const P = M.newProject(); P.xs.bays = P.xs.bays.map(() => 9); P.deck.ts = 8.5; P.deck.tdeck = 8.5;
  P.deckDesign = { on: true, barBot: 0.31, sBot: 6, coverB: 1.0, barTop: 0.31, sTop: 6, coverT: 2.5, ...(o || {}) }; return P; };

test('saved data: exposure is optional (not in DEF), stored in P.deckDesign, survives export / import; absent = Class 1', () => {
  assert.equal('exposure' in DK.DEF, false);
  const P = hand({ exposure: 2 }), back = M.importJSON(M.exportJSON(P)); assert.equal(back.ok, true); assert.equal(back.project.deckDesign.exposure, 2);
  assert.equal(DK.calc(back.project).crack.cls, 2); assert.equal(DK.calc(back.project).crack.ge, 0.75);
  const P0 = hand(), txt = M.exportJSON(P0), R0 = M.importJSON(txt); assert.equal(M.exportJSON(R0.project), txt, 'a project without exposure: byte-identical');
  assert.equal('exposure' in R0.project.deckDesign, false); assert.equal(DK.calc(P0).crack.cls, 1); assert.equal(DK.calc(P0).crack.ge, 1);
  // the card: the select shows Class 1 for an old project; choosing Class 2 writes 2
  const h = W.SBDDeckUI.inputs(P0); assert.match(h, /id="dk_exposure" data-dk="exposure"><option value="1" selected>/);
  const el = { dataset: { dk: 'exposure' }, value: '2' }; assert.equal(W.SBDDeckUI.onChange(el, P0), true); assert.equal(P0.deckDesign.exposure, 2);
});

test('DK6 hand check: #5 at 6 in bottom, S = 9 ft, 8.5 in slab: f_ss 21.46 ksi, s_max 23.24 in (Class 1), 16.77 in (Class 2)', () => {
  // independent hand arithmetic
  const S = 9, h = 8.5, wc = 0.150, fc = 4, fy = 60;
  const wDC = h / 12 * wc, wDW = 0.025;                                                   // 0.10625 ksf; the default wearing surface 25 psf
  const MDC = wDC * S * S / 11, MDW = wDW * S * S / 11, MLL = 6.29, Ms = MDC + MDW + MLL;   // 0.782386 + 0.184091 + 6.29 = 7.256477 kip-ft/ft
  const Ec = 120000 * 1 * wc * wc * Math.pow(fc, 0.33), n = 29000 / Ec;                  // 4266.2 ksi, n = 6.7976
  const As = 12 * 0.31 / 6, db = Math.sqrt(4 * 0.31 / Math.PI), d = h - 1.0 - db / 2;     // 0.620 in²/ft, d_b 0.6283 in, d 7.1859 in
  const rho = As / (12 * d), rn = rho * n, k = Math.sqrt(2 * rn + rn * rn) - rn, j = 1 - k / 3, fss = 12 * Ms / (As * j * d);   // rho 0.0071900, k 0.26757, j 0.91081, f_ss 21.459 ksi
  const dc = 1.0 + db / 2, bs = 1 + dc / (0.7 * (h - dc)), s1 = 700 * 1.00 / (bs * fss) - 2 * dc, s2 = 700 * 0.75 / (bs * fss) - 2 * dc;   // d_c 1.3141, beta_s 1.26125, 23.235, 16.769 in
  const fr = 0.24 * Math.sqrt(fc), ft = 12 * Ms / (12 * h * h / 6);                       // 0.48 ksi; 0.6026 ksi > 0.384: applies
  near(Ms, 7.256477, 1e-6); near(fss, 21.45895, 1e-4); near(bs, 1.261252, 1e-6); near(s1, 23.2353, 1e-4); near(s2, 16.7694, 1e-4);
  const R = DK.calc(hand()), q = R.crack.cases.find(c => c.key === 'crp1'), I = R.bays[0].I;
  assert.equal(I.MLL_pos, 6.29); near(R.in.wDW, wDW, 1e-12);
  near(q.Ms, Ms, 1e-9); near(R.crack.Ec, Ec, 1e-6); near(R.crack.n, n, 1e-9); near(q.rho, rho, 1e-12); near(q.k, k, 1e-12); near(q.j, j, 1e-12);
  near(q.fss, fss, 1e-9); near(q.dc, dc, 1e-12); near(q.bs, bs, 1e-12); near(q.smax, s1, 1e-9); near(R.crack.fr, fr, 1e-12); near(q.ft, ft, 1e-12); assert.equal(q.app, true);
  // ratio = max(s / s_max, f_ss / 0.60 f_y) = max(6 / 23.235 = 0.2582, 21.459 / 36 = 0.5961) = 0.5961 (bar stress)
  near(q.r, fss / 36, 1e-12); assert.equal(q.by, 'stress'); assert.equal(q.ok, true);
  const q2 = DK.calc(hand({ exposure: 2 })).crack.cases.find(c => c.key === 'crp1'); near(q2.smax, s2, 1e-9); near(q2.fss, fss, 1e-12);
  // worked steps: symbolic, substituted, value
  const st = id => R.steps.find(s => s.id === id);
  assert.equal(st('dk.crp1.smax').eq, '\\frac{700\\,\\gamma_{e}}{\\beta_{s}\\,f_{ss}} - 2\\,d_{c}'); assert.equal(st('dk.crp1.smax').sub, '\\frac{700(1.00)}{1.2613(21.46)} - 2(1.314)');
  assert.ok(Object.is(st('dk.crp1.smax').value, q.smax)); assert.ok(Object.is(st('dk.crp1.fss').value, q.fss)); assert.ok(Object.is(st('dk.crp1.bs').value, q.bs));
  assert.equal(st('dk.crp1.Ms').sub, '0.782 + 0.184 + 6.290');
  console.log(`       M_s ${Ms.toFixed(3)}, f_ss ${fss.toFixed(2)} ksi, beta_s ${bs.toFixed(4)}, s_max ${s1.toFixed(2)} in (Class 2 ${s2.toFixed(2)} in); DK6 governing ${R.checks.find(c => c.id === 'DK6').r.toFixed(4)}`);
});

test('DK6 top bars: d_c with the dead-load-only layer, h = t_L (default bridge: 8 in + 0.5 in, cover 2.5 in): hand check, NG 1.0755', () => {
  const R = DK.calc({ ...M.newProject(), deckDesign: { on: true, sBot: 8 } }), q = R.crack.cases.find(c => c.key === 'crn1'), I = R.bays[0].I;
  const db = Math.sqrt(4 * 0.31 / Math.PI), dc = 0.5 + 2.5 + db / 2, h = 8.5, d = 8 - 2.5 - db / 2, As = 0.62, n = R.crack.n;
  const Ms = I.MDC_neg + I.MDW_neg + I.MLL_neg, rho = As / (12 * d), rn = rho * n, k = Math.sqrt(2 * rn + rn * rn) - rn, fss = 12 * Ms / (As * (1 - k / 3) * d);
  const bs = 1 + dc / (0.7 * (h - dc)), smax = 700 / (bs * fss) - 2 * dc;
  near(q.dc, dc, 1e-12); assert.equal(q.h, 8.5); near(q.fss, fss, 1e-9); near(q.smax, smax, 1e-9); near(q.r, 6 / smax, 1e-12); assert.equal(q.ok, false);
  near(q.r, 1.0755, 1e-4); const c = R.checks.find(x => x.id === 'DK6'); assert.equal(c.ok, false); assert.equal(c.step, 'dk.crn1.s'); assert.equal(c.dem.v, 6); near(c.cap.v, smax, 1e-9);
  // positive moment bottom bars: h = t_s (8 in), d_c = c_b + d_b/2
  const p = R.crack.cases.find(x => x.key === 'crp1'); assert.equal(p.h, 8); near(p.dc, 1 + db / 2, 1e-12);
  // the overhangs: Service I with the wheel and the dead loads of DK3
  const o = R.crack.cases.find(x => x.key === 'crohL'), O = R.oh.L.O; near(o.Ms, O.MohDC + O.MohDW + O.MohLL, 1e-12);
});

test('DK5 hand check: #4 at 12 in top longitudinal: A_s,T&S = 0.11 in²/ft (lower bound), ratios 0.550 (area) and 0.667 (spacing)', () => {
  const R = DK.calc(hand({ barLongTop: 0.2, sLongTop: 12 })), T = R.ts, b = 12 * R.in.Wd, h = 8.5;
  const eq = 1.30 * b * h / (2 * (b + h) * 60);   // W_d 42.5 ft: b = 510 in; 1.30(510)(8.5)/(2(518.5)(60)) = 0.090574
  near(b, 510, 1e-9); near(T.eq, eq, 1e-12); near(eq, 0.0905738, 1e-6); assert.equal(T.A, 0.11); assert.equal(T.smax, 18);   // min(3(8.5) = 25.5, 18)
  const tl = T.sets.find(q => q.k === 'tl'); near(tl.As, 0.2, 1e-12); near(tl.rA, 0.55, 1e-12); near(tl.rs, 12 / 18, 1e-12); assert.equal(tl.ok, true);
  const bt = T.sets.find(q => q.k === 'bt'); near(bt.As, 0.62, 1e-12); near(bt.rs, 6 / 18, 1e-12);
  assert.equal(T.sets.find(q => q.k === 'bl').on, false);
  const c = R.checks.find(x => x.id === 'DK5'); near(c.r, 12 / 18, 1e-12); assert.equal(c.ok, true); assert.equal(c.step, 'dk.ts.tl.rs');
  assert.match(c.loc, /^Top longitudinal bars #4 at 12\.00 in \(spacing\); bottom longitudinal bars: not checked \(bars not entered\)$/);
  // the upper and lower bounds and f_y <= 75
  const t2 = DK.tsOf(60, 600, 100); assert.equal(t2.fyU, 75); assert.equal(t2.smax, 12); near(t2.eq, 1.3 * 600 * 60 / (2 * 660 * 75), 1e-12);
  assert.equal(DK.tsOf(200, 2000, 60).A, 0.60);
  // #4 at 24 in: area 0.10 < 0.11 and spacing 24 > 18: NG, the larger ratio (spacing 1.333)
  const N = DK.calc(hand({ barLongBot: 0.2, sLongBot: 24 })).checks.find(x => x.id === 'DK5'); assert.equal(N.ok, false); near(N.r, 24 / 18, 1e-12); assert.match(N.loc, /^Bottom longitudinal/);
});

test('not entered, not required, f_ss over 0.60 f_y', () => {
  const R = DK.calc(hand()), c = R.checks.find(x => x.id === 'DK5');
  assert.match(c.loc, /top longitudinal bars, bottom longitudinal bars: not checked \(bars not entered\)/);
  // a 14 in slab: f_t <= 0.8 f_r everywhere: not required
  const T = DK.calc(hand({})), P = hand(); P.deck.ts = 14; P.deck.tdeck = 14; const Q = DK.calc(P);
  assert.ok(Q.crack.cases.every(q => !q.app), JSON.stringify(Q.crack.cases.map(q => q.ft))); const c6 = Q.checks.find(x => x.id === 'DK6');
  assert.equal(c6.ok, true); assert.equal(c6.r, 0); assert.match(c6.loc, /^Not required/); assert.ok(Q.steps.find(s => s.id === c6.step)); assert.ok(T.crack.cases.some(q => q.app));
  // #4 at 12 in bottom on 12 ft bays: f_ss > 36 ksi
  const P2 = hand({ barBot: 0.2, sBot: 12 }); P2.xs.bays = P2.xs.bays.map(() => 12); const q = DK.calc(P2).crack.cases.find(x => x.key === 'crp1');
  assert.ok(q.fss > 36, String(q.fss)); assert.equal(q.ok, false); assert.ok(q.rF > 1);
});

test('steps: every check links to a step with its ratio; every step is in a topic; TeX-free labels; references cite the 10th Edition', () => {
  const R = DK.calc(hand({ barLongTop: 0.2, sLongTop: 12, barLongBot: 0.31, sLongBot: 9 }));
  assert.deepEqual([...R.checks.map(c => c.id)], ['DK1', 'DK2', 'DK3', 'DK4', 'DK5', 'DK6']);
  R.checks.forEach(c => { const s = R.steps.find(q => q.id === c.step); assert.ok(s, c.step); if (c.id !== 'DK6' || c.r > 0) assert.ok(Object.is(s.value, c.r), c.id); assert.match(c.ref, /^AASHTO LRFD 10th Ed\. /);
    if (c.Mu == null) { assert.ok(c.dem && c.cap, c.id); assert.ok(isFinite(c.dem.v) && isFinite(c.cap.v)); } });
  const G = W.SharedSteps.group(R.steps, DK.topics(DK.metaOf(R.steps)), { strip: /^dk\./ });
  assert.ok(!G.some(g => g.key === 'other'), 'every step in a topic'); assert.equal(G.reduce((a, g) => a + g.steps.length, 0), R.steps.length);
  R.steps.forEach(s => { if (/AASHTO/.test(s.ref)) assert.match(s.ref, /^AASHTO LRFD 10th Ed\. /); });
  assert.equal(new Set(R.steps.map(s => s.id)).size, R.steps.length, 'unique step ids');
});

// the Summary card and the report
const FILES = ['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'report.js', 'deck.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/proportions.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'engine/rating.js', 'ui/flexure.js', 'ui/loads.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/rating.js', 'ui/splices.js', 'ui/constructibility.js', 'engine/welds.js', 'ui/welds.js',
  'engine/deck.js', 'engine/sheets.js', 'ui/deflection.js', 'report/data.js', 'report/builders.js', 'report/summary.js', 'ui/nomen.js', 'ui/deck.js'].map(E));
test('Summary card: DK4 to DK6 show their demand and limit (before: —); report: DK5 / DK6 tables, every link resolves', () => {
  const WR = loadShared(...FILES), RB = WR.SBDReportBuild, SM = WR.SBDSummary;
  const P = WR.SBDModel.defaultProject(); P.project.name = 'Made-up Creek Bridge'; P.deckDesign = { on: true, sTop: 5, barLongTop: 0.2, sLongTop: 12, barLongBot: 0.31, sLongBot: 9 };
  const d = SM.deckOf(P); assert.deepEqual([...d.cells.map(q => q.id)], ['DK1', 'DK2', 'DK3', 'DK4', 'DK5', 'DK6']);
  d.cells.slice(3).forEach(q => assert.ok(q.dem && q.cap, q.id));
  WR.document = { getElementById: () => true, head: { appendChild() {} }, createElement: () => ({}) };
  const card = WR.SBDDeckUI.summaryCard(d, true), rows = card.split('<tr>').slice(2);
  assert.equal(rows.length, 6); rows.slice(3).forEach((r, i) => assert.ok(!/<td>—<\/td>/.test(r), `row ${i + 4}: ${r}`));
  assert.match(rows[3], /A<sub>s,d<\/sub> 0\.415/); assert.match(rows[4], /s<sub>max<\/sub>|A<sub>s<\/sub>/); assert.match(rows[5], /s<sub>max<\/sub>|0\.60 f<sub>y<\/sub>/);
  const B = WR.SBDReportData.compute(P, 0, { src: 'analysis', want: { dk: true, loads: true, proj: true } });
  for (const detail of ['gov', 'all']) { const Mx = RB.model(B, { detail }), doc = WR.SharedReport.build(Mx), txt = WR.SharedReport.text(doc);
    assert.deepEqual(J(doc.unresolved), [], detail + ': unresolved'); assert.deepEqual(J(doc.dup), [], detail + ': duplicate keys'); assert.ok(!/NaN|undefined|\[object|§\?/.test(txt), detail + ': text clean');
    assert.ok(txt.includes('DK5 Shrinkage and temperature reinforcement (Art. 5.10.6)') && txt.includes('DK6 Crack control of the transverse bars (Art. 5.6.7, Service I)'));
    const s = Mx.sections.find(q => q.id === 'dk'); assert.deepEqual([...s.subs.map(q => q.id)], ['gov', 'in', 'bay', 'oh', 'dist', 'ts', 'cr', 'steps']); }
  // a longitudinal set not entered: "Not checked: bars not entered" in the DK5 table
  const P2 = WR.SBDModel.defaultProject(); P2.deckDesign = { on: true }; const M2 = RB.model(WR.SBDReportData.compute(P2, 0, { src: 'analysis', want: { dk: true } }), { detail: 'gov' });
  assert.ok(JSON.stringify(M2.sections.find(q => q.id === 'dk').subs.find(q => q.id === 'ts')).includes('Not checked: bars not entered'));
});
