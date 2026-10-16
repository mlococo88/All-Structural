#!/usr/bin/env node
// Base Plate & Anchor Designer: "Export to Hilti PROFIS (.pe)" checks (added 2026-10-16).
//   node tests/bpad-profis.mjs                 results identity main vs working tree + export checks
//   node tests/bpad-profis.mjs --a <ref|file> --b <file> --out <dir>
// 1. results: origin/main and the working tree give identical computed results and report text on the
//    default project and on every built-in PROFIS validation case (VALIDATION_CASES).
// 2. reproduction: app inputs that reproduce tests/projects/bpad/profis-example.pe (the engineer's PROFIS
//    file) are exported and compared field by field with it. Expected differences are listed and explained.
// 3. unknown catalog items: a design with no known catalog IDs lists them as "Select in PROFIS".
// 4. the dialog's Download button writes a well-formed .pe.
// Exit code 0 when results are identical, every unexpected field matches and every check passes.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { HERE, openPage, resolveFile, hash, diff } from './lib.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) { if (!av[i].startsWith('--')) continue; const k = av[i].slice(2); args[k] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true; }
const FILE = 'BasePlateAnchorDesigner.html';
const A = resolveFile(args.a || 'origin/main', FILE), B = resolveFile(args.b || FILE, FILE);
const OUT = args.out || path.join(os.tmpdir(), 'allstruct-tests', 'bpad'); fs.mkdirSync(OUT, { recursive: true });
const EXAMPLE = fs.readFileSync(path.join(HERE, 'projects', 'bpad', 'profis-example.pe'), 'utf8');
let fail = false;
const ready = p => p.waitForFunction(() => typeof S !== 'undefined' && typeof computeAll === 'function' && document.getElementById('tabBar') && document.getElementById('tabBar').children.length > 0, null, { timeout: 60000 });

/* ---------- 1. results identity ---------- */
async function results(src) {
  const { b, p, errs } = await openPage(src.file);
  try {
    await ready(p);
    const R = await p.evaluate(() => {
      const strip = o => JSON.parse(JSON.stringify(o, (k, v) => typeof v === 'function' ? undefined : (typeof v === 'number' && !isFinite(v) ? String(v) : v)));
      const cases = [['default', () => defaultState()]].concat(VALIDATION_CASES.map(c => [c.id, () => c.setup()]));
      const out = {};
      for (const [id, mk] of cases) {
        S = mergeState(mk()); S.proj.date = '2026-01-01';
        try { refreshAll(); } catch (e) { out[id + '.refreshErr'] = String(e); }
        CC = computeAll();
        const gi = governingComboIndex();
        const caps = CC.combos.map(c => { const cap = comboCapacities(CC, c); return strip(cap); });
        let rep = '';
        try { buildPrintReport(); const h = document.getElementById('printReport'); rep = h ? h.innerText : ''; if (h) h.innerHTML = ''; } catch (e) { rep = 'ERR ' + e; }
        out[id] = { cc: strip(CC), gi, caps, validation: strip(VALIDATION), report: rep.replace(/\d{4}-\d\d-\d\d/g, '(date)') };
      }
      return out;
    });
    return { R, errs };
  } finally { await b.close(); }
}

