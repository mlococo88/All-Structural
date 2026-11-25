// apps/ps-bridge EZNI (2026-11-25, engineer: "the end zone has integrals ... there should be no need for calculus in this app output"):
//   the concrete tensile force of AASHTO LRFD 10th Ed. 5.9.2.3.1b (Table 5.9.2.3.1b-1) is worked by parts (engine/worked-end.js tensionParts /
//   tensionSteps): tension depth c = h|f_t|/(|f_t| + |f_c|), the outline cut into layers, F_i = A_i f_i at each layer's centroid, T = ΣF_i.
//   Display only: the result T stays the engine's releaseTensionForce (240 strips; pbd-section.js, frozen).
//   - no integral notation in any step of the PS app (eq, sub, note, label) on the tab designs, with the bonded release steel on;
//   - the parts shown sum to the sum shown, each F_i = A_i f_i, and the T step's value is the engine's;
//   - the by-parts total is within 0.05 kip + 0.1 % of the engine's 240-strip value (they are not equal to the displayed 0.1 kip in every
//     design: see fixlog/ps-bridge.md EZNI; the engine is not changed here);
//   - the hand check: MassDOT NEDBT 48, f_top = -0.631 ksi, f_bot = 4.696 ksi: c = 5.686 in, A = 60 × 5.686 = 341.15 in², f = 0.3155 ksi,
//     T = 107.63 kip by parts (engine 107.61 kip).
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { loadShared, test, ROOT } from './harness.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', 'deck.js', ...PBD, ...['sections', 'model', 'lldf-fg', 'deckdist', 'holddown', 'pierblock', 'design', 'fields', 'inputcheck', 'worked', 'worked-stress', 'worked-strength', 'worked-end', 'worked-hdr'].map(n => path.join(APP, `engine/${n}.js`)));
const RTF = vm.runInContext('releaseTensionForce', W);
const ALL = (inp, R) => [W.PSBWorked.section(inp, R), W.PSBWorked.loads(inp, R), W.PSBWorked.analysis(inp, R), W.PSBWorkedStress.losses(inp, R), W.PSBWorkedStress.stresses(inp, R),
  W.PSBWorkedStrength.flexure(inp, R), W.PSBWorkedStrength.shear(inp, R), W.PSBWorkedEnd.endzone(inp, R), W.PSBWorkedEnd.camber(inp, R),
  W.PSBWorkedHDR.handling(inp, R), W.PSBWorkedHDR.deck(inp, R), W.PSBWorkedHDR.rating(inp, R)].flatMap(r => r.steps);
const INT = /\\int|\\iint|\\oint|∫|\\frac\{d[xyu]\}|\\,d[xyu]\b|\bd[xy]\s*$|integrat/i;
const noteTxt = s => typeof s.note === 'string' ? s.note : JSON.stringify(s.note || '');
const designs = () => { const C = TAB_CASES(() => W.PSBModel.defaultProject());
  for (const g of ['PCI BT-72', 'AASHTO Type I', 'MassDOT NEDBT 48', 'NEXT 24F', 'NEXT 36F', 'AASHTO BI-36 (27in)', 'MassDOT B48-24 adj.', 'Deck slab 18×48 (solid)', 'MassDOT S36-15', 'MassDOT NEXT 36F']) {
    const P = W.PSBModel.defaultProject(); P.base.girder = g; if (!/BT|Type|NEBT|NEDBT/.test(g)) { P.base.harp.n = 0; P.base.rows = [{ n: 10, y: 2, nd: 0, dbnd: 0 }]; } else { P.base.harp.n = 8; P.base.harp.yEnd = 8; }
    C['girder ' + g] = P; }
  Object.values(C).forEach(P => { P.base.opt.relBondedReinf = true; if (!(+P.base.opt.relAs > 0)) P.base.opt.relAs = 0.62; });
  return C; };
const sumParts = (steps, P) => { const ps = steps.filter(s => new RegExp(`^${P.replace(/\./g, '\\.')}\\.p\\d+$`).test(s.id)); return { ps, sum: ps.reduce((a, s) => a + s.value, 0) }; };

