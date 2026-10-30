// legacyContext(roots, decl): a Node vm context holding the named top-level declarations of a legacy page (Preliminary sizing's pl-src,
// GirderDetail's main script, ST-Girder's st-src) and, transitively, every top-level declaration their text names. Added 2026-10-30 for
// the Auto design parity runs (tests/engine/autodesign-parity.mjs), where the on-demand loading of pl-source.mjs / gd-source.mjs is not
// enough: a function V8 has already optimized does not see a const added later (see gd-source.mjs), and the legacy Suggest / Full design
// run for minutes through hundreds of declarations. So the closure is found statically first (identifiers in each declaration's text that
// are themselves top-level declarations of the page), then loaded once: function declarations first, then the other declarations in
// dependency order. A declaration whose initializer throws (a DOM read at load time) is left out and reported in `skipped`.
// decl(name): the declaration text or null (plDecl / gdDecl / stDecl).
import vm from 'node:vm';

export function legacyContext(roots, decl, pre) {
  const texts = new Map(), deps = new Map(), seen = new Set(), stack = [...roots];
  const known = new Map(); const has = n => { if (!known.has(n)) known.set(n, decl(n)); return known.get(n); };
  while (stack.length) {
    const n = stack.pop(); if (seen.has(n)) continue; seen.add(n);
    const t = has(n); if (!t) continue; texts.set(n, t);
    const ids = new Set(t.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ' ').match(/[A-Za-z_$][\w$]*/g) || []); ids.delete(n);
    const d = [...ids].filter(i => /^[A-Za-z_$]/.test(i) && i.length > 1 && has(i)); deps.set(n, d); d.forEach(i => stack.push(i));
  }
  const ctx = { console, setTimeout, clearTimeout }; ctx.window = ctx; vm.createContext(ctx);
  if (pre) vm.runInContext(pre, ctx);
  const isFn = t => /^(?:async )?function/.test(t), skipped = [], done = new Set();
  const load = n => { if (done.has(n)) return; done.add(n); try { vm.runInContext(`/*LC*/${texts.get(n)}`, ctx, { filename: `legacy (${n})` }); } catch (e) { skipped.push(`${n}: ${e.message}`); } };
  for (const [n, t] of texts) if (isFn(t)) load(n);
  const visit = (n, path) => { if (done.has(n) || path.has(n)) return; path.add(n); (deps.get(n) || []).forEach(d => { if (!isFn(texts.get(d) || 'function')) visit(d, path); }); load(n); };
  for (const n of texts.keys()) visit(n, new Set());
  const ev = expr => vm.runInContext(expr, ctx);
  return { ctx, ev, names: [...texts.keys()], skipped };
}
