// Parity of shared/moving-load.js + shared/vehicles.js with the engine they were moved from
// (Moving Load Generator.html at ORIGINAL_REF, before the extraction).
//
// 1. For every case, the full output of the shared engine (envelopes with governing positions, influence lines,
//    effects and rows, warnings, engine check, step solver, deflection envelope, absolute-maximum scan) is
//    serialised to canonical JSON and its SHA-256 compared with EXPECTED, which was recorded from the ORIGINAL
//    inline functions (tests/engine/record-moving-load.mjs). Key values are also listed in EXPECTED for reading.
// 2. When git history is available, the original inline functions are also run live (text taken from
//    ORIGINAL_REF with `git show`, evaluated in a vm with the page's few DOM reads stubbed) and every case is
//    compared value by value with the shared engine.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { loadShared, plain, test, ROOT } from './harness.mjs';

export const ORIGINAL_REF = 'b3dbddb';   // origin/main before the extraction
const PAGE = 'Moving Load Generator.html';

// ---------- cases ----------
// Page defaults: E 29000 ksi; one plate girder segment; composite deck n 8, b_eff 96 in, t_s 8 in, haunch 2 in.
const SEG0 = { len: 0, bt: 16, tt: 1, D: 54, tw: 0.5625, bb: 18, tb: 1.5, Io: 0 };
const DK = { comp: true, n: 8, beff: 96, ts: 8, th: 2, inclH: false };
const SEGS3 = [{ ...SEG0, len: 70 }, { len: 60, bt: 18, tt: 2, D: 54, tw: 0.625, bb: 20, tb: 2.5, Io: 0 }, { ...SEG0 }];
const SEGS_IO = [{ ...SEG0, len: 40, Io: 30000 }, { ...SEG0, len: 0, Io: 0 }];
const VEHICLES = ['HL93-Truck', 'HL93-Tandem', 'HS20', 'H20', 'E80', 'E80-Alt', 'F40PH', 'HSP46', '286K', '315K', 'ES44AC', 'Fatigue'];

// A model as the page's readModel() builds it after applyPreset(key) (with applyFam's DFs).
function modelFrom(P, props, key, o = {}) {
  const p = P[key], spans = o.spans || [100, 120], segs = o.segs || [SEG0];
  const sl = p.stdLane || { on: false, w: 0.64, PM: 18, PV: 26 };
  const rail = !['HL93-Truck', 'HL93-Tandem', 'HS20', 'H20', 'Fatigue'].includes(key);
  const m = {
    spans, E: 29000,
    segs: segs.map(s => { const q = props(s, DK); const I = s.Io > 0 ? s.Io : q.I; const bad = !(I > 0); return { ...s, I: bad ? 1 : I, bad }; }),
    axles: p.axles.map(a => [...a]), short: key,
    stdLane: sl.on ? { w: sl.w, PM: sl.PM, PV: sl.PV } : null,
    udl: { ...p.udl }, vK: p.vary.k, vMin: p.vary.min, vMax: p.vary.max,
    neglect: p.neglect, dirs: [1, -1], secondary: p.secondary,
    multi: p.multi.on, mScale: p.multi.scale, mHmin: p.multi.hmin, mFixed: p.multi.fixed,
    imp: { method: p.imp.method, val: p.imp.val, S: 6.5, bal: false, onUdl: p.imp.onUdl },
    llf: 1.75, dfM: spans.map(() => rail ? 0.5 : 0.62), dfV: spans.map(() => rail ? 0.5 : 0.81), dfNeg: 0,
    step: 1, hStep: 2, rail,
  };
  return Object.assign(m, o.m || {});
}

