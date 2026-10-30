// apps/steel-bridge/engine/sheets.js: the drawing set (every GirderDetail sheet, border and title block) and the splice plates on the
// plan and elevation (engine/drawings.js). Display and export only: nothing here changes a computed result. The checks are that the
// file is well formed and that every sheet shows the model and the results of the modules that work them:
// 1. the built-in project and 5 hand-off payloads (tests/projects/st, each given its own cross-section, as tests/engine/drawings.test.mjs),
//    with the results of their tabs (SBDSheets.results: report/data.js, ui/welds.js): the whole set written as one DXF and read back;
//    validate() and ezdxf audit; the sheet list (GirderDetail's order, one elevation per girder, one splice sheet per splice and plate
//    girder, one diagram sheet per plate girder); every sheet inside its drawing area and its title block (project, scale, n OF N);
//    splice sheets: every bolt of the Field splices design and the plate sizes; plan and elevations: the splice plates at each girder's
//    own splice stations with every web bolt; the Strength I moment envelope on each girder's elevation = 1.25/0.90 DC + 1.50/0.65 DW
//    + 1.75 LL+IM recomputed here from the analysis; the camber diagram = the analysis camber; reactions, transitions, summary rows,
//    quantities (flange-to-web weld length = 4 x girder length; studs) against the results.
// 2. Hand check on the built-in project (arithmetic in the comments).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadShared, test, ROOT } from './harness.mjs';
import { projectFromPayload, readPayload } from './an-fixture.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const FILES = ['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'report.js', 'dxf.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'engine/rating.js', 'engine/welds.js', 'ui/flexure.js', 'ui/loads.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/rating.js', 'ui/splices.js', 'ui/welds.js',
  'report/data.js', 'report/builders.js', 'engine/drawings.js', 'engine/sheets.js'].map(E));
const W = loadShared(...FILES), X = W.SharedDxf, DW = W.SBDDrawings, SH = W.SBDSheets, FRM = W.SBDFraming, M = W.SBDModel;
const J = o => JSON.parse(JSON.stringify(o));
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= (tol == null ? 1e-4 : tol), `${what}: ${a} vs ${b}`);
const stats = { cases: 0, sheets: 0, bolts: 0, splPl: 0, env: 0, worst: 0, ez: 0, cam: 0 };
const track = d => { if (d > stats.worst) stats.worst = d; return d; };

let EZ = null;
function ezdxf(text, name) {
  if (EZ === false) return { skipped: true };
  const f = path.join(os.tmpdir(), `sbd2-sheets-${process.pid}-${name}.dxf`); fs.writeFileSync(f, text);
  const py = 'import sys, json\nimport ezdxf\nd = ezdxf.readfile(sys.argv[1])\na = d.audit()\nc = {}\nfor e in d.modelspace(): c[e.dxftype()] = c.get(e.dxftype(), 0) + 1\n'
    + 'print(json.dumps({"v": d.dxfversion, "errors": [e.message for e in a.errors], "counts": c}))';
  const r = spawnSync('python3', ['-I', '-c', py, f], { encoding: 'utf8', maxBuffer: 1 << 26 }); fs.unlinkSync(f);
  if (r.status !== 0) { if (/No module named|ENOENT/.test(r.stderr || '') || r.error) { EZ = false; console.log('       (ezdxf not available in Python: the ezdxf check is skipped)'); return { skipped: true }; } throw new Error(r.stderr); }
  EZ = true; stats.ez++; return JSON.parse(r.stdout);
}
/* entities of sheet s read back from the file: by index range (the writer keeps the entity order; dimensions are DIMENSION entities) */
const inSheet = (R, B, s) => R.entities.slice(s.i0, s.i1);
const of = (es, layer, type) => es.filter(e => e.layer === layer && (!type || e.type === type));
const box = e => { const xs = e.verts.map(v => v[0]), ys = e.verts.map(v => v[1]); return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }; };
/* Strength I envelope recomputed here (AASHTO LRFD 10th Ed. Table 3.4.1-1: γ_DC 1.25 / 0.90, γ_DW 1.50 / 0.65, γ_LL 1.75; Table 3.4.1-2) */
const strI = (dc, dw, ll, max) => (max ? (dc >= 0 ? 1.25 : 0.90) : (dc <= 0 ? 1.25 : 0.90)) * dc + (max ? (dw >= 0 ? 1.5 : 0.65) : (dw <= 0 ? 1.5 : 0.65)) * dw + 1.75 * ll;

