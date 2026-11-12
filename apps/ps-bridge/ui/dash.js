/* apps/ps-bridge/ui/dash.js — the left check summary column (window.PSBDashUI). Classic script. Created 2026-11-12 (PR 1 skeleton,
   docs/ps-bridge-plan.md §2). ADAPTED COPY, to move to shared/ later (CLAUDE.md §3): the column's head, the « / » shrink toggle, the chip
   and input-error layout follow apps/steel-bridge/ui/dash.js (window.SBDDashUI) and use the same CSS (#sbDashCol, #sbDashHead, .sdChip, …,
   copied into index.html). The steel file reads the steel modules' results (SBDSummary); this one has no results yet: each check group is
   listed "not run" with the PR that brings it, and the input errors of the model (engine/model.js validate) are listed as links.
   Display only: nothing is calculated here. Screens 1200 px and wider (CSS); not printed. The shrunk state is the per-browser UI key
   psb2.dashCollapsed_v1 ('1' shrunk; not in the project, the autosave or the export).

   init(o): o = { el, store (localStorage or null), getP(), errors() ([{ path, msg }]), goto(tab), fix(i) }; refresh() after the page draws. */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const KEY = 'psb2.dashCollapsed_v1';
  /* the check groups of the PS app and the output tab that works each (docs/ps-bridge-plan.md §2.3, §5) */
  const GROUPS = [
    { id: 'rel', name: 'Release stresses', tab: 'str', pr: '2c' }, { id: 'srv', name: 'Service stresses', tab: 'str', pr: '2c' },
    { id: 'flex', name: 'Flexure', tab: 'flex', pr: '2c' }, { id: 'shear', name: 'Shear', tab: 'shear', pr: '2c' },
    { id: 'end', name: 'End zone & hold-down', tab: 'end', pr: '2d' }, { id: 'camb', name: 'Camber & deflection', tab: 'camb', pr: '2d' },
    { id: 'hand', name: 'Handling', tab: 'hand', pr: '2d' }, { id: 'deck', name: 'Deck', tab: 'deck', pr: '2d' }, { id: 'rt', name: 'Rating', tab: 'rt', pr: '2d' }];
  const D = { o: null, coll: false };
  const rd = k => { try { return D.o.store ? D.o.store.getItem(k) : null; } catch (e) { return null; } };
  const wr = (k, v) => { try { if (D.o.store) D.o.store.setItem(k, v); } catch (e) { /* not kept */ } };
  function setColl(v) { D.coll = !!v; document.body.classList.toggle('sbDashColl', D.coll); wr(KEY, D.coll ? '1' : '0'); draw(); }
  const head = cnt => `<div id="sbDashHead"><button type="button" id="sbDashTgl" aria-expanded="${!D.coll}" title="${D.coll ? 'Show the check summary' : 'Shrink the check summary to a strip'}">${D.coll ? '»' : '«'}</button><h2 id="sbDashTtl">Check summary</h2>${cnt}</div>`;
  function draw() {
    const o = D.o; if (!o || !o.el) return;
    const E = o.errors ? o.errors() : [];
    if (E.length) {
      o.el.innerHTML = head(`<span class="sdC"><span class="sdF">${E.length} to fix</span></span>`)
        + (D.coll ? '' : `<p class="sdNote">Input errors: no results are shown until they are fixed.</p><ul class="sdList" style="margin-left:4px">${E.map((e, i) => `<li><a href="#" class="sd-fail" data-icgo="${i}">${esc(e.msg)}</a></li>`).join('')}</ul>`);
      return;
    }
    if (D.coll) { o.el.innerHTML = head('<span class="sdC"><span class="sdN">not run</span></span>'); return; }
    const chips = GROUPS.map(g => `<div class="sdChip sd-notrun"><span></span><a href="#" class="sdMain" data-sdtab="${g.tab}" title="Not built yet: comes in PR ${g.pr} (docs/ps-bridge-plan.md §5)"><span class="sdName">${esc(g.name)}</span><span class="sdVal">not run</span><span class="sdSt">PR ${g.pr}</span></a></div>`).join('');
    o.el.innerHTML = head('<span class="sdC"><span class="sdN">not run</span></span>')
      + '<div class="sdVerd"><b class="sd-notrun">—</b></div><div class="sdRun">In development: no checks yet. The prestressed engine moves in with PR 2a; the checks show here from PR 2c.</div>'
      + `<div id="sbDash">${chips}</div><p class="sdNote">Each chip will show the governing ratio (demand / capacity, OK ≤ 1.0; rating RF OK ≥ 1.0) over every girder and span, as on the <a href="#" data-sdtab="sum">Summary tab</a>, and link to the card that works it.</p>`;
  }
  function init(o) {
    D.o = o; const el = o.el; if (!el) return;
    D.coll = rd(KEY) === '1'; document.body.classList.toggle('sbDashColl', D.coll);
    el.addEventListener('click', e => {
      const t = e.target.closest('button, a'); if (!t) return;
      if (t.id === 'sbDashTgl') { setColl(!D.coll); return; }
      e.preventDefault();
      if (t.dataset.icgo != null) { if (o.fix) o.fix(+t.dataset.icgo); return; }
      if (t.dataset.sdtab) o.goto(t.dataset.sdtab);
    });
    draw();
  }
  window.PSBDashUI = { init, refresh: draw, KEY, GROUPS };
})();