/* ---------- 2-4. export checks (working tree) ---------- */
const EX_IDS = ['7c165881-4c70-4cfb-9bfa-98065fef8ea6', '876a09d9-1a47-816a-2be7-f4dc9ed5d974'];
async function exportChecks(src) {
  const { b, p, errs } = await openPage(src.file);
  try {
    await ready(p);
    const r = await p.evaluate(({ EXAMPLE, EX_IDS }) => {
      const flat = xml => { const d = new DOMParser().parseFromString(xml, 'application/xml');
        if (d.getElementsByTagName('parsererror').length) return null;
        const m = {}; const walk = (e, pth) => { const kids = [...e.children];
          if (!kids.length) { m[pth] = e.getAttributeNS('http://www.w3.org/2001/XMLSchema-instance', 'nil') === 'true' ? '(nil)' : e.textContent; return; }
          const cnt = {}; kids.forEach(k => cnt[k.localName] = (cnt[k.localName] || 0) + 1);
          const seen = {}; kids.forEach(k => { const i = seen[k.localName] = (seen[k.localName] || 0) + 1; walk(k, pth + '/' + k.localName + (cnt[k.localName] > 1 ? '[' + i + ']' : '')); }); };
        walk(d.documentElement, d.documentElement.localName); return { m, root: d.documentElement.localName, ns: d.documentElement.namespaceURI }; };
      const same = (a, b) => { if (a === b) return true; const x = +a, y = +b;
        return a !== '' && b !== '' && isFinite(x) && isFinite(y) && Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x), Math.abs(y)); };
      const out = {};
      /* 2. reproduce the example design */
      const s = defaultState();
      s.proj.name = 'Profis example';
      s.plate.B = 12; s.plate.N = 12; s.plate.t = 0.5; s.plate.grade = 'a36';
      s.col.custom = false; s.col.shapeType = 'HSS'; s.col.shape = 'HSS4X4';
      s.anchor.dia = 0.5; s.anchor.grade = 'f1554_36'; s.anchor.head = 'hvyhexhead'; s.anchor.hef = 10;
      s.anchor.nx = 2; s.anchor.ny = 2; s.anchor.edx = 1; s.anchor.edy = 2;          /* anchors at ±5, ±4 in */
      s.conc.H = 420; s.conc.fc = 4; s.conc.cracked = true;                          /* 10668 mm = 420 in */
      s.conc.Bx = 18; s.conc.By = 18; s.conc.plate_off_x = 0; s.conc.plate_off_y = 0; /* Edge* 228.6 mm = 9 in from the plate centre */
      s.grout.present = false; s.standoff.type = 'none';
      s.combos = [{ name: 'Combination 1', P: 0, Vx: 10, Vy: 0, Mx: 0, My: 0 },
                  { name: 'Combo 2', P: -10, Vx: 10, Vy: 2, Mx: 60, My: 120 }];          /* 5 / 10 ft-kip = 60 / 120 kip-in */
      S = mergeState(s); refreshAll();
      const before = JSON.stringify(S);
      const res = profisBuildPe({ guid: i => EX_IDS[i] });
      out.stateUnchanged = JSON.stringify(S) === before;
      const fa = flat(res.xml), fe = flat(EXAMPLE);
      out.wellFormed = !!fa; out.root = fa && fa.root; out.ns = fa && fa.ns;
      out.govIndex = res.govIndex; out.verify = res.verify; out.rows = res.rows;
      const keys = [...new Set([...Object.keys(fe.m), ...Object.keys(fa.m)])];
      out.fieldCount = Object.keys(fe.m).length;
      out.diffs = keys.filter(k => !same(fe.m[k], fa.m[k])).map(k => [k, fe.m[k], fa.m[k]]);
      out.xmlHead = res.xml.slice(0, 200);
      /* 2b. same design, template concrete grade */
      const r2 = profisBuildPe({ guid: i => EX_IDS[i], concMode: 'template' }); const f2 = flat(r2.xml);
      out.diffsTemplateGrade = keys.filter(k => !same(fe.m[k], f2.m[k])).map(k => [k, fe.m[k], f2.m[k]]);
      /* 3. unknown catalog items */
      const u = defaultState();
      u.proj.name = 'Unknown items'; u.proj.num = '24-001';
      u.anchor.dia = 0.75; u.anchor.grade = 'f1554_55'; u.anchor.head = 'heavyhex'; u.anchor.nx = 3; u.anchor.ny = 2;
      u.plate.B = 20; u.plate.N = 16; u.plate.grade = 'a572_50'; u.plate.exc_x = 1;
      u.col.custom = false; u.col.shapeType = 'W'; u.col.shape = 'W12X65';
      u.conc.cracked = false; u.conc.edgeReinf = 'stirrups'; u.standoff.type = 'grout'; u.tRebar.present = true;
      u.serviceLoads.useSeismic = true;
      S = mergeState(u); refreshAll();
      const ru = profisBuildPe(); const fu = flat(ru.xml);
      out.unknown = { wellFormed: !!fu, verify: ru.verify, rows: ru.rows.map(r => [r.item, r.ok, r.written]), fileName: ru.fileName,
        nCombos: fu && Object.keys(fu.m).filter(k => /LoadCombinationEntity(\[\d+\])?\/Id$/.test(k)).length, nAppCombos: S.combos.length,
        nPts: fu && Object.keys(fu.m).filter(k => /^ProjectDesignConcreteEntity\/AnchorLayout\/AnchorLayoutPoints\/AnchorLayoutPointEntity(\[\d+\])?\/X$/.test(k)).length,
        fastener: fu && fu.m['ProjectDesignConcreteEntity/Anchor/FastenerId'] };
      return out;
    }, { EXAMPLE, EX_IDS });
    /* 4. dialog + download */
    await p.evaluate(() => { S = mergeState(defaultState()); refreshAll(); });
    await p.click('#btnExportProfis');
    await p.waitForSelector('.modalBox h4');
    const dlg = await p.evaluate(() => document.querySelector('.modalBox').innerText);
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.modalBox .modalFoot button.primary')]);
    const f = path.join(OUT, dl.suggestedFilename()); await dl.saveAs(f);
    const txt = fs.readFileSync(f, 'utf8');
    r.download = { name: dl.suggestedFilename(), bytes: txt.length, wellFormed: await p.evaluate(x => !new DOMParser().parseFromString(x, 'application/xml').getElementsByTagName('parsererror').length, txt) };
    r.dialogText = dlg;
    await p.screenshot({ path: path.join(OUT, 'export-dialog.png'), fullPage: false });
    return { r, errs };
  } finally { await b.close(); }
}