function checkSet(P, name) {
  const G = DW.model(P); assert.deepEqual(J(G.errors), [], name);
  const RS = SH.results(P, G), date = '2026-10-30', B = SH.build(G, RS, { date }), t = B.D.toDXF(), v = X.validate(t); assert.ok(v.ok, `${name}: ${v.errors.slice(0, 4).join('; ')}`);
  const R = X.parse(t), nb = G.nb, pgs = RS.pgs, ids = B.sheets.map(s => s.id), ent = R.entities;
  assert.equal(ent.length, B.D.E.length, `${name}: one file entity per drawing entity`);
  // the sheet list: GirderDetail's order; one elevation per girder; splice sheets per plate girder and splice; diagrams per plate girder
  const want = ['cover', 'plan', 'erect', 'elev', ...G.girders.map(g => `gelev${g.i + 1}`), 'sec'];
  pgs.forEach(pg => (RS.pg[pg].spl ? RS.pg[pg].spl.list : []).forEach((s, k) => { if (s.R && s.R.fl && !(s.R.errors || []).length) want.push(`spl${pg}_${k}`); }));
  pgs.forEach(pg => { if (RS.pg[pg].an) want.push(`diag${pg}`); }); want.push('summ', 'reac', 'fat');
  if (G.deck.ohL > 0) want.push('oh'); want.push('bs', 'cf', 'ts', 'sc', 'std'); if (pgs.some(pg => RS.pg[pg].wt && RS.pg[pg].wt.R.tr.length)) want.push('wt');
  assert.deepEqual(J(ids), want, `${name}: sheets`); assert.equal(G.splices.length * pgs.length, ids.filter(i => /^spl/.test(i)).length, `${name}: every splice designed`);
  // every sheet: content inside the drawing area, border and title block (project, title, scale, n OF N)
  B.sheets.forEach(s => { const k = s.k, b = B.D.bbox(s.i0, s.iC); assert.ok(!s.over, `${name}: ${s.title} fits a scale`);
    assert.ok(b[0] >= s.ox + 1.25 * k - 1e-6 && b[2] <= s.ox + s.W - 1.0 * k + 1e-6 && b[1] >= 3.55 * k - 1e-6 && b[3] <= s.H - 1.0 * k + 1e-6, `${name}: ${s.title} inside its drawing area`);
    const es = inSheet(R, B, s), tb = of(es, 'S-TBLK', 'TEXT').map(e => e.get(1)), bd = of(es, 'S-BRDR', 'POLYLINE').map(box);
    assert.equal(bd.length, 2, `${name}: ${s.title} borders`); close(bd[0].x1 - bd[0].x0, 34 * k, 1e-6, 'sheet width'); close(bd[0].y1 - bd[0].y0, 22 * k, 1e-6, 'sheet height');
    [String(P.project.name).toUpperCase(), s.title, DW.SCALE_NAME[k], `${s.n} OF ${B.sheets.length}`].forEach(q => assert.ok(tb.includes(X.str(q)), `${name}: ${s.title} title block "${q}" in ${tb.join(' | ')}`));
    stats.sheets++; });
  const sh = id => B.sheets.find(s => s.id === id), esOf = id => inSheet(R, B, sh(id));
  // the cover's sheet index lists every sheet
  const cov = of(esOf('cover'), 'S-TABL', 'TEXT').map(e => e.get(1)); B.sheets.forEach(s => assert.ok(cov.includes(X.str(s.title)), `${name}: index lists ${s.title}`));
  // splice sheets: every bolt and the plates of the design
  pgs.forEach(pg => ((RS.pg[pg].spl || {}).list || []).forEach((s, k) => { const Rs = s.R, es = esOf(`spl${pg}_${k}`), F = Rs.fl, Wb = Rs.web;
    const nb_ = ['top', 'bot'].reduce((a, f) => a + 2 * F[f].nr * 2 * F[f].nl, 0) + 2 * Wb.bolts.length;
    const bolts = of(es, 'S-BOLT', 'CIRCLE'); assert.equal(bolts.length, nb_, `${name}: FS${k + 1} bolts`); bolts.forEach(c => close(+c.get(40), Rs.bolt.dh / 2, 1e-6, 'bolt hole radius')); stats.bolts += nb_;
    const pl = of(es, 'S-GRDR-PLAT', 'POLYLINE').map(box), has = (w, hh) => pl.some(q => Math.abs(q.x1 - q.x0 - w) < 1e-6 && Math.abs(q.y1 - q.y0 - hh) < 1e-6);
    ['top', 'bot'].forEach(f => assert.ok(has(F[f].Lpl, F[f].bo), `${name}: FS${k + 1} ${f} outer plate ${F[f].Lpl} x ${F[f].bo} (plan)`));
    assert.ok(has(Rs.gap + 2 * (Wb.ew + (Wb.ncw - 1) * Wb.sh + Wb.ewp), Wb.hw), `${name}: FS${k + 1} web plate`); }));
  // plan: a top splice plate (L_pl x b_o) at each girder's own splice station; elevations: plates and web bolts there
  const pls = of(esOf('plan'), 'S-SPLC-PLAT', 'POLYLINE').map(box);
  assert.equal(pls.length, nb * G.splices.length, `${name}: plan splice plates`);
  G.girders.forEach(g => g.spl.forEach((s, k) => { const Rs = DW.splR(RS, g, k); assert.ok(pls.some(q => Math.abs(q.x1 - q.x0 - Rs.fl.top.Lpl) < 1e-6 && Math.abs(q.y1 - q.y0 - Rs.fl.top.bo) < 1e-6), `${name}: plan plate ${g.label} FS${k + 1}`); stats.splPl++; }));
  G.girders.forEach(g => { const s = sh(`gelev${g.i + 1}`), es = inSheet(R, B, s), pl = of(es, 'S-SPLC-PLAT', 'POLYLINE').map(box), bo = of(es, 'S-BOLT', 'CIRCLE');
    assert.equal(pl.length, 3 * g.spl.length + g.spl.reduce((a, _, k) => { const F = DW.splR(RS, g, k).fl; return a + (F.top.inner ? 1 : 0) + (F.bot.inner ? 1 : 0); }, 0), `${name}: ${g.label} elevation splice plates`);
    assert.equal(bo.length, g.spl.reduce((a, _, k) => a + 2 * DW.splR(RS, g, k).web.bolts.length, 0), `${name}: ${g.label} elevation web bolts`);
    // splice plates centered on the girder's own splice station: the elevation's bearing triangles give the offset of the drawing
    const br = of(es, 'S-BRNG', 'POLYLINE').map(e => e.verts[0][0]), x0 = br[0] - g.bear[0] * 12;
    g.spl.forEach((sx, k) => { const Rs = DW.splR(RS, g, k), c = x0 + sx * 12, d = Math.min(...pl.filter(q => Math.abs(q.x1 - q.x0 - Rs.fl.top.Lpl) < 1e-6).map(q => Math.abs((q.x0 + q.x1) / 2 - c)));
      assert.ok(track(d) < 1e-5, `${name}: ${g.label} FS${k + 1} plate at ${sx} ft (${d})`); });
    // Strength I moment envelope (max solid, min hidden) and the camber diagram of this girder against the analysis
    const A = RS.pg[g.pg].an, st = A.st, ll = A.ll, ax = of(es, 'S-DIAG-AXIS', 'LINE')[0], y0 = +ax.get(20), ms = of(es, 'S-DIAG-STR', 'POLYLINE');
    assert.equal(ms.length, 2, `${name}: ${g.label} envelope lines`);
    const Mp = A.x.map((_, i) => strI(st.DC1.M[i] + st.DC2.M[i], st.DW.M[i], ll.Mpos[i], true)), Mn = A.x.map((_, i) => strI(st.DC1.M[i] + st.DC2.M[i], st.DW.M[i], ll.Mneg[i], false));
    const mx = Math.max(...Mp.map(Math.abs), ...Mn.map(Math.abs)), vs = 1.1 * s.k / mx;
    [[ms[0], Mp], [ms[1], Mn]].forEach(([pl_, Mv]) => { assert.equal(pl_.verts.length, A.x.length); pl_.verts.forEach((p, i) => { assert.ok(track(Math.abs(p[0] - (x0 + FRM.toG(G.FR, g.i, G.sup, A.x[i]) * 12))) < 1e-5, 'envelope x');
      const d = Math.abs((p[1] - y0) / vs - Mv[i]); assert.ok(d <= 1e-6 * mx, `${name}: ${g.label} M_u at ${A.x[i]}: ${(p[1] - y0) / vs} vs ${Mv[i]}`); }); stats.env += A.x.length; });
    const cb = of(es, 'S-CAMB'), cl = cb.filter(e => e.type === 'POLYLINE'), cax = cb.find(e => e.type === 'LINE'), yD = +cax.get(20), c = A.camber, mc = Math.max(...c.total.map(Math.abs)), vc = 1.5 * s.k / mc;
    assert.equal(cl.length, 1); cl[0].verts.forEach((p, i) => close((p[1] - yD) / vc, c.total[i], 1e-5 * mc, `${name}: ${g.label} camber ${i}`)); stats.cam += c.x.length; });
  // reactions: every DC1, DC2, DW, LL+IM value of every girder's plate girder
  const rt = of(esOf('reac'), 'S-TABL', 'TEXT').map(e => e.get(1));
  G.girders.forEach(g => { const A = RS.pg[g.pg].an; A.sup.forEach((_, k) => [A.st.DC1.R[k], A.st.DC2.R[k], A.st.DW.R[k], A.llR[k].max, A.llR[k].min].forEach(q => assert.ok(rt.includes(q.toFixed(2)), `${name}: reaction ${q.toFixed(2)}`))); });
  // summary rows = the Report tab's summary rows of each plate girder; transitions: one detail per distinct transition, every location listed
  const su = of(esOf('summ'), 'S-TABL', 'TEXT').filter(e => /^(OK|NG|WARNING|RF < 1)$/.test(e.get(1))); assert.equal(su.length, pgs.reduce((a, pg) => a + RS.pg[pg].gov.length, 0), `${name}: summary rows`);
  if (sh('wt')) { const tx = of(esOf('wt'), 'S-ANNO-TEXT', 'TEXT').map(e => e.get(1)), n = tx.filter(q => /FLANGE TRANSITION \(\d+ LOCATIONS?\)/.test(q)).reduce((a, q) => a + +/\((\d+) LOC/.exec(q)[1], 0);
    assert.equal(n, pgs.reduce((a, pg) => a + (RS.pg[pg].wt ? RS.pg[pg].wt.R.tr.length : 0), 0), `${name}: transition locations`); }
  // quantities: flange-to-web welds 4 lines over every girder's length; studs per zone ⌊L/p + 1⌋ × n per row on each girder's own length
  const Lg = G.girders.reduce((a, g) => a + (g.segs[g.segs.length - 1].s1 - g.segs[0].s0) * 12, 0), fw = B.Q.welds.filter(q => /^FLANGE-TO-WEB/.test(q.k)).reduce((a, q) => a + q.L, 0);
  close(fw, 4 * Lg, 1e-6, `${name}: flange-to-web weld length`);
  // ezdxf opens the whole set
  const z = ezdxf(t, name.replace(/\W+/g, '_')); if (!z.skipped) { assert.equal(z.v, 'AC1009'); assert.deepEqual(z.errors, [], `${name}: ezdxf audit`); assert.deepEqual(z.counts, J(v.counts)); }
  stats.cases++;
  return { G, RS, B, R };
}

let BUILT = null;
test('Sheets: built-in project, every sheet against the model and the results', () => { BUILT = checkSet(J(M.defaultProject()), 'built-in'); });

const PAY = [
  ['gd_builtin28_AASHTO_G1.json', { nb: 5, bays: [9.5, 9.5, 9.5, 9.5], skews: [28, 28, 28, 28], spl: [82, 145, 215, 278] }],
  ['gd_builtin_CTDOT_G3.json', { nb: 4, bays: [10, 10.5, 10], skews: [0, 0, 0, 0], spl: [90, 270] }],
  ['gd_curb_MassDOT_G2.json', { nb: 6, bays: [8, 8, 8.5, 8, 8], skews: [15, 15, 15, 15], spl: [] }],
  ['gd_util_RIDOT_G4.json', { nb: 7, bays: [7.5, 7.5, 7.5, 7.5, 7.5, 7.5], skews: [35, 35, 35, 35], spl: [85, 275] }],
  ['gd_xsA_AASHTO_G5.json', { nb: 3, bays: [11, 11], skews: [10, 30, 40, 25], spl: [100, 260] }]];
test('Sheets: five hand-off payloads (each with its own cross-section), every sheet against the model and the results', () => {
  for (const [f, o] of PAY) {
    const P = projectFromPayload(readPayload(f));
    P.xs = M.defaultXs(P); Object.assign(P.xs, { nb: o.nb, bays: o.bays, skews: o.skews });
    P.framing = { ...M.defaultFraming(), splices: o.spl }; P.stiffeners = M.defaultStiffeners(); P.crossframes = M.defaultCrossframes();
    P.studs = { ...M.defaultStuds(), zones: [{ x1: 0, x2: 30, nr: 3, p: 9 }, { x1: 30, x2: 360, nr: 3, p: 12 }] };
    P.project = { ...(P.project || {}), name: `Payload ${f.replace('.json', '')}`, number: 'T-1', designer: 'ML', checker: 'XX' };
    const { G, B } = checkSet(P, f);
    // studs: per girder and zone ⌊L_own·12/p + 1⌋ × 3 (zones at the girder's own stations)
    const n = G.girders.reduce((a, g) => a + [[0, 30, 9], [30, 360, 12]].reduce((b, [x1, x2, p]) => b + Math.floor((FRM.toG(G.FR, g.i, G.sup, x2) - FRM.toG(G.FR, g.i, G.sup, x1)) * 12 / p + 1) * 3, 0), 0);
    assert.equal(B.Q.rows.find(r => r[0] === 'SHEAR STUDS')[1], String(n), `${f}: studs`);
  }
  console.log(`       sheets vs model: ${stats.cases} projects, ${stats.sheets} sheets; ${stats.bolts} splice bolts, ${stats.splPl} plan splice plates, ${stats.env} envelope points, ${stats.cam} camber points; largest coordinate difference ${stats.worst.toExponential(2)} in; ezdxf opened ${stats.ez} files with no audit error`);
});

test('Hand check: built-in project sheets (FS1 bolts, weld quantities, plan splice plates, title block)', () => {
  const { G, RS, B } = BUILT || checkSet(J(M.defaultProject()), 'built-in');
  // 5 girders x 360 ft, one plate girder: 25 sheets (cover, plan, erection, elevation, 5 girder elevations, section, 4 splices, diagrams,
  // summary, reactions, fatigue, overhang, bearing stiffeners, cross-frames, stiffeners, studs, standard details, transitions)
  assert.equal(B.sheets.length, 25);
  // FS1 at 82 ft (Field splices tab design): bolts per flange = 2 sides x n_rows x 2 n_lines; web 2 x (rows x columns)
  const F = RS.pg[0].spl.list[0].R, nf = f => 2 * F.fl[f].nr * 2 * F.fl[f].nl;
  // the design (Field splices tab, auto-design): top 3 rows x 2 lines each side of the web: 2 x 3 x 4 = 24; bottom 4 x 2: 2 x 4 x 4 = 32;
  // web 11 rows x 2 columns = 22 per side, 44; 24 + 32 + 44 = 100 at FS1; the quantities sum the 4 splice designs of the one plate girder
  // over the 5 girder lines (2000 for this project)
  assert.deepEqual([nf('top'), nf('bot'), 2 * F.web.bolts.length], [24, 32, 44]);
  assert.equal(B.Q.rows.find(r => r[0] === 'H.S. BOLTS AT FIELD SPLICES')[1], '2000'); assert.equal('2000', String(5 * RS.pg[0].spl.list.reduce((a, s) => a + ['top', 'bot'].reduce((b, f) => b + 4 * s.R.fl[f].nr * s.R.fl[f].nl, 0) + 2 * s.R.web.bolts.length, 0)));
  console.log(`       FS1: top ${F.fl.top.nr} rows x ${F.fl.top.nl} lines = ${nf('top')} bolts, bottom ${nf('bot')}, web 2 x ${F.web.bolts.length}; L_pl top ${F.fl.top.Lpl} in, b_o ${F.fl.top.bo} in`);
  // weld quantities: flange-to-web 5/16 in (Table 6.13.3.4-1: thicker part > 3/4 in) on every segment: 4 lines x 5 x 360 ft = 7200 ft =
  // 86,400 in; weld metal w^2/2 x L x 490/1728 = 0.048828 x 86,400 x 0.283565 = 1196.3 lb
  const fw = B.Q.welds.find(q => /^FLANGE-TO-WEB/.test(q.k)); close(fw.w, 0.3125, 0, 'w'); close(fw.Lft, 7200, 1e-9, 'length'); close(fw.wt, 1196.3, 0.05, 'weld metal');
  // plates: the built-in girder G1 per 360 ft (segments of the Girders & plates tab) x 5 lines at 490 pcf
  const g = G.girders[0], A = g.segs.reduce((a, s) => a + (s.s1 - s.s0) * 12 * (s.topB * s.topT + s.botB * s.botT + s.D * s.tw), 0);
  close(B.Q.lb, 5 * A * 490 / 1728, 1e-6, 'plate weight');
  // title block of sheet 1: "NEW STEEL BRIDGE", "COVER AND SHEET INDEX", FULL SIZE (k = 1), "1 OF 25"
  assert.equal(B.sheets[0].k, 1); assert.equal(B.sheets[0].title, 'COVER AND SHEET INDEX');
});
