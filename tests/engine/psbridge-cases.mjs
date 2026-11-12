// PS Bridge PR 2a, parity harness A (tests/engine/psbridge-parity.test.mjs): the input cases.
//   recordedCases(): the 38 cases of tests/ps-compare.mjs ("defaults" = the first open, no saved inputs; every tests/projects/ps/*.json =
//                    a saved psbeam.inputs.v1 object), each as the page reads it (mergeInputs of the saved object, done by each side itself).
//   seededCases(n, seed): n generated cases (default 600, seed 20261112), deterministic (mulberry32). Each starts from a recorded case
//                    (cycling through every library shape, then the other recorded cases) and changes, by the seeded draw: span and spacing,
//                    interior / exterior (with its own d_e), f'ci / f'c / H / strand size / low relaxation / jacking ratio, loss method,
//                    owner (AASHTO, MassDOT, CTDOT, RIDOT) with its η questions and HL-93 multiplier, continuity (2-4 spans from six arrangements, any span,
//                    restraint on/off, top and pier steel), draped strands (n_h 0-16, frac 0.30-0.50, y_end), debonding, release steel,
//                    MIDAS demands (span 1-3, imported DF and MPF), rating vehicles, handling, deck design, diaphragms, DF and LL overrides.
//                    Inputs only: nothing the old app would not accept from its own input tabs.
//   edgeCases(): out-of-range and partly blank inputs (no strands, f'ci > f'c, zero or negative span, blank text, more draped strands than
//                strands, unknown shape / owner, frac outside 0-0.5, ...): the two sides must fail, warn or compute alike.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './harness.mjs';

const DIR = path.join(ROOT, 'tests/projects/ps');
const J = v => JSON.parse(JSON.stringify(v));
export function recordedCases() {
  const out = [{ name: 'defaults', saved: null }];
  for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort()) out.push({ name: f.replace(/\.json$/, ''), saved: JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) });
  return out;
}

