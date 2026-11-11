/* shared/abutment-def.js — the abutment definition exchanged by the Abutment Calculator (abutment_calculator.html) and Bridge Substructure
   Loading (window.SharedAbutmentDef). Classic script, no library, no DOM. Added 2026-11-11 (engineer request "the abutment app and the
   substructure loading app should talk with each other more … pull an abutment from one into the other and vice versa"; HANDOFF.md §4.5
   (abutmentLoads[i].definition) and §4.15 (abutmentDef)). Node tests: tests/engine/abutment-def.test.mjs.

   Ownership (engineer decision 2026-11-11): the Abutment Calculator owns the abutment itself (stem, backwall, footing, lengths, soil and
   backfill); SubLoads owns the bridge (spans, girders, skew, elevations, bearings, superstructure loads). Each pull ticks by default the
   groups the SENDER owns (the receiver may tick any group either way); the tools apply the defaults, this file only says who owns what.

   Nothing here computes a load or changes a result: it maps one tool's inputs onto the other's input names, checks the numbers, and
   gives the review rows. A tool applies the items only after the user's Apply.

   The definition (all lengths and elevations ft; display heights in; pad in; G ksi; unit weights kcf; pressures ksf; angles deg):
     { v:1, source:'subloads'|'abutment', name, end:'begin'|'end'|'',
       skewDeg  (as entered in the sender: SubLoads signed, the Abutment Calculator a magnitude), spanL (the adjacent span),
       lengths:{ Lab, Lftg, LabAuto, LftgAuto },          // wall (stem / backwall) and footing length along the bearing line; *Auto: SubLoads blank
       stem:{ tTop, tBot, H },                             // thickness at the seat / at the footing; H = top of footing to the bridge seat
       backwall:{ t, h },                                  // h = bridge seat to top of backwall
       af,                                                 // front face of the stem at the seat to the CL of bearing
       footing:{ toe, heel, W, t, Df },                    // W = toe + t_bot + heel; Df = ground − bottom of footing
       elevations:{ seat, topOfBackwall, topOfFooting, bottomOfFooting, ground, deck } | null,   // the bridge seat (top of stem)
       superstructure:{ brgHIn, girderIn, haunchIn, deckIn } | null,   // seat to underside of girder (bearing + pedestal), girder, haunch, deck
       soil:{ method:'rankine'|'coulomb'|'atrest', gamma, phi, delta, beta, heq5, heq10, heq20, esQ, hw, soilH, soilHAuto, constrFill, gLLc } | null,
       approachSlab:{ on, W, WAuto, L, t, sharePct, RDC, LL } | null,   // t in ft; sharePct = the slab weight share on this abutment (%)
       seismic:{ As, khR, kv, hEQr, hEQmode:'ratio'|'static' } | null,
       concrete:{ gc } | null, pad:{ L, W, G, hrt } | null,
       info:{ kRule, lsRed, wingwalls:[text], battered, refined:[text] } }   // information only: never applied
   Refined Abutment Calculator data is never put in it: backwall offset / stem shelf, batter detail beyond t_top / t_bot, the Coulomb heel
   cases, the K rules, water in front (WA), the construction surcharge q_c, the approach-slab model beyond W / L / t / share, piles,
   resistances, reinforcement, owner rules, integral and semi-integral types.

   API
     SCHEMA, UNITS, VER, OWNER{group: 'abutment'|'bridge'}
     fromSubLoads(x) -> definition   (x: plain values read by SubLoads for one abutment unit; see below)
     fromLoads(a, p) -> definition   (an abutmentLoads abutment without a definition block: the geometry, elevations and bearings it carries)
     fromAbutment(S, ctx) -> definition   (S: the Abutment Calculator state; ctx: { ap, name } computed values it does not store)
     validate(def) -> { ok, errors, gerr:{ group: reason } }   (geometry errors refuse; a bad optional group is disabled with its reason)
     toAbutment(def, ctx) -> { groups:{ k:{ items, notes } }, gerr }   items [{ path, val, lbl, unit, note? }] into the Abutment state S
     toSubLoads(def, ctx) -> { groups:{ k:{ items, notes, scope } }, gerr, info:[[lbl, abut, subloads, why]] }   paths into one unit (scope
         'unit') or into P.br (scope 'bridge')
     rows(items, get) -> [{ lbl, cur, inc, chg, note }]   the current-vs-incoming review rows
     checkPayload(p) -> { ok, errors, warnings, gerr }   the abutmentDef envelope (HANDOFF.md §4.15)
     summary(p) -> one line for the project picker
     hash(def) -> 8 hex (FNV-1a of JSON.stringify(def)) */
