// "Steel Beam Design - AISC 15th.html": run the tool's own Excel export (exportExcel) in Node, for the engine tests.
// The engine is sbeam-source.mjs (the page's functions pulled in by name); added here: the XB sheet writer (its prototype
// methods are assignments at column 0, so they are taken as one block), ExcelJS 4.4.0 from tests/libs (the version the page
// loads from the CDN), browser stubs for the download, and a fixed clock, so the same inputs give the same bytes.
//   const X = sbXlsx(file?);   X.run(setupCode) -> { A, buf, log }
// setupCode: a JS function expression run in the page context after S = defaultState(); computeAll() / computeMember()
// follows (by S.mode). log: every XB call the export made, with its sheet row ({ k: 'band'|'sub'|'line'|'table'|'note'|'eq', r, ... }).
// X.load(buf) reads the written workbook back with ExcelJS (sheet 'Design Calc').
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './harness.mjs';
import { sbEngine, SB_FILE } from './sbeam-source.mjs';

const EXCELJS = path.join(ROOT, 'tests', 'libs', 'exceljs@4.4.0', 'dist', 'exceljs.min.js');
const FIXED = Date.UTC(2026, 10, 13, 17, 0, 0);

export function sbXlsx(file = SB_FILE) {
  const sb = sbEngine(file), c = sb.ctx;
  Object.assign(c, { setTimeout, clearTimeout, setImmediate, queueMicrotask, Promise, TextEncoder, TextDecoder, Buffer, Uint8Array,
    ArrayBuffer, DataView, process, global: c, self: c });
  vm.runInContext(`var __RD=Date;Date=class extends __RD{constructor(...a){a.length?super(...a):super(${FIXED});}static now(){return ${FIXED};}};`, c);
  vm.runInContext(fs.readFileSync(EXCELJS, 'utf8'), c, { filename: 'exceljs.min.js' });
  vm.runInContext(`var loadExcelJS=()=>Promise.resolve();var toast=()=>{};var Blob=function(){};
    var URL={createObjectURL:()=>'blob:x',revokeObjectURL:()=>{}};
    document.createElement=()=>({click(){},remove(){},style:{}});document.body={appendChild(){}};`, c);
  const i = sb.src.indexOf('\nfunction XB(ws)'), j = sb.src.indexOf('\nconst N2=', i);
  if (i < 0 || j < 0) throw new Error('XB sheet writer not found');
  vm.runInContext(sb.src.slice(i, j), c, { filename: 'XB' });
  // called behind typeof guards by the export: load them as the page has them
  sb.run('PROP_LABELS'); sb.run('isBatch');
  // the call log (recording only: the methods are the page's)
  vm.runInContext(`var __LOG=[];(function(){const P=XB.prototype,o={};
    ['band','sub','line','table','note','eq','title'].forEach(k=>{o[k]=P[k];P[k]=function(...a){const r0=this.r,res=o[k].apply(this,a);
      __LOG.push({k,r:r0,a:k==='table'?[a[0],a[1].length]:a.slice(0,2)});return res;};});})();`, c);
  const run = async setup => {
    c.__setup = setup;
    let A;
    for (let k = 0; k < 100; k++) {   // the composite engine catches its own errors into .blocked: load what it misses, run again
      A = sb.design(`(()=>{S=defaultState();(${setup})();return S.mode==='member'?computeMember():computeAll();})()`);
      const m = /(\w+) is not defined/.exec([A.comp && A.comp.blocked, A.constr && A.constr.blocked].join(' '));
      if (!m || !sb.add(m[1])) break;
    }
    if (A.designError) throw new Error('design error: ' + A.designError);
    for (let k = 0; k < 300; k++) {
      vm.runInContext('__LOG=[]', c);
      try { const buf = await sb.run('exportExcel()'); return { A, buf: Buffer.from(buf), log: JSON.parse(JSON.stringify(c.__LOG)) }; }
      catch (e) { const m = /^(\w+) is not defined/.exec((e && e.message) || ''); if (m && sb.add(m[1])) continue; throw e; }
    }
    throw new Error('too many missing declarations');
  };
  const load = async buf => { const wb = new c.ExcelJS.Workbook(); await wb.xlsx.load(buf); return wb.getWorksheet('Design Calc'); };
  return { sb, ctx: c, run, load };
}
