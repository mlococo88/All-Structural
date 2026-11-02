/* apps/light-pole/lts-engine.js — the AASHTO LRFDLTS mode of "Light Pole and Sign Post.html" (window.LpLts).
   Classic script, no DOM, no build step; loaded by the tool with <script src="apps/light-pole/lts-engine.js">, and by
   tests/engine/lightpole-lts.test.mjs in a Node vm. Pure functions: each takes plain numbers/objects and returns its values
   with the worked steps (shared/steps.js format: {id, label, sym, eq, sub, value, unit, d, ref, note, ok}).
   Basis (engineer, 2026-11-02): AASHTO LRFD Specifications for Structural Supports for Highway Signs, Luminaires, and
   Traffic Signals, 1st Edition (2015), with the 2017 Interim Revisions; later interims are not applied. Provisions are
   cited by article and page and paraphrased; no specification text is reproduced. Plan: docs/lts-mode-plan.md.
   Added 2026-11-02 (LTS-1: basis, MRI, Table 3.4-1 load combinations). */
(function (root) {
  'use strict';
  const BASIS = 'AASHTO LRFDLTS 1st Ed. (2015) with 2017 Interim Revisions; later interims not applied';
  const ED = 'AASHTO LRFDLTS 1st Ed. (2015, 2017 Interim)';
  const ref = s => ED + ' ' + s;

  /* ---- Table 3.8-1 (p. 3-5): mean recurrence interval by risk category and traffic (ADT); roadside signs 10 yr ---- */
  const ADT_BANDS = [
    { key: 'lt100', label: 'ADT < 100' },
    { key: '100to1k', label: '100 < ADT ≤ 1,000' },
    { key: '1kto10k', label: '1,000 < ADT ≤ 10,000' },
    { key: 'gt10k', label: 'ADT > 10,000' },
  ];
  const RISK = {
    typical: { label: 'Typical (failure could cross the travelway)', mri: [300, 700, 700, 1700] },
    high: { label: 'High (failure could stop a lifeline travelway)', mri: [1700, 1700, 1700, 1700] },
    low: { label: 'Low (failure could not cross the travelway)', mri: [300, 300, 300, 300] },
  };
  const MAP_FIG = { 300: 'Fig. 3.8-3', 700: 'Fig. 3.8-1', 1700: 'Fig. 3.8-2', 10: 'Fig. 3.8-4' };
  /* mri(risk, adt, roadsideSign): the Extreme I MRI (yr) and the map that gives V. */
  function mri(risk, adt, roadsideSign) {
    const r = RISK[risk] || RISK.typical;
    let i = ADT_BANDS.findIndex(b => b.key === adt); if (i < 0) i = 2;
    if (roadsideSign) {
      return { mri: 10, fig: MAP_FIG[10], steps: [{ id: 'mri', label: 'Mean recurrence interval for the Extreme I wind (roadside sign support)', sym: 'MRI',
        eq: '', sub: '', value: 10, unit: 'yr', d: 0, ref: ref('Table 3.8-1, note (p. 3-5)'),
        note: 'Roadside sign supports use the 10-yr MRI wind of Fig. 3.8-4, whatever the risk category.' }] };
    }
    const m = r.mri[i];
    return { mri: m, fig: MAP_FIG[m], steps: [{ id: 'mri', label: 'Mean recurrence interval for the Extreme I wind', sym: 'MRI',
      eq: '', sub: '', value: m, unit: 'yr', d: 0, ref: ref('Table 3.8-1 (p. 3-5)'),
      note: `Risk category ${r.label.split(' (')[0]}, ${ADT_BANDS[i].label} → ${m}-yr MRI; V from ${MAP_FIG[m]}.` }] };
  }

  /* ---- Table 3.4-1 (p. 3-3): limit states used by this tool ----
     DC: dead load (Art. 3.5); LL: live load (Art. 3.6, walkways only: not applicable here); W: wind (Arts. 3.8, 3.9);
     ICE: Owner-specified atmospheric ice (Art. 3.7), taken in the Strength I gravity case at the DC factor (decision Q-C1,
     engineer to confirm; there is no ice-plus-wind combination, C3.7). wind: 'extreme' = V of Figs. 3.8-1/-2/-3 (or 3.8-4
     for roadside signs), 'service' = V of Fig. 3.8-4 (10-yr). */
  const COMBOS = [
    { key: 'S1', name: 'Strength I', desc: 'gravity', DC: 1.25, LL: 1.6, ICE: 1.25, W: 0, wind: null, ref: 'Table 3.4-1 (p. 3-3)' },
    { key: 'E1max', name: 'Extreme I (DC max)', desc: 'wind', DC: 1.1, LL: 0, ICE: 0, W: 1.0, wind: 'extreme', ref: 'Table 3.4-1 (p. 3-3)' },
    { key: 'E1min', name: 'Extreme I (DC min)', desc: 'wind', DC: 0.9, LL: 0, ICE: 0, W: 1.0, wind: 'extreme', ref: 'Table 3.4-1 (p. 3-3)' },
    { key: 'SV1', name: 'Service I', desc: 'deflection', DC: 1.0, LL: 0, ICE: 0, W: 1.0, wind: 'service', ref: 'Table 3.4-1 (p. 3-3); Art. 10.4.2.1' },
  ];
  /* comboLabel(c): '1.1DC + 1.0W' */
  function comboLabel(c) {
    const t = [];
    if (c.DC) t.push(`${c.DC}DC`);
    if (c.ICE) t.push(`${c.ICE}IC`);
    if (c.W) t.push(`${c.W.toFixed(1)}W${c.wind === 'service' ? '(10-yr)' : ''}`);
    return t.join(' + ');
  }

  root.LpLts = { BASIS, ED, ref, ADT_BANDS, RISK, MAP_FIG, mri, COMBOS, comboLabel };

  /* =================== LTS-2 (2026-11-02): wind and dead/ice loads, base actions =================== */
  const G = 1.14;                                    // Art. 3.8.6 (p. 3-17, 2017): G = 1.14 (minimum)
  /* Kz: Eq. 3.8.4-1 (p. 3-15): 2.0(z/zg)^(2/alpha), Exposure C alpha 9.5, zg 900 ft, z not less than 16 ft */
  function kz(z) { return 2.0 * Math.pow(Math.max(z, 16) / 900, 2 / 9.5); }
  /* Kd: Table 3.8.5-1 (p. 3-16): poles round 0.95, square 0.90 (8/12/16-sided 0.95). Rectangular: the square value. */
  function kd(shape) { return shape === 'round' ? 0.95 : 0.90; }
  /* Cv: Art. 3.8.7 (p. 3-17, 2017): 0.8 at the Extreme limit state, 1.0 otherwise */
  const cv = state => (state === 'extreme' ? 0.8 : 1.0);
  /* Cd, Table 3.8.7-1 (p. 3-20, 2017). x = Cv·V·d (mph·ft, d in ft). */
  function cdRound(x) { return x <= 39 ? 1.10 : x < 78 ? 129 / Math.pow(x, 1.3) : 0.45; }
  function cdSquare(rs) { return rs < 0.125 ? 2.0 - 6 * Math.max(0, rs) : 1.25; }   // rs = corner radius / depth
  function cdMember(shape, x, rs) { return shape === 'round' ? cdRound(x) : cdSquare(rs || 0); }
  /* Sign panel by L_sign/W_sign (longer/shorter side), Table 3.8.7-1 (p. 3-19, 2017); linear between rows (decision Q-B3) */
  const SIGN_LW = [1, 2, 5, 10, 15], SIGN_CD = [1.12, 1.19, 1.20, 1.23, 1.30];
  function cdSign(B, s) {
    const r = Math.max(B, s) / Math.max(1e-9, Math.min(B, s));
    if (r <= 1) return 1.12; if (r >= 15) return 1.30;
    for (let i = 1; i < SIGN_LW.length; i++) if (r <= SIGN_LW[i]) return SIGN_CD[i - 1] + (SIGN_CD[i] - SIGN_CD[i - 1]) * (r - SIGN_LW[i - 1]) / (SIGN_LW[i] - SIGN_LW[i - 1]);
    return 1.30;
  }
  const RAD = Math.PI / 180, NSTRIP = 100, ICE_DEN = 56;   // pcf, atmospheric ice density (Owner-specified ice; as the IBC mode)
  const f = (x, d) => (typeof x === 'number' && isFinite(x) ? x.toFixed(d == null ? 2 : d) : '—');

  /* windForces(g, V, state, psi): the horizontal wind forces for wind blowing toward bearing psi (deg, the tool's convention:
     0 = +x), as point forces {name, z, Fx, Fy, T, kind}, T = torsion about the pole axis (lb·ft).
     g: {mode:'pole'|'sign', shape, H, Dtop, Dbase (in, face width), rs, fixtures:[{hf, th, a, epa, W, armD}],
         sign:{B, s, clr, W, nPost, spacing}} */
  function windForces(g, V, state, psi) {
    const c = Math.cos(psi * RAD), sn = Math.sin(psi * RAD), Kd = kd(g.shape), Cv = cv(state), out = [];
    const dz = g.H / NSTRIP, isSign = g.mode === 'sign';
    // vertical support(s): strip integration (Art. 3.9.3, W_v); the post of a sign is prismatic
    const nPost = isSign ? Math.max(1, g.sign.nPost || 1) : 1;
    for (let i = 0; i < NSTRIP; i++) {
      const z = (i + 0.5) * dz, d = g.Dtop + (g.Dbase - g.Dtop) * (g.H - z) / g.H, dft = d / 12;
      const Cd = cdMember(g.shape, Cv * V * dft, g.rs), Pz = 0.00256 * kz(z) * Kd * G * V * V * Cd, F = Pz * dft * dz * nPost;
      out.push({ name: 'support', kind: 'strip', z, Fx: F * c, Fy: F * sn, T: 0, Cd, Pz, d });
    }
    if (!isSign) {
      (g.fixtures || []).forEach((x, k) => {
        const ex = (x.a || 0) * Math.cos((x.th || 0) * RAD), ey = (x.a || 0) * Math.sin((x.th || 0) * RAD);
        // attachment with the manufacturer's EPA: P_z without C_d, times the EPA (Art. 3.9.1, p. 3-23)
        const q = 0.00256 * kz(x.hf) * Kd * G * V * V, Fw = q * (x.epa || 0);
        // concentric (pole-top, a = 0): torsion 0.15b, b = out-to-out width of the attachment, taken as sqrt(EPA) (Art. 3.9.4.2;
        // the width is not an input: decision, engineer to confirm); offset fixtures: the net torque of their offset
        const T015 = (x.a || 0) > 0 ? 0 : Fw * 0.15 * Math.sqrt(Math.max(0, x.epa || 0));
        out.push({ name: `fixture ${k + 1}`, kind: 'fixture', z: x.hf, Fx: Fw * c, Fy: Fw * sn, T: ex * Fw * sn - ey * Fw * c, T015, q, ex, ey });
        if ((x.armD || 0) > 0 && (x.a || 0) > 0) {   // the arm: round member, projected area a·D·|sin(theta − psi)| (Art. 3.9.2, W_h)
          const Dft = x.armD / 12, Cd = cdRound(Cv * V * Dft), Pz = 0.00256 * kz(x.hf) * Kd * G * V * V * Cd;
          const F = Pz * Dft * x.a * Math.abs(Math.sin(((x.th || 0) - psi) * RAD));
          out.push({ name: `arm ${k + 1}`, kind: 'arm', z: x.hf, Fx: F * c, Fy: F * sn, T: (ex / 2) * F * sn - (ey / 2) * F * c, Cd, Pz });
        }
      });
    } else {
      // sign panel: normal to x (faces the 0°/180° wind); a wind along y sees the panel edge only (no area)
      const S = g.sign, zc = S.clr + S.s / 2, Cd = cdSign(S.B, S.s), Pz = 0.00256 * kz(zc) * Kd * G * V * V * Cd;
      const Fn = Pz * S.B * S.s * Math.abs(c);
      // single-support roadside sign: torsion = W·0.15b, b = the panel width (Art. 3.9.4.2); two posts: none (decision Q-C2)
      const T015 = nPost === 1 ? Fn * 0.15 * S.B : 0;
      out.push({ name: 'sign panel', kind: 'panel', z: zc, Fx: Fn * Math.sign(c), Fy: 0, T: 0, T015, Cd, Pz });
    }
    return out;
  }
  /* resultant at a section at height z0 (lb, lb·ft): forces above z0 */
  function sectionWind(forces, z0) {
    let Vx = 0, Vy = 0, Mx = 0, My = 0, T = 0, T015 = 0;
    forces.forEach(q => { if (q.z < z0) return; Vx += q.Fx; Vy += q.Fy; Mx += q.Fx * (q.z - z0); My += q.Fy * (q.z - z0); T += q.T; T015 += (q.T015 || 0); });
    return { Vx, Vy, Mx, My, T: T + (T >= 0 ? 1 : -1) * T015 };
  }
  /* Table 3.9.3-1 (p. 3-24): load cases for wind from any direction. Case 1: full wind normal (psi = 0 and 180),
     case 2: full transverse (90, 270), case 3: 0.75 of both together (the four diagonals). */
  const LOAD_CASES = [
    { key: 'n0', name: 'Case 1: normal, toward 0°', parts: [[0, 1.0]] },
    { key: 'n180', name: 'Case 1: normal, toward 180°', parts: [[180, 1.0]] },
    { key: 't90', name: 'Case 2: transverse, toward 90°', parts: [[90, 1.0]] },
    { key: 't270', name: 'Case 2: transverse, toward 270°', parts: [[270, 1.0]] },
    { key: 'd45', name: 'Case 3: 0.75 (0°) + 0.75 (90°)', parts: [[0, 0.75], [90, 0.75]] },
    { key: 'd135', name: 'Case 3: 0.75 (180°) + 0.75 (90°)', parts: [[180, 0.75], [90, 0.75]] },
    { key: 'd225', name: 'Case 3: 0.75 (180°) + 0.75 (270°)', parts: [[180, 0.75], [270, 0.75]] },
    { key: 'd315', name: 'Case 3: 0.75 (0°) + 0.75 (270°)', parts: [[0, 0.75], [270, 0.75]] },
  ];
  /* caseForces(g, V, state, lc): the point forces of a load case (the parts scaled and joined) */
  function caseForces(g, V, state, lc) {
    const out = [];
    lc.parts.forEach(([psi, k]) => windForces(g, V, state, psi).forEach(q => out.push({ ...q, Fx: q.Fx * k, Fy: q.Fy * k, T: q.T * k, T015: (q.T015 || 0) * k })));
    return out;
  }
  /* dead load and ice (lb): g.DCpole (support self-weight), g.DL (misc.), fixtures W at (ex, ey), sign W; ice (Owner-specified,
     Strength I only): radial t on the support(s), two faces of each fixture EPA (approximation, flagged), one face of the panel (Art. 3.7) */
  function gravity(g, tIce) {
    const isSign = g.mode === 'sign', nPost = isSign ? Math.max(1, g.sign.nPost || 1) : 1;
    let W = (g.DCpole || 0) + (g.DL || 0) * nPost, Mx = 0, My = 0, Wice = 0;
    if (!isSign) (g.fixtures || []).forEach(x => { const ex = (x.a || 0) * Math.cos((x.th || 0) * RAD), ey = (x.a || 0) * Math.sin((x.th || 0) * RAD);
      W += x.W || 0; Mx += (x.W || 0) * ex; My += (x.W || 0) * ey; if (tIce > 0) Wice += ICE_DEN * (tIce / 12) * 2 * (x.epa || 0); });
    else W += g.sign.W || 0;
    if (tIce > 0) {
      const Dm = (g.Dtop + g.Dbase) / 2, per = Math.PI * ((Dm / 2 + tIce) ** 2 - (Dm / 2) ** 2) / 144 * ICE_DEN;   // lb/ft on a round support
      Wice += per * g.H * nPost + (isSign ? ICE_DEN * (tIce / 12) * g.sign.B * g.sign.s : 0);
    }
    return { W, Mx, My, Wice };
  }
  /* baseActions(g, L): factored base actions for every limit state of COMBOS and load case (first order; B₂ in LTS-3).
     Sign convention as the anchorGroup hand-off 'lightPole-v1': P compression +, Mx = moment of a push toward +x. For a
     two-post sign the values are per post (half the panel, one post's own wind and weight). */
  function baseActions(g, L) {
    const gr = gravity(g, L.tIce || 0), isSign = g.mode === 'sign', nPost = isSign ? Math.max(1, g.sign.nPost || 1) : 1, share = 1 / nPost;
    const rows = [];
    COMBOS.forEach(cb => {
      const P = (cb.DC * gr.W + (cb.ICE || 0) * gr.Wice) * share;
      if (!cb.wind) { rows.push({ combo: cb.key, name: cb.name, lc: '—', lcName: 'gravity', P, Vx: 0, Vy: 0, Mx: cb.DC * gr.Mx, My: cb.DC * gr.My, T: 0 }); return; }
      const V = cb.wind === 'extreme' ? L.V : L.Vsvc;
      LOAD_CASES.forEach(lc => {
        const w = sectionWind(caseForces(g, V, cb.wind, lc), 0);
        rows.push({ combo: cb.key, name: cb.name, lc: lc.key, lcName: lc.name, P,
          Vx: w.Vx * cb.W * share, Vy: w.Vy * cb.W * share, Mx: (w.Mx * cb.W + cb.DC * gr.Mx) * share, My: (w.My * cb.W + cb.DC * gr.My) * share, T: w.T * cb.W * share });
      });
    });
    const z0 = x => (Math.abs(x) < 1e-6 ? 0 : x);   // no '-0' in the tables
    rows.forEach(r => { ['P', 'Vx', 'Vy', 'Mx', 'My', 'T'].forEach(k => { r[k] = z0(r[k]); }); r.M = Math.hypot(r.Mx, r.My); r.V = Math.hypot(r.Vx, r.Vy); });
    return { gravity: gr, rows };
  }
  /* windSteps(g, L): the worked steps of the wind loads (Extreme I, wind toward 0°; the same equations at every strip) */
  function windSteps(g, L) {
    const st = [], V = L.V, Kd = kd(g.shape), Cv = cv('extreme'), isSign = g.mode === 'sign';
    st.push({ id: 'w.kd', label: 'Directionality factor (pole/post, ' + g.shape + ')', sym: 'K_{d}', eq: '', sub: '', value: Kd, unit: '', d: 2, ref: ref('Table 3.8.5-1 (p. 3-16)'),
      note: isSign ? 'A ground-mounted sign has no row of its own; the pole value of the post shape is used for the whole structure (decision Q-C5, conservative against 0.85; engineer to confirm).' : '' });
    st.push({ id: 'w.g', label: 'Gust effect factor', sym: 'G', eq: '', sub: '', value: G, unit: '', d: 2, ref: ref('Art. 3.8.6 (p. 3-17, 2017)') });
    st.push({ id: 'w.cv', label: 'Velocity conversion factor, Extreme', sym: 'C_{v}', eq: '', sub: '', value: Cv, unit: '', d: 1, ref: ref('Art. 3.8.7 (p. 3-17, 2017)') });
    const zt = g.H, KzT = kz(zt);
    st.push({ id: 'w.kzTop', label: `Height and exposure factor at the top, z = ${f(zt, 1)} ft`, sym: 'K_{z}', eq: '2.0\\left(\\frac{z}{z_{g}}\\right)^{2/\\alpha}',
      sub: `2.0\\left(\\frac{${f(Math.max(zt, 16), 2)}}{900}\\right)^{2/9.5}`, value: KzT, unit: '', d: 3, ref: ref('Eq. 3.8.4-1 (p. 3-15)'), note: 'Exposure C; z not less than 16 ft.' });
    const dB = g.Dbase / 12, xB = Cv * V * dB, dT = g.Dtop / 12, xT = Cv * V * dT;
    [['base', dB, xB], ['top', dT, xT]].forEach(([w, d, x]) => {
      const Cd = cdMember(g.shape, x, g.rs);
      st.push({ id: 'w.cd' + w, label: `Drag coefficient of the ${isSign ? 'post' : 'pole'} at the ${w}, d = ${f(d * 12, 3)} in`, sym: 'C_{d}',
        eq: g.shape === 'round' ? (x <= 39 ? '1.10\;(C_{v}Vd \\le 39)' : x < 78 ? '\\frac{129}{(C_{v}Vd)^{1.3}}' : '0.45\;(C_{v}Vd \\ge 78)') : '2.0 - 6r_{s}\;\\text{or}\;1.25',
        sub: g.shape === 'round' ? `C_{v}Vd = ${f(Cv, 1)}\\cdot${f(V, 0)}\\cdot${f(d, 4)} = ${f(x, 2)}` : `r_{s} = ${f(g.rs || 0, 3)}`,
        value: Cd, unit: '', d: 3, ref: ref('Table 3.8.7-1 (p. 3-20, 2017)'), note: g.shape === 'rect' ? 'Rectangular tube: the square-tube value (decision Q-C6; engineer to confirm).' : '' });
    });
    const CdB = cdMember(g.shape, xB, g.rs), KzB = kz(0), PzB = 0.00256 * KzB * Kd * G * V * V * CdB;
    st.push({ id: 'w.pzBase', label: 'Design wind pressure at the base (heights below 16 ft are taken at 16 ft)', sym: 'P_{z}', eq: '0.00256\\,K_{z}K_{d}GV^{2}C_{d}',
      sub: `0.00256\\cdot${f(KzB, 3)}\\cdot${f(Kd, 2)}\\cdot${f(G, 2)}\\cdot${f(V, 0)}^{2}\\cdot${f(CdB, 3)}`, value: PzB, unit: 'psf', d: 2, ref: ref('Eq. 3.8.1-1 (p. 3-14)') });
    const fr = windForces(g, V, 'extreme', 0), sup = fr.filter(q => q.kind === 'strip'), Fs = sup.reduce((a, q) => a + q.Fx, 0), Ms = sup.reduce((a, q) => a + q.Fx * q.z, 0);
    st.push({ id: 'w.fsup', label: `Wind on the ${isSign ? 'post(s)' : 'pole'}, integrated over ${NSTRIP} strips (P_z, C_d and d at each strip)`, sym: 'W_{v}', eq: '\\sum P_{z}\\,d\\,\\Delta z',
      sub: '', value: Fs, unit: 'lb', d: 0, ref: ref('Art. 3.9.3 (p. 3-23)'), note: `Moment at the base ${f(Ms, 0)} lb·ft; resultant at ${f(Fs > 0 ? Ms / Fs : 0, 2)} ft.` });
    fr.filter(q => q.kind === 'fixture').forEach((q, k) => st.push({ id: 'w.fix' + k, label: `${q.name} at ${f(q.z, 1)} ft (manufacturer EPA: P_z without C_d, times the EPA)`, sym: 'W_{l}',
      eq: '0.00256\\,K_{z}K_{d}GV^{2}\\cdot EPA', sub: `${f(q.q, 2)}\\cdot${f(Math.hypot(q.Fx, q.Fy) / Math.max(q.q, 1e-9), 2)}`, value: Math.hypot(q.Fx, q.Fy), unit: 'lb', d: 1, ref: ref('Art. 3.9.1 (p. 3-23); Table 3.8.7-1 attachments') }));
    fr.filter(q => q.kind === 'arm').forEach((q, k) => st.push({ id: 'w.arm' + k, label: `${q.name}: round member, C_d at C_vVd, projected length a·|sin(θ − ψ)|`, sym: 'W_{h}', eq: 'P_{z}\\,D\\,a\\,|\\sin(\\theta-\\psi)|',
      sub: `C_{d} = ${f(q.Cd, 3)}, P_{z} = ${f(q.Pz, 2)}\;\\text{psf}`, value: Math.hypot(q.Fx, q.Fy), unit: 'lb', d: 1, ref: ref('Art. 3.9.2 (p. 3-23); Table 3.8.7-1') }));
    if (isSign) {
      const S = g.sign, zc = S.clr + S.s / 2, Cd = cdSign(S.B, S.s), r = Math.max(S.B, S.s) / Math.min(S.B, S.s), Pz = 0.00256 * kz(zc) * Kd * G * V * V * Cd, F = Pz * S.B * S.s;
      st.push({ id: 'w.cdSign', label: `Drag coefficient of the sign panel, L/W = ${f(r, 2)}`, sym: 'C_{d}', eq: '\\text{Table 3.8.7-1, linear between rows}', sub: '', value: Cd, unit: '', d: 3,
        ref: ref('Table 3.8.7-1 (p. 3-19, 2017)'), note: 'Linear interpolation between the tabulated L/W rows (coordinator decision Q-B3).' });
      st.push({ id: 'w.kzSign', label: `K_z at the panel centroid, z = ${f(zc, 2)} ft`, sym: 'K_{z}', eq: '2.0\\left(\\frac{z}{900}\\right)^{2/9.5}', sub: `z = ${f(Math.max(zc, 16), 2)}\;\\text{ft}`, value: kz(zc), unit: '', d: 3, ref: ref('Eq. 3.8.4-1 (p. 3-15)') });
      st.push({ id: 'w.fSign', label: 'Wind on the sign panel (normal)', sym: 'W_{p}', eq: 'P_{z}\\,B\\,s', sub: `${f(Pz, 2)}\\cdot${f(S.B, 2)}\\cdot${f(S.s, 2)}`, value: F, unit: 'lb', d: 0, ref: ref('Eq. 3.8.1-1; Art. 3.9.3 (pp. 3-14, 3-23)') });
      if ((S.nPost || 1) === 1) st.push({ id: 'w.tSign', label: 'Torsion, single-support roadside sign', sym: 'T', eq: 'W_{p}\\cdot 0.15\\,b', sub: `${f(F, 0)}\\cdot 0.15\\cdot${f(S.B, 2)}`, value: F * 0.15 * S.B, unit: 'lb-ft', d: 0, ref: ref('Art. 3.9.4.2 (p. 3-25)') });
      else st.push({ id: 'w.tSign', label: 'Torsion, two-post sign', sym: 'T', eq: '', sub: '', value: 0, unit: 'lb-ft', d: 0, ref: ref('Art. 3.9.4.2 (p. 3-25)'), note: 'Art. 3.9.4.2 names single-support roadside signs; no eccentric case for two posts (decision Q-C2; engineer to confirm).' });
    }
    return st;
  }

  Object.assign(root.LpLts, { G, kz, kd, cv, cdRound, cdSquare, cdMember, cdSign, windForces, sectionWind, LOAD_CASES, caseForces, gravity, baseActions, windSteps, NSTRIP, ICE_DEN });
})(typeof window !== 'undefined' ? window : globalThis);
