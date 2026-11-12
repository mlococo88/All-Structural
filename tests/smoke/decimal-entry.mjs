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
const IXERR = /^\[BABEL\] Note: The code generator has deoptimised|^Error: <\w+> attribute (width|height): A negative value/;
// index.html: change the stored cfg (mct_cfg_v3) and reload the page
async function ixReload(F, fn) {
  await F.evaluate(fs => { const c = JSON.parse(localStorage.getItem('mct_cfg_v3') || '{}'); (0, eval)('(' + fs + ')')(c);
    localStorage.setItem('mct_cfg_v3', JSON.stringify(c)); location.reload(); }, fn.toString()).catch(() => {});
  await F.waitForFunction(() => typeof generateMCT === 'function' && document.querySelector('#root nav button'), null, { timeout: 180000 }); await F.waitForTimeout(3000);
}
const IXSUB = ['AASHTO Rating', 'Summary', 'Multi-Vehicle', 'Demand vs. Cap', 'Service II', 'Fatigue', 'PS Strength I', 'PS Service III', 'Report Card', 'Inputs & Setup'];
// file; hash (opened as file#hash); frame (a same-origin iframe holding the inputs); tabs (buttons that switch views); wait (ms after load)
const TOOLS = {
  cbc: { file: 'Concrete Beam Capacity.html', frame: '#suite-frame-capacity', tabs: '.rcbInTab, [role=tab]', wait: 5000 },
  // cbc2: the Beam Capacity tab again as a T-section in AASHTO mode with a manual layer depth (the fields the default hides), plus the
  // behaviour checks in cbcChecks (committed values, rounding and clamping shown on leaving the field, number-pad ".")
  cbc2: { file: 'Concrete Beam Capacity.html', frame: '#suite-frame-capacity', tabs: '.rcbInTab, [role=tab]', wait: 5000,
    init: F => F.evaluate(() => { S.sec.type = 'tee'; S.code = 'AASHTO'; S.layers[0].dMan = 15.5; refresh(); }), checks: 'cbcChecks' },
  cbasd: { file: 'Concrete Beam Capacity.html', hash: '#asd', frame: '#suite-frame-asd', tabs: '[role=tab]', wait: 5000 },
  cbdev: { file: 'Concrete Beam Capacity.html', hash: '#dev', frame: '#suite-frame-dev', tabs: '[role=tab], .tab-btn, .itab, .tab, [data-tab]', wait: 5000 },
  // index: knownErr (IXTYP, 2026-11-12): Babel's note that the page's script is over 500 KB (logged as an error at every load), and the
  // SVG errors of the bridge drawing while a span holds a negative length the sweep types (-1.5); the same on origin/main. Counted, not failed.
  index: { file: 'index.html', tabs: '#root>div>header+div>nav>button', wait: 8000, checks: 'ixChecks', knownErr: IXERR },
  // index.html with MIDAS results seeded as tests/smoke/index-report.mjs does (IXTYP, 2026-11-12): the Results, AASHTO Rating and AREMA
  // Rating steps show most of their inputs only with results. Every step, then every AASHTO Rating sub-tab (sub), with the collapsed
  // panels (a button ending in ▼) opened (expand). seed: the index-report.mjs case (base: manual zone; lfr: quick-calc zone, LFR; arema).
  ixbase: { file: 'index.html', seed: 'base', tabs: '#root>div>header+div>nav>button', wait: 300, sub: IXSUB, expand: true, knownErr: IXERR },
  ixlfr: { file: 'index.html', seed: 'lfr', tabs: '#root>div>header+div>nav>button', wait: 300, sub: IXSUB, expand: true, knownErr: IXERR, checks: 'ixRatingChecks' },
  // ixgfs / ixps: the default page switched to the girder-floorbeam-stringer geometry (geomMode gfs), or to a prestressed member (ps.enabled)
  ixgfs: { file: 'index.html', tabs: '#root>div>header+div>nav>button', wait: 8000, expand: true, knownErr: IXERR, init: F => ixReload(F, c => { c.geomMode = 'gfs'; }) },
  ixps: { file: 'index.html', tabs: '#root>div>header+div>nav>button', wait: 8000, expand: true, knownErr: IXERR, init: F => ixReload(F, c => { c.ps = { ...(c.ps || {}), enabled: true }; }) },
  ixarema: { file: 'index.html', seed: 'arema', tabs: '#root>div>header+div>nav>button', wait: 300, sub: IXSUB, expand: true, knownErr: IXERR },
  lldf: { file: 'lldf.html', tabs: TABS, wait: 5000 },
  pbd: { file: 'Prestressed Bridge Design.html', tabs: TABS, wait: 6000 },
  sf: { file: 'Spread Footing.html', tabs: '#sfdInTabs .sfdInTab, #tabbar button', wait: 3000 },
  // pile: knownErr (DECE, 2026-11-11): the test kit has no copy of the Tailwind CDN script (blocked: ERR_FAILED), and the tool's SVG
  // drawings log attribute errors (NaN, negative radius) while a field holds a value the sweep types that the drawing cannot use (a lone
  // "-", OD -1.5, wall 9.6 in); the same on origin/main. Counted and listed, not failed.
  pile: { file: 'Pile Designer.html', tabs: TABS, wait: 4000, checks: 'pileChecks', knownErr: /net::ERR_FAILED|^Error: <\w+> attribute / },
  rwall: { file: 'Retaining Wall Designer.html', tabs: '.itab[data-pane], .tab-bar .tab-btn', wait: 4000 },
  abut: { file: 'abutment_calculator.html', tabs: TABS, wait: 5000 },
  bsl: { file: 'Bridge Substructure Loading.html', tabs: '.itab[data-pane], #tab-bar .tab-btn', wait: 4000 },
  sbeam: { file: 'Steel Beam Design - AISC 15th.html', tabs: '#sbdInTabs .sbdInTab, #tabBar button', wait: 4000 },
  timber: { file: 'Timber Beam Check.html', tabs: TABS, wait: 3000 },
  gusset: { file: 'Gusset Plate Rating.html', tabs: '.itab[data-pane], #tab-bar .tab-btn', wait: 4000 },
  secprop: { file: 'Section Property Calculator.html', tabs: TABS, wait: 4000 },
  smd: { file: 'Shear and Moment Diagrams.html', tabs: '#smdViewTabs button', wait: 3000 },
  // arch (DECE, 2026-11-11): the tool re-runs the whole analysis on every keystroke (about 2.5 s a key headless), so the sweep takes
  // about 20 minutes; it is slow, not stuck. The list-input tables under the paste boxes (depth overrides, SDL line items) have
  // no id: their cells are found by data-dece and an empty row is put back empty. knownErr: the arch drawing logs SVG transform
  // errors (NaN) while a field holds a value the sweep types that it cannot draw (same on origin/main); counted, not failed.
  arch: { file: 'Stone Masonry Arch Load Rating.html', tabs: '[id^=inTab_], #tabs [data-tab]', wait: 6000, knownErr: /^Error: <\w+> attribute / },
  lp: { file: 'Light Pole and Sign Post.html', tabs: '#lppInTabs .lppInTab, #tabBar button', wait: 3000 },
  bpad: { file: 'BasePlateAnchorDesigner.html', tabs: '[role=tab], .tab-btn, .itab, .tab, [data-tab], .otab', wait: 5000 },
  asce7: { file: 'ASCE7-16 Load Generator.html', tabs: '#tabs .tab', wait: 3000 },
  mlg: { file: 'Moving Load Generator.html', tabs: '#mlgInTabs button, #mlgOutTabs button', wait: 4000, checks: 'mlgChecks' },
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
    const ord = [...document.querySelectorAll('input')].indexOf(e);   // a field rebuilt without an id is found again by its place
    const lab = (e.labels && e.labels[0] && e.labels[0].textContent) || e.getAttribute('aria-label') || e.title ||
      (e.closest('.fRow, tr, label, .row, .field') || e.parentElement).textContent || '';
    out.push({ n, sig, ord, type: e.type, lab: lab.trim().replace(/\s+/g, ' ').slice(0, 50) });
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
    const orig = await F.evaluate(([sel, n, ord]) => { const e = document.querySelector(`[data-dece="${n}"]`) || (sel.startsWith('[data-dece') ? document.querySelectorAll('input')[ord] : document.querySelector(sel));
      if (!e || !e.isConnected || !e.getClientRects().length) return null; e.focus(); try { e.select(); } catch (x) {} return e.value; }, [sel, fld.n, fld.ord]);
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

// index.html (IXTYP, 2026-11-12): type each string key by key into the number field labelled lab on the step (and sub-tab), check the text
// shown while typing, then the stored cfg (mct_cfg_v3) and the field's text on leaving it; the field's first text is put back at the end.
// rows: [step, label, [[typed, stored-test(cfg), shown on leaving, note]…], sub-tab]
const imOf = c => ((c.rating && c.rating.llFactors) || []).find(f => f.id === 'im').value;
async function ixTyping(p, F, rows) {
  const out = [], chk = (c, m) => { if (!c) out.push(m); console.log(`   ${c ? 'ok  ' : 'FAIL'} ${m}`); };
  const cfg = () => F.evaluate(() => JSON.parse(localStorage.getItem('mct_cfg_v3') || '{}'));
  const leave = () => F.evaluate(() => document.activeElement.blur()).then(() => p.waitForTimeout(150));
  for (const [stepName, lab, cases, sub] of rows) {
    await F.evaluate(n => { const b = [...document.querySelectorAll('#root>div>header+div>nav>button')].find(x => x.textContent.replace(/\s+/g, ' ').trim().endsWith(n)); if (b) b.click(); }, stepName);
    await p.waitForTimeout(700);
    if (sub) { await F.evaluate(l => { const b = [...document.querySelectorAll('#root button')].find(x => x.offsetParent && !x.closest('nav') && x.textContent.replace(/\s+/g, ' ').trim().endsWith(l)); if (b) b.click(); }, sub); await p.waitForTimeout(700); }
    await F.evaluate(() => { for (const x of document.querySelectorAll('#root button')) if (x.offsetParent && /▼\s*$/.test(x.textContent)) x.click(); }); await p.waitForTimeout(300);
    const found = await F.evaluate(l => { document.querySelectorAll('[data-ixtyp]').forEach(e => e.removeAttribute('data-ixtyp'));
      const own = e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').replace(/\s+/g, ' ').trim();
      for (const e of document.querySelectorAll('#root label, #root div, #root span')) {
        if (!e.offsetParent || !(own(e) === l || own(e).startsWith(l + ' ') || own(e).startsWith(l + 'ft'))) continue;
        for (let a = e; a && a.id !== 'root'; a = a.parentElement) { const i = a.querySelector('input[type=number]:not([disabled])'); if (i && i.offsetParent) { i.setAttribute('data-ixtyp', '1'); return i.value; } }
      }
      return null; }, lab);
    if (found === null) { chk(false, `${stepName}: field "${lab}" found`); continue; }
    for (const [s, ok, shown, note] of cases) {
      await F.evaluate(() => { const e = document.querySelector('[data-ixtyp]'); e.scrollIntoView({ block: 'center' }); e.focus(); e.select(); });
      await p.keyboard.press('Control+A'); for (const ch of s) await p.keyboard.type(ch); await p.waitForTimeout(80);
      const r = await F.evaluate(() => ({ v: document.activeElement.value, k: document.activeElement.hasAttribute('data-ixtyp') }));
      chk(r.k && r.v === (s === '-' ? '' : s), `${lab} typed "${s}": field "${r.v}" while typing`);
      await leave(); const c = await cfg(), v = await F.evaluate(() => document.querySelector('[data-ixtyp]').value);
      chk(ok(c) && (v === shown || (v !== '' && +v === +shown)), `${lab} "${s}": ${note || 'stored ' + shown}; field "${v}" on leaving it`);
    }
    await F.evaluate(() => { const e = document.querySelector('[data-ixtyp]'); e.focus(); e.select(); });
    await p.keyboard.press('Control+A'); for (const ch of found) await p.keyboard.type(ch); await leave();
  }
  return out;
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
  // index.html Moving Loads step (IXDLA, 2026-11-12): the Global DLA (%) and per-vehicle DLA (%) fields take a decimal (parseInt
  // truncated 12.5 to 12, and "33." was stored as 0 and shown as "0" while typing), what is stored (mct_cfg_v3) and the MCT
  // *MVLDCASE SCALE written from it; min 0 / max 100 are the input's attributes only (no clamp, as before).
  async ixChecks(p, F) {
    const out = [], chk = (c, m) => { if (!c) out.push(m); console.log(`   ${c ? 'ok  ' : 'FAIL'} ${m}`); };
    await F.$$eval('#root>div>header+div>nav>button', e => { const x = e.find(b => /Moving Loads/.test(b.textContent)); if (x) x.click(); });
    await p.waitForTimeout(600);
    const cfg = () => F.evaluate(() => JSON.parse(localStorage.getItem('mct_cfg_v3') || '{}'));
    const setGlobal = on => F.evaluate(on => { const t = [...document.querySelectorAll('span')].find(s => s.textContent === 'Override all with global value');
      const c = JSON.parse(localStorage.getItem('mct_cfg_v3') || '{}'); if (t && !!c.useGlobalDLA !== on) t.parentElement.click(); }, on).then(() => p.waitForTimeout(300));
    const tag = () => F.evaluate(() => { document.querySelectorAll('[data-ixdla]').forEach(e => e.removeAttribute('data-ixdla'));
      const lab = [...document.querySelectorAll('label')].find(l => l.textContent === 'Global DLA (%)');
      if (lab) lab.parentElement.querySelector('input').setAttribute('data-ixdla', 'g');
      const v = [...document.querySelectorAll('div')].find(d => d.textContent === 'HL-93TRK' && d.previousElementSibling);
      const row = v && v.parentElement.parentElement; const i = row && row.querySelector('input[type=number]'); if (i) i.setAttribute('data-ixdla', 'v'); });
    const typeIn = async (k, s) => { await tag(); await F.evaluate(k => { const e = document.querySelector(`[data-ixdla="${k}"]`); e.scrollIntoView({ block: 'center' }); e.focus(); e.select(); }, k);
      await p.keyboard.press('Control+A'); for (const ch of s) await p.keyboard.type(ch); await p.waitForTimeout(80);
      return F.evaluate(() => ({ v: document.activeElement.value, k: document.activeElement.getAttribute('data-ixdla') })); };
    const leave = () => F.evaluate(() => document.activeElement.blur()).then(() => p.waitForTimeout(150));
    const shown = k => F.evaluate(k => document.querySelector(`[data-ixdla="${k}"]`).value, k);
    const scale = () => F.evaluate(() => { const c = JSON.parse(localStorage.getItem('mct_cfg_v3')); c.selectedVehicles = ['HL-93TRK'];
      const l = generateMCT(c).split('\n').find(x => /^\s*VL, HL-93TRK,/.test(x)); return l ? l.split(',')[2].trim() : null; });
    const c0 = await cfg();
    await setGlobal(true);
    let r = await typeIn('g', '33.3'); chk(r.k === 'g' && r.v === '33.3', `Global DLA typed "33.3" key by key: field "${r.v}" (main: "33", the point dropped)`);
    chk((await cfg()).globalDLA === 33.3, `Global DLA "33.3": stored ${(await cfg()).globalDLA} (main: 33)`);
    await leave(); chk(await shown('g') === '33.3', 'Global DLA "33.3" left: field "33.3"');
    chk(await scale() === '1.333', `Global DLA 33.3: MCT SCALE ${await scale()} = 1 + 33.3/100`);
    r = await typeIn('g', '12.5'); await leave(); chk((await cfg()).globalDLA === 12.5, `Global DLA "12.5": stored ${(await cfg()).globalDLA} (before: 12)`);
    r = await typeIn('g', '33'); await leave(); chk((await cfg()).globalDLA === 33 && await scale() === '1.33', 'Global DLA "33": stored 33, SCALE 1.33 (as before)');
    r = await typeIn('g', '-'); chk(r.v === '' && (await cfg()).globalDLA === 0, `Global DLA "-" alone: not overwritten while typing, stored 0 (as before)`);
    await leave(); chk(await shown('g') === '0', 'Global DLA "-" left: the field shows the stored 0 (as before)');
    r = await typeIn('g', '150'); await leave(); chk((await cfg()).globalDLA === 150, 'Global DLA "150": stored 150, not clamped (max 100 is the spinner limit only, as before)');
    await setGlobal(false);
    r = await typeIn('v', '12.5'); chk(r.k === 'v' && r.v === '12.5', `HL-93TRK DLA typed "12.5": field "${r.v}"`);
    await leave(); chk((await cfg()).vehicleDLA['HL-93TRK'] === 12.5 && await shown('v') === '12.5', `HL-93TRK DLA "12.5": stored ${(await cfg()).vehicleDLA['HL-93TRK']} (before: 12)`);
    chk(await scale() === '1.125', `HL-93TRK DLA 12.5: MCT SCALE ${await scale()} (main: 1.12)`);
    await F.evaluate(c0 => { localStorage.setItem('mct_cfg_v3', JSON.stringify(c0)); }, c0);   // the sweep runs on the page as it is; the stored cfg is put back
    r = await typeIn('v', String(c0.vehicleDLA && c0.vehicleDLA['HL-93TRK'] != null ? c0.vehicleDLA['HL-93TRK'] : 33)); await leave();
    await setGlobal(!!c0.useGlobalDLA);
    await typeIn('g', String(c0.globalDLA ?? 0)).catch(() => {}); await leave();
    // IXTYP (2026-11-12): the other number fields keep a typed minus sign, a leading "." or "0." and a count typed digit by digit;
    // the stored value is the field's own parse as before (parseFloat / parseInt, fallbacks and clamps unchanged)
    out.push(...await ixTyping(p, F, [
      ['Moving Loads', 'Lane Width (ft)', [['-1.5', c => c.laneWidth === -1.5, '-1.5'], ['.5', c => c.laneWidth === 0.5, '0.5'], ['11.5', c => c.laneWidth === 11.5, '11.5'],
        ['-', c => c.laneWidth === 10, '10', 'stored 10, the fallback (as before)']]],
      ['Moving Loads', 'Wheel Spacing (ft)', [['0.5', c => c.laneWheelSpacing === 0.5, '0.5'], ['-', c => c.laneWheelSpacing === 6, '6', 'stored 6, the fallback (as before)']]],
      ['Geometry', 'Elements per Span', [['12', c => c.elemsPerSpan === 12, '12', 'stored 12 (main: "1" was clamped to 2 while typing, so "12" became 22)'],
        ['9.6', c => c.elemsPerSpan === 9, '9', 'stored 9 (parseInt, a count; as before)']]],
      ['Geometry', 'Span 1', [['-1.5', c => c.spans[0] === -1.5, '-1.5'], ['.25', c => c.spans[0] === 0.25, '0.25']]],
    ]));
    return out;
  },
  // index.html AASHTO Rating step with MIDAS results seeded (IXTYP, 2026-11-12; case lfr): the Live Load Scale Factors rows (the
  // Dynamic Load Allowance IM row) and φ_f keep a decimal, a leading "." or "0." and a minus sign while typing; stored as before
  async ixRatingChecks(p, F) {
    return ixTyping(p, F, [
      ['AASHTO Rating', 'Dynamic Load Allowance', [['33.3', c => imOf(c) === 33.3, '33.3'], ['.5', c => imOf(c) === 0.5, '0.5'],
        ['-', c => imOf(c) === 0, '0', 'stored 0 (as before)']], 'Inputs & Setup'],
      ['AASHTO Rating', 'φ_f — Flexure', [['0.95', c => c.rating.phiF === 0.95, '0.95', 'stored 0.95 (main: "0" stored the fallback 1 and wrote "1", so "0.95" became 1.95)'],
        ['-', c => c.rating.phiF === 1, '1', 'stored 1, the fallback (as before)']], 'Inputs & Setup'],
    ]);
  },
  // Pile Designer (DECE, 2026-11-11): a load-case moment (negative valid) and a "-" alone, committed values read from the rendered
  // inputs (PDPL_I)
  async pileChecks(p, F) {
    const out = [], chk = (c, m) => { if (!c) out.push(m); console.log(`   ${c ? 'ok  ' : 'FAIL'} ${m}`); };
    const lab = 'Case 1 head moment, kip-ft';
    const find = async () => { for (let t = 0; t < 30; t++) { if (await F.evaluate(l => { const e = document.querySelector(`input[aria-label="${l}"]`); return !!(e && e.getClientRects().length); }, lab)) return true;
      if (!await F.$$eval(TABS, (e, t) => { const x = e[t]; if (!x || x.offsetParent === null) return true; x.click(); return true; }, t)) return false; await p.waitForTimeout(400); } return false; };
    if (!await find()) { chk(false, `field "${lab}" found`); return out; }
    const typeIn = async s => { await F.evaluate(l => { const e = document.querySelector(`input[aria-label="${l}"]`); e.scrollIntoView({ block: 'center' }); e.focus(); e.select(); }, lab);
      await p.keyboard.press('Control+A'); for (const ch of s) await p.keyboard.type(ch); await p.waitForTimeout(60); };
    const st = () => F.evaluate(l => ({ v: document.querySelector(`input[aria-label="${l}"]`).value, a: document.activeElement.getAttribute('aria-label'), M: PDPL_I.loadCases ? PDPL_I.loadCases[0].Mhead : (PDPL_I.cases || [])[0] && PDPL_I.cases[0].Mhead }), lab);
    const leave = () => F.evaluate(() => document.activeElement.blur()).then(() => p.waitForTimeout(150));
    const orig = (await st()).v;
    await typeIn('-1.5'); let r = await st(); chk(r.a === lab && r.v === '-1.5' && r.M === -1.5, `${lab} "-1.5": field "${r.v}", committed ${r.M} (before: "1.5", 1.5)`);
    await leave(); r = await st(); chk(r.v === '-1.5' && r.M === -1.5, `${lab} "-1.5" left: field "${r.v}", committed ${r.M}`);
    await typeIn('-'); r = await st(); chk(r.a === lab && r.v === '' && r.M === 0, `${lab} "-" alone: not overwritten while typing (field reads "${r.v}"), committed ${r.M} (0, as before)`);
    await leave(); r = await st(); chk(r.v === '0' && r.M === 0, `${lab} "-" left: the field shows the committed 0 (as before)`);
    await typeIn(orig); await leave();
    return out;
  },
  // Moving Load Generator (DECE, 2026-11-11): the headway (shown only for the two-vehicle step case), a lone "-" in the variable
  // spacing and headway (the minimum is used while typing and put back on leaving the field), and the highway deflection DF and
  // limit typed while a rail vehicle is selected (the rail DF and limit are used then)
  async mlgChecks(p, F) {
    const out = [], chk = (c, m) => { if (!c) out.push(m); console.log(`   ${c ? 'ok  ' : 'FAIL'} ${m}`); };
    const typeIn = async (id, s) => { await F.evaluate(id => { const e = document.getElementById(id); e.scrollIntoView(); e.focus(); e.select(); }, id);
      await p.keyboard.press('Control+A'); for (const ch of s) await p.keyboard.type(ch); await p.waitForTimeout(60);
      return F.evaluate(() => document.activeElement.value); };
    const leave = () => F.evaluate(() => document.activeElement.blur()).then(() => p.waitForTimeout(100));
    await F.evaluate(() => { $('sCase').value = 'm'; $('sCase').dispatchEvent(new Event('input', { bubbles: true })); });
    chk(await typeIn('sH', '-1.5') === '-1.5', 'Headway "-1.5": the typed text stays while typing'); await leave();
    await typeIn('sH', '-');   // a lone "-" reads as an empty field; before, the minimum was written into it while typing
    chk(await F.evaluate(() => { const e = document.activeElement, a = JSON.stringify(stepCfg()); if (e.id !== 'sH' || e.value !== '') return false;
      e.value = RES.m.mHmin; const b = JSON.stringify(stepCfg()); e.value = ''; return a === b; }), 'Headway "-" alone: not overwritten while typing; the step uses the minimum headway (as before)');
    const hMin = await F.evaluate(() => RES.m.mHmin);
    await leave(); chk(await F.evaluate(() => $('sH').value) === String(hMin), `Headway "-" left: the minimum ${hMin} is put back (as before)`);
    await F.evaluate(() => { $('sCase').value = 'p'; $('sCase').dispatchEvent(new Event('input', { bubbles: true })); });
    await typeIn('sSp', '-'); const used = await F.evaluate(() => { const e = document.activeElement, a = JSON.stringify(stepCfg()); if (e.id !== 'sSp' || e.value !== '') return false;
      e.value = RES.m.vMin; const b = JSON.stringify(stepCfg()); return a === b; });
    chk(used, 'Var. spacing "-" alone: the step uses the minimum spacing (as before)'); await leave();
    await F.evaluate(() => { $('preset').value = 'E80'; $('preset').dispatchEvent(new Event('change', { bubbles: true })); run(); });
    await p.waitForTimeout(1500);
    chk(await F.evaluate(() => !!(RES && RES.m.rail)), 'rail vehicle (E80) selected');
    chk(await typeIn('dDF', '9.6') === '9.6', 'Deflection DF "9.6" with a rail vehicle: the typed text stays'); await leave();
    chk(await typeIn('dLim', '-5') === '-5', 'Limit L/ "-5" with a rail vehicle: the typed text stays'); await leave();
    return out;
  },
};

for (const key of keys) {
  const T = TOOLS[key]; if (!T) { console.log(`unknown tool ${key}`); failures++; continue; }
  const src = resolveFile(args.file && new Set(keys.map(k => TOOLS[k] && TOOLS[k].file)).size === 1 ? args.file : T.file, T.file);
  const { b, p, errs } = T.seed ? await (await import('./index-report.mjs')).open(src.file, T.seed) : await openPage(src.file, { vw: 1400, vh: 1000, hash: T.hash || '' });
  let tested = 0; const bad = [];
  try {
    await p.waitForTimeout(T.wait || 3000);
    const F = T.frame ? await (await p.$(T.frame)).contentFrame() : p;
    if (T.init) { await T.init(F); await p.waitForTimeout(800); }
    if (T.checks) bad.push(...(await CHECKS[T.checks](p, F)).map(m => 'check: ' + m));
    const sweep = async view => {
      if (T.expand) { await F.evaluate(() => { for (const x of document.querySelectorAll('#root button')) if (x.offsetParent && /▼\s*$/.test(x.textContent)) x.click(); }); await p.waitForTimeout(400); }
      const flds = (await collect(F)).slice(0, MAX);
      for (const fld of flds) {
        const t0 = Date.now(), r = await testField(p, F, fld); tested++;
        if (args.list) console.log(`   ${r.length ? 'BAD' : 'ok '} ${fld.sig || '#' + fld.n} [${fld.type}] ${view ? view + ': ' : ''}${fld.lab}${r.length ? '  ' + r.join('; ') : ''}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
        if (r.length) bad.push(`${fld.sig || '#' + fld.n} (${view ? view + ': ' : ''}${fld.lab}): ${r.join('; ')}`);
      }
    };
    const nt = T.tabs ? await F.$$eval(T.tabs, e => e.length) : 0;
    for (let t = -1; t < nt; t++) {
      let view = '';
      if (t >= 0) { const shown = await F.$$eval(T.tabs, (e, t) => { const x = e[t]; if (!x || x.offsetParent === null) return false; x.click(); return x.textContent.replace(/\s+/g, ' ').trim() || '(tab ' + t + ')'; }, t);
        if (!shown) continue; view = T.seed ? shown : ''; await p.waitForTimeout(700); }
      await sweep(view);
      // sub-tabs shown on this view (index: the AASHTO Rating sub-tabs)
      if (T.sub && view.endsWith(T.sub[0])) for (const lab of T.sub.slice(1)) {
        const hit = await F.evaluate(l => { const x = [...document.querySelectorAll('#root main button, #root button')].find(b => b.offsetParent && b.textContent.replace(/\s+/g, ' ').trim().endsWith(l) && !b.closest('nav'));
          if (!x) return false; x.click(); return true; }, lab);
        if (hit) { await p.waitForTimeout(700); await sweep(view + ' / ' + lab); }
      }
    }
  } catch (e) { bad.push('error: ' + e.message.split('\n')[0]); }
  finally { await b.close(); }
  const known = T.knownErr ? errs.filter(x => T.knownErr.test(x)) : [];
  if (known.length) { const u = [...new Set(known.map(x => x.replace(/"[^"]*"/g, '"…"').replace(/\(".*?"\)/g, '')))]; console.log(`     ${known.length} known console errors not counted (${u.length} kinds): ${u.slice(0, 6).join(' | ')}`); }
  errs.splice(0, errs.length, ...errs.filter(x => !known.includes(x)));
  failures += bad.length + (errs.length ? 1 : 0);
  const kind = re => bad.filter(x => re.test(x.split('): ').slice(1).join('): '))).length;   // which typed string a field failed on first
  console.log(`${bad.length || errs.length ? 'FAIL' : 'ok  '} ${key} (${src.label}): ${tested} numeric fields, ${bad.length} lose a keystroke or the focus` +
    (bad.length ? ` (on a decimal: ${kind(/^(np)?(9\.6|0\.75) -> /)}, on the minus sign: ${kind(/^-1\.5 -> /)}, field gone / focus lost: ${kind(/gone|focus lost/)})` : '') + `${errs.length ? `, ${errs.length} console errors: ${errs.slice(0, 3).join(' | ')}` : ''}`);
  for (const x of bad.slice(0, 60)) console.log('     ' + x);
  if (bad.length > 60) console.log(`     … ${bad.length - 60} more`);
}
console.log(failures ? `${failures} failure(s)` : 'all passed');
process.exit(failures ? 1 : 0);
