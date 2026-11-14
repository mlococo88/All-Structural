// apps/ps-bridge PR 9 (2026-11-14): the cross-section load items of the Steel Bridge app (engineer's choice "Match Steel"): deck edges
//   (barrier, or curb and railing; an entered edge to traffic face), sidewalk railings / fences, a raised median, the curb / sidewalk /
//   median concrete w_c, the wearing surface by thickness, overlays, and added line loads with a distribution per row and category DC1
//   (engine/bridge-dl.js; the traffic face in PSBDesign.deOf; DC1 line loads added to w_NC). A §4 change for projects that use them
//   (fixlog/ps-bridge.md PR 9).
//   1. EDGE-VERBATIM of bridge-dl.js = lines 30-114 of apps/steel-bridge/engine/loads.js at the pinned commit, byte for byte.
//   2. Projects saved before (no new field): every engine input of every girder line byte-identical to before this PR (origin/main's
//      bridge-dl.js and design.js), for the 19 harness B designs and with the cross-section distribution in each method.
//   3. The same DC2 / DW / steps as the steel app's SBDLoads (edgeIn, xsIn, edgeLoads, dead) with every new item, three methods.
//   4. The §4 check case by hand (before / after); the traffic face and d_e with curbs and fences (the steel app's llFaces).
//   5. Round trip: export -> import -> export byte-identical with every new field, the same engine inputs; an old project text too.
//   6. Input checks of the new fields.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadShared, test, ROOT } from './harness.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PIN = '58204bac99b576db79d1dc3ac8eed0b47cf70018', FROM = 30, TO = 114;
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const ENG = ['sections', 'model', 'lldf-fg', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck'];
const W = loadShared('steps.js', ...PBDF, ...ENG.map(n => path.join(APP, `engine/${n}.js`)));
// before this PR: bridge-dl.js and design.js of the commit before it (tests/engine/psbridge-xsloads.before/, copies kept for this test)
const OLD = path.join(ROOT, 'tests/engine/psbridge-xsloads.before');
const W0 = loadShared('steps.js', ...PBDF, ...ENG.map(n => ['design', 'bridge-dl'].includes(n) ? path.join(OLD, `${n}.js`) : path.join(APP, `engine/${n}.js`)));
const S = loadShared('steps.js', path.join(ROOT, 'apps/steel-bridge/engine/loads.js'));
const M = W.PSBModel, D = W.PSBDesign, DL = W.PSBBridgeDL, SL = S.SBDLoads;
const J = v => JSON.parse(JSON.stringify(v));
const C = v => typeof v === 'number' ? (Object.is(v, -0) ? '-0' : String(v)) : v === null || typeof v !== 'object' ? (typeof v === 'function' ? '' : JSON.stringify(v))
  : Array.isArray(v) ? '[' + v.map(C).join(',') + ']' : '{' + Object.keys(v).filter(k => typeof v[k] !== 'function').map(k => JSON.stringify(k) + ':' + C(v[k])).join(',') + '}';
const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-9, `${m || ''} ${a} vs ${b}`);
const mid = R => R.diagrams.reduce((x, r) => Math.abs(r.x - 60) < Math.abs(x.x - 60) ? r : x);
// every new item (PR 9) on a new project
function full(P, method) {
  Object.assign(P.xs.dl, { method, wcA: 0.145, wsMode: 'thk', wsThk: 2.5, wsGam: 0.14, med: { w: 2, t: 9, joint: true },
    ovl: [{ name: 'Membrane', mode: 'psf', psf: 3, thk: null, gam: null }, { name: 'Overlay', mode: 'thk', psf: null, thk: 1, gam: 0.13 }],
    extra: [{ name: 'Utility', cat: 'DW', x: 14, plf: 0.05, dist: 'two' }, { name: 'Light pole', cat: 'DC2', x: 2, plf: 0.08 }, { name: 'Conduit', cat: 'DC1', x: 30, plf: 0.04, dist: 'equal' }, { name: 'Sign', cat: 'DC2', x: 25, plf: 0.06, dist: 'pilecap' }] });
  Object.assign(P.xs.dl.barL, { type: 'curb', cw: 12, ch: 10, rw: 0.05, rp: 1.0 });
  Object.assign(P.xs.dl.barR, { face: 1.25 });
  P.xs.dl.swR = { w: 6, t: 12, fence: 0.04, fenceX: 5.5 };
  return P;
}

