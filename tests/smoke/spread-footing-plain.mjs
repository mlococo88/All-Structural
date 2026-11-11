#!/usr/bin/env node
// Spread Footing: one direction of a footing with one bearing element as plain concrete, ACI 318-19 Ch. 14 (SFPL, engineer 2026-11-11).
// Headless Chromium, file://, the pinned libraries from tests/libs:
//   1. hand check: strip footing B = 2 ft (x, transverse) x L = 4 ft, t = 12 in, under a 12 in wall (bearing footprint 1 x 4 ft),
//      f'c = 4000 psi, direct factored wall load 3 kip/ft (P = 12 kip), no soil cover; bottom x #4 @ 12 (transverse), bottom y #4 @ 9.
//      q_u = 3/2 = 1.5 ksf; M_u at the wall face = 1.5 x 0.5^2/2 = 0.1875 kip-ft/ft (0.75 kip-ft over L = 4 ft);
//      S_m = 12 x (12 - 2)^2/6 = 200 in^3/ft (800 in^3 over 48 in); M_n = 5 x 1 x 63.25 x 200/12000 = 5.270 kip-ft/ft;
//      phi M_n = 0.60 x 5.270 = 3.162 kip-ft/ft (12.649 total); D/C = 0.1875/3.162 = 0.0593;
//      one-way shear: the section at h = 12 in from the face (0.5 + 1.0 = 1.5 ft) is beyond the edge (1.0 ft): not applicable
//      (phi V_n = 0.60 x 4/3 x 63.25 x 12 x 10/1000 = 6.07 kip/ft for information).
//      Before (reinforced, field absent): x-bars development NG (l_d 12, l_dh 6 > 3 in) and A_s < A_s,min (bottom x);
//      after (plain x): PASS, development of x not required, flexure chip pass.
//   2. a 6 ft wide footing, 30 kip/ft: q_u = 5 ksf, M_u = 5 x 2.5^2/2 = 15.625 kip-ft/ft, D/C = 4.94 NG; V_u at h (1.5 ft from the
//      centre) = 5 x 1.5 = 7.5 kip/ft vs 6.07: D/C 1.235 NG.  t = 0.75 ft: h = 9 in OK; t = 0.6 ft (7.2 in): h < 8 in NG.
//   3. absent / '' = identical R and P2; two bearing elements: the input is ignored (warning), results identical to absent.
//   4. Report and Footing Design work the steps; drawings mark the x-bars nominal; 0 console errors; 390 px.
//   node tests/smoke/spread-footing-plain.mjs [--file <file or git ref>] [--shots <dir>]
import fs from 'fs';
import path from 'path';
import { openPage, resolveFile, diff } from '../lib.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) { if (!av[i].startsWith('--')) continue; const k = av[i].slice(2); args[k] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true; }
const TOOL = 'Spread Footing.html';
const SRC = resolveFile(args.file || TOOL, TOOL);
if (args.shots) fs.mkdirSync(args.shots, { recursive: true });
let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL ' + msg); } else console.log('  ok   ' + msg); };
const near = (a, b, t = 0.002) => Math.abs(a - b) <= t * Math.max(1, Math.abs(b));

const STRIP = (B, P, t) => "state.loadMode='direct';state.geom.B=" + B + ";state.geom.L=4;state.geom.t=" + t + ";state.geom.Df=1;state.ev.cover=0;state.peds=[state.peds[0]];const p=state.peds[0];p.label='Wall';p.x=0;p.y=0;p.bx=1;p.by=4;p.h=0;"
  + "p.direct={P:" + P + ",Vx:0,Vy:0,Mx:0,My:0};state.freinf.botX={size:4,spc:12,mode:'spacing'};state.freinf.botY={size:4,spc:9,mode:'spacing'};";
const o = await openPage(SRC.file, {});
await o.p.waitForSelector('#tabbar button[data-tab="tab-report"]');
await o.p.waitForTimeout(1500);
const setup = src => o.p.evaluate(src => { state = defaultState(); migrateState(); SEL.asd = null; SEL.lrfd = null; SEL.asdLr = null; (new Function('state', src))(state); bindStaticInputs(); buildPedCards(); recalc(); }, src);
const get = () => o.p.evaluate(() => ({ plain: P2.plain || null, dev: (P2.dev ? P2.dev.rows : []).map(z => [z.k, z.status]),
  chips: Object.fromEntries([...document.querySelectorAll('.chip')].map(c => [c.querySelector('.cn').textContent.replace(/^[▸▾]/, ''), c.className.replace('chip ', '') + ' | ' + c.querySelector('.cv').textContent])),
  warn: (R.warnings || R.W || []).map ? JSON.stringify(R.warnings || R.W || []) : '' }));
