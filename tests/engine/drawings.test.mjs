// shared/dxf.js (the DXF R12 writer) and apps/steel-bridge/engine/drawings.js (framing plan, girder elevation, typical section).
// Display and export only: nothing here changes a computed result. The checks are that the file is well formed and that the drawing
// is the model:
// 1. SharedDxf: a sample drawing with every entity type; the file's structure (HEADER / TABLES / BLOCKS / ENTITIES / EOF, group-code
//    pairs, CRLF), the values read back, the text clean-up and the feet-inch format; ezdxf (Python) opens it with no audit error when
//    it is installed (else skipped with a note).
// 2. The built-in project and 5 hand-off payloads (tests/projects/st, each given its own cross-section: girder count, spacings, skews
//    equal and unequal, splices): each drawing written alone as DXF and read back: girder count and spacing (girder centerlines), cross-frame
//    stations (every frame line = the framing layout's work points), plate breaks (elevation plate rectangles = the plate segments mapped
//    to the girder's own stations), bearings, field splices, section girders and deck width; the three drawings together pass validate()
//    and ezdxf.
// 3. Hand check on the built-in project (arithmetic in the comments).
// The 3D view (ui/view3d.js) builds from the same model() geometry; it is checked in the browser smoke test.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadShared, test, ROOT } from './harness.mjs';
import { projectFromPayload, readPayload } from './an-fixture.mjs';

const ENG = f => path.join(ROOT, 'apps/steel-bridge/engine', f);
const W = loadShared('units.js', 'steps.js', 'lldf.js', 'dxf.js', ENG('model.js'), ENG('owners.js'), ENG('sections.js'), ENG('lldf.js'), ENG('loads.js'), ENG('shear.js'), ENG('stiffeners.js'),
  ENG('flexure.js'), ENG('framing.js'), ENG('crossframes.js'), ENG('drawings.js'));
const X = W.SharedDxf, DW = W.SBDDrawings, FRM = W.SBDFraming, M = W.SBDModel;
const J = o => JSON.parse(JSON.stringify(o));
const deq = (a, b, m) => assert.deepEqual(J(a), J(b), m);   // values made in the vm context have its prototypes: compare as JSON
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= (tol == null ? 1e-4 : tol), `${what}: ${a} vs ${b}`);

/* ezdxf (Python), when installed: open the file, audit it; returns { skipped } or { errors, counts } */
let EZ = null;
function ezdxf(text, name) {
  if (EZ === false) return { skipped: true };
  const f = path.join(os.tmpdir(), `sbd2-dxf-${process.pid}-${name}.dxf`); fs.writeFileSync(f, text);
  const py = 'import sys, json\nimport ezdxf\nd = ezdxf.readfile(sys.argv[1])\na = d.audit()\nc = {}\nfor e in d.modelspace(): c[e.dxftype()] = c.get(e.dxftype(), 0) + 1\n'
    + 'print(json.dumps({"v": d.dxfversion, "errors": [e.message for e in a.errors], "counts": c}))';
  const r = spawnSync('python3', ['-I', '-c', py, f], { encoding: 'utf8' }); fs.unlinkSync(f);
  if (r.status !== 0) { if (/No module named|ENOENT/.test(r.stderr || '') || r.error) { EZ = false; console.log('       (ezdxf not available in Python: the ezdxf check is skipped)'); return { skipped: true }; } throw new Error(r.stderr); }
  EZ = true; stats.ez++; return JSON.parse(r.stdout);
}

