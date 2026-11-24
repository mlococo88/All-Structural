// shared/steps.js line() (CMPL, 2026-11-24): a step whose eq starts with a relation (\le, \ge, \lt, \gt, \ne, ≤, ≥, <, >, ≠) continues its
// sym as one comparison: "D_p ≤ 0.42D_t = 9.204 ≤ … = OK", not "D_p = ≤ 0.42D_t = …" (Steel Bridge Design Flexure, step 15, 6.10.7.3).
// Every other step renders exactly as before (the old line() is kept below as OLD and compared). Display only.
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { loadShared, test, ROOT } from './harness.mjs';

const katex = createRequire(import.meta.url)(path.join(ROOT, 'tests/libs/katex@0.16.9/dist/katex.min.js'));
const W = loadShared('units.js', 'steps.js'), S = W.SharedSteps;              // built-in renderer
const WK = loadShared('units.js', 'steps.js'); WK.katex = katex; const SK = WK.SharedSteps;   // KaTeX, as the page with the CDN
const R = String.raw;

// the line() of origin/main before CMPL, for the "unchanged" checks (same helpers: toText, toHTML, unitTeX, fmt)
function OLD(SS, win, s, html, o) {
  const K = html && win.katex ? win.katex : null, KO = SS.katexOpt, D = t => K.renderToString('\\displaystyle ' + t, KO);
  const Rr = K ? D : html ? SS.toHTML : t => SS.toText(t, o), parts = [];
  if (s.sym) parts.push(Rr(s.sym));
  if (s.eq) parts.push(Rr(s.eq));
  if (s.sub && s.sub !== s.eq) parts.push(Rr(s.sub));
  const v = typeof s.value === 'number' ? SS.fmt(s.value, s.d) : s.value == null ? '' : String(s.value);
  if (v !== '' && K && typeof s.value === 'number') parts.push(K.renderToString(v + (s.unit ? '\\;' + SS.unitTeX(s.unit) : ''), KO));
  else if (v !== '') parts.push(v + (s.unit ? (html ? '&nbsp;' : ' ') + (K ? SS.toHTML(SS.unitTeX(s.unit)) : Rr(s.unit)) : ''));
  return parts.join(' = ');
}

const DUCT = { id: 'fx.duct.ok', label: 'Ductility', sym: 'D_{p}', eq: R`\le 0.42D_{t}`, sub: R`9.204 \le 0.42(27.000) = 11.340`, value: 'OK', unit: '', d: 2, ok: true };
const MN = { id: 'fx.mn.ok', label: 'Strength I, compact positive flexure', sym: R`M_{u} + \frac{1}{3}f_{\ell}S_{xt}`, eq: R`\le \phi_{f}M_{n}`, sub: R`2086.83 + \frac{1}{3}(0.00)\frac{4{,}210}{12} = 2086.83 \le 2284.07`, value: 'OK', unit: '', d: 2, ok: true };

test('CMPL: the two Flexure step-15 lines read "sym ≤ eq = sub = OK" (plain text, built-in HTML, KaTeX)', () => {
  assert.equal(S.line(DUCT, false), 'D_p ≤ 0.42D_t = 9.204 ≤ 0.42(27.000) = 11.340 = OK');
  assert.equal(S.line(MN, false), 'M_u + 1/3f_ℓS_(xt) ≤ φ_fM_n = 2086.83 + 1/3(0.00)(4,210)/12 = 2086.83 ≤ 2284.07 = OK');
  assert.equal(OLD(S, W, DUCT, false), 'D_p = ≤ 0.42D_t = 9.204 ≤ 0.42(27.000) = 11.340 = OK', 'before');
  assert.equal(S.line(DUCT, true), 'D<sub>p</sub> ≤ 0.42D<sub>t</sub> = 9.204 ≤ 0.42(27.000) = 11.340 = OK');
  const k = SK.line(DUCT, true), kOld = OLD(SK, WK, DUCT, true);
  assert.equal(k, katex.renderToString(R`\displaystyle D_{p} \le 0.42D_{t}`, SK.katexOpt) + ' = ' + katex.renderToString(R`\displaystyle 9.204 \le 0.42(27.000) = 11.340`, SK.katexOpt) + ' = OK');
  assert.equal(kOld.split(' = ').length, k.split(' = ').length + 1, 'one " = " less than before');
  for (const t of [S.line(DUCT, false), S.line(MN, false), S.line(DUCT, true), S.line(MN, true)]) assert.doesNotMatch(t, /= (≤|≥|<|>|≠|&lt;|&gt;)/, t);
});

