// Fixtures of the Crane Pick Analyzer smokes (tests/smoke/crane-*.mjs): a synthetic bridge plan sheet (PNG, drawn in the page, 2400 x 1600 px,
// a 100 ft dimension from pixel (600, 1200) to (1800, 1200): 12 px per ft) and a one-page 17 x 11 in PDF written by hand.
export async function makePlan(p, file, o = {}) {
  const W = o.w || 2400, H = o.h || 1600;
  const data = await p.evaluate(([W, H]) => {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.strokeStyle = '#111'; x.lineWidth = 4; x.strokeRect(20, 20, W - 40, H - 40);
    x.lineWidth = 1; x.strokeStyle = '#cbd5e1'; for (let i = 120; i < W - 20; i += 120) { x.beginPath(); x.moveTo(i, 20); x.lineTo(i, H - 20); x.stroke(); } for (let j = 120; j < H - 20; j += 120) { x.beginPath(); x.moveTo(20, j); x.lineTo(W - 20, j); x.stroke(); }
    // river
    x.fillStyle = '#bfdbfe'; x.beginPath(); x.moveTo(1050, 20); x.bezierCurveTo(1000, 600, 1300, 900, 1150, H - 20); x.lineTo(1450, H - 20); x.bezierCurveTo(1600, 900, 1300, 600, 1350, 20); x.fill();
    // roadway and bridge
    x.fillStyle = '#e5e7eb'; x.fillRect(80, 700, W - 160, 200); x.strokeStyle = '#111'; x.lineWidth = 3; x.strokeRect(600, 690, 1200, 220);
    x.lineWidth = 2; for (let g = 0; g < 5; g++) { x.beginPath(); x.setLineDash([24, 10]); x.moveTo(600, 710 + g * 45); x.lineTo(1800, 710 + g * 45); x.stroke(); } x.setLineDash([]);
    x.fillStyle = '#9ca3af'; x.fillRect(570, 660, 30, 280); x.fillRect(1800, 660, 30, 280);
    // dimension line: 100'-0" between x 600 and x 1800 (12 px per ft)
    x.strokeStyle = '#111'; x.lineWidth = 2; x.beginPath(); x.moveTo(600, 1200); x.lineTo(1800, 1200); x.moveTo(600, 1170); x.lineTo(600, 1230); x.moveTo(1800, 1170); x.lineTo(1800, 1230); x.stroke();
    x.fillStyle = '#111'; x.font = 'bold 44px Arial'; x.textAlign = 'center'; x.fillText("100'-0\"", 1200, 1180);
    // utilities
    x.strokeStyle = '#16a34a'; x.lineWidth = 4; x.setLineDash([30, 12, 6, 12]); x.beginPath(); x.moveTo(80, 1000); x.lineTo(W - 80, 1060); x.stroke(); x.setLineDash([]);
    x.fillStyle = '#16a34a'; x.font = '30px Arial'; x.fillText('24" WATER', 400, 990);
    x.strokeStyle = '#dc2626'; x.lineWidth = 3; x.beginPath(); x.moveTo(80, 420); x.lineTo(W - 80, 380); x.stroke(); x.fillStyle = '#dc2626'; x.fillText('OVERHEAD ELECTRIC 13.8 kV', 500, 400);
    // north arrow and title block
    x.fillStyle = '#111'; x.beginPath(); x.moveTo(2200, 120); x.lineTo(2170, 230); x.lineTo(2230, 230); x.closePath(); x.fill(); x.font = 'bold 40px Arial'; x.fillText('N', 2200, 280);
    x.strokeRect(1700, 1340, 680, 240); x.font = 'bold 36px Arial'; x.textAlign = 'left'; x.fillText('ROUTE 6 OVER TAUNTON RIVER', 1720, 1395); x.font = '28px Arial'; x.fillText('SITE PLAN   SCALE: 1" = 20\'', 1720, 1450); x.fillText('SHEET C-1 (TEST DRAWING)', 1720, 1500);
    return c.toDataURL('image/png');
  }, [W, H]);
  const fs = await import('fs'); fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
  return { W, H };
}
// a one-page PDF (17 x 11 in) with a frame and a line, written by hand (correct xref offsets)
export function makePdf(file) {
  const content = '2 w 36 36 1152 720 re S 300 396 m 900 396 l S BT /F1 24 Tf 400 420 Td (TEST PLAN 1 IN = 20 FT) Tj ET';
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1224 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let out = '%PDF-1.4\n'; const off = [];
  objs.forEach((o, i) => { off.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length; out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + off.map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return import('fs').then(fs => fs.writeFileSync(file, out, 'latin1'));
}
