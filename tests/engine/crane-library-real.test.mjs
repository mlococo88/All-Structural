// Crane Pick Analyzer (apps/crane-pick), C2-1: the REAL crane library loads (structure only). The library (manufacturer chart data) is
// private and never in this repository (it is public): this test runs only where CRANE_LIB_DIR points to a local copy of the library
// folder ("Crane Load Charts/library/" of the private references repository); otherwise it is skipped. It asserts structure and
// behaviour only and prints file names and counts, never a chart value.
//   CRANE_LIB_DIR=/path/to/library node tests/engine/run.mjs crane-library-real
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test, loadShared, ROOT } from './harness.mjs';

const DIR = process.env.CRANE_LIB_DIR;
const APP = path.join(ROOT, 'apps', 'crane-pick', 'engine');
test('every crane file of the real library loads (structure only; skipped without CRANE_LIB_DIR)', () => {
  if (!DIR) { console.log('       (skipped: CRANE_LIB_DIR not set)'); return; }
  const K = loadShared(path.join(APP, 'geo.js'), path.join(APP, 'cranes.js')).CranePickCranes;
  const files = fs.readdirSync(DIR).filter(f => /\.json$/i.test(f)).sort();
  assert.ok(files.length > 0, 'no .json files in CRANE_LIB_DIR');
  let cells = 0, cfgs = 0;
  for (const f of files) {
    const r = K.parse(JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')));
    assert.ok(r.ok, `${f}: ${r.ok ? '' : r.errors.length + ' structure error(s)'}`);
    const c = r.crane;
    assert.ok(c.make && c.model && c.source && typeof c.source === 'object', `${f}: make / model / source`);
    assert.ok(Array.isArray(K.groups(c)), f); const p = K.planDims(c); assert.ok(p.kind === 'crawler' || p.kind === 'wheeled', f);
    assert.ok(Array.isArray(K.hookBlocks(c)), f); assert.match(K.fingerprint(c), /^[0-9a-f]{8}$/);
    for (const g of c.configs) {
      cfgs++;
      const B = g.chart.boom_lengths_ft, R = g.chart.radii_ft;
      // every tabulated cell: a rated cell reads back exactly (one column per length) or as the lowest / lesser; a blank is not permitted
      R.forEach((rr, i) => B.forEach((b, j) => {
        const x = K.lookup(g, b, rr); cells++;
        assert.ok(['ok', 'blank', 'flagged'].includes(x.status), `${f} ${g.id}: status ${x.status}`);
        if (x.ok) assert.ok(x.cap > 0 && x.Rtab === rr && x.Ltab === b, `${f} ${g.id}: cell read back`);
        if (g.chart.capacity_lb[i][j] === null && B.filter(q => q === b).length === 1) assert.equal(x.ok, false, `${f} ${g.id}: a blank cell is not permitted`);
      }));
      assert.equal(K.lookup(g, B[B.length - 1] + 1, R[0]).status, 'outside', `${f} ${g.id}: longer than the chart`);
      assert.equal(K.lookup(g, B[0], R[R.length - 1] + 1).status, 'outside', `${f} ${g.id}: beyond the chart`);
      K.ratingBasis(g, c); K.interpPermitted(g);
    }
  }
  console.log(`       ${files.length} file(s), ${cfgs} chart(s), ${cells} cell lookups: structure ok`);
});