test('EDGE-VERBATIM: the steel app\'s lines 30-114 at the pin, byte for byte', () => {
  let pin; try { pin = execFileSync('git', ['show', `${PIN}:apps/steel-bridge/engine/loads.js`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 24 }); }
  catch (e) { pin = fs.readFileSync(path.join(ROOT, 'apps/steel-bridge/engine/loads.js'), 'utf8'); }
  const slice = pin.split('\n').slice(FROM - 1, TO).join('\n') + '\n';
  const f = fs.readFileSync(path.join(APP, 'engine/bridge-dl.js'), 'utf8'), a = f.indexOf('EDGE-VERBATIM: the code below'), b = f.indexOf('/* ---- end of EDGE-VERBATIM ---- */');
  assert.equal(f.slice(f.indexOf('\n', a) + 1, b), slice);
});

test('saved before (no new field): every line\'s engine inputs byte-identical to before PR 9 (19 harness B designs; distributed in 3 methods, sidewalks, added loads)', () => {
  let n = 0;
  const same = (P, tag) => { const A = J(P), B = J(P); W.PSBBridge.cells(A).forEach(c => { assert.equal(JSON.stringify(D.cellInputs(A, c.k, c.g)), JSON.stringify(W0.PSBDesign.cellInputs(B, c.k, c.g)), `${tag} G${c.g}/S${c.s}`); n++; }); };
  for (const [name, P0] of Object.entries(TAB_CASES(() => M.defaultProject()))) {
    const P = M.importJSON(M.exportJSON(P0)).project; W.PSBBridge.fill(P); same(P, name);
    const Q = J(P); Q.xs.dl = DL.defaults(Q); same(Q, name + ' distributed');
  }
  for (const method of ['massdot', 'aashto', 'ridot']) for (const bays of [[9, 9, 9, 9], [8, 10, 11, 7.5]]) {
    const P = M.newProject(); P.xs.bays = bays; P.xs.ohL = 3.5; P.xs.ohR = 2.75;
    Object.assign(P.xs.dl, { method, swL: { w: 6, t: 12 }, barR: { bw: 1.25, w: 0.42 }, fws: 30, extra: [{ name: 'Utility', cat: 'DW', x: 14, plf: 0.05 }, { name: 'Light pole', cat: 'DC2', x: 2, plf: 0.08 }] });
    same(P, `${method} ${bays}`);
    assert.equal(C(J(DL.distribute(P).steps)), C(J(W0.PSBBridgeDL.distribute(J(P)).steps)), 'the worked steps');
  }
  assert.ok(n > 100, String(n));
});

