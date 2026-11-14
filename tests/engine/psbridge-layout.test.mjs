// apps/ps-bridge 2026-11-14 (PS Bridge catch-up to the Steel Bridge app, item 3: the Bridge layout):
//   1. CLAUDE.md §5: an old saved project (no xs.spMode / xs.Wcc) round-trips unchanged: load (importJSON, as M.load) → export gives the
//      same text; the list inputs as tables (ui/lists.js + shared/list-input.js) write back the text the page's own parser reads into the
//      same arrays (spans.lengths, xs.skews, xs.bays: arrays of numbers, as before); M.applyEqual leaves it as it is; no new input error.
//   2. Equal spacing (the Steel Bridge app's EQSP, copied): S = W_cc / (N_b − 1) written into every bay; the step; the input errors.
//   3. "Girder type of each line" (Cross-section tab) uses the same data as the Girders & strands tab's line boxes (assignLine).
//   4. The framing plan (ui/plan.js PSBPlan.model): girder lines, skewed support lines, diaphragms and continuity diaphragms = the 3D view's
//      geometry (PSB3DUI.geom), the support lines from deck edge to deck edge at x = station + (z − z_mid) tan θ.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', 'list-input.js', ...PBD, ...['sections', 'model', 'rigid', 'lldf-fg', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl'].map(n => path.join(APP, `engine/${n}.js`)), ...['vizkit', 'strands', 'view3d', 'plan'].map(n => path.join(APP, `ui/${n}.js`)));
const J = v => JSON.parse(JSON.stringify(v));
const close = (a, b, msg, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${msg}: ${a} vs ${b}`);
const HTML = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
// the page's own list parser (index.html parseList), read from the page so the test follows it
const parseSrc = HTML.match(/const parseList = (v => .+?);\n/); assert.ok(parseSrc, 'index.html parseList');
const parseList = eval(parseSrc[1]);   // eslint-disable-line no-eval
const store = () => { const o = {}; return { setItem: (k, v) => { o[k] = String(v); }, getItem: k => (k in o ? o[k] : null), removeItem: k => { delete o[k]; }, o }; };

/* an old saved project (as saved before 2026-11-14: no spMode, no Wcc): two spans made continuous, unequal bays, different skews, types */
function oldProject() {
  const P = W.PSBModel.newProject(); Object.assign(P.spans, { lengths: [96.5, 120.25], continuity: 'composite' });
  Object.assign(P.xs, { nb: 5, bays: [8, 9.75, 10, 8.5], skews: [12.5, -7, 20], ohL: 3.25, ohR: 2.5 });
  P.types = W.PSBBridge.newTypes(P); P.design = { g: 2, s: 1 }; return P;
}

test('§5: an old saved project round-trips unchanged (load → export; the list tables write back the same arrays; applyEqual no change)', () => {
  const P0 = oldProject(), S = store(); W.PSBModel.save(S, P0); const text0 = S.o[W.PSBModel.KEYS.current];
  assert.ok(!('spMode' in P0.xs) && !('Wcc' in P0.xs), 'old project: no spMode / Wcc');
  const L = W.PSBModel.load(S); assert.equal(L.source, 'saved'); assert.equal(W.PSBModel.exportJSON(L.project), text0, 'load → export: the same text');
  const r = W.PSBModel.importJSON(text0); assert.ok(r.ok); assert.equal(W.PSBModel.exportJSON(r.project), text0, 'import → export: the same text');
  const LI = W.SharedListInput;
  [['spans', 'lengths'], ['xs', 'skews'], ['xs', 'bays']].forEach(([a, b]) => {
    const arr = r.project[a][b], shown = arr.join(', ');   // the page's input value (list(): (get(path) || []).join(', '))
    const rows = LI.fromText(shown, { rowSplit: /[,;\s]+/ }), back = LI.toText(rows);
    assert.equal(back, shown, `${a}.${b}: the table writes back the same text`);
    assert.deepEqual(J(parseList(back)), J(arr), `${a}.${b}: the page reads the same numbers`);
    // a row edited and back again: the same array
    const ed = rows.map(q => q.slice()); ed[0][0] = '1'; ed[0][0] = String(arr[0]); assert.deepEqual(J(parseList(LI.toText(ed))), J(arr), `${a}.${b}: edit and undo`);
  });
  const Q = J(r.project); W.PSBModel.applyEqual(Q); assert.equal(W.PSBModel.exportJSON(Q), text0, 'applyEqual: individual (absent) changes nothing');
  assert.deepEqual(J(W.PSBModel.validate(r.project).errors), [], 'no new input error');
  // engine inputs of every cell the same before and after the round trip
  W.PSBBridge.cells(P0).forEach(c => assert.deepEqual(J(W.PSBDesign.cellInputs(r.project, c.k, c.g)), J(W.PSBDesign.cellInputs(P0, c.k, c.g)), `cell ${c.label} G${c.g}: same engine inputs`));
});
test('equal spacing: S = W_cc / (N_b − 1) into every bay; the worked step; spMode / W_cc input errors; back to individual keeps the bays', () => {
  const P = oldProject(); P.xs.spMode = 'equal'; P.xs.Wcc = 38; W.PSBModel.applyEqual(P);
  assert.deepEqual(J(P.xs.bays), [9.5, 9.5, 9.5, 9.5]);
  const Q = W.PSBModel.equalSpacing(P.xs); close(Q.S, 9.5, 'S'); assert.equal(Q.step.id, 'xs.eqS'); assert.match(Q.step.sub, /38\.000/); assert.equal(Q.step.value, 9.5);
  P.xs.Wcc = 40; P.xs.nb = 4; W.PSBModel.applyEqual(P); P.xs.bays.forEach(b => close(b, 40 / 3, 'S = 40 / 3'));
  assert.deepEqual(J(W.PSBModel.validate(P).errors.filter(e => /^xs\./.test(e.path))), []);
  P.xs.Wcc = 0; assert.ok(W.PSBModel.validate(P).errors.some(e => e.path === 'xs.Wcc'), 'W_cc 0: an input error');
  P.xs.Wcc = NaN; assert.ok(W.PSBModel.validate(P).errors.some(e => e.path === 'xs.Wcc'), 'W_cc blank: an input error');
  P.xs.spMode = 'x'; assert.ok(W.PSBModel.validate(P).errors.some(e => e.path === 'xs.spMode'), 'unknown mode: an input error');
  P.xs.spMode = 'individual'; P.xs.bays = [8, 9, 10]; P.xs.Wcc = 38; W.PSBModel.applyEqual(P); assert.deepEqual(J(P.xs.bays), [8, 9, 10], 'individual: the bays as entered');
  assert.equal(W.PSBModel.equalSpacing({ nb: 1, Wcc: 10 }).bays.length, 0, 'one girder: no bay');
});
test('girder type of each line: the same data as the line boxes (assignLine); the line moves within its span only', () => {
  const P = oldProject(), T = W.PSBBridge.types(P), ext1 = T.findIndex(t => t.span === 1 && t.lines.includes(1)), int1 = T.findIndex(t => t.span === 1 && t.lines.includes(2));
  const before2 = J(P.types.filter(t => t.span === 2));
  W.PSBBridge.assignLine(P, ext1, 3);   // the select of G3, span 1 set to the exterior type
  assert.ok(P.types[ext1].lines.includes(3) && !P.types[int1].lines.includes(3), 'G3 moved to the exterior type');
  assert.deepEqual(J(W.PSBBridge.lineTypes(P, 1).slice(1).map(a => a.length)), [1, 1, 1, 1, 1], 'every line of span 1 has one type');
  assert.deepEqual(J(P.types.filter(t => t.span === 2)), before2, 'span 2 unchanged');
  assert.match(HTML, /data-lt="\$\{s\}\|\$\{g\}"/, 'the page draws a select per line and span'); assert.match(HTML, /BR\.assignLine\(P, k, g\)/, 'and moves the line with assignLine');
});
test('framing plan: girders, skewed support lines, diaphragms and continuity diaphragms = the 3D geometry', () => {
  const P = oldProject(); P.base.loads.diaph = [{ P: 3, a: 30 }, { P: 3, a: 60 }];
  const m = W.PSBPlan.model(P), G = W.PSB3DUI.geom(P);
  assert.deepEqual(J(m.errors), []); assert.equal(m.girders.length, W.PSBBridge.cells(P).length);
  m.girders.forEach(q => { const g = G.girders.find(r => r.s === q.s && r.g === q.g); close(q.xa, g.xa, 'xa'); close(q.xb, g.xb, 'xb'); close(q.z, g.z, 'z'); });
  assert.deepEqual(J(m.supports.map(q => q.name)), ['Abut. 1', 'Pier 1', 'Abut. 2']); assert.deepEqual(J(m.supports.map(q => q.skew)), [12.5, -7, 20]);
  const yc = (8 + 9.75 + 10 + 8.5) / 2, sup = [0, 96.5, 216.75];
  m.supports.forEach((q, k) => { const t = Math.tan(P.xs.skews[k] * Math.PI / 180);
    close(q.a[0], (sup[k] + (-3.25 - yc) * t) * 12, `${q.name} at the left deck edge`); close(q.b[0], (sup[k] + (36.25 + 2.5 - yc) * t) * 12, `${q.name} at the right deck edge`);
    close(q.a[1], -3.25 * 12, 'left edge z'); close(q.b[1], (36.25 + 2.5) * 12, 'right edge z'); });
  assert.equal(m.dia.length, G.dia.length); assert.equal(m.dia.length, 2 * 4 * 2, '2 diaphragms × 4 bays × 2 spans');
  assert.equal(m.cont.length, 1, 'a continuity diaphragm on the pier (made continuous)');
  const out = W.PSBPlan.svg(P, 700, { vex: 2 }); assert.match(out.svg, /^<svg/); assert.match(out.svg, /width exaggerated ×2/);
  assert.match(out.svg, /Span 1: 96\.50 ft/); assert.match(out.svg, /θ = 20\.0°/);
  P.spans.continuity = 'simple'; assert.equal(W.PSBPlan.model(P).cont.length, 0, 'simple spans: none');
});
