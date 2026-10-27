#!/usr/bin/env node
// Steel Bridge Design (merged GirderDetail + ST-Girder), PR 1 checks that compare.mjs does not cover (dev tooling only):
//  1. redirect: "Steel Bridge Beam Modules.html#<hash>" forwards to "Steel Bridge Design.html#<hash>";
//  2. saved data: a browser with GirderDetail (girderdetail_*), Preliminary sizing (plateline_*) and ST-Girder (stgirder.session, stgirder.ui.v1)
//     data saved by the old files opens it unchanged in the merged tool, and the ST-Girder view shows the saved ST-Girder session;
//  3. the view from the UI: the module tab opens it (first-open time to ST-Girder ready), the girder selector loads a girder; the live link (PR 2):
//     in sync, girder kept per project, "GirderDetail changed — Update" banner, Update, the Design all summary and its links into the view; one title
//     block (PR 3): the project title block shown read-only in the view, ST-Girder's saved fields kept; printing
//     (ST-Girder's Print button prints the frame, not the page; the top bar's Print report opens ST-Girder's Report tab; Ctrl+P prints the frame);
//  one report (PR 3): a module's Print with Appendix A (ST-Girder's report, A.n numbering, see §A.n.k), the Girder report with its ST-Girder chapter;
//  one project file (PR 4): export holds every part, read back, a newer version refused; console errors of every page. Usage: node tests/sbd-verify.mjs [--file "Steel Bridge Design.html"]   Exit code 0 when every check passes.
import fs from 'fs';
import path from 'path';
import { REPO, HERE, openPage } from './lib.mjs';

const av = process.argv.slice(2), fi = av.indexOf('--file');
const FILE = path.resolve(REPO, fi >= 0 ? av[fi + 1] : 'Steel Bridge Design.html'), OLD = path.join(path.dirname(FILE), 'Steel Bridge Beam Modules.html');
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const errsOf = o => o.errs.filter(e => !/^Failed to load resource|^\[BABEL\] Note: The code generator has deoptimised/.test(e));

