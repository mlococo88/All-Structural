/* apps/steel-bridge/ui/dash.js — the left check summary column (window.SBDDashUI). Classic script. Created 2026-11-09 (engineer: "Maybe
   it's a left-justified summary panel with links to the sections each card is summarizing"), as the other apps' left summary columns
   (Retaining Wall, Spread Footing, Light Pole #984/#988/#991, GirderDetail #1196). Display only: the same data as the Summary tab
   (ui/summary.js state(): report/summary.js, each module's own governing values); nothing is calculated here.

   Screens 1200 px and wider: a column at the far left of the page (left of the input panel), 240 px wide up to 1499 px, 280 px from
   1500 px; « shrinks it to a 42 px strip (the state in the per-browser UI key sbd2.dashCollapsed_v1: '1' shrunk; not in the project,
   the autosave or the export). Below 1200 px it is not shown, and nothing else changes. Not printed.
   Header: the overall verdict (n FAIL, the largest D/C) and the governing check (a link). One chip per module group (Flexure, Shear,
   Stiffeners, Fatigue, Studs, Constructibility, Cross-frames, Field splices, Welds, Deflection, Rating): its governing D/C (or RF) and
   girder, PASS / FAIL / REVIEW; ▸ opens the value of each girder (and of each column of the group). A chip opens its output tab with
   that girder selected and scrolls to and flashes the card that works the value (ui/summary.js gotoCell / focus). A module not run yet
   shows "not run"; its chip runs it (the Summary's run, through the shared analysis cache) and opens its tab, which runs itself (#1260).
   After an input change the last values stay, marked out of date, until the modules run again (the Summary tab, "Run all", a chip).

   init(o): o = { el (the column), store (localStorage or null), getP(), ui(), goto(tab, gi), fix(i) and errUi() (SBINV: the input error links) };
   refresh() after the page draws. */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const KEY = 'sbd2.dashCollapsed_v1';
  const D = { o: null, open: new Set(), coll: false };
  const SM = () => window.SBDSummary, SU = () => window.SBDSummaryUI, fmt = (x, d) => window.SharedUnits.fmt(x, d);
  const LBL = { pass: 'PASS', fail: 'FAIL', review: 'REVIEW', na: 'n/a', notrun: 'not run' };
  const vOf = (q, c) => !q ? '—' : q.st === 'notrun' ? 'not run' : q.st === 'na' ? 'n/a' : c.rf ? (isFinite(q.rf) ? 'RF ' + fmt(q.rf, 2) : '—') : (isFinite(q.r) ? fmt(q.r, 3) : q.r === Infinity ? '∞' : q.r === -Infinity ? '−∞' : 'NaN');   // QA2: as the Summary table (∞ added; NaN only for a true NaN)
  const rd = k => { try { return D.o.store ? D.o.store.getItem(k) : null; } catch (e) { return null; } };
  const wr = (k, v) => { try { if (D.o.store) D.o.store.setItem(k, v); } catch (e) { /* not kept */ } };

  function setColl(v) { D.coll = !!v; document.body.classList.toggle('sbDashColl', D.coll); wr(KEY, D.coll ? '1' : '0'); draw(); }

  /* the list to show: this project state's results; a girder or module not run yet takes the last results, marked out of date */
  function view(P) {
    const st = SU().state(), prev = st.prev || [], COLS = SM().COLS;
    const list = P.girders.map((g, gi) => { const G = st.list[gi], O = prev[gi], lab = g.label || g.id || `G${gi + 1}`, cells = {}, old = {};
      COLS.forEach(c => { const q = G && G.cells[c.id]; if (q && q.st !== 'notrun') cells[c.id] = q; else if (O && O.cells[c.id] && O.cells[c.id].st !== 'notrun' && O.label === lab) { cells[c.id] = O.cells[c.id]; old[c.id] = true; } else cells[c.id] = { st: 'notrun', tab: c.tab }; });
      return { gi, label: lab, cells, old }; });
    return { st, list };
  }
  function draw() {
    const o = D.o; if (!o || !o.el) return;
    const P = o.getP(); if (!P || !SU() || !SM()) return;
    // SBINV (2026-11-10): while a blocking input error exists (engine/inputcheck.js) the column shows the errors (links to the fields), no verdict or value
    const IE = window.SBDInputCheck && window.SBDInputCheckUI && o.errUi ? window.SBDInputCheck.collect(P).errors : [];
    if (IE.length) { o.el.innerHTML = `<div id="sbDashHead"><button type="button" id="sbDashTgl" aria-expanded="${!D.coll}" title="${D.coll ? 'Show the check summary' : 'Shrink the check summary to a strip'}">${D.coll ? '»' : '«'}</button><h2 id="sbDashTtl">Check summary</h2><span class="sdC"><span class="sdF">${IE.length} to fix</span></span></div>`
      + (D.coll ? '' : window.SBDInputCheckUI.dash(IE, o.errUi())); return; }
    SU().sync(P);
    const { st, list } = view(P), ov = SM().overall(P, list), n = ov.n, anyOld = list.some(G => Object.keys(G.old).length), top = ov.top;
    const nRun = list.reduce((a, G) => a + Object.values(G.cells).filter(q => q.st !== 'notrun').length, 0);
    const cnt = `<span class="sdC">${n.fail ? `<span class="sdF">${n.fail} FAIL</span>` : ''}${n.review ? `<span class="sdW">${n.review} REVIEW</span>` : ''}${n.pass ? `<span class="sdP">${n.pass} PASS</span>` : ''}${!nRun ? '<span class="sdN">not run</span>' : ''}</span>`;
    const head = `<div id="sbDashHead"><button type="button" id="sbDashTgl" aria-expanded="${!D.coll}" title="${D.coll ? 'Show the check summary' : 'Shrink the check summary to a strip'}">${D.coll ? '»' : '«'}</button><h2 id="sbDashTtl">Check summary</h2>${cnt}</div>`;
    if (D.coll) { o.el.innerHTML = head; return; }
    const govLink = top ? `<a href="#" data-sdgo="${top.G.gi}|${top.c.id}">${esc(SM().label(top.c, P).head)}, ${esc(top.G.label)}: D/C ${isFinite(top.q.r) ? fmt(top.q.r, 3) : 'NaN'}</a>` : '';
    const status = st.busy ? `<div class="sdRun"><span class="spin" aria-hidden="true"></span>${esc(st.prog)}</div>`
      : anyOld || (nRun && nRun < list.length * SM().COLS.length) || !nRun ? `<div class="sdRun">${anyOld ? 'Inputs changed: values out of date. ' : !nRun ? 'Nothing run yet. ' : 'Some modules not run. '}<a href="#" id="sbDashRun">Run all</a></div>` : '';
    const verdict = `<div class="sdVerd"><b class="sd-${n.fail ? 'fail' : n.review ? 'review' : n.pass ? 'pass' : 'notrun'}">${n.fail ? 'FAIL' : n.review ? 'REVIEW' : n.pass ? 'PASS' : '—'}</b>${top ? ` · max D/C ${isFinite(top.q.r) ? fmt(top.q.r, 3) : 'NaN'}` : ''}${anyOld ? ' <span class="sdOld">(out of date)</span>' : ''}</div>
      ${govLink ? `<div class="sdGov">Governing: ${govLink}</div>` : ''}${status}`;
    const chips = SM().GROUPS.map(gp => {
      const S = SM().grpStat(list, gp), g = S.gov, rf = S.cols.every(c => c.rf), op = D.open.has(gp), old = S.all.some(z => list[z.G.gi].old[z.c.id]);
      const v = g ? `${vOf(g.q, g.c)} · ${esc(g.G.label)}` : S.st === 'na' ? 'n/a' : 'not run';
      const go = g ? `${g.G.gi}|${g.c.id}` : `${Math.min(+(D.o.ui().g || 0), list.length - 1)}|${S.cols[0].id}`;
      const rows = S.all.map(z => `<li><a href="#" data-sdgo="${z.G.gi}|${z.c.id}" class="sd-${z.q.st}${list[z.G.gi].old[z.c.id] ? ' sdOldV' : ''}">${S.cols.length > 1 ? esc(z.c.short) + ', ' : ''}${esc(z.G.label)}: ${vOf(z.q, z.c)}</a></li>`).join('');
      return `<div class="sdChip sd-${S.st}${old ? ' sdOldC' : ''}" data-sdgrp="${esc(gp)}"><button type="button" class="sdX" data-sdx="${esc(gp)}" aria-expanded="${op}" title="${op ? 'Hide' : 'Show'} each girder">${op ? '▾' : '▸'}</button><a href="#" class="sdMain" data-sdgo="${go}" title="${esc(g ? `${SM().label(g.c, P).head}, ${g.G.label}: ${String(g.q.check || '').replace(/\$|\{\}|[{}]|\\/g, '')} (${String(g.q.loc || '').replace(/\$|[{}]/g, '')})` : S.st === 'na' ? 'Not applicable' : 'Not run yet: click to run it and open its tab')}">
        <span class="sdName">${esc(SM().grpLabel ? SM().grpLabel(gp, P) : gp)}</span><span class="sdVal">${v}</span><span class="sdSt">${S.st === 'notrun' ? '' : LBL[S.st]}${rf && g ? '' : ''}</span></a>${op ? `<ul class="sdList">${rows}</ul>` : ''}</div>`;
    }).join('');
    o.el.innerHTML = head + verdict + `<div id="sbDash">${chips}</div><p class="sdNote">Each chip: the governing value over every girder (ratio = demand / capacity, OK ≤ 1.0; RF OK ≥ 1.0), as on the <a href="#" data-sdtab="sum">Summary tab</a>. Click: its tab, girder and the card that works it.${window.SBDRating && window.SBDRating.BASIS ? ' ' + esc(window.SBDRating.BASIS.short) : ''}${P.fatigue && P.fatigue.ev && P.fatigue.ev.on === 'yes' ? ' Fatigue includes the remaining fatigue life (FA6, MBE 4th Ed. Section 7).' : ''}</p>`;
  }
  function init(o) {
    D.o = o; const el = o.el; if (!el) return;
    D.coll = rd(KEY) === '1'; document.body.classList.toggle('sbDashColl', D.coll);
    el.addEventListener('click', e => {
      const t = e.target.closest('button, a'); if (!t) return;
      if (t.id === 'sbDashTgl') { setColl(!D.coll); return; }
      e.preventDefault();
      if (t.dataset.icgo != null) { if (o.fix) o.fix(+t.dataset.icgo); return; }   // SBINV: an input error's link
      if (t.dataset.sdx) { const k = t.dataset.sdx; if (D.open.has(k)) D.open.delete(k); else D.open.add(k); draw(); return; }
      if (t.id === 'sbDashRun') { SU().start(o.getP()); return; }
      if (t.dataset.sdtab) { o.goto(t.dataset.sdtab, null); return; }
      if (t.dataset.sdgo) { const [gi, id] = t.dataset.sdgo.split('|'); SU().gotoCell(+gi, id, { P: o.getP(), goto: o.goto }); }
    });
    SU().subscribe(() => draw());
    draw();
  }
  window.SBDDashUI = { init, refresh: draw, KEY };
})();
