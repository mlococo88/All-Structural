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
     accepted by the engineer 2026-11-02; there is no ice-plus-wind combination, C3.7). wind: 'extreme' = V of Figs. 3.8-1/-2/-3 (or 3.8-4
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
      const z = (i + 0.5) * dz, dB = g.Dtop + (g.Dbase - g.Dtop) * (g.H - z) / g.H;
      // face width seen by the wind: B for a wind along x; a rectangular tube shows its depth Ht to a wind along y (LTS-3)
      const d = g.shape === 'rect' && g.Ht > 0 ? Math.abs(c) * dB + Math.abs(sn) * g.Ht : dB, dft = d / 12;
      const Cd = cdMember(g.shape, Cv * V * dft, g.rs), Pz = 0.00256 * kz(z) * Kd * G * V * V * Cd, F = Pz * dft * dz * nPost;
      out.push({ name: 'support', kind: 'strip', z, Fx: F * c, Fy: F * sn, T: 0, Cd, Pz, d });
    }
    if (!isSign) {
      (g.fixtures || []).forEach((x, k) => {
        const ex = (x.a || 0) * Math.cos((x.th || 0) * RAD), ey = (x.a || 0) * Math.sin((x.th || 0) * RAD);
        // attachment with the manufacturer's EPA: P_z without C_d, times the EPA (Art. 3.9.1, p. 3-23)
        const q = 0.00256 * kz(x.hf) * Kd * G * V * V, Fw = q * (x.epa || 0);
        // concentric (pole-top, a = 0): torsion 0.15b, b = out-to-out width of the attachment, taken as sqrt(EPA) (Art. 3.9.4.2;
        // the width is not an input: decision accepted by the engineer 2026-11-02); offset fixtures: the net torque of their offset
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
      note: isSign ? 'A ground-mounted sign has no row of its own; the pole value of the post shape is used for the whole structure (decision Q-C5, conservative against 0.85; accepted by the engineer 2026-11-02).' : '' });
    st.push({ id: 'w.g', label: 'Gust effect factor', sym: 'G', eq: '', sub: '', value: G, unit: '', d: 2, ref: ref('Art. 3.8.6 (p. 3-17, 2017)') });
    st.push({ id: 'w.cv', label: 'Velocity conversion factor, Extreme', sym: 'C_{v}', eq: '', sub: '', value: Cv, unit: '', d: 1, ref: ref('Art. 3.8.7 (p. 3-17, 2017)') });
    const zt = g.H, KzT = kz(zt);
    st.push({ id: 'w.kzTop', label: `Height and exposure factor at the top, z = ${f(zt, 1)} ft`, sym: 'K_{z}', eq: '2.0\\left(\\frac{z}{z_{g}}\\right)^{2/\\alpha}',
      sub: `2.0\\left(\\frac{${f(Math.max(zt, 16), 2)}}{900}\\right)^{2/9.5}`, value: KzT, unit: '', d: 3, ref: ref('Eq. 3.8.4-1 (p. 3-15)'), note: 'Exposure C; z not less than 16 ft.' });
    const dB = g.Dbase / 12, xB = Cv * V * dB, dT = g.Dtop / 12, xT = Cv * V * dT;
    [['base', dB, xB], ['top', dT, xT]].forEach(([w, d, x]) => {
      const Cd = cdMember(g.shape, x, g.rs);
      st.push({ id: 'w.cd' + w, label: `Drag coefficient of the ${isSign ? 'post' : 'pole'} at the ${w}, d = ${f(d * 12, 3)} in`, sym: 'C_{d}',
        eq: g.shape === 'round' ? (x <= 39 ? '1.10\\,(C_{v}Vd \\le 39)' : x < 78 ? '\\frac{129}{(C_{v}Vd)^{1.3}}' : '0.45\\,(C_{v}Vd \\ge 78)') : '2.0 - 6r_{s}\\,\\text{or}\\,1.25',
        sub: g.shape === 'round' ? `C_{v}Vd = ${f(Cv, 1)}\\cdot${f(V, 0)}\\cdot${f(d, 4)} = ${f(x, 2)}` : `r_{s} = ${f(g.rs || 0, 3)}`,
        value: Cd, unit: '', d: 3, ref: ref('Table 3.8.7-1 (p. 3-20, 2017)'), note: g.shape === 'rect' ? 'Rectangular tube: the square-tube value (decision Q-C6, accepted by the engineer 2026-11-02).' : '' });
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
      sub: `C_{d} = ${f(q.Cd, 3)}, P_{z} = ${f(q.Pz, 2)}\\,\\text{psf}`, value: Math.hypot(q.Fx, q.Fy), unit: 'lb', d: 1, ref: ref('Art. 3.9.2 (p. 3-23); Table 3.8.7-1') }));
    if (isSign) {
      const S = g.sign, zc = S.clr + S.s / 2, Cd = cdSign(S.B, S.s), r = Math.max(S.B, S.s) / Math.min(S.B, S.s), Pz = 0.00256 * kz(zc) * Kd * G * V * V * Cd, F = Pz * S.B * S.s;
      st.push({ id: 'w.cdSign', label: `Drag coefficient of the sign panel, L/W = ${f(r, 2)}`, sym: 'C_{d}', eq: '\\text{Table 3.8.7-1, linear between rows}', sub: '', value: Cd, unit: '', d: 3,
        ref: ref('Table 3.8.7-1 (p. 3-19, 2017)'), note: 'Linear interpolation between the tabulated L/W rows (coordinator decision Q-B3).' });
      st.push({ id: 'w.kzSign', label: `K_z at the panel centroid, z = ${f(zc, 2)} ft`, sym: 'K_{z}', eq: '2.0\\left(\\frac{z}{900}\\right)^{2/9.5}', sub: `z = ${f(Math.max(zc, 16), 2)}\\,\\text{ft}`, value: kz(zc), unit: '', d: 3, ref: ref('Eq. 3.8.4-1 (p. 3-15)') });
      st.push({ id: 'w.fSign', label: 'Wind on the sign panel (normal)', sym: 'W_{p}', eq: 'P_{z}\\,B\\,s', sub: `${f(Pz, 2)}\\cdot${f(S.B, 2)}\\cdot${f(S.s, 2)}`, value: F, unit: 'lb', d: 0, ref: ref('Eq. 3.8.1-1; Art. 3.9.3 (pp. 3-14, 3-23)') });
      if ((S.nPost || 1) === 1) st.push({ id: 'w.tSign', label: 'Torsion, single-support roadside sign', sym: 'T', eq: 'W_{p}\\cdot 0.15\\,b', sub: `${f(F, 0)}\\cdot 0.15\\cdot${f(S.B, 2)}`, value: F * 0.15 * S.B, unit: 'lb-ft', d: 0, ref: ref('Art. 3.9.4.2 (p. 3-25)') });
      else st.push({ id: 'w.tSign', label: 'Torsion, two-post sign', sym: 'T', eq: '', sub: '', value: 0, unit: 'lb-ft', d: 0, ref: ref('Art. 3.9.4.2 (p. 3-25)'), note: 'Art. 3.9.4.2 names single-support roadside signs; no eccentric case for two posts (decision Q-C2, accepted by the engineer 2026-11-02).' });
    }
    return st;
  }

  Object.assign(root.LpLts, { G, kz, kd, cv, cdRound, cdSquare, cdMember, cdSign, windForces, sectionWind, LOAD_CASES, caseForces, gravity, baseActions, windSteps, NSTRIP, ICE_DEN });

  /* =================== LTS-3 (2026-11-02): member checks, Section 5, and second order, Art. 4.8.1 / 5.12.1 ===================
     sec: a section at height z, {z, shape, D (round OD) | B, Ht (rect./square), t, A, Ix, Iy, Sx, Sy, Zx, Zy, rx, ry, Wabove (lb,
     support self-weight above z)}. Units: in, kip, ksi inside; demands arrive in lb, lb·ft. Push toward +x (Mx) bends the depth
     along x: a rectangular tube's depth Ht (Ix, Zx); push toward +y bends the width B (Iy, Zy); round: one value. */
  const E = 29000;
  const PHI = { f: 0.90, v: 0.90, t: 0.95, c: 0.90, u: 0.75, y: 0.90 };   // Art. 5.5.3.2 (p. 5-6); Art. 5.5.4: the same at Extreme
  /* Table 5.7.2-1 (p. 5-14) and Table 5.8.2-1 (p. 5-18) */
  function classify(sec, Fy) {
    const r = Math.sqrt(E / Fy);
    if (sec.shape === 'round') {
      const lam = sec.D / sec.t, lp = 0.07 * E / Fy, lrF = 0.31 * E / Fy, lrC = 0.11 * E / Fy, lmax = 0.45 * E / Fy;
      return { kind: 'D/t', lam, lp, lrF, lrC, lmax };
    }
    // square/rect.: flat width. With the inside corner radius r_i (LTS-7 input): b = (B − 2t) − 2·min(r_i, 4t)·tan(180°/4), the rule of
    // Art. 5.7.2 / Eq. 5.7.2-1 (p. 5-13, 5-14) applied with n = 4; without it: b = (larger wall) − 3t (decision Q-C9, accepted 2026-11-02)
    const W = Math.max(sec.B, sec.Ht || sec.B), ri = sec.ri > 0 ? sec.ri : 0;
    const bw = ri > 0 ? W - 2 * sec.t - 2 * Math.min(ri, 4 * sec.t) : W - 3 * sec.t, lam = bw / sec.t;
    return { kind: 'b/t', lam, b: bw, bRule: ri > 0 ? 'Eq. 5.7.2-1' : 'B-3t', lp: 1.12 * r, lrF: 1.53 * r, lrC: 1.53 * r, lmax: 2.14 * r };
  }
  function mnOf(sec, Z, Fy, cl) {   // kip-in, Table 5.8.2-1
    const Mp = Z * Fy, l = cl.lam, ef = E / Fy;
    if (l > cl.lmax) return { Mn: 0, cls: 'exceeds λmax (not permitted)', Mp };
    if (l <= cl.lp) return { Mn: Mp, cls: 'compact', Mp };
    if (sec.shape === 'round') return l <= cl.lrF ? { Mn: Mp * (0.77 + 0.016 * ef / l), cls: 'noncompact', Mp } : { Mn: Mp * (0.25 * ef / l), cls: 'slender', Mp };
    const k = l / Math.sqrt(ef);
    return l <= cl.lrF ? { Mn: Mp * (1.37 - 0.33 * k), cls: 'noncompact', Mp } : { Mn: Mp * (1.23 - 0.23 * k), cls: 'slender', Mp };
  }
  /* Art. 5.10 (pp. 5-27, 5-28): P_nc = A_g F_cr; K = 2.1 for a cantilever and r at 0.5L (C5.10.2.1) */
  function pnc(sec, Fy, cl, KLr) {
    let Q = 1;
    if (cl.lam > cl.lrC) {
      if (sec.shape === 'round') Q = Math.min(1, 0.67 + 0.038 * (E / Fy) / cl.lam);
      else {   // Eq. 5.10.2.3-1/-2 with f = F_cr at Q = 1, on the four walls
        const Fe0 = Math.PI ** 2 * E / KLr ** 2, f1 = KLr <= 4.71 * Math.sqrt(E / Fy) ? Math.pow(0.658, Fy / Fe0) * Fy : 0.877 * Fe0;
        const be = w => Math.min(w, 1.92 * sec.t * Math.sqrt(E / f1) * (1 - 0.34 / (w / sec.t) * Math.sqrt(E / f1)));
        const wB = sec.B - 3 * sec.t, wH = (sec.Ht || sec.B) - 3 * sec.t;
        Q = Math.max(0, (sec.A - 2 * (wB - be(wB)) * sec.t - 2 * (wH - be(wH)) * sec.t) / sec.A);
      }
    }
    const Fe = Math.PI ** 2 * E / KLr ** 2, Fcr = KLr <= 4.71 * Math.sqrt(E / (Q * Fy)) ? Q * Math.pow(0.658, Q * Fy / Fe) * Fy : 0.877 * Fe;
    return { Pn: sec.A * Fcr, Q, Fe, Fcr };
  }
  /* Art. 5.11 (pp. 5-30 to 5-33): direct shear and torsion */
  function shearTorsion(sec, Fy, cl, Lin) {
    if (sec.shape === 'round') {
      const D = sec.D, t = sec.t, Dt = D / t, R = (D - t) / 2;
      // Lv = L (full height, decision Q-C8, accepted 2026-11-02)
      const Fnv = Math.min(0.6 * Fy, Math.max(1.60 * E / (Math.sqrt(Lin / D) * Math.pow(Dt, 1.25)), 0.78 * E / Math.pow(Dt, 1.5)));
      const Fnt = Math.min(0.6 * Fy, Math.max(1.23 * E / (Math.sqrt(Lin / D) * Math.pow(Dt, 1.25)), 0.6 * E / Math.pow(Dt, 1.5)));
      const Ct = 2 * Math.PI * R * R * t;   // Table B.3-1 (p. B-3): 6.28R²t
      return { Vn: Fnv * sec.A / 2, Tn: Ct * Fnt, Fnv, Fnt, Ct, Av: sec.A / 2 };
    }
    // square/rect. (5.11.2.2): k_v = 5, h = b (flat), A_v = 2ht; F_nt = F_nv (5.11.3.2); C_t: closed-section constant of
    // AISC 360-16 §H3.1, 2(B−t)(H−t)t − 4.5(4−π)t³ (Table B.3-1 needs the corner radius; decision Q-C10, accepted 2026-11-02)
    const kv = 5, ht = cl.lam, a = Math.sqrt(kv * E / Fy);
    const Cv = ht <= 1.10 * a ? 1.0 : ht <= 1.37 * a ? 1.10 * a / ht : 1.51 * kv * E / (ht * ht * Fy);
    const Fnv = 0.6 * Fy * Cv, h = cl.b, t = sec.t, B = sec.B, H = sec.Ht || sec.B;
    const CtA = 2 * (B - t) * (H - t) * t - 4.5 * (4 - Math.PI) * t ** 3;
    // with the inside corner radius, a square tube also gets the Table B.3-1 constant 8.00R²t/k_t (p. B-3), k_t by Eq. B.3-1 (p. B-4),
    // R = mid-wall half-width, n' = r_i/t. Table B.3-1 divides by "k_t s" and Appendix B does not define s: the smaller of this value and the
    // AISC constant is used (conservative; flagged)
    let Ct = CtA, kt = null, CtB = null;
    if (sec.ri > 0 && Math.abs(B - H) < 1e-9) {
      const Rm = (B - t) / 2, np = sec.ri / t;
      kt = Math.max(1, (t / Rm) * ((Rm / (np * t) - 0.5 * (1 + (np + 1) / np)) / Math.log((np + 1) / np)) + np * t / Rm);
      CtB = 8.00 * Rm * Rm * t / kt; Ct = Math.min(CtA, CtB);
    }
    return { Vn: Fnv * 2 * h * t, Tn: Ct * Fnv, Fnv, Fnt: Fnv, Ct, CtA, CtB, kt, Av: 2 * h * t, Cv };
  }
  /* Second order. Tapered pole (non-prismatic): Art. 4.8.1, Eq. 4.8.1-1 (p. 4-3), B₂ = 1/(1 − P_eq/P_E,bot) ≥ 1,
     P_eq = (I_B/I_T)^(1/3)·P_T + 0.38·D_P, P_E,bot = π²EI_B/(kL)², k = 2.0, r at 0.5L; valid when kL/r ≥ 2π√(E/F_y).
     Prismatic post: Eq. 5.12.1-10/-11 (p. 5-34, 2017), B = 1/(1 − P_u/P_e), P_e = π²EA_g/(KL/r)², K = 2.1 (C5.10.2.1). */
  function b2(m) {   // m: {taper, IB, IT, PT (kip), DP (kip), Lin, rMid, Fy, Pu (kip), A, r}
    if (m.taper) {
      const PE = Math.PI ** 2 * E * m.IB / (2.0 * m.Lin) ** 2, Peq = Math.cbrt(m.IB / m.IT) * m.PT + 0.38 * m.DP;
      const klr = 2.0 * m.Lin / m.rMid, lim = 2 * Math.PI * Math.sqrt(E / m.Fy);
      return { method: '4.8.1', B: Math.max(1, 1 / (1 - Peq / PE)), PE, Peq, klr, lim, valid: klr >= lim && Peq < PE };
    }
    const klr = 2.1 * m.Lin / m.r, Pe = Math.PI ** 2 * E * m.A / klr ** 2;
    return { method: '5.12.1-10', B: m.Pu > 0 ? Math.max(1, 1 / (1 - m.Pu / Pe)) : 1, Pe, klr, valid: m.Pu < Pe };
  }
  /* interaction, Art. 5.12.1 (pp. 5-33, 5-34, 2017) */
  function interaction(d) {   // d: {Pu, Pr, BMr (B·Mu/Mr, or the biaxial sum), Vr (Vu/Vr), Tr (Tu/Tr)}
    const pr = d.Pr > 0 ? d.Pu / d.Pr : 0;
    if (d.Tr > 0.20) return { eq: '5.12.1-1', ratio: pr + (d.BMr + d.Vr + d.Tr) ** 2 };
    return pr >= 0.20 ? { eq: '5.12.1-2', ratio: pr + 8 / 9 * d.BMr } : { eq: '5.12.1-3', ratio: pr / 2 + d.BMr };
  }
  /* memberCheck(g, L, secs, Fy): every section × limit state × load case; returns the governing row per section, the
     overall governing row and the B factor. Demands per post for a two-post sign. */
  function memberCheck(g, L, secs, Fy) {
    const isSign = g.mode === 'sign', nPost = isSign ? Math.max(1, g.sign.nPost || 1) : 1, share = 1 / nPost, Lin = g.H * 12;
    const base = secs.reduce((a, s) => (s.z < a.z ? s : a)), top = secs.reduce((a, s) => (s.z > a.z ? s : a));
    const mid = secs.reduce((a, s) => (Math.abs(s.z - g.H / 2) < Math.abs(a.z - g.H / 2) ? s : a));
    const rMid = Math.min(mid.rx, mid.ry), taper = !!g.taper;
    const gr = gravity(g, L.tIce || 0), attach = gr.W - (g.DCpole || 0);   // fixtures, misc. DL, panel (lb, all posts)
    const fixAbove = z => (isSign ? [] : (g.fixtures || [])).filter(x => x.hf >= z);
    const out = [];
    // B for each limit state (P_T, D_P factored; the same B at every section of the member)
    const Bof = cb => b2({ taper, IB: Math.min(base.Ix, base.Iy), IT: Math.min(top.Ix, top.Iy), PT: cb.DC * attach * share / 1000, DP: cb.DC * (g.DCpole || 0) * share / 1000,
      Lin, rMid, Fy, Pu: cb.DC * gr.W * share / 1000, A: base.A, r: Math.min(base.rx, base.ry) });
    const Bs = {}; COMBOS.forEach(cb => { Bs[cb.key] = Bof(cb); });
    secs.forEach(sec => {
      const cl = classify(sec, Fy), mx = mnOf(sec, sec.Zx, Fy, cl), my = mnOf(sec, sec.Zy, Fy, cl);
      const KLr = 2.1 * Lin / rMid, pc = pnc(sec, Fy, cl, taper ? KLr : 2.1 * Lin / Math.min(sec.rx, sec.ry)), st = shearTorsion(sec, Fy, cl, Lin);
      const Mrx = PHI.f * mx.Mn, Mry = PHI.f * my.Mn, Pr = PHI.c * pc.Pn, Vr = PHI.v * st.Vn, Tr = PHI.t * st.Tn;
      const okShape = cl.lam <= cl.lmax;
      let gov = null;
      COMBOS.filter(cb => cb.key !== 'SV1').forEach(cb => {
        const B = Bs[cb.key].B, Pu = (cb.DC * (sec.Wabove + attach * share) + (cb.ICE || 0) * gr.Wice * share) / 1000;   // kip, per post (sec.Wabove: this post's self-weight above z; attachments all taken above, conservative)
        let MxD = 0, MyD = 0; fixAbove(sec.z).forEach(x => { MxD += cb.DC * x.W * (x.a || 0) * Math.cos((x.th || 0) * RAD); MyD += cb.DC * x.W * (x.a || 0) * Math.sin((x.th || 0) * RAD); });
        const lcs = cb.wind ? LOAD_CASES : [null];
        lcs.forEach(lc => {
          const w = lc ? sectionWind(caseForces(g, cb.wind === 'extreme' ? L.V : L.Vsvc, cb.wind, lc), sec.z) : { Vx: 0, Vy: 0, Mx: 0, My: 0, T: 0 };
          const Mx = (w.Mx * cb.W + MxD) * share * 12 / 1000, My = (w.My * cb.W + MyD) * share * 12 / 1000;   // kip-in
          const Vx = w.Vx * cb.W * share / 1000, Vy = w.Vy * cb.W * share / 1000, T = Math.abs(w.T * cb.W * share) * 12 / 1000;
          let BMr, Vrat, diag = null;
          if (sec.shape === 'round') { BMr = B * Math.hypot(Mx, My) / Mrx; Vrat = Math.hypot(Vx, Vy) / Vr; }
          else {
            BMr = B * Math.abs(Mx) / Mrx + B * Math.abs(My) / Mry; Vrat = Math.max(Math.abs(Vx), Math.abs(Vy)) / Vr;   // Eqs. 5.12.1-6, -7
            if (lc && lc.parts.length === 2) {   // skewed (diagonal) loading: Eq. 5.12.2-1 (p. 5-35, 2017)
              const alpha = cl.lam <= cl.lrF ? 1.6 : 1.0, Mrx2 = alpha === 1.6 ? PHI.f * mx.Mp : Mrx, Mry2 = alpha === 1.6 ? PHI.f * my.Mp : Mry;
              diag = Math.pow(B * Math.abs(Mx) / Mrx2, alpha) + Math.pow(B * Math.abs(My) / Mry2, alpha);
            }
          }
          const it = interaction({ Pu, Pr, BMr, Vr: Vrat, Tr: T / Tr });
          const ratio = okShape ? Math.max(it.ratio, diag || 0) : Infinity;
          const row = { z: sec.z, combo: cb.key, comboName: cb.name, lc: lc ? lc.key : '—', lcName: lc ? lc.name : 'gravity', Pu, Mx, My, Vx, Vy, T, B, Pr, Mrx, Mry, Vr, Tr,
            Mu: Math.hypot(Mx, My), BMr, Vrat, Trat: T / Tr, eq: it.eq, ratio, diag };
          if (!gov || row.ratio > gov.ratio) gov = row;
        });
      });
      out.push({ sec, cl, mx, my, pc, st, Mrx, Mry, Pr, Vr, Tr, gov, okShape });
    });
    const govAll = out.reduce((a, r) => (r.gov.ratio > a.gov.ratio ? r : a));
    const bGov = Bs[govAll.gov.combo];
    return { rows: out, gov: govAll, Bs, bGov, KLr: 2.1 * Lin / rMid, Lin, rMid, valid: Object.values(Bs).every(b => b.valid) };
  }
  /* memberSteps(res, Fy): worked steps at the governing section */
  function memberSteps(res, Fy, g) {
    const r = res.gov, s = r.sec, cl = r.cl, gv = r.gov, st = [], R = ref, n = f;
    const rd = s.shape === 'round';
    st.push({ id: 'm.phi', label: 'Resistance factors', sym: '\\phi_{f},\\phi_{v},\\phi_{t},\\phi_{c}', eq: '', sub: '', value: '0.90, 0.90, 0.95, 0.90', unit: '', ref: R('Art. 5.5.3.2 (p. 5-6); Art. 5.5.4') });
    st.push({ id: 'm.lam', label: `Width–thickness ratio at z = ${n(s.z, 2)} ft (${rd ? 'round' : s.shape})`, sym: rd ? 'D/t' : 'b/t', eq: rd ? '\\frac{D}{t}' : '\\frac{b}{t},\\,b = B_{max} - 3t',
      sub: rd ? `\\frac{${n(s.D, 3)}}{${n(s.t, 4)}}` : `\\frac{${n(cl.b, 3)}}{${n(s.t, 4)}}`, value: cl.lam, unit: '', d: 2, ref: R('Art. 5.7.2, Table 5.7.2-1 (p. 5-14)'),
      note: `λp = ${n(cl.lp, 1)}, λr = ${n(cl.lrF, 1)} (flexure), ${n(cl.lrC, 1)} (compression), λmax = ${n(cl.lmax, 1)} → ${r.mx.cls}.` + (rd ? '' : cl.bRule === 'B-3t' ? ' Flat width b = B − 3t (no corner radius entered).' : ` Flat width b = (B − 2t) − 2·min(r_i, 4t) with the entered inside corner radius r_i = ${n(s.ri, 3)} in (Art. 5.7.2, Eq. 5.7.2-1 with n = 4).`) });
    st.push({ id: 'm.mn', label: 'Nominal bending strength', sym: 'M_{n}', eq: rd ? (r.mx.cls === 'compact' ? 'Z F_{y}' : r.mx.cls === 'noncompact' ? 'M_{p}\\left[0.77 + \\frac{0.016(E/F_{y})}{D/t}\\right]' : 'M_{p}\\left[\\frac{0.25(E/F_{y})}{D/t}\\right]') : (r.mx.cls === 'compact' ? 'Z F_{y}' : r.mx.cls === 'noncompact' ? 'M_{p}\\left[1.37 - \\frac{0.33(b/t)}{\\sqrt{E/F_{y}}}\\right]' : 'M_{p}\\left[1.23 - \\frac{0.23(b/t)}{\\sqrt{E/F_{y}}}\\right]'),
      sub: `M_{p} = ${n(s.Zx, 3)}\\cdot${n(Fy, 0)} = ${n(r.mx.Mp, 1)}`, value: r.mx.Mn, unit: 'kip-in', d: 1, ref: R('Art. 5.8.2, Table 5.8.2-1 (pp. 5-17, 5-18)') });
    st.push({ id: 'm.pn', label: 'Nominal compressive strength (cantilever K = 2.1, r at mid-height)', sym: 'P_{nc}', eq: 'A_{g}F_{cr},\\,F_{cr} = Q(0.658)^{QF_{y}/F_{e}}F_{y}\\,\\text{or}\\,0.877F_{e}',
      sub: `KL/r = ${n(res.KLr, 1)},\\,Q = ${n(r.pc.Q, 3)},\\,F_{e} = ${n(r.pc.Fe, 2)},\\,F_{cr} = ${n(r.pc.Fcr, 2)}`, value: r.pc.Pn, unit: 'kip', d: 1, ref: R('Art. 5.10.2.1–5.10.2.3, C5.10.2.1 (pp. 5-28)') });
    st.push({ id: 'm.vn', label: 'Nominal shear strength', sym: 'V_{n}', eq: rd ? 'A_{v}F_{nv},\\,A_{v} = A_{g}/2' : 'A_{v}F_{nv},\\,F_{nv} = 0.6F_{y}C_{v}',
      sub: `F_{nv} = ${n(r.st.Fnv, 2)},\\,A_{v} = ${n(r.st.Av, 3)}`, value: r.st.Vn, unit: 'kip', d: 1, ref: R(rd ? 'Eqs. 5.11.2.1.1-1 to -3 (pp. 5-30, 5-31)' : 'Art. 5.11.2.2 (pp. 5-31, 5-32)'),
      note: rd ? 'L_v = the full height (decision Q-C8, accepted 2026-11-02).' : '' });
    st.push({ id: 'm.tn', label: 'Nominal torsional strength', sym: 'T_{n}', eq: 'C_{t}F_{nt}', sub: `${n(r.st.Ct, 3)}\\cdot${n(r.st.Fnt, 2)}`, value: r.st.Tn, unit: 'kip-in', d: 1,
      ref: R(rd ? 'Eqs. 5.11.3-1, 5.11.3.1.1-1/-2 (p. 5-32); Table B.3-1 (C_t = 6.28R²t)' : 'Art. 5.11.3.2 (p. 5-33, 2017)'), note: rd ? '' : r.st.CtB != null ? `C_t = min(AISC 360-16 §H3.1 ${n(r.st.CtA, 3)}, LRFDLTS Table B.3-1 8.00R²t/k_t ${n(r.st.CtB, 3)} with k_t = ${n(r.st.kt, 3)} by Eq. B.3-1) (Table B.3-1 divides by "k_t s"; s is not defined in Appendix B, so the smaller value is used).` : 'C_t = 2(B − t)(H − t)t − 4.5(4 − π)t³ (AISC 360-16 §H3.1; no corner radius entered or rectangular tube).' });
    const b = res.Bs[gv.combo];
    if (b.method === '4.8.1') {
      st.push({ id: 'm.b2', label: 'Second-order amplification, tapered pole (simplified method)', sym: 'B_{2}', eq: '\\frac{1}{1 - P_{eq}/P_{E,bot}},\\,P_{eq} = \\sqrt[3]{I_{B}/I_{T}}\\,P_{T} + 0.38D_{P}',
        sub: `P_{eq} = ${n(b.Peq, 3)},\\,P_{E,bot} = ${n(b.PE, 1)}`, value: b.B, unit: '', d: 4, ref: R('Art. 4.8.1, Eq. 4.8.1-1 (p. 4-3)'),
        note: `Validity kL/r = ${n(b.klr, 1)} ≥ 2π√(E/F_y) = ${n(b.lim, 1)}: ${b.valid ? 'met' : 'NOT met — the detailed method of Art. 4.8.2 is required; the member check is reported as failing'}. k = 2.0, r at mid-height (C4.8.1). P_T: the fixtures and misc. dead load taken at the top; D_P: the pole weight (factored).`, ok: b.valid });
    } else {
      st.push({ id: 'm.b2', label: 'Moment magnifier, prismatic member', sym: 'B', eq: '\\frac{1}{1 - P_{u}/P_{e}},\\,P_{e} = \\frac{\\pi^{2}EA_{g}}{(KL/r)^{2}}', sub: `P_{e} = ${n(b.Pe, 1)},\\,KL/r = ${n(b.klr, 1)}`,
        value: b.B, unit: '', d: 4, ref: R('Eqs. 5.12.1-10, -11 (p. 5-34, 2017)'), ok: b.valid });
    }
    st.push({ id: 'm.dem', label: `Governing demand: ${gv.comboName}, ${gv.lcName}, z = ${n(s.z, 2)} ft`, sym: 'P_{u}, M_{u}, V_{u}, T_{u}', eq: '', sub: '',
      value: `${n(gv.Pu, 2)} kip, ${n(gv.Mu, 1)} kip-in, ${n(Math.hypot(gv.Vx, gv.Vy), 2)} kip, ${n(gv.T, 1)} kip-in`, unit: '', ref: R('Table 3.4-1; Table 3.9.3-1') });
    const eqT = gv.eq === '5.12.1-1' ? '\\frac{P_{u}}{P_{r}} + \\left(\\frac{BM_{u}}{M_{r}} + \\frac{V_{u}}{V_{r}} + \\frac{T_{u}}{T_{r}}\\right)^{2}' : gv.eq === '5.12.1-2' ? '\\frac{P_{u}}{P_{r}} + \\frac{8}{9}\\frac{BM_{u}}{M_{r}}' : '\\frac{P_{u}}{2P_{r}} + \\frac{BM_{u}}{M_{r}}';
    st.push({ id: 'm.int', label: `Combined forces (T_u/T_r = ${n(gv.Trat, 3)} ${gv.Trat > 0.2 ? '> 0.20' : '≤ 0.20: shear and torsion ignored'})`, sym: '\\text{ratio}', eq: eqT,
      sub: `P_{u}/P_{r} = ${n(gv.Pu / gv.Pr, 4)},\\,BM_{u}/M_{r} = ${n(gv.BMr, 4)}` + (gv.eq === '5.12.1-1' ? `,\\,V_{u}/V_{r} = ${n(gv.Vrat, 4)},\\,T_{u}/T_{r} = ${n(gv.Trat, 4)}` : ''),
      value: gv.ratio, unit: '', d: 3, ref: R(`Art. 5.12.1, Eq. ${gv.eq} (p. 5-33, 2017)`), ok: gv.ratio <= 1 && res.valid,
      note: (gv.diag != null ? `Skewed (diagonal) loading, Eq. 5.12.2-1: ${n(gv.diag, 3)}. ` : '') + (s.shape !== 'round' ? 'Biaxial bending on the geometric axes, Eqs. 5.12.1-6/-7.' : 'M_u and V_u: vector sums, Eqs. 5.12.1-4/-5.') });
    return st;
  }

  Object.assign(root.LpLts, { E, PHI, classify, mnOf, pnc, shearTorsion, b2, interaction, memberCheck, memberSteps });

  /* =================== LTS-5 (2026-11-02): deflection (Section 10), fatigue applicability (Section 11), breakaway (Art. 2.5.2, Section 12) ===================
     deflection(g, L, secs): Service I (1.0DC + 1.0W at V_svc, C_v = 1.0; Table 3.4-1) for every load case; elastic double integration of the
     curvature M/(EI) of the cantilever from the base (Art. 10.4.2.1: "usual methods"), amplified by the Service I B₂ (C10.4.2.1: second-order
     effects normally included). Δ in in, slope in in/ft. */
  function deflection(g, L, secs, Fy, Bsvc) {
    const isSign = g.mode === 'sign', nPost = isSign ? Math.max(1, g.sign.nPost || 1) : 1, share = 1 / nPost, Lin = g.H * 12, N = 200, dz = g.H / N;
    const sv = COMBOS.find(c => c.key === 'SV1');
    const B = Bsvc != null ? Bsvc : memberCheck(g, { ...L, tIce: 0 }, secs, Fy).Bs.SV1.B;   // the Service I B (Art. 4.8.1 / Eq. 5.12.1-10)
    const Iat = (z, k) => { const a = secs.reduce((p, s) => (s.z <= z && (!p || s.z > p.z) ? s : p), null) || secs[0], b = secs.find(s => s.z > a.z) || a;
      const t = b.z > a.z ? (z - a.z) / (b.z - a.z) : 0; return a[k] + (b[k] - a[k]) * t; };
    const fixAbove = z => (isSign ? [] : (g.fixtures || [])).filter(x => x.hf >= z);
    const res = LOAD_CASES.map(lc => {
      const fr = caseForces(g, L.Vsvc, 'service', lc);
      let dx = 0, dy = 0, sx = 0, sy = 0;
      for (let i = 0; i < N; i++) {
        const z = (i + 0.5) * dz, w = sectionWind(fr, z);
        let MxD = 0, MyD = 0; fixAbove(z).forEach(x => { MxD += sv.DC * x.W * (x.a || 0) * Math.cos((x.th || 0) * RAD); MyD += sv.DC * x.W * (x.a || 0) * Math.sin((x.th || 0) * RAD); });
        const Mx = (w.Mx + MxD) * share * 12 / 1000, My = (w.My + MyD) * share * 12 / 1000;   // kip-in
        const kx = Mx / (E * Iat(z, 'Ix')), ky = My / (E * Iat(z, 'Iy')), dzi = dz * 12, arm = (g.H - z) * 12;
        dx += kx * arm * dzi; dy += ky * arm * dzi; sx += kx * dzi; sy += ky * dzi;
      }
      const d = B * Math.hypot(dx, dy), th = B * Math.hypot(sx, sy);
      const zz = v => (Math.abs(v) < 1e-9 ? 0 : v);
      return { lc: lc.key, lcName: lc.name, d, slope: th * 12, dx: zz(B * dx), dy: zz(B * dy) };
    });
    // dead load alone (moment-load slope, C10.4.2.1): the eccentric fixture weight
    let s0x = 0, s0y = 0;
    for (let i = 0; i < N; i++) { const z = (i + 0.5) * dz; let MxD = 0, MyD = 0;
      fixAbove(z).forEach(x => { MxD += x.W * (x.a || 0) * Math.cos((x.th || 0) * RAD); MyD += x.W * (x.a || 0) * Math.sin((x.th || 0) * RAD); });
      s0x += MxD * 12 / 1000 / (E * Iat(z, 'Ix')) * dz * 12; s0y += MyD * 12 / 1000 / (E * Iat(z, 'Iy')) * dz * 12; }
    const gov = res.reduce((a, r) => (r.d > a.d ? r : a)), govS = res.reduce((a, r) => (r.slope > a.slope ? r : a));
    const momentLoad = !isSign && (g.fixtures || []).some(x => (x.a || 0) > 0) && Math.hypot(s0x, s0y) > 1e-9;
    const lim = { lum: 0.10 * Lin, trans: 0.025 * Lin, slope: 0.35 };
    const checks = [];
    if (!isSign) checks.push({ key: 'lum', label: 'Luminaire support: top deflection, Service I', value: gov.d, limit: lim.lum, unit: 'in', applies: true, ref: ref('Art. 10.4.2.1 (p. 10-1, 2017): 10 % of the height') });
    // engineer, 2026-11-02 (Q-B4): the 2.5 % H and 0.35 in/ft limits are information only (shown, never a failure); the 10 % H luminaire limit is a check
    checks.push({ key: 'trans', label: 'Vertical support, transverse loads: top deflection, Service I', value: gov.d, limit: lim.trans, unit: 'in', applies: false,
      ref: ref('Art. 10.4.2.1 (p. 10-1, 2017): 2.5 % of the height'), flag: 'Information only (engineer, 2026-11-02): the commentary (C10.4.2.1) describes it as a dead-load appearance limit developed for strain poles.' });
    checks.push({ key: 'slope', label: 'Vertical support, moment loads: slope at the top, Service I', value: govS.slope, limit: lim.slope, unit: 'in/ft', applies: false,
      ref: ref('Art. 10.4.2.1 (p. 10-1, 2017): 0.35 in/ft'), flag: 'Information only (engineer, 2026-11-02)' + (momentLoad ? '; the arm-mounted fixtures put a dead-load moment on the pole.' : '; no unbalanced arm-mounted dead load.') });
    checks.forEach(c => { c.ratio = c.value / c.limit; c.ok = !c.applies || c.ratio <= 1; });
    return { B, rows: res, gov, govS, checks, momentLoad, slopeDL: Math.hypot(s0x, s0y) * 12 };
  }
  /* fatigue applicability: Art. 11.4 (p. 11-3, 2017) lists the structures needing a fatigue design; Art. 11.7.2 (p. 11-10, 2017):
     high-mast lighting towers are 55 ft and taller, luminaire supports under 55 ft need none; C11.4: roadside signs and common lighting
     poles are not included; square lighting poles are more fatigue-prone. */
  function fatigue(g) {
    const isSign = g.mode === 'sign';
    if (isSign) return { required: false, hmlt: false, text: 'Ground-mounted roadside sign support: not among the structure types of Art. 11.4 (C11.4: roadside signs are not included) → fatigue design not required.' };
    if (g.H >= 55) return { required: true, hmlt: true, text: `Pole height ${f(g.H, 1)} ft ≥ 55 ft: a high-mast lighting tower (Art. 5.2) — fatigue design is required (Arts. 11.4, 11.7.2) and at least eight anchor bolts (Art. 5.16). This tool does not design high-mast towers: design it separately.` };
    return { required: false, hmlt: false, text: `Luminaire support ${f(g.H, 1)} ft < 55 ft: fatigue design not required (Art. 11.7.2; Art. 11.4 lists cantilevered and non-cantilevered overhead sign and signal structures and high-mast towers only).` + (g.shape !== 'round' ? ' C11.4: square lighting poles are much more prone to fatigue than round or multi-sided ones — use with caution.' : '') };
  }
  /* breakaway checklist: Art. 2.5.2, 2.5.2.1, 2.5.2.2 (pp. 2-5, 2-6) and Arts. 12.1, 12.3, 12.4, 12.5.1 (pp. 12-1, 12-2, 2017) */
  function breakaway(inClearZone) {
    if (!inClearZone) return { needed: false, items: ['Outside the clear zone or behind a barrier: breakaway hardware not required by Art. 2.5.2 (confirm the clear zone with the roadway designer).'] };
    return { needed: true, items: [
      'Breakaway support required for a luminaire or roadside sign support that cannot be placed outside the clear zone or behind a barrier (Art. 2.5.2).',
      'Use crash-tested breakaway hardware meeting MASH (2009) (Arts. 12.1, 12.5.1); hardware accepted under NCHRP 350 may remain in use (C12.1).',
      'Manufacturer certification of breakaway and structural adequacy, with calculations or test data when the Owner requests (Art. 12.3).',
      'Breakaway components carry the Section 3 loads; load tests, when needed, at not less than the Extreme I loads (Art. 12.4).',
      'Foundation top and anchor projections must not rise enough to snag or impede the breakaway action (Art. 2.5.2.1).',
      'Impact height consistent with the bumper height used in the qualification tests (Art. 2.5.2.2).',
      'Consider electrical disconnects for breakaway supports with electrical components (Art. 2.5.2).'] };
  }

  Object.assign(root.LpLts, { deflection, fatigue, breakaway });
  /* =================== LTS-6 (2026-11-02): base plate and base weld ===================
     basePlate(ba, Bs, bp): rod forces of a circular double-nut base from the factored base actions (Strength I, Extreme I max/min, every
     load case; M amplified by that limit state's B), the largest tension or compression rod force, and the plate thickness by the bending
     line at the pole face: t_req = √(4·P_rod·m/(φ_f·F_y·b_eff)), m = (BC − D)/2, b_eff = πD/n, φ_f = 0.90 (Art. 5.5.3.2). This is an engineering
     method (common practice), not an LRFDLTS article: Art. 5.6.3 (p. 5-7) only requires the thickness to be considered (engineer, Q-C3).
     bp: {n, BC (in), theta0 (deg), D (pole base OD, in), Fy (ksi), t (in)}. Sign: P compression +, Mx = moment of a push toward +x
     (a push toward +x lifts the −x rods). */
  function basePlate(ba, Bs, bp) {
    const n = Math.max(3, Math.round(bp.n)), R = bp.BC / 2, rods = Array.from({ length: n }, (_, i) => { const a = ((bp.theta0 || 0) + 360 * i / n) * RAD; return { x: R * Math.cos(a), y: R * Math.sin(a) }; });
    const Sx2 = rods.reduce((a, r) => a + r.x * r.x, 0), Sy2 = rods.reduce((a, r) => a + r.y * r.y, 0);
    let gov = null;
    ba.rows.filter(r => r.combo !== 'SV1').forEach(r => {
      const B = Bs[r.combo] ? Bs[r.combo].B : 1, Mx = B * r.Mx * 12, My = B * r.My * 12;   // lb-in
      let Tmax = -Infinity, Cmax = -Infinity;
      rods.forEach(q => { const tens = Mx * (-q.x) / Sx2 + My * (-q.y) / Sy2 - r.P / n; Tmax = Math.max(Tmax, tens); Cmax = Math.max(Cmax, -tens); });
      const Prod = Math.max(Tmax, Cmax, 0);
      if (!gov || Prod > gov.Prod) gov = { ...r, B, Tmax, Cmax, Prod };
    });
    const m = Math.max(0, (bp.BC - bp.D) / 2), beff = Math.PI * bp.D / n, tReq = Math.sqrt(4 * gov.Prod * m / (PHI.f * bp.Fy * 1000 * beff));
    return { gov, m, beff, tReq, tProv: bp.t, ok: tReq <= bp.t, ratio: (tReq / bp.t) ** 2, n, R, Sx2 };
  }
  /* baseWeld(ba, Bs, w): socket (fillet-welded) pole-to-plate connection, the weld treated as a line around the tube of diameter D:
     q = √((M/S_w + P/(πD))² + (2V/(πD) + 2T/(πD²))²), S_w = πD²/4 (in²); capacity per AWS D1.1 / AISC 360-16 §J2.4: φR_n = φ·0.60F_EXX·0.707w,
     φ = 0.75 (LRFDLTS Art. 5.14 refers to AWS D1.1 and gives no weld strength method: coordinator decision Q-B5); no directional increase.
     CJP: the base metal governs (the member check at the base); no separate weld check. w: {type 'fillet'|'cjp', size (in), Fexx (ksi), D (in)} */
  function baseWeld(ba, Bs, w) {
    if (w.type === 'cjp') return { type: 'cjp', ok: true };
    const D = w.D, Sw = Math.PI * D * D / 4, phiRn = 0.75 * 0.60 * w.Fexx * 0.707 * w.size;   // kip/in
    let gov = null;
    ba.rows.filter(r => r.combo !== 'SV1').forEach(r => {
      const B = Bs[r.combo] ? Bs[r.combo].B : 1, M = B * r.M * 12 / 1000, P = Math.abs(r.P) / 1000, V = r.V / 1000, T = Math.abs(r.T) * 12 / 1000;
      const qn = M / Sw + P / (Math.PI * D), qs = 2 * V / (Math.PI * D) + 2 * T / (Math.PI * D * D), q = Math.hypot(qn, qs);
      if (!gov || q > gov.q) gov = { ...r, B, Mk: M, Pk: P, Vk: V, Tk: T, qn, qs, q };
    });
    return { type: 'fillet', gov, Sw, phiRn, ratio: gov.q / phiRn, ok: gov.q <= phiRn };
  }

  Object.assign(root.LpLts, { basePlate, baseWeld });

})(typeof window !== 'undefined' ? window : globalThis);
