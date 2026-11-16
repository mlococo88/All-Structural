/* apps/crane-pick/report/builders.js — the report model of the Crane Pick Analyzer (window.CranePickReport), for shared/report.js.
   C1 (2026-11-16). No DOM. §1 Project (title block, the lift-planning-aid statement, notes), §2 Site (coordinate system); the plan
   sheets and the site items add their sections through add(fn): fn(P) -> [section…] (engine values and their worked steps).
   C7 (2026-11-16): §1 Summary (title block, the lift-planning-aid statement, the summary of every lift with § links to where each value is
   worked, notes), §2 Basis (the general notes of the drawing set, ui/drawset.js notesModel: crane data sources, rating basis, thresholds,
   tandem limit, outrigger-load method, OSHA power-line basis, coordinate system, each with a § link), then the added sections in a fixed
   order (ORDER: Site, Plan sheets, Site items, Cranes, Lifts, Tandem lifts, Ground, Route, Elevations, 3D view; a section not listed goes
   after Ground, where the C6 route section belongs); figures numbered "Figure n." in that order; the lift-planning-aid statement in the
   running header of every printed page. Section ids and keys are unchanged (links and saved data unaffected). */
(function () {
  'use strict';
  const G = () => window.CranePickGeo;
  const parts = [];
  const STATEMENT = 'Lift-planning aid. This report supports the lift plan prepared by the responsible qualified persons; the crane manufacturer\'s load charts and instructions, the lift plan and the site checks govern.';
  function model(P) {
    const t = P.title, z = G().zone(P.site.zone);
    const sections = [
      { id: 'proj', key: 'proj', title: 'Summary', subs: [
        { id: 'tb', title: 'Title block', items: [{ type: 'kv', rows: [['Project', t.name || '—'], ['Project no.', t.number || '—'], ['Location', t.location || '—'], ['Client / owner', t.client || '—'],
          ['Prepared by', t.by || '—'], ['Checked by', t.checker || '—'], ['Date', t.date || '—'], ['Revision', t.rev || '—']] }] },
        { id: 'aid', key: 'aid', title: 'Lift-planning aid', items: [{ type: 'note', text: STATEMENT }] },
        ...liftSummary(P),
        { id: 'notes', title: 'Notes', items: [{ type: 'note', text: P.notes ? P.notes : 'No notes.' }] }
      ] },
      ...basis(P),
      { id: 'site', key: 'site', title: 'Site', subs: [
        { id: 'crs', key: 'crs', title: 'Coordinate system', items: [{ type: 'kv', rows: [['State Plane zone', z.name], ['Positions', 'grid coordinates, US survey feet (1 ftUS = 1200/3937 m)'],
          ['Distances and bearings', 'grid values; no combined scale or elevation factor applied'], ['Latitude / longitude', 'NAD 83 (shown on the map as WGS 84, about 1–1.5 m apart; the map is not a survey)'],
          ['Units', 'US customary: ft, kip, psf / ksf']] }] }
      ] }
    ];
    const added = [];
    parts.forEach(f => { try { (f(P) || []).forEach(s => added.push(s)); } catch (e) { console.error(e); } });
    const rank = s => { const i = ORDER.indexOf(s.id); return i >= 0 ? i : ORDER.indexOf('route') + 0.5; };
    added.map((s, i) => ({ s, i })).sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i).forEach(x => sections.push(x.s));
    // C7: a § link of §1 / §2 only to a section or subsection that is in this report (a lift without ground, no power line …)
    const keys = new Set(); sections.forEach(s => { if (s.key) keys.add(s.key); (s.subs || []).forEach(u => { if (u.key) keys.add(u.key); }); });
    sections.filter(s => s.id === 'proj' || s.id === 'basis').forEach(s => s.subs.forEach(u => u.items.forEach(it => {
      if (it.type === 'kv') it.rows = it.rows.map(r => r.length > 2 && !keys.has(r[2]) ? r.slice(0, 2) : r);
      if (it.type === 'table') it.rows.forEach(r => (Array.isArray(r) ? r : r.cells).forEach(c => { if (c && typeof c === 'object' && c.key && !keys.has(c.key)) delete c.key; })); })));
    // figures numbered in report order
    let nf = 0; sections.forEach(s => (s.subs || []).forEach(u => (u.items || []).forEach(it => { if (it.type === 'figure' && it.svg) { nf++; it.caption = `Figure ${nf}. ${it.caption || ''}`.trim(); } })));
    return { title: 'Crane Pick Analyzer', subtitle: t.name || 'Crane pick', code: 'Lift-planning aid',
      info: [['Project', t.name || ''], ['Project no.', t.number || ''], ['Location', t.location || ''], ['Prepared by', t.by || ''], ['Checked by', t.checker || ''], ['Date', t.date || '']],
      head: { left: 'Crane Pick Analyzer — LIFT-PLANNING AID', center: 'The crane manufacturer\'s charts, the lift plan and the site checks govern', right: t.name || '' }, sections };
  }
  /* C7: the summary of every lift (ui/drawset.js summary: the engine values through the page's evaluations), with § links */
  const ORDER = ['site', 'sheets', 'items', 'cranes', 'lifts', 'tandem', 'ground', 'route', 'elev', 'v3'];
  const ctxOf = () => ({ evalPick: k => (window.CranePickPlace ? window.CranePickPlace.evalPick(k) : null), evalT: t => (window.CranePickTandemUI ? window.CranePickTandemUI.evalT(t) : null) });
  const f = (v, d) => (typeof v === 'number' && isFinite(v)) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  function liftSummary(P) {
    const DS = window.CranePickDrawSet; if (!DS || !((P.picks || []).length + (P.tandems || []).length)) return [];
    let rows; try { rows = DS.summary(P, ctxOf()); } catch (e) { console.error(e); return []; }
    const cell = [];
    rows.forEach(r => {
      if (r.missing) { cell.push([{ t: r.name, key: r.key }, r.kind === 'pick' ? 'single pick' : 'girder lift', r.missing, '', '', '', '', '', '']); return; }
      r.cranes.forEach((c, i) => cell.push({ cells: [i ? '' : { t: r.name, key: r.key }, `${r.kind === 'pick' ? 'single pick' : r.single ? 'girder lift, one crane' : 'tandem, crane ' + (i + 1)}: ${c.setup}`,
        { t: c.pct == null ? 'not permitted' : f(c.pct, 1) + ' %', n: true, key: r.key, cls: c.cls === 'ok' ? 'ok' : c.cls === 'caution' ? 'hi' : 'ng' }, c.clsText, c.where,
        i ? '' : (r.clr ? { t: DS.clrText(r.clr, r.single), key: r.key } : '—'),
        i ? '' : (r.ground ? { t: DS.grText(r.ground), key: r.grKey, n: true } : '—'), i ? '' : (r.ground && r.ground.ratio != null ? { t: f(r.ground.ratio, 2), n: true, key: r.grKey, cls: r.ground.ratio > 1 ? 'ng' : 'ok' } : '—'),
        i ? '' : (r.flags.stop || r.flags.warn ? `${r.flags.stop} stop, ${r.flags.warn} check` : 'none')] })); });
    return [{ id: 'lsum', key: 'lift-sum', title: 'Summary of every lift', items: [
      { type: 'note', text: 'One row per crane of each lift: the governing % of chart (single picks: the lift thresholds; tandem lifts: the tandem limit per crane), the closest 3D clearance (the smallest margin over its requirement), the largest float / track load and the largest bearing ratio, the flags. Each value is worked in the § linked from it. Drawings: [[tab:dwg|Drawings tab]].' },
      { type: 'table', wide: true, head: ['Lift', 'Type: crane setup', '% chart (governing)', 'Status', 'Governing', 'Closest clearance', 'Max float / track load', 'Bearing ratio', 'Flags'], rows: cell }] }];
  }
  /* C7: §2 Basis: the drawing set's general notes (one model) with § links */
  function basis(P) {
    const DS = window.CranePickDrawSet; if (!DS) return [];
    let N; try { N = DS.notesModel(P, ctxOf()); } catch (e) { console.error(e); return []; }
    return [{ id: 'basis', key: 'basis', title: 'Basis', subs: [{ id: 'gn', key: 'basis-notes', title: 'General notes (as on the drawings)', items: [{ type: 'kv', rows: N.map(n => [n.topic, n.text, n.key && n.key !== 'aid' ? n.key : undefined].filter(x => x !== undefined)) }] }] }];
  }
  window.CranePickReport = { model, add: fn => parts.push(fn), STATEMENT, ORDER };
})();
