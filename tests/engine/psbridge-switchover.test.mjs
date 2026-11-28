// PS Bridge switch-over (2026-11-28, docs/ps-bridge-plan.md §5 row 10; engineer's decision: the old "Prestressed Bridge Design.html" becomes a
// redirect page to apps/ps-bridge/index.html; the old app's designs are offered for import and its saved data kept untouched):
//   1. the first-open offer (ui/legacy.js offerBar / onOffer): shown only when the old app's keys hold a design; it reads those keys only and
//      writes only psb2.legacyOffer.v1; every psbeam.* and Bridge Suite key byte-identical after it;
//   2. the redirect pages ("Prestressed Bridge Design.html", psbeam.html): forward to apps/ps-bridge/index.html keeping ?query and #hash;
//      the download offer (Firefox / Safari, per-file storage) only when that file's storage holds the old design and the new app was
//      never opened in it; never a psbeam.* write;
//   3. no page links to the old file any more (it would only bounce through the redirect), and the app carries no "in development" /
//      "not for design use" / "use the old app" note;
//   4. the hand-offs: the new app publishes as app id psbeam what the old app did (superReactions + .by.psbeam, producer PS-Beam, the
//      every-girder reactions), and the receiving tools read the keys unchanged (SubLoads reads .by.psbeam and .by.psbridge, the elastomeric
//      module bearingLoads .by.psbridge); BridgeApps sends the app id psbeam to the new app.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const W = loadShared(path.join(APP, 'engine/legacy.js'), path.join(APP, 'ui/legacy.js'));
const UI = W.PSBLegacyUI;
const DESIGN = JSON.stringify({ girder: 'PCI BT-72', L: 120, S: 8, nGirders: 5, proj: { name: 'Old job' } });
function store(init) {
  const m = new Map(Object.entries(init || {})), log = [];
  return { m, log, getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => { log.push(k); m.set(k, String(v)); }, removeItem: k => { log.push('-' + k); m.delete(k); },
    key: i => [...m.keys()][i] ?? null, get length() { return m.size; } };
}
// ui/legacy.js keeps the offer state for the page load: a fresh copy per case
const fresh = () => loadShared(path.join(APP, 'engine/legacy.js'), path.join(APP, 'ui/legacy.js')).PSBLegacyUI;
const click = v => ({ target: { closest: s => (s === '[data-lgoffer]' ? { dataset: { lgoffer: v } } : null) } });

test('first-open offer: shown only when the old app\'s keys hold a design; reads them only; writes only psb2.legacyOffer.v1; once', () => {
  assert.equal(UI.OFFER_KEY, 'psb2.legacyOffer.v1');
  // nothing of the old app (the engineer's case, 2026-11-28): no notice
  for (const init of [{}, { 'psb2.project.current': '{}' }, { 'psbeam.ui.v1': '{"tab":"x"}', 'psbeam.inputTab.v1': '"inputs"' }, { 'psbeam.inputs.v1': 'not json' },
    { 'bridgeSuite.v1.projects': JSON.stringify({ a: { name: 'MCT only', slices: { mct: {} } } }) }]) {
    const st = store(init); assert.equal(fresh().offerBar(st), '', JSON.stringify(init)); assert.deepEqual(st.log, []);
  }
  // a design on screen in the old app, a shared Bridge Suite project with a psbeam slice and the older list: offered, counted
  const init = { 'psbeam.inputs.v1': DESIGN, 'bridgeSuite.v1.projects': JSON.stringify({ p1: { name: 'Route 9', savedAt: '2026-10-30T12:00:00Z', slices: { psbeam: JSON.parse(DESIGN), mct: {} } } }),
    'bridgeSuite.v1.currentProjectId': 'p1', 'psbeam.projects.v1': JSON.stringify({ q: { name: 'Older', savedAt: '2026-09-01', inp: JSON.parse(DESIGN) } }), 'psbeam.ui.v1': '{}' };
  const before = JSON.stringify([...store(init).m]);
  const ui = fresh(), st = store(init), bar = ui.offerBar(st);
  assert.match(bar, /id="lgOffer"/); assert.match(bar, /3 designs/); assert.match(bar, /data-lgoffer="go"/); assert.match(bar, /data-lgoffer="no"/);
  assert.deepEqual(st.log, []);   // reading only
  let shown = 0; assert.equal(ui.onOffer(click('go'), st, () => { shown++; }), true); assert.equal(shown, 1);
  assert.deepEqual(st.log, ['psb2.legacyOffer.v1']); assert.equal(ui.offerBar(st), '');
  assert.equal(ui.state.list.items.length, 3);   // the card lists them (Project tab)
  st.m.delete('psb2.legacyOffer.v1'); assert.equal(JSON.stringify([...st.m]), before, 'every old key byte-identical');
  // "Not now": the same key, no list; a later page load does not show it again
  const st2 = store(init), u2 = fresh(); assert.match(u2.offerBar(st2), /3 designs/); assert.equal(u2.onOffer(click('no'), st2, () => assert.fail('no show')), true);
  assert.deepEqual(st2.log, ['psb2.legacyOffer.v1']); assert.equal(fresh().offerBar(st2), '');
  // one design: singular text
  assert.match(fresh().offerBar(store({ 'psbeam.inputs.v1': DESIGN })), /holds a design saved/);
  // a click elsewhere is not the offer's
  assert.equal(fresh().onOffer({ target: { closest: () => null } }, store(), () => {}), false);
  // the page wires it: above the output tabs, its click before the others
  const page = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
  assert.ok(page.includes('h += LGUI.offerBar(LS);') && page.includes('if (LGUI.onOffer(e, LS,'));
});

