#!/usr/bin/env node
// Spread Footing: narrow wall footing, development NG and the plain-concrete remedy in both directions (SFNW, engineer report 2026-11-11).
// Headless Chromium, file://, the pinned libraries from tests/libs:
//   1. hand check: B = 2 ft (x, across the wall) x L = 20 ft, t = 12 in, a 12 in wall 19 ft long (stops 6 in short of each end),
//      direct factored load 3 kip/ft (P = 57 kip), f'c = 4000 psi, f_y = 60 ksi, #4 @ 12 both ways, 3 in cover, no soil cover.
//      q_u = 57/(2 x 20) = 1.425 ksf. Across (x): M_u = 1.425 x 0.5 x 20 x 0.25 = 3.5625 kip-ft at the wall face;
//      along (y): M_u = 1.425 x 0.5 x 2 x 0.25 = 0.35625 kip-ft at the wall END face. Available l = 6 - 3 = 3 in in both.
//      #4: l_d = max((3/40)(60000/63.25)(0.8/2.5)(0.5), 12) = max(11.38, 12) = 12 in; l_dh = max(5.28, 4, 6) = 6 in > 3: NG both.
//      Before (and with the field '' or 'x'): development NG (x and y; with 'x', y still NG). Options point to plain concrete.
//      After, plain 'xy': x: S_m = 240 x 10^2/6 = 4000 in^3, phi M_n = 0.6 x 5 x 63.246 x 4000/12000 = 63.246 kip-ft, D/C 0.0563;
//      y: S_m = 24 x 100/6 = 400 in^3, phi M_n = 6.325 kip-ft, D/C 0.0563; one-way shear at h beyond the edges (n/a both);
//      the h/2 = 6 in two-way section reaches both x edges (clear 6 in): no two-way action; development PASS (no rows).
//   2. 'xy' on an isolated 6 x 6 ft footing under a 2 x 2 ft pedestal (clear 24 in > h/2): ignored with a warning; P2 identical to ''.
//   3. labels: "across the wall" / "along the wall" in the plain options and the development rows; 0 console errors; 390 px.
//   node tests/smoke/spread-footing-narrow.mjs [--file <file or git ref>] [--shots <dir>]
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

const NARROW = "state.loadMode='direct';state.geom.B=2;state.geom.L=20;state.geom.t=1;state.geom.Df=1;state.ev.cover=0;state.peds=[state.peds[0]];const p=state.peds[0];p.label='Wall';p.x=0;p.y=0;p.bx=1;p.by=19;p.h=0;"
  + "p.direct={P:57,Vx:0,Vy:0,Mx:0,My:0};state.freinf.botX={size:4,spc:12,mode:'spacing'};state.freinf.botY={size:4,spc:12,mode:'spacing'};";
const ISO = "state.loadMode='direct';state.geom.B=6;state.geom.L=6;state.geom.t=1;state.geom.Df=1;state.ev.cover=0;state.peds=[state.peds[0]];const p=state.peds[0];p.x=0;p.y=0;p.bx=2;p.by=2;p.h=0;p.direct={P:100,Vx:0,Vy:0,Mx:0,My:0};";
const o = await openPage(SRC.file, {});
await o.p.waitForSelector('#tabbar button[data-tab="tab-report"]');
await o.p.waitForTimeout(1500);
const setup = src => o.p.evaluate(src => { state = defaultState(); migrateState(); SEL.asd = null; SEL.lrfd = null; SEL.asdLr = null; (new Function('state', src))(state); bindStaticInputs(); buildPedCards(); recalc(); }, src);
const get = () => o.p.evaluate(() => ({ plain: P2.plain ? { dir: P2.plain.dir, applies: P2.plain.applies, ok: P2.plain.ok, dc: P2.plain.dc, X: P2.plain.X || null, Y: P2.plain.Y || null } : null,
  dev: (P2.dev ? P2.dev.rows : []).map(z => ({ k: z.k, st: z.status, Ld: z.LdUse, Ldh: z.Ldh, avail: z.avail, lab: z.lab, rem: sfdDevRemedy(z).join(' | ') })),
  desX: { Mu: P2.desX.MuPos }, desY: { Mu: P2.desY.MuPos },
  chips: Object.fromEntries([...document.querySelectorAll('.chip')].map(c => [c.querySelector('.cn').textContent.replace(/^[▸▾]/, ''), c.className.replace('chip ', '') + ' | ' + c.querySelector('.cv').textContent])),
  warn: JSON.stringify(R.W || []) }));
