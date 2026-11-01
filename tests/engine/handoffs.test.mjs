// Cross-tool hand-offs of the new app (B2, 2026-11-01; apps/steel-bridge/ui/handoffs.js, engine/analysis.js dfOf): the bridgeSuite.v1
// channels GirderDetail uses, with its keys and payload formats (HANDOFF.md §4.1, §4.3, §4.4).
//
// 1. lldf pull, proof of path: LL & DL factors equal to this app's own (loads module) factors give the same factors in the analysis.
// 2. lldf pull, hand check: span 2 g moment pulled as 0.800 (module 0.6639): the LL+IM moment in span 2 scales by 0.800/0.6639 = 1.20500.
// 3. lldf plan: GirderDetail gdLldfPlan's refusals and warnings (span count, perFootStrip, Nb, beam basis, missing fatigue factors).
// 4. Saved data: a project without girders[i].dfPull computes as before (dfOf = the earlier precedence); dfPull survives export/import.
// 5. projectMeta: the fields shared and the title-block fields a pull changes.
// 6. superReactions: the payload's shape (§4.4, GirderDetail's), the reactions of the plate girder's own line equal its analysis, the DW
//    reactions of every girder sum to w_DW × L_total (statics), and a borrowed line's LL+IM reactions equal a full run of that line.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const W = loadShared('units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', ...['engine/model.js', 'engine/sections.js', 'engine/owners.js', 'engine/lldf.js', 'engine/loads.js',
  'engine/analysis.js', 'engine/framing.js', 'engine/crossframes.js', 'ui/handoffs.js'].map(E));
const M = W.SBDModel, AN = W.SBDAnalysis, H = W.SBDHandoffs;
const J = v => JSON.parse(JSON.stringify(v));
const r4 = v => Math.round(v * 1e4) / 1e4;
const deq = (a, b, m) => assert.deepEqual(J(a), J(b), m);   // objects made in the vm context: compare as JSON

/* an LL & DL payload (lldf.html buildDFPayload shape) carrying this app's own module factors for the default bridge: per span region the
   max over the interior / exterior members (lldf's govRegions), byBeam per member, governingNeg over the pier regions */
function lldfPayload(P) {
  const mod = AN.moduleOf(P, 0), R = mod.R, nb = Math.round(P.xs.nb), isExt = j => j === 0 || j === nb - 1;
  const gov = ids => { const o = { byBeam: {} }; ['interior', 'exterior'].forEach(t => { const ms = []; ids.forEach(id => R.regions.find(r => r.id === id).members.forEach((m, j) => { if (isExt(j) === (t === 'exterior')) ms.push(m); }));
      const mx = k => r4(Math.max(...ms.map(m => m[k]))); o[t] = { gM: mx('gM'), gV: mx('gV'), fatM: mx('fatM'), fatV: mx('fatV') }; });
    ids.forEach(id => R.regions.find(r => r.id === id).members.forEach((m, j) => { const b = o.byBeam[String(j + 1)] || {}; ['gM', 'gV', 'fatM', 'fatV'].forEach(k => { b[k] = Math.max(b[k] || 0, r4(m[k])); }); o.byBeam[String(j + 1)] = b; }));
    return o; };
  const ns = P.spans.lengths.length, sp = [...Array(ns)].map((_, i) => 's' + i), pi = [...Array(ns - 1)].map((_, k) => 'p' + (k + 1));
  return { _schema: 'bridge-lldf-factors', schemaVersion: 1, producer: 'LL & DL Distribution', producedAt: '2026-11-01T14:00:00.000Z', project: 'Fixture bridge', bridgeType: 'a',
    spans: P.spans.lengths.slice(), skew: 0, Nb: nb, governing: gov(sp), governingNeg: pi.length ? gov(pi) : null, governingBySpan: sp.map(id => gov([id])),
    units: { spans: 'ft', S: 'ft', skew: 'deg', laneWidth: 'ft', df: 'lanes per girder (dimensionless)' }, multiplePresenceIncluded: true, skewIncluded: true };
}
const dfNow = (P, gi) => { const g = P.girders[gi], mod = g.loads && g.df ? null : AN.moduleOf(P, gi); return AN.dfOf(P, g, P.spans.lengths.length, mod); };

test('lldf pull: LL & DL factors equal to this app\'s own give the same factors (proof of path)', () => {
  const P = M.defaultProject(), base = dfNow(P, 0), pl = lldfPayload(P), plan = H.lldfPlan(P, 0, pl, 'type');
  deq(plan.err, []); assert.equal(plan.j, 1); assert.equal(plan.tKey, 'interior'); assert.equal(plan.bySpan, true);
  H.lldfApply(P, 0, plan, '2026-11-01T15:00:00.000Z');
  const now = dfNow(P, 0);
  assert.equal(now.pulled, true); assert.match(now.src, /^pulled from LL & DL Distribution \(lldf\.html\)/);
  now.spans.forEach((s, i) => ['gM', 'gV', 'fatM', 'fatV', 'gDef'].forEach(k => assert.ok(Math.abs(s[k] - base.spans[i][k]) < 5.1e-5, `span ${i + 1} ${k}: ${s[k]} vs ${base.spans[i][k]}`)));
  now.piers.forEach((p, k) => assert.ok(Math.abs(p.gM - base.piers[k].gM) < 5.1e-5));
  // "beam with the same number": member 2 (j = 1) of each region
  const pb = H.lldfPlan(P, 0, pl, 'beam'); deq(pb.err, []); assert.equal(pb.pull.spans[1].gM, r4(base.spans[1].gM));
});