test('SharedDxf: a sample drawing is a well-formed R12 file and reads back', () => {
  const D = X.drawing({ prefix: 'T-' }); D.h = 2; D.k = 12;
  const l = D.layer('PART', 5), d = D.layer('DIMS', 7);
  D.line(l, 0, 0, 100, 0); D.pline(l, [[0, 0], [100, 0], [100, 20], [0, 20]], true, D.ltype('CENTER')); D.circle(l, 50, 10, 5); D.arc(l, 50, 10, 8, 30, 120);
  D.text(l, 50, 25, 2, 'TOP FL. 16 × 3/4, 15°, ℄ BRG., Ø7/8, é', 1, 30); D.dimH(d, 0, 100, -10, 0); D.chainH(d, [0, 25, 50, 75, 100], -20, 0); D.dimV(d, 0, 20, -10, 0, 'D = <>');
  const t = D.toDXF();
  // CRLF, group codes right-aligned in 3 columns, an even number of lines
  assert.ok(/\r\n/.test(t) && !/[^\r]\n/.test(t), 'CRLF line ends');
  const ln = t.split('\r\n'); ln.pop(); assert.equal(ln.length % 2, 0, 'pairs');
  for (let i = 0; i < ln.length; i += 2) assert.match(ln[i], /^[ \d-]{3}$|^\d{4,}$/, `group code at line ${i + 1}`);
  deq([ln[0], ln[1], ln[2], ln[3]], ['  0', 'SECTION', '  2', 'HEADER']); deq(ln.slice(-2), ['  0', 'EOF']);
  const R = X.parse(t), v = X.validate(t);
  deq(R.errors, []); assert.ok(v.ok, v.errors.join('; '));
  deq([...R.order], ['HEADER', 'TABLES', 'BLOCKS', 'ENTITIES']);
  deq(J(v.counts), { LINE: 1, POLYLINE: 1, CIRCLE: 1, ARC: 1, TEXT: 1, DIMENSION: 3 });
  const E = R.entities, by = ty => E.filter(e => e.type === ty);
  deq([+by('LINE')[0].get(10), +by('LINE')[0].get(21)], [0, 0]); assert.equal(+by('LINE')[0].get(11), 100);
  deq(J(by('POLYLINE')[0].verts), [[0, 0], [100, 0], [100, 20], [0, 20]]); assert.ok(by('POLYLINE')[0].closed); assert.equal(by('POLYLINE')[0].lt, 'CENTER_12');
  assert.equal(+by('CIRCLE')[0].get(40), 5); deq([+by('ARC')[0].get(50), +by('ARC')[0].get(51)], [30, 120]);
  const tx = by('TEXT')[0]; assert.equal(tx.get(1), 'TOP FL. 16 x 3/4, 15%%d, CL BRG., %%c7/8, \\U+00E9'); assert.equal(tx.get(72), '1'); assert.equal(+tx.get(50), 30);
  // dimensions: measured text in feet-inches; the run of 4 equal spaces as one "4@"; every block exists
  deq(by('DIMENSION').map(e => e.get(1)), [`8'-4"`, `4@2'-1"`, `D = 1'-8"`]);
  by('DIMENSION').forEach(e => assert.ok(R.blocks[e.get(2)] && R.blocks[e.get(2)].ents.length >= 5));
  // LTYPE CENTER scaled to the drawing scale: 1.25, −0.25, 0.25, −0.25 × 0.4k (k = 12): 6, −1.2, 1.2, −1.2
  const ltc = R.tables.LTYPE.find(r => r.codes.some(q => q[0] === 2 && q[1] === 'CENTER_12'));
  deq(ltc.codes.filter(q => q[0] === 49).map(q => +q[1]), [6, -1.2, 1.2, -1.2]);
  // a broken file is caught
  assert.ok(!X.validate(t.replace('ENTITIES', 'ENTITYS')).ok); assert.ok(!X.validate(t.replace(/\s+0\r\nEOF\r\n$/, '\r\n')).ok);
  assert.ok(!X.validate(t.replace('  8\r\nT-PART', '  8\r\nNOPE')).ok);
  // ezdxf opens it (R12) with no audit error
  const z = ezdxf(t, 'sample'); if (!z.skipped) { assert.equal(z.v, 'AC1009'); deq(z.errors, []); deq(z.counts, { LINE: 1, POLYLINE: 1, CIRCLE: 1, ARC: 1, TEXT: 1, DIMENSION: 3 }); }
});

