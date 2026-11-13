// "Concrete Beam Capacity.html", Beam Capacity tab (CBSL, 2026-11-13): the service-load combination builder cbcBuildCombos,
// taken from the text of the Beam Capacity frame (its srcdoc, decoded) and run in a Node vm. ACI 318-19 5.3.1, Table 5.3.1,
// Eqs. (5.3.1a)-(5.3.1g); 5.3.3 (load factor 0.5 on L in (c)-(e)). Hand check of the PR in the comments.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test, ROOT } from './harness.mjs';

function builder() {
  const html = fs.readFileSync(path.join(ROOT, 'Concrete Beam Capacity.html'), 'utf8');
  const a = html.indexOf('id="suite-frame-capacity" srcdoc="'), b = html.indexOf('"></iframe>', a);
  const src = html.slice(a, b).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
  const grab = re => { const m = re.exec(src); assert.ok(m, 'declaration not found: ' + re); const lines = src.slice(m.index + 1).split('\n'), out = [lines[0]];
    for (let i = 1; i < lines.length; i++) { const L = lines[i]; if (/^[\s})\]]/.test(L) || L === '' || L === '\r') out.push(L); else break; } return out.join('\n'); };
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(grab(/\nconst CBC_LD_KEYS=/).replace(/^const /, 'var ') + '\n' + grab(/\nfunction cbcBuildCombos\(/), ctx);
  return svc => JSON.parse(JSON.stringify(ctx.cbcBuildCombos(svc)));
}
const cases = o => { const c = {}; for (const k of ['D', 'L', 'Lr', 'S', 'R', 'W', 'E']) c[k] = Object.assign({ M: 0, V: 0, T: 0 }, o[k] || {}); return c; };
const near = (a, b, what) => assert.ok(Math.abs(a - b) <= 1e-9, `${what}: ${a} vs ${b}`);
const row = (R, name) => { const r = R.find(x => x.name === name); assert.ok(r, 'row not found: ' + name + ' in ' + R.map(x => x.name).join(' | ')); return r; };

// Hand check: D M 5 V 2; L M 3 V 1.2; W M ±2 V ±0.8 (reversible), L_r = S = R = E = 0, 5.3.3 off.
test('hand check D 5/2, L 3/1.2, W ±2/±0.8: rows, M_u, V_u', () => {
  const R = builder()({ cases: cases({ D: { M: 5, V: 2 }, L: { M: 3, V: 1.2 }, W: { M: 2, V: 0.8 } }), rev: { W: true, E: true }, l05: false });
  const exp = [
    ['5.3.1a', '1.4D', 7.0, 2.8],                                   // 1.4(5) = 7.0; 1.4(2) = 2.8
    ['5.3.1b', '1.2D + 1.6L + 0.5Lr', 10.8, 4.32],                  // 6 + 4.8 = 10.8; 2.4 + 1.92 = 4.32 (S, R rows merged)
    ['5.3.1c', '1.2D + 1.6Lr + 1.0L', 9.0, 3.6],                    // 6 + 3 = 9.0; 2.4 + 1.2 = 3.6
    ['5.3.1c', '1.2D + 1.6Lr + 0.5W', 7.0, 2.8],                    // 6 + 1 = 7.0; 2.4 + 0.4 = 2.8
    ['5.3.1c', '1.2D + 1.6Lr − 0.5W', 5.0, 2.0],                    // 6 − 1 = 5.0; 2.4 − 0.4 = 2.0
    ['5.3.1c', '1.2D + 1.6Lr − 0.5W, W omitted', 6.0, 2.4],         // CBOM 5.3.2: 6 > 5, 2.4 > 2.0
    ['5.3.1d', '1.2D + 1.0W + 1.0L + 0.5Lr', 11.0, 4.4],            // 6 + 2 + 3 = 11.0; 2.4 + 0.8 + 1.2 = 4.4
    ['5.3.1d', '1.2D − 1.0W + 1.0L + 0.5Lr', 7.0, 2.8],             // 6 − 2 + 3 = 7.0; 2.4 − 0.8 + 1.2 = 2.8
    ['5.3.1d', '1.2D − 1.0W + 1.0L + 0.5Lr, W omitted', 9.0, 3.6],  // CBOM: 6 + 3 = 9 > 7
    ['5.3.1e', '1.2D + 1.0E + 1.0L + 0.2S', 9.0, 3.6],              // E = 0: one row (±E merged); 6 + 3 = 9.0
    ['5.3.1f', '0.9D + 1.0W', 6.5, 2.6],                            // 4.5 + 2 = 6.5; 1.8 + 0.8 = 2.6
    ['5.3.1f', '0.9D − 1.0W', 2.5, 1.0],                            // 4.5 − 2 = 2.5; 1.8 − 0.8 = 1.0
    ['5.3.1f', '0.9D − 1.0W, W omitted', 4.5, 1.8],                 // CBOM: 4.5 > 2.5
    ['5.3.1g', '0.9D + 1.0E', 4.5, 1.8]];                           // E = 0: 4.5; 1.8
  assert.deepEqual(R.map(r => [r.eq, r.name]), exp.map(e => [e[0], e[1]]));
  exp.forEach(([, n, M, V]) => { const r = row(R, n); near(r.Mu, M, n + ' M_u'); near(r.Vu, V, n + ' V_u'); near(r.Tu, 0, n + ' T_u'); });
  assert.deepEqual(row(R, '1.2D + 1.6L + 0.5Lr').merged, ['1.2D + 1.6L + 0.5S', '1.2D + 1.6L + 0.5R']);
  assert.deepEqual(row(R, '1.2D + 1.0E + 1.0L + 0.2S').merged, ['1.2D − 1.0E + 1.0L + 0.2S']);
  // governing by |M_u|: (5.3.1d) +W, 11.0 kip-ft
  assert.equal(R.reduce((a, r) => Math.abs(r.Mu) > Math.abs(a.Mu) ? r : a).name, '1.2D + 1.0W + 1.0L + 0.5Lr');
});

