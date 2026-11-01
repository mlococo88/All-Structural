#!/usr/bin/env node
// Base Plate & Anchor Designer: bolt circle, circular plate, circular pier, torsion (BC-1 … BC-4, 2026-11-01).
//   node tests/bpad-circle.mjs                  identity origin/main vs working tree + circle checks (working tree)
//   node tests/bpad-circle.mjs --a <ref|file> --b <file> --out <dir>
// 1. identity: origin/main and the working tree give identical computed results (computeAll, comboCapacities,
//    allChecks, VALIDATION) and identical report text on rectangular projects: the default, the built-in PROFIS
//    validation cases, the comparison cases C1–C5 (scratchpad anchor comparison, 2026-11-01) in four variants, and
//    variants that exercise reinforcement, stand-offs, offsets, overrides and the shear options.
// 2. circle checks on the working tree: 4 bolts at 45° on BC = 12√2 equal the 2×2 grid exactly; hand checks.
// Exit code 0 when every check passes.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { openPage, resolveFile, hash, diff, REPO, HERE } from './lib.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) { if (!av[i].startsWith('--')) continue; const k = av[i].slice(2); args[k] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true; }
const FILE = 'BasePlateAnchorDesigner.html';
const A = resolveFile(args.a || 'origin/main', FILE), B = resolveFile(args.b || FILE, FILE);
/* a file extracted from a git ref needs that ref's shared/ folder next to it (the Report tab loads shared/report.js) */
for (const src of [A, B]) { const ref = (args.a && src === A) ? args.a : (src === A ? 'origin/main' : null);
  if (ref && !fs.existsSync(path.join(path.dirname(src.file), 'shared', 'report.js')) && !/\.html$/.test(ref))
    execFileSync('sh', ['-c', `git -C "${REPO}" archive "${ref}" shared | tar -x -C "${path.dirname(src.file)}"`]); }
const OUT = args.out || path.join(os.tmpdir(), 'allstruct-tests', 'bpad-circle'); fs.mkdirSync(OUT, { recursive: true });
let fail = false;
const ready = p => p.waitForFunction(() => typeof S !== 'undefined' && typeof computeAll === 'function' && document.getElementById('tabBar') && document.getElementById('tabBar').children.length > 0, null, { timeout: 60000 });

/* the comparison cases (kip, in; M in kip-ft about the axis that puts tension toward azimuth Mang) */
const CASES = [
  { id: 'C1', d: 1.0, gr: 55, sq: 12, b: 36, hef: 18, fc: 4, M: 40, Mang: 90, P: 5, V: 3 },
  { id: 'C3', d: 1.0, gr: 55, sq: 12, b: 36, hef: 18, fc: 4, M: 40, Mang: 45, P: 5, V: 3 },
  { id: 'C4', d: 1.0, gr: 55, sq: 12, b: 24, hef: 18, fc: 4, M: 30, Mang: 90, P: 2, V: 6 },
  { id: 'C5', d: 1.0, gr: 36, sq: 12, b: 120, hef: 18, fc: 4, M: 60, Mang: 90, P: 0, V: 4 },
];
/* page-side state builder: base project + case + variant, as plain data (runs in the page) */
const BUILD = `(function(spec){
  let s;
  if(spec.vc){ const v=VALIDATION_CASES.find(x=>x.id===spec.vc); s=v.setup(); } else s=defaultState();
  const c=spec.case;
  if(c){ const plate=c.sq+6; s.plate.B=plate; s.plate.N=plate; s.plate.t=1.5;
    s.anchor.dia=c.d; s.anchor.grade='f1554_'+c.gr; s.anchor.hef=c.hef; s.anchor.nx=2; s.anchor.ny=2; s.anchor.edx=3; s.anchor.edy=3;
    s.anchor.head='hvyhexhead'; s.anchor.torqued=true;
    s.conc.fc=c.fc; s.conc.Bx=c.b; s.conc.By=c.b; s.conc.H=120; s.conc.cracked=true;
    s.grout.present=false; s.standoff.type='none'; s.forceModel.method='elastic';
    const M=c.M*12, a=c.Mang*Math.PI/180;
    s.combos=[{name:c.id,P:-c.P,Vx:+(c.V*Math.cos(a)).toFixed(9),Vy:+(c.V*Math.sin(a)).toFixed(9),Mx:+(M*Math.sin(a)).toFixed(9),My:+(-M*Math.cos(a)).toFixed(9)},
              {name:c.id+' rev',P:c.P,Vx:-(c.V*Math.sin(a)).toFixed(9),Vy:+(c.V*Math.cos(a)).toFixed(9),Mx:-(M*Math.cos(a)).toFixed(9)*0.5,My:+(M*Math.sin(a)).toFixed(9)*0.5}];
  }
  const set=(o,k,v)=>{ const p=k.split('.'); let t=o; for(let i=0;i<p.length-1;i++){ t=t[p[i]]; } t[p[p.length-1]]=v; };
  Object.entries(spec.patch||{}).forEach(([k,v])=>set(s,k,v));
  return s; })`;
