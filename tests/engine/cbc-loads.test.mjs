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
    ['5.3.1d', '1.2D + 1.0W + 1.0L + 0.5Lr', 11.0, 4.4],            // 6 + 2 + 3 = 11.0; 2.4 + 0.8 + 1.2 = 4.4
    ['5.3.1d', '1.2D − 1.0W + 1.0L + 0.5Lr', 7.0, 2.8],             // 6 − 2 + 3 = 7.0; 2.4 − 0.8 + 1.2 = 2.8
    ['5.3.1e', '1.2D + 1.0E + 1.0L + 0.2S', 9.0, 3.6],              // E = 0: one row (±E merged); 6 + 3 = 9.0
    ['5.3.1f', '0.9D + 1.0W', 6.5, 2.6],                            // 4.5 + 2 = 6.5; 1.8 + 0.8 = 2.6
    ['5.3.1f', '0.9D − 1.0W', 2.5, 1.0],                            // 4.5 − 2 = 2.5; 1.8 − 0.8 = 1.0
    ['5.3.1g', '0.9D + 1.0E', 4.5, 1.8]];                           // E = 0: 4.5; 1.8
  assert.deepEqual(R.map(r => [r.eq, r.name]), exp.map(e => [e[0], e[1]]));
  exp.forEach(([, n, M, V]) => { const r = row(R, n); near(r.Mu, M, n + ' M_u'); near(r.Vu, V, n + ' V_u'); near(r.Tu, 0, n + ' T_u'); });
  assert.deepEqual(row(R, '1.2D + 1.6L + 0.5Lr').merged, ['1.2D + 1.6L + 0.5S', '1.2D + 1.6L + 0.5R']);
  assert.deepEqual(row(R, '1.2D + 1.0E + 1.0L + 0.2S').merged, ['1.2D − 1.0E + 1.0L + 0.2S']);
  // governing by |M_u|: (5.3.1d) +W, 11.0 kip-ft
  assert.equal(R.reduce((a, r) => Math.abs(r.Mu) > Math.abs(a.Mu) ? r : a).name, '1.2D + 1.0W + 1.0L + 0.5Lr');
});

test('every alternative expanded when every case is non-zero: 25 rows, as Table 5.3.1', () => {
  const all = cases({ D: { M: 1 }, L: { M: 1 }, Lr: { M: 1 }, S: { M: 1 }, R: { M: 1 }, W: { M: 1 }, E: { M: 1 } });
  const R = builder()({ cases: all, rev: { W: true, E: true }, l05: false });
  const n = eq => R.filter(r => r.eq === eq).length;
  // a 1; b 3; c 3 x (1.0L, +0.5W, −0.5W) = 9; d 3 x ±W = 6; e ±E = 2; f ±W = 2; g ±E = 2
  assert.deepEqual(['5.3.1a', '5.3.1b', '5.3.1c', '5.3.1d', '5.3.1e', '5.3.1f', '5.3.1g'].map(n), [1, 3, 9, 6, 2, 2, 2]);
  assert.equal(R.length, 25);
  R.forEach(r => assert.deepEqual(r.merged, []));
  const R2 = builder()({ cases: all, rev: { W: false, E: false }, l05: false });
  assert.equal(R2.length, 1 + 3 + 6 + 3 + 1 + 1 + 1);   // no reversal: 16
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
