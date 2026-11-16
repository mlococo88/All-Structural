#!/usr/bin/env node
// Timber Beam Check, NDS parity (TBA1, 2026-11-16): the calculation engine of a reference version (default origin/main) and of the
// working tree, run in Node on a broad set of NDS 2018 projects: ASD and LRFD; sawn lumber (every species x grade x size, edgewise and
// flat), timbers, glulam (every combination, custom), SCL; single span, continuous, span + overhang, fixed-free cantilever; point loads,
// notches, wet / hot / incised, lateral-support options; legacy (pre-R1) files; plus random projects. Compared exactly (NaN, -0 and
// Infinity kept): every field of tbcRun(model) (the results the tabs and the Report are built from), the model tbcMigrate opens
// (saved data) and tbcVersionFor. Also: the reference version refuses an AASHTO project of a newer version (version 4: TBA1; 5: with the TBA2 bridge loads) instead of
// opening it as NDS or dropping its inputs.
//   node tests/timber-nds-parity.mjs [--a <git ref>] [--random <n>]
import { execFileSync } from 'node:child_process';
import { tbcEngine, TBC_FILE } from './engine/tbc-source.mjs';
import { REPO } from './lib.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) if (av[i].startsWith('--')) args[av[i].slice(2)] = av[i + 1];
const ref = args.a || 'origin/main', nRand = +(args.random || 3000);
const htmlA = execFileSync('git', ['-C', REPO, 'show', `${ref}:Timber Beam Check.html`], { encoding: 'utf8', maxBuffer: 1 << 28 });
const EA = tbcEngine(null, htmlA), EB = tbcEngine(TBC_FILE);
const ser = v => JSON.stringify(v, (k, x) => typeof x === 'number' ? (Number.isNaN(x) ? 'NaN' : !isFinite(x) ? String(x) : Object.is(x, -0) ? '-0' : x) : x);
const cl = o => JSON.parse(JSON.stringify(o));
let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648; const pick = a => a[Math.floor(rnd() * a.length)];

const cases = [];
const base = () => cl(EB.tbcDefaultModel());
const add = (name, fn) => { const m = base(); fn(m); cases.push([name, m]); };
const GEOMS = {
  simple: m => { m.geom.spans = [{ L: 16 }]; m.geom.supports = [{ t: 'pin', lb: 3.5, cb: false }, { t: 'pin', lb: 3.5, cb: false }]; },
  cont2: m => { m.geom.spans = [{ L: 12 }, { L: 14 }]; m.geom.supports = [{ t: 'pin', lb: 3.5, cb: false }, { t: 'pin', lb: 5.5, cb: true }, { t: 'pin', lb: 3.5, cb: false }]; },
  overhang: m => { m.geom.spans = [{ L: 12 }, { L: 3 }]; m.geom.supports = [{ t: 'pin', lb: 3.5, cb: false }, { t: 'pin', lb: 3.5, cb: true }, { t: 'free', lb: 3.5, cb: false }]; },
  cant: m => { m.geom.spans = [{ L: 6 }]; m.geom.supports = [{ t: 'fixed', lb: 3.5, cb: false }, { t: 'free', lb: 3.5, cb: false }]; },
};
const METH = ['ASD', 'LRFD'];
// sawn: species x grade x size, edgewise and flat
for (const sp of Object.keys(EB.DEFAULT_SPECIES)) for (const gr of Object.keys(EB.GRADES_DB)) for (const sz of EB.SIZES_DB.map(s => s.label)) for (const flat of [false, true])
  add(`sawn ${sp} ${gr} ${sz}${flat ? ' flat' : ''}`, m => { m.material.species = sp; m.material.grade = gr; m.material.size = sz; m.design.flatUse = flat; m.design.method = pick(METH); GEOMS[pick(Object.keys(GEOMS))](m); });
// glulam every combination; SCL
for (const c of [...Object.keys(EB.GLULAM_5A), 'Custom']) for (const g of Object.keys(GEOMS)) for (const meth of METH)
  add(`glulam ${c} ${g} ${meth}`, m => { m.material.type = 'glulam'; m.material.glulam.combo = c; if (c === 'Custom') Object.assign(m.material.glulam.custom, { Fbp: 2400, Fbn: 1450, Fv: 265, Fcp: 650, E: 1800000, Emin: 950000 }); m.design.method = meth; GEOMS[g](m); m.loads.S = 30; m.material.notch = 1; });
for (const g of Object.keys(GEOMS)) for (const meth of METH)
  add(`scl ${g} ${meth}`, m => { m.material.type = 'scl'; Object.assign(m.material.scl, { Fb: 2600, Fv: 285, Fcp: 750, E: 1900000, Emin: 966000, n: 0.111, dens: 42 }); m.design.method = meth; GEOMS[g](m); });
// options on the default joist
const OPTS = [m => { m.design.moisture = 'Wet'; }, m => { m.design.temp = '125-150'; }, m => { m.design.incising = true; }, m => { m.design.repetitive = false; },
  m => { m.design.latTop = 'Supports'; m.design.luTop = 7; }, m => { m.design.latBot = 'same'; }, m => { m.design.latBot = 'Continuous'; }, m => { m.loads.W = -60; },
  m => { m.loads.points = [{ mag: 800, loc: 4, type: 'L' }, { mag: -200, loc: 10, type: 'W', lb: 3 }]; }, m => { m.material.notch = 2; m.material.notchFace = 'comp'; m.material.notchE = 1.5; },
  m => { m.design.shearXd = true; m.loads.points = [{ mag: 1500, loc: 0.5, type: 'D' }]; }, m => { m.geom.supports[0].fcs = 405; }, m => { m.material.manual = true; }, m => { m.design.lrfdLive = 'storage'; m.design.method = 'LRFD'; },
  m => { m.loads.Lr = 20; m.loads.S = 25; }, m => { m.design.creep = 0; }, m => { m.geom.spacing = 0; }, m => { m.geom.spans = [{ L: null }]; }];
