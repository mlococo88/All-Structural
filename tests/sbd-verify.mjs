#!/usr/bin/env node
// Steel Bridge Design (merged GirderDetail + ST-Girder), PR 1 checks that compare.mjs does not cover (dev tooling only):
//  1. redirect: "Steel Bridge Beam Modules.html#<hash>" forwards to "Steel Bridge Design.html#<hash>";
//  2. saved data: a browser with GirderDetail (girderdetail_*), Preliminary sizing (plateline_*) and ST-Girder (stgirder.session, stgirder.ui.v1)
//     data saved by the old files opens it unchanged in the merged tool, and the ST-Girder view shows the saved ST-Girder session;
//  3. the view from the UI: the module tab opens it (first-open time to ST-Girder ready), the girder selector loads a girder; the live link (PR 2):
//     in sync, girder kept per project, "GirderDetail changed — Update" banner, Update, the Design all summary and its links into the view; printing
//     (ST-Girder's Print button prints the frame, not the page; the top bar's Print report opens ST-Girder's Report tab; Ctrl+P prints the frame);
//  console errors of every page. Usage: node tests/sbd-verify.mjs [--file "Steel Bridge Design.html"]   Exit code 0 when every check passes.
import fs from 'fs';
import path from 'path';
import { REPO, HERE, openPage } from './lib.mjs';

const av = process.argv.slice(2), fi = av.indexOf('--file');
const FILE = path.resolve(REPO, fi >= 0 ? av[fi + 1] : 'Steel Bridge Design.html'), OLD = path.join(path.dirname(FILE), 'Steel Bridge Beam Modules.html');
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const errsOf = o => o.errs.filter(e => !/^Failed to load resource/.test(e));

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
    await p.click('#mtab-st'); await p.waitForTimeout(500);
    ok(await p.evaluate(() => document.body.classList.contains('mod-st') && document.querySelectorAll('iframe[name="gd-st"]').length === 1), 'reopening keeps the one frame (state kept)');
    const pm = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('girderdetail_autosave_v1')).data.mod; } catch (e) { return '?'; } });
    ok(pm !== 'st', 'the saved GirderDetail project never records the view as a module (mod = ' + pm + ')');
    const e = errsOf(o); ok(!e.length, 'console errors: ' + e.length + (e.length ? ' ' + JSON.stringify(e.slice(0, 3)) : ''));
    ok(!o.dialogs.filter(d => !/^Load G3 into ST-Girder\?/.test(d)).length, 'dialogs: ' + JSON.stringify(o.dialogs.map(d => d.slice(0, 60))));
  } finally { await o.b.close(); } }
console.log(bad ? `\n${bad} check(s) failed` : '\nall checks pass');
process.exit(bad ? 1 : 0);
