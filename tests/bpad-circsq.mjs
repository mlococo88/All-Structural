#!/usr/bin/env node
// Base Plate & Anchor Designer: circular pier modelled as an equivalent square (BCSQ, engineer request 2026-11-18).
//   node tests/bpad-circsq.mjs                         origin/main vs working tree + hand checks (working tree)
//   node tests/bpad-circsq.mjs --a <ref|file> --b <file> --out <dir> [--shots <dir>]
// 1. saved data: round-pier saves WITHOUT conc.circModel (every save before BCSQ) give the same computed results
//    (computeAll, comboCapacities, allChecks, validation) on origin/main and on the working tree, and on the working
//    tree the same results as conc.circModel = "exact".
// 2. hand checks on the working tree: D = 36 in pier, 4 anchors on a 12 in square centred, h_ef = 12 in, uplift 40 kip,
//    V_x = 10 kip: exact circle, chord square and inscribed square — c_a, h_ef, A_Nc, A_Nco, ψ_ed,N, N_b, N_cbg, φN_cbg
//    against values worked here independently of the tool; shear c_a1 of Case 1 / Case 2.
// 3. per-direction chord squares (plate offset x = +3 in): s_d of each edge, shear toward +x and toward −x on their own
//    square, the tension checks on the smallest.
// 4. the Input & Schematics card (figure + comparison) renders, leaves S and CC as they were, its worked lines typeset,
//    and the Report contains the card; an anchor outside the square is blocked.
// One browser at a time. Exit code 0 when every check passes.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { openPage, resolveFile, REPO, HERE } from './lib.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) { if (!av[i].startsWith('--')) continue; const k = av[i].slice(2); args[k] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true; }
const FILE = 'BasePlateAnchorDesigner.html';
const A = resolveFile(args.a || 'origin/main', FILE), B = resolveFile(args.b || FILE, FILE);
for (const src of [A]) { const ref = args.a || 'origin/main';
  if (!fs.existsSync(path.join(path.dirname(src.file), 'shared', 'report.js')) && !/\.html$/.test(ref))
    execFileSync('sh', ['-c', `git -C "${REPO}" archive "${ref}" shared | tar -x -C "${path.dirname(src.file)}"`]); }
const OUT = args.out || path.join(os.tmpdir(), 'allstruct-tests', 'bpad-circsq'); fs.mkdirSync(OUT, { recursive: true });
let fail = false;
const ready = p => p.waitForFunction(() => typeof S !== 'undefined' && typeof computeAll === 'function' && document.getElementById('tabBar') && document.getElementById('tabBar').children.length > 0, null, { timeout: 60000 });

/* page-side builder of the hand case (runs in the page). m: conc.circModel, or null = a save without the field */
const BUILD = `(function(o){
  const s=defaultState(); s.plate.B=18; s.plate.N=18; s.plate.t=1.5; s.anchor.dia=1; s.anchor.grade='f1554_55'; s.anchor.hef=o.hef||12;
  s.anchor.nx=2; s.anchor.ny=2; s.anchor.edx=3; s.anchor.edy=3; s.anchor.head='hvyhexhead'; s.anchor.torqued=false;
  s.conc.fc=4; s.conc.shape='circle'; s.conc.D=36; s.conc.Bx=36; s.conc.By=36; s.conc.H=60; s.conc.cracked=true; s.grout.present=false;
  s.forceModel.method='elastic'; s.conc.plate_off_x=o.ox||0; s.conc.plate_off_y=o.oy||0;
  if(o.hefMode!==undefined) s.conc.circHefReduce=o.hefMode;
  if(o.m) s.conc.circModel=o.m; else delete s.conc.circModel;
  s.combos=o.combos||[{name:'U',P:40,Vx:10,Vy:0,Mx:0,My:0},{name:'M',P:-5,Vx:0,Vy:-6,Mx:480,My:0}];
  if(o.patch) Object.entries(o.patch).forEach(([k,v])=>{ const p=k.split('.'); let t=s; for(let i=0;i<p.length-1;i++) t=t[p[i]]; t[p[p.length-1]]=v; });
  return s; })`;
