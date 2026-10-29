// Self-test of the runner: a classic script loads into the vm context and its
// one global namespace is visible on window.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadShared, test } from './harness.mjs';

test('loadShared evaluates a classic script into window.<Namespace>', () => {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'eng-')), 'demo.js');
  fs.writeFileSync(p, '(function(){ window.SharedDemo = { add: function(a,b){ return a+b; } }; })();');
  const w = loadShared(p);
  assert.equal(w.SharedDemo.add(2, 3), 5);
});
