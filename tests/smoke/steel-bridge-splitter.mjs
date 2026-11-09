#!/usr/bin/env node
// Steel Bridge (apps/steel-bridge/index.html): the full-width layout and the splitter between the input and output panels (SBW, 2026-11-09;
// ui/splitter.js). Headless Chromium, file://, CDN libraries from tests/libs (tests/lib.mjs openPage).
//   1. 1920x1080: the app fills the window width (no 1500 px cap); the header spans it; no --sbIn and the input panel is .33 of the
//      width beside the check summary column (the layout before the splitter); the bar is a focusable role="separator" with aria-valuenow;
//   2. mouse drag +200 px: the input panel follows, the ratio is stored in sbd2.splitRatio_v1, a window resize and a sbd2:panelresize
//      event are sent, nothing else is written to localStorage (the project / autosave keys are unchanged);
//   3. clamp: dragged far right the output panel is 480 px, far left the input panel is 300 px;
//   4. the dragged width is kept across a reload;
//   5. keyboard: Right +16 px, Shift+Right +64 px, Left -16 px, Home / End the limits, Enter resets;
//   6. double-click resets to the default and removes the key;
//   7. touch / pen: pointer events of type touch move it;
//   8. 3D view: its canvas follows the output panel's new width;
//   9. the check summary column shrunk («): the stored share applies to the new width, the output panel stays at least 480 px; window 1000 px: the clamp holds;
//  10. stacked (899, 768 and 390 px): no bar, and the panels are as without it (full width), even with a stored ratio;
//  11. print: the bar is hidden;
//  12. no console errors.
//   node tests/smoke/steel-bridge-splitter.mjs [--file <index.html>] [--shots <dir>]
import fs from 'fs';
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) { if (!av[i].startsWith('--')) continue; const k = av[i].slice(2); args[k] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true; }
const FILE = path.resolve(args.file || path.join(REPO, 'apps/steel-bridge/index.html'));
if (args.shots) fs.mkdirSync(args.shots, { recursive: true });
const KEY = 'sbd2.splitRatio_v1';
let failures = 0, checks = 0;
const check = (ok, msg) => { checks++; if (!ok) { failures++; console.log('  FAIL ' + msg); } };
const near = (a, b, tol = 2) => Math.abs(a - b) <= tol;

const geo = p => p.evaluate(() => {
  const w = id => { const e = document.getElementById(id); return e ? e.getBoundingClientRect().width : 0; }, sp = document.getElementById('sbSplit'), cs = getComputedStyle(sp);
  const dash = getComputedStyle(document.getElementById('sbDashCol')).display !== 'none' ? w('sbDashCol') : 0;
  const r = sp.getBoundingClientRect();
  return { win: innerWidth, app: w('app'), hdr: w('hdr'), main: document.getElementById('main').clientWidth, dash, inp: w('inputPanel'), out: w('outputPanel'), bar: r.width,
    barX: r.left + r.width / 2, barY: r.top + Math.min(300, r.height / 2), shown: cs.display !== 'none', sbIn: document.getElementById('main').style.getPropertyValue('--sbIn'),
    role: sp.getAttribute('role'), tab: sp.tabIndex, now: sp.getAttribute('aria-valuenow'), min: sp.getAttribute('aria-valuemin'), max: sp.getAttribute('aria-valuemax'),
    cursor: cs.cursor, key: localStorage.getItem('sbd2.splitRatio_v1'), docX: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth };
});
const lsSnap = p => p.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
async function drag(p, dx, steps = 8) {
  const g = await geo(p); await p.mouse.move(g.barX, g.barY); await p.mouse.down();
  for (let i = 1; i <= steps; i++) { await p.mouse.move(g.barX + dx * i / steps, g.barY); await p.waitForTimeout(20); }
  await p.mouse.up(); await p.waitForTimeout(250);
}
const ready = async p => { await p.waitForSelector('#tabBar [data-otab]'); await p.waitForTimeout(1500); };