let nT = 0;
for (const [name, P] of Object.entries(designs())) {
  test(`EZNI: no integrals, parts sum, T = engine: ${name}`, () => {
    const inp = W.PSBDesign.inputs(P), R = W.PSBHoldDown.compute(inp); assert.equal(R.error, null);
    const steps = ALL(inp, R);
    steps.forEach(s => ['eq', 'sub', 'label', 'sym'].forEach(k => assert.ok(!INT.test(String(s[k] || '')), `${s.id}.${k}: ${s[k]}`)));
    steps.forEach(s => assert.ok(!INT.test(noteTxt(s)), `${s.id} note: ${noteTxt(s)}`));
    assert.ok(!steps.some(s => /240 strips/.test(String(s.eq) + String(s.sub))), 'no strip count in an equation');
    const E = W.PSBWorkedEnd.endzone(inp, R), rs = R.relSteel;
    const cases = [['ez.rel.Ttop', rs.Ttop, E.relParts.top, E.steps], ['ez.rel.Tbot', rs.Tbot, E.relParts.bot, E.steps]];
    const v = R.cont && R.cont.svc;
    if (v && !v.topRC && v.Ttop > 0) { const S = W.PSBWorkedStress.stresses(inp, R).steps; cases.push(['st.pier.Ttop', v.Ttop, W.PSBWorkedEnd.tensionParts(R.g, v.wT.s3TopN, v.wT.s3BotN), S]); }
    for (const [id, Te, tp, S] of cases) {
      const T = S.find(s => s.id === id); assert.ok(T, id);
      assert.ok(Object.is(T.value, Te), `${id}: the step's value is the engine's`);
      if (!tp.from) { assert.equal(Te, 0, id + ': no tension, the engine 0'); continue; }
      const { ps, sum } = sumParts(S, id);
      assert.equal(ps.length, tp.parts.length, id + ' parts');
      assert.ok(Math.abs(sum - tp.T) < 1e-9 * Math.max(1, tp.T), `${id}: Σ F_i = ${sum} vs ${tp.T}`);
      tp.parts.forEach((q, i) => { assert.ok(Math.abs(q.A * q.f - q.F) < 1e-12 * Math.max(1, q.F)); assert.equal(ps[i].sub, `${W.SharedSteps.n(q.A, 2)}(${W.SharedSteps.n(q.f, 4)})`); });
      assert.equal(T.sub, ps.map(s => W.SharedSteps.n(s.value, 2)).join(' + '), id + ': the sum shown lists the parts');
      assert.ok(T.note.includes(`Sum of the parts ${W.SharedSteps.n(tp.T, 2)} kip`) && T.note.includes(`engine's value ${W.SharedSteps.n(Te, 2)} kip`), id + ': both values in the note');
      assert.ok(Math.abs(tp.T - Te) <= 0.05 + 1e-3 * Te, `${id}: by parts ${tp.T} vs engine ${Te}`);
      nT++;
    }
  });
}
test('EZNI: by parts = a fine strip sum of the outline (the parts are exact for a linear stress)', () => {
  const SW = vm.runInContext('sectionWidthAt', W);
  for (const g of ['PCI BT-72', 'MassDOT NEDBT 48', 'NEXT 36F', 'AASHTO Type I']) {
    const P = W.PSBModel.defaultProject(); P.base.girder = g; const R = W.computeAll(W.PSBDesign.inputs(P)), G = R.g;
    for (const [ft, fb] of [[-0.631, 4.696], [3.2, -0.45], [-0.2, -0.1], [-0.05, 2.0]]) {
      const tp = W.PSBWorkedEnd.tensionParts(G, ft, fb), n = 200000, h = G.h; let T = 0;
      for (let i = 0; i < n; i++) { const y = (i + 0.5) * h / n, f = fb + (ft - fb) * y / h; if (f < 0) T += -f * SW(G, y) * h / n; }
      assert.ok(Math.abs(tp.T - T) < 2e-3 + 1e-5 * T, `${g} (${ft}, ${fb}): parts ${tp.T} vs fine ${T}`);
    }
  }
});
test('EZNI: hand check, MassDOT NEDBT 48, f_top = -0.631 ksi, f_bot = 4.696 ksi (the reported screenshot\'s stresses)', () => {
  const P = W.PSBModel.defaultProject(); P.base.girder = 'MassDOT NEDBT 48'; const R = W.computeAll(W.PSBDesign.inputs(P)), G = R.g;
  assert.equal(G.h, 48); assert.equal(G.btf, 60);
  const tp = W.PSBWorkedEnd.tensionParts(G, -0.631, 4.696);
  assert.equal(tp.c.toFixed(3), (48 * 0.631 / 5.327).toFixed(3)); assert.equal(tp.c.toFixed(3), '5.686');
  assert.equal(tp.parts.length, 1); const q = tp.parts[0];
  assert.equal(q.name, 'top flange'); assert.equal(q.A.toFixed(2), '341.15'); assert.equal(q.dbar.toFixed(3), '2.843'); assert.equal(q.f.toFixed(4), '0.3155');
  assert.equal(tp.T.toFixed(2), '107.63'); assert.equal(RTF(G, -0.631, 4.696).toFixed(2), '107.61');
});
test('EZNI: the designs above checked at least 20 tension forces', () => { assert.ok(nT >= 20, 'tension forces checked ' + nT); });
