/* apps/steel-bridge/engine/demandfile.js — which demand files the app takes (window.SBDDemandFile). Classic script, no DOM.

   Ported 2026-11-01 from ST-Girder ("Steel Bridge Design.html", st-src), the Import of a demands file (`const importJSON=`) and the
   checks it runs before it applies one (`const gdCheck=`, `function gdLoadsCheck`, `function extFromGD`, `function externalSpans`):
     - A GirderDetail hand-off (schema stgirder-external-demands, producer "GirderDetail", with its girderDetail block) is taken after
       gdCheck: at least 2 stations; units ft / ft-kip / kip; factored:false; every station value a finite number (the 11 required
       keys, and the optional fatigue, DC1 split, pedestrian and utility keys when present); ownerRules (optional) with positive
       factors and a boolean haunchInProperties; girderDetail.loads (optional, GDL) and girderDetail.details (optional, GDX) numbers;
       a valid span layout (member.supports, member.spans, or the stations' extent).
     - Any other demands file (MCT Generator / MIDAS envelope, PS-Beam psbeam-external-demands, steel-beam
       steelbeam-external-demands, a stgirder-external-demands file that is not GirderDetail's, or any JSON with a top-level stations
       array) is refused and nothing is changed: engineer decision DISC 2026-10-19 (fixlog/stgirder.md "DISC"; ST-Girder takes demands
       only from GirderDetail).
   New here (not in ST-Girder): a file with selfWeightExcluded:true is refused too. GirderDetail always writes selfWeightExcluded:false
   (its M_DC1 includes the girder self-weight), so such a file cannot come from GirderDetail; ST-Girder would add its own self-weight
   (swContinuous, SW-CONT), which this app does not port. Refusing it keeps DC1 from being under-counted (fixlog/steel-bridge.md B1).

   check(j) -> { ok: true, pl } | { ok: false, refused: true|false, error }. j: the parsed JSON (a { payload } wrapper is unwrapped,
   as the tabs did before). refused: the file is a demands file of another tool (the message names it); otherwise a GirderDetail
   hand-off that fails a check, or not a demands file at all. */
