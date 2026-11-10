#!/usr/bin/env node
// Abutment calculator (abutment_calculator.html): one bottom-mat level on piles (ABPM, engineer decision 2026-11-10, "Yes, same bottom mat").
//   node tests/smoke/abutment-pile-mat-level.mjs [file]   (default: abutment_calculator.html in this tree)
// 1. Hand check: the punching check (Tab 4 §4.6) uses the footing design's d and d_v (toe, Tab 5 §5.3), d_e = t_f − c_F − d_b/2,
//    h_p = t_f, on the default project switched to piles (t_f 36 in, c_F 3, e_pile 12, c_top 3, #8 toe) and on a variant
//    (t_f 42 in, e_pile 18, c_top 4).
// 2. The clear cover pile top to bottom mat (panel I-7, piles.clrTop) changes no result (kept in S, input greyed out, not flagged).
// 3. Thin footing: input error at t_f ≤ e_pile + 2 in (the clear cover no longer enters).
// 4. The pile embedment detail (sheet "joint") draws one bottom mat, at the footing cover; Tab 4 §4.6 and the Report state the basis.
// 5. No console errors.
import path from 'path';
import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '..', '..');
const { openPage } = await import(path.join(REPO, 'tests/lib.mjs'));
const FILE = path.resolve(REPO, process.argv[2] || 'abutment_calculator.html');
let fails = 0; const check = (ok, msg) => { console.log((ok ? '  ok   ' : '  FAIL ') + msg); if (!ok) fails++; };
const near = (a, b, t = 0.01) => Math.abs(a - b) <= t;
const o = await openPage(FILE, { vw: 1400, vh: 1000 }); const p = o.p;
await p.waitForFunction(() => window.LAST_R, null, { timeout: 60000 });
const run = (c) => p.evaluate((c) => { const S0 = JSON.parse(JSON.stringify(S));
  S.fnd.branch = c.branch || 'pile'; if (c.tf) S.geom.tf = c.tf; if (c.embed != null) S.piles.embed = c.embed; if (c.clr != null) S.piles.clrTop = c.clr;
  recalcAll(); const R = window.LAST_R, pu = R.checks.punching || null, t = R.checks.toeFlex;
  const out = { pu: pu && { de: pu.de, dv: pu.dv, hP: pu.hP, b0: pu.b0, Vn: pu.Vn, Vu: pu.Vu, dc: pu.dc, pile: pu.pile }, toe: { d: t.d, dv: t.dv },
    thin: !!pileCapThin(), json: JSON.stringify(R, (k, v) => ['clrTop', 'clrP', 'fingerprint'].includes(k) ? undefined : typeof v === 'number' && !isFinite(v) ? String(v) : v) };   // the echoed input and the Input ID (every input is part of it) excluded
  Object.keys(S).forEach(k => delete S[k]); Object.assign(S, S0); recalcAll(); return out; }, c);

console.log('1. Hand check');
const d0 = await run({});
check(d0.pu && near(d0.pu.de, 32.5) && near(d0.pu.hP, 36) && near(d0.pu.dv, 29.25) && near(d0.pu.de, d0.toe.d, 1e-9) && near(d0.pu.dv, d0.toe.dv, 1e-9),
  `default on piles: d_e = 36 − 3 − 1.0/2 = 32.50 in (= toe d), h_p = 36, d_v = max(29.25, 25.92) = 29.25 in (= toe d_v): ${JSON.stringify(d0.pu)}`);
check(near(d0.pu.b0, 165, 0.01) && near(d0.pu.Vn, 1216.215, 0.01) && near(0.9 * d0.pu.Vn, 1094.59, 0.01) && near(d0.pu.Vu, 200.97, 0.01) && near(d0.pu.dc, 0.1836, 0.0001),
  `default: b_0 = 4(12 + 29.25) = 165.0 in, V_n = 0.126·√4·165·29.25 = 1216.22 kip, φV_n = 1094.59, V_u 200.97, D/C 0.184 (was 0.410)`);
const d1 = await run({ tf: 3.5, embed: 18, clr: 4 });
check(d1.pu && near(d1.pu.de, 38.5) && near(d1.pu.hP, 42) && near(d1.pu.dv, 34.65) && near(d1.pu.b0, 186.6) && near(d1.pu.Vn, 1629.354, 0.01) && near(d1.pu.dc, 0.1424, 0.0001) && d1.pu.pile === 2,
  `variant t_f 42, e 18, c_top 4: d_e 38.50, d_v 34.65, b_0 186.6, V_n 1629.35 kip, D/C 0.142 at pile 2 (was 0.455, pile 1): ${JSON.stringify(d1.pu)}`);