const js = () => o.p.evaluate(() => { const j = v => { const seen = new WeakSet(); return JSON.parse(JSON.stringify(v, (k, x) => { if (typeof x === 'function') return undefined; if (x && typeof x === 'object') { if (seen.has(x)) return '[cyc]'; seen.add(x); } return (typeof x === 'number' && !isFinite(x)) ? String(x) : x; })); }; return { R: j(R), P2: j(P2) }; });

console.log('1. hand check: 2 ft strip, 12 in, 3 kip/ft');
await setup(STRIP(2, 12, 1));
const A = await get();
console.log('     before: dev ' + JSON.stringify(A.dev) + ' | flexure: ' + A.chips['Flexure (footing)']);
check(A.plain === null, 'field absent: no plain check');
check(A.dev.some(z => z[0] === 'botX' && z[1] === 'fail') && /fail/.test(A.chips['Footing bar development'] || ''), 'before: x-bars development NG');
check(/A_s < A_s,min \(bottom x\)/.test(A.chips['Flexure (footing)']), 'before: A_s < A_s,min (bottom x)');
await setup(STRIP(2, 12, 1) + "state.freinf.plain='x';");
const B = await get(), q = B.plain;
console.log('     plain: ' + JSON.stringify({ h: q.h, hs: q.hs, b: q.b, Sm: q.Sm, MnT: q.MnT, phiMn: q.phiMn, Mu: q.Mu, dcrM: q.dcrM, anyV: q.anyV, phiVn: q.phiVn, ok: q.ok }));
check(q.applies && q.h === 12 && q.hs === 10 && q.b === 48 && near(q.Sm, 800), 'h 12, h - 2 = 10 in, b 48 in, S_m 800 in^3 (200 per ft)');
check(near(q.MnT, 21.0815) && near(q.phiMn, 12.6491) && near(q.phiMn / 4, 3.1623), 'M_n 21.08 (5.270/ft), phi M_n 12.65 (3.162/ft) kip-ft');
check(near(q.Mu, 0.75) && near(q.Mu / 4, 0.1875) && near(q.dcrM, 0.0593, 0.005), 'M_u 0.75 (0.1875/ft), D/C 0.0593');
check(!q.anyV && near(q.phiVn / 4, 6.0716), 'shear section at h beyond the edge: not applicable; phi V_n 6.07 kip/ft');
check(q.ok && B.dev.every(z => z[0] !== 'botX' && z[0] !== 'topX'), 'PASS; x development not required (no x row)');
check(/pass/.test(B.chips['Plain concrete (ACI 318-19 Ch. 14)'] || '') && /pass/.test(B.chips['Flexure (footing)']) && !/fail/.test(B.chips['Footing bar development'] || 'pass'), 'chips: plain pass, flexure pass, development not failing');
await o.p.click('#tabbar button[data-tab="tab-footdes"]'); await o.p.waitForTimeout(900);
{ const t = await o.p.evaluate(() => document.getElementById('tab-footdes').innerText);
  check(/plain concrete, ACI 318-19 Ch\. 14/.test(t) && /not required — plain concrete/.test(t) && /Development of the x-bars: not required/.test(t), 'Footing Design: plain section and "not required" notes');
  if (args.shots) { await o.p.evaluate(() => document.getElementById('o-fd-x').scrollIntoView({ block: 'start' })); await o.p.waitForTimeout(500); await o.p.screenshot({ path: path.join(args.shots, 'sfpl-steps-tab.png') }); } }
await o.p.click('#tabbar button[data-tab="tab-report"]'); await o.p.waitForTimeout(1500);
{ const r = await o.p.evaluate(() => ({ text: SFRP.doc ? SharedReport.text(SFRP.doc) : '', err: /Report error/.test(document.getElementById('tab-report').innerText), katex: document.querySelectorAll('.katex-error').length }));
  check(!r.err && r.katex === 0, 'Report renders, 0 KaTeX errors');
  check(/plain concrete \(ACI 318-19 Ch\. 14\)/.test(r.text) && /Plain flexure: demand \/ capacity/.test(r.text) && /not required — plain concrete/.test(r.text), 'Report works the plain steps');
  if (args.shots) { await o.p.evaluate(() => { const all = [...document.querySelectorAll('#tab-report .rp-doc *, #tab-report *')].filter(x => /Plain concrete: thickness and section/.test(x.textContent)); const e = all[all.length - 1]; if (e) { if (e.tagName === 'DETAILS') e.open = true; e.scrollIntoView({ block: 'start' }); } }); await o.p.waitForTimeout(500); await o.p.screenshot({ path: path.join(args.shots, 'sfpl-report.png') }); } }
{ const dx = await o.p.evaluate(() => { renderDrawings(); const t = SFDW.B.D.toDXF({ ltscale: 1 }); return { call: /NOMINAL: PLAIN CONCRETE DIR/.test(t), sch: /NOMINAL \(PLAIN CONC\.\)/.test(t) }; });
  check(dx.call && dx.sch, 'drawings: x-bars marked nominal in the section and the schedule'); }

