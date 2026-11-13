// apps/ps-bridge PR 2e: the Report (report/fromtab.js, report/data.js, report/builders.js on shared/report.js), in Node on every design of
//   psbridge-tab-cases.mjs:
//   - 14 sections in the workflow order (summary, project, the twelve result tabs), numbered; every "see §" reference resolves (no "§?"),
//     no duplicate anchor; no NaN / undefined / [object in the text; no "pending engineer review";
//   - every number written in the report is recorded (model.vals) and equals the engine value at its R path as the tabs format it
//     (PSBOutKit.fx, ÷ divisor); each result tab's section records exactly the values the tab shows (data-ev of its output());
//   - the worked steps of each tab are in its section, the same step objects (values = the engine's), in the tab's topics;
//   - the summary lists every engine check (R.checks) once with its demand, limit and ratio and a link to the step that works it;
//   - the assumptions the tabs state are in the report (handling, deck strip method, rating section, MBE labels, PS-10);
//   - the $…$ notation of the converted tab text parses in KaTeX (strict); a section left out leaves no link into it;
//   - building the report changes nothing in R, the inputs or the project.
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { loadShared, test, ROOT } from './harness.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';

const katex = createRequire(import.meta.url)(path.join(ROOT, 'tests/libs/katex@0.16.9/dist/katex.min.js'));
const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', 'report.js', ...PBD,
  ...['model', 'holddown', 'design', 'fields', 'inputcheck', 'worked', 'worked-stress', 'worked-strength', 'worked-end', 'worked-hdr'].map(n => path.join(APP, `engine/${n}.js`)),
  ...['inputs', 'vizkit', 'vizalong', 'outkit', 'section', 'loads', 'analysis', 'strands', 'losses', 'stresses', 'flexure', 'shear', 'endzone', 'camber', 'handling', 'deck', 'rating', 'dash'].map(n => path.join(APP, `ui/${n}.js`)),
  ...['fromtab', 'data', 'builders'].map(n => path.join(APP, `report/${n}.js`)));
const J = x => JSON.parse(JSON.stringify(x));   // vm objects to this realm (deepEqual compares prototypes)
const at = (R, p) => p.split('.').reduce((o, k) => o == null ? o : o[k], R);
const fx = W.PSBOutKit.fx, RB = W.PSBReportBuild;
const CASES = TAB_CASES(() => W.PSBModel.defaultProject());
const katexOk = t => { try { katex.renderToString(t, { ...W.SharedSteps.katexOpt, throwOnError: true, strict: 'error' }); return true; } catch (e) { return false; } };
const stepsOf = s => [].concat(...s.subs.map(q => [].concat(...q.items.filter(i => i.type === 'steps').map(i => i.steps))));

