#!/usr/bin/env node
// Steel Beam Design - AISC 15th: Analysis tab summary of all load combinations and the envelope station table (SBAS, 2026-11-13).
// Display only. Headless, offline. On a 3-span beam (fixed end, point loads, cantilever):
//   1. the first Analysis card is "Summary of All Load Combinations": one row per combination, every value equal to AN
//      (fmt 3 decimals) and to the combination's own worked section; the highlighted cell of each column is the largest |value|,
//      repeated in the Governing row;
//   2. a value opens the combination's worked card (anC_<id>); a combination name selects that combination (the diagrams and
//      Tabulated Results follow, S.disp.combo);
//   3. Tabulated Results: "Envelope of all combinations" gives at each station the max / min over the combinations' own tables;
//      the choice is not saved (S and the autosave unchanged);
//   4. the Report holds the summary table with a § link per combination;
//   5. member-check and batch modes: no Analysis tab, Report builds, no console errors;
//   6. 390 px: the page does not scroll sideways, the table scrolls in its card.
//   node tests/smoke/steel-beam-analysis-summary.mjs [--file <tool html>]
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FILE = path.resolve(REPO, arg('file', 'Steel Beam Design - AISC 15th.html'));
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const MODEL = () => {
  S.geom = { spans: [{ L: 20 }, { L: 25 }, { L: 6 }], nodes: [{ t: 'fixed' }, { t: 'roller' }, { t: 'roller' }, { t: 'free' }] };
  S.loads = [{ id: 'p1', type: 'point', lc: 'LL', mag: 12, si: 1, pos: 10 }, { id: 'p2', type: 'point', lc: 'DL', mag: 5, si: 2, pos: 6 },
    { id: 'p3', type: 'point', lc: 'WL', mag: -6, si: 0, pos: 8 }];
  S.mode = 'beam'; S.ui.tab = 'tabAnalysis'; fullRebuild();
};
const tab = async (p, t) => { await p.evaluate(t => [...document.querySelectorAll('#tabBar button')].find(x => x.textContent.trim() === t).click(), t); await p.waitForTimeout(t === 'Report' ? 3000 : 900); };

