#!/usr/bin/env node
// Decimal entry smoke test (DECE, 2026-11-11): every visible numeric input of a tool takes "9.6", "0.75" and "-1.5" typed key by key
// (and "9.6" with the number-pad "." key, NumpadDecimal), keeps the focus, and shows exactly what was typed: no keystroke is lost to a
// re-render of the field while typing (engineer report 2026-11-11: "9.6" became "96" in Concrete Beam Capacity).
// Each field: focus, select all (no input event), type the string one key at a time, read the focused field's text after the last key,
// then put the field's original text back (input + change events) and leave it (blur).
// The tool's tab buttons (tabs) are clicked in turn and the newly visible inputs swept after each; collapsed cards
// (.sec.collapsed > .secHead, details > summary) are opened first. Inputs: type=number, inputmode decimal/numeric, and type=text
// whose current text is a number. Disabled and read-only inputs are skipped.
//   node tests/smoke/decimal-entry.mjs [--tool <key>[,<key>…]] [--file <file>] [--max <n per view>] [--strings 9.6,0.75,-1.5] [--list]
//   keys: see TOOLS below (default: cbc,cbc2,cbasd,cbdev, the Concrete Beam Capacity suite). --file: another copy (one tool file only).
//   --list: print every field tested. Exit code 1 on any field that loses a keystroke or the focus, or on console errors.
import { openPage, resolveFile } from '../lib.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) { if (!av[i].startsWith('--')) continue; const k = av[i].slice(2); args[k] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true; }

const TABS = '[role=tab], .tab-btn, .itab[data-pane], .tab, [data-tab], .tabbtn';
// file; hash (opened as file#hash); frame (a same-origin iframe holding the inputs); tabs (buttons that switch views); wait (ms after load)
const TOOLS = {
  cbc: { file: 'Concrete Beam Capacity.html', frame: '#suite-frame-capacity', tabs: '.rcbInTab, [role=tab]', wait: 5000 },
  // cbc2: the Beam Capacity tab again as a T-section in AASHTO mode with a manual layer depth (the fields the default hides), plus the
  // behaviour checks in cbcChecks (committed values, rounding and clamping shown on leaving the field, number-pad ".")
  cbc2: { file: 'Concrete Beam Capacity.html', frame: '#suite-frame-capacity', tabs: '.rcbInTab, [role=tab]', wait: 5000,
    init: F => F.evaluate(() => { S.sec.type = 'tee'; S.code = 'AASHTO'; S.layers[0].dMan = 15.5; refresh(); }), checks: 'cbcChecks' },
  cbasd: { file: 'Concrete Beam Capacity.html', hash: '#asd', frame: '#suite-frame-asd', tabs: '[role=tab]', wait: 5000 },
  cbdev: { file: 'Concrete Beam Capacity.html', hash: '#dev', frame: '#suite-frame-dev', tabs: '[role=tab], .tab-btn, .itab, .tab, [data-tab]', wait: 5000 },
  index: { file: 'index.html', tabs: '#root>div>header+div>nav>button', wait: 8000 },
  lldf: { file: 'lldf.html', tabs: TABS, wait: 5000 },
  pbd: { file: 'Prestressed Bridge Design.html', tabs: TABS, wait: 6000 },
  sf: { file: 'Spread Footing.html', tabs: '#sfdInTabs .sfdInTab, #tabbar button', wait: 3000 },
  pile: { file: 'Pile Designer.html', tabs: TABS, wait: 4000 },
  rwall: { file: 'Retaining Wall Designer.html', tabs: '.itab[data-pane], .tab-bar .tab-btn', wait: 4000 },
  abut: { file: 'abutment_calculator.html', tabs: TABS, wait: 5000 },
  bsl: { file: 'Bridge Substructure Loading.html', tabs: '.itab[data-pane], #tab-bar .tab-btn', wait: 4000 },
  sbeam: { file: 'Steel Beam Design - AISC 15th.html', tabs: '#sbdInTabs .sbdInTab, #tabBar button', wait: 4000 },
  timber: { file: 'Timber Beam Check.html', tabs: TABS, wait: 3000 },
  gusset: { file: 'Gusset Plate Rating.html', tabs: '.itab[data-pane], #tab-bar .tab-btn', wait: 4000 },
  secprop: { file: 'Section Property Calculator.html', tabs: TABS, wait: 4000 },
  smd: { file: 'Shear and Moment Diagrams.html', tabs: '#smdViewTabs button', wait: 3000 },
  arch: { file: 'Stone Masonry Arch Load Rating.html', tabs: '[id^=inTab_], #tabs [data-tab]', wait: 6000 },
  lp: { file: 'Light Pole and Sign Post.html', tabs: '#lppInTabs .lppInTab, #tabBar button', wait: 3000 },
  bpad: { file: 'BasePlateAnchorDesigner.html', tabs: '[role=tab], .tab-btn, .itab, .tab, [data-tab], .otab', wait: 5000 },
  asce7: { file: 'ASCE7-16 Load Generator.html', tabs: '#tabs .tab', wait: 3000 },
  mlg: { file: 'Moving Load Generator.html', tabs: '#mlgInTabs button, #mlgOutTabs button', wait: 4000 },
  bgeo: { file: 'Bridge Geometry.html', tabs: '.tabbtn[data-tab]', wait: 3000 },
  elasto: { file: 'elastomeric_design_module.html', tabs: TABS, wait: 4000 },
  sbapp: { file: 'apps/steel-bridge/index.html', tabs: '#inTabs [data-itab], #tabBar [data-otab]', wait: 3000 },
};

