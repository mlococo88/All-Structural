// PS Bridge PR 2a (docs/ps-bridge-plan.md §3): the old Prestressed Bridge Design engine, moved unchanged into apps/ps-bridge/engine/pbd-*.js.
// This file is the one place that names the pinned commit and the slices, and that builds the two Node contexts of parity harness A:
//   oldEngine(): today's page code from the text of "Prestressed Bridge Design.html" at PIN: its plain window.PBD <script> run as is, and its
//                text/babel block compiled with the repository's Babel copy (tests/libs/babel-standalone@7.23.5) with the options
//                babel-standalone gives a <script type="text/babel" data-presets="env,react"> (presets env + react in that order, its default
//                plugins, inline source map), the whole block run as the page runs it (UI part included; React/DOM stubbed, nothing rendered);
//   newEngine(): the files apps/ps-bridge/engine/pbd-*.js run as classic scripts in page order (as apps/ps-bridge/index.html loads them).
// Both contexts get the same stand-ins for what the page's other scripts provide: localStorage (empty, in memory), window.BridgeBeam
// (get() returns ctx.__db, null by default) and window.BridgeXfer (sharedProject() returns ctx.__proj, null by default); console calls are
// recorded in ctx.__log.
// The old text: `git show PIN:"Prestressed Bridge Design.html"`; where git history is not available (a shallow copy), the working-tree file
// is used only if its git blob hash equals PIN_BLOB (the old app is frozen from PR 2a on, PS-14 g). Either way the text is checked against PIN_BLOB.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { ROOT } from './harness.mjs';

export const PSBD = 'Prestressed Bridge Design.html';
export const PIN = '8fe8650275b7fc7377fdb87685d3bf0d669a4aa8';          // origin/main when PR 2a was made (PSBD last changed in ff0e090, #916)
export const PIN_BLOB = '00a3a34e1421b28ad12c760d113f597f1a3a7c60';     // git rev-parse PIN:"Prestressed Bridge Design.html"
export const ENGINE = path.join(ROOT, 'apps/ps-bridge/engine');

// The slices, in page order (1-based line numbers of the file at PIN, both ends included). The text/babel block is lines 2423-9750
// (tag on 2422); its engine part (no JSX, no DOM) is 2429-4629. Lines 2423-2427 (React hooks, BridgeLocks) are UI and not moved.
export const SLICES = [
  { file: 'pbd-model.js', from: 1902, to: 2420, what: 'the bridge-level engines window.PBD (the whole plain <script> block between the tags on lines 1901 and 2421): module registry, bridge model psbeam.bridge.v1 and its migration, cells, continuous-unit analysis (threeMoment, contFE, restraint), owner rules (OWN_RULES, ownLoads)' },
  { file: 'pbd-library.js', from: 2429, to: 2536, what: 'girder library GIRDERS, STRANDS, fmt, clamp, bridgeNav, sqrt, DEFAULTS (start of the text/babel block\'s engine part)' },
  { file: 'pbd-section.js', from: 2537, to: 2773, what: 'section geometry: gross and composite properties, overrides, outline, voids, Ec, creep and torsion helpers' },
  { file: 'pbd-strands.js', from: 2774, to: 2871, what: 'strand geometry strandSys (rows, debonding, draped strands), tensionSideArea' },
  { file: 'pbd-losses-ll.js', from: 2872, to: 2965, what: 'prestress losses (5.9.3), HL-93 simple-span live load hl93, negMomentHL93' },
  { file: 'pbd-handling-deck.js', from: 2966, to: 3160, what: 'handling (lifting and hauling stability), deck Table A4-1 and the deck strip design' },
  { file: 'pbd-lldf-flexure.js', from: 3161, to: 3295, what: 'live-load distribution factors distFactors (4.6.2.2), flexure (5.6.3)' },
  { file: 'pbd-external.js', from: 3296, to: 3427, what: 'MIDAS demands buildExternal / externalSpans, superReactions payload bxSuperRxPayload, contUnit' },
  { file: 'pbd-compute.js', from: 3428, to: 4571, what: 'computeAll (every check of one girder design), Aps0, psbReportVals' },
  { file: 'pbd-optimize.js', from: 4572, to: 4629, what: 'optimizeStrands, sweepDesign (end of the text/babel block\'s engine part)' },
  { file: 'pbd-merge.js', from: 8796, to: 8813, what: 'mergeInputs (saved inputs merged onto DEFAULTS; from the old page\'s persistence part, used for the project\'s base design)' },
];
export const MARK = '/* ---- PBD-VERBATIM: the code below is the slice named above, byte for byte; do not edit it ---- */\n';

