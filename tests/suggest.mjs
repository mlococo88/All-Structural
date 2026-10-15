#!/usr/bin/env node
// GirderDetail Suggest panel (SGP, 2026-10-15): checks of Preliminary sizing's Suggest engines driven from the panel. See tests/README.md.
//   node tests/suggest.mjs same  [--project builtin,xsA] [--owner AASHTO,RIDOT] [--full yes|no]
//       default settings give the same quick suggestion and Full design as --a (default origin/main, driven by its Suggest tab / engine)
//       as --b (default the working tree, driven by the panel's Quick suggestion and Full design buttons)
//   node tests/suggest.mjs locks [--b file]
//       Locked / Range / List honoured by the engines, Apply writes the inputs and GirderDetail's modules follow, Cancel, saved data both ways
// Exit code: 0 all pass, 1 a failure, 2 an error.
import fs from 'fs';
import path from 'path';
import { HERE, openPage, resolveFile, diff } from './lib.mjs';

const args = {}; const av = process.argv.slice(2); const CMD = av[0] && !av[0].startsWith('--') ? av.shift() : 'same';
for (let i = 0; i < av.length; i++) { if (!av[i].startsWith('--')) continue; const k = av[i].slice(2); args[k] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true; }
const FILE = 'Steel Bridge Beam Modules.html', A = resolveFile(args.a || 'origin/main', FILE), B = resolveFile(args.b || FILE, FILE);
const list = (v, d) => String(v || d).split(',').map(s => s.trim()).filter(Boolean);
const FULL = (args.full || 'yes') !== 'no';
const seed = pr => pr === 'builtin' ? undefined : JSON.parse(fs.readFileSync(fs.existsSync(pr) ? pr : path.join(HERE, 'projects', 'gd', pr + '.json'), 'utf8'));
const plf = p => p.frames().find(fr => fr !== p.mainFrame());

async function boot(file, project, owner) {
  const o = await openPage(file, { ls: seed(project), vw: 1600, vh: 1000 }), p = o.p;
  await p.waitForFunction(() => typeof P !== 'undefined' && P && typeof plEnsure === 'function', null, { timeout: 60000 });
  await p.evaluate(() => plEnsure()); await p.evaluate(() => window.gdIdle({ max: 200000 }));
  if (owner) { await plf(p).evaluate(o => { P.limits.dot = o; try { fillInputs(); } catch (e) {} recompute(); autosave(); postBridge(true); }, owner); await p.waitForTimeout(1500); await p.evaluate(() => window.gdIdle({ max: 200000 })); }
  return o;
}
// a Suggest result, for comparison (no time stamps)
const SUM = () => { const s = SG; if (!s || s.errors.length) return { errors: s && s.errors };
  const pl = l => l.map(g => [+(+g.L).toFixed(6), g.b, g.t]); const C = s.cost || {};
  return { D: s.D, webType: s.webType, doR: s.doR, tw: s.tw, top: pl(s.top), bot: pl(s.bot), web: s.web.map(w => [+(+w.L).toFixed(6), w.t]), splices: s.splices, spacing: s.spacing, spPier: s.spPier, bays: s.bays || null,
    cost: C.total, wTot: C.wTot, nFr: C.nFr, cands: (s.rec.cands || []).map(c => [c.D, c.wt, c.doR, c.twC || 0, +c.cost.total.toFixed(3), c.ok]),
    quick: s.full ? null : s.quick && { state: s.quick.state, pass: s.quick.pass, iters: s.quick.iters, max: s.quick.check && s.quick.check.max, web: s.quick.check && s.quick.check.rWeb },
    full: s.full ? { passed: s.full.passed, max: s.full.check.max, web: s.full.check.rWeb, cands: s.full.cands.map(c => [c.D, c.wt, c.spacing, c.spPier ?? null, c.pass, +c.cost.total.toFixed(3), c.iters]) } : null }; };

