#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html): the bridge figures added in the catch-up to the Steel Bridge app (2026-11-14). Headless Chromium,
// file://, CDN libraries from tests/libs.
//   Cross-section (ui/xsfig.js PSBXsFig, the Loads & LLDF tab and the Report's figure of §4): for an I-girder bridge (two spans made
//   continuous, unequal bays, a 6 ft × 12 in sidewalk on the right), NEXT 36F, adjacent box beams BIII-36 and voided slabs SIV-48, at 1400
//   and 390 px: the figure is drawn with one outline per girder type × line of the span shown (= PSBXsFig.model), the voids of the boxes
//   and slabs, the line shown outlined, the d_e labels = PSBDesign.deOf, "Deck" with its width; to scale (one scale: the drawn deck width /
//   depth ratio = the model's); the Report (each type's governing line) holds the same figure for each unit; no sideways scroll at 390 px;
//   0 console errors; only psb2.* keys written.
//   node tests/smoke/ps-bridge-figures.mjs [--file <index.html>] [--shots <dir>]
import fs from 'fs';
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) { if (!av[i].startsWith('--')) continue; const k = av[i].slice(2); args[k] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true; }
const FILE = path.resolve(args.file || path.join(REPO, 'apps/ps-bridge/index.html'));
if (args.shots) fs.mkdirSync(args.shots, { recursive: true });
let failures = 0, checks = 0;
const check = (ok, msg) => { checks++; if (!ok) { failures++; console.log('  FAIL ' + msg); } };

const HARP0 = { n: 0, yEnd: 24, yMid: 6, frac: 0.4 };
export const PROJECTS = {
  ibeam: { spans: [110, 130], cont: 'composite', bays: [8.5, 9.5, 9.5, 8.5], ohL: 3.5, ohR: 3, skews: [15, 15, 20], swR: { w: 6, t: 12 } },
  next: { spans: [60], bays: [8, 8, 8, 8], ohL: 4, ohR: 4, skews: [0, 0], girder: 'NEXT 36F', ts: 6, rows: [{ n: 10, y: 2 }, { n: 10, y: 4 }], harp: HARP0 },
  box: { spans: [80], bays: [3, 3, 3, 3, 3, 3, 3, 3, 3], ohL: 1.5, ohR: 1.5, skews: [0, 0], girder: 'AASHTO BIII-36 (39in)', ts: 6, rows: [{ n: 16, y: 2 }], harp: HARP0 },
  slab: { spans: [45], bays: [4, 4, 4, 4, 4], ohL: 2, ohR: 2, skews: [0, 0], girder: 'AASHTO SIV-48 (21in)', ts: 5, rows: [{ n: 20, y: 2 }], harp: HARP0 }
};
export const build = (o) => {
  const M = window.PSBModel; if (!o) return M.newProject();
  const P = M.defaultProject(); P.spans.lengths = o.spans; P.spans.continuity = o.cont || 'simple'; P.xs.bays = o.bays; P.xs.nb = o.bays.length + 1; P.xs.skews = o.skews;
  if (o.ohL != null) P.xs.ohL = o.ohL; if (o.ohR != null) P.xs.ohR = o.ohR;
  if (o.girder) P.base.girder = o.girder; if (o.ts != null) P.base.ts = o.ts;
  if (o.rows) P.base.rows = o.rows.map(r => ({ dbnd: 0, nd: 0, ...r })); if (o.harp) P.base.harp = o.harp;
  P.types = window.PSBBridge.newTypes(P); P.design = { g: 2, s: 1 }; P.xs.dl = window.PSBBridgeDL.defaults(P); if (o.swR) P.xs.dl.swR = o.swR;
  return P;
};
const lsSnap = p => p.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
async function open(name, vw, otab) {
  const pg = await openPage(FILE, { vw, vh: vw > 500 ? 1000 : 844 }); const { p } = pg;
  await p.waitForSelector('#tabBar [data-otab]');
  await p.evaluate(([o, fn, t]) => { const b = new Function('o', 'return (' + fn + ')(o)'); window.PSBModel.save(localStorage, b(o)); localStorage.setItem('psb2.ui', JSON.stringify({ itab: 'proj', otab: t })); }, [PROJECTS[name], build.toString(), otab]);
  await p.reload(); await p.waitForSelector('#tabBar [data-otab]'); await p.waitForTimeout(900);
  return pg;
}

