// Demand files the app takes (B1, 2026-11-01; apps/steel-bridge/engine/demandfile.js): GirderDetail hand-offs only, as ST-Girder.
//
// 1. Every recorded GirderDetail hand-off (tests/projects/st/*.json, 112 files) is taken, unchanged (the same object the tabs used
//    before), and ST-Girder's own gdAdopt (its gdCheck) takes each of them too.
// 2. Other demand files (tests/projects/ext: the MCT Generator / MIDAS envelope in the PS-Beam schema with selfWeightExcluded:true, the
//    same envelope in the stgirder schema, a steel-beam envelope, a bare MIDAS station list) are refused, naming the producer, as
//    ST-Girder's Import refuses them (engineer decision DISC 2026-10-19). The refusal condition is read from ST-Girder's source.
// 3. GirderDetail hand-offs that fail ST-Girder's gdCheck (moments in kip-in, factored:true, a station value not a number, a bad
//    ownerRules factor) are refused with gdCheck's reason; ST-Girder's gdAdopt refuses each of them as well.
// 4. selfWeightExcluded:true. DC1 is counted once: a GirderDetail hand-off's M_DC1 already holds the girder self-weight (M_DC1steel
//    is part of it) and the app takes M_DC1 as it is (Flexure fromPayload env.MDC1 = the payload's M_DC1); a file that says the
//    self-weight is excluded is refused (new here). ST-Girder would add its own continuous-girder self-weight (SW-CONT) to such a
//    file: on def15_AASHTO_G2 (span 1, 110 ft, x = 66 ft) its M_DC1 goes 524.167 → 602.223 kip-ft (+78.06 kip-ft, about the
//    payload's own steel part M_DC1steel = 88.124 kip-ft), i.e. a GirderDetail file marked that way would count the steel twice.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { stSession, stCompute, stEngine } from './st-source.mjs';

const W = loadShared('units.js', 'steps.js', path.join(ROOT, 'apps/steel-bridge/engine/demandfile.js'), path.join(ROOT, 'apps/steel-bridge/engine/sections.js'),
  path.join(ROOT, 'apps/steel-bridge/engine/flexure.js'));
const DF = W.SBDDemandFile;
const rd = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const ST_DIR = path.join(ROOT, 'tests/projects/st'), EXT_DIR = path.join(ROOT, 'tests/projects/ext');
const def15 = () => rd(path.join(ST_DIR, 'def15_AASHTO_G2.json'));

test('every recorded GirderDetail hand-off is taken unchanged, as ST-Girder takes it', () => {
  const files = fs.readdirSync(ST_DIR).filter(f => f.endsWith('.json'));
  assert.equal(files.length, 112);
  for (const f of files) {
    const j = rd(path.join(ST_DIR, f)), r = DF.check(j);
    assert.ok(r.ok, f + ': ' + r.error);
    assert.equal(r.pl, j.payload || j, f + ': the payload object itself');
    assert.equal(DF.gdCheck(r.pl), null);
  }
  // ST-Girder's own gdAdopt on a sample (the full set runs in st_* parity tests): it takes them too
  for (const f of ['def15_AASHTO_G2.json', 'gd_util_MassDOT_G3.json', 'gd_xsA_RIDOT_G5.json', 'gd_curb_CTDOT_G1.json']) assert.ok(stSession(rd(path.join(ST_DIR, f)).payload), f);
});

