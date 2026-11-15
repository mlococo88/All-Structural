// apps/ps-bridge batch D1 (2026-11-15): the designs whose demands come from a MIDAS file or a custom table (engine/demands.js, P.demands),
// for tests/engine/psbridge-midas.test.mjs (Node) and tests/psbridge-compare.mjs (harness B: every value the tabs show = the old app's
// computeAll of the same inputs, the old app's own MIDAS path). Kept apart from psbridge-tab-cases.mjs (whose 19 designs other tests count).
// MIDAS_CASES(base, F) -> { name: project }; base() returns a default psb2.project; F = midasFixtures(read) (the files, read by the caller).
// The file is evaluated as text in the browser by harness B: no imports here.
export const MIDAS_CASES = (base, F) => {
  const at = '2026-11-15T12:00:00.000Z';
  const midas = (file, name, span) => ({ T1: Object.assign({ src: 'midas', midas: { file, name, at } }, span ? { span } : {}) });
  return {
    'MIDAS 3 spans 100/120/100 (the old app\'s test file), span 2, made continuous, DF per effect': (() => { const P = base();
      P.spans = { lengths: [100, 120, 100], continuity: 'composite' }; P.xs.skews = [0, 0, 0, 0]; P.design = { g: 2, s: 2 };
      Object.assign(P.base.loads, { extDFpos: 0.62, extDFneg: 0.68, extDFv: 0.74, extLLmpf: 1 }); P.demands = midas(F.ps3, 'midas_3span.json'); return P; })(),
    'MIDAS 110/140/110 (MCT Generator file), span 1, exterior G1, made continuous, m 1.2': (() => { const P = base();
      P.spans = { lengths: [110, 140, 110], continuity: 'composite' }; P.xs.skews = [0, 0, 0, 0]; P.design = { g: 1, s: 1 };
      Object.assign(P.base.loads, { extDFpos: 0.55, extDFneg: 0.6, extDFv: 0.65, extLLmpf: 1.2 }); P.demands = midas(F.mct, 'mct_psbeam_selfweight_excluded.json'); return P; })(),
    'MIDAS 110/140/110, span 2 (both ends at piers), restraint on, the span chosen': (() => { const P = base();
      P.spans = { lengths: [110, 140, 110], continuity: 'composite' }; P.xs.skews = [0, 0, 0, 0]; P.design = { g: 2, s: 2 }; P.base.cont.restraint = true;
      Object.assign(P.base.loads, { extDFpos: 0.6, extDFneg: 0.6, extDFv: 0.7, extLLmpf: 1 }); P.demands = midas(F.mct, 'mct_psbeam_selfweight_excluded.json', 2); return P; })(),
    'MIDAS simple span 120 ft (one-span member), DF blank = 1.0': (() => { const P = base();
      Object.assign(P.base.loads, { extDFpos: '', extDFneg: '', extDFv: '', extLLmpf: '' }); P.demands = midas(F.simple, 'simple120.json'); return P; })(),
    'custom demand table, simple span 120 ft, DF 0.7 / m 1.0': (() => { const P = base();
      Object.assign(P.base.loads, { extDFpos: 0.7, extDFneg: 0.7, extDFv: 0.8, extLLmpf: 1 });
      P.demands = { T1: { src: 'table', table: { rows: [
        { x: 0, M_DC2: 0, M_DW: 0, M_LLpos: 0, M_LLneg: 0, V_DC2: 21, V_DW: 16.8, V_LLpos: 118, V_LLneg: -12 },
        { x: 30, M_DC2: 472.5, M_DW: 378, M_LLpos: 2350, M_LLneg: 0, V_DC2: 10.5, V_DW: 8.4, V_LLpos: 92, V_LLneg: -24 },
        { x: 60, M_DC2: 630, M_DW: 504, M_LLpos: 3050, M_LLneg: 0, V_DC2: 0, V_DW: 0, V_LLpos: 64, V_LLneg: -64 },
        { x: 90, M_DC2: 472.5, M_DW: 378, M_LLpos: 2350, M_LLneg: 0, V_DC2: -10.5, V_DW: -8.4, V_LLpos: 24, V_LLneg: -92 },
        { x: 120, M_DC2: 0, M_DW: 0, M_LLpos: 0, M_LLneg: 0, V_DC2: -21, V_DW: -16.8, V_LLpos: 12, V_LLneg: -118 }] } } };
      return P; })()
  };
};
/* midasFixtures(read): the files; read(rel) returns the parsed JSON of tests/projects/<rel>. The old app's test file is its stored external
   without the span it chose (_selSpan; a file as the MCT Generator writes it); simple120 is made here: a 120 ft simple span, stations every
   6 ft, DC2 0.35 klf and DW 0.28 klf (M = w x (L − x) / 2, V = w (L/2 − x)), an LL+IM envelope (M+ = 2400 × 4x(L − x)/L², M− = 0,
   V+ = 95 (1 − x/L) + 10, V− = −(95 x/L + 10)), shears in the file's (MIDAS) sign: the negative of this app's. */
export const midasFixtures = read => {
  const ps3 = JSON.parse(JSON.stringify(read('ps/midas_3span.json').external)); delete ps3._selSpan;
  const mct = read('ext/mct_psbeam_selfweight_excluded.json');
  const L = 120, st = [];
  for (let x = 0; x <= L + 1e-9; x += 6) {
    const r = v => Math.round(v * 1000) / 1000, M = w => r(w * x * (L - x) / 2), V = w => r(-(w * (L / 2 - x)));
    const vp = 95 * (1 - x / L) + 10, vn = -(95 * x / L + 10);
    st.push({ x, M_DC1: 0, V_DC1: 0, M_DC2: M(0.35), V_DC2: V(0.35), M_DW: M(0.28), V_DW: V(0.28), M_LLpos: r(2400 * 4 * x * (L - x) / (L * L)), M_LLneg: 0, V_LLpos: r(-vn), V_LLneg: r(-vp) });
  }
  const simple = { _schema: 'psbeam-external-demands', _version: 1, source: 'midas', generatedBy: 'test fixture (batch D1)', generatedAt: '2026-11-15T12:00:00.000Z', project: 'Simple span 120 ft (test)',
    units: { force: 'kip', length: 'ft', moment: 'ft-kip' }, factored: false, liveLoadType: 'HL-93', selfWeightExcluded: true, imIncluded: true, dfIncluded: true,
    member: { mode: 'beam', key: 'G2', type: 'beam', span: 120, supports: [0, 120], spans: [120], totalLength: 120 }, stationCount: st.length, stations: st, warnings: [] };
  return { ps3, mct, simple };
};
