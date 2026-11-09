/* apps/steel-bridge/report/summary.js — the governing results of every girder for the Summary output tab (window.SBDSummary). Classic
   script, no DOM. Created 2026-11-09 (engineer: "There is no Summary output tab, we need to add one"; display only).

   Nothing is calculated here. Each module is run through report/data.js compute() (the same build() its own output tab calls, with the
   shared analysis cache of #1260 / the paths PR), one module of one girder per call so that the page can yield between them; the
   module results of a girder are then put through report/builders.js model() (the Report's own governing rows: the values the Report's
   Summary section shows), and each column of the Summary is the governing row of its group(s):
     flexStr / flexSvc / flexProp  the Flexure module's checks (engine/flexure.js rows) split by limit state: Strength I (GS5–GS10),
                                   Service II (GS12, GS13), cross-section proportions (GS1–GS4, GS22). The largest of the three is the
                                   Flexure tab's own governing ratio (its girder() gov), the same selection rule (govern(): a check
                                   in use whose ratio is not a number governs, as Infinity).
     shear     Report groups "Shear & stiffeners: Web panels" and "…: Stations" (GS11, GS16, GS18)
     stiff     "…: Transverse stiffeners" and "…: Bearing stiffeners"
     fat       "Fatigue & studs: Fatigue details" and "…: Flanges, every station" (GS17);  studs  "Fatigue & studs: Studs"
     cn        "Constructibility (deck placement)";  cf  "Cross-frames";  spl  "Field splices";  wd  the three "Welds: …" groups
     defl      "Analysis: SA3 live-load deflection";  rtInv / rtOpr  "Rating: Inventory RF" / "Rating: Operating RF"
   Demands: this project's analysis, or Custom where a tab has "Custom (entered)" chosen (report/data.js src 'tabs', saved with the
   project in P.demandSrc). A hand-off file or the Example chosen on a tab for the page view is not used here (stated on the tab).

   API: MODS (run order), COLS, run(P, gi, modKey) -> part, cells(P, gi, parts) -> girder summary, overall(P, girders) -> verdict. */
