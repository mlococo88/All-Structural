#!/usr/bin/env node
// Spread Footing SFRU (engineer 2026-11-16, display only): the per-element reinforcement inputs on the Reinforcement tab as one card
// with numbered sections (1 bars, entry mode first; 2 ties / horizontal bars; 3 cover + exposure; 4 dowels, joint surface; 5 bars
// provided), only the inputs that apply shown. Results and saved data must not change.
// Opens A = a checkout of origin/main (with its shared/ folder) and B = the working tree, headless from file://, one browser at a time.
// For every project: the saved JSON is opened (migrateState, the tool's own load path), then the same inputs are changed through the
// card's inputs (the same data-path elements in both versions: value + input/change events, as a user would), and compared:
//   the saved project JSON (state), R, P2, the dashboard, the text of every result tab and the Report model: 0 differences, both
//   after opening and after the edits.
// In B only: every edited input is visible and enabled in the new card (the edit is made through the new UI); after each edit the
// data-path holds the value typed (barsel -> integer, data-num -> number, checkbox -> its on / off value); after a rebuild each
// input of the card shows its data-path; which inputs each project shows; no visible input is disabled (hide, don't grey); the
// SFRU visibility fix (no wall-only rows on a Pedestal after a rebuild); 0 console errors; no horizontal page scroll at 390 px.
//   node tests/smoke/spread-footing-rebar-ui.mjs --a <folder with the origin/main checkout> [--b <folder>]
import path from 'path';
import { openPage, diff } from '../lib.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) { if (!av[i].startsWith('--')) continue; const k = av[i].slice(2); args[k] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true; }
if (!args.a) { console.log('usage: --a <folder holding the origin/main copy of the repository> [--b <folder>]'); process.exit(2); }
const A = path.join(path.resolve(args.a), 'Spread Footing.html'), B = args.b ? path.join(path.resolve(args.b), 'Spread Footing.html') : path.resolve('Spread Footing.html');
let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL ' + msg); } else console.log('  ok   ' + msg); };

const R0 = 'peds.0.reinf.', W0 = 'peds.0.wallIn.';
const WALL = "state.geom.B=6;state.geom.L=22;state.peds=[state.peds[0]];const p=state.peds[0];p.label='Wall 1';p.elemType='wall';p.x=0;p.y=0;p.bx=1;p.by=20;p.h=3;"
  + "p.loads.D.P=240;p.loads.L.P=100;p.loads.Wx.Vx=20;p.loads.Wx.Mx=50;"
  + "Object.assign(p.reinf,{longSize:6,longMode:'faces',nx:2,ny:10,nTot:30,tieSize:0,tieSpc:12,cover:2,dowelLong:true,dowelN:14,dowelHook:'hook90'});p.wallIn.hSize='4';p.wallIn.hSpc=12;";
