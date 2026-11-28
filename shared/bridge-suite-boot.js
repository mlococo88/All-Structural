/* shared/bridge-suite-boot.js — the Bridge Suite bootstrap / hand-off code (bridgeSuite.v1.*), one copy (window.SharedBridgeBoot).
   BSB (2026-11-28, docs/ps-bridge-plan.md §5 row 8, CLAUDE.md §3): moved, byte for byte, from the inline <script> blocks that were
   identical in index.html, lldf.html and "Prestressed Bridge Design.html" (the copy there is frozen and stays until that page becomes a
   redirect page), and from apps/ps-bridge/ui/bridgexfer.js. Pure refactor: no key, schema, payload or behaviour changed.
   Loading this file installs nothing; each page calls the parts it had, at the place its inline block was, so every part runs at the same
   point of the page as before (the page's own scripts before and after it see the same globals):
     beam()          window.BridgeBeam                (design beam / beam roster channel; index.html, lldf.html)
     handoff()       window.BridgeHandoff             (MCT demands library: handoffs / latestId / adopted.<app>; index.html)
     geometry()      window.BridgeGeometryChanges     (geometryChanges; index.html)
     registry(app)   window.BridgeProjects, window.BridgeApps, window.BridgeLocks, then BridgeApps.boot(app)
                                                      (app 'mct' in index.html, 'lldf' in lldf.html; the only text that differed)
     xfer()          window.BridgeXfer                (BridgeXfer v1, HANDOFF.md §5; index.html, lldf.html, apps/ps-bridge)
     project()       window.BXProject                 (shared project info glue, HANDOFF.md §4.1; index.html, lldf.html)
   The global names those parts set are the suite's existing interface (HANDOFF.md) and are kept; this file's own name is SharedBridgeBoot.
   Each part's body below is the old inline block verbatim (tests/engine/shared-bridge-suite-boot.test.mjs checks it against the pages
   before the move and runs both in Node). The other tools' BridgeXfer copies (HANDOFF.md §5) are unchanged and must stay in step with
   xfer(). */
