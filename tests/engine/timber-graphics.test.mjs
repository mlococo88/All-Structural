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

// TBGX-2: the bridge cross-section and the governing vehicle positions
const AAS_XS = {
  interiorPlank: m => { m.material.size = '6x16'; m.design.aashto.gr = 'No.1'; m.geom.spacing = 24; },
  exterior: m => { m.material.size = '6x16'; m.design.aashto.gr = 'No.1'; m.geom.spacing = 24; Object.assign(m.design.aashto.bl, { pos: 'ext', de: 1.5, nB: 12 }); },
  concrete: m => { m.material.type = 'glulam'; m.geom.spacing = 72; Object.assign(m.design.aashto.bl, { deck: 'concrete', tD: 8, wRd: 30 }); },
  plankBeyond: m => { m.material.size = '8x16'; m.geom.spacing = 72; },
  entered: m => { m.material.size = '6x16'; Object.assign(m.design.aashto.bl, { dfMode: 'entered', gM: 0.35, gV: 0.4, im: 33 }); },
};
test('bridge cross-section (AASHTO): S, d_e, roadway, lanes, the lever-rule wheels and reactions of the engine', () => {
  for (const [name, fn] of Object.entries(AAS_XS)) {
    const { m, AL } = aas(fn), d = J(G.aasXsec(AL, m).data), df = AL.df;
    assert.equal(d.S, AL.S, name + ' S'); assert.equal(d.wRd, AL.wRd, name + ' w'); assert.equal(d.NL, AL.NL, name + ' N_L'); assert.equal(d.lanes.length, AL.NL, name + ' lanes drawn');
    close(d.roadway[1] - d.roadway[0], AL.wRd, 1e-12, name + ' roadway width drawn');
    assert.ok(d.stringers.includes(0), name + ' the checked stringer at 0'); d.stringers.forEach((x, i) => i && close(x - d.stringers[i - 1], AL.S, 1e-12, name + ' spacing'));
    if (AL.pos === 'ext') { assert.equal(d.de, AL.de, name + ' d_e'); close(-d.roadway[0], AL.de, 1e-12, name + ' curb face at d_e'); assert.equal(d.stringers[0], 0, name + ' exterior = the outer stringer'); }
    if (df.nB) assert.equal(d.stringers.length, Math.min(df.nB, 12), name + ' N_b stringers');
    if (df.lev) {
      const g = df.lev.gov; assert.deepEqual(d.wheels.map(w => w.xs), J(g.xs), name + ' wheel x'); assert.deepEqual(d.wheels.map(w => w.r), J(g.rs), name + ' wheel r');
      d.wheels.forEach(w => close(w.x, AL.pos === 'ext' ? -w.xs : w.xs, 1e-12, name + ' drawn position')); assert.equal(d.lever.g, g.g, name + ' g'); assert.equal(d.lever.m, g.m);
    } else { assert.equal(d.wheels.length, 0, name + ' no wheels without the lever rule'); assert.equal(d.lever, null); }
  }
});
test('governing vehicle positions (AASHTO): the axles of the envelope placements (x, P) and the sections', () => {
  for (const [name, fn] of Object.entries(Object.assign({}, AAS_CASES, AAS_XS))) {
    const { AL, AD } = aas(fn), d = J(G.aasTrucks(AL, AD).data), e = AL.env, on = x => x >= -1e-9 && x <= e.Lt + 1e-9;
    const want = [['Mpos', AD.Mpos, AD.Mpos && AD.Mpos.s.M.ll.gMax, AD.Mpos && AD.Mpos.x], ['Mneg', AD.Mneg, AD.Mneg && AD.Mneg.s.M.ll.gMin, AD.Mneg && AD.Mneg.x], ['Vu', AD.Vu, AD.Vu && AD.Vu.gov, AD.Vu && AD.Vu.xl], ['Ru', AD.Ru, AD.Ru && AD.Ru.ll.gMax, AD.Ru && AD.Ru.x],
      ['Mpos2', AD.Mpos2, AD.Mpos2 && AD.Mpos2.s.M.pm && AD.Mpos2.s.M.pm.gMax, AD.Mpos2 && AD.Mpos2.x], ['Mneg2', AD.Mneg2, AD.Mneg2 && AD.Mneg2.s.M.pm && AD.Mneg2.s.M.pm.gMin, AD.Mneg2 && AD.Mneg2.x]].filter(w => w[1] && w[2]);
    assert.deepEqual(d.rows.map(r => r.key), want.map(w => w[0]), name + ' rows');
    want.forEach(([k, , gv, x], i) => { const r = d.rows[i], P = k.endsWith('2') ? e.permit.P : gv.P;
      assert.equal(r.x, x, name + ' ' + k + ' section'); const ax = gv.pos.map((xx, a) => ({ x: xx, P: P[a] })).filter(a => on(a.x));
      assert.deepEqual(r.axles, J(ax), name + ' ' + k + ' axles'); assert.ok(r.axles.length > 0, name + ' ' + k + ' at least one axle'); });
    assert.equal(d.Lt, e.Lt);
  }
});

