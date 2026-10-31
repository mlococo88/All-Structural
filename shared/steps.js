/* shared/steps.js — worked calculation steps (window.SharedSteps).
   Classic script, no DOM at load (wire() and the print hook touch the page only in a browser). Created 2026-10-29 (Steel Bridge rebuild, docs/REBUILD_PLAN.md §5): every engine function
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
   \prime, \ell, \tan, \circ (30^{\circ} -> 30°), '\,' (thin space). Nothing else. toText() renders it without any library; toHTML() with KaTeX when window.katex
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
    lt: '<', gt: '>', ne: '≠', pm: '±', minus: '−', prime: '′', infty: '∞', to: '→', approx: '≈', ldots: '…', max: 'max', min: 'min',
    ell: 'ℓ', tan: 'tan', circ: '°' };   // ell, tan, circ: added 2026-10-29 (the engines' \ell, \tan θ, 30^{\circ}); before, the words "ell", "tan", "circ"
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
        else if (cmd === 'tan') { out += SYM.tan; if (/^[A-Za-z\\{]/.test(src.slice(i))) out += html ? '&thinsp;' : ' '; }   // \tan\theta -> 'tan θ' (as KaTeX spaces an operator)
        else out += SYM[cmd] != null ? SYM[cmd] : cmd;
      } else if (c === '_' || c === '^') {
        i++; const a = render(group(), html);
        if (c === '^' && a === '°') { out += '°'; continue; }   // 30^{\circ} -> '30°' (a degree sign, not a raised '°')
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
  /* line(step, html): the one-line rendering  sym = eq = sub = value unit
     With KaTeX, sym, eq and sub are set in display style (full-size fractions) and a numeric value with its unit is set by
     KaTeX too (same digits as fmt), so the whole line is in one typeface; a string value stays as it is. */
  function line(s, html) {
    const K = html ? kx() : null, D = t => K.renderToString('\\displaystyle ' + t, KATEX_OPT);
    const R = K ? D : html ? toHTML : toText, parts = [];
    if (s.sym) parts.push(R(s.sym));
    if (s.eq) parts.push(R(s.eq));
    if (s.sub && s.sub !== s.eq) parts.push(R(s.sub));
    const v = typeof s.value === 'number' ? fmt(s.value, s.d) : s.value == null ? '' : String(s.value);
    if (v !== '' && K && typeof s.value === 'number') parts.push(K.renderToString(v + (s.unit ? '\\;' + unitTeX(s.unit) : ''), KATEX_OPT));
    else if (v !== '') parts.push(v + (s.unit ? (html ? '&nbsp;' : ' ') + (K ? toHTML(unitTeX(s.unit)) : R(s.unit)) : ''));
    return parts.join(' = ');
  }

  /* ---------- topics: grouped worked steps (presentation spec A, 2026-10-31; first used on the Steel Bridge Shear & stiffeners tab) ----------
     A long step list reads as topics, each with a one-line result, in the standard order of a check: inputs and geometry, section properties,
     demands, intermediate quantities (one topic per code sub-article), resistance, check. Presentation only: the steps, their ids and values are
     not changed or copied; group() only sorts them into topics (every step lands in exactly one, in its original order within the topic).
       group(steps, topics, opt) -> [{ key, title, ref, see, steps, res, ratio, cls, chip }]
         topics: [{ key, title, ref?, see?, ids: RegExp | (id) => bool, res?: RegExp (the step, by id, that sums up a topic without a test) }] tested in order on each step id without its work prefix (opt.strip,
                 default /^[^.]+\./: 'ts3.p1.Vn' -> 'p1.Vn'); the first match takes the step; steps no topic takes go to a last topic
                 'other' ('Other steps'); topics with no step are left out. Topic order = the order of topics.
         res    the topic's result step: its governing test step (ok === false first, else the largest ratio), else its last step with a value
         ratio  the largest ratio of its test steps (a test step whose value is a number without a unit: demand / capacity), NaN if none
         cls    'ng' (a test fails or a ratio > 1), 'hi' (ratio >= opt.hi, default 0.9), 'ok', or '' (no test step); chip: the text of the status chip
       summary(t, html) -> the one-line result of topic t: "label: sym = value unit" of its result step (KaTeX / built-in, as line())
       groupsHTML(groups, o) -> HTML: an Expand all / Collapse all bar and one <details class="sg-t" data-sgk="key"> per topic (closed unless
         o.open has its key) with the summary line and status chip; o.item(step) -> the HTML of one step (the page's own step rendering, so step
         anchors such as id="st-<step id>" stay as they were); o.see(t) -> optional HTML after the topic title (a link to where a value is worked).
       wire(root, o) (browser) -> the Expand all / Collapse all buttons inside root, and o.onToggle(key, open) when a topic opens or closes.
       CSS: SharedSteps.groupCss (class prefix sg-), for the page to add once. On print every topic is opened (beforeprint) and closed again. */
  const fin = v => typeof v === 'number' && isFinite(v);
  const isRatio = s => s.ok !== undefined && typeof s.value === 'number' && !s.unit;
  function group(steps, topics, opt) {
    opt = opt || {}; const strip = opt.strip || /^[^.]+\./, hi = opt.hi != null ? opt.hi : 0.9;
    const T = (topics || []).map(t => ({ key: t.key, title: t.title, ref: t.ref || '', see: t.see || '', test: t.ids, pick: t.res, steps: [] })), other = { key: 'other', title: 'Other steps', ref: '', see: '', steps: [] };
    (steps || []).forEach(s => { const id = String(s.id).replace(strip, ''), t = T.find(q => (typeof q.test === 'function' ? q.test(id, s) : q.test.test(id))); (t || other).steps.push(s); });
    return T.concat([other]).filter(t => t.steps.length).map(t => {
      const tests = t.steps.filter(s => s.ok !== undefined), rs = tests.filter(isRatio), ng = tests.find(s => s.ok === false);
      const ratio = rs.length ? Math.max(...rs.map(s => (fin(s.value) ? s.value : Infinity))) : NaN;
      const gov = ng || (rs.length ? rs.reduce((a, b) => ((fin(b.value) ? b.value : Infinity) > (fin(a.value) ? a.value : Infinity) ? b : a)) : tests[tests.length - 1]);
      const res = gov || (t.pick && t.steps.find(s => t.pick.test(String(s.id).replace(strip, '')))) || [...t.steps].reverse().find(s => s.value != null && s.value !== '') || t.steps[t.steps.length - 1];
      const cls = !tests.length ? '' : ng || ratio > 1 + 1e-9 || Number.isNaN(ratio) && rs.length ? 'ng' : ratio >= hi ? 'hi' : 'ok';
      const chip = !tests.length ? '' : rs.length ? (fin(ratio) ? fmt(ratio, 3) : '∞') + (ng ? ' NG' : '') : ng ? 'NG' : 'OK';
      return { key: t.key, title: t.title, ref: t.ref, see: t.see, steps: t.steps, res, ratio, cls, chip };
    });
  }
  /* summary: inline notation (not display style), so the line stays one line high */
  function summary(t, html) {
    const s = t.res; if (!s) return '';
    const R = html ? toHTML : toText, lab = html ? esc(s.label) : s.label, sym = s.sym ? R(s.sym) : '';
    if (isRatio(s)) return `${lab}${sym ? ': ' + sym : ''}`;
    const v = typeof s.value === 'number' ? R(fmt(s.value, s.d) + (s.unit ? (html ? '\\;' : ' ') + (html ? unitTeX(s.unit) : s.unit) : '')) : s.value == null ? '' : html ? esc(String(s.value)) : String(s.value);
    return `${lab}${v ? ': ' + (sym && typeof s.value === 'number' ? sym + ' = ' : '') + v : ''}`;
  }
  const attr = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function groupsHTML(groups, o) {
    o = o || {}; const open = o.open || new Set();
    return `<div class="sg"><div class="sg-bar"><span class="sg-hint">${groups.length} topics; click a topic for its worked steps.</span><button type="button" data-sgall="1">Expand all</button><button type="button" data-sgall="0">Collapse all</button></div>`
      + groups.map((t, k) => `<details class="sg-t${t.cls ? ' sg-' + t.cls : ''}" data-sgk="${attr(t.key)}"${open.has(t.key) ? ' open' : ''}><summary><span class="sg-n">${k + 1}</span><span class="sg-h"><span class="sg-ttl">${esc(t.title)}</span>${t.ref ? `<span class="sg-ref">${esc(t.ref)}</span>` : ''}${o.see ? o.see(t) || '' : ''}<span class="sg-sum">${summary(t, true)}</span></span>${t.chip ? `<span class="sg-chip">${esc(t.chip)}</span>` : ''}</summary>`
        + `<ol class="steps">${t.steps.map(s => (o.item ? o.item(s) : `<li>${esc(s.label)}: ${line(s, true)}</li>`)).join('')}</ol></details>`).join('') + '</div>';
  }
  function wire(root, o) {
    o = o || {}; if (!root || !root.addEventListener) return;
    root.querySelectorAll('[data-sgall]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); const on = b.dataset.sgall === '1', box = b.closest('.sg') || root;
      box.querySelectorAll('details.sg-t').forEach(d => { if (d.open !== on) d.open = on; }); }));
    root.querySelectorAll('details.sg-t').forEach(d => d.addEventListener('toggle', () => { if (o.onToggle) o.onToggle(d.dataset.sgk, d.open); }));
  }
  const groupCss = `.sg-bar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:4px 0 6px;} .sg-bar .sg-hint{flex:1;font-size:8.5pt;color:#64748b;}
    .sg-bar button{font-size:9pt;padding:2px 10px;}
    details.sg-t{border:1px solid #d6dde6;border-radius:4px;margin:4px 0;background:#fff;} details.sg-t>summary{display:flex;gap:8px;align-items:flex-start;cursor:pointer;padding:5px 8px;list-style:none;}
    details.sg-t>summary::-webkit-details-marker{display:none;} details.sg-t>summary::before{content:'\\25B8';color:#64748b;flex:none;} details.sg-t[open]>summary::before{content:'\\25BE';}
    details.sg-t[open]>summary{border-bottom:1px solid #e5e9ef;background:#f6f8fb;} details.sg-t>ol.steps{margin:0;padding:2px 10px 6px;}
    .sg-n{flex:none;font-weight:600;color:#475569;min-width:1.2em;} .sg-h{flex:1;min-width:0;} .sg-ttl{font-weight:600;} .sg-ref{font-size:8pt;color:#64748b;margin-left:6px;} .sg-see{font-size:8.5pt;margin-left:6px;}
    .sg-sum{display:block;font-size:9pt;color:#334155;overflow-wrap:anywhere;} .sg-sum .katex{font-size:1em;}
    .sg-chip{flex:none;font:600 9pt/1.4 system-ui,sans-serif;padding:1px 8px;border-radius:9px;background:#e2e8f0;color:#1e293b;white-space:nowrap;}
    .sg-ok>summary .sg-chip{background:#1a8a3a;color:#fff;} .sg-hi>summary .sg-chip{background:#d9a400;color:#1e293b;} .sg-ng>summary .sg-chip{background:#c62828;color:#fff;}
    @media print{details.sg-t{break-inside:auto;} .sg-bar{display:none;}}`;
  // printing (Ctrl+P on a tab): every topic open, then back as it was
  if (typeof window !== 'undefined' && window.addEventListener && typeof document !== 'undefined') {
    let opened = [];
    window.addEventListener('beforeprint', () => { opened = Array.from(document.querySelectorAll('details.sg-t:not([open])')); opened.forEach(d => { d.open = true; }); });
    window.addEventListener('afterprint', () => { opened.forEach(d => { d.open = false; }); opened = []; });
  }

  window.SharedSteps = { step, work, n, g, fmt, toHTML, toText, line, unitTeX, katexOpt: KATEX_OPT, group, summary, groupsHTML, wire, groupCss };
})();
