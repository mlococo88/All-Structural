# Fix log — Bridge Geometry.html

Governing basis used for fixes: none (route-surveying geometry; no design code governs this tool). EPSG registry for State Plane codes.

## 2026-10-04 — PR: claude/fix-bridge-geometry (PR link added after merge)

Check cases were run by loading the whole page in jsdom (CDN libraries absent) and calling the tool's own `buildEngine()`, `buildCrossSection()`, `applyProject()` and table builders, before and after.

### F1. `supportChordT`: exact normal/chord intersection   [calc change] [no result change on tangent alignments; corrects curved bridges]
- **Where:** `buildEngine()` → `supportChordT()` (≈ line 1144). Anchor text: `function supportChordT(sta){`
- **Problem:** the reference-line point at an interior support used a linear interpolation of the two abutment offsets. The rest of the engine (`bclOffAtSta`) uses the exact intersection of the PGL normal with the straight reference-line chord, and its own comment explains why linear interpolation is wrong. On a curve this shifted interior supports, and every grid row of the Top-of-Deck table (which also calls `supportChordT`), along the chord.
- **Governing provision:** n/a (geometry).
- **Before:**
  ```js
    function supportChordT(sta){
      if(!CH) return 0;
      // construction reference line offset at this station, interpolated between abutment offsets by station fraction
      const st=abutStations(); const {a1,a2}=abutOffsets();
      const f=(st.s2===st.s1)?0:Math.max(0,Math.min(1,(sta-st.s1)/(st.s2-st.s1)));
      const off=a1+(a2-a1)*f;
      const bp=pglOffsetPoint(align, sta, off);           // construction reference line point at the support
  ```
- **After:**
  ```js
    function supportChordT(sta){
      if(!CH) return 0;
      // construction reference line offset at this station: the exact intersection of the PGL normal at
      // `sta` with the straight reference-line chord (bclOffAtSta), not a linear interpolation of the two
      // abutment offsets. On a curve the two differ, which used to shift interior supports (and every
      // grid row) along the chord, e.g. 0.78 ft at a pier one third of the way across R = 800, 300 ft.
      const off=bclOffAtSta(sta);
      const bp=pglOffsetPoint(align, sta, off);           // construction reference line point at the support
  ```
- **Check case:** tangent 100 ft + curve R = 800 ft (L = 500) + tangent; abutments at sta 1+50 and 4+50 (both on the curve, 300 ft apart along the PGL, chord 298.245 ft), pier at 2+50 (1/3), reference-line offsets 0 at both abutments.
  - The PGL normal at 2+50 meets the chord 12.484 ft right of the PGL (exact intersection).
  - Before: t = 99.155 ft along the chord (the PGL point itself, offset 0, projected onto the chord). The deck point on the pier line lands at sta 2+49.21, offset 12.43 ft, z = 104.7355.
  - After: t = 99.935 ft (**+0.780 ft**). The point lands at sta 2+50.00, offset 12.484 ft, z = 104.7503.
  - Shipped examples: Examples 1, 2 and 5 (tangent) give identical Top-of-Deck and Beam-Seat tables. Example 3 (R = 1200, pier near midspan) changes 4 grid rows by 0.01 ft; its seat table is unchanged at 2 decimals.
- **How verified:** jsdom (`ENG.supportChordT`, `ENG.deckAtSupport`, and the full tables for all 5 examples, before and after).
- **Other copies of this code:** none known.

### F2. Crown ↔ superelevation transition made continuous   [calc change] [removes a jump; unchanged at controls and between controls of the same mode]
- **Where:** `buildCrossSection()` (≈ lines 775–810). Anchors: `function sidesOf(`, `function slopesAt(`, `function dzAbout(`
- **Problem:** between two cross-slope controls the rate was interpolated, but the *mode* flipped from crown to super at the midpoint. That gave a 0.96 ft jump at a 12 ft edge in 2 ft of stationing. A negative super rate also passed through 0 in crown mode.
- **Governing provision:** n/a. A proper AASHTO Green Book runout/runoff with its own transition stations is a new input and is left open (O2).
- **Before:**
  ```js
    // cross-slope shape, then anchored so dz=0 at the PGL (deck = profile elevation there)
    function dz(s, off){ const {mode,rate}=rateAt(s);
      const shape = (o)=> (mode==='crown') ? -Math.abs(rate)*Math.abs(o-crownOff) : rate*(o-crownOff);
      return shape(off) - shape(pgl); }
  ```
  ```js
    function dzAbout(off, crownO, s){
      const mr = (s!=null) ? rateAt(s) : {mode:globalMode, rate:globalRate};
      const shape = (o)=> (mr.mode==='crown') ? -Math.abs(mr.rate)*Math.abs(o-crownO) : mr.rate*(o-crownO);
      return shape(off) - shape(pgl);
    }
    return { rateAt, dz, dzAbout, controls:cps, pgl, crown:crownOff };
  ```
- **After:**
  ```js
    function sidesOf(mode, rate){ return (mode==='crown') ? {L:Math.abs(rate), R:-Math.abs(rate)} : {L:rate, R:rate}; }
  ```
  ```js
    function slopesAt(s){
      if(cps.length===0) return sidesOf(globalMode, globalRate);
      if(s<=cps[0].sta) return sidesOf(cps[0].mode, cps[0].rate);
      const n=cps.length-1;
      if(s>=cps[n].sta) return sidesOf(cps[n].mode, cps[n].rate);
      for(let i=0;i<n;i++){ if(s>=cps[i].sta&&s<=cps[i+1].sta){
        const span=cps[i+1].sta-cps[i].sta, f=(span>0)?(s-cps[i].sta)/span:0;
        const a=sidesOf(cps[i].mode,cps[i].rate), b=sidesOf(cps[i+1].mode,cps[i+1].rate);
        return { L:a.L+(b.L-a.L)*f, R:a.R+(b.R-a.R)*f }; } }
      return sidesOf(globalMode, globalRate);
    }
    function shapeAbout(sl, o, c){ return ((o>=c)?sl.R:sl.L)*(o-c); }
    // cross-slope shape, then anchored so dz=0 at the PGL (deck = profile elevation there)
    function dz(s, off){ const sl=slopesAt(s);
      return shapeAbout(sl,off,crownOff) - shapeAbout(sl,pgl,crownOff); }
  ```
  ```js
    function dzAbout(off, crownO, s){
      const sl = (s!=null) ? slopesAt(s) : sidesOf(globalMode, globalRate);
      return shapeAbout(sl,off,crownO) - shapeAbout(sl,pgl,crownO);
    }
    return { rateAt, slopesAt, dz, dzAbout, controls:cps, pgl, crown:crownOff };
  ```
  The left slope (dz/d-offset left of the crown) and the right slope are each interpolated linearly between controls. For a single control, or for two controls of the same mode with rates of the same sign, `sidesOf` reproduces the old shape exactly. `rateAt` is kept (exported) and no longer drives elevations.
- **Check case:** controls crown 0.02 at sta 0+00 → super 0.06 at 1+00, crown at the PGL. dz (ft) at the right edge (+12 ft) / left edge (−12 ft):

  | sta | 0 | 25 | 49 | 50 | 51 | 75 | 100 |
  |---|---|---|---|---|---|---|---|
  | right, before | −0.240 | −0.360 | −0.475 | **+0.480** | +0.485 | +0.600 | +0.720 |
  | right, after | −0.240 | 0.000 | +0.230 | +0.240 | +0.250 | +0.480 | +0.720 |
  | left, before = after | −0.240 | −0.360 | −0.475 | −0.480 | −0.485 | −0.600 | −0.720 |

  Hand check (after, sta 49): right slope = −0.02 + (0.06 + 0.02)·0.49 = +0.0192, × 12 = +0.2304 ft. Left slope = 0.02 + 0.04·0.49 = 0.0396, × (−12) = −0.4752 ft.
- **How verified:** jsdom run of `buildCrossSection(...).dzAbout` before and after; the 5 example bridges (no cross-slope controls, or same-mode controls) give identical tables except Example 4 (F6).
- **Other copies of this code:** none known.

### F3. Site map "meters" / "international ft": convert only the POB   [bug fix] [map tab only; elevations unaffected]
- **Where:** map section (≈ line 3588), anchors `function mapPOB(`, `function xyToLL(`; `onMapPickClick` (anchor `eg=llToEng(ll.lat`); add-pick-by-station (anchor `const usPt=engToUS`); `recomputePickPoints` (anchor `let eg=null; try`).
- **Problem:** engine x/y = POB (entered in the map units) + alignment geometry in feet. `xyToLL` scaled the whole engine coordinate, so in "meters" the plotted bridge was 3.28× too long and misplaced. Picked points were also converted back with the same error.
- **Governing provision:** n/a (1 m = 3937/1200 US ft; 1 ift = 0.999998 US ft, unchanged).
- **Before:**
  ```js
  // engine plan point -> [lat,lng]; engine x=Easting, y=Northing
  function xyToLL(x,y){ return neToLL(y,x); }
  ```
  ```js
    const ll=e.latlng; let ne; try{ ne=llToNE(ll.lat,ll.lng); }catch(err){ setMapStatus('Could not convert that location — check the datum.',true); return; }
    let sta=null, off=null;
    if(ENG){ try{ const pr=ENG.deckPointAtXY(ne.E, ne.N); sta=pr.sta; off=pr.off; }catch(err){} }
    const el=pickElev(sta,off,{x:ne.E,y:ne.N});
    const offB=(ENG&&ENG.chordOffsetAtXY)?ENG.chordOffsetAtXY(ne.E,ne.N):null;
  ```
  ```js
    PICKPTS.push({ id:++pickN, label:typed||('P'+pickN), lat:ll[0], lng:ll[1],
      N:pt.y, E:pt.x, sta:pr.sta, off:pr.off, offB,
  ```
  ```js
    PICKPTS.forEach(p=>{ try{ const ne=llToNE(p.lat,p.lng); p.N=ne.N; p.E=ne.E; }catch(e){}
      if(ENG){ try{ const pr=ENG.deckPointAtXY(p.E,p.N); p.sta=pr.sta; p.off=pr.off; }catch(e){ p.sta=null; p.off=null; } }
      else { p.sta=null; p.off=null; }
      p.offB=(ENG&&ENG.chordOffsetAtXY)?ENG.chordOffsetAtXY(p.E,p.N):null;
      const el=pickElev(p.sta,p.off,{x:p.E,y:p.N}); p.pave=el?el.pave:null; p.deck=el?el.deck:null; p.outside=el?el.outside:false; });
  ```
- **After:**
  ```js
  function mapPOB(){ const gx=document.getElementById('h_x0'), gy=document.getElementById('h_y0');
    return { x:+(gx?gx.value:0)||0, y:+(gy?gy.value:0)||0 }; }
  // engine (x,y) -> State Plane {E,N} in US survey feet
  function engToUS(x,y){ const P=mapPOB(); return { E:mapToUSft(P.x)+(x-P.x), N:mapToUSft(P.y)+(y-P.y) }; }
  // State Plane {E,N} in US survey feet -> engine (x,y)
  function usToEng(E,N){ const P=mapPOB(); return { x:P.x+(E-mapToUSft(P.x)), y:P.y+(N-mapToUSft(P.y)) }; }
  // [lat,lng] -> engine (x,y), for picking on the map
  function llToEng(lat,lng){ const [Eus,Nus]=proj4(MAP_WGS, MAP_DEFS[mapEpsg()], [lng,lat]); return usToEng(Eus,Nus); }
  // engine plan point -> [lat,lng]; engine x=Easting, y=Northing
  function xyToLL(x,y){ const u=engToUS(x,y); const [lng,lat]=proj4(MAP_DEFS[mapEpsg()], MAP_WGS, [u.E, u.N]); return [lat,lng]; }
  ```
  ```js
    const ll=e.latlng; let ne, eg; try{ ne=llToNE(ll.lat,ll.lng); eg=llToEng(ll.lat,ll.lng); }catch(err){ setMapStatus('Could not convert that location — check the datum.',true); return; }
    let sta=null, off=null;
    if(ENG){ try{ const pr=ENG.deckPointAtXY(eg.x, eg.y); sta=pr.sta; off=pr.off; }catch(err){} }
    const el=pickElev(sta,off,{x:eg.x,y:eg.y});
    const offB=(ENG&&ENG.chordOffsetAtXY)?ENG.chordOffsetAtXY(eg.x,eg.y):null;
  ```
  ```js
    const usPt=engToUS(pt.x,pt.y);   // N/E are reported in the map's coordinate units
    PICKPTS.push({ id:++pickN, label:typed||('P'+pickN), lat:ll[0], lng:ll[1],
      N:usftToMap(usPt.N), E:usftToMap(usPt.E), sta:pr.sta, off:pr.off, offB,
  ```
  ```js
    PICKPTS.forEach(p=>{ let eg=null; try{ const ne=llToNE(p.lat,p.lng); p.N=ne.N; p.E=ne.E; eg=llToEng(p.lat,p.lng); }catch(e){}
      if(ENG && eg){ try{ const pr=ENG.deckPointAtXY(eg.x,eg.y); p.sta=pr.sta; p.off=pr.off; }catch(e){ p.sta=null; p.off=null; } }
      else { p.sta=null; p.off=null; }
      p.offB=(ENG&&ENG.chordOffsetAtXY&&eg)?ENG.chordOffsetAtXY(eg.x,eg.y):null;
      const el=eg?pickElev(p.sta,p.off,{x:eg.x,y:eg.y}):null; p.pave=el?el.pave:null; p.deck=el?el.deck:null; p.outside=el?el.outside:false; });
  ```
  Survey points and plan-overlay control points, which are true State Plane N/E in the chosen units, still go through `neToLL`/`mapToUSft` unchanged. With "US survey ft" selected every function returns exactly what it did before.
