// Steel Bridge app (SBLK, 2026-11-24; engineer, approved follow-ups SBNG-2 / SBNG-3 of #1709; display only): every check item's step link
// ("§") has a worked step. FA4's detailing items link to faD.cp, faD.lat, faD.skew (engine/fatigue.js detSteps, shown on the Fatigue & studs
// tab, selection 'fd'); CF10 links to cf.type (engine/crossframes.js typeStep where typeRecStep wrote none). Audit: on made-up bridges, every
// item / row of every module with a step link names a step that the engines or tabs write.
import assert from 'node:assert/strict';
import path from 'node:path';
import { test, loadShared, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const FILES = ['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'report.js', 'deck.js', 'barrier.js', 'dxf.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/proportions.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'engine/rating.js', 'ui/sub.js', 'ui/flexure.js', 'ui/loads.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/rating.js', 'ui/splices.js', 'ui/constructibility.js', 'engine/welds.js', 'ui/welds.js',
  'engine/deck.js', 'engine/sheets.js', 'ui/deflection.js', 'report/data.js', 'report/builders.js', 'report/summary.js', 'ui/deck.js'].map(E));
const J = o => JSON.parse(JSON.stringify(o));
const W = loadShared(...FILES), M = W.SBDModel, ST = W.SharedSteps;
const thin = P => P.girders.forEach(g => g.segments.forEach(s => { s.tw = Math.max(0.4375, s.tw - 0.125); s.botT = Math.max(0.75, s.botT * 0.6); s.topT = Math.max(0.625, s.topT * 0.6); s.botB = Math.max(12, s.botB - 4); s.topB = Math.max(12, s.topB - 4); }));
const shallow = P => P.girders.forEach(g => g.segments.forEach(s => { s.D = Math.round(s.D * 0.6); }));
const det = (P, o) => { P.fatigue = P.fatigue || {}; P.fatigue.dist = Object.assign({ cp: 'no', lat: 'yes', latLoc: 'web', latStiff: 'no', latBf: 16, latDist: 4, skew: 'yes' }, o); };

test('SBLK: FA4 detailing steps — the items\' values and statuses, worked (yes / no inputs; the lateral plate distance)', () => {
  const FA = W.SBDFatigue, mk = o => { const p = J(FA.DEFAULT); p.dist = Object.assign({}, p.dist, o); return { p }; };
  const ids = l => J(l.map(s => s.id));
  assert.deepEqual(ids(FA.detSteps(mk({}))), ['faD.cp'], 'default: connection plates attached (yes), no lateral bracing, no skew');
  const s1 = FA.detSteps(mk({ cp: 'no', lat: 'yes', latLoc: 'web', latStiff: 'no', latBf: 16, latDist: 4, skew: 'yes' }));
  assert.deepEqual(ids(s1), ['faD.cp', 'faD.lat', 'faD.skew']);
  assert.equal(s1[0].value, 'no'); assert.equal(s1[0].ok, false);
  // unstiffened web: required max(6.0, 16/2) = 8.00 in > 4.00 in provided: fails (FA4 ratio 8/4 = 2.000)
  assert.equal(s1[1].value, 4); assert.equal(s1[1].ok, false); assert.equal(s1[1].sub, '4.00 \\lt \\max\\left(6.0,\\ \\frac{16.00}{2}\\right) = 8.00');
  assert.equal(ST.line(s1[1], false), 'd_(lat) ≥ max(6.0, b_f/2) = 4.00 < max(6.0, 16.00/2) = 8.00');
  assert.equal(s1[2].ok, undefined, 'a warning: no pass / fail');
  const s2 = FA.detSteps(mk({ lat: 'yes', latLoc: 'web', latStiff: 'yes', latBf: 16, latDist: 10 }));   // stiffened: 16/2 = 8.00 ≤ 10.00: OK
  assert.equal(s2[1].ok, true); assert.equal(s2[1].sub, '10.00 \\ge \\frac{16.00}{2} = 8.00');
  assert.deepEqual(ids(FA.detSteps(mk({ cp: 'na', lat: 'yes', latLoc: 'flange' }))), ['faD.lat']);
  // the items link to these steps, the same statuses
  const R = { p: mk({ cp: 'no', lat: 'yes', latLoc: 'web', latStiff: 'no', latBf: 16, latDist: 4, skew: 'yes' }).p, rows: [], ev: { on: false }, env: { rule: () => null, cite: () => '' } };
  const C = FA.checks(R).find(c => c.id === 'FA4');
  assert.deepEqual(J(C.items.map(it => [it.step, it.st])), [['faD.cp', 'fail'], ['faD.lat', 'fail'], ['faD.skew', 'warn']]);
  assert.equal(C.items[1].r, 2);
});