{
  const { b, p, errs } = await openPage(FILE);
  await p.waitForFunction(() => typeof AN !== 'undefined' && AN && AN.combos); await p.waitForTimeout(700);
  await p.evaluate(MODEL); await p.waitForTimeout(900);
  // 1
  const r1 = await p.evaluate(() => {
    const first = document.querySelector('#tabPages .sec');
    const t = first.querySelector('table'), rows = [...t.rows], head = [...rows[0].cells].map(c => c.textContent);
    const bad = [], W = sbAsWorkedId();
    AN.combos.forEach((cb, i) => {
      const c = [...rows[1 + i].cells].map(x => x.textContent), col = h => c[head.indexOf(h)];
      const own = [...document.querySelector('.sec[data-secid=anC_' + W[cb.id] + '] table').rows].slice(1).map(r => r.cells[1].textContent.split(' ')[0]);
      [['V max (kip)', cb.Vmax.v, own[0]], ['V min (kip)', cb.Vmin.v, own[1]], ['M max (+) (kip·ft)', cb.Mmax.v, own[2]], ['M min (−) (kip·ft)', cb.Mmin.v, own[3]],
       ['RA (kip)', cb.R[0].v], ['MᴿA (kip·ft)', cb.R[0].m], ['RB (kip)', cb.R[1].v], ['RC (kip)', cb.R[2].v]].forEach(([h, v, o]) => {
        if (col(h) !== fmt(v, 3) || (o !== undefined && o !== col(h))) bad.push(cb.name + ' ' + h + ' ' + col(h) + ' / ' + fmt(v, 3) + ' / ' + o); });
    });
    // highlighted = largest |value|, and the Governing row repeats it
    const gov = [...rows[1 + AN.combos.length].cells].map(x => x.textContent);
    head.forEach((h, k) => { if (!k || h.startsWith('at x')) return;
      const vals = AN.combos.map((cb, i) => rows[1 + i].cells[k]), best = Math.max(...vals.map(c => Math.abs(+c.textContent)));
      vals.forEach(c => { if ((Math.abs(+c.textContent) === best && best > 0) !== c.classList.contains('sbAsGov')) bad.push('highlight ' + h); });
      if (Math.abs(+gov[k]) !== best) bad.push('governing ' + h); });
    return { title: first.querySelector('.secTitle').textContent, rows: rows.length, n: AN.combos.length, bad, svc: !!first.querySelector('.wkLink a.wkA[data-tab=tabService]') };
  });
  assert.equal(r1.title, '1. Summary of All Load Combinations');
  assert.equal(r1.rows, r1.n + 3); assert.deepEqual(r1.bad, []); assert.ok(r1.svc);
  ok('summary card first; ' + r1.n + ' combinations: every value = AN = its worked section; highlight and Governing row = largest |value|');
  // 2
  const c2 = await p.evaluate(() => AN.combos[2].id);
  await p.evaluate(id => { S.ui.collapse['anC_' + id] = true; document.querySelectorAll('.sec[data-secid=anSum] tr')[3].querySelector('a.wkA').click(); }, c2);
  await p.waitForTimeout(900);
  const r2 = await p.evaluate(id => { const e = document.querySelector('.sec[data-secid=anC_' + id + ']'), op = document.getElementById('outputPanel'), r = e.getBoundingClientRect(), o = op.getBoundingClientRect();
    return { open: !e.classList.contains('collapsed'), inView: r.top >= o.top - 2 && r.top < o.bottom }; }, c2);
  assert.deepEqual(r2, { open: true, inView: true });
  ok('a value opens and scrolls to its combination\'s worked card');
  await p.evaluate(() => document.querySelectorAll('.sec[data-secid=anSum] a.sbAsSel')[3].click()); await p.waitForTimeout(1200);
  const r3 = await p.evaluate(() => ({ disp: S.disp.combo, id: AN.combos[3].id, nm: AN.combos[3].name, dia: document.querySelector('.sec[data-secid=anDia] .secTitle').textContent,
    tbl: document.querySelector('.sec[data-secid=anTable] .secTitle').textContent, sel: document.querySelector('select[data-fkey=dispCombo]').value }));
  assert.equal(r3.disp, r3.id); assert.equal(r3.sel, r3.id); assert.ok(r3.dia.endsWith(r3.nm) && r3.tbl.endsWith(r3.nm));
  ok('a combination name selects it: selector, diagrams and Tabulated Results follow');
  // 3
  const before = await p.evaluate(() => [JSON.stringify(S), localStorage.getItem('sbd_autosave_v1')]);
  await p.selectOption('select[data-fkey=anTblView]', 'env'); await p.waitForTimeout(600);
  const r4 = await p.evaluate(() => {
    const sec = document.querySelector('.sec[data-secid=anTable]'), t = sec.querySelector('table'), bad = [];
    const own = AN.combos.map(cb => { const m = {}; [...stationTable(cb).rows].slice(1).forEach(r => { const c = [...r.cells].map(x => x.textContent); m[c[0] + c[1]] = c; }); return m; });
    let shared = 0;
    [...t.rows].slice(1).forEach(r => { const c = [...r.cells].map(x => x.textContent); if (!/^(node|sp)/.test(c[1])) return;
      const oc = own.map(m => m[c[0] + c[1]]); if (oc.some(x => !x)) return; shared++;
      [[2, 2], [6, 3], [10, 4]].forEach(([k, j]) => { const v = oc.map(x => +x[j]);
        if (+c[k] !== Math.max(...v) || +c[k + 2] !== Math.min(...v)) bad.push(c[0] + ' col ' + k); }); });
    return { title: sec.querySelector('.secTitle').textContent, shared, bad };
  });
  assert.ok(r4.title.endsWith('Envelope of All Combinations')); assert.ok(r4.shared >= 31); assert.deepEqual(r4.bad, []);
  const after = await p.evaluate(() => [JSON.stringify(S), localStorage.getItem('sbd_autosave_v1')]);
  assert.deepEqual(after, before);
  ok('envelope table: max / min of the combinations\' own tables at ' + r4.shared + ' stations; the choice is not saved');
  // 4
  await tab(p, 'Report');
  const r5 = await p.evaluate(() => { const s = [...document.querySelectorAll('.rp-sub')].find(x => /Summary of All Load Combinations/.test(x.querySelector('h3').textContent));
    return s ? { see: s.querySelectorAll('table a.rp-see').length, bad: s.querySelectorAll('.rp-bad').length, hi: s.querySelectorAll('td.rp-hi').length } : null; });
  const nC = await p.evaluate(() => AN.combos.length);
  assert.ok(r5 && r5.see >= nC && r5.bad === 0 && r5.hi > 0, JSON.stringify(r5));
  ok('Report: summary table with ' + r5.see + ' § links, governing cells marked');
  // 5
  for (const m of ['member', 'batch']) {
    await p.evaluate(m => { S.mode = m; fullRebuild(); }, m); await p.waitForTimeout(1200);
    assert.equal(await p.evaluate(() => TABS().some(t => t[0] === 'tabAnalysis')), false);
    await tab(p, 'Report');
    assert.ok(await p.evaluate(() => !!document.querySelector('.rp-sub')), m + ' Report');
    ok(m + ' mode: no Analysis tab, Report builds');
  }
  assert.deepEqual(errs, []);
  ok('no console errors');
  await b.close();
}
{ // 6
  const { b, p, errs } = await openPage(FILE, { vw: 390, vh: 844 });
  await p.waitForFunction(() => typeof AN !== 'undefined' && AN && AN.combos); await p.waitForTimeout(700);
  await p.evaluate(MODEL); await p.waitForTimeout(900);
  const r = await p.evaluate(() => { const w = document.querySelector('.sec[data-secid=anSum] .sbAsWrap');
    return { doc: document.documentElement.scrollWidth, vw: innerWidth, sw: w.scrollWidth, cw: w.clientWidth }; });
  assert.ok(r.doc <= r.vw && r.sw > r.cw, JSON.stringify(r));
  assert.deepEqual(errs, []);
  ok('390 px: no sideways page scroll; the summary table scrolls in its card');
  await b.close();
}
console.log(n + ' checks passed');
