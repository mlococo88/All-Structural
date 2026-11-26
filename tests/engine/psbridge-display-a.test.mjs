// PS Bridge batch A (2026-11-15, display only): the Report's References (the articles the worked steps cite, the PCI Design Handbook for the
// camber multipliers, handling named as a screening, not the PCI / Mast method); the Rating tab's topics with a rating-factor status
// (PSBOutKit.groups: the lowest RF, red only when one is < 1.0; before: shared/steps.js group() read the RF as demand / capacity, operating
// RF 2.407 red); §1's rating table "—" for the engine's 99 (not applicable), as the Rating tab; the Flexure Components chart with every
// series shown at first. No value changed: the steps and engine results are the same objects.
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { loadShared, test, ROOT } from './harness.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', 'report.js', ...PBD,
  ...['sections', 'model', 'lldf-fg', 'reltension', 'holddown', 'pierblock', 'design', 'fields', 'inputcheck', 'worked', 'worked-stress', 'worked-strength', 'worked-end', 'worked-hdr'].map(n => path.join(APP, `engine/${n}.js`)),
  ...['inputs', 'vizkit', 'vizalong', 'outkit', 'section', 'loads', 'analysis', 'strands', 'losses', 'stresses', 'flexure', 'shear', 'endzone', 'camber', 'handling', 'deck', 'rating', 'dash'].map(n => path.join(APP, `ui/${n}.js`)),
  ...['fromtab', 'data', 'builders'].map(n => path.join(APP, `report/${n}.js`)));
const CASES = TAB_CASES(() => W.PSBModel.defaultProject());
const RB = W.PSBReportBuild, OK = W.PSBOutKit, UR = W.PSBUiRating;

for (const [name, P] of Object.entries(CASES)) {
  test(`batch A: ${name}`, () => {
    const B = W.PSBReportData.compute(P, null); assert.equal(B.err, '');
    const M = RB.model(B), refs = new Map(M.refs.map(r => [r[0], r[1]])), T = W.SharedReport.text(W.SharedReport.build(M));
    // References: no "PCI Bridge Design Manual and the Mast method"; every AASHTO article a step cites is listed
    assert.ok(!/PCI Bridge Design Manual/.test(T)); assert.ok(!M.refs.some(r => /Mast method \(handling/.test(r[1])));
    const aa = refs.get('AASHTO LRFD');
    Object.values(B.W).forEach(w => (w.steps || []).forEach(s => { const m = /^AASHTO LRFD 10th Ed\. (?:Eq\. |Table )?(\d+(?:\.\d+[a-z]?)+)/.exec(s.ref || ''); if (m) assert.ok(aa.includes(m[1].replace(/-\d+$/, '')), `${s.id}: ${s.ref}`); }));
    assert.equal(refs.has('PCI'), B.W.camber.steps.some(s => s.ref === 'PCI Design Handbook'));
    assert.equal(refs.has('Handling'), B.W.handling.steps.length > 0);
    if (refs.has('Handling')) assert.match(refs.get('Handling'), /not the PCI \(2016\) \/ Mast method/);
    // Rating topics: an RF status (the lowest RF; red only when one is < 1.0)
    OK.groups(B.W.rating.steps, UR.TOPICS).forEach(g => { const d = UR.TOPICS.find(q => q.key === g.key); if (!d || !d.rf) return;
      const rs = g.steps.filter(s => d.rf.test(s.id)), lo = rs.filter(s => s.value < 99).reduce((a, s) => Math.min(a, s.value), Infinity), ng = rs.some(s => s.ok === false);
      assert.equal(g.cls, ng ? 'ng' : 'ok', `${g.key} ${g.chip}`); assert.equal(g.chip, isFinite(lo) ? `RF ${OK.fx(lo, 3)}${ng ? ' NG' : ''}` : 'RF —');
      if (!ng) assert.ok(lo >= 1, g.key); });
    // §1: the engine's 99 shown "—" (not "99.000")
    const rt = M.sections.find(s => s.id === 'sum').subs[0].items.filter(i => i.type === 'table')[1];
    if (rt) rt.rows.forEach(r => { assert.notEqual(r[1].t, '99.000'); });
    assert.ok(!/99 = not applicable/.test(T));
  });
}
test('batch A: Flexure Components chart: every series shown at first; the stale placeholders gone', () => {
  const fl = fs.readFileSync(path.join(APP, 'ui/flexure.js'), 'utf8'); assert.match(fl, /const HIDE = \{\};/);
  const ix = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
  assert.ok(!/waits for the sheets/.test(ix)); assert.match(ix, /Design aid — independent verification by a licensed engineer required/);
  assert.ok(!/the old app\\'s library/.test(fs.readFileSync(path.join(APP, 'engine/fields.js'), 'utf8')));
});
