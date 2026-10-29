#!/usr/bin/env node
// Records the INPUTS of GirderDetail's Fatigue (P.fa) and Shear connectors (P.sc) modules, as Preliminary sizing sends them, with the
// bridge they read (P.df.bridge: owner, spans, load factors) and P.cf, for the projects and owners of the 100 tests/projects/st/gd_*.json
// hand-off payloads. Same steps as tests/engine/record-stiffeners.mjs (page seed, owner set in Preliminary sizing, builtin28 = every
// skew 28°, postBridge, gdIdle), uniform stiffener layout only.
// Written to tests/projects/sbd2-fat/<project>_<owner>.json:
//   { project, owner, P: { fa, sc, cf, dfBridge }, gd: GirderDetail's own results in the browser (compact) }.
// tests/engine/fatigue.test.mjs and studs.test.mjs run GirderDetail's functions in Node on these inputs, check they reproduce the
// browser values here, then compare the new engine. Run only to (re)record:  node tests/engine/record-fatigue.mjs [project,..] [owner,..]
import fs from 'node:fs';
import path from 'node:path';
import { openPage, REPO } from '../lib.mjs';

const OUT = path.join(REPO, 'tests/projects/sbd2-fat'); fs.mkdirSync(OUT, { recursive: true });
const FILE = path.join(REPO, 'Steel Bridge Design.html');
const projects = (process.argv[2] || 'builtin,builtin28,xsA,curb,util').split(','), owners = (process.argv[3] || 'AASHTO,RIDOT,MassDOT,CTDOT').split(',');

async function idle(p, quiet = 8000) { return p.evaluate(o => window.gdIdle(o), { quiet }); }
const plFrame = async p => { for (const fr of p.frames()) { if (fr === p.mainFrame()) continue; try { if (await fr.evaluate(() => typeof postBridge === 'function' && typeof AN !== 'undefined')) return fr; } catch (e) { } } return null; };

for (const pr of projects) for (const ow of owners) {
  const t0 = Date.now(), seed = pr === 'builtin' || pr === 'builtin28' ? undefined : JSON.parse(fs.readFileSync(path.join(REPO, 'tests/projects/gd', pr + '.json'), 'utf8'));
  const o = await openPage(FILE, { ls: seed }), p = o.p;
  try {
    await p.waitForFunction(() => typeof P !== 'undefined' && P && typeof plEnsure === 'function', null, { timeout: 60000 });
    await p.evaluate(() => plEnsure()); await idle(p);
    const sk = pr === 'builtin28' ? 28 : null;
    const fr = await plFrame(p);
    await fr.evaluate(([o, sk]) => { P.limits.dot = o; if (sk != null) P.bridge.skews = P.bridge.skews.map(() => sk); try { fillInputs(); } catch (e) {} recompute(); autosave(); postBridge(true); }, [ow, sk]);
    await p.waitForTimeout(1500); await idle(p);
    const rec = await p.evaluate(() => {
      const C = o => JSON.parse(JSON.stringify(o)), items = CK => CK.map(c => [c.id, c.items.map(it => [it.loc, it.r ?? null, it.st]), c.naWhy || '']);
      const out = { P: { fa: C(P.fa), sc: C(P.sc), cf: C(P.cf || {}), dfBridge: C(P.df.bridge || {}) }, gd: {} };
      const F = GM.fa.compute(P.fa);
      out.gd.fa = F.errors.length ? { errors: F.errors } : { rows: F.rows.map(r => ({ cat: r.cat, lim: r.lim, gam: r.gam, res: r.res, df: r.df, dem: r.dem, fDL: r.fDL, fLLt: r.fLLt, exempt: r.exempt, Vu: r.Vu ?? null, Vcr: r.sh ? r.sh.Vcr : null })), checks: items(GM.fa.checks(F)) };
      const S = GM.sc.compute(P.sc);
      out.gd.sc = S.errors.length ? { errors: S.errors } : { Qr: S.Qr, Zr: S.Zr, zones: S.zones.map(z => ({ I: z.I, Q: z.Q, lim: z.fat.lim, Zr: z.Zr, Vsr: z.Vsr, preq: z.preq, edge: z.edge })),
        regions: S.regions.map(r => ({ P: r.P, nreq: r.nreq, nprov: r.nprov, lost: r.lost, nnet: r.nnet })), checks: items(GM.sc.checks(S)) };
      return out;
    });
    const name = `${pr}_${ow}.json`;
    fs.writeFileSync(path.join(OUT, name), JSON.stringify({ project: pr, owner: ow, ...rec }));
    console.log(`${name}: ${((Date.now() - t0) / 1000).toFixed(0)} s, errors ${o.errs.length}, fa ${rec.P.fa.rows.length} rows (${rec.gd.fa.errors ? 'ERR ' + rec.gd.fa.errors[0] : 'ok'}), sc ${rec.P.sc.zones.length} zones ${rec.P.sc.regions.length} regions (${rec.gd.sc.errors ? 'ERR ' + rec.gd.sc.errors[0] : 'ok'})`);
  } finally { await o.b.close(); }
}
