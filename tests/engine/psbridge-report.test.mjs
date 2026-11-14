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
  ...['sections', 'model', 'holddown', 'design', 'fields', 'inputcheck', 'worked', 'worked-stress', 'worked-strength', 'worked-end', 'worked-hdr'].map(n => path.join(APP, `engine/${n}.js`)),
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
// 2026-11-13 (display): the owner's limits in the check summary column ("Materials (owner limits)", renamed "Owner limits" when the RIDOT girder
// age at continuity joined it; counted in its totals) and the Report's §1 consistent with the column: the same groups, the same checks counted
const MATG = () => W.PSBDashUI.GROUPS.find(g => g.id === 'mat');
const colCount = R => { const N = new Set(W.PSBDashUI.GROUPS.flatMap(g => g.checks.map(q => q[0]))), cs = R.checks.filter(c => N.has(c.n)); return { n: cs.length, nF: cs.filter(c => !c.pass).length, out: R.checks.filter(c => !N.has(c.n)) }; };
for (const [name, P] of Object.entries(CASES)) {
  test(`check summary column and §1: ${name}`, () => {
    const B = W.PSBReportData.compute(P, null), M = RB.model(B), rows = M.sections[0].subs[0].items.find(i => i.type === 'table').rows, cc = colCount(B.R);
    assert.deepEqual(J(cc.out.map(c => c.n)), [], 'every check of the tab designs is in a group of the column');
    assert.equal(rows.filter(r => r.cells[0] !== '—').length, cc.n); assert.equal(rows.filter(r => r.cells[7].t === 'FAIL').length, cc.nF);
    rows.forEach(r => { const g = W.PSBDashUI.GROUPS.find(q => q.checks.some(z => z[0] === r.cells[1])); assert.equal(r.cells[0], g.name, r.cells[1]); });
    B.R.checks.filter(c => MATG().checks.some(q => q[0] === c.n)).forEach(c => { const r = rows.find(q => q.cells[1] === c.n); assert.equal(r.cells[0], 'Owner limits'); assert.equal(r.cells[8], 'see [[rs.own]]'); });
    assert.ok(!W.SharedReport.text(W.SharedReport.build(M)).includes('Not in the check summary column'));
  });
}
test('Owner limits: CTDOT f′ci 6.8 > 6.5 ksi FAILs (ratio 1.046), counted in the column; the Owner rules table shows the engine values', () => {
  const P = CASES['CTDOT, debonded rows, diaphragms, girder end 9 in past the bearing'], B = W.PSBReportData.compute(P, null), R = B.R;
  const i = R.checks.findIndex(c => c.n === 'Release strength f′ci (CTDOT 5.9.1.2)'), c = R.checks[i];
  assert.equal(c.v, 6.8); assert.equal(c.lim, 6.5); assert.equal(fx(c.r, 3), '1.046'); assert.equal(c.pass, false);
  const cc = colCount(R); assert.ok(cc.nF >= 1 && cc.n === R.checks.length);
  const h = W.PSBInputsUI.cards('own', P, R);
  assert.match(h, /<tr id="own-rule-fci\.range">/); assert.match(h, /<tr id="own-rule-fc\.range">/);
  const ev = [...h.matchAll(/data-ev="([^"]+)" data-d="(\d)">([^<]*)</g)].map(m => [m[1], m[3]]);
  assert.deepEqual(ev.filter(e => e[0].startsWith(`checks.${i}.`)), [[`checks.${i}.v`, '6.80'], [`checks.${i}.lim`, '6.50'], [`checks.${i}.v`, '6.80'], [`checks.${i}.lim`, '6.50'], [`checks.${i}.r`, '1.046']]);
  ev.forEach(([p, t]) => { const k = p.split('.').pop(); assert.equal(t, fx(at(R, p), k === 'r' ? 3 : 2), p); });
  assert.ok(/FAIL/.test(h.slice(h.indexOf('own-rule-fci.range'))));
  // the girder f′c (CTDOT range 6.0–10.0 ksi): f′c 8.5 ksi, governing maximum 10.0, ratio 0.850 = value / limit
  const j = R.checks.findIndex(c => c.n === 'Girder f′c (CTDOT 5.9.1.2)'); assert.equal(fx(R.checks[j].r, 3), '0.850'); assert.match(h, /governing maximum/);
  const M = RB.model(B), own = M.sections[1].subs.find(s => s.key === 'rs.own'); assert.ok(own && JSON.stringify(own.items).includes('1.046'));
  assert.ok(M.vals.some(v => v.sec === 'proj' && v.path === `checks.${i}.r` && v.text === '1.046'));
  // without a result (an input error) the table says so and shows no number
  assert.match(W.PSBInputsUI.cards('own', P), /shown when the inputs have no error/);
});
test('Owner limits: RIDOT f′c minimum (limit / value); AASHTO has no owner-limit check', () => {
  const P = CASES['box BIII-36, no topping, debonded row, diaphragm, RIDOT'], B = W.PSBReportData.compute(P, null), R = B.R, h = W.PSBInputsUI.cards('own', P, R);
  const i = R.checks.findIndex(c => c.n === 'Girder f′c (RIDOT 5.2.1)'); assert.ok(i >= 0); assert.match(h, /governing minimum/);
  assert.ok(h.includes(`ratio = <span data-ev="checks.${i}.lim" data-d="2">5.00</span> / <span data-ev="checks.${i}.v"`));
  assert.ok(!R.checks.some(c => c.n === 'Girder age at continuity (RIDOT 5.6.3.3)'), 'simple span: no age check');
  const A = W.PSBReportData.compute(CASES['default (BT-72, interior, simple)'], null); assert.ok(!A.R.checks.some(c => MATG().checks.some(q => q[0] === c.n)));
});
// 2026-11-13 (display; decision pending the engineer's review): the RIDOT girder age at continuity (RIDOT 5.6.3.3, continuity on) in the
// "Owner limits" group: counted in the column, its Owner rules row (own-rule-cont.age) shows t_d, the minimum and the ratio; §1 has no
// "not in the column" note
test('Owner limits: RIDOT girder age at continuity (t_d 60 < 90 days FAILs, 1.500; t_d 90 PASSes, 1.000), counted, in the Owner rules table, §1', () => {
  const N = 'Girder age at continuity (RIDOT 5.6.3.3)', P = CASES['RIDOT, two continuous spans, continuity at a girder age of 60 days'], B = W.PSBReportData.compute(P, null), R = B.R;
  const i = R.checks.findIndex(c => c.n === N), c = R.checks[i]; assert.ok(i >= 0);
  assert.equal(c.v, 60); assert.equal(c.lim, 90); assert.equal(c.u, 'days'); assert.equal(fx(c.r, 3), '1.500'); assert.equal(c.pass, false);
  assert.deepEqual(J(MATG().checks.find(q => q[0] === N)), ['Girder age at continuity (RIDOT 5.6.3.3)', 'own-rule-cont.age']); assert.equal(MATG().name, 'Owner limits');
  const cc = colCount(R); assert.deepEqual(J(cc.out.map(q => q.n)), []); assert.equal(cc.n, R.checks.length); assert.ok(cc.nF >= 1);
  const h = W.PSBInputsUI.cards('own', P, R), row = h.slice(h.indexOf('<tr id="own-rule-cont.age">')); assert.ok(h.includes('<tr id="own-rule-cont.age">'));
  const cell = row.slice(0, row.indexOf('</tr>'));
  assert.ok(cell.includes(`t<sub>d</sub> (girder age at continuity) = <span data-ev="checks.${i}.v" data-d="0">60</span> days; governing minimum <span data-ev="checks.${i}.lim" data-d="0">90</span> days; ratio = <span data-ev="checks.${i}.lim" data-d="0">90</span> / <span data-ev="checks.${i}.v" data-d="0">60</span> = <b><span data-ev="checks.${i}.r" data-d="3">1.500</span></b>`), cell);
  assert.match(cell, /FAIL/); assert.match(cell, /check summary: Owner limits/);
  const M = RB.model(B), rows = M.sections[0].subs[0].items.find(q => q.type === 'table').rows, r = rows.find(q => q.cells[1] === N);
  assert.equal(r.cells[0], 'Owner limits'); assert.equal(r.cells[8], 'see [[rs.own]]'); assert.equal(r.cells[7].t, 'FAIL'); assert.equal(r.cells[6].t, '1.500');
  const T = W.SharedReport.text(W.SharedReport.build(M)); assert.ok(!T.includes('Not in the check summary column')); assert.ok(T.includes('Owner limits'));
  assert.ok(M.vals.some(v => v.sec === 'proj' && v.path === `checks.${i}.r` && v.text === '1.500'));
  // t_d = 90 days (the default): PASS, ratio 1.000, worked as a minimum
  const Q = JSON.parse(JSON.stringify(P)); Q.base.mat.td = 90; const C = W.PSBReportData.compute(Q, null), k = C.R.checks.findIndex(q => q.n === N);
  assert.equal(fx(C.R.checks[k].r, 3), '1.000'); assert.equal(C.R.checks[k].pass, true); assert.match(W.PSBInputsUI.cards('own', Q, C.R), /governing minimum <span data-ev="checks\.\d+\.lim" data-d="0">90<\/span> days/);
});
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
// 2026-11-13: the Report's graphics. In the page ui/report.js draws each tab's graphics with the tab's own code (browser only: the smoke test);
// here, figures handed in as opt.figures are put at their slots' places, numbered "Figure n.m" by the sections shown, and change no value
test('report graphics: figures at their slots, numbered Figure n.m, the values unchanged', () => {
  const B = W.PSBReportData.compute(CASES['continuous 3 spans, exterior G6 in span 2, skew 35°, restraint, haunch in the section'], null), M0 = RB.model(B);
  const fig = (t) => [{ type: 'figure', svg: `<svg data-t="${t}"></svg>`, caption: t }];
  const figs = { sec: { gfx_sec: fig('S') }, flex: { gfx_fx: fig('F1'), gfx_fxpier: fig('F2') }, rt: { gfx_rt: fig('R1'), gfx_rtx: fig('R2') }, loss: { gfx_loss: fig('L1'), gfx_loss_str: fig('L2') } };
  const M = RB.model(B, { figures: figs });
  assert.deepEqual(J(M.vals), J(M0.vals), 'the values are the same');
  const capt = s => [].concat(...s.subs.map(q => q.items.filter(i => i.type === 'figure').map(i => i.caption)));
  const by = k => M.sections.find(s => s.id === k), n = k => M.sections.findIndex(s => s.id === k) + 1;
  assert.deepEqual(J(capt(by('sec'))), [`Figure ${n('sec')}.1: S`]); assert.deepEqual(J(capt(by('flex'))), [`Figure ${n('flex')}.1: F1`, `Figure ${n('flex')}.2: F2`]);
  assert.deepEqual(J(capt(by('rt'))), [`Figure ${n('rt')}.1: R1`, `Figure ${n('rt')}.2: R2`]); assert.deepEqual(J(capt(by('loss'))), [`Figure ${n('loss')}.1: L1`, `Figure ${n('loss')}.2: L2`]);
  assert.equal(by('sec').subs[0].title, 'Graphics', 'a slot outside the cards: a Graphics subsection first');
  const pier = by('flex').subs.find(q => q.items.some(i => i.type === 'figure' && /F2/.test(i.caption))); assert.match(pier.title, /pier/i, 'a slot in a card: in that card');
  assert.equal(figs.sec.gfx_sec[0].caption, 'S', 'the figures handed in are not changed');
  // a section left out: the numbers follow the sections shown
  const M2 = RB.model(B, { figures: figs, include: { sec: false, lds: false } }), f2 = M2.sections.find(s => s.id === 'flex');
  assert.equal(capt(f2)[0], `Figure ${M2.sections.indexOf(f2) + 1}.1: F1`); assert.ok(!capt(f2)[0].startsWith(`Figure ${n('flex')}.`));
  const doc = W.SharedReport.build(M); assert.deepEqual(J(doc.unresolved), []); assert.ok(W.SharedReport.text(doc).includes(`[Figure] Figure ${n('flex')}.2: F2`));
  assert.equal(W.PSBReportTab.inline('t<sub>s</sub> = 8 in <a href="#" data-goin="mat">tab</a>'), 't$_{s}$ = 8 in [[tab:in:mat|tab]]');
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
