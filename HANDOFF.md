# HANDOFF.md — How the tools pass data to each other

This file is the specification for every cross-tool data hand-off. Any tool that sends or receives data must follow it. If you change a channel, update this file in the same PR.

## 1. Transport

- Hand-offs go through **browser localStorage**, using keys under the existing namespace **`bridgeSuite.v1.`**.
- All tools share one storage origin in two situations:
  - Opened from the website (`https://mlococo88.github.io/All-Structural/…`): any browser, including phones.
  - Opened as files from one folder: Chrome or Edge only. Other browsers keep each file separate.
- **File fallback.** Every sending tool also offers **"Export hand-off (JSON)"**, and every receiving tool offers **"Import hand-off (JSON)"**. The file contains exactly the payload described below. This also lets a hand-off go into a calc package, or move between devices.

## 2. Common envelope (every channel)

```js
{
  _schema: "bridge-<channel>",      // fixed per channel, see §4
  schemaVersion: 1,                 // bump only for breaking changes
  producer: "<tool display name>",  // e.g. "Bridge Geometry"
  producerFile: "<file>.html",
  producedAt: "<ISO 8601 timestamp>",
  project: { name: "", bridgeId: "" }, // from the shared project info if available, else the tool's own title block
  units: { ... },                   // explicit units for every numeric field, see §4
  notes: [ "..." ],                 // free-text caveats the receiver must display
  /* channel payload fields */
}
```

- **Data key:** `bridgeSuite.v1.<channel>`.
- **Timestamp key:** `bridgeSuite.v1.<channel>.updatedAt`, holding the same `producedAt`.
- **Adoption marker:** `bridgeSuite.v1.<channel>.adopted.<receiverId>`, holding the `producedAt` of the last payload that receiver adopted. The receiver uses it to show "new data available".

## 3. Rules for senders and receivers

1. **The receiver decides when to pull.**
   - A receiver never changes its inputs without the user clicking **"Pull from <producer>"**, or an equivalent import.
   - Before applying anything, it shows the producer, the time, the project, and a summary of what will be overwritten.
2. **Check before using.**
   - The receiver checks `_schema` and `schemaVersion ≤ supported`. If either fails, it refuses with a clear message.
   - Every numeric field is validated (finite, sensible sign).
3. **Units and basis are explicit.**
   - Every payload states its units.
   - Every force/moment payload also states whether values are **factored**, and whether **dynamic load allowance (IM)**, **distribution factors (DF)** and **multiple presence** are included.
   - Receivers convert or refuse; they never guess.
4. **Record the source.** After adopting a payload, the receiver records its source (producer, producedAt) in its own saved state. It also prints that source in its report, e.g. "Spans from Bridge Geometry, 2026-10-05 14:02".
5. **No silent overwrite on load.** Opening a tool never auto-applies a hand-off. A banner such as "New data from X available" is fine.
6. **Additive only.** Existing storage keys and saved-project formats are not changed (CLAUDE.md §5). Hand-off state lives in new optional fields.
7. **Keep it simple.** Senders write their channel on an explicit **"Send to other tools"** button. Senders that already auto-publish (lldf, psbeam, stgirder) may keep doing so.
8. **Copy the shared helper.** Each tool carries its own copy of the shared helper (§5); per CLAUDE.md §3 it stays duplicated. List the files that contain it in the PR.

## 4. Channels

Fields marked *(existing)* already exist; their schemas are documented in `AUDIT.md` §1.3. They must not be changed incompatibly.

| Channel key (`bridgeSuite.v1.` + …) | `_schema` | Sender(s) | Receiver(s) |
|---|---|---|---|
| `projectMeta` | `bridge-project-meta` | any tool | every tool |
| `lldfGeom` *(existing)* | `bridge-lldf-geometry` | index (MCT), psbeam, stgirder, **Bridge Geometry** | lldf |
| `lldf` *(existing)* | `bridge-lldf-factors` | lldf | index, psbeam, stgirder, **Moving Load Generator**, **Steel Bridge Beam Modules** |
| `dlLoads` *(existing)* | `bridge-dl-loads` | lldf | index, psbeam, stgirder |
| `superReactions` | `bridge-super-reactions` | psbeam, stgirder, index (MCT) | Bridge Substructure Loading |
| `abutmentLoads` | `bridge-abutment-loads` | Bridge Substructure Loading | abutment_calculator |
| `foundationLoads` | `bridge-foundation-loads` | abutment_calculator, Bridge Substructure Loading | Pile Designer, Spread Footing |
| `buildingLoads` | `bridge-building-loads` | ASCE7-16 Load Generator | Steel Beam Design |
| `memberReactions` | `bridge-member-reactions` | Steel Beam Design | BasePlateAnchorDesigner, Spread Footing |

