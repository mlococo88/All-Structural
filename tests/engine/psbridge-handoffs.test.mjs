// apps/ps-bridge (2026-11-14, planned item 12): the old app's bridgeSuite.v1.* hand-offs in the new app (engine/handoffs.js, ui/handoffs.js).
//   Sent payloads, byte for byte: for every harness B design (tests/engine/psbridge-tab-cases.mjs) and new typed projects (one span; two spans
//   made continuous), the new app's payload of the girder shown = the OLD page's own code on the same engine inputs: superReactions (the old
//   page's bxSuperRxPayload), psSection and lldfGeom (the old page's code text, cut from "Prestressed Bridge Design.html" at its
//   anchors and run in the old page's compiled context, tests/engine/psbridge-source.mjs oldEngine; producedAt fixed on both sides): the same
//   JSON text. Received payloads: lldf and dlLoads payloads as LL & DL Distribution publishes them (and the old app's refusals) are read by
//   the new app exactly as the old page reads them (lldfResolveFor / dlResolveFor, lldfTheirsFor / dlTheirsFor), and a pull gives the new
//   app's engine inputs = the old page's inputs after its own apply (applyLLDFTo / applyDLTo), so every result is the same. projectMeta:
//   the mapping and the old app's "never blank, only what differs" rule. BridgeXfer copy = HANDOFF.md §5.
//   NOMCT (2026-11-25): the capacity send (to the MCT rating) is removed, so its comparison is too; the dlLoads refusal's text names LL & DL's
//   dead-load send without the MCT (the old text otherwise, compared below with that one phrase replaced).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadShared, test, ROOT } from './harness.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';
import { oldEngine, pinText } from './psbridge-source.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', ...PBDF, ...['sections', 'model', 'rigid', 'lldf-fg', 'reltension', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'handoffs'].map(n => path.join(APP, `engine/${n}.js`)));
const M = W.PSBModel, D = W.PSBDesign, BR = W.PSBBridge, H = W.PSBHandoffs;
const O = oldEngine();
const J = v => JSON.parse(JSON.stringify(v));
const NOW = '2026-11-14T15:00:00.000Z';
O.__NOW = NOW;

