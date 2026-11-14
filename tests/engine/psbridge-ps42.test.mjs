// apps/ps-bridge PS-42 (engineer decision 2026-11-14, PS37-D4): a MassDOT NEDBT with no cast-in-place topping (t_s = 0) keeps the engine's
// type (k) distribution factors (no calculation change) but is flagged (engine/sections.js noTop / noTopText; ui/loads.js #nedbtNoTop;
// ui/inputs.js #secNoTopNote; the Report's Loads & LLDF section through report/fromtab.js):
//   (1) the condition: every NEDBT with t_s = 0 and the DF computed; not with a topping, an entered DF or live load, or any other shape;
//   (2) the Loads & LLDF tab's DF card: the warning (with the worked-step links) only then; the DF itself unchanged (the engine's);
//   (3) the Report's Loads & LLDF section: the matching line with its "see §" references, once per worked girder type / line on an NEDBT with
//       no topping (every girder line too); none otherwise;
//   (4) the Girders & strands tab's shape card: the warning only then.
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const ENG = ['sections', 'model', 'rigid', 'lldf-fg', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'legacy', 'worked', 'worked-stress', 'worked-strength', 'worked-end', 'worked-hdr'].map(n => path.join(APP, `engine/${n}.js`));
const UI = ['inputs', 'vizkit', 'vizalong', 'outkit', 'section', 'loads', 'analysis', 'strands', 'losses', 'stresses', 'flexure', 'shear', 'endzone', 'camber', 'handling', 'deck', 'rating', 'dash', 'summary', 'bridgedl'].map(n => path.join(APP, `ui/${n}.js`));
const W = loadShared('steps.js', ...PBD, ...ENG, ...UI, 'report.js', ...['fromtab', 'data', 'builders'].map(n => path.join(APP, `report/${n}.js`)));
const S = W.PSBSections, J = v => JSON.parse(JSON.stringify(v));
const NEDBT = S.ORDER_MD.filter(n => S.MD[n].src.fam === 'nedbt');
const WARN = 'No cast-in-place topping is entered for this ';
/* a design: girder, topping, span L, 5 girders at 8 ft, the design girder g */
const proj = (girder, ts, L, g, f) => { const P = W.PSBModel.defaultProject(); P.base.girder = girder; P.base.ts = ts; P.base.harp.n = 0; P.base.rows = [{ n: 14, y: 2.5, nd: 0, dbnd: 0 }, { n: 14, y: 4.5, nd: 0, dbnd: 0 }];
  P.xs.nb = 5; P.xs.bays = [8, 8, 8, 8]; P.spans.lengths = [L]; P.design = { g: g || 2, s: 1 }; if (f) f(P); return P; };
const run = P => { const inp = W.PSBDesign.inputs(P); return { inp, R: W.PSBHoldDown.compute(J(inp)) }; };
const loadsHtml = P => { const { inp, R } = run(P); return { inp, R, html: W.PSBUiLoads.output({ P, inp, R, W: { loads: W.PSBWorked.loads(inp, R) }, ui: {} }) }; };

test('PS-42 (1): the condition: an NEDBT with t_s = 0 and the DF computed; nothing otherwise', () => {
  assert.deepEqual(J(NEDBT), ['MassDOT NEDBT 40', 'MassDOT NEDBT 48', 'MassDOT NEDBT 56', 'MassDOT NEDBT 64', 'MassDOT NEDBT 72', 'MassDOT NEDBT 80']);
  const inp = (girder, ts, ll, df) => ({ girder, ts, loads: { llAuto: ll !== false, dfAuto: df !== false } });
  NEDBT.forEach(n => { assert.equal(S.noTop(inp(n, 0)), true, n); assert.equal(S.noTop(inp(n, '0')), true, n); assert.equal(S.noTop(inp(n, '')), true, n);
    assert.ok(S.noTopText(inp(n, 0)).startsWith(`${WARN}${n} (deck thickness t<sub>s</sub> = 0, PS-42)`), n);
    [0.5, 6, 8].forEach(t => { assert.equal(S.noTop(inp(n, t)), false, n + ' ts ' + t); assert.equal(S.noTopText(inp(n, t)), ''); });
    assert.equal(S.noTop(inp(n, 0, true, false)), false, 'DF entered'); assert.equal(S.noTop(inp(n, 0, false, true)), false, 'LL entered'); });
  S.ORDER_MD.filter(n => S.MD[n].src.fam !== 'nedbt').concat(['PCI BT-72', 'NEXT 36F', 'AASHTO BIII-36 (39in)', 'AASHTO SIV-48 (21in)', 'Custom'])
    .forEach(n => { assert.equal(S.noTop(inp(n, 0)), false, n); assert.equal(S.noTopText(inp(n, 0)), '', n); });
  [null, undefined, {}, { girder: 'MassDOT NEDBT 64', ts: 0 }].forEach(v => assert.equal(S.noTop(v), false));
  const t = S.noTopText(inp('MassDOT NEDBT 64', 0));
  assert.ok(t.includes('likely very conservative') && t.includes('Add the topping') && t.includes('review the distribution factor by hand') && t.includes('data-goin="xsec"') && t.includes('data-goin="loads"'));
  assert.ok(!/pending/i.test(t));
});

