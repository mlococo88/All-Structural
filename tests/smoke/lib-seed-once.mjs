#!/usr/bin/env node
// tests/lib.mjs openPage(…, { ls }) (SEED1, 2026-11-14): the localStorage seed is written once, before the first load, and never again in that
// page: a value the page (or the test) writes over a seeded key survives reloads, also when the tab's sessionStorage is lost across a file://
// reload (as Chromium sometimes does: the root cause found in PR #1555; here sessionStorage is cleared on purpose before each reload).
// Before the fix the init script re-seeded whenever its sessionStorage marker was gone: check 2 failed.
//   node tests/smoke/lib-seed-once.mjs
import fs from 'fs';
import os from 'os';
import path from 'path';
import { openPage } from '../lib.mjs';

const dir = path.join(os.tmpdir(), 'allstruct-tests', 'seed-once'); fs.mkdirSync(dir, { recursive: true });
const page = path.join(dir, 'p.html');
fs.writeFileSync(page, '<!doctype html><meta charset="utf-8"><title>seed test</title><body><script>document.body.textContent = localStorage.getItem("seedTest.k") || "none";</script>');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ok   ' : '  FAIL ') + m); };
const o = await openPage(page, { ls: { 'seedTest.k': 'seeded', 'seedTest.other': 'x' } });
try {
  const p = o.p;
  ok(await p.textContent('body') === 'seeded', '1. the seed is in place before the page\'s first script runs');
  await p.evaluate(() => localStorage.setItem('seedTest.k', 'written by the page'));
  let kept = 0;
  for (let i = 0; i < 3; i++) { await p.evaluate(() => sessionStorage.clear()); await p.reload(); if (await p.textContent('body') === 'written by the page') kept++; }
  ok(kept === 3, `2. a later write survives 3 reloads with sessionStorage lost (${kept} of 3)`);
  ok(await p.evaluate(() => localStorage.getItem('seedTest.other')) === 'x', '3. the other seeded key kept');
  ok(o.errs.length === 0, '4. no console errors');
} finally { await o.b.close(); }
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
