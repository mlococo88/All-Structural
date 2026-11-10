// End-to-end smoke of the Retaining Wall Designer <-> Pile Designer hand-off (RWPX, 2026-11-07; HANDOFF.md §4.6 revision 2, §4.10):
//   1. Retaining Wall Designer, pile-supported footing (AASHTO): "Send to Pile Designer" -> "Send to other tools" (foundationLoads + by.retwall);
//      the payload: element.type "wall", revision 2, pileLayout, pileDesign, contentHash; sum of pileP = P per case; the per-pile governing
//      loads equal the wall's Pile Step 2 values.
//   2. Pile Designer (same browser profile, one file:// storage origin): "Pull from Abutment / SubLoads" -> Import (group target, layout adopted);
//      its own distribution matches pileP; "Run all cases"; "Send pile results to the abutment" -> "Send to other tools" (pileResults).
//   3. Retaining Wall Designer: "Pull pile results" -> Import: R_n, φ_c (and uplift) set from Pile Designer, status CURRENT, the record saved;
//      then a load change (stem height) -> STALE: warning, the calculation uses the values held before the import, the inputs keep the
//      imported values; back to the old height -> CURRENT again.
// usage: node tests/smoke/retwall-pile-handoff.mjs
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { openPage } = await import(path.join(ROOT, 'tests/lib.mjs'));
let fails = 0; const check = (ok, m) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${m}`); if (!ok) fails++; };
const o = await openPage(path.join(ROOT, 'Retaining Wall Designer.html'), { vw: 1400, vh: 1000 });
const rw = o.p;
await rw.waitForFunction(() => window._R, null, { timeout: 60000 });
await rw.evaluate(() => { const set = (id, v) => { const el = document.getElementById(id); if (el.type === 'checkbox') el.checked = v; else el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
  set('design_basis', 'AASHTO'); onBasisChange(); set('fnd_type', 'pile'); set('tf', '36'); syncConditionalUI(); onInputChange(); });
await rw.waitForTimeout(800);
const itab = await rw.$('#itabs .itab[data-pane="project"]'); if (itab) await itab.click();   // HOC (2026-11-10): the hand-off buttons are in the Project tab's Hand-offs block
await rw.locator('#pxr_send').scrollIntoViewIfNeeded();
console.log('1. Retaining Wall Designer: send');
const R0 = await rw.evaluate(() => ({ Rn: _R.inp.fnd.Rn, phic: _R.inp.fnd.phic, comb: _R.pile.comb.map(c => ({ key: c.key, Pmax: c.L.Pmax, Pmin: c.L.Pmin, h: c.L.rows[0].h, iMax: c.L.iMax })) }));
await rw.click('#pxr_send'); await rw.waitForSelector('#rwpx-ov');
await rw.click('#rwpx-btns button:has-text("Send to other tools")'); await rw.waitForTimeout(500);
const P = await rw.evaluate(() => JSON.parse(localStorage.getItem('bridgeSuite.v1.foundationLoads')));
const P2 = await rw.evaluate(() => JSON.parse(localStorage.getItem('bridgeSuite.v1.foundationLoads.by.retwall')));
check(P && P._schema === 'bridge-foundation-loads' && P.revision === 2 && P.element.type === 'wall' && P.producer === 'Retaining Wall Designer', 'payload: schema, revision 2, element.type "wall"');
check(P2 && P2.producedAt === P.producedAt, 'copy at foundationLoads.by.retwall');
check(P.cases.length === R0.comb.length && P.cases.every(c => Math.abs(c.pileP.reduce((a, b) => a + b, 0) - c.P) < 0.01 * P.pileLayout.n), 'every case: sum of pileP = P (' + P.cases.length + ' cases, ' + P.pileLayout.n + ' piles, segment ' + P.pileLayout.cap.lengthY + ' ft)');
const pdOk = R0.comb.every(c => { const q = P.pileDesign.cases.find(x => x.id === c.key + ':compression'); return q && Math.abs(q.P - c.Pmax) < 0.0006 && Math.abs(q.V - c.h) < 0.0006; });
check(pdOk, 'pileDesign compression rows = the wall\'s P_max and h per combination');
const ppOk = P.cases.every(c => { const cb = R0.comb.find(x => x.key === c.id); return Math.abs(Math.max(...c.pileP) - cb.Pmax) < 0.002; });
check(ppOk, 'pileP of the exact segment: the largest = the wall\'s per-ft P_max (each case)');
console.log('2. Pile Designer: pull, run, send results');
const pd = await o.ctx.newPage(); const pdErr = []; pd.on('pageerror', e => pdErr.push(e.message));
await pd.goto('file://' + path.join(ROOT, 'Pile Designer.html')); await pd.waitForTimeout(4000);
const clickT = t => pd.evaluate(t => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim().startsWith(t)); if (!b) return false; b.click(); return true; }, t);
await clickT('Loads & group'); await pd.waitForTimeout(500);
check(await clickT('Pull from Abutment / SubLoads'), 'Pile Designer: "Pull from Abutment / SubLoads" found'); await pd.waitForSelector('#pfxGo', { timeout: 15000 });
const dlg = await pd.evaluate(() => document.body.innerText);
check(/Retaining Wall Designer/.test(dlg), 'Pile Designer dialog lists the wall\'s payload');
const pp = /Per-pile check: for all (\d+) case\(s\), every pile's reaction[^]*?within ([0-9.]+) kip/.exec(dlg);
check(pp && +pp[1] === P.cases.length && +pp[2] <= 0.01, 'Pile Designer\'s own distribution on the adopted layout equals pileP: ' + (pp ? pp[0].slice(0, 160) : dlg.slice(0, 300)));
await pd.click('#pfxGo'); await pd.waitForTimeout(1500);
const src = await pd.evaluate(() => { try { return JSON.parse(localStorage.getItem('pileDesigner.inputs.v1') || 'null'); } catch (e) { return null; } });
check(await clickT('Run all cases'), 'Pile Designer: Run all cases'); await pd.waitForTimeout(10000);
check(await clickT('Send pile results to the abutment'), 'Pile Designer: "Send pile results to the abutment"'); await pd.waitForTimeout(800);
check(await clickT('Send to other tools'), 'Pile Designer: Send to other tools'); await pd.waitForTimeout(800);
const RES = await pd.evaluate(() => JSON.parse(localStorage.getItem('bridgeSuite.v1.pileResults') || 'null'));
check(RES && RES.basis && RES.basis.producer === 'Retaining Wall Designer' && RES.basis.contentHash === P.contentHash, 'pileResults: basis = the wall\'s payload, content hash echoed (' + (RES && RES.basis && RES.basis.contentHash) + ')');
check(RES && RES.geotechnical && RES.geotechnical.static && RES.geotechnical.static.Rn > 0, 'pileResults: static R_n = ' + (RES && RES.geotechnical && RES.geotechnical.static && RES.geotechnical.static.Rn));
check(RES && Array.isArray(RES.cases) && RES.cases.length > 0, 'pileResults: ' + (RES && RES.cases ? RES.cases.length : 0) + ' cases run');
check(!pdErr.length, 'Pile Designer: no page errors ' + JSON.stringify(pdErr.slice(0, 3)));
console.log('3. Retaining Wall Designer: pull pile results, stale check');
await rw.bringToFront(); { const it = await rw.$('#itabs .itab[data-pane="project"]'); if (it) await it.click(); } await rw.click('#pxr_pull'); await rw.waitForSelector('#rwpx-ov');
const pullTxt = await rw.evaluate(() => document.getElementById('rwpx-ov').innerText);
check(/CURRENT/.test(pullTxt), 'pull dialog: status CURRENT');
await rw.click('#rwpx-btns button:has-text("Import")'); await rw.waitForTimeout(800);
const A = await rw.evaluate(() => ({ Rn: _R.inp.fnd.Rn, phic: _R.inp.fnd.phic, field: document.getElementById('pile_Rn').value, st: _R.pxr && _R.pxr.status, rec: !!document.getElementById('pile_pxr').value,
  saved: (() => { const s = snapshotFields(); return !!s.pile_pxr; })(), dc: _R.checks.pileComp.dc != null ? _R.checks.pileComp.dc : null }));
check(Math.abs(A.Rn - RES.geotechnical.static.Rn) < 1e-9 && Math.abs(A.phic - RES.geotechnical.static.phi) < 1e-9, 'imported: R_n = ' + A.Rn + ', φ_c = ' + A.phic + ' (Pile Designer\'s static values), used in the calculation');
check(A.st === 'current' && A.rec && A.saved, 'status CURRENT; record in pile_pxr, saved with the project');
await rw.evaluate(() => { const el = document.getElementById('Hs'); el.value = String(+el.value + 1); el.dispatchEvent(new Event('change', { bubbles: true })); onInputChange(); });
await rw.waitForTimeout(500);
const B = await rw.evaluate(() => ({ Rn: _R.inp.fnd.Rn, phic: _R.inp.fnd.phic, field: document.getElementById('pile_Rn').value, st: _R.pxr && _R.pxr.status, w: _R.warnings.find(w => /STALE/.test(w)) || '' }));
check(B.st === 'stale' && /STALE/.test(B.w), 'stem height changed: STALE, warning');
check(Math.abs(B.Rn - R0.Rn) < 1e-9 && Math.abs(B.phic - R0.phic) < 1e-9 && B.field === A.field, 'STALE: the calculation uses R_n = ' + B.Rn + ', φ_c = ' + B.phic + ' (held before the import); the input still shows ' + B.field);
await rw.evaluate(() => { const el = document.getElementById('Hs'); el.value = String(+el.value - 1); el.dispatchEvent(new Event('change', { bubbles: true })); onInputChange(); });
await rw.waitForTimeout(500);
const C = await rw.evaluate(() => ({ st: _R.pxr && _R.pxr.status, Rn: _R.inp.fnd.Rn }));
check(C.st === 'current' && Math.abs(C.Rn - A.Rn) < 1e-9, 'stem height back: CURRENT, imported R_n used again');
check(!o.errs.length, 'Retaining Wall Designer: no console errors ' + JSON.stringify(o.errs.slice(0, 3)));
await o.b.close();
console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0);
