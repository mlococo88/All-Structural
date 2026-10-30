#!/usr/bin/env node
// Auto design against the legacy design helpers (added 2026-10-30; engineer-approved spec of 2026-10-29: "in match legacy settings Auto
// design should find a design at least as good as the legacy one: equal or lower weight, with every check passing; report the cases where it
// differs and why").
//
// For each of the 20 recorded projects (tests/engine/ad-fixture.mjs: builtin, builtin28, curb, util, xsA × 4 owners) and the app's built-in
// project:
//   legacy  the designs the legacy helpers produced, recorded in Node by record-autodesign-legacy.mjs: Preliminary sizing's Full design
//           (suggestFull: depth, web, flanges, its own field splices) and ST-Girder's Optimize (the thinnest bottom flange of its sweep, per
//           girder hand-off; span 1, which is the span ST-Girder designs);
//   mine    Auto design in "match legacy" settings: New design, the project's girder count (Suggest does not change it), lightest steel, the
//           Preliminary sizing limits of the project (t_w, t_f, b_f minimums, the depth increment, thickness ratio, transitions per piece,
//           shortest zone, constant top flange width, width change at splices, the depth rule) and its field splices;
//   check   every design in this app's full check (engine/autodesign.js evaluate, level 'full': every module) on the same sbd2 project;
//   weight  all girders of the cross-section, plates only (flanges and web), the same formula for every design (engine/autodesign.js).
// The built-in project (the app's default project, AASHTO): Refine against ST-Girder's Optimize swept on its own plates (no hand-off file:
// the legacy line there is the current design with its bottom flanges at ST-Girder's optimum of the builtin_AASHTO girder hand-offs).
// Writes tests/projects/sbd2-autodesign/parity.json (rows) and prints a table. Usage: node tests/engine/autodesign-parity.mjs [filter …]
// (each row's result is kept in tests/projects/sbd2-autodesign/ad_<name>.json; FORCE=1 reruns).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './harness.mjs';
import { adWindow } from './autodesign.test.mjs';
import { RECS, plProject, loadsRec, sbd2FromPL, segsFromLegacy } from './ad-fixture.mjs';
import { tests } from './harness.mjs';
import { legacyContext } from './legacy-closure.mjs';
import { plDecl } from './pl-source.mjs';
import { gdDecl } from './gd-source.mjs';

tests.length = 0;   // the imported test file registers its tests; this script does not run them
const W = adWindow(), AD = W.SBDAutoDesign, M = W.SBDModel;
const DIR = path.join(ROOT, 'tests/projects/sbd2-autodesign'), J = o => JSON.parse(JSON.stringify(o));
const filt = process.argv.slice(2);
const PLDEF = J(legacyContext(['DEFAULT'], n => plDecl(n) || gdDecl(n)).ev('DEFAULT'));   // Preliminary sizing's built-in project

const layoutFromSegs = (P, segs, spl) => AD.layoutOf({ ...P, girders: [{ ...P.girders[0], segments: segs }], framing: { ...(P.framing || {}), splices: spl } });
/* pass: every module passes; passX: every check passes except detail checks that fail in the current design too (the blockers, cur) */
function check(P, segs, spl, ctx, cur) {
  const L = layoutFromSegs(P, segs, spl), Q = AD.projectWith(P, L), E = AD.evaluate(Q, { level: 'full', ctx }), S = AD.settings(Q), pr = AD.proportions(L, Q, S);
  const keys = new Set(E.fails.map(f => `${f.mod} ${f.id}`));
  return { w: AD.lineWeight(L) * L.nb, pass: E.pass && pr.ok, passX: pr.ok && (E.pass || (!!cur && [...keys].every(k => cur.has(k)))), failKeys: [...keys], ratio: E.ratio, gov: E.gov ? `${E.gov.mod} ${E.gov.id} ${E.gov.title}${E.gov.x != null ? ` at ${E.gov.x.toFixed(2)} ft` : ''} (${E.gov.gl || ''})` : '',
    fails: E.fails.slice(0, 4).map(f => `${f.mod} ${f.id} ${f.title}${f.x != null ? ` at ${(+f.x).toFixed(2)} ft` : ''} (${f.gl || ''}): ${isFinite(f.r) ? f.r.toFixed(3) : 'fail'}`), prop: pr.ok ? '' : pr.items.filter(q => !q.ok).map(q => q.id).join(', '), D: L.D };
}
/* match-legacy settings from the Preliminary sizing project */
function legacySettings(Ppl) {
  const L = Ppl.limits, SG = Ppl.suggest, n = v => +v;
  return { mode: 'new', objective: 'weight', topN: 3, nbList: String(Ppl.bridge.nb), matchLegacy: true,
    cost: { steel: n(Ppl.costs.steel), trans: n(Ppl.costs.trans), splice: n(Ppl.costs.splice), stiff: n(Ppl.costs.stiff) },
    limits: { twMin: n(L.minTw), tfMin: n(L.minTf), bfMin: n(L.minBf), tfMax: n(L.maxTf), Dinc: n(L.incD), twInc: n(L.incTw), bfInc: n(L.incBf), tfInc: n(L.incTf), thkRatio: n(L.thkRatio), areaRatio: n(L.areaRatio),
      minSeg: n(L.minSeg), maxTrans: n(L.maxTrans), lbRatio: n(L.lbRatio), topConst: SG.topConst !== 'off', maxDb: n(SG.maxDb), depthRule: SG.depthRule !== 'off' } };
}
/* ST-Girder's optimum as a design of the whole girder: the bottom flange zones in span 1 changed by ST-Girder's Δt_fb (the largest of the girder hand-offs; span 1 is
   the span ST-Girder designs), the rest as the project has it */