for (const [name, P] of Object.entries(CASES)) {
  test(`report: ${name}`, () => {
    const P0 = JSON.stringify(P), B = W.PSBReportData.compute(P, null); assert.equal(B.err, '');
    const R0 = JSON.stringify(B.R), I0 = JSON.stringify(B.inp);
    const M = RB.model(B), doc = W.SharedReport.build(M), T = W.SharedReport.text(doc);
    assert.deepEqual(J(M.sections.map(s => s.id)), J(RB.SECTIONS.map(s => s[0])));
    assert.deepEqual(J(doc.unresolved), [], 'unresolved references'); assert.deepEqual(J(doc.dup), [], 'duplicate anchors');
    assert.ok(!/NaN|undefined|\[object/.test(T), 'NaN / undefined in the text'); assert.ok(!/pending engineer review/i.test(T));
    // every recorded value = the engine value as the tabs show it
    assert.ok(M.vals.length > 1000, 'values ' + M.vals.length);
    M.vals.forEach(v => { const x = at(B.R, v.path); assert.equal(typeof x, 'number', `${v.sec} ${v.path}`); assert.equal(v.text, fx(v.div ? x / v.div : x, v.d), `${v.sec} ${v.path}`); });
    // each result tab: its values, its steps (the same objects, in the tab's topic order)
    for (const [k, [ui, wk]] of Object.entries(RB.TABS)) {
      const html = W[ui].output({ P, inp: B.inp, R: B.R, W: B.W, ui: {} }), shown = [...html.matchAll(/data-ev="([^"]+)"/g)].map(m => m[1]);
      assert.deepEqual(J(M.vals.filter(v => v.sec === k).map(v => v.path)), shown, `${k}: the tab's values`);
      const sec = M.sections.find(s => s.id === k), st = stepsOf(sec), want = B.W[wk].steps;
      assert.equal(st.length, want.length, `${k}: steps`); st.forEach(s => assert.ok(want.includes(s), `${k}: step ${s.id} is the tab's`));
      const tops = sec.subs.find(q => q.title === 'Worked steps'); if (want.length) assert.ok(tops.items.find(i => i.type === 'steps').topics.length >= 1, k);
      Object.entries(B.W[wk].paths || {}).forEach(([id, p]) => assert.ok(Object.is(st.find(s => s.id === id).value, at(B.R, p)), `${k}: ${id}`));
    }
    // the summary: every check once, linked to its step
    const sum = M.sections[0], rows = sum.subs[0].items.find(i => i.type === 'table').rows;
    assert.equal(rows.length, B.R.checks.length);
    B.R.checks.forEach((c, i) => { assert.ok(M.vals.some(v => v.sec === 'sum' && v.path === `checks.${i}.r`), c.n);
      const r = rows.find(q => q.cells[1] === c.n.replace(/<[^>]*>/g, '')); assert.ok(r && /^see \[\[[\w.]+\]\]$/.test(r.cells[8]), `check ${c.n} has a link`);
      if (r.cells[8] === 'see [[rs.own]]') assert.match(c.n, /\((MassDOT|CTDOT|RIDOT) [\d.]+\)/, 'owner material limit'); });
    // assumptions stated in the tabs
    ['hauling stresses are shown for comparison and not checked', 'strip method', 'governing positive-moment section only', 'MBE 4th Ed. (2026) labels', 'Hold-down force (PS-10)'].forEach(t => assert.ok(T.includes(t), t));
    // the converted notation parses
    const tex = new Set(); JSON.stringify(M.sections).replace(/\$([^$]+)\$/g, (m, t) => { tex.add(JSON.parse(`"${t}"`)); return m; });
    [...tex].forEach(t => assert.ok(katexOk(t), 'KaTeX: ' + t));
    assert.equal(JSON.stringify(B.R), R0); assert.equal(JSON.stringify(B.inp), I0); assert.equal(JSON.stringify(P), P0);
  });
}
test('report: a section left out keeps no link into it; the rest is unchanged', () => {
  const B = W.PSBReportData.compute(W.PSBModel.defaultProject(), null), all = RB.model(B), M = RB.model(B, { include: { loss: false, rt: false } }), doc = W.SharedReport.build(M);
  assert.deepEqual(J(M.sections.map(s => s.id)), J(RB.SECTIONS.map(s => s[0]).filter(k => k !== 'loss' && k !== 'rt')));
  assert.deepEqual(J(doc.unresolved), []); assert.ok(W.SharedReport.text(doc).includes('(section not included)'));
  assert.ok(!M.vals.some(v => v.sec === 'loss' || v.sec === 'rt')); assert.equal(M.vals.length, all.vals.filter(v => v.sec !== 'loss' && v.sec !== 'rt').length);
});
test('report: the page result is used as given (index.html result()); an input error builds nothing', () => {
  const P = W.PSBModel.defaultProject(), inp = W.PSBDesign.inputs(P), R = W.PSBHoldDown.compute(inp), Wk = W.PSBReportData.worked(inp, R);
  const B = W.PSBReportData.compute(P, { inp, R, W: Wk }); assert.equal(B.R, R); assert.equal(B.W, Wk);
  const Q = W.PSBModel.defaultProject(); Q.spans.lengths = [-5]; assert.match(W.PSBReportData.compute(Q, null).err, /input error/);
});
test('report/fromtab.js: the parser and the notation', () => {
  const FT = W.PSBReportTab, X = { vals: [] };
  const C = FT.cards('<div id="gfx_x"><svg><text>skip</text></svg></div><section class="sec"><div class="secHead">Card f<sub>pe</sub></div><div class="secBody"><div class="fRow"><select><option>a</option></select></div>'
    + '<div class="kv"><div><span>A<sub>ps</sub></span><span><span data-ev="ss.Aps" data-d="3">8.680</span> in² <a class="wk" href="#st-sec.Aps">§</a></span></div></div>'
    + '<table class="tbl"><thead><tr><th rowspan="2">x</th><th colspan="2">At release</th></tr><tr><th>f</th><th>P</th></tr></thead><tbody><tr class="ng"><td>1.0</td><td class="ngt">2</td><td><a class="wk" href="#st-a.b" data-gotab="str">§</a></td></tr></tbody></table>'
    + '<p class="note">See the <a href="#" data-gotab="str">Stresses tab</a> and the <a href="#" data-goin="mat">Materials tab</a> &amp; M<sub>LL−</sub>.</p></div></section>', { tab: 'loss', X, sec: 'loss', inReport: t => t === 'str' });
  assert.equal(C.subs.length, 1); const s = C.subs[0]; assert.equal(s.title, 'Card f$_{pe}$');
  assert.deepEqual(J(s.items[0]), { type: 'kv', rows: [['A$_{ps}$', '8.680 in² (see [[sec.Aps]])']] });
  assert.deepEqual(J(s.items[1].head), ['x', 'At release f', 'At release P']); assert.deepEqual(J(s.items[1].rows[0]), { cells: [{ t: '1.0', n: true }, { t: '2', n: true, cls: 'ng' }, { t: 'see [[a.b]]' }], cls: 'gov' });
  assert.equal(s.items[2].text, 'See the [[tab:str|Stresses tab]] ([[rs.str]]) and the [[tab:in:mat|Materials tab]] & M$_{LL-}$.');
  assert.deepEqual(J(X.vals), [{ sec: 'loss', path: 'ss.Aps', d: 3, div: 0, text: '8.680' }]);
  assert.ok(katexOk('_{LL-}') && katexOk('_{\\theta}'));
});
