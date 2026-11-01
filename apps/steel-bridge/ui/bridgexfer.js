/* apps/steel-bridge/ui/bridgexfer.js — the BridgeXfer v1 helper, copied verbatim from HANDOFF.md §5 (CLAUDE.md §3: duplicated in each tool
   that sends or receives; not edited here). Used by ui/handoffs.js. */
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