/* saved-data projects: round piers without the field (the H3 comparison case, a bolt circle with the cage, an offset grid) */
const SAVES = [
  { id: 'grid-uplift' }, { id: 'grid-offset', ox: 3, oy: -2 }, { id: 'grid-hef-full', hefMode: false }, { id: 'grid-hef-reduced', hefMode: true },
  { id: 'circle8-cage', patch: { 'anchor.pattern': 'circle', 'anchor.nCircle': 8, 'anchor.BC': 20, 'anchor.theta0': 22.5, 'anchor.hef': 30, 'plate.B': 26, 'plate.N': 26, 'conc.D': 42, 'conc.Bx': 42, 'conc.By': 42,
    'conc.cage': { present: true, nBars: 10, barSize: '#9', grade: 'gr60', cover: 3, angle0: 0, topCover: 3, topHook: false, tieType: 'spiral', tieSize: '#4', tieGrade: 'gr60', tieTop: 3, pitch: 3, ackDetail: false } } },
  { id: 'torsion', combos: [{ name: 'T', P: 5, Vx: 4, Vy: 2, Mx: 120, My: -60, T: 60 }] },
];

async function calc(src, specs) {
  const { b, p, errs } = await openPage(src.file);
  try {
    await ready(p);
    const R = await p.evaluate(({ specs, BUILD }) => {
      const build = eval(BUILD), out = {};
      const strip = o => JSON.parse(JSON.stringify(o, (k, v) => (k === 'steps' || typeof v === 'function') ? undefined : (typeof v === 'number' && !isFinite(v) ? String(v) : v)));
      for (const sp of specs) { S = mergeState(build(sp)); S.proj.date = '2026-01-01'; try { refreshAll(); } catch (e) { out[sp.id + '.refreshErr'] = String(e); }
        CC = computeAll();
        out[sp.id] = { cc: strip(CC), caps: CC.combos.map(c => strip(comboCapacities(CC, c))), checks: strip(allChecks()), validation: strip(VALIDATION) }; }
      return out; }, { specs, BUILD });
    return { R, errs };
  } finally { await b.close(); }
}

