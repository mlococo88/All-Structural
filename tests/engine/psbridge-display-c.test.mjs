// PS Bridge batch C (2026-11-15, display only): the tables the steel app has.
//   1. Loads & LLDF: the dead loads and distribution factors of every girder line (ctx.all = engine/bridge.js results): one row per girder
//      type × line, each value that line's own engine value (w_g, w_DC1, DC2, DW, DF_M, DF_V, the fatigue DF), each with a § to its step on
//      that type and line (data-sumgo); not in the Report's tab section (no ctx.all);
//   2. Analysis: "Loads and factors used" (engine values with § links), the reactions = the engine's own bxSuperRxPayload (the numbers the
//      hand-off sends), worked in the note with the same numbers;
//   3. Report: "every station" detail (opt.every): the Analysis, Stresses and Flexure tables list every engine station; the default unchanged;
//      §1's girder elevations (opt.sumFig) as figures.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', 'report.js', ...PBDF,
  ...['sections', 'model', 'rigid', 'lldf-fg', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'legacy', 'handoffs', 'worked', 'worked-stress', 'worked-strength', 'worked-end', 'worked-hdr'].map(n => path.join(APP, `engine/${n}.js`)),
  ...['inputs', 'vizkit', 'vizalong', 'outkit', 'section', 'loads', 'analysis', 'strands', 'losses', 'stresses', 'flexure', 'shear', 'endzone', 'camber', 'handling', 'deck', 'rating', 'dash', 'summary', 'bridgedl'].map(n => path.join(APP, `ui/${n}.js`)),
  ...['fromtab', 'data', 'builders'].map(n => path.join(APP, `report/${n}.js`)));
const M = W.PSBModel, B = W.PSBBridge, K = W.PSBOutKit, RB = W.PSBReportBuild;
const J = v => JSON.parse(JSON.stringify(v));
const load = P => M.importJSON(M.exportJSON(P)).project;
const fx = (v, d) => K.fx(v, d);
const CASES = Object.assign({ 'new project': M.defaultProject() }, TAB_CASES(() => M.defaultProject()));

for (const [name, P0] of Object.entries(CASES)) {
  test(`batch C: ${name}`, () => {
    const P = load(P0), Bd = W.PSBReportData.compute(P, null); assert.equal(Bd.err, '');
    const A = B.results(P, inp => W.PSBHoldDown.compute(J(inp))), ctx = { P, inp: Bd.inp, R: Bd.R, W: Bd.W, ui: {}, all: A };
    // 1. every girder line: each row's values = that cell's engine values, each with its § (data-sumgo k|g|tab|step)
    const h = W.PSBUiLoads.output(ctx), card = h.split('Dead loads and distribution factors of every girder line')[1] || '';
    A.cells.forEach(c => { const R = c.R; if (!R || R.error) return;
      const row = new RegExp(`<td>${c.s}</td><td class="lft">G${c.g}[^<]*</td>.*?</tr>`, 's').exec(card); assert.ok(row, `row G${c.g} S${c.s}`);
      [[R.wG, 'sec|sec.g.wsw'], [R.wDk, 'lds|ld.wDC1'], [R.wBar, 'lds|'], [R.wDW, 'lds|'], [R.dfm, 'lds|ld.dfm'], [R.dfv, 'lds|ld.dfv'], [R.fat.dfFat, 'str|st.fat.df']].forEach(([v, lk]) =>
        assert.ok(row[0].includes(`<td>${fx(v, 4)} <a class="wk" href="#" data-sumgo="${c.k}|${c.g}|${lk}`), `G${c.g}: ${v} ${lk}`)); });
    assert.ok(!W.PSBUiLoads.output({ ...ctx, all: undefined }).includes('of every girder line'), 'not in the Report (no ctx.all)');
    // 2. Analysis: the reactions = bxSuperRxPayload; the loads used with their links
    const ha = W.PSBUiAnalysis.output(ctx), pl = W.PSBHandoffs.srPayload(Bd.inp, Bd.R).payload;
    pl.supports.forEach(q => { const g = q.girders[0]; assert.ok(ha.includes(`<td class="lft">${q.id} (x = ${fx(q.x, 2)} ft)</td><td>${fx(g.DC1, 2)}</td><td>${fx(g.DC2, 2)}</td><td>${fx(g.DW, 2)}</td>`), q.id); });
    assert.ok(ha.includes(`= ${fx(pl.supports[0].girders[0].DC1, 3)} kip (w<sub>g</sub>`), 'DC1 worked');
    if (!Bd.R.fe) { const L = +Bd.R.L; assert.ok(Math.abs(pl.supports[0].girders[0].DC2 - Bd.R.wBar * L / 2) < 1e-3, 'DC2 = w L / 2 (hand check)'); }
    assert.match(ha, /Loads and factors used/); assert.ok(ha.includes('data-ev="wDk"') && ha.includes('href="#st-ld.wDC1"'));
    // 3. Report: every station (opt.every) vs the default
    const M0 = RB.model(Bd), M1 = RB.model(Bd, { every: true });
    const nAn = Mo => Mo.vals.filter(v => v.sec === 'an' && /^diagrams\.\d+\.x$/.test(v.path)).length;
    assert.equal(nAn(M1), Bd.R.diagrams.length); assert.ok(nAn(M0) < nAn(M1));
    const nSt = Mo => Mo.vals.filter(v => v.sec === 'str' && /^grid\.\d+\.x$/.test(v.path)).length; assert.equal(nSt(M1), Bd.R.grid.length);
    const nFx = Mo => Mo.vals.filter(v => v.sec === 'flex' && /^flexFull\.\d+\.x$/.test(v.path)).length; assert.equal(nFx(M1), Bd.R.flexFull.length);
    M1.vals.forEach(v => { const x = v.path.split('.').reduce((o, k) => o == null ? o : o[k], Bd.R); assert.equal(v.text, fx(v.div ? x / v.div : x, v.d), v.path); });
    assert.deepEqual(J(W.SharedReport.build(M1).unresolved), []);
    // §1 figure
    const M2 = RB.model(Bd, { sumFig: [{ svg: '<svg/>', cap: 'Girder elevation: X', list: 'Flexure: F at x = 60.00 ft on G2, ratio 0.752 (PASS)' }] });
    const el = M2.sections[0].subs.find(q => /Girder elevations/.test(q.title)); assert.ok(el && el.items.some(i => i.type === 'figure'));
    assert.ok(!M0.sections[0].subs.some(q => /Girder elevations/.test(q.title)));
  });
}
