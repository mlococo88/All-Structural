#!/usr/bin/env node
// shared/list-input.js in the browser (LIST, 2026-11-02), and the tools that load it: results unchanged, saved text unchanged.
//   node tests/smoke/list-input.mjs [--part widget,smd,sbeam,bsl,bgeo,gusset,secprop,index,stonearch,pbd,bpad,sbridge,secpropren] [--a <ref> | --orig] [--shots <dir>] [--out <dir>]
// widget: a test page with the table (typing, Enter, "," key, paste from Excel, remove, checks and labels), bindInput (hidden
//         <input> kept as the text, scripted value redraws the table) and the React wrapper (React 18.2.0 from tests/libs).
// smd (one key per tool in TOOLS): the tool from A (with its shared/ folder) and from the working tree, each on its default
//         project and on one project with custom stations: every computed result and the page text (table elements removed)
//         must be identical, the saved text the same, 0 console errors.
//         A = --a <ref>, else BASE (the recorded reference commit below), or with --orig the entry's `a` (the main commit before
//         its table landed, as the LIST PRs were checked). The values are typed into the table on a side that has it, else into the
//         old box (typeOld).
//         --shots: screenshots of the table at 1400 and 390 px. --out: the raw readouts of A and B per tool and case (JSON).
// Re-baseline (tests/README.md): when a later PR changes only display text of a tool (headers, Report tab, button labels), run
// with --out on main, check that every difference is display text (no result, input or saved-data field), then set BASE to that
// main commit. Never re-baseline a difference in a result, an input or saved data.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { openPage, REPO, diff, hash } from '../lib.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) { if (!av[i].startsWith('--')) continue; const k = av[i].slice(2); args[k] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true; }
const parts = String(args.part || 'widget,smd,sbeam,bsl,bgeo,gusset,secprop,index,stonearch,pbd,bpad,sbridge,secpropren').split(',');
const shots = args.shots ? path.resolve(String(args.shots)) : null; if (shots) fs.mkdirSync(shots, { recursive: true });
const outDir = args.out ? path.resolve(String(args.out)) : null; if (outDir) fs.mkdirSync(outDir, { recursive: true });   // raw readouts A / B per tool and case
// BASE: origin/main at the re-baseline of 2026-11-06 (RLI). Differences from the entries' `a` commits checked as display text only
// (smd, sbeam, bsl, secprop, index, pbd, sbridge, secpropren: the standard save card, headers, Report tab additions, labels).
const BASE = '6c3b1bcc62';
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };

