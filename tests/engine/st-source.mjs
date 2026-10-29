// ST-Girder's own engine (the Design & Rating view), taken from the st-src block of "Steel Bridge Design.html" and run in a Node vm,
// for parity tests (added 2026-10-29 for tests/engine/rating.test.mjs). Nothing of ST-Girder's UI runs: its text/babel script is
// compiled with the repository's Babel copy (tests/libs/babel-standalone@7.23.5, React preset only), with React, ReactDOM, the DOM
// and localStorage stubbed, and without its last line (the createRoot(...).render of the App).
//
// stSession(payload): the session ST-Girder holds after a GirderDetail hand-off is applied on a fresh page (DEFAULTS, then gdAdopt
// exactly as the page runs it: its own gdCheck and gdAdopt text, taken from the App component, with setInp capturing the result).
// stCompute(session): computeAll(session).
// Embedded, ST-Girder uses GirderDetail's loadShedRbG and webFcrw from the host page while a hand-off is in use (S2-2, stHost): they
// are supplied here as window.parent from GirderDetail's own text (tests/engine/gd-source.mjs gdDecl, pulled in on demand).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { ROOT } from './harness.mjs';
import { gdRun } from './gd-source.mjs';

let ST = null;
function stText() {
  const html = fs.readFileSync(path.join(ROOT, 'Steel Bridge Design.html'), 'utf8');
  const a = html.indexOf('<script type="text/plain" id="st-src">'); if (a < 0) throw new Error('st-src not found');
  const b = html.indexOf('</script>', a);
  return html.slice(a, b).replace(/<\\(\\*)(\/script|!--)/gi, '<$1$2');   // the page's stSrc() unescaping
}
const between = (s, a, b) => { const i = s.indexOf(a); if (i < 0) throw new Error('anchor not found: ' + a.slice(0, 60)); const j = s.indexOf(b, i + a.length); if (j < 0) throw new Error('anchor not found: ' + b.slice(0, 60)); return s.slice(i, j); };

