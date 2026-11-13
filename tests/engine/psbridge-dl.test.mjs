// apps/ps-bridge PR 3a-3: DC2 and DW distributed to each girder line by the Steel Bridge app's method (engine/bridge-dl.js, window.PSBBridgeDL;
//   engineer decision PS-9; a §4 change against the old app where it applies: fixlog/ps-bridge.md PR 3a-3).
//   1. dead() / deadSteps() of bridge-dl.js = lines 116-217 of apps/steel-bridge/engine/loads.js at the pinned commit, byte for byte, and give
//      the same results as window.SBDLoads.dead of that file on the same inputs (MassDOT, AASHTO, RIDOT; sidewalks, added loads, unequal bays).
//   2. A project saved before (no xs.dl) and 'entered': the engine inputs unchanged (byte-identical to PR 3a-2's, the 17 harness B designs).
//   3. The §4 check case (new project): DC2 / DW per line by hand, the engine inputs and the midspan moments.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadShared, test, ROOT } from './harness.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PIN = '58204bac99b576db79d1dc3ac8eed0b47cf70018', FROM = 116, TO = 217;
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', ...PBDF, ...['model', 'holddown', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck'].map(n => path.join(APP, `engine/${n}.js`)));
const W0 = loadShared('steps.js', ...PBDF, ...['model', 'holddown', 'design', 'bridge', 'fields', 'inputcheck'].map(n => path.join(APP, `engine/${n}.js`)));   // without the distribution (PR 3a-2)
const S = loadShared('steps.js', path.join(ROOT, 'apps/steel-bridge/engine/loads.js'));
const M = W.PSBModel, D = W.PSBDesign, DL = W.PSBBridgeDL;
const J = v => JSON.parse(JSON.stringify(v));
const C = v => typeof v === 'number' ? (Object.is(v, -0) ? '-0' : String(v)) : v === null || typeof v !== 'object' ? (typeof v === 'function' ? '' : JSON.stringify(v))
  : Array.isArray(v) ? '[' + v.map(C).join(',') + ']' : '{' + Object.keys(v).filter(k => typeof v[k] !== 'function').map(k => JSON.stringify(k) + ':' + C(v[k])).join(',') + '}';

test('dead() / deadSteps(): the steel app\'s lines 116-217 at the pin, byte for byte', () => {
  let pin; try { pin = execFileSync('git', ['show', `${PIN}:apps/steel-bridge/engine/loads.js`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 24 }); }
  catch (e) { pin = fs.readFileSync(path.join(ROOT, 'apps/steel-bridge/engine/loads.js'), 'utf8'); }
  const slice = pin.split('\n').slice(FROM - 1, TO).join('\n') + '\n';
  const f = fs.readFileSync(path.join(APP, 'engine/bridge-dl.js'), 'utf8'), a = f.indexOf('DEAD-VERBATIM: the code below'), b = f.indexOf('/* ---- end of DEAD-VERBATIM ---- */');
  const body = f.slice(f.indexOf('\n', a) + 1, b);
  assert.equal(body, slice);
});

test('the same results as the steel app\'s SBDLoads.dead (3 methods, sidewalks, added loads, unequal bays)', () => {
  let n = 0;
  for (const method of ['massdot', 'aashto', 'ridot']) for (const bays of [[9, 9, 9, 9], [8, 10, 11, 7.5]]) for (const sw of [0, 6]) {
    const P = M.newProject(); P.xs.bays = bays; P.xs.ohL = 3.5; P.xs.ohR = 2.75;
    Object.assign(P.xs.dl, { method, swL: { w: sw, t: 9 }, barR: { bw: 1.25, w: 0.42 }, fws: 30, extra: [{ name: 'Utility', cat: 'DW', x: 14, plf: 0.05 }, { name: 'Light pole', cat: 'DC2', x: 2, plf: 0.08 }] });
    const R = DL.distribute(P);
    const pos = [0]; bays.forEach(b => pos.push(pos[pos.length - 1] + b));
    const R2 = S.SBDLoads.dead({ Nb: 5, OL: 3.5, ts: 8, fL: 1.5, fR: 1.25 }, { pos, Wdeck: 3.5 + bays.reduce((a, b) => a + b, 0) + 2.75 },
      { method, ped: 0, swL: sw, swThkL: 9, swR: 0, swThkR: 8, medW: 0, medThk: 0, fws: 30, uwc: P.base.mat.wcdLoad, uwcA: null, hh: 0, sip: 0, bf: 0,
        edges: [{ id: 'barL', desc: 'Left barrier', cat: 'DC2', side: 'L', x: 0.75, plf: 0.3 }, { id: 'barR', desc: 'Right barrier', cat: 'DC2', side: 'R', x: 0.625, plf: 0.42 }],
        extra: [{ desc: 'Utility', cat: 'DW', x: 14, plf: 0.05, dist: 'auto' }, { desc: 'Light pole', cat: 'DC2', x: 2, plf: 0.08, dist: 'auto' }], ovl: [], ovr: null, bcls: null });
    assert.equal(C(J(R.dc2)), C(J(R2.dc2)), `${method} ${bays} sw ${sw}: DC2`); assert.equal(C(J(R.dw)), C(J(R2.dw)), 'DW');
    assert.equal(C(J(R.steps)), C(J(R2.steps)), 'steps'); n++;
    // the engine inputs of each line take them
    W.PSBBridge.cells(P).forEach(c => { const i = D.cellInputs(P, c.k, c.g); assert.equal(i.loads.wBar, R.dc2[c.g - 1]); assert.equal(i.loads.wDW, R.dw[c.g - 1]); });
  }
  assert.equal(n, 12);
});