const t0 = Date.now();
const o = await openPage(FILE, { vw: 1920, vh: 1080 }); const { p } = o;
await ready(p);
// 1. full width, default
let g = await geo(p);
check(g.app === 1920 && g.hdr === 1920, `1920: app ${g.app} / header ${g.hdr} px wide, expected the window width`);
check(g.shown && g.role === 'separator' && g.tab === 0 && g.cursor === 'col-resize', `bar: shown ${g.shown}, role ${g.role}, tabIndex ${g.tab}, cursor ${g.cursor}`);
check(!g.sbIn && g.key == null && near(g.inp, 0.33 * (g.main - g.dash), 1), `default: --sbIn "${g.sbIn}", key ${g.key}, input ${g.inp} vs .33 x ${g.main - g.dash}`);
check(near(g.dash + g.inp + g.bar + g.out, g.main, 1) && g.docX === 0, `panels fill #main: ${g.dash}+${g.inp}+${g.bar}+${g.out} vs ${g.main}; page scrolls sideways ${g.docX}`);
check(g.now && near(+g.now, 33, 0.6), `aria-valuenow ${g.now} (expected about 33)`);
const g0 = g, ls0 = await lsSnap(p);
// 2. drag +200
await p.evaluate(() => { window.__ev = { resize: 0, pr: null }; addEventListener('resize', () => window.__ev.resize++); addEventListener('sbd2:panelresize', e => { window.__ev.pr = e.detail; }); });
await drag(p, 200);
g = await geo(p);
const ev = await p.evaluate(() => window.__ev);
check(near(g.inp, g0.inp + 200, 3) && near(g.out, g0.out - 200, 3), `drag +200: input ${g0.inp} -> ${g.inp}, output ${g0.out} -> ${g.out}`);
check(g.key && near(+g.key * (g.main - g.dash), g.inp, 2), `drag: key ${g.key} vs input ${g.inp}`);
check(ev.resize > 0 && ev.pr && near(ev.pr.output, g.out, 1), `drag: resize events ${ev.resize}, sbd2:panelresize ${JSON.stringify(ev.pr)}`);
check(near(+g.now, 100 * g.inp / (g.main - g.dash), 0.6), `drag: aria-valuenow ${g.now}`);
const ls1 = await lsSnap(p), changedKeys = Object.keys({ ...ls0, ...ls1 }).filter(k => ls0[k] !== ls1[k]);
check(changedKeys.length === 1 && changedKeys[0] === KEY, `drag: localStorage keys changed ${JSON.stringify(changedKeys)} (expected only ${KEY})`);
if (args.shots) await p.screenshot({ path: path.join(args.shots, 'dragged-1920.png') });
// 3. clamp
await drag(p, 2000); g = await geo(p);
check(near(g.out, 480, 2), `clamp right: output ${g.out} (expected 480)`);
check(near(+g.now, +g.max, 0.2), `clamp right: aria-valuenow ${g.now} = valuemax ${g.max}`);
await drag(p, -3000); g = await geo(p);
check(near(g.inp, 300, 2), `clamp left: input ${g.inp} (expected 300)`);
check(near(+g.now, +g.min, 0.2), `clamp left: aria-valuenow ${g.now} = valuemin ${g.min}`);
// 4. reload keeps it
await drag(p, 250); const gb = await geo(p);
await p.reload(); await ready(p); g = await geo(p);
check(near(g.inp, gb.inp, 2) && g.key === gb.key, `reload: input ${gb.inp} -> ${g.inp}, key ${gb.key} -> ${g.key}`);
// 5. keyboard
await p.focus('#sbSplit');
let w = (await geo(p)).inp; await p.keyboard.press('ArrowRight'); g = await geo(p); check(near(g.inp, w + 16, 1.5), `ArrowRight: ${w} -> ${g.inp}`);
w = g.inp; await p.keyboard.press('Shift+ArrowRight'); g = await geo(p); check(near(g.inp, w + 64, 1.5), `Shift+ArrowRight: ${w} -> ${g.inp}`);
w = g.inp; await p.keyboard.press('ArrowLeft'); g = await geo(p); check(near(g.inp, w - 16, 1.5), `ArrowLeft: ${w} -> ${g.inp}`);
await p.keyboard.press('Home'); g = await geo(p); check(near(g.inp, 300, 1.5), `Home: input ${g.inp}`);
await p.keyboard.press('End'); g = await geo(p); check(near(g.out, 480, 1.5), `End: output ${g.out}`);
await p.keyboard.press('Enter'); g = await geo(p); check(!g.sbIn && g.key == null && near(g.inp, g0.inp, 1), `Enter resets: input ${g.inp}, key ${g.key}`);
// 6. double-click resets
await drag(p, 150); g = await geo(p); check(g.key != null, 'drag before double-click stored a key');
await p.mouse.dblclick(g.barX, g.barY); await p.waitForTimeout(200); g = await geo(p);
check(!g.sbIn && g.key == null && near(g.inp, g0.inp, 1), `double-click resets: input ${g.inp} (default ${g0.inp}), key ${g.key}`);
// 7. touch / pen pointer events
w = g.inp;
await p.evaluate(({ x, y }) => { const el = document.getElementById('sbSplit'), ev = (t, X) => el.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1, clientX: X, clientY: y }));
  ev('pointerdown', x); ev('pointermove', x - 60); ev('pointermove', x - 120); ev('pointerup', x - 120); }, { x: g.barX, y: g.barY });
