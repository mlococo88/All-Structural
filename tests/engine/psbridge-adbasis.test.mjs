// apps/ps-bridge ADB (2026-11-15): the Report's Auto design basis (report/builders.js adSub, the last subsection of §2), in Node:
//   1. no run in this page view: the subsection is there, short (one note saying so), and the report's sections, subsection numbers before
//      it and recorded values are those of a report without it;
//   2. a run applied (the default project and the new project with two girder types, worked per type): the objective, the sections
//      searched, the strand, drape and f′c / f′ci rules (AASHTO LRFD 10th Ed. Art. 5.4.2.1), the order of preference, the assumptions and
//      every span's selected candidate with its governing check; every "see §" reference resolves; each check of the candidate's girder
//      type points to the step of the report that works it; no NaN / undefined / [object; no "pending" wording;
//   3. a run shown, not applied, and a stale one: the subsection says so;
//   4. building it changes nothing: R, the inputs, the project, the run result and the values recorded (model.vals) are the same.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', 'report.js', ...PBDF,
  ...['sections', 'model', 'rigid', 'lldf-fg', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'legacy', 'worked', 'worked-stress', 'worked-strength', 'worked-end', 'worked-hdr', 'autodesign'].map(n => path.join(APP, `engine/${n}.js`)),
  ...['inputs', 'vizkit', 'vizalong', 'outkit', 'section', 'loads', 'analysis', 'strands', 'losses', 'stresses', 'flexure', 'shear', 'endzone', 'camber', 'handling', 'deck', 'rating', 'dash', 'summary', 'bridgedl'].map(n => path.join(APP, `ui/${n}.js`)),
  ...['fromtab', 'data', 'builders'].map(n => path.join(APP, `report/${n}.js`)));
const M = W.PSBModel, AD = W.PSBAutoDesign, RB = W.PSBReportBuild, SR = W.SharedReport;
const J = v => JSON.parse(JSON.stringify(v));
const load = P => M.importJSON(M.exportJSON(P)).project;
const adOf = Mo => { const s = Mo.sections.find(q => q.id === 'proj'); return s ? s.subs[s.subs.length - 1] : null; };
const textOf = q => JSON.stringify(q.items);

test('Auto design basis: no run: one short note; the rest of the report as without it', () => {
  const P = load(M.defaultProject()), B = W.PSBReportData.compute(P, null), Mo = RB.model(B), q = adOf(Mo), doc = SR.build(Mo);
  assert.equal(q.title, 'Auto design basis'); assert.equal(q.key, 'rs.adb');
  assert.equal(q.items.length, 1); assert.match(q.items[0].text, /^No auto design was run in this page view: nothing in this report comes from an auto design/);
  assert.equal(Mo.sections.length, 18, '18 sections (14 before the report package of 2026-11-23: + exec, basis, bom, sign)');
  assert.equal(doc.index.get('rs.adb').n, `${Mo.sections.findIndex(s => s.id === 'proj') + 1}.${Mo.sections.find(s => s.id === 'proj').subs.length}`, 'the last subsection of the project section (§3 since the executive summary, 2026-11-23)');
  assert.deepEqual(J(doc.unresolved), []);
  const run = RB.model(W.PSBReportData.compute(P, null), { autodesign: { kind: 'running' } });
  assert.match(adOf(run).items[0].text, /^An auto design run is under way/);
});

const cases = { 'default project (one girder)': () => load(M.defaultProject()), 'new project (Interior + Exterior, worked per type)': () => load(M.newProject()) };
for (const [name, mk] of Object.entries(cases)) {
  test(`Auto design basis: a run applied: ${name}`, () => {
    const P = mk(), R = AD.runSync(P), Rs = JSON.stringify(R.spans.map(sp => sp.cands.map(c => c.name))), Q = J(P);
    assert.ok(R.spans.some(sp => sp.cands.length), 'a candidate');
    AD.apply(Q, R, {});
    const B = W.PSBReportData.compute(Q, null), R0 = JSON.stringify(B.R), I0 = JSON.stringify(B.inp), Q0 = JSON.stringify(Q);
    const plain = RB.model(B), Mo = RB.model(B, { autodesign: { kind: 'applied', R, Q: P, sel: {}, stale: false } }), doc = SR.build(Mo), T = SR.text(doc), q = adOf(Mo), t = textOf(q);
    assert.deepEqual(J(doc.unresolved), [], 'every reference resolves');
    assert.deepEqual(J(doc.dup), [], 'no duplicate anchor');
    assert.equal(JSON.stringify(Mo.vals), JSON.stringify(plain.vals), 'no value recorded by the basis');
    assert.equal(Mo.sections.length, plain.sections.length);
    assert.equal(JSON.stringify(B.R), R0); assert.equal(JSON.stringify(B.inp), I0); assert.equal(JSON.stringify(Q), Q0);
    assert.equal(JSON.stringify(R.spans.map(sp => sp.cands.map(c => c.name))), Rs, 'the run result unchanged');
    assert.ok(!/NaN|undefined|\[object/.test(t), 'no NaN / undefined');
    assert.ok(!/pending/i.test(t), 'no "pending" wording');
    ['Objective and variables', 'Order of preference', 'Sections searched', 'Strand pattern rules', 'Drape rules', 'f′c and f′ci grids and limits', 'Assumptions of the search', 'Selected candidate and its governing check']
      .forEach(h => assert.ok(q.items.some(i => i.topic && i.topic.title === h), h));
    assert.match(t, /AASHTO LRFD 10th Ed\. Art\. 5\.4\.2\.1/); assert.match(t, /Applied in this page view/); assert.match(t, /lightest section/);
    assert.match(t, /fewer than 4 strands is not used/); assert.match(t, /0\.33 to 0\.45/); assert.match(t, /never added \(PS-12\)/);
    // each candidate: its governing check named, and each of its checks links to the step that works it (the report's unit of that type)
    R.spans.forEach(sp => { const c = sp.cands[0]; if (!c) return; c.types.forEach(({ k, res }) => {
      assert.ok(t.includes(`ratio ${res.best.ev.gov.r.toFixed(3)} on G${res.best.ev.gov.g}`), `governing check of type ${k}`); }); });
    const tbls = q.items.filter(i => i.type === 'table' && i.head[0] === 'Check');
    assert.ok(tbls.length >= 1, 'a check table per girder type');
    const nLinked = tbls.reduce((a, x) => a + x.rows.filter(r => /^see \[\[/.test(r.cells[4])).length, 0), nAll = tbls.reduce((a, x) => a + x.rows.length, 0);
    assert.ok(nLinked >= nAll * 0.8, `most checks link to their step (${nLinked} of ${nAll})`);
    tbls.forEach(x => x.rows.forEach(r => assert.ok(/^see \[\[|\[\[tab:/.test(r.cells[4]), `a link for ${r.cells[0]}: ${r.cells[4]}`)));
    assert.match(T, /Auto design basis/);
  });
}

test('Auto design basis: a run shown (not applied), and stale', () => {
  const P = load(M.defaultProject()), R = AD.runSync(P), B = W.PSBReportData.compute(P, null);
  const a = textOf(adOf(RB.model(B, { autodesign: { kind: 'shown', R, Q: P, sel: {}, stale: false } })));
  assert.match(a, /Shown on the \[\[tab:ad\|Auto design output tab\]\], not applied: the other sections of this report work the inputs as entered/);
  assert.match(a, /the current inputs, not the candidate/);
  const b = textOf(adOf(RB.model(B, { autodesign: { kind: 'applied', R, Q: P, sel: {}, stale: true } })));
  assert.match(b, /The project has changed since the run was applied/);
});
