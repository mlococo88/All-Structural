// "Timber Beam Check.html", graphics (fix log TBGX, engineer decision 2026-11-16; display only): the pure TBGX block (between
// /* TBGX-BEGIN and /* TBGX-END */) run in the engine's Node vm. Each figure's key numbers — the dimensions, stresses, factor bars,
// ratios, axle positions, … it draws — must equal the engine's values (R = tbcRun, A = tbcAashto, AL = tbcAasLoads, AD = aasDemands,
// AC = tbcAasChecks): the figures draw engine numbers and compute nothing new.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { tbcEngine, TBC_FILE } from './tbc-source.mjs';

const html = fs.readFileSync(TBC_FILE, 'utf8');
const E = tbcEngine(TBC_FILE, html);
{ const a = html.indexOf('/* TBGX-BEGIN'), b = html.indexOf('/* TBGX-END */'); assert.ok(a > 0 && b > a, 'TBGX markers'); vm.runInContext(html.slice(a, b).replace(/^(const|let) /gm, 'var '), E); }
const G = E.TBGX;
const J = v => JSON.parse(JSON.stringify(v));
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`);
const nds = fn => { const m = E.tbcDefaultModel(); fn && fn(m); const R = E.tbcRun(m); assert.ok(R.ok, (R.errors || []).join('; ')); return { m, R }; };
const aas = fn => { const m = E.tbcDefaultModel(); m.design.code = 'AASHTO'; m.design.aashto = E.tbcAashtoDefaults(); m.design.aashto.bl = E.tbcAasLoadDefaults(); m.design.moisture = 'Wet'; fn && fn(m);
  const A = E.tbcAashto(m), AL = E.tbcAasLoads(m, A); assert.ok(AL.ok, (AL.errors || []).join('; ')); const AD = E.aasDemands(AL), AC = E.tbcAasChecks(m, A, AL, AD); assert.ok(AC.ok, AC.errors.join('; ')); return { m, A, AL, AD, AC }; };
const NDS_CASES = {
  sawnASD: m => { },
  sawnLRFD: m => { m.design.method = 'LRFD'; m.material.size = '2x12'; m.material.grade = 'No.1'; },
  glulamCont: m => { m.material.type = 'glulam'; m.material.glulam.combo = '24F-1.8E'; m.geom.spacing = 96; m.geom.spans = [{ L: 22 }, { L: 18 }]; m.geom.supports = [{ t: 'pin', lb: 3.5, cb: false }, { t: 'pin', lb: 5.5, cb: true }, { t: 'pin', lb: 3.5, cb: false }]; m.loads.L = 0; m.loads.S = 30; m.material.notch = 1; },
  timberFlatWet: m => { m.material.size = '6x12'; m.material.grade = 'No.1'; m.design.moisture = 'Wet'; m.design.flatUse = true; m.geom.spacing = 48; },
  scl: m => { m.material.type = 'scl'; Object.assign(m.material.scl, { Fb: 2600, Fv: 285, Fcp: 750, E: 1900000, Emin: 966000, n: 0.111, dens: 42 }); },
  notchComp: m => { m.material.size = '4x12'; m.material.notch = 1.5; m.material.notchFace = 'comp'; },
};
const AAS_CASES = {
  sawnSimple: m => { m.material.size = '10x16'; m.design.aashto.gr = 'No.1'; m.geom.spacing = 24; m.geom.spans = [{ L: 16 }]; m.geom.supports = [0, 1].map(() => ({ t: 'pin', lb: 5.5, cb: false })); m.design.aashto.bl.tWs = 2; },
  glulamCont: m => { m.material.type = 'glulam'; m.material.glulam.grp = 'DF'; m.material.glulam.b = 6.75; m.material.glulam.nLam = 16; m.geom.spacing = 48; m.geom.spans = [{ L: 30 }, { L: 30 }]; m.geom.supports = [0, 1, 2].map(() => ({ t: 'pin', lb: 5.5, cb: false })); Object.assign(m.design.aashto.bl, { deck: 'glpanel', tD: 5.125, tWs: 3 }); m.design.latBot = 'Supports'; m.design.luBot = 10; },
  exterior: m => { m.material.size = '8x16'; m.design.aashto.gr = 'SS'; m.geom.spacing = 24; m.geom.spans = [{ L: 18 }]; m.geom.supports = [0, 1].map(() => ({ t: 'pin', lb: 5.5, cb: false })); Object.assign(m.design.aashto.bl, { pos: 'ext', de: 1.5 }); },
  permitOverhang: m => { m.material.type = 'glulam'; m.material.glulam.grp = 'DF'; m.material.glulam.b = 6.75; m.material.glulam.nLam = 20; m.geom.spacing = 48; m.geom.spans = [{ L: 24 }, { L: 6 }]; m.geom.supports = [{ t: 'pin', lb: 6, cb: false }, { t: 'pin', lb: 6, cb: false }, { t: 'free', lb: 3.5, cb: false }]; Object.assign(m.design.aashto.bl, { deck: 'glpanel', permit: '20, 30@14, 30@4' }); },
};

test('section (NDS): b_w × d_b as loaded, laminations, notch, f_b and F′_b of the governing bending combination', () => {
  for (const [name, fn] of Object.entries(NDS_CASES)) {
    const { m, R } = nds(fn), s = G.ndsSection(R, m, false), d = J(s.data), c = R.gov.b;
    assert.equal(d.bw, R.bw, name + ' bw'); assert.equal(d.dep, R.dep, name + ' dep'); assert.equal(d.yNA, R.dep / 2, name + ' N.A.'); assert.equal(d.flat, !!R.flat, name + ' flat');
    assert.equal(d.stress.f, c.fb, name + ' f_b'); assert.equal(d.stress.F, c.Fb_p, name + ' F′_b'); assert.equal(d.stress.ratio, c.r_b, name + ' ratio');
    assert.equal(d.stress.sign, R.legacyBend ? (c.bend[0].Mp >= c.bend[0].Mn ? 1 : -1) : c.gbSign, name + ' sign');
    if (R.hasNotch) { assert.equal(d.notch.n, R.notch, name + ' notch'); assert.equal(d.notch.dn, R.dn, name + ' d_n'); assert.equal(d.notch.face, R.notchFace, name + ' face'); } else assert.equal(d.notch, null, name + ' no notch');
    if (R.isGL) { const grp = E.GLULAM_GRP[(E.GLULAM_5A[m.material.glulam.combo] || {}).grp || m.material.glulam.grp]; assert.equal(d.nLam, m.material.glulam.nLam); assert.equal(d.tLam, grp.lam); close(d.nLam * d.tLam, R.dep, 1e-12, name + ' n t = d'); }
    else assert.equal(d.nLam, null, name + ' no laminations');
    assert.ok(s.svg.includes('<svg') && s.svg.includes(`data-bw="${R.bw}"`) && s.svg.includes(`data-dep="${R.dep}"`), name + ' svg');
    const sm = G.ndsSection(R, m, true); assert.equal(sm.data.stress, null, name + ' small: no stress'); assert.equal(sm.data.bw, R.bw);
  }
  const { m, R } = nds(NDS_CASES.timberFlatWet); assert.equal(R.flat, true); assert.equal(R.bw, R.d); assert.equal(G.ndsSection(R, m).data.bw, R.d, 'flat: the wide face across');
});

test('factor chain (NDS): F_b × the factors of fbFacs = F′_b of the engine; the last bar is the engine value', () => {
  for (const [name, fn] of Object.entries(NDS_CASES)) {
    const { m, R } = nds(fn), o = G.ndsFbChain(R, m), c = R.gov.b, w = G.waterfall(o), rows = J(w.data.rows);
    const sg = R.legacyBend ? 1 : c.gbSign;
    assert.equal(rows[0].v, R.isGL && sg < 0 ? R.ref.Fbn : R.ref.Fb, name + ' reference F_b');
    const prod = o.steps.filter(s => s.f != null).reduce((p, s) => p * s.f, o.base.v);
    close(prod, c.Fb_p, 1e-9, name + ' product of the factors = F′_b');
    assert.equal(rows[rows.length - 1].v, c.Fb_p, name + ' last bar = engine F′_b'); assert.equal(rows[rows.length - 1].kind, 'final');
    const lrfd = m.design.method === 'LRFD', syms = o.steps.map(s => s.sym);
    assert.equal(syms[0], lrfd ? 'λ' : 'C_D'); assert.equal(o.steps[0].f, lrfd ? c.TF : c.CD, name + ' C_D / λ');
    if (lrfd) { assert.equal(o.steps.find(s => s.sym === 'K_F').f, R.KF.Fb); assert.equal(o.steps.find(s => s.sym === 'φ_b').f, R.PHI.Fb); }
    if (!R.isGL && !R.isSCL) { assert.equal(o.steps.find(s => s.sym === 'C_F').f, R.CF, name + ' C_F'); assert.equal(o.steps.find(s => s.sym === 'C_L').f, c.CL, name + ' C_L'); assert.equal(o.steps.find(s => s.sym === 'C_{fu}').f, R.Cfu, name + ' C_fu'); }
    for (let i = 1; i < rows.length - 1; i++) close(rows[i].v, rows[i - 1].v * rows[i].f, 1e-12, name + ' running product ' + i);
  }
});

test('check ratios (NDS): one bar per Summary check, the engine ratios; colour classes by 0.90 / 1.00', () => {
  for (const [name, fn] of Object.entries(NDS_CASES)) {
    const { R } = nds(fn), it = J(G.ndsRatios(R).data.items);
    assert.deepEqual(it.map(x => x.r), [R.dcr.b, R.dcr.v, R.dcr.c, R.defl.r_dLL, R.defl.r_dTL], name);
    it.forEach(x => assert.equal(x.cls, x.r > 1 ? 'ng' : x.r >= 0.9 ? 'near' : 'ok', name + ' ' + x.name));
  }
  assert.equal(G.ratioCls(0.8999), 'ok'); assert.equal(G.ratioCls(0.9), 'near'); assert.equal(G.ratioCls(1.0), 'near'); assert.equal(G.ratioCls(1.0001), 'ng');
});

test('section, factor chain and ratios (AASHTO): engine values', () => {
  for (const [name, fn] of Object.entries(AAS_CASES)) {
    const { m, A, AC } = aas(fn);
    const s = J(G.aasSection(A, AC, m, false).data), it = AC.govFlex;
    assert.equal(s.bw, A.b, name + ' b'); assert.equal(s.dep, A.d, name + ' d');
    close(s.stress.f, it.Mu * 12 / AC.S, 1e-12, name + ' M_u/S'); close(s.stress.F, it.Mr * 12 / AC.S, 1e-12, name + ' M_r/S'); close(s.stress.f / s.stress.F, it.ratio, 1e-12, name + ' ratio'); assert.equal(s.stress.sign, it.sg);
    if (A.isGL) { assert.equal(s.nLam, m.material.glulam.nLam); close(s.nLam * s.tLam, A.d, 1e-12, name + ' n t = d'); }
    const o = G.aasFbChain(A), rows = J(G.waterfall(o).data.rows), l = A.lims[0];
    assert.equal(rows[0].v, A.R0.Fb, name + ' F_bo (reduced)');
    const k = o.steps.findIndex(q => q.sym === 'C_{λ}');
    close(o.steps.slice(0, k).reduce((p, q) => p * q.f, A.R0.Fb), A.base.Fb, 1e-12, name + ' product without C_λ = A.base.Fb');
    assert.equal(rows[k + 1].v, l.Fb, name + ' F_b Strength I'); assert.equal(rows[k + 2].v, l.phiFb, name + ' φF_b'); assert.equal(rows.length, k + 3);
    assert.deepEqual(J(o.steps.slice(0, k).map(q => q.f)), [A.CKF.Fb, A.CM.Fb, A.isGL ? A.CV : A.CF.Fb, A.Cfu, A.Ci.Fb, A.Cd], name + ' factors (Eq. 8.4.4.1-1 order)');
    const rt = J(G.aasRatios(AC).data.items);
    assert.deepEqual(rt.map(x => x.r), J([AC.govFlex, AC.govShear, AC.govBear, AC.govDefl].filter(Boolean).map(x => x.ratio)), name + ' ratios');
  }
});