test('every new item: the same DC2 / DW / steps as the steel app\'s SBDLoads (edgeIn, xsIn, edgeLoads, dead), 3 methods; DC1 rows -> w_NC', () => {
  for (const method of ['massdot', 'aashto', 'ridot']) {
    const P = full(M.newProject(), method);
    assert.deepEqual(J(W.PSBInputCheck.collect(P).errors), [], method);
    const R = DL.distribute(P), q = P.xs.dl, e = [];
    const Ed = SL.edgeIn({ L: { type: 'curb', cw: 12, ch: 10, rw: 0.05, rp: 1.0 }, R: { type: 'barrier', bw: 1.5, bwt: 0.3, face: 1.25 } }, e);
    const xs = SL.xsIn({ dl: { wcA: 0.145, swL: 0, swR: 6, fenceR: 0.04, fenceXR: 5.5, wsMode: 'thk', wsThk: 2.5, wsGam: 0.14 }, ovl: q.ovl }, e);
    assert.deepEqual(e, []);
    const b = SL.bridgeEff({ wc: 0.15 }, Ed);
    const R2 = SL.dead({ Nb: 5, OL: 3, ts: P.base.ts, fL: Ed.L.f, fR: Ed.R.f }, { pos: [0, 9, 18, 27, 36], Wdeck: 42 },
      { method, ped: 0, swL: 0, swThkL: 8, swR: 6, swThkR: 12, medW: 2, medThk: 9, medJoint: 'yes', fws: xs.fws, uwc: 0.15, uwcA: xs.wcA, hh: 0, sip: 0, bf: 0,
        fenceL: xs.fenceL, fenceXL: xs.fenceXL, fenceR: xs.fenceR, fenceXR: xs.fenceXR, wsThk: xs.wsThk, wsGam: xs.wsGam, ovl: xs.ovl, ovr: null, bcls: null,
        edges: SL.edgeLoads(b, xs.wcA), extra: q.extra.map(r => ({ desc: r.name, cat: r.cat, x: r.x, plf: r.plf, dist: r.dist || 'auto' })) });
    assert.equal(C(J(R.dc2)), C(J(R2.dc2)), method + ' DC2'); assert.equal(C(J(R.dw)), C(J(R2.dw)), 'DW'); assert.equal(C(J(R.steps)), C(J(R2.steps)), 'steps');
    assert.ok(['curbL', 'railL', 'barR', 'swR', 'fenceR', 'med', 'ws', 'ovl0', 'ovl1', 'u0', 'u1', 'u2', 'u3'].every(id => R.per.some(L => L.id === id)), R.per.map(L => L.id).join());
    // the engine inputs: DC2 / DW of the line; w_NC + the line's share of the DC1 rows (the conduit, 'equal': 0.04 / 5)
    W.PSBBridge.cells(P).forEach(c => { const i = D.cellInputs(P, c.k, c.g); assert.equal(i.loads.wBar, R.dc2[c.g - 1]); assert.equal(i.loads.wDW, R.dw[c.g - 1]);
      near(i.loads.wNC, +P.base.loads.wNC + 0.04 / 5, 'w_NC'); });
    // the line's DC1 step, and the ld.wDC1 note pointing to it
    const Wl = DL.withSteps({ steps: [{ id: 'ld.wDC1', label: 'x', value: 0 }] }, P), g = D.sel(P).g, s1 = Wl.steps.find(s => s.id === `dl.G${g}.DC1x`);
    near(s1.value, 0.008); assert.match(Wl.steps[0].note, new RegExp(`§dl\\.G${g}\\.DC1x`));
    // d_e: the steel app's llFaces (left: the railing face 1.0 ft, the 10 in curb mountable; right: max(face 1.25, the 12 in sidewalk 6, the fence 5.5) = 6)
    const ll = SL.llFaces(b, { swL: 0, swThkL: 8, swR: 6, swThkR: 12 }, xs, Ed.L.f, Ed.R.f);
    near(D.deOf(P, 1), 3 - ll.L.r); near(D.deOf(P, 5), 3 - ll.R.r); near(ll.L.r, 1.0); near(ll.R.r, 6);
  }
});