for (const vw of [1400, 390]) for (const name of Object.keys(PROJECTS)) {
  const tag = `${name} @ ${vw}`, pg = await open(name, vw, 'lds'), { p } = pg;
  const r = await p.evaluate(() => {
    const P = window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project, d = window.PSBDesign.sel(P), m = window.PSBXsFig.model(P, d.s);
    const svg = document.querySelector('#ldFig svg'), vb = svg ? svg.viewBox.baseVal : null;
    const outl = svg ? [...svg.querySelectorAll('polygon.xs-g')] : [], deckEl = svg && svg.querySelector('polygon.dt-cc');
    const db = deckEl ? deckEl.getBBox() : null;
    return { cells: window.PSBBridge.cells(P).filter(c => c.s === d.s).length, n: outl.length, shown: outl.filter(e => e.getAttribute('stroke') === '#2563EB').length,
      voids: svg ? svg.querySelectorAll('.xs-v').length : 0, mv: m.girders.reduce((a, q) => a + q.voids.length, 0), txt: svg ? svg.textContent : '',
      de: m.faces.map(f => ({ g: f.g, de: f.de, eng: window.PSBDesign.deOf(P, f.g) })), Wd: m.Wd, ts: m.ts, deckRatio: db ? db.width / db.height : 0,
      cap: [...document.querySelectorAll('#ldFig .vk-cap')].map(e => e.textContent).join(' '), sideways: document.documentElement.scrollWidth > window.innerWidth + 1, err: !!document.querySelector('#out .alert.err') };
  });
  check(!r.err, `${tag}: no error alert`);
  check(r.n === r.cells && r.n >= 4, `${tag}: one section outline per type × line of the span (${r.n} / ${r.cells})`);
  check(r.shown === 1, `${tag}: the line shown outlined (${r.shown})`);
  check(r.voids === r.mv, `${tag}: voids drawn = model (${r.voids} / ${r.mv})`);
  if (name === 'box' || name === 'slab') check(r.mv >= r.cells, `${tag}: every box / slab has its voids (${r.mv})`);
  r.de.forEach(f => { check(Math.abs(f.de - f.eng) < 1e-9, `${tag}: G${f.g} d_e = deOf (${f.de} / ${f.eng})`); check(r.txt.includes(`= ${f.de.toFixed(2)} ft`), `${tag}: G${f.g} d_e label ${f.de.toFixed(2)}`); });
  check(r.txt.includes(`Deck ${(r.Wd / 12).toFixed(2)} ft`), `${tag}: deck width label`);
  if (r.ts > 0) check(Math.abs(r.deckRatio - r.Wd / r.ts) / (r.Wd / r.ts) < 0.02, `${tag}: true scale (deck ${r.deckRatio.toFixed(1)} vs ${(r.Wd / r.ts).toFixed(1)})`);
  check(/Drawn to scale/.test(r.cap) && /schematic/.test(r.cap), `${tag}: caption states the scale and the schematic barrier`);
  check(!r.sideways, `${tag}: no sideways scroll`);
  if (args.shots) await (await p.$('#ldFig')).screenshot({ path: path.join(args.shots, `xs-lds-${name}-${vw}.png`) });
  if (vw === 1400 && name === 'ibeam') {
    // the Report: the same figure in §4 of each unit (each type's governing line)
    await p.click('#tabBar [data-otab="rpt"]'); await p.waitForTimeout(2500);
    const q = await p.evaluate(() => { const s = [...document.querySelectorAll('#rptHost svg[aria-label^="Bridge cross-section"]')].filter(e => e.getBoundingClientRect().width > 0);
      return { n: s.length, outl: s.map(e => e.querySelectorAll('polygon.xs-g').length), cap: [...document.querySelectorAll('#rptHost')].map(e => e.textContent).join('').includes('Cross-section: girder sections') }; });
    check(q.n >= 1 && q.outl.every(k => k === 5), `Report: the cross-section figure in each unit (${q.n}, outlines ${q.outl.join(',')})`);
    check(q.cap, 'Report: the figure caption');
    const keys = Object.keys(await lsSnap(p)); check(keys.every(k => /^psb2\./.test(k) || k === '__psb2_probe'), 'keys ' + keys.join(','));
  }
  check(pg.errs.length === 0, `${tag}: console errors ${pg.errs.slice(0, 3).join(' | ')}`);
  check(pg.blocked.size === 0, `${tag}: blocked ${[...pg.blocked].join(' ')}`);
  await pg.b.close();
}

