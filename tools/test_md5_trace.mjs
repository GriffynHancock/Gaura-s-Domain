import { loadHashCore } from './extract_hash_core.mjs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const HTML_PATH = new URL('../public/crypto/hash/index.html', import.meta.url);
const core = loadHashCore(HTML_PATH);

function strToBytes(s) { return [...new TextEncoder().encode(s)]; }

// ---- 1. digest parity: output must be byte-for-byte identical to Node's own md5 ----
const cases = [
  { label: 'empty string', bytes: strToBytes('') },
  { label: "'abc'", bytes: strToBytes('abc') },
  { label: '200-byte input', bytes: Array.from({ length: 200 }, (_, i) => i % 256) },
];
for (const { label, bytes } of cases) {
  const { digest } = core.md5WithTrace(bytes.slice());
  const expected = crypto.createHash('md5').update(Buffer.from(bytes)).digest('hex');
  assert.equal(digest, expected, `MD5 digest mismatch for ${label}`);
  console.log(`OK  digest parity, ${label}: ${digest}`);
}
// known fixed vectors as a second, independent check (in case node:crypto's md5 were ever
// unavailable in some future runtime — belt and braces per the plan's digest-parity requirement)
assert.equal(core.md5WithTrace(strToBytes('')).digest, 'd41d8cd98f00b204e9800998ecf8427e');
assert.equal(core.md5WithTrace(strToBytes('abc')).digest, '900150983cd24fb0d6963f7d28e17f72');
console.log('OK  digest parity vs known fixed vectors');

// ---- 2. trace schema: every per-step loop event carries the new register/func fields ----
const { trace } = core.md5WithTrace(strToBytes('abc'));
const loopEvents = trace.filter(e => /-loop$/.test(e.boxId));
assert.equal(loopEvents.length, 64, `expected 64 loop events, got ${loopEvents.length}`);
const first = loopEvents[0];
assert.equal(first.step, 0);
assert.equal(first.round, 1);
assert.equal(first.func, 'F');
assert.equal(typeof first.mIndex, 'number');
assert.equal(typeof first.shift, 'number');
assert.match(first.k, /^[0-9a-f]{8}$/);
assert.ok(first.regs && ['A', 'B', 'C', 'D'].every(k => typeof first.regs[k] === 'string' && /^[0-9a-f]{8}$/.test(first.regs[k])));
const funcNames = new Set(loopEvents.map(e => e.func));
assert.deepEqual([...funcNames].sort(), ['F', 'G', 'H', 'I']);
const step16 = loopEvents.find(e => e.step === 16);
assert.equal(step16.round, 2);
assert.equal(step16.func, 'G');
const step32 = loopEvents.find(e => e.step === 32);
assert.equal(step32.round, 3);
assert.equal(step32.func, 'H');
const step48 = loopEvents.find(e => e.step === 48);
assert.equal(step48.round, 4);
assert.equal(step48.func, 'I');
console.log('OK  trace schema fields present and correct on all 64 loop events');

console.log('All MD5 trace tests passed.');
