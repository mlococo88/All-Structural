/* apps/ps-bridge/ui/girdsubs.js — the sub-tabs of the Girders & strands input tab (window.PSBGirdSubs). Classic script; display only.
   Created 2026-11-25 (GSUB, engineer 2026-11-25: the tab was about 4,000 px and 11 cards; split into sub-tabs, the approved layout):
     Girder types   the girder types card (ui/types.js; with no girder types the Design girder card, ui/inputs.js) and "Shown on the output tabs"
     Section        Girder shape (the library, the custom section, the section-property overrides)
     Strands        Straight strand rows and Draped strands beside the strand pattern figure (two columns where the panel is wide enough),
                    then "Edit strands on the section" (ui/strandedit.js)
     Reinforcement  Shear reinforcement, Longitudinal reinforcement (5.7.3.5 tie), Release tension steel, Splitting and confinement steel
   "Entered values for" (ui/types.js scopeBar) is shown above the Section, Strands and Reinforcement sub-tabs (not on Girder types: nothing
   there depends on it). Every sub-tab is drawn (the hidden ones with `hidden`), so the input checks mark every field and the page's
   delegated handlers on #inPanes reach every input. The cards, fields, values and ids are those of the single pane before (same HTML).
   The page (index.html) calls:
     SUBS               [[key, label]] in order
     CARDS              card id (without "card-") -> sub key, every card of the tab
     norm(k)            a saved ui.gsub, else 'types' (an old saved ui has none)
     subOf(target)      the sub-tab of a card ('card-split'), a sub key ('reinf') or a project path ('design.g', 'types.0.lines',
                        'base.rows.1.n', 'base.opt.splitN'); '' when it is not on this tab
     parse(spec)        a link's data-goin value: 'tab' or 'tab@target' (target = a card id or a project path) -> { tab, target }
     pane(P, ui, V, sk) the tab's HTML: the sub-tab row, the scope choice and the four sub-tab panels (ui.gsub shown)
     count(errors, tabOf)  { sub: number of input errors on it }
   Nothing is stored or computed here (ui.gsub is kept by the page in psb2.ui with the other tab choices). */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SUBS = [['types', 'Girder types'], ['sec', 'Section'], ['str', 'Strands'], ['reinf', 'Reinforcement']];
  const CARDS = { types: 'types', design: 'types', shape: 'sec', rows: 'str', draped: 'str', strandPat: 'str', strandEdit: 'str',
    stirrups: 'reinf', tie: 'reinf', rel: 'reinf', split: 'reinf' };
  const isSub = k => SUBS.some(s => s[0] === k);
  const norm = k => isSub(k) ? k : 'types';
  /* subOf(target): a card id, a sub key or a project path -> its sub-tab ('' if not on the Girders & strands tab) */
  function subOf(target) {
    const t = String(target || ''); if (!t) return '';
    if (isSub(t)) return t;
    if (/^card-/.test(t)) return CARDS[t.slice(5)] || '';
    const F = window.PSBFields; if (!F || F.tabOf(t) !== 'gird') return '';
    if (/^(design|types)\b/.test(t)) return 'types';
    for (const tp in F.TABLES) if ((t === tp || t.indexOf(tp + '.') === 0) && F.TABLES[tp].tab === 'gird') return tp === 'base.rows' ? 'str' : '';
    let q = t; while (q) { const f = F.byPath[q]; if (f) return CARDS[f.card.id] || ''; q = q.replace(/\.?[^.]*$/, ''); }
    return '';
  }
  function parse(spec) { const s = String(spec || ''), i = s.indexOf('@'); return i < 0 ? { tab: s, target: '' } : { tab: s.slice(0, i), target: s.slice(i + 1) }; }
  function count(errors, tabOf) {
    const n = {}; (errors || []).forEach(e => { if (tabOf(e.path) !== 'gird') return; const s = subOf(e.path) || 'types'; n[s] = (n[s] || 0) + 1; }); return n;
  }
  /* the sub-tab row: role tablist, as the input tabs (smaller); the error dot (.inDot) filled by the page's markErrors */
  const bar = cur => `<div class="gSubs" id="gSubs" role="tablist" aria-label="Girders &amp; strands sub-tabs">${SUBS.map(([k, t]) => `<button type="button" role="tab" id="gsubT_${k}" data-gsub="${k}" aria-controls="gsub_${k}" aria-selected="${cur === k}">${t}<span class="inDot"></span></button>`).join('')}</div>`;
  /* pane(P, ui, V, sk): the tab's HTML (V = the inputs shown: the base or the girder type in scope sk) */
  function pane(P, ui, V, sk) {
    const TY = window.PSBTypesUI, IN = window.PSBInputsUI, SE = window.PSBStrandEdit, cur = norm(ui.gsub);
    const only = ids => id => ids.includes(id);
    const part = (k, h) => `<div class="gSub" role="tabpanel" id="gsub_${k}" data-gsubpane="${k}" aria-labelledby="gsubT_${k}"${cur === k ? '' : ' hidden'}>${h}</div>`;
    const pat = `<section class="sec" id="card-strandPat"><div class="secHead">Strand pattern${sk >= 0 ? ` of ${esc(P.types[sk].label)}` : ''}</div><div class="secBody" id="gfx_strands_in"><p class="note">Shown when the inputs have no error.</p></div></section>`;
    return bar(cur) + (cur === 'types' ? '' : TY.scopeBar(P, ui, 'gird'))
      + part('types', TY.card(P, ui) + TY.shownCard(P) + IN.cards('gird', V, null, only(['design'])))
      + part('sec', IN.cards('gird', V, null, only(['shape'])))
      + part('str', `<div class="gStr"><div class="gStrA">${IN.cards('gird', V, null, only(['rows']))}</div><div class="gStrF">${pat}</div><div class="gStrB">${IN.cards('gird', V, null, only(['draped']))}</div></div>`
        + (SE ? SE.card(sk >= 0 ? P.types[sk].label : '') : ''))   // batch G5: strand editing by clicking the section (ui/strandedit.js)
      + part('reinf', IN.cards('gird', V, null, only(['stirrups', 'tie', 'rel', 'split'])));
  }
  window.PSBGirdSubs = { SUBS, CARDS, norm, subOf, parse, pane, count };
})();