// ---------- 2026-11-14 (item 3): the Bridge layout tab: the framing plan, the list tables, equal spacing, the girder type of each line ----------
for (const vw of [1400, 390]) {
  const tag = `layout @ ${vw}`, pg = await open('ibeam', vw, 'lds'), { p } = pg;
  const before = (await lsSnap(p))['psb2.project.current'];
  await p.click('#inTabs [data-itab="layout"]'); await p.waitForTimeout(400);
  check((await lsSnap(p))['psb2.project.current'] === before, `${tag}: opening the tab changes nothing saved`);
  const r = await p.evaluate(() => { const P = window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project, m = window.PSBPlan.model(P), svg = document.querySelector('#planFig svg');
    return { cells: window.PSBBridge.cells(P).length, gl: svg ? svg.querySelectorAll('line.xs-gl').length : -1, dia: svg ? svg.querySelectorAll('line.xs-dia').length : -1, cd: svg ? svg.querySelectorAll('line.xs-cd').length : -1,
      mdia: m.dia.length, mcd: m.cont.length, txt: svg ? svg.textContent : '', h: svg ? svg.viewBox.baseVal.height : 0, label: svg ? svg.getAttribute('aria-label') : '', sideways: document.documentElement.scrollWidth > window.innerWidth + 1,
      tables: ['spans.lengths', 'xs.skews'].map(id => { const el = document.getElementById('i_' + id); return !!(el && el.nextElementSibling && el.nextElementSibling.querySelector('table.sli-t')); }) }; });
  check(r.gl === r.cells && r.cells === 10, `${tag}: plan: a girder line per type × line (${r.gl} / ${r.cells})`);
  check(r.cd === r.mcd && r.mcd === 1, `${tag}: plan: the continuity diaphragm on the pier (${r.cd})`);
  check(r.dia === r.mdia, `${tag}: plan: diaphragms = model (${r.dia} / ${r.mdia})`);
  check(['Abut. 1', 'Pier 1', 'Abut. 2', 'θ = 15.0°', 'θ = 20.0°', 'Span 1: 110.00 ft', 'Span 2: 130.00 ft'].every(t => r.txt.includes(t)), `${tag}: plan labels (${r.txt.slice(0, 120)})`);
  check(!/exaggerated/.test(r.label), `${tag}: plan true scale by default`);
  check(r.tables.every(Boolean), `${tag}: spans and skews are tables of rows`);
  await p.click('#planFig [data-vkseg="2"]'); await p.waitForTimeout(300);
  const x2 = await p.evaluate(() => { const svg = document.querySelector('#planFig svg'); return { h: svg.viewBox.baseVal.height, label: svg.getAttribute('aria-label'), cap: (document.querySelector('#planFig [data-plancap]') || {}).textContent || '', on: (document.querySelector('#planFig [data-vkseg="2"]') || {}).getAttribute('aria-pressed') }; });
  check(/exaggerated ×2/.test(x2.label) && x2.h > r.h && /angles are not to scale/.test(x2.cap) && x2.on === 'true', `${tag}: Width ×2 (${r.h} → ${x2.h} high)`);
  check((await lsSnap(p))['psb2.project.current'] === before, `${tag}: Width ×2 is not saved`);
  check(!r.sideways, `${tag}: no sideways scroll`);
  if (args.shots) await (await p.$('#psbPlan')).screenshot({ path: path.join(args.shots, `plan-ibeam-${vw}.png`) });
  if (vw === 1400) {
    // a span typed into its row (the table writes the text back, the page reads it): 110 → 115; + Add: a third span and a fourth skew
    const cell = await p.$('[id="i_spans.lengths"] + [data-sli="host"] tr[data-sli-r="0"] input.sli-in'); await cell.fill('115'); await cell.press('Tab'); await p.click('#inTabs [data-itab="layout"]'); await p.waitForTimeout(400);
    let Q = await p.evaluate(() => window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project);
    check(JSON.stringify(Q.spans.lengths) === '[115,130]' && Q.xs.skews.length === 3, `typed span saved as a number array (${JSON.stringify(Q.spans.lengths)})`);
    await p.click('[id="i_spans.lengths"] + [data-sli="host"] button.sli-add'); const c3 = await p.$('[id="i_spans.lengths"] + [data-sli="host"] tr[data-sli-r="2"] input.sli-in'); await c3.fill('90'); await c3.press('Tab'); await p.click('#inTabs [data-itab="layout"]'); await p.waitForTimeout(500);
    Q = await p.evaluate(() => window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project);
    check(JSON.stringify(Q.spans.lengths) === '[115,130,90]' && Q.xs.skews.length === 4, `a span added: ${JSON.stringify(Q.spans.lengths)}, ${Q.xs.skews.length} skews`);
    // equal spacing: W_cc = Σ bays first, then 38 ft → 9.5 ft bays, the worked step; back to individual keeps them
    await p.click('#inTabs [data-itab="xsec"]'); await p.selectOption('[id="i_xs.spMode"]', 'equal'); await p.waitForTimeout(300);
    Q = await p.evaluate(() => window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project);
    check(Q.xs.spMode === 'equal' && Math.abs(Q.xs.Wcc - 36) < 1e-9 && Q.xs.bays.every(b => Math.abs(b - 9) < 1e-9), `equal: W_cc = Σ bays 36 → S 9 (${JSON.stringify(Q.xs.bays)})`);
    await p.fill('[id="i_xs.Wcc"]', '38'); await p.press('[id="i_xs.Wcc"]', 'Tab'); await p.waitForTimeout(300);
    Q = await p.evaluate(() => window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project);
    const stx = await p.evaluate(() => (document.getElementById('st-xs.eqS') || {}).textContent || '');
    check(JSON.stringify(Q.xs.bays) === '[9.5,9.5,9.5,9.5]' && /9\.500/.test(stx), `W_cc 38: bays ${JSON.stringify(Q.xs.bays)}; step "${stx.slice(0, 60)}"`);
    check(!(await p.$('[id="i_xs.bays"]')), 'equal: no bay list');
    await p.selectOption('[id="i_xs.spMode"]', 'individual'); await p.waitForTimeout(300);
    Q = await p.evaluate(() => window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project);
    check(Q.xs.spMode === 'individual' && JSON.stringify(Q.xs.bays) === '[9.5,9.5,9.5,9.5]' && !!(await p.$('[id="i_xs.bays"]')), 'back to individual keeps the bays');
    // the girder type of each line: G3 in span 1 to the exterior type; the Girders & strands tab's line box follows
    const k = await p.evaluate(() => { const P = window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project; return P.types.findIndex(t => t.span === 1 && t.lines.includes(1)); });
    await p.selectOption('select[data-lt="1|3"]', String(k)); await p.waitForTimeout(300);
    Q = await p.evaluate(() => window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project);
    check(Q.types[k].lines.includes(3) && Q.types.filter(t => t.span === 1 && t.lines.includes(3)).length === 1, `G3 / span 1 moved to type ${k} (${JSON.stringify(Q.types.map(t => [t.span, t.lines]))})`);
    await p.click('#inTabs [data-itab="gird"]'); await p.waitForTimeout(300);
    check(await p.evaluate(kk => { const b = document.querySelector(`input[data-ty="line"][data-k="${kk}"][data-g="3"]`); return !!(b && b.checked); }, k), 'the Girders & strands line box of G3 is ticked for that type');
  }
  check(pg.errs.length === 0, `${tag}: console errors ${pg.errs.slice(0, 3).join(' | ')}`);
  await pg.b.close();
}