// the old page's code between two anchors (start included, end excluded), producedAt fixed
function cut(a, b) {
  const t = pinText(), i = t.indexOf(a), j = t.indexOf(b, i);
  assert.ok(i > 0 && j > i && t.indexOf(a, i + 1) < 0, 'anchor ' + a);
  const code = t.slice(i, j);
  return code.split('new Date().toISOString()').join('__NOW');
}
// the old page's code compiled in a context: the old page's own (O) and, for a section only this app's library has (PS-30 / PS-32: the
// old library cannot compute it), the new app's engine context (W: the same moved engine, this app's library)
function oldCode(C) {
  C.__NOW = NOW;
  return {
    sec: vm.runInContext(`(function(inp,R){ const psSecRef={current:''}; let payload=null; (()=>{ if(R.error||!R.cp||!R.g) return; ${cut('const cp=R.cp, g=R.g;', "localStorage.setItem('bridgeSuite.v1.psSection'")} })(); return payload; })`
      .replace('const payload=Object.assign(', 'payload=Object.assign('), C),
    geo: vm.runInContext(`(function(inp,R){ const alert=()=>{}; const g=R.error?null:R.g; const ext=inp.external; ${cut('const sendLLDF=(silent)=>{', '/* ---- Geometry channel lock')}
      localStorage.removeItem('bridgeSuite.v1.lldfGeom'); const ok=sendLLDF(true); return ok ? localStorage.getItem('bridgeSuite.v1.lldfGeom') : null; })`, C),
    sr: (inp, R) => C.bxSuperRxPayload(inp, R) };
}
const OC = oldCode(O);
if (!W.localStorage) { const m = new Map(); W.localStorage = { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }
W.BridgeBeam = { get: () => null }; W.BridgeXfer = { sharedProject: () => null };
const NC = oldCode(W);

function cases() {
  const out = Object.entries(TAB_CASES(() => M.defaultProject()));
  const P1 = M.newProject(); out.push(['new project (typed: Interior / Exterior, DC2 / DW distributed)', P1]);
  const P2 = M.newProject(); P2.spans = { lengths: [100, 120], continuity: 'composite' }; P2.xs.skews = [0, 0, 0]; BR.syncSpans(P2); out.push(['new project, two spans made continuous', P2]);
  const P3 = M.newProject(); P3.design = { g: 1, s: 1 }; out.push(['new project, exterior G1 shown', P3]);
  return out;
}
const CASES = cases();

test('sent payloads = the old page\'s code on the same inputs (superReactions, psSection, lldfGeom), every design', () => {
  let n = 0, nOld = 0, nSame = 0; const newLib = [], differ = [];
  for (const [name, P] of CASES) {
    const inp = D.inputs(P), Rn = W.PSBHoldDown.compute(J(inp)), Ro = O.computeAll(J(inp));
    if (Rn.error) { assert.ok(Ro.error, name + ': both error'); continue; }   // (an input error: nothing is sent, below)
    const cmp = (C, R, tag) => {   // the new app's builders and the old page's code on the same engine inputs and result R
      const a = H.srPayload(J(inp), R), b = C.sr(J(inp), R);
      assert.equal(JSON.stringify(a), JSON.stringify(b), `${name}: superReactions (${tag})`); assert.ok(a.payload && a.payload._schema === 'bridge-super-reactions', name);
      const s1 = H.psSection(J(inp), R, NOW), s0 = C.sec(J(inp), R);
      assert.ok(s0, name + ': old psSection'); assert.equal(JSON.stringify(s1), JSON.stringify(s0), `${name}: psSection (${tag})`);
      const g1 = H.lldfGeom(J(inp), R, NOW), g0 = C.geo(J(inp), R);
      assert.ok(g0 && g1.payload, name + ': lldfGeom'); assert.equal(JSON.stringify(g1.payload), g0, `${name}: lldfGeom (${tag})`);
    };
    cmp(NC, Rn, 'the old code, this app\'s engine context');
    if (!Ro.error) { cmp(OC, Ro, 'the old page'); nOld++;
      // what the page sends (this app's result) against what the old app sent: the same text unless this app's results differ (§4 PRs)
      const all = R => JSON.stringify([H.srPayload(J(inp), R), H.psSection(J(inp), R, NOW), H.lldfGeom(J(inp), R, NOW).payload]);
      if (all(Rn) === all(Ro)) nSame++; else differ.push(name);
    } else newLib.push(name);
    n++;
  }
  assert.ok(n >= 20 && nOld >= 15, `designs compared: ${n}, with the old page: ${nOld}; this app's library only: ${newLib.join('; ')}`);
  console.log(`       designs: ${n}; code = the old page's on the same result: ${n} in this app's context, ${nOld} in the old page's; a section of this app's library only (PS-30 / PS-32): ${newLib.length}`);
  console.log(`       sent text = the old app's: ${nSame} of ${nOld}; different because this app's own results differ (§4 PRs): ${differ.join('; ')}`);
});

test('a design with an input error sends nothing (as the old app)', () => {
  const P = M.newProject(); P.base.mat.fc = -1; const inp = D.inputs(P), R = O.computeAll(J(inp));
  if (!R.error) return;   // the engine computes it: nothing to check here
  assert.equal(H.psSection(inp, R, NOW), null); assert.ok(H.srPayload(inp, R).error);
});

// lldf payloads as LL & DL Distribution publishes them (lldf.html publishLLDF): governing / governingNeg with byBeam, and the old app's refusals
const LLDF = {
  full: { _schema: 'bridge-lldf-factors', schemaVersion: 1, producer: 'LL & DL Distribution', producedAt: '2026-11-14T13:00:00.000Z', project: 'Route 9', Nb: 5, bridgeType: 'k', spans: [100],
    governing: { interior: { gM: 0.612345, gV: 0.701234, fatM: 0.41234 }, exterior: { gM: 0.7123, gV: 0.6633, fatM: 0.5 }, byBeam: { 1: { gM: 0.71, gV: 0.66, fatM: 0.5 }, 2: { gM: 0.6333333, gV: 0.7111111, fatM: 0.42 } } },
    governingNeg: { interior: { gM: 0.655555 }, exterior: { gM: 0.744 }, byBeam: { 2: { gM: 0.666666 } } } },
  noNeg: { _schema: 'bridge-lldf-factors', schemaVersion: 1, producedAt: '2026-11-14T13:05:00.000Z', project: '', governing: { interior: { gM: 0.6, gV: 0.7 }, exterior: { gM: 0.8, gV: 0.75 } }, governingNeg: null },
  slab: { _schema: 'bridge-lldf-factors', schemaVersion: 1, perFootStrip: true, governing: { interior: { gM: 0.2, gV: 0.2 } } },
  v2: { _schema: 'bridge-lldf-factors', schemaVersion: 2, governing: { interior: { gM: 0.6, gV: 0.7 } } },
  noExt: { _schema: 'bridge-lldf-factors', schemaVersion: 1, governing: { interior: { gM: 0.6, gV: 0.7 } } },
};
const DBS = [null, { index: 2, label: 'G2', clsLabel: 'interior' }, { index: 1, label: 'G1', clsLabel: 'exterior' }, { index: 4, label: 'G4', clsLabel: 'interior' }];

test('lldf: every payload is read as the old app reads it; a pull gives the old app\'s inputs after its own apply (every result the same)', () => {
  let applied = 0;
  for (const [name, P0] of CASES.slice(0, 8).concat(CASES.slice(-3))) {
    for (const [pn, pay] of Object.entries(LLDF).concat([['unreadable', '{bad'], ['none', null]])) {
      for (const db of DBS) {
        const raw = pay == null ? null : typeof pay === 'string' ? pay : JSON.stringify(pay);
        const inp = D.inputs(P0);
        O.__store.clear(); if (raw != null) O.__store.set('bridgeSuite.v1.lldf', raw); O.__db = db;
        const r0 = O.lldfResolveFor(J(inp)), r1 = H.lldfResolve(J(inp), raw, db);
        assert.equal(JSON.stringify(r1), JSON.stringify(r0), `${name} / ${pn} / ${db ? db.label : 'no beam'}: resolve`);
        if (r0.why) continue;
        assert.equal(JSON.stringify(H.lldfTheirs(J(inp), r1)), JSON.stringify(O.lldfTheirsFor(J(inp), r0)), name + ': theirs');
        // the old page's apply on its inputs; the new app's pull on its project
        let oldInp = J(inp); O.applyLLDFTo(f => { oldInp = f(oldInp); }, J(inp), r0);
        const P = J(P0), c = BR.hasTypes(P) ? BR.shown(P) : null; H.applyLoads(P, c, H.lldfFields(J(inp), r1));
        assert.deepEqual(J(D.inputs(P)), J(oldInp), `${name} / ${pn}: engine inputs after the pull = the old app's`);
        applied++;
      }
    }
  }
  assert.ok(applied > 40, 'pulls compared: ' + applied);
  // the results of one pull: the same as the old app's on its applied inputs
  const P = J(CASES[0][1]), inp = D.inputs(P), r = H.lldfResolve(inp, JSON.stringify(LLDF.full), DBS[1]); H.applyLoads(P, BR.hasTypes(P) ? BR.shown(P) : null, H.lldfFields(inp, r));
  let oldInp = J(inp); O.__db = DBS[1]; O.__store.set('bridgeSuite.v1.lldf', JSON.stringify(LLDF.full)); O.applyLLDFTo(f => { oldInp = f(oldInp); }, J(inp), O.lldfResolveFor(J(inp)));
  const Rn = O.computeAll(J(D.inputs(P))), Ro = O.computeAll(oldInp);
  assert.equal(JSON.stringify(Rn.checks), JSON.stringify(Ro.checks)); assert.equal(D.inputs(P).loads.dfm, 0.6333); assert.equal(D.inputs(P).loads.dfAuto, false);
});

test('lldf pull on a typed project writes the type shown only (its overrides); the other types keep their factors', () => {
  const P = M.newProject(), c = BR.shown(P), other = BR.types(P).findIndex((t, k) => k !== c.k && t.span === BR.types(P)[c.k].span);
  const before = J(D.cellInputs(P, other, BR.typeLines(P, other)[0]));
  const inp = D.inputs(P), r = H.lldfResolve(inp, JSON.stringify(LLDF.full), null); H.applyLoads(P, c, H.lldfFields(inp, r));
  const T = BR.types(P)[c.k]; assert.equal(T.ovr['loads.dfm'], inp.loads.pos === 'exterior' ? 0.7123 : 0.6123); assert.equal(T.ovr['loads.dfAuto'], false);
  assert.deepEqual(J(D.cellInputs(P, other, BR.typeLines(P, other)[0])), before, 'the other type unchanged');
  assert.equal(P.base.loads.dfm, M.newProject().base.loads.dfm, 'the base design unchanged');
});

const DLP = {
  full: { _schema: 'bridge-dl-loads', schemaVersion: 1, producedAt: '2026-11-14T13:10:00.000Z', project: 'Route 9', Nb: 5, method: 'MassDOT', beam: { label: 'B2', clsLabel: 'first interior', trib: 8.5 },
    cases: [{ key: 'DC1', udl: 0.912345 }, { key: 'DC2', udl: 0.123456 }, { key: 'DW', udl: 0.2345678 }, { key: 'PL', udl: 0.1 }] },
  dc2only: { _schema: 'bridge-dl-loads', schemaVersion: 1, cases: [{ key: 'DC2', udl: 0.3 }] },
  none: { _schema: 'bridge-dl-loads', schemaVersion: 1, cases: [{ key: 'DC1', udl: 1 }] },
  v2: { _schema: 'bridge-dl-loads', schemaVersion: 2, cases: [{ key: 'DC2', udl: 0.3 }] },
};
test('dlLoads: read as the old app reads it; a pull gives the old app\'s inputs after its own apply (DC2 / DW entered per girder type)', () => {
  let applied = 0;
  for (const [name, P0] of CASES.slice(0, 8)) {
    for (const [pn, pay] of Object.entries(DLP).concat([['unreadable', '{bad'], ['absent', null]])) {
      const raw = pay == null ? null : typeof pay === 'string' ? pay : JSON.stringify(pay), inp = D.inputs(P0);
      O.__store.clear(); if (raw != null) O.__store.set('bridgeSuite.v1.dlLoads', raw);
      const r0 = O.dlResolveFor(J(inp)), r1 = H.dlResolve(raw);
      assert.equal(JSON.stringify(r1), JSON.stringify(r0).replace(', and click \\"Send DL to MCT Loads\\" — then', ' and send its dead loads (DC2 / DW) — then'), `${name} / ${pn}: resolve`);
      if (r0.why) continue;
      assert.equal(JSON.stringify(H.dlTheirs(r1)), JSON.stringify(O.dlTheirsFor(r0)));
      const P = J(P0), c = BR.hasTypes(P) ? BR.shown(P) : null;
      assert.equal(H.dlBlocked(P, c ? c.g : D.sel(P).g), false, name + ': entered DC2 / DW');
      let oldInp = J(inp); O.applyDLTo(f => { oldInp = f(oldInp); }, r0);
      H.applyLoads(P, c, H.dlTheirs(r1));
      assert.deepEqual(J(D.inputs(P)), J(oldInp), `${name} / ${pn}: engine inputs after the pull = the old app's`);
      applied++;
    }
  }
  assert.ok(applied >= 16, 'pulls compared: ' + applied);
  // a project that distributes DC2 / DW itself: the pull is refused (nothing would be used)
  const Pd = M.newProject(); assert.equal(H.dlBlocked(Pd, BR.shown(Pd).g), true);
});

test('projectMeta: the title block fields; Use never blanks a field and changes only what differs', () => {
  const P = M.newProject(); Object.assign(P.project, { name: 'Route 9', number: 'J-1', owner: 'MassDOT', designer: 'AB', checker: '', date: '2026-11-14' });
  assert.deepEqual(J(H.pmFields(P)), { projectName: 'Route 9', bridgeId: '', jobNo: 'J-1', client: 'MassDOT', location: '', preparedBy: 'AB', checkedBy: '', date: '2026-11-14' });
  const pl = H.pmPlan(P, { fields: { projectName: 'Route 9', bridgeId: 'B-1', jobNo: '', client: 'CTDOT', location: 'X', preparedBy: ' ', checkedBy: 'CD', date: '2026-11-15' } });
  assert.deepEqual(J(pl.upd), { owner: 'CTDOT', checker: 'CD', date: '2026-11-15' });
  assert.equal(pl.lines.length, 3); assert.match(pl.lines[1], /Checker: "\(blank\)" → "CD"/);
});

test('ui/bridgexfer.js is the HANDOFF.md §5 reference copy; the page loads the hand-off files', () => {
  const h = fs.readFileSync(path.join(ROOT, 'HANDOFF.md'), 'utf8'), ref = /## 5\. Shared helper[\s\S]*?```js\n([\s\S]*?)```/.exec(h)[1].trim();
  assert.ok(fs.readFileSync(path.join(APP, 'ui/bridgexfer.js'), 'utf8').includes(ref));
  const page = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
  for (const f of ['engine/handoffs.js', 'ui/bridgexfer.js', 'ui/handoffs.js']) assert.ok(page.includes(`'${f}'`), f);
  // BridgeXfer publish: the stamped superReactions = the old app's stamp except producerFile (receivers do not read it, HANDOFF.md §4.4)
  const mk = () => { const m = new Map(), c = { localStorage: { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }, document: { title: 't' }, location: { pathname: '/x' } }; c.window = c; vm.createContext(c); vm.runInContext(fs.readFileSync(path.join(APP, 'ui/bridgexfer.js'), 'utf8'), c); return c; };
  const inp = D.inputs(CASES[0][1]), b = H.srPayload(inp, O.computeAll(J(inp))).payload;
  const a1 = mk().BridgeXfer.publish('superReactions', J(b), H.PRODUCER, 'apps/ps-bridge/index.html').payload, a0 = mk().BridgeXfer.publish('superReactions', J(b), 'PS-Beam', 'Prestressed Bridge Design.html').payload;
  [a1, a0].forEach(p => { delete p.producedAt; }); assert.equal(a1.producerFile, 'apps/ps-bridge/index.html'); delete a1.producerFile; delete a0.producerFile;
  assert.equal(JSON.stringify(a1), JSON.stringify(a0)); assert.equal(a1.producer, 'PS-Beam'); assert.equal(H.SR_ID, 'psbeam');
});
