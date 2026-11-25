/* apps/steel-bridge/ui/sub.js — window.SBDSub: screen text with its subscripts (QA2, 2026-11-09; display only).
   The engines write symbols in plain text with an underscore (M_DC1, L_b, λ_f, P/Q_r, d_o/D, M_LL+IM); the tabs show them as subscripts, as the
   check titles' tt() of ui/flexure.js and the other tabs (f_ℓ: QAO, #1280). A subscript is the letters and digits after the underscore (a comma or a
   plus sign inside it is kept: f_ℓ,skew, M_LL+IM; a comma after it is not: "P_fy, inner"); the underscore must follow a letter or ")".
   SBDSub.html(text) -> escaped HTML with <sub>…</sub>; SBDSub.fix(root): the worked-steps topic lines (below). Text only: the CAD graphics (capitals, SVG / DXF) keep their underscores.
   Loaded by index.html before the ui/ files. No calculation. */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const RE = /([A-Za-zΑ-Ωα-ωℓ)])_\{?([A-Za-z0-9ℓ]+(?:[,+][A-Za-z0-9ℓ]+)*)\}?/g;
  const html = t => esc(t).replace(RE, '$1<sub>$2</sub>');
  /* the one-line result of each worked-steps topic (.sg-sum: "label: sym = value") is written by shared/steps.js (escaped label, then KaTeX):
     its own text nodes (the label; never inside the KaTeX) get the subscripts here, so shared/steps.js is unchanged. fix(root) runs on every
     change of the output panel (#out), each line once (data-sbsub). */
  function fix(root) {
    (root || document).querySelectorAll('.sg-sum:not([data-sbsub])').forEach(el => { el.setAttribute('data-sbsub', '');
      [...el.childNodes].forEach(n => { if (n.nodeType !== 3) return; const t = n.nodeValue; RE.lastIndex = 0; if (!RE.test(t)) return;
        const sp = document.createElement('span'); sp.innerHTML = html(t); n.replaceWith(...sp.childNodes); }); });
  }
  function watch() { const o = document.getElementById('out'); if (!o || typeof MutationObserver === 'undefined') return; fix(o); new MutationObserver(() => fix(o)).observe(o, { childList: true, subtree: true }); }
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch(); }
  /* ---------- SBNG (2026-11-24; engineer, approved: the failing check's step red with "NG", a warning amber, on every output tab, as #1692
     (SBDFH) did on the Cross-frames / Diaphragms tab). Display only: no value, verdict or step changes. A step is marked only through the check
     items that link to it (an item's step id, its "§"): a step whose own ok flag is false but that no failing item links to (a test that only
     selects a case: compact or not, which equation applies) keeps the grey class "no" as before (decision SBDFH-3).
       stepSt(entries) -> Map step id -> 'fail' | 'warn' (the worst of the entries that link to it); entries: [{ step, st }] (st 'fail', 'warn';
                         any other status is not marked)
       items(C)        -> the entries of check groups C = [{ items: [{ st, step }] }] (the engines' checks(): fatigue, studs, welds, splices,
                         stiffeners, rating, …)
       rows(checks)    -> the entries of a check-row list [{ step, ratio, ok, inUse, ng }] (engine/flexure.js, constructibility.js,
                         proportions.js, shear.js ck()): 'fail' where the tab's own table shows it red, i.e. a check in use (or with an
                         NG reason, c.ng) whose ratio is above 1 + 1e-9 or that carries an NG reason; a check not in use is not marked
       mark(s, ST)     -> { cls, tag } for the step's <li>: 'no ng' + an "NG" tag, 'no wn' + a "Warning" tag, else 'no' where s.ok is false
                         (as before), else ''. The CSS (.steps li.no.ng, li.no.wn, .ngTag) is in index.html (SBDFH). */
  const SRK = { warn: 1, fail: 2 };
  const stepSt = entries => { const m = new Map(); (entries || []).forEach(e => { if (!e || !e.step || !SRK[e.st]) return;
    if (!m.has(e.step) || SRK[e.st] > SRK[m.get(e.step)]) m.set(e.step, e.st); }); return m; };
  const items = C => (C || []).flatMap(c => (c && c.items) || []).map(it => ({ step: it && it.step, st: it && it.st }));
  const rowFail = c => !!c && (c.inUse !== false || !!c.ng) && (!!c.ng || (typeof c.ratio === 'number' && isFinite(c.ratio) && c.ratio > 1 + 1e-9));
  const rows = checks => (checks || []).map(c => ({ step: c && c.step, st: rowFail(c) ? 'fail' : '' }));
  const mark = (s, ST) => { const q = ST && s ? ST.get(s.id) : null;
    return q === 'fail' ? { cls: 'no ng', tag: '<span class="ngTag">NG</span> ' } : q === 'warn' ? { cls: 'no wn', tag: '<span class="ngTag wn">Warning</span> ' }
      : { cls: s && s.ok === false ? 'no' : '', tag: '' }; };
  /* NGREL (2026-11-24; engineer, approved): this app's failing comparison steps print the relation that holds ("33.75 > 17.75, NG", not
     "33.75 ≤ 17.75, NG"): shared/steps.js line() flips the one \le / \ge of a failing step's sub when its two numbers violate it, on the
     tabs, in the Report and in its plain text. Off in every other tool (SharedSteps.opt.ngRel, default false). Display only. */
  if (window.SharedSteps && window.SharedSteps.opt) window.SharedSteps.opt.ngRel = true;
  /* BEFF (2026-11-25): beffLink(P, gi, j, txt) -> the link to the worked b_eff of line j of type gi (Girders & plates tab, index.html
     data-beffgo); beffNote(P, gi) -> "b_eff = … in (line Gj, calculated / entered) [worked]" for the output tabs that use b_eff. Display only. */
  const beffLink = (P, gi, j, txt) => `<a class="wk" href="#" data-beffgo="${gi}:${j}" title="b_eff of line G${j + 1}, worked on the Girders &amp; plates tab (4.6.2.6.1)">${txt || '§ b<sub>eff</sub>'}</a>`;
  function beffNote(P, gi) {
    const M = window.SBDModel, AN = window.SBDAnalysis, g = P && P.girders && P.girders[gi]; if (!M || !M.beffOf || !g || !P.xs || (P.deck && P.deck.composite === false)) return '';
    const j = AN ? AN.lineOf(P, g) : M.designLine(P, g), ov = M.beffOvOf(P, g), b = M.beffOf(P, g, j);
    return `<p class="note" data-sbbeff="${gi}:${j}">b<sub>eff</sub> = ${isFinite(b) ? (+b).toFixed(2) : '—'} in on line G${j + 1} (${ov ? 'entered: Override b<sub>eff</sub> of the girder type' : 'calculated: the tributary width, AASHTO LRFD 10th Ed. Art. 4.6.2.6.1'}) ${beffLink(P, gi, j, 'worked')}.</p>`;
  }
  window.SBDSub = { html, fix, stepSt, items, rows, rowFail, mark, beffLink, beffNote };
})();
