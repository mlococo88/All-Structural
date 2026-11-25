// apps/ps-bridge E0 (2026-11-15): the engineer's rule that "pending engineer review" wording appears only in PRs and the fix log, never
// in the app: the Report of the default project and of a new project (two girder types), the Project tab's assumptions, every input
// tab's girder-design cards, the Auto design output tab's and the MCT hand-off banner's source strings carry no "pending" review wording. The box beam / voided
// slab "to be confirmed" note (PS #1542 / #1554, engineer-requested) is kept and is not matched.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', 'report.js', ...PBDF,
  ...['sections', 'model', 'rigid', 'lldf-fg', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'legacy', 'worked', 'worked-stress', 'worked-strength', 'worked-end', 'worked-hdr', 'autodesign'].map(n => path.join(APP, `engine/${n}.js`)),
  ...['inputs', 'vizkit', 'vizalong', 'outkit', 'section', 'loads', 'analysis', 'strands', 'losses', 'stresses', 'flexure', 'shear', 'endzone', 'camber', 'handling', 'deck', 'rating', 'dash', 'summary', 'bridgedl'].map(n => path.join(APP, `ui/${n}.js`)),
  ...['fromtab', 'data', 'builders'].map(n => path.join(APP, `report/${n}.js`)));
const M = W.PSBModel, RB = W.PSBReportBuild, SR = W.SharedReport, IN = W.PSBInputsUI;
const load = P => M.importJSON(M.exportJSON(P)).project;
const PEND = /pending/i;
const cases = { 'default project': () => load(M.defaultProject()), 'new project (Interior + Exterior)': () => load(M.newProject()) };

for (const [name, mk] of Object.entries(cases)) {
  test(`no "pending" review wording: Report and input cards: ${name}`, () => {
    const P = mk(), B = W.PSBReportData.compute(P, null), T = SR.text(SR.build(RB.model(B)));
    assert.ok(T.length > 1000, 'a report');
    assert.ok(!PEND.test(T), `Report: ${(T.match(/.{0,80}pending.{0,40}/i) || [''])[0]}`);
    for (const tab of ['proj', 'geo', 'mat', 'gs', 'loads', 'own', 'ad']) {
      let h = ''; try { h = IN.cards(tab, P) || ''; } catch (e) { continue; }
      assert.ok(!PEND.test(h), `${tab} cards: ${(h.match(/.{0,80}pending.{0,40}/i) || [''])[0]}`);
    }
  });
}

test('no "pending" review wording: the Auto design output tab (ui/autodesign.js strings)', () => {
  const src = fs.readFileSync(path.join(APP, 'ui/autodesign.js'), 'utf8');
  const html = src.split('\n').filter(l => /<li>|<p |<div /.test(l)).join('\n');   // the lines that build the tab's HTML
  assert.ok(!PEND.test(html), (html.match(/.{0,80}pending.{0,40}/i) || [''])[0]);
  assert.match(html, /<li>Assumption \(<a href="#rp:rs\.adb" data-gotab="rpt">Report, §2, Auto design basis<\/a>\): a higher f′c or f′ci is not worse/);
});

test('no "pending" review wording: the Hand-offs card and banners (ui/handoffs.js strings)', () => {
  const src = fs.readFileSync(path.join(APP, 'ui/handoffs.js'), 'utf8');
  const html = src.split('\n').filter(l => !/^\s*(\/\*|\/\/|\*)/.test(l) && /<span|<p |<div |<h3/.test(l)).join('\n').replace(/\b(mct|geom)Pending\b/g, '');
  assert.ok(!/pending/i.test(html), (html.match(/.{0,80}pending.{0,40}/i) || [''])[0]);
});
