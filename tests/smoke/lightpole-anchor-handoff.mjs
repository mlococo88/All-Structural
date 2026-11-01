#!/usr/bin/env node
// Light Pole and Sign Post → BasePlateAnchorDesigner, anchorGroup hand-off (HANDOFF.md §4.11; added 2026-11-01).
// Headless Chromium, one browser context (one file:// localStorage): the Light Pole page sends ("Send anchors to the Anchorage
// app"), the Base Plate page pulls ("Pull from Light Pole" → Import, every group), computes, and its result payload is read.
// Cases: default pole (1 group), two-post sign (2 groups), monopost sign. Checks: the payload passes BP's own check() with no
// error; BP imports every group with every combination; BP's combination 1 equals the Light Pole numbers converted by the
// lightPole-v1 rule (P = −P_LP, M_y = M_x,LP, M_x = −M_y,LP, kip / kip-in); the anchor pattern and plate arrive; the result
// payload has a finite governing D/C per group and echoes the inputsHash. Also: the JSON file fallback downloads the same payload;
// the result (§4.12) published by BP shows on the Light Pole Summary and Anchors card as 'ok', and as 'stale' after an input change.
//   node tests/smoke/lightpole-anchor-handoff.mjs
import fs from 'fs';
import path from 'path';
import { openPage, REPO } from '../lib.mjs';
const LP = path.join(REPO, 'Light Pole and Sign Post.html'), BP = path.join(REPO, 'BasePlateAnchorDesigner.html');
const CASES = { pole: {}, sign2: { top: { appMode: 'sign', signPosts: 2 } }, sign1: { top: { appMode: 'sign', signPosts: 1 } } };
let fails = 0; const check = (ok, m) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${m}`); if (!ok) fails++; };
for (const [name, mut] of Object.entries(CASES)) {
  const o = await openPage(LP, { vw: 1280, vh: 900 });
  try {
    await o.p.waitForFunction(() => typeof window.applyState === 'function', null, { timeout: 15000 });
    const sent = await o.p.evaluate(m => { const st = JSON.parse(JSON.stringify(DEFAULT_STATE)); Object.assign(st, m.top || {}); applyState(st);
      document.getElementById('lpAnchSend').click();
      return { raw: localStorage.getItem('bridgeSuite.v1.anchorGroup'), status: document.getElementById('lpAnchStatus').textContent }; }, mut);
    const pay = JSON.parse(sent.raw || 'null');
    check(!!pay && pay._schema === 'bridge-anchor-group', `${name}: LP published anchorGroup (${sent.status.slice(0, 90)})`);
    const [dl] = await Promise.all([o.p.waitForEvent('download'), o.p.evaluate(() => document.getElementById('lpAnchExport').click())]);
    const fp = path.join(o.ctx._options?.downloadsPath || '/tmp', `lp-ag-${name}.json`); await dl.saveAs(fp);
    const file = JSON.parse(fs.readFileSync(fp, 'utf8'));
    check(file.inputsHash === pay.inputsHash && JSON.stringify(file.groups) === JSON.stringify(pay.groups), `${name}: JSON file fallback = the published payload (inputsHash ${pay.inputsHash})`);
    const bp = await o.ctx.newPage(); const bErr = []; bp.on('pageerror', e => bErr.push(e.message));
    await bp.goto('file://' + BP); await bp.waitForFunction(() => window.bxAg && typeof window.bxPullAnchorGroup === 'function', null, { timeout: 20000 });
    const r = await bp.evaluate(() => { const chk = bxAg.check(JSON.parse(localStorage.getItem('bridgeSuite.v1.anchorGroup')));
      window.bxPullAnchorGroup(); const all = document.getElementById('bxAgAll'); if (all) all.checked = true; document.getElementById('bxAgGo').click();
      const CCs = []; for (let i = 0; i < S.groups.length; i++) { bpGroupSwitch(i); const CC = computeAll(); CCs.push({ n: CC.combos.length, raw0: CC.combos[0].raw, nA: S.anchor.nCircle, BC: S.anchor.BC, t: S.plate.t, D: S.conc.D }); }
      bpGroupSwitch(0); const res = bxAg.resultPayload();
      return { err: chk.err, warn: chk.warn, groups: S.groups.length, CCs, res: res && res.results.map(x => ({ id: x.groupId, dcr: x.governing && x.governing.dcr, mode: x.governing && x.governing.mode, combo: x.governing && x.governing.combo })), hash: res && res.source.inputsHash }; });
    check(!r.err.length, `${name}: BP check() accepts the payload (warnings: ${r.warn.length})`);
    check(r.groups === pay.groups.length, `${name}: BP imported ${r.groups} group(s)`);
    pay.groups.forEach((g, i) => { const c = g.combos[0], b = r.CCs[i] || {}, raw = b.raw0 || {};
      const exp = { P: -c.P / 1000, My: c.Mx * 12 / 1000, Mx: -c.My * 12 / 1000 };
      const ok = b.n === g.combos.length && Math.abs(raw.P - exp.P) < 1e-9 && Math.abs(raw.My - exp.My) < 1e-9 && Math.abs(raw.Mx - exp.Mx) < 1e-9 && b.nA === g.anchor.n && Math.abs(b.BC - g.anchor.BC) < 1e-9 && Math.abs(b.t - g.base.plate.t) < 1e-9;
      check(ok, `${name} ${g.label}: ${b.n} combinations; combination 1 P ${raw.P?.toFixed(4)} kip, My ${raw.My?.toFixed(2)}, Mx ${raw.Mx?.toFixed(2)} kip-in (expected ${exp.P.toFixed(4)}, ${exp.My.toFixed(2)}, ${exp.Mx.toFixed(2)}); n ${b.nA}, BC ${b.BC}, t ${b.t}, pier ${b.D} in`); });
    check(r.res && r.res.length === pay.groups.length && r.res.every(x => isFinite(x.dcr)) && r.hash === pay.inputsHash,
      `${name}: BP result ${JSON.stringify(r.res)} (hash ${r.hash})`);
    // §4.12 result back to Light Pole: BP sends, LP shows the governing D/C (Summary + Anchors card), then "stale" after an input change
    const before = await o.p.evaluate(() => { lppAnchorCardRefresh(); return Array.from(document.querySelectorAll('#lpAnchResult .lpAgChip')).map(e => e.dataset.state); });
    await bp.evaluate(() => { const r = bxAg.resultPayload(); BridgeXfer.publish('anchorGroupResult', r, 'Base Plate & Anchor Bolt Designer', 'BasePlateAnchorDesigner.html'); });
    const after = await o.p.evaluate(() => { lppAnchorCardRefresh(); renderSummary(LPP_SUMCTX);
      return { card: Array.from(document.querySelectorAll('#lpAnchResult .lpAgChip')).map(e => [e.dataset.state, e.textContent]),
               sum: Array.from(document.querySelectorAll('#page-summary .lpAgChip')).map(e => e.dataset.state) }; });
    const stale = await o.p.evaluate(() => { const v = document.getElementById('V'); v.value = String(+v.value + 5); v.dispatchEvent(new Event('input', { bubbles: true }));
      lppAnchorCardRefresh(); return Array.from(document.querySelectorAll('#lpAnchResult .lpAgChip')).map(e => e.dataset.state); });
    check(before.every(x => x === 'none') && after.card.length === pay.groups.length && after.card.every(c => c[0] === 'ok') && after.sum.every(x => x === 'ok') && stale.every(x => x === 'stale'),
      `${name}: result chips none → ok → stale after V + 5 (${after.card.map(c => c[1].slice(0, 120)).join(' | ')})`);
    check(!bErr.length && !o.errs.length, `${name}: no page errors (LP ${o.errs.length}, BP ${bErr.length}${bErr.length ? ': ' + bErr[0] : ''})`);
  } finally { await o.b.close(); }
}
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
