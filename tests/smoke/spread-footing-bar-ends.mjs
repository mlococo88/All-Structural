#!/usr/bin/env node
// Spread Footing: bar ends of the footing mats, straight / hooked (SFBE, engineer 2026-11-11).
// Headless Chromium, file://, the pinned libraries from tests/libs:
//   1. hand check: a 6 x 6 x 2 ft footing, one 2 x 2 ft pedestal at the centre, #8 at 9 in both ways, f'c = 4000 psi,
//      f_y = 60000 psi, 3 in covers (2 in top). Cantilever 24 in, l_avail = 24 - 3 = 21 in.
//      l_d = 3/40 * 60000/sqrt(4000) * 1.0 / 2.5 * 1.0 = 28.46 in > 21 (straight NG);
//      l_dh = 60000 * 1.0 * 1.0 * 1.25 * 0.8667 / (55 * 63.25) * 1.0 = 18.69 in <= 21 (hook OK);
//      hook of the bottom x-bars (inner layer, z_c = 3 + 1 + 0.5 = 4.5 in): z_c + r_c + 12 d_b = 4.5 + 3.5 + 12 = 20 <= 24 - 2 = 22 in.
//      Not set: REVIEW (as before); Straight: NG, D/C 1.355; Hooked: PASS, D/C = max(18.69/21, 15.5/17.5) = 0.890.
//   2. a 1.5 ft thick footing: hooked: the hook does not fit (4.5 + 15.5 = 20 > 16): NG.
//   3. the absent field gives the same R, P2 as '' (the "Not set" option) and as the field removed; the drawings show the hooks
//      (DXF arcs on the bar layer, schedule leg and length), the 3D view counts the hooks; the Report works the steps.
//   4. 0 console errors; the Reinforcement tab at 390 px has no horizontal page scroll.
//   node tests/smoke/spread-footing-bar-ends.mjs [--file <file or git ref>] [--shots <dir>]
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
const near = (a, b, t = 0.005) => Math.abs(a - b) <= t * Math.max(1, Math.abs(b));

const BASE = "state.geom.B=6;state.geom.L=6;state.geom.t=2;state.peds=[state.peds[0]];const p=state.peds[0];p.x=0;p.y=0;p.bx=2;p.by=2;p.h=2;"
  + "p.loads.D.P=100;p.loads.L.P=50;p.loads.Wx.Vx=0;p.direct={P:0,Vx:0,Vy:0,Mx:0,My:0};state.mat.sideExp='earth';";
const o = await openPage(SRC.file, {});
await o.p.waitForSelector('#tabbar button[data-tab="tab-report"]');
await o.p.waitForTimeout(1500);
const setup = src => o.p.evaluate(src => {
  state = defaultState(); migrateState(); SEL.asd = null; SEL.lrfd = null; SEL.asdLr = null;
  (new Function('state', src))(state); bindStaticInputs(); buildPedCards(); recalc();
}, src);
const js = () => o.p.evaluate(() => { const j = v => { const seen = new WeakSet(); return JSON.parse(JSON.stringify(v, (k, x) => { if (typeof x === 'function') return undefined; if (x && typeof x === 'object') { if (seen.has(x)) return '[cyc]'; seen.add(x); } return (typeof x === 'number' && !isFinite(x)) ? String(x) : x; })); };
  return { R: j(R), P2: j(P2) }; });
const dev = () => o.p.evaluate(() => (P2 && P2.dev ? P2.dev.rows : []).map(z => ({ k: z.k, ends: z.ends, status: z.status, dc: z.dc, Ld: z.LdUse, Ldh: z.Ldh, avail: z.avail, fit: z.hk.fit, zEnd: z.hk.zEnd, lim: z.hk.lim, zc: z.hk.zc })));
const reportText = async () => {
  await o.p.click('#tabbar button[data-tab="tab-report"]'); await o.p.waitForTimeout(1500);
  return o.p.evaluate(() => ({ text: SFRP.doc ? SharedReport.text(SFRP.doc) : '', err: /Report error/.test(document.getElementById('tab-report').innerText), katex: document.querySelectorAll('.katex-error').length }));
};

