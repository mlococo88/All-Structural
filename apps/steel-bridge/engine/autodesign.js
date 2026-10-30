/* apps/steel-bridge/engine/autodesign.js — Auto design (window.SBDAutoDesign): sizes the girder plates, the flange transitions and the girder
   count against the same checks the output tabs run. Classic script, no DOM. Created 2026-10-30 (engineer-approved spec of 2026-10-29).
   Auto design replaces Preliminary sizing's Suggest (quick suggestion, Full design) and Alternatives, and ST-Girder's Optimize.

   Modes (settings.mode):
     'new'     New design: from the spans and the cross-section; chooses the girder count (settings.nbList; blank = the current count ± 1 within
               the spacing limits), the web depth, the web thickness of each field piece, the flange plates of each zone and the flange thickness
               transitions (a weight-and-transition search in each field piece, as Suggest's sizeFlanges); the field splices are the project's
               (framing.splices).
     'refine'  Refine current design: the current zones kept; each zone's thickness and each field piece's flange width trimmed up or down
               (replaces ST-Girder's Optimize, which swept the bottom flange thickness).
     'check'   Check one change: the current design with one change (settings.change: { nb, D }), its plates refined to suit, against the current design.
   Objective (settings.objective): 'weight' (lightest steel, all girders of the cross-section), 'depth' (shallowest web, weight as the
   tie-break), 'cost' (the editable cost model: $/lb of steel, $ per flange transition, $ per field splice, $ per intermediate stiffener; the
   prices per girder line × the girder count).

   Two stages:
     1. Screen: each trial layout is checked with the analysis of engine/analysis.js, except that the per-lane live-load envelopes (the moving-load
        run, about 5 to 8 s a girder) are reused from one run on the current stiffness (approximation only in the screen); the flexure (GS5–GS13),
        shear (GS11, GS16, GS18), constructibility (GS14–GS16, OH) and flange fatigue (GS17) checks at every station; the 6.10.2 proportion limits,
        the depth rule (2.5.2.6.3) and the plate rules (minimums, increments, transitions, splice bolt fit) are part of the sizing.
     2. Full check of the finalists, best first: the complete analysis (live load on each candidate's own stiffness) and every module as its
        output tab runs it: flexure (engine/flexure.js on this analysis, as the Fatigue tab's GS17), Shear & stiffeners (ui/shear.js build),
        Fatigue & studs (ui/fatigue.js build), Constructibility (engine/constructibility.js fromAnalysis), Cross-frames (ui/framing.js build) and
        Field splices (engine/splices.js girder, with its auto-design when the Splices tab has it on). A finalist that fails drops out and the next
        one takes its place, so every candidate returned passes every module (tests/engine/autodesign.test.mjs).

   Splice bolt fit (DT10): a flange at a field splice must fit the owner's edge distance with the gage lines of splices.bolts.minLines
   (CTDOT BRSDM V2 6.13.6.1: 2 in edges, 1/2 in plates). For every design both ways are tried when they differ: the flanges at the splices widened
   to fit two gage lines (the minLines of the project), or a single gage line each side of the web (splices.bolts.minLines = 1 on Apply);
   the objective picks.

   Units: ft (stations, lengths), in (plates), lb (weight), $ (cost). Everything here is a plain function of the project; run() is a generator
   (one step per trial) so the page can run it in chunks; runChunked() does that with setTimeout and a stop flag. */