const js = () => o.p.evaluate(() => { const j = v => { const seen = new WeakSet(); return JSON.parse(JSON.stringify(v, (k, x) => { if (typeof x === 'function') return undefined; if (x && typeof x === 'object') { if (seen.has(x)) return '[cyc]'; seen.add(x); } return (typeof x === 'number' && !isFinite(x)) ? String(x) : x; })); }; return { R: j(R), P2: j(P2) }; });
const shot = async (sel, name) => { if (!args.shots) return; await o.p.evaluate(s => { const e = document.querySelector(s); if (e) e.scrollIntoView({ block: 'start' }); }, sel); await o.p.waitForTimeout(500); await o.p.screenshot({ path: path.join(args.shots, name) }); };

console.log('1. narrow wall footing 2 x 20 ft, wall 19 ft');
await setup(NARROW);
const A = await get();
console.log('     reinforced: ' + JSON.stringify(A.dev.map(z => [z.k, z.st, z.Ld, z.Ldh, z.avail])));
check(near(A.desX.Mu, 3.5625) && near(A.desY.Mu, 0.35625), 'M_u across 3.5625, along (wall end) 0.35625 kip-ft');
const ax = A.dev.find(z => z.k === 'botX'), ay = A.dev.find(z => z.k === 'botY');
check(ax && ay && ax.st === 'fail' && ay.st === 'fail' && near(ax.Ld, 12) && near(ax.Ldh, 6) && near(ax.avail, 3) && near(ay.avail, 3), 'reinforced: x and y NG (l_d 12, l_dh 6 > 3 in)');
check(/across the wall/.test(ax.lab) && /along the wall/.test(ay.lab), 'rows labelled across / along the wall');
check(/plain concrete in both directions/.test(ax.rem) && /Reinforcement tab/.test(A.chips['Footing bar development']), 'NG points to plain concrete in both directions (Reinforcement tab)');
await o.p.click('#tabbar button[data-tab="tab-footdes"]'); await o.p.waitForTimeout(900);
check(await o.p.evaluate(() => /Options:/.test(document.getElementById('o-fd-dev').innerText) && /never less than 12 in/.test(document.getElementById('o-fd-dev').innerText)), 'Footing Design 5.4: options and the 12 in minimum explained');
await shot('#o-fd-dev', 'sfnw-reinforced-dev.png');
await setup(NARROW + "state.freinf.plain='x';");
const Bx = await get();
check(!Bx.dev.some(z => z.k === 'botX') && Bx.dev.some(z => z.k === 'botY' && z.st === 'fail' && /both directions/.test(z.rem)), "plain 'x': y (along the wall) still NG; options: both directions");
await setup(NARROW + "state.freinf.plain='xy';");
const C = await get(), X = C.plain.X, Y = C.plain.Y;
console.log('     plain xy: ' + JSON.stringify({ X: [X.Sm, X.phiMn, X.Mu, X.dcrM, X.anyV], Y: [Y.Sm, Y.phiMn, Y.Mu, Y.dcrM, Y.anyV], ok: C.plain.ok }));
check(C.plain.applies && near(X.Sm, 4000) && near(X.phiMn, 63.246) && near(X.dcrM, 0.05633, 0.003), 'x: S_m 4000 in^3, phi M_n 63.25 kip-ft, D/C 0.0563');
check(near(Y.Sm, 400) && near(Y.phiMn, 6.3246) && near(Y.Mu, 0.35625) && near(Y.dcrM, 0.05633, 0.003), 'y: S_m 400 in^3, phi M_n 6.325 kip-ft, D/C 0.0563');
check(!X.anyV && !Y.anyV && C.plain.ok && C.dev.length === 0, 'one-way shear n/a both; PASS; no development rows');
check(/pass/.test(C.chips['Plain concrete (ACI 318-19 Ch. 14)'] || '') && /x-direction \(across the wall\)/.test(C.chips['Plain concrete (ACI 318-19 Ch. 14)']) && /y-direction \(along the wall\)/.test(C.chips['Plain concrete (ACI 318-19 Ch. 14)']) && !/fail/.test(C.chips['Footing bar development'] || 'pass'), 'chips: plain pass (both directions named), development not failing');
check(/pass/.test(C.chips['Flexure (footing)'] || ''), 'flexure chip pass');
await o.p.click('#tabbar button[data-tab="tab-footdes"]'); await o.p.waitForTimeout(900);
{ const t = await o.p.evaluate(() => document.getElementById('tab-footdes').innerText);
  check(/Development of the x-bars: not required/.test(t) && /Development of the y-bars: not required/.test(t) && /Both directions plain/.test(t), 'Footing Design: both directions not required, two-way note');
  await shot('#o-fd-dev', 'sfnw-plain-xy-dev.png'); }
