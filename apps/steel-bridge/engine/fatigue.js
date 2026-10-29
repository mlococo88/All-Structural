/* apps/steel-bridge/engine/fatigue.js — load-induced fatigue of a steel I-girder (AASHTO LRFD 10th Ed. Art. 6.6.1), the flange stress
   range GS17 (6.6.1.2, 6.10.5.1), the special fatigue requirement for webs at fatigue details (6.10.5.3), distortion-induced fatigue
   detailing (6.6.1.3) and the remaining fatigue life of an existing bridge (MBE Section 7) (window.SBDFatigue). Classic script, no DOM.
   Needs window.SharedSteps, window.SBDSections (steelCore, addPart, modularRatio) and window.SBDShear (webShear), loaded first.

   Ported 2026-10-29 from GirderDetail ("Steel Bridge Design.html"), operation for operation:
     - the bridge-wide fatigue settings and limit state (anchors `const FA_STUD =`, `function gdFatSet(`, `function gdFatSup(`,
       `function gdFatN(`, `const gdFatNear =`, `function gdFatNr(`, `function gdFatLS(`, `function gdFatStud(`): ADTT_SL = p·ADTT
       (Eq. 3.6.1.4.2-1), n per Table 6.6.1.2.5-1 (1.5 within 0.1L of each side of an interior support of a continuous girder),
       Fatigue I (infinite life, (ΔF)_TH) where ADTT_SL is at least the infinite-life equivalent A(γ_I/(γ_II(ΔF)_TH))^m/(365·life·n),
       else Fatigue II ((ΔF)_n = (A/N)^(1/m), N = 365·life·n·ADTT_SL, Eq. 6.6.1.2.5-2); the setting 'I' or 'II' forces one;
       m = 3 for the detail categories (Table 6.6.1.2.3-1), m = 5 for stud shear (Condition 9.2, A = 1040 × 10⁸ ksi⁵, (ΔF)_TH = 7.0 ksi);
     - the Fatigue module GM.fa (anchor `GM.fa = {`): compute(p) and checks(R): FA1 load-induced fatigue of each detail (Eq. 6.6.1.2.2-1),
       FA2 net-tension rule (6.6.1.2.1), FA3 special fatigue requirement for webs (6.10.5.3), FA4 distortion-induced fatigue (6.6.1.3),
       FA5 infinite life and FA6 remaining life (MBE 7.2.4, 7.2.5), FA7 owner categories (OWN39); with FA_CAT, FA_DET, FA_LOC, FA_SPEC,
       faRR, secSet and rowDk. The detail list (flange-to-web welds, connection plate and stiffener weld toes, studs on the top flange,
       field splices, shop flange transitions, and any detail the user adds) is the module's input rows; Preliminary sizing's inventory
       builder is not part of this module (detailsFromPayload below builds the same kinds of rows from a hand-off file);
     - the Girder section module's flange stress range check GS17 (anchor `GS17 limit state (F12-1`): flange(loc, o) on a location of
       engine/flexure.js, which works the Fatigue I stress ranges.
   The TeX `work` lines of GirderDetail are replaced by worked steps (SharedSteps). tests/engine/fatigue.test.mjs checks every value and
   check item against GirderDetail's own functions in Node.

   Owner rules (GirderDetail gdOwnR, gdHP): env = { owner, lf: { h0 } (OWN8: the haunch is 0 in the composite properties), dia (the
   bracing is diaphragms: rows from the analysis say so), rule(id) (default SBDOwners.rule(owner, id)), cite(r) }. Rules used:
   fat.catC (OWN25, CTDOT: connection plate details Category C), fat.cat (OWN39, RIDOT: FA7).

   Units: in, kip, ksi, kip-ft (sagging +); stations ft. E = 29,000 ksi. */
