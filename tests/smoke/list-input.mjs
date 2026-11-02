#!/usr/bin/env node
// shared/list-input.js in the browser (LIST, 2026-11-02), and the tools that load it: results unchanged, saved text unchanged.
//   node tests/smoke/list-input.mjs [--part widget,smd,sbeam,bsl,bgeo,gusset,secprop,index,pbd] [--a origin/main] [--shots <dir>]
// widget: a test page with the table (typing, Enter, "," key, paste from Excel, remove, checks and labels), bindInput (hidden
//         <input> kept as the text, scripted value redraws the table) and the React wrapper (React 18.2.0 from tests/libs).
// smd (one key per tool in TOOLS): the tool from --a (default: the entry's `a`, the main commit before its table landed, else
//         origin/main; with its shared/ folder) and from the working tree, each on its default
//         project and on one project with custom stations (typed into the old box on A, into the table on B): every computed
//         result and the page text (table elements removed) must be identical, the saved text the same, 0 console errors.
//         --shots: screenshots of the table at 1400 and 390 px.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { openPage, REPO, diff, hash } from '../lib.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) { if (!av[i].startsWith('--')) continue; const k = av[i].slice(2); args[k] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true; }
const parts = String(args.part || 'widget,smd,sbeam,bsl,bgeo,gusset,secprop,index,pbd').split(',');
const shots = args.shots ? path.resolve(String(args.shots)) : null; if (shots) fs.mkdirSync(shots, { recursive: true });
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };

// a git ref: the tool and shared/ written to a temp folder (the tools load shared/*.js by relative path)
function refDir(ref, tool) {
  const sha = execSync(`git -C "${REPO}" rev-parse --short ${ref}`, { encoding: 'utf8' }).trim();
  const dir = path.join(os.tmpdir(), 'allstruct-tests', 'li-' + sha); fs.mkdirSync(dir, { recursive: true });
  execSync(`git -C "${REPO}" archive ${sha} -- "${tool}" shared | tar -x -C "${dir}"`);
  return path.join(dir, tool);
}

