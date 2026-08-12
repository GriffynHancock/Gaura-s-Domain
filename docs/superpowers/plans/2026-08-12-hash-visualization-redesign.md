# Hash Visualization Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the SHA-3 single-cube, MD5 4-round-box diagram, input-box label display, single collision preset, and vertical MD5 block-chain in `public/crypto/hash/index.html` with: a real 25-lane 5×5 Keccak-state grid (CSS-3D, drag-rotatable, θ/ρ/π/χ/ι sub-step animation, live round counter), an MD5 A/B/C/D register-state view with live function/step/shift/constant readout, a Z-axis "deck of cards" MD5 multi-block stack, real resolved-content display in the input box (including a visible-whitespace renderer), and a two-message MD5 collision preset pair with a cross-reference annotation — with zero change to any digest the page computes.

**Architecture:** This is a single dependency-free HTML file (`public/crypto/hash/index.html`) with all CSS/JS inline. Work happens directly in that file across 9 sequential tasks. Tasks 1–2 extend the existing trace-event objects emitted by `md5WithTrace` / `keccakF1600WithTrace` with additional fields — purely additive, no change to the bitwise math that produces the digest. Tasks 3–4 build the SHA-3 lane grid (markup/CSS/drag, then animation wiring) on top of Task 2's new events. Tasks 5–6 build the MD5 register view (markup/wiring, then the Z-stack chaining) on top of Task 1's new fields. Tasks 7–8 are small independent UI fixes. Task 9 is a Playwright-driven integration pass over everything the earlier 8 tasks built — no new features.

Two lightweight Node test harnesses are added under `tools/` to prove digest parity and trace-schema shape without a browser (`tools/extract_hash_core.mjs`, used by `tools/test_md5_trace.mjs` and `tools/test_keccak_trace.mjs`). Per-task UI smoke checks and the Task 9 integration pass use Playwright scripts under `tools/verify_task*.mjs`, driving the page over a local `python3 -m http.server 8787` the way CLAUDE.md's local-dev section describes.

**Tech Stack:** Vanilla HTML/CSS/JS (no framework, no build step), Node.js (`node` on PATH, confirmed v24.14.1 with native `sha3-256` support in `node:crypto`) for digest-parity tests, Playwright (`^1.62.1`, already a repo devDependency, Chromium already installed) for UI verification.

**Context:** This work happens in an isolated git worktree per the `superpowers:using-git-worktrees` convention, branching from `master`. Worktree setup itself is not a plan task — it happens at execution time via subagent-driven-development, before Task 1 begins.

## Global Constraints

- Single dependency-free HTML file: `public/crypto/hash/index.html` — no new files, no external libraries, no build step. All CSS/JS stays inline in this one file.
- No digest/algorithm correctness regressions — every task touching `md5WithTrace` or `keccakF1600WithTrace`/`keccak256WithTrace` must include a before/after digest-equality test proving the actual hash output is byte-for-byte unchanged.
- Reuse existing CSS custom properties (`--gold`, `--panel2`, `--edge`, `--accent`, `--ink`, `--dim`, `--ok`) and the existing "top-up not reset" `.pulse` class convention — do not invent parallel pulse/animation mechanisms.
- No 3D library, no quaternion math, no canvas — plain CSS 3D transforms only, consistent with the existing single-cube implementation this replaces.
- Verify with Playwright, not synthetic DOM events — real pointer interactions for anything interactive (drag-rotate, arrow-cycling presets, Hash button).
- This work happens in an isolated git worktree per superpowers:using-git-worktrees convention (branching from `master`) — note this in the plan's header/context but the actual worktree setup happens at execution time via subagent-driven-development, not as a plan task.

---

## Task 1: MD5 trace-event schema extension

**Model:** cheap — mechanical additive edit to one object literal, spec gives the exact field list, low ambiguity.

**Files:**
- Modify: `public/crypto/hash/index.html:333-345` (the per-step loop inside `md5WithTrace`, currently `public/crypto/hash/index.html:308-351`)
- Create: `tools/extract_hash_core.mjs` (shared Node test harness — extracts the DOM-free algorithm core from the HTML file for testing without a browser)
- Create: `tools/test_md5_trace.mjs`

**Interfaces:**
- Consumes: nothing from other tasks (first task).
- Produces:
  - `tools/extract_hash_core.mjs` exports `loadHashCore(htmlPathUrl)` returning a sandbox object exposing every top-level function/const declared between `function strToBytes` and the `// ---- theme toggle ----` comment in the page's inline script (currently `md5WithTrace`, `keccakF1600WithTrace`, `keccak256WithTrace`, `KECCAK_RHO_OFFSETS`, `KECCAK_RC`, `toHex32`, `strToBytes`, `hexToBytes`, and — after Task 2 — `KECCAK_PI_LANE_MAP`, `ALL_25_LANES`). Task 2 reuses this file as-is.
  - `md5WithTrace(bytes)` trace entries for `boxId` matching `/-loop$/` now additionally carry: `step` (number, 0-63), `round` (number, 1-4), `func` (`'F'|'G'|'H'|'I'`), `mIndex` (number, 0-15), `shift` (number), `k` (8-char lowercase hex string), `regs` (`{A,B,C,D}`, each an 8-char lowercase hex string) — read by Task 5's `updateMd5RegisterView(ev)`.

- [ ] **Step 1: Create the shared Node test harness**

Create `/Users/gaura/PCAN/ceasar-ctf/tools/extract_hash_core.mjs`:

```js
// Extracts the DOM-free algorithm core (strToBytes .. keccak256WithTrace) out of
// public/crypto/hash/index.html's inline <script> and runs it in a fresh vm context, so its
// digest/trace functions can be unit-tested from Node without a browser or DOM stubs. The core
// is bounded by two markers that are already present in the file and are not touched by any
// task in this plan except to add code *within* the boundary (new trace fields, new consts).
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const START_MARKER = 'function strToBytes';
const END_MARKER = '// ---- theme toggle ----';

export function loadHashCore(htmlPathUrl) {
  const html = readFileSync(htmlPathUrl, 'utf8');
  const startIdx = html.indexOf(START_MARKER);
  const endIdx = html.indexOf(END_MARKER);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    throw new Error(
      `could not locate hash-core script boundaries (markers "${START_MARKER}" / "${END_MARKER}") in ${htmlPathUrl}`
    );
  }
  const code = html.slice(startIdx, endIdx);
  const sandbox = { TextEncoder, TextDecoder, BigInt, console };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'hash-core.js' });
  return sandbox;
}
```

- [ ] **Step 2: Write the digest-parity + trace-schema test (fails on schema, not on digest)**

Create `/Users/gaura/PCAN/ceasar-ctf/tools/test_md5_trace.mjs`:

```js
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
```

- [ ] **Step 3: Run the test, confirm the schema assertions fail (digest assertions pass)**

Run: `node tools/test_md5_trace.mjs`
Expected: the digest-parity lines print OK, then it throws an `AssertionError` around `assert.equal(first.step, 0)` (or `TypeError: Cannot read properties of undefined`) because `step`/`round`/`func`/etc. don't exist on the trace objects yet.

- [ ] **Step 4: Add the new fields to `md5WithTrace`'s per-step loop**

In `public/crypto/hash/index.html`, the loop currently reads (lines 333-345):

```js
    let A=a0,B=b0,C=c0,D=d0;
    for (let i = 0; i < 64; i++) {
      const round = Math.floor(i/16) + 1;
      if (i % 16 === 0) trace.push({ boxId:`block-${blk}-r${round}`, kind:'activate', sample:`round ${round}` });
      let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5*i+1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3*i+5) % 16; }
      else { F = C ^ (B | ~D); g = (7*i) % 16; }
      F = (F + A + K[i] + M[g]) >>> 0;
      A = D; D = C; C = B;
      B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) >>> 0;
      trace.push({ boxId:`block-${blk}-r${round}-loop`, kind:'activate', sample: toHex32(B) });
    }
```

Replace it with:

```js
    let A=a0,B=b0,C=c0,D=d0;
    for (let i = 0; i < 64; i++) {
      const round = Math.floor(i/16) + 1;
      if (i % 16 === 0) trace.push({ boxId:`block-${blk}-r${round}`, kind:'activate', sample:`round ${round}` });
      let F, g, funcName;
      if (i < 16) { F = (B & C) | (~B & D); g = i; funcName = 'F'; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5*i+1) % 16; funcName = 'G'; }
      else if (i < 48) { F = B ^ C ^ D; g = (3*i+5) % 16; funcName = 'H'; }
      else { F = C ^ (B | ~D); g = (7*i) % 16; funcName = 'I'; }
      F = (F + A + K[i] + M[g]) >>> 0;
      A = D; D = C; C = B;
      B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) >>> 0;
      trace.push({
        boxId:`block-${blk}-r${round}-loop`, kind:'activate', sample: toHex32(B),
        step: i, round, func: funcName, mIndex: g, shift: S[i], k: toHex32(K[i]),
        regs: { A: toHex32(A), B: toHex32(B), C: toHex32(C), D: toHex32(D) }
      });
    }
```

Note this is purely additive: `boxId`, `kind`, `sample` are untouched, and no line before `trace.push` changes any register value or loop variable — the digest math is identical.

- [ ] **Step 5: Run the test again, confirm it passes**

Run: `node tools/test_md5_trace.mjs`
Expected: every line prints `OK` and the script ends with `All MD5 trace tests passed.` (exit code 0).

- [ ] **Step 6: Manual smoke check the page still loads**

Run: `cd /Users/gaura/PCAN/ceasar-ctf && python3 -m http.server 8787 &` then open `http://localhost:8787/public/crypto/hash/?v=t1` in a browser (or `curl -sf http://localhost:8787/public/crypto/hash/ | head -1` to confirm the server responds `200`). Click Hash with MD5 selected and confirm a digest still appears and no browser console errors are thrown (the new trace fields are inert until Task 5 wires them up — the existing diagram must look and behave exactly as before).

- [ ] **Step 7: Commit**

```bash
cd /Users/gaura/PCAN/ceasar-ctf
git add public/crypto/hash/index.html tools/extract_hash_core.mjs tools/test_md5_trace.mjs
git commit -m "hash module: MD5 trace schema — add step/func/mIndex/shift/k/regs fields (additive, digest unchanged)"
```

---

## Task 2: SHA-3 trace-event schema extension

**Model:** standard — touches BigInt lane math and requires care not to alter it; more moving parts than Task 1 (five new event kinds, a new precomputed map, per-event lane-set correctness).

