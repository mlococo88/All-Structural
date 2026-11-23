/* apps/steel-bridge/engine/deck.js — transverse design of the concrete deck slab (window.SBDDeck). Classic script, no DOM.
   Created 2026-11-23 (DK; engineer request 2026-11-23: the deck design of the Prestressed Bridge Design app in the Steel Bridge app).
   Needs window.SharedDeck (shared/deck.js: the calculation, the same method and arithmetic as the Prestressed app's deck module),
   window.SharedSteps, window.SBDLoads (the cross-section and its dead loads), window.SBDOwners (through SBDLoads), loaded first.

   AASHTO LRFD 10th Ed. (2024): strip method 4.6.2.1, design section 4.6.2.1.6 (steel I-girder: one quarter of the top flange width from
   the girder centreline), live load Table A4-1, Strength I Table 3.4.1-1 with the owner's eta and HL-93 multiplier m (Project tab),
   flexural resistance 5.6.3.2 with phi of 5.5.4.2, overhang wheel 3.6.1.3.1 on the strip of Table 4.6.2.1.3-1, distribution
   reinforcement 9.7.3.2. Not checked (as the Prestressed module; stated on the tab and in the report): the Extreme Event II collision
   cases of the overhang (A13.4), crack control (5.6.7), minimum reinforcement (5.6.3.3), temperature and shrinkage steel (5.10.6).

   Inputs. Nothing the project already holds is asked again:
     girder spacings          xs.bays (Cross-section tab): each different spacing is designed, the largest M_u governs
     overhangs                xs.ohL, xs.ohR; the deck edge loads, sidewalks, wearing surface, overlays and added line loads of the Loads
                              module (SBDLoads.compute dead.per: position and weight of each, overrides included); the traffic face of the
                              live load (its ll.L.r / ll.R.r): the wheel is 1 ft inside it
     slab                     deck.ts (resistance), deck.tdeck (dead load), materials.concrete.fc, wc; rebar F_y materials.rebar.Fyr
     top flange width         the narrowest top flange of every girder type and plate segment (the largest negative moment)
     owner rules              eta and m of SBDOwners.loadFactors (the loads module's lf)
   The module's own inputs, P.deckDesign (OPTIONAL; absent in every project saved before 2026-11-23, which reads as DEF: off):
     { on (false), barTop, barBot (area of one bar, in^2), sTop, sBot (spacing, in), coverT, coverB (clear cover, in),
       xnegAuto (true: b_f/4), xneg (entered design section, in) }
   Decision (pending engineer review): the module is OFF until switched on (old and new projects), as the Prestressed app's deck module;
   while it is off nothing is calculated and no result, Summary verdict or report section changes.

   calc(P) -> { on: false } | { on: true, err } | { on: true, D, in: {…}, bays: [{ S, lines, I, pos, neg }], gp, gn (governing bay index),
     oh: { L, R: { O, cap, side, name } }, go ('L' | 'R'), dist: { S, pct, As }, checks: [{ id, title, ref, r, Mu, phiMn, ok, loc, step }],
     warn: [text], steps }   (moments kip-ft per foot of deck) */
