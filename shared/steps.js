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
       note   optional remark (a condition, why a case was chosen). A string, or (SNL, 2026-11-08) a list note for a long remark:
              { lead, items: [[lead, text] | text, …], action? } — a bold lead, then bullets with bold lead words; action (a string or a
              list of strings: "Input needed…", "Decision (pending engineer review): …") on its own line(s) first, in warning style.
              noteParts(note) / noteText(note) below; shared/report.js renders it (screen, print, plain text). A string note is unchanged.
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
  /* ---------- list notes (SNL, 2026-11-08): a step note as a lead and bullets ----------
     noteParts(note) -> null for a string note (or none); for a list note { action: [string…], lead: string, items: [[lead, text]…] }
                        (an item given as a plain string becomes ['', text]; empty items are dropped).
     noteSep(lead)   -> ' ' when the item lead already ends in punctuation (':', '.', '?', '!', '—'), else ': '.
     noteText(note)  -> the note as plain text: a string note as it is; a list note as lines: each action, the lead, then
                        '• lead: text' per item, joined with '\n'. */
  const noteParts = note => {
    if (!note || typeof note !== 'object' || Array.isArray(note)) return null;
    const str = v => (v == null ? '' : String(v));
    const action = (Array.isArray(note.action) ? note.action : note.action != null && note.action !== '' ? [note.action] : []).map(str).filter(Boolean);
    const items = (note.items || []).map(t => (Array.isArray(t) ? [str(t[0]), str(t[1])] : ['', str(t)])).filter(t => t[0] || t[1]);
    return { action, lead: str(note.lead), items };
  };
  const noteSep = lead => (/[:.?!\u2014]$/.test(lead) ? ' ' : ': ');
  const noteText = note => {
    const P = noteParts(note); if (!P) return note == null ? '' : String(note);
    return P.action.concat(P.lead ? [P.lead] : [], P.items.map(([l, t]) => '• ' + (l ? l + (t ? noteSep(l) : '') : '') + t)).join('\n');
  };
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
  /* TXP (2026-11-07): the plain-text path only (toText, render(…, false)): the TeX the tools write beyond the subset above
     (\mathrm{kips}, \tfrac, \qquad, \varphi, \checkmark, \begin{cases}, …) as readable text instead of the command names
     ("mathrmkips", "tfrac", "qquad"). TXP itself left the HTML path (toHTML without KaTeX, the report's inline notation) as it was. Display only.
     TXH (2026-11-07): the same commands on the built-in HTML path (toHTML without KaTeX, line()/summary() without KaTeX, and the report's
     $…$ in titles, notes and cells), as HTML: fractions stacked (.st-frac), sub/superscripts, Unicode symbols, cases / aligned / matrices as
     an inline table. The KaTeX path, the plain text (TXP) and toText's legacy option are unchanged. Display only. */
  const TSYM = { varphi: 'φ', vartheta: 'θ', varepsilon: 'ε', varrho: 'ρ', varsigma: 'σ', kappa: 'κ', nu: 'ν', xi: 'ξ', zeta: 'ζ', iota: 'ι',
    upsilon: 'υ', Gamma: 'Γ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω', Upsilon: 'Υ',
    leq: '≤', geq: '≥', leqslant: '≤', geqslant: '≥', neq: '≠', mp: '∓', div: '÷', ast: '*', star: '*', bullet: '•', checkmark: '✓',
    Rightarrow: '⇒', rightarrow: '→', Leftarrow: '⇐', leftarrow: '←', Leftrightarrow: '⇔', leftrightarrow: '↔', implies: '⇒', iff: '⇔',
    uparrow: '↑', downarrow: '↓', Uparrow: '⇑', Downarrow: '⇓', mapsto: '↦', perp: '⊥', parallel: '∥', sim: '~', simeq: '≃', cong: '≅',
    equiv: '≡', propto: '∝', in: '∈', notin: '∉', subset: '⊂', cup: '∪', cap: '∩', forall: '∀', exists: '∃', partial: '∂', nabla: '∇',
    int: '∫', iint: '∬', oint: '∮', prod: 'Π', cdots: '⋯', dots: '…', dotsb: '⋯', dotsc: '…', vdots: '⋮', angle: '∠', deg: '°',
    lfloor: '⌊', rfloor: '⌋', lceil: '⌈', rceil: '⌉', langle: '⟨', rangle: '⟩', vert: '|', Vert: '‖', mid: '|', lvert: '|', rvert: '|',
    lbrack: '[', rbrack: ']', lbrace: '{', rbrace: '}', backslash: '\\', '|': '‖', colon: ':', ll: '≪', gg: '≫', triangle: '△', square: '□', degree: '°' };
  const HSYM = { textendash: '–', textemdash: '—', cdotp: '·', circlearrowleft: '↺', circlearrowright: '↻', emptyset: '∅', varnothing: '∅' };   // TXH: HTML path only
  const TFRAC = /^(dfrac|tfrac|cfrac)$/;
  const TWRAP = /^(mathrm|mathbf|mathit|mathsf|mathtt|mathnormal|mathcal|mathbb|mathscr|textrm|textbf|textit|textsf|texttt|textup|textnormal|emph|operatorname|boldsymbol|bm|boxed|mathrel|mathbin|mathop|mathord|mathopen|mathclose|mathpunct|overbrace|underbrace|underline|hbox|mbox|fbox)$/;
  const TDROP = /^(displaystyle|textstyle|scriptstyle|scriptscriptstyle|limits|nolimits|relax|big|Big|bigg|Bigg|bigl|bigr|Bigl|Bigr|biggl|biggr|Biggl|Biggr|middle|nonumber|notag|centering|small|tiny|large|Large|normalsize|footnotesize)$/;
  const TOPS = /^(sin|cos|cot|sec|csc|arcsin|arccos|arctan|sinh|cosh|tanh|coth|log|ln|lg|exp|lim|det|arg|sgn)$/;
  const TACC = { hat: '\u0302', widehat: '\u0302', tilde: '\u0303', widetilde: '\u0303', vec: '\u20D7', dot: '\u0307', ddot: '\u0308', overline: '\u0304', check: '\u030C', breve: '\u0306', acute: '\u0301', grave: '\u0300' };
  function render(src, html, rd) {   // rd (TXP): plain text, readable (toText default); false: the plain text as before TXP (opt.legacy)
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
    /* TXP: one command of the plain-text path (true: handled); the subset's own commands fall through to the shared code below */
    const txt = cmd => {
      if (TFRAC.test(cmd)) { const a = render(group(), false, true), b = render(group(), false, true); out += `${atom(a) ? a : '(' + a + ')'}/${atom(b) ? b : '(' + b + ')'}`; return true; }
      if (TWRAP.test(cmd)) { out += render(group(), false, true); return true; }
      if (TDROP.test(cmd)) { while (src[i] === ' ') i++; return true; }
      if (cmd === 'textcolor' || cmd === 'colorbox') { group(); out += render(group(), false, true); return true; }
      if (cmd === 'color' || cmd === 'phantom' || cmd === 'hphantom' || cmd === 'vphantom' || cmd === 'label') { group(); return true; }
      if (cmd === 'stackrel' || cmd === 'overset' || cmd === 'underset') { group(); out += render(group(), false, true); return true; }
      if (cmd === 'quad') { out += ' '; return true; }
      if (cmd === 'qquad') { out += '  '; return true; }
      if (cmd === '!' || cmd === 'negthinspace' || cmd === 'allowbreak') return true;
      if (cmd === ':' || cmd === '>' || cmd === 'thinspace' || cmd === 'medspace' || cmd === 'thickspace' || cmd === 'enspace') { out += ' '; return true; }
      if (/^(kern|mkern|hskip|mskip|hspace|vspace)$/.test(cmd)) { const m = /^\s*(\{[^}]*\}|-?[\d.]+\s*[a-z]{2})/.exec(src.slice(i)); if (m) i += m[0].length; return true; }
      if (cmd === '\\') { out += '; '; return true; }   // a line break (cases, aligned)
      if (cmd === '&' || cmd === '#' || cmd === '$') { out += cmd; return true; }
      if (cmd === 'begin') { const env = group(); if (/^cases/.test(env)) out += '{ '; else if (/^[a-z]*matrix/.test(env) || env === 'array') { if (env === 'array') group(); out += '['; } return true; }
      if (cmd === 'end') { const env = group(); if (/^[a-z]*matrix/.test(env) || env === 'array') out += ']'; return true; }
      if (cmd === 'left' || cmd === 'right') { if (src[i] === '.') i++; return true; }   // \left. / \right. (no bracket): nothing; any other bracket follows as is
      if (cmd === 'sqrt' && src[i] === '[') { const j = src.indexOf(']', i); const n = render(src.slice(i + 1, j), false, true); i = j + 1; out += n + '√(' + render(group(), false, true) + ')'; return true; }
      if (cmd === 'tag') { out += ' (' + render(group(), false, true) + ')'; return true; }
      if (TACC[cmd] != null) { const a = render(group(), false, true); out += [...a].length === 1 ? (a + TACC[cmd]).normalize('NFC') : cmd.replace(/^wide/, '') + '(' + a + ')'; return true; }
      if (cmd === 'not') { const a = render(group(), false, true); out += a === '=' ? '≠' : a + '\u0338'; return true; }
      if (TOPS.test(cmd)) { out += (/[\p{L}\p{N})]$/u.test(out) ? ' ' : '') + cmd; if (/^[A-Za-z\\{]/.test(src.slice(i))) out += ' '; return true; }   // \cos\theta -> 'cos θ' (as \tan)
      if (TSYM[cmd] != null) { out += TSYM[cmd]; return true; }
      return false;
    };
    /* TXH: one command of the built-in HTML path (true: handled), as txt() for the plain text; the subset's own commands fall through */
    const htm = cmd => {
      const R = t => render(t, true, true);
      if (TFRAC.test(cmd)) { const a = R(group()), b = R(group()); out += `<span class="st-frac"><span class="st-num">${a}</span><span class="st-den">${b}</span></span>`; return true; }
      if (TWRAP.test(cmd)) { const a = R(group());
        out += /^(mathbf|textbf|boldsymbol|bm)$/.test(cmd) ? `<b>${a}</b>` : /^(mathit|textit|emph)$/.test(cmd) ? `<i>${a}</i>` : /^(boxed|fbox)$/.test(cmd) ? `<span class="st-box" style="border:1px solid currentColor;padding:0 2px">${a}</span>`
          : cmd === 'underline' ? `<u>${a}</u>` : a; return true; }
      if (TDROP.test(cmd)) { while (src[i] === ' ') i++; return true; }
      if (cmd === 'textcolor') { const c = group(), a = R(group()); out += /^([A-Za-z]+|#[0-9A-Fa-f]{3,8})$/.test(c) ? `<span style="color:${c}">${a}</span>` : a; return true; }
      if (cmd === 'colorbox') { group(); out += R(group()); return true; }
      if (cmd === 'color' || cmd === 'phantom' || cmd === 'hphantom' || cmd === 'vphantom' || cmd === 'label') { group(); return true; }
      if (cmd === 'stackrel' || cmd === 'overset' || cmd === 'underset') { group(); out += R(group()); return true; }
      if (cmd === 'quad') { out += '&emsp;'; return true; }
      if (cmd === 'qquad') { out += '&emsp;&emsp;'; return true; }
      if (cmd === '!' || cmd === 'negthinspace' || cmd === 'allowbreak') return true;
      if (cmd === ':' || cmd === '>' || cmd === 'thinspace' || cmd === 'medspace' || cmd === 'thickspace') { out += '&thinsp;'; return true; }
      if (cmd === 'enspace') { out += '&ensp;'; return true; }
      if (/^(kern|mkern|hskip|mskip|hspace|vspace)$/.test(cmd)) { const m = /^\s*(\{[^}]*\}|-?[\d.]+\s*[a-z]{2})/.exec(src.slice(i)); if (m) i += m[0].length; return true; }
      if (cmd === '\\') { out += '<br>'; return true; }   // a line break (cases, aligned): a new line
      if (cmd === '&') { out += '&amp;'; return true; }
      if (cmd === '#' || cmd === '$') { out += cmd; return true; }
      if (cmd === 'begin') {   // cases / aligned / array / …matrix: an inline table, one cell per &, one row per \\, with its brackets
        const env = group(), spec = env === 'array' || env === 'alignedat' ? group() : '';
        let d = 0, e = -1; for (let k = i; k < src.length; k++) { if (src.startsWith('\\begin{', k)) d++; else if (src.startsWith('\\end{', k)) { if (!d) { e = k; break; } d--; } else if (src[k] === '\\') k++; }
        const body = src.slice(i, e < 0 ? src.length : e); if (e < 0) i = src.length; else { i = e + 4; group(); }
        const rows = [[]]; let b = 0, n = 0, cell = '';
        for (let k = 0; k < body.length; k++) { const c = body[k];
          if (c === '\\') { if (body[k + 1] === '\\' && !b && !n) { rows[rows.length - 1].push(cell); rows.push([]); cell = ''; k++; continue; }
            if (body.startsWith('\\begin{', k)) n++; else if (body.startsWith('\\end{', k)) n--; cell += c + (body[k + 1] || ''); k++; continue; }
          if (c === '{') b++; else if (c === '}') b--;
          if (c === '&' && !b && !n) { rows[rows.length - 1].push(cell); cell = ''; continue; }
          cell += c; }
        rows[rows.length - 1].push(cell); if (rows.length > 1 && rows[rows.length - 1].join('').trim() === '') rows.pop();
        const al = /^cases/.test(env) ? () => 'left' : /^(aligned|align|split|alignedat)/.test(env) ? k => (k % 2 ? 'left' : 'right') : spec ? k => ({ l: 'left', r: 'right' }[(spec.replace(/[^lcr]/g, '')[k] || 'c')] || 'center') : () => 'center';
        /* brackets: border lines that stretch to the table's height (an inline flex row); cases: a '{' scaled to the rows */
        const nr = rows.length, br = (side, st) => `<span class="st-br" style="width:.3em;border-${side}:1px solid currentColor;${st}"></span>`;
        const [o, c] = /^cases/.test(env) ? [`<span class="st-br" style="display:flex;align-items:center;line-height:1;font-size:${nr > 1 ? (1.15 * nr).toFixed(2) : 1}em${nr > 1 ? ';transform:scaleX(.6)' : ''}">{</span>`, '']
          : /^pmatrix/.test(env) ? [br('left', 'border-radius:50% 0 0 50%'), br('right', 'border-radius:0 50% 50% 0')]
          : /^bmatrix/.test(env) ? [br('left', 'border-top:1px solid currentColor;border-bottom:1px solid currentColor'), br('right', 'border-top:1px solid currentColor;border-bottom:1px solid currentColor')]
          : /^Bmatrix/.test(env) ? ['{', '}'] : /^vmatrix/.test(env) ? [br('left', ''), br('right', '')] : /^Vmatrix/.test(env) ? [br('left', 'border-left-style:double;border-left-width:3px'), br('right', 'border-right-style:double;border-right-width:3px')] : ['', ''];
        const tb = '<span class="st-env" style="display:inline-table;vertical-align:middle">' + rows.map(r => '<span style="display:table-row">' + r.map((x, k) => `<span style="display:table-cell;padding:0 .3em;text-align:${al(k)}">${R(x.trim())}</span>`).join('') + '</span>').join('') + '</span>';
        out += o || c ? `<span class="st-mx" style="display:inline-flex;align-items:stretch;vertical-align:middle">${o}${tb}${c}</span>` : tb;
        return true; }
      if (cmd === 'end') { group(); return true; }   // an \end without its \begin: nothing
      if (cmd === 'left' || cmd === 'right') { if (src[i] === '.') i++; return true; }   // \left. / \right. (no bracket): nothing; any other bracket follows as is
      if (cmd === 'sqrt' && src[i] === '[') { const j = src.indexOf(']', i); const n = R(src.slice(i + 1, j)); i = j + 1; out += `<sup>${n}</sup>√<span class="st-bar">${R(group())}</span>`; return true; }
      if (cmd === 'tag') { out += '&ensp;(' + R(group()) + ')'; return true; }
      if (TACC[cmd] != null) { const a = R(group()); out += [...a].length === 1 ? (a + TACC[cmd]).normalize('NFC') : /^(overline|widehat)$/.test(cmd) ? `<span class="st-bar">${a}</span>` : cmd.replace(/^wide/, '') + '(' + a + ')'; return true; }
      if (cmd === 'not') { const a = R(group()); out += a === '=' ? '≠' : a + '\u0338'; return true; }
      if (TOPS.test(cmd)) { out += (/[\p{L}\p{N})]$/u.test(out) ? '&thinsp;' : '') + cmd; if (/^[A-Za-z\\{]/.test(src.slice(i))) out += '&thinsp;'; return true; }   // \cos\theta -> 'cos θ' (as \tan)
      if (cmd === 'text' && /\\/.test(src.slice(i, src.indexOf('}', i) + 1))) { out += R(group()); return true; }   // \text{kip\text{-}ft}, \text{50\%}: its commands rendered, not printed
      if (TSYM[cmd] != null) { out += TSYM[cmd]; return true; }
      if (HSYM[cmd] != null) { out += HSYM[cmd]; return true; }
      return false;
    };
    while (i < src.length) {
      const c = src[i];
      if (c === '\\') {
        const m = /^\\([A-Za-z]+|.)/.exec(src.slice(i)); i += m[0].length; const cmd = m[1];
        if (!html && rd && txt(cmd)) continue;   // TXP: plain text only
        if (html && rd && htm(cmd)) continue;   // TXH: the built-in HTML path
        if (cmd === 'frac') { const a = render(group(), html, rd), b = render(group(), html, rd);
          out += html ? `<span class="st-frac"><span class="st-num">${a}</span><span class="st-den">${b}</span></span>` : `${atom(a) ? a : '(' + a + ')'}/${atom(b) ? b : '(' + b + ')'}`; }
        else if (cmd === 'bar') { const a = render(group(), html, rd); out += html ? `<span class="st-bar">${a}</span>` : a.length === 1 ? (a + '\u0304').normalize('NFC') : 'bar(' + a + ')'; }   // HTML: an overline (CSS .st-bar), whatever the font has
        else if (cmd === 'sqrt') { const a = render(group(), html, rd); out += '√' + (html ? `<span class="st-bar">${a}</span>` : '(' + a + ')'); }
        else if (cmd === 'text') { const a = group(); out += html ? esc(a) : a; }
        else if (cmd === ',' || cmd === ' ' || cmd === ';') out += html ? '&thinsp;' : ' ';
        else if (cmd === '{' || cmd === '}' || cmd === '%' || cmd === '_') out += cmd;
        else if (cmd === 'left' || cmd === 'right') { /* the bracket that follows is printed as is */ }
        else if (cmd === 'tan') { out += SYM.tan; if (/^[A-Za-z\\{]/.test(src.slice(i))) out += html ? '&thinsp;' : ' '; }   // \tan\theta -> 'tan θ' (as KaTeX spaces an operator)
        else out += SYM[cmd] != null ? SYM[cmd] : cmd;
      } else if (c === '_' || c === '^') {
        i++; const a = render(group(), html, rd);
        if (c === '^' && a === '°') { out += '°'; continue; }   // 30^{\circ} -> '30°' (a degree sign, not a raised '°')
        out += html ? (c === '_' ? `<sub>${a}</sub>` : `<sup>${a}</sup>`) : (c === '_' ? '_' : '^') + (a.length > 1 ? '(' + a + ')' : a);
      } else if (c === '{' ) { out += render(group(), html, rd); }
      else if (c === '&' && !html && rd) { out += ' '; i++; }   // TXP: an alignment tab (cases, aligned) in plain text
      else if (c === '~' && !html && rd) { out += ' '; i++; }   // TXP: a non-breaking space in plain text
      else if (c === '~' && html && rd) { out += '&nbsp;'; i++; }   // TXH: a non-breaking space
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
  const toHTML = s => { const t = String(s == null ? '' : s), K = kx(); return K && t ? K.renderToString(t, KATEX_OPT) : render(t, true, true); };   // TXH: rd true
  /* toText(s, opt): plain text. opt.legacy (TXP, 2026-11-07): the output as before TXP (commands outside the subset by name), for the
     tools that compare a report's text with their tabs' text to decide what to copy into the report (so that choice stays as it was) */
  const toText = (s, o) => render(String(s == null ? '' : s), false, !(o && o.legacy));
  /* line(step, html): the one-line rendering  sym = eq = sub = value unit
     With KaTeX, sym, eq and sub are set in display style (full-size fractions) and a numeric value with its unit is set by
     KaTeX too (same digits as fmt), so the whole line is in one typeface; a string value stays as it is. */
  function line(s, html, o) {   // o: toText's options (plain text only)
    const K = html ? kx() : null, D = t => K.renderToString('\\displaystyle ' + t, KATEX_OPT);
    const R = K ? D : html ? toHTML : t => toText(t, o), parts = [];
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
         topics: [{ key, title, ref?, see?, ids: RegExp | (id) => bool, res?: RegExp (the step, by id, that sums up a topic without a test), info?: RegExp (steps whose ok flag only states which case applies, not a check: shown, but not counted in the topic's status) }] tested in order on each step id without its work prefix (opt.strip,
                 default /^[^.]+\./: 'ts3.p1.Vn' -> 'p1.Vn'; false: the whole id, for lists that mix the ids of several works); the first match takes the step; steps no topic takes go to a last topic
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
    opt = opt || {}; const strip = opt.strip === false ? null : opt.strip || /^[^.]+\./, hi = opt.hi != null ? opt.hi : 0.9;
    const T = (topics || []).map(t => ({ key: t.key, title: t.title, ref: t.ref || '', see: t.see || '', test: t.ids, pick: t.res, skip: t.info, steps: [] })), other = { key: 'other', title: 'Other steps', ref: '', see: '', steps: [] };
    (steps || []).forEach(s => { const id = strip ? String(s.id).replace(strip, '') : String(s.id), t = T.find(q => (typeof q.test === 'function' ? q.test(id, s) : q.test.test(id))); (t || other).steps.push(s); });
    return T.concat([other]).filter(t => t.steps.length).map(t => {
      const idf = s => (strip ? String(s.id).replace(strip, '') : String(s.id)), tests = t.steps.filter(s => s.ok !== undefined && !(t.skip && t.skip.test(idf(s)))), rs = tests.filter(isRatio), ng = tests.find(s => s.ok === false);
      const ratio = rs.length ? Math.max(...rs.map(s => (fin(s.value) ? s.value : Infinity))) : NaN;
      const gov = ng || (rs.length ? rs.reduce((a, b) => ((fin(b.value) ? b.value : Infinity) > (fin(a.value) ? a.value : Infinity) ? b : a)) : tests[tests.length - 1]);
      const res = gov || (t.pick && t.steps.find(s => t.pick.test(strip ? String(s.id).replace(strip, '') : String(s.id)))) || [...t.steps].reverse().find(s => s.value != null && s.value !== '') || t.steps[t.steps.length - 1];
      const cls = !tests.length ? '' : ng || ratio > 1 + 1e-9 || Number.isNaN(ratio) && rs.length ? 'ng' : ratio >= hi ? 'hi' : 'ok';
      const chip = !tests.length ? '' : rs.length ? (fin(ratio) ? fmt(ratio, 3) : '∞') + (ng ? ' NG' : '') : ng ? 'NG' : 'OK';
      return { key: t.key, title: t.title, ref: t.ref, see: t.see, steps: t.steps, res, ratio, cls, chip };
    });
  }
  /* summary: inline notation (not display style), so the line stays one line high */
  function summary(t, html, o) {   // o: toText's options (plain text only)
    const s = t.res; if (!s) return '';
    const R = html ? toHTML : x => toText(x, o), lab = html ? esc(s.label) : s.label, sym = s.sym ? R(s.sym) : '';
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
  /* reveal(root, id) (browser): the element of step id (id="st-<id>") inside root, with its topic opened first (a topic starts closed); null if none */
  function reveal(root, id) {
    if (!root || !root.querySelector) return null; const t = root.querySelector('[id="st-' + String(id == null ? '' : id).replace(/^st-/, '').replace(/["\\]/g, '\\$&') + '"]'); if (!t) return null;
    const d = t.closest ? t.closest('details.sg-t') : null; if (d && !d.open) d.open = true; return t;
  }
  function wire(root, o) {
    o = o || {}; if (!root || !root.addEventListener) return;
    if (typeof document !== 'undefined' && document.head && !document.getElementById('sg-css')) { const st = document.createElement('style'); st.id = 'sg-css'; st.textContent = groupCss; document.head.appendChild(st); }   // the topics' CSS, once per page
    // a link to a step ("§", href="#st-<id>") anywhere in root opens that step's topic before the browser scrolls to it (bound once per root)
    if (!root.__sgLink) { root.__sgLink = true; root.addEventListener('click', e => { const a = e.target && e.target.closest ? e.target.closest('a[href^="#st-"]') : null; if (a) reveal(root, a.getAttribute('href').slice(4)); }); }
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

  window.SharedSteps = { step, work, n, g, fmt, toHTML, toText, line, unitTeX, katexOpt: KATEX_OPT, group, summary, groupsHTML, wire, reveal, groupCss, noteParts, noteSep, noteText };
})();