// [name, vehicle, options, env]; env = the page inputs the engine reads (impact L basis, user L, refine, deflection)
export const CASES = [
  ...VEHICLES.map(v => [`2 spans 100/120, ${v}`, v, {}, {}]),
  ['1 span 100, HL93-Truck', 'HL93-Truck', { spans: [100] }, {}],
  ['1 span 40, HL93-Tandem', 'HL93-Tandem', { spans: [40] }, {}],
  ['3 spans 80/100/80, HL93-Truck', 'HL93-Truck', { spans: [80, 100, 80] }, {}],
  ['4 spans 90/110/110/90, HL93-Truck', 'HL93-Truck', { spans: [90, 110, 110, 90] }, {}],
  ['4 spans 60/60/60/60, Fatigue', 'Fatigue', { spans: [60, 60, 60, 60] }, {}],
  ['3 spans, 3 segments, HL93-Truck', 'HL93-Truck', { spans: [80, 100, 80], segs: SEGS3 }, {}],
  ['2 spans, 3 segments, E80', 'E80', { segs: SEGS3 }, {}],
  ['2 spans, segment with Io, HS20', 'HS20', { segs: SEGS_IO }, {}],
  ['3 spans, HS20 Std. Spec. impact', 'HS20', { spans: [70, 90, 70], m: { imp: { method: 'std', val: 1, S: 6.5, bal: false, onUdl: false } } }, {}],
  ['2 spans, HL93-Truck, neg DF, one direction, no neglect', 'HL93-Truck', { m: { dfNeg: 0.7, dirs: [1], neglect: false } }, {}],
  ['2 spans, HL93-Truck, full-length UDL, impact on UDL', 'HL93-Truck', { m: { udl: { mode: 'full', w: 0.64, gap: 0, trunc: false }, imp: { method: 'const', val: 1.33, S: 6.5, bal: false, onUdl: true } } }, {}],
  ['2 spans, HL93-Truck, refine off', 'HL93-Truck', {}, { refine: false }],
  ['2 spans, HL93-Truck, step 0.5, hStep 1', 'HL93-Truck', { m: { step: 0.5, hStep: 1 } }, {}],
  ['3 spans, E80, AREMA L = span', 'E80', { spans: [60, 80, 60] }, { Lb: 'span' }],
  ['3 spans, E80, AREMA L = max, ballasted', 'E80', { spans: [60, 80, 60], m: { imp: { method: 'arema', val: 1, S: 6.5, bal: true, onUdl: true } } }, { Lb: 'max' }],
  ['3 spans, F40PH, AREMA L = total', 'F40PH', { spans: [60, 80, 60] }, { Lb: 'total' }],
  ['2 spans, ES44AC, AREMA user L 75', 'ES44AC', {}, { Lb: 'user', aL: 75 }],
  ['2 spans, E80, trailing load truncated', 'E80', { m: { udl: { mode: 'trail', w: 8, gap: 5, trunc: true } } }, {}],
  ['2 spans, HL93-Truck, multi fixed 0 (variable), Hmin 30', 'HL93-Truck', { m: { mFixed: 0, mHmin: 30 } }, {}],
  ['1 span 150, H20 Std. lane', 'H20', { spans: [150] }, {}],
  ['2 spans, HS20 with secondary HL93-Tandem', 'HS20', { m: { secondary: 'HL93-Tandem' } }, {}],
  ['2 spans, HL93-Truck, warnings (bad var. axle, zero DF, impact < 1)', 'HL93-Truck', { m: { vK: 9, dfV: [0, 0.81], imp: { method: 'const', val: 0.9, S: 6.5, bal: false, onUdl: false } } }, {}],
  ['2 spans, HL93-Truck, deflection: vehicle as configured, no impact', 'HL93-Truck', {}, { dMode: 'veh', dIM: false, dDF: 0.4 }],
];

