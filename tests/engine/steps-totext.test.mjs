// shared/steps.js toText (the plain-text path: SharedReport.text, SharedSteps.line(…, false), summary(…, false)): the TeX the
// tools write beyond the README subset reads as text (TXP, 2026-11-07). Before, the unknown command's name was printed:
// "W_f = 30.00 mathrmkips", "x = ±tfracB2", "DCR = mathbf0.70 checkmark". The HTML path (toHTML) is not changed.
// The TeX inputs are written with String.raw (R`…`), so each backslash in the source is one backslash in the string.
import assert from 'node:assert/strict';
import { loadShared, test } from './harness.mjs';

const S = loadShared('units.js', 'steps.js').SharedSteps;   // no window.katex: toHTML is the built-in renderer
const T = S.toText, R = String.raw;

test('toText: font and wrapper commands give their content (mathrm, mathbf, operatorname, boxed, textcolor)', () => {
  assert.equal(T(R`W_f = 30.00\;\mathrm{kips}`), 'W_f = 30.00 kips');
  assert.equal(T(R`A = 80.00\;\mathrm{ft^2}`), 'A = 80.00 ft^2');
  assert.equal(T(R`\mathrm{DCR} = 6.03/8.62 = \mathbf{0.70}\;\checkmark`), 'DCR = 6.03/8.62 = 0.70 ✓');
  assert.equal(T(R`\mathrm{ft\;available\;above}`), 'ft available above');
  assert.equal(T(R`\theta = \mathrm{atan2}(M_{ux}, M_{uy})`), 'θ = atan2(M_(ux), M_(uy))');
  assert.equal(T(R`\operatorname{sgn}(x) \boxed{1.25} \textbf{OK}`), 'sgn(x) 1.25 OK');
  assert.equal(T(R`\textcolor{red}{\text{NG}}`), 'NG');
  assert.equal(T(R`\mathrm{kip\text{-}ft}`), 'kip-ft');
});

test('toText: dfrac / tfrac as frac ((a)/(b); a single atom without parentheses)', () => {
  assert.equal(T(R`x = \pm\tfrac{B}{2}`), 'x = ±B/2');
  assert.equal(T(R`\dfrac{2+B'/L'}{1+B'/L'}`), "(2+B'/L')/(1+B'/L')");
  assert.equal(T(R`\frac{a+b}{c}`), '(a+b)/c');
  assert.equal(T(R`\tfrac{1}{2}\gamma B`), '1/2γ B');
});

test('toText: Greek commands and their variants as Unicode letters', () => {
  assert.equal(T(R`\phi \gamma \delta \epsilon \lambda \rho \sigma \tau \theta \Delta`), 'φ γ δ ε λ ρ σ τ θ Δ');
  assert.equal(T(R`\varphi \vartheta \varepsilon \kappa \nu \Gamma \Omega \Phi`), 'φ θ ε κ ν Γ Ω Φ');
  assert.equal(T(R`\varphi^*`), 'φ^*');
});

test('toText: operators and relations (cdot, times, le, ge, leq, geq, neq, Rightarrow, floor)', () => {
  assert.equal(T(R`a \cdot b \times c`), 'a · b × c');
  assert.equal(T(R`a \le b \ge c \leq d \geq e \neq f`), 'a ≤ b ≥ c ≤ d ≥ e ≠ f');
  assert.equal(T(R`0.29 \le 1 \;\Rightarrow\; \text{full contact}`), '0.29 ≤ 1  ⇒  full contact');
  assert.equal(T(R`\lfloor x \rfloor`), '⌊ x ⌋');
});

test('toText: sqrt, sqrt[n], sub- and superscripts', () => {
  assert.equal(T(R`\sqrt{f'_{c}}`), "√(f'_c)");
  assert.equal(T(R`\sqrt[3]{x}`), '3√(x)');
  assert.equal(T(R`M_{u,strip} + I^{2} + q_1`), 'M_(u,strip) + I^2 + q_1');
});

test('toText: left / right, big, spacing commands', () => {
  assert.equal(T(R`\left(\frac{a}{b}\right)^{2}`), '(a/b)^2');
  assert.equal(T(R`\left.x\right|_{0}`), 'x|_0');
  assert.equal(T(R`\big(x\big)`), '(x)');
  assert.equal(T(R`e_x = 0.49\;\mathrm{ft},\qquad e_y = 0.00`), 'e_x = 0.49 ft,   e_y = 0.00');
  assert.equal(T(R`a\quad b\,c\!d\:e`), 'a  b cd e');
  assert.equal(T(R`\mu = \tan\!\left(\tfrac{2}{3}\varphi\right)`), 'μ = tan (2/3φ)');
  assert.equal(T(R`\displaystyle x`), 'x');
});

