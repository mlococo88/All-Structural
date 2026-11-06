#!/usr/bin/env node
// Steel Bridge Design.html: Preliminary sizing's Export JSON / Import JSON are the page's (GDIO, 2026-11-06). Checks:
//   its Export JSON downloads the whole project file, the same text as the modules' Export JSON (SBD4: app SteelBridgeDesign with
//   data, pl and st); its Import JSON opens the page's file chooser and takes the parts the file has: a whole-project file (both
//   parts), an old Preliminary sizing part file ({ app: 'PlateLine', data }) into that part only, a part file without app (as
//   Preliminary sizing's own Import JSON took it), a project file with Preliminary sizing's part only (the confirm names only that
//   part; the modules unchanged); no console errors.
//   node tests/smoke/sbd-pl-io.mjs
import fs from 'fs';
import os from 'os';
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; return c; };
const Z = t => String(t).replace(/"(ts|producedAt|seenAt|savedAt|at)":\s*\d+/g, '"$1":0');
const FILE = path.join(REPO, 'Steel Bridge Design.html'), TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sbd-pl-io-'));
console.log('sbd-pl-io: ' + FILE);
const o = await openPage(FILE, { vw: 1400, vh: 900, timeout: 120000 }), p = o.p;
await p.waitForFunction(() => typeof window.gdIdle === 'function' && typeof plEnsure === 'function', null, { timeout: 120000 });
await p.evaluate(() => { plEnsure(); return window.gdIdle({ quiet: 4000 }); });
await p.evaluate(() => { window.__dl = []; const c = URL.createObjectURL; URL.createObjectURL = b => { if (b instanceof Blob) b.text().then(t => window.__dl.push(t)); return c.call(URL, b); }; });
const plFrame = async () => { for (const f of p.frames()) { if (f === p.mainFrame()) continue; try { if (await f.evaluate(() => typeof postBridge === 'function' && typeof AN !== 'undefined')) return f; } catch (e) { } } return null; };
let F = await plFrame();
const dl = async click => { const n = await p.evaluate(() => window.__dl.length); await click(); await p.waitForFunction(n => window.__dl.length > n, n, { timeout: 20000 }); return p.evaluate(() => window.__dl.at(-1)); };
ok(await F.evaluate(() => /whole project/.test(document.getElementById('pl-save-note').textContent)), 'Preliminary sizing pane: the note says Export / Import JSON are the whole project\'s');
const eP = await dl(() => F.evaluate(() => document.getElementById('pb_export').click()));
const eM = await dl(() => p.evaluate(() => document.getElementById('pb_export').click()));
const j = JSON.parse(eP);
ok(j.app === 'SteelBridgeDesign' && j.data && j.pl && j.pl.app === 'PlateLine' && j.pl.data && j.pl.data.girder && 'st' in j, 'its Export JSON: the whole project file (data, pl, st; st null until Design & Rating has a session)');
ok(Z(eP) === Z(eM), `the same text as the modules' Export JSON (${eP.length} chars)`);
const gdMeta = () => p.evaluate(() => JSON.stringify([P.meta, P.sec]));
const plName = () => F.evaluate(() => P.meta.name);
async function imp(name, obj) { const f = path.join(TMP, name); fs.writeFileSync(f, JSON.stringify(obj, null, 2)); const d0 = o.dialogs.length;
  const [fc] = await Promise.all([p.waitForEvent('filechooser', { timeout: 20000 }), F.evaluate(() => document.getElementById('pb_import').click())]);
  await fc.setFiles(f); await p.waitForTimeout(2500); F = await plFrame(); await p.evaluate(() => window.gdIdle({ quiet: 3000 })); return o.dialogs.slice(d0); }
// a whole-project file: both parts
const w = JSON.parse(eP); w.pl.data.meta.name = 'PLIO whole'; w.data.meta.subject = 'PLIO whole modules'; w.name = 'PLIO';
let d = await imp('whole.json', w);
ok(await plName() === 'PLIO whole' && await p.evaluate(() => P.meta.subject) === 'PLIO whole modules', 'Import JSON (its button): a whole-project file opens both parts');
ok(d.some(x => /the modules, Preliminary sizing/.test(x)), 'the confirm names the parts the file has');
// an old Preliminary sizing part file: that part only
let g0 = await gdMeta(); const pf = { app: 'PlateLine', v: 1, name: 'old', data: JSON.parse(JSON.stringify(j.pl.data)) }; pf.data.meta.name = 'PLIO part';
d = await imp('part.json', pf);
ok(await plName() === 'PLIO part' && await gdMeta() === g0, 'an old Preliminary sizing file ({ app: PlateLine }): into that part only, the modules unchanged');
// a part file without app (as Preliminary sizing's own Import JSON took it)
g0 = await gdMeta(); const na = { name: 'noapp', data: JSON.parse(JSON.stringify(j.pl.data)) }; na.data.meta.name = 'PLIO no app';
d = await imp('noapp.json', na);
ok(await plName() === 'PLIO no app' && await gdMeta() === g0, 'a part file without app: into Preliminary sizing, the modules unchanged');
// a project file with Preliminary sizing's part only
g0 = await gdMeta(); const po = { app: 'SteelBridgeDesign', v: 1, name: 'plonly', pl: { app: 'PlateLine', v: 1, name: 'plonly', data: JSON.parse(JSON.stringify(j.pl.data)) } }; po.pl.data.meta.name = 'PLIO pl only';
d = await imp('plonly.json', po);
ok(await plName() === 'PLIO pl only' && await gdMeta() === g0, 'a project file with Preliminary sizing\'s part only: that part, the modules unchanged');
ok(d.some(x => /It replaces Preliminary sizing with/.test(x)), 'the confirm names only Preliminary sizing');
ok(o.errs.length === 0, 'no console errors' + (o.errs.length ? ': ' + o.errs.slice(0, 3).join(' | ') : ''));
await o.b.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
