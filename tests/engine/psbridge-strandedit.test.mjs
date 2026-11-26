// apps/ps-bridge batch G5 (2026-11-15): strand editing by clicking the section (ui/strandedit.js; the old app's Live Geometry editing,
//   O:4936-5024) and the table's "Clear debonding on this row" (O:6031). Checked: (1) the edit rules (add to a row / a new row sorted, NEXT
//   pairs, remove down to the row dropped, one row kept, debond cycling with 10 % L rounded, clear, move ±1 in sorted, ≥ 1 in); (2) the add
//   slots: the 2 in grid in the bottom flange, none where one more strand would not fit, each slot itself fitting; (3) the fit check refuses
//   an edit that adds an input-check error (BT-72 bottom flange full at 12 strands a row); (4) the table button sets n_d and the length to 0.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', ...PBD, ...['sections', 'model', 'rigid', 'lldf-fg', 'reltension', 'holddown', 'pierblock', 'demands', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck'].map(n => path.join(APP, `engine/${n}.js`)),
  ...['vizkit', 'strands', 'strandedit', 'inputs'].map(n => path.join(APP, `ui/${n}.js`)));
const plain = o => JSON.parse(JSON.stringify(o)), E = () => W.PSBStrandEdit;
const R0 = [{ n: 12, y: 2, nd: 0, dbnd: 0 }, { n: 8, y: 4, nd: 0, dbnd: 0 }];

test('G5: add / remove / debond / clear / move, the old app\'s rules', () => {
  const a = E();
  let r = a.apply(R0, 'add', { y: 4 }); assert.deepEqual(plain(r.rows), [{ n: 12, y: 2, nd: 0, dbnd: 0 }, { n: 9, y: 4, nd: 0, dbnd: 0 }]); assert.equal(r.msg, 'Added 1 strand at y = 4 in');
  r = a.apply(R0, 'add', { y: 6, next: true }); assert.deepEqual(plain(r.rows[2]), { n: 2, y: 6, dbnd: 0, nd: 0 }, 'a new row, NEXT: a pair');
  r = a.apply(R0, 'add', { y: 3.6 }); assert.equal(r.rows.length, 2); assert.equal(r.rows[1].n, 9, 'y rounded to 4: the row at 4');
  r = a.apply([{ n: 4, y: 6, nd: 0, dbnd: 0 }, ...R0], 'add', { y: 5 }); assert.deepEqual(plain(r.rows).map(q => q.y), [2, 4, 5, 6], 'a new row: the rows sorted');
  r = a.apply(R0, 'remove', { i: 1 }); assert.equal(r.rows[1].n, 7);
  r = a.apply([{ n: 1, y: 2, nd: 0, dbnd: 0 }, { n: 4, y: 4, nd: 0, dbnd: 0 }], 'remove', { i: 0 }); assert.deepEqual(plain(r.rows), [{ n: 4, y: 4, nd: 0, dbnd: 0 }], 'row dropped at 0');
  assert.match(a.apply([{ n: 1, y: 2, nd: 0, dbnd: 0 }], 'remove', { i: 0 }).err, /One straight strand row stays/);
  r = a.apply(R0, 'debond', { i: 0, L: 118 }); assert.deepEqual(plain(r.rows[0]), { n: 12, y: 2, nd: 1, dbnd: 12 }, '10 % of 118 ft = 11.8 → 12 ft');
  r = a.apply([{ n: 2, y: 2, nd: 2, dbnd: 8 }], 'debond', { i: 0, L: 100 }); assert.deepEqual(plain(r.rows[0]), { n: 2, y: 2, nd: 0, dbnd: 0 }, 'cycles to none');
  r = a.apply([{ n: 4, y: 2, nd: 0, dbnd: 0 }], 'debond', { i: 0, L: 100, next: true }); assert.equal(r.rows[0].nd, 2, 'NEXT: a pair');
  r = a.apply([{ n: 12, y: 2, nd: 4, dbnd: 10 }], 'clear', { i: 0 }); assert.deepEqual(plain(r.rows[0]), { n: 12, y: 2, nd: 0, dbnd: 0 });
  r = a.apply(R0, 'up', { i: 0 }); assert.deepEqual(plain(r.rows).map(q => q.y), [3, 4]);
  r = a.apply([{ n: 4, y: 5, nd: 0, dbnd: 0 }, { n: 4, y: 4, nd: 0, dbnd: 0 }].slice(1).concat([{ n: 2, y: 6, nd: 0, dbnd: 0 }]), 'up', { i: 1 }); assert.deepEqual(plain(r.rows).map(q => q.y), [4, 7]);
  r = a.apply([{ n: 4, y: 5, nd: 0, dbnd: 0 }, { n: 4, y: 8, nd: 0, dbnd: 0 }], 'up', { i: 0 }); assert.deepEqual(plain(r.rows).map(q => q.y), [6, 8]);
  r = a.apply([{ n: 4, y: 5, nd: 0, dbnd: 0 }, { n: 4, y: 8, nd: 0, dbnd: 0 }], 'down', { i: 1 }); assert.deepEqual(plain(r.rows).map(q => q.y), [5, 7]);
  assert.match(a.apply([{ n: 4, y: 1, nd: 0, dbnd: 0 }], 'down', { i: 0 }).err, /lowest/);
  assert.deepEqual(plain(R0), [{ n: 12, y: 2, nd: 0, dbnd: 0 }, { n: 8, y: 4, nd: 0, dbnd: 0 }], 'the rows given are not changed');
});