- **Check case:** POB E = 1000, N = 2000, bearing N90E, one 328.0833 ft tangent; proj4 replaced by an identity so the State Plane US-ft input is visible.
  - US ft: POB (1000, 2000) → end (1328.08, 2000); length 328.08 before and after.
  - Meters: before POB (3280.83, 6561.67) → end (4357.22, 6561.67), length **1076.39** (3.28×); after the same POB → end (3608.92, 6561.67), length 328.08.
  - International ft: length before 328.0826, after 328.0833.
- **How verified:** jsdom with a stub `proj4`.
- **Other copies of this code:** none known.

### F4. EPSG codes: NJ 32111 → 3424, MA Island 2802 → 2250 (old codes still accepted)   [display / data key] [no coordinate change]
- **Where:** `<select id="map_datum">` (≈ lines 534, 539); `MAP_DEFS` (≈ line 3555) and `MAP_EPSG_OLD` (≈ line 3567); `applyProject()` scalar restore (≈ line 4309).
- **Problem:** 32111 is NAD83 / New Jersey in metres (NJ ftUS is EPSG:3424), and 2802 is not MA Island ftUS (that is EPSG:2250). The proj4 parameters were already the correct ftUS definitions, so coordinates were right, but the codes would mislead anyone cross-checking. `map_datum` is saved in projects.
- **Governing provision:** EPSG registry (2250 = NAD83 / Massachusetts Island (ftUS); 3424 = NAD83 / New Jersey (ftUS)).
- **Before:**
  ```js
                  <option value="2802">MA Island — NAD83 (US ft)</option>
  ```
  ```js
                  <option value="32111">NJ — NAD83 (US ft)</option>
  ```
  ```js
    if(p.scalars) for(const id in p.scalars){ const el=document.getElementById(id); if(el){ if(el.type==='checkbox') el.checked=!!p.scalars[id]; else el.value=p.scalars[id]; } }
  ```
  `MAP_DEFS` keys `2802:` and `32111:`.
- **After:**
  ```js
                  <option value="2250">MA Island — NAD83 (US ft)</option>
  ```
  ```js
                  <option value="3424">NJ — NAD83 (US ft)</option>
  ```
  ```js
  const MAP_EPSG_OLD={'2802':'2250','32111':'3424'};
  MAP_DEFS[2802]=MAP_DEFS[2250]; MAP_DEFS[32111]=MAP_DEFS[3424];
  ```
  ```js
    if(p.scalars) for(const id in p.scalars){ const el=document.getElementById(id); if(el){ if(el.type==='checkbox') el.checked=!!p.scalars[id];
      else el.value=(id==='map_datum' && MAP_EPSG_OLD[p.scalars[id]]) ? MAP_EPSG_OLD[p.scalars[id]] : p.scalars[id]; } }
  ```
  `MAP_DEFS` keys renamed to `2250:` and `3424:` with identical proj4 strings.
- **Migration:** a project, autosave or library entry saved with `map_datum` = "2802" or "32111" loads as "2250" or "3424", the same projection. Without the map the select would have gone blank and silently fallen back to MA Mainland.
- **Check case:** `applyProject({…, scalars:{map_datum:'32111'}})` → select value "3424"; `'2802'` → "2250"; both resolve in `MAP_DEFS`.
- **How verified:** jsdom.
- **Other copies of this code:** none known.

### F5. Skew datum stated as the abutment-to-abutment chord normal   [display] [no result change]
- **Where:** Bridge tab note (≈ line 331), seat-table header title (≈ line 2596), substructure table header title (≈ line 3224), span summary row label (≈ line 2762).
- **Problem:** the UI said skew is "measured from the alignment normal", but whenever two or more supports exist the engine measures it from the normal to the straight abutment-to-abutment reference-line chord. Engine not changed (see O1).
- **Before:**
  ```js
          <p class="note">Skew measured from alignment normal (0° = perpendicular). Dual bearing offset = distance back/ahead of unit station.</p>
  ```
  ```js
      ['Skew (from perpendicular)', V.map(v=>v.skew.toFixed(2)+'&deg;')],
  ```
  Titles: `"Skew of the support, degrees from the alignment normal."` and `"Skew angle in degrees, measured from the alignment normal. 0 = support perpendicular to the alignment."`
- **After:**
  ```js
          <p class="note">Skew is measured from the normal to the straight abutment-to-abutment chord (the construction reference line between the two abutments), not from the radial line of the PGL; 0° = support perpendicular to that chord. On a tangent alignment the two are the same. Dual bearing offset = distance back/ahead of unit station.</p>
  ```
  ```js
      ['Skew (from chord normal)', V.map(v=>v.skew.toFixed(2)+'&deg;')],
  ```
  Titles: `"Skew of the support, degrees from the normal to the abutment-to-abutment chord (construction reference line)."` and `"Skew angle in degrees, measured from the normal to the straight abutment-to-abutment chord (construction reference line). 0 = support perpendicular to that chord, which on a curve is not radial to the PGL."`
- **Check case:** n/a (text). R = 800 ft, abutments 300 ft apart: the chord is about 10.7° off the PGL tangent at each abutment, so "0°" is 10.7° off radial there.
- **How verified:** jsdom render.
- **Other copies of this code:** none known.

### F6. Superelevation sign documented; Example 4 banked correctly   [display + example data] [no engine change]
- **Where:** `x_rate_global` tooltip (≈ line 260); `EXAMPLE_BRIDGES`, Example 4 (≈ line 4562).
- **Problem:** a positive super rate raises the RIGHT side (looking up-station), which was not documented. Example 4 is a right-hand curve (R = +900) with rate +0.05, so its inside (right) edge was high: adverse superelevation.
- **Before:**
  ```js
      scalars:_exScalars({ nspans:'1', h_brg0:'S80E', x_mode_global:'super', x_rate_global:'0.05',
  ```
  Tooltip: `title="Cross slope as a decimal (0.02 = 2%). For crown, the fall on each side; for super, the planar grade across the deck."`
- **After:**
  ```js
      scalars:_exScalars({ nspans:'1', h_brg0:'S80E', x_mode_global:'super', x_rate_global:'-0.05',  // right-hand curve: inside (right) low
  ```
  Tooltip: `title="Cross slope as a decimal (0.02 = 2%). For crown, the fall on each side. For super, the planar grade across the deck: a POSITIVE rate raises the RIGHT side (looking up-station), a negative rate raises the left. On a right-hand curve (R &gt; 0) the inside is the right, so the rate is negative."`
- **Note for existing users:** the examples are seeded into the library only once (flag `bridgeGeomEngine.examplesSeeded.v1`). Anyone who already opened the tool keeps their old Example 4 copy (rate +0.05) until they delete it and clear the flag, or edit the rate to −0.05. Nobody's own projects are touched.
- **Check case:** Example 4 at sta 12+50, edges ±18 ft: before z(left) = 211.10, z(right) = 212.90 (right high, adverse); after z(left) = 212.90, z(right) = 211.10. The alignment bearing goes from 100° to 131.8°, i.e. turning right.
- **How verified:** jsdom (`applyProject(EXAMPLE_BRIDGES[3])`).
- **Other copies of this code:** none known.

### F7. Guards: curve R = 0, spiral L ≤ 0, repeated/decreasing profile stations → clear error, computation stopped   [robustness] [no result change for valid input]
- **Where:** new `geometryInputErrors()` and `showGeomErrors()` before `compute()` (≈ line 1285); `compute()` (≈ line 1311); banner `<div id="geom_err">` at the top of `<main>` (≈ line 180).
- **Problem:** switching a row to Curve keeps R = 0 (k = 1/0), and a spiral with L = 0 divides by zero. Every plan position, elevation and table went NaN with no message. Duplicate PVI stations divide by zero in the grade (there was only a soft warning).
- **Before:**
  ```js
  function compute(){
    ENG=buildEngine();
  ```
- **After:**
  ```js
  function compute(){
    const gErr=geometryInputErrors(); showGeomErrors(gErr);
    if(gErr.length){ if(_autosaveArmed) autosave(); return; }
    ENG=buildEngine();
  ```
  `geometryInputErrors()` reports, by row: a curve R of 0, blank or non-finite; a curve length ≤ 0; a spiral L ≤ 0 or non-finite radii; a negative tangent length; and a profile point whose station is not greater than the previous one. The red banner says the computation stopped and that the tables, drawings and map still show the last valid geometry.
- **Check case:** curve R = 0 → banner "Alignment row 2: the curve radius R is 0…"; spiral L = 0 → "…the spiral length L is 0…"; PVIs at 4+00 and 4+00 → "Vertical profile point 3: station 4+00.00 is not greater than point 2 (4+00.00)…". In all three cases no NaN is produced. Before, the same inputs gave NaN through every result.
- **How verified:** jsdom.
- **Other copies of this code:** none known.

### F8. Warnings: spiral/curve radius continuity and sign   [display] [no result change]
- **Where:** `renderElemTable()` (≈ line 3020), anchor `Radius continuity and sign`; R-in/R-out header tooltips.
- **Problem:** nothing checked that a spiral's R-out equals the next curve's R (or the R-in of the next spiral), or that a left-hand spiral uses negative radii. R-out = 800 followed by a curve with R = −800 silently made a reverse curve.
- **After:**
  ```js
    { const kOf=r=>(+r)?1/(+r):0;
      const rs=k=>(k===0)?'tangent (0)':(1/k).toFixed(2);
      for(let i=0;i<ELEMS.length-1;i++){ const a=ELEMS[i], b=ELEMS[i+1];
        if(a.type!=='spi' && b.type!=='spi') continue;
        const kEnd=(a.type==='tan')?0:(a.type==='crv')?kOf(a.R):kOf(a.Rout);
        const kBeg=(b.type==='tan')?0:(b.type==='crv')?kOf(b.R):kOf(b.Rin);
        if(Math.abs(kEnd-kBeg)>1e-9+1e-3*Math.max(Math.abs(kEnd),Math.abs(kBeg)))
          warnings.push(`Rows ${i+1}→${i+2}: radius not continuous (row ${i+1} ends at R = ${rs(kEnd)}, row ${i+2} starts at R = ${rs(kBeg)})`+
            ((kEnd*kBeg<0)?' — opposite signs, which makes a reverse curve. A left-hand spiral needs negative radii.':'.'));
      } }
  ```
  Only joints involving a spiral are checked (compound curves and tangent-to-curve joints are legitimate). The R-in/R-out tooltips now say the radii are signed like R (negative = left, 0 = tangent end).
- **Check case:** tangent → spiral (R-in 0, R-out 800) → curve R = −800 → warning "Rows 2→3: radius not continuous (row 2 ends at R = 800.00, row 3 starts at R = -800.00) — opposite signs…". The default demo alignment gives no warning.
- **How verified:** jsdom.
- **Other copies of this code:** none known.

### F9. Warnings: vertical-curve extent against the adjacent profile points   [display] [no result change]
- **Where:** `renderVProfTable()` (≈ line 3148). Anchor: `each vertical curve must lie`
- **Problem:** a curve whose BVC is before the previous point, or whose EVC is past the next point (including past the profile start/end), was not flagged.
- **After:**
  ```js
    for(let i=1;i<VPIS.length-1;i++){ const c=cd[i]; if(!c||c.bvcSta==null) continue;
      if(c.bvcSta < VPIS[i-1].sta-1e-6) warn.push(`PVI ${i}: BVC ${formatStation(c.bvcSta)} is before the previous point (${formatStation(VPIS[i-1].sta)}); shorten the curve.`);
      if(c.evcSta > VPIS[i+1].sta+1e-6) warn.push(`PVI ${i}: EVC ${formatStation(c.evcSta)} is past the next point (${formatStation(VPIS[i+1].sta)}); shorten the curve.`); }
  ```
- **Check case:** points 0+00, 2+00 (L = 600), 10+00 → "PVI 1: BVC -1+00.00 is before the previous point (0+00.00); shorten the curve."
- **How verified:** jsdom.
- **Other copies of this code:** none known.