function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export function seededCases(n = 600, seed = 20261112) {
  const rnd = mulberry32(seed), pick = a => a[Math.floor(rnd() * a.length)], chance = p => rnd() < p, r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
  const rec = recordedCases().filter(c => c.saved), shapes = rec.filter(c => c.name.startsWith('shape_')), others = rec.filter(c => !c.name.startsWith('shape_'));
  const midas = rec.filter(c => c.name.startsWith('midas_'));
  const UNITS = [[100, 100], [120, 120], [90, 110], [100, 120, 100], [80, 100, 80], [100, 120, 120, 100]];
  const SEL = [{ idx: 1, x0: 0, x1: 100, len: 100 }, { idx: 2, x0: 100, x1: 220, len: 120 }, { idx: 3, x0: 220, x1: 320, len: 100 }];
  const out = [];
  for (let i = 0; i < n; i++) {
    const base = i % 3 === 2 ? others[(i / 3 | 0) % others.length] : shapes[(i - (i / 3 | 0)) % shapes.length];
    const p = J(base.saved), g = p.girder || '', ib = /Type|BT-|Custom/.test(g), next = /NEXT/.test(g), adj = /BI|Deck slab/.test(g);
    const tags = [base.name];
    p.opt = p.opt || {}; p.loads = p.loads || {}; p.mat = p.mat || {}; p.str = p.str || {}; p.cont = p.cont || {}; p.harp = p.harp || {};
    // span and spacing
    if (!p.external) { p.L = r1(p.L * pick([0.6, 0.8, 1, 1, 1.15, 1.3])); }
    if (ib) p.S = pick([6, 7.5, 8, 9, 10.5, 12]); else if (next) p.S = pick([8, 9, 10, 12]);
    if (ib && chance(0.15)) { p.beffAuto = false; p.beff = r1(p.S * 12 * pick([0.8, 1])); }
    if (chance(0.15)) p.th = pick([0, 1, 2, 3]);
    if (chance(0.1)) p.ts = pick([7.5, 8, 9]);
    // position
    if (chance(0.35)) { p.loads.pos = 'exterior'; p.loads.posAuto = false; p.loads.de = pick([0, 1, 2, 2.5, 3]); tags.push('ext'); }
    // materials and strands
    if (chance(0.6)) { const fc = pick([6, 7, 8, 8.5, 9, 10]); p.mat.fc = fc; p.mat.fci = r1(fc * pick([0.7, 0.75, 0.8, 0.85])); }
    if (chance(0.3)) p.mat.H = pick([40, 50, 60, 70, 80, 90]);
    if (chance(0.2)) p.str.size = pick(['0.5 in', '0.6 in', '0.7 in']);
    if (chance(0.1)) p.str.lowlax = false;
    if (chance(0.15)) p.str.jack = pick([0.7, 0.72, 0.75]);
    if (chance(0.3)) { p.opt.lossMethod = 'approx'; tags.push('approx'); }
    if (chance(0.1)) { p.opt.dfpSSauto = false; p.opt.dfpSS = pick([0, 1, 2.5]); }
    if (chance(0.15)) p.opt.useTrans = true;
    // owner
    const own = pick(['AASHTO', 'AASHTO', 'MassDOT', 'CTDOT', 'RIDOT']);
    if (own !== 'AASHTO') { p.owner = own; tags.push(own); if (chance(0.5)) p.opt.etaD = true; if (chance(0.3)) p.opt.etaR = true; if (chance(0.3)) p.opt.etaI = true;
      if (chance(0.3)) p.opt.llMult = pick(['', 1, 1.2, 1.25]); if (chance(0.3)) p.opt.sidewalk = chance(0.5); }
    if (chance(0.3)) p.opt.corrosion = pick(['normal', 'severe']);
    if (chance(0.15)) p.opt.relCfac = pick([0.6, 0.65, '']);
    // continuity
    if (!p.external && chance(0.3)) {
      // the continuous unit from a few fixed arrangements, this design's L = its span's length: the old and the new engine both keep
      // the FE model of a span arrangement (sgBeam cache), so the harness pays each arrangement's FE solution once per context
      const spans = J(pick(UNITS)), ns = spans.length, si = 1 + Math.floor(rnd() * ns), none = chance(0.15);
      p.L = none ? pick([80, 100, 120]) : spans[si - 1];
      p.cont = { ...p.cont, on: true, restraint: chance(0.5), spans: none ? [] : spans, span: si };
      if (chance(0.5)) { p.cont.As = pick([12, 16, 20]); p.cont.AsPos = pick([0, 2, 3]); p.cont.AsTop = pick([0, 3]); }
      if (chance(0.3)) p.cont.age = pick([28, 60, 90, 120]);
      tags.push('cont' + ns + (p.cont.restraint ? 'r' : ''));
    } else if (!p.external && p.cont.on && chance(0.5)) p.cont.on = false;
    else if (!p.external && p.cont.on) p.L = base.saved.L;   // a recorded continuous case keeps its span (its FE model, see above)
    // draped strands
    if (ib && chance(0.7)) { const h = (p.girder === 'Custom' ? (p.cust || {}).h : 0) || 0;
      p.harp = { ...p.harp, n: pick([0, 2, 4, 6, 8, 10, 12, 14, 16]), frac: pick([0.3, 0.33, 0.35, 0.4, 0.42, 0.45, 0.5]) };
      if (chance(0.5)) p.harp.yEnd = Math.max(6, (+p.harp.yEnd || 30) + pick([-12, -6, 0, 6])); if (chance(0.2)) p.harp.yMid = pick([4, 6, 8, 10]);
      void h; tags.push('h' + p.harp.n + '@' + p.harp.frac); }
    // debonding
    if (Array.isArray(p.rows) && chance(0.35)) { p.rows = p.rows.map((r, k) => k < 2 && chance(0.6) ? { ...r, dbnd: pick([4, 6, 10, 14]), nd: Math.min(r.n, pick([2, 4])) } : r); tags.push('debond'); }
    if (Array.isArray(p.rows) && chance(0.2)) p.rows = p.rows.map(r => ({ ...r, n: Math.max(0, r.n + pick([-2, 0, 2])) }));
    // release and end-zone steel
    if (chance(0.3)) { p.opt.relAs = pick([0, 0.31, 0.62, 1.2]); p.opt.relBondedReinf = chance(0.7); }
    if (chance(0.2)) { p.opt.splitN = pick([4, 8, 12, 16]); p.opt.confN = pick([0, 10, 19]); p.opt.stirAv = pick([0.22, 0.4, 0.62]); p.opt.sEnd = pick([3, 4, 6]); }
    // MIDAS demands
    if (p.external && chance(0.8)) { p.external._selSpan = J(pick(SEL)); p.loads.extDFpos = pick([0, 0.6, 1]); p.loads.extDFneg = pick([0.6, 1]); p.loads.extDFv = pick([0, 0.7, 1]); p.loads.extLLmpf = pick([1, 1.2]); tags.push('midas' + p.external._selSpan.idx); }
    else if (!p.external && chance(0.04) && midas.length) { p.external = J(pick(midas).saved.external); p.external._selSpan = J(pick(SEL)); tags.push('midas+'); }
    // rating vehicles, handling, deck, other loads
    if (chance(0.3)) { p.rateVeh = Array.from({ length: 1 + Math.floor(rnd() * 2) }, (_, k) => ({ name: 'V' + (k + 1), M: pick([0, 800, 1500, 2600]), V: pick([0, 60, 120]), W: pick([0, 36, 72]) })); tags.push('rate'); }
    if (chance(0.3)) { p.handling = { ...(p.handling || {}), on: true, aLift: pick([2, 4, 6]), aHaul: pick([4, 6, 10]) }; tags.push('hand'); }
    if (chance(0.3)) { p.deck = { ...(p.deck || {}), on: true, oh: pick([1.5, 3, 4]), sTop: pick([5, 6, 8]), xnegAuto: chance(0.7) }; tags.push('deck'); }
    if (chance(0.2)) { p.loads.diaph = [{ P: pick([2, 5]), a: r1(p.L / 2) }, ...(chance(0.5) ? [{ P: 3, a: r1(p.L / 3) }] : [])]; }
    if (chance(0.15)) { p.loads.dfAuto = false; p.loads.dfm = pick([0.5, 0.7]); p.loads.dfv = pick([0.6, 0.8]); }
    if (chance(0.1)) { p.loads.llAuto = false; p.loads.MLL = pick([1500, 2500]); p.loads.VLL = pick([80, 120]); }
    if (chance(0.15)) p.loads.skew = pick([0, 15, 30, 45]);
    if (chance(0.1)) p.loads.fatM = pick([0, 0.4]);
    if (chance(0.1)) p.loads.NL = pick([1, 2, 3, 4]);
    const env = chance(0.1) ? { db: { label: 'G2 (Interior)', index: 2 }, proj: { name: 'Shared project', bridgeId: 'B-1' } } : null;
    out.push({ name: `seed${String(i).padStart(3, '0')}:${tags.join(',')}`, saved: p, env });
  }
  return out;
}