function stDesign(P, rec) {
  const ok = rec.st.filter(s => s.best); if (!ok.length) return null; const dt = Math.max(...ok.map(s => s.best.t - s.base)), L1 = P.spans.lengths[0];
  const segs = J(P.girders[0].segments).flatMap(s => s.x0 < L1 - 1e-6 && s.x1 > L1 + 1e-6 ? [{ ...s, x1: L1 }, { ...s, x0: L1 }] : [s]).map(s => s.x1 <= L1 + 1e-6 ? { ...s, botT: +(Math.max(0.25, s.botT + dt)).toFixed(4) } : s);
  return { segs, dt };
}
const rows = [], t0 = Date.now();
const cases = [...RECS.map(([pr, ow]) => ({ name: `${pr}_${ow}`, pr, ow })), { name: 'builtin_app', app: true }];
for (const cs of cases) {
  if (filt.length && !filt.some(f => cs.name.includes(f))) { const kept = path.join(DIR, `ad_${cs.name}.json`); if (fs.existsSync(kept)) rows.push(JSON.parse(fs.readFileSync(kept, 'utf8'))); continue; }
  const kept = path.join(DIR, `ad_${cs.name}.json`); if (fs.existsSync(kept) && !process.env.FORCE) { rows.push(JSON.parse(fs.readFileSync(kept, 'utf8'))); console.log('have', cs.name); continue; }
  const t1 = Date.now(), ctx = {}, row = { name: cs.name, why: [] };
  if (!cs.app) {
    const Ppl = plProject(cs.pr, cs.ow, PLDEF), P = sbd2FromPL(Ppl, loadsRec(cs.pr, cs.ow), M), rec = JSON.parse(fs.readFileSync(path.join(DIR, `legacy_${cs.name}.json`), 'utf8'));
    row.current = check(P, P.girders[0].segments, P.framing.splices, ctx); const cur = new Set(row.current.failKeys);
    if (rec.full && !rec.full.errors) { row.legacy = { what: 'Preliminary sizing Full design', ...check(P, segsFromLegacy(rec.full), rec.full.splices, ctx, cur), splices: rec.full.splices, legacyCost: rec.full.cost, spacing: rec.full.spacing, spPier: rec.full.spPier, webType: rec.full.webType, passedLegacy: rec.full.passed }; }
    const sd = stDesign(P, rec); if (sd) row.st = { what: `ST-Girder Optimize (Δt_fb = ${sd.dt >= 0 ? '+' : ''}${sd.dt.toFixed(3)} in, span 1)`, ...check(P, sd.segs, P.framing.splices, ctx, cur) };
    const it = AD.run(P, { settings: legacySettings(Ppl) }); let s; while (!(s = it.next()).done) { if (process.env.V) console.log('   ', s.value.msg); }
    const R = s.value, c = R.cands[0] || (R.blocked || [])[0];
    if (!R.cands[0] && c) row.why.push(`no design passes every module: detail checks that the current design fails too, whatever the plates, block every design (${R.blockers.join(', ')}); the weight compared is that of the best blocked design, which passes every check the plates control`);
    row.ad = c ? { pass: !!R.cands[0], blocked: !R.cands[0], blockers: R.blockers, w: c.cost.w, D: c.D, nb: c.nb, ratio: c.ratio, gov: c.gov ? `${c.gov.mod} ${c.gov.id} ${c.gov.title}` : '', minLines: c.minLines, nTr: c.nTr, segments: c.segments } : { pass: false, note: R.note, rejected: R.rejected.map(r => r.fails) };
    row.screened = R.screened;
  } else {
    const P = M.defaultProject(), rec = JSON.parse(fs.readFileSync(path.join(DIR, 'legacy_builtin_AASHTO.json'), 'utf8'));
    row.current = check(P, P.girders[0].segments, P.framing.splices, ctx);
    const sd = stDesign(P, rec); if (sd) row.st = { what: `ST-Girder Optimize (Δt_fb = ${sd.dt >= 0 ? '+' : ''}${sd.dt.toFixed(3)} in, span 1; the builtin_AASHTO hand-offs)`, ...check(P, sd.segs, P.framing.splices, ctx) };
    row.legacy = row.st ? { ...row.st } : null;
    const it = AD.run(P, { settings: { mode: 'refine', objective: 'weight', topN: 3 } }); let s; while (!(s = it.next()).done);
    const c = s.value.cands[0]; row.ad = c ? { pass: true, w: c.cost.w, D: c.D, nb: c.nb, ratio: c.ratio, gov: c.gov ? `${c.gov.mod} ${c.gov.id} ${c.gov.title}` : '', minLines: c.minLines, nTr: c.nTr, segments: c.segments } : { pass: false, note: s.value.note };
  }
  // the legacy weight to beat: the lightest legacy design that passes this app's full check; none passing: the lightest legacy design (reported)
  const L = [row.legacy, row.st].filter(Boolean), Lp = L.filter(q => q.pass || (row.ad.blocked && q.passX));
  const ref = (Lp.length ? Lp : L).sort((a, b) => a.w - b.w)[0];
  row.legacyW = ref ? ref.w : Infinity; row.legacyWhat = ref ? ref.what : '';
  if (row.legacy && !row.legacy.pass && !(row.ad.blocked && row.legacy.passX)) row.why.push(`${row.legacy.what} fails this app's full check: ${row.legacy.fails.join('; ') || row.legacy.prop}`);
  if (row.st && !row.st.pass && !(row.ad.blocked && row.st.passX)) row.why.push(`${row.st.what} fails this app's full check: ${row.st.fails.join('; ') || row.st.prop}`);
  if (row.ad.pass && row.ad.w > row.legacyW + 1e-6) {
    const lg = ref || {};
    if (lg.splices) row.why.push(`heavier by ${((row.ad.w / row.legacyW - 1) * 100).toFixed(1)} %: the legacy design places its own field splices (${(lg.splices || []).join(', ')} ft) and ${lg.spacing && lg.spacing !== 25 ? `cross-frames at ${lg.spacing} ft` : 'its own cross-frame spacing'}${lg.webType ? `, ${lg.webType} web` : ''}; Auto design keeps the project's splices and framing (spec: splice locations from framing.splices)`);
    else row.why.push(`heavier by ${((row.ad.w / row.legacyW - 1) * 100).toFixed(1)} %`);
  }
  row.seconds = Math.round((Date.now() - t1) / 1000);
  fs.writeFileSync(kept, JSON.stringify(row, null, 1)); rows.push(row);
  console.log(`${cs.name.padEnd(18)} ${row.seconds}s  current ${Math.round(row.current.w)} ${row.current.pass ? 'pass' : 'FAIL'} | legacy ${row.legacy ? Math.round(row.legacy.w) + (row.legacy.pass ? ' pass' : ' FAIL') : '-'} | ST ${row.st ? Math.round(row.st.w) + (row.st.pass ? ' pass' : ' FAIL') : '-'} | Auto ${row.ad.pass ? Math.round(row.ad.w) + ' D ' + row.ad.D : 'none'}${row.why.length ? '\n     ' + row.why.join('\n     ') : ''}`);
}
if (!filt.length || rows.length === cases.length) fs.writeFileSync(path.join(DIR, 'parity.json'), JSON.stringify({ written: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000), rows: rows.map(r => ({ name: r.name, legacyW: r.legacyW, legacyWhat: r.legacyWhat,
  legacy: r.legacy && { w: r.legacy.w, pass: r.legacy.pass, passX: r.legacy.passX, D: r.legacy.D, gov: r.legacy.gov, fails: r.legacy.fails }, st: r.st && { w: r.st.w, pass: r.st.pass, passX: r.st.passX, what: r.st.what, fails: r.st.fails }, current: { w: r.current.w, pass: r.current.pass, fails: r.current.fails },
  ad: r.ad && { pass: r.ad.pass, blocked: r.ad.blocked, blockers: r.ad.blockers, w: r.ad.w, D: r.ad.D, nb: r.ad.nb, ratio: r.ad.ratio, gov: r.ad.gov, minLines: r.ad.minLines }, why: r.why })) }, null, 1));
