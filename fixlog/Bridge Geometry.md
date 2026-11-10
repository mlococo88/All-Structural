# Fix log — Bridge Geometry.html

Governing basis used for fixes: none (route-surveying geometry; no design code governs this tool). EPSG registry for State Plane codes.

## 2026-10-04 — PR: claude/fix-bridge-geometry (PR #25: https://github.com/mlococo88/All-Structural/pull/25)

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

## 2026-10-04 — PR: claude/step1-group1 (PR #28: https://github.com/mlococo88/All-Structural/pull/28)

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

## 2026-10-04 — PR: claude/conn-geometry-lldf (PR #35: https://github.com/mlococo88/All-Structural/pull/35)

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

## 2026-10-05 — PR: claude/bridge-geometry-dxf (PR #51: https://github.com/mlococo88/All-Structural/pull/51)

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

## 2026-10-06 — PR: claude/bridge-geometry-datum (PR #52: https://github.com/mlococo88/All-Structural/pull/52)

Feature (**no calculation changes**): a **Vertical datum** label on the Alignment tab, shown on the output tables, prints, the profile graphic and the DXF export. Engineer's decisions 2026-10-06: add the field; keep the profile labels PVI / BVC / EVC (closes O-X2 as "keep"; O-X4 is resolved by this entry).

### D1. Vertical datum field (label only)   [feature (no result change)] [saved data: additive field]
- **Where (anchors; line numbers approximate):**
  1. Alignment tab, Vertical Profile fieldset (~line 211). Anchor: `<legend>PVIs · first row is Start point`. Inserted directly after the legend line:
     ```html
           <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin-bottom:8px;">
             <div><label>Vertical datum</label><select id="vdatum_sys" title="Vertical datum of the elevations entered below. Label only — no datum conversion is applied. Shown on the output tables, prints and DXF export.">
               <option value="">Not specified</option><option value="NAVD88">NAVD 88</option><option value="NGVD29">NGVD 29</option><option value="local">Local / project datum</option><option value="other">Other…</option></select></div>
             <div id="vdatum_txt_box" style="display:none;"><label>Datum description</label><input type="text" id="vdatum_txt" maxlength="120" placeholder="Project datum, BM #12 EL 100.00" title="Describe the datum (e.g. benchmark and its elevation). Label only — no datum conversion is applied."></div>
           </div>
     ```
  2. Profile graphic caption (~line 237). Before:
     ```html
           <div class="cap"><span>Profile</span><span class="note" style="text-transform:none;letter-spacing:0;">click to set station
     ```
     After:
     ```html
           <div class="cap"><span>Profile</span><span class="pill vdatum_pill" style="text-transform:none;letter-spacing:0;" title="Label only — no datum conversion is applied.">datum: not specified</span><span class="note" style="text-transform:none;letter-spacing:0;">click to set station
     ```
  3. Top-of-Deck table (~line 488) and Beam Seat table (~line 517): one caption line inserted directly **before** each `<div class="noprint" …><button … onclick="exportTableCSV('tbl_wrap','top-of-deck')"` and `…exportTableCSV('seat_tbl_wrap','beam-seat')"` line (outside the table, so it prints but is not part of the CSV):
     ```html
         <p class="note vdatum_cap" style="margin:6px 0 0;" title="Label only — no datum conversion is applied.">Elevations in feet · vertical datum: not specified</p>
     ```
  4. `SCALAR_IDS` (anchor `const SCALAR_IDS = ['h_sta0'`): the list end `'map_datum','map_units'];` becomes `'map_datum','map_units','vdatum_sys','vdatum_txt'];`, and these helpers are inserted directly before `function serializeProject(){`:
     ```js
     // Vertical datum: a label only (scalars vdatum_sys / vdatum_txt). Elevations are never converted.
     // '' = not specified (the default for new projects and for saves made before the field existed).
     const VDATUM_NAMES={ NAVD88:'NAVD 88', NGVD29:'NGVD 29', local:'Local / project datum', other:'Other' };
     function vDatumLabel(){ // null when not specified
       const sys=(document.getElementById('vdatum_sys')||{}).value||'', txt=((document.getElementById('vdatum_txt')||{}).value||'').trim();
       if(!sys) return null;
       if(sys==='local') return VDATUM_NAMES.local+(txt?': '+txt:'');
       if(sys==='other') return txt||'Other (not described)';
       return VDATUM_NAMES[sys]||sys;
     }
     function renderVDatum(){
       const sys=(document.getElementById('vdatum_sys')||{}).value||'', lab=vDatumLabel();
       const box=document.getElementById('vdatum_txt_box'); if(box) box.style.display=(sys==='local'||sys==='other')?'':'none';
       document.querySelectorAll('.vdatum_cap').forEach(el=>{ el.textContent='Elevations in feet · vertical datum: '+(lab||'not specified'); });
       document.querySelectorAll('.vdatum_pill').forEach(el=>{ el.textContent='datum: '+(lab||'not specified'); });
     }
     ```
  5. `applyProject(p)`: directly before the line `if(p.scalars) for(const id in p.scalars){`, insert
     ```js
       // vertical datum: saves without the field (older versions) read as "not specified"
       ['vdatum_sys','vdatum_txt'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
     ```
     and directly after `ACTIVE_STA = (typeof p.activeSta==='number') ? p.activeSta : null;` insert `  renderVDatum();`.
  6. `freshDefaults()`: after `  ACTIVE_STA=null;` insert
     ```js
       ['vdatum_sys','vdatum_txt'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; }); renderVDatum();
     ```
  7. After the comment `// wiring for persistence buttons` insert
     ```js
     document.getElementById('vdatum_sys').addEventListener('change',()=>{ renderVDatum(); markDirty(); });
     document.getElementById('vdatum_txt').addEventListener('input',()=>{ renderVDatum(); markDirty(); });
     renderVDatum();
     ```
  8. DXF export, `build()` section 6. After `/* ===== 6. title block notes, below the plan ===== */` insert
     ```js
         const vdLab=(typeof vDatumLabel==='function')?vDatumLabel():null;   // label only
     ```
     Notes line, before:
     ```js
             ['Vertical datum: as entered in the vertical profile (not specified in the tool). Elevations and stations in feet.', h],
     ```
     after:
     ```js
             [(vdLab?'Vertical datum: '+vdLab+' (label only - elevations as entered in the vertical profile, no datum conversion).':'Vertical datum: as entered in the vertical profile (not specified in the tool).')+' Elevations and stations in feet.', h],
     ```
     Profile title (section 7), before:
     ```js
           W.text(LY.ptext,[PX(sA),yT],1.2*h,'PROFILE ALONG PGL - FINISHED GRADE (TOP OF PAVEMENT) - VERTICAL EXAGGERATION '+VE+'x');
     ```
     after:
     ```js
           W.text(LY.ptext,[PX(sA),yT],1.2*h,'PROFILE ALONG PGL - FINISHED GRADE (TOP OF PAVEMENT) - VERTICAL EXAGGERATION '+VE+'x - VERTICAL DATUM: '+(vdLab||'NOT SPECIFIED'));
     ```
