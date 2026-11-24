// SBALLOW (2026-11-24): Steel Bridge Design's girder steel detail allowance. The analysis (engine/analysis.js loadsOf) takes it from
// the girder loads (girder.loads.steelAllowPct, a hand-off), else the loads module (xs.allow, Loads input tab, "Wearing surface, forms and
// steel"; blank: 0), else the Analysis setting analysis.steelAllowPct (default 5). SBDAnalysis.allowFor / allowOf give that value and its
// source once; the Analysis settings card shows it read-only when it is not the setting, and the erection drawing's shipping-piece table
// (engine/sheets.js erect) uses it per plate girder (before: the Analysis setting for every girder).
// 1. allowOf = analyzeGirder(...).loads.steelAllowPct and the right source, for every source.
// 2. Erection sheet: xs.allow 3 %, setting 5 %: the header says 3 % and every piece = plates × 1.03 (before: × 1.05).
//    Hand check: a piece of 30.00 kip of plates: before 30.00 × 1.05 = 31.50 kip, after 30.00 × 1.03 = 30.90 kip.
// 3. Two plate girders with different allowances (hand-off loads 5 % and 8 %): the header says "% BY GIRDER", each row its own %.
// 4. Analysis settings card (ui/analysis.js inputs): the box when the setting is used, else the value read-only with its source and link.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { projectFromPayload, readPayload } from './an-fixture.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const FILES = ['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'report.js', 'dxf.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'engine/rating.js', 'engine/welds.js', 'ui/flexure.js', 'ui/loads.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/rating.js', 'ui/splices.js', 'ui/welds.js',
  'report/data.js', 'report/builders.js', 'engine/drawings.js', 'engine/sheets.js', 'ui/analysis.js'].map(E));
const W = loadShared(...FILES), AN = W.SBDAnalysis, M = W.SBDModel, DW = W.SBDDrawings, SH = W.SBDSheets;
const J = o => JSON.parse(JSON.stringify(o));
const base = () => { const P = J(M.defaultProject()); P.framing = { ...M.defaultFraming(), splices: [82] }; return P; };
const payload = () => { const P = projectFromPayload(readPayload('gd_builtin28_AASHTO_G1.json')); P.xs = M.defaultXs(P); Object.assign(P.xs, { nb: 5, bays: [9.5, 9.5, 9.5, 9.5], skews: [28, 28, 28, 28] });
  P.framing = { ...M.defaultFraming(), splices: [82, 145, 215, 278] }; P.stiffeners = M.defaultStiffeners(); P.crossframes = M.defaultCrossframes();
  P.ownerRules = P.ownerRules || { owner: 'AASHTO', eta: { D: 'no', R: 'auto', I: 'no', eD: 1, eR: 1, eI: 1 } }; return P; };
// the texts of the erection sheet, in drawing order (DW.table writes each row's cells in turn)
const erectTexts = P => { const G = DW.model(P); assert.equal(G.errors.length, 0, G.errors.join(' ')); return SH.build(G, null, { paper: 'D', only: ['erect'], date: '2026-11-24' }).D.E.filter(e => e.t === 'TEXT').map(e => e.s); };
// the shipping-piece rows [mark, plates, with allowance]: a row is MARK, GIRDER, FROM, TO, LENGTH, PLATES, WITH ALLOWANCE
const pieces = T => T.flatMap((t, i) => /^G\d+-[A-Z]$/.test(t) && T[i + 1] === t.split('-')[0] ? [[t, T[i + 5], T[i + 6]]] : []);

test('SBALLOW: allowOf gives the allowance analyzeGirder uses, and its source', () => {
  const cases = [];
  { const P = base(); P.xs.allow = 3; P.analysis = { ...(P.analysis || {}), steelAllowPct: 5 }; cases.push(['xs.allow 3, setting 5', P, 3, 'module']); }
  { const P = base(); P.xs.allow = null; P.analysis = { ...(P.analysis || {}), steelAllowPct: 7 }; cases.push(['xs.allow blank, setting 7', P, 0, 'module']); }
  { const P = base(); P.xs.nb = 0; P.analysis = { ...(P.analysis || {}), steelAllowPct: 6 }; cases.push(['loads module error, setting 6', P, 6, 'setting']); }
  { const P = payload(); P.xs.allow = 2; cases.push(['hand-off loads 5 %, xs.allow 2', P, 5, 'girder']); }
  { const P = payload(); P.girders.forEach(g => { delete g.df; delete g.loads.steelAllowPct; }); P.xs.allow = 2; cases.push(['hand-off loads without an allowance, xs.allow 2', P, 2, 'module']); }
  for (const [name, P, pct, src] of cases) {
    const a = AN.allowOf(P, 0), R = AN.analyzeGirder(P, 0);
    assert.equal(a.pct, pct, `${name}: pct`); assert.equal(a.src, src, `${name}: source`);
    assert.equal(R.loads.steelAllowPct, a.pct, `${name}: the analysis uses ${R.loads.steelAllowPct}`);
    const mod = P.girders[0].loads && P.girders[0].df ? null : AN.moduleOf(P, 0);
    assert.deepEqual(AN.allowFor(P, P.girders[0], mod), a, `${name}: allowFor with the module`);
  }
  console.log(`       ${cases.length} projects: allowOf = the analysis's steelAllowPct (sources module, setting, girder)`);
});

