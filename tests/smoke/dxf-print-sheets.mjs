#!/usr/bin/env node
// Print sheets (shared/dxf.js SharedDxf.printSheets, 2026-11-03): each tool's Drawings tab "Print sheet" and "Print all sheets" printed
// headless to PDF with Chromium page.pdf honoring @page (preferCSSPageSize), window.print stubbed (the dialog cannot open headless).
// Checks per tool:
//   1. Print sheet: one page, 1224 x 792 pt (17 x 11 in landscape); the sheet's outer border 0.25 in (18 pt) inside the page edges (Steel Bridge
//      half size: no outer border, the inner border at 18 pt / 27 pt left, on every page) and a known drawn
//      dimension measured on the PDF (pdftocairo -svg: path coordinates in pt) equal to its full-size value / plot scale k x 72;
//   2. Print all sheets: one 17 x 11 page per sheet;
//   3. after printing, the print box and its style are gone; then the page's own print (Ctrl+P / the browser's Print, page.pdf with no
//      button) prints the Report as before: letter pages, the Report's text, none of the sheets;
//   4. no console errors.
// Display only: nothing here checks or changes a computed result.
//   node tests/smoke/dxf-print-sheets.mjs [--tool sf,...] [--out <dir for the PDFs>]
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { openPage, REPO } from '../lib.mjs';

const args = process.argv.slice(2), arg = k => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const OUT = arg('--out') || fs.mkdtempSync(path.join(os.tmpdir(), 'dxfprint-'));
fs.mkdirSync(OUT, { recursive: true });

/* the PDF's pages: [{ w, h }] (pdfinfo) */
function pages(f) {
  const t = execFileSync('pdfinfo', ['-f', '1', '-l', '999', f], { encoding: 'utf8' });
  return [...t.matchAll(/Page\s+\d+ size:\s+([\d.]+) x ([\d.]+) pts/g)].map(m => ({ w: +m[1], h: +m[2] }));
}
/* the stroked rectangles of page n (pdftocairo -svg): [{ x0, y0, x1, y1 }] in pt, transform applied */
function rects(f, n) {
  const svg = path.join(OUT, `_p${n}.svg`); execFileSync('pdftocairo', ['-svg', '-f', String(n), '-l', String(n), f, svg]);
  const t = fs.readFileSync(svg, 'utf8'), R = [];
  for (const m of t.matchAll(/<path fill="none"[^>]*? d="([^"]+)"(?: transform="matrix\(([^)]+)\)")?/g)) {
    const M = (m[2] || '1,0,0,1,0,0').split(/[\s,]+/).map(Number), nums = m[1].replace(/[MLZ]/g, ' ').trim().split(/\s+/).map(Number);
    if (!/^M [^A-Z]+ L [^A-Z]+ L [^A-Z]+ L [^A-Z]+ Z/.test(m[1]) || M[1] || M[2]) continue;
    const xs = [], ys = []; for (let i = 0; i + 1 < nums.length; i += 2) { xs.push(M[0] * nums[i] + M[4]); ys.push(M[3] * nums[i + 1] + M[5]); }
    R.push({ x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) });
  }
  fs.unlinkSync(svg); return R;
}

/* per tool: open(p) shows the Drawings tab; one / all: the two buttons; known(p) -> { what, w, h } the full-size width and height of a
   drawn rectangle of the sheet shown divided by its plot scale (paper inches); n(p): the number of sheets; report: a text of the Report */
