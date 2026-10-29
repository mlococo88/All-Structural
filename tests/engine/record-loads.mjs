#!/usr/bin/env node
// Records the INPUTS of GirderDetail's LLDF and DLs module (P.df, with the bridge Preliminary sizing sends it) for the projects
// and owners of the 100 tests/projects/st/gd_*.json hand-off payloads, from "Steel Bridge Design.html" run headless exactly as
// tests/compare.mjs opens it (gdOpen: project seed, owner set in Preliminary sizing, builtin28 = every skew 28°). Written to
// tests/projects/sbd2-loads/<project>_<owner>.json: { project, owner, df (P.df, ts zeroed), gd (GirderDetail's own compute in the
// browser, compact: per region the members' g values; the dead loads per girder) }.
// tests/engine/loads.test.mjs runs GirderDetail's GM.df.compute in Node on these inputs and checks it reproduces both the browser
// values here and the payloads; then the new engine against it. Run only to (re)record:  node tests/engine/record-loads.mjs [project,..] [owner,..]
import fs from 'node:fs';
import path from 'node:path';
import { openPage, REPO } from '../lib.mjs';

const OUT = path.join(REPO, 'tests/projects/sbd2-loads'); fs.mkdirSync(OUT, { recursive: true });
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
    await (await plFrame(p)).evaluate(([o, sk]) => { P.limits.dot = o; if (sk != null) P.bridge.skews = P.bridge.skews.map(() => sk); try { fillInputs(); } catch (e) {} recompute(); autosave(); postBridge(true); }, [ow, sk]);
    await p.waitForTimeout(1500); await idle(p);
    const rec = await p.evaluate(() => {
      const df = JSON.parse(JSON.stringify(P.df).replace(/"ts":\d+/g, '"ts":0')), R = GM.df.compute(P.df);
      const A = a => a ? Array.from(a) : null;
      const gd = R.errors.length ? { errors: R.errors } : { regions: R.regions.map(rg => ({ id: rg.id, Kg: rg.Kg, members: rg.members.map(m => [m.gM, m.gV, m.fatM, m.fatV, m.method]) })),
        dead: { dc1: A(R.dead.dc1), dc2: A(R.dead.dc2), dw: A(R.dead.dw), pl: A(R.dead.pl), ut: A(R.dead.ut), uf: A(R.dead.uf), cls: R.dead.cls, method: R.dead.method, per: R.dead.per.map(L => [L.id, L.cat, L.dist, L.x, L.plf, A(L.r)]) } };
      return { df, gd, sa: { im: P.sa && P.sa.im, imf: P.sa && P.sa.imf } };
    });
    fs.writeFileSync(path.join(OUT, `${pr}_${ow}.json`), JSON.stringify({ project: pr, owner: ow, ...rec }));
    console.log(`${pr} / ${ow}: ${((Date.now() - t0) / 1000).toFixed(0)} s, errors ${o.errs.length}${rec.gd.errors ? ' GD: ' + rec.gd.errors[0] : ''}`);
  } finally { await o.b.close(); }
}