export function stEngine() {
  if (ST) return ST;
  const src = stText(), tag = '<script type="text/babel" data-presets="env,react">';
  let js = between(src, tag, '</script>').slice(tag.length);
  const last = "ReactDOM.createRoot(document.getElementById('root')).render(<App/>);";
  if (!js.includes(last)) throw new Error('ST-Girder render line not found'); js = js.replace(last, '');
  // Rating trace (tests/engine/rating.test.mjs): every rating ST-Girder computes, with its own capacity and demands, recorded in
  // globalThis.__RT while it is set (stTrace). Additions only, after each statement: nothing ST-Girder computes is changed. Stress
  // basis: the dead-load stresses unfactored by stage (stageF with unit factors), and the utilities as ST-Girder factors them (the
  // remainder of its factored stress).
  const TR = [
    ['inv=rf(cap,mDC,mDW,st.Ml,1.75); opr=rf(cap,mDC,mDW,st.Ml,1.35);',
      "if(globalThis.__RT) __RT.flex.push({x:st.x,basis:'Mp',C:cap,DC:mDC,DW:mDW,LL:st.Ml,inv,opr});"],
    ['opr=Math.min(rfStress(sg.FncPos,fd.fT,fl.fT,1.35), rfStress(sg.Fnt,fd.fB,fl.fB,1.35));',
      "if(globalThis.__RT){ const a=stageF(st,1,1,0,0,false,null).pos, b=stageF(st,0,0,1,0,false,null).pos; __RT.flex.push({x:st.x,basis:'stress',phi:phiCS*phif,Fc:sg.FncPos,Ft:sg.Fnt,fd:fd,fl:fl,dc:a,dw:b,u:{fT:fd.fT-1.25*a.fT-1.5*b.fT,fB:fd.fB-1.25*a.fB-1.5*b.fB},inv,opr}); }"],
    ['const inv=rf(cV,dc,dw,ll,1.75);',
      "if(globalThis.__RT) __RT.shear.push({x:st.x,C:cV,Vn,phi:phiCS*phiv,DC:dc,DW:dw,LL:ll,inv,opr:rf(cV,dc,dw,ll,1.35)});"],
    ['      rating.negX=stN.x;',
      "      if(globalThis.__RT){ const a=stageF(stN,1,1,0,0,false,null).neg.fB, b=stageF(stN,0,0,1,0,false,null).neg.fB; __RT.neg.push({x:stN.x,phi:phiCS*phif,Fnc:sgN.FncNeg.Fnc,fPerm,fLL1,dc:a,dw:b,u:fPerm-1.25*a-1.5*b,inv:rating.negInv,opr:rating.negOpr}); }"],
    ['if(!(Math.abs(fl)>1e-6)) return; const sgn=Math.sign(fl), base=(fR-sgn*fd)/Math.abs(fl);',
      "if(globalThis.__RT){ const k=tag.slice(0,3)==='bot'?'fB':'fT', ng=tag.indexOf('−')>0, u=ng?un:up; __RT.serv.push({x:st.x,tag,fR,fd,fl,dc:s.parts.dc[k]+s.parts.d2[k],dw:s.parts.dw[k],u:u?u[k]:0,inv:base/1.30,opr:base/1.00}); }"],
  ];
  TR.forEach(([a, b]) => { const n = js.split(a).length - 1; if (n !== 1) throw new Error(`rating trace anchor found ${n} times: ${a.slice(0, 50)}`); js = js.replace(a, a + b); });
  const require = createRequire(import.meta.url);
  const Babel = require(path.join(ROOT, 'tests/libs/babel-standalone@7.23.5/babel.min.js'));
  const code = Babel.transform(js, { presets: ['react'], sourceType: 'script', compact: false }).code;
  // GirderDetail host functions (stHost): the parent window
  const gdCtx = { console }; vm.createContext(gdCtx);
  vm.runInContext('var P = { df: { bridge: {} } }; var GM = {};', gdCtx);
  const gdLoaded = new Set();
  const host = name => (...a) => gdRun(gdCtx, c => c[name](...a), gdLoaded, 'STH');
  const parent = { loadShedRbG: host('loadShedRbG'), webFcrw: host('webFcrw') };
  const store = {}, el = () => ({ style: {}, appendChild() {}, setAttribute() {}, addEventListener() {}, classList: { add() {}, remove() {} } });
  const ctx = {
    console, Math, JSON, Date, Intl,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; }, key: () => null, length: 0 },
    document: { getElementById: () => null, createElement: el, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, head: el(), body: el() },
    location: { pathname: '/stgirder.html', href: 'file:///stgirder.html', hash: '', search: '' }, history: { replaceState() {} },
    addEventListener() {}, removeEventListener() {}, setTimeout: () => 0, clearTimeout() {}, alert() {}, confirm: () => true,
    React: { createElement: () => null, Fragment: 'f', createContext: () => ({ Provider: 'p' }), useState: v => [typeof v === 'function' ? v() : v, () => {}], useMemo: f => f(), useEffect() {}, useRef: v => ({ current: v }), useContext: () => null },
    ReactDOM: { createRoot: () => ({ render() {}, unmount() {} }), createPortal: () => null, flushSync: f => f() },
    navigator: { userAgent: 'node' }, self: { origin: 'null' }, parent,
  };
  ctx.window = ctx; vm.createContext(ctx);
  // the two plain scripts before the babel one (app paths, BridgeXfer), then the engine
  const plain = src.split('<script>').slice(1).map(s => s.slice(0, s.indexOf('</script>')));
  plain.forEach((s, i) => { try { vm.runInContext(s, ctx, { filename: `st-src plain ${i}` }); } catch (e) { /* page-only helpers */ } });
  vm.runInContext(code, ctx, { filename: 'st-src (babel)' });
  // gdCheck and gdAdopt, from the App component, with their constants
  const app = between(code, 'const GD_CH =', 'const pullGD =');
  vm.runInContext(`var __ST_ADOPT = (function(){ let __out = null; const inpRef = { current: null }; const setInp = v => { __out = v; }; const setGdAuto = () => {};
    ${app}
    return p => { inpRef.current = DEFAULTS; __out = null; const ok = gdAdopt(p, 'test', true); return ok ? __out : null; }; })();`, ctx, { filename: 'st-src (gdAdopt)' });
  ST = { ctx, session: p => ctx.__ST_ADOPT(p), compute: inp => ctx.computeAll(inp), DEFAULTS: vm.runInContext('DEFAULTS', ctx) };
  return ST;
}
export const stSession = p => stEngine().session(p);
export const stCompute = inp => stEngine().compute(inp);
/* stTrace(session): computeAll(session) with the rating trace: { R, rt: { flex, shear, neg, serv } } (see TR above) */
export function stTrace(inp) {
  const E = stEngine(), rt = { flex: [], shear: [], neg: [], serv: [] };
  E.ctx.__RT = rt; try { return { R: E.compute(inp), rt }; } finally { E.ctx.__RT = null; }
}