test('MCT / MIDAS, PS-Beam and steel-beam demand files are refused, as ST-Girder refuses them (DISC)', () => {
  const want = { 'mct_psbeam_selfweight_excluded.json': 'MCT Generator', 'mct_stgirder_schema.json': 'MCT Generator', 'steelbeam_envelope.json': 'Steel Beam', 'midas_bare_stations.json': 'another tool (MCT Generator / MIDAS)' };
  assert.deepEqual(fs.readdirSync(EXT_DIR).filter(f => f.endsWith('.json')).sort(), Object.keys(want).sort());
  const E = stEngine().ctx;
  for (const [f, who] of Object.entries(want)) {
    const p = rd(path.join(EXT_DIR, f)), r = DF.check(p);
    assert.equal(r.ok, false, f); assert.equal(r.refused, true, f);
    assert.ok(r.error.includes('this file is from ' + who + ' and was not loaded. Nothing was changed.'), f + ': ' + r.error);
    // ST-Girder: not a GirderDetail hand-off (extFromGD false), so its Import goes to the refusal branch
    assert.equal(E.extFromGD(p), false, f);
  }
  // the refusal condition is ST-Girder's: its Import text, then this port
  const html = fs.readFileSync(path.join(ROOT, 'Steel Bridge Design.html'), 'utf8');
  assert.ok(html.includes("if(p._schema==='stgirder-external-demands'&&extFromGD(p)){ gdAdopt(p,'file '+f.name); return; }"));
  assert.ok(html.includes("if(p._schema==='psbeam-external-demands'||p._schema==='stgirder-external-demands'||p._schema==='steelbeam-external-demands'||Array.isArray(p.stations)){"));
  assert.ok(html.includes('function extFromGD(ext){ return !!(ext&&ext.producer===\'GirderDetail\'&&ext.girderDetail); }'));
  // a GirderDetail-schema file without the girderDetail block is not GirderDetail's
  const q = def15().payload; delete q.girderDetail; assert.equal(DF.check(q).refused, true);
  // not a demands file at all (a project file): not "refused", the tab's own message
  const n = DF.check({ app: 'GirderDetail', data: {} }); assert.equal(n.ok, false); assert.equal(n.refused, false); assert.ok(n.error.startsWith('not a GirderDetail'));
});

test('GirderDetail hand-offs that fail gdCheck are refused with its reason, as ST-Girder refuses them', () => {
  const cases = [
    [p => { p.units = { ...p.units, moment: 'kip-in' }; }, 'units must be ft / ft-kip / kip (got ft / kip-in / kip)'],
    [p => { p.factored = true; }, 'the forces must be unfactored (factored:false)'],
    [p => { p.stations[5].M_DW = 'n/a'; }, 'station value M_DW is not a number'],
    [p => { p.stations[7].M_FATpos = null; }, 'station value M_FATpos is not a number'],
    [p => { p.stations = p.stations.slice(0, 1); }, 'no stations'],
    [p => { p.ownerRules = { ...(p.ownerRules || {}), llMultiplier: { m: -1 } }; }, 'ownerRules: a factor is not a positive number'],
    [p => { p.ownerRules = { ...(p.ownerRules || {}), haunchInProperties: 'yes' }; }, 'ownerRules.haunchInProperties must be true or false'],
    [p => { p.member = { ...p.member, supports: [0, 110, 110, 360] }; }, 'invalid span layout'],
  ];
  for (const [mut, why] of cases) {
    const p = def15().payload; mut(p);
    const r = DF.check(p); assert.equal(r.ok, false, why); assert.equal(r.refused, false);
    assert.equal(r.error, 'cannot use the GirderDetail hand-off: ' + why + '. Nothing was changed.');
    assert.equal(stSession(p), null, 'ST-Girder gdAdopt refuses: ' + why);
  }
});

test('selfWeightExcluded: DC1 counted once (taken as the file gives it; a file without the self-weight is refused)', () => {
  const j = def15(), p = j.payload, r = DF.check(j);
  assert.equal(p.selfWeightExcluded, false); assert.ok(r.ok);
  // the app takes M_DC1 as it is: Flexure's envelope at every payload station is the payload's M_DC1 (nothing added)
  const F = W.SBDFlexure.fromPayload(r.pl, {});
  p.stations.forEach((s, i) => { assert.equal(F.env.MDC1[i], s.M_DC1); });
  // ... and M_DC1 holds the girder self-weight once: M_DC1steel is a part of it (x = 66 ft: 88.124 of 524.167 kip-ft)
  const s66 = p.stations.find(s => s.x === 66); assert.equal(s66.M_DC1, 524.167); assert.equal(s66.M_DC1steel, 88.124);
  // selfWeightExcluded:true: refused (GirderDetail never sends it; the MCT fixture with it is refused above)
  const t = DF.check({ payload: { ...p, selfWeightExcluded: true } });
  assert.equal(t.ok, false); assert.equal(t.refused, true); assert.ok(t.error.includes('selfWeightExcluded: true'));
  // what ST-Girder would do with it: add its own self-weight on top of GirderDetail's M_DC1 (counted twice)
  const s0 = stSession(p), s1 = stSession({ ...p, selfWeightExcluded: true });
  const a = stCompute(s0).stations, b = stCompute(s1).stations, i = a.findIndex(s => s.x === 66);
  assert.ok(i >= 0); assert.equal(a[i].M1, 524.167);
  assert.ok(Math.abs(b[i].M1 - 602.223) < 5e-4, String(b[i].M1));   // 524.167 + 78.056
});