test('every alternative expanded when every case is non-zero: 25 rows, as Table 5.3.1', () => {
  // all effects of one sign and W / E not reversed... with reversal the −W / −E rows add 5.3.2 rows; filter the full rows here
  const all = cases({ D: { M: 1 }, L: { M: 1 }, Lr: { M: 1 }, S: { M: 1 }, R: { M: 1 }, W: { M: 1 }, E: { M: 1 } });
  const R = builder()({ cases: all, rev: { W: true, E: true }, l05: false }).filter(r => !r.omit);
  const n = eq => R.filter(r => r.eq === eq).length;
  // a 1; b 3; c 3 x (1.0L, +0.5W, −0.5W) = 9; d 3 x ±W = 6; e ±E = 2; f ±W = 2; g ±E = 2
  assert.deepEqual(['5.3.1a', '5.3.1b', '5.3.1c', '5.3.1d', '5.3.1e', '5.3.1f', '5.3.1g'].map(n), [1, 3, 9, 6, 2, 2, 2]);
  assert.equal(R.length, 25);
  R.forEach(r => assert.deepEqual(r.merged, []));
  const R2 = builder()({ cases: all, rev: { W: false, E: false }, l05: false });
  assert.equal(R2.length, 1 + 3 + 6 + 3 + 1 + 1 + 1);   // no reversal, all effects of one sign: no 5.3.2 row, 16
});

test('5.3.3: the factor on L is 0.5 in Eqs. (5.3.1c), (d), (e) only', () => {
  const svc = { cases: cases({ D: { M: 10 }, L: { M: 10 } }), rev: { W: false, E: false }, l05: true };
  const R = builder()(svc);
  near(row(R, '1.2D + 1.6L + 0.5Lr').Mu, 28, '(b) keeps 1.6L');            // 12 + 16
  near(row(R, '1.2D + 1.6Lr + 0.5L').Mu, 17, '(c) 0.5L');                   // 12 + 5
  near(row(R, '1.2D + 1.0W + 0.5L + 0.5Lr').Mu, 17, '(d) 0.5L');
  near(row(R, '1.2D + 1.0E + 0.5L + 0.2S').Mu, 17, '(e) 0.5L');
  const R1 = builder()(Object.assign({}, svc, { l05: false }));
  near(row(R1, '1.2D + 1.6Lr + 1.0L').Mu, 22, '(c) 1.0L');                  // 12 + 10
});

