// Steel Bridge Report and worked-step fixes (SBRF, 2026-11-25; display only, no computed value changes):
//   1. no substitution prints two numbers next to each other with no operator or bracket between them ("0.86" then "0.19" as "0.860.19",
//      "12" then "0.00" as "120.00"): every number the engines format (SharedSteps.n / g) is marked in this test, and every worked step's
//      sub of the made-up designs below (the steps the modules write and those the Report prints) is scanned for two marked numbers with
//      only spacing between them, or a marked number touching a digit or a decimal point; also any token with two decimal points
//   2. with the owner's η / m the Strength I and Service II moment equations name γ_LL / γ_LL,SII (worked in the steps own.ll / own.sll);
//      without them 1.75 / 1.30, as before
//   4. the Fatigue II stud resistance Z_r is worked once in the Report; the other zones show the value with a "see §" to it
//   5. b_eff against the tributary width of the line worked: a note where they differ by more than 0.5 in, none where they agree
//   6. a girder type is named "Type: <label>" in the Report's stiffener / bearing rows and headings (the module's row names unchanged)
//   7. every check value quoted in the Executive summary and the Summary of the selected-girder report, and in the every-girder report's
//      summary tables, links to the work ([[key]] resolved in the built report)
//   8. the construction live load warning names its condition (the option off), not a save date
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const FILES = ['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'report.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/proportions.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'engine/rating.js', 'ui/sub.js', 'ui/flexure.js', 'ui/loads.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/rating.js', 'ui/splices.js', 'ui/constructibility.js', 'engine/welds.js', 'ui/welds.js',
  'engine/sheets.js', 'ui/deflection.js', 'report/data.js', 'report/builders.js', 'report/summary.js'].map(E));
const W = loadShared(...FILES), M = W.SBDModel, RB = W.SBDReportBuild, SR = W.SharedReport;
W.SBDReportData.install();
const J = v => JSON.parse(JSON.stringify(v));

/* the made-up designs (no project data): the built-in bridge, a RIDOT one (η_R = η_I = 1.05, m = 1.2), a thin-plate one, and a 60 ft span
   with 10 girders at 4 ft, a mountable 8 in sidewalk (75 psf) and two girder types (Interior on G2–G9 with b_eff 54 in, Exterior on G1, G10
   with 51 in; tributary 48 in) */
const RIDOT = { owner: 'RIDOT', eta: { D: 'no', R: 'yes', I: 'yes', eD: 1, eR: 1.05, eI: 1.05 } };
function walk10() {
  const P = J(M.defaultProject()); P.project.name = 'Made-up walk bridge'; P.spans = { lengths: [60], continuity: 'simple' }; P.xs = M.defaultXs({ spans: P.spans });
  P.xs.nb = 10; P.xs.bays = new Array(9).fill(4); P.xs.ohL = 2; P.xs.ohR = 2; P.xs.sidewalks.L = { w: 6, t: 8, fence: null, fenceX: null }; P.xs.sidewalks.ped = 75; P.ownerRules = J(RIDOT);
  const seg = { x0: 0, x1: 60, D: 30, tw: 0.5, topB: 12, topT: 0.75, botB: 14, botT: 1.0 };
  P.girders = [{ id: 'G1', label: 'Interior', position: 'interior', beff: 54, segments: [{ ...seg }] }, { id: 'G2', label: 'Exterior', position: 'exterior', beff: 51, segments: [{ ...seg, botT: 1.125 }] }];
  M.setLines(P, 0, [1, 2, 3, 4, 5, 6, 7, 8]); M.setLines(P, 1, [0, 9]); P.girders[0].line = 5; P.framing.splices = []; return P;
}
const thin = () => { const P = J(M.defaultProject()); P.girders.forEach(g => g.segments.forEach(s => { s.tw = Math.max(0.4375, s.tw - 0.125); s.botT = Math.max(0.75, s.botT * 0.6); s.topT = Math.max(0.625, s.topT * 0.6); s.botB = Math.max(12, s.botB - 4); s.topB = Math.max(12, s.topB - 4); })); return P; };
const ridot = () => { const P = J(M.defaultProject()); P.ownerRules = J(RIDOT); return P; };
const WALK = walk10();
const DESIGNS = { builtin: J(M.defaultProject()), ridot: ridot(), thin: thin(), walk10: WALK };

