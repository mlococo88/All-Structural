/* COPY, to move to shared/ later (CLAUDE.md §3; docs/ps-bridge-plan.md §2.1): apps/steel-bridge/ui/splitter.js at d4e0d2b (2026-11-12).
   Changes from the source, only: the namespace window.SBDSplitUI -> window.PSBSplitUI, the UI key sbd2.splitRatio_v1 -> psb2.splitRatio_v1
   and the event sbd2:panelresize -> psb2:panelresize (CLAUDE.md §5: this app writes psb2.* keys only). Element ids (#sbSplit, #main,
   #inputPanel, #outputPanel, #sbDashCol) unchanged, as in the copied shell CSS. Keep in step with the source until the move. */
/* apps/ps-bridge/ui/splitter.js (copy) — the grab bar between the input and output panels (window.PSBSplitUI). Classic script. Created
   2026-11-09 (SBW; engineer: "maybe it would be good to have the input/output panel width adjustable with a grab bar or something").
   Display only: nothing is calculated here and nothing goes into the project, the autosave or the export.

   #sbSplit (index.html, between #inputPanel and #outputPanel) is shown only where the two panels are side by side (900 px and wider,
   the same breakpoint as the stacked phone / tablet layout); below that, and in print, it is hidden and nothing changes.
   The input panel's width is a share r of the width beside the check summary column (#sbDashCol, 0 when not shown): the CSS custom
   property --sbIn on #main (default .33, the layout before the splitter). r is kept per browser in the UI key psb2.splitRatio_v1
   (the app's psb2. UI-key prefix, as psb2.dashCollapsed_v1); with no key the default layout is exactly the one before the splitter.
   A dragged / keyed width is clamped so the input panel is at least MIN_IN px and the output panel at least MIN_OUT px wide (when the
   window is too narrow for both, the input panel keeps its minimum), and clamped again when the window or the summary column changes.
   Mouse, pen and touch: pointer events with pointer capture. Keyboard (the bar is focusable, role="separator"): Left / Right 16 px
   (Shift: 64 px), Page Up / Page Down 80 px, Home / End to the limits, Enter resets. Double-click resets to the default (and clears
   the key). After the width changes (rAF-throttled) the page gets a window "resize" event and a "psb2:panelresize" event
   (detail { input, output } px) so anything that sizes itself to its container redraws; the 3D views also watch their own box. */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;   // loaded without a page (the Node engine tests): nothing to do (2026-11-10)
  const KEY = 'psb2.splitRatio_v1', DEF = 0.33, MIN_IN = 300, MIN_OUT = 480, MQ = '(min-width:900px)';
  const S = { want: null, el: null, main: null, inp: null, out: null, dash: null, mq: null, raf: 0, lastOut: -1, user: false };
  const ls = () => { try { return window.localStorage; } catch (e) { return null; } };
  const rd = () => { try { const s = ls(); const v = s ? parseFloat(s.getItem(KEY)) : NaN; return isFinite(v) && v > 0.02 && v < 0.98 ? v : null; } catch (e) { return null; } };
  const wr = v => { try { const s = ls(); if (!s) return; if (v == null) s.removeItem(KEY); else s.setItem(KEY, v.toFixed(4)); } catch (e) { /* not kept */ } };
  const side = () => !!(S.mq ? S.mq.matches : window.matchMedia && window.matchMedia(MQ).matches) && getComputedStyle(S.el).display !== 'none';
  /* widths: base = the width the share applies to (#main less the summary column); the input panel = base * r; the output panel = base - input - bar */
  function geo() {
    const mw = S.main.clientWidth, dw = S.dash && getComputedStyle(S.dash).display !== 'none' ? S.dash.getBoundingClientRect().width : 0, sw = S.el.getBoundingClientRect().width;
    const base = Math.max(1, mw - dw), hi = Math.max(MIN_IN, base - sw - MIN_OUT);
    return { base, sw, lo: MIN_IN, hi };
  }
  const clampPx = (px, g) => Math.min(g.hi, Math.max(g.lo, px));
  function aria(g, r) {
    const pct = x => Math.round(1000 * x / g.base) / 10, inW = Math.round(S.inp.getBoundingClientRect().width);
    S.el.setAttribute('aria-valuemin', String(pct(g.lo))); S.el.setAttribute('aria-valuemax', String(pct(g.hi)));
    S.el.setAttribute('aria-valuenow', String(Math.round(1000 * r) / 10));
    S.el.setAttribute('aria-valuetext', `Input panel ${Math.round(100 * r)} % of the width (${inW} px)${S.want == null ? ', default' : ''}`);
  }
  /* apply the wanted share (clamped); the default (no key) leaves --sbIn unset, as before the splitter */
  function apply() {
    if (!S.el) return;
    if (!side()) return;
    const g = geo();
    if (S.want == null) { S.main.style.removeProperty('--sbIn'); aria(g, S.inp.getBoundingClientRect().width / g.base); }
    else { const r = clampPx(S.want * g.base, g) / g.base; S.main.style.setProperty('--sbIn', r.toFixed(5)); aria(g, r); }
    notify();
  }
  function notify() {
    if (S.raf) return;
    S.raf = requestAnimationFrame(() => { S.raf = 0;
      const o = Math.round(S.out.getBoundingClientRect().width); if (o === S.lastOut) return;
      const first = S.lastOut < 0, user = S.user; S.lastOut = o; S.user = false; if (first || !user) return;   // a real window resize already sends its own event
      try { window.dispatchEvent(new CustomEvent('psb2:panelresize', { detail: { input: Math.round(S.inp.getBoundingClientRect().width), output: o } })); window.dispatchEvent(new Event('resize')); } catch (e) { /* old browser */ }
    });
  }
  function setPx(px, save) { S.user = true; const g = geo(); S.want = clampPx(px, g) / g.base; apply(); if (save) wr(S.want); }
  function reset() { S.user = true; S.want = null; wr(null); apply(); }

  function init() {
    S.el = document.getElementById('sbSplit'); S.main = document.getElementById('main'); S.inp = document.getElementById('inputPanel');
    S.out = document.getElementById('outputPanel'); S.dash = document.getElementById('sbDashCol');
    if (!S.el || !S.main || !S.inp || !S.out) return;
    S.want = rd();
    if (window.matchMedia) { S.mq = window.matchMedia(MQ); const f = () => apply(); if (S.mq.addEventListener) S.mq.addEventListener('change', f); else if (S.mq.addListener) S.mq.addListener(f); }
    let drag = null;
    S.el.addEventListener('pointerdown', e => {
      if (e.button !== 0 || !side()) return;
      e.preventDefault(); S.el.focus({ preventScroll: true });
      drag = { id: e.pointerId, x0: e.clientX, w0: S.inp.getBoundingClientRect().width, x: e.clientX, raf: 0 };
      try { S.el.setPointerCapture(e.pointerId); } catch (er) { /* fine */ }
      S.el.classList.add('drag'); document.body.classList.add('sbSplitDrag');
    });
    S.el.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      drag.x = e.clientX;
      if (!drag.raf) drag.raf = requestAnimationFrame(() => { if (!drag) return; drag.raf = 0; setPx(drag.w0 + drag.x - drag.x0, false); });
    });
    const end = e => {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      if (drag.raf) cancelAnimationFrame(drag.raf);
      const moved = Math.abs(drag.x - drag.x0) > 0; if (moved) setPx(drag.w0 + drag.x - drag.x0, true);
      try { S.el.releasePointerCapture(drag.id); } catch (er) { /* fine */ }
      drag = null; S.el.classList.remove('drag'); document.body.classList.remove('sbSplitDrag');
    };
    S.el.addEventListener('pointerup', end); S.el.addEventListener('pointercancel', end); S.el.addEventListener('lostpointercapture', end);
    S.el.addEventListener('dblclick', e => { e.preventDefault(); reset(); });
    S.el.addEventListener('keydown', e => {
      if (!side()) return;
      const g = geo(), w = S.inp.getBoundingClientRect().width, k = e.key;
      const d = k === 'ArrowLeft' || k === 'ArrowDown' ? -1 : k === 'ArrowRight' || k === 'ArrowUp' ? 1 : 0;
      if (d) setPx(w + d * (e.shiftKey ? 64 : 16), true);
      else if (k === 'PageUp' || k === 'PageDown') setPx(w + (k === 'PageUp' ? 80 : -80), true);
      else if (k === 'Home') setPx(g.lo, true);
      else if (k === 'End') setPx(g.hi, true);
      else if (k === 'Enter') reset();
      else return;
      e.preventDefault();
    });
    // the window, the summary column (« / ») or the page's own layout changing: clamp again, redraw
    if (window.ResizeObserver) { const ro = new ResizeObserver(() => apply()); ro.observe(S.main); if (S.dash) ro.observe(S.dash); }
    else window.addEventListener('resize', () => apply());
    apply();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.PSBSplitUI = { KEY, DEF, MIN_IN, MIN_OUT, reset, apply, setPx: px => setPx(px, true) };
})();