### 4.1 `projectMeta`

This matches the existing BridgeLocks "project" channel (`index.html`).

```js
{ ...envelope, _schema:"bridge-project-meta",
  fields: { projectName:"", bridgeId:"", jobNo:"", client:"", location:"",
            preparedBy:"", checkedBy:"", date:"" } }
```

- Each tool maps these fields onto its own title-block fields. Fields a tool doesn't have are ignored.
- Each tool offers **"Use shared project info"** (pull) and **"Share project info"** (publish).

### 4.2 `lldfGeom` (existing; Bridge Geometry becomes a sender)

- Bridge Geometry must write exactly the shape `lldf.html` already consumes. `lldf.html` is the reference: see `K_GEOM` and its reader. Span lengths, girder spacings and skew are in **feet** and **degrees**.
- Bridge Geometry sets `producer:"Bridge Geometry"` and adds `notes` stating that the spans are measured along the abutment-to-abutment chord, and how skew is defined.
- Shape Bridge Geometry writes (clarified when it became a sender):

  ```js
  { ...envelope, _schema:"bridge-lldf-geometry", producer:"Bridge Geometry", producerFile:"Bridge Geometry.html",
    project:{ name:"", bridgeId:"" },            // envelope object (§2); MCT / PS-Beam / ST-Girder still send a plain string
    units:{ spans:"ft", spacings:"ft", skew:"deg", OL:"ft", OR:"ft" },
    basis:{ spans:"chord, support centerlines"|"chord, bearing lines", skew:"max"|"min"|"mean", girders:"global"|"<span no.>" },
    Nb:<girders>, de:null,                       // Nb only when spacings are sent; d_e is not sent
    inputs:{ spans:[ft…], spacings:[ft…, left to right], skew:<deg, ≥0>, OL:<ft>, OR:<ft> } }
  ```

  - `inputs` uses lldf's own input names. `OL`/`OR` are deck edge to exterior girder centerline. `spacings`, `OL`, `OR` and `Nb` are left out when Bridge Geometry has fewer than two girders, and the `notes` say so.
  - The engineer picks the `basis` choices in Bridge Geometry's send dialog; each choice is also stated in `notes`.
- lldf (receiver) accepts `project` as a string or an object, refuses any unit other than ft/deg, and validates every number. It has a **"Pull from <producer>"** button with a new-data dot and **"Import hand-off (JSON)"**. Both raise its existing prefill banner, which lists what will be overwritten and the sender's `notes`. It records the adopted source as the optional `geomSource` field in its saved state, and prints it below the title block.
- lldf's "Lock" (auto-follow) on this channel stays for MCT, PS-Beam and ST-Girder. It is **not** offered for, and never auto-applies, a Bridge Geometry payload (§3.5).

### 4.3 `lldf` (existing; new receivers)

