// Grouped worked steps on every Steel Bridge output tab after Shear & stiffeners (presentation spec A, 2026-10-31): Section properties, Flexure,
// Loads & LLDF, Fatigue & studs, Constructibility, Cross-frames, Field splices, Rating, Welds, Analysis. Every step of every item of the
// calculation report (every location) lands in a named topic (none in "Other steps"), the topics partition the item's steps, every
// cross-reference still resolves, and a note that says "See §x" gets no second "see". Also SharedSteps.group (strip: false) and reveal.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test, loadShared, ROOT } from './harness.mjs';
import { projectFromPayload, readPayload } from './an-fixture.mjs';

const SB = path.join(ROOT, 'apps/steel-bridge');
const SK = /view3d|ui\/report|ui\/drawings|ui\/graphics|ui\/gfxa|ui\/tabgraphics|ui\/legacy|autodesign/;
const FILES = [...fs.readFileSync(path.join(SB, 'index.html'), 'utf8').matchAll(/<script src="((?!http)[^"]+)"/g)].map(m => path.resolve(SB, m[1])).filter(f => !SK.test(f));

test('SharedSteps.group with strip:false matches the whole id; reveal opens the topic of a step', () => {
  const S = loadShared('steps.js').SharedSteps, mk = (id, o) => S.step({ id, label: id, ...o });
  const G = S.group([mk('fx.Mu', { value: 5, unit: 'kip' }), mk('sec.s.I', { value: 9, unit: 'in^{4}' })], [{ key: 'a', title: 'A', ids: /^sec\./ }, { key: 'b', title: 'B', ids: /^fx\./ }], { strip: false });
  assert.equal(JSON.stringify(G.map(t => t.key)), JSON.stringify(['a', 'b']));
  // info: a step whose ok flag only says which case applies is shown but not counted in the status
  const I = S.group([mk('pl.c1', { value: 0, unit: '', ok: false }), mk('pl.Mp', { value: 5, unit: 'kip-ft' })], [{ key: 'p', title: 'P', ids: /^pl\./, res: /^pl\.Mp$/, info: /^pl\.c/ }], { strip: false })[0];
  assert.equal(I.cls, ''); assert.equal(I.chip, ''); assert.equal(I.res.id, 'pl.Mp'); assert.equal(S.group([mk('pl.c1', { value: 0, unit: '', ok: false })], [{ key: 'p', title: 'P', ids: /^pl\./ }], { strip: false })[0].cls, 'ng');
  const el = { open: false }, t = { closest: sel => (sel === 'details.sg-t' ? el : null) }, root = { querySelector: q => (q === '[id="st-sec.s.I"]' ? t : null) };
  assert.equal(S.reveal(root, 'sec.s.I'), t); assert.equal(el.open, true); assert.equal(S.reveal(root, 'nope'), null);
});

test('worked steps of every output tab are in topics (none left over); report keeps them; no doubled "see"', () => {
  const W = loadShared(...FILES), M = W.SBDModel, J = o => JSON.parse(JSON.stringify(o));
  const cases = [];
  { const P = J(M.defaultProject()); P.framing = { ...M.defaultFraming(), splices: [82] }; cases.push(['built-in', P, { src: 'analysis' }]); }
  for (const f of ['gd_util_RIDOT_G4.json', 'gd_builtin28_AASHTO_G1.json']) { const pl = readPayload(f), Q = projectFromPayload(pl); Q.xs = M.defaultXs(Q); Q.stiffeners = M.defaultStiffeners(); Q.framing = { ...M.defaultFraming(), splices: [] }; cases.push([f, Q, { src: 'file', pl }]); }
  let n = 0, items = 0; const sections = new Set();
  for (const [nm, P, o] of cases) {
    const B = W.SBDReportData.compute(P, 0, o), Mo = W.SBDReportBuild.model(B, { detail: 'all' });
    Mo.sections.forEach(sec => (sec.subs || []).forEach(q => (q.items || []).forEach(it => { if (it.type !== 'steps' || !it.topics) return; items++; sections.add(sec.title);
      assert.equal(it.topics.reduce((a, t) => a + t.n, 0), it.steps.length, `${nm} ${sec.title}`);
      let j = 0; it.topics.forEach(t => { assert.ok(t.title !== 'Other steps', `${nm} ${sec.title}: ${it.steps.slice(j, j + t.n).map(s => s.id).join(' ')} in no topic`); j += t.n; n += t.n; }); })));
    const doc = W.SharedReport.build(Mo); assert.equal(doc.unresolved.length, 0, `${nm}: ${JSON.stringify(doc.unresolved.slice(0, 3))}`);
    const html = W.SharedReport.html(doc, { lazy: false }), txt = W.SharedReport.text(doc);
    assert.ok(!/\bsee\s+see\b/i.test(txt), `${nm}: doubled see in text`); assert.ok(!/NaN/.test(txt));
  }
  for (const t of ['Section properties', 'Flexure', 'Cross-section', 'Fatigue', 'Constructibility', 'Framing', 'Field splices', 'Load rating', 'Welds', 'Analysis']) assert.ok([...sections].some(s => s.startsWith(t)), 'grouped items in ' + t);
  console.log(`       ${n} steps in ${items} grouped report items, none left over`);
  // the UI files expose their topics: a step list of one tab sorts without "Other steps"
  for (const [ui, kind] of [['SBDFlexureUI', 'sec'], ['SBDFlexureUI', 'x'], ['SBDUiLoads', 'x'], ['SBDAnalysisUI', 'x'], ['SBDFatigueUI', 'x'], ['SBDConstrUI', 'x'], ['SBDFramingUI', 'x'], ['SBDSplicesUI', 'x'], ['SBDWeldsUI', 'x'], ['SBDRatingUI', 'x']]) {
    const G = W[ui].groups(kind, [W.SharedSteps.step({ id: 'zz.unknown', label: 'u', value: 1 })]); assert.equal(G[0].key, 'other', ui);
  }
});

test('a report note that says "See §x" does not get a second "see" (class rp-seen)', () => {
  const W = loadShared(...FILES), S = W.SharedSteps;
  const st = [S.step({ id: 'a.x', label: 'X', value: 1, unit: 'in' }), S.step({ id: 'a.y', label: 'Y', value: 2, unit: 'in', note: 'Worked above: See §a.x.' }), S.step({ id: 'a.z', label: 'Z', value: 3, unit: 'in', note: 'Also §a.x.' })];
  const doc = W.SharedReport.build({ title: 'T', sections: [{ id: 's', title: 'S', subs: [{ id: 'q', title: 'Q', items: [{ type: 'steps', scope: '', steps: st }] }] }] });
  const html = W.SharedReport.html(doc, { lazy: false });
  assert.equal((html.match(/class="rp-see rp-seen"/g) || []).length, 1); assert.equal((html.match(/class="rp-see"/g) || []).length, 1);
});
