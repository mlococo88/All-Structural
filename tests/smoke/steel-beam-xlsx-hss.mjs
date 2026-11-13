#!/usr/bin/env node
// Steel Beam Design - AISC 15th: the header's "Export Excel" button writes the calc sheet for HSS sections (SBXH, 2026-11-13).
// Before SBXH the export stopped for every HSS ("Export failed: unresolved ref"): rectangular HSS at the LTB L_r formula
// (rts, ho), round HSS / pipe at the minor-axis shear (2 bf tf). Headless, offline (ExcelJS 4.4.0 from tests/libs).
// For each case: the inputs are set, the page rebuilt, the button clicked; the download must arrive (no "Export failed"
// toast), be a valid .xlsx read back by ExcelJS in the page, carry the HSS steps (F7 / F8, G4 / G5, H3.1) and show the app's
// phiMn, phiVn and phiTn in its formula cells. The numeric content of the sheet is checked cell by cell in Node by
// tests/engine/sbeam-hss-xlsx.test.mjs. Also: a W-shape still exports; no console errors.
//   node tests/smoke/steel-beam-xlsx-hss.mjs [--file <tool html>]
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FILE = path.resolve(REPO, arg('file', 'Steel Beam Design - AISC 15th.html'));
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };

const { b, p, errs } = await openPage(FILE);
await p.waitForFunction(() => typeof AN !== 'undefined' && AN && AN.design);
await p.waitForTimeout(700);
const CASES = [
  ['rect HSS12X6X1/2 A500 Gr. B, member mode, Lb = 12 ft', { section: { family: 'HSSR', label: 'HSS12X6X1/2', grade: 'A500B_R' }, member: { L: 20, Lb: 12 },
    rows: [{ id: 'm1', name: 'A', Mux: 150, Vux: 60, Pu: 150, Muy: 40, Vuy: 20, Tu: 40 }] }, /Eq\. F7-12/],
  ['rect HSS8X6X1/2 A1085, member mode, tension', { section: { family: 'HSSR', label: 'HSS8X6X1/2', grade: 'A1085' }, member: { L: 16, Lb: 16 },
    rows: [{ id: 'm1', name: 'A', Mux: 60, Vux: 20, Pu: -150, Muy: 10, Vuy: 5, Tu: 12 }] }, /A1085, t = t/],
  ['round HSS10.000X0.500 A500 Gr. C, beam mode', { section: { family: 'HSSP', label: 'HSS10.000X0.500', grade: 'A500C_P' } }, /Eq\. G5-1/],
  ['round HSS10.000X0.500, member mode, torsion, no member span', { section: { family: 'HSSP', label: 'HSS10.000X0.500', grade: 'A500C_P' }, member: { L: null, Lb: 10 },
    rows: [{ id: 'm1', name: 'A', Mux: 40, Vux: 10, Pu: 20, Muy: 5, Vuy: 4, Tu: 30 }] }, /Eq\. H3-2b/],
  ['Pipe8XS A53 Gr. B, member mode', { section: { family: 'PIPE', label: 'Pipe8XS', grade: 'A53B' }, member: { L: 12, Lb: 12 },
    rows: [{ id: 'm1', name: 'A', Mux: 40, Vux: 10, Pu: 30, Muy: 10, Vuy: 3, Tu: 0 }] }, /Eq\. F8-1/],
  ['W18X50 default beam', null, /Eq\. F2-1/]
];
for (const [name, cfg, mark] of CASES) {
  const want = await p.evaluate(cfg => {
    S = defaultState();
    if (cfg) { S.section = Object.assign({ builtUp: false, ovr: {} }, cfg.section);
      if (cfg.member) { S.mode = 'member'; Object.assign(S.member, cfg.member); S.member.rows = cfg.rows; } }
    fullRebuild();
    const D = AN.design, C = D.perCombo[0];
    return { mx: D.capTop.phiMn / 12, vx: C.shearX.phi * C.shearX.Vn, tn: D.tors && !D.tors.blocked ? D.tors.phiTn / 12 : null };
  }, cfg);
  await p.evaluate(() => { const t = document.getElementById('toast'); if (t) t.textContent = ''; });
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }),
    p.evaluate(() => [...document.querySelectorAll('button')].find(x => /Export Excel/.test(x.textContent)).click())]);
  const f = await dl.path(), buf = fs.readFileSync(f);
  assert.ok(buf.length > 10000, name + ': file size ' + buf.length);
  const toast = await p.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
  assert.ok(!/failed/i.test(toast), name + ': ' + toast);
  const got = await p.evaluate(async b64 => {
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Uint8Array.from(atob(b64), c => c.charCodeAt(0)));
    const ws = wb.getWorksheet('Design Calc'), lines = [];
    ws.eachRow(r => { const d = r.getCell(1).value, v = r.getCell(9).value, k = r.getCell(11).value;
      lines.push({ d: String(d == null ? '' : d), v: v && typeof v === 'object' && 'formula' in v ? v.result : v, f: !!(v && typeof v === 'object' && 'formula' in v), k: String(k == null ? '' : k) }); });
    return lines;
  }, buf.toString('base64'));
  const all = got.map(l => l.d + ' ' + l.k).join('\n');
  assert.match(all, mark, name + ': HSS / W step');
  const val = re => { const l = got.filter(x => re.test(x.d) && x.f); return l.length ? l[0].v : undefined; };
  const near = (a, e, m) => assert.ok(Math.abs(a - e) <= 0.005 + 1e-9, name + ': ' + m + ' ' + a + ' vs app ' + e);
  near(val(/^Design flexural strength/), want.mx, 'phiMnx');
  if (cfg && cfg.member) near(val(/^Design shear strength/), want.vx, 'phiVnx');
  if (want.tn) near(val(/^Design torsional strength/), want.tn, 'phiTn');
  ok(name + ': exported (' + buf.length + ' bytes), φMn ' + want.mx.toFixed(2) + ' k·ft as in the app');
}
assert.deepEqual(errs, [], 'console errors');
ok('no console errors');
await b.close();
console.log(n + ' checks passed');
