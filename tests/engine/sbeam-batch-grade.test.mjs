// Steel Beam Design - AISC 15th.html, batch mode: the Grade column (SBBG, 2026-11-13). pickGrade(fam, text, legacy) reads the
// app's own grade ids (as the template's drop-down offers them) and the usual spellings, ignoring case, spaces and punctuation;
// a text it does not read blocks the row with a message naming the grade (before: the family default was taken silently).
// Blank keeps the family default, including the SBGB rule (rows without S.batch.hssDefB keep A500 Gr. C for HSS).
import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { sbEngine } from './sbeam-source.mjs';

const sb = sbEngine();
const pick = (fam, t, legacy = false) => sb.call('pickGrade', fam, t, legacy);
const MATS = JSON.parse(sb.run('JSON.stringify(MATS)'));
// a batch row through the page's own runBatch (the engine pulls in what it uses)
function batch(rows, hssDefB) {
  sb.ctx.__r = rows; sb.ctx.__h = !!hssDefB;
  for (let k = 0; k < 200; k++) {
    const out = sb.run(`(()=>{S=defaultState();S.mode='batch';S.batch.rows=__r;if(__h)S.batch.hssDefB=true;return runBatch();})()`);
    const m = /(\w+) is not defined/.exec(JSON.stringify(out.map(R => R.blockers)));
    if (!m || !sb.add(m[1])) return out;
  }
}
const row = (size, grade) => ({ desc: 'x', mid: 1, size, grade, Pu: 10, Vux: 5, Mux: 20, Lbx: 8 });

test('SBBG: grade ids and usual spellings are read, case / space / punctuation-insensitive', () => {
  const cases = {
    HSSR: { A500B_R: 'A500B_R', A500C_R: 'A500C_R', 'a500b_r': 'A500B_R', A500B: 'A500B_R', A500C: 'A500C_R', 'A500 Gr B': 'A500B_R', 'A500 Gr. B': 'A500B_R',
      'A500-B': 'A500B_R', 'a500 gr. c': 'A500C_R', 'A500 Grade B': 'A500B_R', 'ASTM A500 Gr. B': 'A500B_R', 'A500 B': 'A500B_R', A1085: 'A1085', 'a 1085': 'A1085', 'ASTM A1085': 'A1085' },
    HSSP: { A500B_P: 'A500B_P', A500C_P: 'A500C_P', A500B: 'A500B_P', 'A500 Gr. C': 'A500C_P', 'A500-C': 'A500C_P', A1085: 'A1085' },
    PIPE: { A53B: 'A53B', 'A53 Gr. B': 'A53B', 'A53 Gr B': 'A53B', 'a53-b': 'A53B', 'ASTM A53 Grade B': 'A53B' },
    W: { A992: 'A992', a992: 'A992', 'ASTM A992': 'A992', A36: 'A36', 'A572-50': 'A572_50', A572_50: 'A572_50', 'A572 Gr. 50': 'A572_50', 'A572 Grade 50': 'A572_50',
      'A913-65': 'A913_65', 'A913 Gr 65': 'A913_65' },
    C: { A36: 'A36', 'A572-50': 'A572_50' }
  };
  for (const [fam, m] of Object.entries(cases)) for (const [t, id] of Object.entries(m)) {
    assert.equal(pick(fam, t), id, `${fam} "${t}"`); assert.equal(pick(fam, t, true), id, `${fam} "${t}" (legacy batch)`);
  }
  // every grade answers to its id and its name in every family that has it
  for (const g of MATS) for (const f of g.fams) for (const t of [g.id, g.name, g.id.toLowerCase(), g.name.toUpperCase()]) assert.equal(pick(f, t), g.id, `${f} "${t}"`);
});

test('SBBG: blank keeps the family default (SBGB rule); "-" counts as blank as before', () => {
  for (const t of [null, '', '  ', '-']) {
    assert.equal(pick('HSSR', t, false), 'A500B_R'); assert.equal(pick('HSSR', t, true), 'A500C_R');
    assert.equal(pick('HSSP', t, false), 'A500B_P'); assert.equal(pick('HSSP', t, true), 'A500C_P');
    assert.equal(pick('W', t, true), 'A992'); assert.equal(pick('PIPE', t, true), 'A53B'); assert.equal(pick('C', t), 'A36');
  }
  const [a, b] = batch([row('HSS8X6X1/2', ''), row('HSS8X6X1/2', '')]);
  assert.equal(a.grade, 'A500C_R');   // rows imported before 2026-11-13 (no hssDefB)
  assert.equal(batch([row('HSS8X6X1/2', '')], true)[0].grade, 'A500B_R');
  assert.equal(b.status !== 'BLOCKED', true);
});

test('SBBG: an unrecognised grade, or one not made in the family, blocks the row and names the grade', () => {
  for (const [fam, t] of [['HSSR', 'A999'], ['HSSR', 'steel'], ['W', 'A500 Gr. Z'], ['HSSR', 'X']]) assert.equal(pick(fam, t), null, `${fam} "${t}"`);
  for (const [fam, t] of [['HSSR', 'A992'], ['HSSR', 'A500B_P'], ['HSSP', 'A500C_R'], ['W', 'A1085'], ['PIPE', 'A500B']]) assert.equal(pick(fam, t), null, `${fam} "${t}"`);
  const out = batch([row('HSS8X6X1/2', 'A999'), row('HSS8X6X1/2', 'A992'), row('W14X90', 'A1085'), row('HSS8X6X1/2', 'A500B'), row('W14X90', '')], true);
  assert.equal(out[0].status, 'BLOCKED'); assert.match(out[0].blockers[0], /Grade “A999” is not recognised/); assert.match(out[0].blockers[0], /A500B_R/);
  assert.equal(out[1].status, 'BLOCKED'); assert.match(out[1].blockers[0], /Grade “A992” \(ASTM A992\) is not available for HSS/);
  assert.equal(out[2].status, 'BLOCKED'); assert.match(out[2].blockers[0], /A1085.*not available for W/);
  assert.notEqual(out[3].status, 'BLOCKED'); assert.equal(out[3].grade, 'A500B_R'); assert.equal(out[3].Fy, 46);
  assert.notEqual(out[4].status, 'BLOCKED'); assert.equal(out[4].grade, 'A992');
  assert.ok(out.slice(0, 3).every(R => R.govDCR == null), 'a blocked row has no result');
});