export function edgeCases() {
  const R = recordedCases(), d = () => J(R.find(c => c.name === 'shape_PCI_BT_72').saved), out = [];
  const add = (name, f) => { const p = d(); f(p); out.push({ name: 'edge:' + name, saved: p }); };
  add('no-strands', p => { p.rows = [{ n: 0, y: 2, dbnd: 0, nd: 0 }]; p.harp.n = 0; });
  add('fci>fc', p => { p.mat.fci = 9; p.mat.fc = 6; });
  add('L=0', p => { p.L = 0; });
  add('L<0', p => { p.L = -40; });
  add('blank-text', p => { p.L = ''; p.S = ''; p.mat.fc = ''; });
  add('harp>strands', p => { p.harp.n = 60; });
  add('frac-out', p => { p.harp.frac = 0.75; });
  add('frac-0', p => { p.harp.frac = 0; });
  add('unknown-shape', p => { p.girder = 'Nope 99'; });
  add('unknown-owner', p => { p.owner = 'XDOT'; });
  add('huge-span', p => { p.L = 400; });
  add('tiny-span', p => { p.L = 5; });
  add('debond>n', p => { p.rows[0].nd = 50; p.rows[0].dbnd = 200; });
  add('cont-1span', p => { p.cont = { ...p.cont, on: true, spans: [120], span: 3 }; });
  add('cont-bad-spans', p => { p.cont = { ...p.cont, on: true, spans: [0, -10, 'x', 120], span: 9 }; });
  add('nan-string', p => { p.mat.fci = 'abc'; p.harp.yEnd = 'NaN'; });
  add('rows-empty', p => { p.rows = []; });
  add('rateVeh-blank', p => { p.rateVeh = [{ name: '', M: '', V: '', W: '' }]; });
  add('ovr-on', p => { p.ovr = { on: true, A: 800, I: '', yb: 36, Sb: '', St: 15000, wsw: '' }; });
  add('S=0', p => { p.S = 0; });
  return out;
}
