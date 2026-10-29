#!/usr/bin/env node
// Records the INPUTS of GirderDetail's Transverse stiffeners (P.ts), Bearing stiffeners (P.bs) and Girder section (P.gs) modules,
// as Preliminary sizing sends them (with its auto-design), and Preliminary sizing's stiffener layout (framing, bearings and
// cross-frame stations of every girder, the bays and panels of tsGirderBays / tsPanels), for the projects and owners of the 100
// tests/projects/st/gd_*.json hand-off payloads. Same steps as tests/engine/record-loads.mjs (the loads PR's recorder: page seed,
// owner set in Preliminary sizing, builtin28 = every skew 28°, postBridge, gdIdle). A second run per project ('bays') switches
// Preliminary sizing to the per-bay stiffener layout (framing.doMode 'bays') with a layout that differs from the uniform one
// (one more stiffener in every other bay, and an end stiffener at 1.2D in the end bays), so that the per-bay path is recorded too.
// Written to tests/projects/sbd2-stiff/<project>_<owner>[_bays].json:
//   { project, owner, mode, P: { ts, bs, gs, fa, cf, dfBridge }, layout: { framing, sup, cont, D, Ltot, girders: [{ bear, ints, bays, panels }] },
//     gd: GirderDetail's own results in the browser (compact) }.
// tests/engine/stiffeners.test.mjs and shear.test.mjs run GirderDetail's functions in Node on these inputs, check they reproduce
// the browser values here, then compare the new engine. Run only to (re)record:  node tests/engine/record-stiffeners.mjs [project,..] [owner,..] [uniform,bays]
import fs from 'node:fs';
import path from 'node:path';
import { openPage, REPO } from '../lib.mjs';

const OUT = path.join(REPO, 'tests/projects/sbd2-stiff'); fs.mkdirSync(OUT, { recursive: true });
const FILE = path.join(REPO, 'Steel Bridge Design.html');
const projects = (process.argv[2] || 'builtin,builtin28,xsA,curb,util').split(','), owners = (process.argv[3] || 'AASHTO,RIDOT,MassDOT,CTDOT').split(',');
const modes = (process.argv[4] || 'uniform,bays').split(',');

async function idle(p, quiet = 8000) { return p.evaluate(o => window.gdIdle(o), { quiet }); }
const plFrame = async p => { for (const fr of p.frames()) { if (fr === p.mainFrame()) continue; try { if (await fr.evaluate(() => typeof postBridge === 'function' && typeof AN !== 'undefined')) return fr; } catch (e) { } } return null; };

