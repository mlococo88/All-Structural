/* apps/steel-bridge/engine/welds.js — flange-to-web fillet welds (AASHTO LRFD 10th Ed. Art. 6.13.3) and shop-welded flange transitions
   (6.13.6.2, 6.6.1.2) of a steel I-girder (window.SBDWelds). Classic script, no DOM. Needs window.SharedSteps, window.SBDSections and
   window.SBDShear (plAdjust), loaded first.

   Ported 2026-10-30 from GirderDetail ("Steel Bridge Design.html"), Welds and transitions module GM.wt (anchor `GM.wt = {`), operation
   for operation: compute(p) and checks(R), with WT_FSPEC, WT_TSPEC, numRows, secSet, rowDk, wMinFor, modRatio:
     FW1 weld metal resistance to the shear flow, v_u = Σγ VQ/I ≤ R_r = 2(0.6)φ_e2 F_exx (0.707w), φ_e2 = 0.80, two fillet welds
         (6.13.3.2.4b, Eq. 6.13.3.2.4b-1); each load on the section that carries it: DC1 (and the utilities) on the steel, DC2 and DW on
         the long-term composite section (3n), LL+IM on the short-term composite section (n); Q of the top flange includes the deck slab
         for the composite stages;
     FW2 web base metal shear rupture, v_u ≤ φ_vu 0.58 F_u t_w, φ_vu = 0.80 (6.13.5.3);
     FW3 fatigue of the weld throat in shear, γ(Δf) = γV_f Q/I / (2(0.707w)) ≤ (ΔF)_TH = 8.0 ksi (Category F, Table 6.6.1.2.3-1,
         Table 6.6.1.2.5-3), Fatigue I on the short-term composite section;
     FW4 minimum fillet weld size (6.13.3.4, Table 6.13.3.4-1): 1/4 in for the thicker part ≤ 3/4 in, else 5/16 in;
     TR1 fatigue at a shop flange butt splice, γ(|f+| + |f−|) ≤ (ΔF)_TH: 16 ksi Category B (ground flush), 10 ksi Category C (not
         ground) (6.6.1.2, Table 6.6.1.2.3-1, Section 5), in the smaller flange at mid-thickness, ΔM+ on the short-term composite section,
         ΔM− on the steel plus the deck reinforcement;
     TR2 thickness transition slope ≤ 1:2.5 (6.13.6.2, Fig. 6.13.6.2-1); TR3 width transition: taper ≤ 1:2.5 or radius ≥ 24 in;
     TR4 transition proportions t_1/t_2 ≥ 0.5 and A_1/A_2 ≥ 0.5 (practice, AASHTO/NSBA G12.1; a warning, not a failure).
   The TeX `work` lines of GirderDetail are replaced by worked steps (SharedSteps). tests/engine/welds.test.mjs checks every value and
   check item against GirderDetail's own functions in Node.
   The welds of stiffeners and connection plates are in engine/stiffeners.js (TS7, CP1, BS4, BS5), not here.

   New here (not in GirderDetail's module, which takes its rows as input):
     - fromDemands(D, opt): the weld locations and transitions of one girder from its demands (this app's analysis, or a hand-off file
       through demandsFromPayload): see its header;
     - an optional second deck reinforcement layer (dk.layers) in the steel + reinforcement section, used by the app with the project's
       two layers; GirderDetail (and the parity tests) have one layer A_r at depth d_r.

   Owner rules (GirderDetail gdOwnM(OWN_K.wt), gdHP, gdPLe): env = { lf: { eta, m, h0 } }: γ_DC, γ_DW × η; γ_LL × η·m; the haunch is 0 in the
   composite properties when h0 (OWN8); the pedestrian part of V_LL+IM (row.pl) is not multiplied by m (GD45). Without env: η = m = 1.

   Units: in, kip, ksi, kip-ft; stations ft. */