(function () {
  'use strict';
  const W = () => window;
  /* the modules, in run order: k = report/data.js want key; cols = the Summary columns it fills; tab = its output tab */
  const MODS = [
    { k: 'an', name: 'Analysis', tab: 'an', cols: ['defl'] },
    { k: 'flex', name: 'Flexure and rating', tab: 'flex', cols: ['flexStr', 'flexSvc', 'flexProp', 'rtInv', 'rtOpr'] },   // compute() builds the rating with the flexure (one object)
    { k: 'shear', name: 'Shear & stiffeners', tab: 'shear', cols: ['shear', 'stiff'] },
    { k: 'fat', name: 'Fatigue & studs', tab: 'fat', cols: ['fat', 'studs'] },
    { k: 'cn', name: 'Constructibility', tab: 'cn', cols: ['cn'] },
    { k: 'frm', name: 'Cross-frames', tab: 'cf', cols: ['cf'] },
    { k: 'spl', name: 'Field splices', tab: 'spl', cols: ['spl'] },
    { k: 'wd', name: 'Welds', tab: 'wt', cols: ['wd'] }];
  /* the columns: id, heading, short heading, module group (the chips of the left summary), output tab, rating factor (RF: OK ≥ 1) */
  const COLS = [
    { id: 'flexStr', grp: 'Flexure', head: 'Flexure, Strength I', short: 'Str I', tab: 'flex', what: 'GS5–GS10' },
    { id: 'flexSvc', grp: 'Flexure', head: 'Flexure, Service II', short: 'Svc II', tab: 'flex', what: 'GS12, GS13' },
    { id: 'flexProp', grp: 'Flexure', head: 'Proportions (6.10.2, 6.10.1.7)', short: 'Prop.', tab: 'flex', what: 'GS1–GS4' },
    { id: 'shear', grp: 'Shear', head: 'Shear', short: 'Shear', tab: 'shear', what: 'web panels; GS11, GS16, GS18' },
    { id: 'stiff', grp: 'Stiffeners', head: 'Stiffeners', short: 'Stiff.', tab: 'shear', what: 'transverse, bearing' },
    { id: 'fat', grp: 'Fatigue', head: 'Fatigue', short: 'Fatigue', tab: 'fat', what: 'FA1–FA3, GS17' },
    { id: 'studs', grp: 'Studs', head: 'Studs', short: 'Studs', tab: 'fat', what: 'SC1, SC2' },
    { id: 'cn', grp: 'Constructibility', head: 'Constructibility', short: 'Constr.', tab: 'cn', what: 'GS14–GS16, OH' },
    { id: 'cf', grp: 'Cross-frames', head: 'Cross-frames / diaphragms', short: 'X-frames', tab: 'cf', what: 'CF1–CF11' },
    { id: 'spl', grp: 'Field splices', head: 'Field splices', short: 'Splices', tab: 'spl', what: 'flange, web' },
    { id: 'wd', grp: 'Welds', head: 'Welds', short: 'Welds', tab: 'wt', what: 'FW1–FW4, TR1–TR4' },
    { id: 'defl', grp: 'Deflection', head: 'LL deflection', short: 'Defl.', tab: 'defl', what: 'SA3' },   // tab 'defl' since DEFL (2026-11-09): the Deflection tab works SA3 (before: 'an')
    { id: 'rtInv', grp: 'Rating', head: 'Rating, Inventory RF', short: 'RF Inv.', tab: 'rt', rf: true },
    { id: 'rtOpr', grp: 'Rating', head: 'Rating, Operating RF', short: 'RF Opr.', tab: 'rt', rf: true }];
  const GROUPS = [...new Set(COLS.map(c => c.grp))];
  const modOf = col => MODS.find(m => m.cols.includes(col));
  /* the Report's governing groups (report/builders.js model().gov[].grp) of each column */
  const GRP = { shear: /^Shear & stiffeners: (Web panels|Stations)$/, stiff: /^Shear & stiffeners: (Transverse|Bearing) stiffeners$/, fat: /^Fatigue & studs: (Fatigue details|Flanges, every station)$/,
    studs: /^Fatigue & studs: Studs$/, cn: /^Constructibility/, cf: /^Cross-frames$/, spl: /^Field splices$/, wd: /^Welds: /, defl: /^Analysis: SA3/, rtInv: /^Rating: Inventory RF$/, rtOpr: /^Rating: Operating RF$/ };
  const FLEX_CLS = id => /^GS1[23]$/.test(id) ? 'flexSvc' : /^GS([1-4]|22)$/.test(id) ? 'flexProp' : 'flexStr';
  const gr = r => (isFinite(r) ? r : Infinity);   // engine/flexure.js gr(): a ratio that is not a number governs

  /* run(P, gi, k): one module of one girder (report/data.js compute with want = that module), as the module's tab calculates it */
  function run(P, gi, k) {
    const t0 = Date.now(), want = { [k]: true };
    let B; try { B = W().SBDReportData.compute(P, gi, { src: 'tabs', want }); } catch (e) { return { k, err: { [k]: 'Calculation error: ' + (e && e.message) }, t: Date.now() - t0 }; }
    const part = { k, err: { ...B.err }, t: Date.now() - t0, custom: B.custom, src: B.src };
    ['an', 'flex', 'rating', 'flexSame', 'shear', 'fat', 'cn', 'frm', 'spl', 'wd', 'sup'].forEach(q => { if (B[q] !== undefined && B[q] !== null) part[q] = B[q]; });
    if (k !== 'an' && k !== 'flex' && k !== 'spl') delete part.an;   // only the modules that read it (deflection; flexure's report rows)
    return part;
  }

  /* cell of a Summary column from Report rows or a flexure check */
  const stOf = (r, rf, warn) => rf ? (!isFinite(r) ? 'review' : r < 1 - 1e-9 ? 'fail' : 'pass') : !isFinite(r) ? 'review' : r > 1 + 1e-9 ? 'fail' : warn ? 'review' : 'pass';
  const tabStep = key => { const s = String(key || ''), i = s.indexOf('/'); return i < 0 ? { scope: '', step: s } : { scope: s.slice(0, i), step: s.slice(i + 1) }; };

  /* cells(P, gi, parts): the Summary of girder gi from its module results (parts: { modKey: part }); a module not in parts is "not run" */
  function cells(P, gi, parts) {
    const g = P.girders[gi] || {}, out = { gi, label: g.label || g.id || `G${gi + 1}`, cells: {}, warn: [], notes: [], err: {} };
    const B = { P, g: gi, src: 'analysis', pl: null, plName: '', err: {}, girder: P.girders[gi] || P.girders[0], t: {}, custom: null };
    Object.values(parts || {}).forEach(p => { Object.assign(B.err, p.err || {}); if (p.custom) B.custom = p.custom; Object.keys(p).forEach(q => { if (!['k', 'err', 't', 'custom', 'src'].includes(q)) B[q] = p[q]; }); });
    out.err = { ...B.err };
    let M = null; try { M = W().SBDReportBuild.model(B, { detail: 'gov' }); } catch (e) { out.warn.push('Summary: the report model failed: ' + (e && e.message)); }
    const gov = M ? M.gov : []; out.gov = gov;   // the Report's governing rows (the girder elevation figure, engine/tabgraphics-b.js summary)
    COLS.forEach(c => {
      const m = modOf(c.id);
      if (!parts || !parts[m.k]) { out.cells[c.id] = { st: 'notrun', tab: c.tab }; return; }
      if (/^flex/.test(c.id)) { out.cells[c.id] = flexCell(B, c); return; }
      const rows = gov.filter(q => GRP[c.id].test(q.grp || ''));
      if (!rows.length) { const e = errOf(B, m.k, c.id); out.cells[c.id] = { st: 'na', tab: c.tab, why: e }; return; }
      const best = rows.reduce((b, q) => (!b || (c.rf ? q.rf < b.rf : gr(q.r) > gr(b.r)) ? q : b), null), v = c.rf ? best.rf : best.r;
      const ks = tabStep(best.key);
      // a Warning item of the module (Welds TR4, a cross-frame warning) that is not the governing ratio: REVIEW, the value unchanged
      const wItems = c.id === 'wd' && B.wd && B.wd.C ? B.wd.C : c.id === 'cf' && B.frm && B.frm.C ? B.frm.C : null, nW = wItems ? wItems.reduce((a, k) => a + k.items.filter(it => it.st === 'warn').length, 0) : 0;
      out.cells[c.id] = { st: stOf(v, c.rf, best.status === 'warn' || nW > 0), nWarn: nW, r: c.rf ? null : best.r, rf: c.rf ? best.rf : null, mod: best.mod, check: best.check, loc: best.loc, tab: c.tab, key: best.key || null, scope: ks.scope, step: ks.step, grp: best.grp };
    });
    // warnings of the modules (the Report's own list) and those not in a group's ratio
    if (M && M.sections) M.sections.forEach(s => (s.subs || []).forEach(q => (q.items || []).forEach(it => { if (it.type === 'note' && it.warn && /^Welds: |Not evaluated/.test(it.text || '')) out.warn.push(it.text); })));
    if (B.frm && B.frm.C) B.frm.C.forEach(c => c.items.forEach(it => { if (it.st === 'warn') out.warn.push(`Cross-frames: ${c.id} ${c.title}, ${it.loc}: Warning.`); }));
    if (B.an && B.an.warnings) B.an.warnings.forEach(w => out.warn.push('Analysis: ' + (w.msg || w)));
    if (B.flex && !B.flex.err && W().SBDProportions) { const PS = W().SBDProportions.summary(B.flex.rows);
      if (PS && PS.warn.length) [...new Set(PS.warn.map(q => q.id))].forEach(id => { const L = PS.warn.filter(q => q.id === id); out.warn.push(`Flexure: ${id} at ${L.length} location(s), e.g. ${L[0].row.name}: ${L[0].c.na}`); }); }
    if (B.flex && B.flex.oos) out.warn.push('Flexure: a positive-flexure location has its plastic neutral axis below the web (outside Table D6.1-1): GS5 and GS6 are not reported for that span.');
    if (B.wd && B.wd.C) B.wd.C.forEach(c => c.items.forEach(it => { if (it.st === 'warn' || it.st === 'adv') out.warn.push(`Welds: ${c.id} ${it.loc}: ${it.st === 'warn' ? 'Warning' : 'Advisory'}${it.note ? ' (' + it.note + ')' : ''}.`); }));
    if (B.spl && B.spl.list) B.spl.list.forEach(s => (s.warn || []).forEach(w => out.warn.push(`Field splices: ${s.name}: ${w}`)));
    out.warn = [...new Set(out.warn)];
    return out;
  }
  function errOf(B, k, col) {
    const e = B.err[k] || (k === 'flex' ? B.err.rt : '') || B.err.an || '';
    if (e) return e;
    if (col === 'defl') return 'No live-load deflection limit checked (the owner rule or the Analysis settings: optional criterion, 2.5.2.6.2).';
    if (col === 'spl') return 'No field splice on this girder.';
    if (col === 'cf') return 'No cross-frame check with a ratio.';
    return 'No check with a ratio.';
  }
  /* flexCell(B, col): the governing flexure check of one limit state over every location (the Flexure tab's rows) */
  function flexCell(B, c) {
    const F = B.flex; if (!F || F.err) return { st: 'na', tab: 'flex', why: (F && F.err) || B.err.flex || B.err.rt || B.err.an || 'Not calculated.' };
    let best = null;
    F.rows.forEach((r, i) => r.checks.forEach(k => { if (!(k.inUse && k.na == null && k.ratio !== undefined) || FLEX_CLS(k.id) !== c.id) return; if (!best || gr(k.ratio) > gr(best.k.ratio)) best = { r, i, k }; }));
    if (!best) return { st: 'na', tab: 'flex', why: c.id === 'flexSvc' ? 'No Service II check in use.' : 'No check in use.' };
    const f = (x, d) => W().SharedUnits.fmt(x, d);
    return { st: stOf(best.k.ratio, false, false), r: best.k.ratio, mod: 'Flexure', check: `${best.k.id} ${best.k.title}`, loc: `${best.r.name}${best.r.x != null && !/x = /.test(best.r.name) ? `, x = ${f(best.r.x, 2)} ft` : ''}`,
      tab: 'flex', key: `flex@${best.i}/${best.k.step}`, scope: 'flex@' + best.i, step: best.k.step, grp: c.head };
  }

  /* overall(P, list): counts of PASS / FAIL / REVIEW over every girder and column run, the governing check (the largest demand / capacity
     ratio that is a number; with no ratio, the smallest RF), the cells whose ratio is not a number (nan: REVIEW), and each column's
     governing girder */
  function overall(P, list) {
    const n = { pass: 0, fail: 0, review: 0, na: 0, notrun: 0 }, nan = []; let top = null, low = null;
    const byCol = {};
    list.forEach(G => COLS.forEach(c => { const q = G.cells[c.id]; if (!q) return; n[q.st] = (n[q.st] || 0) + 1;
      if (q.r != null && !isFinite(q.r) && q.st !== 'notrun') nan.push({ G, c, q });
      if (q.r != null && isFinite(q.r) && (!top || q.r > top.q.r)) top = { G, c, q };   // the governing check: the largest ratio that is a number (one that is not: REVIEW, listed apart)
      if (q.rf != null && isFinite(q.rf) && (!low || q.rf < low.q.rf)) low = { G, c, q };
      const b = byCol[c.id], v = c.rf ? q.rf : q.r;
      if (q.st === 'notrun' || q.st === 'na') { if (!b) byCol[c.id] = { G, c, q }; return; }
      if (!b || b.q.st === 'notrun' || b.q.st === 'na' || (c.rf ? v < (b.c.rf ? b.q.rf : b.q.r) : gr(v) > gr(b.q.r))) byCol[c.id] = { G, c, q }; }));
    const verdict = n.fail ? 'FAIL' : n.review ? 'REVIEW' : n.pass ? 'PASS' : '—';
    return { n, top, low, nan, byCol, verdict, gov: top || low };
  }
  /* grpStat(list, grp): one chip of the left summary: the columns of a module group over every girder */
  function grpStat(list, grp) {
    const cols = COLS.filter(c => c.grp === grp), all = [];
    list.forEach(G => cols.forEach(c => { const q = G.cells[c.id]; if (q) all.push({ G, c, q }); }));
    const run = all.filter(z => z.q.st !== 'notrun'), real = run.filter(z => z.q.st !== 'na');
    const rf = cols.every(c => c.rf);
    const gov = real.reduce((b, z) => (!b ? z : rf ? (z.q.rf < b.q.rf ? z : b) : (gr(z.q.r) > gr(b.q.r) ? z : b)), null);
    const st = !all.length || run.length < all.length && !real.length ? 'notrun' : !real.length ? 'na' : real.some(z => z.q.st === 'fail') ? 'fail' : real.some(z => z.q.st === 'review') ? 'review' : 'pass';
    return { grp, cols, all, gov, st, partial: run.length < all.length };
  }

  /* weight(P, parts by girder): the girder steel weight of each plate girder from its analysis (engine/analysis.js: Σ w_s ℓ, the DC1 girder
     steel with the detail allowance, worked in the Analysis tab's step eq.DC1steel), kip; null where the analysis has not run */
  function weight(an) { return an && an.segs && an.wSteel ? an.segs.reduce((a, s, i) => a + an.wSteel[i] * (s.x1 - s.x0), 0) : null; }

  window.SBDSummary = { weight, MODS, COLS, GROUPS, run, cells, overall, grpStat, modOf, FLEX_CLS };
})();
