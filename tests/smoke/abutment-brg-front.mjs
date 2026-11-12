#!/usr/bin/env node
// Abutment calculator (abutment_calculator.html): CL bearing entered from the front face of the stem, a_f = geom.brgFront
// (ABBF2, engineer request 2026-11-10). Input-definition change only: identical geometry gives identical results.
//   node tests/smoke/abutment-brg-front.mjs [--a <git ref, default origin/main>]
// 1. Main (A) vs this tree (B) over 7 cases (default; backwall offset e = 10 in with d_sh; the engineer's case a_bw = −4.0 in;
//    semi-integral; integral; CTDOT with odd dimensions; RIDOT pile footing with e = 6 in):
//    (a) as a saved project without geom.brgFront (a_f derived = t_st − t_bw − setback): LAST_R, warnings (apart from the reworded
//        messages listed in RENAMED_MSG) and the Input ID identical;
//    (b) a_f entered = t_st − t_bw − setback: every number within 1e-9, the same Input ID;
//    (c) the rendered tab text and the Report text: every changed line is printed (new note text only).
// 2. Regression: an old project (no brgFront) saved and loaded gives the same Input ID and results; entering a_f gives
//    x_brg = x_stem,top,front + a_f and the setback t_st − t_bw − a_f; a_f stays when t_st changes; a writer of brgSetback moves a_f.
// 3. Panel I-1 shows a_f (no setback input), the derived setback and a_bw; input error text; CTDOT brg.front; DXF sheet 1 "(A_F)" dim;
//    Tab 1 §1.1 and the Report work a_f; no console errors; no horizontal scroll at 390 px.
import fs from 'fs';
import os from 'os';
import path from 'path';
import vm from 'vm';
import { execFileSync } from 'child_process';
import { openPage, REPO, diff } from '../lib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const REF = arg('a', 'origin/main');
const sha = execFileSync('git', ['-C', REPO, 'rev-parse', '--short', REF], { encoding: 'utf8' }).trim();
const ADIR = path.join(os.tmpdir(), 'allstruct-tests', 'tree-' + sha);
if (!fs.existsSync(path.join(ADIR, '.done'))) { fs.mkdirSync(ADIR, { recursive: true }); execFileSync('sh', ['-c', `git -C "${REPO}" archive ${sha} | tar -x -C "${ADIR}"`]); fs.writeFileSync(path.join(ADIR, '.done'), sha); }
const FA = path.join(ADIR, 'abutment_calculator.html'), FB = path.join(REPO, 'abutment_calculator.html');
const dctx = { window: {} }; vm.createContext(dctx); vm.runInContext(fs.readFileSync(path.join(REPO, 'shared/dxf.js'), 'utf8'), dctx);

