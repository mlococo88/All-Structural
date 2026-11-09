/* apps/steel-bridge/ui/summary.js — the Summary output tab (window.SBDSummaryUI), first in the output tab bar. Classic script. Created
   2026-11-09 (engineer: "There is no Summary output tab, we need to add one"). Display only: every value is a module's own governing
   value (report/summary.js: the module's build() through report/data.js, the Report's governing rows), nothing is calculated here.

   The tab shows: the overall verdict (PASS / FAIL / REVIEW counts) and the governing check as a link; the project overview (spans,
   skews, cross-section, grades, deck, owner, girder steel weight from the analysis, the girder elevation with its governing checks);
   the per-girder table (rows G1…Gn, a column per check module, each cell a link to the output tab, girder and check that works it);
   the governing check of each column per girder; the checks not run / not applicable; the warnings (module warnings, Auto design
   WARNING flags of a run not applied, the owner-rule notes).

   Running (as #1260): on selection every module out of date for this project state is run, one module of one girder per timer tick
   ("Running Flexure and rating, G1 (2/8)…"; the girder analysis, the first module, cannot yield inside), through the shared analysis
   cache (report/data.js install). A project state already run shows at once. An input change while the tab is open runs again after
   600 ms of quiet. "Re-run all" runs every module again. The results are kept in memory for the last project state only (nothing saved).

   render(host, ctx): ctx = { P, ui, now (true: selected now: run at once), open() (is the Summary the tab shown), goto(tab, gi) (selects
   an output tab and girder), save() }. Also: state(), start(P, o), subscribe(fn), focus(cell) (after goto: selects the cell's location on
   its tab, opens and flashes the step and the card that works it), gotoCell(gi, colId), txt(t). */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SM = () => window.SBDSummary, fmt = (x, d) => window.SharedUnits.fmt(x, d);
  const AUTO_MS = 600;
  const S = { pk: '', parts: [], list: [], busy: false, run: 0, prog: '', t0: 0, secs: null, timer: null, ctx: null, subs: [], host: null, err: '', open: new Set() };
  const LBL = { pass: 'PASS', fail: 'FAIL', review: 'REVIEW', na: 'n/a', notrun: 'not run' };

  /* text of a check (report notation: $tex$, f_bu subscripts) as HTML, with SharedSteps' built-in renderer (not KaTeX: small cells) */
  const lite = t => { const w = window, K = w.katex; let h; try { if (K) w.katex = undefined; h = window.SharedSteps.toHTML(t); } catch (e) { h = esc(t); } finally { if (K) w.katex = K; } return h; };
  const txt = t => String(t == null ? '' : t).split(/(\$[^$]+\$)/).map(p => (p.length > 2 && p[0] === '$' && p[p.length - 1] === '$' ? lite(p.slice(1, -1))
    : esc(p).replace(/_\{?([A-Za-z0-9,]+)\}?/g, '<sub>$1</sub>'))).join('');   // as the tabs' tt()

  function css() {
    if (document.getElementById('sbsum-css')) return;
    const st = document.createElement('style'); st.id = 'sbsum-css';
    st.textContent = `
.sum-verd{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;font-family:var(--font-ui)}
.sum-badge{font-weight:700;font-size:13pt;padding:3px 12px;border-radius:5px;border:2px solid;letter-spacing:.04em}
.sum-badge.fail{color:#991B1B;background:#FEF2F2;border-color:var(--fail)} .sum-badge.pass{color:#065F46;background:#ECFDF5;border-color:var(--pass)} .sum-badge.review{color:#92400E;background:#FFFBEB;border-color:var(--warn)} .sum-badge.none{color:#475569;background:var(--slate-100);border-color:var(--slate-400)}
.sum-cnt{display:inline-flex;gap:5px;flex-wrap:wrap} .sum-cnt span{font-size:8.5pt;font-weight:700;padding:1px 6px;border:1px solid;border-radius:3px;white-space:nowrap}
.sum-cnt .c-fail{color:#991B1B;background:#FEF2F2;border-color:var(--fail)} .sum-cnt .c-review{color:#92400E;background:#FFFBEB;border-color:var(--warn)} .sum-cnt .c-pass{color:#065F46;background:#ECFDF5;border-color:var(--pass)} .sum-cnt .c-na{color:#475569;background:var(--slate-100);border-color:var(--slate-400)}
.sum-gov{margin:8px 0 2px;font-size:10pt} .sum-run{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:8px;font-family:var(--font-ui);font-size:9pt;color:#475569}
.sum-run .spin{display:inline-block;width:12px;height:12px;border:2px solid #CBD5E1;border-top-color:var(--color-primary);border-radius:50%;animation:sbspin .8s linear infinite;vertical-align:-2px;margin-right:6px}
table.sum-tbl{width:auto;min-width:100%} table.sum-tbl th{font-family:var(--font-ui);font-size:8pt;font-weight:600;line-height:1.15;vertical-align:bottom} table.sum-tbl td{font-family:var(--font-ui);font-size:9pt;white-space:nowrap}
table.sum-tbl td.s-pass{background:#ECFDF5} table.sum-tbl td.s-fail{background:#FEE2E2;font-weight:700} table.sum-tbl td.s-review{background:#FEF3C7} table.sum-tbl td.s-na,table.sum-tbl td.s-notrun{color:#64748b;background:#F8FAFC}
table.sum-tbl td a{color:inherit;text-decoration:underline dotted;text-underline-offset:2px} table.sum-tbl td a:hover{text-decoration:underline}
table.sum-tbl td.s-pass a{color:#065F46} table.sum-tbl td.s-fail a{color:#991B1B} table.sum-tbl td.s-review a{color:#92400E}
table.sum-ov th{width:1%;white-space:nowrap;font-family:var(--font-ui);font-size:9pt;font-weight:600} table.sum-ov td{font-size:10pt}
table.sum-tbl th.g0,table.sum-tbl td.g0{border-left:2px solid #94A3B8}
.sum-sub{font-size:7.5pt;color:#475569;font-weight:400;display:block}
.sum-fig{max-width:680px;margin:6px auto 0} .sum-fig svg{max-width:100%;height:auto;display:block}
.sum-list{margin:4px 0;padding-left:18px;font-size:9.5pt} .sum-list li{margin:2px 0}
details.sum-g>summary{cursor:pointer;font-family:var(--font-ui);font-size:9.5pt;padding:3px 0}
.sum-flash{animation:sumflash 2.2s ease-out 1} @keyframes sumflash{0%,35%{box-shadow:0 0 0 3px #F59E0B;background-color:#FFF7D6}100%{box-shadow:0 0 0 0 rgba(245,158,11,0)}}
@media (prefers-reduced-motion:reduce){.sum-flash{animation:none;outline:3px solid #F59E0B}}
@media screen and (max-width:600px){table.sum-ov th{white-space:normal;width:auto;min-width:90px}}
@media print{.sum-run button{display:none}}`;
    document.head.appendChild(st);
  }

  /* ---------- the run ---------- */
  const pkOf = P => JSON.stringify(P);
  const todo = (P, mods) => { const out = []; P.girders.forEach((g, gi) => SM().MODS.forEach(m => { if ((!mods || mods.includes(m.k)) && !(S.parts[gi] && S.parts[gi][m.k])) out.push({ gi, m }); })); return out; };
  const notify = () => S.subs.forEach(f => { try { f(state()); } catch (e) { /* a listener's error does not stop the run */ } });
  function sync(P) {   // a new project state: the results of the last one are out of date
    const pk = pkOf(P); if (pk === S.pk) return;
    if (S.list.some(G => G && Object.values(G.cells || {}).some(q => q.st !== 'notrun'))) S.prev = S.list;   // DASH: the last results, shown as out of date by the left summary
    S.pk = pk; S.parts = []; S.list = []; S.secs = null; S.run++; S.busy = false; S.prog = ''; clearTimeout(S.timer);
    notify();
  }
  function recell(P, gi) { const L = S.list; try { L[gi] = SM().cells(P, gi, S.parts[gi] || {}); } catch (e) { L[gi] = { gi, label: (P.girders[gi] || {}).label || `G${gi + 1}`, cells: {}, warn: ['Summary error: ' + (e && e.message)], err: {} }; } }
  /* start(P, o): run the modules not yet run for this project state (o.mods: only those modules; o.all: every module again; o.delay ms) */
  function start(P, o) {
    o = o || {}; sync(P);
    if (o.all) { S.parts = []; S.list = []; S.run++; S.busy = false; }
    if (S.busy) return;   // a run in progress covers every module not yet run of this project state
    const list = todo(P, o.mods); P.girders.forEach((g, gi) => { if (!S.list[gi]) recell(P, gi); });
    if (!list.length) { notify(); return; }
    const run = ++S.run; S.busy = true; S.err = ''; S.t0 = Date.now(); S.prog = o.delay ? 'Inputs changed — updating…' : `Running ${list[0].m.name}, ${S.list[list[0].gi].label} (1/${list.length})…`; draw(); notify();
    const step = k => {
      if (run !== S.run) return;
      if (pkOf(P) !== S.pk) { S.busy = false; return; }
      if (k >= list.length) { S.busy = false; S.prog = ''; S.secs = (Date.now() - S.t0) / 1000; draw(); notify(); return; }
      const { gi, m } = list[k];
      S.prog = `Running ${m.name}, ${S.list[gi].label} (${k + 1}/${list.length})…`; draw(); notify();
      // paint the progress, then one module of one girder, then yield
      requestAnimationFrame(() => setTimeout(() => {
        if (run !== S.run) return;
        try { (S.parts[gi] = S.parts[gi] || {})[m.k] = SM().run(P, gi, m.k); } catch (e) { (S.parts[gi] = S.parts[gi] || {})[m.k] = { k: m.k, err: { [m.k]: 'Calculation error: ' + (e && e.message) } }; }
        recell(P, gi);
        { const pf = S.pendFocus, q = pf && pf.gi === gi && S.list[gi].cells[pf.id]; if (q && q.st !== 'notrun') { S.pendFocus = null; focus(q); } }   // DASH: a chip of a module not run: its card once run
        setTimeout(() => step(k + 1), 0);
      }, 0));
    };
    clearTimeout(S.timer); S.timer = setTimeout(() => step(0), o.delay || 0);
  }
  const state = () => ({ busy: S.busy, prog: S.prog, list: S.list, prev: S.prev || null, secs: S.secs, pk: S.pk, ov: SM().overall(null, S.list.filter(Boolean)) });
  const subscribe = f => { S.subs.push(f); };
  function draw() { if (S.host && S.ctx && S.ctx.open && S.ctx.open() && S.host.isConnected) paint(S.host, S.ctx); }

  /* ---------- links ---------- */
  /* the row of the cell's location on its tab (the tab's own row-selection attribute), from the Report key's scope */
  function rowSel(scope) {
    if (scope === 'sc') return '[data-fa="sc:0"]';   // the studs: one scope (the zones table)
    const m = /^([a-z0-9.]+)@([a-z]*)(\d+)$/i.exec(scope || ''); if (!m) return null;
    const [, s, p, i] = m;
    return { flex: `[data-fx="${i}"]`, 'sh.pan': `[data-sh="pan:${i}"]`, 'sh.st': `[data-sh="loc:${i}"]`, 'sh.ts': `[data-sh="ts:${i}"]`, 'sh.bs': `[data-sh="bs:${i}"]`, fa: `[data-fa="fa:${i}"]`, gs17: `[data-fa="gs:${i}"]`,
      cn: `[data-cnsel="${i}"]`, cnoh: `[data-ohsel="${i}"]`, spl: `[data-spsel="${i}"]`, wd: `[data-wt="${p}:${i}"]`, rt: `[data-rt="${i}"]` }[s] || null;
  }
  const busyTab = out => { const st = [...out.querySelectorAll('.alert.stale')].some(a => !a.hidden && a.offsetParent !== null); const sp = document.querySelector('#autoMsg .spin');
    return st || !!sp || [...out.querySelectorAll('.alert')].some(a => /Calculating|Building/.test(a.textContent || '') && a.offsetParent !== null); };
  function flash(el) { if (!el) return; el.classList.remove('sum-flash'); void el.offsetWidth; el.classList.add('sum-flash'); setTimeout(() => el.classList.remove('sum-flash'), 2400); }
  /* focus(c): after the tab and girder are selected, wait for the tab to be up to date (#1260 runs it), select the cell's location
     row, open the step that works the value and bring its card into view, flashed */
  let focusN = 0;
  function focus(c) {
    const n = ++focusN, out = document.getElementById('out'), t0 = Date.now();
    const go = () => {
      if (n !== focusN) return;
      const cur = document.querySelector('#tabBar [aria-selected="true"]'); if (c.tab && cur && cur.dataset.otab !== c.tab) return;   // another tab chosen since
      if (busyTab(out) && Date.now() - t0 < 120000) { setTimeout(go, 200); return; }
      const sel = rowSel(c.scope); if (sel) { const r = out.querySelector(sel); if (r && !r.classList.contains('sel')) r.click(); }
      setTimeout(() => {
        if (n !== focusN) return;
        let el = c.step ? window.SharedSteps.reveal(out, c.step) : null;
        if (!el && c.step && /^an\./.test(c.step)) el = window.SharedSteps.reveal(out, c.step.replace(/^an\./, ''));
        const row = sel ? out.querySelector(sel) : null, card = (el || row || out.querySelector('.fx-gov, tr.gov') || out.querySelector('.sec')) ;
        const sec = card && card.closest ? card.closest('.sec') || card : card;
        if (sec) { sec.scrollIntoView({ block: el ? 'nearest' : 'start' }); flash(sec); }
        if (el) { el.scrollIntoView({ block: 'center' }); flash(el); }
        else if (row) { row.scrollIntoView({ block: 'center' }); flash(row); }
      }, 60);
    };
    setTimeout(go, 50);
  }
  /* gotoCell(gi, id, cx): the cell's tab, girder and step (cx: the caller's { P, goto } when the Summary tab has not been drawn: the left
     summary); a module not run yet is run (and its tab, selected, runs itself: #1260) */
  function gotoCell(gi, id, cx) {
    const X = cx || S.ctx, col = SM().COLS.find(q => q.id === id); if (!X || !col) return;
    sync(X.P); const G = S.list[gi], c = G && G.cells[id];
    if (!c || c.st === 'notrun') { S.pendFocus = { gi, id }; start(X.P, { mods: [SM().modOf(id).k] }); } else S.pendFocus = null;
    X.goto(col.tab, gi); const c2 = (S.list[gi] || {}).cells; if (c2 && c2[id] && c2[id].st !== 'notrun') focus(c2[id]);
  }

  /* ---------- drawing ---------- */
  const vTxt = (c, col) => !c || c.st === 'notrun' ? 'not run' : c.st === 'na' ? 'n/a' : col.rf ? (isFinite(c.rf) ? fmt(c.rf, 2) : '—') : (isFinite(c.r) ? fmt(c.r, 3) : 'NaN');
  const cellHtml = (G, col, k0) => { const c = G.cells[col.id] || { st: 'notrun' };
    const tip = c.st === 'na' ? c.why : c.st === 'notrun' ? 'Not run yet: click to run' : `${G.label}: ${c.check} — ${c.loc}${c.nWarn ? ` (${c.nWarn} warning item(s) on the tab)` : ''}`;
    return `<td class="s-${c.st}${k0 ? ' g0' : ''}" title="${esc(String(tip || '').replace(/\$|\{\}|[{}]|\\/g, ''))}"><a href="#" data-sumgo="${G.gi}|${col.id}">${vTxt(c, col)}</a></td>`; };
  function overview(P, list) {
    const M = window.SBDModel, G = M.GRADES, m = P.materials, d = P.deck, xs = P.xs || {}, U = window.SharedUnits, AN = window.SBDAnalysis;
    const sp = P.spans.lengths, cont = P.spans.continuity !== 'simple' && sp.length > 1, own = (P.ownerRules || {}).owner || 'AASHTO';
    const bays = (xs.bays || []).map(Number), same = bays.length && bays.every(b => b === bays[0]);
    const kv = (k, v) => `<tr><th class="lft">${k}</th><td class="lft">${v}</td></tr>`;
    const wts = list.map(Gs => ({ G: Gs, w: SM().weight(((S.parts[Gs.gi] || {}).an || {}).an) }));
    const wAll = wts.every(q => q.w != null) ? wts.reduce((a, q) => a + q.w, 0) : null;
    const wk = gi => `<a href="#" class="wk" data-sumwk="${gi}" title="Worked on the Analysis tab (Σw_s ℓ, equilibrium step)">§</a>`;
    const h = `<div class="tscroll"><table class="tbl sum-ov"><tbody>
      ${kv('Spans', `${sp.map(L => U.fmt(+L, 2)).join(' + ')} = ${U.fmt(sp.reduce((a, b) => a + (+b || 0), 0), 2)} ft, ${cont ? 'continuous' : sp.length > 1 ? 'simple spans' : 'simple span'}`)}
      ${kv('Support skews', (xs.skews || []).length ? xs.skews.map(s => U.fmt(+s, 1) + '°').join(', ') : '—')}
      ${kv('Cross-section', `${xs.nb || '—'} girders at ${bays.length ? (same ? U.fmt(bays[0], 2) + ' ft' : bays.map(b => U.fmt(b, 2)).join(', ') + ' ft') : '—'}; overhangs ${U.fmt(+xs.ohL, 2)} / ${U.fmt(+xs.ohR, 2)} ft`)}
      ${kv('Plate girders designed', P.girders.map(g => `${esc(g.label || g.id)} (${esc(g.position)}${AN ? `, loads of G${AN.lineOf(P, g) + 1}` : ''})`).join(', '))}
      ${kv('Steel (A709)', `top ${esc(m.steel.top)}, bottom ${esc(m.steel.bot)}, web ${esc(m.steel.web)} (F<sub>y</sub> ${G[m.steel.top].Fy} / ${G[m.steel.bot].Fy} / ${G[m.steel.web].Fy} ksi)`)}
      ${kv('Deck', `${d.composite === false ? 'noncomposite' : 'composite'}, t<sub>s</sub> ${U.fmt(d.ts, 2)} in (total ${U.fmt(d.tdeck, 2)} in), haunch ${U.fmt(d.haunch, 2)} in, f′<sub>c</sub> ${U.fmt(m.concrete.fc, 2)} ksi`)}
      ${kv('Owner', `${esc(M.clientName ? M.clientName(P) || '—' : '—')}; load rules ${esc(own)}`)}
      ${kv('Girder steel (DC1, with detail allowance)', wts.map(q => `${esc(q.G.label)} ${q.w != null ? U.fmt(q.w, 1) + ' kip ' + wk(q.G.gi) : 'not run'}`).join('; ') + (wAll != null && list.length > 1 ? `; total ${U.fmt(wAll, 1)} kip` : ''))}
    </tbody></table></div><p class="note">Girder steel: Σw<sub>s</sub>ℓ of each plate girder from its analysis (the plates × 490/144 lb/ft per in² × (1 + detail allowance)), as worked in the Analysis tab's DC1 equilibrium step (§). ${list.length > 1 ? 'The total is the sum of the plate girders listed.' : ''}${P.girders.length < (xs.nb || 0) ? ` The project has ${P.girders.length} plate girder(s) for ${xs.nb} girder lines.` : ''}</p>`;
    return h;
  }
  function figure(P, Gs) {
    const GB = window.SBDTabGfxB, GR = window.SBDGraphics, D = window.SharedDxf; if (!GB || !GR || !D || !Gs || !Gs.gov) return '';
    try { const g = GB.summary({ gov: Gs.gov }, P, { gi: Gs.gi }); return GR.tightSvg ? GR.tightSvg(g.D, { i0: g.i0, i1: g.i1, bg: '#fff', title: g.title, width: '100%' }) : D.toSVG(g.D, { bg: '#fff', width: '100%' }); } catch (e) { return ''; }
  }
  function paint(host, ctx) {
    const P = ctx.P, COLS = SM().COLS, list = P.girders.map((g, gi) => S.list[gi] || { gi, label: g.label || g.id || `G${gi + 1}`, cells: {}, warn: [], err: {} });
    const ov = SM().overall(P, list), n = ov.n, top = ov.gov, done = !todo(P).length;
    const verdict = !done && !n.fail && !n.review ? (n.pass ? 'INCOMPLETE' : '—') : ov.verdict;
    const bcls = verdict === 'FAIL' ? 'fail' : verdict === 'PASS' ? 'pass' : verdict === 'REVIEW' ? 'review' : 'none';
    const link = (G, col, c, t) => `<a href="#" data-sumgo="${G.gi}|${col.id}">${t}</a>`;
    const govTxt = top ? `<b>Governing:</b> ${esc(top.c.head)}, girder ${esc(top.G.label)}, ${txt(top.q.loc)}: ${txt(top.q.check)} — ${link(top.G, top.c, top.q, `${top.c.rf ? 'RF ' + fmt(top.q.rf, 2) : 'D/C ' + (isFinite(top.q.r) ? fmt(top.q.r, 3) : 'not a number')}`)}` : 'No check has run yet.';
    const nanTxt = ov.nan.length ? ` <span class="note"><b>Not evaluated</b> (ratio not a number, REVIEW): ${ov.nan.map(z => `${esc(z.c.head)}, ${esc(z.G.label)} ${link(z.G, z.c, z.q, txt(z.q.loc))}`).join('; ')}.</span>` : '';
    const low = ov.low && ov.low !== top ? ` <span class="note">Lowest rating factor: ${esc(ov.low.c.head.replace('Rating, ', ''))} ${link(ov.low.G, ov.low.c, ov.low.q, fmt(ov.low.q.rf, 2))} (${esc(ov.low.G.label)}, ${txt(ov.low.q.loc)}).</span>` : '';
    const AD = window.SBDAutoDesignUI && window.SBDAutoDesignUI.lastWarns ? window.SBDAutoDesignUI.lastWarns(P) : null;
    const cdTxt = (() => { const CD = window.SBDCustomDemands, ks = CD ? ['flex', 'shear', 'cn', 'fat', 'rt', 'spl', 'wt'].filter(k => CD.srcGet(P, k) === 'custom') : [];
      return ks.length ? `Custom (entered) demands where chosen on a tab: ${ks.map(k => esc(CD.SPECS[k].name)).join(', ')}; this project's analysis for the rest.` : "this project's analysis (Analysis tab) for every module."; })();
    let h = `<section class="sec" id="sum-verdict"><div class="secHead">Summary: overall verdict</div><div class="secBody">
      <div class="sum-verd"><span class="sum-badge ${bcls}">${verdict}</span><span class="sum-cnt"><span class="c-fail">${n.fail} FAIL</span><span class="c-review">${n.review} REVIEW</span><span class="c-pass">${n.pass} PASS</span>${n.na ? `<span class="c-na">${n.na} n/a</span>` : ''}${n.notrun ? `<span class="c-na">${n.notrun} not run</span>` : ''}</span></div>
      <p class="sum-gov">${govTxt}${low}${nanTxt}</p>
      <p class="note">Counts: one per girder and column of the table below. FAIL: demand / capacity &gt; 1.0, or a rating factor RF &lt; 1.0. REVIEW: a check whose ratio is not a number, or a module item with a Warning status (welds, cross-frames, deflection over the owner's preferred limit). Demands: ${cdTxt} A hand-off file or the Example demands chosen on a tab for this page view, and the Flexure tab's "6.10.8 only" choice, are not used here (each tab's own run uses them). Every value is the module's own governing value, worked on its tab; each links there. AASHTO LRFD 10th Ed. (2024); MBE for the rating.</p>
      <div class="sum-run">${S.busy ? `<span role="status" aria-live="polite"><span class="spin" aria-hidden="true"></span>${esc(S.prog)}</span>` : `<span role="status" aria-live="polite">${done ? `Up to date${S.secs != null ? ` (last run ${fmt(S.secs, 1)} s)` : ' (shown from the last run of this project state)'}.` : 'Out of date.'}</span>`}
        <button type="button" id="sum_rerun" title="Run every module of every girder again">Re-run all</button>
        <a href="#" id="sum_rpt" title="The Report tab, every girder: the governing ratios of each girder with the work of each girder's report">Report: every girder</a></div></div></section>`;
    // project overview
    const gF = ui => Math.min(Math.max(0, +(ui && ui.g) || 0), P.girders.length - 1), fg = figure(P, list[gF(ctx.ui)]);
    h += `<section class="sec" id="sum-project"><div class="secHead">Project overview</div><div class="secBody">${overview(P, list)}
      ${fg ? `<div class="sum-fig">${fg}</div><p class="note">Girder ${esc(list[gF(ctx.ui)].label)} (the girder selected on the Girders &amp; plates tab): plate segments, supports and the governing check of each group at its location, as the Report's summary figure.</p>` : ''}</div></section>`;
    // per-girder table
    const groups = []; COLS.forEach(c => { const g = groups[groups.length - 1]; if (g && g.grp === c.grp) g.cols.push(c); else groups.push({ grp: c.grp, cols: [c] }); });
    const first = new Set(groups.map(g => g.cols[0].id));
    h += `<section class="sec" id="sum-table"><div class="secHead">Governing D/C of each girder</div><div class="secBody">
      <div class="tscroll"><table class="tbl sum-tbl"><thead><tr><th rowspan="2" class="lft">Girder</th>${groups.map(g => g.cols.length > 1 ? `<th colspan="${g.cols.length}" class="g0">${esc(g.grp)}</th>`
        : `<th rowspan="2" class="g0" title="${esc(g.cols[0].head)}">${esc(g.grp)}${g.cols[0].what ? `<span class="sum-sub">${esc(g.cols[0].what)}</span>` : ''}</th>`).join('')}</tr>
      <tr>${COLS.filter(c => groups.find(g => g.grp === c.grp).cols.length > 1).map(c => `<th class="${first.has(c.id) ? 'g0' : ''}" title="${esc(c.head)}">${esc(c.short)}${c.what ? `<span class="sum-sub">${esc(c.what)}</span>` : ''}</th>`).join('')}</tr></thead>
      <tbody>${list.map(G => `<tr><td class="lft"><b>${esc(G.label)}</b></td>${COLS.map(c => cellHtml(G, c, first.has(c.id))).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="note">Ratio = demand / capacity (OK ≤ 1.0); rating factors RF (OK ≥ 1.0). Each cell opens its output tab with that girder selected, at the location and step that work the value. Flexure: the governing check over every location of the Flexure tab, by limit state (Strength I GS5–GS10; Service II GS12, GS13; proportions GS1–GS4); the largest of the three is the Flexure tab's governing ratio.</p></div></section>`;
    // the governing check of each column, per girder (the GirderDetail Summary's per-check table)
    h += `<section class="sec" id="sum-checks"><div class="secHead">Governing check of each column</div><div class="secBody">${list.map(G => `<details class="sum-g" data-sumg="${G.gi}"${S.open.has(G.gi) || list.length === 1 ? ' open' : ''}><summary><b>${esc(G.label)}</b></summary>
      <div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Column</th><th class="lft">Check</th><th class="lft">Location</th><th>Ratio / RF</th><th>Status</th></tr></thead><tbody>
      ${COLS.map(c => { const q = G.cells[c.id] || { st: 'notrun' }; return `<tr><td class="lft">${esc(c.head)}</td><td class="lft">${q.check ? txt(q.check) : esc(q.why || (q.st === 'notrun' ? 'Not run yet.' : ''))}</td><td class="lft">${q.loc ? txt(q.loc) : ''}</td><td class="s-${q.st}">${link(G, c, q, vTxt(q, c))}</td><td>${LBL[q.st]}</td></tr>`; }).join('')}
      </tbody></table></div></details>`).join('')}</div></section>`;
    // not run / not applicable, warnings
    const nr = []; list.forEach(G => COLS.forEach(c => { const q = G.cells[c.id]; if (q && q.st === 'na') nr.push(`<li>${esc(c.head)}, ${esc(G.label)}: ${txt(q.why || 'not applicable')}</li>`); }));
    const nrun = list.flatMap(G => COLS.filter(c => !G.cells[c.id] || G.cells[c.id].st === 'notrun').map(c => c.head + ', ' + G.label));
    const warns = []; list.forEach(G => (G.warn || []).forEach(w => warns.push(`${esc(G.label)}: ${txt(w)}`)));
    if (AD && AD.list.length) warns.push(`Auto design (last run of this page view, not applied${AD.stale ? '; the project changed since' : ''}): ${AD.list.slice(0, 5).map(q => `candidate ${q.i + 1} <b>WARNING</b> ${q.warns.map(w => `${esc(w.label)} ${fmt(w.r, 3)}`).join('; ')}`).join(' · ')}${AD.list.length > 5 ? ' …' : ''} (<a href="#" data-sumtab="ad">Auto design tab</a>).`);
    const lf = window.SBDOwners.loadFactors(P.ownerRules.owner, P.ownerRules.eta, (P.xs || {}).nb), on = [];
    if (lf.o && lf.o !== 'AASHTO') on.push(`Owner load rules ${esc(lf.o)}: η = ${fmt(lf.eta, 3)} on the maximum Strength factors (η<sub>D</sub> ${fmt(lf.eD, 2)}, η<sub>R</sub> ${fmt(lf.eR, 2)}, η<sub>I</sub> ${fmt(lf.eI, 2)}), m = ${fmt(lf.m, 2)} on HL-93 LL+IM${lf.cite.m ? ` (${esc(lf.cite.m)})` : ''}.`);
    else if (lf.eta !== 1) on.push(`Load modifier η = ${fmt(lf.eta, 3)} (η<sub>D</sub> ${fmt(lf.eD, 2)}, η<sub>R</sub> ${fmt(lf.eR, 2)}, η<sub>I</sub> ${fmt(lf.eI, 2)}; AASHTO 1.3.2).`);
    if (lf.h0) on.push(`Haunch taken as 0 in the composite section properties (${esc(lf.cite.h)}); its weight stays in DC1.`);
    h += `<section class="sec" id="sum-notes"><div class="secHead">Checks not run / not applicable, warnings</div><div class="secBody">
      ${nrun.length ? `<p><b>Not run yet:</b> ${esc(nrun.slice(0, 12).join('; '))}${nrun.length > 12 ? ` and ${nrun.length - 12} more` : ''}.</p>` : ''}
      <p><b>Not applicable or not calculated</b>${nr.length ? '' : ': none.'}</p>${nr.length ? `<ul class="sum-list">${nr.join('')}</ul>` : ''}
      <p class="note">Not in the Summary: Auto design (run from its input tab), the Drawings and the 3D view (no checks), Section properties and Loads &amp; LLDF (inputs to the checks: worked on their tabs).</p>
      <p><b>Warnings</b>${warns.length ? '' : ': none.'}</p>${warns.length ? `<ul class="sum-list">${warns.map(w => `<li>${w}</li>`).join('')}</ul>` : ''}
      <p><b>Owner rules</b>${on.length ? '' : ': AASHTO, no owner modifier.'}</p>${on.length ? `<ul class="sum-list">${on.map(w => `<li>${w} <a href="#" data-sumtab="loads">Loads &amp; LLDF tab</a></li>`).join('')}</ul>` : ''}
    </div></section>`;
    host.innerHTML = h;
  }

  function render(host, ctx) {
    css(); S.host = host; S.ctx = ctx;
    const P = ctx.P; sync(P);
    if (!host.__sum) { host.__sum = true;   // handlers on the host (bound once; the host is the page's #out)
      host.addEventListener('click', e => {
        if (!S.ctx || !S.ctx.open()) return;
        const a = e.target.closest('[data-sumgo]'); if (a) { e.preventDefault(); const [gi, id] = a.dataset.sumgo.split('|'); gotoCell(+gi, id); return; }
        const w = e.target.closest('[data-sumwk]'); if (w) { e.preventDefault(); S.ctx.goto('an', +w.dataset.sumwk); focus({ step: 'an.eq.DC1steel' }); return; }
        const t = e.target.closest('[data-sumtab]'); if (t) { e.preventDefault(); S.ctx.goto(t.dataset.sumtab, Math.min(+(S.ctx.ui.g || 0), S.ctx.P.girders.length - 1)); return; }
        if (e.target.id === 'sum_rerun') { start(S.ctx.P, { all: true }); return; }
        if (e.target.id === 'sum_rpt') { e.preventDefault(); if (S.ctx.report) S.ctx.report(); return; }
      });
      host.addEventListener('toggle', e => { const d = e.target.closest && e.target.closest('[data-sumg]'); if (d) { if (d.open) S.open.add(+d.dataset.sumg); else S.open.delete(+d.dataset.sumg); } }, true);
    }
    paint(host, ctx);
    if (!S.busy && todo(P).length) start(P, { delay: ctx.now ? 0 : AUTO_MS });
  }

  window.SBDSummaryUI = { render, state, start, subscribe, focus, gotoCell, txt, rowSel, sync };
})();