test('saved before (no xs.dl) or "entered": engine inputs byte-identical to PR 3a-2 (the 17 harness B designs, every line)', () => {
  const cases = TAB_CASES(() => M.defaultProject());
  for (const [name, P0] of Object.entries(cases)) {
    const P = M.importJSON(M.exportJSON(P0)).project, P2 = W0.PSBModel.importJSON(M.exportJSON(P0)).project;
    assert.equal(P.xs.dl, undefined, name);
    W.PSBBridge.fill(P); W0.PSBBridge.fill(P2);
    W.PSBBridge.cells(P).forEach(c => assert.equal(JSON.stringify(D.cellInputs(P, c.k, c.g)), JSON.stringify(W0.PSBDesign.cellInputs(P2, c.k, c.g)), `${name} G${c.g}/S${c.s}`));
    const Q = J(P); Q.xs.dl = Object.assign(DL.defaults(Q), { mode: 'entered' });
    W.PSBBridge.cells(Q).forEach(c => assert.equal(JSON.stringify(D.cellInputs(Q, c.k, c.g)), JSON.stringify(W0.PSBDesign.cellInputs(P2, c.k, c.g)), `${name} entered`));
  }
});

test('§4 check case: new project (MassDOT pile-cap, barriers 0.30 klf × 1.5 ft, 25 psf): DC2 / DW per line by hand; G2 moments before and after', () => {
  const P = M.newProject();
  assert.deepEqual(J(P.xs.dl), { mode: 'distributed', method: 'massdot', barL: { bw: 1.5, w: 0.3 }, barR: { bw: 1.5, w: 0.3 }, swL: { w: 0, t: 8 }, swR: { w: 0, t: 8 }, fws: 25, extra: [] });
  assert.deepEqual(J(W.PSBInputCheck.collect(P).errors), []);
  // x̄ = 3 + 18 = 21 ft; c = −18, −9, 0, 9, 18; Σc² = 810; left barrier at 0.75 ft: e = −20.25
  // G1 = 0.3/5 + 0.3(−20.25)(−18)/810 + 0.3/5 (right barrier: negative share → 0) = 0.06 + 0.135 + 0.06 = 0.255
  // G2 = 0.06 + 0.3(20.25)(9)/810 + 0.06 = 0.06 + 0.0675 + 0.06 = 0.1875; G3 = 0.06 + 0.06 = 0.12
  // DW = 0.025 ksf × (42 − 1.5 − 1.5) ft / 5 = 0.975 / 5 = 0.195 klf every line
  const R = DL.distribute(P), near = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} vs ${b}`);
  [0.255, 0.1875, 0.12, 0.1875, 0.255].forEach((v, i) => near(R.dc2[i], v)); R.dw.forEach(v => near(v, 0.195));
  const a = W.PSBHoldDown.compute(D.cellInputs(P, 0, 2)), Q = J(P); Q.xs.dl.mode = 'entered'; const b = W.PSBHoldDown.compute(D.cellInputs(Q, 0, 2));
  const mid = R => R.diagrams.reduce((x, r) => Math.abs(r.x - 60) < Math.abs(x.x - 60) ? r : x);
  near(mid(a).M_DC2, 0.1875 * 120 * 120 / 8); near(mid(a).M_DW, 0.195 * 120 * 120 / 8); near(mid(b).M_DC2, 540); near(mid(b).M_DW, 450);
  assert.equal(mid(b).M_StrI_pos.toFixed(1), '10251.0'); assert.equal(mid(a).M_StrI_pos.toFixed(1), '9849.4');
  // steps of the line: its DC2 / DW sums and each share; the ld.wDC2 step points to them
  const st = DL.stepsFor(P, 2).map(s => s.id);
  ['dl.xbar', 'dl.S2', 'dl.load.barL', 'dl.load.ws', 'dl.G2.barL', 'dl.G2.DC2', 'dl.G2.DW'].forEach(id => assert.ok(st.includes(id), id));
  assert.ok(!st.some(id => /^dl\.G[13-5]\./.test(id) || /\.(deck|haunch|sip|DC1|trib)$/.test(id)));
  const Wl = DL.withSteps({ steps: [{ id: 'ld.wDC2', label: 'x', value: 0.1875 }] }, P);
  assert.match(Wl.steps[0].note, /§dl\.G2\.DC2/); assert.equal(Wl.steps.length, 1 + st.length);
});

test('input checks of the distribution', () => {
  const P = M.newProject(); P.xs.dl.barL.w = -1; P.xs.dl.extra = [{ name: 'x', cat: 'LL', x: 99, plf: 0.1 }];
  const E = W.PSBInputCheck.collect(P).errors.map(e => e.path);
  ['xs.dl.barL.w', 'xs.dl.extra.0.cat', 'xs.dl.extra.0.x'].forEach(p => assert.ok(E.includes(p), p));
  assert.equal(W.PSBFields.tabOf('xs.dl.barL.w'), 'xsec');
});