OPTS.forEach((o, i) => Object.keys(GEOMS).forEach(g => METH.forEach(meth => add(`opt ${i} ${g} ${meth}`, m => { GEOMS[g](m); m.design.method = meth; o(m); }))));
// random projects
for (let k = 0; k < nRand; k++) add(`rand ${k}`, m => {
  m.material.type = pick(['sawn', 'sawn', 'glulam', 'scl']); m.material.species = pick(Object.keys(EB.DEFAULT_SPECIES)); m.material.grade = pick(Object.keys(EB.GRADES_DB)); m.material.size = pick(EB.SIZES_DB.map(s => s.label));
  m.material.glulam.combo = pick(Object.keys(EB.GLULAM_5A)); m.material.glulam.nLam = 6 + Math.floor(rnd() * 20); Object.assign(m.material.scl, { Fb: 2600, Fv: 285, Fcp: 750, E: 1900000, Emin: 966000, n: 0.111, dens: 42 });
  m.design.method = pick(METH); GEOMS[pick(Object.keys(GEOMS))](m); m.geom.spans.forEach(s => { s.L = Math.round((2 + rnd() * 26) * 4) / 4; });
  m.loads.D = Math.round(rnd() * 30); m.loads.L = Math.round(rnd() * 80); m.loads.S = rnd() < 0.3 ? 30 : 0; m.loads.W = rnd() < 0.3 ? -40 : 0;
  if (rnd() < 0.4) m.loads.points = [{ mag: Math.round(rnd() * 3000 - 500), loc: Math.round(rnd() * 10 * 4) / 4, type: pick(['D', 'L', 'S', 'W', 'Lr']) }];
  m.design.moisture = pick(['Dry', 'Dry', 'Wet']); m.design.flatUse = rnd() < 0.15; m.design.incising = rnd() < 0.15; m.design.latTop = pick(['Continuous', 'Supports']); m.design.latBot = pick(['Supports', 'Continuous', 'same']);
  m.material.notch = rnd() < 0.2 ? 1 : 0; m.geom.spacing = pick([12, 16, 24, 48, 96]);
});
// legacy (pre-R1) files
const legacy = [{}, { span: 14, spacing: 16, wDead: 10, wLive: 40, species: 'DF-L', grade: 'No.2', sizeLabel: '2x10' }, { span: 20, sizeLabel: '6x12', grade: 'No.1', wSnow: 30, latSupport: 'Supports', unbracedLen: 7, temp: 'High', moisture: 'Wet' },
  { span: 12, pointLoads: [{ mag: 500, loc: 6, type: 'L' }], notchDepth: 1, isManual: true, manualProps: { Fb: 1000, Fv: 180, E: 1700000, Emin: 620000, FcPerp: 625 } }];

let n = 0, nd = 0; const bad = [];
const cmp = (name, a, b) => { n++; if (a !== b) { nd++; if (bad.length < 10) bad.push(name); } };
for (const [name, m] of cases) {
  const sA = EA.tbcSanitize(cl(m)), sB = EB.tbcSanitize(cl(m));
  cmp(name + ' sanitize', ser(sA), ser(sB));
  cmp(name + ' version', ser(EA.tbcVersionFor(sA)), ser(EB.tbcVersionFor(sB)));
  cmp(name + ' run', ser(EA.tbcRun(sA)), ser(EB.tbcRun(sB)));
  const f = { ...cl(sB), _schema: 'timber-beam-check', version: EB.tbcVersionFor(sB) };
  cmp(name + ' migrate', ser(EA.tbcMigrate(cl(f))), ser(EB.tbcMigrate(cl(f))));
}
legacy.forEach((d, i) => { const a = EA.tbcMigrate(cl(d)), b = EB.tbcMigrate(cl(d)); cmp('legacy ' + i, ser(a), ser(b)); cmp('legacy run ' + i, ser(EA.tbcRun(a.model)), ser(EB.tbcRun(b.model))); });
const runs = cases.filter(([, m]) => EB.tbcRun(EB.tbcSanitize(cl(m))).ok).length;
// an AASHTO project in the reference version: refused (newer format), never read as NDS
const aas = cl(EB.tbcDefaultModel()); aas.design.code = 'AASHTO'; aas.design.aashto = EB.tbcAashtoDefaults(); if (EB.tbcAasLoadDefaults) aas.design.aashto.bl = EB.tbcAasLoadDefaults(); aas.version = EB.tbcVersionFor(aas);
let refused = false, readOK = false; try { const r = EA.tbcMigrate(cl(aas)); readOK = r.model.design.code === 'AASHTO'; } catch (e) { refused = /newer format/.test(e.message); }
const newer = aas.version > EA.TBC_VERSION;   // TBA3: when the reference reads this version (same format), it must open it as AASHTO, not refuse it
console.log(`${ref} vs working tree: ${cases.length} NDS projects (${runs} with results) + ${legacy.length} legacy files, ${n} comparisons, ${nd} differences${bad.length ? ': ' + bad.join(', ') : ''}`);
console.log(`AASHTO project (version ${aas.version}) in ${ref} (reads up to ${EA.TBC_VERSION}): ${refused ? 'refused (newer format)' : readOK ? 'opened as AASHTO' : 'NOT refused, NOT AASHTO'}`);
process.exit(nd || (newer ? !refused : !readOK) ? 1 : 0);