// ---------- running one engine on one case ----------
export function runCase(E, c) {
  const [, key, o, env] = c;
  const m = modelFrom(E.P, E.props, key, o);
  const R = E.analyze(m, env);
  const out = {
    effs: R.effs, res: R.res, rows: R.rows, trans: R.rows.trans, x: R.x, sup: R.sup, Lt: R.Lt, IL: R.IL,
    warn: R.warn, check: R.check, supNodes: R.supNodes, varOK: R.varOK, imSpan: R.imSpan, imR: R.imR, nn: R.nn, nf: R.nf,
    dfOf: R.effs.map(ef => [R.dfOf(ef, 1), R.dfOf(ef, -1)]),
    ends: R.effs.map((_, ei) => R.ends(ei, 0)),
  };
  // step solver: the primary, secondary and multi-vehicle cases at a few positions, plus a lane load
  out.step = ['p', 's', 'm'].map(cs => {
    const cfg = R.stepCase(cs, null, null);
    return [0.3, 0.55, 0.8].map(f => {
      const p = f * R.Lt, pl = cfg.offs.map((off, a) => [p - off, cfg.loads[a]]).filter(([xp]) => xp >= 0 && xp <= R.Lt);
      return R.stepSolve(pl, [[0.1 * R.Lt, 0.6 * R.Lt, 0.64]]);
    });
  });
  out.defl = E.deflection(R, { mode: env.dMode || 'lrfd', DF: env.dDF != null ? env.dDF : 1, useIM: env.dIM !== false });
  const A = E.absScan(R, mm => E.analyze(mm, env));
  out.abs = A.all.map(q => [q.ef.t, q.ef.x, q.ef.spans, q.r.max, q.r.min, q.r.maxG, q.r.minG]);
  return out;
}
export const canon = out => JSON.stringify(plain(out));
export const sha = s => crypto.createHash('sha256').update(s).digest('hex');
// Readable key values: largest +M, most negative M, largest |V|, largest reaction (unfactored per lane, with impact)
export function keyValues(out) {
  let pM = 0, nM = 0, V = 0, Rm = 0;
  out.effs.forEach((ef, i) => { const r = out.res[i];
    if (ef.t === 'M') { pM = Math.max(pM, r.max); nM = Math.min(nM, r.min); }
    else if (ef.t === 'V') V = Math.max(V, r.max, -r.min); else Rm = Math.max(Rm, r.max); });
  return { maxPosM: pM, maxNegM: nM, maxV: V, maxR: Rm, nodes: out.nn };
}

// ---------- the two engines ----------
export function sharedEngine() {
  const w = loadShared('vehicles.js', 'moving-load.js'), V = w.SharedVehicles.build(), S = w.SharedMovingLoad;
  const P = V.presets; P.Fatigue = V.fatigue;               // as the page does
  return {
    P, props: S.props,
    analyze: (m, env) => S.analyze(m, { Lb: env.Lb || 'span', aL: env.aL != null ? env.aL : 100, refine: env.refine !== false, vehicles: P }),
    deflection: S.deflection, absScan: S.absScan,
  };
}