console.log('2. NG cases');
await setup(STRIP(6, 120, 1) + "state.freinf.plain='x';");
{ const q2 = (await get()).plain; console.log('     ' + JSON.stringify({ Mu: q2.Mu, dcrM: q2.dcrM, Vu: q2.Vu, dcrV: q2.dcrV, ok: q2.ok }));
  check(near(q2.Mu / 4, 15.625) && near(q2.dcrM, 15.625 / 3.16228, 0.003) && !q2.ok, 'M_u 15.625 kip-ft/ft, D/C 4.94: NG');
  check(q2.anyV && near(q2.Vu / 4, 7.5) && near(q2.dcrV, 7.5 / 6.0716, 0.003), 'V_u at h 7.5 kip/ft vs 6.07: D/C 1.235'); }
const chip2 = (await get()).chips['Plain concrete (ACI 318-19 Ch. 14)'] || '';
check(/fail/.test(chip2), 'chip NG');
await setup(STRIP(2, 12, 0.6) + "state.freinf.plain='x';");
{ const q3 = (await get()).plain; check(!q3.hOK && !q3.ok && near(q3.h, 7.2), 'h = 7.2 in < 8 in: NG (14.3.2.1)'); }

console.log('3. absent identical; two elements ignored');
await setup(STRIP(2, 12, 1)); const J0 = await js();
await setup(STRIP(2, 12, 1) + "state.freinf.plain='';"); const J1 = await js();
check(diff(J0.R, J1.R).length === 0 && diff(J0.P2, J1.P2).length === 0, 'plain "" = absent: R and P2 identical');
await setup(''); const D0 = await js();
await setup("state.freinf.plain='y';"); const D1 = await js();
const dP = diff(D0.P2, D1.P2).filter(d => !/^\.plain/.test(d[0])), dR = diff(D0.R, D1.R).filter(d => !/warn|msg/i.test(d[0]));
check(dP.length === 0 && D1.P2.plain && D1.P2.plain.applies === false, 'two pedestals: plain ignored (P2 otherwise identical, ' + dP.length + ' diffs)');
check(await o.p.evaluate(() => /checked only for a footing with one bearing element/.test(document.body.innerText)), 'warning shown');

console.log('4. input, 390 px');
await setup(STRIP(2, 12, 1));
const sel = 'select[data-path="freinf.plain"]';
await o.p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === 'Reinforcement'); if (b) b.click(); });
await o.p.waitForTimeout(300);
check(await o.p.$eval(sel, e => e.value) === '', 'absent reads None');
await o.p.selectOption(sel, 'x'); await o.p.waitForTimeout(600); await o.p.evaluate(() => recalc());
check(await o.p.evaluate(() => state.freinf.plain === 'x' && P2.plain && P2.plain.ok), 'choosing x stores plain = x');
if (args.shots) { await o.p.evaluate(() => document.querySelector('select[data-path="freinf.plain"]').scrollIntoView({ block: 'center' })); await o.p.waitForTimeout(300); await o.p.screenshot({ path: path.join(args.shots, 'sfpl-input.png') }); }
await o.p.setViewportSize({ width: 390, height: 844 }); await o.p.waitForTimeout(600);
await o.p.evaluate(() => document.querySelector('select[data-path="freinf.plain"]').scrollIntoView({ block: 'center' }));
await o.p.waitForTimeout(300);
const sw = await o.p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
check(sw.sw <= sw.cw + 1, 'no horizontal page scroll at 390 px (' + sw.sw + ' vs ' + sw.cw + ')');
if (args.shots) await o.p.screenshot({ path: path.join(args.shots, 'sfpl-390.png') });
check(o.errs.length === 0, '0 console errors' + (o.errs.length ? ': ' + o.errs.slice(0, 3).join(' | ') : ''));
await o.b.close();
console.log(failures ? failures + ' FAILURE(S)' : 'all checks pass');
process.exit(failures ? 1 : 0);