const TOOLS = {
  sf: {
    file: 'Spread Footing.html', label: 'Spread Footing',
    open: async p => { await p.waitForTimeout(1500); await p.click('#tabbar button[data-tab="tab-drawings"]'); await p.waitForSelector('#sfdwPrint1'); },
    one: '#sfdwPrint1', all: '#sfdwPrintAll',
    n: p => p.evaluate(() => SFDW.B.S.length),
    known: p => p.evaluate(() => { const s = SFDW.B.S.find(q => q.id === SFDW.cur); return { what: `footing outline B x L = ${R.B} x ${R.L} ft on ${s.title} at 1:${s.k}`, w: R.B * 12 / s.k, h: R.L * 12 / s.k }; }),
    report: /Spread Footing|FOOTING/i,
  },
  lp: {
    file: 'Light Pole and Sign Post.html', label: 'Light Pole and Sign Post',
    open: async p => { await p.waitForFunction(() => typeof switchTab === 'function' && typeof LPP_SUMCTX !== 'undefined' && LPP_SUMCTX, null, { timeout: 30000 }); await p.evaluate(() => switchTab('drawings')); await p.waitForSelector('#lpdPrint1'); },
    one: '#lpdPrint1', all: '#lpdPrintAll',
    n: p => p.evaluate(() => LPDW.B.S.length),
    // the shaft in the POLE ELEVATION: diameter b by embedment d (+ projection p above grade)
    known: p => p.evaluate(() => { const s = LPDW.B.S.find(q => q.id === LPDW.cur), c = LPP_SUMCTX, b = c.inp.b * 12, d = c.stacks[0].found.d * 12 + (c.inp.pProj > 0 ? c.inp.pProj * 12 : 0);
      return { what: `shaft ${b} in dia. x ${+d.toFixed(3)} in (embedment d = ${c.stacks[0].found.d} ft) on ${s.title} at 1:${s.k}`, w: b / s.k, h: d / s.k }; }),
    report: /Light Pole|POLE/i,
  },
  sbd: {   // SBPS-3 (2026-11-03): paper D (default) prints HALF SIZE on 11 x 17: the TYPICAL SECTION sheet's deck slab measures w / (2 k)
    file: 'apps/steel-bridge/index.html', label: 'Steel Bridge Design (apps/steel-bridge), paper D half size',
    open: async p => { await p.waitForSelector('#tabBar [data-otab="dwg"]'); await p.click('#tabBar [data-otab="dwg"]'); await p.waitForSelector('#dwg_print1'); await p.selectOption('#dwg_sheet', 'sec'); await p.waitForSelector('#dwg_print1'); },
    one: '#dwg_print1', all: '#dwg_printAll',
    n: p => p.evaluate(() => document.querySelectorAll('#dwg_sheet option').length),
    known: p => p.evaluate(() => { const G = SBDDrawings.model(SBDModel.defaultProject()), s = SBDSheets.build(G, null, { paper: 'D' }).sheets.find(q => q.id === 'sec'), dk = G.deck;
      const w = G.ys[G.nb - 1] * 12 + (dk.ohL + dk.ohR) * 12; return { what: `deck slab ${w} x ${dk.ts} in on ${s.title}, D sheet at 1:${s.k}, printed half size (1:${2 * s.k})`, w: w / s.k / 2, h: dk.ts / s.k / 2 }; }),
    // the printed sheet says it is half size (scale cell and the note under the title block). SBPS-4 (2026-11-03): no outer border on the
    // half-size print (it would be 0.25 / 2 in = 9 pt from the page edge); the inner border frames it, 18 pt from the edge (27 pt on the left)
    sheetText: /\(HALF SIZE\)[\s\S]*HALF-SIZE PRINT ON 11 X 17|HALF-SIZE PRINT ON 11 X 17[\s\S]*\(HALF SIZE\)/,
    frame: { absent: 9, inner: [27, 18, 1224 - 18, 792 - 18] },
    reportOpen: async p => { await p.click('#tabBar [data-otab="rpt"]'); await p.click('#rp_build'); await p.waitForSelector('.rp-doc .rp-step', { timeout: 180000 }); },
    report: /Steel Bridge|Report/i,
  },
  bg: {   // BGDW (2026-11-03): the PROFILE sheet; the known rectangle is the profile frame (station range x elevation range, horizontal
          // scale k, vertical k / VE). The tool has no Report: its own print prints the open tab, so check 3 is the sheets' absence only.
    file: 'Bridge Geometry.html', label: 'Bridge Geometry',
    open: async p => { await p.waitForFunction(() => typeof ENG !== 'undefined' && ENG, null, { timeout: 30000 }); await p.waitForTimeout(1000);
      await p.click('.tabbtn[data-tab="drawings"]'); await p.waitForSelector('#bgdwPrint1'); await p.selectOption('#bgdwSheet', 'profile'); await p.waitForSelector('#bgdwPrint1'); },
    one: '#bgdwPrint1', all: '#bgdwPrintAll',
    n: p => p.evaluate(() => BGDW.B.S.length),
    known: p => p.evaluate(() => { const s = BGDW.B.S.find(q => q.id === BGDW.cur); return { what: s.known.what + ' on ' + s.title + ' (' + s.scale + ')', w: s.known.w, h: s.known.h }; }),
    report: null,
  },
  spc: {   // SPDW (2026-11-03): a welded plate girder (flanges PL 16 x 1, web PL 36 x 1/2) set up in the test profile; the known rectangle
           // is the top flange on the SECTION AND PROPERTIES sheet. Ctrl+P prints the Report from any tab (SPRX).
    file: 'Section Property Calculator.html', label: 'Section Property Calculator',
    open: async p => { await p.waitForFunction(() => window.SPCUI && window.SPCUI.res, null, { timeout: 30000 });
      await p.evaluate(() => { M.parts = [newPart('plate', { b: 16, t: 1 }, 0, 18.5), newPart('plate', { b: 0.5, t: 36 }, 0, 0), newPart('plate', { b: 16, t: 1 }, 0, -18.5)]; fullRebuild(); });
      await p.waitForTimeout(600); await p.click('#tab_dwg'); await p.waitForSelector('#spdwPrint1'); },
    one: '#spdwPrint1', all: '#spdwPrintAll',
    n: p => p.evaluate(() => SPDW.B.S.length),
    known: p => p.evaluate(() => { const s = SPDW.B.S.find(q => q.id === SPDW.cur); return { what: `top flange PL 16 x 1 in on ${s.title} at ${s.scale} (1:${s.k})`, w: 16 / s.k, h: 1 / s.k }; }),
    report: /Section Propert/i,
  },
};

