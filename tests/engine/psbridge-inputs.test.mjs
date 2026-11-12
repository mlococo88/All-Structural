// apps/ps-bridge PR 2b: the input tabs wired to the project's base design (docs/ps-bridge-plan.md §5).
//   engine/design.js (the one design girder: base + the bridge values by the old app's PBD.applyBridge), engine/fields.js (every engine input
//   on its tab), engine/inputcheck.js (the blocking input errors). Node, the page's scripts in a vm (loadShared), in page order.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared(...PBD, ...['model', 'design', 'fields', 'inputcheck'].map(n => path.join(APP, `engine/${n}.js`)));
const J = v => JSON.parse(JSON.stringify(v));
const errs = P => W.PSBInputCheck.collect(P).errors;

test('default project: no input error; the design inputs give the old app\'s default design (every check identical)', () => {
  const P = W.PSBModel.defaultProject();
  assert.deepEqual(J(errs(P)), []);
  const i = W.PSBDesign.inputs(P), R = W.computeAll(i), R0 = W.computeAll(J(W.mergeInputs(null)));
  assert.equal(R.error, null);
  assert.deepEqual(J(R.checks), J(R0.checks)); assert.deepEqual(J(R.warns), J(R0.warns));
  assert.equal(i.L, 120); assert.equal(i.S, 9); assert.equal(i.nGirders, 5); assert.equal(i.loads.pos, 'interior'); assert.equal(i.proj.girderId, 'G2 (Interior)');
  assert.deepEqual(J(P.base), J(W.mergeInputs(null)));   // inputs() changes nothing in the project
});

test('the bridge values of the design: span s, spacing, girder count, position, overhang side, skew, continuity (PBD.applyBridge + 3 values)', () => {
  const P = W.PSBModel.defaultProject();
  P.spans = { lengths: [100, 125, 100], continuity: 'composite' }; P.xs = { nb: 6, bays: [8.5, 8.5, 8.5, 8.5, 8.5], ohL: 2.5, ohR: 3.25, skews: [10, 20, 20, 10] };
  P.design = { g: 6, s: 2 };
  assert.deepEqual(J(errs(P)), []);
  const i = W.PSBDesign.inputs(P);
  assert.equal(i.L, 125); assert.equal(i.S, 8.5); assert.equal(i.nGirders, 6); assert.equal(i.loads.pos, 'exterior'); assert.equal(i.loads.posAuto, false);
  assert.equal(i.deck.oh, 3.25); assert.equal(i.loads.skew, 20); assert.equal(i.cont.on, true); assert.deepEqual(J(i.cont.spans), [100, 125, 100]); assert.equal(i.cont.span, 2);
  assert.equal(i.proj.girderId, 'G6 (Exterior)');
  // the same as the old app's bridge bar with the same inputs
  const o = W.PBD.applyBridge({ title: { name: P.project.name, by: '', date: '', job: '' }, spans: [100, 125, 100], nGirders: 6, S: 8.5 }, J(P.base), 6, 2);
  ['L', 'S', 'nGirders', 'proj'].forEach(k => assert.deepEqual(J(i[k]), J(o[k]), k));
  P.design = { g: 1, s: 1 }; P.xs.skews = [10, 10, 20, 10];
  const e = W.PSBDesign.inputs(P); assert.equal(e.deck.oh, 2.5); assert.equal(e.loads.skew, 10); assert.equal(e.L, 100);
  P.spans.continuity = 'simple'; assert.equal(W.PSBDesign.inputs(P).cont.on, false);
  P.spans = { lengths: [120], continuity: 'composite' }; P.xs.skews = [0, 0]; assert.equal(W.PSBDesign.inputs(P).cont.on, false);   // one span: no continuity
  const R = W.computeAll(W.PSBDesign.inputs(P)); assert.equal(R.error, null);
});

test('PR 2b limits and the design choice are blocking errors with their path', () => {
  const P = W.PSBModel.defaultProject();
  P.xs.bays = [9, 10, 9, 9]; P.xs.skews = [0, 15]; P.design = { g: 7, s: 2 };
  const p = errs(P).map(e => e.path);
  ['xs.bays', 'design.g', 'design.s'].forEach(k => assert.ok(p.includes(k), k));
  P.design = { g: 2, s: 1 }; assert.ok(errs(P).some(e => e.path === 'xs.skews' && /different skews/.test(e.msg)));
  P.xs = { nb: 1, bays: [], ohL: 3, ohR: 3, skews: [0, 0] }; assert.ok(errs(P).some(e => e.path === 'xs.nb'));
});

