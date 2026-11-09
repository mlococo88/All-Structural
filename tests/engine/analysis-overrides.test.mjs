// apps/steel-bridge/engine/analysis.js: the "Override calculated value" boxes of the dead loads and the distribution factors
// (girder.loadsOverride / girder.dfOverride, AIN 2026-11-09) and their migration default (absent: on exactly when the loads module gives
// none and a value is entered, so a project saved before computes as before).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const ENG = p => path.join(ROOT, 'apps/steel-bridge/engine', p);
const W = loadShared('units.js', 'steps.js', 'vehicles.js', 'moving-load.js', ENG('model.js'), ENG('sections.js'), ENG('owners.js'), 'lldf.js', ENG('lldf.js'), ENG('loads.js'), ENG('analysis.js'));
const M = W.SBDModel, AN = W.SBDAnalysis;
const of = P => { const g = P.girders[0], mod = AN.moduleOf(P, 0); return { LD: AN.loadsOf(P, g, mod), DF: AN.dfOf(P, g, P.spans.lengths.length, mod), mod }; };
const close = (a, b, t, m) => assert.ok(Math.abs(a - b) <= t, `${m}: ${a} vs ${b}`);

test('AIN: module works, entries stored, no flag: the module values are used (as before)', () => {
  const P = M.defaultProject(); P.girders[0].loadsManual = { DC2: 0.9, DW: 0.8 }; P.girders[0].dfManual = { gM: 0.5 };
  const { LD, DF, mod } = of(P);
  assert.equal(LD.src.DC2, 'module'); close(LD.DC2, mod.G.DC2, 1e-12, 'DC2'); assert.equal(LD.override, false);
  assert.ok(!DF.override); assert.ok(Math.abs(DF.spans[0].gM - 0.5) > 0.05, 'gM from the module');
});
test('AIN: override on: an entered value replaces the calculated one field by field; blank keeps it', () => {
  const P = M.defaultProject(), g = P.girders[0]; g.loadsManual = { DC2: 0.9 }; g.loadsOverride = true; g.dfManual = { gM: 0.6, gV: null }; g.dfOverride = true;
  const { LD, DF, mod } = of(P);
  assert.equal(LD.src.DC2, 'manual'); assert.equal(LD.DC2, 0.9); assert.equal(LD.src.DW, 'module'); close(LD.DW, mod.G.DW, 1e-12, 'DW kept');
  assert.match(LD.source, /with entered overrides/);
  DF.spans.forEach(s => assert.equal(s.gM, 0.6)); DF.piers.forEach(p => assert.equal(p.gM, 0.6, 'pier: blank = the entered span value'));
  const s0 = mod.R.regions.find(r => r.id === 's0').members[mod.j]; assert.equal(DF.spans[0].gV, s0.gV, 'gV blank: the module');
  g.loadsOverride = false; g.dfOverride = false; const o2 = of(P); assert.equal(o2.LD.src.DC2, 'module'); assert.notEqual(o2.DF.spans[0].gM, 0.6);
});
test('AIN: module gives none, entries stored, no flag: the entries are used (as before); flag off: none', () => {
  const P = M.defaultProject(), g = P.girders[0]; P.xs.bays = []; g.loadsManual = { DC1wet: 1.1, DC2: 0.25 }; g.dfManual = { gM: 0.7, gMpier: 0.75 };
  let { LD, DF, mod } = of(P); assert.ok(mod && mod.errors, 'module errors');
  assert.equal(AN.deadOverride(g, null), true); assert.equal(LD.DC1wet, 1.1); assert.equal(LD.source, 'entered (manual)');
  assert.equal(DF.manual, true); assert.equal(DF.spans[0].gM, 0.7); assert.equal(DF.piers[0].gM, 0.75); assert.equal(DF.spans[0].gV, 1);
  g.loadsOverride = false; g.dfOverride = false; ({ LD, DF } = of(P));
  assert.equal(LD.DC1wet, 0); assert.equal(LD.source, 'none entered'); assert.equal(DF.spans[0].gM, 1); assert.match(DF.src, /^none entered/);
});