const keys = String(args.tool || 'cbc,cbc2,cbasd,cbdev').split(',');
const STR = String(args.strings || '9.6,0.75,-1.5').split(',');
const MAX = +args.max || 400;
let failures = 0;

// in the frame: tag every visible, editable numeric input not seen yet with data-dece="<n>"; return their ids and labels
const collect = F => F.evaluate(() => {
  for (const h of document.querySelectorAll('.sec.collapsed > .secHead, details:not([open]) > summary')) { try { h.click(); } catch (e) {} }
  const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const num = e => e.type === 'number' || /^(decimal|numeric)$/.test(e.inputMode || '') ||
    ((e.type === 'text' || e.type === '') && /^\s*-?(\d[\d,]*\.?\d*|\.\d+)\s*$/.test(e.value));
  window.__deceN = window.__deceN || 0; const out = [];
  for (const e of document.querySelectorAll('input')) {
    if (e.disabled || e.readOnly || !vis(e) || !num(e)) continue;
    const sig = e.getAttribute('data-fkey') || e.id || e.name || '';
    if (sig && (window.__deceSeen = window.__deceSeen || {})[sig]) continue;
    if (e.hasAttribute('data-dece')) continue;
    if (sig) window.__deceSeen[sig] = 1;
    const n = ++window.__deceN; e.setAttribute('data-dece', String(n));
    const lab = (e.labels && e.labels[0] && e.labels[0].textContent) || e.getAttribute('aria-label') || e.title ||
      (e.closest('.fRow, tr, label, .row, .field') || e.parentElement).textContent || '';
    out.push({ n, sig, type: e.type, lab: lab.trim().replace(/\s+/g, ' ').slice(0, 50) });
  }
  return out;
});

// the number-pad "." as a real keyboard sends it (key ".", code NumpadDecimal, keyCode 110, NumLock on); Playwright's own
// "NumpadDecimal" key is the NumLock-off Delete key and types nothing, so it is sent through the DevTools protocol
async function numpadDot(p) {
  if (!p.__cdp) p.__cdp = await p.context().newCDPSession(p);
  const o = { key: '.', code: 'NumpadDecimal', windowsVirtualKeyCode: 110, nativeVirtualKeyCode: 110, location: 3 };
  await p.__cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...o, text: '.', unmodifiedText: '.' });
  await p.__cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...o });
}

