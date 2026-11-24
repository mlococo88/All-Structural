/* apps/steel-bridge/report/builders.js — the calculation report model of Steel Bridge Design (window.SBDReportBuild). Classic script,
   no DOM. Created 2026-10-30 (Report tab). Turns the results of report/data.js (each module's own result, unchanged) into the report
   model of shared/report.js: sections in the workflow order, each value worked (the module's own SharedSteps steps) or linked to the
   step that works it ("see §x.y"). Nothing is calculated here; ratios and values are those the modules return.

   model(bundle, opt) -> report model; opt = { detail: 'gov' (the governing location of each check group, default) | 'all' (every
   station, worked steps opened on demand), include: { key: false } to leave a section out (default all) }.
   RPX (2026-11-23; engineer 2026-11-23: the Report extras of the Prestressed Bridge app), display only:
     opt.figures = { <section key>: [{ caption, svg }] } (ui/report.js figures(): each output tab's own graphics, drawn by the tab's own code
       from the module results of the bundle; none in Node): a last subsection "Graphics of the … tab" in that section;
     opt.snap3d = { png (a data URL), at, meta, stale } (the 3D view tab's "Capture for the Report"): a last subsection of Project and owner;
     every figure with a caption is numbered "Figure n.m" (section n; numberFigs), the verdict banner and the seal box aside (plain);
     model.refs: the References of the front matter (shared/report.js), the articles the worked steps of this report cite (refsOf).
   Section keys (SECTIONS, in the workflow order; the summary is put first):
     sum   Summary of governing ratios (links to each check)     proj  Project and owner        loads Cross-section, loads and LLDF
     an    Analysis                                               defl  Deflection (added 2026-11-09, DEFL: the LL deflection check and the
                                                                        dead-load deflections and camber, moved from Analysis; the Deflection tab)
     sec   Section properties                                     flex  Flexure
     shear Shear and stiffeners                                   fat   Fatigue and studs        cn    Constructibility (deck placement)
     frm   Framing and cross-frames                               spl   Field splices            wd    Welds (added 2026-10-30)
     rt    Load rating
   Step anchors: key = scope + '/' + step id (shared/report.js); scope '' for the lists that appear once (loads, analysis, framing,
   owner rules), else one scope per location ('flex@12', 'sh.st@3', 'spl@0', …). */
