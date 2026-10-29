/* shared/steps.js — worked calculation steps (window.SharedSteps).
   Classic script, no DOM. Created 2026-10-29 (Steel Bridge rebuild, docs/REBUILD_PLAN.md §5): every engine function
   returns its values and the steps that work them out, and the screen, the printed report and the tests all render
   those same steps. The format is documented in shared/README.md ("Worked steps"); keep the two in step.

   A step is a plain object:
     { id, label, sym, eq, sub, value, unit, d, ref, note, ok }
       id     stable key, unique within one result, dotted ('sec.cn.yb'); links and "see §x.y" point to it
       label  what the step finds, in words
       sym    symbol of the result (equation notation, below)
       eq     the equation in symbols, without the result symbol ('\frac{\sum A y}{\sum A}')
       sub    the same equation with the values substituted (numbers already formatted)
       value  the result: a full-precision number, or a string for a non-numeric outcome (a case, a yes/no)
       unit   unit of value ('in', 'in^{2}', 'kip-ft', '' for none)
       d      decimals to show value with (display only; value is never rounded)
       ref    code reference with its edition, 'AASHTO LRFD 10th Ed. Eq. D6.1-…' ('' if none)
       note   optional remark (a condition, why a case was chosen)
       ok     optional: true / false for a test step (a condition met or not); undefined otherwise
   It renders as:  label:  sym = eq = sub = value unit   (ref)

   Equation notation (eq, sub, sym, unit): a small TeX subset that is also valid KaTeX, so that the built-in renderer and
   KaTeX (toHTML, when the page has loaded it; 2026-10-29) show the same strings: _{…} subscript, ^{…} superscript, \frac{a}{b}, \bar{x}, \sqrt{x}, \text{…},
   Greek letters (\gamma, \phi, \lambda, \beta, \rho, …), \sum, \cdot, \times, \le, \ge, \lt, \gt, \ne, \pm, \minus,
   \prime, '\,' (thin space). Nothing else. toText() renders it without any library; toHTML() with KaTeX when window.katex
   exists, else without (see below). tests/engine/tex.test.mjs parses every step string of the engine tests with KaTeX. */