console.log('1. hand check: not set / straight / hooked');
await setup(BASE);
const A = await dev();
console.log('     not set: ' + JSON.stringify(A.map(z => [z.k, z.status, +z.dc.toFixed(3), +z.Ld.toFixed(2), +z.Ldh.toFixed(2), z.avail])));
const bx = A.find(z => z.k === 'botX');
check(bx && near(bx.avail, 21) && near(bx.Ld, 28.46) && near(bx.Ldh, 18.69), 'botX: l_avail 21, l_d 28.46, l_dh 18.69 in');
check(A.every(z => z.status === 'review'), 'not set: REVIEW (hook the bars), as before');
await setup(BASE + "state.freinf.botX.ends='straight';state.freinf.botY.ends='straight';");
const S = await dev();
check(S.every(z => z.status === 'fail' && near(z.dc, z.Ld / z.avail)), 'straight: NG, D/C = l_d/l_avail = ' + S.map(z => z.dc.toFixed(3)).join(', '));
check(near(S[0].dc, 1.355), 'straight D/C 1.355');
await setup(BASE + "state.freinf.botX.ends='hooked';state.freinf.botY.ends='hooked';");
const H = await dev();
console.log('     hooked: ' + JSON.stringify(H.map(z => [z.k, z.status, +z.dc.toFixed(3), z.zc, z.zEnd, z.lim])));
check(H.every(z => z.status === 'pass' && z.fit), 'hooked: PASS, hook fits');
const hx = H.find(z => z.k === 'botX'), hy = H.find(z => z.k === 'botY');
check(near(hx.zc, 4.5) && near(hx.zEnd, 20) && near(hx.lim, 22), 'botX hook: z_c 4.5, z_end 20 <= 22 in');
check(near(hy.zc, 3.5) && near(hy.zEnd, 19), 'botY hook (outer layer): z_c 3.5, z_end 19 in');
check(near(hx.dc, Math.max(18.69 / 21, 15.5 / 17.5)), 'hooked D/C = max(l_dh/l_avail, (r_c + 12 d_b)/room) = ' + hx.dc.toFixed(3));
const chip = await o.p.evaluate(() => { const c = [...document.querySelectorAll('#dash .chip, .chip')].find(e => /Footing bar development/.test(e.textContent)); return c ? c.className + ' | ' + c.textContent : ''; });
check(/pass/.test(chip) && /bar ends as entered/.test(chip), 'dashboard chip: pass, bar ends as entered (' + chip.slice(0, 160) + ')');
{ const r = await reportText();
  check(!r.err && r.katex === 0, 'Report renders, 0 KaTeX errors');
  check(/Hooked bars \(bar ends: standard 90° hooks, as entered\): develop/.test(r.text) && /Hook fits in the footing depth/.test(r.text), 'Report works the hooked development and the hook fit');
  if (args.shots) { await o.p.evaluate(() => { const e = [...document.querySelectorAll('#tab-report *')].find(x => x.children.length === 0 && /Hook fits in the footing depth/.test(x.textContent)); if (e) e.scrollIntoView({ block: 'center' }); }); await o.p.waitForTimeout(400); await o.p.screenshot({ path: path.join(args.shots, 'sfbe-report-hook.png') }); } }
// drawings: DXF arcs on the bar layer, schedule
{   const dx = await o.p.evaluate(() => { try { if (typeof renderDrawings === 'function') renderDrawings(); } catch (e) {} const B = SFDW.B; if (!B) return null; const txt = B.D.toDXF({ ltscale: 1 });
    return { arcs: (txt.match(/\nARC\r?\n/g) || []).length, hook: /STD 90 DEG HOOK EA END UP, LEG/.test(txt), call: /HOOK EA END/.test(txt), len: txt.length }; });
  console.log('     DXF: ' + JSON.stringify(dx));
  check(dx && dx.hook && dx.call && dx.arcs >= 4, 'DXF: hook arcs, callout and schedule leg');
  if (args.shots) { await o.p.click('#tabbar button[data-tab="tab-drawings"]').catch(() => {}); await o.p.waitForTimeout(800); await o.p.evaluate(() => { SFDW.cur = 'secA'; renderDrawings(); }); await o.p.waitForTimeout(1000);
    const el = await o.p.$('#tab-drawings svg'); if (el) await el.screenshot({ path: path.join(args.shots, 'sfbe-drawing-section.png') }); else await o.p.screenshot({ path: path.join(args.shots, 'sfbe-drawings.png') }); } }
