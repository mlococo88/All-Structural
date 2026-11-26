/* apps/ps-bridge/ui/loads.js — the Loads & LLDF output tab (window.PSBUiLoads). Classic script; display only. Created 2026-11-12 (PR 2b-2,
   docs/ps-bridge-plan.md §2.3). Every number is the engine's (computeAll R: wG, wDk, wBar, wDW, Pdia, cp.wdk*, hl (HL-93 per lane), df (the
   distribution factor terms), dfm, dfv, MLL, VLL, own), worked in engine/worked.js loads(). The graphic (the cross-section of the girder lines
   with the design girder, the steel app's detail style) draws the bridge's entered geometry. DC2 / DW: entered per girder type, or distributed
   to every girder line by the Steel Bridge app's method (engine/bridge-dl.js, PS-9).
     output(ctx) -> HTML; after(el, ctx). ctx = { P, inp, R, W, ui } */
(function () {
  'use strict';
  const K = () => window.PSBOutKit, VK = () => window.PSBVizKit;
  const OPEN = new Set(['df']);
  const A = 'AASHTO LRFD 10th Ed. ';
  const TOPICS = [
    { key: 'own', title: 'Owner load rules (η, m)', ref: A + '1.3.2.1', ids: /^ld\.(eta|mLL)$/, res: /^ld\.eta$/ },
    { key: 'dl', title: 'Dead loads per girder (DC1, DC2, DW)', ref: A + '3.5.1', ids: /^ld\.(wg|wdeck|havg|whaunch|wDC1|Pdia|wDC2|wDW)$/, res: /^ld\.wDC1$/ },
    // PR 3a-3: the Steel Bridge app's DC2 / DW distribution to each line (engine/bridge-dl.js, steps dl.*; only when distributed)
    { key: 'dld', title: 'DC2 and DW distributed to the girder lines (the Steel Bridge app\'s method)', ref: A + '3.5.1, 4.6.2.2.1; MassDOT BDM 3.5.3; RIDOT BDM 3.3.1', ids: /^dl\./, res: /^dl\.G\d+\.DC2$/ },
    { key: 'hlm', title: 'HL-93 moment per lane (simple span)', ref: A + '3.6.1.2, 3.6.1.3', ids: /^ld\.(Mtr|Mtd|Mln|M)$/, res: /^ld\.M$/ },
    { key: 'hlv', title: 'HL-93 shear per lane (simple span)', ref: A + '3.6.1.2, 3.6.1.3', ids: /^ld\.(Vtr|Vtd|Vln|V)$/, res: /^ld\.V$/ },
    { key: 'kg', title: 'Stiffness parameter', ref: A + '4.6.2.2.1', ids: /^ld\.(Sf|eg|Kg)$/, res: /^ld\.Kg$/ },
    // PS-35: box beams and voided slabs, types (f) / (g): I, J of the outline (closed cell), the J used, I / J
    { key: 'fgj', title: 'Box beam / slab: I and J (types f / g)', ref: A + '4.6.2.2.1, Eqs. C4.6.2.2.1-2, C4.6.2.2.1-3', ids: /^ld\.(fgI|Jtw|Jtb|Jtt|JtT|JyT|Jb0|Jh0|JA0|Jst|JhJ|JA|JIx|JIy|JIp|Jc|J|IJ)$/, res: /^ld\.J$/ },
    { key: 'int', title: 'Interior girder equations', ref: A + 'Tables 4.6.2.2.2b-1, 4.6.2.2.3a-1', ids: /^ld\.(k|m1|m2|v1|v2)$/ },
    { key: 'ext', title: 'Exterior girder: lever rule, e, rigid section', ref: A + '4.6.2.2.2d, 4.6.2.2.3b', ids: /^ld\.(lever|eM|eV|rigid|rigXbar|rigXext|rigSx2|eM1|eM2|eV1|eV2|f48)$/ },
    { key: 'df', title: 'Distribution factors used', ref: A + '4.6.2.2.2e, 4.6.2.2.3c', ids: /^ld\.(dfmRaw|dfvRaw|c1|skM|skV|lo\.\w+|dfm|dfv)$/, res: /^ld\.dfm$/ },   // lo.*: LL-O, the distribution options (engine/lldf-opt.js; only with one on)
    // AP-B (2026-11-23): the ranges of applicability of the distribution factor equations (engine/applicability.js, steps ld.ap.*)
    { key: 'ap', title: 'Line-girder analysis: ranges of applicability of the distribution factors', ref: A + '4.6.2.2, Tables 4.6.2.2.2b-1, 4.6.2.2.2d-1, 4.6.2.2.2e-1, 4.6.2.2.3a-1, 4.6.2.2.3b-1, 4.6.2.2.3c-1', ids: /^ld\.ap\./, res: /^ld\.ap\.r$/ },
    // PL-A (2026-11-23): the pedestrian live load (engine/pl.js, steps ld.pl.*; only with one)
    { key: 'pl', title: 'Pedestrian live load (with the vehicular live load)', ref: A + '3.6.1.6, 3.6.2.1, Table 3.4.1-1', ids: /^ld\.pl\./, res: /^ld\.pl\.MLLPL$/ },
    // UT-N (2026-11-23): utilities on the noncomposite section and the future utility allowance (engine/ut.js, steps ld.ut.*; only with one)
    { key: 'ut', title: 'Utilities on the noncomposite section (UT) and the future utility allowance (UF)', ref: A + '3.5.1, Tables 3.4.1-1, 3.4.1-2; as the Steel Bridge app', ids: /^ld\.ut\./, res: /^ld\.ut\.MuU$/ },
    { key: 'll', title: 'Live load per girder', ref: A + '3.6.1.3, 4.6.2.2', ids: /^ld\.(xfp|xfn|xfv|MLL|VLL|imp)$/, res: /^ld\.MLL$/ }];   // xf*: batch D1, the factors on imported live load
  function output(ctx) {
    const { R, inp, P } = ctx, k = K(), ev = (p, d, u) => k.ev(R, p, d, u), wk = k.wk, df = R.df, cp = R.cp, own = R.own;
    const simple = !R.fe && !R.useExt, DL = window.PSBBridgeDL, dist = !!(DL && DL.on(P)), dg = window.PSBDesign.sel(P).g;   // PR 3a-3
    let h = (R.ap ? apCard(ctx) : '') + K().gcard('Loads graphic: cross-section', 'gfx_ld');   // AP-B: the applicability banner first
    // batch D1: with imported demands the DC2 / DW moments and shears are the file's (or the table's); the klf here gives the deflection only
    const xm = R.useExt ? '; <b>moments and shears imported</b> (Analysis tab), this w is used for the superimposed dead-load deflection only' : '';
    h += k.card('Owner load rules', k.kv([['Owner', k.esc(own ? own.owner : 'AASHTO')], ['Load modifier η (Strength I)', `${own ? ev('own.eta', 4) : '1.0000'} ${wk('ld.eta')}`],
      ['HL-93 design load multiplier m', `${own ? ev('own.mLL', 2) : '1.00'} ${wk('ld.mLL')}`]]) + '<p class="note">Owner and its questions: <a href="#" data-goin="own">Owner rules tab</a>.</p>');
    const row = (lab, how, v, link) => `<tr><td class="lft">${lab}</td><td class="lft">${how}</td><td>${v}</td><td>${link || ''}</td></tr>`;
    h += k.card('Dead loads on the design girder', `<div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Load</th><th class="lft">Section and source</th><th>Value</th><th></th></tr></thead><tbody>
      ${row('DC1 girder self-weight w<sub>g</sub>', 'non-composite; from the section', ev('wG', 4, 'klf'), wk('sec.g.wsw', '§', 'sec'))}
      ${row('DC1 deck slab', `non-composite; ${cp.extG ? 'exterior: (S/2 + overhang)' : 'tributary'} width`, ev('cp.wdkDeck', 4, 'klf'), cp.wdkDeck > 0 || +inp.ts > 0 ? wk('ld.wdeck') : '')}
      ${R.hdc && !R.hdc.same ? row('DC1 haunch', `non-composite; ${R.g.isNext ? 'flange' : 'top flange'} width × the average haunch t̄<sub>h</sub> = max(t<sub>h</sub> + Δ<sub>deck</sub>/3, t<sub>h</sub>) = ${ev('hdc.tavg', 3, 'in')} ${wk('ld.havg')} (Δ<sub>deck</sub> = ${ev('hdc.d', 3, 'in')} ${wk('cb.deck', '§', 'camb')}, Camber & deflection tab)`, ev('cp.wdkHaunch', 4, 'klf'), wk('ld.whaunch'))
        : cp.wdkHaunch > 0 ? row('DC1 haunch', `non-composite; top flange width × haunch${R.hdc && R.hdc.neg ? ' t<sub>h</sub> (the girder sags at deck placement: DC1 takes at least t<sub>h</sub>)' : ''}`, ev('cp.wdkHaunch', 4, 'klf'), wk('ld.whaunch')) : ''}
      ${(() => { const q1 = dist ? DL.line(P, dg) : null; return q1 && q1.DC1 != null   // PR 9: + the line's share of the added DC1 line loads
        ? row('DC1 additional (forms, …)', `non-composite; entered (Loads tab) + G${dg}'s share of the DC1 line loads (Cross-section tab), ${k.fx(q1.DC1, 4)} klf`, `${k.fx(+inp.loads.wNC, 4)} klf`, wk(`dl.G${dg}.DC1x`))
        : row('DC1 additional (forms, …)', 'non-composite; entered (Loads tab)', `${k.fx(+inp.loads.wNC, 4)} klf`, ''); })()}
      ${row('DC1 distributed (deck + haunch + additional)', 'on the bare girder', ev('wDk', 4, 'klf'), wk('ld.wDC1'))}
      ${R.nDiaph ? row(`DC1 diaphragms (${R.nDiaph} point loads)`, 'non-composite simple span; entered (Diaphragms / deck tab)', ev('Pdia', 2, 'kip'), wk('ld.Pdia')) : ''}
      ${row('DC2 barrier / superimposed', `composite${R.fe ? ', continuous unit' : ''}; ${dist ? `distributed to G${dg} (Cross-section tab)` : 'entered per girder'}${xm}`, ev('wBar', 4, 'klf'), dist ? wk(`dl.G${dg}.DC2`) : wk('ld.wDC2'))}
      ${row('DW wearing surface', `composite${R.fe ? ', continuous unit' : ''}; ${dist ? `distributed to G${dg} (Cross-section tab)` : 'entered per girder'}${xm}`, ev('wDW', 4, 'klf'), dist ? wk(`dl.G${dg}.DW`) : wk('ld.wDW'))}
      </tbody></table></div><p class="note">${dist ? 'DC2 and DW: the Steel Bridge app\'s distribution of the barriers, sidewalks and wearing surface to each girder line (PS-9; table below).' : 'DC2 and DW are entered per girder type (Loads tab); the Cross-section tab can distribute them to each girder line (PS-9).'}</p>`);
    if (dist) h += window.PSBBridgeDLUI.lineTable(P, dg, k);
    h += k.card('HL-93 per lane (simple span L = ' + k.fx(R.L, 2) + ' ft)', k.kv([['Truck M<sub>tr</sub> (midspan)', `${ev('hl.Mtr', 1, 'kip-ft')} ${wk('ld.Mtr')}`], ['Tandem M<sub>td</sub>', `${ev('hl.Mtd', 1, 'kip-ft')} ${wk('ld.Mtd')}`], ['Lane M<sub>ln</sub>', `${ev('hl.Mln', 1, 'kip-ft')} ${wk('ld.Mln')}`],
      ['M<sub>LL+IM</sub> per lane', `${ev('hl.M', 1, 'kip-ft')} ${wk('ld.M')}`], ['Truck V<sub>tr</sub> (support)', `${ev('hl.Vtr', 2, 'kip')} ${wk('ld.Vtr')}`], ['Tandem V<sub>td</sub>', `${ev('hl.Vtd', 2, 'kip')} ${wk('ld.Vtd')}`], ['Lane V<sub>ln</sub>', `${ev('hl.Vln', 2, 'kip')} ${wk('ld.Vln')}`],
      ['V<sub>LL+IM</sub> per lane', `${ev('hl.V', 2, 'kip')} ${wk('ld.V')}`], ['Fatigue truck M (one lane, no IM)', ev('hl.Mfat', 1, 'kip-ft')]])
      + `<p class="note">IM = 33 % on the truck and tandem (3.6.2.1).${simple ? '' : ' The continuous unit is analysed with the same vehicles on its influence lines (Analysis tab); these simple-span values are for reference.'}</p>`);
    const ext = df.ext, dfr = [['K<sub>g</sub>', df.isNext && df.kgOmitted ? 'not used (no topping)' : `${ev('df.Kg', 0, 'in⁴')} ${wk('ld.Kg')}`], ['e<sub>g</sub>', df.isNext && df.kgOmitted ? '—' : `${ev('df.eg', 3, 'in')} ${wk('ld.eg')}`],
      ['g<sub>M</sub>: one lane / two or more', `${ev('df.m1', 4)} / ${ev('df.m2', 4)} ${wk('ld.m1')}`], ['g<sub>V</sub>: one lane / two or more', `${ev('df.v1', 4)} / ${ev('df.v2', 4)} ${wk('ld.v1')}`],
      ...(ext ? [['Lever rule (one lane, m = 1.2)', `${ev('df.lever', 4)} ${wk('ld.lever')}`], ['e<sub>M</sub> / e<sub>V</sub>', `${ev('df.eM', 4)} / ${ev('df.eV', 4)} ${wk('ld.eM')}`], ['Rigid cross-section', `${ev('df.rigid', 4)} (${df.rigidNL} lane${df.rigidNL === 1 ? '' : 's'}) ${wk('ld.rigid')}`]] : []),
      ['Skew θ', ev('df.th', 1, '°')], ['Moment skew reduction r<sub>M</sub>', `${ev('df.skM', 4)} ${wk('ld.skM')}`], ['Shear skew correction', `${ev('df.skV', 4)} ${wk('ld.skV')}`],
      ...optRows(R),
      ['DF<sub>M</sub> used', `<b>${ev('dfm', 4, 'lanes')}</b> ${wk('ld.dfm')}`], ['DF<sub>V</sub> used', `<b>${ev('dfv', 4, 'lanes')}</b> ${wk('ld.dfv')}`],
      ['M<sub>LL+IM</sub> per girder, midspan', `<b>${ev('MLL', 1, 'kip-ft')}</b> ${wk('ld.MLL')}`], ['V<sub>LL+IM</sub> per girder, support', `<b>${ev('VLL', 2, 'kip')}</b> ${wk('ld.VLL')}`]];
    // PS-35 (engine/lldf-fg.js): a box beam or voided slab: the type (f) / (g) factors
    const fg = df.fg;
    if (fg) {
      const jsrc = fg.Jsrc === 'user' ? 'user/DOT value (Loads tab)' : fg.Jsrc === 'library' ? 'library (DOT) value' : 'computed from outline';
      const rows = [['Cross-section type (Table 4.6.2.2.1-1)', `(${fg.type}) ${fg.type === 'f' ? 'precast boxes with shear keys, cast-in-place overlay' : 'precast boxes with shear keys, integral concrete deck'}`],
        ['b (beam width) / N<sub>b</sub> / L', `${k.fx(fg.b, 2)} in / ${fg.Nb} / ${k.fx(fg.L, 2)} ft`],
        ['I', `${ev('df.fg.I', 0, 'in⁴')} (${fg.Isrc === 'composite' ? 'composite section' : 'girder'}) ${wk('ld.fgI')}`],
        ['J', `${ev('df.fg.J', 0, 'in⁴')} (${jsrc}) ${wk('ld.J')}`],
        ...(fg.Jsrc !== 'computed' ? [['J computed from outline (not used)', `${ev('df.fg.jw.J', 0, 'in⁴')} ${wk('ld.Jc')}`]] : []),
        ['k', `${ev('df.fg.k', 4)} ${wk('ld.k')}`],
        ['g<sub>M</sub>: one lane / two or more', `${ev('df.m1', 4)} / ${ev('df.m2', 4)} ${wk('ld.m1')}`], ['g<sub>V</sub>: one lane / two or more', `${ev('df.v1', 4)} / ${ev('df.v2', 4)} ${wk('ld.v1')}`],
        ...(ext ? [['e<sub>M</sub>: one lane / two or more', `${ev('df.fg.eM1', 4)} / ${ev('df.fg.eM2', 4)} ${wk('ld.eM1')}`], ['e<sub>V</sub>: one lane / two or more', `${ev('df.fg.eV1', 4)} / ${ev('df.fg.eV2', 4)} ${wk('ld.eV1')}`]] : []),
        ['Skew θ (shear) / θ<sub>M</sub> (moment)', `${ev('df.fg.thV', 1, '°')} / ${ev('df.fg.thM', 1, '°')}`], ['Moment skew reduction r<sub>M</sub>', `${ev('df.skM', 4)} ${wk('ld.skM')}`], ['Shear skew correction c<sub>V</sub>', `${ev('df.skV', 4)} ${wk('ld.skV')}`],
        ...optRows(R),
        ['DF<sub>M</sub> used', `<b>${ev('dfm', 4, 'lanes')}</b> ${wk('ld.dfm')}`], ['DF<sub>V</sub> used', `<b>${ev('dfv', 4, 'lanes')}</b> ${wk('ld.dfv')}`],
        ['M<sub>LL+IM</sub> per girder, midspan', `<b>${ev('MLL', 1, 'kip-ft')}</b> ${wk('ld.MLL')}`], ['V<sub>LL+IM</sub> per girder, support', `<b>${ev('VLL', 2, 'kip')}</b> ${wk('ld.VLL')}`]];
      const out = fg.out.length ? `<div class="alert" id="fgRange"><b>Outside the range of applicability (PS-35)</b><ul>${fg.out.map(o => `<li>${k.esc(o.text)}</li>`).join('')}</ul>The equations are used all the same (flagged here, in the design warnings and the Report): check the factors (refined analysis, 4.6.3, or enter them on the Loads tab).</div>` : '';
      h += k.card(`Live load distribution factors: ${ext ? 'exterior' : 'interior'} ${window.PSBLldfFG.kindOf(R.g)}, type (${fg.type}) (PS-35${R.g.box && R.g.box.solid ? ', PS-36' : ''})`, k.kv(rows) + out
        + `<p class="note" id="fgNote">${inp.loads.dfAuto ? `AASHTO LRFD 10th Ed. equations for concrete beams in multibeam decks, cross-section type (${fg.type}) of Table 4.6.2.2.1-1 (Tables 4.6.2.2.2b-1, 4.6.2.2.2d-1, 4.6.2.2.3a-1, 4.6.2.2.3b-1; skew 4.6.2.2.2e, 4.6.2.2.3c): the multiple presence is in the equations; no lever rule or rigid-section check. I and J of the section to which traffic is applied (4.6.2.2.1); J ${jsrc}. The moved engine's type (k) factors are not used (DF<sub>M</sub> ${k.fx(fg.engine.dfm, 4)}, DF<sub>V</sub> ${k.fx(fg.engine.dfv, 4)}: K<sub>g</sub> / 12 L t<sub>s</sub>³ does not apply to adjacent beams).` : 'Distribution factors entered on the Loads tab (the type (f) / (g) values are shown for reference).'} Position and skew from the bridge (<a href="#" data-goin="gird@card-design">Design girder card</a>); J override: <a href="#" data-goin="loads">Loads tab</a>.</p>`);
    } else {
    // PS-42 (engineer decision 2026-11-14): a MassDOT NEDBT with no topping keeps the engine's type (k) factors, flagged next to the DF
    const SCn = window.PSBSections, nt = SCn && SCn.noTopText ? SCn.noTopText(inp) : '';
    h += k.card(`Live load distribution factors: ${ext ? 'exterior' : 'interior'} girder${df.isNext ? ' (NEXT)' : ''}`, k.kv(dfr)
      + (nt ? `<div class="alert" id="nedbtNoTop"><b>NEDBT without a topping: the distribution factor is likely very conservative</b> ${nt} The moment factors g<sub>M1</sub> ${wk('ld.m1')} and g<sub>M2</sub> ${wk('ld.m2')} are worked in the Loads &amp; LLDF steps.</div>` : '')
      + `<p class="note">${inp.loads.dfAuto ? `AASHTO equations, cross-section type ${df.isNext ? '(i)/(j)' : '(k)'}; S = ${k.fx(df.isNext ? df.Sf : inp.S, 3)} ft, L = ${k.fx(R.L, 2)} ft, N<sub>b</sub> = ${inp.nGirders}.` : 'Distribution factors entered on the Loads tab.'} Position and skew from the bridge (<a href="#" data-goin="gird@card-design">Design girder card</a>).</p>`);
    }
    if (R.pl) h += pedCard(ctx);   // PL-A: the pedestrian live load of this girder line
    if (R.ut) h += utCard(ctx);    // UT-N: the noncomposite utilities of this girder line
    if (R.useExt) h += importedLL(ctx);   // batch D1: the imported live load and its factors
    h += everyLine(ctx);   // 2026-11-15 (batch C): the dead loads and distribution factors of every girder line (the steel app's tables)
    h += k.card('Worked steps: loads and distribution factors', `<p class="note">AASHTO LRFD 10th Ed. (2024). Every result is the engine's value.</p>${k.steps(ctx.W.loads.steps, TOPICS, OPEN)}`);
    return h;
  }
  /* optRows(R) (LL-O, 2026-11-23): the rows of the distribution factor card for the optional distribution options (engine/lldf-opt.js; R.df.opt
     only when one is on and applies): the shear skew correction applied, the interior girder's factors and whether a factor was raised,
     each with the § of its worked step. No option: no row (the card as before). Display only. */
  function optRows(R) {
    const q = R.df && R.df.opt, k = K(), wk = k.wk, T = window.PSBLldfOpt ? window.PSBLldfOpt.TXT : null; if (!q || !T) return [];
    const rows = [];
    if (q.skewV === 'ext') rows.push([`Shear skew correction applied (option "${T.ext}")`, `<span id="loCV">${k.fx(q.cV, 4)}</span> ${wk('ld.lo.cV')}${q.skewOff ? ` (not applied to this interior girder; all girders: DF<sub>V</sub> ${k.fx(q.dfv0, 4)})` : q.fgKeep ? ' (adjacent beams keep it)' : ''}`]);
    if (q.extMin && q.int) rows.push([`Interior girder DF<sub>M</sub> / DF<sub>V</sub> (option "${T.extMin}", S<sub>int</sub> = ${k.fx(q.int.S, 3)} ft)`, `<span id="loInt">${k.fx(q.int.dfm, 4)} / ${k.fx(q.int.dfv, 4)}</span> ${wk('ld.lo.dfmI')}`],
      ['Exterior DF<sub>M</sub> / DF<sub>V</sub> before the option', `${k.fx(q.dfm0, 4)} / ${k.fx(q.dfv0, 4)} ${wk('ld.lo.dfmE')}: ${q.policyM || q.policyV ? `<b id="loPol">${q.policyM && q.policyV ? 'both' : q.policyM ? 'DF<sub>M</sub>' : 'DF<sub>V</sub>'} raised to interior (policy)</b>` : '<span id="loPol">the exterior factors govern, no change</span>'}`]);
    else if (q.extMin && q.ext) rows.push([`Option "${T.extMin}"`, `no interior girder line: no change ${wk('ld.lo.pol')}`]);
    return rows;
  }
  /* apCard(ctx) (AP-B, 2026-11-23; the Steel Bridge app's SA4 banner): is the line-girder analysis with the approximate distribution
     factors permitted for the girder shown? R.ap (engine/applicability.js): each tested value with its range, table and result, the other
     items (curvature, skew effects not computed), the level (FAIL counts in the verdict: the check "LLDF range of applicability") */
  function apCard(ctx) {
    const { R } = ctx, k = K(), a = R.ap, wk = k.wk; if (!a || !a.family) return '';
    const LV = { fail: 'FAIL', warn: 'WARNING', note: 'NOTE', ok: 'OK' }, cls = { fail: 'sd-fail', warn: 'sd-review', note: '', ok: 'sd-pass' };
    const f = v => String(+(+v).toFixed(3)), rng = q => !isFinite(q.hi) ? `≥ ${f(q.lo)}` : q.lo === -Infinity ? `≤ ${f(q.hi)}` : `${f(q.lo)} to ${f(q.hi)}`;
    const st = q => a.entered ? 'not tested' : q.ok ? 'OK' : LV[q.level];
    const rows = a.items.map(q => `<tr${!a.entered && !q.ok && q.level === 'fail' ? ' class="apBad" style="background:#fdecec"' : ''}><td class="lft">${k.esc(q.name)}</td><td>${k.fx(q.value, q.d)} ${k.esc(q.unit)} ${wk('ld.ap.' + q.key)}</td><td>${rng(q)} ${k.esc(q.unit)}</td><td class="lft">${k.esc(q.table)}</td><td class="lft"><b class="${a.entered ? '' : q.ok ? 'sd-pass' : cls[q.level]}">${st(q)}</b>${!a.entered && !q.ok && q.note ? ' ' + k.esc(q.note) : ''}</td></tr>`).join('');
    const extra = a.extra.map(q => `<tr><td class="lft">${k.esc(q.title)}</td><td>${k.esc(q.val)}</td><td></td><td></td><td class="lft"><b class="${cls[q.level]}">${LV[q.level]}</b> ${k.esc(q.msg)}</td></tr>`).join('');
    const head = a.entered ? 'Distribution factors entered (Loads tab): the ranges of the equations are not tested.'
      : a.level === 'fail' ? `<b>FAIL: ${a.bad.length} value${a.bad.length > 1 ? 's' : ''} outside the range of applicability of the distribution factor equations.</b> A line-girder analysis with these factors is not permitted: use a refined analysis (4.6.3) and enter its factors on the <a href="#" data-goin="loads">Loads tab</a> (an entered factor is not flagged), or change the layout. Counted in the verdict (check "LLDF range of applicability") ${wk('ld.ap.r')}.`
      : a.level === 'warn' ? 'WARNING: a value is outside its range by an accepted exception (below); the factors are used.'
      : `The approximate distribution factor equations apply: every tested value is inside its range ${wk('ld.ap.r')}.`;
    return k.card(`Line-girder analysis applicability: ${k.esc(a.kind)}`, `<div class="${a.level === 'fail' && !a.entered ? 'alert err' : a.level === 'warn' ? 'alert' : 'note'}" id="apBanner" data-aplevel="${a.entered ? 'entered' : a.level}" role="${a.level === 'fail' ? 'alert' : 'status'}">${head}</div>
      <div class="tscroll"><table class="tbl" id="apTbl"><thead><tr><th class="lft">Item</th><th>Value</th><th>Range</th><th class="lft">AASHTO LRFD 10th Ed.</th><th class="lft">Result</th></tr></thead><tbody>${rows}${extra}</tbody></table></div>
      <p class="note">The values the distribution factors of this girder line were computed with (S, t<sub>s</sub>, L, N<sub>b</sub>, K<sub>g</sub>, d<sub>e</sub>, the larger skew of the span's supports). As the Steel Bridge app's applicability check: a computed factor outside its range is a FAIL; entered factors are not tested. Every girder type and line is tested (the check summary and the Summary tab show the ones that fail).</p>`, 'card-ap');
  }
  /* utCard(ctx) (UT-N, 2026-11-23): the utility on the noncomposite section (UT) and the future utility allowance (UF) of the girder shown
     (R.ut, engine/ut.js): the line's shares, their moments and shears on the girder alone, the load factors and where each enters, each
     with the § of its worked step; with an allowance, the checks whose ratio is larger with it absent. Display only. */
  function utCard(ctx) {
    const { R, P } = ctx, k = K(), ev = (p, d, u) => k.ev(R, p, d, u), wk = k.wk, q = R.ut, dg = window.PSBDesign.sel(P).g, DL = window.PSBBridgeDL, dist = !!(DL && DL.on(P));
    const hasT = q.wUT !== 0, hasF = q.wUF !== 0, f = (v, d) => (typeof v === 'number' && isFinite(v) ? k.fx(v, d) : '—');
    // one column per load: the share, its effects on the girder alone, the load factors and where it enters, each with its §
    const c = (t, u) => `<td>${hasT ? t : '—'}</td><td>${hasF ? u : '—'}</td>`;
    const tbl = `<div class="tscroll"><table class="tbl" id="utTbl"><thead><tr><th class="lft">Noncomposite utilities of this girder line</th><th>Utility (UT)</th><th>Future utility allowance (UF)</th></tr></thead><tbody>
      <tr><td class="lft">Line load on this girder line</td>${c(`<b>${ev('ut.wUT', 4, 'klf')}</b> ${dist ? wk(`dl.G${dg}.UTN`) : wk('ld.ut.wUT')}`, `<b>${ev('ut.wUF', 4, 'klf')}</b> ${dist ? wk(`dl.G${dg}.UF`) : wk('ld.ut.wUF')}`)}</tr>
      <tr><td class="lft">Moment at midspan (simple span, girder alone)</td>${c(`${ev('ut.MUT', 1, 'kip-ft')} ${wk('ld.ut.MUT')}`, `${ev('ut.MUF', 1, 'kip-ft')} ${wk('ld.ut.MUF')}`)}</tr>
      <tr><td class="lft">Shear at the support</td>${c(`${ev('ut.VUT', 2, 'kip')} ${wk('ld.ut.VUT')}`, `${ev('ut.VUF', 2, 'kip')} ${wk('ld.ut.VUF')}`)}</tr>
      <tr><td class="lft">Strength I load factor</td>${c(`${ev('ut.gUT', 2)} ${wk('ld.ut.gUT')}<br><span class="unit">${q.wUT >= 0 ? '0.65 where it relieves' : '1.50 where it adds'}</span>`, `1.25 or 0 ${wk('ld.ut.abs')}<br><span class="unit">present or absent</span>`)}</tr>
      <tr><td class="lft">Service I / III (girder section)</td>${c('1.00', '1.00 or 0')}</tr>
      <tr><td class="lft">Losses (elastic gain, Δf<sub>cd</sub>)</td>${c('as DC1', 'as DC1 when present')}</tr>
      <tr><td class="lft">Camber (Δ<sub>dk</sub>)</td>${c(q.dUT != null ? `${ev('ut.dUT', 3, 'in')} ${wk('ld.ut.cam')}` : `included ${wk('ld.ut.cam')}`, `not in the camber ${wk('ld.ut.cam')}`)}</tr>
      <tr><td class="lft">Load rating</td>${c('with DW (γ<sub>DW</sub>)', 'with DC, where it adds')}</tr></tbody></table></div>`;
    const rows = [['w<sub>NC</sub> the engine takes (with the utilities)', `${k.fx(+ctx.inp.loads.wNC, 4)} klf ${wk('ld.ut.wNC')}`]];
    if (hasT) rows.push(['Strength I, UT above the 1.25 of DC1: ΔM<sub>u</sub>', `${ev('ut.dMu', 1, 'kip-ft')} ${wk('ld.ut.dMu')}`], ['Strength I, UT above the 1.25 of DC1: ΔV<sub>u</sub>', `${ev('ut.dVu', 2, 'kip')} ${wk('ld.ut.dVu')}`]);
    rows.push(['Strength I moment of the utilities at midspan', `<b>${ev('ut.MuU', 1, 'kip-ft')}</b> ${wk('ld.ut.MuU')}`]);
    rows.push(['Service stress at midspan, bottom', `${ev('ut.fb', 4, 'ksi')} ${wk('ld.ut.fb')}`], ['Service stress at midspan, top', `${ev('ut.ft', 4, 'ksi')} ${wk('ld.ut.ft')}`]);
    if (q.gain != null) rows.push(['Their part of the elastic gain of DC1', `${ev('ut.gain', 3, 'ksi')} ${wk('ld.ut.gain')}`]);
    let abs = '';
    if (hasF && q.abs) {
      const g = q.abs.rows.filter(r => r.gov === 'absent');
      abs = `<div id="utAbs" data-n="${g.length}"><p class="note"><b>Future utility allowance present or absent, whichever governs</b> ${wk('ld.ut.abs')}: the design is computed with the allowance (γ 1.25, Service 1.00: the values on every tab) and without it (γ 0). ${g.length ? `${g.length} check${g.length > 1 ? 's have' : ' has'} a larger ratio with it absent; each is in the check summary as "UF absent: …".` : 'No check has a larger ratio with it absent: the state with it present governs every check.'}</p>`
        + `<div class="tscroll"><table class="tbl" id="utAbsTbl"><thead><tr><th class="lft">Check</th><th>Ratio, allowance present</th><th>Ratio, allowance absent</th><th>Governs</th></tr></thead><tbody>${q.abs.rows.map(r => `<tr${r.gov === 'absent' ? ' class="utAbsGov"' : ''}><td class="lft">${k.esc(r.n)}</td><td>${f(r.rP, 4)}</td><td>${f(r.rA, 4)}</td><td>${r.gov === 'absent' ? '<b>absent</b>' : Object.is(r.rP, r.rA) ? 'same' : 'present'}</td></tr>`).join('')}</tbody></table></div></div>`;
    }
    return k.card('Utilities on the noncomposite section' + (hasF ? ' and the future utility allowance' : ''), tbl + k.kv(rows) + abs
      + `<p class="note" id="utNote">The line loads of the <a href="#" data-goin="xsec">Cross-section tab</a> (categories "Utility (noncomposite, DW factors)" and "Future utility allowance (noncomposite, γ 1.25/0)"), distributed to the girder lines as the Steel Bridge app distributes them. They act on the precast girder alone, on the simple span, so they are added to w<sub>NC</sub> and are inside every DC1 of the <a href="#" data-gotab="an">Analysis</a>, Losses, Stresses, Flexure, Shear, Camber and Rating tabs. ${hasT ? 'The utility takes the DW load factors (AASHTO LRFD 10th Ed. Table 3.4.1-2: 1.50, 0.65 where it relieves): M<sub>u</sub> and V<sub>u</sub> carry "+ (γ<sub>UT</sub> − 1.25) M<sub>UT</sub>" beside the 1.25 of DC1; in the rating it is with DW. ' : ''}${hasF ? 'The future utility allowance takes 1.25 or 0 (present or absent, whichever governs each check) and is not in the camber. ' : ''}Service I and III: γ = 1.00 on the girder section.</p>`, 'card-ut');
  }
  /* pedCard(ctx) (PL-A, 2026-11-23): the pedestrian live load of the girder shown (R.pl, engine/pl.js): w_PL of the line (the distribution's
     step), M_PL and V_PL and the live load the checks take, each linked to its worked step; where it is and is not used */
  function pedCard(ctx) {
    const { R, P } = ctx, k = K(), ev = (p, d, u) => k.ev(R, p, d, u), wk = k.wk, q = R.pl, dg = window.PSBDesign.sel(P).g, DL = window.PSBBridgeDL, dist = !!(DL && DL.on(P));
    if (q.mode === 'ext') return k.card('Pedestrian live load', `<div class="alert" id="plExt">${k.esc(window.PSBPL.WARN_EXT)}</div>`, 'card-pl');
    return k.card('Pedestrian live load (AASHTO LRFD 10th Ed. 3.6.1.6)', k.kv([['w<sub>PL</sub> on this girder line', `<b>${ev('pl.w', 4, 'klf')}</b> ${dist ? wk(`dl.G${dg}.PL`) : wk('ld.pl.w')}`],
      [`M<sub>PL</sub> at midspan${q.mode === 'cont' ? ' (continuous unit)' : ''}`, `${ev('pl.Mmid', 1, 'kip-ft')} ${wk('ld.pl.M')}`], ['V<sub>PL</sub> at the support', `${ev('pl.Vsup', 2, 'kip')} ${wk('ld.pl.V')}`],
      ...(q.pier || []).map((p, i) => [`M<sub>PL,n</sub> at the ${p.side} pier`, `${ev(`pl.pier.${i}.M`, 1, 'kip-ft')} ${wk('ld.pl.Mn' + i)}`]),
      ['M<sub>LL+IM</sub> + M<sub>PL</sub> at midspan (the checks)', `<b>${k.fx(q.Mhl + q.Mmid, 1)} kip-ft</b> ${wk('ld.pl.MLLPL')}`], ['V<sub>LL+IM</sub> + V<sub>PL</sub> at the support (the checks)', `<b>${k.fx(q.Vhl + q.Vsup, 2)} kip</b> ${wk('ld.pl.VLLPL')}`]])
      + `<p class="note" id="plNote">The sidewalk load of the <a href="#" data-goin="xsec">Cross-section tab</a>, distributed to the girder lines as the Steel Bridge app distributes it; no distribution factor, no dynamic load allowance (3.6.2.1). It acts with the vehicular live load and takes its load factor (Table 3.4.1-1): added to LL+IM in Strength I, Service I and Service III on the <a href="#" data-gotab="an">Analysis</a>, Stresses, Flexure and Shear tabs and in the load rating. Not in the fatigue check (3.6.1.4.1) nor in the live-load deflection (2.5.2.6.2). The HL-93 values above (M<sub>LL+IM</sub>, V<sub>LL+IM</sub> per girder) are without it.</p>`, 'card-pl');
  }
  /* importedLL(ctx) (batch D1, 2026-11-15; the old app's Loads card O:6225-6243): the live load of a type whose demands come from a MIDAS file
     or a custom table: the factors DF × m per effect and the midspan / support values the engine takes, each linked to its worked step */
  function importedLL(ctx) {
    const { R, P } = ctx, k = K(), ev = (p, d, u) => k.ev(R, p, d, u), wk = k.wk, D = window.PSBDemands, T = window.PSBDemandsUI ? window.PSBDemandsUI.shownType(P) : null;
    const d = D && T ? D.describe(P, T) : { what: 'imported', detail: '' }, F = D ? D.fac(ctx.inp) : null, x = R.ext || {};
    return k.card('Live load from the imported demands', k.kv([['Source', `${k.esc(d.what)} (<a href="#" data-goin="loads">Loads tab, Demands card</a>)`],
      ['Span used', x.sel ? `span ${x.sel.idx || '—'}: ${k.fx(+x.sel.x0, 2)}–${k.fx(+x.sel.x1, 2)} ft, ${x.nStations} stations` : '—'], ['LL type', k.esc(x.liveLoadType || '—')],
      ['f<sub>+M</sub> = DF<sub>+M</sub> m', `${F ? k.fx(F.pos, 3) : '—'} ${wk('ld.xfp')}`], ['f<sub>−M</sub> = DF<sub>−M</sub> m', `${F ? k.fx(F.neg, 3) : '—'} ${wk('ld.xfn')}`], ['f<sub>V</sub> = DF<sub>V</sub> m', `${F ? k.fx(F.v, 3) : '—'} ${wk('ld.xfv')}`],
      ['M<sub>LL+IM</sub> per girder, midspan', `<b>${ev('MLL', 1, 'kip-ft')}</b> ${wk('ld.MLL')}`], ['V<sub>LL+IM</sub> per girder, support', `<b>${ev('VLL', 2, 'kip')}</b> ${wk('ld.VLL')}`]])
      + (R.imp ? `<div class="alert" id="impNote" role="status"><b>Imported demands are used as given.</b> ${k.esc(R.imp.text)} ${wk('ld.imp')}</div>` : '')
      + '<p class="note">Impact is in the imported live load (not applied again); DF and m per effect from the Loads tab (blank = 1.0). The distribution factors above are this app\'s own: used for the fatigue check (this app\'s fatigue truck) (and shown for comparison), not for the imported live load. The imported values at every station and their combinations: <a href="#" data-gotab="an">Analysis tab</a>.</p>');
  }
  /* everyLine(ctx): 2026-11-15 (batch C; the steel app's Loads & LLDF "dead loads of every girder line" and "LLDF of every girder × region"):
     each girder type on each of its lines (ctx.all = engine/bridge.js results, the page's cached results of every type × line: each line's
     own computeAll, the same objects as the Summary's), a row per line of every span: w_g, w_DC1, DC2, DW, DF_M, DF_V and the fatigue DF of
     that line's engine result, the factors' method. No arithmetic: each value is the engine's; each § opens this tab (or the tab that works
     it) with that type and line, at the step that works the value (data-sumgo, as the Summary's links). Not in the Report (its tab sections
     are the girder worked; §1 lists every type and line). */
  function everyLine(ctx) {
    const A = ctx.all, k = K(), fx = (v, d) => k.fx(v, d);
    if (A === undefined) return '';   // the Report's tab sections (no ctx.all): not shown
    if (!A || !A.cells || !A.cells.length) return window.PSBBridge && window.PSBBridge.hasTypes(ctx.P) ? k.card('Dead loads and distribution factors of every girder line', '<p class="note">Shown once every girder type × line is computed (the Summary tab runs them).</p>') : '';
    const P = ctx.P, d = window.PSBDesign.sel(P), DL = window.PSBBridgeDL, dist = !!(DL && DL.on(P));
    const go = (c, tab, st) => `<a class="wk" href="#" data-sumgo="${c.k}|${c.g}|${tab}|${k.esc(st)}|" title="Worked: ${tab === 'lds' ? 'Loads &amp; LLDF' : tab === 'sec' ? 'Section properties' : 'Stresses'} tab with this girder type and line">§</a>`;
    const meth = R => { const df = R.df || {}; if (R.useExt) return 'imported'; if (df.fg) { const lf = window.PSBLldfOpt ? window.PSBLldfOpt.label(R) : ''; return `type (${df.fg.type}), ${df.ext ? 'exterior' : 'interior'}${lf ? '; ' + lf : ''}`; } const lo = window.PSBLldfOpt ? window.PSBLldfOpt.label(R) : '', t = df.ext ? 'exterior: lever rule, e, rigid section' : `interior: equations${df.isNext ? ' (NEXT)' : ''}`; return lo ? `${t}; ${lo}` : t; };
    const cs = A.cells.slice().sort((a, b) => a.s - b.s || a.g - b.g);
    const rows = cs.map(c => { const R = c.R, on = c.g === d.g && c.s === d.s, lab = k.esc((P.types[c.k] || {}).label || '');
      if (!R || R.error) return `<tr><td>${c.s}</td><td class="lft">G${c.g}</td><td class="lft">${lab}</td><td class="lft" colspan="9">engine error${R && R.error ? ': ' + k.esc(R.error) : ''}</td></tr>`;
      const man = c.inp && c.inp.loads && c.inp.loads.dfAuto === false;
      return `<tr${on ? ' class="sel"' : ''}><td>${c.s}</td><td class="lft">G${c.g}${on ? ' (shown)' : ''}</td><td class="lft">${lab}</td>
        <td style="white-space:nowrap">${fx(R.wG, 4)} ${go(c, 'sec', 'sec.g.wsw')}</td><td style="white-space:nowrap">${fx(R.wDk, 4)} ${go(c, 'lds', 'ld.wDC1')}</td><td style="white-space:nowrap">${fx(R.wBar, 4)} ${go(c, 'lds', dist ? `dl.G${c.g}.DC2` : 'ld.wDC2')}</td><td style="white-space:nowrap">${fx(R.wDW, 4)} ${go(c, 'lds', dist ? `dl.G${c.g}.DW` : 'ld.wDW')}</td>
        <td style="white-space:nowrap">${fx(R.dfm, 4)} ${go(c, 'lds', 'ld.dfm')}</td><td style="white-space:nowrap">${fx(R.dfv, 4)} ${go(c, 'lds', 'ld.dfv')}</td><td style="white-space:nowrap">${R.fat ? `${fx(R.fat.dfFat, 4)} ${go(c, 'str', 'st.fat.df')}` : '—'}</td><td class="lft">${man ? 'entered (Loads tab)' : meth(R)}</td></tr>`; }).join('');
    return k.card('Dead loads and distribution factors of every girder line', `<div class="tscroll"><table class="tbl"><thead><tr><th>Span</th><th class="lft">Line</th><th class="lft">Girder type</th>
      <th>DC1 girder w<sub>g</sub><br>klf</th><th>DC1 on the girder w<sub>DC1</sub><br>klf</th><th>DC2<br>klf</th><th>DW<br>klf</th><th>DF<sub>M</sub><br>lanes</th><th>DF<sub>V</sub><br>lanes</th><th>DF fatigue</th><th class="lft">LLDF method</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="note">Each girder type on each of its lines, as the Summary computes them (each line's own engine result: its spacing S, position, skew and DC2 / DW). One distribution factor per line and load effect over its span (the engine's: moment, shear, fatigue; a continuous unit uses the same factors). § opens the step that works the value, with that type and line shown. Lines with no girder type are not listed (Summary tab).</p>`);
  }
  /* the cross-section of the design span (ui/xsfig.js, PSBXsFig): each line's girder section at its offset, deck, haunch, barriers,
     sidewalks, traffic faces and d_e, to scale; the line shown on the output tabs outlined. Display only. Also the Report's figure.
     2026-11-14 (item 7): with the live-load case of the line shown (PSBXsFig.lldf: the engine's lever-rule wheel placement and its influence
     line, or the rigid-section lanes; the Steel Bridge app's LLDF case switch), chosen with LL.cur (the page session only). */
  const LL = { cur: 'lever' };
  const llOf = ctx => { const d = window.PSBDesign.sel(ctx.P); return window.PSBXsFig.lldf(ctx.P, d.s, d.g, ctx.inp, ctx.R.df); };
  function figure(ctx, W, L) {
    const d = window.PSBDesign.sel(ctx.P), C = L && L.cases.find(c => c.key === LL.cur);
    const q = window.PSBXsFig.svg(ctx.P, d.s, W, { shown: d.g, ll: C || null, maxH: C ? (W < 560 ? 420 : 470) : undefined });
    return { html: q.svg, nar: q.nar };
  }
  /* the case's caption: how the drawn wheels give the engine's value (the worked step linked) */
  function llCap(ctx, L) {
    const k = K(), fx = (v, dd) => k.fx(v, dd);
    if (!L || L.kind !== 'ext') return L && L.note ? `<p class="vk-cap" id="ldLLNote">${k.esc(L.note)}</p>` : '';
    const C = L.cases.find(c => c.key === LL.cur) || L.cases[0];
    if (C.key === 'lever') return `<p class="vk-cap" id="ldLLNote"><b>Lever rule, one lane (4.6.2.2.2d), m = 1.2:</b> the wheels 2 ft and 8 ft inboard of the traffic face are x<sub>w</sub> = ${C.terms.map(t => fx(t.xo, 2)).join(' and ')} ft outboard of the exterior girder ℄ (d<sub>e</sub> = ${fx(C.de, 3)} ft); ordinates (S + x<sub>w</sub>) / S = ${C.terms.map(t => t.on ? fx(t.ord, 4) : '0 (not counted)').join(' and ')} with S = ${fx(C.S, 3)} ft; g<sub>lever</sub> = 1.2 × 0.5 × (${C.terms.filter(t => t.on).map(t => fx(t.ord, 4)).join(' + ') || '0'}) = <b>${fx(C.value, 4)}</b> = the engine's ${k.ev(ctx.R, 'df.lever', 4)} ${k.wk('ld.lever')}.</p>`;
    return `<p class="vk-cap" id="ldLLNote"><b>Rigid cross-section (C4.6.2.2.2d), ${C.NL} lane${C.NL > 1 ? 's' : ''} (the engine's governing count), m = ${fx(C.m, 2)}:</b> lanes of 12 ft from the traffic face, each lane's resultant (brown tick) 5 ft inside its edge; e = ${C.e.map(v => fx(v, 3)).join(', ')} ft from the centroid of the ${C.nb} girders${C.unequal ? ' (the actual girder lines, PS-19)' : ''}, X<sub>ext</sub> = ${fx(C.Xext, 3)} ft, Σx² = ${fx(C.sumX2, 2)} ft²; R = ${fx(C.m, 2)} (${C.NL} / ${C.nb} + ${fx(C.Xext, 3)} × ${fx(C.sumE, 3)} / ${fx(C.sumX2, 2)}) = <b>${fx(C.value, 4)}</b> = the engine's ${k.ev(ctx.R, 'df.rigid', 4)} ${k.wk('ld.rigid')}.</p>`;
  }
  function after(el, ctx) {
    K().after(el, OPEN);
    const slot = el.querySelector('#gfx_ld'); if (!slot || !VK() || !VK().detCard) return;
    const { R } = ctx, k = K(), ev = (p, d) => k.ev(R, p, d);
    let L = null; try { L = llOf(ctx); } catch (e) { console.warn(e); }
    const ext = L && L.kind === 'ext'; if (ext && !L.cases.some(c => c.key === LL.cur)) LL.cur = 'lever';
    const cap = () => window.PSBXsFig.legend(window.PSBXsFig.model(ctx.P, window.PSBDesign.sel(ctx.P).s)) + `<p class="vk-cap">G${window.PSBDesign.sel(ctx.P).g} (outlined) is the line shown on the output tabs. Entered on the <a href="#" data-goin="xsec">Cross-section tab</a> (bays, overhangs, barriers, sidewalks) and the <a href="#" data-goin="gird@types">Girders &amp; strands tab</a> (girder types and sections). Display only.</p>`;
    const H = VK().detCard(slot, { id: 'ldFig', title: 'Cross-section: girder sections, lanes and wheels, d<sub>e</sub>', sub: `span ${window.PSBDesign.sel(ctx.P).s}, girder lines from the left deck edge`,
      seg: ext ? { label: 'LLDF case', items: L.cases.map(c => [c.key, k.esc(c.label)]), cur: LL.cur, on: key => { LL.cur = key; slot.querySelectorAll('[data-vkseg]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.vkseg === key))); H.redraw(); const n = slot.querySelector('#ldLLNote'); if (n) n.outerHTML = llCap(ctx, L); } } : null,
      top: VK().tiles([{ label: 'DC1 w<sub>DC1</sub>', value: ev('wDk', 3), unit: 'klf' }, { label: 'DC2', value: ev('wBar', 3), unit: 'klf' }, { label: 'DW', value: ev('wDW', 3), unit: 'klf' },
        { label: 'DF<sub>M</sub>', value: ev('dfm', 3), unit: 'lanes', tone: 'c' }, { label: 'DF<sub>V</sub>', value: ev('dfv', 3), unit: 'lanes', tone: 'c' }, { label: 'M<sub>LL+IM</sub>', value: ev('MLL', 0), unit: 'k-ft', tone: 't' }]),
      draw: W => figure(ctx, W, L), hint: 'Point at a girder, a wheel, a lane or a d_e dimension to read it.',
      cap: llCap(ctx, L) + cap() });
  }
  window.PSBUiLoads = { output, after, TOPICS };
})();
