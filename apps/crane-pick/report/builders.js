/* apps/crane-pick/report/builders.js — the report model of the Crane Pick Analyzer (window.CranePickReport), for shared/report.js.
   C1 (2026-11-16). No DOM. §1 Project (title block, the lift-planning-aid statement, notes), §2 Site (coordinate system); the plan
   sheets and the site items add their sections through add(fn): fn(P) -> [section…] (engine values and their worked steps). */
(function () {
  'use strict';
  const G = () => window.CranePickGeo;
  const parts = [];
  const STATEMENT = 'Lift-planning aid. This report supports the lift plan prepared by the responsible qualified persons; the crane manufacturer\'s load charts and instructions, the lift plan and the site checks govern.';
  function model(P) {
    const t = P.title, z = G().zone(P.site.zone);
    const sections = [
      { id: 'proj', key: 'proj', title: 'Project', subs: [
        { id: 'tb', title: 'Title block', items: [{ type: 'kv', rows: [['Project', t.name || '—'], ['Project no.', t.number || '—'], ['Location', t.location || '—'], ['Client / owner', t.client || '—'],
          ['Prepared by', t.by || '—'], ['Checked by', t.checker || '—'], ['Date', t.date || '—'], ['Revision', t.rev || '—']] }] },
        { id: 'aid', key: 'aid', title: 'Lift-planning aid', items: [{ type: 'note', text: STATEMENT }] },
        { id: 'notes', title: 'Notes', items: [{ type: 'note', text: P.notes ? P.notes : 'No notes.' }] }
      ] },
      { id: 'site', key: 'site', title: 'Site', subs: [
        { id: 'crs', key: 'crs', title: 'Coordinate system', items: [{ type: 'kv', rows: [['State Plane zone', z.name], ['Positions', 'grid coordinates, US survey feet (1 ftUS = 1200/3937 m)'],
          ['Distances and bearings', 'grid values; no combined scale or elevation factor applied'], ['Latitude / longitude', 'NAD 83 (shown on the map as WGS 84, about 1–1.5 m apart; the map is not a survey)'],
          ['Units', 'US customary: ft, kip, psf / ksf']] }] }
      ] }
    ];
    parts.forEach(f => { try { (f(P) || []).forEach(s => sections.push(s)); } catch (e) { console.error(e); } });
    return { title: 'Crane Pick Analyzer', subtitle: t.name || 'Crane pick', code: 'Lift-planning aid',
      info: [['Project', t.name || ''], ['Project no.', t.number || ''], ['Location', t.location || ''], ['Prepared by', t.by || ''], ['Checked by', t.checker || ''], ['Date', t.date || '']],
      head: { left: 'Crane Pick Analyzer — lift-planning aid', right: t.name || '' }, sections };
  }
  window.CranePickReport = { model, add: fn => parts.push(fn), STATEMENT };
})();