(function () {
  if (window.SharedBridgeBoot) return;

  /* ---- beam: Bridge Suite shared DESIGN BEAM channel (v1) ---- */
  function beam() {
(function(){
"use strict";
if(window.BridgeBeam) return;
var NS='bridgeSuite.v1', K_SEL=NS+'.designBeam', K_ROS=NS+'.beamRoster';
var S_SEL='bridge-design-beam', S_ROS='bridge-beam-roster', VER=1;
var subs=[];
function rd(k,s){ try{ var raw=localStorage.getItem(k); if(!raw) return null; var o=JSON.parse(raw);
  if(!o||o._schema!==s||(o.schemaVersion||1)>VER) return null; return o; }catch(e){ return null; } }
function wr(k,o){ try{ localStorage.setItem(k,JSON.stringify(o)); return true; }catch(e){ return false; } }
function roster(){ return rd(K_ROS,S_ROS); }
function get(){ return rd(K_SEL,S_SEL); }
function emit(){ var s=get(),r=roster(); subs.slice().forEach(function(f){ try{f(s,r);}catch(e){} }); }
function beamOf(r,i){ var b=(r&&r.beams)||[],k; for(k=0;k<b.length;k++) if(+b[k].i===+i) return b[k]; return null; }
// Default pick: the 1st interior roadway beam (MassDOT's usual design beam), else any
// interior beam, else the middle of the layout.
function defaultIndex(r){ var b=(r&&r.beams)||[],i;
  for(i=0;i<b.length;i++) if(b[i].cls==='first-int') return b[i].i;
  for(i=0;i<b.length;i++) if(b[i].type==='int') return b[i].i;
  return b.length?b[Math.floor((b.length-1)/2)].i:1; }
function set(index,r,by){
  r=r||roster(); index=Math.max(1,Math.round(+index||1));
  if(r&&r.Nb) index=Math.min(index,r.Nb);
  var b=beamOf(r,index), prev=get(), same=prev&&+prev.index===index;
  var o={_schema:S_SEL,schemaVersion:VER,index:index,
    label:(b&&b.label)||(same&&prev.label)||('B'+index),
    cls:(b&&b.cls)||(same?prev.cls:null), clsLabel:(b&&b.clsLabel)||(same?prev.clsLabel:null),
    ab:(b&&b.ab)||(same?prev.ab:null), type:(b&&b.type)||(same?prev.type:null),
    Nb:(r&&r.Nb)||(prev&&prev.Nb)||null, setBy:by||(prev&&prev.setBy)||'', setAt:new Date().toISOString()};
  wr(K_SEL,o); emit(); return o; }
function publishRoster(o){
  o=o||{}; o._schema=S_ROS; o.schemaVersion=VER; o.producedAt=new Date().toISOString();
  var old=roster();
  if(old&&JSON.stringify(Object.assign({},old,{producedAt:0}))===JSON.stringify(Object.assign({},o,{producedAt:0}))) return old;
  if(!wr(K_ROS,o)) return null;
  var s=get();
  set((s&&s.index&&(!o.Nb||s.index<=o.Nb))?s.index:defaultIndex(o), o, (s&&s.setBy)||o.producer||'');
  return o; }
// Per-beam distributed dead load (klf) for the given beam, or the selected one.
function dl(index){
  var r=roster(), s=get(), b=beamOf(r,index==null?(s&&s.index):index);
  return b?{i:b.i,label:b.label,cls:b.cls,clsLabel:b.clsLabel,type:b.type,trib:+b.trib||0,
    dc1:+b.dc1||0,dc2:+b.dc2||0,dw:+b.dw||0,pl:+b.pl||0,selfWt:+b.selfWt||0}:null; }
// True when the caller's own girder count disagrees with the published roster.
function mismatch(nb){ var r=roster(); return (r&&r.Nb&&nb&&+nb!==+r.Nb)?{mine:+nb,roster:+r.Nb}:null; }
window.BridgeBeam={KEY_SEL:K_SEL,KEY_ROS:K_ROS,SCHEMA_SEL:S_SEL,SCHEMA_ROS:S_ROS,VERSION:VER,
  get:get,set:set,roster:roster,publishRoster:publishRoster,defaultIndex:defaultIndex,
  beamOf:beamOf,dl:dl,mismatch:mismatch,
  onChange:function(f){ subs.push(f); return function(){ var k=subs.indexOf(f); if(k>=0) subs.splice(k,1); }; },
  refresh:emit};
window.addEventListener('storage',function(e){ if(!e.key||e.key===K_SEL||e.key===K_ROS) emit(); });
/* Shared chip styling, injected here so every app renders the chip identically
   without any of them having to carry the rules in its own stylesheet. */
var css=".beamchip{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border:1px solid #c7d1db;"
 +"border-radius:999px;background:#f7f9fc;font:600 11px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;"
 +"color:#16212e;white-space:nowrap;vertical-align:middle}"
 +".beamchip .bc-k{color:#6b7a8c;text-transform:uppercase;letter-spacing:.06em;font-size:9.5px}"
 +".beamchip select{font:600 11px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;color:#1d4ed8;"
 +"border:1px solid #c7d1db;border-radius:5px;background:#fff;padding:1px 4px;max-width:250px;cursor:pointer}"
 +".beamchip .bc-v{color:#1d4ed8;font-weight:700}"
 +".beamchip .bc-warn{color:#b3261e;font-weight:700;font-size:9.5px}"
 +"@media print{.beamchip{border-color:#999;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}"
 +".beamchip select{border:none;-webkit-appearance:none;appearance:none}}";
var st=document.createElement('style'); st.textContent=css;
(document.head||document.documentElement).appendChild(st);
})();
  }

  /* ---- handoff: Bridge Suite shared-storage handoff (v1), MCT demands ---- */
  function handoff() {
(function(){
  var NS='bridgeSuite.v1';
  var SCHEMA='psbeam-external-demands';          // canonical shared id (both design apps accept)
  var K_HANDOFFS=NS+'.handoffs', K_LATEST=NS+'.latestId', K_UPDATED=NS+'.updatedAt';
  var KEEP_N=20, KEEP_DAYS=30;                   // hand-off pruning, see prune()
  function K_ADOPTED(app){ return NS+'.adopted.'+app; }
  function slug(s){ return (s==null?'':(''+s)).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'untitled'; }
  function lsOK(){ try{ var k='__bh_t'; localStorage.setItem(k,'1'); localStorage.removeItem(k); return true; }catch(e){ return false; } }
  function readMap(){ try{ return JSON.parse(localStorage.getItem(K_HANDOFFS)||'{}')||{}; }catch(e){ return {}; } }
  function verOf(p){ return (p&&p.schemaVersion!=null)?p.schemaVersion:((p&&p._version!=null)?p._version:1); }
  function stamp(p){
    var out={}; for(var k in p){ if(Object.prototype.hasOwnProperty.call(p,k)) out[k]=p[k]; }
    out._schema=SCHEMA;                                  // steelbeam export sets its own id — reset to shared
    out.schemaVersion=verOf(p);
    out.producer=p.generatedBy||p.producer||'MCT Generator';
    out.producedAt=p.generatedAt||p.producedAt||new Date().toISOString();
    var proj=p.project||'';
    var mem=(p.member&&(p.member.key||p.member.type))||'';
    out.handoffId=slug(proj)+'__'+slug(mem);
    return out;
  }
  /* The hand-off map was never cleaned, and every tool opened from file:// in
     Chrome/Edge shares one ~5 MB storage area (X-S8). On each publish, keep the
     newest KEEP_N entries that are at most KEEP_DAYS old (an entry with no
     readable date passes the age test but ranks last). Always kept, whatever
     their age: the entry being published, and the one the latest pointer names
     -- the only entry the design apps read, so the one a receiver may not have
     pulled yet. Entry format and keys are unchanged; only old entries go. */
  function prune(map,keep){
    var ids=Object.keys(map), cutoff=Date.now()-KEEP_DAYS*864e5, out={};
    ids.sort(function(a,b){ return String((map[b]||{}).producedAt||'').localeCompare(String((map[a]||{}).producedAt||'')); });
    ids.forEach(function(id,i){
      var t=Date.parse((map[id]||{}).producedAt||''), fresh=isNaN(t)||t>=cutoff;
      if(keep.indexOf(id)>=0||(i<KEEP_N&&fresh)) out[id]=map[id];
    });
    return out;
  }
  function publish(raw){
    if(!lsOK()) return {ok:false,reason:'localStorage unavailable'};
    var p=stamp(raw);
    try{
      var map=readMap(); map[p.handoffId]=p;
      map=prune(map,[p.handoffId,localStorage.getItem(K_LATEST)]);
      localStorage.setItem(K_HANDOFFS,JSON.stringify(map));
      localStorage.setItem(K_LATEST,p.handoffId);
      localStorage.setItem(K_UPDATED,p.producedAt);
      return {ok:true,handoffId:p.handoffId,payload:p};
    }catch(e){
      try{ if(window.BridgeApps&&window.BridgeApps.storageWarn) window.BridgeApps.storageWarn('the analysis hand-off',e); }catch(x){}
      return {ok:false,reason:e&&e.message||('storage error')};
    }
  }
  function tokenOf(p){ return p?((p.handoffId||'')+'@'+(p.producedAt||'')):''; }
  function readOne(id){
    if(!lsOK()) return null;
    var map=readMap(); var key=id||localStorage.getItem(K_LATEST);
    var p=key&&map[key]; if(!p) return null;
    return {id:key, version:verOf(p), token:tokenOf(p), payload:p};
  }
  function list(){
    var map=readMap();
    return Object.keys(map).map(function(k){ var p=map[k];
      return {id:p.handoffId, project:p.project, member:(p.member&&p.member.key)||'', at:p.producedAt, version:verOf(p)};
    }).sort(function(a,b){ return (b.at||'').localeCompare(a.at||''); });
  }
  function latestId(){ return lsOK()?localStorage.getItem(K_LATEST):null; }
  function adoptedId(app){ return lsOK()?localStorage.getItem(K_ADOPTED(app)):null; }
  function markAdopted(app,id){ try{ localStorage.setItem(K_ADOPTED(app),id); }catch(e){} }
  window.BridgeHandoff={ NS:NS, SCHEMA:SCHEMA, K_LATEST:K_LATEST, K_UPDATED:K_UPDATED,
    slug:slug, lsOK:lsOK, publish:publish, readOne:readOne, list:list,
    latestId:latestId, adoptedId:adoptedId, markAdopted:markAdopted, tokenOf:tokenOf };
})();
  }

  /* ---- geometry: Bridge Suite geometry change tracker (v1) ---- */
  function geometry() {
(function(){
  var NS='bridgeSuite.v1';
  var K_GEOM_CHANGES=NS+'.geometryChanges', K_GEOM_AT=NS+'.geometryChanges.updatedAt';
  function K_ADOPTED_GEOM(app){ return NS+'.geometryChanges.adopted.'+app; }
  function lsOK(){ try{ var k='__gct_t'; localStorage.setItem(k,'1'); localStorage.removeItem(k); return true; }catch(e){ return false; } }
  function publishGeometryChanges(changes){
    if(!lsOK() || !changes || changes.length===0) return {ok:false,reason:'no changes'};
    try{
      var payload={ schemaVersion:1, producer:'MCT Generator', producedAt:new Date().toISOString(), changes:changes };
      localStorage.setItem(K_GEOM_CHANGES,JSON.stringify(payload));
      localStorage.setItem(K_GEOM_AT,payload.producedAt);
      return {ok:true, payload:payload};
    }catch(e){ return {ok:false,reason:e&&e.message||'storage error'}; }
  }
  function readGeometryChanges(){
    if(!lsOK()) return null;
    try{ return JSON.parse(localStorage.getItem(K_GEOM_CHANGES)||'null'); }catch(e){ return null; }
  }
  function adoptedGeometryAt(app){ return lsOK()?localStorage.getItem(K_ADOPTED_GEOM(app)):null; }
  function markGeometryAdopted(app,at){ try{ localStorage.setItem(K_ADOPTED_GEOM(app),at); }catch(e){} }
  window.BridgeGeometryChanges={
    NS:NS, K_GEOM_CHANGES:K_GEOM_CHANGES, K_GEOM_AT:K_GEOM_AT,
    publishGeometryChanges:publishGeometryChanges, readGeometryChanges:readGeometryChanges,
    adoptedGeometryAt:adoptedGeometryAt, markGeometryAdopted:markGeometryAdopted
  };
})();
  }

  /* ---- registry: unified project registry, app paths (BridgeApps) and channel locks; boot(app) as each page did ---- */
  function registry(app) {
(function(){
  "use strict";
  var NS='bridgeSuite.v1', K_PROJ=NS+'.projects', K_CUR=NS+'.currentProjectId';
  function K_MIG(app){ return NS+'.migrated.'+app; }
  function lsOK(){ try{var k='__bp_t';localStorage.setItem(k,'1');localStorage.removeItem(k);return true;}catch(e){return false;} }
  function now(){ try{return new Date().toISOString();}catch(e){return '';} }
  function newId(){ return 'bp_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6); }
  function readReg(){ try{return JSON.parse(localStorage.getItem(K_PROJ)||'{}')||{};}catch(e){return {};} }
  function writeReg(r){ try{localStorage.setItem(K_PROJ,JSON.stringify(r));return true;}
    catch(e){ try{ if(window.BridgeApps&&window.BridgeApps.storageWarn) window.BridgeApps.storageWarn('the shared project',e); }catch(x){} return false;} }
  function raw(){ return readReg(); }
  function list(){ var r=readReg(); return Object.keys(r).map(function(id){var e=r[id];
    return {id:id,name:e.name,savedAt:e.savedAt,apps:Object.keys(e.slices||{}),hasDemands:!!e.demands};})
    .sort(function(a,b){return (b.savedAt||'').localeCompare(a.savedAt||'');}); }
  function get(id){ return readReg()[id]||null; }
  function getSlice(id,app){ var e=readReg()[id]; return (e&&e.slices&&e.slices[app]!=null)?e.slices[app]:null; }
  function saveSlice(id,name,app,data){
    if(!lsOK()) return null;
    var r=readReg();
    if(!id||!r[id]){ id=id||newId(); r[id]={name:name||'Untitled',savedAt:now(),slices:{}}; }
    if(name) r[id].name=name;
    if(!r[id].slices) r[id].slices={};
    r[id].slices[app]=data; r[id].savedAt=now();
    return writeReg(r)?id:null;
  }
  function setDemands(id,demands){ var r=readReg(); if(!r[id])return false; r[id].demands=demands; r[id].savedAt=now(); return writeReg(r); }
  function getDemands(id){ var e=readReg()[id]; return e?(e.demands||null):null; }
  function del(id){ var r=readReg(); delete r[id]; var ok=writeReg(r); if(current()===id) setCurrent(null); return ok; }
  function delSlice(id,app){ var r=readReg(); if(r[id]&&r[id].slices){ delete r[id].slices[app]; r[id].savedAt=now(); return writeReg(r); } return false; }
  function rename(id,name){ var r=readReg(); if(!r[id])return false; r[id].name=name; return writeReg(r); }
  function current(){ try{return localStorage.getItem(K_CUR)||null;}catch(e){return null;} }
  function setCurrent(id){ try{ if(id) localStorage.setItem(K_CUR,id); else localStorage.removeItem(K_CUR);}catch(e){} }
  function migrated(app){ try{return localStorage.getItem(K_MIG(app))==='1';}catch(e){return false;} }
  function setMigrated(app){ try{localStorage.setItem(K_MIG(app),'1');}catch(e){} }
  // Import an app's legacy { id:{name,savedAt,...} } library once; merge into shared projects by NAME.
  function migrate(app, legacyObj, pick){
    if(!lsOK()||migrated(app)){ return; }
    try{
      var r=readReg(), byName={};
      Object.keys(r).forEach(function(id){ byName[r[id].name]=id; });
      Object.keys(legacyObj||{}).forEach(function(lid){
        var le=legacyObj[lid]; if(!le) return;
        var name=le.name||'Untitled', id=byName[name];
        if(!id){ id=newId(); r[id]={name:name,savedAt:le.savedAt||now(),slices:{}}; byName[name]=id; }
        if(!r[id].slices) r[id].slices={};
        if(r[id].slices[app]==null){ var d=pick?pick(le):le; if(d!=null) r[id].slices[app]=d; }
        if(le.savedAt && (!r[id].savedAt || String(le.savedAt)>String(r[id].savedAt))) r[id].savedAt=le.savedAt;
      });
      writeReg(r); setMigrated(app);
    }catch(e){}
  }
  window.BridgeProjects={ NS:NS, K_PROJ:K_PROJ, K_CUR:K_CUR, ok:lsOK,
    raw:raw, list:list, get:get, getSlice:getSlice, saveSlice:saveSlice,
    setDemands:setDemands, getDemands:getDemands, del:del, delSlice:delSlice,
    rename:rename, current:current, setCurrent:setCurrent, migrate:migrate, migrated:migrated };
})();

/* ============================================================================
   SHARED APP PATHS  ·  bridgeSuite.v1.appPaths
   ----------------------------------------------------------------------------
   The three apps link to each other by bare file name: MCT frames "lldf.html" and
   opens "Prestressed Bridge Design.html" (app id psbeam; psbeam.html is its redirect
   page since 2026-10-22) in a new tab since 2026-10-22, every app's back link points
   at "index.html". That works only while each file is named exactly what
   the others expect. Rename one, keep a second download called
   "psbeam (1).html", or serve the folder from something that answers unknown
   paths with the index page, and a link lands on the wrong document -- or on a
   second copy of the app you were already in -- instead of failing loudly.

   So each app writes down where it actually lives the moment it is opened, and
   the others prefer that recorded path over the built-in guess. Open a file
   once, directly, and every link to it is right from then on, whatever it is
   called. A path the engineer types in by hand is pinned and outranks both.

   Sightings are filed BY FOLDER. The browser keeps one storage area for every
   local file on the machine, so a bare file name is not enough: opening an
   ST-Girder copy saved as "index.html" in some other folder used to tell the
   MCT in this folder that ST-Girder was "index.html" -- which, here, is the
   MCT itself. Now a sighting only answers for the folder it was made in, and
   no app will ever resolve a sibling to its own file name.

   This block is byte-identical in index.html / Prestressed Bridge Design.html /
   lldf.html. Edit one, edit all three. (ST-Girder left the suite on 2026-10-19;
   since 2026-10-22 it runs only inside Steel Bridge Design.html, GirderDetail's
   file, as its Design & Rating view, and stgirder.html was removed.)
   ========================================================================== */
(function(){
  var KEY='bridgeSuite.v1.appPaths';
  var DEF={mct:'index.html', psbeam:'Prestressed Bridge Design.html', lldf:'lldf.html'};
  var NAMES={mct:'MCT Generator', psbeam:'PS-Beam', lldf:'LL & DL Distribution'};
  var ME='';                                   // which app this file is, set by boot()
  var MAXDIRS=24;                              // folders remembered per app
  function read(){ try{ return JSON.parse(localStorage.getItem(KEY))||{}; }catch(e){ return {}; } }
  function write(o){ try{ localStorage.setItem(KEY,JSON.stringify(o)); return true; }catch(e){ storageWarn('the app-path record',e); return false; } }
  function now(){ return new Date().toISOString(); }
  /* A write to the shared browser storage that fails because the storage is
     FULL is shown, not swallowed (X-S8). Every tool opened from file:// in
     Chrome/Edge shares one ~5 MB area, so once it fills, every autosave and
     hand-off stops at once. One banner per page, one line per item; the other
     shared blocks reach it through window.BridgeApps.storageWarn. */
  var warned={};
  function isQuota(e){ return !!e&&(e.name==='QuotaExceededError'||e.name==='NS_ERROR_DOM_QUOTA_REACHED'||
    e.code===22||e.code===1014||/quota/i.test(String(e.message||''))); }
  function storageWarn(what,e){
    if(!isQuota(e)||warned[what]) return false;
    warned[what]=true;
    var show=function(){ try{
      var b=document.getElementById('bridgeStorageWarn');
      if(!b){
        b=document.createElement('div'); b.id='bridgeStorageWarn'; b.setAttribute('role','alert');
        b.style.cssText='position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483647;background:#fdecea;color:#7a1a12;'
          +'border:1px solid #b3261e;border-radius:6px;padding:8px 34px 8px 12px;font:13px/1.4 system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.25)';
        var x=document.createElement('button'); x.type='button'; x.textContent='\u00d7'; x.title='Dismiss'; x.setAttribute('aria-label','Dismiss');
        x.style.cssText='position:absolute;top:4px;right:6px;border:0;background:none;font-size:18px;line-height:1;cursor:pointer;color:#7a1a12';
        x.onclick=function(){ if(b.parentNode) b.parentNode.removeChild(b); };
        b.appendChild(x); document.body.appendChild(b);
      }
      var line=document.createElement('div');
      line.textContent='\u26a0 Browser storage is full: '+what+' was not saved. Export your work as JSON now, then delete old projects to free space.';
      b.appendChild(line);
    }catch(x){} };
    if(document.body) show(); else { try{ document.addEventListener('DOMContentLoaded',show); }catch(x){} }
    return true;
  }
  /* This app's own file name as the browser sees it. Decoded, because a name
     with a space arrives percent-encoded and the value is shown to a human. */
  function selfFile(){
    try{
      var last=(location.pathname||'').split('/').pop()||'';
      try{ last=decodeURIComponent(last); }catch(e){}
      return last;
    }catch(e){ return ''; }
  }
  /* The folder this file sits in, as a URL ending in "/". Every relative link
     between the apps resolves against it, so it is what a sighting must be
     filed under. */
  function selfDir(){
    try{
      var h=String(location.href||'').split('#')[0].split('?')[0];
      var i=h.lastIndexOf('/'); return i<0?'':h.slice(0,i+1);
    }catch(e){ return ''; }
  }
  function same(a,b){ return String(a||'').toLowerCase()===String(b||'').toLowerCase(); }
  function prune(at){
    var ks=Object.keys(at); if(ks.length<=MAXDIRS) return at;
    ks.sort(function(a,b){ return String((at[b]||{}).seenAt).localeCompare(String((at[a]||{}).seenAt)); });
    var out={}; ks.slice(0,MAXDIRS).forEach(function(k){ out[k]=at[k]; }); return out;
  }
  /* What is recorded for an app, for THIS folder. Entries written before
     sightings were filed by folder carry no folder at all; they are still
     honoured, since they were almost always made next door. */
  function entry(app){
    var o=read(), e=o[app]; if(!e) return null;
    var d=selfDir();
    if(e.at&&e.at[d]) return {file:e.at[d].file, pinned:!!e.at[d].pinned, legacy:false};
    if(e.file&&!e.dir) return {file:e.file, pinned:!!e.pinned, legacy:true};
    return null;
  }
  /* Record where this app lives. A sighting never overwrites a pin made for
     the same folder -- if the engineer said which file is PS-Beam, a stray
     copy does not get to argue. */
  function register(app){
    var f=selfFile(); if(!f||!NAMES[app]) return '';
    var d=selfDir(), o=read(), e=o[app]||{}, at=e.at||{}, cur=at[d];
    if(cur&&cur.pinned) return cur.file;
    if(cur&&cur.file===f&&e.dir===d) return f;
    at[d]={file:f, pinned:false, seenAt:now()};
    at=prune(at);
    // A pin from before folders were tracked keeps its place at the top level.
    o[app]=(e.pinned&&!e.dir)
      ? {file:e.file, pinned:true, seenAt:e.seenAt, at:at}
      : {file:f, pinned:false, seenAt:now(), dir:d, at:at};
    write(o); return f;
  }
  /* Point an app at a file for THIS folder (pinned unless told otherwise), or
     forget what this folder knows about it with an empty name. Refuses to
     point a sibling at this very file. */
  function set(app,file,pinned){
    if(!NAMES[app]) return false;
    var d=selfDir(), o=read(), e=o[app]||{}, at=e.at||{};
    var f=String(file||'').trim();
    if(f){
      if(ME&&app!==ME&&same(f,selfFile())) return false;
      var r={file:f, pinned:pinned!==false, seenAt:now()};
      at[d]=r;
      o[app]={file:f, pinned:r.pinned, seenAt:r.seenAt, dir:d, at:prune(at)};
    } else {
      delete at[d];
      if(!e.dir||e.dir===d){                  // the top level described this folder
        if(Object.keys(at).length) o[app]={at:at}; else delete o[app];
      } else o[app]=Object.assign({},e,{at:at});
    }
    return write(o);
  }
  function path(app){
    var e=entry(app), f=e&&e.file||'';
    // Never send a sibling link back to this same file: that is how the MCT
    // ended up framing a second copy of itself under the ST-Girder button.
    if(f&&ME&&app!==ME&&same(f,selfFile())) f='';
    return f||DEF[app]||'';
  }
  function info(app){ var e=entry(app);
    return {app:app, name:NAMES[app]||app, file:path(app),
      pinned:!!(e&&e.pinned), known:!!(e&&e.file)}; }
  function all(){ var out={}; Object.keys(NAMES).forEach(function(k){ out[k]=info(k); }); return out; }
  /* Tell whoever framed us who we are, so a wrong file is caught and named
     rather than silently displayed. Repeated for a couple of seconds because a
     parent that has just created the iframe may not have its listener up yet,
     and a heavy app may not reach this line until well after the frame exists. */
  function announce(app){
    if(!NAMES[app]) return;
    var msg={source:'bridge-suite', hello:app, file:selfFile(), title:NAMES[app]};
    var send=function(){ try{ if(window.self!==window.top) window.parent.postMessage(msg,'*'); }catch(e){} };
    send();
    try{ if(document.readyState!=='complete') window.addEventListener('load',send); }catch(e){}
    var n=0, t=setInterval(function(){ send(); if(++n>=8) clearInterval(t); },400);
    // ...and then answer forever. The burst above only covers the first ~3 s after
    // this frame boots; if the parent missed every one of those hellos -- its
    // listener or the frame ref was not up yet, the file came off OneDrive slowly,
    // or the tab was in the background -- a single miss used to be permanent, and
    // the parent would drop a full-screen "Could not open" over an app that had in
    // fact loaded and was working. This standing listener lets the parent re-ask at
    // any time with a {whois:true} ping, so the handshake self-heals instead of
    // requiring a full reload of the suite.
    // Only the page framing this one, the window that opened it, or a frame
    // this window holds may ask (X-S10; same rule as the abutment / EDM links).
    var asker=function(src){
      if(!src) return false;
      try{
        if(window.parent!==window&&src===window.parent) return true;
        if(window.opener&&src===window.opener) return true;
        for(var i=0;i<window.frames.length;i++) if(window.frames[i]===src) return true;
      }catch(x){}
      return false;
    };
    try{ window.addEventListener('message',function(e){
      var d=e&&e.data; if(d&&d.source==='bridge-suite'&&d.whois&&asker(e.source)) send();
    }); }catch(e){}
  }
  function boot(app){ if(NAMES[app]) ME=app; register(app); announce(app); }
  /* Where to send the browser for a sibling app, honouring the recorded path. */
  function href(app){ return path(app); }
  window.BridgeApps={ KEY:KEY, DEFAULTS:DEF, NAMES:NAMES, selfFile:selfFile, selfDir:selfDir,
    register:register, announce:announce, boot:boot, set:set, path:path, href:href,
    info:info, all:all, storageWarn:storageWarn };
})();

try{ window.BridgeApps.boot(app); }catch(e){}

/* ============================================================================
   SHARED CHANNEL LOCKS  ·  bridgeSuite.v1.locks
   ----------------------------------------------------------------------------
   A "lock" is a standing subscription to a shared channel. While a channel is
   LOCKED, every app that consumes it adopts new values the moment they are
   published, shows the affected inputs read-only (driven by the producing app),
   and records what changed. While a channel is UNLOCKED the old behaviour
   applies: an orange "data available" badge that the engineer clicks to adopt.

   Lock state is shared across all three apps — locking the distribution-factor
   channel anywhere locks it everywhere. Each consuming app keeps its own
   private snapshot of the values it held at the moment of locking, so that
   unlocking can hand the engineer's own numbers back.

   State language used by the shared CSS below:
     none   grey    no shared data for this channel yet
     avail  ORANGE  data is published and differs from what this app holds
     live   ORANGE  locked — auto-adopting, inputs read-only
     warn   AMBER   locked but the payload failed a check; nothing was applied

   This block is byte-identical in all three apps. Edit it in one place and
   re-inject; do not patch a single copy.
   ========================================================================== */
(function(){
  "use strict";
  var NS='bridgeSuite.v1';
  var K_LOCK=NS+'.locks', K_LOG=NS+'.syncLog', K_SNAP=NS+'.lockSnap';
  var VER=1, LOG_CAP=300;

  /* Channel registry. `key` is the storage key the channel's payload lives in,
     `at` the companion timestamp key (null when the payload carries its own
     producedAt only). `producer` is informational — '*' means any app may
     publish. `fields` is the human list shown in the lock tooltip. */
  var CHANNELS={
    lldf:      {label:'Distribution factors', short:'DFs',       producer:'LL & DL Distribution',
                key:NS+'.lldf',            at:NS+'.lldf.updatedAt',
                fields:'g_M (+M and −M), g_V, fatigue DF'},
    dlLoads:   {label:'Dead loads',           short:'DL',        producer:'LL & DL Distribution',
                key:NS+'.dlLoads',         at:null,
                fields:'DC1, DC2, DW, pedestrian LL, tributary width'},
    /* Points at .lldfGeom, the structured MCT -> LL & DL layout payload, NOT at
       .geometryChanges. The latter is a human-readable diff ("Span Lengths:
       3 span(s) -> 4 span(s)") whose adopt handler in the design apps only
       logs; there is nothing there to auto-apply, so locking it would promise
       an update it cannot deliver. .lldfGeom carries real numbers and has a
       real consumer. */
    geometry:  {label:'Bridge geometry',      short:'Geometry',  producer:'*',
                key:NS+'.lldfGeom',        at:null,
                fields:'span lengths, girder count, spacing, skew, deck, overhang'},
    psSection: {label:'Section properties',   short:'Section',   producer:'PS-Beam',
                key:NS+'.psSection',       at:null,
                fields:'A, I (composite), S_b / S_t, and box b / J from the girder design'},
    materials: {label:'Materials',            short:'Materials', producer:'*',
                key:NS+'.materials',       at:null,
                fields:"deck f'c, girder f'c / Fy, unit weights, modular ratio"},
    capacity:  {label:'Capacity',             short:'Capacity',  producer:'*',
                key:NS+'.capacity',        at:NS+'.capacity.updatedAt',
                fields:'φMn, φVn envelopes'},
    project:   {label:'Project info',         short:'Project',   producer:'*',
                key:NS+'.projectMeta',     at:null,
                fields:'project name, bridge ID, prepared by, date, job number'},
    /* The analysis hand-off, MCT -> PS-Beam (ST-Girder no longer reads it,
       2026-10-19). `key` is the whole
       handoff map rather than one payload, so it carries no producedAt of its
       own: hasData() only needs to know the map is non-empty, and the timestamp
       comes from the companion key BridgeHandoff already maintains. Single
       producer, so drives() has nothing to arbitrate here. */
    demands:   {label:'Analysis demands',      short:'Demands',   producer:'MCT Generator',
                key:NS+'.handoffs',        at:NS+'.updatedAt',
                fields:'per-station M and V envelopes, member layout, live-load type'}
  };

  /* App id -> short display name, used to attribute change-log rows and to
     name the app in the suite panel header. */
  var APPS={mct:'MCT', psbeam:'PS-Beam', lldf:'LL & DL'};

  /* Default channel order for the suite panel: the two the LL & DL app drives
     first (they are the ones engineers lock day to day), then the rest. */
  var PANEL_ORDER=['lldf','dlLoads','demands','geometry','psSection','materials','capacity','project'];

  function lsOK(){ try{ var k='__bl_t'; localStorage.setItem(k,'1'); localStorage.removeItem(k); return true; }catch(e){ return false; } }
  function rd(k){ try{ var s=localStorage.getItem(k); return s?JSON.parse(s):null; }catch(e){ return null; } }
  function wr(k,o){ try{ localStorage.setItem(k,JSON.stringify(o)); return true; }catch(e){ return false; } }

  /* ---------- lock registry ---------- */
  function all(){
    var r=rd(K_LOCK);
    if(!r||typeof r!=='object'||!r.channels) r={schemaVersion:VER,channels:{},updatedAt:null};
    return r;
  }
  function isLocked(ch){ var r=all().channels[ch]; return !!(r&&r.locked); }
  function lockInfo(ch){ return all().channels[ch]||null; }
  function setLock(ch,on,by){
    if(!CHANNELS[ch]) return false;
    if(!lsOK()) return false;
    var r=all();
    r.channels[ch]={locked:!!on, by:by||'', at:new Date().toISOString()};
    r.schemaVersion=VER; r.updatedAt=r.channels[ch].at;
    if(!wr(K_LOCK,r)) return false;
    emit(ch,!!on);
    return true;
  }
  /* Which app is allowed to auto-publish this channel while it is locked.

     `capacity` and `geometry` each have more than one possible producer
     (any app may publish capacity; MCT and PS-Beam for
     geometry). If every producer with a tab open republished on the lock, two
     tabs would overwrite each other on every keystroke and the consumer would
     see an endless alternating toast. So exactly one app drives: the one that
     took the lock, or — when the lock was taken from the consuming side, so
     that `by` names an app that cannot publish this channel at all — whichever
     app produced the payload currently sitting on it.

     The two tests can both pass for one round, if app A's payload is on the
     channel and app B takes the lock. That settles itself: B's first publish
     stamps its own name on the payload, A's producer test then fails, and A
     goes quiet. Taking the lock from B is an explicit "use B's numbers", so
     B winning is the right outcome.

     `me` is this app's id; `myName` is the string this app writes into
     payload.producer. */
  function drives(ch,me,myName){
    var i=lockInfo(ch); if(!i||!i.locked) return false;
    if(i.by===me) return true;
    var p=payload(ch);
    return !!(p&&myName&&p.producer===myName);
  }
  function lock(ch,by){ return setLock(ch,true,by); }
  function unlock(ch,by){ return setLock(ch,false,by); }
  function toggle(ch,by){ return setLock(ch,!isLocked(ch),by); }

  /* ---------- pre-lock snapshots (per consuming app) ---------- */
  function snapKey(app){ return K_SNAP+'.'+app; }
  function saveSnap(app,ch,obj){
    var s=rd(snapKey(app))||{};
    s[ch]={at:new Date().toISOString(),data:obj};
    wr(snapKey(app),s);
  }
  function peekSnap(app,ch){ var s=rd(snapKey(app)); return (s&&s[ch])?s[ch]:null; }
  function takeSnap(app,ch){
    var s=rd(snapKey(app)); if(!s||!s[ch]) return null;
    var v=s[ch]; delete s[ch]; wr(snapKey(app),s); return v;
  }

  /* ---------- change log ----------
     Sharded one key per app rather than one shared array, because two tabs
     adopting the same publish in the same instant would otherwise both
     read-modify-write the single key and the slower writer would silently
     drop the faster one's entry. Each app owns its shard; logs() merges. */
  var LOG_APPS=['mct','psbeam','lldf'];
  function logKey(app){ return K_LOG+'.'+(app||'app'); }
  function logShard(app){ var a=rd(logKey(app)); return Array.isArray(a)?a:[]; }
  function logApps(){
    var i=rd(K_LOG+'.index'), out=LOG_APPS.slice();
    if(Array.isArray(i)) i.forEach(function(a){ if(out.indexOf(a)<0) out.push(a); });
    return out;
  }
  function logs(){
    var out=[];
    logApps().forEach(function(app){ logShard(app).forEach(function(e){ out.push(e); }); });
    var old=rd(K_LOG); if(Array.isArray(old)) old.forEach(function(e){ out.push(e); });  // pre-shard entries
    out.sort(function(a,b){ var x=a.at||'', y=b.at||''; return x<y?1:(x>y?-1:0); });
    if(out.length>LOG_CAP) out.length=LOG_CAP;
    return out;
  }
  function log(entry){
    if(!lsOK()) return null;
    entry=entry||{};
    entry.at=new Date().toISOString();
    var app=entry.app||'app';
    var a=logShard(app);
    a.unshift(entry);
    if(a.length>LOG_CAP) a.length=LOG_CAP;
    wr(logKey(app),a);
    if(LOG_APPS.indexOf(app)<0){
      var idx=rd(K_LOG+'.index'); if(!Array.isArray(idx)) idx=[];
      if(idx.indexOf(app)<0){ idx.push(app); wr(K_LOG+'.index',idx); }
    }
    emitLog();
    return entry;
  }
  function clearLogs(){ logApps().forEach(function(app){ wr(logKey(app),[]); }); wr(K_LOG,[]); emitLog(); }

  /* Build a readable one-line delta list from two flat objects.
     labels maps key -> human name; digits maps key -> decimal places. */
  function deltas(before,after,labels,digits){
    var out=[];
    before=before||{}; after=after||{}; labels=labels||{}; digits=digits||{};
    Object.keys(after).forEach(function(k){
      var a=before[k], b=after[k];
      if(a==null&&b==null) return;
      var na=+a, nb=+b, num=isFinite(na)&&isFinite(nb);
      var d=digits[k]==null?3:digits[k];
      if(num){ if(Math.abs(na-nb)<Math.pow(10,-(d+1))) return; }
      else if(String(a)===String(b)) return;
      out.push({key:k, label:labels[k]||k,
        from:num?(a==null?'—':(+a).toFixed(d)):(a==null?'—':String(a)),
        to:  num?(b==null?'—':(+b).toFixed(d)):(b==null?'—':String(b))});
    });
    return out;
  }
  function deltaText(ds){
    return ds.map(function(d){ return d.label+' '+d.from+' → '+d.to; }).join(', ');
  }

  /* ---------- subscriptions ---------- */
  var subs=[], logSubs=[];
  function emit(ch,on){ subs.slice().forEach(function(f){ try{ f(ch,on,all()); }catch(e){} }); }
  function emitLog(){ logSubs.slice().forEach(function(f){ try{ f(logs()); }catch(e){} }); }
  function onChange(f){ subs.push(f); return function(){ var i=subs.indexOf(f); if(i>=0) subs.splice(i,1); }; }
  function onLog(f){ logSubs.push(f); return function(){ var i=logSubs.indexOf(f); if(i>=0) logSubs.splice(i,1); }; }
  window.addEventListener('storage',function(e){
    if(!e.key) { emit(null,null); emitLog(); return; }
    if(e.key===K_LOCK) emit(null,null);
    else if(e.key===K_LOG||e.key.indexOf(K_LOG+'.')===0) emitLog();
  });

  /* ---------- payload freshness ---------- */
  /* Returns the producedAt of a channel's current payload, or null. */
  function producedAt(ch){
    var c=CHANNELS[ch]; if(!c) return null;
    var p=rd(c.key);
    if(p&&p.producedAt) return p.producedAt;
    if(c.at){ try{ return localStorage.getItem(c.at)||null; }catch(e){} }
    return null;
  }
  function payload(ch){ var c=CHANNELS[ch]; return c?rd(c.key):null; }
  /* An empty object does not count. `demands` points at the whole handoff map,
     which BridgeHandoff initialises to {} long before anything is published;
     without this test the suite panel would offer a lock on an empty channel. */
  function hasData(ch){
    var p=payload(ch);
    if(!p) return false;
    if(typeof p==='object'&&!Array.isArray(p)&&Object.keys(p).length===0) return false;
    if(Array.isArray(p)&&!p.length) return false;
    return true;
  }
  function ago(iso){
    if(!iso) return '';
    var t=Date.parse(iso); if(!isFinite(t)) return '';
    var s=Math.max(0,Math.round((Date.now()-t)/1000));
    if(s<45) return 'just now';
    if(s<5400) return Math.round(s/60)+' min ago';
    if(s<172800) return Math.round(s/3600)+' h ago';
    return Math.round(s/86400)+' d ago';
  }

  /* Resolve the four-state badge for a channel from this app's point of view.
     `adoptedTok` is whatever token the app stores to remember what it adopted
     (usually the producedAt it last applied); pass null if the app has none. */
  function state(ch,adoptedTok){
    if(isLocked(ch)) return 'live';
    var pa=producedAt(ch);
    if(!pa) return 'none';
    if(adoptedTok && String(adoptedTok)===String(pa)) return 'none';
    return 'avail';
  }

  /* ---------- toast ---------- */
  var tHost=null;
  function host(){
    if(tHost&&tHost.isConnected) return tHost;
    tHost=document.createElement('div');
    tHost.className='bl-toasts';
    (document.body||document.documentElement).appendChild(tHost);
    return tHost;
  }
  function toast(title,body,kind,ms){
    try{
      var el=document.createElement('div');
      el.className='bl-toast'+(kind?' '+kind:'');
      var h=document.createElement('div'); h.className='bl-toast-t'; h.textContent=title||'';
      el.appendChild(h);
      if(body){ var b=document.createElement('div'); b.className='bl-toast-b'; b.textContent=body; el.appendChild(b); }
      var x=document.createElement('button'); x.className='bl-toast-x'; x.type='button';
      x.setAttribute('aria-label','Dismiss'); x.textContent='×';
      x.onclick=function(){ if(el.parentNode) el.parentNode.removeChild(el); };
      el.appendChild(x);
      host().appendChild(el);
      var life=ms==null?7000:ms;
      if(life>0) setTimeout(function(){
        el.classList.add('out');
        setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); },380);
      },life);
      return el;
    }catch(e){ return null; }
  }

  /* ---------- shared styling ----------
     Injected here so every app renders the lock controls, the orange
     "available" state and the toasts identically without carrying the rules
     in its own stylesheet. */
  var CSS=
   /* cross-app link button, four states */
   ".xlink{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:8px;"
  +"border:1px solid #c7d1db;background:#f7f9fc;color:#33455c;cursor:pointer;"
  +"font:600 11.5px/1.3 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;"
  +"white-space:nowrap;vertical-align:middle;transition:background .13s,border-color .13s,box-shadow .13s}"
  +".xlink:hover{background:#eef2f7;border-color:#aab8c8}"
  +".xlink:disabled{opacity:.5;cursor:not-allowed}"
  +".xlink .xdot{width:7px;height:7px;border-radius:50%;background:#b6c2d0;flex:none}"
  +/* ORANGE — data waiting to be adopted */
   ".xlink.avail{border-color:#f59e0b;background:#fff7ed;color:#9a3412;box-shadow:0 0 0 3px rgba(245,158,11,.16)}"
  +".xlink.avail:hover{background:#ffedd5;border-color:#ea580c}"
  +".xlink.avail .xdot{background:#f59e0b;animation:blpulse 1.9s ease-in-out infinite}"
  +/* ORANGE SOLID — locked and live */
   ".xlink.live{border-color:#c2410c;background:#ea580c;color:#fff;box-shadow:0 1px 2px rgba(194,65,12,.35)}"
  +".xlink.live:hover{background:#c2410c;border-color:#9a3412}"
  +".xlink.live .xdot{background:#ffe8d5}"
  +/* AMBER STRIPE — locked but the payload did not pass */
   ".xlink.warn{border-color:#b45309;color:#7c2d12;"
  +"background:repeating-linear-gradient(135deg,#fef3c7 0 7px,#fde68a 7px 14px)}"
  +".xlink.warn .xdot{background:#b45309}"
  +"@keyframes blpulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.82)}}"
  +/* padlock glyph */
   ".xlink .xlk{font-size:12px;line-height:1;flex:none}"
   /* inputs that a lock has taken over */
  +".bl-driven{background:#fff7ed !important;border-color:#f59e0b !important;color:#7c2d12 !important;"
  +"cursor:not-allowed !important;box-shadow:inset 3px 0 0 #ea580c !important}"
  +".bl-driven:focus{outline:none !important}"
  +".bl-src{display:block;margin-top:3px;font:600 10px/1.35 ui-sans-serif,system-ui,sans-serif;color:#c2410c;letter-spacing:.01em}"
  +".bl-src::before{content:'\\1F512';margin-right:4px;font-weight:400}"
   /* lock strip that sits above a group of driven fields */
  +".bl-strip{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:0 0 10px;padding:7px 11px;"
  +"border:1px solid #f59e0b;border-left-width:4px;border-radius:8px;background:#fff7ed;"
  +"font:500 11.5px/1.45 ui-sans-serif,system-ui,sans-serif;color:#7c2d12}"
  +".bl-strip.live{border-color:#c2410c;background:#ffedd5}"
  +".bl-strip b{color:#9a3412}"
  +".bl-strip .sp{flex:1 1 auto}"
   /* toasts */
  +".bl-toasts{position:fixed;right:16px;bottom:16px;z-index:99999;display:flex;flex-direction:column;"
  +"gap:8px;max-width:min(380px,calc(100vw - 32px));pointer-events:none}"
  +".bl-toast{position:relative;pointer-events:auto;padding:10px 30px 11px 12px;border-radius:10px;"
  +"border:1px solid #c2410c;border-left-width:4px;background:#fff;color:#1f2937;"
  +"box-shadow:0 8px 24px rgba(15,23,42,.16);animation:blin .22s ease-out}"
  +".bl-toast.warn{border-color:#b45309;background:#fffbeb}"
  +".bl-toast.out{opacity:0;transform:translateY(6px);transition:opacity .35s,transform .35s}"
  +".bl-toast-t{font:700 12px/1.4 ui-sans-serif,system-ui,sans-serif;color:#9a3412}"
  +".bl-toast-b{margin-top:3px;font:500 11.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#334155;"
  +"word-break:break-word}"
  +".bl-toast-x{position:absolute;top:5px;right:6px;width:20px;height:20px;border:0;background:transparent;"
  +"color:#94a3b8;font-size:16px;line-height:1;cursor:pointer;border-radius:5px}"
  +".bl-toast-x:hover{background:#f1f5f9;color:#475569}"
  +"@keyframes blin{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}"
   /* change-log panel */
  +".bl-log{border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;background:#fff}"
  +".bl-log-h{display:flex;align-items:center;gap:8px;padding:8px 11px;background:#f8fafc;"
  +"border-bottom:1px solid #e2e8f0;font:700 11.5px/1.3 ui-sans-serif,system-ui,sans-serif;color:#334155}"
  +".bl-log-b{max-height:230px;overflow:auto}"
  +".bl-row{display:flex;gap:9px;padding:7px 11px;border-bottom:1px solid #f1f5f9;"
  +"font:500 11px/1.5 ui-sans-serif,system-ui,sans-serif}"
  +".bl-row:last-child{border-bottom:0}"
  +".bl-row .t{flex:none;width:52px;color:#94a3b8;font-variant-numeric:tabular-nums}"
  +".bl-row .c{flex:none;width:74px;font-weight:700;color:#c2410c}"
  +".bl-row .a{flex:none;width:66px;color:#64748b;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;"
  +"overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
  +".bl-row .d{flex:1 1 auto;color:#334155;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-word}"
  +".bl-empty{padding:14px 11px;color:#94a3b8;font:500 11.5px/1.4 ui-sans-serif,system-ui,sans-serif;text-align:center}"
   /* suite status panel */
  +".bl-panel{border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;background:#fff}"
  +".bl-panel .bl-log{border:0;border-radius:0;border-top:1px solid #e2e8f0}"
  +".bl-ph{display:flex;align-items:center;gap:8px;padding:8px 11px;background:#fff7ed;"
  +"border-bottom:1px solid #fed7aa;font:700 11.5px/1.3 ui-sans-serif,system-ui,sans-serif;color:#9a3412}"
  +".bl-ch{display:flex;align-items:center;gap:9px;padding:6px 11px;border-bottom:1px solid #f1f5f9;"
  +"font:500 11.5px/1.4 ui-sans-serif,system-ui,sans-serif}"
  +".bl-ch:last-child{border-bottom:0}"
  +".bl-ch .n{flex:none;width:118px;font-weight:600;color:#1e293b}"
  +".bl-ch .p{flex:1 1 auto;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
  +".bl-ch .w{flex:none;color:#94a3b8;font-variant-numeric:tabular-nums;font-size:10.5px}"
  +".bl-ch.on{background:#fff7ed}"
  +".bl-ch.on .n{color:#9a3412}"
  /* floating suite drawer — the panel is cross-cutting, so it does not belong
     inside any one app's card layout */
  +".bl-fab{position:fixed;right:18px;bottom:18px;z-index:9998;display:flex;align-items:center;gap:7px;"
  +"padding:9px 14px;border:1px solid #cbd5e1;border-radius:999px;background:#fff;color:#475569;cursor:pointer;"
  +"font:600 12px/1 ui-sans-serif,system-ui,sans-serif;box-shadow:0 3px 12px rgba(15,23,42,.14)}"
  +".bl-fab:hover{border-color:#94a3b8}"
  +".bl-fab.on{background:#ea580c;border-color:#ea580c;color:#fff;box-shadow:0 3px 14px rgba(234,88,12,.38)}"
  +".bl-fab .b{padding:1px 7px;border-radius:999px;background:#f1f5f9;color:#475569;font-size:11px}"
  +".bl-fab.on .b{background:rgba(255,255,255,.24);color:#fff}"
  +".bl-draw{position:fixed;right:18px;bottom:66px;z-index:9999;width:420px;max-width:calc(100vw - 36px);"
  +"max-height:calc(100vh - 96px);overflow:auto;border-radius:12px;background:#fff;"
  +"box-shadow:0 12px 40px rgba(15,23,42,.26);border:1px solid #e2e8f0}"
  +".bl-draw .bl-panel{border:0}"
  +"@media print{.bl-fab,.bl-draw{display:none!important}}";

  try{
    var st=document.createElement('style');
    st.setAttribute('data-bridge-locks','1');
    st.appendChild(document.createTextNode(CSS));
    (document.head||document.documentElement).appendChild(st);
  }catch(e){}

  /* ---------- React UI kit ----------
     Called from each app's babel block as BridgeLocks.ui(React); returns the
     shared components so the markup is identical everywhere. */
  function ui(React){
    if(!React) return null;
    var h=React.createElement;

    /* The lock button. Props:
         ch        channel id
         app       this app's id (recorded as the locker)
         st        optional state override ('none'|'avail'|'live'|'warn')
         onAdopt   called when clicked while unlocked and data is available
         onLock    called with (true) after locking / (false) after unlocking
         label     optional text override
         compact   render icon-only */
    function LockBtn(p){
      var locked=isLocked(p.ch);
      var s=p.st||state(p.ch,p.adopted);
      var c=CHANNELS[p.ch]||{label:p.ch,short:p.ch,fields:''};
      var when=ago(producedAt(p.ch));
      var title;
      if(s==='live') title='LOCKED to '+c.producer+' — '+c.fields+' update automatically and cannot be edited here. Click to unlock and take manual control.';
      else if(s==='avail') title='New '+c.label.toLowerCase()+' available'+(when?' ('+when+')':'')+' — '+c.fields+'. Click to adopt once, or lock to follow it from now on.';
      else if(s==='warn') title='Locked, but the last payload failed a check — nothing was applied. Click for detail.';
      else title='No '+c.label.toLowerCase()+' published yet.';
      var txt=p.label!=null?p.label:(locked?('Locked · '+c.short):(s==='avail'?('Adopt '+c.short):c.short));
      // data-ch makes the channel visible in the DOM: without it a padlock is
      // just another .xlink button, and anything selecting one -- a test, a
      // devtools poke -- has to guess from the label text.
      return h('button',{type:'button',className:'xlink '+s,title:title,'data-ch':p.ch,
        disabled:!!p.disabled||(s==='none'&&!locked&&!p.always),
        onClick:function(e){
          e&&e.preventDefault&&e.preventDefault();
          if(p.onClick) return p.onClick(s,locked);
          if(locked){ if(p.onLock) p.onLock(false); }
          else if(p.onAdopt) p.onAdopt();
        }},
        h('span',{className:'xdot'}),
        locked?h('span',{className:'xlk'},'🔒'):null,
        p.compact?null:h('span',null,txt));
    }

    /* Separate padlock toggle to sit beside an adopt button. */
    function LockToggle(p){
      var locked=isLocked(p.ch);
      var c=CHANNELS[p.ch]||{label:p.ch,short:p.ch,fields:''};
      return h('button',{type:'button',className:'xlink '+(locked?'live':''),'data-ch':p.ch,
        title:locked
          ?('Following '+c.producer+' automatically. Click to unlock — your values from before the lock are restored.')
          :('Lock to '+c.producer+': '+c.fields+' will update automatically from now on and become read-only here.'),
        onClick:function(e){ e&&e.preventDefault&&e.preventDefault(); if(p.onToggle) p.onToggle(!locked); }},
        h('span',{className:'xlk'},locked?'🔒':'🔓'),
        p.compact?null:h('span',null,locked?'Locked':'Lock'));
    }

    /* Orange strip shown above a group of driven inputs. */
    function DrivenStrip(p){
      var c=CHANNELS[p.ch]||{label:p.ch,producer:'',fields:''};
      return h('div',{className:'bl-strip live'},
        h('span',{className:'xlk'},'🔒'),
        h('span',null,h('b',null,c.label),' locked to ',h('b',null,c.producer),
          p.detail?(' · '+p.detail):'',
          ' — these fields update automatically and are read-only.'),
        h('span',{className:'sp'}),
        h('button',{type:'button',className:'xlink',onClick:p.onUnlock,
          title:'Unlock and restore the values you had before locking.'},
          h('span',{className:'xlk'},'🔓'),h('span',null,'Unlock')));
    }

    /* Session change log. */
    function SyncLog(p){
      var rows=(p&&p.rows)||logs();
      var only=p&&p.channel;
      if(only) rows=rows.filter(function(r){ return r.channel===only; });
      var lim=(p&&p.limit)||60;
      rows=rows.slice(0,lim);
      return h('div',{className:'bl-log'},
        h('div',{className:'bl-log-h'},
          h('span',{className:'xlk'},'🕒'),
          h('span',null,(p&&p.title)||'Auto-sync log'),
          h('span',{style:{flex:'1 1 auto'}}),
          rows.length?h('button',{type:'button',className:'xlink',
            onClick:function(){ clearLogs(); if(p&&p.onClear) p.onClear(); }},'Clear'):null),
        h('div',{className:'bl-log-b'},
          rows.length?rows.map(function(r,i){
            return h('div',{className:'bl-row',key:i},
              h('span',{className:'t'},(r.at||'').slice(11,16)),
              h('span',{className:'c'},(CHANNELS[r.channel]&&CHANNELS[r.channel].short)||r.channel||'—'),
              h('span',{className:'a',title:r.app||''},APPS[r.app]||r.app||''),
              h('span',{className:'d'},r.text||''));
          }):h('div',{className:'bl-empty'},'Nothing has auto-updated yet.')));
    }

    /* Suite status panel: every channel, who produces it, whether this browser
       is following it, and how fresh the payload is — plus the change log.
       Props: app, order (channel ids), onToggle(ch,on), title, log:false. */
    function SuitePanel(p){
      p=p||{};
      var order=p.order||PANEL_ORDER;
      return h('div',{className:'bl-panel'},
        h('div',{className:'bl-ph'},
          h('span',{className:'xlk'},'⇄'),
          h('span',null,p.title||'Hand-off locks'),
          h('span',{style:{flex:'1 1 auto'}}),
          h('span',{style:{fontWeight:500,color:'#c2410c'}},
            order.filter(isLocked).length+' of '+order.length+' locked')),
        order.map(function(ch){
          var c=CHANNELS[ch]||{label:ch,producer:'',short:ch};
          var on=isLocked(ch), pa=producedAt(ch), any=hasData(ch);
          return h('div',{className:'bl-ch'+(on?' on':''),key:ch},
            h('span',{className:'n'},c.label),
            h('span',{className:'p',title:c.fields},
              any?('from '+(c.producer==='*'?'the suite':c.producer)):'not published yet'),
            h('span',{className:'w'},pa?ago(pa):''),
            h(LockBtn,{ch:ch,compact:true,always:true,
              onClick:function(st,locked){ if(p.onToggle) p.onToggle(ch,!locked); else if(locked) unlock(ch,p.app); else if(any) lock(ch,p.app); }}));
        }),
        p.log===false?null:h(SyncLog,{limit:p.limit||40,title:'Recent auto-updates'}));
    }

    /* Hook: re-render on any lock change or log append. */
    function useLocks(){
      var st=React.useState(0), n=st[0], set=st[1];
      React.useEffect(function(){
        var a=onChange(function(){ set(function(v){return v+1;}); });
        var b=onLog(function(){ set(function(v){return v+1;}); });
        return function(){ a(); b(); };
      },[]);
      return n;
    }

    return {LockBtn:LockBtn, LockToggle:LockToggle, DrivenStrip:DrivenStrip,
            SyncLog:SyncLog, SuitePanel:SuitePanel, useLocks:useLocks};
  }

  /* ---------- vanilla-DOM lock control ----------
     For the apps that are not React (LL & DL Distribution). Give it an existing
     <button> and it keeps that button's class, label and tooltip in sync with
     the channel's state; returns a detach function.
       el       the button element
       ch       channel id
       app      this app's id
       labels   {none,avail,live,warn} text overrides (optional)
       onClick  fn(state, locked) — your own handler
       onToggle fn(nextLocked) — called when the padlock half is clicked */
  function bindBtn(o){
    var el=o.el; if(!el) return function(){};
    var c=CHANNELS[o.ch]||{label:o.ch,short:o.ch,fields:'',producer:''};
    var lab=o.labels||{};
    function paint(){
      var locked=isLocked(o.ch), s=o.stateFn?o.stateFn():state(o.ch,o.adopted&&o.adopted());
      el.className=(o.baseClass||'xlink')+' '+s;
      var when=ago(producedAt(o.ch));
      el.title=(s==='live')
        ? ('LOCKED — '+c.fields+' publish automatically to the other apps. Click to unlock.')
        : (s==='avail')
          ? (c.label+' ready to send'+(when?' (updated '+when+')':'')+' — '+c.fields)
          : (s==='warn') ? 'Locked, but the last publish failed a check.'
          : (lab.noneTip||('No '+c.label.toLowerCase()+' to send yet.'));
      var t=(s==='live')?(lab.live||('🔒 Auto-sending '+c.short)):
            (s==='avail')?(lab.avail||('Send '+c.short)):
            (s==='warn')?(lab.warn||('⚠ '+c.short)):(lab.none||('Send '+c.short));
      el.textContent=t;
    }
    function click(e){
      e&&e.preventDefault&&e.preventDefault();
      if(o.onClick) o.onClick(state(o.ch,o.adopted&&o.adopted()),isLocked(o.ch));
    }
    el.addEventListener('click',click);
    var off=onChange(paint);
    paint();
    el._blPaint=paint;
    return function(){ el.removeEventListener('click',click); off(); };
  }

  /* Create a standalone padlock toggle next to an existing button. */
  function makeToggle(o){
    var b=document.createElement('button');
    b.type='button';
    var c=CHANNELS[o.ch]||{label:o.ch,short:o.ch,fields:'',producer:''};
    function paint(){
      var locked=isLocked(o.ch);
      b.className='xlink '+(locked?'live':'');
      b.textContent=(locked?'🔒 Locked':'🔓 Lock');
      b.title=locked
        ? ('Auto-sync is ON for '+c.label.toLowerCase()+'. Every recalculation publishes automatically and the consuming apps adopt it. Click to unlock.')
        : ('Lock '+c.label.toLowerCase()+': every recalculation publishes automatically and the other apps follow it. '+c.fields);
    }
    b.addEventListener('click',function(e){
      e.preventDefault();
      var next=!isLocked(o.ch);
      setLock(o.ch,next,o.app||'');
      if(o.onToggle) o.onToggle(next);
    });
    onChange(paint); paint();
    return b;
  }

  /* ---------- vanilla suite status panel ----------
     The React apps get BridgeLocks.ui(React).SuitePanel; the LL & DL app is
     plain DOM, so it gets this. Same markup and classes, so the two look
     identical side by side. Re-renders on any lock change or log append.
       o.el     container element (or its id)
       o.app    this app's id
       o.order  channel ids to show (defaults to PANEL_ORDER)
       o.title  header text
       o.log    false to omit the change log
       o.limit  max log rows
       o.onToggle fn(ch, nextLocked) — override the default lock/unlock
     Returns an unmount function. */
  function mountPanel(o){
    o=o||{};
    var el=(typeof o.el==='string')?document.getElementById(o.el):o.el;
    if(!el) return function(){};
    var order=o.order||PANEL_ORDER;
    function mk(tag,cls,txt){
      var e=document.createElement(tag);
      if(cls) e.className=cls;
      if(txt!=null) e.textContent=txt;
      return e;
    }
    function render(){
      el.innerHTML='';
      var root=mk('div','bl-panel');

      var hd=mk('div','bl-ph');
      hd.appendChild(mk('span','xlk','⇄'));
      hd.appendChild(mk('span',null,o.title||'Hand-off locks'));
      var sp=mk('span'); sp.style.flex='1 1 auto'; hd.appendChild(sp);
      var cnt=mk('span',null,order.filter(isLocked).length+' of '+order.length+' locked');
      cnt.style.fontWeight='500'; cnt.style.color='#c2410c';
      hd.appendChild(cnt);
      root.appendChild(hd);

      order.forEach(function(ch){
        var c=CHANNELS[ch]||{label:ch,producer:'',short:ch,fields:''};
        var on=isLocked(ch), pa=producedAt(ch), any=hasData(ch);
        var row=mk('div','bl-ch'+(on?' on':''));
        row.appendChild(mk('span','n',c.label));
        var p=mk('span','p',any?('from '+(c.producer==='*'?'the suite':c.producer)):'not published yet');
        p.title=c.fields||'';
        row.appendChild(p);
        row.appendChild(mk('span','w',pa?ago(pa):''));

        var s=state(ch);
        var b=mk('button','xlink '+s);
        b.type='button';
        b.disabled=(s==='none'&&!on);
        b.title=on
          ? ('LOCKED — '+c.fields+' update automatically across the suite. Click to unlock.')
          : (any?('Lock '+c.label.toLowerCase()+' so every app follows it automatically — '+c.fields)
                :('No '+c.label.toLowerCase()+' published yet.'));
        b.appendChild(mk('span','xdot'));
        if(on) b.appendChild(mk('span','xlk','🔒'));
        b.addEventListener('click',function(e){
          e.preventDefault();
          if(o.onToggle) return o.onToggle(ch,!on);
          if(on) unlock(ch,o.app); else if(any) lock(ch,o.app);
        });
        row.appendChild(b);
        root.appendChild(row);
      });

      if(o.log!==false){
        var rows=logs().slice(0,o.limit||40);
        var lg=mk('div','bl-log');
        var lh=mk('div','bl-log-h');
        lh.appendChild(mk('span','xlk','🕒'));
        lh.appendChild(mk('span',null,'Recent auto-updates'));
        var sp2=mk('span'); sp2.style.flex='1 1 auto'; lh.appendChild(sp2);
        if(rows.length){
          var cl=mk('button','xlink','Clear'); cl.type='button';
          cl.addEventListener('click',function(e){ e.preventDefault(); clearLogs(); });
          lh.appendChild(cl);
        }
        lg.appendChild(lh);
        var lb=mk('div','bl-log-b');
        if(rows.length){
          rows.forEach(function(r){
            var rw=mk('div','bl-row');
            rw.appendChild(mk('span','t',(r.at||'').slice(11,16)));
            rw.appendChild(mk('span','c',(CHANNELS[r.channel]&&CHANNELS[r.channel].short)||r.channel||'—'));
            var a=mk('span','a',APPS[r.app]||r.app||''); a.title=r.app||'';
            rw.appendChild(a);
            rw.appendChild(mk('span','d',r.text||''));
            lb.appendChild(rw);
          });
        } else {
          lb.appendChild(mk('div','bl-empty','Nothing has auto-updated yet.'));
        }
        lg.appendChild(lb);
        root.appendChild(lg);
      }
      el.appendChild(root);
    }
    var a=onChange(render), b2=onLog(render);
    render();
    el._blRender=render;
    return function(){ a(); b2(); el.innerHTML=''; };
  }

  /* ---------- floating suite drawer ----------
     One call per app, from any script type: BridgeLocks.drawer({app:'psbeam'}).
     Puts a pill in the bottom-right corner showing how many channels this
     browser is following, and slides the suite panel out when clicked. The
     panel is cross-app by nature, so it deliberately does not live inside any
     single app's card layout — and this keeps the mount identical in the React
     apps and the plain-DOM one. Returns a remove function. */
  function drawer(o){
    o=o||{};
    if(window.__blDrawer) return window.__blDrawer;
    var fab=document.createElement('button');
    fab.type='button'; fab.className='bl-fab';
    var wrap=document.createElement('div');
    wrap.className='bl-draw'; wrap.style.display='none';
    var un=null, open=false;

    function nLocked(){ return (o.order||PANEL_ORDER).filter(isLocked).length; }
    function paintFab(){
      var n=nLocked();
      fab.className='bl-fab'+(n?' on':'');
      fab.innerHTML='';
      var i=document.createElement('span'); i.className='xlk'; i.textContent=n?'🔒':'⇄';
      var t=document.createElement('span'); t.textContent='Hand-off locks';
      var b=document.createElement('span'); b.className='b';
      b.textContent=n?(n+' locked'):'off';
      fab.appendChild(i); fab.appendChild(t); fab.appendChild(b);
      fab.title=n
        ? (n+' channel'+(n>1?'s are':' is')+' locked — those values update automatically across the suite. Click for detail.')
        : 'Nothing is locked. Lock a channel to have every app follow it automatically.';
    }
    function setOpen(v){
      open=v;
      wrap.style.display=v?'block':'none';
      if(v&&!un) un=mountPanel({el:wrap, app:o.app, order:o.order, title:o.title||'Hand-off locks', limit:o.limit});
    }
    fab.addEventListener('click',function(e){ e.preventDefault(); setOpen(!open); });
    document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&open) setOpen(false); });
    document.addEventListener('mousedown',function(e){
      if(open&&!wrap.contains(e.target)&&!fab.contains(e.target)) setOpen(false);
    });
    var offC=onChange(paintFab);
    paintFab();
    function attach(){
      var b=document.body; if(!b) return setTimeout(attach,50);
      b.appendChild(wrap); b.appendChild(fab);
    }
    attach();
    var api={open:function(){ setOpen(true); }, close:function(){ setOpen(false); },
      remove:function(){ offC(); if(un) un(); if(fab.parentNode) fab.parentNode.removeChild(fab);
        if(wrap.parentNode) wrap.parentNode.removeChild(wrap); window.__blDrawer=null; }};
    window.__blDrawer=api;
    return api;
  }

  /* ---------- one-call adopt helper ----------
     Wraps the whole locked-adopt cycle: compare, apply, log, toast.
       o.app      this app's id
       o.channel  channel id
       o.before   flat object of current values
       o.after    flat object of incoming values
       o.labels   key -> human label
       o.digits   key -> decimals
       o.source   text describing where the values came from
       o.apply    fn(after) — actually writes them into the app's state
     Returns the delta list (empty when nothing changed, in which case no
     toast is raised and nothing is applied). */
  function adopt(o){
    var ds=deltas(o.before,o.after,o.labels,o.digits);
    if(!ds.length) return ds;
    try{ o.apply&&o.apply(o.after,ds); }catch(e){ return []; }
    var txt=deltaText(ds);
    log({channel:o.channel, app:o.app, source:o.source||'', text:txt});
    var c=CHANNELS[o.channel]||{label:o.channel};
    toast(c.label+' updated'+(o.source?(' — '+o.source):''), txt);
    return ds;
  }

  window.BridgeLocks={
    NS:NS, VERSION:VER, K_LOCK:K_LOCK, K_LOG:K_LOG, CHANNELS:CHANNELS,
    APPS:APPS, PANEL_ORDER:PANEL_ORDER, mountPanel:mountPanel, drawer:drawer, ok:lsOK,
    all:all, isLocked:isLocked, lockInfo:lockInfo, lock:lock, unlock:unlock, toggle:toggle, drives:drives,
    saveSnap:saveSnap, peekSnap:peekSnap, takeSnap:takeSnap,
    logs:logs, log:log, clearLogs:clearLogs,
    deltas:deltas, deltaText:deltaText, adopt:adopt, bindBtn:bindBtn, makeToggle:makeToggle,
    payload:payload, producedAt:producedAt, hasData:hasData, ago:ago, state:state,
    toast:toast, onChange:onChange, onLog:onLog, ui:ui };
})();
  }

  /* ---- xfer: BridgeXfer v1 (HANDOFF.md §5) ---- */
  function xfer() {
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
  }

  /* ---- project: BXProject, shared project info (HANDOFF.md §4.1) ---- */
  function project() {
/* Shared project info (HANDOFF.md §4.1): glue for the "Use shared project info" and
   "Share project info" buttons. Uses BridgeXfer above. Duplicated per tool (CLAUDE.md §3).
   share(own): own = {sharedKey: value} for the fields this tool has; the rest are sent as ''.
   use(cur, apply): cur = {sharedKey: current value} for the fields this tool has. Shows what
   will be overwritten, then calls apply(upd) with only the non-empty shared values that differ. */
(function(){
  if(window.BXProject) return;
  var KEYS=['projectName','bridgeId','jobNo','client','location','preparedBy','checkedBy','date'];
  var LABELS={projectName:'Project name',bridgeId:'Bridge ID',jobNo:'Job no.',client:'Client',location:'Location',
              preparedBy:'Prepared by',checkedBy:'Checked by',date:'Date'};
  function str(v){ return v==null?'':String(v); }
  function share(own){
    if(!window.BridgeXfer){ alert('Shared project info is not available in this browser.'); return null; }
    var f={}; KEYS.forEach(function(k){ f[k]=str(own&&own[k]); });
    var r=BridgeXfer.publish('projectMeta',{_schema:'bridge-project-meta',fields:f});
    if(r.error) alert('Could not share project info: '+r.error);
    else alert('Project info shared. Other tools can load it with "Use shared project info".');
    return r;
  }
  function use(cur, apply){
    if(!window.BridgeXfer){ alert('Shared project info is not available in this browser.'); return false; }
    var r=BridgeXfer.read('projectMeta','bridge-project-meta',1);
    if(r.error){ alert('No shared project info: '+r.error); return false; }
    var f=r.payload.fields||{}, upd={}, lines=[], n=0;
    Object.keys(cur||{}).forEach(function(k){
      var v=str(f[k]); if(!v.trim()) return;          // never blank a field from an empty shared value
      var c=str(cur[k]); if(v===c) return;
      upd[k]=v; n++;
      lines.push('  '+(LABELS[k]||k)+': "'+(c||'(blank)')+'" → "'+v+'"');
    });
    var src=BridgeXfer.describe(r.payload);
    if(!n){ alert('Shared project info ('+src+') already matches this tool. Nothing to change.'); return false; }
    if(!confirm('Use shared project info?\nFrom: '+src+'\n\nThis will overwrite:\n'+lines.join('\n'))) return false;
    apply(upd);
    return true;
  }
  window.BXProject={ KEYS:KEYS, share:share, use:use };
})();
  }

  window.SharedBridgeBoot = { beam: beam, handoff: handoff, geometry: geometry, registry: registry, xfer: xfer, project: project };
})();
