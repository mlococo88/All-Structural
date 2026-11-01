/* apps/steel-bridge/engine/legacy.js — import of the old Steel Bridge Design projects into an sbd2 project (window.SBDLegacy).
   Classic script, no DOM. Needs window.SBDModel (engine/model.js), loaded first; engine/model.js importLegacy() calls it.
   Created 2026-10-30 (docs/REBUILD_PLAN.md §5 "Project files: … imports old GirderDetail, Preliminary sizing and ST-Girder projects
   and autosaves; nothing is discarded"; CLAUDE.md §5).

   Reads (never writes, never deletes):
     - a Steel Bridge Design project file (SBD4, "Steel Bridge Design.html" sbdProjectFile): { app: 'SteelBridgeDesign', v: 1, name,
       data: <GirderDetail's P>, pl: { app: 'PlateLine', v, name, data: <Preliminary sizing's P> }, st: { …ST-Girder inputs, _schema:
       'stgirder' } } (the modules' part is also accepted as gd); its older formats: GirderDetail's { app: 'GirderDetail', data },
       Preliminary sizing's { app: 'PlateLine', data }, ST-Girder's Export JSON { _schema: 'stgirder', … };
     - the old app's autosaves (fromStorage): girderdetail_autosave_v1 ({ data, name }), plateline_autosave_v1 ({ data, name, ts }),
       stgirder.session (ST-Girder inputs), read only.
   Where the parts overlap, Preliminary sizing gives the bridge and the plates (as it sent them to GirderDetail), GirderDetail the module
   settings and the cross-section loads (its LLDF and DLs module), ST-Girder the rating factors (and the whole girder when it is the only part).

   Nothing is dropped: every field of every part that is not mapped is kept under project.legacy.unmapped.<part> at its own path, and
   project.legacy.summary lists what was mapped and what was not, for the import summary shown to the user. The module rows of the old app
   (GirderDetail's location rows, stud zones, splice plates: the demands Preliminary sizing sent) are not mapped: this app makes them from
   its own analysis; they are kept in legacy.unmapped.

   importLegacy(obj) → { ok, project, summary, errors, warnings } or { ok: false, error }.
   fromParts({ gd, pl, st, name }) → the same, from the parts (gd: GirderDetail's P, pl: Preliminary sizing's P, st: ST-Girder inputs).
   fromStorage(storage) → the same from the old autosaves, or { ok: false, error } when there are none. */