function runRedirect(file, { search = '', hash = '', init = {}, framed = false } = {}) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8'), js = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
  const st = store(init), els = {}, el = id => els[id] || (els[id] = { hidden: true, textContent: '', onclick: null, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, addEventListener() {} });
  const out = { replaced: null };
  const ctx = { localStorage: st, document: { getElementById: el, createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } },
    location: { search, hash, href: 'file:///repo/' + encodeURI(file) + search + hash, replace: u => { out.replaced = u; } }, JSON, String, Date, Blob: function () {}, URL: { createObjectURL: () => 'blob:', revokeObjectURL() {} }, setTimeout() {} };
  ctx.window = ctx; ctx.self = ctx; ctx.top = framed ? {} : ctx;
  vm.createContext(ctx); vm.runInContext(js, ctx);
  return { out, st, els };
}

test('redirect pages: "Prestressed Bridge Design.html" and psbeam.html forward to apps/ps-bridge/index.html with ?query and #hash; the per-file download offer; no psbeam.* write', () => {
  for (const f of ['Prestressed Bridge Design.html', 'psbeam.html']) {
    const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.ok(!/<script\s+src=|cdnjs|unpkg|jsdelivr/.test(html), `${f}: no library`); assert.ok(html.length < 9000, `${f}: a small page`);
    assert.match(html, /<a id="go" href="apps\/ps-bridge\/index.html">/);
    const a = runRedirect(f, { search: '?x=1', hash: '#rpt' }); assert.equal(a.out.replaced, 'apps/ps-bridge/index.html?x=1#rpt', f);
    assert.equal(runRedirect(f).out.replaced, 'apps/ps-bridge/index.html', f);
    // a design in this file's storage, the new app never opened here (Firefox / Safari): the offer, no forward, nothing written
    const b = runRedirect(f, { init: { 'psbeam.inputs.v1': DESIGN } });
    assert.equal(b.out.replaced, null, f); assert.equal(b.els.offer.hidden, false); assert.equal(b.els.pname.textContent, ' (Old job)'); assert.deepEqual(b.st.log, [], f);
    // the new app opened in the same storage (a psb2.* key): forward, no offer; in a frame: forward
    assert.equal(runRedirect(f, { init: { 'psbeam.inputs.v1': DESIGN, 'psb2.project.current': '{}' } }).out.replaced, 'apps/ps-bridge/index.html', f);
    assert.equal(runRedirect(f, { init: { 'psbeam.inputs.v1': DESIGN }, framed: true }).out.replaced, 'apps/ps-bridge/index.html', f);
  }
  // the root page's offer marks itself under the new app's prefix (psbeam.html keeps its own PBD-C3 key)
  const r = fs.readFileSync(path.join(ROOT, 'Prestressed Bridge Design.html'), 'utf8');
  assert.ok(r.includes("SEEN = 'psb2.redirect.offered.v1'") && !/setItem\((?!SEEN)/.test(r));
  assert.ok(fs.readFileSync(path.join(ROOT, 'psbeam.html'), 'utf8').includes("SEEN = 'psbeam.redirect.offered.v1'"));
});

test('no page links to the old file any more; the app carries no "in development" / "not for design use" / "use the old app" note', () => {
  const files = execFileSync('git', ['ls-files', '*.html', '*.js'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(f => f && !/^(archive|tests|fixlog)\//.test(f) && !['Prestressed Bridge Design.html', 'psbeam.html'].includes(f));
  const code = t => t.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');
  for (const f of files) {
    const c = code(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    assert.ok(!/href=["'][^"']*Prestressed(%20| )Bridge(%20| )Design\.html|psbeam:\s*'Prestressed Bridge Design\.html'|['"`](\.\.\/)*psbeam\.html['"`]/.test(c), `${f}: links to the old file`);
  }
  const app = execFileSync('git', ['ls-files', 'apps/ps-bridge'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(f => f && !/engine\/pbd-/.test(f));
  const tools = fs.readFileSync(path.join(ROOT, 'tools.html'), 'utf8'), card = tools.slice(tools.indexOf('<section><h2>Bridge suite'), tools.indexOf('<section><h2>Steel Bridge Design'));
  assert.ok(card.length > 100 && card.includes('apps/ps-bridge/index.html'));
  for (const [f, c] of app.map(f => [f, code(fs.readFileSync(path.join(ROOT, f), 'utf8'))]).concat([['tools.html (Bridge suite cards)', card]]))
    assert.ok(!/in development|not for design use|use the old (app|<a)|v3\.0-dev/i.test(c), `${f}: a pre-switch-over note`);
  assert.match(fs.readFileSync(path.join(ROOT, 'tools.html'), 'utf8'), /<a class="card" href="apps\/ps-bridge\/index.html" target="_blank"><div class="name">Prestressed Bridge Design \(PS-Girder\)<\/div>/);
});

test('hand-offs: the new app publishes as app id psbeam what the old app did; the receivers read the keys unchanged; BridgeApps sends psbeam to the new app', () => {
  const H = fs.readFileSync(path.join(APP, 'engine/handoffs.js'), 'utf8');
  assert.ok(H.includes("const PRODUCER = 'PS-Beam', SR_ID = 'psbeam', RX = 'psbridge';"));   // superReactions(.by.psbeam), producer as the old app
  const U = fs.readFileSync(path.join(APP, 'ui/handoffs.js'), 'utf8');
  assert.ok(/superReactions\.by\.psbeam/.test(U) && /allGirders/.test(fs.readFileSync(path.join(APP, 'engine/handoffs.js'), 'utf8') + U));
  const sub = fs.readFileSync(path.join(ROOT, 'Bridge Substructure Loading.html'), 'utf8');
  assert.ok(sub.includes("const BY = ['psbeam', 'mct', 'girderdetail'];") && sub.includes("BY.concat(['steelbridge', 'psbridge'])"));
  const edm = fs.readFileSync(path.join(ROOT, 'elastomeric_design_module.html'), 'utf8');
  assert.ok(edm.includes('const EDM_BRG={ RX:"edm", CH:"bearingLoads", PROD:["psbridge","steelbridge"] };'));
  assert.ok(fs.readFileSync(path.join(APP, 'engine/bearing.js'), 'utf8').includes("'psbridge'"));
  const boot = fs.readFileSync(path.join(ROOT, 'shared/bridge-suite-boot.js'), 'utf8');
  assert.ok(boot.includes("var DEF={mct:'index.html', psbeam:'apps/ps-bridge/index.html', lldf:'lldf.html'};"));
});
