/* apps/steel-bridge/ui/rating.js — the "Rating" output tab (window.SBDRatingUI): the LRFR design-load rating (HL-93 Inventory and
   Operating, Strength I flexure and shear, Service II) from engine/rating.js, with the condition and system factors as its inputs.
   Classic script; needs SharedSteps, SharedUnits, SBDModel, SBDOwners, SBDSections, SBDFlexure, SBDShear, SBDStiffeners, SBDShearUI,
   SBDAnalysis, SBDRating (SBDFatigue optional: the fatigue RF of the owner's target).

   Inputs (saved in the project, P.rating): φ_c (MBE Table 6A.4.2.3-1) and φ_s (Table 6A.4.2.4-1).
   Demands, as the Fatigue & studs tab: either
     - "This app's analysis" (default): engine/analysis.js for the selected girder, put in the shape of a hand-off (every analysis
       station), with this project's plates, deck, materials, cross-frame spacing and stiffener layout; or
     - a hand-off file (schema stgirder-external-demands, GirderDetail → ST-Girder): its stations, plates and deck; the project's
       stiffener layout (as the Shear & stiffeners tab).
   Capacities: the Flexure tab's locations and the Shear tab's stations (SBDShearUI.build: V_n with the stiffener layout). Since
   2026-10-30 (paths PR, SB2-W1, SB2-W2) the flexure is ui/flexure.js build() itself (Appendix A6 where permitted), so its brace points
   (the Framing tab) and f_ℓ (entered on the Flexure tab, else from skew, C6.10.1: engine/framing.js design) are the Flexure tab's on
   both sources; before, this tab built its own: the stiffener layout's cross-frames and f_ℓ = 0 (a file: its own spacing, f_ℓ = 0).
   Needs SBDFlexureUI and SBDFraming. The demand choice is not saved.

   render(host, ctx), ctx = { P, g, changed() }; build(ctx) (tests: ctx.pl gives a payload directly; ctx.src 'analysis'). */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (x, d) => window.SharedUnits.fmt(x, d);
  const S = { src: null, pl: null, plName: '', R: null, key: '', err: '', sel: 0 };   // src null: the default, this app's analysis (no example here)
  const srcOf = () => S.src || 'analysis';
  const PHI_C = [[1.00, 'Good or satisfactory (1.00)'], [0.95, 'Fair (0.95)'], [0.85, 'Poor (0.85)']];
  const PHI_S = [[1.00, 'All other girder bridges and slab bridges (1.00)'], [0.85, 'Welded members in two-girder, truss or arch bridges (0.85)'], [0.90, 'Riveted members in two-girder, truss or arch bridges (0.90)'],
    [0.85, 'Three-girder bridges, girder spacing ≤ 6 ft (0.85)'], [0.95, 'Four-girder bridges, girder spacing ≤ 4 ft (0.95)'], [0.85, 'Floorbeams > 12 ft apart, noncontinuous stringers (0.85)'], [1.00, 'Redundant stringer subsystems between floorbeams (1.00)']];
  // SB2-R2: −∞ (amplification undefined, 6.10.1.6) and NaN (an error) are shown and fail; +∞ = no live-load effect (—)
  const rfTxt = v => v === -Infinity ? '−∞ (NG: f_bu ≥ F_cr, amplification undefined (6.10.1.6))' : Number.isNaN(v) ? 'error: RF is NaN' : !isFinite(v) ? '—' : fmt(v, 2),
    cls = v => v === -Infinity || Number.isNaN(v) ? 'fx-ng' : !isFinite(v) ? '' : v < 1 - 1e-9 ? 'fx-ng' : v < 1.1 ? 'fx-hi' : 'fx-ok';

  function ensure(P) { if (!P.rating) P.rating = window.SBDModel.defaultRating(); return P.rating; }

  /* fromAnalysis(P, gi): the analysis of girder gi as a hand-off-shaped object: per station the moments, and the shears of the side of the
     station with the larger permanent shear (both sides differ only at a support), LL+IM shear envelopes the larger of the two sides
     (positive and negative); plates; deck, materials, skews and the cross-frame spacing of the project. Shears in this app's sign
     (engine/analysis.js: positive at the left end of a span); shearCases uses each direction, so the sign convention does not matter. */
  function fromAnalysis(P, gi) {
    const AN = window.SBDAnalysis, M = window.SBDModel;
    if (!AN) return { err: 'The analysis module is not loaded.' };
    let R; try { R = AN.analyzeGirder(P, gi); } catch (e) { return { err: 'Analysis: ' + (e && e.message) }; }
    if (R.errors && R.errors.length) return { err: 'Analysis: ' + R.errors.join(' ') };
    if (!R.ll) return { err: 'Analysis: no live load results.' };
    // LL+IM with the pedestrian load added once (SBDAnalysis.llPL; pedestrianInLL true, M_PL / V_PL its part, as GirderDetail's hand-off; sb-ped-owner PR)
    const g = P.girders[gi], st = R.st, ll = AN.llPL ? AN.llPL(R) : R.ll, q = R.pl, f = R.fat, Mof = (o, i) => (o ? o.M[i] : 0);
    const stations = R.x.map((x, i) => {
      const perm = k => (st.DC1[k][i] + st.DC2[k][i] + st.DW[k][i]), side = Math.abs(perm('VL')) > Math.abs(perm('VR')) ? 'VL' : 'VR', V = (o) => (o ? o[side][i] : 0);
      return { x, M_DC1: st.DC1.M[i], M_DC2: st.DC2.M[i], M_DW: st.DW.M[i], M_LLpos: ll.Mpos[i], M_LLneg: ll.Mneg[i], M_UT: Mof(st.UT, i), M_UF: Mof(st.UF, i),
        M_FATpos: f ? f.Mpos[i] : 0, M_FATneg: f ? f.Mneg[i] : 0, V_DC1: V(st.DC1), V_DC2: V(st.DC2), V_DW: V(st.DW), V_UT: V(st.UT), V_UF: V(st.UF),
        V_LLpos: Math.max(ll.VRpos[i], ll.VLpos[i]), V_LLneg: Math.min(ll.VRneg[i], ll.VLneg[i]),
        V_FATpos: f ? Math.max(f.VRpos[i], f.VLpos[i]) : 0, V_FATneg: f ? Math.min(f.VRneg[i], f.VLneg[i]) : 0,
        ...(q ? { M_PLpos: q.Mpos[i], M_PLneg: q.Mneg[i], V_PLpos: Math.max(q.VRpos[i], q.VLpos[i]), V_PLneg: Math.min(q.VRneg[i], q.VLneg[i]) } : {}) }; });
    const zones = g.segments.map(s => ({ startX: s.x0, endX: s.x1, web: { depth: s.D, thickness: s.tw }, topFlange: { width: s.topB, thickness: s.topT }, botFlange: { width: s.botB, thickness: s.botT } }));
    const m = P.materials, d = P.deck, sk = ((P.xs || {}).skews || []).slice();
    const pl = { _schema: 'sbd2-analysis', pedestrianInLL: !!q, stations, member: { supports: R.sup.slice(), spans: R.spans.slice() }, section: { zones },
      ownerRules: { owner: (P.ownerRules || {}).owner || 'AASHTO', haunchInProperties: !R.h0 },
      girderDetail: { label: g.label || g.id, girder: gi + 1, position: g.position, materials: { Fyf: M.GRADES[m.steel.top].Fy, Fyw: M.GRADES[m.steel.web].Fy, fc: m.concrete.fc, wc: m.concrete.wc },
        deck: { ts: d.ts, haunch: d.haunch, beff: g.beff, Ar: (d.rebar.top.A || 0) + (d.rebar.bot.A || 0) }, bracing: { Lb: (P.stiffeners && P.stiffeners.layout.frames.Lb) || 25 },
        skew: { bySupport: sk, max: Math.max(0, ...sk.map(Math.abs)) }, details: {} } };
    return { pl, R };
  }

  /* ---------- calculation ---------- */
  function build(ctx) {
    const P = ctx.P, M = window.SBDModel, OW = window.SBDOwners, FX = window.SBDFlexure, SH = window.SBDShear, RT = window.SBDRating, SB = window.SBDStiffeners, g = ctx.g || 0;
    const rt = ensure(P), src = ctx.src || srcOf();
    let pl = ctx.pl !== undefined ? ctx.pl : src === 'file' ? S.pl : null, AR = null;
    if (ctx.pl === undefined && src === 'file' && !pl) return { err: 'Choose a hand-off file (GirderDetail → ST-Girder demands, .json).' };
    if (ctx.pl === undefined && src === 'analysis') { const A = fromAnalysis(P, g); if (A.err) return A; pl = A.pl; AR = A.R; }
    const fromAn = !!AR, own = fromAn ? (P.ownerRules || {}).owner || 'AASHTO' : (pl.ownerRules || {}).owner || 'AASHTO';
    const plR = RT.noDoublePL(pl), sup = (pl.member || {}).supports || [];
    // flexure: the Flexure module itself (ui/flexure.js build; SB2-W1, SB2-W2): its locations (every station), brace points (Framing tab)
    // and f_ℓ (entered on the Flexure tab, else from skew); with this app's analysis the project's grades, deck and owner rules
    const Gr = window.SBDFlexureUI.build(fromAn ? { P, g, src: 'analysis', an: { pl, R: AR }, method: 'auto' } : { P, g, src: 'file', pl, plName: S.plName || 'hand-off', method: 'auto' });
    if (Gr.err) return { err: 'Flexure: ' + Gr.err };
    const F = { prj: Gr.prj };
    // shear: the Shear tab's stations (V_n with the stiffener layout), demands by direction
    const SHR = window.SBDShearUI.build({ P, g, pl: plR });
    if (SHR.err) return { err: 'Shear: ' + SHR.err };
    const cases = RT.shearCases(pl), ph = RT.phi(rt.phiC, rt.phiS), G = RT.factors(), opt = { G, phi: ph, mat: F.prj.mat };
    const rows = [], cap = new Map();   // cap: rating row -> the capacity location (its worked steps)
    Gr.rows.forEach(r => { RT.flexure(r, opt).forEach(q => { cap.set(q, r); rows.push(q); }); RT.service(r, opt).forEach(q => { cap.set(q, r); rows.push(q); }); });
    SHR.stations.forEach(r => { const q = RT.shear(r, { ...opt, cases: cases(r.x) }); cap.set(q, r); rows.push(q); });
    // fatigue (owner target only, GS20): 1/ratio of GS17 at every flexure location
    const T = RT.target(own);
    if (T && T.fat && window.SBDFatigue && P.fatigue) { const FA = window.SBDFatigue, set = FA.settings(P.fatigue), spans = sup.slice(1).map((x, k) => x - sup[k]), B = FA.supports({ ok: true, spans, cont: sup.length > 2 });
      if (set.ok) Gr.rows.forEach(r => { const o = FA.flange(r, { set, B, catT: P.fatigue.catT, catB: P.fatigue.catB }); (o.items || []).forEach(it => { if (it.r > 0 && isFinite(it.r)) { const q = RT.fatigue(it, r); cap.set(q, r); rows.push(q); } }); }); }
    const sum = RT.girder(rows, { owner: own });
    const bfl = `L<sub>b</sub>, C<sub>b</sub> ${Gr.frB ? `from the Framing tab (G${Gr.frB.line + 1}'s bearings and cross-frames)` : fromAn ? "from the stiffener layout's cross-frames (no framing)" : "from the file's cross-frame spacing (not this project's bridge, or no framing)"}; f<sub>ℓ</sub> = ${fmt(Gr.fl, 2)} ksi ${Gr.D && Gr.D.flSrc === 'entered' ? 'as entered on the Flexure tab' : `from skew (C6.10.1; largest support skew ${fmt(Gr.flS.skMax, 1)}°)`}, as on the <a href="#" data-gotab="flex">Flexure tab</a>`;
    const what = fromAn ? `This app's analysis of ${esc(P.girders[g].label || P.girders[g].id)}: ${pl.stations.length} stations, ${sup.length - 1} span(s); the project's plates, deck, materials and stiffener layout; ${bfl}.`
      : `${esc(S.plName || 'hand-off')}: ${pl.stations.length} stations, ${sup.length - 1} span(s), G${esc((pl.girderDetail || {}).girder || '')}; plates, deck and skews from the file, the project's stiffener layout; ${bfl}.${pl.pedestrianInLL === true ? ' The pedestrian load is in its LL+IM (pedestrianInLL): not added again.' : ''}`;
    return { rows, sum, cap, ph, G, own, T, what, flex: Gr, shear: SHR, pl };
  }
  const key = ctx => JSON.stringify([ctx.P, ctx.g, srcOf(), S.plName]);

  /* ---------- output tab ---------- */
  function css() {
    if (document.getElementById('rt-css')) return;
    const st = document.createElement('style'); st.id = 'rt-css';
    st.textContent = `.fx-ok{background:#e7f4ec;} .fx-hi{background:#fdf3d8;} .fx-ng{background:#fbe1dd;font-weight:600;} tr.fx-gov td:first-child{box-shadow:inset 4px 0 0 #b23a2a;}
      .fx-list{max-height:340px;overflow:auto;} .fx-list tr{cursor:pointer;} .fx-na{color:#64748b;font-style:italic;}
      .rt-box{display:flex;gap:10px;flex-wrap:wrap;margin:6px 0;} .rt-box>div{border:1px solid var(--line);border-radius:6px;padding:6px 10px;min-width:150px;} .rt-box .n{font-size:15pt;font-weight:600;} .rt-box .l{font-family:var(--font-ui);font-size:8.5pt;color:#475569;}`;
    document.head.appendChild(st);
  }
  const GRP = [['flexP', 'Flexure, positive (Strength I)'], ['flexN', 'Flexure, negative (Strength I)'], ['shear', 'Shear (Strength I)'], ['svc', 'Service II (permanent deformation)'], ['fat', 'Fatigue (owner target only)']];
  function render(host, ctx) {
    css();
    const P = ctx.P, rt = ensure(P), stale = !S.R || S.key !== key(ctx), opt = (v, t, cur) => `<option value="${v}"${String(cur) === String(v) ? ' selected' : ''}>${t}</option>`;
    const phc = PHI_C.some(([v]) => v === +rt.phiC) ? +rt.phiC : 'other', phs = PHI_S.findIndex(([v]) => v === +rt.phiS);
    const phsSel = phs < 0 ? -1 : S.phsI != null && PHI_S[S.phsI] && PHI_S[S.phsI][0] === +rt.phiS ? S.phsI : phs;   // φ_s repeats a value: the row chosen
    const AUI = window.SBDAnalysisUI, AN = window.SBDAnalysis, gl = P.girders[ctx.g] || P.girders[0] || {};
    let h = (AUI && AUI.srcBar ? AUI.srcBar({ src: srcOf(), auto: !S.src, rd: AN && AN.ready ? AN.ready(P, P.girders[ctx.g] ? ctx.g : 0) : null, g: gl.label || gl.id, plName: S.plName }) : '')
      + `<section class="sec"><div class="secHead">Load rating: factors and demands</div><div class="secBody">
      <div class="fRow"><label for="rt_phiC">Condition factor φ<sub>c</sub></label><select id="rt_phiC">${PHI_C.map(([v, t]) => opt(v, t, phc)).join('')}${phc === 'other' ? opt('other', `Entered (${fmt(rt.phiC, 2)})`, 'other') : ''}</select><span class="unit">MBE Table 6A.4.2.3-1</span></div>
      <div class="fRow"><label for="rt_phiS">System factor φ<sub>s</sub></label><select id="rt_phiS">${PHI_S.map(([v, t], i) => opt(i, t, phsSel)).join('')}${phs < 0 ? opt(-1, `Entered (${fmt(rt.phiS, 2)})`, -1) : ''}</select><span class="unit">MBE Table 6A.4.2.4-1</span></div>
      <div class="fRow"><label for="rt_src">Demands</label><select id="rt_src">${opt('analysis', "This app's analysis (Analysis tab)", srcOf())}${opt('file', 'Hand-off file (GirderDetail → ST-Girder)', srcOf())}</select></div>
      ${srcOf() === 'file' ? `<div class="fRow"><label for="rt_file">File</label><input type="file" id="rt_file" accept=".json,application/json"><span class="unit">${esc(S.plName)}</span></div>` : ''}
      <p class="note">LRFR design-load rating, HL-93 (MBE 6A.4.2): RF = (C − γ<sub>DC</sub>DC − γ<sub>DW</sub>DW ± γ<sub>P</sub>P)/(γ<sub>LL</sub>(LL+IM)), C = φ<sub>c</sub>φ<sub>s</sub>φR<sub>n</sub> with φ<sub>c</sub>φ<sub>s</sub> ≥ 0.85.
        Strength I: γ<sub>DC</sub> 1.25, γ<sub>DW</sub> 1.50, γ<sub>LL</sub> 1.75 Inventory, 1.35 Operating; Service II: γ<sub>D</sub> 1.00, γ<sub>LL</sub> 1.30 / 1.00 (Table 6A.4.2.2-1). No owner η or design load multiplier (GirderDetail GS20).
        Capacities from the <a href="#" data-gotab="flex">Flexure</a> and <a href="#" data-gotab="shear">Shear &amp; stiffeners</a> modules (AASHTO LRFD 10th Ed.). φ<sub>c</sub>, φ<sub>s</sub> are saved with the project; the demand choice is not. Legal and permit vehicles are not rated.</p></div></section>`;
    h += `<div class="alert stale"${stale ? '' : ' hidden'}><span>Rating results are out of date: inputs changed or nothing calculated yet.</span><button type="button" class="primary" id="rt_calc">Calculate</button></div>`;
    if (S.err && !stale) h += `<div class="alert err">${esc(S.err)}</div>`;
    else if (S.R && !stale) h += results(S.R);
    host.innerHTML = h;
    const on = (id, ev, f) => { const el = host.querySelector('#' + id); if (el) el.addEventListener(ev, f); }, redraw = () => render(host, ctx);
    const save = () => { if (ctx.changed) ctx.changed(); else redraw(); };
    on('rt_phiC', 'change', e => { if (e.target.value === 'other') return; rt.phiC = +e.target.value; save(); });
    on('rt_phiS', 'change', e => { const i = +e.target.value; if (!(i >= 0)) return; S.phsI = i; rt.phiS = PHI_S[i][0]; save(); });
    on('rt_src', 'change', e => { S.src = e.target.value; redraw(); });
    on('rt_calc', 'click', () => { S.err = ''; S.R = null; try { const R = build(ctx); if (R.err) S.err = R.err; else { S.R = R; const gi = R.sum.gov.inv; S.sel = gi ? R.rows.indexOf(gi) : 0; } } catch (er) { S.err = 'Calculation error: ' + (er && er.message); } S.key = key(ctx); redraw(); });
    on('rt_file', 'change', e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader();
      rd.onload = () => { try { const j = JSON.parse(String(rd.result)), pl = j.payload || j; if (!pl || pl._schema !== 'stgirder-external-demands' || !Array.isArray(pl.stations)) throw new Error('not a GirderDetail → ST-Girder hand-off file (schema stgirder-external-demands)');
        S.pl = pl; S.plName = f.name; S.err = ''; } catch (er) { S.pl = null; S.plName = ''; alert('Cannot read this file: ' + er.message); } redraw(); };
      rd.readAsText(f); });
    host.querySelectorAll('[data-gotab]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); const b = document.querySelector(`#tabBar [data-otab="${el.dataset.gotab}"]`); if (b) b.click(); }));
    host.querySelectorAll('.fx-list').forEach(el => el.addEventListener('click', e => { const tr = e.target.closest('[data-rt]'); if (!tr) return; S.sel = +tr.dataset.rt; redraw(); }));
    host.querySelectorAll('[data-rtgo]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); S.sel = +a.dataset.rtgo; redraw(); const t = host.querySelector('#rt-steps'); if (t) t.scrollIntoView({ block: 'start' }); }));
  }
  const stepsHtml = list => `<ol class="steps">${list.map(s => `<li id="st-${esc(s.id)}"${s.ok === false ? ' class="no"' : ''}><div class="lbl">${esc(s.label)}${s.ref ? `<span class="ref">${esc(s.ref)}</span>` : ''}</div><div>${window.SharedSteps.line(s, true)}</div>${s.note ? `<div class="nt">${esc(s.note)}</div>` : ''}</li>`).join('')}</ol>`;
  const grpOf = q => q.kind === 'flex' ? (q.region === 'pos' ? 'flexP' : 'flexN') : q.kind;
  function results(R) {
    const s = R.sum, gi = s.gov.inv, go = s.gov.opr, idx = q => R.rows.indexOf(q), lk = q => q ? ` <a class="wk" href="#rt-steps" data-rtgo="${idx(q)}">§</a>` : '';
    let h = `<section class="sec"><div class="secHead">Load rating: governing (HL-93 design load)</div><div class="secBody"><p class="note">${R.what}</p>
      <div class="rt-box"><div class="${cls(gi && gi.inv)}"><div class="l">Inventory RF (governing)</div><div class="n">${gi ? rfTxt(gi.inv) : '—'}</div><div class="l">${gi ? `${esc(gi.title)}, ${esc(gi.name)}` : ''}${lk(gi)}</div></div>
        <div class="${cls(go && go.opr)}"><div class="l">Operating RF (governing)</div><div class="n">${go ? rfTxt(go.opr) : '—'}</div><div class="l">${go ? `${esc(go.title)}, ${esc(go.name)}` : ''}${lk(go)}</div></div>
        ${s.target && s.tgt && s.tgt.inv ? `<div class="${s.tgt.inv.pass ? 'fx-ok' : 'fx-ng'}"><div class="l">Owner design rating target (${esc(s.target.cite)})</div><div class="n">${rfTxt(s.tgt.inv.rf)} ${s.tgt.inv.pass ? '≥' : '<'} ${fmt(s.tgt.inv.need, 2)}</div><div class="l">HL-93 Inventory; reported, the girder is not resized for it</div></div>` : ''}
        ${s.target && s.tgt && s.tgt.fat ? `<div class="${s.tgt.fat.pass ? 'fx-ok' : 'fx-ng'}"><div class="l">Owner fatigue target</div><div class="n">${rfTxt(s.tgt.fat.rf)} ${s.tgt.fat.pass ? '≥' : '<'} ${fmt(s.tgt.fat.need, 2)}</div><div class="l">1/(GS17 ratio), GirderDetail GS20${lk(s.by.fat)}</div></div>` : ''}</div>
      ${s.target && s.target.kind === 'report' ? `<p class="note">${esc(s.target.cite)}: ${esc(s.target.text)} (reported, no target).</p>` : ''}${s.target && s.target.pend.length ? `<p class="note">Not rated here (vehicles not in this tool): ${s.target.pend.map(esc).join('; ')}.</p>` : ''}
      ${R.ph.floor ? `<div class="alert">φ<sub>c</sub>φ<sub>s</sub> = ${fmt(R.ph.prod, 3)} &lt; 0.85: 0.85 is used at the Strength limit state (MBE Eq. 6A.4.2.1-3).</div>` : ''}
      ${s.oos ? '<div class="alert">A positive-flexure location has its plastic neutral axis below the web (outside Table D6.1-1): its flexure is not rated (out of scope), as on the Flexure tab.</div>' : ''}
      <div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Group</th><th class="lft">Governing location and check</th><th>Inventory RF</th><th>Operating RF</th><th></th></tr></thead><tbody>
      ${GRP.filter(([k]) => s.by[k]).map(([k, t]) => { const q = s.by[k]; return `<tr><td class="lft">${t}</td><td class="lft">${esc(q.name)}: ${esc(q.title)}</td><td class="${cls(q.inv)}">${rfTxt(q.inv)}</td><td class="${q.kind === 'fat' ? '' : cls(q.opr)}">${q.kind === 'fat' ? '—' : rfTxt(q.opr)}</td><td>${lk(q)}</td></tr>`; }).join('')}
      </tbody></table></div></div></section>`;
    h += `<section class="sec"><div class="secHead">Rating factors at every location (${R.rows.length})</div><div class="secBody"><p class="note">C: φ<sub>c</sub>φ<sub>s</sub>φR<sub>n</sub> (Strength) or f<sub>R</sub> (Service II); DC, DW, LL+IM unfactored, in the unit of the check. Click a row for its work.</p>
      <div class="tscroll fx-list"><table class="tbl"><thead><tr><th class="lft">Location</th><th class="lft">Check</th><th>C</th><th>DC</th><th>DW</th><th>LL+IM</th><th>Unit</th><th>RF Inv.</th><th>RF Opr.</th></tr></thead><tbody>
      ${R.rows.map((q, i) => q.oos ? `<tr data-rt="${i}"><td class="lft">${esc(q.name)}</td><td class="lft fx-na" colspan="8">${esc(q.title)}</td></tr>`
        : `<tr data-rt="${i}" class="${i === S.sel ? 'sel' : ''}${q === gi ? ' fx-gov' : ''}"><td class="lft">${esc(q.name)}</td><td class="lft">${esc(q.title)}</td><td>${q.kind === 'fat' ? '' : fmt(q.C, q.unit === 'ksi' ? 2 : 1)}</td><td>${q.kind === 'fat' ? '' : fmt(q.DC, q.unit === 'ksi' ? 2 : 1)}</td><td>${q.kind === 'fat' ? '' : fmt(q.DW, q.unit === 'ksi' ? 2 : 1)}</td><td>${q.kind === 'fat' ? '' : fmt(q.LL, q.unit === 'ksi' ? 2 : 1)}</td><td>${esc(q.unit || '')}</td><td class="${cls(q.inv)}">${rfTxt(q.inv)}</td><td class="${q.kind === 'fat' ? '' : cls(q.opr)}">${q.kind === 'fat' ? '—' : rfTxt(q.opr)}</td></tr>`).join('')}
      </tbody></table></div></div></section>`;
    const q = R.rows[S.sel] || gi;
    if (q && !q.oos) { const r = R.cap.get(q), cst = r ? r.steps : [];
      h += `<section class="sec" id="rt-steps"><div class="secHead">Worked steps, ${esc(q.name)}: ${esc(q.title)}</div><div class="secBody"><p class="note">The rating first (${esc(window.SBDRating.MBE)}), then the ${q.kind === 'shear' ? 'shear' : 'flexure'} work of this location (the same steps as the ${q.kind === 'shear' ? 'Shear &amp; stiffeners' : 'Flexure'} tab), where R<sub>n</sub> is worked. AASHTO LRFD 10th Ed. (2024).</p>
        ${stepsHtml(q.steps)}${cst && cst.length ? `<h4 class="sub" style="font-family:var(--font-ui);font-size:9pt;margin:10px 0 2px">${q.kind === 'shear' ? 'Shear' : 'Flexure'} at ${esc(r.name)}</h4>${stepsHtml(cst)}` : ''}</div></section>`; }
    return h;
  }

  window.SBDRatingUI = { ensure, fromAnalysis, build, render };
})();
