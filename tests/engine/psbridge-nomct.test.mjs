// apps/ps-bridge NOMCT (2026-11-25, engineer's request "I'm seeing references to MCT in the PS bridge app. We should have no MCT input or
//   output."; decisions of 2026-11-25: exact convert, else keep read only; frozen engine text reworded where shown). Checked here:
//   1. exact convert: the four MIDAS fixtures (tests/engine/psbridge-midas-cases.mjs) become custom tables holding the same values: every
//      engine input (but inputs.external), every engine result, every worked step, the superReactions payload and every value the Report
//      records identical before (the stored file) and after (the table); only the file's description echoed in R.ext (liveLoadType, member
//      key / span, DF / IM flags) differs (display only, the Loads tab's "LL type"; Decision pending engineer review); P.demands[id].midas kept;
//      the notice once; the project JSON read both ways (the converted entry only adds fields; a second open changes nothing);
//   2. kept read only: the files the table cannot hold exactly (span length, a span other than the type's, a member of other spans, the whole
//      member, stations with more than 6 decimals, a custom table already stored) stay src 'midas' with the engine input of before (the file
//      with its span, as the old psbridge-midas test asserted), a notice and an input warning to re-enter; not offered once switched away;
//   3. "From the old app" (engine/legacy.js) follows the same rule;
//   4. the moved engine's MIDAS wording reworded where it leaves the engine (R.warns, R.cont.llSrc, superReactions note / source / error):
//      text only, every number and key the same;
//   5. removed: the MIDAS file reader and span picker, the MCT demands / geometry-change receivers, the capacity send, "↩ MCT Analysis";
//   6. no user-visible MCT / MIDAS text: the Report (every tab section), the input checks, the Demands card and source line, the Hand-offs
//      card, the superReactions / all-girders / bearing payload notes and the load notices of MIDAS-derived, kept, table and this-app designs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { MIDAS_CASES, midasFixtures } from './psbridge-midas-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', 'report.js', 'handoff-stale.js', ...PBDF,
  ...['sections', 'model', 'rigid', 'lldf-fg', 'holddown', 'pierblock', 'demands', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'legacy', 'worked', 'worked-stress', 'worked-strength', 'worked-end', 'worked-hdr', 'handoffs', 'hostale', 'bearing'].map(n => path.join(APP, `engine/${n}.js`)),
  ...['inputs', 'vizkit', 'vizalong', 'outkit', 'types', 'demands', 'handoffs', 'section', 'loads', 'analysis', 'strands', 'losses', 'stresses', 'flexure', 'shear', 'endzone', 'camber', 'handling', 'deck', 'rating', 'dash', 'summary', 'bridgedl'].map(n => path.join(APP, `ui/${n}.js`)),
  ...['fromtab', 'data', 'builders'].map(n => path.join(APP, `report/${n}.js`)));
