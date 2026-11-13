/* apps/ps-bridge/ui/report.js — the Report output tab (window.PSBReportUI): the calculation report of the design girder in the shared
   viewer (shared/report.js: navigation tree, section numbers, collapse / expand, search, Print), built by report/builders.js from the
   page's own result (report/data.js). Classic script. Created 2026-11-13 (PR 2e).
   ADAPTED COPY, to move to shared/ later (CLAUDE.md §3): apps/steel-bridge/ui/report.js at e02c618 (window.SBDReportUI): the section chips
   (kept with the page's tab choices, ctx.opts.inc, saved by index.html under its UI key psb2.ui as the steel app keeps them under its own),
   the viewer mounted with the controls in its bar, [[tab:…]] links to the app's tabs, print by the viewer's Print button (the whole report
   alone on the page) or Ctrl+P on the tab (index.html CSS: the report only). Not copied: the steel app's scope (every girder), detail
   (every station) and demand source (hand-off file) choices, and its Build button: the PS engine result is the page's own (computed once
   per input state), so the report is built when the tab opens and rebuilt when the inputs change.

   render(host, ctx), ctx = { P, rc (index.html result(): { inp, R, W }), opts (object kept by the page: { inc: { key: bool } }), save(),
   goto(tab), goin(tab) }. Display only.
   Graphics (2026-11-13, the engineer's decision; the steel report's figures): figures(B, inc, wScr) draws each included result tab off screen
   with its own code (output(ctx) and after(el, ctx), the chooser defaults as the Report's cards), takes each graphic card it mounts
   (.vk.va-card of PSBVizAlong.mount, .vk.vk-det of PSBVizKit.detCard) from its slot #gfx_…: the drawn figure (.vk-fig), its legend and
   caption (links as text, no read-out, no controls; the series chips as a legend of the series shown), and its title and state shown (the pressed segment of its control) as the caption.
   Drawn at PW = 700 px, the printed text width (letter, 0.6 in margins: 7.3 in), so the labels print at their own size (10.5 px and up);
   on a narrower screen (phone) also at the report's width for the screen (print uses the 700 px one). report/builders.js puts them
   at the slots' places and numbers them "Figure n.m". No drawing code here; no value is computed or recorded.
   2026-11-13: the handling elevation in both stages (Lifting, Hauling: two figures, whatever stage the tab last showed); the captions that
   speak of the screen controls ("click a station to select it", "Stage buttons …", the chip label "Show") or of the tab's layout ("the table
   above": in the Report the section's tables follow its figures) reworded for a static figure. */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const S = { closed: new Set(), key: '', M: null };
  const incOf = o => { const inc = {}; window.PSBReportBuild.SECTIONS.forEach(([k]) => { inc[k] = !(o.inc && o.inc[k] === false); }); return inc; };
  function controls(o) {
    const inc = incOf(o);
    return `<div class="rp-chips" role="group" aria-label="Report sections">${window.PSBReportBuild.SECTIONS.map(([k, t]) => `<label class="rp-chip"><input type="checkbox" data-rpinc="${k}"${inc[k] ? ' checked' : ''}>${esc(t)}</label>`).join('')}</div>`;
  }
  const PW = 700;
  const plainA = el => { el.querySelectorAll('a').forEach(a => { const sp = document.createElement('span'); sp.innerHTML = a.innerHTML; a.replaceWith(sp); }); return el; };
  /* 2026-11-13 (display; decisions pending the engineer's review): a graphic drawn once per state of its control in the Report, in the
     control's order and whatever state the tab last showed (the handling elevation: Lifting, then Hauling; the tab's own state is put back);
     and the tabs' caption wording for the screen (click, buttons, "Show", "the table above") reworded for a static figure, in the Report only */
  const ALLSEG = new Set(['gfx_hnel']);
  const STATIC = [[/; click a station to select it\./g, '.'], [/\s*Click a station to select it\./g, ''], [/Stage buttons select the stage and its governing station\./g, 'Drawn at the governing station of the stage named in the caption.'],
    [/the table above/g, 'the table in this section']];   // on the tab the table is above the graphic; in the Report it follows the figure
  const still = h => STATIC.reduce((t, [re, w]) => t.replace(re, w), h);
  const chipLab = h => /^(Also )?show$/i.test(String(h).trim()) ? 'Shown:' : h;
  /* one graphic card as it is drawn now: { title, sub, shown, html } */
  function one(card) {
    const h3 = card.querySelector('.vk-hd h3'), sm = h3 && h3.querySelector('small'), t = h3 ? h3.cloneNode(true) : null; if (t && t.querySelector('small')) t.querySelector('small').remove();
    const seg = card.querySelector('.vk-seg button[aria-pressed="true"]'), segL = seg && seg.closest('[role="group"]');
    const fig = card.querySelector('.vk-fig'); if (!fig || !fig.querySelector('svg')) return null;
    const f = plainA(fig.cloneNode(true)); f.querySelectorAll('.va-hov').forEach(n => n.remove()); f.removeAttribute('style');
    // the series chips (screen controls) as a static legend of the series shown (their swatches); then the tab's legend and captions
    const chips = [...card.querySelectorAll(':scope > .vk-chips')].map(c => { const on = [...c.querySelectorAll('button[aria-pressed="true"]')]; if (!on.length) return '';
      const lab = c.querySelector('.vk-cl'); return `<div class="va-leg">${lab ? `<span><b>${chipLab(lab.innerHTML)}</b></span>` : ''}${on.map(b => `<span>${b.innerHTML}</span>`).join('')}</div>`; }).join('');
    const extra = chips + [...card.querySelectorAll(':scope > .va-leg, :scope > .vk-cap')].map(n => still(plainA(n.cloneNode(true)).outerHTML)).join('');
    return { title: t ? still(t.innerHTML.trim()) : '', sub: sm ? still(sm.innerHTML.trim()) : '', shown: seg ? `${segL && segL.getAttribute('aria-label') ? segL.getAttribute('aria-label') + ': ' : ''}${seg.textContent.trim()}` : '',
      html: `<div class="vk-fig">${f.innerHTML}</div>${extra}` };
  }
  /* the graphic cards of a tab drawn in host: { <slot id>: [{ title, sub, shown, html }] } */
  function grab(host) {
    const out = {};
    host.querySelectorAll('.vk.va-card, .vk.vk-det').forEach(card => {
      const slot = card.closest('[id^="gfx_"]'); if (!slot) return;
      const list = out[slot.id] = out[slot.id] || [], btns = ALLSEG.has(slot.id) ? [...card.querySelectorAll('.vk-seg button[data-vkseg]')] : [];
      if (btns.length < 2) { const g = one(card); if (g) list.push(g); return; }
      const cur = btns.find(b => b.getAttribute('aria-pressed') === 'true');
      btns.forEach(b => { b.click(); const g = one(card); if (g) list.push(g); });
      if (cur) cur.click();   // the tab's own state as it was
    });
    return out;
  }
  function figures(B, inc, wScr) {
    const RB = window.PSBReportBuild, FT = window.PSBReportTab, out = {};
    if (typeof document === 'undefined' || !window.PSBVizKit) return out;
    const host = document.createElement('div'); host.setAttribute('aria-hidden', 'true'); host.style.cssText = 'position:absolute;left:-30000px;top:0;visibility:hidden;pointer-events:none;';
    document.body.appendChild(host);
    try {
      Object.entries(RB.TABS).forEach(([k, [ui]]) => {
        const U = window[ui]; if (inc[k] === false || !U || !U.after) return;
        const ctx = { P: B.P, inp: B.inp, R: B.R, W: B.W, ui: {}, redraw() {} };
        const shot = w => { host.style.width = w + 'px'; host.innerHTML = U.output(ctx); try { U.after(host, ctx); } catch (e) { console.warn(e); } const g = grab(host); host.innerHTML = ''; return g; };
        const P_ = shot(PW), S_ = wScr && wScr < PW - 40 ? shot(wScr) : null, m = {};
        Object.entries(P_).forEach(([id, list]) => { m[id] = list.map((g, j) => { const sc = S_ && S_[id] && S_[id][j];
          const cap = FT.inline(g.title) + (g.sub ? ` (${FT.inline(g.sub)})` : '') + (g.shown ? `; shown: ${FT.inline(g.shown)}` : '');
          return { type: 'figure', caption: cap, svg: sc ? `<div class="vk rp-vk rp-fig-scr">${sc.html}</div><div class="vk rp-vk rp-fig-prn">${g.html}</div>` : `<div class="vk rp-vk">${g.html}</div>` }; }); });
        out[k] = m;
      });
    } finally { host.remove(); }
    return out;
  }
  function render(host, ctx) {
    const o = ctx.opts || {};
    if (window.SharedReport) window.SharedReport.css();
    host.innerHTML = '<div class="rp-host"></div>';
    const box = host.firstChild;
    if (!window.SharedReport) { box.innerHTML = '<div class="alert err">shared/report.js is not loaded.</div>'; return null; }
    const B = window.PSBReportData.compute(ctx.P, ctx.rc);
    if (B.err) { box.innerHTML = `<div class="alert err" role="alert">The report cannot be built: ${esc(B.err)}</div>`; return null; }
    const inc = incOf(o), wScr = Math.round(box.clientWidth || 0), narrow = wScr > 0 && wScr < PW - 40, key = JSON.stringify([ctx.rc && ctx.rc.key, ctx.rc && ctx.rc.allKey, inc, narrow ? wScr : 0]);
    // the model is kept while the inputs, the sections chosen and the figure width are the same (the result object of the page is the same)
    if (S.key !== key || !S.M) { let figs = {}; try { figs = figures(B, inc, narrow ? wScr : 0); } catch (e) { console.warn(e); }
      S.M = window.PSBReportBuild.model(B, { include: inc, figures: figs }); S.key = key; }
    const tb = document.getElementById('tabBar');
    const V = window.SharedReport.mount(box, S.M, { controls: controls(o), closed: S.closed, stick: tb ? tb.offsetHeight : 0, spy: true,
      onGoto: t => { if (/^in:/.test(t)) { if (ctx.goin) ctx.goin(t.slice(3)); } else if (ctx.goto) ctx.goto(t); } });
    box.querySelectorAll('[data-rpinc]').forEach(el => el.addEventListener('change', () => { o.inc = o.inc || {}; o.inc[el.dataset.rpinc] = el.checked; if (ctx.save) ctx.save(); render(host, ctx); }));
    return V;
  }
  window.PSBReportUI = { render, figures, state: S, PW };
})();
