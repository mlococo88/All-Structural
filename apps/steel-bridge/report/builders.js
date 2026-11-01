/* apps/steel-bridge/report/builders.js — the calculation report model of Steel Bridge Design (window.SBDReportBuild). Classic script,
   no DOM. Created 2026-10-30 (Report tab). Turns the results of report/data.js (each module's own result, unchanged) into the report
   model of shared/report.js: sections in the workflow order, each value worked (the module's own SharedSteps steps) or linked to the
   step that works it ("see §x.y"). Nothing is calculated here; ratios and values are those the modules return.

   model(bundle, opt) -> report model; opt = { detail: 'gov' (the governing location of each check group, default) | 'all' (every
   station, worked steps opened on demand), include: { key: false } to leave a section out (default all) }.
   Section keys (SECTIONS, in the workflow order; the summary is put first):
     sum   Summary of governing ratios (links to each check)     proj  Project and owner        loads Cross-section, loads and LLDF
     an    Analysis                                               sec   Section properties       flex  Flexure
     shear Shear and stiffeners                                   fat   Fatigue and studs        cn    Constructibility (deck placement)
     frm   Framing and cross-frames                               spl   Field splices            wd    Welds (added 2026-10-30)
     rt    Load rating
   Step anchors: key = scope + '/' + step id (shared/report.js); scope '' for the lists that appear once (loads, analysis, framing,
   owner rules), else one scope per location ('flex@12', 'sh.st@3', 'spl@0', …). */
