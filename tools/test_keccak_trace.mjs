import { loadHashCore } from './extract_hash_core.mjs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const HTML_PATH = new URL('../public/crypto/hash/index.html', import.meta.url);
const core = loadHashCore(HTML_PATH);

function strToBytes(s) { return [...new TextEncoder().encode(s)]; }

// ---- 1. digest parity vs Node's own sha3-256 (with known-vector fallback) ----
const KNOWN_VECTORS = {
  '': 'a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a',
  'abc': '3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532',
};
const hasSha3 = crypto.getHashes().includes('sha3-256');
const cases = [
  { label: 'empty string', text: '' },
  { label: "'abc'", text: 'abc' },
  { label: '200-byte input', bytes: Array.from({ length: 200 }, (_, i) => i % 256) },
];
for (const c of cases) {
  const bytes = c.bytes || strToBytes(c.text);
  const { digest } = core.keccak256WithTrace(bytes.slice());
  let expected;
  if (hasSha3) {
    expected = crypto.createHash('sha3-256').update(Buffer.from(bytes)).digest('hex');
  } else if (c.text !== undefined && KNOWN_VECTORS[c.text]) {
    expected = KNOWN_VECTORS[c.text];
  } else {
    console.log(`SKIP ${c.label}: no sha3-256 support in this Node build and no fixed vector on file`);
    continue;
  }
  assert.equal(digest, expected, `SHA3-256 digest mismatch for ${c.label}`);
  console.log(`OK  digest parity, ${c.label}: ${digest}`);
}

// ---- 2. trace schema: 5 sub-step events per round, correct lane sets ----
const { trace } = core.keccak256WithTrace(strToBytes('abc'));
for (let rnd = 0; rnd < 24; rnd++) {
  const theta = trace.find(e => e.boxId === `lane-r${rnd}-theta`);
  const rho = trace.find(e => e.boxId === `lane-r${rnd}-rho`);
  const pi = trace.find(e => e.boxId === `lane-r${rnd}-pi`);
  const chi = trace.find(e => e.boxId === `lane-r${rnd}-chi`);
  const iota = trace.find(e => e.boxId === `lane-r${rnd}-iota`);
  assert.ok(theta && rho && pi && chi && iota, `round ${rnd} missing a sub-step event`);
  assert.equal(theta.lanes.length, 25, `round ${rnd} theta should touch all 25 lanes`);
  assert.equal(rho.lanes.length, 25, `round ${rnd} rho should touch all 25 lanes`);
  assert.equal(pi.lanes.length, 25, `round ${rnd} pi should touch all 25 lanes`);
  // JSON round-trip before deepEqual: the trace arrays are constructed inside extract_hash_core.mjs's
  // vm sandbox (a separate realm), and Node's assert.deepEqual on this Node version does a
  // reference-equality fast path for cross-realm arrays that fails even when contents are identical
  // ("Values have same structure but are not reference-equal"). Round-tripping through JSON strips
  // the cross-realm Array identity and leaves plain-object structural comparison, which is what this
  // assertion is actually checking.
  assert.deepEqual(JSON.parse(JSON.stringify(chi.lanes)), [[0,0],[1,0],[2,0],[3,0],[4,0]], `round ${rnd} chi should touch only row y=0`);
  assert.deepEqual(JSON.parse(JSON.stringify(iota.lanes)), [[0,0]], `round ${rnd} iota should touch only lane (0,0)`);
}
console.log('OK  all 24 rounds emit theta/rho/pi/chi/iota sub-step events with correct lane sets');

assert.equal(trace.filter(e => /^cube-r/.test(e.boxId)).length, 0, 'old cube-rN events should be gone');
console.log('OK  old single cube-rN events no longer present');

// ---- 3. KECCAK_PI_LANE_MAP matches the pi formula already used in the algorithm ----
for (let x = 0; x < 5; x++) {
  for (let y = 0; y < 5; y++) {
    const [nx, ny] = core.KECCAK_PI_LANE_MAP[x][y];
    assert.equal(nx, y, `pi map x=${x},y=${y} nx mismatch`);
    assert.equal(ny, (2*x + 3*y) % 5, `pi map x=${x},y=${y} ny mismatch`);
  }
}
console.log('OK  KECCAK_PI_LANE_MAP matches the pi permutation formula (nx=y, ny=(2x+3y)%5)');

console.log('All SHA-3 trace tests passed.');