(function () {
  'use strict';
  const St = () => window.SharedSteps, OW = () => window.SBDOwners, AN = () => window.SBDAnalysis, FX = () => window.SBDFlexure, FA = () => window.SBDFatigue,
    CN = () => window.SBDConstr, SP = () => window.SBDSplices, FRM = () => window.SBDFraming, MD = () => window.SBDModel, SEC = () => window.SBDSections;
  const ED = 'AASHTO LRFD 10th Ed.';
  const STEEL = 490 / 144;   // lb/ft of girder per in^2 of steel (0.490 kcf)
  const clone = o => JSON.parse(JSON.stringify(o));
  const up = (x, inc) => Math.ceil(x / inc - 1e-9) * inc, r4 = v => +(+v).toFixed(4);
  const OKST = ['pass', 'na', 'adv', 'warn'];

  /* ---------- settings (saved in the project as P.autodesign; absent = these defaults) ---------- */
  const DEF = {
    mode: 'new', objective: 'weight', topN: 8, matchLegacy: false,
    cost: { steel: 3.00, trans: 1500, splice: 6000, stiff: 150 },   // Preliminary sizing's price list (P.costs): $/lb, $ per transition, field splice, stiffener
    limits: { Dmin: '', Dmax: '', Dinc: '', twInc: 0.0625, tfInc: 0.125, bfInc: '', twMin: '', tfMin: '', bfMin: '', tfMax: 3.0, thkRatio: '', areaRatio: 0.5,
      maxTrans: 2, minSeg: 10, lbRatio: 85, topConst: true, maxDb: 4, depthRule: true, sLo: '', sHi: '' },
    nbList: '', change: { nb: '', D: '' }
  };
  /* settings(P): DEF merged with P.autodesign, then the owner's plate rules where a limit is blank (OWN14 'default' rows of engine/owners.js:
     limits.minTw, minTf, minBf, incD, incBf, thkRatio, sLo; Preliminary sizing's Limits tab defaults otherwise: t_w ≥ 1/2, t_f ≥ 3/4, b_f ≥ 12 in,
     D in 1 in, b_f in 1 in, thickness ratio 2.0 at a transition, spacing 6 to 12 ft). Returns { …, lim: the numbers used, cite: where each came from }. */
  function settings(P) {
    const a = (P && P.autodesign) || {}, s = { ...clone(DEF), ...clone(a) };
    s.cost = { ...DEF.cost, ...(a.cost || {}) }; s.limits = { ...DEF.limits, ...(a.limits || {}) }; s.change = { ...DEF.change, ...(a.change || {}) };
    const owner = ((P && P.ownerRules) || {}).owner || 'AASHTO', O = OW(), cite = {};
    const ownV = (id, dflt, k) => { const r = O ? O.rule(owner, id) : null; if (r && +r.value > 0) { cite[k] = O.cite(r); return +r.value; } cite[k] = 'Preliminary sizing default'; return dflt; };
    const L = s.limits, num = v => (v === '' || v == null || !isFinite(+v)) ? null : +v, pick = (k, id, d) => { const v = num(L[k]); if (v != null && v > 0) { cite[k] = 'entered'; return v; } return id ? ownV(id, d, k) : (cite[k] = 'default', d); };
    s.lim = { twMin: pick('twMin', 'def.minTw', 0.5), tfMin: pick('tfMin', 'def.minTf', 0.75), bfMin: pick('bfMin', 'def.minBf', 12), Dinc: pick('Dinc', 'def.incD', 1),
      bfInc: pick('bfInc', 'def.incBf', 1), thkRatio: pick('thkRatio', 'def.thk', 2), sLo: pick('sLo', 'def.sLo', 6), sHi: pick('sHi', null, 12),
      twInc: num(L.twInc) > 0 ? +L.twInc : 0.0625, tfInc: num(L.tfInc) > 0 ? +L.tfInc : 0.125, tfMax: num(L.tfMax) > 0 ? +L.tfMax : 3, areaRatio: num(L.areaRatio) >= 0 ? +L.areaRatio : 0.5,
      maxTrans: num(L.maxTrans) >= 0 ? Math.min(3, Math.round(+L.maxTrans)) : 2, minSeg: num(L.minSeg) > 0 ? +L.minSeg : 10, lbRatio: num(L.lbRatio) > 0 ? +L.lbRatio : 85,
      topConst: L.topConst !== false, maxDb: num(L.maxDb) >= 0 ? +L.maxDb : 4, depthRule: L.depthRule !== false, Dmin: num(L.Dmin), Dmax: num(L.Dmax) };
    // a flange transition must save at least the owner's minimum weight (OWN29: MassDOT 3.6.5.6 1300 lb, RIDOT 6.4 800 lb), else cost.trans / cost.steel
    const rW = O ? O.rule(owner, 'flange.weld') : null; s.lim.weldLb = Math.max(+s.cost.steel > 0 ? +s.cost.trans / +s.cost.steel : 0, rW ? +rW.value.lb : 0); if (rW) cite.weldLb = O.cite(rW);
    // MassDOT 3.6.5.6 (T5): no more than 3 flange sizes between bolted splices
    const rS = O ? O.rule(owner, 'flange.sizes') : null; if (rS) { s.lim.maxTrans = Math.min(s.lim.maxTrans, +rS.value - 1); cite.maxTrans = O.cite(rS); }
    s.owner = owner; s.cite = cite; s.topN = Math.max(1, Math.round(+s.topN || 8));
    if (!['new', 'refine', 'check'].includes(s.mode)) s.mode = 'new'; if (!['weight', 'depth', 'cost'].includes(s.objective)) s.objective = 'weight';
    return s;
  }

  /* ---------- layouts ---------- */
  /* A layout: { nb, D, spl: [ft] (field splices), web: [{ x0, x1, tw }] (one per field piece), top, bot: [{ x0, x1, b, t }] (flange zones; the width is
     constant in a field piece), minLines (splice gage lines; null = the project's) }. */
  const supsOf = P => { const s = [0]; P.spans.lengths.forEach(L => s.push(r4(s[s.length - 1] + +L))); return s; };
  const piecesOf = (spl, Lt) => { const e = [0, ...spl.filter(x => x > 1e-6 && x < Lt - 1e-6), Lt]; return e.slice(1).map((x, i) => ({ x0: e[i], x1: x })); };
  const at = (list, x) => list.find(r => x >= r.x0 - 1e-9 && x < r.x1 - 1e-9) || list[list.length - 1];
  function merge(list, keys) { const out = []; list.forEach(r => { const la = out[out.length - 1]; if (la && keys.every(k => la[k] === r[k]) && Math.abs(la.x1 - r.x0) < 1e-6) la.x1 = r.x1; else out.push({ ...r }); }); return out; }
  /* layoutOf(P): the current design of girder 1 as a layout (every plate girder of the project gets the same layout on Apply, as Suggest did) */
  function layoutOf(P) {
    const g = P.girders[0], S = g.segments, Lt = supsOf(P)[P.spans.lengths.length], spl = (((P.framing || {}).splices) || []).map(Number).filter(x => x > 0 && x < Lt).sort((a, b) => a - b);
    const D = Math.max(...S.map(s => +s.D)), segAt = x => S.find(s => x >= s.x0 - 1e-9 && x < s.x1 - 1e-9) || S[S.length - 1];
    const web = piecesOf(spl, Lt).map(p => ({ ...p, tw: Math.max(...S.filter(s => s.x1 > p.x0 + 1e-6 && s.x0 < p.x1 - 1e-6).map(s => +s.tw)) }));
    const fl = k => { const out = []; piecesOf(spl, Lt).forEach(p => { const cuts = [p.x0, ...S.map(s => s.x0).filter(x => x > p.x0 + 1e-6 && x < p.x1 - 1e-6), p.x1];
      cuts.slice(1).forEach((x, i) => { const s = segAt((cuts[i] + x) / 2); out.push({ x0: cuts[i], x1: x, b: +s[k + 'B'], t: +s[k + 'T'] }); }); }); return merge(out, ['b', 't']); };
    return { nb: (P.xs || {}).nb || 0, D, spl, web, top: fl('top'), bot: fl('bot'), minLines: null };
  }
  /* segmentsOf(L): the sbd2 plate segments of a layout (every breakpoint of the web pieces and both flanges) */
  function segmentsOf(L) {
    const xs = [...new Set([...L.web, ...L.top, ...L.bot].flatMap(r => [r4(r.x0), r4(r.x1)]))].sort((a, b) => a - b), out = [];
    xs.slice(1).forEach((x, i) => { const m = (xs[i] + x) / 2, w = at(L.web, m), t = at(L.top, m), b = at(L.bot, m); if (x - xs[i] < 1e-6) return;
      out.push({ x0: xs[i], x1: x, D: L.D, tw: w.tw, topB: t.b, topT: t.t, botB: b.b, botT: b.t }); });
    return merge(out, ['D', 'tw', 'topB', 'topT', 'botB', 'botT']);
  }
  /* projectWith(P, L): a copy of the project with layout L on every plate girder; a new girder count spaces the girders equally over the same
     out-to-out girder width (Σ bays) and gives each plate girder the tributary b_eff of AASHTO LRFD 10th Ed. 4.6.2.6.1 (interior: the spacing;
     exterior: half the spacing plus the overhang); the field splices; the splice gage lines when the layout sets them. */
  function projectWith(P, L) {
    const Q = clone(P), xs = Q.xs;
    if (xs && L.nb && L.nb !== xs.nb) {
      const W = (xs.bays || []).reduce((a, v) => a + +v, 0), S = W / (L.nb - 1);
      xs.nb = L.nb; xs.bays = new Array(L.nb - 1).fill(r4(S)); xs.beamClass = {};
      Q.girders.forEach(g => { const ext = g.position === 'exterior'; g.beff = r4(12 * (ext ? S / 2 + (+xs.ohL >= +xs.ohR ? +xs.ohL : +xs.ohR) : S)); if (g.line != null && g.line >= L.nb) g.line = L.nb - 1; });
    }
    const segs = segmentsOf(L); Q.girders.forEach(g => { g.segments = clone(segs); });
    Q.framing = Q.framing || MD().defaultFraming(); Q.framing.splices = L.spl.slice();
    if (L.minLines != null) { Q.splices = Q.splices || MD().defaultSplices(); Q.splices.bolts = { ...(Q.splices.bolts || {}), minLines: L.minLines }; }
    return Q;
  }
  /* weight and cost (per girder line × the girder count) */
  const lineWeight = L => segmentsOf(L).reduce((a, s) => a + (s.topB * s.topT + s.botB * s.botT + s.D * s.tw) * STEEL * (s.x1 - s.x0), 0);
  const transitions = L => ['top', 'bot'].reduce((a, k) => a + L[k].slice(1).filter((r, i) => !L.spl.some(x => Math.abs(x - r.x0) < 1e-6) && (r.t !== L[k][i].t || r.b !== L[k][i].b)).length, 0);
  function costOf(L, S, nStiff) {
    const C = S.cost, w = lineWeight(L) * L.nb, nt = transitions(L), ns = L.spl.length;
    return { w, wLine: w / L.nb, nTr: nt, nSpl: ns, nStiff: nStiff || 0, total: +C.steel * w + L.nb * (+C.trans * nt + +C.splice * ns + +C.stiff * (nStiff || 0)) };
  }
  /* the steps of a candidate's weight, cost and plate rules (shown on the Auto design tab; CLAUDE.md §6) */
  function candSteps(L, S, c, extra) {
    const w = St().work('ad'), n = St().n, g = St().g, segs = segmentsOf(L);
    const wl = w.add({ id: 'wLine', label: 'Steel weight of one girder line (plates: flanges and web)', sym: 'W_{line}', eq: '\\sum (b_{t}t_{t} + b_{b}t_{b} + Dt_{w})(3.403)L_{seg}', sub: segs.map(s => `(${n(s.topB * s.topT + s.botB * s.botT + s.D * s.tw, 2)})(3.403)(${n(s.x1 - s.x0, 2)})`).join(' + '),
      value: c.wLine, unit: 'lb', d: 0, note: '3.403 lb/ft per in² of steel (0.490 kcf); stiffeners, cross-frames and splice plates are not in W.' });
    w.add({ id: 'w', label: 'Steel weight, all girders of the cross-section', sym: 'W', eq: 'N_{b}W_{line}', sub: `${L.nb}(${g(wl, 0)})`, value: c.w, unit: 'lb', d: 0 });
    w.add({ id: 'cost', label: 'Cost (the price list of the Auto design tab)', sym: 'C', eq: 'c_{s}W + N_{b}(c_{tr}n_{tr} + c_{sp}n_{sp} + c_{st}n_{st})', sub: `${n(+S.cost.steel, 2)}(${g(c.w, 0)}) + ${L.nb}(${g(+S.cost.trans, 0)}(${c.nTr}) + ${g(+S.cost.splice, 0)}(${c.nSpl}) + ${g(+S.cost.stiff, 0)}(${c.nStiff}))`,
      value: c.total, unit: '\\$', d: 0, note: 'n_tr: flange thickness or width changes per girder away from the field splices; n_st: intermediate transverse stiffeners per girder (the Stiffeners tab layout).' });
    (extra || []).forEach(s => w.steps.push(s));
    return w.steps;
  }

  /* ---------- 6.10.2 proportion limits and the depth rule (sizing rules, also reported) ---------- */
  function proportions(L, P, S) {
    const w = St().work('ad.prop'), n = St().n, out = []; const segs = segmentsOf(L), Ls = Math.max(...P.spans.lengths.map(Number)), cont = P.spans.continuity !== 'simple' && P.spans.lengths.length > 1;
    const add = (id, label, sym, eq, sub, dem, cap, ref) => { const ok = dem <= cap + 1e-9; w.add({ id, label, sym, eq, sub, value: dem / cap, unit: '', d: 3, ref, ok }); out.push({ id, ok, r: dem / cap, step: 'ad.prop.' + id }); };
    segs.forEach((s, i) => { const k = i + 1, Iyc = s.topT * s.topB ** 3 / 12, Iyt = s.botT * s.botB ** 3 / 12;
      add(`w${k}`, `Segment ${k}: web slenderness`, '\\frac{D}{t_{w}}', '\\le 150', `\\frac{${n(s.D, 2)}}{${n(s.tw, 4)}} = ${n(s.D / s.tw, 1)} \\le 150`, s.D / s.tw, 150, `${ED} Eq. 6.10.2.1.1-1`);
      ['top', 'bot'].forEach(f => { const b = s[f + 'B'], t = s[f + 'T'], nm = f === 'top' ? 'top' : 'bottom';
        add(`b${f[0]}${k}`, `Segment ${k}: ${nm} flange slenderness`, '\\frac{b_{f}}{2t_{f}}', '\\le 12.0', `\\frac{${n(b, 2)}}{2(${n(t, 4)})} = ${n(b / 2 / t, 2)} \\le 12.0`, b / 2 / t, 12, `${ED} Eq. 6.10.2.2-1`);
        add(`d${f[0]}${k}`, `Segment ${k}: ${nm} flange width`, '\\frac{D}{6}', '\\le b_{f}', `\\frac{${n(s.D, 2)}}{6} = ${n(s.D / 6, 2)} \\le ${n(b, 2)}`, s.D / 6, b, `${ED} Eq. 6.10.2.2-2`);
        add(`t${f[0]}${k}`, `Segment ${k}: ${nm} flange thickness`, '1.1t_{w}', '\\le t_{f}', `1.1(${n(s.tw, 4)}) = ${n(1.1 * s.tw, 3)} \\le ${n(t, 4)}`, 1.1 * s.tw, t, `${ED} Eq. 6.10.2.2-3`); });
      add(`i${k}`, `Segment ${k}: flange proportions`, '0.1 \\le \\frac{I_{yc}}{I_{yt}}', '\\le 10', `\\frac{I_{yc}}{I_{yt}} = \\frac{${n(Iyc, 1)}}{${n(Iyt, 1)}} = ${n(Iyc / Iyt, 3)}`, Math.max(0.1 / (Iyc / Iyt), (Iyc / Iyt) / 10), 1, `${ED} Eq. 6.10.2.2-4`); });
    if (S.lim.depthRule) { const tf = Math.min(...segs.map(s => s.topT + s.botT)), dg = L.D + tf, k = cont ? 0.027 : 0.033, need = k * Ls * 12;
      add('depth', 'Minimum depth of the steel I-beam portion (optional criterion, applied as Preliminary sizing does)', 'd_{min}', `${k}L`, `${k}(${n(Ls, 1)})(12) = ${n(need, 2)} \\le D + t_{ft} + t_{fb} = ${n(dg, 2)}`, need, dg, `${ED} Table 2.5.2.6.3-1`); }
    return { ok: out.every(q => q.ok), items: out, steps: w.steps };
  }

  /* ---------- splice bolt fit: the flange width for nl gage lines each side of the web (engine/splices.js autoDesign needB, DT10) ---------- */
  function boltFitWidth(P, tw, nl) {
    const Sp = SP(); if (!Sp) return 0; const s = Sp.settings(P), O = OW(), owner = ((P.ownerRules || {}).owner) || 'AASHTO', rOv = O ? O.rule(owner, 'spl.ovs') : null;
    const bt = Sp.BOLT[s.bolts.d] || Sp.BOLT['0.875'], d = bt.d, u4 = v => Math.ceil(v * 4 - 1e-6) / 4, em = Math.max(bt.emin[s.bolts.edge === 'sh' ? 'sh' : 'cut'], rOv ? +rOv.value.edge : 0);
    const C1 = parseFloat(s.bolts.c1) > 0 ? parseFloat(s.bolts.c1) : ({ '0.75': 1.25, '0.875': 1.5, '1': 1.625, '1.125': 1.75 }[s.bolts.d] || 1.5), cw = +s.clr.cw || 0.5, g = u4(Math.max(3, 3 * d));
    const ownerMin = rOv ? +rOv.value.tp : 0, Sx = window.SBDSplicesUI && window.SBDSplicesUI.envOf ? window.SBDSplicesUI.envOf(P).minPlate : 0.375, twp = Math.max(0.5, ownerMin, Sx);   // web splice plate: 1/2 in or the owner minimum (Preliminary sizing spTwp)
    const g0 = u4(Math.max(tw / 2 + twp + cw + em, tw / 2 + twp + C1));
    return Math.ceil(2 * (g0 + (nl - 1) * g + em) * 4 - 1e-6) / 4;
  }
  const minLinesOf = P => { const Sp = SP(); return Sp ? Math.max(1, Math.round(parseFloat(Sp.settings(P).bolts.minLines) || 1)) : 1; };

  /* ---------- the hand-off-shaped payload of a girder's analysis (ui/fatigue.js fromAnalysis, copied; the analysis is passed in) ---------- */
  /* Kept operation for operation the same as ui/fatigue.js fromAnalysis (tests/engine/autodesign.test.mjs compares the Fatigue & studs results
     built from both), so the flexure, shear, fatigue and stud checks of a candidate are the ones the tabs show. */
  function payloadOf(P, gi, R) {
    const FA_ = FA(), FX_ = FX(), Q = P.studs || MD().defaultStuds(), M = MD();
    const g = P.girders[gi], xs = R.x, st = R.st, f = R.fat, ll = R.ll, A = (o, i) => (o ? o.M[i] : 0);
    const stations = xs.map((x, i) => ({ x, M_DC1: st.DC1.M[i], M_DC2: st.DC2.M[i], M_DW: st.DW.M[i], M_LLpos: ll.Mpos[i], M_LLneg: ll.Mneg[i], M_UT: A(st.UT, i), M_UF: A(st.UF, i),
      M_FATpos: f.Mpos[i], M_FATneg: f.Mneg[i], V_DC1: Math.abs(st.DC1.VR[i]), V_DC2: Math.abs(st.DC2.VR[i]), V_DW: Math.abs(st.DW.VR[i]),
      V_FATpos: Math.max(f.VRpos[i], f.VLpos[i]), V_FATneg: Math.min(f.VRneg[i], f.VLneg[i]) }));
    const zones = g.segments.map(s => ({ startX: s.x0, endX: s.x1, web: { depth: s.D, thickness: s.tw }, topFlange: { width: s.topB, thickness: s.topT }, botFlange: { width: s.botB, thickness: s.botT } }));
    const m = P.materials, d = P.deck, h0 = R.h0, ext = P.girders.find(q => q.position === 'exterior'), beffB = (ext || g).beff;
    const pl = { _schema: 'sbd2-analysis', stations, member: { supports: R.sup.slice(), spans: R.spans.slice() }, section: { zones },
      ownerRules: { owner: (P.ownerRules || {}).owner || 'AASHTO', haunchInProperties: !h0 },
      girderDetail: { label: g.label || g.id, girder: gi + 1, position: g.position, materials: { Fyf: M.GRADES[m.steel.top].Fy, Fyw: M.GRADES[m.steel.web].Fy, fc: m.concrete.fc, wc: m.concrete.wc, gradeFlange: m.steel.top, gradeWeb: m.steel.web },
        deck: { ts: d.ts, haunch: d.haunch, beff: g.beff, Ar: (d.rebar.top.A || 0) + (d.rebar.bot.A || 0) }, bracing: { Lb: (P.stiffeners && P.stiffeners.layout.frames.Lb) || 25 },
        skew: { bySupport: ((P.xs || {}).skews || []).slice(), max: Math.max(0, ...((P.xs || {}).skews || []).map(Math.abs)) }, details: {} } };
    const dd = +Q.d, Zr = 7.0 * Math.PI * dd * dd / 4, segAt = x => g.segments.find(s => x >= s.x0 - 1e-9 && x < s.x1) || g.segments[g.segments.length - 1];
    const n = SEC().modularRatio(m.concrete.fc, m.concrete.wc, m.concrete.K1, m.concrete.nRule).n, r1 = v => +(+v).toFixed(1), r2 = v => +(+v).toFixed(2);
    const vRng = (a, b) => Math.max(0, ...stations.filter(s => s.x >= a - 1e-9 && s.x <= b + 1e-9).map(s => s.V_FATpos - s.V_FATneg));
    const zs = [], qz = [];
    R.spans.forEach((L, k) => { const x0 = R.sup[k]; for (let z = 0; z < 10; z++) { const a = x0 + z * L / 10, b = a + L / 10, s = segAt((a + b) / 2), S = FA_.secSet(s.D, s, { ts: d.ts, hh: h0 ? 0 : d.haunch, beff: beffB, n, Ar: 0, dr: 0 }), c = S.cn, Qs = beffB * d.ts / n * (S.ySlab - c.yb);
      const nr = Math.max(2, Math.min(4, Math.floor((s.topB - 2 - dd) / 4) + 1)), vr = r1(vRng(a, b)), preq = vr > 0 ? nr * Zr / (1.75 * vr * Qs / c.I) : 48, p = Math.max(6 * dd, Math.min(24, Math.floor(preq * 2) / 2));
      zs.push({ x1: r2(a), x2: r2(b), nr, p }); qz.push({ name: `Span ${k + 1}, ${z / 10}L to ${(z + 1) / 10}L`, Vfr: vr }); } });
    const G = FX_.factors(), Mup = stations.map(s => FX_.envelopeStrI({ DC1: s.M_DC1, DC2: s.M_DC2, DW: s.M_DW, LLp: s.M_LLpos, LLn: s.M_LLneg, UT: s.M_UT, UF: s.M_UF }, G).max), ns = R.spans.length, supN = k => k === 0 ? 'Abut. 1' : k === ns ? 'Abut. 2' : `Pier ${k}`;
    const regions = []; R.spans.forEach((L, k) => { const x0 = R.sup[k]; let xm = x0 + L / 2, mx = -Infinity; stations.forEach((s, i) => { if (s.x > x0 && s.x < x0 + L && Mup[i] > mx) { mx = Mup[i]; xm = s.x; } });
      [[x0, k], [x0 + L, k + 1]].forEach(([xs0, ks]) => regions.push({ name: `${supN(ks)} to max. positive, Span ${k + 1}`, kind: ks > 0 && ks < ns && R.cont ? 'pier' : 'end', x1: r2(Math.min(xs0, xm)), x2: r2(Math.max(xs0, xm)) })); });
    pl.girderDetail.details.studs = { d: dd, h: Q.h, Fu: Q.Fu, transverseSpacing: Q.st, zones: zs, results: { zones: qz, regions, gaps: [], beff: beffB, gamI: Q.gamFat, QnEntered: false } };
    pl.girderDetail.details.fatigue = { ADTT: P.fatigue.ADTT, p: P.fatigue.p, life: P.fatigue.life, limit: P.fatigue.limit };
    return pl;
  }

  /* ---------- the live-load runs: exact (memoized by input) or the screen's reference (one run per vehicle, any stiffness) ---------- */
  function liveLoad(cache, approx) {
    const ML0 = window.SharedMovingLoad, key = m => JSON.stringify(m);
    return { ...ML0,
      analyze: (m, o) => { const k = approx ? 'ref|' + m.short + '|' + JSON.stringify([m.spans, m.scanKeys.length]) : key(m); if (!cache.has(k)) cache.set(k, ML0.analyze(m, o)); return cache.get(k); },
      deflection: (R, o) => { const k = 'defl|' + (approx ? 'ref' : '') + JSON.stringify(o); if (approx) { if (!cache.has(k)) cache.set(k, ML0.deflection(R, o)); return cache.get(k); } return ML0.deflection(R, o); } };
  }
  function withLL(ctx, approx, fn) {
    const ML0 = window.SharedMovingLoad; if (!ctx.ll) ctx.ll = new Map(); window.SharedMovingLoad = liveLoad(ctx.ll, approx);
    try { return fn(); } finally { window.SharedMovingLoad = ML0; }
  }

  /* ---------- evaluation of a project: the checks of every module, with the ratios mapped to the plate that controls them ---------- */
  /* part of a flexure / constructibility check: 'top', 'bot', 'web' (by its title, as the tabs word them; compression / tension by the region) */
  function partOf(c, pos, comp) {
    const t = String(c.title || ''), k = String(c.key || '');
    if (/web|shear/i.test(t) || k === 'web' || k === 'shear' || k === 'v' || k === 'vf' || k === 'vc') return 'web';
    if (/top flange/i.test(t) || k === 'svt') return 'top'; if (/bottom flange/i.test(t) || k === 'svb') return 'bot';
    const cf = comp || (pos ? 'top' : 'bot'), tf = cf === 'top' ? 'bot' : 'top';
    if (/compression|_\{?nc\}?|a6c|fnc|ncC/i.test(k + ' ' + t)) return cf; if (/tension|a6t|fnt|ncT/i.test(k + ' ' + t)) return tf;
    if (k === 'mn' || k === 'fl') return 'bot'; if (k === 'duct') return 'top';
    return cf;
  }
  /* evaluate(P, opt): opt = { level: 'screen' | 'full', ctx (caches) }. Returns { pass, ratio, gov: { mod, id, title, r, x, g, step, tab },
     hits: [{ x, part, r, g }] (the plate-driving ratios at each station), fails: [ … ], warns, nStiff, mods: { … } (full: each module's result) } */
  function evaluate(P, opt) {
    opt = opt || {}; const full = opt.level === 'full', ctx = opt.ctx || {}, hits = [], fails = [], warns = [], mods = {}; let gov = null, nStiff = 0;
    const take = (o) => { if (!isFinite(o.r)) return; if (!gov || o.r > gov.r) gov = o; if (o.fail || o.r > 1 + 1e-9) fails.push(o); };
    const v = MD().validate(P); if (v.errors.length) return { pass: false, ratio: Infinity, gov: { mod: 'model', id: 'input', title: v.errors[0].msg, r: Infinity }, hits, fails: [{ mod: 'model', title: v.errors[0].msg }], warns, nStiff, mods };
    const own = P.ownerRules || { owner: 'AASHTO', eta: {} };
    for (let gi = 0; gi < P.girders.length; gi++) {
      const gl = P.girders[gi].label || P.girders[gi].id, gm = { g: gi, gl };
      const R = withLL(ctx, !full, () => AN().analyzeGirder(P, gi));
      if (R.errors && R.errors.length) { const o = { ...gm, mod: 'analysis', id: 'analysis', title: R.errors.join(' '), r: Infinity, fail: true }; take(o); continue; }
      const pl = payloadOf(P, gi, R), Fr = FRM() && P.framing ? FRM().forGirder(P, { gi }, null) : null;
      // flexure (GS5–GS13) at every station, on this analysis (the Fatigue tab's GS17 path, the project's deck and materials)
      const d = FX().fromPayload(pl, { owner: own.owner, rebar: P.deck.rebar, ...(Fr ? { braces: Fr.braces, lenOf: Fr.lenOf } : {}) }), m = P.materials, G = MD().GRADES;
      const nr = SEC().modularRatio(m.concrete.fc, m.concrete.wcE > 0 ? m.concrete.wcE : m.concrete.wc, m.concrete.K1, m.concrete.nRule);
      Object.assign(d.prj, { n: nr.n, mat: { Fyt: G[m.steel.top].Fy, Fyb: G[m.steel.bot].Fy, Fyw: G[m.steel.web].Fy, Fyr: m.rebar.Fyr, fc: m.concrete.fc }, rebarInPositive: !!P.deck.rebarInPositiveMp });
      d.prj.deck.tdeck = P.deck.tdeck; if (P.deck.composite === false) d.prj.deck.composite = false;
      const flS = FRM() ? FRM().flSkew(((P.xs || {}).skews) || [0], P.girders[gi].position === 'exterior', P.framing) : { fl: 0 }; d.locs.forEach(L => { L.fl = flS.fl || 0; });
      const Gr = FX().girder(d.locs, d.prj, { supports: d.supports }); mods['flex' + gi] = Gr;
      Gr.rows.forEach(r => r.checks.forEach(c => { if (!c.inUse || !isFinite(c.ratio)) return; const o = { ...gm, mod: 'flexure', tab: 'flex', id: c.id, title: c.title, r: c.ratio, x: r.x, step: c.step, part: partOf(c, r.pos) }; hits.push(o); take(o); }));
      // flange fatigue GS17 (engine/fatigue.js flange on each flexure row, as the Fatigue & studs tab)
      const FS = FA().settings(P.fatigue || MD().defaultFatigue()), sup = R.sup, B = FA().supports({ ok: true, spans: R.spans, cont: R.cont });
      Gr.rows.forEach(r => { const q = FA().flange(r, { set: FS, B, catT: (P.fatigue || {}).catT || 'B', catB: (P.fatigue || {}).catB || 'B' });
        q.items.forEach((it, k) => { const o = { ...gm, mod: 'fatigue', tab: 'fat', id: 'GS17', title: `Flange stress range, ${k ? 'bottom' : 'top'}`, r: it.r, x: r.x, step: it.step, part: k ? 'bot' : 'top' }; hits.push(o); take(o); }); });
      // shear and stiffeners (ui/shear.js build on this analysis)
      const SB = window.SBDShearUI.build({ P, g: gi, pl }); mods['shear' + gi] = SB;
      SB.stations.forEach(r => r.checks.forEach(c => { if (!c.inUse || !isFinite(c.ratio)) return; const o = { ...gm, mod: 'shear', tab: 'shear', id: c.id, title: c.title, r: c.ratio, x: r.x, step: c.step, part: 'web' }; hits.push(o); take(o); }));
      nStiff += (SB.bays || []).reduce((a, b) => a + (+b.n || 0), 0) / P.girders.length;
      // constructibility (deck placement GS14–GS16, overhang brackets OH1–OH5)
      const Cn = CN(), F = Cn.fromAnalysis(P, gi, R, { flC: 0, oh: { ...Cn.OH_DEF, ...((P.constr && P.constr.oh) || {}) }, ...(Fr ? { braces: Fr.braces } : {}) }), CR = Cn.girder(F.locs, F.prj, { supports: F.supports, oh: F.oh }); mods['constr' + gi] = CR;
      CR.rows.forEach(r => r.checks.forEach(c => { if (!isFinite(c.ratio)) return; const o = { ...gm, mod: 'constructibility', tab: 'cn', id: c.id, title: c.title, r: c.ratio, x: r.x, step: c.step, part: c.id === 'GS16' ? 'web' : partOf(c, true, r.conC && r.conC.lab === 'top' ? 'top' : 'bot') }; hits.push(o); take(o); }));
      if (CR.oh && !CR.oh.errors.length) CR.oh.rows.forEach(r => r.checks.forEach(c => { if (!isFinite(c.ratio)) return; const o = { ...gm, mod: 'constructibility', tab: 'cn', id: c.id, title: c.title, r: c.ratio, x: r.x, step: c.step, part: c.id === 'OH5' ? 'top' : 'web' }; hits.push(o); take(o); }));
      // fatigue details FA1–FA7 and studs (ui/fatigue.js build on this analysis); the load-induced detail stress ranges (FA1) depend on the plates,
      // so they are in the screen too: each item to the flange it names (a detail at the web: the bottom flange in positive and the top flange in
      // negative flexure sets its stress, taken as the flange nearer the detail as worded), at the station in its location text
      const FB = window.SBDFatigueUI.build({ P, g: gi, pl }); mods['fat' + gi] = FB;
      if (!full && !FB.err) { const rowOf = loc => ((FB.FR && FB.FR.rows) || []).find(r => String(loc || '').startsWith(r.name));
        (FB.FC || []).filter(c => c.id === 'FA1').forEach(c => c.items.forEach(it => { if (!isFinite(it.r)) return; const rw = rowOf(it.loc), mx = /(\d+(?:\.\d+)?) ft/.exec(String(it.loc || ''));
          const x = rw && isFinite(+rw.x) ? +rw.x : mx ? +mx[1] : null, top = rw ? /^t/.test(String(rw.loc)) : /top/i.test(String(it.loc));
          const o = { ...gm, mod: 'fatigue', tab: 'fat', id: c.id, title: `${c.title} — ${it.loc}`, r: it.r, x, step: it.step, part: top ? 'top' : 'bot', fail: !OKST.includes(it.st) }; hits.push(o); take(o); })); }
      if (!full) continue;
      // the rest of the shear tab: transverse and bearing stiffeners
      const lists = (C, mod, tab) => (C || []).forEach(c => c.items.forEach(it => { const bad = !OKST.includes(it.st); if (it.st === 'warn') warns.push({ ...gm, mod, id: c.id, title: c.title, loc: it.loc });
        const o = { ...gm, mod, tab, id: c.id, title: `${c.title}${it.loc ? ' — ' + it.loc : ''}`, r: it.r != null && isFinite(it.r) ? it.r : bad ? Infinity : NaN, step: it.step, fail: bad }; if (bad && !isFinite(o.r)) o.r = Infinity; take(o); }));
      lists(SB.tsC, 'stiffeners', 'shear'); lists(SB.bsC, 'stiffeners', 'shear');
      // fatigue details and studs (ui/fatigue.js build on this analysis)
      if (FB.err) take({ ...gm, mod: 'fatigue', id: 'input', title: FB.err, r: Infinity, fail: true });
      else { lists(FB.FC, 'fatigue', 'fat'); lists(FB.SCC, 'studs', 'fat'); }
      // cross-frames (ui/framing.js build)
      const XB = window.SBDFramingUI.build({ P, g: gi }); mods['cf' + gi] = XB;
      if (XB.err) take({ ...gm, mod: 'cross-frames', id: 'input', title: XB.err, r: Infinity, fail: true }); else lists(XB.C, 'cross-frames', 'cf');
      // field splices (engine/splices.js girder: the Field splices tab; its auto-design when on)
      if (((P.framing || {}).splices || []).length) { const env = window.SBDSplicesUI.envOf(P), SG = SP().girder(P, gi, R, { env }); mods['spl' + gi] = SG;
        SG.errors.forEach(e => take({ ...gm, mod: 'splices', id: 'input', title: e, r: Infinity, fail: true }));
        SG.list.forEach(s => { if (!s.CK) { take({ ...gm, mod: 'splices', tab: 'spl', id: 'input', title: `${s.name}: ${s.R.errors.join(' ')}`, r: Infinity, fail: true }); return; } lists(s.CK, 'splices', 'spl'); }); }
      // live load deflection (optional, 2.5.2.6.2) only when the analysis settings ask for it: reported, not a pass/fail here
      if (R.lld) R.lld.forEach(q => { if (!q.ok) warns.push({ ...gm, mod: 'analysis', id: 'LLD', title: `Live load deflection, span ${q.k + 1}: ${q.d.toFixed(3)} in > L/${q.ratio}` }); });
    }
    return { pass: !fails.length, ratio: gov ? gov.r : 0, gov, hits, fails, warns, nStiff: Math.round(nStiff), mods };
  }

  /* ---------- flange sizing (Preliminary sizing sizeFlanges, on required areas at the analysis stations) ---------- */
  /* req: { xs, top: [in^2], bot: [in^2] }; tw per field piece; bFix: optional widths per field piece { top, bot } (refine); zones (refine): keep the cut points.
     Width per field piece: max(b_min, D/6, L_piece/85 × 12, √(12 A_max) (b/t = 12), A_max/t_max), on the increment; top flange constant (option);
     at a splice: the bolt-fit width (DT10) unless one gage line; width change at a field splice ≤ maxDb. Thickness per zone: max(t_min, 1.1t_w,
     b/24, A/b) on the increment; transitions (≤ maxTrans per piece and flange, zones ≥ minSeg, thinner ≥ thicker / thkRatio, area ratio ≥ areaRatio)
     chosen for the least weight plus weldLb per transition (Suggest's rule). */
  function sizeFlanges(D, web, spl, Lt, req, S, opt) {
    const lim = S.lim, pcs = piecesOf(spl, Lt), xs = req.xs, out = { top: [], bot: [] };
    const idxOf = p => xs.map((x, i) => i).filter(i => xs[i] >= p.x0 - 1e-6 && xs[i] <= p.x1 + 1e-6);
    const BW = { top: [], bot: [] };
    pcs.forEach((p, k) => ['top', 'bot'].forEach(f => { const A = Math.max(0, ...idxOf(p).map(i => req[f][i])), len = p.x1 - p.x0;
      let b = opt && opt.bFix ? opt.bFix[f][k] : up(Math.max(lim.bfMin, D / 6, len * 12 / lim.lbRatio, Math.sqrt(12 * A)), lim.bfInc);
      while (A / b > lim.tfMax + 1e-9 && b < 42) b += lim.bfInc; BW[f].push(b); }));
    if (spl.length && opt && opt.bSpl) ['top', 'bot'].forEach(f => BW[f].forEach((b, k) => { const nearSpl = spl.some(x => Math.abs(x - pcs[k].x0) < 1e-6 || Math.abs(x - pcs[k].x1) < 1e-6); if (nearSpl && b < up(opt.bSpl, lim.bfInc) - 1e-9) { BW[f][k] = up(opt.bSpl, lim.bfInc); out.boltRaised = true; } }));
    if (lim.topConst) { const bm = Math.max(...BW.top); BW.top = BW.top.map(() => bm); }
    if (lim.maxDb > 0) ['top', 'bot'].forEach(f => { for (let it = 0; it < 50; it++) { let ch = false; for (let k = 0; k < pcs.length - 1; k++) { const a = BW[f][k], b = BW[f][k + 1];
      if (a - b > lim.maxDb + 1e-9) { BW[f][k + 1] = up(a - lim.maxDb, lim.bfInc); ch = true; } else if (b - a > lim.maxDb + 1e-9) { BW[f][k] = up(b - lim.maxDb, lim.bfInc); ch = true; } } if (!ch) break; } });
    pcs.forEach((p, k) => ['top', 'bot'].forEach(f => {
      const bf = BW[f][k], tw = web[k].tw, tmin = up(Math.max(lim.tfMin, 1.1 * tw, bf / 24), lim.tfInc), idx = idxOf(p), treq = i => Math.max(tmin, up(req[f][i] / bf, lim.tfInc));
      if (opt && opt.zones) {   // refine: the current cut points
        const Z = opt.zones[f].filter(z => z.x1 > p.x0 + 1e-6 && z.x0 < p.x1 - 1e-6);
        let ts = Z.map(z => Math.max(tmin, ...idx.filter(i => xs[i] >= z.x0 - 1e-6 && xs[i] <= z.x1 + 1e-6).map(treq)));
        for (let it = 0; it < 20; it++) { let ch = false; for (let j = 1; j < ts.length; j++) { const hi = Math.max(ts[j], ts[j - 1]), lo = Math.min(ts[j], ts[j - 1]); if (hi / lo > lim.thkRatio + 1e-9) { const q = ts[j] < ts[j - 1] ? j : j - 1; ts[q] = up(hi / lim.thkRatio, lim.tfInc); ch = true; } } if (!ch) break; }
        Z.forEach((z, j) => out[f].push({ x0: Math.max(z.x0, p.x0), x1: Math.min(z.x1, p.x1), b: bf, t: ts[j] })); return; }
      const pts = [p.x0]; for (let c = Math.ceil(p.x0 + lim.minSeg - 1e-9); c <= p.x1 - lim.minSeg + 1e-9; c++) pts.push(c); pts.push(p.x1);
      const np = pts.length, cell = []; for (let a = 0; a < np - 1; a++) { let mx = tmin; idx.forEach(i => { if (xs[i] >= pts[a] - 1e-6 && xs[i] <= pts[a + 1] + 1e-6) mx = Math.max(mx, treq(i)); }); cell.push(mx); }
      const rmq = []; for (let a = 0; a < np - 1; a++) { const row = new Float64Array(np); let mx = 0; for (let b = a + 1; b < np; b++) { mx = Math.max(mx, cell[b - 1]); row[b] = mx; } rmq.push(row); }
      const segW = (a, b) => bf * rmq[a][b] * STEEL * (pts[b] - pts[a]);
      let best = { cuts: [], t: [rmq[0][np - 1]], cost: segW(0, np - 1) };
      const maxCuts = lim.maxTrans;
      const rec = (cuts, last) => {
        if (cuts.length) { const bn = [0, ...cuts, np - 1]; let w = 0, ok = true; const ts = [];
          for (let s = 0; s < bn.length - 1; s++) { const t = rmq[bn[s]][bn[s + 1]]; ts.push(t); w += segW(bn[s], bn[s + 1]); }
          for (let s = 1; s < ts.length && ok; s++) { const hi = Math.max(ts[s], ts[s - 1]), lo = Math.min(ts[s], ts[s - 1]); if (hi === lo || hi / lo > lim.thkRatio + 1e-9 || lo / hi < lim.areaRatio - 1e-9) ok = false; }
          if (ok) { const c = w + lim.weldLb * cuts.length; if (c < best.cost - 1e-6) best = { cuts: [...cuts], t: ts, cost: c }; } }
        if (cuts.length >= maxCuts) return;
        for (let c = last + 1; c < np - 1; c++) { if (pts[c] - pts[last] < lim.minSeg - 1e-9) continue; if (pts[np - 1] - pts[c] < lim.minSeg - 1e-9) break; cuts.push(c); rec(cuts, c); cuts.pop(); }
      };
      if (p.x1 - p.x0 >= 2 * lim.minSeg && maxCuts > 0 && np <= 400) rec([], 0);
      const bn = [0, ...best.cuts, np - 1]; for (let s = 0; s < bn.length - 1; s++) out[f].push({ x0: pts[bn[s]], x1: pts[bn[s + 1]], b: bf, t: best.t[s] });
    }));
    return { top: merge(out.top, ['b', 't']), bot: merge(out.bot, ['b', 't']), boltRaised: !!out.boltRaised };
  }
  /* required areas at the stations from the current layout and the station ratios: A' = A f(r), f = min(1.02r, 1.35) above 1, max(r / 0.97, 0.8)
     below (Preliminary sizing's Full design update); no plate-driving check at a station: 0 (the minimums govern) */
  /* the points are the check locations themselves (both sides of a plate change are 0.01 ft apart, so each side's ratio stays with its own zone) */
  function reqFrom(L, hits) {
    const pts = new Map();
    hits.forEach(h => { if ((h.part !== 'top' && h.part !== 'bot') || h.x == null || !isFinite(h.r)) return; const k = r4(h.x), o = pts.get(k) || { x: +h.x, top: 0, bot: 0 }; o[h.part] = Math.max(o[h.part], h.r); pts.set(k, o); });
    const P_ = [...pts.values()].sort((a, b) => a.x - b.x), out = { xs: P_.map(o => o.x), top: [], bot: [] };
    ['top', 'bot'].forEach(f => P_.forEach(o => { const z = at(L[f], o.x), A = z.b * z.t, q = o[f]; out[f].push(!(q > 0) ? 0 : A * (q > 1 ? Math.min(q * 1.02, 1.35) : Math.max(q / 0.97, 0.8))); }));
    return out;
  }
  /* the starting requirement: each zone's area (× k) just inside both of its ends and at its stations */
  function reqInit(L, xs, k) {
    const out = { xs: [], top: [], bot: [] }, pts = new Set(xs.map(r4)); ['top', 'bot'].forEach(f => L[f].forEach(z => { pts.add(r4(z.x0 + 0.01)); pts.add(r4(z.x1 - 0.01)); }));
    [...pts].sort((a, b) => a - b).forEach(x => { out.xs.push(x); ['top', 'bot'].forEach(f => { const z = at(L[f], x); out[f].push(z.b * z.t * k); }); });
    return out;
  }
  const webPiece = (L, hits, lim, D) => L.web.map(p => { const r = Math.max(0, ...hits.filter(h => h.part === 'web' && h.x != null && h.x >= p.x0 - 1e-6 && h.x <= p.x1 + 1e-6).map(h => h.r));
    return { ...p, tw: up(Math.max(lim.twMin, D / 150, r > 1 + 1e-9 ? p.tw + lim.twInc : p.tw), lim.twInc), r }; });

  /* ---------- the search ---------- */
  const objKey = (S) => S.objective === 'depth' ? (c => c.L.D * 1e9 + c.cost.w) : S.objective === 'cost' ? (c => c.cost.total) : (c => c.cost.w);
  const sigOf = L => JSON.stringify([L.nb, L.D, L.minLines, L.web.map(p => p.tw), L.top.map(z => [z.x0, z.x1, z.b, z.t]), L.bot.map(z => [z.x0, z.x1, z.b, z.t])]);
  function depthList(P, S, L0) {
    const lim = S.lim, Lmax = Math.max(...P.spans.lengths.map(Number)), inc = lim.Dinc;
    let lo = lim.Dmin != null ? up(lim.Dmin, inc) : up(Lmax * 12 / 36, inc), hi = lim.Dmax != null ? Math.floor(lim.Dmax / inc + 1e-9) * inc : Math.floor(Lmax * 12 / 18 / inc) * inc;
    if (lim.depthRule) lo = Math.max(lo, up(Lmax * 12 * (P.spans.continuity !== 'simple' && P.spans.lengths.length > 1 ? 0.027 : 0.033) - 2 * lim.tfMin, inc));
    if (hi < lo) hi = lo; const step = Math.max(inc, up((hi - lo) / 5, inc)), out = []; for (let D = lo; D <= hi + 1e-9; D += step) out.push(r4(D));
    return { coarse: out, step, lo, hi, inc };
  }
  function nbList(P, S) {
    const xs = P.xs || {}, nb0 = xs.nb || 0, W = (xs.bays || []).reduce((a, v) => a + +v, 0), lst = String(S.nbList || '').split(/[\s,;]+/).map(Number).filter(n => n >= 2 && Number.isInteger(n));
    if (lst.length) return [...new Set(lst)];
    return [nb0 - 1, nb0, nb0 + 1].filter(n => n >= 3 && (n === nb0 || (W / (n - 1) >= S.lim.sLo - 1e-9 && W / (n - 1) <= S.lim.sHi + 1e-9)));
  }

  /* design(P, S, base, ctx): the ratio-driven sizing of one girder count and depth (generator; each yield is one screen trial).
     base: { nb, D, refine (keep zones), minLines (1 for the single-gage-line variant, else null) }. Returns the converged layout and its screen. */
  function* design(P, S, base, ctx) {
    const lim = S.lim, L0 = ctx.L0, Lt = supsOf(P)[P.spans.lengths.length], spl = L0.spl, D = base.D, nl = base.minLines || minLinesOf(P);
    const xs = AN().grid(P.spans.lengths.map(Number)).xs;
    let web = L0.web.map(p => ({ ...p, tw: up(Math.max(lim.twMin, D / 150, base.refine ? p.tw : Math.min(p.tw, D / 150 + 0.25)), lim.twInc) }));
    // starting areas: the current plates, scaled by the lever arm (D0 / D) for a new depth
    let req = reqInit(L0, xs, L0.D / D);
    const mk = () => { const bS = spl.length ? Math.max(...web.map(p => boltFitWidth(P, p.tw, nl))) : 0, F = sizeFlanges(D, web, spl, Lt, req, S, { bSpl: bS, zones: base.refine ? { top: L0.top, bot: L0.bot } : null });
      return { nb: base.nb, D, spl: spl.slice(), web: web.map(p => ({ x0: p.x0, x1: p.x1, tw: p.tw })), top: F.top, bot: F.bot, minLines: base.minLines || null, boltRaised: F.boltRaised }; };
    let L = mk(), E = null, best = null, prev = '', stall = 0;
    for (let it = 0; it < (ctx.maxIt || 10); it++) {
      const Q = projectWith(P, L), pr = proportions(L, Q, S);
      E = evaluate(Q, { level: 'screen', ctx }); if (ctx.trace) ctx.trace.push({ it, L: clone(L), ratio: E.ratio, gov: E.gov });
      yield { msg: `N_b = ${L.nb}, D = ${D} in${base.minLines === 1 ? ', 1 gage line' : ''}: trial ${it + 1}, governing ${E.gov ? E.gov.r.toFixed(3) : '—'}` };
      // the proportion limits drive plates too: Iyc/Iyt out of range raises the smaller flange, D/t_w the web (through the minimums above)
      const pass = E.pass && pr.ok, sig = sigOf(L);
      if (pass && (!best || lineWeight(L) < lineWeight(best.L) - 1e-6)) { best = { L: clone(L), E, pr }; stall = 0; } else if (best) stall++;
      if ((pass && sig === prev) || stall >= 2) break;
      prev = sig;
      const req2 = reqFrom(L, E.hits);
      pr.items.filter(q => !q.ok && /^i\d/.test(q.id)).forEach(q => { const s = segmentsOf(L)[+q.id.slice(1) - 1], ratio = (s.topT * s.topB ** 3) / (s.botT * s.botB ** 3), f = ratio < 0.1 ? 'top' : 'bot';
        req2.xs.forEach((x, i) => { if (x >= s.x0 - 1e-6 && x <= s.x1 + 1e-6) req2[f][i] = Math.max(req2[f][i], at(L[f], x).b * at(L[f], x).t * 1.25); }); });
      req = req2; web = webPiece(L, E.hits, lim, D);
      L = mk();
    }
    return best ? { ...best, pass: true } : { L, E, pass: false };
  }

  /* trim(P, S, cand, ctx): one plate at a time (the largest weight first), the next thinner thickness (or web), kept when the screen still
     passes and the layout rules hold (Preliminary sizing's Full design clean-up and ST-Girder's Optimize sweep, on every plate). Generator. */
  function* trim(P, S, cand, ctx, maxTry) {
    const lim = S.lim; let L = clone(cand.L), E = cand.E, n = 0;
    const tries = []; ['top', 'bot'].forEach(f => L[f].forEach(z => tries.push({ f, xm: (z.x0 + z.x1) / 2, w: z.b * z.t * (z.x1 - z.x0) }))); L.web.forEach((p, i) => tries.push({ f: 'web', i, w: L.D * p.tw * (p.x1 - p.x0) }));
    tries.sort((a, b) => b.w - a.w);
    for (const q of tries) { if (n >= maxTry) break;
      const T = clone(L);
      if (q.f === 'web') { const t = T.web[q.i].tw - lim.twInc; if (t < Math.max(lim.twMin, T.D / 150) - 1e-9) continue; T.web[q.i].tw = r4(t);
        if (T.top.concat(T.bot).some(z => { const p = at(T.web, (z.x0 + z.x1) / 2); return z.t < 1.1 * p.tw - 1e-9; })) continue; }
      else { const Z = T[q.f], i = Z.findIndex(o => q.xm >= o.x0 - 1e-9 && q.xm < o.x1 - 1e-9); if (i < 0) continue; const z = Z[i], t = r4(z.t - lim.tfInc), p = at(T.web, (z.x0 + z.x1) / 2);
        if (t < Math.max(lim.tfMin, 1.1 * p.tw, z.b / 24) - 1e-9) continue;
        const nb = [Z[i - 1], Z[i + 1]].filter(Boolean); if (nb.some(o => Math.max(o.t, t) / Math.min(o.t, t) > lim.thkRatio + 1e-9)) continue;
        z.t = t; T[q.f] = merge(Z, ['b', 't']); }
      n++;
      const Q = projectWith(P, T), pr = proportions(T, Q, S); if (!pr.ok) continue;
      const E2 = evaluate(Q, { level: 'screen', ctx }); yield { msg: `N_b = ${T.nb}, D = ${T.D} in: trimming plate ${n}` };
      if (E2.pass) { L = T; E = E2; }
    }
    return { L, E, pass: true };
  }

  /* run(P, opt): the Auto design (generator). Yields { f (0..1), msg }; returns { S, cands (ranked, each passing every module on the full
     check), rejected (finalists that failed the full check, with what failed), screened (every screened design), current ({ L, cost, E }),
     note }. opt: { settings (overrides P.autodesign), maxIt, trimTries, fullChecks (false: screen only, for tests of the screen) } */
  function* run(P0, opt) {
    opt = opt || {}; const P = clone(P0); if (opt.settings) P.autodesign = { ...(P.autodesign || {}), ...opt.settings, limits: { ...((P.autodesign || {}).limits || {}), ...((opt.settings || {}).limits || {}) }, cost: { ...((P.autodesign || {}).cost || {}), ...((opt.settings || {}).cost || {}) } };
    const S = settings(P), L0 = layoutOf(P), ctx = { L0, maxIt: opt.maxIt || 10, ll: new Map() }, key = objKey(S), out = [];
    if (!L0.web.length) return { S, cands: [], rejected: [], screened: [], note: 'The project has no plate girder.' };
    yield { f: 0.01, msg: 'Live load on the current stiffness (the screen reference)…' };
    const E0 = evaluate(P, { level: 'screen', ctx });
    const cur = { L: L0, E: E0, cost: costOf(L0, S, E0.nStiff) };
    // the trial list: girder counts × depths (coarse, then around the best), both splice gage-line choices where they differ
    let jobs = [];
    const nl0 = minLinesOf(P), lines = [null], oneLine = !!(P.framing && (P.framing.splices || []).length && nl0 > 1);   // the 1-gage-line variant: added after a design whose splice widths the bolt fit raised
    if (S.mode === 'refine') jobs = lines.map(ml => ({ nb: L0.nb, D: L0.D, refine: true, minLines: ml }));
    else if (S.mode === 'check') { const nb = +S.change.nb >= 2 ? Math.round(+S.change.nb) : L0.nb, D = +S.change.D > 0 ? +S.change.D : L0.D; jobs = lines.map(ml => ({ nb, D, refine: nb === L0.nb, minLines: ml })); }
    else { const DL = depthList(P, S, L0); nbList(P, S).forEach(nb => DL.coarse.forEach(D => lines.forEach(ml => jobs.push({ nb, D, minLines: ml, coarse: true })))); ctx.DL = DL; }
    const done = new Map(), total = () => jobs.length + 1; let k = 0;
    const runJob = function* (j) { const id = JSON.stringify([j.nb, j.D, j.minLines, !!j.refine]); if (done.has(id)) return done.get(id);
      let r = yield* design(P, S, j, ctx); if (r.pass && opt.trimTries !== 0) r = yield* trim(P, S, r, ctx, opt.trimTries || 6);
      const res = { job: j, L: r.L, E: r.E, pass: r.pass, cost: costOf(r.L, S, r.E ? r.E.nStiff : 0) }; done.set(id, res); out.push(res);
      return res; };
    for (let i = 0; i < jobs.length; i++) { const j = jobs[i]; const it = runJob(j); let s; while (!(s = it.next()).done) yield { f: 0.05 + 0.6 * (k + i / jobs.length) / Math.max(1, total()), msg: s.value.msg }; }
    if (S.mode === 'new' && ctx.DL) {   // around the best depth of each girder count: every depth increment within half a coarse step
      const extra = []; nbList(P, S).forEach(nb => { const ok = out.filter(o => o.pass && o.job.nb === nb).sort((a, b) => key(a) - key(b))[0]; if (!ok) return;
        for (let D = ok.L.D - ctx.DL.step / 2; D <= ok.L.D + ctx.DL.step / 2 + 1e-9; D += Math.max(ctx.DL.inc, ctx.DL.step / 4)) { const Dr = r4(up(D, ctx.DL.inc)); if (Dr >= ctx.DL.lo - 1e-9 && Dr <= ctx.DL.hi + 1e-9) lines.forEach(ml => extra.push({ nb, D: Dr, minLines: ml })); } });
      for (let i = 0; i < extra.length; i++) { const it = runJob(extra[i]); let s; while (!(s = it.next()).done) yield { f: 0.45 + 0.25 * i / Math.max(1, extra.length), msg: s.value.msg }; }
    }
    // the 1-gage-line variant of the best designs whose splice flange widths the bolt fit raised (DT10): the objective then picks
    if (oneLine) { const best = out.filter(o => o.pass && o.L.boltRaised && o.job.minLines == null).sort((a, b) => key(a) - key(b)).slice(0, 3);
      for (let i = 0; i < best.length; i++) { const it = runJob({ ...best[i].job, minLines: 1, coarse: false }); let s; while (!(s = it.next()).done) yield { f: 0.68, msg: s.value.msg }; } }
    // stage 2: full checks, best first, until topN pass
    const seen = new Set(), pool = out.filter(o => o.pass).sort((a, b) => key(a) - key(b)).filter(o => { const s = sigOf(o.L); if (seen.has(s)) return false; seen.add(s); return true; });
    const cands = [], rejected = [], blocked = []; let curFull = null;
    /* a finalist whose every failing check (module and check id) fails in the current design too is "blocked" by those details (a detail input such
       as a splice end distance or the cross-frame bolts, which the plates do not change): listed apart, never with the passing candidates */
    const fkey = f => `${f.mod}|${f.id}`, curKeys = () => { if (!curFull) curFull = evaluate(P, { level: 'full', ctx }); return new Set(curFull.fails.map(fkey)); };
    /* the checks the plates control (never blockers): a finalist that fails one of them on the full check is resized from where it is, with the
       live load on its own stiffness (the screen's reference was the current design's), and checked again (up to twice) */
    const plateCk = f => ['flexure', 'shear', 'constructibility', 'analysis', 'model'].includes(f.mod) || (f.mod === 'fatigue' && (f.id === 'GS17' || f.id === 'FA1'))
      || (f.mod === 'stiffeners' && f.id === 'BS6') || (f.mod === 'splices' && ['DT3', 'DT7', 'DT10'].includes(f.id));
    for (let i = 0; i < pool.length && cands.length < S.topN && cands.length + blocked.length < S.topN + 2; i++) { let o = pool[i];
      yield { f: 0.7 + 0.29 * i / Math.max(1, Math.min(pool.length, S.topN + 2)), msg: `Full check ${i + 1}: N_b = ${o.L.nb}, D = ${o.L.D} in (every module, live load on its own stiffness)…` };
      if (opt.fullChecks === false) { cands.push(cand(o, o.E, S, P)); continue; }
      let Q, E, pr;
      for (let pol = 0; ; pol++) {
        Q = projectWith(P, o.L); E = evaluate(Q, { level: 'full', ctx }); pr = proportions(o.L, Q, S);
        if ((E.pass && pr.ok) || !E.fails.some(plateCk) || pol >= 2 || opt.polish === false) break;
        const ctx2 = { L0: o.L, maxIt: 6, ll: new Map() }, it2 = design(P, S, { nb: o.L.nb, D: o.L.D, refine: true, minLines: o.L.minLines }, ctx2); let s2;
        while (!(s2 = it2.next()).done) yield { f: 0.7 + 0.29 * i / Math.max(1, Math.min(pool.length, S.topN + 2)), msg: `Full check ${i + 1}: resizing with the live load on its own stiffness — ${s2.value.msg}` };
        if (!s2.value.pass) break;
        o = { ...o, L: s2.value.L, E: s2.value.E, cost: costOf(s2.value.L, S, s2.value.E.nStiff), polished: pol + 1 };
      }
      if (E.pass && pr.ok) { cands.push({ ...cand(o, E, S, P), polished: o.polished || 0 }); continue; }
      const fl = E.fails.map(f => ({ mod: f.mod, id: f.id, title: f.title, r: f.r, x: f.x, gl: f.gl })), ck = curKeys();
      if (pr.ok && fl.length && fl.every(f => !plateCk(f) && ck.has(fkey(f)))) blocked.push({ ...cand(o, E, S, P), blockers: [...new Set(fl.map(f => `${f.mod} ${f.id}`))], fails: fl.slice(0, 6) });
      else rejected.push({ L: o.L, cost: o.cost, fails: fl.slice(0, 6), pr: pr.ok });
    }
    cands.sort((a, b) => key(a) - key(b)); blocked.sort((a, b) => key(a) - key(b));
    let fullCur = null;
    if (opt.fullChecks !== false && S.mode === 'check') { yield { f: 0.99, msg: 'Full check of the current design…' }; fullCur = evaluate(P, { level: 'full', ctx }); }
    const blockers = [...new Set(blocked.flatMap(b => b.blockers))];
    const note = !cands.length && blockers.length ? `No candidate passes every module: detail checks that fail in the current design too, whatever the plates, block them (${blockers.join(', ')}). Fix those inputs (their tabs), then run again; the designs below pass everything else.` : !cands.length ? (out.some(o => o.pass) ? 'No screened design passed every module on the full check: see the rejected list (a detail check, such as a splice, stud or cross-frame, may fail whatever the plates).' : 'No design passed the screen within the limits: widen the depth range or the limits.') : '';
    return { S, cands, blocked, blockers, rejected, screened: out.map(o => ({ nb: o.L.nb, D: o.L.D, minLines: o.L.minLines, pass: o.pass, w: o.cost.w, cost: o.cost.total, ratio: o.E ? o.E.ratio : null })), current: { ...cur, full: fullCur || curFull }, note };
  }
  function cand(o, E, S, P) {
    const Q = projectWith(P, o.L), pr = proportions(o.L, Q, S), c = costOf(o.L, S, E.nStiff), g = E.gov;
    const bf = o.L.spl.length ? [St().step({ id: 'ad.bolt', label: `Flange width for ${o.L.minLines || minLinesOf(P)} gage line(s) each side of the web at the field splices (DT10; owner edge distance)`, sym: 'b_{f,spl}', eq: '2(g_{0} + (n_{l} - 1)g + e_{min})', sub: '', value: Math.max(...o.L.web.map(p => boltFitWidth(P, p.tw, o.L.minLines || minLinesOf(P)))), unit: 'in', d: 2, ref: 'engine/splices.js autoDesign (DT10)' })] : [];
    return { L: o.L, segments: segmentsOf(o.L), cost: c, nb: o.L.nb, D: o.L.D, nTr: c.nTr, nSpl: c.nSpl, ratio: E.ratio, gov: g ? { mod: g.mod, id: g.id, title: g.title, r: g.r, x: g.x, gl: g.gl, step: g.step, tab: g.tab } : null,
      warns: E.warns.slice(0, 10), minLines: o.L.minLines, steps: candSteps(o.L, S, c, [...pr.steps, ...bf]), prop: pr.ok };
  }

  /* runChunked(P, opt, onProgress, stopped): runs run() a step at a time with setTimeout between steps (the page stays responsive);
     resolves with run()'s result, or null when stopped() turned true. */
  function runChunked(P, opt, onProgress, stopped) {
    return new Promise((res, rej) => { const it = run(P, opt);
      const step = () => { if (stopped && stopped()) { res(null); return; } let s; try { s = it.next(); } catch (e) { rej(e); return; }
        if (s.done) { res(s.value); return; } if (onProgress) onProgress(s.value); setTimeout(step, 0); };
      setTimeout(step, 0); });
  }

  /* apply(P, cand): the project with the candidate written in (plates on every girder, girder count, b_eff, splices, gage lines), and the
     previous design kept for one-step undo: { project, undo } (undo: the parts of the project that Apply changes, to put back). */
  function apply(P, c) {
    const keep = clone({ girders: P.girders, xs: P.xs, framing: P.framing, splices: P.splices });
    const Q = projectWith(P, c.L); Q.autodesign = { ...(P.autodesign || {}), undo: keep, applied: { at: new Date().toISOString(), nb: c.L.nb, D: c.L.D, w: c.cost.w } };
    return { project: Q, undo: keep };
  }
  function undo(P) { const u = P.autodesign && P.autodesign.undo; if (!u) return null; const Q = clone(P); Object.assign(Q, clone(u)); delete Q.autodesign.undo; delete Q.autodesign.applied; return Q; }

  window.SBDAutoDesign = { DEF, STEEL, settings, layoutOf, segmentsOf, projectWith, lineWeight, transitions, costOf, proportions, boltFitWidth, payloadOf, evaluate, sizeFlanges, design, trim, run, runChunked, apply, undo, depthList, nbList };
})();
