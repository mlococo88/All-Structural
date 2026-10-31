// shared/steps.js topics (SharedSteps.group, summary, groupsHTML; presentation spec A, trial on the Steel Bridge Shear & stiffeners tab, 2026-10-31)
// and their use on that tab (ui/shear.js TOPICS) and in its report section (report/builders.js gsteps, shared/report.js item.topics).
// Presentation only: every step lands in exactly one topic, unchanged (same object, id, value), in its original order within the topic; the
// tab's steps and the report's steps are the same set; every report cross-reference still resolves.
import assert from 'node:assert/strict';
import { test, loadShared } from './harness.mjs';
import { load } from './gfx-fixture.mjs';
import { projectFromPayload, readPayload } from './an-fixture.mjs';

const S = loadShared('steps.js').SharedSteps;
const mk = (id, o) => S.step({ id, label: id, ...o });

test('SharedSteps.group: topics in the given order, first match wins, the rest to "Other steps", empty topics left out', () => {
  const st = [mk('ts1.Vu', { value: 50, unit: 'kip', sym: 'V_{u}' }), mk('ts1.It', { value: 10, unit: 'in^{4}' }), mk('ts1.Ireq', { value: 0.5, unit: '', ok: true, sym: 'I_{t} \\ge I_{req}' }),
    mk('ts1.p1.Vn', { value: 300, unit: 'kip' }), mk('ts1.p1.ok', { value: 0.95, unit: '', ok: true }), mk('ts1.zz', { value: 1 })];
  const G = S.group(st, [{ key: 'dem', title: 'Demands', ids: /^Vu/ }, { key: 'none', title: 'Never', ids: /^nothing$/ }, { key: 'pan', title: 'Panels', ids: /^p1\./ }, { key: 'I', title: 'Inertia', ids: id => /^I/.test(id) }]);
  assert.equal(JSON.stringify(G.map(t => t.key)), JSON.stringify(['dem', 'pan', 'I', 'other']));
  assert.equal(G.flatMap(t => t.steps).length, st.length); st.forEach(s => assert.equal(G.filter(t => t.steps.includes(s)).length, 1, s.id));
  const pan = G[1]; assert.equal(pan.ratio, 0.95); assert.equal(pan.cls, 'hi'); assert.equal(pan.chip, '0.950'); assert.equal(pan.res.id, 'ts1.p1.ok');
  const I = G[2]; assert.equal(I.cls, 'ok'); assert.equal(I.res.id, 'ts1.Ireq');
  const dem = G[0]; assert.equal(dem.cls, ''); assert.equal(dem.chip, ''); assert.equal(S.summary(dem, false), 'ts1.Vu: V_u = 50.00 kip');
  assert.equal(S.summary(pan, false), 'ts1.p1.ok'); assert.equal(S.summary(I, false), 'ts1.Ireq: I_t ≥ I_(req)');
  // a failing test step governs its topic (NG) whatever the ratios; a test step with a unit is not a ratio
  const F = S.group([mk('a.g', { value: 2.75, unit: 'in', ok: true }), mk('a.w', { value: 0.4, unit: '', ok: false })], [{ key: 'w', title: 'Welds', ids: /./ }])[0];
  assert.equal(F.cls, 'ng'); assert.equal(F.res.id, 'a.w'); assert.equal(F.ratio, 0.4); assert.equal(F.chip, '0.400 NG');
  assert.equal(S.group([mk('a.r', { value: 1.2, unit: '', ok: false })], [{ key: 'x', title: 'X', ids: /./ }])[0].cls, 'ng');
  const H = S.groupsHTML(G, { open: new Set(['pan']), item: s => `<li id="st-${s.id}">${s.label}</li>` });
  assert.equal((H.match(/<details class="sg-t/g) || []).length, 4); assert.equal((H.match(/ open>/g) || []).length, 1); assert.ok(/data-sgall="1"/.test(H) && /data-sgall="0"/.test(H));
  st.forEach(s => assert.ok(H.includes(`id="st-${s.id}"`), s.id));
  assert.ok(typeof S.groupCss === 'string' && S.groupCss.includes('.sg-chip'));
});

test('Shear & stiffeners tab topics: every step of every panel, station, transverse stiffener and bearing in exactly one topic, values unchanged; report keeps the grouping', () => {
  const W = load(), M = W.SBDModel, U = W.SBDShearUI, SB = W.SBDStiffeners, J = o => JSON.parse(JSON.stringify(o));
  const P = J(M.defaultProject()); P.framing = { ...M.defaultFraming(), splices: [82] };
  const pl = readPayload('gd_util_RIDOT_G4.json'), Q = projectFromPayload(pl); Q.xs = M.defaultXs(Q); Q.stiffeners = M.defaultStiffeners(); Q.ownerRules = { owner: 'RIDOT', eta: { D: 'no', R: 'auto', I: 'no', eD: 1, eR: 1, eI: 1 } };
  let n = 0, other = 0;
  const chk = (kind, list) => { const before = JSON.stringify(list), G = U.groups(kind, list); const flat = G.flatMap(t => t.steps);
    assert.equal(flat.length, list.length, kind); list.forEach(s => assert.ok(flat.includes(s), `${kind} ${s.id}`));
    G.forEach(t => { const idx = t.steps.map(s => list.indexOf(s)); assert.equal(JSON.stringify(idx), JSON.stringify([...idx].sort((a, b) => a - b)), `${kind} ${t.key}: original order`); if (t.key === 'other') other += t.steps.length; });
    assert.equal(JSON.stringify(list), before, `${kind}: steps unchanged`); n += list.length; };
  for (const [R, nm] of [[U.build({ P, g: 0, src: 'analysis' }), 'built-in'], [U.build({ P: Q, g: 0, pl }), 'RIDOT']]) {
    R.panels.rows.forEach(q => chk('pan', q.steps)); R.stations.forEach(r => chk('loc', r.steps));
    R.TS.rows.forEach(r => chk('ts', SB.transverseSteps(R.TS, r))); R.BS.rows.forEach(r => chk('bs', SB.bearingSteps(R.BS, r)));
  }
  assert.equal(other, 0, 'every step has a named topic');
  // the report: the stiffener items carry topics that partition their steps; nav entries down to the topics; every "see" resolves
  const B = W.SBDReportData.compute(P, 0, { src: 'analysis' }), Mo = W.SBDReportBuild.model(B, { detail: 'gov' }), sec = Mo.sections.find(s => /Shear/.test(s.title));
  const its = sec.subs.flatMap(q => q.items).filter(it => it.type === 'steps'); assert.ok(its.length >= 4);
  its.forEach(it => { assert.ok(it.topics && it.topics.length, it.title); assert.equal(it.topics.reduce((a, t) => a + t.n, 0), it.steps.length, it.title); });
  const doc = W.SharedReport.build(Mo); assert.equal(doc.unresolved.length, 0, JSON.stringify(doc.unresolved.slice(0, 3)));
  const tocSub = doc.toc.flatMap(s => s.subs).filter(q => q.items && q.items.length); assert.ok(tocSub.length >= 3);
  const html = W.SharedReport.html(doc, { lazy: false }), txt = W.SharedReport.text(doc);
  assert.equal((html.match(/class="rp-top/g) || []).length, its.reduce((a, it) => a + it.topics.length, 0)); assert.ok(!/NaN/.test(txt) && txt.includes(`1. ${its[0].topics[0].title}`), "report text: topic lines");
  console.log(`       ${n} steps sorted into topics (none left over); report: ${its.length} grouped items`);
});
