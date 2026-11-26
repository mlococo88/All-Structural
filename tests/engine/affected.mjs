#!/usr/bin/env node
// Which engine test files a branch's changes affect (test-trim, 2026-11-26). Prints one tests/engine/*.test.mjs file name per line.
//   node tests/engine/affected.mjs                      changes in origin/main...HEAD (what the branch adds to main)
//   node tests/engine/affected.mjs <git range>          e.g. HEAD~3..HEAD, abc123^..abc123
//   node tests/engine/affected.mjs --why [<range>]      also lists, on stderr, each changed path and the files it maps to
//   node tests/engine/run.mjs $(node tests/engine/affected.mjs)
//
// Use: for a PR that touches one app only, the pre-merge full run may be
//   node tests/engine/run.mjs $(node tests/engine/affected.mjs)
// A change to shared code runs everything (CLAUDE.md §3: every tool that loads a shared file); this script then prints every file.
// It prints nothing when no engine test is affected (documentation only); run.mjs given no file names runs every file, so the
// command above then runs the whole suite. Browser smokes (tests/smoke) are not covered: run the changed tool's smokes as before.
//
// How a changed path maps (conservative: when a path cannot be placed, every file is printed):
//   - shared/**, tests/engine/harness.mjs, run.mjs, this file, tests/libs/**             -> every test file
//   - apps/<tool>/**                     -> the test files that load or read that app: their own source, or a local helper module
//                                           they import (./ad-fixture.mjs, ./psbridge-source.mjs, ../lib.mjs, ...), names
//                                           apps/<tool> (or path.join(ROOT, 'apps', '<tool>', ...)); plus ALWAYS below
//   - a root tool page (e.g. "Timber Beam Check.html", lldf.html) or archive/** -> the test files whose source (with helpers)
//                                           names the file (the archived Steel Bridge Design: SBD_ARCHIVE); plus ALWAYS
//   - tests/engine/<x>.test.mjs          -> that file, and the test files that import it
//   - tests/engine/<helper>.mjs, tests/lib.mjs, other files under tests/engine -> the test files that import or name it; none -> every file
//   - tests/projects/<dir>/**            -> the test files that name the file or its folder; none -> every file
//   - tests/baselines/**                 -> the test files that name the file; none -> no engine test (browser-script baselines)
//   - *.md, fixlog/**, docs/**, tests/smoke/**, tests/*.mjs browser scripts, .github/** -> no engine test, unless one reads the file
//                                           (its name in quotes: psbridge-handoffs.test.mjs reads 'HANDOFF.md'; a comment citing a fixlog does not count)
//   - anything else                      -> the test files that name it; none -> every file
// ALWAYS (any tool page change): project-registry.test.mjs (it reads every tool's page and app files through shared/project-registry.js).
// tex.test.mjs parses the worked steps the other files of the same run record, so it is added whenever a selected file loads
// shared/steps.js (alone it has nothing to check and fails).
// The mapping reads what each test file actually loads (loadShared / path.join / readFileSync arguments in its source and its
// local helper modules), not the file names: e.g. legacy.test.mjs loads apps/steel-bridge, so a steel-only diff includes it.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..', '..');
const args = process.argv.slice(2), why = args.includes('--why');
const range = args.filter(a => a !== '--why')[0] || 'origin/main...HEAD';
const note = s => { if (why) process.stderr.write(s + '\n'); };

const TESTS = fs.readdirSync(DIR).filter(f => f.endsWith('.test.mjs')).sort();
const ALWAYS = ['project-registry.test.mjs'].filter(f => TESTS.includes(f));
const TEX = 'tex.test.mjs';

// each test file's source plus the local modules it imports (transitively; harness.mjs excluded: every file imports it, and a change to it runs all)
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');
const SBD_ARCHIVE_FILE = (/SBD_ARCHIVE_FILE\s*=\s*'([^']+)'/.exec(fs.readFileSync(path.join(DIR, 'harness.mjs'), 'utf8')) || [])[1] || 'archive/';
const deps = {};   // test file -> { text, mods: Set of repo-relative module paths }
for (const t of TESTS) {
  const mods = new Set(), parts = [], todo = [path.join(DIR, t)];
  while (todo.length) {
    const p = todo.pop(); if (mods.has(rel(p)) || !fs.existsSync(p)) continue;
    mods.add(rel(p)); const src = fs.readFileSync(p, 'utf8'); parts.push(src);
    for (const m of src.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const q = path.resolve(path.dirname(p), m[1]); if (path.basename(q) !== 'harness.mjs') todo.push(q);
    }
  }
  let text = parts.join('\n');
  if (/\bSBD_ARCHIVE(_FILE)?\b/.test(text)) text += '\n' + SBD_ARCHIVE_FILE;   // the archived Steel Bridge Design, through harness.mjs
  deps[t] = { text, mods };
}
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const naming = re => TESTS.filter(t => re.test(deps[t].text));
const namingStr = s => TESTS.filter(t => deps[t].text.includes(s));

