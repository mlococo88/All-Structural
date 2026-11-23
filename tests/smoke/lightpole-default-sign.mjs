#!/usr/bin/env node
// Light Pole and Sign Post: the new-project sign passes on its default inputs; wording; Report references (LPDF, 2026-11-23).
// Headless Chromium, file://, KaTeX served from tests/libs.
//   1. New project, sign mode (as the mode buttons set it): the monopost and the two-post sign have no failing check, in the IBC mode and,
//      with a Broms soil chosen, in the LRFDLTS mode; the IBC monopost's governing D/C of the member / base plate checks is within 0.60 to 0.95.
//   2. A project saved with the former defaults (panel 12 × 6 ft, clearance 10 ft, 400 lb, spacing 8 ft) opens with those values and
//      computes as before (base plate 2.416, post 1.666): only the new-project values changed.
//   3. The default pole is not affected (its inputs are not the sign's).
//   4. Wording: the combination count in the card hint, the Report caption and the Manual equals the number of combinations the code
//      evaluates; the map-ice note says "segments"; the iced-fixture steps write t_d.
//   5. LRFDLTS Report: no unresolved reference and no "§?" (fillet weld note, square-tube torsion note), 4 cases.
//   node tests/smoke/lightpole-default-sign.mjs
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

const LP = path.join(REPO, 'Light Pole and Sign Post.html');
let fails = 0; const check = (ok, m) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${m}`); if (!ok) fails++; };
const OLD = { signB: '12', signS: '6', signClr: '10', signWt: '400', signSpacing: '8' }, NEW = { signB: '8', signS: '4', signClr: '7', signWt: '200', signSpacing: '5' };

// in the page: apply the changes to a new project and read the check panel's items
const RUN = async mut => {
  const st = JSON.parse(JSON.stringify(DEFAULT_STATE));   // eslint-disable-line no-undef
  Object.assign(st.inputs, mut.inputs || {}); Object.assign(st, mut.top || {});
  applyState(st); await new Promise(r => setTimeout(r, 400));   // eslint-disable-line no-undef
  const items = lppDashItems() || [];   // eslint-disable-line no-undef
  return { err: document.getElementById('lppInErr').classList.contains('on'), inputs: captureState().inputs,   // eslint-disable-line no-undef
    items: items.map(i => ({ name: i.name, dc: i.dc, st: i.st })) };
};
const dcOf = (r, re) => { const i = r.items.find(x => re.test(x.name)); return i ? i.dc : NaN; };
const fmtDc = r => r.items.filter(i => i.dc != null).map(i => `${i.name} ${i.dc.toFixed(3)}`).join('; ');

const o = await openPage(LP, { vw: 1400, vh: 1000 });
try {
  await o.p.waitForFunction(() => typeof window.applyState === 'function' && typeof window.renderMathInElement === 'function', null, { timeout: 30000 });
  await o.p.waitForTimeout(400);

  console.log('1 · new project, sign mode');
  const def = await o.p.evaluate(() => DEFAULT_STATE.inputs);   // eslint-disable-line no-undef
  check(Object.keys(NEW).every(k => def[k] === NEW[k]), `new-project sign inputs: ${Object.keys(NEW).map(k => k + ' ' + def[k]).join(', ')}`);
  // the mode buttons, as a user switches a new project to the sign
  await o.p.click('#modeSeg button[data-v="sign"]'); await o.p.waitForTimeout(500);
  const ui = await o.p.evaluate(() => ({ mode: appMode, fails: (lppDashItems() || []).filter(i => i.st === 'fail').map(i => i.name) }));   // eslint-disable-line no-undef
  check(ui.mode === 'sign' && ui.fails.length === 0, 'mode button "Sign" on a new project: no failing check' + (ui.fails.length ? ' — ' + ui.fails.join(', ') : ''));
  const s1 = await o.p.evaluate(RUN, { top: { appMode: 'sign', signPosts: 1 } });
  const gov = Math.max(dcOf(s1, /^Base plate thickness/), dcOf(s1, /^Post combined stress/));
  check(!s1.err && s1.items.every(i => i.st !== 'fail'), 'IBC monopost: no failing check — ' + fmtDc(s1));
  check(gov >= 0.6 && gov <= 0.95, `IBC monopost: governing D/C of the post and base plate = ${gov.toFixed(3)} (0.60 to 0.95)`);
  const s2 = await o.p.evaluate(RUN, { top: { appMode: 'sign', signPosts: 2 } });
  check(!s2.err && s2.items.every(i => i.st !== 'fail'), `IBC two-post sign: no failing check (base plate ${dcOf(s2, /^Base plate thickness/).toFixed(3)}, post ${dcOf(s2, /^Post combined stress/).toFixed(3)})`);
  for (const n of [1, 2]) {
    const l = await o.p.evaluate(RUN, { inputs: { bromsSoil: 'cohesive', bromsC: '1.0' }, top: { codeMode: 'lts', appMode: 'sign', signPosts: n } });
    check(!l.err && l.items.every(i => i.st !== 'fail'), `LRFDLTS ${n === 1 ? 'monopost' : 'two-post sign'} (Broms cohesive, c = 1.0 ksf): no failing check (member ${dcOf(l, /combined forces/).toFixed(3)}, base plate ${dcOf(l, /^Base plate/).toFixed(3)}, weld ${dcOf(l, /^Base weld/).toFixed(3)})`);
  }

  console.log('2 · a project saved with the former sign defaults');
  const old = await o.p.evaluate(RUN, { inputs: OLD, top: { appMode: 'sign', signPosts: 1 } });
  check(Object.keys(OLD).every(k => old.inputs[k] === OLD[k]), 'the saved values are kept: ' + Object.keys(OLD).map(k => k + ' ' + old.inputs[k]).join(', '));
  check(Math.abs(dcOf(old, /^Base plate thickness/) - 2.416) < 5e-4 && Math.abs(dcOf(old, /^Post combined stress/) - 1.666) < 5e-4,
    `results as before: base plate ${dcOf(old, /^Base plate thickness/).toFixed(3)} (2.416), post ${dcOf(old, /^Post combined stress/).toFixed(3)} (1.666)`);

  console.log('3 · the default pole');
  const pole = await o.p.evaluate(RUN, {});
  check(!pole.err && pole.items.every(i => i.st !== 'fail') && Math.abs(dcOf(pole, /^Base plate thickness/) - 0.453) < 5e-4 && Math.abs(dcOf(pole, /^Post combined stress/) - 0.264) < 5e-4,
    `default pole unchanged: base plate ${dcOf(pole, /^Base plate thickness/).toFixed(3)} (0.453), pole ${dcOf(pole, /^Post combined stress/).toFixed(3)} (0.264)`);

  console.log('4 · wording');
  const w = await o.p.evaluate(async () => {
    lppCvSet(false, true);   // "All load combinations" (LPGD, 2026-11-23: the tool opens on "Governing combination only"); the caption read below is the "all" view's; not stored   // eslint-disable-line no-undef
    const st = JSON.parse(JSON.stringify(DEFAULT_STATE)); st.inputs.iceBasis = 'map'; applyState(st); await new Promise(r => setTimeout(r, 400));   // eslint-disable-line no-undef
    const hint = document.getElementById('comboMatrixTbl').closest('.card').querySelector('.hint').textContent;
    const ice = document.getElementById('lppLdIceWk').textContent, man = JSON.stringify(MANUAL);   // the Manual's text, every part (the tab shows one part at a time)   // eslint-disable-line no-undef
    return { n: COMBO_KEYS.length, nL: COMBO_KEYS.filter(k => COMBOS[k].fam === 'LRFD').length, nseg: NSEG, hint, rep: LPP_LAST.H.match(/Pole base demand for all (\w+) combinations/),   // eslint-disable-line no-undef
      ice: (ice.match(/the mast uses[^.]*\./) || [''])[0], tex: [...document.querySelectorAll('#lppLdIceWk annotation')].map(a => a.textContent).filter(t => /^EPA_i = |^W_\{ice\} = \\gamma/.test(t)),
      man: (man.match(/3\.3\.6 Load combination matrix[\s\S]{0,400}/) || [''])[0], val: (man.match(/All \w+ combinations correct/) || [''])[0], body: document.body.innerHTML };
  });
  const word = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  check(w.n === 11 && w.hint === `all ${word[w.n]} ASCE 7 combinations`, `card 5b hint: "${w.hint}" (${w.n} combinations in COMBOS)`);
  check(!!w.rep && w.rep[1] === word[w.n], `Report caption: "Pole base demand for all ${w.rep && w.rep[1]} combinations"`);
  check(new RegExp('^3\\.3\\.6 Load combination matrix.*' + word[w.n][0].toUpperCase() + word[w.n].slice(1) + ' combinations are evaluated, ' + word[w.nL] + ' LRFD and ' + word[w.n - w.nL] + ' ASD', 's').test(w.man) && !/Eight combinations|four non-ice/.test(w.man),
    'Manual §3.3.6: eleven combinations (six LRFD, five ASD), pole and sign; no "Eight combinations" / "four non-ice"');
  check(w.val === `All ${word[w.n]} combinations correct`, `Manual validation table: "${w.val}"`);
  check(/mid-height of each of its 10 segments/.test(w.ice) && w.nseg === 10 && !/strips/.test(w.ice), `map-ice note: "${w.ice}"`);
  check(w.tex.length >= 2 && w.tex.every(t => /2t_d|t_d\\,A_\{surf\}/.test(t)), 'iced-fixture steps 2 and 3 write t_d: ' + w.tex.map(t => t.slice(0, 44)).join(' | '));
  check(!/all ten (ASCE 7 )?combinations|All ten combinations/.test(w.body), 'no "all ten combinations" left in the page');

  console.log('5 · LRFDLTS Report references');
  const LTS = { pole: { inputs: { bromsSoil: 'cohesive', bromsC: '1.0' }, top: { codeMode: 'lts' } },
    sign1: { inputs: { bromsSoil: 'cohesive', bromsC: '1.0' }, top: { codeMode: 'lts', appMode: 'sign', signPosts: 1 } },
    signSq: { inputs: { poleShape: 'square', poleDiaTop: '8', poleTwTop: '0.25', ltsRi: '0.5', bromsSoil: 'cohesionless', bromsPhi: '30', bromsGam: '0.115' }, top: { codeMode: 'lts', appMode: 'sign', signPosts: 1 } },
    signSqNoR: { inputs: { poleShape: 'square', poleDiaTop: '8', poleTwTop: '0.25', ltsRi: '0', bromsSoil: 'cohesive', bromsC: '1.0' }, top: { codeMode: 'lts', appMode: 'sign', signPosts: 2 } } };
  for (const [name, mut] of Object.entries(LTS)) {
    const r = await o.p.evaluate(async mut => {
      const st = JSON.parse(JSON.stringify(DEFAULT_STATE)); Object.assign(st.inputs, mut.inputs || {}); Object.assign(st, mut.top || {});   // eslint-disable-line no-undef
      applyState(st); await new Promise(r => setTimeout(r, 400)); switchTab('report'); await new Promise(r => setTimeout(r, 500));   // eslint-disable-line no-undef
      const d = SharedReport.build(ltsReportModel()), host = document.getElementById('ltsRptHost');   // eslint-disable-line no-undef
      const txt = SharedReport.text(d) + '\n' + host.textContent;   // eslint-disable-line no-undef
      return { unres: d.unresolved.map(x => x.key), q: (txt.match(/§\?/g) || []).length, weld: /AISC 360-16 Section J2 with/.test(txt), h3: /AISC 360-16 Section H3\.1/.test(txt), sq: st.inputs.poleShape === 'square', len: host.textContent.length };
    }, mut);
    check(r.len > 2000 && r.unres.length === 0 && r.q === 0 && r.weld && (!r.sq || r.h3), `${name}: every Report reference resolves, no "§?"${r.unres.length ? ' — unresolved: ' + r.unres.join(', ') : ''}; the weld note cites "AISC 360-16 Section J2"${r.sq ? ', the torsion note "Section H3.1"' : ''}`);
  }
  check(o.errs.length === 0, 'no console / page errors' + (o.errs.length ? ': ' + o.errs.join(' | ') : ''));
} finally { await o.b.close(); }
console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL PASS');
process.exit(fails ? 1 : 0);