(function () {
  'use strict';
  const VER = 1, SCHEMA = 'bridge-abutment-def';
  const UNITS = { length: 'ft', elevation: 'ft', display: 'in', pad: 'in', shearModulus: 'ksi', unitWeight: 'kcf', pressure: 'ksf', angle: 'deg', force: 'kip' };
  const OWNER = { geom: 'abutment', soil: 'abutment', aps: 'abutment', bridge: 'bridge', elev: 'bridge', brg: 'bridge', seisset: 'bridge', bridgewide: 'bridge', ftgEl: 'bridge' };
  const isN = v => typeof v === 'number' && isFinite(v);
  const num = v => { if (v === '' || v == null) return NaN; const x = typeof v === 'number' ? v : parseFloat(v); return isFinite(x) ? x : NaN; };
  const nz = v => { const x = num(v); return isFinite(x) ? x : 0; };
  const r3 = v => isN(v) ? Math.round(v * 1000) / 1000 : v;
  const r4 = v => isN(v) ? Math.round(v * 1e4) / 1e4 : v;
  const pos = v => num(v) > 0;
  function fnv(text) { let h = 0x811c9dc5; const s = String(text); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); }
  const hash = def => fnv(JSON.stringify(def));
  const fmt = v => v === '' ? '(blank)' : v == null ? '—' : isN(v) ? String(r3(v)) : typeof v === 'boolean' ? (v ? 'on' : 'off') : Array.isArray(v) ? v.map(fmt).join(', ') : String(v);

  /* ---------- builders ---------- */
  /* fromSubLoads(x): x = { name, end, skewDeg, spanL, abut:{ L, Lftg, stemT, brgA, bwT, toe }, ftg:{ type, W, t }, Lab, Lftg (effective),
       stemTop, bwTop, topFtg, ftgBot, ground, deckZ, hbIn, hpIn, br:{ d, haunch, ts, wc, khR, kv, hEQr }, As, earth (filled), aslW (effective
       approach-slab width), elast:{ L, W, G, hrt }, brgType } */
  function fromSubLoads(x) {
    const a = x.abut || {}, f = x.ftg || {}, e = x.earth || {}, b = x.br || {}, tS = nz(a.stemT), toe = nz(a.toe), W = nz(f.W);
    const soilHe = pos(e.soilH) ? num(e.soilH) : x.bwTop - x.topFtg;
    return {
      v: VER, source: 'subloads', name: String(x.name || ''), end: x.end || '',
      skewDeg: r4(nz(x.skewDeg)), spanL: r4(x.spanL),
      lengths: { Lab: r4(x.Lab), Lftg: r4(x.Lftg), LabAuto: !pos(a.L), LftgAuto: !pos(a.Lftg) },
      stem: { tTop: r4(tS), tBot: r4(tS), H: r4(x.stemTop - x.topFtg) },
      backwall: { t: r4(nz(a.bwT)), h: r4(x.bwTop - x.stemTop) },
      af: r4(nz(a.brgA)),
      footing: { toe: r4(toe), heel: r4(Math.max(0, W - toe - tS)), W: r4(W), t: r4(nz(f.t)), Df: r4(x.ground - x.ftgBot) },
      elevations: { seat: r4(x.stemTop), topOfBackwall: r4(x.bwTop), topOfFooting: r4(x.topFtg), bottomOfFooting: r4(x.ftgBot), ground: r4(x.ground), deck: r4(x.deckZ) },
      superstructure: { brgHIn: r4(nz(x.hbIn) + nz(x.hpIn)), girderIn: r4(nz(b.d)), haunchIn: r4(nz(b.haunch)), deckIn: r4(nz(b.ts)) },
      soil: { method: ['rankine', 'coulomb', 'atrest'].indexOf(e.method) >= 0 ? e.method : 'rankine', gamma: r4(nz(e.gamma) || 0.120), phi: r4(nz(e.phi)), delta: r4(nz(e.delta)), beta: r4(nz(e.beta)),
        heq5: r4(nz(e.heq5)), heq10: r4(nz(e.heq10)), heq20: r4(nz(e.heq20)), esQ: r4(nz(e.esQ)), hw: r4(Math.max(0, nz(e.hw))), soilH: r4(soilHe), soilHAuto: !pos(e.soilH),
        constrFill: r4(nz(e.constrFill)), gLLc: r4(nz(e.gLLc)) },
      approachSlab: { on: e.asOn === 'yes', W: r4(x.aslW), WAuto: !pos(e.asW), L: r4(nz(e.asL)), t: r4(nz(e.asT) / 12), sharePct: r4(nz(e.asPct)), RDC: null, LL: e.asLL === 'yes' ? 'yes' : 'no' },
      seismic: { As: r4(x.As), khR: r4(nz(b.khR)), kv: r4(nz(b.kv)), hEQr: r4(nz(b.hEQr) || 0.6), hEQmode: 'ratio' },
      concrete: { gc: r4(nz(b.wc) || 0.150) },
      pad: x.brgType === 'elast' ? { L: r4(nz((x.elast || {}).L)), W: r4(nz((x.elast || {}).W)), G: r4(nz((x.elast || {}).G)), hrt: r4(nz((x.elast || {}).hrt)) } : null,
      info: { kRule: e.method === 'atrest' ? 'at rest (k0 = 1 − sin φ)' : 'active', lsRed: null, wingwalls: [], battered: false, refined: [] } };
  }
  /* fromLoads(a, p): an abutmentLoads abutment of an older SubLoads (no definition block): geometry, elevations and bearings only */
  function fromLoads(a, p) {
    const G = (a && a.geometry) || {}, E = G.elevations || {}, ci = (a && a.calculatorInput) || {}, cg = ci.geom || {}, B = (a && a.bearings) || {};
    const end = a && a.end === 'end' ? 'end' : 'begin', br = (p && p.bridge) || {};
    const span = isN(+cg.spanL) ? +cg.spanL : (Array.isArray(br.spans) && br.spans.length ? +(end === 'end' ? br.spans[br.spans.length - 1] : br.spans[0]) : NaN);
    const L = +G.stemLengthAlongSkew, Lf = isN(+cg.Lftg) ? +cg.Lftg : L;
    return {
      v: VER, source: 'subloads', name: String((a && a.name) || ''), end, legacy: true,
      skewDeg: +a.skewDeg, spanL: span,
      lengths: { Lab: L, Lftg: Lf, LabAuto: false, LftgAuto: false },
      stem: { tTop: +G.stemThickness, tBot: +G.stemThickness, H: +G.stemHeight },
      backwall: { t: +G.backwallThickness, h: +G.backwallHeight },
      af: +G.bearingToStemFront,
      footing: { toe: +G.toe, heel: +G.heel, W: +G.footingWidth, t: +G.footingThickness, Df: (+E.ground) - (+E.bottomOfFooting) },
      elevations: { seat: +E.bridgeSeat, topOfBackwall: +E.topOfBackwall, topOfFooting: +E.topOfFooting, bottomOfFooting: +E.bottomOfFooting, ground: +E.ground, deck: +E.deckAtCL },
      superstructure: null, soil: { soilH: (+E.topOfBackwall) - (+E.topOfFooting), soilHAuto: true, partial: true },
      approachSlab: null, seismic: null, concrete: ci.mat && ci.mat.gc != null ? { gc: +ci.mat.gc } : null,
      pad: B.type === 'elastomeric' ? { L: +B.padLengthIn, W: +B.padWidthIn, G: +B.shearModulusKsi, hrt: +B.rubberThicknessIn } : null,
      info: { kRule: null, lsRed: null, wingwalls: [], battered: false, refined: [] } };
  }
  /* fromAbutment(S, ctx): the Abutment Calculator's inputs; ctx = { name, ap: LAST_R.ap (the computed approach slab, or null), wingText:[..] } */
  function fromAbutment(S, ctx) {
    ctx = ctx || {}; const g = S.geom || {}, so = S.soil || {}, c = S.constr || {}, sq = S.seismic || {}, A = S.apSlab || {}, bg = S.bearing || {}, ap = ctx.ap || null;
    const tTop = num(g.tst), tBot = num(g.tsb), tbw = num(g.tbw), af = isFinite(num(g.brgFront)) ? num(g.brgFront) : tTop - tbw - num(g.brgSetback);
    const seat = num(g.elSeat), hasEl = isFinite(seat), H = num(g.hstem), tf = num(g.tf), Df = num((S.fnd || {}).Df);
    const disp = k => { const v = g[k]; return v === null || v === undefined || v === '' || !isFinite(+v) ? null : +v; };
    const sup = { brgHIn: disp('elBrgH'), girderIn: disp('elGird'), haunchIn: disp('elHaunch'), deckIn: disp('elDeck') };
    const allSup = Object.values(sup).every(v => v !== null);
    let slab = null;
    if (A.on) {
      const W = ap && isN(ap.W) ? ap.W : (pos(A.W) ? +A.W : num(g.Lab) * Math.cos((nz(g.skew)) * Math.PI / 180));
      const L = num(A.L), t = num(A.t), gc = nz((S.mat || {}).gc) || 0.150, RDC = ap && isN(ap.RDC) ? ap.RDC : gc * t * W * L / 2;
      slab = { on: true, W: r4(W), WAuto: !pos(A.W), L: r4(L), t: r4(t), sharePct: r4(W * L * t * gc > 0 ? 100 * RDC / (gc * t * W * L) : 50), RDC: r4(RDC), LL: null };
    } else slab = { on: false, W: null, WAuto: true, L: null, t: null, sharePct: null, RDC: null, LL: null };
    const wing = S.wing && S.wing.on ? (ctx.wingText || ['wingwalls on (panel I-13)']) : [];
    const refined = [];
    if (+g.bwOff > 0) refined.push('backwall offset e = ' + r3(+g.bwOff) + ' in and stem shelf (panel I-1)');
    if (g.hwFr !== null && g.hwFr !== undefined && g.hwFr !== '' && isFinite(+g.hwFr)) refined.push('water level in front of the wall (WA)');
    if (+c.qC > 0) refined.push('construction surcharge q_c = ' + r3(+c.qC) + ' ksf');
    if (so.Kmode && so.Kmode !== 'active') refined.push('earth pressure state ' + so.Kmode);
    if (S.piles && S.piles.enabled) refined.push('pile foundation (panel I-7)');
    return {
      v: VER, source: 'abutment', name: String(ctx.name || ''), end: '',
      skewDeg: r4(nz(g.skew)), spanL: r4(num(g.spanL)),
      lengths: { Lab: r4(num(g.Lab)), Lftg: r4(num(g.Lftg)), LabAuto: false, LftgAuto: false },
      stem: { tTop: r4(tTop), tBot: r4(tBot), H: r4(H) },
      backwall: { t: r4(tbw), h: r4(num(g.hbw)) },
      af: r4(af),
      footing: { toe: r4(num(g.Ltoe)), heel: r4(num(g.Lheel)), W: r4(num(g.Ltoe) + tBot + num(g.Lheel)), t: r4(tf), Df: r4(Df) },
      elevations: hasEl ? { seat: r4(seat), topOfBackwall: r4(seat + num(g.hbw)), topOfFooting: r4(seat - H), bottomOfFooting: r4(seat - H - tf), ground: isFinite(Df) ? r4(seat - H - tf + Df) : null,
        deck: allSup ? r4(seat + (sup.brgHIn + sup.girderIn + sup.haunchIn + sup.deckIn) / 12) : null } : null,
      superstructure: Object.values(sup).some(v => v !== null) ? sup : null,
      soil: { method: so.method === 'coulomb' ? 'coulomb' : 'rankine', gamma: r4(num(so.gamma)), phi: r4(num(so.phi)), delta: r4(num(so.delta)), beta: r4(nz(g.beta)),
        heq5: r4(num(so.heq5)), heq10: r4(num(so.heq10)), heq20: r4(num(so.heq20)), esQ: r4(nz(so.esQ)), hw: r4(Math.max(0, nz(g.hw))), soilH: r4(num(g.soilH)), soilHAuto: false,
        constrFill: r4(nz(c.hFill)), gLLc: r4(nz(c.gLL)) },
      approachSlab: slab,
      seismic: { As: r4(num(sq.As)), khR: r4(num(sq.khR)), kv: r4(nz(sq.kv)), hEQr: r4(num(sq.hEQr)), hEQmode: sq.hEQmode === 'ratio' ? 'ratio' : 'static' },
      concrete: { gc: r4(nz((S.mat || {}).gc) || 0.150) },
      pad: { L: r4(num(bg.padL)), W: r4(num(bg.padW)), G: r4(num(bg.G)), hrt: r4(num(bg.hrt)) },
      info: { kRule: so.Kmode && so.Kmode !== 'active' ? so.Kmode : 'active', lsRed: A.on ? A.lsRed !== false : null, wingwalls: wing, battered: Math.abs(tBot - tTop) > 1e-6, refined } };
  }

  /* ---------- checks ---------- */
  const inR = (v, lo, hi) => isN(v) && v >= lo && v <= hi;
  function validate(d) {
    const E = [], gerr = {}, bad = (g, m) => { gerr[g] = gerr[g] ? gerr[g] + '; ' + m : m; };
    if (!d || typeof d !== 'object') return { ok: false, errors: ['no abutment definition'], gerr };
    if (!(d.v <= VER)) return { ok: false, errors: ['newer definition format (v' + d.v + ') than this tool supports (v' + VER + ')'], gerr };
    const L = d.lengths || {}, st = d.stem || {}, bw = d.backwall || {}, f = d.footing || {};
    [['L_ab', L.Lab, 1, 1000], ['L_ftg', L.Lftg, 1, 1000], ['stem thickness at the seat', st.tTop, 0.25, 20], ['stem thickness at the footing', st.tBot, 0.25, 20],
      ['stem height', st.H, 0.01, 200], ['backwall thickness', bw.t, 0.1, 20], ['backwall height', bw.h, 0, 50], ['bearing to stem front a_f', d.af, 0, 20],
      ['toe', f.toe, 0, 50], ['heel', f.heel, 0, 100], ['footing thickness', f.t, 0.25, 20]].forEach(([n, v, lo, hi]) => { if (!inR(v, lo, hi)) E.push(n + ' = ' + fmt(v) + ' (expected ' + lo + ' to ' + hi + ' ft)'); });
    if (!E.length && !(d.af < st.tTop)) E.push('the bearing (a_f = ' + fmt(d.af) + ' ft) is not on the stem (t_top = ' + fmt(st.tTop) + ' ft)');
    if (!inR(d.skewDeg, -60, 60)) bad('bridge', 'skew ' + fmt(d.skewDeg) + '° outside −60° to 60°');
    if (!(isN(d.spanL) && d.spanL > 0)) bad('bridge', 'no span length');
    const s = d.soil;
    if (s && !s.partial) {
      if (['rankine', 'coulomb', 'atrest'].indexOf(s.method) < 0) bad('soil', 'method ' + fmt(s.method));
      [['γ', s.gamma, 0.05, 0.2], ['φ', s.phi, 10, 50], ['δ', s.delta, 0, 45], ['β', s.beta, 0, 45], ['h_eq 5 ft', s.heq5, 0, 10], ['h_eq 10 ft', s.heq10, 0, 10], ['h_eq 20 ft', s.heq20, 0, 10],
        ['ES', s.esQ, 0, 5], ['h_w', s.hw, 0, 200], ['soil height', s.soilH, 0, 200], ['construction fill', s.constrFill, 0, 200], ['γ_LS construction', s.gLLc, 0, 3]].forEach(([n, v, lo, hi]) => { if (!inR(v, lo, hi)) bad('soil', n + ' = ' + fmt(v)); });
      if (isN(s.beta) && isN(s.phi) && !(s.beta < s.phi)) bad('soil', 'β ≥ φ');
    }
    const a = d.approachSlab;
    if (a && a.on) [['W', a.W, 1, 500], ['L', a.L, 1, 100], ['t', a.t, 0.25, 5], ['share', a.sharePct, 0, 100]].forEach(([n, v, lo, hi]) => { if (!inR(v, lo, hi)) bad('aps', n + ' = ' + fmt(v)); });
    const q = d.seismic;
    if (q) [['A_s', q.As, 0, 2], ['k_h ratio', q.khR, 0, 1.5], ['k_v', q.kv, 0, 0.99], ['ΔP_AE height ratio', q.hEQr, 0, 1]].forEach(([n, v, lo, hi]) => { if (!inR(v, lo, hi)) bad('seisset', n + ' = ' + fmt(v)); });
    if (d.concrete && !inR(d.concrete.gc, 0.1, 0.2)) bad('bridgewide', 'w_c = ' + fmt(d.concrete.gc));
    const p = d.pad;
    if (p) [['pad length', p.L, 1, 60], ['pad width', p.W, 1, 80], ['G', p.G, 0.05, 0.4], ['h_rt', p.hrt, 0.25, 20]].forEach(([n, v, lo, hi]) => { if (!inR(v, lo, hi)) bad('brg', n + ' = ' + fmt(v)); });
    const el = d.elevations;
    if (el) ['seat', 'topOfBackwall', 'topOfFooting', 'bottomOfFooting'].forEach(k => { if (!isN(el[k])) bad('elev', k + ' not a number'); });
    if (d.superstructure) ['brgHIn', 'girderIn', 'haunchIn', 'deckIn'].forEach(k => { const v = d.superstructure[k]; if (v !== null && !inR(v, 0, 240)) bad('elev', k + ' = ' + fmt(v)); });
    return { ok: !E.length, errors: E, gerr };
  }
  function checkPayload(p) {
    const E = [];
    if (!p || typeof p !== 'object') return { ok: false, errors: ['not a hand-off object'], warnings: [], gerr: {} };
    if (p._schema !== SCHEMA) return { ok: false, errors: ['wrong data type (' + (p._schema || 'none') + '), expected ' + SCHEMA], warnings: [], gerr: {} };
    if (!(p.schemaVersion <= 1)) return { ok: false, errors: ['newer format (v' + p.schemaVersion + ') than this tool supports (v1)'], warnings: [], gerr: {} };
    const u = p.units || {};
    Object.keys(UNITS).forEach(k => { if (u[k] !== UNITS[k]) E.push('unit of ' + k + ' is "' + (u[k] == null ? 'not stated' : u[k]) + '"; expected ' + UNITS[k]); });
    if (p.abutType && p.abutType !== 'conv') E.push('abutment type "' + p.abutType + '": SubLoads models a conventional abutment on a footing');
    const v = validate(p.definition);
    const W = [];
    if (v.ok && p.contentHash && p.contentHash !== hash(p.definition)) W.push('The content hash does not match the definition (the file was edited after it was sent).');
    return { ok: !E.length && v.ok, errors: E.concat(v.errors), warnings: W, gerr: v.gerr };
  }

  /* ---------- mapping into the Abutment Calculator (SubLoads -> Abutment) ---------- */
  /* ctx = { integral: bool, roadwayW: number|null, gerr: {} } */
  function toAbutment(d, ctx) {
    ctx = ctx || {}; const G = {}, gerr = Object.assign({}, validate(d).gerr), it = (path, val, lbl, unit, note) => ({ path, val: r3(val), lbl: lbl + (unit ? ' (' + unit + ')' : ''), ...(note ? { note } : {}) });
    const st = d.stem, bw = d.backwall, f = d.footing, L = d.lengths, s = d.soil || {}, integ = !!ctx.integral;
    let gi = [it('geom.hbw', bw.h, 'Backwall height h_bw', 'ft'), it('geom.tbw', bw.t, 'Backwall thickness t_bw', 'ft'),
      it('geom.hstem', st.H, 'Stem height', 'ft'), it('geom.tst', st.tTop, 'Stem thickness, top', 'ft'),
      it('geom.tsb', st.tBot, Math.abs(st.tBot - st.tTop) < 1e-9 && d.source === 'subloads' ? 'Stem thickness, bottom (SubLoads stem is prismatic)' : 'Stem thickness, bottom', 'ft'),
      it('geom.brgSetback', st.tTop - d.af - bw.t, 'Bearing setback from backwall front = t_stem − (bearing to stem front) − t_bw', 'ft'),
      it('geom.Ltoe', f.toe, 'Toe length', 'ft'), it('geom.Lheel', f.heel, 'Heel length', 'ft'), it('geom.tf', f.t, 'Footing thickness', 'ft'),
      it('geom.Lab', L.Lab, 'Wall length (along skew)', 'ft'), it('geom.Lftg', L.Lftg, d.legacy && !(L.Lftg !== L.Lab) ? 'Footing length (= SubLoads stem length along skew)' : 'Footing length L_ftg (along skew)', 'ft'),
      it('geom.soilH', s.soilH, s.soilHAuto === false ? 'Soil height over heel (entered in SubLoads)' : 'Soil height over heel = top of backwall − top of footing', 'ft'),
      it('fnd.Df', f.Df, 'Footing embedment D_f = ground − bottom of footing (passive)', 'ft')];
    if (d.concrete && isN(d.concrete.gc)) gi.push(it('mat.gc', d.concrete.gc, 'Concrete unit weight', 'kcf'));
    let bi = [it('geom.spanL', d.spanL, 'Span length (adjacent span)', 'ft'), it('geom.skew', Math.abs(d.skewDeg), "Skew |θ| (the calculator's skew is a magnitude)", 'deg')];
    if (isN(ctx.roadwayW) && !integ) bi.push(it('longit.roadwayW', ctx.roadwayW, "Clear roadway width (used only by the calculator's own BR)", 'ft'));
    let skip = [];
    if (integ) { const keep = ['geom.Lab', 'mat.gc']; skip = gi.filter(x => keep.indexOf(x.path) < 0).map(x => x.lbl.replace(/ \((ft|kcf)\)$/, '')); gi = gi.filter(x => keep.indexOf(x.path) >= 0); }
    G.geom = { items: gi, skip }; G.bridge = { items: bi };
    if (d.soil && !d.soil.partial) {
      const si = [];
      if (s.method === 'atrest') si.push(it('soil.Kmode', 'atrest', 'Earth pressure state (SubLoads: at rest, k0 = 1 − sin φ)'));
      else si.push(it('soil.method', s.method, 'Earth pressure theory'));
      si.push(it('soil.gamma', s.gamma, 'Backfill unit weight γ', 'kcf'), it('soil.phi', s.phi, 'Backfill friction angle φ', 'deg'), it('soil.delta', s.delta, 'Wall friction δ (Coulomb)', 'deg'),
        it('geom.beta', s.beta, 'Backfill slope β', 'deg'), it('soil.heq5', s.heq5, 'h_eq at H = 5 ft', 'ft'), it('soil.heq10', s.heq10, 'h_eq at H = 10 ft', 'ft'), it('soil.heq20', s.heq20, 'h_eq at H ≥ 20 ft', 'ft'),
        it('soil.esQ', s.esQ, 'Earth surcharge ES', 'ksf'), it('geom.hw', s.hw, 'Water table above the bottom of footing h_w', 'ft'),
        it('constr.hFill', s.constrFill, 'Construction: backfill height above the footing (0 = full)', 'ft'), it('constr.gLL', s.gLLc, 'Construction: γ on LS', ''));
      G.soil = { items: si };
    } else gerr.soil = gerr.soil || 'not sent (an older SubLoads)';
    const a = d.approachSlab;
    if (a) {
      if (!a.on) G.aps = { items: [it('apSlab.on', false, 'Approach slab (panel I-0b)')] };
      else { const th = Math.abs(nz(d.skewDeg)) * Math.PI / 180, auto = Math.abs(a.W - L.Lab * Math.cos(th)) < 0.01;
        G.aps = { items: [it('apSlab.on', true, 'Approach slab (panel I-0b)'), it('apSlab.L', a.L, 'Length L along the roadway', 'ft'), it('apSlab.t', a.t, 'Thickness t', 'ft'),
          it('apSlab.W', auto ? 0 : a.W, auto ? 'Width W (0 = L_ab·cos θ = the SubLoads width ' + r3(a.W) + ' ft)' : 'Width W, edge to edge', 'ft')],
          notes: ['SubLoads puts ' + r3(a.sharePct) + "% of the slab weight on the abutment; the calculator computes its own reaction from the slab's plan (half the slab, area/2, with its skew rule), its wearing surface and its live load (Tab 1 §1.4a). SubLoads' share and its approach-slab live load option (" + (a.LL === 'yes' ? 'on' : 'off') + ') are not imported.'] }; }
    } else gerr.aps = gerr.aps || 'not sent (an older SubLoads)';
    if (d.elevations && d.superstructure && !integ) {
      const e = d.elevations, u = d.superstructure;
      G.elev = { items: [it('geom.elSeat', e.seat, 'Beam seat elevation (the SubLoads bridge seat, top of stem)', 'ft'), it('geom.elBrgH', u.brgHIn, 'Total bearing height h_brg (SubLoads bearing + pedestal)', 'in'),
        it('geom.elGird', u.girderIn, 'Girder depth d_g', 'in'), it('geom.elHaunch', u.haunchIn, 'Haunch h_h', 'in'), it('geom.elDeck', u.deckIn, 'Deck thickness t_d', 'in')],
        notes: ['Display only in the calculator (Tab 1 §1.1a): no calculation reads them. SubLoads takes the bridge seat at the lowest bearing of the line; top of deck there = seat + (h_brg + d_g + h_h + t_d)/12 = ' + r3(e.seat + (u.brgHIn + u.girderIn + u.haunchIn + u.deckIn) / 12) + ' ft (SubLoads deck at ℄: ' + r3(e.deck) + ' ft).'] };
    } else gerr.elev = gerr.elev || (integ ? 'integral abutment: the elevations of Tab 1 §1.1a are for a conventional or semi-integral abutment' : 'not sent (an older SubLoads)');
    if (d.seismic) G.seisset = { items: [it('seismic.khRAuto', false, 'k_h ratio set automatically from the foundation'), it('seismic.khR', d.seismic.khR, 'k_h / k_h0', ''), it('seismic.kv', d.seismic.kv, 'k_v', ''), it('seismic.hEQr', d.seismic.hEQr, 'ΔP_AE height ratio (used only in the calculator\'s "ratio" mode)', '')],
      notes: ['Bridge-wide in SubLoads (the same for every unit). The calculator\'s ΔP_AE height mode is not changed: SubLoads applies ΔP_AE at ' + r3(d.seismic.hEQr) + 'H; the calculator applies it at the ratio only in its "ratio" mode (default "static", ≥ H/3, 11.6.5.3).'] };
    else gerr.seisset = gerr.seisset || 'not sent (an older SubLoads)';
    return { groups: G, gerr };
  }

  /* ---------- mapping into SubLoads (Abutment -> SubLoads) ---------- */
  /* ctx: the SubLoads unit now = { name, Lauto, soilHAuto, stemTop, bwTop, topFtg, ground, ftgType, GWd, skewDeg, spanL, deckZ, seatMin, hbIn, hpIn, d, haunch, ts } */
  function toSubLoads(d, ctx) {
    ctx = ctx || {}; const G = {}, v = validate(d), gerr = Object.assign({}, v.gerr), it = (path, val, lbl, unit, note) => ({ path, val: typeof val === 'number' ? r3(val) : val, lbl: lbl + (unit ? ' (' + unit + ')' : ''), ...(note ? { note } : {}) });
    const st = d.stem, bw = d.backwall, f = d.footing, L = d.lengths, s = d.soil, gc = d.concrete && isN(d.concrete.gc) ? d.concrete.gc : 0.150;
    const labAuto = isN(ctx.Lauto) && Math.abs(L.Lab - ctx.Lauto) < 0.005, ftgAuto = Math.abs(L.Lftg - L.Lab) < 0.005;
    const gi = [it('abut.L', labAuto ? '' : L.Lab, labAuto ? 'Abutment length L_ab (blank = auto: equals the auto ' + r3(ctx.Lauto) + ' ft)' : 'Abutment length L_ab', 'ft'),
      it('abut.Lftg', ftgAuto ? '' : L.Lftg, ftgAuto ? 'Footing length L_ftg (blank = L_ab)' : 'Footing length L_ftg', 'ft'),
      it('abut.stemT', st.tTop, Math.abs(st.tBot - st.tTop) > 1e-6 ? 'Stem thickness (the calculator\'s t_top; battered stem, see the note)' : 'Stem thickness', 'ft'),
      it('abut.brgA', d.af, 'CL bearing to front face', 'ft'), it('abut.bwT', bw.t, 'Backwall thickness', 'ft'), it('abut.toe', f.toe, 'Footing toe', 'ft'),
      it('ftg.W', f.toe + st.tBot + f.heel, 'Footing width = toe + t_bot + heel', 'ft'), it('ftg.t', f.t, 'Footing thickness', 'ft')];
    if (ctx.ftgType === 'none') gi.push(it('ftg.type', 'comb', 'Foundation (was "None")'));
    const gn = [];
    if (Math.abs(st.tBot - st.tTop) > 1e-6) {
      const H = isN(ctx.stemTop) && isN(ctx.topFtg) ? ctx.stemTop - ctx.topFtg : st.H, dW = gc * L.Lab * H * (st.tBot - st.tTop) / 2;
      gn.push('Battered stem: the calculator has t_top = ' + r3(st.tTop) + ' ft, t_bot = ' + r3(st.tBot) + ' ft; SubLoads models a prismatic stem of t_top. Stem weight in SubLoads = w_c·L_ab·H·t_top; the calculator\'s = w_c·L_ab·H·(t_top + t_bot)/2: SubLoads is lower by w_c·L_ab·H·(t_bot − t_top)/2 = ' + r3(gc) + ' × ' + r3(L.Lab) + ' × ' + r3(H) + ' × ' + r3(st.tBot - st.tTop) + '/2 = ' + r3(dW) + ' kip, and its heel (W − toe − t_top) is ' + r3(st.tBot - st.tTop) + ' ft wider (more soil over the heel). The footing width is kept: toe + t_bot + heel.');
    }
    G.geom = { items: gi, notes: gn, scope: 'unit' };
    if (s && !s.partial) {
      const shAuto = isN(ctx.soilHAuto) && Math.abs(s.soilH - ctx.soilHAuto) < 0.005;
      G.soil = { scope: 'unit', items: [it('earth.method', s.method, 'Earth pressure theory'), it('earth.gamma', s.gamma, 'Soil γ', 'kcf'), it('earth.phi', s.phi, 'φ', 'deg'), it('earth.delta', s.delta, 'Wall friction δ (Coulomb)', 'deg'),
        it('earth.beta', s.beta, 'Backfill slope β', 'deg'), it('earth.heq5', s.heq5, 'h_eq at H = 5 ft', 'ft'), it('earth.heq10', s.heq10, 'h_eq at H = 10 ft', 'ft'), it('earth.heq20', s.heq20, 'h_eq at H ≥ 20 ft', 'ft'),
        it('earth.esQ', s.esQ, 'Earth surcharge ES', 'ksf'), it('earth.hw', s.hw, 'Water table above the bottom of footing', 'ft'),
        it('earth.soilH', shAuto ? '' : s.soilH, shAuto ? 'Retained soil height above the footing (blank = top of backwall − top of footing; equals ' + r3(ctx.soilHAuto) + ' ft)' : 'Retained soil height above the footing', 'ft'),
        it('earth.constrFill', s.constrFill, 'Construction fill above footing (0 = full)', 'ft'), it('earth.gLLc', s.gLLc, 'γ_LS during construction', '')],
        notes: d.info && d.info.kRule && d.info.kRule !== 'active' ? ['The calculator uses the earth pressure state "' + d.info.kRule + '" (its K rule, panel I-3); SubLoads keeps its own theory above (' + s.method + '). The K rule is not carried.'] : [] };
    } else gerr.soil = gerr.soil || 'not sent';
    const a = d.approachSlab;
    if (a) {
      if (!a.on) G.aps = { scope: 'unit', items: [it('earth.asOn', 'no', 'Approach slab on the backwall')] };
      else { const wAuto = isN(ctx.GWd) && Math.abs(a.W - ctx.GWd) < 0.005;
        G.aps = { scope: 'unit', items: [it('earth.asOn', 'yes', 'Approach slab on the backwall'), it('earth.asW', wAuto ? '' : a.W, wAuto ? 'Approach slab width (blank = the deck width, equals ' + r3(ctx.GWd) + ' ft)' : 'Approach slab width', 'ft'),
          it('earth.asL', a.L, 'Approach slab length', 'ft'), it('earth.asT', a.t * 12, 'Approach slab thickness', 'in'), it('earth.asPct', a.sharePct, 'Share of the slab weight on the abutment', '%')],
          notes: ['Share = the calculator\'s slab reaction R_DC as a % of the slab weight: R_DC / (w_c·t·W·L) = ' + r3(a.RDC) + ' / (' + r3(gc) + ' × ' + r3(a.t) + ' × ' + r3(a.W) + ' × ' + r3(a.L) + ') = ' + r3(a.sharePct) + '% (the calculator takes half the slab, area/2' + (a.sharePct > 50.0005 ? ', with the far end square to the roadway' : '') + '). Not carried: its wearing surface, live load on the slab and the slab model (support, far end, friction, design).'] }; }
    } else gerr.aps = gerr.aps || 'not sent';
    if (d.pad) G.brg = { scope: 'unit', items: [it('elast.L', d.pad.L, 'Pad length (along span)', 'in'), it('elast.W', d.pad.W, 'Pad width (transverse)', 'in'), it('elast.G', d.pad.G, 'Shear modulus G', 'ksi'), it('elast.hrt', d.pad.hrt, 'Total elastomer thickness h_rt', 'in')] };
    else gerr.brg = gerr.brg || 'not sent';
    if (isN(ctx.stemTop)) { const top = ctx.stemTop - st.H, gi2 = [it('topFtg', top, 'Top of footing El. = SubLoads bridge seat ' + r3(ctx.stemTop) + ' − the calculator\'s stem height ' + r3(st.H), 'ft')];
      if (isN(f.Df)) gi2.push(it('ground', top - f.t + f.Df, 'Ground El. = top of footing − t_f + D_f (' + r3(f.Df) + ')', 'ft'));
      G.ftgEl = { scope: 'unit', items: gi2, notes: ['SubLoads keeps its own elevations (deck, girder, bearing and pedestal heights set the seat); this only moves the footing so the stem height matches the calculator.'] }; }
    if (d.seismic || d.concrete) { const bi = [];
      if (d.seismic) bi.push(it('khR', d.seismic.khR, 'Seismic k_h / k_h0', ''), it('kv', d.seismic.kv, 'k_v', ''), it('hEQr', d.seismic.hEQr, 'ΔP_AE height / H', ''));
      if (d.concrete) bi.push(it('wc', d.concrete.gc, 'Concrete unit weight w_c', 'kcf'));
      G.bridgewide = { scope: 'bridge', items: bi, notes: ['These apply to every unit of the bridge, not only this abutment.' + (d.seismic && d.seismic.hEQmode === 'static' ? ' The calculator applies ΔP_AE at the static-pressure height (≥ H/3, 11.6.5.3); SubLoads always applies it at the ratio × H: the ratio sent is the calculator\'s stored ratio, not its static height.' : '')] }; }
    // information rows: [label, the calculator, SubLoads now, why it is not applied]
    const info = [], e = d.elevations;
    info.push(['Skew', r3(d.skewDeg) + '° (magnitude)', isN(ctx.skewDeg) ? r3(ctx.skewDeg) + '°' : '—', 'SubLoads owns the bridge: its skew is kept']);
    info.push(['Adjacent span', fmt(d.spanL) + ' ft', isN(ctx.spanL) ? r3(ctx.spanL) + ' ft' : '—', 'SubLoads owns the bridge: its spans are kept']);
    if (isN(ctx.stemTop) && isN(ctx.topFtg)) info.push(['Stem height (top of footing to seat)', r3(st.H) + ' ft', r3(ctx.stemTop - ctx.topFtg) + ' ft', 'SubLoads derives it from its elevations; tick "Set the top of footing El." to match']);
    if (isN(ctx.stemTop) && isN(ctx.bwTop)) info.push(['Backwall height (seat to top of backwall)', r3(bw.h) + ' ft', r3(ctx.bwTop - ctx.stemTop) + ' ft', 'SubLoads derives it from the deck elevation and the girder, bearing and pedestal heights']);
    if (e && isN(ctx.stemTop)) info.push(['Bridge seat El.', r3(e.seat) + ' ft', r3(ctx.stemTop) + ' ft', 'SubLoads keeps its own elevations']);
    if (e && isN(e.deck) && isN(ctx.deckZ)) info.push(['Top of deck El.', r3(e.deck) + ' ft', r3(ctx.deckZ) + ' ft (at ℄)', 'SubLoads keeps its own elevations']);
    if (d.superstructure && isN(ctx.hbIn)) info.push(['Bearing + pedestal height', fmt(d.superstructure.brgHIn) + ' in', r3(nz(ctx.hbIn) + nz(ctx.hpIn)) + ' in', 'SubLoads owns the bearings']);
    if (d.seismic) info.push(['ΔP_AE height', d.seismic.hEQmode === 'static' ? 'static pressure height (≥ H/3, 11.6.5.3)' : r3(d.seismic.hEQr) + 'H', 'ratio × H (bridge-wide)', 'different definitions; not aligned by this pull']);
    if (d.seismic) info.push(['Site coefficient A_s', fmt(d.seismic.As), 'from the SubLoads site inputs', 'SubLoads computes A_s from its own response spectrum']);
    if (d.info && d.info.lsRed != null) info.push(['LS with an approach slab', d.info.lsRed ? 'reduced (AASHTO 3.11.6.5)' : 'not reduced', 'removed only under MassDOT rules', 'different definitions; not aligned by this pull']);
    info.push(['Height of TU / WS / WL forces', 'bridge seat', 'top of bearing', 'different definitions; not aligned by this pull']);
    info.push(['Wingwalls', d.info && d.info.wingwalls && d.info.wingwalls.length ? d.info.wingwalls.join('; ') : 'none', 'none (SubLoads has no wingwalls)', 'listed only']);
    if (d.info && d.info.refined && d.info.refined.length) info.push(['Refined calculator inputs', d.info.refined.join('; '), '—', 'calculator only: not sent']);
    return { groups: G, gerr, info, labAuto, ftgAuto };
  }

  /* rows(items, get): current vs incoming; get(path) -> the receiver's current value */
  function rows(items, get) {
    const blank = v => v === '' || v == null;
    return (items || []).map(x => { const c = get(x.path), a = num(c), b = num(x.val);
      const same = blank(c) || blank(x.val) ? blank(c) && blank(x.val) : (isN(a) && isN(b) && typeof c !== 'boolean' && typeof x.val !== 'boolean' ? Math.abs(a - b) < 5e-4 : String(c) === String(x.val));
      return { path: x.path, lbl: x.lbl, cur: fmt(c === undefined ? null : c), inc: fmt(x.val), chg: !same, ...(x.note ? { note: x.note } : {}) }; });
  }
  function summary(p) {
    try { const d = p.definition, L = d.lengths, f = d.footing;
      return (d.name ? d.name + ': ' : '') + 'L_ab ' + r3(L.Lab) + ' ft, stem ' + r3(d.stem.tTop) + (Math.abs(d.stem.tBot - d.stem.tTop) > 1e-6 ? '–' + r3(d.stem.tBot) : '') + ' × ' + r3(d.stem.H) + ' ft, footing ' + r3(f.W) + ' × ' + r3(f.t) + ' ft'; }
    catch (e) { return ''; }
  }

  const API = { VER, SCHEMA, UNITS, OWNER, fromSubLoads, fromLoads, fromAbutment, validate, checkPayload, toAbutment, toSubLoads, rows, summary, hash, fmt };
  if (typeof window !== 'undefined') window.SharedAbutmentDef = API;
})();
