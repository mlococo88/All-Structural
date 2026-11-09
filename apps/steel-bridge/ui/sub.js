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
  window.SBDSub = { html, fix };
})();
