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