// 1. redirect with a hash (and a query)
{ const o = await openPage(OLD, { hash: '#gdtest=1&x=%20y' });
  try { await o.p.waitForURL(/Steel%20Bridge%20Design\.html/, { timeout: 15000 }); const u = o.p.url();
    ok(/Steel%20Bridge%20Design\.html#gdtest=1&x=%20y$/.test(u), 'redirect keeps the hash: ' + u.replace(/^.*\//, ''));
    ok((await o.p.evaluate(() => document.title)) === 'Steel Bridge Design', 'redirect lands on Steel Bridge Design');
  } finally { await o.b.close(); } }

// 2. saved data from the old files
const seed = JSON.parse(fs.readFileSync(path.join(HERE, 'projects', 'gd', 'xsA.json'), 'utf8'));   // girderdetail_autosave_v1, plateline_autosave_v1 (saved 2026-10-13)
const stSess = (() => { const o = { proj: { name: 'SEEDED ST SESSION', girderId: 'SEED-G9' } }; return JSON.stringify(o); })();
seed['stgirder.session'] = stSess; seed['stgirder.ui.v1'] = JSON.stringify({ tab: 'inputs' }); seed['girderdetail_projects_v1'] = JSON.stringify([]);
{ const o = await openPage(FILE, { ls: seed }), p = o.p;
  try {
    await p.waitForFunction(() => typeof P !== 'undefined' && P && typeof plEnsure === 'function', null, { timeout: 60000 });
    await p.evaluate(() => plEnsure()); await p.evaluate(() => window.gdIdle({ quiet: 4000 }));
    const gd = await p.evaluate(() => ({ name: P.meta && P.meta.name, nb: P.df && P.df.bridge && P.df.bridge.nb, keys: Object.keys(localStorage).filter(k => /^(girderdetail|plateline|stgirder)/.test(k)).sort() }));
    ok(gd.name === JSON.parse(seed.girderdetail_autosave_v1).data.meta.name, 'GirderDetail project opened from girderdetail_autosave_v1: ' + gd.name);
    ok(gd.nb === 5, 'Preliminary sizing bridge from plateline_autosave_v1: ' + gd.nb + ' girders');
    // ST-Girder view from the module tab: first open (frame built, Babel, ready)
    const t0 = Date.now(); await p.click('#mtab-st');
    await p.waitForFunction(() => typeof ST_READY !== 'undefined' && ST_READY, null, { timeout: 60000 }); const tOpen = Date.now() - t0;
    console.log(`     first open of the ST view (click to ST-Girder ready): ${tOpen} ms`);
    const f = p.frames().find(fr => fr.name() === 'gd-st'); ok(!!f, 'frame named gd-st');
    await f.waitForSelector('.tabs .tab', { timeout: 30000 }); await p.waitForTimeout(1500);
    const txt = await f.evaluate(() => document.body.innerText + '\n' + [...document.querySelectorAll('input')].map(i => i.value).join('\n'));   // the project name and girder ID are input values
    ok(txt.includes('SEEDED ST SESSION') || txt.includes('SEED-G9'), 'ST view shows the saved ST-Girder session (stgirder.session)');
    ok(await p.evaluate(() => document.body.classList.contains('mod-st') && getComputedStyle(document.getElementById('app')).display === 'none' && document.getElementById('mtab-st').getAttribute('aria-selected') === 'true'), 'view shown, modules hidden, its tab selected');
    const sess = await f.evaluate(() => JSON.parse(localStorage.getItem('stgirder.session')));
    ok(sess && sess.proj && sess.proj.name === 'SEEDED ST SESSION', 'stgirder.session kept (same key, same origin)');
    const host = await f.evaluate(() => ({ h: window.GD_ST_HOST, ap: JSON.parse(localStorage.getItem('bridgeSuite.v1.appPaths') || '{}').stgirder }));
    ok(host.h && host.h.embedded && host.h.file === path.basename(FILE), 'GD_ST_HOST injected: ' + JSON.stringify(host.h && { file: host.h.file, embedded: host.h.embedded }));
    ok(host.ap && host.ap.file === path.basename(FILE) && /\/$/.test(host.ap.dir || ''), 'appPaths stgirder entry uses the host file and folder: ' + JSON.stringify(host.ap && { file: host.ap.file, dir: (host.ap.dir || '').replace(/^.*\/(?=[^/]+\/$)/, '…/') }));
    // girder selector: G3 with the Load button (confirm accepted by the test page)
    await p.selectOption('#st-g', '3'); await p.click('#st-load');
    await f.waitForFunction(() => { try { const s = JSON.parse(localStorage.getItem('stgirder.session')); return s.external && s.external.girderDetail && s.external.girderDetail.label === 'G3'; } catch (e) { return false; } }, null, { timeout: 20000 });
    const g3 = await f.evaluate(() => { const s = JSON.parse(localStorage.getItem('stgirder.session')); return { id: s.proj.girderId, file: s.external.producerFile, name: s.proj.name }; });
    ok(g3.id === 'G3 (Interior)' && g3.file === 'Steel Bridge Design.html', 'Load girder G3 from the selector: ' + JSON.stringify(g3));
    ok(/G3 loaded into ST-Girder/.test(await p.textContent('#st-msg')), 'bar message: ' + (await p.textContent('#st-msg')));
    // SBD2 (PR 2): live link. In sync after the load; the girder remembered per project; a change that alters G3's hand-off shows the banner and
    // applies nothing; one click on Update re-applies; the Design all summary shows the view's checks and ratings and links into the view
    await p.waitForFunction(() => ST_LINK && ST_LINK.st === 'sync' && ST_LINK.g === 3, null, { timeout: 20000 }).catch(() => {});
    ok(await p.evaluate(() => ST_LINK.st === 'sync' && /in sync/.test(document.getElementById('st-link').textContent)), 'link: G3 in sync after the load: ' + (await p.textContent('#st-link')));
    ok(await p.evaluate(() => P.ui.stG === 3 && P.ui.stPL === true), 'selected girder kept in the project (P.ui.stG = 3, P.ui.stPL = true)');
    const pa0 = await f.evaluate(() => JSON.parse(localStorage.getItem('stgirder.session')).external.producedAt);
    await p.evaluate(() => { if (!P.tb) gdTbMigrate(true); P.tb.name = (P.tb.name || '') + ' (rev)'; autosave(); });   // the project name goes with the hand-off
    await p.waitForFunction(() => ST_LINK.st === 'stale', null, { timeout: 20000 }).catch(() => {});
    ok(await p.evaluate(() => /GirderDetail changed/.test(document.getElementById('st-link').textContent) && !!document.querySelector('#st-link [data-stupd]')), 'banner after a change: ' + (await p.textContent('#st-link')));
    await p.waitForTimeout(1500);
    ok(pa0 === await f.evaluate(() => JSON.parse(localStorage.getItem('stgirder.session')).external.producedAt), 'nothing re-applied automatically');
    await p.click('#st-link [data-stupd]');
    await p.waitForFunction(pa => { try { return JSON.parse(localStorage.getItem('stgirder.session')).external.producedAt !== pa; } catch (e) { return false; } }, pa0, { timeout: 20000 }).catch(() => {});
    await p.waitForFunction(() => ST_LINK.st === 'sync', null, { timeout: 20000 }).catch(() => {});
    const prj = await f.evaluate(() => JSON.parse(localStorage.getItem('stgirder.session')).external.project);
    const prjN = typeof prj === 'string' ? prj : (prj && prj.name) || '';   // the hand-off's project (a string, HANDOFF.md §4.9)
    ok(/\(rev\)$/.test(prjN) && await p.evaluate(() => ST_LINK.st === 'sync'), 'Update re-applies G3 in one click (project ' + JSON.stringify(prjN) + ', ' + (await p.textContent('#st-link')) + ')');
    const da = await p.evaluate(() => { daModal(`<div id="da-st">${stDaHtml()}</div>`); const t = document.getElementById('da-st'); return { rows: t.querySelectorAll('.st-da-t tbody tr').length, txt: t.textContent, n: ST_STATE.checks.length }; });
    ok(da.rows >= da.n + 3 && /Inventory RF/.test(da.txt) && /G3 \(Interior\)/.test(da.txt), `Design all summary: ${da.n} checks and the load ratings of G3`);
    await p.click('#da-st a[data-stgo="rating"]'); await p.waitForTimeout(800);
    ok(await f.evaluate(() => { const t = document.querySelector('.tabs .tab.on'); return !!t && t.textContent.trim() === 'Rating'; }) && await p.evaluate(() => document.getElementById('da-modal').hidden && document.body.classList.contains('mod-st')), 'a rating in the summary opens the view at its Rating tab');
    // SBD3 (PR 3): one title block. The project title block is shown read-only in the view (page fields, Report tab); ST-Girder's saved fields are kept
    const proj0 = await f.evaluate(() => JSON.parse(localStorage.getItem('stgirder.session')).proj);
    await p.evaluate(() => { Object.assign(P.tb, { no: 'PN-77', compBy: 'ENG-A', compDate: '2026-10-01', chkBy: 'CHK-B', chkDate: '2026-10-02' }); autosave(); });
    await f.waitForFunction(() => [...document.querySelectorAll('.tb-grid input')].some(i => i.value === 'ENG-A'), null, { timeout: 20000 }).catch(() => {});
    const tbIn = await f.evaluate(() => [...document.querySelectorAll('.tb-grid input')].map(i => [i.value, i.readOnly]));
    ok(JSON.stringify(tbIn.filter(x => x[1]).map(x => x[0])) === JSON.stringify([await p.evaluate(() => P.tb.name), 'ENG-A', '2026-10-01', 'PN-77']) && tbIn.some(x => x[0] === 'G3 (Interior)' && !x[1]), 'page title block = project title block, read-only (Girder stays ST-Girder\'s): ' + JSON.stringify(tbIn));
    await f.evaluate(() => [...document.querySelectorAll('.tabs .tab')].find(e => e.textContent.trim() === 'Report').click()); await p.waitForTimeout(1200);
    const rtb = await f.evaluate(() => document.querySelector('.crv-tb').innerText.replace(/\s+/g, ' '));
    ok(/PN-77/.test(rtb) && /ENG-A/.test(rtb) && /CHK-B/.test(rtb) && /2026-10-02/.test(rtb), 'Report tab title block from the project title block: ' + rtb);
    await p.waitForTimeout(800);
    ok(JSON.stringify(proj0) === JSON.stringify(await f.evaluate(() => JSON.parse(localStorage.getItem('stgirder.session')).proj)), 'ST-Girder\'s saved title-block fields unchanged: ' + JSON.stringify(proj0));
    // a message from another window is ignored (source check): post from the page itself to the frame's window with a forged payload
    const ign = await p.evaluate(async () => { const before = localStorage.getItem('stgirder.session');
      try { ST_FRAME.contentWindow.postMessage({ type: 'gd-st-pull', id: 999, payload: { _schema: 'stgirder-external-demands' } }, '*'); } catch (e) { }
      await new Promise(r => setTimeout(r, 1200)); return before === localStorage.getItem('stgirder.session'); });
    ok(ign, 'an invalid payload changes nothing');
    // printing: ST-Girder's Print button prints the frame (window.print of the frame), never the page
    await p.evaluate(() => { window.__hostPrint = 0; window.print = () => { window.__hostPrint++; }; });
    await f.evaluate(() => { window.__framePrint = 0; window.print = () => { window.__framePrint++; }; });
    await p.click('#btn-print'); await p.waitForTimeout(1200);
    ok(await f.evaluate(() => { const t = document.querySelector('.tabs .tab.on'); return !!t && t.textContent.trim() === 'Report'; }), 'top bar Print report opens ST-Girder\'s Report tab');
    await f.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Print this report'); if (b) b.click(); }); await p.waitForTimeout(1500);
    ok((await f.evaluate(() => window.__framePrint)) === 1 && (await p.evaluate(() => window.__hostPrint)) === 0, 'ST-Girder\'s "Print this report" prints the frame only');
    await p.focus('#modbar'); await p.keyboard.press('Control+p'); await p.waitForTimeout(500);
    ok((await f.evaluate(() => window.__framePrint)) === 2 && (await p.evaluate(() => window.__hostPrint)) === 0, 'Ctrl+P in the view prints the frame');
    // back to a module
    await p.click('#mtab-gs'); await p.waitForTimeout(800);
    ok(await p.evaluate(() => !document.body.classList.contains('mod-st') && P.mod === 'gs' && getComputedStyle(document.getElementById('app')).display !== 'none'), 'module tab leaves the view');
    // SBD3 (PR 3): one report. A module's Print with Appendix A (ST-Girder's report, numbered A.n, "see §A.n.k"), then the Girder report with its ST-Girder chapter
    await p.click('#btn-print'); await p.waitForTimeout(500);
    ok(await p.evaluate(() => !!document.getElementById('ro-st') && !document.getElementById('ro-st').checked), 'Print dialog offers Appendix A (off by default): ' + (await p.evaluate(() => { const e = document.getElementById('ro-st'); return e ? e.parentNode.textContent : 'none'; })));
    await p.check('#ro-st'); const hp0 = await p.evaluate(() => window.__hostPrint); await p.click('#rpt-go');
    await p.waitForFunction(n => window.__hostPrint > n, hp0, { timeout: 60000 }).catch(() => {});
    const apx = await p.evaluate(() => { const h = document.getElementById('calc-rpt'), a = h.querySelector('.st-apx'), ids = [...h.querySelectorAll('[id]')].map(x => x.id);
      return a ? { h1: [...a.querySelectorAll('h2.cr-h1')].map(x => x.textContent).filter(t => /^A\.\d/.test(t)).length, plain: [...a.querySelectorAll('h2.cr-h1, h3.cr-h2')].filter(x => /^\d/.test(x.textContent)).length, see: (a.innerHTML.match(/see §\d/g) || []).length, seeA: (a.innerHTML.match(/see §A\.\d/g) || []).length,
        toc: /Appendix A\. Design & Rating/.test(h.querySelector('.cr-front .cr-toc').textContent), katex: a.querySelectorAll('.katex').length, dup: ids.length - new Set(ids).size, mj: a.querySelectorAll('mjx-container').length } : null; });
    ok(apx && apx.h1 >= 5 && apx.plain === 0 && apx.see === 0 && apx.seeA > 0 && apx.toc && apx.katex > 0 && apx.dup === 0 && apx.mj === 0, 'Print report with Appendix A: ' + JSON.stringify(apx));
    await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await p.click('#btn-grpt'); await p.waitForTimeout(500);
    ok(await p.evaluate(() => !!document.getElementById('gr_c_st') && !document.getElementById('gr_c_st').checked), 'Girder report offers the ST-Girder chapter (off by default)');
    await p.evaluate(() => { document.querySelectorAll('.gr-chaps input').forEach(i => i.checked = false); document.getElementById('gr_c_sa').checked = true; document.getElementById('gr_c_st').checked = true; document.getElementById('gr_g').value = '2'; });
    await p.click('#gr_go'); await p.waitForFunction(() => window.GR_LAST && window.GR_LAST.g === 2, null, { timeout: 300000 }).catch(() => {});
    const gr = await p.evaluate(() => { const h = document.getElementById('calc-rpt'), ids = [...h.querySelectorAll('[id]')].map(x => x.id), a = h.querySelector('.gr-chap .st-apx');
      return { heads: [...h.querySelectorAll('.gr-chap-h')].map(x => x.textContent), dup: ids.length - new Set(ids).size, girder: a ? a.querySelector('.cr-cover').innerText.replace(/\s+/g, ' ') : '', badHref: a ? [...a.querySelectorAll('a[href^="#"]')].filter(x => !document.getElementById(x.getAttribute('href').slice(1))).length : -1, held: ST_STATE.ext && ST_STATE.ext.label }; });
    ok(gr.heads.join('|') === 'Chapter 1. Structural analysis and stresses|Chapter 2. Design & Rating (ST-Girder)' && gr.dup === 0 && gr.badHref === 0 && /G2 \(Interior\)/.test(gr.girder) && /PN-77/.test(gr.girder) && gr.held === 'G2', 'Girder report G2 with the ST-Girder chapter: ' + JSON.stringify(gr));
    await p.click('#mtab-st'); await p.waitForTimeout(500);
    ok(await p.evaluate(() => document.body.classList.contains('mod-st') && document.querySelectorAll('iframe[name="gd-st"]').length === 1), 'reopening keeps the one frame (state kept)');
    const pm = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('girderdetail_autosave_v1')).data.mod; } catch (e) { return '?'; } });
    ok(pm !== 'st', 'the saved GirderDetail project never records the view as a module (mod = ' + pm + ')');
    // SBD4: one project file (Export JSON / Import JSON): every part in one file, read back; older files and a newer version
    const pf = await p.evaluate(() => { const j = JSON.parse(JSON.stringify(sbdProjectFile())); return { j, same: JSON.stringify(j.data) === JSON.stringify(P) }; });
    ok(pf.j.app === 'SteelBridgeDesign' && pf.j.v === 1 && pf.same && pf.j.pl && pf.j.pl.app === 'PlateLine' && !!pf.j.pl.data.girder && pf.j.st && pf.j.st._schema === 'stgirder' && !!pf.j.st.proj,
      'project file holds the modules (data = P), Preliminary sizing and ST-Girder: ' + JSON.stringify({ app: pf.j.app, v: pf.j.v, pl: pf.j.pl && pf.j.pl.app, st: pf.j.st && pf.j.st.proj && pf.j.st.proj.girderId }));
    const rt = await p.evaluate(async j => { const subj = P.meta.subject; P.meta.subject = 'CHANGED'; localStorage.setItem('stgirder.session', JSON.stringify({ proj: { name: 'OTHER' } }));
      const r = sbdProjectImport(j, 'test.json'); await new Promise(res => setTimeout(res, 1500));
      return { r, subj: P.meta.subject === subj, st: JSON.parse(localStorage.getItem('stgirder.session')).proj.girderId === j.st.proj.girderId, newer: sbdProjectImport({ ...j, v: 99 }, 'new.json'), old: sbdProjectImport({ app: 'GirderDetail', v: 1, data: P }, 'old.json') }; }, pf.j);
    ok(rt.r && rt.subj && rt.st && rt.newer && !rt.old, 'project file read back (modules and ST-Girder restored); a newer version refused; a GirderDetail file left to the older path: ' + JSON.stringify(rt));
    await p.waitForTimeout(1500);
    const e = errsOf(o); ok(!e.length, 'console errors: ' + e.length + (e.length ? ' ' + JSON.stringify(e.slice(0, 3)) : ''));
    ok(!o.dialogs.filter(d => !/^Load G3 into ST-Girder\?|^Open test\.json\?/.test(d)).length, 'dialogs: ' + JSON.stringify(o.dialogs.map(d => d.slice(0, 60))));
  } finally { await o.b.close(); } }
console.log(bad ? `\n${bad} check(s) failed` : '\nall checks pass');
process.exit(bad ? 1 : 0);
