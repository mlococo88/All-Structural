/* apps/steel-bridge/engine/studs.js — stud shear connectors of a composite steel I-girder, AASHTO LRFD 10th Ed. Art. 6.10.10
   (window.SBDStuds). Classic script, no DOM. Needs window.SharedSteps, window.SBDSections and window.SBDFatigue (engine/fatigue.js), loaded first.

   Ported 2026-10-29 from GirderDetail ("Steel Bridge Design.html"), Shear connectors module GM.sc (anchor `GM.sc = {`), operation for
   operation: compute(p) and checks(R): SC1 fatigue pitch per pitch zone (6.10.10.1.2, 6.10.10.2: p ≤ nZ_r/V_sr, V_sr = √(V_fat² + F_fat²),
   V_fat = γV_fQ/I; Fatigue I Z_r = (ΔF)_TH A_sc = 7.0A_sc or Fatigue II Z_r = (ΔF)_nA_sc as the bridge's fatigue settings decide, n the largest
   over the zone, engine/fatigue.js studLimit / nRange), SC2 number of connectors for strength per region (6.10.10.4: Q_n = 0.70A_scF_u,
   Eq. 6.10.10.4.3-1, or Q_n entered; Q_r = φ_scQ_n, φ_sc = 1.00; P = P_p + P_n, P_p = min(0.85f′_cb_st_s, F_ywDt_w + F_yf(b_tt_t + b_ct_c)),
   P_n = min(F_ywDt_w + F_yf(…) at the support, 0.45f′_cb_st_s) for a region ending at an interior support), SC3 pitch limits (6.10.10.1.2;
   OWN22: 6d), SC4 transverse spacing and edge distance (6.10.10.1.3), SC5 stud proportions, penetration and cover (6.10.10.1.1, 6.10.10.1.4),
   SC6 studs omitted over the top flange field splice plates, SC7 owner stud requirements (OWN22); with SC_ZSPEC, SC_RSPEC.
   The TeX `work` lines of GirderDetail are replaced by worked steps (SharedSteps). tests/engine/studs.test.mjs checks every value and check
   item against GirderDetail's own functions in Node, and fromPayload() against the results GirderDetail sends in the hand-off (S2-6).

   b_eff (SB2-F1, decided 2026-10-29): GirderDetail's module has ONE set of pitch zones and strength regions for the bridge, with one
   b_eff (Preliminary sizing sends the b_eff of the girder type with the largest fatigue shear range, usually the exterior girder). This
   engine's compute() and fromPayload() do the same when p.beffMode is absent (the parity tests); p.beffMode = 'girder' uses the girder's
   own b_eff (fromPayload: the payload girder's deck.beff), as AASHTO 6.10.10.1.2 (Q, I of the girder's own section) and 6.10.10.4.2
   (P_1p with its own b_eff) require. The app (engine/model.js defaultStuds, ui/fatigue.js) uses 'girder' by default from 2026-10-29.

   Owner rules: env = { owner, lf: { h0 } (OWN8: haunch 0 in the composite properties), rule(id), cite(r), fat: { set, B } (the bridge's
   fatigue settings and supports, engine/fatigue.js settings() / supports(); default: settings(DEFAULT), no bridge) }. Rule used: stud (OWN22).

   Units: in, kip, ksi; stations ft. */
