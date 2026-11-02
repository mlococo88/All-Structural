// shared/list-input.js: the pure parse / format helpers (no DOM). Added 2026-11-02.
// Checks: a list saved as text round-trips in the SAME format (Shear and Moment Diagrams `userXs`, Steel Beam Design
// `S.disp.userX`, which also reads Shear and Moment's `userXs`), and the tools' own parsers read the same numbers before and
// after; arrays stay arrays; pastes from Excel / typed lists split into rows; per-cell checks.
import assert from 'node:assert/strict';
import { loadShared, test, plain } from './harness.mjs';

const L = loadShared('list-input.js').SharedListInput;
const P = v => JSON.parse(JSON.stringify(v));

// The tools' own parsers, copied verbatim (they are not changed by the table):
// Shear and Moment Diagrams.html readIn(): userX = g('iUX').value.split(',').map(s=>parseFloat(s.trim())).filter(n=>!isNaN(n));
const smdParse = s => s.split(',').map(x => parseFloat(x.trim())).filter(n => !isNaN(n));
// Steel Beam Design - AISC 15th.html userXList() (without the 0..L filter, which takes the beam length):
const sbdParse = s => (s || '').split(',').map(x => parseFloat(x.trim())).filter(n => isFinite(n));

test('text round trip: "2.5, 5" reads into one row per value and is written back byte for byte', () => {
  for (const s of ['2.5, 5', '5, 12.5, 31', '0', '', '3.333333, 10.25, 24']) {
    const rows = L.fromText(s);
    assert.equal(L.toText(rows), s, s);
    assert.deepEqual(P(smdParse(L.toText(rows))), P(smdParse(s)));
  }
  assert.deepEqual(P(L.fromText('2.5, 5')), [['2.5'], ['5']]);
});

test('text round trip: older spellings keep every value the tools read (Shear and Moment and Steel Beam parsers)', () => {
  // what a user may have typed in the old single box; the table writes the canonical ", " form only after an edit
  const cases = ['2.5,5', ' 2.5 ,  5 ', '2.5,,5,', '1, abc, 7', '4ft, 8', '-2, 40, 1e1', '2.50, 05'];
  for (const s of cases) {
    const t = L.toText(L.fromText(s));
    assert.deepEqual(P(smdParse(t)), P(smdParse(s)), 'SMD ' + s);
    assert.deepEqual(P(sbdParse(t)), P(sbdParse(s)), 'SBD ' + s);
    assert.equal(L.toText(L.fromText(t)), t, 'stable ' + s);   // a second save writes the same text
  }
  assert.equal(L.toText(L.fromText('2.5,5')), '2.5, 5');
  assert.equal(L.toText(L.fromText('2.50, 05')), '2.50, 05');     // cell text is kept as typed, never re-formatted
});

test('Steel Beam Design reads a Shear and Moment file: userXs written by the table parses the same', () => {
  const smdSaved = L.toText([['2.5'], ['', ''], ['5'], ['12.75']]);   // blank rows are not saved
  assert.equal(smdSaved, '2.5, 5, 12.75');
  assert.deepEqual(P(sbdParse(smdSaved)), [2.5, 5, 12.75]);
});

test('arrays stay arrays: fromNumbers / toNumbers', () => {
  const a = [110, 140, 110.5];
  assert.deepEqual(P(L.toNumbers(L.fromNumbers(a))), a);
  assert.deepEqual(P(L.fromNumbers([[20, 1.5], [40, null]])), [['20', '1.5'], ['40', '']]);
  assert.deepEqual(P(L.toNumbers([['20', '1.5'], ['x', '2'], ['', ''], ['40', '3']], 1)), [1.5, 2, 3]);
  assert.deepEqual(P(L.toNumbers([['1'], ['abc'], ['2']])), [1, 2]);
});

test('multi-column text formats: x:P pairs and a-b ranges', () => {
  const xp = L.fromText('20:1.5, 40:1.5', { colSplit: ':', ncol: 2 });
  assert.deepEqual(P(xp), [['20', '1.5'], ['40', '1.5']]);
  assert.equal(L.toText(xp, { colSep: ':' }), '20:1.5, 40:1.5');
  const rg = L.fromText('0-80, 140-220', { colSplit: '-', ncol: 2 });
  assert.equal(L.toText(rg, { colSep: '-' }), '0-80, 140-220');
});