test('SharedDxf: fractions and feet-inches (hand check)', () => {
  // plate sizes to 1/16 (GirderDetail frac): 1.125 = 1 1/8, 0.5625 = 9/16; dimensions to 1/8 (dxfIn, dxfFI): 0.5625·8 = 4.5 rounds to 5 → 5/8";
  // 148.5 in = 12 ft 4.5 in; 11.99 in rounds to 12 in = 1'-0"
  assert.equal(X.frac(1.125), '1 1/8'); assert.equal(X.frac(0.5625), '9/16'); assert.equal(X.frac(0.5625, 8), '5/8'); assert.equal(X.frac(2), '2');
  assert.equal(X.fmtIn(0.5625), '5/8"'); assert.equal(X.fmtIn(0.875), '7/8"');
  assert.equal(X.fmtFtIn(148.5), `12'-4 1/2"`); assert.equal(X.fmtFtIn(11.99), `1'-0"`); assert.equal(X.fmtFtIn(6.25), `6 1/4"`);
});

/* ---------- the drawings against the model ---------- */
const EPS = 1e-3;   // in: the file writes 6 decimals
/* one drawing alone, as DXF read back */
function alone(G, fn) { const D = X.drawing({ prefix: 'S-' }); fn(D); const t = D.toDXF(), v = X.validate(t); assert.ok(v.ok, v.errors.join('; ')); return { R: X.parse(t), t, D }; }
const ents = (R, layer, type) => R.entities.filter(e => e.layer === layer && (!type || e.type === type));
const lineXY = e => [+e.get(10), +e.get(20), +e.get(11), +e.get(21)];
const stats = { cases: 0, frames: 0, girders: 0, plates: 0, worst: 0, ez: 0 };
const track = (a, b) => { const d = Math.abs(a - b); if (d > stats.worst) stats.worst = d; return d; };