console.log('2. The clear cover of panel I-7 changes no result');
for (const [nm, a, b] of [['pile default', { clr: 3 }, { clr: 7.5 }], ['pile variant', { tf: 3.5, embed: 18, clr: 4 }, { tf: 3.5, embed: 18, clr: 0 }], ['spread', { branch: 'spread', clr: 3 }, { branch: 'spread', clr: 9 }]]) {
  const ra = await run(a), rb = await run(b); check(ra.json === rb.json, `${nm}: LAST_R identical for c_top ${a.clr} and ${b.clr} (apart from the echoed c_top and the Input ID)`); }
const inp = await p.evaluate(() => { const S0 = JSON.stringify(S); S.fnd.branch = 'pile'; S.piles.clrTop = 40; buildInputs(); recalcAll();
  const el = document.querySelector('#inputCol input[data-path="piles.clrTop"]'); const r = { dis: el && el.disabled, bad: el && (el.classList.contains('bad') || el.classList.contains('warnf')), val: S.piles.clrTop,
    err: [...document.querySelectorAll('.warn-item')].some(e => /clear cover from the pile top/i.test(e.textContent)) };
  Object.keys(S).forEach(k => delete S[k]); Object.assign(S, JSON.parse(S0)); buildInputs(); recalcAll(); return r; });
check(inp.dis && !inp.bad && inp.val === 40 && !inp.err, `the input is greyed out, a saved value (40 in, outside 0–12) is kept and not flagged: ${JSON.stringify(inp)}`);

console.log('3. Thin footing');
const t1 = await run({ tf: 14.5 / 12 }), t2 = await run({ tf: 13.9 / 12 });
check(!t1.thin && t2.thin, `t_f 14.5 in > 12 + 2: no input error; t_f 13.9 in: input error (was at t_f ≤ 17 in with c_top 3)`);

console.log('4. Drawing and notes');
const dw = await p.evaluate(async () => { const S0 = JSON.stringify(S); S.fnd.branch = 'pile'; recalcAll(); activateTab('tab-dwg'); await new Promise(r => setTimeout(r, 800));
  const B = ABDW.B, s = B.S.find(x => x.id === 'joint'); const E = s ? B.D.E.slice(s.i0, s.iC) : [];
  const txt = E.map(e => e.s || '').join(' | '), all = B.D.E.map(e => e.s || '').join(' | ');
  activateTab('tab-found'); await new Promise(r => setTimeout(r, 300)); const pun = (document.querySelector('[data-cid="o-punch"]') || {}).textContent || '';
  Object.keys(S).forEach(k => delete S[k]); Object.assign(S, JSON.parse(S0)); recalcAll(); activateTab('tab-loads');
  return { has: !!s, one: /BOTTOM AT THE FOOTING COVER \(PANEL I-2\)/.test(txt), old: /CLEAR DISTANCE/.test(txt), note: /ONE BOTTOM MAT AT THE FOOTING COVER/.test(all), pun: /engineer decision 2026-11-10/.test(pun) && /not used/.test(pun) }; });
check(dw.has && dw.one && !dw.old && dw.note && dw.pun, `sheet "joint": the bottom mat labelled at the footing cover, no "clear distance" mat; Tab 4 §4.6 states the basis: ${JSON.stringify(dw)}`);
await p.evaluate(() => { S.fnd.branch = 'pile'; recalcAll(); buildInputs(); });
const rep = await p.evaluate(async () => { abrShow(); await new Promise(r => setTimeout(r, 2500)); const t = document.body.textContent;
  return { basis: /Punching depth basis \(engineer decision 2026-11-10\)/.test(t), de: /Effective depth to the bottom mat of the footing design/.test(t), inp: /not used: one bottom mat at c_F, see §4\.6/.test(t) }; });
check(rep.basis && rep.de && rep.inp, `Report: the punching depth basis note, the worked d_e and the input echo (${JSON.stringify(rep)})`);

check(!o.errs.length, `console errors: ${o.errs.length} ${JSON.stringify(o.errs.slice(0, 3))}`);
await o.b.close();
console.log(fails ? `\n${fails} FAILED` : '\nall ok'); process.exit(fails ? 1 : 0);
