// shared/steps.js toHTML without KaTeX (the built-in HTML renderer: offline / CDN blocked, line() and summary() without KaTeX,
// and SharedReport's $…$ in titles, notes and cells): the TeX the tools write beyond the README subset is shown as HTML (TXH,
// 2026-11-07). Before, the unknown command's name was printed: "30.00 mathrmkips", "tfracB2", "N_q … varphi … quad".
// The plain text (TXP, steps-totext.test.mjs), toText's legacy option and the KaTeX path are not changed.
// The TeX inputs are written with String.raw (R`…`), so each backslash in the source is one backslash in the string.
import assert from 'node:assert/strict';
import { loadShared, test } from './harness.mjs';

const S = loadShared('units.js', 'steps.js').SharedSteps;   // no window.katex: toHTML is the built-in renderer
const H = S.toHTML, R = String.raw;
const FR = (a, b) => `<span class="st-frac"><span class="st-num">${a}</span><span class="st-den">${b}</span></span>`;

test('toHTML: font and wrapper commands give their content (mathrm upright text, mathbf bold, boxed, textcolor, operatorname)', () => {
  assert.equal(H(R`W_f = 30.00\;\mathrm{kips}`), 'W<sub>f</sub> = 30.00&thinsp;kips');
  assert.equal(H(R`\mathrm{DCR} = 6.03/8.62 = \mathbf{0.70}\;\checkmark`), 'DCR = 6.03/8.62 = <b>0.70</b>&thinsp;✓');
  assert.equal(H(R`\theta = \mathrm{atan2}(M_{ux}, M_{uy})`), 'θ = atan2(M<sub>ux</sub>, M<sub>uy</sub>)');
  assert.equal(H(R`R_A=\boxed{2.800}`), 'R<sub>A</sub>=<span class="st-box" style="border:1px solid currentColor;padding:0 2px">2.800</span>');
  assert.equal(H(R`\textcolor{red}{\text{NG}}`), '<span style="color:red">NG</span>');
  assert.equal(H(R`\textcolor{x;y}{a}`), 'a');   // a colour that is not a plain name or #hex is dropped, not written into style
  assert.equal(H(R`\operatorname{sgn}(x)`), 'sgn(x)');
  assert.equal(H(R`\text{kip\text{-}ft}`), 'kip-ft');
  assert.equal(H(R`\text{kip\cdot ft}`), 'kip· ft');
  assert.equal(H(R`\text{a<b}`), 'a&lt;b');   // \text without commands: escaped as before
});

test('toHTML: dfrac / tfrac / cfrac stacked like frac', () => {
  assert.equal(H(R`x = \pm\tfrac{B}{2}`), 'x = ±' + FR('B', '2'));
  assert.equal(H(R`\dfrac{2+B'/L'}{1+B'/L'}`), FR("2+B'/L'", "1+B'/L'"));
  assert.equal(H(R`\varepsilon_s = \varepsilon_{cu}\dfrac{d-c}{c}`), 'ε<sub>s</sub> = ε<sub>cu</sub>' + FR('d-c', 'c'));
});

test('toHTML: Greek variants, relations and arrows as Unicode; operators spaced', () => {
  assert.equal(H(R`\varphi \vartheta \varepsilon \kappa \nu \Gamma \Omega \Phi`), 'φ θ ε κ ν Γ Ω Φ');
  assert.equal(H(R`a \leq b \geq c \neq d \Rightarrow e`), 'a ≤ b ≥ c ≠ d ⇒ e');
  assert.equal(H(R`\lfloor x \rfloor \int q\,dA`), '⌊ x ⌋ ∫ q&thinsp;dA');
  assert.equal(H(R`(N_q-1)\cot\varphi`), '(N<sub>q</sub>-1)&thinsp;cot&thinsp;φ');
  assert.equal(H(R`\textendash \cdotp`), '– ·');
});

test('toHTML: spacing, sizing and style commands; left. / right.', () => {
  assert.equal(H(R`a\quad b\qquad c\!d`), 'a&emsp; b&emsp;&emsp; cd');
  assert.equal(H(R`\displaystyle\Big( x \Big)`), '( x )');
  assert.equal(H(R`\left.x\right|_{0}`), 'x|<sub>0</sub>');
  assert.equal(H(R`a~b`), 'a&nbsp;b');
});

test('toHTML: sqrt[n], accents, \\not, \\tag', () => {
  assert.equal(H(R`\sqrt[3]{x}`), '<sup>3</sup>√<span class="st-bar">x</span>');
  assert.equal(H(R`\sqrt{f'_{c}}`), "√<span class=\"st-bar\">f'<sub>c</sub></span>");   // the subset: unchanged
  assert.equal(H(R`\hat{\theta} \vec{F} \overline{AB}`), 'θ̂ F⃗ <span class="st-bar">AB</span>');
  assert.equal(H(R`a \not= b`), 'a ≠ b');
  assert.equal(H(R`x \tag{5.1}`), 'x &ensp;(5.1)');
});