function checkDrawings(P, name) {
  const G = DW.model(P); deq(G.errors, [], `${name}: ${G.errors}`);
  const L = FRM.compute(P), FR = L.FR, nb = G.nb;
  // girder count and spacing: the plan's girder centerlines at y = ys·12, from the Abut. 1 to the Abut. 2 bearing of each girder
  const { R: Rp } = alone(G, D => DW.plan(G, D));
  const cl = ents(Rp, 'S-GRDR-CNTR', 'LINE').map(lineXY).sort((a, b) => a[1] - b[1]);
  assert.equal(cl.length, nb, `${name}: girder centerlines`); assert.equal(nb, Math.round(P.xs.nb));
  cl.forEach((c, i) => { const g = FR.girders[i]; assert.ok(track(c[1], FR.ys[i] * 12) < EPS && track(c[3], FR.ys[i] * 12) < EPS, `${name}: G${i + 1} y`);
    assert.ok(track(c[0], g.x0 * 12) < EPS && track(c[2], (g.x0 + g.bear[g.bear.length - 1]) * 12) < EPS, `${name}: G${i + 1} bearings`); });
  cl.slice(1).forEach((c, i) => close(c[1] - cl[i][1], P.xs.bays[i] * 12, EPS, `${name}: spacing ${i + 1}`));
  stats.girders += nb;
  // cross-frames: every frame line on its work points (x_a on girder bay, x_c on girder bay + 1), intermediate and end frames on their layers
  const fl = [...ents(Rp, 'S-XFRM', 'LINE').map(e => ['int', ...lineXY(e)]), ...ents(Rp, 'S-XFRM-END', 'LINE').map(e => ['sup', ...lineXY(e)])];
  assert.equal(fl.length, FR.frames.length, `${name}: frame count`);
  const key = (t, a) => `${t}|${a.map(v => v.toFixed(2)).join(',')}`, have = new Map(); fl.forEach(f => { const k = key(f[0], f.slice(1)); have.set(k, (have.get(k) || 0) + 1); });
  FR.frames.forEach(f => { const k = key(f.type === 'sup' ? 'sup' : 'int', [f.xa * 12, FR.ys[f.bay] * 12, f.xc * 12, FR.ys[f.bay + 1] * 12]); assert.ok(have.get(k) > 0, `${name}: frame ${k} not drawn`); have.set(k, have.get(k) - 1); });
  stats.frames += FR.frames.length;
  // field splices: one tick per girder per splice at the girder's own station
  const sp = ents(Rp, 'S-SPLC', 'LINE').map(lineXY); assert.equal(sp.length, nb * L.m.splices.length, `${name}: splice ticks`);
  FR.girders.forEach((g, i) => L.m.splices.forEach(s => { const x = (g.x0 + FRM.toG(FR, i, L.m.sup, s)) * 12; assert.ok(sp.some(q => Math.abs(q[0] - x) < EPS && Math.abs(q[1] - (g.y * 12 - Math.abs(q[3] - q[1]) / 2)) < EPS), `${name}: G${i + 1} splice at ${s}`); }));
  // plate breaks: every girder's elevation, the plate rectangles = the plate segments at the girder's own stations (toG); the last plate ends
  // at the girder's Abut. 2 bearing; the stiffeners drawn = connection plates + bearing stiffener plates + intermediate stiffeners
  for (let i = 0; i < nb; i++) {
    const g = G.girders[i], Seg = P.girders[g.pg].segments, { R: Re } = alone(G, D => DW.elevation(G, D, i));
    const pl = ents(Re, 'S-GRDR-PLAT', 'POLYLINE').map(e => { const xs = e.verts.map(v => v[0]), ys = e.verts.map(v => v[1]); return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }; });
    const top = pl.filter(q => q.y0 > 0).sort((a, b) => a.x0 - b.x0), bot = pl.filter(q => q.y1 <= 1e-9).sort((a, b) => a.x0 - b.x0);
    assert.equal(top.length, Seg.length, `${name}: G${i + 1} top plates`); assert.equal(bot.length, Seg.length, `${name}: G${i + 1} bottom plates`);
    Seg.forEach((s, k) => { const a = FRM.toG(FR, i, L.m.sup, s.x0) * 12, b = FRM.toG(FR, i, L.m.sup, s.x1) * 12;
      assert.ok(track(top[k].x0, a) < EPS && track(top[k].x1, b) < EPS && track(bot[k].x0, a) < EPS && track(bot[k].x1, b) < EPS, `${name}: G${i + 1} plate ${k + 1} at ${a}..${b}`);
      close(top[k].y1 - top[k].y0, s.topT, EPS, `${name}: G${i + 1} t_top ${k + 1}`); close(bot[k].y1 - bot[k].y0, s.botT, EPS, `${name}: G${i + 1} t_bot ${k + 1}`); close(top[k].y0, s.D, EPS, `${name}: G${i + 1} D ${k + 1}`); });
    if (Math.abs(Seg[Seg.length - 1].x1 - L.m.sup[L.m.sup.length - 1]) < 1e-9) close(top[top.length - 1].x1, g.bear[g.bear.length - 1] * 12, EPS, `${name}: G${i + 1} last plate at the Abut. 2 bearing`);
    stats.plates += Seg.length;
    const own = FR.girders[i].pts.filter(q => q.f.type !== 'sup').map(q => q.s * 12).sort((a, b) => a - b), npB = g.bear.map((_, k) => { const T = P.stiffeners.bearing.types[k === 0 || k === g.bear.length - 1 ? 'A' : 'B']; return 2 * T.np; }).reduce((a, b) => a + b, 0);
    const st = ents(Re, 'S-GRDR-STIF', 'LINE');
    assert.equal(st.length, new Set(own.map(v => v.toFixed(4))).size + npB + g.stiff.length, `${name}: G${i + 1} stiffener lines`);
    own.forEach(x => assert.ok(st.some(e => Math.abs(+e.get(10) - x) < EPS), `${name}: G${i + 1} connection plate at ${x}`));
    // bearings: one triangle per support at the girder's own bearing station
    const br = ents(Re, 'S-BRNG', 'POLYLINE').map(e => e.verts[0][0]); assert.equal(br.length, g.bear.length); g.bear.forEach((b, k) => close(br[k], b * 12, EPS, `${name}: G${i + 1} bearing ${k + 1}`));
  }
  // section: 3 plates per girder, webs on the girder lines, deck width = bays + overhangs
  const { R: Rs } = alone(G, D => DW.section(G, D));
  const gr = ents(Rs, 'S-GRDR', 'POLYLINE'); assert.equal(gr.length, 3 * nb, `${name}: section plates`);
  const webs = gr.map(e => e.verts.map(v => v[0])).filter((xs, j) => j % 3 === 1).map(xs => (Math.min(...xs) + Math.max(...xs)) / 2);
  webs.forEach((x, i) => close(x, FR.ys[i] * 12, EPS, `${name}: section web G${i + 1}`));
  const dk = ents(Rs, 'S-DECK', 'POLYLINE')[0].verts.map(v => v[0]); close(Math.max(...dk) - Math.min(...dk), (FR.ys[nb - 1] + P.xs.ohL + P.xs.ohR) * 12, EPS, `${name}: deck width`);
  // all three in one file: valid, ezdxf opens it
  const A = DW.all(G, { gi: Math.min(1, nb - 1) }), t = A.D.toDXF(), v = X.validate(t); assert.ok(v.ok, v.errors.join('; '));
  const z = ezdxf(t, name.replace(/\W+/g, '_')); if (!z.skipped) { assert.equal(z.v, 'AC1009'); deq(z.errors, [], `${name}: ezdxf audit`); deq(z.counts, J(v.counts)); }
  stats.cases++;
  return { G, L, t };
}