// The original inline functions, text taken from the page at ORIGINAL_REF, evaluated with the DOM reads stubbed.
export function originalEngine() {
  const html = execFileSync('git', ['-C', ROOT, 'show', `${ORIGINAL_REF}:${PAGE}`], { encoding: 'utf8', maxBuffer: 1 << 26 }).replace(/\r\n/g, '\n');
  const block = (start, end) => { const i = html.indexOf(start); assert.ok(i >= 0, start); const j = html.indexOf(end, i); assert.ok(j > i, end); return html.slice(i, j + end.length); };
  const fn = name => block(`\nfunction ${name}`, '\n}\n');
  const src = [
    "const num=(id,d)=>{const e=$(id);const v=e?parseFloat(e.value):NaN;return isNaN(v)?d:v;};",
    "const sp=(load,arr)=>arr.map(s=>[load,s]);",
    block('const E80=', '\n};\n'),
    html.match(/\nP\['Fatigue'\]=HW\(.*\n/)[0],
    fn('props(s,dk)'), fn('luDecomp('), fn('luSolve('), fn('analyze(m)'), fn('deflAnalyze()'), fn('absScan(R)'),
  ].join('\n');
  const ctx = { ENV: {}, RES: null };
  ctx.$ = id => {           // the only page inputs the engine functions read
    const E = ctx.ENV;
    if (id === 'aLb') return { value: E.Lb || 'span' };
    if (id === 'aL') return { value: String(E.aL != null ? E.aL : 100) };
    if (id === 'refineChk') return { checked: E.refine !== false };
    if (id === 'dCase') return { value: E.dMode || 'lrfd' };
    if (id === 'dDF') return { value: String(E.dDF != null ? E.dDF : 1) };
    if (id === 'dIM') return { checked: E.dIM !== false };
    throw new Error('unexpected DOM read: ' + id);
  };
  vm.createContext(ctx);
  vm.runInContext(src + '\nthis.__E={P,props,analyze,deflAnalyze,absScan};', ctx, { filename: `${ORIGINAL_REF}:${PAGE}` });
  const O = ctx.__E;
  return {
    P: O.P, props: O.props,
    analyze: (m, env) => { ctx.ENV = env; return O.analyze(m); },
    deflection: (R, d) => { ctx.ENV = { ...ctx.ENV, dMode: d.mode, dDF: d.DF, dIM: d.useIM }; ctx.RES = R; return O.deflAnalyze(); },
    absScan: R => O.absScan(R),   // the original calls its own analyze; ENV is still the case's
  };
}

// ---------- expected values (recorded from the ORIGINAL functions by record-moving-load.mjs) ----------
// BEGIN EXPECTED
export const EXPECTED = {
 "2 spans 100/120, HL93-Truck": {
  "sha256": "06114b04e45c45a67d6fcc9d2a2f99ea9295c3871006973e9cbb51768d0cbe9c",
  "key": {
   "maxPosM": 2850.2581923174944,
   "maxNegM": -2673.5614589229663,
   "maxV": 138.14767879414433,
   "maxR": 223.22483396973595,
   "nodes": 261
  }
 },
 "2 spans 100/120, HL93-Tandem": {
  "sha256": "b34b8e34f4f1561a9a6e14878f77b7a054dc5634ab869d8d219dd62865cc649c",
  "key": {
   "maxPosM": 2417.1422565271264,
   "maxNegM": -1828.5492417574787,
   "maxV": 112.63221135010544,
   "maxR": 155.429674336372,
   "nodes": 261
  }
 },
 "2 spans 100/120, HS20": {
  "sha256": "661e55f0562f60bf5598c0ff43b0e726842cf18ade37520ac9b9e2361604ad86",
  "key": {
   "maxPosM": 1950.6556923119103,
   "maxNegM": -1788.9789029046306,
   "maxV": 94.46604576524801,
   "maxR": 149.15270922482128,
   "nodes": 261
  }
 },
 "2 spans 100/120, H20": {
  "sha256": "93ced038d96d6295496f5d1aa6184626e572717b185c527ac7ad8d49f6a1c441",
  "key": {
   "maxPosM": 1686.3551765044408,
   "maxNegM": -1788.9789029046306,
   "maxV": 94.46604576524801,
   "maxR": 149.15270922482128,
   "nodes": 261
  }
 },
 "2 spans 100/120, E80": {
  "sha256": "6a42bc05e41046fcd02ac768e9f750a93e5afac583ef591fea7e465092152dd9",
  "key": {
   "maxPosM": 19313.87122927535,
   "maxNegM": -20349.21796803958,
   "maxV": 1072.8492711126219,
   "maxR": 1765.0622705370392,
   "nodes": 261
  }
 },
 "2 spans 100/120, E80-Alt": {
  "sha256": "20b41b8278b0992b2e8f41cd6bcb4a7b4f4ccdc582d4a1acdffed2efa1f18a36",
  "key": {
   "maxPosM": 12056.65979153841,
   "maxNegM": -6918.189252019989,
   "maxV": 532.4367842998406,
   "maxR": 556.2897162570224,
   "nodes": 261
  }
 },
 "2 spans 100/120, F40PH": {
  "sha256": "8e6073267f9740319876e9e8591a115dc08f0560f30d7f742d02f851e00bdaa1",
  "key": {
   "maxPosM": 9405.085920169317,
   "maxNegM": -8267.40410787089,
   "maxV": 522.7101150825283,
   "maxR": 761.5856459490286,
   "nodes": 261
  }
 },
 "2 spans 100/120, HSP46": {
  "sha256": "e35abd335079bbab6dfac3a53ec341ded85e65e9205c24d330a8d4bb6469b1dc",
  "key": {
   "maxPosM": 8337.91279432082,
   "maxNegM": -8244.103365627547,
   "maxV": 491.16974696631127,
   "maxR": 712.027177773384,
   "nodes": 261
  }
 },
 "2 spans 100/120, 286K": {
  "sha256": "b20e493f43f1702f83ddf2e033638cce6706c3aa6fee0effed98ee3d0c2e3d47",
  "key": {
   "maxPosM": 14039.10770348923,
   "maxNegM": -10489.308887161289,
   "maxV": 757.777634485169,
   "maxR": 1056.3681287799172,
   "nodes": 261
  }
 },
 "2 spans 100/120, 315K": {
  "sha256": "2089bc67f5ead1efdb8863a9b575ed946a252ddfe301b5bf78f189e574f90daf",
  "key": {
   "maxPosM": 10806.16252379207,
   "maxNegM": -11134.502942055222,
   "maxV": 688.2548129159333,
   "maxR": 997.7486382822464,
   "nodes": 261
  }
 },
 "2 spans 100/120, ES44AC": {
  "sha256": "a5a81ff160150bc1416a05e58311e8882f871fd7ac54e0790744016131de70cc",
  "key": {
   "maxPosM": 11850.417736217387,
   "maxNegM": -13836.659365837622,
   "maxV": 747.9660998334796,
   "maxR": 1180.0922230981894,
   "nodes": 261
  }
 },
 "2 spans 100/120, Fatigue": {
  "sha256": "c7e1ce57ed5cead5bec7a526acee80d2771d3bf3e7e0f4a5cdcb1e4542510971",
  "key": {
   "maxPosM": 1491.6752171487328,
   "maxNegM": -952.1957799386026,
   "maxV": 74.47148336787582,
   "maxR": 80.56496077103621,
   "nodes": 261
  }
 },
 "1 span 100, HL93-Truck": {
  "sha256": "d06b5940bc48c36a1bc99c8a3b6f6e2a217408514fc21da2ecbdeae05a07134d",
  "key": {
   "maxPosM": 2821.600013740638,
   "maxNegM": 0,
   "maxV": 118.8224005603096,
   "maxR": 118.82240056076236,
   "nodes": 241
  }
 },
 "1 span 40, HL93-Tandem": {
  "sha256": "b32986d7b0abff9f53fe70e08ebc02da12202afe3c41bb44cc21393936f3a241",
  "key": {
   "maxPosM": 726.4999927543081,
   "maxNegM": 0,
   "maxV": 75.97499988058219,
   "maxR": 75.97499988061627,
   "nodes": 241
  }
 },
 "3 spans 80/100/80, HL93-Truck": {
  "sha256": "19b272766fe0412ab480a0ddbf704dc0facc6c71b5508a7936383a0926ba4efb",
  "key": {
   "maxPosM": 1727.1582609358325,
   "maxNegM": -1852.8110228526416,
   "maxV": 123.75469686334202,
   "maxR": 184.13388669212395,
   "nodes": 261
  }
 },
 "4 spans 90/110/110/90, HL93-Truck": {
  "sha256": "2502b86182937b606c9bce6460fc5439734193c7c6e1c4098737539266179108",
  "key": {
   "maxPosM": 2032.7631022927521,
   "maxNegM": -2277.5461198206563,
   "maxV": 129.32327136955774,
   "maxR": 204.15006972641308,
   "nodes": 281
  }
 },
 "4 spans 60/60/60/60, Fatigue": {
  "sha256": "0721b270047d799404f70a883cee37fd1c9a42161b172e32700e935156f5a1ca",
  "key": {
   "maxPosM": 543.9149523759886,
   "maxNegM": -408.0356984121624,
   "maxV": 61.9601746030981,
   "maxR": 73.12590337300166,
   "nodes": 241
  }
 },
 "3 spans, 3 segments, HL93-Truck": {
  "sha256": "91f5980123a34395fee29aaf945274c4e20a963ceddde6ffc7ee6fbcb1fe18d2",
  "key": {
   "maxPosM": 1783.758593695406,
   "maxNegM": -2014.0617953440349,
   "maxV": 124.30971345403638,
   "maxR": 188.65762866216062,
   "nodes": 261
  }
 },
 "2 spans, 3 segments, E80": {
  "sha256": "56cf53fbaeaad125db2ccb651007d5d57840216c78aae5afe083eb41c1f1b713",
  "key": {
   "maxPosM": 18457.556262491427,
   "maxNegM": -23300.764127013223,
   "maxV": 1090.3070740958321,
   "maxR": 1812.4911873743724,
   "nodes": 261
  }
 },
 "2 spans, segment with Io, HS20": {
  "sha256": "1abe264fe64c8a67c6376513eb7f3f78d5e558ef08b25d9f880055a90b3dd28c",
  "key": {
   "maxPosM": 1977.7316447199848,
   "maxNegM": -1930.4350425067014,
   "maxV": 95.32792293261598,
   "maxR": 150.93471925214112,
   "nodes": 261
  }
 },
 "3 spans, HS20 Std. Spec. impact": {
  "sha256": "0863cdd8d2ee6e050f32854a761711ef1f000257ba56b4f7aea74b418445ce10",
  "key": {
   "maxPosM": 1029.552807728569,
   "maxNegM": -907.3692575147362,
   "maxV": 82.06732164099495,
   "maxR": 107.70411272368341,
   "nodes": 261
  }
 },
 "2 spans, HL93-Truck, neg DF, one direction, no neglect": {
  "sha256": "e2237fe7f317bf91c48d1d2babe20a2e3130216c78a461d64a680c2c15b70655",
  "key": {
   "maxPosM": 2850.2581923174944,
   "maxNegM": -2673.2945018699743,
   "maxV": 138.14767879414433,
   "maxR": 223.22017254803345,
   "nodes": 261
  }
 },
 "2 spans, HL93-Truck, full-length UDL, impact on UDL": {
  "sha256": "8c44f207c00de964f046212b75882a5296fd45c84c730f1235eeeb01b97c9aae",
  "key": {
   "maxPosM": 2938.830912888972,
   "maxNegM": -2968.168437244386,
   "maxV": 153.5475211807073,
   "maxR": 249.53476190334314,
   "nodes": 261
  }
 },
 "2 spans, HL93-Truck, refine off": {
  "sha256": "ea5f38250314d5629728d280c213f1e887bde8697887c1f668097153d14fd500",
  "key": {
   "maxPosM": 2850.2581923174944,
   "maxNegM": -2673.384691850238,
   "maxV": 138.14767879414433,
   "maxR": 223.22296921615484,
   "nodes": 261
  }
 },
 "2 spans, HL93-Truck, step 0.5, hStep 1": {
  "sha256": "11c13c44f1655897669f1b3ebb2af2ac98f2661e1132ea439cc7ba75948335fa",
  "key": {
   "maxPosM": 2850.2581923174944,
   "maxNegM": -2673.560637262682,
   "maxV": 138.14767879414433,
   "maxR": 223.22483396973595,
   "nodes": 261
  }
 },
 "3 spans, E80, AREMA L = span": {
  "sha256": "c07485db902d6c4f810686d8472c91dacd9deb7cb64e2a14c039c2fd74bd4fb0",
  "key": {
   "maxPosM": 6178.9210262157185,
   "maxNegM": -8319.88477615904,
   "maxV": 740.566708701286,
   "maxR": 1214.9669650992748,
   "nodes": 261
  }
 },
 "3 spans, E80, AREMA L = max, ballasted": {
  "sha256": "6b4b8e84bfd7add137d0fe28060cd786427e321d8c0f6b72d93614536ce199a2",
  "key": {
   "maxPosM": 5991.96225696756,
   "maxNegM": -7912.932998196629,
   "maxV": 718.159003566762,
   "maxR": 1155.539102825321,
   "nodes": 261
  }
 },
 "3 spans, F40PH, AREMA L = total": {
  "sha256": "af19e6385505e0bdd07d7d8cd07cfa19ea023814da3624d27f534f70ff3d53e1",
  "key": {
   "maxPosM": 2891.118249730622,
   "maxNegM": -3741.788595904755,
   "maxV": 366.3288751478533,
   "maxR": 536.1835006686459,
   "nodes": 261
  }
 },
 "2 spans, ES44AC, AREMA user L 75": {
  "sha256": "c1170137e8208ed5462c579ba5fe159dcd6b7780ddcd23726c8bf8d75a470b36",
  "key": {
   "maxPosM": 12432.97202332324,
   "maxNegM": -14429.751426892331,
   "maxV": 784.7353401899736,
   "maxR": 1230.6754824187144,
   "nodes": 261
  }
 },
 "2 spans, E80, trailing load truncated": {
  "sha256": "89a2ba772e077977068abfc933fcc2dbbc3939d1198c8b285dbf029fc008092e",
  "key": {
   "maxPosM": 19313.87122927535,
   "maxNegM": -20349.21796803958,
   "maxV": 1072.8492711126219,
   "maxR": 1765.0622705370392,
   "nodes": 261
  }
 },
 "2 spans, HL93-Truck, multi fixed 0 (variable), Hmin 30": {
  "sha256": "5c5d96051386c29cbbd5522e06f87224e55fc0b63885bb7160323103d2638d45",
  "key": {
   "maxPosM": 2850.2581923174944,
   "maxNegM": -2673.5614589229663,
   "maxV": 138.14767879414433,
   "maxR": 235.3567109308117,
   "nodes": 261
  }
 },
 "1 span 150, H20 Std. lane": {
  "sha256": "5eb67112a7d28f4846815f4a9e55daa337bb055779998d6fcaa2d5682e8bbd9e",
  "key": {
   "maxPosM": 3217.4999971693514,
   "maxNegM": 0,
   "maxV": 96.19999998112098,
   "maxR": 96.19999998097519,
   "nodes": 241
  }
 },
 "2 spans, HS20 with secondary HL93-Tandem": {
  "sha256": "ef9908e990b583e872625698dd37e151cc830fe673271257c445acc97b313b6d",
  "key": {
   "maxPosM": 1950.6556923119103,
   "maxNegM": -1788.9789029046306,
   "maxV": 94.46604576524801,
   "maxR": 149.15270922482128,
   "nodes": 261
  }
 },
 "2 spans, HL93-Truck, warnings (bad var. axle, zero DF, impact < 1)": {
  "sha256": "bca4f52e794d23cd2e9eb59abcf733439f947f07b5fd05d5bf938bec1fdb8c07",
  "key": {
   "maxPosM": 2205.0413094758624,
   "maxNegM": -2097.8098746373466,
   "maxV": 108.57095654609918,
   "maxR": 176.83081499307966,
   "nodes": 261
  }
 },
 "2 spans, HL93-Truck, deflection: vehicle as configured, no impact": {
  "sha256": "ccbb48063cf4ca116d9ddbf42024900ef766f1d7c63286d6871a0e3ce1d3c15e",
  "key": {
   "maxPosM": 2850.2581923174944,
   "maxNegM": -2673.5614589229663,
   "maxV": 138.14767879414433,
   "maxR": 223.22483396973595,
   "nodes": 261
  }
 }
};
// END EXPECTED

// ---------- tests ----------
test('vehicle presets: same keys, order and values as the original page', () => {
  let O; try { O = originalEngine(); } catch (e) { return; }   // no git history: covered by the hashes below
  const S = sharedEngine();
  assert.equal(JSON.stringify(plain(S.P)), JSON.stringify(plain(O.P)));
});

test(`${CASES.length} cases: shared engine output hash = the original's (recorded)`, () => {
  const S = sharedEngine(), bad = [];
  assert.equal(Object.keys(EXPECTED).length, CASES.length, 'EXPECTED is not recorded for every case');
  for (const c of CASES) {
    const out = runCase(S, c), h = sha(canon(out)), e = EXPECTED[c[0]];
    if (!e || h !== e.sha256) bad.push(`${c[0]}: ${h} vs ${e && e.sha256}`);
    else assert.deepEqual(keyValues(out), e.key);
  }
  assert.deepEqual(bad, []);
});

test('live comparison with the original inline functions (git history)', () => {
  let O; try { O = originalEngine(); } catch (e) { console.log('       (skipped: ' + e.message.split('\n')[0] + ')'); return; }
  const S = sharedEngine();
  for (const c of [CASES[0], CASES[13], CASES[17], CASES[24]]) {   // a sample; the hash test covers every case
    assert.equal(canon(runCase(S, c)), canon(runCase(O, c)), c[0]);
  }
});
