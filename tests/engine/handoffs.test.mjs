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
// 7. superGeometry (GXF, 2026-11-09, HANDOFF.md §4.14): sgPayload of the default bridge (hand values), a curb edge, simple spans, per-support and
//    per-span depths with a deeper pier segment, the shared check and content hash, refusals; saved projects compute as before.
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const W = loadShared('units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'handoff-store.js', ...['engine/model.js', 'engine/sections.js', 'engine/owners.js', 'engine/lldf.js', 'engine/loads.js',
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

/* RWPX (2026-11-07, Phase 8f): the Retaining Wall Designer's foundationLoads (revision 2) and pileResults engine, read from the tool's
   file at test time (the block between the RWPX-ENGINE markers) and run with shared/pile-group.js. HANDOFF.md §4.6 / §4.10.
   7. The segment length: the least common multiple of the row spacings (≤ 120 ft), else 120 ft rounded down to the largest spacing.
   8. The payload on a 3-row wall (s = 6, 6, 8 ft → a 24-ft segment, 4 + 4 + 3 piles): Σ pileP = P; every pile of row i carries the
      wall's per-ft P_i (rigid cap, exact segment); My = P·(x̄ − x_R), Mx = 0; Vx = H·L; pileDesign = the wall's P_max / P_min and h;
      the content hash ignores the resistances and follows the loads.
   9. pileResults plan: CURRENT / STALE / not this wall / no hash; AASHTO sets R_n, φ_c, R_n,up, φ_up; ACI sets nothing; per-combination match. */
import fs from 'node:fs';
import vm from 'node:vm';
const RWW = (() => { const W = loadShared('pile-group.js'), src = fs.readFileSync(path.join(ROOT, 'Retaining Wall Designer.html'), 'utf8');
  const m = /\/\* RWPX-ENGINE-BEGIN \*\/([\s\S]*?)\/\* RWPX-ENGINE-END \*\//.exec(src); assert.ok(m, 'RWPX engine block found'); vm.runInContext(m[1], W); return W; })();
function rwFixture(isA, V, xR, H) {
  const SPG = RWW.SharedPileGroup, rows = [{ x: 1.5, s: 6 }, { x: 6.0, s: 6 }, { x: 11.0, s: 8 }], g = SPG.rowGroup(rows), B = 12.5;
  const mk = (key, label, kind, V, xR, H) => { const M = SPG.momentAbout(V, xR, g.xbar); return { key, label, kind, V, xR, H, M, L: SPG.rowLoads(g, V, M, H) }; };
  return { B, tf_ft: 3, isAASHTO: isA, fatal: false,
    inp: { fnd: { type: 'pile', rows, shape: 'hp', desig: 'HP 12x53', D: 12, embed: 12, clr: 3, Rn: 300, phic: 0.65, Rnup: 100, phiup: 0.5, Hr: 20, Pa: 100, Ta: 25, Ha: 8 } },
    pile: { rows, g, comb: isA ? [mk('str_max', 'Strength I (maximum vertical)', 'max', V, xR, H), mk('str_min', 'Strength I (minimum vertical)', 'min', 0.55 * V, xR - 1.6, H)]
                               : [mk('s1', 'D + H + L (service)', 'max', V, xR, H), mk('s3', '0.6D + H (minimum vertical)', 'min', 0.6 * V, xR - 2, H)] } };
}
test('RWPX segment: least common multiple of the row spacings, ≤ 120 ft', () => {
  const S = rows => J(RWW.rwpxSegment(rows.map(s => ({ x: 0, s }))));
  deq(S([6, 6]), { L: 6, exact: true }); deq(S([6, 8]), { L: 24, exact: true }); deq(S([6, 6, 8]), { L: 24, exact: true });
  deq(S([7.5, 10]), { L: 30, exact: true });
  const q = S([7.3, 11.1]); assert.equal(q.exact, false); assert.ok(Math.abs(q.L - 111) < 1e-9);   // LCM 810.3 ft > 120: 10 × 11.1
});
test('RWPX payload: exact segment gives the wall\'s per-ft pile loads; moments, shears, per-pile loads, content hash', () => {
  const r = rwFixture(true, 20, 5.0, 4), b = RWW.rwpxBuild(r, { name: 'Fixture wall' }), p = b.p, g = r.pile.g;
  assert.equal(b.seg.L, 24); assert.equal(p.pileLayout.n, 4 + 4 + 3); assert.equal(p.element.type, 'wall'); assert.equal(p.revision, 2);
  assert.ok(Math.abs(p.pileLayout.centroid.x - (r.B / 2 - g.xbar)) < 1e-6, 'segment centroid = the per-ft x̄');
  assert.ok(Math.abs(p.pileLayout.Sxx - g.I * 24) < 1e-5, 'Σx\'² = I·L'); assert.ok(Math.abs(p.pileLayout.centroid.y) < 1e-9 && Math.abs(p.pileLayout.Sxy) < 1e-9);
  p.cases.forEach((c, k) => { const cb = r.pile.comb[k];
    assert.ok(Math.abs(c.P - cb.V * 24) < 1e-3 && Math.abs(c.Vx - cb.H * 24) < 1e-3 && c.Mx === 0, c.name + ': P = V·L, Vx = H·L, Mx = 0');
    assert.ok(Math.abs(c.My - cb.V * 24 * (g.xbar - cb.xR)) < 2e-3, c.name + ': My = P(x̄ − x_R)');
    assert.ok(Math.abs(c.pileP.reduce((a, v) => a + v, 0) - c.P) < 0.006, c.name + ': Σ pileP = P');
    p.pileLayout.piles.forEach((q, i) => { const row = r.pile.rows.findIndex(w => Math.abs(r.B / 2 - w.x - q.x) < 1e-6);
      assert.ok(Math.abs(c.pileP[i] - cb.L.rows[row].P) < 1.5e-3, c.name + ': pile ' + q.no + ' = row ' + (row + 1) + ' per-ft P'); });
    const dc = p.pileDesign.cases.find(x => x.id === cb.key + ':compression'); assert.ok(Math.abs(dc.P - cb.L.Pmax) < 6e-4 && Math.abs(dc.V - H_(cb)) < 6e-4);
    const dm = p.pileDesign.cases.find(x => x.id === cb.key + ':' + (cb.L.Pmin < 0 ? 'uplift' : 'minimum')); assert.ok(Math.abs(dm.P - cb.L.Pmin) < 6e-4); });
  // hand check, Strength I max: N = 1/6 + 1/6 + 1/8 = 0.45833 /ft; x̄ = (1.5/6 + 6/6 + 11/8)/N = 5.72727 ft; M = 20(5.0 − 5.72727) = −14.5455 kip-ft/ft
  assert.ok(Math.abs(g.N - 0.458333) < 1e-6 && Math.abs(g.xbar - 5.727273) < 1e-6);
  const h0 = p.contentHash, r2 = rwFixture(true, 20, 5.0, 4); r2.inp.fnd.Rn = 450; r2.inp.fnd.phic = 0.7;
  assert.equal(RWW.rwpxBuild(r2, { name: 'Fixture wall' }).p.contentHash, h0, 'hash ignores the resistances');
  assert.notEqual(RWW.rwpxBuild(rwFixture(true, 21, 5.0, 4), { name: 'Fixture wall' }).p.contentHash, h0, 'hash follows the loads');
  assert.equal(RWW.rwpxBuild(rwFixture(false, 20, 5.0, 4), {}).p.cases[0].factored, false, 'ACI: service cases');
});
const H_ = cb => cb.L.rows[0].h;
test('RWPX pileResults plan: stale check, what is set, per-combination match', () => {
  const r = rwFixture(true, 20, 5.0, 4), p = RWW.rwpxBuild(r, {}).p, cur = p.contentHash;
  const res = (basis, extra) => Object.assign({ _schema: 'bridge-pile-results', schemaVersion: 1, producer: 'Pile Designer', producedAt: '2026-11-07T20:00:00Z', units: { force: 'kip', moment: 'kip-ft', length: 'ft' }, basis,
    geotechnical: { static: { Rn: 412.5, phi: 0.45, RnUp: 150, phiUp: 0.35 } },
    cases: [{ name: 'per-pile Strength I max', source: { kind: 'perPile', caseId: 'str_max:compression' }, loads: { P: r.pile.comb[0].L.Pmax, V: H_(r.pile.comb[0]) }, py: { Mmax: 31.2, y0: 0.21 }, checks: { pass: true } }] }, extra || {});
  const B = { producer: 'Retaining Wall Designer', producedAt: '2026-11-07T19:00:00Z', contentHash: cur };
  let q = RWW.rwpxPlan(r, res(B), cur, null); assert.equal(q.status, 'current');
  deq(q.set.map(s => [s.id, s.to]), [['pile_Rn', 412.5], ['pile_phic', 0.45], ['pile_Rnup', 150], ['pile_phiup', 0.35]]);
  assert.equal(q.match[0].M, 31.2); assert.equal(q.match[0].differs, false); assert.equal(q.match[1].none, true);
  assert.equal(RWW.rwpxPlan(r, res(B), 'deadbeef', null).status, 'stale');
  assert.equal(RWW.rwpxPlan(r, res(Object.assign({}, B, { producer: 'Abutment Calculator' })), cur, null).status, 'other');
  assert.equal(RWW.rwpxPlan(r, res(Object.assign({}, B, { contentHash: null })), cur, { producedAt: '2026-11-07T19:30:00Z' }).status, 'stale');
  assert.equal(RWW.rwpxPlan(r, res(Object.assign({}, B, { contentHash: null })), cur, { producedAt: B.producedAt }).status, 'unchecked');
  const ra = rwFixture(false, 20, 5.0, 4); assert.equal(RWW.rwpxPlan(ra, res(B), cur, null).set.length, 0, 'ACI: reference only');
  assert.ok(RWW.rwpxPlan(r, Object.assign(res(B), { units: { force: 'lb' } }), cur, null).err);
  assert.ok(RWW.rwpxPlan(r, Object.assign(res(B), { schemaVersion: 2 }), cur, null).err);
});
test('PDA-M7 pileResults group: R_n and R_n,up imported times the group reduction (Pile Designer Module 11)', () => {
  const r = rwFixture(true, 20, 5.0, 4), p = RWW.rwpxBuild(r, {}).p, cur = p.contentHash;
  const B = { producer: 'Retaining Wall Designer', producedAt: '2026-11-07T19:00:00Z', contentHash: cur };
  const res = grp => ({ _schema: 'bridge-pile-results', schemaVersion: 1, producer: 'Pile Designer', units: { force: 'kip', length: 'ft' }, basis: B,
    geotechnical: { static: { Rn: 400, phi: 0.5, RnUp: 150, phiUp: 0.35 } }, group: grp, cases: [] });
  deq(RWW.rwpxPlan(r, res(null), cur, null).set.map(s => [s.id, s.to]), [['pile_Rn', 400], ['pile_phic', 0.5], ['pile_Rnup', 150], ['pile_phiup', 0.35]], 'no group: as before');
  const q = RWW.rwpxPlan(r, res({ reduce: 0.8, eta: 0.8, blockGoverns: false, uplift: { reduceUp: 0.6 } }), cur, null);
  deq(q.set.map(s => [s.id, +s.to.toFixed(6)]), [['pile_Rn', 320], ['pile_phic', 0.5], ['pile_Rnup', 90], ['pile_phiup', 0.35]]);
  assert.equal(q.group.reduce, 0.8);
  deq(RWW.rwpxPlan(r, res({ reduce: 1, uplift: null }), cur, null).set.map(s => s.to), [400, 0.5, 150, 0.35], 'reduce 1: unchanged');
});

test('superGeometry: sgPayload of the default bridge (hand values) passes the shared §4.14 check', () => {
  const P = M.defaultProject(), r = H.sgPayload(P), HS = W.SharedHandoffStore; assert.equal(r.ok, true, r.error); const p = r.payload;
  deq(HS.checkGeometry(p), { ok: true, errors: [], warnings: [] });
  assert.equal(p._schema, 'bridge-super-geometry'); assert.equal(p.producer, 'Steel Bridge Design'); deq(p.project, { name: 'New steel bridge', bridgeId: '' });
  deq(p.spans, [110, 140, 110]); assert.equal(p.continuity, 'continuous');
  deq(p.supports.map(s => [s.id, s.x, s.skew, s.joint, s.depth]), [['Abut. 1', 0, 0, 'end', 61.875], ['Pier 1', 110, 0, 'continuous', 63.5], ['Pier 2', 250, 0, 'continuous', 63.5], ['Abut. 2', 360, 0, 'end', 61.875]]);
  assert.ok(p.supports.every(s => !('bearings' in s)));   // the app defines no bearing fixity: omitted
  deq(p.girders, { count: 5, spacings: [9.5, 9.5, 9.5, 9.5], ohL: 3.25, ohR: 3.25 });
  deq([p.edges.L.type, p.edges.L.width, p.edges.L.barrierWidth, p.edges.L.height], ['barrier', 1.5, 1.5, null]);
  deq(p.deck, { ts: 8, total: 8.5, haunch: 2 });
  // positive region 60 + 3/4 + 1 1/8 = 61.875 in; pier region 60 + 1 1/2 + 2 = 63.5 in; b_f max(16, 18) = 18; t_f max = 2; t_w = 9/16
  deq([p.section.depth, p.section.bf, p.section.tf, p.section.tw], [63.5, 18, 2, 0.5625]);
  deq(p.section.atSupports, [61.875, 63.5, 63.5, 61.875]); deq(p.section.spanMax, [63.5, 63.5, 63.5]);
  assert.equal(p.contentHash, HS.geometryHash(p)); assert.equal(p.ownerRules.owner, 'AASHTO');
  assert.match(r.sum, /^3 spans, 110–140–110 ft, 5 girders; skews 0\.00, 0\.00, 0\.00, 0\.00 deg/);
  assert.equal(HS.pidOf(p.project), '~New steel bridge');
});

test('superGeometry: curb edge, simple spans, skews as entered, a deeper pier segment; refusals', () => {
  const P = M.defaultProject(); P.spans.continuity = 'simple'; P.xs.skews = [-10, 12.5, 12.5, 30];
  P.xs.edges.R = { type: 'curb', bw: 0, bwt: 0, cw: 12, ch: 10, rw: 0.05, rp: 0.75, rf: null, face: null };   // 10 in curb (< 12 in: mountable) -> the railing face 0.75 ft
  P.girders[0].segments[3] = { ...P.girders[0].segments[3], D: 66 };   // x 232-272 (over pier 2 at 250 ft): 66 + 1.5 + 2 = 69.5 in
  const p = H.sgPayload(P).payload;
  deq(p.supports.map(s => [s.skew, s.joint, s.depth]), [[-10, 'end', 61.875], [12.5, 'joint', 63.5], [12.5, 'joint', 69.5], [30, 'end', 61.875]]);
  deq(p.section.spanMax, [63.5, 69.5, 69.5]); assert.equal(p.section.depth, 69.5);
  deq([p.edges.R.type, p.edges.R.width, p.edges.R.curbWidth, p.edges.R.curbHeight, p.edges.R.barrierWidth], ['curb', 0.75, 12, 10, null]); deq(p.edges.R.railing, { loadPoint: 0.75, trafficFace: null });
  assert.match(p.edges.R.faceBasis, /railing face/); assert.equal(p.continuity, 'simple');
  const Q = M.defaultProject(); Q.xs.skews = [0, 0]; assert.match(H.sgPayload(Q).error, /one skew for each of the 4 supports/);
  const R = M.defaultProject(); R.girders[0].segments = R.girders[0].segments.slice(0, 2); assert.match(H.sgPayload(R).error, /plate girder segment/);
  const S = M.defaultProject(); S.project.name = ''; deq(H.sgPayload(S).payload.project, { name: '', bridgeId: '' });
});

test('superGeometry: building the payload changes nothing in the project (saved data and results unchanged)', () => {
  const P = M.defaultProject(), before = JSON.stringify(P), R0 = AN.analyzeGirder(P, 0); H.sgPayload(P);
  assert.equal(JSON.stringify(P), before); const R1 = AN.analyzeGirder(P, 0); assert.equal(JSON.stringify(R1.st.DC1.R), JSON.stringify(R0.st.DC1.R));
});
