/* apps/ps-bridge/engine/pbd-external.js — MIDAS demands buildExternal / externalSpans, superReactions payload bxSuperRxPayload, contUnit.
   MOVED UNCHANGED from the old app (docs/ps-bridge-plan.md §3, PR 2a; engineer decision PS-6): the code below the PBD-VERBATIM line is
   lines 3296-3427 of "Prestressed Bridge Design.html" at commit 8fe8650275b7fc7377fdb87685d3bf0d669a4aa8, byte for byte. Do not edit it here: a change to the
   engine is a later PR of its own (CLAUDE.md §4), made with the slice and this header updated together.
   Classic script, no DOM. Global names it defines, as on the old page (the moved engine keeps its own globals, plan §2.1; a
   planned later cleanup moves them under one namespace): buildExternal, externalSpans, bxSuperRxPayload, contUnit.
   Tests: tests/engine/psbridge-verbatim.test.mjs (this body = that slice), tests/engine/psbridge-parity.test.mjs (results = the old page's). */
/* ---- PBD-VERBATIM: the code below is the slice named above, byte for byte; do not edit it ---- */
/* ================= COMPUTE ALL ================= */
/* ================= EXTERNAL DEMANDS (MIDAS import) ================= */
// Build interpolators over a selected span's station slice. Stations are re-zeroed to the
// span's left bearing. Returns component moment/shear functions in kip-in / kip at x (ft).
function buildExternal(ext, L, llf){
  if(!ext||!ext.stations||!ext.stations.length) return null;
  // per-effect LL adjustment factors (DF·IM·MPF for each); default 1.0
  const f=llf||{}; const fPos=isFinite(f.pos)?f.pos:1, fNeg=isFinite(f.neg)?f.neg:1, fV=isFinite(f.v)?f.v:1;
  const sel = ext._selSpan || {x0:0, x1:(ext.member&&ext.member.totalLength)||L, idx:0, len:L};
  // slice + re-zero to span; keep stations within [x0,x1]
  const slice = ext.stations
    .filter(s=>s.x>=sel.x0-1e-6 && s.x<=sel.x1+1e-6)
    .map(s=>({...s, xr:s.x-sel.x0}))
    .sort((a,b)=>a.xr-b.xr);
  if(slice.length<2) return null;
  const spanLen = sel.len || (sel.x1-sel.x0);
  // linear interpolation by re-zeroed station, clamped at ends
  const interp=(key,xf)=>{
    const x=clamp(xf,0,spanLen);
    if(x<=slice[0].xr) return +slice[0][key]||0;
    if(x>=slice[slice.length-1].xr) return +slice[slice.length-1][key]||0;
    for(let i=0;i<slice.length-1;i++){const a=slice[i],b=slice[i+1];
      if(x>=a.xr&&x<=b.xr){const t=(x-a.xr)/Math.max(b.xr-a.xr,1e-9);
        return (+a[key]||0)+((+b[key]||0)-(+a[key]||0))*t;}}
    return +slice[slice.length-1][key]||0;
  };
  // moment funcs return kip-in (engine convention); shear returns kip
  const k12=(key)=>(xf)=>interp(key,xf)*12;
  return {
    spanLen, slice, sel,
    // MIDAS reports element shear on the OPPOSITE sign convention to this app's closed-form VofW
    // (which is +V at the left support for gravity load, following V = dM/dx). Left unflipped, an
    // imported DC2/DW shear reads NEGATIVE at the bearing where the app's own girder self-weight
    // and DC1 read positive — so the Strength I combination 1.25(V_DC1+V_DC2)+1.50·V_DW subtracts
    // the composite dead load instead of adding it, underestimating shear at the critical section.
    // Negate the imported shear to match the app's convention. Moments already agree (sagging is
    // positive in both), so they are untouched. Under negation the LL envelope branches swap:
    // the app-positive shear branch is minus MIDAS's most-negative branch.
    M_DC1:k12('M_DC1'), V_DC1:(x)=>-interp('V_DC1',x),
    M_DC2:k12('M_DC2'), V_DC2:(x)=>-interp('V_DC2',x),
    M_DW :k12('M_DW'),  V_DW :(x)=>-interp('V_DW',x),
    // LL envelope: positive-moment governs flexure/Service; keep both branches available.
    // Each effect scaled by its own factor (DF·IM·MPF): +moment, −moment, shear separately.
    M_LLpos:(x)=>interp('M_LLpos',x)*12*fPos, M_LLneg:(x)=>interp('M_LLneg',x)*12*fNeg,
    V_LLpos:(x)=>-interp('V_LLneg',x)*fV, V_LLneg:(x)=>-interp('V_LLpos',x)*fV,
    // governing |LL| for envelopes
    M_LL:(x)=>{const p=interp('M_LLpos',x)*12*fPos,n=interp('M_LLneg',x)*12*fNeg;return Math.abs(p)>=Math.abs(n)?p:n;},
    V_LL:(x)=>{const p=interp('V_LLpos',x)*fV,n=interp('V_LLneg',x)*fV;return Math.max(Math.abs(p),Math.abs(n));},
    // pier negative moment at the span ends (for continuity check), per girder, factored later
    pierNegM:()=>{const a=interp('M_LLneg',0)*fNeg, b=interp('M_LLneg',spanLen)*fNeg;
      return Math.min(a,b);},  // most negative end (k-ft)
    llFac:{pos:fPos,neg:fNeg,v:fV}
  };
}
// Detect spans from an external-demands object (uses explicit supports/spans if present)
function externalSpans(ext){
  if(!ext) return [];
  const m=ext.member||{};
  if(Array.isArray(m.supports)&&m.supports.length>=2){
    const sup=m.supports;
    return sup.slice(0,-1).map((x0,i)=>({idx:i+1,x0,x1:sup[i+1],len:+(sup[i+1]-x0).toFixed(3)}));
  }
  if(Array.isArray(m.spans)&&m.spans.length){
    let x=0; return m.spans.map((len,i)=>{const o={idx:i+1,x0:x,x1:x+len,len}; x+=len; return o;});
  }
  // fallback: single span over the full station range
  const xs=ext.stations.map(s=>s.x); const x0=Math.min(...xs),x1=Math.max(...xs);
  return [{idx:1,x0,x1,len:+(x1-x0).toFixed(3)}];
}