test('§4 check case (new AASHTO project; left edge a 12 × 10 in curb + 0.05 klf railing at 1.0 ft; a 0.05 klf DC1 conduit at 21 ft): before / after by hand', () => {
  const P = M.newProject(), Q = J(P);
  Object.assign(Q.xs.dl.barL, { type: 'curb', cw: 12, ch: 10, rw: 0.05, rp: 1.0 }); Q.xs.dl.extra = [{ name: 'Conduit', cat: 'DC1', x: 21, plf: 0.05 }];
  assert.deepEqual(J(W.PSBInputCheck.collect(Q).errors), []);
  const a = DL.distribute(P), b = DL.distribute(Q);
  // before: DC2 = 2 × 0.30 / 5 = 0.120; DW = 0.025 × (42 − 1.5 − 1.5) / 5 = 0.975 / 5 = 0.195
  a.dc2.forEach(v => near(v, 0.12)); a.dw.forEach(v => near(v, 0.195));
  // after: curb 12/12 × 10/12 × 0.150 = 0.125 klf at 0.5 ft; railing 0.05 at 1.0 ft; ΣDC2 = 0.125 + 0.05 + 0.30 = 0.475, / 5 = 0.095;
  // the traffic face = the railing face 1.0 ft (curb < 12 in: mountable); DW = 0.025 × (42 − 1.0 − 1.5) / 5 = 0.9875 / 5 = 0.1975; DC1 0.05 / 5 = 0.010
  near(b.per.find(L => L.id === 'curbL').plf, 0.125); near(b.per.find(L => L.id === 'curbL').x, 0.5); near(b.per.find(L => L.id === 'railL').x, 1.0);
  b.dc2.forEach(v => near(v, 0.095)); b.dw.forEach(v => near(v, 0.1975));
  near(D.deOf(P, 1), 1.5); near(D.deOf(Q, 1), 2.0); near(D.deOf(Q, 5), 1.5);
  // G2 (interior): M_DC2 = 0.095 × 120² / 8 = 171.0 (before 216.0); M_DW = 0.1975 × 1800 = 355.5 (before 351.0); w_NC 0.10 -> 0.11, M_DC1 1957.5 -> 1975.5;
  // Strength I: 9697.49 + 1.25 (−45 + 18) + 1.50 (4.5) = 9697.49 − 27.00 = 9670.49 kip-ft
  const ka = W.PSBHoldDown.compute(D.cellInputs(P, 0, 2)), kb = W.PSBHoldDown.compute(D.cellInputs(Q, 0, 2));
  near(mid(ka).M_DC2, 216); near(mid(kb).M_DC2, 171); near(mid(ka).M_DW, 351); near(mid(kb).M_DW, 355.5); near(mid(ka).M_DC1, 1957.5); near(mid(kb).M_DC1, 1975.5);
  assert.equal(mid(ka).M_StrI_pos.toFixed(2), '9697.49'); assert.equal(mid(kb).M_StrI_pos.toFixed(2), '9670.49');
  // G1 (exterior): d_e 1.5 -> 2.0 ft; lever 1.2 × 0.5 × ((9 − 0.5)/9 + (9 − 6.5)/9) = 0.7333 -> 1.2 × 0.5 × (9/9 + 3/9) = 0.8000;
  // rigid (2 lanes): 2/5 + 18 × (14.5 + 2.5) / 810 = 0.7778 -> 2/5 + 18 × (15 + 3) / 810 = 0.8000 (governs, g_M = 0.7778 -> 0.8000)
  const ga = W.PSBHoldDown.compute(D.cellInputs(P, 1, 1)), gb = W.PSBHoldDown.compute(D.cellInputs(Q, 1, 1));
  near(ga.df.lever, 1.2 * 0.5 * (8.5 + 2.5) / 9); near(gb.df.lever, 0.8); near(ga.df.rigid, 0.4 + 18 * 17 / 810); near(gb.df.rigid, 0.8); near(ga.df.dfm, 0.4 + 18 * 17 / 810); near(gb.df.dfm, 0.8);
  assert.equal(mid(ga).M_StrI_pos.toFixed(2), '9734.78'); assert.equal(mid(gb).M_StrI_pos.toFixed(2), '9849.81');
});

test('round trip: export -> import -> export byte-identical with every new field (the same engine inputs); an old project text too', () => {
  for (const method of ['massdot', 'aashto', 'ridot']) {
    const P = full(M.newProject(), method), t = M.exportJSON(P), r = M.importJSON(t);
    assert.ok(r.ok); assert.equal(M.exportJSON(r.project), t);
    W.PSBBridge.cells(P).forEach(c => assert.equal(JSON.stringify(D.cellInputs(r.project, c.k, c.g)), JSON.stringify(D.cellInputs(P, c.k, c.g))));
  }
  const old = M.exportJSON(W0.PSBModel.newProject()), r = M.importJSON(old); assert.ok(r.ok); assert.equal(M.exportJSON(r.project), old);
  assert.equal(JSON.stringify(M.newProject().xs.dl), JSON.stringify(W0.PSBModel.newProject().xs.dl), 'a new project: no new field written');
});

