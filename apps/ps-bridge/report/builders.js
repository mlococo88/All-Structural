/* apps/ps-bridge/report/builders.js — the calculation report model of PS Bridge (window.PSBReportBuild). Classic script, no DOM.
   Created 2026-11-13 (PR 2e, docs/ps-bridge-plan.md §5). ADAPTED COPY, to move to shared/ later (CLAUDE.md §3): the structure of
   apps/steel-bridge/report/builders.js at e02c618 (window.SBDReportBuild): SECTIONS in the workflow order with the summary first, the item
   helpers (steps, note, tbl, kv, sub), the worked steps in the tab's topics (gsteps), model(B, opt) with opt.include (a section left out
   keeps no link: a reference into it says "(section not included)"), the title block, running header and footer. The section bodies are
   this app's: each result tab's own cards (report/fromtab.js: the HTML of the tab's output(), the values as the tab shows them) and the
   tab's own worked steps (engine/worked*.js, B.W, the same objects as on the tab), so the Report shows the tabs' numbers and steps.
   Nothing is calculated here: every number is a value of R = PSBHoldDown.compute(inputs) (computeAll + the PS-10 check), as on the tabs.

   model(B, opt) -> report model (shared/report.js); B = report/data.js bundle { P, inp, R, W, sel }; opt.include = { key: false } leaves a
   section out; opt.figures = { <tab key>: { <slot id>: [{ type: 'figure', svg, caption }] } } (ui/report.js, the tabs' own graphics drawn by
   their own code; 2026-11-13) puts each tab's graphics at their places in its section, numbered "Figure n.m". Every number written by this file goes through V(), which records { sec, path, d, div, text } in model.vals with the
   numbers the tabs record (report/fromtab.js); tests/psbridge-compare.mjs compares each with the old app's value, tests/engine/
   psbridge-report.test.mjs with R. Step anchors: scope '' (the step ids of the tabs are unique across the app: sec., ld., an., ls., st., fx.,
   sh., ez., cb., hn., dk., rt.), key = the step id, so a step note "§<id>" of one tab finds its step in another; section keys 'rs.<tab>'. */