// ---------- 2026-11-14 (item 4): the Summary's "Cross-section and plan" card; the Report's framing plan (§2) ----------
for (const vw of [1400, 390]) {
  const tag = `summary @ ${vw}`, pg = await open('ibeam', vw, 'sum'), { p } = pg;
  await p.waitForTimeout(800);
  const r = await p.evaluate(() => { const card = document.getElementById('sum-gfx'), ov = document.getElementById('sum-project'), xs = document.querySelector('#sumXsFig svg'), pl = document.querySelector('#sumPlanFig svg');
    const P = window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project, d = window.PSBDesign.sel(P), cap = Math.max(360, Math.min(760, 0.8 * window.innerHeight));
    const links = card ? [...card.querySelectorAll('a[data-goin], a[data-gotab]')].map(a => a.dataset.goin ? 'in:' + a.dataset.goin : 'out:' + a.dataset.gotab) : [];
    return { card: !!card, before: !!(card && ov && (card.compareDocumentPosition(ov) & Node.DOCUMENT_POSITION_FOLLOWING)), xsN: xs ? xs.querySelectorAll('polygon.xs-g').length : -1, cells: window.PSBBridge.cells(P).filter(c => c.s === d.s).length,
      plN: pl ? pl.querySelectorAll('line.xs-gl').length : -1, all: window.PSBBridge.cells(P).length, hx: xs ? xs.getBoundingClientRect().height : 0, hp: pl ? pl.getBoundingClientRect().height : 0, cap, links,
      wx: xs ? xs.getBoundingClientRect().width : 0, wc: card ? card.getBoundingClientRect().width : 0, sideways: document.documentElement.scrollWidth > window.innerWidth + 1 }; });
  check(r.card && r.before, `${tag}: the card above the project overview`);
  check(r.xsN === r.cells && r.plN === r.all, `${tag}: cross-section ${r.xsN}/${r.cells} sections, plan ${r.plN}/${r.all} girder lines`);
  check(r.hx > 40 && r.hx <= r.cap + 1 && r.hp > 40 && r.hp <= r.cap + 1, `${tag}: heights within the cap (${r.hx.toFixed(0)}, ${r.hp.toFixed(0)} ≤ ${r.cap.toFixed(0)})`);
  check(r.wx > 0.8 * r.wc, `${tag}: full width (${r.wx.toFixed(0)} of ${r.wc.toFixed(0)})`);
  check(['in:xsec', 'in:gird', 'out:lds', 'in:layout', 'in:dd', 'out:3d'].every(k => r.links.includes(k)), `${tag}: links ${r.links.join(',')}`);
  check(!r.sideways, `${tag}: no sideways scroll`);
  if (args.shots) await (await p.$('#sum-gfx')).screenshot({ path: path.join(args.shots, `summary-gfx-${vw}.png`) });
  if (vw === 1400) {
    await p.click('#sum-xs a[data-gotab="lds"]'); await p.waitForTimeout(500);
    check(await p.evaluate(() => document.querySelector('#tabBar [aria-selected="true"]').dataset.otab === 'lds' && !!document.querySelector('#ldFig svg')), 'the cross-section link opens Loads & LLDF');
    await p.click('#tabBar [data-otab="sum"]'); await p.waitForTimeout(500); await p.click('#sum-plan a[data-goin="layout"]'); await p.waitForTimeout(500);
    check(await p.evaluate(() => !document.querySelector('#inPanes [data-pane="layout"]').hidden && !!document.querySelector('#planFig svg')), 'the plan link opens the Bridge layout tab with its plan');
    await p.click('#tabBar [data-otab="rpt"]'); await p.waitForTimeout(2500);
    const q = await p.evaluate(() => { const t = (document.getElementById('rptHost') || {}).textContent || ''; const svg = [...document.querySelectorAll('#rptHost svg[aria-label^="Framing plan"]')].filter(e => e.getBoundingClientRect().width > 0);
      return { fig: /Figure 2\.1: Framing plan/.test(t), n: svg.length, lines: svg[0] ? svg[0].querySelectorAll('line.xs-gl').length : 0, see: /cross-section of each worked girder's span[^.]*: see §4/.test(t) }; });
    check(q.fig && q.n === 1 && q.lines === 10, `Report §2: Figure 2.1 framing plan (${q.n}, ${q.lines} lines)`);
    check(q.see, 'Report §2: the cross-section "see §4" reference');
  }
  check(pg.errs.length === 0, `${tag}: console errors ${pg.errs.slice(0, 3).join(' | ')}`);
  await pg.b.close();
}

// ---------- 2026-11-14 (item 7): the LLDF case on the Loads & LLDF cross-section: lever rule (wheels, influence line), rigid section ----------
for (const vw of [1400, 390]) {
  const tag = `lldf @ ${vw}`, pg = await open('ibeam', vw, 'lds'), { p } = pg;
  const show = (g, s) => p.evaluate(([g, s]) => { const P = window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project; P.design = { g, s }; window.PSBModel.save(localStorage, P); }, [g, s]);
  await show(1, 1); await p.reload(); await p.waitForSelector('#ldFig svg'); await p.waitForTimeout(600);
  const rd = () => p.evaluate(() => { const svg = document.querySelector('#ldFig svg'), P = window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project, d = window.PSBDesign.sel(P);
    const c = window.PSBBridge.cells(P).find(q => q.g === d.g && q.s === d.s), R = window.PSBHoldDown.compute(JSON.parse(JSON.stringify(window.PSBDesign.cellInputs(P, c.k, d.g))));
    return { seg: [...document.querySelectorAll('#ldFig [data-vkseg]')].map(b => b.dataset.vkseg + ':' + b.getAttribute('aria-pressed')), wh: svg.querySelectorAll('.xs-wh').length, il: svg.querySelectorAll('.dt-il').length, res: svg.querySelectorAll('.xs-res').length,
      note: (document.getElementById('ldLLNote') || {}).textContent || '', lever: R.df.lever, rigid: R.df.rigid, NL: R.df.rigidNL, sideways: document.documentElement.scrollWidth > window.innerWidth + 1 }; });
  let r = await rd();
  check(r.seg.join() === 'lever:true,rigid:false', `${tag}: G1: the LLDF case switch (${r.seg.join()})`);
  check(r.wh === 2 && r.il >= 2, `${tag}: lever: two wheels and the influence line (${r.wh}, ${r.il})`);
  check(r.note.includes(`= ${r.lever.toFixed(4)} = the engine's ${r.lever.toFixed(4)}`), `${tag}: lever value = the engine's (${r.note.slice(-90)})`);
  if (args.shots) await (await p.$('#ldFig')).screenshot({ path: path.join(args.shots, `lldf-lever-g1-${vw}.png`) });
  await p.click('#ldFig [data-vkseg="rigid"]'); await p.waitForTimeout(300); r = await rd();
  check(r.wh === 2 * r.NL && r.res === r.NL && r.il === 0 && r.seg.join() === 'lever:false,rigid:true', `${tag}: rigid: ${r.NL} lanes, wheels ${r.wh}, resultants ${r.res}`);
  check(r.note.includes(`= ${r.rigid.toFixed(4)} = the engine's ${r.rigid.toFixed(4)}`), `${tag}: rigid R = the engine's`);
  check(!r.sideways, `${tag}: no sideways scroll`);
  if (args.shots) await (await p.$('#ldFig')).screenshot({ path: path.join(args.shots, `lldf-rigid-g1-${vw}.png`) });
  await show(5, 2); await p.reload(); await p.waitForSelector('#ldFig svg'); await p.waitForTimeout(600); r = await rd();
  check(r.note.includes(`= ${r.lever.toFixed(4)} = the engine's ${r.lever.toFixed(4)}`) || /rigid/i.test(r.seg.join()) && r.wh > 0, `${tag}: G5 (sidewalk side): the drawn case = the engine's (${r.note.slice(-70)})`);
  await show(3, 1); await p.reload(); await p.waitForSelector('#ldFig svg'); await p.waitForTimeout(600); r = await rd();
  check(r.seg.length === 0 && r.wh === 0 && /interior girder/.test(r.note), `${tag}: interior G3: no case, no wheels, the note`);
  if (vw === 1400) {
    await show(1, 1); await p.reload(); await p.waitForSelector('#ldFig svg'); await p.click('#tabBar [data-otab="rpt"]'); await p.waitForTimeout(3000);
    const q = await p.evaluate(() => [...document.querySelectorAll('#rptHost .rp-fig')].map(f => f.textContent).filter(t => /Cross-section: girder sections/.test(t)).map(t => /shown: ([^)\n]+)/.exec(t) ? /shown: ([^)\n]+)/.exec(t)[1].trim() : '?'));
    check(q.some(t => /Lever rule/.test(t)) && q.some(t => /Rigid section/.test(t)), `Report §4: the cross-section in each LLDF case of the exterior unit (${q.join(' | ')})`);
  }
  check(pg.errs.length === 0, `${tag}: console errors ${pg.errs.slice(0, 3).join(' | ')}`);
  await pg.b.close();
}

// ---------- 2026-11-14 (item 8a): the Summary's girder elevation, one per girder type (picker) ----------
for (const vw of [1400, 390]) {
  const tag = `elevation @ ${vw}`, pg = await open('ibeam', vw, 'sum'), { p } = pg;
  await p.waitForSelector('#sumElevFig svg', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(500);
  const rd = () => p.evaluate(() => { const P = window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project, A = window.PSBBridge.results(P, i => window.PSBHoldDown.compute(JSON.parse(JSON.stringify(i))));
    const SM = window.PSBSummaryUI.model(P, A), k = +document.getElementById('sumElevK').value, m = window.PSBSumElev.model(SM, P, k), svg = document.querySelector('#sumElevFig svg');
    return { types: SM.types.length, opts: document.querySelectorAll('#sumElevK option').length, k, label: m.label, g: m.g, marks: m.marks.length, drawn: svg ? svg.querySelectorAll('.se-mark').length : -1,
      list: document.querySelectorAll('#sum-elev .se-list a[data-sumgo]').length, groups: m.marks.length + m.other.length, title: (document.querySelector('#sumElevFig h3') || {}).textContent || '',
      txt: svg ? svg.textContent : '', sideways: document.documentElement.scrollWidth > window.innerWidth + 1 }; });
  let r = await rd();
  check(r.opts === r.types && r.types === 4, `${tag}: a picker of every girder type (${r.opts})`);
  check(r.drawn === r.marks && r.marks >= 4 && r.list === r.groups, `${tag}: the governing check of each group marked (${r.drawn}) and listed (${r.list})`);
  check(r.title.includes(`${r.label} on G${r.g}`), `${tag}: the type's governing line in the title (${r.title})`);
  check(/ℓ/.test(r.txt) && /L = 110\.00 ft/.test(r.txt) && /h = 72\.0 in/.test(r.txt), `${tag}: ℓ_t / ℓ_d and the dimensions drawn`);
  check(!r.sideways, `${tag}: no sideways scroll`);
  if (args.shots) await (await p.$('#sum-elev')).screenshot({ path: path.join(args.shots, `sum-elev-${vw}.png`) });
  const k2 = await p.evaluate(() => { const o = [...document.querySelectorAll('#sumElevK option')].map(x => x.value); return o.find(v => v !== document.getElementById('sumElevK').value); });
  await p.selectOption('#sumElevK', k2); await p.waitForTimeout(500); const r2 = await rd();
  check(String(r2.k) === k2 && r2.label !== r.label && r2.drawn === r2.marks, `${tag}: the picker draws another type (${r2.label} on G${r2.g})`);
  if (vw === 1400) {
    const go = await p.evaluate(() => { const g = document.querySelector('#sumElevFig .se-mark'); return g && g.getAttribute('data-sumgo'); });
    await p.$eval('#sumElevFig .se-mark rect.dt-reg', e => { e.scrollIntoView({ block: 'center' }); e.dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await p.waitForTimeout(600);
    const tab = await p.evaluate(() => document.querySelector('#tabBar [aria-selected="true"]').dataset.otab);
    check(go && (tab === go.split('|')[2] || go.split('|')[4] === '1'), `a marker opens its check's tab (${go} → ${tab})`);
  }
  check(pg.errs.length === 0, `${tag}: console errors ${pg.errs.slice(0, 3).join(' | ')}`);
  await pg.b.close();
}

// ---------- 2026-11-14 (item 8b): the 3D view: View (whole bridge / girder line close-up), Zoom to, Diagram, Scale, + moment down ----------
for (const vw of [1400, 390]) {
  const tag = `3d @ ${vw}`, pg = await open('ibeam', vw, '3d'), { p } = pg;
  await p.waitForSelector('#v3d-host canvas', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(1200);
  const st = () => p.evaluate(() => Object.assign(window.PSB3DUI.state(), { ui: JSON.parse(localStorage.getItem('psb2.ui') || '{}').v3d || {}, dgTxt: (document.getElementById('v3d-dg') || {}).textContent || '', sideways: document.documentElement.scrollWidth > window.innerWidth + 1,
    focus: !(document.getElementById('v3d_focus') || {}).hidden, cells: (() => { const P = window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project; return window.PSBBridge.cells(P).length; })() }));
  let r = await st();
  check(r.counts && r.counts.girders === r.cells && r.fences === 0 && !r.focus, `${tag}: whole bridge, no diagram by default (${r.counts && r.counts.girders} girders)`);
  await p.selectOption('#v3d_dg', 'mStr'); await p.waitForTimeout(1500); r = await st();
  check(r.fences === 2 * r.cells && /Strength I envelope/.test(r.dgTxt) && r.ui.dg === 'mStr', `${tag}: Strength I moment fences beside every girder (${r.fences})`);
  await p.selectOption('#v3d_mode', 'g1'); await p.waitForTimeout(1500); r = await st();
  check(r.mode === 'g1' && r.counts.girders === 2 && r.fences === 4 && r.focus && r.tg.includes('s1h') && r.tg.includes('s2m') && r.ui.mode === 'g1', `${tag}: G1 close-up: its 2 girders, 4 fences, Zoom to ${r.tg && r.tg.join(',')}`);
  check(r.counts.strands > 0 && /strand lines of G1/.test(r.info), `${tag}: the close-up's strands (${r.counts.strands})`);
  const cam0 = await p.evaluate(() => window.PSB3DUI.camera()); await p.selectOption('#v3d_focus', 's1h'); await p.waitForTimeout(400); const cam1 = await p.evaluate(() => window.PSB3DUI.camera());
  check(JSON.stringify(cam0.t) !== JSON.stringify(cam1.t), `${tag}: Zoom to the hold-down point moves the camera`);
  await p.selectOption('#v3d_dg', 'vStr'); await p.waitForTimeout(1200); r = await st(); check(/Shear: Strength I/.test(r.dgTxt) && r.fences === 4, `${tag}: shear envelope`);
  await p.$eval('#v3d_dsc', e => { e.value = '2'; e.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(800); r = await st(); check(r.ui.dsc === 2 && r.fences === 4, `${tag}: Scale kept (${r.ui.dsc})`);
  await p.click('#v3d_eng'); await p.waitForTimeout(800); r = await st(); check(r.ui.eng === false, `${tag}: + moment down off kept`);
  await p.reload(); await p.waitForSelector('#v3d-host canvas', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(1500); r = await st();
  check(r.mode === 'g1' && r.fences === 4 && r.ui.dg === 'vStr', `${tag}: the view and diagram kept on reload`);
  check(!r.sideways, `${tag}: no sideways scroll`);
  if (args.shots) await (await p.$('#v3dHost')).screenshot({ path: path.join(args.shots, `3d-closeup-${vw}.png`) });
  const keys = Object.keys(await lsSnap(p)); check(keys.every(k => /^psb2\./.test(k) || k === '__psb2_probe'), `${tag}: keys ${keys.join(',')}`);
  check(pg.errs.length === 0, `${tag}: console errors ${pg.errs.slice(0, 3).join(' | ')}`);
  await pg.b.close();
}
console.log(`${checks} checks, ${failures} failed`);
process.exit(failures ? 1 : 0);
