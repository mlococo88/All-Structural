// apps/steel-bridge/engine/sections.js against GirderDetail's own Girder section module (GM.gs.compute in
// "Steel Bridge Design.html", run in a vm by gd-source.mjs with the declarations it reads; nothing else of the page).
//
// Parity cases: every zone (plate segment) of the 100 tests/projects/st/gd_*.json hand-off payloads, each as a
// positive-flexure and a negative-flexure Girder section row, with the deck rebar excluded from and included in the
// positive plastic moment; plus GirderDetail's built-in Girder section rows (GM.gs.def), as is and with HPS70W flanges
// on a grade 50 web (hybrid, so R_h is exercised; every payload is homogeneous grade 50).
// How a payload becomes a row: GirderDetail's Structural analysis builds the payload zones from its plates (saSec) and
// the deck of the payload is GirderDetail's (deck.ts, haunch, beff, Ar "at deck mid-depth", materials.fc, wc, n). The
// row gets the zone's plates and beff; the module inputs get ts, haunch, f'c, w_c, K1 = 1 (n exact = the payload's n),
// and the reinforcement A_r as one layer at mid-depth of the slab (Art = A_r, crt = t_s/2; Arb = 0).
// Compared, for each row: A, ȳ, I of steel, 3n, n and steel + rebar; S top and bottom of steel (I/(d − ȳ), I/ȳ, as the
// section table); d, D_t, the slab and rebar heights; the plastic moment, PNA, D6.1 case and Ȳ, D_cp, D_p; the bisection
// cross-check; D_c (negative flexure) and on the steel section; R_h. Expected: identical (the port keeps GirderDetail's
// operations in the same order); any difference is reported with the row.
//
// Hand checks (arithmetic in the comments): a doubly symmetric steel-only I, and a composite section with n = 8.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { gdGirderSection } from './gd-source.mjs';