(function () {
  'use strict';
  const SECTIONS = [['sum', 'Summary of checks'], ['proj', 'Project, basis and assumptions'], ['sec', 'Section properties'], ['lds', 'Loads & LLDF'], ['an', 'Analysis'],
    ['loss', 'Prestress losses'], ['str', 'Stresses'], ['flex', 'Flexure'], ['shear', 'Shear'], ['end', 'End zone & hold-down'], ['camb', 'Camber & deflection'],
    ['hand', 'Handling'], ['deck', 'Deck'], ['rt', 'Rating']];
  /* each result tab: its UI module (ui/*.js output(ctx), TOPICS) and its worked steps in B.W */
  const TABS = { sec: ['PSBUiSection', 'section'], lds: ['PSBUiLoads', 'loads'], an: ['PSBUiAnalysis', 'analysis'], loss: ['PSBUiLosses', 'losses'], str: ['PSBUiStresses', 'stresses'],
    flex: ['PSBUiFlexure', 'flexure'], shear: ['PSBUiShear', 'shear'], end: ['PSBUiEndZone', 'endzone'], camb: ['PSBUiCamber', 'camber'], hand: ['PSBUiHandling', 'handling'],
    deck: ['PSBUiDeck', 'deck'], rt: ['PSBUiRating', 'rating'] };
  const ED = 'AASHTO LRFD 10th Ed. (2024)';
  const K = (scope, id) => (scope ? scope + '/' + id : String(id));
  const S = () => window.SharedSteps, OK = () => window.PSBOutKit;
  const note = (text, warn) => ({ type: 'note', text, warn: !!warn });
  const tbl = (head, rows, o) => ({ type: 'table', head, rows, ...(o || {}) });
  const kv = rows => ({ type: 'kv', rows });
  const sub = (id, title, items) => ({ id, title, items: items.filter(Boolean) });
  const steps = (scope, list, o) => ({ type: 'steps', scope, steps: list || [], ...(o || {}) });
  /* gsteps: the worked steps in the tab's topics (its TOPICS, SharedSteps.group as on the tab), a sub-heading per topic (shared/report.js item.topics) */
  const gsteps = (scope, list, topics) => { const G = S().group(list || [], topics || [], { strip: false });
    return steps(scope, [].concat(...G.map(t => t.steps)), { topics: G.map(t => ({ title: t.title, ref: t.ref, n: t.steps.length, cls: t.cls, chip: t.chip, res: t.res })) }); };
  const at = (R, p) => String(p).split('.').reduce((o, k) => o == null ? o : o[k], R);
  const plain = s => String(s == null ? '' : s).replace(/<[^>]*>/g, '').replace(/\$/g, 'S');

  /* ---------- 1. summary of checks ---------- */
  function summary(B, X) {
    const { R } = B, V = X.V, GR = (window.PSBDashUI && window.PSBDashUI.GROUPS) || [], RT = window.PSBDashUI && window.PSBDashUI.RATING;
    // each check's group of the check-summary column; a group on an input tab (input: the owner's limits, "Owner limits": the material limits and
    // the RIDOT girder age at continuity, 2026-11-13) links to the Owner rules table of §2, where the rule, the engine's value, limit and ratio
    // are shown (no link when §2 is left out)
    const where = new Map(); GR.forEach(gp => (gp.checks || []).forEach(([n, st]) => { if (!where.has(n)) where.set(n, { gp, st: gp.input ? X.ownKey : st }); }));
    // any other owner check in no group of the column (none today: every owner check is in "Owner limits" or a result group; kept as a
    // guard, with the note below naming it): the Owner rules table of §2 (link to that subsection)
    const OWNG = { name: 'Owner rules', tab: 'own' };
    R.checks.forEach(c => { if (!where.has(c.n) && /\((MassDOT|CTDOT|RIDOT) [\d.]+\)/.test(c.n) && X.ownKey) where.set(c.n, { gp: OWNG, st: X.ownKey }); });
    const gi = w => (!w ? 99 : w.gp === OWNG ? 98 : GR.indexOf(w.gp));
    const order = R.checks.map((c, i) => ({ c, i, w: where.get(c.n) })).sort((a, b) => gi(a.w) - gi(b.w) || a.i - b.i);
    const rows = order.map(({ c, i, w }) => { const p = `checks.${i}.`;
      return { cells: [w ? w.gp.name : '—', plain(c.n), { t: V(p + 'loc', 2), n: true }, { t: V(p + 'v', 3), n: true }, { t: V(p + 'lim', 3), n: true }, plain(c.u), { t: V(p + 'r', 3), n: true, cls: !c.pass ? 'ng' : c.r >= 0.9 ? 'hi' : 'ok' },
        { t: c.pass ? 'PASS' : 'FAIL', cls: c.pass ? 'ok' : 'ng' }, w && w.st ? `see [[${w.st}]]` : '—'], cls: c.pass ? '' : 'gov' }; });
    const nF = R.checks.filter(c => !c.pass).length, top = R.checks.reduce((b, c, i) => (!b || c.r > b.c.r ? { c, i } : b), null);
    const tw = top && where.get(top.c.n), outCol = R.checks.filter(c => { const w = where.get(c.n); return !w || w.gp === OWNG; });   // checks the column does not count
    const items = [
      note(`${nF ? `FAIL: ${nF} of ${R.checks.length} checks do not pass.` : `PASS: all ${R.checks.length} checks pass.`}${top ? ` Largest ratio ${V(`checks.${top.i}.r`, 3)} (${plain(top.c.n)}, x = ${V(`checks.${top.i}.loc`, 2)} ft)${tw && tw.st ? `, see [[${tw.st}]]` : ''}.` : ''}`, nF > 0),
      note(`Each check at its governing station, as the engine reports it (the design girder only; every girder × span comes with the bridge level). Ratio = demand / limit, OK ≤ 1.0 (PASS when the ratio ≤ 1.0001, the engine\'s rule); stresses + compression, − tension. Each row links to the step that works it; the owner\'s limits (group Owner limits: the material limits and, RIDOT with continuity, the girder age at continuity) link to the Owner rules table of §2. The groups are those of the check summary column of the app, whose PASS / FAIL totals count the same checks${outCol.length ? ' except those named below' : ''}.`),
      ...(outCol.length ? [note(`Not in the check summary column and not counted in its totals: ${outCol.map(c => plain(c.n)).join('; ')} (listed here, with a link to the Owner rules table).`, true)] : []),
      tbl(['Group', 'Check', 'x (ft)', 'Demand', 'Limit', 'Unit', 'Ratio', 'Status', 'Worked'], rows, { wide: true })];
    if (RT && R.rating) {
      const rf = RT.rf.map(([n, f, st]) => ({ n, v: f(R), st })), pth = { 'rt.RFinv': 'rating.RFinv', 'rt.RFvInv': 'shrRating.RFinv', 'rt.RFs3': 'svcRating.RF' };
      items.push(tbl(['HL-93 inventory rating factor', 'RF', 'Worked'], rf.map(z => [z.n, { t: V(pth[z.st], 3), n: true, cls: z.v < 1 ? 'ng' : 'ok' }, `see [[${z.st}]]`])),
        note('Rating factors are not design checks and are not counted in the PASS / FAIL above (RF ≥ 1.0 is OK; 99 = not applicable).'));
    }
    const kq = kv([['Girder', `${plain(B.inp.girder)}, span L = ${V('L', 2)} ft, ${V('ss.Ntot', 0)} strands`], ['Total loss Δf$_{pT}$', `${V('totalLoss', 2)} ksi (${V('pctLoss', 1)} %) (see [[ls.total]])`],
      ['Effective prestress f$_{pe}$', `${V('fpe', 2)} ksi (see [[ls.fpe]])`], ['DF$_{M}$ / DF$_{V}$', `${V('dfm', 3)} / ${V('dfv', 3)} (see [[ld.dfm]])`],
      ['φM$_{n}$ / M$_{u}$ at midspan', `${V('fMid.phiMn', 0, 12)} / ${V('MuMid', 0, 12)} kip-ft (see [[fx.phiMn]])`], ['Camber at release / final', `${V('cam.rel', 2)} / ${V('cam.final', 2)} in (see [[cb.rel]])`]]);
    const subs = [sub('chk', B.cell ? `Design checks of girder type ${plain(B.P.types[B.cell.k].label)} on line G${B.cell.g}, span ${B.cell.s}` : 'Design checks of the design girder', items), sub('kq', 'Key quantities', [kq])];
    // PR 3a-2: every girder type on every line (several cells): each type's governing check, its worst line, and each line's; this report
    // works the type and line chosen above the tabs (the others: choose them there; the same steps).
    // PR 3b: the Summary tab's tables (ui/summary.js model: the same choices among the same engine values): the girder × span grid, the
    // governing ratio of each check group per girder type with its line and a "see §" reference to the section that works the group, and
    // the weights per line, per type and the bridge total (SB-6)
    if (B.all && B.all.n > 1 && window.PSBSummaryUI) subs.splice(1, 0, allSub(B, X, null));
    if ((R.warns || []).length) subs.push(sub('warn', `Design warnings of the engine (${R.warns.length})`, R.warns.map(w => note(plain(w), true))));
    return { title: 'Summary of checks', subs };
  }

  /* the Report's tables of every girder type and line (PR 3b): the girder × span grid, the governing ratio of each check group per type,
     the weights. M (PS-25, several worked units) = { sec(tab, k, g) -> the section key that works that type × line's group, shown, works,
     worked: texts }; null: one worked girder (the sections rs.<tab>) */
  function allSub(B, X, M) {
      const SM = window.PSBSummaryUI.model(B.P, B.all), fx = (v, d) => (typeof v === 'number' && isFinite(v) ? v.toFixed(d) : '—');
      const sk = (tab, k, g) => (M ? M.sec(tab, k, g) : 'rs.' + tab), ref = (gp, k, g) => (gp.input ? (X.ownKey ? `see [[${X.ownKey}]]` : '—') : `see [[${sk(gp.tab, k, g)}]]`);
      const shown = M ? M.shown : B.cell ? `girder type ${plain(B.P.types[B.cell.k].label)} on line G${B.cell.g}, span ${B.cell.s}` : 'the girder shown';
      const gRows = SM.grid.map((row, i) => [`G${i + 1}`, ...row.map(z => (!z ? { t: 'no type: not checked', cls: 'ng' } : z.err ? { t: `${plain(z.c.label)}: engine error`, cls: 'ng' } : !z.gov ? `${plain(z.c.label)}: no check`
        : { t: `${plain(z.c.label)}: ${fx(z.gov.q.r, 3)} ${z.nF ? `FAIL (${z.nF})` : 'PASS'}, ${z.gov.gp.name} (${ref(z.gov.gp, z.c.k, z.c.g)})`, cls: z.nF ? 'ng' : 'ok' }))]);
      const trs = []; SM.types.forEach(T => { SM.used.forEach(gp => { const z = T.groups[gp.id]; if (!z) return;
        trs.push({ cells: [plain(T.label), String(T.span), gp.name, plain(z.q.n), `G${z.g}`, { t: fx(z.q.r, 3), n: true, cls: z.q.pass ? 'ok' : 'ng' }, { t: z.q.pass ? 'PASS' : 'FAIL', cls: z.q.pass ? 'ok' : 'ng' }, ref(gp, T.k, z.g)], cls: z.q.pass ? '' : 'gov' }); });
        if (T.rf) trs.push([plain(T.label), String(T.span), 'Rating (RF, not a check)', plain(T.rf.n), `G${T.rf.g}`, { t: fx(T.rf.v, 3), n: true, cls: T.rf.v < 1 ? 'ng' : 'ok' }, T.rf.v >= 1 ? 'RF ≥ 1' : 'RF < 1', `see [[${sk('rt', T.k, T.rf.g)}]]`]); });
      const wrs = SM.types.map(T => [plain(T.label), String(T.span), T.lines.map(z => `G${z.c.g} ${fx(z.c.W, 1)}`).join(', '), { t: fx(T.W, 1), n: true }]);
      wrs.push({ cells: ['Bridge total', '', `${SM.n} lines`, { t: fx(SM.W, 1), n: true }], cls: '' });
      return sub('all', 'Every girder type and line', [
        note(`${B.all.types.length} girder types on ${B.all.n} girder lines (every span): ${SM.nF ? `FAIL: ${SM.nF} check${SM.nF > 1 ? 's' : ''} of the girder types do not pass` : 'PASS: every check of every girder type passes'} (counted once per girder type and check, its worst line, SB-5; ${SM.nP} PASS). Each type is checked on every line assigned to it with that line's span, spacing, position, overhang and skew; the worst line governs. ${M ? M.works : `This report works ${shown} (the summary above and every section below); the other types and lines are worked the same way on the result tabs (choose the type and line above them) and listed on the [[tab:sum|Summary tab]].`}`, SM.nF > 0),
        tbl(['Line', ...B.P.spans.lengths.map((L, j) => `Span ${j + 1} (L = ${fx(+L, 2)} ft)`)], gRows, { wide: true }),
        note('Girder × span grid: each cell the girder type on that line, its governing ratio (the largest of its checks, demand / limit, the engine\'s), PASS or FAIL (the number of its checks over 1.0) and the check group, with the section that works it.'),
        tbl(['Girder type', 'Span', 'Check group', 'Governing check', 'Line', 'Ratio', 'Status', 'Worked'], trs, { wide: true }),
        note(`Each check group: the check with the largest ratio over the girder type's lines, the line named (SB-5). ${M ? M.worked : `Worked: the section of this report that works the group, for ${shown}; for another type or line the same steps are on the result tab with that type and line chosen.`} Rating: the lowest HL-93 inventory rating factor (not a check, not counted).`),
        tbl(['Girder type', 'Span', 'Weight per line (kip)', 'Weight (kip)'], wrs),
        note(`Weight: w$_{sw}$ (L + 2 e$_{end}$/12) per line, the weight W of the hold-down check (see [[${sk('end', null, null)}]]); a girder type\'s weight the sum over its lines, the bridge total the sum over every checked line (SB-6).`)]);
      }

  /* ---------- 2. project, basis and assumptions ---------- */
  const ASSUME = [
    'Handling: the release-stage stresses are checked at the lifting points; the hauling stresses are shown for comparison and not checked (the old app has no hauling-stress check); impact during transport is not included; no compression check in handling (the limit is shown); the stresses are found on the span L, not on the girder length with its ends past the bearings; the lateral stability is a screening, not the full PCI / Mast method (see [[rs.hand]]).',
    'Deck: the strip method of the old app (PS-14 a): dead-load moments wS²/11 (positive) and wS²/10 (negative), live-load moments from Table A4-1, the overhang by the old app\'s equivalent-strip expression, distribution reinforcement min(220/√S, 67 %) (see [[rs.deck]]).',
    'Rating: LRFR at the governing positive-moment section only (flexure), the critical shear section and Service III; no pier region and no restraint moments in the rating. The MBE citations are the article numbers the old app uses; the MBE 4th Ed. (2026) labels are a separate change (plan PR 6, PS-14 e) (see [[rs.rt]]).',
    'Hold-down force (PS-10): for AASHTO and RIDOT projects 2 n$_{h}$ f$_{pbt}$ A$_{b}$ sin α ≤ f W when the box on the Owner rules tab is on (default on, f = 0.75 editable); AASHTO LRFD itself sets no limit; MassDOT and CTDOT keep their own rule (see [[rs.end]]).',
    'Continuity (PS-7): girder and DC1 on the simple span; DC2, DW and live load on the continuous unit where the spans are made continuous for composite loads (5.12.3.3); restraint moments as switched on the Bridge layout tab (see [[rs.an]]).',
    'Every value of this report is the engine\'s (the old Prestressed Bridge Design engine, moved unchanged, plus the PS-10 check); each section shows the result tab of the same name, its cards and its worked steps.'];
  function proj(B, X) {
    const { P, inp, sel } = B, p = P.project || {}, IN = window.PSBInputsUI, FT = window.PSBReportTab, nS = P.spans.lengths.length, own = inp.owner || 'AASHTO';
    const ownR = window.PBD && window.PBD.OWN_RULES && window.PBD.OWN_RULES.owners[own];
    const o = { tab: 'proj', X, sec: 'proj', inReport: X.inReport };
    const asm = IN ? FT.cards(IN.cards('proj', P), o).subs.find(s => /Assumptions/.test(s.title)) : null;
    const nv0 = X.vals.length, ownSubs = IN ? FT.cards(IN.cards('own', P, B.R), o).subs.filter(s => s.items.length) : [];   // R: the owner's material checks in the rules table
    if (IN && X.ownT && X.ownT.length > 1) ownCols(ownSubs, X, o, nv0);   // PS-26: one "Applied here" column per girder type (when they differ)
    const subs = [
      sub('p', 'Project', [kv([['Project', p.name || '—'], ['Project No', p.number || '—'], ['Client / owner', p.owner || (ownR ? ownR.manual : own)], ['Computed by', p.designer || '—'], ['Checked by', p.checker || '—'], ['Date', p.date || '—']]),
        p.notes ? note(plain(p.notes)) : null]),
      sub('b', 'Bridge and the design girder', [kv([['Spans', `${P.spans.lengths.map(L => OK().fx(+L, 2)).join(' + ')} ft (${P.spans.continuity === 'composite' && nS > 1 ? 'made continuous for composite loads, 5.12.3.3' : 'simple spans'})`],
        ['Girders', `${P.xs.nb}; bays ${(P.xs.bays || []).map(x => OK().fx(+x, 2)).join(', ')} ft; overhangs ${OK().fx(+P.xs.ohL, 2)} / ${OK().fx(+P.xs.ohR, 2)} ft`], ['Support skews', `${(P.xs.skews || []).map(x => OK().fx(+x, 1)).join(', ')}°`],
        ['Design girder', `${plain(inp.proj && inp.proj.girderId)} in span ${sel.s}: ${plain(inp.girder)}, L = ${V0(X, 'L', 2)} ft, S = ${OK().fx(+inp.S, 3)} ft, ${inp.loads.pos === 'exterior' ? 'exterior' : 'interior'} girder`],
        ['Owner', ownR ? `${own} (${ownR.manual})` : own]]), note('Entered values (Project, Bridge layout, Cross-section and Girders & strands tabs); the engine inputs of the design girder are those of the [[tab:in:gird|Girders & strands tab]].')]),
      sub('c', 'Basis', [kv([['Design specification', ED], ['Load rating', 'AASHTO Manual for Bridge Evaluation (MBE), LRFR; article numbers as the old app'], ['Owner manual', ownR && !ownR.none ? `${ownR.manual} (AASHTO LRFD ${ownR.aashto} basis); its rules as listed below` : 'none (AASHTO only)'],
        ['Units', 'in, kip, ksi, ft, klf, kip-ft'], ['Sign convention', 'stresses + compression, − tension; moments + sagging']])]),
      sub('a', 'Assumptions', [...(asm ? asm.items : []), ...ASSUME.map(t => note('• ' + t)), ...deNote(P)])];
    ownSubs.forEach((s, j) => subs.push({ ...sub('o' + j, `Owner rules: ${s.title}`, s.items), ...(j === 0 ? { key: X.ownKey } : {}) }));
    return { title: 'Project, basis and assumptions', subs };
  }
  const V0 = (X, p, d, div) => X.V(p, d, div);
  /* ownCols(ownSubs, X, o, nv0): PS-26 (engineer decision 2026-11-13): several girder types (the report of PS-25): the Owner rules table of §2
     gets one "Applied here" column per girder type, each the type's own owner checks (the Owner rules tab's cell, ui/inputs.js ownerCard, made
     with that type's inputs and engine result) on its governing line (X.ownT, made by multiSecs), the column heading naming the type and
     line and pointing to the sections that work that type. Where every type's column is the same (or one type), nothing changes: the
     single column as before. The values of the replaced column are replaced by each type's (recorded with u = its unit, or cell = 'k|g' for
     a line the report does not work in full). Display only: the cells are those of the Owner rules tab. */
  function ownCols(ownSubs, X, o, nv0) {
    const IN = window.PSBInputsUI, FT = window.PSBReportTab, isT = it => it.type === 'table' && /^Applied here/.test(String(it.head[it.head.length - 1]));
    const q0 = ownSubs.find(q => q.items.some(isT)); if (!q0) return;
    const cols = X.ownT.map(T => { const vals = [], q = FT.cards(IN.cards('own', T.P, T.R), { ...o, X: { vals } }).subs.find(s => s.items.some(isT)); return q ? { T, vals, q } : null; });
    if (cols.some(c => !c)) return;
    const rowsOf = tb => tb.rows.map(r => (Array.isArray(r) ? r : r.cells)), tbOf = c => c.q.items.find(isT);
    const last = c => JSON.stringify(rowsOf(tbOf(c)).map(r => r[r.length - 1])), lead = c => JSON.stringify([tbOf(c).head, rowsOf(tbOf(c)).map(r => r.slice(0, -1))]);
    if (cols.every(c => last(c) === last(cols[0]))) return;   // the same values for every girder type: one column, as before
    if (cols.some(c => lead(c) !== lead(cols[0]))) return;   // (the rules are the owner's, the same for every type: a guard)
    cols.forEach(c => c.T.scope([c.q]));   // a reference in a type's cell: to that type's sections
    const t0 = tbOf(cols[0]), nh = t0.head.length, i0 = q0.items.findIndex(isT);
    const rows = t0.rows.map((r, i) => { const cells = [...rowsOf(t0)[i].slice(0, -1), ...cols.map(c => { const rr = rowsOf(tbOf(c))[i]; return rr[rr.length - 1]; })]; return Array.isArray(r) ? cells : { ...r, cells }; });
    q0.items.splice(i0, 1, { ...t0, head: [...t0.head.slice(0, -1), ...cols.map(c => `${t0.head[nh - 1]}: ${c.T.title}`)], rows, wide: true },
      note('One "Applied here" column per girder type: the type\'s owner checks and values on its governing line (the line with its largest owner-limit ratio), with the sections that work the type. Where every girder type has the same values, the table has one column.'));
    X.vals.splice(nv0);
    cols.forEach(c => c.vals.forEach(v => X.vals.push({ ...v, ...(c.T.u != null ? { u: c.T.u } : { cell: `${c.T.k}|${c.T.g}` }) })));
  }
  /* deNote(P): PS-23 (engineer decision 2026-11-13): the entered d_e that differs from the d_e computed from the cross-section (PS-20), the
     same rows as the Loads & LLDF tab's notice, listed in the assumptions always (also after the notice is dismissed); none where they match */
  function deNote(P) { const DS = window.PSBDesign, D = DS && DS.deDiff ? DS.deDiff(P) : { rows: [] }; return D.rows.length ? [note(`• ${DS.deText(D, t => `$_{${t}}$`)} (see [[rs.lds]])`)] : []; }

  /* ---------- 3–14. the result tabs ---------- */
  function tabSec(B, k, X) {
    const [ui, wk] = TABS[k], U = window[ui], FT = window.PSBReportTab;
    const html = U.output({ P: B.P, inp: B.inp, R: B.R, W: B.W, ui: {} });   // ui {}: each chooser at its default (the governing / midspan station)
    const C = FT.cards(html, { tab: k, X, sec: k, inReport: X.inReport, figs: X.figs && X.figs[k] });   // figs: the tab's own graphics at their slots (ui/report.js)
    const subs = [], gTop = C.top.filter(i => i.type === 'figure'), nTop = C.top.filter(i => i.type !== 'figure');
    if (gTop.length) subs.push(sub('g', 'Graphics', gTop));
    if (nTop.length) subs.push(sub('n', 'Notes', nTop));
    C.subs.forEach((s, j) => {
      if (s.steps) { const W = (B.W[wk] || { steps: [] }).steps; if (W.length) subs.push(sub('w', 'Worked steps', [...s.items, gsteps('', W, U.TOPICS)])); return; }
      subs.push(sub('c' + j, s.title || '—', s.items.length ? s.items : [note('—')]));
    });
    if (!subs.length) subs.push(sub('n', 'Not available', [note('This tab shows nothing for this design.')]));
    return { title: (SECTIONS.find(q => q[0] === k) || [k, k])[1], subs };
  }

  const refsOf = B => [['AASHTO LRFD', 'AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024): articles as cited at each step'], ['MBE', 'AASHTO Manual for Bridge Evaluation, LRFR (Section 6, Part A): article numbers as the old app'],
    ['PCI', 'PCI Bridge Design Manual and the Mast method (handling stability screening), as the moved engine'], ...(B.inp.owner && B.inp.owner !== 'AASHTO' && window.PBD ? [[B.inp.owner, window.PBD.OWN_RULES.owners[B.inp.owner].manual]] : [])];

  /* ---------- PS-25: several worked units ----------
     Engineer decision PS-25 (2026-11-13): the worked sections (§3–§14, figures included) are printed once per girder type for its governing
     line (report/data.js units: the line with the largest governing ratio), numbered per type (Interior §3–§14, Exterior §15–§26, …), the
     type and line in each section heading; or (the Report tab's choice "every girder line") once per girder type × line. §1 lists each
     unit's design checks and key quantities and the tables of every type and line, whose "see §n" point to the unit that works that type
     (that line in "every line"); §2 once. One unit that is the girder shown: the report of one girder as before (no headings changed).
     Each unit's step anchors get the scope 'u<i>' and its section keys 'rs.<tab>@u<i>'; the [[key]] references made inside a unit's text
     are moved to that unit's keys (scopeU). Every number is the unit's engine result (X.R), recorded with u = its index. */
  const uTitle = U => `${plain(U.label)} on G${U.g}, span ${U.s}`;
  /* scopeU(subs, keys, i): the unit's references [[k]] (k one of its step ids or section keys) -> its scoped keys; steps items -> scope u<i> */
  function scopeU(subs, keys, i) {
    const map = k => (keys.steps.has(k) ? `u${i}/${k}` : keys.secs.has(k) ? `${k}@u${i}` : k);
    const fixT = t => (typeof t === 'string' ? t.replace(/\[\[([^\]|]+)\]\]/g, (m, k) => `[[${map(k)}]]`) : t);
    const fixC = c => (c && typeof c === 'object' ? { ...c, t: fixT(c.t), ...(c.key ? { key: map(c.key) } : {}) } : fixT(c));
    subs.forEach(q => { q.items = q.items.map(it => {
      if (it.type === 'steps') return { ...it, scope: `u${i}` };
      if (it.type === 'note') return { ...it, text: fixT(it.text) };
      if (it.type === 'kv') return { ...it, rows: it.rows.map(r => r.map((x, j) => (j === 2 && x ? map(x) : fixT(x)))) };
      if (it.type === 'table') return { ...it, head: it.head.map(fixC), rows: it.rows.map(r => (Array.isArray(r) ? r.map(fixC) : { ...r, cells: r.cells.map(fixC) })) };
      return it; }); });
    return subs;
  }
  /* ownTypes(B, U, range, scope): PS-26: the girder types of §2's Owner rules columns, in the order of the types: each type's governing line
     for its owner checks (the line with the largest ratio of the check summary's Owner limits checks; a tie, or none: the line the report
     works for the type, its first in "every line"), its engine result, the unit that works it (u; null for a line not worked in full) and
     the unit whose sections the column points to (the type's, that line's in "every line") */
  function ownTypes(B, U, range, scope) {
    const SU = window.PSBSummaryUI, DU = window.PSBDashUI; if (!SU || !B.all) return null;
    const gp = (DU && DU.GROUPS || []).find(g => g.id === 'mat'), isOwn = n => !!gp && gp.checks.some(([cn]) => cn === n);
    const top = z => z.c.R.checks.filter(q => isOwn(q.n) && typeof q.r === 'number' && !isNaN(q.r)).reduce((a, q) => Math.max(a, q.r), -Infinity);
    return SU.model(B.P, B.all).types.map(T => {
      const ls = T.lines.filter(z => !z.err), ju = U.findIndex(u => u.k === T.k); if (!ls.length || ju < 0) return null;
      const b = ls.reduce((b, z) => (top(z) > top(b) ? z : b), ls.find(z => z.c.g === U[ju].g) || ls[0]), c = b.c;
      const u = U.findIndex(q => q.k === T.k && q.g === c.g), j = u >= 0 ? u : ju;
      return { k: T.k, g: c.g, s: c.s, u: u >= 0 ? u : null, P: Object.assign({}, B.P, { design: { g: c.g, s: c.s } }), R: c.R,
        title: `${plain(c.label)} on G${c.g}, span ${c.s} (see ${range(j)})`, scope: subs => scope(subs, j) };
    }).filter(Boolean);
  }
  function multiSecs(B, X, opt, on, secs, dropped) {
    const vals = X.vals, U = B.units, figs = Array.isArray(opt.figures) ? opt.figures : [];
    const Bu = u => ({ P: u.P, inp: u.inp, R: u.R, W: u.W, sel: { g: u.g, s: u.s }, cell: { k: u.k, g: u.g, s: u.s }, all: null });
    const fail = (k, e) => ({ title: (SECTIONS.find(q => q[0] === k) || [k, k])[1], subs: [sub('n', 'Not available', [note('Report error: ' + (e && e.message), true)])] });
    // the worked sections of each unit (built first: their step ids are the unit's keys)
    const unitSecs = U.map((u, i) => {
      X.u = i; X.R = u.R; X.figs = figs[i] || null; const out = [], keys = { steps: new Set(), secs: new Set(Object.keys(TABS).map(t => 'rs.' + t)) };
      SECTIONS.forEach(([k]) => { if (!TABS[k]) return;
        X.cur = k; const n0 = vals.length; let s; try { s = tabSec(Bu(u), k, X); } catch (e) { s = fail(k, e); }
        vals.slice(n0).forEach(v => { v.sec = k; v.u = i; });
        s.subs.forEach(q => q.items.forEach(it => { if (it.type === 'steps') it.steps.forEach(t => keys.steps.add(String(t.id))); }));
        out.push({ k, s, n0, n1: vals.length }); });
      return { u, out, keys };
    });
    const range = i => { const ks = SECTIONS.filter(([k]) => TABS[k] && on(k)).map(([k]) => `rs.${k}@u${i}`); return ks.length ? `[[${ks[0]}]]–[[${ks[ks.length - 1]}]]` : '(sections not included)'; };
    const secKey = (tab, k, g) => { const j = U.findIndex(u => u.k === k && (B.mode !== 'all' || u.g === g)); return `rs.${tab}@u${j >= 0 ? j : 0}`; };
    // §1: the tables of every type and line, then each unit's design checks, key quantities and warnings
    X.cur = 'sum'; let s1;
    try {
      const subs = [];
      U.forEach((u, i) => { X.u = i; X.R = u.R; const n0 = vals.length; const s = summary(Bu(u), X); vals.slice(n0).forEach(v => { v.sec = 'sum'; v.u = i; });
        scopeU(s.subs, unitSecs[i].keys, i).forEach(q => subs.push({ ...q, id: q.id + i, title: q.id === 'kq' ? `Key quantities: ${uTitle(u)}` : q.id === 'warn' ? `${q.title}: ${uTitle(u)}` : q.title })); });
      X.u = null; X.R = null;
      const list = U.map((u, i) => `${uTitle(u)} (${range(i)})`).join('; ');
      const M = { sec: (tab, k, g) => (k == null ? `rs.${tab}@u0` : secKey(tab, k, g)), shown: B.mode === 'all' ? 'each girder type on each of its lines' : 'each girder type on its governing line',
        works: `This report works ${B.mode === 'all' ? 'every girder type on every line' : 'each girder type on its governing line (the line with its largest check ratio; on a tie, the next largest)'}: ${list}. ${B.mode === 'all' ? '' : 'The other lines are the rows of the tables below, each pointing to its type\'s sections; their steps are on the result tabs with that type and line chosen (the [[tab:sum|Summary tab]] lists them).'}`,
        worked: `Worked: the section of this report that works the group for that girder type (${B.mode === 'all' ? 'on the line named' : 'on its governing line'}).` };
      subs.unshift(allSub(B, X, M));
      s1 = { title: 'Summary of checks', subs };
    } catch (e) { X.u = null; X.R = null; s1 = fail('sum', e); }
    if (on('sum')) secs.push({ id: 'sum', key: 'rs.sum', ...s1 }); else { dropped.push({ key: 'rs.sum', ...s1 }); for (let j = vals.length - 1; j >= 0; j--) if (vals[j].sec === 'sum') vals.splice(j, 1); }
    // §2 once (the bridge, basis, assumptions; the owner rules table with the first unit's engine values, or PS-26 one column per girder type)
    X.ownT = ownTypes(B, U, range, (subs, j) => scopeU(subs, unitSecs[j].keys, j));
    X.cur = 'proj'; X.u = 0; X.R = U[0].R; { const n0 = vals.length; let s; try { s = proj(Object.assign(Bu(U[0]), { P: B.P }), X); s.subs = s.subs.map(q => q.id !== 'b' ? q : { ...q, title: 'Bridge and the worked girders', items: q.items.map(it => it.type !== 'kv' ? it
        : { ...it, rows: it.rows.map(r => r[0] !== 'Design girder' ? r : ['Worked girders', U.map((u, i) => `${uTitle(u)}: ${plain(u.inp.girder)}, L = ${OK().fx(u.R.L, 2)} ft, S = ${OK().fx(+u.inp.S, 3)} ft, ${u.inp.loads.pos === 'exterior' ? 'exterior' : 'interior'} (see [[rs.sec@u${i}]])`).join('; ')]) }) }); } catch (e) { s = fail('proj', e); }
      vals.slice(n0).forEach(v => { v.sec = 'proj'; if (v.u == null && v.cell == null) v.u = 0; }); scopeU(s.subs, unitSecs[0].keys, 0);   // §2's references to a result section: the first unit's
      if (on('proj')) secs.push({ id: 'proj', key: 'rs.proj', ...s }); else { dropped.push({ key: 'rs.proj', ...s }); vals.splice(n0); } }
    X.u = null; X.R = null; X.figs = null; X.ownT = null;
    // the worked sections, unit by unit, each heading naming its type and line
    const gone = [];
    unitSecs.forEach(({ u, out, keys }, i) => out.forEach(({ k, s, n0, n1 }) => {
      const t = { ...s, title: `${s.title}: ${uTitle(u)}`, subs: scopeU(s.subs, keys, i) };
      if (on(k)) secs.push({ id: `${k}-u${i}`, key: `rs.${k}@u${i}`, ...t }); else { dropped.push({ key: `rs.${k}@u${i}`, ...t }); for (let j = n0; j < n1; j++) gone.push(vals[j]); } }));
    for (let j = vals.length - 1; j >= 0; j--) if (gone.includes(vals[j])) vals.splice(j, 1);
  }

  function model(B, opt) {
    opt = opt || {};
    const inc = opt.include || null, on = k => !inc || inc[k] !== false, P = B.P, p = P.project || {}, R = B.R;
    const vals = [];
    const own = B.inp.owner && B.inp.owner !== 'AASHTO';
    const X = { vals, inReport: t => !!TABS[t] && on(t), ownKey: own && on('proj') ? 'rs.own' : null, figs: opt.figures || null };   // rs.own: the owner rules subsection of §2
    X.V = (path, d, div) => { const v = at(X.R || R, path), text = OK().fx(div ? v / div : v, d); vals.push({ sec: X.cur, path, d, div: div || 0, text, ...(X.u != null ? { u: X.u } : {}) }); return text; };   // PS-25: X.R / X.u = the worked unit's result
    const secs = [], dropped = [];
    if (B.multi) multiSecs(B, X, opt, on, secs, dropped);   // PS-25: the worked sections once per girder type (or per line)
    else SECTIONS.forEach(([k]) => {
      X.cur = k; const n0 = vals.length;
      let s; try { s = k === 'sum' ? summary(B, X) : k === 'proj' ? proj(B, X) : tabSec(B, k, X); }
      catch (e) { s = { title: (SECTIONS.find(q => q[0] === k) || [k, k])[1], subs: [sub('n', 'Not available', [note('Report error: ' + (e && e.message), true)])] }; }
      vals.slice(n0).forEach(v => { v.sec = k; });
      if (on(k)) secs.push({ id: k, key: 'rs.' + k, ...s });
      else { dropped.push({ key: 'rs.' + k, ...s }); vals.splice(n0); }
    });
    // references from the sections shown into a section left out: no link, the text says so (as apps/steel-bridge/report/builders.js)
    if (dropped.length) {
      const gone = new Set(), keep = new Set();
      dropped.forEach(s => { gone.add(s.key); s.subs.forEach(q => q.items.forEach(it => { if (it.type === 'steps') it.steps.forEach(t => gone.add(K(it.scope, t.id))); })); });
      secs.forEach(s => s.subs.forEach(q => q.items.forEach(it => { if (it.type === 'steps') it.steps.forEach(t => keep.add(K(it.scope, t.id))); })));
      const out = k => gone.has(k) && !keep.has(k), fixT = t => typeof t === 'string' ? t.replace(/\(?(?:see )?\[\[([^\]|]+)\]\]\)?/g, (m, k) => (out(k) ? '(section not included)' : m)) : t;
      const fixC = c => (c && typeof c === 'object' ? { ...c, t: fixT(c.t) } : fixT(c));
      secs.forEach(s => s.subs.forEach(q => { q.items = q.items.map(it => {
        if (it.type === 'note') return { ...it, text: fixT(it.text) };
        if (it.type === 'kv') return { ...it, rows: it.rows.map(r => [fixT(r[0]), fixT(r[1])]) };
        if (it.type === 'table') return { ...it, head: it.head.map(fixC), rows: it.rows.map(r => Array.isArray(r) ? r.map(fixC) : { ...r, cells: r.cells.map(fixC) }) };
        return it; }); }));
    }
    // the figures (each tab's own graphics, opt.figures from ui/report.js; none in Node): numbered "Figure n.m" by section n (the numbers of
    // the shared viewer: the sections shown, in order) and their order m in it, as the caption's lead
    secs.forEach((s, i) => { let m = 0; s.subs.forEach(q => q.items.forEach(it => { if (it.type === 'figure') { m++; it.no = `${i + 1}.${m}`; it.caption = `Figure ${i + 1}.${m}: ${it.caption || ''}`; } })); });
    const d = B.sel, gid = (B.cell ? `type ${plain(B.P.types[B.cell.k].label)}, ` : '') + plain(B.inp.proj && B.inp.proj.girderId);   // PR 3a-2: the girder type named
    if (B.multi) {   // PS-25: every girder type (its governing line) or every girder line
      const what = B.mode === 'all' ? `every girder line (${B.units.length})` : `every girder type on its governing line (${B.units.length})`;
      return { title: 'Prestressed Bridge Design', subtitle: `Calculation report: ${what}${p.name ? ', ' + p.name : ''}`,
        code: `${ED}; MBE (LRFR load rating). Each girder type's results on ${B.mode === 'all' ? 'each of its lines' : 'its governing line'}, as on the result tabs.`,
        info: [['Project No', p.number], ['Computed by', p.designer], ['Date', p.date], ['Project', p.name], ['Checked by', p.checker], ['Girders', what]],
        head: { left: `${p.name || 'Prestressed Bridge Design'}${p.number ? ' (' + p.number + ')' : ''}\nWorked: ${what}`, right: `Computed by: ${p.designer || '—'}  Date: ${p.date || '—'}\nChecked by: ${p.checker || '—'}`, foot: `Prestressed Bridge Design (new, in development), ${ED}` },
        refs: refsOf(B), sections: secs, vals };
    }
    return { title: 'Prestressed Bridge Design', subtitle: `Calculation report: design girder ${gid}, span ${d.s}${p.name ? ', ' + p.name : ''}`,
      code: `${ED}; MBE (LRFR load rating). The design girder's results, as on the result tabs.`,
      info: [['Project No', p.number], ['Computed by', p.designer], ['Date', p.date], ['Project', p.name], ['Checked by', p.checker], ['Girder', `${gid}, span ${d.s}`]],
      head: { left: `${p.name || 'Prestressed Bridge Design'}${p.number ? ' (' + p.number + ')' : ''}\nDesign girder ${gid}, span ${d.s}`, right: `Computed by: ${p.designer || '—'}  Date: ${p.date || '—'}\nChecked by: ${p.checker || '—'}`, foot: `Prestressed Bridge Design (new, in development), ${ED}` },
      refs: refsOf(B),
      sections: secs, vals };
  }

  window.PSBReportBuild = { SECTIONS, TABS, model, ASSUME };
})();