### F10. CSV export and print stylesheet for the Top-of-Deck and Beam-Seat tables   [feature, small] [no result change]
- **Where:** buttons above `#tbl_wrap` (≈ line 478) and `#seat_tbl_wrap` (≈ line 506); `tableCSV()` / `exportTableCSV()` (≈ line 4394); `@media print` block (≈ line 43).
- **Problem:** the elevation tables, which are the deliverables, had no export and no print styling.
- **After:** "Export CSV" downloads the table as shown (the visible columns, the same rounding), named `top-of-deck-YYYY-MM-DD.csv` or `beam-seat-YYYY-MM-DD.csv`. "Print" calls `window.print()`. The print CSS prints the active tab only and hides the project bar, the tab strip, the library, buttons and fieldsets.
  ```js
  function tableCSV(wrapId){
    const t=document.querySelector('#'+wrapId+' table'); if(!t) return '';
    const q=s=>{ s=String(s).replace(/\s+/g,' ').trim(); return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; };
    return [...t.querySelectorAll('tr')].map(tr=>[...tr.children].map(c=>q(c.textContent)).join(',')).join('\n');
  }
  ```
- **Check case:** demo bridge, first CSV lines: `Span,Station,Note,Edge L,Curb L,G1@-18.00,…` / `1,0+00.00,Abut 1 CL,99.67,99.71,…`; seat: `Bearing line,Station,Skew°,Span,G1@-18.00,…` / `Abut 1 brg,0+00.00,0.0,1,95.71,…`.
- **How verified:** jsdom (`tableCSV`); the print layout was not checked in a browser (no browser in the sandbox).
- **Other copies of this code:** none known.

## Open items (not changed)
- O1. **Skew datum.** The engine measures skew from the normal to the abutment-to-abutment chord. Should skew instead be radial (normal to the PGL at each support)? On R = 800 with abutments 300 ft apart the two differ by 10.7° at the abutments. The UI text now states the chord datum (F5). — Engineer decision needed before changing the engine.
- O2. **Superelevation runout/runoff.** F2 makes the transition continuous by interpolating the left and right slopes independently between controls placed at substructure stations. A proper transition needs its own stations: the end of normal crown, level crown (end of tangent runout), reverse crown and full super (end of runoff), with the axis of rotation. — Recommendation: add an optional "transition" table (station, left slope, right slope, or Green Book stations) that, when present, takes precedence over the per-unit controls.
- O3. **Haunch terms** in the beam-seat stack: net vs gross camber, cross-slope × ½ flange width, the VC ordinate between bearings, and a midspan haunch check. — Not in scope; needs the engineer's preferred method.
- O4. **Degree of curve, spiral reports (Ts, Es, θs, p, k, LT, ST), station equations.** Not supported. — Feature requests.
- O5. **Curved or per-span-chorded girders.** The whole bridge is modelled on one straight abutment-to-abutment chord; the curved deck edges are not represented. — Modelling decision.
- O6. **Datum and scale factor.** NAD83 is treated as WGS84 (≈1–1.5 m in New England), there is no combined grid/elevation scale factor, and there is no SPCS2022. This affects the map overlay only. — Decide whether to add `+towgs84`/NADCON and a CSF input.
- O7. `projectToPGL` takes the first sign change of the along-tangent residual, which may not be the nearest station on reverse curves or near a curve centre. Not changed.

## 2026-10-04 — PR: claude/step1-group1 (PR link added after merge)

Feature (no result change): "← All tools" link to `tools.html` (`target="_top"`, class `noprint`, hidden by the existing print rule). **No title block:** this tool has no project / bridge ID / engineer / date fields (only the saved-library entry name), so the shared project info buttons and BridgeXfer were not added.

### S1. "← All tools" link in the header   [feature (no result change)]
- **Where:** `<header>` → `.htop` (≈ line 144). Anchor text: `<span class="ver">v0.3`
- **Problem:** none (feature). Approved step 1 of the cross-tool work: "← All tools" link and shared project info (HANDOFF.md §4.1).
- **Governing provision:** n/a (no calculation, factor, unit or code reference touched).
- **Before:**
  ```html
      <span class="ver">v0.3 · spans · 3D · heatmap</span>
    </div>
  ```
- **After:**
  ```html
      <span class="ver">v0.3 · spans · 3D · heatmap</span>
      <a class="bx-alltools noprint" href="tools.html" target="_top" title="Open the list of all tools" style="margin-left:auto;font-size:11px;color:var(--ink-soft);text-decoration:none;">&larr; All tools</a>
    </div>
  ```
- **Check case:** n/a, no computed value changes. Functional check: see How verified.
- **How verified:** `node --check` on the inline script; page loaded in jsdom; link found. `git diff` is a single added line.
- **Other copies:** BridgeXfer v1 and the `BXProject` glue are also in index.html, lldf.html, psbeam.html, stgirder.html and Moving Load Generator.html (this PR).

## 2026-10-04 — PR: claude/conn-geometry-lldf (PR link added after merge)

Feature (no result change): Bridge Geometry becomes a sender on `bridgeSuite.v1.lldfGeom` (HANDOFF.md §4.2) for the LL & DL Distribution tool (lldf.html).

### H1. "Send to LL & DL" and "Export hand-off (JSON)"   [feature: hand-off (no result change)]
- **Where:**
  - Header `.projbar`, after the Import JSON file input. Anchor: `<input type="file" id="proj_file"` (hunk 1).
  - End of file: two new plain `<script>` blocks after the main script. The first is the BridgeXfer v1 paste (verbatim from HANDOFF.md §5). The second is the hand-off code (`bgxBuildLldfGeom`, review dialog). Anchor: `</script>\n</body>` (hunk 2).
