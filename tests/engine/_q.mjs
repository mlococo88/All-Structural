import path from 'node:path';
import { loadShared, ROOT } from './harness.mjs';
const APP = path.join(ROOT, 'apps', 'crane-pick', 'engine');
const W = loadShared('steps.js', 'boussinesq.js', ...['geo.js','osha.js','cranes.js','lift.js','elev.js','ground.js','route.js'].map(f => path.join(APP, f)));
const RT = W.CranePickRoute;
function circleRoute(R, laps, N) { // regular N-gon circumscribed about the circle centre (0,R), start at (0,0) heading east; entry straight 200 ft
  const pts = [{x:-200,y:0}], step = 2*Math.PI/N, Lh = R*Math.tan(step/2);
  // vertices: start tangent point (0,0) then vertex at distance Lh ahead
  let th = 0, p = {x:0,y:0};
  for (let k = 0; k < laps*N; k++) { const v = {x:p.x+Lh*Math.cos(th), y:p.y+Lh*Math.sin(th)}; pts.push(v); th += step; p = {x:v.x+Lh*Math.cos(th), y:v.y+Lh*Math.sin(th)}; }
  pts.push({x:p.x+Lh*Math.cos(th)*2, y:p.y+Lh*Math.sin(th)*2});
  return { pts, rad: pts.map((_, i) => i ? R*(1-1e-9) : null) };
}
for (const [veh, R] of [[{type:'semi',L1:20,e:1,L2:40},60],[{type:'semi',L1:15,e:-1,L2:50},60],[{type:'jeep',L1:18,e:1,Lj:12,ej:0.5,L2:90,k:0},150],[{type:'dolly',L1:20,e:1,L2:100,k:0.5},150],[{type:'jeep',L1:18,e:1,Lj:12,ej:0.5,L2:90,k:0.7},150]]) {
  const r = Object.assign(circleRoute(R, +process.env.LAPS||3, 72), { veh, load:{L:60,r:2} });
  const t0=Date.now(); const sim = RT.simulate(r); const ss = RT.steady(RT.vehOf(r), R);
  const q = sim.samples[sim.samples.length-30]; const rd = Math.hypot(q.p.D.x, q.p.D.y-R);
  console.log(veh.type, veh.k||0, 'L', sim.pa.L.toFixed(0), 'reduced', sim.pa.turns.filter(t=>t.reduced).length, 'ss RD', ss && ss.RD.toFixed(5), 'sim RD', rd.toFixed(5), 'OT', ss&&ss.OT.toFixed(5), q.ot.toFixed(5), 'dl', ss&&(ss.dl*180/Math.PI).toFixed(4), (q.p.dl*180/Math.PI).toFixed(4), Date.now()-t0,'ms');
}
{ const R=150, veh={type:'dolly',L1:20,e:1,L2:100,k:0.5}; const r = Object.assign(circleRoute(R, 3, 72), { veh, load:{L:60,r:2} });
  const sim = RT.simulate(r); const q = sim.samples[sim.samples.length-30].p; const O={x:0,y:R};
  const u2={x:Math.cos(q.th2),y:Math.sin(q.th2)}, n2={x:-u2.y,y:u2.x}; const d={x:O.x-q.H.x,y:O.y-q.H.y};
  const ox=d.x*u2.x+d.y*u2.y, oy=d.x*n2.x+d.y*n2.y; const RH=Math.hypot(d.x,d.y);
  console.log('RH',RH,'ox',ox,'oy',oy,'pred ox', -100-oy*Math.tan(q.dl), 'gamma', (q.th1-q.th2)*180/Math.PI, 'dl', q.dl*180/Math.PI);
  const RT_=Math.hypot(q.T.x-O.x,q.T.y-O.y); console.log('RT', RT_, Math.sqrt(R*R-400), 'front', Math.atan2(1,RT_)*180/Math.PI, 'tH', Math.atan2(-ox,oy)*180/Math.PI);
}