test('signs: V and T combine with their signs; E reversal flips M, V and T together', () => {
  const R = builder()({ cases: cases({ D: { M: -8, V: 3, T: 1 }, E: { M: 4, V: -2, T: 0.5 } }), rev: { W: true, E: true }, l05: false });
  const p = row(R, '0.9D + 1.0E'), m = row(R, '0.9D − 1.0E');
  near(p.Mu, -3.2, 'M+'); near(p.Vu, 0.7, 'V+'); near(p.Tu, 1.4, 'T+');      // −7.2 + 4; 2.7 − 2; 0.9 + 0.5
  near(m.Mu, -11.2, 'M−'); near(m.Vu, 4.7, 'V−'); near(m.Tu, 0.4, 'T−');     // −7.2 − 4; 2.7 + 2; 0.9 − 0.5
});

test('blank cases: one row per equation, all zero; missing or partial input reads as zero', () => {
  const R = builder()({ cases: cases({}), rev: { W: true, E: true }, l05: false });
  assert.deepEqual(R.map(r => r.eq), ['5.3.1a', '5.3.1b', '5.3.1c', '5.3.1d', '5.3.1e', '5.3.1f', '5.3.1g']);
  R.forEach(r => { assert.equal(r.Mu, 0); assert.equal(r.Vu, 0); assert.equal(r.Tu, 0); });
  assert.equal(builder()({}).length, 7);
  near(row(builder()({ cases: { D: { M: '5' } } }), '1.4D').Mu, 7, 'string input');
});

// CBOM (2026-11-13, CB-7): ACI 318-19 5.3.2, a variable load left out where that increases |M_u| or |V_u| (mixed signs).
// D M = 5, L M = −3, W M = ±2 (reverses), others 0; V = 0. Full rows (M_u): a 7.0; b 1.2; c+L 3.0, c+0.5W 7.0, c−0.5W 5.0; d+W 5.0,
// d−W 1.0; e 3.0; f+W 6.5, f−W 2.5; g 4.5. Omitted rows (|M_u| larger): b L omitted 6.0; c+L L omitted 6.0; c−0.5W W omitted 6.0
// (same loads as "c+L, L omitted" in Eq. (5.3.1c): merged); d+W L omitted 8.0; d−W W omitted 3.0, L omitted 4.0; e L omitted 6.0;
// f−W W omitted 4.5. Governing |M_u|: 7.0 before (1.4D), 8.0 after ((5.3.1d) +W, L omitted = 1.2D + 1.0W + 0.5Lr).
// CBSS (CB-8): every subset; (d) +W with W and L omitted = 1.2D + 0.5Lr = 6.0 > 5.0 is added; (d) −W with W and L omitted (6.0) has the
// same loads, so it is merged into it; governing stays 8.0.
test('5.3.2 mixed-sign hand check: omitted rows, merge, governing 7.0 -> 8.0', () => {
  const R = builder()({ cases: cases({ D: { M: 5 }, L: { M: -3 }, W: { M: 2 } }), rev: { W: true, E: true }, l05: false });
  const exp = [['1.4D', 7], ['1.2D + 1.6L + 0.5Lr', 1.2], ['1.2D + 1.6L + 0.5Lr, L omitted', 6], ['1.2D + 1.6Lr + 1.0L', 3], ['1.2D + 1.6Lr + 1.0L, L omitted', 6],
    ['1.2D + 1.6Lr + 0.5W', 7], ['1.2D + 1.6Lr − 0.5W', 5], ['1.2D + 1.0W + 1.0L + 0.5Lr', 5], ['1.2D + 1.0W + 1.0L + 0.5Lr, L omitted', 8], ['1.2D + 1.0W + 1.0L + 0.5Lr, W and L omitted', 6],
    ['1.2D − 1.0W + 1.0L + 0.5Lr', 1], ['1.2D − 1.0W + 1.0L + 0.5Lr, W omitted', 3], ['1.2D − 1.0W + 1.0L + 0.5Lr, L omitted', 4],
    ['1.2D + 1.0E + 1.0L + 0.2S', 3], ['1.2D + 1.0E + 1.0L + 0.2S, L omitted', 6], ['0.9D + 1.0W', 6.5], ['0.9D − 1.0W', 2.5], ['0.9D − 1.0W, W omitted', 4.5], ['0.9D + 1.0E', 4.5]];
  assert.deepEqual(R.map(r => r.name), exp.map(e => e[0]));
  exp.forEach(([n, M]) => near(row(R, n).Mu, M, n));
  assert.deepEqual(row(R, '1.2D + 1.6Lr + 1.0L, L omitted').merged, ['1.2D + 1.6Lr − 0.5W, W omitted']);
  assert.deepEqual(row(R, '1.2D + 1.0W + 1.0L + 0.5Lr, L omitted').why, ['M']);
  assert.deepEqual(row(R, '1.2D + 1.0W + 1.0L + 0.5Lr, W and L omitted').merged, ['1.2D − 1.0W + 1.0L + 0.5Lr, W and L omitted']);
  const full = R.filter(r => !r.omit), gov = rs => rs.reduce((a, r) => Math.abs(r.Mu) > Math.abs(a.Mu) + 1e-9 ? r : a);
  near(gov(full).Mu, 7, 'governing full row'); assert.equal(gov(R).name, '1.2D + 1.0W + 1.0L + 0.5Lr, L omitted'); near(gov(R).Mu, 8, 'governing with 5.3.2');
});

