// ui/loads.js applyOwnerDefaults (2026-11-01): the "Apply <DOT> defaults" button lists the inputs it changed. UI only: the project it
// leaves must equal what the previous inline code left (checked here against a copy of that code) for every owner.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, plain, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge/engine', f), W = loadShared('units.js', 'steps.js', 'lldf.js', E('model.js'), E('owners.js'), E('lldf.js'), E('loads.js'), path.join(ROOT, 'apps/steel-bridge/ui/loads.js'));
const M = W.SBDModel, O = W.SBDOwners, UL = W.SBDUiLoads;
const setp = (P, p, v) => { const ks = p.split('.'), last = ks.pop(), o = ks.reduce((a, k) => (a[k] == null ? (a[k] = {}) : a[k]), P); o[last] = v; };
function before(P) {   // the click handler as it was before the message was added
  O.defaults(P.ownerRules.owner).forEach(d => { if (d.path === 'deck.tsac') P.deck.tdeck = P.deck.ts + d.value; else { setp(P, d.path, d.value); if (d.path === 'xs.ws.psf') P.xs.ws.mode = 'psf'; } });
}
const mk = o => { const P = M.defaultProject(); UL.ensure(P); P.ownerRules.owner = o; return P; };

test('Apply defaults: the project it leaves is identical to the previous code, all owners', () => {
  for (const o of ['AASHTO', 'MassDOT', 'CTDOT', 'RIDOT']) {
    const a = mk(o), b = mk(o); before(a); UL.applyOwnerDefaults(b);
    assert.equal(JSON.stringify(a), JSON.stringify(b), o);
  }
});

test('Apply defaults: the message lists tab, field, old and new', () => {
  const P = mk('CTDOT'), r = UL.applyOwnerDefaults(P), by = {}; r.changes.forEach(c => by[c.field] = c);
  assert.equal(r.owner, 'CTDOT');
  assert.equal(JSON.stringify(Object.keys(by).sort()), JSON.stringify(['Dead load distribution', 'Future wearing surface', 'w_c for E_c only']));
  assert.equal(by['Future wearing surface'].to, '38.75'); assert.equal(by['Future wearing surface'].from, '25'); assert.equal(by['Future wearing surface'].tab, 'Cross-section & loads');
  assert.equal(by['w_c for E_c only'].from, '(blank)'); assert.equal(by['w_c for E_c only'].to, '0.145');
  assert.match(by['Dead load distribution'].from, /^MassDOT/); assert.match(by['Dead load distribution'].to, /^Typical AASHTO/);
  // total deck thickness 8 + 0.5 sacrificial = 8.5 = the value already there, and the wearing surface is already in weight mode: not listed as changed
  assert.equal(JSON.stringify(r.same.map(c => c.field).sort()), JSON.stringify(['Total deck thickness', 'Wearing surface entered as']));
  P.deck.ts = 7.5; P.deck.tdeck = 8; const r2 = UL.applyOwnerDefaults(P); assert.equal(r2.changes.length, 0, 'second click on the same project');
  const Q = mk('CTDOT'); Q.deck.tdeck = 9; Q.xs.ws.mode = 'thk'; const r3 = UL.applyOwnerDefaults(Q), f = Object.fromEntries(r3.changes.map(c => [c.field, c]));
  assert.equal(f['Total deck thickness'].from, '9'); assert.equal(f['Total deck thickness'].to, '8.5'); assert.equal(f['Wearing surface entered as'].from, 'Thickness × unit weight'); assert.equal(f['Wearing surface entered as'].to, 'Weight (psf)');
});
test('Apply defaults: a second click changes nothing and says so', () => {
  const P = mk('MassDOT'); const r1 = UL.applyOwnerDefaults(P); assert.equal(JSON.stringify(r1.changes.map(c => c.field)), JSON.stringify(['Concrete f′c']));
  assert.equal(r1.changes[0].from, '4'); assert.equal(r1.changes[0].to, '5'); assert.equal(r1.changes[0].tab, 'Materials & deck');
  const r2 = UL.applyOwnerDefaults(P); assert.equal(r2.changes.length, 0); assert.equal(r2.same.length, 1);
  assert.equal(UL.applyOwnerDefaults(mk('AASHTO')).changes.length, 0);
});