async function testField(p, F, fld) {
  const res = [];
  for (const s0 of [...STR, 'np9.6']) {
    const np = s0.startsWith('np'), s = np ? s0.slice(2) : s0;
    const sel = fld.sig ? `[data-fkey="${fld.sig}"], [id="${fld.sig}"]` : `[data-dece="${fld.n}"]`;
    const orig = await F.evaluate(([sel, n]) => { const e = document.querySelector(`[data-dece="${n}"]`) || document.querySelector(sel);
      if (!e || !e.isConnected || !e.getClientRects().length) return null; e.focus(); try { e.select(); } catch (x) {} return e.value; }, [sel, fld.n]);
    if (orig === null) { res.push(`${s0}: field gone`); break; }
    await p.keyboard.press('Control+A');
    for (const ch of s) { if (np && ch === '.') await numpadDot(p); else await p.keyboard.type(ch); }
    await p.waitForTimeout(30);
    const got = await F.evaluate(() => { const e = document.activeElement; return e && e.tagName === 'INPUT' ? { v: e.value } : null; });
    // put the original text back on the field now focused, then leave it
    await F.evaluate(o => { const e = document.activeElement; if (e && e.tagName === 'INPUT') { e.value = o; e.dispatchEvent(new Event('input', { bubbles: true })); }
      const a = document.activeElement; if (a && a.tagName === 'INPUT') { a.dispatchEvent(new Event('change', { bubbles: true })); a.blur(); } }, orig);
    await p.waitForTimeout(30);
    if (!got) { res.push(`${s0}: focus lost`); break; }
    if (got.v !== s && !(got.v !== '' && +got.v === +s && /^[-\d.]+$/.test(got.v))) { res.push(`${s0} -> "${got.v}"`); break; }
  }
  return res;
}

// Concrete Beam Capacity, Beam Capacity tab (DECE, 2026-11-11): what is committed while typing, and what the field shows on leaving it
const CHECKS = {
  async cbcChecks(p, F) {
    const out = [];
    const typeIn = async (key, s, np) => { await F.evaluate(k => { let e = document.querySelector(`[data-fkey="${k}"]`); const pn = e.closest('.rcbInPane');
      if (pn && !e.getClientRects().length) { document.getElementById(pn.id.replace('rcbInPane_', 'rcbInTab_')).click(); e = document.querySelector(`[data-fkey="${k}"]`); }
      e.scrollIntoView(); e.focus(); e.select(); }, key);
      await p.keyboard.press('Control+A'); for (const ch of s) { if (np && ch === '.') await numpadDot(p); else await p.keyboard.type(ch); } await p.waitForTimeout(30); };
    const leave = () => F.evaluate(() => document.activeElement.blur()).then(() => p.waitForTimeout(60));
    const shown = key => F.evaluate(k => document.querySelector(`[data-fkey="${k}"]`).value, key);
    const chk = (c, m) => { if (!c) out.push(m); console.log(`   ${c ? 'ok  ' : 'FAIL'} ${m}`); };
    for (const [s, np] of [['9.6'], ['9.6', 1], ['-12.25'], ['.5']]) {
      await typeIn('cM0', s, np);
      const r = await F.evaluate(() => ({ Mu: S.combos[0].Mu, v: document.activeElement.value, k: document.activeElement.getAttribute('data-fkey'), Mrow: computeAll().combos[0].Mu }));
      chk(r.k === 'cM0' && r.v === s.replace(/^\./, '0.') || r.v === s, `M_u typed "${s}"${np ? ' (number pad)' : ''}: field "${r.v}", committed ${r.Mu}, used in the results ${r.Mrow}`);
      chk(r.Mu === +s && r.Mrow === +s, `M_u "${s}": committed and computed value ${r.Mu} = ${+s}`);
      await leave();
    }
    await typeIn('cM0', '-'); chk(await F.evaluate(() => S.combos[0].Mu) === 0, 'M_u "-" alone: committed 0 (as before)'); await leave();
    chk(await shown('cM0') === '0', 'M_u "-" left: the field shows the committed 0');
    await typeIn('sl', '12'); chk(await F.evaluate(() => S.stir.legs) === 12 && await shown('sl') === '12', 'Legs "12": 12 (before: "1" was clamped to 2 while typing and "12" became 22)'); await leave();
    await typeIn('ln0', '9.6'); chk(await F.evaluate(() => document.activeElement.value) === '9.6', 'Bars "9.6": the typed text stays while typing');
    await leave(); chk(await shown('ln0') === '10' && await F.evaluate(() => S.layers[0].n) === 10, 'Bars "9.6" left: field and value 10 (rounded, as before)');
    await typeIn('lclr', '0.75'); await leave(); chk(await shown('lclr') === '1' && await F.evaluate(() => S.layerClear) === 1, 'Clear spacing "0.75" left: 1 (minimum 1 in, as before)');
    await typeIn('ld0', '16.25'); chk(await F.evaluate(() => S.layers[0].dMan) === 16.25 && await shown('ld0') === '16.25', 'Manual layer depth "16.25": kept and committed');
    await leave();
    await typeIn('bf', '40.5'); chk(await F.evaluate(() => S.sec.bf) === 40.5 && await shown('bf') === '40.5', 'Flange width "40.5": kept and committed');
    await leave();
    return out;
  },
};

