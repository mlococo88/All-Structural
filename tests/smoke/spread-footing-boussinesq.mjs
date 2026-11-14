#!/usr/bin/env node
// Spread Footing: Bearing 3.5 "Stress below footing (Boussinesq)" (SFBQ, engineer request 2026-11-14). Headless Chromium, file://,
// the pinned libraries from tests/libs, at 1400 and 390 px:
//   1. square 10 x 10 ft footing, uniform net pressure 3 ksf (direct net bearing, q_sur = 0.48 ksf, centred load P = 348 kip):
//      the card's point query below the centre at z = 5, 10, 20 ft and below the corner at z = 10 ft gives the hand values
//      (2.103, 1.008, 0.324, 0.526 ksf); section and profile figures drawn; Report subsection S-bous with its steps and figures;
//   2. the gross basis, the section along L, a plan view and a custom profile point (the saved inputs state.bous change the card);
//   3. net uplift (every pedestal P = -2000 kip): the card says "No compressive bearing pressure" and draws no bulb (no isobar
//      path, no figure), the Report says the same;
//   4. partial contact (D.M_x = 600 k-ft): the card draws; Δσ at the centre below the base = q(0, 0) minus the overburden;
//   5. an old save without the field opens with the defaults (migration), and R / P2 are unchanged by the field;
//   6. hover readout (SFBQ-H): a pointer at known points of the section, plan and profile figures shows the values computed at
//      that point (centre z = 5 ft: 2.103 ksf, factor 0.701, I = 0.701 uniform, 2:1 1.333 ksf, σ′v0 = 0.120·9 = 1.080 ksf;
//      corner z = 10 ft: 0.526 ksf), a crosshair, the readout inside the figure; a click / tap pins it and "Use this point"
//      fills the point query; hidden in print; no readout in the uplift case;
//   0 console errors throughout; no horizontal page scroll at 390 px.
//   node tests/smoke/spread-footing-boussinesq.mjs [--file <file or git ref>] [--shots <dir>]
import fs from 'fs';
import path from 'path';
import { openPage, resolveFile } from '../lib.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) { if (!av[i].startsWith('--')) continue; const k = av[i].slice(2); args[k] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true; }
const TOOL = 'Spread Footing.html';
const SRC = resolveFile(args.file || TOOL, TOOL);
if (args.shots) fs.mkdirSync(args.shots, { recursive: true });
let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL ' + msg); } else console.log('  ok   ' + msg); };
const near = (a, b, t) => Math.abs(a - b) <= t;

// square footing, one centred pedestal, net direct bearing; total P on the base = 3·100 + q_sur·100 so q_net = 3 ksf exactly
const SQUARE = `state.geom.B=10;state.geom.L=10;state.geom.t=2;state.geom.Df=4;state.soil.mode='direct';state.soil.qa=6;state.soil.qaBasis='net';
 state.soil.gs=120;state.soil.dw='';state.ev.cover=0;state.ev.qDsur=0;state.ev.qLsur=0;state.mat.swMode='user';state.mat.swUser=0;
 state.peds=[state.peds[0]];const p=state.peds[0];p.x=0;p.y=0;p.h=0;p.loadEx=0;p.loadEy=0;
 Object.keys(p.loads).forEach(t=>{p.loads[t]={P:0,Vx:0,Vy:0,Mx:0,My:0};});`;