(function () {
  'use strict';
  const ES = 29000, ED = 'AASHTO LRFD 10th Ed.';
  const St = () => window.SharedSteps, SEC = () => window.SBDSections, SH = () => window.SBDShear;
  const n0 = x => St().g(x, 0), n2 = x => St().n(x, 2), n3 = x => St().n(x, 3);
  const pa = x => (x < 0 ? `(${n2(x)})` : n2(x));
  const GRADES = { '36': { Fy: 36, Fu: 58 }, '50': { Fy: 50, Fu: 65 }, '50W': { Fy: 50, Fu: 70 }, 'HPS50W': { Fy: 50, Fu: 70 }, 'HPS70W': { Fy: 70, Fu: 85 } };   // GirderDetail GD_GR
  const RANK = { na: 0, pass: 1, adv: 2, warn: 3, fail: 4 };
  const ge = (a, b) => a >= b - 1e-9;
  const worst = a => a.reduce((w, s) => RANK[s] > RANK[w] ? s : w, 'na');
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
    return { owner, lf: e.lf || { h0: false }, dia: !!e.dia,
      rule: e.rule || (id => (O ? O.rule(owner, id) : null)), cite: e.cite || (r => (O ? O.cite(r) : (r ? `${r.owner} ${r.sec}` : ''))) };
  }
  const hP = (E, h) => (E.lf && E.lf.h0 ? 0 : h);   // gdHP (OWN8)
  const UT = (s, k) => { const v = s && s.ut && typeof s.ut === 'object' ? +s.ut[k] : 0; return isFinite(v) ? v : 0; };   // gdUt
  const utOn = s => !!(s && s.ut && typeof s.ut === 'object' && Object.values(s.ut).some(v => +v));   // gdUtOn
  function ckNew() { const out = []; out.add = c => { c.status = c.items.length ? worst(c.items.map(i => i.st)) : 'na'; let gi = -1; c.items.forEach((it, k) => { if (gi < 0 || RANK[it.st] > RANK[c.items[gi].st] || (RANK[it.st] === RANK[c.items[gi].st] && (it.r ?? -1) > (c.items[gi].r ?? -1))) gi = k; }); c.gov = gi; if (!c.items.length && !c.naWhy) c.naWhy = 'Not applicable to any item.'; out.push(c); }; return out; }
  const rc = (loc, d, c, step, x) => ({ loc, demand: d, capacity: c, r: d / c, st: ge(c, d) ? 'pass' : 'fail', step, ...(x || {}) });

  /* ---------- detail categories (Table 6.6.1.2.3-1, 10th Ed.): A (ksi³) and (ΔF)_TH (ksi) ---------- */
  const CAT = { A: { A: 250e8, th: 24 }, B: { A: 120e8, th: 16 }, "B'": { A: 61e8, th: 12 }, C: { A: 44e8, th: 10 }, "C'": { A: 44e8, th: 12 }, D: { A: 22e8, th: 7 }, E: { A: 11e8, th: 4.5 }, "E'": { A: 3.9e8, th: 2.6 } };
  const CATS = Object.keys(CAT);
  const STUD = { A: 1040e8, m: 5, th: 7.0 };   // Condition 9.2 (stud shear), Eq. 6.10.10.2-1
  const DET = [
    ['B-weld', 'B', 'Base metal at continuous longitudinal flange-to-web fillet welds'],
    ['B-bolt', 'B', 'Base metal at the gross section of a slip-critical bolted splice'],
    ['B-butt', 'B', 'CJP butt splice ground flush; width and thickness transitions ≤ 1:2.5 or radius ≥ 24 in'],
    ['C-butt', 'C', 'CJP butt splice with weld reinforcement not removed'],
    ['Cp-stiff', "C'", 'Base metal at the toe of transverse stiffener or connection plate welds (flange or web)'],
    ['C-stud', 'C', 'Base metal at stud shear connectors welded to a tension flange'],
    ['C-att2', 'C', 'Longitudinal attachment, length in stress direction < 2 in'],
    ['D-att', 'D', 'Longitudinal attachment, 2 in ≤ length ≤ 12t and ≤ 4 in'],
    ['E-att', 'E', 'Longitudinal attachment (e.g. lateral gusset), length > 12t or > 4 in, t < 1.0 in'],
    ['Ep-att', "E'", 'Longitudinal attachment, length > 12t or > 4 in, t ≥ 1.0 in'],
    ['E-cover', 'E', 'End of partial-length welded cover plate, flange t ≤ 0.8 in'],
    ['Ep-cover', "E'", 'End of partial-length welded cover plate, flange t > 0.8 in'],
    ['Cp-half', "C'", 'Half-round bearing stiffener (10th Edition)'],
    ['custom', '', 'Other detail: choose the category below']];
  const LOC = [['bfo', 'Bottom flange, outer face'], ['bfi', 'Bottom flange, inner face'], ['wb', 'Web, distance above bottom flange'], ['wt', 'Web, distance below top flange'], ['tfi', 'Top flange, inner face'], ['tfo', 'Top flange, outer face'], ['y', 'Custom height above bottom of steel']];
  const SPEC = [['name', 'Name', '', 'text'], ['src', 'Source', '', 'text'], ['x', 'Station', 'ft', 'num', { min: 0 }], ['n', 'Cycles per truck passage n', '', 'sel'],
    ['det', 'Detail', '', 'sel'], ['cat', 'Category (custom detail only)', '', 'sel'], ['mode', 'Stress range from', '', 'sel'], ['loc', 'Detail location', '', 'sel'], ['yo', 'Distance (web locations) or height (custom)', 'in', 'dim', { min: 0 }],
    ['D', 'Web depth D', 'in', 'dim'], ['tw', 'Web t<sub>w</sub>', 'in', 'dim'], ['topB', 'Top flange b', 'in', 'dim'], ['topT', 'Top flange t', 'in', 'dim'], ['botB', 'Bottom flange b', 'in', 'dim'], ['botT', 'Bottom flange t', 'in', 'dim'],
    ['MfP', 'Fatigue truck M, positive', 'k-ft', 'num', { min: 0 }], ['MfN', 'Fatigue truck M, negative', 'k-ft', 'num', { any: true }], ['MD1', 'Permanent M on steel (DC1)', 'k-ft', 'num', { any: true }], ['MD2', 'Permanent M on composite (DC2 + DW)', 'k-ft', 'num', { any: true }],
    ['dfP', 'Δf from positive moment', 'ksi', 'num', { min: 0 }], ['dfN', 'Δf from negative moment', 'ksi', 'num', { min: 0 }], ['fDL', 'Permanent stress at detail (tension +)', 'ksi', 'num', { any: true }],
    ['Vp', 'Unfactored permanent shear', 'kip', 'num', { min: 0 }], ['Vf', 'Fatigue truck shear, max.', 'kip', 'num', { min: 0 }], ['do', 'Stiffener spacing d<sub>o</sub> (0 = none)', 'in', 'dim', { min: 0 }],
    ['beff', 'b<sub>eff</sub> of this girder (blank: the b<sub>eff</sub> above)', 'in', 'num', { opt: true }],
    ['Ar', 'Deck rebar A<sub>r</sub> of this girder (blank: the A<sub>r</sub> above)', 'in²', 'num', { opt: true, min: 0 }], ['dr', 'Rebar depth of this girder (blank: the depth above)', 'in', 'num', { opt: true, min: 0 }]];
  /* DEFAULT: GirderDetail's built-in Fatigue input (GM.fa.def) */
  const DEFAULT = { limit: 'auto', gam: { fI: 1.75, fII: 0.80 }, ADTT: 2000, p: 0.85, life: 75, gW: '50W',
    ts: 8, hh: 2, beff: 114, fc: 4, wc: 0.150, K1: 1.0, nRule: 'exact', Ar: 9.8, dr: 4, negSec: 'cracked',
    dist: { cp: 'yes', lat: 'no', latLoc: 'web', latStiff: 'yes', latDist: 10, latBf: 16, skew: 'no' },
    ev: { on: 'no', yearOpen: 1968, yearEval: 2026, ADTT: 1500, g: 2.0, Rs: 1.0, target: 25, level: 'min', rrE1: '', rrE2: '', rrMean: '' },
    rows: [
      { name: 'Span 1 max. positive: bottom flange at flange-to-web weld', src: 'manual', x: 44, n: '1', det: 'B-weld', cat: 'B', mode: 'M', loc: 'bfo', yo: 0, D: 60, tw: 0.5625, topB: 16, topT: 0.75, botB: 16, botT: 1.125, MfP: 620, MfN: -150, MD1: 1450, MD2: 450, dfP: 0, dfN: 0, fDL: 0, Vp: 0, Vf: 0, do: 0 },
      { name: 'Span 1 cross-frame at 0.4L: connection plate weld toe on bottom flange', src: 'manual', x: 44, n: '1', det: 'Cp-stiff', cat: "C'", mode: 'M', loc: 'bfi', yo: 0, D: 60, tw: 0.5625, topB: 16, topT: 0.75, botB: 16, botT: 1.125, MfP: 620, MfN: -150, MD1: 1450, MD2: 450, dfP: 0, dfN: 0, fDL: 0, Vp: 0, Vf: 0, do: 0 },
      { name: 'Span 2: lateral gusset welded to web, 20 in above bottom flange', src: 'manual', x: 180, n: '1', det: 'E-att', cat: 'E', mode: 'M', loc: 'wb', yo: 20, D: 60, tw: 0.5625, topB: 16, topT: 0.75, botB: 16, botT: 1.25, MfP: 700, MfN: -180, MD1: 1600, MD2: 500, dfP: 0, dfN: 0, fDL: 0, Vp: 0, Vf: 0, do: 0 },
      { name: 'Pier 1: top flange at flange-to-web weld', src: 'manual', x: 110, n: '1.5', det: 'B-weld', cat: 'B', mode: 'M', loc: 'tfo', yo: 0, D: 60, tw: 0.5625, topB: 18, topT: 1.5, botB: 18, botT: 2, MfP: 120, MfN: -520, MD1: -2300, MD2: -710, dfP: 0, dfN: 0, fDL: 0, Vp: 125, Vf: 55, do: 90 }] };
  const faRR = s => { const v = String(s || '').split(/[,\s]+/).filter(Boolean).map(Number); return v.length === 8 && v.every(x => x > 0) ? Object.fromEntries(CATS.map((c, i) => [c, v[i]])) : null; };

  /* ---------- bridge-wide settings and limit state ---------- */
  /* settings(f): gdFatSet. f = { limit: 'auto' | 'I' | 'II', ADTT (one direction, trucks/day), p (lane fraction), life (years),
     gam: { fI, fII } }. Returns { limit, ADTT, p, life, gI, gII, ok, ADTTSL }. */
  function settings(f) { f = f || DEFAULT; const g = f.gam || {}, s = { limit: ['auto', 'I', 'II'].includes(f.limit) ? f.limit : 'auto', ADTT: nm(f.ADTT), p: nm(f.p), life: nm(f.life), gI: nm(g.fI), gII: nm(g.fII) };
    s.ok = s.ADTT > 0 && s.p > 0 && s.p <= 1 && s.life > 0 && s.gI > 0 && s.gII > 0; s.ADTTSL = s.p * s.ADTT; return s; }
  /* supports(b): gdFatSup. b = { ok, spans: [ft], cont } (GirderDetail's P.df.bridge). null without spans. */
  function supports(b) { const sp = b && b.ok && Array.isArray(b.spans) ? b.spans.map(Number) : []; if (!sp.length || !sp.every(v => v > 0)) return null;
    const sup = [0]; sp.forEach(L => sup.push(sup[sup.length - 1] + L)); return { sp, sup, cont: !!b.cont && sp.length > 1 }; }
  // near an interior support at xs (Table 6.6.1.2.5-1, C6.6.1.2.5): within 0.1 of the span on each side (Lb: span before, La: span after)
  const near = (x, xs, Lb, La) => (x <= xs + 1e-6 && xs - x <= 0.1 * Lb + 1e-6) || (x >= xs - 1e-6 && x - xs <= 0.1 * La + 1e-6);
  /* nAt(x, neg, cont, B): gdFatN, cycles per truck passage at station x; without a station or a bridge, 1.5 at a negative-moment
     location of a continuous girder, else 1.0 */
  function nAt(x, neg, cont, B) { if (!B || x == null || x === '' || !isFinite(+x)) return neg && cont ? 1.5 : 1.0; x = +x;
    if (B.cont) for (let j = 1; j < B.sup.length - 1; j++) if (near(x, B.sup[j], B.sp[j - 1], B.sp[j])) return 1.5; return 1.0; }
  /* nRange(a, b, neg, cont, B): gdFatNr, the largest n over the stations a..b (the ends, the interior supports and mid-spans inside) */
  function nRange(a, b, neg, cont, B) { if (!B) return neg && cont ? 1.5 : 1.0; const cl = x => Math.min(Math.max(x, a), b);
    return Math.max(...[a, b, ...B.sup.slice(1, -1).map(cl), ...B.sp.map((L, i) => cl(B.sup[i] + L / 2))].map(x => nAt(x, neg, cont, B))); }
  /* limitState(cat, nn, gOwn, s): gdFatLS, Fatigue I or II of a detail category (gOwn: the caller's γ Fatigue I) */
  function limitState(cat, nn, gOwn, s) { const C = CAT[cat] || { A: 0, th: { A: 24, B: 16, "B'": 12, C: 10, "C'": 12, D: 7, E: 4.5, "E'": 2.6 }[cat] };
    if (!s.ok || !(C.A > 0)) return { lim: 'I', gam: gOwn, res: C.th, th: C.th, nn, s };
    const eq = C.A * (s.gI / (s.gII * C.th)) ** 3 / (365 * s.life * nn), lim = s.limit === 'I' ? 'I' : s.limit === 'II' ? 'II' : s.ADTTSL >= eq ? 'I' : 'II', N = 365 * s.life * nn * s.ADTTSL, dFn = Math.cbrt(C.A / N);
    return { lim, gam: lim === 'I' ? gOwn : s.gII, res: lim === 'I' ? C.th : dFn, th: C.th, A: C.A, eq, N, dFn, nn, s }; }
  /* studLimit(nn, d, ZrI, gOwn, s): gdFatStud, the same for stud shear: Z_r = 7.0A_sc (Fatigue I, ZrI) or (ΔF)_nA_sc, (ΔF)_n = (A/N)^(1/5) */
  function studLimit(nn, d, ZrI, gOwn, s) { if (!s.ok) return { lim: 'I', gam: gOwn, Zr: ZrI, nn, s };
    const C = STUD, Asc = Math.PI * d ** 2 / 4, eq = C.A * (s.gI / (s.gII * C.th)) ** C.m / (365 * s.life * nn), lim = s.limit === 'I' ? 'I' : s.limit === 'II' ? 'II' : s.ADTTSL >= eq ? 'I' : 'II';
    const N = 365 * s.life * nn * s.ADTTSL, dFn = (C.A / N) ** (1 / C.m), ZrII = dFn * Asc;
    return { lim, gam: lim === 'I' ? gOwn : s.gII, Zr: lim === 'I' ? ZrI : ZrII, eq, N, dFn, Asc, ZrII, nn, s }; }
  const setText = s => !s.ok ? 'the traffic inputs are incomplete, so Fatigue I is used' : `${s.limit === 'auto' ? 'limit state by ADTT' : `Fatigue ${s.limit} for every detail`}, ADTT_SL = ${n2(s.p)} × ${n0(s.ADTT)} = ${n0(s.ADTTSL)} trucks/day, design life ${n0(s.life)} years, γ_I = ${n2(s.gI)}, γ_II = ${n2(s.gII)}`;

  /* ---------- sections (GirderDetail secSet, rowDk) ---------- */
  /* secSet(D, s, dk): steel s, long-term c3 (3n), short-term cn (n), steel + rebar r. dk = { ts, hh, beff, n, Ar, dr } (in; dr: rebar depth from the top of the deck) */
  function secSet(D, s, dk) {
    const ps = SEC().steelCore({ D, tw: s.tw, topB: s.topB, topT: s.topT, botB: s.botB, botT: s.botT }), ySlab = ps.d + dk.hh + dk.ts / 2, o = { s: ps }, add = SEC().addPart;
    if (dk.n > 0) { o.c3 = add(ps, dk.beff * dk.ts / (3 * dk.n), ySlab, dk.beff * dk.ts ** 3 / 12 / (3 * dk.n)); o.cn = add(ps, dk.beff * dk.ts / dk.n, ySlab, dk.beff * dk.ts ** 3 / 12 / dk.n); o.ySlab = ySlab; }
    if (dk.Ar > 0) o.r = add(ps, dk.Ar, ps.d + dk.hh + dk.ts - dk.dr, 0); else o.r = ps;
    return o;
  }
  function rowDk(dk, r) { const o = {}; if (r.beff > 0) o.beff = r.beff; if (r.Ar != null && r.Ar >= 0) o.Ar = r.Ar; if (r.dr != null && r.dr >= 0) o.dr = r.dr; return Object.keys(o).length ? { ...dk, ...o } : dk; }

  /* ---------- the Fatigue module (GM.fa) ---------- */
  /* compute(p, env): GM.fa.compute(p). p as DEFAULT (rows: SPEC fields, optional ut: { MUT, MUF, VUT, VUF }). Returns { errors } or
     { errors: [], MR, dk, rows, ADTTSL, gI, gII, life, Fyw, p, ev, env }. Per row: cat, A, th, nn, ADTTeq, lim, N, dFn, gam, res; mode 'M':
     S (sections), y, d, negS, fP, fN, df, fD1, fD2, fDL, hasDL, fLLt; exempt, dem; sh, Vu (FA3); ev (evaluation). */
  function compute(p, env) {
    const E = env0(env), errors = [], g = k => nm(p[k]);
    ['ADTT', 'p', 'life', 'ts', 'beff', 'fc', 'wc', 'K1'].forEach(k => { if (!(g(k) > 0)) errors.push(`"${k}" must be positive.`); }); ['hh', 'Ar', 'dr'].forEach(k => { if (!(g(k) >= 0)) errors.push(`"${k}" must be zero or positive.`); });
    if (g('p') > 1) errors.push('Lane fraction p cannot exceed 1.0.');
    const rows = numRows(p.rows, SPEC, 'Detail', errors); if (!rows.length) errors.push('Add at least one detail.');
    if (E.dia) rows.forEach(r => { if (r.src === 'analysis') r.name = r.name.replace(/\bcross-frame\b/g, 'diaphragm'); });
    const ev = p.ev || DEFAULT.ev, evOn = ev.on === 'yes';
    if (evOn) { ['yearOpen', 'yearEval', 'ADTT', 'Rs', 'target'].forEach(k => { if (!(nm(ev[k]) >= 0)) errors.push(`Evaluation "${k}" must be zero or positive.`); }); if (!(nm(ev.yearEval) > nm(ev.yearOpen))) errors.push('Year of evaluation must be after the year opened.'); if (!(nm(ev.g) >= 0)) errors.push('Growth rate must be zero or positive.');
      ['rrE1', 'rrE2', 'rrMean'].forEach(k => { if (String(ev[k] || '').trim() && !faRR(ev[k])) errors.push(`R_R ${k.slice(2)}: enter eight positive values (A, B, B′, C, C′, D, E, E′).`); }); }
    if (errors.length) return { errors };
    const MR = SEC().modularRatio(g('fc'), g('wc'), g('K1'), p.nRule), dk = { ts: g('ts'), hh: hP(E, g('hh')), beff: g('beff'), n: MR.n, Ar: g('Ar'), dr: g('dr') };
    const gI = nm(p.gam.fI), gII = nm(p.gam.fII), ADTTSL = g('p') * g('ADTT'), life = g('life'), Fyw = GRADES[p.gW].Fy;
    const rC = E.rule('fat.catC');
    rows.forEach(r => {
      const det = DET.find(d => d[0] === r.det) || DET[DET.length - 1]; r.cat = det[1] || r.cat; r.detTxt = det[2];
      if (rC && r.det === 'Cp-stiff') { r.cat = 'C'; r.detTxt += ` (${E.cite(rC)}: flanges designed for Category C)`; r.own = rC; }
      const C = CAT[r.cat]; r.A = C.A; r.th = C.th; r.nn = +r.n || 1;
      r.ADTTeq = C.A * (gI / (gII * C.th)) ** 3 / (365 * life * r.nn);
      r.lim = p.limit === 'I' ? 'I' : p.limit === 'II' ? 'II' : ADTTSL >= r.ADTTeq ? 'I' : 'II';
      r.N = 365 * life * r.nn * ADTTSL; r.dFn = Math.cbrt(C.A / r.N);
      r.gam = r.lim === 'I' ? gI : gII; r.res = r.lim === 'I' ? C.th : r.dFn;
      if (r.mode === 'M') {
        const S = secSet(r.D, r, rowDk(dk, r)), d = S.s.d, y = { bfo: 0, bfi: r.botT, wb: r.botT + r.yo, wt: d - r.topT - r.yo, tfi: d - r.topT, tfo: d, y: r.yo }[r.loc];
        const neg = p.negSec === 'uncracked' ? S.cn : S.r, st = (M, sec) => -M * 12 * (y - sec.yb) / sec.I;
        const fP = st(r.MfP, S.cn), fN = st(r.MfN, neg);
        let fD1 = st(r.MD1, S.s); const fD2 = st(r.MD2, r.MD2 >= 0 ? S.c3 : S.r);
        // utilities on the steel section, permanent load at 1.0: the existing utilities, and the future allowance only where it adds tension (GD54b)
        const uS = p.rows[r.i]; if (utOn(uS)) { r.MUT = UT(uS, 'MUT'); r.MUF = UT(uS, 'MUF'); r.fUT = st(r.MUT, S.s); r.fUF = Math.max(st(r.MUF, S.s), 0); r.fD1c = fD1; fD1 += r.fUT + r.fUF; }
        Object.assign(r, { S, y, d, negS: neg, fP, fN, df: Math.abs(fP) + Math.abs(fN), fDL: fD1 + fD2, fD1, fD2, hasDL: Math.abs(r.MD1) + Math.abs(r.MD2) + (r.fD1c != null ? Math.abs(r.MUT) + Math.abs(r.MUF) : 0) > 0 });
        r.fLLt = gI * Math.max(Math.max(fP, 0), Math.max(fN, 0));
        if (r.loc === 'y' && !(y >= 0 && y <= d)) errors.push(`${r.name}: the custom height must lie within the steel depth (0 to ${n2(d)} in).`);
      } else {
        Object.assign(r, { df: r.dfP + r.dfN, fP: r.dfP, fN: r.dfN, hasDL: Math.abs(r.fDL) > 0 }); r.fLLt = gI * Math.max(r.dfP, r.dfN);
      }
      r.exempt = r.hasDL && r.fDL < 0 && -r.fDL >= 2 * r.fLLt;
      r.dem = r.gam * r.df;
      if (r.Vf > 0 && r.do > 0) { r.sh = SH().webShear(r.D, r.tw, Fyw, r.do, r.topB * r.topT + r.botB * r.botT, false); r.Vu = r.Vp + gI * r.Vf; if (utOn(p.rows[r.i])) { r.VUTF = UT(p.rows[r.i], 'VUT') + UT(p.rows[r.i], 'VUF'); r.Vu += r.VUTF; } }
      if (evOn) { const a = nm(ev.yearEval) - nm(ev.yearOpen), gg = nm(ev.g) / 100, Rs = nm(ev.Rs), T = nm(ev.ADTT);
        r.ev = { a, g: gg, Rs, dfe: Rs * r.df, lives: {} }; r.ev.dfmax = 2 * r.ev.dfe; r.ev.inf = r.ev.dfmax <= r.th;
        const lv = { min: 1.0, E1: (faRR(ev.rrE1) || {})[r.cat], E2: (faRR(ev.rrE2) || {})[r.cat], mean: (faRR(ev.rrMean) || {})[r.cat] };
        Object.entries(lv).forEach(([k, RR]) => { if (!RR) return; const base = RR * r.A / (365 * r.nn * T * r.ev.dfe ** 3);
          const Y = r.ev.dfe <= 0 ? Infinity : gg > 0 ? Math.log10(base * gg / (1 + gg) ** (a - 1) + 1) / Math.log10(1 + gg) : base;
          r.ev.lives[k] = { RR, base, Y, rem: Y - a }; }); }
    });
    if (errors.length) return { errors };
    return { errors: [], MR, dk, rows, ADTTSL, gI, gII, life, Fyw, p, env: E,
      ev: evOn ? { on: true, yearOpen: nm(ev.yearOpen), yearEval: nm(ev.yearEval), ADTT: nm(ev.ADTT), g: nm(ev.g), Rs: nm(ev.Rs), target: nm(ev.target), level: ev.level } : { on: false } };
  }

  /* checks(R): GM.fa.checks(R). Each check { id, grp, title, ref, items: [{ loc, r, st, demand, capacity, step }], naWhy, status, gov }. */
  function checks(R) {
    const out = ckNew(), G1 = 'Fatigue design', G2 = 'Detailing', G3 = 'Fatigue evaluation', L = r => r.name, E = R.env;
    { const c = { id: 'FA1', grp: G1, title: 'Load-induced fatigue, γ(Δf) ≤ (ΔF)_n', ref: `${ED} Eq. 6.6.1.2.2-1; Art. 6.6.1.2.5`, items: [] };
      R.rows.forEach(r => { const it = rc(L(r), r.dem, r.res, `fa${r.i}.ok`); if (r.exempt) { it.st = 'pass'; it.loc += ' (exempt: net compression)'; } c.items.push(it); }); out.add(c); }
    { const c = { id: 'FA2', grp: G1, title: 'Net-tension rule for permanent compression', ref: `${ED} Art. 6.6.1.2.1`, items: [] };
      R.rows.forEach(r => { if (!r.hasDL) { c.items.push({ loc: L(r), st: 'na', step: `fa${r.i}.net` }); return; }
        c.items.push({ loc: L(r), st: 'pass', exempt: r.exempt, step: `fa${r.i}.net` }); }); out.add(c); }
    { const c = { id: 'FA3', grp: G1, title: 'Special fatigue requirement for webs, V_u ≤ V_cr', ref: `${ED} Art. 6.10.5.3`, items: [] };
      R.rows.filter(r => r.sh).forEach(r => c.items.push(rc(L(r), r.Vu, r.sh.Vcr, `fa${r.i}.okV`)));
      if (!c.items.length) c.naWhy = 'No detail has a fatigue shear and stiffener spacing entered.'; out.add(c); }
    { const d = R.p.dist || DEFAULT.dist, c = { id: 'FA4', grp: G2, title: 'Distortion-induced fatigue detailing', ref: `${ED} Art. 6.6.1.3`, items: [] };
      if (d.cp !== 'na') c.items.push({ loc: 'Connection plates attached to both flanges (6.6.1.3.1)', st: d.cp === 'yes' ? 'pass' : 'fail', step: 'faD.cp' });
      if (d.lat === 'yes') { if (d.latLoc === 'flange') c.items.push({ loc: 'Lateral connection plates on the flange (6.6.1.3.2)', st: 'pass', step: 'faD.lat' });
        else { const bf = nm(d.latBf), dist = nm(d.latDist), req = d.latStiff === 'yes' ? bf / 2 : Math.max(6, bf / 2);
          c.items.push({ loc: `Lateral plate on ${d.latStiff === 'yes' ? 'stiffened' : 'unstiffened'} web, distance from flange (6.6.1.3.2)`, demand: req, capacity: dist, st: ge(dist, req) ? 'pass' : 'fail', r: req / dist, step: 'faD.lat' }); } }
      if (d.skew === 'yes') c.items.push({ loc: 'Obliquely oriented welded attachments (10th Edition Condition 7.3)', st: 'warn', step: 'faD.skew' });
      if (!c.items.length) c.naWhy = 'No connection plates or lateral bracing.'; out.add(c); }
    if (R.ev.on) {
      const V = R.ev;
      { const c = { id: 'FA5', grp: G3, title: 'Infinite fatigue life, (Δf)_max ≤ (ΔF)_TH', ref: 'AASHTO MBE 7.2.4', items: [] };
        R.rows.forEach(r => c.items.push({ ...rc(L(r), r.ev.dfmax, r.th, `fa${r.i}.inf`), st: r.ev.inf ? 'pass' : 'warn', loc: `${L(r)}${r.ev.inf ? '' : ' (finite life, see FA6)'}` })); out.add(c); }
      { const lvl = V.level, LN = { min: 'minimum', E1: 'Evaluation 1', E2: 'Evaluation 2', mean: 'mean' };
        const c = { id: 'FA6', grp: G3, title: 'Remaining fatigue life', ref: 'AASHTO MBE 7.2.5', items: [] };
        R.rows.filter(r => !r.ev.inf).forEach(r => { const q = r.ev.lives[lvl];
          if (!q) { c.items.push({ loc: `${L(r)}: R_R for the ${LN[lvl]} life not entered`, st: 'na', step: `fa${r.i}.life` }); return; }
          c.items.push({ loc: L(r), demand: V.target, capacity: q.rem, r: q.rem > 0 ? V.target / q.rem : Infinity, st: q.rem >= V.target ? 'pass' : 'fail', step: `fa${r.i}.life` }); });
        if (!c.items.length) c.naWhy = 'Every detail has infinite fatigue life (FA5).'; out.add(c); }
    }
    { const rC = E.rule('fat.cat');   // OWN39 (RIDOT BDM 6.3.1): primary members only with Category A, B and C′ details (warning)
      if (rC) { const okC = rC.value.ok, c = { id: 'FA7', grp: G2, title: 'Owner: detail categories on primary members', ref: E.cite(rC), src: 'DOT', items: [] };
        R.rows.forEach(r => { const ok = okC.includes(r.cat); c.items.push({ loc: L(r), st: ok ? 'pass' : 'warn', step: `fa${r.i}.own` }); });
        if (!c.items.length) c.naWhy = 'No fatigue details.'; out.add(c); } }
    return out;
  }

  /* steps(R, r): the worked steps of detail r (ids fa<i>.*) */
  function steps(R, r) {
    const w = St().work('fa' + r.i), okS = (d, c) => ge(c, d), lt = { true: '\\le', false: '\\gt' };
    w.add({ id: 'cat', label: `Detail category: ${r.detTxt}`, sym: '\\text{Category}', eq: '', sub: '', value: r.cat, unit: '', d: 0, ref: `${ED} Table 6.6.1.2.3-1`, note: r.own ? `${R.env.cite(r.own)}: connection plate details designed for Category C.` : '' });
    if (r.mode === 'M') {
      const dkR = rowDk(R.dk, r), locT = (LOC.find(q => q[0] === r.loc) || [])[1] || '', neg = R.p.negSec === 'uncracked' ? 'short-term composite, deck effective' : 'steel + deck reinforcement';
      w.add({ id: 'y', label: `Height of the detail above the bottom of the steel (${locT.toLowerCase()})`, sym: 'y', eq: '', sub: '', value: r.y, unit: 'in', d: 3, ref: `${ED} Art. 6.6.1.2.1`,
        note: `Sections: b_eff = ${n2(dkR.beff)} in, n = ${n3(R.MR.n)}, haunch ${n2(R.dk.hh)} in${dkR.Ar > 0 ? `, A_r = ${n2(dkR.Ar)} in² at ${n2(dkR.dr)} in below the top of the deck` : ''}. Short-term composite ȳ = ${n3(r.S.cn.yb)} in, I = ${n0(r.S.cn.I)} in⁴; negative-moment section (${neg}) ȳ = ${n3(r.negS.yb)} in, I = ${n0(r.negS.I)} in⁴.` });
      w.add({ id: 'fP', label: 'Stress at the detail from the positive fatigue moment (short-term composite section; tension +)', sym: 'f_{+}', eq: '-\\frac{12M_{f+}(y - \\bar{y}_{n})}{I_{n}}', sub: `-\\frac{12(${n2(r.MfP)})(${n3(r.y)} - ${n3(r.S.cn.yb)})}{${n0(r.S.cn.I)}}`, value: r.fP, unit: 'ksi', d: 2, ref: `${ED} Art. 6.6.1.2.1` });
      w.add({ id: 'fN', label: `Stress at the detail from the negative fatigue moment (${neg}; tension +)`, sym: 'f_{-}', eq: '-\\frac{12M_{f-}(y - \\bar{y}_{neg})}{I_{neg}}', sub: `-\\frac{12${pa(r.MfN)}(${n3(r.y)} - ${n3(r.negS.yb)})}{${n0(r.negS.I)}}`, value: r.fN, unit: 'ksi', d: 2, ref: `${ED} Art. 6.6.1.2.1` });
      w.add({ id: 'df', label: 'Unfactored fatigue stress range at the detail', sym: '\\Delta f', eq: '|f_{+}| + |f_{-}|', sub: `|${n2(r.fP)}| + |${n2(r.fN)}|`, value: r.df, unit: 'ksi', d: 2, ref: `${ED} Art. 6.6.1.2.1` });
      if (r.hasDL) w.add({ id: 'fDL', label: 'Stress at the detail from the unfactored permanent loads (tension +)', sym: 'f_{DL}', eq: '-\\frac{12M_{D1}(y - \\bar{y}_{s})}{I_{s}} - \\frac{12M_{D2}(y - \\bar{y}_{2})}{I_{2}}', sub: `${n2(r.fD1)} + ${n2(r.fD2)}`, value: r.fDL, unit: 'ksi', d: 2, ref: `${ED} Art. 6.6.1.2.1`,
        note: `M_D1 = ${n2(r.MD1)} kip-ft on the steel section; M_D2 = ${n2(r.MD2)} kip-ft on the ${r.MD2 >= 0 ? 'long-term (3n) composite section' : 'steel + reinforcement section'}.${r.fD1c != null ? ` The steel-section term includes the utilities: ${n2(r.fD1c)} (DC1) + ${n2(r.fUT)} (UT, M = ${n2(r.MUT)}) + ${n2(r.fUF)} (UF, M = ${n2(r.MUF)}, only where it adds tension).` : ''}` });
    } else {
      w.add({ id: 'df', label: 'Unfactored fatigue stress range entered', sym: '\\Delta f', eq: '\\Delta f_{+} + \\Delta f_{-}', sub: `${n2(r.dfP)} + ${n2(r.dfN)}`, value: r.df, unit: 'ksi', d: 2, ref: `${ED} Art. 6.6.1.2.1` });
      if (r.hasDL) w.add({ id: 'fDL', label: 'Permanent stress at the detail entered (tension +)', sym: 'f_{DL}', eq: '', sub: '', value: r.fDL, unit: 'ksi', d: 2, ref: `${ED} Art. 6.6.1.2.1` });
    }
    w.add({ id: 'fLLt', label: 'Largest tensile live-load stress at the detail, Fatigue I factor', sym: '\\gamma_{I}f_{LL,t}', eq: '\\gamma_{I}\\max(f_{+}, f_{-}, 0)', sub: `${n2(R.gI)}\\max(${n2(r.fP)}, ${n2(r.fN)}, 0)`, value: r.fLLt, unit: 'ksi', d: 2, ref: `${ED} Art. 6.6.1.2.1` });
    w.add({ id: 'net', label: 'Net-tension rule (FA2): fatigue need not be checked where f_DL < 0 and |f_DL| ≥ 2γ_I f_LL,t', sym: '\\text{exempt}', eq: '', sub: r.hasDL ? `f_{DL} = ${n2(r.fDL)},\\ 2\\gamma_{I}f_{LL,t} = ${n2(2 * r.fLLt)}` : '\\text{permanent stress not entered}', value: r.exempt ? 'yes: compression at least twice the tension' : 'no: fatigue is checked', unit: '', d: 0, ref: `${ED} Art. 6.6.1.2.1` });
    w.add({ id: 'ADTTSL', label: 'Single-lane average daily truck traffic', sym: '(ADTT)_{SL}', eq: 'p \\times ADTT', sub: `${n2(nm(R.p.p))} \\times ${n0(nm(R.p.ADTT))}`, value: R.ADTTSL, unit: '\\text{trucks/day}', d: 0, ref: `${ED} Eq. 3.6.1.4.2-1` });
    w.add({ id: 'nn', label: 'Stress range cycles per truck passage', sym: 'n', eq: '', sub: '', value: r.nn, unit: '', d: 1, ref: `${ED} Table 6.6.1.2.5-1` });
    w.add({ id: 'eq', label: `(ADTT)_SL equivalent to infinite life, Category ${r.cat}`, sym: '(ADTT)_{SL,\\infty}', eq: '\\frac{A}{365(\\text{life})n}\\left(\\frac{\\gamma_{I}}{\\gamma_{II}(\\Delta F)_{TH}}\\right)^{3}', sub: `\\frac{${(r.A / 1e8).toFixed(1)}\\times10^{8}}{365(${n0(R.life)})(${r.nn})}\\left(\\frac{${n2(R.gI)}}{${n2(R.gII)}(${n2(r.th)})}\\right)^{3}`, value: r.ADTTeq, unit: '\\text{trucks/day}', d: 0, ref: `${ED} Art. 6.6.1.2.3, Table 6.6.1.2.3-2` });
    w.add({ id: 'lim', label: 'Fatigue limit state', sym: '\\text{limit state}', eq: '', sub: R.p.limit === 'auto' ? `(ADTT)_{SL} = ${n0(R.ADTTSL)} ${R.ADTTSL >= r.ADTTeq ? '\\ge' : '\\lt'} ${n0(r.ADTTeq)}` : `\\text{Fatigue ${R.p.limit} selected for every detail}`, value: r.lim === 'I' ? 'Fatigue I (infinite life)' : 'Fatigue II (finite life)', unit: '', d: 0, ref: `${ED} Art. 6.6.1.2.3` });
    if (r.lim === 'II') { w.add({ id: 'N', label: 'Number of stress range cycles', sym: 'N', eq: '365(\\text{life})n(ADTT)_{SL}', sub: `365(${n0(R.life)})(${r.nn})(${n0(R.ADTTSL)})`, value: r.N, unit: '', d: 0, ref: `${ED} Eq. 6.6.1.2.5-3` });
      w.add({ id: 'res', label: 'Nominal fatigue resistance, Fatigue II', sym: '(\\Delta F)_{n}', eq: '\\left(\\frac{A}{N}\\right)^{1/3}', sub: `\\left(\\frac{${(r.A / 1e8).toFixed(1)}\\times10^{8}}{${n0(r.N)}}\\right)^{1/3}`, value: r.res, unit: 'ksi', d: 2, ref: `${ED} Eq. 6.6.1.2.5-2` }); }
    else w.add({ id: 'res', label: 'Nominal fatigue resistance, Fatigue I', sym: '(\\Delta F)_{n}', eq: '(\\Delta F)_{TH}', sub: n2(r.th), value: r.res, unit: 'ksi', d: 2, ref: `${ED} Eq. 6.6.1.2.5-1, Table 6.6.1.2.3-1` });
    w.add({ id: 'dem', label: `Factored stress range, Fatigue ${r.lim}`, sym: '\\gamma(\\Delta f)', eq: '\\gamma\\Delta f', sub: `${n2(r.gam)}(${n2(r.df)})`, value: r.dem, unit: 'ksi', d: 2, ref: `${ED} Table 3.4.1-1` });
    w.add({ id: 'ok', label: `Load-induced fatigue (FA1)${r.exempt ? ': exempt under the net-tension rule' : ''}`, sym: '\\frac{\\gamma(\\Delta f)}{(\\Delta F)_{n}}', eq: '', sub: `\\frac{${n2(r.dem)}}{${n2(r.res)}}`, value: r.dem / r.res, unit: '', d: 3, ref: `${ED} Eq. 6.6.1.2.2-1`, ok: r.exempt || okS(r.dem, r.res) });
    if (r.sh) { w.add({ id: 'Vu', label: 'Special fatigue loading: unfactored permanent shear plus the Fatigue I shear', sym: 'V_{u}', eq: `V_{perm}${r.VUTF != null ? ' + V_{UT+UF}' : ''} + \\gamma_{I}V_{fat}`, sub: `${n2(r.Vp)}${r.VUTF != null ? ` + ${n2(r.VUTF)}` : ''} + ${n2(R.gI)}(${n2(r.Vf)})`, value: r.Vu, unit: 'kip', d: 2, ref: `${ED} Art. 6.10.5.3` });
      w.add({ id: 'Vcr', label: `Shear buckling resistance (d_o = ${n2(r.do)} in, k = ${n3(r.sh.k)})`, sym: 'V_{cr}', eq: 'CV_{p}', sub: `${n3(r.sh.C)}(${n2(r.sh.Vp)})`, value: r.sh.Vcr, unit: 'kip', d: 2, ref: `${ED} Eq. 6.10.9.3.3-1` });
      w.add({ id: 'okV', label: 'Special fatigue requirement for webs (FA3)', sym: 'V_{u} \\le V_{cr}', eq: '', sub: `${n2(r.Vu)} ${lt[okS(r.Vu, r.sh.Vcr)]} ${n2(r.sh.Vcr)}`, value: r.Vu / r.sh.Vcr, unit: '', d: 3, ref: `${ED} Eq. 6.10.5.3-1`, ok: okS(r.Vu, r.sh.Vcr) }); }
    if (r.ev) { const V = R.ev;
      w.add({ id: 'dfe', label: 'Effective stress range', sym: '(\\Delta f)_{eff}', eq: 'R_{s}\\Delta f', sub: `${n2(r.ev.Rs)}(${n2(r.df)})`, value: r.ev.dfe, unit: 'ksi', d: 2, ref: 'AASHTO MBE 7.2.2' });
      w.add({ id: 'inf', label: 'Infinite life (FA5)', sym: '(\\Delta f)_{max} = 2(\\Delta f)_{eff} \\le (\\Delta F)_{TH}', eq: '', sub: `2(${n2(r.ev.dfe)}) = ${n2(r.ev.dfmax)} ${lt[r.ev.inf]} ${n2(r.th)}`, value: r.ev.dfmax / r.th, unit: '', d: 3, ref: 'AASHTO MBE 7.2.4', ok: r.ev.inf });
      if (!r.ev.inf) { const q = r.ev.lives[V.level];
        w.add({ id: 'life', label: `Remaining fatigue life, ${V.level} level (FA6)`, sym: 'Y - a', eq: '\\frac{\\log\\left[\\frac{R_{R}Ag}{365n(ADTT)_{SL}(\\Delta f)_{eff}^{3}(1+g)^{a-1}} + 1\\right]}{\\log(1+g)} - a', sub: q ? `${isFinite(q.Y) ? n2(q.Y) : '\\infty'} - ${n0(r.ev.a)}` : 'R_{R}\\ \\text{not entered}', value: q ? q.rem : NaN, unit: '\\text{years}', d: 1, ref: 'AASHTO MBE 7.2.5', ok: q ? q.rem >= V.target : undefined, note: `Required ${n0(V.target)} years; present ADTT_SL ${n0(V.ADTT)}, g = ${n2(V.g)}%/yr, a = ${n0(r.ev.a)} years.` }); } }
    return w.steps;
  }

  /* ---------- GS17: flange stress range at a flexure location (GM.gs) ---------- */
  /* flange(r, o): r = a location of engine/flexure.js (its Fatigue I ranges dfT, dfB, MfP, MfN, card, fatNegSec, gfat); o = { set (settings()),
     B (supports()), catT, catB (detail categories of the top and bottom flanges), x (station for n; default r.x), gFat (γ Fatigue I; default r.gfat) }.
     Returns { fatN, fatT, fatB, dfT2, dfB2, items: [top, bottom], steps }. Fatigue I: the flexure range as is; Fatigue II: γ_II × the unfactored range. */
  function flange(r, o) {
    const s = o.set, x0 = o.x !== undefined ? o.x : r.x, gf = o.gFat != null ? o.gFat : r.gfat, pos = r.region === 'pos', cn = r.nc ? r.card.s : r.card.cn, d = r.d;
    const fAt = (M, sec, y) => -M * 12 * (y - sec.yb) / sec.I;
    const fatN = nAt(x0, !pos, r.cont, o.B), fatT = limitState(o.catT, fatN, gf, s), fatB = limitState(o.catB, fatN, gf, s);
    const uT = Math.abs(fAt(r.MfP, cn, d)) + Math.abs(fAt(r.MfN, r.fatNegSec, d)), uB = Math.abs(fAt(r.MfP, cn, 0)) + Math.abs(fAt(r.MfN, r.fatNegSec, 0));
    const dfT2 = fatT.lim === 'I' ? r.dfT : fatT.gam * uT, dfB2 = fatB.lim === 'I' ? r.dfB : fatB.gam * uB;
    const items = [['top', dfT2, o.catT, fatT, 'T'], ['bottom', dfB2, o.catB, fatB, 'B']].map(([f, v, k, q, t]) => rc(`${r.name}, ${f}`, v, q.res, `gs17.${t}.ok`, { cat: k, lim: q.lim }));
    const w = St().work('gs17');
    w.add({ id: 'n', label: 'Stress range cycles per truck passage', sym: 'n', eq: '', sub: '', value: fatN, unit: '', d: 1, ref: `${ED} Table 6.6.1.2.5-1`, note: o.B && x0 != null && isFinite(+x0) ? `At ${n2(+x0)} ft: 1.5 within 0.1L of each side of an interior support of a continuous girder, else 1.0.` : `${pos ? 'Positive' : 'Negative'}-moment location${r.cont ? ' of a continuous girder' : ''} (no station on the bridge).` });
    [['T', 'top', fatT, dfT2, uT, o.catT], ['B', 'bottom', fatB, dfB2, uB, o.catB]].forEach(([t, f, q, v, u, k]) => {
      w.add({ id: `${t}.lim`, label: `Fatigue limit state, ${f} flange (Category ${k})`, sym: '\\text{limit state}', eq: '', sub: !s.ok ? '\\text{traffic inputs incomplete: Fatigue I}' : s.limit !== 'auto' ? `\\text{Fatigue ${s.limit} selected}` : `(ADTT)_{SL} = ${n0(s.ADTTSL)} ${q.lim === 'I' ? '\\ge' : '\\lt'} ${n0(q.eq)}`, value: q.lim === 'I' ? 'Fatigue I' : 'Fatigue II', unit: '', d: 0, ref: `${ED} Art. 6.6.1.2.3` });
      if (q.lim === 'II') { w.add({ id: `${t}.N`, label: 'Number of stress range cycles', sym: 'N', eq: '365(\\text{life})n(ADTT)_{SL}', sub: `365(${n0(s.life)})(${fatN})(${n0(s.ADTTSL)})`, value: q.N, unit: '', d: 0, ref: `${ED} Eq. 6.6.1.2.5-3` });
        w.add({ id: `${t}.v`, label: `Factored stress range, ${f} of steel, Fatigue II`, sym: '\\gamma_{II}(\\Delta f)', eq: '\\gamma_{II}(|f_{+}| + |f_{-}|)', sub: `${n2(q.gam)}(${n2(u)})`, value: v, unit: 'ksi', d: 2, ref: `${ED} Table 3.4.1-1, Art. 6.6.1.2.1`, note: 'The unfactored range: the Fatigue I range of the flexure steps divided by γ_I.' }); }
      else w.add({ id: `${t}.v`, label: `Factored stress range, ${f} of steel, Fatigue I`, sym: '\\gamma_{I}(\\Delta f)', eq: '', sub: '', value: v, unit: 'ksi', d: 2, ref: `${ED} Table 3.4.1-1`, note: `As worked in the flexure steps (fat${t}), γ_I = ${n2(gf)}.` });
      w.add({ id: `${t}.res`, label: `Nominal fatigue resistance, ${f} flange`, sym: '(\\Delta F)_{n}', eq: q.lim === 'I' ? '(\\Delta F)_{TH}' : '\\left(\\frac{A}{N}\\right)^{1/3}', sub: q.lim === 'I' ? n2(q.th) : `\\left(\\frac{${(q.A / 1e8).toFixed(1)}\\times10^{8}}{${n0(q.N)}}\\right)^{1/3}`, value: q.res, unit: 'ksi', d: 2, ref: q.lim === 'I' ? `${ED} Eq. 6.6.1.2.5-1` : `${ED} Eq. 6.6.1.2.5-2` });
      w.add({ id: `${t}.ok`, label: `Flange stress range, ${f} (GS17)`, sym: '\\gamma(\\Delta f) \\le (\\Delta F)_{n}', eq: '', sub: `${n2(v)} ${ge(q.res, v) ? '\\le' : '\\gt'} ${n2(q.res)}`, value: v / q.res, unit: '', d: 3, ref: `${ED} Eq. 6.6.1.2.2-1, Art. 6.10.5.1`, ok: ge(q.res, v) }); });
    return { fatN, fatT, fatB, dfT2, dfB2, items, steps: w.steps };
  }

  /* ---------- details from a hand-off file ---------- */
  /* detailsFromPayload(pl, opt): fatigue detail rows for one girder from a hand-off file (schema stgirder-external-demands), with the kinds
     and rules of Preliminary sizing's inventory (detailExport): per span the flange-to-web weld (bottom flange) at the largest positive
     fatigue moment range, and with a stiffened web the transverse stiffener weld toe on the web (max(4t_w, 1.5) in above the bottom
     flange) at the same station; the connection plate weld toe on the bottom flange at the cross-frame (opt.frames, ft) with the largest
     fatigue moment range in the span; per interior support of a continuous girder the flange-to-web weld and the studs on the top flange,
     and the connection plate on the top flange at the nearest cross-frame; at each plate change both flanges (shop butt splice, Category B;
     a field splice when opt.splices has it: bolted, Category B). n per Table 6.6.1.2.5-1 on the payload's spans. Moments linear between the
     payload stations (M_FATpos, M_FATneg, M_DC1, M_DC2 + M_DW), shears the station values. NOT parity-tested: Preliminary sizing builds its
     inventory from its own analysis (elements and nodes, the envelope of the girder types); this is the same list on this girder's own demands. */
  function detailsFromPayload(pl, opt) {
    opt = opt || {};
    const S = pl.stations || [], sup = (pl.member || {}).supports || [], zones = (pl.section || {}).zones || [], g = pl.girderDetail || {}, dk = g.deck || {}, lbl = g.label || '';
    const xs = S.map(s => +s.x), A = k => S.map(s => +s[k] || 0), MfP = A('M_FATpos'), MfN = A('M_FATneg'), MD1 = A('M_DC1'), MD2 = S.map(s => (+s.M_DC2 || 0) + (+s.M_DW || 0));
    const Vp = S.map(s => Math.abs(+s.V_DC1 || 0) + Math.abs(+s.V_DC2 || 0) + Math.abs(+s.V_DW || 0)), Vf = S.map(s => Math.max(Math.abs(+s.V_FATpos || 0), Math.abs(+s.V_FATneg || 0)));
    const at = (Ar, x) => { let i = 0; while (i < xs.length - 2 && xs[i + 1] < x) i++; const t = Math.max(0, Math.min(1, (x - xs[i]) / ((xs[i + 1] - xs[i]) || 1))); return Ar[i] * (1 - t) + Ar[i + 1] * t; };
    const near0 = x => { let i = 0; xs.forEach((v, q) => { if (Math.abs(v - x) < Math.abs(xs[i] - x)) i = q; }); return i; };
    const zAt = x => { const z = zones.find(q => x >= q.startX - 1e-9 && x < q.endX) || zones[zones.length - 1]; return { D: z.web.depth, tw: z.web.thickness, topB: z.topFlange.width, topT: z.topFlange.thickness, botB: z.botFlange.width, botT: z.botFlange.thickness }; };
    const cont = sup.length > 2, spans = sup.slice(1).map((x, k) => x - sup[k]), B = supports({ ok: true, spans, cont });
    const nStr = x => String(nAt(x, false, cont, B)), r1 = v => +(+v).toFixed(1), r2 = v => +(+v).toFixed(2), rng = x => at(MfP, x) - at(MfN, x);
    const rows = [], row = (name, det, loc, x, s, yo = 0) => { const i = near0(x);
      rows.push({ name: `${name}${lbl ? ', ' + lbl : ''}`, src: 'analysis', det, cat: 'B', mode: 'M', loc, yo, x: r2(x), n: nStr(x), ...s, MfP: r1(Math.max(0, at(MfP, x))), MfN: r1(Math.min(0, at(MfN, x))), MD1: r1(at(MD1, x)), MD2: r1(at(MD2, x)),
        Vp: r1(Vp[i]), Vf: r1(Vf[i]), do: 0, dfP: 0, dfN: 0, fDL: 0, beff: +dk.beff > 0 ? r2(dk.beff) : null }); };
    const frames = opt.frames || [], stiff = opt.stiffened !== false;
    spans.forEach((Ls, k) => { const a = sup[k], b = sup[k + 1]; let ip = -1; xs.forEach((x, i) => { if (x > a && x < b && MfP[i] > -MfN[i] && (ip < 0 || MfP[i] - MfN[i] > MfP[ip] - MfN[ip])) ip = i; });
      const xp = ip >= 0 ? xs[ip] : a + Ls / 2;
      row(`Span ${k + 1}, flange-to-web weld at max. positive range`, 'B-weld', 'bfo', xp, zAt(xp));
      const fr = frames.filter(x => x > a + 0.5 && x < b - 0.5); if (fr.length) { const fx = fr.reduce((q, x) => rng(x) > rng(q) ? x : q, fr[0]); row(`Span ${k + 1}, connection plate at cross-frame ${n2(fx)} ft, bottom flange`, 'Cp-stiff', 'bfi', fx, zAt(fx)); }
      if (stiff) row(`Span ${k + 1}, transverse stiffener weld toe on the web`, 'Cp-stiff', 'wb', xp, zAt(xp), r2(Math.max(4 * zAt(xp).tw, 1.5))); });
    if (cont) sup.slice(1, -1).forEach((xp, kk) => { const k = kk + 1, s = zAt(xp - 0.01);
      row(`Pier ${k}, flange-to-web weld`, 'B-weld', 'tfo', xp, s); row(`Pier ${k}, shear studs on the top flange`, 'C-stud', 'tfo', xp, s);
      const nf = frames.filter(x => Math.abs(x - xp) > 0.5).sort((p, q) => Math.abs(p - xp) - Math.abs(q - xp))[0]; if (nf != null) row(`Pier ${k}, connection plate at cross-frame ${n2(nf)} ft, top flange`, 'Cp-stiff', 'tfi', nf, zAt(nf)); });
    const spl = opt.splices || [], small = x => { const a = zAt(x - 0.01), b = zAt(x + 0.01), Af = s => s.topB * s.topT + s.botB * s.botT; return Af(a) <= Af(b) ? a : b; };
    zones.slice(0, -1).forEach(z => { const x = z.endX, a = zAt(x - 0.01), b = zAt(x + 0.01), fs = spl.some(q => Math.abs(q - x) < 0.05);
      if (fs) { row(`Field splice at ${n2(x)} ft, bottom flange`, 'B-bolt', 'bfo', x, small(x)); row(`Field splice at ${n2(x)} ft, top flange`, 'B-bolt', 'tfo', x, small(x)); return; }
      if (a.topB !== b.topB || a.topT !== b.topT) row(`Top flange shop transition at ${n2(x)} ft`, 'B-butt', 'tfo', x, small(x));
      if (a.botB !== b.botB || a.botT !== b.botT) row(`Bottom flange shop transition at ${n2(x)} ft`, 'B-butt', 'bfo', x, small(x)); });
    return rows;
  }

  window.SBDFatigue = { ES, CAT, CATS, STUD, DET, LOC, SPEC, DEFAULT, faRR, settings, supports, nAt, nRange, limitState, studLimit, setText, secSet, rowDk, compute, checks, steps, flange, detailsFromPayload };
})();