(function () {
  'use strict';
  const ED = 'AASHTO LRFD 10th Ed.';
  const St = () => window.SharedSteps, SEC = () => window.SBDSections, FA = () => window.SBDFatigue;
  const n0 = x => St().g(x, 0), n2 = x => St().n(x, 2), n3 = x => St().n(x, 3);
  const GRADES = { '36': { Fy: 36, Fu: 58 }, '50': { Fy: 50, Fu: 65 }, '50W': { Fy: 50, Fu: 70 }, 'HPS50W': { Fy: 50, Fu: 70 }, 'HPS70W': { Fy: 70, Fu: 85 } };
  const RANK = { na: 0, pass: 1, adv: 2, warn: 3, fail: 4 };
  const ge = (a, b) => a >= b - 1e-9, sum = a => a.reduce((s, v) => s + v, 0);
  const worst = a => a.reduce((w, s) => RANK[s] > RANK[w] ? s : w, 'na');
  function parseDim(v) { if (typeof v === 'number') return v; if (v == null) return NaN; let s = String(v).trim().replace(/["”]/g, '').replace(/(\d)-(\d)/g, '$1 $2').replace(/\s+/g, ' '); if (!s) return NaN;
    let m = s.match(/^(-?\d+(?:\.\d+)?) (\d+)\/(\d+)$/); if (m) return +m[1] + m[2] / m[3]; m = s.match(/^(\d+)\/(\d+)$/); if (m) return m[1] / m[2]; const n = Number(s); return isFinite(n) ? n : NaN; }
  const nm = v => typeof v === 'number' ? v : parseDim(v);
  const frac = x => { const w = Math.floor(x + 1e-9), f = Math.round((x - w) * 16); if (!f) return `${w}`; let a = f, b = 16; while (a % 2 === 0) { a /= 2; b /= 2; } return w ? `${w} ${a}/${b}` : `${a}/${b}`; };
  function numRows(rows, spec, lbl, errors) { return (rows || []).map((r0, i) => { const r = { i, name: r0.name || `${lbl} ${i + 1}` };
    spec.forEach(([k, label, , ty, o]) => { if (ty === 'text' || ty === 'sel') { r[k] = r0[k]; return; }
      if (o && o.opt && (r0[k] == null || r0[k] === '' || (typeof r0[k] === 'number' && isNaN(r0[k])))) { r[k] = null; return; }
      const v = nm(r0[k]); r[k] = v; const min = o && o.min !== undefined ? o.min : (o && o.any ? -Infinity : 1e-12);
      if (!isFinite(v) || v < min) errors.push(`${r.name}: "${label.replace(/<[^>]+>/g, '')}" must be ${o && o.any ? 'a number' : min === 0 ? 'zero or positive' : 'positive'}.`); }); return r; }); }
  function env0(env) {
    const e = env || {}, O = window.SBDOwners, owner = e.owner || 'AASHTO', f = e.fat || {};
    return { owner, lf: e.lf || { h0: false }, rule: e.rule || (id => (O ? O.rule(owner, id) : null)), cite: e.cite || (r => (O ? O.cite(r) : (r ? `${r.owner} ${r.sec}` : ''))),
      fat: { set: f.set || FA().settings(FA().DEFAULT), B: f.B || null } };
  }
  function ckNew() { const out = []; out.add = c => { c.items.forEach(it => { if (typeof it.r === 'number' && Number.isNaN(it.r) && it.st !== 'na') { it.err = 'error: ratio is NaN'; if (RANK[it.st] < RANK.warn) it.st = 'fail'; } });   // SB2-R2 NaN guard: never a pass, ranks first
    const nr = i => (Number.isNaN(i.r) || i.r === Infinity ? Infinity : i.r ?? -1);
    c.status = c.items.length ? worst(c.items.map(i => i.st)) : 'na'; let gi = -1; c.items.forEach((it, k) => { if (gi < 0 || RANK[it.st] > RANK[c.items[gi].st] || (RANK[it.st] === RANK[c.items[gi].st] && nr(it) > nr(c.items[gi]))) gi = k; }); c.gov = gi; if (!c.items.length && !c.naWhy) c.naWhy = 'Not applicable to any item.'; out.push(c); }; return out; }
  const rc = (loc, d, c, step, x) => ({ loc, demand: d, capacity: c, r: d / c, st: ge(c, d) ? 'pass' : 'fail', step, ...(x || {}) });

  const ZSPEC = [['name', 'Name', '', 'text'], ['x1', 'From', 'ft', 'num', { min: 0 }], ['x2', 'To', 'ft', 'num', { min: 0 }], ['nr', 'Studs per row', '', 'num'], ['p', 'Pitch', 'in', 'dim'], ['Vfr', 'Fatigue shear range V<sub>f</sub>', 'kip', 'num', { min: 0 }],
    ['D', 'Web depth D', 'in', 'dim'], ['tw', 'Web t<sub>w</sub>', 'in', 'dim'], ['topB', 'Top flange b', 'in', 'dim'], ['topT', 'Top flange t', 'in', 'dim'], ['botB', 'Bottom flange b', 'in', 'dim'], ['botT', 'Bottom flange t', 'in', 'dim']];
  const RSPEC = [['name', 'Name', '', 'text'], ['kind', 'Region', '', 'sel'], ['x1', 'From', 'ft', 'num', { min: 0 }], ['x2', 'To', 'ft', 'num', { min: 0 }],
    ['D', 'D at max. positive', 'in', 'dim'], ['tw', 't<sub>w</sub> at max. positive', 'in', 'dim'], ['topB', 'Top b at max. positive', 'in', 'dim'], ['topT', 'Top t at max. positive', 'in', 'dim'], ['botB', 'Bottom b at max. positive', 'in', 'dim'], ['botT', 'Bottom t at max. positive', 'in', 'dim'],
    ['pD', 'D at support', 'in', 'dim'], ['ptw', 't<sub>w</sub> at support', 'in', 'dim'], ['ptopB', 'Top b at support', 'in', 'dim'], ['ptopT', 'Top t at support', 'in', 'dim'], ['pbotB', 'Bottom b at support', 'in', 'dim'], ['pbotT', 'Bottom t at support', 'in', 'dim']];
  /* DEFAULT: GirderDetail's built-in Shear connectors input (GM.sc.def) */
  const DEFAULT = { splX: '', splL: 0, splC: 3, d: '0.875', h: 6, st: 4, Fu: 60, fc: 4, wc: 0.150, K1: 1.0, nRule: 'exact', Qn10: 0, ts: 8, hh: 2, tdeck: 8.5, beff: 114, gF: '50W', gW: '50W', gam: { fat: 1.75 }, skew: 'no', Frc: 25, wv: 48,
    zones: [{ name: 'Span 1, 0 to 0.2L', x1: 0, x2: 22, nr: 3, p: 9, Vfr: 38, D: 60, tw: 0.5625, topB: 16, topT: 0.75, botB: 16, botT: 1.125 }, { name: 'Span 1, 0.2L to 0.5L', x1: 22, x2: 55, nr: 3, p: 12, Vfr: 26, D: 60, tw: 0.5625, topB: 16, topT: 0.75, botB: 16, botT: 1.125 }],
    regions: [{ name: 'Abut. 1 to max. positive, Span 1', kind: 'end', x1: 0, x2: 44, D: 60, tw: 0.5625, topB: 16, topT: 0.75, botB: 16, botT: 1.125, pD: 60, ptw: 0.5625, ptopB: 18, ptopT: 1.5, pbotB: 18, pbotT: 1.5 }] };

  /* compute(p, env): GM.sc.compute(p). p as DEFAULT; p.beffMode 'girder' with p.beffG (in): this girder's b_eff in place of p.beff (option, off by default).
     Returns { errors } or { errors: [], gaps, MR, zones, regions, d, Asc, QnE, Qn10, Qn, phiSc, Qr, Zr, fc, gf, Ffat, dk, h, st, tdeck, Fu, Fyf, Fyw, env }. */
  function compute(p, env) {
    const E = env0(env), errors = [], d = +p.d, g = k => nm(p[k]);
    ['h', 'st', 'Fu', 'fc', 'wc', 'K1', 'ts', 'tdeck', 'beff', 'wv'].forEach(k => { if (!(g(k) > 0)) errors.push(`"${k}" must be positive.`); }); if (!(g('hh') >= 0)) errors.push('Haunch must be zero or positive.');
    if (p.beffMode === 'girder' && !(nm(p.beffG) > 0)) errors.push('b_eff of this girder must be positive (option "b_eff per girder").');
    const zones = numRows(p.zones, ZSPEC, 'Zone', errors), regions = numRows(p.regions, RSPEC, 'Region', errors);
    zones.forEach(z => { if (!(z.x2 > z.x1)) errors.push(`${z.name}: "To" must be greater than "From".`); if (!Number.isInteger(z.nr)) errors.push(`${z.name}: studs per row must be a whole number.`); });
    regions.forEach(z => { if (!(z.x2 > z.x1)) errors.push(`${z.name}: "To" must be greater than "From".`); });
    if (!zones.length) errors.push('Add at least one pitch zone.');
    if (errors.length) return { errors };
    const Asc = Math.PI * d ** 2 / 4, fc = g('fc'), QnE = 0.70 * Asc * g('Fu'), Qn10 = nm(p.Qn10), Qn = Qn10 > 0 ? Qn10 : QnE, phiSc = 1.00, Qr = phiSc * Qn, Zr = 7.0 * Asc;
    const beff = p.beffMode === 'girder' ? nm(p.beffG) : g('beff');
    const MR = SEC().modularRatio(g('fc'), g('wc'), g('K1'), p.nRule), dk = { ts: g('ts'), hh: g('hh'), beff, n: MR.n, Ar: 0, dr: 0 }, dkP = { ...dk, hh: E.lf && E.lf.h0 ? 0 : dk.hh }, gf = nm(p.gam.fat), Ffat = p.skew === 'yes' ? g('Frc') / g('wv') : 0;
    const anyPier = regions.some(q => q.kind === 'pier'), FS = E.fat;
    zones.forEach(z => { const S = FA().secSet(z.D, z, dkP), c = S.cn; z.I = c.I; z.yb = c.yb; z.ySlab = S.ySlab; z.Aslab = dk.beff * dk.ts / dk.n; z.Q = z.Aslab * (S.ySlab - c.yb);
      z.fat = FA().studLimit(FA().nRange(z.x1, z.x2, true, anyPier, FS.B), d, Zr, gf, FS.set); z.Zr = z.fat.Zr;
      z.Vfat = z.fat.gam * z.Vfr * z.Q / z.I; z.Vsr = Math.hypot(z.Vfat, Ffat); z.preq = z.Vsr > 0 ? z.nr * z.Zr / z.Vsr : Infinity; z.pmax = z.D >= 24 ? 48 : 24;
      z.edge = (z.topB - (z.nr - 1) * g('st') - d) / 2; });
    const Fyf = GRADES[p.gF].Fy, Fyw = GRADES[p.gW].Fy;
    regions.forEach(r => { r.Pc = 0.85 * fc * dk.beff * dk.ts; r.Ps = Fyw * r.D * r.tw + Fyf * (r.topB * r.topT + r.botB * r.botT); r.Pp = Math.min(r.Pc, r.Ps);
      if (r.kind === 'pier') { r.Pnc = 0.45 * fc * dk.beff * dk.ts; r.Pns = Fyw * r.pD * r.ptw + Fyf * (r.ptopB * r.ptopT + r.pbotB * r.pbotT); r.Pn = Math.min(r.Pnc, r.Pns); } else r.Pn = 0;
      r.P = r.Pp + r.Pn; r.nreq = r.P / Qr;
      r.parts = zones.map(z => { const L = Math.max(0, Math.min(z.x2, r.x2) - Math.max(z.x1, r.x1)); return { z, L, n: L > 0 ? z.nr * (Math.floor(L * 12 / z.p + 1e-6) + 0) : 0 }; }).filter(q => q.L > 0);
      r.nprov = sum(r.parts.map(q => q.n)); r.cov = sum(r.parts.map(q => q.L)); });
    // studs left out over the top flange field splice plates (plus a clearance at each plate end)
    const splX = String(p.splX || '').split(/[,;\s]+/).map(Number).filter(v => isFinite(v) && v > 0), halfL = (nm(p.splL) || 0) / 2 + (nm(p.splC) || 0) / 12;
    const gaps = halfL > 0 ? splX.map(x => ({ x, a: x - halfL, b: x + halfL })) : [];
    regions.forEach(r => { r.lost = 0; gaps.forEach(gp => zones.forEach(z => { const L = Math.max(0, Math.min(z.x2, r.x2, gp.b) - Math.max(z.x1, r.x1, gp.a)); if (L > 0) r.lost += z.nr * Math.ceil(L * 12 / z.p - 1e-6); })); r.nnet = r.nprov - r.lost; });
    return { errors: [], gaps, MR, zones, regions, d, Asc, QnE, Qn10, Qn, phiSc, Qr, Zr, fc, gf, Ffat, dk, h: g('h'), st: g('st'), tdeck: g('tdeck'), Fu: g('Fu'), Fyf, Fyw, Frc: g('Frc'), wv: g('wv'), skew: p.skew === 'yes', beffMode: p.beffMode === 'girder' ? 'girder' : 'bridge', env: E };
  }

  /* checks(R): GM.sc.checks(R). Each check { id, grp, title, ref, items: [{ loc, r, st, demand, capacity, step }], naWhy, status, gov }. */
  function checks(R) {
    const out = ckNew(), d = R.d, E = R.env;
    { const c = { id: 'SC1', grp: 'Fatigue', title: 'Fatigue pitch, p ≤ nZ_r/V_sr', ref: `${ED} Art. 6.10.10.1.2, 6.10.10.2`, items: [] };
      R.zones.forEach(z => c.items.push(rc(z.name, z.p, z.preq, `scz${z.i}.ok`, { lim: z.fat.lim }))); out.add(c); }
    { const c = { id: 'SC2', grp: 'Strength', title: 'Number of connectors for strength, n ≥ P/Q_r', ref: `${ED} Art. 6.10.10.4`, items: [] };
      R.regions.forEach(r => c.items.push(rc(r.name, r.nreq, r.nprov, `scr${r.i}.ok`)));
      if (!c.items.length) c.naWhy = 'No strength regions entered.'; out.add(c); }
    { const rSt = E.rule('stud'), kp = rSt ? rSt.value.p : 4;   // OWN22 (RIDOT BDM 6.5.3): pitch not less than six stud diameters
      const c = { id: 'SC3', grp: 'Detailing', title: `Pitch limits, ${kp}d ≤ p ≤ 48 in (24 in if D < 24 in)`, ref: rSt ? `${ED} Art. 6.10.10.1.2; ${E.cite(rSt)}` : `${ED} Art. 6.10.10.1.2`, src: rSt ? 'DOT' : 'Code', items: [] };
      R.zones.forEach(z => { const ok = ge(z.p, kp * d) && ge(z.pmax, z.p); c.items.push({ loc: z.name, demand: z.p, capacity: z.pmax, min: kp * d, st: ok ? 'pass' : 'fail', r: Math.max(kp * d / z.p, z.p / z.pmax), step: `scz${z.i}.pl` }); }); out.add(c); }
    { const c = { id: 'SC4', grp: 'Detailing', title: 'Transverse spacing and edge distance', ref: `${ED} Art. 6.10.10.1.3`, items: [] };
      R.zones.forEach(z => { if (z.nr > 1) c.items.push({ loc: `${z.name}, transverse spacing`, demand: 4 * d, capacity: R.st, st: ge(R.st, 4 * d) ? 'pass' : 'fail', r: 4 * d / R.st, step: `scz${z.i}.st` });
        c.items.push({ loc: `${z.name}, edge distance`, demand: 1, capacity: z.edge, st: ge(z.edge, 1) ? 'pass' : 'fail', r: 1 / z.edge, step: `scz${z.i}.edge` }); }); out.add(c); }
    { const c = { id: 'SC5', grp: 'Detailing', title: 'Stud proportions, penetration, and cover', ref: `${ED} Art. 6.10.10.1.1, 6.10.10.1.4`, items: [] };
      const hd = R.h / d, pen = R.h - R.dk.hh, cov = R.tdeck + R.dk.hh - R.h;
      c.items.push({ loc: 'Height-to-diameter ratio', demand: 5, capacity: hd, st: ge(hd, 5) ? 'pass' : 'fail', r: 5 / hd, step: 'sc.hd' });
      c.items.push({ loc: 'Penetration into the deck', demand: 2, capacity: pen, st: ge(pen, 2) ? 'pass' : 'fail', r: 2 / pen, step: 'sc.pen' });
      c.items.push({ loc: 'Clear cover over the studs', demand: 2, capacity: cov, st: ge(cov, 2) ? 'pass' : 'fail', r: 2 / cov, step: 'sc.cov' }); out.add(c); }
    { const rSt = E.rule('stud');   // SC7 (OWN22, RIDOT BDM 6.5.3): owner stud requirements
      if (rSt) { const v = rSt.value, mat = R.dk.hh + v.cov + v.bars, c = { id: 'SC7', grp: 'Detailing', title: 'Owner stud requirements', ref: E.cite(rSt), src: 'DOT', items: [], note: rSt.text };
        c.items.push({ loc: 'Stud diameter', st: Math.abs(d - v.d) < 1e-6 ? 'pass' : 'fail', step: 'sc.own' });
        R.zones.forEach(z => c.items.push({ loc: `${z.name}, studs across`, st: z.nr >= v.nr ? 'pass' : 'fail', step: 'sc.own' }));
        c.items.push({ loc: 'Stud height', demand: v.h, capacity: R.h, st: ge(R.h, v.h) ? 'pass' : 'fail', r: v.h / R.h, step: 'sc.own' });
        c.items.push({ loc: 'Above the bottom reinforcement mat', demand: mat + v.mat, capacity: R.h, st: ge(R.h, mat + v.mat) ? 'pass' : 'fail', r: (mat + v.mat) / R.h, step: 'sc.own' });
        out.add(c); } }
    { const c = { id: 'SC6', grp: 'Detailing', title: 'Studs omitted over the top flange field splice plates', ref: `Detailing; ${ED} Art. 6.10.10.4 (strength with the studs omitted)`, items: [] };
      if (!R.gaps.length) c.naWhy = 'No field splices entered, or no splice plate length.';
      else { R.gaps.forEach((gp, k) => c.items.push({ loc: `Splice at ${n2(gp.x)} ft`, st: 'pass', r: 0, step: `scg${k}` }));
        R.regions.filter(r => r.lost > 0).forEach(r => c.items.push(rc(`${r.name}`, r.nreq, Math.max(r.nnet, 1e-9), `scr${r.i}.net`))); }
      out.add(c); }
    return out;
  }

  /* steps(R): the worked steps of the module: studs and deck (ids sc.*), every zone (scz<i>.*), every region (scr<i>.*), the splice gaps (scg<k>) */
  function steps(R) {
    const w = St().work('sc'), d = R.d, okS = (dm, c) => ge(c, dm), E = R.env, out = [];
    w.add({ id: 'Asc', label: `Area of one stud, d = ${frac(d)} in`, sym: 'A_{sc}', eq: '\\frac{\\pi d^{2}}{4}', sub: `\\frac{\\pi(${n3(d)})^{2}}{4}`, value: R.Asc, unit: 'in^{2}', d: 4, ref: '' });
    w.add({ id: 'QnE', label: 'Nominal shear resistance of one stud', sym: 'Q_{n}', eq: '0.70A_{sc}F_{u}', sub: `0.70(${n3(R.Asc)})(${n2(R.Fu)})`, value: R.QnE, unit: 'kip', d: 2, ref: `${ED} Eq. 6.10.10.4.3-1` });
    if (R.Qn10 > 0) w.add({ id: 'Qn', label: 'Nominal shear resistance used (entered)', sym: 'Q_{n}', eq: '', sub: '', value: R.Qn, unit: 'kip', d: 2, ref: '', note: 'Entered by the user in place of Eq. 6.10.10.4.3-1.' });
    w.add({ id: 'Qr', label: 'Factored shear resistance of one stud', sym: 'Q_{r}', eq: '\\phi_{sc}Q_{n}', sub: `${n2(R.phiSc)}(${n2(R.Qn)})`, value: R.Qr, unit: 'kip', d: 2, ref: `${ED} Eq. 6.10.10.4.1-1; Art. 6.5.4.2 (φ_sc = 1.00)` });
    w.add({ id: 'ZrI', label: 'Fatigue resistance of one stud, Fatigue I', sym: 'Z_{r}', eq: '(\\Delta F)_{TH}A_{sc} = 7.0A_{sc}', sub: `7.0(${n3(R.Asc)})`, value: R.Zr, unit: 'kip', d: 3, ref: `${ED} Eq. 6.10.10.2-1, Table 6.6.1.2.3-1 (Condition 9.2)` });
    w.add({ id: 'n', label: 'Modular ratio', sym: 'n', eq: '\\frac{E_{s}}{E_{c}}', sub: `\\frac{29{,}000}{${n0(R.MR.Ec)}}`, value: R.dk.n, unit: '', d: 3, ref: `${ED} Eq. 5.4.2.4-1, Art. 6.10.1.1.1b`, note: `f′c = ${n2(R.fc)} ksi${R.MR.rule === 'round' ? '; rounded' : ''}.` });
    w.add({ id: 'beff', label: R.beffMode === 'girder' ? 'Effective flange width of this girder (option: b_eff per girder)' : 'Effective flange width (bridge-wide, as GirderDetail: one set of zones for the girders)', sym: 'b_{eff}', eq: '', sub: '', value: R.dk.beff, unit: 'in', d: 2, ref: `${ED} Art. 4.6.2.6` });
    w.add({ id: 'Ffat', label: 'Radial fatigue shear range per unit length', sym: 'F_{fat}', eq: R.skew ? '\\frac{F_{rc}}{w}' : '', sub: R.skew ? `\\frac{${n2(R.Frc)}}{${n2(R.wv)}}` : '\\text{straight, skew} \\le 20°: 0', value: R.Ffat, unit: '\\text{kip/in}', d: 4, ref: `${ED} Eq. 6.10.10.1.2-4` });
    const hd = R.h / d, pen = R.h - R.dk.hh, cov = R.tdeck + R.dk.hh - R.h;
    w.add({ id: 'hd', label: 'Height-to-diameter ratio (normal weight concrete; 7.0 in lightweight concrete)', sym: '\\frac{h}{d} \\ge 5.0', eq: '', sub: `\\frac{${n2(R.h)}}{${n3(d)}} = ${n2(hd)}`, value: 5 / hd, unit: '', d: 3, ref: `${ED} Art. 6.10.10.1.1`, ok: ge(hd, 5) });
    w.add({ id: 'pen', label: 'Penetration into the deck', sym: 'h - h_{haunch} \\ge 2.0', eq: '', sub: `${n2(R.h)} - ${n2(R.dk.hh)} = ${n2(pen)}`, value: 2 / pen, unit: '', d: 3, ref: `${ED} Art. 6.10.10.1.4`, ok: ge(pen, 2) });
    w.add({ id: 'cov', label: 'Clear cover over the studs', sym: 't_{deck} + h_{haunch} - h \\ge 2.0', eq: '', sub: `${n2(R.tdeck)} + ${n2(R.dk.hh)} - ${n2(R.h)} = ${n2(cov)}`, value: 2 / cov, unit: '', d: 3, ref: `${ED} Art. 6.10.10.1.4`, ok: ge(cov, 2) });
    const rSt = E.rule('stud'); if (rSt) { const v = rSt.value, mat = R.dk.hh + v.cov + v.bars;
      w.add({ id: 'own', label: `Owner stud requirements (${E.cite(rSt)})`, sym: 'h - (h_{haunch} + c_{b} + d_{bars})', eq: '', sub: `${n2(R.h)} - (${n2(R.dk.hh)} + ${n2(v.cov)} + ${n2(v.bars)}) = ${n2(R.h - mat)} ${ge(R.h - mat, v.mat) ? '\\ge' : '\\lt'} ${n2(v.mat)}`, value: R.h - mat, unit: 'in', d: 2, ref: E.cite(rSt), note: `${rSt.text}. d = ${frac(v.d)} in, at least ${v.nr} studs across, h ≥ ${n2(v.h)} in.` }); }
    out.push(...w.steps);
    const kp = rSt ? rSt.value.p : 4;
    R.zones.forEach(z => { const q = z.fat, wz = St().work('scz' + z.i);
      wz.add({ id: 'Q', label: `${z.name} (${n2(z.x1)}–${n2(z.x2)} ft): first moment of the transformed slab about the short-term composite neutral axis`, sym: 'Q', eq: '\\frac{b_{eff}t_{s}}{n}(y_{slab} - \\bar{y})', sub: `${n2(z.Aslab)}(${n3(z.ySlab)} - ${n3(z.yb)})`, value: z.Q, unit: 'in^{3}', d: 2, ref: `${ED} Art. 6.10.10.1.2`, note: 'Short-term composite section with the deck effective (conservative in negative flexure).' });
      wz.add({ id: 'I', label: 'Moment of inertia, short-term composite section', sym: 'I', eq: '', sub: '', value: z.I, unit: 'in^{4}', d: 0, ref: `${ED} Art. 6.10.10.1.2` });
      wz.add({ id: 'lim', label: 'Fatigue limit state for the studs', sym: '\\text{limit state}', eq: '', sub: !q.s.ok ? '\\text{traffic inputs incomplete: Fatigue I}' : q.s.limit !== 'auto' ? `\\text{Fatigue ${q.s.limit} selected}` : `(ADTT)_{SL} = ${n0(q.s.ADTTSL)} ${q.lim === 'I' ? '\\ge' : '\\lt'} ${n0(q.eq)},\\ n = ${q.nn}`, value: `Fatigue ${q.lim}`, unit: '', d: 0, ref: `${ED} Art. 6.10.10.2, 6.6.1.2.3` });
      if (q.lim === 'II') wz.add({ id: 'Zr', label: 'Fatigue resistance of one stud, Fatigue II', sym: 'Z_{r}', eq: '(\\Delta F)_{n}A_{sc},\\ (\\Delta F)_{n} = \\left(\\frac{A}{N}\\right)^{1/5}', sub: `\\left(\\frac{1040\\times10^{8}}{${n0(q.N)}}\\right)^{1/5}(${n3(q.Asc)}) = ${n3(q.dFn)}(${n3(q.Asc)})`, value: z.Zr, unit: 'kip', d: 3, ref: `${ED} Eq. 6.10.10.2-1, Eq. 6.6.1.2.5-2`, note: `N = 365(${n0(q.s.life)})(${q.nn})(${n0(q.s.ADTTSL)}).` });
      else wz.add({ id: 'Zr', label: 'Fatigue resistance of one stud, Fatigue I', sym: 'Z_{r}', eq: '7.0A_{sc}', sub: `7.0(${n3(R.Asc)})`, value: z.Zr, unit: 'kip', d: 3, ref: `${ED} Eq. 6.10.10.2-1` });
      wz.add({ id: 'Vfat', label: `Longitudinal fatigue shear range per unit length (V_f = ${n2(z.Vfr)} kip, unfactored fatigue truck)`, sym: 'V_{fat}', eq: '\\frac{\\gamma V_{f}Q}{I}', sub: `\\frac{${n2(q.gam)}(${n2(z.Vfr)})(${n2(z.Q)})}{${n0(z.I)}}`, value: z.Vfat, unit: '\\text{kip/in}', d: 4, ref: `${ED} Eq. 6.10.10.1.2-3` });
      wz.add({ id: 'Vsr', label: 'Horizontal fatigue shear range per unit length', sym: 'V_{sr}', eq: '\\sqrt{V_{fat}^{2} + F_{fat}^{2}}', sub: `\\sqrt{${n3(z.Vfat)}^{2} + ${n3(R.Ffat)}^{2}}`, value: z.Vsr, unit: '\\text{kip/in}', d: 4, ref: `${ED} Eq. 6.10.10.1.2-2` });
      wz.add({ id: 'preq', label: 'Maximum pitch for fatigue', sym: 'p_{max}', eq: '\\frac{nZ_{r}}{V_{sr}}', sub: `\\frac{${z.nr}(${n3(z.Zr)})}{${n3(z.Vsr)}}`, value: z.preq, unit: 'in', d: 2, ref: `${ED} Eq. 6.10.10.1.2-1` });
      wz.add({ id: 'ok', label: 'Fatigue pitch (SC1)', sym: 'p \\le p_{max}', eq: '', sub: `${n2(z.p)} ${okS(z.p, z.preq) ? '\\le' : '\\gt'} ${n2(z.preq)}`, value: z.p / z.preq, unit: '', d: 3, ref: `${ED} Eq. 6.10.10.1.2-1`, ok: okS(z.p, z.preq) });
      const okP = ge(z.p, kp * d) && ge(z.pmax, z.p);
      wz.add({ id: 'pl', label: 'Pitch limits (SC3)', sym: `${kp}d \\le p \\le ${z.pmax}`, eq: '', sub: `${kp}(${n3(d)}) = ${n2(kp * d)} \\le ${n2(z.p)} \\le ${n2(z.pmax)}`, value: Math.max(kp * d / z.p, z.p / z.pmax), unit: '', d: 3, ref: rSt ? `${ED} Art. 6.10.10.1.2; ${E.cite(rSt)}` : `${ED} Art. 6.10.10.1.2`, ok: okP });
      if (z.nr > 1) wz.add({ id: 'st', label: 'Transverse spacing (SC4)', sym: 's_{t} \\ge 4d', eq: '', sub: `${n2(R.st)} ${ge(R.st, 4 * d) ? '\\ge' : '\\lt'} 4(${n3(d)}) = ${n2(4 * d)}`, value: 4 * d / R.st, unit: '', d: 3, ref: `${ED} Art. 6.10.10.1.3`, ok: ge(R.st, 4 * d) });
      wz.add({ id: 'edge', label: 'Clear distance to the flange edge (SC4)', sym: '\\frac{b_{f} - (n - 1)s_{t} - d}{2} \\ge 1.0', eq: '', sub: `\\frac{${n2(z.topB)} - (${z.nr} - 1)(${n2(R.st)}) - ${n3(d)}}{2} = ${n2(z.edge)}`, value: 1 / z.edge, unit: '', d: 3, ref: `${ED} Art. 6.10.10.1.3`, ok: ge(z.edge, 1) });
      out.push(...wz.steps); });
    R.regions.forEach(r => { const wr = St().work('scr' + r.i);
      wr.add({ id: 'Pc', label: `${r.name} (${n2(r.x1)}–${n2(r.x2)} ft): concrete deck force`, sym: 'P_{1p}', eq: '0.85f\\prime_{c}b_{eff}t_{s}', sub: `0.85(${n2(R.fc)})(${n2(R.dk.beff)})(${n2(R.dk.ts)})`, value: r.Pc, unit: 'kip', d: 1, ref: `${ED} Eq. 6.10.10.4.2-2` });
      wr.add({ id: 'Ps', label: 'Steel section force at the point of maximum positive moment', sym: 'P_{2p}', eq: 'F_{yw}Dt_{w} + F_{yf}(b_{t}t_{t} + b_{c}t_{c})', sub: `${n0(R.Fyw)}(${n2(r.D)})(${n3(r.tw)}) + ${n0(R.Fyf)}(${n2(r.topB)}(${n3(r.topT)}) + ${n2(r.botB)}(${n3(r.botT)}))`, value: r.Ps, unit: 'kip', d: 1, ref: `${ED} Eq. 6.10.10.4.2-3` });
      wr.add({ id: 'Pp', label: 'Longitudinal force at the point of maximum positive moment', sym: 'P_{p}', eq: '\\min(P_{1p}, P_{2p})', sub: `\\min(${n2(r.Pc)}, ${n2(r.Ps)})`, value: r.Pp, unit: 'kip', d: 1, ref: `${ED} Art. 6.10.10.4.2` });
      if (r.kind === 'pier') { wr.add({ id: 'Pnc', label: 'Concrete deck force over the interior support', sym: 'P_{1n}', eq: '0.45f\\prime_{c}b_{eff}t_{s}', sub: `0.45(${n2(R.fc)})(${n2(R.dk.beff)})(${n2(R.dk.ts)})`, value: r.Pnc, unit: 'kip', d: 1, ref: `${ED} Eq. 6.10.10.4.2-8` });
        wr.add({ id: 'Pns', label: 'Steel section force at the interior support', sym: 'P_{2n}', eq: 'F_{yw}Dt_{w} + F_{yf}(b_{t}t_{t} + b_{c}t_{c})', sub: `${n0(R.Fyw)}(${n2(r.pD)})(${n3(r.ptw)}) + ${n0(R.Fyf)}(${n2(r.ptopB)}(${n3(r.ptopT)}) + ${n2(r.pbotB)}(${n3(r.pbotT)}))`, value: r.Pns, unit: 'kip', d: 1, ref: `${ED} Eq. 6.10.10.4.2-7` });
        wr.add({ id: 'Pn', label: 'Longitudinal force over the interior support', sym: 'P_{n}', eq: '\\min(P_{1n}, P_{2n})', sub: `\\min(${n2(r.Pnc)}, ${n2(r.Pns)})`, value: r.Pn, unit: 'kip', d: 1, ref: `${ED} Art. 6.10.10.4.2` }); }
      wr.add({ id: 'P', label: 'Total nominal shear force in the region (straight girder, F_p = 0)', sym: 'P', eq: r.kind === 'pier' ? 'P_{p} + P_{n}' : 'P_{p}', sub: r.kind === 'pier' ? `${n2(r.Pp)} + ${n2(r.Pn)}` : n2(r.Pp), value: r.P, unit: 'kip', d: 1, ref: r.kind === 'pier' ? `${ED} Eq. 6.10.10.4.2-5` : `${ED} Eq. 6.10.10.4.2-1` });
      wr.add({ id: 'nreq', label: 'Number of shear connectors required', sym: 'n', eq: '\\frac{P}{Q_{r}}', sub: `\\frac{${n2(r.P)}}{${n2(R.Qr)}}`, value: r.nreq, unit: '', d: 2, ref: `${ED} Eq. 6.10.10.4.1-2` });
      wr.add({ id: 'nprov', label: 'Studs provided in the region (pitch zones overlapping it)', sym: 'n_{prov}', eq: '\\sum n_{r}\\lfloor 12L/p \\rfloor', sub: r.parts.map(q => `${q.z.nr}\\lfloor 12(${n2(q.L)})/${n2(q.z.p)} \\rfloor`).join(' + ') || '0', value: r.nprov, unit: '', d: 0, ref: '', note: r.cov + 1e-6 < r.x2 - r.x1 ? `The zones cover only ${n2(r.cov)} of ${n2(r.x2 - r.x1)} ft.` : '' });
      wr.add({ id: 'ok', label: 'Number of connectors for strength (SC2)', sym: 'n \\le n_{prov}', eq: '', sub: `${n2(r.nreq)} ${okS(r.nreq, r.nprov) ? '\\le' : '\\gt'} ${n0(r.nprov)}`, value: r.nreq / r.nprov, unit: '', d: 3, ref: `${ED} Art. 6.10.10.4.1`, ok: okS(r.nreq, r.nprov) });
      if (r.lost > 0) wr.add({ id: 'net', label: 'Strength with the studs omitted over the splice plates (SC6)', sym: 'n_{prov} - n_{omitted} \\ge n', eq: '', sub: `${n0(r.nprov)} - ${n0(r.lost)} = ${n0(r.nnet)} ${ge(r.nnet, r.nreq) ? '\\ge' : '\\lt'} ${n2(r.nreq)}`, value: r.nreq / Math.max(r.nnet, 1e-9), unit: '', d: 3, ref: `${ED} Art. 6.10.10.4.1`, ok: ge(r.nnet, r.nreq) });
      out.push(...wr.steps); });
    R.gaps.forEach((gp, k) => out.push({ id: `scg${k}`, label: `No studs over the top flange splice plate at ${n2(gp.x)} ft (plate and end clearances)`, sym: '\\text{omitted}', eq: '', sub: `${n2(gp.a)} \\text{ to } ${n2(gp.b)}\\ \\text{ft}`, value: gp.b - gp.a, unit: 'ft', d: 2, ref: 'Detailing' }));
    return out;
  }

  /* fromPayload(pl, opt): GirderDetail's Shear connectors input rebuilt from a hand-off file (schema stgirder-external-demands, S2-6):
     the pitch zones (girderDetail.details.studs.zones, with V_f of each zone from studs.results.zones), the strength regions
     (studs.results.regions: kind, from, to), the plates of each zone at its middle and of each region at its point of maximum positive
     moment (the region end that is not a support) and at the support (0.01 ft inside it), from section.zones; studs d, h, F_u and the
     transverse spacing; the deck and concrete of the payload; b_eff the bridge-wide one of studs.results (opt.beffMode 'girder': this
     girder's deck.beff); the splice gaps from studs.results.gaps (clearance 3 in); the skew from skew.max (> 20°: F_fat = 25/48 kip/in,
     GirderDetail's defaults F_rc = 25 kip, w = 48 in); t_deck = t_s + 0.5 in (Preliminary sizing). The fatigue settings from
     details.fatigue (ADTT, p, life, limit; γ_II from the zones' results, 0.80 when no zone is in Fatigue II; γ_I 1.75) and the bridge
     from member.spans. Returns { p, env } or null when the payload has no stud results. */
  function fromPayload(pl, opt) {
    opt = opt || {};
    const g = pl.girderDetail || {}, D0 = g.details || {}, sd = D0.studs, q = sd && sd.results; if (!q || !Array.isArray(q.zones) || !q.zones.length) return null;
    const m = g.materials || {}, dk = g.deck || {}, sup = (pl.member || {}).supports || [], zones = (pl.section || {}).zones || [], Lend = sup[sup.length - 1];
    const zAt = x => { const z = zones.find(o => x >= o.startX - 1e-9 && x < o.endX) || zones[zones.length - 1]; return { D: z.web.depth, tw: z.web.thickness, topB: z.topFlange.width, topT: z.topFlange.thickness, botB: z.botFlange.width, botT: z.botFlange.thickness }; };
    const isSup = x => sup.some(s => Math.abs(s - x) < 0.011);
    const zs = sd.zones.map((z, i) => ({ name: (q.zones[i] || {}).name || `Zone ${i + 1}`, x1: z.x1, x2: z.x2, nr: z.nr, p: z.p, Vfr: (q.zones[i] || {}).Vfr, ...zAt((z.x1 + z.x2) / 2) }));
    const rg = (q.regions || []).map(r => { const sx = isSup(r.x1) ? r.x1 : r.x2, xm = sx === r.x1 ? r.x2 : r.x1, ps = zAt(Math.min(Math.max(sx < 0.02 ? sx + 0.01 : sx - 0.01, 0), Lend)), sm = zAt(xm);
      return { name: r.name, kind: r.kind, x1: r.x1, x2: r.x2, ...sm, pD: ps.D, ptw: ps.tw, ptopB: ps.topB, ptopT: ps.topT, pbotB: ps.botB, pbotT: ps.botT }; });
    const gaps = q.gaps || [], splC = 3, halfL = gaps.length ? (gaps[0].b - gaps[0].a) / 2 : 0;
    const gr = k => (GRADES[k] ? k : '50');
    const p = { splX: gaps.map(o => o.x).join(', '), splL: gaps.length ? 2 * (halfL - splC / 12) : 0, splC, d: String(sd.d), h: sd.h, st: sd.transverseSpacing, Fu: sd.Fu, fc: +m.fc, wc: +m.wc || 0.15, K1: 1, nRule: 'exact', Qn10: q.QnEntered ? q.Qn : 0,
      ts: dk.ts, hh: dk.haunch, tdeck: dk.ts + 0.5, beff: q.beff, gF: gr(m.gradeFlange), gW: gr(m.gradeWeb), gam: { fat: q.gamI || 1.75 }, skew: ((g.skew || {}).max || 0) > 20 ? 'yes' : 'no', Frc: 25, wv: 48,
      zones: zs, regions: rg, ...(opt.beffMode === 'girder' ? { beffMode: 'girder', beffG: dk.beff } : {}) };
    const F = D0.fatigue || {}, zII = q.zones.find(z => z.lim === 'II'), spans = (pl.member || {}).spans || sup.slice(1).map((x, k) => x - sup[k]);
    const set = FA().settings({ limit: F.limit || 'auto', ADTT: F.ADTT, p: F.p, life: F.life, gam: { fI: 1.75, fII: zII ? zII.gam : 0.80 } });
    const ro = pl.ownerRules || {}, owner = ro.owner || 'AASHTO';
    const env = { owner, lf: { h0: ro.haunchInProperties === false }, fat: { set, B: FA().supports({ ok: true, spans: spans.map(Number), cont: sup.length > 2 }) } };
    return { p, env };
  }

  window.SBDStuds = { ZSPEC, RSPEC, DEFAULT, compute, checks, steps, fromPayload };
})();
