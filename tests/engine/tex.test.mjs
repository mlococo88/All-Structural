// Every worked step's TeX parses in KaTeX (shared/steps.js renders sym, eq, sub and unit with KaTeX when the page has it,
// apps/steel-bridge/index.html). The steps are the ones the other engine tests make from their fixtures (tests/projects/sbd2-*,
// the 100 tests/projects/st/gd_*.json payloads, the default project), recorded by harness.mjs; run.mjs runs the files in name
// order, so this file runs last. KaTeX is the copy tests/libs already serves to the browser tests (the version the page pins).
// Run alone (node tests/engine/run.mjs tex), nothing is recorded: the test then fails and says to run the whole suite.
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { loadShared, test, ROOT, stepTex } from './harness.mjs';

const katex = createRequire(import.meta.url)(path.join(ROOT, 'tests/libs/katex@0.16.9/dist/katex.min.js'));
const W = loadShared('units.js', 'steps.js');

// what the page hands to KaTeX: sym, eq and sub as they are; a unit through SharedSteps.unitTeX
const src = (t, field) => field === 'unit' ? W.SharedSteps.unitTeX(t) : t;
// the page's options (SharedSteps.katexOpt), but throwing; strict: 'error' also fails a string KaTeX would only warn about (e.g. a non-ASCII character in math mode)
const parse = t => katex.renderToString(t, { ...W.SharedSteps.katexOpt, throwOnError: true, strict: 'error' });

test('KaTeX: the notation of shared/steps.js (README "Worked steps") parses', () => {
  ['\\bar{y}', '\\bar{y}_{s}', 'M_{p}', 'I^{2}', '\\frac{\\sum A y}{\\sum A}', '\\sqrt{\\frac{E}{F_{yc}}}', '\\text{if } x', '\\gamma \\phi \\lambda \\beta \\rho',
    'a \\cdot b \\times c', 'a \\le b \\ge c \\lt d \\gt e \\ne f', 'a \\pm b', 'a \\minus b', "f\\prime_{c}", '1\\,234', '1{,}234', '\\max(a, b)']
    .forEach(t => assert.doesNotThrow(() => parse(t), t));
  ['in', 'in^{2}', 'kip-ft', 'kip/ft', 'ksi', 'kcf', 'k/ft', ''].forEach(u => assert.doesNotThrow(() => parse(src(u, 'unit')), u));
});

test('KaTeX: every step string from the engine tests parses (no parse errors)', () => {
  assert.ok(stepTex.size > 0, 'no steps recorded: run the whole suite (node tests/engine/run.mjs), this test checks what the others make');
  const bad = [];
  for (const { tex, id, field } of stepTex.values()) {
    try { parse(src(tex, field)); } catch (e) { bad.push(`${id} ${field}: ${tex}\n         ${String(e.message).split('\n')[0]}`); }
  }
  console.log(`       ${stepTex.size} distinct step strings (digits folded) parsed with KaTeX ${katex.version}`);
  assert.equal(bad.length, 0, `${bad.length} step string(s) KaTeX cannot parse:\n       ${bad.slice(0, 40).join('\n       ')}`);
});
