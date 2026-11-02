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

// Bridge Geometry.html: per-span girder offsets SPAN_OV[s].girders (array, or null = the global set). The table's rows are read
// with the tool's old box parser:  v.trim()? v.split(',').map(x=>+x.trim()).filter(x=>!isNaN(x)) : null
const bgParse = v => v.trim() ? v.split(',').map(x => +x.trim()).filter(x => !isNaN(x)) : null;
test('Bridge Geometry: per-span girder offsets round-trip (array, or null when no rows)', () => {
  for (const a of [[-18, -6, 6, 18], [-15.5, 0, 15.5], [-3.25]]) {
    assert.equal(L.toText(L.fromNumbers(a)), a.join(', '));                  // the text the old box showed
    assert.deepEqual(P(bgParse(L.toText(L.fromNumbers(a)))), a);
  }
  assert.equal(bgParse(L.toText(L.fromNumbers([]))), null);                  // no rows -> null (the global set), as a blank box
  assert.equal(bgParse(L.toText([[''], ['  ']])), null);                     // blank rows are not read
  assert.deepEqual(P(bgParse(L.toText([['-6'], ['abc'], ['6']]))), [-6, 6]); // an unreadable cell is skipped, as in the old box
});

// Gusset Plate Rating.html: members[i].fast.g is saved TEXT. The table reads it with gageList()'s own separators (/[,;\s]+/) and
// writes rows joined by ", ". gageList() (copied verbatim; num() simplified to plain numbers, blank -> NaN as in the tool) reads the same gages.
const gpNum = v => (String(v).trim() === '' ? NaN : Number(v));   // the tool's num(): blank -> NaN
const gpGages = (g, nL) => { if (nL < 2) return []; let a = String(g ?? '').split(/[,;\s]+/).map(gpNum).filter(x => isFinite(x)); if (!a.length) a = [NaN];
  const out = []; for (let i = 0; i < nL - 1; i++) out.push(a[Math.min(i, a.length - 1)]); return out; };
test('Gusset Plate Rating: gage text round-trips; gageList() reads the same gages (the last value repeats)', () => {
  const f = { rowSplit: /[,;\s]+/ };
  for (const s of ['4', '3.5, 4, 3.5', '3, 5.5']) assert.equal(L.toText(L.fromText(s, f)), s, s);   // the forms the tool writes: unchanged
  for (const s of ['3 3 5.5', '3;3;5.5', '3,3 ,5.5', ' 4 ']) {                                      // older spellings: same gages after a save
    const t = L.toText(L.fromText(s, f));
    for (const nL of [2, 4, 6]) assert.deepEqual(P(gpGages(t, nL)), P(gpGages(s, nL)), s + ' nL ' + nL);
    assert.equal(L.toText(L.fromText(t, f)), t);
  }
  assert.equal(L.toText(L.fromText('3 3 5.5', f)), '3, 3, 5.5');
});

// Section Property Calculator.html: library "Tags". LIBF.tags is screen-only text; libSaveCurrent() saves the ARRAY
// LIBF.tags.split(',').map(t => t.trim()).filter(Boolean). The table writes its rows joined by ", ".
const spTags = s => s.split(',').map(t => t.trim()).filter(Boolean);
test('Section Property Calculator: tag rows -> LIBF.tags text -> the same tags array as the old box', () => {
  assert.deepEqual(P(spTags(L.toText([['crane'], ['runway'], ['W21']]))), ['crane', 'runway', 'W21']);
  assert.deepEqual(P(spTags(L.toText([['crane runway'], [''], ['W21 + C15']]))), ['crane runway', 'W21 + C15']);   // spaces kept inside a tag
  assert.deepEqual(P(spTags(L.toText([]))), []);
  for (const s of ['crane, runway', 'W21 + C15, 2016 job']) assert.equal(L.toText(L.fromText(s)), s);
});

// index.html (MCT generator): the four GFS lists (bay1Stations, bay2Stations, stringerOffsets, stringerOffsets2) are ARRAYS; the
// old NumberListInput read its text with  s.split(/[\s,]+/).map(parseFloat).filter(isFinite). The table reads each cell with
// parseFloat (toNumbers(rows, 0, parseFloat)). AREMA arema_spacings is TEXT, read by parseSpacings():
//   input.split(',').map(s => parseFloat(s.trim())).filter(v => v > 0), one value = uniform.
const nliParse = s => s.split(/[\s,]+/).map(x => parseFloat(x)).filter(x => isFinite(x));
const aremaVals = s => s.split(',').map(x => parseFloat(x.trim())).filter(v => v > 0);
test('index.html: GFS number lists stay arrays; cells read with parseFloat give what the old box gave', () => {
  for (const a of [[10, 20, 30, 40, 50], [2.5, 5.5], [5, 12, 18, 12, 5], []])
    assert.deepEqual(P(L.toNumbers(L.fromNumbers(a), 0, parseFloat)), a);
  // the same text typed into the old box, or one value per cell into the table
  for (const t of ['5, 12, 18', '5 12 18', '2.5ft, 5.5', '1, abc, 7']) {
    const rows = L.splitPaste(t, 1);            // what a paste / typed separators put into the cells
    assert.deepEqual(P(L.toNumbers(rows, 0, parseFloat)), P(nliParse(t)), t);
  }
});
test('index.html: AREMA girder spacings text round-trips; parseSpacings() reads the same values', () => {
  for (const s of ['', '6', '6, 6, 5.5']) assert.equal(L.toText(L.fromText(s)), s, s);
  for (const s of ['6,6,5.5', ' 6 , 6.5 ', '6,,5.5', '6, 0, 5']) {
    const t = L.toText(L.fromText(s));
    assert.deepEqual(P(aremaVals(t)), P(aremaVals(s)), s);
  }
  assert.equal(L.toText(L.fromText('6,6,5.5')), '6, 6, 5.5');
});

