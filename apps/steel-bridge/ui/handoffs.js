/* apps/steel-bridge/ui/handoffs.js — cross-tool hand-offs of the new app (window.SBDHandoffs, window.SBDHandoffUI). HANDOFF.md, channels
   under bridgeSuite.v1. (ui/bridgexfer.js, BridgeXfer v1, loaded first). Keys and payload formats are GirderDetail's, unchanged (CLAUDE.md §5):

   1. projectMeta (HANDOFF.md §4.1, schema bridge-project-meta): "Use shared project info" / "Share project info", as GirderDetail's
      `Shared project info` script (anchor `/* Shared project info (HANDOFF.md §4.1`). Fields: projectName → Project name, jobNo → Number,
      client → Client name, preparedBy → Designer, checkedBy → Checker, date → Date (text here, so any date text is taken); bridgeId and
      location: no such field here (sent blank, as GirderDetail sends the fields it does not have).
   2. lldf (HANDOFF.md §4.3, schema bridge-lldf-factors, receiver id 'steelbridge'): "Pull from LL & DL" for the girder selected on the
      Girders & plates tab, a port of GirderDetail gdLldfPlan / gdLldfDialog / gdLldfApply (anchor `const GD_LLDF =`): the same checks
      (units lanes per girder; span count refused; span lengths, girder count, cross-section type and skew warned; perFootStrip refused),
      the same choice (lldf's interior/exterior envelope for this girder's cross-section line, or lldf's beam with the same number), the
      same mapping (governingBySpan[i] to span i when complete, else governing to every span; governingNeg.gM to every pier). GirderDetail
      writes the factors into its manual inputs (sa.dfm, sa.dfSrc = 'manual'); here they go to the new optional field girders[i].dfPull
      { spans: [{ gM, gV, fatM, fatV }], piers: [{ gM }], source }, which engine/analysis.js dfOf lays over this girder's factors field by
      field (a field the payload lacks keeps its factor). "Stop using" removes it.
   3. superReactions (HANDOFF.md §4.4, schema bridge-super-reactions): "Send reactions to Substructure Loading" and "Export hand-off (JSON)",
      a port of GirderDetail gdSrPayload (anchor `const GD_SR =`): this app's analysis (engine/analysis.js analyzeGirder) for every girder
      G1…Gn of the cross-section, the unfactored DC1, DC2, DW (and the MassDOT UT, UF) reactions per support, allGirders:true, ownerRules,
      utilities, and the notes (LL+IM and pedestrian reactions, owner rules); also the copy bridgeSuite.v1.superReactions.by.girderdetail
      (the slot GirderDetail writes; this app replaces GirderDetail). A cross-section girder with no plate girder of its own takes the plates
      of the first plate girder of the same position (exterior: G1 and Gn), with its own loads and factors (girders[i].line = that girder).
   girderDemands (§4.9): GirderDetail → ST-Girder inside the old app; this app has both roles, so it neither sends nor pulls it (a hand-off
   file from GirderDetail still opens on the check tabs, engine/demandfile.js). Nothing is applied without the user's click and confirm. */
