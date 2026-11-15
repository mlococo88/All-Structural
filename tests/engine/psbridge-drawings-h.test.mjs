// apps/ps-bridge batch H (2026-11-15): the Drawings tab's added sheets (ui/sheets.js PSBSheets.build), each number on a sheet = its model or
// engine value (display and export only; no new calculation):
//   H1. the cover and sheet index (every sheet of the set, numbered, with its title; the sheets left out), the general notes (the
//       specifications and editions named; each girder type's materials = its effective inputs, PSBDesign.cellInputs), the design summary (per
//       girder type and check group the governing check over its lines = the largest engine ratio R.checks[i].r of that group's checks, found
//       here directly from the engine results of every type on every line; the lowest HL-93 inventory RF).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', 'dxf.js', ...PBD, ...['sections', 'model', 'rigid', 'lldf-fg', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'handoffs', 'rating-along'].map(n => path.join(APP, `engine/${n}.js`)),
  ...['vizkit', 'strands', 'view3d', 'xsfig', 'plan', 'dash', 'summary', 'sheets'].map(n => path.join(APP, `ui/${n}.js`)));
W.PSBSections.install();
const X = W.SharedDxf, SH = W.PSBSheets, BR = W.PSBBridge, J = v => JSON.parse(JSON.stringify(v));
const f2 = v => (+v).toFixed(2), f3 = v => (+v).toFixed(3);
const compute = inp => W.PSBHoldDown.compute(J(inp));

function layouts() {
  const out = {};
  out.newProject = W.PSBModel.newProject();
  { const P = W.PSBModel.newProject(); P.project.name = 'Route 9 over the Mill River'; P.project.number = 'B-123'; P.project.owner = 'Town of Example'; P.spans.lengths = [80, 110, 80]; P.spans.continuity = 'composite'; P.xs.skews = [15, 15, 15, 15];
    P.xs.nb = 6; P.xs.bays = [8, 9, 9.5, 9, 8]; P.types = BR.newTypes(P); BR.syncSpans(P); out.threeSpans = P; }
  { const P = W.PSBModel.newProject(); P.base.owner = 'MassDOT'; P.base.mat.fc = 9; P.base.mat.fci = 7; P.types[1].ovr = Object.assign(P.types[1].ovr || {}, { 'mat.fc': 8 }); out.massdot = P; }
  return out;
}
const fill = P => { BR.fill(P); return P; };
/* the texts of a sheet's drawing (not its title block), and its table rows: TEXT entities of one table row share their y */
const texts = (B, s) => B.D.E.slice(s.i0, s.iC).filter(e => e.t === 'TEXT');
function rows(B, ids) {
  const out = [];
  B.sheets.filter(s => ids.test(s.id)).forEach(s => { const by = new Map();
    texts(B, s).forEach(e => { const y = e.pts[0][1].toFixed(4); if (!by.has(y)) by.set(y, []); by.get(y).push(e); });
    by.forEach(a => out.push(a.sort((p, q) => p.pts[0][0] - q.pts[0][0]).map(e => e.s))); });
  return out;
}
const up = v => X.str(String(v)).toUpperCase();

test('H1 cover: the sheet index lists every sheet of the set with its number and title; the title block says sheet n of N', () => {
  for (const [name, P0] of Object.entries(layouts())) for (const paper of ['D', 'B']) {
    const P = fill(J(P0)), B = SH.build(P, { paper, date: '2026-11-15' }), R = rows(B, /^cover\d*$/);
    assert.ok(B.sheets[0].id === 'cover', name);
    B.sheets.forEach(s => assert.ok(R.some(r => r[0] === String(s.n) && r[1] === up(s.title)), `${name} ${paper}: sheet ${s.n} ${s.title} in the index`));
    const T = texts(B, B.sheets[0]).map(e => e.s);
    assert.ok(T.includes(up(P.project.name)), name + ' project name');
    if (P.project.owner) assert.ok(T.some(t => t === up('OWNER / CLIENT: ' + P.project.owner)), name + ' owner');
    B.sheets.forEach(s => assert.ok(B.D.E.slice(s.iC, s.i1).some(e => e.t === 'TEXT' && e.s === `${s.n} OF ${B.sheets.length}`), `${name} ${s.id}: n OF N`));
  }
});

