// apps/ps-bridge: the designs on which the result tabs are tested (PR 2b-2, 2c): tests/engine/psbridge-tabs.test.mjs (worked steps = engine values,
// Node) and tests/psbridge-compare.mjs (harness B: the values the new tabs show = the old app's computeAll on the same inputs, browser).
// TAB_CASES(base) -> { name: project }; base() returns a default psb2.project (PSBModel.defaultProject of the context that uses it).
export const TAB_CASES = base => ({
  'default (BT-72, interior, simple)': base(),
  'continuous 3 spans, exterior G6 in span 2, skew 35°, restraint, haunch in the section': (() => { const P = base(); P.spans = { lengths: [100, 125, 100], continuity: 'composite' };
    P.xs = { nb: 6, bays: [8.5, 8.5, 8.5, 8.5, 8.5], ohL: 2.5, ohR: 3.25, skews: [35, 35, 35, 35] }; P.design = { g: 6, s: 2 }; P.base.cont.restraint = true; P.base.haunchInProps = true; return P; })(),
  'NEXT 36F with a 6 in topping, no draped strands': (() => { const P = base(); P.base.girder = 'NEXT 36F'; P.base.ts = 6; P.xs.bays = [10, 10, 10, 10]; P.base.harp.n = 0; return P; })(),
  'box BIII-36, no topping, debonded row, diaphragm, RIDOT': (() => { const P = base(); P.base.girder = 'AASHTO BIII-36 (27in)'; P.base.ts = 0; P.base.harp.n = 0;
    P.base.rows = [{ n: 12, y: 2, nd: 4, dbnd: 10 }]; P.xs.bays = [3, 3, 3, 3]; P.base.loads.diaph = [{ P: 2, a: 40 }]; P.base.owner = 'RIDOT'; P.base.opt.etaI = true; return P; })(),
  'AASHTO Type IV exterior G1, 85 ft, entered DF, separate deck thickness': (() => { const P = base(); P.base.girder = 'AASHTO Type IV'; P.spans.lengths = [85]; P.design = { g: 1, s: 1 };
    P.base.loads.dfAuto = false; P.base.loads.dfm = 0.65; P.base.loads.dfv = 0.8; P.base.tsSeparate = true; P.base.tsDL = 8.5; P.base.harp.yEnd = 44; return P; })(),
  'entered LL, two continuous spans without restraint, MassDOT': (() => { const P = base(); P.spans = { lengths: [110, 110], continuity: 'composite' }; P.xs.skews = [0, 0, 0]; P.base.owner = 'MassDOT'; return P; })(),
  'simple, entered M_LL / V_LL': (() => { const P = base(); P.base.loads.llAuto = false; P.base.loads.MLL = 2500; P.base.loads.VLL = 110; return P; })(),
  'approximate losses, transformed release, severe corrosion, bonded release steel, entered fatigue DF': (() => { const P = base(); P.base.opt.lossMethod = 'approx'; P.base.opt.useTrans = true;
    P.base.opt.corrosion = 'severe'; P.base.opt.relBondedReinf = true; P.base.opt.relAs = 2; P.base.loads.fatM = 0.45; P.base.opt.dfpSSauto = false; P.base.opt.dfpSS = 1.5; return P; })(),
  'cracked under Service III (few strands), continuous with top steel, two spans': (() => { const P = base(); P.base.rows = [{ n: 10, y: 2, nd: 0, dbnd: 0 }, { n: 8, y: 4, nd: 0, dbnd: 0 }]; P.base.harp.n = 4;
    P.spans = { lengths: [120, 120], continuity: 'composite' }; P.xs.skews = [0, 0, 0]; P.base.cont.restraint = true; P.base.cont.AsTop = 3; return P; })(),
  'flanged flexure (thin deck, 46 strands), two spans, young girder (positive restraint), positive moment connection steel': (() => { const P = base(); P.base.ts = 5; P.xs.bays = [6, 6, 6, 6];
    P.base.rows = [{ n: 16, y: 2, nd: 0, dbnd: 0 }, { n: 16, y: 4, nd: 0, dbnd: 0 }, { n: 14, y: 6, nd: 0, dbnd: 0 }]; P.spans = { lengths: [120, 120], continuity: 'composite' }; P.xs.skews = [0, 0, 0];
    P.base.cont.AsPos = 4; P.base.cont.restraint = true; P.base.mat.td = 10; return P; })()
});