const ENGINE = path.join(ROOT, 'apps/steel-bridge/engine/sections.js');
const W = loadShared('units.js', 'steps.js', ENGINE), SEC = W.SBDSections, STEPS = W.SharedSteps;
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`);

/* ---------- parity ---------- */
const payloads = fs.readdirSync(path.join(ROOT, 'tests/projects/st')).filter(f => /^gd_.*\.json$/.test(f)).sort();

function gdModule(GS, over, rows) { return { ...JSON.parse(JSON.stringify(GS.ctx.GM.gs.def)), ...over, rows }; }
function casesFromPayload(GS, f) {
  const p = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/projects/st', f), 'utf8')).payload, g = p.girderDetail, m = g.materials, dk = g.deck;
  const rows = [];
  p.section.zones.forEach((z, k) => ['pos', 'neg'].forEach(region => rows.push({ ...GS.ctx.GM.gs.def.rows[region === 'pos' ? 0 : 1], name: `${f} zone ${k + 1} ${region}`, region,
    beff: dk.beff, D: z.web.depth, tw: z.web.thickness, topB: z.topFlange.width, topT: z.topFlange.thickness, botB: z.botFlange.width, botT: z.botFlange.thickness })));
  const base = { gT: m.gradeFlange, gB: m.gradeFlange, gW: m.gradeWeb, fc: m.fc, wc: m.wc, K1: 1, nRule: 'exact', ts: dk.ts, tdeck: dk.ts, hh: dk.haunch, Art: dk.Ar, crt: dk.ts / 2, Arb: 0, crb: dk.ts / 2 };
  return [{ name: f, p: gdModule(GS, { ...base, rebarMp: 'excl' }, rows), nPayload: m.n }, { name: f + ' (rebar in +Mp)', p: gdModule(GS, { ...base, rebarMp: 'incl' }, rows) }];
}
function builtinCases(GS) {
  const d = JSON.parse(JSON.stringify(GS.ctx.GM.gs.def));
  return [{ name: 'GirderDetail built-in rows', p: d }, { name: 'built-in rows, rebar in +Mp', p: { ...d, rebarMp: 'incl' } },
    { name: 'built-in rows, HPS70W flanges / 50W web (hybrid)', p: { ...d, gT: 'HPS70W', gB: 'HPS70W' } },
    { name: 'built-in rows, nRule round', p: { ...d, nRule: 'round' } }];
}

// the new engine on one GirderDetail row and module input p
function ours(r, p, GD_GR) {
  const plates = { D: r.D, tw: r.tw, topB: r.topB, topT: r.topT, botB: r.botB, botT: r.botT };
  const deck = { ts: +p.ts, haunch: +p.hh, beff: r.beff, rebar: { top: { A: +p.Art, c: +p.crt }, bot: { A: +p.Arb, c: +p.crb } } };
  const mat = { Fyt: GD_GR[p.gT].Fy, Fyb: GD_GR[p.gB].Fy, Fyw: GD_GR[p.gW].Fy, Fyr: +p.Fyr, fc: +p.fc };
  const n = SEC.modularRatio(+p.fc, +p.wc, +p.K1, p.nRule).n;
  return { n, c: SEC.card(plates, deck, mat, n, { region: r.region, rebarInPositive: p.rebarMp === 'incl' }) };
}
// pairs [name, ours, GirderDetail's] for one row
function pairs(o, r) {
  const c = o.c, out = [], P = (k, a, b) => out.push([k, a, b]);
  for (const [k, gd] of [['s', r.s], ['c3', r.c3], ['cn', r.cn], ['cr', r.cr]]) {
    const q = c[k]; P(`${k}.A`, q.A, gd.A); P(`${k}.yb`, q.yb, gd.yb); P(`${k}.I`, q.I, gd.I);
    P(`${k}.Stop`, q.St, gd.I / (r.d - gd.yb)); P(`${k}.Sbot`, q.Sb, gd.I / gd.yb);
  }
  P('d', c.s.d, r.d); P('Dt', c.Dt, r.Dt); P('ySlab', c.cn.ySlab, r.ySl); P('yRt', c.cr.yRt, r.yRt); P('yRb', c.cr.yRb, r.yRb);
  P('Mp', c.pl.Mp, r.pl.Mp); P('yp', c.pl.yp, r.pl.yp); P('Dcp', c.Dcp, r.Dcp);
  P('d61.case', c.pl.d61.cs, r.d61.cs); P('d61.Yb', c.pl.d61.Yb, r.d61.Yb); P('d61.Mp', c.pl.d61.Mp, r.d61.Mp); P('d61.Dcp', c.pl.d61.Dcp, r.d61.Dcp);
  P('d61.out', !!c.pl.d61.out, !!r.d61.out); P('d61.below', !!c.pl.d61.below, !!r.d61.below);
  for (const k of ['s', 'rt', 'rb', 'c', 'w', 't']) if (k in r.d61.P) P(`P_${k}`, c.pl.d61.P[k], r.d61.P[k]);
  P('num.yp', c.pl.num.yp, r.plNum.yp); P('num.Mp', c.pl.num.Mp, r.plNum.Mp); P('num.C', c.pl.num.C, r.plNum.C); P('num.T', c.pl.num.T, r.plNum.T);
  if (r.pos) P('Dp', c.Dp, r.Dp); else P('Dc', c.Dc, r.Dc);
  P('DcSteel (deck placement)', r.con.up ? c.DcSteel.top : c.DcSteel.bot, r.DcC);
  P('Rh', c.Rh, r.Rh); P('Rh steel', c.RhSteel, r.RhC);
  return out;
}

test('parity with GirderDetail Girder section: 100 gd_*.json payloads + built-in rows; identical', () => {
  const GS = gdGirderSection(), GD_GR = GS.fn('GD_GR');
  const cases = [...payloads.flatMap(f => casesFromPayload(GS, f)), ...builtinCases(GS)];
  let nRows = 0, nVals = 0, worst = { rel: 0 }; const diffs = [];
  for (const cs of cases) {
    const R = GS.compute(cs.p, { base: true });
    assert.deepEqual([...R.errors], [], `${cs.name}: GirderDetail input errors`);
    if (cs.nPayload != null) { const n = SEC.modularRatio(+cs.p.fc, +cs.p.wc, 1, 'exact').n; assert.ok(Math.abs(n - cs.nPayload) < 5e-5, `${cs.name}: n ${n} vs payload ${cs.nPayload}`); }
    R.rows.forEach(r => {
      nRows++; const o = ours(r, cs.p, GD_GR);
      assert.equal(o.n, R.n !== undefined ? R.n : o.n);
      for (const [k, a, b] of pairs(o, r)) {
        nVals++;
        if (Object.is(a, b)) continue;
        const rel = typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) / Math.max(1e-300, Math.abs(b)) : Infinity;
        diffs.push(`${r.name || cs.name} [${cs.name}] ${k}: ${a} vs GirderDetail ${b}`);
        if (rel > worst.rel) worst = { rel, what: `${r.name} ${k}` };
      }
    });
  }
  console.log(`       ${cases.length} module inputs, ${nRows} rows, ${nVals} values compared; ${diffs.length} differ; largest relative difference ${worst.rel ? worst.rel.toExponential(2) + ' (' + worst.what + ')' : '0 (all identical)'}`);
  diffs.slice(0, 20).forEach(s => console.log('       ' + s));
  assert.equal(diffs.length, 0, 'differences from GirderDetail (listed above)');
  assert.ok(nRows >= 2 * 900);
});

/* ---------- hand checks ---------- */
test('hand check 1: doubly symmetric steel I, 16 × 1 flanges, 60 × 1/2 web, F_y = 50 ksi', () => {
  const p = { D: 60, tw: 0.5, topB: 16, topT: 1, botB: 16, botT: 1 };
  const s = SEC.steel(p);
  // d = 1 + 60 + 1 = 62 in
  // A = 16(1) + 60(0.5) + 16(1) = 16 + 30 + 16 = 62 in²
  // ȳ = [16(0.5) + 30(31) + 16(61.5)] / 62 = (8 + 930 + 984) / 62 = 1922 / 62 = 31.000 in (mid-depth, symmetric)
  // I = web 0.5(60)³/12 = 9000 + flanges 2[16(1)³/12 + 16(31 − 0.5)²] = 2[1.3333 + 16(930.25)] = 2(14885.333) = 29770.667
  //   = 38,770.667 in⁴
  // S_top = S_bot = 38770.667 / 31 = 1250.667 in³
  assert.equal(s.d, 62); assert.equal(s.A, 62); close(s.yb, 31, 1e-12, 'ȳ');
  close(s.I, 38770.666667, 1e-9, 'I'); close(s.St, 1250.666667, 1e-9, 'S top'); close(s.Sb, 1250.666667, 1e-9, 'S bot');
  // Plastic moment, Table D6.1-2 (no deck rebar, steel only; bottom in compression), all F_y = 50 ksi:
  // P_c = P_t = 50(16)(1) = 800 kip, P_w = 50(60)(0.5) = 1500 kip; Case I: P_c + P_w = 2300 ≥ P_t = 800
  // Ȳ = D/2 [(P_c − P_t)/P_w + 1] = 30 [(800 − 800)/1500 + 1] = 30 in from the top of the web -> y_p = 1 + 60 − 30 = 31 in
  // M_p = P_w/(2D)[Ȳ² + (D − Ȳ)²] + P_t d_t + P_c d_c = 1500/120 (900 + 900) + 800(30.5) + 800(30.5)
  //     = 22,500 + 24,400 + 24,400 = 71,300 kip-in = 5941.667 kip-ft   (check: Z = 2(16)(30.5) + 0.5(60)²/4 = 1426 in³; 50 Z = 71,300)
  // D_cp = D − Ȳ = 30 in
  const deck = { ts: 8, haunch: 2, beff: 96, rebar: { top: { A: 0, c: 2.5 }, bot: { A: 0, c: 1.75 } } }, mat = { Fyt: 50, Fyb: 50, Fyw: 50, Fyr: 60, fc: 4 };
  const pl = SEC.plastic(p, deck, mat, { region: 'neg' });
  assert.equal(pl.cs, 'I'); close(pl.Yb, 30, 1e-12, 'Ȳ'); close(pl.yp, 31, 1e-12, 'y_p'); close(pl.Mp, 5941.666667, 1e-9, 'Mp'); close(pl.Dcp, 30, 1e-12, 'D_cp');
  close(pl.num.Mp, pl.Mp, 1e-9, 'bisection Mp');
  // no deck, positive flexure (noncomposite): by bisection, the same 5941.667 kip-ft, D_cp = 30 in
  const pn = SEC.plastic(p, { ...deck, beff: 0 }, mat, { region: 'pos' });
  close(pn.Mp, 5941.666667, 1e-9, 'Mp (pos, no deck)'); close(pn.Dcp, 30, 1e-9, 'D_cp (pos, no deck)');
  // D_c, steel section: (d − t_t) − ȳ = 61 − 31 = 30 in (top flange in compression) and ȳ − t_b = 30 in (bottom)
  close(SEC.dc(p, s, 'top').Dc, 30, 1e-12, 'Dc top'); close(SEC.dc(p, s, 'bot').Dc, 30, 1e-12, 'Dc bot');
  // the steps carry the work: the I step reads I = Σ(I0 + A(y − ȳ)²) = … = 38771 in⁴
  const st = s.steps.find(x => x.id === 'sec.s.I');
  assert.equal(STEPS.line(st, false).endsWith('= 38771 in^4'), true, STEPS.line(st, false));
  assert.match(st.ref, /AASHTO LRFD 10th Ed\./);
});

test('hand check 2: composite, same steel, b_eff 96 in, t_s 8 in, haunch 2 in, n = 8 (and 3n = 24)', () => {
  const p = { D: 60, tw: 0.5, topB: 16, topT: 1, botB: 16, botT: 1 }, deck = { ts: 8, haunch: 2, beff: 96, rebar: { top: { A: 0, c: 2.5 }, bot: { A: 0, c: 1.75 } } };
  const c = SEC.composite(p, deck, 8, 1);
  // A_d = b_eff t_s / n = 96(8)/8 = 96 in², at y_d = 62 + 2 + 8/2 = 68 in; slab own I0 = 96(8)³/12/8 = 512 in⁴
  // A = 62 + 96 = 158 in²
  // ȳ = [62(31) + 96(68)] / 158 = (1922 + 6528) / 158 = 8450 / 158 = 53.4810 in
  // I = 38,770.667 + 62(53.4810 − 31)² + 512 + 96(68 − 53.4810)²
  //   = 38,770.667 + 62(505.3958) + 512 + 96(210.8011) = 38,770.667 + 31,334.54 + 512 + 20,236.90 = 90,854.11 in⁴
  //   (exactly: the two parallel-axis terms sum to 62·96/158 (68 − 31)² = 37.67089·1369 = 51,571.44; I = 38,770.667 + 512 + 51,571.44 = 90,854.11)
  // S_top of steel = 90,854.11 / (62 − 53.4810) = 90,854.11 / 8.5190 = 10,664.8 in³; S_bot = 90,854.11 / 53.4810 = 1698.8 in³
  close(c.Ad, 96, 1e-12, 'A_d'); close(c.ySlab, 68, 1e-12, 'y_d'); close(c.A, 158, 1e-12, 'A');
  close(c.yb, 8450 / 158, 1e-12, 'ȳ'); close(c.I, 38770 + 2 / 3 + 512 + 62 * 96 / 158 * 37 ** 2, 1e-12, 'I');
  close(c.I, 90854.11, 1e-7, 'I (rounded)'); close(c.St, 10664.8, 1e-5, 'S top'); close(c.Sb, 1698.8, 1e-4, 'S bot');
  // long-term, 3n = 24: A_d = 96(8)/24 = 32 in², A = 94 in², ȳ = (1922 + 32·68)/94 = 4098/94 = 43.5957 in
  // I = 38,770.667 + 512/3 + 62·32/94 (37)² = 38,770.667 + 170.667 + 28,894.64 = 67,835.97 in⁴
  const c3 = SEC.composite(p, deck, 8, 3);
  close(c3.A, 94, 1e-12, 'A (3n)'); close(c3.yb, 4098 / 94, 1e-12, 'ȳ (3n)'); close(c3.I, 38770 + 2 / 3 + 512 / 3 + 62 * 32 / 94 * 37 ** 2, 1e-12, 'I (3n)');
  // Plastic moment, positive flexure, Table D6.1-1, f'c = 4 ksi, F_y = 50, rebar not counted:
  // P_s = 0.85(4)(96)(8) = 2611.2 kip; P_c = P_t = 800, P_w = 1500 kip
  // Case I: P_t + P_w = 2300 < P_c + P_s = 3411.2 -> no; Case II: P_t + P_w + P_c = 3100 ≥ P_s = 2611.2 -> PNA in the top flange
  // Ȳ = t_c/2 [(P_w + P_t − P_s)/P_c + 1] = 0.5 [(1500 + 800 − 2611.2)/800 + 1] = 0.5(0.611) = 0.3055 in below the top of the top flange
  // y_p = 62 − 0.3055 = 61.6945 in; arms: d_s = 68 − 61.6945 = 6.3055, d_w = 61.6945 − 31 = 30.6945, d_t = 61.6945 − 0.5 = 61.1945
  // M_p = P_c/(2t_c)[Ȳ² + (t_c − Ȳ)²] + P_s d_s + P_w d_w + P_t d_t
  //     = 400[0.09333 + 0.48233] + 2611.2(6.3055) + 1500(30.6945) + 800(61.1945)
  //     = 230.26 + 16,465.0 + 46,041.8 + 48,955.6 = 111,692.5 kip-in = 9307.7 kip-ft
  // D_cp = 0 (Case II), D_t = 62 + 2 + 8 = 72 in, D_p = 72 − 61.6945 = 10.3055 in
  const pl = SEC.plastic(p, deck, { Fyt: 50, Fyb: 50, Fyw: 50, Fyr: 60, fc: 4 }, { region: 'pos' });
  assert.equal(pl.cs, 'II'); close(pl.Yb, 0.3055, 1e-12, 'Ȳ'); close(pl.yp, 61.6945, 1e-12, 'y_p');
  const Mp = (400 * (0.3055 ** 2 + 0.6945 ** 2) + 2611.2 * 6.3055 + 1500 * 30.6945 + 800 * 61.1945) / 12;
  close(pl.Mp, Mp, 1e-12, 'Mp'); close(pl.Mp, 9307.7, 1e-5, 'Mp (rounded)');
  assert.equal(pl.Dcp, 0); close(pl.Dt, 72, 1e-12, 'D_t'); close(pl.Dp, 10.3055, 1e-12, 'D_p');
  assert.ok(pl.diff < 1e-9, 'bisection agrees');
});

test('steps: format and rendering', () => {
  const s = SEC.steel({ D: 60, tw: 0.5, topB: 16, topT: 1, botB: 16, botT: 1 });
  const ids = s.steps.map(x => x.id);
  assert.equal(new Set(ids).size, ids.length, 'ids unique');
  for (const x of s.steps) for (const k of ['id', 'label', 'sym', 'eq', 'sub', 'value', 'unit', 'd', 'ref', 'note']) assert.ok(k in x, `${x.id} has ${k}`);
  assert.equal(STEPS.toText('\\frac{I}{\\bar{y}}'), 'I/ȳ');
  assert.equal(STEPS.toHTML('A_{d}'), 'A<sub>d</sub>');
  assert.equal(STEPS.toText('120{,}000K_{1}'), '120,000K_1');
  const card = SEC.card({ D: 60, tw: 0.5625, topB: 18, topT: 1.5, botB: 18, botT: 2 }, { ts: 8, haunch: 2, beff: 114, rebar: { top: { A: 6.6, c: 2.5 }, bot: { A: 3.2, c: 1.75 } } },
    { Fyt: 50, Fyb: 50, Fyw: 50, Fyr: 60, fc: 4 }, 8, { region: 'neg' });
  const cid = card.steps.map(x => x.id); assert.equal(new Set(cid).size, cid.length, 'card ids unique');
  card.steps.forEach(x => { assert.ok(!/undefined|NaN/.test(STEPS.line(x, true)), `${x.id}: ${STEPS.line(x, true)}`); });
});