async function checks(src) {
  const { b, p, errs } = await openPage(src.file);
  try {
    await ready(p);
    if (!(await p.evaluate(() => !!window.katex))) await p.addScriptTag({ path: path.join(HERE, 'libs', 'katex@0.16.9', 'dist', 'katex.min.js') });
    const r = await p.evaluate(({ BUILD }) => {
      const build = eval(BUILD), out = { hand: {}, dir: {}, tex: [], card: {} };
      const texCheck = (tag, steps) => (steps || []).forEach(st => (st.lines || []).concat((st.vars || []).map(v => v[0])).forEach(l => { try { katex.renderToString(String(l), { throwOnError: true, strict: false }); } catch (e) { out.tex.push(tag + ' | ' + st.title + ' | ' + String(e.message).slice(0, 120)); } }));
      const run = o => { S = mergeState(build(o)); S.proj.date = '2026-01-01'; refreshAll(); CC = computeAll(); return CC; };
      /* 2. hand case */
      for (const m of ['exact', 'chord', 'inscribed']) {
        run({ m, combos: [{ name: 'U', P: 40, Vx: 10, Vy: 0, Mx: 0, My: 0 }] });
        const c = CC.combos[0], cap = comboCapacities(CC, c), tb = cap.tb;
        const vc = shearCases(c, false);
        out.hand[m] = { hef: tb.hef, ca: tb.ca, ANc: tb.ANc, ANco: tb.ANco, psi: tb.psi_ed, Nb: tb.Nb, Ncbg: tb.Ncbg, phi: tb.phiNcbg, alt: tb.alt ? tb.alt.phiNcbg : null,
          Tg: c.Tu_group, cases: vc.cases ? vc.cases.map(k => [k.id, k.ca1, k.sb.AVc, k.sb.phiVcbg]) : [], sbk: { ca1: cap.sbk.ca1, AVc: cap.sbk.AVc, phi: cap.sbk.phiVcbg, edge: cap.sbk.govEdge },
          errs: VALIDATION.errs.map(e => e.msg) };
        texCheck('hand ' + m, tb.steps); texCheck('hand ' + m, cap.sbk.steps);
      }
      /* 3. per-direction chord squares: plate offset x = +3 → rows at x = +9 / −3 and y = ±6 */
      run({ m: 'chord', ox: 3, combos: [{ name: '+x', P: 40, Vx: 10, Vy: 0, Mx: 0, My: 0 }, { name: '-x', P: 40, Vx: -10, Vy: 0, Mx: 0, My: 0 }] });
      { const E = bpEqSquares(); out.dir.s = E.dirs.map(d => [d.name, d.o, d.s]); out.dir.sMin = E.sMin; out.dir.govDir = E.govDir;
        out.dir.g = { xp: CC.g.ca_x_pos, xn: CC.g.ca_x_neg, yp: CC.g.ca_y_pos, yn: CC.g.ca_y_neg };
        out.dir.combos = CC.combos.map(c => { const cap = comboCapacities(CC, c), vc = shearCases(c, false);
          texCheck('dir ' + c.name, cap.tb.steps); texCheck('dir ' + c.name, cap.sbk.steps);
          const front = vc.cases.find(k => k.row.index === 0);
          return { name: c.name, edge: vc.edgeName, caLead: vc.caLead, front: front ? [front.id, front.ca1, front.sb.ca2] : null, tbCa: cap.tb.ca, sbkSteps: (cap.sbk.steps[0] || {}).title }; });
        out.dir.errs = VALIDATION.errs.map(e => e.msg); }
      /* 4. the card: renders, restores S / CC, typesets; the report contains it */
      run({ m: 'chord' });
      { const before = JSON.stringify(S), ccBefore = JSON.stringify(CC.combos.map(c => comboCapacities(CC, c).tb.phiNcbg));
        const host = document.createElement('div'); document.body.appendChild(host);
        let err = null; try { bpCircModelCard(host); } catch (e) { err = String(e && e.stack || e); }
        out.card.err = err; out.card.svg = [...host.querySelectorAll('svg')].filter(v => /chords through the outermost anchor rows/.test(v.textContent)).length; out.card.text = host.innerText.slice(0, 4000);
        out.card.restoredS = JSON.stringify(S) === before;
        out.card.restoredCC = JSON.stringify(CC.combos.map(c => comboCapacities(CC, c).tb.phiNcbg)) === ccBefore;
        const rows = bpCircCompare(); out.card.rows = rows.map(r => ({ m: r.m, na: r.na || null, tphi: r.tB && r.tB.phi, vphi: r.vB && r.vB.phi, gov: r.gov && r.gov.dcr, govLabel: r.gov && r.gov.label }));
        host.remove();
        let rep = ''; try { buildPrintReport(); const h = document.getElementById('printReport'); rep = h ? h.innerText : ''; if (h) h.innerHTML = ''; } catch (e) { rep = 'ERR ' + e; }
        out.card.report = { has: rep.indexOf('Circular Pier — Modelling Method') >= 0, hasCmp: rep.indexOf('Comparison — exact circle vs chord square vs inscribed square') >= 0, hasStep: rep.indexOf('chord through the anchor row (user setting)') >= 0, err: rep.startsWith('ERR') ? rep : null };
      }
      /* a save without the field and an explicit "exact" are one and the same on this version */
      { const strip = o => JSON.stringify(o, (k, v) => (k === 'steps' || typeof v === 'function') ? undefined : v);
        run({ m: null }); const a = strip(CC.combos.map(c => comboCapacities(CC, c))) + strip(allChecks());
        run({ m: 'exact' }); const e = strip(CC.combos.map(c => comboCapacities(CC, c))) + strip(allChecks());
        out.noFieldEqExact = a === e; }
      /* blocked: 4 anchors on a bolt circle BC 28 at 0° / 90° (at 14 in from the centre, c_a 4 in to the circle): outside the
         inscribed square (half side 12.73 in) and the chord square (half side √(18² − 14²) = 11.31 in) */
      const wide = { 'anchor.pattern': 'circle', 'anchor.nCircle': 4, 'anchor.BC': 28, 'anchor.theta0': 0, 'plate.B': 34, 'plate.N': 34 };
      out.blocked = ['inscribed', 'chord'].map(m => { run({ m, patch: wide }); return VALIDATION.errs.filter(e => /square/.test(e.msg)).map(e => e.msg); }).flat();
      run({ m: 'exact', patch: wide });
      out.notBlockedExact = VALIDATION.errs.length === 0;
      return out; }, { BUILD });
    if (args.shots) {
      fs.mkdirSync(args.shots, { recursive: true });
      await p.evaluate(({ BUILD }) => { const build = eval(BUILD); S = mergeState(build({ m: 'chord', combos: [{ name: 'U', P: 40, Vx: 10, Vy: 0, Mx: 0, My: 0 }] })); S.ui.tab = 'tabInput';
        S.ui.collapse = {}; refreshAll(); buildTabs(); }, { BUILD });
      await p.waitForTimeout(800);
      await p.evaluate(() => { if (typeof bpadSetInTab === 'function') bpadSetInTab('pedestal', false); });
      await p.waitForTimeout(300);
      const sel = await p.$('#inConc'); if (sel) { await sel.scrollIntoViewIfNeeded(); await p.waitForTimeout(200); await sel.screenshot({ path: path.join(args.shots, 'bp-circsq-1-selector.png') }); }
      /* the card in parts (a tall element is painted lazily off screen): derivation, figure, comparison */
      const parts = [['#iePierModel .eqBlock', 'bp-circsq-2-derivation.png'], ['#iePierModel svg.__fig, #iePierModel .svgWrap, #iePierModel svg', 'bp-circsq-3-figure.png'], ['#iePierModel table.tbl', 'bp-circsq-4-comparison.png']];
      await p.evaluate(() => { const c = document.getElementById('iePierModel'); const f = [...c.querySelectorAll('svg')].find(v => /chords through the outermost/.test(v.textContent)); if (f) f.classList.add('__fig'); });
      for (const [q, f] of parts) { const h = await p.$(q.startsWith('#iePierModel svg.__fig') ? '#iePierModel svg.__fig' : q); if (!h) continue;
        await h.scrollIntoViewIfNeeded(); await p.waitForTimeout(400); await h.screenshot({ path: path.join(args.shots, f) }); }
    }
    return { r, errs };
  } finally { await b.close(); }
}