await o.p.click('#tabbar button[data-tab="tab-report"]'); await o.p.waitForTimeout(1500);
{ const r = await o.p.evaluate(() => ({ text: SFRP.doc ? SharedReport.text(SFRP.doc) : '', err: /Report error/.test(document.getElementById('tab-report').innerText), katex: document.querySelectorAll('.katex-error').length }));
  check(!r.err && r.katex === 0, 'Report renders, 0 KaTeX errors');
  check((r.text.match(/plain concrete \(ACI 318-19 Ch\. 14\)/g) || []).length >= 2 && /Both directions plain/.test(r.text), 'Report works both plain directions'); }
await setup(NARROW);
await o.p.click('#tabbar button[data-tab="tab-report"]'); await o.p.waitForTimeout(1500);
{ const r = await o.p.evaluate(() => ({ text: SFRP.doc ? SharedReport.text(SFRP.doc) : '', katex: document.querySelectorAll('.katex-error').length }));
  check(r.katex === 0 && /Not developed at x = 0\.500 ft/.test(r.text) && /plain concrete in both directions/.test(r.text), 'Report: options under the NG development'); }
{ const dx = await o.p.evaluate(() => { state.freinf.plain = 'xy'; recalc(); renderDrawings(); const t = SFDW.B.D.toDXF({ ltscale: 1 }); return (t.match(/NOMINAL \(PLAIN CONC\.\)/g) || []).length; });
  check(dx >= 2, 'drawings: both mats marked nominal in the schedule (' + dx + ')'); }

console.log('2. both directions where the plain two-way section closes: ignored');
await setup(ISO); const J0 = await js();
await setup(ISO + "state.freinf.plain='xy';"); const J1 = await js(); const D = await get();
const dP = diff(J0.P2, J1.P2).filter(d => !/^\.plain/.test(d[0])), dR = diff(J0.R, J1.R).filter(d => !/^\.W/.test(d[0]));
check(D.plain && D.plain.applies === false && dP.length === 0 && dR.length === 0, "'xy' ignored, results identical to '' (" + dP.length + '/' + dR.length + ' diffs)');
check(/Plain concrete in both directions \(Reinforcement tab\) is ignored here/.test(D.warn), 'warning names the plain two-way check');
check(!/across the wall/.test(JSON.stringify(D.dev)), 'isolated footing: no wall labels');

console.log('3. input labels, 390 px');
await setup(NARROW);
await o.p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === 'Reinforcement'); if (b) b.click(); });
await o.p.waitForTimeout(300);
const opts = await o.p.$$eval('select[data-path="freinf.plain"] option', a => a.map(e => e.value + '=' + e.textContent));
console.log('     ' + opts.join(' / '));
check(opts.some(t => /^x=.*across the wall/.test(t)) && opts.some(t => /^y=.*along the wall/.test(t)) && opts.some(t => /^xy=Both directions/.test(t)), 'options: x (across the wall), y (along the wall), both');
await o.p.selectOption('select[data-path="freinf.plain"]', 'xy'); await o.p.waitForTimeout(600); await o.p.evaluate(() => recalc());
check(await o.p.evaluate(() => state.freinf.plain === 'xy' && P2.plain && P2.plain.ok), 'choosing Both stores plain = xy');
await shot('select[data-path="freinf.plain"]', 'sfnw-input.png');
await o.p.setViewportSize({ width: 390, height: 844 }); await o.p.waitForTimeout(600);
await o.p.evaluate(() => document.querySelector('select[data-path="freinf.plain"]').scrollIntoView({ block: 'center' }));
await o.p.waitForTimeout(300);
const sw = await o.p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
check(sw.sw <= sw.cw + 1, 'no horizontal page scroll at 390 px (' + sw.sw + ' vs ' + sw.cw + ')');
if (args.shots) await o.p.screenshot({ path: path.join(args.shots, 'sfnw-390.png') });
check(o.errs.length === 0, '0 console errors' + (o.errs.length ? ': ' + o.errs.slice(0, 3).join(' | ') : ''));
await o.b.close();
console.log(failures ? failures + ' FAILURE(S)' : 'all checks pass');
process.exit(failures ? 1 : 0);
