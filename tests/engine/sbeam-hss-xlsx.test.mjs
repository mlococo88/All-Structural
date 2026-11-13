// Steel Beam Design - AISC 15th.html: the Excel calc sheet (Export Excel) for HSS sections (SBXH, 2026-11-13).
// For each case the page's own exportExcel() writes the .xlsx (sbeam-xlsx-run.mjs: ExcelJS 4.4.0 from tests/libs, fixed clock);
// the file is read back and EVERY numeric cell of the sheet is compared with the app's result object (AN, AN.design, AN.sect):
//   - each line and table cell is mapped, by its section and description (lines) or by its table and column, to the app value
//     it must show; a numeric cell with no mapping fails the test (so nothing is written unchecked);
//   - the stored value must equal the app's value to the cell's displayed decimals (half a unit of the last shown digit);
//   - a formula cell is also EVALUATED here (a small Excel formula evaluator: + - * / ^, comparisons, MIN MAX SQRT IF PI ABS,
//     cell references followed through the sheet's own cells) and must equal the app's value to 1e-9 (relative), so the sheet
//     recalculates in Excel to the app's numbers; its cached result must match the evaluation to its displayed decimals.
import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { sbXlsx } from './sbeam-xlsx-run.mjs';

const X = sbXlsx();

// ---------- Excel formula evaluator (the subset the export writes) ----------
function evalFormula(f, get) {
  const toks = [], re = /\s*(?:(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+)|([A-Z]+)\(|([A-Z]+\d+)|(<=|>=|<>|[-+*/^(),<>=]))/y;
  let m; re.lastIndex = 0;
  while (re.lastIndex < f.length) {
    const at = re.lastIndex; m = re.exec(f);
    if (!m) throw new Error(`cannot parse formula at ${at}: ${f}`);
    if (m[1] != null) toks.push({ n: +m[1] }); else if (m[2]) toks.push({ fn: m[2] }); else if (m[3]) toks.push({ ref: m[3] }); else toks.push({ op: m[4] });
  }
  let i = 0;
  const peek = () => toks[i], isOp = o => toks[i] && toks[i].op === o, eat = o => { if (!isOp(o)) throw new Error(`expected ${o} in ${f}`); i++; };
  const FN = { MIN: a => Math.min(...a), MAX: a => Math.max(...a), SQRT: a => Math.sqrt(a[0]), ABS: a => Math.abs(a[0]), PI: () => Math.PI };
  function primary() {
    const t = peek(); if (!t) throw new Error('unexpected end: ' + f);
    if (t.n != null) { i++; return t.n; }
    if (t.ref) { i++; return get(t.ref); }
    if (t.fn) {
      i++; const args = [];
      if (t.fn === 'IF') { const c = cmp(); eat(','); const a = cmp(); eat(','); const b = cmp(); eat(')'); return c ? a : b; }
      if (!isOp(')')) { args.push(cmp()); while (isOp(',')) { i++; args.push(cmp()); } }
      eat(')'); if (!FN[t.fn]) throw new Error('function ' + t.fn); return FN[t.fn](args);
    }
    if (isOp('(')) { i++; const v = cmp(); eat(')'); return v; }
    throw new Error('unexpected token in ' + f);
  }
  function unary() { if (isOp('-')) { i++; return -unary(); } if (isOp('+')) { i++; return unary(); } return primary(); }   // Excel: negation before ^
  function pow() { let v = unary(); while (isOp('^')) { i++; v = Math.pow(v, unary()); } return v; }
  function mul() { let v = pow(); while (isOp('*') || isOp('/')) { const o = toks[i++].op; const w = pow(); v = o === '*' ? v * w : v / w; } return v; }
  function add() { let v = mul(); while (isOp('+') || isOp('-')) { const o = toks[i++].op; const w = mul(); v = o === '+' ? v + w : v - w; } return v; }
  function cmp() {
    const v = add(), t = peek();
    if (t && ['<=', '>=', '<', '>', '=', '<>'].includes(t.op)) { i++; const w = add();
      return { '<=': v <= w, '>=': v >= w, '<': v < w, '>': v > w, '=': v === w, '<>': v !== w }[t.op]; }
    return v;
  }
  const v = cmp(); if (i !== toks.length) throw new Error('trailing tokens in ' + f); return v;
}
// unit checks of the evaluator itself
test('xlsx formula evaluator: precedence, functions, references', () => {
  const g = r => ({ A1: 2, B2: 3 })[r];
  assert.equal(evalFormula('1+2*3^2', g), 19); assert.equal(evalFormula('-2^2', g), 4); assert.equal(evalFormula('(A1+B2)/5', g), 1);
  assert.equal(evalFormula('MIN(A1,B2,1.5)', g), 1.5); assert.equal(evalFormula('IF(A1<=B2,10,20)', g), 10); assert.equal(evalFormula('IF(A1>B2,10,20)', g), 20);
  assert.equal(evalFormula('SQRT(16)*PI()', g), 4 * Math.PI); assert.equal(evalFormula('2^3^2', g), 64); assert.equal(evalFormula('1E9/1e3', g), 1e6);
});

// ---------- the expected value of every line, by section (band number) and description ----------
const E = 29000;
function lineExpect(band, desc, sym, cx) {
  const { A, D, p, PL, G, Ltot, gov, loc } = cx;
  const has = re => re.test(desc);
  const flex = (cap, y) => {
    const ls = n => cap.ls.find(l => l.name === n), ltb = cap.ls.find(l => /Lateral/.test(l.name));
    if (has(/^Plastic section modulus/)) return y ? p.Zy : p.Zx;
    if (has(/^Plastic moment/)) return cap.Mp / 12;
    if (has(/^Flange local buckling \(/)) return ls('Flange local buckling').Mn / 12;
    if (has(/^Effective width of the compression flange/)) return ls('Flange local buckling').d.be;
    if (has(/^Effective section modulus/)) return ls('Flange local buckling').d.Se;
    if (has(/^Web local buckling \(/)) return ls('Web local buckling').Mn / 12;
    if (has(/^Unbraced length$/)) return cap.Lb / 12;
    if (has(/^Limiting length for yielding/)) return ltb.d.Lp / 12;
    if (has(/^Limiting length for inelastic/)) return ltb.d.Lr / 12;
    if (has(/^Modification factor/)) return cap.Cb || 1;
    if (has(/^Nominal LTB strength/)) return ltb.Mn / 12;
    if (has(/^Local buckling \(/)) return ls('Local buckling').Mn / 12;
    if (has(/^Critical stress$/)) return 0.33 * E / p.Dt;
    if (has(/^Nominal flexural strength/)) return cap.Mn / 12;
    if (has(/^Design flexural strength/)) return cap.phiMn / 12;
  };
  const shear = (sh, y) => {
    if (has(/^Flat (height|width) of the shear walls/)) return y ? p.bFlat : p.hFlat;
    if (has(/^Shear area/)) return sh.Aw;
    if (has(/^Wall slenderness/)) return y ? p.btdes : p.htdes;
    if (has(/^Web plate buckling coefficient/)) return 5;
    if (has(/^Web shear buckling coefficient/)) return sh.Cv;
    if (has(/^Distance from maximum to zero shear/)) return sh.Lv / 12;
    if (has(/G5-2a$/)) return sh.F1;
    if (has(/G5-2b$/)) return sh.F2c;
    if (has(/^Critical stress$/)) return sh.Fcr;
    if (has(/^Nominal shear strength/)) return sh.Vn;
    if (has(/^Resistance factor/)) return sh.phi;
    if (has(/^Design shear strength/)) return sh.phi * sh.Vn;
  };
  switch (band) {
    case '1':
      if (has(/^Yield strength/)) return p.mat.Fy; if (has(/^Tensile strength/)) return p.mat.Fu;
      if (has(/^Modulus of elasticity/)) return E; if (has(/^Shear modulus/)) return G;
      if (has(/^Unbraced length of compression flange/)) return D.LbTop; if (has(/^Lateral-torsional buckling modification/)) return D.CbUser;
      if (has(/^Total member length/)) return Ltot; if (has(/^Top-flange unbraced/)) return cx.topCont ? 'continuous' : D.LbTop; if (has(/^Bottom-flange unbraced/)) return D.LbBot;
      if (has(/^Effective length, x-x/)) return D.Lcx / 12; if (has(/^Effective length, y-y/)) return D.Lcy / 12; if (has(/^Effective length, torsional/)) return D.Lcz / 12;
      return;
    case '2':
      if (has(/^Shape weight/)) return p.Wt; if (has(/^Self-weight span/)) return D.sw.L; if (has(/^Moment denominator/)) return D.sw.k;
      if (has(/^Shear coefficient/)) return D.sw.c; if (has(/^Dead-load factor/)) return D.sw.gam;
      if (has(/^Self-weight moment/)) return D.sw.dM; if (has(/^Self-weight shear/)) return D.sw.dV; return;
    case '4': return PL[sym] && PL[sym][0] === desc ? p[sym] : undefined;
    case '5':
      if (has(/^Flexural strength|^Compressive strength|^Torsional strength|^Tensile yielding/)) return 0.9;
      if (has(/^Tensile rupture|^Web local crippling/)) return 0.75; if (has(/^Web local yielding/)) return 1;
      if (has(/^Shear strength, major/)) return D.shearX.phi; if (has(/^Shear strength, minor/)) return D.shearY.phi; return;
    case '7': return flex(D.capTop, false);
    case '8': return shear(gov.shearX, false);
    case '9': return flex(D.flexY, true);
    case '10': return shear(D.shearY, true);
    case '11': {
      const cc = D.comp, tc = D.perCombo.find(C => C.dcrPt != null), t = tc && tc.tens, h = t && t.hlp;
      if (has(/^Governing elastic buckling/)) return cc.govFe.Fe; if (has(/^Critical stress$/)) return cc.Fcr;
      if (has(/^Effective area/)) return cc.Ae; if (has(/^Nominal compressive/)) return cc.Pn; if (has(/^Design compressive/)) return cc.phiPn;
      if (has(/^Overall side in the plane/)) return h.H; if (has(/^Overall side 90/)) return h.B; if (has(/^Outside diameter \(label\)/)) return h.D;
      if (has(/^Connection eccentricity/)) return h.xbar; if (has(/^Connection length/)) return h.l; if (has(/^Shear-lag factor \(helper\)/)) return h.U;
      if (has(/^Slot width/)) return h.w; if (has(/^Net area \(helper\)/)) return h.An;
      if (has(/^Net area/)) return t.An; if (has(/^Shear-lag factor/)) return t.U;
      if (has(/^Tensile yielding/)) return t.phiY; if (has(/^Tensile rupture/)) return t.phiR; return;
    }
    case '12': {
      const T = D.tors;
      if (has(/^Torsional constant/)) return p.Cc; if (has(/^Member length for Eq. H3-2a/)) return T.L / 12;
      if (has(/H3-2a$/)) return T.F1; if (has(/H3-2b$/)) return T.F2c; if (has(/^Critical stress$/)) return T.Fcr;
      if (has(/^Nominal torsional/)) return T.Tn / 12; if (has(/^Design torsional/)) return T.phiTn / 12; return;
    }
    case '13': {
      if (!loc) return; const c = loc.caps, pr = loc.prm, st = id => c.ls.find(s => s.id === id);
      if (has(/^Distance to the nearer member end/)) return loc.endDist >= 1e5 ? 'interior' : loc.endDist; if (has(/^Bearing length along/)) return c.lb;
      if (has(/^Corner radius/)) return c.k; if (has(/^Plate width across/)) return c.Bp; if (has(/^Plate thickness/)) return pr.tp;
      if (has(/^Plate yield stress/)) return pr.Fyp; if (has(/^Effective plate width/)) return c.Be;
      if (has(/^Plate local yielding/)) return 0.9 * st('ply').Rn; if (has(/^HSS face punching/)) return 0.95 * st('pun').Rn;
      if (has(/^Sidewall local yielding/)) return st('sly').Rn; if (has(/^Crippling depth/)) return c.dF;
      if (has(/^Sidewall local crippling/)) return 0.75 * st('slc').RnQ1; if (has(/^Outside diameter/)) return c.D;
      if (has(/^(Plate|Bearing) width$/)) return c.Bp; if (has(/^Width ratio/)) return c.beta; if (has(/^HSS local yielding/)) return 0.9 * st('rly').RnQ1;
      return;
    }
    case '15': {
      const d = D.defl;
      if (has(/^Service load/)) return d.w; if (has(/^Span$/)) return d.L; if (has(/^Coefficient/)) return d.c; if (has(/^Moment of inertia/)) return d.I;
      if (has(/^Deflection$/)) return d.d; if (has(/^Limit denominator/)) return d.den; if (has(/^Allowable deflection/)) return d.lim;
      if (has(/^Demand \/ capacity ratio/)) return d.dcr; return;
    }
  }
}
// the expected rows of every table (strings: text columns, not compared; numbers: compared; null: no value expected)
function tableExpect(band, heads, cx) {
  const { A, D, mem } = cx, h0 = heads[0], h1 = heads[1], abs = Math.abs, nz = v => v || 0;
  if (h0 === 'Case / combination') return D.perCombo.map(C => [C.name, C.flexGov ? C.flexGov.Mu : 0, C.Vu, nz(C.man.Pu), nz(C.man.Muy), nz(C.man.Vuy), nz(C.man.Tu)]);
  if (h0 === 'Check') return D.checks.map(ch => { const ok = !ch.na && ch.dem != null && isFinite(ch.dem) && ch.cap != null && isFinite(ch.cap);
    return ['', '', ok ? ch.dem : null, ok ? ch.cap : null, '', ch.na ? null : ch.dcr, '']; });
  if (h0 === 'Element' && heads.includes('λp')) {
    const c = D.clsF, m = { 'Flange (major)': c.x && c.x.flange, 'Web (major)': c.x && c.x.web, 'Flange (minor)': c.y && c.y.flange, 'Web (minor)': c.y && c.y.web, Wall: c.wall };
    return Object.keys(m).filter(k => m[k]).map(k => [k, m[k].lam, m[k].lp, m[k].lr, '', '']);
  }
  if (h0 === 'Case' && (h1 === 'Lb (ft)' || h1 === 'Region (ft)')) return D.perCombo.map(C => { const g = C.flexGov; return ['', mem ? g.LbFt : '', g.Cb, g.Mu, g.phiMn, g.dcr, '']; });
  if (h0 === 'Case' && h1 === 'Vu (kip)') return D.perCombo.map(C => ['', C.Vu, C.shearX.phi * C.shearX.Vn, C.dcrVx, '']);
  if (h0 === 'Case' && h1 === 'Muy (k·ft)') return D.perCombo.filter(C => C.man.Muy).map(C => ['', abs(C.man.Muy), C.phiMny, C.dcrMy, '']);
  if (h0 === 'Case' && h1 === 'Vuy (kip)') return D.perCombo.filter(C => C.dcrVy != null).map(C => ['', abs(C.man.Vuy), D.shearY.phi * D.shearY.Vn, C.dcrVy, '']);
  if (h0 === 'Element' && heads[2] === 'λr') return Object.keys(D.comp.clsC).map(k => [k, D.comp.clsC[k].lam, D.comp.clsC[k].lr, '', '']);
  if (h0 === 'Buckling mode') return D.comp.modes.map(m => ['', '', m.L / 12, m.s || null, m.Fe]);
  if (h0 === 'Slender element') return D.comp.eff.map(e => ['', e.lam, e.thr, e.b, e.be, e.red]);
  if (h0 === 'Case' && heads[2] === 'φPn (kip)') return D.perCombo.filter(C => C.dcrP != null).map(C => ['', C.man.Pu, C.phiPn, C.dcrP, '']);
  if (h0 === 'Case' && heads[2] === 'φtPn (kip)') return D.perCombo.filter(C => C.dcrPt != null).map(C => ['', C.man.Pu, C.phiPt, C.dcrPt, '']);
  if (h0 === 'Case' && h1 === 'Tu (k·ft)') return D.perCombo.filter(C => C.dcrT != null).map(C => ['', abs(C.man.Tu), C.phiTn, C.dcrT, '', '']);
  if (h0 === 'Case / location') {
    const rows = [];
    D.perCombo.forEach(C => (C.hssK || []).forEach(r => {
      const lo = D.hssK.find(l => l.key === r.key); if (!lo || lo.prm.type === 'none' || !(r.dem > 1e-9)) return;
      if (lo.prm.errs.length || lo.prm.nc) { rows.push(['', r.F, '', '', '', '', '']); return; }
      r.states.forEach(s => rows.push(['', r.F, r.U, '', s.Qf != null ? s.Qf : null, s.phiRn, s.dcr]));
    }));
    return rows;
  }
  if (h0 === 'Case' && h1 === 'Equation') return D.perCombo.map(C => { const t = C.inter.terms;
    return ['', '', nz(t.P), nz(t.Mx), nz(t.My), t.V != null ? t.V + t.T : null, C.inter.value, '']; });
  if (h0 === 'Service combination / span') { const rows = [];
    A.svc.forEach(sc => sc.perSpan.forEach(ps => rows.push(['', abs(ps.dmax) * 12, ps.lim != null ? ps.lim * 12 : null, '', ps.ratio != null ? ps.ratio : null, '']))); return rows; }
}

const dpOf = cell => { const m = /0\.(0+)$/.exec(cell.numFmt || ''); return m ? m[1].length : 0; };
const numOf = v => (typeof v === 'number' ? v : v && typeof v === 'object' && 'formula' in v ? v.result : undefined);

// export one case and check every numeric cell; returns counts
async function checkCase(name, setup) {
  const { A, buf, log } = await X.run(setup);
  const ws = await X.load(buf), D = A.design, p = A.sect;
  const cx = { A, D, p, mem: !!D.member, PL: JSON.parse(X.sb.run('JSON.stringify(PROP_LABELS)')), G: X.sb.run('GKSI'), Ltot: X.sb.run('totalL()'), topCont: X.sb.run('S.bracing.topCont') };
  cx.gov = (() => { let b = -1, c = null; D.perCombo.forEach(C => { if (C.flexGov && C.flexGov.dcr > b) { b = C.flexGov.dcr; c = C; } }); return c || D.perCombo[0]; })();
  const fails = [], seen = new Set(), memo = new Map();
  const cellVal = addr => {
    if (memo.has(addr)) return memo.get(addr);
    const v = ws.getCell(addr).value; let r;
    if (typeof v === 'number') r = v; else if (v == null) r = 0;   /* an empty cell reads as 0 in Excel */
    else if (v && typeof v === 'object' && 'formula' in v) r = evalFormula(v.formula, cellVal);
    else throw new Error(`${name}: formula reads ${addr}, which is not a number (${JSON.stringify(v)})`);
    memo.set(addr, r); return r;
  };
  let nNum = 0, nFormula = 0;
  const cmp = (where, cell, exp) => {
    const v = cell.value, isF = !!(v && typeof v === 'object' && 'formula' in v), n = numOf(v);
    seen.add(cell.address);
    if (n == null && !isF) { if (typeof exp === 'number' && isFinite(exp)) fails.push(`${where}: no value written, app ${exp}`); return; }
    if (n != null && typeof n !== 'number') return;
    nNum++;
    if (typeof exp !== 'number') { fails.push(`${where}: numeric cell ${cell.address} = ${n} has no app value mapped`); return; }
    const dp = dpOf(cell), tol = 0.5 * Math.pow(10, -dp) * (1 + 1e-9) + 1e-12 * Math.abs(exp);
    // ExcelJS stores no cached result for a formula whose result is 0 (Excel computes it on opening): only then may it be absent
    if (n == null) { if (exp !== 0) fails.push(`${where}: formula without a cached result, app ${exp}`); }
    else if (!(Math.abs(n - exp) <= tol)) fails.push(`${where}: ${cell.address} = ${n}, app ${exp} (shown to ${dp} dp)`);
    if (isF) {
      nFormula++;
      let ev; try { ev = cellVal(cell.address); } catch (e) { fails.push(`${where}: ${e.message}`); return; }
      if (!(Math.abs(ev - exp) <= 1e-9 * Math.max(1, Math.abs(exp)))) fails.push(`${where}: formula ${v.formula} evaluates to ${ev}, app ${exp}`);
      if (n != null && !(Math.abs(ev - n) <= tol)) fails.push(`${where}: cached result ${n} vs evaluated ${ev}`);
    }
  };
  let band = null;
  for (const e of log) {
    if (e.k === 'band') { band = (/^(\d+[a-z]?)\./.exec(String(e.a[0]).trim()) || [])[1] || String(e.a[0]).trim(); cx.loc = null; continue; }
    if (e.k === 'sub' && band === '13' && D.hssK) { cx.loc = D.hssK.find(l => String(e.a[0]).startsWith(l.label + ' — ')) || null; continue; }
    if (e.k === 'line') {
      const cell = ws.getCell(e.r, 9), exp = lineExpect(band, e.a[0], e.a[1], cx);
      cmp(`[${band}] ${e.a[0]} (${e.a[1]})`, cell, exp);
    }
    if (e.k === 'table') {
      const [heads, n] = e.a, rows = tableExpect(band, heads, cx);
      if (!rows) { for (let i = 1; i <= n; i++) heads.forEach((h, j) => { const c = ws.getCell(e.r + i, 2 + j); if (numOf(c.value) != null && typeof numOf(c.value) === 'number') fails.push(`[${band}] table "${heads.join(' | ')}": no expectation`); seen.add(c.address); }); continue; }
      if (rows.length !== n) { fails.push(`[${band}] table "${heads[0]} | ${heads[1]}": ${n} rows written, app ${rows.length}`); continue; }
      rows.forEach((row, i) => heads.forEach((h, j) => {
        const c = ws.getCell(e.r + 1 + i, 2 + j), ex = row[j];
        if (typeof ex === 'string') { seen.add(c.address); if (typeof numOf(c.value) === 'number') fails.push(`[${band}] ${heads[j]} row ${i + 1}: numeric cell, text expected`); return; }
        cmp(`[${band}] ${heads[0]} / ${h} row ${i + 1}`, c, ex == null || !isFinite(ex) ? (ex === Infinity ? Infinity : null) : ex);
      }));
    }
  }
  // completeness: no numeric cell outside the checked lines and tables
  ws.eachRow(row => row.eachCell(c => { if (typeof numOf(c.value) === 'number' && !seen.has(c.address)) fails.push(`unchecked numeric cell ${c.address} = ${numOf(c.value)}`); }));
  assert.deepEqual(fails, [], `${name}:\n  ` + fails.join('\n  '));
  assert.ok(nNum > 40 && nFormula > 15, `${name}: only ${nNum} numeric / ${nFormula} formula cells`);
  return { A, D, p, log, nNum, nFormula };
}

const RECT = (label, grade) => `S.section={family:'HSSR',label:'${label}',grade:'${grade}',builtUp:false,ovr:{}};`;
const ROUND = (label, grade, ovr) => `S.section={family:'HSSP',label:'${label}',grade:'${grade}',builtUp:false,ovr:${JSON.stringify(ovr || {})}};`;
const MEM = (o, rows) => `S.mode='member';Object.assign(S.member,${JSON.stringify(o)});S.member.rows=${JSON.stringify(rows)};`;
const PTS = `S.trib.on=false;S.loads=[{id:'q1',nm:'P',type:'point',lc:'DL',si:0,mag:5,pos:10},{id:'q2',nm:'PL',type:'point',lc:'LL',si:0,mag:10,pos:10}];`;
const MAN = man => `S.combos.forEach((cb,i)=>{S.design.man[cb.id]=(${man})(i);});`;
const cases = [];
const C = (name, setup, chk) => cases.push({ name, setup: `()=>{${setup}}`, chk });
const routes = D => D.capTop.ls.filter(l => l.applies).map(l => l.clause).join(',');

C('rect A500B member: compact, Lb < Lp, H3-6, tension helper case 6, self-weight, deflection, Chapter K narrow plate (not covered)',
  RECT('HSS12X6X1/2', 'A500B_R') + MEM({ L: 20, Lb: 12, Cb: 1, sw: { on: true, L: 20, cfg: 'simple', k: 8, c: 0.5, gam: 1.2 },
    defl: { on: true, w: 1.2, L: 20, cfg: 'simple', c: null, den: 360, I: null }, j10: { R: 30, lb: null, loc: 'interior' }, hssK: { type: 'plate', Bp: 5, tp: 0.5 } },
  [{ id: 'm1', name: 'big', Mux: 150, Vux: 60, Pu: 150, Muy: 40, Vuy: 20, Tu: 0 }, { id: 'm2', name: 'tors', Mux: 50, Vux: 20, Pu: 10, Muy: 5, Vuy: 4, Tu: 40 },
    { id: 'm3', name: 'tension', Mux: 20, Vux: 5, Pu: -100, Muy: 0, Vuy: 0, Tu: 0 }]) + `S.design.ten={An:null,U:null,hlp:{on:true,tp:0.5,l:14}};`,
  ({ D, log }) => { assert.equal(D.perCombo[1].inter.eq, 'H3-6'); assert.equal(D.perCombo[0].inter.eq, 'H1-1a'); assert.equal(D.perCombo[2].tens.hlp.case, '6'); assert.ok(D.hssK[0].prm.nc);
    const t = log.map(e => JSON.stringify(e.a)).join('\n'); assert.ok(/NOT COVERED: plate width Bp = 5\.000 in < 0\.85B = 5\.100 in/.test(t) && /check HSS face plastification by hand/.test(t), t); });
C('rect member: plate Bp = 0.85B (5.1 in, covered), at the member end',
  RECT('HSS12X6X1/2', 'A500B_R') + MEM({ L: 20, Lb: 12, j10: { R: 30, lb: null, loc: 'end' }, hssK: { type: 'plate', Bp: 5.1, tp: 0.5 } },
  [{ id: 'm1', name: 'A', Mux: 100, Vux: 30, Pu: 40, Muy: 0, Vuy: 0, Tu: 0 }]),
  ({ D }) => { assert.equal(D.hssK[0].prm.nc, undefined); assert.ok(D.perCombo[0].hssK[0].states.length >= 3); });
C('rect slender A500B member: F7-3 slender flange, F7-6 web, F7-10 LTB, E7, H3-4',
  RECT('HSS24X20X3/8', 'A500B_R') + MEM({ Lb: 100, Cb: 1.1 }, [{ id: 'm1', name: 'A', Mux: 300, Vux: 50, Pu: 100, Muy: 100, Vuy: 30, Tu: 30 }]),
  ({ D }) => { assert.match(routes(D), /F7-3/); assert.match(routes(D), /F7-6/); assert.match(routes(D), /F7-10/); assert.ok(D.comp.eff.length === 2); assert.equal(D.tors.clause, 'H3-4');
    assert.match(D.flexY.ls.filter(l => l.applies).map(l => l.clause).join(), /F7-3/); });
C('rect noncompact A500C member: F7-2 flange, F7-6 web, F7-11 LTB, H3-5',
  RECT('HSS24X8X1/4', 'A500C_R') + MEM({ Lb: 600, Cb: 1 }, [{ id: 'm1', name: 'A', Mux: 100, Vux: 30, Pu: 0, Muy: 10, Vuy: 5, Tu: 5 }]),
  ({ D }) => { assert.match(routes(D), /F7-2/); assert.match(routes(D), /F7-11/); assert.equal(D.tors.clause, 'H3-5'); });
C('rect A1085 member: nominal-wall properties, tension helper with slot width, typed U smaller',
  RECT('HSS8X6X1/2', 'A1085') + MEM({ L: 16, Lb: 16 }, [{ id: 'm1', name: 'A', Mux: 60, Vux: 20, Pu: -150, Muy: 10, Vuy: 5, Tu: 12 }]) +
  `S.design.ten={An:null,U:0.7,hlp:{on:true,tp:0.5,w:0.75,l:10}};`,
  ({ p, D }) => { assert.ok(p._a1085); assert.equal(p.tdes, p.tnom); assert.ok(D.perCombo[0].tens.U === 0.7); });
C('rect member: blocked helper (l < H), Chapter K input missing',
  RECT('HSS8X6X1/2', 'A500B_R') + MEM({ L: 10, Lb: 10, j10: { R: 20, lb: null, loc: 'end' }, hssK: { type: 'plate', tp: 0.5 } }, [{ id: 'm1', name: 'A', Mux: 10, Vux: 5, Pu: -50, Muy: 0, Vuy: 0, Tu: 0 }]) +
  `S.design.ten={hlp:{on:true,tp:0.5,l:6}};`,
  ({ D }) => { assert.ok(D.perCombo[0].tens.blocked); assert.ok(D.hssK[0].prm.errs.length); });
C('rect beam mode: point loads, bearing at supports, plate at the load, braced top flange, manual Pu/Muy/Vuy/Tu',
  RECT('HSS8X8X1/2', 'A500C_R') + PTS + `S.design.hssK={sup:{type:'bearing',lb:4},pt:{type:'plate',Bp:7,tp:0.5},loc:{}};S.bracing.topCont=false;S.bracing.LbTop=10;` +
  MAN(`i=>({Pu:i%2?20:0,Muy:i%3?4:0,Vuy:i%2?3:0,Tu:i===1?6:0})`),
  ({ D }) => { assert.ok(D.hssK.length === 3); });
C('round beam mode: G5 per combination, plate at the load (Table K2.1), torsion with the total length',
  ROUND('HSS10.000X0.500', 'A500C_P') + PTS + `S.design.hssK={pt:{type:'plate',Bp:6,tp:0.5},sup:{type:'bearing',lb:3,Bp:8}};` +
  MAN(`i=>({Pu:i?15:0,Muy:i?3:0,Vuy:i?2:0,Tu:i===2?20:0})`),
  ({ D }) => { assert.equal(D.perCombo[0].shearX.route, 'G5'); assert.equal(D.tors.clause, 'H3-2a/b'); assert.ok(isFinite(D.tors.L)); });
C('round member: torsion with a blank member span (L = infinity), noncompact F8-2, slender E7.2, tension helper case 5, bearing',
  ROUND('HSS28.000X0.375', 'A500B_P') + MEM({ L: null, Lb: 15, j10: { R: 40, lb: null, loc: 'interior' }, hssK: { type: 'bearing', lb: 6 } },
    [{ id: 'm1', name: 'A', Mux: 300, Vux: 40, Pu: 200, Muy: 50, Vuy: 10, Tu: 150 }, { id: 'm2', name: 'T', Mux: 50, Vux: 10, Pu: -300, Muy: 0, Vuy: 0, Tu: 0 }]) +
  `S.design.ten={hlp:{on:true,tp:1,l:30}};`,
  ({ D }) => { assert.equal(D.tors.L, Infinity); assert.match(D.capTop.gov.clause, /F8-2/); assert.ok(D.comp.eff.length === 1); assert.equal(D.perCombo[1].tens.hlp.case, '5'); });
C('round member: span entered, H3-2a governs, slender F8-3 (wall override), Lv entered',
  ROUND('HSS20.000X0.375', 'A500B_P', { tdes: 0.08 }) + MEM({ L: 40, Lb: 40, Lv: 20 }, [{ id: 'm1', name: 'A', Mux: 20, Vux: 5, Pu: 0, Muy: 0, Vuy: 0, Tu: 5 }]),
  ({ D }) => { assert.match(D.capTop.gov.clause, /F8-3/); assert.ok(D.tors.F1 > D.tors.F2c); assert.ok(D.shearX.Lv < 1e8); });
C('Pipe A53B member: F8, G5, H3.1(a), tension (typed)',
  `S.section={family:'PIPE',label:'Pipe8XS',grade:'A53B',builtUp:false,ovr:{}};` + MEM({ L: 12, Lb: 12 },
    [{ id: 'm1', name: 'A', Mux: 40, Vux: 10, Pu: 30, Muy: 10, Vuy: 3, Tu: 8 }, { id: 'm2', name: 'B', Mux: 10, Vux: 2, Pu: -40, Muy: 0, Vuy: 0, Tu: 0 }]) +
  `S.design.ten={An:6,U:0.85};`,
  ({ D }) => { assert.equal(D.hssK, undefined); assert.equal(D.perCombo[1].tens.An, 6); });

for (const cs of cases) test(`HSS Excel export: ${cs.name}`, async () => { const r = await checkCase(cs.name, cs.setup); if (cs.chk) cs.chk(r); });

// the W-shape export is not touched by the HSS steps: no HSS step in a W sheet
test('HSS Excel export: a W-shape sheet has none of the HSS steps', async () => {
  const { log } = await X.run(`()=>{S.loads=[{id:'q1',nm:'P',type:'point',lc:'DL',si:0,mag:5,pos:10}];S.design.lbSup=4;}`);
  const txt = log.map(e => String(e.a[0])).join('\n');
  assert.ok(!/HSS WALLS|Eq\. F7|Eq\. G4|Flat height/.test(txt));
  assert.ok(/Area of web/.test(txt) && /13\.  CONCENTRATED FORCES/.test(txt));
});