/* ---- hand values, worked independently of the tool (kip, in; f'c = 4000 psi, λ_a = 1, cracked, headed, φ 0.70) ---- */
const sqrtfc = Math.sqrt(4000);
const NbOf = h => (h >= 11 && h <= 25) ? 16 * sqrtfc * Math.pow(h, 5 / 3) / 1000 : 24 * sqrtfc * Math.pow(h, 1.5) / 1000;
const psiN = (ca, h) => ca >= 1.5 * h ? 1 : 0.7 + 0.3 * ca / (1.5 * h);
function squareHand(s) {   /* 4 anchors at (±6, ±6) on a concentric square s × s, rectangular §17.6.2.1.2 */
  const ca = s / 2 - 6, hefNom = 12;
  const near = 4 * (ca < 1.5 * hefNom);              // all four edges within 1.5h_ef
  const hef = near >= 3 ? Math.min(hefNom, Math.max(ca / 1.5, 12 / 3)) : hefNom;
  const w = 12 + 2 * Math.min(1.5 * hef, ca);       // A_Nc side
  const ANc = w * w, ANco = 9 * hef * hef, Nb = NbOf(hef), psi = psiN(ca, hef);
  const Ncbg = Math.min(ANc / ANco, 4) * psi * Nb;
  return { s, ca, hef, ANc, ANco, psi, Nb, Ncbg, phi: 0.7 * Ncbg };
}
const R = 18, sChord = 2 * Math.sqrt(R * R - 36), sIns = 36 / Math.SQRT2;
const H = { chord: squareHand(sChord), inscribed: squareHand(sIns) };
{ /* exact circle, BC-8 "lesser": the full h_ef = 12 governs here (worked both ways) */
  const ca = R - 6 * Math.SQRT2, ANc = Math.PI * R * R;   // union of the 1.5h_ef squares covers the whole disc for both h_ef
  const full = { hef: 12, ca, ANc, ANco: 9 * 144, psi: psiN(ca, 12), Nb: NbOf(12) }; full.Ncbg = ANc / full.ANco * full.psi * full.Nb; full.phi = 0.7 * full.Ncbg;
  /* §17.6.2.1.2 by analogy: c_a,max = 18 − 6 = 12 (toward ±x/±y), s = 2·6√2 = 16.97 → h'_ef = max(12/1.5, 16.97/3) = 8 */
  const red = { hef: 8, ca, ANc, ANco: 9 * 64, psi: psiN(ca, 8), Nb: NbOf(8) }; red.Ncbg = Math.min(ANc / red.ANco, 4) * red.psi * red.Nb; red.phi = 0.7 * red.Ncbg;
  H.exact = full.phi <= red.phi ? Object.assign({}, full, { alt: red.phi }) : Object.assign({}, red, { alt: full.phi });
}

