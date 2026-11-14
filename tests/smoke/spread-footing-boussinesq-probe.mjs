#!/usr/bin/env node
// Spread Footing SFBQ: "existing results unchanged" probe. Opens two copies of the tool (A = a checkout of origin/main with its
// shared/ folder, B = the working tree) headless from file://, applies the same projects to both (state JSON as a saved project
// or an Import JSON gives it, then migrateState, the tool's own load path) and compares:
//   R (every service and strength combination: resultant, bearing solution, D/C; the stability results; warnings),
//   P2 (footing and pedestal design), the dashboard chips, the text of every result tab except the new Bearing card 3.5,
//   and the Report text with the new subsection S-bous removed (and the section numbers after it, which do not move: S-bous is the
//   last subsection of Bearing).
// Projects: the default, the projects of the existing smoke tests (wall per ft, plain, narrow, bar ends) as state patches,
// a direct-mode envelope, Vesić with a water table above the base, partial contact, net uplift, and an old save without the field.
//   node tests/smoke/spread-footing-boussinesq-probe.mjs --a <folder with origin/main checkout>
import path from 'path';
import { openPage, diff } from '../lib.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) { if (!av[i].startsWith('--')) continue; const k = av[i].slice(2); args[k] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true; }
if (!args.a) { console.log('usage: --a <folder holding the origin/main copy of the repository>'); process.exit(2); }
const A = path.join(path.resolve(args.a), 'Spread Footing.html'), B = args.b ? path.join(path.resolve(args.b), 'Spread Footing.html') : path.resolve('Spread Footing.html');

const CASES = [
  ['default', ''],
  ['two pedestals, wind Vx and My', "state.peds[0].loads.Wx.Vx=20;state.peds[1].loads.D.My=40;"],
  ['partial contact (D.M_x = 900 k-ft)', 'state.peds[0].loads.D.Mx=900;'],
  ['Vesić, water table 2 ft below grade, depth factors on', "state.soil.dw=2;state.soil.sfdDepthF='on';"],
  ['direct allowable, net basis', "state.soil.mode='direct';state.soil.qaBasis='net';state.soil.qa=5;"],
  ['direct factored envelope', "state.loadMode='direct';"],
  ['net uplift', 'state.peds.forEach(p=>{p.loads.D.P=-2000;p.loads.L.P=0;p.loads.S.P=0;});'],
  ['wall element per ft', "state.peds=[state.peds[0]];const p=state.peds[0];p.elemType='wall';p.bx=1;p.by=8;p.loadEntry='perFt';p.loads.D.P=12;p.loads.L.P=5;state.geom.B=6;state.geom.L=8;"],
  ['plain x, strip', "state.geom.B=2;state.geom.L=4;state.geom.t=1;state.peds=[state.peds[0]];const p=state.peds[0];p.x=0;p.bx=1;p.by=4;p.h=0;p.loads.D.P=8;p.loads.L.P=4;state.freinf.plain='x';"],
  ['bar ends hooked, top mat', "state.freinf.botX.ends='hooked';state.freinf.topX={size:5,spc:12,mode:'spacing'};"],
  ['old save without bous (migration)', 'delete state.bous;'],
];

async function run(file) {
  const o = await openPage(file, { vw: 1400, vh: 1000 });
  await o.p.waitForSelector('#tabbar button[data-tab="tab-report"]', { state: 'attached' });
  await o.p.waitForTimeout(1500);
  const out = [];
  for (const [name, src] of CASES) {
    o.errs.length = 0;
    const r = await o.p.evaluate(async (src) => {
      const st = defaultState(); (new Function('state', src))(st);
      state = Object.assign(defaultState(), JSON.parse(JSON.stringify(st))); if (!('bous' in st)) delete state.bous;   /* as a saved / imported project */
      migrateState(); SEL.asd = null; SEL.lrfd = null; SEL.asdLr = null; buildPedCards(); recalc();
      const strip = o => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'function' ? undefined : (typeof v === 'number' && !isFinite(v) ? String(v) : v))));
      const tabs = {};
      for (const id of ['tab-schem', 'tab-combos', 'tab-bearing', 'tab-stab', 'tab-footdes', 'tab-peddes', 'tab-walldes']) {
        const e = document.getElementById(id); if (!e) continue; const c = e.cloneNode(true); const q = c.querySelector('#o-br-bous'); if (q) q.remove(); tabs[id] = c.innerText; }
      document.querySelector('#tabbar button[data-tab="tab-report"]').click(); await new Promise(res => setTimeout(res, 1200));
      let rep = '';
      /* masked: the viewer's own anchor numbers (_anc: one counter over the whole report, moved by the new steps) and the ids Plotly
         gives each draw (random: they differ between two renders of the same file) */
      const nid = v => v.replace(/[a-z0-9]{6}(?=[-"')])/g, '#').replace(/\b(id|href|xlink:href|clip-path)="[^"]*"/g, '$1=""').replace(/url\([^)]*\)/g, 'url()');
      if (SFRP.doc) { const m = JSON.parse(JSON.stringify(SFRP.doc.model, (k, v) => typeof v === 'function' || k.charAt(0) === '_' ? undefined : (k === 'svg' && typeof v === 'string' ? (/main-svg/.test(v) ? 'plotly: ' + v.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ') : nid(v)) : v)));
        (m.sections || []).forEach(s => { s.subs = (s.subs || []).filter(q => q.key !== 'S-bous'); });
        rep = m.sections; }
      document.querySelector('#tabbar button[data-tab="tab-bearing"]').click();
      return { R: strip({ asd: R.asd, lrfd: R.lrfd, W: R.W, govBear: R.govBear && R.govBear.cb.name }), P2: strip(P2), dash: document.getElementById('dashboard').innerText, tabs, rep };
    }, src);
    out.push({ name, r, errs: o.errs.slice() });
  }
  await o.b.close();
  return out;
}
const a = await run(A), b = await run(B);
let bad = 0;
for (let i = 0; i < CASES.length; i++) {
  const x = a[i].r, y = b[i].r, d = {};
  for (const k of ['R', 'P2', 'dash', 'tabs', 'rep']) d[k] = diff(x[k], y[k]).length;
  const ok = Object.values(d).every(n => n === 0) && !b[i].errs.length;
  if (!ok) bad++;
  console.log((ok ? '  same ' : '  DIFF ') + CASES[i][0] + '  ' + JSON.stringify(d) + (b[i].errs.length ? ' errors ' + JSON.stringify(b[i].errs) : ''));
  if (!ok) for (const k of ['R', 'P2', 'dash', 'tabs', 'rep']) diff(x[k], y[k]).slice(0, 6).forEach(z => console.log('     ' + k + ' ' + JSON.stringify(z).slice(0, 400)));
}
console.log(bad ? bad + ' case(s) differ' : 'all cases identical (R, P2, dashboard, tabs without card 3.5, Report without S-bous)');
process.exit(bad ? 1 : 0);