test('SBALLOW: erection sheet pieces with the allowance of the analysis (xs.allow 3 %, setting 5 %)', () => {
  const P = base(); P.xs.allow = 3; P.analysis = { ...(P.analysis || {}), steelAllowPct: 5 };
  const T = erectTexts(P), pc = pieces(T);
  assert.ok(T.includes('WITH 3% DETAIL ALLOWANCE (KIP)'), 'header 3 %'); assert.ok(!T.some(t => /WITH 5% DETAIL/.test(t)), 'not the setting 5 %');
  assert.ok(pc.length >= 2, `pieces found: ${pc.length}`);
  pc.forEach(([mk, w, wa]) => assert.ok(Math.abs(parseFloat(wa) - parseFloat(w) * 1.03) <= 0.006, `${mk}: ${wa} vs ${w} x 1.03`));
  // hand check (comment above): 30.00 x 1.05 = 31.50 before, 30.00 x 1.03 = 30.90 after
  assert.equal((30 * (1 + 5 / 100)).toFixed(2), '31.50'); assert.equal((30 * (1 + 3 / 100)).toFixed(2), '30.90');
  // the default project (xs.allow 5 = setting 5): as before
  const T0 = erectTexts(base()); assert.ok(T0.includes('WITH 5% DETAIL ALLOWANCE (KIP)'));
  console.log(`       ${pc.length} pieces at 1.03 x plates (${pc.map(p => `${p[0]} ${p[1]} -> ${p[2]}`).join(', ')})`);
});

test('SBALLOW: two plate girders with different allowances: "% BY GIRDER", each piece at its own', () => {
  const P = payload(), g2 = J(P.girders[0]); g2.id = 'G2x'; g2.label = 'EXT'; g2.position = 'exterior'; g2.loads.steelAllowPct = 8; P.girders[0].position = 'interior'; P.girders.push(g2);
  const G = DW.model(P), pg = Object.fromEntries(G.girders.map(g => [g.label, g.pg])), T = erectTexts(P), pc = pieces(T);
  assert.ok(new Set(Object.values(pg)).size === 2, 'both plate girders drawn');
  assert.ok(T.includes('WITH DETAIL ALLOWANCE (KIP; % BY GIRDER)'), 'header');
  pc.forEach(([mk, w, wa]) => { const a = pg[mk.split('-')[0]] === 1 ? 8 : 5; assert.ok(wa.includes(`(${a}%)`), `${mk}: ${wa}`); assert.ok(Math.abs(parseFloat(wa) - parseFloat(w) * (1 + a / 100)) <= 0.006, `${mk}: ${wa} vs ${w}`); });
  console.log(`       ${pc.length} pieces, ${pc.filter(p => p[2].includes('(8%)')).length} at 8 %`);
});

test('SBALLOW: Analysis settings card: the box only when the setting is used; else the value used, read-only, with its link', () => {
  const UI = W.SBDAnalysisUI;
  { const P = base(); P.xs.allow = 3; P.analysis = { ...(P.analysis || {}), steelAllowPct: 5 }; const h = UI.inputs(P, 0);
    assert.ok(!/data-k="steelAllowPct"/.test(h), 'no editable box'); assert.ok(/id="an_a_steelAllowPct_used" value="3" disabled/.test(h), 'read-only 3');
    assert.ok(/from the loads module: Steel detail allowance \(<a href="#" data-itgo="loads">/.test(h), 'link to the entry'); assert.ok(/entered before \(5 %\) is kept/.test(h), 'the stored setting is named'); }
  { const P = base(); P.xs.nb = 0; P.analysis = { ...(P.analysis || {}), steelAllowPct: 6 }; const h = UI.inputs(P, 0);
    assert.ok(/data-an="a" data-k="steelAllowPct" value="6"/.test(h), 'editable box with 6'); assert.ok(!/steelAllowPct_used/.test(h)); }
  { const P = payload(); const h = UI.inputs(P, 0); assert.ok(/steelAllowPct_used" value="5" disabled/.test(h) && /girder loads of the imported hand-off/.test(h), 'hand-off'); }
});