/* ===== superReactions hand-off (HANDOFF.md §4.4) =====
   UNFACTORED end reactions of this one girder line, per load type, for Bridge Substructure
   Loading. Reads the load terms computeAll() already produced (R.wG, R.wDk, R.wBar, R.wDW, R.L,
   the same diaphragm filter, and buildExternal() for an active MIDAS import). Changes no result. */
function bxSuperRxPayload(inp,R){
  if(!R||R.error) return {error:'the design has an input error'+(R&&R.error?' ('+R.error+')':'')};
  const L=+R.L; if(!(L>0)) return {error:'the span length is not positive'};
  const half=w=>(+w)*L/2;                                                 // simple span: R = wL/2 at each end
  const diaph=(inp.loads.diaph||[]).filter(d=>+d.P>0 && +d.a>=0 && +d.a<=L);  // same filter as computeAll
  const diaL=diaph.reduce((s,d)=>s+(+d.P)*(L-(+d.a))/L,0), diaR=diaph.reduce((s,d)=>s+(+d.P)*(+d.a)/L,0);
  // DC1 here = everything on the bare girder: self-weight + deck/haunch (+ non-composite extra) + diaphragms
  const dc1=[half(R.wG)+half(R.wDk)+diaL, half(R.wG)+half(R.wDk)+diaR];
  let dc2=[half(R.wBar),half(R.wBar)], dw=[half(R.wDW),half(R.wDW)];
  let ids=['Support 1','Support 2'], xs=[0,L], span={index:null,length:+L.toFixed(3)}, live=null;
  const pos=inp.loads.pos==='exterior'?'exterior':'interior';
  const BB=window.BridgeBeam, db=(BB&&inp.loads.posAuto!==false)?BB.get():null;
  const label=(db&&db.label)?db.label:(String((inp.proj&&inp.proj.girderId)||'').trim()||(pos==='exterior'?'Exterior girder':'Interior girder'));
  const notes=['Single girder line: '+label+' ('+pos+') designed in PS-Beam. The values are for this one girder; Substructure Loading decides which girders they apply to.',
    'Unfactored. DC1 = girder self-weight '+R.wG.toFixed(3)+' klf + deck/haunch and other non-composite DC '+R.wDk.toFixed(3)+' klf'+(diaph.length?' + '+diaph.length+' diaphragm point load(s)':'')+', all on the non-composite girder. DC2 = barrier / SIDL. DW = wearing surface.'];
  if(R.fe&&R.fe.Vw){   // PBD-G: continuous unit (continuity on): DC2 and DW end shears of this span, + up
    const sL=R.L, i=R.fe.s;
    dc2=[R.wBar*R.fe.Vw(0),-R.wBar*R.fe.Vw(sL)]; dw=[R.wDW*R.fe.Vw(0),-R.wDW*R.fe.Vw(sL)];
    ids=['Support '+i,'Support '+(i+1)]; span={index:i,length:+sL.toFixed(3)};
    notes.push('Continuity on (span '+i+' of '+R.fe.n+', spans '+R.fe.spans.map(v=>(+v).toFixed(2)).join(', ')+' ft): DC2 and DW are the end shears of this span on the continuous unit, as reactions (+ up). At an interior pier they are this span\'s share only; add the share of the adjacent span. DC1 is computed by PS-Beam on the simple non-composite span (L = '+L.toFixed(2)+' ft).');
  } else if(R.useExt&&inp.external){
    const ext=buildExternal({...inp.external,_selSpan:inp.external._selSpan},L,{pos:1,neg:1,v:1});
    if(!ext) return {error:'the imported MIDAS demands could not be read'};
    const sL=ext.spanLen, sel=ext.sel||{}, i=Math.max(1,+sel.idx||1), x0=+sel.x0||0;
    dc2=[ext.V_DC2(0),-ext.V_DC2(sL)]; dw=[ext.V_DW(0),-ext.V_DW(sL)];    // V_ already sign-flipped to + up at the left end
    ids=['Support '+i,'Support '+(i+1)]; xs=[x0,x0+sL]; span={index:i,length:+sL.toFixed(3)};
    notes.push('MIDAS import active (span '+i+'): DC2 and DW are the imported shears at the two ends of this span, sign-corrected to reactions (+ up). At an interior pier they are this span\'s share only; add the share of the adjacent span. DC1 is computed by PS-Beam on the simple non-composite span (L = '+L.toFixed(2)+' ft).');
  } else {
    notes.push('Simple span L = '+L.toFixed(2)+' ft: R = wL/2 for each uniform load; diaphragm point loads by statics.');
    const hl=R.hl;
    if(hl&&isFinite(hl.Vtr)&&isFinite(hl.Vtd)&&isFinite(hl.Vln)){
      const Rmax=Math.max(hl.Vtr,hl.Vtd)+hl.Vln;
      live={basis:'per lane, no IM, no DF',vehicle:'HL-93: max(design truck, design tandem) + lane load, simple span',
        supports:ids.map(id=>({id,Rmax:+Rmax.toFixed(3),Rmin:0}))};
      notes.push('Live load is information only: one lane on the simple span, no IM, no DF, no multiple presence.');
    }
  }
  const r3=v=>+(+v).toFixed(3);
  return {payload:{_schema:'bridge-super-reactions',schemaVersion:1,
    project:(window.BridgeXfer&&BridgeXfer.sharedProject())||{name:(inp.proj&&inp.proj.name)||'',bridgeId:''},
    units:{force:'kip',length:'ft'},factored:false,imIncluded:false,dfIncluded:false,perGirder:true,
    girderLine:{label,position:pos,beamIndex:db?db.index:null,source:R.useExt?'PS-Beam DC1 + MIDAS DC2/DW':R.fe?'PS-Beam DC1 + continuous-unit DC2/DW':'PS-Beam simple span'},
    span,
    supports:ids.map((id,k)=>({id,x:r3(xs[k]),girders:[{label,position:pos,DC1:r3(dc1[k]),DC2:r3(dc2[k]),DW:r3(dw[k])}]})),
    liveLoad:live,notes}};
}

/* PBD-G: the continuous unit of a design with continuity on (5.12.3.3). Spans: the imported MIDAS member when demands are
   imported; else inputs cont.spans / cont.span (written from the bridge bar), with this design's own L in its span; fewer
   than two spans entered: two equal spans [L, L], this girder in span 1 (the assumption the pier check made before), flagged. */
function contUnit(inp,L,ext){
  if(ext){ const sp=externalSpans(inp.external), i=Math.max(1,+(ext.sel&&ext.sel.idx)||1);
    return {spans:sp.map(q=>+q.len),s:Math.min(i,sp.length),src:'midas',assumed:false}; }
  const c=inp.cont||{}, sp=Array.isArray(c.spans)?c.spans.map(Number).filter(v=>v>0):[];
  if(sp.length>=2){ const s=Math.min(Math.max(1,Math.round(+c.span)||1),sp.length), out=sp.slice(); out[s-1]=+L;
    return {spans:out,s,src:'bridge',assumed:false,Lbridge:sp[s-1]}; }
  return {spans:[+L,+L],s:1,src:'assumed',assumed:true};
}
