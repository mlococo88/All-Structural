/* apps/ps-bridge/engine/pbd-library.js — girder library GIRDERS, STRANDS, fmt, clamp, bridgeNav, sqrt, DEFAULTS (start of the text/babel block's engine part).
   MOVED UNCHANGED from the old app (docs/ps-bridge-plan.md §3, PR 2a; engineer decision PS-6): the code below the PBD-VERBATIM line is
   lines 2429-2536 of "Prestressed Bridge Design.html" at commit 8fe8650275b7fc7377fdb87685d3bf0d669a4aa8, byte for byte. Do not edit it here: a change to the
   engine is a later PR of its own (CLAUDE.md §4), made with the slice and this header updated together.
   Classic script, no DOM. Global names it defines, as on the old page (the moved engine keeps its own globals, plan §2.1; a
   planned later cleanup moves them under one namespace): GIRDERS, STRANDS, fmt, clamp, bridgeNav, sqrt, DEFAULTS.
   Tests: tests/engine/psbridge-verbatim.test.mjs (this body = that slice), tests/engine/psbridge-parity.test.mjs (results = the old page's). */
/* ---- PBD-VERBATIM: the code below is the slice named above, byte for byte; do not edit it ---- */
/* ================= GIRDER LIBRARY (gross properties per PCI/AASHTO) ================= */
const GIRDERS = {
  'AASHTO Type I' :{h:28,A:276 ,I:22750 ,yb:12.59,bw:6,btf:12,bbf:16,d:[4,3,5,5]},
  'AASHTO Type II':{h:36,A:369 ,I:50980 ,yb:15.83,bw:6,btf:12,bbf:18,d:[6,3,6,6]},
  'AASHTO Type III':{h:45,A:560,I:125390,yb:20.27,bw:7,btf:16,bbf:22,d:[7,4.5,7,7.5]},
  'AASHTO Type IV':{h:54,A:789 ,I:260730,yb:24.73,bw:8,btf:20,bbf:26,d:[8,6,8,9]},
  'AASHTO Type V' :{h:63,A:1013,I:521180,yb:31.96,bw:8,btf:42,bbf:28,d:[5,7,8,10]},
  'AASHTO Type VI':{h:72,A:1085,I:733320,yb:36.38,bw:8,btf:42,bbf:28,d:[5,7,8,10]},
  'PCI BT-54':{h:54,A:659,I:268077,yb:27.63,bw:6,btf:42,bbf:26,d:[3.5,2,6,4.5]},
  'PCI BT-63':{h:63,A:713,I:392638,yb:32.12,bw:6,btf:42,bbf:26,d:[3.5,2,6,4.5]},
  'PCI BT-72':{h:72,A:767,I:545894,yb:36.60,bw:6,btf:42,bbf:26,d:[3.5,2,6,4.5]},
  // PCINER NEXT F (double-tee) beams. Properties vary with top-flange (deck) width between
  // the minimum (96") and maximum (144") tabulated values; girderGross interpolates by inp.S.
  // wMin/wMax = nominal flange widths (in); props given at each. Stem geometry constant.
  // depth d, stem bottom width B, c/c stems = 60", flange thickness ~ depth-of-stem dependent.
  'NEXT 24F':{next:true,h:24,B:13.75,wMin:96,wMax:144,
    pMin:{A:972, I:51905, yb:14.94,yt:9.06}, pMax:{A:1164,I:60159, yb:16.10,yt:7.90},
    flangeT:8, strandRow:'2.875'},
  'NEXT 28F':{next:true,h:28,B:13.50,wMin:96,wMax:144,
    pMin:{A:1082,I:80037, yb:17.23,yt:10.77},pMax:{A:1274,I:88218, yb:18.55,yt:9.45},
    flangeT:8, strandRow:'2.75'},
  'NEXT 32F':{next:true,h:32,B:13.25,wMin:96,wMax:144,
    pMin:{A:1190,I:116036,yb:19.50,yt:12.50},pMax:{A:1382,I:134523,yb:20.96,yt:11.04},
    flangeT:8, strandRow:'2.625'},
  'NEXT 36F':{next:true,h:36,B:13.00,wMin:96,wMax:144,
    pMin:{A:1296,I:160602,yb:21.75,yt:14.25},pMax:{A:1488,I:186000,yb:23.34,yt:12.66},
    flangeT:8, strandRow:'2.5'},
  // ---- AASHTO adjacent BOX beams (BI–BIV). Hollow rectangular sections placed side-by-side
  //      (typically with a composite topping). Published gross properties; void gives the web
  //      width for shear as 2×wall. w = section width, h = depth. bw = 2 exterior walls (5" each).
  'AASHTO BI-36 (12in)':{box:true,h:12,w:36,A:560, I:12897, yb:6.00, bw:10, wall:5, voidW:26, voidH:5},
  'AASHTO BII-36 (18in)':{box:true,h:18,w:36,A:693, I:36434, yb:9.00, bw:10, wall:5, voidW:26, voidH:11},
  'AASHTO BIII-36 (27in)':{box:true,h:27,w:36,A:812, I:97756, yb:13.14,bw:10, wall:5, voidW:26, voidH:20},
  'AASHTO BIV-48 (33in)':{box:true,h:33,w:48,A:1097,I:200631,yb:16.11,bw:10, wall:5, voidW:38, voidH:26},
  // ---- Adjacent DECK / SLAB beams. Solid or voided rectangular units placed edge-to-edge, acting
  //      as the riding surface (often with a thin topping). Solid: full rectangle; voided: round
  //      voids reduce A and I (published values used). bw = solid width between/around voids.
  'Deck slab 12×48 (solid)':{deck:true,h:12,w:48,A:576, I:6912,  yb:6.00, bw:48, solid:true},
  'Deck slab 18×48 (solid)':{deck:true,h:18,w:48,A:864, I:23328, yb:9.00, bw:48, solid:true},
  'Deck slab 21×48 (voided)':{deck:true,h:21,w:48,A:807, I:41058, yb:10.50,bw:24, voids:2, voidD:12},
  'Deck slab 27×48 (voided)':{deck:true,h:27,w:48,A:1041,I:83743, yb:13.50,bw:24, voids:2, voidD:16},
  'Custom':{custom:true}
};
const STRANDS = {'0.5 in':{Ab:0.153,db:0.5},'0.6 in':{Ab:0.217,db:0.6},'0.7 in':{Ab:0.294,db:0.7}};
const fmt=(v,d=2)=>!isFinite(v)?'—':v.toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d});
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
// Navigate between suite apps. When embedded inside the MCT window, ask the parent to switch
// which app is shown (stay in one window); when standalone, open/return normally.
function bridgeNav(app){
  try{ if(window.self!==window.top){ window.parent.postMessage({source:'bridge-suite',embed:app||null},'*'); return; } }catch(e){}
  // Standalone: go to the file where that app was last seen, not to a guessed
  // name -- these links break the moment a file is called anything else.
  var A=window.BridgeApps;
  var file=A?A.href(app||'mct'):(app?(app==='lldf'?'lldf.html':app+'.html'):'index.html');
  var url=encodeURI(file);
  if(!app){ window.location.href=url; } else { window.open(url,'_blank'); }
}
const sqrt=Math.sqrt;