const VARIANTS = {
  base: {}, dn: { 'standoff.type': 'clamp', 'standoff.z': 1.5 }, na: { 'forceModel.method': 'na', 'grout.present': true },
  hilti: { 'shear.hiltiDist': true, 'standoff.type': 'grout', 'grout.present': true },
};
const IDENT = [{ id: 'default' }, { id: 'msa3a', vc: 'msa3a' }, { id: 'struct2v1', vc: 'struct2v1' }, { id: 'struct2v2', vc: 'struct2v2' }];
for (const c of CASES) for (const [v, patch] of Object.entries(VARIANTS)) IDENT.push({ id: c.id + '.' + v, case: c, patch });
IDENT.push(
  { id: 'grid3x3-offset', patch: { 'anchor.nx': 3, 'anchor.ny': 3, 'plate.B': 22, 'plate.N': 22, 'conc.plate_off_x': 4, 'conc.plate_off_y': -2, 'conc.Bx': 34 } },
  { id: 'ca-override', patch: { 'conc.ca_override': true, 'conc.ca_x_pos': 5, 'conc.ca_y_neg': 7 } },
  { id: 'trebar-perrow', patch: { 'tRebar.present': true } },
  { id: 'trebar-enclose', patch: { 'tRebar.present': true, 'tRebar.layoutMode': 'enclose', 'tRebar.ack_devBelow': true, 'tRebar.ack_deformed': true, 'tRebar.ack_tie': true, 'tRebar.ack_hooks': true } },
  { id: 'vrebar-hairpin', patch: { 'vRebar.present': true } },
  { id: 'ped-pedbars', patch: { 'ped.present': true, 'tRebar.present': true, 'tRebar.pieceType': 'pedbars' } },
  { id: 'vrebar-closedtie', patch: { 'ped.present': true, 'vRebar.present': true, 'vRebar.pieceType': 'closedtie' } },
  { id: 'noclamp', patch: { 'standoff.type': 'noclamp', 'standoff.z': 2 } },
  { id: 'case-c2-welded', patch: { 'shear.caseOverride': 'c2', 'shear.weldedPlate': true, 'anchor.nx': 3 } },
  { id: 'uncracked-lb', patch: { 'conc.cracked': false, 'ui.units': 'lb', 'ui.momentUnits': 'kip-ft', 'anchor.head': 'platewasher' } },
  /* round pier with the pier cage (BC-5), compared on the computed results only (calcOnly: drawings in the report text may differ) */
  { id: 'cage-supp', calcOnly: true, case: CASES[0], patch: { 'anchor.pattern': 'circle', 'anchor.nCircle': 8, 'anchor.BC': 20, 'anchor.theta0': 22.5, 'anchor.hef': 36,
    'conc.shape': 'circle', 'conc.D': 42, 'conc.Bx': 42, 'conc.By': 42, 'conc.cage': { present: true, nBars: 10, barSize: '#9', grade: 'gr60', cover: 3, angle0: 0, topCover: 3, topHook: false, tieType: 'spiral', tieSize: '#4', tieGrade: 'gr60', tieTop: 3, pitch: 3, ackDetail: false } } },
  { id: 'cage-subst', calcOnly: true, case: CASES[0], patch: { 'anchor.pattern': 'circle', 'anchor.nCircle': 4, 'anchor.BC': 16.970562748477143, 'anchor.theta0': 45, 'anchor.hef': 36,
    'conc.shape': 'circle', 'conc.D': 36, 'conc.Bx': 36, 'conc.By': 36, 'conc.cage': { present: true, nBars: 8, barSize: '#8', grade: 'gr60', cover: 3, angle0: 45, topCover: 3, topHook: false, tieType: 'tie', tieSize: '#4', tieGrade: 'gr60', tieTop: 3, pitch: 4, ackDetail: true } } },
  { id: 'narrow', patch: { 'conc.Bx': 14, 'conc.By': 40, 'conc.H': 16, 'plate.B': 12, 'anchor.hef': 10, 'anchor.torqued': true } },
);

async function identity(src) {
  const { b, p, errs } = await openPage(src.file);
  try {
    await ready(p);
    const R = await p.evaluate(({ IDENT, BUILD }) => {
      const build = eval(BUILD);
      const strip = o => JSON.parse(JSON.stringify(o, (k, v) => typeof v === 'function' ? undefined : (typeof v === 'number' && !isFinite(v) ? String(v) : v)));
      const out = {};
      for (const spec of IDENT) {
        S = mergeState(build(spec)); S.proj.date = '2026-01-01';
        try { refreshAll(); } catch (e) { out[spec.id + '.refreshErr'] = String(e); }
        CC = computeAll();
        const caps = CC.combos.map(c => strip(comboCapacities(CC, c)));
        let rep = '';
        try { buildPrintReport(); const h = document.getElementById('printReport'); rep = h ? h.innerText : ''; if (h) h.innerHTML = ''; } catch (e) { rep = 'ERR ' + e; }
        let model = ''; try { model = JSON.stringify(bprModel()); } catch (e) { model = 'ERR ' + e; }
        if (spec.calcOnly) { rep = ''; model = ''; }
        out[spec.id] = { cc: strip(CC), caps, checks: strip(allChecks()), validation: strip(VALIDATION), report: rep.replace(/\d{4}-\d\d-\d\d/g, '(date)'), model: model.replace(/\d{4}-\d\d-\d\d/g, '(date)') };
      }
      return out;
    }, { IDENT, BUILD });
    return { R, errs };
  } finally { await b.close(); }
}

