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
   sh., ez., cb., hn., dk., rt.), key = the step id, so a step note "§<id>" of one tab finds its step in another; section keys 'rs.<tab>'.
   2026-11-23 (the steel report's features; display only): the Executive summary (first), the Basis of design (after the project section),
   the Bill of materials and the Sign-off (last), and a design-point header in the result sections: see "Report package" below. The bill of
   materials' quantities and the header's x/L are worked there from engine values and entered dimensions; they are not engine results. */
(function () {
  'use strict';
  const SECTIONS = [['exec', 'Executive summary'], ['sum', 'Summary of checks'], ['proj', 'Project, basis and assumptions'], ['basis', 'Basis of design'], ['sec', 'Section properties'], ['lds', 'Loads & LLDF'], ['an', 'Analysis'],
    ['loss', 'Prestress losses'], ['str', 'Stresses'], ['flex', 'Flexure'], ['shear', 'Shear'], ['end', 'End zone & hold-down'], ['camb', 'Camber & deflection'],
    ['hand', 'Handling'], ['deck', 'Deck'], ['rt', 'Rating'], ['bom', 'Bill of materials'], ['sign', 'Sign-off & revisions']];   // exec, basis, bom, sign: 2026-11-23 (the steel report's sections)
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
    if (RT && R.rating && RT.rf === RT.ENG) {
      const rf = RT.rf.map(([n, f, st]) => ({ n, v: f(R), st })), pth = { 'rt.RFinv': 'rating.RFinv', 'rt.RFvInv': 'shrRating.RFinv', 'rt.RFs3': 'svcRating.RF' };
      items.push(tbl(['HL-93 inventory rating factor', 'RF', 'Worked'], rf.map(z => [z.n, z.v >= 99 ? { t: '—', n: true } : { t: V(pth[z.st], 3), n: true, cls: z.v < 1 ? 'ng' : 'ok' }, `see [[${z.st}]]`])),   // 99: the engine's "not applicable", shown — as on the Rating tab (2026-11-15)
        note('Rating factors are not design checks and are not counted in the PASS / FAIL above (RF ≥ 1.0 is OK; — = not applicable, e.g. no live-load tension at the Service III section).'));
    } else if (RT && R.rating) {
      // E1 (2026-11-15): the lowest RF of each group over every station (engine/rating-along.js, worked in the Rating section's "along the
      // girder" steps), and beside it the engine's own rating at its governing section, as before (the same recorded values)
      const A = window.PSBRatingAlong.of(R), KIND = ['flexP', 'flexN', 'shear', 's3'], EI = [0, null, 1, 2], fx = (v, d) => (typeof v === 'number' && isFinite(v) ? v.toFixed(d) : '—');
      const rows = RT.rf.map(([n, f, st], j) => ({ n, v: f(R), st, q: A && A.gov[KIND[j]], e: EI[j] == null ? null : RT.ENG[EI[j]] })).filter(z => typeof z.v === 'number');
      const eCell = z => { if (!z.e) return { t: '—', n: true }; const v = z.e[1](R); return v >= 99 ? { t: '—', n: true } : { t: V(z.e[3](), 3), n: true, cls: v < 1 ? 'ng' : 'ok' }; };
      items.push(tbl(['HL-93 inventory rating factor', 'Lowest RF along the girder', 'x (ft)', 'RF at the engine\'s section (before E1)', 'Worked'],
        rows.map(z => [z.n, { t: fx(z.v, 3), n: true, cls: z.v < 1 ? 'ng' : 'ok' }, { t: z.q ? fx(z.q.x, 2) : '—', n: true }, eCell(z), `see [[${z.st}]]`])),
        note('Rating factors are not design checks and are not counted in the PASS / FAIL above (RF ≥ 1.0 is OK; — = not applicable or not rated there). The lowest RF of each group is over every analysis station of the girder (MBE 4th Ed. (2026) Art. 6A.4.2.1: the lowest rating factor of the limit states and load effects governs); the column beside it is the engine\'s own rating at its governing section (flexure: the same stations; shear: the section where V_u/φV_n is greatest; Service III: the section of the largest bottom tension), kept for comparison.'));
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
    if (X.u == null) { const el = elevSub(X); if (el) subs.splice(1, 0, el); }   // 2026-11-15 (batch C): the Summary's girder elevations (one worked girder; several: after the tables)
    if ((R.warns || []).length) subs.push(sub('warn', `Design warnings of the engine (${R.warns.length})`, R.warns.map(w => note(plain(w), true))));
    return { title: 'Summary of checks', subs };
  }

  /* elevSub(X): 2026-11-15 (batch C; the steel report's §1 summary figure): the Summary tab's girder elevation of each girder type on its
     governing line (opt.sumFig from ui/report.js; none in Node), each check where it governs, as figures with the list of the checks drawn */
  function elevSub(X) {
    const F = X.sumFig; if (!F || !F.length) return null;
    return sub('el', 'Girder elevations: where each check governs', [].concat(...F.map(f => [{ type: 'figure', caption: f.cap, svg: f.svg }, note(`Drawn: ${plain(f.list)}.`)])),
      note('The Summary tab\'s elevation of each girder type (the [[tab:sum|Summary tab]]): the strands, the transfer and development lengths and the governing check of each check group at its station, coloured by its ratio (green below 0.90, amber 0.90 to 1.00, red above 1.00). Each check is worked in the section of its group.'));
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
    'Rating: LRFR design-load rating (HL-93) at every analysis station of the girder (MBE 4th Ed. (2026) Art. 6A.4.2.1, the lowest rating factor governs): flexure in positive moment (a dead-load part that relieves the positive moment, near an interior support, with the LRFD minimum load factor DC 0.90 / DW 0.65, AASHTO LRFD 10th Ed. Table 3.4.1-2: engineer decision E1-D5, 2026-11-21), flexure in negative moment over an interior support (continuity on: the pier section of the continuity check, deck bars in tension, over the half span next to the support; a dead load that relieves the negative moment with the LRFD minimum load factor), shear from the critical section (C = φ_c φV_n: φ_s = 1.0 for shear, MBE 4th Ed. Art. 6A.4.2.4, engineer decision E1-D4, 2026-11-21; flexure keeps φ_c φ_s), and Service III bottom tension (inventory only, MBE 4th Ed. C6A.5.4.1). No restraint moments in the rating (MBE 4th Ed. Art. 6A.5.10). The engine\'s own rating at its governing sections is kept beside it; its MBE citations are the article numbers the old app uses (the MBE 4th Ed. labels of those cards are a separate change, plan PR 6, PS-14 e) (see [[rs.rt]]).',
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
        ['Owner', ownR ? `${own} (${ownR.manual})` : own]]), note('Entered values (Project, Bridge layout, Cross-section and Girders & strands tabs); the engine inputs of the design girder are those of the [[tab:in:gird|Girders & strands tab]].'), ...planFig(P, X), ...snapFig(P, X)]),
      sub('c', 'Basis', [kv([['Design specification', ED], ['Load rating', 'AASHTO Manual for Bridge Evaluation (MBE), LRFR; article numbers as the old app'], ['Owner manual', ownR && !ownR.none ? `${ownR.manual} (AASHTO LRFD ${ownR.aashto} basis); its rules as listed below` : 'none (AASHTO only)'],
        ['Units', 'in, kip, ksi, ft, klf, kip-ft'], ['Sign convention', 'stresses + compression, − tension; moments + sagging']])]),
      { ...sub('a', 'Assumptions', [...(asm ? asm.items : []), ...ASSUME.map(t => note('• ' + t)), ...deNote(P), ...voidNotes(B), ...tbcNotes(B), ...rowNotes(B), ...fgNotes(B), ...secNotes(B)]), key: 'rs.asm' }];   // rs.asm (2026-11-23): the Basis of design section links here
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
    let tn = 0; items.forEach(it => { if (it.topic) it.topic.no = ++tn; });   // the topics numbered 1, 2, … (the viewer's topic sub-headings)
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
  /* snapFig(P, X): batch G8 (2026-11-15): the 3D view captured on the 3D view tab ("Capture for the Report", the old app's 3D snapshot in its
     report, O:5090), opt.snap3d = { png (a data URL), at, key (the project when captured), meta } from ui/report.js (this page view only), a
     figure of §2 after the framing plan; a note when the inputs changed after the capture. Display only; none in Node unless given. */
  function snapFig(P, X) {
    const f = X.snap3d; if (!f || !/^data:image\/png;base64,/.test(String(f.png || ''))) return [];
    const noHo = t => { try { const o = JSON.parse(t); delete o.handoffs; return JSON.stringify(o); } catch (e) { return t; } };   // HO-D2: a send (P.handoffs) is not an input change
    const stale = f.key && noHo(f.key) !== noHo(JSON.stringify(P));
    return [{ type: 'figure', caption: `3D view (captured on the 3D view tab, ${f.at || ''}): ${f.meta || ''}`, svg: `<img src="${f.png}" alt="3D view of the bridge" style="width:100%;max-width:7.3in;height:auto;display:block">` },
      note(stale ? 'Captured before the last input change: capture again on the [[tab:3d|3D view tab]] for the inputs this report works.' : 'Display only: the girders, deck, supports and the reinforcement layers chosen on the [[tab:3d|3D view tab]] when it was captured.', !!stale)];
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
    const html = U.output({ P: B.P, inp: B.inp, R: B.R, W: B.W, ui: X.every ? { every: true } : {} });   // ui.every (2026-11-15, batch C): the Report's "every station" detail   // ui {}: each chooser at its default (the governing / midspan station)
    const C = FT.cards(html, { tab: k, X, sec: k, inReport: X.inReport, figs: X.figs && X.figs[k] });   // figs: the tab's own graphics at their slots (ui/report.js)
    const subs = [], gTop = C.top.filter(i => i.type === 'figure'), nTop = C.top.filter(i => i.type !== 'figure');
    if (gTop.length) subs.push(sub('g', 'Graphics', gTop));
    if (nTop.length) subs.push(sub('n', 'Notes', nTop));
    C.subs.forEach((s, j) => {
      if (s.steps) { const W = (B.W[wk] || { steps: [] }).steps; if (W.length) subs.push(sub('w', 'Worked steps', [...s.items, gsteps('', W, U.TOPICS)])); return; }
      subs.push(sub('c' + j, s.title || '—', s.items.length ? s.items : [note('—')]));
    });
    // 2026-11-23: the design-point header (each check of the section at its station, with the strand context there), before the worked steps
    { let pt = null; try { pt = ptSub(B, k); } catch (e) { pt = null; } if (pt) { const i = subs.findIndex(q => q.id === 'w'); subs.splice(i < 0 ? subs.length : i, 0, pt); } }
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
      ['MBE', `AASHTO Manual for Bridge Evaluation, LRFR (Section 6, Part A)${mb.length ? ': ' + mb.join('; ') : ''}. The rating at every station cites the MBE 4th Ed. (2026); the engine's own rating cards keep the old app's article labels (their MBE 4th Ed. labels come in their own change).`],
      ...(cam ? [['PCI', 'PCI Design Handbook: the long-term camber multipliers (Camber & deflection; the multipliers entered on the Materials tab). Edition not stated by the old app: verify.']] : []),
      ...(hn ? [['Handling', 'Lateral stability by a simplified screening of the old app: the lateral deflection z_o uses the Mast expression; the factors of safety are not the PCI (2016) / Mast method (Handling tab).']] : []),
      ...(B.inp.owner && B.inp.owner !== 'AASHTO' && window.PBD ? [[B.inp.owner, window.PBD.OWN_RULES.owners[B.inp.owner].manual]] : [])]; };

  /* ---------- Report package (2026-11-23, engineer's request: the Steel Bridge report's features, apps/steel-bridge/report/builders.js exec /
     basis / bom / sign / ptHead, PRs #1645; display only) ----------
     exec: the Executive summary (first section): the verdict banner by the Summary tab's rule (ui/summary.js verdict: FAIL where a check does
       not pass, REVIEW where every check passes but a ratio is not a finite number, else PASS; counted once per girder type and check, its
       worst line), the governing D/C, one row per check group with the governing girder type, line and station and a "see §" link to the
       step that works it (the unit of this report that works that type; else its section, else the result tab), and the items not included
       in the verdict (rating factors, groups switched off, lines with no girder type, engine errors and warnings, LLDF outside its range).
     basis: Basis of design: specification, materials, resistance factors, load combinations with their factors and η, IM, the analysis and
       loss methods, the owner rules in effect; the assumptions stay in "Project, basis and assumptions" (key rs.asm), linked from here.
     bom: Bill of materials: girder concrete and weight, strands, the mild steel the app checks (stirrups, splitting, confinement), deck and
       haunch concrete, deck bars where the deck is designed; each quantity worked in its note; what is not known is listed "not included".
     sign: Sign-off and revision history (the project's title-block fields; the rest blank lines to fill in by hand; no saved field added).
     ptSub: the design-point header of a result section: each check of the section at its station with the span, x/L and the strand context
       (transfer and development lengths, debonded rows, hold-down points, stirrup zone).
     Every engine value written here is read from the same engine results as the tabs (B.R, B.units[].R, B.all.cells[].R) and recorded in
     model.vals (recOf: u = the worked unit, cell = 'k|g' for a line the report does not work in full); the bill of materials' quantities
     (volumes, lengths, weights, bar counts) and the header's x/L are worked here from those values and the entered dimensions and are not
     engine results: no check, ratio or verdict uses them. */
  const fin = v => typeof v === 'number' && isFinite(v), badR = x => typeof x !== 'number' || isNaN(x);
  const worse = (a, b) => (badR(a) && !badR(b)) || (!badR(a) && !badR(b) && a > b);   // ui/summary.js worse: a ratio that is not a number first, then the larger
  const stQ = q => (!q.pass ? 'FAIL' : !fin(q.r) ? 'REVIEW' : 'PASS');
  const SW = 490 / 144;   // steel 490 pcf: lb/ft per in² of bar or strand
  const lk = key => (key ? { t: '', key } : '—');
  /* banner(t, sub2): the verdict as a print-safe SVG box (black on white: the border weight and the word carry the status), as the steel report's */
  const banner = (t, sub2) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 74" width="100%" role="img" aria-label="${t}"><rect x="2" y="2" width="636" height="70" fill="#fff" stroke="#000" stroke-width="${t === 'PASS' ? 2 : 5}"${t === 'REVIEW' ? ' stroke-dasharray="14 6"' : ''}/><text x="320" y="40" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700" fill="#000">${t}</text><text x="320" y="62" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="12" fill="#000">${sub2}</text></svg>`;
  /* recOf(B, X, sec): rec(z, path, d, div) writes the engine value at path of z's result and records it; z = { k, g, R } (k null: the design
     girder). rec.chk(z, name, field, d): a field of the check named, in the result the value is read from. */
  function recOf(B, X, sec) {
    const src = z => { const e = {}; let R = z.R;
      if (z.k != null) {
        if (B.multi) { const j = B.units.findIndex(u => u.k === z.k && u.g === z.g); if (j >= 0) { e.u = j; R = B.units[j].R; } else e.cell = `${z.k}|${z.g}`; }
        else if (B.cell && (B.cell.k !== z.k || B.cell.g !== z.g)) e.cell = `${z.k}|${z.g}`;
        else R = B.R;
      }
      return { e, R }; };
    const rec = (z, path, d, div) => { const { e, R } = src(z), v = at(R, path); if (typeof v !== 'number') return '—'; const text = OK().fx(div ? v / div : v, d); X.vals.push({ sec, path, d, div: div || 0, text, ...e }); return text; };
    rec.chk = (z, name, f, d) => { const i = src(z).R.checks.findIndex(q => q.n === name); return i < 0 ? '—' : rec(z, `checks.${i}.${f}`, d); };
    return rec;
  }
  const whoOf = B => z => (z.k != null ? `${plain(z.label)} on G${z.g}, span ${z.s}` : `design girder ${plain(B.inp.proj && B.inp.proj.girderId)}, span ${z.s}`);
  /* seeOf(B, X, keys): where a check of group gp (step st) of girder type k on line g is worked in this report: the step of the unit that
     works that type (that line in "every line"), else that unit's section, else the result tab (the type to choose there named) */
  function seeOf(B, X, keys) {
    return z => {
      const gp = z.gp;
      if (gp.input) return X.ownKey && keys.has(X.ownKey) ? `see [[${X.ownKey}]]` : `[[tab:in:${gp.tab}|${plain(gp.name)}]] (Owner rules tab)`;
      let key = null, sk = null, ln = '';
      if (B.multi) { const j = B.units.findIndex(u => u.k === z.k && (B.mode !== 'all' || u.g === z.g)); if (j >= 0) { key = `u${j}/${z.st}`; sk = `rs.${gp.tab}@u${j}`; if (B.units[j].g !== z.g) ln = ` (worked for G${B.units[j].g})`; } }
      else if (z.k == null || !B.cell || B.cell.k === z.k) { key = z.st; sk = 'rs.' + gp.tab; if (z.k != null && B.cell && B.cell.g !== z.g) ln = ` (worked for G${B.cell.g})`; }
      return key && keys.has(key) ? `see [[${key}]]${ln}` : sk && keys.has(sk) ? `see [[${sk}]]${ln}` : `[[tab:${gp.tab}|${plain(gp.name)} tab]]${z.k != null ? `, type ${plain(z.label)} on G${z.g} chosen` : ''}`;
    };
  }
  /* execRows(B): the Summary tab's values (ui/summary.js model, every girder type × line) or, with no girder types (one design girder), the
     same choices over its own checks: one row per check group (its governing check), the counts, the governing check and the lowest RF */
  function execRows(B) {
    const DU = window.PSBDashUI, SU = window.PSBSummaryUI, GR = (DU && DU.GROUPS) || [], RT = DU && DU.RATING;
    if (B.all && SU) {
      const SM = SU.model(B.P, B.all), rows = [], cellOf = (k, g) => B.all.cells.find(c => c.k === k && c.g === g);
      SM.used.forEach(gp => { let b = null; SM.types.forEach(T => { const z = T.groups[gp.id]; if (z && (!b || worse(z.q.r, b.q.r))) b = z; });
        if (b) { const c = cellOf(b.k, b.g); rows.push({ gp, q: b.q, st: b.st, k: b.k, g: b.g, s: c.s, label: c.label, R: c.R }); } });
      const top = SM.top ? { gp: SM.top.gp, q: SM.top.c, st: SM.top.st, k: SM.top.cell.k, g: SM.top.cell.g, s: SM.top.cell.s, label: SM.top.cell.label, R: SM.top.cell.R } : null;
      const lc = SM.low && cellOf(SM.low.k, SM.low.g), low = lc ? { gp: RT, n: SM.low.n, v: SM.low.v, st: SM.low.st, path: SM.low.path, k: lc.k, g: lc.g, s: lc.s, label: lc.label, R: lc.R } : null;
      return { rows, nF: SM.nF, nR: SM.nR, nP: SM.nP, top, low, off: SM.off, errs: SM.cells.filter(z => z.err).map(z => z.c),
        what: `${B.all.types.length} girder type${B.all.types.length > 1 ? 's' : ''} on ${B.all.n} girder line${B.all.n > 1 ? 's' : ''}`, per: 'one count per girder type and check, its worst line' };
    }
    const R = B.R, rows = [], me = { k: null, g: null, s: B.sel.s, label: null, R }; let nF = 0, nR = 0, nP = 0, top = null;
    GR.forEach(gp => { const all = gp.checks.map(([n, st]) => { const c = R.checks.find(q => q.n === n); return c ? { c, st } : null; }).filter(Boolean); if (!all.length) return;
      all.forEach(z => { if (!z.c.pass) nF++; else if (!fin(z.c.r)) nR++; else nP++; if (!top || worse(z.c.r, top.q.r)) top = { gp, q: z.c, st: z.st, ...me }; });
      const b = all.reduce((b0, z) => (!b0 || worse(z.c.r, b0.c.r) ? z : b0), null); rows.push({ gp, q: b.c, st: b.st, ...me }); });
    const lw = RT && R.rating ? RT.rf.map(([n, f, st, p]) => ({ n, v: f(R), st, path: p ? p(R) : null })).filter(z => typeof z.v === 'number' && z.v < 99).reduce((b, z) => (!b || z.v < b.v ? z : b), null) : null;
    return { rows, nF, nR, nP, top, low: lw ? { gp: RT, ...lw, ...me } : null, off: GR.filter(gp => gp.off && !rows.some(r => r.gp === gp)), errs: [], what: 'the design girder', per: 'one count per check of the design girder' };
  }
  function exec(B, X, secs) {
    const E = execRows(B), keys = keysOf(secs), rec = recOf(B, X, 'exec'), who = whoOf(B), see = seeOf(B, X, keys), fx = OK().fx, BR = window.PSBBridge, GR = (window.PSBDashUI && window.PSBDashUI.GROUPS) || [];
    const verdict = E.nF ? 'FAIL' : E.nR ? 'REVIEW' : 'PASS';
    const loc = z => (z.gp.input ? 'Owner rules (no station)' : z.gp.id === 'deck' ? 'deck design strip' : `x = ${rec.chk(z, z.q.n, 'loc', 2)} ft`);
    const rows = E.rows.map(z => ({ cells: [z.gp.name, plain(z.q.n), who(z), loc(z), { t: rec.chk(z, z.q.n, 'r', 3), n: true, cls: !z.q.pass ? 'ng' : z.q.r >= 0.9 ? 'hi' : 'ok' }, { t: stQ(z.q), cls: z.q.pass ? 'ok' : 'ng' }, see(z)], cls: z.q.pass ? '' : 'gov' }));
    // not included in the verdict
    const out = [], worked = B.multi ? B.units.map(u => ({ k: u.k, g: u.g, s: u.s, label: u.label, R: u.R })) : [B.cell && B.all ? { k: B.cell.k, g: B.cell.g, s: B.cell.s, label: B.P.types[B.cell.k].label, R: B.R } : { k: null, g: null, s: B.sel.s, label: null, R: B.R }];
    if (E.low) { const z = E.low; out.push([`Load rating: lowest HL-93 inventory rating factor (${plain(z.n)})`, z.v >= 1 ? 'RF ≥ 1' : 'RF < 1', `RF ${z.path ? rec(z, z.path, 3) : fx(z.v, 3)}, ${who(z)}; a rating factor is not a design check`, see(z)]); }
    E.off.forEach(gp => out.push([`${gp.name} checks`, 'off', 'switched off for this project: no check made', '—']));
    if (BR && BR.hasTypes && BR.hasTypes(B.P)) { const un = BR.unassigned(B.P); if (un.length) out.push(['Girder lines with no girder type', 'not checked', un.map(q => `G${q.g}/S${q.s}`).join(', '), '[[tab:in:gird|Girders & strands tab]]']); }
    E.errs.forEach(c => out.push([`${plain(c.label)} on G${c.g}, span ${c.s}`, 'engine error', `not computed: ${plain(c.R && c.R.error)}`, '—']));
    worked.forEach(z => {
      const R = z.R;
      R.checks.filter(c => !GR.some(gp => gp.checks.some(([n]) => n === c.n))).forEach(c => out.push([`${plain(c.n)} (${who(z)})`, c.pass ? 'PASS' : 'FAIL', 'a check in no group of the check summary: listed in the Summary of checks', keys.has('rs.sum') ? 'see [[rs.sum]]' : '—']));
      if (R.df && R.df.fg && R.df.fg.out && R.df.fg.out.length) out.push([`Live-load distribution outside its range of applicability (${who(z)})`, 'NOTE', R.df.fg.out.map(o => plain(o.text)).join('; '), see({ gp: { tab: 'lds', name: 'Loads & LLDF' }, st: 'ld.dfm', k: z.k, g: z.g, label: z.label })]);
      if (R.handling) out.push([`Hauling stresses (${who(z)})`, 'not checked', 'shown for comparison; impact during transport is not included', see({ gp: { tab: 'hand', name: 'Handling' }, st: 'hn.lift.r', k: z.k, g: z.g, label: z.label })]);
      (R.warns || []).forEach(w => out.push([`Design warning of the engine (${who(z)})`, 'Warning', plain(w), '—']));
    });
    const top = E.top, items = [
      { type: 'figure', svg: banner(verdict, `${E.what}: ${E.nF} FAIL, ${E.nR} REVIEW, ${E.nP} PASS (${E.per})`), caption: 'Verdict, by the rule of the Summary tab: FAIL where a check does not pass (ratio = demand / limit over 1.0; PASS when ≤ 1.0001, the engine\'s rule); REVIEW where every check passes but a ratio is not a finite number; else PASS.' },
      top ? note(`Governing D/C: ${rec.chk(top, top.q.n, 'r', 3)} (${top.gp.name}: ${plain(top.q.n)}; ${who(top)}${top.gp.input || top.gp.id === 'deck' ? '' : `, x = ${rec.chk(top, top.q.n, 'loc', 2)} ft`}), ${see(top)}.`, E.nF > 0) : note('No check was made.', true),
      tbl(['Limit state / check group', 'Governing check', 'Girder type, line', 'Location', 'D/C', 'Status', 'Worked'], rows, { wide: true, caption: 'One row per check group: its governing check over every girder type and line checked (the largest ratio), where it governs, and the step of this report that works it' }),
      out.length ? tbl(['Not included in the verdict', 'Status', 'Value', 'Worked'], out, { wide: true }) : note('Not included in the verdict: none.'),
      note(`Items not included in the verdict are listed so that this summary never reads as all-pass while something is open: rating factors are not design checks (RF ≥ 1.0 is OK), a check group switched off makes no check, a girder line with no girder type is not checked, and the engine's warnings are for review.${B.all ? ' The same verdict, counts and values, with every girder type and line: the [[tab:sum|Summary tab]].' : ''}${keys.has('rs.sum') ? ' Every check with its demand and limit: [[rs.sum]].' : ''}`)];
    return { title: 'Executive summary', subs: [sub('v', `Verdict: ${E.what}`, items)] };
  }
  /* basis(B, X, secs): the values are those of the first worked girder (the design girder); a "see §" link where this report writes the step */
  function basis(B, X, secs) {
    const u0 = B.multi ? B.units[0] : null, inp = u0 ? u0.inp : B.inp, R = u0 ? u0.R : B.R, Wk = (u0 ? u0.W : B.W) || {}, P = B.P, keys = keysOf(secs), fx = OK().fx;
    const k = id => { const key = u0 ? `u0/${id}` : id; return keys.has(key) ? key : null; };
    const V = (p, d, div) => (typeof at(R, p) === 'number' ? X.V(p, d, div) : '—');
    const m = inp.mat || {}, s = inp.str || {}, o = inp.opt || {}, ld = inp.loads || {}, own = inp.owner || 'AASHTO', PB = window.PBD || {}, OR = PB.OWN_RULES, ownR = OR && OR.owners[own];
    const OL = PB.ownLoads ? PB.ownLoads(inp) : { etaD: 1, etaR: 1, etaI: 1, eta: 1, mLL: 1 }, mTxt = OL.mLL !== 1 ? ` × m = ${fx(OL.mLL, 2)}` : '';
    const nS = P.spans.lengths.length, cont = P.spans.continuity === 'composite' && nS > 1, stp = id => ((Wk.rating && Wk.rating.steps) || []).find(q => q.id === id);
    const phi = [['Flexure, prestressed section (midspan)', V('fMid.phi', 2), '0.75 ≤ φ ≤ 1.00 by the net tensile strain (Eq. 5.5.4.2-2)', lk(k('fx.phi'))]];
    if (R.cont && typeof R.cont.phiN === 'number') phi.push(['Flexure, reinforced section over the interior support (deck bars)', V('cont.phiN', 2), '0.75 ≤ φ ≤ 0.90 by the net tensile strain (Eq. 5.5.4.2-1)', lk(k('fx.pier.phi'))]);
    phi.push(['Shear', V('phiV', 2), 'Art. 5.5.4.2', lk(k('sh.dc'))]);
    if (R.deck && R.deck.pos) phi.push(['Deck slab flexure, positive / negative', `${V('deck.pos.phi', 2)} / ${V('deck.neg.phi', 2)}`, '0.75 ≤ φ ≤ 0.90 by the net tensile strain (Eq. 5.5.4.2-1)', lk(k('dk.pos.r'))]);
    { const q = stp('rt.phiCS'); if (q && fin(q.value)) phi.push(['Load rating: condition × system factor $\\phi_{c}\\phi_{s}$ (flexure)', fx(q.value, 3), 'MBE Eq. 6A.4.2.1-3; shear takes $\\phi_{s}$ = 1.0', lk(k('rt.phiCS'))]); }
    const rules = OR && ownR && !ownR.none ? OR.rules.filter(r => r.owner === own) : [], KIND = { default: 'input default', load: 'load factor', 'shall-check': 'check (counted in the verdict)', 'should-warning': 'warning', report: 'reported' };
    const asm = keys.has('rs.asm') ? 'see [[rs.asm]]' : '(section not included)';
    return { title: 'Basis of design', subs: [
      sub('spec', 'Specification and owner', [kv([['Design specification', ED], ['Load rating', 'AASHTO Manual for Bridge Evaluation (MBE), LRFR; the rating along the girder cites the MBE 4th Ed. (2026)'],
        ['Owner', ownR ? `${own} (${ownR.manual})` : own], ['Units', 'in, kip, ksi, ft, klf, kip-ft'], ['Sign convention', 'stresses + compression, − tension; moments + sagging'],
        ['Values listed here', u0 ? `${uTitle(u0)} (the first worked girder; each girder type's own values are in its sections)` : `the design girder ${plain(inp.proj && inp.proj.girderId)}`]])]),
      sub('mat', 'Materials', [kv([["Girder concrete $f'_{c}$ / $f'_{ci}$", `${fx(+m.fc, 2)} / ${fx(+m.fci, 2)} ksi`],
        ['$E_{c}$ of the girder, final / at transfer', `${V('cp.Ecg', 0)} / ${V('lo.Eci', 0)} ksi (Eq. 5.4.2.4-1)`, k('sec.Ecg')],
        ["Deck concrete $f'_{c}$, $E_{c}$", `${fx(+m.fcd, 2)} ksi, ${V('cp.Ecd', 0)} ksi`, k('sec.Ecd')], ['Modular ratio n (deck / girder)', V('cp.n', 4), k('sec.n')],
        ['Unit weights', `girder ${fx(+m.wc, 3)} kcf for $E_{c}$ and ${fx(+m.wcLoad, 3)} kcf for dead load; deck ${fx(+m.wcd, 3)} kcf and ${fx(+m.wcdLoad, 3)} kcf`],
        ['Strand', `${plain(s.size)}, $f_{pu}$ = ${fx(+s.fpu, 0)} ksi, ${s.lowlax ? 'low relaxation' : 'stress relieved'}, $E_{p}$ = ${fx(+s.Ep, 0)} ksi, $A_{b}$ = ${V('ss.st.Ab', 3)} in²`],
        ['Strand stress before transfer $f_{pbt}$', `${fx(+s.jack, 3)} $f_{pu}$ = ${V('fpbt', 1)} ksi`, k('ls.fpbt')],
        ['Mild steel $f_{y}$', `stirrups ${fx(+o.fy, 0)}, splitting steel ${fx(+o.splitFy, 0)}, release-tension steel ${fx(+o.relFy, 0)}, bottom longitudinal steel ${fx(+o.longFy, 0)}${R.deck && inp.deck ? `, deck bars ${fx(+inp.deck.fyd, 0)}` : ''}${inp.cont && inp.cont.on ? `, continuity bars ${fx(+inp.cont.fy, 0)}` : ''} ksi`],
        ['Environment and ages', `H = ${fx(+m.H, 0)} %, V/S = ${fx(+m.VS, 2)} in; transfer at ${fx(+m.ti, 0)} days, deck placement at ${fx(+m.td, 0)} days, final ${fx(+m.tfin, 0)} days`]])]),
      sub('phi', 'Resistance factors (Art. 5.5.4.2)', [tbl(['Resistance', 'φ used', 'Basis', 'Worked'], phi, { wide: true }),
        note('The splitting resistance uses a working stress of the steel (5.9.4.4.1), and the service and fatigue limits are stresses: no resistance factor.')]),
      sub('lc', 'Load combinations and load factors (Tables 3.4.1-1, 3.4.1-2, 3.4.1-4)', [
        tbl(['Combination', 'η', '$\\gamma_{DC}$', '$\\gamma_{DW}$', '$\\gamma_{LL+IM}$', 'Use', 'Worked'], [
          ['Strength I', fx(OL.eta, 3), '1.25', '1.50', `1.75${mTxt}`, 'flexure, minimum reinforcement, shear, longitudinal reinforcement, interface shear, negative moment over an interior support, deck slab', lk(k('an.MuS'))],
          ['Service I', '1.00', '1.00', '1.00', `1.00${mTxt}`, 'compression stresses of the girder and the deck', lk(k('an.MsI'))],
          ['Service III', '1.00', '1.00', '1.00', `${fx(+o.gLLs3, 2)}${mTxt}`, 'tension in the precompressed tensile zone', lk(k('an.MsIII'))],
          ['Fatigue I', '—', '—', '—', '1.75', 'fatigue truck with IM 15 %: strand stress range, concrete compression', lk(k('st.fat.M1'))],
          ['Design-load rating, inventory (MBE Table 6A.4.2.2-1)', '—', '1.25', '1.50', '1.75', 'HL-93 rating factors; Service III rating with $\\gamma_{LL}$ = 0.80', lk(k('rt.RFinv'))]], { wide: true, caption: 'The factors the engine applies; each row links to a step that applies them' }),
        kv([['Load modifier η = $\\eta_{D}\\,\\eta_{R}\\,\\eta_{I}$ (Strength I, Art. 1.3.2.1)', `${fx(OL.etaD, 2)} × ${fx(OL.etaR, 2)} × ${fx(OL.etaI, 2)} = ${fx(OL.eta, 3)}`, k('ld.eta')],
          ['Design load multiplier m on HL-93 (LL+IM)', `${fx(OL.mLL, 2)} (Strength I, Service I and Service III; not on the live-load deflection, fatigue or the load rating)`, k('ld.mLL')]])]),
      sub('ll', 'Live load', [kv([['Design live load', ld.llAuto === false ? 'entered $M_{LL}$ and $V_{LL}$ per lane (Loads tab)' : 'HL-93: the design truck or the design tandem, with the design lane load (3.6.1.2)', k('ld.M')],
        ['Dynamic load allowance IM', '33 % on the truck and the tandem, not on the lane load; 15 % on the fatigue truck (Table 3.6.2.1-1)', k('ld.M')],
        ['Distribution factors $DF_{M}$ / $DF_{V}$', `${V('dfm', 3)} / ${V('dfv', 3)} (${ld.dfAuto === false ? 'entered' : `computed, Art. 4.6.2.2${R.df && R.df.fg ? `, cross-section type (${plain(R.df.fg.type)})` : ''}`}; ${ld.pos === 'exterior' ? 'exterior' : 'interior'} girder)`, k('ld.dfm')],
        ['Design lanes $N_{L}$, skew', `${fx(+ld.NL, 0)}, ${fx(+ld.skew, 1)}°`]])]),
      sub('an', 'Analysis method', [kv([['Method', 'Line-girder analysis of each girder type on its line, at the analysis stations along the span: the girder and DC1 on the bare girder, DC2, DW and LL+IM on the composite section; the live load per girder by the distribution factors'],
        ['Spans', cont ? 'made continuous for composite loads (5.12.3.3): the girder and DC1 on the simple span; DC2, DW and live load on the continuous unit; restraint moments as switched on the Bridge layout tab' : 'simple spans', k(cont ? 'an.pier.Mu' : 'an.MuS')],
        ['Section properties', `${o.useTrans ? 'transformed section at release' : 'gross section of the girder at release'}; the haunch ${inp.haunchInProps ? 'is' : 'is not'} in the composite section`, k('sec.Ic')]])]),
      sub('loss', 'Prestress loss method', [kv([['Time-dependent losses', o.lossMethod === 'refined' ? 'refined estimate (Art. 5.9.3.4)' : 'approximate estimate (Art. 5.9.3.3)', k(o.lossMethod === 'refined' ? 'ls.ref.total' : 'ls.apx.total')],
        ['Elastic shortening $\\Delta f_{pES}$', `${V('lo.dfES', 2)} ksi (Art. 5.9.3.2.3)`, k('ls.dfES')],
        ['Total loss, effective prestress $f_{pe}$', `${V('totalLoss', 2)} ksi (${V('pctLoss', 1)} %), ${V('fpe', 2)} ksi`, k('ls.total')]])]),
      sub('own', 'Owner rules in effect', [
        kv([['Owner', ownR ? `${own} (${ownR.manual})` : own], ['Edition the owner manual is written to', ownR ? `AASHTO LRFD ${ownR.aashto}; this report applies ${ED} with the owner rules on top` : '—'],
          ['Hold-down force limit', R.ps10 && typeof R.ps10.frac === 'number' ? `${V('ps10.frac', 2)} W (${plain(R.ps10.owner)})` : R.ps10 && R.ps10.off ? 'no limit checked (the box on the Owner rules tab is off)' : 'the owner\'s own rule, where it has one', k('ez.hd.lim')]]),
        rules.length ? tbl(['Manual article', 'Rule', 'Kind'], rules.map(r => [plain(r.sec), plain(r.lbl || r.nm || r.where || r.id), KIND[r.kind] || plain(r.kind)]), { wide: true }) : note('No owner rule: AASHTO LRFD only.'),
        rules.length ? note(X.ownKey && keys.has(X.ownKey) ? 'Each rule with the value applied, the engine\'s value, its limit and ratio: see [[rs.own]].' : 'Each rule with the value applied: the [[tab:in:own|Owner rules tab]].') : null]),
      sub('asm', 'Assumptions', [note(`The assumptions of this report (handling, deck strip method, rating, hold-down force, continuity, and the notes of the sections used) are listed in the project section: ${asm}.`)])] };
  }
  /* bom(B, X, secs): quantities per girder type (one girder × its lines) and the bridge totals */
  function bom(B, X, secs) {
    const P = B.P, fx = OK().fx, rec = recOf(B, X, 'bom'), num = v => (fin(v) ? v : 0), Lg = c => c.R.L + 2 * (+c.inp.opt.endOh || 0) / 12;
    const all = B.all ? B.all.cells.filter(c => c.R && !c.R.error && c.R.g) : [{ k: null, g: B.sel.g, s: B.sel.s, label: `Design girder ${plain(B.inp.proj && B.inp.proj.girderId)}`, inp: B.inp, R: B.R }];
    const types = []; all.forEach(c => { let T = types.find(q => q.k === c.k); if (!T) types.push(T = { k: c.k, label: plain(c.label), s: c.s, cells: [] }); T.cells.push(c); });
    const lines = T => (T.k == null ? `G${T.cells[0].g}` : T.cells.map(c => 'G' + c.g).join(', '));
    // 1. girder concrete and weight
    const vol = c => c.R.g.A * Lg(c) / 144, wt = c => (fin(c.W) ? c.W : c.R.g.wsw * Lg(c));
    let tV = 0, tW = 0; const r1 = types.map(T => { const c = T.cells[0], V = T.cells.reduce((a, q) => a + vol(q), 0), W = T.cells.reduce((a, q) => a + wt(q), 0); tV += V; tW += W;
      return [T.label, String(T.s), plain(c.inp.girder), { t: rec(c, 'g.A', 1), n: true }, { t: fx(Lg(c), 2), n: true }, { t: fx(vol(c), 1), n: true }, { t: rec(c, 'g.wsw', 4), n: true }, { t: fx(wt(c), 1), n: true }, lines(T), { t: fx(V / 27, 1), n: true }, { t: fx(W, 1), n: true }]; });
    r1.push({ cells: ['Bridge total', '', '', '', '', '', '', '', `${all.length} line${all.length > 1 ? 's' : ''}`, { t: fx(tV / 27, 1), n: true }, { t: fx(tW, 1), n: true }], cls: 'gov' });
    const c0 = all[0];
    // 2. strands
    let tL = 0, tS = 0; const sLen = c => c.R.ss.Ntot * Lg(c), sWt = c => sLen(c) * c.R.ss.st.Ab * SW;
    const r2 = types.map(T => { const c = T.cells[0], L = T.cells.reduce((a, q) => a + sLen(q), 0), W = T.cells.reduce((a, q) => a + sWt(q), 0); tL += L; tS += W;
      return [T.label, String(T.s), plain(c.inp.str && c.inp.str.size), { t: rec(c, 'ss.Ntot', 0), n: true }, { t: rec(c, 'ss.st.Ab', 3), n: true }, { t: fx(Lg(c), 2), n: true }, { t: fx(sLen(c), 0), n: true }, { t: fx(c.R.ss.st.Ab * SW, 3), n: true }, { t: fx(sWt(c), 0), n: true }, lines(T), { t: fx(L, 0), n: true }, { t: fx(W, 0), n: true }]; });
    r2.push({ cells: ['Bridge total', '', '', '', '', '', '', '', '', `${all.length} line${all.length > 1 ? 's' : ''}`, { t: fx(tL, 0), n: true }, { t: fx(tS, 0), n: true }], cls: 'gov' });
    // 3. mild steel the app checks: stirrups, splitting steel, confinement steel (sizes, spacings and counts as entered)
    const stir = c => { const o = c.inp.opt, L = c.R.L, z = num(+o.endZoneLen) * L, sE = +o.sEnd, sI = +o.sInt; if (!(sE > 0) || !(sI > 0)) return null;
      return { z, sE, sI, n: 2 * Math.ceil(12 * z / sE) + Math.ceil(12 * (L - 2 * z) / sI) + 1 }; };
    const r3 = types.map(T => { const c = T.cells[0], o = c.inp.opt, q = stir(c), cf = c.R.conf, nL = T.cells.length;
      return [T.label, String(T.s), q ? `$A_{v}$ = ${fx(+o.stirAv, 2)} in² per set at ${fx(q.sE, 1)} in over ${fx(q.z, 2)} ft from each ℄ bearing and ${fx(q.sI, 1)} in between: ${q.n} sets per girder` : 'spacing not entered: not included',
        `${fx(+o.splitN, 0)} legs of ${fx(+o.splitAv, 2)} in² within h/4 = ${rec(c, 'splitZone', 1)} in of each end ($A_{s}$ = ${rec(c, 'AsSplitProv', 2)} in²): ${fx(2 * num(+o.splitN), 0)} legs per girder`,
        cf && !cf.exempt ? `No. ${fx(+cf.barNo, 0)} at ${fx(+cf.s, 1)} in, ${fx(+cf.n, 0)} bars over ${fx(+cf.provExt, 1)} in from each end: ${fx(2 * num(+cf.n), 0)} bars per girder` : 'not required for this section',
        `${lines(T)}: × ${nL}`]; });
    // 4. deck / topping slab and haunch concrete, per span
    const Wd = (P.xs.bays || []).reduce((a, x) => a + num(+x), 0) + num(+P.xs.ohL) + num(+P.xs.ohR), spans = P.spans.lengths.map(Number);
    let tD = 0, tH = 0; const r4 = []; spans.forEach((L, j) => { const cs = all.filter(c => c.s === j + 1); if (!cs.length) { r4.push([String(j + 1), { t: fx(L, 2), n: true }, { t: fx(Wd, 2), n: true }, 'no girder type on this span: not included', '', '', '', '']); return; }
      const c = cs[0], ts = num(c.R.cp.tsLoad), vD = Wd * ts / 12 * L, vH = cs.reduce((a, q) => a + num(+q.inp.th) * num(q.R.cp.wdkHW) / 144 * q.R.L, 0); tD += vD; tH += vH;
      r4.push([String(j + 1), { t: fx(L, 2), n: true }, { t: fx(Wd, 2), n: true }, { t: rec(c, 'cp.tsLoad', 2), n: true }, { t: fx(vD / 27, 1), n: true }, `${cs.length} line${cs.length > 1 ? 's' : ''}: ${rec(c, 'cp.wdkHW', 1)} × ${fx(+c.inp.th, 2)} in`, { t: fx(vH / 27, 1), n: true }, { t: fx((vD + vH) / 27, 1), n: true }]); });
    r4.push({ cells: ['Bridge total', '', '', '', { t: fx(tD / 27, 1), n: true }, '', { t: fx(tH / 27, 1), n: true }, { t: fx((tD + tH) / 27, 1), n: true }], cls: 'gov' });
    // 5. deck bars, where the deck is designed (the Deck tab's bars)
    const cd = all.find(c => c.R.deck && c.inp.deck), Lt = spans.reduce((a, x) => a + num(x), 0), r5 = [];
    if (cd) { const d = cd.inp.deck, bar = (lab, Ab, sp) => { if (!(+sp > 0) || !(+Ab > 0)) return; const n = Math.ceil(12 * Lt / +sp) + 1; r5.push([lab, `${fx(+Ab, 2)} in² at ${fx(+sp, 1)} in`, { t: fx(n, 0), n: true }, { t: fx(Wd, 2), n: true }, { t: fx(n * Wd * +Ab * SW, 0), n: true }]); };
      bar('Transverse, top', d.barTop, d.sTop); bar('Transverse, bottom', d.barBot, d.sBot);
      if (+d.sBot > 0 && +d.barBot > 0 && fin(cd.R.deck.distPct)) { const A = cd.R.deck.distPct / 100 * +d.barBot * 12 / +d.sBot; r5.push(['Distribution (bottom, longitudinal)', `${rec(cd, 'deck.distPct', 0)} % of the bottom transverse steel = ${fx(A, 3)} in²/ft of width`, '—', { t: fx(Lt, 2), n: true }, { t: fx(A * Wd * Lt * SW, 0), n: true }]); } }
    const un = window.PSBBridge && window.PSBBridge.hasTypes && window.PSBBridge.hasTypes(P) ? window.PSBBridge.unassigned(P) : [], er = B.all ? B.all.cells.filter(c => !c.R || c.R.error || !c.R.g) : [];
    const eg = c0 ? `Check, ${plain(types[0].label)}: V = ${fx(c0.R.g.A, 1)}(${fx(Lg(c0), 2)})/144 = ${fx(vol(c0), 1)} ft³ = ${fx(vol(c0) / 27, 2)} yd³; W = ${fx(c0.R.g.wsw, 4)}(${fx(Lg(c0), 2)}) = ${fx(wt(c0), 1)} kip.` : '';
    const egS = c0 ? `Check, ${plain(types[0].label)}: ${fx(c0.R.ss.Ntot, 0)}(${fx(Lg(c0), 2)}) = ${fx(sLen(c0), 0)} ft; w = ${fx(c0.R.ss.st.Ab, 3)}(490/144) = ${fx(c0.R.ss.st.Ab * SW, 3)} lb/ft; ${fx(sLen(c0), 0)}(${fx(c0.R.ss.st.Ab * SW, 3)}) = ${fx(sWt(c0), 0)} lb.` : '';
    const subs = [
      sub('g', 'Girder concrete and weight', [
        note(`Per girder: $L_{g}$ = L + 2 $e_{end}$/12, the girder length (℄ bearing to ℄ bearing plus the girder ends past the bearings); V = A $L_{g}$ / 144 (ft³; ÷ 27 for yd³); W = $w_{sw}$ $L_{g}$, the girder weight of the hold-down check and of the Summary tab. A and $w_{sw}$ are the section's values of the Section properties section. A girder type's total is the sum over its lines. ${eg}`),
        tbl(['Girder type', 'Span', 'Section', 'A (in²)', '$L_{g}$ (ft)', 'V, one girder (ft³)', '$w_{sw}$ (klf)', 'W, one girder (kip)', 'Lines', 'Concrete (yd³)', 'Weight (kip)'], r1, { wide: true, caption: 'Precast girders: concrete volume and weight per girder type and the bridge total' })]),
      sub('s', 'Prestressing strand', [
        note(`Per girder: N strands, each of the girder length $L_{g}$ (the slope of the draped strands and the strand past the girder ends for stressing are not added); w = $A_{b}$ × 490/144 lb/ft (steel at 490 pcf, AASHTO LRFD 10th Ed. Table 3.5.1-1); weight = N $L_{g}$ w. ${egS}`),
        tbl(['Girder type', 'Span', 'Strand', 'N', '$A_{b}$ (in²)', '$L_{g}$ (ft)', 'Length, one girder (ft)', 'w (lb/ft)', 'Weight, one girder (lb)', 'Lines', 'Length (ft)', 'Weight (lb)'], r2, { wide: true, caption: 'Strand: count, size, length and weight per girder type and the bridge total' })]),
      sub('m', 'Mild steel of the girder (as entered and checked)', [
        note('The stirrups, the splitting steel and the confinement steel the app checks, with the areas, spacings and counts entered (End zone and Shear inputs). Stirrup sets per girder = 2 ⌈12 z / $s_{end}$⌉ + ⌈12 (L − 2z) / $s_{int}$⌉ + 1, z the end-zone length from each ℄ bearing (a count of the spaces; the fabricator\'s detailing governs). Bar sizes of the stirrups and the bar lengths are not inputs: weights are not included.'),
        tbl(['Girder type', 'Span', 'Stirrups', 'Splitting steel', 'Confinement steel', 'Lines'], r3, { wide: true })]),
      sub('d', 'Deck and haunch concrete', [
        note('Deck (or topping) slab: V = deck width × $t_{s}$ / 12 × L, the deck width = the bays + the two overhangs (Cross-section tab), $t_{s}$ the slab thickness used for dead load, L the span between ℄ bearings (the deck past the bearings, skewed ends and the barriers are not added). Haunch: V = $b_{h}$ $t_{h}$ / 144 × L per girder line, $b_{h}$ the haunch width and $t_{h}$ the haunch thickness of the dead load (Loads & LLDF section), summed over the lines with a girder type. yd³ = ft³ / 27.'),
        tbl(['Span', 'L (ft)', 'Deck width (ft)', '$t_{s}$ (in)', 'Deck slab (yd³)', 'Haunch: lines, $b_{h}$ × $t_{h}$', 'Haunch (yd³)', 'Total (yd³)'], r4, { wide: true })]),
      r5.length ? sub('b', 'Deck reinforcement (Deck tab)', [
        note(`The transverse bars of the deck design and its distribution reinforcement: number of transverse bars = ⌈12 L / s⌉ + 1 over the bridge length L = ${fx(Lt, 2)} ft, each of the deck width ${fx(Wd, 2)} ft; weight = number × length × $A_{b}$ × 490/144 lb/ft. Distribution steel: its area per foot of deck width × the deck width × L × 490/144. Laps, hooks and bends are not added.`),
        tbl(['Layer', 'Bars', 'Number', 'Length each (ft)', 'Weight (lb)'], r5, { wide: true })]) : null,
      sub('x', 'Not included', [note(`Not included in this bill of materials (not designed by the app, or a dimension it needs is not an input): the weight of the stirrups, splitting steel and confinement steel (bar lengths); the bonded release-tension steel and the bottom longitudinal mild steel of the girder (areas only are entered); the continuity reinforcement over interior supports and the positive moment connection; ${r5.length ? '' : 'the deck reinforcement (the deck design is off); '}the top longitudinal (temperature and shrinkage) deck bars and any additional overhang bars; diaphragms, barriers, sidewalks and the wearing surface; bearings, inserts and lifting devices; strand waste beyond the girder ends.`),
        un.length ? note(`Girder lines with no girder type (${un.map(q => `G${q.g}/S${q.s}`).join(', ')}) are not checked and not in these quantities; the deck slab is taken over the full deck width.`, true) : null,
        er.length ? note(`Not computed (engine error) and not in these quantities: ${er.map(c => `${plain(c.label)} on G${c.g}, span ${c.s}`).join('; ')}.`, true) : null,
        !B.all ? note('One design girder (no girder types on the lines): the quantities above are of that girder; the deck slab is taken over the full deck width.') : null])].filter(Boolean);
    return { title: 'Bill of materials', subs };
  }
  /* sign(B): sign-off and revision history (the project's title-block fields; blank lines to be filled in by hand), as the steel report's */
  function sign(B) {
    const p = B.P.project || {}, box = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 260" width="200" role="img" aria-label="P.E. seal"><rect x="2" y="2" width="256" height="256" fill="#fff" stroke="#000" stroke-width="1.5"/><text x="130" y="135" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#000">P.E. seal</text></svg>`;
    return { title: 'Sign-off and revision history', subs: [sub('s', 'Sign-off', [
      tbl(['Role', 'Name', 'Signature', 'Date'], [['Designed by', plain(p.designer || ''), '', plain(p.date || '')], ['Checked by', plain(p.checker || ''), '', ''], ['Approved by', '', '', '']]),
      { type: 'figure', svg: box, caption: 'Professional Engineer seal and signature' },
      tbl(['Rev.', 'Date', 'Description', 'By', 'Checked'], [['0', plain(p.date || ''), 'Issued', plain(p.designer || ''), plain(p.checker || '')], ['', '', '', '', ''], ['', '', '', '', ''], ['', '', '', '', '']], { caption: 'Revisions (Computed by, Checked by and Date: the project fields on the Project tab; the rest to be filled in by hand)' })])] };
  }
  /* ptSub(Bu, k): the design-point header of result section k: each engine check of the section (ui/dash.js GROUPS on that tab) at its
     station: x, span and x/L, and the strand context there. x is from the left ℄ bearing; the bonded length of a strand is measured from
     the girder end, min(x, L − x) + e_end, less its debonded length (engine/pbd-strands.js). Display only: nothing is checked here. */
  const PT_TABS = { str: 1, flex: 1, shear: 1, end: 1, camb: 1 };
  function ptSub(Bu, k) {
    if (!PT_TABS[k]) return null;
    const GR = (window.PSBDashUI && window.PSBDashUI.GROUPS) || [], R = Bu.R, inp = Bu.inp, fx = OK().fx, L = R.L, ss = R.ss || {}, o = inp.opt || {};
    const cs = []; GR.filter(gp => gp.tab === k && !gp.input).forEach(gp => gp.checks.forEach(([n, st]) => { const c = R.checks.find(q => q.n === n); if (c && fin(c.loc)) cs.push({ c, st }); }));
    if (!cs.length || !(L > 0)) return null;
    const eE = (+o.endOh || 0) / 12, lt = num0(ss.lt) / 12, ld = num0(R.ldBonded) / 12, a = ss.nh > 0 && ss.hp ? +ss.hp.frac * L : NaN, zE = num0(+o.endZoneLen) * L, db = (ss.rows || []).filter(r => +r.nd > 0 && +r.dbnd > 0);
    const region = x => { const xp = Math.min(x, L - x), xb = xp + eE, out = [];
      out.push(xb <= lt ? `within the transfer length (${fx(xb, 2)} ft from the girder end ≤ $l_{t}$ = ${fx(lt, 2)} ft)` : ld > 0 && xb <= ld ? `within the development length of the bonded strands ($l_{t}$ = ${fx(lt, 2)} ft < ${fx(xb, 2)} ft ≤ $l_{d}$ = ${fx(ld, 2)} ft)` : `beyond the development length of the bonded strands (${fx(xb, 2)} ft from the girder end${ld > 0 ? ` > $l_{d}$ = ${fx(ld, 2)} ft` : ''})`);
      db.forEach(r => { if (xb <= +r.dbnd) out.push(`${fx(+r.nd, 0)} strands of the row at ${fx(+r.y, 2)} in debonded here (to ${fx(+r.dbnd, 2)} ft from the girder end)`);
        else if (xb - +r.dbnd <= lt) out.push(`${fx(+r.nd, 0)} debonded strands of the row at ${fx(+r.y, 2)} in within their transfer length (bonded from ${fx(+r.dbnd, 2)} ft)`); });   // past its transfer length: bonded, not listed
      if (fin(a)) out.push(xp < a - 1e-9 ? `draped strands on their slope (hold-down point at ${fx(a, 2)} ft)` : `at or between the hold-down points (${fx(a, 2)} ft and ${fx(L - a, 2)} ft)`);
      if (k === 'shear' && +o.sEnd > 0 && +o.sInt > 0) out.push(xp <= zE ? `end-zone stirrup spacing ${fx(+o.sEnd, 1)} in (to ${fx(zE, 2)} ft)` : `interior stirrup spacing ${fx(+o.sInt, 1)} in`);
      return out.join('; '); };
    const rows = cs.map(({ c, st }) => [plain(c.n), { t: fx(c.loc, 2), n: true }, `span ${Bu.sel.s}, x/L = ${fx(c.loc / L, 3)}`, region(c.loc), { t: '', key: st }]);
    return sub('pt', 'Design points: where each check of this section governs', [
      tbl(['Check', 'x (ft)', 'Span, x/L', 'Strands and reinforcement at the station', 'Worked'], rows, { wide: true }),
      note(`x from the left ℄ bearing of the span (L = ${fx(L, 2)} ft). Transfer length $l_{t}$ = ${fx(lt, 2)} ft and development length of the bonded strands $l_{d}$ = ${fx(ld, 2)} ft, measured from the girder end${eE > 0 ? ` (${fx(eE * 12, 1)} in past the ℄ bearing)` : ''}${db.length ? `; debonded strands (${db.map(r => `${fx(+r.nd, 0)} at ${fx(+r.y, 2)} in to ${fx(+r.dbnd, 2)} ft`).join(', ')}) from the end of their debonded length` : ''}${fin(a) ? `; hold-down points of the draped strands at ${fx(a, 2)} ft from each ℄ bearing` : '; no draped strands'}. A check that is not at a station of the girder (a steel area at the girder end, a ratio of the whole girder) is listed at the station the engine reports for it.`)]);
  }
  const num0 = v => (fin(+v) ? +v : 0);

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
      subs.unshift(allSub(B, X, M)); { const el = elevSub(X); if (el) subs.splice(1, 0, el); }   // 2026-11-15 (batch C): the Summary's girder elevations
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
    const X = { vals, inReport: t => !!TABS[t] && on(t), ownKey: own && on('proj') ? 'rs.own' : null, figs: opt.figures || null, planFig: opt.planFig || null, sumFig: opt.sumFig || null, every: !!opt.every, snap3d: opt.snap3d || null };   // snap3d: batch G8   // planFig (2026-11-14): §2's framing plan (ui/report.js); rs.own: the owner rules subsection of §2
    X.V = (path, d, div) => { const v = at(X.R || R, path), text = OK().fx(div ? v / div : v, d); vals.push({ sec: X.cur, path, d, div: div || 0, text, ...(X.u != null ? { u: X.u } : {}) }); return text; };   // PS-25: X.R / X.u = the worked unit's result
    const secs = [], dropped = [];
    if (B.multi) multiSecs(B, X, opt, on, secs, dropped);   // PS-25: the worked sections once per girder type (or per line)
    else SECTIONS.forEach(([k]) => {
      if (k !== 'sum' && k !== 'proj' && !TABS[k]) return;   // exec, basis, bom, sign (2026-11-23): built below
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
    // Report package (2026-11-23): the Basis of design after the project section, the bill of materials and the sign-off last, the Executive
    // summary first (built last: its links go to the steps of the sections shown). Each is built only when chosen; its values are recorded.
    { const failS = (k, e) => ({ title: (SECTIONS.find(q => q[0] === k) || [k, k])[1], subs: [sub('n', 'Not available', [note('Report error: ' + (e && e.message), true)])] });
      const pack = (k, f) => { if (!on(k)) return null; const n0 = vals.length; X.cur = k; let s; try { s = f(); } catch (e) { vals.splice(n0); s = failS(k, e); } vals.slice(n0).forEach(v => { v.sec = k; }); return { id: k, key: 'rs.' + k, ...s }; };
      X.R = B.multi ? B.units[0].R : null; X.u = B.multi ? 0 : null;
      const sb = pack('basis', () => basis(B, X, secs)); X.R = null; X.u = null;
      if (sb) { const i = secs.findIndex(q => q.id === 'proj'), j = secs.findIndex(q => q.id === 'sum'); secs.splice(i >= 0 ? i + 1 : j >= 0 ? j + 1 : 0, 0, sb); }
      const sm = pack('bom', () => bom(B, X, secs)); if (sm) secs.push(sm);
      if (on('sign')) secs.push({ id: 'sign', key: 'rs.sign', ...sign(B) });
      const se = pack('exec', () => exec(B, X, secs)); if (se) secs.unshift(se); }
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
