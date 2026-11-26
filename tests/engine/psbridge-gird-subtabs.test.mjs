// apps/ps-bridge GSUB (engineer, 2026-11-25): the Girders & strands input tab split into sub-tabs (ui/girdsubs.js): Girder types, Section,
//   Strands, Reinforcement. Display only. Checked: (1) each card is on its intended sub-tab, once; (2) every field of tab 'gird' in
//   engine/fields.js (and the strand-row table) is on exactly one sub-tab, the one subOf names; (3) the cards are the same HTML as the single
//   pane before (the old composition, rebuilt here from the same functions), the scope choice the same; (4) every link to this tab in the
//   app names a target (data-goin="gird@<card or field>") that resolves to a sub-tab; (5) an input error counts on the sub-tab of its field;
//   (6) a saved ui without gsub (or an unknown value) opens Girder types.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', ...PBD, ...['sections', 'model', 'rigid', 'lldf-fg', 'reltension', 'holddown', 'pierblock', 'demands', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck'].map(n => path.join(APP, `engine/${n}.js`)),
  ...['vizkit', 'strands', 'strandedit', 'inputs', 'types', 'girdsubs'].map(n => path.join(APP, `ui/${n}.js`)));
const GS = () => W.PSBGirdSubs, IN = () => W.PSBInputsUI, TY = () => W.PSBTypesUI, F = () => W.PSBFields;
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const J = v => JSON.parse(JSON.stringify(v));

// projects: the new project (girder types) and one with every conditional field of the tab shown (a project with no girder types: its
// Design girder card, checked through cards() below; the page's projects have girder types, engine/bridge.js migrate)
function projects() {
  const typed = W.PSBModel.newProject();
  const all = W.PSBModel.newProject();
  all.spans = { lengths: [100, 110], continuity: 'composite' }; W.PSBBridge.syncSpans(all);
  all.base.girder = 'Custom'; all.base.ovr = Object.assign({}, all.base.ovr, { on: true }); all.base.harp.n = 4; all.base.opt.relBondedReinf = true;
  all.base.rows.push({ n: 2, y: 8, nd: 2, dbnd: 6 });
  return { typed, all };
}
const scopes = P => [-1].concat(W.PSBBridge.hasTypes(P) ? [0] : []);
const viewOf = (P, k) => k >= 0 ? Object.assign({}, P, { base: W.PSBBridge.effBase(P, k) }) : P;
const uiOf = (P, k, gsub) => ({ itab: 'gird', gsub, scope: k >= 0 ? P.types[k].id : '' });
// the panels of the pane: { sub: html }
function panels(html) {
  const o = {}; const re = /<div class="gSub" role="tabpanel" id="gsub_(\w+)" data-gsubpane="\1" aria-labelledby="gsubT_\1"( hidden)?>/g; let m;
  const at = []; while ((m = re.exec(html))) at.push([m[1], m.index, m.index + m[0].length, !!m[2]]);
  at.forEach((a, i) => { o[a[0]] = { html: html.slice(a[2], i + 1 < at.length ? at[i + 1][1] : html.length), hidden: a[3] }; });
  return o;
}
const cardIds = h => [...h.matchAll(/<section class="sec" id="card-([\w-]+)"/g)].map(m => m[1]);
const paths = h => [...h.matchAll(/data-path="([^"]+)"/g)].map(m => m[1]);
// the single pane before GSUB (index.html panes().gird, origin/main 2026-11-25), from the same functions
function oldPane(P, ui, V, sk) {
  return TY().card(P, ui) + TY().shownCard(P) + TY().scopeBar(P, ui, 'gird') + IN().cards('gird', V)
    + `<section class="sec"><div class="secHead">Strand pattern${sk >= 0 ? ` of ${esc(P.types[sk].label)}` : ''}</div><div class="secBody" id="gfx_strands_in"><p class="note">Shown when the inputs have no error.</p></div></section>`
    + W.PSBStrandEdit.card(sk >= 0 ? P.types[sk].label : '');
}
// a card's own HTML: from its <section> to its matching </section>
function cardHtml(h) {
  const out = []; let i = 0;
  while ((i = h.indexOf('<section class="sec"', i)) >= 0) {
    let d = 0, j = i; const re = /<\/?section\b/g; re.lastIndex = i; let m;
    while ((m = re.exec(h))) { if (m[0] === '<section') d++; else { d--; if (!d) { j = h.indexOf('>', m.index) + 1; break; } } }
    out.push(h.slice(i, j).replace(' id="card-strandPat"', '')); i = j;
  }
  return out;
}