/* ---------- 2. circle checks (working tree) ---------- */
async function circleChecks(src) {
  const { b, p, errs } = await openPage(src.file);
  try {
    await ready(p);
    /* KaTeX for the TeX check below: the tool's pinned version, or the test kit's copy when that one is not served */
    if (!(await p.evaluate(() => !!window.katex))) await p.addScriptTag({ path: path.join(HERE, 'libs', 'katex@0.16.9', 'dist', 'katex.min.js') });
    const r = await p.evaluate(({ CASES, VARIANTS, BUILD }) => {
      /* every worked line of the current design's steps must typeset (no raw TeX on screen or in the report) */
      const texBad = [];
      const texCheck = tag => { const steps = [];
        const add = o => { if (o && Array.isArray(o.steps)) o.steps.forEach(st => steps.push(st)); };
        CC.combos.forEach(c => { const cap = comboCapacities(CC, c); [cap.st, cap.po, cap.tb, cap.sfb, cap.sv, cap.sbk, cap.pry].forEach(add); add(plateBending(c, CC)); add(plateTearout(c)); });
        add(bearingCheck(CC)); add(levelingNutCheck(CC)); add(standoffCompressionCheck(CC));
        if (typeof bpCircGeomStep === 'function' && bpCircPattern()) steps.push(bpCircGeomStep());
        steps.forEach(st => (st.lines || []).concat((st.vars || []).map(v => v[0])).forEach(l => { try { katex.renderToString(String(l), { throwOnError: true, strict: false }); } catch (e) { texBad.push(tag + ' | ' + st.title + ' | ' + String(e.message).slice(0, 120)); } })); };
      const build = eval(BUILD);
      const strip = o => JSON.parse(JSON.stringify(o, (k, v) => (k === 'steps' || typeof v === 'function') ? undefined : (typeof v === 'number' && !isFinite(v) ? String(v) : v)));
      const run = s => { S = mergeState(s); S.proj.date = '2026-01-01'; refreshAll(); CC = computeAll();
        const res = CC.combos.map(c => { const cap = comboCapacities(CC, c);
          const gT = cap.govTfor(c), gV = cap.govVfor(c);
          return { T: c.perAnchor.map(a => [a.x, a.y, a.t, a.V]).sort((u, v) => u[0] - v[0] || u[1] - v[1]), Tg: c.Tu_group, Tmax: c.Tmax_anchor, Vu: c.Vu_per,
            modesT: cap.tensionModes.map(m => [m.label, m.phiN, cap.tDemand(c, m)]), modesV: cap.shearModes.map(m => [m.label, m.phiV, cap.vDemand(c, m)]),
            it: interaction(cap.tDCR(c, gT), 1, cap.vDCR(c, gV), 1).dcr, sfb: strip(cap.sfb), sbk: strip(cap.sbk), tb: strip(cap.tb) }; });
        return { res, checks: allChecks().map(c => [c.label, c.dcr]), errs: VALIDATION.errs.map(e => e.msg), warns: VALIDATION.warns }; };
      const out = { eq: {}, hand: {} };
      /* 2a. 4 bolts at 45° on BC = 12√2 vs the 2×2 grid at ±6 */
      for (const c of CASES) for (const [v, patch] of Object.entries(VARIANTS)) {
        const g = run(build({ case: c, patch }));
        const k = run(build({ case: c, patch: Object.assign({}, patch, { 'anchor.pattern': 'circle', 'anchor.nCircle': 4, 'anchor.BC': 12 * Math.SQRT2, 'anchor.theta0': 45 }) }));
        let maxRel = 0, where = '';
        const walk = (a, b, pth) => { if (typeof a === 'number' && typeof b === 'number') { const d = Math.abs(a - b) / Math.max(1, Math.abs(a)); if (d > maxRel) { maxRel = d; where = pth; } return; }
          if (a && b && typeof a === 'object') { for (const key of Object.keys(a)) if (key in b) walk(a[key], b[key], pth + '.' + key); else if (key !== 'vRowMask') { maxRel = Infinity; where = pth + '.' + key + ' missing'; } } else if (a !== b) { maxRel = Infinity; where = pth + ' ' + a + '≠' + b; } };
        walk(g.res, k.res, 'res'); walk(g.checks, k.checks, 'checks');
        out.eq[c.id + '.' + v] = { maxRel, where };
      }
      /* 2b. hand check H1: 8 × 1 in Gr 55 on BC 20 in, θ0 = 22.5°, 120 in block, h_ef 24, elastic, M = 80 kip-ft about x
         (tension on +y), P = 3 kip compression, V = 5 kip along +y.
         Σy² = n(BC/2)²/2 = 8·100/2 = 400 in²; y_max = 10·sin(67.5°) = 9.2388 in;
         T_max = 960·9.2388/400 − 3/8 = 22.1731 − 0.375 = 21.7981 kip; second row y = 10·sin(22.5°) = 3.8268:
         T = 960·3.8268/400 − 0.375 = 8.8094 kip; ΣT = 2·21.7981 + 2·8.8094 = 61.2150 kip. */
      { const s = defaultState(); s.anchor.pattern = 'circle'; s.anchor.nCircle = 8; s.anchor.BC = 20; s.anchor.theta0 = 22.5; s.anchor.dia = 1; s.anchor.grade = 'f1554_55'; s.anchor.hef = 24;
        s.plate.B = 26; s.plate.N = 26; s.conc.Bx = 120; s.conc.By = 120; s.conc.H = 120; s.grout.present = false; s.forceModel.method = 'elastic';
        s.combos = [{ name: 'H1', P: -3, Vx: 0, Vy: 5, Mx: 960, My: 0 }];
        const r1 = run(s); texCheck('H1'); out.hand.H1 = { Tmax: r1.res[0].Tmax, Tg: r1.res[0].Tg, errs: r1.errs }; }
      /* H2: circular plate D = 24, t = 1.5, A36, 6 × 1 in on BC 16 (θ0 0), pole HSS8.625 round, double nut (clamp, 1 in),
         P = 0, M = 600 kip-in about y (My = −600 → tension on +x … elastic: T_i = −My·x_i/Σx²), Σx² = 6·64/2 = 192,
         x_max = 8 → |T| = 600·8/192 = 25.0 kip (tension rod at +x, compression rod at −x, equal magnitude).
         m = (16 − 8.625)/2 = 3.6875 in; b_eff = π·8.625/6 = 4.5160 in; M_u = 25·3.6875 = 92.1875 kip-in;
         t_req = √(4·92.1875/(0.90·36·4.5160)) = √(368.75/146.32) = √2.52018 = 1.58751 in; DCR = 1.58751/1.5 = 1.05834. */
      { const s = defaultState(); s.anchor.pattern = 'circle'; s.anchor.nCircle = 6; s.anchor.BC = 16; s.anchor.theta0 = 0; s.anchor.dia = 1; s.anchor.grade = 'f1554_55'; s.anchor.hef = 18;
        s.plate.shape = 'circle'; s.plate.D = 24; s.plate.B = 24; s.plate.N = 24; s.plate.t = 1.5; s.plate.grade = 'a36';
        s.col.custom = false; s.col.shapeType = 'HSS'; s.col.shape = 'HSS8.625 (round)';
        s.conc.Bx = 48; s.conc.By = 48; s.conc.H = 60; s.grout.present = false; s.standoff.type = 'clamp'; s.standoff.z = 1.0;
        s.combos = [{ name: 'H2', P: 0, Vx: 2, Vy: 0, Mx: 0, My: -600 }];
        const r2 = run(s); texCheck('H2'); const pb = plateBending(CC.combos[0], CC);
        out.hand.H2 = { Prod: pb.Prod, m: pb.m, beff: pb.beff, tReq: pb.tReq, dcr: pb.dcr, chk: r2.checks.find(c => c[0] === 'Base Plate Bending'), errs: r2.errs }; }
      /* H3 (BC-2): comparison case C2 — 4 × 1 in Gr 55 at (±6, ±6) (BC 12√2, θ0 45°) on a Ø36 in round pier, h_ef 18,
         f'c 4 ksi cracked, M_x = 480 kip·in (tension +y), P = 5 kip compression, V_y = 3 kip, elastic.
         T = −5/4 + 480·6/144 = 18.75 kip on (±6, +6); ΣT = 37.5 kip, e'_N = 0.
         §17.6.2.1.2 by analogy (default): c(θ) = 18 − 8.485·cos δ ∈ [9.515, 12] < 27 all round → applies;
           c_a,max = 12, s = 16.971 → h'_ef = max(12/1.5, 16.971/3) = 8 in; N_b = 24·√4000·8^1.5 = 34.346 kip;
           A_Nc = ([−18,18]×[−6,18]) ∩ disc = 508.938 + (6·16.971 + 324·asin(1/3)) = 720.868 in²; A_Nco = 576;
           ψ_ed = 0.7 + 0.3·9.515/12 = 0.93787; φN_cbg = 0.70·(720.868/576)·0.93787·34.346 = 28.22 kip.
         Without: h_ef 18, N_b = 16·√4000·18^(5/3) = 125.08 kip; A_Nc = the full disc 1017.876 in²; A_Nco = 2916;
           ψ_ed = 0.7 + 0.3·9.515/27 = 0.80572; φN_cbg = 0.70·0.34907·0.80572·125.08 = 24.63 kip (the comparison's 24.63). */
      { const mk = red => { const s = build({ case: CASES[0], patch: { 'anchor.pattern': 'circle', 'anchor.nCircle': 4, 'anchor.BC': 12 * Math.SQRT2, 'anchor.theta0': 45,
          'conc.shape': 'circle', 'conc.D': 36, 'conc.circHefReduce': red } }); s.combos = [s.combos[0]]; return s; };
        const a = run(mk(true)); texCheck('H3 reduced'); const b = run(mk(false)); texCheck('H3 full');
        const tb = a.res[0].tb, tb2 = b.res[0].tb;
        out.hand.H3 = { hef: tb.hef, Nb: tb.Nb, ANc: tb.ANc, ANco: tb.ANco, psi_ed: tb.psi_ed, phiNcbg: tb.phiNcbg, altPhi: tb.alt && tb.alt.phiNcbg,
          hef2: tb2.hef, Nb2: tb2.Nb, ANc2: tb2.ANc, psi_ed2: tb2.psi_ed, phiNcbg2: tb2.phiNcbg, Tg: a.res[0].Tg, sbk: a.res[0].sbk, sfbNa: a.res[0].sfb.na,
          checks: a.checks, errs: a.errs.concat(b.errs) }; }
      /* H4 (BC-3): torsion. 8 × 1 in Gr 55 on BC 20 (θ0 22.5°), 120 in block, h_ef 24, Hilti V/n option (so the torsion
         governs the per-anchor steel shear), V_x = 5 kip, T = 72 kip·in (6 kip·ft), P = −3, M_x = 960 (comparison case C6).
         J = Σr² = 8·10² = 800 in²; torsion shear per anchor T·r/J = 72·10/800 = 0.900 kip ⊥ radius; direct V/n = 0.625 kip.
         The anchors at 247.5° and 292.5° have their torsion vector 22.5° off +x:
         |V| = √(0.625² + 0.9² + 2·0.625·0.9·cos 22.5°) = √(0.390625 + 0.81 + 1.039336) = √2.239961 = 1.49665 kip
         (the comparison's LP value, magnitudes added, is 0.625 + 0.900 = 1.525). Pryout demand Σ|V_i| (computed below independently). */
      { const s = defaultState(); s.anchor.pattern = 'circle'; s.anchor.nCircle = 8; s.anchor.BC = 20; s.anchor.theta0 = 22.5; s.anchor.dia = 1; s.anchor.grade = 'f1554_55'; s.anchor.hef = 24;
        s.plate.B = 26; s.plate.N = 26; s.conc.Bx = 120; s.conc.By = 120; s.conc.H = 120; s.grout.present = false; s.forceModel.method = 'elastic'; s.shear.hiltiDist = true;
        s.combos = [{ name: 'H4', P: -3, Vx: 5, Vy: 0, Mx: 960, My: 0, T: 72 }];
        const r4 = run(s); texCheck('H4');
        const c = CC.combos[0], cap = comboCapacities(CC, c);
        let sum = 0; anchorCoords().forEach(p0 => { const vx = 5 / 8 - 72 * p0.y / 800, vy = 72 * p0.x / 800; sum += Math.hypot(vx, vy); });
        const s0 = JSON.parse(JSON.stringify(s)); s0.combos[0].T = 0; const r0 = run(s0);
        out.hand.H4 = { Vu: r4.res[0].Vu, sumV: c.tors && c.tors.sumV, sumHand: sum, pryDem: cap.pryDem, sbkDem: cap.sbkDem, sbkDir: cap.sbk.torsion && cap.sbk.torsion.dir.deg,
          stV: r4.checks.find(x => x[0] === 'Steel Shear'), stV0: r0.checks.find(x => x[0] === 'Steel Shear'), sbk0: r0.res[0].sbk.phiVcbg, errs: r4.errs }; }
      /* H5 (BC-3): anchorGroup import, sign convention lightPole-v1 → this tool. A push toward +x at the pole top: LP M_x = +40 kip·ft
         (force × height), P = 5 kip compression, V_x = 3. Here: P = −5, M_y = +480 kip·in, M_x = 0 → the −x anchors in tension.
         Two groups (two-post sign) imported with the picker; switching keeps each group's inputs; the result payload has both. */
      { const pay = { _schema: 'bridge-anchor-group', schemaVersion: 1, producer: 'Light Pole and Sign Post', producerFile: 'Light Pole and Sign Post.html', producedAt: '2026-11-01T12:00:00Z',
          project: { name: 'Sign 12', bridgeId: '' }, units: { length: 'in', force: 'kip', moment: 'kip-ft', stress: 'ksi' }, basis: { factored: true, method: 'LRFD', combos: 'ASCE 7-22 §2.3' },
          signConvention: 'lightPole-v1', inputsHash: 'abc123', notes: ['test'],
          groups: [
            { id: 'post1', label: 'Post 1', anchor: { pattern: 'circle', n: 4, BC: 12 * Math.SQRT2, theta0: 45, dia: 1, grade: 'f1554_55', nut: 'heavyHex', hef: 18, torqued: true },
              base: { type: 'doubleNut', standoffClear: 1.0, grout: false, plate: { shape: 'circle', D: 22, t: 1.5, Fy: 36 }, pole: { shape: 'round', D: 8.625 } },
              pier: { shape: 'circle', D: 36, fc: 4, cracked: true, depth: 120 }, combos: [{ name: '1.2D+1.0W az0', P: 5, Vx: 3, Vy: 0, Mx: 40, My: 0, T: 2 }] },
            { id: 'post2', label: 'Post 2', anchor: { pattern: 'circle', n: 6, BC: 16, theta0: 0, dia: 1, grade: 'f1554_36', nut: 'heavyHex', hef: 15, torqued: false },
              base: { type: 'doubleNut', standoffClear: 0.75, plate: { shape: 'circle', D: 22, t: 1.25, Fy: 50 }, pole: { shape: 'round', D: 10.75 } },
              pier: { shape: 'square', D: 30, fc: 4, cracked: true, depth: 96 }, combos: [{ name: '0.9D+1.0W az90', P: 2, Vx: 0, Vy: 2, Mx: 0, My: 25 }] } ] };
        const chk = bxAg.check(pay);
        S = mergeState(defaultState()); refreshAll();
        const ap = bxAg.apply(pay, chk, { mode: 'all' }, 'test'); refreshAll(); CC = computeAll();
        const c0 = CC.combos[0];
        const g1 = { P: c0.raw.P, Mx: c0.raw.Mx, My: c0.raw.My, T: c0.raw.T, tensionX: c0.perAnchor.filter(a => a.t > 1e-9).map(a => a.x), shape: S.conc.shape, plate: S.plate.shape, so: S.standoff.type, z: S.standoff.z, col: S.col.shape };
        texCheck('H5 post1');
        bpGroupSwitch(1); CC = computeAll(); const c1 = CC.combos[0];
        const g2 = { n: S.anchor.nCircle, P: c1.raw.P, Mx: c1.raw.Mx, My: c1.raw.My, tensionY: c1.perAnchor.filter(a => a.t > 1e-9).map(a => a.y), shape: S.conc.shape, grade: S.plate.grade, active: S.groupActive };
        texCheck('H5 post2');
        bpGroupSwitch(0); const back = { n: S.anchor.nCircle, active: S.groupActive, D: S.conc.D };
        const res = bxAg.resultPayload();
        const bad = bxAg.check(Object.assign({}, pay, { signConvention: 'other' })).err.length + bxAg.check(Object.assign({}, pay, { basis: { factored: false } })).err.length;
        out.hand.H5 = { ok: ap.ok, warn: chk.warn, g1, g2, back, src: S.bxSrc && S.bxSrc.anchorGroup && S.bxSrc.anchorGroup.inputsHash, nGroups: S.groups.length,
          res: res && res.results.map(x => ({ id: x.groupId, dcr: x.governing && x.governing.dcr, mode: x.governing && x.governing.mode })), resHash: res && res.source.inputsHash, refused: bad, errs: VALIDATION.errs.map(e => e.msg) }; }
      /* H6 (BC-5): pier cage as anchor reinforcement. C2 geometry with h_ef = 36 in: 4 × 1 in at (±6, ±6), Ø36 pier,
         H 120, M_x = 480 kip·in, P = 5 kip compression, V_y = 3 kip. Cage: 8 #8 Gr 60 at 45° + k·45°, clear cover 3 in to
         #4 ties at 3 in + 4 in, bar tops 3 in below the surface, straight.
         R_b = 18 − 3 − 0.5 − 0.5 = 14 in; tension anchors (±6, +6), their hull is the segment between them.
         ℓ_d (§25.4.2.4, K_tr 0): c_b = min(3.5 + 0.5, 10.716/2) = 4.0 → (c_b + K_tr)/d_b = 2.5;
           ℓ_d = 0.075·60000/(63.246·2.5)·1.0 = 28.46 in.
         Bar at 45° (9.899, 9.899): 5.515 in from (6, 6) (≤ 0.5h_ef = 18); z_c = 36 − 5.515/1.5 = 32.32; above = 29.32 ≥ 28.46;
           below = 117 − 32.32 = 84.7 ≥ 28.46 → effective; bar at 135° the same. Bar at 0° (14, 0): 10 in from (6, 6),
           z_c = 36 − 10/1.5 = 29.33, above 26.33 < 28.46 → not; bar at 90° (0, 14): 8 in from the segment, z_c = 30.67,
           above 27.67 < 28.46 → not. n_eff = 2: φN_r = 0.75·2·0.79·60 = 71.10 kip; ΣT = 37.5 → 0.5274 (per anchor
           18.75/71.10 = 0.2637) → DCR 0.5274.
         Shear: Case 2 governs (rear row y = −6, c_a1 = 21.657 by the tangent edge) → ties at z ≤ 0.5c_a1 = 10.83: z = 3 and 7,
           both cross the body, 2 legs each → 4 legs; φV_r = 0.75·4·0.20·60 = 36.00 kip; V = 3 → 0.0833.
         Not confirmed: Condition A (φ 0.75) on the concrete breakout, breakout still checked; confirmed: breakout replaced. */
      { const mk = ack => { const s = build({ case: CASES[0], patch: { 'anchor.pattern': 'circle', 'anchor.nCircle': 4, 'anchor.BC': 12 * Math.SQRT2, 'anchor.theta0': 45,
          'conc.shape': 'circle', 'conc.D': 36, 'anchor.hef': 36 } }); s.combos = [s.combos[0]];
          s.conc.cage = { present: true, nBars: 8, barSize: '#8', grade: 'gr60', cover: 3, angle0: 45, topCover: 3, topHook: false, tieType: 'tie', tieSize: '#4', tieGrade: 'gr60', tieTop: 3, pitch: 4, ackDetail: ack }; return s; };
        const a = run(mk(false)); texCheck('H6 supplementary');
        const capA = comboCapacities(CC, CC.combos[0]);
        const b = run(mk(true)); texCheck('H6 substituted');
        const capB = comboCapacities(CC, CC.combos[0]);
        const ct = capB.cageT, cv = capB.cageV;
        out.hand.H6 = { ld: ct.G.dev.ld, Rb: ct.G.Rb, nEff: ct.nEff, effBars: ct.bars.filter(x => x.eff).map(x => x.n), phiNr: ct.phiNr, dcrT: ct.dcr, legs: cv.nEff, phiVr: cv.phiVr, dcrV: cv.dcr, ca1: cv.ca1,
          phiTbA: capA.tb.phi, tbInA: capA.tensionModes.some(m => /breakout/.test(m.label)), tbInB: capB.tensionModes.some(m => /Concrete breakout/.test(m.label)),
          cageModeB: capB.tensionModes.some(m => /pier cage/.test(m.label)) && capB.shearModes.some(m => /pier cage/.test(m.label)),
          checksB: b.checks.map(x => x[0]), errs: a.errs.concat(b.errs) }; }
      out.texBad = texBad;
      return out;
    }, { CASES, VARIANTS, BUILD });
    return { r, errs };
  } finally { await b.close(); }
}