/* ================= DEFAULT INPUTS ================= */
const DEFAULTS = {
  proj:{name:'Example Bridge — Span 2',girderId:'G3 (Interior)',by:'MLC',date:new Date().toISOString().slice(0,10),job:''},
  girder:'PCI BT-72',
  cust:{h:72,A:767,I:545894,yb:36.6,bw:6,btf:42,bbf:26},
  // Optional per-property overrides of the gross section — blank keeps the shape value.
  ovr:{on:false, A:'', I:'', yb:'', Sb:'', St:'', wsw:''},
  L:120, S:9.0, beffAuto:true, beff:108, ts:8.0, th:2.0, tsSeparate:false, tsDL:8.0, haunchInProps:false, nGirders:5,
  mat:{fci:6.8, fc:8.5, fcd:4.0, wc:0.145, wcLoad:0.155, wcd:0.150, wcdLoad:0.150, H:70, VS:3.0, ti:1, td:90, tfin:20000},
  str:{size:'0.6 in', fpu:270, lowlax:true, jack:0.75, Ep:28500},
  rows:[{n:10,y:2,dbnd:0,nd:0},{n:10,y:4,dbnd:0,nd:0},{n:8,y:6,dbnd:0,nd:0}],
  harp:{n:12, yEnd:60, yMid:8, frac:0.40},
  loads:{wNC:0.10, wBar:0.30, wDW:0.25, llAuto:true, MLL:0, VLL:0, dfm:0, dfv:0, dfAuto:true,
         pos:'interior', posAuto:true, de:2.0, NL:2, skew:0, diaph:[], fatM:0,   // posAuto: follow the shared design beam
         extDFpos:1.0, extDFneg:1.0, extDFv:1.0, extLLmpf:1.0},   // DF per effect (+M/−M/V) and MPF applied to imported (MIDAS) LL; fatM = single-lane fatigue DF override (0 = auto); impact already in imported LL
  cont:{on:false, As:16.0, dTop:4.5, fy:60, restraint:true},
  // User-entered rating vehicles (legal / permit). The user supplies the fully-factored live-load
  // moment and shear (LLDF, impact, MPF and the LRFR live-load factor already applied), plus the
  // resistance side is the app's φMn / φVn. RF = (capacity − DL) / (entered factored LL).
  rateVeh:[],
  handling:{on:false, aLift:4.0, aHaul:6.0, ei:0.25, sweep:0.000167, fr:0.0,
            zo:0, hr:24, ag:0.02, theta_i:0.01, gFactor:0.0},
  deck:{on:false, method:'strip', oh:3.0, fyd:60, barTop:0.31, barBot:0.31, sTop:6, sBot:6,
        coverT:2.5, coverB:1.0, wsFut:0.025,
        bBar:18, wBar:0.30,          // barrier base width (in) and weight (klf of edge)
        xnegAuto:true, xneg:0},      // −M design section from girder CL (in); auto per 4.6.2.1.6
  opt:{lossMethod:'refined', relBondedReinf:true, corrosion:'normal', gLLs3:0.8, dfpSS:0, dfpSSauto:true, useTrans:false,
       stirAv:0.40, fy:60, sEnd:6, endZoneLen:0.25, sInt:18,
       // Bonded auxiliary reinforcement in the release-tension zone (5.9.2.3.1b). Provided area
       // As and its yield fy; the 0.24√f'ci limit is only justified where this steel is enough
       // to carry the concrete tensile force at a stress of 0.5fy ≤ 30 ksi.
       relAs:0.62, relFy:60,
       relCfac:0.65,              // release compression limit = relCfac·f'ci (Art. 5.9.2.3.1a: 0.65; some owners use 0.60)
       rtPhiC:1.0, rtPhiS:1.0,    // LRFR condition factor φc and system factor φs (MBE 6A.4.2.3 / 6A.4.2.4); product floored at 0.85
       splitAv:0.31, splitN:12, splitFy:60,   // provided anchorage-zone (splitting) steel within h/4: area per leg (#5≈0.31), number of legs, fy (stress limited to 20 ksi in check)
       // confinement steel (5.9.4.4.2) enclosing the strands in the bottom flange within 1.5d of
       // the end: bar designation no., spacing (in), and number of bars provided from the end.
       // Shipped default is #4 @ 6" x 19 bars = 108" covered, which is exactly 1.5d on the BT-72.
       confBar:4, confS:6, confN:19,
       Lpad:12,   // bearing pad length in the longitudinal direction (in). The 5.7.3.5 bearing check
                  //  sits at the inside edge of the pad = Lpad/2 from the bearing CL.
       endOh:0,   // girder length beyond the bearing CL (in). The strands develop from the girder
                  //  END, so this overhang adds to the development length available at every
                  //  section for the 5.7.3.5 tie. Default 0 keeps the free end at the bearing.
       longAsBot:6.0, longFy:60,   // bottom mild longitudinal steel for the 5.7.3.5 tie (positive-moment / bearing region), As·fy where developed. End-region bottom bars satisfy the tie at the bearing where strands are undeveloped.
       mult:{psE:1.80,swE:1.85,psF:2.20,swF:2.40,dkF:2.30,sdF:3.00}},
  external:null
};