test('Built-in project: plan, elevation and section match the model', () => { checkDrawings(J(M.defaultProject()), 'built-in'); });

/* five hand-off payloads, each with its own cross-section and framing (the payloads are all GirderDetail's 110-140-110 ft bridge) */
const PAY = [
  ['gd_builtin28_AASHTO_G1.json', { nb: 5, bays: [9.5, 9.5, 9.5, 9.5], skews: [28, 28, 28, 28], spl: [82, 145, 215, 278] }],
  ['gd_builtin_CTDOT_G3.json', { nb: 4, bays: [10, 10.5, 10], skews: [0, 0, 0, 0], spl: [90, 270] }],
  ['gd_curb_MassDOT_G2.json', { nb: 6, bays: [8, 8, 8.5, 8, 8], skews: [15, 15, 15, 15], spl: [] }],
  ['gd_util_RIDOT_G4.json', { nb: 7, bays: [7.5, 7.5, 7.5, 7.5, 7.5, 7.5], skews: [35, 35, 35, 35], spl: [85, 275] }],
  ['gd_xsA_AASHTO_G5.json', { nb: 3, bays: [11, 11], skews: [10, 30, 40, 25], spl: [100, 260] }]];
test('Five hand-off payloads (each with its own cross-section): plan, elevation and section match the model', () => {
  for (const [f, o] of PAY) {
    const P = projectFromPayload(readPayload(f));
    P.xs = M.defaultXs(P); Object.assign(P.xs, { nb: o.nb, bays: o.bays, skews: o.skews });
    P.framing = { ...M.defaultFraming(), splices: o.spl }; P.stiffeners = M.defaultStiffeners(); P.crossframes = M.defaultCrossframes();
    P.studs = { ...M.defaultStuds(), zones: [{ x1: 0, x2: 30, nr: 3, p: 9 }, { x1: 30, x2: 360, nr: 3, p: 12 }] };
    const { G } = checkDrawings(P, f);
    // stud zones at the girder's own stations
    G.girders.forEach((g, i) => { close(g.studs[1].s1, FRM.toG(G.FR, i, G.sup, 360), 1e-9, `${f}: studs G${i + 1}`); });
  }
  console.log(`       drawings vs model: ${stats.cases} projects, ${stats.girders} girders, ${stats.frames} cross-frames, ${stats.plates} plate segments; largest coordinate difference ${stats.worst.toExponential(2)} in; ezdxf opened ${stats.ez} files with no audit error`);
  assert.ok(stats.frames > 300);
});

