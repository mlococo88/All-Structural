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
