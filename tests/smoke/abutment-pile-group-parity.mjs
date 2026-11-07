// usage: node tests/smoke/abutment-pile-group-parity.mjs <root A (e.g. a main worktree)> <root B (this tree)>
// abutment main vs branch: LAST_R (JSON) on the default and on 12 random pile layouts (omitted piles, offsets, spacings): must be identical
import path from 'path';
const A = process.argv[2], B = process.argv[3];
const { openPage } = await import(path.join(B, 'tests/lib.mjs'));
async function run(root) {
  const o = await openPage(path.join(root, 'abutment_calculator.html'), { vw: 1400, vh: 1000 });
  await o.p.waitForFunction(() => window.LAST_R, null, { timeout: 60000 });
  const out = await o.p.evaluate(() => {
    const snap = () => JSON.stringify(window.LAST_R, (k, v) => typeof v === 'number' && !isFinite(v) ? String(v) : v);
    const res = [snap()];
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    S.fnd.branch = 'pile'; recalcAll(); res.push(snap());
    for (let t = 0; t < 12; t++) {
      const p = S.piles; p.offX = +(rnd() * 1.2 - 0.6).toFixed(2); p.offY = +(rnd() * 2 - 1).toFixed(2);
      if (p.rowSp) p.rowSp = p.rowSp.map(() => +(3 + rnd() * 3).toFixed(2)); if (p.colSp) p.colSp = p.colSp.map(() => +(4 + rnd() * 4).toFixed(2));
      if (typeof migrate === 'function') migrate(); recalcAll();
      if (p.coords && p.coords.length > 2) { p.coords.forEach(c => c.active = true); p.coords[Math.floor(rnd() * p.coords.length)].active = false; if (t % 3 === 0) p.coords[Math.floor(rnd() * p.coords.length)].active = false; }
      recalcAll(); res.push(snap());
    }
    return { res, pile: window.LAST_R.pile ? window.LAST_R.pile.n : null };
  });
  const errs = o.errs.slice(); await o.b.close(); return { ...out, errs };
}
const [a, b] = await Promise.all([run(A), run(B)]);
let same = 0; a.res.forEach((x, i) => { if (x === b.res[i]) same++; else console.log('DIFF case ' + i + ' (lengths ' + x.length + ' / ' + b.res[i].length + ')'); });
console.log(`${same}/${a.res.length} identical (LAST_R JSON, ${a.res[1].length} chars; piles active at the end: ${a.pile}); errors A ${JSON.stringify(a.errs)} B ${JSON.stringify(b.errs)}`);
process.exit(same === a.res.length && !b.errs.length ? 0 : 1);
