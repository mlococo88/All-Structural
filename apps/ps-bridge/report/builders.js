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
  const gsteps = (scope, list, topics) => { const G = window.PSBOutKit ? window.PSBOutKit.groups(list || [], topics || []) : S().group(list || [], topics || [], { strip: false });   // PSBOutKit.groups: the RF topics as on the tab (2026-11-15)
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
      items.push(tbl(['HL-93 inventory rating factor', 'RF', 'Worked'], rf.map(z => [z.n, z.v >= 99 ? { t: '—', n: true } : { t: V(pth[z.st], 3), n: true, cls: z.v < 1 ? 'ng' : 'ok' }, `see [[${z.st}]]`])),   // 99: the engine's "not applicable", shown — as on the Rating tab (2026-11-15)
        note('Rating factors are not design checks and are not counted in the PASS / FAIL above (RF ≥ 1.0 is OK; — = not applicable, e.g. no live-load tension at the Service III section).'));
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
        ['Owner', ownR ? `${own} (${ownR.manual})` : own]]), note('Entered values (Project, Bridge layout, Cross-section and Girders & strands tabs); the engine inputs of the design girder are those of the [[tab:in:gird|Girders & strands tab]].'), ...planFig(P, X)]),
      sub('c', 'Basis', [kv([['Design specification', ED], ['Load rating', 'AASHTO Manual for Bridge Evaluation (MBE), LRFR; article numbers as the old app'], ['Owner manual', ownR && !ownR.none ? `${ownR.manual} (AASHTO LRFD ${ownR.aashto} basis); its rules as listed below` : 'none (AASHTO only)'],
        ['Units', 'in, kip, ksi, ft, klf, kip-ft'], ['Sign convention', 'stresses + compression, − tension; moments + sagging']])]),
      sub('a', 'Assumptions', [...(asm ? asm.items : []), ...ASSUME.map(t => note('• ' + t)), ...deNote(P), ...voidNotes(B), ...tbcNotes(B), ...rowNotes(B), ...fgNotes(B), ...secNotes(B)])];
    ownSubs.forEach((s, j) => subs.push({ ...sub('o' + j, `Owner rules: ${s.title}`, s.items), ...(j === 0 ? { key: X.ownKey } : {}) }));
    return { title: 'Project, basis and assumptions', subs };
  }
  /* ---------- §2, last subsection: the Auto design basis (ADB, 2026-11-15; display only) ----------
     The basis of the auto design run applied or shown in this page view (ui/autodesign.js basis(P): { kind: 'shown' | 'applied' |
     'running', R (PSBAutoDesign.run result), Q (the project copy the run used), sel (the candidate chosen per span), stale (the project
     changed since) }, opt.autodesign from ui/report.js; none in Node): the objective, the sections searched, the strand, drape and f′c /
     f′ci rules with the owner limits, the order of preference, and each span's selected candidate with its checks and a "see §" link to
     the step that works each check (the step of the girder type the report works; another type: its result tab). Read from
     PSBAutoDesign (its settings, rules and run result) and P.autodesign; nothing is computed here and no number is recorded in model.vals
     (the run's numbers are its own engine runs of the candidate, not R of the design girder). Last in §2 so that no section or
     subsection number of the report changes. */
  const AD_KEY = 'rs.adb';
  function keysOf(secs) {
    const ks = new Set();
    secs.forEach(s => { if (s.key) ks.add(s.key); s.subs.forEach(q => { if (q.key) ks.add(q.key);
      q.items.forEach(it => { if (it.type === 'steps') it.steps.forEach(t => ks.add(K(it.scope, t.id))); }); }); });
    return ks;
  }
  function adSub(B, X, A, secs) {
    const AD = window.PSBAutoDesign, BR = window.PSBBridge, fx = OK().fx, out = items => ({ ...sub('adb', 'Auto design basis', items), key: AD_KEY });
    const goTab = '[[tab:ad|Auto design output tab]]', goIn = '[[tab:in:ad|Auto design input tab]]';
    if (!A || !A.R || !AD || !BR) return out([note(A && A.kind === 'running'
      ? `An auto design run is under way (${goTab}): its basis is listed here when it ends. Nothing in this report comes from an auto design until a candidate is applied.`
      : `No auto design was run in this page view: nothing in this report comes from an auto design (the inputs are as entered). Run it on the ${goIn}; the basis of the run applied or shown is then listed here.`)]);
    const R = A.R, Q = A.Q, o = R.o || AD.settings(Q), T = BR.types(Q), lab = k => plain((T[k] || {}).label || `type ${k + 1}`);
    const keys = keysOf(secs), GR = (window.PSBDashUI && window.PSBDashUI.GROUPS) || [];
    const where = n => { for (const gp of GR) for (const [cn, st] of gp.checks || []) if (cn === n) return { gp, st }; return null; };
    /* see(n, k, g): where check n of girder type k (worst on line g) is worked: the step of this report that works that type (its unit in
       the report of every type), else its result tab */
    const see = (n, k, g) => {
      const w = where(n); if (!w) return '—';
      if (w.gp.input) return X.ownKey && keys.has(X.ownKey) ? `see [[${X.ownKey}]]` : `[[tab:in:${w.gp.tab}|${plain(w.gp.name)}]]`;
      let key = null, ln = '';
      if (B.multi) { const j = B.units.findIndex(u => u.k === k && (B.mode !== 'all' || u.g === g)); if (j >= 0) { key = `u${j}/${w.st}`; if (B.units[j].g !== g) ln = ` (worked for G${B.units[j].g})`; } }
      else if (!B.cell || B.cell.k === k) { key = w.st; if (B.cell && B.cell.g !== g) ln = ` (worked for G${B.cell.g})`; }
      return key && keys.has(key) ? `see [[${key}]]${ln}` : `[[tab:${w.gp.tab}|${plain(w.gp.name)}]] tab, type ${lab(k)} chosen`;
    };
    const items = [];
    // the run
    const st = A.kind === 'applied'
      ? `Applied in this page view (${goTab}, Apply): every girder type of a span with a candidate took the selected candidate's section, straight rows, draped strands, f′c and f′ci as its own inputs; nothing else was changed. The other sections of this report work the inputs as they are now${A.stale ? '.' : ', which are those of the candidates below.'}`
      : `Shown on the ${goTab}, not applied: the other sections of this report work the inputs as entered, not the candidates below. The ratios below are the auto design's own engine runs of each candidate.`;
    items.push(note(st));
    if (A.stale) items.push(note(A.kind === 'applied' ? 'The project has changed since the run was applied (an edit, Undo or Redo): the inputs the other sections work may differ from the candidates below.' : 'The project has changed since this run: run it again before applying.', true));
    items.push(note(`${R.runs} engine runs in ${fx(R.ms / 1000, 1)} s${R.stopped ? ' (stopped at the run limit: the results are partial)' : ''}. Auto design proposes inputs only: each trial is computed by the same engine as the result tabs (every check on every line of the girder type, the worst line governing) and checked for strand fit as the inputs are; a candidate passes every check. The run is kept in this page view only (not saved with the project).`));
    // objective and variables
    const VN = { section: 'Girder section', strands: 'Strand count and rows', drape: 'Draped strands', conc: 'f′c and f′ci' };
    items.push({ ...kv([['Objective', o.objective === 'depth' ? 'the shallowest section (depth h, then gross area A)' : 'the lightest section (gross area A, then depth h)'],
      ['Sections listed per span', String(o.topN)], ['Variables', Object.keys(VN).map(v => `${VN[v]}: ${o.vars[v] === 'lock' ? 'Lock (as entered)' : 'Auto'}`).join('; ')]]), topic: { title: 'Objective and variables' } });
    items.push({ ...note(`Order of preference (the first is the most important): the ${o.objective === 'depth' ? 'shallower section (h, then A)' : 'lighter section (A, then h)'}; then fewer strands N; then fewer draped strands n$_{h}$; then the lower hold-down force (the flatter drape, (y$_{end}$ − y$_{mid}$) / frac); then the hold-down point nearest 0.40 L; then the lower f′c; then the lower f′ci. Ties keep the first in the search order (no random step). Per girder type and section: (1) the fewest straight strands that pass Strength I flexure and Service III tension with no draped strand (a lower bound); (2) from there, in pairs, n$_{h}$ = 0, 2, … with the flattest drape that passes every check; (3) the lowest f′c (with the highest f′ci it allows), then the lowest f′ci, with that pattern.`), topic: { title: 'Order of preference' } });
    // sections searched
    const rowsS = [];
    R.spans.forEach(sp => sp.sections.forEach(e => { const ci = sp.cands.indexOf(e), ks = sp.types;
      const why = ci >= 0 ? `candidate #${ci + 1}` : (() => { const q = e.types.find(z => !z.res.best); return q ? `none (${lab(q.k)}: ${plain(q.res.why)})` : 'not run'; })();
      rowsS.push([String(sp.s), plain(e.name), { t: fx(e.h, 2), n: true }, { t: fx(e.A, 1), n: true }, ks.map(lab).join(', '), why]); }));
    items.push({ ...note(`The library sections of the span's current shape family (I-girders and bulb tees; deck bulb tees; NEXT F; NEXT D; spread box beams; adjacent box beams; deck slabs); for a MassDOT project the MassDOT sections, for any other owner the other library sections; adjacent members (box beams, deck slabs) of the same nominal width (their width sets the girder lines); one section for every girder type of a span (PS-8). A Custom shape, a section property override or Lock: the current section only. Searched in the order of the objective; the first ${o.topN} that pass for every girder type of the span are listed.`), topic: { title: 'Sections searched' } });
    R.spans.forEach(sp => items.push(note(`Span ${sp.s}: ${plain(sp.why)}.`)));
    if (rowsS.length) items.push(tbl(['Span', 'Section', 'h (in)', 'A (in²)', 'Girder types', 'Result'], rowsS, { wide: true }));
    // strands and drape
    const gridTxt = name => { const g = window.PSBSections && window.PSBSections.rowGrid ? window.PSBSections.rowGrid(name) : null; return g ? `${plain(name)}: first row at ${fx(g.first, 2)} in, then every ${fx(g.step, 2)} in (PS-41)` : `${plain(name)}: first row at 2.00 in, then every 2.00 in`; };
    const selNames = [...new Set(R.spans.map(sp => { const c = sp.cands[(A.sel && A.sel[sp.s]) || 0]; return c ? c.name : null; }).filter(Boolean))];
    items.push({ ...note(o.vars.strands === 'lock' ? 'Strands locked: the entered straight rows and draped strands are kept; only the other variables were searched.'
      : `Straight rows bottom-up on the section's row grid (PS-41 for a MassDOT section; else 2 in, then every 2 in)${selNames.length ? ` — ${selNames.map(gridTxt).join('; ')}` : ''}. Each row is filled to its capacity before the next, in symmetric pairs (even counts, PS-12); the capacity of a row is the largest even count that fits (the input check's strand fit, PS-28); a row that holds fewer than 4 strands is not used (nor any row above it). Entered straight rows in the upper half of the girder (top strands) are kept as entered, at the same distance below the top of the section searched; entered debonding is kept row by row and never added (PS-12).`), topic: { title: 'Strand pattern rules' } });
    const fr = o.fracs && o.fracs.length ? o.fracs : AD.FRACS;
    items.push({ ...note(o.vars.drape === 'lock' ? 'Draped strands locked: the entered draped strands are kept.'
      : `Draped strands n$_{h}$ = 0, 2, 4, … in rows of two at x = ±1 in; at midspan directly above the top straight row (y$_{mid}$); at the girder end y$_{end}$ = y$_{mid}$ + 2 j in (on the 2 in grid), up to 2 in below the top; the bundle must fit at every height between them (1 in steps). Hold-down points at frac × L from ℄ bearing, frac ${fx(Math.min(...fr), 2)} to ${fx(Math.max(...fr), 2)} in steps of 0.01 (PS-5). For each n$_{h}$ the flattest drape that passes is taken; a drape that fails the hold-down force check ends the steeper ones of that n$_{h}$.`), topic: { title: 'Drape rules' } });
    // concrete strengths, per girder type of the run
    const own = new Set(), cRows = [];
    Object.keys(R.cur || {}).map(Number).sort((a, b) => a - b).forEach(k => { let C = null; try { C = AD.conc(Q, k, o); } catch (e) { C = null; } if (!C) return; own.add(C.owner);
      if (C.lock) { cRows.push([lab(k), C.owner, 'locked (as entered)', `${fx(C.fc[0], 1)} / ${fx(C.fciOf(C.fc[0])[0], 1)}`]); return; }
      const fi = C.fc.map(f => C.fciOf(f)).filter(q => q.length), fiLo = fi.length ? Math.min(...fi.map(q => q[0])) : NaN, fiHi = fi.length ? Math.max(...fi.map(q => q[q.length - 1])) : NaN;
      cRows.push([lab(k), C.owner, C.fc.length ? `${fx(C.fc[0], 1)} to ${fx(C.fc[C.fc.length - 1], 1)} (${C.fc.length} values)` : 'none', fi.length ? `${fx(fiLo, 1)} to ${fx(fiHi, 1)}` : 'none']); });
    const OR = window.PBD && window.PBD.OWN_RULES, ownTxt = [...own].filter(w => w !== 'AASHTO').map(w => { const rs = OR ? OR.rules.filter(r => r.owner === w && /^fci?\./.test(r.id)) : [];
      const v = r => r.id === 'fc.min' ? `f′c ≥ ${fx(r.value.min, 1)} ksi` : r.id === 'fc.max' ? `f′c ≤ ${fx(r.value.max, 1)} ksi` : r.id === 'fc.range' ? `f′c ${fx(r.value.min, 1)} to ${fx(r.value.max, 1)} ksi`
        : r.id === 'fc.std' ? `f′c ${r.value.std.map(x => fx(x, 1)).join(' or ')} ksi (searched between them)` : r.id === 'fci.max' ? `f′ci ≤ ${fx(r.value.max, 2)} f′c` : r.id === 'fci.range' ? `f′ci ${fx(r.value.min, 2)} to ${fx(r.value.max, 2)} f′c and ≤ ${fx(r.value.cap, 1)} ksi` : '';
      return `${w} (${(OR.owners[w] || {}).manual || w}): ${rs.map(r => `${v(r)} (${r.sec})`).filter(Boolean).join('; ')}`; });
    const set = ['fcLo', 'fcHi', 'fciLo', 'fciHi'].filter(q => isFinite(o[q]) && !(q === 'fciLo' && o[q] === AD.DEF.fciLo)).map(q => `${({ fcLo: 'f′c lowest', fcHi: 'f′c highest', fciLo: 'f′ci lowest', fciHi: 'f′ci highest (plant)' })[q]} ${fx(o[q], 1)} ksi`);
    items.push({ ...note(o.vars.conc === 'lock' ? 'f′c and f′ci locked: the entered values are kept.'
      : `f′c and f′ci on 0.5 ksi grids through the entered values (PS-11), f′ci ≤ f′c and from ${fx(o.fciLo, 1)} ksi. f′c from the owner's minimum to its maximum: AASHTO LRFD 10th Ed. Art. 5.4.2.1 sets a minimum of 4.0 ksi for prestressed concrete members and bases its provisions on strengths up to 10.0 ksi (4.0 to 10.0 ksi for an AASHTO project)${ownTxt.length ? `; the owner's limits (Owner rules tab): ${ownTxt.join(' — ')}` : ''}.${own.has('RIDOT') ? ' RIDOT 5.6.1 (f′ci about 0.70 f′c, a warning in the engine) is applied as a limit.' : ''}${set.length ? ` Limits entered on the Auto design input tab: ${set.join('; ')}.` : ''} The strand search is run at the entered f′c / f′ci first, then the entered f′c with the highest f′ci it allows, then the highest f′c and f′ci.`), topic: { title: 'f′c and f′ci grids and limits' } });
    if (cRows.length) items.push(tbl(['Girder type', 'Owner', 'f′c searched (ksi)', 'f′ci searched (ksi)'], cRows));
    items.push({ ...note(`The search assumes: a higher f′c or f′ci is not worse for any check; a higher y$_{end}$ relieves the girder end; the checks that more strands improve are ${AD.GROW.join(', ')}.`), topic: { title: 'Assumptions of the search' } });
    // the selected candidate of each span
    let first = true;
    R.spans.forEach(sp => {
      const c = sp.cands[(A.sel && A.sel[sp.s]) || 0], tp = first ? { topic: { title: 'Selected candidate and its governing check' } } : {}; first = false;
      if (!c) { items.push({ ...note(`Span ${sp.s}: no section passes every check for every girder type.${sp.blocked && sp.blocked.length ? ` Failing on the current design and on the closest trial of every section: ${sp.blocked.map(plain).join(', ')} (not changed by the variables searched).` : ''}`, true), ...tp }); return; }
      items.push({ ...note(`Span ${sp.s}: ${plain(c.name)} (candidate #${sp.cands.indexOf(c) + 1} of ${sp.cands.length}${A.kind === 'applied' ? ', applied' : ', shown'}).`), ...tp });
      c.types.forEach(({ k, res }) => { const b = res.best; if (!b) return; const gv = b.ev.gov;
        const rowsT = b.rows.map(r => `${r.n} at ${fx(+r.y, 2)} in${+r.nd > 0 ? ` (${r.nd} debonded ${fx(+r.dbnd, 1)} ft)` : ''}`).join(', ');
        items.push(kv([['Girder type', `${lab(k)} (span ${sp.s})`], ['Section', plain(b.girder)], ['Strands', `${b.N} (${b.nh} draped${b.nTop ? `, ${b.nTop} top strands kept` : ''}); straight rows ${rowsT}`],
          ['Draped strands', b.nh ? `y$_{end}$ ${fx(+b.harp.yEnd, 2)} in, y$_{mid}$ ${fx(+b.harp.yMid, 2)} in, hold-down at ${fx(+b.harp.frac, 2)} L${b.hd ? `; F$_{hd}$ / limit ${fx(b.hd.r, 3)} (G${b.hd.g})` : ''}` : 'none'],
          ['f′c / f′ci', `${fx(b.fc, 1)} / ${fx(b.fci, 1)} ksi (${plain(res.level || '')} searched first; ${res.trials} trials)`], ['Girder weight, the type\'s lines', `${fx(b.W, 1)} kip`],
          ['Governing check', gv ? `${plain(gv.n)}, ratio ${fx(gv.r, 3)} on G${gv.g} (${see(gv.n, k, gv.g)})` : '—']]));
        const by = {}; (b.ev.lines || []).forEach(l => l.R.checks.forEach(q => { const z = by[q.n]; if (!z || q.r > z.r) by[q.n] = { r: q.r, g: l.g, pass: q.pass }; }));
        items.push(tbl(['Check', 'Ratio (worst line)', 'Line', 'Status', 'Worked'], Object.entries(by).sort((x, y) => y[1].r - x[1].r)
          .map(([n, z]) => ({ cells: [plain(n), { t: fx(z.r, 3), n: true, cls: z.pass ? (z.r >= 0.9 ? 'hi' : 'ok') : 'ng' }, `G${z.g}`, { t: z.pass ? 'PASS' : 'FAIL', cls: z.pass ? 'ok' : 'ng' }, see(n, k, z.g)], cls: gv && n === gv.n ? 'gov' : '' })), { wide: true }));
      });
    });
    items.push(note(`Worked: each check is worked at the step named, for the inputs the report works (${A.kind === 'applied' && !A.stale ? 'the applied candidate' : 'the current inputs, not the candidate'}); a girder type the report does not work: its result tab with that type chosen. Ratio = demand / limit, OK ≤ 1.0.`));
    return out(items);
  }
  /* planFig(P, X): 2026-11-14 (PS Bridge catch-up, item 4): the framing plan of the Bridge layout tab and the Summary (ui/plan.js, its own
     drawing, true scale; opt.planFig = { svg (the screen and the printed copies, as the tabs' figures), cap } from ui/report.js) as a figure
     of §2, and where the cross-section of the span is drawn (the Loads & LLDF section's figure, "see §"). Display only; none in Node. */
  function planFig(P, X) {
    const f = X.planFig; if (!f || !f.svg) return [];
    return [{ type: 'figure', caption: 'Framing plan: girder lines, skewed supports and diaphragms (true scale; the Bridge layout tab and the Summary)', svg: f.svg },
      note(`${f.cap || ''} The cross-section of each worked girder's span, with the girder sections, barriers and d$_{e}$: see [[${X.inReport('lds') ? 'rs.lds' : 'tab:lds|Loads & LLDF tab'}]].`)];
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

  /* secNotes(B): PS-31 (engineer decision 2026-11-14): the project used one of the old library's box beams or voided deck slabs and was
     migrated on open to the corrected standard section (engine/sections.js; old values kept in P.legacySection): one assumption per base
     design / girder type, "section corrected: old A / I / y_b -> new" (or the section removed), with the Section properties reference. */
  function secNotes(B) {
    const SC = window.PSBSections; if (!SC) return [];
    return SC.items(B.P).map(it => note(`• ${SC.text(it).replace(/y_b/g, '$y_b$')} (see [[rs.sec]])`));
  }
  /* voidNotes(B): 2026-11-14 (decision pending engineer review): for each shape of the report with voids (a box beam, a voided deck slab: the
     design girder and every girder type on a line), where the void is (the Section properties tab's note, ui/section.js voidNote: the
     engine's sectionVoids position, as drawn); none for shapes without voids */
  function voidNotes(B) {
    const SU = window.PSBUiSection, BR = window.PSBBridge, DS = window.PSBDesign; if (!SU || !SU.voidNote) return [];
    const gs = [[B.inp.girder, B.R.g]];
    if (BR && BR.hasTypes(B.P) && DS) BR.types(B.P).forEach((T, k) => { const l = BR.typeLines(B.P, k); if (!l.length) return;
      try { const i = DS.cellInputs(B.P, k, l[0]); gs.push([i.girder, girderGross(i)]); } catch (e) { /* its own input errors */ } });
    const seen = new Set();
    return gs.filter(([n]) => !seen.has(n) && seen.add(n)).map(([n, g]) => [n, SU.voidNote(g)]).filter(([, t]) => t)
      .map(([n, t]) => note(`• ${plain(n)}: ${t.replace(/<sub>(.*?)<\/sub>/g, '$_{$1}$').replace(/&lt;/g, '<')} (see [[rs.sec]])`));
  }

  /* rowNotes(B): PS-41 (engineer decision 2026-11-14): for each 48 in MassDOT box beam of the report (the design girder and every girder type on
     a line), the flag that its default strand pattern is extrapolated from the 36 in strand sheet (engine/sections.js extrapText) */
  function rowNotes(B) {
    const SC = window.PSBSections, BR = window.PSBBridge, DS = window.PSBDesign; if (!SC || !SC.extrapText) return [];
    const ns = [B.inp.girder];
    if (BR && BR.hasTypes(B.P) && DS) BR.types(B.P).forEach((T, k) => { const l = BR.typeLines(B.P, k); if (!l.length) return;
      try { ns.push(DS.cellInputs(B.P, k, l[0]).girder); } catch (e) { /* its own input errors */ } });
    return [...new Set(ns)].map(n => [n, SC.extrapText(n)]).filter(([, t]) => t).map(([n, t]) => note(`• ${plain(n)}: ${t} (see [[rs.sec]])`));
  }
  /* tbcNotes(B): PR A (engineer request 2026-11-14): for each standard box beam / voided slab of the CTDOT plates in the report (the design
     girder and every girder type on a line), the "to be confirmed" note of the Girders & strands tab (engine/sections.js tbcNote) */
  function tbcNotes(B) {
    const SC = window.PSBSections, BR = window.PSBBridge, DS = window.PSBDesign; if (!SC || !SC.tbcNote) return [];
    const ns = [B.inp.girder];
    if (BR && BR.hasTypes(B.P) && DS) BR.types(B.P).forEach((T, k) => { const l = BR.typeLines(B.P, k); if (!l.length) return;
      try { ns.push(DS.cellInputs(B.P, k, l[0]).girder); } catch (e) { /* its own input errors */ } });
    return [...new Set(ns)].map(n => [n, SC.tbcNote(n)]).filter(([, t]) => t)
      .map(([n, t]) => note(`• ${plain(n)}: ${t.replace(/<sub>(.*?)<\/sub>/g, '$_{$1}$')} (see [[rs.sec]])`));
  }

  /* fgNotes(B): PS-35 (engineer decision 2026-11-14): a box beam / voided slab design: its live-load distribution is AASHTO type (f) / (g),
     with the J used and its source and any limit of applicability outside which the equations were used (the Loads & LLDF section works it) */
  function fgNotes(B) {
    const f = B.R && B.R.df && B.R.df.fg; if (!f) return [];
    const src = f.Jsrc === 'user' ? 'user/DOT value' : f.Jsrc === 'library' ? 'library (DOT) value' : 'computed from outline';
    const fx = (v, d) => (+v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    return [note(`• Live-load distribution (PS-35${B.R.g.box && B.R.g.box.solid ? ', PS-36' : ''}): ${window.PSBLldfFG ? window.PSBLldfFG.kindOf(B.R.g) : 'box beam'}, AASHTO LRFD 10th Ed. cross-section type (${f.type}) of Table 4.6.2.2.1-1 (Tables 4.6.2.2.2b-1, 4.6.2.2.2d-1, 4.6.2.2.3a-1, 4.6.2.2.3b-1; skew 4.6.2.2.2e, 4.6.2.2.3c), not the I-girder type (k) of the old app; I = ${fx(f.I, 0)} in⁴ (${f.Isrc === 'composite' ? 'composite section' : 'girder'}), J = ${fx(f.J, 0)} in⁴ (${src}).${f.out.length ? ` Outside the range of applicability: ${f.out.map(o => o.text).join('; ')}.` : ''} (see [[rs.lds]])`, !!f.out.length)];
  }

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

  /* the References of the front matter (2026-11-15, batch A): the articles the report's worked steps cite (each step's ref, every worked unit),
     as the old app's References table listed its articles; the PCI Design Handbook for the camber multipliers (the Camber & deflection steps);
     handling named as what is computed: the Mast form of the lateral deflection z_o, the factors of safety a simplified screening (not the
     PCI (2016) / Mast method, as the Handling tab says). Display only: the text of the citations, no value. */
  const artKey = a => a.replace(/^C/, '').split('.').map(q => { const m = /^(\d+)([a-zA-Z]*)$/.exec(q); return m ? [+m[1], m[2]] : [0, q]; });
  const artCmp = (a, b) => { const x = artKey(a), y = artKey(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { if (!x[i]) return -1; if (!y[i]) return 1; if (x[i][0] !== y[i][0]) return x[i][0] - y[i][0]; if (x[i][1] !== y[i][1]) return x[i][1] < y[i][1] ? -1 : 1; } return a < b ? -1 : a > b ? 1 : 0; };
  function citedArts(B, re) {   // the article numbers (C: commentary) in the steps' refs that match re (equation / table suffixes -n dropped)
    const out = new Set(), Ws = [B.W].concat((B.multi && B.units ? B.units : []).map(u => u.W));
    Ws.forEach(W => Object.values(W || {}).forEach(w => ((w && w.steps) || []).forEach(s => { const r = String(s.ref || ''); if (!re.test(r)) return;
      r.replace(re, '').replace(/\([^)]*\)/g, '').split(/[,;]/).forEach(t => { const m = /(C?\d+[A-Z]?(?:\.\d+[a-z]?)+)/.exec(t.replace(/(Art|Eqs?|Tables?)\.?/g, '')); if (m) out.add(m[1].replace(/-\d+$/, '')); }); })));
    return [...out].sort(artCmp);
  }
  const refsOf = B => { const hn = ((B.W && B.W.handling && B.W.handling.steps) || []).length > 0, aa = citedArts(B, /^AASHTO LRFD 10th Ed\.?|^AASHTO LRFD 10th Ed\. \(2024\)( Art\.)?/), mb = citedArts(B, /^MBE( Eq\.)?/), cam = Object.values(B.W || {}).some(w => ((w && w.steps) || []).some(s => /PCI Design Handbook/.test(s.ref || '')));
    return [['AASHTO LRFD', `AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024). Articles cited in the worked steps${aa.length ? ': ' + aa.join('; ') : ''} (each step names its article, equation or table).`],
      ['MBE', `AASHTO Manual for Bridge Evaluation, LRFR (Section 6, Part A)${mb.length ? ': ' + mb.join('; ') : ''}. The article numbers are the old app's labels (the MBE 4th Ed. (2026) labels come in their own change).`],
      ...(cam ? [['PCI', 'PCI Design Handbook: the long-term camber multipliers (Camber & deflection; the multipliers entered on the Materials tab). Edition not stated by the old app: verify.']] : []),
      ...(hn ? [['Handling', 'Lateral stability by a simplified screening of the old app: the lateral deflection z_o uses the Mast expression; the factors of safety are not the PCI (2016) / Mast method (Handling tab).']] : []),
      ...(B.inp.owner && B.inp.owner !== 'AASHTO' && window.PBD ? [[B.inp.owner, window.PBD.OWN_RULES.owners[B.inp.owner].manual]] : [])]; };

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
    const X = { vals, inReport: t => !!TABS[t] && on(t), ownKey: own && on('proj') ? 'rs.own' : null, figs: opt.figures || null, planFig: opt.planFig || null };   // planFig (2026-11-14): §2's framing plan (ui/report.js); rs.own: the owner rules subsection of §2
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
    // ADB (2026-11-15): §2's last subsection, the Auto design basis (built last: its "see §" links go to the steps of the sections shown)
    { const ps = secs.find(q => q.id === 'proj'); if (ps) { try { ps.subs.push(adSub(B, X, opt.autodesign || null, secs)); } catch (e) { ps.subs.push({ ...sub('adb', 'Auto design basis', [note('Report error: ' + (e && e.message), true)]), key: AD_KEY }); } } }
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
