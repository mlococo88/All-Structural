/* apps/crane-pick/ui/app.js — the page controller of the Crane Pick Analyzer (window.CranePickApp). C1 (2026-11-16).
   One project P (engine/model.js), autosaved to crane.project.current on every change; Undo / Redo = whole-project snapshots
   (shared/projects.js history, session only; the map view and the page's tabs are not steps). The other ui/*.js files register their
   input tabs (inTab) and output tabs (outTab) and listen to the events below; they change the project only through update() / live().
   Events: 'project' (a different project or an undo / redo: redraw everything), 'change' (kind: 'title' | 'notes' | 'site' | 'sheets' |
   'items' | 'select' …), 'live' (during a drag: only what moves is redrawn; no autosave, no undo step), 'tab' (an output tab shown). */
(function () {
  'use strict';
  const M = window.CranePickModel;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = (() => { try { const k = '__crane_probe'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return localStorage; } catch (e) { return null; } })();
  const memStore = { getItem: () => null, setItem: () => {}, removeItem: () => {}, key: () => null, length: 0 }, LS = store || memStore;
  let P = M.newProject(), openName = '', H = null, autoFailed = false;
  let ui = { itab: 'proj', otab: 'plan', base: 'sat' };
  try { Object.assign(ui, JSON.parse((store && store.getItem(M.KEYS.ui)) || '{}')); } catch (e) { /* defaults */ }
  const saveUi = () => { try { store && store.setItem(M.KEYS.ui, JSON.stringify(ui)); } catch (e) { /* not kept */ } };
  const subs = {};
  const on = (ev, fn) => { (subs[ev] || (subs[ev] = [])).push(fn); };
  const emit = (ev, a) => (subs[ev] || []).forEach(f => { try { f(a); } catch (e) { console.error(e); } });
  const inTabs = [], outTabs = [];
  /* ---------- storage ---------- */
  function autosave() {
    if (!store) return;
    const ok = M.save(LS, P);
    if (!ok && !autoFailed) notice('Autosave failed: this browser\'s storage is full or blocked. Use Save or Export JSON to keep the project.', 'err');
    autoFailed = !ok; $('saveState').textContent = ok ? '' : '· autosave off';
  }
  function setOpen(n) { openName = n || ''; try { store && store.setItem(M.KEYS.open, openName); } catch (e) { /* not kept */ } }
  /* ---------- changes ---------- */
  let barT = null;
  const bar = () => { clearTimeout(barT); barT = setTimeout(() => { if (api.pb) api.pb.refresh(); }, 60); };
  /* update(fn, kind, o): fn(P) changes the project; then autosave, one undo step, the event */
  function update(fn, kind, o) { if (fn) fn(P); autosave(); if (H) H.record(); emit('change', Object.assign({ kind: kind || 'any' }, o || {})); bar(); }
  /* live(kind, o): a drag in progress (the caller changed P already); commit(kind) when it ends */
  function live(kind, o) { emit('live', Object.assign({ kind }, o || {})); }
  function viewChanged(v) { P.view = v; autosave(); }
  function loadProject(p, name) {
    P = M.normalize(p); setOpen(name); autosave(); if (H) H.reset(); emit('project'); bar();
  }
  /* ---------- notices (inline banners above the output tab) ---------- */
  function notice(html, kind, o) {
    o = o || {}; const n = document.createElement('div'); n.className = 'notice' + (kind ? ' ' + kind : '');
    if (o.id) { const old = document.getElementById(o.id); if (old) old.remove(); n.id = o.id; }
    n.innerHTML = `<div>${html}</div><div class="nBtns">${(o.buttons || []).map((b, i) => `<button type="button" data-nb="${i}">${esc(b.label)}</button>`).join('')}<button type="button" data-nb="x" title="Close">Close</button></div>`;
    n.addEventListener('click', e => { const b = e.target.closest('[data-nb]'); if (!b) return; if (b.dataset.nb === 'x') { n.remove(); return; } const bb = o.buttons[+b.dataset.nb]; if (bb && bb.run) bb.run(); if (!bb || bb.keep !== true) n.remove(); });
    $('notices').appendChild(n); return n;
  }
  /* ---------- tabs ---------- */
  function inTab(t) { inTabs.push(t); }
  function outTab(t) { outTabs.push(t); }
  function showITab(id) {
    if (!inTabs.some(t => t.id === id)) id = inTabs[0].id;
    ui.itab = id; saveUi();
    document.querySelectorAll('#inTabs [data-itab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.itab === id)));
    document.querySelectorAll('#inPanes [data-pane]').forEach(p => { p.hidden = p.dataset.pane !== id; });
    const t = inTabs.find(x => x.id === id); if (t && t.show) t.show();
  }
  function showOTab(id) {
    if (!outTabs.some(t => t.id === id)) id = outTabs[0].id;
    ui.otab = id; saveUi();
    document.querySelectorAll('#tabBar [data-otab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.otab === id)));
    document.querySelectorAll('#out [data-opane]').forEach(p => { p.hidden = p.dataset.opane !== id; });
    $('out').classList.toggle('plan', id === 'plan');
    const t = outTabs.find(x => x.id === id); if (t && t.show) t.show();
    emit('tab', id);
  }
  /* ---------- start ---------- */
  function start() {
    const L0 = M.load(LS); P = L0.project;
    try { openName = (store && store.getItem(M.KEYS.open)) || ''; } catch (e) { openName = ''; }
    if (L0.unreadable) notice('The autosaved project in this browser could not be read; a new project is open (the autosave text is kept until the next change).', 'warn');
    const it = $('inTabs'), ip = $('inPanes'), tb = $('tabBar'), out = $('out');
    inTabs.forEach(t => {
      const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.itab = t.id; b.textContent = t.label; b.onclick = () => showITab(t.id); it.appendChild(b);
      const p = document.createElement('div'); p.dataset.pane = t.id; p.setAttribute('role', 'tabpanel'); p.hidden = true; ip.appendChild(p); t.el = p;
    });
    outTabs.forEach(t => {
      const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.otab = t.id; b.textContent = t.label; b.onclick = () => showOTab(t.id); tb.appendChild(b);
      const p = document.createElement('div'); p.dataset.opane = t.id; p.hidden = true; if (t.paneId) p.id = t.paneId; out.appendChild(p); t.el = p;
    });
    inTabs.forEach(t => t.build && t.build(t.el));
    outTabs.forEach(t => t.build && t.build(t.el));
    if (window.SharedProjects) {
      H = SharedProjects.history({ get: () => M.inputsText(P), set: t => { const v = P.view; P = M.normalize(JSON.parse(t)); P.view = v; autosave(); emit('project'); bar(); } });
      if (window.SharedProjectsUI) SharedProjectsUI.undoRedo(H, { undo: $('bUndo'), redo: $('bRedo') });
    }
    emit('ready');
    showITab(ui.itab); showOTab(ui.otab);
    emit('project');
    if (H) H.reset();
    // Delete / Esc for the map tools: not while typing in a field
    document.addEventListener('keydown', e => { const a = document.activeElement; if (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return; emit('key', e); });
  }
  const api = {
    start, on, emit, update, live, viewChanged, loadProject, notice, inTab, outTab, showITab, showOTab, esc, $,
    get P() { return P; }, get ui() { return ui; }, saveUi, get openName() { return openName; }, setOpen, get LS() { return LS; }, get store() { return store; },
    get history() { return H; }, pb: null
  };
  window.CranePickApp = api;
})();