// TBGX-3: demand vs capacity along the member, bracing, bearing, deflected shape
test('demand and capacity along the member (NDS): F′_b S/12 per span and sign, (2/3) F′_v A, the design shear point', () => {
  for (const [name, fn] of Object.entries(NDS_CASES)) {
    const { R } = nds(fn), c = R.gov.b, d = J(G.ndsMoment(R).data), n = R.xN.length - 1;
    assert.equal(d.cap.length, n, name); d.cap.forEach((s, i) => { const e = c.bend[i] || c.bend[0]; close(s.v, e.Fbp_t * R.S / 12, 1e-12, name + ' +M allowable'); assert.equal(s.x0, R.xN[i]); assert.equal(s.x1, R.xN[i + 1]); close(d.capN[i].v, -e.Fbp_b * R.S / 12, 1e-12, name + ' −M allowable'); });
    // the ratio at the governing section equals the bending ratio of the check (f_b / F′_b = M / (F′_b S/12))
    close(d.ratioMax, c.r_b, 1e-6, name + ' largest ratio along the member = r_b');
    const v = J(G.ndsShear(R).data), cv = R.gov.v;
    close(v.cap[0].v, cv.Fv_p * 2 * R.A / 3, 1e-12, name + ' (2/3) F′_v A'); assert.equal(v.marks[0].x, cv.xV); assert.equal(Math.abs(v.marks[0].y), cv.Vd, name + ' design V');
    close(Math.abs(v.marks[0].y) / v.cap[0].v, cv.r_v1, 1e-9, name + ' V/Va = f_v/F′_v');
  }
});
test('demand and capacity along the member (AASHTO): M_r per span and sign, V_r, V_u at the critical sections', () => {
  for (const [name, fn] of Object.entries(AAS_CASES)) {
    const { AL, AD, AC } = aas(fn), d = J(G.aasMoment(AL, AD, AC).data), e = AL.env;
    AC.flex.filter(it => it.lim === 'StrI').forEach(it => { const s = (it.sg > 0 ? d.cap : d.capN).find(q => q.k === it.k); assert.ok(s, name); close(s.v, it.sg * it.Mr, 1e-12, name + ' M_r'); assert.equal(s.x0, e.xN[it.k]); });
    const strI = AC.flex.filter(it => it.lim === 'StrI'); close(d.ratioMax, Math.max(...strI.map(it => it.ratio)), 1e-9, name + ' largest M_u/M_r along = the governing Strength I flexure ratio');
    const v = J(G.aasShear(AL, AD, AC).data), sh = AC.shear.filter(it => it.lim === 'StrI');
    close(v.cap[0].v, sh[0].Vr, 1e-12, name + ' V_r'); assert.deepEqual(v.marks.map(m => [m.x, Math.abs(m.y)]), J(sh.map(it => [it.s.xd, it.Vu])), name + ' V_u points');
  }
});
test('bracing: l_u, l_e, C_L per span and edge (NDS R.stab, gov.b; AASHTO the Strength I flexure items)', () => {
  for (const [name, fn] of Object.entries(Object.assign({ braced2: m => { m.design.latTop = 'Supports'; m.design.luTop = 4; m.geom.spans = [{ L: 12 }, { L: 12 }]; m.geom.supports = [0, 1, 2].map(() => ({ t: 'pin', lb: 3.5, cb: true })); } }, NDS_CASES))) {
    const { R } = nds(fn), c = R.gov.b, d = J(G.ndsBracing(R).data);
    d.spans.forEach((s, i) => { const e = c.bend[i] || c.bend[0];
      if (R.stabilityApplies) { assert.equal(s.top.lu, R.stab[i].top.lu, name + ' l_u'); assert.equal(s.top.le, R.stab[i].top.le); assert.equal(s.top.CL, e.CLt, name + ' C_L top'); } else assert.equal(s.top.cont, true);
      if (!s.bot.cont) { assert.equal(s.bot.lu, R.stab[i].bot.lu); assert.equal(s.bot.CL, e.CLb, name + ' C_L bottom'); } });
  }
  for (const [name, fn] of Object.entries(AAS_CASES)) {
    const { AL, AC } = aas(fn), d = J(G.aasBracing(AL, AC).data);
    AC.flex.filter(it => it.lim === 'StrI').forEach(it => { const q = d.spans[it.k][it.sg > 0 ? 'top' : 'bot'];
      if (it.clWhy) assert.equal(q.cont, true, name); else { assert.equal(q.lu, it.Lu, name + ' L_u'); assert.equal(q.le, it.Le); assert.equal(q.CL, it.CL, name + ' C_L'); } });
  }
});
test('bearing: l_b, C_b, R and capacity (NDS gov.cb: R/(F′_c⊥ b l_b) = r_cB; AASHTO govBear: R_u, P_r)', () => {
  for (const [name, fn] of Object.entries(NDS_CASES)) {
    const { R } = nds(fn), c = R.gov.cb, d = J(G.ndsBearing(R).data), j = c.gcJ;
    assert.equal(d.lb, R.lbs[j]); assert.equal(d.Cb, R.Cbs[j]); assert.equal(d.R, c.Rbear, name + ' R'); close(d.R / d.cap, c.r_cB, 1e-9, name + ' ratio'); assert.equal(d.ratio, c.r_cB);
  }
  for (const [name, fn] of Object.entries(AAS_CASES)) {
    const { AL, AC } = aas(fn), d = J(G.aasBearing(AL, AC).data), it = AC.govBear;
    assert.deepEqual([d.lb, d.Cb, d.R, d.cap, d.ratio], [it.lb, it.Cb, it.Ru, it.Pr, it.ratio], name);
  }
});
test('deflected shape: NDS limits per span (R.defl.perSpan); AASHTO Δ_LL = g_Δ × the per-lane envelope, limit L/n (AC.defl)', () => {
  for (const [name, fn] of Object.entries(NDS_CASES)) {
    const { R } = nds(fn), L = J(G.ndsDeflLimits(R));
    assert.deepEqual(L.map(s => [s.LL, s.TL]), J(R.defl.perSpan.map(s => [s.LLlim, s.TLlim])), name);
  }
  for (const [name, fn] of Object.entries(AAS_CASES)) {
    const { AL, AD, AC } = aas(fn), d = J(G.aasDefl(AL, AD, AC).data);
    close(d.llMax, Math.max(...AD.defl.filter(Boolean).map(q => q.dLL)), 1e-12, name + ' largest Δ_LL drawn = AD.defl');
    AC.defl.forEach(it => close(d.lim[it.k].v, it.allow, 1e-12, name + ' limit'));
  }
});