const M = W.PSBModel, D = W.PSBDesign, DM = W.PSBDemands, B = W.PSBBridge, H = W.PSBHandoffs, S = W.PSBHoStale, RB = W.PSBReportBuild, SR = W.SharedReport;
const J = v => JSON.parse(JSON.stringify(v === undefined ? null : v));
const F = midasFixtures(rel => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/projects', rel), 'utf8')));
const prep = P => { const Q = J(P); B.migrate(Q); return Q; };   // the girder types, as importJSON makes them (PSBBridge.migrate), the demands as saved
const CASES = Object.fromEntries(Object.entries(MIDAS_CASES(() => M.defaultProject(), F)).map(([n, P]) => [n, prep(P)]));
const MIDAS = Object.entries(CASES).filter(([, P]) => P.demands.T1.src === 'midas');
const STEPS = (inp, R) => [W.PSBWorked.section(inp, R), W.PSBWorked.loads(inp, R), W.PSBWorked.analysis(inp, R), W.PSBWorkedStress.losses(inp, R), W.PSBWorkedStress.stresses(inp, R),
  W.PSBWorkedStrength.flexure(inp, R), W.PSBWorkedStrength.shear(inp, R), W.PSBWorkedEnd.endzone(inp, R), W.PSBWorkedEnd.camber(inp, R), W.PSBWorkedHDR.rating(inp, R)];
const DESC = ['liveLoadType', 'member', 'dfApplied', 'imApplied', 'DF', 'IM'];   // the file's description in R.ext (not used by any calculation)
/* full(P): every computed result of P: per girder type × line the engine inputs (inputs.external aside: the file or the table's file form),
   R (R.ext's file description aside), the worked steps (id, label, value, note), the superReactions payload; the Report's recorded values */
function full(P) {
  const Bd = W.PSBReportData.compute(P, null); assert.equal(Bd.err, '', 'no input error');
  const cells = Bd.all.cells.map(c => {
    const R = J(Object.assign({}, c.R, { ext: c.R.ext ? Object.fromEntries(Object.entries(c.R.ext).filter(([k]) => !DESC.includes(k))) : null }));
    return { k: c.k, s: c.s, g: c.g, inp: J(Object.assign({}, c.inp, { external: undefined })), R,
      steps: STEPS(J(c.inp), c.R).map(w => w.steps.map(t => [t.id, t.label, t.value, t.note || ''])), sr: J(H.srPayload(c.inp, c.R)) };
  });
  const Mo = RB.model(Bd, {});
  return { cells, vals: J(Mo.vals || null), srAll: J(H.srAll(P, Bd.all.cells)) };
}
/* the visible text of an HTML string: text nodes and the title / aria-label / alt / placeholder attributes (option values are not shown) */
const visible = h => String(h || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<[^>]*>/g, t => ' ' + [...t.matchAll(/\b(title|aria-label|alt|placeholder)="([^"]*)"/gi)].map(m => m[2]).join(' ') + ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const BAD = /mct|midas/i;
const noMct = (t, what) => { const m = BAD.exec(t); assert.ok(!m, `${what}: "${m && t.slice(Math.max(0, m.index - 80), m.index + 60)}"`); };

/* the made-up kept cases (each one condition the table cannot hold exactly) */
const mk = (spans, cont, g, s, file, extra) => { const P = M.defaultProject(); P.spans = { lengths: spans, continuity: cont ? 'composite' : 'simple' }; P.xs.skews = Array(spans.length + 1).fill(0); P.design = { g, s };
  Object.assign(P.base.loads, { extDFpos: 0.6, extDFneg: 0.6, extDFv: 0.7, extLLmpf: 1 }); P.demands = { T1: Object.assign({ src: 'midas', midas: { file: J(file), name: 'f.json', at: '2026-11-15T12:00:00.000Z' } }, extra || {}) }; return prep(P); };
const x7 = J(F.simple); x7.stations.forEach((st, i) => { if (i && i < x7.stations.length - 1) st.x = +(st.x + 0.1234567).toFixed(7); });
const KEPT = {
  'bridge span 118 ft, the file\'s 120 ft': [mk([118], false, 1, 1, F.simple), /outside span 1/],
  'bridge span 122 ft, the file\'s 120 ft': [mk([122], false, 1, 1, F.simple), /differ from the bridge/],
  'span 2 of the file for span 1 of the bridge': [mk([140, 140], true, 1, 1, F.mct, { span: 2 }), /span 2 of the imported member is used for span 1/],
  '3-span file on a one-span bridge, its span 2': [mk([140], false, 1, 1, F.mct, { span: 2 }), /span 2 of the imported member/],
  'no span chosen (an old-app design: the whole member)': [mk([120], false, 1, 1, F.simple, { span: 0 }), /no span of the imported member chosen/],
  'stations with 7 decimals': [mk([120], false, 1, 1, x7), /differ from the bridge/],
  'a custom table with other values already stored': [(() => { const P = mk([120], false, 1, 1, F.simple); P.demands.T1.table = { rows: [{ x: 0, M_DC2: 1 }, { x: 120, M_DC2: 2 }] }; return P; })(), /already stored/]
};

test('exact convert: the 4 MIDAS fixtures become custom tables with the same values; every engine result, worked step, superReactions value and Report value identical; midas kept; the notice once', () => {
  assert.equal(MIDAS.length, 4);
  for (const [name, P] of MIDAS) {
    const T = B.types(P)[0], before = full(P), x0 = DM.external(P, T);
    const Q = J(P), notes = DM.migrate(Q, '2026-11-25T12:00:00.000Z'), e = Q.demands.T1;
    assert.deepEqual(J(notes), [DM.NOTE_CONVERTED(T.label)], name);
    assert.ok(/^Demands of .+ were imported from a file; they are now a custom table with the same values/.test(notes[0]), name);
    assert.equal(e.src, 'table', name); assert.deepEqual(J(e.midas), J(P.demands.T1.midas), name + ': the imported values kept');
    assert.deepEqual(J(e.converted), { from: 'imported file', at: '2026-11-25T12:00:00.000Z' }, name);
    assert.equal(P.demands.T1.span, e.span, name + ': span kept as it was');
    assert.deepEqual(J(W.PSBInputCheck.collect(Q).errors), [], name);
    const after = full(Q);
    assert.deepEqual(after, before, name + ': every result identical');
    // R.ext: the span read, its length and stations identical; the file's description is not held by the table (display only)
    const R0 = W.PSBHoldDown.compute(J(D.inputs(P))), R1 = W.PSBHoldDown.compute(J(D.inputs(Q)));
    assert.deepEqual(J(R1.ext.sel), J(R0.ext.sel), name); assert.equal(R1.ext.spanLen, R0.ext.spanLen, name); assert.equal(R1.ext.nStations, R0.ext.nStations, name);
    assert.equal(R0.ext.liveLoadType, x0.liveLoadType, name); assert.equal(R1.ext.liveLoadType, 'entered', name + ': LL type shown as "entered" after the conversion');
    // the rows: x from the left bearing of the span, the moments as read, the shears in this app's sign (negated, LL branches exchanged)
    const sel = x0._selSpan, st = x0.stations.filter(s => s.x >= sel.x0 - 1e-6 && s.x <= sel.x1 + 1e-6).sort((a, b) => a.x - b.x), r = e.table.rows;
    assert.equal(r.length, st.length, name);
    st.forEach((s, i) => { assert.equal(r[i].x, s.x - sel.x0); assert.equal(r[i].M_LLpos, +s.M_LLpos || 0); assert.equal(r[i].V_DC2, -(+s.V_DC2 || 0) || 0); assert.equal(r[i].V_LLpos, -(+s.V_LLneg || 0) || 0); assert.equal(r[i].V_LLneg, -(+s.V_LLpos || 0) || 0); });
    // once: a second open changes nothing and says nothing
    const Q2 = J(Q); assert.deepEqual(J(DM.migrate(Q2)), [], name); assert.deepEqual(Q2, J(Q), name);
    // the JSON file: this version reads the old file (converted, notice) and its own (nothing changed); the new entry only adds / sets fields
    const r1 = M.importJSON(M.exportJSON(P)); assert.equal(r1.ok, true); assert.deepEqual(J(r1.dmNotes), J(notes), name); assert.equal(r1.project.demands.T1.src, 'table');
    const t1 = M.exportJSON(r1.project), r2 = M.importJSON(t1); assert.deepEqual(J(r2.dmNotes), [], name); assert.equal(M.exportJSON(r2.project), t1, name + ': stable');
    const o0 = JSON.parse(M.exportJSON(P)).demands.T1, o1 = JSON.parse(t1).demands.T1;
    Object.keys(o0).forEach(k => { if (k !== 'src' && k !== 'table') assert.deepEqual(o1[k], o0[k], name + ': key kept ' + k); });
    assert.deepEqual(Object.keys(o1).filter(k => !(k in o0)).sort(), ['converted', 'table'].filter(k => !(k in o0)).sort(), name + ': only converted / table added');
  }
});

test('kept read only: a file the table cannot hold exactly stays as it was (the engine input of before), with the notice and an input warning; chosen only while used', () => {
  for (const [name, [P, why]] of Object.entries(KEPT)) {
    const T = B.types(P)[0], P0 = J(P), c = DM.convert(P, T);
    assert.equal(c.ok, false, name); assert.match(c.why, why, name);
    const notes = DM.migrate(P); assert.deepEqual(J(P), P0, name + ': nothing changed'); assert.deepEqual(J(notes), [DM.NOTE_KEPT(T.label)], name);
    assert.ok(!BAD.test(notes[0]) && /Re-enter them as a custom table or choose this app's analysis/.test(notes[0]), name);
    // the engine input of before: the stored file with the span read (main's own rule, unchanged)
    const inp = D.inputs(P), e = P.demands.T1, f = e.midas.file;
    if (e.span === 0) assert.deepEqual(J(inp.external), J(f), name);
    else { const i = DM.pickOf(P, T), q = W.PBD.extSpans(f)[i - 1]; assert.deepEqual(J(inp.external), J(Object.assign({}, f, { _selSpan: f._selSpan && +f._selSpan.idx === i ? f._selSpan : q })), name); }
    const w = DM.checks(P).warnings.map(x => x.msg);
    if (e.span !== 0) assert.ok(w.some(m => /imported demands kept from an earlier version \(read only/.test(m)), name);
    w.concat(DM.checks(P).errors.map(x => x.msg)).forEach(m => noMct(m, name + ' check'));
    assert.deepEqual(J(DM.choices(P, T.id)), ['app', 'table', 'midas'], name);
    noMct(DM.describe(P, T).what + ' ' + DM.describe(P, T).detail, name + ' describe');
  }
  // never chosen: setSrc refuses it; once switched away it is not offered; the stored values stay in the project
  const [P] = KEPT['bridge span 122 ft, the file\'s 120 ft'], T = B.types(P)[0], mid = J(P.demands.T1.midas);
  DM.setSrc(P, T.id, 'app'); assert.equal(DM.srcOf(P, T.id), 'app'); assert.deepEqual(J(DM.choices(P, T.id)), ['app', 'table']);
  DM.setSrc(P, T.id, 'midas'); assert.equal(DM.srcOf(P, T.id), 'app', 'midas is never set'); assert.deepEqual(J(P.demands.T1.midas), mid, 'kept');
  assert.equal(DM.choices(M.newProject(), 'T1').includes('midas'), false, 'a new type: this app or the custom table only');
  ['parse', 'setFile', 'setSpan'].forEach(k => assert.equal(DM[k], undefined, k + ' removed'));
});

test('"From the old app": an old design with MIDAS demands follows the same rule (converted when exact, else kept)', () => {
  const old = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/projects/ps/midas_3span.json'), 'utf8'));
  const r = W.PSBLegacy.convert({ inputs: J(old) }); assert.equal(r.ok, true, r.error);
  const P = r.project; B.migrate(P); assert.equal(P.demands.T1.src, 'midas');   // the page's "From the old app": PSBBridge.migrate, restore, then PSBDemands.migrate
  const P0 = J(P), Rb = full(P), notes = DM.migrate(P), T = B.types(P)[0];
  const conv = P.demands.T1.src === 'table';
  assert.deepEqual(J(notes), [conv ? DM.NOTE_CONVERTED(T.label) : DM.NOTE_KEPT(T.label)]);
  assert.deepEqual(J(P.demands.T1.midas), P0.demands.T1.midas, 'kept');
  if (conv) assert.deepEqual(full(P), Rb, 'identical after the conversion'); else assert.deepEqual(J(P), P0);
  noMct(JSON.stringify(r.summary.items.map(i => i.text)), 'old-app import summary');
  noMct(W.PSBLegacy.fromText(JSON.stringify({ _schema: 'psbeam-external-demands', stations: [] })).error, 'a demands file refused');
});

test('the moved engine\'s MIDAS wording reworded where it leaves the engine (R.warns, the pier LL label, superReactions): text only, every number the same', () => {
  const [, P] = MIDAS[1], inp = J(D.inputs(P));
  const n0 = DM.neutral; DM.neutral = R => R; let R0; try { R0 = W.PSBHoldDown.compute(J(inp)); } finally { DM.neutral = n0; }
  const R1 = W.PSBHoldDown.compute(J(inp));
  assert.ok(R0.warns.some(w => /^MIDAS span 1: /.test(w)) && R0.cont.llSrc === 'MIDAS pier moment', 'the engine\'s own text (frozen engine/pbd-compute.js)');
  assert.deepEqual(J(R1.warns), J(R0.warns.map(DM.neutralText))); assert.equal(R1.cont.llSrc, 'entered pier moment');
  R1.warns.forEach(w => noMct(w, 'R.warns'));
  const strip = R => J(Object.assign({}, R, { warns: undefined, cont: Object.assign({}, R.cont, { llSrc: undefined }) }));
  assert.deepEqual(strip(R1), strip(R0), 'nothing else differs');
  const b0 = W.bxSuperRxPayload(inp, R1), b1 = H.srPayload(inp, R1);
  assert.equal(b0.payload.girderLine.source, 'PS-Beam DC1 + MIDAS DC2/DW'); assert.equal(b1.payload.girderLine.source, 'PS-Beam DC1 + entered DC2/DW');
  assert.deepEqual(J(b1.payload.notes.slice(0, b0.payload.notes.length)), J(b0.payload.notes.map(DM.neutralText)));
  const k = p => J(Object.assign({}, p, { notes: undefined, girderLine: Object.assign({}, p.girderLine, { source: undefined }) }));
  assert.deepEqual(k(b1.payload), k(b0.payload), 'every key and value of the payload the same');
  assert.equal(DM.neutralText('the imported MIDAS demands could not be read'), 'the imported or entered demands could not be read');
  // Bridge Substructure Loading does not match on the reworded strings (it shows the notes; it reads girderLine.label / position / beamIndex)
  const SL = fs.readFileSync(path.join(ROOT, 'Bridge Substructure Loading.html'), 'utf8');
  assert.ok(!/MIDAS import active|\+ MIDAS DC2|girderLine\.source/.test(SL));
  // a design of this app's analysis: R unchanged by neutral
  const Ra = W.PSBHoldDown.compute(J(D.inputs(M.defaultProject()))); assert.equal(DM.neutral(Ra), Ra);
});

test('removed: the MCT demands / geometry-change receivers, the capacity send, "↩ MCT Analysis"; the MCT keys are not named any more', () => {
  ['capacity', 'CAP_BASIS', 'mctPending', 'mctDescribe', 'mctPlan', 'geomPending', 'MCT_K', 'MCT_VERSION'].forEach(k => assert.equal(H[k], undefined, k));
  ['mctState', 'geoState', 'capSig'].forEach(k => assert.equal(S[k], undefined, k));
  ['capacity', 'mct', 'geometryChanges'].forEach(k => { assert.equal(S.CH[k], undefined, k); assert.ok(!S.OUT_IDS.includes(k) && !S.IN_IDS.includes(k), k); });
  assert.equal(S.CH.psSection.to, 'LL & DL');
  const U = W.PSBHandoffUI; ['mctBanner', 'onMct', 'mctLoad'].forEach(k => assert.equal(U[k], undefined, k)); assert.equal(typeof U.onBar, 'function');
  assert.equal(fs.existsSync(path.join(APP, 'ui/mctnav.js')), false, 'ui/mctnav.js deleted');
  const html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
  assert.ok(!/mctnav\.js|id="bMct"|mctBack|PSBMctNav|mctBanner|data-dmdesign/.test(html));
  // no code of the app (comments aside) names the MCT keys: bridgeSuite.v1.handoffs, latestId, updatedAt, adopted.*, geometryChanges, capacity
  const files = [...fs.readdirSync(path.join(APP, 'engine')).filter(f => !/^pbd-/.test(f)).map(f => 'engine/' + f), ...fs.readdirSync(path.join(APP, 'ui')).map(f => 'ui/' + f), ...fs.readdirSync(path.join(APP, 'report')).map(f => 'report/' + f), 'index.html'];
  files.forEach(f => { const c = fs.readFileSync(path.join(APP, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
    assert.ok(!/bridgeSuite\.v1\.(handoffs|latestId|updatedAt|adopted|geometryChanges|capacity)\b|bridgeSuite\\\.v1\\\.\([^)]*(latestId|geometryChanges|capacity)/.test(c), f); });
  // a P.handoffs.sent.capacity record saved before is kept in the project and not shown
  const P = M.newProject(); P.handoffs = { sent: { capacity: { sig: 'x', at: '2026-11-21T10:00:00.000Z' } } };
  const r = M.importJSON(M.exportJSON(P)); assert.deepEqual(J(r.project.handoffs), J(P.handoffs));
});

test('no user-visible MCT / MIDAS text: the Report, the input checks, the Demands card and source line, the Hand-offs card, the payload notes, the load notices', () => {
  const PJ = [...MIDAS.map(([n, P]) => ['converted: ' + n, P]), ...Object.entries(KEPT).map(([n, [P]]) => ['kept: ' + n, P]),
    ...Object.entries(MIDAS_CASES(() => M.defaultProject(), F)).filter(([, P]) => P.demands.T1.src === 'table').map(([n, P]) => ['table: ' + n, P]),
    ['this app: the new project', M.newProject()]];
  let nRep = 0;
  for (const [name, P0] of PJ) {
    const r = M.importJSON(M.exportJSON(P0)), P = r.project;
    (r.notes || []).forEach(t => noMct(t, name + ' load notice'));
    const C = W.PSBInputCheck.collect(P); C.errors.concat(C.warnings || []).forEach(e => noMct(e.msg, name + ' input check'));
    const Bd = W.PSBReportData.compute(P, null);
    if (!Bd.err) { const t = SR.text(SR.build(RB.model(Bd, {}))); noMct(t, name + ' report'); nRep++;
      Bd.all.cells.forEach(c => { const b = H.srPayload(c.inp, c.R); noMct(JSON.stringify(b.payload ? [b.payload.notes, b.payload.girderLine] : b.error), name + ' superReactions'); });
      const a = H.srAll(P, Bd.all.cells); if (a.payload) noMct(JSON.stringify(a.payload.notes), name + ' all girders');
      if (W.PSBBearing && W.PSBBearing.blPayload) { const q = W.PSBBearing.blPayload(P, Bd.all.cells); if (q && q.payload) noMct(JSON.stringify(q.payload.notes || ''), name + ' bearing loads'); } }
    const ui = { itab: 'loads', scope: B.hasTypes(P) ? P.types[0].id : '' };
    noMct(visible(W.PSBDemandsUI.card(P, ui)), name + ' Demands card'); noMct(visible(W.PSBDemandsUI.card(P, { itab: 'loads', scope: '' })), name + ' Demands card (base)');
    noMct(visible(W.PSBDemandsUI.srcBar(P)), name + ' source line');
    noMct(visible(W.PSBHandoffUI.card(P, null)), name + ' Hand-offs card');
  }
  assert.ok(nRep >= 10, 'reports built: ' + nRep);
  const hc = W.PSBHandoffUI.card(M.newProject(), null);
  assert.ok(/Send section properties to LL &amp; DL/.test(hc) && !/data-ho="capSend"/.test(hc), 'psSection kept and named for LL & DL only; no capacity send');
});
