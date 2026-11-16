// "Timber Beam Check.html": the tool's calculation engine (the inline script between /* TBC-ENGINE-BEGIN */ and
// /* TBC-ENGINE-END */: tables, tbcRun, tbcSanitize, tbcMigrate and, from TBA1, tbcAashto) run in a Node vm, for the engine
// tests (tests/engine/timber-*.test.mjs) and tests/timber-nds-parity.mjs. Nothing of the page's UI is loaded.
// tbcEngine(file) -> the vm context (every engine function and table as a property); top-level const / let run as var.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './harness.mjs';

export const TBC_FILE = path.join(ROOT, 'Timber Beam Check.html');

export function tbcEngineText(html) {
  const a = html.indexOf('/* TBC-ENGINE-BEGIN */'), b = html.indexOf('/* TBC-ENGINE-END */');
  if (a < 0 || b < a) throw new Error('TBC-ENGINE markers not found');
  return html.slice(a, b);
}

export function tbcEngine(file = TBC_FILE, html) {
  const src = tbcEngineText(html != null ? html : fs.readFileSync(file, 'utf8')).replace(/^(const|let) /gm, 'var ');
  const ctx = { console, Math, JSON, Object, Array, Number, String, Set, Map, isFinite, Error };
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: path.basename(file || 'Timber Beam Check.html') });
  return ctx;
}