(function () {
  'use strict';
  const DEF = { on: false, barTop: 0.31, sTop: 6, coverT: 2.5, barBot: 0.31, sBot: 6, coverB: 1.0, xnegAuto: true, xneg: 0 };
  const BARS = [['#3', 0.11], ['#4', 0.20], ['#5', 0.31], ['#6', 0.44], ['#7', 0.60], ['#8', 0.79], ['#9', 1.00], ['#10', 1.27], ['#11', 1.56]];   // ASTM A615 bar areas, in^2
  const ED = 'AASHTO LRFD 10th Ed. ';
  const SD = () => window.SharedDeck, St = () => window.SharedSteps;
  const inputs = P => ({ ...DEF, ...((P && P.deckDesign && typeof P.deckDesign === 'object') ? P.deckDesign : {}) });
  const isOn = P => !!(P && P.deckDesign && P.deckDesign.on === true);
  const barName = A => { const b = BARS.find(q => Math.abs(q[1] - A) < 1e-9); return b ? b[0] : `${St().fmt(A, 2)} in²`; };
  const fin = v => typeof v === 'number' && isFinite(v);
  const META = new WeakMap();   // steps list -> its result (the topics' titles)

  /* loadsOf(P): the loads module's cross-section (no change to P) */
  function loadsOf(P) {
    const LD = window.SBDLoads, q = LD.fromModel(P, { girder: 0 });
    return LD.compute(q.b, q.p);
  }
  /* sideLoads(R, sd): the loads of the Loads module on the overhang of side 'L' | 'R', positions measured from that side's deck edge.
     DC: categories DC1, DC2 and UF (factor 1.25); DW: DW and UT (factor 1.50); PL: the pedestrian load. */
  function sideLoads(R, sd) {
    const Wd = R.dead.Wd, oh = sd === 'L' ? +R.b.ohL : +R.b.ohR, fx = x => (sd === 'L' ? x : Wd - x), out = { DC: [], DW: [], PL: [] };
    R.dead.per.forEach(L => {
      const grp = L.cat === 'DW' || L.cat === 'UT' ? 'DW' : L.cat === 'PL' ? 'PL' : 'DC';
      let q = null;
      if (L.def && L.def.kind === 'ped' && L.def.w > 0) q = { q: L.plf / L.def.w, x0: fx(L.x - L.def.w / 2), x1: fx(L.x + L.def.w / 2) };
      else if (L.x0 != null && L.x1 != null && L.x1 > L.x0) q = { q: L.plfAuto === undefined && L.def && L.def.kind === 'area' ? L.def.q / 1000 : L.plf / (L.x1 - L.x0), x0: fx(L.x0), x1: fx(L.x1) };
      else q = { w: L.plf, x: fx(L.x) };
      if (q.q != null) { const a = Math.min(q.x0, q.x1), b = Math.max(q.x0, q.x1); q.x0 = a; q.x1 = b; if (!(a < oh - 1e-9)) return; }
      else if (!(q.x < oh - 1e-9) || q.x < -1e-9) return;
      out[grp].push({ ...q, name: L.desc || L.id, id: L.id, cat: L.cat });
    });
    return { oh, ...out };
  }

  function calc(P) {
    const D = inputs(P);
    if (!D.on) return { on: false, D };
    let R; try { R = loadsOf(P); } catch (e) { return { on: true, D, err: 'The cross-section and loads could not be computed: ' + (e && e.message) }; }
    if (R.errors && R.errors.length) return { on: true, D, err: 'Cross-section and loads: ' + R.errors.map(e => e.msg || e).join(' ') };
    const b = R.b, dead = R.dead, lf = R.lf || { eta: 1, m: 1 }, S = SD();
    const ts = +b.tsDeck, tL = ts + (+b.tsac || 0), wc = +dead.uc, fc = +b.fc, fy = +(((P.materials || {}).rebar || {}).Fyr);
    const bad = [];
    [['barTop', 'Top bar area'], ['barBot', 'Bottom bar area'], ['sTop', 'Top bar spacing'], ['sBot', 'Bottom bar spacing']].forEach(([k, t]) => { if (!(fin(+D[k]) && +D[k] > 0)) bad.push(`${t} must be greater than 0.`); });
    [['coverT', 'Top cover'], ['coverB', 'Bottom cover']].forEach(([k, t]) => { if (!(fin(+D[k]) && +D[k] >= 0)) bad.push(`${t} must be zero or positive.`); });
    if (D.xnegAuto === false && !(fin(+D.xneg) && +D.xneg >= 0)) bad.push('The design section distance must be zero or positive.');
    if (!(fy > 0)) bad.push('Rebar F_yr (Materials tab) must be positive.');
    if (!(ts > 0 && fc > 0 && wc > 0)) bad.push('The slab thickness, f′_c and w_c must be positive.');
    if (bad.length) return { on: true, D, err: 'Deck design inputs: ' + bad.join(' ') };
    const eta = +lf.eta || 1, mLL = +lf.m || 1;
    const wDC = tL / 12 * wc;
    // wearing surface and overlays on the roadway (the Loads module's area loads of category DW), ksf
    const dwA = dead.per.filter(L => L.cat === 'DW' && L.x0 != null && L.x1 > L.x0).map(L => ({ name: L.desc || L.id, q: L.plfAuto === undefined && L.def && L.def.kind === 'area' ? L.def.q / 1000 : L.plf / (L.x1 - L.x0) }));
    let wDW = 0; dwA.forEach(a => { wDW = wDW + a.q; });
    // design section (4.6.2.1.6): the narrowest top flange of the bridge
    let bf = Infinity, bfAt = ''; (P.girders || []).forEach(g => (g.segments || []).forEach((s, i) => { if (+s.topB > 0 && +s.topB < bf) { bf = +s.topB; bfAt = `${g.label || g.id}, segment ${i + 1}`; } }));
    if (!fin(bf)) bf = 0;
    const auto = D.xnegAuto !== false, xneg = auto ? S.designSection('steel', bf).x : S.clamp(+D.xneg || 0, 0, 24);
    // the bays: one design per different spacing
    const groups = []; (b.bays || []).forEach((s, i) => { const g = groups.find(q => Math.abs(q.S - s) < 1e-9); if (g) g.lines.push(i); else groups.push({ S: +s, lines: [i] }); });
    const cap = (top, Mu) => S.capacity({ barA: +(top ? D.barTop : D.barBot), sp: +(top ? D.sTop : D.sBot), cover: +(top ? D.coverT : D.coverB), ts, fc, fy, Mu });
    const bays = groups.map(g => { const I = S.interior({ S: g.S, wDC, wDW, xneg, eta, mLL }); return { S: g.S, lines: g.lines, I, pos: cap(false, I.Mu_pos), neg: cap(true, I.Mu_neg),
      name: `S = ${St().fmt(g.S, 2)} ft (${g.lines.length > 1 ? 'bays' : 'bay'} ${g.lines.map(i => `G${i + 1}–G${i + 2}`).join(', ')})` }; });
    let gp = 0, gn = 0; bays.forEach((q, k) => { if (q.I.Mu_pos > bays[gp].I.Mu_pos) gp = k; if (q.I.Mu_neg > bays[gn].I.Mu_neg) gn = k; });
    // the overhangs
    const oh = {}; ['L', 'R'].forEach(sd => { const L = sideLoads(R, sd), face = +((R.ll || {})[sd] || {}).r || 0;
      const O = S.overhang({ oh: L.oh, face, wSlab: wDC, DC: L.DC, DW: L.DW, PL: L.PL, eta, mLL });
      oh[sd] = { side: sd, name: sd === 'L' ? 'Left overhang' : 'Right overhang', O, cap: cap(true, O.Mu_oh), faceBy: ((R.ll || {})[sd] || {}).by || '' }; });
    const go = oh.R.O.Mu_oh > oh.L.O.Mu_oh ? 'R' : 'L';
    // distribution reinforcement: the smallest spacing gives the largest percentage
    const Smin = Math.min(...bays.map(q => q.S)), pct = S.distPct(Smin), dist = { S: Smin, pct, As: pct / 100 * bays[gp].pos.As };
    // worked steps
    const steps = [], many = bays.length > 1;
    const xs = auto ? { kind: 'steel', b: bf, note: `The narrowest top flange of the bridge (${bfAt}): the design section nearest the girder centreline, the largest negative moment. Kept within 0 to 24 in (Table A4-1).` } : { kind: 'entered', xent: +D.xneg, note: 'Entered on the Cross-section tab (Deck design).' };
    const wDWsub = dwA.length > 1 ? dwA.map(a => St().n(a.q, 4)).join(' + ') : '';
    bays.forEach((q, k) => { const w = St().work('dk.b' + (k + 1));
      S.steps.interior(w, q.I, { tL, wc, wDCnote: `t = the total deck thickness (Cross-section tab: structural slab ${St().fmt(ts, 2)} in${tL - ts > 1e-9 ? ` + ${St().fmt(tL - ts, 2)} in dead load only` : ''}); w_c the deck concrete (Materials tab).`,
        wDWsub, wDWnote: dwA.length ? `${dwA.map(a => a.name).join(' + ')} (Loads tab), as the Loads & LLDF module.` : 'No wearing surface or overlay (Loads tab).', xs });
      if (k !== gp) S.steps.capacity(w, 'pos', 'Positive moment, bottom bars', q.pos, { short: true, shortNote: 'The same bars as the governing bay.', muSym: 'M_{u,+}', check: `DK1 Positive moment, ${q.name}` });
      if (k !== gn) S.steps.capacity(w, 'neg', 'Negative moment, top bars', q.neg, { short: true, shortNote: 'The same bars as the governing bay.', muSym: 'M_{u,-}', check: `DK2 Negative moment, ${q.name}` });
      w.steps.forEach(s => { if (many) s.label = `${s.label} [S = ${St().fmt(q.S, 2)} ft]`; steps.push(s); }); });
    { const w = St().work('dk');
      S.steps.capacity(w, 'pos', 'Positive moment, bottom bars', bays[gp].pos, { muSym: 'M_{u,+}', check: `DK1 Positive moment, bottom bars${many ? `, governing ${bays[gp].name}` : ''}` });
      S.steps.capacity(w, 'neg', 'Negative moment, top bars', bays[gn].neg, { muSym: 'M_{u,-}', check: `DK2 Negative moment, top bars${many ? `, governing ${bays[gn].name}` : ''}` });
      steps.push(...w.steps); }
    ['L', 'R'].forEach(sd => { const q = oh[sd], w = St().work('dk.oh' + sd);
      S.steps.overhang(w, q.O, { faceNote: `o_h = the ${sd === 'L' ? 'left' : 'right'} overhang, exterior girder centreline to the deck edge (Cross-section tab); x_f = the deck edge to the traffic face${q.faceBy ? ` (${q.faceBy})` : ''}, as the Loads & LLDF module.` });
      S.steps.capacity(w, 'cap', `${q.name}, top bars`, q.cap, { short: true, muSym: 'M_{u,oh}', check: `DK3 ${q.name}, top bars` });
      w.steps.forEach(s => { s.label = s.label.replace(/^Overhang:/, q.name + ':'); steps.push(s); }); });
    { const w = St().work('dk'); S.steps.dist(w, Smin, pct, { As: bays[gp].pos.As, note: `S in ft, taken as the girder spacing${many ? ' (the smallest spacing: the largest percentage)' : ''}. Bottom bars parallel to the girders.` }); steps.push(...w.steps); }
    const checks = [
      { id: 'DK1', title: 'Deck positive moment, bottom bars (Strength I)', ref: ED + 'Art. 4.6.2.1, Table A4-1, 5.6.3.2', r: bays[gp].pos.dc, Mu: bays[gp].pos.Mu, phiMn: bays[gp].pos.phiMn, ok: bays[gp].pos.ok, loc: bays[gp].name, step: 'dk.pos.r' },
      { id: 'DK2', title: 'Deck negative moment, top bars (Strength I)', ref: ED + 'Art. 4.6.2.1.6, Table A4-1, 5.6.3.2', r: bays[gn].neg.dc, Mu: bays[gn].neg.Mu, phiMn: bays[gn].neg.phiMn, ok: bays[gn].neg.ok, loc: bays[gn].name, step: 'dk.neg.r' },
      { id: 'DK3', title: 'Deck overhang, top bars (Strength I, gravity loads)', ref: ED + 'Art. 3.6.1.3.1, Table 4.6.2.1.3-1, 5.6.3.2', r: oh[go].cap.dc, Mu: oh[go].cap.Mu, phiMn: oh[go].cap.phiMn, ok: oh[go].cap.ok, loc: oh[go].name, step: `dk.oh${go}.cap.r` }];
    const warn = [];
    bays.forEach(q => { if (q.I.A4.below) warn.push(`${q.name}: the spacing is below the 4 ft of Table A4-1; the 4 ft row is used.`); if (q.I.A4.above) warn.push(`${q.name}: the spacing is above the 15 ft of Table A4-1; the 15 ft row is used and a refined analysis is required.`); });
    if (!auto && +D.xneg > 24) warn.push('The entered design section is beyond the 24 in of Table A4-1; 24 in is used.');
    const inBay = dead.per.filter(L => /^(sw[LR]|med|fence[LR]|u\d+)$/.test(L.id || '') && L.cat !== 'PL' && (L.x1 != null ? Math.max(L.x0, L.x1) > +b.ohL + 1e-9 && Math.min(L.x0, L.x1) < dead.Wd - +b.ohR - 1e-9 : L.x > +b.ohL + 1e-9 && L.x < dead.Wd - +b.ohR - 1e-9));
    if (inBay.length) warn.push(`Loads between the exterior girders that the interior strip moments do not include (slab and wearing surface only): ${inBay.map(L => L.desc || L.id).join(', ')}. Check their effect on the deck separately.`);
    const out = { on: true, D, in: { ts, tL, wc, fc, fy, wDC, wDW, dwA, bf, bfAt, xneg, auto, eta, mLL, owner: lf.o || '', Wd: dead.Wd, ohL: +b.ohL, ohR: +b.ohR }, bays, gp, gn, oh, go, dist, checks, warn, steps };
    META.set(steps, out);
    return out;
  }

  /* topics(R): the topics of the worked steps (SharedSteps.group; ids with the leading 'dk.' stripped) */
  const A = '10th Ed. ';
  function topics(R) {
    const T = [];
    ((R && R.bays) || []).forEach((q, k) => T.push({ key: 'b' + (k + 1), title: `Interior bays, ${q.name}: moments per foot`, ref: A + 'Art. 4.6.2.1, 4.6.2.1.6, Table A4-1, Table 3.4.1-1', ids: new RegExp(`^b${k + 1}\\.`), res: /\.Mun$/ }));
    if (!T.length) T.push({ key: 'b', title: 'Interior bays: moments per foot', ref: A + 'Art. 4.6.2.1, Table A4-1', ids: /^b\d+\./ });
    T.push({ key: 'pos', title: 'DK1 Positive moment: bottom bars', ref: A + 'Art. 5.6.3.2, 5.5.4.2', ids: /^pos\./ },
      { key: 'neg', title: 'DK2 Negative moment: top bars', ref: A + 'Art. 5.6.3.2, 5.5.4.2', ids: /^neg\./ },
      { key: 'ohL', title: 'DK3 Left overhang (gravity loads)', ref: A + 'Art. 3.6.1.3.1, Table 4.6.2.1.3-1', ids: /^ohL\./ },
      { key: 'ohR', title: 'DK3 Right overhang (gravity loads)', ref: A + 'Art. 3.6.1.3.1, Table 4.6.2.1.3-1', ids: /^ohR\./ },
      { key: 'dist', title: 'Distribution reinforcement', ref: A + 'Art. 9.7.3.2', ids: /^dist/ });
    return T;
  }
  const metaOf = list => META.get(list) || null;
  window.SBDDeck = { DEF, BARS, inputs, isOn, barName, calc, sideLoads, topics, metaOf };
})();
