#!/usr/bin/env node
// Browser smoke test: MIDAS Line Girder Analysis (.lga) export and import buttons (LGA, 2026-11-19). apps/steel-bridge/index.html, the
// built-in new project, headless Chromium (tests/lib.mjs openPage), at desktop (1440 px) and phone (390 px) width:
//   1. Project tab, "Save and open" card: both buttons present;
//   2. Export to MIDAS (.lga): the options dialog (three boxes, checked), Export -> a download named <project>.lga with the format's
//      141 keys and midas_url "", then the export summary;
//   3. Import MIDAS (.lga) of that file as a new project: the report dialog (mapped table, not-supported table), the girder count and
//      spans of the project afterwards; Help opens; the page does not scroll sideways with a dialog open (phone);
//   4. Import into the open project: one undo step (Undo enabled); 0 console errors.
//   node tests/smoke/steel-bridge-lga.mjs [--file <html>] [--shots <dir>]
import fs from 'fs';
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

const av = process.argv.slice(2), arg = k => { const i = av.indexOf(k); return i >= 0 ? av[i + 1] : null; };
const FILE = arg('--file') ? path.resolve(arg('--file')) : path.join(REPO, 'apps/steel-bridge/index.html'), SHOTS = arg('--shots');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };

for (const vw of [1440, 390]) {
  console.log(`-- ${vw} px`);
  const A = await openPage(FILE, { vw, vh: vw > 900 ? 1000 : 844 });
  const p = A.p;
  try {
    await p.waitForSelector('#inTabs [data-itab="proj"]'); await p.click('#inTabs [data-itab="proj"]'); await p.waitForTimeout(400);
    ok(await p.isVisible('#bLgaIn') && await p.isVisible('#bLgaOut'), '1. both buttons on the Project tab');
    // 2. export
    await p.click('#bLgaOut'); await p.waitForSelector('#lgaDlg[open] #lgaO1');
    ok(await p.evaluate(() => ['#lgaO1', '#lgaO2', '#lgaO3'].every(s => document.querySelector(s).checked)), '2. options dialog, three options checked');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#lgaDlg [data-lga="go"]')]);
    const tmp = path.join(process.env.TMPDIR || '/tmp', `lga-smoke-${vw}.lga`); await dl.saveAs(tmp);
    const F = JSON.parse(fs.readFileSync(tmp, 'utf8'));
    ok(/\.lga$/.test(dl.suggestedFilename()) && F.app === 'Line Girder Analysis' && Object.keys(F.project).length === 141 && F.project.midas_url === '', `   download ${dl.suggestedFilename()}: 141 keys, midas_url empty`);
    ok(await p.isVisible('#lgaDlg[open] h2') && /Exported/.test(await p.textContent('#lgaDlg h2')), '   export summary shown');
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `lga-export-${vw}.png`) });
    await p.click('#lgaDlg [data-lga="close"]');
    // 3. import as a new project
    const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('#bLgaIn')]); await fc.setFiles(tmp);
    await p.waitForSelector('#lgaDlg[open] [data-lga="new"]'); await p.click('#lgaDlg [data-lga="new"]');
    await p.waitForSelector('#lgaDlg[open] table'); await p.waitForTimeout(300);
    const rep = await p.evaluate(() => ({ h: document.querySelector('#lgaDlg h2').textContent, rows: document.querySelectorAll('#lgaDlg table')[0].rows.length, ign: document.querySelectorAll('#lgaDlg table')[1].rows.length,
      sw: document.scrollingElement.scrollWidth, iw: innerWidth, P: JSON.parse(localStorage.getItem('sbd2.project.current') || '{}') }));
    ok(/import report/.test(rep.h) && rep.rows > 30 && rep.ign > 5, `3. import report: ${rep.rows - 1} mapped rows, ${rep.ign - 1} ignored rows`);
    ok(rep.P.xs && rep.P.xs.nb === F.project.num_girders && JSON.stringify(rep.P.spans.lengths) === JSON.stringify(F.project.span_lengths) && rep.P.midasLga && !JSON.stringify(rep.P).includes('midas_url'), `   project generated: ${rep.P.xs && rep.P.xs.nb} girders, spans ${JSON.stringify(rep.P.spans && rep.P.spans.lengths)}`);
    ok(rep.sw <= rep.iw + 1, `   no sideways scroll with the dialog open (${rep.sw} <= ${rep.iw})`);
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `lga-import-${vw}.png`) });
    await p.click('#lgaDlg [data-lga="help"]'); await p.waitForTimeout(200);
    ok(/import and export/.test(await p.textContent('#lgaDlg h2')), '   Help opens');
    await p.click('#lgaDlg [data-lga="close"]');
    // 4. into the open project: one undo step
    const [fc2] = await Promise.all([p.waitForEvent('filechooser'), p.click('#bLgaIn')]); await fc2.setFiles(tmp);
    await p.waitForSelector('#lgaDlg[open] [data-lga="cur"]'); await p.click('#lgaDlg [data-lga="cur"]'); await p.waitForSelector('#lgaDlg[open] table');
    await p.click('#lgaDlg [data-lga="close"]'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => !document.getElementById('bUndo').disabled), '4. into the open project: Undo available');
    ok(A.errs.length === 0, `   console errors: ${A.errs.length}${A.errs.length ? ' ' + A.errs.slice(0, 3).join(' | ') : ''}`);
  } catch (e) { fails++; console.log('  FAIL ' + (e && e.stack || e)); }
  finally { await A.b.close(); }
}
console.log(fails ? `${fails} check(s) failed` : 'all checks pass');
process.exit(fails ? 1 : 0);
