#!/usr/bin/env node
// CBIF (2026-11-13): Concrete Beam Capacity suite: no input box or select cuts off its value. In each module (Beam Capacity, beam and
// one-way slab; ASD Beam Calcs; Development & Splice), on every input tab (role=tab) and, in Beam Capacity, every output tab, each visible
// select / text / number input is measured: the width of its text (the selected option's label, or the value) in its own font must fit
// its content box (clientWidth less padding, less the drop-down arrow of a native select), and scrollWidth must not exceed clientWidth.
// Widths 1400, 1500 (the engineer's laptop), 1920 and 390 px; file://; 0 console errors. Display only.
//   node tests/smoke/cbc-input-fit.mjs [--file <Concrete Beam Capacity.html>] [--w 1400,1500,1920,390] [--shots <dir>]
import path from 'path';
import { openPage, REPO } from '../lib.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FILE = path.resolve(arg('file', path.join(REPO, 'Concrete Beam Capacity.html')));
const WIDTHS = arg('w', '1400,1500,1920,390').split(',').map(Number);
const SHOTS = arg('shots', null);
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
// in the page: every visible select / input whose text does not fit
const AUDIT = () => {
  const cx = document.createElement('canvas').getContext('2d'), bad = [];
  let n = 0;
  document.querySelectorAll('select, input').forEach(e => {
    if (e.tagName === 'INPUT' && !/^(text|number|search|)$/.test(e.type)) return;
    const r = e.getBoundingClientRect(); if (!r.width || !r.height || !e.offsetParent) return;
    const cs = getComputedStyle(e); if (cs.visibility === 'hidden') return;
    cx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const sel = e.tagName === 'SELECT', txt = sel ? (e.selectedOptions[0] ? e.selectedOptions[0].text : '') : (e.value || '');
    if (!txt) return;
    n++;
    const arrow = sel && cs.appearance !== 'none' && !e.multiple && !(e.size > 1) ? 20 : 0;
    const avail = e.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - arrow, need = cx.measureText(txt).width;
    const key = e.dataset.fkey || e.id || e.name || ((e.closest('[id]') || {}).id || '?') + '>' + e.tagName.toLowerCase();
    if (need > avail + 0.5 || e.scrollWidth > e.clientWidth + 1) bad.push(`${key} "${txt.slice(0, 40)}" needs ${need.toFixed(0)} px, has ${avail.toFixed(0)} px`);
  });
  return { bad, n };
};
const runTabs = async (fr, out, outTabs) => {
  const n = (await fr.$$('[role=tab]')).length;
  for (let i = 0; i < n; i++) {
    const t = (await fr.$$('[role=tab]'))[i]; if (!t || !(await t.isVisible())) continue;
    await t.click(); await fr.waitForTimeout(150);
    const r = await fr.evaluate(AUDIT); out.n += r.n; r.bad.forEach(x => out.bad.add(x));
  }
  if (outTabs) for (const id of await fr.evaluate(() => TABS().map(t => t[0]))) {
    await fr.evaluate(id => { S.ui.tab = id; refresh(); }, id); await fr.waitForTimeout(100);
    const r = await fr.evaluate(AUDIT); out.n += r.n; r.bad.forEach(x => out.bad.add(x));
  }
};
for (const vw of WIDTHS) {
  console.log('--- viewport ' + vw + ' px');
  const { b, p, errs } = await openPage(FILE, { hash: '#capacity', vw, vh: 900 });
  const f = await (await p.$('#suite-frame-capacity')).contentFrame();
  await f.waitForFunction(() => typeof computeAll === 'function' && typeof CC !== 'undefined' && CC, null, { timeout: 30000 });
  for (const mode of ['beam', 'slab']) {
    if (mode === 'slab') await f.evaluate(() => { const s = document.querySelector('[data-fkey="memberType"]'); s.value = 'slab'; s.dispatchEvent(new Event('change')); });
    // the widest values the layer-table selects hold: a two-digit bar and the longer face label
    await f.evaluate(() => { S.layers[0].size = '11'; S.layers[1].face = 'compression'; S.layers[1].size = '10'; if (S.memberType === 'slab') { S.slab.stSize = '11'; S.slab.stS = 12; } refresh(); });
    const out = { bad: new Set(), n: 0 }; await runTabs(f, out, true);
    if (SHOTS) {
      await f.evaluate(() => { const t = [...document.querySelectorAll('#rcbInTabs [role=tab]')].find(x => /Reinforcement/.test(x.textContent)); t && t.click(); });
      await p.waitForTimeout(200);
      const lt = await f.$('table.lyrT'); if (lt) { await lt.scrollIntoViewIfNeeded(); await lt.screenshot({ path: path.join(SHOTS, `cbc-${mode}-layers-${vw}.png`) }); }
      await p.screenshot({ path: path.join(SHOTS, `cbc-${mode}-${vw}.png`) });
    }
    ok(!out.bad.size, `Beam Capacity (${mode}): ${out.n} field views measured, none cut off` + (out.bad.size ? ':\n     ' + [...out.bad].join('\n     ') : ''));
  }
  for (const [app, fr, name] of [['asd', '#suite-frame-asd', 'ASD Beam Calcs'], ['dev', '#suite-frame-dev', 'Development & Splice']]) {
    await p.click(`.suite-tab[data-target="${app}"]`); await p.waitForTimeout(1500);
    const g = await (await p.$(fr)).contentFrame();
    const out = { bad: new Set(), n: 0 }; await runTabs(g, out, false);
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `${app}-${vw}.png`) });
    ok(out.n > 0 && !out.bad.size, `${name}: ${out.n} field views measured, none cut off` + (out.bad.size ? ':\n     ' + [...out.bad].join('\n     ') : ''));
  }
  ok(!errs.length, '0 console errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
}
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
