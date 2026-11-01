// "Light Pole and Sign Post.html": the tool's own engine functions, taken from the text of its inline script and run in a
// Node vm, for the engine tests (tests/engine/lightpole*.test.mjs). Nothing of the page's UI is loaded.
// Same method as gd-source.mjs: a declaration is pulled in by name on first use (a line at column 0 starting
// `function NAME(` / `const NAME =` / `let NAME =` / `var NAME =`, up to the next line at column 0 that is not a closing
// bracket), and the call is retried on "X is not defined".
// The page globals the engine reads (isoFac, constraint, anchRe, cablesEnabled, ...) are the page's own `let` lines, pulled in
// the same way; set them with lp.set('anchRe', 'no'). `$` is a stub that finds no element (lppApplyGf writes a note to the
// page only when the element exists), and fmt is the page's own. let/const declarations are run as var (see add()).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './harness.mjs';

export const LP_FILE = path.join(ROOT, 'Light Pole and Sign Post.html');

export function lpSourceText(file = LP_FILE) {
  const html = fs.readFileSync(file, 'utf8');
  const out = []; const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/g; let m;
  while ((m = re.exec(html))) { if (m[1] && /\ssrc=/.test(m[1])) continue; out.push(m[2]); }
  return '\n' + out.join('\n');
}

export function lpDecl(src, name) {
  const esc = name.replace(/\$/g, '\\$');
  const re = new RegExp(`\\n(?:async )?(?:function\\*? ${esc}\\s*\\(|const ${esc}\\s*=|let ${esc}\\s*=|var ${esc}\\s*=)`);
  const m = re.exec(src); if (!m) return null;
  const lines = src.slice(m.index + 1).split('\n'), out = [lines[0]];
  for (let i = 1; i < lines.length; i++) { const L = lines[i]; if (L === '' || /^[\s})\]]/.test(L)) out.push(L); else break; }
  while (out.length && out[out.length - 1].trim() === '') out.pop();
  return out.join('\n');
}

// lpEngine(): a fresh context. run(fnOrCode) evaluates in the context with the retry; call(name, ...args) calls a page function.
export function lpEngine(file = LP_FILE) {
  const src = lpSourceText(file);
  const ctx = { console, Math, JSON }; vm.createContext(ctx);
  vm.runInContext('var $ = () => null; var document = { getElementById: () => null, querySelectorAll: () => [] }; var window = this;', ctx);
  const loaded = new Set();
  const add = name => {
    if (loaded.has(name)) return false;
    const d = lpDecl(src, name); if (!d) throw new Error(`Light Pole declaration not found: ${name}`);
    // let/const run as var: a global object property is seen by functions compiled earlier, a late global `let` is not (V8)
    loaded.add(name); vm.runInContext(d.replace(/^(?:let|const) /, 'var '), ctx, { filename: `Light Pole and Sign Post.html (${name})` }); return true;
  };
  const run = code => {
    for (let k = 0; k < 400; k++) {
      try { return vm.runInContext(code, ctx); }
      catch (e) {
        const m = /^(\w+) is not defined/.exec((e && e.message) || '');
        if (!m || !add(m[1])) throw e;
      }
    }
    throw new Error('too many missing declarations');
  };
  // constants read by methods of returned objects (called outside run(), so not retried)
  ['RAD', 'fmt', 'COMBOS', 'WIND_DIRS', 'F1554', 'BAR_TABLE'].forEach(add);
  let n = 0;
  const call = (name, ...args) => { const k = `__a${n++}`; ctx[k] = args; try { return run(`${name}(...${k})`); } finally { delete ctx[k]; } };
  const set = (name, value) => { run(name); ctx.__v = value; vm.runInContext(`${name} = __v`, ctx); delete ctx.__v; };
  return { ctx, src, run, call, set, add, loaded };
}

// The page's default inputs (the values in its input fields and its initial globals) as the inp object calc() builds,
// for the light-pole mode (mode 'pole'), before calc() derives H for a sign, the taper mirror and G_f. Keep in step with
// calc() when an input is added.
export function lpDefaultInp(over = {}) {
  return Object.assign({
    V: 115, expo: 'C', Kzt: 1.0, Kd: 1.0, KdSign: 0.85, KdMode: 'auto', G: 0.85, beta: 0.005,
    H: 35, cfLum: 1.1, poleShape: 'round', poleDiaTop: 6.0, poleDiaBase: 10.0, poleDepthTop: 4.0, poleDepthBase: 4.0, cfPole: 0.7, DL: 0,
    poleTwTop: 0.1875, poleTwBase: 0.25, poleFy: 50, poleDen: 490,
    tIce: 0.5, iceDen: 56, Vice: 50, cfCable: 1.1, cableMethod: 'sag', cableE: 29000,
    shaftShape: 'round', soilClass: 'sand', bromsSoil: 'none', bromsC: 1.0, bromsPhi: 30, bromsGam: 0.115, bromsPhiR: 1.0, bromsOL: 1.0,
    rebarMode: 'auto', manBarSize: '#8', manBarN: 8, manTieBar: '#3', manTieS: 12,
    b: 3.0, S1: 150, qAllow: 2.0, fc: 4000, fy: 60000, cover: 3.0, minSteel: 'half',
    boltDia: 1.0, boltGrade: 55, boltQty: 6, boltBC: 16, boltTheta: 0, boltHef: 18, bpDia: 20, anchTq: 'torqued', splitRe: 'no',
    mode: 'pole', signPosts: 1, signB: 12, signS: 6, signClr: 10, signWt: 400, signSpacing: 8, signCfMode: 'auto', signCfMan: 1.2,
    poleTaper: true,
  }, over);
}