let fails = 0; const check = (ok, m) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${m}`); if (!ok) fails++; };
/* T.frame (a print with no outer border): on every page no rectangle at `absent` pt from the page edges, and the inner border at
   inner = [x0, y0, x1, y1] pt */
function frameCheck(F, pageRects, what) {
  const tol = 0.6, e = F.absent, [a, b, c, d] = F.inner;
  const noOuter = pageRects.filter(Rc => !Rc.some(r => Math.abs(r.x0 - e) < tol && Math.abs(r.y0 - e) < tol && Math.abs(r.x1 - 1224 + e) < tol && Math.abs(r.y1 - 792 + e) < tol)).length;
  const inner = pageRects.filter(Rc => Rc.some(r => Math.abs(r.x0 - a) < tol && Math.abs(r.y0 - b) < tol && Math.abs(r.x1 - c) < tol && Math.abs(r.y1 - d) < tol)).length;
  check(noOuter === pageRects.length, `${what}: no outer border at ${e} pt from the page edge on ${noOuter} of ${pageRects.length} page(s)`);
  check(inner === pageRects.length, `${what}: the inner border at (${a}, ${b})-(${c}, ${d}) pt on ${inner} of ${pageRects.length} page(s)`);
}
const want = (arg('--tool') || Object.keys(TOOLS).join(',')).split(',');
for (const key of want) {
  const T = TOOLS[key]; if (!T) { console.log(`unknown tool ${key}`); fails++; continue; }
  console.log(`${T.label} (${T.file})`);
  const o = await openPage(path.join(REPO, T.file), { vw: 1400, vh: 1000, timeout: 60000 });
  try {
    await T.open(o.p);
    await o.p.evaluate(() => { window.__prints = 0; window.print = () => { window.__prints++; }; });
    // 1. the sheet shown
    const K = await T.known(o.p), N = await T.n(o.p);
    await o.p.click(T.one);
    const st1 = await o.p.evaluate(() => ({ box: document.querySelectorAll('#sdx-print .sdx-sheet').length, prints: window.__prints }));
    check(st1.box === 1 && st1.prints === 1, `Print sheet: print box with 1 sheet, window.print called (${JSON.stringify(st1)})`);
    const f1 = path.join(OUT, `${key}-sheet.pdf`);
    await o.p.pdf({ path: f1, preferCSSPageSize: true, printBackground: true });
    const P1 = pages(f1);
    check(P1.length === 1 && P1.every(q => Math.abs(q.w - 1224) < 0.5 && Math.abs(q.h - 792) < 0.5), `Print sheet: ${P1.length} page(s), ${P1.map(q => q.w + ' x ' + q.h).join(', ')} pt (expected 1 page 1224 x 792 = 17 x 11 in)`);
    const Rc = rects(f1, 1), tol = 0.6;
    if (T.frame) frameCheck(T.frame, [Rc], 'Print sheet');
    else { const e = T.border || 18, outer = Rc.find(r => Math.abs(r.x0 - e) < tol && Math.abs(r.y0 - e) < tol && Math.abs(r.x1 - 1224 + e) < tol && Math.abs(r.y1 - 792 + e) < tol);
    check(!!outer, `the sheet's outer border ${e / 72} in inside the page edge: (${e}, ${e})-(${1224 - e}, ${792 - e}) pt${outer ? '' : ': not found'}`); }
    if (T.sheetText) { const t1 = execFileSync('pdftotext', [f1, '-'], { encoding: 'utf8' }); check(T.sheetText.test(t1), `the printed sheet's text matches ${T.sheetText}`); }
    const kw = K.w * 72, kh = K.h * 72, hit = Rc.find(r => Math.abs(r.x1 - r.x0 - kw) < tol && Math.abs(r.y1 - r.y0 - kh) < tol);
    check(!!hit, `to scale: ${K.what}: expected ${kw.toFixed(2)} x ${kh.toFixed(2)} pt (${K.w.toFixed(4)} x ${K.h.toFixed(4)} in)${hit ? `, measured ${(hit.x1 - hit.x0).toFixed(2)} x ${(hit.y1 - hit.y0).toFixed(2)} pt` : ': no such rectangle on the page'}`);
    await o.p.waitForTimeout(100);
    const gone1 = await o.p.evaluate(() => !document.getElementById('sdx-print') && !document.getElementById('sdx-print-css') && !document.body.classList.contains('sdx-printing'));
    check(gone1, 'after printing: the print box, its style and the body class are removed');
    // 2. every sheet
    await o.p.click(T.all);
    const f2 = path.join(OUT, `${key}-all.pdf`);
    await o.p.pdf({ path: f2, preferCSSPageSize: true, printBackground: true });
    const P2 = pages(f2);
    check(P2.length === N && P2.every(q => Math.abs(q.w - 1224) < 0.5 && Math.abs(q.h - 792) < 0.5), `Print all sheets: ${P2.length} pages (sheets ${N}), sizes ${[...new Set(P2.map(q => q.w + ' x ' + q.h))].join(', ')} pt`);
    if (T.frame) frameCheck(T.frame, P2.map((q, i) => rects(f2, i + 1)), 'Print all sheets');
    await o.p.waitForTimeout(100);
    const gone2 = await o.p.evaluate(() => !document.getElementById('sdx-print') && !document.getElementById('sdx-print-css'));
    check(gone2, 'after printing all: the print box and its style are removed');
    // 3. the page's own print: the Report
    if (T.reportOpen) await T.reportOpen(o.p);   // a tool that prints the open tab: the Report tab first
    const f3 = path.join(OUT, `${key}-report.pdf`);
    await o.p.pdf({ path: f3, preferCSSPageSize: true, printBackground: true });
    const P3 = pages(f3), txt = execFileSync('pdftotext', [f3, '-'], { encoding: 'utf8' });
    if (T.report) check(P3.length > 1 && P3.every(q => Math.abs(q.w - 612) < 0.5 && Math.abs(q.h - 792) < 0.5) && T.report.test(txt), `Ctrl+P / Print: the Report, ${P3.length} letter pages`);
    else check(!P3.some(q => Math.abs(q.w - 1224) < 0.5 && Math.abs(q.h - 792) < 0.5), `Ctrl+P / Print (no Report in this tool): the page as before, ${P3.length} page(s), no 17 x 11 sheet page`);
    if (T.report) check(!/PLOT THIS SHEET|SHEET TITLE/.test(txt), 'Ctrl+P / Print: no drawing sheet in the Report print');
    check(!o.errs.length, `console errors: ${o.errs.length}${o.errs.length ? ' ' + o.errs.slice(0, 3).join(' | ') : ''}`);
  } catch (e) { check(false, `${T.label}: ${e.message}`); }
  finally { await o.b.close(); }
}
console.log(`\nPDFs in ${OUT}\n${fails ? fails + ' FAILED' : 'all ok'}`);
process.exit(fails ? 1 : 0);