async function runSide(src, project, owner, panel) {
  const { b, p, errs, dialogs } = await boot(src.file, project, owner), f = plf(p), out = {};
  try {
    if (await p.evaluate(() => P.gdMode) !== 'pl') { await p.click('[data-gdmode="pl"]'); await p.waitForTimeout(800); await p.evaluate(() => window.gdIdle({ max: 200000 })); out.mode = 'switched to Preliminary designer'; }   // both sides the same way (the button exists in that mode only)
    if (panel) { await p.click('#gd-sgp-b'); await f.waitForFunction(() => SGP_OPEN, null, { timeout: 60000 }); await f.click('#sgp-quick'); }
    else await f.evaluate(() => { SG = null; SG_KEY = ''; setOTab('suggest'); maybeSuggest(true); });
    await f.waitForFunction(() => SG && (SG.errors.length || (SG.quick && SG.quick.state !== 'checking')), null, { timeout: 180000 });
    out.quick = await f.evaluate(SUM);
    if (FULL) {
      if (panel) await f.click('#sgp-full'); else await f.evaluate(() => runFullDesign());
      const t0 = Date.now(); let st = null;
      while (Date.now() - t0 < 900000) { st = await f.evaluate(() => ({ run: !!SG_RUN, m: SG_RUN ? SG_RUN.m || '' : '', full: !!(SG && SG.full), err: SG && SG.errors && SG.errors.length })); if (!st.run && (st.full || st.err)) break; if (!st.run && Date.now() - t0 > 20000) break; await p.waitForTimeout(2000); }
      if (!st.full && !st.err) throw new Error(`${panel ? 'B' : 'A'}: Full design did not finish: ${JSON.stringify(st)}; dialogs ${JSON.stringify(dialogs)}`);
      out.full = await f.evaluate(SUM);
    }
  } finally { await b.close(); }
  return { out, errs, dialogs };
}

async function same() {
  let bad = 0;
  for (const pr of list(args.project, 'builtin,xsA')) for (const ow of list(args.owner, 'AASHTO,RIDOT')) {
    const t0 = Date.now(), [ra, rb] = await Promise.all([runSide(A, pr, ow, false), runSide(B, pr, ow, true)]);
    const d = []; diff(ra.out, rb.out, '', d);
    console.log(`\n== ${pr} / ${ow}  (${Math.round((Date.now() - t0) / 1000)} s)`);
    console.log(`A ${A.label} (Suggest tab / engine) vs B ${B.label} (Suggest panel buttons)`);
    for (const k of ['quick', 'full'].filter(k => rb.out[k])) console.log(`  ${k.padEnd(6)} D ${rb.out[k].D} ${rb.out[k].webType}, cost ${rb.out[k].cost && rb.out[k].cost.toFixed(2)}, ${k === 'full' ? `passed ${rb.out[k].full && rb.out[k].full.passed}, ${rb.out[k].full && rb.out[k].full.cands.length} candidates` : `quick ${JSON.stringify(rb.out[k].quick)}`}`);
    console.log(d.length ? `  DIFFERENT (${d.length}): ${JSON.stringify(d.slice(0, 10))}` : '  identical');
    const er = [...ra.errs.map(e => 'A: ' + e), ...rb.errs.map(e => 'B: ' + e)]; if (er.length) console.log('  console errors: ' + er.join(' | '));
    if (d.length || er.length) bad++;
  }
  return bad;
}

