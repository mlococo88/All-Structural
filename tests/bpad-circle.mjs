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
import { openPage, resolveFile, hash, diff, REPO } from './lib.mjs';

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
    const r = await p.evaluate(({ CASES, VARIANTS, BUILD }) => {
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
        const r1 = run(s); out.hand.H1 = { Tmax: r1.res[0].Tmax, Tg: r1.res[0].Tg, errs: r1.errs }; }
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
        const r2 = run(s); const pb = plateBending(CC.combos[0], CC);
        out.hand.H2 = { Prod: pb.Prod, m: pb.m, beff: pb.beff, tReq: pb.tReq, dcr: pb.dcr, chk: r2.checks.find(c => c[0] === 'Base Plate Bending'), errs: r2.errs }; }
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
for (const h of ['H1', 'H2']) if (r.hand[h].errs.length) { fail = true; console.log(`  ${h} validation errors: ${r.hand[h].errs.join(' | ')}`); }
console.log(`  console errors ${pe(cc.errs).length}`); pe(cc.errs).slice(0, 5).forEach(e => console.log('    ' + e));
if (pe(cc.errs).length) fail = true;
console.log(fail ? '\nFAIL' : '\nPASS');
process.exit(fail ? 1 : 0);