test('SBLK: CF10 links to a worked step cf.type (girder depth against d_min) in every bracing mode', () => {
  for (const [nm, fn, rel, val] of [['built-in (cross-frames)', () => {}, '\\ge', 'cross-frame'], ['shallow, diaphragm', P => { shallow(P); P.crossframes = P.crossframes || M.defaultCrossframes(); P.crossframes.dia = Object.assign({}, P.crossframes.dia, { on: 'yes' }); }, '\\lt', 'diaphragm']]) {
    const P = J(M.defaultProject()); fn(P);
    const B = W.SBDFramingUI.build({ P, g: 0 }), it = B.C.find(c => c.id === 'CF10').items[0], s = B.R.steps.find(q => q.id === 'cf.type');
    assert.equal(it.step, 'cf.type'); assert.ok(s, nm + ': cf.type');
    assert.equal(s.sub, `${it.demand.toFixed(2)} ${rel} ${it.capacity.toFixed(2)}`, nm); assert.equal(s.value, val); assert.equal(s.ok, undefined);
    assert.equal(B.R.steps.filter(q => q.id === 'cf.type').length, 1);
  }
});

test('SBLK audit: every check item / row with a step link names a step the engines or tabs write (made-up bridges)', () => {
  const all = new Set(), s0 = ST.step, w0 = ST.work;
  ST.step = o => { const s = s0(o); all.add(s.id); return s; }; ST.work = p => { const w = w0(p), a0 = w.add; w.add = o => { const v = a0(o); all.add(w.steps[w.steps.length - 1].id); return v; }; return w; };
  const BR = { builtin: () => {}, thin, det: P => { thin(P); det(P); }, flangeLat: P => { shallow(P); det(P, { cp: 'yes', latLoc: 'flange', skew: 'no' }); },
    dia: P => { shallow(P); P.crossframes = P.crossframes || M.defaultCrossframes(); P.crossframes.dia = Object.assign({}, P.crossframes.dia, { on: 'yes' }); },
    deck: P => { thin(P); P.deckDesign = { on: true, sBot: 18, sTop: 18, barTop: 0.2, barBot: 0.2, barLongBot: 0.11, sLongBot: 18 }; } };
  const dead = [], n = {};
  try {
    for (const [name, fn] of Object.entries(BR)) {
      const P = J(M.defaultProject()); fn(P); all.clear();
      const B = W.SBDReportData.compute(P, 0, { src: 'analysis' });
      B.cn.rows.forEach(r => [r, r.alt].filter(Boolean).forEach(q => W.SBDConstrUI.stepsOf(B.cn, q)));
      B.flex.rows.forEach(r => W.SBDFlexureUI.stepsOf(B.flex, r));
      B.fat.FR.rows.forEach(r => W.SBDFatigueUI.stepsOf(B.fat, 'fa', r)); W.SBDFatigueUI.stepsOf(B.fat, 'fd');
      B.shear.stations.forEach(r => W.SBDShearUI.stepsOf(B.shear, 'loc', r)); B.shear.TS.rows.forEach(r => W.SBDStiffeners.transverseSteps(B.shear.TS, r)); B.shear.BS.rows.forEach(r => W.SBDStiffeners.bearingSteps(B.shear.BS, r));
      B.spl.list.forEach(s => W.SBDSplicesUI.stepsOf(B.spl, s));
      B.wd.R.fw.forEach(r => W.SBDWeldsUI.stepsOf(B.wd, 'fw', r.i)); B.wd.R.tr.forEach(r => W.SBDWeldsUI.stepsOf(B.wd, 'tr', r.i));
      W.SBDReportBuild.model(B, { detail: 'all' });
      const seen = new Set(), walk = (o, m, d) => { if (!o || typeof o !== 'object' || d > 9 || seen.has(o)) return; seen.add(o); if (Array.isArray(o)) return o.forEach(x => walk(x, m, d + 1));
        if (typeof o.step === 'string' && ('st' in o || 'ratio' in o || 'ok' in o)) { n[m] = (n[m] || 0) + 1; if (!all.has(o.step)) dead.push(`${name} ${m}: ${o.step} (${o.loc || o.id || ''})`); }
        for (const k of Object.keys(o)) if (!['P', 'steps', 'memo', 'an', 'pl', 'sup'].includes(k)) walk(o[k], m, d + 1); };
      for (const k of ['flex', 'shear', 'fat', 'cn', 'frm', 'spl', 'wd', 'dk', 'rating']) walk(B[k], k, 0);
      if (B.an) walk(B.an.defl, 'defl', 0);
    }
  } finally { ST.step = s0; ST.work = w0; }
  assert.deepEqual(dead, []);
  for (const k of ['flex', 'shear', 'fat', 'cn', 'frm', 'spl', 'wd', 'dk']) assert.ok(n[k] > 0, k);
  console.log(`       item step links checked: ${JSON.stringify(n)}`);
});