for (const key of keys) {
  const T = TOOLS[key]; if (!T) { console.log(`unknown tool ${key}`); failures++; continue; }
  const src = resolveFile(args.file && new Set(keys.map(k => TOOLS[k] && TOOLS[k].file)).size === 1 ? args.file : T.file, T.file);
  const { b, p, errs } = await openPage(src.file, { vw: 1400, vh: 1000, hash: T.hash || '' });
  let tested = 0; const bad = [];
  try {
    await p.waitForTimeout(T.wait || 3000);
    const F = T.frame ? await (await p.$(T.frame)).contentFrame() : p;
    if (T.init) { await T.init(F); await p.waitForTimeout(800); }
    if (T.checks) bad.push(...(await CHECKS[T.checks](p, F)).map(m => 'check: ' + m));
    const nt = T.tabs ? await F.$$eval(T.tabs, e => e.length) : 0;
    for (let t = -1; t < nt; t++) {
      if (t >= 0) { const shown = await F.$$eval(T.tabs, (e, t) => { const x = e[t]; if (!x || x.offsetParent === null) return false; x.click(); return true; }, t);
        if (!shown) continue; await p.waitForTimeout(700); }
      const flds = (await collect(F)).slice(0, MAX);
      for (const fld of flds) {
        const r = await testField(p, F, fld); tested++;
        if (args.list) console.log(`   ${r.length ? 'BAD' : 'ok '} ${fld.sig || '#' + fld.n} [${fld.type}] ${fld.lab}${r.length ? '  ' + r.join('; ') : ''}`);
        if (r.length) bad.push(`${fld.sig || '#' + fld.n} (${fld.lab}): ${r.join('; ')}`);
      }
    }
  } catch (e) { bad.push('error: ' + e.message.split('\n')[0]); }
  finally { await b.close(); }
  failures += bad.length + (errs.length ? 1 : 0);
  console.log(`${bad.length || errs.length ? 'FAIL' : 'ok  '} ${key} (${src.label}): ${tested} numeric fields, ${bad.length} lose a keystroke or the focus${errs.length ? `, ${errs.length} console errors: ${errs.slice(0, 3).join(' | ')}` : ''}`);
  for (const x of bad.slice(0, 60)) console.log('     ' + x);
  if (bad.length > 60) console.log(`     … ${bad.length - 60} more`);
}
console.log(failures ? `${failures} failure(s)` : 'all passed');
process.exit(failures ? 1 : 0);
