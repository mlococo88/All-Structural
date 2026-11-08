// shared/steps.js + shared/report.js: list notes (SNL, 2026-11-08). A worked step's note may be a structured value
// { lead, items: [[lead, text] | text, …], action? } instead of a string: on screen and in print it is a bold lead and a bullet list
// with bold lead words (the action line first, in warning style); in the plain text (SharedReport.text, also with { legacy: true })
// the step's line and then "lead" and "• lead: text" lines. A string note renders exactly as before.
import assert from 'node:assert/strict';
import { loadShared, test } from './harness.mjs';

const W = loadShared('units.js', 'steps.js', 'report.js'), S = W.SharedSteps, R = W.SharedReport;
const LIST = { action: 'Decision (pending engineer review): the limit is the user’s.', lead: 'How the deflection is checked:',
  items: [['Limit:', 'L/360 for L only (Table 1604.3).'], ['Load basis', 'service; see §a.'], 'One more fact, 2.50 in.'] };
const model = note => ({ title: 'T', sections: [{ id: 's', title: 'S', subs: [{ id: 'q', title: 'Q', items: [{ type: 'steps', scope: 'x', steps: [
  S.step({ id: 'a', label: 'First', sym: 'a', eq: '', sub: '', value: 1.5, unit: 'in', d: 2 }),
  S.step({ id: 'b', label: 'Second', sym: 'b', eq: '2a', sub: '2 \\times 1.50', value: 3, unit: 'in', d: 2, note })] }] }] }] });

test('noteParts / noteSep / noteText', () => {
  assert.equal(S.noteParts('a string'), null);
  assert.equal(S.noteParts(undefined), null);
  assert.equal(S.noteParts(['x']), null);
  assert.deepEqual(JSON.parse(JSON.stringify(S.noteParts(LIST))), { action: [LIST.action], lead: LIST.lead,
    items: [['Limit:', 'L/360 for L only (Table 1604.3).'], ['Load basis', 'service; see §a.'], ['', 'One more fact, 2.50 in.']] });
  assert.deepEqual(JSON.parse(JSON.stringify(S.noteParts({ lead: 'L', items: [['', ''], 'x'], action: ['A1', '', 'A2'] }))), { action: ['A1', 'A2'], lead: 'L', items: [['', 'x']] });
  assert.equal(S.noteSep('Limit:'), ' '); assert.equal(S.noteSep('Load basis'), ': '); assert.equal(S.noteSep('Why?'), ' ');
  assert.equal(S.noteText('plain'), 'plain');
  assert.equal(S.noteText(LIST), [LIST.action, LIST.lead, '• Limit: L/360 for L only (Table 1604.3).', '• Load basis: service; see §a.', '• One more fact, 2.50 in.'].join('\n'));
  // step() keeps the note object as given
  assert.equal(S.step({ id: 'z', label: 'z', note: LIST }).note, LIST);
});

test('report HTML: a list note is the action line, a bold lead and a bullet list; "§id" in it is a link', () => {
  const d = R.build(model(LIST)), h = R.html(d, { lazy: false });
  assert.equal(d.unresolved.length, 0);
  const nt = h.slice(h.indexOf('<div class="rp-nt rp-ntl">')); assert.ok(nt.length > 0);
  assert.match(nt, /^<div class="rp-nt rp-ntl"><div class="rp-nta">Decision \(pending engineer review\): the limit is the user’s\.<\/div><div class="rp-ntb">How the deflection is checked:<\/div><ul class="rp-ntu"><li><b>Limit:<\/b> L\/360 for L only \(Table 1604\.3\)\.<\/li><li><b>Load basis<\/b>: service; see <a href="#[^"]+" class="rp-see rp-seen" data-rpjump="x\/a">§1\.1<\/a>\.<\/li><li>One more fact, 2\.50 in\.<\/li><\/ul><\/div>/);
  // every fact and digit of the note is in the HTML, in order
  const txt = h.replace(/<[^>]+>/g, ''), facts = ['Decision (pending engineer review)', 'How the deflection', 'L/360', '1604.3', 'Load basis', '§1.1', '2.50 in.'];
  let at = txt.indexOf('Second'); facts.forEach(f => { const k = txt.indexOf(f, at); assert.ok(k > at, f); at = k; });
});

test('report HTML and text: a string note is unchanged (one italic line; " (note)" after the line)', () => {
  const note = 'A plain remark; see §a.', d = R.build(model(note)), h = R.html(d, { lazy: false });
  assert.ok(h.includes('<div class="rp-nt">A plain remark; see <a href="#'), h);
  assert.ok(!h.includes('rp-ntl'));
  const t = R.text(d).split('\n'), k = t.findIndex(l => l.startsWith('  Second'));
  assert.equal(t[k], '  Second: b = 2a = 2 × 1.50 = 3.00 in (A plain remark; see §1.1.)');
  assert.equal(R.text(d, { legacy: true }).split('\n')[k], '  Second: b = 2a = 2 × 1.50 = 3.00 in (A plain remark; see §1.1.)');
});

test('report text: a list note is "lead" then "• lead: text" lines under the step (also with legacy)', () => {
  const d = R.build(model(LIST));
  for (const o of [undefined, { legacy: true }]) {
    const t = R.text(d, o).split('\n'), k = t.findIndex(l => l.startsWith('  Second'));
    assert.deepEqual(t.slice(k, k + 6), ['  Second: b = 2a = 2 × 1.50 = 3.00 in',
      '    Decision (pending engineer review): the limit is the user’s.', '    How the deflection is checked:',
      '    • Limit: L/360 for L only (Table 1604.3).', '    • Load basis: service; see §1.1.', '    • One more fact, 2.50 in.']);
    assert.ok(!/\[object|undefined|NaN/.test(t.join('\n')));
  }
});

test('report: a list note without action or lead; an action given as a list', () => {
  const d = R.build(model({ items: [['A', 'one'], ['B', 'two']] })), h = R.html(d, { lazy: false });
  assert.ok(h.includes('<div class="rp-nt rp-ntl"><ul class="rp-ntu"><li><b>A</b>: one</li><li><b>B</b>: two</li></ul></div>'));
  const d2 = R.build(model({ action: ['Input needed: E.', 'REVIEW: I.'], lead: 'Lead.' })), h2 = R.html(d2, { lazy: false });
  assert.ok(h2.includes('<div class="rp-nt rp-ntl"><div class="rp-nta">Input needed: E.</div><div class="rp-nta">REVIEW: I.</div><div class="rp-ntb">Lead.</div></div>'));
});
