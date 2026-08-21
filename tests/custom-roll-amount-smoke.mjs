import fs from 'node:fs';
import assert from 'node:assert/strict';

const batch = fs.readFileSync(new URL('../js/features/batch-roll.js', import.meta.url), 'utf8');
const boot = fs.readFileSync(new URL('../js/tomo-v1.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../css/tomo-v1.css', import.meta.url), 'utf8');

assert.match(batch, /Math\.max\(1, Math\.min\(20,/);
assert.match(batch, /rollAmount/);
assert.match(batch, /data-batch-feedback="maybe"/);
assert.match(batch, /data-batch-feedback="skip"/);
assert.match(batch, /data-batch-reroll/);
assert.match(batch, /data-tomo-mode="surprise"/);
assert.match(boot, /initBatchRoll/);
assert.match(sw, /tomo-shell-v1\.3\.8-batch-roll-20/);
assert.match(sw, /js\/features\/batch-roll\.js\?v=1\.0\.0/);
assert.match(css, /\.tomo-roll-amount/);
assert.match(css, /\.tomo-batch-grid/);
console.log('Custom roll amount static smoke checks passed.');
