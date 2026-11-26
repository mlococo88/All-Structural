#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html) Report, governing lines and stations (RG, 2026-11-25; report/builders.js linesSub / rtApp / appSec,
// ui/rating.js govRows, ui/report.js "Scope" choices). Headless Chromium, file://, the CDN libraries from tests/libs. A made-up bridge
// built here: NEXT 24F, 50 ft, four lines at 8 ft, Interior S1 on G2–G3, Exterior S1 (own f′c 9 ksi) on G1, G4.
//   1. default: "Work every girder line in full" and "Full rating table (appendix)" off; each type worked once (G2, G1: 30 sections);
//      §1 "Girder lines not worked in full" has G2, G3, G1, G4, each link with its target, a click on G3's link opens Interior S1 on G2's
//      sections; the Rating sections show "Rating factors at the governing stations (n of N)", not the table of every location;
//   2. "Full rating table (appendix)": the appendix is the last section (two subsections, every row), linked both ways;
//   3. "Work every girder line in full": every line worked (54 sections), no line summary, no governing-stations card, the appendix box
//      off and greyed; unticked: back to the default;
//   in each mode, print emulation (Print report): the page count (page.pdf, Letter), every in-document link (href="#…") and every
//   "see §" of the printed report has its target in the printed DOM, no "§?"; the choices kept in psb2.ui (rpt.worked, rpt.rtApp), no
//   other key, the project unchanged, 0 console errors, 0 KaTeX errors.
//   node tests/smoke/ps-bridge-report-governing.mjs [--shots <dir>]   (screenshots ps-report-summary.png, ps-report-rating.png)
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const FILE = path.join(REPO, 'apps/ps-bridge/index.html');
const ai = process.argv.indexOf('--shots'), SHOTS = ai > 0 ? process.argv[ai + 1] : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const { b, p, errs } = await openPage(FILE, { vw: 1400, vh: 1000, timeout: 120000 });
const pages = {};
try {
  await p.waitForSelector('#tabBar [data-otab]');
  await p.evaluate(() => { localStorage.clear(); const M = PSBModel, P = M.newProject();
    P.project.name = 'NEXT 24F four-line test (made up)'; P.project.designer = 'A. Made-Up'; P.project.checker = 'B. Checker'; P.project.date = '2026-11-25';
    P.xs.nb = 4; P.xs.bays = [8, 8, 8]; P.xs.ohL = 0; P.xs.ohR = 0; P.spans.lengths = [50];
    Object.assign(P.base, { girder: 'NEXT 24F', L: 50, S: 8, ts: 6, harp: { n: 0, yEnd: 16, yMid: 8, frac: 0.4 }, nGirders: 4,
      rows: [{ n: 14, y: 2, dbnd: 0, nd: 0 }, { n: 10, y: 4, dbnd: 10, nd: 4 }, { n: 4, y: 20, dbnd: 0, nd: 0 }] });
    P.base.opt.relAs = 2.5;
    P.types = [{ id: 'T1', label: 'Interior S1', span: 1, lines: [2, 3], ovr: {} }, { id: 'T2', label: 'Exterior S1', span: 1, lines: [1, 4], ovr: { 'mat.fc': 9 } }]; P.design = { g: 2, s: 1 };
    localStorage.setItem('psb2.project.current', M.exportJSON(P)); });
  await p.reload(); await p.waitForSelector('#tabBar [data-otab]'); await p.waitForTimeout(400);
  const proj0 = await p.evaluate(() => localStorage.getItem('psb2.project.current'));
  const nH = () => p.evaluate(() => document.querySelectorAll('#rptHost .rp-doc .rp-h1').length);
  const built = async want => { await p.waitForFunction(w => document.querySelectorAll('#rptHost .rp-doc .rp-h1').length === w && document.querySelector('#rptHost .rp-doc .rp-step'), want, { timeout: 600000 }); await p.waitForTimeout(500); };
  const ui = () => p.evaluate(() => JSON.parse(localStorage.getItem('psb2.ui') || '{}').rpt || {});
  await p.evaluate(() => document.querySelector('#tabBar [data-otab="rpt"]').click());
  await built(30);
  // the printed report: page count, links and § targets, KaTeX errors
  const printed = async tag => {
    await p.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
    await p.click('[data-rpact="print"]'); await p.waitForFunction(() => window.__printed > 0, null, { timeout: 120000 }); await p.emulateMedia({ media: 'print' });
    const L = await p.evaluate(() => { const box = document.getElementById('rp-print'), as = [...box.querySelectorAll('a[href^="#"]')].filter(a => a.getAttribute('href').length > 1);
      const dead = as.filter(a => !box.querySelector('#' + CSS.escape(a.getAttribute('href').slice(1)))).map(a => a.getAttribute('href') + ' ' + a.textContent);
      const ids = new Set([...box.querySelectorAll('.rp-sec[id], .rp-sub[id], [id^="rp-s"]')].map(e => e.id)), nums = new Set([...box.querySelectorAll('.rp-h1, .rp-h2')].map(h => (/^(\d+(?:\.\d+)*)/.exec(h.textContent.trim()) || [])[1]).filter(Boolean));
      const sees = [...box.querySelectorAll('a.rp-see')].map(a => (/§(\d+(?:\.\d+)*)/.exec(a.textContent) || [])[1]).filter(Boolean), noSec = sees.filter(s => !nums.has(s));
      const t = box.innerText; return { links: as.length, dead, sees: sees.length, noSec: [...new Set(noSec)], bad: (t.match(/§\?/g) || []).length, kerr: box.querySelectorAll('.katex-error').length, h1: box.querySelectorAll('.rp-h1').length, ids: ids.size,
        last: [...box.querySelectorAll('.rp-h1')].pop().textContent.trim() }; });
    const pdf = await p.pdf({ format: 'Letter', preferCSSPageSize: true }), np = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    await p.emulateMedia({ media: 'screen' }); await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    assert.deepEqual(L.dead, [], `${tag}: links without a target`); assert.deepEqual(L.noSec, [], `${tag}: "see §" without its section`); assert.equal(L.bad, 0, `${tag}: §?`); assert.equal(L.kerr, 0, `${tag}: KaTeX errors`);
    assert.ok(L.links > 200 && L.sees > 100, JSON.stringify(L)); pages[tag] = np;
    ok(`${tag}: printed ${np} pages (Letter), ${L.h1} sections, last "${L.last}"; ${L.links} in-document links and ${L.sees} "see §", each with its target; 0 KaTeX errors`);
    return L;
  };
  // 1. the default
  { const c = await p.evaluate(() => ({ w: (document.querySelector('[data-rpworked="all"]') || {}).checked, a: (document.querySelector('[data-rprtapp]') || {}).checked, ad: (document.querySelector('[data-rprtapp]') || {}).disabled,
      lab: (document.getElementById('rpWorked') || {}).textContent }));
    assert.equal(c.w, false); assert.equal(c.a, false); assert.equal(c.ad, false); assert.match(c.lab, /Work every girder line in full/); assert.match(c.lab, /Full rating table \(appendix\)/);
    const S = await p.evaluate(() => { const h = [...document.querySelectorAll('#rptHost .rp-doc .rp-h2')].find(x => /Girder lines not worked in full/.test(x.textContent)), s = h && h.closest('.rp-sub'), tb = s && s.querySelector('table');
      const rows = tb ? [...tb.querySelectorAll('tbody tr')].map(r => [...r.cells].map(c => c.textContent.trim())) : [], links = s ? [...s.querySelectorAll('a[href^="#"]')] : [];
      return { rows, n: links.length, dead: links.filter(a => !document.getElementById(a.getAttribute('href').slice(1))).length, text: s ? s.textContent : '',
        secs: [...document.querySelectorAll('#rptHost .rp-doc .rp-h1')].map(x => x.textContent.trim()), rt: [...document.querySelectorAll('#rptHost .rp-doc .rp-h2')].map(x => x.textContent.trim()).filter(t => /Rating factors at/.test(t)) }; });
    assert.deepEqual(S.rows.map(r => r[0]), ['G2', 'G3', 'G1', 'G4']); assert.ok(S.rows.every(r => /^(PASS|FAIL)/.test(r[r.length - 3])), JSON.stringify(S.rows[0]));
    assert.match(S.rows[1][S.rows[1].length - 2], /^see §\d+–§\d+ \(G2\)$/); assert.match(S.rows[3][S.rows[3].length - 2], /^see §\d+–§\d+ \(G1\)$/);
    assert.ok(S.n >= 8 && S.dead === 0, `${S.n} summary links, ${S.dead} dead`); assert.match(S.text, /the line with the highest controlling D\/C/);
    assert.ok(/Section properties: Interior S1 on G2, span 1$/.test(S.secs[4]) && S.secs.some(t => /Section properties: Exterior S1 on G1, span 1$/.test(t)) && !S.secs.some(t => /on G[34],/.test(t)), S.secs.slice(3, 6).join(' | '));
    assert.equal(S.rt.length, 2); assert.ok(S.rt.every(t => /Rating factors at the governing stations \(\d+ of 179\)$/.test(t)), S.rt.join(' | '));
    ok(`default: each type on its governing line (G2, G1; ${S.secs.length} sections); §1 summary rows ${S.rows.map(r => r[0]).join(', ')}, ${S.n} links with their targets; rating: ${S.rt[0].replace(/^[\d.]+\s*/, '')}`);
    // a click on G3's link: the worked sections of Interior S1 on G2
    const j = await p.evaluate(() => { const h = [...document.querySelectorAll('#rptHost .rp-doc .rp-h2')].find(x => /Girder lines not worked in full/.test(x.textContent)), tr = [...h.closest('.rp-sub').querySelectorAll('tbody tr')].find(r => r.cells[0].textContent.trim() === 'G3');
      const a = tr.querySelector('a[href^="#"]'), id = a.getAttribute('href').slice(1); a.click(); const el = document.getElementById(id), r = el.getBoundingClientRect();
      return { t: a.textContent, h: ((el.closest('section') || el).querySelector('.rp-h1') || el).textContent.trim(), inView: r.top >= -2 && r.top < innerHeight }; });
    await p.waitForTimeout(500);
    assert.ok(/Section properties: Interior S1 on G2, span 1$/.test(j.h) && j.inView, JSON.stringify(j)); ok(`default: G3's link ${j.t} opens "${j.h}"`);
    if (SHOTS) { const sh = async (re, f) => { const h = await p.evaluateHandle(re => [...document.querySelectorAll('#rptHost .rp-doc .rp-h2')].find(x => new RegExp(re).test(x.textContent)).closest('.rp-sub'), re);
        await h.asElement().scrollIntoViewIfNeeded(); await p.waitForTimeout(300); await h.asElement().screenshot({ path: path.join(SHOTS, f) }); };
      await sh('Girder lines not worked in full', 'ps-report-summary.png'); await sh('Rating factors at the governing stations', 'ps-report-rating.png'); }
    await printed('default'); }
  // 2. the appendix
  { await p.evaluate(() => document.querySelector('[data-rprtapp]').click()); await built(31);
    const A = await p.evaluate(() => { const s = [...document.querySelectorAll('#rptHost .rp-doc section')].filter(x => x.querySelector(':scope .rp-h1')).pop(), h = s.querySelector('.rp-h1').textContent.trim();
      const subs = [...s.querySelectorAll('.rp-sub')].map(q => ({ t: q.querySelector('.rp-h2').textContent.trim(), rows: q.querySelectorAll('table tbody tr').length, back: [...q.querySelectorAll('a[href^="#"]')].map(a => a.textContent) }));
      const fwd = [...document.querySelectorAll('#rptHost .rp-doc .rp-sub')].filter(q => /Rating factors at the governing stations/.test((q.querySelector('.rp-h2') || {}).textContent || '')).map(q => [...q.querySelectorAll('a[href^="#"]')].map(a => a.textContent).join(' '));
      return { h, subs, fwd }; });
    assert.match(A.h, /^31\.? ?Appendix: rating factors at every station$/); assert.equal(A.subs.length, 2);
    assert.ok(A.subs.every(q => q.rows === 179 && q.back.some(t => /^§\d+$/.test(t))), JSON.stringify(A.subs.map(q => [q.t, q.rows, q.back])));
    assert.ok(A.fwd.length === 2 && A.fwd.every(t => /§31\.[12]/.test(t)), JSON.stringify(A.fwd)); assert.equal((await ui()).rtApp, true);
    ok(`appendix: "${A.h}", ${A.subs.map(q => `${q.t.replace(/^[\d.]+\s*/, '')}: ${q.rows} rows`).join('; ')}; linked both ways`);
    await printed('default + appendix'); }
  // 3. every girder line in full
  { await p.evaluate(() => document.querySelector('[data-rpworked="all"]').click()); await built(54);
    const F = await p.evaluate(() => ({ ln: [...document.querySelectorAll('#rptHost .rp-doc .rp-h2')].some(x => /Girder lines not worked in full/.test(x.textContent)), gov: /Rating factors at the governing stations/.test(document.querySelector('#rptHost .rp-doc').textContent),
      app: [...document.querySelectorAll('#rptHost .rp-doc .rp-h1')].some(x => /Appendix/.test(x.textContent)), dis: document.querySelector('[data-rprtapp]').disabled, chk: document.querySelector('[data-rprtapp]').checked,
      w: document.querySelector('[data-rpworked="all"]').checked, lines: [...document.querySelectorAll('#rptHost .rp-doc .rp-h1')].filter(x => /Section properties:/.test(x.textContent)).map(x => x.textContent.replace(/^.*: /, '')) }));
    assert.ok(F.w && !F.ln && !F.gov && !F.app && F.dis && !F.chk, JSON.stringify(F)); assert.deepEqual(F.lines, ['Interior S1 on G2, span 1', 'Interior S1 on G3, span 1', 'Exterior S1 on G1, span 1', 'Exterior S1 on G4, span 1']);
    assert.equal((await ui()).worked, 'all');
    ok(`every girder line in full: ${F.lines.length} lines worked, no line summary, the rating tables as before, the appendix box greyed`);
    await printed('every line in full');
    await p.evaluate(() => document.querySelector('[data-rpworked="all"]').click()); await built(31); assert.equal((await ui()).worked, 'gov'); ok('unticked: back to the default (with the appendix chosen before)'); }
  // display only
  assert.equal(await p.evaluate(() => localStorage.getItem('psb2.project.current')), proj0, 'the project unchanged');
  const keys = await p.evaluate(() => Object.keys(localStorage)); assert.ok(keys.every(k => /^psb2\./.test(k)), keys.join(', '));
  assert.deepEqual(errs, [], 'console errors');
  ok(`the project unchanged, psb2.* keys only (${keys.length}), 0 console errors; pages: ${Object.entries(pages).map(([k, v]) => `${k} ${v}`).join(', ')}`);
} finally { await b.close(); }
console.log(`\n${n} checks passed`);
