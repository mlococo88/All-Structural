// PS Bridge batch B (2026-11-15, display only): the steel app's formats in the PS app.
//   1. Summary tab: each check cell's class from the engine's own pass and ratio: s-fail (engine FAIL), s-review (engine PASS with a ratio that
//      is not finite: REVIEW), s-hi (PASS, ratio 0.90 to 1.00: amber), s-pass; the counts FAIL / REVIEW / PASS = the check summary column's;
//   2. the check summary column (ui/dash.js): a group with a governing PASS ratio ≥ 0.90 drawn amber (sd-hi), the same counts;
//   3. the result graphics in titled cards (PSBOutKit.gcard): the Report reads the card as the slot alone (sections unchanged);
//   4. the stat tiles: 3 across, the value and unit on one line, a § link from VK.tileLink when the page sets it.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', 'report.js', ...PBDF,
  ...['sections', 'model', 'rigid', 'lldf-fg', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'legacy', 'worked', 'worked-stress', 'worked-strength', 'worked-end', 'worked-hdr'].map(n => path.join(APP, `engine/${n}.js`)),
  ...['inputs', 'vizkit', 'vizalong', 'outkit', 'section', 'loads', 'analysis', 'strands', 'losses', 'stresses', 'flexure', 'shear', 'endzone', 'camber', 'handling', 'deck', 'rating', 'dash', 'summary', 'bridgedl'].map(n => path.join(APP, `ui/${n}.js`)),
  ...['fromtab', 'data', 'builders'].map(n => path.join(APP, `report/${n}.js`)));
const M = W.PSBModel, B = W.PSBBridge, SU = W.PSBSummaryUI, DU = W.PSBDashUI, K = W.PSBOutKit, VK = W.PSBVizKit;
const J = v => JSON.parse(JSON.stringify(v));
const load = P => M.importJSON(M.exportJSON(P)).project;
const fin = v => typeof v === 'number' && isFinite(v);
const stOf = q => !q.pass ? 'fail' : !fin(q.r) ? 'review' : q.r >= 0.9 ? 'hi' : 'pass';
const CASES = Object.assign({ 'new project': M.defaultProject() }, TAB_CASES(() => M.defaultProject()));

for (const [name, P0] of Object.entries(CASES)) {
  test(`batch B Summary statuses: ${name}`, () => {
    const P = load(P0), A = B.results(P, inp => W.PSBHoldDown.compute(J(inp))), Mo = SU.model(P, A), h = SU.html({ P, A, run: { ms: 1 }, shown: '' });
    // every check cell of the type × group table: its class from the engine's pass and ratio
    Mo.types.forEach(T => Object.values(T.groups).forEach(z => {
      const re = new RegExp(`<td class="s-(\\w+)" title="[^"]*"><a href="#" data-sumgo="${z.k}\\|${z.g}\\|${z.gp.tab}\\|${z.st.replace(/\./g, '\\.')}\\|[^"]*"><span data-sv="${z.k}\\|${z.g}\\|checks\\.${z.i}\\.r">`);
      const m = re.exec(h); assert.ok(m, `${T.label} ${z.gp.name}: cell`); assert.equal(m[1], stOf(z.q), `${T.label} ${z.gp.name} ${z.q.r}`); }));
    // counts: FAIL + REVIEW + PASS = every counted check; the same as the column's grp
    let nF = 0, nR = 0, nP = 0;
    DU.GROUPS.forEach(gp => { const q = DU.grp(null, gp, A); q.all.forEach(z => { if (!z.c.pass) nF++; else if (!fin(z.c.r)) nR++; else nP++; }); });
    assert.equal(Mo.nF, nF); assert.equal(Mo.nR, nR); assert.equal(Mo.nP, nP);
    assert.match(h, new RegExp(`<span class="sum-badge ${nF ? 'fail' : nR ? 'review' : 'pass'}">`));
  });
}
test('batch B: the new project shows Release stresses 0.944 amber (PASS), its chip sd-hi', () => {
  const P = load(M.defaultProject()), A = B.results(P, inp => W.PSBHoldDown.compute(J(inp))), Mo = SU.model(P, A), h = SU.html({ P, A, run: { ms: 1 }, shown: '' });
  const T = Mo.types[0], z = T.groups.rel; assert.ok(z.q.r >= 0.9 && z.q.r <= 1 && z.q.pass, `rel ${z.q.r}`);
  assert.ok(h.includes('<td class="s-hi"'), 'an amber cell');
  const q = DU.grp(null, DU.GROUPS.find(g => g.id === 'rel'), A); assert.equal(q.st, 'pass'); assert.ok(q.gov.c.r >= 0.9);
});
test('batch B: graphic cards are read by the Report as their slot alone; tiles 3 across with a § from tileLink', () => {
  const html = `<p class="note">a</p>${K.gcard('Section graphic', 'gfx_x')}<section class="sec"><div class="secHead">Card</div><div class="secBody"><p>b</p></div></section>`;
  const c = W.PSBReportTab.cards(html, { X: { vals: [] }, sec: 's', inReport: () => false, figs: { gfx_x: [{ type: 'figure', svg: '<svg/>', caption: 'F' }] } });
  assert.deepEqual(J(c.subs.map(s => s.title)), ['Card']); assert.equal(c.top.filter(t => t.type === 'figure').length, 1);
  VK.tileLink = p => p === 'g.A' ? '<a class="wk" href="#st-sec.A">§</a>' : '';
  const t = VK.tiles([{ label: 'A', value: K.ev({ g: { A: 767 } }, 'g.A', 1), unit: 'in²' }, { label: 'B', value: '1', unit: 'in' }]);
  VK.tileLink = null;
  assert.match(t, /<span class="vk-tv"><b><span data-ev="g\.A" data-d="1">767\.0<\/span><\/b><i>in²<\/i><a class="wk" href="#st-sec\.A">§<\/a><\/span>/);
  assert.match(t, /<span class="vk-tv"><b>1<\/b><i>in<\/i><\/span>/);
});