/* every number SharedSteps.n / g formats is marked «…» while the designs are computed (the engines call them when a step is written) */
const St = W.SharedSteps, n0 = St.n, g0 = St.g, ALL = [], s0 = St.step, w0 = St.work;
function marked(f) {
  St.n = (x, d) => '' + n0(x, d) + ''; St.g = (x, d) => '' + g0(x, d) + '';
  St.step = q => { const s = s0(q); ALL.push(s); return s; }; St.work = p => { const w = w0(p), a0 = w.add; w.add = q => { const v = a0(q); ALL.push(w.steps[w.steps.length - 1]); return v; }; return w; };
  try { return f(); } finally { St.n = n0; St.g = g0; St.step = s0; St.work = w0; }
}
const units = P => W.SBDSummary.units(P).filter(u => u.j === M.designLine(P, P.girders[u.gi]) || W.SBDSummary.units(P).filter(q => q.gi === u.gi).length === 1);
const BUNDLES = {};
const RUN = marked(() => { const out = [];
  for (const [name, P] of Object.entries(DESIGNS)) for (const u of units(P)) {
    ALL.length = 0; const B = W.SBDReportData.compute(u.P, u.gi, { src: 'analysis' });
    if (B.cn && B.cn.rows) B.cn.rows.forEach(r => [r, r.alt].filter(Boolean).forEach(q => W.SBDConstrUI.stepsOf(B.cn, q)));
    if (B.flex && B.flex.rows) B.flex.rows.forEach(r => W.SBDFlexureUI.stepsOf(B.flex, r));
    const m = RB.model(B, { detail: 'all' }), rep = [];
    m.sections.forEach(s => s.subs.forEach(q => q.items.forEach(it => { if (it && it.type === 'steps') rep.push(...it.steps); })));
    out.push({ key: `${name}/type ${u.gi + 1}/G${u.j + 1}`, steps: ALL.slice().concat(rep) }); }
  return out; });
const clean = t => String(t).replace(/[]/g, '');
// the bundles of the checks below, computed again without the marks (each a type on its design line)
for (const [name, P] of Object.entries(DESIGNS)) BUNDLES[name] = units(P).map(u => ({ u, B: W.SBDReportData.compute(u.P, u.gi, { src: 'analysis' }) }));