test('lldf pull, hand check: span 2 g moment 0.800 scales the span-2 LL+IM moment by 0.800/0.6639', () => {
  const P = M.defaultProject(), pl = lldfPayload(P);
  pl.governingBySpan[1].interior.gM = 0.8;   // span 2 (140 ft), module g moment 0.6639
  const R0 = AN.analyzeGirder(P, 0);
  H.lldfApply(P, 0, H.lldfPlan(P, 0, pl, 'type'));
  const R1 = AN.analyzeGirder(P, 0);
  assert.equal(r4(R0.df.spans[1].gM), 0.6639); assert.equal(R1.df.spans[1].gM, 0.8);
  // x = 180 ft (midspan of span 2, positive region): M_LL+IM = g_M × M_per lane; per lane unchanged
  const i = R0.x.findIndex(x => Math.abs(x - 180) < 1e-6); assert.ok(i > 0);
  assert.equal(R1.ll.perLane.Mmax[i], R0.ll.perLane.Mmax[i]);
  assert.ok(Math.abs(R1.ll.Mpos[i] / R0.ll.Mpos[i] - 0.8 / R0.df.spans[1].gM) < 1e-12);
  // e.g. M_per lane = ${R0.ll.perLane.Mmax[i]}: 0.6639 × it before, 0.800 × it after (ratio 1.20500)
  assert.ok(Math.abs(0.8 / 0.6639 - 1.20500) < 1e-5);
  // spans 1 and 3 and the piers unchanged (the envelope per span equals the module's there)
  const j = R0.x.findIndex(x => Math.abs(x - 44) < 1e-6); assert.ok(Math.abs(R1.ll.Mpos[j] / R0.ll.Mpos[j] - 1) < 1e-4);
});

test('lldf plan: GirderDetail\'s refusals and warnings', () => {
  const P = M.defaultProject(), pl0 = lldfPayload(P);
  const plan = pl => H.lldfPlan(P, 0, pl, 'type');
  assert.ok(plan({ ...pl0, spans: [110, 140] }).err.some(e => /^Span count differs/.test(e)));
  assert.ok(plan({ ...pl0, spans: [110, 141, 110] }).warn.some(e => /^Span lengths differ/.test(e)));
  assert.ok(plan({ ...pl0, perFootStrip: true }).err.some(e => /per 1-ft strip/.test(e)));
  assert.ok(plan({ ...pl0, Nb: 6 }).warn.some(e => /^Number of girders differs/.test(e)));
  assert.ok(H.lldfPlan(P, 0, { ...pl0, Nb: 6 }, 'beam').err.some(e => /needs the same number of girders/.test(e)));
  assert.ok(plan({ ...pl0, units: { df: 'per foot' } }).err.some(e => /^Unsupported distribution factor unit/.test(e)));
  assert.ok(plan({ ...pl0, bridgeType: 'k' }).warn.some(e => /cross-section type \(k\)/.test(e)));
  assert.ok(plan({ ...pl0, skew: 20 }).warn.some(e => /^Skew differs/.test(e)));
  // no fatigue factors: warned, and the module's fatigue factors kept
  const nf = J(pl0); nf.governingBySpan.forEach(o => { delete o.interior.fatM; delete o.interior.fatV; }); delete nf.governing.interior.fatM; delete nf.governing.interior.fatV;
  const p = plan(nf); deq(p.err, []); assert.ok(p.warn.some(e => /no fatigue factor/.test(e)));
  const Q = M.defaultProject(), base = dfNow(Q, 0); H.lldfApply(Q, 0, H.lldfPlan(Q, 0, nf, 'type')); const now = dfNow(Q, 0);
  assert.equal(now.spans[0].fatM, base.spans[0].fatM); assert.match(now.src, /fatM, fatV not in the hand-off/);
  // no negative factors: piers kept
  const nn = { ...pl0, governingNeg: null }, pn = plan(nn); assert.ok(pn.warn.some(e => /no negative-moment factors/.test(e))); assert.equal(pn.pull.piers.length, 0);
});