test('splitPaste: one column', () => {
  assert.deepEqual(P(L.splitPaste('2.5, 5; 7 9', 1)), [['2.5'], ['5'], ['7'], ['9']]);
  assert.deepEqual(P(L.splitPaste('1\n2\r\n3\n\n', 1)), [['1'], ['2'], ['3']]);              // an Excel column
  assert.deepEqual(P(L.splitPaste('1,234\n5', 1)), [['1,234'], ['5']]);                      // Excel thousands separator kept in its cell
  assert.deepEqual(P(L.splitPaste('1\t2\t3', 1)), [['1'], ['2'], ['3']]);                     // an Excel row
  assert.deepEqual(P(L.splitPaste('steel, girder bridge', 1, { columns: [{ type: 'text' }] })), [['steel'], ['girder bridge']]);
  assert.deepEqual(P(L.splitPaste('', 1)), []);
});

test('splitPaste: several columns, header line dropped, tool text format', () => {
  assert.deepEqual(P(L.splitPaste('along\tacross\n1\t2\n3\t4\n', 2)), [['1', '2'], ['3', '4']]);
  assert.deepEqual(P(L.splitPaste('1, 2\n3; 4\n5 6', 2)), [['1', '2'], ['3', '4'], ['5', '6']]);
  assert.deepEqual(P(L.splitPaste('1\t2\t9', 2)), [['1', '2']]);                              // extra cells cut to the table
  assert.deepEqual(P(L.splitPaste('1, 2, 3, 4', 2)), [['1', '2'], ['3', '4']]);
  const parse = t => L.fromText(t, { colSplit: ':', ncol: 2 });
  assert.deepEqual(P(L.splitPaste('20:1.5, 40:2', 2, { parse })), [['20', '1.5'], ['40', '2']]);
  assert.deepEqual(P(L.splitPaste('P1, 750123.45, 210987.65\nP2, 1, 2', 3, { columns: [{ type: 'text' }, {}, {}] })),
    [['P1', '750123.45', '210987.65'], ['P2', '1', '2']]);
});

test('checkCell: numbers, ranges, whole numbers, lenient reading', () => {
  assert.equal(L.checkCell('', {}).level, '');
  assert.equal(L.checkCell('', { required: true }).level, 'error');
  assert.equal(L.checkCell('abc', {}).msg, 'Not a number');
  assert.equal(L.checkCell('2.5', {}).value, 2.5);
  const lenient = L.checkCell('4ft', { lenient: true });
  assert.equal(lenient.level, 'warn'); assert.equal(lenient.msg, 'Read as 4'); assert.equal(lenient.value, 4);
  assert.equal(L.checkCell('-1', { min: 0 }).msg, 'Must be ≥ 0');
  assert.equal(L.checkCell('0', { min: 0, minExclusive: true }).msg, 'Must be > 0');
  assert.equal(L.checkCell('40', { max: () => 36, rangeNote: 'outside the beam, not used' }).msg, 'Must be ≤ 36 (outside the beam, not used)');
  assert.equal(L.checkCell('36', { max: () => 36 }).level, '');
  assert.equal(L.checkCell('2.5', { integer: true }).msg, 'Must be a whole number');
  assert.equal(L.checkCell('anything', { type: 'text' }).level, '');
});

test('same / filled', () => {
  assert.equal(L.same([['5'], ['', '']], [[5]], [{}]), true);
  assert.equal(L.same([['5.0']], [['5']], [{}]), true);
  assert.equal(L.same([['5.0']], [['5']], [{ type: 'text' }]), false);
  assert.equal(L.same([['5'], ['6']], [['5']], [{}]), false);
  assert.deepEqual(plain(L.filled([[' 1 ', ''], ['', ' '], [2]])), [['1', ''], ['2']]);
});

// Bridge Substructure Loading.html: span lengths / girder spacings. The hidden <input data-list> holds b.spans.join(', ');
// the tool's change handler reads it with  t.value.split(/[,\s]+/).filter(Boolean).map(num)  and stores the ARRAY.
const bslParse = s => s.split(/[,\s]+/).filter(Boolean).map(Number);
test('Bridge Substructure Loading: spans / bays arrays round-trip through the table', () => {
  for (const a of [[110, 140, 110], [9.5, 9.5, 9.5, 9.5], [87.25], [100, 120.125, 100, 80]]) {
    const text = a.join(', '), rows = L.fromText(text);
    assert.equal(L.toText(rows), text);
    assert.deepEqual(P(bslParse(L.toText(rows))), a);
  }
  // an older box text typed with spaces only ("110 140") shows one row per value only after the tool re-renders it (the
  // tool always writes b.spans.join(', ') into the box), so the table never sees it
  assert.deepEqual(P(bslParse(L.toText([['110'], [''], ['150']]))), [110, 150]);
});