test('1. no worked step substitutes two numbers with no operator or bracket between them (every step of 4 made-up designs)', () => {
  const RX = [[/\s*(?:\\[,;! ]\s*)*/, 'two numbers side by side'], [/[0-9.]/, 'a digit before a number'], [/[0-9.]/, 'a digit after a number']], bad = [];
  let n = 0;
  RUN.forEach(({ key, steps }) => steps.forEach(s => { const t = String(s.sub || ''); if (!t) return; n++;
    RX.forEach(([re, why]) => { if (re.test(t)) bad.push(`${key} ${s.id}: ${why}: ${t.replace(//g, '«').replace(//g, '»')}`); });
    if (/\d\.\d+\.\d/.test(clean(t).replace(/\{,\}/g, ''))) bad.push(`${key} ${s.id}: two decimal points: ${clean(t)}`); }));
  assert.ok(n > 50000, `${n} substitutions scanned`);
  assert.deepEqual([...new Set(bad)].slice(0, 12), []);
  // the two reported cases: the moment reversal (factor × moment) and the negative fatigue moment stress
  const rev = RUN.flatMap(q => q.steps).filter(s => /\.rev$/.test(s.id) && s.sub).map(s => clean(s.sub));
  assert.ok(rev.length > 10 && rev.every(t => /^\d+\.\d\d\(-?\d+\.\d\d\) \+ \d+\.\d\d\(-?\d+\.\d\d\) \+ \d+\.\d\d\(-?\d+\.\d\d\) \+ \d+\.\d\d\(-?\d+\.\d\d\)$/.test(t)), rev.find(t => !/\)$/.test(t)));
  const fN = RUN.flatMap(q => q.steps).filter(s => /^fa\d+\.fN$/.test(s.id)).map(s => clean(s.sub));
  assert.ok(fN.length > 0 && fN.every(t => /^-\\frac\{12\(-?\d+\.\d\d\)\(/.test(t)), fN[0]);
});

test('2. Strength I / Service II moments: γ_LL and γ_LL,SII in the equation with the owner factors (worked in own.ll, own.sll), 1.75 / 1.30 without', () => {
  const one = (name, id) => RUN.find(q => q.key.startsWith(name + '/')).steps.find(s => s.id.endsWith('.' + id) || s.id === id);
  const Mu = one('ridot', 'Mu'), Ms = one('ridot', 'Ms'), ll = one('ridot', 'own.ll'), rv = one('ridot', 'rev');
  assert.match(Mu.eq, /\\gamma_\{LL\}M_\{LL\+IM\}$/); assert.match(Ms.eq, /\\gamma_\{LL,SII\}M_\{LL\+IM\}$/); assert.match(rv.eq, /\\gamma_\{LL\}M_\{LL,opp\}$/);
  assert.equal(ll.sym, '\\gamma_{LL}'); assert.equal(ll.eq, '1.75\\,\\eta\\,m');
  assert.ok(clean(Mu.sub).includes(`${n0(ll.value, 3)}(`), `${clean(Mu.sub)} uses γ_LL = ${ll.value}`);   // the factor substituted is the one own.ll works
  assert.ok(Math.abs(ll.value - 1.75 * 1.05 * 1.05 * 1.2) < 1e-12);
  const Mu0 = one('builtin', 'Mu'), Ms0 = one('builtin', 'Ms');
  assert.match(Mu0.eq, /\+ 1\.75M_\{LL\+IM\}$/); assert.match(Ms0.eq, /\+ 1\.30M_\{LL\+IM\}$/);
  assert.ok(!one('builtin', 'own.ll'), 'AASHTO: no owner factor step');
});

test('4. the Fatigue II stud resistance Z_r is worked once in the Report; the other zones refer to it', () => {
  const { B } = BUNDLES.walk10[0], m = RB.model(B, { detail: 'gov' }), doc = SR.build(m);
  assert.equal(doc.unresolved.length, 0, JSON.stringify(doc.unresolved.slice(0, 3)));
  const st = []; m.sections.forEach(s => s.subs.forEach(q => q.items.forEach(it => { if (it && it.type === 'steps' && it.scope === 'sc') st.push(...it.steps); })));
  const zr = st.filter(s => /^scz\d+\.Zr$/.test(s.id)), worked = zr.filter(s => s.sub);
  assert.ok(zr.length >= 2, `${zr.length} zones`);
  assert.equal(new Set(worked.map(s => s.sub)).size, worked.length, 'each Z_r substitution once');
  zr.filter(s => !s.sub).forEach(s => { const m2 = /see §(scz\d+\.Zr)\./.exec(s.note); assert.ok(m2, s.note); const t = worked.find(q => q.id === m2[1]); assert.ok(t, m2[1]); assert.equal(t.value, s.value); assert.equal(t.label, s.label); });
  assert.match(SR.text(doc), /The same as the first zone with this limit state: see §\d+\.\d+/);
  // the module's own steps (the tab) are not changed
  assert.ok(W.SBDFatigueUI.stepsOf(B.fat, 'sc').filter(s => /^scz\d+\.Zr$/.test(s.id)).every(s => s.sub));
});

test('5. b_eff against the tributary width of the line worked: a note where they differ, none where they agree', () => {
  const tx = B => SR.text(SR.build(RB.model(B, { detail: 'gov' })));
  const t1 = tx(BUNDLES.walk10[0].B);
  assert.match(t1, /b_\(eff\) and the tributary width: b_\(eff\) = 54\.00 in is used for Type: Interior \(the value entered for the type\); the tributary width of line G6 is 48\.00 in \(Art\. 4\.6\.2\.6\.1\)\. The b_\(eff\) used is 12\.5 % larger than the tributary width\./);
  const ext = BUNDLES.walk10.find(q => q.u.gi === 1).B, t2 = tx(ext);
  assert.match(t2, /b_\(eff\) = 51\.00 in is used for Type: Exterior .* tributary width of line G1 is 48\.00 in .* 6\.3 % larger/);
  assert.ok(!/and the tributary width/.test(tx(BUNDLES.builtin[0].B)), 'built-in: b_eff 114 in = the tributary width of G2 (9.5 ft)');
});

test('6. a girder type is "Type: <label>" in the stiffener and bearing rows and the Report headings (its id is not shown as a line name)', () => {
  const { B } = BUNDLES.walk10[0];
  // the module's rows keep their names (a check reads them: engine/stiffeners.js TS8); the Report names the type
  assert.ok(B.shear.TS.rows.length && B.shear.TS.rows.every(r => r.name.startsWith('G1, ')) && B.shear.BS.rows.every(r => /, G1$/.test(r.name)), 'module rows unchanged');
  const m = RB.model(B, { detail: 'gov' });
  assert.equal(m.subtitle, 'Calculation report: Type: Interior on line G6, Made-up walk bridge');
  const tx = SR.text(SR.build(m));
  assert.ok(!/G\d+, (stiffener|connection plate) at|(Abut\. [12]|Pier \d+), G\d+\b|girder Interior|Girder Interior/.test(tx), 'no type id printed as a girder line');
  assert.match(tx, /Type: Interior, stiffener at \d+\.\d\d ft \(Type A\)/); assert.match(tx, /Abut\. 1, Type: Interior/);
});

test('7. every check value of the Executive summary and the Summary links to its work (selected girder, both details; every-girder report)', () => {
  const val = c => c && typeof c === 'object' && c.n && /^(RF )?\d|^—$/.test(String(c.t));
  const check = (m, ids) => { const doc = SR.build(m); assert.equal(doc.unresolved.length, 0, JSON.stringify(doc.unresolved.slice(0, 3))); let n = 0;
    m.sections.filter(s => ids.includes(s.id)).forEach(s => s.subs.forEach(q => q.items.forEach(it => { if (!it || it.type !== 'table') return;
      it.rows.forEach(r => (Array.isArray(r) ? r : r.cells).forEach((c, i) => { if (!val(c) || c.t === '—') return; n++; const row = (Array.isArray(r) ? r : r.cells).map(x => (x && typeof x === 'object' ? x.t : x)).join(' | ');
        if (/section not included/.test(row)) return; assert.ok(c.key && doc.index.has(c.key), `${s.id} ${q.title}: "${c.t}" has no link (${row})`); })); }))); return n; };
  let n = 0;
  for (const [name, L] of Object.entries(BUNDLES)) L.forEach(({ B }) => ['gov', 'all'].forEach(d => { n += check(RB.model(B, { detail: d }), ['exec', 'sum']); }));
  assert.ok(n > 150, `${n} values`);
  // a section left out: its rows say so, no dead link
  const mx = RB.model(BUNDLES.walk10[0].B, { detail: 'gov', include: { flex: false } }); check(mx, ['exec', 'sum']);
  // every-girder report: the summary tables of every girder link to that girder's rows
  const list = BUNDLES.walk10.map(({ u, B }, k) => { const r = RB.govRows(B); return { gi: u.gi, j: u.j, label: `${B.girder.label}`, rows: r.rows, err: r.err, sum: r.sum, bom: r.bom }; });
  const A = RB.allModel(WALK, list); n = check(A, ['exec', 'all']); assert.ok(n > 20, `${n} values (every girder)`);
});

test('8. construction live load warning: names its condition (the option off, nothing entered), not a save date', () => {
  const P = J(M.defaultProject()); delete P.analysis.clCalc;
  const A = W.SBDAnalysis.analyzeGirder(P, 0), w = (A.warnings || []).find(t => /Construction live load not calculated/.test(t));
  assert.equal(w, 'Construction live load not calculated ("Calculate the construction live load" is off on the Loads tab) and not entered: M_CL is 0.');
  assert.ok(!(A.warnings || []).some(t => /saved before/.test(t)));
  const A2 = W.SBDAnalysis.analyzeGirder(J(M.defaultProject()), 0);
  assert.ok(!(A2.warnings || []).some(t => /Construction live load not calculated/.test(t)), 'calculated (a new project): no warning');
});