(function () {
  'use strict';
  const U = () => window.SharedUnits, f = (x, d) => U().fmt(x, d);
  const SECTIONS = [['sum', 'Summary'], ['proj', 'Project & owner'], ['loads', 'Cross-section & loads'], ['an', 'Analysis'], ['sec', 'Section properties'], ['flex', 'Flexure'],
    ['shear', 'Shear & stiffeners'], ['fat', 'Fatigue & studs'], ['cn', 'Constructibility'], ['frm', 'Framing & cross-frames'], ['spl', 'Splices'], ['wd', 'Welds'], ['rt', 'Rating']];
  const K = (scope, id) => (scope ? scope + '/' + id : String(id));
  const rc = r => !isFinite(r) ? '' : r > 1 + 1e-9 ? 'ng' : r >= 0.9 ? 'hi' : 'ok';
  const okT = r => !isFinite(r) ? '—' : r > 1 + 1e-9 ? 'NG' : 'OK';
  const R3 = (r, key) => ({ t: isFinite(r) ? f(r, 3) : '—', cls: rc(r), n: true, key });
  const N = (x, d) => ({ t: f(x, d), n: true });
  /* engine titles write subscripts as f_bu, D_{cp}: set them as notation */
  const tt = t => String(t == null ? '' : t).replace(/_\{?([A-Za-z0-9,]+)\}?/g, (m, a) => `\${}_{${a}}$`);   // as the tabs' tt(): every _x a subscript
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
    : `$f_{\\ell}$ from skew (C6.10.1, in lieu of a refined analysis): largest support skew ${f(D.flS.skMax, 1)}°${D.flS.skMax > 20 + 1e-9 ? ` > 20°, $f_{\\ell}$ = ${D.flS.steps[0].sub} = ${f(D.fl, 2)} ksi` : ' ≤ 20°, $f_{\\ell}$ = 0'}${B.frm && B.frm.fl && B.frm.fl.fl === D.fl && B.frm.fl.skMax === D.flS.skMax ? ' [[flsk.fl]]' : ''}`;
  const brNote = Gr => Gr.frB ? `the brace points of the Spans & framing tab (G${Gr.frB.line + 1}'s bearings and cross-frames)` : 'the cross-frame stations of the stiffener layout (the project has no framing)';

  /* ---------- 2. project and owner ---------- */
  function proj(B, X) {
    const P = B.P, p = P.project || {}, g = B.girder, M = window.SBDModel, G = M.GRADES, m = P.materials, d = P.deck, AN = window.SBDAnalysis;
    const lf = B.loads && B.loads.lf ? B.loads.lf : window.SBDOwners.loadFactors(P.ownerRules.owner, P.ownerRules.eta, (P.xs || {}).nb);
    const line = AN ? AN.lineOf(P, g) : 0;
    return { title: 'Project and owner', subs: [
      sub('p', 'Project', [kv([['Project', p.name || '—'], ['Project No', p.number || '—'], ['Client / owner', window.SBDModel.clientName(P) || '—'], ['Computed by', p.designer || '—'], ['Checked by', p.checker || '—'], ['Date', p.date || '—']]),
        p.notes ? note(p.notes) : null,
        kv([['Spans', `${P.spans.lengths.map(L => f(+L, 2)).join(' + ')} ft (${P.spans.continuity === 'simple' || P.spans.lengths.length < 2 ? 'simple spans' : 'continuous'})`],
          ['Girder reported', `${gName(g)}, ${g.position}; cross-section girder G${line + 1} (dead loads and distribution factors)`], ['$b_{eff}$', `${f(g.beff, 2)} in`],
          ['Design specification', ED], ['Demands', B.src === 'file' ? `hand-off file ${B.plName || ''} (GirderDetail → ST-Girder), where a module takes it (see each section)` : B.custom ? `entered on the tab (Custom) for ${cdMods(B)} (see each section); this project's analysis (Analysis tab) for the rest` : "this project's analysis (Analysis tab)"]])]),
      sub('m', 'Materials and deck', [kv([['Steel, top / bottom flange, web', `${m.steel.top} / ${m.steel.bot} / ${m.steel.web} ($F_{y}$ = ${G[m.steel.top].Fy} / ${G[m.steel.bot].Fy} / ${G[m.steel.web].Fy} ksi)`], ['$E_{s}$', `${f(m.Es, 0)} ksi`],
        ["$f'_{c}$, $w_{c}$, $K_{1}$", `${f(m.concrete.fc, 2)} ksi, ${f(m.concrete.wc, 3)} kcf, ${f(m.concrete.K1, 2)}`], ['Deck', `${d.composite === false ? 'noncomposite' : 'composite'}; $t_{s}$ = ${f(d.ts, 2)} in, total ${f(d.tdeck, 2)} in, haunch ${f(d.haunch, 2)} in`],
        ['Deck rebar', `top ${f(d.rebar.top.A, 2)} in² at ${f(d.rebar.top.c, 2)} in, bottom ${f(d.rebar.bot.A, 2)} in² at ${f(d.rebar.bot.c, 2)} in; $F_{yr}$ = ${f(m.rebar.Fyr, 0)} ksi`]])]),
      sub('g', `Plate segments, ${gName(g)}`, [tbl(['Segment', '$x_{0}$ (ft)', '$x_{1}$ (ft)', 'D (in)', '$t_{w}$ (in)', '$b_{t}$ (in)', '$t_{t}$ (in)', '$b_{b}$ (in)', '$t_{b}$ (in)'],
        g.segments.map((s, i) => [String(i + 1), N(s.x0, 2), N(s.x1, 2), N(s.D, 3), N(s.tw, 4), N(s.topB, 3), N(s.topT, 4), N(s.botB, 3), N(s.botT, 4)]))]),
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
    return { title: 'Cross-section, loads and live-load distribution', note: `Cross-section girder G${line + 1} carries the reported girder ${gName(B.girder)}${all ? '; every girder of the cross-section is worked' : ''}. As on the [[tab:loads|Loads & LLDF tab]].`, subs: [
      sub('d', `Dead loads per girder (klf), ${LD.METHODS[D.method] || D.method}`, [tbl(['Girder', 'Class', 'Deck', 'Haunch', 'SIP', 'DC1', 'DC2', 'DW'],
        gs.map(i => [`G${i + 1}`, LD.CLS[D.cls[i]] || D.cls[i], N(D.deck[i], 4), N(D.haunch[i], 4), N(D.sip[i], 4), { ...N(D.dc1[i], 4), key: `dl.G${i + 1}.DC1` }, { ...N(D.dc2[i], 4), key: `dl.G${i + 1}.DC2` }, { ...N(D.dw[i], 4), key: `dl.G${i + 1}.DW` }])),
        kv([[`Girder steel, ${R.girderLabel} (average)`, `${f(R.steel.avg, 4)} klf`, `dl.steel.${R.girderId}.avg`], ['Deck width', `${f(D.Wd, 2)} ft`], ['Live-load faces L / R', `${f(R.ll.L.r, 2)} / ${f(R.ll.R.r, 2)} ft`, 'xs.rL']]),
        note('DC1 here excludes the girder steel (per plate segment) and the cross-frames (point loads, Framing and cross-frames section); both are added in the analysis.')]),
      sub('df', 'Live-load distribution factors (lanes per girder)', [kv([['Design lanes $N_{L}$', String(geo.NL), 'df.geo.NL'], ['Roadway', `${f(geo.roadway, 2)} ft`, 'df.geo.w'], ['$d_{e}$ left / right', `${f(geo.deL, 2)} / ${f(geo.deR, 2)} ft`, 'df.geo.deL'],
        ['Deflection factor', f(R.regions[0].gDef, 4), `df.${R.regions[0].id}.gDef`]]),
        tbl(['Region', 'Girder', '$g_{M}$', '$g_{V}$', '$g_{fat,M}$', '$g_{fat,V}$', 'Method'], R.regions.flatMap(q => gs.filter(j => q.members[j]).map(j => { const m = q.members[j];
          return [q.label, `${m.label} (${m.type === 'ext' ? 'ext.' : 'int.'})`, { ...N(m.gM, 4), key: `df.${q.id}.G${j + 1}.gM` }, q.kind === 'span' ? N(m.gV, 4) : '—', N(m.fatM, 4), q.kind === 'span' ? N(m.fatV, 4) : '—', m.method]; }))),
        R.ranges.filter(q => !q.ok).length ? note(`Outside the range of applicability (Tables 4.6.2.2.2b-1, 4.6.2.2.3a-1, 4.6.2.2.2d-1): ${R.ranges.filter(q => !q.ok).map(q => `${q.region} ${q.name} = ${f(q.value, q.key === 'Kg' ? 0 : 2)}`).join('; ')}.`, true) : null]),
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
    let lx = l; series.forEach((s, k) => { g += `<line x1="${lx}" x2="${lx + 18}" y1="${H - 4}" y2="${H - 4}" stroke="${s.c || COL[k % COL.length]}" stroke-width="2"${s.dash ? ` stroke-dasharray="${s.dash}"` : ''}/><text x="${lx + 22}" y="${H - 1}" fill="#333">${s.name}</text>`; lx += 30 + s.name.length * 5.6; });
    return g + `<text x="12" y="${(t + H - b) / 2}" transform="rotate(-90 12 ${(t + H - b) / 2})" text-anchor="middle" fill="#333">${o.unit}</text></svg>`;
  }
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
      note(`Unfactored effects per girder: DC1 (steel, then the wet deck) on the steel section, DC2 and DW on 3n, LL+IM on n; ${Nn} stations (GirderDetail's grid), shared beam elements, loads applied exactly. As on the [[tab:an|Analysis tab]].`)]));
    const Mser = [{ name: 'DC1', y: s.DC1.M }, { name: 'DC2', y: s.DC2.M }, { name: 'DW', y: s.DW.M }];
    if (ll) Mser.push({ name: 'LL+IM max', y: ll.Mpos, c: '#DC2626' }, { name: 'LL+IM min', y: ll.Mneg, c: '#DC2626', dash: '4 3' });
    const Vser = [{ name: 'DC1', y: Vr(s.DC1) }, { name: 'DC2', y: Vr(s.DC2) }, { name: 'DW', y: Vr(s.DW) }];
    if (ll) Vser.push({ name: 'LL+IM max', y: Vx(ll, 'pos'), c: '#DC2626' }, { name: 'LL+IM min', y: Vx(ll, 'neg'), c: '#DC2626', dash: '4 3' });
    subs.push(sub('dg', 'Moment and shear diagrams', [{ type: 'figure', svg: chart(x, Mser, { title: 'Moments', unit: 'kip-ft', sup }), caption: 'Moments, unfactored, per girder (LL+IM with g); kip-ft' },
      { type: 'figure', svg: chart(x, Vser, { title: 'Shears', unit: 'kip', sup }), caption: 'Shears (sum of the forces to the left, up +); kip' },
      A.crack.length ? note(`Cracked zones: ${A.crack.map(([a, b]) => `${f(a, 1)}–${f(b, 1)} ft`).join(', ')} [[an.crack]].`) : null]));
    const rr = (k, o) => o.R[k];
    subs.push(sub('r', 'Reactions (unfactored, kip)', [tbl(['Support', 'DC1', 'DC2', 'DW', 'Constr. LL', ...(ll ? ['LL+IM max', 'LL+IM min'] : [])],
      sup.map((v, k) => [`${k === 0 ? 'Abut. 1' : k === sup.length - 1 ? 'Abut. 2' : 'Pier ' + k} (x = ${f(v, 1)} ft)`, N(rr(k, s.DC1), 2), N(rr(k, s.DC2), 2), N(rr(k, s.DW), 2), N(rr(k, s.CL), 2),
        ...(ll ? [{ ...N(A.llR[k].max, 2), key: 'an.R.LL.' + k }, N(A.llR[k].min, 2)] : [])])),
      note(`Statics: ${['DC1steel', 'DC1wet', 'DC2', 'DW', 'CL'].map(k => `${k} [[an.eq.${k}]]`).join(', ')}.${ll ? ' LL+IM: the reaction envelope × the larger $g_{V}$ of the adjacent spans; 90 % of two trucks + lane at interior supports (3.6.1.3.1).' : ''}`)]));
    if (A.lld) { X.gov.push(...A.lld.map(q => ({ mod: 'Analysis', check: 'SA3 LL deflection, $\\Delta_{LL}$ ≤ L/' + q.ratio, loc: `span ${q.k + 1}, x = ${f(q.x, 1)} ft`, r: q.d / q.lim, key: 'an.defl.LL' + (q.k + 1), status: q.status, grp: 'Analysis: SA3 live-load deflection' })).filter(q => q.status !== 'na').sort((a, b) => b.r - a.r).slice(0, 1));
      subs.push(sub('d', 'Live load deflection (SA3, 2.5.2.6.2)', [tbl(['Span', 'x (ft)', '$\\Delta_{LL}$ (in)', 'Limit (in)', 'Ratio', 'Status'], A.lld.map(q => [String(q.k + 1), N(q.x, 1), { ...N(q.d, 3), key: 'an.defl.LL' + (q.k + 1) }, { ...N(q.lim, 3), key: 'an.defl.lim' + (q.k + 1) },
        { ...R3(q.d / q.lim), t: f(q.d / q.lim, 2) }, { pass: 'OK', fail: 'Exceeds', warn: 'Exceeds the preferred limit', na: 'Reported (exterior)' }[q.status] || q.status]))])); }
    if (A.seq) { const Q = A.seq;
      subs.push(sub('q', 'Deck placement sequence (SA7, 6.10.3.4.1)', [kv([['Pours, in order', Q.pours.map((q, k) => `${k + 1}: ${f(q.a, 1)}–${f(q.b, 1)} ft`).join('; ')], ['Largest noncomposite moment $M_{DCc}$', `${f(Math.max(...Q.MDCc), 1)} kip-ft`, 'an.seq.MDCc'],
        ['Deck tension in hardened pours / $\\phi f_{r}$', `${f(Math.max(...Q.fdk), 3)} / ${f(Q.phifr, 3)} ksi`, 'an.seq.fdk']])])); }
    if (X.detail === 'all') subs.push(sub('t', 'Station table', [note('Stiffness-method results of the shared beam engine; their checks are the statics steps and the per-lane envelope × g (worked steps below).'),
      tbl(['x (ft)', '$M_{DC1}$', '$M_{DC2}$', '$M_{DW}$', ...(ll ? ['$M_{LL+IM}^{+}$', '$M_{LL+IM}^{-}$'] : []), '$V_{DC1}$', '$V_{DC2}$', '$V_{DW}$', ...(ll ? ['$V_{LL+IM}^{+}$', '$V_{LL+IM}^{-}$'] : [])],
        x.map((v, i) => [N(v, 2), N(s.DC1.M[i], 1), N(s.DC2.M[i], 1), N(s.DW.M[i], 1), ...(ll ? [N(ll.Mpos[i], 1), N(ll.Mneg[i], 1)] : []), N(Vr(s.DC1)[i], 1), N(Vr(s.DC2)[i], 1), N(Vr(s.DW)[i], 1), ...(ll ? [N(Vx(ll, 'pos')[i], 1), N(Vx(ll, 'neg')[i], 1)] : [])]), { caption: 'kip-ft, kip (shears just right of the station)' })]));
    subs.push(sub('w', 'Worked steps', [gsteps('SBDAnalysisUI:x', '', A.steps)]));
    return { title: 'Analysis', subs };
  }

  /* ---------- 5. section properties ---------- */
  function sec(B, X) {
    const S = B.sec, subs = [sub('n', 'Modular ratio', [steps('', S.nr.steps)])];
    S.cards.forEach(q => { const c = q.c, sc = `sec@${q.i}.${q.region}`, s = q.seg;
      const row = (nm, p, id) => p ? [nm, N(p.A, 2), N(p.yb, 3), { t: U().fmtInt(p.I), n: true, key: K(sc, id + '.I') }, { t: U().fmtInt(p.St), n: true }, { t: U().fmtInt(p.Sb), n: true }] : null;
      subs.push(sub(sc, `Segment ${q.i + 1} (x = ${f(s.x0, 2)} to ${f(s.x1, 2)} ft), ${q.region === 'pos' ? 'positive' : 'negative'} flexure`, [
        tbl(['Section', 'A (in²)', '$\\bar{y}$ (in)', 'I (in⁴)', '$S_{top}$ (in³)', '$S_{bot}$ (in³)'], [row('Steel', c.s, 'sec.s'), row('Long-term 3n', c.c3, 'sec.c3'), row('Short-term n', c.cn, 'sec.cn'), c.comp ? row('Steel + rebar', c.cr, 'sec.cr') : null].filter(Boolean)),
        kv([['$M_{p}$', `${f(c.Mp, 1)} kip-ft`, K(sc, `pl.${c.region}.Mp`)], ['PNA $y_{p}$ from bottom', `${f(c.yp, 3)} in`, K(sc, `pl.${c.region}.yp`)], ['D6.1 case', c.pl.cs], ['$D_{cp}$', `${f(c.Dcp, 3)} in`, K(sc, `pl.${c.region}.Dcp`)],
          ['$R_{h}$', f(c.Rh, 3), K(sc, !c.comp ? 'rh.s.Rh' : c.region === 'pos' ? 'rh.cn.Rh' : 'rh.cr.Rh')]]),
        c.comp ? null : note('Noncomposite girder: the steel section alone (6.10.1.1.1a).'),
        gsteps('SBDFlexureUI:sec', sc, c.steps, { lazy: true, title: 'Worked steps' })])); });   // opened on demand: the flexure and constructibility steps repeat them per location
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
    const one = r => [checksTbl(r, scOf(r)), kv([['$M_{u}$ / $M_{s}$', `${f(r.Mu, 1)} / ${f(r.Ms, 1)} kip-ft`, K(scOf(r), 'fx.Mu')], ['$D_{c}$ (Service II)', `${f(r.DcS, 3)} in`, K(scOf(r), 'fx.DcS')],
      ['Fatigue I Δf top / bottom', `${f(r.dfT, 2)} / ${f(r.dfB, 2)} ksi`, K(scOf(r), 'fx.fatT')]])];
    const detailed = all ? (Gr.gov ? [Gr.gov] : []) : govRows;
    const stF = r => (window.SBDFlexureUI.stepsOf ? window.SBDFlexureUI.stepsOf(Gr, r) : r.steps);   // with custom demands the step that names them first
    if (Gr.custom) subs.splice(1, 0, cdSub('flex', B));
    detailed.forEach(r => subs.push(sub(scOf(r), `${r.name}${r.x != null ? `, x = ${f(r.x, 2)} ft` : ''}${r === Gr.gov ? ' (governing)' : ''}`, [...one(r), gsteps('SBDFlexureUI:x', scOf(r), stF(r), { title: 'Worked steps (flexure, then the section properties of this location)' })])));
    if (all) subs.push(sub('every', 'Every location', rows.filter(r => r !== Gr.gov).map(r => gsteps('SBDFlexureUI:x', scOf(r), stF(r), { lazy: true, title: `${r.name}, x = ${f(r.x, 2)} ft: ${r.gov ? `${r.gov.id} ${tt(r.gov.title)}, ratio ${f(r.gov.ratio, 3)}` : ''}` }))));
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
    if (R.faGov) gl.push({ g: 'Fatigue details', it: `${R.faGov.it.loc}: ${R.faGov.c.id} ${R.faGov.c.title}`, r: R.faGov.it.r, key: K(fk(faI), R.faGov.it.step) });
    if (R.g17) gl.push({ g: 'Flanges, every station', it: `${R.g17.it.loc}: GS17 flange stress range (Category ${R.g17.it.cat}, Fatigue ${R.g17.it.lim})`, r: R.g17.it.r, key: K(gk(R.g17.i), R.g17.it.step) });
    if (R.scGov) gl.push({ g: 'Studs', it: `${R.scGov.it.loc}: ${R.scGov.c.id} ${R.scGov.c.title}`, r: R.scGov.it.r, key: K('sc', R.scGov.it.step) });
    gl.forEach(q => X.gov.push({ mod: 'Fatigue & studs', grp: 'Fatigue & studs: ' + q.g, check: q.it, loc: q.g, r: q.r, key: q.key }));
    subs.push(sub('gov', 'Governing items', [note(fromHtml(R.what)), note(FA.setText(R.set) + '. As on the [[tab:fat|Fatigue & studs tab]].'), tbl(['Group', 'Governing item', 'Ratio'], gl.map(q => [q.g, q.it, R3(q.r, q.key)])),
      R.FR.errors.length ? note('Fatigue: ' + R.FR.errors.join('; '), true) : null, R.SR.errors.length ? note('Shear connectors: ' + R.SR.errors.join('; '), true) : null]));
    if (R.custom) subs.push(cdSub('fat', B));
    if (!R.FR.errors.length) { const rows = R.FR.rows, sel = all ? rows.map((r, i) => i) : faI >= 0 ? [faI] : [];
      subs.push(sub('fa', 'Fatigue details (FA1, FA2, FA3; 6.6.1.2, 6.10.5.3)', [note(`$ADTT_{SL}$ = ${f(R.FR.ADTTSL, 0)} trucks/day. Fatigue I where $ADTT_{SL}$ is at least the detail's infinite-life equivalent, else Fatigue II; exempt: net compression under the permanent loads (FA2).`),
        tbl(['Detail', 'Cat.', 'n', 'Limit state', 'γ(Δf) (ksi)', '$(\\Delta F)_{n}$ (ksi)', 'FA1'], rows.map((r, i) => { const a = ck('FA1').items[i] || {}; return { cells: [`${r.name}${r.exempt ? ' (exempt)' : ''}`, r.cat, String(r.nn), `Fatigue ${r.lim}`, N(r.dem, 2), N(r.res, 2),
          r.exempt ? { t: 'exempt', cls: 'ok' } : R3(a.r, sel.includes(i) && a.step ? K(fk(i), a.step) : null)], cls: i === faI ? 'gov' : '' }; })),
        ...sel.map(i => gsteps('SBDFatigueUI:x', fk(i), window.SBDFatigueUI.stepsOf(R, 'fa', rows[i]), { lazy: all && i !== faI, title: rows[i].name }))])); }
    if (R.gs17) { const sel = all ? R.gs17.map((q, i) => i) : R.g17 ? [R.g17.i] : [];
      subs.push(sub('gs', 'Flange stress range (GS17; 6.6.1.2, 6.10.5.1)', [note(`Top flange Category ${R.cats.T}, bottom flange Category ${R.cats.B}; n by station (Table 6.6.1.2.5-1).`),
        tbl(['Station', 'n', 'Top: limit state', 'Top ratio', 'Bottom: limit state', 'Bottom ratio'], sel.map(i => { const q = R.gs17[i]; return { cells: [q.r.name, String(q.o.fatN), `Fatigue ${q.o.fatT.lim}`, R3(q.o.items[0].r, K(gk(i), q.o.items[0].step)), `Fatigue ${q.o.fatB.lim}`, R3(q.o.items[1].r, K(gk(i), q.o.items[1].step))], cls: R.g17 && R.g17.i === i ? 'gov' : '' }; })),
        ...sel.map(i => gsteps('SBDFatigueUI:x', gk(i), window.SBDFatigueUI.stepsOf(R, 'gs', R.gs17[i]), { lazy: all && !(R.g17 && R.g17.i === i), title: `${R.gs17[i].r.name} (GS17)` }))])); }
    if (!R.SR.errors.length) { const Sr = R.SR, C = R.SCC, cc = id => C.find(c => c.id === id) || { items: [] };
      subs.push(sub('sc', `Shear connectors (6.10.10): ${Sr.zones.length} pitch zones, ${Sr.regions.length} strength regions`, [
        kv([['Studs', `${f(Sr.d, 3)} × ${f(Sr.h, 2)} in`], ['$Q_{r}$', `${f(Sr.Qr, 2)} kip`, K('sc', 'sc.Qr')], ['$Z_{r}$ (Fatigue I)', `${f(Sr.Zr, 3)} kip`, K('sc', 'sc.ZrI')], ['$b_{eff}$', `${f(Sr.dk.beff, 2)} in (${Sr.beffMode === 'girder' ? "this girder's own" : 'bridge-wide'})`, K('sc', 'sc.beff')]]),
        tbl(['Zone', 'Studs', '$V_{f}$ (kip)', 'Limit state', '$V_{sr}$ (kip/in)', '$p_{max}$ (in)', 'SC1'], Sr.zones.map((z, i) => { const a = cc('SC1').items[i] || {}; return [z.name, `${z.nr} @ ${f(z.p, 2)} in`, N(z.Vfr, 1), `Fatigue ${z.fat.lim}`, N(z.Vsr, 3), N(z.preq, 2), R3(a.r, K('sc', `scz${z.i}.ok`))]; })),
        tbl(['Region', 'P (kip)', 'n required', 'n provided', 'SC2'], Sr.regions.map((r, i) => { const a = cc('SC2').items[i] || {}; return [r.name, N(r.P, 1), N(r.nreq, 2), `${r.nprov}${r.lost ? ` − ${r.lost}` : ''}`, R3(a.r, K('sc', `scr${r.i}.ok`))]; })),
        gsteps('SBDFatigueUI:x', 'sc', window.SBDFatigueUI.stepsOf(R, 'sc'), { lazy: all, title: 'Worked steps, shear connectors' })])); }
    return { title: 'Fatigue and studs', subs };
  }

  /* ---------- 9. constructibility ---------- */
  function cn(B, X) {
    const R = B.cn, rows = R.rows, all = X.detail === 'all', subs = [], sc = r => 'cn@' + rows.indexOf(r), oc = r => 'cnoh@' + R.oh.rows.indexOf(r);
    const keyOf = o => !o ? null : o.row.checks && o.row.conC ? K(sc(o.row), o.check.step) : R.oh ? K(oc(o.row), o.check.step) : null;
    const gset = new Set(); R.spans.forEach(s => ['top', 'bot', 'tens', 'shear'].forEach(k => { if (s[k] && s[k].row.conC) gset.add(s[k].row); })); if (R.gov) gset.add(R.gov);
    const shown = all ? rows : rows.filter(r => gset.has(r));
    const cell = o => !o ? '—' : { ...R3(o.ratio, keyOf(o)), t: `${f(o.ratio, 3)} (${o.row.conC ? '' : o.check.id + ', '}${f(o.row.x, 2)} ft)` };
    const ga = R.govAll;
    if (ga) X.gov.push({ mod: 'Constructibility', grp: 'Constructibility (deck placement)', check: `${ga.check.id} ${tt(ga.check.title)}`, loc: `x = ${f(ga.row.x, 2)} ft`, r: ga.ratio, key: keyOf(ga) });
    const wh = R.custom ? fromHtml(R.what) : B.src === 'file' ? `${B.plName || 'Hand-off file'}: ${R.F.locs.length} stations; $M_{DCc}$, $M_{CL}$, $V_{DC1}$, $V_{CL}$ from the file.` : `${gName(B.girder)}: ${R.F.locs.length} locations from this project's analysis (dead loads): $M_{DC1}$, $V_{DC1}$, ${R.F.seq ? '$M_{DCc}$ the noncomposite envelope of the deck placement sequence [[an.seq.MDCc]]' : 'no pour sequence ($M_{DC1}$)'}, construction live load $M_{CL}$, $V_{CL}$.`;
    subs.push(sub('gov', 'Governing ratio of each span', [note(`${wh} $M_{c}$ = 1.25$M_{DCc}$ + 1.50$M_{CL}$, $V_{u}$ = 1.25$V_{DC1}$ + 1.50$V_{CL}$ on the noncomposite steel section (3.4.2.1, 6.10.3.4.1); $\\phi_{f}$ = $\\phi_{v}$ = 1.0; ${R.D ? flNote(B, R.D, '[[tab:cn|Constructibility tab]]').replace('$f_{\\ell}$', '$f_{\\ell}$ during deck placement') : ''}.`),
      tbl(['Span', 'Top flange in compression', 'Bottom flange in compression', 'Tension flange', 'Shear (GS16)', ...(R.oh ? ['Overhang OH1–OH4', 'OH5'] : [])], R.spans.map(s => [String(s.span), cell(s.top), cell(s.bot), cell(s.tens), cell(s.shear), ...(R.oh ? [cell(s.oh), cell(s.ohfl)] : [])])),
      R.oh && R.oh.errors && R.oh.errors.length ? note('Overhang brackets: ' + R.oh.errors.join(' '), true) : null]));
    if (R.custom) subs.push(cdSub('cn', B));
    if (all) subs.push(sub('all', 'Results at every location', [tbl(['Location', 'x (ft)', '$M_{c}$ (kip-ft)', 'Flange in compression', 'Governing check', 'Ratio'], rows.map(r => ({ cells: [r.name, N(r.x, 2), N(r.Mc, 1), r.conC.lab, `${r.gov.id} ${tt(r.gov.title)}`, R3(r.gov.ratio, K(sc(r), r.gov.step))], cls: r === R.gov ? 'gov' : '' })))]));
    const one = r => [checksTbl(r, sc(r)), kv([['$M_{c}$', `${f(r.Mc, 1)} kip-ft`, K(sc(r), 'cn.Mc')], ['$L_{b}$ / $C_{b}$ (deck placement)', `${f(r.LbC, 2)} ft / ${f(r.CbCu, 3)}`, K(sc(r), 'cn.Cb')], ['$F_{nc}$ (FLB / LTB)', `${f(r.ltC.FLB, 2)} / ${f(r.ltC.LTB, 2)} ksi`, K(sc(r), 'cn.Fnc')]]),
      gsteps('SBDConstrUI:x', sc(r), window.SBDConstrUI.stepsOf(R, r), { title: 'Worked steps' })];
    shown.filter(r => gset.has(r)).forEach(r => subs.push(sub(sc(r), `${r.name}, x = ${f(r.x, 2)} ft${r === R.gov ? ' (governing)' : ''}`, one(r))));
    if (all) subs.push(sub('every', 'Every other location', rows.filter(r => !gset.has(r)).map(r => gsteps('SBDConstrUI:x', sc(r), window.SBDConstrUI.stepsOf(R, r), { lazy: true, title: `${r.name}, x = ${f(r.x, 2)} ft: ${r.gov.id}, ratio ${f(r.gov.ratio, 3)}` }))));
    if (R.oh && !(R.oh.errors && R.oh.errors.length)) { const O = R.oh;
      subs.push(sub('oh', 'Overhang brackets: flange lateral bending (exterior girder, OH1–OH5)', [kv([['$w_{u}$', `${f(O.wu, 4)} kip/ft`], ['$F_{\\ell}$ / $P_{\\ell}$', `${f(O.Fl, 4)} kip/ft / ${f(O.Pl, 3)} kip`, O.rows[0] ? K(oc(O.rows[0]), 'oh.Fl') : null]]),
        tbl(['Location', '$M_{u}$ (kip-ft)', '$M_{\\ell}$ (kip-in)', 'Governing', 'Ratio'], O.rows.map(o => [o.name, N(o.Mu, 1), N(o.Ml, 1), o.gov.id, R3(o.gov.ratio, K(oc(o), o.gov.step))])),
        ...O.rows.map(o => [checksTbl(o, oc(o)), gsteps('SBDConstrUI:x', oc(o), o.steps, { title: o.name })]).flat()])); }
    return { title: 'Constructibility (deck placement, 6.10.3)', subs };
  }

  /* ---------- 10. framing and cross-frames ---------- */
  function frm(B, X) {
    const { L, R, C, fl, XF, br, line, I } = B.frm, FR = L.FR, subs = [];
    let gov = null; (C || []).forEach(c => c.items.forEach(it => { if (isFinite(it.r) && (it.st === 'pass' || it.st === 'fail') && (!gov || it.r > gov.it.r)) gov = { c, it }; }));
    const svg = window.SBDFramingUI && window.SBDFramingUI.plan ? window.SBDFramingUI.plan(L) : '';
    const work = [...L.steps, ...fl.steps, ...(R.steps || [])], ids = new Set(work.map(t => t.id)), lk = id => (id && ids.has(id) ? id : null);   // an item's step, where the work has it
    if (gov) X.gov.push({ mod: 'Cross-frames', grp: 'Cross-frames', check: `${gov.c.id} ${gov.c.title}`, loc: gov.it.loc, r: gov.it.r, key: lk(gov.it.step) });
    subs.push(sub('pl', 'Framing plan (6.7.4.2.1)', [svg ? { type: 'figure', svg, caption: 'Plan: girders, bearing lines, cross-frames and field splices' } : null,
      tbl(['Span', 'Skew θ (°)', 'Orientation', 'Frames', 'Spacing (ft)'], FR.orient.map(o => [String(o.k + 1), N(o.th, 2), o.o === 'normal' ? `normal, ${o.flat ? 'contiguous' : o.arr}` : 'parallel to the skew', String(o.n), { ...N(o.s, 3), key: `fr.k${o.k}.s` }])),
      tbl(['Girder', 'Intermediate frames', 'Largest $L_{b}$ (ft)', 'Brace points (ft)'], L.girders.map(g => ({ cells: [`G${g.i + 1}`, String(g.nInt), { ...N(g.lb, 2), key: `fr.g${g.i}.lb` }, g.braces.map(v => f(v, 2)).join(', ')], cls: g.i === line ? 'gov' : '' }))),
      note(`The reported girder takes cross-section girder G${line + 1}: its brace points are the $L_{b}$ points of the flexure and the cross-frame bays of the stiffener panels (${br ? br.ints.length : 0} intermediate frames). As on the [[tab:cf|Cross-frames tab]].`)]));
    subs.push(sub('fl', 'Flange lateral bending from skew and cross-frame loads', [kv([[`$f_{\\ell}$ from skew, G${line + 1} (C6.10.1)`, `${f(fl.fl, 2)} ksi`, 'flsk.fl'], [`Cross-frame point loads on G${line + 1}`, XF ? `${XF.pts.length}, ${f(XF.tot, 2)} kip` : 'not included']])]));
    if (C) subs.push(sub('ck', `Checks (CF1 to CF11${C.some(c => c.id === 'CFD') ? ', CFD, CFE' : ''})`, [kv([['S (largest spacing)', `${f(I.p.S, 2)} in`], ['h / d', `${f(I.p.h, 2)} / ${f(I.p.dg, 2)} in`, 'cf.dg'], ['$L_{b}$ (largest)', `${f(I.p.Lb, 2)} ft`, 'cf.Lb']]),
      R.errors && R.errors.length ? note(R.errors.join(' '), true) : null,
      tbl(['Check', 'Item', 'Demand', 'Resistance / limit', 'Ratio', 'Status'], C.flatMap(c => c.items.length ? c.items.map(it => [`${c.id} ${c.title}`, it.loc, isFinite(it.demand) ? N(it.demand, 2) : (it.cells || [])[0] || '', isFinite(it.capacity) ? N(it.capacity, 2) : (it.cells || [])[1] || '',
        isFinite(it.r) ? R3(it.r, lk(it.step)) : { t: '—', key: lk(it.step) }, { pass: 'OK', fail: 'Fail', warn: 'Warning', adv: 'Advisory', na: 'n/a' }[it.st] || it.st]) : [[`${c.id} ${c.title}`, { t: c.naWhy || 'n/a', cls: 'na' }, '', '', '', 'n/a']])),
      note(`References: ${C.map(c => `${c.id} ${c.ref}`).join('; ')}.`)]));
    if (R.frames) subs.push(sub('mf', 'Member forces (truss model)', [tbl(['Member', 'Length (in)', 'per kip of $F_{w}$', ...R.combos.map(c => `${c.id} T / C (kip)`)], R.frames.map((e, i) => [e.lbl, N(e.L, 2), { ...N(e.unit, 3), key: `cf.tr${i}` }, ...R.combos.map(c => `${f(c.f[i].T, 2)} / ${f(c.f[i].Cc, 2)}`)]))]));
    subs.push(sub('w', 'Worked steps', [gsteps('SBDFramingUI:x', '', work)]));
    return { title: 'Framing and cross-frames', subs };
  }

  /* ---------- 11. field splices ---------- */
  function spl(B, X) {
    const G = B.spl, SP = window.SBDSplices, subs = [], STT = { pass: 'OK', fail: 'NG', warn: 'Warning', adv: 'Advisory', na: 'n/a' };
    const strGov = CK => { let b = null; (CK || []).filter(c => /^(TF|BF)[1245]$|^WS[1245]$/.test(c.id)).forEach(c => c.items.forEach(it => { if (it.r != null && isFinite(it.r) && (!b || it.r > b.it.r)) b = { c, it }; })); return b; };
    // summary: the splice with the largest strength ratio
    const sg = G.list.reduce((b, s, k) => { const q = strGov(s.CK); return q && (!b || q.it.r > b.q.it.r) ? { s, q, k } : b; }, null);
    if (sg) X.gov.push({ mod: 'Field splices', grp: 'Field splices', check: `${sg.q.c.id} ${tt(sg.q.c.title)}`, loc: `${sg.s.name}, ${sg.q.it.loc}`, r: sg.q.it.r, key: K('spl@' + sg.k, sg.q.it.step) });
    subs.push(sub('list', `Splices of ${gName(B.girder)}`, [note("Demands: this project's analysis, moments at the analysis station nearest the splice and shears the largest of the element containing it and its neighbours (GirderDetail's rule); sections 0.01 ft each side, the smaller carries the design forces (6.13.6.1.1). As on the [[tab:spl|Field splices tab]]."),
      G.errors.length ? note(G.errors.join(' '), true) : null,
      tbl(['Splice', 'Plates and bolts', 'Governing', 'Ratio', 'Largest strength ratio', 'Status'], G.list.map((s, k) => { const fl = s.R && s.R.fl, gv = s.gov, q = strGov(s.CK), bad = s.CK ? s.CK.filter(c => c.status === 'fail').length : 0;
        return [s.name, fl ? `${s.own ? 'entered' : 'auto'}: ${fl.top.n + fl.bot.n + s.R.web.nw} bolts each side` : '—', gv ? `${gv.c.id} ${gv.it.loc}` : s.R && s.R.errors.length ? s.R.errors[0] : '', gv ? R3(gv.it.r, K('spl@' + k, gv.it.step)) : '—',
          q ? { ...R3(q.it.r, K('spl@' + k, q.it.step)), t: `${q.c.id}: ${f(q.it.r, 3)}` } : '—', s.CK ? (bad ? `${bad} check${bad > 1 ? 's' : ''} NG` : 'OK') : 'input error']; }))]));
    G.list.forEach((s, k) => { const R = s.R, sc = 'spl@' + k, d = s.p.dem, items = [];
      if (s.warn && s.warn.length) items.push(note(s.warn.join(' '), true));
      items.push(kv([['$M_{DC1}$ / $M_{DC2}$ / $M_{DW}$', `${f(d.MDC1, 1)} / ${f(d.MDC2, 1)} / ${f(d.MDW, 1)} kip-ft`], ['$M_{LL+IM}^{+}$ / $M_{LL+IM}^{-}$', `${f(d.MLLp, 1)} / ${f(d.MLLn, 1)} kip-ft`], ['$M_{CL}$', `${f(d.MCL, 1)} kip-ft`],
        ['$V_{DC1}$ / $V_{DC2}$ / $V_{DW}$ / $V_{LL+IM}$ / $V_{CL}$', `${f(d.VDC1, 1)} / ${f(d.VDC2, 1)} / ${f(d.VDW, 1)} / ${f(d.VLL, 1)} / ${f(d.VCL, 1)} kip`], ['$\\Delta M_{fat}$ + / −', `${f(d.dMp, 1)} / ${f(d.dMn, 1)} kip-ft`]]));
      items.push(note(`Unfactored, per girder; moments at the analysis station x = ${f(s.dm.xi, 2)} ft (Analysis section), shears the largest magnitude of elements ${s.dm.e} ± 1.${s.design ? ` Auto-design${s.design.ok ? '' : ' (not every check passes)'}: ${s.design.msg}` : ''}`));
      if (R && !R.errors.length) {
        items.push(note(`Top flange: ${R.fl.top.nl} line(s) each side × ${R.fl.top.nr} rows, outer PL ${SP.frac(R.fl.top.bo)} × ${SP.frac(R.fl.top.to)}${R.fl.top.inner ? `, 2 inner PL ${SP.frac(R.fl.top.bi)} × ${SP.frac(R.fl.top.ti)}` : ''}. Bottom flange: ${R.fl.bot.nl} line(s) × ${R.fl.bot.nr} rows, outer PL ${SP.frac(R.fl.bot.bo)} × ${SP.frac(R.fl.bot.to)}${R.fl.bot.inner ? `, 2 inner PL ${SP.frac(R.fl.bot.bi)} × ${SP.frac(R.fl.bot.ti)}` : ''}. Web: 2 PL ${SP.frac(R.web.hw)} × ${SP.frac(R.web.twp)}, ${R.web.nrw} rows × ${R.web.ncw} column(s) each side. Bolts ${SP.frac(R.bolt.d)} in ${s.p.bolts.gr}; plates ${s.p.sec.gP}.`));
        const dw = SP.svg(R); if (dw) items.push({ type: 'figure', svg: dw.flange + dw.web, caption: 'Plan of the bottom flange splice and elevation of the web splice, to scale' });
      } else if (R) items.push(note(R.errors.join(' '), true));
      if (s.CK) { items.push(tbl(['ID', 'Check', 'Governing item', 'Ratio', 'Status', ED], s.CK.map(c => { const it = c.gov >= 0 ? c.items[c.gov] : null;
          return [c.id, tt(c.title), it ? it.loc : c.naWhy || '', it && it.r != null ? R3(it.r, K(sc, it.step)) : { t: '—', key: it ? K(sc, it.step) : null }, STT[c.status] || c.status, String(c.ref).replace('AASHTO LRFD 10th Ed. ', '')]; })));
        items.push(gsteps('SBDSplicesUI:x', sc, SP.steps(R).concat(s.CK.steps), { title: 'Worked steps', lazy: !sg || sg.k !== k })); }   // the governing splice open, the others on demand
      subs.push(sub(sc, s.name, items)); });
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
    const wSteps = q => WT.steps(R, q.k, q.i).map(t => (t.note && /§sec\.(s|c3|cn|cr)\b(?!\.\w)/.test(t.note) ? { ...t, note: t.note.replace(/§sec\.(s|c3|cn|cr)\b(?!\.\w)/g, '§sec.$1.yb') } : t));
    // governing rows: the flange-to-web welds (FW1–FW4) and the shop transitions (TR1–TR4), the largest ratio of each
    const gv = ids => { let b = null; C.filter(c => ids.test(c.id)).forEach(c => c.items.forEach(it => { if (num(it) && (!b || it.r > b.it.r)) b = { c, it }; })); return b; };
    const bad = ids => C.filter(c => ids.test(c.id)).flatMap(c => c.items.filter(it => !num(it) && (it.st === 'fail' || it.st === 'warn')).map(it => ({ c, it })));
    const sel = new Set();
    [[/^FW/, 'Welds: flange-to-web (FW1–FW4)'], [/^TR/, 'Welds: shop flange transitions (TR1–TR4)']].forEach(([ids, grp]) => { const q = gv(ids); if (!q) return;
      const L = locOf(q.it); if (L) sel.add(scOf(L));
      X.gov.push({ mod: 'Welds', grp, check: `${q.c.id} ${tt(q.c.title)}`, loc: q.it.loc, r: q.it.r, key: keyOf(q.it), ...(q.it.st === 'warn' ? { status: 'warn' } : {}) });
      bad(ids).forEach(z => X.warn.push(`Welds: ${z.c.id} ${z.it.loc}: ${STT[z.it.st] || z.it.st}.`)); });
    subs.push(sub('gov', `Governing checks, ${gName(Bw.g)}`, [note(`${fromHtml(Bw.what)} Two fillet welds per flange; DC1 and utilities on the steel, DC2 and DW on the long-term (3n), LL+IM and the fatigue shear range on the short-term (n) composite section. $\\gamma_{DC}$ ${f(R.g.dc, 3)}, $\\gamma_{DW}$ ${f(R.g.dw, 3)}, $\\gamma_{LL}$ ${f(R.g.ll, 3)}, $\\gamma_{fat}$ ${f(R.g.fat, 2)}; n = ${f(R.MR.n, 3)}. As on the [[tab:wt|Welds tab]]. ${ED}.`),
      tbl(['Check', 'Governing location', 'Ratio', 'Status', 'Reference'], C.map(c => { const it = c.gov >= 0 ? c.items[c.gov] : null;
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
    return { title: 'Welds (flange-to-web, shop transitions)', subs };
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
    subs.push(sub('gov', 'Governing rating factors (HL-93 design load)', [note(`${fromHtml(R.what)} LRFR (MBE 6A.4.2): RF = (C − $\\gamma_{DC}$DC − $\\gamma_{DW}$DW ± $\\gamma_{P}$P)/($\\gamma_{LL}$(LL+IM)), C = $\\phi_{c}\\phi_{s}\\phi R_{n}$ with $\\phi_{c}\\phi_{s}$ ≥ 0.85; Strength I $\\gamma_{LL}$ 1.75 Inventory, 1.35 Operating; Service II 1.30 / 1.00 (Table 6A.4.2.2-1). $\\phi_{c}$ = ${f(B.P.rating ? B.P.rating.phiC : 1, 2)}, $\\phi_{s}$ = ${f(B.P.rating ? B.P.rating.phiS : 1, 2)}. As on the [[tab:rt|Rating tab]].`),
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
    if (caps.length) subs.push(sub('cap', 'Capacities used by the rating (worked here: not shown in an earlier section of this report)', caps));
    if (R.custom) { subs.push(cdSub('flex', B)); subs[subs.length - 1].id = 'cdf'; subs.push(cdSub('shear', B)); subs[subs.length - 1].id = 'cds'; }   // the tables the rating took (custom demands PR)
    return { title: 'Load rating (LRFR, design load)', subs };
  }

  /* ---------- 1. summary ---------- */
  /* the summary graphic (tab graphics B, engine/tabgraphics-b.js): a small girder elevation with the governing check of each group at its location, in the
     Drawings-tab format, as a static SVG figure (display only: the rows of the table below); none when the graphics modules are not loaded */
  function summaryFig(B, X) {
    const G = window.SBDTabGfxB, D = window.SharedDxf; if (!G || !D || !window.SBDGraphics) return null;
    try { const g = G.summary({ gov: X.gov }, B.P, { gi: B.g }); return { type: 'figure', svg: (window.SBDGraphics && window.SBDGraphics.tightSvg ? window.SBDGraphics.tightSvg : (DD, o) => D.toSVG(DD, o))(g.D, { i0: g.i0, i1: g.i1, bg: '#fff', title: g.title, width: '100%' }), caption: `Governing check of each group along girder ${gName(B.girder)} (the rows of the table below; ratio, or rating factor RF).` }; }
    catch (e) { return null; }
  }
  function summary(B, X, built) {
    const rows = X.gov.map(q => q.rf != null
      ? { cells: [q.mod, q.check, q.loc, { t: `RF ${isFinite(q.rf) ? f(q.rf, 2) : '—'}`, n: true, cls: !isFinite(q.rf) ? '' : q.rf < 1 - 1e-9 ? 'ng' : q.rf < 1.1 ? 'hi' : 'ok', key: q.key }, isFinite(q.rf) ? (q.rf >= 1 - 1e-9 ? 'OK' : 'RF < 1') : '—'] }
      : { cells: [q.mod, q.check, q.loc, R3(q.r, q.key), q.status === 'warn' ? 'Warning' : okT(q.r)], cls: q.r > 1 + 1e-9 ? 'gov' : '' });
    const errs = Object.entries(B.err).filter(([k]) => built.includes(k) || k === 'all');
    const top = X.gov.filter(q => q.rf == null && isFinite(q.r)).reduce((a, q) => (!a || q.r > a.r ? q : a), null);
    return { title: 'Summary of governing ratios', subs: [sub('gov', `Girder ${gName(B.girder)}: governing demand / capacity of each check group`, [
      note(`Each ratio links to the step that works it. Ratio = demand / capacity (OK ≤ 1.0); rating factors RF (OK ≥ 1.0). Demands: ${B.src === 'file' ? `the hand-off file ${B.plName || ''} for flexure, shear, fatigue, constructibility and rating; this project for the rest` : B.custom ? `entered on the tab (Custom) for ${cdMods(B)}; this project's analysis for the rest` : "this project's analysis"}. ${ED}.`),
      top ? note(`Largest ratio: ${f(top.r, 3)} (${top.mod}, ${top.check}, ${top.loc})${top.key ? ` [[${top.key}]]` : ''}.`) : null,
      summaryFig(B, X),
      tbl(['Module', 'Check', 'Location', 'Ratio / RF', 'Status'], rows, { wide: true }),
      ...X.warn.map(w => note(w, true)),
      errs.length ? note('Not in this report: ' + errs.map(([k, v]) => `${(SECTIONS.find(s => s[0] === k) || [k, k])[1]}: ${v}`).join('; '), true) : null])] };
  }

  const BUILD = { proj, loads, an, sec, flex, shear, fat, cn, frm, spl, wd, rt };
  const NEED = { loads: 'loads', an: 'an', sec: 'sec', flex: 'flex', shear: 'shear', fat: 'fat', cn: 'cn', frm: 'frm', spl: 'spl', wd: 'wd', rt: 'rating' };
  function model(B, opt) {
    opt = opt || {};
    const inc = opt.include || null, on = k => !inc || inc[k] !== false, X = { detail: opt.detail === 'all' ? 'all' : 'gov', have: new Map(), gov: [], warn: [] };
    const P = B.P, p = P.project || {}, secs = [], built = [], dropped = [];
    const dataOf = { loads: B.loads, an: B.src === 'file' ? B.pl : B.an, sec: B.sec, flex: B.flex, shear: B.shear, fat: B.fat, cn: B.cn, frm: B.frm, spl: B.spl, wd: B.wd, rt: B.rating };
    SECTIONS.forEach(([k, label]) => {
      if (k === 'sum') return;
      const want = on(k);
      if (k === 'proj') { if (want) secs.push({ id: k, ...proj(B, X) }); return; }
      if (k === 'spl' && B.src === 'file') { if (want) secs.push({ id: k, title: 'Field splices', subs: [sub('n', 'Not in this report', [note('Field splices are designed from this project\'s analysis; this report takes its demands from a hand-off file. Choose "This project\'s analysis" to include them, or see the [[tab:spl|Field splices tab]].')])] }); return; }
      if (!dataOf[k]) { if (want) { built.push(k); secs.push({ id: k, title: label, subs: [sub('n', 'Not available', [note(B.err[k] || B.err[NEED[k]] || B.err.all || 'Not calculated.', true)])] }); } return; }
      // every module is built (the summary links to its governing check; references into it are found below); a section not chosen is dropped
      const g0 = X.gov.length, h0 = new Set(X.have.keys());
      let s; try { s = BUILD[k](B, X); } catch (e) { s = { title: label, subs: [sub('n', 'Not available', [note('Report error: ' + (e && e.message), true)])] }; }
      if (want) { built.push(k); secs.push({ id: k, ...s }); return; }
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
    const girder = B.girder;
    return { title: 'Steel Bridge Design', subtitle: `Calculation report: girder ${gName(girder)}${p.name ? ', ' + p.name : ''}`, code: `${ED}; MBE (load rating). ${X.detail === 'all' ? 'Every station worked.' : 'Governing location of each check worked.'}`,
      info: [['Project No', p.number], ['Computed by', p.designer], ['Date', p.date], ['Project', p.name], ['Checked by', p.checker], ['Owner', window.SBDModel.clientName(P)]],
      head: { left: `${p.name || 'Steel Bridge Design'}${p.number ? ' (' + p.number + ')' : ''}\nGirder ${gName(girder)}`, right: `Computed by: ${p.designer || '—'}  Date: ${p.date || '—'}\nChecked by: ${p.checker || '—'}`, foot: `Steel Bridge Design, ${ED}` },
      sections: secs, gov: X.gov };
  }

  /* ---------- every girder at once (added 2026-10-30, report wiring PR) ---------- */
  /* govRows(B): one girder's summary rows (model(B).gov: each check group's governing ratio or RF, the modules' own values), as plain data */
  function govRows(B) {
    const M = model(B, { detail: 'gov' });
    return { rows: M.gov.map(q => ({ grp: q.grp || q.mod, mod: q.mod, check: q.check, loc: q.loc, r: q.r, rf: q.rf, status: q.status })), err: { ...B.err } };
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
      low ? note(`Lowest rating factor: ${low.G.label}, ${low.q.check.replace(/,.*$/, '')} ${f(low.q.rf, 2)} (${low.q.loc}).`, low.q.rf < 1 - 1e-9) : null,
      tbl(head, rows, { wide: true }),
      errs.length ? note('Not in this summary: ' + errs.map(G => `${G.label}: ${Object.entries(G.err).map(([k, v]) => `${(SECTIONS.find(s => s[0] === k) || [k, k])[1]} ${v}`).join('; ')}`).join(' | '), true) : null])];
    const per = list.map((G, k) => sub('g' + k, `Girder ${G.label}${top && G === top.G ? ' (controls)' : ''}`, [
      tbl(['Module', 'Check', 'Location', 'Ratio / RF', 'Status'], (G.rows || []).map(q => q.rf != null
        ? [q.mod, q.check, q.loc, { t: `RF ${isFinite(q.rf) ? f(q.rf, 2) : '—'}`, n: true, cls: !isFinite(q.rf) ? '' : q.rf < 1 - 1e-9 ? 'ng' : q.rf < 1.1 ? 'hi' : 'ok' }, isFinite(q.rf) ? (q.rf >= 1 - 1e-9 ? 'OK' : 'RF < 1') : '—']
        : { cells: [q.mod, q.check, q.loc, R3(q.r), q.status === 'warn' ? 'Warning' : okT(q.r)], cls: q.r > 1 + 1e-9 ? 'gov' : '' }), { wide: true })]));
    return { title: 'Steel Bridge Design', subtitle: `Calculation report: every girder (governing ratios)${p.name ? ', ' + p.name : ''}`, code: `${ED}; MBE (load rating). Governing ratio of each check group, every girder; each value is worked in that girder's own report.`,
      info: [['Project No', p.number], ['Computed by', p.designer], ['Date', p.date], ['Project', p.name], ['Checked by', p.checker], ['Owner', window.SBDModel.clientName(P)]],
      head: { left: `${p.name || 'Steel Bridge Design'}${p.number ? ' (' + p.number + ')' : ''}\nEvery girder`, right: `Computed by: ${p.designer || '—'}  Date: ${p.date || '—'}\nChecked by: ${p.checker || '—'}`, foot: `Steel Bridge Design, ${ED}` },
      sections: [{ id: 'all', title: 'Summary of every girder', subs }, { id: 'per', title: 'Governing checks of each girder', subs: per }], top, low, ctl: C };
  }

  window.SBDReportBuild = { SECTIONS, model, govRows, allModel };
})();