// a git ref: the tool and shared/ written to a temp folder (the tools load shared/*.js by relative path)
function refDir(ref, tool, more) {   // more: other paths to take (e.g. a folder tool's whole folder)
  const sha = execSync(`git -C "${REPO}" rev-parse --short ${ref}`, { encoding: 'utf8' }).trim();
  const dir = path.join(os.tmpdir(), 'allstruct-tests', 'li-' + sha); fs.mkdirSync(dir, { recursive: true });
  execSync(`git -C "${REPO}" archive ${sha} -- "${tool}" shared ${(more || []).map(m => `"${m}"`).join(' ')} | tar -x -C "${dir}"`);
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
    // base: re-baselined 2026-11-10 (OPN/ABNF PR) to origin/main 5d8eeba. Differences from BASE 6c3b1bc checked commit by commit
    // (default and custom case: combine() of every unit, P.br, the numbers of every output tab): results change only at the
    // three merged §4 PRs #1093 (K_Z = G = 1.0 for Strength V / Service I wind), #1123 (γEQ 0.5 for new projects, skew
    // correction of bearing LL: P.br.gEQ 0 -> 0.5, skCorr -> 'yes', skKg -> '') and #1127 (E_c per Eq. 5.4.2.4-1, wind Z per
    // 3.8.1.2.1); the other 14 commits change display text only (reworded Summary / Dead load notes, Report §1.4, labels).
    base: '5d8eeba',
    expect: '{"spans":[110,150,120,95],"bays":[9,9.5,10]}',
    setup: async p => { await p.waitForTimeout(2500); await p.click('.itab[data-pane="bridge"]'); await p.waitForTimeout(400); },
    typeOld: async (p, v) => { for (const k of ['spans', 'bays']) { await p.evaluate(([k, v]) => { const i = document.getElementById('f_' + k); i.value = v;
      i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }, [k, v[k]]); await p.waitForTimeout(500); } },
    typeNew: async (p, v) => { for (const k of ['spans', 'bays']) { await fillTable(p, `#f_${k} + [data-sli="host"]`, v[k]); await p.evaluate(() => document.activeElement.blur()); await p.waitForTimeout(500); } },
    saved: p => p.evaluate(() => JSON.stringify({ spans: P.br.spans, bays: P.br.bays })),
    read: async p => {
      // SLAL (2026-11-11): the abutment-length note (Geometry tab, Report) and its two input-check ranges (Report §1.4) are display text
      // added after BASE; they are taken out of the page text here (every result, input and saved field is still compared)
      await p.evaluate(() => { window.slalStrip = t => t.replace(/\n?Abutment length: L[\s\S]*?as before this input was added\.(?=\n|$)/g, '').replace(/Abutment length along the bearing line L_ab: blank or greater than 0 ft; (Footing length L_ftg: blank or greater than 0 ft; )?/g, ''); });
      const out = await p.evaluate(() => ({ P: JSON.parse(JSON.stringify(P)), C: JSON.parse(JSON.stringify(MODEL.C)),
        stored: JSON.parse(localStorage.getItem(KEY) || 'null') }));
      if (out.P.ui) delete out.P.ui.tab; if (out.stored && out.stored.ui) delete out.stored.ui.tab;
      const ids = await p.$$eval('.tab-btn', e => e.map(b => b.dataset.tab).filter(t => t !== 'v3d')); out.tabs = {};
      for (const id of ids) { await p.click(`.tab-btn[data-tab="${id}"]`); await p.waitForTimeout(400);
        out.tabs[id] = await p.evaluate(id => { const e = document.getElementById('tab-' + id); if (!e) return null; const k = e.cloneNode(true);
          k.querySelectorAll('[data-sli],script,style').forEach(x => x.remove()); return slalStrip(k.innerText); }, id); }
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
    const ids = await p.$$eval('.tab-btn', e => e.map(b => b.dataset.tab).filter(t => t && !['v3d', 'view3d', 'report', 'report2'].includes(t))); out.tabs = {};
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
TOOLS.stonearch = {   // Stone Masonry Arch: SDL line items and depth overrides (paste boxes + their tables), track offsets (table); all saved as text
  file: 'Stone Masonry Arch Load Rating.html', a: 'd49d19a',
  values: { sdlItems: 'Sidewalks (2), 800\nRailings (2), 120', dOver: '18, 19', tracks: '-6\n6' },
  expect: JSON.stringify({ sdlItems: 'Sidewalks (2), 800\nRailings (2), 120', dOver: '18, 19', tracks: '-6\n6' }),
  setup: async p => { await p.waitForTimeout(3000); },
  template: async p => { await p.evaluate(() => { const s = document.getElementById('loadMode'); s.value = 'rail'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(2500); },
  typeOld: async (p, v) => { await p.evaluate(v => { for (const k of ['sdlItems', 'dOver', 'tracks']) { const t = document.getElementById(k); t.value = v[k];
    t.dispatchEvent(new Event('input', { bubbles: true })); } }, v); },
  typeNew: async (p, v) => { await p.evaluate(v => {   // paste into the first cell of each table, as from Excel
    const paste = (sel, text) => { const i = document.querySelector(sel + ' tr[data-sli-r="0"] input[data-sli-c="0"]'), dt = new DataTransfer(); dt.setData('text', text);
      i.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); };
    paste('#sdlItems + .sliPaste', v.sdlItems); paste('#dOver + .sliPaste', v.dOver); paste('#tracks + [data-sli="host"]', v.tracks); }, v); },
  saved: p => p.evaluate(() => { const v = id => { const e = document.getElementById(id); return e ? e.value : null; };
    return JSON.stringify({ sdlItems: v('sdlItems'), dOver: v('dOver'), tracks: v('tracks') }); }),
  read: async p => {
    await p.waitForTimeout(2500);
    const out = await p.evaluate(() => { const st = JSON.parse(localStorage.getItem('stoneArchLR.autosave') || 'null'); if (st) { delete st.savedAt; delete st.t; delete st.ts; }
      return { stored: st }; });   // the tool's state is inside a closure: the results are read from every output tab's text
    const tabs = await p.$$eval('#outPanel button[data-tab]', e => e.map(b => b.getAttribute('data-tab'))); out.tabs = {};
    for (const t of tabs) { if (t === 'rpt') continue; await p.click(`#outPanel button[data-tab="${t}"]`); await p.waitForTimeout(800);
      out.tabs[t] = await p.evaluate(t => { const e = document.getElementById('pane_' + t); if (!e) return null; const k = e.cloneNode(true);
        k.querySelectorAll('[data-sli],script,style,canvas,.js-plotly-plot').forEach(x => x.remove());
        return k.innerText.replace(/ ?Computed in [\d.]+ s;[^.]*\./g, '').replace(/\s+/g, ' '); }, t); }   // a timing note, shown only when the sweep was not cached
    return out;
  },
  tableSel: '#sdlItems + .sliPaste',
  shotPrep: async p => { await p.evaluate(() => { const pn = document.getElementById('sdlItems').closest('[id^="inPane_"]'); document.getElementById(pn.id.replace('inPane_', 'inTab_')).click(); }); await p.waitForTimeout(400); },
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
TOOLS.bpad = {   // BasePlateAnchorDesigner: stacked hairpin depths (S.vRebar.vDepths, text "3, 6.5, 10"), committed when the focus leaves
  file: 'BasePlateAnchorDesigner.html', a: '0cea448', values: '3, 6.5, 10',
  setup: async p => { await p.waitForTimeout(3000); },
  template: async p => { await p.evaluate(() => { Object.assign(S.vRebar, { present: true, layoutMode: 'group', pieceType: 'hairpin', vStack: 3 }); refreshAll();
      const r = [...document.querySelectorAll('.fRow')].find(e => /Depths of the stacked pieces/.test(e.textContent));
      const pn = r.closest('.bpadInPane'); document.getElementById(pn.id.replace('bpadInPane_', 'bpadInTab_')).click(); }); await p.waitForTimeout(800); },
  typeOld: async (p, v) => { await p.evaluate(v => { const r = [...document.querySelectorAll('.fRow')].find(e => /Depths of the stacked pieces/.test(e.textContent));
    const i = r.querySelector('input[type=text]'); i.focus(); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); i.blur(); }, v); await p.waitForTimeout(800); },
  typeNew: async (p, v) => { await fillTable(p, '.fRow:has-text("Depths of the stacked pieces") [data-sli="host"]', v); await p.evaluate(() => document.activeElement.blur()); await p.waitForTimeout(800); },
  saved: p => p.evaluate(() => S.vRebar.vDepths),
  read: async p => {
    await p.waitForTimeout(1000);
    const out = await p.evaluate(() => ({ S: JSON.parse(JSON.stringify(S)), stored: JSON.parse(localStorage.getItem(LS_AUTO) || 'null') }));
    const n = await p.$$eval('#tabBar button', e => e.length); out.tabs = [];
    for (let i = 0; i < n; i++) { await p.$$eval('#tabBar button', (e, i) => e[i].click(), i); await p.waitForTimeout(600);
      out.tabs.push(await p.evaluate(() => { const k = document.getElementById('outputPanel').cloneNode(true); k.querySelectorAll('[data-sli],script,style').forEach(x => x.remove());
        return k.innerText.replace(/\d+(\.\d+)? ?ms\b/g, 'ms'); })); }
    return out;
  },
  tableSel: '.fRow:has-text("Depths of the stacked pieces") [data-sli="host"]',
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
TOOLS.sbridge = {   // apps/steel-bridge: spans, girder spacings, skews (arrays), cross-frame x:P loads (array of {x, P}), pours a-b (text)
  file: 'apps/steel-bridge/index.html', archive: ['apps/steel-bridge'], a: '0cea448',
  values: { spans: '110, 140, 110', bays: '9, 9.5, 9, 9.5', skews: '10, 10, 10, 10', xf: '20:1.5, 45:2', seq: '0-80, 140-220' },
  expect: '{"spans":[110,140,110],"bays":[9,9.5,9,9.5],"skews":[10,10,10,10],"xf":[{"x":20,"P":1.5},{"x":45,"P":2}],"seq":"0-80, 140-220"}',
  serial: true, timeout: 120000,
  setup: async p => { await p.waitForSelector('#tabBar [data-otab="an"]', { timeout: 120000 }); await p.waitForTimeout(2500); },
  typeOld: async (p, v) => {
    const put = async (itab, sel, val) => { if (itab) { await p.click(`#inTabs [data-itab="${itab}"]`); await p.waitForTimeout(400); }
      await p.evaluate(([sel, val]) => { const i = document.querySelector(sel); i.value = val; i.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, val]); await p.waitForTimeout(800); };
    await put('spans', '#i_spans', v.spans); await put('xs', '[id="i_xs.bays"]', v.bays); await put('xs', '[id="i_xs.skews"]', v.skews);
    await p.click('#tabBar [data-otab="an"]'); await p.waitForTimeout(1500);
    await put(null, '#an_l_xf', v.xf); await put(null, '#an_a_seqCustom', v.seq);
  },
  typeNew: async (p, v) => {
    const host = sel => `${sel} + [data-sli="host"]`;
    const one = async (itab, sel, val) => { await p.click(`#inTabs [data-itab="${itab}"]`); await p.waitForTimeout(400); await fillTable(p, host(sel), val);
      await p.evaluate(() => document.activeElement.blur()); await p.waitForTimeout(800); };
    const two = async (sel, val) => { await p.evaluate(([sel, val]) => { const i = document.querySelector(sel + ' tr[data-sli-r="0"] input[data-sli-c="0"]'), dt = new DataTransfer(); dt.setData('text', val);
      i.focus(); i.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, [sel, val]); await p.waitForTimeout(200);
      await p.evaluate(() => document.activeElement.blur()); await p.waitForTimeout(800); };
    await one('spans', '#i_spans', v.spans); await one('xs', '[id="i_xs.bays"]', v.bays); await one('xs', '[id="i_xs.skews"]', v.skews);
    await p.click('#tabBar [data-otab="an"]'); await p.waitForTimeout(1500);
    await two(host('#an_l_xf'), v.xf.replace(/, /g, '\n').replace(/:/g, '\t')); await two(host('#an_a_seqCustom'), v.seq.replace(/, /g, '\n').replace(/-/g, '\t'));
  },
  saved: p => p.evaluate(() => { const j = JSON.parse(localStorage.getItem('sbd2.project.current') || 'null'); if (!j || !j.spans) return 'not saved';
    return JSON.stringify({ spans: j.spans.lengths, bays: j.xs.bays, skews: j.xs.skews, xf: ((j.girders[0] || {}).loadsManual || {}).xf || [], seq: (j.analysis || {}).seqCustom }); }),
  read: async p => {
    await p.waitForTimeout(1500); const out = {};
    out.stored = await p.evaluate(() => JSON.parse((localStorage.getItem('sbd2.project.current') || 'null').replace(/"(savedAt|ts|at|updatedAt|modified|created|producedAt)":"[^"]*"/g, '"$1":"T"')));
    for (const t of ['sec', 'loads', 'an']) { await p.click(`#tabBar [data-otab="${t}"]`); await p.waitForTimeout(1500);
      out[t] = await p.evaluate(() => { const k = document.getElementById('out').cloneNode(true); k.querySelectorAll('[data-sli],script,style,input,select,textarea,.unit').forEach(x => x.remove()); return k.innerText; }); }
    out.inputs = {};
    for (const t of ['spans', 'xs', 'fs', 'spl']) { await p.click(`#inTabs [data-itab="${t}"]`); await p.waitForTimeout(500);
      out.inputs[t] = await p.evaluate(() => { const k = document.getElementById('inPanes').cloneNode(true); k.querySelectorAll('[data-sli],script,style,input,select,textarea,.unit,.note').forEach(x => x.remove()); return k.innerText; }); }
    return out;
  },
  tableSel: '#i_spans + [data-sli="host"]',
  shotPrep: async p => { await p.click('#inTabs [data-itab="spans"]'); await p.waitForTimeout(500); },
};
TOOLS.secpropren = {   // Section Property Calculator: Rename = one dialog (name, description, tags table) in place of three prompts.
  // A: the prompts, each accepted with its default (the test kit accepts every dialog); B: the dialog saved unchanged -> the same library.
  file: 'Section Property Calculator.html', a: 'a325909', values: 'crane, runway, W21', expect: '[["crane","runway","W21"]]',
  setup: TOOLS.secprop.setup,
  typeOld: async (p, v) => { await TOOLS.secprop.typeNew(p, v); await p.waitForTimeout(500); await p.click('#spcLib .libRow button:has-text("Rename")'); await p.waitForTimeout(500); },
  typeNew: async (p, v) => { await TOOLS.secprop.typeNew(p, v); await p.waitForTimeout(500); await p.click('#spcLib .libRow button:has-text("Rename")'); await p.waitForTimeout(300);
    await p.click('#libRenSave'); await p.waitForTimeout(500); },
  saved: TOOLS.secprop.saved, read: TOOLS.secprop.read, tableSel: '.libTagsHost',
  extra: async p => {   // the dialog: prefilled, a tag added and one removed, a new name and description -> saved as an array; Cancel / Escape change nothing
    await TOOLS.secprop.typeNew(p, 'crane, runway'); await p.waitForTimeout(500);
    await p.click('#spcLib .libRow button:has-text("Rename")'); await p.waitForTimeout(300);
    const pre = await p.evaluate(() => [...document.querySelectorAll('#libRenOverlay input.sli-in')].map(i => i.value));
    ok(JSON.stringify(pre) === '["crane","runway"]', 'rename dialog: the tags are shown one per row');
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    ok(!(await p.$('#libRenOverlay')), 'rename dialog: Escape closes it');
    await p.click('#spcLib .libRow button:has-text("Rename")'); await p.waitForTimeout(300);
    await p.fill('#libRenOverlay input[aria-label="Name"]', 'Runway girder'); await p.fill('#libRenOverlay input[aria-label="Description"]', ' W21 + C15 ');
    await p.click('#libRenOverlay button[data-sli-del="0"]'); await p.click('#libRenOverlay button.sli-add');
    await p.keyboard.type('W21 + C15'); await p.click('#libRenSave'); await p.waitForTimeout(500);
    const e = await p.evaluate(() => { const x = JSON.parse(localStorage.getItem(LS_LIB)).entries[0]; return { name: x.name, desc: x.desc, tags: x.tags }; });
    ok(JSON.stringify(e) === '{"name":"Runway girder","desc":"W21 + C15","tags":["runway","W21 + C15"]}', 'rename dialog: saved ' + JSON.stringify(e));
    await p.click('#spcLib .libRow button:has-text("Rename")'); await p.waitForTimeout(300);
    await p.fill('#libRenOverlay input[aria-label="Name"]', ''); await p.click('#libRenSave');
    ok(!!(await p.$('#libRenOverlay')) && /Enter a name/.test(await p.$eval('#libRenOverlay .errBox', x => x.textContent)), 'rename dialog: a blank name is refused in the dialog');
    await p.click('#libRenOverlay button:has-text("Cancel")');
  },
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
// two values for the log: for two strings, the text around the first difference
function showDiff(x, y) {
  if (typeof x === 'string' && typeof y === 'string') { let i = 0; while (i < x.length && x[i] === y[i]) i++;
    return `@${i}: ${JSON.stringify(x.slice(Math.max(0, i - 40), i + 80))} -> ${JSON.stringify(y.slice(Math.max(0, i - 40), i + 80))}`; }
  return `${String(JSON.stringify(x)).slice(0, 120)} -> ${String(JSON.stringify(y)).slice(0, 120)}`;
}
async function tool(key) {
  const T = TOOLS[key]; console.log(`${key}: ${T.file}`);
  const A = refDir(args.a || (args.orig ? T.a : (T.base || BASE)), T.file, T.archive), B = path.join(REPO, T.file);   // T.base: a part re-baselined on its own
  const run = async (file, side, kase) => {
    const { b, p, errs, blocked } = await openPage(file, { vw: 1400, vh: 1000, timeout: T.timeout });
    try {
      await T.setup(p);
      if (kase === 'custom') {
        if (T.template) await T.template(p);
        const table = side === 'B' || !!(await p.$(T.tableSel));   // A older than the tool's table: the old box
        if (!table) await T.typeOld(p, T.values); else if (T.typeNew) await T.typeNew(p, T.values); else await typeTable(p, T.tableSel, T.values);
        await p.waitForTimeout(1500);
      }
      const r = await T.read(p); r.savedText = await T.saved(p);
      // a library request the offline test kit blocks (not in tests/libs) logs "Failed to load resource": listed, not counted
      r.errs = errs.filter(e => !(blocked.size && /^Failed to load resource/.test(e)) && !(T.ignore && T.ignore.test(e))); r.blocked = [...blocked];
      if (r.saved && typeof r.saved === 'object') delete r.saved.t;   // autosave time stamp
      if (side === 'B' && shots && kase === 'custom') {
        if (T.shotPrep) await T.shotPrep(p);   // e.g. open the input tab that holds the table
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
    if (outDir) { fs.writeFileSync(path.join(outDir, `${key}-${kase}-A.json`), JSON.stringify(sa, null, 1)); fs.writeFileSync(path.join(outDir, `${key}-${kase}-B.json`), JSON.stringify(sb, null, 1)); }
    ok(!d.length, `${kase}: results, page text and saved data identical (hash ${hash(sa)} / ${hash(sb)})` + (d.length ? '\n       ' + d.slice(0, 8).map(x => `${x[0]}: ` + showDiff(x[1], x[2])).join('\n       ') : ''));
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