test('Hand check: built-in project (110-140-110 ft, 5 girders at 9.5 ft, no skew, s = 25 ft, plates change at 88, 128, 232, 272 ft)', () => {
  const P = J(M.defaultProject()), G = DW.model(P), D = X.drawing({ prefix: 'S-' }); DW.plan(G, D);
  const R = X.parse(D.toDXF());
  // girder centerlines at y = 0, 9.5, 19, 28.5, 38 ft = 0, 114, 228, 342, 456 in; each from x = 0 to 110 + 140 + 110 = 360 ft = 4320 in
  deq(ents(R, 'S-GRDR-CNTR').map(e => [+e.get(20), +e.get(10), +e.get(11)]), [[0, 0, 4320], [114, 0, 4320], [228, 0, 4320], [342, 0, 4320], [456, 0, 4320]]);
  // span 1: no skew, parallel frames, n = ⌈110/25⌉ − 1 = 4 per bay at 110/5 = 22 ft (22, 44, 66, 88 ft) in each of the 4 bays (16);
  // span 2: ⌈140/25⌉ − 1 = 5 at 140/6 = 23.333 ft; span 3 as span 1: 4 × (4 + 5 + 4) = 52 intermediate; end frames 4 supports × 4 bays = 16.
  // The frame at 88 ft falls on the flange transition at 88 ft (within the 2 ft splice and transition clearance), so the layout shifts the
  // span-1 grid by 2.2 ft (same number of frames): 24.2, 46.2, 68.2, 90.2 ft = 290.4, 554.4, 818.4, 1082.4 in (90.2 − 88 = 2.2 ≥ 2 ft; 90.2 − 82
  // = 8.2 ft from FS1). The framing test (tests/engine/framing.test.mjs) checks the layout against Preliminary sizing; here: drawing = layout.
  const xf = ents(R, 'S-XFRM', 'LINE'), xe = ents(R, 'S-XFRM-END', 'LINE'); assert.equal(xf.length, 52); assert.equal(xe.length, 16);
  const span1 = [...new Set(xf.map(e => +e.get(10)).filter(x => x < 1320))].sort((a, b) => a - b); deq(span1, [290.4, 554.4, 818.4, 1082.4]);
  // the plate breaks of the elevation: 88 ft = 1056 in, 128 ft = 1536 in, 232 ft = 2784 in, 272 ft = 3264 in; top flange 16 × 3/4 then 18 × 1 1/2
  const E = X.drawing({ prefix: 'S-' }); DW.elevation(G, E, 1); const Re = X.parse(E.toDXF());
  const top = ents(Re, 'S-GRDR-PLAT').map(e => e.verts).filter(v => v[0][1] > 0).map(v => [v[0][0], v[1][0], v[2][1] - v[0][1]]);
  assert.ok(ents(Re, 'S-ANNO-TEXT', 'TEXT').some(e => e.get(1) === 'WEB 60 x 9/16'), 'web 60 × 9/16 labeled to 1/16');
  deq(top, [[0, 1056, 0.75], [1056, 1536, 1.5], [1536, 2784, 0.75], [2784, 3264, 1.5], [3264, 4320, 0.75]]);
  // section: deck 9.5 × 4 + 2 × 3.25 = 44.5 ft = 534 in wide, 8 in thick on a 2 in haunch over the 3/4 in top flange
  const S = X.drawing({ prefix: 'S-' }); DW.section(G, S); const Rs = X.parse(S.toDXF()), dk = ents(Rs, 'S-DECK', 'POLYLINE')[0].verts;
  deq([Math.min(...dk.map(v => v[0])), Math.max(...dk.map(v => v[0])), Math.min(...dk.map(v => v[1])), Math.max(...dk.map(v => v[1]))], [-39, 495, 2, 10]);
  // dimension texts on the plan: girder spacing "4@9'-6"", spans "SPAN 1 = 110'-0" (G1)"
  const dt = ents(R, 'S-DIMS', 'DIMENSION').map(e => e.get(1));
  assert.ok(dt.includes(`4@9'-6"`)); assert.ok(dt.includes(`SPAN 1 = 110'-0" (G1)`)); assert.ok(dt.includes(`SPAN 2 = 140'-0" (G1)`));
});