(function () {
  'use strict';
  const U = () => window.SharedUnits, f = (x, d) => U().fmt(x, d);
  const SECTIONS = [['exec', 'Executive summary'], ['basis', 'Basis of design'], ['sum', 'Summary'], ['proj', 'Project & owner'], ['loads', 'Cross-section & loads'], ['an', 'Analysis'], ['defl', 'Deflection'], ['sec', 'Section properties'], ['flex', 'Flexure'],
    ['shear', 'Shear & stiffeners'], ['fat', 'Fatigue & studs'], ['cn', 'Constructibility'], ['frm', 'Framing & cross-frames'], ['spl', 'Splices'], ['wd', 'Welds'], ['rt', 'Rating'], ['bom', 'Steel bill of materials'], ['sign', 'Sign-off & revisions']];   // exec, basis, bom, sign: PR3 (2026-11-19)
  const K = (scope, id) => (scope ? scope + '/' + id : String(id));
  const rc = r => !isFinite(r) ? '' : r > 1 + 1e-9 ? 'ng' : r >= 0.9 ? 'hi' : 'ok';
  const okT = r => !isFinite(r) ? '—' : r > 1 + 1e-9 ? 'NG' : 'OK';
  const R3 = (r, key) => ({ t: isFinite(r) ? f(r, 3) : '—', cls: rc(r), n: true, key });
  const N = (x, d) => ({ t: f(x, d), n: true });
  /* engine titles write subscripts as f_bu, D_{cp}: set them as notation */
  const tt = t => String(t == null ? '' : t).replace(/_\{?([A-Za-z0-9ℓ]+(?:,[A-Za-z0-9ℓ]+)*)\}?/g, (m, a) => `\${}_{${a}}$`);   // as the tabs' tt(): every _x a subscript (QAO: ℓ too, f_ℓ; QA2: a comma after it is not in it, "P_fy, inner")
  /* QAO (2026-11-09): a location's name and station without saying the station twice (an analysis location is named "x = 249.99 ft") */
  const at = (r, d) => r.x == null || /x = /.test(r.name) ? r.name : `${r.name}, x = ${f(r.x, d)} ft`;
  /* a tab's own description (HTML with <sub>, <b>, entities) as report text */
  const fromHtml = h => String(h == null ? '' : h).replace(/<sub>(.*?)<\/sub>/g, (m, a) => `$_{${a.replace(/<[^>]+>/g, '')}}$`).replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const steps = (scope, list, o) => ({ type: 'steps', scope, steps: list || [], ...(o || {}) });
  /* gsteps: worked steps in topics (presentation spec A; trial on Shear & stiffeners, 2026-10-31; every output tab since): kind = 'UiName:kind' (the tab's UI file, groups(kind, list)) or, bare, a Shear & stiffeners kind. The topics of the tab (SBDShearUI.groups,
     SharedSteps.group), the steps in topic order with a sub-heading per topic (shared/report.js item.topics); ids and keys unchanged */
  const gsteps = (kind, scope, list, o) => { const [ui, k] = /:/.test(kind) ? kind.split(':') : ['SBDShearUI', kind], U = window[ui], G = U && U.groups ? U.groups(k, list || []) : null; if (!G) return steps(scope, list, o);
    return steps(scope, [].concat(...G.map(t => t.steps)), { ...(o || {}), topics: G.map(t => ({ title: t.title, ref: t.ref, n: t.steps.length, cls: t.cls, chip: t.chip, res: t.res })) }); };
  const note = (text, warn) => ({ type: 'note', text, warn: !!warn });
  const tbl = (head, rows, o) => ({ type: 'table', head, rows, ...(o || {}) });
  const kv = rows => ({ type: 'kv', rows });
  const sub = (id, title, items) => ({ id, title, items: items.filter(Boolean) });
  const ED = 'AASHTO LRFD 10th Ed. (2024)';
  const spanOf = (sup, x) => { if (!sup || sup.length < 2 || x == null) return 1; let k = 0; while (k < sup.length - 2 && x > sup[k + 1] + 1e-9) k++; return k + 1; };
  const gName = g => g ? g.label || g.id : '';
  /* f_ℓ of a module and where it comes from (engine/framing.js design: entered, else from skew, C6.10.1; paths PR 2026-10-30); the skew
     value links to its step in the Framing section when that section works the same value */
  const flNote = (B, D, tab) => !D ? '' : D.flSrc === 'entered' ? `$f_{\\ell}$ = ${f(D.fl, 2)} ksi as entered on the ${tab}`
    : `$f_{\\ell}$ from skew (C6.10.1, p. 6-160, in lieu of a refined analysis): ${window.SBDFraming.flWhy(D.flS)}${/cn\|/.test(tab) ? (D.flS.f0 > 0 ? `; deck placement $\\gamma f_{\\ell,skew}$ = ${(D.flS.steps.find(t => t.id === 'fl') || {}).sub || ''} = ${f(D.fl, 2)} ksi (the largest on the girder, as DC)` : '')
      : '; Strength I and Service II split $f_{\\ell,skew}$ between dead and live load at each location with their own load factors (worked steps fx.flp.S, fx.flp.V of each location)'}${B.frm && B.frm.fl && B.frm.fl.fl === D.fl && B.frm.fl.skMax === D.flS.skMax ? ' [[flsk.fl]]' : ''}`;
  const brNote = Gr => Gr.frB ? `the brace points of the Framing & bracing tab (G${Gr.frB.line + 1}'s bearings and cross-frames)` : 'the cross-frame stations of the stiffener layout (the project has no framing)';

  /* ---------- RPX (2026-11-23): figure numbers, the tabs' graphics, the 3D capture, the References (display only) ---------- */
  /* numberFigs(secs): "Figure n.m: caption" for every figure with a caption in section n (in the order printed); a figure marked plain
     (the verdict banner, the seal box) keeps its caption. The items are the builders' own objects of this build (figSub copies the tabs'). */
  function numberFigs(secs) {
    secs.forEach((sc, i) => { let m = 0; (sc.subs || []).forEach(q => (q.items || []).forEach(it => { if (it && it.type === 'figure' && it.caption && !it.plain && !it.no) { m++; it.no = `${i + 1}.${m}`; it.caption = `Figure ${it.no}: ${it.caption}`; } })); });
    return secs;
  }
  /* figSub(k, label, figs): the tab's own graphics (opt.figures[k]) as the last subsection of its section; null when none */
  const FIG_TAB = { sec: ['sec', 'Section properties'], loads: ['loads', 'Loads & LLDF'], an: ['an', 'Analysis'], flex: ['flex', 'Flexure'], shear: ['shear', 'Shear & stiffeners'], fat: ['fat', 'Fatigue & studs'], cn: ['cn', 'Constructibility'],
    frm: ['cf', 'Cross-frames'], wd: ['wt', 'Welds'], rt: ['rt', 'Rating'] };
  function figSub(k, figs) {
    const T = FIG_TAB[k], L = (figs || []).filter(q => q && q.svg); if (!T || !L.length) return null;
    return sub('fg', `Graphics of the ${T[1]} tab`, [note(`The graphics of the [[tab:${T[0]}|${T[1]} tab]], drawn from the results this section works (display only: each value drawn is one of this section's tables or worked steps). Where the tab has a selection, the graphic shows the tab's default (the governing location).`),
      ...L.map(q => ({ type: 'figure', svg: q.svg, caption: q.caption || '' }))]);
  }
  /* snapSub(X): the 3D view captured on the 3D view tab ("Capture for the Report"; ui/view3d.js snapshot, this page view only) */
  function snapSub(X) {
    const q = X.snap3d; if (!q || !/^data:image\/png;base64,/.test(String(q.png || ''))) return null;
    return sub('v3', '3D view (captured)', [{ type: 'figure', caption: `3D view (captured on the 3D view tab, ${q.at || ''}): ${q.meta || ''}`, svg: `<img src="${q.png}" alt="3D view of the bridge" style="width:100%;max-width:7.3in;height:auto;display:block">` },
      note(q.stale ? 'Captured before the last input change: capture again on the [[tab:3d|3D view tab]] for the inputs this report works.' : 'Display only: the bridge as drawn on the [[tab:3d|3D view tab]] when it was captured (the view, the layers and the diagram chosen there).', !!q.stale)]);
  }
  /* refsOf(secs, P): the References table: the articles cited by the worked steps written in this report (each step's ref; the article
     numbers only, equation / table suffixes -n and page notes dropped), per source; the other sources named by a step; the owner's manual */
  const artKey = a => a.replace(/^C/, '').split('.').map(q => { const m = /^([A-D]?)(\d+)([A-Za-z]*)$/.exec(q); return m ? [m[1] ? 1000 + m[1].charCodeAt(0) : 0, +m[2], m[3]] : [0, 0, q]; });
  const artCmp = (a, b) => { const x = artKey(a), y = artKey(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { if (!x[i]) return -1; if (!y[i]) return 1; for (let j = 0; j < 3; j++) if (x[i][j] !== y[i][j]) return x[i][j] < y[i][j] ? -1 : 1; } return a < b ? -1 : a > b ? 1 : 0; };
  function citedRefs(secs) {
    const lrfd = new Set(), mbe = new Set(), other = new Set();
    const arts = (t, set) => { const re = /(?:^|[\s,(])(C?(?:[A-D]?\d+[A-D]?)(?:\.\d+[a-z]?)+)(?:-\d+)?/g; let m; while ((m = re.exec(t))) set.add(m[1]); };
    secs.forEach(sc => (sc.subs || []).forEach(q => (q.items || []).forEach(it => { if (!it || it.type !== 'steps') return; (it.steps || []).forEach(st => {
      let cur = null;
      String(st.ref || '').split(';').forEach(part => { const t = part.replace(/\([^)]*\)/g, ' ').trim(); if (!t) return;
        if (/AASHTO LRFD/.test(t)) cur = 'lrfd'; else if (/\bMBE\b/.test(t)) cur = 'mbe'; else if (!/^(Art|Arts|Eq|Eqs|Table|Tables|App|Fig|C?\d|[A-D]\d)/.test(t)) cur = 'other';
        if (cur === 'lrfd') arts(t.replace(/AASHTO LRFD( 10th Ed\.?)?/, ' ').replace(/\b(Arts?|Eqs?|Tables?|App|Fig)\.?/g, ' '), lrfd);
        else if (cur === 'mbe') arts(t.replace(/(AASHTO )?MBE( 4th Ed\.?)?/, ' ').replace(/\b(Arts?|Eqs?|Tables?|App|Fig)\.?/g, ' '), mbe);
        else if (cur === 'other' && !/^Statics$/.test(t)) other.add(part.trim()); }); }); })));
    return { lrfd: [...lrfd].sort(artCmp), mbe: [...mbe].sort(artCmp), other: [...other].sort() };
  }
  function refsOf(secs, P) {
    const c = citedRefs(secs), OW = window.SBDOwners, o = ((P || {}).ownerRules || {}).owner, ow = o && o !== 'AASHTO' && OW && OW.RULES && OW.RULES.owners ? OW.RULES.owners[o] : null;
    return [['AASHTO LRFD', `AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024). Articles cited in the worked steps of this report${c.lrfd.length ? ': ' + c.lrfd.join('; ') : ': none (no worked step in the sections chosen)'} (each step names its article, equation or table).`],
      ...(c.mbe.length ? [['MBE', `AASHTO Manual for Bridge Evaluation, 4th Ed. (2026), Section 6 Part A (LRFR). Articles cited: ${c.mbe.join('; ')}.`]] : []),
      ...(ow && ow.manual ? [[o, `${ow.manual} (the owner rules chosen on the Project tab; each rule applied is cited where it is worked).`]] : []),
      ...(c.other.length ? [['Other', `Also named by a worked step: ${c.other.join('; ')}.`]] : [])];
  }

  /* ---------- 2. project and owner ---------- */
  function proj(B, X) {
    const P = B.P, p = P.project || {}, g = B.girder, M = window.SBDModel, G = M.GRADES, m = P.materials, d = P.deck, AN = window.SBDAnalysis;
    const lf = B.loads && B.loads.lf ? B.loads.lf : window.SBDOwners.loadFactors(P.ownerRules.owner, P.ownerRules.eta, (P.xs || {}).nb);
    const line = AN ? AN.lineOf(P, g) : 0;
    return { title: 'Project and owner', subs: [
      sub('p', 'Project', [kv([['Project', p.name || '—'], ['Project No', p.number || '—'], ['Client / owner', window.SBDModel.clientName(P) || '—'], ['Computed by', p.designer || '—'], ['Checked by', p.checker || '—'], ['Date', p.date || '—']]),
        p.notes ? note(p.notes) : null,
        window.SBDInputCheck ? note(window.SBDInputCheck.NOTE) : null,   // SBINV (engineer rule 2026-11-10: decisions noted in the app and the report)
        kv([['Spans', `${P.spans.lengths.map(L => f(+L, 2)).join(' + ')} ft (${P.spans.continuity === 'simple' || P.spans.lengths.length < 2 ? 'simple spans' : 'continuous'})`],
          ['Girder reported', `${gName(g)}, ${g.position}; cross-section girder G${line + 1} (dead loads and distribution factors)`], ['$b_{eff}$', `${f(g.beff, 2)} in`],
          ['Design specification', ED], ['Demands', B.src === 'file' ? `hand-off file ${B.plName || ''} (GirderDetail → ST-Girder), where a module takes it (see each section)` : B.custom ? `entered on the tab (Custom) for ${cdMods(B)} (see each section); this project's analysis (Analysis tab) for the rest` : "this project's analysis (Analysis tab)"]])]),
      sub('m', 'Materials and deck', [kv([['Steel, top / bottom flange, web', `${m.steel.top} / ${m.steel.bot} / ${m.steel.web} ($F_{y}$ = ${G[m.steel.top].Fy} / ${G[m.steel.bot].Fy} / ${G[m.steel.web].Fy} ksi)`], ['$E_{s}$', `${f(m.Es, 0)} ksi`],
        ["$f'_{c}$, $w_{c}$, $K_{1}$", `${f(m.concrete.fc, 2)} ksi, ${f(m.concrete.wc, 3)} kcf, ${f(m.concrete.K1, 2)}`], ['Deck', `${d.composite === false ? 'noncomposite' : 'composite'}; $t_{s}$ = ${f(d.ts, 2)} in, total ${f(d.tdeck, 2)} in, haunch ${f(d.haunch, 2)} in`],
        ['Deck rebar', `top ${f(d.rebar.top.A, 2)} in² at ${f(d.rebar.top.c, 2)} in, bottom ${f(d.rebar.bot.A, 2)} in² at ${f(d.rebar.bot.c, 2)} in; $F_{yr}$ = ${f(m.rebar.Fyr, 0)} ksi`]])]),
      sub('g', `Plate segments, ${gName(g)}`, [tbl(['Segment', '$x_{0}$ (ft)', '$x_{1}$ (ft)', 'D (in)', '$t_{w}$ (in)', '$b_{t}$ (in)', '$t_{t}$ (in)', '$b_{b}$ (in)', '$t_{b}$ (in)'].concat(g.segments.some(rlNm) ? ['Section'] : []),
        g.segments.map((s, i) => [String(i + 1), N(s.x0, 2), N(s.x1, 2), N(s.D, 3), N(s.tw, 4), N(s.topB, 3), N(s.topT, 4), N(s.botB, 3), N(s.botT, 4)].concat(g.segments.some(rlNm) ? [rlNm(s) || 'plate girder'] : []))),
        // ROLL (2026-11-23): a rolled segment is named; its plate sizes are the shape's equivalent three plates (a report without one is unchanged)
        g.segments.some(rlNm) ? note(`Rolled shapes (${window.SharedAiscW.VERSION}): ${[...new Set(g.segments.map(rlNm).filter(Boolean))].join(', ')}. Each is checked as its equivalent three plates, flanges b_f × t_f and web D = d − 2 t_f by t_w (the fillets left out; t_f reduced where needed so that A, I_x, S_x and Z_x do not exceed the tabulated values), listed above; the girder weight is the tabulated lb/ft. The tabulated values and the three-plate values are worked in Section properties (§5). One steel grade; no flange-to-web welds; cover plates are not modelled.`) : null]),
      sub('o', 'Owner load rules', [kv([['Owner', lf.o || 'AASHTO'], ['η (maximum Strength factors)', f(lf.eta, 3), 'own.eta'], ['η (minimum Strength factors)', f(lf.etaN, 3), 'own.etaN'],
        ['Design load multiplier m', f(lf.m, 2), 'own.m'], ['Haunch in section properties', lf.h0 ? '0 (owner rule)' : 'as entered', 'own.h0']]), steps('', lf.steps || [])])] };
  }

  /* ---------- 3. cross-section, loads, LLDF ---------- */
  function loads(B, X) {
    const R = B.loads, P = B.P, LD = window.SBDLoads, AN = window.SBDAnalysis, line = AN ? AN.lineOf(P, B.girder) : 0, all = X.detail === 'all', D = R.dead;
    const gs = all ? [...Array(D.N).keys()] : [Math.min(line, D.N - 1)];
    const dead = D.steps.filter(s => { const m = /^dl\.G(\d+)\./.exec(s.id); return !m || gs.includes(+m[1] - 1); });
    const regSteps = [];
    R.regions.forEach(rg => { regSteps.push(...rg.steps); gs.forEach(j => { if (rg.members[j]) regSteps.push(...rg.members[j].steps); }); });
    const geo = R.regions[0].geo;
    const eq = P.xs && P.xs.spMode === 'equal' ? window.SBDModel.equalSpacing(P.xs) : null;   // EQSP (2026-11-09): girders equally spaced from the exterior girder spacing
    return { title: 'Cross-section, loads and live-load distribution', note: `Cross-section girder G${line + 1} carries the reported girder ${gName(B.girder)}${all ? '; every girder of the cross-section is worked' : ''}. As on the [[tab:loads|Loads & LLDF tab]].`, subs: [
      ...(eq ? [sub('sp', 'Girder spacing (girders equally spaced)', [kv([['Number of girders $N_{b}$', String(eq.nb)], ['Exterior girder spacing $W_{cc}$ (℄ to ℄ of the exterior girders)', `${f(eq.Wcc, 3)} ft`],
        ['Overhangs left / right', `${f(+P.xs.ohL, 2)} / ${f(+P.xs.ohR, 2)} ft`], ['Deck width out to out', `${f(+P.xs.ohL + eq.Wcc + +P.xs.ohR, 2)} ft`]]), steps('', [window.SharedSteps.step(eq.step)]),
        note('Every bay takes S; the dead loads and distribution factors below use these spacings.')])] : []),
      sub('d', `Dead loads per girder (klf), ${LD.METHODS[D.method] || D.method}`, [tbl(['Girder', 'Class', 'Deck', 'Haunch', 'SIP', 'DC1', 'DC2', 'DW'],
        gs.map(i => [`G${i + 1}`, LD.CLS[D.cls[i]] || D.cls[i], N(D.deck[i], 4), N(D.haunch[i], 4), N(D.sip[i], 4), { ...N(D.dc1[i], 4), key: `dl.G${i + 1}.DC1` }, { ...N(D.dc2[i], 4), key: `dl.G${i + 1}.DC2` }, { ...N(D.dw[i], 4), key: `dl.G${i + 1}.DW` }])),
        kv([[`Girder steel, ${R.girderLabel} (average)`, `${f(R.steel.avg, 4)} klf`, `dl.steel.${R.girderId}.avg`], ['Deck width', `${f(D.Wd, 2)} ft`], ['Live-load faces L / R', `${f(R.ll.L.r, 2)} / ${f(R.ll.R.r, 2)} ft`, 'xs.rL']]),
        // SBSW (2026-11-19; CLAUDE.md §6): haunch, SIP and DC1 with each plate segment's top flange, as the analysis takes them (A2; display only)
        ...(() => { const S = R.segDC1 || [], ls = gs.filter(i => (S[i] || []).some(r => !r.base)); if (!ls.length) return [];
          return [note(`Haunch and SIP forms with each plate segment's top flange (${R.girderLabel}'s plates): the table above takes $b_{f,0}$ = ${f(D.bf * 12, 2)} in (the first region's top flange); the analysis takes each segment's own width (wet deck stage, Analysis section). DC1 there:`),
            tbl(['Girder', '$b_{f}$ (in)', 'Segments x (ft)', 'Haunch', 'SIP', 'DC1'], ls.flatMap(i => S[i].map((r, k) => { const id = t => r.base ? `dl.G${i + 1}.${t}` : `dl.G${i + 1}.${t}.b${k}`;
              return [`G${i + 1}`, f(r.topB, 2), r.xr.map(([a, b]) => `${f(a, 2)}–${f(b, 2)}`).join(', '), { ...N(r.haunch, 4), key: id('haunch') }, { ...N(r.sip, 4), key: id('sip') }, { ...N(r.dc1, 4), key: id('DC1') }]; })))]; })(),
        note('DC1 here excludes the girder steel (per plate segment) and the cross-frames (point loads, Framing and cross-frames section); both are added in the analysis.')]),
      sub('df', 'Live-load distribution factors (lanes per girder)', [kv([['Design lanes $N_{L}$', String(geo.NL), 'df.geo.NL'], ['Roadway', `${f(geo.roadway, 2)} ft`, 'df.geo.w'], ['$d_{e}$ left / right', `${f(geo.deL, 2)} / ${f(geo.deR, 2)} ft`, 'df.geo.deL'],
        ['Deflection factor', f(R.regions[0].gDef, 4), `df.${R.regions[0].id}.gDef`]]),
        tbl(['Region', 'Girder', '$g_{M}$', '$g_{V}$', '$g_{fat,M}$', '$g_{fat,V}$', 'Method'], R.regions.flatMap(q => gs.filter(j => q.members[j]).map(j => { const m = q.members[j];
          return [q.label, `${m.label} (${m.type === 'ext' ? 'ext.' : 'int.'})`, { ...N(m.gM, 4), key: `df.${q.id}.G${j + 1}.gM` }, q.kind === 'span' ? N(m.gV, 4) : '—', N(m.fatM, 4), q.kind === 'span' ? N(m.fatV, 4) : '—', m.method]; }))),
        note('Span regions: positive moment and shear (L = span); pier regions: negative moment and interior reactions (L = average of the adjacent spans). Support skews enter as their size |θ| (the sign gives only the direction). Moment skew reduction judged per span: none in a span whose two support lines differ by more than 10°, and none in a pier region where either adjacent span\'s two support lines do (4.6.2.2.2e). Fatigue: one lane, multiple presence 1.2 removed (3.6.1.4.3b); the exterior girder\'s factor not less than the rigid cross-section value (4.6.2.2.2d).'),
        R.ranges.filter(q => !q.ok).length ? note(`Outside the range of applicability (Tables 4.6.2.2.2b-1, 4.6.2.2.3a-1, 4.6.2.2.2d-1): ${R.ranges.filter(q => !q.ok).map(q => `${q.region} ${q.name} = ${f(q.value, q.key === 'Kg' ? 0 : 2)}`).join('; ')}.`, true) : null]),
      ...(() => { const F = dfFigs(B); return F.length ? [sub('dfsk', 'Distribution factor sketches (wheel positions of each case)', F)] : []; })(),   // PR3 (2026-11-19)
      sub('w', 'Worked steps', [gsteps('SBDUiLoads:x', '', [...R.steps, ...dead, ...R.steel.steps, ...regSteps])])] };
  }

  /* ---------- 4. analysis ---------- */
  const COL = ['#1E3A5F', '#2563EB', '#059669', '#B45309', '#DC2626', '#7C3AED'];
  function chart(x, series, o) {   // a line chart as an SVG string (print-safe colours, no CSS variables)
    const W = 720, H = 220, l = 58, r = 10, t = 12, b = 30, X1 = x[x.length - 1] || 1;
    let lo = 0, hi = 0; series.forEach(s => s.y.forEach(v => { if (isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }));
    if (o.invert) { const a = lo; lo = -hi; hi = -a; } if (hi - lo < 1e-9) hi = lo + 1; const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
    const sx = v => l + v / X1 * (W - l - r), sy = v => t + (hi - (o.invert ? -v : v)) / (hi - lo) * (H - t - b);
    const tick = (a, c, n) => { const raw = (c - a) / n, p = 10 ** Math.floor(Math.log10(raw)), m = raw / p, s = (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p, out = []; for (let v = Math.ceil(a / s) * s; v <= c + 1e-9; v += s) out.push(+v.toFixed(10)); return out; };
    let g = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${o.title}" font-family="Arial, sans-serif" font-size="10">`;
    tick(lo, hi, 5).forEach(v => { const y = sy(o.invert ? -v : v); g += `<line x1="${l}" x2="${W - r}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#E4E7EB"/><text x="${l - 4}" y="${(y + 3).toFixed(1)}" text-anchor="end" fill="#333">${f(o.invert ? -v : v, Math.abs(v) < 10 ? 2 : 0)}</text>`; });
    (o.sup || []).forEach(v => { g += `<line x1="${sx(v).toFixed(1)}" x2="${sx(v).toFixed(1)}" y1="${t}" y2="${H - b}" stroke="#94A3B8" stroke-dasharray="3 3"/>`; });
    tick(0, X1, 8).forEach(v => { g += `<text x="${sx(v).toFixed(1)}" y="${H - b + 13}" text-anchor="middle" fill="#333">${f(v, 0)}</text>`; });
    g += `<line x1="${l}" x2="${W - r}" y1="${sy(0).toFixed(1)}" y2="${sy(0).toFixed(1)}" stroke="#000" stroke-width="0.8"/>`;
    series.forEach((s, k) => { g += `<polyline fill="none" stroke="${s.c || COL[k % COL.length]}" stroke-width="1.4"${s.dash ? ` stroke-dasharray="${s.dash}"` : ''} points="${s.y.map((v, i) => isFinite(v) ? `${sx(x[i]).toFixed(1)},${sy(v).toFixed(1)}` : null).filter(Boolean).join(' ')}"/>`; });
    (o.mark || []).forEach(m => { if (!m || !isFinite(m.x) || !isFinite(m.y)) return; const X = sx(m.x), Y = sy(m.y), rt = X > (l + W - r) / 2, ty = Math.min(H - b - 4, Math.max(t + 10, m.y >= 0 ? Y - 6 : Y + 13));   // SBFD (2026-11-19): o.mark (optional), the governing value
      g += `<circle cx="${X.toFixed(1)}" cy="${Y.toFixed(1)}" r="3" fill="#000"/><text x="${(X + (rt ? -6 : 6)).toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${rt ? 'end' : 'start'}" fill="#000" font-weight="bold">${m.t}</text>`; });
    let lx = l; series.forEach((s, k) => { g += `<line x1="${lx}" x2="${lx + 18}" y1="${H - 4}" y2="${H - 4}" stroke="${s.c || COL[k % COL.length]}" stroke-width="2"${s.dash ? ` stroke-dasharray="${s.dash}"` : ''}/><text x="${lx + 22}" y="${H - 1}" fill="#333">${s.name}</text>`; lx += 30 + s.name.length * 5.6; });
    return g + `<text x="12" y="${(t + H - b) / 2}" transform="rotate(-90 12 ${(t + H - b) / 2})" text-anchor="middle" fill="#333">${o.unit}</text></svg>`;
  }
  /* the construction live load basis (CLC, 2026-11-09), as the Loads input tab states it */
  /* lovNote(B) (SBLO, 2026-11-13; engineer decisions SB-7, SB-9, SB-10): the values entered for the reported line only (girders[g].lineOv), over
     the girder type's, as the Loads tab marks them; null when the line has none (every project saved before) */
  const lovNote = B => { const M = window.SBDModel, P = B.P, gi = B.g, g = P && P.girders && P.girders[gi]; if (!M || !M.lineOv || !g) return null; const j = window.SBDAnalysis ? window.SBDAnalysis.lineOf(P, g) : g.line, o = M.lineOv(P, gi, j); if (!o) return null;
    const nums = (k, L) => Object.keys(o[k] || {}).filter(q => typeof o[k][q] === 'number').map(q => `${L} ${q} = ${o[k][q]}`), b = k => typeof o[k] === 'boolean' ? [`${k === 'loadsOverride' ? 'dead-load' : k === 'dfOverride' ? 'distribution factor' : 'construction live load'} override ${o[k] ? 'on' : 'off'}`] : [];
    const it = [...nums('loadsManual', 'dead load (klf)'), ...nums('dfManual', 'factor'), ...b('loadsOverride'), ...b('dfOverride'), ...b('clOverride'), ...(o.dfPull ? ['the LL & DL factors pulled for this line'] : []), ...Object.keys(o.custom || {}).filter(m => (o.custom[m].rows || []).length).map(m => `the Custom demands (${m}) of this line`)];
    return note(`Values entered for line G${j + 1} only (engineer decisions SB-7, SB-9, SB-10, 2026-11-13: per-line values over the girder type ${g.label || g.id}; a blank value takes the type's): ${it.join('; ')}. The analysis and every check of this line use them; the type's other lines keep the type's values. As on the [[tab:loads|Loads tab]] (marked ● G${j + 1}).`); };
  /* sb13Note(B) (2026-11-13, engineer decision SB-13): the live load of the other lines in the superReactions hand-off, stated as an assumption
     (as the hand-off note), for a girder type on more than one line; null otherwise */
  const sb13Note = B => { const M = window.SBDModel, P = B.P, g = P && P.girders && P.girders[B.g]; if (!M || !g || !Array.isArray(g.lines) || g.lines.length < 2) return null;
    return note(`Assumption (engineer decision SB-13, 2026-11-13), hand-off to Substructure Loading (superReactions, for information only; live load is not sent): the LL+IM reactions of a line other than the type's design line G${M.designLine(P, g) + 1} are the design-line run's HL-93 per-lane reaction envelope (the same plates and spans, so the same per-lane envelope) times that line's own shear distribution factor g_V, not a separate moving-load run; each line's dead loads come from its own run. The checks of every line here use that line's own full analysis.`); };
  const clNote = A => { const L = A.loads || {}, src = (L.src || {}).CL, C = L.cl || {};
    const how = src === 'calc' ? `calculated, $w_{CL}$ = $q_{CL}$ × $b_{trib}$ [[an.CL.w]], $q_{CL}$ = ${f(C.q, 1)} psf (${C.qSrc === 'entered' ? 'entered' : C.qSrc === 'owner' ? `owner rule ${C.qCite}` : "this app's default, the overhang bracket construction load"})`
      : src === 'manual' ? 'entered on the Loads tab (Override calculated value)' : src === 'girder' ? 'from the girder loads (hand-off)' : `none${C.on ? '' : ' (not calculated: a project saved before the calculation was added, 2026-11-09)'}`;
    return note(`Construction live load (3.4.2.1 requires construction loads but gives no value): ${how}. ${A.fm ? 'Finishing machine: a pair of equal loads, one on each overhang, moving together; lever-rule share (4.6.2.2.1, including the uplift share on the first interior girder) moved along the steel section and added where it adds to the deck placement effect [[an.fm.Pj]]. ' : ''}The overhang bracket checks keep their own $q_{CL}$ and $P_{fm}$ (Constructibility section).`); };
  function an(B, X) {
    if (B.src === 'file') {   // the hand-off file's demands are the analysis of this report
      const pl = B.pl, S = pl.stations || [], all = X.detail === 'all', sup = B.sup || [];
      const rows = all ? S : S.filter(s => sup.some(x => Math.abs(+s.x - x) < 1e-6) || Math.abs(+s.M_LLpos) === Math.max(...S.map(q => Math.abs(+q.M_LLpos || 0))));
      return { title: 'Analysis (hand-off file)', subs: [sub('st', all ? 'Demands at every station of the file' : 'Demands from the file (supports and the largest LL+IM moment)', [
        note(`Unfactored per-girder moments and shears of ${B.plName || 'the hand-off file'} (GirderDetail's Structural analysis, worked in GirderDetail); this report takes them as given. ${S.length} stations, supports at ${sup.map(x => f(x, 2)).join(', ')} ft.`),
        tbl(['x (ft)', '$M_{DC1}$', '$M_{DC2}$', '$M_{DW}$', '$M_{LL+IM}^{+}$', '$M_{LL+IM}^{-}$', '$V_{DC1}$', '$V_{DC2}$', '$V_{DW}$', '$V_{LL+IM}^{+}$', '$V_{LL+IM}^{-}$'],
          rows.map(s => [N(+s.x, 2), N(+s.M_DC1, 1), N(+s.M_DC2, 1), N(+s.M_DW, 1), N(+s.M_LLpos, 1), N(+s.M_LLneg, 1), N(+s.V_DC1, 1), N(+s.V_DC2, 1), N(+s.V_DW, 1), N(+s.V_LLpos, 1), N(+s.V_LLneg, 1)]), { caption: 'kip-ft, kip' })])] };
    }
    const A = B.an, s = A.st, ll = A.ll, sup = A.sup, x = A.x, Nn = x.length, Vr = o => x.map((_, i) => i === Nn - 1 ? o.VL[i] : o.VR[i]), Vx = (o, k) => x.map((_, i) => i === Nn - 1 ? o['VL' + k][i] : o['VR' + k][i]);
    const S = A.settings, subs = [];
    subs.push(sub('set', 'Settings and loads', [kv([['IM truck and tandem / fatigue truck', `${f(S.im, 0)} % / ${f(S.imf, 0)} % (Table 3.6.2.1-1)`], ['Cracked zones (6.10.1.5)', S.crack === 'none' ? 'none' : S.crack === '15' ? '15 % of the spans either side of each pier' : 'negative dead-load moment region'],
      ['LL deflection limit', `L/${S.deflLimit} (2.5.2.6.2)`], ['Deck placement sequence', S.seq === 'off' ? 'off' : 'on'], ['Dead loads', A.loads && A.loads.source], ['Distribution factors', A.df && A.df.src]]),
      A.warnings.length ? note(A.warnings.join(' '), true) : null,
      note(`Unfactored effects per girder: DC1 (steel, then the wet deck) on the steel section, DC2 and DW on 3n, LL+IM on n; ${Nn} stations (GirderDetail's grid), shared beam elements, loads applied exactly. As on the [[tab:an|Analysis tab]].`),
      clNote(A), lovNote(B), sb13Note(B)]));
    const Mser = [{ name: 'DC1', y: s.DC1.M }, { name: 'DC2', y: s.DC2.M }, { name: 'DW', y: s.DW.M }];
    if (ll) Mser.push({ name: 'LL+IM max', y: ll.Mpos, c: '#DC2626' }, { name: 'LL+IM min', y: ll.Mneg, c: '#DC2626', dash: '4 3' });
    const Vser = [{ name: 'DC1', y: Vr(s.DC1) }, { name: 'DC2', y: Vr(s.DC2) }, { name: 'DW', y: Vr(s.DW) }];
    if (ll) Vser.push({ name: 'LL+IM max', y: Vx(ll, 'pos'), c: '#DC2626' }, { name: 'LL+IM min', y: Vx(ll, 'neg'), c: '#DC2626', dash: '4 3' });
    subs.push(sub('dg', 'Moment and shear diagrams', [{ type: 'figure', svg: chart(x, Mser, { title: 'Moments', unit: 'kip-ft', sup }), caption: 'Moments, unfactored, per girder (LL+IM with g); kip-ft' },
      { type: 'figure', svg: chart(x, Vser, { title: 'Shears', unit: 'kip', sup }), caption: 'Shears (sum of the forces to the left, up +); kip' },
      A.crack.length ? note(`Cracked zones: ${A.crack.map(([a, b]) => `${f(a, 1)}–${f(b, 1)} ft`).join(', ')} [[an.crack]].`) : null]));
    // SBFD (2026-11-19): the factored diagrams, the check modules' own demands at their locations (ui/factored.js; display only). The module
    // results of this report are taken where they are this project's analysis (not Custom); otherwise built here from the analysis
    if (window.SBDFactoredUI) { const cu = B.custom || {}; let FD = null;
      try { FD = window.SBDFactoredUI.compute(B.P, B.g, A, { flex: !cu.flex && B.flex && !B.flex.err ? B.flex : null, shear: !cu.shear && B.shear && !B.shear.err ? B.shear : null, cn: !cu.cn && B.cn && !B.cn.err ? B.cn : null }); } catch (e) { FD = null; }
      if (FD) subs.push(sub('fdg', 'Factored moment and shear diagrams (Strength I, Service II, Fatigue I, deck placement)', window.SBDFactoredUI.report(FD, { chart, note, tbl, steps, N, f }))); }
    const rr = (k, o) => o.R[k];
    subs.push(sub('r', 'Reactions (unfactored, kip)', [tbl(['Support', 'DC1', 'DC2', 'DW', 'Constr. LL', ...(ll ? ['LL+IM max', 'LL+IM min'] : [])],
      sup.map((v, k) => [`${k === 0 ? 'Abut. 1' : k === sup.length - 1 ? 'Abut. 2' : 'Pier ' + k} (x = ${f(v, 1)} ft)`, N(rr(k, s.DC1), 2), N(rr(k, s.DC2), 2), N(rr(k, s.DW), 2), N(rr(k, s.CL), 2),
        ...(ll ? [{ ...N(A.llR[k].max, 2), key: 'an.R.LL.' + k }, N(A.llR[k].min, 2)] : [])])),
      note(`Statics: ${['DC1steel', 'DC1wet', 'DC2', 'DW', 'CL'].map(k => `${k} [[an.eq.${k}]]`).join(', ')}.${ll ? ' LL+IM: the reaction envelope × the larger $g_{V}$ of the adjacent spans; 90 % of two trucks + lane at interior supports (3.6.1.3.1).' : ''}`)]));
    // DEFL (2026-11-09): the LL deflection check (SA3) and the dead-load deflections are in the Deflection section (defl() below)
    if (!DEFL_ON() && A.lld) { govLL(A, X);   // without ui/deflection.js (some Node tests): as before DEFL
      subs.push(sub('d', 'Live load deflection (SA3, 2.5.2.6.2)', [tbl(['Span', 'x (ft)', '$\\Delta_{LL}$ (in)', 'Limit (in)', 'Ratio', 'Status'], A.lld.map(q => [String(q.k + 1), N(q.x, 1), { ...N(q.d, 3), key: 'an.defl.LL' + (q.k + 1) }, { ...N(q.lim, 3), key: 'an.defl.lim' + (q.k + 1) },
        { ...R3(q.d / q.lim), t: f(q.d / q.lim, 2) }, { pass: 'OK', fail: 'Exceeds', warn: 'Exceeds the preferred limit', na: 'Reported (exterior)' }[q.status] || q.status]))])); }
    if (DEFL_ON()) subs.push(sub('d', 'Deflection', [note(`The live load deflection check (SA3) and the dead-load deflections and camber are in the Deflection section${A.lld && A.lld.length ? ' [[an.defl.LL1]]' : ''} [[an.camber.s1]], as on the [[tab:defl|Deflection tab]].`)]));
    if (A.seq) { const Q = A.seq;
      subs.push(sub('q', 'Deck placement sequence (SA7, 6.10.3.4.1)', [kv([['Pours, in order', Q.pours.map((q, k) => `${k + 1}: ${f(q.a, 1)}–${f(q.b, 1)} ft`).join('; ')], ['Largest noncomposite moment $M_{DCc}$', `${f(Math.max(...Q.MDCc), 1)} kip-ft`, 'an.seq.MDCc'],
        ['Deck tension in hardened pours / $\\phi f_{r}$', `${f(Math.max(...Q.fdk), 3)} / ${f(Q.phifr, 3)} ksi`, 'an.seq.fdk']])])); }
    if (X.detail === 'all') subs.push(sub('t', 'Station table', [note('Stiffness-method results of the shared beam engine; their checks are the statics steps and the per-lane envelope × g (worked steps below).'),
      tbl(['x (ft)', '$M_{DC1}$', '$M_{DC2}$', '$M_{DW}$', ...(ll ? ['$M_{LL+IM}^{+}$', '$M_{LL+IM}^{-}$'] : []), '$V_{DC1}$', '$V_{DC2}$', '$V_{DW}$', ...(ll ? ['$V_{LL+IM}^{+}$', '$V_{LL+IM}^{-}$'] : [])],
        x.map((v, i) => [N(v, 2), N(s.DC1.M[i], 1), N(s.DC2.M[i], 1), N(s.DW.M[i], 1), ...(ll ? [N(ll.Mpos[i], 1), N(ll.Mneg[i], 1)] : []), N(Vr(s.DC1)[i], 1), N(Vr(s.DC2)[i], 1), N(Vr(s.DW)[i], 1), ...(ll ? [N(Vx(ll, 'pos')[i], 1), N(Vx(ll, 'neg')[i], 1)] : [])]), { caption: 'kip-ft, kip (shears just right of the station)' })]));
    subs.push(sub('w', 'Worked steps', [gsteps('SBDAnalysisUI:x', '', DEFL_ON() ? A.steps.filter(q => !DEFL_ID.test(q.id)) : A.steps)]));
    return { title: 'Analysis', subs };
  }

  /* ---------- 4a. deflection (DEFL, 2026-11-09): the Deflection tab's content, the analysis' own values (ui/deflection.js model) ---------- */
  const DEFL_ID = /^an\.(defl\.|camber)/;   // the engine's LL deflection and camber steps: worked in this section (before: in Analysis)
  // the section needs ui/deflection.js and engine/sheets.js (index.html loads both); a page or test without them keeps every analysis step
  // in the Analysis section and has no Deflection section
  const DEFL_ON = () => !!(window.SBDDeflectionUI && window.SBDSheets);
  /* the summary row of the SA3 check (unchanged text and group; before DEFL in an()) */
  const govLL = (A, X) => X.gov.push(...A.lld.map(q => ({ mod: 'Analysis', check: 'SA3 LL deflection, $\\Delta_{LL}$ ≤ L/' + q.ratio, loc: `span ${q.k + 1}, x = ${f(q.x, 1)} ft`, r: q.d / q.lim, key: 'an.defl.LL' + (q.k + 1), status: q.status, grp: 'Analysis: SA3 live-load deflection' })).filter(q => q.status !== 'na').sort((a, b) => b.r - a.r).slice(0, 1));
  function defl(B, X) {
    const A = B.an, DU = window.SBDDeflectionUI, Mo = DU && window.SBDSheets ? DU.model(A) : null; if (!Mo) throw new Error('the Deflection tab (ui/deflection.js, engine/sheets.js) is not loaded');
    const subs = [], ST = { pass: 'OK', fail: 'Exceeds', warn: 'Exceeds the preferred limit', na: 'Reported (exterior)' }, S = A.settings, P = B.P, O = Mo.ll[0] && Mo.ll[0].own;
    if (A.lld) { govLL(A, X);
      const why = O ? `Limit: owner rule ${O.cite} (OWN19, mandatory): ${O.rule.text}. Sidewalk or pedestrians: ${O.sw ? 'yes' : 'no'} (${O.swHow === 'cross-section sidewalks' ? 'a sidewalk on the cross-section' : 'entered on the Loads tab'}), so L/${O.req}${O.uR > O.req ? `; the entered L/${O.uR} is stricter and is used` : ''}.${O.rep ? ' Applied to the typical interior beam only: this girder is exterior, so it is reported, not checked.' : ''}`
        : `Limit: no owner rule for the live load deflection (owner ${(P.ownerRules || {}).owner || 'AASHTO'}): the optional criterion of 2.5.2.6.2, L/${S.deflLimit} as entered (Loads tab). 2.5.2.6.2 gives L/800 for vehicular load and L/1000 for vehicular and pedestrian load; with no owner rule the sidewalk setting does not change the limit, so L/1000 applies only when entered.`;
      subs.push(sub('d', 'Live load deflection (SA3, 2.5.2.6.2, 3.6.1.3.2)', [tbl(['Span', 'L (ft)', 'x (ft)', '$g_{\\Delta}$', 'Per lane (in)', 'Governing case', '$\\Delta_{LL}$ (in)', 'Limit (in)', 'D/C', 'Status'],
        Mo.ll.map(q => [String(q.k + 1), N(q.L, 2), N(q.x, 1), N(q.gD, 3), N(q.perLane, 3), q.case || '—', { ...N(q.d, 3), key: 'an.defl.LL' + (q.k + 1) }, { ...N(q.lim, 3), key: 'an.defl.lim' + (q.k + 1) }, R3(q.dc), ST[q.status] || q.status])),
        note(why),
        note(`$\\Delta_{LL} = g_{\\Delta}\\max(\\Delta_{truck}(1 + IM),\\ 0.25\\Delta_{truck}(1 + IM) + \\Delta_{lane})$, IM ${f(S.im, 0)} % on the truck, per lane; the larger of the two cases is kept at each section and named (Governing case); the two are not listed side by side. D/C = $\\Delta_{LL}/\\Delta_{lim}$. $g_{\\Delta}$: all lanes loaded, all girders deflecting equally (2.5.2.6.2), ${A.df && A.df.src}; worked on the [[tab:loads|Loads & LLDF tab]]. Truck axles that do not add to the deflection are neglected (3.6.1.3.1).`),
        // CAMG (2026-11-23): the check of the governing span in one line, with the analysis' own steps of that span and its own note (nothing
        // about the method is written here: whatever steps and note the engine gives are listed and quoted)
        ...(() => { const gv = Mo.ll.filter(q => q.status !== 'na').sort((a, b) => b.dc - a.dc)[0] || Mo.ll[0]; if (!gv) return [];
          const re = new RegExp('^an\\.defl\\.[A-Za-z]+' + (gv.k + 1) + '$'), L = A.steps.filter(q => re.test(q.id)), main = L.find(q => q.id === 'an.defl.LL' + (gv.k + 1)), nt = main && (typeof main.note === 'string' ? main.note : main.note && main.note.lead) || '';
          return [note(`Check summary, governing span ${gv.k + 1} (x = ${f(gv.x, 1)} ft): $\\Delta_{LL}$ = ${f(gv.d, 3)} in against the criterion L/${gv.ratio} = ${f(gv.lim, 3)} in: D/C = ${f(gv.dc, 3)}, ${ST[gv.status] || gv.status}.${L.length ? ` The analysis' steps of this span: ${L.map(q => `${String(q.label).replace(/\$/g, '')} [[${q.id}]]`).join('; ')}.` : ''}${nt ? ` The step's own note: "${String(nt).replace(/\$/g, '')}"` : ''}`)]; })()])); }
    const c = A.camber, comps = Mo.comps, ser = comps.map(o => ({ name: o.k === 'wet' ? 'Wet deck' : o.name, y: o.y })).concat([{ name: 'Total', y: c.total, c: '#000000' }]);
    const pts = X.detail === 'all' ? c.x.map((x, i) => ({ nm: '', x, v: Object.fromEntries(comps.map(o => [o.k, o.y[i]]).concat([['total', c.total[i]]])), node: i })) : Mo.pts.map(t => ({ nm: `Span ${t.k + 1}, ${t.q === 0 ? '0.0' : t.q === 10 ? '1.0' : '0.' + t.q}L`, x: t.x, v: t.v, node: t.node }));
    subs.push(sub('c', 'Dead-load deflections and camber (6.7.2)', [{ type: 'figure', svg: chart(c.x, ser, { title: 'Dead-load deflections', unit: 'in', sup: A.sup, invert: true }), caption: 'Dead-load deflected shape (downward +, drawn down); in' },
      tbl(['Span', 'x (ft)', ...comps.map(o => o.name), 'Total = camber (in)'], Mo.max.map(m => [String(m.k + 1), N(m.x, 2), ...comps.map(o => N(o.y[m.i], 3)), { ...N(m.total, 3), key: 'an.camber.s' + (m.k + 1) }]), { caption: 'Largest total of each span' }),
      tbl(['Point', 'x (ft)', ...comps.map(o => o.name), 'Total'], pts.map(t => [t.nm, { t: f(t.x, 2) + (t.node < 0 ? ' *' : ''), n: true }, ...comps.map(o => N(t.v[o.k], 3)), N(t.v.total, 3)]), { caption: X.detail === 'all' ? 'Every analysis station; in, downward +' : 'Tenth points of each span; in, downward +' }),
      note(`${X.detail === 'all' ? '' : '* Between two analysis stations: linear between them (as the Drawings camber table). '}Steel + cross-frames and the wet deck (the whole deck at once) on the steel section; DC2 + DW on 3n${A.crack.length ? ` with cracked zones ${A.crack.map(([a, b]) => `${f(a, 1)}–${f(b, 1)} ft`).join(', ')}` : ''}${c.ut ? '; existing utilities on the steel section' : ''}. Not included: the deck placement sequence, the future utility allowance, construction loads, creep and shrinkage, and the vertical profile (no profile input in this app).${(P.ownerRules || {}).owner === 'CTDOT' ? ' The CTDOT extra camber of L/100 on simple spans (owner rule OWN33, BRSDM V1B) is not applied.' : ''}`)]));
    // DFG (2026-11-09): the camber of every girder line at the tenth points (the plans' camber table; report/data.js B.cam, each line's own analysis)
    if (B.cam && B.cam.length) { const ok = B.cam.find(q => q.camber), SH = window.SBDSheets, nb = B.cam.length;
      if (ok) { const pts = SH.tenths(ok.sup);
        subs.push(sub('all', 'Camber of every girder (tenth points)', [tbl(['Point', 'x (ft)', ...B.cam.map(q => `G${q.j + 1}${q.j === 0 || q.j === nb - 1 ? ' (ext.)' : ''}`)],
          pts.map(t => [`Span ${t.k + 1}, ${t.q === 0 ? '0.0' : t.q === 10 ? '1.0' : '0.' + t.q}L`, N(t.x, 2), ...B.cam.map(q => (q.camber ? N(SH.at(q.camber.x, q.camber.total, t.x), 3) : '—'))]), { caption: 'Total dead-load deflection = camber; in, downward +', wide: true }),
          note(`Camber = steel + cross-frames + wet deck + DC2 + DW${B.cam.some(q => q.camber && q.camber.ut) ? ' + existing utilities' : ''} of each girder: its own dead loads (deck and overhang, DC2 and DW shares, cross-frame point loads) on the plates of its plate girder (${B.cam.map(q => `G${q.j + 1}: ${(B.P.girders[q.pg] || {}).label || q.pg + 1}`).join(', ')}); the same analysis as the [[tab:defl|Deflection tab]]. Excludes the vertical profile. A girder with no plate girder of its own also takes that plate girder's effective flange width $b_{eff}$ (an exterior girder on an interior plate girder: the interior $b_{eff}$), and any dead loads or distribution factors entered for it as overrides on the Loads tab. A tenth point between two analysis stations: linear between them.${B.cam.some(q => q.err) ? ' Not available: ' + B.cam.filter(q => q.err).map(q => `G${q.j + 1} (${q.err})`).join('; ') + '.' : ''}`)]));
        // CAMG (2026-11-23, engineer's request; display only): each girder's own camber table (the components at the tenth points) and camber
        // diagram (chart(), the report's plot helper), from the same B.cam values as the table above
        { const CN = [['steel', 'DC1 steel + cross-frames', 'DC1 steel'], ['wet', 'DC1 wet deck (deck, haunch, forms)', 'DC1 wet deck'], ['sd', 'DC2 + DW', 'DC2 + DW'], ['ut', 'Existing utilities', 'Utilities']], its = [
            note('Camber = the total dead-load deflection, built into the girder upward: DC1 steel + cross-frames and DC1 wet deck (the whole deck at once) on the steel section, DC2 + DW on 3n. The values are those of the table above and of the [[tab:defl|Deflection tab]] (each girder\'s own analysis); the diagrams plot them upward, the largest total of each span marked. Excludes the vertical profile.')];
          B.cam.forEach(q => { const cq = q.camber, nm = `G${q.j + 1}${q.j === 0 || q.j === nb - 1 ? ' (exterior)' : ''}`, pg = (B.P.girders[q.pg] || {}).label || q.pg + 1; if (!cq) { its.push(note(`${nm}: not available${q.err ? ` (${q.err})` : ''}.`, true)); return; }
            const cs = CN.filter(([k]) => k !== 'ut' || cq.ut), sp = q.sup || ok.sup, si = q.supIdx || [];
            const mk = si.slice(0, -1).map((a, k) => { let i = a; for (let j2 = a; j2 <= si[k + 1]; j2++) if (cq.total[j2] > cq.total[i]) i = j2; return { x: cq.x[i], y: cq.total[i], t: f(cq.total[i], 3) }; });
            its.push({ type: 'figure', svg: chart(cq.x, cs.map(([k, , n]) => ({ name: n, y: cq[k] })).concat([{ name: 'Total camber', y: cq.total, c: '#000000' }]), { title: `Camber diagram, ${nm}`, unit: 'in', sup: sp, mark: mk }), caption: `Camber diagram, ${nm} (plates of ${pg}): upward camber, in; x in ft; the largest total of each span marked` });
            its.push(tbl(['Point', 'x (ft)', ...cs.map(([, n]) => n), 'Total camber'], SH.tenths(sp).map(t => [`Span ${t.k + 1}, ${t.q === 0 ? '0.0' : t.q === 10 ? '1.0' : '0.' + t.q}L`, N(t.x, 2), ...cs.map(([k]) => N(SH.at(cq.x, cq[k], t.x), 3)), N(SH.at(cq.x, cq.total, t.x), 3)]), { caption: `Camber table, ${nm}: tenth points; in (a tenth point between two analysis stations: linear between them)` })); });
          subs.push(sub('cg', 'Camber table and diagram of each girder', its)); } } }
    subs.push(sub('w', 'Worked steps', [gsteps('SBDAnalysisUI:x', '', A.steps.filter(q => DEFL_ID.test(q.id)))]));
    return { title: 'Deflection', note: 'From this girder\'s analysis, as on the [[tab:defl|Deflection tab]].', subs };
  }

  /* ---------- 5. section properties ---------- */
  const rlNm = s => (window.SBDRolled ? window.SBDRolled.label(s) : '');   // ROLL (2026-11-23): the shape name of a rolled segment ('' for a plate segment)
  function sec(B, X) {
    const S = B.sec, subs = [sub('n', 'Modular ratio', [steps('', S.nr.steps)])];
    S.cards.forEach(q => { const c = q.c, sc = `sec@${q.i}.${q.region}`, s = q.seg;
      const row = (nm, p, id) => p ? [nm, N(p.A, 2), N(p.yb, 3), { t: U().fmtInt(p.I), n: true, key: K(sc, id + '.I') }, { t: U().fmtInt(p.St), n: true }, { t: U().fmtInt(p.Sb), n: true }] : null;
      subs.push(sub(sc, `Segment ${q.i + 1} (x = ${f(s.x0, 2)} to ${f(s.x1, 2)} ft), ${q.region === 'pos' ? 'positive' : 'negative'} flexure${rlNm(s) ? `, rolled shape ${rlNm(s)}` : ''}`, [
        rlNm(s) ? note(`Rolled shape ${rlNm(s)}, checked as three plates (flanges b_f × t_f, web D = d − 2 t_f by t_w; fillets left out; t_f reduced where needed so that A, I_x, S_x and Z_x do not exceed the tabulated values). Its tabulated values and the three-plate values: first topic of the worked steps below.`) : null,
        tbl(['Section', 'A (in²)', '$\\bar{y}$ (in)', 'I (in⁴)', '$S_{top}$ (in³)', '$S_{bot}$ (in³)'], [row('Steel', c.s, 'sec.s'), row('Long-term 3n', c.c3, 'sec.c3'), row('Short-term n', c.cn, 'sec.cn'), c.comp ? row('Steel + rebar', c.cr, 'sec.cr') : null].filter(Boolean)),
        kv([['$M_{p}$', `${f(c.Mp, 1)} kip-ft`, K(sc, `pl.${c.region}.Mp`)], ['PNA $y_{p}$ from bottom', `${f(c.yp, 3)} in`, K(sc, `pl.${c.region}.yp`)], ['D6.1 case', c.pl.cs], ['$D_{cp}$', `${f(c.Dcp, 3)} in`, K(sc, `pl.${c.region}.Dcp`)],
          ['$R_{h}$', f(c.Rh, 3), K(sc, !c.comp ? 'rh.s.Rh' : c.region === 'pos' ? 'rh.cn.Rh' : 'rh.cr.Rh')]]),
        c.comp ? null : note('Noncomposite girder: the steel section alone (6.10.1.1.1a).'),
        gsteps('SBDFlexureUI:sec', sc, (window.SBDRolled ? window.SBDRolled.steps(s) : []).concat(c.steps), { lazy: true, title: 'Worked steps' })])); });   // opened on demand: the flexure and constructibility steps repeat them per location
    return { title: 'Section properties', note: `Plates of ${gName(B.girder)}; y up from the bottom of the steel. As on the [[tab:sec|Section properties tab]]; the flexure and constructibility steps below repeat the properties of each location.`, subs };
  }

  /* ---------- 6. flexure ---------- */
  function checksTbl(r, sc) {
    return tbl(['Check', 'Demand', 'Capacity', 'Ratio', ED], r.checks.map(c => isFinite(c.ratio)
      ? { cells: [`${c.id} ${tt(c.title)}${c.inUse === false ? ' (not the method in use)' : ''}`, { t: `${f(c.demand, 2)} ${c.unit || ''}`, n: true }, { t: `${f(c.capacity, 2)} ${c.unit || ''}`, n: true }, { ...R3(c.ratio, c.step ? K(sc, c.step) : null), cls: c.inUse === false ? '' : rc(c.ratio) }, String(c.ref || '').replace(ED.replace(' (2024)', '') + ' ', '')], cls: r.gov === c ? 'gov' : '' }
      : [`${c.id} ${tt(c.title)}`, c.na ? { t: c.na, cls: 'na', span: 3 } : { t: 'not evaluated (ratio not a number)', cls: 'ng', span: 3 }, String(c.ref || '').replace('AASHTO LRFD 10th Ed. ', '')]));
  }
  function flex(B, X) {
    const Gr = B.flex, rows = Gr.rows, sup = B.sup, all = X.detail === 'all', subs = [];
    const grp = r => `${r.pos ? 'pos' : 'neg'}${spanOf(sup, r.x)}`, best = new Map();
    rows.forEach(r => { if (!r.gov) return; const k = grp(r), b = best.get(k); if (!b || r.gov.ratio > b.gov.ratio) best.set(k, r); });
    const govRows = [...best.values()].sort((a, b) => a.x - b.x), scOf = r => 'flex@' + rows.indexOf(r);
    const shown = all ? rows : govRows;
    shown.forEach(r => X.have.set(r, scOf(r)));
    subs.push(sub('res', all ? 'Results at every location' : 'Governing location of each span and region', [
      note(B.src === 'file' || Gr.custom ? fromHtml(Gr.what) : `This project's analysis, as the [[tab:flex|Flexure tab]] with that source (Appendix A6 where permitted): Strength I, Service II and Fatigue I flexure (engine/flexure.js) at every analysis station, with the project's plates, deck, materials and ${brNote(Gr)}; ${flNote(B, Gr.D, '[[tab:flex|Flexure tab]]')}; the same locations and capacities as rated on the [[tab:rt|Rating tab]]${B.flexSame === false ? ' (here they differ from the rating\'s: its capacities are worked in the Load rating section)' : ''}. Load factors Tables 3.4.1-1, -2; $\\phi_{f}$ = 1.0.`),
      Gr.oos ? note('A positive-flexure location has its plastic neutral axis below the web (outside Table D6.1-1): GS5 and GS6 are not reported there.', true) : null,
      tbl(['Location', 'x (ft)', 'Region', 'Method', 'Governing check', 'Ratio'], shown.map(r => ({ cells: [r.name, N(r.x, 2), r.pos ? 'positive' : 'negative', r.p7 ? '' : r.useA6 ? 'App. A6' : '6.10.8',
        r.gov ? `${r.gov.id} ${tt(r.gov.title)}` : '', r.gov ? R3(r.gov.ratio, K(scOf(r), r.gov.step)) : '—'], cls: r === Gr.gov ? 'gov' : '' })))]));
    // a check the engine could not evaluate (ratio not a number, no n/a reason): listed, never silently dropped (SB2-R2: GS7 where
    // f_bu ≥ F_cr with f_ℓ = 0)
    const nan = rows.flatMap(r => r.checks.filter(c => c.inUse !== false && !isFinite(c.ratio) && !c.na).map(c => ({ r, c })));
    if (nan.length) { const t = `Not evaluated (ratio not a number) at ${nan.length} location check(s): ${[...new Set(nan.map(q => q.c.id))].join(', ')} at x = ${nan.slice(0, 12).map(q => f(q.r.x, 2)).join(', ')}${nan.length > 12 ? ', …' : ''} ft. The governing ratio above excludes them: review these locations on the Flexure and Rating tabs.`;
      subs[0].items.splice(1, 0, note(t, true)); X.warn.push('Flexure: ' + t); }
    // B3: the proportion limits GS1–GS4 (and GS22) over the girder (engine/proportions.js summary), each with a link to its location's steps
    const PR = window.SBDProportions, PS = PR ? PR.summary(rows) : null;
    if (PS && (PS.gov.length || PS.warn.length)) {
      PS.gov.forEach(q => { if (!X.have.has(q.row)) X.have.set(q.row, scOf(q.row)); });
      subs.push(sub('prop', 'Cross-section proportions (6.10.2) and minimum deck reinforcement (6.10.1.7)', [
        note('Checked at every location with the flexure checks (GS1 web D/t_w ≤ 150; GS2 b_f/2t_f ≤ 12.0, b_f ≥ D/6, t_f ≥ 1.1t_w; GS3 0.1 ≤ I_yc/I_yt ≤ 10; GS4 A_r ≥ 0.01b_eff t_deck at negative-flexure locations, top layer ≥ 2/3 a warning; GS22 the owner\'s Appendix A6 rule, a warning). The largest ratio of each over the girder:'),
        tbl(['Check', 'Location', 'Demand', 'Capacity', 'Ratio', ED], PS.gov.map(q => ({ cells: [`${q.id} ${tt(q.c.title)}`, at(q.row, 2), { t: `${f(q.c.demand, 2)} ${q.c.unit || ''}`, n: true }, { t: `${f(q.c.capacity, 2)} ${q.c.unit || ''}`, n: true },
          { ...R3(q.c.ratio, K(scOf(q.row), q.c.step)), cls: rc(q.c.ratio) }, String(q.c.ref || '').replace(ED + ' ', '')] }))),
        PS.warn.length ? note(`Warnings: ${[...new Set(PS.warn.map(q => q.id))].map(id => { const L = PS.warn.filter(q => q.id === id); return `${id} at ${L.length} location(s), e.g. ${L[0].row.name}: ${L[0].c.na}`; }).join('; ')}`, true) : null]));
      const pg = PS.gov.reduce((b, q) => (!b || q.c.ratio > b.c.ratio ? q : b), null);
      if (pg) X.gov.push({ mod: 'Flexure', grp: 'Cross-section proportions and minimum deck reinforcement (GS1–GS4)', check: `${pg.id} ${tt(pg.c.title)}`, loc: at(pg.row, 2), r: pg.c.ratio, key: K(scOf(pg.row), pg.c.step) });
    }
    const one = r => [ptHead(B, r), checksTbl(r, scOf(r)), kv([['$M_{u}$ / $M_{s}$', `${f(r.Mu, 1)} / ${f(r.Ms, 1)} kip-ft`, K(scOf(r), 'fx.Mu')], ['$D_{c}$ (Service II)', `${f(r.DcS, 3)} in`, K(scOf(r), 'fx.DcS')],
      ['Fatigue I Δf top / bottom', `${f(r.dfT, 2)} / ${f(r.dfB, 2)} ksi`, K(scOf(r), 'fx.fatT')]])];
    const detailed = all ? (Gr.gov ? [Gr.gov] : []) : [...new Set(govRows.concat(PS ? PS.gov.map(q => q.row) : []))].sort((a, b) => a.x - b.x);   // B3: the proportions' locations too (their links)
    const stF = r => (window.SBDFlexureUI.stepsOf ? window.SBDFlexureUI.stepsOf(Gr, r) : r.steps);   // with custom demands the step that names them first
    if (Gr.custom) subs.splice(1, 0, cdSub('flex', B));
    detailed.forEach(r => subs.push(sub(scOf(r), `${at(r, 2)}${r === Gr.gov ? ' (governing)' : ''}`, [...one(r), gsteps('SBDFlexureUI:x', scOf(r), stF(r), { title: 'Worked steps (flexure, then the section properties of this location)' })])));
    if (all) subs.push(sub('every', 'Every location', rows.filter(r => r !== Gr.gov).map(r => gsteps('SBDFlexureUI:x', scOf(r), stF(r), { lazy: true, title: `${at(r, 2)}: ${r.gov ? `${r.gov.id} ${tt(r.gov.title)}, ratio ${f(r.gov.ratio, 3)}` : ''}` }))));
    if (Gr.gov) X.gov.push({ mod: 'Flexure', grp: 'Flexure (Strength I, Service II, Fatigue I)', check: `${Gr.gov.gov.id} ${tt(Gr.gov.gov.title)}`, loc: /x = /.test(Gr.gov.name) ? Gr.gov.name : `${Gr.gov.name}, x = ${f(Gr.gov.x, 2)} ft`, r: Gr.gov.gov.ratio, key: K(scOf(Gr.gov), Gr.gov.gov.step) });
    return { title: 'Flexure', subs };
  }

  const cdMods = B => Object.keys(B.custom || {}).filter(k => B.custom[k]).map(k => window.SBDCustomDemands.SPECS[k].name).join(', ');   // the modules on custom demands
  /* cdSub(mod, B): the custom demands entered on the module's tab, as a report table (ui/demands.js report; custom demands PR) */
  function cdSub(mod, B) {
    const T = window.SBDCustomDemands.report(B.P, mod, B.g);
    return sub('cd', T.title, [note(T.note), tbl(T.head, T.rows), T.sup ? note('Support reactions (bearing stiffeners):') : null, T.sup ? tbl(T.sup.head, T.sup.rows) : null]);
  }

  /* ---------- 7. shear and stiffeners ---------- */
  function shear(B, X) {
    const R = B.shear, SB = window.SBDStiffeners, all = X.detail === 'all', subs = [], gl = [];
    const pk = i => 'sh.pan@' + i, sk = i => 'sh.st@' + i, tk = i => 'sh.ts@' + i, bk = i => 'sh.bs@' + i;
    const stS = (k, o) => window.SBDShearUI.stepsOf(R, k, o);   // the worked steps (with custom demands the step that names them first; ui/shear.js)
    if (R.panels.gov && R.gm.dem) gl.push({ g: 'Web panels', it: `Panel ${f(R.panels.gov.p, 2)}–${f(R.panels.gov.q, 2)} ft${R.panels.gov.end ? ' (end panel)' : ''}: $V_{u}$ ≤ $\\phi_{v}V_{n}$ (6.10.9)`, r: R.panels.gov.r, key: K(pk(R.panels.gov.i), 'pn.ok') });
    if (R.stGov) gl.push({ g: 'Stations', it: `${R.stGov.name}: ${R.stGov.gov.id} ${tt(R.stGov.gov.title)}`, r: R.stGov.gov.ratio, key: K(sk(R.stations.indexOf(R.stGov)), R.stGov.gov.step) });
    if (R.tsGov) gl.push({ g: 'Transverse stiffeners', it: `${R.tsGov.it.loc}: ${R.tsGov.c.id} ${tt(R.tsGov.c.title)}`, r: R.tsGov.it.r, key: K(tk(R.tsGov.i), R.tsGov.it.step) });
    if (R.bsGov) gl.push({ g: 'Bearing stiffeners', it: `${R.bsGov.it.loc}: ${R.bsGov.c.id} ${tt(R.bsGov.c.title)}`, r: R.bsGov.it.r, key: K(bk(R.bsGov.i), R.bsGov.it.step) });
    gl.forEach(q => X.gov.push({ mod: 'Shear & stiffeners', grp: 'Shear & stiffeners: ' + q.g, check: q.it, loc: q.g, r: q.r, key: q.key }));
    subs.push(sub('gov', 'Governing items', [note(fromHtml(R.what)), note('Strength I $\\gamma_{DC}$ 1.25, $\\gamma_{DW}$ 1.50, LL+IM 1.75 (with the owner\'s η and m); special fatigue loading 6.10.5.3; deck placement 1.25$V_{DC1}$ + 1.50$V_{CL}$; $\\phi_{v}$ = 1.0. As on the [[tab:shear|Shear & stiffeners tab]].'),
      tbl(['Group', 'Governing item', 'Ratio'], gl.map(q => [q.g, q.it, R3(q.r, q.key)])),
      R.TS && R.TS.errors && R.TS.errors.length ? note('Transverse stiffeners: ' + R.TS.errors.join('; '), true) : null, R.BS.errors && R.BS.errors.length ? note('Bearing stiffeners: ' + R.BS.errors.join('; '), true) : null]));
    if (R.custom) subs.push(cdSub('shear', B));
    // panels
    const pans = R.panels.rows, pSel = all ? pans : R.panels.gov && R.gm.dem ? [R.panels.gov] : [];
    subs.push(sub('pan', `Web panels (D = ${f(R.D, 2)} in, $F_{yw}$ = ${f(R.Fyw, 0)} ksi)`, [
      tbl(['Panel (ft)', '$d_{o}$ (in)', 'Type', 'k', 'C', '$\\phi V_{n}$ (kip)', '$V_{u}$ (kip)', 'Ratio'], (all ? pans : pSel).map(q => ({ cells: [`${f(q.p, 2)}–${f(q.q, 2)}`, N(q.d, 2), q.end ? 'end' : q.stiff ? 'interior' : 'unstiffened', N(q.k, 3), N(q.C, 4), N(q.phVn, 1),
        R.gm.dem ? N(q.Vu, 1) : '—', R.gm.dem ? R3(q.r, K(pk(q.i), 'pn.ok')) : '—'], cls: q === R.panels.gov ? 'gov' : '' }))),
      ...pSel.map(q => gsteps('pan', pk(q.i), stS('pan', q), { lazy: all && q !== R.panels.gov, title: `Panel ${f(q.p, 2)}–${f(q.q, 2)} ft${q === R.panels.gov ? ' (governing)' : ''}` }))]));
    // stations
    const st = R.stations, sSel = all ? st : R.stGov ? [R.stGov] : [];
    const cell = (r, id) => { const q = r.checks.find(c => c.id === id); return q && q.inUse ? R3(q.ratio, sSel.includes(r) ? K(sk(st.indexOf(r)), q.step) : null) : { t: 'n/a', cls: 'na' }; };
    subs.push(sub('st', 'Shear at the stations (GS11, GS16, GS18)', [
      tbl(['Station', '$d_{o}$ (in)', '$V_{u}$ (kip)', '$\\phi V_{n}$ (kip)', 'GS11', 'GS16', 'GS18'], sSel.map(r => ({ cells: [`${r.name}${r.end ? ' (end panel)' : ''}`, r.do > 0 ? N(r.do, 2) : '—', N(r.VuP != null ? r.VuP : r.Vu, 1), N(r.sh.Vn, 1), cell(r, 'GS11'), cell(r, 'GS16'), cell(r, 'GS18')], cls: r === R.stGov ? 'gov' : '' }))),
      ...sSel.map(r => gsteps('loc', sk(st.indexOf(r)), stS('loc', r), { lazy: all && r !== R.stGov, title: `${r.name}${r === R.stGov ? ' (governing)' : ''}` }))]));
    // transverse stiffeners
    if (R.TS && !R.TS.errors.length) { const T = R.TS.rows, tSel = all ? T.map((r, i) => i) : R.tsGov ? [R.tsGov.i] : [];
      subs.push(sub('ts', 'Transverse stiffeners and connection plates (6.10.11.1)', [note(`Checks: ${R.tsC.map(c => `${c.id} ${tt(c.title)}${c.naWhy ? ' (n/a)' : ''}`).join('; ')}.`),
        tbl(['Location', '$d_{o1}$ / $d_{o2}$ (in)', '$I_{t}$ / $I_{req}$ (in⁴)'], tSel.map(i => { const r = T[i]; return { cells: [`${r.name} (Type ${r.type})`, `${f(r.do1, 2)} / ${f(r.do2, 2)}`, { t: `${f(r.It, 2)} / ${f(r.Ireq, 2)}`, n: true }], cls: R.tsGov && R.tsGov.i === i ? 'gov' : '' }; })),
        ...tSel.map(i => gsteps('ts', tk(i), stS('ts', T[i]), { lazy: all && !(R.tsGov && R.tsGov.i === i), title: `${T[i].name} (Type ${T[i].type})` }))])); }
    // bearing stiffeners: every bearing
    if (!R.BS.errors.length) subs.push(sub('bs', 'Bearing stiffeners (6.10.11.2)', [note(R.custom ? 'Reactions: as entered on the Shear & stiffeners tab (Custom demands, support reactions table).' : R.rxn ? "Reactions: the support reactions of this project's analysis (Analysis section, reactions table)." : 'Reactions from the shears of the hand-off file (DC, DW: the jump in shear; LL+IM: the sum of the two envelopes beside the support, an upper bound).'),
      tbl(['Bearing', '$R_{u}$ (kip)', '$(R_{sb})_{r}$ (kip)', '$P_{r}$ (kip)', 'Welds $R_{r}$ (kip)'], R.BS.rows.map((r, i) => ({ cells: [`${r.name} (Type ${r.type})`, N(r.Ru, 1), N(r.Rsb, 1), N(r.Pr, 1), N(r.Rweld, 1)], cls: R.bsGov && R.bsGov.i === i ? 'gov' : '' }))),
      note(`Checks: ${R.bsC.map(c => `${c.id} ${tt(c.title)} (${c.status})`).join('; ')}.`),
      ...R.BS.rows.map((r, i) => gsteps('bs', bk(i), stS('bs', r), { title: `${r.name} (Type ${r.type})` }))]));
    return { title: 'Shear and stiffeners', subs };
  }

  /* ---------- 8. fatigue and studs ---------- */
  function fat(B, X) {
    const R = B.fat, FA = window.SBDFatigue, SC = window.SBDStuds, all = X.detail === 'all', subs = [], gl = [];
    const fk = i => 'fa@' + i, gk = i => 'gs17@' + i, ck = cid => (R.FC || []).find(c => c.id === cid) || { items: [] };
    const faI = R.faGov ? R.FR.rows.findIndex(r => R.faGov.it.step.startsWith(`fa${r.i}.`)) : -1;
    if (R.faGov) gl.push({ g: 'Fatigue details', it: `${R.faGov.it.loc}: ${R.faGov.c.id} ${tt(R.faGov.c.title)}`, r: R.faGov.it.r, key: K(fk(faI), R.faGov.it.step) });
    if (R.g17) gl.push({ g: 'Flanges, every station', it: `${R.g17.it.loc}: GS17 flange stress range (Category ${R.g17.it.cat}, Fatigue ${R.g17.it.lim})`, r: R.g17.it.r, key: K(gk(R.g17.i), R.g17.it.step) });
    if (R.scGov) gl.push({ g: 'Studs', it: `${R.scGov.it.loc}: ${R.scGov.c.id} ${tt(R.scGov.c.title)}`, r: R.scGov.it.r, key: K('sc', R.scGov.it.step) });
    gl.forEach(q => X.gov.push({ mod: 'Fatigue & studs', grp: 'Fatigue & studs: ' + q.g, check: q.it, loc: q.g, r: q.r, key: q.key }));
    subs.push(sub('gov', 'Governing items', [note(fromHtml(R.what)), note(FA.setText(R.set) + '. As on the [[tab:fat|Fatigue & studs tab]].'), tbl(['Group', 'Governing item', 'Ratio'], gl.map(q => [q.g, q.it, R3(q.r, q.key)])),
      R.FR.errors.length ? note('Fatigue: ' + R.FR.errors.join('; '), true) : null, R.SR.errors.length ? note('Shear connectors: ' + R.SR.errors.join('; '), true) : null]));
    if (R.custom) subs.push(cdSub('fat', B));
    if (!R.FR.errors.length) { const rows = R.FR.rows, sel = all ? rows.map((r, i) => i) : faI >= 0 ? [faI] : [];
      subs.push(sub('fa', 'Fatigue details (FA1, FA2, FA3; 6.6.1.2, 6.10.5.3)', [note(`$ADTT_{SL}$ = ${f(R.FR.ADTTSL, 0)} trucks/day. Fatigue I where $ADTT_{SL}$ is at least the detail's infinite-life equivalent, else Fatigue II; exempt: net compression under the permanent loads (FA2).`),
        tbl(['Detail', 'Cat.', 'n', 'Limit state', 'γ(Δf) (ksi)', '$(\\Delta F)_{n}$ (ksi)', 'FA1'], rows.map((r, i) => { const a = ck('FA1').items[i] || {}; return { cells: [`${r.name}${r.exempt ? ' (exempt)' : ''}`, r.cat, String(r.nn), `Fatigue ${r.lim}`, N(r.dem, 2), N(r.res, 2),
          r.exempt ? { t: 'exempt', cls: 'ok' } : R3(a.r, sel.includes(i) && a.step ? K(fk(i), a.step) : null)], cls: i === faI ? 'gov' : '' }; })),
        ...sel.map(i => gsteps('SBDFatigueUI:x', fk(i), window.SBDFatigueUI.stepsOf(R, 'fa', rows[i]), { lazy: all && i !== faI, title: rows[i].name }))])); }
    // remaining fatigue life, MBE 4th Ed. Section 7 (2026-11-10): when the evaluation is on (Fatigue & studs input)
    if (!R.FR.errors.length && R.FR.ev && R.FR.ev.on) { const V = R.FR.ev, rows = R.FR.rows, f6 = ck('FA6').items, LN = { min: 'minimum', E1: 'Evaluation 1', E2: 'Evaluation 2', mean: 'mean' }[V.level];
      const worst = rows.reduce((b, r, i) => (r.ev.prone && !r.ev.inf && (b < 0 || r.ev.lives[V.level].rem < rows[b].ev.lives[V.level].rem) ? i : b), -1), selE = all ? [] : worst >= 0 && worst !== faI ? [worst] : [], shownE = i => all || i === faI || selE.includes(i);   // in 'all' the Fatigue details subsection works every row (these steps with it)
      subs.push(sub('ev', 'Remaining fatigue life (FA5, FA6; MBE 4th Ed. Section 7)', [note(FA.EV_BASIS + ` Present age ${f(V.yearEval - V.yearOpen, 0)} years; present $ADTT_{SL}$ ${f(V.ADTT, 0)}${V.ADTT0 != null ? `, first year ${f(V.ADTT0, 0)}` : ' (first year: present/(1+g)^a)'}; g = ${f(V.g, 2)} %/yr; $R_{s}$ = ${f(V.Rs, 2)}; ${LN} life; required ${f(V.target, 0)} years. As on the [[tab:fat|Fatigue & studs tab]].`),
        tbl(['Detail', 'Cat.', '$R_{p}$', '$(\\Delta f)_{eff}$ (ksi)', '$(\\Delta f)_{max}$ (ksi)', '$(\\Delta F)_{TH}$ (ksi)', 'FA5', '$R_{R}$', '$Y_{REM}$ (years)', 'FA6'], rows.map((r, i) => { const e = r.ev, lv = e.lives[V.level], it = f6.find(q => q.step === `fa${r.i}.life`);
          return { cells: [r.name, r.cat, N(e.Rp, 3), N(e.dfe, 2), N(e.dfmax, 2), N(r.th, 2), !e.prone ? 'not fatigue-prone (7.2.3)' : e.inf ? 'infinite' : 'finite', !e.prone || e.inf ? '' : N(lv.RR, 2), !e.prone ? 'not evaluated' : e.inf ? '∞' : (shownE(i) ? { ...N(lv.rem, 1), key: K(fk(i), `fa${r.i}.life`) } : N(lv.rem, 1)), it ? { t: it.st === 'pass' ? 'OK' : it.st === 'fail' ? 'Fails' : 'n/a', cls: it.st === 'fail' ? 'ng' : 'ok' } : '—'], cls: i === worst ? 'gov' : '' }; })),
        ...selE.map(i => gsteps('SBDFatigueUI:x', fk(i), window.SBDFatigueUI.stepsOf(R, 'fa', rows[i]), { lazy: all, title: `${rows[i].name} (remaining life)` }))])); }
    if (R.gs17) { const sel = all ? R.gs17.map((q, i) => i) : R.g17 ? [R.g17.i] : [];
      subs.push(sub('gs', 'Flange stress range (GS17; 6.6.1.2, 6.10.5.1)', [note(`Top flange Category ${R.cats.T}, bottom flange Category ${R.cats.B}; n by station (Table 6.6.1.2.5-1).`),
        tbl(['Station', 'n', 'Top: limit state', 'Top ratio', 'Bottom: limit state', 'Bottom ratio'], sel.map(i => { const q = R.gs17[i]; return { cells: [q.r.name, String(q.o.fatN), `Fatigue ${q.o.fatT.lim}`, R3(q.o.items[0].r, K(gk(i), q.o.items[0].step)), `Fatigue ${q.o.fatB.lim}`, R3(q.o.items[1].r, K(gk(i), q.o.items[1].step))], cls: R.g17 && R.g17.i === i ? 'gov' : '' }; })),
        ...sel.map(i => gsteps('SBDFatigueUI:x', gk(i), window.SBDFatigueUI.stepsOf(R, 'gs', R.gs17[i]), { lazy: all && !(R.g17 && R.g17.i === i), title: `${R.gs17[i].r.name} (GS17)` }))])); }
    if (!R.SR.errors.length) { const Sr = R.SR, C = R.SCC, cc = id => C.find(c => c.id === id) || { items: [] };
      subs.push(sub('sc', `Shear connectors (6.10.10): ${Sr.zones.length} pitch zones, ${Sr.regions.length} strength regions`, [
        note(window.SBDFatigueUI.SC_ED_TXT),   // F5 (2026-11-23): the stud checks follow the 10th Ed. only
        kv([['Studs', `${f(Sr.d, 3)} × ${f(Sr.h, 2)} in`], ['$Q_{r}$', `${f(Sr.Qr, 2)} kip`, K('sc', 'sc.Qr')], ['$Z_{r}$ (Fatigue I)', `${f(Sr.Zr, 3)} kip`, K('sc', 'sc.ZrI')], ['$b_{eff}$', `${f(Sr.dk.beff, 2)} in (${Sr.beffMode === 'girder' ? "this girder's own" : 'bridge-wide'})`, K('sc', 'sc.beff')]]),
        tbl(['Zone', 'Studs', '$V_{f}$ (kip)', 'Limit state', '$V_{sr}$ (kip/in)', '$p_{max}$ (in)', 'SC1'], Sr.zones.map((z, i) => { const a = cc('SC1').items[i] || {}; return [z.name, `${z.nr} @ ${f(z.p, 2)} in`, N(z.Vfr, 1), `Fatigue ${z.fat.lim}`, N(z.Vsr, 3), N(z.preq, 2), R3(a.r, K('sc', `scz${z.i}.ok`))]; })),
        tbl(['Region', 'P (kip)', 'n required', 'n provided', 'SC2'], Sr.regions.map((r, i) => { const a = cc('SC2').items[i] || {}; return [r.name, N(r.P, 1), N(r.nreq, 2), `${r.nprov}${r.lost ? ` − ${r.lost}` : ''}`, R3(a.r, K('sc', `scr${r.i}.ok`))]; })),
        gsteps('SBDFatigueUI:x', 'sc', window.SBDFatigueUI.stepsOf(R, 'sc'), { lazy: all, title: 'Worked steps, shear connectors' })])); }
    return { title: 'Fatigue and studs', subs };
  }

  /* ---------- 9. constructibility ---------- */
  function cn(B, X) {
    const R = B.cn, rows = R.rows, all = X.detail === 'all', subs = [], sc = r => 'cn@' + rows.indexOf(r), oc = r => 'cnoh@' + R.oh.rows.indexOf(r);
    // SBTS (2026-11-10): the other sign case of a location (r.alt, not governing) has its steps under the scope sc(r) + '~'
    const sca = r => sc(r) + '~', oth = o => !!(o && o.cs && o.cs !== o.row), sgn = q => (q && q.side > 0 ? 'positive' : 'negative');
    const keyOf = o => !o ? null : o.row.checks && o.row.conC ? K(oth(o) ? sca(o.row) : sc(o.row), o.check.step) : R.oh ? K(oc(o.row), o.check.step) : null;
    const gset = new Set(); R.spans.forEach(s => ['top', 'bot', 'tens', 'shear'].forEach(k => { if (s[k] && s[k].row.conC) gset.add(s[k].row); })); if (R.gov) gset.add(R.gov);
    const shown = all ? rows : rows.filter(r => gset.has(r));
    const cell = o => !o ? '—' : { ...R3(o.ratio, keyOf(o)), t: `${f(o.ratio, 3)} (${o.row.conC ? '' : o.check.id + ', '}${f(o.row.x, 2)} ft${o.row.conC && o.row.alt ? `, ${sgn(o.cs)} case` : ''})` };
    const ga = R.govAll;
    if (ga) X.gov.push({ mod: 'Constructibility', grp: 'Constructibility (deck placement)', check: `${ga.check.id} ${tt(ga.check.title)}`, loc: `x = ${f(ga.row.x, 2)} ft`, r: ga.ratio, key: keyOf(ga) });
    const wh = R.custom ? fromHtml(R.what) : B.src === 'file' ? `${B.plName || 'Hand-off file'}: ${R.F.locs.length} stations; $M_{DCc}$, $M_{CL}$, $V_{DC1}$, $V_{CL}$ from the file.` : `${gName(B.girder)}: ${R.F.locs.length} locations from this project's analysis (dead loads): $M_{DC1}$, $V_{DC1}$, ${R.F.seq ? '$M_{DCc}$ the noncomposite envelope of the deck placement sequence [[an.seq.MDCc]]' : 'no pour sequence ($M_{DC1}$)'}, construction live load $M_{CL}$, $V_{CL}$.`;
    subs.push(sub('gov', 'Governing ratio of each span', [note(`${wh} $M_{c}$ = 1.25$M_{DCc}$ + 1.50$M_{CL}$, $V_{u}$ = 1.25$V_{DC1}$ + 1.50$V_{CL}$ on the noncomposite steel section (3.4.2.1, 6.10.3.4.1); $\\phi_{f}$ = $\\phi_{v}$ = 1.0; ${R.D ? flNote(B, R.D, '[[tab:cn|Constructibility tab]]').replace('$f_{\\ell}$', '$f_{\\ell}$ during deck placement') : ''}.`),
      tbl(['Span', 'Top flange in compression', 'Bottom flange in compression', 'Tension flange', 'Shear (GS16)', ...(R.oh ? ['Overhang OH1–OH4', 'OH5'] : [])], R.spans.map(s => [String(s.span), cell(s.top), cell(s.bot), cell(s.tens), cell(s.shear), ...(R.oh ? [cell(s.oh), cell(s.ohfl)] : [])])),
      ...window.SBDConstr.notes(R.F.locs.some(L => L.M.DCc !== 0), !!R.F.sides).map(t => note(t)),
      R.oh && R.oh.errors && R.oh.errors.length ? note('Overhang brackets: ' + R.oh.errors.join(' '), true) : null]));
    if (R.custom) subs.push(cdSub('cn', B));
    if (all) subs.push(sub('all', 'Results at every location', [tbl(['Location', 'x (ft)', '$M_{c}$ (kip-ft)', 'Flange in compression', 'Governing check', 'Ratio'], rows.map(r => ({ cells: [r.name, N(r.x, 2), N(r.Mc, 1), r.alt ? `${r.conC.lab} (${sgn(r)} case; ${sgn(r.alt)} also checked)` : r.conC.lab, `${r.gov.id} ${tt(r.gov.title)}`, R3(r.gov.ratio, K(sc(r), r.gov.step))], cls: r === R.gov ? 'gov' : '' })))]));
    const one1 = (r, s, ttl) => [checksTbl(r, s), kv([['$M_{c}$', `${f(r.Mc, 1)} kip-ft`, K(s, 'cn.Mc')], ['$L_{b}$ / $C_{b}$ (deck placement)', `${f(r.LbC, 2)} ft / ${f(r.CbCu, 3)}`, K(s, 'cn.Cb')], ['$F_{nc}$ (FLB / LTB)', `${f(r.ltC.FLB, 2)} / ${f(r.ltC.LTB, 2)} ksi`, K(s, 'cn.Fnc')]]),
      gsteps('SBDConstrUI:x', s, window.SBDConstrUI.stepsOf(R, r), { title: ttl })];
    const one = r => !r.alt ? one1(r, sc(r), 'Worked steps') : [note(`Both signs of the deck-placement moment occur here and both are checked (6.10.3.4.1): the ${sgn(r)}-moment case governs (${r.conC.lab} flange in compression) and is reported; the ${sgn(r.alt)}-moment case (${r.alt.conC.lab} flange in compression) follows.`),
      ...one1(r, sc(r), `Worked steps, ${sgn(r)}-moment case (governing)`), ...one1(r.alt, sca(r), `Worked steps, ${sgn(r.alt)}-moment case (not governing)`)];
    shown.filter(r => gset.has(r)).forEach(r => subs.push(sub(sc(r), `${at(r, 2)}${r === R.gov ? ' (governing)' : ''}`, one(r))));
    if (all) subs.push(sub('every', 'Every other location', rows.filter(r => !gset.has(r)).flatMap(r => [gsteps('SBDConstrUI:x', sc(r), window.SBDConstrUI.stepsOf(R, r), { lazy: true, title: `${at(r, 2)}${r.alt ? `, ${sgn(r)}-moment case` : ''}: ${r.gov.id}, ratio ${f(r.gov.ratio, 3)}` }),
      ...(r.alt ? [gsteps('SBDConstrUI:x', sca(r), window.SBDConstrUI.stepsOf(R, r.alt), { lazy: true, title: `${at(r, 2)}, ${sgn(r.alt)}-moment case (not governing): ${r.alt.gov.id}, ratio ${f(r.alt.gov.ratio, 3)}` })] : [])])));
    if (R.oh && !(R.oh.errors && R.oh.errors.length)) { const O = R.oh;
      subs.push(sub('oh', 'Overhang brackets: flange lateral bending (exterior girder, OH1–OH5)', [kv([['$w_{u}$', `${f(O.wu, 4)} kip/ft`], ['$F_{\\ell}$ / $P_{\\ell}$', `${f(O.Fl, 4)} kip/ft / ${f(O.Pl, 3)} kip`, O.rows[0] ? K(oc(O.rows[0]), 'oh.Fl') : null]]),
        tbl(['Location', '$M_{u}$ (kip-ft)', '$M_{\\ell}$ (kip-in)', 'Governing', 'Ratio'], O.rows.map(o => [o.name, N(o.Mu, 1), N(o.Ml, 1), o.gov.id, R3(o.gov.ratio, K(oc(o), o.gov.step))])),
        ...O.rows.map(o => [checksTbl(o, oc(o)), gsteps('SBDConstrUI:x', oc(o), o.steps, { title: o.name })]).flat()])); }
    return { title: 'Constructibility (deck placement, 6.10.3)', subs };
  }

  /* ---------- 10. framing and cross-frames ---------- */
  function frm(B, X) {
    const { L, R, C, fl, XF, br, line, I } = B.frm, FR = L.FR, subs = [];
    // SBDIA (2026-11-10): with a diaphragm as the intermediate bracing: "diaphragms" in the titles, only the checks made (CF10, CF11, CFD, CFE), no truss member forces (as the tab)
    const FUI = window.SBDFramingUI, dOn = !!(FUI && FUI.isDia && FUI.isDia(I.p)), bn = dOn ? 'diaphragms' : 'cross-frames';
    let gov = null; (C || []).forEach(c => c.items.forEach(it => { if (isFinite(it.r) && (it.st === 'pass' || it.st === 'fail') && (!gov || it.r > gov.it.r)) gov = { c, it }; }));
    const svg = window.SBDFramingUI && window.SBDFramingUI.plan ? window.SBDFramingUI.plan(L, dOn) : '';
    // SBXF (2026-11-13; engineer decision 2026-11-13, girder types): the governing bay, its two girders and their depths, and the assumption, as the tab
    const xb = (() => { const Bq = I.p.xfBay; if (!Bq) return { kv: [], note: null }; const gl = q => q ? `G${q.line + 1} ${q.label}` : 'no type', bt = `G${Bq.j + 1}–G${Bq.j + 2}: ${gl(Bq.a)} $D$ = ${Bq.a ? f(Bq.a.D, 2) : '—'} in, ${gl(Bq.b)} $D$ = ${Bq.b ? f(Bq.b.D, 2) : '—'} in; ${Bq.eq ? 'equal depths' : `the shallower, G${Bq.s.line + 1} ${Bq.s.label}`}, $D$ = ${f(Bq.D, 2)} in`;
      const tl = Bq.tl ? Bq.tl.map(j => `G${j + 1}`).join(', ') : '', wl = Bq.ext ? `exterior girder G${Bq.ext.q.line + 1} ${Bq.ext.q.label}` : Bq.rep;   // SBXF2 (SB-18, SB-20)
      return { kv: [[Bq.scope === 'type' ? `Governing bay (shallowest attached to ${tl})` : 'Governing bay (shallowest)', bt, 'cf.xfD'], [`$d_{W}$ (wind, ${wl})`, `${f(I.p.dW, 2)} in`, 'cf.dW']],
        note: note(`Assumption (engineer decision 2026-11-13): each ${bn.replace(/s$/, '')} bay takes the depth of the shallower of the two girders it connects, by the girder type assigned to each line. The frame checked is the governing bay, ${Bq.scope === 'type' ? `the shallowest attached to any line of ${Bq.rep} (${tl}; engineer decision SB-18, 2026-11-13: the frames that brace this type)` : 'the shallowest'} (${bt}), with the largest girder spacing S and the largest $L_{b}$ as before; the ${bn.replace(/s$/, '')} weights in DC1 take each bay's own $h$${Bq.hAuto ? '' : ' ($h$ entered: the same in every bay)'}. ${Bq.ext ? 'The wind acts on the exterior girder depth $d_{W}$, the deeper of the girder types on G1 and the last line, whatever type is reported (engineer decision SB-20, 2026-11-13)' : 'The wind acts on the reported girder’s own depth $d_{W}$ (no girder type on an exterior line)'}; the stability bracing check braces the reported girder (${Bq.rep}).${dOn ? ' The diaphragm depth (CFD, CFE) is checked in every bay against the deeper of its two girders (engineer decision SB-19, 2026-11-13).' : ''} The depths are worked in the worked steps below (web depth of the governing bay, cross-frame depth h, girder depth d).`) }; })();
    const work = [...L.steps, ...fl.steps, ...(R.steps || [])], ids = new Set(work.map(t => t.id)), lk = id => (id && ids.has(id) ? id : null);   // an item's step, where the work has it
    // SBCKN (2026-11-13; display only): CF10's recommendation and the bracing in use in its Item cell, linked to the step that works it
    // (cf.type, else d), and every check's note below the table, as the tab (ui/framing.js ckRec, recStep, ckNotes)
    const rS = FUI && FUI.recStep ? FUI.recStep(ids) : null, sOf = id => (id === 'cf.type' && !ids.has(id) ? rS : id);
    const locR = (c, it) => { const x = FUI && FUI.ckRec ? FUI.ckRec(c, it) : null; return x ? `${it.loc}. Recommended: ${tt(x.rec)}. In use: ${tt(x.sel)}.${rS ? ` [[${rS}]]` : ''}` : it.loc; };
    if (gov) X.gov.push({ mod: dOn ? 'Diaphragms' : 'Cross-frames', grp: 'Cross-frames', check: `${gov.c.id} ${tt(gov.c.title)}`, loc: tt(gov.it.loc), r: gov.it.r, key: lk(gov.it.step) });
    subs.push(sub('pl', 'Framing plan (6.7.4.2.1)', [svg ? { type: 'figure', svg, caption: `Plan: girders, bearing lines, ${bn} and field splices` } : null,
      tbl(['Span', 'Skew θ (°)', 'Orientation', 'Frames', 'Spacing (ft)'], FR.orient.map(o => [String(o.k + 1), N(o.th, 2), o.o === 'normal' ? `normal, ${o.flat ? 'contiguous' : o.arr}` : 'parallel to the skew', String(o.n), { ...N(o.s, 3), key: `fr.k${o.k}.s` }])),
      tbl(['Girder', 'Intermediate frames', 'Largest $L_{b}$ (ft)', 'Brace points (ft)'], L.girders.map(g => ({ cells: [`G${g.i + 1}`, String(g.nInt), { ...N(g.lb, 2), key: `fr.g${g.i}.lb` }, g.braces.map(v => f(v, 2)).join(', ')], cls: g.i === line ? 'gov' : '' }))),
      note(`The reported girder takes cross-section girder G${line + 1}: its brace points are the $L_{b}$ points of the flexure and the ${dOn ? 'diaphragm' : 'cross-frame'} bays of the stiffener panels (${br ? br.ints.length : 0} intermediate ${dOn ? 'diaphragms' : 'frames'}). As on the [[tab:cf|${dOn ? 'Diaphragms' : 'Cross-frames'} tab]].`),
      note(`Orientation: ${(B.P.framing || {}).orient === 'parallel' ? 'parallel to the skew' : (B.P.framing || {}).orient === 'normal' ? 'normal to the girders' : 'automatic, parallel to the skew in a span whose supports are both skewed 20° or less, else normal to the girders (6.7.4.2.1); an owner rule xf.orient, where the owner has one, decides for the whole bridge'} (Framing & bracing tab). At a support skewed more than 20° the first normal frame is at least max(clear distance, $4b_{f}$, 0.4s) from the bearing (C6.7.4.2.1). Each frame puts half its weight on each girder it connects, at that girder's station, on the steel section (DC1).`)]));
    subs.push(sub('fl', `Flange lateral bending from skew and ${dOn ? 'diaphragm' : 'cross-frame'} loads`, [kv([[`$f_{\\ell,skew}$, unfactored estimate, G${line + 1} (C6.10.1, by the cross-frame lines; largest on the girder)`, `${f(fl.f0, 2)} ksi`, 'flsk.f0'], [`$\\gamma f_{\\ell,skew}$, deck placement`, `${f(fl.fl, 2)} ksi`, 'flsk.fl'], [`${dOn ? 'Diaphragm' : 'Cross-frame'} point loads on G${line + 1}`, XF ? `${XF.pts.length}, ${f(XF.tot, 2)} kip` : 'not included']])]));
    if (C) subs.push(sub('ck', FUI && FUI.ckHead ? FUI.ckHead(C, dOn) : `Checks (CF1 to CF11${C.some(c => c.id === 'CFD') ? ', CFD, CFE' : ''})`, [kv([['S (largest spacing)', `${f(I.p.S, 2)} in`], ['h / d', `${f(I.p.h, 2)} / ${f(I.p.dg, 2)} in`, I.p.xfBay ? 'cf.h' : 'cf.dg'], ...xb.kv, ['$L_{b}$ (largest)', `${f(I.p.Lb, 2)} ft`, 'cf.Lb']]), xb.note,
      R.errors && R.errors.length ? note(R.errors.join(' '), true) : null,
      tbl(['Check', 'Item', 'Demand', 'Resistance / limit', 'Ratio', 'Status'], C.flatMap(c => c.items.length ? c.items.map(it => [`${c.id} ${c.title}`, locR(c, it), isFinite(it.demand) ? N(it.demand, 2) : (it.cells || [])[0] || '', isFinite(it.capacity) ? N(it.capacity, 2) : (it.cells || [])[1] || '',
        isFinite(it.r) ? R3(it.r, lk(sOf(it.step))) : { t: '—', key: lk(sOf(it.step)) }, it.lbl || { pass: 'OK', fail: 'Fail', warn: 'Warning', adv: 'Advisory', na: 'n/a' }[it.st] || it.st]) : [[`${c.id} ${c.title}`, { t: c.naWhy || 'n/a', cls: 'na' }, '', '', '', 'n/a']])),
      C.some(c => c.id === 'CFD') ? note('Diaphragm bracing (Framing & bracing tab): checks CFD (intermediate) and CFE (end diaphragms at the bearing lines); the angle checks CF1 to CF9 and member forces entered from a refined analysis do not apply.') : null,
      C.some(c => c.id === 'CFD') && FUI && FUI.CONN_HINT ? note(`Assumption: ${FUI.CONN_HINT.replace(/^Hint \(engineer decision SB-26\): /, '').replace(/ the bolt diameter and grade above\)/, ' the bolt diameter and grade of the Framing & bracing tab)')} (Engineer decision SB-26, 2026-11-13; inputs on the Framing & bracing tab, checks CFD / CFE on the [[tab:cf|Diaphragms tab]]; this project: ${window.SBDCrossframes && window.SBDCrossframes.cfDiaNl && window.SBDCrossframes.cfDiaNl(I.p.dia) === 2 ? `2 vertical lines of ${Math.max(2, Math.round(+((I.p.dia || {}).nb) || 2))} bolts per end at ${f(+((I.p.dia || {}).pitch) || 3, 2)} in, lines ${f(window.SBDCrossframes.cfDiaG(I.p.dia), 2)} in apart, the first bolt line ${f(+((I.p.dia || {}).ecc) || 3.5, 2)} in from the web; the bolt group check is worked in [[cf.cfd.bolt]]` : `${Math.max(2, Math.round(+((I.p.dia || {}).nb) || 2))} bolts per end at ${f(+((I.p.dia || {}).pitch) || 3, 2)} in, bolt line ${f(+((I.p.dia || {}).ecc) || 3.5, 2)} in from the web`}.)`) : null,   // SB-26: the default connection is a placeholder
      ...(FUI && FUI.ckNotes ? FUI.ckNotes(C).map(q => note(`${q.id}: ${tt(q.note)}${q.id === 'CF10' && rS ? ` [[${rS}]]` : ''}`)) : []),   // SBCKN: every check's note, as the tab
      note(`References: ${C.map(c => `${c.id} ${c.ref}`).join('; ')}.`)]));
    if (R.frames && !dOn) subs.push(sub('mf', 'Member forces (truss model)', [tbl(['Member', 'Length (in)', 'per kip of $F_{w}$', ...R.combos.map(c => `${c.id} T / C (kip)`)], R.frames.map((e, i) => [e.lbl, N(e.L, 2), { ...N(e.unit, 3), key: `cf.tr${i}` }, ...R.combos.map(c => c.off ? 'not used' : `${f(c.f[i].T, 2)} / ${f(c.f[i].Cc, 2)}`)]))]));
    subs.push(sub('w', 'Worked steps', [gsteps('SBDFramingUI:x', '', work)]));
    return { title: dOn ? 'Framing and diaphragms' : 'Framing and cross-frames', subs };
  }

  /* ---------- 11. field splices ---------- */
  function spl(B, X) {
    const G = B.spl, SP = window.SBDSplices, subs = [], STT = { pass: 'OK', fail: 'NG', warn: 'Warning', adv: 'Advisory', na: 'n/a' };
    const strGov = CK => { let b = null; (CK || []).filter(c => /^(TF|BF)[1245]$|^WS[1245]$/.test(c.id)).forEach(c => c.items.forEach(it => { if (it.r != null && isFinite(it.r) && (!b || it.r > b.it.r)) b = { c, it }; })); return b; };
    /* SPLGFX (2026-11-02): the figures of the Field splices tab, the same reduced set (the location strip once, the 2D detail of each splice; the 3D view is screen
       only), as static SVG in the Drawings-tab format, at a fixed text size (about 11 px for the drawing's text height) and never wider than the page */
    const splFig = (make, caption) => { const GB = window.SBDTabGfxB, GR = window.SBDGraphics; if (!GB || !GR || !GR.tightSvg) return null;
      try { const g = make(GB), bb = g.D.bbox(g.i0, g.i1), px = Math.round((bb[2] - bb[0]) * 1.06 / g.D.h * 11);
        return { type: 'figure', svg: GR.tightSvg(g.D, { i0: g.i0, i1: g.i1, bg: '#fff', title: g.title, width: isFinite(px) && px > 0 ? `${px}px` : '100%' }), caption }; } catch (e) { return null; } };
    // summary: the splice with the largest strength ratio
    const sg = G.list.reduce((b, s, k) => { const q = strGov(s.CK); return q && (!b || q.it.r > b.q.it.r) ? { s, q, k } : b; }, null);
    if (sg) X.gov.push({ mod: 'Field splices', grp: 'Field splices', check: `${sg.q.c.id} ${tt(sg.q.c.title)}`, loc: `${sg.s.name}, ${tt(sg.q.it.loc)}`, r: sg.q.it.r, key: K('spl@' + sg.k, sg.q.it.step) });
    subs.push(sub('list', `Splices of ${gName(B.girder)}`, [G.custom ? note('Demands: entered (Custom) on the Field splices tab, the row at each splice station (table below).') : note("Demands: this project's analysis, moments at the analysis station nearest the splice and shears the largest of the element containing it and its neighbours (GirderDetail's rule); sections 0.01 ft each side, the smaller carries the design forces (6.13.6.1.1). As on the [[tab:spl|Field splices tab]]."),
      G.errors.length ? note(G.errors.join(' '), true) : null,
      G.list.length ? (() => { const cap17 = `Splice locations on girder ${gName(B.girder)}; marker colour: the governing ratio of each splice`;   // DETC: the option C figure of the tab (ui/gfxdet.js), else the CAD drawing
        try { if (window.SBDGfxDet && window.SBDVizKit && window.SBDVizKit.scene) return { type: 'figure', svg: window.SBDGfxDet.stripFigure(G.list, B.P, 760), caption: cap17 }; } catch (e) { /* the CAD figure */ }
        return splFig(GB => GB.spliceStrip(G.list, B.P, {}), cap17); })() : null,
      tbl(['Splice', 'Plates and bolts', 'Governing', 'Ratio', 'Largest strength ratio', 'Status'], G.list.map((s, k) => { const fl = s.R && s.R.fl, gv = s.gov, q = strGov(s.CK), bad = s.CK ? s.CK.filter(c => c.status === 'fail').length : 0;
        return [s.name, fl ? `${s.own ? 'entered' : s.design ? 'auto' : 'built-in'}: ${fl.top.n + fl.bot.n + s.R.web.nw} bolts each side` : '—', gv ? `${gv.c.id} ${gv.it.loc}` : s.R && s.R.errors.length ? s.R.errors[0] : '', gv ? R3(gv.it.r, K('spl@' + k, gv.it.step)) : '—',
          q ? { ...R3(q.it.r, K('spl@' + k, q.it.step)), t: `${q.c.id}: ${f(q.it.r, 3)}` } : '—', s.CK ? (bad ? `${bad} check${bad > 1 ? 's' : ''} NG` : 'OK') : 'input error']; })),
      note(`Plates and bolts (Splices input tab): ${B.P.splices && B.P.splices.auto === false ? 'as entered for each station and girder ("entered"); a station without an entry is not auto-designed: it is checked with GirderDetail\'s built-in splice plates and bolts ("built-in")' : 'auto-designed at each station, fewest bolts and then least plate ("auto"), except where an entry exists for that station and girder ("entered")'}. AASHTO LRFD 10th Ed. Art. 6.13.6.1.`)]));
    G.list.forEach((s, k) => { const R = s.R, sc = 'spl@' + k, d = s.p.dem, items = [];
      if (s.warn && s.warn.length) items.push(note(s.warn.join(' '), true));
      items.push(kv([['$M_{DC1}$ / $M_{DC2}$ / $M_{DW}$', `${f(d.MDC1, 1)} / ${f(d.MDC2, 1)} / ${f(d.MDW, 1)} kip-ft`], ['$M_{LL+IM}^{+}$ / $M_{LL+IM}^{-}$', `${f(d.MLLp, 1)} / ${f(d.MLLn, 1)} kip-ft`], ['$M_{CL}$', `${f(d.MCL, 1)} kip-ft`],
        ['$V_{DC1}$ / $V_{DC2}$ / $V_{DW}$ / $V_{LL+IM}$ / $V_{CL}$', `${f(d.VDC1, 1)} / ${f(d.VDC2, 1)} / ${f(d.VDW, 1)} / ${f(d.VLL, 1)} / ${f(d.VCL, 1)} kip`], ['$\\Delta M_{fat}$ + / −', `${f(d.dMp, 1)} / ${f(d.dMn, 1)} kip-ft`]]));
      items.push(note(`Unfactored, per girder; ${s.dm.custom ? `as entered (Custom), row x = ${f(s.dm.xi, 3)} ft.` : `moments at the analysis station x = ${f(s.dm.xi, 2)} ft (Analysis section), shears the largest magnitude of elements ${s.dm.e} ± 1.`}${s.design ? ` Auto-design${s.design.ok ? '' : ' (not every check passes)'}: ${s.design.msg}` : ''}`));
      if (R && !R.errors.length) {
        items.push(note(`Top flange: ${R.fl.top.nl} line(s) each side × ${R.fl.top.nr} rows, outer PL ${SP.frac(R.fl.top.bo)} × ${SP.frac(R.fl.top.to)}${R.fl.top.inner ? `, 2 inner PL ${SP.frac(R.fl.top.bi)} × ${SP.frac(R.fl.top.ti)}` : ''}. Bottom flange: ${R.fl.bot.nl} line(s) × ${R.fl.bot.nr} rows, outer PL ${SP.frac(R.fl.bot.bo)} × ${SP.frac(R.fl.bot.to)}${R.fl.bot.inner ? `, 2 inner PL ${SP.frac(R.fl.bot.bi)} × ${SP.frac(R.fl.bot.ti)}` : ''}. Web: 2 PL ${SP.frac(R.web.hw)} × ${SP.frac(R.web.twp)}, ${R.web.nrw} rows × ${R.web.ncw} column(s) each side. Bolts ${SP.frac(R.bolt.d)} in ${s.p.bolts.gr}; plates ${s.p.sec.gP}.`));
        // DETC (2026-11-10): the figure in the option C style of the tab (ui/gfxdet.js spliceFigure), else the CAD drawing as before
        const cap18 = `${s.name}: flange splice plans and web splice elevation, to scale; the governing plate and bolt group highlighted (as the [[tab:spl|Field splices tab]])`;
        let fg = null; try { const h18 = window.SBDGfxDet && window.SBDVizKit && window.SBDVizKit.scene ? window.SBDGfxDet.spliceFigure(s, 760) : null; if (h18) fg = { type: 'figure', svg: h18, caption: cap18 }; } catch (e) { fg = null; }
        if (!fg) fg = splFig(G => G.splice(s, {}), cap18);
        if (fg) items.push(fg); else { const dw = SP.svg(R); if (dw) items.push({ type: 'figure', svg: dw.flange + dw.web, caption: 'Plan of the bottom flange splice and elevation of the web splice, to scale' }); }   // the simple sketch only without the graphics modules
      } else if (R) items.push(note(R.errors.join(' '), true));
      if (s.CK) { items.push(tbl(['ID', 'Check', 'Governing item', 'Ratio', 'Status', ED], s.CK.map(c => { const it = c.gov >= 0 ? c.items[c.gov] : null;
          return [c.id, tt(c.title), it ? it.loc : c.naWhy || '', it && it.r != null ? R3(it.r, K(sc, it.step)) : { t: '—', key: it ? K(sc, it.step) : null }, STT[c.status] || c.status, String(c.ref).replace('AASHTO LRFD 10th Ed. ', '')]; })));
        items.push(gsteps('SBDSplicesUI:x', sc, window.SBDSplicesUI.stepsOf(B.spl, s), { title: 'Worked steps', lazy: !sg || sg.k !== k })); }   // the governing splice open, the others on demand
      subs.push(sub(sc, s.name, items)); });
    if (G.custom) subs.splice(1, 0, cdSub('spl', B));
    return { title: 'Field splices (bolted, 6.13.6.1)', subs };
  }

  /* ---------- 12. welds (added 2026-10-30, paths PR): ui/welds.js build(), the Welds tab's result ---------- */
  function wd(B, X) {
    const Bw = B.wd, R = Bw.R, C = Bw.C, all = X.detail === 'all', subs = [], WT = window.SBDWelds, STT = { pass: 'OK', fail: 'NG', warn: 'Warning', adv: 'Advisory', na: 'n/a' };
    // a check item's location: its step id is wf<i>.… (flange-to-web weld location i) or wt<i>.… (shop transition i); one scope per location
    const locOf = it => { const m = /^w([ft])(\d+)\./.exec((it && it.step) || ''); return m ? { k: m[1] === 'f' ? 'fw' : 'tr', i: +m[2] } : null; };
    const scOf = q => `wd@${q.k}${q.i}`, keyOf = it => { const q = locOf(it); return q ? K(scOf(q), it.step) : null; };
    const num = it => typeof it.r === 'number' && isFinite(it.r);
    // the engine's notes name a section as "§sec.s" (a group of steps): the report links its first property, ȳ (sec.s.yb)
    const wSteps = q => window.SBDWeldsUI.stepsOf(Bw, q.k, q.i).map(t => (t.note && /§sec\.(s|c3|cn|cr)\b(?!\.\w)/.test(t.note) ? { ...t, note: t.note.replace(/§sec\.(s|c3|cn|cr)\b(?!\.\w)/g, '§sec.$1.yb') } : t));
    // governing rows (2026-11-01, display only): the strength checks first (weld metal FW1, web base metal FW2), then fatigue (FW3, TR1), then
    // the detailing limits (minimum weld size FW4, transition slopes TR2, TR3, proportions TR4), the largest ratio of each group; every item still counts
    const gv = ids => { let b = null; C.filter(c => ids.test(c.id)).forEach(c => c.items.forEach(it => { if (num(it) && (!b || it.r > b.it.r)) b = { c, it }; })); return b; };
    const bad = ids => C.filter(c => ids.test(c.id)).flatMap(c => c.items.filter(it => !num(it) && (it.st === 'fail' || it.st === 'warn')).map(it => ({ c, it })));
    const sel = new Set();
    [[/^FW[12]$/, 'Welds: strength (FW1, FW2)'], [/^(FW3|TR1)$/, 'Welds: fatigue (FW3, TR1)'], [/^(FW4|TR[234])$/, 'Welds: detailing limits (FW4, TR2–TR4)']].forEach(([ids, grp]) => { const q = gv(ids); if (!q) return;
      const L = locOf(q.it); if (L) sel.add(scOf(L));
      X.gov.push({ mod: 'Welds', grp, check: `${q.c.id} ${tt(q.c.title)}`, loc: q.it.loc, r: q.it.r, key: keyOf(q.it), ...(q.it.st === 'warn' ? { status: 'warn' } : {}) });
      bad(ids).forEach(z => X.warn.push(`Welds: ${z.c.id} ${z.it.loc}: ${STT[z.it.st] || z.it.st}.`)); });
    subs.push(sub('gov', `Governing checks, ${gName(Bw.g)}`, [note(`${fromHtml(Bw.what)} Two fillet welds per flange; DC1 and utilities on the steel, DC2 and DW on the long-term (3n), LL+IM and the fatigue shear range on the short-term (n) composite section. $\\gamma_{DC}$ ${f(R.g.dc, 3)}, $\\gamma_{DW}$ ${f(R.g.dw, 3)}, $\\gamma_{LL}$ ${f(R.g.ll, 3)}, $\\gamma_{fat}$ ${f(R.g.fat, 2)}; n = ${f(R.MR.n, 3)}. As on the [[tab:wt|Welds tab]]. ${ED}.`),
      ...(() => { const q = gv(/^FW[12]$/); return q ? [note(`Governing strength check: ${q.c.id} ${tt(q.c.title)}, ${q.it.loc}: ratio ${f(q.it.r, 3)}. The detailing limits (minimum weld size, transitions) are listed after the strength and fatigue checks; the status counts every item.`)] : []; })(),
      tbl(['Check', 'Governing location', 'Ratio', 'Status', 'Reference'], ['FW1', 'FW2', 'FW3', 'TR1', 'FW4', 'TR2', 'TR3', 'TR4'].map(id => C.find(c => c.id === id)).filter(Boolean).concat(C.filter(c => !/^(FW[1-4]|TR[1-4])$/.test(c.id))).map(c => { const it = c.gov >= 0 ? c.items[c.gov] : null;
        return it ? [`${c.id} ${tt(c.title)}`, it.loc, num(it) ? R3(it.r, keyOf(it)) : { t: '—', key: keyOf(it) }, STT[it.st] || it.st, String(c.ref).replace('AASHTO LRFD 10th Ed. ', '')] : [`${c.id} ${tt(c.title)}`, { t: c.naWhy || 'n/a', cls: 'na' }, '—', 'n/a', String(c.ref).replace('AASHTO LRFD 10th Ed. ', '')]; }))]));
    subs.push(sub('fw', `Flange-to-web welds: ${R.fw.length} locations`, [tbl(['Location', 'w (in)', '$v_{u}$ top / bottom (kip/in)', '$R_{r}$ (kip/in)'], R.fw.map(r => ({ cells: [r.name, f(r.w, 4), `${f(r.vuT, 3)} / ${f(r.vuB, 3)}`, N(r.Rw, 3)], cls: sel.has(scOf({ k: 'fw', i: r.i })) ? 'gov' : '' })))]));
    if (R.tr.length) subs.push(sub('tr', `Shop flange transitions: ${R.tr.length}`, [tbl(['Transition', 'Plates (in)', 'Cat.', 'γ(Δf) (ksi)'], R.tr.map(r => ({ cells: [r.name, `${f(r.b1, 2)} × ${f(r.t1, 4)} to ${f(r.b2, 2)} × ${f(r.t2, 4)}`, r.cat, N(r.df, 2)], cls: sel.has(scOf({ k: 'tr', i: r.i })) ? 'gov' : '' })))]));
    // worked steps: the governing locations open; with 'all', every other location on demand (each location's own scope)
    const locs = [...R.fw.map(r => ({ k: 'fw', i: r.i, name: r.name })), ...R.tr.map(r => ({ k: 'tr', i: r.i, name: r.name }))];
    locs.filter(q => sel.has(scOf(q))).forEach(q => subs.push(sub(scOf(q), `${q.name} (governing)`, [gsteps('SBDWeldsUI:x', scOf(q), wSteps(q), { title: 'Worked steps' })])));
    // every item's step that a table links to must be worked here: the governing locations, then (all, or the links of the governing table) the rest on demand
    const need = new Set(C.map(c => (c.gov >= 0 ? locOf(c.items[c.gov]) : null)).filter(Boolean).map(scOf));
    const rest = locs.filter(q => !sel.has(scOf(q)) && (all || need.has(scOf(q))));
    if (rest.length) subs.push(sub('every', all ? 'Every other location' : 'Other governing locations of single checks', rest.map(q => gsteps('SBDWeldsUI:x', scOf(q), wSteps(q), { lazy: true, title: q.name }))));
    if (Bw.custom) subs.splice(1, 0, cdSub('wt', B));   // the entered table (custom demands PR)
    return { title: 'Welds (flange-to-web, shop transitions)', subs };
  }

  /* ---------- 12a. deck slab (DK, 2026-11-23): engine/deck.js calc(), the Deck tab's result; only in a project with the deck design on ---------- */
  const DK_GRP = 'Deck slab (bridge)';
  const dkBar = A => (window.SBDDeck ? window.SBDDeck.barName(A) : f(A, 2) + ' in²');
  function dk(B, X) {
    const R = B.dk, In = R.in, D = R.D, k = id => K('', id), many = R.bays.length > 1, st = c => (c.ok ? 'OK' : 'NG');
    R.checks.forEach(c => X.gov.push({ mod: 'Deck', grp: DK_GRP, check: `${c.id} ${c.title}`, loc: c.loc, r: c.r, key: k(c.step) }));
    R.warn.forEach(w => X.warn.push('Deck: ' + w));
    const fig = window.SBDDeckUI && window.SBDDeckUI.figure ? (() => { try { return { type: 'figure', svg: window.SBDDeckUI.figure(R, 700), caption: 'Deck section over the left exterior girder and the first bay (true scale across): the traffic face, the design wheel 1 ft inside it, the negative-moment design sections, the top and bottom transverse bars. Display only.' }; } catch (e) { return null; } })() : null;
    const subs = [sub('gov', 'Checks of the deck slab (the bridge\'s deck: the same in every girder\'s report)', [
      note(`Transverse design of the slab per foot of deck by the strip method, as the [[tab:dk|Deck tab]] (the method of the Prestressed Bridge Design app's deck module). Strength I${In.eta !== 1 || In.mLL !== 1 ? ` with the owner's $\\eta$ = ${f(In.eta, 3)}${In.mLL !== 1 ? ` and m = ${f(In.mLL, 2)}` : ''}` : ''}. Interior bays: dead load by $wS^{2}/11$ and $wS^{2}/10$, live load from Table A4-1; overhangs: gravity loads only. ${ED}.`),
      tbl(['Check', 'Governing location', '$M_{u}$ (kip-ft/ft)', '$\\phi M_{n}$ (kip-ft/ft)', 'Ratio', 'Status', 'Reference'], R.checks.map(c => ({ cells: [`${c.id} ${c.title}`, c.loc, N(c.Mu, 2), N(c.phiMn, 2), R3(c.r, k(c.step)), st(c), String(c.ref).replace('AASHTO LRFD 10th Ed. ', '')], cls: c.r > 1 + 1e-9 ? 'gov' : '' })), { wide: true }),
      note('Not checked by this module: the Extreme Event II vehicular-collision cases of the overhang (A13.4; a barrier-specific analysis), crack control (5.6.7), minimum reinforcement (5.6.3.3), temperature and shrinkage reinforcement (5.10.6), bar development.', true),
      ...R.warn.map(w => note(w, true)), fig]),
      sub('in', 'Values used', [kv([
        ['Girder spacings S (Cross-section tab)', R.bays.map(q => `${f(q.S, 2)} ft`).join(', ')],
        ['Overhangs $o_{h}$, left / right (Cross-section tab)', `${f(R.oh.L.O.oh, 2)} / ${f(R.oh.R.O.oh, 2)} ft`, k('dk.ohL.X')],
        ['Deck edge to the traffic face, left / right (as the Cross-section & loads section)', `${f(R.oh.L.O.face, 2)} / ${f(R.oh.R.O.face, 2)} ft`, k('dk.ohL.X')],
        ['Structural slab $t_{s}$ / total thickness for dead load (Cross-section tab)', `${f(In.ts, 2)} / ${f(In.tL, 2)} in`, k('dk.b1.wDC')],
        ["$f'_{c}$, $w_{c}$, $F_{yr}$ (Materials tab)", `${f(In.fc, 2)} ksi, ${f(In.wc, 3)} kcf, ${f(In.fy, 0)} ksi`],
        ['Wearing surface and overlays $w_{DW}$ (Loads tab)', `${f(In.wDW, 4)} ksf`, k('dk.b1.wDW')],
        [`Narrowest top flange $b_{f}$ (${In.bfAt})`, `${f(In.bf, 2)} in`],
        [`Negative-moment design section x (${In.auto ? '$b_{f}/4$, Art. 4.6.2.1.6' : 'entered'})`, `${f(In.xneg, 2)} in`, k('dk.b1.xneg')],
        ['Top transverse bars (Cross-section tab, Deck design)', `${dkBar(+D.barTop)} at ${f(+D.sTop, 2)} in, clear cover ${f(+D.coverT, 2)} in`, k('dk.neg.As')],
        ['Bottom transverse bars (Cross-section tab, Deck design)', `${dkBar(+D.barBot)} at ${f(+D.sBot, 2)} in, clear cover ${f(+D.coverB, 2)} in`, k('dk.pos.As')]])]),
      sub('bay', 'Interior bays: moments per foot of deck', [tbl(['Bays', 'Moment', '$M_{DC}$', '$M_{DW}$', '$M_{LL+IM}$ (Table A4-1)', '$M_{u}$', '$\\phi M_{n}$', 'Ratio'], [].concat(...R.bays.map((q, i) => { const I = q.I, b = `dk.b${i + 1}.`;
        return [{ cells: [q.name, `Positive, bottom bars${many && i === R.gp ? ' (governs)' : ''}`, N(I.MDC_pos, 3), N(I.MDW_pos, 3), N(I.MLL_pos, 3), { t: f(I.Mu_pos, 3), n: true, key: k(b + 'Mup') }, N(q.pos.phiMn, 2), R3(q.pos.dc, k(i === R.gp ? 'dk.pos.r' : b + 'pos.r'))], cls: i === R.gp ? 'gov' : '' },
          { cells: [q.name, `Negative at the design section, top bars${many && i === R.gn ? ' (governs)' : ''}`, N(I.MDC_neg, 3), N(I.MDW_neg, 3), N(I.MLL_neg, 3), { t: f(I.Mu_neg, 3), n: true, key: k(b + 'Mun') }, N(q.neg.phiMn, 2), R3(q.neg.dc, k(i === R.gn ? 'dk.neg.r' : b + 'neg.r'))], cls: i === R.gn ? 'gov' : '' }]; })), { wide: true, caption: 'kip-ft per foot of deck; the tabulated live-load moments include the multiple presence factors and the dynamic load allowance' })]),
      sub('oh', 'Overhangs (gravity loads)', [tbl(['Side', '$o_{h}$ (ft)', 'X (ft)', 'Strip (in)', '$M_{DC}$', '$M_{DW}$', '$M_{LL+IM}$ wheel', '$M_{PL}$', '$M_{u}$', '$\\phi M_{n}$', 'Ratio'], ['L', 'R'].map(sd => { const q = R.oh[sd], O = q.O, b = `dk.oh${sd}.`;
        return { cells: [q.name, N(O.oh, 2), { t: f(O.Xoh, 3), n: true, key: k(b + 'X') }, N(O.SWoh, 1), { t: f(O.MohDC, 3), n: true, key: k(b + 'MohDC') }, N(O.MohDW, 3), N(O.MohLL, 3), O.PL.length ? N(O.MohPL, 3) : '—', { t: f(O.Mu_oh, 3), n: true, key: k(b + 'Muoh') }, N(q.cap.phiMn, 2), R3(q.cap.dc, k(b + 'cap.r'))], cls: sd === R.go ? 'gov' : '' }; }), { wide: true, caption: 'kip-ft per foot about the exterior girder centreline; one 16 kip wheel 1 ft inside the traffic face, IM 1.33, multiple presence 1.20; a pedestrian load on the overhang is taken with the wheel' }),
        note('Gravity loads only: the Extreme Event II vehicular-collision cases (A13.4) are not checked.', true)]),
      sub('dist', 'Distribution reinforcement (Art. 9.7.3.2)', [kv([['Bottom bars parallel to the girders', `${f(R.dist.pct, 1)} % of the positive-moment steel = ${f(R.dist.As, 3)} in²/ft of deck width`, k('dk.dist')],
        ['Effective span length $S_{eff}$ (Art. 9.7.2.3)', R.dist.E && R.dist.E.ok ? `${f(R.dist.Seff, 3)} ft (S = ${f(R.dist.S, 2)} ft; $b_{f}$ = ${f(R.dist.bf, 2)} in, $t_{w}$ = ${f(R.dist.tw, 4)} in, ${R.dist.at})` : 'not available: 67 % used', R.dist.E && R.dist.E.ok ? k('dk.distSe') : '']])]),
      sub('steps', 'Worked steps', [gsteps('SBDDeckUI:x', '', R.steps, { title: 'Worked steps: deck slab' })])];
    return { title: 'Deck slab (transverse design)', subs };
  }
  /* bomDeck(P, R): the deck reinforcement of the Deck section (DK): the transverse bars over the bridge length and the distribution steel,
     as the Prestressed Bridge Design app's bill of materials. Rebar, not structural steel: not in the steel totals. */
  function bomDeck(P, R) {
    if (!R || R.err || !R.in) return null;
    const D = R.D, Lt = ((P.spans || {}).lengths || []).reduce((a, x) => a + (+x || 0), 0), Wd = R.in.Wd, SW = 490 / 144, rows = [];
    const bar = (lab, Ab, sp) => { if (!(sp > 0) || !(Ab > 0)) return 0; const n = Math.ceil(12 * Lt / sp) + 1, w = n * Wd * Ab * SW; rows.push([lab, `${dkBar(Ab)} (${f(Ab, 2)} in²) at ${f(sp, 2)} in`, { t: String(n), n: true }, N(Wd, 2), N(w, 0)]); return w; };
    let tot = bar('Top transverse bars', +D.barTop, +D.sTop) + bar('Bottom transverse bars', +D.barBot, +D.sBot);
    const wd = R.dist.As * Wd * Lt * SW; tot += wd; rows.push(['Distribution (bottom, parallel to the girders)', `${f(R.dist.pct, 1)} % of the bottom transverse steel = ${f(R.dist.As, 3)} in²/ft of width`, '—', N(Lt, 2), N(wd, 0)]);
    rows.push(['Total', '', '', '', N(tot, 0)]);
    return sub('dk', 'Deck reinforcement (Deck tab; rebar, not in the steel totals)', [
      note(`The transverse bars of the deck design and its distribution reinforcement: number of transverse bars = ⌈12 L / s⌉ + 1 over the bridge length L = ${f(Lt, 2)} ft, each of the deck width ${f(Wd, 2)} ft; weight = number × length × $A_{b}$ × 490/144 lb/ft. Distribution steel: its area per foot of deck width × the deck width × L × 490/144. Laps, hooks, bends and skewed ends are not added; the top longitudinal bars, any additional overhang bars and the deck concrete are not included.`),
      tbl(['Bars', 'Size and spacing', 'Number', 'Length (ft)', 'Weight (lb)'], rows)]);
  }

  /* ---------- 13. load rating ---------- */
  const GRP = [['flexP', 'Flexure, positive (Strength I)'], ['flexN', 'Flexure, negative (Strength I)'], ['shear', 'Shear (Strength I)'], ['svc', 'Service II (permanent deformation)'], ['fat', 'Fatigue (owner target only)']];
  function rt(B, X) {
    const R = B.rating, s = R.sum, all = X.detail === 'all', subs = [], rk = q => 'rt@' + R.rows.indexOf(q), rfStep = q => (q.steps.find(t => /(^|\.)inv$/.test(t.id)) || q.steps[q.steps.length - 1] || {}).id;
    let nCap = 0; const capOf = q => { const r = R.cap.get(q); if (!r) return { sc: null, item: null }; let sc = X.have.get(r), item = null;
      if (!sc) { sc = 'rtcap@' + (nCap++); X.have.set(r, sc); item = gsteps(q.kind === 'shear' ? 'SBDShearUI:loc' : 'SBDFlexureUI:x', sc, (q.kind === 'shear' ? window.SBDShearUI.stepsOf(R.shear, 'loc', r) : window.SBDFlexureUI.stepsOf(R.flex, r)) || [], { lazy: true, title: `Capacity: ${q.kind === 'shear' ? 'shear' : 'flexure'} at ${r.name}` }); }
      return { sc, item }; };
    const gi = s.gov.inv, go = s.gov.opr, rf = v => !isFinite(v) ? '—' : f(v, 2), rcls = v => !isFinite(v) ? '' : v < 1 - 1e-9 ? 'ng' : v < 1.1 ? 'hi' : 'ok';
    if (gi) X.gov.push({ mod: 'Rating', grp: 'Rating: Inventory RF', check: `Inventory RF, ${tt(gi.title)}`, loc: gi.name, rf: gi.inv, key: K(rk(gi), rfStep(gi)) });
    if (go) X.gov.push({ mod: 'Rating', grp: 'Rating: Operating RF', check: `Operating RF, ${tt(go.title)}`, loc: go.name, rf: go.opr, key: K(rk(go), rfStep(go)) });
    const sel = [...new Set([gi, go, ...GRP.map(([k]) => s.by[k])].filter(q => q && !q.oos))];
    subs.push(sub('gov', 'Governing rating factors (HL-93 design load)', [note(`${fromHtml(R.what)} LRFR (MBE 6A.4.2): RF = (C − $\\gamma_{DC}$DC − $\\gamma_{DW}$DW ± $\\gamma_{P}$P)/($\\gamma_{LL}$(LL+IM)), flexure C = $\\phi_{c}\\phi_{s}\\phi R_{n}$ with $\\phi_{c}\\phi_{s}$ ≥ 0.85; shear C = $\\phi_{c}\\phi_{v}V_{n}$ ($\\phi_{s}$ = 1.0 for shear, MBE 4th Ed. Art. 6A.4.2.4, p. 6-25); Service II C = $f_{R}$ = 0.95$F_{yf}$ for composite sections (no $R_{h}$) and 0.80$R_{h}F_{yf}$ for noncomposite (Art. 6A.6.4.2.2, p. 6-66); Strength I $\\gamma_{LL}$ 1.75 Inventory, 1.35 Operating; Service II 1.30 / 1.00 (Table 6A.4.2.2-1). $\\phi_{c}$ = ${f(B.P.rating ? B.P.rating.phiC : 1, 2)}, $\\phi_{s}$ = ${f(B.P.rating ? B.P.rating.phiS : 1, 2)}. As on the [[tab:rt|Rating tab]].`),
      R.ph.floor ? note(`$\\phi_{c}\\phi_{s}$ = ${f(R.ph.prod, 3)} < 0.85: 0.85 is used at the Strength limit state (MBE Eq. 6A.4.2.1-3).`, true) : null,
      s.oos ? note('A positive-flexure location has its plastic neutral axis below the web: its flexure is not rated (out of scope).', true) : null,
      tbl(['Group', 'Governing location and check', 'Inventory RF', 'Operating RF'], GRP.filter(([k]) => s.by[k]).map(([k, t]) => { const q = s.by[k]; return [t, `${q.name}: ${tt(q.title)}`, { t: rf(q.inv), cls: rcls(q.inv), n: true, key: K(rk(q), rfStep(q)) }, q.kind === 'fat' ? '—' : { t: rf(q.opr), cls: rcls(q.opr), n: true }]; })),
      s.target && s.tgt && s.tgt.inv ? note(`Owner design rating target (${s.target.cite}): HL-93 Inventory ${rf(s.tgt.inv.rf)} ${s.tgt.inv.pass ? '≥' : '<'} ${f(s.tgt.inv.need, 2)} (reported; the girder is not resized for it).`, !s.tgt.inv.pass) : null]));
    const caps = [];
    sel.forEach(q => { const c = capOf(q); if (c.item) caps.push(c.item);
      subs.push(sub(rk(q), `${q.name}: ${tt(q.title)}${q === gi ? ' (governing Inventory)' : ''}${q === go && q !== gi ? ' (governing Operating)' : ''}`, [
        tbl(['C', 'DC', 'DW', 'LL+IM', 'Unit', 'RF Inventory', 'RF Operating'], [[N(q.C, q.unit === 'ksi' ? 2 : 1), N(q.DC, q.unit === 'ksi' ? 2 : 1), N(q.DW, q.unit === 'ksi' ? 2 : 1), N(q.LL, q.unit === 'ksi' ? 2 : 1), q.unit || '', { t: rf(q.inv), cls: rcls(q.inv), n: true }, q.kind === 'fat' ? '—' : { t: rf(q.opr), cls: rcls(q.opr), n: true }]]),
        c.sc ? note(`$R_{n}$ is worked at ${R.cap.get(q).name}: [[${K(c.sc, (R.cap.get(q).steps || [{}])[0].id)}]].`) : null,
        gsteps('SBDRatingUI:x', rk(q), q.steps, { see: c.sc, title: `Rating (${window.SBDRating.MBE})` })])); });
    if (all) { const rest = R.rows.filter(q => !q.oos && !sel.includes(q));
      subs.push(sub('all', 'Rating factors at every location', [tbl(['Location', 'Check', 'C', 'DC', 'DW', 'LL+IM', 'Unit', 'RF Inv.', 'RF Opr.'], R.rows.map(q => q.oos ? [q.name, { t: q.title, cls: 'na', span: 8 }] : { cells: [q.name, tt(q.title), N(q.C, q.unit === 'ksi' ? 2 : 1), N(q.DC, q.unit === 'ksi' ? 2 : 1), N(q.DW, q.unit === 'ksi' ? 2 : 1), N(q.LL, q.unit === 'ksi' ? 2 : 1), q.unit || '',
        { t: rf(q.inv), cls: rcls(q.inv), n: true, key: K(rk(q), rfStep(q)) }, q.kind === 'fat' ? '—' : { t: rf(q.opr), cls: rcls(q.opr), n: true }], cls: q === gi ? 'gov' : '' })),
        ...rest.map(q => { const c = capOf(q); if (c.item) caps.push(c.item); return gsteps('SBDRatingUI:x', rk(q), q.steps, { see: c.sc, lazy: true, title: `${q.name}: ${tt(q.title)}, RF ${rf(q.inv)} / ${rf(q.opr)}` }); })])); }
    // legal-load and permit rating (2026-11-23; ui/rating.js buildVeh): one table, then each vehicle's governing rating worked (its live load, γ_LL,
    // RF, rated load and posting) with the capacity of its location (the vehicle's own flexure / shear build)
    if (R.veh && !R.veh.only) { const V = R.veh, RU = window.SBDRatingUI, ok = V.list.filter(v => v.rows), vk = (v, q) => `rtv.${V.list.indexOf(v)}@${v.rows.indexOf(q)}`, g4 = x => f(x, 4).replace(/(\.\d\d)0+$/, '$1');
      ok.forEach(v => { if (v.gov) X.gov.push({ mod: 'Rating', grp: 'Rating: Legal and permit RF', check: `${v.short} RF, ${tt(v.gov.title)}`, loc: v.gov.name, rf: v.rf, key: K(vk(v, v.gov), rfStep(v.gov)) }); });
      subs.push(sub('veh', `Legal-load and permit rating (${ok.length} vehicle${ok.length === 1 ? '' : 's'})`, [
        note(`Each vehicle is run on this app's line-girder model (the live-load stiffness and stations of the [[tab:an|Analysis tab]]) and rated by ${window.SBDRating.MBE} Eq. 6A.4.2.1-1 with the capacities, $\\phi_{c}$, $\\phi_{s}$, $\\gamma_{DC}$ 1.25 and $\\gamma_{DW}$ 1.50 of the design-load rating: one rating factor per vehicle; legal loads at Strength I with $\\gamma_{LL}$ by ADTT (Tables 6A.4.4.2.3a-1, 6A.4.4.2.3b-1), permit loads at Strength II (Table 6A.4.5.4.2a-1), Service II with $\\gamma_{LL}$ 1.30 (legal) or 1.00 (permit) (Table 6A.4.2.2-1); IM on the axles (Arts. 6A.4.4.3, 6A.4.5.5); fatigue is not rated for these loads. ADTT (one direction) = ${V.adtt == null ? 'unknown' : f(V.adtt, 0)}. Rated load RT = RF × W (Art. 6A.4.4.4); posting by Eq. 6A.8.3-1 for the AASHTO legal loads, the lane-type model (W = 80 kip) and the specialized hauling vehicles.${V.pedIn ? ' The pedestrian load is added to each vehicle\'s live load, as in the design-load rating.' : ''} A rating factor below 1.0 counts as FAIL in the verdict, as the HL-93 rating factors do. As on the [[tab:rt|Rating tab]].`),
        ...V.err.map(e => note(e, true)),
        V.laneWarn ? note('MBE Art. 6A.4.4.2.1a calls for the lane-type legal load model on this girder (a continuous span or a span longer than 200 ft) together with the AASHTO legal loads: it is not selected, so negative moment and the interior reactions are rated for the single trucks only.', true) : null,
        ...V.list.filter(v => v.cat === 'permit' && v.rows).map(v => note(`${v.short}: ${v.laneWhy || ''}${v.VLs ? ' Service II is rated with the design distribution factor (the permit mixes with traffic; MBE C6A.6.4.2.2); Strength II with the one-lane factor.' : ''}`)),
        tbl(['Vehicle', 'W (tons)', 'IM (%)', '$\\gamma_{LL}$', 'DF', ...RU.VGRP.map(q => q[1]), 'Governing RF', 'Governing check and location', 'RT (tons)', 'Posting / acceptance'], V.list.map(v => v.rows ? [v.short, v.tons != null ? f(v.tons, 2) : '—', f(v.im, 0), g4(v.gam), RU.dfCell(v),
          ...RU.VGRP.map(([k]) => { const q = v.by[k]; return q ? { t: rf(q.inv), cls: rcls(q.inv), n: true } : '—'; }), v.gov ? { t: rf(v.rf), cls: rcls(v.rf), n: true, key: K(vk(v, v.gov), rfStep(v.gov)) } : '—', v.gov ? `${tt(v.gov.title)}, ${v.gov.name} (${v.gov.lim})` : 'no live-load effect', v.rated != null ? N(v.rated, 1) : '—', RU.postText(v)]
          : [v.short, v.tons != null ? f(v.tons, 2) : '—', { t: v.na || v.err || '', cls: 'na', span: 8 + RU.VGRP.length }])),
        note(`Live-load factors: ${[...new Set(ok.map(v => `${v.short}: ${v.gRef}`))].join('. ')}.`)]));
      ok.forEach(v => { const q = v.gov; if (!q) return; const r = v.cap.get(q), sc = 'rtvcap@' + (nCap++), ts = RU.vehSteps(v);
        const capItem = r ? gsteps(q.kind === 'shear' ? 'SBDShearUI:loc' : 'SBDFlexureUI:x', sc, (q.kind === 'shear' ? window.SBDShearUI.stepsOf(v.shear, 'loc', r) : window.SBDFlexureUI.stepsOf(v.flex, r)) || [], { lazy: true, title: `Capacity with the ${v.short} demands: ${q.kind === 'shear' ? 'shear' : 'flexure'} at ${r.name}` }) : null;
        subs.push(sub(vk(v, q), `${v.short}: ${q.name}, ${tt(q.title)} (governing)`, [
          note(`${v.label}. ${v.lim} $\\gamma_{LL}$ = ${g4(v.gam)}; IM ${f(v.im, 0)} %; ${v.df === 'one' ? `one-lane distribution factor without the multiple presence factor${v.dfS === 'multi' ? ' at Strength II, the design distribution factor at Service II (MBE C6A.6.4.2.2)' : ''}` : 'design distribution factor'} (worked on the [[tab:loads|Loads & LLDF tab]]).`),
          tbl(['C', 'DC', 'DW', 'LL+IM', 'Unit', 'RF', 'RT (tons)'], [[N(q.C, q.unit === 'ksi' ? 2 : 1), N(q.DC, q.unit === 'ksi' ? 2 : 1), N(q.DW, q.unit === 'ksi' ? 2 : 1), N(q.LL, q.unit === 'ksi' ? 2 : 1), q.unit || '', { t: rf(q.inv), cls: rcls(q.inv), n: true }, v.rated != null ? N(v.rated, 1) : '—']]),
          gsteps('SBDRatingUI:x', vk(v, q), q.steps, { see: r ? sc : null, title: `Rating (${window.SBDRating.MBE})` }),
          ts.length ? gsteps('SBDRatingUI:v', vk(v, q) + 't', ts, { title: 'Rated load and posting' }) : null, capItem])); }); }
    if (caps.length) subs.push(sub('cap', 'Capacities used by the rating (worked here: not shown in an earlier section of this report)', caps));
    if (R.custom) { subs.push(cdSub('flex', B)); subs[subs.length - 1].id = 'cdf'; subs.push(cdSub('shear', B)); subs[subs.length - 1].id = 'cds'; }   // the tables the rating took (custom demands PR)
    return { title: R.veh && !R.veh.only ? 'Load rating (LRFR: design, legal and permit loads)' : 'Load rating (LRFR, design load)', subs };
  }

  /* ---------- 1. summary ---------- */
  /* the summary graphic (tab graphics B, engine/tabgraphics-b.js): a small girder elevation with the governing check of each group at its location, in the
     Drawings-tab format, as a static SVG figure (display only: the rows of the table below); none when the graphics modules are not loaded */
  function summaryFig(B, X) {
    const G = window.SBDTabGfxB, D = window.SharedDxf; if (!G || !D || !window.SBDGraphics) return null;
    // SBVZB (2026-11-10): the figure in the data-viz style (ui/alonggfx.js summarySvg: static SVG with its style inside, prints grey / hatched); the old drawing without it
    const AG = window.SBDAlongGfx, sv = AG && window.SBDVizAlong ? AG.summarySvg({ gov: X.gov }, B.P, B.g) : '';
    if (sv) return { type: 'figure', svg: sv, caption: `Governing check of each group along girder ${gName(B.girder)} (the rows of the table below; ratio, or rating factor RF). Green below 0.90, amber 0.90 to 1.00, red above 1.00 or NG (RF below 1.0); not to scale vertically.` };
    try { const g = G.summary({ gov: X.gov }, B.P, { gi: B.g }); return { type: 'figure', svg: (window.SBDGraphics && window.SBDGraphics.tightSvg ? window.SBDGraphics.tightSvg : (DD, o) => D.toSVG(DD, o))(g.D, { i0: g.i0, i1: g.i1, bg: '#fff', title: g.title, width: '100%' }), caption: `Governing check of each group along girder ${gName(B.girder)} (the rows of the table below; ratio, or rating factor RF).` }; }
    catch (e) { return null; }
  }
  function summary(B, X, built) {
    const rows = X.gov.map(q => q.rf != null
      ? { cells: [q.mod, q.check, q.loc, { t: `RF ${isFinite(q.rf) ? f(q.rf, 2) : '—'}`, n: true, cls: !isFinite(q.rf) ? '' : q.rf < 1 - 1e-9 ? 'ng' : q.rf < 1.1 ? 'hi' : 'ok', key: q.key }, isFinite(q.rf) ? (q.rf >= 1 - 1e-9 ? 'OK' : 'RF < 1') : '—'] }
      : { cells: [q.mod, q.check, q.loc, R3(q.r, q.key), q.status === 'warn' ? 'Warning' : okT(q.r)], cls: q.r > 1 + 1e-9 ? 'gov' : '' });
    const errs = Object.entries(B.err).filter(([k]) => built.includes(k) || k === 'all');
    const top = X.gov.filter(q => q.rf == null && isFinite(q.r)).reduce((a, q) => (!a || q.r > a.r ? q : a), null);
    // F6 (2026-11-19): span-to-depth guidance, informational only (engine/autodesign.js depthFlag; not a check, not in any ratio or status)
    // SA4 (2026-11-19): applicability of the line-girder analysis (engine/analysis.js applicability), near the front with its worked steps
    let AP = null; try { AP = window.SBDAnalysis && window.SBDAnalysis.applicability ? window.SBDAnalysis.applicability(B.P) : null; } catch (e) { AP = null; }
    const apLv = { fail: 'FAIL: refined analysis required', warn: 'WARNING: line-girder results approximate; a 2D grid or 3D analysis is recommended', note: 'NOTE: skew effects a line-girder analysis cannot compute' };
    const apNote = AP && AP.level !== 'ok' ? note(`Applicability of the line-girder analysis (SA4): ${['fail', 'warn', 'note'].filter(k => AP.items.some(q => q.level === k)).map(k => `${apLv[k]} (${AP.items.filter(q => q.level === k).map(q => `${q.title}, ${q.val}${q.step ? ` [[${q.step}]]` : ''}`).join('; ')})`).join('. ')}. ${AP.level === 'fail' ? 'A FAIL counts in the Summary tab\'s verdict.' : 'Warnings and notes do not change the verdict.'}`, AP.level !== 'note') : null;
    const apSub = AP ? sub('ap', 'Applicability of the line-girder analysis (SA4; 4.6.2.2, C6.10.1)', [tbl(['Item', 'This bridge', 'Result', 'Status'], AP.items.map(q => [q.title, q.val, q.msg, { fail: 'FAIL', warn: 'WARNING', note: 'NOTE', ok: 'OK' }[q.level]])), steps('', AP.steps)]) : null;
    const DF = window.SBDAutoDesign && window.SBDAutoDesign.depthFlag ? window.SBDAutoDesign.depthFlag(B.P, B.g) : null;
    const dfNote = DF ? note(`Note (informational, not in the verdict): ${DF.flagged ? 'below optional AASHTO depth guidance' : 'meets the optional AASHTO depth guidance'} (Art. 2.5.2.6.3, Table 2.5.2.6.3-1; optional criteria, e.g. clearance-limited structures may be shallower) [[dg.${DF.comp ? 'O' : 'I'}]].`) : null;
    const dfSub = DF ? sub('depth', 'Span-to-depth guidance (informational; Art. 2.5.2.6.3, optional criteria)', [note(DF.text.replace(/≤/g, '$\\le$').replace(/ > /g, ' $>$ ')),
      note('Optional criteria: they apply where the owner invokes span-to-depth controls (2.5.2.6.3); a structure may be shallower, e.g. where clearance limits the depth. Shown for information: not a check, not counted in any ratio, status or verdict.'), steps('', DF.steps)]) : null;
    return { title: 'Summary of governing ratios', subs: [sub('gov', `Girder ${gName(B.girder)}: governing demand / capacity of each check group`, [
      apNote,
      note(`Each ratio links to the step that works it. Ratio = demand / capacity (OK ≤ 1.0); rating factors RF (OK ≥ 1.0). Demands: ${B.src === 'file' ? `the hand-off file ${B.plName || ''} for flexure, shear, fatigue, constructibility and rating; this project for the rest` : B.custom ? `entered on the tab (Custom) for ${cdMods(B)}; this project's analysis for the rest` : "this project's analysis"}. ${ED}.`),
      top ? note(`Largest ratio: ${f(top.r, 3)} (${top.mod}, ${top.check}, ${top.loc})${top.key ? ` [[${top.key}]]` : ''}.`) : null,
      note('Every girder at once, with the overall verdict and a link from each value to the tab that works it: the [[tab:sum|Summary tab]]. There a rating factor RF < 1.0 counts as FAIL, and a check with a Warning status (welds, cross-frames, deflection over the owner\'s preferred limit) as REVIEW.'),   // Summary tab (2026-11-09)
      summaryFig(B, X),
      tbl(['Module', 'Check', 'Location', 'Ratio / RF', 'Status'], rows, { wide: true }),
      ...X.warn.map(w => note(w, true)),
      dfNote,
      errs.length ? note('Not in this report: ' + errs.map(([k, v]) => `${(SECTIONS.find(s => s[0] === k) || [k, k])[1]}: ${v}`).join('; '), true) : null]), apSub, dfSub].filter(Boolean) };
  }


  /* ---------- PR3 (2026-11-19, engineer's request; report and presentation only: every value below is a value a module computes, shown again
     and linked to the step that works it; nothing new is calculated except the steel bill of materials' weights, worked in its table) ---------- */
  const FXC = id => /^GS1[23]$/.test(id) ? 'svc' : /^GS([1-4]|22)$/.test(id) ? 'prop' : 'str';   // report/summary.js FLEX_CLS
  const grv = r => (isFinite(r) ? r : Infinity);
  /* banner(text, kind): the verdict as a print-safe SVG box (black on white: border weight and the word carry the status) */
  const banner = (t, sub2) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 74" width="100%" role="img" aria-label="${t}"><rect x="2" y="2" width="636" height="70" fill="#fff" stroke="#000" stroke-width="${t === 'PASS' ? 2 : 5}"${t === 'PASS WITH NOTES' || t === 'REVIEW' ? ' stroke-dasharray="14 6"' : ''}/><text x="320" y="40" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700" fill="#000">${t}</text><text x="320" y="62" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="12" fill="#000">${sub2}</text></svg>`;
  /* exec(B, X): Executive summary (first section): verdict, governing D/C, one row per limit state / check group, the items not in the verdict */
  function exec(B, X) {
    const rows = [], Gr = B.flex, scOf = r => 'flex@' + Gr.rows.indexOf(r), G = gName(B.girder), wk = r => (!X.on || X.on('flex')) && X.have.has(r) && (X.detail !== 'all' || r === Gr.gov), sumOn = !X.on || X.on('sum');   // linked where the location's steps are written out
    if (Gr && !Gr.err && Gr.rows) {
      const cats = [['strP', 'Flexure, Strength I, positive moment (M+)', r => r.pos], ['strN', 'Flexure, Strength I, negative moment (M−)', r => !r.pos], ['svc', 'Flexure, Service II (GS12, GS13)', () => true], ['prop', 'Cross-section proportions (GS1–GS4)', () => true]];
      cats.forEach(([k, t, inR]) => { let b = null; Gr.rows.forEach(r => { if (!inR(r)) return; r.checks.forEach(c => { if (!(c.inUse && c.na == null && c.ratio !== undefined)) return; const cl = FXC(c.id); if ((k === 'strP' || k === 'strN') ? cl !== 'str' : cl !== k) return; if (!b || grv(c.ratio) > grv(b.c.ratio) || (grv(c.ratio) === grv(b.c.ratio) && r === Gr.gov && c === Gr.gov.gov)) b = { r, c }; }); });   // a tie: the Flexure section's governing location
        if (b) rows.push({ cat: t, check: `${b.c.id} ${tt(b.c.title)}`, loc: at(b.r, 2) + (wk(b.r) ? '' : X.on && !X.on('flex') ? ' (section not included)' : ' (Flexure section, results table)'), r: b.c.ratio, key: wk(b.r) ? K(scOf(b.r), b.c.step) : null }); });   // linked where the location is worked in this report
    }
    X.gov.forEach(q => { if (q.mod === 'Flexure') return; rows.push({ cat: q.grp || q.mod, check: q.check, loc: q.loc, r: q.r, rf: q.rf, key: q.key, status: q.status }); });
    const st = q => q.rf != null ? (!isFinite(q.rf) ? 'REVIEW' : q.rf < 1 - 1e-9 ? 'FAIL' : 'OK') : !isFinite(q.r) ? 'REVIEW' : q.r > 1 + 1e-9 ? 'FAIL' : q.status === 'warn' ? 'Warning' : 'OK';
    let AP = null; try { AP = window.SBDAnalysis && window.SBDAnalysis.applicability ? window.SBDAnalysis.applicability(B.P) : null; } catch (e) { AP = null; }
    let DF = null; try { DF = window.SBDAutoDesign && window.SBDAutoDesign.depthFlag ? window.SBDAutoDesign.depthFlag(B.P, B.g) : null; } catch (e) { DF = null; }
    const nFail = rows.filter(q => st(q) === 'FAIL').length + (AP && AP.level === 'fail' ? 1 : 0), nRev = rows.filter(q => st(q) === 'REVIEW' || st(q) === 'Warning').length;
    const out = [];   // not in the verdict
    if (DF) out.push([`Span-to-depth guidance (Art. 2.5.2.6.3, optional criteria)`, DF.flagged ? 'below optional AASHTO depth guidance' : 'meets the optional guidance', DF.rows.map(q => `${q.k}L = ${f(q.need, 2)} in vs ${f(q.have, 2)} in`).join('; '), sumOn ? `dg.${DF.comp ? 'O' : 'I'}` : null]);
    if (AP) AP.items.filter(q => q.level === 'warn' || q.level === 'note').forEach(q => out.push([`Applicability of the line-girder analysis (SA4): ${q.title}`, q.level === 'warn' ? 'WARNING' : 'NOTE', `${q.val}: ${q.msg}`, sumOn ? q.step : null]));
    X.warn.forEach(w => out.push(['Warning', 'Warning', w, null]));
    const notes = out.some(q => q[1] !== 'meets the optional guidance') || nRev > 0;
    const verdict = nFail ? 'FAIL' : notes ? 'PASS WITH NOTES' : 'PASS';
    const top = rows.filter(q => q.rf == null).reduce((a, q) => (!a || grv(q.r) > grv(a.r) ? q : a), null), low = rows.filter(q => q.rf != null && isFinite(q.rf)).reduce((a, q) => (!a || q.rf < a.rf ? q : a), null);
    const items = [{ type: 'figure', plain: true, svg: banner(verdict, `Girder ${G}: ${nFail} FAIL, ${nRev} REVIEW / warning, ${rows.length - nFail - nRev + (AP && AP.level === 'fail' ? 1 : 0)} OK of ${rows.length} check groups${AP && AP.level === 'fail' ? ' + analysis applicability FAIL' : ''}`), caption: 'Verdict of this girder: FAIL where any check group exceeds 1.0 (or a rating factor is below 1.0) or the line-girder analysis is not applicable (SA4 FAIL); PASS WITH NOTES where a check has a warning, a ratio is not a number (REVIEW) or an item below is flagged; else PASS.' },
      top ? note(`Governing D/C: ${f(top.r, 3)} (${top.cat}; ${top.check}, ${top.loc})${top.key ? ` [[${top.key}]]` : ''}.${low ? ` Lowest rating factor: ${f(low.rf, 2)} (${low.check}, ${low.loc})${low.key ? ` [[${low.key}]]` : ''}.` : ''}`) : null,
      AP && AP.level === 'fail' ? note(`Line-girder analysis not applicable (SA4 FAIL): ${AP.items.filter(q => q.level === 'fail').map(q => `${q.title}, ${q.val}`).join('; ')}: refined analysis required${sumOn ? ' [[ap.th]]' : ''}.`, true) : null,
      tbl(['Limit state / check group', 'Governing check', 'Girder', 'Location', 'D/C or RF', 'Status'], rows.map(q => ({ cells: [q.cat, q.check, G, q.loc, q.rf != null ? { t: `RF ${isFinite(q.rf) ? f(q.rf, 2) : '—'}`, n: true, key: q.key } : R3(q.r, q.key), st(q)], cls: st(q) === 'FAIL' ? 'gov' : '' })), { wide: true, caption: 'Every check group the app computes for this girder (each value links to the step that works it); the per-group detail is in the Summary section and the module sections' }),
      out.length ? tbl(['Not included in the verdict', 'Status', 'Value', 'Work'], out.map(q => [q[0], q[1], q[2], q[3] ? { t: '', key: q[3] } : ''])) : note('Not included in the verdict: none.'),
      note('Items not included in the verdict are listed so that this summary never reads as all-pass while a check fails: the span-to-depth guidance is optional (2.5.2.6.3; e.g. clearance-limited structures), applicability warnings and notes do not change the verdict, warnings are for review.')];
    return { title: 'Executive summary', subs: [sub('v', `Girder ${G}: verdict`, items)] };
  }
  /* basis(B, X): Basis of design: specification, owner, materials, factors, combinations, IM, fatigue traffic, analysis method and its applicability */
  function basis(B, X) {
    const P = B.P, m = P.materials, Gd = window.SBDModel.GRADES, own = P.ownerRules || {}, OW = window.SBDOwners, lf = OW.loadFactors(own.owner, own.eta, (P.xs || {}).nb), FX = window.SBDFlexure;
    const G = FX.factorsOwner ? FX.factorsOwner(lf) : FX.factors(), C = window.SBDConstr && window.SBDConstr.factorsOwner ? window.SBDConstr.factorsOwner(lf) : { cdc: 1.25, ccl: 1.5 };
    const wcE = m.concrete.wcE > 0 ? m.concrete.wcE : m.concrete.wc, MR = window.SBDSections.modularRatio(m.concrete.fc, wcE, m.concrete.K1, m.concrete.nRule);
    const AS = window.SBDAnalysis ? window.SBDAnalysis.settings(P) : { im: 33, imf: 15 }, FA = window.SBDFatigue, FS = FA ? FA.settings(P.fatigue || window.SBDModel.defaultFatigue()) : null, fa = P.fatigue || {};
    const PHI = (window.SBDSplices && window.SBDSplices.PHI) || {}, sh = window.SBDShear ? window.SBDShear.PHIV : 1.0;
    let AP = null; try { AP = window.SBDAnalysis.applicability(P); } catch (e) { AP = null; }
    const lv = { fail: 'FAIL (refined analysis required)', warn: 'WARNING (results approximate)', note: 'NOTE (skew effects listed)', ok: 'within the limits' };
    return { title: 'Basis of design', subs: [
      sub('spec', 'Specification and owner', [kv([['Design specification', ED], ['Shear connectors (studs)', '10th Ed. provisions only (Art. 6.10.10); a 9th Ed. design has different stud requirements, not shown (Fatigue & studs section)'], ['Load rating', 'AASHTO MBE 4th Ed. (2026)'], ['Owner profile', lf.o || 'AASHTO', 'own.eta'], ['Load modifier η (maximum / minimum Strength factors)', `${f(lf.eta, 3)} / ${f(lf.etaN, 3)}`, 'own.eta'], ['Design load multiplier m on LL+IM', f(lf.m, 2), 'own.m'], ['Haunch in section properties', lf.h0 ? '0 (owner rule)' : 'as entered']])]),
      sub('mat', 'Materials', [kv([['Steel $F_{y}$, top / bottom flange, web', `${Gd[m.steel.top].Fy} / ${Gd[m.steel.bot].Fy} / ${Gd[m.steel.web].Fy} ksi (${m.steel.top} / ${m.steel.bot} / ${m.steel.web})`], ['$E_{s}$', `${f(m.Es || 29000, 0)} ksi`], ["$f'_{c}$", `${f(m.concrete.fc, 2)} ksi`],
        ['$E_{c}$', `${f(MR.Ec, 0)} ksi = 120,000 K₁ w_c² f′c^0.33 (Eq. 5.4.2.4-1; $w_{c}$${m.concrete.wcE > 0 ? ' for $E_{c}$' : ''} ${f(wcE, 3)} kcf, $K_{1}$ ${f(m.concrete.K1, 2)})`, 'n.Ec'], ['Modular ratio n', `${f(MR.n, 3)}${MR.rule === 'round' ? ` → ${MR.n}` : ''} (Art. 6.10.1.1.1b)`, 'n.n'],
        ['Unit weights', `steel 490 pcf (Table 3.5.1-1); concrete $w_{c}$ ${f(m.concrete.wc, 3)} kcf (dead load)`], ['Deck rebar $F_{yr}$', `${f(m.rebar.Fyr, 0)} ksi`]])]),
      sub('phi', 'Resistance factors (Art. 6.5.4.2)', [tbl(['Resistance', 'φ'], [['Flexure $\\phi_{f}$', '1.00'], ['Shear $\\phi_{v}$', f(sh, 2)], ['Shear connectors $\\phi_{sc}$', '1.00'], ['Axial compression $\\phi_{c}$ (cross-frames)', f(PHI.c != null ? PHI.c : 0.9, 2)], ['Tension, yielding / fracture $\\phi_{y}$ / $\\phi_{u}$', `${f(PHI.y != null ? PHI.y : 0.95, 2)} / ${f(PHI.u != null ? PHI.u : 0.8, 2)}`], ['Bolts in shear $\\phi_{s}$, bearing $\\phi_{bb}$', `${f(PHI.s != null ? PHI.s : 0.8, 2)} / ${f(PHI.bb != null ? PHI.bb : 0.8, 2)}`], ['Weld metal $\\phi_{e2}$ (fillet, shear)', f(window.SBDWelds && window.SBDWelds.PHI_VU != null ? window.SBDWelds.PHI_VU : 0.8, 2)]])]),
      sub('lc', 'Load combinations used (Tables 3.4.1-1, 3.4.1-2; owner η and m applied)', [tbl(['Combination', 'γ_DC (max / min)', 'γ_DW (max / min)', 'γ_LL+IM', 'Use'], [
        ['Strength I', `${f(G.dc, 3)} / ${f(G.dcMin, 3)}`, `${f(G.dw, 3)} / ${f(G.dwMin, 3)}`, f(G.ll, 3), 'flexure, shear, stiffeners, splices, welds, studs (strength)'],
        ['Service II', '1.00', '1.00', f(G.sll, 3), 'flange stresses (GS12, GS13), splice slip'], ['Fatigue I', '—', '—', f(FS ? FS.gI : 1.75, 2), 'infinite life details'], ['Fatigue II', '—', '—', f(FS ? FS.gII : 0.8, 2), 'finite life details'],
        ['Deck placement (constructibility)', f(C.cdc, 3), '—', `${f(C.ccl, 3)} (construction LL)`, 'GS14–GS16, overhang brackets']])]),
      sub('ll', 'Live load', [kv([['HL-93 dynamic load allowance IM, Strength / Service', `${f(AS.im, 0)} % (truck and tandem; not on the lane load, Table 3.6.2.1-1)`], ['Fatigue IM', `${f(AS.imf, 0)} %`], ['Fatigue truck', 'one design truck, 30 ft rear axle spacing (3.6.1.4.1)'],
        ['$ADTT_{SL}$ = p ADTT', FS ? `${f(FS.p, 2)}(${f(FS.ADTT, 0)}) = ${f(FS.ADTTSL, 0)} trucks/day (Eq. 3.6.1.4.2-1); design life ${f(FS.life, 0)} years` : '—'], ['Flange fatigue categories (GS17), top / bottom', `${fa.catT || 'B'} / ${fa.catB || 'B'}`]])]),
      sub('an', 'Analysis method', [kv([['Method', 'Line-girder analysis (stiffness method, staged sections: DC1 on the steel, DC2 and DW on 3n, LL on n) with the approximate distribution factors of Art. 4.6.2.2'],
        ['Applicability (SA4)', AP ? `${lv[AP.level]}${AP.items.filter(q => q.level !== 'ok').length ? ': ' + AP.items.filter(q => q.level !== 'ok').map(q => `${q.title} (${q.val})`).join('; ') : ''}` : '—', 'ap.th']])])] };   // the SA4 steps are worked in the Summary section (ap.*)
  }
  /* ---------- BOM2 (2026-11-23, engineer's request; report only: no value a check uses is calculated or changed here) ----------
     The steel the app sizes besides the girder plates, as bill-of-materials items: transverse stiffeners and connection plates and bearing
     stiffeners (the stiffener types and layout of the Shear & stiffeners module: its TS and BS rows), field splice plates (the Field splices
     design: fl.top / fl.bot / web of each splice) and cross-frames or diaphragms (the weight the analysis puts in DC1: engine/crossframes.js
     xfPts, one call per frame of the framing). Each plate: W = b t ℓ × 490/1728 lb, the plate girders' unit weight (STEEL_PLF / 12).
     bomItems(B) -> plain data of the reported girder { label, stf, brg: [{ item, b, t, L (in), n, how }], spl: [{ name, rows, bolts, … }],
     xf: { rows, tot, … } | null (the bridge's frames), miss: [text] (what is not known, listed as not included) }. */
  const PLF = () => (window.SBDAnalysis && window.SBDAnalysis.STEEL_PLF) || 490 / 144;   // lb/ft per in²: steel 490 pcf
  const plLb = (b, t, L) => b * t * L * PLF() / 12;   // one plate b × t × ℓ (in): lb
  const bomSum = rows => (rows || []).reduce((a, q) => a + q.n * plLb(q.b, q.t, q.L) / 1000, 0);   // kip
  function bomItems(B) {
    const P = B.P, out = { label: gName(B.girder), stf: [], brg: [], spl: [], xf: null, miss: [] }, err = B.err || {};
    const S = B.shear, TS = S && S.TS, BS = S && S.BS, pl = n => (n === 1 ? '' : 's');
    if (TS && Array.isArray(TS.rows)) { const m = new Map();
      TS.rows.forEach(r => { const t = r.t || (TS.types || {})[r.type] || {}, bt = +t.bt, tp = +t.tp, D = +r.D, per = +t.sides === 2 ? 2 : 1; if (!(bt > 0 && tp > 0 && D > 0)) return;
        const k = [r.type, bt, tp, per, D].join('|'); if (!m.has(k)) m.set(k, { item: `${t.name || 'Type ' + r.type} (type ${r.type}: ${t.role === 'cp' ? 'connection plate' : 'intermediate transverse stiffener'})`, b: bt, t: tp, L: D, loc: 0, per }); m.get(k).loc++; });
      m.forEach(q => out.stf.push({ item: q.item, b: q.b, t: q.t, L: q.L, n: q.loc * q.per, how: `${q.loc} location${pl(q.loc)} × ${q.per}, ${q.per === 2 ? 'both sides' : 'one side'} of the web` })); }
    else out.miss.push(`transverse stiffeners and connection plates of ${out.label} (${err.shear || err.an || 'Shear & stiffeners not calculated'})`);
    if (BS && Array.isArray(BS.rows)) { const m = new Map();
      BS.rows.forEach(r => { const t = (BS.types || {})[r.type] || {}, bt = +t.bt, tp = +t.tp, np = Math.round(+t.np) || 0, D = +(r.D != null ? r.D : BS.D); if (!(bt > 0 && tp > 0 && np > 0 && D > 0)) return;
        const k = [r.type, bt, tp, np, D].join('|'); if (!m.has(k)) m.set(k, { item: `Bearing stiffener, ${t.name || 'type ' + r.type} (type ${r.type})`, b: bt, t: tp, L: D, loc: 0, per: 2 * np }); m.get(k).loc++; });
      m.forEach(q => out.brg.push({ item: q.item, b: q.b, t: q.t, L: q.L, n: q.loc * q.per, how: `${q.loc} support${pl(q.loc)} × ${q.per}, ${q.per / 2} pair${pl(q.per / 2)}` })); }
    else out.miss.push(`bearing stiffeners of ${out.label} (${err.shear || err.an || 'Shear & stiffeners not calculated'})`);
    const SL = B.spl && Array.isArray(B.spl.list) ? B.spl.list : null, ok = q => +q.b > 0 && +q.t > 0 && +q.L > 0;
    if (SL) SL.forEach(s => { const R = s.R, F = R && R.fl, Wb = R && R.web, nm = s.name || `Splice at ${f(s.x, 2)} ft`;
      if (!F || !F.top || !F.bot || !Wb || !(F.top.Lpl > 0) || !(F.bot.Lpl > 0)) { out.miss.push(`the plates of ${nm}, ${out.label} (no splice design)`); return; }
      const rows = [], gap = +R.gap || 0, Lw = gap + 2 * (Wb.ew + (Wb.ncw - 1) * Wb.sh + Wb.ewp), bl = (s.p && s.p.bolts) || {};
      [['Top', F.top], ['Bottom', F.bot]].forEach(([k, q]) => { rows.push({ item: `${k} flange, outer plate`, b: +q.bo, t: +q.to, L: +q.Lpl, n: 1 }); if (q.inner) rows.push({ item: `${k} flange, inner plates`, b: +q.bi, t: +q.ti, L: +q.Lpl, n: 2 });
        if (q.tfill > 0) out.miss.push(`the ${k.toLowerCase()} flange fill plate of ${nm}, ${out.label} (thickness ${f(q.tfill, 4)} in; its plan size is not an output of the splice design)`); });
      rows.push({ item: 'Web plates', b: +Wb.hw, t: +Wb.twp, L: Lw, n: 2 });
      out.spl.push({ name: nm, rows: rows.filter(ok), bolts: 2 * ((+F.top.n || 0) + (+F.bot.n || 0) + (+Wb.nw || 0)), bolt: bl.d ? `${bl.d} in ${bl.gr || ''}`.trim() : '', gap,
        fl: { ef: F.top.ef, nr: F.top.nr, s: F.top.s, ep: F.top.ep, L: F.top.Lpl }, web: { ew: Wb.ew, nc: Wb.ncw, sh: Wb.sh, ewp: Wb.ewp, L: Lw } }); });
    else if (err.spl && !/No field splice/.test(err.spl)) out.miss.push(`field splice plates of ${out.label} (${err.spl})`);
    // cross-frames / diaphragms of the bridge: each frame's weight as the analysis puts it in DC1 (xfPts with that one frame: W, the whole frame)
    const Fm = B.frm, XF = window.SBDCrossframes, L = Fm && Fm.L, X = Fm && Fm.XF && Fm.XF.X;
    if (L && L.xf && Array.isArray(L.xf.f) && XF && XF.xfPts && X && X.on) { const m = new Map(), sp = P.spans.lengths.map(Number), k1 = 1 + (+X.allow || 0) / 100;
      L.xf.f.forEach(fr => { const [sup, , bay, , , Lf] = fr, end = !!sup, G = XF.xfPts({ spans: sp, xf: { g: L.xf.g, f: [fr] } }, X), e = G && G[bay] && G[bay][0]; if (!e || !(e.W >= 0)) return;
        const ab = X.ab && X.ab[bay], h = X.kind === 'xf' ? (X.hb && X.hb[bay] > 0 ? X.hb[bay] : X.h) : null, S12 = Lf * 12;
        let mem, work, after = '';
        if (X.kind === 'ovr') { mem = 'weight per frame entered on the Cross-frames tab'; work = 'entered'; }
        else if (X.kind === 'dia') { const A = end ? (ab && ab.Ae ? ab.Ae : X.Ae) : (ab ? ab.A : X.A), g = end ? X.ge : X.g, nmD = end ? (ab && ab.Ae ? ab.nm : X.nmE) : (ab && ab.nm ? ab.nm : X.nm);
          mem = `${nmD || 'diaphragm'}, A = ${f(A, 2)} in²`; work = `$A(S - 2g)(0.2836)(1 + a)/1000$ = ${f(A, 2)}(${f(S12, 2)} − 2(${f(g, 2)}))(0.2836)(${f(k1, 2)})/1000`; }
        else { const X0 = end || X.type === 'X', d = X0 ? Math.hypot(S12, h) : Math.hypot(S12 / 2, h);
          mem = `${X0 ? 'X' : X.type === 'Kb' ? 'K (bottom apex)' : 'K (top apex)'}: top ${X.nmT}, bottom ${X.nmB}, 2 diagonals ${X.nmD}`;
          work = `$(S(A_{t} + A_{b}) + 2 d A_{d})(0.2836)(1 + a)/1000$ = (${f(S12, 2)}(${f(X.At, 3)} + ${f(X.Ab, 3)}) + 2(${f(d, 2)})(${f(X.Ad, 3)}))(0.2836)(${f(k1, 2)})/1000`; after = `, with d = $\\sqrt{${X0 ? 'S^{2}' : '(S/2)^{2}'} + h^{2}}$ = ${f(d, 2)} in`; }
        const k = [end, Lf, h, mem, e.W].join('|'); if (!m.has(k)) m.set(k, { item: end ? 'At a support' : 'Intermediate', mem, n: 0, Lf, h, W: e.W, work, after }); m.get(k).n++; });
      const rows = [...m.values()]; out.xf = { kind: X.kind, allow: +X.allow || 0, dia: X.kind === 'dia' || (X.kind === 'ovr' && XF.cfDiaOn && XF.cfDiaOn(P.crossframes || {})), rows, tot: rows.reduce((a, q) => a + q.n * q.W, 0) }; }
    else out.miss.push(`cross-frames or diaphragms (${(Fm && Fm.L && Fm.L.errors && Fm.L.errors.length ? 'the framing has errors' : '') || err.frm || 'their weight in DC1 is off or not calculated: Cross-frames tab'})`);
    return out;
  }
  /* the tables of one girder's items: [subs], ref(k) = the text / link after "worked in" for section k (shear, spl) */
  const BOM_HEAD = ['Item', 'Plate b × t (in)', 'Count', 'Length ℓ (in)', 'Each (lb)', 'W (kip)'];
  const bomRow = q => [q.item, `${f(q.b, 3)} × ${f(q.t, 4)}`, q.how ? `${q.n} (${q.how})` : String(q.n), N(q.L, 3), N(plLb(q.b, q.t, q.L), 1), N(q.n * plLb(q.b, q.t, q.L) / 1000, 3)];
  const bomEg = q => `${f(q.b, 3)}(${f(q.t, 4)})(${f(q.L, 3)})(490/1728) = ${f(plLb(q.b, q.t, q.L), 1)} lb; × ${q.n} = ${f(q.n * plLb(q.b, q.t, q.L) / 1000, 3)} kip`;
  function bomItemSubs(id, who, it, ref) {
    const subs = [], st = it.stf.concat(it.brg);
    if (st.length) subs.push(sub(id + 's', `Stiffeners and connection plates, ${who}`, [
      note(`Each plate: W = b t ℓ × 490/1728 lb (steel 490 pcf, Table 3.5.1-1: ${f(PLF() / 12, 5)} lb/in³, the plate girders' unit weight). e.g. ${st[0].item}: ${bomEg(st[0])}. Length ℓ: the web depth D at the stiffener (the corner clips and any cut-back at a flange are not deducted). Width, thickness and the number at each location: the stiffener types of the [[tab:shear|Shear & stiffeners tab]]; the locations: its stiffener layout and the supports${ref('shear')}.`),
      tbl(BOM_HEAD, st.map(bomRow).concat([['Subtotal: transverse stiffeners and connection plates', '', '', '', '', N(bomSum(it.stf), 3)], ['Subtotal: bearing stiffeners', '', '', '', '', N(bomSum(it.brg), 3)]]), { wide: true, caption: `Quantities of one girder (${who})` })]));
    if (it.spl.length) { const s0 = it.spl[0], all = [].concat(...it.spl.map(s => s.rows));
      subs.push(sub(id + 'p', `Field splice plates, ${who}`, [
        note(`Each plate: W = b t ℓ × 490/1728 lb. Flange plates: ℓ = the splice design's plate length, gap + 2($e_{f}$ + ($n_{r}$ − 1)s + $e_{p}$); e.g. ${s0.name}, top: ${f(s0.gap, 3)} + 2(${f(s0.fl.ef, 3)} + (${s0.fl.nr} − 1)(${f(s0.fl.s, 3)}) + ${f(s0.fl.ep, 3)}) = ${f(s0.fl.L, 3)} in. Web plates (two): ℓ = gap + 2($e_{w}$ + ($n_{c}$ − 1)$s_{h}$ + $e_{wp}$) = ${f(s0.gap, 3)} + 2(${f(s0.web.ew, 3)} + (${s0.web.nc} − 1)(${f(s0.web.sh, 3)}) + ${f(s0.web.ewp, 3)}) = ${f(s0.web.L, 3)} in (as the Drawings' splice detail). e.g. ${s0.name}, ${s0.rows[0].item.toLowerCase()}: ${bomEg(s0.rows[0])}. Plate sizes and bolt patterns: the Field splices design${ref('spl')}.`),
        tbl(['Splice', ...BOM_HEAD], [].concat(...it.spl.map(s => s.rows.map((q, i) => [i ? '' : s.name, ...bomRow(q)]).concat([[`Subtotal ${s.name}`, '', '', '', '', '', N(bomSum(s.rows), 3)]]))).concat([['Subtotal: field splice plates', '', '', '', '', '', N(bomSum(all), 3)]]), { wide: true, caption: `Quantities of one girder (${who})` }),
        note(`Bolts (count only; no weight in this table): ${it.spl.map(s => `${s.name}: ${s.bolts}${s.bolt ? ` × ${s.bolt}` : ''}`).join('; ')}.`)])); }
    return subs;
  }
  const bomXfSub = xf => sub('xf', xf.dia ? 'Diaphragms (bridge)' : 'Cross-frames (bridge)', [
    note(xf.kind === 'ovr' ? 'The weight of each frame is the value entered on the [[tab:cf|Cross-frames tab]] (weight in DC1: entered); member sizes are not listed.'
      : `Each frame: the weight the analysis puts in DC1 (half on each girder it connects; [[tab:cf|Cross-frames tab]], weight in DC1 from the member sizes), S = the frame length between the girder webs${xf.kind === 'xf' ? ', h = the frame depth, d = the diagonal length' : ', g = the end gap'}, steel 0.2836 lb/in³ (490 pcf), a = the allowance of ${f(xf.allow, 0)} % for gussets, connection plates and bolts. ${xf.rows[0] ? `e.g. ${xf.rows[0].item.toLowerCase()}: ${xf.rows[0].work} = ${f(xf.rows[0].W, 3)} kip${xf.rows[0].after || ''}.` : ''}`),
    tbl(['Frame', 'Members', 'Count', 'S (ft)', 'h (in)', 'Each (kip)', 'W (kip)'], xf.rows.map(q => [q.item, q.mem, String(q.n), N(q.Lf, 2), q.h != null ? N(q.h, 2) : '—', N(q.W, 3), N(q.n * q.W, 3)]).concat([['Subtotal: ' + (xf.dia ? 'diaphragms' : 'cross-frames'), '', String(xf.rows.reduce((a, q) => a + q.n, 0)), '', '', '', N(xf.tot, 3)]]), { wide: true, caption: 'Every frame of the framing plan (all bays)' })]);
  /* bomPlates(P): the plate girders (PR3, unchanged): rows per segment, per-type weights w[gi] (kip, one girder) and lines */
  function bomPlates(P) {
    const M = window.SBDModel, plf = PLF(), rows = [], sumT = [], w1 = [], nLs = []; let tot = 0, anyRl = false;
    (P.girders || []).forEach((g, gi) => { const ln = M.typeLines ? M.typeLines(P, gi) : [], nL = ln.length || 1; let w = 0;
      (g.segments || []).forEach((s, k) => { const L = s.x1 - s.x0;
        if (rlNm(s)) { const sh = window.SBDRolled.shapeOf(s), W = sh.W * L / 1000; w += W; anyRl = true;   // ROLL (2026-11-23): a rolled segment: the shape, its tabulated area and weight
          rows.push([gName(g), String(k + 1), `${f(s.x0, 2)}–${f(s.x1, 2)}`, `${sh.name} (rolled shape; d ${f(sh.d, 3)}, b_f ${f(sh.bf, 3)}, t_f ${f(sh.tf, 4)}, t_w ${f(sh.tw, 4)})`, N(sh.A, 3), N(sh.W, 2), N(L, 2), N(W, 3)]); return; }
        const A = s.D * s.tw + s.topB * s.topT + s.botB * s.botT, wf = A * plf, W = wf * L / 1000; w += W;
        rows.push([gName(g), String(k + 1), `${f(s.x0, 2)}–${f(s.x1, 2)}`, `web ${f(s.D, 3)} × ${f(s.tw, 4)}; top ${f(s.topB, 3)} × ${f(s.topT, 4)}; bot ${f(s.botB, 3)} × ${f(s.botT, 4)}`, N(A, 3), N(wf, 2), N(L, 2), N(W, 3)]); });
      sumT.push([gName(g), N(w, 3), ln.length ? ln.map(j => 'G' + (j + 1)).join(', ') : 'design line (no line assigned)', String(nL), N(w * nL, 3)]); tot += w * nL; w1.push(w); nLs.push(nL); });
    return { plf, rows, sumT, tot, w1, nLs, anyRl };
  }
  const bomPlatesItems = (P, PL) => [
    note(`Per plate segment: A = D t_w + b_t t_t + b_b t_b (in²); w = A × 490/144 = A × ${f(PL.plf, 4)} lb/ft (steel 490 pcf, Table 3.5.1-1); W = w ℓ / 1000 (kip). The weights are of the plates as entered (Girders & plates tab).${PL.anyRl ? ` Rolled shapes: A and w are the tabulated area and nominal weight of the shape (${window.SharedAiscW.VERSION}), not the three plates; no flange-to-web welds.` : ''}`),
    tbl(['Girder type', 'Segment', 'x (ft)', 'Plates (in)', 'A (in²)', 'w (lb/ft)', 'ℓ (ft)', 'W (kip)'], PL.rows, { wide: true }),
    tbl(['Girder type', 'One girder (kip)', 'Lines', 'Number', 'Total (kip)'], PL.sumT.concat([['Bridge total', '', '', '', N(PL.tot, 3)]]), { caption: 'Girder subtotals and the bridge total (plate girders only)' }),
    ...(() => { const M = window.SBDModel, U = M.unassigned ? M.unassigned(P) : []; return U.length ? [note(`Girder lines without a girder type (${U.map(j => 'G' + (j + 1)).join(', ')}) are not checked and not in this total (Girders & plates tab).`, true)] : []; })()];
  /* bomTotals(P, PL, units, xf, rest): units = [{ who, gi, n (girders), it }] (the girders whose items are listed), rest = [gi] (girder types
     with their plates only: the single-girder report); the girder and bridge totals, with what is not included */
  function bomTotals(P, PL, units, xf, rest) {
    const rows = []; let tot = 0; const miss = [];
    units.forEach(u => { const a = PL.w1[u.gi] || 0, b = bomSum(u.it.stf), c = bomSum(u.it.brg), d = bomSum([].concat(...u.it.spl.map(s => s.rows))), one = a + b + c + d; tot += one * u.n;
      rows.push([u.who, N(a, 3), N(b, 3), N(c, 3), N(d, 3), N(one, 3), String(u.n), N(one * u.n, 3)]); (u.it.miss || []).forEach(t => { if (!/^cross-frames/.test(t) && !miss.includes(t)) miss.push(t); }); });
    (rest || []).forEach(gi => { const a = PL.w1[gi] || 0, n = PL.nLs[gi] || 1; tot += a * n; rows.push([`${gName(P.girders[gi])} (plates only: its stiffeners and splice plates are in the every-girder report)`, N(a, 3), '—', '—', '—', N(a, 3), String(n), N(a * n, 3)]); });
    if (xf) { tot += xf.tot; rows.push([xf.dia ? 'Diaphragms (bridge)' : 'Cross-frames (bridge)', '', '', '', '', '', String(xf.rows.reduce((a, q) => a + q.n, 0)), N(xf.tot, 3)]); }
    else { const t = units.map(u => (u.it.miss || []).find(q => /^cross-frames/.test(q))).find(Boolean); if (t) miss.push(t); }
    rows.push([(rest || []).length ? 'Bridge total (the other girder types: plates only)' : 'Bridge total', '', '', '', '', '', '', N(tot, 3)]);
    const al = +((P.xs || {}).allow) || 0, Ua = window.SBDModel.unassigned ? window.SBDModel.unassigned(P) : [];
    return sub('t', 'Girder and bridge totals', [
      tbl(['Girder', 'Plates (kip)', 'Transverse stiffeners, connection plates (kip)', 'Bearing stiffeners (kip)', 'Splice plates (kip)', 'One girder (kip)', 'Number', 'Total (kip)'], rows, { wide: true, caption: 'One girder = plates + stiffeners + connection plates + bearing stiffeners + splice plates; total = one girder × number; bridge total = the sum of the rows' }),
      note(`Not included: shear studs; field splice bolts (counted above, no weight) and fill plates; cross-frame gusset and connection plates and their bolts beyond the allowance in the frame weight; lateral bracing; bearings and sole plates; welds${miss.length ? '; ' + miss.join('; ') : ''}. The analysis adds a detail allowance of ${f(al, 0)} % to the girder steel dead load (DC1, Analysis section) and the cross-frame weights as point loads; the allowance is not in this table.${Ua.length ? ` Girder lines without a girder type (${Ua.map(j => 'G' + (j + 1)).join(', ')}) have no girder in these totals; the frames of every bay are counted.` : ''}`)]);
  }
  /* bom(B, X): steel bill of materials: the plate girders of every type (PR3), then the reported girder's stiffeners, connection plates and
     splice plates and the bridge's cross-frames (BOM2), the girder and bridge totals */
  function bom(B, X) {
    const P = B.P, PL = bomPlates(P), it = bomItems(B), G = gName(B.girder), an = (X && X.anch) || new Set();
    const ref = k => { const ks = (k === 'shear' ? ['bom.ts', 'bom.bs'] : ['bom.spl']).filter(a => an.has(a)); return ks.length ? ` (see ${ks.map(a => `[[${a}]]`).join(', ')})` : ` (the ${k === 'shear' ? 'Shear & stiffeners' : 'Field splices'} section is not in this report)`; };
    const rest = (P.girders || []).map((g, gi) => gi).filter(gi => gi !== B.g);
    return { title: 'Steel bill of materials', subs: [sub('b', 'Plate girders', bomPlatesItems(P, PL)),
      ...bomItemSubs('g', `girder ${G}`, it, ref), ...(it.xf ? [bomXfSub(it.xf)] : []),
      bomTotals(P, PL, [{ who: `Girder ${G}`, gi: B.g, n: PL.nLs[B.g] || 1, it }], it.xf, rest), ...(B.dk ? [bomDeck(P, B.dk)].filter(Boolean) : [])].concat(
      (PL.nLs[B.g] || 1) > 1 ? [sub('n', 'Lines of this girder type', [note(`Girder type ${G} is on ${PL.nLs[B.g]} lines: its stiffeners, connection plates and splice plates are counted here as those of the reported line on each of them. The every-girder report (Report tab, scope "Every girder") lists each line's own.`)])] : []) };
  }
  /* dfFigs(B): the cross-section with the wheel positions of each LLDF case (ui/gfxa.js loadsGraphic, the tab's own drawing), exterior girder G1 and the reported girder, span 1 */
  function dfFigs(B) {
    const GA = window.SBDGfxA, GG = window.SBDGraphics, R = B.loads; if (!GA || !GA.loadsGraphic || !GG || !GG.tightSvg || !R || !R.regions) return [];
    const AN = window.SBDAnalysis, line = AN ? AN.lineOf(B.P, B.girder) : 0, out = [], lines = [...new Set([0, line])];
    lines.forEach(lg => { let g0; try { g0 = GA.loadsGraphic(B.P, R, lg, 0, ''); } catch (e) { return; } if (!g0 || g0.errors) return;
      (g0.opts || []).forEach(([k, t]) => { let g; try { g = GA.loadsGraphic(B.P, R, lg, 0, k); } catch (e) { return; } if (!g || !g.D) return;
        out.push({ type: 'figure', svg: GG.tightSvg(g.D, { bg: '#fff', width: '100%' }), caption: `G${lg + 1}${lg === 0 ? ' (exterior)' : ''}, ${R.regions[0].label}: ${t}. ${k === 'rigid' ? 'Rigid cross-section method (4.6.2.2.2d): lanes from the side that governs; R = N_L/N_b + X_ext Σe/Σx².' : 'Lever rule: the deck hinged over the adjacent girder (the first interior girder for G1); wheels 2 ft from the traffic face, 6 ft apart; R from statics; g = mR.'} Worked in the distribution factor steps of this section.` }); }); });
    return out;
  }
  /* sign(B): sign-off and revision history (the project's title-block fields; blank lines to be filled in by hand) */
  function sign(B) {
    const p = B.P.project || {}, box = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 260" width="200" role="img" aria-label="P.E. seal"><rect x="2" y="2" width="256" height="256" fill="#fff" stroke="#000" stroke-width="1.5"/><text x="130" y="135" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#000">P.E. seal</text></svg>`;
    return { title: 'Sign-off and revision history', subs: [sub('s', 'Sign-off', [
      tbl(['Role', 'Name', 'Signature', 'Date'], [['Designed by', p.designer || '', '', p.date || ''], ['Checked by', p.checker || '', '', ''], ['Approved by', '', '', '']]),
      { type: 'figure', plain: true, svg: box, caption: 'Professional Engineer seal and signature' },
      tbl(['Rev.', 'Date', 'Description', 'By', 'Checked'], [['0', p.date || '', 'Issued', p.designer || '', p.checker || ''], ['', '', '', '', ''], ['', '', '', '', ''], ['', '', '', '', '']], { caption: 'Revisions (Designed by, Checked by and Date: the project fields on the Project tab; the rest to be filled in by hand)' })])] };
  }
  /* ptHead(B, r): the design-point header of a worked flexure location: station, span and x/L, plates, unbraced length and its L_p / L_r, d_o, plate-transition side */
  function ptHead(B, r) {
    const sup = B.sup || [], k = spanOf(sup, r.x), L = sup[k] - sup[k - 1], segs = (B.girder && B.girder.segments) || [], s = r.seg, lt = r.lt || null;
    const chg = segs.slice(0, -1).map(q => q.x1).find(x => Math.abs(x - r.x) < 0.02), sh = B.shear && B.shear.stations ? B.shear.stations.reduce((a, q) => (!a || Math.abs(q.x - r.x) < Math.abs(a.x - r.x) ? q : a), null) : null;
    return kv([['Station', `x = ${f(r.x, 2)} ft${chg != null ? ` (${r.x < chg ? 'left' : 'right'} of the plate transition at ${f(chg, 2)} ft)` : ''}`], ['Span, x/L', isFinite(L) && L > 0 ? `span ${k}, x/L = ${f((r.x - sup[k - 1]) / L, 3)}` : '—'],
      ['Plates (in)', `web ${f(r.D, 3)} × ${f(r.tw, 4)}; top ${f(r.topB, 3)} × ${f(r.topT, 4)}; bottom ${f(r.botB, 3)} × ${f(r.botT, 4)}`],
      ['Unbraced length $L_{b}$, $C_{b}$', `${f(r.Lb, 2)} ft${s ? ` (${f(s.xa, 2)} to ${f(s.xb, 2)} ft)` : ''}, $C_{b}$ = ${f(r.Cb, 3)}${lt && isFinite(lt.Lp) ? `; $L_{p}$ = ${f(lt.Lp / 12, 2)} ft, $L_{r}$ = ${f(lt.Lr / 12, 2)} ft` : ''}`],
      ['Stiffener panel $d_{o}$', sh && +sh.do > 0 ? `${f(+sh.do, 2)} in (Shear & stiffeners section, x = ${f(sh.x, 2)} ft)` : sh ? 'unstiffened web' : '—']]);
  }

  const BUILD = { proj, loads, an, defl, sec, flex, shear, fat, cn, frm, spl, wd, dk, rt };
  /* sectionsOf(P) (DK): SECTIONS, with "Deck slab" before the Rating where the project has the deck design switched on (else SECTIONS itself) */
  const DK_SEC = ['dk', 'Deck slab'], dkOn = P => !!(window.SBDDeck && window.SBDDeck.isOn && window.SBDDeck.isOn(P));
  const SECTIONS_DK = [].concat(...SECTIONS.map(s => (s[0] === 'rt' ? [DK_SEC, s] : [s])));
  const sectionsOf = P => (dkOn(P) ? SECTIONS_DK : SECTIONS);
  const BOM_ANCH = { shear: { ts: 'bom.ts', bs: 'bom.bs' }, spl: { list: 'bom.spl' } };   // section: { sub id: anchor key }
  const NEED = { loads: 'loads', an: 'an', defl: 'an', sec: 'sec', flex: 'flex', shear: 'shear', fat: 'fat', cn: 'cn', frm: 'frm', spl: 'spl', wd: 'wd', dk: 'dk', rt: 'rating' };
  function model(B, opt) {
    opt = opt || {};
    const inc = opt.include || null, on = k => !inc || inc[k] !== false, X = { detail: opt.detail === 'all' ? 'all' : 'gov', have: new Map(), gov: [], warn: [], on, anch: new Set() };   // on, anch: BOM2 (2026-11-23), the bill of materials links only into the subsections written in this report (BOM_ANCH)
    const P = B.P, p = P.project || {}, secs = [], built = [], dropped = [];
    const dataOf = { loads: B.loads, an: B.src === 'file' ? B.pl : B.an, defl: B.src === 'file' ? null : B.an, sec: B.sec, flex: B.flex, shear: B.shear, fat: B.fat, cn: B.cn, frm: B.frm, spl: B.spl, wd: B.wd, dk: B.dk, rt: B.rating };
    (B.dkOn ? SECTIONS_DK : SECTIONS).forEach(([k, label]) => {
      if (k === 'dk' && !B.dk) X.gov.push({ mod: 'Deck', grp: DK_GRP, check: 'Deck design: not calculated', loc: B.err.dk || 'input error', r: NaN, key: null });   // DK: an input error is REVIEW, not silence
      if (k === 'sum' || k === 'exec' || k === 'sign') return;   // built after the modules (exec, sum) or last (sign)
      if (k === 'basis' || k === 'bom') { if (on(k)) { let s0; try { s0 = (k === 'basis' ? basis : bom)(B, X); } catch (e) { s0 = { title: label, subs: [sub('n', 'Not available', [note('Report error: ' + (e && e.message), true)])] }; } secs.push({ id: k, ...s0 }); } return; }
      const want = on(k);
      if (k === 'proj') { if (want) { const s0 = proj(B, X), v3 = snapSub({ snap3d: opt.snap3d }); if (v3) s0.subs.push(v3); secs.push({ id: k, ...s0 }); } return; }   // RPX: + the 3D view captured
      if (k === 'defl' && !DEFL_ON()) return;
      if (k === 'defl' && B.src === 'file') { if (want) secs.push({ id: k, title: 'Deflection', subs: [sub('n', 'Not in this report', [note('Deflections are calculated from this project\'s analysis; this report takes its demands from a hand-off file. Choose "This project\'s analysis" to include them, or see the [[tab:defl|Deflection tab]].')])] }); return; }   // DEFL
      if (k === 'spl' && B.src === 'file') { if (want) secs.push({ id: k, title: 'Field splices', subs: [sub('n', 'Not in this report', [note('Field splices are designed from this project\'s analysis; this report takes its demands from a hand-off file. Choose "This project\'s analysis" to include them, or see the [[tab:spl|Field splices tab]].')])] }); return; }
      if (!dataOf[k]) { if (want) { built.push(k); secs.push({ id: k, title: label, subs: [sub('n', 'Not available', [note(B.err[k] || B.err[NEED[k]] || B.err.all || 'Not calculated.', true)])] }); } return; }
      // every module is built (the summary links to its governing check; references into it are found below); a section not chosen is dropped
      const g0 = X.gov.length, h0 = new Set(X.have.keys());
      let s; try { s = BUILD[k](B, X); } catch (e) { s = { title: label, subs: [sub('n', 'Not available', [note('Report error: ' + (e && e.message), true)])] }; }
      if (want) { if (BOM_ANCH[k]) s.subs.forEach(q => { const a = BOM_ANCH[k][q.id]; if (a && !q.key) { q.key = a; X.anch.add(a); } });   // BOM2: "§n.m" anchors of the subsections the bill of materials takes its sizes from
        { const fg = opt.figures ? figSub(k, opt.figures[k]) : null; if (fg) s.subs.push(fg); }   // RPX: the tab's own graphics, last in the section
        built.push(k); secs.push({ id: k, ...s }); return; }
      // not chosen: its summary rows stay, without a link (their work is not in this report); later sections do not link into it
      X.gov.slice(g0).forEach(q => { q.key = null; q.loc += ' (section not included)'; });
      [...X.have.keys()].forEach(r => { if (!h0.has(r)) X.have.delete(r); });
      dropped.push(s);
    });
    // references from the sections shown into a section left out: the link is removed and the text says where the work is
    if (dropped.length) {
      const gone = new Set(); dropped.forEach(s => s.subs.forEach(q => q.items.forEach(it => { if (it.type === 'steps') it.steps.forEach(t => gone.add(K(it.scope, t.id))); })));
      const keep = new Set(); secs.forEach(s => s.subs.forEach(q => q.items.forEach(it => { if (it.type === 'steps') it.steps.forEach(t => keep.add(K(it.scope, t.id))); })));
      const out = k => gone.has(k) && !keep.has(k), fixT = t => typeof t === 'string' ? t.replace(/\[\[([^\]|]+)\]\]/g, (m, k) => (out(k) ? '(section not included)' : m)) : t;
      const fixC = c => { if (c && typeof c === 'object') { const o = { ...c, t: fixT(c.t) }; if (out(o.key)) o.key = null; return o; } return fixT(c); };
      secs.forEach(s => { s.note = fixT(s.note); s.subs.forEach(q => { q.items = q.items.map(it => {
        if (it.type === 'note') return { ...it, text: fixT(it.text) };
        if (it.type === 'kv') return { ...it, rows: it.rows.map(r => [fixT(r[0]), fixT(r[1]), out(r[2]) ? null : r[2]]) };
        if (it.type === 'table') return { ...it, rows: it.rows.map(r => Array.isArray(r) ? r.map(fixC) : { ...r, cells: r.cells.map(fixC) }) };
        return it; }); }); });
    }
    if (on('sum')) secs.unshift({ id: 'sum', ...summary(B, X, built) });
    // PR3: Basis of design and the Executive summary at the front (the summary reads the governing rows of every module built above), Sign-off last
    { const bi = secs.findIndex(q => q.id === 'basis'); if (bi >= 0) secs.unshift(secs.splice(bi, 1)[0]); }
    X.on = on;   // exec links only into the sections included
    if (on('exec')) { let s0; try { s0 = exec(B, X); } catch (e) { s0 = { title: 'Executive summary', subs: [sub('n', 'Not available', [note('Report error: ' + (e && e.message), true)])] }; } secs.unshift({ id: 'exec', ...s0 }); }
    if (on('sign')) secs.push({ id: 'sign', ...sign(B) });
    // the executive summary and the basis of design link only to steps written in this report (a value not worked here keeps its text, without a link)
    secs.filter(q => q.id === 'exec' || q.id === 'basis').forEach(E => { { const have = new Set();
      secs.forEach(q => q.subs.forEach(u => u.items.forEach(it => { if (it && it.type === 'steps') (it.steps || []).forEach(t => have.add(K(it.scope, t.id))); })));
      const cell = c => (c && typeof c === 'object' && c.key && !have.has(c.key) ? { ...c, key: null } : c);
      E.subs.forEach(u => { u.items = u.items.map(it => !it ? it : it.type === 'note' ? { ...it, text: String(it.text).replace(/ ?\[\[([^\]|]+)\]\]/g, (m, k) => (have.has(k) ? m : '')) }
        : it.type === 'table' ? { ...it, rows: it.rows.map(r => (Array.isArray(r) ? r.map(cell) : { ...r, cells: r.cells.map(cell) })) }
        : it.type === 'kv' ? { ...it, rows: it.rows.map(r => (r[2] && !have.has(r[2]) ? [r[0], r[1], null] : r)) } : it); }); } });   // exec and basis (PR3)
    const girder = B.girder;
    numberFigs(secs);   // RPX: Figure n.m
    return { refs: refsOf(secs, P), title: 'Steel Bridge Design', subtitle: `Calculation report: girder ${gName(girder)}${p.name ? ', ' + p.name : ''}`, code: `${ED}; MBE 4th Ed. (2026) (load rating). ${X.detail === 'all' ? 'Every station worked.' : 'Governing location of each check worked.'}`,
      info: [['Project No', p.number], ['Computed by', p.designer], ['Date', p.date], ['Project', p.name], ['Checked by', p.checker], ['Owner', window.SBDModel.clientName(P)]],
      head: { left: `${p.name || 'Steel Bridge Design'}${p.number ? ' (' + p.number + ')' : ''}\nGirder ${gName(girder)}`, right: `Computed by: ${p.designer || '—'}  Date: ${p.date || '—'}\nChecked by: ${p.checker || '—'}`, foot: `Steel Bridge Design, ${ED}` },
      sections: secs, gov: X.gov };
  }

  /* ---------- every girder at once (added 2026-10-30, report wiring PR) ---------- */
  /* govRows(B): one girder's summary rows (model(B).gov: each check group's governing ratio or RF, the modules' own values), as plain data */
  function govRows(B) {
    const M = model(B, { detail: 'gov' });
    const out = { rows: M.gov.map(q => ({ grp: q.grp || q.mod, mod: q.mod, check: q.check, loc: q.loc, r: q.r, rf: q.rf, status: q.status })), err: { ...B.err } };
    // EXA (2026-11-23): the girder's Summary cells (report/summary.js cells(): the Summary tab's own columns and statuses, from this bundle),
    // for the every-girder Executive summary; BOM2: its bill-of-materials items. Plain data; absent when the module is not loaded.
    const SM = window.SBDSummary;
    if (SM && SM.cells && SM.MODS && B.src !== 'file' && !B.custom) { try { const parts = {}; SM.MODS.forEach(m => { parts[m.k] = m.k === 'an' ? B : {}; });
      const G = SM.cells(B.P, B.g, parts), D = G.depth; out.sum = { gi: G.gi, label: G.label, cells: G.cells, warn: G.warn, notes: [], err: G.err, gov: [], ...(D ? { depth: { flagged: !!D.flagged, comp: D.comp, rows: (D.rows || []).map(q => ({ k: q.k, need: q.need, have: q.have })) } } : {}) }; } catch (e) { /* no Executive summary for this build */ } }
    try { out.bom = bomItems(B); } catch (e) { /* no bill of materials items */ }
    return out;
  }
  /* ---------- every girder: Executive summary and bill of materials (EXA, BOM2; 2026-11-23, engineer's request; display only) ----------
     allExec(P, list): the Summary tab's own verdict of the bridge. Each girder's Summary cells (report/summary.js cells(), kept by govRows
     as G.sum) go through the same merge() (a type on several lines) and overall() the Summary tab calls, so the verdict, the counts, the
     governing D/C and each limit state's governing girder are that tab's values by construction (with this project's analysis as the
     demands). One row per limit state (the Summary tab's columns); each value links to that girder's governing checks in this report (§)
     and names the tab that works it (in-app link). null when the Summary module or a girder's cells are missing (no section then). */
  const TABN = { flex: 'Flexure', shear: 'Shear & stiffeners', fat: 'Fatigue & studs', cn: 'Constructibility', cf: 'Cross-frames', spl: 'Field splices', wt: 'Welds', defl: 'Deflection', rt: 'Rating', an: 'Analysis' };
  function allExec(P, list) {
    const SM = window.SBDSummary; if (!SM || !SM.overall || !SM.merge || !list.length || !list.every(G => G.sum && G.sum.cells)) return null;
    const by = new Map(); list.forEach((G, k) => { if (!by.has(G.gi)) by.set(G.gi, []); by.get(G.gi).push({ j: G.j, G: G.sum, k }); });
    const T = [...by.entries()].map(([gi, us]) => ({ gi, us, S: SM.merge(P, gi, us) })).filter(t => t.S);
    const ov = SM.overall(P, T.map(t => t.S)), n = ov.n, COLS = (SM.cols ? SM.cols(P) : SM.COLS).map(c => SM.label(c, P));
    let AP = null; try { AP = window.SBDAnalysis && window.SBDAnalysis.applicability ? window.SBDAnalysis.applicability(P) : null; } catch (e) { AP = null; }
    const apFail = !!(AP && AP.level === 'fail'), verdict = apFail ? 'FAIL' : ov.verdict;   // ui/summary.js paint(): an applicability FAIL fails the verdict
    const kOf = (S, q) => { const t = T.find(z => z.S === S), u = t && (q.ln != null ? t.us.find(z => z.j === q.ln) : null) || (t && t.us[0]); return u ? u.k : 0; };
    const gl = (S, q) => `${S.label}${q.ln != null ? ` on G${q.ln + 1}` : ''}`, nf = r => (isFinite(r) ? f(r, 3) : r === Infinity ? '∞' : r === -Infinity ? '−∞' : 'NaN');
    const stT = { pass: 'PASS', fail: 'FAIL', review: 'REVIEW', na: 'n/a', notrun: 'not run' }, chk = (c, q) => (q.check ? (/^flex/.test(c.id) ? tt(q.check) : q.check) : '—');
    const val = (c, q, k) => (q.st === 'na' || q.st === 'notrun' ? '—' : c.rf ? { t: `RF ${isFinite(q.rf) ? f(q.rf, 2) : '—'}`, n: true, cls: !isFinite(q.rf) ? '' : q.rf < 1 - 1e-9 ? 'ng' : q.rf < 1.1 ? 'hi' : 'ok', key: 'per.g' + k } : { t: nf(q.r), n: true, cls: rc(q.r), key: 'per.g' + k });
    const cnt = c => { const a = { fail: 0, review: 0, pass: 0 }; T.forEach(t => { const q = t.S.cells[c.id]; if (q && a[q.st] != null) a[q.st]++; }); return `${a.fail} / ${a.review} / ${a.pass}`; };
    const rows = COLS.map(c => { const z = ov.byCol[c.id]; if (!z) return null; const q = z.q, k = kOf(z.G, q);
      return { cells: [c.head, chk(c, q), q.st === 'na' || q.st === 'notrun' ? '—' : gl(z.G, q), q.loc || '—', val(c, q, k), stT[q.st] || q.st, cnt(c), `[[tab:${c.tab}|${TABN[c.tab] || c.tab} tab]]`], cls: q.st === 'fail' ? 'gov' : '' }; }).filter(Boolean);
    if (ov.deckIn) ov.deck.cells.forEach(q => rows.push({ cells: [`Deck slab: ${q.id || 'inputs'}`, q.check, 'bridge deck', q.loc || '—', q.r != null ? { t: nf(q.r), n: true, cls: rc(q.r), key: 'per.g0' } : '—', stT[q.st] || q.st, '—', '[[tab:dk|Deck tab]]'], cls: q.st === 'fail' ? 'gov' : '' }));   // DK: the deck slab checks, once for the bridge
    const out = [];   // not in the verdict
    T.forEach(t => { const D = t.S.depth; if (D) out.push(['Span-to-depth guidance (Art. 2.5.2.6.3, optional criteria)', t.S.label, D.flagged ? 'below optional AASHTO depth guidance' : 'meets the optional guidance', (D.rows || []).map(q => `${q.k}L = ${f(q.need, 2)} in vs ${f(q.have, 2)} in`).join('; ')]); });
    if (AP) AP.items.filter(q => q.level === 'warn' || q.level === 'note').forEach(q => out.push([`Applicability of the line-girder analysis (SA4): ${q.title}`, 'bridge', q.level === 'warn' ? 'WARNING' : 'NOTE', `${q.val}: ${q.msg}`]));
    COLS.forEach(c => T.forEach(t => { const q = t.S.cells[c.id]; if (q && (q.st === 'na' || q.st === 'notrun')) out.push([`${c.head}: no check`, t.S.label, stT[q.st], q.why || '']); }));
    T.forEach(t => (t.S.warn || []).forEach(w => out.push(['Warning (for review)', t.S.label, 'Warning', w])));
    const top = ov.top, low = ov.low, CD = window.SBDCustomDemands, cu = CD && CD.srcGet ? ['flex', 'shear', 'cn', 'fat', 'rt', 'spl', 'wt'].filter(k => CD.srcGet(P, k) === 'custom') : [];
    const Ua = window.SBDModel.unassigned ? window.SBDModel.unassigned(P) : [];
    const items = [{ type: 'figure', plain: true, svg: banner(verdict, `Every girder: ${n.fail} FAIL, ${n.review} REVIEW, ${n.pass} PASS${n.na ? `, ${n.na} n/a` : ''} (${T.length} girder type${T.length === 1 ? '' : 's'} × ${COLS.length} limit states)${apFail ? ' + analysis applicability FAIL' : ''}`),
        caption: 'Verdict of the bridge, by the rules of the [[tab:sum|Summary tab]]: FAIL where a demand / capacity ratio exceeds 1.0, a rating factor RF is below 1.0, or the line-girder analysis is not applicable (SA4 FAIL); else REVIEW where a ratio is not a number or a module item has a Warning status (welds, cross-frames, deflection over the owner\'s preferred limit); else PASS. Counts: one per girder type and limit state (the columns of the Summary tab).' },
      top ? note(`Governing D/C: ${nf(top.q.r)} (${top.c.head}; ${top.G.deck ? '' : 'girder '}${gl(top.G, top.q)}, ${chk(top.c, top.q)}, ${top.q.loc}) [[per.g${kOf(top.G, top.q)}]].${low ? ` Lowest rating factor: ${f(low.q.rf, 2)} (${low.c.head.replace('Rating, ', '')}; girder ${gl(low.G, low.q)}, ${low.q.loc}) [[per.g${kOf(low.G, low.q)}]].` : ''}`, top.q.r > 1 + 1e-9) : low ? note(`Lowest rating factor: ${f(low.q.rf, 2)} (girder ${gl(low.G, low.q)}, ${low.q.loc}) [[per.g${kOf(low.G, low.q)}]].`, low.q.rf < 1 - 1e-9) : null,
      apFail ? note(`Line-girder analysis not applicable (SA4 FAIL): ${AP.items.filter(q => q.level === 'fail').map(q => `${q.title}, ${q.val}`).join('; ')}: refined analysis required (worked in each girder's report, Summary section, and on the [[tab:an|Analysis tab]]).`, true) : null,
      ov.nan.length ? note(`Not evaluated (ratio not a number; counted as REVIEW): ${ov.nan.map(z => `${z.c.head}, girder ${gl(z.G, z.q)}, ${z.q.loc}: ${chk(z.c, z.q)}, ratio ${nf(z.q.r)}`).join('; ')}.`, true) : null,
      cu.length ? note(`Custom (entered) demands are chosen on a tab (${cu.map(k => (CD.SPECS && CD.SPECS[k] ? CD.SPECS[k].name : k)).join(', ')}): the Summary tab uses them for those modules; this report uses this project's analysis for every module, so those rows can differ from the Summary tab.`, true) : null,
      Ua.length ? note(`Line${Ua.length > 1 ? 's' : ''} ${Ua.map(j => 'G' + (j + 1)).join(', ')} ${Ua.length > 1 ? 'have' : 'has'} no girder type and ${Ua.length > 1 ? 'are' : 'is'} not checked: the verdict covers the lines of the girder types only.`, true) : null,
      tbl(['Limit state', 'Governing check', 'Governing girder', 'Location', 'D/C or RF', 'Status', 'Girder types FAIL / REVIEW / PASS', 'Worked on'], rows, { wide: true, caption: 'One row per limit state: the girder that governs it (the largest D/C; the smallest RF), the same values as the Summary tab. Each D/C or RF links to that girder\'s governing checks in this report; the value is worked on the tab named and in that girder\'s own report (Report tab, scope "Selected girder"), in the section of the same name.' }),
      out.length ? tbl(['Not included in the verdict', 'Girder', 'Status', 'Value'], out) : note('Not included in the verdict: none.'),
      note('Items not included in the verdict are listed so that this summary never reads as all-pass while something is open: the span-to-depth guidance is optional (2.5.2.6.3; e.g. clearance-limited structures), applicability warnings and notes do not change the verdict, a limit state with no check is not counted, warnings are for review (a module item with a Warning status is already counted as REVIEW above).')];
    return { id: 'exec', title: 'Executive summary', subs: [sub('v', 'Every girder: verdict', items)], verdict, ov };
  }
  /* allBom(P, list): the bill of materials of the bridge from every girder's items (govRows().bom): the plate girders, each girder's
     stiffeners, connection plates and splice plates (girders with the same items listed once), the cross-frames, the totals */
  function allBom(P, list) {
    if (!list.length || !list.every(G => G.bom)) return null;
    const PL = bomPlates(P), grp = new Map();
    list.forEach(G => { const it = G.bom, k = JSON.stringify([G.gi, it.stf, it.brg, it.spl]); if (!grp.has(k)) grp.set(k, { gi: G.gi, it, labs: [], miss: [] }); const g = grp.get(k); g.labs.push(G.label); (it.miss || []).forEach(t => { if (!g.miss.includes(t)) g.miss.push(t); }); });
    const U = [...grp.values()].map(g => ({ who: `Girder ${g.labs.join(', ')}`, gi: g.gi, n: g.labs.length, it: { ...g.it, miss: g.miss } }));
    const xf = (list.find(G => G.bom.xf) || { bom: {} }).bom.xf || null, ref = k => ` (that girder's report, ${k === 'shear' ? 'Shear & stiffeners' : 'Field splices'} section)`;
    return { id: 'bom', title: 'Steel bill of materials', subs: [sub('b', 'Plate girders', bomPlatesItems(P, PL)),
      ...[].concat(...U.map((u, i) => bomItemSubs('g' + i, u.who.replace(/^Girder/, 'girder'), u.it, ref))), ...(xf ? [bomXfSub(xf)] : []), bomTotals(P, PL, U, xf, []),
      ...(dkOn(P) ? (() => { try { return [bomDeck(P, window.SBDDeck.calc(P))].filter(Boolean); } catch (e) { return []; } })() : [])] };   // DK: the deck bars, where the deck is designed
  }
  /* allModel(P, list, opt): the report of every girder: per check group the governing ratio (or RF) of each girder, the controlling
     girder of the group (largest ratio; smallest RF) marked, and the girder that controls the whole bridge; then each girder's governing
     rows. list = [{ gi, label, rows, err }] (govRows of each girder). Nothing is calculated: the values are each girder's summary values. */
  function allModel(P, list, opt) {
    opt = opt || {};
    const p = P.project || {}, grps = [];
    list.forEach(G => (G.rows || []).forEach(q => { if (!grps.includes(q.grp)) grps.push(q.grp); }));
    const isRF = gp => list.some(G => (G.rows || []).some(q => q.grp === gp && q.rf != null));
    const val = q => (q ? (q.rf != null ? q.rf : q.r) : NaN);
    const ctl = gp => { let b = null; const rf = isRF(gp); list.forEach(G => { const q = (G.rows || []).find(z => z.grp === gp), v = val(q); if (!isFinite(v)) return; if (!b || (rf ? v < b.v : v > b.v)) b = { G, v }; }); return b; };
    const C = new Map(grps.map(gp => [gp, ctl(gp)]));
    // the controlling girder of the bridge: the largest demand / capacity ratio of any check (rating factors listed apart)
    let top = null; list.forEach(G => (G.rows || []).forEach(q => { if (q.rf == null && isFinite(q.r) && (!top || q.r > top.q.r)) top = { G, q }; }));
    let low = null; list.forEach(G => (G.rows || []).forEach(q => { if (q.rf != null && isFinite(q.rf) && (!low || q.rf < low.q.rf)) low = { G, q }; }));
    const head = ['Check group', ...list.map(G => G === (top && top.G) ? `${G.label} (controls)` : G.label), 'Controlling girder'];
    const cell = (G, gp) => { const q = (G.rows || []).find(z => z.grp === gp); if (!q) return { t: '—', cls: 'na' }; const c = C.get(gp), mk = c && c.G === G && list.length > 1 ? ' ◆' : '';
      if (q.rf != null) return { t: (isFinite(q.rf) ? f(q.rf, 2) : '—') + mk, n: true, cls: !isFinite(q.rf) ? '' : q.rf < 1 - 1e-9 ? 'ng' : q.rf < 1.1 ? 'hi' : 'ok' };
      return { t: (isFinite(q.r) ? f(q.r, 3) : '—') + mk, n: true, cls: rc(q.r) }; };
    const rows = grps.map(gp => { const c = C.get(gp); return { cells: [gp, ...list.map(G => cell(G, gp)), c ? `${c.G.label} (${isRF(gp) ? 'RF ' + f(c.v, 2) : f(c.v, 3)})` : '—'], cls: c && !isRF(gp) && c.v > 1 + 1e-9 ? 'gov' : '' }; });
    const errs = list.filter(G => G.err && Object.keys(G.err).length);
    const subs = [sub('tbl', 'Governing ratio of each check group, every girder', [
      note(`Each cell is the governing demand / capacity ratio of that check group on that girder (OK ≤ 1.0), or its rating factor RF (OK ≥ 1.0), from the girder's own calculation report (Report tab, scope "Selected girder", where each value is worked). ◆ marks the controlling girder of each group (the largest ratio, the smallest RF). Demands: this project's analysis of each girder. ${ED}.`),
      top ? note(`Controlling girder: ${top.G.label}, largest ratio ${f(top.q.r, 3)} (${top.q.mod}, ${top.q.check}, ${top.q.loc}).`, top.q.r > 1 + 1e-9) : null,
      note('The same values, with the overall verdict and a link from each value to the tab that works it: the [[tab:sum|Summary tab]]. There a rating factor RF < 1.0 counts as FAIL, and a check with a Warning status (welds, cross-frames, deflection over the owner\'s preferred limit) as REVIEW.'),   // Summary tab (2026-11-09)
      low ? note(`Lowest rating factor: ${low.G.label}, ${low.q.check.replace(/,.*$/, '')} ${f(low.q.rf, 2)} (${low.q.loc}).`, low.q.rf < 1 - 1e-9) : null,
      tbl(head, rows, { wide: true }),
      errs.length ? note('Not in this summary: ' + errs.map(G => `${G.label}: ${Object.entries(G.err).map(([k, v]) => `${(SECTIONS.find(s => s[0] === k) || [k, k])[1]} ${v}`).join('; ')}`).join(' | '), true) : null])];
    const per = list.map((G, k) => ({ key: 'per.g' + k, ...sub('g' + k, `Girder ${G.label}${top && G === top.G ? ' (controls)' : ''}`, [
      tbl(['Module', 'Check', 'Location', 'Ratio / RF', 'Status'], (G.rows || []).map(q => q.rf != null
        ? [q.mod, q.check, q.loc, { t: `RF ${isFinite(q.rf) ? f(q.rf, 2) : '—'}`, n: true, cls: !isFinite(q.rf) ? '' : q.rf < 1 - 1e-9 ? 'ng' : q.rf < 1.1 ? 'hi' : 'ok' }, isFinite(q.rf) ? (q.rf >= 1 - 1e-9 ? 'OK' : 'RF < 1') : '—']
        : { cells: [q.mod, q.check, q.loc, R3(q.r), q.status === 'warn' ? 'Warning' : okT(q.r)], cls: q.r > 1 + 1e-9 ? 'gov' : '' }), { wide: true })]) }));
    // EXA, BOM2 (2026-11-23): the Executive summary first, the bill of materials last (each only when every girder's data is there)
    let EX = null, BM = null; try { EX = allExec(P, list); } catch (e) { EX = { id: 'exec', title: 'Executive summary', subs: [sub('n', 'Not available', [note('Report error: ' + (e && e.message), true)])] }; }
    try { BM = allBom(P, list); } catch (e) { BM = { id: 'bom', title: 'Steel bill of materials', subs: [sub('n', 'Not available', [note('Report error: ' + (e && e.message), true)])] }; }
    const allSecs = numberFigs([EX ? { id: EX.id, title: EX.title, subs: EX.subs } : null, { id: 'all', title: 'Summary of every girder', subs }, { id: 'per', title: 'Governing checks of each girder', subs: per }, BM].filter(Boolean));   // RPX: Figure n.m
    return { refs: [['AASHTO LRFD', 'AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024). The articles are cited step by step in each girder\'s own report (Report tab, scope "Selected girder": its References list them).'], ['MBE', 'AASHTO Manual for Bridge Evaluation, 4th Ed. (2026), Section 6 Part A (LRFR): the load rating rows.']],
      title: 'Steel Bridge Design', subtitle: `Calculation report: every girder (governing ratios)${p.name ? ', ' + p.name : ''}`, code: `${ED}; MBE 4th Ed. (2026) (load rating). Governing ratio of each check group, every girder; each value is worked in that girder's own report.`,
      info: [['Project No', p.number], ['Computed by', p.designer], ['Date', p.date], ['Project', p.name], ['Checked by', p.checker], ['Owner', window.SBDModel.clientName(P)]],
      head: { left: `${p.name || 'Steel Bridge Design'}${p.number ? ' (' + p.number + ')' : ''}\nEvery girder`, right: `Computed by: ${p.designer || '—'}  Date: ${p.date || '—'}\nChecked by: ${p.checker || '—'}`, foot: `Steel Bridge Design, ${ED}` },
      sections: allSecs, top, low, ctl: C, verdict: EX && EX.verdict, ov: EX && EX.ov };
  }

  window.SBDReportBuild = { SECTIONS, sectionsOf, model, govRows, allModel, bomItems, citedRefs, refsOf, numberFigs, FIG_TAB };
})();