- **Problem:** none (feature). Approved connection Bridge Geometry → lldf.
- **What it does:**
  - Both buttons open a review dialog. It has three choices, a preview of every value and the notes, and the buttons Send / Export / Cancel. Send calls `BridgeXfer.publish('lldfGeom', …)`, which writes the key and `.updatedAt`. Export downloads the same payload.
  - The dialog only reads this tool's state. It writes nothing into Bridge Geometry's project, library or autosave, and no output table changes.
  - **Spans** = distance along the straight abutment-to-abutment chord (construction reference line) between the chord projections of the support points (`ENG.supportChordT`). The default is between support centerlines; the choice is between bearing lines (the last bearing line of support i to the first bearing line of support i+1).
  - **Skew** = |skew| per support, measured from the normal to that chord. The default sent value is the largest; the choices are the smallest or the average. All per-support values are listed in `notes`.
  - **Spacings** = differences of the sorted girder offsets (global by default, or the chosen span's override set). They are measured perpendicular to the reference line.
  - **O_L / O_R** = deck edge to exterior girder centerline.
  - When there are fewer than two girders, no spacing, overhangs or N_b are sent, and `notes` say so. When other spans have their own layout, the `notes` say that layout was not sent.
- **Mapping:**

| Bridge Geometry (source) | Payload field | lldf input | Units |
|---|---|---|---|
| Chord distance between consecutive supports: `supportChordT(sta[i+1]) − supportChordT(sta[i])`, support centerlines (default) or bearing lines (choice) | `inputs.spans[]` | Span lengths L₁…Lₙ (`state.spans`) | ft, rounded 0.001 |
| \|skew\| per support (degrees from the normal to the chord); largest (default), smallest or average (choice) | `inputs.skew` | Skew θ (`#skew`) | deg |
| Differences of the sorted girder offsets (global, or one span's override set, choice) | `inputs.spacings[]` | Girder spacing table (`state.spacings`) | ft, rounded 0.001 |
| Number of girders | `Nb` | N_b (= spacings + 1) | — |
| girder 1 offset − left deck edge | `inputs.OL` | Left overhang O_L (`#OL`) | ft |
| right deck edge − last girder offset | `inputs.OR` | Right overhang O_R (`#OR`) | ft |
| shared project info, else library entry name | `project{name,bridgeId}` | Project (`#mProject`) only if blank | — |
| (not sent) | `de:null` | lldf keeps its own curb/railing inputs; d_e unchanged in method | — |

- **Governing provision:** n/a. No formula, factor, unit or code reference changed. Every geometric quantity is read from existing engine functions (`buildEngine().supportChordT`, `bearingLinesFor`, `GIRDERS`, `SPAN_OV`, `edgesForSpan`, `sortedUnits`).

HUNK 1 (≈ line 156 of the old file)
- **Before:**
  ```html
      <button class="sm ghost" id="proj_load" title="Import a bridge from a JSON file.">Import JSON</button>
      <input type="file" id="proj_file" accept="application/json,.json" style="display:none">
      <span class="note" id="save_status" style="margin-left:auto;">—</span>
    </div>
  ```
- **After:**
  ```html
      <button class="sm ghost" id="proj_load" title="Import a bridge from a JSON file.">Import JSON</button>
      <input type="file" id="proj_file" accept="application/json,.json" style="display:none">
      <span class="sep" style="display:inline-block;width:1px;height:18px;background:var(--graphite);margin:0 2px;"></span>
      <button class="sm ghost" id="bgx_send" type="button" title="Send spans, girder spacing, skew and overhangs to the LL &amp; DL Distribution tool (lldf.html). You review the values and choices first; LL &amp; DL asks again before applying anything.">Send to LL &amp; DL</button>
      <button class="sm ghost" id="bgx_export" type="button" title="Download the same LL &amp; DL geometry hand-off as a JSON file (for another browser or device, or the calc package).">Export hand-off (JSON)</button>
      <span class="note" id="save_status" style="margin-left:auto;">—</span>
    </div>
  ```

HUNK 2 (≈ line 4615 of the old file)
- **Before:**
  ```html
  else { setStatus('autosave OFF — browser storage blocked here. Use Export JSON to save.'); }
  </script>
  </body>
  </html>
  ```
- **After:**
  ```html
  else { setStatus('autosave OFF — browser storage blocked here. Use Export JSON to save.'); }
  </script>
  <script>
  /* BridgeXfer v1 verbatim from HANDOFF.md §5 (not repeated here) */
  </script>
  <script>
  /* ===== Hand-off: Bridge Geometry -> LL & DL Distribution (lldf.html) =====
     Channel bridgeSuite.v1.lldfGeom, _schema 'bridge-lldf-geometry' (HANDOFF.md §4.2). Writes the shape
     lldf.html already consumes (its K_GEOM reader): inputs.spans / inputs.spacings / inputs.skew /
     inputs.OL / inputs.OR, plus Nb. Read-only on this tool's state: nothing here changes any
     geometry result, and nothing is saved in this tool's project format. Uses BridgeXfer above. */
  (function(){
    'use strict';
    const r3=v=>+(+v).toFixed(3), r2=v=>+(+v).toFixed(2);
    const escT=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

    /* Build the payload. opt = {spanBasis:'cl'|'brg', skewRule:'max'|'min'|'mean', girders:'global'|'<span no.>'}.
       Returns {payload, summary[]} or {error}. */
    function bgxBuildLldfGeom(opt){
      opt=opt||{};
      const spanBasis=(opt.spanBasis==='brg')?'brg':'cl';
      const skewRule=(['max','min','mean'].indexOf(opt.skewRule)>=0)?opt.skewRule:'max';
      const gsrc=opt.girders||'global';
      const gErr=geometryInputErrors();
      if(gErr.length) return {error:'Fix the geometry input errors first: '+gErr[0]};
      const su=sortedUnits();
      if(su.length<2) return {error:'Define at least two supports (Abut 1 and Abut 2) first.'};
      let E; try{ E=buildEngine(); }catch(e){ return {error:'The geometry engine failed: '+(e&&e.message||e)}; }
      if(!E||!E.chord) return {error:'No abutment-to-abutment chord: define at least two supports first.'};

      // ---- spans: distance ALONG THE CHORD (construction reference line) between support points ----
      const spans=[];
      for(let i=0;i<su.length-1;i++){
        let a=su[i].sta, b=su[i+1].sta;
        if(spanBasis==='brg'){ const A=bearingLinesFor(su[i]), B=bearingLinesFor(su[i+1]); a=A[A.length-1].sta; b=B[0].sta; }
        const L=E.supportChordT(b)-E.supportChordT(a);
        if(!(isFinite(L)&&L>0)) return {error:'Span '+(i+1)+' ('+su[i].name+' to '+su[i+1].name+') has no positive length along the chord. Check the support stations'+(spanBasis==='brg'?' and pier bearing offsets':'')+'.'};
        spans.push(r3(L));
      }

      // ---- skew: per support, from the normal to the chord; the sign is dropped ----
      const sk=su.map(u=>Math.abs(+u.skew||0));
      if(sk.some(v=>!isFinite(v)||v>=90)) return {error:'A support skew is not a number between -90 and 90 degrees.'};
      const skewVal=r2(skewRule==='min'?Math.min.apply(null,sk):(skewRule==='mean'?sk.reduce((s,v)=>s+v,0)/sk.length:Math.max.apply(null,sk)));

      // ---- girders and deck edges (ft from the construction reference line, left negative) ----
      let offs, eL, eR, layoutLbl;
      if(gsrc==='global'){
        offs=GIRDERS.slice(); eL=+document.getElementById('edge_l').value; eR=+document.getElementById('edge_r').value;
        layoutLbl='the global girder offsets and deck edges';
      } else {
        const s=+gsrc, ov=SPAN_OV[s]||{}, b=bridgeCL(), ed=edgesForSpan(s);
        offs=(ov.girders||GIRDERS).slice(); eL=ed.l-b; eR=ed.r-b;
        layoutLbl='the span '+s+' girder offsets and deck edges';
      }
      offs=offs.map(Number).filter(v=>isFinite(v)).sort((x,y)=>x-y);
      const inputs={spans:spans, skew:skewVal};
      const notes=[], units={spans:'ft', skew:'deg'};
      let Nb=null;
      if(offs.length>=2){
        const sp=[]; for(let k=1;k<offs.length;k++) sp.push(r3(offs[k]-offs[k-1]));
        if(sp.some(v=>!(v>0))) return {error:'Two girders have the same offset. Fix the girder table first.'};
        inputs.spacings=sp; Nb=offs.length; units.spacings='ft';
        const OL=offs[0]-eL, OR=eR-offs[offs.length-1];
        if(isFinite(OL)&&OL>=0){ inputs.OL=r3(OL); units.OL='ft'; }
        else notes.push('Left overhang not sent: the left deck edge is not outside girder 1.');
        if(isFinite(OR)&&OR>=0){ inputs.OR=r3(OR); units.OR='ft'; }
        else notes.push('Right overhang not sent: the right deck edge is not outside the last girder.');
      } else {
        notes.push('No girder spacing sent: Bridge Geometry has fewer than two girders in '+layoutLbl+'. Only spans and skew are sent.');
      }

      // ---- notes the receiver must display (HANDOFF.md §2, §4.2) ----
      notes.unshift(
        'Spans are measured along the straight abutment-to-abutment chord (the construction reference line), between '
          +(spanBasis==='brg'?'bearing lines (pier bearing offsets applied; abutments at their bearing line)':'support centerlines (the support stations)')
          +'. On a curved alignment these differ from the PGL station differences in the Bridge Geometry span summary. Rounded to 0.001 ft.',
        'Skew is measured at each support from the normal to the construction reference line chord (0 deg = support square to the chord); the sign is dropped. '
          +'Per support: '+su.map((u,i)=>u.name+' '+sk[i].toFixed(2)).join(', ')+' deg. Sent: the '
          +(skewRule==='min'?'smallest':(skewRule==='mean'?'average':'largest'))+' |skew| = '+skewVal.toFixed(2)+' deg.',
        (Nb?('Girder spacings and overhangs are from '+layoutLbl+', measured perpendicular to the reference line (girders are parallel to it), girders numbered left to right looking up-station. '
          +'Overhang = deck edge to exterior girder centerline. No barrier face or d_e is sent; LL & DL keeps its own curb/railing inputs.'):'')
      );
      if(notes[2]==='') notes.splice(2,1);
      const diff=[]; for(let s=1;s<su.length;s++){ const ov=SPAN_OV[s]; if(ov&&(ov.girders||ov.edgeL!=null||ov.edgeR!=null)&&String(s)!==String(gsrc)) diff.push(s); }
      if(diff.length) notes.push('Span'+(diff.length>1?'s ':' ')+diff.join(', ')+' '+(diff.length>1?'have':'has')+' a different girder or deck-edge layout in Bridge Geometry, which was NOT sent.');
      if(spans.length>6) notes.push('Bridge Geometry has '+spans.length+' spans; LL & DL is built for up to 6.');

      const shared=(window.BridgeXfer&&BridgeXfer.sharedProject())||null;
      const project=(shared&&(shared.name||shared.bridgeId))?shared:{name:(typeof CURRENT_NAME!=='undefined'&&CURRENT_NAME)||'', bridgeId:''};
      const payload={_schema:'bridge-lldf-geometry', schemaVersion:1,
        producer:'Bridge Geometry', producerFile:'Bridge Geometry.html', producedAt:new Date().toISOString(),
        project:project, units:units, notes:notes,
        basis:{spans:(spanBasis==='brg'?'chord, bearing lines':'chord, support centerlines'), skew:skewRule, girders:gsrc},
        de:null, inputs:inputs};
      if(Nb) payload.Nb=Nb;
      const summary=[
        ['Spans', spans.map(v=>v.toFixed(3)).join(' / ')+' ft'],
        ['Skew θ', skewVal.toFixed(2)+'°'],
        ['Beams N_b', Nb?String(Nb):'— (not sent)'],
        ['Girder spacings', inputs.spacings?inputs.spacings.map(v=>v.toFixed(3)).join(' / ')+' ft':'— (not sent)'],
        ['Overhang O_L / O_R', (inputs.OL!=null?inputs.OL.toFixed(3):'—')+' / '+(inputs.OR!=null?inputs.OR.toFixed(3):'—')+' ft'],
        ['Project', project.name||'—']
      ];
      return {payload:payload, summary:summary};
    }
    window.bgxBuildLldfGeom=bgxBuildLldfGeom;

    /* ---- review dialog: the engineer sees and picks the assumptions before anything is sent ---- */
    let dlg=null;
    function opts(){ return { spanBasis:dlg.querySelector('#bgx_span').value, skewRule:dlg.querySelector('#bgx_skew').value, girders:dlg.querySelector('#bgx_gird').value }; }
    function refresh(){
      const r=bgxBuildLldfGeom(opts()), out=dlg.querySelector('#bgx_prev');
      const ok=!r.error;
      dlg.querySelector('#bgx_do_send').disabled=!ok; dlg.querySelector('#bgx_do_export').disabled=!ok;
      if(!ok){ out.innerHTML='<p style="color:var(--oxide);margin:6px 0">'+escT(r.error)+'</p>'; return null; }
      out.innerHTML='<table style="font-size:12px;margin:6px 0"><tbody>'+r.summary.map(x=>'<tr><td class="lbl" style="text-align:left">'+escT(x[0])+'</td><td style="text-align:left">'+escT(x[1])+'</td></tr>').join('')+'</tbody></table>'
        +'<p class="note" style="margin:4px 0 0">Notes sent with the data (shown in LL &amp; DL):</p><ul class="note" style="margin:2px 0 0 18px;padding:0">'+r.payload.notes.map(t=>'<li>'+escT(t)+'</li>').join('')+'</ul>';
      return r;
    }
    function openDlg(){
      if(!dlg){
        dlg=document.createElement('div'); dlg.className='noprint'; dlg.id='bgx_dlg';
        dlg.style.cssText='position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.35);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:40px 12px';
        dlg.innerHTML='<div style="background:var(--vellum);color:var(--ink);border:1px solid var(--ink);max-width:640px;width:100%;padding:14px 16px;font-size:13px">'
          +'<h2 class="sec" style="margin-top:0">Send geometry to LL &amp; DL Distribution</h2>'
          +'<p class="note" style="margin-top:0">LL &amp; DL shows these values and asks before it overwrites anything. Pick how the values are taken from this bridge:</p>'
          +'<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">'
          +'<div><label>Span length between</label><select id="bgx_span"><option value="cl" selected>support centerlines</option><option value="brg">bearing lines</option></select></div>'
          +'<div><label>Skew sent (one value)</label><select id="bgx_skew"><option value="max" selected>largest |skew|</option><option value="min">smallest |skew|</option><option value="mean">average |skew|</option></select></div>'
          +'<div><label>Girder layout from</label><select id="bgx_gird"></select></div></div>'
          +'<div id="bgx_prev"></div>'
          +'<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="sm" id="bgx_do_send" type="button">Send to LL &amp; DL</button>'
          +'<button class="sm ghost" id="bgx_do_export" type="button">Export hand-off (JSON)</button>'
          +'<button class="sm ghost" id="bgx_cancel" type="button" style="margin-left:auto">Cancel</button></div></div>';
        document.body.appendChild(dlg);
        ['#bgx_span','#bgx_skew','#bgx_gird'].forEach(id=>dlg.querySelector(id).addEventListener('change',refresh));
        dlg.querySelector('#bgx_cancel').addEventListener('click',()=>{ dlg.style.display='none'; });
        dlg.querySelector('#bgx_do_send').addEventListener('click',()=>{
          const r=refresh(); if(!r) return;
          if(!window.BridgeXfer){ alert('Hand-off helper is not available.'); return; }
          const res=BridgeXfer.publish('lldfGeom', r.payload, 'Bridge Geometry', 'Bridge Geometry.html');
          if(res.error){ alert('Not sent: '+res.error); return; }
          dlg.style.display='none';
          setStatus('sent to LL & DL — open lldf.html and click "Pull from Bridge Geometry"');
        });
        dlg.querySelector('#bgx_do_export').addEventListener('click',()=>{
          const r=refresh(); if(!r) return;
          const res=window.BridgeXfer?BridgeXfer.exportFile('lldfGeom', r.payload):{error:'Hand-off helper is not available.'};
          if(res.error){ alert(res.error); return; }
          setStatus('hand-off JSON exported');
        });
      }
      // girder-layout choices: the global set, plus each span (marked when it has its own overrides)
      const sel=dlg.querySelector('#bgx_gird'), prev=sel.value||'global', su=sortedUnits();
      let h='<option value="global">global offsets</option>';
      for(let s=1;s<su.length;s++){ const ov=SPAN_OV[s]; const own=ov&&(ov.girders||ov.edgeL!=null||ov.edgeR!=null);
        h+='<option value="'+s+'">span '+s+(own?' (own layout)':'')+'</option>'; }
      sel.innerHTML=h; sel.value=[...sel.options].some(o=>o.value===prev)?prev:'global';
      dlg.style.display='flex';
      refresh();
    }
    window.bgxOpenLldfGeom=openDlg;
    const bs=document.getElementById('bgx_send'), be=document.getElementById('bgx_export');
    if(bs) bs.addEventListener('click',openDlg);
    if(be) be.addEventListener('click',openDlg);
  })();
  </script>
  </body>
  </html>
  ```

- **Check case (hand-checkable, the fresh-page demo bridge with Abut 1 skew 10°, Pier 1 15°, Abut 2 −5°):**
  - Supports: stations 0+00 / 5+00 / 10+00 on the demo alignment (POB due east; tangent 200, spiral 150, curve R 800 L 300, spiral 150, tangent 200). The alignment is symmetric about 5+00.
  - Chord: Abut 1 (0, 0) to Abut 2 (934.856, −270.087), so chord length = √(934.856² + 270.087²) = 973.089 ft.
  - The pier point (467.428, −135.044) lies on the chord at t = √(467.428² + 135.044²) = 486.544 ft. Spans = 486.544 / 486.544 ft, against station differences of 500 / 500.
  - Skew sent = max(10, 15, 5) = 15.00°.
  - Girders −18 / −6 / 6 / 18 give spacings 12 / 12 / 12 ft and N_b = 4. O_L = −18 − (−24) = 6 ft, and O_R = 24 − 18 = 6 ft.
  - Example 2 (tangent): spans 150 × 3 (bearing-line choice: 147.5 / 145 / 147.5). Example 3 (curved): chord spans 124.582 / 124.166, against station differences 125 / 125.
- **How verified:**
  - `node --check` on all three inline scripts. The BridgeXfer copy is byte-identical to HANDOFF.md §5 and to the lldf.html copy.
  - jsdom end-to-end test with lldf (see `fixlog/lldf.md`, same PR).
  - **No result change:** the original and new file, loaded in jsdom, give identical Top-of-Deck, Beam-Seat and derived tables and identical `serializeProject()` for the default bridge and all 5 example bridges.
- **Other copies:** BridgeXfer v1 is also in index.html, lldf.html, psbeam.html, stgirder.html and Moving Load Generator.html.
- **Open items:**
  - O-H1. Deck thickness (`d_slab`) and beam depth are not sent; lldf's t_s and d stay as entered. Send them too?
  - O-H2. When skews differ between supports, lldf can only take one θ. The default is the largest |θ|: it is conservative for the shear correction, but it gives the largest moment reduction. Please confirm the default.

## 2026-10-05 — PR: claude/bridge-geometry-dxf (PR link added after merge)

Feature (**no calculation changes**): an **Export DXF** button that downloads the plan, and optionally the profile, as an ASCII DXF R12 drawing.

### X1. Export DXF (plan + optional profile)   [feature: export (no result change)]
- **Where:**
  - Header `.projbar`, right after the Import JSON file input. Anchor: `<input type="file" id="proj_file"` (hunk 1). New line:
    ```html
    <button class="sm ghost" id="dxf_export" type="button" title="Download the plan (alignment, supports, girders, deck edges, elevations) and optionally the profile as a DXF drawing, in State Plane or local coordinates.">Export DXF</button>
    ```
  - End of file: one new plain `<script>` block after the LL & DL hand-off script, before `</body>`. Anchor: `</script>\n</body>` (hunk 2). Exact code below.
- **Problem:** none (feature). There was no way to bring the computed geometry into Civil 3D / MicroStation over the survey base file.
- **What it does:**
  - The button opens an options dialog (same style as the LL & DL hand-off dialog): coordinates, content checkboxes, station tick interval (10/25/50/100/200 ft, default 50), alignment drawn past the abutments (default 100 ft), text height (blank = auto, about 1/200 of the plan size rounded down to a standard height), elevation decimals (2 as the tables, or 3), profile vertical exaggeration (default 5) and profile origin (blank = below the plan). The dialog shows the entity count and any warnings, then **Download DXF**.
  - **Coordinates.** *State Plane (E, N)* is the default when the POB Northing/Easting are not 0, 0; it uses the Site Map's own conversion (`engToUS` then `usftToMap`), so the drawing is in the Site Map's coordinate units: US survey ft or international ft (`$INSUNITS` 2) or meters (`$INSUNITS` 6, alignment feet converted from the POB exactly as the Site Map does). *Local* is x along the construction reference line from its point at Abut 1 toward Abut 2, y to the left, feet (`$INSUNITS` 2). Both are rigid (local) or scale + translation (State Plane) maps, so circular curves stay true arcs. Stations and elevation values are always feet. The basis (zone, EPSG code, units, or the local origin and bearing) is written in the title notes.
  - **Layers** (prefix `BG-`, R12 LAYER table with colours and linetypes CONTINUOUS / DASHED / CENTER, `$LTSCALE` = 2 × text height):
    - `BG-ALIGN` (CENTER): PGL over the abutment range ± margin. Tangents as LINE, circular curves as real ARC entities (centre from the curve's own start point and bearing, checked against its end and mid points; polyline fallback otherwise), spirals as POLYLINE through the spiral's own 200 interpolation nodes (so the polyline is the tool's spiral exactly).
    - `BG-ALIGN-TICK` station ticks normal to the PGL, and circles at key points; `BG-ALIGN-TEXT` station labels and PC / PT / TS / SC / CS / ST / POB / POE labels (`transitionLabel`).
    - `BG-BRG-CL` (CENTER): abutment and pier centerlines deck edge to deck edge along the skew (`ENG.deckAtSupport`), as the deck plan draws them; `BG-BRG` (DASHED): back / ahead bearing lines at dual-bearing piers; `BG-BRG-TEXT`: name, station, skew.
    - `BG-GIRDER`, `BG-DECK` (edges per span plus the two skewed deck ends), `BG-CURB` (DASHED; curb lines sampled per span as the Top-of-Deck table places them; only when curbs are entered), `BG-REFLINE` (CENTER; construction reference line, and the true deck CL per span where it differs). Spans run exactly as the deck plan draws them (`chordExtent` at the ends, `supportChordT` at piers).
    - `BG-ELEV-PT`: a POINT (z = top of deck, in drawing units) and an X marker at every girder × bearing-line point; `BG-ELEV-TEXT`: `TD` (top of deck) and `BS` (beam seat) values taken from `seatData()`, the Beam Seat table's own function.
    - `BG-PICK`: Site Map picked points (POINT at top-of-deck elevation, label, station, offset, TD), derived as `recomputePickPoints` does. Needs proj4 (left out with a warning when the map library did not load).
    - `BG-NOTES`: title block below the plan: project and bridge name, POB / POE and drawn station range, coordinate basis, vertical datum note, TD / BS / FG legend, layer list, date and "Generated by Bridge Geometry … Verify against the survey before use."
    - Profile (optional, below the notes): `BG-PROF` finished grade (`ENG.prof.elevAt`) with PVI / BVC / EVC markers, `BG-PROF-TAN` (DASHED) PVI tangents, `BG-PROF-GRID` frame and grid, `BG-PROF-BRG` (DASHED) bearing lines, `BG-PROF-TEXT` station / elevation labels, PVI / BVC / EVC labels (the tool's terms), grades, and at each bearing line `FG` (profile) and `TD@PGL` (the Top-of-Deck table's PGL column, `ENG.getDeckPoint(sta,0).z`).
  - Coordinates are written with up to 8 decimals (Gusset writer's `fmt`), e.g. `760168.83950272`.
  - Read-only on this tool's state: no engine function, project field, storage key or table changes. The export settings are kept in a **new** key `bridgeGeomEngine.dxfExport.v1` (this tool's prefix; per browser; read and written in try/catch; never part of the project JSON).
- **Governing provision:** n/a (drawing export; no calculation).
- **Check case (hand-checkable, Example 1 — Single-Span Tangent, State Plane US ft):** POB Sta 10+00, N 2950000, E 760000, bearing N90°E; abutments at 10+90 and 12+10; deck edges ±20 ft.
  - Abut 1 CL on `BG-BRG-CL` runs from (760090, 2950020) to (760090, 2949980): x = 760000 + 90, y = 2950000 ± 20 (left edge is north for an eastbound alignment). Exported exactly (the DXF holds `760090` / `2950020`).
  - Station tick 11+00 is centred at E 760100, N 2950000.
  - Elevation text at Abut 1, G3 (offset 0): TD 120.45 (profile 120 + 1.5 × 90/300 = 120.45; crown 2 % at offset 0 gives 0; HMA 0) and BS = 120.45 − (8 + 1.5 + 0 + 36 + 3)/12 = 116.41. The DXF reads `TD 120.45` / `BS 116.41`, the same as the Beam Seat table; G1/G5 (±16 ft) read TD 120.13 / BS 116.09 (120.45 − 0.02 × 16).
- **How verified:**
  - `node --check` on all four inline scripts.
  - **No result change:** the original and new file, loaded in jsdom, give identical Top-of-Deck tables (span-division and bearing-line modes), Beam-Seat table, derived-geometry and span summaries, and 63 sampled `getDeckPoint` x/y/z values, for the demo bridge, all 5 example bridges and a custom curved case (spiral–curve–spiral, left-hand R 900, skews 20 / −10 / 15, dual-bearing pier, per-span girder/edge override, per-support curb, HMA 2 in).
  - 42 exports (7 cases × State Plane US ft / State Plane meters / local, with and without profile) re-parsed by a small reader: alignment at 41 stations per case on `BG-ALIGN` within 1.9e-8 (tolerance 1e-4) using an independently written coordinate map; tick midpoints, support-CL endpoints and elevation points within 7e-9; POINT z within 5e-9; every `BS` text equal to the Beam Seat table cell text; every `TD` text equal to the Top-of-Deck "at bearing lines" table cell text (rows where the span has the global girder count); profile grade-line vertices within 4e-9 ft of `prof.elevAt`; profile `FG` / `TD@PGL` labels equal to `elevAt(sta).toFixed(2)` / `getDeckPoint(sta,0).z.toFixed(2)`; picked-point labels equal to the pick table; all entities inside `$EXTMIN/$EXTMAX`.
  - ezdxf 1.4.4: `recover.readfile` + `audit()` on all 48 files (42 variants, the fresh demo, 5 samples): 0 errors, 0 fixes; strict `readfile` OK. PNG renders (ezdxf matplotlib add-on) of the demo bridge, Example 3 (curved) and the custom case checked by eye against the plan and deck plan.
  - jsdom UI: the button and dialog render (10 content checkboxes), State Plane is disabled with POB 0, 0, Download produces an `application/dxf` file starting `0 SECTION 2 HEADER 9 $ACADVER 1 AC1009`, no runtime errors, `serializeProject()` and the stored `bridgeGeomEngine.project.v1` (both without `savedAt`) unchanged by opening the dialog and exporting.
- **Other copies:** the DXF R12 writer helpers (`fmt`, `enc`, LINE / POLYLINE / CIRCLE / TEXT emitters, HEADER / TABLES / LTYPE / LAYER / STYLE assembly) are adapted from `GPDXF.write` in **Gusset Plate Rating.html** (anchor `/* ---------- writer: ASCII DXF R12 (AC1009), CRLF ---------- */`). Added here: ARC, POINT, rotated / justified TEXT, per-call `$INSUNITS` and `$LTSCALE`. A fix to the shared parts belongs in both files.
- **Open items:**
  - O-X1. New storage key `bridgeGeomEngine.dxfExport.v1` should be added to the AUDIT.md key inventory (not edited here: one tool per PR).
  - O-X2. Profile labels use the tool's terms PVI / BVC / EVC (the request said VPI / VPC / VPT). Switch if the plans use the other set.
  - O-X3. No barrier is modelled, so there is no `BG-BARRIER` layer; curb lines go on `BG-CURB`.
  - O-X4. Vertical datum is not an input in the tool; the notes say "as entered".
- **Code added (hunk 2, exact):**
  ```html
<script>
/* ===== DXF export: plan (+ optional profile) as an ASCII DXF R12 drawing =====
   Everything is drawn from the same engine calls the plan, the deck plan and the output tables use
   (ENG.align elements, ENG.deckAtSupport, ENG.deckPointCW, ENG.chordExtent, ENG.supportChordT,
   seatData(), ENG.prof.elevAt, pickElev). Read-only on this tool's state: no geometry result, no
   project field and no saved format is changed. The only storage it touches is its own option key,
   bridgeGeomEngine.dxfExport.v1 (export settings, per browser).
   The writer helpers (fmt, enc, entity emitters, HEADER/TABLES assembly) are adapted from the DXF R12
   writer in Gusset Plate Rating.html (GPDXF.write). Shared snippet, kept duplicated (CLAUDE.md §3).
   Layers: BG-ALIGN, BG-ALIGN-TICK, BG-ALIGN-TEXT, BG-BRG-CL, BG-BRG, BG-BRG-TEXT, BG-GIRDER, BG-DECK,
   BG-CURB, BG-REFLINE, BG-ELEV-PT, BG-ELEV-TEXT, BG-PICK, BG-NOTES, BG-PROF, BG-PROF-TAN,
   BG-PROF-GRID, BG-PROF-BRG, BG-PROF-TEXT. */
(function(){
  'use strict';
  const OPT_KEY='bridgeGeomEngine.dxfExport.v1';
  const DEF={ coord:'auto', align:true, brg:true, girder:true, deck:true, curb:true, ref:true, elev:true,
    pick:true, notes:true, profile:true, tickInt:50, margin:100, textH:'', elevDec:2, profVE:5, profX:'', profY:'' };

  /* ---------- writer: ASCII DXF R12 (AC1009), CRLF (adapted from Gusset Plate Rating.html GPDXF.write) ---------- */
  const fmt = x => { let s = (Math.abs(x) < 5e-9 ? 0 : x).toFixed(8); if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, ''); return s === '-0' ? '0' : s; };
  function enc(s) { return String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[^\x20-\x7e]/g, c => { const cp = c.codePointAt(0); return '\\U+' + cp.toString(16).toUpperCase().padStart(4, '0'); }).slice(0, 250); }
  function makeWriter(){
    const L = [], ent = [], bb = [Infinity, Infinity, -Infinity, -Infinity];
    const grow = (x, y) => { if (!isFinite(x) || !isFinite(y)) return; bb[0] = Math.min(bb[0], x); bb[1] = Math.min(bb[1], y); bb[2] = Math.max(bb[2], x); bb[3] = Math.max(bb[3], y); };
    const g = (c, v) => ent.push(String(c).padStart(3), String(v));
    const ok = (...p) => p.every(q => isFinite(q[0]) && isFinite(q[1]));
    let n = 0;
    const W = {
      bb, count: () => n,
      layer(name, col, lt = 'CONTINUOUS') { if (!L.some(l => l[0] === name)) L.push([name, col, lt]); return name; },
      line(ly, a, b) { if (!ok(a, b)) return; n++; g(0, 'LINE'); g(8, ly); g(10, fmt(a[0])); g(20, fmt(a[1])); g(30, 0); g(11, fmt(b[0])); g(21, fmt(b[1])); g(31, 0); grow(a[0], a[1]); grow(b[0], b[1]); },
      pline(ly, pts, closed = false) { if (pts.length < 2 || !ok(...pts)) return; n++; g(0, 'POLYLINE'); g(8, ly); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, closed ? 1 : 0);
        pts.forEach(q => { g(0, 'VERTEX'); g(8, ly); g(10, fmt(q[0])); g(20, fmt(q[1])); g(30, 0); grow(q[0], q[1]); }); g(0, 'SEQEND'); g(8, ly); },
      circle(ly, c, r) { if (!ok(c) || !(r > 0)) return; n++; g(0, 'CIRCLE'); g(8, ly); g(10, fmt(c[0])); g(20, fmt(c[1])); g(30, 0); g(40, fmt(r)); grow(c[0] - r, c[1] - r); grow(c[0] + r, c[1] + r); },
      // counter-clockwise from a0 to a1 (degrees), as DXF defines an ARC
      arc(ly, c, r, a0, a1) { if (!ok(c) || !(r > 0)) return; n++; g(0, 'ARC'); g(8, ly); g(10, fmt(c[0])); g(20, fmt(c[1])); g(30, 0); g(40, fmt(r)); g(50, fmt(a0)); g(51, fmt(a1));
        let sw = ((a1 - a0) % 360 + 360) % 360; for (let k = 0; k <= 32; k++) { const t = (a0 + sw * k / 32) * Math.PI / 180; grow(c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)); } },
      point(ly, p, z) { if (!ok(p)) return; n++; g(0, 'POINT'); g(8, ly); g(10, fmt(p[0])); g(20, fmt(p[1])); g(30, fmt(isFinite(z) ? z : 0)); grow(p[0], p[1]); },
      // o = {rot (deg), ha 0 left / 1 center / 2 right, va 0 baseline / 1 bottom / 2 middle / 3 top}
      text(ly, at, h, s, o = {}) { if (!ok(at) || !(h > 0)) return; n++; const rot = o.rot || 0, ha = o.ha || 0, va = o.va || 0;
        g(0, 'TEXT'); g(8, ly); g(10, fmt(at[0])); g(20, fmt(at[1])); g(30, 0); g(40, fmt(h)); g(1, enc(s));
        if (rot) g(50, fmt(rot)); if (ha) g(72, ha); if (ha || va) { g(11, fmt(at[0])); g(21, fmt(at[1])); g(31, 0); } if (va) g(73, va);
        const w = 0.62 * h * String(s).length, x0 = ha === 1 ? -w / 2 : ha === 2 ? -w : 0, y0 = va === 2 ? -h / 2 : va === 3 ? -h : 0;
        const c = Math.cos(rot * Math.PI / 180), sn = Math.sin(rot * Math.PI / 180);
        [[x0, y0], [x0 + w, y0], [x0, y0 + h], [x0 + w, y0 + h]].forEach(q => grow(at[0] + q[0] * c - q[1] * sn, at[1] + q[0] * sn + q[1] * c)); },
      finish(hd) {
        const o = [], h = (c, v) => o.push(String(c).padStart(3), String(v));
        const b = isFinite(bb[0]) ? bb : [0, 0, 0, 0];
        h(0, 'SECTION'); h(2, 'HEADER');
        h(9, '$ACADVER'); h(1, 'AC1009'); h(9, '$INSBASE'); h(10, 0); h(20, 0); h(30, 0);
        h(9, '$EXTMIN'); h(10, fmt(b[0])); h(20, fmt(b[1])); h(30, 0); h(9, '$EXTMAX'); h(10, fmt(b[2])); h(20, fmt(b[3])); h(30, 0);
        h(9, '$LTSCALE'); h(40, fmt(hd.ltscale || 1)); h(9, '$INSUNITS'); h(70, hd.insunits || 0); h(0, 'ENDSEC');
        h(0, 'SECTION'); h(2, 'TABLES');
        h(0, 'TABLE'); h(2, 'LTYPE'); h(70, 3);
        h(0, 'LTYPE'); h(2, 'CONTINUOUS'); h(70, 0); h(3, 'Solid line'); h(72, 65); h(73, 0); h(40, 0);
        h(0, 'LTYPE'); h(2, 'DASHED'); h(70, 0); h(3, '__ __ __ __'); h(72, 65); h(73, 2); h(40, 0.75); h(49, 0.5); h(49, -0.25);
        h(0, 'LTYPE'); h(2, 'CENTER'); h(70, 0); h(3, '____ _ ____ _'); h(72, 65); h(73, 4); h(40, 2); h(49, 1.25); h(49, -0.25); h(49, 0.25); h(49, -0.25);
        h(0, 'ENDTAB');
        h(0, 'TABLE'); h(2, 'LAYER'); h(70, L.length); L.forEach(([nm, c, lt]) => { h(0, 'LAYER'); h(2, nm); h(70, 0); h(62, c); h(6, lt); }); h(0, 'ENDTAB');
        h(0, 'TABLE'); h(2, 'STYLE'); h(70, 1); h(0, 'STYLE'); h(2, 'STANDARD'); h(70, 0); h(40, 0); h(41, 1); h(50, 0); h(71, 0); h(42, 0.2); h(3, 'txt'); h(4, ''); h(0, 'ENDTAB');
        h(0, 'ENDSEC');
        h(0, 'SECTION'); h(2, 'BLOCKS'); h(0, 'ENDSEC');
        h(0, 'SECTION'); h(2, 'ENTITIES'); o.push(...ent); h(0, 'ENDSEC'); h(0, 'EOF');
        return { text: o.join('\r\n') + '\r\n', layers: L.map(l => l[0]) };
      }
    };
    return W;
  }

  /* ---------- small helpers ---------- */
  const deg = r => r * 180 / Math.PI;
  const n360 = a => ((a % 360) + 360) % 360;
  function niceH(v){ const L=[0.05,0.1,0.15,0.2,0.25,0.3,0.4,0.5,0.75,1,1.25,1.5,2,2.5,3,4,5,6,8,10,12,15,20,25,30,40,50];
    let best=L[0]; L.forEach(x=>{ if(x<=v) best=x; }); return best; }
  // reading direction kept upright: returns {rot, flip}
  function upright(v){ let a=n360(deg(Math.atan2(v[1],v[0]))); const flip=(a>90+1e-9 && a<=270+1e-9); if(flip) a=n360(a+180); return {rot:a, flip}; }
  function unit(v){ const l=Math.hypot(v[0],v[1])||1; return [v[0]/l, v[1]/l]; }
  const add=(p,v,s)=>[p[0]+v[0]*s, p[1]+v[1]*s];
  const r4=x=>+(+x).toFixed(4);
  function hasSP(){ const P=mapPOB(); return (P.x!==0 || P.y!==0); }
  function zoneText(){ const s=document.getElementById('map_datum'); return s&&s.selectedOptions&&s.selectedOptions[0]?s.selectedOptions[0].text:''; }
  function unitsText(){ const s=document.getElementById('map_units'); return s&&s.selectedOptions&&s.selectedOptions[0]?s.selectedOptions[0].text:'US survey ft'; }

  /* Build the DXF. opt as DEF. Returns {text, layers, warnings, stats, frame} or {error}. frame (the
     coordinate map) is returned for verification only. */
  function build(opt){
    const o=Object.assign({}, DEF, opt||{});
    const gErr=geometryInputErrors();
    if(gErr.length) return {error:'Fix the geometry input errors first: '+gErr[0]};
    const E=ENG; const su=sortedUnits();
    if(!E) return {error:'Compute the bridge first.'};
    if(su.length<2 || !E.chord) return {error:'Define at least two supports (Abut 1 and Abut 2) first.'};
    const warnings=[];
    const CH=E.chord;
    let coord=o.coord==='auto' ? (hasSP()?'sp':'local') : o.coord;
    if(coord==='sp' && !hasSP()) warnings.push('The POB Northing/Easting are 0, 0, so the "State Plane" coordinates are just the alignment frame.');
    // ---- coordinate frame: engine (x = E, y = N, feet from the POB) -> drawing (X, Y) ----
    let T, k, insunits, basis=[];
    if(coord==='sp'){
      // the Site Map's own conversion: POB in the chosen units, alignment geometry in feet (engToUS / usftToMap)
      T=(x,y)=>{ const u=engToUS(x,y); return [usftToMap(u.E), usftToMap(u.N)]; };
      k=usftToMap(1); insunits=(mapUnits()==='m')?6:2;
      basis.push('Coordinates: State Plane Easting (X), Northing (Y). Zone: '+zoneText()+', EPSG:'+mapEpsg()+'. Units: '+unitsText()+' (as set on the Site Map tab).');
      if(mapUnits()!=='usft') basis.push('The POB is in '+unitsText()+'; the alignment geometry (feet) is converted from the POB, as the Site Map does. Elevations and stations stay in feet.');
    } else {
      const O=CH.P1, ux=CH.ux, uy=CH.uy;
      T=(x,y)=>{ const dx=x-O.x, dy=y-O.y; return [dx*ux+dy*uy, -dx*uy+dy*ux]; };
      k=1; insunits=2;
      basis.push('Coordinates: local. Origin = construction reference line at Abut 1 (Sta '+formatStation(CH.s1)+', N '+O.y.toFixed(4)+', E '+O.x.toFixed(4)+').');
      basis.push('+X along the reference line toward Abut 2 (bearing '+azimuthToQuadrant(n360(deg(Math.atan2(ux,uy))))+'), +Y to the left. Units: feet.');
    }
    const TP=p=>T(p.x,p.y);
    const W=makeWriter();
    const LY={
      align:W.layer('BG-ALIGN',1,'CENTER'), tick:W.layer('BG-ALIGN-TICK',1), atext:W.layer('BG-ALIGN-TEXT',1),
      brgcl:W.layer('BG-BRG-CL',4,'CENTER'), brg:W.layer('BG-BRG',5,'DASHED'), btext:W.layer('BG-BRG-TEXT',4),
      gird:W.layer('BG-GIRDER',8), deck:W.layer('BG-DECK',7), curb:W.layer('BG-CURB',3,'DASHED'), ref:W.layer('BG-REFLINE',6,'CENTER'),
      ept:W.layer('BG-ELEV-PT',2), etext:W.layer('BG-ELEV-TEXT',2), pick:W.layer('BG-PICK',30), notes:W.layer('BG-NOTES',7),
      prof:W.layer('BG-PROF',1), ptan:W.layer('BG-PROF-TAN',8,'DASHED'), pgrid:W.layer('BG-PROF-GRID',9), pbrg:W.layer('BG-PROF-BRG',4,'DASHED'), ptext:W.layer('BG-PROF-TEXT',7)
    };
    const s1=su[0].sta, s2=su[su.length-1].sta;
    const margin=Math.max(0, +o.margin||0);
    const sA=Math.max(E.align.staStart, s1-margin), sB=Math.min(E.align.staEnd, s2+margin);
    const bw=bridgeCL();
    const lineCW=(ly,tA,tB,w)=>W.line(ly, TP(E.deckPointCW(tA,w)), TP(E.deckPointCW(tB,w)));
    // per-span chord-parallel line at a PGL-coord offset, ends exactly as the deck plan draws them
    // (end spans run to the skewed deck end, interior ends at the support's chord station)
    function spanLine(ly, i, off){ const w=off-bw, ext=E.chordExtent(w);
      const tA=(i===0)?ext.t0:E.supportChordT(su[i].sta), tB=(i===su.length-2)?ext.t1:E.supportChordT(su[i+1].sta);
      lineCW(ly,tA,tB,w); }

    /* ===== 1. plan linework (geometry first, so the text height can be scaled to it) ===== */
    const alignStats={lines:0, arcs:0, plines:0};
    if(o.align){
      const els=E.align.elems, typed=(els.length===ELEMS.length);
      els.forEach((el,i)=>{
        const a=Math.max(sA,el.staStart), b=Math.min(sB,el.staEnd); if(!(b-a>1e-6)) return;
        const typ=typed?elemType(i):'?';
        if(typ==='tan'){ W.line(LY.align, TP(el.at(a)), TP(el.at(b))); alignStats.lines++; return; }
        if(typ==='crv'){
          const pa=el.at(a), pb=el.at(b), pm=el.at((a+b)/2), kk=(pb.brg-pa.brg)/(b-a);
          if(Math.abs(kk)>1e-12){
            // centre from the curve's own start point and bearing (makeCurve), checked against its end and mid points
            const cx=pa.x+Math.cos(pa.brg)/kk, cy=pa.y-Math.sin(pa.brg)/kk, r=1/Math.abs(kk);
            if([pb,pm].every(p=>Math.abs(Math.hypot(p.x-cx,p.y-cy)-r)<1e-6)){
              const C=T(cx,cy), A=TP(pa), B=TP(pb), M=TP(pm);
              const an=P=>n360(deg(Math.atan2(P[1]-C[1],P[0]-C[0])));
              const a0=an(A), a1=an(B), am=an(M);
              const ccw=n360(am-a0) < n360(a1-a0);
              W.arc(LY.align, C, r*k, ccw?a0:a1, ccw?a1:a0); alignStats.arcs++; return;
            }
          }
        }
        // spiral (or anything else): polyline through the element's own interpolation nodes
        const N=200, Lel=el.staEnd-el.staStart, sts=[a];
        for(let j=1;j<N;j++){ const s=el.staStart+Lel*j/N; if(s>a+1e-9 && s<b-1e-9) sts.push(s); }
        sts.push(b); W.pline(LY.align, sts.map(s=>TP(el.at(s)))); alignStats.plines++;
      });
    }
    if(o.ref){
      const e0=E.chordExtent(0); lineCW(LY.ref, e0.t0, e0.t1, 0);
      // true deck centerline, per span, where it differs from the reference line (as the deck plan draws it)
      for(let i=0;i<su.length-1;i++){ const dcl=deckCenterOffset(i+1); if(Math.abs(dcl-bw)>1e-6) spanLine(LY.ref, i, dcl); }
    }
    if(o.deck){
      for(let i=0;i<su.length-1;i++){ const ed=edgesForSpan(i+1); spanLine(LY.deck,i,ed.l); spanLine(LY.deck,i,ed.r); }
      // deck ends along the abutment skew lines
      [su[0], su[su.length-1]].forEach((u,j)=>{ const ed=edgesForSpan(j===0?1:su.length-1);
        W.line(LY.deck, TP(E.deckAtSupport({sta:u.sta,skew:u.skew},ed.l)), TP(E.deckAtSupport({sta:u.sta,skew:u.skew},ed.r))); });
    }
    if(o.girder){ for(let i=0;i<su.length-1;i++) girdersForSpan(i+1).forEach(off=>spanLine(LY.gird,i,off)); }
    if(o.curb){
      const anyCurb=['curb_l','curb_r'].some(id=>{ const el=document.getElementById(id); return el&&el.value!==''; }) || su.some(u=>(u.curbL!=null&&u.curbL!=='')||(u.curbR!=null&&u.curbR!==''));
      if(anyCurb){ ['L','R'].forEach(side=>{ const pts=[];
        for(let i=0;i<su.length-1;i++){ const a=su[i].sta, b=su[i+1].sta, n=10;
          for(let j=(i===0?0:1);j<=n;j++){ const s=a+(b-a)*j/n; pts.push(TP(E.deckPointCW(E.supportChordT(s), curbAt(s,side)-bw))); } }
        W.pline(LY.curb, pts); }); }
    }
    const supLines=[];   // {u, A, B, bl?}
    if(o.brg || o.elev){
      su.forEach(u=>{ const span=Math.max(1,Math.min(su.length-1,spanOfSta(u.sta))), ed=edgesForSpan(span);
        const A=TP(E.deckAtSupport({sta:u.sta,skew:u.skew},ed.l)), B=TP(E.deckAtSupport({sta:u.sta,skew:u.skew},ed.r));
        supLines.push({u, A, B, cl:true});
        bearingLinesFor(u).forEach(bl=>{ if(Math.abs(bl.sta-u.sta)<1e-6) return;
          const ed2=edgesForSpan(bearingSpan(u,bl,su));
          supLines.push({u, bl, A:TP(E.deckAtSupport(bl,ed2.l)), B:TP(E.deckAtSupport(bl,ed2.r)), cl:false}); }); });
      if(o.brg) supLines.forEach(s=>W.line(s.cl?LY.brgcl:LY.brg, s.A, s.B));
    }
    const geomBB=W.bb.slice();
    const ext=Math.max(geomBB[2]-geomBB[0], geomBB[3]-geomBB[1]);
    const h=(+o.textH>0)?+o.textH:niceH(isFinite(ext)&&ext>0?ext/200:1);
    const dec=(+o.elevDec===3)?3:2;
    // drawing direction of the chord (up-station along the bridge)
    const chordDir=unit((()=>{ const a=T(CH.P1.x,CH.P1.y), b=T(CH.P2.x,CH.P2.y); return [b[0]-a[0], b[1]-a[1]]; })());

    /* ===== 2. alignment ticks, station labels and key points ===== */
    if(o.align){
      const iv=Math.max(1,+o.tickInt||50), hl=0.75*h/k;
      for(let st=Math.ceil((sA-1e-9)/iv)*iv; st<=sB+1e-6; st+=iv){
        const a=E.align.at(st), nr=a.brg+Math.PI/2, rn=[Math.sin(nr),Math.cos(nr)];   // right normal (engine)
        const p0=[a.x+rn[0]*hl, a.y+rn[1]*hl], p1=[a.x-rn[0]*hl, a.y-rn[1]*hl];
        W.line(LY.tick, T(p0[0],p0[1]), T(p1[0],p1[1]));
        const L0=T(p1[0],p1[1]), P=TP(a), dir=unit([L0[0]-P[0], L0[1]-P[1]]), u=upright(dir), at=add(L0,dir,0.4*h);
        W.text(LY.atext, at, h, formatStation(st), {rot:u.rot, ha:u.flip?2:0, va:2});
      }
      const els=E.align.elems, keys=[];
      for(let i=0;i<els.length-1;i++){ const lbl=transitionLabel(elemType(i), elemType(i+1)); if(lbl) keys.push([lbl, els[i].staEnd]); }
      keys.push(['POB', E.align.staStart], ['POE', E.align.staEnd]);
      keys.forEach(([lbl,st])=>{ if(st<sA-1e-6 || st>sB+1e-6) return;
        const a=E.align.at(st), P=TP(a), nr=a.brg+Math.PI/2, Q=T(a.x+Math.sin(nr), a.y+Math.cos(nr)), dir=unit([Q[0]-P[0],Q[1]-P[1]]), u=upright(dir);
        W.circle(LY.tick, P, 0.4*h);
        W.text(LY.atext, add(P,dir,1.2*h), h, lbl+' '+formatStation(st), {rot:u.rot, ha:u.flip?2:0, va:2}); });
    }

    /* ===== 3. support / bearing labels ===== */
    if(o.brg){
      supLines.forEach(s=>{
        if(s.cl){ const dir=unit([s.A[0]-s.B[0], s.A[1]-s.B[1]]), u=upright(dir), U=s.u;
          const txt=U.name+' CL  Sta '+formatStation(U.sta)+'  Skew '+(+(+U.skew||0).toFixed(4))+'°';
          W.text(LY.btext, add(s.A,dir,0.8*h), h, txt, {rot:u.rot, ha:u.flip?2:0, va:2});
        } else { const dir=unit([s.B[0]-s.A[0], s.B[1]-s.A[1]]), u=upright(dir);
          const rd=u.flip?[-dir[0],-dir[1]]:dir, up=[-rd[1], rd[0]];          // reading direction and its "up"
          const ahead=s.bl.sta>s.u.sta, upIsAhead=(up[0]*chordDir[0]+up[1]*chordDir[1])>0;
          W.text(LY.btext, add(s.B,dir,0.6*h), 0.7*h, s.bl.label+'  Sta '+formatStation(s.bl.sta), {rot:u.rot, ha:u.flip?2:0, va:(ahead===upIsAhead)?1:3});
        }
      });
    }

    /* ===== 4. elevations at girder x bearing-line points (the Beam-Seat table's own data) ===== */
    let elevCount=0;
    if(o.elev){
      const ur=upright(chordDir), rd=ur.flip?[-chordDir[0],-chordDir[1]]:chordDir, up=[-rd[1], rd[0]];
      seatData().forEach(r=>{
        const back=(r.sta<r.unit.sta-1e-9) || (r.unit===su[su.length-1]);   // label into the span this bearing serves
        const side=back?-1:1;                                                 // -1 = down-station side
        const ha=(side*(rd[0]*chordDir[0]+rd[1]*chordDir[1])>0)?0:2;
        r.seats.forEach(s=>{ const p=E.deckAtSupport({sta:r.sta, skew:r.skew}, s.off), P=TP(p);
          W.point(LY.ept, P, s.deckZ*k); const c=0.3*h;
          W.line(LY.ept, [P[0]-c,P[1]-c], [P[0]+c,P[1]+c]); W.line(LY.ept, [P[0]-c,P[1]+c], [P[0]+c,P[1]-c]);
          const at=add(P, chordDir, side*0.6*h);
          W.text(LY.etext, add(at,up,0.2*h), 0.8*h, 'TD '+s.deckZ.toFixed(dec), {rot:ur.rot, ha, va:1});
          W.text(LY.etext, add(at,up,-0.2*h), 0.8*h, 'BS '+s.seatZ.toFixed(dec), {rot:ur.rot, ha, va:3});
          elevCount++; });
      });
    }

    /* ===== 5. picked points (Site Map) ===== */
    let pickCount=0;
    if(o.pick && typeof PICKPTS!=='undefined' && PICKPTS.length){
      if(typeof proj4==='undefined') warnings.push('Picked points were left out: the map library (proj4) did not load, so their positions cannot be converted.');
      else PICKPTS.forEach(p=>{ try{
        // the same derivation the pick table uses (recomputePickPoints)
        const eg=llToEng(p.lat,p.lng), pr=E.deckPointAtXY(eg.x,eg.y), el=pickElev(pr.sta,pr.off,{x:eg.x,y:eg.y}), P=T(eg.x,eg.y);
        W.point(LY.pick, P, el?el.deck*k:0); W.circle(LY.pick, P, 0.35*h);
        W.text(LY.pick, add(P,[1,1],0.5*h), 0.8*h, p.label||'', {va:1});
        W.text(LY.pick, add(P,[1,-1],0.5*h), 0.6*h, 'Sta '+formatStation(pr.sta)+'  Off '+pr.off.toFixed(2)+(el?'  TD '+el.deck.toFixed(3):'')+(el&&el.outside?' (outside deck)':''), {va:3});
        pickCount++; }catch(e){ warnings.push('Picked point '+(p.label||'')+' could not be converted.'); } });
    }

    /* ===== 6. title block notes, below the plan ===== */
    const planBB=W.bb.slice();
    let yCur=planBB[1]-3*h;
    if(o.notes){
      const shared=(window.BridgeXfer&&BridgeXfer.sharedProject&&BridgeXfer.sharedProject())||null;
      const lines=[
        ['BRIDGE GEOMETRY - PLAN'+(o.profile?' AND PROFILE':''), 1.5*h],
        ['Project: '+((shared&&shared.name)||'-')+'   Bridge: '+((typeof CURRENT_NAME!=='undefined'&&CURRENT_NAME)||'(unsaved)'), h],
        ['Alignment: POB Sta '+formatStation(E.align.staStart)+', N '+(+document.getElementById('h_y0').value||0)+', E '+(+document.getElementById('h_x0').value||0)+', bearing '+azimuthToQuadrant(parseBearingToAzimuth(document.getElementById('h_brg0').value)||0)+'; POE Sta '+formatStation(E.align.staEnd)+'. Drawn Sta '+formatStation(sA)+' to '+formatStation(sB)+'.', h],
        ...basis.map(t=>[t,h]),
        ['Vertical datum: as entered in the vertical profile (not specified in the tool). Elevations and stations in feet.', h],
        ['TD = top of deck, BS = beam seat at each girder x bearing line (Beam Seat Output tab). FG = finished grade = profile (top of pavement).', h],
        ['Layers: BG-ALIGN (PGL, arcs = circular curves, polylines = spirals), -TICK, -TEXT; BG-BRG-CL support CL; BG-BRG bearing lines; BG-GIRDER; BG-DECK; BG-CURB; BG-REFLINE; BG-ELEV-PT/-TEXT; BG-PICK; BG-PROF*.', h],
        ['Generated by Bridge Geometry (Bridge Geometry.html) on '+new Date().toISOString().slice(0,16).replace('T',' ')+'. Verify against the survey before use.', h]
      ];
      lines.forEach(([t,hh])=>{ W.text(LY.notes, [planBB[0], yCur], hh, t); yCur-=1.7*hh; });
      yCur-=2*h;
    }

    /* ===== 7. profile along the PGL ===== */
    let profFrame=null;
    if(o.profile){
      const VE=(+o.profVE>0)?+o.profVE:5, n=Math.min(2000, Math.max(50, Math.ceil((sB-sA)/2)));
      const S=[], Z=[]; for(let i=0;i<=n;i++){ const s=sA+(sB-sA)*i/n; S.push(s); Z.push(E.prof.elevAt(s)); }
      const zmin=Math.min(...Z), zmax=Math.max(...Z);
      let ei=1; [0.5,1,2,5,10,20,50,100].some(c=>{ ei=c; return (zmax-zmin)/c<=8 && c*VE*k>=1.5*h; });   // labels must not overlap
      const zlo=Math.floor(zmin/ei)*ei-ei, zhi=Math.ceil(zmax/ei)*ei+ei;
      const Hgt=(zhi-zlo)*VE*k;
      // bearing-line labels stand above the frame: reserve their length so they clear the notes
      const brgTxt=[]; su.forEach(u=>bearingLinesFor(u).forEach(bl=>{ if(bl.sta<sA-1e-6||bl.sta>sB+1e-6) return;
        const fg=E.prof.elevAt(bl.sta), td=E.getDeckPoint(bl.sta,0).z;
        brgTxt.push([bl, fg, bl.label+'  Sta '+formatStation(bl.sta)+'  FG '+fg.toFixed(dec)+'  TD@PGL '+td.toFixed(dec)]); }));
      const topGap=2*h+Math.max(0,...brgTxt.map(b=>0.62*0.7*h*b[2].length));
      const X0=(o.profX!==''&&isFinite(+o.profX))?+o.profX:planBB[0];
      const Y0=(o.profY!==''&&isFinite(+o.profY))?+o.profY:(yCur-topGap-Hgt);
      const PX=s=>X0+(s-sA)*k, PY=z=>Y0+(z-zlo)*VE*k;
      profFrame={X0,Y0,sA,zlo,VE,k};
      W.pline(LY.pgrid, [[PX(sA),PY(zlo)],[PX(sB),PY(zlo)],[PX(sB),PY(zhi)],[PX(sA),PY(zhi)]], true);
      const iv=Math.max(1,+o.tickInt||50), siv=((sB-sA)/iv>40)?stationInterval(sB-sA):iv;
      for(let st=Math.ceil((sA-1e-9)/siv)*siv; st<=sB+1e-6; st+=siv){ W.line(LY.pgrid,[PX(st),PY(zlo)],[PX(st),PY(zhi)]);
        W.text(LY.ptext,[PX(st),PY(zlo)-0.6*h],0.8*h,formatStation(st),{rot:90,ha:2,va:2}); }
      for(let z=zlo; z<=zhi+1e-9; z+=ei){ W.line(LY.pgrid,[PX(sA),PY(z)],[PX(sB),PY(z)]);
        W.text(LY.ptext,[PX(sA)-0.6*h,PY(z)],0.8*h,(+z.toFixed(3)).toFixed(ei<1?1:0),{ha:2,va:2}); }
      W.pline(LY.prof, S.map((s,i)=>[PX(s),PY(Z[i])]));
      // PVI tangents (dashed), clipped to the drawn station range
      const pv=E.prof.pvis;
      for(let i=0;i<pv.length-1;i++){ const a=pv[i], b=pv[i+1]; const ca=Math.max(sA,a.sta), cb=Math.min(sB,b.sta); if(!(cb>ca)) continue;
        const zf=s=>a.elev+(b.elev-a.elev)*(s-a.sta)/(b.sta-a.sta); W.line(LY.ptan,[PX(ca),PY(zf(ca))],[PX(cb),PY(zf(cb))]);
        const sm=(ca+cb)/2; W.text(LY.ptext,[PX(sm),PY(zf(sm))+1.2*h],0.8*h,((a.gradeOut*100)>=0?'+':'')+(a.gradeOut*100).toFixed(3)+'%',{ha:1,va:1}); }
      pv.forEach((v,i)=>{ if(v.sta<sA-1e-6||v.sta>sB+1e-6) return;
        const nm=(i===0)?'START':(i===pv.length-1)?'END':'PVI';
        W.circle(LY.prof,[PX(v.sta),PY(v.elev)],0.35*h);
        W.text(LY.ptext,[PX(v.sta),PY(v.elev)+1.0*h],0.8*h,nm+' '+formatStation(v.sta)+'  EL '+v.elev.toFixed(3)+(v.L>0?'  VC '+(+v.L.toFixed(3))+' ft':''),{ha:1,va:1});
        if(v.L>0) [['BVC',v.sta-v.L/2],['EVC',v.sta+v.L/2]].forEach(([t,st])=>{ if(st<sA-1e-6||st>sB+1e-6) return; const z=E.prof.elevAt(st);
          W.circle(LY.prof,[PX(st),PY(z)],0.25*h);
          W.text(LY.ptext,[PX(st),PY(z)-1.0*h],0.7*h,t+' '+formatStation(st)+'  EL '+z.toFixed(3),{ha:1,va:3}); }); });
      // bearing lines: finished grade (profile) and top of deck on the PGL, as the Top-of-Deck table's PGL column
      brgTxt.forEach(([bl,fg,t])=>{
        W.line(LY.pbrg,[PX(bl.sta),PY(zlo)],[PX(bl.sta),PY(zhi)+0.5*h]);
        W.text(LY.ptext,[PX(bl.sta)-0.15*h,PY(zhi)+0.8*h],0.7*h,t,{rot:90,va:0}); });
      const yT=PY(zlo)-0.6*h-0.62*0.8*h*11-1.5*h;   // below the rotated station labels
      W.text(LY.ptext,[PX(sA),yT],1.2*h,'PROFILE ALONG PGL - FINISHED GRADE (TOP OF PAVEMENT) - VERTICAL EXAGGERATION '+VE+'x');
      W.text(LY.ptext,[PX(sA),yT-1.6*h],0.7*h,'Horizontal: 1 drawing unit = '+(k===1?'1 ft':(1/k).toFixed(6)+' ft')+' of station from Sta '+formatStation(sA)+'. Vertical: elevation x '+VE+', datum EL '+zlo+' ft at the bottom of the frame.');
    }

    const out=W.finish({insunits, ltscale:Math.max(0.01, 2*h)});
    return { text:out.text, layers:out.layers, warnings, coord, k, h, stats:{entities:W.count(), align:alignStats, elev:elevCount, pick:pickCount},
      frame:{T, profFrame} };
  }

  /* ---------- options (per browser, own key) ---------- */
  function loadOpts(){ try{ const r=localStorage.getItem(OPT_KEY); if(r){ const p=JSON.parse(r); if(p&&typeof p==='object') return Object.assign({},DEF,p); } }catch(e){} return Object.assign({},DEF); }
  function saveOpts(o){ try{ localStorage.setItem(OPT_KEY, JSON.stringify(o)); }catch(e){} }

  /* ---------- dialog ---------- */
  let dlg=null;
  const CHK=[['align','alignment (PGL), station ticks &amp; labels, PC/PT/TS/SC points'],['brg','support centerlines &amp; bearing lines, with labels'],
    ['girder','girder lines'],['deck','deck edges &amp; deck ends'],['curb','curb lines'],['ref','construction reference line &amp; deck CL'],
    ['elev','elevations at girder &times; bearing points (TD, BS)'],['pick','picked points (Site Map)'],['notes','title block notes'],['profile','profile view (below the plan)']];
  function readDlg(){ const q=id=>dlg.querySelector('#'+id), o={};
    o.coord=q('dxf_coord').value; CHK.forEach(([k])=>o[k]=q('dxf_c_'+k).checked);
    o.tickInt=+q('dxf_tick').value; o.margin=+q('dxf_margin').value; o.textH=q('dxf_th').value.trim(); o.elevDec=+q('dxf_dec').value;
    o.profVE=+q('dxf_ve').value; o.profX=q('dxf_px').value.trim(); o.profY=q('dxf_py').value.trim(); return o; }
  function refresh(){
    const o=readDlg(), msg=dlg.querySelector('#dxf_msg');
    const r=build(o); const okb=dlg.querySelector('#dxf_do');
    if(r.error){ okb.disabled=true; msg.innerHTML='<span style="color:var(--oxide)">'+r.error.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))+'</span>'; return null; }
    okb.disabled=false;
    msg.innerHTML=(r.coord==='sp'?'State Plane':'Local')+' &middot; '+r.stats.entities+' entities on '+r.layers.length+' layers &middot; text height '+r.h+' &middot; '+(r.text.length/1024).toFixed(0)+' KB'
      +(r.warnings.length?'<br><span style="color:var(--oxide)">'+r.warnings.join('<br>')+'</span>':'');
    return r;
  }
  function openDlg(){
    if(!dlg){
      dlg=document.createElement('div'); dlg.className='noprint'; dlg.id='dxf_dlg';
      dlg.style.cssText='position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.35);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:40px 12px';
      dlg.innerHTML='<div style="background:var(--vellum);color:var(--ink);border:1px solid var(--ink);max-width:680px;width:100%;padding:14px 16px;font-size:13px">'
        +'<h2 class="sec" style="margin-top:0">Export DXF (plan, optional profile)</h2>'
        +'<p class="note" style="margin-top:0">An ASCII DXF (R12) of the computed geometry: the same alignment, deck, girder and support lines as the plan and deck plan, and the elevations from the output tables. For the survey base file in Civil 3D or MicroStation.</p>'
        +'<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">'
        +'<div><label>Coordinates</label><select id="dxf_coord"><option value="sp">State Plane (E, N)</option><option value="local">Local (x along ref line, y left)</option></select></div>'
        +'<div><label>Station ticks every <span class="unit">(ft)</span></label><select id="dxf_tick"><option>10</option><option>25</option><option selected>50</option><option>100</option><option>200</option></select></div>'
        +'<div><label>Alignment past abutments <span class="unit">(ft)</span></label><input type="number" id="dxf_margin" min="0" step="10"></div>'
        +'<div><label>Text height <span class="unit">(drawing units)</span></label><input type="text" id="dxf_th" placeholder="auto"></div>'
        +'<div><label>Elevation decimals</label><select id="dxf_dec"><option value="2">2 (as the tables)</option><option value="3">3</option></select></div>'
        +'<div></div>'
        +'<div><label>Profile vert. exaggeration</label><input type="number" id="dxf_ve" min="1" step="1"></div>'
        +'<div><label>Profile origin X</label><input type="text" id="dxf_px" placeholder="auto (below plan)"></div>'
        +'<div><label>Profile origin Y</label><input type="text" id="dxf_py" placeholder="auto (below plan)"></div>'
        +'</div>'
        +'<div style="display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:10px">'+CHK.map(([k,t])=>'<label class="cfg"><input type="checkbox" id="dxf_c_'+k+'"> '+t+'</label>').join('')+'</div>'
        +'<p class="note" id="dxf_basis" style="margin:8px 0 0"></p>'
        +'<p class="note" style="margin:6px 0 0">Layers: <b>BG-ALIGN</b> (PGL; circular curves as arcs, spirals as polylines), <b>BG-ALIGN-TICK</b>, <b>BG-ALIGN-TEXT</b>; <b>BG-BRG-CL</b> support centerlines, <b>BG-BRG</b> back/ahead bearing lines, <b>BG-BRG-TEXT</b>; <b>BG-GIRDER</b>; <b>BG-DECK</b>; <b>BG-CURB</b>; <b>BG-REFLINE</b>; <b>BG-ELEV-PT</b> (points at top-of-deck elevation) and <b>BG-ELEV-TEXT</b> (TD / BS); <b>BG-PICK</b>; <b>BG-NOTES</b>; profile on <b>BG-PROF</b>, <b>BG-PROF-TAN</b>, <b>BG-PROF-GRID</b>, <b>BG-PROF-BRG</b>, <b>BG-PROF-TEXT</b>. Verify against the survey.</p>'
        +'<p class="note" id="dxf_msg" style="margin:8px 0 0"></p>'
        +'<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="sm" id="dxf_do" type="button">Download DXF</button>'
        +'<button class="sm ghost" id="dxf_cancel" type="button" style="margin-left:auto">Cancel</button></div></div>';
      document.body.appendChild(dlg);
      dlg.addEventListener('change', refresh);
      dlg.querySelector('#dxf_cancel').addEventListener('click',()=>{ dlg.style.display='none'; });
      dlg.querySelector('#dxf_do').addEventListener('click',()=>{
        const r=refresh(); if(!r) return;
        const o=readDlg(); saveOpts(o);
        const nm=String((typeof CURRENT_NAME!=='undefined'&&CURRENT_NAME)||'bridge').replace(/[^A-Za-z0-9._-]+/g,'_').slice(0,60);
        const blob=new Blob([r.text],{type:'application/dxf'}); const a=document.createElement('a');
        a.href=URL.createObjectURL(blob); a.download='bridge-geometry_'+nm+'_'+(r.coord==='sp'?'stateplane':'local')+'_'+new Date().toISOString().slice(0,10)+'.dxf';
        document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 60000);
        dlg.style.display='none'; setStatus('DXF exported');
      });
    }
    const o=loadOpts(), q=id=>dlg.querySelector('#'+id), sp=hasSP();
    const cs=q('dxf_coord'); cs.querySelector('option[value=sp]').disabled=!sp;
    cs.value=(o.coord==='sp'&&sp)?'sp':(o.coord==='local'?'local':(sp?'sp':'local'));
    CHK.forEach(([k])=>q('dxf_c_'+k).checked=!!o[k]);
    q('dxf_tick').value=String(o.tickInt); if(!q('dxf_tick').value) q('dxf_tick').value='50';
    q('dxf_margin').value=o.margin; q('dxf_th').value=o.textH; q('dxf_dec').value=String(o.elevDec===3?3:2);
    q('dxf_ve').value=o.profVE; q('dxf_px').value=o.profX; q('dxf_py').value=o.profY;
    q('dxf_basis').textContent=sp?('State Plane uses the POB Northing/Easting and the datum and units on the Site Map tab ('+zoneText()+', '+unitsText()+').')
      :'State Plane is not available: the POB Northing/Easting are 0, 0. Enter them on the Alignment tab to export in State Plane.';
    dlg.style.display='flex';
    refresh();
  }
  window.bgDxfBuild=build; window.bgDxfOpen=openDlg;
  const b=document.getElementById('dxf_export'); if(b) b.addEventListener('click',openDlg);
})();
</script>
  ```