(function () {
  'use strict';
  const ED = 'AASHTO LRFD 10th Ed.';
  const St = () => window.SharedSteps, SEC = () => window.SBDSections, SH = () => window.SBDShear;
  const n2 = x => St().n(x, 2), n3 = x => St().n(x, 3), n4 = x => St().n(x, 4), g0 = x => St().g(x, 0);
  const GRADES = { '36': { Fy: 36, Fu: 58 }, '50': { Fy: 50, Fu: 65 }, '50W': { Fy: 50, Fu: 70 }, 'HPS50W': { Fy: 50, Fu: 70 }, 'HPS70W': { Fy: 70, Fu: 85 } };   // GirderDetail GD_GR
  const RANK = { na: 0, pass: 1, adv: 2, warn: 3, fail: 4 };
  const PHI_E2 = 0.80, PHI_VU = 0.80;   // 6.5.4.2: weld metal in fillet welds, shear in throat; shear rupture of the connected element
  const ge = (a, b) => a >= b - 1e-9;
  const sum = a => a.reduce((s, x) => s + x, 0);
  const worst = a => a.reduce((w, s) => RANK[s] > RANK[w] ? s : w, 'na');
  const wMinFor = t => t > 0.75 + 1e-9 ? 0.3125 : 0.25;   // Table 6.13.3.4-1
  function parseDim(v) { if (typeof v === 'number') return v; if (v == null) return NaN; let s = String(v).trim().replace(/["”]/g, '').replace(/(\d)-(\d)/g, '$1 $2').replace(/\s+/g, ' '); if (!s) return NaN;
    let m = s.match(/^(-?\d+(?:\.\d+)?) (\d+)\/(\d+)$/); if (m) return +m[1] + m[2] / m[3]; m = s.match(/^(\d+)\/(\d+)$/); if (m) return m[1] / m[2]; const n = Number(s); return isFinite(n) ? n : NaN; }
  const nm = v => typeof v === 'number' ? v : parseDim(v);
  const frac = x => { const w = Math.floor(x + 1e-9), f = Math.round((x - w) * 16); if (!f) return `${w}`; let a = f, b = 16; while (a % 2 === 0) { a /= 2; b /= 2; } return w ? `${w} ${a}/${b}` : `${a}/${b}`; };
  function numRows(rows, spec, lbl, errors) { return rows.map((r0, i) => { const r = { i, name: r0.name || `${lbl} ${i + 1}` };
    spec.forEach(([k, label, , ty, o]) => { if (ty === 'text' || ty === 'sel') { r[k] = r0[k]; return; }
      if (o && o.opt && (r0[k] == null || r0[k] === '' || (typeof r0[k] === 'number' && isNaN(r0[k])))) { r[k] = null; return; }
      const v = nm(r0[k]); r[k] = v; const min = o && o.min !== undefined ? o.min : (o && o.any ? -Infinity : 1e-12);
      if (!isFinite(v) || v < min) errors.push(`${r.name}: "${label.replace(/<[^>]+>/g, '')}" must be ${o && o.any ? 'a number' : min === 0 ? 'zero or positive' : 'positive'}.`); }); return r; }); }
  const UT = (s, k) => { const v = s && s.ut && typeof s.ut === 'object' ? +s.ut[k] : 0; return isFinite(v) ? v : 0; };   // gdUt
  const utOn = s => !!(s && s.ut && typeof s.ut === 'object' && Object.values(s.ut).some(v => +v));   // gdUtOn

  /* ---------- inputs (GirderDetail WT_FSPEC, WT_TSPEC, GM.wt.def) ---------- */
  const FSPEC = [['name', 'Name', '', 'text'], ['D', 'Web depth D', 'in', 'dim'], ['tw', 'Web t<sub>w</sub>', 'in', 'dim'], ['topB', 'Top flange b', 'in', 'dim'], ['topT', 'Top flange t', 'in', 'dim'], ['botB', 'Bottom flange b', 'in', 'dim'], ['botT', 'Bottom flange t', 'in', 'dim'],
    ['w', 'Fillet weld size', 'in', 'dim'], ['VDC1', 'V<sub>DC1</sub>', 'kip', 'num', { min: 0 }], ['VDC2', 'V<sub>DC2</sub>', 'kip', 'num', { min: 0 }], ['VDW', 'V<sub>DW</sub>', 'kip', 'num', { min: 0 }], ['VLL', 'V<sub>LL+IM</sub>', 'kip', 'num', { min: 0 }], ['Vfr', 'Fatigue shear range', 'kip', 'num', { min: 0 }],
    ['beff', 'b<sub>eff</sub> of this girder (blank: the b<sub>eff</sub> above)', 'in', 'num', { opt: true }]];
  const TSPEC = [['name', 'Name', '', 'text'], ['fl', 'Flange', '', 'sel'], ['b1', 'Smaller side b', 'in', 'dim'], ['t1', 'Smaller side t', 'in', 'dim'], ['b2', 'Larger side b', 'in', 'dim'], ['t2', 'Larger side t', 'in', 'dim'],
    ['Lt', 'Thickness taper length', 'in', 'dim', { min: 0 }], ['wType', 'Width transition', '', 'sel'], ['Lw', 'Width taper length or radius', 'in', 'dim', { min: 0 }],
    ['ground', 'Butt weld ground flush', '', 'sel'], ['D', 'Web depth D', 'in', 'dim'], ['tw', 'Web t<sub>w</sub>', 'in', 'dim'], ['ob', 'Other flange b', 'in', 'dim'], ['ot', 'Other flange t', 'in', 'dim'],
    ['dMp', 'ΔM positive, fatigue truck', 'k-ft', 'num', { min: 0 }], ['dMn', 'ΔM negative, fatigue truck', 'k-ft', 'num', { min: 0 }],
    ['Ar', 'Deck rebar A<sub>r</sub> of this girder (blank: the A<sub>r</sub> above)', 'in²', 'num', { opt: true, min: 0 }], ['dr', 'Rebar depth of this girder (blank: the depth above)', 'in', 'num', { opt: true, min: 0 }],
    ['beff', 'b<sub>eff</sub> of this girder (blank: the b<sub>eff</sub> above)', 'in', 'num', { opt: true }]];
  /* DEFAULT: GirderDetail's built-in Welds and transitions input (GM.wt.def) */
  const DEFAULT = { gF: '50W', gW: '50W', Fexx: 70, gam: { dc: 1.25, dw: 1.50, ll: 1.75, fat: 1.75 }, ts: 8, hh: 2, beff: 114, fc: 4, wc: 0.150, K1: 1.0, nRule: 'exact', Ar: 9.3, dr: 4,
    fw: [{ name: 'Abut. 1, interior', D: 60, tw: 0.5625, topB: 16, topT: 0.75, botB: 16, botT: 1.125, w: 0.3125, VDC1: 60, VDC2: 9, VDW: 10, VLL: 95, Vfr: 45 }],
    tr: [{ name: 'Bottom flange, Span 1 at 45 ft', fl: 'bot', b1: 16, t1: 1.125, b2: 16, t2: 1.5, Lt: 1, wType: 'none', Lw: 0, ground: 'yes', D: 60, tw: 0.5625, ob: 16, ot: 0.75, dMp: 650, dMn: 180 }] };

  /* ---------- sections (GirderDetail secSet, rowDk) ---------- */
  /* secSet(D, s, dk): steel s, long-term c3 (3n), short-term cn (n), steel + reinforcement r. dk = { ts, hh, beff, n, Ar, dr } (dr: depth of
     the reinforcement below the top of the slab); dk.layers = [[A, depth], …] (this app: the project's layers, added in order) in place of Ar, dr. */
  function secSet(D, s, dk) {
    const ps = SEC().steelCore({ D, tw: s.tw, topB: s.topB, topT: s.topT, botB: s.botB, botT: s.botT }), ySlab = ps.d + dk.hh + dk.ts / 2, o = { s: ps }, add = SEC().addPart;
    if (dk.n > 0) { o.c3 = add(ps, dk.beff * dk.ts / (3 * dk.n), ySlab, dk.beff * dk.ts ** 3 / 12 / (3 * dk.n)); o.cn = add(ps, dk.beff * dk.ts / dk.n, ySlab, dk.beff * dk.ts ** 3 / 12 / dk.n); o.ySlab = ySlab; }
    if (Array.isArray(dk.layers)) { let r = ps; dk.layers.forEach(([A, dp]) => { if (A > 0) r = add(r, A, ps.d + dk.hh + dk.ts - dp, 0); }); o.r = r; }
    else if (dk.Ar > 0) o.r = add(ps, dk.Ar, ps.d + dk.hh + dk.ts - dk.dr, 0); else o.r = ps;
    return o;
  }
  function rowDk(dk, r) { const o = {}; if (r.beff > 0) o.beff = r.beff; if (r.Ar != null && r.Ar >= 0) { o.Ar = r.Ar; o.layers = undefined; } if (r.dr != null && r.dr >= 0) { o.dr = r.dr; o.layers = undefined; } return Object.keys(o).length ? { ...dk, ...o } : dk; }

  /* ---------- compute (GM.wt.compute) ---------- */
  /* compute(p, env): p as DEFAULT (rows: FSPEC / TSPEC fields; a weld row may carry ut: { VUT, VUF } and pl: { VLL: [part, value] });
     p.layers (optional, this app) = [[A, depth below top of slab], …]. Returns { errors } or { errors: [], MR, fw, tr, Fexx, Fuw, dk, g, env }. */
  function compute(p, env) {
    const E = env || {}, L = E.lf || {}, eta = +L.eta > 0 ? +L.eta : 1, mL = +L.m > 0 ? +L.m : 1, h0 = !!L.h0;
    const errors = [], g = k => nm(p[k]);
    ['Fexx', 'ts', 'beff', 'fc', 'wc', 'K1'].forEach(k => { if (!(g(k) > 0)) errors.push(`"${k}" must be positive.`); }); ['hh', 'Ar', 'dr'].forEach(k => { if (!(g(k) >= 0)) errors.push(`"${k}" must be zero or positive.`); });
    const fw = numRows(p.fw, FSPEC, 'Weld location', errors), tr = numRows(p.tr, TSPEC, 'Transition', errors);
    if (!fw.length && !tr.length) errors.push('Add at least one weld location or transition.');
    if (errors.length) return { errors };
    const MR = SEC().modularRatio(g('fc'), g('wc'), g('K1'), p.nRule), dk = { ts: g('ts'), hh: h0 ? 0 : g('hh'), beff: g('beff'), n: MR.n, Ar: g('Ar'), dr: g('dr') };
    if (Array.isArray(p.layers)) dk.layers = p.layers.map(q => [nm(q[0]), nm(q[1])]);
    const gO = k => k === 'dc' || k === 'dw' ? eta : k === 'll' ? eta * mL : 1, G = k => nm(p.gam[k]) * gO(k), Fexx = g('Fexx'), Fuw = GRADES[p.gW].Fu;   // OWN6–OWN8 (OWN_K.wt)
    fw.forEach(r => { SH().plAdjust(p.fw[r.i], r, ['VLL'], mL); const dk_ = r.beff > 0 ? { ...dk, beff: r.beff } : dk, S = secSet(r.D, r, dk_), yTf = S.s.d - r.topT / 2, yBf = r.botT / 2, At = r.topB * r.topT, Ab = r.botB * r.botT;
      const Qt = (sec, slab) => At * (yTf - sec.yb) + (slab ? slab * (S.ySlab - sec.yb) : 0), Qb = sec => Ab * (sec.yb - yBf);
      const st = [['DC1', r.VDC1, G('dc'), S.s, 0, 'steel'], ['DC2', r.VDC2, G('dc'), S.c3, dk_.beff * dk.ts / (3 * dk.n), '3n'], ['DW', r.VDW, G('dw'), S.c3, dk_.beff * dk.ts / (3 * dk.n), '3n'], ['LL+IM', r.VLL, G('ll'), S.cn, dk_.beff * dk.ts / dk.n, 'n']];
      if (utOn(p.fw[r.i])) st.push(['Utilities, existing', UT(p.fw[r.i], 'VUT'), G('dw'), S.s, 0, 'steel'], ['Future utility allowance', UT(p.fw[r.i], 'VUF'), G('dc'), S.s, 0, 'steel']);   // GD54b
      r.S = S; r.dk = dk_; r.yTf = yTf; r.yBf = yBf; r.At = At; r.Ab = Ab;
      r.terms = st.map(([n, V, gm, sec, sl, sn]) => ({ n, V, gm, I: sec.I, yb: sec.yb, Qt: Qt(sec, sl), Qb: Qb(sec), sn, sl })); r.terms.forEach(t => { t.vt = t.gm * t.V * t.Qt / t.I; t.vb = t.gm * t.V * t.Qb / t.I; });
      r.vuT = sum(r.terms.map(t => t.vt)); r.vuB = sum(r.terms.map(t => t.vb));
      r.Rw = 2 * 0.6 * PHI_E2 * Fexx * 0.707 * r.w; r.Rweb = PHI_VU * 0.58 * Fuw * r.tw;
      const Lt = r.terms[3]; r.frT = G('fat') * r.Vfr * Lt.Qt / Lt.I / (2 * 0.707 * r.w); r.frB = G('fat') * r.Vfr * Lt.Qb / Lt.I / (2 * 0.707 * r.w);
      r.wminT = wMinFor(Math.max(r.topT, r.tw)); r.wminB = wMinFor(Math.max(r.botT, r.tw)); });
    tr.forEach(r => { const s = r.fl === 'bot' ? { tw: r.tw, topB: r.ob, topT: r.ot, botB: r.b1, botT: r.t1 } : { tw: r.tw, topB: r.b1, topT: r.t1, botB: r.ob, botT: r.ot }, dkr = rowDk(dk, r), S = secSet(r.D, s, dkr);
      const y = r.fl === 'bot' ? r.t1 / 2 : S.s.d - r.t1 / 2, f = (M, sec) => M * 12 * (y - sec.yb) / sec.I;
      r.fp = Math.abs(f(r.dMp, S.cn)); r.fn = Math.abs(f(r.dMn, S.r)); r.df = G('fat') * (r.fp + r.fn); r.cat = r.ground === 'yes' ? 'B' : 'C'; r.th = r.cat === 'B' ? 16 : 10;
      r.slopeT = r.t2 > r.t1 + 1e-9 ? (r.Lt > 0 ? (r.t2 - r.t1) / r.Lt : Infinity) : 0; r.dbw = (r.b2 - r.b1) / 2; r.slopeW = r.dbw > 1e-9 && r.wType === 'taper' ? (r.Lw > 0 ? r.dbw / r.Lw : Infinity) : 0;
      r.A1 = r.b1 * r.t1; r.A2 = r.b2 * r.t2; r.S = S; r.sec = s; r.y = y; r.dk = dkr; });
    return { errors: [], MR, fw, tr, Fexx, Fuw, dk, g: { dc: G('dc'), dw: G('dw'), ll: G('ll'), fat: G('fat') }, env: { eta, m: mL, h0 }, p };
  }

  /* ---------- checks (GM.wt.checks) ---------- */
  function ckNew() { const out = []; out.add = c => { c.items.forEach(it => { if (typeof it.r === 'number' && Number.isNaN(it.r) && it.st !== 'na') { it.err = 'error: ratio is NaN'; if (RANK[it.st] < RANK.warn) it.st = 'fail'; } });   // SB2-R2 NaN guard
    const nr = i => (Number.isNaN(i.r) || i.r === Infinity ? Infinity : i.r ?? -1);
    c.status = c.items.length ? worst(c.items.map(i => i.st)) : 'na'; let gi = -1; c.items.forEach((it, k) => { if (gi < 0 || RANK[it.st] > RANK[c.items[gi].st] || (RANK[it.st] === RANK[c.items[gi].st] && nr(it) > nr(c.items[gi]))) gi = k; }); c.gov = gi; if (!c.items.length && !c.naWhy) c.naWhy = 'Not applicable to any item.'; out.push(c); }; return out; }
  const rc = (loc, d, c, step, x) => ({ loc, demand: d, capacity: c, r: d / c, st: ge(c, d) ? 'pass' : 'fail', step, ...(x || {}) });
  /* checks(R): each check { id, grp, title, ref, items: [{ loc, r, st, demand, capacity, step }], naWhy, status, gov } */
  function checks(R) {
    const out = ckNew(), G1 = 'Flange-to-web welds', G2 = 'Flange transitions';
    { const c = { id: 'FW1', grp: G1, title: 'Weld metal resistance to the shear flow', ref: `${ED} Art. 6.13.3.2.4b, Eq. 6.13.3.2.4b-1`, items: [] };
      R.fw.forEach(r => [['top', r.vuT, 'T'], ['bottom', r.vuB, 'B']].forEach(([n, v, k]) => c.items.push(rc(`${r.name}, ${n}`, v, r.Rw, `wf${r.i}.ok${k}`)))); out.add(c); }
    { const c = { id: 'FW2', grp: G1, title: 'Web base metal shear rupture', ref: `${ED} Art. 6.13.5.3`, items: [] };
      R.fw.forEach(r => { const v = Math.max(r.vuT, r.vuB); c.items.push(rc(r.name, v, r.Rweb, `wf${r.i}.okW`)); }); out.add(c); }
    { const c = { id: 'FW3', grp: G1, title: 'Fatigue, shear on the weld throat (Category F)', ref: `${ED} Table 6.6.1.2.3-1, Table 6.6.1.2.5-3`, items: [] };
      R.fw.filter(r => r.Vfr > 0).forEach(r => [['top', r.frT, 'T'], ['bottom', r.frB, 'B']].forEach(([n, v, k]) => c.items.push(rc(`${r.name}, ${n}`, v, 8, `wf${r.i}.fat${k}`))));
      if (!c.items.length) c.naWhy = 'No fatigue shear range entered.'; out.add(c); }
    { const c = { id: 'FW4', grp: G1, title: 'Minimum fillet weld size', ref: `${ED} Art. 6.13.3.4, Table 6.13.3.4-1`, items: [] };
      R.fw.forEach(r => [['top', r.topT, r.wminT, 'T'], ['bottom', r.botT, r.wminB, 'B']].forEach(([n, t, m, k]) => c.items.push({ loc: `${r.name}, ${n}`, demand: m, capacity: r.w, r: m / r.w, st: ge(r.w, m) ? 'pass' : 'fail', step: `wf${r.i}.wmin${k}` }))); out.add(c); }
    { const c = { id: 'TR1', grp: G2, title: 'Fatigue at the transition', ref: `${ED} Art. 6.6.1.2, Table 6.6.1.2.3-1 (Section 5)`, items: [] };
      R.tr.forEach(r => c.items.push(rc(r.name, r.df, r.th, `wt${r.i}.fat`, { cat: r.cat })));
      if (!c.items.length) c.naWhy = 'No transitions entered.'; out.add(c); }
    { const c = { id: 'TR2', grp: G2, title: 'Thickness transition slope', ref: `${ED} Art. 6.13.6.2, Fig. 6.13.6.2-1; AASHTO/AWS D1.5`, items: [] };
      R.tr.filter(r => r.t2 > r.t1 + 1e-9).forEach(r => c.items.push(rc(r.name, r.slopeT, 0.4, `wt${r.i}.slT`)));
      if (!c.items.length) c.naWhy = 'No thickness change.'; out.add(c); }
    { const c = { id: 'TR3', grp: G2, title: 'Width transition', ref: `${ED} Art. 6.13.6.2; Table 6.6.1.2.3-1 (5.2, 5.3)`, items: [] };
      R.tr.filter(r => r.dbw > 1e-9).forEach(r => { if (r.wType === 'radius') c.items.push(rc(r.name, 24, r.Lw, `wt${r.i}.slW`));
        else if (r.wType === 'taper') c.items.push(rc(r.name, r.slopeW, 0.4, `wt${r.i}.slW`));
        else c.items.push({ loc: r.name, st: 'fail', step: `wt${r.i}.slW` }); });
      if (!c.items.length) c.naWhy = 'No width change.'; out.add(c); }
    { const c = { id: 'TR4', grp: G2, title: 'Transition proportions', ref: 'Practice (AASHTO/NSBA G12.1 guidance)', items: [] };
      R.tr.forEach(r => { const a = r.t1 / r.t2, b = r.A1 / r.A2; c.items.push({ loc: `${r.name}, thickness`, value: a, st: ge(a, 0.5) ? 'pass' : 'warn', step: `wt${r.i}.pt` }); c.items.push({ loc: `${r.name}, area`, value: b, st: ge(b, 0.5) ? 'pass' : 'warn', step: `wt${r.i}.pa` }); });
      if (!c.items.length) c.naWhy = 'No transitions entered.'; out.add(c); }
    return out;
  }

  /* ---------- worked steps ---------- */
  const secDeck = (dk) => ({ ts: dk.ts, haunch: dk.hh, beff: dk.beff });
  const plates = (D, s) => ({ D, tw: s.tw, topB: s.topB, topT: s.topT, botB: s.botB, botT: s.botT });
  /* sectionSteps(R, row, kind): the modular ratio and the section properties a row uses (engine/sections.js, the same arithmetic as secSet) */
  function sectionSteps(R, r, kind) {
    const out = SEC().modularRatio(R.MR.fc, R.MR.wc, R.MR.K1, R.MR.rule).steps.slice(), D = r.D, p = kind === 'fw' ? plates(D, r) : plates(D, r.sec), dk = r.dk;
    out.push(...SEC().steel(p).steps);
    if (kind === 'fw') { out.push(...SEC().composite(p, secDeck(dk), R.MR.n, 3).steps, ...SEC().composite(p, secDeck(dk), R.MR.n, 1).steps); }
    else { out.push(...SEC().composite(p, secDeck(dk), R.MR.n, 1).steps);
      const ly = Array.isArray(dk.layers) ? dk.layers.filter(q => q[0] > 0) : dk.Ar > 0 ? [[dk.Ar, dk.dr]] : [];
      const rb = { top: ly[0] ? { A: ly[0][0], c: ly[0][1] } : { A: 0, c: 0 }, bot: ly[1] ? { A: ly[1][0], c: dk.ts - ly[1][1] } : { A: 0, c: 0 } };
      out.push(...SEC().withRebar(p, { ts: dk.ts, haunch: dk.hh, rebar: rb }).steps); }
    return out;
  }
  /* steps(R, kind, i): the worked steps of weld row i (kind 'fw') or transition i (kind 'tr'), preceded by the section properties it uses */
  function steps(R, kind, i) {
    const list = kind === 'fw' ? R.fw : R.tr, r = list.find(q => q.i === i) || list[i]; if (!r) return [];
    return sectionSteps(R, r, kind).concat(kind === 'fw' ? fwSteps(R, r) : trSteps(R, r));
  }
  const gLbl = (R, k) => k === 'LL+IM' && (R.env.eta !== 1 || R.env.m !== 1) ? `γ_LL·η·m = ${n3(R.g.ll)}` : '';
  function fwSteps(R, r) {
    const w = St().work('wf' + r.i), tbl = `${ED} Tables 3.4.1-1, 3.4.1-2`, sec = { steel: 'sec.s', '3n': 'sec.c3', n: 'sec.cn' };
    w.add({ id: 'yTf', label: 'Centroid of the top flange above the bottom of steel', sym: 'y_{tf}', eq: 'd - \\frac{t_{t}}{2}', sub: `${n3(r.S.s.d)} - \\frac{${n4(r.topT)}}{2}`, value: r.yTf, unit: 'in', d: 3 });
    w.add({ id: 'yBf', label: 'Centroid of the bottom flange above the bottom of steel', sym: 'y_{bf}', eq: '\\frac{t_{b}}{2}', sub: `\\frac{${n4(r.botT)}}{2}`, value: r.yBf, unit: 'in', d: 3 });
    if (r.plAdj) r.plAdj.forEach(a => w.add({ id: 'pl', label: 'LL+IM shear without the load multiplier on the pedestrian part', sym: 'V_{LL+IM}', eq: 'V - q + \\frac{q}{m}', sub: `${n2(a.v0)} - ${n2(a.q)} + \\frac{${n2(a.q)}}{${n2(R.env.m)}}`, value: a.v, unit: 'kip', d: 2, ref: 'GirderDetail GD45 (owner multiplier m on HL-93 only)' }));
    r.terms.forEach((t, j) => { const id = `t${j}`, sl = t.sl > 0;
      w.add({ id: `${id}.Qt`, label: `${t.n}: first moment of the top flange${sl ? ' and the transformed slab' : ''} about the ${t.sn === 'steel' ? 'steel' : t.sn} neutral axis`, sym: 'Q_{t}', eq: sl ? 'A_{tf}(y_{tf} - \\bar{y}) + A_{d}(y_{d} - \\bar{y})' : 'A_{tf}(y_{tf} - \\bar{y})',
        sub: `${n3(r.At)}(${n3(r.yTf)} - ${n3(t.yb)})${sl ? ` + ${n2(t.sl)}(${n3(r.S.ySlab)} - ${n3(t.yb)})` : ''}`, value: t.Qt, unit: 'in^{3}', d: 2, note: `ȳ and I of the ${t.sn === 'steel' ? 'steel' : t.sn === '3n' ? 'long-term (3n)' : 'short-term (n)'} section: see §${sec[t.sn]}.` });
      w.add({ id: `${id}.Qb`, label: `${t.n}: first moment of the bottom flange`, sym: 'Q_{b}', eq: 'A_{bf}(\\bar{y} - y_{bf})', sub: `${n3(r.Ab)}(${n3(t.yb)} - ${n3(r.yBf)})`, value: t.Qb, unit: 'in^{3}', d: 2 });
      w.add({ id: `${id}.vt`, label: `${t.n}: factored shear flow at the top flange`, sym: '\\gamma\\frac{VQ_{t}}{I}', eq: '', sub: `\\frac{${n3(t.gm)}(${n2(t.V)})(${n2(t.Qt)})}{${g0(t.I)}}`, value: t.vt, unit: 'kip/in', d: 3, ref: tbl, note: gLbl(R, t.n) });
      w.add({ id: `${id}.vb`, label: `${t.n}: factored shear flow at the bottom flange`, sym: '\\gamma\\frac{VQ_{b}}{I}', eq: '', sub: `\\frac{${n3(t.gm)}(${n2(t.V)})(${n2(t.Qb)})}{${g0(t.I)}}`, value: t.vb, unit: 'kip/in', d: 3, ref: tbl }); });
    const vs = k => r.terms.map(t => n3(k === 'T' ? t.vt : t.vb)).join(' + ');
    w.add({ id: 'vuT', label: 'Strength I shear flow, top flange-to-web welds', sym: 'v_{u,t}', eq: '\\sum\\gamma\\frac{VQ_{t}}{I}', sub: vs('T'), value: r.vuT, unit: 'kip/in', d: 3, ref: `${ED} Art. 6.13.3.2.4b` });
    w.add({ id: 'vuB', label: 'Strength I shear flow, bottom flange-to-web welds', sym: 'v_{u,b}', eq: '\\sum\\gamma\\frac{VQ_{b}}{I}', sub: vs('B'), value: r.vuB, unit: 'kip/in', d: 3, ref: `${ED} Art. 6.13.3.2.4b` });
    w.add({ id: 'Rw', label: 'Factored resistance of two fillet welds', sym: 'R_{r}', eq: '2(0.6)\\phi_{e2}F_{exx}(0.707w)', sub: `2(0.6)(0.80)(${g0(R.Fexx)})(0.707)(${n4(r.w)})`, value: r.Rw, unit: 'kip/in', d: 3, ref: `${ED} Eq. 6.13.3.2.4b-1, Art. 6.5.4.2`, note: 'φ_e2 = 0.80, shear in the throat of the weld metal.' });
    [['T', 'top', r.vuT], ['B', 'bottom', r.vuB]].forEach(([k, f, v]) => w.add({ id: `ok${k}`, label: `Weld metal, ${f} flange (FW1)`, sym: 'v_{u} \\le R_{r}', eq: '', sub: `${n3(v)} ${ge(r.Rw, v) ? '\\le' : '\\gt'} ${n3(r.Rw)}`, value: v / r.Rw, unit: '', d: 3, ref: `${ED} Eq. 6.13.3.2.4b-1`, ok: ge(r.Rw, v) }));
    w.add({ id: 'Rweb', label: 'Shear rupture resistance of the web base metal', sym: 'R_{r}', eq: '\\phi_{vu}0.58F_{u}t_{w}', sub: `0.80(0.58)(${g0(R.Fuw)})(${n4(r.tw)})`, value: r.Rweb, unit: 'kip/in', d: 3, ref: `${ED} Art. 6.13.5.3, Art. 6.5.4.2` });
    { const v = Math.max(r.vuT, r.vuB); w.add({ id: 'okW', label: 'Web base metal (FW2)', sym: '\\max(v_{u,t}, v_{u,b}) \\le R_{r}', eq: '', sub: `${n3(v)} ${ge(r.Rweb, v) ? '\\le' : '\\gt'} ${n3(r.Rweb)}`, value: v / r.Rweb, unit: '', d: 3, ref: `${ED} Art. 6.13.5.3`, ok: ge(r.Rweb, v) }); }
    if (r.Vfr > 0) { const L = r.terms[3];
      [['T', 'top', r.frT, L.Qt], ['B', 'bottom', r.frB, L.Qb]].forEach(([k, f, v, Q]) => w.add({ id: `fat${k}`, label: `Fatigue I shear stress range on the weld throat, ${f} (FW3)`, sym: '\\gamma(\\Delta f)', eq: '\\frac{\\gamma V_{f}Q/I}{2(0.707w)} \\le (\\Delta F)_{TH}',
        sub: `\\frac{${n2(R.g.fat)}(${n2(r.Vfr)})(${n2(Q)})/${g0(L.I)}}{2(0.707)(${n4(r.w)})} = ${n2(v)} ${ge(8, v) ? '\\le' : '\\gt'} 8.0`, value: v, unit: 'ksi', d: 2, ref: `${ED} Table 6.6.1.2.3-1 (Category F), Table 6.6.1.2.5-3`, ok: ge(8, v),
        note: 'Short-term composite section (n). Base metal at the continuous longitudinal welds (Category B) is the flange stress range check (GS17, Fatigue tab).' })); }
    [['T', 'top', r.topT, r.wminT], ['B', 'bottom', r.botT, r.wminB]].forEach(([k, f, t, m]) => w.add({ id: `wmin${k}`, label: `Minimum fillet weld size, ${f} flange (FW4)`, sym: 'w \\ge w_{min}', eq: '', sub: `${n4(r.w)} ${ge(r.w, m) ? '\\ge' : '\\lt'} ${n4(m)}`, value: m / r.w, unit: '', d: 3, ref: `${ED} Table 6.13.3.4-1`, ok: ge(r.w, m), note: `Thicker part joined: ${frac(Math.max(t, r.tw))} in (${Math.max(t, r.tw) > 0.75 + 1e-9 ? 'over 3/4 in: 5/16 in' : 'up to 3/4 in: 1/4 in'}).` }));
    return w.steps;
  }
  function trSteps(R, r) {
    const w = St().work('wt' + r.i), S = r.S, fl = r.fl === 'bot' ? 'bottom' : 'top';
    w.add({ id: 'y', label: `Mid-thickness of the smaller ${fl} flange above the bottom of steel`, sym: 'y', eq: r.fl === 'bot' ? '\\frac{t_{1}}{2}' : 'd - \\frac{t_{1}}{2}', sub: r.fl === 'bot' ? `\\frac{${n4(r.t1)}}{2}` : `${n3(S.s.d)} - \\frac{${n4(r.t1)}}{2}`, value: r.y, unit: 'in', d: 3 });
    w.add({ id: 'fp', label: 'Positive fatigue moment stress, short-term composite section', sym: '|f_{+}|', eq: '\\left|\\frac{12\\Delta M_{+}(y - \\bar{y}_{n})}{I_{n}}\\right|', sub: `\\left|\\frac{12(${n2(r.dMp)})(${n3(r.y)} - ${n3(S.cn.yb)})}{${g0(S.cn.I)}}\\right|`, value: r.fp, unit: 'ksi', d: 2, note: 'ȳ_n and I_n: see §sec.cn.' });
    w.add({ id: 'fn', label: 'Negative fatigue moment stress, steel + deck reinforcement', sym: '|f_{-}|', eq: '\\left|\\frac{12\\Delta M_{-}(y - \\bar{y}_{r})}{I_{r}}\\right|', sub: `\\left|\\frac{12(${n2(r.dMn)})(${n3(r.y)} - ${n3(S.r.yb)})}{${g0(S.r.I)}}\\right|`, value: r.fn, unit: 'ksi', d: 2, note: 'ȳ_r and I_r: see §sec.cr.' });
    w.add({ id: 'df', label: 'Factored fatigue stress range (Fatigue I)', sym: '\\gamma(\\Delta f)', eq: '\\gamma(|f_{+}| + |f_{-}|)', sub: `${n2(R.g.fat)}(${n2(r.fp)} + ${n2(r.fn)})`, value: r.df, unit: 'ksi', d: 2, ref: `${ED} Table 3.4.1-1, Art. 6.6.1.2.2` });
    w.add({ id: 'fat', label: `Fatigue at the butt splice (TR1), Category ${r.cat}`, sym: '\\gamma(\\Delta f) \\le (\\Delta F)_{TH}', eq: '', sub: `${n2(r.df)} ${ge(r.th, r.df) ? '\\le' : '\\gt'} ${n2(r.th)}`, value: r.df / r.th, unit: '', d: 3, ref: `${ED} Table 6.6.1.2.3-1 (Section 5)`, ok: ge(r.th, r.df),
      note: r.cat === 'B' ? 'Category B: ground flush in the direction of stress, tapers no steeper than 1:2.5 or a width radius of at least 24 in (TR2, TR3), soundness by NDT. (ΔF)_TH = 16 ksi.' : 'Category C: weld reinforcement not removed. (ΔF)_TH = 10 ksi.' });
    if (r.t2 > r.t1 + 1e-9) w.add({ id: 'slT', label: 'Thickness transition slope (TR2)', sym: '\\frac{t_{2} - t_{1}}{L_{t}} \\le \\frac{1}{2.5}', eq: '', sub: isFinite(r.slopeT) ? `\\frac{${n4(r.t2)} - ${n4(r.t1)}}{${n2(r.Lt)}} = ${n3(r.slopeT)} ${ge(0.4, r.slopeT) ? '\\le' : '\\gt'} 0.400` : '\\text{no taper length}', value: r.slopeT / 0.4, unit: '', d: 3, ref: `${ED} Art. 6.13.6.2, Fig. 6.13.6.2-1`, ok: ge(0.4, r.slopeT) });
    if (r.dbw > 1e-9) { if (r.wType === 'radius') w.add({ id: 'slW', label: 'Width transition by a radius (TR3)', sym: 'R \\ge 24', eq: '', sub: `${n2(r.Lw)} ${ge(r.Lw, 24) ? '\\ge' : '\\lt'} 24.0`, value: 24 / r.Lw, unit: '', d: 3, ref: `${ED} Table 6.6.1.2.3-1 (5.3)`, ok: ge(r.Lw, 24) });
      else if (r.wType === 'taper') w.add({ id: 'slW', label: 'Width transition taper (TR3)', sym: '\\frac{(b_{2} - b_{1})/2}{L_{w}} \\le \\frac{1}{2.5}', eq: '', sub: isFinite(r.slopeW) ? `\\frac{${n3(r.dbw)}}{${n2(r.Lw)}} = ${n3(r.slopeW)} ${ge(0.4, r.slopeW) ? '\\le' : '\\gt'} 0.400` : '\\text{no taper length}', value: r.slopeW / 0.4, unit: '', d: 3, ref: `${ED} Art. 6.13.6.2; Table 6.6.1.2.3-1 (5.2)`, ok: ge(0.4, r.slopeW) });
      else w.add({ id: 'slW', label: 'Width transition (TR3)', sym: '', eq: '', sub: '\\text{widths differ but no transition is detailed}', value: 'none', unit: '', d: 0, ref: `${ED} Art. 6.13.6.2`, ok: false }); }
    const a = r.t1 / r.t2, b = r.A1 / r.A2;
    w.add({ id: 'pt', label: 'Thickness proportion (TR4)', sym: '\\frac{t_{1}}{t_{2}} \\ge 0.5', eq: '', sub: `\\frac{${n4(r.t1)}}{${n4(r.t2)}} = ${n3(a)}`, value: a, unit: '', d: 3, ref: 'Practice (AASHTO/NSBA G12.1)', ok: ge(a, 0.5), note: ge(a, 0.5) ? '' : 'Warning: an abrupt change concentrates stress.' });
    w.add({ id: 'pa', label: 'Area proportion (TR4)', sym: '\\frac{A_{1}}{A_{2}} \\ge 0.5', eq: '', sub: `\\frac{${n2(r.b1)}(${n4(r.t1)})}{${n2(r.b2)}(${n4(r.t2)})} = ${n3(b)}`, value: b, unit: '', d: 3, ref: 'Practice (AASHTO/NSBA G12.1)', ok: ge(b, 0.5), note: ge(b, 0.5) ? '' : 'Warning: a change this small rarely saves enough steel to pay for the butt weld.' });
    return w.steps;
  }

  /* ---------- rows from the demands of one girder (this app) ---------- */
  /* fromDemands(D, opt): the module input for one girder.
     D = { x: [ft] (stations, ascending), sup: [ft] (supports), segAt(x) → { D, tw, topB, topT, botB, botT } (the plates at x, the
           segment that starts at x when x is a plate change), segs: [{ x0, x1 }] (the plate changes are the x1 of all but the last),
           V: { L: { DC1, DC2, DW, LL, UT, UF, F }, R: { … } } magnitudes on the left and right of each station (kip; LL = LL+IM; F = fatigue
           shear range V_FAT,pos − V_FAT,neg), PL (optional): the pedestrian part of LL+IM per station side { L, R },
           MfP, MfN: fatigue moments per station (kip-ft; MfN ≤ 0), splices: [ft] (field splices), tol (ft: a plate change within tol of a
           field splice is the splice) }
     opt = { gen: { gW, gF, Fexx, gam, ts, hh, beff, fc, wc, K1, nRule, Ar, dr, layers }, w: '' (Table 6.13.3.4-1 minimum per location)
             | weld size (in), ground: 'yes' | 'no', beff (this girder's, in) }.
     Weld locations: every support (the girder ends on their inner side, interior supports on both sides) and both sides of every plate
     change: the shear flow VQ/I is largest where V is (the supports) or where Q/I jumps (a plate change). A side's shears are the station
     values on that side, linear between stations. Transitions: each flange that changes at a plate change that is not a field splice;
     the smaller-area side is side 1; tapers at 1:2.5 (L_t = 2.5Δt, L_w = 2.5Δb per side), ground flush (opt.ground); ΔM from the fatigue
     moments at the change (linear between stations). */
  function fromDemands(D, opt) {
    opt = opt || {};
    const xs = D.x, N = xs.length, sup = D.sup, Lt = sup[sup.length - 1], gen = opt.gen || {};
    const side = (k, x, s) => { const L = D.V.L[k], R = D.V.R[k]; if (!L || !R) return 0; let i = 0; while (i < N - 2 && xs[i + 1] <= x + 1e-9) i++;
      if (Math.abs(xs[i] - x) < 1e-6) return s === 'L' ? L[i] : R[i];
      if (Math.abs(xs[i + 1] - x) < 1e-6) return s === 'L' ? L[i + 1] : R[i + 1];
      const t = Math.max(0, Math.min(1, (x - xs[i]) / ((xs[i + 1] - xs[i]) || 1))); return R[i] * (1 - t) + L[i + 1] * t; };
    const lin = (A, x) => { let i = 0; while (i < N - 2 && xs[i + 1] < x) i++; const t = Math.max(0, Math.min(1, (x - xs[i]) / ((xs[i + 1] - xs[i]) || 1))); return A[i] * (1 - t) + A[i + 1] * t; };
    const supN = k => k === 0 ? 'Abut. 1' : k === sup.length - 1 ? 'Abut. 2' : `Pier ${k}`;
    const fw = [], pts = [];
    sup.forEach((x, k) => { if (k > 0) pts.push([x, 'L', `${supN(k)}${k < sup.length - 1 ? ', left' : ''}`]); if (k < sup.length - 1) pts.push([x, 'R', `${supN(k)}${k > 0 ? ', right' : ''}`]); });
    const chg = (D.segs || []).slice(0, -1).map(s => s.x1).filter(x => x > 1e-6 && x < Lt - 1e-6 && !sup.some(v => Math.abs(v - x) < 1e-6));
    chg.forEach(x => { pts.push([x, 'L', `x = ${n2(x)} ft, left of the plate change`]); pts.push([x, 'R', `x = ${n2(x)} ft, right of the plate change`]); });
    pts.sort((a, b) => a[0] - b[0] || (a[1] === 'L' ? -1 : 1));
    pts.forEach(([x, s, name]) => { const p = D.segAt(s === 'L' ? x - 1e-6 : x + 1e-6), tmax = Math.max(p.topT, p.botT, p.tw), wv = opt.w === '' || opt.w == null ? wMinFor(tmax) : nm(opt.w);
      const row = { name, x, side: s, D: p.D, tw: p.tw, topB: p.topB, topT: p.topT, botB: p.botB, botT: p.botT, w: wv, VDC1: side('DC1', x, s), VDC2: side('DC2', x, s), VDW: side('DW', x, s), VLL: side('LL', x, s), Vfr: side('F', x, s) };
      if (opt.beff > 0) row.beff = opt.beff;
      const ut = { VUT: side('UT', x, s), VUF: side('UF', x, s) }; if (ut.VUT || ut.VUF) row.ut = ut;
      if (D.PL) { const q = side('PL', x, s); if (q) row.pl = { VLL: [q, row.VLL] }; }   // GD45: the pedestrian part of LL+IM (no m on it)
      fw.push(row); });
    const tr = [], spl = D.splices || [], tol = D.tol != null ? D.tol : 0.05;
    chg.filter(x => !spl.some(q => Math.abs(q - x) <= tol + 1e-9)).forEach(x => { const a = D.segAt(x - 1e-6), b = D.segAt(x + 1e-6);
      [['top', 'topB', 'topT', 'botB', 'botT'], ['bot', 'botB', 'botT', 'topB', 'topT']].forEach(([fl, kb, kt, ob, ot]) => {
        if (a[kb] === b[kb] && a[kt] === b[kt]) return;
        const sa = a[kb] * a[kt] <= b[kb] * b[kt], sm = sa ? a : b, lg = sa ? b : a, dt = Math.abs(lg[kt] - sm[kt]), db = (lg[kb] - sm[kb]) / 2;
        tr.push({ name: `${fl === 'top' ? 'Top' : 'Bottom'} flange at ${n2(x)} ft`, x, fl, b1: sm[kb], t1: sm[kt], b2: lg[kb], t2: lg[kt], Lt: 2.5 * dt, wType: Math.abs(db) > 1e-6 ? 'taper' : 'none', Lw: 2.5 * Math.abs(db),
          ground: opt.ground === 'no' ? 'no' : 'yes', D: sm.D, tw: sm.tw, ob: sm[ob], ot: sm[ot], dMp: Math.max(0, lin(D.MfP, x)), dMn: Math.abs(Math.min(0, lin(D.MfN, x))), ...(opt.beff > 0 ? { beff: opt.beff } : {}) }); }); });
    return { gF: gen.gF || '50W', gW: gen.gW || '50W', Fexx: gen.Fexx != null ? gen.Fexx : 70, gam: { ...(gen.gam || DEFAULT.gam) }, ts: gen.ts, hh: gen.hh, beff: gen.beff, fc: gen.fc, wc: gen.wc, K1: gen.K1 != null ? gen.K1 : 1, nRule: gen.nRule || 'exact',
      Ar: gen.Ar != null ? gen.Ar : 0, dr: gen.dr != null ? gen.dr : 0, ...(gen.layers ? { layers: gen.layers } : {}), fw, tr };
  }

  /* demandsFromPayload(pl): fromDemands' D from a hand-off file (schema stgirder-external-demands): station shears (both sides the same
     station value; LL+IM = max(|V_LL,pos|, |V_LL,neg|) + the pedestrian shear when the file keeps it apart, as engine/shear.js demands),
     plates from the section zones, field splices from the stud results' gaps. Returns { D, gen, env }: gen from the file's deck and
     materials (A_r at mid-depth of the slab, as the file says), env from its owner rules. */
  function demandsFromPayload(pl) {
    const S = pl.stations || [], zones = (pl.section || {}).zones || [], g = pl.girderDetail || {}, dk = g.deck || {}, m = g.materials || {}, ro = pl.ownerRules || {};
    const xs = S.map(s => +s.x), A = k => S.map(s => Math.abs(+s[k] || 0)), plIn = pl.pedestrianInLL === true;
    // PL: the pedestrian part of LL (sb-ped-owner PR: also when it is already in LL+IM, pedestrianInLL, so that m stays off it, GD45); added
    // to LL only when the file keeps it apart (SB2-R1)
    const PL = S.map(s => plIn ? (Math.abs(+s.V_LLpos || 0) >= Math.abs(+s.V_LLneg || 0) ? Math.abs(+s.V_PLpos || 0) : Math.abs(+s.V_PLneg || 0)) : Math.max(Math.abs(+s.V_PLpos || 0), Math.abs(+s.V_PLneg || 0)));
    const LL = S.map((s, i) => Math.max(Math.abs((+s.V_LLpos || 0)), Math.abs((+s.V_LLneg || 0))) + (plIn ? 0 : PL[i]));
    const V = { DC1: A('V_DC1'), DC2: A('V_DC2'), DW: A('V_DW'), LL, UT: A('V_UT'), UF: A('V_UF'), F: S.map(s => (+s.V_FATpos || 0) - (+s.V_FATneg || 0)), PL };
    const zAt = x => { const z = zones.find(q => x >= q.startX - 1e-9 && x < q.endX) || zones[zones.length - 1]; return { D: z.web.depth, tw: z.web.thickness, topB: z.topFlange.width, topT: z.topFlange.thickness, botB: z.botFlange.width, botT: z.botFlange.thickness }; };
    const gaps = ((((g.details || {}).studs || {}).results || {}).gaps || []).map(q => +q.x);
    const D = { x: xs, sup: ((pl.member || {}).supports || []).map(Number), segAt: zAt, segs: zones.map(z => ({ x0: z.startX, x1: z.endX })), V: { L: V, R: V }, PL: PL.some(v => v) ? true : undefined,
      MfP: S.map(s => +s.M_FATpos || 0), MfN: S.map(s => +s.M_FATneg || 0), splices: gaps, tol: 0.05 };
    const eta = ro.eta || {}, lf = { eta: +eta.max > 0 ? +eta.max : 1, etaN: +eta.min > 0 ? +eta.min : 1, m: ro.llMultiplier && +ro.llMultiplier.m > 0 ? +ro.llMultiplier.m : 1, h0: ro.haunchInProperties === false };
    const gen = { gF: m.gradeFlange || '50W', gW: m.gradeWeb || '50W', Fexx: 70, gam: { ...DEFAULT.gam }, ts: +dk.ts, hh: +dk.haunch || 0, beff: +dk.beff, fc: +m.fc, wc: +m.wc || 0.15, K1: 1, nRule: 'exact', Ar: +dk.Ar || 0, dr: (+dk.ts) / 2 };
    return { D, gen, env: { lf, owner: ro.owner || 'AASHTO' } };
  }

  window.SBDWelds = { FSPEC, TSPEC, DEFAULT, GRADES, wMinFor, secSet, rowDk, compute, checks, steps, fromDemands, demandsFromPayload };
})();