const gitBlob = t => { const b = Buffer.from(t, 'utf8'); return crypto.createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex'); };
let TEXT = null;
export function pinText() {
  if (TEXT) return TEXT;
  let t = null, src = '';
  try { t = execFileSync('git', ['show', `${PIN}:${PSBD}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] }); src = 'git show'; }
  catch (e) { t = fs.readFileSync(path.join(ROOT, PSBD), 'utf8'); src = 'working tree'; }
  if (gitBlob(t) !== PIN_BLOB) throw new Error(`${PSBD} (${src}) is not the pinned text: blob ${gitBlob(t)}, expected ${PIN_BLOB} (commit ${PIN})`);
  return (TEXT = t);
}
export const sliceText = s => pinText().split('\n').slice(s.from - 1, s.to).join('\n') + '\n';

// The top-level names a slice defines (a line at column 0: function NAME / const NAME / let / var). Recorded in each file's header.
export const topNames = body => [...body.matchAll(/^(?:function\s+([\w$]+)|(?:const|let|var)\s+([\w$]+))/gm)].map(m => m[1] || m[2]);

export function header(s) {
  const body = sliceText(s), names = topNames(body);
  return `/* apps/ps-bridge/engine/${s.file} — ${s.what}.
   MOVED UNCHANGED from the old app (docs/ps-bridge-plan.md §3, PR 2a; engineer decision PS-6): the code below the PBD-VERBATIM line is
   lines ${s.from}-${s.to} of "Prestressed Bridge Design.html" at commit ${PIN}, byte for byte. Do not edit it here: a change to the
   engine is a later PR of its own (CLAUDE.md §4), made with the slice and this header updated together.
   Classic script, no DOM. ${names.length ? `Global names it defines, as on the old page (the moved engine keeps its own globals, plan §2.1; a
   planned later cleanup moves them under one namespace): ${names.join(', ')}.` : 'It defines window.PBD only (its own IIFEs).'}
   Tests: tests/engine/psbridge-verbatim.test.mjs (this body = that slice), tests/engine/psbridge-parity.test.mjs (results = the old page's). */
${MARK}`;
}
export function bodyOf(fileText) { const i = fileText.indexOf(MARK); return i < 0 ? null : fileText.slice(i + MARK.length); }

// ---- the two contexts ----
function baseCtx() {
  const log = [];
  const rec = k => (...a) => log.push([k, a.map(x => { try { return typeof x === 'string' ? x : JSON.stringify(x); } catch (e) { return String(x); } }).join(' ')]);
  const store = new Map();
  const ctx = {
    console: { log: rec('log'), info: rec('info'), warn: rec('warn'), error: rec('error'), debug: rec('debug') },
    localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => { store.set(k, String(v)); }, removeItem: k => { store.delete(k); },
      key: i => [...store.keys()][i] ?? null, get length() { return store.size; } },
    __log: log, __store: store, __db: null, __proj: null,
  };
  ctx.window = ctx; ctx.self = ctx; ctx.top = ctx; ctx.parent = ctx; ctx.globalThis = ctx;
  ctx.BridgeBeam = { get: () => ctx.__db };
  ctx.BridgeXfer = { sharedProject: () => ctx.__proj };
  vm.createContext(ctx);
  ctx.JSON = vm.runInContext('JSON', ctx);   // the context's own JSON (same object), so the tests build inputs in that realm
  return ctx;
}

export function newEngine(opts = {}) {
  const ctx = baseCtx();
  for (const s of SLICES) {
    const p = path.join(ENGINE, s.file);
    let code = fs.readFileSync(p, 'utf8');
    if (opts.strict) code = '"use strict";' + code;   // strict-mode variant (see the parity test): the files must behave the same
    vm.runInContext(code, ctx, { filename: p });
  }
  return ctx;
}

// React / DOM stand-ins for the old page's UI part: enough for its top-level code to run (component definitions, the project-library
// migration in a try, the final createRoot(...).render(<App/>)), nothing rendered.
function uiStubs(ctx) {
  const noop = () => {};
  const el = () => new Proxy({ style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, dataset: {} },
    { get: (o, k) => (k in o ? o[k] : (k === 'then' ? undefined : noop)) });
  ctx.React = { createElement: noop, Fragment: 'Fragment', useState: v => [v, noop], useMemo: f => f(), useEffect: noop, useRef: v => ({ current: v }),
    useCallback: f => f, useLayoutEffect: noop, memo: f => f, forwardRef: f => f, createContext: () => ({ Provider: noop, Consumer: noop }), useContext: noop };
  ctx.ReactDOM = { createRoot: () => ({ render: noop, unmount: noop }), createPortal: noop };
  ctx.document = { getElementById: el, querySelector: el, querySelectorAll: () => [], createElement: el, addEventListener: noop, removeEventListener: noop,
    body: el(), documentElement: el(), head: el() };
  ctx.addEventListener = noop; ctx.removeEventListener = noop; ctx.location = { href: 'file:///x/Prestressed%20Bridge%20Design.html', search: '', hash: '' };
  ctx.navigator = { userAgent: 'node' }; ctx.matchMedia = () => ({ matches: false, addEventListener: noop, removeEventListener: noop });
  ctx.setTimeout = noop; ctx.clearTimeout = noop; ctx.requestAnimationFrame = noop;
}

let BABEL_CODE = null;
export function babelOptions() {   // babel-standalone 7.23.5 transformScriptTags for <script type="text/babel" data-presets="env,react">
  return { filename: 'Inline Babel script', presets: ['env', 'react'], plugins: ['transform-class-properties', 'transform-object-rest-spread', 'transform-flow-strip-types'],
    sourceMaps: 'inline', sourceFileName: 'Inline Babel script' };
}
export function oldBlocks() {
  const t = pinText(), lines = t.split('\n');
  const pbdOpen = lines[SLICES[0].from - 2], pbdClose = lines[SLICES[0].to];
  if (pbdOpen !== '<script>' || pbdClose !== '</script>') throw new Error('PBD block tags not at the pinned lines');
  const tag = '<script type="text/babel" data-presets="env,react">', a = t.indexOf(tag), b = t.indexOf('</script>', a);
  if (a < 0 || t.slice(0, a).split('\n').length !== 2422) throw new Error('text/babel tag not at line 2422');
  return { pbd: lines.slice(SLICES[0].from - 1, SLICES[0].to).join('\n') + '\n', babel: t.slice(a + tag.length, b) };
}
export function oldCompiled() {
  if (BABEL_CODE) return BABEL_CODE;
  const Babel = createRequire(import.meta.url)(path.join(ROOT, 'tests/libs/babel-standalone@7.23.5/babel.min.js'));
  return (BABEL_CODE = Babel.transform(oldBlocks().babel, babelOptions()).code);
}
export function oldEngine() {
  const ctx = baseCtx(); uiStubs(ctx);
  const { pbd } = oldBlocks();
  vm.runInContext(pbd, ctx, { filename: `${PSBD}@${PIN.slice(0, 7)} (window.PBD)` });
  vm.runInContext(oldCompiled(), ctx, { filename: `${PSBD}@${PIN.slice(0, 7)} (text/babel, compiled)` });
  return ctx;
}
