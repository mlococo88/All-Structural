/* apps/ps-bridge/report/builders.js — the calculation report model of PS Bridge (window.PSBReportBuild). Classic script, no DOM.
   Created 2026-11-13 (PR 2e, docs/ps-bridge-plan.md §5). ADAPTED COPY, to move to shared/ later (CLAUDE.md §3): the structure of
   apps/steel-bridge/report/builders.js at e02c618 (window.SBDReportBuild): SECTIONS in the workflow order with the summary first, the item
   helpers (steps, note, tbl, kv, sub), the worked steps in the tab's topics (gsteps), model(B, opt) with opt.include (a section left out
   keeps no link: a reference into it says "(section not included)"), the title block, running header and footer. The section bodies are
   this app's: each result tab's own cards (report/fromtab.js: the HTML of the tab's output(), the values as the tab shows them) and the
   tab's own worked steps (engine/worked*.js, B.W, the same objects as on the tab), so the Report shows the tabs' numbers and steps.
   Nothing is calculated here: every number is a value of R = PSBHoldDown.compute(inputs) (computeAll + the PS-10 check), as on the tabs.

   model(B, opt) -> report model (shared/report.js); B = report/data.js bundle { P, inp, R, W, sel }; opt.include = { key: false } leaves a
   section out. Every number written by this file goes through V(), which records { sec, path, d, div, text } in model.vals with the
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
    const where = new Map(); GR.forEach(gp => (gp.checks || []).forEach(([n, st]) => { if (!where.has(n)) where.set(n, { gp, st }); }));
    // the owner's material limits (e.g. "Girder f′c (RIDOT 5.2.1)"): an entered strength against the owner's limit, in no result tab's
    // chip; the Owner rules table of §2 lists the rule and what is applied (link to that subsection)
    const OWNG = { name: 'Owner rules', tab: 'own' };
    R.checks.forEach(c => { if (!where.has(c.n) && /\((MassDOT|CTDOT|RIDOT) [\d.]+\)/.test(c.n) && X.ownKey) where.set(c.n, { gp: OWNG, st: X.ownKey }); });
    const gi = w => (!w ? 99 : w.gp === OWNG ? 98 : GR.indexOf(w.gp));
    const order = R.checks.map((c, i) => ({ c, i, w: where.get(c.n) })).sort((a, b) => gi(a.w) - gi(b.w) || a.i - b.i);
    const rows = order.map(({ c, i, w }) => { const p = `checks.${i}.`;
      return { cells: [w ? w.gp.name : '—', plain(c.n), { t: V(p + 'loc', 2), n: true }, { t: V(p + 'v', 3), n: true }, { t: V(p + 'lim', 3), n: true }, plain(c.u), { t: V(p + 'r', 3), n: true, cls: !c.pass ? 'ng' : c.r >= 0.9 ? 'hi' : 'ok' },
        { t: c.pass ? 'PASS' : 'FAIL', cls: c.pass ? 'ok' : 'ng' }, w ? `see [[${w.st}]]` : '—'], cls: c.pass ? '' : 'gov' }; });
    const nF = R.checks.filter(c => !c.pass).length, top = R.checks.reduce((b, c, i) => (!b || c.r > b.c.r ? { c, i } : b), null);
    const tw = top && where.get(top.c.n);
    const items = [
      note(`${nF ? `FAIL: ${nF} of ${R.checks.length} checks do not pass.` : `PASS: all ${R.checks.length} checks pass.`}${top ? ` Largest ratio ${V(`checks.${top.i}.r`, 3)} (${plain(top.c.n)}, x = ${V(`checks.${top.i}.loc`, 2)} ft)${tw ? `, see [[${tw.st}]]` : ''}.` : ''}`, nF > 0),
      note('Each check at its governing station, as the engine reports it (the design girder only; every girder × span comes with the bridge level). Ratio = demand / limit, OK ≤ 1.0 (PASS when the ratio ≤ 1.0001, the engine\'s rule); stresses + compression, − tension. Each row links to the step that works it.'),
      tbl(['Group', 'Check', 'x (ft)', 'Demand', 'Limit', 'Unit', 'Ratio', 'Status', 'Worked'], rows, { wide: true })];
    if (RT && R.rating) {
      const rf = RT.rf.map(([n, f, st]) => ({ n, v: f(R), st })), pth = { 'rt.RFinv': 'rating.RFinv', 'rt.RFvInv': 'shrRating.RFinv', 'rt.RFs3': 'svcRating.RF' };
      items.push(tbl(['HL-93 inventory rating factor', 'RF', 'Worked'], rf.map(z => [z.n, { t: V(pth[z.st], 3), n: true, cls: z.v < 1 ? 'ng' : 'ok' }, `see [[${z.st}]]`])),
        note('Rating factors are not design checks and are not counted in the PASS / FAIL above (RF ≥ 1.0 is OK; 99 = not applicable).'));
    }
    const kq = kv([['Girder', `${plain(B.inp.girder)}, span L = ${V('L', 2)} ft, ${V('ss.Ntot', 0)} strands`], ['Total loss Δf$_{pT}$', `${V('totalLoss', 2)} ksi (${V('pctLoss', 1)} %) (see [[ls.total]])`],
      ['Effective prestress f$_{pe}$', `${V('fpe', 2)} ksi (see [[ls.fpe]])`], ['DF$_{M}$ / DF$_{V}$', `${V('dfm', 3)} / ${V('dfv', 3)} (see [[ld.dfm]])`],
      ['φM$_{n}$ / M$_{u}$ at midspan', `${V('fMid.phiMn', 0, 12)} / ${V('MuMid', 0, 12)} kip-ft (see [[fx.phiMn]])`], ['Camber at release / final', `${V('cam.rel', 2)} / ${V('cam.final', 2)} in (see [[cb.rel]])`]]);
    const subs = [sub('chk', 'Design checks of the design girder', items), sub('kq', 'Key quantities', [kq])];
    if ((R.warns || []).length) subs.push(sub('warn', `Design warnings of the engine (${R.warns.length})`, R.warns.map(w => note(plain(w), true))));
    return { title: 'Summary of checks', subs };
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
    const ownSubs = IN ? FT.cards(IN.cards('own', P), o).subs.filter(s => s.items.length) : [];
    const subs = [
      sub('p', 'Project', [kv([['Project', p.name || '—'], ['Project No', p.number || '—'], ['Client / owner', p.owner || (ownR ? ownR.manual : own)], ['Computed by', p.designer || '—'], ['Checked by', p.checker || '—'], ['Date', p.date || '—']]),
        p.notes ? note(plain(p.notes)) : null]),
      sub('b', 'Bridge and the design girder', [kv([['Spans', `${P.spans.lengths.map(L => OK().fx(+L, 2)).join(' + ')} ft (${P.spans.continuity === 'composite' && nS > 1 ? 'made continuous for composite loads, 5.12.3.3' : 'simple spans'})`],
        ['Girders', `${P.xs.nb}; bays ${(P.xs.bays || []).map(x => OK().fx(+x, 2)).join(', ')} ft; overhangs ${OK().fx(+P.xs.ohL, 2)} / ${OK().fx(+P.xs.ohR, 2)} ft`], ['Support skews', `${(P.xs.skews || []).map(x => OK().fx(+x, 1)).join(', ')}°`],
        ['Design girder', `${plain(inp.proj && inp.proj.girderId)} in span ${sel.s}: ${plain(inp.girder)}, L = ${V0(X, 'L', 2)} ft, S = ${OK().fx(+inp.S, 3)} ft, ${inp.loads.pos === 'exterior' ? 'exterior' : 'interior'} girder`],
        ['Owner', ownR ? `${own} (${ownR.manual})` : own]]), note('Entered values (Project, Bridge layout, Cross-section and Girders & strands tabs); the engine inputs of the design girder are those of the [[tab:in:gird|Girders & strands tab]].')]),
      sub('c', 'Basis', [kv([['Design specification', ED], ['Load rating', 'AASHTO Manual for Bridge Evaluation (MBE), LRFR; article numbers as the old app'], ['Owner manual', ownR && !ownR.none ? `${ownR.manual} (AASHTO LRFD ${ownR.aashto} basis); its rules as listed below` : 'none (AASHTO only)'],
        ['Units', 'in, kip, ksi, ft, klf, kip-ft'], ['Sign convention', 'stresses + compression, − tension; moments + sagging']])]),
      sub('a', 'Assumptions', [...(asm ? asm.items : []), ...ASSUME.map(t => note('• ' + t))])];
    ownSubs.forEach((s, j) => subs.push({ ...sub('o' + j, `Owner rules: ${s.title}`, s.items), ...(j === 0 ? { key: X.ownKey } : {}) }));
    return { title: 'Project, basis and assumptions', subs };
  }
  const V0 = (X, p, d, div) => X.V(p, d, div);

  /* ---------- 3–14. the result tabs ---------- */
  function tabSec(B, k, X) {
    const [ui, wk] = TABS[k], U = window[ui], FT = window.PSBReportTab;
    const html = U.output({ P: B.P, inp: B.inp, R: B.R, W: B.W, ui: {} });   // ui {}: each chooser at its default (the governing / midspan station)
    const C = FT.cards(html, { tab: k, X, sec: k, inReport: X.inReport });
    const subs = [];
    if (C.top.length) subs.push(sub('n', 'Notes', C.top));
    C.subs.forEach((s, j) => {
      if (s.steps) { const W = (B.W[wk] || { steps: [] }).steps; if (W.length) subs.push(sub('w', 'Worked steps', [...s.items, gsteps('', W, U.TOPICS)])); return; }
      subs.push(sub('c' + j, s.title || '—', s.items.length ? s.items : [note('—')]));
    });
    if (!subs.length) subs.push(sub('n', 'Not available', [note('This tab shows nothing for this design.')]));
    return { title: (SECTIONS.find(q => q[0] === k) || [k, k])[1], subs };
  }

  function model(B, opt) {
    opt = opt || {};
    const inc = opt.include || null, on = k => !inc || inc[k] !== false, P = B.P, p = P.project || {}, R = B.R;
    const vals = [];
    const own = B.inp.owner && B.inp.owner !== 'AASHTO';
    const X = { vals, inReport: t => !!TABS[t] && on(t), ownKey: own && on('proj') ? 'rs.own' : null };   // rs.own: the owner rules subsection of §2
    X.V = (path, d, div) => { const v = at(R, path), text = OK().fx(div ? v / div : v, d); vals.push({ sec: X.cur, path, d, div: div || 0, text }); return text; };
    const secs = [], dropped = [];
    SECTIONS.forEach(([k]) => {
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
    const d = B.sel, gid = plain(B.inp.proj && B.inp.proj.girderId);
    return { title: 'Prestressed Bridge Design', subtitle: `Calculation report: design girder ${gid}, span ${d.s}${p.name ? ', ' + p.name : ''}`,
      code: `${ED}; MBE (LRFR load rating). The design girder's results, as on the result tabs.`,
      info: [['Project No', p.number], ['Computed by', p.designer], ['Date', p.date], ['Project', p.name], ['Checked by', p.checker], ['Girder', `${gid}, span ${d.s}`]],
      head: { left: `${p.name || 'Prestressed Bridge Design'}${p.number ? ' (' + p.number + ')' : ''}\nDesign girder ${gid}, span ${d.s}`, right: `Computed by: ${p.designer || '—'}  Date: ${p.date || '—'}\nChecked by: ${p.checker || '—'}`, foot: `Prestressed Bridge Design (new, in development), ${ED}` },
      refs: [['AASHTO LRFD', 'AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024): articles as cited at each step'], ['MBE', 'AASHTO Manual for Bridge Evaluation, LRFR (Section 6, Part A): article numbers as the old app'],
        ['PCI', 'PCI Bridge Design Manual and the Mast method (handling stability screening), as the moved engine'], ...(B.inp.owner && B.inp.owner !== 'AASHTO' && window.PBD ? [[B.inp.owner, window.PBD.OWN_RULES.owners[B.inp.owner].manual]] : [])],
      sections: secs, vals };
  }

  window.PSBReportBuild = { SECTIONS, TABS, model, ASSUME };
})();