const [ra, rb] = [await calc(A, SAVES), await calc(B, SAVES)];
const cc = await checks(B);
const pe = x => x.filter(e => !/Failed to load resource|ERR_FAILED|net::/.test(e));
for (const [n, e] of [['A', ra.errs], ['B', rb.errs], ['checks', cc.errs]]) if (pe(e).length) { fail = true; console.log(`page errors ${n}: ${pe(e).slice(0, 5).join(' | ')}`); }

console.log('1. saved data: round piers without conc.circModel, origin/main vs working tree');
for (const s of SAVES) { const same = JSON.stringify(ra.R[s.id]) === JSON.stringify(rb.R[s.id]); if (!same) fail = true;
  console.log(`  ${same ? 'ok  ' : 'FAIL'} ${s.id}`); if (!same) fs.writeFileSync(path.join(OUT, s.id + '.json'), JSON.stringify({ a: ra.R[s.id], b: rb.R[s.id] }, null, 1)); }
const r = cc.r; fs.writeFileSync(path.join(OUT, 'circsq.json'), JSON.stringify(r, null, 1));
{ const ok = r.noFieldEqExact === true; if (!ok) fail = true; console.log(`  ${ok ? 'ok  ' : 'FAIL'} a save without the field = "exact" (working tree)`); }

