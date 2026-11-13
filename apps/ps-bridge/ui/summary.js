/* apps/ps-bridge/ui/summary.js — the Summary output tab (window.PSBSummaryUI), first in the output tab bar. Classic script; no DOM at load.
   Created 2026-11-13 (PR 3b, docs/ps-bridge-plan.md §5 row 3b: "Summary tab and check-summary chips (girder × span grid), run all (chunked,
   Stop)"). ADAPTED COPY, to move to shared/ later (CLAUDE.md §3): the layout, CSS and wording of apps/steel-bridge/ui/summary.js at 9a45008
   (window.SBDSummaryUI: the overall verdict with its PASS / FAIL counts and the governing check as a link, the "Up to date" / running line
   with "Re-run all", the project overview with the girder weight, the governing-ratio table with a row per girder type and a row per line,
   the governing check of each column per type, the checks not run and the warnings; SB-2 PR 2 #1454, SB-5, SB-6). Written for this app:
   the rows are the PS girder types of each span (PS-8) and the columns the check groups of the check summary column (ui/dash.js GROUPS).

   The tab shows, over every girder type on every line (engine/bridge.js results(): each cell = PSBHoldDown.compute of that type's inputs on
   that line, i.e. computeAll + the PS-10 check):
     1. the verdict: PASS / FAIL, counted one per girder type per check (its worst line, SB-5; the same counts as the check summary column),
        the governing check named with its type and line, the lowest HL-93 inventory rating factor; the run state ("Up to date" / running
        k of n with Stop / stopped with Run all) and Re-run all;
     2. the project overview (entered values) and the girder weight per line, per type and the bridge total (SB-6);
     3. the girder × span grid: a row per girder line, a column per span; each cell the girder type on it, its governing ratio (the largest
        of its checks), the check group and PASS / FAIL; a line with no type "not checked";
     4. the governing ratio of each check group per girder type (its worst line named, SB-5), a row per line under it, the lowest rating
        factor and the weight; each value PASS / FAIL;
     5. per girder type, the governing check of each group: check, line, x, demand, limit, ratio, status;
     6. the girder type and line shown on the output tabs (its key values, as before);
     7. the lines not checked, the groups switched off, the engine's design warnings and errors.
   Every number is a value of an engine result (R.checks[i].r / v / lim / loc, R.rating…) or a weight of engine/bridge.js results (W per
   line, its sums per type and bridge); nothing is calculated here but the choice of the largest (or, for RF, the smallest). Each number
   carries data-sv="<k>|<g>|<R path>" (data-sw for a weight) so tests/engine/psbridge-summary.test.mjs checks it against the engine.
   Each value links (data-sumgo="<k>|<g>|<tab>|<step>|<1: input tab>") to its tab with that type and line, at the worked step (§6); the
   page (index.html) handles the links and the run buttons (data-sumrun).

   html(o): o = { P, A (PSBBridge.results or null while running), run ({ busy, i, n, stopped, ms, label } or null), shown (the design card
   HTML of the page), fx }. Also: model(P, A) (the values, for the tests and the Report), css(). */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fx = (v, d) => typeof v === 'number' && isFinite(v) ? v.toFixed(d) : v === Infinity ? '∞' : v === -Infinity ? '−∞' : typeof v === 'number' ? 'NaN' : '—';
  const DU = () => window.PSBDashUI, BRG = () => window.PSBBridge;
  const at = (R, p) => String(p).split('.').reduce((o, k) => o == null ? o : o[k], R);
  const bad = x => typeof x !== 'number' || isNaN(x);
  /* worse(a, b): ratio a governs over b (a ratio that is not a number first, then the larger; ties keep b: the first line, as engine/bridge.js gov) */
  const worse = (a, b) => (bad(a) && !bad(b)) || (!bad(a) && !bad(b) && a > b);
  /* the check group of a check name (ui/dash.js GROUPS) and its step */
  function where(n) { for (const gp of DU().GROUPS) for (const [cn, st] of gp.checks) if (cn === n) return { gp, st }; return null; }
  /* the lowest HL-93 inventory rating factor of a cell (ui/dash.js RATING; 99 = not applicable, left out) */
  function rfOf(R) {
    const RT = DU().RATING; if (!R || R.error || !R.rating) return null;
    return RT.rf.map(([n, f, st], j) => ({ n, v: f(R), st, path: ['rating.RFinv', 'shrRating.RFinv', 'svcRating.RF'][j] })).filter(z => typeof z.v === 'number' && z.v < 99).reduce((b, z) => !b || z.v < b.v ? z : b, null);
  }

  /* model(P, A): the Summary's values (no arithmetic: choices among engine values). A = PSBBridge.results(P, …). */
  function model(P, A) {
    const GR = DU().GROUPS, nb = P.xs.nb, ns = P.spans.lengths.length;
    const used = GR.filter(gp => A.cells.some(c => c.R && c.R.checks && c.R.checks.some(q => gp.checks.some(([n]) => n === q.n))));
    const gpIds = new Set(used.map(gp => gp.id));
    /* a cell's governing check: of all its checks in a group (every engine check is in one), and of each group */
    function cellOf(c) {
      const out = { c, gov: null, groups: {}, nF: 0, nP: 0, rf: rfOf(c.R), err: c.R && c.R.error ? c.R.error : '' };
      if (!c.R || c.R.error || !c.R.checks) return out;
      c.R.checks.forEach((q, i) => { const w = where(q.n); if (!w || !gpIds.has(w.gp.id)) return;
        const z = { q, i, gp: w.gp, st: w.st, k: c.k, g: c.g };
        if (q.pass) out.nP++; else out.nF++;
        if (!out.gov || worse(q.r, out.gov.q.r)) out.gov = z;
        const G = out.groups[w.gp.id]; if (!G || worse(q.r, G.q.r)) out.groups[w.gp.id] = z; });
      return out;
    }
    const cells = A.cells.map(cellOf);
    const types = A.types.map(t => {
      const tc = cells.filter(z => z.c.k === t.k), groups = {};
      // each group: the worst over the type's per-check worst lines (t.gov, engine/bridge.js: one per check, SB-5)
      Object.values(t.gov).forEach(v => { const w = where(v.c.n); if (!w || !gpIds.has(w.gp.id)) return;
        const z = { q: v.c, i: v.cell.R.checks.indexOf(v.c), gp: w.gp, st: w.st, k: t.k, g: v.g }, G = groups[w.gp.id];
        if (!G || worse(z.q.r, G.q.r)) groups[w.gp.id] = z; });
      const checks = Object.values(t.gov).filter(v => { const w = where(v.c.n); return w && gpIds.has(w.gp.id); });
      const rf = tc.map(z => z.rf && Object.assign({ g: z.c.g }, z.rf)).filter(Boolean).reduce((b, z) => !b || z.v < b.v ? z : b, null);
      return { t, k: t.k, label: t.label, span: t.span, lines: tc, groups, rf, W: t.W, nF: checks.filter(v => !v.c.pass).length, nP: checks.filter(v => v.c.pass).length,
        err: tc.filter(z => z.err) };
    });
    const grid = Array.from({ length: nb }, (_, i) => Array.from({ length: ns }, (_, j) => cells.find(z => z.c.g === i + 1 && z.c.s === j + 1) || null));
    // the verdict: the check summary column's counts (ui/dash.js grp: one entry per type per check, its worst line)
    const G = DU().GROUPS.map(gp => Object.assign({ gp }, DU().grp(null, gp, A)));
    const run = G.filter(q => q.st === 'pass' || q.st === 'fail');
    const nF = run.reduce((a, q) => a + q.all.filter(z => !z.c.pass).length, 0), nP = run.reduce((a, q) => a + q.all.filter(z => z.c.pass).length, 0);
    const off = G.filter(q => q.st === 'na' && q.gp.off).map(q => q.gp);
    let top = null; run.forEach(q => q.all.forEach(z => { if (!top || worse(z.c.r, top.c.r)) top = Object.assign({ gp: q.gp }, z); }));
    const low = types.map(T => T.rf && Object.assign({ k: T.k }, T.rf)).filter(Boolean).reduce((b, z) => !b || z.v < b.v ? z : b, null);
    return { used, cells, types, grid, nF, nP, off, top, low, W: A.W, n: A.n, nb, ns };
  }

  /* ---------- HTML ---------- */
  function css() {
    if (typeof document === 'undefined' || document.getElementById('psbsum-css')) return;
    const st = document.createElement('style'); st.id = 'psbsum-css';
    // copied from apps/steel-bridge/ui/summary.js css() (the sum-* classes), plus the grid cells
    st.textContent = `
.sum-verd{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;font-family:var(--font-ui)}
.sum-badge{font-weight:700;font-size:13pt;padding:3px 12px;border-radius:5px;border:2px solid;letter-spacing:.04em}
.sum-badge.fail{color:#991B1B;background:#FEF2F2;border-color:var(--fail)} .sum-badge.pass{color:#065F46;background:#ECFDF5;border-color:var(--pass)} .sum-badge.none{color:#475569;background:var(--slate-100);border-color:var(--slate-400)}
.sum-cnt{display:inline-flex;gap:5px;flex-wrap:wrap} .sum-cnt span{font-size:8.5pt;font-weight:700;padding:1px 6px;border:1px solid;border-radius:3px;white-space:nowrap}
.sum-cnt .c-fail{color:#991B1B;background:#FEF2F2;border-color:var(--fail)} .sum-cnt .c-pass{color:#065F46;background:#ECFDF5;border-color:var(--pass)} .sum-cnt .c-na{color:#475569;background:var(--slate-100);border-color:var(--slate-400)}
.sum-gov{margin:8px 0 2px;font-size:10pt} .sum-gov .sum-low{display:block;margin-top:3px} .sum-run{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:8px;font-family:var(--font-ui);font-size:9pt;color:#475569}
.sum-run .spin{display:inline-block;width:12px;height:12px;border:2px solid #CBD5E1;border-top-color:var(--color-primary);border-radius:50%;animation:sbspin .8s linear infinite;vertical-align:-2px;margin-right:6px}
@media (prefers-reduced-motion:reduce){.sum-run .spin{animation:none}}
table.sum-tbl{width:auto;min-width:100%} table.sum-tbl th{font-family:var(--font-ui);font-size:8pt;font-weight:600;line-height:1.15;vertical-align:bottom} table.sum-tbl td{font-family:var(--font-ui);font-size:9pt;white-space:nowrap}
table.sum-tbl td.s-pass{background:#ECFDF5} table.sum-tbl td.s-fail{background:#FEE2E2;font-weight:700} table.sum-tbl td.s-na{color:#64748b;background:#F8FAFC}
table.sum-tbl td a{color:inherit;text-decoration:underline dotted;text-underline-offset:2px} table.sum-tbl td a:hover{text-decoration:underline}
table.sum-tbl td.s-pass a{color:#065F46} table.sum-tbl td.s-fail a{color:#991B1B}
table.sum-tbl tr.sum-line td{font-size:8pt} table.sum-tbl tr.sum-line td.lft{color:#475569} table.sum-tbl tr.sum-span td{background:#f1efe9;font-weight:600;text-align:left}
.sum-sub{font-size:7.5pt;color:#475569;font-weight:400;display:block}
table.sum-grid td{min-width:92px} table.sum-grid td .sum-ty{display:block;font-size:7.5pt;color:#475569;font-weight:400}
.sum-list{margin:4px 0;padding-left:18px;font-size:9.5pt} .sum-list li{margin:2px 0}
details.sum-g>summary{cursor:pointer;font-family:var(--font-ui);font-size:9.5pt;padding:3px 0}
@media print{.sum-run button{display:none}}`;
    document.head.appendChild(st);
  }
  const box = (id, title, body, ref) => `<section class="sec" id="${id}"><div class="secHead">${title}${ref ? ` <span class="secRef">${esc(ref)}</span>` : ''}</div><div class="secBody">${body}</div></section>`;
  /* the link of a value: its tab with that type and line, at the step (a group on an input tab: the input tab and its row) */
  const go = z => `data-sumgo="${z.k}|${z.g}|${z.gp.tab}|${esc(z.st)}|${z.gp.input ? 1 : ''}"`;
  const sv = (k, g, path, v, d) => `<span data-sv="${k}|${g}|${esc(path)}">${fx(v, d)}</span>`;
  const rv = z => sv(z.k, z.g, `checks.${z.i}.r`, z.q.r, 3);
  const tip = z => esc(`${z.q.n} on G${z.g}: ${fx(z.q.v, 3)} vs ${fx(z.q.lim, 3)} ${z.q.u || ''}${z.gp.input ? ' (Owner rules tab)' : ` at x = ${fx(z.q.loc, 2)} ft`}`);
  const LBL = q => q ? 'PASS' : 'FAIL';

  function verdict(M, o) {
    const run = o.run || {}, A = o.A, cls = !A ? 'none' : M.nF ? 'fail' : 'pass', badge = !A ? (run.busy ? 'RUNNING' : '—') : M.nF ? 'FAIL' : 'PASS';
    const top = A && M.top, lowC = A && M.low;
    const gov = top ? `<b>Governing:</b> ${esc(top.gp.name)}, girder type ${esc(top.cell.label)} on G${top.cell.g} (span ${top.cell.s}): ${esc(top.c.n)} — <a href="#" ${go({ k: top.cell.k, g: top.cell.g, gp: top.gp, st: top.st })}>ratio ${sv(top.cell.k, top.cell.g, `checks.${top.cell.R.checks.indexOf(top.c)}.r`, top.c.r, 3)}</a>` : A ? 'No check.' : '';
    const low = lowC ? `<span class="sum-low"><b>Lowest HL-93 inventory rating factor:</b> ${esc(lowC.n)} RF <a href="#" data-sumgo="${lowC.k}|${lowC.g}|rt|${lowC.st}|">${sv(lowC.k, lowC.g, lowC.path, lowC.v, 3)}</a> (${esc(M.types.find(T => T.k === lowC.k).label)} on G${lowC.g}; not a check, not counted).</span>` : '';
    const state = run.busy ? `<span role="status" aria-live="polite" id="sumRunMsg"><span class="spin" aria-hidden="true"></span>${esc(run.label || `Running every girder type × line (${run.i} / ${run.n})…`)}</span><button type="button" data-sumrun="stop" title="Stop the run (the results computed so far are kept for the next run)">Stop</button>`
      : run.stopped ? `<span role="status" aria-live="polite" id="sumRunMsg">Stopped: ${run.i} of ${run.n} girder type × line results computed. The verdict and tables below need all of them.</span><button type="button" data-sumrun="run" title="Run the girder types × lines not yet computed">Run all</button>`
      : A ? `<span role="status" aria-live="polite" id="sumRunMsg">Up to date: ${A.n} girder type × line result${A.n === 1 ? '' : 's'} of this project state${run.ms != null ? ` (computed in ${(run.ms / 1000).toFixed(2)} s)` : ''}.</span>` : '<span role="status" aria-live="polite" id="sumRunMsg">Not run.</span>';
    const un = BRG().unassigned(o.P);
    return box('sum-verdict', 'Summary: overall verdict', `<div class="sum-verd"><span class="sum-badge ${cls}">${badge}</span>${A ? `<span class="sum-cnt"><span class="c-fail">${M.nF} FAIL</span><span class="c-pass">${M.nP} PASS</span>${M.off.length ? `<span class="c-na">${M.off.length} off</span>` : ''}</span>` : ''}</div>
      ${A ? `<p class="sum-gov">${gov}${low}</p>` : ''}
      ${un.length ? `<div class="alert err" id="sum-unassigned"><b>Line${un.length > 1 ? 's' : ''} ${un.map(q => `G${q.g}/S${q.s}`).join(', ')} ${un.length > 1 ? 'have' : 'has'} no girder type</b> and ${un.length > 1 ? 'are' : 'is'} not checked: the verdict covers the lines of the girder types only. Assign a type on the <a href="#" data-goin="gird">Girders &amp; strands</a> input tab.</div>` : ''}
      <p class="note">Counts: one per girder type and check, its worst line (SB-5), the same as the check summary column. FAIL: a check whose ratio (demand / limit, the engine's) is over 1.0 (PASS when ≤ 1.0001, the engine's rule). Rating factors are not checks (RF ≥ 1.0 OK) and are not counted. ${M && M.off.length ? `Off for this project (no check): ${M.off.map(g => esc(g.name)).join(', ')}.` : ''}</p>
      <div class="sum-run">${state}<button type="button" data-sumrun="rerun" title="Compute every girder type on every line again">Re-run all</button><a href="#" data-gotab="rpt" title="The Report tab: §1 lists every girder type and line with these values">Report</a></div>`);
  }
  function overview(M, o) {
    const P = o.P, A = o.A, BR = BRG(), off = window.PSBModel.girderOffsets(P);
    const kv = (k, v) => `<div><span>${k}</span><span>${v}</span></div>`;
    const wt = A ? M.types.map(T => `${esc(T.label)} <span data-sw="${T.k}|">${fx(T.W, 1)}</span> kip${T.lines.length > 1 ? ` (${T.lines.length} lines: ${T.lines.map(z => `G${z.c.g} <span data-sw="${T.k}|${z.c.g}">${fx(z.c.W, 1)}</span>`).join(', ')})` : ` (G${T.lines[0].c.g})`}`).join('; ') : '';
    const st = A && A.cells.find(c => c.R && c.R.checks && c.R.checks.some(q => /^Hold-down force/.test(q.n)));
    return box('sum-project', 'Project overview', `<div class="kv">${kv('Project', esc(P.project.name))}${kv('Spans', `${P.spans.lengths.map(x => fx(+x, 1)).join(' – ')} ft`)}
      ${kv('Continuity', P.spans.continuity === 'composite' ? 'made continuous for composite loads' : 'simple spans')}${kv('Girders', esc(P.xs.nb))}
      ${kv('Bays', `${P.xs.bays.map(x => fx(+x, 2)).join(', ')} ft`)}${kv('Girder lines from the left deck edge', `${off.map(x => fx(x, 2)).join(', ')} ft`)}
      ${BR.hasTypes(P) ? P.types.map((t, k) => kv(`Girder type ${esc(t.label)} (span ${t.span})`, BR.typeLines(P, k).map(g => 'G' + g).join(', ') || 'no line')).join('') : ''}</div>
      ${A ? `<p><b>Girder weight</b> (w<sub>sw</sub> (L + 2 e<sub>end</sub>/12) per line, SB-6): ${wt}; <b>bridge total <span data-sw="|">${fx(A.W, 1)}</span> kip</b> (${A.n} girder line${A.n === 1 ? '' : 's'} checked) <a href="#" class="wk" ${st ? `data-sumgo="${st.k}|${st.g}|end|ez.hd.W|"` : 'data-gotab="end"'} title="Worked: the beam weight W of the hold-down check (End zone &amp; hold-down tab)">§</a>.</p>` : ''}
      <p class="note">Entered values (Project, Bridge layout, Cross-section and Girders &amp; strands tabs). Weight: the girder's own weight on each line, the weight W of the hold-down check (End zone &amp; hold-down tab, worked where the design has draped strands); a type's weight the sum over its lines, the bridge total the sum over every checked line (lines with no type not counted).</p>`);
  }
  function grid(M, o) {
    const P = o.P, rows = M.grid.map((row, i) => `<tr><td class="lft"><b>G${i + 1}</b><span class="sum-sub">${i === 0 || i === M.nb - 1 ? 'exterior' : 'interior'}</span></td>${row.map((z, j) => {
      if (!z) return `<td class="s-na" title="No girder type: not checked"><span class="sum-ty">no type</span>not checked</td>`;
      const lab = esc(z.c.label);
      if (z.err) return `<td class="s-fail" title="${esc(z.err)}"><span class="sum-ty">${lab}</span>engine error</td>`;
      if (!z.gov) return `<td class="s-na"><span class="sum-ty">${lab}</span>no check</td>`;
      const f = z.nF > 0;
      return `<td class="s-${f ? 'fail' : 'pass'}" title="${tip(z.gov)}"><span class="sum-ty">${lab}</span><a href="#" ${go(z.gov)}>${rv(z.gov)}</a><span class="sum-sub">${esc(z.gov.gp.name)} · ${f ? `FAIL (${z.nF})` : 'PASS'}</span></td>`; }).join('')}</tr>`).join('');
    return box('sum-grid', 'Girder × span grid', `<div class="tscroll"><table class="tbl sum-tbl sum-grid"><thead><tr><th class="lft">Line</th>${P.spans.lengths.map((L, j) => `<th>Span ${j + 1}<span class="sum-sub">L = ${fx(+L, 2)} ft</span></th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
      <p class="note">Each cell: the girder type on that line of that span, its governing ratio (the largest of all its checks, demand / limit, the engine's), the check group, and PASS or FAIL (with the number of its checks over 1.0). Click: the tab of that check with that girder type and line, at the worked step.</p>`, 'every line of every span');
  }
  function table(M) {
    const cellT = (z, sub) => z ? `<td class="s-${z.q.pass ? 'pass' : 'fail'}" title="${tip(z)}"><a href="#" ${go(z)}>${rv(z)}</a><span class="sum-sub">${LBL(z.q.pass)}${sub ? ` · G${z.g}` : ''}</span></td>` : '<td class="s-na">—</td>';
    const rfT = (z, k, sub) => z ? `<td class="s-${z.v >= 1 ? 'pass' : 'fail'}" title="${esc(z.n)} on G${z.g}"><a href="#" data-sumgo="${k}|${z.g}|rt|${z.st}|">${sv(k, z.g, z.path, z.v, 3)}</a><span class="sum-sub">${z.v >= 1 ? 'RF ≥ 1' : 'RF < 1'}${sub ? ` · G${z.g}` : ''}</span></td>` : '<td class="s-na">—</td>';
    let body = '';
    for (let s = 1; s <= M.ns; s++) {
      const Ts = M.types.filter(T => T.span === s); if (!Ts.length) continue;
      body += `<tr class="sum-span"><td colspan="${M.used.length + 3}">Span ${s}</td></tr>`;
      Ts.forEach(T => {
        const many = T.lines.length > 1;
        body += `<tr><td class="lft"><b>${esc(T.label)}</b><span class="sum-sub">${many ? `worst of ${T.lines.map(z => 'G' + z.c.g).join(', ')}` : `on G${T.lines[0].c.g}`} · ${T.nF ? `FAIL (${T.nF})` : 'PASS'}</span></td>${M.used.map(gp => cellT(T.groups[gp.id], many)).join('')}${rfT(T.rf, T.k, many)}<td><span data-sw="${T.k}|">${fx(T.W, 1)}</span></td></tr>`;
        if (many) T.lines.forEach(z => { body += `<tr class="sum-line"><td class="lft">&nbsp;&nbsp;on line G${z.c.g}${z.err ? ' (engine error)' : ''}</td>${M.used.map(gp => cellT(z.groups[gp.id], false)).join('')}${rfT(z.rf && Object.assign({ g: z.c.g }, z.rf), T.k, false)}<td><span data-sw="${T.k}|${z.c.g}">${fx(z.c.W, 1)}</span></td></tr>`; });
      });
    }
    return box('sum-table', 'Governing ratio of each check group, per girder type', `<div class="tscroll"><table class="tbl sum-tbl"><thead><tr><th class="lft">Girder type / line</th>${M.used.map(gp => `<th>${esc(gp.name)}</th>`).join('')}<th>Rating (RF)</th><th>Weight (kip)</th></tr></thead><tbody>${body}</tbody>
      <tfoot><tr><td class="lft"><b>Bridge total (${M.n} girder line${M.n === 1 ? '' : 's'})</b></td>${M.used.map(() => '<td></td>').join('')}<td></td><td><b><span data-sw="|">${fx(M.W, 1)}</span></b></td></tr></tfoot></table></div>
      <p class="note">Each ratio: the largest of the group's checks (demand / limit, OK ≤ 1.0, the engine's); the girder type's row its worst line (named under the value, SB-5), then a row per line. Rating: the lowest HL-93 inventory rating factor (flexure, shear, Service III; not a check). Click: the tab of the group with that type and line, at the worked step of the value. Weight: per line, the type's the sum over its lines, the bridge total the sum over every checked line (SB-6).</p>`, 'every type on every line; the worst line governs');
  }
  function checks(M) {
    const one = T => { const rows = M.used.map(gp => { const z = T.groups[gp.id]; if (!z) return '';
      return `<tr><td class="lft">${esc(gp.name)}</td><td class="lft">${esc(z.q.n)}</td><td>G${z.g}</td><td>${z.gp.input ? '—' : sv(z.k, z.g, `checks.${z.i}.loc`, z.q.loc, 2)}</td><td>${sv(z.k, z.g, `checks.${z.i}.v`, z.q.v, 3)}</td><td>${sv(z.k, z.g, `checks.${z.i}.lim`, z.q.lim, 3)}</td><td>${esc(z.q.u || '')}</td>
        <td class="s-${z.q.pass ? 'pass' : 'fail'}"><a href="#" ${go(z)}>${rv(z)}</a></td><td>${LBL(z.q.pass)}</td></tr>`; }).join('');
      return `<details class="sum-g" data-sumg="${T.k}"${M.types.length === 1 ? ' open' : ''}><summary><b>${esc(T.label)}</b> (span ${T.span}${T.lines.length > 1 ? `, worst of ${T.lines.map(z => 'G' + z.c.g).join(', ')}` : `, G${T.lines[0].c.g}`}) — ${T.nF ? `FAIL (${T.nF})` : 'PASS'}</summary>
        <div class="tscroll"><table class="tbl sum-tbl"><thead><tr><th class="lft">Group</th><th class="lft">Governing check</th><th>Line</th><th>x (ft)</th><th>Demand</th><th>Limit</th><th>Unit</th><th>Ratio</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div></details>`; };
    return box('sum-checks', 'Governing check of each group, per girder type', M.types.map(one).join('') + '<p class="note">The check with the largest ratio in each group over the type\'s lines, at its governing station x (the owner\'s limits: on the Owner rules tab). Click a ratio: its tab and worked step with that type and line.</p>');
  }
  function notes(M, o) {
    const P = o.P, un = BRG().unassigned(P), warn = new Map(), errs = [];
    M.types.forEach(T => T.lines.forEach(z => { if (z.err) errs.push(`${esc(T.label)} on G${z.c.g}: ${esc(z.err)}`);
      ((z.c.R && z.c.R.warns) || []).forEach(w => { const key = T.label + '\u0000' + w, e = warn.get(key) || { T, w, g: [] }; e.g.push(z.c.g); warn.set(key, e); }); }));
    const ws = [...warn.values()].map(e => `<li>${esc(e.T.label)} (${e.g.map(g => 'G' + g).join(', ')}): ${esc(e.w)}</li>`);
    return box('sum-notes', 'Lines not checked, groups off, warnings', `<p><b>Lines not checked</b> (no girder type)${un.length ? `: ${un.map(q => `G${q.g}/S${q.s}`).join(', ')} (<a href="#" data-goin="gird">Girder types</a>).` : ': none.'}</p>
      <p><b>Off for this project</b>${M.off.length ? `: ${M.off.map(g => `${esc(g.name)} (<a href="#" data-goin="${g.off}">turn it on</a>)`).join(', ')}.` : ': none.'}</p>
      ${errs.length ? `<p><b>Engine errors</b> (no result for these lines):</p><ul class="sum-list">${errs.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}
      <p><b>Design warnings of the engine</b>${ws.length ? '' : ': none.'}</p>${ws.length ? `<ul class="sum-list">${ws.join('')}</ul>` : ''}
      <p class="note">Not in the Summary: Section properties, Loads &amp; LLDF, Analysis and Losses (inputs to the checks: worked on their tabs), the Drawings, Auto design and 3D view (later PRs).</p>`);
  }
  function html(o) {
    css();
    const A = o.A, M = A ? model(o.P, A) : null;
    let h = verdict(M, o) + overview(M, o);
    if (A) h += grid(M, o) + table(M) + checks(M);
    else h += box('sum-wait', 'Girder × span grid', `<p class="note">${o.run && o.run.busy ? 'Computing every girder type on every line…' : o.run && o.run.stopped ? 'Stopped: Run all (above) to compute the rest.' : 'No girder type results.'}</p>`);
    h += o.shown || '';
    if (A) h += notes(M, o);
    return h;
  }
  window.PSBSummaryUI = { html, model, css, worse, where };
})();