console.log(`A: ${A.label}\nB: ${B.label}\nreadouts in ${OUT}\n`);
const [ra, rb, cc] = await Promise.all([identity(A), identity(B), circleChecks(B)]);
fs.writeFileSync(path.join(OUT, 'identity.A.json'), JSON.stringify(ra)); fs.writeFileSync(path.join(OUT, 'identity.B.json'), JSON.stringify(rb));
console.log(`== 1. identity on ${Object.keys(ra.R).length} rectangular projects, origin/main vs working tree`);
for (const k of Object.keys(ra.R)) {
  const d = diff(ra.R[k], rb.R[k]);
  console.log(`  ${k.padEnd(18)} ${hash(ra.R[k])} ${hash(rb.R[k])} ${d.length ? 'DIFFERENT' : 'same'}`);
  if (d.length) { fail = true; d.slice(0, 10).forEach(x => console.log('     ', JSON.stringify(x).slice(0, 300))); }
}
const pe = x => x.filter(e => !/Failed to load resource|ERR_FAILED|net::/.test(e));
console.log(`  console errors A ${pe(ra.errs).length}, B ${pe(rb.errs).length}`); pe(rb.errs).slice(0, 5).forEach(e => console.log('    B: ' + e));
if (pe(rb.errs).length) fail = true;

