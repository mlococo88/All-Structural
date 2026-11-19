/* apps/steel-bridge/ui/factored.js — the factored diagrams of the Analysis tab and of the Report's Analysis section (window.SBDFactoredUI).
   Classic script, display only (SBFD, 2026-11-19; engineer's request: "the analysis tab shows the unfactored loads which is nice but we also
   need graphs that show factored loads"). Nothing is combined here: every factored value plotted is the demand a check module computes at its
   own locations from this project's analysis, read from that module's result:
     - Strength I moment, max and min: ui/flexure.js build() rows (engine/flexure.js location): M_u of the location's region and M_u,opp,
       the opposite extreme of the moment reversal check (GS19); max = M_u where the region is positive, else M_u,opp; min the other one.
       Each permanent load case takes γ_p max or min by its own sign (Table 3.4.1-2), the owner's η and m as the Flexure tab (factorsOwner).
     - Service II moment: the same rows, M_s (GS12, GS13).
     - Fatigue I moment: the same rows, γ_fat M_FAT+ and γ_fat M_FAT− (GS17; γ_fat the Fatigue & studs input, ui/fatigue.js fatI).
     - Strength I shear: ui/shear.js build() stations (engine/shear.js location): V_u at the location (magnitudes, γ max) and the V_u that GS11
       checks (V_u,panel where the web panel's is larger, 6.10.9.3.1); Fatigue I shear γ_fat V_fat and V_u of the special fatigue requirement (GS18).
     - Deck placement (constructibility): ui/constructibility.js build() rows (engine/constructibility.js location): M_c of each sign case
       (GS14, GS15) and V_u (GS16).
   Reactions: the unfactored reactions of the analysis (the Reactions table) with the Strength I factors of the Flexure tab through
   engine/flexure.js envelopeStrI (the app's Strength I combination of one set of effects), and Service II 1.0 + γ_SII LL+IM; beside them the
   R_u the bearing stiffeners check (BS2–BS4, ui/shear.js build).
   API: compute(P, gi, R, have) -> F (have: { flex, shear, cn } results already built from this project's analysis, else built here; the
   builds share the analysis cache of report/data.js); VIEWS; card(F, o) (HTML of the Analysis tab card; o = { view, chart, wk }); report(F, k)
   (the Report items; k = { chart, note, tbl, steps, N, f }). Units: x ft, M kip-ft, V and R kip. */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (x, d) => window.SharedUnits.fmt(x, d);
  const ED = 'AASHTO LRFD 10th Ed.';
  const VIEWS = [['strI', 'Strength I and Service II (default)'], ['fatI', 'Fatigue I'], ['cn', 'Deck placement (constructibility)']];
  const byX = rows => rows.map((r, i) => ({ r, i })).sort((a, b) => a.r.x - b.r.x || a.i - b.i).map(q => q.r);
  const sName = (k, n) => k === 0 ? 'Abut. 1' : k === n - 1 ? 'Abut. 2' : 'Pier ' + k;
  const num = v => (typeof v === 'number' && isFinite(v) ? v : 0);

  function compute(P, gi, R, have) {
    have = have || {};
    const out = { gi, err: {}, R, P };
    const run = (k, fn) => { try { const r = fn(); if (!r || r.err) { out.err[k] = (r && r.err) || 'Not calculated.'; return null; } return r; } catch (e) { out.err[k] = 'Calculation error: ' + (e && e.message); return null; } };
    const FX = have.flex || (window.SBDFlexureUI ? run('flex', () => window.SBDFlexureUI.build({ P, g: gi, src: 'analysis', method: 'auto' })) : (out.err.flex = 'ui/flexure.js is not loaded.', null));
    const SHr = have.shear || (window.SBDShearUI ? run('shear', () => window.SBDShearUI.build({ P, g: gi, src: 'analysis' })) : (out.err.shear = 'ui/shear.js is not loaded.', null));
    const CN = have.cn || (window.SBDConstrUI ? run('cn', () => window.SBDConstrUI.build({ P, g: gi, src: 'project' })) : (out.err.cn = 'ui/constructibility.js is not loaded.', null));
    if (FX) { const rows = byX(FX.rows), G = FX.prj && FX.prj.G ? FX.prj.G : rows.length ? rows[0].G : null;
      out.M = { rows, x: rows.map(r => r.x), G,
        max: rows.map(r => r.factored ? NaN : r.pos ? r.Mu : r.Mrev), min: rows.map(r => r.factored ? NaN : r.pos ? r.Mrev : r.Mu),
        sv: rows.map(r => r.Ms), fP: rows.map(r => r.gfat * r.MfP), fN: rows.map(r => r.gfat * r.MfN), gfat: rows.length ? rows[0].gfat : NaN }; }
    if (SHr) { const rows = byX(SHr.stations);
      out.V = { rows, x: rows.map(r => r.x), G: SHr.G, Vu: rows.map(r => r.Vu), Vck: rows.map(r => (r.VuP != null ? r.VuP : r.Vu)), Vf: rows.map(r => r.G.fat * r.Vf), VuF: rows.map(r => r.VuF),
        BS: SHr.BS && !SHr.BS.errors.length && !SHr.BS.none ? SHr.BS.rows : null }; }
    if (CN) { const rows = byX(CN.rows), cs = r => (r.cases ? r.cases.map(q => q.Mc) : [r.Mc]);
      out.C = { rows, x: rows.map(r => r.x), G: rows.length ? rows[0].G : null, max: rows.map(r => Math.max(...cs(r))), min: rows.map(r => Math.min(...cs(r))), V: rows.map(r => r.VuC) }; }
    // reactions: the analysis's unfactored reactions (the Reactions table), Strength I through engine/flexure.js envelopeStrI with the Flexure tab's factors
    if (R && R.st && R.llR && out.M && out.M.G && window.SBDFlexure) {
      const G = out.M.G, st = R.st, q = R.pl, mO = +G.m > 0 ? +G.m : 1, n = R.sup.length;
      out.Rx = R.sup.map((x, k) => { const v = o => (o ? num(o.R[k]) : 0), qx = q ? num(q.R[k].max) : 0, qn = q ? num(q.R[k].min) : 0;
        const LLp = num(R.llR[k].max) + qx, LLn = num(R.llR[k].min) + qn, LLpE = LLp - qx + qx / mO, LLnE = LLn - qn + qn / mO;
        const u = { DC1: v(st.DC1), DC2: v(st.DC2), DW: v(st.DW), LLp: LLpE, LLn: LLnE, UT: v(st.UT), UF: v(st.UF) }, E = window.SBDFlexure.envelopeStrI(u, G), perm = u.DC1 + u.DC2 + u.DW + u.UT + u.UF;
        const bs = out.V && out.V.BS ? out.V.BS.find(b => String(b.name).startsWith(sName(k, n) + ',')) : null;
        return { k, x, name: sName(k, n), u, LLp, LLn, max: E.max, min: E.min, svMax: perm + G.sll * LLp, svMin: perm + G.sll * LLn, pl: !!q, Ru: bs ? bs.Ru : null, bsI: bs ? bs.i : null }; });
    }
    return out;
  }

  /* the governing points of a series (largest and smallest value; the first on a tie) */
  const argMax = a => a.reduce((b, v, i) => (isFinite(v) && (b < 0 || v > a[b]) ? i : b), -1);
  const argMin = a => a.reduce((b, v, i) => (isFinite(v) && (b < 0 || v < a[b]) ? i : b), -1);
  const stepOf = (r, id) => (r && r.steps ? r.steps.find(s => s.id === id) : null);
  const gm3 = v => f(v, Math.abs(v * 100 - Math.round(v * 100)) < 1e-9 ? 2 : 3);
  const ownTxt = G => (G && G.own && (G.own.eta !== 1 || G.own.etaN !== 1 || G.own.m !== 1) ? ` Owner load rules${G.own.o ? ` (${G.own.o})` : ''}: η ${gm3(G.own.eta)} on the maximum factors, η ${gm3(G.own.etaN)} on the minimum ones, m ${gm3(G.own.m)} on LL+IM (not on the pedestrian load), as the Flexure tab.` : '');

  /* the text under each chart (plain HTML; sub/sup), the work line (symbolic → factors) and where it is worked */
  function texts(F) {
    const G = F.M ? F.M.G : null, V = F.V ? F.V.G : null, C = F.C ? F.C.G : null;
    return {
      strI: G ? `M<sub>u</sub> = γ<sub>p</sub>M<sub>DC1</sub> + γ<sub>p</sub>M<sub>DC2</sub> + γ<sub>p</sub>M<sub>DW</sub> + γ<sub>LL</sub>M<sub>LL+IM</sub> (+ γ<sub>DW</sub>M<sub>UT</sub> + γ<sub>DC</sub>M<sub>UF</sub>), ${ED} Eq. 3.4.1-1, Tables 3.4.1-1 and 3.4.1-2: γ<sub>p,DC</sub> = ${gm3(G.dc)} max / ${gm3(G.dcMin)} min, γ<sub>p,DW</sub> = ${gm3(G.dw)} / ${gm3(G.dwMin)}, γ<sub>LL</sub> = ${gm3(G.ll)}. Each permanent load case takes γ<sub>p</sub> max where its moment has the sign of the extreme sought and γ<sub>p</sub> min where it has the opposite sign (so in a negative-moment region a positive DC moment takes 0.90); max uses M<sub>LL+IM</sub><sup>+</sup>, min M<sub>LL+IM</sub><sup>−</sup>. The max and min are the Flexure tab's M<sub>u</sub> of each location (step fx.Mu) and the opposite extreme of its moment reversal check GS19 (step fx.rev).${ownTxt(G)}` : '',
      sv: G ? `M<sub>s</sub> = 1.00M<sub>DC1</sub> + 1.00M<sub>DC2</sub> + 1.00M<sub>DW</sub> + γ<sub>LL</sub>M<sub>LL+IM</sub> (+ M<sub>UT</sub> + M<sub>UF</sub>), Service II, ${ED} Table 3.4.1-1: γ<sub>LL</sub> = ${gm3(G.sll)}; M<sub>LL+IM</sub> of the location's region (positive: M<sup>+</sup>, negative: M<sup>−</sup>), as the Flexure tab's Service II checks GS12, GS13 take it (step fx.Ms).` : '',
      V: V ? `V<sub>u</sub> = γ<sub>DC</sub>(V<sub>DC1</sub> + V<sub>DC2</sub>) + γ<sub>DW</sub>V<sub>DW</sub> + γ<sub>LL</sub>V<sub>LL+IM</sub> (+ γ<sub>DW</sub>V<sub>UT</sub> + γ<sub>DC</sub>V<sub>UF</sub>), Strength I, ${ED} Eq. 3.4.1-1, Table 3.4.1-1: γ<sub>DC</sub> = ${gm3(V.dc)}, γ<sub>DW</sub> = ${gm3(V.dw)}, γ<sub>LL</sub> = ${gm3(V.ll)}. Shears are magnitudes with the maximum load factors, as the Shear &amp; stiffeners tab takes them (step sh.Vu); the shear GS11 checks is the larger of V<sub>u</sub> and the largest V<sub>u</sub> in the web panel (6.10.9.3.1, step sh.VuP). A signed envelope with γ<sub>p</sub> min is not used by the shear check and is not plotted.` : '',
      fat: F.M ? `Fatigue I: γM<sub>FAT</sub> and γV<sub>FAT</sub>, ${ED} Table 3.4.1-1: γ = ${gm3(F.M.gfat)} (the Fatigue &amp; studs tab's input) × the fatigue truck with IM ${F.R && F.R.settings ? f(F.R.settings.imf, 0) : 15} % and the fatigue distribution factor (3.6.1.4). The moments are those the Flexure tab's flange fatigue check GS17 takes at each location (step fx.fatT); V<sub>u</sub> of the special fatigue requirement for webs is V<sub>perm</sub> + γV<sub>FAT</sub> (Art. 6.10.5.3, GS18, step sh.VuF). Fatigue II (γ ${window.SBDFatigue && window.SBDFatigue.settings && F.P && F.P.fatigue ? gm3(window.SBDFatigue.settings(F.P.fatigue).gII) : '0.80'}) is applied by the Fatigue &amp; studs tab to its finite-life details only.` : '',
      cn: C ? `M<sub>c</sub> = γ<sub>DC</sub>M<sub>DCc</sub> + γ<sub>CL</sub>M<sub>CL</sub>, V<sub>u</sub> = γ<sub>DC</sub>V<sub>DC1</sub> + γ<sub>CL</sub>V<sub>CL</sub>, deck placement on the noncomposite steel section (${ED} Art. 3.4.2.1, 6.10.3): γ<sub>DC</sub> = ${gm3(C.cdc)}, γ<sub>CL</sub> = ${gm3(C.ccl)}${C.eta && C.eta !== 1 ? ` (with the owner's η ${gm3(C.eta)})` : ''}; M<sub>DCc</sub> the noncomposite envelope of the deck placement sequence where it runs, else M<sub>DC1</sub>; M<sub>CL</sub> the construction live load (with the finishing machine where entered). Where both signs occur at a location both cases are checked; max and min are those two cases (the Constructibility tab, steps cn.Mc, cn.Vu).` : '' };
  }

  /* ---------- the Analysis tab card ---------- */
  function card(F, o) {
    const chart = o.chart, view = VIEWS.some(v => v[0] === o.view) ? o.view : 'strI', T = texts(F), sup = F.R ? F.R.sup : [];
    const L = (tab, t) => `<a href="#" data-gotab="${tab}">${t}</a>`;
    const mk = (xs, ys, i, t, c) => (i >= 0 ? { x: xs[i], y: ys[i], t: `${t} ${f(ys[i], 1)} at x = ${f(xs[i], 2)} ft`, c } : null);
    const work = (r, id, where) => { const s = stepOf(r, id); return s ? `<div class="note fd-work">Worked at x = ${f(r.x, 2)} ft: ${window.SharedSteps.line(s, true)} (${where}, ${esc(r.name)}, step ${esc(s.id)}).</div>` : ''; };
    const na = k => `<p class="note">Not available: ${esc(F.err[k] || 'not calculated')}.</p>`;
    let h = `<div class="fRow"><label for="an_fac">Combination</label><select id="an_fac">${VIEWS.map(([v, t]) => `<option value="${v}"${v === view ? ' selected' : ''}>${t}</option>`).join('')}</select><span class="unit">per girder, this project's analysis</span></div>`;
    if (view === 'strI') {
      if (F.M) { const M = F.M, iX = argMax(M.max), iN = argMin(M.min), iS = argMax(M.sv.map(Math.abs));
        h += chart(M.x, [{ name: 'M_u max', y: M.max, c: '#DC2626' }, { name: 'M_u min', y: M.min, c: '#2563EB', dash: '4 3' }], { title: 'Strength I moment envelope, max and min (factored, per girder)', unit: 'kip-ft', sup, mark: [mk(M.x, M.max, iX, 'max', '#DC2626'), mk(M.x, M.min, iN, 'min', '#2563EB')].filter(Boolean) });
        h += `<p class="note">${T.strI} Worked at every location: ${L('flex', 'Flexure tab')}.</p>${work(M.rows[iX], M.rows[iX] && M.rows[iX].pos ? 'fx.Mu' : 'fx.rev', 'Flexure tab')}${work(M.rows[iN], M.rows[iN] && M.rows[iN].pos ? 'fx.rev' : 'fx.Mu', 'Flexure tab')}`;
        h += chart(M.x, [{ name: 'M_s Service II', y: M.sv, c: '#059669' }], { title: 'Service II moment (factored, per girder)', unit: 'kip-ft', sup, mark: [mk(M.x, M.sv, iS, 'largest', '#059669')].filter(Boolean) });
        h += `<p class="note">${T.sv} Worked at every location: ${L('flex', 'Flexure tab')}.</p>${work(M.rows[iS], 'fx.Ms', 'Flexure tab')}`;
      } else h += na('flex');
      if (F.V) { const V = F.V, iV = argMax(V.Vck);
        h += chart(V.x, [{ name: 'V_u checked (GS11)', y: V.Vck, c: '#DC2626' }, { name: 'V_u at the location', y: V.Vu, c: '#B45309', dash: '4 3' }], { title: 'Strength I shear (factored magnitude, per girder)', unit: 'kip', sup, mark: [mk(V.x, V.Vck, iV, 'largest', '#DC2626')].filter(Boolean) });
        h += `<p class="note">${T.V} Worked at every station: ${L('shear', 'Shear &amp; stiffeners tab')}.</p>${work(V.rows[iV], 'sh.Vu', 'Shear &amp; stiffeners tab')}`;
      } else h += na('shear');
    } else if (view === 'fatI') {
      if (F.M) { const M = F.M, iP = argMax(M.fP), iN = argMin(M.fN);
        h += chart(M.x, [{ name: 'γM_FAT+', y: M.fP, c: '#7C3AED' }, { name: 'γM_FAT−', y: M.fN, c: '#7C3AED', dash: '4 3' }], { title: 'Fatigue I moment (factored, per girder; the range is the distance between the lines)', unit: 'kip-ft', sup, mark: [mk(M.x, M.fP, iP, 'max', '#7C3AED'), mk(M.x, M.fN, iN, 'min', '#7C3AED')].filter(Boolean) });
        const dR = M.fP.map((v, i) => v - M.fN[i]), iR = argMax(dR);
        h += `<p class="note">Largest factored moment range γ(M<sup>+</sup> − M<sup>−</sup>) = ${f(M.fP[iR], 1)} − (${f(M.fN[iR], 1)}) = <b>${f(dR[iR], 1)} kip-ft</b> at x = ${f(M.x[iR], 2)} ft. ${T.fat} Worked at every location: ${L('flex', 'Flexure tab')} (GS17) and the details on the ${L('fat', 'Fatigue &amp; studs tab')}.</p>`;
      } else h += na('flex');
      if (F.V) { const V = F.V, iF = argMax(V.Vf);
        h += chart(V.x, [{ name: 'γV_FAT (magnitude)', y: V.Vf, c: '#7C3AED' }, { name: 'V_u special fatigue (GS18)', y: V.VuF, c: '#0891B2', dash: '4 3' }], { title: 'Fatigue I shear (factored, per girder)', unit: 'kip', sup, mark: [mk(V.x, V.Vf, iF, 'largest', '#7C3AED')].filter(Boolean) });
        h += `<p class="note">Worked at every station: ${L('shear', 'Shear &amp; stiffeners tab')} (step sh.VuF).</p>${work(V.rows[argMax(V.VuF)], 'sh.VuF', 'Shear &amp; stiffeners tab')}`;
      } else h += na('shear');
    } else {
      if (F.C) { const C = F.C, iX = argMax(C.max), iN = argMin(C.min), iV = argMax(C.V);
        h += chart(C.x, [{ name: 'M_c max', y: C.max, c: '#B45309' }, { name: 'M_c min', y: C.min, c: '#1E3A5F', dash: '4 3' }], { title: 'Deck placement moment (factored, steel section, per girder)', unit: 'kip-ft', sup, mark: [mk(C.x, C.max, iX, 'max', '#B45309'), mk(C.x, C.min, iN, 'min', '#1E3A5F')].filter(Boolean) });
        h += chart(C.x, [{ name: 'V_u deck placement (GS16)', y: C.V, c: '#B45309' }], { title: 'Deck placement shear (factored magnitude, per girder)', unit: 'kip', sup, mark: [mk(C.x, C.V, iV, 'largest', '#B45309')].filter(Boolean) });
        h += `<p class="note">${T.cn} Worked at every location: ${L('cn', 'Constructibility tab')}.</p>${work(C.rows[iX], 'cn.Mc', 'Constructibility tab')}`;
      } else h += na('cn');
    }
    h += `<p class="note">Every value above is a check demand at the check module's own locations (every analysis station; ±0.01 ft at supports and plate changes; 0.01 ft inside the ends), read from that module, not combined again here. The load combinations used: Report, Basis of design, "Load combinations used". Not plotted: Strength III, IV and V and Service I are not used by the girder checks (Strength III and V: the cross-frame wind cases, ${L('cf', 'Cross-frames tab')}; Service I: the live-load deflection, LL+IM alone, ${L('defl', 'Deflection tab')}).</p>`;
    if (F.Rx) h += rxHtml(F, L);
    return h;
  }
  function rxHtml(F, L) {
    const G = F.M.G, anyBS = F.Rx.some(q => q.Ru != null);
    return `<div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Support</th><th>Strength I max</th><th>Strength I min</th><th>Service II max</th><th>Service II min</th>${anyBS ? '<th>R<sub>u</sub>, bearing stiffeners</th>' : ''}</tr></thead><tbody>
      ${F.Rx.map(q => `<tr><td class="lft">${q.name} (x = ${f(q.x, 1)})</td><td>${f(q.max, 2)}</td><td>${f(q.min, 2)}</td><td>${f(q.svMax, 2)}</td><td>${f(q.svMin, 2)}</td>${anyBS ? `<td>${q.Ru != null ? f(q.Ru, 2) : '—'}</td>` : ''}</tr>`).join('')}</tbody></table></div>
      <p class="note">Factored reactions (kip, up +): derived here from the unfactored reactions of the Reactions (unfactored) card on this tab (DC1, DC2, DW, LL+IM max and min${F.Rx.some(q => q.pl) ? ', the pedestrian load added to LL+IM' : ''}${F.Rx.some(q => q.u.UT || q.u.UF) ? ', utilities UT, UF' : ''}) and the same factors: Strength I by engine/flexure.js envelopeStrI (the app's Strength I combination: DC1 + DC2 with γ<sub>p,DC</sub> ${gm3(G.dc)} / ${gm3(G.dcMin)} by the sign of their sum, DW ${gm3(G.dw)} / ${gm3(G.dwMin)} by its sign, γ<sub>LL</sub> ${gm3(G.ll)} on LL+IM max for the max and min for the min; ${ED} Tables 3.4.1-1, 3.4.1-2); Service II R<sub>DC1</sub> + R<sub>DC2</sub> + R<sub>DW</sub> + ${gm3(G.sll)}R<sub>LL+IM</sub>. No check in this app takes these combined reactions except the bearing stiffeners${anyBS ? `, whose R<sub>u</sub> (every component with its maximum factor, step Ru, ${L('shear', 'Shear &amp; stiffeners tab')}) is shown for comparison` : ''}.</p>`;
  }

  /* ---------- the Report items (report/builders.js an()) ---------- */
  function report(F, k) {
    const { chart, note, tbl, steps, N } = k, T = texts(F), sup = F.R ? F.R.sup : [], items = [];
    const plain = h => String(h || '').replace(/<sub>(.*?)<\/sub>/g, (m, a) => `$_{${a.replace(/<[^>]+>/g, '')}}$`).replace(/<sup>(.*?)<\/sup>/g, (m, a) => `$^{${a.replace(/<[^>]+>/g, '')}}$`).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    const one = (sc, r, id) => { const s = stepOf(r, id); return s ? { sc, s, r } : null; };
    const W = [];
    if (F.M) { const M = F.M, iX = argMax(M.max), iN = argMin(M.min), iS = argMax(M.sv.map(Math.abs)), rX = M.rows[iX], rN = M.rows[iN], rS = M.rows[iS];
      const a = one('anf.mx', rX, rX && rX.pos ? 'fx.Mu' : 'fx.rev'), b = one('anf.mn', rN, rN && rN.pos ? 'fx.rev' : 'fx.Mu'), c = one('anf.sv', rS, 'fx.Ms'); [a, b, c].forEach(q => q && W.push(q));
      items.push({ type: 'figure', svg: chart(M.x, [{ name: 'Mu max', y: M.max, c: '#DC2626' }, { name: 'Mu min', y: M.min, c: '#2563EB', dash: '4 3' }], { title: 'Strength I moment envelope', unit: 'kip-ft', sup, mark: [iX >= 0 ? { x: M.x[iX], y: M.max[iX], t: `max ${f(M.max[iX], 1)}` } : null, iN >= 0 ? { x: M.x[iN], y: M.min[iN], t: `min ${f(M.min[iN], 1)}` } : null].filter(Boolean) }), caption: 'Strength I moment envelope $M_{u}$ max and min, factored, per girder; kip-ft' });
      items.push(note(`${plain(T.strI)} Largest ${f(M.max[iX], 1)} kip-ft at x = ${f(M.x[iX], 2)} ft${a ? ` [[${a.sc}/${a.s.id}]]` : ''}; smallest ${f(M.min[iN], 1)} kip-ft at x = ${f(M.x[iN], 2)} ft${b ? ` [[${b.sc}/${b.s.id}]]` : ''}. Every location: Flexure section, as on the [[tab:flex|Flexure tab]].`));
      items.push({ type: 'figure', svg: chart(M.x, [{ name: 'Ms', y: M.sv, c: '#059669' }], { title: 'Service II moment', unit: 'kip-ft', sup, mark: iS >= 0 ? [{ x: M.x[iS], y: M.sv[iS], t: `${f(M.sv[iS], 1)}` }] : [] }), caption: 'Service II moment $M_{s}$, factored, per girder; kip-ft' });
      items.push(note(`${plain(T.sv)} Largest $|M_{s}|$ ${f(M.sv[iS], 1)} kip-ft at x = ${f(M.x[iS], 2)} ft${c ? ` [[${c.sc}/${c.s.id}]]` : ''}.`));
      const iP = argMax(M.fP), iQ = argMin(M.fN), dR = M.fP.map((v, i) => v - M.fN[i]), iR = argMax(dR);
      items.push({ type: 'figure', svg: chart(M.x, [{ name: 'γMfat+', y: M.fP, c: '#7C3AED' }, { name: 'γMfat−', y: M.fN, c: '#7C3AED', dash: '4 3' }], { title: 'Fatigue I moment', unit: 'kip-ft', sup, mark: [iP >= 0 ? { x: M.x[iP], y: M.fP[iP], t: f(M.fP[iP], 1) } : null, iQ >= 0 ? { x: M.x[iQ], y: M.fN[iQ], t: f(M.fN[iQ], 1) } : null].filter(Boolean) }), caption: 'Fatigue I moment $\\gamma M_{FAT}$, factored, per girder; kip-ft' });
      items.push(note(`${plain(T.fat)} Largest range γ(M+ − M−) = ${f(M.fP[iR], 1)} − (${f(M.fN[iR], 1)}) = ${f(dR[iR], 1)} kip-ft at x = ${f(M.x[iR], 2)} ft.`));
    } else items.push(note(`Factored moments not available: ${F.err.flex || 'not calculated'}.`, true));
    if (F.V) { const V = F.V, iV = argMax(V.Vck), d = one('anf.v', V.rows[iV], 'sh.Vu'); if (d) W.push(d);
      items.push({ type: 'figure', svg: chart(V.x, [{ name: 'Vu checked (GS11)', y: V.Vck, c: '#DC2626' }, { name: 'Vu at the location', y: V.Vu, c: '#B45309', dash: '4 3' }, { name: 'γVfat', y: V.Vf, c: '#7C3AED', dash: '2 2' }], { title: 'Strength I and Fatigue I shear', unit: 'kip', sup, mark: iV >= 0 ? [{ x: V.x[iV], y: V.Vck[iV], t: f(V.Vck[iV], 1) }] : [] }), caption: 'Strength I shear $V_{u}$ and Fatigue I shear $\\gamma V_{FAT}$, factored magnitudes, per girder; kip' });
      items.push(note(`${plain(T.V)} Largest ${f(V.Vck[iV], 1)} kip at x = ${f(V.x[iV], 2)} ft${d ? ` [[${d.sc}/${d.s.id}]]` : ''}. Every station: Shear & stiffeners section, as on the [[tab:shear|Shear & stiffeners tab]].`));
    } else items.push(note(`Factored shears not available: ${F.err.shear || 'not calculated'}.`, true));
    if (F.C) { const C = F.C, iX = argMax(C.max), iN = argMin(C.min), e = one('anf.c', C.rows[iX], 'cn.Mc'); if (e) W.push(e);
      items.push({ type: 'figure', svg: chart(C.x, [{ name: 'Mc max', y: C.max, c: '#B45309' }, { name: 'Mc min', y: C.min, c: '#1E3A5F', dash: '4 3' }], { title: 'Deck placement moment', unit: 'kip-ft', sup, mark: [iX >= 0 ? { x: C.x[iX], y: C.max[iX], t: f(C.max[iX], 1) } : null, iN >= 0 ? { x: C.x[iN], y: C.min[iN], t: f(C.min[iN], 1) } : null].filter(Boolean) }), caption: 'Deck placement (constructibility) moment $M_{c}$, factored, steel section, per girder; kip-ft' });
      items.push(note(`${plain(T.cn)} Largest ${f(C.max[iX], 1)} kip-ft at x = ${f(C.x[iX], 2)} ft${e ? ` [[${e.sc}/${e.s.id}]]` : ''}. Every location: Constructibility section, as on the [[tab:cn|Constructibility tab]].`));
    } else items.push(note(`Deck placement moments not available: ${F.err.cn || 'not calculated'}.`, true));
    items.push(note('Every factored value above is a check demand at the check module\'s own locations (every analysis station; ±0.01 ft at supports and plate changes), read from that module. The factors: Basis of design, "Load combinations used". Strength III, IV, V and Service I are not used by the girder checks (Strength III and V: the cross-frame wind cases; Service I: the live-load deflection).'));
    if (F.Rx) { const G = F.M.G, anyBS = F.Rx.some(q => q.Ru != null);
      items.push(tbl(['Support', 'Strength I max', 'Strength I min', 'Service II max', 'Service II min', ...(anyBS ? ['$R_{u}$, bearing stiffeners'] : [])], F.Rx.map(q => [`${q.name} (x = ${f(q.x, 1)} ft)`, N(q.max, 2), N(q.min, 2), N(q.svMax, 2), N(q.svMin, 2), ...(anyBS ? [q.Ru != null ? N(q.Ru, 2) : '—'] : [])]), { caption: 'Factored reactions, kip (up +)' }));
      items.push(note(`Derived from the unfactored reactions of the subsection "Reactions (unfactored, kip)" of this section and the same factors: Strength I by the app's Strength I combination (engine/flexure.js envelopeStrI: DC1 + DC2 with $\\gamma_{p,DC}$ ${gm3(G.dc)} / ${gm3(G.dcMin)} by the sign of their sum, DW ${gm3(G.dw)} / ${gm3(G.dwMin)}, $\\gamma_{LL}$ ${gm3(G.ll)}; ${ED} Tables 3.4.1-1, 3.4.1-2); Service II $R_{DC1}$ + $R_{DC2}$ + $R_{DW}$ + ${gm3(G.sll)}$R_{LL+IM}$. No check takes these combined reactions except the bearing stiffeners${anyBS ? ' (their $R_{u}$, every component with its maximum factor, is worked in the Shear & stiffeners section)' : ''}.`));
    }
    W.forEach(q => items.push(steps(q.sc, [q.s], { title: `Worked at x = ${f(q.r.x, 2)} ft (${q.r.name})` })));
    return items;
  }

  window.SBDFactoredUI = { VIEWS, compute, card, report, texts };
})();