/* ---------------- widget ---------------- */
async function widget() {
  console.log('widget (test page)');
  const dir = path.join(os.tmpdir(), 'allstruct-tests', 'li-widget'); fs.mkdirSync(dir, { recursive: true });
  const page = path.join(dir, 'w.html');
  fs.writeFileSync(page, `<!doctype html><meta charset="utf-8"><body style="font:14px sans-serif">
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>
<script src="file://${path.join(REPO, 'shared', 'list-input.js')}"></script>
<div id="a"></div><input id="txt" value="2.5, 5"><div id="r"></div>
<script>
window.log=[];window.evs=0;
window.A=SharedListInput.mount(document.getElementById('a'),{label:'Stations',columns:[{label:'x',unit:'ft',min:0,max:36}],onChange:r=>log.push(JSON.stringify(r))});
const t=document.getElementById('txt');t.addEventListener('input',()=>evs++);
window.B=SharedListInput.bindInput(t,{label:'Bound',columns:[{label:'x',unit:'ft'}]});
const LT=SharedListInput.react(React);
function App(){const [v,setV]=React.useState([110,140]);window.setV=setV;window.stateV=v;
  return React.createElement(LT,{label:'Spans',rows:SharedListInput.fromNumbers(v),columns:[{label:'L',unit:'ft',min:0,minExclusive:true}],
    onChange:rows=>setV(SharedListInput.toNumbers(rows))});}
ReactDOM.createRoot(document.getElementById('r')).render(React.createElement(App));
</script>`);
  const { b, p, errs } = await openPage(page, { vw: 900, vh: 700 });
  try {
    await p.waitForTimeout(500);
    const cell = (host, r, c = 0) => `#${host} tr[data-sli-r="${r}"] input[data-sli-c="${c}"]`;
    await p.click(cell('a', 0)); await p.keyboard.type('5'); await p.keyboard.press('Enter');
    ok(await p.evaluate(() => document.activeElement.closest('tr').getAttribute('data-sli-r')) === '1', 'Enter in the last row adds a row and moves to it');
    await p.keyboard.type('12'); await p.keyboard.press(',');
    ok(await p.$$eval('#a tbody tr', e => e.length) === 3, '"," in a one-column number table adds a row');
    await p.evaluate(() => { const i = document.activeElement, dt = new DataTransfer(); dt.setData('text', '1\n2\r\n3\n');
      i.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
    ok(JSON.stringify(await p.evaluate(() => A.get())) === '[["5"],["12"],["1"],["2"],["3"]]', 'paste of an Excel column fills one row per value');
    await p.evaluate(() => { const i = document.querySelector('#a tr[data-sli-r="0"] input'), dt = new DataTransfer(); dt.setData('text', '7, 8; 9');
      i.focus(); i.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
    ok(JSON.stringify(await p.evaluate(() => A.get())) === '[["7"],["8"],["9"],["2"],["3"]]', 'paste of "7, 8; 9" overwrites from the cell down');
    await p.click('#a button[data-sli-del="1"]');
    ok(JSON.stringify(await p.evaluate(() => A.get())) === '[["7"],["9"],["2"],["3"]]', '× removes its row');
    await p.fill(cell('a', 0), 'abc');
    const inv = await p.evaluate(() => { const i = document.querySelector('#a tr[data-sli-r="0"] input');
      return { cls: i.classList.contains('sli-error'), aria: i.getAttribute('aria-invalid'), msg: document.getElementById(i.getAttribute('aria-describedby')).textContent, label: i.getAttribute('aria-label') }; });
    ok(inv.cls && inv.aria === 'true' && inv.msg === 'Not a number', 'a cell that is not a number is marked (class, aria-invalid, message)');
    ok(inv.label === 'x (ft), row 1 — Stations', 'cell label: ' + inv.label);
    await p.fill(cell('a', 0), '40');
    ok(await p.evaluate(() => document.querySelector('#a tr[data-sli-r="0"] .sli-msg').textContent) === 'Must be ≤ 36', 'range check shown in the cell');
    ok(await p.evaluate(() => JSON.parse(log[log.length - 1]).join()) === '40,9,2,3', 'onChange passes the rows as typed (a flagged value is not dropped)');
    ok(await p.$eval('#a caption', e => e.textContent) === 'Stations' && await p.$eval('#a button.sli-add', e => e.getAttribute('aria-label')) === 'Add a row — Stations', 'caption and button labels');
    // bindInput
    ok(await p.$$eval('#txt + div tbody tr', e => e.length) === 2 && await p.$eval('#txt', e => getComputedStyle(e).display) === 'none', 'bindInput: "2.5, 5" shows two rows, the input is hidden');
    await p.fill('[data-sli-r="1"] input >> nth=1', '7');
    ok(await p.evaluate(() => document.getElementById('txt').value) === '2.5, 7' && await p.evaluate(() => evs) > 0, 'bindInput: an edit writes "2.5, 7" and fires input');
    await p.evaluate(() => { document.getElementById('txt').value = '1, 2, 3'; });
    ok(JSON.stringify(await p.evaluate(() => B.get())) === '[["1"],["2"],["3"]]', 'bindInput: a scripted value redraws the table');
    const e0 = await p.evaluate(() => evs);
    await p.click('#txt + div button.sli-add');
    ok(await p.evaluate(() => evs) === e0 && await p.evaluate(() => document.getElementById('txt').value) === '1, 2, 3', 'bindInput: adding a blank row does not change the text');
    // React
    ok(JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('#r input.sli-in')].map(i => i.value))) === '["110","140"]', 'React: rows from state');
    await p.click('#r tr[data-sli-r="1"] input'); await p.keyboard.press('End'); await p.keyboard.type('.5');
    ok(JSON.stringify(await p.evaluate(() => stateV)) === '[110,140.5]', 'React: typing updates the parent state');
    await p.keyboard.press('Enter'); await p.keyboard.type('abc');
    ok(await p.evaluate(() => document.activeElement.value) === 'abc' && JSON.stringify(await p.evaluate(() => stateV)) === '[110,140.5]', 'React: an unreadable value being typed is not wiped by the parent echo');
    await p.evaluate(() => setV([50, 60, 70]));
    await p.waitForTimeout(100);
    ok(JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('#r input.sli-in')].map(i => i.value))) === '["50","60","70"]', 'React: an outside change of state redraws the table');
    ok(errs.length === 0, 'no console errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  } finally { await b.close(); }
}

