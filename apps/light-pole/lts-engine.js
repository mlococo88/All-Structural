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
})(typeof window !== 'undefined' ? window : globalThis);