test('5.3.2: V checked on its own; an omitted row only where |M_u| or |V_u| grows', () => {
  // D M 5 V 4, L M 3 V −2: (5.3.1b) M 10.8, V 4.8 − 3.2 = 1.6; L omitted M 6.0 (smaller), V 4.8 (larger) -> generated for V only
  const R = builder()({ cases: cases({ D: { M: 5, V: 4 }, L: { M: 3, V: -2 } }), rev: { W: true, E: true }, l05: false });
  const o = row(R, '1.2D + 1.6L + 0.5Lr, L omitted');
  near(o.Mu, 6, 'M'); near(o.Vu, 4.8, 'V'); assert.deepEqual(o.why, ['V']);
  assert.ok(R.every(r => !r.omit || r.omit !== 'D'), 'D never omitted');
});

// CBSS (CB-8): a two-load omission governs. D M 5, W M 4 (reverses), L M −3, L_r = S = R M −2. (5.3.1d) +W with L_r:
// 6 + 4 − 3 − 1 = 6.0; L omitted 6 + 4 − 1 = 9.0; L_r omitted 6 + 4 − 3 = 7.0; L and L_r omitted 6 + 4 = 10.0.
// Best single-load row 9.0 ((5.3.1d) +W, L omitted, each of L_r / S / R); governing 10.0 = "(5.3.1d) 1.2D + 1.0W + 1.0L + 0.5Lr, L and Lr omitted"
// (the S and R variants merged into it).
test('5.3.2: a two-load omission governs (10.0 over the best single omission 9.0)', () => {
  const R = builder()({ cases: cases({ D: { M: 5 }, W: { M: 4 }, L: { M: -3 }, Lr: { M: -2 }, S: { M: -2 }, R: { M: -2 } }), rev: { W: true, E: true }, l05: false });
  const g = R.reduce((a, r) => Math.abs(r.Mu) > Math.abs(a.Mu) + 1e-9 ? r : a);
  assert.equal(g.name, '1.2D + 1.0W + 1.0L + 0.5Lr, L and Lr omitted'); near(g.Mu, 10, 'governing');
  assert.deepEqual(g.merged, ['1.2D + 1.0W + 1.0L + 0.5S, L and S omitted', '1.2D + 1.0W + 1.0L + 0.5R, L and R omitted']);
  const single = R.filter(r => !r.omitK || r.omitK.length < 2).reduce((a, r) => Math.abs(r.Mu) > Math.abs(a.Mu) + 1e-9 ? r : a);
  near(single.Mu, 9, 'best without two-load omissions'); assert.equal(single.name, '1.2D + 1.0W + 1.0L + 0.5Lr, L omitted');
  assert.ok(R.every(r => !r.omitK || r.omitK.length <= 3), 'at most the row\'s variable loads');
});