let changed;
try {
  changed = execFileSync('git', ['-C', ROOT, 'diff', '--name-only', '--no-renames', '-z', range], { encoding: 'utf8', maxBuffer: 1 << 26 }).split('\0').filter(Boolean);
} catch (e) {
  process.stderr.write(`affected.mjs: git diff ${range} failed (${String(e.message).split('\n')[0]}); run the whole suite: node tests/engine/run.mjs\n`);
  process.exit(1);
}

const out = new Set(); let all = false;
const add = (p, list, how) => { list.forEach(f => out.add(f)); note(`  ${p}  ->  ${how}${list.length ? ': ' + list.join(' ') : ''}`); };
for (const p of changed) {
  const base = path.posix.basename(p), top = p.split('/')[0];
  if (top === 'shared' || p.startsWith('tests/libs/') || ['tests/engine/harness.mjs', 'tests/engine/run.mjs', 'tests/engine/affected.mjs'].includes(p)) { all = true; note(`  ${p}  ->  ALL (shared code or the test runner)`); continue; }
  if (top === 'apps') {
    const app = p.split('/')[1];
    const list = naming(new RegExp(`apps(?:/|['"\`]\\s*,\\s*['"\`])${esc(app)}(?![A-Za-z0-9_-])`));
    add(p, [...list, ...ALWAYS], `app ${app}` + (list.length ? '' : ' (no engine test loads it; run its browser smokes)')); continue;
  }
  if (p.startsWith('tests/engine/') && p.endsWith('.test.mjs')) {
    add(p, [...(TESTS.includes(base) ? [base] : []), ...TESTS.filter(t => t !== base && deps[t].mods.has(p))], 'test file (and the files importing it)'); continue;
  }
  // documentation: only a test that reads the file (its name in quotes, e.g. psbridge-handoffs.test.mjs reads 'HANDOFF.md'); a comment citing
  // fixlog/<tool>.md does not count
  const docs = /\.md$/i.test(p) || ['fixlog', 'docs', '.github'].includes(top) || /^tests\/smoke\//.test(p) || /^tests\/[^/]+\.mjs$/.test(p) && p !== 'tests/lib.mjs' || p === '.gitignore';
  if (docs) {
    const list = TESTS.filter(t => deps[t].mods.has(p) || new RegExp(`['"\`/]${esc(p.includes('/') && !/\.md$/i.test(p) ? p : base)}['"\`]`).test(deps[t].text));
    if (list.length) add(p, list, 'read by'); else note(`  ${p}  ->  none (documentation / browser scripts)`);
    continue;
  }
  // every other path: the test files that import it or name it
  let list = TESTS.filter(t => deps[t].mods.has(p) || deps[t].text.includes(p) || deps[t].text.includes(base));
  const pm = /^tests\/(projects|baselines)\/([^/]+)\//.exec(p);
  if (pm) list = [...new Set([...list, ...namingStr(`tests/${pm[1]}/${pm[2]}`),
    ...TESTS.filter(t => deps[t].text.includes(`tests/${pm[1]}`) && new RegExp(`['"\`/]${esc(pm[2])}['"\`/]`).test(deps[t].text))])];
  const rootTool = !p.includes('/') && /\.html$/i.test(p);
  if (rootTool || top === 'archive') { add(p, [...list, ...ALWAYS], rootTool ? 'tool page' : 'archived page'); continue; }
  if (list.length) { add(p, list, 'named by'); continue; }
  if (/^tests\/baselines\//.test(p)) { note(`  ${p}  ->  none (a browser-script baseline no engine test names)`); continue; }
  all = true; note(`  ${p}  ->  ALL (not mapped)`);
}

let files = all ? [...TESTS] : TESTS.filter(f => out.has(f));
if (!all && files.some(f => f !== TEX && /['"`]steps\.js['"`]/.test(deps[f].text)) && TESTS.includes(TEX) && !files.includes(TEX)) files.push(TEX);
files = TESTS.filter(f => files.includes(f));
note(`affected.mjs: ${changed.length} changed path(s) in ${range}; ${files.length} of ${TESTS.length} test file(s)${all ? ' (ALL)' : ''}`);
if (files.length) process.stdout.write(files.join('\n') + '\n');
