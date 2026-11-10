// DETC (2026-11-10): apps/steel-bridge/ui/gfxdet.js, the detail drawings and plans in the option C screen style (ui/vizkit.js detail block). Display only.
// For the built-in project (interior and exterior girder, X / K frames) and two hand-off payloads: every graphic's card builds at the desktop and the phone
// width; its SVG is well formed (no NaN / undefined) and fits its width; and every number the CAD drawing of the same graphic writes (its TEXT and
// dimension strings: the values the tab already has, by the same formats) appears in the card (figure, caption, table, notes). The card is recorded
// (SBDVizKit.detCard replaced by a recorder), so no DOM is needed. The DXF of each graphic is tests/engine/dxf-detc.test.mjs.
import assert from 'node:assert/strict';
import { test, loadShared } from './harness.mjs';
import { FILES, E } from './gfx-fixture.mjs';
import { projectFromPayload, readPayload } from './an-fixture.mjs';

const W = loadShared(...FILES, E('ui/constructibility.js'), E('ui/vizkit.js'), E('ui/gfxa.js'), E('ui/gfxdet.js'));
const M = W.SBDModel, GA = W.SBDGfxA, GB = W.SBDTabGfxB, GD = W.SBDGfxDet, VK = W.SBDVizKit, J = o => JSON.parse(JSON.stringify(o));
let card = null; VK.detCard = (slot, o) => { card = o; return { el: {} }; };
const slot = () => ({ innerHTML: '' });
const st = { cards: 0, nums: 0 };
// number tokens: decimals, whole numbers, fractions (1 1/2, 9/16), feet-inches (4'-9"); a power (IN^4, in²) is not a number of the drawing
const toks = s => new Set((String(s).replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\^\d|[⁴²³]/g, ' ').replace(/[−–]/g, '-').match(/\d+(?:\.\d+)?(?:'-\d+(?: \d+\/\d+)?"?)?(?: \d+\/\d+)?(?:\/\d+)?/g) || []).map(t => t.replace(/"$/, '')));
const cadNums = g => { const s = []; g.D.E.forEach(e => { if (e.t === 'TEXT' || e.t === 'DIM') s.push(e.s); }); return toks(s.join(' | ')); };
function check(name, g, make, skip) {
  card = null; make(); assert.ok(card, `${name}: a card`); st.cards++;
  const html = [card.title, card.sub, card.top, card.tbl, card.cap, ...(card.notes || [])].join(' ');
  [900, 380].forEach(Wd => { const q = card.draw(Wd); assert.ok(/^<svg /.test(q.html) && !/NaN|undefined|Infinity/.test(q.html), `${name} at ${Wd}: svg`);
    const vb = /viewBox="([^"]+)"/.exec(q.html)[1].split(' ').map(Number); assert.ok(vb.every(Number.isFinite) && vb[2] >= Wd - 1 && vb[2] <= Wd * 1.5, `${name} at ${Wd}: width ${vb}`);
    const have = toks(html + ' ' + q.html); [...cadNums(g)].filter(t => !(skip || []).includes(t)).forEach(t => { assert.ok(have.has(t), `${name} at ${Wd}: the CAD drawing's "${t}" is shown`); st.nums++; }); });
  const g2 = card.dxf(); assert.equal(g2.D.toDXF({ ltscale: 1 }), g.D.toDXF({ ltscale: 1 }), `${name}: Download DXF = the CAD drawing`);
}
function projects() {
  const P0 = J(M.defaultProject()); P0.framing = { ...M.defaultFraming(), splices: [82] };
  const P1 = J(P0); P1.girders[0].position = 'exterior';
  const out = [['built-in', P0, null], ['built-in exterior', P1, null]];
  [['gd_builtin28_AASHTO_G1.json', { nb: 5, bays: [9.5, 9.5, 9.5, 9.5], skews: [28, 28, 28, 28], spl: [82, 145, 215, 278] }], ['gd_xsA_AASHTO_G5.json', { nb: 3, bays: [11, 11], skews: [10, 30, 40, 25], spl: [100, 260] }]].forEach(([f, o]) => {
    const pl = readPayload(f), P = projectFromPayload(pl); P.xs = M.defaultXs(P); Object.assign(P.xs, { nb: o.nb, bays: o.bays, skews: o.skews });
    P.framing = { ...M.defaultFraming(), splices: o.spl }; P.stiffeners = M.defaultStiffeners(); P.crossframes = M.defaultCrossframes(); P.ownerRules = P.ownerRules || { owner: 'AASHTO', eta: { D: 'no', R: 'auto', I: 'no', eD: 1, eR: 1, eI: 1 } };
    out.push([f, P, pl]); });
  return out;
}

test('DETC: detail drawings (c): LTB sketch, overhang bracket, stiffeners, cross-frame, weld detail, field splice: every CAD number shown, Download DXF = the CAD drawing', () => {
  for (const [name, P, pl] of projects()) {
    const FX = W.SBDFlexureUI.build({ P, g: 0, src: pl ? 'example' : 'analysis' });
    if (!FX.err) FX.rows.forEach((r, i) => { if (i % 25 && i !== FX.rows.length - 1) return; const g = GA.ltbGraphic(r); if (!Number.isFinite(r.Lb) || !r.seg) return;
      // the CAD drawing's L_b bar (L_b x 12 / 12) and the station of the location: the same digits
      check(`${name} ltb ${i}`, g, () => GD.ltb(slot(), { r, dxf: () => GA.ltbGraphic(r) })); });
    const CN = W.SBDConstrUI.build({ P, g: 0 });
    if (!CN.err && CN.F && CN.F.oh) { card = null; GD.bracket(slot(), { P, gi: 0, oh: CN.F.oh, dxf: () => GA.ohGraphic(P, 0, CN) });
      if (card) { const p = CN.F.oh.p, q = card.draw(900).html; [p.a, p.wOH, p.tOH].forEach(v => assert.ok(q.includes(`${(+v).toFixed(1)} in`), `${name}: bracket ${v}`)); assert.ok(q.includes(`h<tspan baseline-shift="sub" font-size="0.75em">b</tspan> = ${(+p.hb + (+P.deck.haunch || 0)).toFixed(1)} in`), `${name}: h_b`); st.cards++; } }
    const SR = W.SBDShearUI.build({ P, g: 0, ...(pl ? { pl } : {}) });
    if (!SR.err) { (SR.TS.rows || []).forEach((r, i) => { if (i % 10) return; check(`${name} ts ${i}`, GB.shearDetail(SR, P, { i }), () => GD.stiff(slot(), { R: SR, opt: { i }, dxf: () => GB.shearDetail(SR, P, { i }) })); });
      SR.BS.rows.forEach((r, i) => check(`${name} bs ${i}`, GB.shearBearing(SR, P, { i }), () => GD.bear(slot(), { R: SR, opt: { i }, dxf: () => GB.shearBearing(SR, P, { i }) }))); }
    ['X', 'Kb', 'Kt'].forEach(t => { const Q = J(P); Q.crossframes.type = t; const B = W.SBDFramingUI.build({ P: Q, g: 0 }); if (!B || !B.R || B.err) return;
      check(`${name} cf ${t}`, GB.crossframe(B, Q, {}), () => GD.crossframe(slot(), { B, opt: {}, dxf: () => GB.crossframe(B, Q, {}) }), ['1', '2', '3', '4', '5']); });   // the member numbers are in the table
    const WB = W.SBDWeldsUI.build(pl ? { P, g: 0, src: 'file', pl, plName: name } : { P, g: 0, src: 'analysis' });
    if (!WB.err) WB.R.fw.forEach(r => check(`${name} weld ${r.i}`, GB.weldDetail(WB, P, { i: r.i }), () => GD.weld(slot(), { B: WB, opt: { i: r.i }, dxf: () => GB.weldDetail(WB, P, { i: r.i }) })));
    if (!pl) { const AR = W.SBDAnalysis.analyzeGirder(P, 0), Gs = W.SBDSplices.girder(P, 0, AR, { env: W.SBDSplicesUI.envOf(P) });
      Gs.list.forEach((s, i) => { check(`${name} splice ${i}`, GB.splice(s, {}), () => GD.splice(slot(), { s, dxf: () => GB.splice(s, {}) })); assert.ok(/^<div class="vk vk-det"/.test(GD.spliceFigure(s, 760)), 'report figure'); }); }
  }
  console.log(`       ${st.cards} cards, ${st.nums} numbers of the CAD drawings found in them`); assert.ok(st.cards > 40, 'cards');
});
