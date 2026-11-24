// shared/deck.js (window.SharedDeck): the deck slab strip design. Created 2026-11-23. Hand checks on made-up decks (no project data):
// every expected number below was worked by hand from the inputs (the arithmetic is written out), not taken from the code.
// AASHTO LRFD 10th Ed. (2024): 4.6.2.1, 4.6.2.1.6, Table A4-1, Table 3.4.1-1, 5.6.3.2, 5.5.4.2, 3.6.1.3.1, Table 4.6.2.1.3-1, 9.7.3.2.
import assert from 'node:assert/strict';
import { loadShared, test } from './harness.mjs';

const W = loadShared('units.js', 'steps.js', 'deck.js'), SD = W.SharedDeck;
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs hand ${b}`);

test('hand check 1, interior bay: S = 8.5 ft, 8 in slab, b_f = 14 in, #5 at 7 bottom, #5 at 6 top', () => {
  // design section: steel I-girder b_f/4 = 14/4 = 3.5 in
  const x = SD.designSection('steel', 14).x; assert.equal(x, 3.5);
  // w_DC = 8/12 (0.150) = 0.1000 ksf; w_DW = 0.030 ksf
  const I = SD.interior({ S: 8.5, wDC: 8 / 12 * 0.150, wDW: 0.030, xneg: x });
  near(I.MDC_pos, 0.656818, 1e-6, 'M_DC+ = 0.1(8.5)^2/11');     // 7.225/11
  near(I.MDW_pos, 0.197045, 1e-6, 'M_DW+ = 0.03(72.25)/11');
  near(I.MDC_neg, 0.7225, 1e-9, 'M_DC- = 0.1(72.25)/10');
  near(I.MDW_neg, 0.21675, 1e-9, 'M_DW- = 0.03(72.25)/10');
  // Table A4-1, row S = 8.5 ft: +M 5.99; -M 5.82 at 3 in and 4.98 at 6 in -> at 3.5 in: 5.82 + (4.98 - 5.82)(0.5/3) = 5.68
  near(I.MLL_pos, 5.99, 1e-12, 'M_LL+'); near(I.MLL_neg, 5.68, 1e-9, 'M_LL-');
  // Strength I: 1.25(0.656818) + 1.50(0.197045) + 1.75(5.99) = 0.821023 + 0.295568 + 10.4825 = 11.599091
  near(I.Mu_pos, 11.599091, 2e-6, 'M_u+');
  // 1.25(0.7225) + 1.50(0.21675) + 1.75(5.68) = 0.903125 + 0.325125 + 9.94 = 11.16825
  near(I.Mu_neg, 11.16825, 1e-9, 'M_u-');
  // bottom bars #5 (0.31 in^2) at 7 in, cover 1.0 in, f'c 4, fy 60:
  //   A_s = 12(0.31)/7 = 0.531429; d_b = sqrt(4(0.31)/pi) = 0.628255; d = 8 - 1 - 0.314127 = 6.685873
  //   a = 0.531429(60)/(0.85(4)(12)) = 31.88571/40.8 = 0.781513; c = a/0.85 = 0.919427
  //   eps_t = 0.003(6.685873/0.919427 - 1) = 0.018815 > 0.005 -> phi = 0.90
  //   M_n = 31.88571(6.685873 - 0.390757)/12 = 16.72703; phi M_n = 15.05433; ratio = 11.599091/15.05433 = 0.77048
  const p = SD.capacity({ barA: 0.31, sp: 7, cover: 1.0, ts: 8, fc: 4, fy: 60, Mu: I.Mu_pos });
  near(p.As, 0.531429, 1e-6, 'A_s'); near(p.dbar, 0.628255, 1e-5, 'd_b'); near(p.dEff, 6.685873, 1e-5, 'd'); near(p.a, 0.781513, 1e-6, 'a'); near(p.c, 0.919427, 1e-6, 'c');
  near(p.et, 0.018815, 2e-6, 'eps_t'); assert.equal(p.phi, 0.9); near(p.Mn, 16.72703, 2e-4, 'M_n'); near(p.phiMn, 15.05433, 2e-4, 'phi M_n'); near(p.dc, 0.77048, 2e-5, 'ratio +'); assert.equal(p.ok, true);
  // top bars #5 at 6 in, cover 2.5 in: A_s = 0.62; d = 8 - 2.5 - 0.314127 = 5.185873; a = 37.2/40.8 = 0.911765; c = 1.072665
  //   eps_t = 0.003(5.185873/1.072665 - 1) = 0.011504 -> phi 0.90; M_n = 37.2(5.185873 - 0.455882)/12 = 14.66297; phi M_n = 13.19667
  //   ratio = 11.16825/13.19667 = 0.84629
  const n = SD.capacity({ barA: 0.31, sp: 6, cover: 2.5, ts: 8, fc: 4, fy: 60, Mu: I.Mu_neg });
  near(n.As, 0.62, 1e-12, 'A_s'); near(n.dEff, 5.185873, 1e-5, 'd'); near(n.a, 0.911765, 1e-6, 'a'); near(n.et, 0.011504, 2e-6, 'eps_t'); assert.equal(n.phi, 0.9);
  near(n.Mn, 14.66297, 2e-4, 'M_n'); near(n.phiMn, 13.19667, 2e-4, 'phi M_n'); near(n.dc, 0.84629, 2e-5, 'ratio -');
  // distribution: 220/sqrt(8.5) = 75.46 -> 67 %
  assert.equal(SD.distPct(8.5), 67); near(SD.distPct(12), 63.5085, 1e-4, '220/sqrt(12)');
});

test('hand check 2, overhang: o_h = 3.5 ft, 18 in barrier of 0.45 klf, 9 in dead-load slab, #5 at 5 top in an 8.5 in slab', () => {
  // w_DC = 9/12 (0.150) = 0.1125 ksf; X = 3.5 - 1.5 - 1.0 = 1.0 ft; strip = 45 + 10(1.0) = 55 in
  // M_DC = 0.1125(3.5)^2/2 + 0.45(3.5 - 0.75) = 0.689063 + 1.2375 = 1.926563
  // M_DW = 0.025(3.5 - 1.5)^2/2 = 0.05
  // M_LL = 1.33(1.20)(16)(1.0)/(55/12) = 25.536/4.583333 = 5.571491
  // M_u = 1.25(1.926563) + 1.50(0.05) + 1.75(5.571491) = 2.408203 + 0.075 + 9.750109 = 12.233312
  const O = SD.overhang({ oh: 3.5, face: 1.5, wSlab: 9 / 12 * 0.150, DC: [{ w: 0.45, x: 0.75 }], DW: [{ q: 0.025, x0: 1.5, x1: 3.5 }] });
  assert.equal(O.Xoh, 1); assert.equal(O.SWoh, 55);
  near(O.MohDC, 1.926563, 1e-6, 'M_DC'); near(O.MohDW, 0.05, 1e-12, 'M_DW'); near(O.MohLL, 5.571491, 1e-6, 'M_LL'); near(O.Mu_oh, 12.233312, 3e-6, 'M_u');
  // top #5 at 5: A_s = 0.744; d = 8.5 - 2.5 - 0.314127 = 5.685873; a = 44.64/40.8 = 1.094118; c = 1.287197
  // eps_t = 0.003(5.685873/1.287197 - 1) = 0.010252 -> 0.90; M_n = 44.64(5.685873 - 0.547059)/12 = 19.11639; phi M_n = 17.20475; ratio 0.71104
  const c = SD.capacity({ barA: 0.31, sp: 5, cover: 2.5, ts: 8.5, fc: 4, fy: 60, Mu: O.Mu_oh });
  near(c.Mn, 19.11639, 2e-4, 'M_n'); near(c.phiMn, 17.20475, 2e-4, 'phi M_n'); near(c.dc, 0.71104, 2e-5, 'ratio');
});

test('hand check 3, overhang with a sidewalk and pedestrians, owner eta 1.05 and m 1.2', () => {
  // o_h 4 ft; slab 0.10625 ksf: 0.10625(16)/2 = 0.85; barrier 0.4 klf at 0.75 ft: 0.4(3.25) = 1.3;
  // sidewalk slab 0.1125 ksf from 0 to 5 ft (4 ft of it on the overhang): 0.1125(4^2 - 0)/2 = 0.9  -> M_DC = 3.05
  // wearing surface starts at 5 ft (inside the girder): 0
  // wheel: face 1.5 ft, X = 4 - 1.5 - 1 = 1.5 ft, strip 60 in: 25.536(1.5)/5 = 7.6608
  // pedestrians 0.075 ksf from 1.5 to 5 ft: 0.075(2.5^2 - 0)/2 = 0.234375
  // M_u = 1.05[1.25(3.05) + 0 + 1.75(1.2(7.6608) + 0.234375)] = 1.05[3.8125 + 1.75(9.427335)] = 1.05(20.310336) = 21.325853
  const O = SD.overhang({ oh: 4, face: 1.5, wSlab: 0.10625, DC: [{ w: 0.4, x: 0.75 }, { q: 0.1125, x0: 0, x1: 5 }], DW: [{ q: 0.025, x0: 5, x1: 40 }], PL: [{ q: 0.075, x0: 1.5, x1: 5 }], eta: 1.05, mLL: 1.2 });
  near(O.MohDC, 3.05, 1e-12, 'M_DC'); assert.equal(O.MohDW, 0); near(O.MohLL, 7.6608, 1e-9, 'M_LL'); near(O.MohPL, 0.234375, 1e-12, 'M_PL'); near(O.Mu_oh, 21.325853, 2e-6, 'M_u');
  // a load in a strip that ends before the support: 0.2 ksf from 0.5 to 1.5 ft, o_h 4: 0.2(1.0)(4 - 1.0) = 0.6 = 0.2(3.5^2 - 2.5^2)/2
  near(SD.overhang({ oh: 4, face: 0, wSlab: 0, DC: [{ q: 0.2, x0: 0.5, x1: 1.5 }] }).MohDC, 0.6, 1e-12, 'partial strip');
});

test('phi between compression- and tension-controlled; beta_1 limits; zero spacing', () => {
  // eps_t = 0.0035 -> phi = 0.75 + 0.15(0.0015/0.003) = 0.825
  const c = SD.capacity({ barA: 1.0, sp: 8, cover: 2, ts: 7, fc: 4, fy: 60, Mu: 10 });
  const phi = 0.75 + 0.15 * (c.et - 0.002) / 0.003; assert.ok(c.et > 0.002 && c.et < 0.005, String(c.et)); near(c.phi, phi, 1e-12, 'phi');
  assert.equal(SD.capacity({ barA: 0.31, sp: 6, cover: 1, ts: 8, fc: 10, fy: 60, Mu: 1 }).b1, 0.65);
  assert.equal(SD.capacity({ barA: 0.31, sp: 6, cover: 1, ts: 8, fc: 3, fy: 60, Mu: 1 }).b1, 0.85);
  const z = SD.capacity({ barA: 0.31, sp: 0, cover: 1, ts: 8, fc: 4, fy: 60, Mu: 5 }); assert.equal(z.As, 0); assert.equal(z.ok, false);
});

test('design section rules (4.6.2.1.6) and the table range flags', () => {
  assert.equal(SD.designSection('steel', 16).x, 4); assert.equal(SD.designSection('steel', 120).x, 24); assert.equal(SD.designSection('steel', 0).x, 0);
  assert.equal(SD.designSection('precast', 42).x, 14); assert.equal(SD.designSection('precast', 60).x, 15); assert.equal(SD.designSection('box', 36).x, 18);
  assert.equal(SD.tableA4(3.9, 0).below, true); assert.equal(SD.tableA4(15.1, 0).above, true); assert.equal(SD.tableA4(9, 25).xClamped, true); assert.equal(SD.tableA4(9, 0).outOfRange, false);
  // interpolation on S: 9.6 ft between 9.50 (6.59) and 9.75 (6.74): 6.59 + 0.15(0.4) = 6.65
  near(SD.tableA4(9.6, 0).Mpos, 6.65, 1e-9, 'M+ at 9.6 ft');
});

test('worked steps: every step value is the result value; the steps of strip() cover every check', () => {
  const St = W.SharedSteps, R = SD.strip({ S: 9.5, ts: 8, tsLoad: 8.5, fc: 4, fy: 60, wc: 0.15, wsFut: 0.025, xneg: 4, barTop: 0.31, sTop: 6, coverT: 2.5, barBot: 0.31, sBot: 8, coverB: 1, oh: 3.25, bBar: 18, wBar: 0.4, eta: 1.05, mLL: 1.2 });
  const w = St.work('dk');
  SD.steps.interior(w, R.interior, { tL: 8.5, wc: 0.15, xs: { kind: 'steel', b: 16 } });
  SD.steps.capacity(w, 'pos', 'Positive moment, bottom bars', R.pos); SD.steps.capacity(w, 'neg', 'Negative moment, top bars', R.neg);
  SD.steps.overhang(w, R.overhang); SD.steps.capacity(w, 'oh', 'Overhang, top bars', R.ohCap, { short: true });
  SD.steps.dist(w, 9.5, R.distPct, { As: R.pos.As });
  const v = id => w.steps.find(s => s.id === 'dk.' + id).value;
  [['wDC', R.wDLslab], ['MDCp', R.MDC_pos], ['MDWn', R.MDW_neg], ['xneg', 4], ['MLLp', R.MLL_pos], ['MLLn', R.MLL_neg], ['Mup', R.Mu_pos], ['Mun', R.Mu_neg], ['pos.As', R.pos.As], ['pos.d', R.pos.dEff], ['pos.phiMn', R.pos.phiMn], ['pos.r', R.pos.dc],
    ['neg.Mn', R.neg.Mn], ['neg.r', R.neg.dc], ['X', R.Xoh], ['SWoh', R.SWoh], ['MohDC', R.MohDC], ['MohDW', R.MohDW], ['MohLL', R.MohLL], ['Muoh', R.Mu_oh], ['oh.r', R.ohCap.dc], ['dist', R.distPct]].forEach(([id, x]) => assert.ok(Object.is(v(id), x), id));
  assert.ok(w.steps.find(s => s.id === 'dk.Mup').eq.includes('\\eta'), 'eta shown when the owner has one');
  assert.equal(new Set(w.steps.map(s => s.id)).size, w.steps.length, 'unique ids');
  w.steps.forEach(s => { assert.ok(St.line(s, false).length > 3); if (/^AASHTO/.test(s.ref)) assert.ok(s.ref.startsWith('AASHTO LRFD 10th Ed. '), s.ref); });
});

// DD (2026-11-24, engineer request "Please fix the deck distribution steel"): the distribution reinforcement of AASHTO LRFD 10th Ed. Art. 9.7.3.2
// on S = the effective span length of Art. 9.7.2.3 (slab on girders: the distance between the flange tips plus one flange overhang, flange tip
// to the face of the web): S_eff = S - b_f/12 + (b_f - t_w)/24 ft. Before: S = the girder spacing. Hand checks (fixlog/shared-deck.md DD).
test('DD hand checks: the effective span of 9.7.2.3 and the percentage of 9.7.3.2', () => {
  // the 67 % limit: 220/sqrt(S) = 67 at S = (220/67)^2 = 10.7819 ft; a girder spacing up to that gives 67 % before and after
  near(SD.SCAP, 10.781911, 1e-6, '(220/67)^2'); assert.equal(SD.distPct(SD.SCAP - 1e-9), 67); assert.ok(SD.distPct(SD.SCAP + 1e-6) < 67);
  // (a) S = 9 ft. W36X135 (b_f 12.0 in, t_w 0.600 in): 9 - 12/12 + (12 - 0.6)/24 = 8 + 0.475 = 8.475 ft; 220/sqrt(8.475) = 75.57 -> 67 %
  let r = SD.distEff({ S: 9, bf: 12, tw: 0.6 }); near(r.clear, 8, 1e-12); near(r.ohF, 0.475, 1e-12); near(r.Seff, 8.475, 1e-12);
  assert.equal(r.pct, 67); assert.equal(r.pct0, 67); assert.equal(r.capped, true); assert.equal(r.why, '');
  //     plate girder b_f 16 in, t_w 0.5625 in: 9 - 1.33333 + 15.4375/24 = 7.66667 + 0.64323 = 8.30990 ft -> 67 % (before 220/sqrt(9) = 73.3 -> 67 %)
  r = SD.distEff({ S: 9, bf: 16, tw: 0.5625 }); near(r.Seff, 8.309896, 1e-6); assert.equal(r.pct, 67); assert.equal(r.pct0, 67);
  // (b) plate girder S = 12 ft, b_f 18 in, t_w 0.5625 in: clear 12 - 1.5 = 10.5 ft; overhang (18 - 0.5625)/24 = 0.7265625 ft;
  //     S_eff = 11.2265625 ft; 220/sqrt(11.2265625) = 220/3.350606 = 65.660 % (before 220/sqrt(12) = 220/3.464102 = 63.509 %)
  //     with #5 at 6 in bottom (A_s 0.620 in^2/ft): A_s,d = 0.6566(0.620) = 0.4071 in^2/ft (before 0.6351(0.620) = 0.3938)
  r = SD.distEff({ S: 12, bf: 18, tw: 0.5625 }); assert.equal(r.Seff, 11.2265625); near(r.pct, 65.65976, 1e-5, 'after'); near(r.pct0, 63.50853, 1e-5, 'before');
  near(r.pct / 100 * 0.62, 0.407091, 1e-6, 'A_s,d after'); near(r.pct0 / 100 * 0.62, 0.393753, 1e-6, 'A_s,d before'); assert.equal(r.capped, false);
  // (c) the Prestressed PCI BT-72 at S = 12 ft (b_tf 42 in, b_w 6 in): 12 - 3.5 + 36/24 = 10.0 ft; 220/sqrt(10) = 69.57 -> 67 % (before 63.509 %)
  r = SD.distEff({ S: 12, bf: 42, tw: 6 }); assert.equal(r.Seff, 10); assert.equal(r.pct, 67); near(r.pct0, 63.50853, 1e-5);
  // no geometry, or a web wider than the flange, or S_eff not positive: the 67 % upper limit (conservative)
  [{ S: 12 }, { S: 12, bf: 0, tw: 0.5 }, { S: 12, bf: 10, tw: 12 }, { S: 12, bf: NaN, tw: NaN }].forEach(o => { const q = SD.distEff(o); assert.equal(q.ok, false); assert.equal(q.why, 'geometry'); assert.equal(q.pct, 67); });
  r = SD.distEff({ S: 1, bf: 30, tw: 1 }); assert.equal(r.ok, true); assert.ok(r.Seff < 0); assert.equal(r.why, 'nonpositive'); assert.equal(r.pct, 67);
  // never smaller than before: S_eff <= S
  for (let S = 4; S <= 16; S += 0.37) for (const [bf, tw] of [[12, 0.5], [18, 0.5625], [24, 0.75], [42, 6], [48, 7]]) { const q = SD.distEff({ S, bf, tw }); assert.ok(q.pct >= q.pct0, `${S} ${bf}`); }
});

test('DD worked steps: S_eff (equation, values, result), then the percentage on S_eff, then A_s,d; the old form without eff', () => {
  const St = W.SharedSteps, w = St.work('dk'), E = SD.distEff({ S: 12, bf: 18, tw: 0.5625 });
  SD.steps.dist(w, 12, E.pct, { As: 0.62, eff: E });
  assert.deepEqual([...w.steps.map(s => s.id)], ['dk.distSe', 'dk.dist', 'dk.distAs']);
  const [a, b, c] = w.steps;
  assert.equal(a.sym, 'S_{eff}'); assert.equal(a.value, 11.2265625); assert.match(a.sub, /^12\.000 - \\frac\{18\.000\}\{12\} \+ \\frac\{18\.000 - 0\.5625\}\{24\}$/); assert.match(a.ref, /9\.7\.2\.3/);
  assert.match(b.eq, /S_\{eff\}/); assert.match(b.sub, /11\.227/); assert.ok(Object.is(b.value, E.pct)); assert.ok(Object.is(c.value, E.pct / 100 * 0.62));
  const w2 = St.work('dk'); SD.steps.dist(w2, 12, 67, { As: 0.62, eff: SD.distEff({ S: 12 }) });
  assert.deepEqual([...w2.steps.map(s => s.id)], ['dk.dist', 'dk.distAs']); assert.equal(w2.steps[0].eq, '67'); assert.match(w2.steps[0].note, /67 %/);
  const w3 = St.work('dk'); SD.steps.dist(w3, 12, SD.distPct(12), { As: 0.62 }); assert.deepEqual([...w3.steps.map(s => s.id)], ['dk.dist', 'dk.distAs']); assert.match(w3.steps[0].sub, /\\sqrt\{12\.000\}/);
});
