// PS Bridge PR 2a (docs/ps-bridge-plan.md §3.1): every apps/ps-bridge/engine/pbd-*.js file is its slice of "Prestressed Bridge Design.html" at
// the pinned commit, byte for byte (the code below its PBD-VERBATIM line), with the header that names the source, the commit and the lines;
// the slices do not overlap and cover the old page's window.PBD block and the whole engine part of its text/babel block (lines 2429-4629);
// each file is valid on its own as a classic script; the page loads them in source order, before engine/model.js. Pin and slices:
// tests/engine/psbridge-source.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { test, ROOT } from './harness.mjs';
import { SLICES, PIN, ENGINE, MARK, pinText, sliceText, bodyOf, header } from './psbridge-source.mjs';

test('each pbd-*.js file = header + its slice of the pinned old page, byte for byte', () => {
  for (const s of SLICES) {
    const t = fs.readFileSync(path.join(ENGINE, s.file), 'utf8');
    assert.equal(t.split(MARK).length, 2, `${s.file}: one PBD-VERBATIM line`);
    assert.ok(bodyOf(t) === sliceText(s), `${s.file}: the code differs from lines ${s.from}-${s.to} of the old page at ${PIN}`);
    assert.equal(t.slice(0, t.indexOf(MARK) + MARK.length), header(s), `${s.file}: header`);
    assert.ok(t.includes(`lines ${s.from}-${s.to} of "Prestressed Bridge Design.html" at commit ${PIN}`));
  }
});

test('the slices: in order, no overlap, the whole window.PBD block and the whole engine part of the text/babel block', () => {
  const lines = pinText().split('\n');
  for (let i = 1; i < SLICES.length; i++) assert.ok(SLICES[i].from > SLICES[i - 1].to, SLICES[i].file);
  assert.equal(lines[1900], '<script>'); assert.equal(lines[2420], '</script>');                     // window.PBD block: 1902-2420 inside its tags
  assert.equal(lines[2421], '<script type="text/babel" data-presets="env,react">');
  const eng = SLICES.filter(s => s.from >= 2429 && s.to <= 4629);
  assert.equal(eng[0].from, 2429); assert.equal(eng[eng.length - 1].to, 4629);
  for (let i = 1; i < eng.length; i++) assert.equal(eng[i].from, eng[i - 1].to + 1, 'gap before ' + eng[i].file);
  assert.match(lines[2428], /GIRDER LIBRARY/); assert.match(lines[4629], /UI PRIMITIVES/);              // the lines just inside / outside the engine part
  assert.deepEqual(lines.slice(2422, 2428).filter(l => l.trim() && !l.startsWith('/*')),                 // the babel lines not moved: React / BridgeLocks UI glue
    ['const {useState,useMemo,useEffect,useRef} = React;', 'const BL=window.BridgeLocks||null;', 'const BLU=(BL&&BL.ui&&BL.ui(React))||{};', "const LOCK_APP='psbeam';"]);
  const m = SLICES.find(s => s.file === 'pbd-merge.js');
  assert.match(lines[m.from + 1], /^function mergeInputs\(p\)\{/); assert.equal(lines[m.to - 1], '}'); assert.equal(lines[m.to], '');
});

test('each file compiles alone as a classic script; the page loads them first, in source order, as classic scripts', () => {
  for (const s of SLICES) new vm.Script(fs.readFileSync(path.join(ENGINE, s.file), 'utf8'), { filename: s.file });
  const html = fs.readFileSync(path.join(ROOT, 'apps/ps-bridge/index.html'), 'utf8');
  const list = [...html.matchAll(/^\s*'([^']+\.js)',?/gm)].map(m => m[1]);
  assert.deepEqual(list.slice(0, SLICES.length), SLICES.map(s => 'engine/' + s.file));
  assert.equal(list[SLICES.length], 'engine/model.js');
});