test('H1 general notes: the specifications named, the owner manual, and each girder type\'s materials = its inputs', () => {
  for (const [name, P0] of Object.entries(layouts())) {
    const P = fill(J(P0)), B = SH.build(P, { date: '2026-11-15' }), s = B.sheets.find(q => q.id === 'notes'), T = texts(B, s).map(e => e.s).join(' ');
    assert.ok(/AASHTO LRFD BRIDGE DESIGN SPECIFICATIONS, 10TH ED\. \(2024\)/.test(T) && /MBE\), 4TH ED\. \(2026\)/.test(T), name + ' editions');
    if (name === 'massdot') assert.ok(T.includes(up(W.PBD.OWN_RULES.owners.MassDOT.manual)), name + ' owner manual');
    else assert.ok(/OWNER RULES: NONE \(AASHTO\)/.test(T), name);
    assert.ok(T.includes(`FUTURE WEARING SURFACE ${(+P.xs.dl.fws).toFixed(1)} PSF`), name + ' fws');
    const R = rows(B, /^notes\d*$/);
    BR.types(P).forEach((t, k) => { const L = BR.typeLines(P, k); if (!L.length) return; const inp = W.PSBDesign.cellInputs(P, k, L[0]), m = inp.mat, st = inp.str;
      const r = R.find(q => q[0] === up(t.label)); assert.ok(r, `${name}: a row for ${t.label}`);
      assert.deepEqual(r.slice(2, 11), [up(inp.girder), f2(m.fc), f2(m.fci), f2(m.fcd), `${(+m.wcLoad).toFixed(3)} / ${(+m.wcdLoad).toFixed(3)}`, up(String(st.size).replace(/\s*in$/i, '"')), (+st.fpu).toFixed(1), f2(st.jack), String(Math.round(+st.Ep))], `${name} ${t.label}`); });
    if (name === 'massdot') assert.ok(R.some(r => r[0] === 'EXTERIOR S1' && r[3] === '8.00') && R.some(r => r[0] === 'INTERIOR S1' && r[3] === '9.00'), 'a type\'s own f\'c');
  }
});

test('H1 design summary: each row = the largest engine ratio of the group\'s checks over the type\'s lines (found here from the engine), the lowest RF', () => {
  const GR = W.PSBDashUI.GROUPS;
  for (const [name, P0] of Object.entries(layouts())) {
    const P = fill(J(P0)), B = SH.build(P, { date: '2026-11-15' }), R = rows(B, /^summ\d*$/).filter(r => r.length === 12 && r[0] !== 'TYPE');
    let n = 0;
    BR.types(P).forEach((t, k) => { const L = BR.typeLines(P, k); if (!L.length) return;
      const res = L.map(g => ({ g, R: compute(W.PSBDesign.cellInputs(P, k, g)) }));
      GR.forEach(gp => { let best = null;
        res.forEach(({ g, R: Rr }) => Rr.checks.forEach(q => { if (!gp.checks.some(([cn]) => cn === q.n)) return; const bad = x => typeof x !== 'number' || isNaN(x);
          if (!best || (bad(q.r) && !bad(best.q.r)) || (!bad(q.r) && !bad(best.q.r) && q.r > best.q.r)) best = { q, g }; }));
        const row = R.find(r => r[0] === up(t.label) && r[3] === up(gp.name));
        if (!best) { assert.ok(!row, `${name} ${t.label} ${gp.name}: no row`); return; }
        assert.ok(row, `${name} ${t.label} ${gp.name}: a row`); n++;
        assert.equal(row[4], up(best.q.n)); assert.equal(row[5], 'G' + best.g);
        assert.equal(row[7], f3(best.q.v), `${name} ${gp.name} demand`); assert.equal(row[8], f3(best.q.lim), `${name} ${gp.name} limit`); assert.equal(row[10], f3(best.q.r), `${name} ${gp.name} ratio`);
        assert.equal(row[11], !best.q.pass ? 'FAIL' : isFinite(best.q.r) ? 'PASS' : 'REVIEW'); });
      // the lowest HL-93 inventory RF of the type (the Summary tab's, ui/summary.js rfOf over the lines)
      const rf = res.map(({ g, R: Rr }) => W.PSBDashUI.RATING.rf.map(([nm, f]) => ({ nm, v: f(Rr), g })).filter(z => typeof z.v === 'number' && z.v < 99)).flat().reduce((b, z) => !b || z.v < b.v ? z : b, null);
      const rr = R.find(r => r[0] === up(t.label) && r[3] === 'RATING (HL-93 INVENTORY)');
      if (rf) { assert.ok(rr, name + ' RF row'); assert.equal(rr[10], f3(rf.v)); assert.equal(rr[5], 'G' + rf.g); assert.equal(rr[4], up(rf.nm)); }
    });
    assert.ok(n > 5, `${name}: ${n} rows checked`);
  }
});
