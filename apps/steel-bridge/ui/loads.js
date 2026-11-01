/* apps/steel-bridge/ui/loads.js — the "Cross-section & loads" input tab and the "Loads & LLDF" output tab (window.SBDUiLoads).
   Classic script. Reads window.SBDModel, SBDOwners, SBDLoads, SBDLldf, SharedSteps, SharedUnits at call time. The page (index.html)
   calls: ensure(P) before drawing the inputs; inputs(P, helpers) for the input pane; onChange / onClick from its input listeners
   (true = handled, the page then saves and redraws); calc(P, g) when Calculate runs; output(R, ui, errors) for the output tab;
   onOutChange(e, ui) from the output listener. No storage of its own: the project is saved by the page (sbd2.* keys). */
(function () {
  'use strict';
  const S = () => window.SharedSteps, U = () => window.SharedUnits, O = () => window.SBDOwners, LD = () => window.SBDLoads;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (x, d) => typeof x === 'number' && isFinite(x) ? U().fmt(x, d) : '—';
  const get = (P, path) => path.split('.').reduce((o, k) => o == null ? o : o[k], P);
  const setp = (P, path, v) => { const ks = path.split('.'), last = ks.pop(), o = ks.reduce((a, k) => (a[k] == null ? (a[k] = {}) : a[k]), P); o[last] = v; };

  /* ensure(P): a version 1 project saved before this tab gets the default cross-section and owner (additive; nothing else changes) */
  function ensure(P) {
    if (!P.xs) P.xs = window.SBDModel.defaultXs(P);
    if (!P.ownerRules) P.ownerRules = { owner: 'AASHTO', eta: { D: 'no', R: 'auto', I: 'no', eD: 1, eR: 1, eI: 1 } };
    if (!P.ownerRules.eta) P.ownerRules.eta = { D: 'no', R: 'auto', I: 'no', eD: 1, eR: 1, eI: 1 };
  }

  /* applyOwnerDefaults(P): the "Apply <DOT> defaults" button. The same assignments as before (deck.tsac sets the total deck thickness to t_s + the
     sacrificial thickness; xs.ws.psf also switches the wearing surface to weight mode); the inputs it changes are recorded, UI message only:
     { owner, changes: [{ tab, field, unit, from, to }], same: [{ tab, field }] } (same: already at the default). Nothing computed changes. */
  const OD_LABEL = { 'materials.concrete.fc': ['Materials & deck', 'Concrete f′c', 'ksi'], 'deck.tdeck': ['Materials & deck', 'Total deck thickness', 'in'],
    'materials.concrete.wcE': ['Cross-section & loads', 'w_c for E_c only', 'kcf'], 'xs.ws.psf': ['Cross-section & loads', 'Future wearing surface', 'psf'],
    'xs.ws.mode': ['Cross-section & loads', 'Wearing surface entered as', ''], 'xs.dlMethod': ['Cross-section & loads', 'Dead load distribution', ''] };
  let lastOwnDef = null;
  function odText(path, v) {
    if (v == null || (typeof v === 'number' && !isFinite(v)) || v === '') return '(blank)';
    if (path === 'xs.ws.mode') return v === 'psf' ? 'Weight (psf)' : v === 'thk' ? 'Thickness × unit weight' : String(v);
    if (path === 'xs.dlMethod') return LD().METHODS[v] || String(v);
    return String(v);
  }
  function applyOwnerDefaults(P) {
    const owner = P.ownerRules.owner, changes = [], same = [];
    const assign = (path, v) => { const old = get(P, path); setp(P, path, v); const lab = OD_LABEL[path] || ['', path, ''];
      if (old === v) same.push({ tab: lab[0], field: lab[1] }); else changes.push({ tab: lab[0], field: lab[1], unit: lab[2], from: odText(path, old), to: odText(path, v) }); };
    O().defaults(owner).forEach(d => {
      if (d.path === 'deck.tsac') assign('deck.tdeck', P.deck.ts + d.value);
      else { assign(d.path, d.value); if (d.path === 'xs.ws.psf') assign('xs.ws.mode', 'psf'); } });
    return { owner, changes, same };
  }
  /* takeOwnerDefaults(): the record of the last "Apply defaults" click (once), or null. The page shows it as a message. */
  function takeOwnerDefaults() { const r = lastOwnDef; lastOwnDef = null; return r; }

  /* ---------- inputs ---------- */
  /* ownerCard(P, h): the "Bridge owner (DOT) rules" card. The page (index.html) draws it on the Project input tab, under the Project card
     (moved from the Cross-section & loads tab, UI only: same paths ownerRules.*, same ownDef button, handled by onClick below). */
  function ownerCard(P, h) {
    const own = P.ownerRules, o = own.owner, rI = O().rule(o, 'ld.etaI'), rD = O().rule(o, 'ld.etaD'), rR = O().rule(o, 'ld.etaR');
    const yn = [['no', 'No'], ['yes', 'Yes']];
    const defs = O().defaults(o);
    return h.card('Bridge owner (DOT) rules', `${h.sel('ownerRules.owner', 'Client / owner (DOT)', O().LIST.map(k => [k, k === 'AASHTO' ? 'AASHTO (no owner rules)' : `${k} (${O().RULES.owners[k].short})`]))}
      ${o === 'AASHTO' ? `${h.num('ownerRules.eta.eD', 'η<sub>D</sub>', '')}${h.num('ownerRules.eta.eR', 'η<sub>R</sub>', '')}${h.num('ownerRules.eta.eI', 'η<sub>I</sub>', '')}`
        : `${rD && !rD.value.fixed ? h.sel('ownerRules.eta.D', 'Nonductile components (η<sub>D</sub>)', yn) : ''}${rR ? h.sel('ownerRules.eta.R', 'Nonredundant (η<sub>R</sub>)', [['auto', 'Automatic (3 girders or fewer)'], ['no', 'No'], ['yes', 'Yes']]) : ''}${rI ? h.sel('ownerRules.eta.I', esc(rI.value.q || 'η<sub>I</sub> question'), yn) : ''}`}
      <p class="note">${esc(O().RULES.owners[o].manual)}. The owner's load rules (η, design load multiplier m, haunch in the section properties) are worked on the Loads &amp; LLDF tab.</p>
      ${defs.length ? `<p class="note">${esc(o)} defaults: ${defs.map(d => `${esc(d.label)} ${esc(d.show)} (${esc(d.cite)})`).join('; ')}.</p><button type="button" data-xsact="ownDef">Apply ${esc(o)} defaults</button>` : ''}`);
  }
  function inputs(P, h) {
    const x = P.xs;
    const opt = (path, label, unit, note) => `<div class="fRow"><label for="i_${path}">${label}</label><input type="number" step="any" id="i_${path}" data-path="${path}" data-kind="xopt" value="${esc(get(P, path) == null ? '' : get(P, path))}" placeholder="${esc(note || '')}"><span class="unit">${unit || ''}</span></div>`;
    const list = (path, label, unit) => `<div class="fRow"><label for="i_${path}">${label}</label><input type="text" id="i_${path}" data-path="${path}" data-kind="xlist" value="${esc((get(P, path) || []).join(', '))}" style="width:180px"><span class="unit">${unit}</span></div>`;
    const tf = [['false', 'No'], ['true', 'Yes']];
    const edge = sd => { const k = `xs.edges.${sd}.`, e = x.edges[sd], s = sd === 'L' ? 'Left' : 'Right';
      return `${h.sel(k + 'type', `${s} deck edge`, [['barrier', 'Barrier'], ['curb', 'Curb and railing']])}
        ${e.type === 'curb' ? `${h.num(k + 'cw', `${s} curb width`, 'in')}${h.num(k + 'ch', `${s} curb height`, 'in')}${h.num(k + 'rw', `${s} railing weight`, 'klf')}${h.num(k + 'rp', `${s} railing load point from edge`, 'ft')}${opt(k + 'rf', `${s} railing traffic face from edge`, 'ft', 'blank = load point')}`
          : `${h.num(k + 'bw', `${s} barrier width at deck`, 'ft')}${h.num(k + 'bwt', `${s} barrier weight`, 'klf')}`}${opt(k + 'face', `${s} edge to traffic face`, 'ft', 'optional')}`; };
    const sw = sd => { const k = `xs.sidewalks.${sd}.`, s = sd === 'L' ? 'Left' : 'Right';
      return `${h.num(k + 'w', `${s} sidewalk width`, 'ft')}${h.num(k + 't', `${s} sidewalk thickness`, 'in')}${opt(k + 'fence', `${s} sidewalk railing / fence`, 'klf', 'none')}${opt(k + 'fenceX', `${s} fence from deck edge`, 'ft', 'none')}`; };
    const cats = Object.entries(LD().CATS), dists = [['auto', 'Follows the method'], ['pilecap', 'MassDOT pile-cap'], ['equal', 'Equal (all beams)'], ['two', 'Two adjacent beams']];
    const cell = (path, kind, v, w) => `<td><input type="${kind === 'text' ? 'text' : 'number'}" step="any" data-path="${path}" data-kind="${kind}" value="${esc(v)}" style="width:${w || 62}px"></td>`;
    const scell = (path, opts, v) => `<td><select data-path="${path}" data-kind="sel" style="width:auto">${opts.map(([k, t]) => `<option value="${esc(k)}"${String(v) === String(k) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></td>`;
    const extra = `<div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Description</th><th>Category</th><th>x<br>ft</th><th>w<br>klf</th><th>Distribution</th><th></th></tr></thead><tbody>
      ${(x.extra || []).map((r, i) => `<tr>${cell(`xs.extra.${i}.name`, 'text', r.name, 120)}${scell(`xs.extra.${i}.cat`, cats, r.cat)}${cell(`xs.extra.${i}.x`, 'num', r.x)}${cell(`xs.extra.${i}.plf`, 'num', r.plf)}${scell(`xs.extra.${i}.dist`, dists, r.dist)}<td><button type="button" data-xsact="delExtra" data-i="${i}" title="Remove this load">×</button></td></tr>`).join('')}
      </tbody></table></div><button type="button" data-xsact="addExtra">Add line load</button><p class="note">x from the left deck edge. Utilities (UT, UF) act on the noncomposite section (MassDOT 3.5.5).</p>`;
    const ovl = `<div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Overlay</th><th>Entered as</th><th>psf</th><th>t<br>in</th><th>γ<br>kcf</th><th></th></tr></thead><tbody>
      ${(x.overlays || []).map((r, i) => `<tr>${cell(`xs.overlays.${i}.name`, 'text', r.name, 120)}${scell(`xs.overlays.${i}.mode`, [['psf', 'Weight (psf)'], ['thk', 'Thickness × unit weight']], r.mode)}${cell(`xs.overlays.${i}.psf`, 'xopt', r.psf == null ? '' : r.psf)}${cell(`xs.overlays.${i}.thk`, 'xopt', r.thk == null ? '' : r.thk)}${cell(`xs.overlays.${i}.gam`, 'xopt', r.gam == null ? '' : r.gam)}<td><button type="button" data-xsact="delOvl" data-i="${i}" title="Remove this overlay">×</button></td></tr>`).join('')}
      </tbody></table></div><button type="button" data-xsact="addOvl">Add overlay</button>`;
    return h.card('Girders and deck', `${h.num('xs.nb', 'Number of girders N<sub>b</sub>', '')}${list('xs.bays', 'Girder spacings', 'ft, left to right')}${h.num('xs.ohL', 'Left overhang (girder ℄ to deck edge)', 'ft')}${h.num('xs.ohR', 'Right overhang', 'ft')}
        ${list('xs.skews', 'Support skews', '°, one per support line')}${opt('materials.concrete.wcE', 'w<sub>c</sub> for E<sub>c</sub> only', 'kcf', 'blank = w_c')}
        <p class="note">Deck thickness, haunch, f′c and w<sub>c</sub>: Materials &amp; deck tab. The total deck thickness above the structural slab is dead load only. The LLDF regions take their sections from the girder selected on the Girders &amp; plates tab.</p>`)
      + h.card('Deck edges', `${edge('L')}<hr>${edge('R')}<p class="note">Distances from the deck edge. A curb lower than 12 in is mountable (the railing face governs); an entered edge to traffic face governs.</p>`)
      + h.card('Sidewalks and median', `${sw('L')}${sw('R')}${h.num('xs.sidewalks.ped', 'Pedestrian load', 'psf')}${h.num('xs.median.w', 'Raised median width', 'ft')}${h.num('xs.median.t', 'Median thickness', 'in')}${h.sel('xs.median.joint', 'Longitudinal joint at the median', tf, String(!!x.median.joint))}${opt('xs.wcA', 'Curb / sidewalk / median concrete', 'kcf', 'blank = w_c')}
        <p class="note">A sidewalk thinner than 12 in is mountable and does not move the live-load traffic face.</p>`)
      + h.card('Wearing surface, forms and steel', `${h.sel('xs.ws.mode', 'Wearing surface entered as', [['psf', 'Weight (psf)'], ['thk', 'Thickness × unit weight']])}${x.ws.mode === 'thk' ? `${opt('xs.ws.thk', 'Wearing surface thickness', 'in')}${opt('xs.ws.gam', 'Wearing surface unit weight', 'kcf')}` : h.num('xs.ws.psf', 'Future wearing surface', 'psf')}
        ${ovl}${h.num('xs.sip', 'Stay-in-place forms', 'psf')}${h.num('xs.allow', 'Steel detail allowance', '%')}`)
      + h.card('Utilities and other line loads', extra)
      + h.card('Distribution', `${h.sel('xs.dlMethod', 'Dead load distribution', Object.entries(LD().METHODS))}${h.num('xs.lldf.gap', 'Gap between adjacent trucks', 'ft')}
        ${h.sel('xs.lldf.kg', 'K<sub>g</sub>', [['max', 'At the region section'], ['avg', 'Length-weighted over the region'], ['simple', 'Simplified terms (Table 4.6.2.2.1-3)']])}
        ${h.sel('xs.lldf.skewV', 'Shear skew correction', [['all', 'All girders'], ['ext', 'Exterior girders only']])}${h.sel('xs.lldf.extMin', 'Exterior not less than interior', tf, String(!!x.lldf.extMin))}`);
  }
  /* onChange(el, P): the kinds this tab adds; true = handled */
  function onChange(el, P) {
    const path = el.dataset.path, k = el.dataset.kind; if (!path) return false;
    if (k === 'xlist') { setp(P, path, el.value.split(/[,;\s]+/).filter(Boolean).map(Number)); return true; }
    if (k === 'xopt') { setp(P, path, el.value.trim() === '' ? null : Number(el.value)); return true; }
    if (path === 'xs.nb') { const n = Math.round(Number(el.value)), B = P.xs.bays || []; P.xs.nb = n;
      if (n >= 2 && n < 100) { const last = B.length ? B[B.length - 1] : 9.5; P.xs.bays = Array.from({ length: n - 1 }, (_, i) => i < B.length ? B[i] : last); } return true; }
    if (path === 'xs.median.joint' || path === 'xs.lldf.extMin') { setp(P, path, el.value === 'true'); return true; }
    return false;
  }
  function onClick(e, P) {
    const b = e.target.closest('[data-xsact]'); if (!b) return false; const a = b.dataset.xsact, x = P.xs;
    if (a === 'addExtra') x.extra.push({ name: `Line load ${x.extra.length + 1}`, cat: 'DW', x: 0, plf: 0, dist: 'auto' });
    else if (a === 'delExtra') x.extra.splice(+b.dataset.i, 1);
    else if (a === 'addOvl') x.overlays.push({ name: `Overlay ${x.overlays.length + 1}`, mode: 'psf', psf: 0, thk: null, gam: null });
    else if (a === 'delOvl') x.overlays.splice(+b.dataset.i, 1);
    else if (a === 'ownDef') { lastOwnDef = applyOwnerDefaults(P); }
    else return false;
    return true;
  }

  /* ---------- results ---------- */
  function calc(P, gi) {
    ensure(P);
    try {
      const g = P.girders[gi] || P.girders[0], { b, p } = LD().fromModel(P, { girder: P.girders.indexOf(g) }), R = LD().compute(b, p);
      if (R.errors.length) return { errors: R.errors };
      R.steel = LD().steelWeight(g.segments, b.allow, g.id); R.girderLabel = g.label || g.id; R.girderId = g.id; R.ranges = window.SBDLldf.ranges(R, b.tsDeck, b.nb);
      return R;
    } catch (e) { return { errors: [`The loads could not be computed: ${e.message}`] }; }
  }
  const stepLi = s => `<li id="st-${esc(s.id)}"><div class="lbl">${esc(s.label)}${s.ref ? `<span class="ref">${esc(s.ref)}</span>` : ''}</div><div>${S().line(s, true)}</div>${s.note ? `<div class="nt">${esc(s.note)}</div>` : ''}</li>`;
  const A = '10th Ed. Art. ', OPEN = new Set(), TPX = (...ks) => ks.map(k => window.SBDFlexureUI.TP[k]).filter(Boolean);

  /* ---------- topics of the worked steps (presentation spec A, 2026-10-31; as ui/shear.js): owner rules, geometry, dead loads, then the live-load distribution factors by sub-article ---------- */
  const TOPICS = { x: () => [
    { key: 'own', title: 'Owner load rules (η, m, haunch)', ref: '', ids: /^own\./, res: /^own\.eta$/ },
    { key: 'geo', title: 'Cross-section geometry and live-load faces', ref: A + '3.6.1.1.1, 4.6.2.2.1', ids: /^(xs\.(?!n$)|df\.geo\.)/ },
    { key: 'n', title: 'Modular ratio for the stiffness parameter', ref: A + '4.6.2.2.1', ids: /^(n\.|xs\.n$)/, res: /^n\.n$/ },
    { key: 'steel', title: 'Girder steel self-weight (DC1)', ref: A + '3.5.1', ids: /^dl\.steel\./, res: /\.avg$/ },
    { key: 'dc1', title: 'Deck, haunch and forms (DC1)', ref: A + '3.3.2, 3.5.1', ids: /^dl\.G\d+\.(trib|deck|haunch|sip|DC1)$/, res: /\.DC1$/ },
    { key: 'dc2', title: 'Barriers and wearing surface (DC2, DW)', ref: A + '3.3.2, 3.5.1', ids: /^dl\.(xbar|S\d+$|load\.|G\d+\.(barL|barR|ws|DC2|DW)$)/, res: /\.DW$/ },
    { key: 'kg', title: 'Longitudinal stiffness parameter', ref: A + '4.6.2.2.1', ids: /^df\.[sp]\d+\.(eg|Kg\d*|KgAvg)$/, res: /\.Kg$/ },
    { key: 'int', title: 'Interior girder equations (one and two lanes)', ref: A + '4.6.2.2.2b, 4.6.2.2.3a', ids: /^df\.[sp]\d+\.G\d+\.(S|kterm|mom\d*|shr\d*)$/ },
    { key: 'lev', title: 'Lever rule', ref: A + '4.6.2.2.2d, 4.6.2.2.3b', ids: /^df\.[sp]\d+\.G\d+\.lev\d*\./ },
    { key: 'ext', title: 'Exterior girder: correction factor e', ref: A + '4.6.2.2.2d, 4.6.2.2.3b', ids: /^df\.[sp]\d+\.G\d+\.(de|eM|eV|mE|vE)$/ },
    { key: 'rig', title: 'Rigid cross-section (special analysis)', ref: A + 'C4.6.2.2.2d', ids: /^df\.[sp]\d+\.G\d+\.rig/ },
    { key: 'skew', title: 'Skew reduction and correction', ref: A + '4.6.2.2.2e, 4.6.2.2.3c', ids: /^df\.[sp]\d+\.(scfM|scfV)$/ },
    { key: 'gov', title: 'Distribution factors used (moment, shear)', ref: A + '4.6.2.2', ids: /^df\.[sp]\d+\.G\d+\.g[MV]\d*$/, res: /\.gM$/ },
    { key: 'fat', title: 'Fatigue factors (one lane, multiple presence removed)', ref: A + '3.6.1.4, 4.6.2.2.2b', ids: /^df\.[sp]\d+\.G\d+\.fat/ },
    { key: 'def', title: 'Deflection distribution factor', ref: A + '2.5.2.6.2', ids: /^df\.[sp]\d+\.gDef$/ }] };
  const groups = (kind, list) => window.SharedSteps.group(list, TOPICS[kind || 'x'](), { strip: false });
  const stepsHtml = (list, kind) => window.SharedSteps.groupsHTML(groups(kind, list), { open: OPEN, item: stepLi });
  const wk = (id, t, sel) => `<a class="wk" href="#st-${esc(id)}"${sel && sel.lg != null ? ` data-lg="${sel.lg}"` : ''}${sel && sel.lr != null ? ` data-lr="${sel.lr}"` : ''}>${t || '§'}</a>`;
  const card = (t, b) => `<section class="sec"><div class="secHead">${t}</div><div class="secBody">${b}</div></section>`;
  function output(R, ui, errors) {
    if (errors && errors.length) return `<div class="alert err"><b>Input errors.</b><ul>${errors.map(e => `<li>${esc(e.msg || e)}</li>`).join('')}</ul></div>`;
    if (!R) return '';
    if (R.errors && R.errors.length) return `<div class="alert err"><b>Loads.</b><ul>${R.errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>`;
    const N = R.dead.N, lg = Math.min(ui.lg || 0, N - 1), lr = Math.min(ui.lr || 0, R.regions.length - 1), g = `G${lg + 1}`, rg = R.regions[lr], L = R.lf;
    let h = `<div class="fRow"><label for="o_lg">Girder</label><select id="o_lg">${R.dead.cls.map((c, i) => `<option value="${i}"${i === lg ? ' selected' : ''}>G${i + 1} (${esc(LD().CLS[c] || c)})</option>`).join('')}</select>
      <label for="o_lr" style="min-width:0;margin-left:12px">Region</label><select id="o_lr">${R.regions.map((q, i) => `<option value="${i}"${i === lr ? ' selected' : ''}>${esc(q.label)}</option>`).join('')}</select></div>`;
    h += '<div id="gfx_ld"></div>';   // graphic (ui/gfxa.js, mounted by after())
    const ownSteps = L.steps || O().loadFactors(L.o, {}, N).steps;
    h += card('Owner load rules', `<div class="kv"><div><span>Owner</span><span>${esc(L.o || 'AASHTO')}</span></div><div><span>η (max. Strength factors)</span><span>${f(L.eta, 3)} ${wk('own.eta')}</span></div><div><span>η (min. Strength factors)</span><span>${f(L.etaN, 3)} ${wk('own.etaN')}</span></div>
      <div><span>Design load multiplier m</span><span>${f(L.m, 2)} ${wk('own.m')}</span></div><div><span>Haunch in section properties</span><span>${L.h0 ? '0 (owner rule)' : 'as entered'} ${wk('own.h0')}</span></div></div>
      <p class="note">m and η apply to the factored demands of later modules; the haunch rule applies here (K<sub>g</sub>) and to the section properties.</p>`);
    const D = R.dead, row = i => `<tr${i === lg ? ' class="sel"' : ''}><td class="lft">G${i + 1}</td><td class="lft">${esc(LD().CLS[D.cls[i]] || D.cls[i])}</td><td>${f(D.deck[i], 4)}</td><td>${f(D.haunch[i], 4)}</td><td>${f(D.sip[i], 4)}</td><td>${f(D.dc1[i], 4)} ${wk(`dl.G${i + 1}.DC1`, '', { lg: i })}</td><td>${f(D.dc2[i], 4)} ${wk(`dl.G${i + 1}.DC2`, '', { lg: i })}</td><td>${f(D.dw[i], 4)} ${wk(`dl.G${i + 1}.DW`, '', { lg: i })}</td>${D.pl.some(v => v) ? `<td>${f(D.pl[i], 4)}</td>` : ''}${D.ut ? `<td>${f(D.ut[i], 4)}</td><td>${f(D.uf[i], 4)}</td>` : ''}</tr>`;
    h += card(`Dead loads per girder (klf), ${esc(LD().METHODS[D.method])}`, `<div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Girder</th><th class="lft">Class</th><th>Deck</th><th>Haunch</th><th>SIP</th><th>DC1</th><th>DC2</th><th>DW</th>${D.pl.some(v => v) ? '<th>PL</th>' : ''}${D.ut ? '<th>UT</th><th>UF</th>' : ''}</tr></thead><tbody>${Array.from({ length: N }, (_, i) => row(i)).join('')}</tbody></table></div>
      <div class="kv"><div><span>Girder steel, ${esc(R.girderLabel)} (average)</span><span>${f(R.steel.avg, 4)} klf ${wk(`dl.steel.${R.girderId}.avg`)}</span></div>
      <div><span>Steel range along the girder</span><span>${f(R.steel.min, 4)} to ${f(R.steel.max, 4)} klf</span></div><div><span>Deck width</span><span>${f(D.Wd, 2)} ft</span></div><div><span>Live-load faces L / R</span><span>${f(R.ll.L.r, 2)} / ${f(R.ll.R.r, 2)} ft ${wk('xs.rL')}</span></div></div>
      <p class="note">DC1 excludes the girder self-weight (separate, per plate segment) and the cross-frames (not in this version; GirderDetail adds them as point loads from its Cross-frames module). Line loads: ${D.per.map(q => `${esc(q.desc)} ${f(q.plf, 4)} klf at x = ${f(q.x, 2)} ft (${esc(q.cat)}, ${esc(LD().DIST[q.dist] || q.dist)}) ${wk('dl.load.' + q.id)}`).join('; ') || 'none'}.</p>`);
    const geo = R.regions[0].geo, rows = R.regions.map((q, k) => q.members.map((m, j) => `<tr${j === lg && q === rg ? ' class="sel"' : ''}><td class="lft">${esc(q.label)}</td><td class="lft">${esc(m.label)} (${m.type === 'ext' ? 'ext.' : 'int.'})</td><td>${f(m.gM, 4)} ${wk(`df.${q.id}.G${j + 1}.gM`, '', { lg: j, lr: k })}</td><td>${q.kind === 'span' ? f(m.gV, 4) : '—'}</td><td>${f(m.fatM, 4)}</td><td>${q.kind === 'span' ? f(m.fatV, 4) : '—'}</td><td class="lft">${esc(m.method)}</td></tr>`).join('')).join('');
    h += card('Live-load distribution factors (lanes per girder)', `<div class="kv"><div><span>Design lanes N<sub>L</sub></span><span>${geo.NL} ${wk('df.geo.NL')}</span></div><div><span>Roadway</span><span>${f(geo.roadway, 2)} ft ${wk('df.geo.w')}</span></div><div><span>d<sub>e</sub> left / right</span><span>${f(geo.deL, 2)} / ${f(geo.deR, 2)} ft ${wk('df.geo.deL')}</span></div><div><span>Deflection factor</span><span>${f(R.regions[0].gDef, 4)} ${wk(`df.${R.regions[0].id}.gDef`, '', { lr: 0 })}</span></div></div>
      <div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Region</th><th class="lft">Girder</th><th>g<sub>M</sub></th><th>g<sub>V</sub></th><th>g<sub>fat,M</sub></th><th>g<sub>fat,V</sub></th><th class="lft">Method</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="note">Span regions: positive moment and shear (L = span); pier regions: negative moment and interior reactions (L = average of the adjacent spans). Fatigue: one lane, multiple presence 1.2 removed.</p>
      ${R.ranges.filter(q => !q.ok).length ? `<div class="alert">Outside the range of applicability (Tables 4.6.2.2.2b-1, 4.6.2.2.3a-1, 4.6.2.2.2d-1): ${R.ranges.filter(q => !q.ok).map(q => `${esc(q.region)} ${esc(q.name)} = ${f(q.value, q.key === 'Kg' ? 0 : 2)}`).join('; ')}.</div>` : ''}`);
    const deadG = D.steps.filter(s => !/^dl\.G\d+\./.test(s.id) || s.id.startsWith(`dl.${g}.`));
    h += card(`Worked steps: ${g}, ${esc(rg.label)}`, `<p class="note">AASHTO LRFD 10th Ed. (2024). Distances from the left deck edge.</p>${stepsHtml([...ownSteps, ...R.steps, ...deadG, ...R.steel.steps, ...rg.steps, ...rg.members[lg].steps])}`);
    return h;
  }
  /* onOutClick(e, ui): a link to the steps of another girder or region selects it; returns the step element id to show, or null */
  function onOutClick(e, ui) { const a = e.target.closest('a.wk[data-lg], a.wk[data-lr]'); if (!a) return null; e.preventDefault();
    if (a.dataset.lg != null) ui.lg = +a.dataset.lg; if (a.dataset.lr != null) ui.lr = +a.dataset.lr; return a.getAttribute('href').slice(1); }
  function onOutChange(e, ui) { if (e.target.id === 'o_lg') { ui.lg = +e.target.value; return true; } if (e.target.id === 'o_lr') { ui.lr = +e.target.value; return true; } return false; }

  /* after(el, P, R, ui): the cross-section graphic of the LLDF cases (ui/gfxa.js), after the page has set the output's HTML */
  function after(el, P, R, ui) { if (R && !(R.errors && R.errors.length)) window.SharedSteps.wire(el, { onToggle: (k, open) => { if (open) OPEN.add(k); else OPEN.delete(k); } });
    const slot = el.querySelector('#gfx_ld'); if (!slot || !R || (R.errors && R.errors.length) || !window.SBDGfxA) return;
    window.SBDGfxA.loads(slot, { P, R, lg: Math.min(ui.lg || 0, R.dead.N - 1), lr: Math.min(ui.lr || 0, R.regions.length - 1) }); }
  window.SBDUiLoads = { TOPICS, groups, after, ensure, ownerCard, inputs, onChange, onClick, takeOwnerDefaults, applyOwnerDefaults, calc, output, onOutChange, onOutClick };
})();
