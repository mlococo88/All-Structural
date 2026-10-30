/* apps/steel-bridge/engine/stiffeners.js — transverse stiffeners and connection plates (AASHTO LRFD 10th Ed. 6.10.11.1), bearing
   stiffeners (6.10.11.2) and the stiffener layout of a girder (window.SBDStiffeners). Classic script, no DOM. Needs window.SharedSteps
   and window.SBDShear (engine/shear.js), loaded first.

   Ported 2026-10-29 from GirderDetail ("Steel Bridge Design.html"), operation for operation:
     - Transverse stiffeners module GM.ts (anchor `GM.ts = {`): compute(p) and checks(R): TS1 minimum projecting width, TS2 projecting
       width limits, TS3 moment of inertia (I_t1, I_t2 with ρ_t, ρ_w, Eqs. 6.10.11.1.3-1, -2, -7, -8), TS4 web shear of the adjacent panels
       (webShear, engine/shear.js), TS5 spacing limits, TS6 weld cutoff, TS7 minimum fillet welds, TS8 owner details, CP1 connection plate
       welds to the flanges, CP2 fatigue at the weld toes; with TS_ROWSPEC, numRows, parseDim, wMinFor.
     - Bearing stiffeners module (anchors `function bsCompute(P)`, `function bsChecks(R)`): BS1 projecting width, BS2 bearing resistance,
       BS3 axial resistance of the effective column (6.10.11.2.4, 6.9.4.1.1), BS4 stiffener-to-web welds, BS5 minimum weld, BS6 width and
       flange connection, BS7 owner minimum thickness.
     - Preliminary sizing's stiffener layout (anchors `function tsBaysOf(`, `function tsBayX(`, `function tsPanels(`, `function tsGirderBays(`):
       the bays of a girder between its bearings and intermediate cross-frames, the stiffeners of each bay (uniform d_o/D evenly spaced, or
       the per-bay counts with optional end stiffeners e0/e1), and the panels with their width d_o and end-panel flag.
   The TeX `work` lines of GirderDetail are replaced by worked steps (SharedSteps). tests/engine/stiffeners.test.mjs checks every value
   and check item against GirderDetail's own functions in Node.

   Owner rules (GirderDetail's gdOwnM, gdWsSt, gdOwnR, gdLF): passed in env = { owner, lf: { eta, m }, ws (sacrificial thickness of
   uncoated weathering steel, in; 0 = none), dia (true: diaphragms, the row names say so), rule(id) (default SBDOwners.rule(owner, id)),
   cite(r) }. Without env: AASHTO, η = m = 1.

   Units: in, kip, ksi; stations ft. E = 29,000 ksi. */