const n3 = await o.p.evaluate(() => { try { if (typeof buildRebar === 'function' && V3D && V3D.groups) buildRebar(); } catch (e) { return 'err ' + e.message; } return V3D.matHooks; });
check(n3 > 0, '3D view draws the mat hooks (' + n3 + ')');

console.log('2. hook does not fit: t = 1.5 ft');
await setup(BASE.replace('state.geom.t=2;', 'state.geom.t=1.5;') + "state.freinf.botX.ends='hooked';");
const F = await dev();
const fx = F.find(z => z.k === 'botX');
console.log('     ' + JSON.stringify(fx));
check(fx && !fx.fit && fx.status === 'fail' && near(fx.zEnd, 20) && near(fx.lim, 16), 'botX hooked: z_end 20 > 16 in: NG');

console.log('3. absent = not set = identical');
await setup(BASE);
const J0 = await js();
await setup(BASE + "state.freinf.botX.ends='';state.freinf.botY.ends='';");
const J1 = await js();
const dR = diff(J0.R, J1.R), dP = diff(J0.P2, J1.P2).filter(d => !/^dev\.rows\.\d+\.(ends|hk)/.test(d[0]));
check(dR.length === 0 && dP.length === 0, 'R and P2 identical with ends "" (' + dR.length + '/' + dP.length + ' diffs)');
// UI: the select
await o.p.evaluate(() => { const b = [...document.querySelectorAll('#inputPanel button, .inTabs button')].find(e => /Reinforcement/.test(e.textContent)); if (b) b.click(); });
await o.p.waitForTimeout(300);
const sel = 'select[data-path="freinf.botX.ends"]';
check(await o.p.$eval(sel, e => e.value) === '', 'absent field reads Not set');
await o.p.selectOption(sel, 'hooked'); await o.p.waitForTimeout(600); await o.p.evaluate(() => recalc());
check(await o.p.evaluate(() => state.freinf.botX.ends === 'hooked' && P2.dev.rows.find(z => z.k === 'botX').status === 'pass'), 'choosing Hooked 90° stores ends = hooked and the row passes');
if (args.shots) { await o.p.evaluate(() => document.getElementById('sec-rebar').scrollIntoView({ block: 'start' })); await o.p.waitForTimeout(300); await o.p.screenshot({ path: path.join(args.shots, 'sfbe-input.png') }); }
{ await o.p.click('#tabbar button[data-tab="tab-footdes"]'); await o.p.waitForTimeout(800);
  const t = await o.p.evaluate(() => document.getElementById('tab-footdes').innerText);
  check(/hook fits in the footing depth/i.test(t) && /bar ends: standard 90° hooks/.test(t), 'Footing Design 5.4 shows the hooked check and the fit');
  if (args.shots) { await o.p.evaluate(() => document.getElementById('o-fd-dev').scrollIntoView({ block: 'start' })); await o.p.waitForTimeout(400); await o.p.screenshot({ path: path.join(args.shots, 'sfbe-steps.png') }); } }
console.log('4. 390 px');
await o.p.setViewportSize({ width: 390, height: 844 }); await o.p.waitForTimeout(600);
await o.p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(e => /^Inputs?$/i.test(e.textContent.trim())); if (b) b.click(); document.getElementById('sec-rebar').scrollIntoView({ block: 'start' }); });
await o.p.waitForTimeout(400);
const sw = await o.p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
check(sw.sw <= sw.cw + 1, 'no horizontal page scroll at 390 px (' + sw.sw + ' vs ' + sw.cw + ')');
if (args.shots) await o.p.screenshot({ path: path.join(args.shots, 'sfbe-390.png') });
check(o.errs.length === 0, '0 console errors' + (o.errs.length ? ': ' + o.errs.slice(0, 3).join(' | ') : ''));
await o.b.close();
console.log(failures ? failures + ' FAILURE(S)' : 'all checks pass');
process.exit(failures ? 1 : 0);