test('field rules: blank, sign, whole counts, limits, options; table rows; locations inside the girder and the span; ages in order', () => {
  const P = W.PSBModel.defaultProject(), b = P.base;
  b.mat.fc = ''; b.ts = -1; b.harp.n = 2.5; b.harp.frac = 0.6; b.str.size = '0.8 in'; b.opt.endZoneLen = 0.7; b.mat.H = 120;
  b.rows[1].y = 80; b.rows[2].nd = 9; b.rows.push({ n: -2, y: 10, nd: 0, dbnd: 0 }); b.loads.diaph = [{ P: 1, a: 130 }]; b.mat.td = 0.5; b.mat.tfin = 0.4;
  const E = errs(P), by = k => E.find(e => e.path === k);
  assert.match(by('base.mat.fc').msg, /blank/); assert.match(by('base.ts').msg, /zero or a positive/); assert.match(by('base.harp.n').msg, /whole number/);
  assert.match(by('base.harp.frac').msg, /0.5 or less/); assert.match(by('base.str.size').msg, /choose/); assert.match(by('base.opt.endZoneLen').msg, /0.5 or less/);
  assert.match(by('base.mat.H').msg, /100 or less/); assert.match(by('base.rows.1.y').msg, /not inside the girder \(h = 72 in\)/);
  assert.match(by('base.rows.2.nd').msg, /more than the 8 strands/); assert.equal(by('base.rows.3.n').cell, 3);
  assert.match(by('base.loads.diaph.0.a').msg, /beyond the span/); assert.ok(by('base.mat.td') && by('base.mat.tfin'));
  E.forEach(e => assert.ok(W.PSBFields.tabOf(e.path), 'tab of ' + e.path));
  // hidden fields are not checked: an entered b_eff while automatic, manual DF while auto
  const Q = W.PSBModel.defaultProject(); Q.base.beff = -5; Q.base.loads.dfm = 0; assert.deepEqual(J(errs(Q)), []);
  Q.base.loads.dfAuto = false; assert.ok(errs(Q).some(e => e.path === 'base.loads.dfm'));
  Q.base.opt.relCfac = ''; Q.base.cont.AsPos = ''; Q.base.loads.dfm = 0.7; Q.base.loads.dfv = 0.8; assert.deepEqual(J(errs(Q)), []);   // blank allowed (opt)
});

test('every engine input of the old app\'s DEFAULTS is on an input tab, driven by the bridge, or listed as not exposed (as in the old app)', () => {
  const D = W.mergeInputs(null), leaves = [];
  const walk = (o, p) => { if (o && typeof o === 'object' && !Array.isArray(o)) Object.keys(o).forEach(k => walk(o[k], p ? p + '.' + k : k)); else leaves.push(p); };
  walk(D, '');
  const fields = new Set(W.PSBFields.ALL().map(f => f.p.slice(5))), tables = Object.keys(W.PSBFields.TABLES).map(t => t.slice(5));
  const driven = W.PSBDesign.DRIVEN;
  // not exposed by the old app's input cards either (fixed values or its stability-screening constants); MIDAS: a later PR
  const NOT = ['str.fpu', 'str.lowlax', 'handling.sweep', 'handling.fr', 'handling.zo', 'handling.ag', 'handling.gFactor', 'deck.method', 'opt.splitFy',
    'loads.extDFpos', 'loads.extDFneg', 'loads.extDFv', 'loads.extLLmpf', 'external'];
  const miss = leaves.filter(l => !fields.has(l) && !tables.includes(l) && !NOT.includes(l) && !driven.some(d => l === d || l.startsWith(d + '.')));
  assert.deepEqual(miss, []);
  W.PSBFields.ALL().forEach(f => { assert.ok(f.t.length > 10, 'tooltip ' + f.p); assert.ok(W.PSBFields.tabOf(f.p) === f.card.tab, f.p); });
  ['base.owner', 'base.opt.etaR', 'base.opt.llMult', 'base.opt.sidewalk'].forEach(p => assert.equal(W.PSBFields.tabOf(p), 'own'));
  assert.equal(W.PSBFields.tabOf('base.rows.2.y'), 'gird'); assert.equal(W.PSBFields.tabOf('base.loads.diaph.0.P'), 'dd'); assert.equal(W.PSBFields.tabOf('design.g'), 'gird');
  const dr = W.PSBFields.ALL().filter(f => /harp/.test(f.p)).map(f => f.l + f.t).join(' ');
  assert.match(dr, /draped/i); assert.match(dr, /℄ bearing/); assert.doesNotMatch(W.PSBFields.ALL().map(f => f.l).join(' '), /harp/i);   // PS-5 wording, PS-13 location
});