test('toText: operator names (cos, sin, cot, log) spaced as tan', () => {
  assert.equal(T(R`m = m_x\cos^2\theta + m_y\sin^2\theta`), 'm = m_x cos^2θ + m_y sin^2θ');
  assert.equal(T(R`(N_q-1)\cot\varphi`), '(N_q-1) cot φ');
  assert.equal(T(R`\log x`), 'log x');
});

test('toText: cases, line breaks, alignment, escaped &', () => {
  assert.equal(T(R`n = \begin{cases} a & x \le 6 \\ b & x > 6 \end{cases}`), 'n = {  a   x ≤ 6 ;  b   x > 6 ');
  assert.equal(T(R`a \& b`), 'a & b');
});

test('toText: the README subset renders as before (frac, bar, text, sum, minus, circ, {,})', () => {
  assert.equal(T(R`\frac{\sum A y}{\sum A}`), '(Σ A y)/(Σ A)');
  assert.equal(T(R`\bar{y}_{s}`), 'ȳ_s');
  assert.equal(T(R`\text{if } x`), 'if  x');
  assert.equal(T(R`a \minus b`), 'a − b');
  assert.equal(T(R`\tan 30.00^{\circ}`), 'tan 30.00°');
  assert.equal(T(R`51{,}050`), '51,050');
  assert.equal(T(R`\max(a, b)`), 'max(a, b)');
});

test('toHTML (built-in renderer): the subset unchanged by the plain-text converter; commands outside it now in HTML (TXH, steps-tohtml.test.mjs)', () => {
  // TXP was plain text only; since TXH (2026-11-07) the built-in HTML path converts the same commands (see steps-tohtml.test.mjs)
  assert.equal(S.toHTML(R`W_f = 30.00\;\mathrm{kips}`), 'W<sub>f</sub> = 30.00&thinsp;kips');
  assert.equal(S.toHTML(R`\frac{a}{b}`), '<span class="st-frac"><span class="st-num">a</span><span class="st-den">b</span></span>');
  assert.equal(S.toHTML(R`a \& b`), 'a &amp; b');
});

test('line(step, false): a step in the tool notation reads as text; the value and its digits are unchanged', () => {
  const st = { id: 'sf.W', label: 'Footing self-weight', sym: 'W_{f}', eq: R`B L t \gamma_{c}`, sub: R`10.00 \cdot 8.00 \cdot 2.50 \cdot 0.15\;\mathrm{kcf}`, value: 30, unit: 'kips', d: 2 };
  assert.equal(S.line(st, false), 'W_f = B L t γ_c = 10.00 · 8.00 · 2.50 · 0.15 kcf = 30.00 kips');
});

test('toText(s, { legacy: true }), line(…, false, o), SharedReport.text(doc, o): the plain text as before TXP (the tools that compare it with their tabs)', () => {
  assert.equal(T(R`W_f = 30.00\;\mathrm{kips}`, { legacy: true }), 'W_f = 30.00 mathrmkips');
  assert.equal(T(R`x = \pm\tfrac{B}{2}`, { legacy: true }), 'x = ±tfracB2');
  assert.equal(T(R`\frac{a+b}{c} \le \phi`, { legacy: true }), T(R`\frac{a+b}{c} \le \phi`));   // the subset: the same either way
  const st = { id: 'a.W', label: 'W', sym: 'W_{f}', eq: '', sub: R`0.15\;\mathrm{kcf}`, value: 30, unit: 'kips', d: 2 };
  assert.equal(S.line(st, false, { legacy: true }), 'W_f = 0.15 mathrmkcf = 30.00 kips');
  const W = loadShared('units.js', 'steps.js', 'report.js'), SR = W.SharedReport;
  const doc = SR.build({ title: 'T', sections: [{ title: 'S', subs: [{ title: R`Cell $\mathrm{DCR}$`, items: [{ type: 'steps', steps: [W.SharedSteps.step(st)] }, { type: 'note', text: R`$\tfrac{1}{2}\varphi$` }] }] }] });
  const t = SR.text(doc), l = SR.text(doc, { legacy: true });
  assert.ok(t.includes('1.1 Cell DCR') && t.includes('W_f = 0.15 kcf = 30.00 kips') && t.includes('1/2φ'), t);
  assert.ok(l.includes('1.1 Cell mathrmDCR') && l.includes('W_f = 0.15 mathrmkcf = 30.00 kips') && l.includes('tfrac12varphi'), l);
});
