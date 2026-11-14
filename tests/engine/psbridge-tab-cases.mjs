// apps/ps-bridge: the designs on which the result tabs are tested (PR 2b-2, 2c, 2d): tests/engine/psbridge-tabs.test.mjs (worked steps = engine values,
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
  // PS-28 (2026-11-14): the strand rows fit the BT-72 (16 / 16 / 14 at y = 2 / 4 / 6 in drew strands outside its 26 in bottom flange, now an
  // input error): 12 / 12 / 8 / 2 at y = 2 / 4 / 6 / 8 in + the 12 draped = 46 strands; the section is still flanged (b1 c > h_f)
  'flanged flexure (thin deck, 46 strands), two spans, young girder (positive restraint), positive moment connection steel': (() => { const P = base(); P.base.ts = 5; P.xs.bays = [6, 6, 6, 6];
    P.base.rows = [{ n: 12, y: 2, nd: 0, dbnd: 0 }, { n: 12, y: 4, nd: 0, dbnd: 0 }, { n: 8, y: 6, nd: 0, dbnd: 0 }, { n: 2, y: 8, nd: 0, dbnd: 0 }]; P.spans = { lengths: [120, 120], continuity: 'composite' }; P.xs.skews = [0, 0, 0];
    P.base.cont.AsPos = 4; P.base.cont.restraint = true; P.base.mat.td = 10; return P; })(),
  // PR 2d-1: the owner hold-down and debonded-share checks (CTDOT), debonded rows on an I-girder, diaphragms (camber), the girder end past ℄ bearing
  'CTDOT, debonded rows, diaphragms, girder end 9 in past the bearing': (() => { const P = base(); P.base.owner = 'CTDOT';
    P.base.rows = [{ n: 12, y: 2, nd: 4, dbnd: 8 }, { n: 12, y: 4, nd: 2, dbnd: 12 }, { n: 4, y: 6, nd: 0, dbnd: 0 }]; P.base.loads.diaph = [{ P: 3, a: 40 }, { P: 3, a: 80 }]; P.base.opt.endOh = 9; return P; })(),
  // PR 2d-2: the Handling and Deck modules on, rating vehicles (one with no shear, one without weight), φ_c φ_s floored at 0.85
  'handling and deck on, rating vehicles, φc φs floored': (() => { const P = base(); P.base.handling.on = true; P.base.deck.on = true; P.base.opt.rtPhiC = 0.9; P.base.opt.rtPhiS = 0.9;
    P.base.rateVeh = [{ name: 'Type 3S2', M: 1800, V: 90, W: 36 }, { name: 'Permit', M: 3600, V: 0, W: 0 }]; return P; })(),
  // PR 2d-2: an owner (η, live-load multiplier) on the deck, the design section entered, a wide overhang, separate DL deck thickness; handling moved
  // supports and a steep cross slope; two continuous spans (rating on the continuous unit), exterior girder
  'MassDOT, continuous, exterior G1, deck design section entered, handling 8 ft lift points': (() => { const P = base(); P.base.owner = 'MassDOT';
    P.spans = { lengths: [110, 110], continuity: 'composite' }; P.xs.skews = [0, 0, 0]; P.xs.ohL = 4.5; P.design = { g: 1, s: 1 };
    P.base.deck.on = true; P.base.deck.xnegAuto = false; P.base.deck.xneg = 9; P.base.tsSeparate = true; P.base.tsDL = 8.5;
    P.base.handling.on = true; P.base.handling.aLift = 8; P.base.handling.aHaul = 10; P.base.handling.theta_i = 0.06; P.base.rateVeh = [{ name: 'Type 3', M: 1500, V: 70, W: 25 }]; return P; })(),
  // PR 2d-2: deck on a box beam with a topping (closed box: the design section at the face of the support), girder spacing below Table A4-1
  // PS-28 (2026-11-14): the strand rows fit the 5 in bottom wall (8 strands at y = 4 in were 1 in from the void, now an input error): 16 at y = 2 in
  'box BIII-36 with a 6 in topping, deck on (S below 4 ft), handling on': (() => { const P = base(); P.base.girder = 'AASHTO BIII-36 (27in)'; P.base.ts = 6; P.base.harp.n = 0;
    P.base.rows = [{ n: 16, y: 2, nd: 0, dbnd: 0 }]; P.xs.bays = [3, 3, 3, 3]; P.spans.lengths = [60]; P.base.deck.on = true; P.base.handling.on = true; return P; })(),
  // PR 2d-3 (PS-10): the hold-down check for RIDOT with an edited limit (0.90 W) and the girder end past the bearing; AASHTO with the box off
  'RIDOT, draped strands, hold-down limit 0.90 W, girder end 6 in past the bearing': (() => { const P = base(); P.base.owner = 'RIDOT'; P.base.opt.hdFrac = 0.9; P.base.opt.endOh = 6; P.base.harp.n = 8; P.base.harp.yEnd = 50; return P; })(),
  'AASHTO, PS-10 hold-down box off': (() => { const P = base(); P.base.opt.hdCheck = false; return P; })(),
  // 2026-11-13: the RIDOT girder age at continuity (RIDOT 5.6.3.3; continuity on): deck / continuity placed at t_d = 60 days < 90 days (FAIL, 90 / 60 = 1.500)
  'RIDOT, two continuous spans, continuity at a girder age of 60 days': (() => { const P = base(); P.base.owner = 'RIDOT'; P.spans = { lengths: [110, 110], continuity: 'composite' }; P.xs.skews = [0, 0, 0];
    P.base.mat.td = 60; return P; })()
});