test('GSUB: each card is on its intended sub-tab, once; one panel shown (ui.gsub)', () => {
  const want = { types: ['types', 'design'], sec: ['shape'], str: ['rows', 'strandPat', 'draped', 'strandEdit'], reinf: ['stirrups', 'tie', 'rel', 'split'] };
  for (const [name, P] of Object.entries(projects())) for (const k of scopes(P)) for (const [cur] of GS().SUBS) {
    const h = GS().pane(P, uiOf(P, k, cur), viewOf(P, k), k), pn = panels(h);
    assert.deepEqual(Object.keys(pn), ['types', 'sec', 'str', 'reinf'], name);
    for (const s in pn) {
      assert.equal(pn[s].hidden, s !== cur, `${name} ${s} hidden`);
      const ids = cardIds(pn[s].html);
      ids.forEach(id => assert.equal(GS().CARDS[id], s, `${name}: card ${id} on ${s}`));
      assert.deepEqual(ids.filter(id => id !== 'design' && id !== 'types'), want[s].filter(id => id !== 'design' && id !== 'types'), `${name} ${s}: the cards`);
    }
    const all = cardIds(h); assert.equal(new Set(all).size, all.length, `${name}: every card once`);
    // the sub-tab row: role tablist, the selected one aria-selected
    assert.match(h, /<div class="gSubs" id="gSubs" role="tablist"/);
    assert.equal([...h.matchAll(/role="tab" id="gsubT_(\w+)" data-gsub="\1" aria-controls="gsub_\1" aria-selected="true"/g)].map(m => m[1]).join(), cur);
    // the scope choice above Section, Strands and Reinforcement (with girder types), not on Girder types
    assert.equal(/id="tyScope_gird"/.test(h), cur !== 'types' && W.PSBBridge.hasTypes(P), `${name} ${cur}: scope choice`);
  }
  const P = W.PSBModel.defaultProject(); assert.deepEqual(cardIds(IN().cards('gird', P, null, id => GS().CARDS[id] === 'types')), ['design'], 'no girder types: the Design girder card on Girder types');
  const T = projects().typed; assert.ok(cardIds(panels(GS().pane(T, uiOf(T, -1, 'types'), T, -1)).types.html).includes('types'), 'the Girder types card on Girder types');
});

test('GSUB: every field of tab gird (engine/fields.js and the strand-row table) is on exactly one sub-tab, the one subOf names', () => {
  const { all } = projects();
  for (const k of scopes(all)) {
    const h = GS().pane(all, uiOf(all, k, 'sec'), viewOf(all, k), k), pn = panels(h);
    const where = {}; for (const s in pn) paths(pn[s].html).forEach(p => { (where[p] = where[p] || new Set()).add(s); });
    const fields = F().ALL().filter(f => f.card.tab === 'gird');
    assert.ok(fields.length >= 30, `fields of gird: ${fields.length}`);
    fields.forEach(f => {
      assert.ok(where[f.p], `${f.p} is drawn (scope ${k})`);
      assert.equal(where[f.p].size, 1, `${f.p} on one sub-tab`);
      assert.equal([...where[f.p]][0], GS().subOf(f.p), `${f.p}: subOf`);
      assert.equal(GS().subOf(f.p), GS().CARDS[f.card.id]);
    });
    all.base.rows.forEach((r, i) => ['n', 'y', 'nd', 'dbnd'].forEach(c => { const p = `base.rows.${i}.${c}`; if (k < 0) { assert.deepEqual([...where[p]], ['str'], p); assert.equal(GS().subOf(p), 'str'); } }));
    // every data-path drawn on the tab is on one sub-tab and subOf agrees (the girder types' controls: Girder types)
    Object.entries(where).forEach(([p, s]) => { assert.equal(s.size, 1, p); assert.equal(GS().subOf(p), [...s][0], `subOf ${p}`); });
  }
  assert.equal(GS().subOf('design.g'), 'types'); assert.equal(GS().subOf('types.0.lines'), 'types');
  assert.equal(GS().subOf('base.mat.fc'), ''); assert.equal(GS().subOf('xs.nb'), '');
});