(function () {
  'use strict';
  const PRODUCER = 'Steel Bridge Design', FILE = 'apps/steel-bridge/index.html', RX = 'steelbridge';
  const LLDF = { ch: 'lldf', schema: 'bridge-lldf-factors', ver: 1 }, SR = { ch: 'superReactions', schema: 'bridge-super-reactions', id: 'girderdetail' };
  const BX = () => window.BridgeXfer, AN = () => window.SBDAnalysis, OW = () => window.SBDOwners;
  const isNum = v => typeof v === 'number' && isFinite(v);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f0 = v => isNum(+v) ? (+v).toFixed(0) : '—', f2 = v => isNum(+v) ? (+v).toFixed(2) : '—', f3 = v => isNum(+v) ? (+v).toFixed(3) : '—';
  const r3 = v => Math.round(v * 1000) / 1000;
  const when = t => { const d = new Date(t); return t && isFinite(d) ? d.toLocaleString() : 'time unknown'; };

  /* ---------- 1. projectMeta ---------- */
  const PM = { projectName: 'name', bridgeId: null, jobNo: 'number', client: 'owner', location: null, preparedBy: 'designer', checkedBy: 'checker', date: 'date' };
  const PM_LBL = { projectName: 'Project name', bridgeId: 'Bridge ID', jobNo: 'Job / project no.', client: 'Client', location: 'Location', preparedBy: 'Prepared by', checkedBy: 'Checked by', date: 'Date' };
  function pmFields(P) { const f = {}, pr = P.project || {}; for (const k in PM) f[k] = PM[k] ? String(pr[PM[k]] == null ? '' : pr[PM[k]]).trim() : ''; return f; }
  function pmPayload(P) { const f = pmFields(P); return { _schema: 'bridge-project-meta', project: { name: f.projectName, bridgeId: f.bridgeId }, fields: f }; }
  /* pmPlan(P, payload): the title-block fields the shared info would change: [{ k, path, old, nu }] (blank shared fields left unchanged) */
  function pmPlan(P, pl) {
    const f = (pl && pl.fields) || {}, pr = P.project || {}, todo = [];
    for (const k in PM) { if (!PM[k]) continue; const v = f[k] == null ? '' : String(f[k]).trim(); if (!v) continue; const old = String(pr[PM[k]] == null ? '' : pr[PM[k]]);
      if (v === old) continue; todo.push({ k, path: PM[k], old, nu: v }); }
    return todo;
  }

  /* ---------- 2. lldf pull ---------- */
  const ext0 = (j, nb) => j === 0 || j === nb - 1;
  const projOf = pl => { const p = pl && pl.project; return p && typeof p === 'object' ? String(p.name || '') : String(p || ''); };
  /* lldfPlan(P, gi, pl, basis): GirderDetail gdLldfPlan on this app's bridge (spans, xs.nb, xs.skews) and plate girder gi (its cross-section
     line j). Returns { err, warn, rows: [{ lbl, old, nu, keep }], unused, j, ext, tKey, basis, bySpan, basisLbl, pull } (pull: the dfPull) */
  function lldfPlan(P, gi, pl, basis) {
    const err = [], warn = [], rows = [], unused = [], g = P.girders[gi];
    const spans = (P.spans.lengths || []).map(Number), ns = spans.length, nb = P.xs ? Math.round(P.xs.nb) : 0, cont = P.spans.continuity !== 'simple' && ns > 1;
    if (!g) return { err: ['Select a plate girder first.'], warn, rows, unused };
    if (!(nb > 0) || !ns) return { err: ['Define the spans and the cross-section (number of girders) first; the factors are mapped onto them.'], warn, rows, unused };
    const j = AN().lineOf(P, g), ext = ext0(j, nb), tKey = ext ? 'exterior' : 'interior';
    if (pl.units && pl.units.df != null && !/lanes? per girder/i.test(String(pl.units.df))) err.push(`Unsupported distribution factor unit "${pl.units.df}". This tool takes lanes per girder.`);
    const ls = Array.isArray(pl.spans) ? pl.spans : [];
    if (!ls.length || !ls.every(v => isNum(v) && v > 0)) err.push('The hand-off has no valid span lengths (positive numbers, ft).');
    else if (ls.length !== ns) err.push(`Span count differs: LL & DL has ${ls.length} span${ls.length > 1 ? 's' : ''}, this bridge has ${ns}. Pull factors only for the same bridge.`);
    else if (ls.some((L, i) => Math.abs(L - spans[i]) > 0.5)) warn.push(`Span lengths differ: LL & DL ${ls.map(f2).join(' + ')} ft, this bridge ${spans.map(f2).join(' + ')} ft.`);
    const plNb = Number(pl.Nb);
    if (pl.Nb != null && plNb !== nb) warn.push(`Number of girders differs: LL & DL ${pl.Nb}, this bridge ${nb}.`);
    if (basis === 'beam' && plNb !== nb) err.push('"Same beam number" needs the same number of girders in both tools. Use the interior / exterior envelope.');
    if (pl.perFootStrip === true) err.push('LL & DL sent cast-in-place slab factors: they are per 1-ft strip of slab width (AASHTO LRFD 4.6.2.3), not per girder. This tool needs girder factors.');
    if (pl.bridgeType && pl.bridgeType !== 'a') warn.push(`LL & DL computed the factors for cross-section type (${pl.bridgeType}); this tool designs steel I-girders, type (a).`);
    const sk = ((P.xs || {}).skews || []).map(Number).filter(isNum), skM = sk.length ? Math.max(...sk.map(Math.abs)) : 0;
    if (pl.skew != null && !isNum(pl.skew)) err.push('The hand-off skew is not a number.');
    else if (pl.skewShear != null && !isNum(pl.skewShear)) err.push('The hand-off shear skew (skewShear) is not a number.');
    else if (pl.skewShear != null && Math.abs(Math.abs(pl.skewShear) - skM) > 0.5) warn.push(`Skew differs: LL & DL ${f0(Math.abs(pl.skewShear))}° for shear (${f0(pl.skew)}° for moment), this bridge up to ${f0(skM)}°.`);
    else if (pl.skewShear == null && pl.skew != null && Math.abs(Math.abs(pl.skew) - skM) > 0.5) warn.push(`Skew differs: LL & DL ${f0(pl.skew)}°, this bridge up to ${f0(skM)}°.`);
    const pick = o => !o || typeof o !== 'object' ? null : basis === 'beam' ? (o.byBeam || {})[String(j + 1)] || null : o[tKey] || null;
    const pos = pick(pl.governing), neg = pick(pl.governingNeg);
    if (!pos) err.push(`The hand-off has no positive-region factors for ${basis === 'beam' ? `beam ${j + 1}` : `the ${tKey} girder`}.`);
    const num = (o, k, lbl, req) => { const v = o ? o[k] : undefined;
      if (v == null) { if (req) err.push(`${lbl} is missing.`); return null; }
      if (!isNum(v) || !(v > 0)) { err.push(`${lbl} is not a positive number (${v}).`); return null; } return v; };
    // the factors in use now (before the pull): this girder's factors without any earlier pull
    let cur = null; try { const g0 = { ...g }; delete g0.dfPull; const mod = g0.loads && g0.df ? null : AN().moduleOf(P, gi); cur = AN().dfOf(P, g0, ns, mod && !mod.errors ? mod : null); } catch (e) { cur = null; }
    const old = (i, k, pier) => cur ? (pier ? cur.piers[i] : cur.spans[i])[k] : null;
    const bySpan = Array.isArray(pl.governingBySpan) && pl.governingBySpan.length === ns && spans.every((_, i) => pick(pl.governingBySpan[i])) ? pl.governingBySpan : null;
    const pull = { use: true, spans: spans.map(() => ({})), piers: [] };
    const LB = { gM: 'g moment', gV: 'g shear', fatM: 'g fatigue moment', fatV: 'g fatigue shear' };
    if (pos) { let noFat = false;
      spans.forEach((_, i) => { const o = bySpan ? pick(bySpan[i]) : pos, sl = bySpan ? ` (span ${i + 1})` : '';
        [['gM', 'Moment factor', true], ['gV', 'Shear factor', true], ['fatM', 'Fatigue moment factor', false], ['fatV', 'Fatigue shear factor', false]].forEach(([k, lbl, req]) => {
          const v = num(o, k, lbl + sl, req); if (o && (o.fatM == null || o.fatV == null)) noFat = true;
          if (v != null) pull.spans[i][k] = v;
          rows.push({ lbl: `Span ${i + 1}: ${LB[k]}`, old: old(i, k), nu: v, keep: 'unchanged' }); }); });
      if (noFat) warn.push('The hand-off has no fatigue factor for this girder; those factors are left unchanged.'); }
    if (cont) {
      if (!neg) { warn.push('The hand-off has no negative-moment factors (LL & DL was set up with one span?). The pier factors are left unchanged.');
        for (let k = 0; k < ns - 1; k++) rows.push({ lbl: `Pier ${k + 1}: g moment`, old: old(k, 'gM', true), nu: null, keep: 'unchanged' }); }
      else { const v = num(neg, 'gM', 'Moment factor (negative region)', true);
        for (let k = 0; k < ns - 1; k++) { if (v != null) pull.piers[k] = { gM: v }; rows.push({ lbl: `Pier ${k + 1}: g moment`, old: old(k, 'gM', true), nu: v, keep: 'unchanged' }); } }
    } else if (neg) unused.push('Negative-moment factors (this bridge has no continuous interior supports)');
    if (neg) unused.push('Negative-region shear and fatigue factors (this app uses the span factors for shear and fatigue)');
    unused.push('Factors of the other girders, design lanes, K_g and the per-member table (shown in LL & DL)');
    unused.push('The deflection distribution factor (not in the hand-off; from this app)');
    const basisLbl = `${basis === 'beam' ? `LL & DL beam ${j + 1}` : `LL & DL ${tKey} envelope`}, ${bySpan ? 'per span' : 'all-span envelope'}`;
    pull.source = { producer: String(pl.producer || 'LL & DL Distribution'), producerFile: String(pl.producerFile || 'lldf.html'), producedAt: String(pl.producedAt || ''), project: projOf(pl),
      line: j, girder: `G${j + 1}`, basis, basisLbl: `for G${j + 1}, ${basisLbl}` };
    return { err: [...new Set(err)], warn, rows, unused, j, ext, tKey, basis, bySpan: !!bySpan, basisLbl, pull };
  }
  /* lldfApply(P, gi, plan, now): writes girders[gi].dfPull (GirderDetail gdLldfApply); returns the girder */
  function lldfApply(P, gi, plan, now) {
    const g = P.girders[gi], u = JSON.parse(JSON.stringify(plan.pull));
    u.source.adoptedAt = now || new Date().toISOString();
    u.source.fields = plan.rows.filter(r => r.nu != null).map(r => r.lbl);
    g.dfPull = u; return g;
  }

  /* ---------- 3. superReactions ---------- */
  /* lines(P): for each cross-section girder j, the plate girder that is analyzed for it: { j, gi, P (the project to analyze), own } */
  function lines(P) {
    const nb = Math.round(P.xs.nb), out = [];
    for (let j = 0; j < nb; j++) {
      const gi = P.girders.findIndex(g => AN().lineOf(P, g) === j);
      if (gi >= 0) { out.push({ j, gi, P, own: true, label: P.girders[gi].label || P.girders[gi].id }); continue; }
      const pos = ext0(j, nb) ? 'exterior' : 'interior', src = P.girders.findIndex(g => (g.position || 'interior') === pos), si = src >= 0 ? src : 0;
      const Q = JSON.parse(JSON.stringify(P)), c = Q.girders[si]; c.line = j; c.position = pos; delete c.dfPull; delete c.loads; delete c.df;   // its own loads and factors (cross-section line j)
      Q.girders = [c]; out.push({ j, gi: 0, src: si, P: Q, own: false, samePos: src >= 0, label: P.girders[si].label || P.girders[si].id });
    }
    return out;
  }
  function ownerRulesData(P) {
    const O = OW(); if (!O) return null; const pr = P.ownerRules || {}, o = pr.owner || 'AASHTO', L = O.loadFactors(o, pr.eta, (P.xs || {}).nb), r4 = v => Math.round(v * 1e4) / 1e4;
    const ow = O.RULES.owners[L.o || o] || {}, row = id => O.rule(o, id), cit = r => r ? O.cite(r) : '';
    const rr = (o && o !== 'AASHTO') ? O.RULES.rules.find(r => r.owner === o && /^rate\./.test(r.id) && r.kind !== 'pending-reference') || null : null;
    const ec = [...new Set([L.cite && L.cite.D, L.cite && L.cite.R, L.cite && L.cite.I].filter(Boolean))].join('; ') || 'AASHTO LRFD 1.3.3 to 1.3.5';
    return { owner: L.o || o, manual: ow.manual || '', codeBasis: 'AASHTO LRFD 10th Ed. (2024) with the owner rules on top',
      llMultiplier: { m: L.m, cite: cit(row('ld.mult')), liveLoad: 'HL-93 LL+IM only; not the pedestrian load', limitStates: ['Strength I', 'Service I', 'Service II'], notApplied: ['live load deflection', 'fatigue', 'deck placement (constructibility)', 'load rating'] },
      eta: { D: L.eD, R: L.eR, I: L.eI, product: r4(L.eD * L.eR * L.eI), max: L.eta, min: L.etaN, cite: ec, limitStates: ['Strength'], rule: 'maximum Strength load factors x max; minimum factors x min (AASHTO LRFD 1.3.2.1)' },
      haunchInProperties: !L.h0, haunchCite: cit(row('ld.haunch0')),
      ratingTarget: rr ? { kind: rr.kind, rf: rr.value && +rr.value.rf > 0 ? +rr.value.rf : null, fatigue: rr.value && +rr.value.fat > 0 ? +rr.value.fat : null, cite: cit(rr), basis: 'HL-93 inventory design-load rating, AASHTO factors without m or eta' } : null, _L: L };
  }
  /* srPayload(P): GirderDetail gdSrPayload on this app's analysis. { ok, payload, sum } or { error } */
  function srPayload(P) {
    if (!AN()) return { error: 'The analysis module is not loaded.' };
    const nb = P.xs ? Math.round(P.xs.nb) : 0; if (!(nb > 0)) return { error: 'Define the cross-section (number of girders) first.' };
    // The HL-93 per-lane envelope (and the pedestrian influence areas) depend only on the spans and the plates (live-load stiffness), so a
    // cross-section girder that borrows a plate girder's plates takes them from that girder's full run, times its own g_V (the larger of the
    // adjacent spans, as engine/analysis.js llR) and its own w_PL; its dead loads come from its own run without live load (opt.ll = false).
    // The same values as a full run of that girder, without repeating the moving-load analysis (about 20 s per girder).
    const LN = lines(P), Rs = [], full = new Map();
    const run = (Q, gi, o) => { const R = AN().analyzeGirder(Q, gi, o); if (R.errors && R.errors.length) throw new Error(R.errors[0]); return R; };
    try {
      for (const q of LN) {
        if (q.own) { if (!full.has(q.gi)) full.set(q.gi, run(P, q.gi)); Rs.push(full.get(q.gi)); continue; }
        if (!full.has(q.src)) full.set(q.src, run(P, q.src));
        const D = full.get(q.src), R = run(q.P, 0, { ll: false }), ns0 = R.spans.length;
        if (D.llR) R.llR = D.llR.map((r, k) => { const adj = [k - 1, k].filter(i => i >= 0 && i < ns0), gV = Math.max(...adj.map(i => R.df.spans[i].gV)); return { k, gV, max: gV * r.perLane.max, min: gV * r.perLane.min, perLane: r.perLane, two: r.two }; });
        if (R.loads.PL > 0) { if (D.pl && D.loads.PL > 0) R.pl = { w: R.loads.PL, R: D.pl.R.map(r => ({ k: r.k, max: r.max / D.loads.PL * R.loads.PL, min: r.min / D.loads.PL * R.loads.PL })) };
          else R.pl = run(q.P, 0).pl; }
        Rs.push(R);
      }
    } catch (e) { return { error: e.message }; }
    const R0 = Rs[0], ns = R0.spans.length, lab = i => `G${i + 1}`;
    const sid = k => k === 0 ? 'Abut. 1' : k === ns ? 'Abut. 2' : `Pier ${k}`;
    const has = (R, k) => isNum(R.loads[k]) && R.loads[k] > 0;
    const supports = R0.sup.map((x, k) => ({ id: sid(k), x: r3(x),
      girders: Rs.map((R, i) => { const S = R.st; return { label: lab(i), position: ext0(i, nb) ? 'exterior' : 'interior', DC1: r3(S.DC1.R[k]), DC2: r3(S.DC2.R[k]), DW: r3(S.DW.R[k]),
        ...(has(R, 'UT') ? { UT: r3(S.UT ? S.UT.R[k] : 0) } : {}), ...(has(R, 'UF') ? { UF: r3(S.UF ? S.UF.R[k] : 0) } : {}) }; }) }));
    const per = (fn, gs) => R0.sup.map((_, k) => `${sid(k)}: ${(gs || Rs.map((_, i) => i)).map(i => `${lab(i)} ${fn(Rs[i], k)}`).join(', ')}`).join('; ');
    const hasPL = Rs.some(R => R.pl && R.pl.R && R.pl.R.some(q => q.max > 1e-9 || q.min < -1e-9));
    const gUT = Rs.map((_, i) => i).filter(i => has(Rs[i], 'UT')), gUF = Rs.map((_, i) => i).filter(i => has(Rs[i], 'UF'));
    const ORD = ownerRulesData(P), L = ORD ? ORD._L : { o: 'AASHTO', m: 1, eta: 1, etaN: 1, eD: 1, eR: 1, eI: 1, h0: false }; if (ORD) delete ORD._L;
    const lfId = L.m === 1 && L.eta === 1 && L.etaN === 1 && !L.h0;
    const S0 = AN().settings(P), model = 'staged, variable stiffness (steel / 3n / n)';
    const borrowed = LN.filter(q => !q.own).map(q => `G${q.j + 1} (plates of plate girder "${q.label}"${q.samePos ? '' : ', no plate girder of its position'})`);
    const notes = [
      `Whole bridge: every girder (G1 to G${nb}) from this app's analysis (Steel Bridge Design, apps/steel-bridge, engine/analysis.js), ${model} line-girder model${R0.cont ? ', continuous' : ', simple spans'}, run once per girder with the same settings; each girder with its own loads and distribution factors (Loads & LLDF). Each girder is labelled by its number, left to right.${borrowed.length ? ` Girders without plates of their own take the plates of the first plate girder of the same position (else the first plate girder): ${borrowed.join(', ')}.` : ''}`,
      `Unfactored, kip, + up. DC1 = girder steel (490 pcf x (1 + ${f0(R0.loads.steelAllowPct)}% detail allowance)), cross-frames and diaphragms (point loads at the girder's frames), deck, haunch, SIP forms and other DC1 loads, on the steel section; DC2 and DW on the long-term composite section; each load on the stage that carries it.`,
      `Live load is not sent (liveLoad null): Substructure Loading computes its own. For information, this app's LL+IM reactions per girder (HL-93, IM ${f0(S0.im)}% on the truck and tandem, x the girder's shear distribution factor with the skew correction, the larger of the adjacent spans; 90% of two trucks plus lane at interior supports), max / min, kip: ${per((R, k) => R.llR ? `${f2(R.llR[k].max)} / ${f2(R.llR[k].min)}` : 'n/a')}.`,
      ...(hasPL ? [`Pedestrian load: no field in this hand-off, not sent as a load. This app's pedestrian load reactions, max / min, kip: ${per((R, k) => R.pl && R.pl.R ? `${f2(R.pl.R[k].max)} / ${f2(R.pl.R[k].min)}` : '0.00 / 0.00')}.`] : []),
      ...(gUT.length || gUF.length ? [`MassDOT utilities (OWN16; MassDOT LRFD Bridge Manual Part I 3.5.5.2, 3.5.5.4) are NOT in DC1, DC2 or DW; they are sent as their own fields girders[].UT (existing) and girders[].UF (future allowance), unfactored, on the girders that carry them (0 on the others). ${gUT.length ? `Existing utilities (UT; factored as DW: Strength 1.50 where they add, 0.65 where they relieve), kip: ${per((R, k) => f2(R.st.UT ? R.st.UT.R[k] : 0), gUT)}.` : 'No existing utilities.'} ${gUF.length ? `Future utility allowance (UF; Strength 1.25 where it adds, 0 where it relieves), kip: ${per((R, k) => f2(R.st.UF ? R.st.UF.R[k] : 0), gUF)}.` : 'No future utility allowance.'}`] : []),
      ...(P.girders.some(g => g.dfPull && g.dfPull.use !== false) ? ['Distribution factors pulled from LL & DL apply to their own plate girder only; only the LL+IM values in these notes depend on them.'] : []),
      ...(!R0.cont && ns > 1 ? ['Simple spans: the reaction at a pier is the sum of the end reactions of the two spans on it (one support point in this model); split it between the back and ahead bearing rows by hand where needed.'] : []),
      lfId ? `Owner load rules: ${L.o || 'AASHTO'}, none on the loads (m = 1, eta = 1).${ORD ? ' Sent in ownerRules.' : ''}` : `Owner load rules of ${L.o} are NOT in these unfactored reactions: ${[L.m !== 1 ? `design load multiplier m = ${L.m} on HL-93 LL+IM at the Strength and Service limit states (not on the pedestrian load)` : '', L.eta !== 1 || L.etaN !== 1 ? `load modifier eta = ${(L.eD * L.eR * L.eI).toFixed(3)} on the Strength load factors (max ${L.eta}, 1/eta = ${L.etaN} on the minimum factors)` : ''].filter(Boolean).join('; ') || 'none on the loads'}${L.h0 ? '; the analysis takes the haunch as 0 in the composite section properties (owner rule)' : ''}. They are sent in ownerRules for information; this app applies them to its own checks, Substructure Loading applies its own load factors.`];
    const pr = P.project || {};
    const payload = { _schema: SR.schema, schemaVersion: 1, producer: PRODUCER, producerFile: FILE,
      project: { name: String(pr.name || ''), bridgeId: '' }, units: { force: 'kip', length: 'ft' }, factored: false, imIncluded: false, dfIncluded: false, perGirder: true,
      allGirders: true, span: { index: null, length: r3(R0.Lt) }, supports, liveLoad: null, notes, ...(ORD ? { ownerRules: ORD } : {}),
      ...(gUT.length || gUF.length ? { utilities: { cite: 'MassDOT LRFD Bridge Manual Part I 3.5.5.2, 3.5.5.4 (OWN16)', section: 'noncomposite (steel)',
        existing: gUT.length ? { field: 'UT', treatAs: 'DW', strMax: 1.50, strMin: 0.65, service: 1.0 } : null,
        future: gUF.length ? { field: 'UF', treatAs: 'DC', strMax: 1.25, strMin: 0, service: 1.0, serviceRelieving: 0 } : null } } : {}) };
    return { ok: true, payload, sum: supports.map(s => `  ${s.id} (x = ${f2(s.x)} ft): ${s.girders.map(g => `${g.label} ${f2(g.DC1)} / ${f2(g.DC2)} / ${f2(g.DW)}${g.UT != null || g.UF != null ? ` (UT ${f2(g.UT || 0)}, UF ${f2(g.UF || 0)})` : ''}`).join(', ')}`).join('\n') };
  }

  window.SBDHandoffs = { PRODUCER, FILE, RX, LLDF, SR, PM, pmFields, pmPayload, pmPlan, lldfPlan, lldfApply, lines, ownerRulesData, srPayload };

  /* ---------- UI: one card on the Project tab ---------- */
  let ctx = null;   // { getP, changed, ui }: set by init (index.html)
  const isNew = () => { try { return !!(BX() && BX().isNew(LLDF.ch, RX)); } catch (e) { return false; } };
  function card(P, ui) {
    const g = P.girders[(ui && ui.g) || 0] || P.girders[0], u = g && g.dfPull, nb = P.xs ? Math.round(P.xs.nb) : 0, j = g && AN() ? AN().lineOf(P, g) : 0;
    const src = u ? `<p class="note"><b>Distribution factors of ${esc(g.label || g.id)}:</b> ${u.use === false ? '<b>not in use</b> (' : ''}pulled from ${esc(u.source.producer)} (${esc(u.source.producerFile)}), produced ${esc(when(u.source.producedAt))}${u.source.project ? `, project "${esc(u.source.project)}"` : ''}; pulled ${esc(when(u.source.adoptedAt))}, ${esc(u.source.basisLbl)}${u.use === false ? ')' : ''}.${u.source.line !== j ? ` <b>Check:</b> this plate girder now takes cross-section girder G${j + 1}; the factors were pulled for ${esc(u.source.girder)}. Pull again.` : ''} Worked in the <a href="#" data-ho="goAn">Analysis tab</a> (Live load distribution factors).</p>` : '';
    return `<section class="sec" id="sbdHo"><div class="secHead">Other tools (hand-offs)</div><div class="secBody">
      <div class="fRow"><button type="button" data-ho="pmUse">Use shared project info</button> <button type="button" data-ho="pmShare">Share project info</button></div>
      <p class="note">Shared project info (bridgeSuite.v1.projectMeta): project name, number, client, designer, checker and date with the other tools.</p>
      <div class="fRow"><button type="button" data-ho="lldfPull">Pull from LL &amp; DL <span class="badge"${isNew() ? '' : ' hidden'} data-ho-new>new data</span></button> <button type="button" data-ho="lldfFile">Import hand-off (JSON)</button>${u ? ` <button type="button" data-ho="lldfDrop">Stop using pulled factors</button>` : ''}<input type="file" data-ho="lldfInput" accept=".json,application/json" hidden></div>
      <p class="note">Fills the live load distribution factors of the plate girder selected on the Girders &amp; plates tab (${esc(g ? g.label || g.id : '')}, cross-section girder G${j + 1} of ${nb}) from those LL &amp; DL Distribution (lldf.html) publishes. You see what changes and confirm first.</p>${src}
      <div class="fRow"><button type="button" data-ho="srSend">Send reactions to Substructure Loading</button> <button type="button" data-ho="srFile">Export hand-off (JSON)</button></div>
      <p class="note">Runs this app's analysis for every girder (G1 to G${nb}) and sends each girder's unfactored DC1, DC2 and DW reactions at every support (kip; the Analysis tab's reactions) to Bridge Substructure Loading (Reactions tab, Pull from PS-Beam / GirderDetail). The MassDOT utilities go as their own values, the LL+IM and pedestrian reactions in the notes, and the owner's load rules for information. Opened as files, both tools must be in one folder and opened in Chrome or Edge; otherwise use Export hand-off (JSON) and Substructure Loading's Import hand-off (JSON).</p>
    </div></section>`;
  }
  let dlg = null, pend = null;
  function dialog(html) {
    if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'sbdHoDlg'; dlg.style.maxWidth = 'min(760px, 96vw)'; document.body.appendChild(dlg);
      dlg.addEventListener('click', e => { const b = e.target.closest('[data-hod]'); if (!b) return; if (b.dataset.hod === 'cancel') { pend = null; dlg.close(); } else if (b.dataset.hod === 'apply') applyPend(); });
      dlg.addEventListener('change', e => { if (e.target.name === 'hoBasis' && pend) { pend.basis = e.target.value; showLldf(); } }); }
    dlg.innerHTML = html; if (!dlg.open) { try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); } }
  }
  function showLldf() {
    const P = ctx.getP(), gi = ctx.ui().g || 0, pl = pend.pl, plan = lldfPlan(P, gi, pl, pend.basis), notes = [].concat(Array.isArray(pl.notes) ? pl.notes : [], pl.note ? [pl.note] : []);
    const sameNb = Number(pl.Nb) === Math.round(P.xs.nb), li = a => a.length ? `<ul>${a.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : '', g = P.girders[gi];
    pend.plan = plan;
    dialog(`<h3>Pull from LL &amp; DL Distribution</h3>
      <p><b>From:</b> ${esc(pl.producer || 'LL & DL Distribution')} (${esc(pl.producerFile || 'lldf.html')}), produced ${esc(when(pl.producedAt))}${projOf(pl) ? `, project "${esc(projOf(pl))}"` : ''}; via ${esc(pend.via)}.</p>
      <p><b>For:</b> ${esc(g.label || g.id)}, cross-section girder G${plan.j != null ? plan.j + 1 : '?'}${plan.j != null ? ` (${plan.ext ? 'exterior' : 'interior'})` : ''}, the plate girder selected on the Girders &amp; plates tab.</p>
      <fieldset style="border:0;padding:0;margin:6px 0"><legend><b>Which LL &amp; DL factors to use</b></legend>
        <label style="display:block"><input type="radio" name="hoBasis" value="type"${pend.basis === 'type' ? ' checked' : ''}> Envelope of LL &amp; DL's ${plan.tKey || 'interior / exterior'} girders (default; does not depend on the girder numbering)</label>
        <label style="display:block"><input type="radio" name="hoBasis" value="beam"${pend.basis === 'beam' ? ' checked' : ''}${sameNb ? '' : ' disabled'}> LL &amp; DL's beam with the same number${sameNb ? '' : ' (needs the same number of girders)'}</label></fieldset>
      <p class="note">Basis: lanes per girder; LL &amp; DL includes multiple presence and the skew corrections; the fatigue factors are the one-lane factor ÷ 1.2. ${plan.bySpan ? 'Each span gets LL &amp; DL\'s factors for that span (positive moment and shear, L = span); every pier gets LL &amp; DL\'s envelope over all interior supports (negative moment).' : 'This payload has no per-span factors, so every span gets LL &amp; DL\'s envelope over all spans (positive moment and shear), and every pier its envelope over all interior supports (negative moment).'} The pulled factors replace this girder's factors from the Loads &amp; LLDF tab until you click Stop using pulled factors.</p>
      ${plan.err.length ? `<div class="err"><b>Cannot pull:</b>${li(plan.err)}</div>` : ''}${plan.warn.length ? `<div class="warn"><b>Check:</b>${li(plan.warn)}</div>` : ''}
      ${plan.rows.length ? `<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Factor</th><th>Now in use</th><th>After pull</th></tr></thead><tbody>${plan.rows.map(r => `<tr><td>${esc(r.lbl)}</td><td>${r.old == null ? '—' : f3(r.old)}</td><td>${r.nu == null ? esc(r.keep) : `<b>${f3(r.nu)}</b>`}</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${plan.unused.length ? `<p class="note"><b>Not used:</b> ${plan.unused.map(esc).join('; ')}.</p>` : ''}${notes.length ? `<p class="note"><b>Notes from LL &amp; DL:</b> ${notes.map(esc).join(' ')}</p>` : ''}
      <div class="fRow"><button type="button" data-hod="apply"${plan.err.length ? ' disabled' : ''}>Apply these factors</button> <button type="button" data-hod="cancel">Cancel</button></div>`);
  }
  function applyPend() {
    if (!pend || !pend.plan || pend.plan.err.length) return; const P = ctx.getP(), gi = ctx.ui().g || 0, pl = pend.pl;
    lldfApply(P, gi, pend.plan); try { BX().markAdopted(LLDF.ch, RX, pl.producedAt); } catch (e) { /* marker only */ }
    pend = null; dlg.close(); ctx.changed(true);
  }
  function onClick(e, P, ui) {
    const b = e.target.closest && e.target.closest('[data-ho]'); if (!b || b.tagName === 'INPUT') return false; const a = b.dataset.ho;
    if (a === 'goAn') { e.preventDefault(); const t = document.querySelector('#tabBar [data-otab="an"]'); if (t) t.click(); return false; }   // link to the worked factors (CLAUDE.md §6)
    if (!BX()) { alert('The hand-off helper is not available in this browser.'); return false; }
    if (a === 'pmShare') { const r = BX().publish('projectMeta', pmPayload(P), PRODUCER, FILE); alert(r.error ? 'Could not share project info: ' + r.error : 'Project info shared. Other tools can load it with "Use shared project info".'); return false; }
    if (a === 'pmUse') { const r = BX().read('projectMeta', 'bridge-project-meta', 1);
      if (r.error) { alert(r.empty ? 'No shared project info yet. Click "Share project info" in a tool that has the project filled in.' : 'Cannot use shared project info: ' + r.error); return false; }
      const todo = pmPlan(P, r.payload), from = 'From: ' + BX().describe(r.payload);
      if (!todo.length) { alert('Shared project info has nothing new for this tool.\n\n' + from); return false; }
      if (!confirm('Use shared project info?\n\n' + from + '\n\nThis will overwrite:\n' + todo.map(t => `  ${PM_LBL[t.k]}: "${t.old}" -> "${t.nu}"`).join('\n') + '\n\nBlank shared fields are left unchanged.')) return false;
      todo.forEach(t => { P.project[t.path] = t.nu; }); return true; }
    if (a === 'lldfPull') { const r = BX().read(LLDF.ch, LLDF.schema, LLDF.ver);
      if (r.error) { alert(r.empty ? 'Nothing has been published yet. In LL & DL Distribution (lldf.html) click "Send DFs to Design Apps", or use "Import hand-off (JSON)".' : `Cannot use the LL & DL hand-off: ${r.error}`); return false; }
      pend = { pl: r.payload, via: 'shared browser storage', basis: 'type' }; showLldf(); return false; }
    if (a === 'lldfFile') { const f = b.parentNode.querySelector('[data-ho="lldfInput"]'); if (f) { f.value = ''; f.onchange = () => { const file = f.files && f.files[0]; if (!file) return;
      BX().importFile(file, LLDF.schema, LLDF.ver, r => { if (r.error) { alert(`Cannot import the hand-off file: ${r.error}`); return; } pend = { pl: r.payload, via: `file ${file.name}`, basis: 'type' }; showLldf(); }); }; f.click(); } return false; }
    if (a === 'lldfDrop') { const g = P.girders[ui.g || 0]; if (!g || !g.dfPull) return false; if (!confirm(`Stop using the factors pulled from LL & DL for ${g.label || g.id}? Its factors come from the Loads & LLDF tab again (Undo restores them).`)) return false; delete g.dfPull; return true; }
    if (a === 'srSend' || a === 'srFile') { const r = srPayload(P); if (r.error) { alert(`Analysis: ${r.error}`); return false; }
      if (a === 'srFile') { BX().exportFile(SR.ch, r.payload); return false; }
      const w = BX().publish(SR.ch, r.payload, PRODUCER, FILE);
      if (w.error) { alert(`Could not send the reactions: ${w.error}\n\nUse "Export hand-off (JSON)" and Substructure Loading's Import hand-off (JSON) instead.`); return false; }
      try { localStorage.setItem(BX().NS + SR.ch + '.by.' + SR.id, JSON.stringify(w.payload)); } catch (er) { /* the channel key has it */ }   // per-producer copy (§4.4)
      alert(`Reactions sent to Substructure Loading (unfactored, kip, DC1 / DC2 / DW per girder):\n\n${r.sum}\n\nIn Bridge Substructure Loading, Reactions tab, click "Pull from PS-Beam / GirderDetail".`); return false; }
    return false;
  }
  function init(o) { ctx = o; window.addEventListener('storage', e => { if (!e.key || e.key.indexOf(BX().NS + LLDF.ch) === 0) document.querySelectorAll('[data-ho-new]').forEach(s => { s.hidden = !isNew(); }); }); }
  window.SBDHandoffUI = { card, onClick, init };
})();
