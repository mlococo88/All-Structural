// shared loader for the tab-graphics-B tests and the scratch renderer
import path from 'node:path';
import { loadShared, ROOT } from './harness.mjs';
export const E = f => path.join(ROOT, 'apps/steel-bridge', f);
export const FILES = ['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'report.js', 'dxf.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'engine/rating.js', 'engine/welds.js', 'ui/flexure.js', 'ui/loads.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/rating.js', 'ui/splices.js', 'ui/welds.js',
  'report/data.js', 'report/builders.js', 'engine/drawings.js', 'engine/sheets.js', 'engine/tabgraphics-b.js'].map(E));
export const load = () => loadShared(...FILES);