const chk = (name, got, want, tol) => { const ok = typeof got === 'number' && typeof want === 'number' && Math.abs(got - want) <= tol; if (!ok) fail = true; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}: ${typeof got === 'number' ? got.toFixed(5) : got} (hand ${typeof want === 'number' ? want.toFixed(5) : want})`); };
console.log('2. hand case: Ø36 pier, 4 anchors at (±6, ±6), h_ef 12, uplift 40 kip (10 per anchor), V_x 10 kip');
for (const m of ['exact', 'chord', 'inscribed']) {
  const g = r.hand[m], h = H[m];
  if (m !== 'exact') chk(`${m}: s`, m === 'chord' ? sChord : sIns, h.s, 0);
  chk(`${m}: c_a,min`, g.ca, h.ca, 1e-9); chk(`${m}: h_ef`, g.hef, h.hef, 1e-9); chk(`${m}: A_Nc`, g.ANc, h.ANc, 1e-6); chk(`${m}: A_Nco`, g.ANco, h.ANco, 1e-6);
  chk(`${m}: ψ_ed,N`, g.psi, h.psi, 1e-9); chk(`${m}: N_b`, g.Nb, h.Nb, 1e-9); chk(`${m}: N_cbg`, g.Ncbg, h.Ncbg, 1e-6); chk(`${m}: φN_cbg`, g.phi, h.phi, 1e-6);
  if (m === 'exact') chk('exact: the other h_ef (shown as the alternative)', g.alt, h.alt, 1e-6);
  if (m !== 'exact') { const c1 = g.cases.find(k => k[0] === '1'), c2 = g.cases.find(k => k[0] === '2');
    chk(`${m}: shear Case 1 c_a1 (front row x = +6)`, c1 && c1[1], h.ca, 1e-9); chk(`${m}: shear Case 2 c_a1 (rear row x = −6)`, c2 && c2[1], h.ca + 12, 1e-9); }
  console.log(`       shear breakout used: c_a1 ${g.sbk.ca1.toFixed(3)}, A_Vc ${g.sbk.AVc.toFixed(2)}, φV_cbg ${g.sbk.phi.toFixed(3)} (${g.sbk.edge})`);
  if (g.errs.length) { fail = true; console.log(`  FAIL ${m}: validation errors ${g.errs.join(' | ')}`); }
}
console.log('3. chord squares per direction, plate offset x = +3 (rows at x = +9, −3; y = ±6)');
{ const d = r.dir, sOf = o => 2 * Math.sqrt(R * R - o * o), want = { '+x': sOf(9), '-x': sOf(-3), '+y': sOf(6), '-y': sOf(-6) };
  d.s.forEach(([n, o, s]) => chk(`s_${n} (o = ${o})`, s, want[n], 1e-9));
  chk('s for tension = smallest (+x)', d.sMin, sOf(9), 1e-9);
  chk('tension square: c_a,+x = s/2 − 9', d.g.xp, sOf(9) / 2 - 9, 1e-9); chk('tension square: c_a,−x = s/2 − 3', d.g.xn, sOf(9) / 2 - 3, 1e-9);
  const px = d.combos.find(c => c.name === '+x'), nx = d.combos.find(c => c.name === '-x');
  chk('shear toward +x: c_a1 on the +x square', px.caLead, sOf(9) / 2 - 9, 1e-9);
  chk('shear toward +x: front-row c_a2 on the +x square = s_+x/2 − 6', px.front && px.front[2], sOf(9) / 2 - 6, 1e-9);
  chk('shear toward −x: c_a1 on the −x square', nx.caLead, sOf(-3) / 2 - 3, 1e-9);
  chk('shear toward −x: front-row c_a2 on the −x square = s_−x/2 − 6', nx.front && nx.front[2], sOf(-3) / 2 - 6, 1e-9);
  chk('tension c_a,min on the smallest square', px.tbCa, sOf(9) / 2 - 9, 1e-9);
  if (d.errs.length) { fail = true; console.log(`  FAIL validation errors ${d.errs.join(' | ')}`); } }
console.log('4. card, comparison, report, validation');
{ const c = r.card;
  const t = (name, ok, extra) => { if (!ok) fail = true; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? ' ' + extra : ''}`); };
  t('card renders', !c.err && c.svg === 1, c.err || ''); t('card leaves S unchanged', c.restoredS); t('card leaves CC unchanged', c.restoredCC);
  t('comparison: three methods computed', c.rows.length === 3 && c.rows.every(x => !x.na && x.tphi > 0 && x.vphi > 0 && x.gov > 0));
  console.log('       ' + c.rows.map(x => `${x.m}: φN_cbg ${x.tphi.toFixed(2)}, φV_cbg ${x.vphi.toFixed(2)}, governing ${x.gov.toFixed(3)} (${x.govLabel})`).join('; '));
  t('report: card, comparison and worked step', c.report.has && c.report.hasCmp && c.report.hasStep && !c.report.err, c.report.err || '');
  t('anchors outside the inscribed / chord square: blocked', r.blocked.length === 2, r.blocked.join(' | '));
  t('same layout, exact circle: not blocked', r.notBlockedExact);
  t('worked lines typeset (KaTeX)', r.tex.length === 0, r.tex.slice(0, 5).join(' || ')); }
console.log(fail ? 'FAIL' : 'PASS');
process.exit(fail ? 1 : 0);
