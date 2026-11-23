#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html), report package (2026-11-23; report/builders.js exec, basis, bom, sign, ptSub): the Report tab's
// Executive summary, Basis of design, Bill of materials, Sign-off and the design-point headers. Headless Chromium, file://, the CDN
// libraries from tests/libs. A new project (made up: two girder types on five lines), 1400 px and 390 px.
//   1. the Report opens with "1. Executive summary": the verdict banner = the Summary tab's badge and counts; one row per check group;
//      every "see §" link of the section has its target in the report; a click on the governing link moves to its worked step;
//   2. Basis of design (after the project section), Bill of materials and Sign-off (last) are there with their tables; the assumptions
//      stay in the project section; a design-point header stands before the worked steps of Stresses, Flexure, Shear, End zone, Camber;
//   3. the section chips leave each new section out and bring it back; the choice is kept in psb2.ui only;
//   4. print emulation: the banner and the tables are shown, the report's controls hidden; at 390 px the page does not scroll sideways;
//   5. display only: the project text is unchanged, no key other than psb2.* is written, 0 console errors, 0 KaTeX errors.
//   node tests/smoke/ps-bridge-report-pkg.mjs [--shots <dir>]
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const FILE = path.join(REPO, 'apps/ps-bridge/index.html');
const ai = process.argv.indexOf('--shots'), SHOTS = ai > 0 ? process.argv[ai + 1] : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const until = async (f, ms, w) => { const t0 = Date.now(); for (;;) { if (await f()) return; if (Date.now() - t0 > ms) throw new Error('timeout: ' + w); await new Promise(r => setTimeout(r, 200)); } };
for (const [vw, vh] of [[1400, 1000], [390, 844]]) {
  const { b, p, errs } = await openPage(FILE, { vw, vh });
  const otab = t => p.evaluate(t => document.querySelector(`#tabBar [data-otab="${t}"]`).click(), t);
  const proj = () => p.evaluate(() => localStorage.getItem('psb2.project.current'));
  const secs = () => p.evaluate(() => [...document.querySelectorAll('.rp-doc .rp-h1')].map(h => h.textContent.trim().replace(/\s+/g, ' ')));
  try {
    await p.waitForSelector('#tabBar [data-otab]');
    await p.evaluate(() => { localStorage.clear(); const P = PSBModel.newProject(); P.project.name = 'Report package smoke (made up)'; P.project.designer = 'A. Made-Up'; P.project.checker = 'B. Checker'; P.project.date = '2026-11-23'; localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P)); });
    await p.reload(); await p.waitForSelector('#tabBar [data-otab]'); await p.waitForTimeout(400);
    // the Summary tab's verdict
    await otab('sum'); await until(() => p.evaluate(() => /PASS|FAIL|REVIEW/.test((document.querySelector('.sum-badge') || {}).textContent || '')), 120000, 'the Summary');
    const S = await p.evaluate(() => ({ badge: document.querySelector('.sum-badge').textContent.trim(), cnt: [...document.querySelectorAll('.sum-cnt span')].map(x => x.textContent.trim()) }));
    const P0 = await proj();
    // 1. the Executive summary
    await otab('rpt'); await p.waitForSelector('.rp-doc .rp-step', { timeout: 180000 }); await p.waitForTimeout(500);
    const keys0 = (await p.evaluate(() => Object.keys(localStorage))).sort();
    const T = await secs();
    assert.match(T[0], /^1\.? ?Executive summary/, T[0]); assert.match(T[1], /Summary of checks/); assert.match(T[2], /Project, basis and assumptions/); assert.match(T[3], /Basis of design/);
    assert.match(T[T.length - 2], /Bill of materials/); assert.match(T[T.length - 1], /Sign-off and revision history/);
    const E = await p.evaluate(() => { const s = document.querySelector('.rp-doc section[data-rpsec="rp-s1"]'), svg = s.querySelector('figure svg'), tb = [...s.querySelectorAll('table')];
      const links = [...s.querySelectorAll('a.rp-see')], dead = links.filter(a => !document.getElementById((a.getAttribute('href') || '').slice(1))).length;
      return { verdict: svg.getAttribute('aria-label'), sub: svg.querySelectorAll('text')[1].textContent, rows: [...tb[0].querySelectorAll('tbody tr')].map(r => [...r.cells].map(c => c.textContent.trim())),
        head: [...tb[0].querySelectorAll('thead th')].map(c => c.textContent.trim()), out: tb[1] ? [...tb[1].querySelectorAll('tbody tr')].map(r => r.cells[0].textContent.trim()) : [], links: links.length, dead, w: svg.getBoundingClientRect().width, text: s.textContent }; });
    assert.equal(E.verdict, S.badge, 'the verdict = the Summary tab\'s badge'); S.cnt.filter(t => /FAIL|PASS/.test(t)).forEach(t => assert.ok(E.sub.includes(t), `${t} in ${E.sub}`));
    assert.deepEqual(E.head, ['Limit state / check group', 'Governing check', 'Girder type, line', 'Location', 'D/C', 'Status', 'Worked']);
    assert.ok(E.rows.length >= 6 && E.rows.every(r => /on G\d+, span \d+/.test(r[2]) && /^\d+\.\d{3}$/.test(r[4]) && /^(PASS|FAIL|REVIEW)$/.test(r[5]) && /§\d+/.test(r[6])), JSON.stringify(E.rows.slice(0, 2)));
    assert.ok(E.out.some(t => /Load rating: lowest HL-93 inventory rating factor/.test(t)), 'not included in the verdict: the rating factor'); assert.ok(/Governing D\/C: \d+\.\d{3}/.test(E.text));
    assert.ok(E.links >= E.rows.length && E.dead === 0, `${E.links} links, ${E.dead} without a target`); assert.ok(E.w > 200, 'banner drawn');
    ok(`${vw} px: Executive summary first: ${E.verdict} = the Summary tab's (${E.sub}); ${E.rows.length} check-group rows; ${E.links} "see §" links, each with its target`);
    const sc = () => p.evaluate(() => { const o = document.getElementById('outputPanel'); return (o ? o.scrollTop : 0) + window.scrollY; });
    const y0 = await sc(); await p.evaluate(() => document.querySelector('.rp-doc section[data-rpsec="rp-s1"] p a.rp-see').click()); await p.waitForTimeout(700);
    assert.notEqual(await sc(), y0, 'the governing link moved to its step'); ok(`${vw} px: the governing D/C link jumps to its worked step`);
    // 2. the other sections
    const O = await p.evaluate(() => { const by = t => [...document.querySelectorAll('.rp-doc section.rp-sec, .rp-doc section[data-rpsec]')].find(s => new RegExp(t).test((s.querySelector('.rp-h1') || {}).textContent || ''));
      const h2 = s => [...s.querySelectorAll('.rp-h2')].map(h => h.textContent.trim().replace(/^\S+\s+/, '')), bs = by('Basis of design'), bm = by('Bill of materials'), sg = by('Sign-off'), pj = by('Project, basis and assumptions');
      const pts = [...document.querySelectorAll('.rp-doc .rp-h2')].filter(h => /Design points: where each check of this section governs/.test(h.textContent)).map(h => { const nx = h.closest('.rp-sub').nextElementSibling; return /Worked steps/.test((nx && nx.querySelector('.rp-h2') || {}).textContent || ''); });
      return { basis: h2(bs), basisT: bs.textContent, bom: h2(bm), bomTables: bm.querySelectorAll('table').length, bomT: bm.textContent, sign: sg.textContent, seal: !!sg.querySelector('svg[aria-label="P.E. seal"]'), asm: h2(pj).some(t => /^Assumptions/.test(t)), pts,
        kerr: document.querySelectorAll('.rp-doc .katex-error').length, bad: (document.querySelector('.rp-doc').textContent.match(/§\?|NaN|undefined/g) || []).length }; });
    assert.deepEqual(O.basis.map(t => t.replace(/ \(.*$/, '')), ['Specification and owner', 'Materials', 'Resistance factors', 'Load combinations and load factors', 'Live load', 'Analysis method', 'Prestress loss method', 'Owner rules in effect', 'Assumptions']);
    assert.ok(/AASHTO LRFD 10th Ed\. \(2024\)/.test(O.basisT) && /Strength I/.test(O.basisT) && /1\.75/.test(O.basisT) && /33 % on the truck and the tandem/.test(O.basisT) && /refined estimate/.test(O.basisT));
    assert.ok(O.asm, 'the assumptions list stays in the project section');
    assert.ok(O.bomTables >= 4 && /Bridge total/.test(O.bomT) && /Not included in this bill of materials/.test(O.bomT) && /Check, Interior/.test(O.bomT), 'bill of materials');
    assert.ok(/Designed by\s*A\. Made-Up/.test(O.sign) && /Checked by\s*B\. Checker/.test(O.sign) && /Approved by/.test(O.sign) && O.seal, 'sign-off');
    assert.ok(O.pts.length >= 10 && O.pts.every(Boolean), `design-point headers before the worked steps: ${O.pts.length}`);
    assert.equal(O.kerr, 0, 'KaTeX errors'); assert.equal(O.bad, 0, '§? / NaN / undefined');
    ok(`${vw} px: Basis of design (${O.basis.length} subsections), Bill of materials (${O.bomTables} tables), Sign-off (project names, seal box), ${O.pts.length} design-point headers; 0 KaTeX errors`);
    if (SHOTS) for (const [t, f] of [['Executive summary', 'exec'], ['Basis of design', 'basis'], ['Bill of materials', 'bom']]) {
      const h = await p.evaluateHandle(t => [...document.querySelectorAll('.rp-doc .rp-h1')].find(x => x.textContent.includes(t)).closest('section'), t); await h.asElement().scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
      await h.asElement().screenshot({ path: path.join(SHOTS, `ps-report-${f}-${vw}.png`) }); }
    // 3. the chips
    for (const [k, t] of [['exec', 'Executive summary'], ['basis', 'Basis of design'], ['bom', 'Bill of materials'], ['sign', 'Sign-off']]) {
      await p.evaluate(k => document.querySelector(`[data-rpinc="${k}"]`).click(), k); await p.waitForSelector('.rp-doc .rp-step'); await p.waitForTimeout(300);
      assert.ok(!(await secs()).some(x => x.includes(t)), `${t} left out`);
      assert.equal(await p.evaluate(() => (document.querySelector('.rp-doc').textContent.match(/§\?/g) || []).length), 0, `no broken link without ${t}`);
      await p.evaluate(k => document.querySelector(`[data-rpinc="${k}"]`).click(), k); await p.waitForSelector('.rp-doc .rp-step'); await p.waitForTimeout(300);
      assert.ok((await secs()).some(x => x.includes(t)), `${t} back`); }
    ok(`${vw} px: each new section's chip leaves it out (no broken link) and brings it back`);
    // 4. print emulation; no sideways scroll on a phone
    await p.emulateMedia({ media: 'print' });
    const pr = await p.evaluate(() => { const s = document.querySelector('.rp-doc section[data-rpsec="rp-s1"]'), svg = s.querySelector('figure svg'); return { banner: getComputedStyle(svg).display !== 'none' && svg.getBoundingClientRect().width > 100, bar: getComputedStyle(document.querySelector('.rp-bar')).display }; });
    await p.emulateMedia({ media: 'screen' });
    assert.ok(pr.banner, 'the banner prints'); assert.equal(pr.bar, 'none', 'the controls are hidden in print');
    const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); assert.ok(over <= 2, `sideways scroll ${over} px`);
    ok(`${vw} px: print: the banner shown, the controls hidden; no sideways page scroll (${over} px)`);
    // 5. display only
    assert.equal(await proj(), P0, 'the project text is unchanged');
    const keys1 = (await p.evaluate(() => Object.keys(localStorage))).sort(); assert.ok(keys1.every(k => /^psb2\./.test(k)), keys1.join(', ')); assert.deepEqual(keys1, keys0);
    assert.deepEqual(errs, [], 'console errors');
    ok(`${vw} px: the project unchanged, psb2.* keys only (${keys1.length}), 0 console errors`);
  } finally { await b.close(); }
}
console.log(`\n${n} checks passed`);