await p.waitForTimeout(250); g = await geo(p);
check(near(g.inp, w - 120, 3), `touch drag -120: input ${w} -> ${g.inp}`);
await p.keyboard.press('Enter').catch(() => {}); await p.focus('#sbSplit'); await p.keyboard.press('Enter');
// 8. 3D view follows
await p.click('#tabBar [data-otab="3d"]').catch(() => {}); await p.waitForTimeout(2500);
const cw = () => p.evaluate(() => { const c = document.querySelector('#out canvas'); return c ? c.getBoundingClientRect().width : 0; });
const c0 = await cw();
if (c0 > 0) { await drag(p, 300); await p.waitForTimeout(500); const c1 = await cw(); check(near(c1, c0 - 300, 6), `3D view canvas ${c0} -> ${c1} after drag +300`); await p.focus('#sbSplit'); await p.keyboard.press('Enter'); }
else check(false, '3D view: no canvas found');
// 9. summary column shrunk; 1000 px window
await drag(p, 2000); const gw = await geo(p);
await p.click('#sbDashTgl'); await p.waitForTimeout(400); g = await geo(p);
check(g.dash < 60 && g.out >= 478 && near(g.inp, Math.min(+g.key * (g.main - g.dash), g.main - g.dash - g.bar - 480), 2), `summary column shrunk: dash ${g.dash}, input ${g.inp} (share ${g.key} of ${g.main - g.dash}), output ${g.out} (before ${gw.out})`);
await p.click('#sbDashTgl'); await p.waitForTimeout(300);
await p.setViewportSize({ width: 1000, height: 800 }); await p.waitForTimeout(500); g = await geo(p);
check(g.shown && g.dash === 0 && near(g.out, 480, 2) && g.inp >= 299 && g.docX === 0, `1000 px with a wide stored ratio: input ${g.inp}, output ${g.out}, page sideways ${g.docX}`);
// 10. stacked: no bar, panels full width (with the stored ratio still there)
for (const vw of [899, 768, 390]) {
  await p.setViewportSize({ width: vw, height: 844 }); await p.waitForTimeout(400); g = await geo(p);
  check(!g.shown && g.bar === 0 && near(g.inp, g.main, 1) && near(g.out, g.main, 1) && g.docX === 0, `${vw} px: bar shown ${g.shown} (${g.bar} px), input ${g.inp}, output ${g.out}, main ${g.main}, sideways ${g.docX}`);
}
if (args.shots) await p.screenshot({ path: path.join(args.shots, 'stacked-390.png') });
// 11. print
await p.setViewportSize({ width: 1400, height: 900 }); await p.emulateMedia({ media: 'print' }); g = await geo(p);
check(!g.shown, 'print: the bar is hidden'); await p.emulateMedia({ media: 'screen' });
// 12. console
check(!o.errs.length, `console errors: ${o.errs.join(' | ')}`);
await o.b.close();
console.log(`steel-bridge-splitter: ${checks} checks, ${failures} failed (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
process.exit(failures ? 1 : 0);
