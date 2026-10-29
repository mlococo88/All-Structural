/* shared/vehicles.js — vehicle presets and their live-load rules (window.SharedVehicles).
   Classic script, no DOM. Moved verbatim from Moving Load Generator.html (2026-10-29); values unchanged.
   Units: axle loads kips, spacings ft (first axle spacing 0), uniform loads kips/ft.
   Each preset: {label, axles:[[P,spacing]…], udl, vary (variable spacing axle k, min, max), neglect (axles on the
   opposite-sign IL part), secondary (also enveloped), multi (two-vehicle case: scale, min headway, fixed spacing),
   imp (impact method/value, on uniform load), stdLane (AASHTO Std. Spec. lane loading)}.
   build() returns fresh objects each call: {presets, fatigue, NOSL} — presets in the original key order;
   fatigue is the LRFD fatigue truck, which the page adds to its preset table after start-up (as before). */
(function(){
function build(){
const sp=(load,arr)=>arr.map(s=>[load,s]);
const E80=[[40,0],[80,8],[80,5],[80,5],[80,5],[52,9],[52,5],[52,6],[52,5],[40,8],[80,8],[80,5],[80,5],[80,5],[52,9],[52,5],[52,6],[52,5]];
const NOV={k:0,min:0,max:0}, NOUDL={mode:'none',w:0,gap:0,trunc:false};
const NOSL={on:false,w:0.64,PM:18,PV:26}, SL20={on:true,w:0.64,PM:18,PV:26};   // AASHTO Std. Spec. 17th Ed. Fig. 3.7.6B (H20-44 / HS20-44 lane loading)
const HW=(label,axles,o={})=>Object.assign({label,axles,udl:{mode:'lane',w:0.64,gap:0,trunc:false},vary:NOV,neglect:true,secondary:'',multi:{on:false,scale:0.9,hmin:50,fixed:14},imp:{method:'const',val:1.33,onUdl:false},stdLane:NOSL},o);
const RL=(label,axles,w,gap,o={})=>Object.assign({label,axles,udl:{mode:w>0?'trail':'none',w,gap,trunc:false},vary:NOV,neglect:false,secondary:'',multi:{on:false,scale:1,hmin:50,fixed:0},imp:{method:'arema',val:1,onUdl:true}},o);
const P={
  'HL93-Truck':HW('HL-93 Design Truck',[[8,0],[32,14],[32,14]],{vary:{k:3,min:14,max:30},secondary:'HL93-Tandem',multi:{on:true,scale:0.9,hmin:50,fixed:14}}),
  'HL93-Tandem':HW('HL-93 Design Tandem',[[25,0],[25,4]]),
  'HS20':HW('HS20 Truck + Std. Spec. lane loading',[[8,0],[32,14],[32,14]],{udl:NOUDL,vary:{k:3,min:14,max:30},neglect:false,imp:{method:'const',val:1.30,onUdl:false},stdLane:SL20}),
  'H20':HW('H20 Truck + Std. Spec. lane loading',[[8,0],[32,14]],{udl:NOUDL,neglect:false,imp:{method:'const',val:1.30,onUdl:false},stdLane:SL20}),
  'E80':RL('AREMA Cooper E80',E80,8,5,{secondary:'E80-Alt'}),
  'E80-Alt':RL('Cooper E80 Alternate (4 × 100k)',sp(100,[0,5,6,5]),0,0),
  'F40PH':RL('F40PH Locomotive (280K)',sp(70,[0,9,24,9,14.17,9,24,9]),2,7),
  'HSP46':RL('HSP-46 Locomotive (296K)',sp(73.75,[0,9.33,35.67,9.33,16.67,9.33,35.67,9.33]),2,8.33),
  '286K':RL('286K Rail Car (×3)',sp(71.5,[0,5.67,19.58,5.67,6.67,5.67,19.58,5.67,6.67,5.67,19.58,5.67]),0,0),
  '315K':RL('315K CSX Rail Car (×3)',sp(78.75,[0,6,35.67,6,7.5,6,35.67,6,7.5,6,35.67,6]),0,0),
  'ES44AC':RL('ES44AC Locomotive (315K)',sp(72,[0,6.58,6.58,33.08,6.58,6.58,13.75,6.58,6.58,33.08,6.58,6.58]),6,5)
};
const FATIGUE=HW('LRFD Fatigue Truck (30 ft)',[[8,0],[32,14],[32,30]],{udl:NOUDL,imp:{method:'const',val:1.15,onUdl:false}});
return {presets:P,fatigue:FATIGUE,NOSL};
}
window.SharedVehicles={build};
})();