for (const pr of projects) for (const ow of owners) for (const mode of modes) {
  const t0 = Date.now(), seed = pr === 'builtin' || pr === 'builtin28' ? undefined : JSON.parse(fs.readFileSync(path.join(REPO, 'tests/projects/gd', pr + '.json'), 'utf8'));
  const o = await openPage(FILE, { ls: seed }), p = o.p;
  try {
    await p.waitForFunction(() => typeof P !== 'undefined' && P && typeof plEnsure === 'function', null, { timeout: 60000 });
    await p.evaluate(() => plEnsure()); await idle(p);
    const sk = pr === 'builtin28' ? 28 : null;
    const fr = await plFrame(p);
    await fr.evaluate(([o, sk, mode]) => {
      P.limits.dot = o; if (sk != null) P.bridge.skews = P.bridge.skews.map(() => sk); try { fillInputs(); } catch (e) {} recompute();
      if (mode === 'bays') {   // a per-bay layout that differs from the uniform one
        const m = buildModel(P), FRx = framingLayout(P, m), list = [];
        FRx.girders.forEach((g, i) => tsGirderBays(P, m, FRx, i).forEach((B, j) => { const q = { g: i + 1, a: B.a, b: B.b, n: B.n + (j % 2) };
          if (B.endA && q.n > 0) q.e0 = Math.round(1.2 * m.D); if (B.endB && q.n > (q.e0 ? 1 : 0)) q.e1 = Math.round(1.2 * m.D); list.push(q); }));
        P.framing.stiff = 'on'; P.framing.doMode = 'bays'; P.framing.bays = { v: 1, D: m.D, tw: Math.max(...m.web.map(w => w.t)), tfa: 'on', list };
        try { fillInputs(); } catch (e) {} recompute();
      }
      autosave(); postBridge(true); }, [ow, sk, mode]);
    await p.waitForTimeout(1500); await idle(p);
    const layout = await fr.evaluate(() => {
      const m = buildModel(P), FRx = framingLayout(P, m);
      return { framing: JSON.parse(JSON.stringify(P.framing)), sup: m.sup.slice(), cont: m.cont, D: m.D, Ltot: m.Ltot,
        girders: FRx.girders.map((g, i) => { const bays = tsGirderBays(P, m, FRx, i);
          return { bear: g.bear.slice(), ints: g.pts.filter(q => q.f.type === 'int').map(q => q.s), bays, panels: bays.flatMap(tsPanels) }; }) };
    });
    const rec = await p.evaluate(() => {
      const C = o => JSON.parse(JSON.stringify(o)), items = CK => CK.map(c => [c.id, c.items.map(it => [it.loc, it.r ?? null, it.st]), c.naWhy || '']);
      const out = { P: { ts: C(P.ts), bs: C(P.bs), gs: C(P.gs), fa: C(P.fa), cf: C(P.cf || {}), dfBridge: C(P.df.bridge || {}) }, gd: {} };
      const T = GM.ts.compute(P.ts);
      out.gd.ts = T.errors.length ? { errors: T.errors } : { rows: T.rows.map(r => ({ Vu: r.Vu, VuB: r.VuB, VuC: r.VuC, Vu1: r.Vu1, Vu2: r.Vu2, rhow: r.rhow, It: r.It, It1: r.It1, It2: r.It2, J: r.J, Fcrs: r.Fcrs, rhot: r.rhot, Ireq: r.Ireq, IreqEq: r.IreqEq, ntf: r.ntf, fat: r.fat, Rcp: r.Rcp,
        p: [r.p1, r.p2].map(q => [q.k, q.C, q.Vp, q.Vn, q.Vcr, q.stiff, q.eqn, q.rho, q.Vu, q.end]) })), checks: items(GM.ts.checks(T)) };
      const B = bsCompute(P);
      out.gd.bs = B.errors.length ? { errors: B.errors } : { rows: B.rows.map(r => ({ Ru: r.Ru, bLim: r.bLim, bAvail: r.bAvail, bEff: r.bEff, Apn: r.Apn, Rsb: r.Rsb, red: r.red, sEnd: r.sEnd, Ltot: r.Ltot, A: r.A, I: r.I, rg: r.rg, sl: r.sl, Po: r.Po, Pe: r.Pe, Pn: r.Pn, Pr: r.Pr, Rweld: r.Rweld, wMin: r.wMin })), checks: items(bsChecks(B)) };
      const G = GM.gs.compute(P.gs);
      out.gd.gs = G.errors.length ? { errors: G.errors } : { rows: G.rows.map(r => ({ Vu: r.Vu, VuP: r.VuP, VuF: r.VuF, VuC: r.VuC, sh: [r.sh.k, r.sh.C, r.sh.Vp, r.sh.Vn, r.sh.Vcr, r.sh.stiff, r.sh.eqn] })),
        checks: items(GM.gs.checks(G).filter(c => ['GS11', 'GS16', 'GS18'].includes(c.id))) };
      return out;
    });
    const name = `${pr}_${ow}${mode === 'bays' ? '_bays' : ''}.json`;
    fs.writeFileSync(path.join(OUT, name), JSON.stringify({ project: pr, owner: ow, mode, ...rec, layout }));
    console.log(`${name}: ${((Date.now() - t0) / 1000).toFixed(0)} s, errors ${o.errs.length}, ts ${rec.P.ts.rows.length} rows (${rec.gd.ts.errors ? 'ERR ' + rec.gd.ts.errors[0] : 'ok'}), bs ${rec.P.bs.rows.length} (${rec.gd.bs.errors ? 'ERR ' + rec.gd.bs.errors[0] : 'ok'}), gs ${rec.P.gs.rows.length} (${rec.gd.gs.errors ? 'ERR ' + rec.gd.gs.errors[0] : 'ok'}), framing ${layout.framing.doMode}`);
  } finally { await o.b.close(); }
}
