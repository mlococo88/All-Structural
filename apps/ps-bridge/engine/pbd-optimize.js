/* apps/ps-bridge/engine/pbd-optimize.js — optimizeStrands, sweepDesign (end of the text/babel block's engine part).
   MOVED UNCHANGED from the old app (docs/ps-bridge-plan.md §3, PR 2a; engineer decision PS-6): the code below the PBD-VERBATIM line is
   lines 4572-4629 of "Prestressed Bridge Design.html" at commit 8fe8650275b7fc7377fdb87685d3bf0d669a4aa8, byte for byte. Do not edit it here: a change to the
   engine is a later PR of its own (CLAUDE.md §4), made with the slice and this header updated together.
   Classic script, no DOM. Global names it defines, as on the old page (the moved engine keeps its own globals, plan §2.1; a
   planned later cleanup moves them under one namespace): optimizeStrands, sweepDesign.
   Tests: tests/engine/psbridge-verbatim.test.mjs (this body = that slice), tests/engine/psbridge-parity.test.mjs (results = the old page's). */
/* ---- PBD-VERBATIM: the code below is the slice named above, byte for byte; do not edit it ---- */
/* ================= STRAND OPTIMIZER ================= */
// Sweeps total bonded strand count (filling bottom rows on a 2in grid) + harp count,
// returns lightest passing pattern by max governing D/C across the core checks.
function optimizeStrands(baseInp){
  const results=[];
  const st=STRANDS[baseInp.str.size];
  const g0=girderGross(baseInp);
  const maxPerRow=Math.floor((g0.bbf-4)/2)+1;
  const rowYs=[2,4,6,8,10,12];                       // candidate bottom rows
  const tryPattern=(Nbond,Nharp)=>{
    // distribute Nbond into rows bottom-up
    const rows=[]; let rem=Nbond;
    for(const y of rowYs){ if(rem<=0)break; const n=Math.min(maxPerRow,rem); rows.push({n,y,dbnd:0}); rem-=n; }
    if(rem>0)return null;                             // doesn't fit
    const inp={...baseInp, rows, harp:{...baseInp.harp, n:Nharp}};
    const R=computeAll(inp);
    if(R.error)return null;
    const core=R.checks.filter(c=>!/Deck|Lifting|Hauling|FS/.test(c.n));
    const maxDC=Math.max(...core.map(c=>c.r));
    const pass=core.every(c=>c.pass);
    return {Nbond,Nharp,Ntot:Nbond+Nharp,rows,maxDC,pass,
            flexDC:R.checks.find(c=>c.n==='Flexure').r,
            s3DC:R.checks.find(c=>c.n==='Srv III tens').r,
            relDC:R.checks.find(c=>c.n==='Release comp').r,
            shearDC:R.checks.find(c=>c.n==='Shear').r};
  };
  const baseHarp=+baseInp.harp.n||0;
  for(let Nb=8;Nb<=Math.min(maxPerRow*rowYs.length,60);Nb+=2){
    for(const Nh of [0,baseHarp,Math.max(baseHarp,8),12,16]){
      if(results.some(r=>r.Nbond===Nb&&r.Nharp===Nh))continue;
      const r=tryPattern(Nb,Nh); if(r)results.push(r);
    }
  }
  results.sort((a,b)=>a.Ntot-b.Ntot || a.maxDC-b.maxDC);
  const lightest=results.find(r=>r.pass)||null;
  return {results,lightest,maxPerRow};
}

/* ================= MULTI-SPAN / GIRDER SWEEP ================= */
function sweepDesign(baseInp,mode,values){
  return values.map(v=>{
    const inp=JSON.parse(JSON.stringify(baseInp));
    if(mode==='span') inp.L=v;
    else if(mode==='girder') inp.girder=v;
    else if(mode==='spacing') inp.S=v;
    const R=computeAll(inp);
    if(R.error)return {v,error:R.error};
    const core=R.checks.filter(c=>!/Deck|Lifting|Hauling|FS/.test(c.n));
    return {v, pass:core.every(c=>c.pass),
            maxDC:Math.max(...core.map(c=>c.r)),
            flex:R.checks.find(c=>c.n==='Flexure').r,
            s3:R.checks.find(c=>c.n==='Srv III tens').r,
            rel:R.checks.find(c=>c.n==='Release comp').r,
            shear:R.checks.find(c=>c.n==='Shear').r,
            camber:R.cam.final, nPass:core.filter(c=>c.pass).length, nTot:core.length};
  });
}