(function () {
  'use strict';
  const fmt = (x, d) => {
    if (typeof x !== 'number' || !isFinite(x)) return '—';
    const s = x.toFixed(d == null ? 2 : d); return /^-0(\.0*)?$/.test(s) ? s.slice(1) : s;
  };
  /* n(x, d): a number for a substitution; d decimals (default 2); negative values in parentheses are the caller's choice. */
  const n = (x, d) => fmt(x, d);
  /* g(x): thousands grouped, rounded to d decimals (default 0), for large values such as I and Mp. */
  const g = (x, d) => {
    if (typeof x !== 'number' || !isFinite(x)) return '—';
    const s = fmt(x, d == null ? 0 : d), [i, f] = s.split('.');
    return i.replace(/\B(?=(\d{3})+(?!\d))/g, '{,}') + (f ? '.' + f : '');
  };

  const KEYS = ['id', 'label', 'sym', 'eq', 'sub', 'value', 'unit', 'd', 'ref', 'note', 'ok'];
  function step(o) {
    if (!o || !o.id || !o.label) throw new Error('SharedSteps.step: id and label are required');
    const s = {};
    KEYS.forEach(k => { s[k] = o[k] === undefined ? (k === 'value' ? null : k === 'd' ? 2 : k === 'ok' ? undefined : '') : o[k]; });
    if (s.ok === undefined) delete s.ok;
    return s;
  }
  /* work(prefix): a collector. w.add({...}) stores a step (id prefixed with 'prefix.') and returns its value, so an
     engine writes  const yb = w.add({ id: 'yb', …, value: … });  w.steps is the list, in order. */
  function work(prefix) {
    const steps = [];
    return {
      steps,
      add(o) { const s = step({ ...o, id: prefix ? prefix + '.' + o.id : o.id }); steps.push(s); return s.value; },
      take(list) { (list || []).forEach(s => steps.push(s)); }
    };
  }

  /* ---------- rendering of the equation notation ---------- */
  const SYM = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ', epsilon: 'ε', eta: 'η', theta: 'θ', lambda: 'λ', mu: 'μ', pi: 'π',
    rho: 'ρ', sigma: 'σ', Sigma: 'Σ', tau: 'τ', phi: 'φ', psi: 'ψ', omega: 'ω', chi: 'χ', sum: 'Σ', cdot: '·', times: '×', le: '≤', ge: '≥',
    lt: '<', gt: '>', ne: '≠', pm: '±', minus: '−', prime: '′', infty: '∞', to: '→', approx: '≈', ldots: '…', max: 'max', min: 'min' };
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function render(src, html) {
    let i = 0;
    const group = () => {   // the next {…} group or single character / command
      while (src[i] === ' ') i++;
      if (src[i] === '{') { let depth = 0, j = i; for (; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}' && --depth === 0) break; }
        const inner = src.slice(i + 1, j); i = j + 1; return inner; }
      if (src[i] === '\\') { const m = /^\\([A-Za-z]+|.)/.exec(src.slice(i)); i += m[0].length; return m[0]; }
      return src[i++] || '';
    };
    const atom = s => /^[\p{L}\p{N}_.′\u0304]*$/u.test(s.replace(/<[^>]+>/g, ''));
    let out = '';
    while (i < src.length) {
      const c = src[i];
      if (c === '\\') {
        const m = /^\\([A-Za-z]+|.)/.exec(src.slice(i)); i += m[0].length; const cmd = m[1];
        if (cmd === 'frac') { const a = render(group(), html), b = render(group(), html);
          out += html ? `<span class="st-frac"><span class="st-num">${a}</span><span class="st-den">${b}</span></span>` : `${atom(a) ? a : '(' + a + ')'}/${atom(b) ? b : '(' + b + ')'}`; }
        else if (cmd === 'bar') { const a = render(group(), html); out += html ? `<span class="st-bar">${a}</span>` : a.length === 1 ? (a + '\u0304').normalize('NFC') : 'bar(' + a + ')'; }   // HTML: an overline (CSS .st-bar), whatever the font has
        else if (cmd === 'sqrt') { const a = render(group(), html); out += '√' + (html ? `<span class="st-bar">${a}</span>` : '(' + a + ')'); }
        else if (cmd === 'text') { const a = group(); out += html ? esc(a) : a; }
        else if (cmd === ',' || cmd === ' ' || cmd === ';') out += html ? '&thinsp;' : ' ';
        else if (cmd === '{' || cmd === '}' || cmd === '%' || cmd === '_') out += cmd;
        else if (cmd === 'left' || cmd === 'right') { /* the bracket that follows is printed as is */ }
        else out += SYM[cmd] != null ? SYM[cmd] : cmd;
      } else if (c === '_' || c === '^') {
        i++; const a = render(group(), html);
        out += html ? (c === '_' ? `<sub>${a}</sub>` : `<sup>${a}</sup>`) : (c === '_' ? '_' : '^') + (a.length > 1 ? '(' + a + ')' : a);
      } else if (c === '{' ) { out += render(group(), html); }
      else { out += html ? esc(c) : c; i++; }
    }
    return out;
  }
  /* KaTeX (approved 2026-10-29): when the page has loaded it (window.katex), toHTML renders with it; otherwise (offline, CDN
     blocked) with the built-in renderer above, so the steps always show. toText (plain-text report) never uses it.
     \minus is the subset's own macro (KaTeX has none): it is given to KaTeX as a minus sign. */
  const KATEX_OPT = { throwOnError: false, strict: 'ignore', macros: { '\\minus': '-' } };
  const kx = () => (typeof window !== 'undefined' && window.katex && typeof window.katex.renderToString === 'function') ? window.katex : null;
  /* unitTeX(u): a unit as KaTeX source, its words upright ('kip-ft' -> '\text{kip-ft}', 'in^{2}' -> '\text{in}^{2}'); the built-in
     renderer shows units as typed, so this is used for KaTeX only. */
  const unitTeX = u => String(u == null ? '' : u).replace(/[A-Za-z][A-Za-z\-\/. ]*/g, (m, at, all) => at > 0 && all[at - 1] === '\\' ? m : `\\text{${m}}`);
  const toHTML = s => { const t = String(s == null ? '' : s), K = kx(); return K && t ? K.renderToString(t, KATEX_OPT) : render(t, true); };
  const toText = s => render(String(s == null ? '' : s), false);
  /* line(step, html): the one-line rendering  sym = eq = sub = value unit */
  function line(s, html) {
    const R = html ? toHTML : toText, parts = [];
    if (s.sym) parts.push(R(s.sym));
    if (s.eq) parts.push(R(s.eq));
    if (s.sub && s.sub !== s.eq) parts.push(R(s.sub));
    const v = typeof s.value === 'number' ? fmt(s.value, s.d) : s.value == null ? '' : String(s.value);
    if (v !== '') parts.push(v + (s.unit ? (html ? '&nbsp;' : ' ') + (html && kx() ? toHTML(unitTeX(s.unit)) : R(s.unit)) : ''));
    return parts.join(' = ');
  }

  window.SharedSteps = { step, work, n, g, fmt, toHTML, toText, line, unitTeX, katexOpt: KATEX_OPT };
})();
