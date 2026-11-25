/* apps/ps-bridge/ui/widein.js — "Widen inputs" and the enlarged input figures (window.PSBWideIn). Classic script; display only.
   Created 2026-11-25 (WIDE, engineer 2026-11-25: the input-tab graphics and input boxes bigger; a second window was considered and not
   chosen, since two copies of the app would overwrite each other's saved project):
     Widen inputs   a toggle button at the end of the input tab row (#bWide, aria-pressed): on, the input panel takes the whole width of #main
                    (the output panel, the splitter and the check summary column hidden by the class psbWide on <body>); off, the layout as
                    before, the dragged splitter width included (--sbIn and psb2.splitRatio_v1 are never touched). Only where the panels are
                    side by side (900 px and wider, the splitter's breakpoint); not printed. The page view only: nothing is stored (WIDE-a).
                    After each change: window "resize" and "psb2:panelresize" (as ui/splitter.js), so the figures redraw at the new width.
     Figures        a figure of an input tab (a host marked data-figzoom="<title>") opens enlarged in a dialog on a click or Enter / Space;
                    an interactive figure (the strand editor) gets an "⤢ Enlarge" button instead (data-figzoom-for="<host id>"). The dialog
                    shows a copy of the figure's SVG drawn at the dialog's size (the viewBox kept), its ids prefixed "fz<n>-" (and the references
                    to them), so no id is duplicated; closed (Escape, Close, a click on the backdrop) it is emptied.
   The page (index.html) calls:
     init(o)        o = { changed(on) }: wires #bWide and the figure clicks (delegated on document); changed(on) after each toggle
     isOn() / set(on)
     open(host, title)   the dialog for host's figure (tests)
   Nothing is calculated or stored here. */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;   // loaded without a page (the Node tests)
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MQ = '(min-width:900px)';
  const S = { on: false, o: null, dlg: null, back: null };
  const side = () => !window.matchMedia || window.matchMedia(MQ).matches;
  function fire() {
    try {
      const i = document.getElementById('inputPanel'), q = document.getElementById('outputPanel');
      window.dispatchEvent(new CustomEvent('psb2:panelresize', { detail: { input: Math.round(i ? i.getBoundingClientRect().width : 0), output: Math.round(q ? q.getBoundingClientRect().width : 0) } }));
      window.dispatchEvent(new Event('resize'));
    } catch (e) { /* old browser */ }
  }
  function btn() {
    const b = document.getElementById('bWide'); if (!b) return;
    b.setAttribute('aria-pressed', String(S.on));
    b.textContent = S.on ? '⤡ Back to outputs' : '⤢ Widen inputs';
    b.title = S.on ? 'Show the output panel and the check summary again (the layout as before)' : 'The input panel over the whole width (the output panel and the check summary hidden until you click again)';
  }
  function set(on) {
    on = !!on && side(); if (on === S.on) { btn(); return; }
    S.on = on; document.body.classList.toggle('psbWide', on); btn();
    if (S.o && S.o.changed) S.o.changed(on);
    fire();
  }
  /* the figure copy: the SVGs of host, ids prefixed and their references rewritten, drawn at the dialog's size */
  function copyOf(host) {
    const svgs = [...host.querySelectorAll('svg')].filter(s => !s.parentElement.closest('svg') && !s.closest('button'));
    return svgs.map((s, n) => {
      const c = s.cloneNode(true), pre = `fz${n}-`;
      const ids = new Set([...c.querySelectorAll('[id]')].map(e => e.id).concat(c.id ? [c.id] : []));
      if (c.id) c.id = pre + c.id;
      c.querySelectorAll('[id]').forEach(e => { e.id = pre + e.id; });
      if (ids.size) c.querySelectorAll('*').forEach(e => [...e.attributes].forEach(a => {
        let v = a.value, w = v;
        if (/url\(#/.test(v)) w = v.replace(/url\(#([^)]+)\)/g, (m, id) => ids.has(id) ? `url(#${pre}${id})` : m);
        if ((a.name === 'href' || a.name === 'xlink:href') && /^#/.test(v) && ids.has(v.slice(1))) w = '#' + pre + v.slice(1);
        if (w !== v) e.setAttribute(a.name, w);
      }));
      if (!c.getAttribute('viewBox')) { const w = parseFloat(s.getAttribute('width')) || s.getBoundingClientRect().width, h = parseFloat(s.getAttribute('height')) || s.getBoundingClientRect().height; if (w > 0 && h > 0) c.setAttribute('viewBox', `0 0 ${w} ${h}`); }
      c.removeAttribute('width'); c.removeAttribute('height'); c.style.width = '100%'; c.style.height = 'auto'; c.style.maxHeight = 'calc(100vh - 140px)'; c.style.maxWidth = '100%';
      c.removeAttribute('tabindex'); c.querySelectorAll('[tabindex]').forEach(e => e.removeAttribute('tabindex'));
      return c;
    });
  }
  function dlg() {
    if (S.dlg) return S.dlg;
    const d = document.createElement('dialog'); d.id = 'figZoomDlg'; d.setAttribute('aria-labelledby', 'figZoomTtl');
    d.innerHTML = '<div class="fzHead"><b id="figZoomTtl"></b><button type="button" id="figZoomClose">Close</button></div><div class="fzBody" id="figZoomBody"></div>';
    document.body.appendChild(d);
    d.addEventListener('click', e => { if (e.target === d || e.target.closest('#figZoomClose')) d.close(); });   // the backdrop: a click on the dialog box itself
    d.addEventListener('close', () => { const b = d.querySelector('#figZoomBody'); if (b) b.innerHTML = ''; if (S.back && S.back.isConnected) try { S.back.focus(); } catch (e) { /* fine */ } S.back = null; });
    return (S.dlg = d);
  }
  function open(host, title) {
    if (!host) return false;
    const c = copyOf(host); if (!c.length) return false;
    const d = dlg(); S.back = document.activeElement;
    d.querySelector('#figZoomTtl').textContent = title || 'Figure';
    const b = d.querySelector('#figZoomBody'); b.innerHTML = ''; c.forEach(x => b.appendChild(x));
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
    const cl = d.querySelector('#figZoomClose'); if (cl) cl.focus();
    return true;
  }
  const isCtl = t => !!(t.closest && t.closest('button, a, input, select, textarea, label, [data-se], [data-vkseg], [data-vkchip]'));
  function init(o) {
    S.o = o || {}; btn();
    document.addEventListener('click', e => {
      const t = e.target;
      if (t.closest && t.closest('#bWide')) { e.preventDefault(); set(!S.on); return; }
      const fb = t.closest && t.closest('[data-figzoom-for]'); if (fb) { e.preventDefault(); const h = document.getElementById(fb.dataset.figzoomFor); open(h, fb.dataset.figzoomTitle || ''); return; }
      const h = t.closest && t.closest('#inPanes [data-figzoom]'); if (h && !isCtl(t)) { open(h, h.dataset.figzoom); }
    });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const h = e.target.matches && e.target.matches('#inPanes [data-figzoom]') ? e.target : null; if (!h) return;
      e.preventDefault(); open(h, h.dataset.figzoom);
    });
    if (window.matchMedia) { const m = window.matchMedia(MQ), f = () => { if (!m.matches && S.on) set(false); }; if (m.addEventListener) m.addEventListener('change', f); else if (m.addListener) m.addListener(f); }
  }
  /* mark(host, title): a figure host of an input tab: focusable, opens enlarged */
  function mark(host, title) {
    if (!host) return; host.dataset.figzoom = title; host.tabIndex = 0;
    host.setAttribute('aria-label', `${title} (Enter: open it enlarged)`); host.title = 'Click the figure (or press Enter) to open it enlarged';
  }
  /* enlargeBtn(title, hostId): the "⤢ Enlarge" button of an interactive figure */
  const enlargeBtn = (title, hostId) => `<button type="button" class="fzBtn" data-figzoom-for="${esc(hostId)}" data-figzoom-title="${esc(title)}" title="Open this figure enlarged (a view; edit on the figure here)">⤢ Enlarge</button>`;
  window.PSBWideIn = { init, isOn: () => S.on, set, open, mark, enlargeBtn };
})();