test('PS-42 (2): the Loads & LLDF tab: the warning next to the DF only for an NEDBT with no topping; the DF is the engine\'s, unchanged', () => {
  [1, 2].forEach(g => {
    const a = loadsHtml(proj('MassDOT NEDBT 64', 0, 80, g));
    assert.ok(a.R.dfm > 4 && a.R.dfm < 6, `DF_M ${a.R.dfm}`);
    const R0 = vm.runInContext('computeAll', W)(J(a.inp)); assert.equal(a.R.dfm, R0.dfm); assert.equal(a.R.dfv, R0.dfv);   // the engine's factors (no calculation change)
    const i = a.html.indexOf('id="nedbtNoTop"'), c = a.html.indexOf('Live load distribution factors: ');
    assert.ok(i > c && c > 0, 'in the DF card'); assert.ok(a.html.indexOf('DF<sub>M</sub> used') < i, 'after the DF');
    assert.ok(a.html.slice(i).includes(`${WARN}MassDOT NEDBT 64`) && /href="#st-ld\.m1"/.test(a.html.slice(i, i + 2000)) && /href="#st-ld\.m2"/.test(a.html.slice(i, i + 2000)));
  });
  [proj('MassDOT NEDBT 64', 8, 80), proj('MassDOT NEBT 1400', 0, 80), proj('PCI BT-72', 0, 80), proj('MassDOT NEDBT 64', 0, 80, 2, P => { P.base.loads.dfAuto = false; P.base.loads.dfm = 0.7; P.base.loads.dfv = 0.8; })]
    .forEach(P => assert.ok(!loadsHtml(P).html.includes('nedbtNoTop'), P.base.girder + ' ' + P.base.ts));
  // a topping: the type (k) factors with K_g / 12 L t_s³ (well below the no-topping value)
  assert.ok(run(proj('MassDOT NEDBT 64', 8, 80)).R.dfm < 1);
});

test('PS-42 (3): the Report\'s Loads & LLDF section: the matching line with "see §" references, for every worked unit on an NEDBT with no topping', () => {
  const typed = P => { P.types = W.PSBBridge.newTypes(P); return P; };   // girder types (engine/model.js newProject)
  const lds = M => M.sections.filter(q => /^lds/.test(q.id) || /Loads & LLDF/.test(q.title || ''));
  const walk = (v, out) => { if (Array.isArray(v)) v.forEach(x => walk(x, out)); else if (v && typeof v === 'object') { if (typeof v.text === 'string' && v.text.includes(WARN)) out.push(v); Object.values(v).forEach(x => walk(x, out)); } return out; };
  const notes = M => walk(lds(M), []), lines = M => notes(M).length;
  const B = W.PSBReportData.compute(typed(proj('MassDOT NEDBT 64', 0, 80)), null, 'gov'); assert.equal(B.err, '');
  const M = W.PSBReportBuild.model(B, {}), t = JSON.stringify(lds(M));
  assert.ok(B.units.length >= 2, 'interior and exterior types'); assert.equal(lines(M), B.units.length, 'one line per worked unit');
  assert.ok(/NEDBT without a topping: the distribution factor is likely very conservative No cast-in-place topping is entered for this MassDOT NEDBT 64/.test(t), t.slice(0, 400));
  notes(M).forEach(n => { assert.equal(n.type, 'note'); assert.equal(n.warn, true, 'a warning'); });
  assert.ok(/The moment factors g\$_\{M1\}\$ \(see \[\[u0\/ld\.m1\]\]\) and g\$_\{M2\}\$ \(see \[\[u0\/ld\.m2\]\]\) are worked in the Loads & LLDF steps\./.test(notes(M)[0].text), notes(M)[0].text);   // "see §x.y" in print
  assert.ok(!JSON.stringify(M.sections.filter(q => !lds(M).includes(q))).includes(WARN), 'only in the Loads & LLDF section');
  // every girder line
  const Ba = W.PSBReportData.compute(typed(proj('MassDOT NEDBT 64', 0, 80)), null, 'all'), Ma = W.PSBReportBuild.model(Ba, {});
  assert.equal(Ba.units.length, 5); assert.equal(lines(Ma), 5);
  // none with a topping, or another shape
  [proj('MassDOT NEDBT 64', 8, 80), proj('MassDOT NEBT 1400', 8, 80)].forEach(P => { const Bn = W.PSBReportData.compute(typed(P), null, 'gov'); assert.equal(Bn.err, ''); assert.equal(lines(W.PSBReportBuild.model(Bn, {})), 0, P.base.girder); });
});

test('PS-42 (4): the Girders & strands tab\'s shape card: the warning only for an NEDBT with no topping', () => {
  const tab = P => W.PSBInputsUI.cards('gird', P);
  const h = tab(proj('MassDOT NEDBT 48', 0, 60)), i = h.indexOf('id="secNoTopNote"');
  assert.ok(i > 0 && h.slice(i).includes(`${WARN}MassDOT NEDBT 48`) && h.slice(i, i + 1500).includes('data-gotab="lds"'));
  assert.ok(i < h.indexOf('id="card-rows"'), 'on the shape card');
  [proj('MassDOT NEDBT 48', 6, 60), proj('MassDOT NEBT 1000', 0, 60), proj('PCI BT-72', 8, 60)].forEach(P => assert.ok(!tab(P).includes('secNoTopNote'), P.base.girder));
});