- Receivers read the fields that `lldf.html` already publishes (`governing…`, `governingNeg…`, fatigue `fatM`/`fatV` where present).
- Moving Load Generator maps them to its per-span DF inputs. It must use the **fatigue** factors for the fatigue truck if it supports per-vehicle factors; otherwise it warns.
- Steel Bridge Beam Modules maps them to its DF module.
- Receivers must state whether multiple presence and skew are included; lldf includes both.
- Existing envelope differences (kept for the existing receivers): lldf writes the keys itself, not through `BridgeXfer.publish`. `producer` is `"LL & DL Distribution"`, there is no `producerFile`, and `project` is a **string** (lldf's project field), not `{name, bridgeId}`. Receivers must accept both shapes.
- Fields added for Moving Load Generator (additive; existing receivers ignore them):
  - `governingBySpan`: array, one entry per span (index *i* = span *i*+1), each with the same shape as `governing` (`interior`, `exterior`, `byBeam`), computed for that span alone (L = that span).
  - `units: { spans:"ft", S:"ft", skew:"deg", laneWidth:"ft", df:"lanes per girder (dimensionless)" }`. Payloads from before this field existed are also in ft/deg (lldf has no other unit system).
  - `multiplePresenceIncluded: true`, `skewIncluded: true` (they describe `gM`/`gV`). `fatM`/`fatV` are the one-lane DF ÷ 1.2 (no multiple presence), skew included.
- lldf also offers **"Export DF hand-off (JSON)"**, which writes the same payload to a file.
- Moving Load Generator (receiver id `movingLoad`): the user picks interior, exterior or a single beam (`byBeam`), defaulting to lldf's design beam when present. `gM`/`gV` from `governingBySpan[i]` go to span *i* (or `governing` for every span when the span counts differ or the payload has no `governingBySpan`). `governingNeg.gM` goes to the one negative-moment DF. Spans are compared and only overwritten when the user ticks the option. `fatM`/`fatV` are shown and quoted in the fatigue-truck warning but not applied, because the tool has one DF set for all vehicles.

### 4.4 `superReactions`

```js
{ ...envelope, _schema:"bridge-super-reactions",
  units:{ force:"kip", length:"ft" },
  factored:false, imIncluded:false, dfIncluded:false, perGirder:true,
  supports:[ { id:"Abut 1"|"Pier 1"|…, x:<ft from start>,
               girders:[ { label:"G1", DC1:<kip>, DC2:<kip>, DW:<kip> } ] } ],
  liveLoad: null | { basis:"per lane, no IM, no DF", supports:[{id, Rmax:<kip>, Rmin:<kip>}] } }
```

- Unfactored dead-load reactions are given per girder, per support.
- Live load is optional and informational, because Substructure Loading computes its own LL.
- psbeam and stgirder model a single girder line: they send their girder, labelled by the design-beam selection, and say so in `notes`.

### 4.5 `abutmentLoads`

- The payload is the existing SubLoads `subloads-abutment-v1` export, wrapped in the envelope, with `_schema:"bridge-abutment-loads"`.
- The abutment calculator maps it onto its inputs, and lists every field it does not use.

### 4.6 `foundationLoads`

```js
{ ...envelope, _schema:"bridge-foundation-loads",
  units:{ force:"kip", moment:"kip-ft", length:"ft" },
  element:{ type:"abutment"|"pier"|"bent", label:"" },
  location:"<where the forces act, e.g. 'bottom of footing, centre'>",
  signConvention:"<axes and positive directions, stated in words>",
  cases:[ { name:"Strength I max", limitState:"Strength I", factored:true,
            P:<kip, +down>, Vx, Vy, Mx, My } ] }
```

- Factored and service cases are both allowed; each case says which it is.
- Receivers let the user pick cases. They map each case to their own load inputs, and flag any mismatch in convention.

### 4.7 `buildingLoads`

```js
{ ...envelope, _schema:"bridge-building-loads", code:"ASCE 7-16",
  units:{ pressure:"psf", seismic:"SDS and SD1 in g; Ie dimensionless; SDC a letter", length:"ft", angle:"deg" },
  factored:false,
  signConvention:"<in words: wind + toward the surface (down on a roof), − away (uplift); D, Lr, S down on the horizontal projection>",
  areaLoads:{ D:null|<psf>, L:null|<psf>, Lr:null|<psf>, S:<psf design balanced roof snow>,
              W:{ roofUplift:<psf, most negative roof pressure>, roofDown:<psf, most positive roof pressure>,
                  wall:null|<psf, magnitude ≥ 0>, wallPressure:null|<psf>, wallSuction:null|<psf>,
                  basis:{ roofUplift:"<case/zone/GCpi>", roofDown:"…", wall:"…", wallPressure:"…", wallSuction:"…" } },
              R:null },
  seismic:{ SDS:null|<g>, SD1:null|<g>, SDC:null|"A"…"F", Ie },
  info:{ snow:{ pfDes, ps, balanced, unbalanced:null|{windward, leewardUniform, leewardPeak, surchargeLength},
                drift:null|{location, peak, surcharge, width} },     // psf / ft, information only
         roof:{ type, slopeDeg }, qh, G, GCpi, enclosure } }
```

- Values are nominal (unfactored); `factored` is always `false`.
- **ASCE7-16 Load Generator (sender)** fills the fields from what it computes:
  - `D` and `Lr` are the roof dead and roof live loads entered in that tool (inputs, on the horizontal projection). `L` (floor live) and `R` (rain) are not computed, so they are `null`.
  - `S` is the design balanced roof snow load (`R.snow.balanced`: Sec. 7.3/7.4 with the Sec. 7.3.4 minimum and the Sec. 7.10 rain-on-snow surcharge where they apply). Unbalanced snow and drift are **not** in `S`; they are sent under `info.snow` and in `notes`, as information only.
  - Wind values are **MWFRS** pressures (Ch. 27 Part 1), net of internal pressure: `roofUplift`/`roofDown` are the most negative/positive roof pressures over all wind directions, zones and both GCpi signs (the dashboard's "Wind Pressure Envelope"). `wallPressure` is the largest windward-wall pressure at the mean roof height, `wallSuction` the most negative leeward or side-wall pressure, and `wall` the larger magnitude of the two. `basis` names the case, zone and GCpi sign of each. For an open canopy (free roof) the roof values are the net free-roof pressures and the wall fields are `null`. Components-and-cladding (Ch. 30) pressures are not computed, and `notes` says so.
  - `seismic` values are `null` when the tool has no tabulated site coefficient (site-specific analysis required).
- **Steel Beam Design (receiver)** converts them to uniform line loads, w (kip/ft) = p (psf) × TW (ft) / 1000, using a **tributary width entered by the user** in the pull dialog. The user also picks the load types (D, L, Lr, S, W), the target load case for each (defaults DL, LL, LR, SL, WL; a missing case is created), which wind pressure applies, all spans or selected spans, and "replace previously imported loads" or "add". Imported loads are tagged `ld.bx = { ch:"buildingLoads", type, psf, tw, producer, producedAt, wind? }`; only tagged loads are ever replaced. Accepted pressure units: `psf`, or `kPa` (converted at 1 kPa = 20.885434 psf); anything else is refused. Seismic values are shown, not imported.

### 4.8 `memberReactions`

```js
{ ...envelope, _schema:"bridge-member-reactions",
  units:{ force:"kip", moment:"kip-ft" },
  supports:[ { id:"A"|"B"|…, x:<ft>,
               byLoadType:{ D:{V, M}, L:{V, M}, Lr, S, W, E }, // unfactored, per load type
               factored:false } ] }
```

- Receivers (base plate, spread footing) let the user pick one support. They import its reactions as column load cases by type, and then apply their own combinations.

## 5. Shared helper (copy into each tool that sends or receives)

A small IIFE, `window.BridgeXfer`, providing:
- `publish(channel, payload)`: stamps the envelope and writes the key and timestamp;
- `read(channel, schema, maxVersion)`: returns the payload, or an `{error}`;
- `markAdopted(channel, receiverId, producedAt)`;
- `isNew(channel, receiverId)`;
- `exportFile(channel)` and `importFile(file, schema)`.

The reference copy is below. Paste it **verbatim** inside a plain `<script>` tag in each tool, before the tool's own hand-off code. If it ever changes, update this file and every copy in the same PR.

```js
/* BridgeXfer v1 — cross-tool hand-off helper. Spec: HANDOFF.md. Duplicated verbatim in each tool that sends or receives (CLAUDE.md §3). */
(function(){
  if(window.BridgeXfer) return;
  var NS='bridgeSuite.v1.';
  function lsOK(){ try{ var k='__bx_t'; localStorage.setItem(k,'1'); localStorage.removeItem(k); return true; }catch(e){ return false; } }
  function sharedProject(){
    try{ var m=JSON.parse(localStorage.getItem(NS+'projectMeta')||'null');
      if(m && m._schema==='bridge-project-meta' && m.fields) return { name:m.fields.projectName||'', bridgeId:m.fields.bridgeId||'' };
    }catch(e){}
    return null;
  }
  function stamp(channel, payload, producer, producerFile){
    var p={}; for(var k in payload) if(Object.prototype.hasOwnProperty.call(payload,k)) p[k]=payload[k];
    p.schemaVersion = p.schemaVersion || 1;
    p.producer = p.producer || producer || document.title;
    p.producerFile = p.producerFile || producerFile || decodeURIComponent((location.pathname.split('/').pop()||''));
    p.producedAt = new Date().toISOString();
    if(!p.project) p.project = sharedProject() || { name:'', bridgeId:'' };
    if(!p.notes) p.notes = [];
    return p;
  }
  function publish(channel, payload, producer, producerFile){
    if(!payload || !payload._schema) return { error:'payload has no _schema' };
    var p=stamp(channel, payload, producer, producerFile);
    if(!lsOK()) return { error:'Browser storage is not available. Use "Export hand-off (JSON)" instead.', payload:p };
    try{
      localStorage.setItem(NS+channel, JSON.stringify(p));
      localStorage.setItem(NS+channel+'.updatedAt', p.producedAt);
    }catch(e){ return { error:'Could not save hand-off (storage full?): '+e.message, payload:p }; }
    return { ok:true, payload:p };
  }
  function validate(p, schema, maxVersion){
    if(!p || typeof p!=='object') return 'not a hand-off object';
    if(p._schema!==schema) return 'wrong data type ('+(p._schema||'none')+'), expected '+schema;
    if(!(p.schemaVersion<= (maxVersion||1))) return 'newer format (v'+p.schemaVersion+') than this tool supports (v'+(maxVersion||1)+')';
    return null;
  }
  function read(channel, schema, maxVersion){
    var raw=null;
    try{ raw=localStorage.getItem(NS+channel); }catch(e){ return { error:'Browser storage is not available.' }; }
    if(!raw) return { error:'Nothing has been sent on this channel yet.' , empty:true };
    var p; try{ p=JSON.parse(raw); }catch(e){ return { error:'Stored hand-off is corrupt.' }; }
    var err=validate(p, schema, maxVersion); if(err) return { error:err };
    return { ok:true, payload:p };
  }
  function markAdopted(channel, receiverId, producedAt){
    try{ localStorage.setItem(NS+channel+'.adopted.'+receiverId, producedAt||''); }catch(e){}
  }
  function isNew(channel, receiverId){
    try{
      var at=localStorage.getItem(NS+channel+'.updatedAt'); if(!at) return false;
      return at!==localStorage.getItem(NS+channel+'.adopted.'+receiverId);
    }catch(e){ return false; }
  }
  function exportFile(channel, payload){
    var p=payload; if(!p){ try{ p=JSON.parse(localStorage.getItem(NS+channel)); }catch(e){} }
    if(!p) return { error:'Nothing to export.' };
    var blob=new Blob([JSON.stringify(p,null,2)],{type:'application/json'});
    var a=document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download=(p._schema||channel)+'_'+(p.producedAt||'').slice(0,19).replace(/[:T]/g,'-')+'.json';
    document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 60000);
    return { ok:true };
  }
  function importFile(file, schema, maxVersion, cb){
    var fr=new FileReader();
    fr.onload=function(){ var p; try{ p=JSON.parse(fr.result); }catch(e){ cb({ error:'File is not valid JSON.' }); return; }
      var err=validate(p, schema, maxVersion); cb(err? { error:err } : { ok:true, payload:p }); };
    fr.onerror=function(){ cb({ error:'Could not read file.' }); };
    fr.readAsText(file);
  }
  function describe(p){ return (p.producer||'?')+' — '+(p.producedAt? new Date(p.producedAt).toLocaleString():'?')+((p.project&&p.project.name)?' — '+p.project.name:''); }
  window.BridgeXfer={ NS:NS, publish:publish, read:read, validate:validate, markAdopted:markAdopted, isNew:isNew, exportFile:exportFile, importFile:importFile, describe:describe, sharedProject:sharedProject };
})();
```