test('input checks of the new fields', () => {
  const P = M.newProject(), q = P.xs.dl;
  q.barL = { type: 'curb', cw: 12 }; q.barR.face = -1; q.swL = { w: 4, t: 8, fenceX: 5 }; q.med = { w: 2 }; q.wcA = 0; q.wsMode = 'thk';
  q.ovl = [{ name: 'o', mode: 'thk', thk: 1 }]; q.extra = [{ name: 'x', cat: 'UT', x: 3, plf: 0.1, dist: 'r64' }];
  const E = W.PSBInputCheck.collect(P).errors.map(e => e.path);
  ['xs.dl.barL.ch', 'xs.dl.barL.rw', 'xs.dl.barL.rp', 'xs.dl.barR.face', 'xs.dl.swL.fenceX', 'xs.dl.med.t', 'xs.dl.wcA', 'xs.dl.wsThk', 'xs.dl.wsGam', 'xs.dl.ovl.0.gam', 'xs.dl.extra.0.cat', 'xs.dl.extra.0.dist']
    .forEach(p => assert.ok(E.includes(p), p + ' in ' + E.join()));
  assert.ok(!E.includes('xs.dl.barL.cw') && !E.includes('xs.dl.barL.bw'));
  assert.equal(DL.distribute(P), null);
  ['xs.dl.med.w', 'xs.dl.ovl.0.psf', 'xs.dl.barL.cw'].forEach(p => assert.equal(W.PSBFields.tabOf(p), 'xsec'));
});

test('figures (display only): the cross-section and the 3D view draw the curb, railing, fence and median; the 3D sidewalk from the deck edge (XS-D3)', () => {
  const U = loadShared('steps.js', ...PBDF, ...['sections', 'model', 'rigid', 'lldf-fg', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl'].map(n => path.join(APP, `engine/${n}.js`)), ...['vizkit', 'strands', 'view3d', 'xsfig'].map(n => path.join(APP, `ui/${n}.js`)));
  U.PSBSections.install();
  const P = full(U.PSBModel.newProject(), 'aashto'), m = U.PSBXsFig.model(P, 1), G = U.PSB3DUI.geom(P), Wd = 42 * 12;
  const k = a => a.map(q => q.kind + (q.side || '')).sort().join();
  assert.equal(k(m.app), 'barR,curbL,fenceR,med,railL,swR'); assert.equal(k(G.app), 'barR,curbL,fenceR,med,railL,swR');
  const c = m.app.find(a => a.kind === 'curb'); near(c.x0, 0); near(c.x1, 12); near(c.y1 - c.y0, 10);
  near((m.app.find(a => a.kind === 'rail').x0 + m.app.find(a => a.kind === 'rail').x1) / 2, 12);
  const sw = m.app.find(a => a.kind === 'sw'), f = m.app.find(a => a.kind === 'fence'), md = m.app.find(a => a.kind === 'med');
  near(sw.x1, Wd); near(sw.x0, Wd - 72); near((f.x0 + f.x1) / 2, Wd - 66); near(f.y0, sw.y1); near(md.x1 - md.x0, 24); near((md.x0 + md.x1) / 2, Wd / 2);
  // the faces drawn at the d_e the engine uses (deOf with the railing face 1.0 ft on the left, the 12 in sidewalk on the right)
  near(m.faces.find(q => q.g === 1).de, 2.0); near(m.faces.find(q => q.g === 5).de, -3.0);
  // 3D: the sidewalk from the deck edge (z to the right edge), the barrier on it
  const s3 = G.app.find(a => a.kind === 'sw'), b3 = G.app.find(a => a.kind === 'bar'), zR = G.deck.zR;
  near(s3.z1, zR); near(s3.z0, zR - 72); near(b3.z1, zR); near(b3.y0, s3.y0 + 12);
});
