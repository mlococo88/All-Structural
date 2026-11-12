// SB-2 (2026-11-12): since girder types, a NEW Steel Bridge project (the first start with nothing saved, and New) is SBDModel.newProject():
// two girder types, Interior and Exterior. The browser smoke tests written for the one-girder built-in project (SBDModel.defaultProject(),
// unchanged) open the page with it saved, so their recorded values stay theirs: openPage(FILE, { ls: { ...SBD_SEED } }).
// SBD_DEFAULT: that project (an object); SBD_SEED: the localStorage seed (the autosave key the page reads first).
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { REPO } from '../lib.mjs';

const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(REPO, 'apps/steel-bridge/engine/model.js'), 'utf8'), ctx);
export const SBD_DEFAULT = JSON.parse(JSON.stringify(ctx.window.SBDModel.defaultProject()));
export const SBD_SEED = { 'sbd2.project.current': JSON.stringify(SBD_DEFAULT, null, 2) };
