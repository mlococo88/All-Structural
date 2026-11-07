/* shared/vehicles.js — vehicle presets and their live-load rules (window.SharedVehicles).
   Classic script, no DOM. Moved verbatim from Moving Load Generator.html (2026-10-29); values unchanged.
   Units: axle loads kips, spacings ft (first axle spacing 0), uniform loads kips/ft.
   Each preset: {label, axles:[[P,spacing]…], udl, vary (variable spacing axle k, min, max), neglect (axles on the
   opposite-sign IL part), secondary (also enveloped), multi (two-vehicle case: scale, min headway, fixed spacing),
   imp (impact method/value, on uniform load), stdLane (AASHTO Std. Spec. lane loading)}.
   Rating vehicles (added 2026-11-07, after the original keys): hwy:true (highway vehicle), rating:true (legal / permit model).
   build() returns fresh objects each call: {presets, fatigue, NOSL} — presets in the original key order;
   fatigue is the LRFD fatigue truck, which the page adds to its preset table after start-up (as before). */
(function(){
function build(){
const sp=(load,arr)=>arr.map(s=>[load,s]);
const E80=[[40,0],[80,8],[80,5],[80,5],[80,5],[52,9],[52,5],[52,6],[52,5],[40,8],[80,8],[80,5],[80,5],[80,5],[52,9],[52,5],[52,6],[52,5]];
const NOV={k:0,min:0,max:0}, NOUDL={mode:'none',w:0,gap:0,trunc:false};
const NOSL={on:false,w:0.64,PM:18,PV:26}, SL20={on:true,w:0.64,PM:18,PV:26};   // AASHTO Std. Spec. 17th Ed. Fig. 3.7.6B (H20-44 / HS20-44 lane loading)
const HW=(label,axles,o={})=>Object.assign({label,axles,udl:{mode:'lane',w:0.64,gap:0,trunc:false},vary:NOV,neglect:true,secondary:'',multi:{on:false,scale:0.9,hmin:50,fixed:14},imp:{method:'const',val:1.33,onUdl:false},stdLane:NOSL},o);
const LG=(label,axles,o={})=>HW(label,axles,Object.assign({udl:NOUDL,hwy:true,rating:true},o));   // rating vehicles (M1, 2026-11-07)
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
  'ES44AC':RL('ES44AC Locomotive (315K)',sp(72,[0,6.58,6.58,33.08,6.58,6.58,13.75,6.58,6.58,33.08,6.58,6.58]),6,5),
  // ── Rating vehicles (M1, added 2026-11-07). Axle data read from the figures reproduced in the RIDOT LRFR Guidelines (Sept 2022)
  //    4.4.1.2 (AASHTO MBE Figs. D6A-1 to D6A-5, D6A-7, FAST Act EVs, RIPTA bus) and the CTDOT BDM (02/24) 1.3.6 (CT-TLC); the MBE
  //    itself was not available. Gross weights checked against those documents and the MassDOT Bridge Manual 7.2.4.1 list.
  //    Highway vehicles (hwy:true: highway DF set), rating:true (not ticked by default in the multi-vehicle report list).
  //    IM 33 % on axles, none on the lane load (LRFD 3.6.2.1; MassDOT 7.2.4.6A: IM on all rating trucks); CT-TLC IM 0 (BDM 1.3.6).
  'H20-Legal':LG('Legal H20, LRFR (MBE; RIDOT 4.4.1.2) 40k',[[8,0],[32,14]]),
  'Type3':LG('Legal Type 3 (MBE D6A-1) 50k',[[16,0],[17,15],[17,4]]),
  'Type3S2':LG('Legal Type 3S2 (MBE D6A-2) 72k',[[10,0],[15.5,11],[15.5,4],[15.5,22],[15.5,4]]),
  'Type3-3':LG('Legal Type 3-3 (MBE D6A-3) 80k',[[12,0],[12,15],[12,4],[16,15],[14,16],[14,4]]),
  'Legal-Lane':LG('Legal lane-type: 75% Type 3-3 + 0.2 klf; two at 30 ft+ for −M / interior R (MBE D6A-4, D6A-5)',[[9,0],[9,15],[9,4],[12,15],[10.5,16],[10.5,4]],
    {udl:{mode:'lane',w:0.2,gap:0,trunc:false},multi:{on:true,scale:1,hmin:30,fixed:0}}),
  'SU4':LG('Legal SU4 (MBE D6A-7) 54k',[[12,0],[8,10],[17,4],[17,4]]),
  'SU5':LG('Legal SU5 (MBE D6A-7) 62k',[[12,0],[8,10],[8,4],[17,4],[17,4]]),
  'SU6':LG('Legal SU6 (MBE D6A-7) 69.5k',[[11.5,0],[8,10],[8,4],[17,4],[17,4],[8,4]]),
  'SU7':LG('Legal SU7 (MBE D6A-7) 77.5k',[[11.5,0],[8,10],[8,4],[17,4],[17,4],[8,4],[8,4]]),
  'EV2':LG('FAST Act emergency vehicle EV2 57.5k',[[24,0],[33.5,15]]),
  'EV3':LG('FAST Act emergency vehicle EV3 86k',[[24,0],[31,15],[31,4]]),
  'RIPTA':LG('RIPTA bus (RIDOT LRFR 4.4.1.2) 41.6k',[[14.6,0],[27,23.25]]),
  'CT-TLC':LG('CTDOT CT-TLC permit, paving train (BDM 1.3.6) 279.6k, IM 0',[[13.5,0],[18,9.6],[22.5,4.1],[22.5,4.5],[63.7,18],[64.9,14.33],[18,24.75],[18,3],[38.5,6.5]],
    {imp:{method:'const',val:1.00,onUdl:false}})
};
const FATIGUE=HW('LRFD Fatigue Truck (30 ft)',[[8,0],[32,14],[32,30]],{udl:NOUDL,imp:{method:'const',val:1.15,onUdl:false}});
return {presets:P,fatigue:FATIGUE,NOSL};
}
window.SharedVehicles={build};
})();
