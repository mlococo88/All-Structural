/* apps/steel-bridge/ui/fatigue.js — the "Fatigue & studs" input tab and the "Fatigue & studs" output tab (window.SBDFatigueUI), from
   engine/fatigue.js and engine/studs.js. Classic script; needs SharedSteps, SharedUnits, SBDModel, SBDOwners, SBDSections, SBDFlexure,
   SBDShear, SBDStiffeners, SBDFatigue, SBDStuds.

   Inputs (saved in the project, P.fatigue and P.studs): the traffic and fatigue limit state, the flange detail categories (GS17), the
   distortion-induced fatigue details, the studs, the field splice plates, the b_eff option (bridge-wide as GirderDetail, or per girder) and
   the pitch zones (empty: the zones of the hand-off file, or GirderDetail's built-in zones in the example).
   Demands (until the analysis module lands), as the Flexure and Shear tabs: either
     - "Example": GirderDetail's built-in Fatigue details (GM.fa.def rows) and Shear connectors zones and regions (GM.sc.def), with this
       project's fatigue settings, studs, deck and b_eff; GS17 needs a file; or
     - a hand-off file (schema stgirder-external-demands, GirderDetail → ST-Girder): GS17 at every station GirderDetail checks; the fatigue
       details of this girder (engine/fatigue.js detailsFromPayload); the studs per zone and region as GirderDetail sends them (fromPayload),
       with this project's stud inputs, splices and pitch zones where entered (V_f of a zone entered here: the largest V_FAT,pos − V_FAT,neg
       of the file's stations in the zone).
   The demand choice is not saved.

   inputs(P, h, ui) / onClick(e, P, ui) for the input tab; render(host, ctx) for the output tab, ctx = { P, g }; build(ctx) (tests). */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (x, d) => window.SharedUnits.fmt(x, d);
  const S = { src: 'analysis', pl: null, plName: '', R: null, key: '', err: '', sel: null };
  const cls = r => !isFinite(r) ? '' : r > 1 + 1e-9 ? 'fx-ng' : r >= 0.9 ? 'fx-hi' : 'fx-ok';
  const CATS = ['A', 'B', "B'", 'C', "C'", 'D', 'E', "E'"], ct = c => String(c).replace(/'/g, '′');

  /* ---------- input tab ---------- */
  function ensure(P) { const M = window.SBDModel; if (!P.fatigue) P.fatigue = M.defaultFatigue(); if (!P.studs) P.studs = M.defaultStuds(); return P; }
  function inputs(P, h) {
    ensure(P); const Z = P.studs.zones || [];
    return h.card('Traffic and fatigue limit state (6.6.1.2)', `${h.sel('fatigue.limit', 'Fatigue limit state', [['auto', 'By ADTT (Fatigue I where ADTT_SL ≥ the infinite-life equivalent)'], ['I', 'Fatigue I (infinite life) for every detail'], ['II', 'Fatigue II (finite life) for every detail']])}
        ${h.num('fatigue.ADTT', 'ADTT, one direction', 'trucks/day')}${h.num('fatigue.p', 'Lane fraction p', '')}${h.num('fatigue.life', 'Design life', 'years')}
        ${h.num('fatigue.gam.fI', 'γ Fatigue I', '')}${h.num('fatigue.gam.fII', 'γ Fatigue II', '')}
        ${h.sel('fatigue.catT', 'Top flange category (GS17)', CATS.map(c => [c, ct(c)]))}${h.sel('fatigue.catB', 'Bottom flange category (GS17)', CATS.map(c => [c, ct(c)]))}
        ${h.sel('fatigue.negSec', 'Negative-moment section at the details', [['cracked', 'Steel + reinforcement (conservative)'], ['uncracked', 'Short-term composite (deck effective)']])}
        <p class="note">ADTT<sub>SL</sub> = p × ADTT (3.6.1.4.2). These settings apply to the whole bridge: the details (FA1), the flange stress range (GS17) and the studs (SC1) use Fatigue I or II as decided here, as GirderDetail's Fatigue module does.</p>`)
      + h.card('Distortion-induced fatigue (6.6.1.3)', `${h.sel('fatigue.dist.cp', 'Connection plates attached to both flanges', [['yes', 'Yes'], ['no', 'No'], ['na', 'No connection plates']])}${h.sel('fatigue.dist.skew', 'Skewed or oblique welded attachments', [['no', 'No'], ['yes', 'Yes']])}
        ${h.sel('fatigue.dist.lat', 'Lateral bracing', [['no', 'None'], ['yes', 'Yes']])}${h.sel('fatigue.dist.latLoc', 'Lateral connection plates on', [['flange', 'Flange'], ['web', 'Web']])}
        ${h.sel('fatigue.dist.latStiff', 'Web stiffened at the plate', [['yes', 'Yes'], ['no', 'No']])}${h.num('fatigue.dist.latDist', 'Vertical distance from flange', 'in')}${h.num('fatigue.dist.latBf', 'Flange width at the plate', 'in')}`)
      + h.card('Shear connectors: studs (6.10.10)', `${h.sel('studs.d', 'Stud diameter', [[0.75, '3/4 in'], [0.875, '7/8 in'], [1, '1 in']])}${h.num('studs.h', 'Stud height h', 'in')}${h.num('studs.st', 'Transverse spacing s<sub>t</sub>', 'in')}${h.num('studs.Fu', 'Stud F<sub>u</sub>', 'ksi')}
        ${h.num('studs.Qn10', 'Q<sub>n</sub> entered (0 = Eq. 6.10.10.4.3-1)', 'kip')}${h.num('studs.gamFat', 'γ Fatigue I (studs)', '')}
        ${h.sel('studs.skew', 'Radial term F<sub>fat</sub> = F<sub>rc</sub>/w', [['auto', 'Auto: a support skewed more than 20°'], ['yes', 'Yes (skewed > 20° or curved)'], ['no', 'No']])}${h.num('studs.Frc', 'Cross-frame force range F<sub>rc</sub>', 'kip')}${h.num('studs.wv', 'Effective deck length w', 'in')}
        ${h.num('studs.splX', 'Field splice stations (no studs over the plates)', 'ft', { text: true })}${h.num('studs.splL', 'Top splice plate length', 'ft')}${h.num('studs.splC', 'Clearance at each plate end', 'in')}
        ${h.sel('studs.beffMode', 'b<sub>eff</sub> for the studs', [['girder', 'Each girder its own b_eff (6.10.10; default)'], ['bridge', 'Bridge-wide, as GirderDetail (one set of zones)']])}
        <p class="note">GirderDetail checks one set of pitch zones and strength regions for the whole bridge, with one b<sub>eff</sub> (the girder with the largest fatigue shear range, usually the exterior). "Each girder its own b<sub>eff</sub>" is an option, off by default; the difference is reported on the output tab. Splice stations: comma separated; with a hand-off file and none entered, the file's splice gaps are used.</p>`)
      + h.card('Pitch zones', `${Z.length ? `<div class="tscroll"><table class="tbl"><thead><tr><th>From (ft)</th><th>To (ft)</th><th>Studs per row</th><th>Pitch (in)</th><th></th></tr></thead><tbody>
          ${Z.map((z, i) => `<tr>${['x1', 'x2', 'nr', 'p'].map(k => `<td><input type="number" step="${k === 'nr' ? 1 : 'any'}" data-path="studs.zones.${i}.${k}" data-kind="num" value="${esc(z[k])}" aria-label="zone ${i + 1} ${k}"></td>`).join('')}<td><button type="button" data-fzdel="${i}" title="Remove this zone">×</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="note">No zones entered: the hand-off file\'s pitch zones (or GirderDetail\'s built-in zones in the example) are used.</p>'}
        <button type="button" id="fz_add">Add zone</button>${Z.length ? ' <button type="button" id="fz_clear">Clear (use the file\'s zones)</button>' : ''}
        <p class="note">Stations from the left end of the girder. The plates of each zone are taken at its middle; V<sub>f</sub> from the demands (see the output tab).</p>`);
  }
  function onClick(e, P) {
    ensure(P); const Z = P.studs.zones, t = e.target;
    if (t.id === 'fz_add') { const L = (P.spans.lengths || []).reduce((a, b) => a + (+b || 0), 0), x1 = Z.length ? Z[Z.length - 1].x2 : 0; Z.push({ x1, x2: Math.min(L || x1 + 10, x1 + 10), nr: 3, p: 12 }); return true; }
    if (t.id === 'fz_clear') { P.studs.zones = []; return true; }
    const d = t.closest && t.closest('[data-fzdel]'); if (d) { Z.splice(+d.dataset.fzdel, 1); return true; }
    return false;
  }

  /* ---------- demands from this app's analysis (engine/analysis.js) ---------- */
  /* fromAnalysis(P, gi): the analysis of girder gi as a hand-off-shaped object (stations, supports, plate zones, deck, materials), so the
     same paths as a file run on it. Shears are magnitudes here (the sign is not used by these checks). Without pitch zones in the project,
     the zones and strength regions are made the way Preliminary sizing makes them for GirderDetail (detailExport): each span in tenths;
     per zone n_r = max(2, min(4, ⌊(b_tf − 2 − d)/4⌋ + 1)), V_f the largest fatigue shear range (V_FAT,pos − V_FAT,neg) of the stations in
     the zone, pitch p = max(6d, min(24, ⌊2 p_req⌋/2)) with p_req = n_rZ_r/(1.75V_fQ/I), Z_r = 7.0A_sc (Fatigue I); regions from each
     support to the point of maximum Strength I positive moment of the span. b_eff for the studs: the first exterior girder's of the project
     (GirderDetail: the girder type with the largest fatigue shear range, usually the exterior), or this girder's. */
  function fromAnalysis(P, gi) {
    const AN = window.SBDAnalysis, FA = window.SBDFatigue, FX = window.SBDFlexure, Q = P.studs, M = window.SBDModel;
    if (!AN) return { err: 'The analysis module is not loaded.' };
    let R; try { R = AN.analyzeGirder(P, gi); } catch (e) { return { err: 'Analysis: ' + (e && e.message) }; }
    if (R.errors && R.errors.length) return { err: 'Analysis: ' + R.errors.join(' ') };
    if (!R.fat || !R.ll) return { err: 'Analysis: no live load results.' };
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
    // studs: the project's zones (build() takes them over), or Preliminary sizing's auto zones and regions
    const dd = +Q.d, Zr = 7.0 * Math.PI * dd * dd / 4, segAt = x => g.segments.find(s => x >= s.x0 - 1e-9 && x < s.x1) || g.segments[g.segments.length - 1];
    const n = window.SBDSections.modularRatio(m.concrete.fc, m.concrete.wc, m.concrete.K1, m.concrete.nRule).n, r1 = v => +(+v).toFixed(1), r2 = v => +(+v).toFixed(2);
    const vRng = (a, b) => Math.max(0, ...stations.filter(s => s.x >= a - 1e-9 && s.x <= b + 1e-9).map(s => s.V_FATpos - s.V_FATneg));
    const zs = [], qz = [];
    R.spans.forEach((L, k) => { const x0 = R.sup[k]; for (let z = 0; z < 10; z++) { const a = x0 + z * L / 10, b = a + L / 10, s = segAt((a + b) / 2), S = FA.secSet(s.D, s, { ts: d.ts, hh: h0 ? 0 : d.haunch, beff: beffB, n, Ar: 0, dr: 0 }), c = S.cn, Qs = beffB * d.ts / n * (S.ySlab - c.yb);
      const nr = Math.max(2, Math.min(4, Math.floor((s.topB - 2 - dd) / 4) + 1)), vr = r1(vRng(a, b)), preq = vr > 0 ? nr * Zr / (1.75 * vr * Qs / c.I) : 48, p = Math.max(6 * dd, Math.min(24, Math.floor(preq * 2) / 2));
      zs.push({ x1: r2(a), x2: r2(b), nr, p }); qz.push({ name: `Span ${k + 1}, ${z / 10}L to ${(z + 1) / 10}L`, Vfr: vr }); } });
    const G = FX.factors(), Mup = stations.map(s => FX.envelopeStrI({ DC1: s.M_DC1, DC2: s.M_DC2, DW: s.M_DW, LLp: s.M_LLpos, LLn: s.M_LLneg, UT: s.M_UT, UF: s.M_UF }, G).max), ns = R.spans.length, supN = k => k === 0 ? 'Abut. 1' : k === ns ? 'Abut. 2' : `Pier ${k}`;
    const regions = []; R.spans.forEach((L, k) => { const x0 = R.sup[k]; let xm = x0 + L / 2, mx = -Infinity; stations.forEach((s, i) => { if (s.x > x0 && s.x < x0 + L && Mup[i] > mx) { mx = Mup[i]; xm = s.x; } });
      [[x0, k], [x0 + L, k + 1]].forEach(([xs0, ks]) => regions.push({ name: `${supN(ks)} to max. positive, Span ${k + 1}`, kind: ks > 0 && ks < ns && R.cont ? 'pier' : 'end', x1: r2(Math.min(xs0, xm)), x2: r2(Math.max(xs0, xm)) })); });
    pl.girderDetail.details.studs = { d: dd, h: Q.h, Fu: Q.Fu, transverseSpacing: Q.st, zones: zs, results: { zones: qz, regions, gaps: [], beff: beffB, gamI: Q.gamFat, QnEntered: false } };
    pl.girderDetail.details.fatigue = { ADTT: P.fatigue.ADTT, p: P.fatigue.p, life: P.fatigue.life, limit: P.fatigue.limit };
    return { pl, R };
  }

  /* ---------- calculation ---------- */
  function build(ctx) {
    const P = ensure(ctx.P), M = window.SBDModel, OW = window.SBDOwners, FA = window.SBDFatigue, SC = window.SBDStuds, FX = window.SBDFlexure, SB = window.SBDStiffeners, g = ctx.g || 0;
    let pl = ctx.pl !== undefined ? ctx.pl : S.src === 'file' ? S.pl : null;
    if (ctx.pl === undefined && S.src === 'file' && !pl) return { err: 'Choose a hand-off file (GirderDetail → ST-Girder demands, .json).' };
    if (ctx.pl === undefined && S.src === 'analysis') { const A = fromAnalysis(P, g); if (A.err) return A; pl = A.pl; }
    const F = P.fatigue, Q = P.studs, own = P.ownerRules || { owner: 'AASHTO', eta: {} }, lf = OW.loadFactors(own.owner, own.eta, (P.xs && P.xs.nb) || 0);
    const set = FA.settings(F), m = P.materials, G = P.girders[g] || P.girders[0];
    let sup = [0]; P.spans.lengths.forEach(L => sup.push(+(sup[sup.length - 1] + +L).toFixed(6)));
    if (pl) sup = (pl.member || {}).supports || sup;
    const spans = sup.slice(1).map((x, k) => x - sup[k]), cont = pl ? sup.length > 2 : P.spans.continuity === 'continuous' && sup.length > 2, B = FA.supports({ ok: true, spans, cont });
    const env = { owner: own.owner, lf, fat: { set, B } };
    // ---- fatigue details (FA1–FA7)
    const pg = pl ? pl.girderDetail || {} : null, dk = pg ? pg.deck || {} : null, pm = pg ? pg.materials || {} : null;
    const frames = (P.stiffeners && P.stiffeners.layout && P.stiffeners.layout.frames && P.stiffeners.layout.frames.at) || SB.framesDefault(sup, (P.stiffeners && P.stiffeners.layout && P.stiffeners.layout.frames && P.stiffeners.layout.frames.Lb) || 25);
    const splX = String(Q.splX || '').split(/[,;\s]+/).map(Number).filter(v => isFinite(v) && v > 0);
    const plSpl = pl ? (((pg.details || {}).studs || {}).results || {}).gaps || [] : [];
    const rows = pl ? FA.detailsFromPayload(pl, { frames, stiffened: !P.stiffeners || P.stiffeners.layout.web !== 'unstiffened', splices: splX.length ? splX : plSpl.map(q => q.x) }) : JSON.parse(JSON.stringify(FA.DEFAULT.rows));
    const faIn = { limit: F.limit, gam: { ...F.gam }, ADTT: F.ADTT, p: F.p, life: F.life, gW: m.steel.web, negSec: F.negSec, dist: { ...F.dist }, ev: { on: 'no' },
      ts: pl ? dk.ts : P.deck.ts, hh: pl ? dk.haunch : P.deck.haunch, beff: pl ? dk.beff : G.beff, fc: pl ? +pm.fc : m.concrete.fc, wc: pl ? +pm.wc || 0.15 : m.concrete.wc, K1: pl ? 1 : m.concrete.K1, nRule: pl ? 'exact' : m.concrete.nRule,
      Ar: pl ? +dk.Ar || 0 : (P.deck.rebar.top.A || 0) + (P.deck.rebar.bot.A || 0), dr: pl ? dk.ts / 2 : P.deck.ts / 2, rows };
    const FR = FA.compute(faIn, { owner: own.owner, lf }), FC = FR.errors.length ? null : FA.checks(FR);
    // ---- GS17 (file only): every station GirderDetail checks
    let gs17 = null;
    if (pl) { const d = FX.fromPayload(pl, { owner: own.owner }), Gr = FX.girder(d.locs, d.prj, { supports: d.supports });
      gs17 = Gr.rows.map(r => ({ r, o: FA.flange(r, { set, B, catT: F.catT, catB: F.catB }) })); }
    // ---- studs (SC1–SC7)
    let scIn, scEnv = env;
    if (pl) { const d0 = SC.fromPayload(pl, { beffMode: Q.beffMode }); if (!d0) return { err: 'The hand-off file has no stud results (GirderDetail Shear connectors, S2-6): re-export it from GirderDetail.' }; scIn = d0.p; }
    else { scIn = JSON.parse(JSON.stringify(SC.DEFAULT)); Object.assign(scIn, { ts: P.deck.ts, hh: P.deck.haunch, tdeck: P.deck.tdeck, fc: m.concrete.fc, wc: m.concrete.wc, K1: m.concrete.K1, nRule: m.concrete.nRule, gF: m.steel.top, gW: m.steel.web,
      beff: Math.max(...P.girders.map(q => +q.beff || 0)) || G.beff, ...(Q.beffMode === 'girder' ? { beffMode: 'girder', beffG: G.beff } : {}) }); }
    Object.assign(scIn, { d: String(Q.d), h: Q.h, st: Q.st, Fu: Q.Fu, Qn10: Q.Qn10, gam: { fat: Q.gamFat }, Frc: Q.Frc, wv: Q.wv });
    if (Q.skew !== 'auto') scIn.skew = Q.skew; else if (!pl) scIn.skew = (P.xs && (P.xs.skews || []).some(s => Math.abs(s) > 20)) ? 'yes' : 'no';
    if (splX.length) Object.assign(scIn, { splX: splX.join(', '), splL: Q.splL, splC: Q.splC });
    if ((Q.zones || []).length) { const zAt = pl ? window.SBDShear.demands(pl).zAt : (x => { const s = G.segments.find(q => x >= q.x0 - 1e-9 && x < q.x1) || G.segments[G.segments.length - 1]; return { D: s.D, tw: s.tw, topB: s.topB, topT: s.topT, botB: s.botB, botT: s.botT }; });
      const St = pl ? pl.stations || [] : [], vf = (a, b) => Math.max(0, ...St.filter(s => +s.x >= a - 1e-9 && +s.x <= b + 1e-9).map(s => (+s.V_FATpos || 0) - (+s.V_FATneg || 0)));
      const ex = JSON.parse(JSON.stringify(SC.DEFAULT.zones)), vEx = (a, b) => Math.max(0, ...ex.filter(z => Math.min(z.x2, b) > Math.max(z.x1, a)).map(z => z.Vfr));
      scIn.zones = Q.zones.map((z, i) => ({ name: `Zone ${i + 1}, ${fmt(z.x1, 2)} to ${fmt(z.x2, 2)} ft`, x1: z.x1, x2: z.x2, nr: z.nr, p: z.p, Vfr: pl ? vf(z.x1, z.x2) : vEx(z.x1, z.x2), ...zAt((z.x1 + z.x2) / 2) })); }
    const SR = SC.compute(scIn, scEnv), SCC = SR.errors.length ? null : SC.checks(SR);
    // the other b_eff mode, for the comparison line (GirderDetail open question)
    let alt = null; if (!SR.errors.length) { const q = JSON.parse(JSON.stringify(scIn)); if (SR.beffMode === 'girder') { delete q.beffMode; delete q.beffG; } else { q.beffMode = 'girder'; q.beffG = pl ? dk.beff : G.beff; }
      const A = SC.compute(q, scEnv); if (!A.errors.length) { const C = SC.checks(A), mx = (CK, id) => Math.max(0, ...CK.find(c => c.id === id).items.map(i => i.r).filter(isFinite)); alt = { beff: A.dk.beff, sc1: mx(C, 'SC1'), sc2: mx(C, 'SC2'), sc1o: mx(SCC, 'SC1'), sc2o: mx(SCC, 'SC2') }; } }
    // governing of each list
    const gov = (C, skip) => { let b = null; (C || []).forEach(c => c.items.forEach((it, i) => { if (skip && skip(c, it)) return; if (isFinite(it.r) && it.r != null && (it.st === 'pass' || it.st === 'fail') && (!b || it.r > b.it.r)) b = { c, it, i }; })); return b; };
    const g17 = gs17 ? gs17.reduce((b, q, i) => { q.o.items.forEach(it => { if (!b || it.r > b.it.r) b = { it, i }; }); return b; }, null) : null;
    return { pl: !!pl, set, B, cats: { T: F.catT, B: F.catB }, FR, FC, faGov: gov(FC, c => c.id === 'FA4'), gs17, g17, SR, SCC, scGov: gov(SCC, c => c.id === 'SC6' && false), alt, env,
      what: pl && pl._schema === 'sbd2-analysis' ? `This project's analysis of ${esc((pg || {}).label || '')} (engine/analysis.js): ${(pl.stations || []).length} stations, ${sup.length - 1} span(s); fatigue moments and shears per girder (fatigue truck, IM, single-lane factors); ${(Q.zones || []).length ? 'the pitch zones of this project' : 'pitch zones and strength regions made as Preliminary sizing makes them for GirderDetail (span tenths)'}; b<sub>eff</sub> for the studs ${Q.beffMode === 'girder' ? 'this girder\'s' : 'the exterior girder\'s (bridge-wide)'}.`
        : pl ? `${esc(S.plName)}: ${(pl.stations || []).length} stations, ${sup.length - 1} span(s), ${esc((pg || {}).label || '')}; fatigue moments and shears, plates and deck from the file; the stud zones and regions GirderDetail sends${(Q.zones || []).length ? ' (pitch zones from this project)' : ''}; this project's fatigue settings and studs.`
        : 'Example: GirderDetail\'s built-in Fatigue details and Shear connectors zones and regions, with this project\'s fatigue settings, studs, deck and materials. GS17 at every station needs a hand-off file.' };
  }
  const key = ctx => JSON.stringify([ctx.P, ctx.g, S.src, S.plName]);

  /* ---------- output tab ---------- */
  function css() {
    if (document.getElementById('fx-css') && document.getElementById('fa-css')) return;
    const st = document.createElement('style'); st.id = 'fa-css';
    st.textContent = `.fx-ok{background:#e7f4ec;} .fx-hi{background:#fdf3d8;} .fx-ng{background:#fbe1dd;font-weight:600;} tr.fx-gov td:first-child{box-shadow:inset 4px 0 0 #b23a2a;}
      .fx-list{max-height:300px;overflow:auto;} .fx-list tr{cursor:pointer;} .fx-na{color:#64748b;font-style:italic;}`;
    document.head.appendChild(st);
  }
  function render(host, ctx) {
    css();
    const stale = !S.R || S.key !== key(ctx), opt = (v, t, cur) => `<option value="${v}"${String(cur) === String(v) ? ' selected' : ''}>${t}</option>`;
    let h = `<section class="sec"><div class="secHead">Fatigue &amp; studs: demands</div><div class="secBody">
      <div class="fRow"><label for="fa_src">Demands</label><select id="fa_src">${opt('analysis', 'This project\'s analysis (Analysis tab)', S.src)}${opt('example', 'Example (GirderDetail built-in details and zones)', S.src)}${opt('file', 'Hand-off file (GirderDetail → ST-Girder)', S.src)}</select></div>
      ${S.src === 'file' ? `<div class="fRow"><label for="fa_file">File</label><input type="file" id="fa_file" accept=".json,application/json"><span class="unit">${esc(S.plName)}</span></div>` : ''}
      <p class="note">Fatigue moments and shears are the unfactored fatigue truck with IM and the single-lane distribution factor (3.6.1.4); γ is applied here (Fatigue I or II, Table 3.4.1-1). Inputs: the Fatigue &amp; studs input tab.</p></div></section>`;
    h += `<div class="alert stale"${stale ? '' : ' hidden'}><span>Fatigue results are out of date: inputs changed or nothing calculated yet.</span><button type="button" class="primary" id="fa_calc">Calculate</button></div>`;
    if (S.err && !stale) h += `<div class="alert err">${esc(S.err)}</div>`;
    else if (S.R && !stale) h += results(S.R);
    host.innerHTML = h;
    const on = (id, ev, f) => { const el = host.querySelector('#' + id); if (el) el.addEventListener(ev, f); }, redraw = () => render(host, ctx);
    on('fa_src', 'change', e => { S.src = e.target.value; redraw(); });
    on('fa_calc', 'click', () => { S.err = ''; S.R = null; try { const R = build(ctx); if (R.err) S.err = R.err; else { S.R = R; S.sel = defaultSel(R); } } catch (er) { S.err = 'Calculation error: ' + (er && er.message); } S.key = key(ctx); redraw(); });
    on('fa_file', 'change', e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader();
      rd.onload = () => { try { const j = JSON.parse(String(rd.result)), pl = j.payload || j; if (!pl || pl._schema !== 'stgirder-external-demands' || !Array.isArray(pl.stations)) throw new Error('not a GirderDetail → ST-Girder hand-off file (schema stgirder-external-demands)');
        S.pl = pl; S.plName = f.name; S.err = ''; } catch (er) { S.pl = null; S.plName = ''; alert('Cannot read this file: ' + er.message); } redraw(); };
      rd.readAsText(f); });
    host.querySelectorAll('.fx-list').forEach(el => el.addEventListener('click', e => { const tr = e.target.closest('[data-fa]'); if (!tr) return; const [k, i] = tr.dataset.fa.split(':'); S.sel = { k, i: +i }; redraw(); }));
    host.querySelectorAll('[data-go]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); const [k, i, id] = a.dataset.go.split(':'); S.sel = { k, i: +i }; redraw(); const t = host.querySelector('#st-' + (id || '').replace(/[^\w.-]/g, '')); if (t) t.scrollIntoView({ block: 'center' }); }));
  }
  function defaultSel(R) {
    const c = [];
    if (R.faGov) c.push({ k: 'fa', i: R.FR.rows.findIndex(r => R.faGov.it.step && R.faGov.it.step.startsWith(`fa${r.i}.`)), r: R.faGov.it.r });
    if (R.g17) c.push({ k: 'gs', i: R.g17.i, r: R.g17.it.r });
    if (R.SCC) c.push({ k: 'sc', i: 0, r: R.scGov ? R.scGov.it.r : 0 });
    return c.reduce((a, b) => (!a || b.r > a.r ? b : a), null) || { k: 'sc', i: 0 };
  }
  const stepsHtml = list => `<ol class="steps">${list.map(s => `<li id="st-${esc(s.id)}"${s.ok === false ? ' class="no"' : ''}><div class="lbl">${esc(s.label)}${s.ref ? `<span class="ref">${esc(s.ref)}</span>` : ''}</div><div>${window.SharedSteps.line(s, true)}</div>${s.note ? `<div class="nt">${esc(s.note)}</div>` : ''}</li>`).join('')}</ol>`;
  const go = (k, i, id, txt) => `<a class="wk" href="#st-${esc(id)}" data-go="${k}:${i}:${esc(id)}">${txt || '§'}</a>`;
  const stCell = st => `<td class="${st === 'fail' ? 'fx-ng' : st === 'warn' ? 'fx-hi' : st === 'na' ? 'fx-na' : 'fx-ok'}">${{ pass: 'OK', fail: 'Fail', warn: 'Warning', adv: 'Advisory', na: 'n/a' }[st] || esc(st)}</td>`;
  function results(R) {
    const FA = window.SBDFatigue, SC = window.SBDStuds;
    let h = '';
    const gl = [];
    if (R.faGov) gl.push([R.faGov.it.r, `${esc(R.faGov.it.loc)}: ${esc(R.faGov.c.id)} ${esc(R.faGov.c.title)}`, go('fa', R.FR.rows.findIndex(r => R.faGov.it.step.startsWith(`fa${r.i}.`)), R.faGov.it.step), 'Fatigue details']);
    if (R.g17) gl.push([R.g17.it.r, `${esc(R.g17.it.loc)}: GS17 flange stress range (Category ${ct(R.g17.it.cat)}, Fatigue ${R.g17.it.lim})`, go('gs', R.g17.i, R.g17.it.step), 'Flanges, every station']);
    if (R.scGov) gl.push([R.scGov.it.r, `${esc(R.scGov.it.loc)}: ${esc(R.scGov.c.id)} ${esc(R.scGov.c.title)}`, go('sc', 0, R.scGov.it.step), 'Studs']);
    const top = gl.reduce((a, b) => (!a || b[0] > a[0] ? b : a), null);
    h += `<section class="sec"><div class="secHead">Fatigue &amp; studs: governing</div><div class="secBody"><p class="note">${R.what}</p>
      <p class="note">${esc(FA.setText(R.set))}.</p>
      ${top ? `<p>Governing ratio <b class="${cls(top[0])}">${fmt(top[0], 3)}</b>: ${top[1]} ${top[2]}</p>` : ''}
      <div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Group</th><th class="lft">Governing item</th><th>Ratio</th><th></th></tr></thead><tbody>
      ${gl.map(q => `<tr><td class="lft">${q[3]}</td><td class="lft">${q[1]}</td><td class="${cls(q[0])}">${fmt(q[0], 3)}</td><td>${q[2]}</td></tr>`).join('')}</tbody></table></div>
      ${R.FR.errors.length ? `<div class="alert err">Fatigue: ${R.FR.errors.map(esc).join('; ')}</div>` : ''}${R.SR.errors.length ? `<div class="alert err">Shear connectors: ${R.SR.errors.map(esc).join('; ')}</div>` : ''}</div></section>`;
    // fatigue details
    if (!R.FR.errors.length) { const C = R.FC, ck = id => C.find(c => c.id === id);
      h += `<section class="sec"><div class="secHead">Fatigue details (FA1, FA2, FA3; 6.6.1.2, 6.10.5.3)</div><div class="secBody"><p class="note">ADTT<sub>SL</sub> = ${fmt(R.FR.ADTTSL, 0)} trucks/day. Each detail: Fatigue I where ADTT<sub>SL</sub> is at least its infinite-life equivalent, else Fatigue II. Exempt: net compression under the permanent loads (FA2).</p>
        <div class="tscroll fx-list"><table class="tbl"><thead><tr><th class="lft">Detail</th><th>Cat.</th><th>n</th><th>Limit state</th><th>γ(Δf) (ksi)</th><th>(ΔF)<sub>n</sub> (ksi)</th><th>FA1</th><th>FA3</th></tr></thead><tbody>
        ${R.FR.rows.map((r, i) => { const a = ck('FA1').items[i], v = ck('FA3').items.find(it => it.step === `fa${r.i}.okV`); return `<tr data-fa="fa:${i}" class="${S.sel && S.sel.k === 'fa' && S.sel.i === i ? 'sel' : ''}"><td class="lft">${esc(r.name)}${r.exempt ? ' (exempt)' : ''}</td><td>${ct(r.cat)}</td><td>${r.nn}</td><td>Fatigue ${r.lim}</td><td>${fmt(r.dem, 2)}</td><td>${fmt(r.res, 2)}</td><td class="${r.exempt ? 'fx-ok' : cls(a.r)}">${r.exempt ? 'exempt' : fmt(a.r, 3)}</td>${v ? `<td class="${cls(v.r)}">${fmt(v.r, 3)}</td>` : '<td class="fx-na">n/a</td>'}</tr>`; }).join('')}
        </tbody></table></div><p class="note">${C.filter(c => !['FA1', 'FA2', 'FA3'].includes(c.id)).map(c => `${esc(c.id)} ${esc(c.title)}: ${c.items.length ? c.items.map(it => `${esc(it.loc)} — ${{ pass: 'OK', fail: 'fails', warn: 'warning', na: 'n/a' }[it.st]}`).join('; ') : esc(c.naWhy)}`).join('. ')}.</p></div></section>`; }
    // GS17
    if (R.gs17) h += `<section class="sec"><div class="secHead">Flange stress range at every station (GS17; 6.6.1.2, 6.10.5.1)</div><div class="secBody"><p class="note">Top flange Category ${ct(R.cats.T)}, bottom flange Category ${ct(R.cats.B)}; the Fatigue I ranges are those of the Flexure tab; n by station (Table 6.6.1.2.5-1).</p>
      <div class="tscroll fx-list"><table class="tbl"><thead><tr><th class="lft">Station</th><th>n</th><th>Top: limit state</th><th>Top ratio</th><th>Bottom: limit state</th><th>Bottom ratio</th></tr></thead><tbody>
      ${R.gs17.map((q, i) => `<tr data-fa="gs:${i}" class="${S.sel && S.sel.k === 'gs' && S.sel.i === i ? 'sel' : ''}${R.g17 && R.g17.i === i ? ' fx-gov' : ''}"><td class="lft">${esc(q.r.name)}</td><td>${q.o.fatN}</td><td>Fatigue ${q.o.fatT.lim}</td><td class="${cls(q.o.items[0].r)}">${fmt(q.o.items[0].r, 3)}</td><td>Fatigue ${q.o.fatB.lim}</td><td class="${cls(q.o.items[1].r)}">${fmt(q.o.items[1].r, 3)}</td></tr>`).join('')}
      </tbody></table></div></div></section>`;
    // studs
    if (!R.SR.errors.length) { const Sr = R.SR, C = R.SCC, ck = id => C.find(c => c.id === id) || { items: [] };
      h += `<section class="sec"><div class="secHead">Shear connectors (6.10.10): ${Sr.zones.length} pitch zones, ${Sr.regions.length} strength regions</div><div class="secBody">
        <p class="note">Studs ${fmt(Sr.d, 3)} × ${fmt(Sr.h, 2)} in: Q<sub>r</sub> = ${fmt(Sr.Qr, 2)} kip ${go('sc', 0, 'sc.Qr')}, Z<sub>r</sub> (Fatigue I) = ${fmt(Sr.Zr, 3)} kip ${go('sc', 0, 'sc.ZrI')}; b<sub>eff</sub> = ${fmt(Sr.dk.beff, 2)} in (${Sr.beffMode === 'girder' ? 'this girder\'s own, 6.10.10 (default)' : 'bridge-wide, as GirderDetail (option)'}) ${go('sc', 0, 'sc.beff')}; F<sub>fat</sub> = ${fmt(Sr.Ffat, 4)} kip/in.</p>
        ${R.alt ? `<p class="note">For comparison: with ${Sr.beffMode === 'girder' ? 'the bridge-wide (GirderDetail)' : 'this girder\'s own'} b<sub>eff</sub> = ${fmt(R.alt.beff, 2)} in the largest SC1 ratio would be ${fmt(R.alt.sc1, 3)} (now ${fmt(R.alt.sc1o, 3)}) and the largest SC2 ratio ${fmt(R.alt.sc2, 3)} (now ${fmt(R.alt.sc2o, 3)}).</p>` : ''}
        <div class="tscroll fx-list"><table class="tbl"><thead><tr><th class="lft">Zone</th><th>Studs</th><th>V<sub>f</sub> (kip)</th><th>Limit state</th><th>Z<sub>r</sub> (kip)</th><th>V<sub>sr</sub> (kip/in)</th><th>p<sub>max</sub> (in)</th><th>SC1</th><th>SC3</th><th>SC4</th></tr></thead><tbody>
        ${Sr.zones.map((z, i) => { const a = ck('SC1').items[i], b = ck('SC3').items[i], c4 = ck('SC4').items.filter(it => it.step && it.step.startsWith(`scz${z.i}.`)), w4 = c4.reduce((x, it) => it.st === 'fail' ? 'fail' : x, 'pass');
          return `<tr data-fa="sc:${i}"><td class="lft">${esc(z.name)} ${go('sc', 0, `scz${z.i}.ok`)}</td><td>${z.nr} @ ${fmt(z.p, 2)} in</td><td>${fmt(z.Vfr, 1)}</td><td>Fatigue ${z.fat.lim}</td><td>${fmt(z.Zr, 3)}</td><td>${fmt(z.Vsr, 3)}</td><td>${fmt(z.preq, 2)}</td><td class="${cls(a.r)}">${fmt(a.r, 3)}</td>${stCell(b.st)}${stCell(w4)}</tr>`; }).join('')}
        </tbody></table></div>
        <div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Region</th><th>P (kip)</th><th>n required</th><th>n provided</th><th>SC2</th><th>SC6 (splices)</th></tr></thead><tbody>
        ${Sr.regions.map((r, i) => { const a = ck('SC2').items[i], b = ck('SC6').items.find(it => it.step === `scr${r.i}.net`);
          return `<tr><td class="lft">${esc(r.name)} ${go('sc', 0, `scr${r.i}.ok`)}</td><td>${fmt(r.P, 1)}</td><td>${fmt(r.nreq, 2)}</td><td>${r.nprov}${r.lost ? ` − ${r.lost}` : ''}</td><td class="${cls(a.r)}">${fmt(a.r, 3)}</td>${b ? `<td class="${cls(b.r)}">${fmt(b.r, 3)}</td>` : '<td class="fx-na">n/a</td>'}</tr>`; }).join('')}
        </tbody></table></div><p class="note">${C.filter(c => ['SC5', 'SC7'].includes(c.id)).map(c => `${esc(c.id)} ${esc(c.title)}: ${c.items.map(it => `${esc(it.loc)} — ${it.st === 'pass' ? 'OK' : 'fails'}`).join('; ')}`).join('. ')}. ${ck('SC6').naWhy ? 'SC6: ' + esc(ck('SC6').naWhy) : ''}</p></div></section>`; }
    // worked steps of the selection
    const sel = S.sel || { k: 'sc', i: 0 }; let title = '', list = [];
    if (sel.k === 'fa' && R.FR.rows && R.FR.rows[sel.i]) { const r = R.FR.rows[sel.i]; title = r.name; list = FA.steps(R.FR, r); }
    else if (sel.k === 'gs' && R.gs17 && R.gs17[sel.i]) { const q = R.gs17[sel.i]; title = `${q.r.name} (GS17)`; list = q.o.steps; }
    else if (!R.SR.errors.length) { title = 'shear connectors'; list = SC.steps(R.SR); }
    if (list.length) h += `<section class="sec"><div class="secHead">Worked steps, ${esc(title)}</div><div class="secBody"><p class="note">Click a row above to show its work. AASHTO LRFD 10th Ed. (2024).</p>${stepsHtml(list)}</div></section>`;
    return h;
  }

  window.SBDFatigueUI = { ensure, inputs, onClick, render, build };
})();