/* ---------------- tools ---------------- */
const TOOLS = {
  smd: {
    file: 'Shear and Moment Diagrams.html', values: '2.5, 5, 30', a: '5ec735f~1',
    setup: async p => { await p.waitForTimeout(1500); },
    template: async p => { await p.selectOption('#tplSel', '3s'); await p.waitForTimeout(1500); },
    typeOld: async (p, v) => { await p.evaluate(v => { const i = document.getElementById('iUX'); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, v); },
    saved: p => p.evaluate(() => document.getElementById('iUX').value),
    read: p => p.evaluate(() => {
      const strip = () => { const c = document.body.cloneNode(true); c.querySelectorAll('[data-sli],script,style').forEach(e => e.remove()); return c.innerText; };
      return { tabR, userX, shD, moD, deD, env, nodeR, saved: JSON.parse(localStorage.getItem('smd_auto_v1') || 'null'), text: strip() }; }),
    tableSel: '#iUX + [data-sli="host"]',
  },
  sbeam: {
    file: 'Steel Beam Design - AISC 15th.html', values: '5, 12.5, 31', a: '9a645e3~1',
    setup: async p => { await p.waitForTimeout(3500);   // open the input tab that holds "Output Stations"
      await p.evaluate(() => { const pn = document.querySelector('[data-secid="inOpts"]').closest('.sbdInPane'); document.getElementById(pn.id.replace('sbdInPane_', 'sbdInTab_')).click(); });
      await p.waitForTimeout(300); },
    typeOld: async (p, v) => { await p.fill('[data-fkey="userX"]', v); },
    saved: p => p.evaluate(() => S.disp.userX),
    read: async p => {
      const out = await p.evaluate(() => ({ AN, userX: userXList(), S: JSON.parse(JSON.stringify(S)) }));
      const n = await p.$$eval('#tabBar button', e => e.length); out.tabs = [];
      for (let i = 0; i < n; i++) {
        await p.$$eval('#tabBar button', (e, i) => e[i].click(), i); await p.waitForTimeout(700);
        out.tabs.push(await p.evaluate(() => { const c = document.getElementById('outputPanel');   // the results (the input panel holds the changed field)
          const k = c.cloneNode(true); k.querySelectorAll('[data-sli],script,style').forEach(e => e.remove()); return k.innerText.replace(/\d+(\.\d+)? ?ms\b/g, 'ms'); }));
      }
      out.inputText = await p.evaluate(() => { const k = document.getElementById('inputPanel').cloneNode(true);
        k.querySelectorAll('[data-sli],script,style,.uxHost').forEach(e => e.remove());
        k.querySelectorAll('.fRow').forEach(r => { if (/Custom stations x/.test(r.textContent)) r.remove(); }); return k.innerText; });
      return out;
    },
    tableSel: '.uxHost',
  },
  bsl: {   // Bridge Substructure Loading: span lengths and girder spacings (arrays P.br.spans / P.br.bays), committed when the focus leaves
    file: 'Bridge Substructure Loading.html', a: 'f4a6996', values: { spans: '110, 150, 120, 95', bays: '9, 9.5, 10' },
    expect: '{"spans":[110,150,120,95],"bays":[9,9.5,10]}',
    setup: async p => { await p.waitForTimeout(2500); await p.click('.itab[data-pane="bridge"]'); await p.waitForTimeout(400); },
    typeOld: async (p, v) => { for (const k of ['spans', 'bays']) { await p.evaluate(([k, v]) => { const i = document.getElementById('f_' + k); i.value = v;
      i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }, [k, v[k]]); await p.waitForTimeout(500); } },
    typeNew: async (p, v) => { for (const k of ['spans', 'bays']) { await fillTable(p, `#f_${k} + [data-sli="host"]`, v[k]); await p.evaluate(() => document.activeElement.blur()); await p.waitForTimeout(500); } },
    saved: p => p.evaluate(() => JSON.stringify({ spans: P.br.spans, bays: P.br.bays })),
    read: async p => {
      const out = await p.evaluate(() => ({ P: JSON.parse(JSON.stringify(P)), C: JSON.parse(JSON.stringify(MODEL.C)),
        stored: JSON.parse(localStorage.getItem(KEY) || 'null') }));
      if (out.P.ui) delete out.P.ui.tab; if (out.stored && out.stored.ui) delete out.stored.ui.tab;
      const ids = await p.$$eval('.tab-btn', e => e.map(b => b.dataset.tab).filter(t => t !== 'v3d')); out.tabs = {};
      for (const id of ids) { await p.click(`.tab-btn[data-tab="${id}"]`); await p.waitForTimeout(400);
        out.tabs[id] = await p.evaluate(id => { const e = document.getElementById('tab-' + id); if (!e) return null; const k = e.cloneNode(true);
          k.querySelectorAll('[data-sli],script,style').forEach(x => x.remove()); return k.innerText; }, id); }
      await p.click('.itab[data-pane="bridge"]'); await p.waitForTimeout(300);
      out.side = await p.evaluate(() => { const k = document.getElementById('sidebar').cloneNode(true);
        k.querySelectorAll('[data-sli],script,style,.note,#f_spans ~ .u,#f_bays ~ .u').forEach(x => x.remove());
        return k.innerText.replace(/(CL bearing|looking ahead)ft/g, '$1'); });   // the unit moved into the column header
      return out;
    },
    tableSel: '#f_spans + [data-sli="host"]',
  },
};
TOOLS.bgeo = {   // Bridge Geometry: per-span girder offsets (SPAN_OV[s].girders, array or null), committed when the focus leaves
  file: 'Bridge Geometry.html', a: '01f3bee', values: '-15, -5, 5, 15', expect: '[-15,-5,5,15]',
  over: 78,   // 78 px at 390 on main before the table: the tab bar and the fieldsets
  setup: async p => { await p.waitForTimeout(2500); await p.click('.tabbtn[data-tab="bridge"]'); await p.waitForTimeout(400); },
  typeOld: async (p, v) => { await p.evaluate(v => { const i = document.querySelector('input[data-f="girders"][data-s="2"]'); i.value = v;
    i.dispatchEvent(new Event('change', { bubbles: true })); }, v); },
  typeNew: async (p, v) => { await fillTable(p, '[data-sli-slot="girders2"]', v); await p.evaluate(() => document.activeElement.blur()); },
  saved: p => p.evaluate(() => JSON.stringify((SPAN_OV[2] || {}).girders || null)),
  read: async p => {
    await p.waitForTimeout(1500);
    const out = await p.evaluate(() => { const st = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); if (st) { delete st.savedAt; delete st.t; }
      return { SPAN_OV: JSON.parse(JSON.stringify(SPAN_OV)), stored: st }; });
    out.panes = {};
    for (const id of ['output', 'seat', 'bridge']) { await p.click(`.tabbtn[data-tab="${id}"]`); await p.waitForTimeout(500);
      out.panes[id] = await p.evaluate(id => { const k = document.getElementById('pane-' + id).cloneNode(true);
        k.querySelectorAll('[data-sli],script,style,#spantbl thead').forEach(x => x.remove()); return k.innerText; }, id); }
    await p.click('.tabbtn[data-tab="bridge"]'); await p.waitForTimeout(300);
    return out;
  },
  tableSel: '[data-sli-slot="girders2"]',
  // survey points: the paste box fills the table; a table edit rewrites the box; the flip relabels the columns
  extra: async p => {
    await p.click('.tabbtn[data-tab="map"]'); await p.waitForTimeout(300);
    await p.fill('#map_ptsbox', 'P1, 750123.45, 210987.65, control\nP2\t750200.10\t211050.30');
    const rows = await p.evaluate(() => PTS_TBL.get());
    ok(JSON.stringify(rows) === '[["P1","750123.45","210987.65","control"],["P2","750200.10","211050.30",""]]', 'survey points: the table shows the lines as read');
    await p.fill('#map_ptstbl tr[data-sli-r="1"] input[data-sli-c="1"]', '750201');
    ok(await p.$eval('#map_ptsbox', e => e.value) === 'P1, 750123.45, 210987.65, control\nP2, 750201, 211050.30', 'survey points: a table edit rewrites the box');
    await p.check('#map_flip');
    ok(await p.$eval('#map_ptstbl th[data-sli-h="1"]', e => e.textContent) === 'Easting', 'survey points: the flip relabels the columns');
    await p.click('#map_clrpts');
    ok(JSON.stringify(await p.evaluate(() => PTS_TBL.get())) === '[]', 'survey points: Clear points empties the table');
  },
};
TOOLS.gusset = {   // Gusset Plate Rating: members[i].fast.g, saved as text ("3.5, 4, 3.5"; one value = every gage); the hole paste is unchanged
  file: 'Gusset Plate Rating.html', a: '838ef81', values: '3.5, 4, 3.5',
  setup: async p => { await p.waitForTimeout(3000); await p.evaluate(() => { setITab('members'); P.ui.open.m0 = true; rebuild(['members']); }); await p.waitForTimeout(400); },
  typeOld: async (p, v) => { await p.evaluate(v => { const i = document.querySelector('input[data-k="members.0.fast.g"]'); i.value = v;
    i.dispatchEvent(new Event('input', { bubbles: true })); }, v); },
  typeNew: async (p, v) => { await fillTable(p, 'input[data-k="members.0.fast.g"] + [data-sli="host"]', v); await p.keyboard.press('Tab'); },
  saved: p => p.evaluate(() => P.members[0].fast.g),
  read: async p => {
    await p.waitForTimeout(1500);
    const out = await p.evaluate(() => ({ P: JSON.parse(JSON.stringify(P)), R: JSON.parse(JSON.stringify(R)), stored: JSON.parse(localStorage.getItem(KEY_AS) || 'null') }));
    for (const o of [out.P, out.stored && out.stored.data]) if (o && o.ui) delete o.ui.otab;
    const ids = await p.$$eval('.tab-btn', e => e.map(b => b.dataset.tab).filter(t => t && t !== 'v3d' && t !== 'view3d')); out.tabs = {};
    for (const id of ids) { await p.evaluate(id => setOTab(id), id); await p.waitForTimeout(400);
      out.tabs[id] = await p.evaluate(id => { const e = document.getElementById('tab-' + id); if (!e) return null; const k = e.cloneNode(true);
        k.querySelectorAll('[data-sli],script,style').forEach(x => x.remove()); return k.innerText; }, id); }
    out.side = await p.evaluate(() => { const k = document.getElementById('ipane-members').cloneNode(true);
      k.querySelectorAll('[data-sli],script,style,.lbl-note').forEach(x => x.remove()); return k.innerText; });
    return out;
  },
  tableSel: 'input[data-k="members.0.fast.g"] + [data-sli="host"]',
};
TOOLS.secprop = {   // Section Property Calculator: library "Tags" (LIBF.tags text, split at commas into the entry's tags array on save)
  file: 'Section Property Calculator.html', a: 'ee4f542', values: 'crane, runway, W21', expect: '[["crane","runway","W21"]]',
  setup: async p => { await p.waitForTimeout(2500); await p.evaluate(() => showInTab('tpl')); await p.waitForTimeout(400); },
  typeOld: async (p, v) => { await p.fill('[data-fkey="lib_tags"]', v); await p.click('#spcLib button.primary'); },
  typeNew: async (p, v) => { await fillTable(p, '.libTagsHost', v); await p.click('#spcLib button.primary'); },
  saved: p => p.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem(LS_LIB) || '{"entries":[]}').entries.map(e => e.tags))),
  read: async p => {
    await p.waitForTimeout(800);
    return p.evaluate(() => {
      const lib = JSON.parse(localStorage.getItem(LS_LIB) || 'null'); if (lib) (lib.entries || []).forEach(e => { delete e.id; delete e.created; delete e.modified; (e.parts || []).forEach(q => delete q.id); }); if (lib) delete lib.exported;
      const strip = id => { const k = document.getElementById(id).cloneNode(true); k.querySelectorAll('[data-sli],script,style,.libTagsHost').forEach(x => x.remove()); return k.innerText; };
      const noId = v => JSON.parse(JSON.stringify(v, (k, x) => (k === 'id' || k === 'created' || k === 'modified' ? undefined : x)));   // ids and times are made per run
      let t = JSON.stringify({ M, R }); (M.parts || []).forEach((pt, i) => { t = t.split(pt.id).join('PART' + i); });
      const mr = noId(JSON.parse(t));
      return { M: mr.M, R: mr.R, lib, input: strip('inputPanel'), output: strip('outputPanel') };
    });
  },
  tableSel: '.libTagsHost',
};
TOOLS.index = {   // index.html (MCT generator, React): GFS bay 1 floorbeam spacings and stringer offsets (arrays). The AREMA girder spacings
  // (text arema_spacings) are drawn only once MIDAS results are loaded, which the offline kit has no fixture for: Node round trip only.
  file: 'index.html', a: 'd49d19a', values: { bay1: '12, 18, 24, 18, 12', str: '2.5, 6, 9.5' },
  expect: '{"bay1":[12,18,24,18,12],"str":[2.5,6,9.5]}',
  ignore: /^\[BABEL\] Note/, serial: true, timeout: 120000,   // a 1.4 MB page compiled by Babel in the browser: one at a time, a longer load
  setup: async p => { await p.waitForTimeout(5000); await clickText(p, 'button', 'Geometry'); await clickText(p, 'button', 'Bridge System (GFS)'); await p.waitForTimeout(600); },
  typeOld: async (p, v) => { await p.fill('input[placeholder="e.g. 5, 12, 18, 12, 5"] >> nth=0', v.bay1); await p.waitForTimeout(300);
    await p.fill('input[placeholder="e.g. 2.5, 5.5"] >> nth=0', v.str); await p.waitForTimeout(300); },
  typeNew: async (p, v) => { await fillTable(p, '[data-sli="react"]:has(caption:text-is("Floorbeam spacing, bay 1"))', v.bay1); await p.keyboard.press('Tab'); await p.waitForTimeout(300);
    await fillTable(p, '[data-sli="react"]:has(caption:text-is("Stringer offsets from the left girder"))', v.str); await p.keyboard.press('Tab'); await p.waitForTimeout(300); },
  saved: p => p.evaluate(() => { const c = JSON.parse(localStorage.getItem('mct_cfg_v3') || '{}'), find = (o, k) => { if (!o || typeof o !== 'object') return undefined; if (k in o) return o[k];
    for (const x of Object.values(o)) { const r = find(x, k); if (r !== undefined) return r; } };
    return JSON.stringify({ bay1: find(c, 'bay1Stations'), str: find(c, 'stringerOffsets') }); }),
  read: async p => {
    await p.waitForTimeout(1200); const out = {};
    for (const t of ['Generate', 'Geometry']) { await clickText(p, 'button', t); await p.waitForTimeout(1500);
      out[t] = await p.evaluate(() => { const k = document.body.cloneNode(true); k.querySelectorAll('[data-sli],script,style,input,select,textarea').forEach(x => x.remove());
        return k.innerText.replace(/\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?/g, 'TIME').replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, 'TS'); }); }
    out.cfg = await p.evaluate(() => JSON.parse(localStorage.getItem('mct_cfg_v3') || 'null'));
    return out;
  },
  tableSel: '[data-sli="react"]:has(caption:text-is("Floorbeam spacing, bay 1"))',
};
TOOLS.pbd = {   // Prestressed Bridge Design: the bridge bar's span lengths (bridge.spans, an array), committed when the focus leaves the table
  file: 'Prestressed Bridge Design.html', a: '0cea448', values: '100, 120, 100', expect: '[100,120,100]',
  over: 212,   // 212 px at 390 on main before the table: the title-block grid
  ignore: /^\[BABEL\] Note/, serial: true, timeout: 120000,
  setup: async p => { await p.waitForTimeout(5000); },
  typeOld: async (p, v) => { await p.fill('.pbd-bar label.pbd-f input:not([type])', v); await p.evaluate(() => document.activeElement.blur()); await p.waitForTimeout(800); },
  typeNew: async (p, v) => { await fillTable(p, '.pbd-spans', v); await p.evaluate(() => document.activeElement.blur()); await p.waitForTimeout(800); },
  saved: p => p.evaluate(() => { const find = (o, k) => { if (!o || typeof o !== 'object') return undefined; if (k in o) return o[k];
      for (const x of Object.values(o)) { const r = find(x, k); if (r !== undefined) return r; } };
    for (const k of Object.keys(localStorage)) if (/^psbeam/.test(k)) { try { const r = find(JSON.parse(localStorage.getItem(k)), 'spans'); if (r !== undefined) return JSON.stringify(r); } catch (e) {} }
    return 'none'; }),
  read: async p => {
    await p.waitForTimeout(1500); const out = {};
    out.ls = await p.evaluate(() => { const o = {}; for (const k of Object.keys(localStorage).sort()) if (/^psbeam/.test(k)) o[k] = JSON.parse(localStorage.getItem(k)
      .replace(/"(producedAt|savedAt|ts|t|at|updatedAt|modified|created|migrated)":"[^"]*"/g, '"$1":"T"').replace(/"(ts|t|at)":\d+/g, '"$1":0')); return o; });
    const tabs = await p.$$eval('button', e => e.map(b => b.textContent.trim()).filter(t => ['Section Props', 'Losses', 'Stresses', 'Flexure', 'Shear', 'Camber', 'Rating'].includes(t)));
    for (const t of tabs) { await p.locator('button', { hasText: t }).first().click(); await p.waitForTimeout(1200);
      out[t] = await p.evaluate(() => { const k = document.body.cloneNode(true); k.querySelectorAll('[data-sli],script,style,input,select,textarea,.pbd-bar').forEach(x => x.remove());
        return k.innerText.replace(/\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?/g, 'TIME'); }); }
    return out;
  },
  tableSel: '.pbd-spans',
};
async function clickText(p, sel, text) { await p.locator(sel, { hasText: text }).first().click(); }
// replace the rows of a table with the values ("a, b, c"): row by row (Enter adds a row from the last one), extra rows removed
async function fillTable(p, sel, v) {
  const vals = String(v).split(',').map(s => s.trim());
  for (let i = 0; i < vals.length; i++) {
    if (i === 0) await p.click(`${sel} tr[data-sli-r="0"] input`); else await p.keyboard.press('Enter');
    await p.keyboard.press('Control+A'); await p.keyboard.type(vals[i]);
  }
  while (await p.$$eval(`${sel} tbody tr`, e => e.length) > vals.length) await p.click(`${sel} button[data-sli-del="${vals.length}"]`);
}
// type the stations into the table on B: click the first box, type, Enter between values
async function typeTable(p, sel, v) {
  const vals = v.split(',').map(s => s.trim());
  await p.click(`${sel} tr[data-sli-r="0"] input`);
  for (let i = 0; i < vals.length; i++) { await p.keyboard.type(vals[i]); if (i < vals.length - 1) await p.keyboard.press('Enter'); }
  await p.keyboard.press('Tab');
}
async function tool(key) {
  const T = TOOLS[key]; console.log(`${key}: ${T.file}`);
  const A = refDir(args.a || T.a || 'origin/main', T.file), B = path.join(REPO, T.file);
  const run = async (file, side, kase) => {
    const { b, p, errs, blocked } = await openPage(file, { vw: 1400, vh: 1000, timeout: T.timeout });
    try {
      await T.setup(p);
      if (kase === 'custom') {
        if (T.template) await T.template(p);
        if (side === 'A') await T.typeOld(p, T.values); else if (T.typeNew) await T.typeNew(p, T.values); else await typeTable(p, T.tableSel, T.values);
        await p.waitForTimeout(1500);
      }
      const r = await T.read(p); r.savedText = await T.saved(p);
      // a library request the offline test kit blocks (not in tests/libs) logs "Failed to load resource": listed, not counted
      r.errs = errs.filter(e => !(blocked.size && /^Failed to load resource/.test(e)) && !(T.ignore && T.ignore.test(e))); r.blocked = [...blocked];
      if (r.saved && typeof r.saved === 'object') delete r.saved.t;   // autosave time stamp
      if (side === 'B' && shots && kase === 'custom') {
        const box = p.locator(`${T.tableSel} [data-sli="box"], ${T.tableSel}[data-sli="box"]`).first();
        await box.scrollIntoViewIfNeeded();
        const bx = await box.boundingBox();
        await p.screenshot({ path: path.join(shots, `${key}-1400.png`), clip: { x: 0, y: Math.max(0, bx.y - 120), width: 1400, height: 360 } });
        await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(800);
        await box.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
        await p.screenshot({ path: path.join(shots, `${key}-390.png`) });
        r.over = await p.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth);
      }
      return r;
    } finally { await b.close(); }
  };
  for (const kase of ['default', 'custom']) {
    const [ra, rb] = T.serial ? [await run(A, 'A', kase), await run(B, 'B', kase)] : await Promise.all([run(A, 'A', kase), run(B, 'B', kase)]);
    const sa = JSON.parse(JSON.stringify({ ...ra, errs: 0, over: 0, blocked: 0 })), sb = JSON.parse(JSON.stringify({ ...rb, errs: 0, over: 0, blocked: 0 }));
    if (rb.blocked.length) console.log('       (blocked offline: ' + rb.blocked.join(', ') + ')');
    const d = diff(sa, sb);
    ok(!d.length, `${kase}: results, page text and saved data identical (hash ${hash(sa)} / ${hash(sb)})` + (d.length ? '\n       ' + d.slice(0, 8).map(x => `${x[0]}: ${String(JSON.stringify(x[1])).slice(0, 120)} -> ${String(JSON.stringify(x[2])).slice(0, 120)}`).join('\n       ') : ''));
    const want = T.expect || T.values;
    if (kase === 'custom') ok(ra.savedText === want && rb.savedText === want, `custom: saved text "${rb.savedText}" (A "${ra.savedText}")`);
    if (rb.over != null) ok(rb.over <= (T.over || 1), `390 px: page does not scroll sideways (${rb.over}` + (T.over ? `; ${T.over} px on main before the change` : '') + ')');
    ok(!ra.errs.length && !rb.errs.length, `${kase}: no console errors` + (ra.errs.length + rb.errs.length ? ': ' + [...ra.errs, ...rb.errs].join(' | ') : ''));
  }
  if (T.extra) {   // checks of the branch only (e.g. a paste box and its table)
    const { b, p, errs, blocked } = await openPage(B, { vw: 1400, vh: 1000, timeout: T.timeout });
    try { await T.setup(p); await T.extra(p);
      const e = errs.filter(e => !(blocked.size && /^Failed to load resource/.test(e)));
      ok(!e.length, 'extra checks: no console errors' + (e.length ? ': ' + e.join(' | ') : ''));
    } finally { await b.close(); }
  }
}

if (parts.includes('widget')) await widget();
for (const k of Object.keys(TOOLS)) if (parts.includes(k)) await tool(k);
console.log(fails ? `${fails} failure(s)` : 'all passed');
process.exit(fails ? 1 : 0);