test('saved data: no dfPull computes as before; dfPull survives export/import; "use: false" is off', () => {
  const P = M.defaultProject(), g = P.girders[0];
  const before = dfNow(P, 0); assert.equal(before.pulled, undefined); assert.match(before.src, /^loads module/);
  H.lldfApply(P, 0, H.lldfPlan(P, 0, lldfPayload(P), 'type'));
  const t = M.exportJSON(P), r = M.importJSON(t); assert.ok(r.ok); deq(r.errors, []);
  deq(J(r.project.girders[0].dfPull), J(g.dfPull));
  g.dfPull.use = false; deq(J(dfNow(P, 0)), J(before));
  delete g.dfPull; deq(J(dfNow(P, 0)), J(before));
  // a span count that no longer matches: ignored
  H.lldfApply(P, 0, H.lldfPlan(P, 0, lldfPayload(P), 'type')); g.dfPull.spans.pop(); deq(J(dfNow(P, 0)), J(before));
});

test('projectMeta: fields shared, and what a pull changes', () => {
  const P = M.defaultProject(); Object.assign(P.project, { name: 'Route 6 over Mill Brook', number: 'B-123', owner: 'RIDOT', designer: 'AB', checker: 'CD', date: '2026-11-01' });
  const pl = H.pmPayload(P);
  assert.equal(pl._schema, 'bridge-project-meta');
  deq(J(pl.fields), { projectName: 'Route 6 over Mill Brook', bridgeId: '', jobNo: 'B-123', client: 'RIDOT', location: '', preparedBy: 'AB', checkedBy: 'CD', date: '2026-11-01' });
  deq(J(pl.project), { name: 'Route 6 over Mill Brook', bridgeId: '' });
  const Q = M.defaultProject(), todo = H.pmPlan(Q, { fields: { ...pl.fields, location: 'Providence', checkedBy: '' } });
  deq(todo.map(t => t.path), ['name', 'number', 'owner', 'designer', 'date']);   // blank shared fields and fields without a place here: unchanged
});

test('superReactions: GirderDetail\'s payload shape, reactions from the analysis, statics, borrowed lines', () => {
  const P = M.defaultProject(), r = H.srPayload(P); assert.ok(r.ok, r.error);
  const p = r.payload, nb = 5;
  assert.equal(p._schema, 'bridge-super-reactions'); assert.equal(p.schemaVersion, 1); assert.equal(p.factored, false); assert.equal(p.imIncluded, false); assert.equal(p.dfIncluded, false);
  assert.equal(p.perGirder, true); assert.equal(p.allGirders, true); assert.equal(p.liveLoad, null); deq(J(p.units), { force: 'kip', length: 'ft' });
  deq(p.supports.map(s => s.id), ['Abut. 1', 'Pier 1', 'Pier 2', 'Abut. 2']); deq(p.supports.map(s => s.x), [0, 110, 250, 360]);
  p.supports.forEach(s => { deq(s.girders.map(g => g.label), ['G1', 'G2', 'G3', 'G4', 'G5']); deq(s.girders.map(g => g.position), ['exterior', 'interior', 'interior', 'interior', 'exterior']);
    s.girders.forEach(g => ['DC1', 'DC2', 'DW'].forEach(k => assert.ok(Number.isFinite(g[k]) && g[k] > 0))); });
  assert.equal(p.ownerRules.owner, 'AASHTO'); assert.equal(p.ownerRules.llMultiplier.m, 1);
  // G2 is the plate girder's own line: its reactions are its analysis (rounded to 0.001 kip)
  const R = AN.analyzeGirder(P, 0);
  p.supports.forEach((s, k) => ['DC1', 'DC2', 'DW'].forEach(c => assert.equal(s.girders[1][c], Math.round(R.st[c].R[k] * 1000) / 1000)));
  // statics: Σ DW reactions = w_DW × 360 ft for every girder (DW uniform on each girder line)
  for (let i = 0; i < nb; i++) { const Q = J(P); Q.girders[0].line = i; Q.girders[0].position = i === 0 || i === nb - 1 ? 'exterior' : 'interior';
    const w = AN.loadsOf(Q, Q.girders[0], AN.moduleOf(Q, 0)).DW, sum = p.supports.reduce((a, s) => a + s.girders[i].DW, 0);
    assert.ok(Math.abs(sum - w * 360) < 0.003, `G${i + 1}: ${sum} vs ${w} × 360`); }
  // a borrowed line (G3: the plates of plate girder G1, cross-section line 3): LL+IM reactions in the notes equal a full run of that line
  const Q = J(P); Q.girders[0].line = 2; const R3 = AN.analyzeGirder(Q, 0);
  const ll = p.notes.find(n => /LL\+IM reactions per girder/.test(n));
  R3.llR.forEach((q, k) => assert.ok(ll.includes(`${p.supports[k].id}: `) && ll.includes(`G3 ${q.max.toFixed(2)} / ${q.min.toFixed(2)}`), `support ${k}`));
  p.supports.forEach((s, k) => ['DC1', 'DC2', 'DW'].forEach(c => assert.equal(s.girders[2][c], Math.round(R3.st[c].R[k] * 1000) / 1000)));
});