console.log(`A: ${A.label}\nB: ${B.label}\nreadouts in ${OUT}\n`);
const [ra, rb, ex] = await Promise.all([results(A), results(B), exportChecks(B)]);
fs.writeFileSync(path.join(OUT, 'results.A.json'), JSON.stringify(ra)); fs.writeFileSync(path.join(OUT, 'results.B.json'), JSON.stringify(rb));
console.log('== 1. results, origin/main vs working tree');
for (const k of Object.keys(ra.R)) {
  const d = diff(ra.R[k], rb.R[k]);
  console.log(`  ${k.padEnd(14)} ${hash(ra.R[k])} ${hash(rb.R[k])} ${d.length ? 'DIFFERENT' : 'same'}`);
  if (d.length) { fail = true; d.slice(0, 15).forEach(x => console.log('     ', JSON.stringify(x).slice(0, 300))); }
}
const pe = x => x.filter(e => !/Failed to load resource|ERR_FAILED|net::/.test(e));
console.log(`  console errors A ${pe(ra.errs).length}, B ${pe(rb.errs).length}`); pe(rb.errs).slice(0, 5).forEach(e => console.log('    B: ' + e));

const r = ex.r;
fs.writeFileSync(path.join(OUT, 'export.json'), JSON.stringify(r, null, 1));
console.log('\n== 2. reproduction of the example .pe');
console.log(`  well-formed ${r.wellFormed}, root ${r.root}, ns ${r.ns}, state unchanged by export ${r.stateUnchanged}, governing combo index ${r.govIndex}`);
/* expected differences: what the tool cannot know or deliberately writes differently */
const EXPECT = [
  [/\/ProjectName$|\/DesignName$|\/Options\/ReportNotes$/, 'title block / export notes'],
  [/\/BaseMaterial\/ConcreteGradeType$|\/BaseMaterial\/CustomCompressiveStrength$/, "f'c written as Custom strength (example: Predefined grade 65, strength unknown)"],
  [/LoadCombinationEntity\[2\]\/MomentZ$|^ProjectDesignConcreteEntity\/Loads\/MomentZ$/, 'torsion: this tool has no Mz, written 0 (example 10 ft-kip)'],
  [/LoadCombinationEntity\[1\]\/Description$/, 'combination description: nil vs empty'],
];
let unexpected = 0;
console.log(`  ${r.fieldCount} leaf fields in the example; ${r.diffs.length} differ:`);
for (const [k, e, a] of r.diffs) {
  const why = EXPECT.find(([re]) => re.test(k));
  if (!why) unexpected++;
  console.log(`   ${why ? 'expected  ' : 'UNEXPECTED'} ${k}\n              example: ${String(e).slice(0, 120)}\n              export:  ${String(a).slice(0, 120)}${why ? '\n              (' + why[1] + ')' : ''}`);
}
if (unexpected || !r.wellFormed || !r.stateUnchanged || r.govIndex !== 1) fail = true;
console.log(`  with "Template grade": ${r.diffsTemplateGrade.length} differ (${r.diffsTemplateGrade.map(d => d[0].split('/').pop()).join(', ')})`);
console.log('  verify list:'); r.verify.forEach(v => console.log('   - ' + v));

console.log('\n== 3. unknown catalog items');
const u = r.unknown;
console.log(`  well-formed ${u.wellFormed}; file ${u.fileName}; combos ${u.nCombos}/${u.nAppCombos}; anchor points ${u.nPts}; FastenerId ${u.fastener}`);
u.rows.forEach(x => console.log(`   [${x[1]}] ${x[0]}: ${x[2]}`));
console.log('  verify list:'); u.verify.forEach(v => console.log('   - ' + v));
const need = [/anchor 3\/4 in Hex head bolt, F1554 Gr\. 55/, /column profile W12X65/, /plate steel A572 Gr\. 50/, /no PROFIS layout ID is known for 3 × 2/, /stand-off/, /Uncracked/, /Edge reinforcement/, /Anchor reinforcement/, /Seismic/, /Column offset/, /Plate orientation/];
const miss = need.filter(re => !u.verify.some(v => re.test(v)));
if (miss.length || !u.wellFormed || u.nCombos !== u.nAppCombos || u.nPts !== 6) { fail = true; console.log('  MISSING: ' + miss.map(String).join(', ')); }

console.log('\n== 4. dialog and download');
console.log(`  downloaded ${r.download.name} (${r.download.bytes} bytes), well-formed ${r.download.wellFormed}; screenshot ${path.join(OUT, 'export-dialog.png')}`);
if (!r.download.wellFormed || !/\.pe$/.test(r.download.name)) fail = true;
console.log(`  console errors ${pe(ex.errs).length}`); pe(ex.errs).slice(0, 5).forEach(e => console.log('    ' + e));
if (pe(ex.errs).length || pe(rb.errs).length) fail = true;
console.log(fail ? '\nFAIL' : '\nPASS');
process.exit(fail ? 1 : 0);