let fails = 0; const check = (ok, m) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${m}`); if (!ok) fails++; };
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const ready = p => p.waitForFunction(() => window.LAST_R, null, { timeout: 60000 });

const CASES = {
  default: () => {},
  offsetShelf: () => { S.apSlab.on = true; S.apSlab.t = 0.75; S.geom.tbw = 2; S.geom.tst = 5.5; S.geom.tsb = 5.5; S.geom.bwOff = 10; S.geom.shD = 9; },
  engineerAbwMinus4: () => { S.apSlab.on = true; S.geom.bwOff = 19; S.geom.shD = 9; },   // a_bw = 15 − 19 = −4.0 in (input error)
  semi: () => { S.iab.type = 'semi'; S.iab.dg = 4.0; S.apSlab.on = true; },   // ABDG (2026-11-12): as saved before (new projects have iab.dg null)
  integral: () => { S.iab.type = 'integral'; S.iab.dg = 4.0; S.apSlab.on = true; },
  ctdotOdd: () => { S.own.owner = 'CTDOT'; S.geom.tst = 4.25; S.geom.tsb = 4.6; S.geom.tbw = 1.35; S.geom.brgSetback = 1.1; },
  ridotPileOffset: () => { S.own.owner = 'RIDOT'; S.fnd.branch = 'pile'; S.apSlab.on = true; S.geom.bwOff = 6; S.geom.shD = 0; },
};
// warning texts reworded by ABBF2 (the numbers in them are unchanged): main pattern → branch pattern
const RENAMED_MSG = [[/a_bw = setback − e = /, /a_bw = t_st − t_bw − e − a_f = /], [/bearing pad runs into the inset backwall: a_bw − L_pad\/2 = \(/, /bearing pad runs into the inset backwall: a_bw − L_pad\/2 = \(/],
  [/^warn:Check input — Bearing setback outside/, /^warn:Check input — Bearing setback from the backwall face/], [/Check setback\/seat geometry/, /Check a_f/]];

async function snapAll(file, mode) {
  const o = await openPage(file, { vw: 1400, vh: 1000 }); await ready(o.p);
  const out = {};
  for (const [nm, su] of Object.entries(CASES)) {
    out[nm] = await o.p.evaluate(async ([su0, mode]) => { const st = JSON.parse(JSON.stringify(S));
      try { eval('(' + su0 + ')')();
        if (mode === 'old') delete S.geom.brgFront;   // a saved project of main: no a_f
        if (mode === 'entered') S.geom.brgFront = (+S.geom.tst) - (+S.geom.tbw) - (+S.geom.brgSetback);
        migrate(); buildInputs(); recalcAll();
        const txt = [...document.querySelectorAll('#tabpages .tabpage:not(#tab-rpt):not(#tab-dwg)')].map(t => t.textContent).join('\n');
        abrShow(); await new Promise(r => setTimeout(r, 1500)); const rpt = document.getElementById('tab-rpt').textContent;
        return { R: JSON.parse(JSON.stringify(window.LAST_R, (k, v) => typeof v === 'number' && !isFinite(v) ? String(v) : v)), W: WARNINGS.map(w => w.level + ':' + w.msg), fp: window.LAST_R.fingerprint, txt, rpt,
          af: S.geom.brgFront, sb: S.geom.brgSetback };
      } finally { Object.keys(S).forEach(k => delete S[k]); Object.assign(S, st); buildTabs(); migrate(); recalcAll(); } }, [su.toString(), mode]);
  }
  const errs = o.errs.slice(); await o.b.close(); return { out, errs };
}
const lines = t => t.replace(/\s+/g, ' ').split(/(?<=[.:;])\s|(?=§\d)/).map(s => s.trim()).filter(s => s && !/Printed |Saved |ago\b/.test(s));
function textDiff(a, b) { const A = new Map(), B = new Map(); lines(a).forEach(l => A.set(l, (A.get(l) || 0) + 1)); lines(b).forEach(l => B.set(l, (B.get(l) || 0) + 1));
  const only = (X, Y) => [...X.keys()].filter(l => (X.get(l) || 0) > (Y.get(l) || 0)); return { gone: only(A, B), added: only(B, A) }; }

console.log(`1. Main (${REF} ${sha}) vs this tree: identical geometry, identical results`);
{ const [a, b, c] = await Promise.all([snapAll(FA, 'old'), snapAll(FB, 'old'), snapAll(FB, 'entered')]);
  for (const nm of Object.keys(CASES)) { const x = a.out[nm], y = b.out[nm], z = c.out[nm];
    // the owner check rows quote a_f now (ABBF2): their display strings .val / .tex change, nothing else
    // AB-1 (2026-11-12): the BR vertical couple (R.brCouple, its REVIEW warning while the elevation inputs are blank) is new; tests/smoke/abutment-br-couple.mjs
    const TXT = /^\.own\.rows\[\d+\]\.(val|tex)$/, dAll = diff(x.R, y.R).filter(d => !/^\.brCouple/.test(d[0])), dR = dAll.filter(d => !TXT.test(d[0]));
    dAll.filter(d => TXT.test(d[0])).forEach(d => console.log(`       owner row text ${d[0]}:\n         − ${String(d[1]).slice(0, 200)}\n         + ${String(d[2]).slice(0, 200)}`));
    const wA = x.W.slice(), wB = y.W.filter(m => !/Braking vertical couple/.test(m)); let ren = 0;
    const rw = []; const wOK = wA.length === wB.length && wA.every((m, i) => m === wB[i] || (RENAMED_MSG.some(([p, q]) => p.test(m) && q.test(wB[i])) && rw.push([m, wB[i]]))); ren = rw.length;
    rw.forEach(([m, n]) => console.log('       reworded warning:\n         − ' + m.slice(0, 300) + '\n         + ' + n.slice(0, 300)));
    check(!dR.length && wOK && x.fp === y.fp, `${nm} (saved without a_f → a_f = ${y.af}): LAST_R ${dR.length ? dR.length + ' diffs ' + JSON.stringify(dR.slice(0, 2)) : 'identical'} (${JSON.stringify(y.R).length} chars), warnings ${wOK ? 'same' + (ren ? ` (${ren} reworded, same values)` : '') : 'DIFF ' + JSON.stringify([wA, wB]).slice(0, 400)}, Input ID ${x.fp} / ${y.fp}`);
    let bad = []; (function walk(p, q, k) { if (/^R\.own\.rows\.\d+\.(val|tex)$/.test(k)) return; if (typeof p === 'number' && typeof q === 'number') { if (!near(p, q)) bad.push(k + ': ' + p + ' / ' + q); } else if (p && typeof p === 'object' && q && typeof q === 'object') { for (const j of Object.keys(p)) walk(p[j], q[j], k + '.' + j); } else if (p !== q) bad.push(k + ': ' + JSON.stringify(p).slice(0, 60) + ' / ' + JSON.stringify(q).slice(0, 60)); })(x.R, z.R, 'R');
    check(!bad.length && x.fp === z.fp, `${nm} (a_f entered = ${z.af}, setback ${z.sb}): every number within 1e-9 (${bad.length} diffs ${bad.slice(0, 2).join(' | ')}), Input ID ${z.fp}`);
    for (const [k, lab] of [['txt', 'tabs'], ['rpt', 'Report']]) { const d = textDiff(x[k], y[k]);
      console.log(`       ${lab} text: ${d.gone.length} line(s) of main changed, ${d.added.length} new/changed in this tree`);
      d.gone.forEach(l => console.log('         − ' + l.slice(0, 260))); d.added.forEach(l => console.log('         + ' + l.slice(0, 260))); } }
  check(!b.errs.length && !c.errs.length, `console errors (B): ${b.errs.length + c.errs.length} ${b.errs.concat(c.errs).slice(0, 2).join(' | ')}`); }

console.log('2. Saved data and the a_f input');
{ const o = await openPage(FB, { vw: 1400, vh: 1000 }), p = o.p; await ready(p);
  const r = await p.evaluate(async () => {
    const R0 = JSON.stringify(window.LAST_R), fp0 = window.LAST_R.fingerprint;
    // old project (main's format: no brgFront) through the project-load path
    const j = JSON.parse(JSON.stringify(S)); delete j.geom.brgFront; S = abutMergeState(j); migrate(); recalcAll();
    const load = { af: S.geom.brgFront, sb: S.geom.brgSetback, fp: window.LAST_R.fingerprint, same: JSON.stringify(window.LAST_R) === R0, saved: JSON.parse(JSON.stringify(S)).geom.brgFront };
    buildInputs(); const inp = document.querySelector('#inputCol input[data-path="geom.brgFront"]'), oldInp = document.querySelector('#inputCol input[data-path="geom.brgSetback"]');
    const panel = { has: !!inp, val: inp && inp.value, old: !!oldInp, label: inp && inp.closest('.in-row') && inp.closest('.in-row').textContent.trim().slice(0, 80),
      der: (document.getElementById('abBrgDer') || {}).textContent || '' };
    // the engineer enters a_f = 2.00 ft
    inp.value = '2'; inp.dispatchEvent(new Event('input', { bubbles: true })); recalcAll();
    const g = S.geom, G = window.LAST_R.geo;
    const ent = { xBrg: G.xBrg, xTF: G.xStemTopFront, sb: g.brgSetback, af: g.brgFront, der: document.getElementById('abBrgDer').textContent, ct: null };
    // t_st 4.50 → 5.00: a_f stays, the setback follows
    const ti = document.querySelector('#inputCol input[data-path="geom.tst"]'); ti.value = '5'; ti.dispatchEvent(new Event('input', { bubbles: true })); recalcAll();
    const tst = { xBrg: window.LAST_R.geo.xBrg, xTF: window.LAST_R.geo.xStemTopFront, sb: S.geom.brgSetback, af: S.geom.brgFront };
    // a writer of brgSetback only (a hand-off on the same geom object): a_f follows
    S.geom.brgSetback = 1.5; recalcAll(); const wr = { af: S.geom.brgFront, sb: S.geom.brgSetback, xBrg: window.LAST_R.geo.xBrg, xTF: window.LAST_R.geo.xStemTopFront };
    return { fp0, load, panel, ent, tst, wr };
  });
  check(r.load.af === 1.75 && r.load.sb === 1.25 && r.load.same && r.load.fp === r.fp0 && r.load.saved === 1.75, `old project without brgFront: a_f derived = 4.50 − 1.50 − 1.25 = ${r.load.af} ft, setback kept ${r.load.sb}, results identical ${r.load.same}, Input ID ${r.load.fp} (= ${r.fp0}); saved again with brgFront ${r.load.saved}`);
  check(r.panel.has && !r.panel.old && r.panel.val === '1.75' && /front face of stem/.test(r.panel.label) && /a_?brg = t_?st − t_?bw − a_?f = 4\.50 − 1\.50 − 1\.75 = 1\.25 ft/.test(r.panel.der.replace(/ /g, ' ')) && /15\.0 in/.test(r.panel.der),
    `panel I-1: a_f input ${r.panel.val} ft (no setback input), derived: ${r.panel.der.slice(0, 160)}`);
  // hand check: x_stem,back = L_toe + t_sb; x_stem,top,front = x_stem,back − t_st; x_brg = x_stem,top,front + a_f
  check(near(r.ent.xBrg, r.ent.xTF + 2) && near(r.ent.sb, 1.0) && r.ent.af === 2, `a_f = 2.00 ft: x_brg = ${r.ent.xTF.toFixed(3)} + 2.00 = ${r.ent.xBrg.toFixed(3)} ft, setback 4.50 − 1.50 − 2.00 = ${r.ent.sb}`);
  check(near(r.tst.xBrg, r.tst.xTF + 2) && near(r.tst.sb, 1.5) && r.tst.af === 2, `t_st = 5.00: a_f stays 2.00, x_brg = ${r.tst.xTF.toFixed(3)} + 2.00 = ${r.tst.xBrg.toFixed(3)}, setback 5.00 − 1.50 − 2.00 = ${r.tst.sb}`);
  check(near(r.wr.af, 2.0) && r.wr.sb === 1.5, `writer sets the setback 1.50 (= current): a_f ${r.wr.af}`);
  const r2 = await p.evaluate(() => { S.geom.brgSetback = 0.75; recalcAll(); return { af: S.geom.brgFront, xBrg: window.LAST_R.geo.xBrg, xTF: window.LAST_R.geo.xStemTopFront }; });
  check(near(r2.af, 2.75) && near(r2.xBrg, r2.xTF + 2.75), `writer sets the setback 0.75 ft only: a_f follows = 5.00 − 1.50 − 0.75 = ${r2.af}, x_brg = x_stem,top,front + a_f`);
  check(!o.errs.length, `console errors: ${o.errs.length} ${o.errs.slice(0, 2).join(' | ')}`);
  await o.b.close(); }

console.log('3. Checks, drawings, Tab 1, Report, 390 px');
{ const o = await openPage(FB, { vw: 1400, vh: 1000 }), p = o.p; await ready(p);
  const e = await p.evaluate(() => { S.apSlab.on = true; S.geom.bwOff = 19; S.geom.shD = 9; migrate(); recalcAll(); return WARNINGS.filter(w => w.level === 'err').map(w => w.msg); });
  check(e.some(m => /a_bw = t_st − t_bw − e − a_f = 54\.0 − 18\.0 − 19\.0 − 21\.0 = -4\.0 in/.test(m.replace(/−4/, '-4'))), `engineer's case e = 19 in: input error in terms of a_f (${(e.find(m => /a_bw/.test(m)) || '').slice(0, 170)})`);
  const c = await p.evaluate(() => { S.geom.bwOff = 0; S.geom.shD = 0; S.apSlab.on = false; S.own.owner = 'CTDOT'; S.geom.brgFront = 1.0; migrate(); buildTabs(); activateTab('tab-loads'); recalcAll(); const t = document.getElementById('tab-loads').textContent;
    const R = window.LAST_R, B = abdwBuild(R), dxf = B.D.toDXF({ ltscale: 1 }), sh = B.S.find(x => x.id === 'sec');
    const txt = B.D.E.slice(sh.i0, sh.iC).filter(q => /TEXT|DIM/.test(q.t) || q.s).map(q => q.s || q.txt || '').join('|');
    const ow = (R.own.rows || []).find(q => q.r && q.r.id === 'brg.front');
    return { ct: !!ow && ow.st === 'fail' && /^a<sub>f<\/sub> = 1\.00 ft \(panel I-1\)$/.test(ow.val) && /a_\{f\} = 1\.00/.test(ow.tex) && /≥ 1\.25 ft/.test(ow.lim) && /front face of the stem to the centerline of bearings/.test(t),
      work: /x_\{brg\} = x_\{stem,top,front\} \+ a_\{f\}/.test(document.getElementById('tab-loads').innerHTML), dxfAF: /\(A_F\)/.test(dxf), cl: /CL BRG\./.test(dxf), svg: /a_f=1\.00'/.test(document.getElementById('xsecSvg').textContent) }; });
  check(c.ct, 'CTDOT V2 11.6.8.1CT brg.front: a_f = 1.00 ft (panel I-1) < 1.25 ft → fail, value quoted as a_f');
  check(c.work && c.svg, `Tab 1 §1.1: x_brg = x_stem,top,front + a_f worked (${c.work}); the section figure dimensions a_f (${c.svg})`);
  check(c.dxfAF && c.cl, `DXF: front face of stem to CL BRG. dimension labelled (A_F) ${c.dxfAF}, CL BRG. ${c.cl}`);
  const rr = await p.evaluate(async () => { abrShow(); await new Promise(r => setTimeout(r, 2500)); const t = document.getElementById('tab-rpt').textContent;
    return { af: /CL bearing from the front face of the stem \(at the seat\) a_f/.test(t), sb: /a_brg = t_st − t_bw − a_f = 4\.50 − 1\.50 − 1\.00/.test(t), basis: /Bearing line: a_f is entered/.test(t) }; });
  check(rr.af && rr.sb && rr.basis, `Report: a_f row ${rr.af}, setback worked ${rr.sb}, basis note ${rr.basis}`);
  await p.evaluate(() => activateTab('tab-loads'));
  await p.setViewportSize({ width: 390, height: 900 }); await p.waitForTimeout(500);
  const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(ov <= 0, `390 px: no horizontal scroll (${ov})`);
  check(!o.errs.length, `console errors: ${o.errs.length} ${o.errs.slice(0, 2).join(' | ')}`);
  await o.b.close(); }

console.log(fails ? `\n${fails} check(s) FAILED` : '\nall checks passed');
process.exit(fails ? 1 : 0);