(function () {
  'use strict';
  const ES = 29000, ED = 'AASHTO LRFD 10th Ed.';
  const St = () => window.SharedSteps, SH = () => window.SBDShear;
  const n2 = x => St().n(x, 2), n3 = x => St().n(x, 3), n4 = x => St().n(x, 4);
  const GRADES = { '36': { Fy: 36, Fu: 58 }, '50': { Fy: 50, Fu: 65 }, '50W': { Fy: 50, Fu: 70 }, 'HPS50W': { Fy: 50, Fu: 70 }, 'HPS70W': { Fy: 70, Fu: 85 } };   // GirderDetail GD_GR
  const RANK = { na: 0, pass: 1, adv: 2, warn: 3, fail: 4 };
  const ge = (a, b) => a >= b - 1e-9;
  const worst = a => a.reduce((w, s) => RANK[s] > RANK[w] ? s : w, 'na');
  const wMinFor = t => t > 0.75 + 1e-9 ? 0.3125 : 0.25;   // Table 6.13.3.4-1
  /* GirderDetail parseDim / nm: a number, or text such as "1 1/2" */
  function parseDim(v) { if (typeof v === 'number') return v; if (v == null) return NaN; let s = String(v).trim().replace(/["”]/g, '').replace(/(\d)-(\d)/g, '$1 $2').replace(/\s+/g, ' '); if (!s) return NaN;
    let m = s.match(/^(-?\d+(?:\.\d+)?) (\d+)\/(\d+)$/); if (m) return +m[1] + m[2] / m[3]; m = s.match(/^(\d+)\/(\d+)$/); if (m) return m[1] / m[2]; const n = Number(s); return isFinite(n) ? n : NaN; }
  const nm = v => typeof v === 'number' ? v : parseDim(v);
  const frac = x => { const w = Math.floor(x + 1e-9), f = Math.round((x - w) * 16); if (!f) return `${w}`; let a = f, b = 16; while (a % 2 === 0) { a /= 2; b /= 2; } return w ? `${w} ${a}/${b}` : `${a}/${b}`; };
  function numRows(rows, spec, lbl, errors) { return (rows || []).map((r0, i) => { const r = { i, name: r0.name || `${lbl} ${i + 1}` };
    spec.forEach(([k, label, , ty, o]) => { if (ty === 'text' || ty === 'sel') { r[k] = r0[k]; return; }
      if (o && o.opt && (r0[k] == null || r0[k] === '' || (typeof r0[k] === 'number' && isNaN(r0[k])))) { r[k] = null; return; }
      const v = nm(r0[k]); r[k] = v; const min = o && o.min !== undefined ? o.min : (o && o.any ? -Infinity : 1e-12);
      if (!isFinite(v) || v < min) errors.push(`${r.name}: "${label.replace(/<[^>]+>/g, '')}" must be ${o && o.any ? 'a number' : min === 0 ? 'zero or positive' : 'positive'}.`); }); return r; }); }
  function env0(env) {
    const e = env || {}, O = window.SBDOwners, owner = e.owner || 'AASHTO';
    return { owner, lf: e.lf || { eta: 1, etaN: 1, m: 1 }, ws: +e.ws > 0 ? +e.ws : 0, dia: !!e.dia,
      rule: e.rule || (id => (O ? O.rule(owner, id) : null)), cite: e.cite || (r => (O ? O.cite(r) : (r ? `${r.owner} ${r.sec}` : ''))) };
  }
  // GirderDetail gdPLe (GD45): the pedestrian part of a live-load value is not multiplied by m
  function plAdjust(src, r, keys, m) { return SH().plAdjust(src, r, keys, m); }
  const UT = (s, k) => { const v = s && s.ut && typeof s.ut === 'object' ? +s.ut[k] : 0; return isFinite(v) ? v : 0; };   // gdUt
  const utOn = s => !!(s && s.ut && typeof s.ut === 'object' && Object.values(s.ut).some(v => +v));   // gdUtOn

  /* ================= transverse stiffeners and connection plates (GM.ts) ================= */
  const TS_ROWSPEC = [['name', 'Name', '', 'text'], ['type', 'Plate', '', 'sel'], ['D', 'Web depth D', 'in', 'dim'], ['tw', 'Web t<sub>w</sub>', 'in', 'dim'],
    ['bfc', 'Top flange b', 'in', 'dim'], ['tfc', 'Top flange t', 'in', 'dim'], ['bft', 'Bottom flange b', 'in', 'dim'], ['tft', 'Bottom flange t', 'in', 'dim'],
    ['bfw', 'Widest comp. flange in field section', 'in', 'dim'], ['end', 'Panel 1 is an end panel', '', 'sel'],
    ['do1', 'Panel 1 width d<sub>o</sub>', 'in', 'dim'], ['do2', 'Panel 2 width d<sub>o</sub>', 'in', 'dim'],
    ['VDC1', 'V<sub>DC1</sub>', 'kip', 'num', { min: 0 }], ['VDC2', 'V<sub>DC2</sub>', 'kip', 'num', { min: 0 }], ['VDW', 'V<sub>DW</sub>', 'kip', 'num', { min: 0 }], ['VLL', 'V<sub>LL+IM</sub>', 'kip', 'num', { min: 0 }],
    ['df', 'Δf fatigue, tension flange', 'ksi', 'num', { min: 0 }],
    ['VDC1b', 'Max. V<sub>DC1</sub> in panel 1', 'kip', 'num', { min: 0, opt: true }], ['VDC2b', 'Max. V<sub>DC2</sub> in panel 1', 'kip', 'num', { min: 0, opt: true }],
    ['VDWb', 'Max. V<sub>DW</sub> in panel 1', 'kip', 'num', { min: 0, opt: true }], ['VLLb', 'Max. V<sub>LL+IM</sub> in panel 1', 'kip', 'num', { min: 0, opt: true }],
    ['VDC1c', 'Max. V<sub>DC1</sub> in panel 2', 'kip', 'num', { min: 0, opt: true }], ['VDC2c', 'Max. V<sub>DC2</sub> in panel 2', 'kip', 'num', { min: 0, opt: true }],
    ['VDWc', 'Max. V<sub>DW</sub> in panel 2', 'kip', 'num', { min: 0, opt: true }], ['VLLc', 'Max. V<sub>LL+IM</sub> in panel 2', 'kip', 'num', { min: 0, opt: true }]];
  const TS_BRG = ['VDC1b', 'VDC2b', 'VDWb', 'VLLb'], TS_PN2 = ['VDC1c', 'VDC2c', 'VDWc', 'VLLc'];
  /* TS_DEFAULT: GirderDetail's built-in Transverse stiffeners input (GM.ts.def) */
  const TS_DEFAULT = { gW: '50W', gS: '50W', Fexx: 70, gam: { dc: 1.25, dw: 1.50, ll: 1.75, fat: 1.75 },
    types: { A: { name: 'Intermediate stiffener', role: 'int', sides: '1', bt: 6, tp: 0.5, w: 0.25, gap: 2.75, wf: 0.3125, c: 1, Fcp: 20 },
             B: { name: 'Connection plate', role: 'cp', sides: '1', bt: 6, tp: 0.5, w: 0.25, gap: 2.75, wf: 0.3125, c: 1, Fcp: 20 } },
    rows: [{ name: 'Span 1, first stiffener from Abut. 1', type: 'A', D: 60, tw: 0.5625, bfc: 16, tfc: 0.75, bft: 16, tft: 1.125, bfw: 16, end: 'yes', do1: 60, do2: 60, VDC1: 55, VDC2: 8, VDW: 9, VLL: 85, df: 0 },
      { name: 'Span 1, cross-frame at 0.4L', type: 'B', D: 60, tw: 0.5625, bfc: 16, tfc: 0.75, bft: 16, tft: 1.125, bfw: 16, end: 'no', do1: 90, do2: 90, VDC1: 15, VDC2: 2, VDW: 2, VLL: 45, df: 4.5 }] };

  /* transverse(p, env): GM.ts.compute(p). p = { gW, gS (grades), Fexx (ksi), gam: { dc, dw, ll, fat }, types: { A, B: { name, role: 'int' | 'cp',
     sides: '1' | '2', bt, tp, w, gap, wf, c, Fcp } }, rows: [ TS_ROWSPEC fields, optional ut: { VUT, VUF, VUTb, … }, pl ] }.
     Returns { errors } or { errors: [], rows, types, Fyw, Fys, Fexx, g }. */
  function transverse(p, env) {
    const E = env0(env), errors = [], Fyw = GRADES[p.gW].Fy, Fys = GRADES[p.gS].Fy, Fexx = nm(p.Fexx), L = E.lf, gO = k => k === 'dc' || k === 'dw' ? L.eta : k === 'll' ? L.eta * L.m : 1, g = k => nm(p.gam[k]) * gO(k);   // OWN6/OWN7 (OWN_K.ts)
    const types = {}; Object.entries(p.types).forEach(([k, t]) => { const q = { k, name: t.name, role: t.role, sides: +t.sides }; ['bt', 'tp', 'w', 'gap', 'wf', 'c', 'Fcp'].forEach(f => { q[f] = nm(t[f]); if (!(q[f] >= 0)) errors.push(`Type ${k}: "${f}" must be zero or positive.`); }); if (!(q.bt > 0 && q.tp > 0 && q.w > 0)) errors.push(`Type ${k}: width, thickness, and weld size must be positive.`);
      { const sW = E.ws; if (sW && q.tp > 0) { q.tpF = q.tp; q.ws = sW; q.tp = q.tp - sW; if (!(q.tp > 0)) errors.push(`Type ${k}: the plate must be thicker than the ${frac(sW)} in sacrificial thickness (uncoated weathering steel).`); } }   // GD59: design (net) thickness
      types[k] = q; });
    if (!(Fexx > 0)) errors.push('F_EXX must be positive.');
    const rows = numRows(p.rows, TS_ROWSPEC, 'Location', errors);
    if (E.dia) rows.forEach(r => { r.name = r.name.replace(/^(Span \d+, )cross-frame at /, '$1diaphragm at '); });
    rows.forEach(r => [[TS_BRG, 1], [TS_PN2, 2]].forEach(([K, q]) => { const n = K.filter(k => r[k] != null).length; if (n && n < 4) errors.push(`${r.name}: enter all four panel ${q} shears, or leave all four blank.`); }));
    if (!rows.length) errors.push('Add at least one stiffener location.');
    if (errors.length) return { errors };
    rows.forEach(r => { const t = types[r.type]; r.t = t; plAdjust(p.rows[r.i], r, ['VLL', 'VLLb', 'VLLc'], L.m);
      r.Vu = g('dc') * (r.VDC1 + r.VDC2) + g('dw') * r.VDW + g('ll') * r.VLL;
      r.VuB = r.VDC1b != null ? g('dc') * (r.VDC1b + r.VDC2b) + g('dw') * r.VDWb + g('ll') * r.VLLb : null;
      r.VuC = r.VDC1c != null ? g('dc') * (r.VDC1c + r.VDC2c) + g('dw') * r.VDWc + g('ll') * r.VLLc : null;
      { const u = p.rows[r.i]; r.ut = utOn(u); if (r.ut) { ['VUT', 'VUF', 'VUTb', 'VUFb', 'VUTc', 'VUFc'].forEach(k => r[k] = UT(u, k)); const uv = s => g('dw') * r['VUT' + s] + g('dc') * r['VUF' + s];
        r.Vu += uv(''); if (r.VuB != null) r.VuB += uv('b'); if (r.VuC != null) r.VuC += uv('c'); } }
      r.Vu1 = r.VuB != null ? Math.max(r.VuB, r.Vu) : r.Vu; r.Vu2 = r.VuC != null ? Math.max(r.VuC, r.Vu) : r.Vu;
      const flgA = r.bfc * r.tfc + r.bft * r.tft; r.flgA = flgA;
      r.p1 = SH().webShear(r.D, r.tw, Fyw, r.do1, flgA, r.end === 'yes'); r.p2 = SH().webShear(r.D, r.tw, Fyw, r.do2, flgA, false);
      [r.p1, r.p2].forEach((q, i) => { q.do = i ? r.do2 : r.do1; q.end = !i && r.end === 'yes'; q.Vu = i ? r.Vu2 : r.Vu1; q.pan = (i ? r.VuC : r.VuB) != null; q.phVn = 1.0 * q.Vn; const tfa = q.stiff && !q.end; q.rho = tfa && q.Vu > 1.0 * q.Vcr ? Math.min(1, (q.Vu - 1.0 * q.Vcr) / Math.max(q.phVn - 1.0 * q.Vcr, 1e-9)) : 0; });
      r.rhow = Math.max(r.p1.rho, r.p2.rho);
      r.It = t.sides === 2 ? t.tp * (2 * t.bt + r.tw) ** 3 / 12 : t.tp * t.bt ** 3 / 3;
      r.dmin = Math.min(r.do1, r.do2); r.b = Math.min(r.dmin, r.D); r.J = Math.max(2.5 / (r.dmin / r.D) ** 2 - 2.0, 0.5); r.It1 = r.b * r.tw ** 3 * r.J;
      r.Fcrs = Math.min(0.31 * ES / (t.bt / t.tp) ** 2, Fys); r.rhot = Math.max(Fyw / r.Fcrs, 1.0); r.It2 = r.D ** 4 * r.rhot ** 1.3 / 40 * (Fyw / ES) ** 1.5;
      r.ntf = !(r.p1.Vu > 1.0 * r.p1.Vcr) && !(r.p2.Vu > 1.0 * r.p2.Vcr);
      r.Ireq = r.rhow > 0 ? (r.It2 > r.It1 ? r.It1 + (r.It2 - r.It1) * r.rhow : r.It2) : r.ntf ? Math.min(r.It1, r.It2) : r.It1;
      r.IreqEq = r.rhow > 0 ? (r.It2 > r.It1 ? '6.10.11.1.3-7' : '6.10.11.1.3-8') : r.ntf && r.It2 < r.It1 ? '6.10.11.1.3-2' : '6.10.11.1.3-1';
      r.fat = g('fat') * r.df;
      r.Rcp = t.sides * 2 * 0.6 * 0.80 * Fexx * 0.707 * t.wf * Math.max(t.bt - t.c, 0);
    });
    const R = { errors: [], rows, types, Fyw, Fys, Fexx, g: { dc: g('dc'), dw: g('dw'), ll: g('ll'), fat: g('fat') }, env: E };
    return R;
  }

  /* check list helpers (GirderDetail ckNew, rc) */
  function ckNew() { const out = []; out.add = c => { c.items.forEach(it => { if (typeof it.r === 'number' && Number.isNaN(it.r) && it.st !== 'na') { it.err = 'error: ratio is NaN'; if (RANK[it.st] < RANK.warn) it.st = 'fail'; } });   // SB2-R2 NaN guard: never a pass, ranks first
    const nr = i => (Number.isNaN(i.r) || i.r === Infinity ? Infinity : i.r ?? -1);
    c.status = c.items.length ? worst(c.items.map(i => i.st)) : 'na'; let gi = -1; c.items.forEach((it, k) => { if (gi < 0 || RANK[it.st] > RANK[c.items[gi].st] || (RANK[it.st] === RANK[c.items[gi].st] && nr(it) > nr(c.items[gi]))) gi = k; }); c.gov = gi; if (!c.items.length && !c.naWhy) c.naWhy = 'Not applicable to any item.'; out.push(c); }; return out; }
  const rc = (loc, d, c, step, x) => ({ loc, demand: d, capacity: c, r: d / c, st: ge(c, d) ? 'pass' : 'fail', step, ...(x || {}) });

  /* transverseChecks(R): GM.ts.checks(R). Each check { id, grp, title, ref, items: [{ loc, r, st, demand, capacity, step }], naWhy, status, gov }. */
  function transverseChecks(R) {
    const out = ckNew(), G1 = 'Stiffener proportions', G2 = 'Web shear', G3 = 'Welds and fatigue', L = r => `${r.name} (Type ${r.type})`, E = R.env;
    { const c = { id: 'TS1', grp: G1, title: 'Minimum projecting width', ref: `${ED} Eq. 6.10.11.1.2-1`, items: [] };
      R.rows.forEach(r => { const m = 2 + r.D / 30; c.items.push(rc(L(r), m, r.t.bt, `ts${r.i}.bmin`)); }); out.add(c); }
    { const c = { id: 'TS2', grp: G1, title: 'Projecting width limits, 16t_p ≥ b_t ≥ b_f/4', ref: `${ED} Eq. 6.10.11.1.2-2`, items: [] };
      R.rows.forEach(r => { const u = 16 * r.t.tp, l = r.bfw / 4;
        c.items.push(rc(`${L(r)}, 16t_p`, r.t.bt, u, `ts${r.i}.bmax`)); c.items.push(rc(`${L(r)}, b_f/4`, l, r.t.bt, `ts${r.i}.bf4`)); }); out.add(c); }
    { const c = { id: 'TS3', grp: G1, title: 'Moment of inertia', ref: `${ED} Eqs. 6.10.11.1.3-1, -2, -7, -8`, items: [] };
      R.rows.forEach(r => c.items.push(rc(L(r), r.Ireq, r.It, `ts${r.i}.Ireq`))); out.add(c); }
    { const c = { id: 'TS4', grp: G2, title: 'Web shear resistance of adjacent panels', ref: `${ED} Art. 6.10.9.3.2, 6.10.9.3.3`, items: [] };
      R.rows.forEach(r => [r.p1, r.p2].forEach((q, i) => c.items.push(rc(`${L(r)}, panel ${i + 1}${q.end ? ' (end)' : ''}`, q.Vu, q.phVn, `ts${r.i}.p${i + 1}.ok`)))); out.add(c); }
    { const c = { id: 'TS5', grp: G2, title: 'Stiffener spacing limits', ref: `${ED} Art. 6.10.9.1, 6.10.9.3.3`, items: [] };
      R.rows.forEach(r => [r.p1, r.p2].forEach((q, i) => { const lim = (q.end ? 1.5 : 3) * r.D, ok = ge(lim, q.do), adv = !ok && !q.stiff;
        c.items.push({ loc: `${L(r)}, panel ${i + 1}${q.end ? ' (end)' : ''}`, demand: q.do, capacity: lim, r: q.do / lim, st: ok ? 'pass' : adv ? 'adv' : 'warn', step: `ts${r.i}.p${i + 1}.st` }); }));
      if (!R.rows.some(r => r.t.role === 'int') && !c.items.some(i => i.st === 'warn')) { c.items = []; c.naWhy = 'Connection plates only (no intermediate stiffeners): connection-plate spacing is not limited by 6.10.9.1; TS4 checks each panel as stiffened where its spacing is within the 6.10.9.1 limits (3D interior, 1.5D end panels) and as unstiffened where it is wider.'; }
      out.add(c); }
    { const c = { id: 'TS6', grp: G3, title: 'Web weld cutoff at the tension flange, 4t_w ≤ g ≤ 6t_w', ref: `${ED} Art. 6.10.11.1.1`, items: [] };
      R.rows.filter(r => r.t.role === 'int').forEach(r => { const a = 4 * r.tw, b = 6 * r.tw, ok = ge(r.t.gap, a) && ge(b, r.t.gap); c.items.push({ loc: L(r), demand: r.t.gap, capacity: b, r: Math.max(a / r.t.gap, r.t.gap / b), st: ok ? 'pass' : 'fail', step: `ts${r.i}.gap` }); });
      if (!c.items.length) c.naWhy = 'No location uses an intermediate stiffener.'; out.add(c); }
    { const c = { id: 'TS7', grp: G3, title: 'Minimum fillet weld sizes', ref: `${ED} Art. 6.13.3.4, Table 6.13.3.4-1`, items: [] };
      R.rows.forEach(r => { const t = r.t, m1 = wMinFor(Math.max(r.tw, t.tpF ?? t.tp)); c.items.push({ loc: `${L(r)}, to web`, demand: m1, capacity: t.w, r: m1 / t.w, st: ge(t.w, m1) ? 'pass' : 'fail', step: `ts${r.i}.wW` });
        if (t.role === 'cp') { const tf = Math.max(r.tfc, r.tft, t.tpF ?? t.tp), m2 = wMinFor(tf); c.items.push({ loc: `${L(r)}, to flanges`, demand: m2, capacity: t.wf, r: m2 / t.wf, st: ge(t.wf, m2) ? 'pass' : 'fail', step: `ts${r.i}.wF` }); } }); out.add(c); }
    { const rF = E.rule('ts.fascia'), rM = E.rule('ts.min') || E.rule('stiff.min');   // OWN38
      if (rF || rM) { const mn = rM ? { int: rM.value.st, cp: rM.value.cp ?? rM.value.cpT } : null, sW = E.ws, isExt = r => /exterior|fascia/i.test(r.name);
        const c = { id: 'TS8', grp: G1, title: 'Owner: stiffener and connection plate details', ref: [rF, rM].filter(Boolean).map(E.cite).join('; '), src: 'DOT', items: [] };
        R.rows.forEach(r => { const t = r.t, ext = isExt(r), pr = t.sides === 2;
          if (rF && ext) c.items.push({ loc: `${L(r)}: side of the web`, st: pr ? 'fail' : 'pass', r: undefined, step: `ts${r.i}.own` });
          if (rF && !ext && rF.value && rF.value.pairs && !pr) c.items.push({ loc: `${L(r)}: side of the web`, st: 'adv', r: undefined, step: `ts${r.i}.own` });
          if (mn) { const tp = t.tpF ?? t.tp, m = (t.role === 'cp' ? mn.cp : mn.int) + sW, ok = ge(tp, m); c.items.push({ loc: `${L(r)}: thickness`, demand: m, capacity: tp, r: m / tp, st: ok ? 'pass' : 'fail', step: `ts${r.i}.own` });
            if (t.role === 'cp' && rM.value.cpB) { const okB = ge(t.bt, rM.value.cpB); c.items.push({ loc: `${L(r)}: connection plate width`, demand: rM.value.cpB, capacity: t.bt, r: rM.value.cpB / t.bt, st: okB ? 'pass' : 'fail', step: `ts${r.i}.own` }); } } });
        if (!c.items.length) c.naWhy = 'No location on the exterior (fascia) girder.'; out.add(c); } }
    { const c = { id: 'CP1', grp: G3, title: 'Connection plate welds to the flanges', ref: `${ED} Art. 6.6.1.3.1, 6.13.3.2.4b`, items: [] };
      R.rows.filter(r => r.t.role === 'cp').forEach(r => c.items.push(rc(L(r), r.t.Fcp, r.Rcp, `ts${r.i}.cp`)));
      if (!c.items.length) c.naWhy = 'No location uses a connection plate.'; out.add(c); }
    { const rC = E.rule('fat.catC'), th = rC ? rC.value.th : 12;   // OWN25
      const c = { id: 'CP2', grp: G3, title: 'Fatigue at stiffener weld toes', ref: rC ? `${ED} Art. 6.6.1.2, Table 6.6.1.2.3-1; ${E.cite(rC)} (Category C)` : `${ED} Art. 6.6.1.2, Table 6.6.1.2.3-1 (Category C′)`, src: rC ? 'DOT' : 'Code', items: [], th };
      R.rows.filter(r => r.df > 0).forEach(r => c.items.push(rc(L(r), r.fat, th, `ts${r.i}.fat`)));
      if (!c.items.length) c.naWhy = 'No fatigue stress range entered.'; out.add(c); }
    return out;
  }

  /* transverseSteps(R, r): the worked steps of one row of transverse(). */
  function transverseSteps(R, r) {
    const w = St().work('ts' + r.i), t = r.t, g = R.g, Fyw = R.Fyw, Fys = R.Fys, tbl = `${ED} Tables 3.4.1-1, 3.4.1-2`, okS = (a, b) => ge(b, a);
    w.add({ id: 'bmin', label: 'Minimum projecting width (TS1)', sym: 'b_{t} \\ge 2.0 + \\frac{D}{30}', eq: '', sub: `${n2(t.bt)} ${okS(2 + r.D / 30, t.bt) ? '\\ge' : '\\lt'} 2.0 + \\frac{${n2(r.D)}}{30} = ${n2(2 + r.D / 30)}`, value: (2 + r.D / 30) / t.bt, unit: '', d: 3, ref: `${ED} Eq. 6.10.11.1.2-1`, ok: okS(2 + r.D / 30, t.bt) });
    w.add({ id: 'bmax', label: 'Projecting width, upper limit (TS2)', sym: 'b_{t} \\le 16t_{p}', eq: '', sub: `${n2(t.bt)} ${okS(t.bt, 16 * t.tp) ? '\\le' : '\\gt'} 16(${n4(t.tp)}) = ${n2(16 * t.tp)}`, value: t.bt / (16 * t.tp), unit: '', d: 3, ref: `${ED} Eq. 6.10.11.1.2-2`, ok: okS(t.bt, 16 * t.tp), note: t.ws ? `t_p is the design thickness ${frac(t.tpF)} − ${frac(t.ws)} in (sacrificial, uncoated weathering steel).` : '' });
    w.add({ id: 'bf4', label: 'Projecting width, lower limit (TS2)', sym: 'b_{t} \\ge \\frac{b_{f}}{4}', eq: '', sub: `${n2(t.bt)} ${okS(r.bfw / 4, t.bt) ? '\\ge' : '\\lt'} \\frac{${n2(r.bfw)}}{4} = ${n2(r.bfw / 4)}`, value: r.bfw / 4 / t.bt, unit: '', d: 3, ref: `${ED} Eq. 6.10.11.1.2-2`, ok: okS(r.bfw / 4, t.bt), note: 'b_f: the widest compression flange within the field section.' });
    const vu = (s, lbl, a) => w.add({ id: 'Vu' + s, label: lbl, sym: 'V_{u}', eq: '\\gamma_{DC}(V_{DC1} + V_{DC2}) + \\gamma_{DW}V_{DW} + \\gamma_{LL}V_{LL+IM}', sub: `${n3(g.dc)}(${n2(r['VDC1' + s])} + ${n2(r['VDC2' + s])}) + ${n3(g.dw)}(${n2(r['VDW' + s])}) + ${n3(g.ll)}(${n2(r['VLL' + s])})${r.ut ? ` + ${n3(g.dw)}(${n2(r['VUT' + s])})_{UT} + ${n3(g.dc)}(${n2(r['VUF' + s])})_{UF}` : ''}`, value: a, unit: 'kip', d: 2, ref: tbl });
    vu('', 'Strength I shear at the stiffener', r.Vu); if (r.VuB != null) vu('b', 'Strength I shear, the largest in panel 1', r.VuB); if (r.VuC != null) vu('c', 'Strength I shear, the largest in panel 2', r.VuC);
    [r.p1, r.p2].forEach((q, i) => {
      w.add({ id: `p${i + 1}.Vu`, label: `Panel ${i + 1}${q.end ? ' (end panel)' : ''}: shear checked`, sym: 'V_{u}', eq: q.pan ? `\\max(V_{u}, V_{u,panel ${i + 1}})` : 'V_{u}', sub: q.pan ? `\\max(${n2(r.Vu)}, ${n2(i ? r.VuC : r.VuB)})` : '', value: q.Vu, unit: 'kip', d: 2, ref: `${ED} Art. 6.10.9.3.1`, note: q.pan ? 'The largest shear in the panel.' : 'No panel shears given: the shear at the stiffener.' });
      const vn = SH().panelSteps(w, `p${i + 1}`, q, { D: r.D, tw: r.tw, Fyw, doIn: q.do, end: q.end, flgA: r.flgA });
      w.add({ id: `p${i + 1}.ok`, label: `Panel ${i + 1}: web shear (TS4)`, sym: 'V_{u} \\le \\phi_{v}V_{n}', eq: '', sub: `${n2(q.Vu)} ${ge(q.phVn, q.Vu) ? '\\le' : '\\gt'} 1.0(${n2(q.Vn)})`, value: q.Vu / q.phVn, unit: '', d: 3, ref: `${ED} Art. 6.10.9`, ok: ge(q.phVn, q.Vu), note: `See §${vn}.` });
      if (q.rho > 0) w.add({ id: `p${i + 1}.rho`, label: `Panel ${i + 1}: share of the tension field`, sym: '\\rho_{w}', eq: '\\frac{V_{u} - \\phi_{v}V_{cr}}{\\phi_{v}V_{n} - \\phi_{v}V_{cr}} \\le 1.0', sub: `\\frac{${n2(q.Vu)} - ${n2(q.Vcr)}}{${n2(q.phVn)} - ${n2(q.Vcr)}}`, value: q.rho, unit: '', d: 3, ref: `${ED} Eq. 6.10.11.1.3-10` });
    });
    w.add({ id: 'It', label: t.sides === 2 ? 'Moment of inertia of the pair, about the mid-thickness of the web' : 'Moment of inertia of the single plate, about the face in contact with the web', sym: 'I_{t}', eq: t.sides === 2 ? '\\frac{t_{p}(2b_{t} + t_{w})^{3}}{12}' : '\\frac{t_{p}b_{t}^{3}}{3}', sub: t.sides === 2 ? `\\frac{${n4(t.tp)}(2(${n2(t.bt)}) + ${n4(r.tw)})^{3}}{12}` : `\\frac{${n4(t.tp)}(${n2(t.bt)})^{3}}{3}`, value: r.It, unit: 'in^{4}', d: 2, ref: `${ED} Art. 6.10.11.1.3` });
    w.add({ id: 'J', label: `Stiffener bending rigidity parameter (d_o the smaller adjacent panel, ${n2(r.dmin)} in)`, sym: 'J', eq: '\\frac{2.5}{(d_{o}/D)^{2}} - 2.0 \\ge 0.5', sub: `\\max(\\frac{2.5}{(${n2(r.dmin)}/${n2(r.D)})^{2}} - 2.0, 0.5)`, value: r.J, unit: '', d: 3, ref: `${ED} Eq. 6.10.11.1.3-3` });
    w.add({ id: 'It1', label: 'Required moment of inertia, web shear buckling', sym: 'I_{t1}', eq: 'bt_{w}^{3}J', sub: `${n2(r.b)}(${n4(r.tw)})^{3}(${n3(r.J)})`, value: r.It1, unit: 'in^{4}', d: 2, ref: `${ED} Eq. 6.10.11.1.3-1`, note: 'b: the smaller of d_o and D.' });
    w.add({ id: 'Fcrs', label: 'Local buckling stress of the stiffener', sym: 'F_{crs}', eq: '\\frac{0.31E}{(b_{t}/t_{p})^{2}} \\le F_{ys}', sub: `\\min(\\frac{0.31(29{,}000)}{(${n2(t.bt)}/${n4(t.tp)})^{2}}, ${n2(Fys)})`, value: r.Fcrs, unit: 'ksi', d: 2, ref: `${ED} Eq. 6.10.11.1.3-6` });
    w.add({ id: 'rhot', label: 'Ratio of web to stiffener yield or buckling stress', sym: '\\rho_{t}', eq: '\\max(\\frac{F_{yw}}{F_{crs}}, 1.0)', sub: `\\max(\\frac{${n2(Fyw)}}{${n2(r.Fcrs)}}, 1.0)`, value: r.rhot, unit: '', d: 3, ref: `${ED} Eq. 6.10.11.1.3-5` });
    w.add({ id: 'It2', label: 'Required moment of inertia, tension-field action', sym: 'I_{t2}', eq: '\\frac{D^{4}\\rho_{t}^{1.3}}{40}\\left(\\frac{F_{yw}}{E}\\right)^{1.5}', sub: `\\frac{${n2(r.D)}^{4}(${n3(r.rhot)})^{1.3}}{40}\\left(\\frac{${n2(Fyw)}}{29{,}000}\\right)^{1.5}`, value: r.It2, unit: 'in^{4}', d: 2, ref: `${ED} Eq. 6.10.11.1.3-2` });
    w.add({ id: 'rhow', label: 'Tension-field share, the larger of the two panels', sym: '\\rho_{w}', eq: '\\max(\\rho_{w,1}, \\rho_{w,2})', sub: `\\max(${n3(r.p1.rho)}, ${n3(r.p2.rho)})`, value: r.rhow, unit: '', d: 3, ref: `${ED} Art. 6.10.11.1.3`,
      note: r.rhow > 0 ? 'A panel relies on tension-field action.' : r.ntf ? 'Neither panel has V_u > φ_vV_cr: no tension field.' : 'A panel with V_u > φ_vV_cr cannot use the tension field (end or unstiffened panel; TS4 fails it).' });
    w.add({ id: 'Ireq', label: `Required moment of inertia (TS3, Eq. ${r.IreqEq})`, sym: 'I_{t} \\ge I_{req}', eq: r.rhow > 0 ? (r.It2 > r.It1 ? 'I_{t1} + (I_{t2} - I_{t1})\\rho_{w}' : 'I_{t2}') : r.ntf ? '\\min(I_{t1}, I_{t2})' : 'I_{t1}',
      sub: `${n2(r.It)} ${ge(r.It, r.Ireq) ? '\\ge' : '\\lt'} ${n2(r.Ireq)}`, value: r.Ireq / r.It, unit: '', d: 3, ref: `${ED} Eq. ${r.IreqEq}`, ok: ge(r.It, r.Ireq) });
    [r.p1, r.p2].forEach((q, i) => { const lim = (q.end ? 1.5 : 3) * r.D; w.add({ id: `p${i + 1}.st`, label: `Panel ${i + 1}: spacing limit (TS5)`, sym: 'd_{o}', eq: `d_{o} \\le ${q.end ? '1.5' : '3'}D`, sub: `${n2(q.do)} ${ge(lim, q.do) ? '\\le' : '\\gt'} ${n2(lim)}`, value: q.do / lim, unit: '', d: 3, ref: `${ED} Art. 6.10.9.1`, ok: ge(lim, q.do) || !q.stiff, note: ge(lim, q.do) ? '' : 'Wider than the limit: the panel is unstiffened for shear (TS4, k = 5, V_n = CV_p).' }); });
    if (t.role === 'int') w.add({ id: 'gap', label: 'Web weld cutoff at the tension flange (TS6)', sym: '4t_{w} \\le g \\le 6t_{w}', eq: '', sub: `${n2(4 * r.tw)} \\le ${n2(t.gap)} \\le ${n2(6 * r.tw)}`, value: t.gap, unit: 'in', d: 3, ref: `${ED} Art. 6.10.11.1.1`, ok: ge(t.gap, 4 * r.tw) && ge(6 * r.tw, t.gap) });
    { const m1 = wMinFor(Math.max(r.tw, t.tpF ?? t.tp)); w.add({ id: 'wW', label: 'Minimum fillet weld to the web (TS7)', sym: 'w \\ge w_{min}', eq: '', sub: `${n4(t.w)} ${ge(t.w, m1) ? '\\ge' : '\\lt'} ${n4(m1)}`, value: m1 / t.w, unit: '', d: 3, ref: `${ED} Table 6.13.3.4-1`, ok: ge(t.w, m1), note: `Thicker part ${frac(Math.max(r.tw, t.tpF ?? t.tp))} in.` }); }
    if (t.role === 'cp') { const tf = Math.max(r.tfc, r.tft, t.tpF ?? t.tp), m2 = wMinFor(tf);
      w.add({ id: 'wF', label: 'Minimum fillet weld to the flanges (TS7)', sym: 'w_{f} \\ge w_{min}', eq: '', sub: `${n4(t.wf)} ${ge(t.wf, m2) ? '\\ge' : '\\lt'} ${n4(m2)}`, value: m2 / t.wf, unit: '', d: 3, ref: `${ED} Table 6.13.3.4-1`, ok: ge(t.wf, m2) });
      w.add({ id: 'cp', label: 'Connection plate welds to the flanges (CP1)', sym: 'R_{r}', eq: 'n_{pl}(2)(0.6)\\phi_{e2}F_{exx}(0.707w_{f})(b_{t} - c)', sub: `${t.sides}(2)(0.6)(0.80)(${n2(R.Fexx)})(0.707)(${n4(t.wf)})(${n2(t.bt)} - ${n2(t.c)})`, value: r.Rcp, unit: 'kip', d: 2, ref: `${ED} Art. 6.6.1.3.1, Eq. 6.13.3.2.4b-1`, ok: ge(r.Rcp, t.Fcp), note: `F = ${n2(t.Fcp)} kip (20 kip without better information on straight, nonskewed bridges).` }); }
    if (r.df > 0) { const th = (transverseChecks(R).find(c => c.id === 'CP2') || {}).th || 12; w.add({ id: 'fat', label: 'Fatigue at the stiffener weld toes (CP2)', sym: '\\gamma(\\Delta f) \\le (\\Delta F)_{TH}', eq: '', sub: `${n2(g.fat)}(${n2(r.df)}) = ${n2(r.fat)} ${ge(th, r.fat) ? '\\le' : '\\gt'} ${n2(th)}`, value: r.fat / th, unit: '', d: 3, ref: `${ED} Art. 6.6.1.2, Table 6.6.1.2.3-1`, ok: ge(th, r.fat) }); }
    { const E = R.env, rF = E.rule('ts.fascia'), rM = E.rule('ts.min') || E.rule('stiff.min'); if (rF || rM) w.add({ id: 'own', label: 'Owner details (TS8)', sym: '', eq: '', sub: '', value: [rF, rM].filter(Boolean).map(E.cite).join('; '), unit: '', d: 0, note: [rF, rM].filter(Boolean).map(q => q.text).join(' ') }); }
    return w.steps;
  }

  /* ================= bearing stiffeners (bsCompute, bsChecks) ================= */
  const BS_DEFAULT = { D: 60, gW: '50W', gS: '50W', Fexx: 70, gam: { dc: 1.25, dw: 1.50, ll: 1.75 },
    types: { A: { name: 'Abutment', np: 1, bt: 7, tp: 0.875, c: 1, sp: 12, w: 0.3125, conn: 'milled' }, B: { name: 'Pier', np: 2, bt: 8, tp: 1, c: 1, sp: 12, w: 0.3125, conn: 'milled' } },
    rows: [{ name: 'Abut. 1, interior', type: 'A', tw: 0.5625, bft: 16, bfb: 16, tfb: 1, ed: 9, RDC1: 60, RDC2: 9, RDW: 10, RLL: 95 },
      { name: 'Pier 1, interior', type: 'B', tw: 0.5625, bft: 18, bfb: 18, tfb: 1.5, ed: 0, RDC1: 190, RDC2: 28, RDW: 32, RLL: 140 }] };
  /* bearing(B, env): bsCompute. B = { D, gW, gS, Fexx, gam: { dc, dw, ll }, types: { A, B: { name, np, bt, tp, c, sp, w, conn } },
     rows: [{ name, type, tw, bft, bfb, tfb, ed (in to the girder end, 0 = none), RDC1, RDC2, RDW, RLL (kip), ut, pl }] }. */
  function bearing(B, env) {
    const E = env0(env), errors = [], num = v => typeof v === 'number' ? v : parseDim(v);
    const D = num(B.D), Fexx = num(B.Fexx), gS = GRADES[B.gS], gW = GRADES[B.gW];
    if (!(D > 0)) errors.push('Web depth D must be positive.');
    if (!(Fexx > 0)) errors.push('Electrode strength F_EXX must be positive.');
    ['dc', 'dw', 'll'].forEach(k => { if (!(num(B.gam[k]) >= 0)) errors.push(`Load factor "${k}" must be zero or positive.`); });
    const types = {};
    Object.entries(B.types).forEach(([k, t]) => {
      const q = { k, name: t.name, conn: t.conn }; ['bt', 'tp', 'c', 'sp', 'w'].forEach(f => q[f] = num(t[f])); q.np = +t.np;
      const lbl = `Type ${k} stiffener`;
      if (!(Number.isInteger(q.np) && q.np >= 1 && q.np <= 3)) errors.push(`${lbl}: number of pairs must be 1, 2, or 3.`);
      ['bt', 'tp', 'w'].forEach(f => { if (!(q[f] > 0)) errors.push(`${lbl}: "${f}" must be positive.`); });
      if (!(q.c >= 0)) errors.push(`${lbl}: clip must be zero or positive.`);
      if (q.np > 1 && !(q.sp > q.tp)) errors.push(`${lbl}: pair spacing must exceed the plate thickness.`);
      if (q.c >= q.bt) errors.push(`${lbl}: clip must be smaller than the stiffener width.`);
      { const sW = E.ws; if (sW && q.tp > 0) { q.tpF = q.tp; q.ws = sW; q.tp = q.tp - sW; if (!(q.tp > 0)) errors.push(`${lbl}: the plate must be thicker than the ${frac(sW)} in sacrificial thickness (uncoated weathering steel).`); } }
      types[k] = q;
    });
    if (!B.rows.length) errors.push('Add at least one bearing.');
    B.rows.forEach((r, i) => { const lbl = `Bearing ${i + 1} (${r.name || 'unnamed'})`;
      ['tw', 'bft', 'bfb', 'tfb'].forEach(f => { if (!(num(r[f]) > 0)) errors.push(`${lbl}: "${f}" must be positive.`); });
      if (!(num(r.ed) >= 0)) errors.push(`${lbl}: distance to girder end must be zero (none) or positive.`);
      ['RDC1', 'RDC2', 'RDW', 'RLL'].forEach(f => { if (!isFinite(num(r[f]))) errors.push(`${lbl}: "${f}" must be a number.`); });
      if (!types[r.type]) errors.push(`${lbl}: stiffener type must be A or B.`); });
    if (errors.length) return { errors };
    const L = E.lf, gO = k => k === 'dc' || k === 'dw' ? L.eta : k === 'll' ? L.eta * L.m : 1, g = k => num(B.gam[k]) * gO(k), Fys = gS.Fy, Fyw = gW.Fy, rootE = Math.sqrt(ES / Fys);   // OWN6/OWN7 (OWN_K.bstf)
    const rows = B.rows.map((r0, i) => {
      const r = { i, name: r0.name || `Bearing ${i + 1}`, type: r0.type }; ['tw', 'bft', 'bfb', 'tfb', 'ed', 'RDC1', 'RDC2', 'RDW', 'RLL'].forEach(f => r[f] = num(r0[f]));
      const t = types[r.type], tw = r.tw;
      plAdjust(r0, r, ['RLL'], L.m);
      r.Ru = g('dc') * (r.RDC1 + r.RDC2) + g('dw') * r.RDW + g('ll') * r.RLL;
      r.bLim = 0.48 * t.tp * rootE;
      r.bAvail = (Math.min(r.bft, r.bfb) - tw) / 2;
      r.bEff = Math.min(t.bt, (r.bfb - tw) / 2) - t.c;
      r.Apn = 2 * t.np * r.bEff * t.tp;
      r.Rsb = 1.0 * 1.4 * r.Apn * Fys;
      r.red = Fyw < Fys ? Fyw / Fys : 1.0;
      r.strip9 = 9 * tw * r.red;
      const grp = (t.np - 1) * t.sp + t.tp; r.grp = grp;
      r.sEnd = r.ed > 0 ? Math.min(r.strip9, Math.max(0, r.ed - t.tp / 2)) : r.strip9;
      r.Ltot = r.strip9 + grp + r.sEnd; r.Lw = r.Ltot - t.np * t.tp;
      r.As = 2 * t.np * t.bt * t.tp, r.Aw = r.Lw * tw, r.A = r.As + r.Aw + t.np * t.tp * tw;
      r.I = t.np * t.tp * (2 * t.bt + tw) ** 3 / 12 + r.Lw * tw ** 3 / 12;
      r.rg = Math.sqrt(r.I / r.A); r.KL = 0.75 * D; r.sl = r.KL / r.rg;
      r.AwS = (r.strip9 + r.sEnd) * tw; r.AwI = r.Aw - r.AwS;
      r.Po = Fys * (r.As + t.np * t.tp * tw) + (r.red < 1 ? Fys : Fyw) * r.AwS + Fyw * r.AwI;
      r.Pe = Math.PI ** 2 * ES * r.A / r.sl ** 2;
      r.ratio = r.Po / r.Pe;
      r.Pn = r.ratio <= 2.25 ? Math.pow(0.658, r.ratio) * r.Po : 0.877 * r.Pe;
      r.Pr = 0.95 * r.Pn;
      r.Lweld = 4 * t.np * (D - 2 * t.c);
      r.Rw1 = 0.6 * 0.80 * Fexx * 0.707 * t.w;
      r.Rweld = r.Rw1 * r.Lweld;
      r.wMin = Math.max(tw, t.tpF ?? t.tp) > 0.75 ? 0.3125 : 0.25;
      return r;
    });
    return { errors: [], D, Fys, Fyw, Fexx, types, rows, rootE, gS, gW, g: { dc: g('dc'), dw: g('dw'), ll: g('ll') }, env: E };
  }
  /* bearingChecks(R): bsChecks(R). */
  function bearingChecks(R) {
    const out = ckNew(), grp1 = 'Stiffener resistance', grp2 = 'Welds and detailing', st = (d, c) => ge(c, d) ? 'pass' : 'fail', lbl = r => `${r.name} (Type ${r.type})`, E = R.env;
    { const c = { id: 'BS1', grp: grp1, title: 'Projecting width of stiffener', ref: `${ED} Eq. 6.10.11.2.2-1`, items: [] };
      Object.values(R.types).filter(t => R.rows.some(r => r.type === t.k)).forEach(t => { const lim = 0.48 * t.tp * R.rootE, r = t.bt / lim; c.items.push({ loc: `Type ${t.k}, ${t.name}`, demand: t.bt, capacity: lim, r, st: st(t.bt, lim), step: `bsT${t.k}.b` }); });
      out.add(c); }
    { const c = { id: 'BS2', grp: grp1, title: 'Bearing resistance', ref: `${ED} Eqs. 6.10.11.2.3-1, -2`, items: [] };
      R.rows.forEach(r => c.items.push({ loc: lbl(r), demand: r.Ru, capacity: r.Rsb, r: r.Ru / r.Rsb, st: st(r.Ru, r.Rsb), step: `bs${r.i}.Rsb.ok` })); out.add(c); }
    { const c = { id: 'BS3', grp: grp1, title: 'Axial resistance as a column', ref: `${ED} Art. 6.10.11.2.4, 6.9.2.1, 6.9.4.1.1`, items: [] };
      R.rows.forEach(r => c.items.push({ loc: lbl(r), demand: r.Ru, capacity: r.Pr, r: r.Ru / r.Pr, st: st(r.Ru, r.Pr), step: `bs${r.i}.Pr.ok` })); out.add(c); }
    { const c = { id: 'BS4', grp: grp2, title: 'Stiffener-to-web fillet welds', ref: `${ED} Eq. 6.13.3.2.4b-1`, items: [] };
      R.rows.forEach(r => c.items.push({ loc: lbl(r), demand: r.Ru, capacity: r.Rweld, r: r.Ru / r.Rweld, st: st(r.Ru, r.Rweld), step: `bs${r.i}.weld.ok` })); out.add(c); }
    { const c = { id: 'BS5', grp: grp2, title: 'Minimum fillet weld size', ref: `${ED} Art. 6.13.3.4, Table 6.13.3.4-1`, items: [] };
      R.rows.forEach(r => { const t = R.types[r.type], ok = ge(t.w, r.wMin); c.items.push({ loc: lbl(r), demand: r.wMin, capacity: t.w, r: r.wMin / t.w, st: ok ? 'pass' : 'fail', step: `bs${r.i}.wmin` }); }); out.add(c); }
    { const c = { id: 'BS6', grp: grp2, title: 'Stiffener width and flange connection', ref: `${ED} Art. 6.10.11.2.1`, items: [] };
      R.rows.forEach(r => { const t = R.types[r.type];
        const okW = ge(r.bAvail, t.bt); c.items.push({ loc: `${lbl(r)}, width within narrower flange`, demand: t.bt, capacity: r.bAvail, st: okW ? 'pass' : 'fail', r: t.bt / r.bAvail, step: `bs${r.i}.bw` });
        const gap = r.bAvail - t.bt; if (okW) c.items.push({ loc: `${lbl(r)}, distance to flange edge`, demand: gap, capacity: 1, st: gap <= 1 + 1e-9 ? 'pass' : 'warn', step: `bs${r.i}.bw` });
        const okC = t.conn !== 'fillet'; c.items.push({ loc: `${lbl(r)}, bottom flange connection`, st: okC ? 'pass' : 'fail', step: `bs${r.i}.conn` }); });
      out.add(c); }
    const rBm = E.rule('bs.min') || E.rule('stiff.min'), tMin = rBm ? (rBm.value.t ?? rBm.value.bs) + E.ws : 0;   // OWN38
    if (rBm) { const c = { id: 'BS7', grp: grp2, title: 'Owner: minimum bearing stiffener thickness', ref: E.cite(rBm), src: 'DOT', items: [] };
      R.rows.forEach(r => { const t = R.types[r.type], tp = t.tpF ?? t.tp, ok = ge(tp, tMin); c.items.push({ loc: lbl(r), demand: tMin, capacity: tp, r: tMin / tp, st: ok ? 'pass' : 'fail', step: `bs${r.i}.own` }); });
      out.add(c); }
    return out;
  }
  /* bearingSteps(R, r): the worked steps of one bearing (with its stiffener type's BS1). */
  function bearingSteps(R, r) {
    const t = R.types[r.type], w = St().work('bs' + r.i), g = R.g, okS = (d, c) => ge(c, d), tbl = `${ED} Tables 3.4.1-1, 3.4.1-2`;
    const wt = St().work('bsT' + t.k), lim = 0.48 * t.tp * R.rootE;
    wt.add({ id: 'b', label: `Type ${t.k}: projecting width (BS1)`, sym: 'b_{t} \\le 0.48t_{p}\\sqrt{\\frac{E}{F_{ys}}}', eq: '', sub: `${n2(t.bt)} ${okS(t.bt, lim) ? '\\le' : '\\gt'} 0.48(${n4(t.tp)})\\sqrt{\\frac{29{,}000}{${n2(R.Fys)}}} = ${n2(lim)}`, value: t.bt / lim, unit: '', d: 3, ref: `${ED} Eq. 6.10.11.2.2-1`, ok: okS(t.bt, lim), note: 'Prevents local buckling of the plates, so the column check uses Q = 1.' });
    w.take(wt.steps);
    w.add({ id: 'Ru', label: 'Strength I reaction', sym: 'R_{u}', eq: '\\gamma_{DC}(R_{DC1} + R_{DC2}) + \\gamma_{DW}R_{DW} + \\gamma_{LL}R_{LL+IM}', sub: `${n3(g.dc)}(${n2(r.RDC1)} + ${n2(r.RDC2)}) + ${n3(g.dw)}(${n2(r.RDW)}) + ${n3(g.ll)}(${n2(r.RLL)})`, value: r.Ru, unit: 'kip', d: 2, ref: tbl, note: 'Every reaction component adds to the stiffener force: the maximum load factors.' });
    w.add({ id: 'bEff', label: 'Plate width in bearing (outside the clip, within the bottom flange)', sym: 'b_{t,eff}', eq: '\\min(b_{t}, \\frac{b_{fb} - t_{w}}{2}) - c', sub: `\\min(${n2(t.bt)}, \\frac{${n2(r.bfb)} - ${n4(r.tw)}}{2}) - ${n2(t.c)}`, value: r.bEff, unit: 'in', d: 3, ref: `${ED} Art. 6.10.11.2.3` });
    w.add({ id: 'Apn', label: 'Area of the projecting elements in bearing', sym: 'A_{pn}', eq: '2n_{p}b_{t,eff}t_{p}', sub: `2(${t.np})(${n3(r.bEff)})(${n4(t.tp)})`, value: r.Apn, unit: 'in^{2}', d: 3, ref: `${ED} Art. 6.10.11.2.3` });
    w.add({ id: 'Rsb', label: 'Factored bearing resistance', sym: '(R_{sb})_{r}', eq: '\\phi_{b}(1.4)A_{pn}F_{ys}', sub: `1.0(1.4)(${n3(r.Apn)})(${n2(R.Fys)})`, value: r.Rsb, unit: 'kip', d: 2, ref: `${ED} Eqs. 6.10.11.2.3-1, -2` });
    w.add({ id: 'Rsb.ok', label: 'Bearing resistance (BS2)', sym: 'R_{u} \\le (R_{sb})_{r}', eq: '', sub: `${n2(r.Ru)} ${okS(r.Ru, r.Rsb) ? '\\le' : '\\gt'} ${n2(r.Rsb)}`, value: r.Ru / r.Rsb, unit: '', d: 3, ref: `${ED} Art. 6.10.11.2.3`, ok: okS(r.Ru, r.Rsb) });
    w.add({ id: 'strip', label: `Web strip each side of the stiffeners${r.red < 1 ? ', reduced by F_yw/F_ys' : ''}`, sym: '9t_{w}', eq: r.red < 1 ? '9t_{w}\\frac{F_{yw}}{F_{ys}}' : '9t_{w}', sub: r.red < 1 ? `9(${n4(r.tw)})(${n3(r.red)})` : `9(${n4(r.tw)})`, value: r.strip9, unit: 'in', d: 3, ref: `${ED} Art. 6.10.11.2.4b` });
    if (r.ed > 0) w.add({ id: 'sEnd', label: 'Web strip on the end side (limited by the distance to the girder end)', sym: 's_{end}', eq: '\\min(9t_{w}, e_{d} - \\frac{t_{p}}{2})', sub: `\\min(${n3(r.strip9)}, ${n2(r.ed)} - \\frac{${n4(t.tp)}}{2})`, value: r.sEnd, unit: 'in', d: 3, ref: `${ED} Art. 6.10.11.2.4b` });
    w.add({ id: 'Lw', label: 'Web length in the column outside the plates', sym: 'L_{w}', eq: '9t_{w} + [(n_{p} - 1)s + t_{p}] + s_{end} - n_{p}t_{p}', sub: `${n3(r.strip9)} + ${n3(r.grp)} + ${n3(r.sEnd)} - ${t.np}(${n4(t.tp)})`, value: r.Lw, unit: 'in', d: 3, ref: `${ED} Art. 6.10.11.2.4b` });
    w.add({ id: 'A', label: 'Area of the effective column', sym: 'A', eq: '2n_{p}b_{t}t_{p} + n_{p}t_{p}t_{w} + L_{w}t_{w}', sub: `${n3(r.As)} + ${n3(t.np * t.tp * r.tw)} + ${n3(r.Aw)}`, value: r.A, unit: 'in^{2}', d: 3, ref: `${ED} Art. 6.10.11.2.4b` });
    w.add({ id: 'I', label: 'Moment of inertia about the mid-thickness of the web', sym: 'I', eq: 'n_{p}\\frac{t_{p}(2b_{t} + t_{w})^{3}}{12} + \\frac{L_{w}t_{w}^{3}}{12}', sub: `${t.np}\\frac{${n4(t.tp)}(2(${n2(t.bt)}) + ${n4(r.tw)})^{3}}{12} + \\frac{${n3(r.Lw)}(${n4(r.tw)})^{3}}{12}`, value: r.I, unit: 'in^{4}', d: 2, ref: `${ED} Art. 6.10.11.2.4b` });
    w.add({ id: 'rs', label: 'Radius of gyration', sym: 'r_{s}', eq: '\\sqrt{\\frac{I}{A}}', sub: `\\sqrt{\\frac{${n2(r.I)}}{${n3(r.A)}}}`, value: r.rg, unit: 'in', d: 3 });
    w.add({ id: 'sl', label: 'Slenderness, effective length KL = 0.75D', sym: '\\frac{KL}{r_{s}}', eq: '\\frac{0.75D}{r_{s}}', sub: `\\frac{0.75(${n2(R.D)})}{${n3(r.rg)}}`, value: r.sl, unit: '', d: 2, ref: `${ED} Art. 6.10.11.2.4a` });
    w.add({ id: 'Po', label: 'Equivalent nominal yield resistance (Q = 1)', sym: 'P_{o}', eq: r.red < 1 ? 'F_{ys}(A_{s} + n_{p}t_{p}t_{w} + A_{w,strips}) + F_{yw}A_{w,between}' : 'F_{ys}(A_{s} + n_{p}t_{p}t_{w}) + F_{yw}A_{w}', sub: r.red < 1 ? `${n2(R.Fys)}(${n3(r.As)} + ${n3(t.np * t.tp * r.tw)} + ${n3(r.AwS)}) + ${n2(R.Fyw)}(${n3(r.AwI)})` : `${n2(R.Fys)}(${n3(r.As + t.np * t.tp * r.tw)}) + ${n2(R.Fyw)}(${n3(r.AwS + r.AwI)})`, value: r.Po, unit: 'kip', d: 1, ref: `${ED} Art. 6.9.4.1.1, 6.10.11.2.4b` });
    w.add({ id: 'Pe', label: 'Elastic critical buckling resistance', sym: 'P_{e}', eq: '\\frac{\\pi^{2}EA_{g}}{(KL/r_{s})^{2}}', sub: `\\frac{\\pi^{2}(29{,}000)(${n3(r.A)})}{(${n2(r.sl)})^{2}}`, value: r.Pe, unit: 'kip', d: 1, ref: `${ED} Eq. 6.9.4.1.2-1` });
    w.add({ id: 'Pn', label: `Nominal compressive resistance (P_o/P_e = ${n3(r.ratio)} ${r.ratio <= 2.25 ? '≤' : '>'} 2.25)`, sym: 'P_{n}', eq: r.ratio <= 2.25 ? '0.658^{P_{o}/P_{e}}P_{o}' : '0.877P_{e}', sub: r.ratio <= 2.25 ? `0.658^{${n3(r.ratio)}}(${n2(r.Po)})` : `0.877(${n2(r.Pe)})`, value: r.Pn, unit: 'kip', d: 2, ref: `${ED} Eq. 6.9.4.1.1-${r.ratio <= 2.25 ? 1 : 2}` });
    w.add({ id: 'Pr', label: 'Factored axial resistance', sym: 'P_{r}', eq: '\\phi_{c}P_{n}', sub: `0.95(${n2(r.Pn)})`, value: r.Pr, unit: 'kip', d: 2, ref: `${ED} Eq. 6.9.2.1-1` });
    w.add({ id: 'Pr.ok', label: 'Axial resistance of the effective column (BS3)', sym: 'R_{u} \\le P_{r}', eq: '', sub: `${n2(r.Ru)} ${okS(r.Ru, r.Pr) ? '\\le' : '\\gt'} ${n2(r.Pr)}`, value: r.Ru / r.Pr, unit: '', d: 3, ref: `${ED} Art. 6.10.11.2.4`, ok: okS(r.Ru, r.Pr) });
    w.add({ id: 'weld', label: 'Stiffener-to-web fillet welds, four per pair', sym: 'R_{r}', eq: '0.6\\phi_{e2}F_{exx}(0.707w)[4n_{p}(D - 2c)]', sub: `0.6(0.80)(${n2(R.Fexx)})(0.707)(${n4(t.w)})[4(${t.np})(${n2(R.D)} - 2(${n2(t.c)}))]`, value: r.Rweld, unit: 'kip', d: 2, ref: `${ED} Eq. 6.13.3.2.4b-1` });
    w.add({ id: 'weld.ok', label: 'Stiffener-to-web welds (BS4)', sym: 'R_{u} \\le R_{r}', eq: '', sub: `${n2(r.Ru)} ${okS(r.Ru, r.Rweld) ? '\\le' : '\\gt'} ${n2(r.Rweld)}`, value: r.Ru / r.Rweld, unit: '', d: 3, ref: `${ED} Art. 6.13.3.2.4b`, ok: okS(r.Ru, r.Rweld), note: 'The full reaction is assumed to pass from the stiffeners into the web through these welds.' });
    w.add({ id: 'wmin', label: 'Minimum fillet weld size (BS5)', sym: 'w \\ge w_{min}', eq: '', sub: `${n4(t.w)} ${ge(t.w, r.wMin) ? '\\ge' : '\\lt'} ${n4(r.wMin)}`, value: r.wMin / t.w, unit: '', d: 3, ref: `${ED} Table 6.13.3.4-1`, ok: ge(t.w, r.wMin) });
    w.add({ id: 'bw', label: 'Stiffener width within the narrower flange (BS6)', sym: 'b_{t} \\le \\frac{b_{f,min} - t_{w}}{2}', eq: '', sub: `${n2(t.bt)} ${ge(r.bAvail, t.bt) ? '\\le' : '\\gt'} \\frac{${n2(Math.min(r.bft, r.bfb))} - ${n4(r.tw)}}{2} = ${n2(r.bAvail)}`, value: t.bt / r.bAvail, unit: '', d: 3, ref: `${ED} Art. 6.10.11.2.1`, ok: ge(r.bAvail, t.bt), note: '"As near as practical" to the flange edges is taken as within 1 in (warning only).' });
    w.add({ id: 'conn', label: 'Connection to the bottom flange (BS6)', sym: '', eq: '', sub: '', value: { milled: 'milled to bear', cjp: 'CJP groove weld', fillet: 'fillet welds (not permitted)' }[t.conn] || String(t.conn), unit: '', d: 0, ref: `${ED} Art. 6.10.11.2.1`, ok: t.conn !== 'fillet' });
    { const E = R.env, rBm = E.rule('bs.min') || E.rule('stiff.min'); if (rBm) { const tMin = (rBm.value.t ?? rBm.value.bs) + E.ws, tp = t.tpF ?? t.tp; w.add({ id: 'own', label: 'Owner minimum thickness (BS7)', sym: 't_{p} \\ge t_{min}', eq: '', sub: `${n4(tp)} ${ge(tp, tMin) ? '\\ge' : '\\lt'} ${n4(tMin)}`, value: tMin / tp, unit: '', d: 3, ref: E.cite(rBm), ok: ge(tp, tMin), note: rBm.text }); } }
    return w.steps;
  }

  /* ================= layout (Preliminary sizing TB1) ================= */
  /* baysOf(sup, cont, bear, ints): the bays of one girder: between consecutive bearings and intermediate cross-frame stations (ft from the
     girder's first bearing; bear = its bearings, one per support, ints = its intermediate cross-frame stations). endA / endB: the bay ends at an
     abutment bearing, or at any bearing of a simple span (6.10.9.3.3 end panel); k = span. (tsBaysOf) */
  function baysOf(sup, cont, bear, ints) {
    const nS = sup.length, endK = k => k === 0 || k === nS - 1 || !cont, pts = [];
    bear.forEach((x, k) => pts.push({ s: x, e: endK(k) }));
    (ints || []).forEach(s => pts.push({ s, e: false }));
    pts.sort((p, q) => p.s - q.s);
    const u = []; pts.forEach(p => { const l = u[u.length - 1]; if (l && p.s - l.s < 0.05) { l.e = l.e || p.e; return; } u.push({ ...p }); });
    const spanOf = x => { let k = 0; while (k < bear.length - 2 && x >= bear[k + 1] - 1e-6) k++; return k; };
    const out = []; for (let j = 0; j < u.length - 1; j++) out.push({ a: +u[j].s.toFixed(3), b: +u[j + 1].s.toFixed(3), endA: u[j].e, endB: u[j + 1].e, k: spanOf((u[j].s + u[j + 1].s) / 2) });
    return out;
  }
  /* bayX(B): the stiffener stations of a bay { a, b, n, e0, e1 } (ft): end stiffeners at e0 / e1 (in) from a / b first, then the rest evenly (tsBayX) */
  function bayX(B) {
    let lo = B.a, hi = B.b, n = Math.max(0, Math.round(+B.n || 0)); const xs = [];
    if (+B.e0 > 0 && n > 0 && lo + B.e0 / 12 < hi - 0.05) { lo += B.e0 / 12; xs.push(lo); n--; }
    if (+B.e1 > 0 && n > 0 && hi - B.e1 / 12 > lo + 0.05) { hi -= B.e1 / 12; xs.push(hi); n--; }
    for (let j = 1; j <= n; j++) xs.push(lo + (hi - lo) * j / (n + 1));
    return xs.sort((p, q) => p - q);
  }
  /* bayPanels(B): the panels of a bay: p..q (ft), d (in), end, sp / sq (the panel starts / ends at an intermediate stiffener) (tsPanels) */
  function bayPanels(B) { const x = [B.a, ...bayX(B), B.b]; return x.slice(1).map((q, j) => ({ p: x[j], q, d: (q - x[j]) * 12, end: (j === 0 && !!B.endA) || (j === x.length - 2 && !!B.endB), sp: j > 0, sq: j < x.length - 2 })); }
  /* girderBays(lay, D, sup, cont, bear, ints, gNo): tsGirderBays. lay = { web: 'stiffened' | 'unstiffened', mode: 'uniform' | 'bays', doRatio,
     bays: [{ g (1-based girder number), a, b (ft), n, e0, e1 (in) }] }. A stored entry for a bay (set: true), else the uniform d_o/D evenly
     spaced (set: false). Unstiffened: no intermediate stiffener (n = 0; the connection plates at the cross-frames remain). */
  function girderBays(lay, D, sup, cont, bear, ints, gNo) {
    const L = lay || {}, on = L.web !== 'unstiffened', st = on && L.mode === 'bays' && Array.isArray(L.bays) ? L.bays.filter(q => +q.g === gNo) : [], dR = nm(L.doRatio) || 1;
    return baysOf(sup, cont, bear, ints).map(B0 => { const q = st.find(z => Math.abs(+z.a - B0.a) < 0.02 && Math.abs(+z.b - B0.b) < 0.02);
      if (!on) return { ...B0, n: 0, e0: 0, e1: 0, set: true };
      if (q) return { ...B0, n: Math.max(0, Math.round(+q.n || 0)), e0: +q.e0 || 0, e1: +q.e1 || 0, set: true };
      return { ...B0, n: Math.max(0, Math.ceil((B0.b - B0.a) * 12 / (dR * D) - 1e-9) - 1), e0: 0, e1: 0, set: false }; });
  }
  /* framesDefault(sup, Lb): intermediate cross-frame stations every ≤ L_b (ft) in each span, evenly (no framing module yet; as the
     Flexure tab places the brace points from a hand-off file). */
  function framesDefault(sup, Lb) { const out = []; for (let k = 0; k < sup.length - 1; k++) { const x0 = sup[k], x1 = sup[k + 1], n = Math.max(1, Math.ceil((x1 - x0) / Lb - 1e-9)); for (let j = 1; j < n; j++) out.push(+(x0 + (x1 - x0) * j / n).toFixed(3)); } return out; }

  /* stiffenerRows(bays, sec, dem, opt): the Transverse stiffeners rows for every intermediate stiffener and connection plate of one girder
     (every interior point of the layout between two panels; not the bearings): type A at an intermediate stiffener (the panel on either side
     ends there at a stiffener), else B (a cross-frame connection plate); panel 1 = the end panel when one side is an end panel, else the
     left panel; d_o1, d_o2 the two panels; shears at the point and the largest in each panel (dem.at, dem.inPanel); plates sec(x);
     bfw = the widest compression flange of the field section (opt.bfw(x), default the wider flange at x). df = 0 (the Fatigue tab is later). */
  function stiffenerRows(bays, sec, dem, opt) {
    opt = opt || {}; const pans = bays.flatMap(bayPanels), rows = [];
    for (let j = 0; j < pans.length - 1; j++) { const Lp = pans[j], Rp = pans[j + 1], x = Lp.q; if (Math.abs(Rp.p - x) > 0.01) continue;
      const s = sec(x), first = Rp.end && !Lp.end ? [Rp, Lp] : [Lp, Rp], P1 = first[0], P2 = first[1], typ = Lp.sq ? 'A' : 'B', v = dem.at(x), b = dem.inPanel(P1.p, P1.q), c = dem.inPanel(P2.p, P2.q);
      rows.push({ name: `${opt.label ? opt.label + ', ' : ''}${typ === 'A' ? 'stiffener' : 'connection plate'} at ${x.toFixed(2)} ft`, x, type: typ, D: s.D, tw: s.tw, bfc: s.topB, tfc: s.topT, bft: s.botB, tft: s.botT,
        bfw: opt.bfw ? opt.bfw(x) : Math.max(s.topB, s.botB), end: P1.end ? 'yes' : 'no', do1: P1.d, do2: P2.d, VDC1: v.DC1, VDC2: v.DC2, VDW: v.DW, VLL: v.LL, df: 0,
        VDC1b: b.DC1, VDC2b: b.DC2, VDWb: b.DW, VLLb: b.LL, VDC1c: c.DC1, VDC2c: c.DC2, VDWc: c.DW, VLLc: c.LL,
        ...((v.UT || v.UF || b.UT || b.UF || c.UT || c.UF) ? { ut: { VUT: v.UT, VUF: v.UF, VUTb: b.UT, VUFb: b.UF, VUTc: c.UT, VUFc: c.UF } } : {}) }); }
    return rows;
  }

  window.SBDStiffeners = { ES, GRADES, TS_ROWSPEC, TS_DEFAULT, BS_DEFAULT, parseDim, wMinFor, transverse, transverseChecks, transverseSteps, bearing, bearingChecks, bearingSteps,
    baysOf, bayX, bayPanels, girderBays, framesDefault, stiffenerRows };
})();