for (const vw of [1400, 390]) {
  console.log('--- viewport ' + vw + ' px');
  const o = await openPage(SRC.file, { vw, vh: 1000 });
  await o.p.waitForSelector('#tabbar button[data-tab="tab-report"]', { state: 'attached' });
  await o.p.waitForTimeout(1500);
  const tab = async id => { await o.p.evaluate(id => document.querySelector('#tabbar button[data-tab="' + id + '"]').click(), id); await o.p.waitForTimeout(400); };
  const apply = (src, bous) => o.p.evaluate(([src, bous]) => {
    state = defaultState(); migrateState(); SEL.asd = null; SEL.lrfd = null; SEL.asdLr = null;
    (new Function('state', src))(state); if (bous) Object.assign(state.bous, bous); buildPedCards(); recalc();
  }, [src, bous || null]);
  const card = () => o.p.evaluate(() => { const d = document.getElementById('o-br-bous');
    return d ? { text: d.innerText, paths: d.querySelectorAll('svg path').length, svgs: d.querySelectorAll('svg').length } : null; });
  const query = (x, y, z) => o.p.evaluate(([x, y, z]) => { Object.assign(state.bous, { qx: x, qy: y, qz: z }); sfbqCard(document.getElementById('tab-bearing'));
    const M = sfbqModel(); return { v: M.Q1.result.value, qref: M.qref, qsur: M.qsur, text: document.getElementById('o-br-bous').innerText }; }, [x, y, z]);
  const report = async () => { await tab('tab-report'); await o.p.waitForTimeout(1500);
    const r = await o.p.evaluate(() => ({ text: SFRP.doc ? SharedReport.text(SFRP.doc) : '', katex: document.querySelectorAll('#tab-report .katex-error').length,
      figs: (() => { const s = (SFRP.doc.model.sections || []).flatMap(x => x.subs || []).find(q => q.key === 'S-bous'); return s ? s.items.filter(i => i.type === 'figure').length : -1; })() }));
    await tab('tab-bearing'); return r; };

  // 1. hand checks
  o.errs.length = 0;
  await apply(SQUARE + "p.loads.D.P=348;");
  await tab('tab-bearing');
  let c = await card();
  check(c && /Stress below footing/.test(c.text) && c.svgs >= 2 && c.paths > 5, 'card 3.5 drawn with the profile and the section');
  for (const [x, y, z, v] of [[0, 0, 5, 2.1027], [0, 0, 10, 1.0083], [0, 0, 20, 0.3242], [5, 5, 10, 0.5257]]) {
    const q = await query(x, y, z);
    check(near(q.qref, 3, 1e-9) && near(q.qsur, 0.48, 1e-12), 'q_ref = 3 ksf net (q_sur = 0.120·4 = 0.48 ksf)');
    check(near(q.v, v, 5e-4), `point (${x}, ${y}, ${z}): Δσ = ${q.v.toFixed(4)} ksf, hand ${v}`);
  }
  if (args.shots) { await o.p.evaluate(() => document.getElementById('o-br-bous').scrollIntoView()); await o.p.screenshot({ path: path.join(args.shots, 'bous-square-' + vw + '.png'), fullPage: false }); }
  let rp = await report();
  check(/Stress below the footing \(Boussinesq\)/.test(rp.text) && rp.figs >= 2 && rp.katex === 0, 'Report: S-bous with ' + rp.figs + ' figures, 0 KaTeX errors');
  check(/Net: q − q_sur/.test(rp.text), 'Report states the basis');

  // 2. gross, section along L, plan, custom profile point
  await apply(SQUARE + "p.loads.D.P=348;", { basis: 'gross', sec: 'L', plan: 'on', planZ: 5, prof: 'u', px: 2, py: 1 });
  await tab('tab-bearing');
  c = await card();
  check(c.svgs >= 3 && /in plan at z = 5\.00 ft/.test(c.text), 'plan view drawn (' + c.svgs + ' figures)');
  const g = await query(0, 0, 10);
  check(near(g.qref, 3.48, 1e-9) && near(g.v, 3.48 * 0.336108, 1e-3), 'gross basis: q_ref = 3.48, Δσ(0, 0, 10) = ' + g.v.toFixed(4));
  check(await o.p.evaluate(() => /section along L \(x = 0\)/.test(document.querySelectorAll('#o-br-bous svg')[1].textContent)), 'section along L');
  if (args.shots) { await o.p.evaluate(() => document.getElementById('o-br-bous').scrollIntoView()); await o.p.screenshot({ path: path.join(args.shots, 'bous-gross-plan-' + vw + '.png'), fullPage: true }); }

  // 3. net uplift: no bulb
  await apply("state.peds.forEach(p=>{p.loads.D.P=-2000;p.loads.L.P=0;p.loads.S.P=0;});");
  await tab('tab-bearing');
  c = await card();
  check(c && /No compressive bearing pressure|no bearing pressure solution/i.test(c.text), 'uplift: "No compressive bearing pressure" stated');
  check(c && c.svgs === 0 && c.paths === 0, 'uplift: no bulb (no figure, no isobar)');
  rp = await report();
  check(/No compressive bearing pressure|no bearing pressure solution/i.test(rp.text) && rp.figs === 0, 'uplift: Report says so, no figure');
  if (args.shots) { await o.p.evaluate(() => document.getElementById('o-br-bous').scrollIntoView()); await o.p.screenshot({ path: path.join(args.shots, 'bous-uplift-' + vw + '.png') }); }
  // a picked combination with uplift while the governing one has pressure
  await apply(SQUARE + "p.loads.D.P=348;p.loads.Wx.P=-1000;");
  const up = await o.p.evaluate(() => { const a = R.asd.find(z => z.r.P <= 0); if (!a) return null; state.bous.combo = a.cb.name; sfbqCard(document.getElementById('tab-bearing'));
    const d = document.getElementById('o-br-bous'); return { name: a.cb.name, text: d.innerText, svgs: d.querySelectorAll('svg').length }; });
  check(up && /No compressive bearing pressure/.test(up.text) && up.svgs === 0, 'picked uplift combination ' + (up && up.name) + ': no bulb');

  // 4. partial contact
  await apply(SQUARE + "p.loads.D.P=348;p.loads.D.Mx=600;");
  await tab('tab-bearing');
  const pc = await o.p.evaluate(() => { const M = sfbqModel(); const pl = M.bp.plane; return { mode: M.bp.mode, v0: M.ds(0, 0, 0), q00: Math.max(0, pl.q0) - M.qsur, svgs: document.querySelectorAll('#o-br-bous svg').length }; });
  check(pc.mode === 'partial' && pc.svgs >= 2 && near(pc.v0, pc.q00, 1e-6), 'partial contact: drawn; Δσ(0, 0, 0) = q(0, 0) − q_sur = ' + pc.q00.toFixed(4));
  if (args.shots) { await o.p.evaluate(() => document.getElementById('o-br-bous').scrollIntoView()); await o.p.screenshot({ path: path.join(args.shots, 'bous-partial-' + vw + '.png') }); }

  // 5. migration: an old save without the field; results independent of the field
  const mg = await o.p.evaluate(() => {
    const st = defaultState(); delete st.bous; state = Object.assign({}, st); delete state.bous; migrateState();
    const had = JSON.stringify(state.bous); recalc(); const r1 = JSON.stringify([R.asd.map(a => [a.r, a.bear, a.DCR]), P2 && P2.desX]);
    state.bous = { basis: 'gross', combo: 'nonexistent', qx: 3, qy: 2, qz: 7, prof: 'k', px: 0, py: 0, sec: 'L', plan: 'on', planZ: 4 }; recalc();
    const r2 = JSON.stringify([R.asd.map(a => [a.r, a.bear, a.DCR]), P2 && P2.desX]);
    return { had, same: r1 === r2, warn: /not in this run/.test(document.getElementById('o-br-bous').innerText) };
  });
  check(mg.had === JSON.stringify({ basis: 'net', combo: '', qx: 0, qy: 0, qz: '', prof: 'c', px: 0, py: 0, sec: 'B', plan: 'off', planZ: '' }), 'migration: absent field = the defaults');
  check(mg.same, 'R / P2 do not depend on the field');
  check(mg.warn, 'a saved load case not in the run: warning, governing shown');

  // 6. hover readout (SFBQ-H)
  o.errs.length = 0;
  await apply(SQUARE + "p.loads.D.P=348;", { plan: 'on', planZ: 10, prof: 'k' });
  await tab('tab-bearing');
  // client coordinates of a footing point (x or y along the plot, z or y) in figure i (0 profile, 1 section, 2 plan)
  const at = (i, h, v) => o.p.evaluate(([i, h, v]) => {
    const f = document.querySelectorAll('#o-br-bous .sfbqFig')[i]; f.scrollIntoView({ block: 'center' }); const m = f.sfbqMap, r = f.querySelector('svg').getBoundingClientRect();
    const u = m.kind === 'prof' ? m.ml + m.pw / 2 : m.ml + (h + m.hx) * m.sc, w = m.kind === 'prof' ? m.mt + v / m.zm * m.ph : m.kind === 'plan' ? m.mt + (m.v1 - v) * m.sc : m.mt + (v - m.v0) * m.sc;
    return { x: r.left + u * r.width / m.W, y: r.top + w * r.height / m.H };
  }, [i, h, v]);
  // the exact point: a synthetic pointer event at the fractional client position; then the readout of the next frame
  const hover = async (i, h, v, ev) => { const c = await at(i, h, v);
    await o.p.evaluate(([i, c, ev]) => { const f = document.querySelectorAll('#o-br-bous .sfbqFig')[i], s = f.querySelector('svg');
      s.dispatchEvent(new PointerEvent(ev || 'pointermove', { clientX: c.x, clientY: c.y, pointerType: 'mouse', bubbles: true })); }, [i, c, ev]);
    await o.p.waitForTimeout(120);
    return o.p.evaluate(i => { const f = document.querySelectorAll('#o-br-bous .sfbqFig')[i], t = f.querySelector('.sfbqTip'), a = f.sfbqLast, M = sfbqModel();
      const fr = f.getBoundingClientRect(), tr = t.getBoundingClientRect(), g = f.querySelector('svg > g:last-of-type');
      return { a, exact: a ? SharedBoussinesq.stress(M.ld, a.x, a.y, a.z).value : null, text: t.innerText, shown: t.style.display === 'block', cross: g && g.style.display !== 'none',
        inside: tr.left >= fr.left - 0.5 && tr.right <= fr.right + 0.5 && tr.top >= fr.top - 0.5 && tr.bottom <= fr.bottom + 0.5, fs: parseFloat(getComputedStyle(t).fontSize) };
    }, i); };
  let h = await hover(1, 0, 5);
  check(h.shown && h.cross && h.a && near(h.a.x, 0, 1e-9) && near(h.a.z, 5, 1e-6), 'section: readout and crosshair at (0, 0, 5)');
  check(near(h.a.v, 2.1027, 5e-4) && near(h.a.r, 0.7009, 5e-4) && h.a.v === h.exact, 'section, centre z = 5 ft: Δσ = ' + h.a.v.toFixed(4) + ' ksf, factor ' + h.a.r.toFixed(4) + ' (= SharedBoussinesq at the point)');
  check(/2\.103 ksf/.test(h.text) && /0\.701/.test(h.text) && /I = Σ corner factors = 0\.701/.test(h.text) && /2103 psf/.test(h.text), 'readout: 2.103 ksf (2103 psf), factor 0.701, I = 0.701 (uniform)');
  check(/Net, q_?ref/.test(h.text.replace(/\s+/g, ' ')) || /Net/.test(h.text), 'readout: basis Net');
  check(/3\.000 ksf/.test(h.text) && /1\.333 ksf/.test(h.text), 'readout: q_ref = 3.000 ksf, 2:1 = 1.333 ksf');
  check(/1\.080 ksf/.test(h.text) && /9\.00 ft below grade/.test(h.text) && /3\.183 ksf/.test(h.text), 'readout: σ′v0 = 0.120·9 = 1.080 ksf, + Δσ = 3.183 ksf');
  check(/x = 0\.00 ft \(0B\)/.test(h.text) && /z = 5\.00 ft \(0\.5B\)/.test(h.text), 'readout: coordinates in ft and /B');
  check(h.inside && h.fs >= 10, 'readout inside the figure, ' + h.fs + ' px');
  h = await hover(2, 5, 5);
  check(h.shown && near(h.a.x, 5, 1e-6) && near(h.a.y, 5, 1e-6) && near(h.a.z, 10, 1e-9) && near(h.a.v, 0.5257, 5e-4) && h.a.v === h.exact && /0\.526 ksf/.test(h.text), 'plan at z = 10 ft, corner (5, 5): Δσ = ' + h.a.v.toFixed(4) + ' ksf');
  check(h.inside, 'plan readout inside the figure (corner of the plot)');
  h = await hover(0, 0, 10);
  check(h.shown && near(h.a.x, 5, 1e-9) && near(h.a.y, 5, 1e-9) && near(h.a.z, 10, 1e-6) && near(h.a.v, 0.5257, 5e-4) && h.a.v === h.exact && /0\.526 ksf/.test(h.text) && /0\.750 ksf/.test(h.text), 'profile at the corner, z = 10 ft: 0.526 ksf, 2:1 = 300/(20·20) = 0.750 ksf');
  // real pointer (integer client px): the readout follows it; values = SharedBoussinesq at the point it reports
  let c0 = await at(1, 0, 5); await o.p.mouse.move(c0.x, c0.y); await o.p.waitForTimeout(150);
  h = await o.p.evaluate(() => { const f = document.querySelectorAll('#o-br-bous .sfbqFig')[1], a = f.sfbqLast, M = sfbqModel(); return { a, ex: SharedBoussinesq.stress(M.ld, a.x, a.y, a.z).value, d: f.querySelector('.sfbqTip').style.display }; });
  check(h.d === 'block' && h.a.v === h.ex && near(h.a.v, 2.103, 0.01), 'mouse move: readout ' + h.a.v.toFixed(4) + ' ksf at (' + h.a.x.toFixed(3) + ', 0, ' + h.a.z.toFixed(3) + ')');
  // click pins; "Use this point" fills the point query
  await o.p.mouse.click(c0.x, c0.y); await o.p.waitForTimeout(150);
  const pinned = await o.p.evaluate(() => !!document.querySelector('#o-br-bous .sfbqFig .sfbqTip [data-sfbqh="use"]'));
  check(pinned, 'click: readout pinned with "Use this point"');
  const pinA = await o.p.evaluate(() => document.querySelectorAll('#o-br-bous .sfbqFig')[1].sfbqLast);
  if (args.shots) await o.p.screenshot({ path: path.join(args.shots, 'bous-hover-' + vw + '.png') });
  await o.p.evaluate(() => document.querySelector('#o-br-bous .sfbqFig .sfbqTip [data-sfbqh="use"]').click()); await o.p.waitForTimeout(300);
  const used = await o.p.evaluate(a => { const M = sfbqModel(), r2 = v => Math.round(v * 100) / 100 || 0;
    return { b: Object.assign({}, state.bous), v: M.Q1.result.value, ok: state.bous.qx === r2(a.x) && state.bous.qy === r2(a.y) && state.bous.qz === r2(a.z), ex: SharedBoussinesq.stress(M.ld, r2(a.x), r2(a.y), r2(a.z)).value }; }, pinA);
  check(used.ok && used.b.qy === 0 && Math.abs(used.b.qz - 5) <= 0.15 && near(used.v, used.ex, 1e-12), 'Use this point: (a) = (' + used.b.qx + ', ' + used.b.qy + ', ' + used.b.qz + ') = the pinned point to 0.01 ft, Δσ = ' + used.v.toFixed(4));
  // a touch pointermove alone does nothing; a tap (click) pins
  await o.p.evaluate(() => sfbqCard(document.getElementById('tab-bearing')));
  h = await hover(1, 0, 5, 'pointerleave');
  const tm = await (async () => { const c = await at(1, 0, 5); await o.p.evaluate(c => document.querySelectorAll('#o-br-bous .sfbqFig')[1].querySelector('svg').dispatchEvent(new PointerEvent('pointermove', { clientX: c.x, clientY: c.y, pointerType: 'touch', bubbles: true })), c);
    await o.p.waitForTimeout(100); return o.p.evaluate(() => document.querySelectorAll('#o-br-bous .sfbqFig')[1].querySelector('.sfbqTip').style.display); })();
  check(tm === 'none', 'touch move without a tap: no readout');
  h = await hover(1, 0, 5, 'click');
  check(h.shown && h.a.v === h.exact && near(h.a.v, 2.1027, 0.03) && h.inside && /Use this point/.test(h.text), 'tap: readout pinned near (0, 0, 5) (a click has whole-pixel coordinates): ' + h.a.v.toFixed(4) + ' ksf, inside the figure');
  if (args.shots) await o.p.screenshot({ path: path.join(args.shots, 'bous-tap-' + vw + '.png') });
  await o.p.emulateMedia({ media: 'print' });
  const pr = await o.p.evaluate(() => [...document.querySelectorAll('.sfbqTip')].every(t => t.getBoundingClientRect().width === 0));
  await o.p.emulateMedia({ media: 'screen' });
  check(pr, 'print: no readout');
  const sp = await o.p.evaluate(() => { const M = sfbqModel(); const t0 = performance.now(); for (let k = 0; k < 40; k++) sfbqAt(M, 0.3 * k - 6, 0, 1 + k / 4); return (performance.now() - t0) / 40; });
  console.log('  info one readout (uniform) ' + sp.toFixed(3) + ' ms');
  await apply(SQUARE + "p.loads.D.P=348;p.loads.D.Mx=600;");
  await tab('tab-bearing');
  const pp = await o.p.evaluate(() => { const M = sfbqModel(); const t0 = performance.now(); for (let k = 0; k < 40; k++) sfbqAt(M, 0, 0.3 * k - 6, 1 + k / 4); return (performance.now() - t0) / 40; });
  h = await hover(1, 0, 5);
  check(h.shown && h.a.v === h.exact && !/corner factors/.test(h.text), 'partial contact: readout = SharedBoussinesq at the point (no I: not uniform); ' + pp.toFixed(2) + ' ms per readout');
  await apply("state.peds.forEach(p=>{p.loads.D.P=-2000;p.loads.L.P=0;p.loads.S.P=0;});");
  await tab('tab-bearing');
  check(await o.p.evaluate(() => document.querySelectorAll('#o-br-bous .sfbqFig, #o-br-bous .sfbqTip').length === 0), 'uplift: no figure, no hover readout');
  check(o.errs.length === 0, 'hover: 0 console errors ' + JSON.stringify(o.errs));

  // layout
  const sw = await o.p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(sw <= 1, 'no horizontal page scroll (' + sw + ' px)');
  const fs10 = await o.p.evaluate(() => { const t = [...document.querySelectorAll('#o-br-bous svg text')]; return t.length ? Math.min(...t.map(e => e.getBoundingClientRect().height ? parseFloat(getComputedStyle(e).fontSize) * e.ownerSVGElement.getBoundingClientRect().width / e.ownerSVGElement.viewBox.baseVal.width : 99)) : 99; });
  check(fs10 >= 9.9, 'figure text ≥ 10 px on screen (smallest ' + fs10.toFixed(1) + ')');
  check(o.errs.length === 0, '0 console errors ' + JSON.stringify(o.errs));
  await o.b.close();
}
console.log(failures ? failures + ' failure(s)' : 'all checks pass');
process.exit(failures ? 1 : 0);