(function () {
  'use strict';
  const SCHEMAS = ['psbeam-external-demands', 'stgirder-external-demands', 'steelbeam-external-demands'];
  const fromGD = e => !!(e && e.producer === 'GirderDetail' && e.girderDetail);   // ST-Girder extFromGD
  const isNum = v => typeof v === 'number' && isFinite(v);
  // ST-Girder externalSpans: the spans of member.supports, else member.spans, else the stations' extent
  function spans(p) {
    const m = p.member || {};
    if (Array.isArray(m.supports) && m.supports.length >= 2) { const s = m.supports; return s.slice(0, -1).map((x0, i) => ({ x0, x1: s[i + 1], len: +(s[i + 1] - x0).toFixed(3) })); }
    if (Array.isArray(m.spans) && m.spans.length) { let x = 0; return m.spans.map(len => { const o = { x0: x, x1: x + len, len }; x += len; return o; }); }
    const xs = p.stations.map(s => s.x), x0 = Math.min(...xs), x1 = Math.max(...xs);
    return [{ x0, x1, len: +(x1 - x0).toFixed(3) }];
  }
  // ST-Girder gdLoadsCheck (GDL, optional)
  function loadsCheck(L) {
    if (L === undefined) return null;
    if (!L || typeof L !== 'object' || !Array.isArray(L.components)) return 'girderDetail.loads is not a list of load components';
    const fin = v => v === undefined || v === null || isNum(v);
    for (const c of L.components) { if (!c || typeof c !== 'object') return 'girderDetail.loads: a component is not an object';
      for (const k of ['w', 'wTotal', 'wMin', 'wMax', 'Ptotal', 'thickness', 'unitWeight', 'psf', 'width', 'widthIn', 'x']) if (!fin(c[k])) return 'girderDetail.loads: ' + (c.name || c.id || 'a component') + ', ' + k + ' is not a number'; }
    for (const [k, v] of Object.entries(L.totals || {})) if (!fin(v)) return 'girderDetail.loads.totals.' + k + ' is not a number';
    return null;
  }
  // ST-Girder gdCheck: null when the hand-off can be used, else the reason
  function gdCheck(p) {
    if (!p || !Array.isArray(p.stations) || p.stations.length < 2) return 'no stations';
    const u = p.units || {};
    if ((u.x && u.x !== 'ft') || (u.moment && u.moment !== 'ft-kip') || (u.force && u.force !== 'kip')) return 'units must be ft / ft-kip / kip (got ' + [u.x, u.moment, u.force].join(' / ') + ')';
    if (p.factored !== false) return 'the forces must be unfactored (factored:false)';
    const keys = ['x', 'M_DC1', 'V_DC1', 'M_DC2', 'V_DC2', 'M_DW', 'V_DW', 'M_LLpos', 'M_LLneg', 'V_LLpos', 'V_LLneg'];
    for (const st of p.stations) { for (const k of keys) if (!isNum(st[k])) return 'station value ' + k + ' is not a number';
      for (const k of ['M_FATpos', 'M_FATneg', 'V_FATpos', 'V_FATneg', 'M_DC1steel', 'V_DC1steel', 'M_DC1wet', 'V_DC1wet', 'M_PLpos', 'M_PLneg', 'V_PLpos', 'V_PLneg', 'M_UT', 'V_UT', 'M_UF', 'V_UF']) if (st[k] !== undefined && !isNum(st[k])) return 'station value ' + k + ' is not a number'; }
    if (p.ownerRules !== undefined) { const o = p.ownerRules, ok = v => v === undefined || v === null || (isNum(v) && v > 0);   // GD49 (optional)
      if (!o || typeof o !== 'object') return 'ownerRules is not an object';
      if (!ok(o.llMultiplier && o.llMultiplier.m) || !['D', 'R', 'I', 'max', 'min'].every(k => ok(o.eta && o.eta[k])) || !ok(o.ratingTarget && o.ratingTarget.rf)) return 'ownerRules: a factor is not a positive number';
      if (o.haunchInProperties !== undefined && typeof o.haunchInProperties !== 'boolean') return 'ownerRules.haunchInProperties must be true or false'; }
    { const le = loadsCheck(p.girderDetail && p.girderDetail.loads); if (le) return le; }
    { const D = p.girderDetail && p.girderDetail.details; if (D !== undefined) { if (!D || typeof D !== 'object') return 'girderDetail.details is not an object';   // GDX (optional)
      const fin = v => v === undefined || v === null || (isNum(v) && v >= 0);
      for (const [k, o] of Object.entries(D)) { if (!o || typeof o !== 'object') continue;
        for (const [f, v] of Object.entries(o)) if (typeof v === 'number' && !fin(v)) return 'girderDetail.details.' + k + '.' + f + ' is not a non-negative number'; } } }
    const sp = spans(p); if (!sp.length || sp.some(s => !(s.len > 0))) return 'invalid span layout';
    return null;
  }
  function check(j) {
    const p = j && typeof j === 'object' ? (j.payload || j) : null;
    if (!p || typeof p !== 'object') return { ok: false, refused: false, error: 'not a GirderDetail → ST-Girder hand-off file (schema stgirder-external-demands)' };
    if (p._schema === 'stgirder-external-demands' && fromGD(p)) {
      if (p.selfWeightExcluded === true) return { ok: false, refused: true, error: 'this GirderDetail hand-off says selfWeightExcluded: true (its DC1 would not include the girder self-weight). GirderDetail always sends DC1 with the self-weight (selfWeightExcluded: false); this app does not add a self-weight to a hand-off, so the file was not loaded. Nothing was changed.' };
      const e = gdCheck(p); if (e) return { ok: false, refused: false, error: 'cannot use the GirderDetail hand-off: ' + e + '. Nothing was changed.' };
      return { ok: true, pl: p };
    }
    if (SCHEMAS.includes(p._schema) || Array.isArray(p.stations))
      return { ok: false, refused: true, error: 'this app takes demands only from GirderDetail; this file is from ' + (p.producer || p.generatedBy || 'another tool (MCT Generator / MIDAS)') + ' and was not loaded. Nothing was changed. '
        + 'Send the girder from GirderDetail (Steel Bridge Design.html, Structural analysis: Export hand-off (JSON)) and open that file, or use this project\'s analysis or the Custom (entered) demands (engineer decision 2026-10-19, fixlog/stgirder.md DISC).' };
    return { ok: false, refused: false, error: 'not a GirderDetail → ST-Girder hand-off file (schema stgirder-external-demands)' };
  }
  window.SBDDemandFile = { check, gdCheck, loadsCheck, spans, fromGD, SCHEMAS };
})();