- **Problem:** none (feature). Elevations were output without any statement of their vertical datum; the DXF notes said "not specified in the tool" (O-X4).
- **What it does:** a select (Not specified / NAVD 88 / NGVD 29 / Local / project datum / Other…) plus a description box shown for Local and Other. Default for new projects, the demo reset and every save made before this change: **Not specified** (NAVD 88 is not assumed). The label appears in the Top-of-Deck and Beam Seat table captions (on screen and in print; the print stylesheet hides fieldsets and buttons, not these captions), on the Profile graphic caption, in the DXF title notes (unchanged wording when Not specified) and on the DXF profile title. **Label only: no elevation is converted between datums** (the tooltips say so).
- **Saved data (CLAUDE.md §5):**
  - No storage key changed. Project JSON (`bridgeGeomEngine.project.v1` autosave, library `bridgeGeomEngine.library.v1`, Export / Import JSON) gets two **additive** entries inside the existing `scalars` object: `vdatum_sys` (`''`, `'NAVD88'`, `'NGVD29'`, `'local'`, `'other'`) and `vdatum_txt` (string). `version` stays **1**: no bump, because the existing loader already tolerates unknown scalars (it skips any id with no matching element), so an older copy of the tool still opens new files. A bump would make older copies reject new files (`applyProject` requires `version===1`).
  - Old saves / old exported JSON (no `vdatum_*`): load unchanged and show "Not specified" (the loader clears both fields before reading the scalars, so a previously loaded project's datum is not carried over). Re-saved by the new tool, the JSON is identical except for the two added scalars (both `''`).
  - New file in an **older copy** of the tool: `applyProject` returns true, no error or warning, identical results; the two scalars are silently ignored and are **dropped on its next autosave or export** (all other data kept). Re-open the file in the current tool to keep the datum.
  - The bridgeSuite hand-offs are unchanged: the datum is **not** added to `projectMeta` or `lldfGeom` (one tool per PR).
  - CSV exports are unchanged: the Top-of-Deck / Beam-Seat / picked-point CSVs are a plain header row plus data rows with no comment or metadata convention, so a datum line would break column parsing; the datum is not written to the CSV.
- **Governing provision:** n/a (label; no calculation).
- **Check case (demo bridge, Reset):** Beam Seat table, Abut 1 brg, G1..G4 = 95.71 / 95.88 / 95.84 / 95.61 with the datum Not specified and with NAVD 88 (same numbers; only the caption changes from "vertical datum: not specified" to "vertical datum: NAVD 88"). DXF notes with Other "Project datum, BM #12 EL 100.00": `Vertical datum: Project datum, BM #12 EL 100.00 (label only - elevations as entered in the vertical profile, no datum conversion). Elevations and stations in feet.`
- **How verified:**
  - `node --check` on all four inline scripts.
  - jsdom, main vs. this branch: Top-of-Deck (both modes), Beam Seat, derived geometry, span summary and 63 `getDeckPoint` samples identical for the demo, the 5 examples and the custom curved case. The DXF re-parse checks (42 variants: alignment, ticks, support CLs, elevation points and z, TD / BS text against the tables, profile grade line and FG labels, extents) give results identical to main. Textual DXF diff against main (datum Not specified): only the timestamp line, and in the 22 files with a profile the profile title gains ` - VERTICAL DATUM: NOT SPECIFIED`; the notes line is unchanged. ezdxf 1.4.4 recover + audit: 0 errors, 0 fixes on those 43 exports and on 3 exports with a datum set.
  - Load tests: old exported JSON from main (6 cases) and old autosave from main (3 cases, page booted on that key) load with "Not specified" and identical tables; Other (text with an em dash and quotes), Local + text, NAVD 88 and NGVD 29 round-trip through Export/Import JSON and through autosave + reload; `freshDefaults` resets to Not specified; Load validation set leaves the datum alone; main's `applyProject` accepts a new file with identical results.
  - Chromium (Playwright): the field with Other + description, the Profile pill, the Top-of-Deck and Beam Seat captions on screen and in print media; no page errors.
- **Other copies:** none.
- **Open items:**
  - O-D1. Carrying the datum in a hand-off (e.g. an optional field on `projectMeta` or `lldfGeom`) needs a HANDOFF.md change and the receiving tools: not done here.
  - O-D2. The datum is not written to the CSV exports (see above). If wanted, it could go in an extra column or in the file name; say which.
  - O-D3. The heatmap, cross-section, 3D and Site Map views show elevations without the datum label; the table captions on the same tabs carry it.

## 2026-10-12 — PR: claude/sweep-bridgegeom (PR #148: https://github.com/mlococo88/All-Structural/pull/148)

Open-item sweep (inventory section 24). Engineer's instruction 2026-10-12: work through the open items using best judgement, and list what needs the engineer. Changes: the LL & DL hand-off skew (BG-OH2, **calc: hand-off value**), deck thickness and beam depth in the hand-off (BG-OH1), `projectToPGL` nearest root (BG-O7, bug), datum labels on the views and in the CSV file names (BG-OD2/OD3). **No Top-of-Deck, Beam Seat, derived-geometry or saved-project result changes** on any of the tested bridges (see "How verified"). `lldf.html` is not changed.

### W1. BG-OH2: skew sent to LL & DL: moment / shear choice, Art. 4.6.2.2.2e 10° rule   [calc change: hand-off value] [MORE conservative for moment DFs; see the shear note]
- **Where:** the LL & DL hand-off `<script>` block: `bgxBuildLldfGeom(opt)` and the send dialog (`opts()`, `refresh()`, `openDlg()`). Anchors: `const skewRule=(`, `const skewVal=r2(`, `if(notes[2]==='') notes.splice(2,1);`, `if(Nb) payload.Nb=Nb;`, `['Skew θ',`, `<select id="bgx_skew"`, `sel.innerHTML=h; sel.value=`.
- **Problem:** when the supports' skews differ, LL & DL (one θ input) was sent the largest |θ| by default. LL & DL uses that one θ for both the moment reduction (Table 4.6.2.2.2e-1) and the shear correction (Table 4.6.2.2.3c-1). The largest |θ| is conservative for shear but gives the **largest moment reduction: unconservative for moment DFs**. It also ignored Art. 4.6.2.2.2e, which permits the moment reduction only when the skews of two adjacent support lines differ by no more than 10°.
- **Governing provision:** AASHTO LRFD 10th Ed. (2024) Art. 4.6.2.2.2e and Table 4.6.2.2.2e-1 (moment reduction; "the difference between skew angles of two adjacent lines of supports does not exceed 10°": verify the wording against the printed 10th Ed.); Art. 4.6.2.2.3c and Table 4.6.2.2.3c-1 (shear correction at the obtuse corner).
- **Before:**
  ```js
      const skewRule=(['max','min','mean'].indexOf(opt.skewRule)>=0)?opt.skewRule:'max';
  ...
      const skewVal=r2(skewRule==='min'?Math.min.apply(null,sk):(skewRule==='mean'?sk.reduce((s,v)=>s+v,0)/sk.length:Math.max.apply(null,sk)));
  ```
  ```js
          +'<div><label>Skew sent (one value)</label><select id="bgx_skew"><option value="max" selected>largest |skew|</option><option value="min">smallest |skew|</option><option value="mean">average |skew|</option></select></div>'
  ```
- **After:**
  ```js
      // BG-OH2: default 'moment' (was 'max'). LL & DL takes ONE skew and uses it for both the moment reduction
      // (Table 4.6.2.2.2e-1) and the shear correction (Table 4.6.2.2.3c-1); the largest |skew| gave the largest
      // moment reduction (unconservative for moment DFs when the supports' skews differ).
      const skewRule=(['moment','max','min','mean'].indexOf(opt.skewRule)>=0)?opt.skewRule:'moment';
      const sendDepths=(opt.depths!==false);
  ...
      const skMin=Math.min.apply(null,sk), skMax=Math.max.apply(null,sk);
      // largest change of the (signed) skew between adjacent supports, i.e. the angle between the two support lines
      let skAdj=0; for(let i=1;i<su.length;i++) skAdj=Math.max(skAdj,Math.abs((+su[i].skew||0)-(+su[i-1].skew||0)));
      // moment DFs: smallest |skew|; no reduction (0) when adjacent supports differ by more than 10 deg (Art. 4.6.2.2.2e)
      const skNoRed=skAdj>10+1e-9, skMoment=skNoRed?0:skMin;
      const skewVal=r2(skewRule==='moment'?skMoment:(skewRule==='min'?skMin:(skewRule==='mean'?sk.reduce((s,v)=>s+v,0)/sk.length:skMax)));
      const skDiffer=(skMax-skMin>1e-9)||skNoRed;
  ```
  ```js
          +'<div><label>Skew sent (one value)</label><select id="bgx_skew" title="LL &amp; DL uses one skew for both the moment reduction (Art. 4.6.2.2.2e) and the shear correction (Art. 4.6.2.2.3c). For moment DFs: the smallest |skew|, or 0 when adjacent supports differ by more than 10 deg. For shear DFs: the largest |skew|."><option value="">choose&hellip;</option><option value="moment" selected>for moment DFs</option><option value="max">for shear DFs (largest)</option><option value="min">smallest |skew|</option><option value="mean">average |skew|</option></select></div>'
  ```
  Also (exact code in the PR diff; anchors above):
  - The "Sent:" sentence of the skew note now reads "the skew for moment DFs = X deg (the smallest |skew|)" or "(0: adjacent supports differ by more than 10 deg, so AASHTO LRFD Art. 4.6.2.2.2e allows no moment reduction)". The other rules keep their old wording.
  - When the skews differ, a new note (shown in LL & DL's banner) gives both values and the articles. It says which value this hand-off carries and that the other action needs a second run. For "for shear DFs" it says that the MOMENT DFs of that run are unconservative.
  - New optional **top-level** payload field `skewDetail` = `{bySupport:[{name, skew (signed, deg, as entered)}], absMin, absMax, maxAdjacentDiff, moment, shear, sent}` (deg). It is outside `inputs` on purpose: lldf merges `inputs` into its saved state, and it ignores unknown top-level fields (checked: `skewDetail` is not in `lldf_autosave_v1`).
  - The summary row `Skew θ` adds "(for moment DFs: X°; for shear DFs: Y°)" when the values differ. `bgxBuildLldfGeom` also returns `skewWarn`.
  - **Dialog:** when the skews differ, "Skew sent" opens on **choose…**, and Send / Export stay disabled until a rule is picked. A red line explains the two runs. When all supports have the same skew, it opens on "for moment DFs", which then equals the old value.
- **Default picked and why:** no single θ is conservative for both actions. So:
  1. In the dialog, the engineer must choose whenever the skews differ.
  2. The builder default (`bgxBuildLldfGeom()` without a rule) is the moment value: the old default was unconservative for moment, and the moment value follows the 10° rule of Art. 4.6.2.2.2e.
  `basis.skew` gains the value `'moment'` (HANDOFF.md §4.2 lists max|min|mean; lldf does not read `basis`).
- **Shear note:** a "for moment DFs" hand-off gives LL & DL a smaller θ, so its **shear** correction is smaller (less conservative for shear) than with the old default. The note and the dialog say to take the shear DFs from a "for shear DFs" run, which sends the old default value.
- **Check case 1 (hand-checkable; Example 3 with skews Abut 1 40°, Pier 1 35°, Abut 2 30°):**
  - Inputs: |θ| = 40, 35, 30; adjacent differences 5° and 5° (≤ 10°).
  - Before: θ sent = max = **40.00°** (basis `max`). After: "for moment DFs" θ = min = **30.00°** (basis `moment`); "for shear DFs" θ = **40.00°** (basis `max`). Checked in Chromium: main gives `[40,"max"]`; the branch gives `[30,"moment"]` by default (adjacent difference 5) and `[40,"max"]` for `max`.
  - Effect in LL & DL (type (a), beam-slab; illustrative values L = 100 ft, S = 8 ft, t_s = 8 in, K_g = 500,000 in⁴): c₁ = 0.25 (K_g / 12 L t_s³)^0.25 (S/L)^0.5 = 0.25 × (500000/614400)^0.25 × 0.08^0.5 = 0.25 × 0.9498 × 0.2828 = 0.06716.
    - Moment factor 1 − c₁ (tan θ)^1.5: before (40°) 1 − 0.06716 × 0.8391^1.5 = 1 − 0.06716 × 0.76864 = **0.9484**; after (30°) 1 − 0.06716 × 0.57735^1.5 = 1 − 0.06716 × 0.43869 = **0.9705**. Moment DFs are 2.3 % higher: **more conservative**.
    - Shear factor 1 + 0.20 (12 L t_s³/K_g)^0.3 tan θ, with (614400/500000)^0.3 = 1.0638: at 40° it is 1 + 0.2 × 1.0638 × 0.8391 = **1.1785** (the "for shear DFs" run, the same as before). The 30° moment run would give 1.1228, so the shear DFs must come from the shear run, as the notes say.
- **Check case 2 (demo bridge: Abut 1 0°, Pier 1 15°, Abut 2 0°):** adjacent differences 15° and 15° > 10°, so moment θ = **0.00°** (no moment reduction permitted) and shear θ = **15.00°**. Before: 15.00° sent by default. Now the dialog opens on "choose…" with Send disabled.
- **Check case 3 (no change):** Examples 1–5 and the validation set have equal skews at all supports. There the "for moment DFs" value equals the old default (0, 25, 0, 15, 0 and 0°), and `inputs`, spans, spacings and overhangs are identical; `basis.skew` reads `'moment'`.
- **How verified:** see "How verified (W1–W4)".
- **Other copies:** none (`lldf.html` unchanged; BridgeXfer untouched).

### W2. BG-OH1: deck structural thickness t_s and default beam depth d sent to LL & DL   [hand-off: existing optional fields] [no result change in this tool]
- **Where:** `bgxBuildLldfGeom`, after `const notes=[], units={spans:'ft', skew:'deg'};`; the notes block after the W1 note; the summary row `['Slab t_s / beam d', …]`; the dialog checkbox `#bgx_dep` (default checked) and `opts()`.
- **After:**
  ```js
      // BG-OH1: deck structural thickness and default beam depth (both inches, as lldf's t_s and d)
      const dNotes=[];
      if(sendDepths){
        const ts=+document.getElementById('d_slab').value, dd=+document.getElementById('d_beam').value;
        if(isFinite(ts)&&ts>0){ inputs.ts=r3(ts); units.ts='in'; } else dNotes.push('Slab thickness not sent: the deck structural thickness is not a number > 0.');
        const ovr=[].concat(Object.values(PERBEAM.beam||{}),Object.values(PERBEAMSPAN.beam||{})).filter(v=>v!=null&&v!==''&&+v!==dd);
        if(ovr.length) dNotes.push('Beam depth not sent: Bridge Geometry has per-beam / per-span beam-depth overrides ('+ovr.length+' differ from the default '+dd+' in). Enter d in LL & DL.');
        else if(isFinite(dd)&&dd>0){ inputs.depth=r3(dd); units.depth='in'; } else dNotes.push('Beam depth not sent: the default beam depth is not a number > 0.');
      }
  ```
  A note states the source of each value: "Slab thickness t_s = Bridge Geometry deck structural thickness (8 in); beam depth d = Bridge Geometry default beam depth, top to bottom of beam (36 in)."
- **Problem:** lldf's t_s and d (used in K_g, c₁, the skew factors and the box/spread-box equations) had to be retyped.
- **Format:** `inputs.ts` / `inputs.depth` are the field names lldf's reader already accepts (`validateGeom`, `geomOverwriteList`, `geomSource.fields`), in **inches** (lldf's units). `units.ts` / `units.depth = 'in'` are added (lldf checks units only for spans, spacings, OL, OR, de and skew). lldf's banner lists both as "will overwrite" before anything changes.
- **Default:** sent (checkbox on). The beam depth is **not** sent when any per-beam or per-span beam-depth override differs from the default, because no single d represents them; the note says so.
- **Governing provision:** n/a (data transfer; t_s and d as defined in AASHTO LRFD 10th Ed. Art. 4.6.2.2.1, used by lldf).
- **Check case:**
  - Demo: `inputs.ts = 8`, `inputs.depth = 36`.
  - Example 5: 8 / 54.
  - Custom case with `PERBEAM.beam = {1:'48'}`: `ts = 8`, no `depth`, and the note "Beam depth not sent … (1 differ from the default 36 in)".
  - Pulled into lldf.html (Chromium): t_s 8 and d 36, or d left at its value when it is not sent.

### W3. BG-O7: `projectToPGL` keeps the nearest root   [bug fix] [no change for single-root cases]
- **Where:** `projectToPGL(align, x, y)` (≈ line 976). Anchor: `// coarse scan for`.
- **Before:**
  ```js
    // coarse scan for a sign change of f (the closest-station condition is f=0)
    const N=Math.max(50, Math.ceil((s1-s0)/2));
    let prevS=s0, prevF=f(s0), bestS=s0, bestAbs=Math.abs(prevF), lo=null, hi=null;
    for(let i=1;i<=N;i++){ const s=s0+(s1-s0)*i/N, fv=f(s);
      if(Math.abs(fv)<bestAbs){ bestAbs=Math.abs(fv); bestS=s; }
      if(prevF===0){ lo=hi=prevS; break; }
      if((prevF<0)!==(fv<0)){ lo=prevS; hi=s; break; }
      prevS=s; prevF=fv;
    }
    let sstar;
    if(lo!==null){ let a=lo,b=hi;
      for(let k=0;k<60;k++){ const m=(a+b)/2, fm=f(m); if(Math.abs(fm)<1e-9){a=b=m;break;} const fa=f(a); if((fa<0)!==(fm<0)) b=m; else a=m; }
      sstar=(a+b)/2;
    } else { sstar=bestS; } // no sign change (point beyond the ends) -> nearest endpoint station
  ```
- **After:**
  ```js
    // coarse scan for EVERY sign change of f (the closest-station condition is f=0). BG-O7: on reverse
    // curves or near a curve centre f can change sign more than once; each bracket is refined and the
    // root nearest the point is kept (was: the first sign change). One root -> the same result as before.
    const N=Math.max(50, Math.ceil((s1-s0)/2));
    let prevS=s0, prevF=f(s0), bestS=s0, bestAbs=Math.abs(prevF); const brk=[];
    for(let i=1;i<=N;i++){ const s=s0+(s1-s0)*i/N, fv=f(s);
      if(Math.abs(fv)<bestAbs){ bestAbs=Math.abs(fv); bestS=s; }
      if(prevF===0) brk.push([prevS,prevS]);
      else if((prevF<0)!==(fv<0)) brk.push([prevS,s]);
      prevS=s; prevF=fv;
    }
    let sstar;
    if(brk.length){ let bestD=Infinity;
      for(const [lo,hi] of brk){ let a=lo,b=hi;
        for(let k=0;k<60;k++){ const m=(a+b)/2, fm=f(m); if(Math.abs(fm)<1e-9){a=b=m;break;} const fa=f(a); if((fa<0)!==(fm<0)) b=m; else a=m; }
        const r=(a+b)/2, q=align.at(r), d=Math.hypot(x-q.x, y-q.y);
        if(d<bestD){ bestD=d; sstar=r; }
      }
    } else { sstar=bestS; } // no sign change (point beyond the ends) -> nearest endpoint station
  ```
- **Problem:** the first sign change of the along-tangent residual is not always the nearest station (reverse curves, points near a curve centre). The function is used by `getDeckPoint` for chord points, by `deckPointAtXY` (Site Map picked points) and by the heatmap.
- **Governing provision:** n/a (geometry).
- **Check case:** S-curve with POB 0+00 at (0, 0), bearing N90E: tangent 150, curve R 400 L 300, curve R −400 L 300, tangent 150. Point (x 759.895, y 272.845):
  - Before: Sta 4+44.55, offset −508.13 ft (508.13 ft from that PGL point).
  - After: Sta 8+14.58, offset −487.49 ft (487.49 ft, the nearer foot of the perpendicular).
  - On a 31 × 31 grid extending 300 ft beyond the alignment, 6 of 961 points change, all about 500 ft from the PGL. Every deck point (tables, `getDeckPoint` samples, heatmap) is unchanged.
- **Cost:** the scan no longer stops at the first sign change (same N). Measured 0.01–0.11 ms per call on both main and the branch (noise level).

### W4. BG-OD2 / BG-OD3: vertical datum on the views and in the CSV file names   [UI] [no result change]
- **Where:**
  - A new pill `<span class="pill vdatum_pill" style="text-transform:none;letter-spacing:0;" title="Label only — no datum conversion is applied.">datum: not specified</span>` (the Profile pill's markup, filled by the existing `renderVDatum()`) in the caps of:
    - `3D · alignment, deck &amp; substructure`;
    - the Bridge tab `3D` card;
    - `Deck plan · top-of-deck elevation` (the heatmap);
    - `Section` (after `id="sec_sta"`).
  - Site Map, pick-points fieldset, before `<div id="pick_table"`: `<p class="note vdatum_cap" style="margin:8px 0 0;" title="Label only — no datum conversion is applied.">Elevations in feet · vertical datum: not specified</p>` (filled by `renderVDatum()`).
  - A new `vDatumFileTag()` before `function renderVDatum(){`. `exportTableCSV` now uses `` a.download=`${base}${vDatumFileTag()}-${…}.csv` ``, and `exportPickCSV` uses `a.download='picked-points'+vDatumFileTag()+'.csv'`.
    ```js
    function vDatumFileTag(){
      const lab=(typeof vDatumLabel==='function')?vDatumLabel():null; if(!lab) return '';
      const t=lab.replace(/[^A-Za-z0-9]+/g,'').slice(0,32); return t?'-'+t:'';
    }
    ```
- **Default picked:** the CSV **content** is unchanged, because a header or comment line would break column parsing (as D1 noted). The datum goes in the **file name** instead, e.g. `beam-seat-NAVD88-2026-10-12.csv`. With the datum "Not specified" the file names are unchanged. PNG/SVG exports of the views do not carry the pill (canvas/SVG only).
- **Check case:** with datum NAVD 88:
  - the four caps show the pill "datum: NAVD 88";
  - the pick-points caption reads "Elevations in feet · vertical datum: NAVD 88";
  - the Beam Seat CSV is named `beam-seat-NAVD88-2026-10-12.csv`.

### Items closed (no code change)
- **BG-OD1 (datum in the hand-off):** not needed. `lldfGeom` carries no elevations (spans, spacings, skew, overhangs, t_s, d), and `projectMeta` is title-block data. No hand-off carries an elevation, so there is nothing for the datum to qualify.
- **BG-OX2 (PVI/BVC/EVC vs VPI/VPC/VPT):** already decided by the engineer on 2026-10-06: keep (see the D1 entry).
- **BG-OX3 (no barrier layer):** not an issue in the DXF writer. The tool has no barrier input, so there is nothing to draw; curbs go on `BG-CURB`. A barrier model would be a feature request.
- **BG-DEP (plotly-basic 3.7.0, OSM/Esri tiles):** left as is (the inventory default).

### How verified (W1–W4)
- `node --check` on all four inline scripts.
- Chromium (Playwright, CDN libraries served locally; Leaflet is not available offline, so the Site Map was not plotted), main vs branch. Cases: the demo bridge, Examples 1–5, the validation set, and a custom S-curve (skews +20 / −10 / +15, dual-bearing pier, span-2 girder override; also run with a beam-depth override). Results:
  - All `<table>` text is identical (only the library "saved" timestamps differ). `serializeProject()` is identical (without `savedAt`). The 123 `getDeckPoint` x/y/z samples are identical, and the heatmap canvas is identical (MD5 of `toDataURL`).
  - `projectToPGL` on 961 grid points: identical, except 6 points in the S-curve case (W3).
  - The hand-off payload for the old rules `max` / `min` / `mean`, with t_s/d off, is identical to main except for `skewDetail` (new) and the notes. The new W1 note appears only when the skews differ (the demo and the custom case).
  - No page errors. The only console errors are the two blocked Leaflet requests, the same on main.
- Receiver: each new payload was published through `BridgeXfer.publish` and pulled into the unchanged `lldf.html` ("Pull geometry" → "Prefill from Bridge Geometry"). It was accepted, and skew, t_s, d, O_L and O_R were prefilled as sent. `geomSource.fields` lists slab thickness and beam depth, `skewDetail` is not in `lldf_autosave_v1`, and there were no page errors.
- Screenshots checked by eye: the dialog ("choose…" and "for moment DFs", wide and narrow), the four caps and the pick-points caption.

### Needs engineer
- **Q-BG1 (BG-OH2).** Confirm the hand-off rule:
  - moment θ = smallest |θ| (0 when adjacent support lines differ by more than 10°, Art. 4.6.2.2.2e);
  - shear θ = largest |θ|;
  - the dialog forces the moment / shear choice when the skews differ.
  Recommendation: keep. A two-value hand-off would need a receiving change in lldf.html (separate PR).
- **Q-BG2 (BG-O1, skew datum):** should skew be measured from the chord normal (current) or radially at each support? Recommendation: keep the chord, since the girders are on the chord.
- **Q-BG3 (BG-O3, seat stack):** net vs gross camber, cross-slope × ½ flange width, the VC ordinate between bearings, and a midspan haunch check. Recommendation: add cross-slope × b_f/2 and the VC ordinate as optional terms; the engineer to give the preferred method.
- **Q-BG4 (BG-O5):** curved or per-span-chorded girders? Recommendation: per-span chords (a smaller change than curved girders). This is the engineer's modelling decision.
- **Q-BG5 (BG-O6):** NAD83 is treated as WGS84 on the map (≈1–1.5 m); there is no combined scale factor and no SPCS2022. Recommendation: add a CSF input and a `+towgs84` option (map only).

### Remaining open items
- **BG-O2 (superelevation runout/runoff table):** not done (M; it changes elevations when used). Recommendation: an optional transition table (station, left slope, right slope) that overrides the per-unit controls when present.
- **BG-O4 (degree of curve, spiral reports, station equations):** not done (L; a feature on request).
- **HANDOFF.md §4.2 (docs):** add `basis.skew:'moment'`, the optional `skewDetail` field, and the `ts`/`depth` fields (inches) that Bridge Geometry now sends. Not edited here (tool file and fix log only).

## 2026-10-12 — PR: claude/lldf-receivers (cross-tool: lldf DF payload `perFootStrip` / `skewShear` receivers; PR #166: https://github.com/mlococo88/All-Structural/pull/166)

Cross-tool connection PR (CLAUDE.md §7 exception): receivers of the `bridgeSuite.v1.lldf` payload honour lldf's new optional fields (fixlog/lldf.md 2026-10-12 SW3 `skewShear`, SW6 `perFootStrip`), and Bridge Geometry's skew note is softened. Tools changed: index.html, psbeam.html, stgirder.html, Moving Load Generator.html, Steel Bridge Beam Modules.html, Bridge Geometry.html; HANDOFF.md §4.2 / §4.3. The shared `bridgeSuite.v1.*` bootstrap blocks are not touched. No formula, factor, unit or code reference changed. Payloads without the new fields give the same results as before (checked).

### LR1. "Skews differ" note and send dialog: LL & DL takes moment and shear skews in one run   [hand-off notes / UI] [no result change]
- **Where:** "Hand-off: Bridge Geometry -> LL & DL Distribution" script. Anchors: `LL & DL takes both from this hand-off (skewDetail) in one run`, `LL &amp; DL takes both values from this hand-off in one run`, `<select id="bgx_skew" title="The single skew in the hand-off.`, `dlg.querySelector('#bgx_skew').value='moment';`, header comment `lldf applies skewDetail.moment / .shear in one run`.
- **Before:** the note said LL & DL uses the one skew sent for both actions, and asked for a second run ("send again with "for shear DFs" and take the shear DFs from that run"). The dialog repeated it in red and, when the skews differed, started the "Skew sent" select on "choose…" so that Send stayed disabled until a choice was made (BG-OH2).
- **After:**
  ```js
    if(skDiffer) notes.push('Skews differ between supports (|skew| '+skMin.toFixed(2)+' to '+skMax.toFixed(2)+' deg; largest change between adjacent supports '+skAdj.toFixed(2)+' deg). '
      +'Moment DFs need skew = '+skMoment.toFixed(2)+' deg (smallest |skew|; 0 when adjacent supports differ by more than 10 deg; AASHTO LRFD Art. 4.6.2.2.2e, Table 4.6.2.2.2e-1). '
      +'Shear DFs need skew = '+skMax.toFixed(2)+' deg (largest |skew|, obtuse corner; Art. 4.6.2.2.3c, Table 4.6.2.2.3c-1). '
      +'LL & DL takes both from this hand-off (skewDetail) in one run: theta = '+skMoment.toFixed(2)+' deg for moment and theta_V = '+skMax.toFixed(2)+' deg for shear, whichever single value is sent. '
      +'The single skew sent ('+skewVal.toFixed(2)+' deg) is used for both actions only by a reader that does not use skewDetail'
      +(skewRule==='moment'?'; for such a reader take the shear DFs from a second run "for shear DFs".'
        :(skewRule==='max'?'; for such a reader its MOMENT DFs are unconservative.'
          :'; for such a reader take moment and shear DFs from separate "for moment DFs" / "for shear DFs" runs.')));
  ```
  - Dialog red line: "Skews differ between supports. LL & DL takes both values from this hand-off in one run: the moment skew for the moment DFs and the shear skew (largest) for the shear DFs. The single "Skew sent" value matters only to a reader that does not use the moment / shear detail (see the notes)."
  - The select starts on "for moment DFs" every time (`dlg.querySelector('#bgx_skew').value='moment';`, was `''` when the skews differ). The "choose…" option and the guard that disables Send while it is selected are kept.
  - The select tooltip says LL & DL also receives and applies both values.
- **Why:** lldf now reads `skewDetail.moment` / `.shear` and applies both in one run (fixlog/lldf.md 2026-10-12 SW3), so the second run is no longer needed for LL & DL. The forced choice and the two-run instruction now apply only to a reader that does not read `skewDetail` (none today; `lldfGeom` has one receiver, lldf).
- **Payload:** unchanged except the text of this one note: same `inputs`, `basis`, `skewDetail` (checked).
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 4.6.2.2.2e / Table 4.6.2.2.2e-1 (moment θ) and Art. 4.6.2.2.3c / Table 4.6.2.2.3c-1 (shear θ). No formula changed.
- **Check case:** demo bridge (supports 0° / 15° / 0°): `skewDetail` moment 0, shear 15 (unchanged). Dialog before: select "choose…", Send disabled. After: select "for moment DFs", Send enabled; notes as above. In lldf this payload sets θ = 0, θ_V = 15 (lldf SW3 check case).
- **How verified:** headless Chromium, main vs branch: `bgxBuildLldfGeom({skewRule:'moment'})` (only the note text differs), `bgxOpenLldfGeom()` (select value, Send state); screenshot `bg_dialog_br.png` looked at. No page errors.
- **Closes:** the HANDOFF.md §4.2 open item from the 2026-10-12 sweep entry (now documented in this PR).

## 2026-10-19 — PR: claude/aashto-ed-geometry — AASHTO LRFD edition stated as 10th Ed. (2024) in the skew notes (wording only, no result change; PR #324: https://github.com/mlococo88/All-Structural/pull/324)

Engineer decision 2026-10-19 ("follow the owner"): tools without an owner setting state AASHTO LRFD **10th Ed. (2024)**. Bridge Geometry has no owner setting and stated no edition.

### ED1. Edition in the two AASHTO citations of the LL & DL hand-off notes   [wording] [no result change]
- **Where:** `bgxBuildLldfGeom` ("Hand-off: Bridge Geometry -> LL & DL Distribution" script), the `notes` of the `bridgeSuite.v1.lldfGeom` payload. Anchors: `allows no moment reduction`, `Table 4.6.2.2.2e-1). '`.
- **Before:**
  ```js
  '0: adjacent supports differ by more than 10 deg, so AASHTO LRFD Art. 4.6.2.2.2e allows no moment reduction'
  ...
  +'Moment DFs need skew = '+skMoment.toFixed(2)+' deg (smallest |skew|; 0 when adjacent supports differ by more than 10 deg; AASHTO LRFD Art. 4.6.2.2.2e, Table 4.6.2.2.2e-1). '
  ```
- **After:**
  ```js
  '0: adjacent supports differ by more than 10 deg, so AASHTO LRFD 10th Ed. (2024) Art. 4.6.2.2.2e allows no moment reduction'
  ...
  +'Moment DFs need skew = '+skMoment.toFixed(2)+' deg (smallest |skew|; 0 when adjacent supports differ by more than 10 deg; AASHTO LRFD 10th Ed. (2024) Art. 4.6.2.2.2e, Table 4.6.2.2.2e-1). '
  ```
- **Articles checked against AASHTO LRFD 10th Ed. (2024)** (every AASHTO LRFD item the tool cites; same number and same subject, no provision change): Art. 4.6.2.2.2e and Table 4.6.2.2.2e-1 (skew reduction of moment DFs; reduction only where adjacent support skews differ by no more than 10°: same rule as the tool's `skNoRed`); Art. 4.6.2.2.3c and Table 4.6.2.2.3c-1 (skew correction of shear DFs, obtuse corner). Neither article is in the 10th Ed. list of changed articles.
- **Governing provision:** as above. No formula, factor, unit or skew rule changed; only the edition is named.
- **Payload / saved data:** the `bridgeSuite.v1.lldfGeom` format and keys are unchanged; only the text of these two notes differs. No localStorage key touched.
- **Check case:** demo bridge (supports 0° / 15° / 0°): `bgxBuildLldfGeom({skewRule})` for moment, min, mean, max: `inputs`, `basis`, `skewDetail` identical to main (moment skew 0.00°, shear skew 15.00°); `notes[1]` (moment rule) and `notes[3]` (all rules) differ only by the inserted "10th Ed. (2024) ".
- **How verified (Tier 0):** `node tests/check-syntax.mjs "Bridge Geometry.html"`: all scripts pass. `node tests/compare.mjs --tool page --file "Bridge Geometry.html"`: page text and storage identical to main (the 4 console errors are the CDN libraries the test kit does not serve, the same on main). Headless payload comparison main vs branch as in the check case (only `producedAt` and the two notes differ).
- **Other copies:** none.
- **Open items:** none.

## 2026-11-02 — PR: claude/list-input-bgeo, PR #690: https://github.com/mlococo88/All-Structural/pull/690 — per-span girder offsets are a table with one box per girder; the survey-point paste box shows a table of what was read (LIST)   [display only]
- **Why:** engineer decision 2026-11-02: no comma-separated inputs; short lists become tables, paste boxes stay with an editable
  table of what was read next to them (`shared/list-input.js`, `fixlog/shared-list-input.md`, #681).
- **Where (1):** script tags, anchor `plotly-basic.min.js"></script>`. **Added after it:** `<script src="shared/list-input.js"></script>`
- **Where (2):** `renderSpanTable()`, the girder-offsets cell. **Before:**
```js
      <td><input class="ovr${gOver?' edited':''}" data-s="${s}" data-f="girders" value="${ov.girders?ov.girders.join(', '):''}" placeholder="${gGird}" style="width:180px" title="Comma-separated girder offsets for this span. Blank inherits the global set."></td>
```
  **After:**
```js
      <td style="text-align:left" title="Girder offsets for this span, one per row. No rows = the global set (${gGird}).">${SharedListInput.slot('girders'+s)}</td>
```
  The header tooltip says "one per row" instead of "as a comma-separated list".
- **Where (3):** `renderSpanTable()`, after `h+='</tbody>'; t.innerHTML=h;`: one table per span (`mountSlot(t,'girders'+s,…)`, rows
  `fromNumbers(ov.girders||[])`, column "Offset (ft)", placeholder "global", class `edited` when the span has its own set). When
  the focus leaves the table and its text changed, the old parser runs on the rows' text, unchanged:
```js
      SPAN_OV[s].girders = v.trim()? v.split(',').map(x=>+x.trim()).filter(x=>!isNaN(x)) : null;
      renderSpanTable(); if(ENG) compute();
```
  (`v = SharedListInput.toText(ctl.get())`, i.e. the rows joined by ", "). The edge-offset listener is limited to
  `input[data-f]` and its `girders` branch is removed (no input has `data-f="girders"` now). **Before:**
```js
  t.querySelectorAll('input').forEach(el=>el.addEventListener('change',e=>{
    …
    if(f==='girders') SPAN_OV[s].girders = v.trim()? v.split(',').map(x=>+x.trim()).filter(x=>!isNaN(x)) : null;
    else SPAN_OV[s][f] = v===''?null:+v;
```
  **After:**
```js
  t.querySelectorAll('input[data-f]').forEach(el=>el.addEventListener('change',e=>{
    …
    SPAN_OV[s][f] = v===''?null:+v;
```
  CSS added after `.subtbl input.ovr.edited {…}`: `.subtbl .sli.edited input.sli-in { color: var(--oxide); border-color: var(--oxide); }`.
- **Where (4):** Site Map, "arbitrary survey points": `<div id="map_ptstbl">` under the `#map_ptsbox` textarea, and
  `ptsTable()` (after `clearSurveyPoints()`, called after the `map_addpts` listener). The table ("Survey points as read":
  Name, Northing, Easting, Desc; Easting / Northing swapped in the headers when "Easting,Northing order" is ticked) shows each
  line split as `plotSurveyPoints()` splits it (`/[,\t]/`). Typing or pasting in the box refreshes the table; a table edit
  rewrites the box (cells joined by ", ", one point per line), which "Plot points" reads as before. `clearSurveyPoints()`
  also empties the table (`if(PTS_TBL) PTS_TBL.set([]);`). `plotSurveyPoints()` is unchanged.
- **Saved data:** `SPAN_OV[s].girders` stays an array of numbers, or null for the global set. The survey points were never
  saved and still are not. No key or format changed. Round trip: `tests/engine/list-input.test.mjs` (array → rows → text → the
  old parser → the same array; no rows → null).
- **Check case:** default project, span 2 offsets typed -15 ↵ -5 ↵ 5 ↵ 15 → `SPAN_OV[2].girders` = [-15, -5, 5, 15], "# Gird" 4,
  top-of-deck and beam-seat outputs identical to typing "-15, -5, 5, 15" in the old box on origin/main.
- **How verified:** `node tests/smoke/list-input.mjs --part bgeo`: origin/main vs this branch, default project and the case
  above: `SPAN_OV`, the stored project, the text of Top of Deck Output, Beam Seat Output and Bridge (the tables' own elements and
  the span table's header removed) identical; 0 console errors; the survey-point table checks (paste → rows, edit → box,
  flip → headers, Clear → empty). Screenshots at 1400 and 390 px looked at. At 390 px the page scrolls sideways by 78 px on
  origin/main already (the tab bar and the fieldsets); unchanged here. `node tests/check-syntax.mjs` passes.
- **Formulas, factors, units, code references:** none (§4 does not apply).
- **Open items:** the 78 px sideways scroll at 390 px is older than this change (not fixed here: one task per PR).

## 2026-11-02 — PR: claude/plib-bgeo, PR #711: https://github.com/mlococo88/All-Structural/pull/711 — PLIB: Duplicate in the saved-bridge library, and Undo / Redo   [display and storage only]
- **Before:** header Save / Save As New / ▸ Library / New, Export / Import JSON; the library panel (`bridgeGeomEngine.library.v1`,
  `{ name: project }`) with Load / Rename / Delete; autosave `bridgeGeomEngine.project.v1`. No duplicate, no undo.
- **Where:**
  - after `<script src="shared/list-input.js"></script>`: `<script src="shared/projects.js"></script>` and `<script src="shared/projects-ui.js"></script>`.
  - `autosave()`, anchor `function autosave(){`: first statement `if(window.BGPL) BGPL.soon();   /* PLIB: one undo step per change (debounced) */`
    (the autosave runs on every input, change and button click; `soon` records the step 600 ms after the last one).
  - `renderLibrary()`: each row gains `Duplicate` (`data-lib-dup`, between Rename and Delete) and its click handler, calling the new
    `bgPlibDup(n)`; after `renderLibrary()`: `function bgPlibDup(n)` and `function bgPlibInit()` (anchor `/* PLIB (2026-11-02): Duplicate in the
    saved-bridge library`).
    - `bgPlibDup`: `SharedProjects.mapStore(localStorage, LIBRARY_KEY).duplicate(n, newName)`: the stored item is copied unchanged (its
      inner `name` field too: the library is keyed by the list name, and Load sets the current name from the key, so the field is not read);
      a name in use asks before replacing; a refused write (storage full or blocked) shows its message and storage stays as it was.
    - `bgPlibInit`: history over `serializeProject()` without `savedAt`, `name`, `activeSta` (the selected station, a view choice) and
      `overlays` (Site Map plan images: large, not geometry); `set` = `applyProject()` (the Load / Import path) of the step with the current
      name, station and overlays, then `autosave()`. Buttons Undo, Redo after New.
  - `libLoad()` and `loadProjectFromFile()`: after a successful load, `if(window.BGPL) BGPL.h.reset();` (another bridge starts a new history,
    so Undo never brings the previous bridge's data under the loaded name). New stays a step (it can be undone).
  - boot, after `armAutosave();`: `bgPlibInit();` (after start-up, so restoring the session is not a step).
- The tool's own Rename (it also sets the item's `name` field) and the rest of the library are unchanged.
- **Saved data:** keys `bridgeGeomEngine.library.v1`, `bridgeGeomEngine.project.v1` and their formats unchanged; no new key.
- **How verified:** `node tests/smoke/project-library.mjs --tool bgeo` (new TOOLS entry, with the tool's own library panel): ALL PASS
  (`ENG` data and the Top of Deck Output, Beam Seat Output and Bridge tab text identical to origin/main on load, after an input change
  (span 1 left-edge override), reopened on main's storage and loaded from the library; Undo / Redo / Ctrl+Z / Ctrl+Y exact, a tab change
  not a step; Duplicate byte-identical; Rename identical except the `name` field the tool's own Rename sets; Delete; quota message,
  storage byte-identical; no new console errors). The heatmap legend (lowest / highest deck elevation) is left out of the comparison: it
  fills only once the Output tab has been drawn. The 390 px check is skipped: the page has no phone layout (1086 px wide at 390 px on
  origin/main, the library panel already scrolls sideways there). Number of spans 2 → 3, Undo / Redo exact; Load from the library
  empties the history. `node tests/smoke/list-input.mjs --part bgeo`: pass. `node tests/check-syntax.mjs`: pass.
- **Formulas, factors, units, code references:** none changed (§4 does not apply).

## 2026-11-03 — PR: claude/bg-sheets (PR #752: https://github.com/mlococo88/All-Structural/pull/752) — Drawings tab: drawing sheets on 11 × 17 at plot scale, DXF of the sheets, Print sheet / Print all sheets (BGDW; display only, no result change)

### BGDW. Drawings tab   [display only]
- **Request (engineer, approved):** sheet layouts as in Light Pole and Spread Footing: a Drawings view with a sheet selector, the zoomable
  preview, Download DXF (sheets), Print sheet, Print all sheets and the print note; the existing Export DXF (model space) stays as it was.
- **Sheets** (each a B-size sheet, 17 × 11 in, border and two-row title block, side by side in one DXF R12 file, model space, full size in
  inches; the scale is the smallest standard scale at which the view fits the drawing area):
  1. PLAN: PGL (with station ticks and labels, PC/PT/TS/SC/CS/ST, POB/POE), deck edges and ends, girders per span, curbs, construction
     reference line, support centerlines (station, skew) and bearing lines, north arrow. Local frame: +X along the construction reference
     line from Abut 1 (as the Export DXF "local" option). Engineering scales 1" = 10' … 1" = 2000'.
  2. PROFILE ALONG PGL: profile (finished grade), PVI tangents with grades, START/PVI/END, BVC/EVC, bearing lines with FG; horizontal scale
     from the engineering list, vertical exaggeration 1, 2, 5, 10 or 20 (the largest that keeps the elevation range within 3.5 in); both
     scales in the title block.
  3. TYPICAL SECTION (one per distinct girder / deck-edge layout; "SPANS 1, 2" when they share it): cut square to the reference line at
     midspan of the first span of the group, looking up-station; deck slab, haunch, girder depth and bearing (girders as centerline
     symbols 1'-0" wide: flange widths are not inputs), TD at girders and edges (as the Cross-section view), girder spacing chain and out-to-out,
     depth dimensions (deck, haunch + camber, beam, bearing). Architectural scales 1" = 1'-0" … 1/16" = 1'-0", 1" = 10' … 1" = 40'.
  4. FRAMING PLAN — SPAN n (one per span): girders, deck edges, support CLs, bearing lines with stations, TD / BS at every girder ×
     bearing point (seatData(), as the Beam Seat Output table), girder spacing chain square to the girders and out-to-out, span length
     (PGL stations, as the Span summary).
  5. Tables (NTS, paper inches, paginated): ALIGNMENT AND PROFILE DATA (alignmentRowData(), pviCurveData()), SUPPORTS AND BEARING LINES,
     BEAM SEAT ELEVATIONS and TOP OF DECK ELEVATIONS (read from the two output tables as shown: their mode, divisions and visible columns).
  - Title block: PROJECT, PROJECT NO., CALCULATED BY, DATE, CHECKED BY from the shared project info (`bridgeSuite.v1.projectMeta`
    fields projectName, jobNo, preparedBy, date, checkedBy; read only), CHECKED DATE blank, SCALE, SHEET TITLE, BRIDGE (the library name
    of the bridge, else the shared bridge ID), DRAWN BY, SHEET n OF N.
  - Index table under the preview: each sheet with its scale and a link to the tab where its values are worked (Alignment, Bridge, Top of
    Deck Output, Beam Seat Output).
- **Where:**
  - `<head>`: anchor `<script src="shared/projects-ui.js"></script>`, after it `<script src="shared/dxf.js"></script>` (new).
  - CSS: anchor `.legendbar .grad {`, after it the rules `.bgdwBar`, `.bgdwBox`, `.bgdwHead`, `.bgdwIdx` (new).
  - Tab strip: after `data-tab="map">Site Map</button>` a button `data-tab="drawings">Drawings</button>`; pane `<section class="tabpane"
    id="pane-drawings">` with `<div id="bgdwHost">` before `id="pane-map"` (new).
  - `compute()`: anchor `render3DAlign(); render3DSub();`; before: the next line was `document.getElementById('plan_len')…`; after, between them:
    `if(typeof bgdwRefresh==='function') bgdwRefresh();   // BGDW: the Drawings tab, when it is open`.
  - New `<script>` before `</body>` (anchor `/* ===== DRAWINGS tab (BGDW, 2026-11-03)`): `BGDW_ENG`, `BGDW_ARCH` (scale lists), `BGDW`,
    `bgdwMeta()`, `bgdwBuild()` (the sheets), `bgdwRender()` (the view, buttons: Download DXF → `SharedDxf.validate` then `download`;
    Print sheet / Print all sheets → `SharedDxf.printSheets(… SharedDxf.sheetSVG(B.D, s) …, {paper:[17, 11]})`), `bgdwRefresh()`,
    the tab button's click handler.
  - The Export DXF dialog (`bgDxfBuild`, `bridgeGeomEngine.dxfExport.v1`) is not changed.
- **Saved data:** one new per-browser key `bridgeGeomEngine.dwgSheet.v1` (the sheet id shown), not in the project, the autosave, the
  library or the JSON export. No existing key or format changed.
- **Governing provision:** none (drawing output; every value is an existing engine result).
- **Check case:** the demo bridge (2 spans, Abut 1 Sta 0+00, Pier 1 5+00 (brg 4+97.50 / 5+02.50), Abut 2 10+00; profile START 0+00
  EL 100.000, PVI 4+00 EL 108.000 VC 300', END 9+00 EL 104.000): sheets PLAN 1" = 80', PROFILE H 1" = 80' V 1" = 4' (20×), TYPICAL
  SECTION 1/4" = 1'-0", FRAMING PLAN — SPAN 1 and 2 at 1" = 40', four tables (9 sheets). Profile frame Sta 0+00 to 10+00 × EL 98 to 110:
  1000 ft × 12 / 960 = 12.5 in and 12 ft × 12 / 48 = 3.0 in = 900 × 216 pt; measured on the printed PDF 900.00 × 216.00 pt.
- **How verified:**
  - `node tests/smoke/dxf-print-sheets.mjs --tool bg` (new entry; the tool has no Report, so check 3 checks only that the page's own
    print has no 17 × 11 sheet page): Print sheet 1 page 1224 × 792 pt, border on the page edge, the profile frame to scale; Print all
    sheets 9 pages 17 × 11; print box removed; 0 console errors. PDFs and the preview screenshots looked at.
  - `SharedDxf.validate` passes on the sheets DXF (LINE 355, POLYLINE 44, TEXT 874, CIRCLE 11, DIMENSION 16).
  - The Export DXF text (three option sets: default, local, State Plane with VE 10), origin/main vs this branch: identical (date stamp removed).
  - `node tests/smoke/project-library.mjs --tool bgeo` ALL PASS (results, Output / Beam Seat / Bridge tab text and storage as origin/main);
    `node tests/smoke/list-input.mjs --part bgeo` all passed; `node tests/check-syntax.mjs` passes.
  - Page width (no phone layout; phone-layout.mjs has no Bridge Geometry entry): 1086 px at 390 and 768 px on load, as origin/main; on the
    Drawings tab 571 px at 390 px (the tab strip, now 6 tabs) and 768 px at 768 px.
- **Other copies:** none (Spread Footing / Light Pole have their own sheet builders; the print code is shared/dxf.js).

### Open items
- PROFILE: the two bearing-line labels of a dual-bearing pier (5 ft apart) overlap at small horizontal scales.
- TYPICAL SECTION: girders are symbols (flange widths and girder types are not inputs); the section is at midspan of the first span of
  each layout group only.
- The tool has no calculation report, so the sheets cite tabs ("as the Beam Seat Output tab") rather than report sections (§6).
- The plan and framing plans are in the local frame; a State Plane sheet would need a rotated viewport (not in R12 model space).

## 2026-11-03 — PR: claude/dxf-sheet-inset (PR #754: https://github.com/mlococo88/All-Structural/pull/754) — Drawings: the sheet's outer border 0.25 in inside the paper edge (BGDW-2; display only, no result change)

### BGDW-2. Outer border inset (engineer's decision)
- **Problem (engineer):** on a physical printer the outer border, printed on the page edge, is clipped.
- **Where:** the sheet function of the drawing build (anchor `SharedDxf.sheetBorder(D, L.br`): before `D.rect(L.br, ox, 0, ox+W, H);`, after `SharedDxf.sheetBorder(D, L.br, ox, W, H, k);`
  (shared/dxf.js: a rect 0.25 paper in inside the sheet's edge). The inner border, title block, drawing area, every drawn object and the
  plot scales are unchanged; the sheet is still 17 × 11 in.
- **Governing provision:** none (drawing output).
- **Check case:** PROFILE ALONG PGL (H 1" = 80', V 1" = 4'): profile frame Sta 0+00 to 10+00 × EL 98 to 110 → 12.5 × 3.0 in = 900 × 216 pt, measured 900.00 × 216.00 pt; 1300 entities, 9 sheets. Display list origin/main vs branch: same entity count, scales and offsets; exactly one entity per sheet differs (the
  outer border, 0.25 in × scale inward on every side). Printed: the outer border at (18, 18)-(1206, 774) pt on the 1224 × 792 pt page.
- **How verified:** `node tests/smoke/dxf-print-sheets.mjs` (all tools), the display-list comparison, `node tests/check-syntax.mjs`.
- **Other copies:** shared/dxf.js sheetBorder (fixlog/shared-dxf.md).

### Open items
- None.

## 2026-11-05 — PR: claude/ghsync-bgeo (PR #819: https://github.com/mlococo88/All-Structural/pull/819) (GHS2: saved bridges copied to a private GitHub repository; storage only, no result change)
- **Engineer:** extend GitHub sync (`shared/github-sync.js`; setup `docs/github-sync-setup.md`; own-dialog hooks from PR #815) to the tools with their own project lists.
- **Where:**
  - After `<script src="shared/projects-ui.js"></script>`: new `<script src="shared/github-sync.js"></script>` (anchor `GHS2 (2026-11-05): copy of the saved bridges`).
  - `renderLibrary()`: the empty-list branch calls new `bgGhDraw(host)` before `return`; new `const gh=!!(BG_GH&&BG_GH.engine.configured());` and a `GitHub` header cell and a `<td>${BG_GH.statusCell(n)}</td>` per row **only while sync is set up** (sync off: the table is as before); after `host.innerHTML=h;` new `bgGhDraw(host);`.
  - Delete button handler: `libDelete(n);` → `{ libDelete(n); if(BG_GH&&!(n in libRead())) BG_GH.deleted(n); }` (asks "Also delete … from GitHub?"). Rename handler: after `libRename(n,nn.trim());`, `BG_GH.renamed(n, new)` when the rename happened (asks before deleting the old name on GitHub).
  - `lib_toggle` (opening the panel) and `lib_refresh`: also `BG_GH.shown(BG_GH_UI)` (sync now and list GitHub).
  - New before `bgPlibDup`: `const BG_GH = SharedGitHubSync.attach({ store: SharedProjects.mapStore(localStorage, LIBRARY_KEY), … cloud: { tool: 'bridge-geometry', … } })`, `BG_GH_UI`, `bgGhDraw(host)` (sync bar, first-sync offer and "On GitHub only" rows in a new `div#lib_gh[data-sp=gh-host]` above `#lib_list`) (anchor `GHS2 (2026-11-05): GitHub sync of the saved bridges`).
- **File on GitHub:** `projects/bridge-geometry/<name>.json` = the stored item with `name` = the library name and without `savedAt` (the time of export / save: dropped so an unchanged re-save is not a change), indent 2. This is the Export JSON format (`serializeProject()`); after Load, Export JSON writes the same fields plus `savedAt`. **Download (fromFile):** must be `version: 1` with an `ELEMS` array (applyProject's own check is `version === 1`), stored with `name` and a new `savedAt`. **Open** from GitHub: `libLoad(name)` (the Load button's path).
- **Saved data:** `bridgeGeomEngine.library.v1`, `bridgeGeomEngine.project.v1` and `bridgeGeomEngine.examplesSeeded.v1` unchanged. New keys only while sync is set up: `bridgeSuite.v1.githubSync`, `bridgeSuite.v1.githubSync.tool.bridge-geometry`. With sync off nothing is written and no request is made.
- **Note:** the five example bridges seeded on a browser's first open are library entries like any other: on a device where sync was set up before the tool's first open there, they are uploaded as new saves; on a device that already has them, they are offered by Upload all. Identical examples on two devices give the same file (no conflict).
- **How verified:** `node tests/check-syntax.mjs "Bridge Geometry.html"`: pass. `node tests/smoke/project-library.mjs --tool bgeo` (origin/main vs branch, sync off): ALL PASS. `node tests/smoke/github-sync-tools.mjs --tool bgeo`: ALL PASS (Save As → file; Save → update with sha; "synced" in the row; GitHub-only copy opened → results (ENG and the output panes) identical to the saved bridge; settings button; first-sync offer; Delete asks; sync off: no request, no key; no console errors). origin/main vs branch (sync off), after Save As and Export JSON: export text and file name identical; `bridgeGeomEngine.library.v1`, `.project.v1`, `.examplesSeeded.v1` identical (`savedAt` normalised); 0 requests. Screenshot of the panel with sync on checked.
- **Formulas, factors, units, code references:** none.
- **Other copies:** none.

## 2026-11-05 — PR: claude/header-bgeo (PR #835: https://github.com/mlococo88/All-Structural/pull/835) (BGHD: compact project bar; Save As New, New, JSON / DXF and LL & DL hand-off buttons moved to a new Project tab; display only, no result change)
- **Engineer:** clean up the top of the page (button-only header here: the project bar had 11 buttons); the bar keeps the bridge name and the global actions.
- **Where / before → after** (nodes moved, not copied: every id and handler is the same; the handlers are bound by id at start-up):
  - `.projbar`: before Bridge: `#cur_name`, Save (`#proj_savelib`), Save As New (`#proj_saveas`), Library (`#lib_toggle`), New (`#proj_new`), Undo / Redo (PLIB, after New), Export JSON (`#proj_save`), Import JSON (`#proj_load`, `#proj_file`), Export DXF (`#dxf_export`), Send to LL & DL (`#bgx_send`), Export hand-off (JSON) (`#bgx_export`), save status. After: Bridge: `#cur_name`, Save, Library, Undo / Redo, save status.
  - New page tab `<button class="tabbtn" data-tab="project">Project</button>` (last; the page still opens on Alignment) and `<section class="tabpane" id="pane-project">` with three fieldsets: saved bridges (this browser) (Save As New, New), project file (JSON) and drawing (Export JSON, Import JSON + file input, Export DXF), hand-off to LL & DL Distribution (Send to LL & DL, Export hand-off (JSON)); one-line notes.
  - PLIB block: Undo / Redo inserted after `#lib_toggle` instead of `#proj_new`.
  - `#cur_name` (the bar's bridge name) becomes a link to the Project tab (anchor `/* BGHD (2026-11-05): the bar's bridge name opens the Project tab`; Enter / Space too) and focuses Save As New.
  - CSS (anchor `/* BGHD (2026-11-05)`): `#cur_name.bgLink`, `#pane-project .prjRow`. The print rule already hides buttons and fieldsets.
- **Decisions (pending engineer review):** the bridge name pill is the project line (the tool has no title block); Save (updates the loaded bridge) and Library stay in the bar with Undo / Redo; the page tabs did not fit a phone before this change either (the page already scrolls sideways at 390 / 768 px: max overflow 696 / 318 px on main and on the branch), so the Project tab is at the right end of that row on a phone.
- **Governing provision:** none (layout only).
- **Check case / how verified** (headless Chromium, origin/main vs branch, default bridge):
  - `ENG`, the Top of Deck and Beam Seat output text, every localStorage key (time stamps normalised) and the reload of the autosave: identical;
  - the bridge name opens the Project tab with Save As New focused; Export JSON downloads once; Send to LL & DL opens its dialog; the bar holds Save, Library, Undo, Redo;
  - `project-library --tool bgeo`, `github-sync-tools --tool bgeo`, `dxf-print-sheets --tool bg`, `check-syntax`: pass; 0 console errors;
  - before / after screenshots at 1920 and 390 px looked at.
- **Saved data:** no change.

## 2026-11-06 — PR: claude/bgeo-stds (PR #860: https://github.com/mlococo88/All-Structural/pull/860) (STDS) — the standard save: bar chip + Save + Saved projects…, "save and open" first in the Project tab, Save as, Ctrl+S; library panel retired; example bridges no longer seeded ("Load example…"), untouched examples not uploaded; saved names escaped   [display / save controls only; no result change]
- **Why:** engineer decisions 2026-11-05 / 2026-11-06: standard save roll-out (library panel → the standard dialog and bar); stop seeding the 5 example bridges into the saved list and offer them in a separate "Load example" menu; do not upload untouched examples; never delete examples a user already has; escape saved names (known bug: the library table showed a name as HTML, `<b>…</b>` showed bold).
- **Bar (`header .projbar`):** before: `Bridge: <name pill>` · Save (updates "…") · ▸ Library · Undo · Redo · status. After: chip `Project: <open bridge> ● saved / unsaved changes / not saved` (+ GitHub badge with sync on) · Undo · Redo · **Save (Ctrl+S)** · **Saved projects…** · status. "Bridge:" and `#cur_name` kept with `display:none` (updater `updateNameDisplay` unchanged); `#proj_savelib`, `#lib_toggle` removed. CSS added after `#pane-project .prjRow {…}`.
- **Library panel:** `#lib_panel` (Save current as…, Refresh list, the table) removed; its listeners (`proj_savelib`, `proj_saveas`, `lib_saveas`, `lib_refresh`, `lib_toggle`, `proj_new`) removed (anchor `/* STDS (2026-11-06): New, Save (updates …), Save As New, Save current as…, Refresh list and ▸ Library are the standard save controls`). `doSave`, `doSaveAs`, `libSave`, `libLoad`, `libDelete`, `libRename`, `renderLibrary` kept (libSave / libLoad are the standard Save / Open; renderLibrary returns at once without `#lib_list`).
- **Escaping:** `renderLibrary` (anchor `<td class="lbl">${isCur?'▸ ':''}`): before `${n}`, after `${String(n).replace(/[&<>"]/g,…)}` (the table is retired, fixed anyway); the standard dialog escapes names (tests/smoke/bgeo-examples.mjs: "HTML <b>bold</b>" shows as text).
- **Project tab:** fieldset "saved bridges (this browser)" (Save As New · New) → **"save and open"**, first: `#bgSaveCard` with the standard card (status; Save · Save as… · Saved projects… · New; "File on this computer": Export JSON · Import JSON, the same `#proj_save` / `#proj_load` buttons and handlers; third row **Load example…** `<select id="bg_example">`). The next fieldset "project file (JSON) and drawing" → "drawing (DXF)" (Export DXF only; note shortened).
- **Code:** GHS2 `const BG_GH=(()=>{ … })();` → `const BG_GH=null;` (sync moved, unchanged, into the projectBar's `cloud`: folder `bridge-geometry`, toFile = item with name = list name and no savedAt, fromFile = version-1 check + name + new savedAt). `bgPlibInit` puts Undo / Redo after `#cur_name` (was after ▸ Library) and calls new `bgStdsInit(bu)` (anchor `function bgStdsInit(bu){`): `projectBar({ store: mapStore(localStorage, LIBRARY_KEY, { time: i => i.savedAt }), omit: ['savedAt','name','activeSta'], getState: serializeProject, current / setCurrent: CURRENT_NAME, save: libSave (no "Update …?" question), open: libLoad (the inputs on screen right after Open are remembered as that item's state, so an item saved by an older version with fewer fields is not "unsaved changes" at once), newProject: freshDefaults (the demo bridge, the old New without its confirm), exportFile: downloadProject, importFile: #proj_file, renamed / deleted (CURRENT_NAME as the old Rename / Delete), cloud })`. Import (`loadProjectFromFile`): the open name is cleared (was the file's `name`).
- **Examples:** `seedExampleBridges()` is no longer called at start-up (function and `EXAMPLE_BRIDGES` kept; `bridgeGeomEngine.examplesSeeded.v1` is no longer written, nor read). **Load example…** opens the chosen example (a copy of `EXAMPLE_BRIDGES[k]`, name null) through `applyProject` as a new, unsaved bridge: no library write; asks first when the bridge on screen has unsaved changes; new undo history. Examples already in a user's list stay (nothing deletes them). With GitHub sync set up, `bgExCheck()` (at start, every 3 s and after each Save) holds every list item whose content equals a built-in example (savedAt and name aside; any list name, so renamed copies too) in this browser (`engine.hold`, the "This browser only" state: not uploaded, also not by Upload all); the user's own choices end it for that name (Upload in the dialog, Save as with either location); an example saved with changes is uploaded as any project (the hold is released and the save uploaded). Copies uploaded by older versions stay on GitHub.
- **Behaviour changes (asked for):** Save saves to the open bridge without "Update … ?"; a new duplicate name at Save as is blocked ("Replace it"); Open / New / Import / Load example ask first on unsaved changes; Ctrl+S / Ctrl+Shift+S; dialog Rename moves the item unchanged (the old Rename also set the item's inner `name`, which Open and the GitHub file do not use).
- **Saved data (§5):** `bridgeGeomEngine.library.v1`, `bridgeGeomEngine.project.v1` and the Export JSON format unchanged; `bridgeGeomEngine.examplesSeeded.v1` left as it is where it exists (not written for new users). GitHub folder, file text and bookkeeping key unchanged (the hold is the shared engine's own field in it).
- **Formulas, factors, units, code references:** none (§4 does not apply).
- **How verified:** main vs branch, same input change then each side's own Save of "Cmp A": (a) on a browser that already has the seeded examples (main's storage): results identical after the change and after Save; every key identical (`examplesSeeded`, library 9,227 chars, project; time stamps aside); Export JSON (3,018 chars), Top of Deck and Beam Seat output text identical; (b) fresh browser: the same, except main seeds the 5 examples and the flag and the branch does not (the "Cmp A" item is identical). `tests/smoke/bgeo-examples.mjs` (new): fresh → nothing seeded, Load example… opens Example 2 unsaved, library unchanged; seeded + sync → 5 examples kept and held, Upload all uploads only own bridges, Upload of one example uploads it and it stays released, a renamed untouched example stays held, an example changed and saved uploads, a name with HTML shown as text. Probe: save → saved; change → unsaved; Ctrl+S saves without a dialog; tabs leave "saved"; Open asks; reload finds the bridge; New → not saved. `project-library --tool bgeo` (standard dialog), `github-sync-tools --tool bgeo` (standard dialog), sync off (no request, no sync key), `list-input --part bgeo`, `home-projects`, `home-sync`, `standard-save`, `github-sync`, engine, `check-syntax`: pass. 390 px: page 666 px wide (main 1,086 px; no phone layout), dialog 355 / 355; screenshots looked at.
- **Decision (pending engineer review):** "untouched" = content equal to the built-in example (savedAt and name aside). Examples saved again by the old "Save (updates …)" without changes are not "untouched" (Save wrote the full project format) and sync as any project.
- **Decision (pending engineer review):** the hold is decided per browser; an example already uploaded by an older version stays on GitHub (and in other browsers' lists); nothing is deleted there.
## 2026-11-06 — PR: claude/hdrs-bgeo (PR #903: https://github.com/mlococo88/All-Structural/pull/903) (HDRS) — header: Save and Saved projects… removed (in the "Save and open" card only); the chip opens the Project tab   [display only; no result change]
- **Why:** engineer 2026-11-06: every app's header as in Spread Footing (#884): no Save (Ctrl+S) and Saved projects… buttons in the header; they stay in the "Save and open" card. The header keeps the project chip (click = the Project tab), Undo, Redo, the app's other global actions and Print. Ctrl+S and Ctrl+Shift+S work from anywhere. No "Recent projects" start strip (Spread Footing only).
- **Where:** the `SharedProjectsUI.projectBar({...})` call, right after the line `header:bar, chipBefore:bu, headerBefore:$('save_status'), card:$('bgSaveCard'),` (a comment `/* HDRS (2026-11-06, …) */` and one line).
  Before: nothing. After:
  `headerSave:false, chipClick:()=>{ const t=document.querySelector('.tabbtn[data-tab="project"]'); if(t) t.click(); window.scrollTo(0,0); }, chipHint:'the Project tab (Save and open)',`
  Uses the projectBar options of `shared/projects-ui.js` (HDRS, #884; `fixlog/shared-projects.md`): `headerSave:false` (the chip only in the header), `chipClick`, `chipHint` (the chip tooltip's "Click: …").
- **Header before:** chip · Undo · Redo · Save · Saved projects… · autosaved time; chip click = Saved projects… dialog. **After:** chip · Undo · Redo · autosaved time; chip click = the Project tab (its tab button `.tabbtn[data-tab="project"]` clicked, page scrolled to the top; the "Save and open" fieldset first in it), as the bar's bridge name did (BGHD). The card's buttons are unchanged.
- **Problem:** none (layout request). **Governing provision:** none (§4 does not apply).
- **Check case:** default project, another tab open: click the chip → the Project tab, the "Save and open" card on screen, no dialog; Ctrl+S on another tab (nothing saved yet) → Save as dialog; Ctrl+Shift+S → Save as dialog.
- **How verified:** main vs branch on the default project: every localStorage key (1), page text (20410 chars), Export JSON (2956 chars identical) and the printed report text (print media, 1356 chars) identical (clock times normalised); 0 console errors; chip click → card on screen, no dialog; Ctrl+S / Ctrl+Shift+S → Save as; header at 1280 / 1400 / 1920 / 390 px (390: no sideways scroll), screenshots looked at. `node tests/check-syntax.mjs "Bridge Geometry.html"`; `node tests/smoke/project-library.mjs --tool bgeo`; `node tests/smoke/github-sync-tools.mjs --tool bgeo`; `node tests/smoke/home-projects.mjs --tool bgeo`: pass. 390 px: the page scrolls sideways on main too (1086 px wide, no phone layout; project-library notes it); the header row itself fits.
- **Saved data:** no key or format changed (§5).
- **Other copies:** none. **Open items:** none.

## 2026-11-06 — PR: claude/bg-dual-bearing-labels (PR #902: https://github.com/mlococo88/All-Structural/pull/902) (BGDL: profile bearing-line labels of dual bearings spread apart with leader lines, Drawings tab profile sheet and Export DXF profile; display only, no result change)

- **Why:** engineer 2026-11-06: on the profile, the labels of dual bearings (back and ahead bearing lines of a pier) overlap each other.
- **Problem (before):** the profile sheet (Drawings tab, sheet "PROFILE ALONG PGL") and the profile of the Export DXF dialog write each bearing line's label rotated 90°, just left of its own line, above the frame. Two lines closer than the label height overlap. Reproduced with the built-in **Example 5 — 5-Span River Crossing** (piers dual, bearing offset 2.5 ft, sheet at 1" = 80'): the two labels of each pier are 0.0625 in apart for 0.07 in text (touching). With the bearing offset set to 1.0 ft (a continuity pier; lines 2 ft apart): 0.025 in apart, the labels print on top of each other. Export DXF profile (text height 0.7h = 2.8 ft, h = 4 ft for Example 5): offset 1.0 ft → labels 2.0 ft apart for 2.8 ft text, overlapping; 0.5 ft → 1.0 ft apart.
- **Where (anchors):**
  - New helper `bgLabSpread(xs,p)` just before `/* text along direction dir from P (distance d), centred on the line, reading upright */` (`function bgdwLab(`).
  - `bgdwBuild`, profile sheet (anchor `sheet('profile','PROFILE ALONG PGL',k=>{`), the bearing-line loop.
  - Export DXF `build(opt)`, `/* ===== 7. profile along the PGL ===== */`: the `topGap` line and the `brgTxt.forEach` loop.
- **Before (profile sheet):**
```js
    brgLines.forEach(b=>{ const st=b.bl.sta; if(st<sA-1e-6||st>sB+1e-6) return; const fg=E.prof.elevAt(st);
      D.line(L.brg,PX(st),PY(zlo),PX(st),PY(zhi),D.ltype('DASHED'));
      D.text(L.txt,PX(st)-0.03*k,PY(zhi)+0.08*k,0.07*k,(b.bl.label+'  STA '+formatStation(st)+'  FG '+fg.toFixed(dec)).toUpperCase(),0,90); });
```
- **After (profile sheet):**
```js
    /* BGDL: labels of bearing lines closer than the label pitch (0.07 in text + 0.03 in) spread apart, each with a leader line */
    const bIn=brgLines.filter(b=>!(b.bl.sta<sA-1e-6||b.bl.sta>sB+1e-6)), bSp=bgLabSpread(bIn.map(b=>PX(b.bl.sta)-0.03*k),0.10*k);
    bIn.forEach((b,i)=>{ const st=b.bl.sta, fg=E.prof.elevAt(st), lx=bSp.x[i], ly=PY(zhi)+(bSp.moved[i]?0.20*k:0.08*k);
      D.line(L.brg,PX(st),PY(zlo),PX(st),PY(zhi),D.ltype('DASHED'));
      if(bSp.moved[i]) D.pline(L.txt,[[PX(st),PY(zhi)],[PX(st),PY(zhi)+0.04*k],[lx+0.03*k,PY(zhi)+0.14*k],[lx+0.03*k,PY(zhi)+0.17*k]]);
      D.text(L.txt,lx,ly,0.07*k,(b.bl.label+'  STA '+formatStation(st)+'  FG '+fg.toFixed(dec)).toUpperCase(),0,90); });
```
- **Before (Export DXF profile):**
```js
      const topGap=2*h+Math.max(0,...brgTxt.map(b=>0.62*0.7*h*b[2].length));
...
      brgTxt.forEach(([bl,fg,t])=>{
        W.line(LY.pbrg,[PX(bl.sta),PY(zlo)],[PX(bl.sta),PY(zhi)+0.5*h]);
        W.text(LY.ptext,[PX(bl.sta)-0.15*h,PY(zhi)+0.8*h],0.7*h,t,{rot:90,va:0}); });
```
- **After (Export DXF profile):**
```js
      /* BGDL: labels of bearing lines closer than the label pitch (0.7h text + 0.3h) spread apart, each with a leader line
         (positions relative to the frame's left edge: the spacing does not depend on where the frame is placed) */
      const bSp=bgLabSpread(brgTxt.map(([bl])=>(bl.sta-sA)*k-0.15*h),1.0*h);
      const topGap=2*h+Math.max(0,...brgTxt.map(b=>0.62*0.7*h*b[2].length))+(bSp.moved.some(Boolean)?1.3*h:0);   // BGDL: + the leader rise
...
      brgTxt.forEach(([bl,fg,t],i)=>{
        W.line(LY.pbrg,[PX(bl.sta),PY(zlo)],[PX(bl.sta),PY(zhi)+0.5*h]);
        const lx=X0+bSp.x[i];   // BGDL: the label's position (spread when crowded)
        if(bSp.moved[i]) W.pline(LY.ptext,[[PX(bl.sta),PY(zhi)+0.5*h],[lx+0.15*h,PY(zhi)+1.5*h],[lx+0.15*h,PY(zhi)+1.9*h]]);
        W.text(LY.ptext,[lx,PY(zhi)+(bSp.moved[i]?2.1*h:0.8*h)],0.7*h,t,{rot:90,va:0}); });
```
- **What it does:** the label positions are spread only where two (or more) labels are closer than one pitch (sheet: 0.07 in text + 0.03 in = 0.10 in of paper; DXF: 0.7h + 0.3h = 1.0h). A crowded group is spread to that pitch, centred on its own lines, in station order (back bearing label left of the ahead one). Each spread label starts higher (sheet 0.20 in instead of 0.08 in above the frame; DXF 2.1h instead of 0.8h) and gets a leader line from the top of its bearing line (sheet: text layer; DXF: BG-PROF-TEXT). A label with room is drawn exactly as before. In the Export DXF, the profile frame's default position moves down by 1.3h only when some label was spread (room for the leader rise). Same drawing style: rotated text, thin leader with a short vertical stub at each end.
- **Governing provision:** none (display only).
- **Check case:** Example 5, Pier 1 back/ahead bearings at Sta 12+07.50 / 12+12.50 (offset 2.5 ft), sheet 1" = 80': before, label baselines 0.0625 in apart; after, 0.10 in apart, each with a leader. Offset 1.0 ft (Sta 12+09.00 / 12+11.00): before 0.025 in apart (overlapping); after 0.10 in. Export DXF, offset 1.0 ft: before labels 2.0 ft apart with 2.8 ft text; after 4.0 ft apart (= 1.0h, h = 4 ft). Examples 1, 2, 3 (Example 2 at 1" = 40', dual piers 5 ft apart = 0.125 in) and Example 4: sheets and DXF byte-identical to origin/main.
- **How verified:** headless Chromium, origin/main vs the branch, all five examples plus Example 5 with offset 1.0 ft: the text of every tab (Alignment, Bridge, Output tables, Beam Seat, Drawings, Project), the Export JSON (`serializeProject`) and every localStorage key/value are identical (time stamps masked). DXF (Export DXF local and auto coordinates, and the drawing sheets DXF): identical for Examples 1–4 and 5 as built-in, except Example 5's sheet DXF (spread labels); differences elsewhere only for the offset 1.0 / 0.5 ft variants (spread labels and the frame shift). Tests: check-syntax, `tests/smoke/bgeo-examples.mjs`, `tests/smoke/dxf-print-sheets.mjs --tool bg`, `tests/smoke/project-library.mjs --tool bgeo`. Sheets and zooms of the Pier 1 labels looked at, before and after.
- **Saved data:** none touched (§5). **Other copies:** none.
- **Not changed:** the on-screen Plotly profile (it draws support ticks without labels) and the plan view's bearing-line station labels.

## 2026-11-06 — PR: claude/bg-plan-brg-labels (PR #910: https://github.com/mlococo88/All-Structural/pull/910) (BGDP: on-screen plan, the station labels of a dual-bearing pier's two bearing lines spread apart with leader lines; display only, no result change)

- **Why:** engineer 2026-11-06, after BGDL (#902): check the PLAN view's bearing station labels at piers with two bearing lines (on-screen plan, Drawings plan sheet, DXF plan) with Example 5 and its 1 ft-offset variant; treat them like the profile labels if they crowd.
- **Findings:**
  - **On-screen plan** (Output tab, canvas `#heat`, `drawHeatmap`, layer "station callouts"): the labels "brg-back Sta …" and "brg-ahead Sta …" are drawn left-aligned, 8.5 px, just past the deck's right edge at each line. Two lines 5 ft apart are a few pixels apart on screen, so the two labels printed on top of each other. Seen in Example 5 (offset 2.5 ft) and its 1 ft variant at all four piers. In Example 3 (curved) they were 9 px apart and touched an elevation label. **Changed.**
  - **Export DXF plan** (BG-BRG-TEXT): each label is placed on the outer side of its own line: back on the back side, ahead on the ahead side (`va` 1 / 3). Example 5 with a 1 ft offset: back label x 156.2–159.0, ahead x 161.0–163.8 (text 2.8 ft); 0.5 ft: 156.7–159.5 vs 160.5–163.3. They do not overlap at any offset. **Not changed.**
  - **Drawings tab, PLAN sheet:** draws the bearing lines without labels (support CL labels only). Framing-plan sheets: one span each, so a pier's back and ahead labels are on different sheets (Example 5, 1 ft: 2424 drawing units apart). **Not changed.**
- **Where:** `drawHeatmap`, block `// ---- station callouts for each substructure unit + each distinct bearing line ----`, after `ctx.font='8.5px monospace';`. Uses `bgLabSpread` (BGDL).
- **Before:**
```js
    bearingLinesFor(u).forEach(bl=>{ if(Math.abs(bl.sta-u.sta)<1e-6) return;
      const bp=ENG.deckAtSupport(bl, ed.r);
      ctx.fillStyle=CYAN; ctx.textAlign='left';
      ctx.fillText(`${bl.label.replace(u.name+' ','')} Sta ${formatStation(bl.sta)}`, TX(bp.x)+5, TY(bp.y)); });
```
- **After:**
```js
    /* BGDP (2026-11-06): the labels of a dual-bearing pier's two lines were drawn on top of each other where the lines are a few
       pixels apart. Where two labels' boxes overlap, they are spread apart vertically (one text line, 11 px, by bgLabSpread,
       in screen order; moved off the deck where its edge faces up or down) with a short leader from each line; labels with room are
       drawn as before. Display only. */
    const bLab=bearingLinesFor(u).filter(bl=>Math.abs(bl.sta-u.sta)>=1e-6).map(bl=>{ const bp=ENG.deckAtSupport(bl, ed.r);
      const t=`${bl.label.replace(u.name+' ','')} Sta ${formatStation(bl.sta)}`; return {t, x:TX(bp.x), y:TY(bp.y), w:ctx.measureText(t).width}; });
    const bHit=bLab.some((a,i)=>bLab.some((b,j)=>j>i&&Math.abs(a.y-b.y)<11&&Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>-4));
    const bSp=bHit?bgLabSpread(bLab.map(q=>q.y),11):{x:bLab.map(q=>q.y),moved:bLab.map(()=>false)};
    if(bHit){ /* off the deck: where the deck edge faces up or down on screen, the spread group moves outward, clear of the deck */
      const cm=ENG.deckAtSupport({sta:u.sta,skew:u.skew},(ed.l+ed.r)/2), oy=bLab[0].y-TY(cm.y), ox=bLab[0].x-TX(cm.x);
      if(Math.abs(oy)>Math.abs(ox)){ const ys=bLab.map(q=>q.y), d=oy>0?(Math.max(...ys)+8)-Math.min(...bSp.x):(Math.min(...ys)-8)-Math.max(...bSp.x);
        bSp.x=bSp.x.map(v=>v+d); } }
    bLab.forEach((q,i)=>{ const ly=bSp.x[i];
      ctx.fillStyle=CYAN; ctx.textAlign='left';
      if(bSp.moved[i]){ const lx=Math.max(...bLab.map(z=>z.x))+10; ctx.save(); ctx.strokeStyle=CYAN; ctx.lineWidth=0.75; ctx.beginPath(); ctx.moveTo(q.x+1,q.y); ctx.lineTo(lx-2,ly); ctx.stroke(); ctx.restore();
        ctx.fillText(q.t, lx, ly); }
      else ctx.fillText(q.t, q.x+5, q.y); });
```
- **What it does:** when two labels of the pier overlap (vertical distance < 11 px and their widths overlapping across), they are spread to an 11 px pitch in screen y. Where the deck edge faces up or down on screen, the group moves outward, clear of the deck (8 px past the outermost line point). The labels start 10 px right of the rightmost line point, each with a thin leader from its line. Otherwise drawn exactly as before.
- **Check case:** Example 5, Pier 1, Sta 12+07.50 / 12+12.50 at the default view (1270 px canvas). Before: both labels at the same place, unreadable. After: "brg-back Sta 12+07.50" above "brg-ahead Sta 12+12.50", below the deck edge, with leaders. The same with offset 1 ft (12+09.00 / 12+11.00).
- **Governing provision:** none (display only).
- **How verified:** origin/main vs branch, the 5 examples + Example 5 with offset 1 ft: the text of every tab, Export JSON and all localStorage identical. Export DXF (local, auto) and the sheets DXF are byte-identical for all, including offsets 1 ft and 0.5 ft. Tests: check-syntax, bgeo-examples, dxf-print-sheets --tool bg, project-library --tool bgeo. Screenshots before and after (Examples 2, 3, 5, 5 at 1 ft).
- **Saved data:** none. **Other copies:** none.
- **Open item:** at piers with two bearing lines the on-screen girder × bearing elevation labels (TD at each girder on each line) also overlap. Not part of this request; ask before changing.

## 2026-11-06 — PR: claude/bg-plan-elev-labels (PR #914: https://github.com/mlococo88/All-Structural/pull/914) (BGDE: on-screen plan, girder × bearing top-of-deck labels at dual-bearing piers placed clear of each other; display only, no result change)

- **Why:** engineer 2026-11-06 (BGDP open item): give the on-screen plan's girder × bearing top-of-deck elevation labels at piers with two bearing lines the same treatment as the bearing station labels.
- **Problem (before):** `drawHeatmap`, layer "elevation nodes at girder×support": each label is drawn left-aligned 3 px right of its node. At a dual-bearing pier the back and ahead nodes of a girder are a few pixels apart, so the two values printed on top of each other. Example 5 (offset 2.5 ft) and its 1 ft and 0.5 ft variants: all 8 girders at all 4 piers. Example 2 (skew 25°): both piers. Example 3 (curved): partly.
- **Where:** `drawHeatmap`: the `// ---- elevation nodes at girder×support ----` block (rewritten), and the BGDP bearing-label block (it now records its label boxes in `bgBrgBox`, declared just before `if(LY('ly_sta')){` of the station callouts).
- **Exact code (unified diff, `Bridge Geometry.html`):**
```diff
@@ -2306,0 +2307 @@ function drawHeatmap(){
+  const bgBrgBox={};   /* BGDE: where each support's bearing-line station labels were drawn (boxes), for the elevation labels */
@@ -2333,2 +2334,2 @@ function drawHeatmap(){
-        ctx.fillText(q.t, lx, ly); }
-      else ctx.fillText(q.t, q.x+5, q.y); });
+        ctx.fillText(q.t, lx, ly); (bgBrgBox[u.name]=bgBrgBox[u.name]||[]).push([lx,ly-5,lx+q.w,ly+5]); }
+      else { ctx.fillText(q.t, q.x+5, q.y); (bgBrgBox[u.name]=bgBrgBox[u.name]||[]).push([q.x+5,q.y-5,q.x+5+q.w,q.y+5]); } });
@@ -2343,0 +2345,7 @@ function drawHeatmap(){
+  /* BGDE (2026-11-06, engineer): at a pier with two bearing lines the top-of-deck labels of the back and ahead lines were drawn
+     on top of each other (each label just right of its node, the nodes a few pixels apart). Per girder, where the pair's labels
+     overlap, the first clear of: (1) side by side, the node further left on screen labelled to its left, the other to its right;
+     (2) the pair spread one text line apart vertically (bgLabSpread, 11 px) right of the nodes with a leader to each node, centred,
+     then above, then below. Clear = no overlap with each other, with the support's other elevation labels, with its name /
+     station / skew callouts or with its bearing-line station labels (bgBrgBox). None clear: side by side. Labels with room, and every single-line support, are drawn as before.
+     Display only. */
@@ -2345,5 +2353,22 @@ function drawHeatmap(){
-    su.forEach(u=>bearingLinesFor(u).forEach(bl=>{ const span=Math.max(1,Math.min(su.length-1,spanOfSta(bl.sta))); const gset=girdersForSpan(span);
-      gset.forEach(off=>{ const p=ENG.deckAtSupport(bl,off);
-        const px=TX(p.x),py=TY(p.y);
-        ctx.fillStyle=INK; ctx.beginPath(); ctx.arc(px,py,1.7,0,Math.PI*2); ctx.fill();
-        ctx.fillStyle=INK; ctx.textAlign='left'; ctx.fillText((p.z+ZADD).toFixed(2), px+3, py); }); })); }
+    const eBox=q=>q.al==='right'?[q.tx-q.w,q.ty-5,q.tx,q.ty+5]:[q.tx,q.ty-5,q.tx+q.w,q.ty+5];
+    const eHit=(a,b)=>{ const A=eBox(a),B=eBox(b); return Math.min(A[2],B[2])-Math.max(A[0],B[0])>-1&&Math.min(A[3],B[3])-Math.max(A[1],B[1])>-1; };
+    su.forEach(u=>{ const L=bearingLinesFor(u).map(bl=>{ const span=Math.max(1,Math.min(su.length-1,spanOfSta(bl.sta))); const gset=girdersForSpan(span);
+        return gset.map(off=>{ const p=ENG.deckAtSupport(bl,off), px=TX(p.x), py=TY(p.y), t=(p.z+ZADD).toFixed(2);
+          return {px,py,t,w:ctx.measureText(t).width,tx:px+3,ty:py,al:'left',lead:false}; }); });
+      if(L.length===2&&L[0].length===L[1].length){
+        /* obstacles: the support's own callouts (name, Sta, Skew: right-aligned left of the deck's left edge, 10 px font) */
+        const obs=(bgBrgBox[u.name]||[]).slice(); if(LY('ly_sta')){ const sp0=Math.max(1,Math.min(su.length-1,spanOfSta(u.sta))), top=ENG.deckAtSupport({sta:u.sta,skew:u.skew},edgesForSpan(sp0).l), lx=TX(top.x), ly=TY(top.y);
+          ctx.font='10px monospace'; [[u.name,-7],['Sta '+formatStation(u.sta),5]].concat(u.skew?[['Skew '+u.skew.toFixed(1)+'°',17]]:[]).forEach(([t,dy])=>{ const w=ctx.measureText(t).width; obs.push([lx-6-w,ly+dy-6,lx-6,ly+dy+6]); }); ctx.font='8.5px monospace'; }
+        const all=L.flat(), clear=(q,skip)=>{ const A=eBox(q); return !obs.some(B=>Math.min(A[2],B[2])-Math.max(A[0],B[0])>-1&&Math.min(A[3],B[3])-Math.max(A[1],B[1])>-1)&&!all.some(z=>!skip.includes(z)&&eHit(q,z)); };
+        const set=(q,al,tx,ty,lead)=>{ q.al=al; q.tx=tx; q.ty=ty; q.lead=lead; };
+        L[0].forEach((a,g)=>{ const b=L[1][g]; if(!eHit(a,b)) return;
+          const [l,r]=a.px<=b.px?[a,b]:[b,a], x0=Math.max(a.px,b.px)+8, s=bgLabSpread([a.py,b.py],11), lo=Math.min(...s.x), hi=Math.max(...s.x);
+          const C=[()=>{ set(l,'right',l.px-3,l.py,false); set(r,'left',r.px+3,r.py,false); },              // side by side
+            ()=>{ set(a,'left',x0,s.x[0],true); set(b,'left',x0,s.x[1],true); },                                  // stacked, centred
+            ()=>{ set(a,'left',x0,s.x[0]-(hi-Math.max(a.py,b.py))-5,true); set(b,'left',x0,s.x[1]-(hi-Math.max(a.py,b.py))-5,true); },   // stacked, above
+            ()=>{ set(a,'left',x0,s.x[0]+(Math.min(a.py,b.py)-lo)+5,true); set(b,'left',x0,s.x[1]+(Math.min(a.py,b.py)-lo)+5,true); }]; // stacked, below
+          if(!C.some(f=>{ f(); return !eHit(a,b)&&clear(a,[a,b])&&clear(b,[a,b]); })) C[0](); }); }
+      L.flat().forEach(q=>{
+        ctx.fillStyle=INK; ctx.beginPath(); ctx.arc(q.px,q.py,1.7,0,Math.PI*2); ctx.fill();
+        if(q.lead){ ctx.save(); ctx.strokeStyle=INK; ctx.lineWidth=0.6; ctx.beginPath(); ctx.moveTo(q.px+1.5,q.py); ctx.lineTo(q.tx-1.5,q.ty); ctx.stroke(); ctx.restore(); }
+        ctx.fillStyle=INK; ctx.textAlign=q.al; ctx.fillText(q.t, q.tx, q.ty); }); }); }
```
- **What it does:** per girder at a support with two bearing lines, only where the pair's labels overlap, the first placement that is clear is used:
  1. side by side: the node further left on screen labelled to its left (right-aligned), the other to its right;
  2. the pair one text line apart (11 px, `bgLabSpread`) to the right of the nodes with a leader to each node, centred;
  3. the same, above the nodes;
  4. the same, below the nodes.

  "Clear" means no overlap with each other, with the support's other elevation labels, with its name / Sta / Skew callouts, or with its bearing-line station labels. If none is clear, side by side is used. Labels with room, and every support with one bearing line, are drawn exactly as before.
- **Governing provision:** none (display only).
- **Check case:** Example 5, Pier 1 (back 12+07.50, ahead 12+12.50), girder G4. Before: "99.41" (back) and "99.49" (ahead) printed in the same place, unreadable. After: "99.41" left of the back node, "99.49" right of the ahead node. Top girder with offset 0.5 ft: the side-by-side left label hit the "Sta 12+10.00" callout, so the pair is stacked above the deck edge with leaders. Bottom girder: stacking below would hit the bearing station labels, so it stays side by side.
- **How verified:** origin/main vs branch on the 5 examples plus Example 5 with offsets 1 ft and 0.5 ft: every tab's text, Export JSON and all localStorage identical. Export DXF (local, auto) and the sheets DXF byte-identical (Examples 1, 2, 3, 5 and both variants; 18 files). Plan canvas pixel-identical for Examples 1 and 4 (no dual bearings). Tests: check-syntax, bgeo-examples, dxf-print-sheets --tool bg, project-library --tool bgeo. Screenshots before and after looked at.
- **Saved data:** none. **Other copies:** none.

## 2026-11-07 — PR: claude/bg-h2-extend-tangents (PR #1103: https://github.com/mlococo88/All-Structural/pull/1103) (BGX1, review H2 + L3 part: points before the POB / after the POE on the extended end tangents, with a warning)   [calc change] [results change only for deck points outside the alignment]

- **Why:** in-depth review 2026-11-07, H2. A deck point before the POB or after the POE was evaluated at the POB / POE station (`projectToPGL` found no sign change of the along-tangent residual and kept the nearest end station). The skewed chord puts half the girders of the default demo bridge past both alignment ends, so Abut 1 G4 was 0.10 ft high. Also L3 (part): an alignment that starts or ends with a spiral put every station beyond its end on the end point, and a curve end continued around the circle.
- **Governing provision:** none (route-surveying geometry). Commercial practice (and the review): a point beyond the alignment ends is referred to the end tangent extended, with a warning.
- **Where (anchors):**
  - `buildAlignment`: the element loop (a `TAN` set of the tangent elements) and the returned `at(s)` (anchor `function extTan(e, s0, s)`).
  - `projectToPGL`: anchor `// BGX (H2): the extended end tangents`.
  - New `geometryWarnings()` / `showGeomWarnings()` just before `function compute(){`, called right after `ENG=buildEngine();`; new box `<div id="geom_warn">` right after `<div id="geom_err">`.
- **Before:**
```js
  let sta=pob.sta,x=pob.x,y=pob.y,brg=pob.brg*DEG; const elems=[];
  for(const ln of lines){ const p=ln.split(',').map(s=>s.trim()); const type=p[0].toLowerCase();
    if(type==='tan') elems.push(makeTangent(sta,x,y,brg,+p[1]));
  …
  if(elems.length===0) elems.push(makeTangent(pob.sta, pob.x, pob.y, pob.brg*DEG, 0));
  return { staStart:pob.sta, staEnd:sta,
    at(s){ let el=elems.find(e=>s>=e.staStart-1e-9&&s<=e.staEnd+1e-9);
      if(!el) el=(s<elems[0].staStart)?elems[0]:elems[elems.length-1]; return el.at(s); }, elems };
```
```js
  let sstar;
  if(brk.length){ let bestD=Infinity;
    for(const [lo,hi] of brk){ … if(d<bestD){ bestD=d; sstar=r; } }
  } else { sstar=bestS; } // no sign change (point beyond the ends) -> nearest endpoint station
  const a=align.at(sstar); const nrm=a.brg+Math.PI/2;
  const off=(x-a.x)*Math.sin(nrm)+(y-a.y)*Math.cos(nrm); // signed perpendicular offset
  return { sta:sstar, off };
```
- **After:**
```js
  let sta=pob.sta,x=pob.x,y=pob.y,brg=pob.brg*DEG; const elems=[], TAN=new Set();   // TAN: the tangent elements (BGX, H2)
  for(const ln of lines){ const p=ln.split(',').map(s=>s.trim()); const type=p[0].toLowerCase();
    if(type==='tan'){ elems.push(makeTangent(sta,x,y,brg,+p[1])); TAN.add(elems[elems.length-1]); }
  …
  if(elems.length===0){ elems.push(makeTangent(pob.sta, pob.x, pob.y, pob.brg*DEG, 0)); TAN.add(elems[0]); }
  const eF=elems[0], eL=elems[elems.length-1];
  function extTan(e, s0, s){ const a=e.at(s0), d=s-s0; return { x:a.x+Math.sin(a.brg)*d, y:a.y+Math.cos(a.brg)*d, brg:a.brg }; }
  return { staStart:pob.sta, staEnd:sta,
    at(s){ let el=elems.find(e=>s>=e.staStart-1e-9&&s<=e.staEnd+1e-9);
      if(!el){ const e=(s<eF.staStart)?eF:eL; if(TAN.has(e)) return e.at(s);
        return extTan(e, (e===eF&&s<eF.staStart)?e.staStart:e.staEnd, s); }
      return el.at(s); }, elems };
```
```js
  let sstar, bestD=Infinity, ext=0;
  if(brk.length){
    for(const [lo,hi] of brk){ … if(d<bestD){ bestD=d; sstar=r; } }
  }
  // BGX (H2): the extended end tangents (align.at continues on them past the POB / POE)
  if(s1>s0){ const f0=f(s0), f1=f(s1);
    [[f0<0, s0+f0, -1], [f1>0, s1+f1, 1]].forEach(([on, se, k])=>{ if(!on) return;
      const q=align.at(se), d=Math.hypot(x-q.x, y-q.y); if(d<bestD-1e-9){ bestD=d; sstar=se; ext=k; } }); }
  if(sstar===undefined) sstar=bestS;   // zero-length alignment: the POB
  const a=align.at(sstar); const nrm=a.brg+Math.PI/2;
  const off=(x-a.x)*Math.sin(nrm)+(y-a.y)*Math.cos(nrm); // signed perpendicular offset
  return { sta:sstar, off, ext };
```
  `geometryWarnings()` evaluates `ENG.deckAtSupport(bl, off)` for every bearing line of every support at both deck edges and every girder, and reports the furthest point before the POB and after the POE: "Deck points lie up to X ft before the POB (Sta …), at <bearing line>. Their plan position is projected onto the start tangent extended. Extend the alignment to cover the whole deck." (same for the POE). The box shows only when there is a warning; results are not changed by it.
- **Check case (default demo bridge):** tangent 200 ft from POB 0+00 at N90E, then the spiral 0→800; profile +2.0 % from EL 100 at 0+00; crown 2 % at the PGL; no overlay; seat stack 8 + 1.5 + 0 + 36 + 3 = 48.5 in = 4.0417 ft. Abut 1 line is normal to the chord (chord bearing 106.0°, unit normal to the right (−0.2775, −0.9607)).
  - G4 (w = +18): point (−4.996, −17.293). Before the POB: f(POB) = −4.996 → station −0+04.996 on the start tangent, offset +17.293 ft right.
  - TD = 100 + 0.02 × (−4.996) − 0.02 × 17.293 = 100 − 0.0999 − 0.3459 = **99.554** (before 99.654, the point taken at 0+00 with offset 17.293). Seat = 99.554 − 4.0417 = **95.51** (before 95.61).
  - G3 (w = +6): sta −0+01.665, off +5.764: TD = 100 − 0.0333 − 0.1153 = 99.851, seat **95.81** (before 95.84).
  - Abut 2 (after the POE, end tangent, profile −0.8 % past 9+00): G3 seat 99.04 → **99.03**; G4 seat 98.81 → **98.77** (TD 102.854 → 102.814).
  - G1, G2 (inside the alignment) unchanged (95.71, 95.88 at Abut 1). Warning: "Deck points lie up to 6.66 ft before the POB … at Abut 1 brg" and "6.66 ft after the POE … at Abut 2 brg" (the deck edges at ±24 ft).
  - All eight Abut 1 / Abut 2 girder TD and seat values agree with the review's independent engine (scratchpad `bg/indep.mjs` + extended tangents) to 1e-4 ft.
- **How verified:** headless Chromium, origin/main vs branch (scratchpad probe): demo, the review's spiral-curve-spiral variant and the 5 built-in examples; text of the Top-of-Deck table, Beam Seat table and seat sections, Derived table, span summary, warnings, LL & DL hand-off payload (`producedAt` aside), Export JSON, Export DXF (local). Only the demo moves (the 4 Abut 1 / Abut 2 values above, the same values in the Top-of-Deck table row "Abut 1 CL" / "Abut 2 CL" and the DXF elevation labels, 12 DXF lines); the variant and Examples 1–5 identical (DXF: the time stamp line only). Hand-off payload identical (spans and skews do not depend on it). Spiral-first and curve-first alignments: `align.at(-50)` was the POB (spiral) / a point on the circle (curve); now (−50, 0) on the start tangent. 0 console errors. Tests: check-syntax, bgeo-examples, dxf-print-sheets --tool bg, home-projects --tool bgeo, tests/engine/run.mjs: pass. project-library --tool bgeo and list-input --part bgeo compare the page with origin/main and report exactly the intended differences (the demo's Abut 1 G3/G4 seats 95.84/95.61 → 95.81/95.51, the "Abut 1 CL" Top-of-Deck row, and the plan colour-scale minimum 99.54 → 99.41, the deck corner); nothing else.
- **Also affected (same rule, intended):** map picks, the plan hover and the N/E → station converter beyond the alignment ends now report the station on the extended tangent (was the POB / POE station).
- **Saved data:** none touched (§5). **Other copies:** none.

## 2026-11-07 — PR: claude/bg-h1-chord-warnings (PR #1109: https://github.com/mlococo88/All-Structural/pull/1109) (BGX2, review H1 quick fix + M1: geometry warnings; no result change)   [display only]

- **Why:** in-depth review 2026-11-07. H1: the whole bridge is one straight chord from the first to the last support; on a curved alignment the interior supports and the deck leave the roadway with no warning (default demo: Pier 1 reference line 106.63 ft from the PGL). M1: no warning when supports or deck points lie outside the alignment / profile, or when a pier is stationed past an abutment (it silently becomes the end support).
- **Where:** `geometryWarnings()` (added in BGX1, just before `function compute(){`): the deck-point loop also records the first / last deck station (`dMin`, `dMax`), and new blocks after the BGX1 POB/POE messages, anchors `// M1: supports outside the alignment`, `// M1: deck points outside the vertical profile`, `// H1: one straight chord`. Shown in the `#geom_warn` box (BGX1).
- **Before:** `geometryWarnings()` returned the BGX1 POB / POE messages only.
- **After (exact code added before `return w;`):**
```js
  // M1: supports outside the alignment; supports out of order (a pier at or beyond an end); two supports at one station
  su.forEach(u=>{
    if(u.sta<s0-0.005) w.push(`${u.name} (Sta ${formatStation(u.sta)}) is ${(s0-u.sta).toFixed(2)} ft before the POB (Sta ${formatStation(s0)}): it is placed on the start tangent extended.`);
    if(u.sta>s1+0.005) w.push(`${u.name} (Sta ${formatStation(u.sta)}) is ${(u.sta-s1).toFixed(2)} ft after the POE (Sta ${formatStation(s1)}): it is placed on the end tangent extended.`); });
  const uF=su[0], uL=su[su.length-1];
  [[uF,'first'],[uL,'last']].forEach(([u,k])=>{ if(u.type!=='abut') w.push(`${u.name} (Sta …) is the ${k} support by station, so the bridge ${k==='first'?'starts':'ends'} there (the chord, the deck end and the span numbering use it), not at an abutment. Check the support stations.`); });
  for(let i=1;i<su.length;i++) if(Math.abs(su[i].sta-su[i-1].sta)<0.005) w.push(`… are at the same station (…): the span between them has zero length.`);
  // M1: deck points outside the vertical profile (its elevations are the first / last grade extended)
  const pv=ENG.prof.pvis||[];
  if(pv.length>=2 && dMin && dMax){ const p0=pv[0], pn=pv[pv.length-1];
    if(dMin.sta<p0.sta-0.005) w.push(`Deck points lie up to … ft before the profile Start point (Sta …), at …: their elevations use the first grade (… %) extended. Extend the profile to cover the whole deck.`);
    if(dMax.sta>pn.sta+0.005) w.push(`Deck points lie up to … ft past the profile End point (Sta …), at …: their elevations use the last grade (… %) extended. Extend the profile to cover the whole deck.`); }
  // H1: … Tolerance: the smaller of 0.5 ft and 2 % of the deck width.
  if(ENG.chord && su.length>2){ const {a1,a2}=abutOffsets(), S1=uF.sta, S2=uL.sta; const out=[];
    su.slice(1,-1).forEach(u=>{ const sp=Math.max(1,Math.min(su.length-1,spanOfSta(u.sta))), ed=edgesForSpan(sp), tol=Math.min(0.5, 0.02*Math.abs(ed.r-ed.l));
      const f=(S2>S1)?(u.sta-S1)/(S2-S1):0, want=a1+(a2-a1)*f, got=ENG.bclOffAtSta(u.sta);
      if(isFinite(got) && Math.abs(got-want)>tol) out.push(`${u.name}: reference line ±x.xx ft from the PGL (±x.xx ft off the line between the end offsets; tolerance x.xx ft)`); });
    if(out.length) w.push(`The alignment curves within the bridge, but the girders, deck edges and supports are laid out on ONE straight chord from … to …, so the deck leaves the roadway at the interior supports: …. The elevations there are the cross slope extended to those offsets. Check against the plans (the girders are not chorded span by span).`); }
```
  (Message texts shortened here with "…"; the file has them in full.)
- **Governing provision:** none (display only; no formula, factor or result changed).
- **Check case (default demo bridge):** the box lists: deck points 6.66 ft before the POB and after the POE (BGX1); 6.66 ft before the profile Start (Sta 0+00, first grade +2.000 %); 106.66 ft past the profile End (Sta 9+00, last grade −0.800 %; Abut 2 is at 10+00); and "Pier 1: reference line +106.63 ft from the PGL (+106.63 ft off the line between the end offsets; tolerance 0.50 ft)". Review variant (R 1500): Pier 1 −10.41 ft, Pier 2 −10.63 ft. Example 3 (curved, chord reference line by design): Pier 1 +10.49 ft from the PGL, +6.49 ft off the line between the end offsets (+4.00 / +4.00 ft). Abut 1 moved to −1+50: "Abut 1 … is 150.00 ft before the POB". Pier 1 moved to 12+00 (past Abut 2 at 10+00): "Pier 1 … is 200.00 ft after the POE" and "Pier 1 … is the last support by station, so the bridge ends there …". Examples 1, 2, 4, 5: no warning.
- **How verified:** headless probe origin/main vs branch (demo, variant, Examples 1–5, the two M1 variants above): every table, the hand-off payload, Export JSON and DXF identical (DXF time stamp aside); only the warning box differs. 0 console errors. Tests: check-syntax, bgeo-examples, dxf-print-sheets --tool bg, project-library --tool bgeo, home-projects --tool bgeo, tests/engine/run.mjs handoffs lldf list-input: pass. list-input --part bgeo: the 2 differences are BGX1's demo seat values against its recorded base commit (not re-baselined: a result difference); nothing from this PR.
- **Decision (pending engineer review):** H1 tolerance = the smaller of 0.5 ft and 2 % of the deck width (the review's two suggestions; the smaller warns more). The deviation is measured against the straight-line interpolation of the end offsets, so a chord reference line that is intentionally off the PGL on a tangent does not warn.
- **Decision (pending engineer review):** no new tangent example. Examples 1 (single-span tangent) and 2 (3-span skewed overpass, tangent) already are tangent bridges; the demo (the New project) is left as it is because it is the review's check case; BGX3 (per-span chords for new projects) removes its H1 condition.
- **Saved data:** none (§5). **Other copies:** none.

## 2026-11-07 — PR: claude/bg-h1-per-span-chords (PR #1116: https://github.com/mlococo88/All-Structural/pull/1116) (BGX3, review H1 full fix, engineer item Q-BG4 / O5: girders chorded span by span; new projects only)   [calc change: new option] [saved data: additive field with migration]

- **Why:** review 2026-11-07 H1 and Q-BG4 (recommendation there: per-span chords). With one straight chord from Abut 1 to Abut 2, the interior supports and the deck leave the roadway on a curved alignment (demo: Pier 1 reference line 106.63 ft from the PGL).
- **Decision (pending engineer review):** girders, deck edges, curbs and the construction reference line are **chorded span by span**: straight within each span, between the reference points of its two supports. A reference point is the PGL point at the support station, offset by the abutment reference-line offsets interpolated by station. The lines kink at the piers on the bisector of the two chords (mitred). This is a new setting, **Girder layout in plan** (Bridge tab, `#girder_frame`, the empty cell next to Crown reference): "Per-span chords" / "One chord, Abut 1 to Abut 2".
  - New projects (the page with nothing saved; New) use per-span chords.
  - Projects saved without the setting (every existing save, Export JSON file and the 5 built-in examples) open with One chord, with their old results and the BGX2 warning. The user opts in by changing the setting.
- **Decision (pending engineer review):** at a pier, skew is measured from the bisector of the two span chords (the kink line). At an abutment it is measured from its span's chord normal. Dual bearing lines are parallel to their pier line, through their own reference point (PGL station ± offset, as before; M3 is a separate item). Curved girders are not modelled.
- **Where (anchors):**
  - `buildEngine()`: new block `/* ---- BGX3 (review H1, engineer item Q-BG4` (`FRAME_SET`, `PS`, `psSeg`, `psXY`, `psInv`, `psRef`).
  - Per-span branches (`if(PS)`) in: `bclOffAtSta`, `deckPointCW`, `beamSeatCW`, `chordExtent`, `chordOffsetAtXY`, `supportChordT`, `deckAtSupport`, `beamSeatAtSupport`. New `psSupT`, `cwTs`, `cwPath`.
  - `offsetChordLine` returns `cwPath(...)`.
  - Engine export: `frameInfo:()=>({frame,set,poly,len})`, `cwTs`, `cwPath`.
  - `bearingLinesFor`: each bearing line carries `supSta` (its support's station).
- **Before (one chord; still the code path for `'single'`):**
```js
  function deckPointCW(t,w){
    if(!CH) return getDeckPoint(align.staStart+t, w);
    const x = CH.P1.x + CH.ux*t + CH.nx*w;
    const y = CH.P1.y + CH.uy*t + CH.ny*w;
    return deckPointAtXY(x,y);
  }
  function deckAtSupport(bl, off){ … const w=off-bridgeCL(); const t=supportChordT(bl.sta)+w*Math.tan((bl.skew||0)*DEG); return deckPointCW(t,w); }
```
- **After (per-span):**
  - Reference points P_j, one per support.
  - Span i: chord L_i, unit u_i, right normal n_i = (u_y, −u_x), cumulative T_i.
  - Mitre m_j = (n_{j−1} + n_j)/(1 + n_{j−1}·n_j) at a pier, n at the ends.
  - Frame point: P(t, w) = P_i + λ(P_{i+1} − P_i) + w((1 − λ) m_i + λ m_{i+1}), with λ = (t − T_i)/L_i.
  - Elevation: as before, the point projected onto the PGL.
  - Deck ends: t0 = L_0·w·tanθ1/(L_0 + w·k_0), t1 = T_{n−1} + L(L + w·tanθ2 − w·k_n)/(L − w·k_n), with k = m·u at the first/last pier. With one span, k = 0 gives the one-chord formulas.
  - A bearing line is the straight line through its reference point with direction d = n_b + tanθ·u_b (n_b: bisector or chord normal). The girder point is where d crosses the girder's mitred offset polyline.
  - Code: `deckPointCW(t,w){ … if(PS){ const q=psXY(t,w); return deckPointAtXY(q.x,q.y); } …}` and `deckAtSupport(bl,off){ … if(PS){ const w=off-bridgeCL(); return deckPointCW(psSupT(bl,w),w); } …}`. The full code is in the file at the anchors above.
- **Drawings:** girder, edge and reference lines drawn from t0 to t1 now pass through the kinks (`cwPath` / `cwTs`). Changed in:
  - the on-screen plan (`planTransform`, `drawPlan`);
  - the heatmap reference line and column length (`ENG.frameInfo().len`);
  - the 3D girders, reference line and mesh;
  - the map (`girderLL`, `segLL`);
  - Export DXF `lineCW`;
  - the Drawings sheets `lineCW`.
  With one chord, `cwTs` returns the two ends, so these drawings are unchanged. The bearing-label spreading code (BGDL #902, BGDP #910, BGDE #914) is untouched.
- **Derived table:** with per-span chords it lists each span's chord length, its bearing and its angle to the PGL tangent, the total, and the angle change at each pier.
- **Hand-off (HANDOFF §4.2):** payload shape unchanged. Spans are still `supportChordT` differences, which with per-span chords are the span chord lengths. The two notes name the per-span datum. HANDOFF.md line on the notes updated. The receiver (lldf.html) is not changed.
- **Governing provision:** none (geometry; modelling decision Q-BG4).
- **Check case (default demo, per-span chords):**
  - Inputs: PGL points P0 (0, 0) at 0+00, P1 (497.023, −32.604) at 5+00, P2 (934.856, −270.087) at 10+00.
  - Chords: span 1 u = (0.99786, −0.06546), L = 498.092 ft; span 2 u = (0.87902, −0.47679), L = 498.092 ft. Pier 1 bisector normal (−0.27756, −0.96071), angle change 24.723°.
  - Pier 1 brg-back (Sta 4+97.50, skew 15°): reference point (494.471, −32.437). Girder G1 (w = −18) at (494.822, −14.421), which projects to the PGL at Sta 4+92.986, offset −16.889.
  - TD = 105 + 0.02(242.986) − 0.028(242.986²)/600 − 0.02(16.889) = 105 + 4.8597 − 2.7553 − 0.3378 = **106.767**. Seat = 106.767 − 4.0417 = **102.73**.
  - Before (one chord): TD 105.335, seat 101.29; the deck lay 106.6 ft off the roadway.
  - All 16 demo seats agree with an independent per-span model (scratchpad `bgfix/ps-indep.mjs`, built on the review's `bg/indep.mjs`) to 1e-4 ft.
  - Hand-off spans 486.544 / 486.544 → **498.092 / 498.092**.
  - The H1 warning disappears. The BGX1/BGX2 warnings remain, now with deck points 1.57 ft past the alignment ends.
  - Review variant set to per-span: spans 119.979 / 149.938 / 119.968 (one chord 120.063 / 148.886 / 120.014).
  - Example 5 (tangent) set to per-span: identical to one chord.
- **How verified:**
  - Headless probe, origin/main vs branch: demo, variant and Examples 1–5 as saved (One chord): every table, the hand-off payload and DXF identical; only Export JSON (the new `girder_frame:'single'`) and the H1 warning text ("…or set Girder layout in plan … to Per-span chords") differ. The demo with the setting at One chord is identical to main.
  - Screenshots of the heatmap, plan and Drawings sheets (kinked deck) were looked at. 0 console errors.
  - Tests:
    - pass: check-syntax, bgeo-examples, dxf-print-sheets --tool bg, home-projects --tool bgeo, tests/engine/run.mjs handoffs lldf list-input.
    - project-library --tool bgeo: "B opened on A's autosave" and "A's saved project opened from B's dialog" differ only in the Bridge tab text (the new setting's labels), so an old save gives identical results. "On load" and "after an input change" differ by the intended new-project default (per-span demo).
    - list-input --part bgeo: the same new-project default.
- **Saved data (§5):** new scalar `girder_frame` in `scalars` (additive). Migration: `applyProject` calls `bgOldDefaults()` (`BG_OLD_DEFAULTS = {girder_frame:'single'}`) before reading the saved scalars, so a save without the field keeps One chord. `freshDefaults()` calls `bgNewDefaults()` (`BG_NEW_DEFAULTS = {girder_frame:'span'}`), which are also the HTML defaults. No key changed.
- **Open item (pre-existing, not changed):** the heatmap leaves one column unfilled after each pier (it does not join columns of different spans); the same on main with one chord.
- **Other copies:** none.

## 2026-11-07 — PR: claude/bg-h4-skew-datum (PR #1119: https://github.com/mlococo88/All-Structural/pull/1119) (BGX4, review H4, engineer item Q-BG2 / O1: skew datum "alignment normal (plans)" or "chord normal"; new projects alignment normal)   [calc change: new option] [hand-off value for new projects] [saved data: additive field with migration]

- **Why:** review 2026-11-07 H4. Skew was always measured from the normal to the chord. Plans give skew from the survey baseline: MassDOT Bridge Manual Part I, survey section, defines skew between the bearing centerlines and the baseline (paraphrased), and AASHTO LRFD 10th Ed. Art. 4.2 defines the skew angle from a line normal to the roadway centerline. A plan skew entered as is was therefore off by the chord-to-alignment angle (review variant: 30° plan skew = 23.43° from the chord, 3.46 ft along the chord at the deck edge).
- **Decision (pending engineer review):**
  - New setting **Skew measured from** (Bridge tab, `#skew_datum`, just under the Substructure Units table): "alignment normal (as on the plans)" / "chord normal (the girders' line)".
  - New projects use the alignment normal. Projects saved without the setting (all existing saves, files and the 5 built-in examples) keep the chord normal and their results.
  - In both, the support line passes through the construction reference line point at the support station, as before.
- **Decision (pending engineer review):** the LL & DL hand-off sends the skew from the **chord normal** (the line the girders follow), converted from the entered value when the alignment normal is chosen. Basis: AASHTO LRFD 10th Ed. Art. 4.3 notation θ for Art. 4.6.2.2.1, measured from a line perpendicular to the span centerline (checked in the 10th Ed. PDF). The notes list the conversion per support. `skewDetail.bySupport` carries the same chord skews; with the chord datum they are the entered values, unchanged. The 10° rule of Art. 4.6.2.2.2e uses the converted signed values.
- **Where:**
  - `buildEngine()`: `SKEW_DATUM` (next to `FRAME_SET`), new `skewDelta(sta)` and `effSkew(bl)` (anchor `/* BGX4 (review H4`).
  - `effSkew` used in `SK1` / `SK2`, `deckAtSupport`, `beamSeatAtSupport` and `psSupT`; exported `effSkew`, `skewDelta`.
  - `buildDerived()`: rows "Skew from the chord normal" / "Skew from the alignment normal", with "(entered)" on the chosen one; `skewDatumUI()`.
  - `bgxBuildLldfGeom`: `skS`, `sk`, `skAdj`, the notes and `skewDetail.bySupport`.
  - The note under the Substructure Units table rewritten for both datums.
- **Before:** `const w=off-bridgeCL(); const t=supportChordT(bl.sta)+w*Math.tan((bl.skew||0)*DEG);` and `const SK1 = … (_su[0].skew||0)*DEG`; hand-off `const sk=su.map(u=>Math.abs(+u.skew||0));`, `skAdj` from `u.skew`, `bySupport … skew:r2(+u.skew||0)`.
- **After:**
  - `const t=supportChordT(bl.sta)+w*Math.tan(effSkew(bl)*DEG);` and `SK1 = effSkew({skew:_su[0].skew, supSta:_su[0].sta})*DEG`.
  - `effSkew(bl) = bl.skew + δ` (alignment datum) or `bl.skew` (chord datum).
  - δ = atan2(n_a·u_d, n_a·n_d): n_a is the PGL right normal at the support station; n_d / u_d are the chord normal and chord direction (per-span: the bisector at a pier, the span chord at an abutment).
  - Hand-off: `skS = effSkew(...)`, `sk = |skS|`, `skAdj` from `skS`, `bySupport skew: r2(skS[i])`.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 4.2 (skew angle definition), Art. 4.3 notation θ (4.6.2.2.1), Art. 4.6.2.2.2e (10° rule, unchanged); MassDOT Bridge Manual Part I survey requirements (skew between bearing CL and baseline).
- **Check case (default demo, per-span, alignment normal):**
  - Abut 1 skew 0°. The line is the PGL normal at 0+00 (x = 0); the span 1 chord bearing is 93.753°, so δ = +3.75° (the Derived table shows chord-normal skew 3.75°, alignment-normal 0.00°).
  - G4 (w = +18): girder line P0 + 18·n1 + λ·u1 with n1 = (−0.06546, −0.99786), u1 = (0.99786, −0.06546). It meets x = 0 at λ = 1.17830/0.99786 = 1.18082, y = −17.9615 − 0.0773 = −18.039, i.e. Sta 0+00, offset 18.039.
  - TD = 100 − 0.02 × 18.039 = **99.639**; seat = 99.639 − 4.0417 = **95.60**.
  - Before (chord normal, per-span): 95.58 (TD 99.617). G1 is symmetric: 95.60 (before 95.62). Abut 2: 98.80 / 99.04 / 99.04 / 98.80.
  - The BGX1 warning goes away (no deck point is before the POB).
  - Hand-off: chord skews 3.75 / 15.00 / −3.75. Moment skew 0 (adjacent supports differ by 11.25° > 10°), shear 15.00; the same values were sent before (0 / 15).
- **Check case (review variant, R 1500, plan skew 30° at every support, one chord):** chord skew at Abut 1 = 30 − 6.575 = **23.43°** (sent to LL & DL as θ; before: 30). Abut 1 seats G1…G4 106.84 / 107.35 / 107.86 / 108.41 → 106.89 / 107.37 / 107.85 / 108.35.
- **How verified:** headless probe, origin/main vs branch:
  - Demo set to chord normal: identical to main.
  - Variant and Examples 1–5 as saved: every table, the hand-off payload and DXF identical; only the Derived table (2 skew rows) and Export JSON (`skew_datum:'chord'`) differ.
  - 0 console errors.
  - Tests:
    - pass: check-syntax, bgeo-examples, dxf-print-sheets --tool bg, home-projects --tool bgeo, tests/engine/run.mjs handoffs lldf list-input.
    - project-library --tool bgeo: old autosave and old saved project differ only in the Bridge tab text (the Derived table rows and the new setting), so their results are identical. "On load" differs by the new-project default.
- **Saved data (§5):** additive scalar `skew_datum`. Migration: `BG_OLD_DEFAULTS.skew_datum='chord'` (applied before the saved scalars); `BG_NEW_DEFAULTS.skew_datum='align'`. No key changed. Hand-off payload shape unchanged (HANDOFF §4.2); the receiver is not changed.
- **Other copies:** none.

## 2026-11-07 — PR: claude/bg-h5-seat-stack (PR #1122: https://github.com/mlococo88/All-Structural/pull/1122) (BGX5, review H5 + M6, engineer item Q-BG3 / O3: optional seat terms, net camber, midspan haunch check, worked seat derivation)   [calc change: new option] [saved data: additive fields with migration]

- **Why:** review 2026-11-07 H5. The seat stack had no vertical-curve ordinate and no cross slope × b_f/2. Camber was undefined (gross or net). Nothing checked the minimum haunch along the span. Review sag case: −2 % / +2 %, VC 400 centred on a 100 ft span, min haunch 1.5 in, camber 0. The midspan haunch was 0 in, and the low flange edge was a further 0.48 in short at 6 % with b_f = 16 in. M6: the seat sections showed values only (§6, show the work).
- **Owner practice (read in the manuals, paraphrased):**
  - MassDOT Bridge Manual Part I (Hundredth Anniversary Ed.) 3.5.6.3: prestressed beam cambers are considered with the profile's vertical curvature when seat elevations are calculated, so the roadway matches the profile and the deck is not thinned by a negative haunch.
  - CTDOT BDM (02/24) 7.2.11.1 item 5: a member within a crest vertical curve gets the ordinate as camber; on a sag curve the ordinate goes in the haunch, not the camber table.
  - CTDOT 8.1.2.4: minimum haunch measured from the top of the top flange to the bottom of the slab; a deeper haunch may be needed where the flange is wider than 1.33 ft because of the cross slope.
  - RIDOT BDM (2026) 9.4.6: a 2 in minimum nominal haunch at the girder centerline; deeper when the top flange is wider than 16 in on a cross slope; cross slope, profile, camber and seat all considered.
- **Decision (pending engineer review):**
  - A new option **Seat terms: sag ordinate + cross slope × b_f/2** (checkbox `#seat_terms`) and **Top flange width b_f** (`#d_bf`, in, global, 0 = not used), on the Bridge tab under the depth inputs. New projects: on, b_f 0 (the cross-slope term starts when b_f is entered). Projects saved without them (all existing saves, files, the 5 examples): off. Their seats are unchanged, and the working and the haunch check are shown with a note.
  - **m_sag** = (TD_A + TD_B)/2 − TD_mid, measured along each girder on the deck surface between its two bearings. This includes the vertical-curve ordinate and also any warp from cross slope / superelevation change or from the chord's offset on a curve. A sag (> 0) is added to the haunch at the bearings. A crest (< 0) is not used (CTDOT: crest ordinates go in the camber) and is reported. A single bearing line at a pier takes the larger sag of its two spans; a back / ahead line takes its own span.
  - **Δ_cs** = TD(w) − min(TD(w − b_f/2), TD(w + b_f/2)), the fall of the deck across the top flange at the bearing (a crown inside the flange counts the steeper side). The minimum haunch is then kept at the low flange edge. This is CTDOT's measure from the top of flange, and is conservative against RIDOT's centerline nominal.
  - **Camber** is the **net camber at deck placement** (camber − dead-load deflection of the deck and haunch): label "Net camber (default)" and its tooltip, the panel note and the seat tab note. The value is used as before.
  - **Midspan haunch check** (always shown): the girder is taken straight between its two seats, rising by the net camber at midspan. Haunch CL = TD_mid − t_s − TOG_mid, with TOG_mid = (TOG_A + TOG_B)/2 + c and TOG = seat + bearing + beam depth. Haunch at the low edge = haunch CL − Δ_cs(mid). OK when the edge haunch ≥ h_min.
- **Where (anchors):**
  - `buildEngine()`: block `/* BGX5 (review H5` (`SEAT_TERMS`, `BF`, `supT`, `spanBrgs`, `girderSag`, `crossDrop`, `brgSpans`) and the rewritten `beamSeatAtSupport` (returns `parts`). `beamSeatAtXY` also returns `drop`. Exports `girderSag`, `crossDrop`, `spanBrgs`, `supT`, `seatTerms`.
  - `bearingLinesFor`: `role:'back'|'ahead'|'cl'`.
  - `seatData()`: `parts`. `buildSeatTable()`: each seat cell's tooltip is its working.
  - New `seatWorkText()` and `buildSeatWork()` (called from `compute()` after `buildSeatTable()`), drawing into the new `#seat_work_wrap` under the seat table (heading "Seat working · midspan haunch check").
  - `buildSeatSections()`: the working of each girder under every bearing-line section, with a link to the table.
- **Before:**
```js
  function beamSeatAtSupport(bl, off, ctx){
    if(!CH) return getBeamSeat(staOnBearing(bl.sta,bl.skew,off), off, ctx);
    if(PS){ const w=off-bridgeCL(); return beamSeatCW(psSupT(bl,w),w,ctx); }
    const w=off-bridgeCL(); const t=supportChordT(bl.sta)+w*Math.tan(effSkew(bl)*DEG);   // BGX4: effSkew
    return beamSeatCW(t,w,ctx);
  }
```
- **After:**
```js
  function beamSeatAtSupport(bl, off, ctx){
    if(!CH) return getBeamSeat(staOnBearing(bl.sta,bl.skew,off), off, ctx);
    const w=off-bridgeCL(), t=supT(bl,w);
    const base=beamSeatCW(t,w,ctx);
    … P = { td, slab, hmin, camber, beam, bearing, sag, sagSpan, sagRaw, cross:crossDrop(t,w), on:SEAT_TERMS } …
    P.sag=Math.max(0, P.sagRaw||0);
    const extra=SEAT_TERMS ? (P.sag+P.cross) : 0;
    return { ...base, z:base.z-extra, parts:P };
  }
```
  (`supT(bl,w)` is exactly the old t: `psSupT(bl,w)` with per-span chords, else `supportChordT(bl.sta)+w*tan(effSkew)`.)
- **Governing provision:** owner practice as above (no AASHTO formula changes). Seat formula: seat = TD − t_s − (h_min + c + m_sag + Δ_cs) − d − t_brg; with the option off, m_sag = Δ_cs = 0 (as before).
- **Check case (review sag case):**
  - Inputs: tangent; profile 0+00 EL 100 → PVI 5+00 EL 90, VC 400 → 10+00 EL 100; abutments at 4+50 and 5+50 (100 ft span); girders ±6 ft; super +6 %; t_s 8, h_min 1.5, c 0, d 36, t_brg 3 in; b_f 16 in.
  - TD at 4+50, G1: BVC 3+00 EL 94.00, x = 150: 94 − 0.02(150) + 0.04(150²)/800 = 92.125; at −6 ft: 92.125 − 0.36 = **91.765**.
  - m_sag = (91.765 + 91.765)/2 − 91.640 = **0.125 ft** (= (A/2L)(L_s/2)² = (0.04/800)(50²)). Δ_cs = 0.06 × 8/12 = **0.040 ft**.
  - Seat: before 91.765 − 0.667 − 0.125 − 3.000 − 0.250 = **87.723**; after 91.765 − 0.667 − (0.125 + 0 + 0.125 + 0.040) − 3.000 − 0.250 = **87.558** (−0.165 ft).
  - Midspan check: before: haunch CL 0.00 in, edge 0.00 in → "LOW by 1.50 in". After: CL 1.98 in, Δ_cs 0.48 in, edge **1.50 in → OK**.
- **Default demo (new project) after:**
  - Span 1 is on the crest VC (m = −13 to −20 in, not used). Span 2: m = +0.37 / +3.33 / +3.41 in for G2–G4 (the chord's offset on the curve with the crown). So Pier 1 brg-ahead G2–G4 102.92 / 102.89 / 102.61 → **102.89 / 102.61 / 102.33**, and Abut 2 G2–G4 99.04 / 99.04 / 98.80 → **99.01 / 98.76 / 98.51**.
  - All midspan checks OK.
- **How verified:**
  - Headless probe origin/main vs branch: variant and Examples 1–5 as saved (option off): every seat, table, DXF and hand-off payload identical. Only the seat-section text (the working lines) and Export JSON (`seat_terms:false, d_bf:'0'`) differ. Demo: the seats above; DXF 6 lines (those seat labels).
  - The sag case above, with the option on and off. 0 console errors. Screenshot of the Beam Seat tab looked at.
  - Tests:
    - pass: check-syntax, bgeo-examples, dxf-print-sheets --tool bg, home-projects --tool bgeo, tests/engine/run.mjs handoffs lldf list-input.
    - project-library --tool bgeo: old saves differ only in the Seat and Bridge tab text (notes, working); their seat values are identical.
- **Not changed:** the "beam seat" surface of the Top-of-Deck grid rows (`beamSeatCW` at grid stations; not at bearings) has no seat terms. Per-beam b_f is not supported (global only).
- **Saved data (§5):** additive scalars `seat_terms`, `d_bf`. Migration: `BG_OLD_DEFAULTS` `{seat_terms:false, d_bf:'0'}`; `BG_NEW_DEFAULTS` `{seat_terms:true, d_bf:'0'}`. No key changed.
- **Other copies:** none.

## 2026-11-07 — PR: claude/bg-h3-super-table (PR #1126: https://github.com/mlococo88/All-Structural/pull/1126) (BGX6, review H3, engineer item O2 / BG-O2: optional superelevation transition table)   [calc change: new option, default = existing behaviour] [saved data: additive field]

- **Why:** review 2026-11-07, H3. Cross-slope controls can only sit at substructure stations, and each side's slope is interpolated linearly between them, so a transition cannot be tied to the TS/SC stations or follow the Green Book method. Green Book method (*A Policy on Geometric Design*, 7th Ed. 2018, Sec. 3.3.8; not in the references folder, **verify**): the outside lane rotates first, the inside lane stays at normal crown until reverse crown, and full super is reached at the SC.
- **Decision (pending engineer review):**
  - New optional **Superelevation transition table** on the Bridge tab, in the cross-slope fieldset: rows of station, left %, right %. Slopes are entered **outward from the crown** (− = falls away), the usual way super diagrams are given. Normal crown 2 % = −2 / −2; full 6 % banked to the right = +6 / −6.
  - When the table has a complete row, it replaces the global mode / rate and the per-support controls. Each side is interpolated linearly in station between rows and held beyond the first / last row. The deck rotates about the crown line (as before).
  - Green Book transitions are entered as their own stations (normal crown, level crown, reverse crown, full super).
  - Empty table (every saved project and every new one): exactly the existing behaviour.
  - Under the table: the relative gradient of each deck edge to the PGL between rows, as 1:x, to compare with Green Book Table 3-15 (verify). No limit is applied.
- **Where (anchors):**
  - HTML: block `<!-- BGX6 (2026-11-07): optional superelevation transition table` before the cross-slope fieldset's `</fieldset>` (`#xs_tbl`, `#xs_add`, `#xs_info`).
  - State and UI: `let XSLOPES = [];`, `xsRows()`, `renderXsTable()`, `renderXsInfo()` (after `let HVALPTS = [];`), and the `#xs_add` listener before the `ovr_toggle` listener.
  - Engine: `buildCrossSection(globalMode, globalRate, controls, pgl, crown, table)`, which adds `tableAt()`; `slopesAt` returns `tableAt(s)` when the table has rows. `buildEngine` passes `xsRows()`.
  - `serializeProject` writes `XSLOPES`; `applyProject` reads it (absent = []). `freshDefaults` empties it. `compute` calls `renderXsInfo()`.
- **Before:** `function slopesAt(s){ if(cps.length===0) return sidesOf(globalMode, globalRate); …`
- **After:** `function slopesAt(s){ if(xt.length) return tableAt(s); if(cps.length===0) return sidesOf(globalMode, globalRate); …` with `tableAt` converting outward % to the engine's dz per ft (+ = rising to the right): L = −left/100, R = +right/100.
- **Governing provision:** AASHTO Green Book 7th Ed. Sec. 3.3.8 and Table 3-15 (verify; not in the references). No design-code formula.
- **Check case (the review's):**
  - Inputs: tangent, flat profile EL 100, span 1+00 → 2+00, deck edges ±24 ft about the PGL, no overlay. Crown 2 % at Abut 1 → super 6 % banked right at Abut 2 (per-support controls).
  - Inside (right) edge dz at 1+25 / 1+50 / 1+75:
    - before (per-side linear): −0.72 / −0.96 / −1.20 ft;
    - after, with the table 1+00 (−2, −2), 1+50 (+2, −2), 2+00 (+6, −6): **−0.48 / −0.48 / −0.96 ft** (right slope −2, −2, −4 % × 24 ft).
  - Outside (left) edge identical: 0.00 / +0.48 / +0.96 ft.
  - Relative gradient shown: left edge 1:52 in both intervals, right edge 0 then 1:52.
- **How verified:**
  - Headless probe origin/main vs branch: demo, variant and Examples 1–5 identical in every table, the hand-off payload and DXF. Export JSON gains `XSLOPES: []`.
  - The check case above, and its round trip through Export JSON (the rows come back as entered). 0 console errors.
  - Tests:
    - pass: check-syntax, bgeo-examples, dxf-print-sheets --tool bg, home-projects --tool bgeo, tests/engine/run.mjs handoffs lldf list-input.
    - project-library --tool bgeo: the only difference is the Bridge tab text (the new table's note), so the results are identical.
- **Saved data (§5):** additive top-level `XSLOPES` (array of {staStr, L, R}); absent = empty = old behaviour. No key changed.
- **Other copies:** none.

## 2026-11-07 — PR: claude/bg-m2-curve-elements (PR #1128: https://github.com/mlococo88/All-Structural/pull/1128) (BGX7, review M2 / O4 part: curve and spiral element report; report only, no result change)   [display only]

- **Why:** review 2026-11-07 M2. The plan curve data could be checked only through the end stations and bearings. Curve elements (T, E, M, LC, PI, D) and spiral elements (θs, Xs, Ys, p, k, LT, ST) were not shown.
- **Where:**
  - New collapsible block `<details id="elem_rep_box">` under `#elem_warn` (Alignment tab, Horizontal Alignment Data).
  - New `buildElemReport()` after `function elemType(i)`, called in `compute()` after `showGeomWarnings(...)`.
  - Nothing else reads it.
- **Formulas (shown in the code comment):**
  - Circular curve: Δ = L/R; T = R tan(Δ/2); E = R(sec(Δ/2) − 1); M = R(1 − cos(Δ/2)); LC = 2R sin(Δ/2); PI = PC + T·(PC tangent); D_arc(100 ft) = 18000/(πR); D_chord(100 ft) = 2 asin(50/R).
  - Spiral to or from a tangent: θs = Ls/(2Rc). Xs, Ys = the engine's far-end point in the frame of the tangent end. p = Ys − Rc(1 − cos θs); k = Xs − Rc sin θs; LT = Xs − Ys/tan θs; ST = Ys/sin θs.
  - Symmetric spiral–curve–spiral: total Δ; Ts = (R + p) tan(Δ/2) + k; Es = (R + p) sec(Δ/2) − R.
  - A compound spiral (both radii non-zero) shows its length, radii and change of bearing only.
- **Governing provision:** none (route surveying; standard formulas). Station equations (rest of O4) are not added.
- **Check case (default demo):**
  - Spiral in: θs = 150/1600 = 0.09375 rad = 5°22'17.33". Xs 149.868 and Ys 4.685 (the review's series values: 149.8682 and 4.6846). p = 4.685 − 800(1 − cos θs) = 1.172; k = 149.868 − 800 sin θs = 74.978; LT 100.046; ST 50.042.
  - Curve: R 800, L 300, Δ = 0.375 rad = 21°29'09.30"; T 151.783; E 14.271; M 14.021; LC 298.245 (the F1 chord); D_arc 7°09'43.10"; PI (N −18.893, E 500.985).
  - Group: total Δ = 0.5625 rad = 32°13'43.95"; Ts = 801.172 tan(16.114°) + 74.978 = 306.443; Es 33.938.
- **How verified:**
  - Headless probe origin/main vs branch (demo, variant, Examples 1–5): every table, the hand-off payload, Export JSON and DXF identical. 0 console errors.
  - Tests:
    - pass: check-syntax, bgeo-examples, dxf-print-sheets --tool bg, project-library --tool bgeo, home-projects --tool bgeo, tests/engine/run.mjs handoffs lldf list-input.
    - list-input --part bgeo: unchanged from main, failing only against its recorded base commit for the earlier BGX1/BGX3 results.
- **Saved data:** none. **Other copies:** none.

## 2026-11-07 — PR: claude/bg-m3-bearing-offsets (PR #1131: https://github.com/mlococo88/All-Structural/pull/1131) (BGX8, review M3: dual bearing offsets measured along the girders; new projects only)   [calc change: new option] [saved data: additive field with migration]

- **Why:** review 2026-11-07, M3. A dual-bearing pier's offset was applied in PGL stationing and then mapped onto the chord. Off the PGL on a curve it scaled by about (R ± offset)/R: in the demo the 2.5 ft offsets became 2.167 ft along the girders (bearing lines 4.33 ft apart instead of 5.0).
- **Decision (pending engineer review):**
  - New setting **Dual bearing offset measured**: "along the girders (reference line)" / "along the PGL stationing", next to Skew measured from (Bridge tab, `#brg_off_mode`).
  - New projects measure along the girders. Saved projects without the setting keep the PGL stationing and their results.
  - Along the girders, each bearing line is the given distance from the pier line, measured along the construction reference line (per-span chords: along the polyline). It is parallel to the pier line (BGX3 / BGX4 already orient a dual bearing line by its pier).
  - The distance is along the girders, not normal to the pier line. On a skew, the normal distance is offset × cos θ.
- **Where:** new `brgOffMode()` and `staAtChordT(tt, guess)` (secant on `ENG.supportChordT`) just before `function bearingLinesFor(u)`, which now solves the PGL station of each bearing line's reference point so that its chord t is t_pier ∓ offset. HTML select after `#skew_datum`; the Substructure note's last sentence was reworded.
- **Before:**
```js
  if(u.type==='pier' && u.bearMode==='double')
    return [ {label:`${u.name} brg-back`, sta:u.sta-u.bearOffset, …}, {label:`${u.name} brg-ahead`, sta:u.sta+u.bearOffset, …} ];
```
- **After:**
```js
  if(u.type==='pier' && u.bearMode==='double'){
    let sb=u.sta-u.bearOffset, sa=u.sta+u.bearOffset;
    if(brgOffMode()==='chord' && ENG && ENG.chord && u.bearOffset){ const t0=ENG.supportChordT(u.sta); sb=staAtChordT(t0-u.bearOffset, sb); sa=staAtChordT(t0+u.bearOffset, sa); }
    return [ {label:`${u.name} brg-back`, sta:sb, …}, {label:`${u.name} brg-ahead`, sta:sa, …} ]; }
```
- **Governing provision:** none (geometry; dimensioning convention).
- **Check case (demo, one chord):**
  - Before: bearing lines at Sta 4+97.50 / 5+02.50, Δt along the chord −2.1668 / +2.1668 ft.
  - After (along the girders): Sta **4+97.12 / 5+02.88**, Δt **−2.500 / +2.500 ft**.
  - Seats at 0.01 ft are unchanged here (the grade at the pier is about −0.3 %, so 0.33 ft moves the seat by 0.001 ft). The bearing stations, the DXF and the plan move.
- **Check case (demo, per-span chords; the new-project default):** Sta 4+97.50 / 5+02.50 (Δt ∓2.5576) → 4+97.56 / 5+02.44 (Δt ∓2.500). Seats unchanged at 0.01 ft.
- **How verified:**
  - Headless probe origin/main vs branch:
    - Variant and Examples 1–5 as saved: every table, the hand-off payload and DXF identical; Export JSON gains `brg_off_mode:'pgl'`.
    - Demo (new project): the bearing stations above, the Top-of-Deck rows at the bearing lines, and the DXF (178 lines: bearing positions and labels).
  - 0 console errors.
  - Tests:
    - pass: check-syntax, bgeo-examples, dxf-print-sheets --tool bg, home-projects --tool bgeo, tests/engine/run.mjs handoffs lldf list-input.
    - project-library --tool bgeo: old saves differ only in the Bridge tab text (the new setting), so their results are identical. "On load" differs by the new-project default (the bearing-line rows).
- **Saved data (§5):** additive scalar `brg_off_mode`. Migration: `BG_OLD_DEFAULTS.brg_off_mode='pgl'`; `BG_NEW_DEFAULTS.brg_off_mode='chord'`. No key changed.
- **Other copies:** none.

## 2026-11-07 — PR: claude/bg-m4-m5-girder-tables (PR #1133: https://github.com/mlococo88/All-Structural/pull/1133) (BGX9, review M4 + M5: grid rows explained and off-deck points marked; span lengths named; girder lengths and tenth points)   [display only; no result change]

- **Why:** review 2026-11-07.
  - M4: Top-of-Deck grid rows named "Abut 1 CL" / "Pier n CL" are square to the reference line, not on the skewed support. At skewed ends some grid points lie outside the deck.
  - M5: two different "span lengths" were printed (PGL station differences in the span summary, heatmap and sheets; chord lengths for the girders and the LL & DL hand-off), and neither was labelled. There were no tenth points along each girder and no girder lengths.
- **Decision (pending engineer review):**
  - The grid rows keep their values and names.
  - A note under the table says what the rows are, and points to Rows = bearing lines / the Beam Seat tab for values on the skewed support.
  - Points beyond the skewed deck end are shown in grey italics with a tooltip. The cell value is unchanged, so the CSV is unchanged.
  - Top-of-form / screed elevations with dead-load deflections are **not** added: the tool has no deflection input. The tenth-point table says so.
- **Where (anchors):**
  - `buildTable()` (grid mode): `TDo` (anchor `/* BGX9 (review M4)`) for edges, curbs and girders, and the footnote.
  - `buildSpanSummary()`: anchor `/* BGX9 (review M5)`.
  - Heatmap span label: anchor `// BGX9 (M5): both lengths, named`.
  - Drawings sheet "SUPPORTS AND BEARING LINES": span rows and the note, which now also names the skew datum chosen in BGX4, BGX3.
  - New `buildGirderTenths()` (before `function buildSeatWork(){`) and the block `<details id="gird10_box">` under `#tbl_wrap`; called in `compute()` after `buildSeatWork()`.
  - Engine `girderSag`: `len` is now the plan length between the girder's two bearing points (it was |tB − tA|, which is the same value with one chord). It is used only in displays.
- **Before / after (span summary):**
  - Before: columns Span · From · To · Length (= the PGL station difference).
  - After: Span · From · To · **Length, PGL stations (ft)** · **Along ref line (ft)** (supportChordT difference, the girders' span as sent to LL & DL) · **Girder brg–brg (ft)** (shortest – longest girder).
  - Heatmap label "Span 1: 500.00 ft" → "Span 1: 500.00 ft (PGL) · 498.09 ft (ref line)".
  - Sheet: "LENGTH (FT)" → "LENGTH, PGL STA (FT)" and "ALONG REF LINE (FT)".
- **Governing provision:** none (display). CTDOT BDM (02/24) 8.3.2 (deck elevations at bearings and tenth points, for the haunch) is cited in the tenth-point note.
- **Check case:**
  - Review variant (one chord): span summary 120.00 / 150.00 / 120.00 (PGL) and 120.06 / 148.89 / 120.01 (ref line = the LL & DL spans). Girder brg–brg 117.58 / 143.92 / 117.53 (ref line less the 2.5 ft dual-bearing offsets).
  - The variant's grid rows "Abut 1 CL" G3, G4 / Curb R / Edge R and "Abut 2 CL" Edge L … G2 are marked beyond the deck end (skew 30°).
  - Demo (new project, per-span): spans 500.00 (PGL) / 498.09 (ref line); girder G1, span 1: 495.94 ft, TD at 0.0 … 1.0 = 99.639 … 106.766 (the Abut 1 and Pier 1 brg-back TD of the seat working).
- **How verified:**
  - Headless probe origin/main vs branch (demo, variant, Examples 1–5): every seat, hand-off payload, Export JSON and DXF identical. The Top-of-Deck text differs only by the added note; the span summary and the girder table are new. 0 console errors.
  - Tests:
    - pass: check-syntax, bgeo-examples, dxf-print-sheets --tool bg, home-projects --tool bgeo, tests/engine/run.mjs handoffs lldf list-input.
    - project-library --tool bgeo: text-only differences (the note, the span summary columns, the haunch-check L column).
- **Saved data:** none. **Other copies:** none.

## 2026-11-07 — PR: claude/bg-review-low-items (PR #1135: https://github.com/mlococo88/All-Structural/pull/1135) (BGX10, review LOW items L1, L2, L5, L6: precision option, State Plane / scale-factor note, phone layout, comment fixes)   [display; one load fix] [saved data: additive field]

- **L1, precision:** new select **Elevations to** 0.01 ft / 0.001 ft (`#out_dec`), in the Top of Deck Output controls (the empty third cell after Divisions).
  - It sets the decimals of the elevations in the Top-of-Deck table (both modes) and the Beam-Seat table, so also their CSV files and the Drawings-tab tables copied from them. Display only.
  - Default 0.01 ft (as before) for saved and new projects (`BG_OLD_DEFAULTS` / `BG_NEW_DEFAULTS` `out_dec:'2'`).
  - Code: `outDec()` (before `skewDatumUI`); `buildTable` uses `const DEC=outDec();` with `.toFixed(DEC)` in its elevation cells (was `.toFixed(2)`); `buildSeatTable` uses `s.seatZ.toFixed(outDec())`.
  - Check: demo at 0.001 ft, Abut 1 seats 95.598 / 95.838 / 95.838 / 95.598 (0.01 ft: 95.60 / 95.84 / 95.84 / 95.60).
- **L2, State Plane:**
  - The Export DXF basis notes gain one line (State Plane only): the alignment is laid out at ground distance from the POB, no combined scale factor is applied, and the coordinates differ from grid by (1 − CSF) × the distance; apply the project CSF in CAD if the plans are on grid.
  - The Site Map intro note says the same, and that NAD 83 is taken as WGS 84 for the map (about 1–1.5 m).
  - No coordinate changed (Q-BG5, a CSF input, stays open).
- **L5, phone layout:**
  - Before: the page scrolled sideways at 390 px (1,086 px wide on the Alignment tab, 666 px elsewhere) and at 768 px.
  - CSS added after the `@media (max-width: 1020px){ .cols … }` rule. At ≤ 1020 px: the tab strip scrolls inside itself; fieldsets may shrink below their content (`min-width:0`); the Site Map's survey-point table is a containing block for its hidden screen-reader label. At ≤ 700 px: inline 4-column field grids become 2 columns.
  - The section "Cut / Surface" row wraps (`flex-wrap:wrap`).
  - On a tab switch, the visible pane's Plotly plots are resized (`Plotly.Plots.resize`). A plot drawn while hidden kept Plotly's default 700 px width.
  - Desktop (> 1020 px) is unchanged.
  - Bridge Geometry is added to `tests/smoke/phone-layout.mjs` (`bgeo`): 390 and 768 px pass, every tab. The 12 console errors are the Site Map tiles, which the test kit blocks.
- **L6, comments and one load fix:**
  - `deckPointCW` comment: "+left" → "+right of the chord direction, as in the tables" (the code was right).
  - `x_pivot` is marked as not used (kept for old saves).
  - `applyProject`: a file without `VALPTS` now opens with no validation points. Before (`if(p.VALPTS){…}`) it kept the previous project's list. Saved projects always carry `VALPTS`, so they are unaffected.
- **Not changed:**
  - L3: spiral node interpolation, up to 5e-3 ft at R 100 / L 400. The start-spiral part was fixed in BGX1.
  - L4: overlapping vertical curves warn only; making it an error could block existing saves. Left for the engineer.
  - L7: open decisions.
- **Governing provision:** none (§4 does not apply: no formula or value changed).
- **How verified:**
  - Headless probe origin/main vs branch (demo, variant, Examples 1–5): every table, the hand-off payload and DXF identical (the time stamp aside); Export JSON gains `out_dec:'2'`.
  - 0.001 ft display checked. phone-layout --tool bgeo: pass at 390 and 768 px (main: 1,086 / 1,086 px wide).
  - Tests:
    - pass: check-syntax, bgeo-examples, dxf-print-sheets --tool bg, home-projects --tool bgeo, tests/engine/run.mjs handoffs lldf list-input.
    - project-library --tool bgeo: text-only difference (the new select).
- **Saved data (§5):** additive scalar `out_dec` (absent = '2', as before). No key changed.
- **Other copies:** none. `tests/smoke/phone-layout.mjs` gains the `bgeo` entry.

## 2026-11-08 — PR: nl-bgeo-a1 (PR #1197: https://github.com/mlococo88/All-Structural/pull/1197) (BGNL-1: long notes as a bold lead and a list — Alignment and Bridge tabs; display only, no result change)   [display only]

### BGNL-1. Long notes split into a lead line and a list (Alignment, Bridge)   [display only] [no result change]
- **Request (engineer, 2026-11-08, for all tools):** "There are some sections that just have this block of text. Can we split this up into a numbered list or bullets or some other way so it's not just a text that will likely get overlooked because it's too long." Part 1 of 2 (Alignment and Bridge tabs); the output tabs, Site Map, Drawings and the dialogs follow in BGNL-2. Pattern as Spread Footing SFNL (#1167).
- **Rule used:** a note is long if it is over ~300 characters, has 3 or more sentences, or carries several facts in one paragraph. It becomes a one-line bold lead, then a list with bold lead words. Every sentence, number, citation and link is kept, in the same order; only the lead words, list-start capitals and end punctuation are new. New lead words carry no digits, so the digit sequence of every tab is unchanged.
- **New helpers** (after `const DEG = Math.PI/180;`), anchor `/* BGNL (2026-11-08, engineer`:
  ```js
  function bgNL(lead,items,o){ o=o||{}; const L=o.ol?'ol':'ul';
    const li=(items||[]).filter(Boolean).map(x=>'<li>'+(Array.isArray(x)?'<b class="bgNLk">'+x[0]+'</b> '+x[1]:x)+'</li>').join('');
    return (o.act||[]).filter(Boolean).map(a=>'<div class="bgNLa">'+a+'</div>').join('')+(lead?'<div class="bgNLl">'+lead+'</div>':'')+(li?'<'+L+' class="bgNLu">'+li+'</'+L+'>':''); }
  function bgNLWarn(box,list){ list=list||[]; if(list.length<2){ box.textContent=list.join(''); return; }
    box.innerHTML='<ul class="bgNLu">'+list.map(t=>'<li>'+String(t).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))+'</li>').join('')+'</ul>'; }
  ```
  A note becomes `<div class="note bgNL">` + `bgNL(lead,[[leadWords,text],…])` (a `<p>` cannot hold a list, so static notes change from `<p class="note">` to `<div class="note bgNL">` with the same inline style).
- **CSS** (after `.note { … }`), tool-scoped, no new colours (the lead uses `--ink`, the action line `--oxide`, the tool's warning colour); print keeps a list item on one page:
  ```css
  .bgNL .bgNLl { font-weight:600; color:var(--ink); margin:0 0 1px; }
  .bgNL .bgNLu { margin:2px 0 3px; padding-left:18px; }
  .bgNL .bgNLu > li { margin:1px 0; overflow-wrap:anywhere; }
  .bgNL .bgNLk { font-weight:600; }
  .bgNL .bgNLa { color:var(--oxide); margin:2px 0 4px; }
  @media print { .bgNL .bgNLu > li { break-inside:avoid; } }
  ```
- **Notes changed (anchor = the old opening text → new lead → item lead words).** Exact before / after: the PR diff.
  1. Alignment intro "Define the roadway geometry the bridge follows: the horizontal alignment" → "Define the roadway geometry the bridge follows:" → Horizontal alignment / Vertical profile / Everything else / Graphics.
  2. Horizontal alignment "Station NNN+NN.NN. Bearing as quadrant DMS" → "Input formats:" → Station / Bearing / Coordinates / Curves.
  3. Vertical profile "Required inputs (solid boxes)" → "Solid boxes are required inputs; dashed boxes are optional overrides." → Required inputs / Optional overrides / Editing grade-out / Start and End rows / Computed automatically / Vertical curve.
  4. `#elem_warn` (`renderElemTable`) and `#vprof_warn` (`renderVProfTable`): two or more warnings as a list (`bgNLWarn`); before, `textContent = warnings.join('  ')` on one line. One warning: unchanged. Each warning's text unchanged.
  5. Bridge intro "Define the bridge itself on top of the alignment:" → Spans / Substructure / Deck cross-section / Superstructure depths / Help.
  6. Cross Section "The PGL = baseline = reference line" → "The reference lines of the cross section:" → PGL = baseline = reference line / Construction reference line / Crown reference (dropdown) / Drives.
  7. Superelevation transition table "Leave empty to use the global mode / rate" → "Cross slopes by station, in place of the global controls." → Empty / With one or more rows / Slopes / Green Book method (AASHTO A Policy on Geometric Design, 7th Ed. Sec. 3.3.8, verify) / Rotation.
  8. `#xs_info` (`renderXsInfo`): "Used: N row(s) replace …" as the lead; "Relative gradient of the deck edges to the PGL (edge offsets …):" with one item per station range; "Compare with the maximum relative gradient … (Green Book Table 3-15, verify)."
  9. Girders & Deck Edges "Girders, deck edges, and curbs are all measured from the construction reference line" → the same lead → The line / Offsets / Its position / Per-span edge overrides and per-support curb offsets.
  10. Superstructure Depths "The vertical profile and PGL are defined at top of pavement" → the same lead → Top-of-deck (structural surface) / Beam seats.
  11. Superstructure Depths "Beam seat = top-of-deck − deck thickness − …" → the equation as the lead → Camber / Bracketed terms / Working / Units.
  12. Derived "Everything below is computed from the inputs above." → the same lead → Use / Offsets.
  13. Derived, construction reference line (`buildDerived`, anchor `/* BGNL: the same facts as a list */`): per-span chords: "Construction reference line: chorded span by span through the reference point of each support." → In each span / one item per span (was joined with " · ") / Total along the chords / Angle change at the piers. Single chord: "Construction reference line: L ft (ft-in) between end supports." → Bearing / Angle / Offset along the span.
  14. Substructure Units "Skew is measured from the datum chosen above" → "Skew is measured from the datum chosen above, 0° = support square to it." → Support line / Alignment normal / Chord normal / On a tangent alignment / Dual bearing offset.
  15. Per-span overrides "Most bridges use the same girders and deck width everywhere" → the same first sentence → Use it only / Greyed cell / Override.
  16. 3D Bridge View "Three-dimensional view of the bridge" → the same first sentence → Inspect / Navigate.
  17. Per-beam / per-span overrides "Grey italic = inherited default" → the same first sentence → Override / Revert / Layout.
- **Not changed:** "N spans → 2 abutments + (N−1) piers …" (two short sentences); the Derived "not the deck centerline" note (two sentences). The hand-off payload and its notes are not touched (HANDOFF.md §4.2).
- **Formulas, factors, units, code references:** none changed. **Saved data (§5):** none; no new key.
- **How verified:** headless probe origin/main vs branch, 13 cases (Examples 1–5 as saved, Examples 1–5 with the new-project defaults and b_f = 14 in, two cases with a superelevation table, validation points and a low haunch, and the fresh demo): `seatData()`, the LL & DL hand-off payload (`bgxBuildLldfGeom`, two option sets), Export JSON, the Export DXF file and the Drawings-tab DXF identical (time stamps aside); the digit sequence of every tab and of both dialogs identical; only the Alignment and Bridge tab wording / structure changed. 0 console errors (Site Map tiles aside). 390 px: no page overflow; screenshots of the three longest notes (skew, superelevation table, reference lines) before / after at 1440 and 390 px.
- **Tests:** check-syntax; bgeo-examples; dxf-print-sheets; phone-layout --tool bgeo (390 / 768 px; the 12 console errors are the Site Map tiles, as on main); home-projects; tests/engine/run.mjs handoffs, lldf: pass. project-library --tool bgeo: the expected text-only difference in the Bridge-tab text (ENG and the output / seat tabs identical).
- **Other copies:** none.

## 2026-11-08 — PR: nl-bgeo-a2 (PR #1209: https://github.com/mlococo88/All-Structural/pull/1209) (BGNL-2: long notes as a bold lead and a list — Top of Deck Output, Beam Seat Output, Site Map, Drawings, Export DXF and LL & DL dialogs, curve report; display only, no result change)   [display only]

### BGNL-2. Long notes split into a lead line and a list (output tabs, Site Map, Drawings, dialogs)   [display only] [no result change]
- **Request:** as BGNL-1 (#1197), part 2 of 2. Same rule, helpers (`bgNL`, `bgNLWarn`) and CSS (`.bgNL …`); nothing new added to them. Every sentence, number, citation and link is kept in the same order. New lead words carry no digits.
- **Notes changed (anchor = the old opening text → new lead → item lead words).** Exact before / after: the PR diff.
  1. Alignment, curve and spiral report (`buildElemReport`): "Report only. Curves: arc definition …" → "Report only." → Curves / Spirals.
  2. Top of Deck Output intro "Top-of-deck (riding surface) results: a color heatmap" → "Top-of-deck (riding surface) results:" → Heatmap / Cross-section / Table / Validation / Beam-seat results.
  3. Cross-section at station "Transverse cut through the deck" → the same first sentence → Shows / Station.
  4. Top-of-deck table, grid rows (`buildTable`, anchor `/* BGNL: the same facts as a list */`): "Top-of-deck (Beam-seat) elevations per span." → Rows / Curb offsets / Columns G1..Gn / Every row, … / Along the skewed support and bearing lines / Grey italic values.
  5. Girder tenth points (`buildGird10`): "Top of deck (ft) over each girder at tenth points of its bearing-to-bearing length." → Tenth points / L / For haunch and screed work (CTDOT BDM 8.3.2 …).
  6. Validation, known points "Spot-check the model" → the same first sentence → Enter / Check.
  7. Validation, horizontal "Check the horizontal model the same way." → Enter / Check / Catches.
  8. Beam Seat Output "Seat = top-of-deck − deck thickness − …" → the equation as the lead → Working (link to Seat working kept) / Rows.
  9. Seat working intro (`buildSeatWork`): "Each seat worked out (ft): seat = TD − t_s − (h_min + c [+ m_sag + Δ_cs]) − d − t_brg." → one item per symbol (TD, t_s, h_min, c, d, t_brg, and m_sag, Δ_cs when Seat terms is on); when it is off: "Seat terms are off" / "Basis" (MassDOT Bridge Manual Part I 3.5.6.3, CTDOT BDM 7.2.11.1 and 8.1.2.4, RIDOT BDM 9.4.6).
  10. Midspan haunch check note (`buildSeatWork`): when girders are low, "N girder(s) have less than the minimum haunch at midspan … [Tick Seat terms …]" is the action line on top in the warning colour (before: the whole note was in that colour); otherwise the lead is "Every girder keeps at least the minimum haunch at midspan …". Then Method, and "Owner practice (paraphrased):" with one item per owner: MassDOT Bridge Manual Part I 3.5.6.3; CTDOT BDM (02/24) 7.2.11.1 item 5 and 8.1.2.4; RIDOT BDM (2026) 9.4.6. Wording of each citation unchanged.
  11. Cross-sections at each bearing line (`buildSeatSections`): the per-girder working "G1: …<br>G2: …" as a list (G1: / G2: … as lead words; each `seatWorkText` unchanged); the link "all seats and the midspan haunch check" on its own line (was after " · ").
  12. Site Map intro "Plot the computed bridge geometry on a real-world map." → "… (for orientation, not for survey)." → POB / Distances / Datum / Survey points / Internet.
  13. Site Map, pick points "Drop points on the map" → the same first sentence → Outside the deck / Accuracy.
  14. Drawings intro "Drawing sheets of the computed geometry:" → Sheets / Format / One source / Display only.
  15. Drawings, "One DXF file (AutoCAD R12, model space, full size in inches):" → Sheets / Frame / Other export / Title block.
  16. Export DXF dialog, "Layers: BG-ALIGN …" → "Layers (verify against the survey):" → Alignment / Supports / Superstructure / Elevations / Other / Profile (the layer names unchanged).
  17. Send to LL & DL dialog, skew warning (shown when the skews differ): "Skews differ between supports." as the action line in the warning colour → LL & DL / Moment DFs / Shear DFs / The single "Skew sent" value. Display only: the hand-off payload and its notes (HANDOFF.md §4.2) are not touched.
- **Not changed:** `SharedDxf.PRINT_NOTE` on the Drawings tab (a shared file, `shared/dxf.js`; out of scope for a one-tool PR); the Export DXF dialog intro and basis line (two sentences each); short notes.
- **Formulas, factors, units, code references:** none changed. **Saved data (§5):** none; no new key.
- **How verified:** the BGNL-1 headless probe, origin/main (with BGNL-1) vs branch, 13 cases: `seatData()`, the LL & DL hand-off payload (two option sets), Export JSON, the Export DXF file and the Drawings-tab DXF identical (time stamps aside); the digit sequence of every tab and of both dialogs identical. The LL & DL dialog with differing skews (Example 2, skews 10–25°) checked at 390 px. 0 console errors (Site Map tiles aside). 390 px: no new page overflow (the Top of Deck tab is 6 px wide of the viewport on main and on the branch). Screenshots before / after at 1440 and 390 px: midspan haunch note, seat working intro, top-of-deck table note, per-bearing-line working, LL & DL dialog.
- **Tests:** check-syntax; bgeo-examples; dxf-print-sheets; phone-layout --tool bgeo; home-projects; tests/engine/run.mjs handoffs, lldf: pass. project-library --tool bgeo: the expected text-only difference in the output and seat tab text (ENG identical).
- **Other copies:** none.

## 2026-11-08 — PR: bgeo-left-summary (PR #1224: https://github.com/mlococo88/All-Structural/pull/1224) (BGLS: key results in a left summary column from 1200 px; display only, no result change)   [display only] [new UI key]

### BGLS. Results summary column on the left at 1200 px and wider   [display only]
- **Request (engineer, 2026-11-07/08):** add the left summary panel to the tools with summary or result cards, the way it was done in Retaining Wall (RWDL #959, RWLB #984), Spread Footing (SFLB #988), Light Pole (LPLB #991, #994/#997) and Shear and Moment Diagrams (SMLS #1130).
- **What changed (screen only):**
  - From **1200 px** a left column `#bgDashCol` sits beside the tabs (below the header and tab strip): **240 px** up to 1499 px, **280 px** from 1500 px. It stays in view while the page scrolls (sticky).
  - "Results summary", one chip per value (name, value, status), in groups:
    - **Model:** geometry input error (STOP; the results are the last valid geometry), geometry warnings, alignment / profile table warnings, when present. Text read from the boxes on the page (`#geom_err`, `#geom_warn`, `#elem_warn`, `#vprof_warn`).
    - **Spans:** one chip per span, the length along the construction reference line, read from the Bridge-tab Spans table (`#span_wrap`); the detail lists all three lengths of that row (PGL stations, reference line, girder bearing to bearing).
    - **Beam seats:** lowest and highest seat elevation and where (bearing line, girder), from `seatData()` with the Beam Seat table's decimals (`outDec()`).
    - **Checks:** Midspan haunch "girders OK / N" with OK or LOW, with the lowest haunch at the flange edge (span, girder) and h_min: the counts of the table in `buildSeatWork` (no new calculation; the table's own `hE`, `hmin`, `ok`). Elevation check and Coordinate check: the last Check result "pass / n" (OK / OUT), "not run" before the first Check, "re-run" (warning) when the geometry has changed since.
  - Head counts: "N NG", "N warn", or "no NG".
  - **Click a chip (or Enter / Space):** opens the tab and scrolls to the table that works the value (Spans table, Beam Seat Elevations, Seat working · midspan haunch check, Validation panels, the warning boxes), with a short outline flash (§6). ▸ / ▾ shows the detail and "→ Tab · table"; NG and warning chips start open.
  - « shrinks the column to a 42 px strip (vertical title and counts); » opens it. Stored in this browser under the per-tool UI key **`bridgeGeomEngine.dashCollapsed.v1`** ('1' = collapsed). Not in the project, the autosave or the export (§5). Plots are resized when the column changes width.
  - While the column is open, fieldsets in the main column may shrink below their content (`min-width:0`), so a wide input table scrolls in its own box (as the phone rule of BGX10) instead of the page.
  - **Below 1200 px nothing changes** (`display:none`); hidden in print.
- **Where (`Bridge Geometry.html`):**
  - **CSS:** after the BGNL rules, the block that starts `/* BGLS (2026-11-08, engineer: the left summary panel`.
  - **HTML:** `<aside id="bgDashCol" class="noprint" aria-label="Results summary">` between `</header>` and `<main>`.
  - **JS:** after `function bgNL(`, the block `/* BGLS … */`: `BGLS`, `bgDashItems()`, `bgDashGo(it)`, `bgDashRender()`, `bgDashPlace()`, `bgDashColl(v, save, redraw)` and a start-up IIFE (placed before the first compute, so the plots are drawn at the main column's width).
  - `compute()` calls `bgDashRender()` at its end (and on a geometry input error before returning); `buildSeatWork` keeps `BGLS.haunch = {n, low, min}` (reset at its start); `runValidation` / `runHValidation` keep `BGLS.val` / `BGLS.hval = {pass, n, tol, eng}` and re-render.
- **Decision (pending engineer review):** the validation chips show the last Check, not a live check (the tool runs validation only when Check is pressed; running it on every change would change the tool's behaviour). A geometry change marks them "re-run".
- **Formulas, factors, units, code references:** none changed. No new calculation: every chip value is read from the page or from the same expression the table uses. **Saved data:** none. New UI key `bridgeGeomEngine.dashCollapsed.v1` (prefixed per tool).
- **Check case:** Example 2 (3-span skewed overpass) with the new-project defaults, b_f = 14 in, h_min = 0.25 in, camber 3 in, one known point. Chips: Span 1 / 2 / 3 150.00 ft; lowest beam seat 126.97 ft, highest 130.59 ft (as the Beam Seat table); Midspan haunch 18 / 18, OK; Elevation check "not run", then "0 / 1 OUT" after Check. Clicking Midspan haunch opens Beam Seat Output at "Seat working · midspan haunch check".
- **How verified:** headless probe origin/main vs branch, the 13 BGNL cases at 1440 px: `seatData()`, the LL & DL hand-off payload, Export JSON, the Export DXF file and the Drawings-tab DXF identical (time stamps aside); every tab's text identical except one Plotly axis tick label on the Alignment tab (the plan plot is drawn 240 px narrower, so Plotly picks a different tick set; not a result). Page overflow 0 at 1200, 1280, 1440 and 1600 px for Examples 1–5; collapse / re-open resizes the plots. 0 console errors (Site Map tiles aside). Screenshots at 1440, 1280 (open, after a chip click, collapsed) and 390 px.
- **Tests:** see the PR.
- **Other copies:** none.

## 2026-11-10 — PR: asm-bridge-geometry (PR #1314: https://github.com/mlococo88/All-Structural/pull/1314) (BGASM) — assumptions and decisions stated as notes on the tabs and on the printed output tabs (CLAUDE.md §6, engineer's rule 2026-11-10)   [display / text only; no result, saved key or format change]
- **Engineer (2026-11-10, #1284):** every assumption or decision is stated in the tool where it applies (the tab and the matching section of the calculation report), saying what the code does and citing the provision, without "pending engineer review".
- **Report:** this tool has no separate calculation report; its printed calculation is the print of the active tab (`@media print`: fieldsets, buttons and `.noprint` hidden). The Top of Deck Output and Beam Seat Output tabs are what prints, so the basis of their results is now stated there (new Basis notes), as well as on the input tabs.
- **Audit:** every "Decision (pending engineer review)" (BGX2 H1 tolerance / no tangent example; BGX3 per-span chords and pier skew; BGX4 skew datum and hand-off skew; BGX5 seat terms; BGX6 superelevation table; BGX8 dual bearing offset; BGX9 grid rows; STDS untouched examples / per-browser hold; BGHD; BGLS chips) and every engineer decision / definition in this file (vertical datum label only; edition 10th Ed.; Q-BG1 to Q-BG5; BGDW-2; LIST), and the PR bodies of #1103, #1109, #1116, #1119, #1122, checked against the notes and the code. The item table is in the PR.
- **Where (anchors are the text before the change; each before → after is in the PR diff):**
  1. Alignment tab, note "Input formats:": after `<li><b class="bgNLk">Curves:</b> positive R curves right.</li>` + item **Beyond the POB / POE:** points before the POB / after the POE on the start / end tangent extended; past the profile Start / End the first / last grade extended; a geometry warning names them (BGX1, BGX2 M1).
  2. Bridge tab, note "The reference lines of the cross section:", item **Construction reference line:** before `a straight chord between its offset at each abutment — the line the plans …` (**wrong with Per-span chords, corrected**: `buildEngine()` `PS` chords span by span); after: the line the plans dimension from, offset entered at each abutment; + item **Girder layout in plan:** per-span chords between the reference points of the supports (PGL point at the support station, offset interpolated by station between the abutment offsets), kinked at each pier on the bisector; One chord for projects saved before the setting; curved girders not modelled (BGX3).
  3. Bridge tab, note "Girders, deck edges, and curbs are all measured from …", item **The line:** before `a straight line running parallel to the bridge.` → `straight within each span (Per-span chords) or one straight chord (One chord), as set by Girder layout in plan.` (corrected wording).
  4. `#bcl_off_a1` tooltip: `The reference line is the straight chord between the Abut 1 and Abut 2 points;` → states both layouts (corrected wording).
  5. Bridge tab, skew note, item **Dual bearing offset:** + each bearing line parallel to its pier line through its own reference point; along the girders the offset is along the reference line, not normal to the pier line: normal distance = offset × cos θ (BGX3, BGX8; `bearingLinesFor()`).
  6. `renderXsInfo()`: `(Green Book Table 3-15, verify).` + ` The tool applies no limit to it.` (BGX6).
  7. `geometryWarnings()` H1 message: `so the deck leaves the roadway at the interior supports:` → `… supports (checked against the line between the end offsets; tolerance the smaller of 0.5 ft and 2 % of the deck width):` (BGX2; the code's `tol=Math.min(0.5, 0.02*Math.abs(ed.r-ed.l))`).
  8. `buildSeatWork()`: m_sag item + `on the deck surface along the girder, so it includes the vertical-curve ordinate and any warp from a cross-slope change or the chord's offset on a curve`; Δ_cs item `how far the deck falls across the top flange, b_f = …` → `…: TD at the girder − the lower of TD at ± b_f/2 (a crown inside the flange counts the steeper side), so the minimum haunch is kept at the low flange edge (CTDOT BDM 8.1.2.4); b_f = …` (BGX5; `crossDrop()`).
  9. Top of Deck Output: `Top-of-deck (riding surface) results:` → `Top-of-deck (structural deck surface: the profile minus the HMA overlay) results:`; `Top-of-deck (riding surface) elevations.` → `Top-of-deck (structural deck surface) elevations.` (**wording contradicted the code**: top of deck = profile − HMA, the Bridge-tab note and the pavement toggle's tooltip).
  10. New `buildBasisNotes()` (just before `function compute(){`, called after `renderSnapButtons();` in `compute()`), boxes `#tod_basis` / `#seat_basis` after each output tab's `.vdatum_cap`: **Basis (Bridge tab settings)** — girder layout, skew datum, cross slopes (table or global; rotation about the crown line), top of deck = profile − HMA, beyond the ends (Top of Deck Output); girder layout, skew datum, dual bearing offset, net camber, seat terms on / off (Beam Seat Output). Text only, read from the same settings the engine reads.
- **Formulas, factors, units, code references, saved data:** none changed (§4, §5). No new key.
- **Check case:** default (new) project: Beam Seat Output shows "Basis … Girder layout in plan: per-span chords …; Skew: entered from the alignment normal …; Dual bearing offset: measured along the girders … offset × cos θ; Seat terms: on …"; the seats are unchanged (Abut 1 brg G1 95.60). Example 3 (One chord): the H1 warning reads "(checked against the line between the end offsets; tolerance the smaller of 0.5 ft and 2 % of the deck width): Pier 1: reference line +10.49 ft …".
- **How verified:** headless probe origin/main vs branch, 9 cases (demo; Examples 1–5; demo with the saved-project settings; a superelevation table, b_f 16 in, camber 2 in; dual-bearing piers skewed 20°): `seatData()`, the LL & DL hand-off payload (time stamp aside) and Export JSON identical; the digit sequence of every tab and the warning box identical apart from inserted digits (Abut 1 / Abut 2, b_f/2, 8.1.2.4, 0.5 ft / 2 %); 0 console errors.
- **Other copies:** none.

## 2026-11-10 — PR: claude/hoc-bgeom (PR #TBD) — Project tab: "hand-off to LL & DL Distribution" becomes "hand-offs" with Receive / Send groups, the shared project info status and the last send (HOC; engineer decision 2026-11-10: the hand-off card on the Project tab in every tool)   [display only; no computed value, payload, storage key or saved-data format change]
- **Where:** `#pane-project`, fieldset `<legend>hand-off to LL &amp; DL Distribution</legend>` → `<legend>hand-offs</legend>`: a note (nothing changes until you confirm); "Receive from other tools": Shared project info (read only, for the Drawings title block; new `<span id="bgHoPm">` status); "Send to other tools": Geometry to LL & DL Distribution (`#bgx_send`, `#bgx_export`, unchanged; new "Last sent" `<span id="bgHoSent">`). Same buttons and handlers; the controls were already on the Project tab, so no link is left elsewhere.
- LL & DL hand-off block: after `setStatus('sent to LL & DL — …')` in `#bgx_do_send`, `hoLines();`. New `function hoLines()` after `if(be) be.addEventListener('click',openDlg);` fills `#bgHoSent` from `bridgeSuite.v1.lldfGeom` when its producer is "Bridge Geometry" and `#bgHoPm` from `bridgeSuite.v1.projectMeta` (read only); called on load, `storage` and `focus`.
- CSS after `#pane-project .prjRow {…}`: `.bgHoGrp`, `.bgHoRow`, `.bgHoFrom`.
- **Provisions:** none. **Check case:** main vs branch probe (seeded `projectMeta`; Send to LL & DL → Send; Export hand-off (JSON) → Export): the send dialog text, the exported file and all localStorage keys byte-identical (ISO times normalised): `lldfGeom(.updatedAt)`, `bridgeGeomEngine.project.v1`, `projectMeta(.updatedAt)`.
- **Saved data (§5):** none. **Decisions (pending engineer review):** "Last sent" and the project info status are read from the channel keys in this browser (no new record). **Other copies:** none.
