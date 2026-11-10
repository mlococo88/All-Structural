#!/usr/bin/env node
// Abutment calculator (abutment_calculator.html): one bottom-mat level on piles (ABPM, engineer decision 2026-11-10, "Yes, same bottom mat").
//   node tests/smoke/abutment-pile-mat-level.mjs [file]   (default: abutment_calculator.html in this tree)
// ABPH (2026-11-10, engineer decision correcting ABPM #1375): punching credits only the concrete above the pile head.
// 1. Hand check: Tab 4 §4.6, h_p = t_f − e_pile; mat below the pile head: d_v = 0.72h_p; mat at or above it: d_v = max(0.9·toe d, 0.72h_p).
//    Default switched to piles (t_f 36 in, c_F 3, e_pile 12, c_top 3, #8 toe), variant (t_f 42 in, e_pile 18, c_top 4), t_f 18 in,
//    and e_pile 0. The toe d stays on the mat at c_F (ABPM).
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

console.log('1. Hand check (ABPH, 2026-11-10: punching on the concrete above the pile head; the toe keeps the mat at c_F)');
const d0 = await run({});
check(d0.pu && d0.pu.de === null && near(d0.pu.hP, 24) && near(d0.pu.dv, 17.28) && near(d0.toe.d, 32.5),
  `default on piles: h_p = 36 − 12 = 24.0 in, mat below the pile head (no d_e), d_v = 0.72·24 = 17.28 in; toe d stays 32.50: ${JSON.stringify(d0.pu)}`);
check(near(d0.pu.b0, 117.12, 0.01) && near(d0.pu.Vn, 510.006, 0.01) && near(0.9 * d0.pu.Vn, 459.005, 0.01) && near(d0.pu.Vu, 200.97, 0.01) && near(d0.pu.dc, 0.4378, 0.0001),
  `default: b_0 = 4(12 + 17.28) = 117.12 in, V_n = 0.126·√4·117.12·17.28 = 510.01 kip, φV_n = 459.01, V_u 200.97, D/C 0.438 (pre-#1375 0.410, #1375 0.184)`);
const d1 = await run({ tf: 3.5, embed: 18, clr: 4 });
check(d1.pu && d1.pu.de === null && near(d1.pu.hP, 24) && near(d1.pu.dv, 17.28) && near(d1.pu.b0, 117.12) && near(d1.pu.Vn, 510.006, 0.01) && near(d1.pu.dc, 0.4549, 0.0001) && d1.pu.pile === 1,
  `variant t_f 42, e 18, c_top 4: h_p 24, d_v 17.28, b_0 117.12, V_n 510.01 kip, D/C 0.455 at pile 1 (pre-#1375 the same; #1375 0.142): ${JSON.stringify(d1.pu)}`);
const d2 = await run({ tf: 1.5 });
check(d2.pu && near(d2.pu.hP, 6) && near(d2.pu.dv, 4.32) && near(d2.pu.b0, 65.28) && near(d2.pu.Vn, 71.066, 0.01) && near(d2.pu.dc, 2.7957, 0.0005),
  `t_f 18 in: h_p 6, d_v 4.32, b_0 65.28, V_n 71.07 kip, D/C 2.80 FAIL (pre-#1375 2.80; #1375 0.60): ${JSON.stringify(d2.pu)}`);
const d3 = await run({ embed: 0, clr: 2.5 });
check(d3.pu && near(d3.pu.hP, 36) && near(d3.pu.de, 32.5) && near(d3.pu.dv, 29.25) && near(d3.pu.dc, 0.1836, 0.0001),
  `pile head at the footing bottom (e 0, mat above it): d_e = toe d 32.50, d_v = max(29.25, 25.92) = 29.25, D/C 0.184 (all three versions): ${JSON.stringify(d3.pu)}`);

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
check(!t1.thin && t2.thin, `t_f 14.5 in: h_p 2.5 > 2 in, no input error; t_f 13.9 in: input error (pre-#1375 at t_f ≤ 17 in with c_top 3)`);

console.log('4. Drawing and notes');
const dw = await p.evaluate(async () => { const S0 = JSON.stringify(S); S.fnd.branch = 'pile'; recalcAll(); activateTab('tab-dwg'); await new Promise(r => setTimeout(r, 800));
  const B = ABDW.B, s = B.S.find(x => x.id === 'joint'); const E = s ? B.D.E.slice(s.i0, s.iC) : [];
  const txt = E.map(e => e.s || '').join(' | '), all = B.D.E.map(e => e.s || '').join(' | ');
  activateTab('tab-found'); await new Promise(r => setTimeout(r, 300)); const pun = (document.querySelector('[data-cid="o-punch"]') || {}).textContent || '';
  Object.keys(S).forEach(k => delete S[k]); Object.assign(S, JSON.parse(S0)); recalcAll(); activateTab('tab-loads');
  return { has: !!s, one: /BOTTOM AT THE FOOTING COVER \(PANEL I-2\)/.test(txt), old: /CLEAR DISTANCE/.test(txt), note: /ONE BOTTOM MAT AT THE FOOTING COVER/.test(all) && /PUNCHING \(TAB 4 4\.6\) CREDITS ONLY THE CONCRETE ABOVE THE PILE HEAD/.test(all), hp: /H_P/.test(txt), pun: /punching cone starts at its top/.test(pun) && /not used/.test(pun) }; });
check(dw.has && dw.one && !dw.old && dw.note && dw.hp && dw.pun, `sheet "joint": the bottom mat labelled at the footing cover, no "clear distance" mat; Tab 4 §4.6 states the basis: ${JSON.stringify(dw)}`);
await p.evaluate(() => { S.fnd.branch = 'pile'; recalcAll(); buildInputs(); });
const rep = await p.evaluate(async () => { abrShow(); await new Promise(r => setTimeout(r, 2500)); const t = document.body.textContent;
  return { basis: /Punching depth basis \(engineer decision 2026-11-10\)/.test(t), de: /Concrete above the pile head/.test(t) && /the floor of 5\.7\.2\.8/.test(t), inp: /not used: no mat over the pile heads, see §4\.6/.test(t) }; });
check(rep.basis && rep.de && rep.inp, `Report: the punching depth basis note, the worked d_e and the input echo (${JSON.stringify(rep)})`);

check(!o.errs.length, `console errors: ${o.errs.length} ${JSON.stringify(o.errs.slice(0, 3))}`);
await o.b.close();
console.log(fails ? `\n${fails} FAILED` : '\nall ok'); process.exit(fails ? 1 : 0);