const r = cc.r; fs.writeFileSync(path.join(OUT, 'circle.json'), JSON.stringify(r, null, 1));
console.log('\n== 2a. 4 bolts at 45° on BC = 12√2 vs the 2×2 grid (largest relative difference of any result)');
for (const [k, v] of Object.entries(r.eq)) { const ok = v.maxRel < 1e-9; if (!ok) fail = true; console.log(`  ${k.padEnd(10)} ${v.maxRel.toExponential(2)} ${ok ? 'ok' : 'DIFFERENT at ' + v.where}`); }
console.log('\n== 2b. hand checks');
const chk = (name, got, want, tol) => { const ok = typeof got === 'number' && Math.abs(got - want) <= tol; if (!ok) fail = true; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}: ${typeof got === 'number' ? got.toFixed(5) : got} (hand ${want})`); };
chk('H1 T_max (8 bolts, BC 20, θ0 22.5°)', r.hand.H1.Tmax, 21.7981, 5e-4);
chk('H1 ΣT', r.hand.H1.Tg, 61.2150, 5e-4);
chk('H2 P_rod', r.hand.H2.Prod, 25.0, 1e-9);
chk('H2 m', r.hand.H2.m, 3.6875, 1e-9);
chk('H2 b_eff', r.hand.H2.beff, 4.51604, 1e-5);
chk('H2 t_req', r.hand.H2.tReq, 1.58751, 1e-5);
chk('H2 DCR (Summary row)', r.hand.H2.chk && r.hand.H2.chk[1], 1.05834, 1e-5);
if (r.hand.H3) {
  const h = r.hand.H3;
  chk('H3 h\'_ef (circle, §17.6.2.1.2 analogy)', h.hef, 8, 1e-9);
  chk('H3 N_b', h.Nb, 34.3460, 5e-4);
  chk('H3 A_Nc (union ∩ disc)', h.ANc, 720.868, 5e-3);
  chk('H3 A_Nco', h.ANco, 576, 1e-9);
  chk('H3 ψ_ed,N', h.psi_ed, 0.93787, 5e-5);
  chk('H3 φN_cbg (reduction applied)', h.phiNcbg, 28.22, 5e-3);
  chk('H3 φN_cbg shown as the alternative (without)', h.altPhi, 24.63, 5e-3);
  chk('H3 φN_cbg (option off)', h.phiNcbg2, 24.63, 5e-3);
  chk('H3 A_Nc without = full disc', h.ANc2, Math.PI * 324, 1e-6);
  chk('H3 ψ_ed,N without', h.psi_ed2, 0.80572, 5e-5);
  chk('H3 ΣT', h.Tg, 37.5, 1e-9);
  console.log(`  H3 shear breakout (tangent edge): c_a1 ${h.sbk.ca1.toFixed(3)}, c_a2 ${h.sbk.ca2.toFixed(3)}, A_Vc ${h.sbk.AVc.toFixed(2)}, φV_cbg ${h.sbk.phiVcbg.toFixed(3)} (${h.sbk.govEdge}); side-face blowout ${h.sfbNa ? 'N/A' : 'checked'}`);
  console.log('  H3 Summary: ' + h.checks.map(c => c[0] + ' ' + (+c[1]).toFixed(3)).join('; '));
}
for (const h of ['H1', 'H2', 'H3', 'H4'].filter(k => r.hand[k])) if (r.hand[h].errs.length) { fail = true; console.log(`  ${h} validation errors: ${r.hand[h].errs.join(' | ')}`); }
if (r.hand.H4) {
  const h = r.hand.H4;
  chk('H4 steel-shear demand max|V_i| (torsion, vector sum)', h.Vu, 1.49665, 5e-5);
  chk('H4 pryout demand Σ|V_i| (tool vs independent sum)', h.pryDem, h.sumHand, 1e-9);
  const okS = h.stV && h.stV0 && h.stV[1] > h.stV0[1]; if (!okS) fail = true;
  console.log(`  ${okS ? 'ok  ' : 'FAIL'} H4 steel shear D/C with T ${h.stV && h.stV[1].toFixed(4)} > without ${h.stV0 && h.stV0[1].toFixed(4)}; breakout demand ${h.sbkDem && h.sbkDem.toFixed(3)} toward ${h.sbkDir}°`);
}
if (r.hand.H5) {
  const h = r.hand.H5, g1 = h.g1, g2 = h.g2;
  const ok = h.ok && h.nGroups === 2 && g1.P === -5 && Math.abs(g1.My - 480) < 1e-9 && Math.abs(g1.Mx) < 1e-12 && Math.abs(g1.T - 24) < 1e-9 && g1.tensionX.length && g1.tensionX.every(x => x < 0)
    && g1.shape === 'circle' && g1.plate === 'circle' && g1.so === 'clamp' && g1.z === 1 && g1.col === 'HSS8.625 (round)'
    && g2.n === 6 && g2.P === -2 && Math.abs(g2.Mx + 300) < 1e-9 && Math.abs(g2.My) < 1e-12 && g2.tensionY.every(y => y < 0) && g2.shape === 'rect' && g2.grade === 'a572_50' && g2.active === 1
    && h.back.n === 4 && h.back.active === 0 && h.back.D === 36 && h.src === 'abc123' && h.resHash === 'abc123' && h.res && h.res.length === 2 && h.res.every(x => x.dcr > 0) && h.refused === 2;
  if (!ok) fail = true;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} H5 anchorGroup import (lightPole-v1): post 1 P ${g1.P}, My ${g1.My}, Mx ${g1.Mx}, T ${g1.T} kip-in, tension at x = ${g1.tensionX.map(x => x.toFixed(2)).join(', ')}; post 2 Mx ${g2.Mx}, tension at y = ${g2.tensionY.map(y => y.toFixed(2)).join(', ')}; picker back to group 1 (n ${h.back.n}); result ${JSON.stringify(h.res)}; refused bad payloads ${h.refused}/2`);
  if (h.errs.length) console.log('    validation (group 1): ' + h.errs.join(' | '));
}
if (r.hand.H6) {
  const h = r.hand.H6;
  chk('H6 ℓ_d #8 (§25.4.2.4)', h.ld, 28.4605, 5e-3);
  chk('H6 R_b', h.Rb, 14, 1e-9);
  chk('H6 effective bars (45°, 135°)', h.nEff, 2, 0);
  chk('H6 φN_r', h.phiNr, 71.10, 1e-6);
  chk('H6 cage tension DCR', h.dcrT, 0.527426, 5e-6);
  chk('H6 tie legs', h.legs, 4, 0);
  chk('H6 φV_r', h.phiVr, 36.0, 1e-9);
  chk('H6 cage shear DCR', h.dcrV, 3 / 36, 1e-9);
  const ok = JSON.stringify(h.effBars) === '[1,3]' && h.phiTbA === 0.75 && h.tbInA && !h.tbInB && h.cageModeB && !h.checksB.includes('Concrete Breakout (T)') && !h.checksB.includes('Concrete Breakout (V)') && h.checksB.includes('Anchor Reinf. Tension (pier cage)');
  if (!ok) fail = true;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} H6 bars ${h.effBars}; not confirmed: breakout φ ${h.phiTbA} (Condition A) and still checked; confirmed: breakout replaced by the cage (Summary: ${h.checksB.join(', ')})`);
  if (h.errs.length) { fail = true; console.log('    H6 validation errors: ' + h.errs.join(' | ')); }
}
console.log(`  TeX of the worked steps (KaTeX, throwOnError): ${r.texBad.length ? r.texBad.length + ' line(s) FAIL' : 'all typeset'}`); r.texBad.slice(0, 10).forEach(x => console.log('    ' + x));
if (r.texBad.length) fail = true;
console.log(`  console errors ${pe(cc.errs).length}`); pe(cc.errs).slice(0, 5).forEach(e => console.log('    ' + e));
if (pe(cc.errs).length) fail = true;
console.log(fail ? '\nFAIL' : '\nPASS');
process.exit(fail ? 1 : 0);