async function locks() {
  const res = []; const ok = (name, c, info) => { res.push([name, !!c]); console.log(`${c ? 'PASS' : 'FAIL'}  ${name}${info ? ' — ' + info : ''}`); };
  const { b, p, errs } = await boot(B.file, 'builtin', null), f = plf(p);
  try {
    await p.click('#gd-sgp-b'); await f.waitForFunction(() => SGP_OPEN, null, { timeout: 60000 });
    ok('panel opens full screen in Preliminary designer mode', await p.evaluate(() => document.body.classList.contains('gd-sgp') && getComputedStyle(document.getElementById('pl-wrap')).top === '0px'));
    ok('defaults derived from the saved settings (girders Locked, web depth Free, no new field written)', await f.evaluate(() => { const v = Object.fromEntries(sgpVars().map(x => [x.id, x.m])); return v.nb === 'lock' && v.D === 'free' && v.cf === 'free' && !('nbMode' in P.suggest) && !('dMode' in P.suggest); }));
    // web depth Range: click the mode, set the range
    await f.click('[data-sgpv="D"][data-sgpm="range"]');
    await f.evaluate(() => { P.suggest.dMin = 54; P.suggest.dMax = 66; P.suggest.dStep = 6; fillInputs(); });
    await f.click('#sgp-quick'); await f.waitForFunction(() => !sgpBusy() && SG && SG.quick && SG.quick.state !== 'checking' && SG_KEY === sgKey(), null, { timeout: 180000 });
    let r = await f.evaluate(() => ({ D: SG.D, c: SG.rec.cands.map(c => c.D) }));
    ok('web depth Range 54–66 in (step 6) honoured', r.c.every(d => d >= 54 && d <= 66) && r.D >= 54 && r.D <= 66, `depths tried ${[...new Set(r.c)].join(', ')}; chosen ${r.D}`);
    await f.click('[data-sgpv="D"][data-sgpm="list"]'); await f.evaluate(() => { P.suggest.dList = '50, 70'; fillInputs(); });
    await f.click('#sgp-quick'); await f.waitForFunction(() => !sgpBusy() && SG && SG.quick && SG.quick.state !== 'checking' && SG_KEY === sgKey(), null, { timeout: 180000 });
    r = await f.evaluate(() => ({ D: SG.D, c: SG.rec.cands.map(c => c.D) }));
    ok('web depth List 50, 70 honoured', r.c.every(d => d === 50 || d === 70), `depths tried ${[...new Set(r.c)].join(', ')}; chosen ${r.D}`);
    await f.click('[data-sgpv="D"][data-sgpm="lock"]');
    await f.click('#sgp-quick'); await f.waitForFunction(() => !sgpBusy() && SG && SG.quick && SG.quick.state !== 'checking' && SG_KEY === sgKey(), null, { timeout: 180000 });
    r = await f.evaluate(() => ({ D: SG.D, g: +P.girder.D, c: SG.rec.cands.map(c => c.D) }));
    ok('web depth Locked keeps the Girder tab depth', r.c.every(d => d === r.g) && r.D === r.g, `D = ${r.D}`);
    await f.click('[data-sgpv="D"][data-sgpm="free"]');
    // spacing near interior supports Locked: no pier-region alternatives in the quick check
    await f.click('[data-sgpv="pier"][data-sgpm="lock"]');
    ok('spacing near piers Locked writes suggest.pierOpt = off', await f.evaluate(() => P.suggest.pierOpt === 'off'));
    await f.click('[data-sgpv="pier"][data-sgpm="free"]');
    // girder count List at the out-to-out width: the study sizes only those counts
    await f.click('[data-sgpv="nb"][data-sgpm="list"]'); await f.evaluate(() => { P.suggest.nbList = '4, 6'; fillInputs(); });
    ok('girder count not Locked: the width is held (ws.W = current out-to-out width)', await f.evaluate(() => Math.abs(+P.ws.W - 44.5) < 1e-6), await f.evaluate(() => 'W = ' + P.ws.W));
    await f.click('#sgp-quick'); await f.waitForFunction(() => WS && WS.done && WS.key === wsKey(), null, { timeout: 180000 });
    r = await f.evaluate(() => WS.res.map(x => x.N));
    ok('girder count List 4, 6 honoured by the study', r.length && r.every(n => n === 4 || n === 6), `counts sized ${r.join(', ')}`);
    await f.click('[data-sgpv="nb"][data-sgpm="range"]'); await f.evaluate(() => { P.suggest.nbMin = 5; P.suggest.nbMax = 6; fillInputs(); });
    await f.click('#sgp-quick'); await f.waitForFunction(() => WS && WS.done && WS.key === wsKey(), null, { timeout: 180000 });
    r = await f.evaluate(() => WS.res.map(x => x.N));
    ok('girder count Range 5–6 honoured by the study', r.length && r.every(n => n >= 5 && n <= 6), `counts sized ${r.join(', ')}`);
    await f.click('[data-sgpv="oh"][data-sgpm="lock"]');
    await f.click('#sgp-quick'); await f.waitForFunction(() => WS && WS.done && WS.key === wsKey(), null, { timeout: 180000 });
    r = await f.evaluate(() => WS.res.filter(x => !x.err).map(x => x.oh));
    ok('overhangs Locked with the girder count varying: every row at 3.25 ft', r.length && r.every(o => Math.abs(o - 3.25) < 1e-9), `overhangs ${[...new Set(r)].join(', ')}`);
    ok('options listed with Apply', await f.evaluate(() => document.querySelectorAll('#sgp-res [data-sgpapply^="ws:"]').length > 0));
    await f.click('[data-sgpv="nb"][data-sgpm="lock"]');
    // cancel: Full design, cancelled after 3 s
    await f.click('#sgp-full'); await p.waitForTimeout(3000);
    const was = await f.evaluate(() => !!SG_RUN); await f.click('#sgp-cancel');
    await f.waitForFunction(() => !SG_RUN, null, { timeout: 60000 }); await p.waitForTimeout(900);
    ok('Full design starts, shows progress and Cancel stops it', was && await f.evaluate(() => !(SG && SG.full) && document.getElementById('sgp-prog').hidden));
    // responsiveness while a run is going: the engine yields between its steps (one step can take a few seconds); median answer time of the main page
    await f.click('#sgp-full'); await p.waitForTimeout(1000); const lags = [], m0 = await f.evaluate(() => SG_RUN && SG_RUN.m);
    for (let i = 0; i < 12; i++) { const t0 = Date.now(); await p.evaluate(() => 1); lags.push(Date.now() - t0); await p.waitForTimeout(400); }
    const med = lags.slice().sort((a, b) => a - b)[6], m1 = await f.evaluate(() => SG_RUN && SG_RUN.m);
    ok('page stays usable during Full design (progress advances, median response < 1 s)', med < 1000 && m1 !== m0, `response times ${lags.join(', ')} ms; progress "${m0}" -> "${m1}"`);
    await f.click('#sgp-cancel'); await f.waitForFunction(() => !SG_RUN, null, { timeout: 60000 });
    // Apply the quick suggestion: inputs written, GirderDetail modules follow
    await f.click('#sgp-quick'); await f.waitForFunction(() => !sgpBusy() && SG && SG.quick && SG.quick.state === 'done' && SG_KEY === sgKey(), null, { timeout: 180000 });
    await p.waitForTimeout(600);
    const sg = await f.evaluate(() => JSON.stringify(sgGirder()));
    await f.click('[data-sgpapply="sg"]'); await p.waitForTimeout(500);
    ok('Apply writes the suggestion into the Preliminary sizing inputs', await f.evaluate(s => JSON.stringify(P.girder) === s, sg));
    await f.click('#sgp-close'); await p.waitForTimeout(500);
    ok('Close returns to GirderDetail', await p.evaluate(() => !document.body.classList.contains('gd-sgp')));
    await p.evaluate(() => window.gdIdle({ max: 200000 }));
    r = await p.evaluate(() => ({ sync: document.getElementById('gd-sync').textContent, sig: P.plSync && P.plSync.sig, D: P.gs && P.gs.rows && P.gs.rows[0] && P.gs.rows[0].D }));
    const dsig = await f.evaluate(() => plDsig());
    ok('GirderDetail modules synced after Apply (Preliminary designer)', r.sig === dsig && /in sync/.test(r.sync), r.sync);
    // saved data: a project with the new optional fields opens in main, and the branch reads it back
    await f.evaluate(() => { P.suggest.dMode = 'range'; P.suggest.dMin = 48; P.suggest.dMax = 72; P.suggest.nbMode = 'list'; P.suggest.nbList = '5, 6'; P.suggest.cfMin = 20; autosave(); });
    await p.waitForTimeout(800);
    const ls = await p.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));
    await b.close();
    for (const [lbl, src] of [['main', A], ['branch', B]]) {
      const o = await openPage(src.file, { ls, vw: 1400, vh: 900 }); const q = o.p;
      await q.waitForFunction(() => typeof P !== 'undefined' && P && typeof plEnsure === 'function', null, { timeout: 60000 });
      await q.evaluate(() => plEnsure()); await q.evaluate(() => window.gdIdle({ max: 200000 }));
      const s = await plf(q).evaluate(() => ({ dMode: P.suggest.dMode, nbList: P.suggest.nbList, cfMin: P.suggest.cfMin, m: typeof sgpVars === 'function' ? Object.fromEntries(sgpVars().map(x => [x.id, x.m])) : null }));
      ok(`project with the new fields opens in ${lbl} (fields kept, no console error)`, s.dMode === 'range' && s.nbList === '5, 6' && +s.cfMin === 20 && !o.errs.length && (!s.m || (s.m.D === 'range' && s.m.nb === 'list' && s.m.cf === 'range')), JSON.stringify(s.m || {}) + (o.errs.length ? ' errors: ' + o.errs.join(' | ') : ''));
      await o.b.close();
    }
    // an older project (xsA, saved 2026-10-13) opens in the branch with its settings mapped
    { const o = await boot(B.file, 'xsA', null), q = o.p; const md = await q.evaluate(() => P.gdMode);
      ok('older project (xsA): Suggest button only in Preliminary designer mode', md === 'pl' || await q.evaluate(() => getComputedStyle(document.getElementById('gd-sgp-b')).display) === 'none', `opened in ${md}`);
      if (md !== 'pl') { await q.click('[data-gdmode="pl"]'); await q.waitForTimeout(800); await q.evaluate(() => window.gdIdle({ max: 200000 })); }
      await q.click('#gd-sgp-b'); await plf(q).waitForFunction(() => SGP_OPEN, null, { timeout: 60000 });
      const m = await plf(q).evaluate(() => ({ m: Object.fromEntries(sgpVars().map(x => [x.id, x.m])), keepD: P.suggest.keepD, web: P.suggest.web, cfOpt: P.suggest.cfOpt }));
      ok('older project (xsA): panel modes mapped from its Suggest settings, no console error', m.m.nb === 'lock' && m.m.D === (m.keepD ? 'lock' : 'free') && m.m.web === (m.web === 'auto' ? 'free' : 'lock') && m.m.cf === (m.cfOpt === 'off' ? 'lock' : m.m.cf) && !o.errs.length, JSON.stringify(m) + (o.errs.length ? ' errors: ' + o.errs.join(' | ') : ''));
      await q.evaluate(() => setGdMode('mod')); await q.waitForTimeout(1500);   // the panel covers the top bar: switched from code (e.g. a project opened in Design modules)
      ok('Design modules mode: the Suggest button is hidden and the panel closed', await q.evaluate(() => getComputedStyle(document.getElementById('gd-sgp-b')).display === 'none' && !document.body.classList.contains('gd-sgp')) && await plf(q).evaluate(() => !SGP_OPEN));
      await o.b.close(); }
  } catch (e) { console.error(e); try { await b.close(); } catch (e2) {} return 2; }
  if (errs.length) { console.log('console errors: ' + errs.join(' | ')); return 1; }
  return res.some(r => !r[1]) ? 1 : 0;
}

const code = CMD === 'locks' ? await locks() : (await same()) ? 1 : 0;
process.exit(code);