(function () {
  'use strict';
  const M = () => window.SBDModel;
  const J = o => JSON.parse(JSON.stringify(o));
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  const num = v => { if (typeof v === 'number') return v; if (v == null || v === '') return NaN; const s = String(v).trim().replace(/["”]/g, ''); let m = s.match(/^(\d+(?:\.\d+)?) (\d+)\/(\d+)$/); if (m) return +m[1] + m[2] / m[3]; m = s.match(/^(\d+)\/(\d+)$/); if (m) return m[1] / m[2]; const n = Number(s); return isFinite(n) ? n : NaN; };
  const fin = v => isFinite(num(v));

  /* a reader over one part that records every path it reads: what is never read is "unmapped" */
  function reader(src) {
    const used = new Set();
    const get = (path, d) => { const ks = path.split('.'); let o = src; for (const k of ks) { if (o == null || typeof o !== 'object') return d; o = o[k]; } if (o === undefined) return d; used.add(path); return o; };
    const peek = path => path.split('.').reduce((o, k) => (o == null || typeof o !== 'object' ? undefined : o[k]), src);
    const has = path => peek(path) !== undefined;   // does not count as read
    const n = (path, d) => { const v = get(path); return fin(v) ? num(v) : d; };
    const mark = path => used.add(path);
    // the unread part of src: a copy with every read path (and everything under it) removed; empty objects pruned
    const rest = () => { const out = (function walk(o, p) {
      if (used.has(p)) return undefined;
      if (Array.isArray(o)) return o.length ? J(o) : undefined;
      if (isObj(o)) { const r = {}; Object.keys(o).forEach(k => { const v = walk(o[k], p ? `${p}.${k}` : k); if (v !== undefined) r[k] = v; }); return Object.keys(r).length ? r : undefined; }
      return o === undefined ? undefined : o; })(src, ''); return out || {}; };
    return { get, has, n, mark, rest, used };
  }
  const GRADE = g => { const s = String(g || '').replace(/\s+/g, ''); return M().GRADES[s] ? s : /HPS70/i.test(s) ? 'HPS70W' : /HPS50/i.test(s) ? 'HPS50W' : /50W/i.test(s) ? '50W' : /36/.test(s) ? '36' : /50/.test(s) ? '50' : null; };
  const OWN = o => (M().OWNERS.includes(o) ? o : null);

  /* plates of Preliminary sizing (girder.top / bot: [{ L, b, t }], web: [{ L, t }], D) → contiguous segments of every breakpoint */
  function segmentsOf(G) {
    const cum = a => { let x = 0; return (a || []).map(q => { const o = { x0: x, x1: x + num(q.L), q }; x = o.x1; return o; }); };
    const T = cum(G.top), B = cum(G.bot), Wb = cum(G.web), at = (A, x) => (A.find(r => x >= r.x0 - 1e-9 && x < r.x1 - 1e-9) || A[A.length - 1]).q;
    const xs = [...new Set([0, ...T.map(r => r.x1), ...B.map(r => r.x1), ...Wb.map(r => r.x1)].map(v => +v.toFixed(6)))].sort((a, b) => a - b);
    const D = num(G.D);
    return xs.slice(0, -1).map((x0, i) => { const x1 = xs[i + 1], xm = (x0 + x1) / 2, t = at(T, xm), b = at(B, xm), w = at(Wb, xm);
      return { x0, x1, D, tw: num(w.t), topB: num(t.b), topT: num(t.t), botB: num(b.b), botT: num(b.t) }; });
  }
  const totalL = segs => segs.length ? segs[segs.length - 1].x1 : 0;

  /* ownMigrate(p): Preliminary sizing's own load-time migration of a saved project (anchors `function migrateOwnDef(p)`, `function ownApply(`):
     a project saved before the owner defaults (no ownDef, or ownDef.v < 4) is taken as having had the generic defaults: each owner default
     input (OWN14 rows of kind 'default', engine/owners.js RULES) still at its generic value (Preliminary sizing's DEFAULT: PL_GENERIC) moves
     to the owner's value; a value the user changed is kept. The old app does this when it opens such a project, so the import does too.
     Returns the inputs moved (listed in the import summary). */
  const PL_GENERIC = { 'suggest.fws': 25, 'suggest.dlDist': 'equal', 'limits.sdMandatory': true, 'bridge.fc': 4, 'bridge.tsac': 0, 'bridge.wcE': '', 'suggest.cll': 20, 'limits.minTw': 0.5, 'limits.minBf': 12,
    'limits.minTf': 0.75, 'framing.cpB': 6, 'limits.intL': 300, 'limits.intSkew': 30, 'limits.incD': 1, 'limits.incBf': 1, 'limits.thkRatio': 2.0, 'girder.gF': '50W', 'girder.gW': '50W', 'limits.shipLen': 120,
    'limits.shipWt': 90, 'limits.sLo': 6.0, 'framing.xfMinD': 48 };
  const OWN_DEF_V = 4;
  function ownMigrate(p) {
    const O = window.SBDOwners; if (!O || !p || !p.limits || (p.ownDef && +p.ownDef.v >= OWN_DEF_V)) return [];
    const o = M().OWNERS.includes(p.limits.dot) ? p.limits.dot : 'AASHTO', since = p.ownDef ? +p.ownDef.v || 0 : 0;
    const blank = x => x === '' || x == null || (typeof x === 'number' && isNaN(x)), same = (a, b) => blank(a) && blank(b) ? true : typeof b === 'number' ? Math.abs(Number(a) - b) < 1e-9 : String(a ?? '') === String(b ?? '');
    const defs = O.RULES.rules.filter(r => r.owner === o && r.kind === 'default' && r.key && r.value != null && typeof r.value !== 'object' && (r.dv || 1) > since && r.key in PL_GENERIC);
    const getP = k => k.split('.').reduce((q, x) => (q == null ? undefined : q[x]), p), setP = (k, v) => { const ks = k.split('.'), l = ks.pop(), q = ks.reduce((a, x) => (a[x] = a[x] || {}), p); q[l] = v; };
    const ch = []; defs.forEach(r => { const v = getP(r.key); if (v !== undefined && same(v, r.value)) return; if (v === undefined || same(v, PL_GENERIC[r.key])) { setP(r.key, r.value); ch.push(`${r.lbl || r.key} ${v === undefined ? 'blank' : v} → ${r.value} (${O.cite(r)})`); } });
    p.ownDef = { ...(p.ownDef || {}), v: OWN_DEF_V, o };
    return ch;
  }

  /* ---------- the parts ---------- */
  function fromPL(p0, P, notes) {
    const p = J(p0), mig = ownMigrate(p); if (mig.length) notes.push(`Preliminary sizing: the project predates the owner defaults; as the old app does when it opens it, the ${p.limits.dot} defaults were applied: ${mig.join('; ')}.`);
    const r = reader(p), b = 'bridge.'; r.mark('ownDef');
    const spans = (r.get(b + 'spans') || []).map(Number), nb = Math.round(r.n(b + 'nb', 0));
    if (spans.length) { P.spans.lengths = spans; P.spans.continuity = r.get(b + 'cont') === 'simple' || spans.length < 2 ? 'simple' : 'continuous'; }
    const sp = r.get(b + 'spacing', 'equal'), S = r.n(b + 'S', 9.5);
    let bays = new Array(Math.max(nb - 1, 0)).fill(S);
    if (sp === 'variable') { const v = String(r.get(b + 'bays') || '').split(/[,\s]+/).filter(Boolean).map(Number); if (v.length === nb - 1 && v.every(q => q > 0)) bays = v; else notes.push('Preliminary sizing: the variable girder spacing could not be read; equal spacing S used.'); }
    else { r.mark(b + 'bays'); if (sp === 'exterior') { const W = r.n(b + 'Wcc', NaN); if (W > 0 && nb > 1) bays = new Array(nb - 1).fill(W / (nb - 1)); } }
    const xs = P.xs = M().defaultXs(P);
    if (nb >= 2) { xs.nb = nb; xs.bays = bays; }
    xs.ohL = r.n(b + 'ohL', xs.ohL); xs.ohR = r.n(b + 'ohR', xs.ohR);
    const sk = r.get(b + 'skews'); if (Array.isArray(sk) && sk.length === spans.length + 1) xs.skews = sk.map(Number);
    if (r.get(b + 'curved')) notes.push('Preliminary sizing: the bridge is marked curved; this app designs straight girders (curvature not imported).');
    // deck edges: GirderDetail's (XS9, in the bridge as xs) when present; else Preliminary sizing's barrier or curb and railing
    const X = r.get(b + 'xs'), E = r.get(b + 'edge') || {}, bar = r.n(b + 'barrier', 1.5), barW = r.n('suggest.bar', 0.4);
    if (isObj(X) && X.L && X.R) ['L', 'R'].forEach(s => { xs.edges[s] = edgeOf(X[s]); });
    else if (E.mode === 'curb') ['L', 'R'].forEach(s => { xs.edges[s] = { type: 'curb', bw: 0, bwt: 0, cw: num(E['cw' + s]), ch: num(E['ch' + s]), rw: num(E['rw' + s]), rp: num(E['rp' + s]), rf: null, face: fin(E['f' + s]) ? num(E['f' + s]) : null }; });
    else ['L', 'R'].forEach(s => { xs.edges[s] = { ...xs.edges[s], type: 'barrier', bw: bar, bwt: barW }; });
    if (isObj(X) && fin(X.wcA)) xs.wcA = num(X.wcA);
    xs.ws.psf = r.n('suggest.fws', xs.ws.psf); xs.sip = r.n('suggest.sip', xs.sip); xs.allow = r.n('limits.allow', xs.allow);
    // OWN19 sidewalk override for the owner LL deflection limits (C-32, engineer 2026-11-01): Preliminary sizing limits.sidewalk 'yes' / 'no' →
    // analysis.deflSidewalk; 'auto' (the old default) or absent: not set (this app's default 'auto': the cross-section's sidewalks)
    { const v = r.get('limits.sidewalk'); if (v === 'yes' || v === 'no') { P.analysis = P.analysis || {}; P.analysis.deflSidewalk = v; } }
    // deck and materials
    const d = P.deck, c = P.materials.concrete;
    d.ts = r.n(b + 'ts', d.ts); d.haunch = r.n(b + 'haunch', d.haunch); d.tdeck = d.ts + Math.max(0, r.n(b + 'tsac', 0));
    c.fc = r.n(b + 'fc', c.fc); c.wc = r.n(b + 'wc', c.wc); { const e = r.n(b + 'wcE', NaN); if (e > 0) c.wcE = e; }
    const gF = GRADE(r.get('girder.gF')), gW = GRADE(r.get('girder.gW'));
    if (gF) { P.materials.steel.top = gF; P.materials.steel.bot = gF; } if (gW) P.materials.steel.web = gW;
    if (r.get('girder.wsU') === 'yes') notes.push('Preliminary sizing: uncoated weathering steel with a sacrificial thickness (OWN26) is not in this app yet; the plates are imported as entered.');
    // girders: one plate girder per cross-section girder, Preliminary sizing's plates (one layout for every girder), b_eff tributary (4.6.2.6.1)
    const segs = segmentsOf({ D: r.get('girder.D'), top: r.get('girder.top'), bot: r.get('girder.bot'), web: r.get('girder.web') });
    if (segs.length) { const L = spans.reduce((a, v) => a + v, 0); if (Math.abs(totalL(segs) - L) > 1e-6) notes.push(`Preliminary sizing: the plates end at ${totalL(segs)} ft; the bridge is ${L} ft long.`);
      const n = xs.nb, B = xs.bays;
      P.girders = [...Array(n)].map((_, j) => { const ext = j === 0 || j === n - 1, beffFt = j === 0 ? B[0] / 2 + xs.ohL : j === n - 1 ? B[n - 2] / 2 + xs.ohR : (B[j - 1] + B[j]) / 2;
        return { id: `G${j + 1}`, label: `G${j + 1}`, position: ext ? 'exterior' : 'interior', line: j, beff: +(beffFt * 12).toFixed(6), segments: J(segs) }; }); }
    // owner, load modifiers, analysis
    const o = OWN(r.get('limits.dot')); if (o) P.ownerRules.owner = o; else if (r.has('limits.dot')) notes.push(`Preliminary sizing: owner "${r.get('limits.dot')}" is not one of ${M().OWNERS.join(', ')}; AASHTO used.`);
    const eta = r.get(b + 'eta'); if (isObj(eta)) P.ownerRules.eta = { D: eta.D || 'no', R: eta.R || 'auto', I: eta.I || 'no', eD: num(eta.eD) || 1, eR: num(eta.eR) || 1, eI: num(eta.eI) || 1 };
    P.analysis = Object.assign(P.analysis || {}, { crack: ['none', '15', 'dl'].includes(r.get('analysis.crack')) ? r.get('analysis.crack') : 'none' });
    if (r.has('limits.deflRatio')) P.analysis.deflLimit = r.n('limits.deflRatio', 800);
    // framing, field splices, stiffener layout
    const F = P.framing = M().defaultFraming();
    ['spacing', 'supClear', 'stagMin'].forEach(k => { F[k] = r.n('framing.' + k, F[k]); });
    ['spPier', 'pierLen'].forEach(k => { const v = r.get('framing.' + k); F[k] = fin(v) ? num(v) : ''; });
    ['orient', 'arrange'].forEach(k => { const v = r.get('framing.' + k); if (v) F[k] = v; });
    ['spliceClear', 'tol', 'flSkI', 'flSkE', 'flSkG'].forEach(k => { F[k] = r.n('limits.' + k, F[k]); });
    const spl = r.get('girder.splices'); F.splices = Array.isArray(spl) ? spl.map(Number) : [];
    const ST = P.stiffeners = M().defaultStiffeners(), ly = ST.layout;
    ly.web = r.get('framing.stiff', 'on') === 'off' ? 'unstiffened' : 'stiffened'; ly.doRatio = r.n('framing.doRatio', 1); ly.mode = r.get('framing.doMode') === 'bays' ? 'bays' : 'uniform';
    const bl = r.get('framing.bays'); if (isObj(bl) && Array.isArray(bl.list)) ly.bays = J(bl.list);
    ly.frames = { Lb: F.spacing };
    const t = ST.transverse.types, bs = ST.bearing.types, gS = GRADE(r.get('framing.gS'));
    if (gS) { ST.transverse.gS = gS; ST.bearing.gS = gS; }
    t.A.bt = r.n('framing.stB', t.A.bt); t.A.tp = r.n('framing.stT', t.A.tp); t.B.bt = r.n('framing.cpB', t.B.bt); t.B.tp = r.n('framing.cpT', t.B.tp);
    ['A', 'B'].forEach(k => { bs[k].bt = r.n('framing.bsB', bs[k].bt); bs[k].tp = r.n('framing.bsT', bs[k].tp); bs[k].c = r.n('framing.clip', bs[k].c); });
    bs.A.np = Math.max(1, Math.round(r.n('framing.bsPairs', bs.A.np)));
    if (r.has('framing.xfMinD')) P.crossframes = Object.assign(P.crossframes || M().defaultCrossframes(), { dMinXF: r.n('framing.xfMinD', 48) });
    // project information
    const pr = P.project; pr.name = r.get('meta.name', pr.name) || pr.name; pr.designer = r.get('meta.compBy', '') || pr.designer; pr.checker = r.get('meta.chkBy', '') || pr.checker;
    pr.date = r.get('meta.compDate', '') || pr.date; { const a = r.get('assumptions', ''); if (a) pr.notes = a; }
    return r;
  }
  const edgeOf = q => ({ type: q.type === 'curb' ? 'curb' : 'barrier', bw: num(q.bw) || 0, bwt: num(q.bwt) || 0, cw: num(q.cw) || 0, ch: num(q.ch) || 0, rw: num(q.rw) || 0, rp: num(q.rp) || 0,
    rf: fin(q.rf) ? num(q.rf) : null, face: fin(q.face) ? num(q.face) : null });

  function fromGD(g, P, notes, hasPL) {
    const r = reader(g), xs = P.xs || (P.xs = M().defaultXs(P));
    // project information (Preliminary sizing's, when there, wins: it is the bridge)
    const pr = P.project; if (!hasPL) pr.name = r.get('meta.name', pr.name) || pr.name;
    pr.number = r.get('meta.projNo', '') || pr.number; if (!pr.designer) pr.designer = r.get('meta.compBy', ''); if (!pr.checker) pr.checker = r.get('meta.chkBy', ''); if (!pr.date) pr.date = r.get('meta.compDate', '');
    // cross-section and dead loads (LLDF and DLs module, GM.df): the inverse of engine/loads.js fromModel
    if (r.has('df')) { const dl = r.has('df.dl') ? g.df.dl : {};
      xs.lldf = { gap: r.n('df.gap', 4), kg: r.get('df.kg', 'max'), skewV: r.get('df.skewV', 'all'), extMin: r.get('df.extMin') === 'yes' };
      xs.dlMethod = ['massdot', 'aashto', 'ridot'].includes(dl.method) ? dl.method : 'massdot';
      xs.sidewalks = { L: { w: num(dl.swL) || 0, t: fin(dl.swThkL) ? num(dl.swThkL) : 8, fence: fin(dl.fenceL) ? num(dl.fenceL) : null, fenceX: fin(dl.fenceXL) ? num(dl.fenceXL) : null },
        R: { w: num(dl.swR) || 0, t: fin(dl.swThkR) ? num(dl.swThkR) : 8, fence: fin(dl.fenceR) ? num(dl.fenceR) : null, fenceX: fin(dl.fenceXR) ? num(dl.fenceXR) : null }, ped: num(dl.ped) || 0 };
      xs.median = { w: num(dl.medW) || 0, t: fin(dl.medThk) ? num(dl.medThk) : 8, joint: dl.medJoint === 'yes' };
      if (fin(dl.wcA)) xs.wcA = num(dl.wcA);
      if (dl.wsMode === 'thk') xs.ws = { mode: 'thk', psf: xs.ws.psf, thk: num(dl.wsThk), gam: num(dl.wsGam) };
      const keep = ['method', 'ped', 'swL', 'swThkL', 'swR', 'swThkR', 'medW', 'medThk', 'medJoint', 'wcA', 'fenceL', 'fenceXL', 'fenceR', 'fenceXR', 'wsMode', 'wsThk', 'wsGam'];
      keep.forEach(k => { if (dl[k] !== undefined) r.mark('df.dl.' + k); });
      const extraDl = Object.keys(dl).filter(k => !keep.includes(k)); if (extraDl.length) P.__dlRest = Object.fromEntries(extraDl.map(k => [k, dl[k]]));
      const ex = r.get('df.extra'); if (Array.isArray(ex)) xs.extra = J(ex);
      const ov = r.get('df.ovl'); if (Array.isArray(ov)) xs.overlays = J(ov);
      const E = r.get('df.edges'); if (isObj(E) && E.L && E.R) { xs.edges.L = edgeOf(E.L); xs.edges.R = edgeOf(E.R); }
      const lo = r.get('df.loadOverrides'); if (isObj(lo)) xs.overrides = J(lo);
      const bc = r.get('df.beamClass'); if (isObj(bc)) xs.beamClass = J(bc);
      // the bridge Preliminary sizing sent (df.bridge): used only without a Preliminary sizing part
      if (!hasPL) bridgeFromDf(r, P, notes); }
    // structural analysis settings (GM.sa)
    if (r.has('sa')) { const A = P.analysis = P.analysis || {};
      if (['none', '15', 'dl'].includes(r.get('sa.crack'))) A.crack = r.get('sa.crack');
      A.im = r.n('sa.im', 33); A.imf = r.n('sa.imf', 15); A.deflLimit = r.n('sa.defl', A.deflLimit || 800); A.seq = r.get('sa.seqOn', 'on') === 'off' ? 'off' : 'on';
      A.seqMod = r.get('sa.seqMod', 'n') === '3n' ? '3n' : 'n'; A.seqCustom = String(r.get('sa.seqCustom', '') || ''); }
    // girder section (GM.gs): deck reinforcement, rebar strength, modular ratio rule, M_p option, flange fatigue categories
    if (r.has('gs')) { const d = P.deck, c = P.materials.concrete;
      d.rebar = { top: { A: r.n('gs.Art', d.rebar.top.A), c: r.n('gs.crt', d.rebar.top.c) }, bot: { A: r.n('gs.Arb', d.rebar.bot.A), c: r.n('gs.crb', d.rebar.bot.c) } };
      P.materials.rebar.Fyr = r.n('gs.Fyr', P.materials.rebar.Fyr); c.K1 = r.n('gs.K1', c.K1); if (['exact', 'round'].includes(r.get('gs.nRule'))) c.nRule = r.get('gs.nRule');
      d.rebarInPositiveMp = r.get('gs.rebarMp') === 'incl';
      const F = P.fatigue = P.fatigue || M().defaultFatigue(); ['catT', 'catB'].forEach(k => { const v = r.get('gs.' + k); if (v) F[k] = v; }); }
    // fatigue (GM.fa)
    if (r.has('fa')) { const F = P.fatigue = P.fatigue || M().defaultFatigue();
      if (['auto', 'I', 'II'].includes(r.get('fa.limit'))) F.limit = r.get('fa.limit');
      F.ADTT = r.n('fa.ADTT', F.ADTT); F.p = r.n('fa.p', F.p); F.life = r.n('fa.life', F.life); F.gam = { fI: r.n('fa.gam.fI', F.gam.fI), fII: r.n('fa.gam.fII', F.gam.fII) };
      if (['cracked', 'uncracked'].includes(r.get('fa.negSec'))) F.negSec = r.get('fa.negSec');
      const ds = r.get('fa.dist'); if (isObj(ds)) F.dist = { ...F.dist, ...J(ds) }; }
    // shear connectors (GM.sc)
    if (r.has('sc')) { const Q = P.studs = P.studs || M().defaultStuds();
      Q.d = r.n('sc.d', Q.d); Q.h = r.n('sc.h', Q.h); Q.st = r.n('sc.st', Q.st); Q.Fu = r.n('sc.Fu', Q.Fu); Q.Qn10 = r.n('sc.Qn10', Q.Qn10); Q.gamFat = r.n('sc.gam.fat', Q.gamFat);
      Q.Frc = r.n('sc.Frc', Q.Frc); Q.wv = r.n('sc.wv', Q.wv); Q.splX = String(r.get('sc.splX', '') || ''); Q.splL = r.n('sc.splL', Q.splL); Q.splC = r.n('sc.splC', Q.splC);
      r.mark('sc.skew'); /* GirderDetail's skew flag is set by Preliminary sizing from the support skews: this app's 'auto' does the same */ }
    // transverse and bearing stiffeners (GM.ts, bearing stiffeners bs): grades, electrode, plate types
    const ST = P.stiffeners = P.stiffeners || M().defaultStiffeners();
    if (r.has('ts')) { const gS = GRADE(r.get('ts.gS')); if (gS) ST.transverse.gS = gS; ST.transverse.Fexx = r.n('ts.Fexx', ST.transverse.Fexx);
      const T = r.get('ts.types'); if (isObj(T)) ['A', 'B'].forEach(k => { if (isObj(T[k])) ST.transverse.types[k] = { ...ST.transverse.types[k], ...J(T[k]) }; }); }
    if (r.has('bs')) { const gS = GRADE(r.get('bs.gS')); if (gS) ST.bearing.gS = gS; ST.bearing.Fexx = r.n('bs.Fexx', ST.bearing.Fexx);
      const T = r.get('bs.types'); if (isObj(T)) ['A', 'B'].forEach(k => { if (isObj(T[k])) ST.bearing.types[k] = { ...ST.bearing.types[k], ...J(T[k]) }; });
      const rows = g.bs && g.bs.rows; if (Array.isArray(rows) && rows.length && fin(rows[0].ed)) { ST.bearing.ed = num(rows[0].ed); r.mark('bs.rows.0.ed'); } }
    // cross-frames (GM.cf): the member and connection inputs; the geometry is the project's
    if (r.has('cf')) { const C = P.crossframes = P.crossframes || M().defaultCrossframes();
      ['type', 'gA', 'gG', 'primary', 'fatCat'].forEach(k => { const v = r.get('cf.' + k); if (v != null && v !== '') C[k] = v; });
      C.dMinXF = r.n('cf.dMinXF', C.dMinXF);
      ['dia', 'wind', 'mem', 'conn', 'user'].forEach(k => { const v = r.get('cf.' + k); if (isObj(v)) C[k] = { ...C[k], ...J(v) }; });
      const sb = r.get('cf.sb'); if (isObj(sb)) { C.sb = { ...C.sb, on: sb.on || C.sb.on, full: sb.full === 'yes' || sb.full === 'no' ? sb.full : 'auto', Cb: fin(sb.Cb) ? num(sb.Cb) : C.sb.Cb, bs: fin(sb.bs) ? num(sb.bs) : C.sb.bs, tsp: fin(sb.tsp) ? num(sb.tsp) : C.sb.tsp }; ['on', 'full', 'Cb', 'bs', 'tsp'].forEach(k => r.mark('cf.sb.' + k)); r.used.delete('cf.sb'); } }
    // field splices (GirderDetail's splice settings): bolts, load factors, clearances
    if (r.has('bolts')) { const Q = P.splices = P.splices || M().defaultSplices();
      Q.bolts = { ...Q.bolts, ...J(r.get('bolts')) }; const G = r.get('gam'); if (isObj(G)) Q.gam = { ...Q.gam, ...J(G) }; const C = r.get('clr'); if (isObj(C)) Q.clr = { ...Q.clr, ...J(C) }; }
    // deck overhang brackets (GM.oh) → constructibility
    if (r.has('oh')) { const o = {}; ['a', 'hb', 'wOH', 'tOH', 'wc', 'qForm', 'wScreed', 'wRail', 'wWalk', 'qCL', 'bCL', 'Pfm', 'Rh', 'Cb'].forEach(k => { if (fin(r.get('oh.' + k))) o[k] = num(r.get('oh.' + k)); });
      const G = r.get('oh.gam'); if (isObj(G)) o.gam = J(G); P.constr = { oh: o }; }
    // welds (GM.wt)
    if (r.has('wt')) { const Wd = P.welds = P.welds || M().defaultWelds(); Wd.Fexx = r.n('wt.Fexx', Wd.Fexx); const G = r.get('wt.gam'); if (isObj(G)) Wd.gam = { ...Wd.gam, ...J(G) }; }
    return r;
  }
  /* the bridge from GirderDetail's df.bridge (what Preliminary sizing sent), when the file has no Preliminary sizing part */
  function bridgeFromDf(r, P, notes) {
    const b = 'df.bridge.', spans = r.get(b + 'spans'); if (!Array.isArray(spans) || !spans.length) return;
    P.spans.lengths = spans.map(Number); P.spans.continuity = r.get(b + 'cont') && spans.length > 1 ? 'continuous' : 'simple';
    const xs = P.xs, nb = Math.round(r.n(b + 'nb', xs.nb)), bays = r.get(b + 'bays');
    xs.nb = nb; xs.bays = Array.isArray(bays) && bays.length === nb - 1 ? bays.map(Number) : new Array(nb - 1).fill(r.n(b + 'S', 9.5));
    xs.ohL = r.n(b + 'ohL', xs.ohL); xs.ohR = r.n(b + 'ohR', xs.ohR); const sk = r.get(b + 'skews'); if (Array.isArray(sk) && sk.length === spans.length + 1) xs.skews = sk.map(Number);
    const d = P.deck, c = P.materials.concrete; d.ts = r.n(b + 'tsDeck', d.ts); d.haunch = r.n(b + 'haunch', d.haunch); d.tdeck = d.ts + Math.max(0, r.n(b + 'tsac', 0)); c.fc = r.n(b + 'fc', c.fc); c.wc = r.n(b + 'wc', c.wc);
    xs.ws.psf = r.n(b + 'fws', xs.ws.psf); xs.sip = r.n(b + 'sip', xs.sip); xs.allow = r.n(b + 'allow', xs.allow);
    const gF = GRADE(r.get(b + 'gF')), gW = GRADE(r.get(b + 'gW')); if (gF) { P.materials.steel.top = gF; P.materials.steel.bot = gF; } if (gW) P.materials.steel.web = gW;
    const pl = r.get(b + 'plates'); if (isObj(pl) && fin(pl.D)) { const z = q => (q || []).map(o => ({ L: (num(o.x1) - num(o.x0)) || num(o.L), b: o.b, t: o.t }));
      const segs = segmentsOf({ D: pl.D, top: z(pl.top), bot: z(pl.bot), web: z(pl.web) }); if (segs.length && segs.every(s => s.x1 > s.x0)) setGirders(P, segs); }
    if (r.has(b + 'owner') && OWN(r.get(b + 'owner'))) P.ownerRules.owner = r.get(b + 'owner');
    notes.push('No Preliminary sizing part: the bridge is the one Preliminary sizing last sent to GirderDetail (its LLDF and DLs module).');
  }
  function setGirders(P, segs) { const xs = P.xs, n = xs.nb, B = xs.bays;
    P.girders = [...Array(n)].map((_, j) => { const ext = j === 0 || j === n - 1, beffFt = j === 0 ? B[0] / 2 + xs.ohL : j === n - 1 ? B[n - 2] / 2 + xs.ohR : (B[j - 1] + B[j]) / 2;
      return { id: `G${j + 1}`, label: `G${j + 1}`, position: ext ? 'exterior' : 'interior', line: j, beff: +(beffFt * 12).toFixed(6), segments: J(segs) }; }); }

  /* ST-Girder inputs (one girder, one span): the whole girder when there is no other part; the rating factors always */
  function fromST(s, P, notes, alone) {
    const r = reader(s);
    if (r.has('rate')) { P.rating = { phiC: r.n('rate.phiC', 1), phiS: r.n('rate.phiS', 1) }; }
    if (!alone) return r;
    const pr = P.project; pr.name = r.get('proj.name', pr.name) || pr.name; pr.designer = r.get('proj.by', '') || ''; pr.date = r.get('proj.date', '') || ''; pr.number = r.get('proj.job', '') || '';
    const L = r.n('geom.L', 120); P.spans = { lengths: [L], continuity: 'simple' };
    const nb = Math.round(r.n('geom.nGirders', 5)), S = r.n('geom.S', 9), xs = P.xs = M().defaultXs(P);
    xs.nb = nb; xs.bays = new Array(nb - 1).fill(S); xs.ohL = xs.ohR = r.n('deck.oh', 3); xs.skews = [r.n('loads.skew', 0), r.n('loads.skew', 0)];
    const sec = 'sec.', D = r.n(sec + 'D', 60), tw = r.n(sec + 'tw', 0.5);
    let segs; if (r.get(sec + 'useSegs') && Array.isArray(r.get(sec + 'segs'))) { let x0 = 0; segs = r.get(sec + 'segs').map(q => { const o = { x0, x1: num(q.xEnd), D, tw, topB: num(q.bft), topT: num(q.tft), botB: num(q.bfb), botT: num(q.tfb) }; x0 = o.x1; return o; }); }
    else segs = [{ x0: 0, x1: L, D, tw, topB: r.n(sec + 'bft', 16), topT: r.n(sec + 'tft', 0.75), botB: r.n(sec + 'bfb', 18), botT: r.n(sec + 'tfb', 1.25) }];
    const Fy = r.n('mat.Fyf', 50), Fu = r.n('mat.Fu', 70), gr = Fy >= 70 ? 'HPS70W' : Fy <= 36 ? '36' : Fu >= 70 ? '50W' : '50'; r.mark('mat.grade');
    P.materials.steel = { top: gr, bot: gr, web: r.n('mat.Fyw', Fy) >= 70 ? 'HPS70W' : gr }; P.materials.Es = r.n('mat.Es', 29000);
    if (r.get('mat.hybrid')) notes.push('ST-Girder: hybrid section flag; this app takes the web grade from F_yw.');
    const d = P.deck, c = P.materials.concrete; c.fc = r.n('deck.fc', c.fc); c.wc = r.n('deck.wc', c.wc); d.ts = r.n('deck.ts', d.ts); d.haunch = r.n('deck.haunch', d.haunch); d.tdeck = r.get('deck.tsSeparate') ? r.n('deck.tsDL', d.ts) : d.ts;
    d.composite = r.get('deck.deckOn') !== false; P.materials.rebar.Fyr = r.n('deck.fyd', 60);
    d.rebar = { top: { A: r.n('negM.As', 0), c: r.n('negM.dTop', 2.5) }, bot: { A: 0, c: 1 } };
    const beff = r.get('deck.beffAuto') === false ? r.n('deck.beff', S * 12) : null; r.mark('deck.beff');
    const pos = r.get('loads.pos') === 'exterior' ? 'exterior' : 'interior';
    P.girders = [{ id: 'G1', label: String(r.get('proj.girderId', 'G1') || 'G1'), position: pos, line: pos === 'exterior' ? 0 : Math.min(1, nb - 1), beff: beff || (pos === 'exterior' ? S / 2 + xs.ohL : S) * 12, segments: segs }];
    P.framing = M().defaultFraming(); P.framing.spacing = r.n('geom.Lb', 20); P.framing.splices = [];
    const ST = P.stiffeners = M().defaultStiffeners(); ST.layout.web = r.get('stiff.transverse') === false ? 'unstiffened' : 'stiffened'; ST.layout.doRatio = r.n('stiff.doSpc', 60) / D; ST.layout.frames = { Lb: P.framing.spacing };
    ST.transverse.types.A.bt = r.n('stiff.bt', 6); ST.transverse.types.A.tp = r.n('stiff.tp', 0.5);
    ['A', 'B'].forEach(k => { ST.bearing.types[k].bt = r.n('stiff.bearB', 7); ST.bearing.types[k].tp = r.n('stiff.bearT', 0.75); ST.bearing.types[k].np = Math.max(1, Math.round(r.n('stiff.bearN', 2) / 2)); });
    const Q = P.studs = M().defaultStuds(); Q.d = r.n('conn.studD', Q.d); Q.h = r.n('conn.studH', Q.h); Q.Fu = r.n('conn.Fu', Q.Fu);
    const F = P.fatigue = M().defaultFatigue(), sl = r.get('fatigue.adttIsSingleLane') !== false; F.ADTT = r.n('fatigue.ADTT', F.ADTT); F.p = sl ? 1 : ({ 1: 1, 2: 0.85 }[Math.round(r.n('fatigue.lanes', 2))] || 0.8);
    F.life = r.n('fatigue.designLife', 75); F.limit = ['I', 'II'].includes(r.get('fatigue.lsMode')) ? r.get('fatigue.lsMode') : 'auto';
    notes.push('ST-Girder only: one simple span of one girder; the loads come from this app\'s cross-section with ST-Girder\'s girder count and spacing. ST-Girder\'s own load inputs (extra DC, barrier, wearing surface, entered LL, distribution factors) are kept unmapped.');
    return r;
  }

  /* ---------- assembly ---------- */
  const PARTS = { gd: 'GirderDetail modules', pl: 'Preliminary sizing (PlateLine)', st: 'Design & Rating (ST-Girder)' };
  function fromParts(o) {
    const P = M().defaultProject(), notes = [], read = {};
    P.analysis = {};
    if (o.pl) read.pl = fromPL(o.pl, P, notes);
    if (o.gd) read.gd = fromGD(o.gd, P, notes, !!o.pl);
    if (o.st) read.st = fromST(o.st, P, notes, !o.pl && !o.gd);
    if (!o.pl && !o.gd && !o.st) return { ok: false, error: 'The file has no project part (GirderDetail, Preliminary sizing or ST-Girder).' };
    // construction live load (2026-11-01, D-1 of docs/steel-bridge-comparison.md §d): GirderDetail's Structural analysis loads each girder with
    // w_CL = cll/1000 × b_eff (ft) (GM.sa.compute `wCL = (nm(b.cll) || 0) / 1000 * beffFt`), cll (psf) from its bridge (df.bridge.cll, sent by
    // Preliminary sizing), else Preliminary sizing's own suggest.cll (its Suggest: SG.cll). This app takes the construction live load per girder
    // from girders[i].loadsManual.CL (klf; engine/analysis.js loadsOf), which nothing filled on import before (M_CL, V_CL = 0).
    { const g = read.gd && read.gd.n('df.bridge.cll', NaN), q = read.pl && read.pl.n('suggest.cll', NaN), cll = fin(g) ? g : fin(q) ? q : NaN;
      if (fin(cll) && cll > 0 && Array.isArray(P.girders)) { P.girders.forEach(G => { if (G.loadsManual && fin(G.loadsManual.CL)) return; G.loadsManual = { ...(G.loadsManual || {}), CL: +(cll / 1000 * G.beff / 12).toFixed(6) }; });
        notes.push(`Construction live load ${cll} psf (${fin(g) ? 'GirderDetail' : 'Preliminary sizing'}) × each girder's b_eff, as GirderDetail's Structural analysis: Analysis settings, construction live load per girder.`); } }
    if (P.__dlRest) { notes.push(`GirderDetail LLDF and DLs: ${Object.keys(P.__dlRest).join(', ')} not in this app's cross-section yet (kept unmapped).`); delete P.__dlRest; }
    if (!Object.keys(P.analysis).length) delete P.analysis;
    if (o.name && (!P.project.name || P.project.name === 'New steel bridge')) P.project.name = o.name;
    P.framing.splices = (P.framing.splices || []).filter(x => x > 0 && x < P.spans.lengths.reduce((a, b) => a + b, 0));
    const unmapped = {}, summary = { source: o.source || '', parts: [], unmapped: [], notes };
    Object.entries(read).forEach(([k, r]) => { const rest = r.rest(); summary.parts.push({ part: k, label: PARTS[k], mapped: r.used.size });
      if (Object.keys(rest).length) { unmapped[k] = rest; summary.unmapped.push(...Object.keys(rest).map(f => ({ part: k, label: PARTS[k], field: f, what: describe(k, f, rest[f]) }))); } });
    P.legacy = { importedAt: o.now || new Date().toISOString(), source: o.source || '', parts: Object.keys(read), unmapped, summary };
    const v = M().validate(P);
    return { ok: true, project: P, summary, errors: v.errors, warnings: v.warnings };
  }
  const ROWS = { fa: 'fatigue detail rows', sc: 'stud zones and regions', ts: 'stiffener locations', bs: 'bearing stiffener locations', gs: 'girder section locations', wt: 'weld locations and transitions', oh: 'overhang rows', cf: 'cross-frame geometry and demands', sa: 'analysis display settings' };
  function describe(part, f, v) {
    const n = Array.isArray(v) ? `${v.length} item(s)` : isObj(v) ? `${Object.keys(v).length} field(s): ${Object.keys(v).slice(0, 8).join(', ')}${Object.keys(v).length > 8 ? ', …' : ''}` : JSON.stringify(v);
    if (part === 'gd' && ROWS[f]) return `${n} — ${ROWS[f]}; this app makes its own from its analysis`;
    if (['ui', 'mod', '_lock', 'v', 'sig', 'ts'].includes(f)) return `${n} — view state of the old app`;
    if (part === 'gd' && ['top', 'bot', 'web', 'sec', 'dem', 'spl', 'source'].includes(f)) return `${n} — GirderDetail's single field splice (plates, demands); this app designs each splice from its analysis`;
    if (part === 'pl' && ['suggest', 'alts', 'ws', 'costs', 'limits'].includes(f)) return `${n} — Preliminary sizing's sizing and cost settings (Suggest/Optimize are not in this app yet)`;
    return n;
  }

  /* importLegacy(obj): one file of the old app */
  function importLegacy(obj, opt) {
    opt = opt || {}; const o = obj || {};
    if (o.app === 'SteelBridgeDesign') { const v = Math.round(+o.v) || 1; if (v > 1) return { ok: false, error: `This Steel Bridge Design file is version ${o.v}; this app reads version 1. Nothing was changed.` };
      const gd = o.gd || o.data || null, pl = o.pl && (o.pl.data || o.pl), st = o.st ? (() => { const s = { ...o.st }; delete s._schema; return s; })() : null;
      return fromParts({ gd, pl, st, name: o.name, source: 'Steel Bridge Design project file', now: opt.now }); }
    if (o.app === 'GirderDetail') return fromParts({ gd: o.data, name: o.name, source: 'GirderDetail project file', now: opt.now });
    if (o.app === 'PlateLine') return fromParts({ pl: o.data, name: o.name, source: 'Preliminary sizing (PlateLine) project file', now: opt.now });
    if (o._schema === 'stgirder') { const s = { ...o }; delete s._schema; return fromParts({ st: s, source: 'ST-Girder project file', now: opt.now }); }
    if (o._schema === 'stgirder-external-demands') return { ok: false, error: 'This is a GirderDetail → ST-Girder hand-off file (demands of one girder), not a project. Open it on the Flexure, Fatigue or Rating tab (Demands: hand-off file). Nothing was changed.' };
    if (o.app === 'PlateLine-splices') return { ok: false, error: 'This is a PlateLine splice export (splice demands), not a project. Nothing was changed.' };
    return { ok: false, error: 'Not a Steel Bridge Design, GirderDetail, Preliminary sizing or ST-Girder project file. Nothing was changed.' };
  }
  /* fromStorage(storage): the old app's autosaves (read only) */
  const OLD_KEYS = { gd: 'girderdetail_autosave_v1', pl: 'plateline_autosave_v1', st: 'stgirder.session' };
  function fromStorage(storage, opt) {
    const rd = k => { try { const t = storage.getItem(k); return t ? JSON.parse(t) : null; } catch (e) { return null; } };
    const g = rd(OLD_KEYS.gd), p = rd(OLD_KEYS.pl), s = rd(OLD_KEYS.st);
    const gd = g && g.data ? g.data : null, pl = p && p.data ? p.data : null, st = isObj(s) ? s : null;
    if (!gd && !pl && !st) return { ok: false, error: 'No autosave of the old Steel Bridge Design was found in this browser.' };
    return fromParts({ gd, pl, st, name: (p && p.name) || (g && g.name) || '', source: `old app autosave (${Object.entries({ gd, pl, st }).filter(([, v]) => v).map(([k]) => OLD_KEYS[k]).join(', ')})`, now: (opt || {}).now });
  }
  /* summaryText(summary): the import summary as plain lines */
  function summaryText(S) {
    const out = [`Imported from: ${S.source}.`, ...S.parts.map(q => `${q.label}: ${q.mapped} field(s) mapped.`)];
    if (S.notes.length) out.push('Notes:', ...S.notes.map(n => '  - ' + n));
    if (S.unmapped.length) out.push('Not mapped (kept in the project under legacy.unmapped; nothing was dropped):', ...S.unmapped.map(u => `  - ${u.label}: ${u.field} — ${u.what}`));
    return out.join('\n');
  }

  window.SBDLegacy = { OLD_KEYS, ownMigrate, importLegacy, fromParts, fromStorage, summaryText, segmentsOf };
})();