test('G5: the fit check: the BT-72 26 in bottom flange holds 12 strands a row on the 2 in grid, a 13th is refused; the add slots only where one more fits', () => {
  const P = W.PSBModel.defaultProject(), rows = P.base.rows, fc = E().fitCtx(P, -1, rows);
  assert.deepEqual(plain(E().fitErrs(P, -1, rows)), [], 'the default rows fit');
  const full = rows.map(r => Object.assign({}, r)); const i2 = full.findIndex(r => r.y === 2);
  const g = W.girderGross(Object.assign({}, W.PSBDesign.inputs(P))), maxCols = Math.floor((g.bbf - 4) / 2) + 1;   // 12 on a 2 in grid in 26 in
  full[i2].n = maxCols; assert.ok(fc.fits(full), `${maxCols} strands at y = 2 fit`);
  full[i2].n = maxCols + 1; assert.ok(!fc.fits(full), `${maxCols + 1} do not`); assert.match(fc.fitWhy(full), /do not fit the PCI BT-72/);
  const half = W.halfPolygon(g), poly = half.concat(half.slice().reverse().map(p => [-p[0], p[1]]));
  const atY2 = rows.find(r => r.y === 2).n, sl = E().slots(g, rows, { misfit: q => W.PSBInputCheck.misfit(g, poly, q), fits: fc.fits });
  if (atY2 >= maxCols) assert.ok(!sl.some(q => q.y === 2), 'no slot at y = 2 when the row is full');
  assert.ok(sl.length > 0 && sl.every(q => W.PSBInputCheck.misfit(g, poly, q) === '' && q.y <= Math.min(g.h * 0.4, 16)), 'each slot fits');
  assert.ok(sl.every(q => Math.abs(q.x) <= g.bbf / 2 - 2 + 1e-9), 'within the bottom flange less 2 in cover');
});

test('G5: a girder type\'s scope: its own rows (overrides) are checked; the table\'s "Clear debonding on this row" button', () => {
  const P = W.PSBModel.defaultProject(); P.base.rows[0].nd = 2; P.base.rows[0].dbnd = 10;
  const html = W.PSBInputsUI.table('base.rows', P);
  assert.ok(html.includes('data-act="clrdb" data-tbl="base.rows" data-i="0"'), 'button on the debonded row');
  assert.equal((html.match(/data-act="clrdb"/g) || []).length, 1, 'only on rows with debonding');
  const ev = { target: { closest: s => (s === '[data-act][data-tbl]' ? { dataset: { act: 'clrdb', tbl: 'base.rows', i: '0' } } : null) } };
  assert.equal(W.PSBInputsUI.onClick(ev, P), true); assert.equal(P.base.rows[0].nd, 0); assert.equal(P.base.rows[0].dbnd, 0);
  const Q = W.PSBModel.defaultProject(); Q.types = W.PSBBridge.newTypes(Q);
  assert.deepEqual(plain(E().fitErrs(Q, 0, Q.base.rows)), [], 'type 0: the rows fit');
  const big = Q.base.rows.map(r => Object.assign({}, r, { n: 30 })); assert.ok(E().fitErrs(Q, 0, big).length > 0, 'type 0: 30 a row does not fit');
});