test('toHTML: cases / aligned / array / matrices as an inline table (a cell per &, a row per \\\\), with their brackets', () => {
  const T = (rows, al) => '<span class="st-env" style="display:inline-table;vertical-align:middle">' + rows.map(r => '<span style="display:table-row">'
    + r.map((x, k) => `<span style="display:table-cell;padding:0 .3em;text-align:${al(k)}">${x}</span>`).join('') + '</span>').join('') + '</span>';
  const MX = (o, t, c) => `<span class="st-mx" style="display:inline-flex;align-items:stretch;vertical-align:middle">${o}${t}${c}</span>`;
  const BR = (side, st) => `<span class="st-br" style="width:.3em;border-${side}:1px solid currentColor;${st}"></span>`;
  const brace = n => `<span class="st-br" style="display:flex;align-items:center;line-height:1;font-size:${n}em${n === 1 ? '' : ';transform:scaleX(.6)'}">{</span>`;
  assert.equal(H(R`n = \begin{cases} a & x \le 6 \\ b & x > 6 \end{cases}`), 'n = ' + MX(brace('2.30'), T([['a', 'x ≤ 6'], ['b', 'x &gt; 6']], () => 'left'), ''));
  assert.equal(H(R`\begin{aligned} V &= 8 \\ V_u &= 4 \\ \end{aligned}`), T([['V', '= 8'], ['V<sub>u</sub>', '= 4']], k => (k % 2 ? 'left' : 'right')));
  const tb = 'border-top:1px solid currentColor;border-bottom:1px solid currentColor';
  assert.equal(H(R`T = \begin{bmatrix} c & s \\ -s & c \end{bmatrix}`), 'T = ' + MX(BR('left', tb), T([['c', 's'], ['-s', 'c']], () => 'center'), BR('right', tb)));
  assert.equal(H(R`\begin{array}{lr} 1 & 2 \end{array}`), T([['1', '2']], k => ['left', 'right'][k]));
  assert.equal(H(R`\begin{cases} \text{a \& b} & y \end{cases}`), MX(brace(1), T([['a &amp; b', 'y']], () => 'left'), ''));   // an escaped & is not a cell break
  assert.equal(H('a & b'), 'a &amp; b');   // outside an environment: a literal ampersand, as before
  assert.equal(H(R`a \\ b`), 'a <br> b');   // a line break outside an environment
});

test('toHTML: the README subset renders exactly as before TXH', () => {
  const cases = [
    [R`\frac{\sum A y}{\sum A}`, FR('Σ A y', 'Σ A')],
    [R`\bar{y} = 12.5`, '<span class="st-bar">y</span> = 12.5'],
    [R`\phi M_{n} \ge M_{u}`, 'φ M<sub>n</sub> ≥ M<sub>u</sub>'],
    [R`1 - c_{1}(\tan\theta)^{1.5}`, '1 - c<sub>1</sub>(tan&thinsp;θ)<sup>1.5</sup>'],
    [R`30^{\circ}`, '30°'],
    [R`\text{in}^{2}`, 'in<sup>2</sup>'],
    [R`51{,}050 \minus 3 \pm \ell`, '51,050 − 3 ± ℓ'],
    [R`a\,b\;c\ d`, 'a&thinsp;b&thinsp;c&thinsp;d'],
  ];
  for (const [t, h] of cases) assert.equal(H(t), h, t);
});

test('toHTML: with window.katex the KaTeX output is returned unchanged (the built-in converter is not used)', () => {
  const W = loadShared('units.js', 'steps.js'); let seen = null;
  W.katex = { renderToString: (t, o) => { seen = [t, o]; return 'K[' + t + ']'; } };
  assert.equal(W.SharedSteps.toHTML(R`\tfrac{B}{2}\;\mathrm{kips}`), R`K[\tfrac{B}{2}\;\mathrm{kips}]`);
  assert.equal(seen[1].throwOnError, false);
});

test('toText and toText(…, { legacy: true }) are not changed by TXH', () => {
  const T = S.toText;
  assert.equal(T(R`W_f = 30.00\;\mathrm{kips}`), 'W_f = 30.00 kips');
  assert.equal(T(R`x = \pm\tfrac{B}{2}`, { legacy: true }), 'x = ±tfracB2');
  assert.equal(T(R`n = \begin{cases} a & x \\ b & y \end{cases}`), 'n = {  a   x ;  b   y ');
});

test('SharedReport: $…$ in a title / cell / note (always the built-in renderer, also with KaTeX) reads without command names', () => {
  const W = loadShared('units.js', 'steps.js', 'report.js'), SR = W.SharedReport;
  const doc = SR.build({ title: 'T', sections: [{ title: 'S', subs: [{ title: R`Cell $\mathrm{DCR} \leq 1$`, items: [{ type: 'note', text: R`$\tfrac{1}{2}\varphi$` },
    { type: 'table', head: ['a'], rows: [[R`$\gamma_{p,\max} \Rightarrow \checkmark$`]] }] }] }] });
  const h = SR.html(doc);
  assert.ok(h.includes('DCR ≤ 1') && !/mathrm|tfrac|varphi|Rightarrow|checkmark|leq/.test(h.replace(/<[^>]*>/g, '')), h);
  assert.ok(h.includes(FR('1', '2') + 'φ') && h.includes('γ<sub>p,max</sub> ⇒ ✓'), h);
});

test('tool TeX (Spread Footing, BPAD, CBC) renders without a leftover command name or backslash (built-in HTML)', () => {
  const W = loadShared('units.js', 'steps.js'), K = W.SharedSteps;
  const bad = [];
  for (const t of [R`N_q = e^{\pi\tan\varphi}\tan^2\!\left(45+\tfrac{\varphi}{2}\right),\quad N_c = (N_q-1)\cot\varphi`, R`\mathrm{DCR} = \mathbf{0.70}\;\checkmark`,
    R`V_{res}=\sqrt{V_x^2+V_y^2}\;\Rightarrow\;\boxed{8.00\ \mathrm{kip}}`, R`\varepsilon_s = \varepsilon_{cu}\dfrac{d-c}{c} \geq 0.005`]) {
    const txt = K.toHTML(t).replace(/<[^>]*>/g, '').replace(/&[a-z]+;/g, ' ');
    if (/\b(mathrm|mathbf|dfrac|tfrac|varphi|varepsilon|quad|checkmark|boxed|Rightarrow|geq|left|right)\b|\\/.test(txt)) bad.push([t, txt]);
  }
  assert.deepEqual(bad, []);
});