test('CMPL: every relation the subset knows, and only at the start of eq', () => {
  for (const [eq, rel] of [[R`\le a`, '≤'], [R`\ge a`, '≥'], [R`\lt a`, '<'], [R`\gt a`, '>'], [R`\ne a`, '≠'], ['≤ a', '≤'], ['≥ a', '≥'], ['< a', '<'], ['> a', '>'], [' \\le a', '≤']])
    assert.equal(S.line({ sym: 'x', eq, sub: '', value: 'OK' }, false), `x ${eq.trim().startsWith('\\') ? rel : eq.trim()[0]} a = OK`, eq);
  assert.equal(S.isRel({ sym: 'x', eq: R`\left(a\right)` }), false, R`\left is not \le`);
  assert.equal(S.isRel({ sym: 'x', eq: R`\leftarrow` }), false);
  assert.equal(S.isRel({ sym: 'x', eq: R`a \le b` }), false, 'a relation inside eq: unchanged');
  assert.equal(S.isRel({ sym: '', eq: R`\le b` }), false, 'no sym: unchanged');
});

test('CMPL: every other step renders exactly as before (plain text, built-in HTML, KaTeX)', () => {
  const steps = [
    { sym: 'S_{bot}', eq: R`\frac{I}{\bar{y}}`, sub: R`\frac{51{,}050}{33.535}`, value: 51050 / 33.535, unit: 'in^{3}', d: 0 },
    { sym: R`V_{u} \le \phi_{v}V_{n}`, eq: '', sub: R`812.50 \le 1.0(1858.00)`, value: 0.437, unit: '', d: 3, ok: true },
    { sym: 'n', eq: '', sub: '', value: 8.04, unit: '', d: 3 },
    { sym: R`\frac{D}{t_{w}}`, eq: R`0.1 \le \frac{I_{yc}}{I_{yt}} \le 10`, sub: '0.1 \\le 1.00 \\le 10', value: 'OK' },
    { sym: '', eq: R`\le 150`, sub: '120 \\le 150', value: 'OK' },
    { sym: 'x', eq: 'y', sub: 'y', value: 2, unit: 'kip-ft', d: 1 },
    { sym: '', eq: '', sub: '', value: 'text', unit: '' },
    { sym: R`\gamma_{LL}`, eq: '', sub: '', value: null }];
  for (const s of steps) for (const html of [false, true]) {
    assert.equal(S.line(s, html), OLD(S, W, s, html), JSON.stringify(s) + html);
    assert.equal(SK.line(s, html), OLD(SK, WK, s, html), 'KaTeX ' + JSON.stringify(s) + html);
  }
  assert.equal(S.line(steps[0], false, { legacy: true }), OLD(S, W, steps[0], false, { legacy: true }));
});

test('CMPL: every step in the repository with a relation at the start of eq has a sym (so it renders "sym eq")', () => {
  // the source scan: sym '…', eq '\le …' (and \ge, \lt, \gt, \ne, ≤ ≥ < > ≠); a step with no sym renders its eq alone, as before
  const files = [];
  const walk = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name);
    if (f.isDirectory()) { if (!/^(node_modules|tests|archive|\.git)$/.test(f.name)) walk(p); } else if (/\.(js|html)$/.test(f.name)) files.push(p); } };
  walk(ROOT);
  const re = /sym: *(['`"])((?:(?!\1).){0,200})\1, *eq: *(['`"])\s*(\\\\(?:le|ge|lt|gt|ne)(?![A-Za-z])|[<>≤≥≠])/g;
  const hits = {}; let n = 0, empty = 0;
  for (const f of files) { const t = fs.readFileSync(f, 'utf8'); let m; re.lastIndex = 0;
    while ((m = re.exec(t))) { n++; if (!m[2]) empty++; const k = path.relative(ROOT, f); hits[k] = (hits[k] || 0) + 1; } }
  console.log(`       ${n} step(s) with eq starting with a relation, sym empty in ${empty}: ${Object.entries(hits).map(([k, v]) => `${k} ${v}`).join('; ')}`);
  assert.ok(n >= 60, 'the scan finds the known steps');
  assert.equal(empty, 0);
});
