// GirderDetail's Structural analysis (GM.sa.compute in "Steel Bridge Design.html") for the inputs of an sbd2 project, built
// from GirderDetail's own functions (gd-source.mjs gdAnalysis: sgBeam, feStages, sgLLRow, feIM, feFatIM, saComp, saCracked,
// steelProps, saSeq). GM.sa.compute itself reads the whole page state (Preliminary sizing's bridge, the LLDF module), so the
// lines of compute that turn those functions' results into the station demands are repeated here, in the same order and
// with the same expressions (anchors: `const wSt = xs.map(`, `const SP = x =>`, `const MofB =`, `const Mperm =`,
// `const Mu = MofB(bN, 1)`, `for (let i = 0; i < N; i++) { const si = spanOf(xs[i])`, `const vSec =`, `const reac = sup.map(`,
// `const cOf = I =>`, `const lld = spans.map(`). Only what the new engine computes is repeated (no combinations, no
// pedestrian load, no utilities other than UT in the permanent moment and the camber).
// Input: the sbd2 project (one girder) with girder.loads and girder.df filled; the deck reinforcement as GirderDetail has it,
// one area A_r at mid-depth of the slab (project.deck.rebar.top.A + bot.A).
import { gdAnalysis } from './gd-source.mjs';

export function gdSA(P, gi, n) {   // n: the modular ratio (as the new engine's, SBDSections.modularRatio)
  const GA = gdAnalysis(), c = GA.ctx;
  return GA.run(() => {
    const g = P.girders[gi], A = P.analysis || {}, spans = P.spans.lengths, cont = P.spans.continuity !== 'simple' && spans.length > 1;
    const b0 = c.sgBeam(spans, !cont), { xs, N, sup, trib } = b0;
    const beff = g.beff, ts = P.deck.ts, hh = A.haunchInStiffness === false ? 0 : P.deck.haunch, Ar = P.deck.rebar.top.A + P.deck.rebar.bot.A;
    const L = g.loads || {}, D = g.df || { spans: spans.map(() => ({ gM: 1, gV: 1, fatM: 1, fatV: 1 })), piers: [], gDef: 1 },   // no factors entered: 1 (as the engine)
      allow = L.steelAllowPct != null ? L.steelAllowPct : 5, im = (A.im != null ? A.im : 33) / 100, imf = (A.imf != null ? A.imf : 15) / 100;
    const sAt = x => { const z = g.segments.find(s => x >= s.x0 - 1e-9 && x <= s.x1 + 1e-9) || g.segments[g.segments.length - 1]; return { D: z.D, tw: z.tw, topB: z.topB, topT: z.topT, botB: z.botB, botT: z.botT }; };
    const wSt = xs.map(x => { const s = sAt(x); return (s.topB * s.topT + s.botB * s.botT + s.D * s.tw) * 3.4 / 1000 * (1 + allow / 100); });
    const wXF = new Float64Array(N); (L.xf || []).forEach(p => { let e = 0; while (e < N - 2 && xs[e + 1] < p.x - 1e-9) e++; const t = Math.max(0, Math.min(1, (p.x - xs[e]) / (xs[e + 1] - xs[e]))); wXF[e] += p.P * (1 - t) / trib[e]; wXF[e + 1] += p.P * t / trib[e + 1]; });   // gdXfNodal
    const wSX = wSt.map((w, q) => w + wXF[q]), wDeck = L.DC1wet || 0, w1 = wSX.map(w => w + wDeck), wDC2 = L.DC2 || 0, wDW = L.DW || 0, wUT = L.UT || 0, wCL = L.CL || 0;
    const SP = x => { const s = sAt(x); return { Is: c.steelProps(s.D, s).I, I3u: c.saComp(s, beff, 3 * n, ts, hh), Inu: c.saComp(s, beff, n, ts, hh), Icr: c.saCracked(s, Ar, ts, hh) }; };
    const F = c.feStages(b0, spans, cont, SP, A.crack || 'none', w1, wDC2 + wDW), bS = F.bS, b3 = F.b3, bN = F.bN;
    const MofB = (bm, w) => { const M = new Float64Array(N); for (let i = 0; i < N; i++) { let t = 0; const r = i * N; for (let q = 0; q < N; q++) t += bm.ILM[r + q] * (typeof w === 'number' ? w : w[q]) * trib[q]; M[i] = t; } return M; };
    const VofB = (bm, w) => { const V = new Float64Array(N - 1); for (let e = 0; e < N - 1; e++) { let t = 0; const r = e * N; for (let q = 0; q < N; q++) t += bm.ILV[r + q] * (typeof w === 'number' ? w : w[q]) * trib[q]; V[e] = t; } return V; };
    const MS = MofB(bS, wSX), MDk = MofB(bS, wDeck), MDC1 = MS.map((v, i) => v + MDk[i]), MDC2 = MofB(b3, wDC2), MDW = MofB(b3, wDW), MUT = wUT ? MofB(bS, wUT) : null;
    const VDC1 = VofB(bS, w1), VDC2 = VofB(b3, wDC2), VDW = VofB(b3, wDW), VS = VofB(bS, wSX), MCL = MofB(bS, wCL), VCL = VofB(bS, wCL);
    const Mperm = MDC1.map((v, i) => v + MDC2[i] + MDW[i] + (MUT ? MUT[i] : 0)), region = new Int16Array(N).fill(-1);
    for (let k = 1; k < sup.length - 1 && cont; k++) { let l = sup[k], r = sup[k]; while (l > 0 && Mperm[l - 1] < 0) l--; while (r < N - 1 && Mperm[r + 1] < 0) r++; for (let i = l; i <= r; i++) region[i] = k; }
    const Mu = MofB(bN, 1), tw2 = Uint8Array.from(region, (rg, i) => rg >= 1 || (cont && Mu[i] < -1e-9 * b0.Ltot ** 2) ? 1 : 0);
    const spanOf = x => { let a = 0; for (let i = 0; i < spans.length; i++) { if (x <= a + spans[i] + 1e-9) return i; a += spans[i]; } return spans.length - 1; };
    const memS = i => D.spans[i], memP = k => ({ gM: D.piers[k - 1] ? D.piers[k - 1].gM : D.spans[k - 1].gM });
    const LLp = new Float64Array(N), LLn = new Float64Array(N), FMp = new Float64Array(N), FMn = new Float64Array(N);
    for (let i = 0; i < N; i++) { const si = spanOf(xs[i]), rg = region[i], m = rg >= 1 ? memP(rg) : memS(si), ll = c.feIM(bN.MLL[i], im), ft = c.feFatIM(bN.MF[i], imf);
      LLp[i] = m.gM * ll.pos; LLn[i] = m.gM * Math.min(ll.neg, tw2[i] ? ll.neg2 : 0); const fm = memS(si).fatM; FMp[i] = fm * ft.max; FMn[i] = fm * ft.min; }
    const vSec = (e, r) => { const m = memS(spanOf((xs[e] + xs[e + 1]) / 2)), s = r ? bN.VLLr[e] : bN.VLL[e], lv = c.feIM(s, im), fv = c.feFatIM(r ? bN.VFr[e] : bN.VF[e], imf);
      return { Lp: m.gV * lv.pos, Ln: m.gV * lv.neg, Fp: m.fatV * fv.max, Fn: m.fatV * fv.min }; };
    const rows = bm => sup.map(s => { const row = new Float64Array(N); for (let q = 0; q < N; q++) row[q] = (s < N - 1 ? bm.ILV[s * N + q] : 0) - (s > 0 ? bm.ILV[(s - 1) * N + q] : 0) + (q === s ? 1 : 0); return row; });
    const rS = rows(bS), r3 = rows(b3), rN = rows(bN), dot = (row, w) => { let t = 0; for (let q = 0; q < N; q++) t += row[q] * (typeof w === 'number' ? w : w[q]) * trib[q]; return t; };
    const reac = sup.map((s, k) => { const adj = [k - 1, k].filter(i => i >= 0 && i < spans.length), gV = Math.max(...adj.map(i => memS(i).gV)), interior = k > 0 && k < sup.length - 1;
      const e = c.feIM(c.sgLLRow(bN, rN[k]), im); return { DC1: dot(rS[k], w1), DC2: dot(r3[k], wDC2), DW: dot(r3[k], wDW), CL: dot(rS[k], wCL), llMax: gV * (interior ? Math.max(e.pos, e.pos2) : e.pos), llMin: gV * e.neg }; });
    const ES = 29000, cOf = I => I.map((v, i) => trib[i] * 1728 / (ES * v)), nodeI = arr => xs.map((_, i) => { const a = i > 0 ? arr[i - 1] : arr[0], cc = i < N - 1 ? arr[i] : arr[N - 2]; return (a + cc) / 2; });
    const cS = cOf(nodeI(F.Is)), c3 = cOf(nodeI(F.I3)), cN = cOf(nodeI(F.In));
    const defl = (M, cc) => { const d = new Float64Array(N); for (let x = 0; x < N; x++) { let t = 0; for (let k = 0; k < N; k++) t += M[k] * b0.ILM[k * N + x] * cc[k]; d[x] = t; } return d; };
    const dS = defl(MS, cS), dDk = defl(MDk, cS), dSD = defl(MDC2.map((v, i) => v + MDW[i]), c3);
    const lld = spans.map((Ls, k) => { let best = null; const gD = D.gDef;
      for (let i = sup[k] + 1; i < sup[k + 1]; i++) { if ((i - sup[k]) % 2) continue; const row = new Float64Array(N); for (let q = 0; q < N; q++) { let t = 0; for (let r = 0; r < N; r++) t += b0.ILM[r * N + i] * bN.ILM[r * N + q] * cN[r]; row[q] = t; }
        const e = c.sgLLRow(bN, row), dT = (1 + im) * e.truckMax, dL = 0.25 * dT + e.lanePos, d = Math.max(dT, dL) * gD; if (!best || d > best.d) best = { x: xs[i], d, dT, dL, gD }; }
      return { k, Ls, lim: Ls * 12 / (A.deflLimit || 800), ...best }; });
    // the deck placement sequence: GirderDetail's own saSeq on the R fields it reads
    const plates = { D: g.segments[0].D, top: g.segments.map(s => ({ x0: s.x0, x1: s.x1, b: s.topB, t: s.topT })), bot: g.segments.map(s => ({ x0: s.x0, x1: s.x1, b: s.botB, t: s.botT })), web: g.segments.map(s => ({ x0: s.x0, x1: s.x1, t: s.tw })) };
    const SQ = cont ? c.saSeq({ p: { seqOn: A.seq || 'on', seqMod: A.seqMod || 'n', seqCustom: A.seqCustom || '' }, cont, xs, trib, spans, n, beff, b: { tsDeck: ts, haunch: hh, plates, fc: P.materials.concrete.fc }, F, MDC1, wSX, wDeck }) : null;
    const MDCc = SQ ? Array.from(MDC1).map((v, i) => v >= 0 ? Math.max(v, SQ.envP[i]) : Math.min(v, SQ.envN[i])) : null;
    return { xs: Array.from(xs), N, sup: Array.from(sup), region, tw2, crack: F.crack, Mperm, MS, MDk, MDC1, MDC2, MDW, MCL, VDC1, VDC2, VDW, VS, VCL, LLp, LLn, FMp, FMn, vSec, VLL: bN.VLL, reac, dS, dDk, dSD, lld, SQ, MDCc, n };
  });
}