test('GSUB: the cards, values and scope choice are the same HTML as the single pane before (base and a girder type in scope)', () => {
  for (const [name, P] of Object.entries(projects())) for (const k of scopes(P)) {
    if (k >= 0) { P.types[k].ovr['harp.n'] = 6; P.types[k].ovr.girder = 'PCI BT-63'; }
    const ui = uiOf(P, k, 'reinf'), V = viewOf(P, k);
    const old = oldPane(P, ui, V, k), now = GS().pane(P, ui, V, k);
    const a = cardHtml(old).sort(), b = cardHtml(now).sort();
    assert.deepEqual(b, a, `${name} scope ${k}: the same cards`);
    assert.ok(a.length >= 9, `${name}: ${a.length} cards`);
    const sb = TY().scopeBar(P, ui, 'gird'); if (sb) assert.ok(now.includes(sb), 'the same scope choice');
    // the inputs: ids, paths and values
    const inputs = h => [...h.matchAll(/<(input|select)\b[^>]*>/g)].map(m => m[0]).sort();
    assert.deepEqual(inputs(now), inputs(old), `${name} scope ${k}: every input tag the same`);
    // unfiltered cards() unchanged by the new argument: the filtered calls in the old order give it back
    const ids = ['design', 'shape', 'rows', 'draped', 'stirrups', 'tie', 'rel', 'split'];
    assert.equal(ids.map(id => IN().cards('gird', V, null, x => x === id)).join(''), IN().cards('gird', V));
  }
});

test('GSUB: every link to the Girders & strands tab names a target on one of its sub-tabs', () => {
  const files = [path.join(APP, 'index.html'), ...['ui', 'engine', 'report'].flatMap(d => fs.readdirSync(path.join(APP, d)).filter(f => f.endsWith('.js')).map(f => path.join(APP, d, f)))];
  let n = 0;
  for (const f of files) {
    const t = fs.readFileSync(f, 'utf8');
    assert.ok(!/data-goin="gird"/.test(t), `${path.basename(f)}: a bare data-goin="gird"`);
    assert.ok(!/goin: 'gird'/.test(t), `${path.basename(f)}: a bare goin 'gird'`);
    assert.ok(!/\['in', 'gird',/.test(t), `${path.basename(f)}: a bare drawing link to gird`);
    assert.ok(!/tab:in:gird\|/.test(t), `${path.basename(f)}: a bare Report link to gird`);
    for (const m of t.matchAll(/(?:data-goin="|goin: '|\['in', '|tab:in:)(gird@[^"'$|]+)["'|]/g)) {
      const g = GS().parse(m[1]); assert.equal(g.tab, 'gird');
      assert.ok(GS().subOf(g.target), `${path.basename(f)}: ${m[1]} resolves to a sub-tab`); n++;
    }
  }
  assert.ok(n >= 25, `${n} links`);
  // the targets a link names: the card on its sub-tab
  assert.equal(GS().subOf('card-split'), 'reinf'); assert.equal(GS().subOf('base.opt.relAs'), 'reinf'); assert.equal(GS().subOf('card-stirrups'), 'reinf');
  assert.equal(GS().subOf('base.harp.n'), 'str'); assert.equal(GS().subOf('card-strandPat'), 'str'); assert.equal(GS().subOf('card-shape'), 'sec');
  assert.equal(GS().subOf('base.cont.AsTop'), 'reinf'); assert.equal(GS().subOf('card-design'), 'types'); assert.equal(GS().subOf('types'), 'types');
  assert.deepEqual(J(GS().parse('gird@base.opt.relAs')), { tab: 'gird', target: 'base.opt.relAs' }); assert.deepEqual(J(GS().parse('mat')), { tab: 'mat', target: '' });
});

test('GSUB: an input error counts on the sub-tab of its field; an old saved ui opens Girder types', () => {
  const P = W.PSBModel.newProject();
  P.base.opt.splitN = -1; P.base.harp.n = 1.5; P.base.cust = P.base.cust || {}; P.base.rows[0].n = -2;
  const errs = W.PSBInputCheck.collect(P).errors, tabOf = F().tabOf;
  const c = J(GS().count(errs, tabOf));
  assert.ok(c.reinf >= 1, `reinforcement errors ${JSON.stringify(c)}`); assert.ok(c.str >= 2, `strand errors ${JSON.stringify(c)}`);
  assert.equal(Object.values(c).reduce((a, b) => a + b, 0), errs.filter(e => tabOf(e.path) === 'gird').length, 'every error of the tab on one sub-tab');
  errs.filter(e => tabOf(e.path) === 'gird').forEach(e => assert.ok(GS().subOf(e.path), e.path));
  assert.equal(GS().norm(undefined), 'types'); assert.equal(GS().norm('zzz'), 'types'); assert.equal(GS().norm('str'), 'str');
  // an old saved ui (no gsub) draws Girder types
  const pn = panels(GS().pane(P, { itab: 'gird', otab: 'sum' }, P, -1)); assert.equal(pn.types.hidden, false); assert.equal(pn.sec.hidden, true);
});