**Files:**
- Modify: `public/crypto/hash/index.html:376` (add `KECCAK_PI_LANE_MAP` and `ALL_25_LANES` consts near the existing `KECCAK_RHO_OFFSETS`)
- Modify: `public/crypto/hash/index.html:381-400` (`keccakF1600WithTrace`'s round loop)
- Create: `tools/test_keccak_trace.mjs`

**Interfaces:**
- Consumes: `tools/extract_hash_core.mjs` from Task 1 (`loadHashCore`).
- Produces:
  - `KECCAK_PI_LANE_MAP` — a top-level `const`, a 5×5 array where `KECCAK_PI_LANE_MAP[x][y] = [nx, ny]` is the π-permutation target grid slot for lane `(x,y)`. Read by Task 4's pi-slide animation.
  - `ALL_25_LANES` — a top-level `const`, flat array of all 25 `[x,y]` pairs. Used internally by `keccakF1600WithTrace`'s new trace events; not required by later tasks but harmless to leave exported from the sandbox.
  - Each of `keccakF1600WithTrace`'s 24 rounds now pushes five trace events instead of one: `boxId` values `lane-r{rnd}-theta`, `lane-r{rnd}-rho`, `lane-r{rnd}-pi`, `lane-r{rnd}-chi`, `lane-r{rnd}-iota` (rnd = 0-23), each with `kind:'activate'`, a `sample` string, and a `lanes` field — an array of `[x,y]` pairs the UI should pulse for that event. `theta`/`rho`/`pi` carry all 25 lanes; `chi` carries `[[0,0],[1,0],[2,0],[3,0],[4,0]]`; `iota` carries `[[0,0]]`. The old single `cube-r{rnd}` event no longer exists. Read by Task 4's `pulseLanesFor(ev)`.
  - A round is "done" (its `-iota` event fires) — Task 4's round counter increments there.

- [ ] **Step 1: Write the trace-schema test (will fail — old `cube-rN` events still exist)**

Create `/Users/gaura/PCAN/ceasar-ctf/tools/test_keccak_trace.mjs`:

```js
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
  assert.deepEqual(chi.lanes, [[0,0],[1,0],[2,0],[3,0],[4,0]], `round ${rnd} chi should touch only row y=0`);
  assert.deepEqual(iota.lanes, [[0,0]], `round ${rnd} iota should touch only lane (0,0)`);
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
```

- [ ] **Step 2: Run it, confirm the schema assertions fail**

Run: `node tools/test_keccak_trace.mjs`
Expected: digest-parity lines print OK (unaffected by this task — no math changes yet), then it fails around `assert.ok(theta && rho && pi && chi && iota, ...)` because `keccakF1600WithTrace` still only pushes one `cube-rN` event per round.

- [ ] **Step 3: Add `KECCAK_PI_LANE_MAP` and `ALL_25_LANES` next to `KECCAK_RHO_OFFSETS`**

In `public/crypto/hash/index.html`, line 376 currently reads:

```js
const KECCAK_RHO_OFFSETS = [[0,36,3,41,18],[1,44,10,45,2],[62,6,43,15,61],[28,55,25,21,56],[27,20,39,8,14]];
```

Immediately after it, insert:

```js
const KECCAK_PI_LANE_MAP = [];
for (let x = 0; x < 5; x++) {
  KECCAK_PI_LANE_MAP.push([]);
  for (let y = 0; y < 5; y++) {
    // matches the pi formula already computed inline inside keccakF1600WithTrace's B[nx][ny]
    // assignment below — precomputed once here so the UI can look up a lane's target slot
    // without re-deriving the formula.
    KECCAK_PI_LANE_MAP[x].push([y, (2*x + 3*y) % 5]);
  }
}
const ALL_25_LANES = [];
for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) ALL_25_LANES.push([x, y]);
```

- [ ] **Step 4: Replace the single `cube-r{rnd}` push with five per-step sub-step events**

`public/crypto/hash/index.html:381-400` currently reads:

```js
function keccakF1600WithTrace(state, trace) {
  for (let rnd = 0; rnd < 24; rnd++) {
    const C = [];
    for (let x = 0; x < 5; x++) C.push(state[x][0]^state[x][1]^state[x][2]^state[x][3]^state[x][4]);
    const D = [];
    for (let x = 0; x < 5; x++) D.push(C[(x+4)%5] ^ rol64(C[(x+1)%5], 1));
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) state[x][y] ^= D[x];
    const B = [[0n,0n,0n,0n,0n],[0n,0n,0n,0n,0n],[0n,0n,0n,0n,0n],[0n,0n,0n,0n,0n],[0n,0n,0n,0n,0n]];
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) {
      const nx = y, ny = (2*x + 3*y) % 5;
      B[nx][ny] = rol64(state[x][y], KECCAK_RHO_OFFSETS[x][y]);
    }
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) {
      state[x][y] = (B[x][y] ^ ((~B[(x+1)%5][y]) & B[(x+2)%5][y])) & KECCAK_MASK64;
    }
    state[0][0] ^= KECCAK_RC[rnd];
    trace.push({ boxId:`cube-r${rnd}`, kind:'activate', sample: laneHex(state[0][0]).slice(0,8) });
  }
  return state;
}
```

Replace with:

```js
function keccakF1600WithTrace(state, trace) {
  for (let rnd = 0; rnd < 24; rnd++) {
    const C = [];
    for (let x = 0; x < 5; x++) C.push(state[x][0]^state[x][1]^state[x][2]^state[x][3]^state[x][4]);
    const D = [];
    for (let x = 0; x < 5; x++) D.push(C[(x+4)%5] ^ rol64(C[(x+1)%5], 1));
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) state[x][y] ^= D[x];
    trace.push({
      boxId:`lane-r${rnd}-theta`, kind:'activate',
      sample: `D=[${D.map(v => laneHex(v).slice(0,4)).join(',')}]`,
      lanes: ALL_25_LANES
    });

    const B = [[0n,0n,0n,0n,0n],[0n,0n,0n,0n,0n],[0n,0n,0n,0n,0n],[0n,0n,0n,0n,0n],[0n,0n,0n,0n,0n]];
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) {
      const nx = y, ny = (2*x + 3*y) % 5;
      B[nx][ny] = rol64(state[x][y], KECCAK_RHO_OFFSETS[x][y]);
    }
    trace.push({
      boxId:`lane-r${rnd}-rho`, kind:'activate',
      sample: 'each lane rotated by its own fixed offset',
      lanes: ALL_25_LANES
    });
    trace.push({
      boxId:`lane-r${rnd}-pi`, kind:'activate',
      sample: 'lanes permuted via (x,y) -> (y, 2x+3y mod 5)',
      lanes: ALL_25_LANES
    });

    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) {
      state[x][y] = (B[x][y] ^ ((~B[(x+1)%5][y]) & B[(x+2)%5][y])) & KECCAK_MASK64;
    }
    // chi actually mixes every row (all x, for every y) every round via the state[x][y]
    // assignment immediately above — that math is unchanged and still runs on the full state.
    // Spotlighting only row y=0 here is a deliberate UI legibility simplification (25 lanes
    // self-mixing at once reads as noise, not as "a row mixing") — it affects which lanes
    // visually pulse, not the underlying computation.
    trace.push({
      boxId:`lane-r${rnd}-chi`, kind:'activate',
      sample: 'row y=0 self-mixed (representative — chi runs on every row every round)',
      lanes: [[0,0],[1,0],[2,0],[3,0],[4,0]]
    });

    state[0][0] ^= KECCAK_RC[rnd];
    trace.push({
      boxId:`lane-r${rnd}-iota`, kind:'activate',
      sample: laneHex(KECCAK_RC[rnd]),
      lanes: [[0,0]]
    });
  }
  return state;
}
```

- [ ] **Step 5: Run the test again, confirm it passes**

Run: `node tools/test_keccak_trace.mjs`
Expected: every line prints `OK` and the script ends with `All SHA-3 trace tests passed.` (exit code 0).

- [ ] **Step 6: Manual smoke check the page still loads**

Run the local server if not already running (`python3 -m http.server 8787` from repo root), open `http://localhost:8787/public/crypto/hash/?v=t2`, switch algorithm to SHA-3, click Hash, confirm a digest still appears and there are no console errors. The old cube still renders and pulses on every event with the same `pulseBoxOrCube` cube-r fallback path from before this task ran (it will simply never receive a `cube-r*` id anymore and stay static during animation — visually stale but not broken; Task 3/4 replace it). Confirm the final digest matches Task 2 Step 5's test output for the same input if you type the same string.

- [ ] **Step 7: Commit**

```bash
cd /Users/gaura/PCAN/ceasar-ctf
git add public/crypto/hash/index.html tools/test_keccak_trace.mjs
git commit -m "hash module: SHA-3 trace schema — per-round theta/rho/pi/chi/iota events + KECCAK_PI_LANE_MAP (additive, digest unchanged)"
```

---

## Task 3: SHA-3 25-lane cuboid markup + CSS

**Model:** standard — new CSS-3D technique (pseudo-3D block via `::before`/`::after`), a generated 5×5 grid, and adapting the existing drag handler; more surface area than Task 1/2 but no algorithm math involved.

**Files:**
- Modify: `public/crypto/hash/index.html:143-163` (`.cube-wrap`/`.cube`/`.face`/`.cube-legend` CSS)
- Modify: `public/crypto/hash/index.html:264-277` (`.cube-wrap` HTML block inside `#diagram-sha3`)
- Modify: `public/crypto/hash/index.html:585-600` (`setupCubeDrag` IIFE)
- Create: `tools/verify_task3_lane_grid.mjs`

**Interfaces:**
- Consumes: nothing from Tasks 1/2 (this task is markup/CSS/drag only, no trace wiring).
- Produces:
  - `#lane-grid` container element (replaces `#cube`), holding 25 `.lane` elements with ids `lane-{x}-{y}` (x,y each 0-4), each carrying class `rate` or `capacity` and a nested `<span class="lane-tick">`.
  - `LANE_CELL` — top-level const (px spacing between lane centers) and `KECCAK_RATE_LANES` — top-level const `Set` of `"x,y"` strings for the 17 rate lanes. Both read by Task 4.
  - `buildLaneGrid()` — top-level function, called once at page load, (re)builds the 25 `.lane` elements and stamps `dataset.baseTransform` on each (its resting `translate3d(...)` position) for Task 4's pi-slide-and-return animation to read.
  - Drag-rotation now targets `#lane-grid` instead of `#cube` (same pointer-delta accumulation pattern, `rotX`/`rotY` state, `apply()` writing `el.style.transform`).

- [ ] **Step 1: Replace the cube CSS with lane-grid + pseudo-3D lane block CSS**

`public/crypto/hash/index.html:143-163` currently reads:

```css
  .cube-wrap{ perspective: 800px; display:flex; flex-direction:column; align-items:center; gap:8px; }
  .cube{ width:90px; height:90px; position:relative; transform-style:preserve-3d;
    transform: rotateX(-20deg) rotateY(30deg); cursor:grab; touch-action:none;
    filter:brightness(1); transition:filter 1.2s ease-out; }
  .cube:active{ cursor:grabbing; }
  /* Task 7: whole-cube brightness pulse for Keccak's 24 internal rounds — same top-up/decay
     convention as Task 6's .pulse variants, but on `filter` (not the box's border/shadow
     properties) so it never touches the `transform` Task 5's drag handler writes inline. */
  .cube.pulse{ filter:brightness(1.6); transition:filter .06s ease-out; }
  .face{ position:absolute; width:90px; height:90px; border:1px solid var(--edge);
    background:linear-gradient(135deg, var(--gold) 0 50%, var(--panel2) 50% 100%); opacity:.92; }
  .face.front{ transform: translateZ(45px); }
  .face.back{ transform: translateZ(-45px) rotateY(180deg); }
  .face.left{ transform: translateX(-45px) rotateY(-90deg); }
  .face.right{ transform: translateX(45px) rotateY(90deg); }
  .face.top{ transform: translateY(-45px) rotateX(90deg); }
  .face.bottom{ transform: translateY(45px) rotateX(-90deg); }
  .cube-legend{ font-family:var(--mono); font-size:.62rem; color:var(--dim); display:flex; gap:10px; }
  .legend-rate::before{ content:'■ '; color:var(--gold); }
  .legend-capacity::before{ content:'■ '; color:var(--dim); }
```

Replace with:

```css
  .cube-wrap{ perspective: 800px; display:flex; flex-direction:column; align-items:center; gap:8px; }
  .lane-grid{ width:1px; height:1px; position:relative; transform-style:preserve-3d;
    transform: rotateX(-20deg) rotateY(30deg); cursor:grab; touch-action:none; }
  .lane-grid:active{ cursor:grabbing; }
  .lane{ position:absolute; top:-13px; left:-13px; width:26px; height:26px;
    transform-style:preserve-3d; border:1px solid var(--edge); background:var(--gold);
    opacity:.92; filter:brightness(1);
    transition:filter 1.2s ease-out; }
  .lane.capacity{ background:var(--panel2); }
  /* same top-up/decay pulse convention as .stage-box/.cube/.chain-link elsewhere in this file */
  .lane.pulse{ filter:brightness(1.85); transition:filter .06s ease-out; }
  /* pseudo-3D block: the .lane div itself is the front face; ::before/::after are the top and
     right-side faces, rotated into the XZ / YZ planes off the front face's own edges — same
     rotateX/rotateY 3D-transform technique as the single cube this replaces, just sized down to
     one lane instead of one 90px cube. */
  .lane::before, .lane::after{ content:''; position:absolute; background:inherit; border:1px solid var(--edge); }
  .lane::before{ width:26px; height:13px; top:-13px; left:0; filter:brightness(1.3);
    transform:rotateX(90deg); transform-origin:bottom; }
  .lane::after{ width:13px; height:26px; top:0; right:-13px; filter:brightness(.65);
    transform:rotateY(90deg); transform-origin:left; }
  .lane-tick{ position:absolute; left:50%; top:50%; width:2px; height:11px; background:var(--ink);
    transform:translate(-50%,-100%) rotate(0deg); transform-origin:bottom center; opacity:.55; }
  .cube-legend{ font-family:var(--mono); font-size:.62rem; color:var(--dim); display:flex; gap:10px; }
  .legend-rate::before{ content:'■ '; color:var(--gold); }
  .legend-capacity::before{ content:'■ '; color:var(--dim); }
```

- [ ] **Step 2: Replace the static cube markup with an empty `#lane-grid` container**

`public/crypto/hash/index.html:264-277` currently reads:

```html
      <div class="cube-wrap" id="cube-wrap">
        <div class="cube" id="cube">
          <div class="face front"></div>
          <div class="face back"></div>
          <div class="face left"></div>
          <div class="face right"></div>
          <div class="face top"></div>
          <div class="face bottom"></div>
        </div>
        <div class="cube-legend">
          <span class="legend-rate">rate — exposed</span>
          <span class="legend-capacity">capacity — hidden</span>
        </div>
      </div>
```

Replace with:

```html
      <div class="cube-wrap" id="cube-wrap">
        <div class="lane-grid" id="lane-grid"></div>
        <div class="cube-legend">
          <span class="legend-rate">rate — exposed (17 lanes)</span>
          <span class="legend-capacity">capacity — hidden (8 lanes)</span>
        </div>
      </div>
```

- [ ] **Step 3: Add `buildLaneGrid()` and call it once at load, near the other top-level algorithm consts**

Immediately after the `laneHex` function definition (`public/crypto/hash/index.html:379`, `function laneHex(x) { return x.toString(16).padStart(16,'0'); }`), insert:

```js
const LANE_CELL = 34; // px between lane centers; keeps the 5x5 grid's footprint close to the old 90x90 cube
const KECCAK_RATE_LANES = new Set();
for (let i = 0; i < 17; i++) {
  // mirrors the absorb-order logic already used in keccak256WithTrace's j-loop
  // (x=(j/8)%5, y=Math.floor((j/8)/5)): the first 17 lanes visited for rateBytes=136 are
  // exactly the rate lanes, the remaining 8 are the capacity lanes.
  const x = i % 5, y = Math.floor(i / 5);
  KECCAK_RATE_LANES.add(`${x},${y}`);
}

function buildLaneGrid() {
  const grid = document.getElementById('lane-grid');
  grid.innerHTML = '';
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      const lane = document.createElement('div');
      lane.className = 'lane ' + (KECCAK_RATE_LANES.has(`${x},${y}`) ? 'rate' : 'capacity');
      lane.id = `lane-${x}-${y}`;
      lane.dataset.x = String(x);
      lane.dataset.y = String(y);
      const baseTransform = `translate3d(${(x - 2) * LANE_CELL}px, ${(y - 2) * LANE_CELL}px, 0)`;
      lane.dataset.baseTransform = baseTransform;
      lane.style.transform = baseTransform;
      const tick = document.createElement('span');
      tick.className = 'lane-tick';
      lane.appendChild(tick);
      grid.appendChild(lane);
    }
  }
}
buildLaneGrid();
```

- [ ] **Step 4: Adapt `setupCubeDrag` to target `#lane-grid`**

`public/crypto/hash/index.html:585-600` currently reads:

```js
(function setupCubeDrag() {
  const cube = document.getElementById('cube');
  let rotX = -20, rotY = 30, dragging = false, lastX = 0, lastY = 0;
  function apply() { cube.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`; }
  cube.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; cube.setPointerCapture(e.pointerId); });
  cube.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    rotY += dx * 0.5; rotX -= dy * 0.5;
    lastX = e.clientX; lastY = e.clientY;
    apply();
  });
  cube.addEventListener('pointerup', () => { dragging = false; });
  cube.addEventListener('pointercancel', () => { dragging = false; });
  apply();
})();
```

Replace with:

```js
(function setupLaneGridDrag() {
  const grid = document.getElementById('lane-grid');
  let rotX = -20, rotY = 30, dragging = false, lastX = 0, lastY = 0;
  function apply() { grid.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`; }
  grid.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; grid.setPointerCapture(e.pointerId); });
  grid.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    rotY += dx * 0.5; rotX -= dy * 0.5;
    lastX = e.clientX; lastY = e.clientY;
    apply();
  });
  grid.addEventListener('pointerup', () => { dragging = false; });
  grid.addEventListener('pointercancel', () => { dragging = false; });
  apply();
})();
```

- [ ] **Step 5: Remove the now-dead `cube-r` branch's DOM dependency risk (leave the fallback branch itself for Task 4 to clean up)**

No code change needed in this step — `pulseBoxOrCube`'s `cube-r` branch (`public/crypto/hash/index.html:713-721`) references `document.getElementById('cube')`, which now returns `null` since Step 2 removed `#cube`. That branch never fires post-Task-2 (no more `cube-r*` events are emitted), so `cube.classList.add('pulse')` on a `null` would only throw if the branch ever ran — it can't. Leave it; Task 4 removes this dead branch outright as part of its own edit to the same function.

- [ ] **Step 6: Write and run a Playwright smoke check**

Create `/Users/gaura/PCAN/ceasar-ctf/tools/verify_task3_lane_grid.mjs`:

```js
import { chromium } from 'playwright';

const BASE_URL = process.env.HASH_MODULE_URL || 'http://localhost:8787/public/crypto/hash/';

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => consoleErrors.push(String(err)));

await page.goto(BASE_URL + '?v=task3');
await page.waitForSelector('#lane-grid');

const laneCount = await page.locator('.lane').count();
if (laneCount !== 25) throw new Error(`expected 25 .lane elements, found ${laneCount}`);

const rateCount = await page.locator('.lane.rate').count();
const capacityCount = await page.locator('.lane.capacity').count();
if (rateCount !== 17) throw new Error(`expected 17 rate lanes, found ${rateCount}`);
if (capacityCount !== 8) throw new Error(`expected 8 capacity lanes, found ${capacityCount}`);

// switch to SHA-3 so the lane grid is visible, then drag it and confirm the transform changed
await page.click('#algo-next'); // MD5 -> SHA-3 (only two algorithms, so one click toggles)
await page.waitForSelector('#lane-grid:visible', { timeout: 2000 }).catch(() => {});
const grid = page.locator('#lane-grid');
const before = await grid.evaluate(el => el.style.transform);
const box = await grid.boundingBox();
if (!box) throw new Error('#lane-grid has no bounding box (not visible)');
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 40, { steps: 8 });
await page.mouse.up();
const after = await grid.evaluate(el => el.style.transform);
if (after === before) throw new Error(`drag did not change #lane-grid transform (still "${before}")`);

if (consoleErrors.length) throw new Error('console errors: ' + consoleErrors.join(' | '));

console.log('OK  25 lanes (17 rate / 8 capacity) rendered, drag-rotation changes transform, no console errors');
await browser.close();
```

Run (with the local server already up from Task 1 Step 6, or start it fresh: `python3 -m http.server 8787 &`):

```bash
cd /Users/gaura/PCAN/ceasar-ctf
node tools/verify_task3_lane_grid.mjs
```

Expected: prints the `OK` line and exits 0.

- [ ] **Step 7: Commit**

```bash
cd /Users/gaura/PCAN/ceasar-ctf
git add public/crypto/hash/index.html tools/verify_task3_lane_grid.mjs
git commit -m "hash module: SHA-3 25-lane CSS-3D grid replacing single cube (markup/CSS/drag only)"
```

---

## Task 4: SHA-3 animation wiring

**Model:** standard — consumes two prior tasks' outputs, needs correct per-event-kind branching (theta/rho/pi/chi/iota each animate differently) and a live counter; moderate complexity, low ambiguity since the event schema and lane map already exist.

**Files:**
- Modify: `public/crypto/hash/index.html:264-277` (add round-counter element inside `#cube-wrap`, as left by Task 3's Step 2 edit)
- Modify: `public/crypto/hash/index.html` CSS block (add `.round-counter`, `.pi-slide` and rho-tick rules near the Task 3 lane CSS)
- Modify: `public/crypto/hash/index.html:713-721` (`pulseBoxOrCube` — drop the dead `cube-r` branch)
- Modify: `public/crypto/hash/index.html:770-782` (`onHashClick`'s SHA-3 branch — wire the new `pulseLanesFor`)
- Create: `tools/verify_task4_sha3_animation.mjs`

**Interfaces:**
- Consumes: `KECCAK_PI_LANE_MAP`, `ALL_25_LANES` (Task 2); `#lane-grid`/`.lane`/`.lane-tick`/`LANE_CELL`/`KECCAK_RATE_LANES`/`buildLaneGrid()`/`dataset.baseTransform` (Task 3); `KECCAK_RHO_OFFSETS` (pre-existing, `public/crypto/hash/index.html:376`).
- Produces: `pulseLanesFor(ev)` — top-level function, returns `true` and pulses/animates the relevant `.lane` elements if `ev.boxId` matches `lane-r{n}-(theta|rho|pi|chi|iota)`, else returns `false` and does nothing (so callers fall back to `pulseBoxOrCube`). `#round-counter` element text is updated on every `iota` event. `applyRhoTicks()` — top-level function, called once at load, stamps each lane's `.lane-tick` with a `--tick-deg` custom property derived from `KECCAK_RHO_OFFSETS`.

- [ ] **Step 1: Add round-counter markup and CSS**

`public/crypto/hash/index.html` (Task 3 left `#cube-wrap` as):

```html
      <div class="cube-wrap" id="cube-wrap">
        <div class="lane-grid" id="lane-grid"></div>
        <div class="cube-legend">
          <span class="legend-rate">rate — exposed (17 lanes)</span>
          <span class="legend-capacity">capacity — hidden (8 lanes)</span>
        </div>
      </div>
```

Add a round-counter line after the legend:

```html
      <div class="cube-wrap" id="cube-wrap">
        <div class="lane-grid" id="lane-grid"></div>
        <div class="cube-legend">
          <span class="legend-rate">rate — exposed (17 lanes)</span>
          <span class="legend-capacity">capacity — hidden (8 lanes)</span>
        </div>
        <div class="round-counter" id="round-counter">round — / 24</div>
      </div>
```

In the CSS block, immediately after the `.lane-tick{...}` rule Task 3 added, insert:

```css
  .round-counter{ font-family:var(--mono); font-size:.7rem; color:var(--dim); }
  .lane.pulse .lane-tick{ transform:translate(-50%,-100%) rotate(var(--tick-deg, 0deg));
    transition:transform .3s ease-out; }
```

- [ ] **Step 2: Write `applyRhoTicks()` and call it once, right after `buildLaneGrid()`'s call site**

`public/crypto/hash/index.html`, right after the `buildLaneGrid();` call Task 3 added, insert:

```js
function applyRhoTicks() {
  for (let x = 0; x < 5; x++) {
    for (let y = 0; y < 5; y++) {
      const el = document.getElementById(`lane-${x}-${y}`);
      const tick = el && el.querySelector('.lane-tick');
      if (!tick) continue;
      const deg = (KECCAK_RHO_OFFSETS[x][y] % 64) * (360 / 64);
      tick.style.setProperty('--tick-deg', deg + 'deg');
    }
  }
}
applyRhoTicks();
```

- [ ] **Step 3: Write `pulseLanesFor(ev)`, placed near `pulseBoxOrCube` (`public/crypto/hash/index.html:713`)**

Immediately before the `pulseBoxOrCube` function definition, insert:

```js
// Consumes Task 2's per-round theta/rho/pi/chi/iota trace events and pulses exactly the lanes
// each event names. Returns false for any other boxId so the caller can fall through to the
// generic pulseBoxOrCube handling (pad/absorb-split/squeeze/output boxes).
function pulseLanesFor(ev) {
  const m = /^lane-r(\d+)-(theta|rho|pi|chi|iota)$/.exec(ev.boxId);
  if (!m) return false;
  const rnd = Number(m[1]);
  const step = m[2];
  const lanes = ev.lanes || [];
  lanes.forEach(([x, y]) => {
    const el = document.getElementById(`lane-${x}-${y}`);
    if (!el) return;
    el.classList.add('pulse');
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('pulse')));
    if (step === 'pi') {
      const [nx, ny] = KECCAK_PI_LANE_MAP[x][y];
      const tx = (nx - 2) * LANE_CELL, ty = (ny - 2) * LANE_CELL;
      el.style.transition = 'transform .22s ease-in-out';
      el.style.transform = `translate3d(${tx}px, ${ty}px, 12px)`;
      setTimeout(() => { el.style.transform = el.dataset.baseTransform; }, 220);
    }
  });
  if (step === 'iota') {
    const counter = document.getElementById('round-counter');
    if (counter) counter.textContent = `round ${rnd + 1} / 24`;
  }
  return true;
}
```

- [ ] **Step 4: Strip the dead `cube-r` branch out of `pulseBoxOrCube`**

`public/crypto/hash/index.html:713-721` currently reads:

```js
function pulseBoxOrCube(boxId, sample) {
  if (boxId.startsWith('cube-r')) {
    const cube = document.getElementById('cube');
    cube.classList.add('pulse');
    requestAnimationFrame(() => requestAnimationFrame(() => cube.classList.remove('pulse')));
    return;
  }
  pulseBox(boxId, sample);
}
```

Replace with:

```js
function pulseBoxOrCube(boxId, sample) {
  pulseBox(boxId, sample);
}
```

(Task 6 adds a `chain-N` branch back into this same function later — it is deliberately left this simple for now.)

- [ ] **Step 5: Wire `pulseLanesFor` into the SHA-3 hash click handler, and reset the round counter**

`public/crypto/hash/index.html:770-782` currently reads:

```js
  if (algo === 'sha3') {
    const { digest, trace } = keccak256WithTrace(bytes);
    const numBlocks = Number(trace.find(e => e.boxId === 'absorb-split').sample.split(' ')[0]);
    renderSha3AbsorbChain(numBlocks);
    showDiagramFor('sha3');
    playTrace(trace, getSpeedMs, (ev) => pulseBoxOrCube(ev.boxId, ev.sample), () => {
      addHistoryEntry(algo, digest, bytes, label);
      document.getElementById('output-digest').textContent = digest;
      document.getElementById('output-bits').textContent = '256-bit / 64 hex chars';
      document.getElementById('output-box').classList.add('active-flash');
      setTimeout(() => document.getElementById('output-box').classList.remove('active-flash'), 400);
    });
  }
```

Replace with:

```js
  if (algo === 'sha3') {
    const { digest, trace } = keccak256WithTrace(bytes);
    const numBlocks = Number(trace.find(e => e.boxId === 'absorb-split').sample.split(' ')[0]);
    renderSha3AbsorbChain(numBlocks);
    showDiagramFor('sha3');
    document.getElementById('round-counter').textContent = 'round 0 / 24';
    playTrace(trace, getSpeedMs, (ev) => { if (!pulseLanesFor(ev)) pulseBoxOrCube(ev.boxId, ev.sample); }, () => {
      addHistoryEntry(algo, digest, bytes, label);
      document.getElementById('output-digest').textContent = digest;
      document.getElementById('output-bits').textContent = '256-bit / 64 hex chars';
      document.getElementById('output-box').classList.add('active-flash');
      setTimeout(() => document.getElementById('output-box').classList.remove('active-flash'), 400);
    });
  }
```

- [ ] **Step 6: Write and run a Playwright smoke check**

Create `/Users/gaura/PCAN/ceasar-ctf/tools/verify_task4_sha3_animation.mjs`:

```js
import { chromium } from 'playwright';

const BASE_URL = process.env.HASH_MODULE_URL || 'http://localhost:8787/public/crypto/hash/';

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => consoleErrors.push(String(err)));

await page.goto(BASE_URL + '?v=task4');
await page.click('#algo-next'); // switch to SHA-3
await page.fill('#input-custom', 'crypto-101');
// custom preset is index 0, already selected by default — no need to arrow to it
await page.locator('#speed-slider').evaluate(el => { el.value = '100'; }); // fastest speed
await page.click('#hash-btn');

// wait for the round counter to reach the final round
await page.waitForFunction(
  () => document.getElementById('round-counter').textContent === 'round 24 / 24',
  { timeout: 15000 }
);

const digest = await page.locator('#output-digest').innerText();
if (!/^[0-9a-f]{64}$/.test(digest)) throw new Error(`unexpected SHA-3 digest format: "${digest}"`);

if (consoleErrors.length) throw new Error('console errors: ' + consoleErrors.join(' | '));

console.log(`OK  round counter reached 24/24, digest rendered (${digest}), no console errors`);
await browser.close();
```

Run:

```bash
cd /Users/gaura/PCAN/ceasar-ctf
node tools/verify_task4_sha3_animation.mjs
```

Expected: prints the `OK` line and exits 0.

- [ ] **Step 7: Commit**

```bash
cd /Users/gaura/PCAN/ceasar-ctf
git add public/crypto/hash/index.html tools/verify_task4_sha3_animation.mjs
git commit -m "hash module: wire SHA-3 lane grid to theta/rho/pi/chi/iota trace events + live round counter"
```

---

## Task 5: MD5 register-state UI

**Model:** standard — new markup replacing an existing diagram section plus a nontrivial DOM-update function driven by 6 new trace fields; moderate complexity, moderate ambiguity in visual layout (spec gives requirements, not pixel layout).

**Files:**
- Modify: `public/crypto/hash/index.html:218-255` (`#diagram-md5`'s `block-group-0` inner markup — replace `round-row` with the register view)
- Modify: `public/crypto/hash/index.html` CSS block (add `.reg-row`/`.reg-box`/`.reg-val`/`.func-row`/`.func-box`/`.step-detail`/`.step-counter`)
- Modify: `public/crypto/hash/index.html:757-769` (`onHashClick`'s MD5 branch — call the new `updateMd5RegisterView`)
- Create: `tools/verify_task5_md5_registers.mjs`

**Interfaces:**
- Consumes: `regs`/`func`/`mIndex`/`shift`/`k`/`step` fields on `-loop` trace events (Task 1).
- Produces: `updateMd5RegisterView(ev)` — top-level function, called from the MD5 `onEvent` callback in `onHashClick`; reads `ev.boxId` for the block index and updates that block's register/function/step DOM. Element-id convention `reg-{blk}-A|B|C|D`, `func-{blk}-F|G|H|I`, `mword-{blk}`, `shift-{blk}`, `kconst-{blk}`, `step-counter-{blk}` — Task 6's `renderMd5BlockChain` rewrite generates these same ids for every dynamically-created block.

- [ ] **Step 1: Replace `block-group-0`'s round-row with the register-view markup**

`public/crypto/hash/index.html:218-255` currently reads (the whole `#diagram-md5` block; only `block-group-0`'s inner content changes):

```html
    <div class="diagram" id="diagram-md5">
      <div class="stage-box" id="hash-box-pad"><span class="box-title">Pad</span><span class="sample"></span></div>
      <div class="flow-arrow"></div>
      <div class="stage-box" id="hash-box-split"><span class="box-title">Split into 512-bit blocks</span><span class="sample"></span></div>
      <div class="flow-arrow"></div>
      <div class="block-chain" id="md5-block-chain">
        <div class="block-group" id="block-group-0">
          <div class="block-label">Block 0</div>
          <div class="round-row">
            <div class="stage-box round-box" id="hash-box-block-0-r1">
              <span class="box-title">Round 1</span>
              <span class="loop-dot" id="hash-box-block-0-r1-loop"></span>
              <span class="sample"></span>
            </div>
            <div class="stage-box round-box" id="hash-box-block-0-r2">
              <span class="box-title">Round 2</span>
              <span class="loop-dot" id="hash-box-block-0-r2-loop"></span>
              <span class="sample"></span>
            </div>
            <div class="stage-box round-box" id="hash-box-block-0-r3">
              <span class="box-title">Round 3</span>
              <span class="loop-dot" id="hash-box-block-0-r3-loop"></span>
              <span class="sample"></span>
            </div>
            <div class="stage-box round-box" id="hash-box-block-0-r4">
              <span class="box-title">Round 4</span>
              <span class="loop-dot" id="hash-box-block-0-r4-loop"></span>
              <span class="sample"></span>
            </div>
          </div>
        </div>
        <div class="chain-link" id="hash-box-chain-0" title="entire state passed in the clear — this hand-off is what a length-extension attack exploits"><span>chains into next block</span></div>
        <!-- Task 6 adds/removes additional block-group / chain-link elements here for however many
             real blocks the current input actually produces (block count varies by input length) -->
      </div>
      <div class="flow-arrow"></div>
      <div class="stage-box" id="hash-box-output"><span class="box-title">Output state</span><span class="sample"></span></div>
    </div>
```

Replace with:

```html
    <div class="diagram" id="diagram-md5">
      <div class="stage-box" id="hash-box-pad"><span class="box-title">Pad</span><span class="sample"></span></div>
      <div class="flow-arrow"></div>
      <div class="stage-box" id="hash-box-split"><span class="box-title">Split into 512-bit blocks</span><span class="sample"></span></div>
      <div class="flow-arrow"></div>
      <div class="block-chain" id="md5-block-chain">
        <div class="block-group" id="block-group-0">
          <div class="block-label">Block 0</div>
          <div class="reg-row" id="reg-row-0">
            <div class="stage-box reg-box" id="reg-0-A"><span class="box-title">A</span><span class="reg-val">67452301</span></div>
            <div class="stage-box reg-box" id="reg-0-B"><span class="box-title">B</span><span class="reg-val">efcdab89</span></div>
            <div class="stage-box reg-box" id="reg-0-C"><span class="box-title">C</span><span class="reg-val">98badcfe</span></div>
            <div class="stage-box reg-box" id="reg-0-D"><span class="box-title">D</span><span class="reg-val">10325476</span></div>
          </div>
          <div class="func-row" id="func-row-0">
            <span class="func-box" id="func-0-F">F</span>
            <span class="func-box" id="func-0-G">G</span>
            <span class="func-box" id="func-0-H">H</span>
            <span class="func-box" id="func-0-I">I</span>
          </div>
          <div class="step-detail" id="step-detail-0">
            <span id="mword-0">M[—]</span><span id="shift-0">s=—</span><span id="kconst-0">K=—</span>
          </div>
          <div class="step-counter" id="step-counter-0">step — / 64</div>
        </div>
        <div class="chain-link" id="hash-box-chain-0" title="entire state passed in the clear — this hand-off is what a length-extension attack exploits"><span>chains into next block</span></div>
        <!-- Task 6 adds/removes additional block-group elements here for however many real
             blocks the current input actually produces (block count varies by input length) -->
      </div>
      <div class="flow-arrow"></div>
      <div class="stage-box" id="hash-box-output"><span class="box-title">Output state</span><span class="sample"></span></div>
    </div>
```

- [ ] **Step 2: Add the register-view CSS**

In the CSS block, immediately after the `.round-box{...}` rule (`public/crypto/hash/index.html:118`), insert:

```css
  .reg-row{ display:flex; gap:8px; flex-wrap:wrap; justify-content:center; }
  .reg-box{ min-width:90px; padding:8px 10px; }
  .reg-val{ font-family:var(--mono); font-size:.8rem; color:var(--ink); }
  .func-row{ display:flex; gap:8px; justify-content:center; font-family:var(--mono);
    font-size:.72rem; margin-top:6px; }
  .func-box{ padding:4px 10px; border:1px solid var(--edge); border-radius:6px; color:var(--dim);
    transition:border-color .2s, color .2s, background-color .2s; }
  .func-box.active{ border-color:var(--accent); color:var(--accent);
    background:color-mix(in srgb, var(--accent) 12%, transparent); }
  .step-detail{ display:flex; gap:14px; justify-content:center; font-family:var(--mono);
    font-size:.7rem; color:var(--dim); margin-top:6px; }
  .step-counter{ font-family:var(--mono); font-size:.68rem; color:var(--dim);
    text-align:center; margin-top:4px; }
```

- [ ] **Step 3: Write `updateMd5RegisterView(ev)`, placed near `pulseBox` (`public/crypto/hash/index.html:639`)**

Immediately after the `pulseBox` function definition, insert:

```js
// Consumes Task 1's per-step regs/func/mIndex/shift/k fields on block-{blk}-r{round}-loop
// events and updates that block's live A/B/C/D register readout, active-function highlight,
// M[g]/s[i]/K[i] display, and step counter. Task 6's renderMd5BlockChain generates the same
// reg-{blk}-*/func-{blk}-*/mword-{blk}/shift-{blk}/kconst-{blk}/step-counter-{blk} ids for every
// dynamically-created block, so this function works unmodified once Task 6 lands.
function updateMd5RegisterView(ev) {
  const m = /^block-(\d+)-r\d+-loop$/.exec(ev.boxId);
  if (!m || !ev.regs) return;
  const blk = m[1];
  const root = document.getElementById('diagram-md5');
  if (!root) return;
  const setReg = (letter) => {
    const el = root.querySelector(`#reg-${blk}-${letter}`);
    if (!el) return;
    const valEl = el.querySelector('.reg-val');
    if (valEl) valEl.textContent = ev.regs[letter];
    el.classList.add('pulse');
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('pulse')));
  };
  ['A', 'B', 'C', 'D'].forEach(setReg);
  ['F', 'G', 'H', 'I'].forEach(fn => {
    const el = root.querySelector(`#func-${blk}-${fn}`);
    if (el) el.classList.toggle('active', fn === ev.func);
  });
  const mwordEl = root.querySelector(`#mword-${blk}`);
  if (mwordEl) mwordEl.textContent = `M[${ev.mIndex}]`;
  const shiftEl = root.querySelector(`#shift-${blk}`);
  if (shiftEl) shiftEl.textContent = `s=${ev.shift}`;
  const kEl = root.querySelector(`#kconst-${blk}`);
  if (kEl) kEl.textContent = `K=${ev.k}`;
  const stepEl = root.querySelector(`#step-counter-${blk}`);
  if (stepEl) stepEl.textContent = `step ${ev.step + 1} / 64`;
}
```

- [ ] **Step 4: Call `updateMd5RegisterView` from the MD5 hash-click handler**

`public/crypto/hash/index.html:757-769` currently reads:

```js
  if (algo === 'md5') {
    const { digest, trace } = md5WithTrace(bytes);
    const numBlocks = Number(trace.find(e => e.boxId === 'split').sample.split(' ')[0]);
    renderMd5BlockChain(numBlocks);
    showDiagramFor('md5');
    playTrace(trace, getSpeedMs, (ev) => pulseBoxOrCube(ev.boxId, ev.sample), () => {
      addHistoryEntry(algo, digest, bytes, label);
      document.getElementById('output-digest').textContent = digest;
      document.getElementById('output-bits').textContent = '128-bit / 32 hex chars';
      document.getElementById('output-box').classList.add('active-flash');
      setTimeout(() => document.getElementById('output-box').classList.remove('active-flash'), 400);
    });
  }
```

Replace with:

```js
  if (algo === 'md5') {
    const { digest, trace } = md5WithTrace(bytes);
    const numBlocks = Number(trace.find(e => e.boxId === 'split').sample.split(' ')[0]);
    renderMd5BlockChain(numBlocks);
    showDiagramFor('md5');
    playTrace(trace, getSpeedMs, (ev) => { pulseBoxOrCube(ev.boxId, ev.sample); updateMd5RegisterView(ev); }, () => {
      addHistoryEntry(algo, digest, bytes, label);
      document.getElementById('output-digest').textContent = digest;
      document.getElementById('output-bits').textContent = '128-bit / 32 hex chars';
      document.getElementById('output-box').classList.add('active-flash');
      setTimeout(() => document.getElementById('output-box').classList.remove('active-flash'), 400);
    });
  }
```

- [ ] **Step 5: Write and run a Playwright smoke check**

Create `/Users/gaura/PCAN/ceasar-ctf/tools/verify_task5_md5_registers.mjs`:

```js
import { chromium } from 'playwright';

const BASE_URL = process.env.HASH_MODULE_URL || 'http://localhost:8787/public/crypto/hash/';

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => consoleErrors.push(String(err)));

await page.goto(BASE_URL + '?v=task5');
await page.fill('#input-custom', 'register test');
await page.locator('#speed-slider').evaluate(el => { el.value = '100'; });

const initialA = await page.locator('#reg-0-A .reg-val').innerText();
await page.click('#hash-btn');

await page.waitForFunction(
  () => document.getElementById('step-counter-0').textContent === 'step 64 / 64',
  { timeout: 15000 }
);

const finalA = await page.locator('#reg-0-A .reg-val').innerText();
if (finalA === initialA) throw new Error('register A value did not change during MD5 animation');
if (!/^[0-9a-f]{8}$/.test(finalA)) throw new Error(`unexpected register A format: "${finalA}"`);

const activeFuncCount = await page.locator('.func-box.active').count();
if (activeFuncCount !== 1) throw new Error(`expected exactly 1 active func-box at animation end, found ${activeFuncCount}`);

if (consoleErrors.length) throw new Error('console errors: ' + consoleErrors.join(' | '));

console.log('OK  register A changed during animation, step counter reached 64/64, exactly one active func-box, no console errors');
await browser.close();
```

Run:

```bash
cd /Users/gaura/PCAN/ceasar-ctf
node tools/verify_task5_md5_registers.mjs
```

Expected: prints the `OK` line and exits 0.

- [ ] **Step 6: Commit**

```bash
cd /Users/gaura/PCAN/ceasar-ctf
git add public/crypto/hash/index.html tools/verify_task5_md5_registers.mjs
git commit -m "hash module: MD5 A/B/C/D register-state view replacing 4-round-box diagram"
```

---

## Task 6: MD5 Z-axis block-stack chaining

**Model:** standard — full rewrite of `renderMd5BlockChain` plus new CSS-3D stacking and a hand-off pulse mechanic; moderate complexity, sequenced after Task 5 specifically to avoid touching the same markup region concurrently.

**Files:**
- Modify: `public/crypto/hash/index.html:662-692` (`renderMd5BlockChain`)
- Modify: `public/crypto/hash/index.html:218-255` (`#md5-block-chain` — emptied out, plus new `#stack-caption` element)
- Modify: `public/crypto/hash/index.html` CSS block (`.block-chain`/`.block-group` restacked; remove now-dead `.chain-link`/`.loop-dot`/`.round-box` rules; add `.stack-caption`)
- Modify: `public/crypto/hash/index.html:713-` (`pulseBoxOrCube` — add the `chain-N` hand-off branch back in)
- Create: `tools/verify_task6_block_stack.mjs`

**Interfaces:**
- Consumes: `updateMd5RegisterView`'s element-id convention (Task 5) — `renderMd5BlockChain` must generate `reg-{blk}-A|B|C|D`, `func-{blk}-F|G|H|I`, `mword-{blk}`, `shift-{blk}`, `kconst-{blk}`, `step-counter-{blk}` for every block index `blk` it creates. Consumes the existing `chain-{blk-1}` trace event already pushed by `md5WithTrace` (`public/crypto/hash/index.html:326`, unmodified by this plan) as the hand-off pulse trigger.
- Produces: `renderMd5BlockChain(numBlocks)` — same signature as before, now always clears and rebuilds `#md5-block-chain` from scratch (no more "reuse static block-group-0" special case). `#stack-caption` element, toggled visible only when `numBlocks > 1`.

- [ ] **Step 1: Empty out `#md5-block-chain`'s static content and add `#stack-caption`**

`public/crypto/hash/index.html:218-255` currently reads (post-Task-5):

```html
    <div class="diagram" id="diagram-md5">
      <div class="stage-box" id="hash-box-pad"><span class="box-title">Pad</span><span class="sample"></span></div>
      <div class="flow-arrow"></div>
      <div class="stage-box" id="hash-box-split"><span class="box-title">Split into 512-bit blocks</span><span class="sample"></span></div>
      <div class="flow-arrow"></div>
      <div class="block-chain" id="md5-block-chain">
        <div class="block-group" id="block-group-0">
          <div class="block-label">Block 0</div>
          <div class="reg-row" id="reg-row-0">
            <div class="stage-box reg-box" id="reg-0-A"><span class="box-title">A</span><span class="reg-val">67452301</span></div>
            <div class="stage-box reg-box" id="reg-0-B"><span class="box-title">B</span><span class="reg-val">efcdab89</span></div>
            <div class="stage-box reg-box" id="reg-0-C"><span class="box-title">C</span><span class="reg-val">98badcfe</span></div>
            <div class="stage-box reg-box" id="reg-0-D"><span class="box-title">D</span><span class="reg-val">10325476</span></div>
          </div>
          <div class="func-row" id="func-row-0">
            <span class="func-box" id="func-0-F">F</span>
            <span class="func-box" id="func-0-G">G</span>
            <span class="func-box" id="func-0-H">H</span>
            <span class="func-box" id="func-0-I">I</span>
          </div>
          <div class="step-detail" id="step-detail-0">
            <span id="mword-0">M[—]</span><span id="shift-0">s=—</span><span id="kconst-0">K=—</span>
          </div>
          <div class="step-counter" id="step-counter-0">step — / 64</div>
        </div>
        <div class="chain-link" id="hash-box-chain-0" title="entire state passed in the clear — this hand-off is what a length-extension attack exploits"><span>chains into next block</span></div>
        <!-- Task 6 adds/removes additional block-group elements here for however many real
             blocks the current input actually produces (block count varies by input length) -->
      </div>
      <div class="flow-arrow"></div>
      <div class="stage-box" id="hash-box-output"><span class="box-title">Output state</span><span class="sample"></span></div>
    </div>
```

Replace with:

```html
    <div class="diagram" id="diagram-md5">
      <div class="stage-box" id="hash-box-pad"><span class="box-title">Pad</span><span class="sample"></span></div>
      <div class="flow-arrow"></div>
      <div class="stage-box" id="hash-box-split"><span class="box-title">Split into 512-bit blocks</span><span class="sample"></span></div>
      <div class="flow-arrow"></div>
      <div class="block-chain" id="md5-block-chain"></div>
      <div class="stack-caption" id="stack-caption">state carries forward, card to card — this hand-off in the clear is what a length-extension attack exploits</div>
      <div class="flow-arrow"></div>
      <div class="stage-box" id="hash-box-output"><span class="box-title">Output state</span><span class="sample"></span></div>
    </div>
```

`renderMd5BlockChain` (rewritten in Step 3 below) fully populates `#md5-block-chain` on every render, including for the single-block case, so no static block-group-0 needs to remain in the HTML.

- [ ] **Step 2: Restack the CSS — remove dead rules, add the Z-stack + caption rules**

In the CSS block, the current `.block-chain`/`.block-group`/`.round-row`/`.round-box`/`.loop-dot`/`.chain-link` rules (`public/crypto/hash/index.html:113-140`, as they stand after Task 5's Step 2 edit) read:

```css
  .block-chain{display:flex; align-items:flex-start; gap:22px; flex-wrap:wrap; justify-content:center}
  .block-group{display:flex; flex-direction:column; align-items:center; gap:8px;
    border:1px dashed var(--edge); border-radius:10px; padding:12px}
  .block-label{font-family:var(--mono); font-size:.66rem; letter-spacing:.18em; text-transform:uppercase; color:var(--dim)}
  .round-row{display:flex; gap:8px; flex-wrap:wrap; justify-content:center}
  .round-box{min-width:110px; padding:10px 12px; position:relative}
  .loop-dot{width:9px; height:9px; border-radius:50%; background:var(--edge); display:inline-block;
    transition:background .2s, transform .2s, box-shadow 1.2s ease-out}
  .loop-dot.spin{background:var(--gold); animation:loopSpin .5s linear infinite}
  /* fast-in/slow-out "breathing" pulse, same top-up/decay convention as .stage-box/.cube/.chain-link:
     .pulse gets a quick transition in, then two frames later JS removes the class and the base
     .loop-dot rule above (1.2s ease-out) carries the glow back down instead of snapping it off. */
  .loop-dot.pulse{background:var(--gold); box-shadow:0 0 6px var(--gold);
    transition:background .06s ease-out, box-shadow .06s ease-out}
  @keyframes loopSpin{ 0%{transform:rotate(0)} 100%{transform:rotate(360deg)} }

  .chain-link{display:none; align-items:center; justify-content:center; gap:6px;
    font-family:var(--mono); font-size:.66rem; color:var(--dim); letter-spacing:.1em;
    border:1px solid var(--edge); border-radius:20px; padding:4px 12px; background:var(--panel2);
    /* box-shadow decays at the same 1.2s ease-out as .stage-box/.flow-arrow/.cube/.loop-dot, so
       the length-extension callout — the spec's spotlight element — breathes with the same
       fast-in/slow-out feel as everything else, not a flat symmetric .2s fade */
    transition:border-color .2s, color .2s, box-shadow 1.2s ease-out}
  .chain-link.shown{display:flex}
  .chain-link.active{border-color:var(--gold); color:var(--gold)}
  .chain-link.pulse{border-color:var(--accent); color:var(--accent); box-shadow:0 0 8px var(--accent);
    transition:border-color .06s ease-out, color .06s ease-out, box-shadow .06s ease-out}
```

Replace with:

```css
  .block-chain{ position:relative; perspective:900px; display:flex; justify-content:center;
    align-items:flex-start; min-height:230px; padding-top:6px; }
  .block-group{ position:absolute; top:0; left:50%; transform-style:preserve-3d;
    display:flex; flex-direction:column; align-items:center; gap:6px;
    border:1px solid var(--edge); border-radius:10px; padding:12px 16px; background:var(--panel2);
    box-shadow:0 10px 24px -18px #000; filter:brightness(1); transition:filter 1.2s ease-out; }
  /* same top-up/decay convention as .stage-box/.lane/.cube elsewhere — pulses both the block that
     just finished and the block it's handing state into, so the hand-off reads as "one running
     state carried forward" rather than a labeled connector. */
  .block-group.pulse{ filter:brightness(1.4); transition:filter .06s ease-out; }
  .block-label{font-family:var(--mono); font-size:.66rem; letter-spacing:.18em; text-transform:uppercase; color:var(--dim)}
  .stack-caption{ display:none; font-family:var(--mono); font-size:.66rem; color:var(--dim);
    text-align:center; max-width:44ch; margin:6px auto 0; }
  .stack-caption.shown{ display:block; }
```

- [ ] **Step 3: Rewrite `renderMd5BlockChain`**

`public/crypto/hash/index.html:662-692` currently reads:

```js
function renderMd5BlockChain(numBlocks) {
  const chain = document.getElementById('md5-block-chain');
  chain.querySelectorAll('[data-dynamic-block]').forEach(el => el.remove());

  const chain0 = document.getElementById('hash-box-chain-0');
  if (chain0) chain0.classList.toggle('shown', numBlocks > 1);

  for (let b = 1; b < numBlocks; b++) {
    const group = document.createElement('div');
    group.className = 'block-group';
    group.dataset.dynamicBlock = '1';
    let rounds = '';
    for (let r = 1; r <= 4; r++) {
      rounds += `<div class="stage-box round-box" id="hash-box-block-${b}-r${r}">` +
        `<span class="box-title">Round ${r}</span>` +
        `<span class="loop-dot" id="hash-box-block-${b}-r${r}-loop"></span>` +
        `<span class="sample"></span></div>`;
    }
    group.innerHTML = `<div class="block-label">Block ${b}</div><div class="round-row">${rounds}</div>`;
    chain.appendChild(group);
    if (b < numBlocks - 1) {
      const link = document.createElement('div');
      link.className = 'chain-link shown';
      link.dataset.dynamicBlock = '1';
      link.id = 'hash-box-chain-' + b;
      link.title = 'entire state passed in the clear — this hand-off is what a length-extension attack exploits';
      link.innerHTML = '<span>chains into next block</span>';
      chain.appendChild(link);
    }
  }
}
```

Replace with:

```js
// Stacks the real number of 512-bit blocks the current input produces along a Z-axis, like a
// deck of cards receding into the screen — later blocks get more negative translateZ and sit
// visually behind earlier ones. Every render clears and rebuilds #md5-block-chain from scratch
// (no static block-group-0 to preserve anymore — Task 5's markup for block 0 is now generated
// here too, identically to blocks 1+).
function renderMd5BlockChain(numBlocks) {
  const chain = document.getElementById('md5-block-chain');
  chain.innerHTML = '';
  const stackDepth = 60; // px of translateZ recession per block
  for (let b = 0; b < numBlocks; b++) {
    const group = document.createElement('div');
    group.className = 'block-group';
    group.id = `block-group-${b}`;
    group.style.transform = `translate(-50%, ${b * 16}px) translateZ(${-b * stackDepth}px)`;
    group.style.zIndex = String(1000 - b);
    group.style.opacity = String(Math.max(0.55, 1 - b * 0.12));
    group.innerHTML = `
      <div class="block-label">Block ${b}</div>
      <div class="reg-row" id="reg-row-${b}">
        <div class="stage-box reg-box" id="reg-${b}-A"><span class="box-title">A</span><span class="reg-val">67452301</span></div>
        <div class="stage-box reg-box" id="reg-${b}-B"><span class="box-title">B</span><span class="reg-val">efcdab89</span></div>
        <div class="stage-box reg-box" id="reg-${b}-C"><span class="box-title">C</span><span class="reg-val">98badcfe</span></div>
        <div class="stage-box reg-box" id="reg-${b}-D"><span class="box-title">D</span><span class="reg-val">10325476</span></div>
      </div>
      <div class="func-row" id="func-row-${b}">
        <span class="func-box" id="func-${b}-F">F</span>
        <span class="func-box" id="func-${b}-G">G</span>
        <span class="func-box" id="func-${b}-H">H</span>
        <span class="func-box" id="func-${b}-I">I</span>
      </div>
      <div class="step-detail" id="step-detail-${b}">
        <span id="mword-${b}">M[—]</span><span id="shift-${b}">s=—</span><span id="kconst-${b}">K=—</span>
      </div>
      <div class="step-counter" id="step-counter-${b}">step — / 64</div>`;
    chain.appendChild(group);
  }
  const caption = document.getElementById('stack-caption');
  caption.classList.toggle('shown', numBlocks > 1);
}
```

- [ ] **Step 4: Add the hand-off pulse back into `pulseBoxOrCube`**

`public/crypto/hash/index.html` (post-Task-4) currently reads:

```js
function pulseBoxOrCube(boxId, sample) {
  pulseBox(boxId, sample);
}
```

Replace with:

```js
function pulseBoxOrCube(boxId, sample) {
  // md5WithTrace already pushes a chain-{blk-1} 'flow' event carrying the outgoing A/B/C/D state
  // whenever it moves to a new block (public/crypto/hash/index.html:326, unmodified by this
  // plan). Instead of pulsing a labeled connector pill, pulse BOTH the finishing card and the
  // next card together — the deck-of-cards visual is meant to read as one running state carried
  // forward, not a separate hand-off element.
  const chainMatch = /^chain-(\d+)$/.exec(boxId);
  if (chainMatch && getAlgorithm() === 'md5') {
    const n = Number(chainMatch[1]);
    [n, n + 1].forEach(b => {
      const el = document.getElementById(`block-group-${b}`);
      if (!el) return;
      el.classList.add('pulse');
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('pulse')));
    });
    return;
  }
  pulseBox(boxId, sample);
}
```

- [ ] **Step 5: Write and run a Playwright smoke check**

Create `/Users/gaura/PCAN/ceasar-ctf/tools/verify_task6_block_stack.mjs`:

```js
import { chromium } from 'playwright';

const BASE_URL = process.env.HASH_MODULE_URL || 'http://localhost:8787/public/crypto/hash/';

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => consoleErrors.push(String(err)));

await page.goto(BASE_URL + '?v=task6');

// a string long enough to force 2 MD5 blocks: after the 0x80 + length padding, anything over
// 55 bytes needs a second 512-bit block.
const longInput = 'x'.repeat(80);
await page.fill('#input-custom', longInput);
await page.locator('#speed-slider').evaluate(el => { el.value = '100'; });
await page.click('#hash-btn');

await page.waitForSelector('#block-group-1', { timeout: 5000 });
const blockCount = await page.locator('.block-group').count();
if (blockCount !== 2) throw new Error(`expected 2 stacked blocks for an 80-byte input, found ${blockCount}`);

const t1 = await page.locator('#block-group-1').evaluate(el => el.style.transform);
if (!/translateZ\(-60px\)/.test(t1)) throw new Error(`block-group-1 missing expected translateZ recession, got "${t1}"`);

const captionVisible = await page.locator('#stack-caption').evaluate(el => getComputedStyle(el).display !== 'none');
if (!captionVisible) throw new Error('stack-caption should be visible for a multi-block input');

await page.waitForFunction(
  () => document.getElementById('step-counter-1') && document.getElementById('step-counter-1').textContent === 'step 64 / 64',
  { timeout: 15000 }
);

if (consoleErrors.length) throw new Error('console errors: ' + consoleErrors.join(' | '));

console.log('OK  2 blocks stacked with Z-axis recession, caption shown, block 1 register view completes, no console errors');
await browser.close();
```

Run:

```bash
cd /Users/gaura/PCAN/ceasar-ctf
node tools/verify_task6_block_stack.mjs
```

Expected: prints the `OK` line and exits 0.

- [ ] **Step 6: Commit**

```bash
cd /Users/gaura/PCAN/ceasar-ctf
git add public/crypto/hash/index.html tools/verify_task6_block_stack.mjs
git commit -m "hash module: MD5 multi-block chaining as a Z-axis deck-of-cards stack, replacing pill connectors"
```

---

## Task 7: Input-box real-content display + whitespace visualization

**Model:** cheap — self-contained function rewrite, no interaction with the animation engine or trace schema, spec gives exact behavior per preset kind.

**Files:**
- Modify: `public/crypto/hash/index.html:493-509` (`renderInputBox` and its call sites)
- Modify: `public/crypto/hash/index.html` CSS block (add `.preset-thumb`/`.preset-thumb-caption`)
- Create: `tools/verify_task7_input_box.mjs`

**Interfaces:**
- Consumes: `getActiveInputBytes()` (pre-existing, `public/crypto/hash/index.html:476-491`, unmodified), `PRESETS`/`presetIndex`/`cachedFetchedBytes` (pre-existing).
- Produces: `visualizeWhitespace(str)` — top-level function, returns a string with control/whitespace characters replaced by visible tokens (`\t`→literal `\t`, `\n`→literal `\n`, `\r`→literal `\r`, space→`·`, zero-width space→`[ZWSP]`, other control chars→`[U+XXXX]`). `renderInputBox()` becomes `async` — same name, same call sites, no signature change other than now returning a `Promise` (fire-and-forget at existing call sites, matching the pattern already used for `onHashClick`).

- [ ] **Step 1: Add `visualizeWhitespace` and rewrite `renderInputBox`**

`public/crypto/hash/index.html:493-509` currently reads:

```js
function renderInputBox() {
  const p = PRESETS[presetIndex];
  const customEl = document.getElementById('input-custom');
  const displayEl = document.getElementById('input-preset-display');
  if (p.kind === 'custom') {
    customEl.style.display = '';
    displayEl.style.display = 'none';
  } else {
    customEl.style.display = 'none';
    displayEl.style.display = '';
    displayEl.textContent = p.label;
  }
}
document.getElementById('input-prev').onclick = () => { presetIndex = (presetIndex - 1 + PRESETS.length) % PRESETS.length; renderInputBox(); };
document.getElementById('input-next').onclick = () => { presetIndex = (presetIndex + 1) % PRESETS.length; renderInputBox(); };
document.getElementById('input-custom').addEventListener('input', e => { customText = e.target.value; });
renderInputBox();
```

Replace with:

```js
function visualizeWhitespace(str) {
  return [...str].map(ch => {
    if (ch === '\t') return '\\t';
    if (ch === '\n') return '\\n';
    if (ch === '\r') return '\\r';
    if (ch === ' ') return '·'; // middle dot, stands in for a plain space
    if (ch === '​') return '[ZWSP]'; // zero-width space
    const cp = ch.codePointAt(0);
    if (cp < 0x20 || cp === 0x7f) return `[U+${cp.toString(16).padStart(4, '0')}]`;
    return ch;
  }).join('');
}

// Shows the preset's actual resolved content (not its label). fetch/fetch-binary presets are
// eagerly fetched here (reusing getActiveInputBytes's own cachedFetchedBytes cache, so this
// doesn't duplicate the network cost of the later Hash click) and show a "loading…" state until
// the fetch resolves.
async function renderInputBox() {
  const p = PRESETS[presetIndex];
  const customEl = document.getElementById('input-custom');
  const displayEl = document.getElementById('input-preset-display');
  if (p.kind === 'custom') {
    customEl.style.display = '';
    displayEl.style.display = 'none';
    return;
  }
  customEl.style.display = 'none';
  displayEl.style.display = '';
  displayEl.innerHTML = '';

  if (p.kind === 'fixed') {
    displayEl.textContent = p.id === 'whitespace' ? visualizeWhitespace(p.text) : p.text;
    return;
  }
  if (p.kind === 'fixed-hex') {
    displayEl.textContent = p.hex;
    return;
  }
  if (p.kind === 'fetch') {
    displayEl.textContent = 'loading…';
    const myPresetId = p.id;
    try {
      const bytes = await getActiveInputBytes();
      if (PRESETS[presetIndex].id !== myPresetId) return; // preset changed while the fetch was in flight
      const text = new TextDecoder().decode(new Uint8Array(bytes));
      displayEl.textContent = text.length > 400 ? text.slice(0, 400) + '…' : text;
    } catch (err) {
      if (PRESETS[presetIndex].id === myPresetId) displayEl.textContent = "couldn't load preview";
    }
    return;
  }
  if (p.kind === 'fetch-binary') {
    displayEl.textContent = 'loading…';
    const myPresetId = p.id;
    try {
      const bytes = await getActiveInputBytes();
      if (PRESETS[presetIndex].id !== myPresetId) return;
      displayEl.innerHTML = '';
      const img = document.createElement('img');
      img.className = 'preset-thumb';
      img.src = p.url;
      img.alt = p.label;
      const caption = document.createElement('div');
      caption.className = 'preset-thumb-caption';
      caption.textContent = `${bytes.length.toLocaleString()} bytes`;
      displayEl.appendChild(img);
      displayEl.appendChild(caption);
    } catch (err) {
      if (PRESETS[presetIndex].id === myPresetId) displayEl.textContent = "couldn't load preview";
    }
  }
}
document.getElementById('input-prev').onclick = () => { presetIndex = (presetIndex - 1 + PRESETS.length) % PRESETS.length; renderInputBox(); };
document.getElementById('input-next').onclick = () => { presetIndex = (presetIndex + 1) % PRESETS.length; renderInputBox(); };
document.getElementById('input-custom').addEventListener('input', e => { customText = e.target.value; });
renderInputBox();
```

- [ ] **Step 2: Add the thumbnail CSS**

In the CSS block, immediately after the `.preset-display{...}` rule (`public/crypto/hash/index.html:66-68`), insert:

```css
  .preset-thumb{ max-width:80px; max-height:80px; border-radius:4px; display:block; margin:0 auto 6px; }
  .preset-thumb-caption{ font-size:.72rem; color:var(--dim); text-align:center; }
```

- [ ] **Step 3: Write and run a Playwright smoke check**

Create `/Users/gaura/PCAN/ceasar-ctf/tools/verify_task7_input_box.mjs`:

```js
import { chromium } from 'playwright';

const BASE_URL = process.env.HASH_MODULE_URL || 'http://localhost:8787/public/crypto/hash/';

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => consoleErrors.push(String(err)));

await page.goto(BASE_URL + '?v=task7');

// custom is preset 0 — one #input-next click lands on letter-a
await page.click('#input-next');
const letterAText = await page.locator('#input-preset-display').innerText();
if (letterAText.trim() !== 'a') throw new Error(`expected input box to show "a", got "${letterAText}"`);

// two more clicks: letter-a -> letter-cyrillic-a -> whitespace
await page.click('#input-next');
await page.click('#input-next');
const wsText = await page.locator('#input-preset-display').innerText();
if (!wsText.includes('\\t') && !wsText.includes('·')) {
  throw new Error(`expected whitespace preset to show visible glyphs (\\t or ·), got "${wsText}"`);
}
if (wsText.trim().length === 0) throw new Error('whitespace preset display is empty — raw whitespace is invisible');

if (consoleErrors.length) throw new Error('console errors: ' + consoleErrors.join(' | '));

console.log(`OK  letter-a shows "a", whitespace preset shows visible glyphs ("${wsText}"), no console errors`);
await browser.close();
```

Run:

```bash
cd /Users/gaura/PCAN/ceasar-ctf
node tools/verify_task7_input_box.mjs
```

Expected: prints the `OK` line and exits 0.

- [ ] **Step 4: Commit**

```bash
cd /Users/gaura/PCAN/ceasar-ctf
git add public/crypto/hash/index.html tools/verify_task7_input_box.mjs
git commit -m "hash module: input box shows resolved content (not label); visible-whitespace renderer"
```

---

## Task 8: Collision preset split + annotation

**Model:** cheap — array edit, const relocation, and a small conditional in an existing callback; spec gives exact copy and behavior.

**Files:**
- Modify: `public/crypto/hash/index.html:446-456` (`PRESETS` array — split the `collision` entry)
- Modify: `public/crypto/hash/index.html:787-788` (remove the now-duplicated `COLLISION_MSG_1_HEX`/`COLLISION_MSG_2_HEX` declarations — moved to above `PRESETS`)
- Modify: `public/crypto/hash/index.html:210-214` (output box — add the annotation element)
- Modify: `public/crypto/hash/index.html:757-782` (`onHashClick`'s two completion callbacks — call the new `updateCollisionAnnotation`)
- Create: `tools/verify_task8_collision.mjs`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `updateCollisionAnnotation(algo, presetId)` — top-level function, sets `#output-annotation`'s text based on whether `presetId` is `'collision-msg1'`/`'collision-msg2'` and `algo === 'md5'`.

- [ ] **Step 1: Move the collision hex constants above `PRESETS` and split the preset entry**

`public/crypto/hash/index.html:446-456` currently reads:

```js
// ---- presets ----
const PRESETS = [
  { id: 'custom', label: 'Custom', kind: 'custom' },
  { id: 'letter-a', label: 'Letter: a', kind: 'fixed', text: 'a' },
  { id: 'letter-cyrillic-a', label: 'Letter: а (Cyrillic)', kind: 'fixed', text: 'а' },
  { id: 'whitespace', label: 'Whitespace jumble', kind: 'fixed',
    text: '  \t ​     \t​  ' },
  { id: 'pubtext', label: 'Public-domain text', kind: 'fetch', url: 'assets/pubtext.txt' },
  { id: 'cat', label: 'Cat photo', kind: 'fetch-binary', url: 'assets/cat-thumb.jpg' },
  { id: 'collision', label: 'MD5 collision message', kind: 'fixed-hex',
    hex: 'd131dd02c5e6eec4693d9a0698aff95c2fcab58712467eab4004583eb8fb7f8955ad340609f4b30283e488832571415a085125e8f7cdc99fd91dbdf280373c5bd8823e3156348f5bae6dacd436c919c6dd53e2b487da03fd02396306d248cda0e99f33420f577ee8ce54b67080a80d1ec69821bcb6a8839396f9652b6ff72a70' },
];
```

Replace with:

```js
// ---- presets ----
// COLLISION_MSG_1_HEX / COLLISION_MSG_2_HEX are defined here (not down by the collision demo
// panel's code, where they used to live) so the two collision-* PRESETS entries below can
// reference them; the collision demo panel further down reuses these same two consts rather than
// duplicating the hex strings.
const COLLISION_MSG_1_HEX = 'd131dd02c5e6eec4693d9a0698aff95c2fcab58712467eab4004583eb8fb7f8955ad340609f4b30283e488832571415a085125e8f7cdc99fd91dbdf280373c5bd8823e3156348f5bae6dacd436c919c6dd53e2b487da03fd02396306d248cda0e99f33420f577ee8ce54b67080a80d1ec69821bcb6a8839396f9652b6ff72a70';
const COLLISION_MSG_2_HEX = 'd131dd02c5e6eec4693d9a0698aff95c2fcab50712467eab4004583eb8fb7f8955ad340609f4b30283e4888325f1415a085125e8f7cdc99fd91dbd7280373c5bd8823e3156348f5bae6dacd436c919c6dd53e23487da03fd02396306d248cda0e99f33420f577ee8ce54b67080280d1ec69821bcb6a8839396f965ab6ff72a70';

const PRESETS = [
  { id: 'custom', label: 'Custom', kind: 'custom' },
  { id: 'letter-a', label: 'Letter: a', kind: 'fixed', text: 'a' },
  { id: 'letter-cyrillic-a', label: 'Letter: а (Cyrillic)', kind: 'fixed', text: 'а' },
  { id: 'whitespace', label: 'Whitespace jumble', kind: 'fixed',
    text: '  \t ​     \t​  ' },
  { id: 'pubtext', label: 'Public-domain text', kind: 'fetch', url: 'assets/pubtext.txt' },
  { id: 'cat', label: 'Cat photo', kind: 'fetch-binary', url: 'assets/cat-thumb.jpg' },
  { id: 'collision-msg1', label: 'MD5 collision — message 1', kind: 'fixed-hex', hex: COLLISION_MSG_1_HEX },
  { id: 'collision-msg2', label: 'MD5 collision — message 2', kind: 'fixed-hex', hex: COLLISION_MSG_2_HEX },
];
```

- [ ] **Step 2: Remove the now-duplicated const declarations from the collision demo panel section**

`public/crypto/hash/index.html:787-788` currently reads:

```js
// ---- collision demo panel ----
const COLLISION_MSG_1_HEX = 'd131dd02c5e6eec4693d9a0698aff95c2fcab58712467eab4004583eb8fb7f8955ad340609f4b30283e488832571415a085125e8f7cdc99fd91dbdf280373c5bd8823e3156348f5bae6dacd436c919c6dd53e2b487da03fd02396306d248cda0e99f33420f577ee8ce54b67080a80d1ec69821bcb6a8839396f9652b6ff72a70';
const COLLISION_MSG_2_HEX = 'd131dd02c5e6eec4693d9a0698aff95c2fcab50712467eab4004583eb8fb7f8955ad340609f4b30283e4888325f1415a085125e8f7cdc99fd91dbd7280373c5bd8823e3156348f5bae6dacd436c919c6dd53e23487da03fd02396306d248cda0e99f33420f577ee8ce54b67080280d1ec69821bcb6a8839396f965ab6ff72a70';

document.getElementById('collision-run-btn').onclick = () => {
```

Replace with:

```js
// ---- collision demo panel ----
// COLLISION_MSG_1_HEX / COLLISION_MSG_2_HEX now live earlier in the file, next to PRESETS
// (public/crypto/hash/index.html, just above the PRESETS array) — reused here, not duplicated.

document.getElementById('collision-run-btn').onclick = () => {
```

- [ ] **Step 3: Add the annotation element to the output box**

`public/crypto/hash/index.html:210-214` currently reads:

```html
    <div class="box" id="output-box">
      <div class="box-title">Output</div>
      <div id="output-digest">&mdash;</div>
      <div id="output-bits"></div>
    </div>
```

Replace with:

```html
    <div class="box" id="output-box">
      <div class="box-title">Output</div>
      <div id="output-digest">&mdash;</div>
      <div id="output-bits"></div>
      <div id="output-annotation" class="output-annotation"></div>
    </div>
```

In the CSS block, immediately after the `#output-bits{...}` rule (`public/crypto/hash/index.html:81`), insert:

```css
  .output-annotation{ font-family:var(--mono); font-size:.72rem; color:var(--accent); min-height:1.2em; }
```

- [ ] **Step 4: Write `updateCollisionAnnotation` and call it from both completion callbacks**

Immediately before `document.getElementById('hash-btn').onclick = onHashClick;` (`public/crypto/hash/index.html:784`), insert:

```js
function updateCollisionAnnotation(algo, presetId) {
  const el = document.getElementById('output-annotation');
  if (algo === 'md5' && presetId === 'collision-msg1') { el.textContent = 'shares this digest with message 2'; return; }
  if (algo === 'md5' && presetId === 'collision-msg2') { el.textContent = 'shares this digest with message 1'; return; }
  el.textContent = '';
}
```

Then, in `onHashClick`, capture the preset id synchronously alongside the existing `label` capture. The function currently starts (`public/crypto/hash/index.html:731-742`):

```js
async function onHashClick() {
  // algo/label MUST be read synchronously here, before the only await in this function — NOT
  // ...
  const algo = getAlgorithm();
  const label = inputLabel();
  const myRunId = currentRunId;
```

Replace with:

```js
async function onHashClick() {
  // algo/label MUST be read synchronously here, before the only await in this function — NOT
  // ...
  const algo = getAlgorithm();
  const label = inputLabel();
  const presetId = PRESETS[presetIndex].id; // same synchronous-capture rule as algo/label above
  const myRunId = currentRunId;
```

Then update both completion callbacks. The MD5 branch (`public/crypto/hash/index.html:757-769`, post-Task-5) currently reads:

```js
  if (algo === 'md5') {
    const { digest, trace } = md5WithTrace(bytes);
    const numBlocks = Number(trace.find(e => e.boxId === 'split').sample.split(' ')[0]);
    renderMd5BlockChain(numBlocks);
    showDiagramFor('md5');
    playTrace(trace, getSpeedMs, (ev) => { pulseBoxOrCube(ev.boxId, ev.sample); updateMd5RegisterView(ev); }, () => {
      addHistoryEntry(algo, digest, bytes, label);
      document.getElementById('output-digest').textContent = digest;
      document.getElementById('output-bits').textContent = '128-bit / 32 hex chars';
      document.getElementById('output-box').classList.add('active-flash');
      setTimeout(() => document.getElementById('output-box').classList.remove('active-flash'), 400);
    });
  }
```

Replace with:

```js
  if (algo === 'md5') {
    const { digest, trace } = md5WithTrace(bytes);
    const numBlocks = Number(trace.find(e => e.boxId === 'split').sample.split(' ')[0]);
    renderMd5BlockChain(numBlocks);
    showDiagramFor('md5');
    playTrace(trace, getSpeedMs, (ev) => { pulseBoxOrCube(ev.boxId, ev.sample); updateMd5RegisterView(ev); }, () => {
      addHistoryEntry(algo, digest, bytes, label);
      document.getElementById('output-digest').textContent = digest;
      document.getElementById('output-bits').textContent = '128-bit / 32 hex chars';
      updateCollisionAnnotation(algo, presetId);
      document.getElementById('output-box').classList.add('active-flash');
      setTimeout(() => document.getElementById('output-box').classList.remove('active-flash'), 400);
    });
  }
```

The SHA-3 branch (`public/crypto/hash/index.html:770-782`, post-Task-4) currently reads:

```js
  if (algo === 'sha3') {
    const { digest, trace } = keccak256WithTrace(bytes);
    const numBlocks = Number(trace.find(e => e.boxId === 'absorb-split').sample.split(' ')[0]);
    renderSha3AbsorbChain(numBlocks);
    showDiagramFor('sha3');
    document.getElementById('round-counter').textContent = 'round 0 / 24';
    playTrace(trace, getSpeedMs, (ev) => { if (!pulseLanesFor(ev)) pulseBoxOrCube(ev.boxId, ev.sample); }, () => {
      addHistoryEntry(algo, digest, bytes, label);
      document.getElementById('output-digest').textContent = digest;
      document.getElementById('output-bits').textContent = '256-bit / 64 hex chars';
      document.getElementById('output-box').classList.add('active-flash');
      setTimeout(() => document.getElementById('output-box').classList.remove('active-flash'), 400);
    });
  }
```

Replace with:

```js
  if (algo === 'sha3') {
    const { digest, trace } = keccak256WithTrace(bytes);
    const numBlocks = Number(trace.find(e => e.boxId === 'absorb-split').sample.split(' ')[0]);
    renderSha3AbsorbChain(numBlocks);
    showDiagramFor('sha3');
    document.getElementById('round-counter').textContent = 'round 0 / 24';
    playTrace(trace, getSpeedMs, (ev) => { if (!pulseLanesFor(ev)) pulseBoxOrCube(ev.boxId, ev.sample); }, () => {
      addHistoryEntry(algo, digest, bytes, label);
      document.getElementById('output-digest').textContent = digest;
      document.getElementById('output-bits').textContent = '256-bit / 64 hex chars';
      updateCollisionAnnotation(algo, presetId);
      document.getElementById('output-box').classList.add('active-flash');
      setTimeout(() => document.getElementById('output-box').classList.remove('active-flash'), 400);
    });
  }
```

- [ ] **Step 5: Write and run a Playwright smoke check**

Create `/Users/gaura/PCAN/ceasar-ctf/tools/verify_task8_collision.mjs`:

```js
import { chromium } from 'playwright';

const BASE_URL = process.env.HASH_MODULE_URL || 'http://localhost:8787/public/crypto/hash/';

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => consoleErrors.push(String(err)));

await page.goto(BASE_URL + '?v=task8');
await page.locator('#speed-slider').evaluate(el => { el.value = '100'; });

// custom(0) -> letter-a(1) -> letter-cyrillic-a(2) -> whitespace(3) -> pubtext(4) -> cat(5) ->
// collision-msg1(6): six clicks of #input-next from the default custom preset.
for (let i = 0; i < 6; i++) await page.click('#input-next');
const msg1Label = await page.locator('#input-preset-display').innerText();
if (!msg1Label.includes('d131dd02')) throw new Error(`expected collision-msg1 hex preview, got "${msg1Label}"`);

await page.click('#hash-btn');
await page.waitForFunction(() => document.getElementById('output-annotation').textContent.length > 0, { timeout: 15000 });
const annotation1 = await page.locator('#output-annotation').innerText();
if (!annotation1.includes('message 2')) throw new Error(`expected msg1 annotation to reference message 2, got "${annotation1}"`);

await page.click('#input-next'); // collision-msg2
await page.click('#hash-btn');
await page.waitForFunction(() => document.getElementById('output-annotation').textContent.includes('message 1'), { timeout: 15000 });
const annotation2 = await page.locator('#output-annotation').innerText();
if (!annotation2.includes('message 1')) throw new Error(`expected msg2 annotation to reference message 1, got "${annotation2}"`);

if (consoleErrors.length) throw new Error('console errors: ' + consoleErrors.join(' | '));

console.log('OK  both collision presets selectable, each shows correct cross-reference annotation, no console errors');
await browser.close();
```

Run:

```bash
cd /Users/gaura/PCAN/ceasar-ctf
node tools/verify_task8_collision.mjs
```

Expected: prints the `OK` line and exits 0.

- [ ] **Step 6: Commit**

```bash
cd /Users/gaura/PCAN/ceasar-ctf
git add public/crypto/hash/index.html tools/verify_task8_collision.mjs
git commit -m "hash module: split collision preset into message-1/message-2, add cross-reference annotation"
```

---

## Task 9: Final whole-page integration pass

**Model:** cheap-to-standard — no new code being written beyond one verification script; the work is running and interpreting Playwright checks across everything Tasks 1-8 built, not designing anything new.

**Files:**
- Create: `tools/verify_task9_full_integration.mjs`
- No changes to `public/crypto/hash/index.html` in this task — if this script surfaces a real bug, fix it as a small targeted patch to the file and re-run this same script before committing; do not add new features.

**Interfaces:**
- Consumes: everything Tasks 1-8 produced (all element ids, functions, and trace-event schemas listed in every earlier task's Interfaces block).
- Produces: nothing new for later tasks (this is the last task).

- [ ] **Step 1: Confirm the dev dependencies are ready**

```bash
cd /Users/gaura/PCAN/ceasar-ctf
npm install
npx playwright install chromium
```

Expected: both commands complete without error (they may be no-ops if already installed, per Task 3-8's Steps having already exercised Playwright successfully).

- [ ] **Step 2: Write the full integration check**

Create `/Users/gaura/PCAN/ceasar-ctf/tools/verify_task9_full_integration.mjs`:

```js
import { chromium } from 'playwright';
import crypto from 'node:crypto';

const BASE_URL = process.env.HASH_MODULE_URL || 'http://localhost:8787/public/crypto/hash/';

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => consoleErrors.push(String(err)));

await page.goto(BASE_URL + '?v=task9');
await page.waitForSelector('#hash-btn');
await page.locator('#speed-slider').evaluate(el => { el.value = '100'; });

// ---- 1. MD5 digest spot-check against a known vector ----
await page.fill('#input-custom', 'abc');
await page.click('#hash-btn');
await page.waitForFunction(() => document.getElementById('output-digest').textContent.length === 32, { timeout: 15000 });
const md5Digest = await page.locator('#output-digest').innerText();
const expectedMd5 = crypto.createHash('md5').update('abc').digest('hex');
if (md5Digest !== expectedMd5) throw new Error(`MD5 digest mismatch: got ${md5Digest}, expected ${expectedMd5}`);
console.log(`OK  MD5("abc") = ${md5Digest}`);

// ---- 2. MD5 register boxes updated during the animation just run ----
const regA = await page.locator('#reg-0-A .reg-val').innerText();
if (!/^[0-9a-f]{8}$/.test(regA) || regA === '67452301') throw new Error(`MD5 register A did not update, still "${regA}"`);
console.log('OK  MD5 register boxes updated during animation');

// ---- 3. SHA-3 digest spot-check + lane grid + round counter ----
await page.click('#algo-next'); // -> SHA-3
await page.click('#hash-btn');
await page.waitForFunction(() => document.getElementById('output-digest').textContent.length === 64, { timeout: 15000 });
const sha3Digest = await page.locator('#output-digest').innerText();
const expectedSha3 = crypto.createHash('sha3-256').update('abc').digest('hex');
if (sha3Digest !== expectedSha3) throw new Error(`SHA3-256 digest mismatch: got ${sha3Digest}, expected ${expectedSha3}`);
console.log(`OK  SHA3-256("abc") = ${sha3Digest}`);

const laneCount = await page.locator('.lane').count();
if (laneCount !== 25) throw new Error(`expected 25 .lane elements, found ${laneCount}`);
const roundCounterText = await page.locator('#round-counter').innerText();
if (roundCounterText !== 'round 24 / 24') throw new Error(`expected round counter at 24/24, got "${roundCounterText}"`);
console.log('OK  SHA-3 lane grid has 25 elements, round counter reached 24/24');

// ---- 4. lane grid is drag-rotatable ----
const grid = page.locator('#lane-grid');
const beforeTransform = await grid.evaluate(el => el.style.transform);
const box = await grid.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 30, { steps: 6 });
await page.mouse.up();
const afterTransform = await grid.evaluate(el => el.style.transform);
if (afterTransform === beforeTransform) throw new Error('drag-rotate did not change #lane-grid transform');
console.log('OK  lane grid is drag-rotatable via real pointer events');

// ---- 5. input box shows real content, not a label, for letter-a and whitespace presets ----
await page.click('#input-next'); // custom(0) -> letter-a(1)
const letterAText = await page.locator('#input-preset-display').innerText();
if (letterAText.trim() !== 'a') throw new Error(`letter-a preset should show "a", got "${letterAText}"`);
await page.click('#input-next'); // -> letter-cyrillic-a(2)
await page.click('#input-next'); // -> whitespace(3)
const wsText = await page.locator('#input-preset-display').innerText();
if (wsText.trim().length === 0) throw new Error('whitespace preset display is empty');
console.log(`OK  input box shows real content for letter-a ("${letterAText.trim()}") and whitespace ("${wsText}")`);

// ---- 6. both collision presets selectable and annotated ----
await page.click('#input-next'); // -> pubtext(4)
await page.click('#input-next'); // -> cat(5)
await page.click('#input-next'); // -> collision-msg1(6)
await page.click('#algo-prev'); // -> back to MD5 (collision only makes sense for MD5)
await page.click('#hash-btn');
await page.waitForFunction(() => document.getElementById('output-annotation').textContent.includes('message 2'), { timeout: 15000 });
console.log('OK  collision-msg1 selectable and annotated');
await page.click('#input-next'); // -> collision-msg2(7)
await page.click('#hash-btn');
await page.waitForFunction(() => document.getElementById('output-annotation').textContent.includes('message 1'), { timeout: 15000 });
console.log('OK  collision-msg2 selectable and annotated');

if (consoleErrors.length) throw new Error('console errors accumulated during the run: ' + consoleErrors.join(' | '));

console.log('All Task 9 integration checks passed — no console errors across the whole run.');
await browser.close();
```

- [ ] **Step 3: Start the local dev server (if not already running) and run the check**

```bash
cd /Users/gaura/PCAN/ceasar-ctf
python3 -m http.server 8787 &
sleep 1
node tools/verify_task9_full_integration.mjs
```

Expected: every `OK` line prints in order and the script ends with `All Task 9 integration checks passed — no console errors across the whole run.` (exit code 0).

- [ ] **Step 4: If any check fails, fix the specific regression in `public/crypto/hash/index.html` and re-run**

Do not add scope beyond what the failing check describes — trace the failure to the specific task's step above (e.g. a wrong element id, a missed `showDiagramFor` reset) and correct just that. Re-run Step 3 until the script passes clean.

- [ ] **Step 5: Re-run the two Node digest-parity tests as a final belt-and-braces check**

```bash
cd /Users/gaura/PCAN/ceasar-ctf
node tools/test_md5_trace.mjs
node tools/test_keccak_trace.mjs
```

Expected: both print their respective `All ... tests passed.` lines.

- [ ] **Step 6: Commit**

```bash
cd /Users/gaura/PCAN/ceasar-ctf
git add tools/verify_task9_full_integration.mjs
# also stage public/crypto/hash/index.html only if Step 4 required a fix
git add public/crypto/hash/index.html 2>/dev/null || true
git commit -m "hash module: Task 9 full-page Playwright integration pass (no new features)"
```

---

## Self-Review

**1. Spec coverage.**

- 5×5×64 Keccak geometry / 17-gold-vs-8-dark static rate/capacity coloring → Task 3 (`KECCAK_RATE_LANES`, `.lane.rate`/`.lane.capacity`).
- 25 individual CSS-3D lane elements, no canvas, no 3D library, drag-rotatable → Task 3.
- θ/ρ/π/χ/ι five distinct per-round sub-animations, wired to real trace data → Task 2 (schema) + Task 4 (wiring).
- Live "round N / 24" counter, incrementing on `-iota` → Task 4.
- MD5 A/B/C/D register view, active F/G/H/I function, M[g]/s[i]/K[i], step counter → Task 1 (schema) + Task 5 (UI).
- MD5 Z-axis deck-of-cards multi-block stack, hand-off reads as one running state carried forward → Task 6.
- Input box shows real resolved content per preset kind, visible-whitespace renderer → Task 7.
- Collision preset splits into two selectable presets with cross-reference annotation → Task 8.
- Digest-unchanged guarantee for every task touching `md5WithTrace`/`keccakF1600WithTrace`/`keccak256WithTrace` → Tasks 1, 2 (Node tests), reconfirmed in Task 9 Step 5.
- Reuse of `.pulse` top-up/decay convention, no parallel pulse mechanism → Tasks 3-6 all extend the existing `.pulse` pattern (`.lane.pulse`, `.block-group.pulse`) rather than inventing new transition mechanics.
- Whole-page Playwright verification with real pointer events (not synthetic DOM events) → Task 9, and every UI task (3-8) also carries its own smaller Playwright check using `page.mouse`/`page.click`/`page.fill`.
- Out-of-scope items (per-bit-level 1600-bit display, preset-list/algorithm-toggle/speed-slider/history-log changes, canvas rendering) are correctly absent from every task above.

**2. Placeholder scan.** Searched every task for "TBD"/"similar to Task N"/unshown code — none found. Every code block is the actual diff (old block shown in full, replaced with the actual new block in full), not a description of a diff. Every test file's assertions are concrete strings/values, not stubs.

**3. Type/interface consistency across tasks.**

- Task 1 introduces `regs.A/B/C/D`, `func`, `mIndex`, `shift`, `k`, `step` on `-loop` events — Task 5's `updateMd5RegisterView` reads exactly these field names (`ev.regs[letter]`, `ev.func`, `ev.mIndex`, `ev.shift`, `ev.k`, `ev.step`). Verified matching.
- Task 2 introduces `KECCAK_PI_LANE_MAP[x][y] = [nx, ny]` and `lanes: [[x,y], ...]` on `lane-r{rnd}-{step}` events — Task 4's `pulseLanesFor` destructures `[x, y]` from `ev.lanes` and looks up `KECCAK_PI_LANE_MAP[x][y]` the same way. Verified matching.
- Task 3 introduces `#lane-{x}-{y}` ids, `LANE_CELL`, `dataset.baseTransform` — Task 4 reads `document.getElementById(\`lane-${x}-${y}\`)`, uses `LANE_CELL` in its own translateZ math, and restores `el.dataset.baseTransform` after the pi-slide. Verified matching.
- Task 5 introduces the `reg-{blk}-*`/`func-{blk}-*`/`mword-{blk}`/`shift-{blk}`/`kconst-{blk}`/`step-counter-{blk}` id convention scoped by block index — Task 6's rewritten `renderMd5BlockChain` generates precisely these same ids for every `b` from 0 to `numBlocks-1` (including block 0, previously static). Verified matching — `updateMd5RegisterView` needs no changes in Task 6.
- Task 6 relies on the pre-existing `chain-{blk-1}` `'flow'` trace event already pushed inside `md5WithTrace` (`public/crypto/hash/index.html:326`) — confirmed this event and its `boxId` format are untouched by Task 1 (Task 1 only edits the `-loop` events inside the inner `for (i=0;i<64;i++)` loop, not the outer per-block `if (blk > 0)` push). Verified no conflict.
- Task 8's `presetId` capture and `updateCollisionAnnotation(algo, presetId)` signature is called identically from both the MD5 and SHA-3 completion callbacks in `onHashClick` — same two-argument order in both call sites. Verified matching.
- `tools/extract_hash_core.mjs` (Task 1) is reused verbatim by Task 2's test with no modification — confirmed its marker strings (`function strToBytes` / `// ---- theme toggle ----`) are never touched by any later task's edits (all edits in Tasks 1-2 land strictly between those two markers, never removing or renaming them).

No gaps or mismatches found; no fixes were needed beyond what's already reflected in the tasks above.