// Stone Masonry Arch Load Rating.html: the line lists are saved TEXT, one entry per line. The paste boxes stay; their tables
// read each line as the tool does and write rows back as "a, b" lines. The tool's readers (copied verbatim) read the same values.
const saPairs = t => { const out = []; for (const ln of (t || '').split(/\n+/)) { const s = ln.trim(); if (!s) continue;
  const m = s.split(/[\s,;]+/).map(Number); if (m.length < 2 || !isFinite(m[0]) || !isFinite(m[1])) throw new Error('bad ' + s); out.push({ x: m[0], y: m[1] }); } return out; };
const saSdl = t => { const out = []; for (const ln of (t || '').split(/\n+/)) { const s = ln.trim(); if (!s) continue; const k = s.lastIndexOf(',');
  out.push({ n: s.slice(0, k).trim() || 'item', w: parseFloat(s.slice(k + 1)) }); } return out; };
const saTracks = t => { const out = []; for (const ln of (t || '').split(/\n+/)) { const s = ln.trim(); if (!s) continue; out.push(parseFloat(s)); } return out.length ? out : [0]; };
// the table side, as in the tool's listTables()
const saRead = (t, line) => String(t || '').split(/\n+/).map(x => x.trim()).filter(Boolean).map(line);
const saPair = l => { const m = l.split(/[\s,;]+/); return [m[0] || '', m[1] || '']; };
const saSdlLine = l => { const k = l.lastIndexOf(','); return k < 0 ? [l, ''] : [l.slice(0, k).trim(), l.slice(k + 1).trim()]; };
const saWrite = rows => L.filled(rows).map(r => r[0] + ', ' + r[1]).join('\n');
test('Stone Arch: survey points / depth overrides — box text -> table rows -> text reads the same pairs', () => {
  for (const t of ['0.0, 0.0\n6.5, 5.0\n13.2, 8.4', '18.0, 19', '0 0\n6.5;5\n  13.2 ,8.4 \n\n40, 0']) {
    const back = saWrite(saRead(t, saPair));
    assert.deepEqual(P(saPairs(back)), P(saPairs(t)), t);
    assert.equal(saWrite(saRead(back, saPair)), back);   // stable
  }
  assert.equal(saWrite(saRead('0.0, 0.0\n6.5, 5.0', saPair)), '0.0, 0.0\n6.5, 5.0');   // the documented form is unchanged
});
test('Stone Arch: SDL line items split at the last comma (descriptions may hold commas)', () => {
  for (const t of ['Sidewalks (2), 800\nRailings (2), 120', 'Rail, steel, 2 sides, 60\nCurbs (2), 300']) {
    const back = saWrite(saRead(t, saSdlLine));
    assert.equal(back, t);
    assert.deepEqual(P(saSdl(back)), P(saSdl(t)));
  }
});
test('Stone Arch: track offsets stay one value per line', () => {
  const f = { rowSplit: /\n+/, rowSep: '\n' };
  for (const t of ['0', '-6\n6', '-6.5\n0\n6.5']) { assert.equal(L.toText(L.fromText(t, f), f), t); assert.deepEqual(P(saTracks(L.toText(L.fromText(t, f), f))), P(saTracks(t))); }
  assert.equal(L.toText(L.fromText('-6\n\n6\n', f), f), '-6\n6');
});
// Prestressed Bridge Design.html: the bridge bar's spans (bridge.spans, an ARRAY). The old box committed
//   v = text.split(/[,;\s]+/).filter(Boolean).map(Number), kept only when every v is finite and > 0;
// the table commits rows.map(r => Number(r[0])) with the same rule.
const pbdOld = t => { const v = t.split(/[,;\s]+/).filter(Boolean).map(Number); return v.length && v.every(x => isFinite(x) && x > 0) ? v : null; };
const pbdNew = rows => { const v = L.filled(rows).map(r => Number(r[0])); return v.length && v.every(x => isFinite(x) && x > 0) ? v : null; };
test('Prestressed Bridge Design: spans rows commit the same array as the old box (or nothing)', () => {
  for (const a of [[100], [100, 120, 100], [87.5, 110.25]]) assert.deepEqual(P(pbdNew(L.fromNumbers(a))), a);
  for (const t of ['100, 120, 100', '100 120 100', '100;120', '100, 0', '100, abc', '']) {
    assert.deepEqual(P(pbdNew(L.splitPaste(t, 1))), P(pbdOld(t)), t);
  }
});

// BasePlateAnchorDesigner.html: S.vRebar.vDepths is saved TEXT ("3, 6.5, 10"; "" = automatic). The table reads it with the tool's
// own separators and writes rows joined by ", "; the tool's reader (copied verbatim) reads the same depths.
const bpDepths = s => String(s || '').split(/[,;\s]+/).map(parseFloat).filter(v => isFinite(v) && v >= 0);
test('BasePlateAnchorDesigner: stacked hairpin depths text round-trips; the reader gets the same depths', () => {
  const f = { rowSplit: /[,;\s]+/ };
  for (const s of ['', '3', '3, 6.5, 10']) assert.equal(L.toText(L.fromText(s, f)), s, s);
  for (const s of ['3 6.5 10', '3;6.5;10', '3,,6.5', ' 3 , 6.5 ']) {
    const t = L.toText(L.fromText(s, f));
    assert.deepEqual(P(bpDepths(t)), P(bpDepths(s)), s);
  }
});