// [name, project patch, edits [data-path, value] made through the card, B: data-paths that must be shown / hidden after the edits]
const CASES = [
  ['pedestal, n per face, separate straight dowels, smooth joint', 'state.peds[0].loads.D.Mx=60;',
    [[R0 + 'longSize', 9], [R0 + 'nx', 4], [R0 + 'ny', 3], [R0 + 'tieSize', 4], [R0 + 'tieSpc', 10], [R0 + 'cover', 2.5], [R0 + 'exposure', 'earth'],
     [R0 + 'dowelLong', false], [R0 + 'dowelSize', 9], [R0 + 'dowelN', 10], [R0 + 'dowelHook', false], [R0 + 'dowelProj', 30], [R0 + 'sfJoint', 'smooth']],
    { show: ['longSize', 'longMode', 'nx', 'ny', 'tieSize', 'tieSpc', 'cover', 'exposure', 'dowelLong', 'dowelSize', 'dowelN', 'dowelHook', 'dowelProj', 'sfJoint'], hide: ['nTot', 'longSpc', 'wallSpc', 'hSize', 'hSpc', 'hPos'] }],
  ['pedestal, total quantity, dowels = longitudinal bars, hooked', '',
    [[R0 + 'longMode', 'total'], [R0 + 'nTot', 14], [R0 + 'longSize', 7]],
    { show: ['longMode', 'nTot', 'dowelLong', 'dowelHook', 'sfJoint'], hide: ['nx', 'ny', 'longSpc', 'wallSpc', 'dowelSize', 'dowelN', 'dowelProj', 'hSize'], sum: /^12 #7|^14 #7/ }],
  ['pedestal, spacing, dowels = longitudinal bars, straight', "state.peds[1].loads.Wx.Vx=15;",
    [[R0 + 'longMode', 'spacing'], [R0 + 'longSpc', 5.5], [R0 + 'dowelHook', false], ['peds.1.reinf.longMode', 'total'], ['peds.1.reinf.nTot', 11]],
    { show: ['longMode', 'longSpc'], hide: ['nx', 'ny', 'nTot', 'wallSpc', 'dowelSize', 'dowelN', 'dowelProj'], sum: /straight in the footing/ }],
  ['wall with a spacing (s_v), horizontal bars inside', WALL,
    [[R0 + 'wallSpc', 12], [W0 + 'hSize', '5'], [W0 + 'hSpc', 10], [W0 + 'hPos', 'in'], [R0 + 'longSize', 7], [R0 + 'cover', 2.25]],
    { show: ['longSize', 'wallSpc', 'hSize', 'hSpc', 'hPos', 'cover', 'exposure', 'dowelLong', 'dowelHook', 'sfJoint'], hide: ['longMode', 'nx', 'ny', 'nTot', 'longSpc', 'tieSize', 'tieSpc', 'dowelSize', 'dowelN', 'dowelProj'] }],
  ['wall, legacy entry (no single spacing), separate dowels', WALL.replace('nx:2,ny:10', 'nx:3,ny:10').replace('dowelLong:true', 'dowelLong:false'),
    [[R0 + 'ny', 9], [R0 + 'dowelN', 22], [R0 + 'dowelSize', 6]],
    { show: ['longMode', 'nx', 'ny', 'wallSpc', 'dowelSize', 'dowelN', 'dowelProj'], hide: ['nTot', 'longSpc', 'tieSize'] }],
  ['wall, legacy entry given a spacing', WALL.replace('nx:2,ny:10', 'nx:3,ny:10'),
    [[R0 + 'wallSpc', 14]],
    { show: ['wallSpc'], hide: ['longMode', 'nx', 'ny'] }],
  ['wall needing ties (A_st > 0.01 A_g), same-as-ties edit', "state.geom.B=6;state.geom.L=10;state.peds=[state.peds[0]];const p=state.peds[0];p.label='W2';p.elemType='wall';p.x=0;p.y=0;p.bx=8;p.by=10/12;p.h=4;p.loads.D.P=200;Object.assign(p.reinf,{longSize:11,longMode:'faces',nx:10,ny:2,tieSize:3,tieSpc:12,cover:1.5,dowelLong:true});p.wallIn.hSize='5';p.wallIn.hSpc=12;",
    [[R0 + 'tieSize', 4], [R0 + 'tieSpc', 9], [W0 + 'hSize', 'sameTie'], [W0 + 'hSpc', '']],
    { show: ['tieSize', 'tieSpc', 'hSize', 'hSpc'], hide: ['hPos'] }],
  ['pedestal changed to a wall on the Pedestals card', "state.peds=[state.peds[0]];const p=state.peds[0];p.x=0;p.y=0;p.bx=1;p.by=12;p.h=3;state.geom.L=14;Object.assign(p.reinf,{longSize:6,longMode:'faces',nx:2,ny:7,cover:2});",
    [['peds.0.elemType', 'wall'], [W0 + 'hSize', '4'], [W0 + 'hSpc', 12]],
    { show: ['wallSpc', 'hSize'], hide: ['nx', 'ny', 'longMode', 'tieSize'] }],
  ['bearing patch (h = 0), separate dowels', "state.peds[0].h=0;", [[R0 + 'dowelN', 6], [R0 + 'sfJoint', 'smooth']],
    { show: ['dowelSize', 'dowelN', 'dowelProj', 'sfJoint'], hide: [] }],
];

async function run(file, isB) {
  const o = await openPage(file, { vw: 1400, vh: 1000 });
  await o.p.waitForSelector('#tabbar button[data-tab="tab-report"]', { state: 'attached' });
  await o.p.waitForTimeout(1500);
  const out = [];
  if (isB) {   /* SFRU visibility fix: the default project (two Pedestals) right after loading: no wall-only rows anywhere */
    const v = await o.p.evaluate(() => [...document.querySelectorAll('.sfdWallOnly,.sfdHzRow')].filter(e => e.style.display !== 'none').length);
    check(v === 0, 'page load, two Pedestals: no wall-only row shown (Pedestals card or Reinforcement card) (got ' + v + ')');
    const v2 = await o.p.evaluate(() => { document.getElementById('btnAddPed').click(); return [...document.querySelectorAll('.sfdWallOnly,.sfdHzRow')].filter(e => e.style.display !== 'none').length; });
    check(v2 === 0, 'Add pedestal: no wall-only row shown (got ' + v2 + ')');
  }
  const cap = () => o.p.evaluate(async () => {
    recalc();
    const strip = o => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'function' ? undefined : (typeof v === 'number' && !isFinite(v) ? String(v) : v))));
    const tabs = {};
    for (const id of ['tab-schem', 'tab-combos', 'tab-bearing', 'tab-stab', 'tab-footdes', 'tab-peddes', 'tab-walldes', 'tab-drawings']) { const e = document.getElementById(id); if (e) tabs[id] = e.innerText; }
    document.querySelector('#tabbar button[data-tab="tab-report"]').click(); await new Promise(res => setTimeout(res, 1200));
    const nid = v => v.replace(/[a-z0-9]{6}(?=[-"')])/g, '#').replace(/\b(id|href|xlink:href|clip-path)="[^"]*"/g, '$1=""').replace(/url\([^)]*\)/g, 'url()');
    let rep = '';
    if (SFRP.doc) rep = JSON.parse(JSON.stringify(SFRP.doc.model, (k, v) => typeof v === 'function' || k.charAt(0) === '_' ? undefined : (k === 'svg' && typeof v === 'string' ? (/main-svg/.test(v) ? 'plotly: ' + v.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ') : nid(v)) : v))).sections;
    document.querySelector('#tabbar button[data-tab="tab-bearing"]').click();
    let saved = null; try { saved = JSON.parse(localStorage.getItem('sfd_auto')).state; } catch (e) {}
    return { state: JSON.parse(JSON.stringify(state)), saved, R: strip({ asd: R.asd, lrfd: R.lrfd, W: R.W, govBear: R.govBear && R.govBear.cb.name }), P2: strip(P2), dash: document.getElementById('dashboard').innerText, tabs, rep };
  });
  for (const [name, src, edits, exp] of CASES) {
    o.errs.length = 0;
    await o.p.evaluate((src) => {
      const st = defaultState(); (new Function('state', src))(st);
      state = Object.assign(defaultState(), JSON.parse(JSON.stringify(st)));   /* as a saved / imported project */
      migrateState(); SEL.asd = null; SEL.lrfd = null; SEL.asdLr = null; bindStaticInputs(); buildPedCards(); recalc(); saveAuto();
      sfdSetInTab('rebar');
    }, src);
    const opened = await cap();
    const rt = [];
    for (const [pth, val] of edits) {
      const r = await o.p.evaluate(async ([pth, val, isB]) => {
        const x = document.querySelector('[data-path="' + pth + '"]');
        if (!x) return { missing: true };
        if (/^peds\.\d+\.elemType$/.test(pth)) sfdSetInTab('peds'); else sfdSetInTab('rebar');
        const vis = x.offsetParent !== null, dis = x.disabled;
        if (x.type === 'checkbox') { x.checked = !!val; x.dispatchEvent(new Event('change', { bubbles: true })); }
        else if (x.tagName === 'SELECT') { x.value = String(val); x.dispatchEvent(new Event('input', { bubbles: true })); x.dispatchEvent(new Event('change', { bubbles: true })); }
        else { x.value = String(val); x.dispatchEvent(new Event('input', { bubbles: true })); }
        const want = x.type === 'checkbox' ? (x.dataset.on !== undefined ? (val ? x.dataset.on : x.dataset.off) : !!val) : x.classList.contains('barsel') ? parseInt(val, 10) : x.dataset.num !== undefined ? (val === '' ? 0 : Number(val)) : String(val);
        const got = getPath(state, pth);
        await new Promise(res => setTimeout(res, 700));
        return { vis, dis, ok: got === want, got, want };
      }, [pth, val, isB]);
      rt.push([pth, r]);
    }
    const edited = await cap();
    let card = null;
    if (isB) card = await o.p.evaluate(() => {
      sfdSetInTab('rebar'); buildPedCards(); sfdPedBarInfo();
      const rb = document.querySelector('.sfdPedRb[data-ped="0"]'), all = [...rb.querySelectorAll('[data-path]')];
      const vis = all.filter(x => x.offsetParent !== null), key = x => x.dataset.path.replace(/^peds\.0\.(reinf|wallIn)\./, '');
      /* each input shows its data-path after a rebuild (the card's own initial-value rules) */
      const bad = all.filter(x => { if (x.dataset.sfEff) return false; const v = getPath(state, x.dataset.path);
        if (x.type === 'checkbox') return x.checked !== (x.dataset.on !== undefined ? v === x.dataset.on : v === true);
        if (/exposure$/.test(x.dataset.path)) return x.value !== (v || 'weather');
        if (/sfJoint$/.test(x.dataset.path)) return x.value !== (v === 'smooth' ? 'smooth' : 'rough');
        if (/hPos$/.test(x.dataset.path)) return x.value !== ((state.peds[0].wallIn || {}).hSize === 'sameTie' ? 'out' : (v === 'in' ? 'in' : 'out'));
        if (/hSize$/.test(x.dataset.path)) return x.value !== String(v || '');
        return x.value !== ((v === undefined || v === null) ? '' : String(v)); }).map(key);
      const secs = [...rb.querySelectorAll('.sfdRbSec')].map(s => s.innerText.trim());
      const sum = rb.querySelector('.sfdDwSumT'), cm = rb.querySelector('.sfdCovMin');
      return { shown: vis.map(key), disabled: vis.filter(x => x.disabled).map(key), bad, secs, head: rb.querySelector('.sfdPedRbH').innerText,
        sum: sum && sum.offsetParent !== null ? sum.innerText : null, covMin: cm && cm.offsetParent !== null ? cm.innerText : null };
    });
    out.push({ name, opened, edited, rt, card, errs: o.errs.slice() });
  }
  await o.b.close();
  return out;
}

console.log('A = ' + A + '\nB = ' + B);
const a = await run(A, false);
console.log('B (the new card):');
const b = await run(B, true);
for (let i = 0; i < CASES.length; i++) {
  const [name, , edits, exp] = CASES[i], x = a[i], y = b[i];
  console.log(name);
  for (const st of ['opened', 'edited']) {
    const d = {};
    for (const k of ['state', 'saved', 'R', 'P2', 'dash', 'tabs', 'rep']) d[k] = diff(x[st][k], y[st][k]).length;
    const ok = Object.values(d).every(n => n === 0);
    check(ok, st + ': main vs branch identical (saved JSON, state, R, P2, dashboard, result tabs, Report) ' + JSON.stringify(d));
    if (!ok) for (const k of Object.keys(d)) diff(x[st][k], y[st][k]).slice(0, 5).forEach(z => console.log('     ' + k + ' ' + JSON.stringify(z).slice(0, 300)));
  }
  check(diff(x.opened.state, x.edited.state).length > 0, 'the edits changed the project (both versions)');
  const nv = y.rt.filter(([, r]) => r.missing || !r.vis || r.dis).map(([p]) => p);
  check(nv.length === 0, 'every edit made through a visible, enabled input of the new card' + (nv.length ? ' (not: ' + nv.join(', ') + ')' : ''));
  const nr = y.rt.filter(([, r]) => !r.ok).map(([p, r]) => p + ' got ' + JSON.stringify(r.got) + ' want ' + JSON.stringify(r.want));
  check(nr.length === 0, 'each edit stored at its data-path with the typed value (' + edits.length + ' edits)' + (nr.length ? ': ' + nr.join('; ') : ''));
  const C = y.card;
  check(C.bad.length === 0, 'after a rebuild every input shows its data-path' + (C.bad.length ? ' (not: ' + C.bad.join(', ') + ')' : ''));
  check(C.disabled.length === 0, 'no visible input is disabled (hide, not grey)' + (C.disabled.length ? ' (' + C.disabled.join(', ') + ')' : ''));
  const ms = exp.show.filter(k => !C.shown.includes(k)), mh = exp.hide.filter(k => C.shown.includes(k));
  check(!ms.length && !mh.length, 'shown / hidden as they apply' + (ms.length ? ' missing ' + ms : '') + (mh.length ? ' should be hidden ' + mh : '') + '  [shown: ' + C.shown.join(' ') + ']');
  check(C.secs.length === 5 && /^1\./.test(C.secs[0]) && /^5\. Bars provided/.test(C.secs[4]), 'sections ' + JSON.stringify(C.secs) + '; header "' + C.head + '"');
  if (exp.sum) check(exp.sum.test(C.sum || ''), 'dowel summary "' + C.sum + '"');
  if (C.covMin) console.log('       cover line: ' + C.covMin);
  check(y.errs.length === 0, '0 console errors ' + JSON.stringify(y.errs.slice(0, 3)));
}
// 390 px: no horizontal page scroll with a pedestal card and a wall card on the Reinforcement tab
const ph = await openPage(B, { vw: 390, vh: 844 });
await ph.p.waitForSelector('#tabbar button[data-tab="tab-report"]', { state: 'attached' }); await ph.p.waitForTimeout(1500);
for (const src of ['', WALL]) {
  await ph.p.evaluate(src => { state = defaultState(); (new Function('state', src))(state); state = Object.assign(defaultState(), JSON.parse(JSON.stringify(state))); migrateState(); bindStaticInputs(); buildPedCards(); recalc(); sfdSetInTab('rebar'); }, src);
  await ph.p.waitForTimeout(600);
  const sw = await ph.p.evaluate(() => { const rb = document.querySelector('.sfdPedRb'), r = rb.getBoundingClientRect(), wide = [...rb.querySelectorAll('*')].filter(e => e.offsetParent !== null && e.getBoundingClientRect().right > r.right + 1).length;
    return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, wide }; });
  check(sw.sw <= sw.cw + 1 && sw.wide === 0, '390 px, ' + (src ? 'wall' : 'pedestal') + ': no horizontal page scroll (' + sw.sw + ' <= ' + sw.cw + '), nothing wider than the card (' + sw.wide + ')');
}
check(ph.errs.length === 0, '390 px: 0 console errors');
await ph.b.close();
console.log(failures ? failures + ' FAILURE(S)' : 'all checks pass');
process.exit(failures ? 1 : 0);
