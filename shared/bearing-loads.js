/* shared/bearing-loads.js — the bearingLoads hand-off (window.SharedBearingLoads): the superstructure's unfactored reactions at each
   bearing line, per girder, for the Elastomeric Bearing Design Module (HANDOFF.md §4.17). Classic script, no DOM, no storage.
   Added 2026-11-24 (engineer-approved task "bearing hand-off from both bridge tools"; fixlog/shared-bearing-loads.md BRG-HO).

   Loaded by: elastomeric_design_module.html (the receiver: check, plan), apps/ps-bridge/index.html (the sender: service, the
   descriptors). Node tests: tests/engine/bearing-loads.test.mjs.

   No load factor, no formula of a design: the only arithmetic is the service sums the bearing module already uses for its inputs
   (P_DL = dead load reaction, P_LL = live load reaction, P_min = the permanent load for its slip check), all with load factor 1.0:
     P_DL  = DC1 + DC2 + DW                        (DW contains UTc and DC1 contains UT and UF where the sender says so; separate below)
     P_LL  = LL + PL     (LL without IM)          the module's own basis (tog.includeIM false: no dynamic load allowance on bearings)
     P_LL  = LL_IM + PL  (LL with IM)             offered as an option
     P_min = DC1 + DC2 − UT − UF                   DC only (no DW), less the utilities and the future allowance that are inside DC1
   each divided by the number of bearings per girder n (1 unless the user enters another; a load per bearing, as the abutment's
   nBrgPerGird). PL (pedestrian, 3.6.1.6) is a live load in no other field: added to P_LL by default (option).

   API
     SCHEMA, VERSION, CHANNEL, UNITS, SEPK
     service(g) -> { Pdl, Pll, PllIM, Pmin }   the totals of one girder entry (kip, n = 1; Pll / PllIM null without that LL value)
     check(p) -> { ok, warnings } | { error }  the payload checks (schema, version, units, numbers); the service totals sent, when sent,
                                               must equal service() within 0.002 kip (else a warning: the receiver uses its own sums)
     lineName(l) -> 'Abut. 1 (span 1, left end)'
     plan(p, li, o) -> { line, rows: [{ label, position, type, DC1, DC2, DW, sep, LL, n, Pdl, Pll, Pmin }], design, warnings }
         o = { im: false, pl: true, n: 1, girder: <label> | null }: the values per bearing of every girder of line li; design = the
         girder chosen (default: the largest P_DL + P_LL; ties: the first)
     summary(p) -> one line for the picker ('4 bearing lines, 5 girders, 120 ft') */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const SCHEMA = 'bridge-bearing-loads', VERSION = 1, CHANNEL = 'bearingLoads', UNITS = { force: 'kip', length: 'ft' };
  const SEPK = ['PL', 'PLmin', 'UT', 'UF', 'UTc'], LLK = ['max', 'min', 'maxIM', 'minIM'];
  const isN = v => typeof v === 'number' && isFinite(v);
  const r3 = v => Math.round(v * 1000) / 1000;
  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);

  function service(g) {
    const s = isObj(g.separate) ? g.separate : {}, L = isObj(g.LL) ? g.LL : null, PL = isN(s.PL) ? s.PL : 0;
    return { Pdl: r3(g.DC1 + g.DC2 + g.DW), Pll: L && isN(L.max) ? r3(L.max + PL) : null, PllIM: L && isN(L.maxIM) ? r3(L.maxIM + PL) : null,
      Pmin: r3(g.DC1 + g.DC2 - (isN(s.UT) ? s.UT : 0) - (isN(s.UF) ? s.UF : 0)) };
  }

  function check(p) {
    if (!isObj(p)) return { error: 'not a hand-off object' };
    if (p._schema !== SCHEMA) return { error: `wrong data type (${p._schema || 'none'}), expected ${SCHEMA}` };
    if (!(p.schemaVersion <= VERSION)) return { error: `newer format (v${p.schemaVersion}) than this tool supports (v${VERSION})` };
    const E = [], Wn = [];
    if (!isObj(p.units) || p.units.force !== 'kip' || p.units.length !== 'ft') E.push('units must be { force: "kip", length: "ft" }');
    if (p.factored !== false) E.push('the loads must be unfactored (factored: false)');
    if (!Array.isArray(p.lines) || !p.lines.length) E.push('no bearing lines');
    (Array.isArray(p.lines) ? p.lines : []).forEach((l, i) => {
      const nm = `bearing line ${i + 1}`;
      if (!isObj(l) || typeof l.support !== 'string' || !l.support) { E.push(`${nm}: no support name`); return; }
      if (!Array.isArray(l.girders) || !l.girders.length) { E.push(`${l.support}: no girders`); return; }
      l.girders.forEach((g, j) => {
        const gn = `${lineName(l)}, ${isObj(g) && g.label ? g.label : 'girder ' + (j + 1)}`;
        if (!isObj(g) || typeof g.label !== 'string' || !g.label) { E.push(`${gn}: no girder label`); return; }
        ['DC1', 'DC2', 'DW'].forEach(k => { if (!isN(g[k])) E.push(`${gn}: ${k} is not a valid number`); });
        if (g.separate != null) { if (!isObj(g.separate)) E.push(`${gn}: separate is not an object`);
          else Object.keys(g.separate).forEach(k => { if (SEPK.indexOf(k) < 0) E.push(`${gn}: unknown separate item ${k}`); else if (!isN(g.separate[k])) E.push(`${gn}: separate ${k} is not a valid number`); }); }
        if (g.LL != null) { if (!isObj(g.LL)) E.push(`${gn}: LL is not an object`);
          else LLK.forEach(k => { if (g.LL[k] != null && !isN(g.LL[k])) E.push(`${gn}: LL ${k} is not a valid number`); }); }
        if (E.length) return;
        if (g.DC1 + g.DC2 + g.DW < 0) Wn.push(`${gn}: the dead load reaction DC1 + DC2 + DW is negative (uplift); the bearing module takes it as entered`);
        if (isObj(g.service)) { const s = service(g);
          ['Pdl', 'Pll', 'PllIM', 'Pmin'].forEach(k => { const a = g.service[k], b = s[k];
            if (a == null && b == null) return;
            if (!isN(a) || !isN(b) || Math.abs(a - b) > 0.002) Wn.push(`${gn}: the service total ${k} sent (${a}) differs from the sum of the parts (${b}); this module uses the sum of the parts`); }); }
      });
    });
    if (E.length) return { error: E.join('; ') };
    return { ok: true, warnings: Wn };
  }

  function lineName(l) {
    if (!l) return '';
    const pt = [];
    if (isN(l.span)) pt.push('span ' + l.span);
    if (l.end === 'left' || l.end === 'right') pt.push(l.end + ' end');
    return String(l.support || '') + (pt.length ? ` (${pt.join(', ')})` : '');
  }

  function plan(p, li, o) {
    o = o || {};
    const l = p && Array.isArray(p.lines) ? p.lines[li] : null; if (!l) return { error: 'no such bearing line' };
    const n = isN(+o.n) && +o.n >= 1 ? Math.round(+o.n) : 1, im = !!o.im, pl = o.pl !== false, warnings = [];
    let noLL = 0;
    const rows = l.girders.map(g => {
      const sep = isObj(g.separate) ? g.separate : {}, LL = isObj(g.LL) ? g.LL : null, ll = LL ? LL[im ? 'maxIM' : 'max'] : null;
      const PL = pl && isN(sep.PL) ? sep.PL : 0;
      if (!isN(ll)) noLL++;
      return { label: g.label, position: g.position || '', type: g.type || '', DC1: g.DC1, DC2: g.DC2, DW: g.DW, sep, LL, n, ll: isN(ll) ? ll : null, PL,
        Pdl: r3((g.DC1 + g.DC2 + g.DW) / n), Pll: isN(ll) ? r3((ll + PL) / n) : null,
        Pmin: r3((g.DC1 + g.DC2 - (isN(sep.UT) ? sep.UT : 0) - (isN(sep.UF) ? sep.UF : 0)) / n) };
    });
    if (noLL) warnings.push(`${noLL === rows.length ? 'No girder' : noLL + ' girder(s)'} of this line has a live load reaction ${im ? 'with' : 'without'} IM in the hand-off: P_LL is not filled from it${noLL === rows.length ? '' : ' for those girders'} (enter it).`);
    let design = rows.find(r => r.label === o.girder) || null;
    if (!design) design = rows.reduce((b, r) => ((r.Pdl + (r.Pll || 0)) > (b.Pdl + (b.Pll || 0)) + 1e-9 ? r : b), rows[0]);
    return { line: l, rows, design, n, im, pl, warnings };
  }

  function summary(p) {
    try { const L = p.lines || [], gs = new Set(); L.forEach(l => (l.girders || []).forEach(g => gs.add(g.label)));
      const len = p.movement && isN(p.movement.length) ? `, ${Math.round(p.movement.length * 100) / 100} ft` : '';
      return `${L.length} bearing line${L.length === 1 ? '' : 's'}, ${gs.size} girder${gs.size === 1 ? '' : 's'}${len}`; } catch (e) { return ''; }
  }

  W.SharedBearingLoads = { SCHEMA, VERSION, CHANNEL, UNITS, SEPK, service, check, lineName, plan, summary };
})();
