# Module 3 · Hashing Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `public/crypto/hash/index.html` — a single-page interactive visualization
teaching avalanche effect, hash-function internals, and MD5-vs-SHA-3 structural/security
differences, per `docs/superpowers/specs/2026-08-12-hash-visualization-design.md`.

**Architecture:** One dependency-free HTML file. Two from-scratch, trace-instrumented JS hash
implementations (MD5, SHA3-256/Keccak) each expose `xWithTrace(bytes) -> {digest, trace}` where
`trace` is a flat, ordered array of `{boxId, kind, sample}` events. A single shared animation
engine consumes either algorithm's trace array identically (rAF-driven, live-adjustable speed,
restart-safe via a monotonic run-id) and drives CSS `filter:brightness` pulses across a
persistent, always-visible structural diagram. A rotatable CSS-3D cube stands in for SHA-3's
permutation state.

**Tech Stack:** Vanilla JS, CSS (incl. 3D transforms), `warm-editorial-ui` design tokens. No
build step for the page itself; a small Python asset-prep script (Pillow, project venv) runs
once ahead of time for the image preset.

## Global Constraints

- Single static HTML file at `public/crypto/hash/index.html`, all JS inline, no external
  requests, no runtime dependencies — matches every other module in this repo (`CLAUDE.md`).
- Style with the flat `warm-editorial-ui` skill/token system — invoke that skill when writing
  the CSS in Task 4, don't hand-roll a new palette.
- **Node-verify every hash implementation against real test vectors before wiring it into any
  UI** — this is the project's own stated convention, and it caught a real transcription error
  in this plan's own research pass (see Task 1 note on the MD5 collision digest).
- **Verify interactive UI with real pointer clicks** (Chrome MCP; if no browser is connected —
  common in background/subagent sessions — fall back to Playwright, already installed as a
  project devDependency at the repo root: `npm install` if `node_modules` is missing,
  `npx playwright install chromium` if browsers aren't present). Never trust a syntax check
  alone for behavior.
- Serve locally via `python3 -m http.server 8787` from the repo root; local path is
  `http://localhost:8787/public/crypto/hash/` (append `?v=N` to bust the browser cache between
  edits — this repo's browser caches aggressively during iteration).
- **Never `pip install` globally.** Python work uses `/Users/gaura/PCAN/ceasar-ctf/.venv/bin/python`.
- Commit after each task. Don't deploy (`npx wrangler deploy`) — this module stays undeployed
  until the user says go, matching every other in-progress module in this repo.
- **Restart-on-reclick, always**: hitting Hash while an animation is already playing must
  hard-reset and replay from frame 0. No queueing, no async cleverness — see Task 6's run-id
  pattern, reuse it exactly, don't invent a different cancellation scheme.

---

### Task 1: MD5 core implementation + trace instrumentation

**Files:**
- Create: `public/crypto/hash/index.html` (page skeleton + this task's `<script>` content only —
  later tasks extend the same file)

**Interfaces:**
- Produces: `md5WithTrace(bytes: number[]) -> {digest: string, trace: TraceEvent[]}` where
  `TraceEvent = {boxId: string, kind: 'activate'|'flow', sample: string}` — consumed by Task 6
  (animation engine) and Task 8 (output/history).
- Produces: `strToBytes(s: string) -> number[]`, `hexToBytes(h: string) -> number[]` — small
  shared helpers, consumed by every later task that needs to turn preset/custom input into
  bytes.

This task's code is **already verified** — the exact JS below was run against Node and checked
byte-for-byte against Python's `hashlib.md5` for three RFC 1321 test vectors, a 254-byte
multi-block message, and the real published MD5 collision pair. Don't rederive it, transcribe it
exactly, then re-verify per Step 2 as a sanity check that the transcription itself is clean.

- [ ] **Step 1: Create `public/crypto/hash/index.html` with this skeleton + the MD5 code**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Hashing — Crypto 101</title>
</head>
<body>
<div id="app"></div>
<script>
function strToBytes(s) { return [...new TextEncoder().encode(s)]; }
function hexToBytes(h) { const a=[]; for (let i=0;i<h.length;i+=2) a.push(parseInt(h.substr(i,2),16)); return a; }
function toHex32(w) { let s=''; for (let i=0;i<4;i++) s += ((w>>>(8*i))&0xff).toString(16).padStart(2,'0'); return s; }

function md5WithTrace(bytes) {
  const K = [];
  for (let i = 0; i < 64; i++) K.push(Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);
  const S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,
             5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,
             4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,
             6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
  let a0=0x67452301,b0=0xefcdab89,c0=0x98badcfe,d0=0x10325476;
  const trace = [];
  const origLenBits = BigInt(bytes.length) * 8n;
  const msg = [...bytes, 0x80];
  trace.push({ boxId:'pad', kind:'activate', sample: '+0x80, +len' });
  while (msg.length % 64 !== 56) msg.push(0);
  for (let i = 0; i < 8; i++) msg.push(Number((origLenBits >> BigInt(8*i)) & 0xffn));
  const numBlocks = msg.length / 64;
  trace.push({ boxId:'split', kind:'activate', sample: `${numBlocks} block(s) x 512 bits` });
  for (let blk = 0; blk < numBlocks; blk++) {
    const chunkOfs = blk * 64;
    if (blk > 0) trace.push({ boxId:`chain-${blk-1}`, kind:'flow', sample: toHex32(a0)+toHex32(b0)+toHex32(c0)+toHex32(d0) });
    const M = [];
    for (let i = 0; i < 16; i++) {
      const o = chunkOfs + i*4;
      M.push((msg[o] | (msg[o+1]<<8) | (msg[o+2]<<16) | (msg[o+3]<<24)) >>> 0);
    }
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
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  const digest = [a0,b0,c0,d0].map(toHex32).join('');
  trace.push({ boxId:'output', kind:'activate', sample: digest });
  return { digest, trace };
}
</script>
</body>
</html>
```

- [ ] **Step 2: Verify with Node before wiring anything else**

Run:
```bash
node -e "
$(cat <<'JSEOF'
function strToBytes(s) { return [...new TextEncoder().encode(s)]; }
function hexToBytes(h) { const a=[]; for (let i=0;i<h.length;i+=2) a.push(parseInt(h.substr(i,2),16)); return a; }
function toHex32(w) { let s=''; for (let i=0;i<4;i++) s += ((w>>>(8*i))&0xff).toString(16).padStart(2,'0'); return s; }
JSEOF
)
$(grep -A 200 'function md5WithTrace' public/crypto/hash/index.html | sed -n '/^function md5WithTrace/,/^}/p')
const r1 = md5WithTrace(strToBytes('abc'));
console.log('abc:', r1.digest, r1.digest === '900150983cd24fb0d6963f7d28e17f72');
const m1 = hexToBytes('d131dd02c5e6eec4693d9a0698aff95c2fcab58712467eab4004583eb8fb7f8955ad340609f4b30283e488832571415a085125e8f7cdc99fd91dbdf280373c5bd8823e3156348f5bae6dacd436c919c6dd53e2b487da03fd02396306d248cda0e99f33420f577ee8ce54b67080a80d1ec69821bcb6a8839396f9652b6ff72a70');
const m2 = hexToBytes('d131dd02c5e6eec4693d9a0698aff95c2fcab50712467eab4004583eb8fb7f8955ad340609f4b30283e4888325f1415a085125e8f7cdc99fd91dbd7280373c5bd8823e3156348f5bae6dacd436c919c6dd53e23487da03fd02396306d248cda0e99f33420f577ee8ce54b67080280d1ec69821bcb6a8839396f965ab6ff72a70');
const d1 = md5WithTrace(m1).digest, d2 = md5WithTrace(m2).digest;
console.log('collision:', d1, d2, d1 === d2, d1 === '79054025255fb1a26e4bc422aef54eb4');
"
```

Expected output: three `true` values. **Note**: the correct collision digest is
`79054025255fb1a26e4bc422aef54eb4` (32 hex chars) — earlier research quoted it missing its
final `4` (31 chars); that was a transcription error caught by independently re-running MD5 in
both Python and Node during this plan's own preparation, not by trusting the citation. If your
run doesn't show exactly this value, the bug is in your transcription of Step 1's code, not in
the expected value.

- [ ] **Step 3: Commit**

```bash
git add public/crypto/hash/index.html
git commit -m "hash module: MD5 core + trace instrumentation, node-verified"
```

---

### Task 2: SHA3-256 (Keccak) core implementation + trace instrumentation

**Files:**
- Modify: `public/crypto/hash/index.html` (append to the existing `<script>` block from Task 1)

**Interfaces:**
- Consumes: `strToBytes` (Task 1).
- Produces: `keccak256WithTrace(bytes: number[]) -> {digest: string, trace: TraceEvent[]}` — same
  `TraceEvent` shape as Task 1's `md5WithTrace`, consumed identically by Task 6/7 (animation
  engine) and Task 8 (output/history). This shared shape is exactly what lets one animation
  engine drive both algorithms without per-algorithm branching in the player itself.

Also already verified — checked against `hashlib.sha3_256` for the empty string and `'abc'`
(the two standard, universally-cited SHA3-256 test vectors) in both Python and Node.

- [ ] **Step 1: Append this to the `<script>` block in `public/crypto/hash/index.html`**

```javascript
function keccakRoundConstants() {
  function rc(t) {
    if (t % 255 === 0) return 1;
    let R = [1,0,0,0,0,0,0,0];
    for (let i = 1; i <= (t % 255); i++) {
      R = [0, ...R];
      R[0] ^= R[8]; R[4] ^= R[8]; R[5] ^= R[8]; R[6] ^= R[8];
      R = R.slice(0, 8);
    }
    return R[0];
  }
  const RC = [];
  for (let rnd = 0; rnd < 24; rnd++) {
    let val = 0n;
    for (let j = 0; j < 7; j++) {
      const bitpos = (1 << j) - 1;
      if (rc(j + 7*rnd)) val |= (1n << BigInt(bitpos));
    }
    RC.push(val);
  }
  return RC;
}
const KECCAK_RC = keccakRoundConstants();
const KECCAK_RHO_OFFSETS = [[0,36,3,41,18],[1,44,10,45,2],[62,6,43,15,61],[28,55,25,21,56],[27,20,39,8,14]];
const KECCAK_MASK64 = (1n << 64n) - 1n;
function rol64(x, n) { n = BigInt(n % 64); return ((x << n) | (x >> (64n - n))) & KECCAK_MASK64; }
function laneHex(x) { return x.toString(16).padStart(16,'0'); }

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

function keccak256WithTrace(bytes, suffix = 0x06, rateBytes = 136, outBytes = 32) {
  let state = [];
  for (let x = 0; x < 5; x++) state.push([0n,0n,0n,0n,0n]);
  const trace = [];
  trace.push({ boxId:'pad', kind:'activate', sample:`+0x${suffix.toString(16)}, multi-rate pad` });
  const msg = [...bytes, suffix];
  while (msg.length % rateBytes !== rateBytes - 1) msg.push(0);
  msg.push(0x80);
  const numBlocks = msg.length / rateBytes;
  trace.push({ boxId:'absorb-split', kind:'activate', sample:`${numBlocks} rate-block(s) x ${rateBytes*8} bits` });
  for (let i = 0; i < msg.length; i += rateBytes) {
    const blockIdx = i / rateBytes;
    trace.push({ boxId:`absorb-${blockIdx}`, kind:'flow', sample:`block ${blockIdx} -> rate` });
    const block = msg.slice(i, i + rateBytes);
    for (let j = 0; j < rateBytes; j += 8) {
      const x = (j/8) % 5, y = Math.floor((j/8)/5);
      let lane = 0n;
      for (let b = 7; b >= 0; b--) lane = (lane << 8n) | BigInt(block[j+b] || 0);
      state[x][y] ^= lane;
    }
    state = keccakF1600WithTrace(state, trace);
  }
  trace.push({ boxId:'squeeze', kind:'flow', sample:'reading rate -> output' });
  let out = [];
  while (out.length < outBytes) {
    for (let j = 0; j < rateBytes && out.length < outBytes; j += 8) {
      const x = (j/8) % 5, y = Math.floor((j/8)/5);
      let lane = state[x][y];
      for (let b = 0; b < 8 && out.length < outBytes; b++) { out.push(Number(lane & 0xffn)); lane >>= 8n; }
    }
    if (out.length < outBytes) state = keccakF1600WithTrace(state, trace);
  }
  const digest = out.map(b => b.toString(16).padStart(2,'0')).join('');
  trace.push({ boxId:'output', kind:'activate', sample: digest });
  return { digest, trace };
}
```

- [ ] **Step 2: Verify with Node**

Run the same extraction pattern as Task 1 Step 2, but pull `keccakRoundConstants` through
`keccak256WithTrace` from the file and check:

```javascript
const r1 = keccak256WithTrace(strToBytes(''), 0x06, 136, 32);
console.log('empty:', r1.digest === 'a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a');
const r2 = keccak256WithTrace(strToBytes('abc'), 0x06, 136, 32);
console.log('abc:', r2.digest === '3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532');
console.log('abc trace has 24 cube-r events:', r2.trace.filter(e => e.boxId.startsWith('cube-r')).length === 24);
```

Expected: three `true`.

- [ ] **Step 3: Commit**

```bash
git add public/crypto/hash/index.html
git commit -m "hash module: SHA3-256/Keccak core + trace instrumentation, node-verified"
```

---

### Task 3: Asset build script (cat thumbnail, public-domain text)

**Files:**
- Create: `tools/build_hash_assets.py`
- Produces (generated, committed like `tools/build_base64_assets.py`'s output):
  `public/crypto/hash/assets/cat-thumb.jpg`, `public/crypto/hash/assets/pubtext.txt`

**Interfaces:**
- Consumes: source photos already present at `fnac-assets/cats/` (this module's own copy, not
  a dependency on FNAC's build — just reusing the same raw source images), and the user-supplied
  `hashtext.txt` at the repo root.
- Produces: two small files consumed by Task 4's preset data as static fetchable assets.

- [ ] **Step 1: Write the script**

```python
#!/usr/bin/env python3
"""Generate Module 3 (Hashing) preset assets.
Run: .venv/bin/python tools/build_hash_assets.py"""
import pathlib
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'crypto' / 'hash' / 'assets'
CATS_SRC = ROOT / 'fnac-assets' / 'cats'
HASHTEXT_SRC = ROOT / 'hashtext.txt'


def build_cat_thumb():
    sources = sorted(p for p in CATS_SRC.iterdir() if p.suffix.lower() in ('.jpg', '.jpeg', '.png'))
    if not sources:
        raise SystemExit(f'no source photos found in {CATS_SRC}')
    img = Image.open(sources[0]).convert('RGB')
    # downscale so the whole preset stays in the "handful of message blocks" range —
    # no runtime block-count capping needed anywhere in the animation.
    img.thumbnail((64, 64))
    OUT.mkdir(parents=True, exist_ok=True)
    out_path = OUT / 'cat-thumb.jpg'
    img.save(out_path, 'JPEG', quality=60)
    print(f'cat thumbnail: {out_path} ({out_path.stat().st_size} bytes)')


def build_pubtext():
    if not HASHTEXT_SRC.exists():
        raise SystemExit(f'{HASHTEXT_SRC} not found — expected a user-supplied text file at the repo root')
    OUT.mkdir(parents=True, exist_ok=True)
    out_path = OUT / 'pubtext.txt'
    out_path.write_bytes(HASHTEXT_SRC.read_bytes())
    print(f'public-domain text: {out_path} ({out_path.stat().st_size} bytes)')


if __name__ == '__main__':
    build_cat_thumb()
    build_pubtext()
```

- [ ] **Step 2: Run it and verify output**

```bash
.venv/bin/python tools/build_hash_assets.py
```

Expected: both files listed with sizes; confirm both are under ~5KB (Step 1's `thumbnail((64,64))`
call and the known 593-byte `hashtext.txt` should guarantee this — if the cat thumbnail comes out
much larger than expected, lower the `thumbnail()` dimensions before proceeding, since Task 4's
whole "every preset stays in a handful of blocks" design assumption depends on this staying
small).

- [ ] **Step 3: Commit**

```bash
git add tools/build_hash_assets.py public/crypto/hash/assets/
git commit -m "hash module: asset build script (cat thumbnail, public-domain text)"
```

---

### Task 4: Page shell, presets, static MD5 diagram markup

**Files:**
- Modify: `public/crypto/hash/index.html`

**Interfaces:**
- Consumes: `strToBytes`, `hexToBytes` (Task 1); `md5WithTrace`, `keccak256WithTrace` (Tasks 1-2,
  not called yet in this task — just imported/available); the two asset files from Task 3.
- Produces: `PRESETS` array (consumed by this task's own input-box wiring and later reused by
  Task 8 for history-log labeling), `getActiveInputBytes()`, `setAlgorithm(name)`,
  `getAlgorithm()`, DOM structure with stable IDs matching every `boxId` the MD5 trace emits
  (`pad`, `split`, `block-0-r1`, `block-0-r1-loop`, `chain-0`, ..., `output`) — consumed by
  Task 6's animation engine, which looks boxes up by `document.getElementById('hash-box-' + boxId)`.

Apply the `warm-editorial-ui` skill for all styling in this task — invoke it before writing CSS,
follow its token names (`--bg`, `--panel`, `--accent`, `--gold`, `--ok`, fonts) exactly as used
elsewhere in this repo (e.g. `public/crypto/encoding/index.html`'s `:root` block) rather than
inventing new values.

- [ ] **Step 1: Replace the `<body>` in `public/crypto/hash/index.html` with the layout shell**

Add `<style>` (invoke `warm-editorial-ui` for the token values) and this markup/JS structure.
The row is three boxes; below it, the animation box with the **MD5 diagram already visible and
idle** (this task doesn't wire the Hash button yet — Task 6 does — but the diagram markup and
its `pulse`-ready CSS must exist now so Task 6 only has to add/remove classes, not build DOM):

```javascript
const PRESETS = [
  { id: 'custom', label: 'Custom', kind: 'custom' },
  { id: 'letter-a', label: 'Letter: a', kind: 'fixed', text: 'a' },
  { id: 'letter-cyrillic-a', label: 'Letter: а (Cyrillic)', kind: 'fixed', text: 'а' },
  { id: 'whitespace', label: 'Whitespace jumble', kind: 'fixed',
    text: '  \t ​     \t​  ' },
  { id: 'pubtext', label: 'Public-domain text', kind: 'fetch', url: 'assets/pubtext.txt' },
  { id: 'cat', label: 'Cat photo', kind: 'fetch-binary', url: 'assets/cat-thumb.jpg' },
  { id: 'collision', label: 'MD5 collision message', kind: 'fixed-hex',
    hex: 'd131dd02c5e6eec4693d9a0698aff95c2fcab58712467eab4004583eb8fb7f8955ad340609f4b30283e488832571415a085125e8f7cdc99fd91dbdf280373c5bd8823e3156348f5bae6dacd436c919c6dd53e2b487da03fd02396306d248cda0e99f33420f577ee8ce54b67080a80d1ec69821bcb6a8839396f9652b6ff72a70' },
];

let presetIndex = 0;
let currentAlgorithm = 'md5'; // or 'sha3'
let customText = '';
let cachedFetchedBytes = {}; // presetId -> number[]

function getAlgorithm() { return currentAlgorithm; }
function setAlgorithm(name) { currentAlgorithm = name; renderAlgorithmBox(); }

async function getActiveInputBytes() {
  const p = PRESETS[presetIndex];
  if (p.kind === 'custom') return strToBytes(customText);
  if (p.kind === 'fixed') return strToBytes(p.text);
  if (p.kind === 'fixed-hex') return hexToBytes(p.hex);
  if (p.kind === 'fetch' || p.kind === 'fetch-binary') {
    if (cachedFetchedBytes[p.id]) return cachedFetchedBytes[p.id];
    const res = await fetch(p.url);
    const buf = new Uint8Array(await res.arrayBuffer());
    const bytes = [...buf];
    cachedFetchedBytes[p.id] = bytes;
    return bytes;
  }
  return [];
}
```

Diagram DOM — one persistent block per MD5 stage, `id="hash-box-<boxId>"` matching the trace
`boxId`s exactly (Task 1's trace only ever emits `pad`, `split`, `chain-N`, `block-N-rM`,
`block-N-rM-loop`, `output` — for the STATIC idle diagram in this task, render a **fixed
skeleton with placeholder block-0** showing pad → split → 4 round-boxes (each containing one
inner "loop" indicator element) → output, connected with arrow `<div>`s; Task 6 will
dynamically add/remove additional `block-N-*` elements for however many real blocks the current
input actually produces, since block count varies by input):

```html
<div class="hash-row">
  <div class="box" id="input-box">
    <div class="box-title">Input</div>
    <button class="arrow-btn" id="input-prev">◀</button>
    <textarea id="input-custom" placeholder="type something..."></textarea>
    <div id="input-preset-display" class="preset-display"></div>
    <button class="arrow-btn" id="input-next">▶</button>
  </div>
  <div class="box" id="algo-box">
    <div class="box-title">Algorithm</div>
    <button class="arrow-btn" id="algo-prev">◀</button>
    <span id="algo-name">MD5</span>
    <button class="arrow-btn" id="algo-next">▶</button>
    <button id="hash-btn">Hash</button>
    <input type="range" id="speed-slider" min="1" max="100" value="50">
  </div>
  <div class="box" id="output-box">
    <div class="box-title">Output</div>
    <div id="output-digest">—</div>
    <div id="output-bits"></div>
  </div>
</div>
<div class="animation-box" id="animation-box">
  <div class="diagram" id="diagram-md5">
    <div class="stage-box" id="hash-box-pad"><span class="box-title">Pad</span><span class="sample"></span></div>
    <div class="flow-arrow"></div>
    <div class="stage-box" id="hash-box-split"><span class="box-title">Split into 512-bit blocks</span><span class="sample"></span></div>
    <div class="flow-arrow"></div>
    <div class="block-chain" id="md5-block-chain">
      <!-- Task 6 populates one block-group per real block here -->
    </div>
    <div class="flow-arrow"></div>
    <div class="stage-box" id="hash-box-output"><span class="box-title">Output state</span><span class="sample"></span></div>
  </div>
</div>
```

- [ ] **Step 2: Wire the input box (arrows, custom textarea, preset display)**

```javascript
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

function renderAlgorithmBox() {
  document.getElementById('algo-name').textContent = currentAlgorithm === 'md5' ? 'MD5' : 'SHA-3';
}
document.getElementById('algo-prev').onclick = document.getElementById('algo-next').onclick =
  () => setAlgorithm(currentAlgorithm === 'md5' ? 'sha3' : 'md5');
renderAlgorithmBox();
```

- [ ] **Step 3: Verify with real pointer clicks**

Serve locally, open `http://localhost:8787/public/crypto/hash/?v=1`. Use Chrome MCP (or
Playwright if no browser is connected — check `list_connected_browsers` first): click the input
box's right arrow 7 times, confirm it cycles through all 7 presets and wraps back to Custom;
type into the custom textarea when on the Custom preset, confirm the text persists if you arrow
away and back; click the algorithm box's arrow, confirm it toggles MD5 ⇄ SHA-3 label. Confirm no
console errors on load.

- [ ] **Step 4: Commit**

```bash
git add public/crypto/hash/index.html
git commit -m "hash module: page shell, 7-preset input box, static MD5 diagram markup"
```

---

### Task 5: SHA-3 idle diagram + rotatable 3D CSS cube

**Files:**
- Modify: `public/crypto/hash/index.html`

**Interfaces:**
- Consumes: nothing new from earlier tasks (parallel diagram to Task 4's MD5 one).
- Produces: `#diagram-sha3` DOM tree with the same `id="hash-box-<boxId>"` convention as Task 4,
  matching every `boxId` SHA-3's trace emits (`pad`, `absorb-split`, `absorb-N`, `cube-rM`,
  `squeeze`, `output`) — consumed by Task 7. Produces cube drag-rotation wired to pointer events,
  self-contained (no dependency on Task 6/7's animation engine — the cube rotates freely by user
  drag regardless of whether an animation is playing).

- [ ] **Step 1: Add the SHA-3 diagram markup, hidden by default**

```html
<div class="diagram" id="diagram-sha3" style="display:none">
  <div class="stage-box" id="hash-box-pad"><span class="box-title">Pad</span><span class="sample"></span></div>
  <div class="flow-arrow"></div>
  <div class="stage-box" id="hash-box-absorb-split"><span class="box-title">Split into rate-blocks</span><span class="sample"></span></div>
  <div class="flow-arrow"></div>
  <div class="absorb-chain" id="sha3-absorb-chain">
    <!-- Task 7 populates one absorb-flow arrow per real rate-block here -->
  </div>
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
  <div class="flow-arrow"></div>
  <div class="stage-box" id="hash-box-squeeze"><span class="box-title">Squeeze</span><span class="sample"></span></div>
  <div class="flow-arrow"></div>
  <div class="stage-box" id="hash-box-output"><span class="box-title">Output</span><span class="sample"></span></div>
</div>
```

- [ ] **Step 2: Cube CSS (3D transforms, rate/capacity color split, no library)**

```css
.cube-wrap{ perspective: 800px; display:flex; flex-direction:column; align-items:center; gap:8px; }
.cube{ width:90px; height:90px; position:relative; transform-style:preserve-3d;
  transform: rotateX(-20deg) rotateY(30deg); cursor:grab; touch-action:none; }
.cube:active{ cursor:grabbing; }
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
.legend-capacity::before{ content:'■ '; color:var(--panel2); }
```

- [ ] **Step 3: Drag-to-rotate, plain pointer events (no quaternion math — per design decision,
  Euler-angle CSS transform composition is the deliberate compat-first choice)**

```javascript
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

- [ ] **Step 4: Verify with real pointer clicks**

Load the page, confirm the MD5 diagram is still the one visible by default (SHA-3's is
`display:none` until Task 6/7 wires the algorithm switch to toggle it). Temporarily remove the
`style="display:none"` in the browser devtools (or via a quick one-line JS console command) to
confirm the cube renders as an actual 3D cube (six visibly distinct faces, not a flat square) and
drag on it with the mouse, confirming it rotates smoothly around both axes and stays where you
leave it.

- [ ] **Step 5: Commit**

```bash
git add public/crypto/hash/index.html
git commit -m "hash module: SHA-3 diagram + rotatable CSS-3D cube, no dependencies"
```

---

### Task 6: Shared animation engine, wired to MD5

**Files:**
- Modify: `public/crypto/hash/index.html`

**Interfaces:**
- Consumes: `md5WithTrace` (Task 1), `getActiveInputBytes`, `getAlgorithm` (Task 4), the
  `#hash-box-*` DOM elements (Task 4).
- Produces: `playTrace(trace, getSpeedMs, onEvent, onDone)` — the shared engine, consumed as-is
  by Task 7 for SHA-3 (no algorithm-specific logic lives in this function, only in what `onEvent`
  does per box, which Task 7 supplies its own handler for). Produces `renderMd5BlockChain(numBlocks)`
  which builds the right number of block-groups in `#md5-block-chain` before playback starts.

**The restart-safety pattern** (reuse this exactly — it's what the Global Constraints section
requires): a single monotonically-incrementing `runId`. Every call to `playTrace` bumps it and
captures its own value in a closure; the rAF loop checks `myRunId !== currentRunId` each frame
and simply stops if it's been superseded. No timers to clear, no cancel tokens to pass around.

- [ ] **Step 1: The engine**

```javascript
let currentRunId = 0;

function playTrace(trace, getSpeedMs, onEvent, onDone) {
  const myRunId = ++currentRunId;
  let idx = 0;
  let lastTime = performance.now();
  function frame(now) {
    if (myRunId !== currentRunId) return; // a newer run superseded this one — stop silently
    const stepMs = getSpeedMs();
    let elapsed = now - lastTime;
    while (elapsed >= stepMs && idx < trace.length) {
      onEvent(trace[idx]);
      idx++;
      elapsed -= stepMs;
    }
    lastTime = now - elapsed;
    if (idx < trace.length) requestAnimationFrame(frame);
    else onDone();
  }
  requestAnimationFrame(frame);
}

// "top up, don't reset" pulse: add .pulse (fast transition in), then remove it two frames
// later so the box's own slower base transition (defined in Task 4/5's CSS) carries it back
// down — re-triggering mid-decay just restarts from wherever the brightness currently is,
// because that's how CSS transitions naturally interpolate from current computed value.
//
// SCOPED, not global, lookup: MD5's and SHA-3's diagrams both use the shared boxId
// convention (`pad`, `output`, etc. mean the same conceptual stage in either algorithm), so
// both diagrams' markup uses id="hash-box-pad" / id="hash-box-output" — genuinely duplicate
// DOM ids across the two diagrams (Task 4 built #diagram-md5, Task 5 built #diagram-sha3,
// same convention, same literal ids). A bare `document.getElementById('hash-box-'+boxId)`
// only ever resolves the FIRST matching element in document order (MD5's, since it comes
// first) regardless of which diagram is actually active — SHA-3's own pad/output boxes would
// then silently never update. `querySelector` scoped to whichever diagram element is
// currently selected sidesteps this correctly (querySelector resolves ids within its scope
// root even when the same id exists elsewhere in the document, unlike getElementById).
function pulseBox(boxId, sample) {
  const diagramId = getAlgorithm() === 'md5' ? 'diagram-md5' : 'diagram-sha3';
  const root = document.getElementById(diagramId);
  const el = root && root.querySelector('#hash-box-' + boxId);
  if (!el) return; // block-N-* elements only exist once renderMd5BlockChain has built them
  const sampleEl = el.querySelector('.sample');
  if (sampleEl && sample) sampleEl.textContent = sample;
  el.classList.add('pulse');
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('pulse')));
}
```

CSS for the pulse (add alongside Task 4/5's diagram CSS):

```css
.stage-box{ filter:brightness(1); transition:filter 1.2s ease-out; border:1px solid var(--edge);
  padding:10px 12px; border-radius:6px; background:var(--panel2); position:relative; }
.stage-box.pulse{ filter:brightness(1.7); transition:filter .06s ease-out; }
.stage-box .box-title{ font-family:var(--mono); font-size:.66rem; text-transform:uppercase;
  letter-spacing:.1em; color:var(--gold); position:absolute; top:6px; left:10px; }
.stage-box .sample{ font-family:var(--mono); font-size:.7rem; color:var(--ink); display:block;
  margin-top:16px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.flow-arrow{ height:20px; width:2px; background:var(--edge); margin:0 auto; transition:background-color 1.2s ease-out, box-shadow 1.2s ease-out; }
.flow-arrow.pulse{ background:var(--gold); box-shadow:0 0 8px var(--gold); transition:background-color .06s ease-out, box-shadow .06s ease-out; }
.block-chain{ display:flex; flex-direction:column; gap:14px; }
.block-group{ display:flex; flex-direction:column; gap:8px; padding:10px; border:1px dashed var(--edge); border-radius:6px; }
```

- [ ] **Step 2: Build the MD5 block chain dynamically (block count varies by real input length)**

```javascript
function renderMd5BlockChain(numBlocks) {
  const chain = document.getElementById('md5-block-chain');
  chain.innerHTML = '';
  for (let b = 0; b < numBlocks; b++) {
    const group = document.createElement('div');
    group.className = 'block-group';
    let html = '';
    for (let r = 1; r <= 4; r++) {
      html += `<div class="stage-box" id="hash-box-block-${b}-r${r}"><span class="box-title">Block ${b} · Round ${r}</span><span class="sample"></span>`;
      html += `<div class="stage-box" id="hash-box-block-${b}-r${r}-loop" style="margin-top:8px"><span class="box-title">16 ops</span><span class="sample"></span></div>`;
      html += `</div>`;
    }
    group.innerHTML = html;
    chain.appendChild(group);
    if (b < numBlocks - 1) {
      const arrow = document.createElement('div');
      arrow.className = 'flow-arrow chain-arrow';
      arrow.id = 'hash-box-chain-' + b;
      arrow.title = 'entire state passed in the clear — this hand-off is what a length-extension attack exploits';
      chain.appendChild(arrow);
    }
  }
}
```

CSS for the chain-arrow callout (the length-extension weak-point highlight from the spec):

```css
.chain-arrow{ width:4px; background:var(--accent); position:relative; }
.chain-arrow.pulse{ background:var(--accent); box-shadow:0 0 8px var(--accent); }
```

- [ ] **Step 3: Wire the Hash button**

```javascript
function getSpeedMs() {
  // slider 1..100 maps to ~40ms (fast) .. ~4ms (fastest) per event; slider is read LIVE each
  // frame inside playTrace's loop (it calls this function every frame), so dragging it during
  // playback changes pacing immediately, per the design spec's live-speed requirement.
  const v = Number(document.getElementById('speed-slider').value);
  return 4 + (100 - v) * 0.4;
}

async function onHashClick() {
  const bytes = await getActiveInputBytes();
  const algo = getAlgorithm();
  document.getElementById('input-box').classList.add('active-flash');
  setTimeout(() => document.getElementById('input-box').classList.remove('active-flash'), 400);
  if (algo === 'md5') {
    const { digest, trace } = md5WithTrace(bytes);
    const numBlocks = Number(trace.find(e => e.boxId === 'split').sample.split(' ')[0]);
    renderMd5BlockChain(numBlocks);
    document.getElementById('diagram-md5').style.display = '';
    document.getElementById('diagram-sha3').style.display = 'none';
    playTrace(trace, getSpeedMs, (ev) => pulseBox(ev.boxId, ev.sample), () => {
      document.getElementById('output-digest').textContent = digest;
      document.getElementById('output-bits').textContent = '128-bit / 32 hex chars';
      document.getElementById('output-box').classList.add('active-flash');
      setTimeout(() => document.getElementById('output-box').classList.remove('active-flash'), 400);
    });
  }
  // SHA-3 branch added in Task 7
}
document.getElementById('hash-btn').onclick = onHashClick;
```

`.active-flash` CSS (the outer input/output box flash, distinct from individual diagram-box
pulses):

```css
#input-box, #output-box{ transition: background-color .4s ease-out; }
#input-box.active-flash, #output-box.active-flash{ background-color: color-mix(in srgb, var(--gold) 25%, var(--panel)); transition: background-color .05s ease-out; }
```

- [ ] **Step 4: Verify with real pointer clicks**

Serve locally, load the page with `?v=2`. Set the input to the Custom preset, type `abc`, click
Hash. Confirm: the MD5 diagram's boxes visibly pulse in sequence (pad → split → block round
boxes → output), the output box ends up showing `900150983cd24fb0d6963f7d28e17f72`, and the
input box visibly flashes at the start. Drag the speed slider mid-animation and confirm the pulse
rate visibly changes without restarting. Click Hash again while an animation is mid-flight and
confirm it immediately restarts from frame 0 (pad box pulses again right away) rather than
finishing the old run or stacking two runs. Switch to the collision preset, click Hash, confirm
output is `79054025255fb1a26e4bc422aef54eb4`.

- [ ] **Step 5: Commit**

```bash
git add public/crypto/hash/index.html
git commit -m "hash module: shared animation engine, wired to MD5, restart-safe + live speed"
```

---

### Task 7: Wire SHA-3 into the same engine, cube pulsing

**Files:**
- Modify: `public/crypto/hash/index.html`

**Interfaces:**
- Consumes: `keccak256WithTrace` (Task 2), `playTrace`, `pulseBox` (Task 6), `#diagram-sha3`
  (Task 5).
- Produces: `renderSha3AbsorbChain(numBlocks)` (mirrors Task 6's `renderMd5BlockChain`), the
  completed `onHashClick` `sha3` branch.

- [ ] **Step 1: Build the absorb chain dynamically + make the cube itself pulseable**

The cube needs its own `id="hash-box-cube-r0"` .. `id="hash-box-cube-r23"` — but a physical cube
only has 6 faces, not 24 individually addressable elements. Represent each of the 24 rounds as a
pulse of the **whole cube** (brightness pulse on `#cube`, same `.pulse` class/CSS from Task 6,
one shared element receiving 24 sequential activations) rather than 24 separate DOM nodes:

```javascript
function renderSha3AbsorbChain(numBlocks) {
  const chain = document.getElementById('sha3-absorb-chain');
  chain.innerHTML = '';
  for (let b = 0; b < numBlocks; b++) {
    const arrow = document.createElement('div');
    arrow.className = 'flow-arrow';
    arrow.id = 'hash-box-absorb-' + b;
    chain.appendChild(arrow);
  }
}

// Every cube-rN event pulses the same #cube element — 24 real pulses, one shared box,
// matching the design spec's "compress the OUTER block count if needed, but the real 16/24
// inner repetitions play at true count" decision. Route all cube-r* boxIds to #cube here
// rather than trying to create 24 DOM nodes for a 6-faced object.
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

Add `.cube.pulse` CSS (brightness pulse on the cube itself, same top-up/decay convention):

```css
.cube{ filter:brightness(1); transition:filter 1.2s ease-out; }
.cube.pulse{ filter:brightness(1.6); transition:filter .06s ease-out; }
```

- [ ] **Step 2: Add the SHA-3 branch to `onHashClick`**

Replace the `// SHA-3 branch added in Task 7` comment from Task 6 Step 3 with:

```javascript
  if (algo === 'sha3') {
    const { digest, trace } = keccak256WithTrace(bytes);
    const numBlocks = Number(trace.find(e => e.boxId === 'absorb-split').sample.split(' ')[0]);
    renderSha3AbsorbChain(numBlocks);
    document.getElementById('diagram-md5').style.display = 'none';
    document.getElementById('diagram-sha3').style.display = '';
    playTrace(trace, getSpeedMs, (ev) => pulseBoxOrCube(ev.boxId, ev.sample), () => {
      document.getElementById('output-digest').textContent = digest;
      document.getElementById('output-bits').textContent = '256-bit / 64 hex chars';
      document.getElementById('output-box').classList.add('active-flash');
      setTimeout(() => document.getElementById('output-box').classList.remove('active-flash'), 400);
    });
  }
```

Also change Task 6 Step 3's MD5 branch to call `pulseBoxOrCube` instead of `pulseBox` directly
(harmless for MD5 since none of its `boxId`s start with `cube-r`, and keeps one consistent event
handler passed to `playTrace` regardless of algorithm).

- [ ] **Step 3: Verify with real pointer clicks**

Switch the algorithm box to SHA-3, confirm the diagram visibly swaps (MD5's round-boxes disappear,
the cube diagram appears). Set input to Custom, type `abc`, click Hash: confirm the cube visibly
pulses repeatedly during playback (drag it mid-animation to confirm it's still rotatable while
pulsing — the two behaviors shouldn't interfere), and the output box ends up showing
`3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532` labeled `256-bit / 64 hex chars`.
Switch back to MD5 on the same input and confirm the digest changes back to the MD5 value —
proves the algorithm switch actually re-hashes rather than reusing a stale result.

- [ ] **Step 4: Commit**

```bash
git add public/crypto/hash/index.html
git commit -m "hash module: wire SHA-3 into the shared animation engine, cube pulsing"
```

---

### Task 8: History log with content-hash IDs + collision highlight

**Files:**
- Modify: `public/crypto/hash/index.html`

**Interfaces:**
- Consumes: `getAlgorithm`, `PRESETS`, `presetIndex`, `customText` (Task 4); runs after each
  `onHashClick` completion (Tasks 6-7).
- Produces: `addHistoryEntry(algo, digest, inputBytes)`, `fnvId(bytes)` — a cheap
  non-cryptographic hash used purely as a bookkeeping ID (not part of the lesson, doesn't need to
  be strong), reusing the same FNV approach already used elsewhere in this repo for per-user key
  derivation (e.g. `public/crypto/fnac/index.html`'s `fnv` helper) rather than inventing a new
  scheme.

- [ ] **Step 1: Add the history data structure + ID function**

```javascript
let historyLog = []; // {algo, digest, id, label}, newest first, max 5

function fnvId(bytes) {
  let h = 2166136261 >>> 0;
  for (const b of bytes) { h ^= b; h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function inputLabel() {
  const p = PRESETS[presetIndex];
  if (p.kind === 'custom') return customText ? `"${customText.slice(0, 24)}${customText.length > 24 ? '…' : ''}"` : '(empty custom)';
  return p.label;
}

function addHistoryEntry(algo, digest, inputBytes) {
  const entry = { algo, digest, id: fnvId(inputBytes), label: inputLabel() };
  historyLog.unshift(entry);
  historyLog = historyLog.slice(0, 5);
  renderHistory();
}

function renderHistory() {
  const el = document.getElementById('history-list');
  el.innerHTML = '';
  historyLog.forEach((entry, i) => {
    // a real collision: same algo, same digest, but a DIFFERENT id (different actual input) —
    // re-hashing the identical input (same id) must NOT be flagged, that's expected/boring.
    const isCollision = historyLog.some((other, j) => j !== i &&
      other.algo === entry.algo && other.digest === entry.digest && other.id !== entry.id);
    const row = document.createElement('div');
    row.className = 'history-row' + (isCollision ? ' collision' : '');
    row.innerHTML = `<span class="h-algo">${entry.algo.toUpperCase()}</span>` +
      `<span class="h-label">${entry.label}</span>` +
      `<span class="h-digest">${entry.digest}</span>` +
      (isCollision ? '<span class="h-flag">⚑ COLLISION</span>' : '');
    el.appendChild(row);
  });
}
```

- [ ] **Step 2: CSS for the history list**

```css
#history-list{ display:flex; flex-direction:column; gap:6px; margin-top:14px; }
.history-row{ font-family:var(--mono); font-size:.7rem; display:flex; gap:10px; align-items:center;
  padding:6px 10px; border:1px solid var(--edge); border-radius:4px; background:var(--panel2); }
.history-row.collision{ border-color:var(--accent); background: color-mix(in srgb, var(--accent) 12%, var(--panel2)); }
.h-algo{ color:var(--gold); font-weight:700; min-width:34px; }
.h-label{ color:var(--dim); flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.h-digest{ color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:200px; }
.h-flag{ color:var(--accent); font-weight:700; }
```

Add `<div id="history-list"></div>` to the page markup, below the three-box row (e.g. right after
the `.hash-row` div from Task 4).

- [ ] **Step 3: Call `addHistoryEntry` from both `onHashClick` branches**

In Task 6 Step 3's MD5 `onDone` callback and Task 7 Step 2's SHA-3 `onDone` callback, add
`addHistoryEntry(algo, digest, bytes);` as the first line inside each `onDone` function (both
already close over `bytes`, `algo`, and `digest` from `onHashClick`'s scope).

- [ ] **Step 4: Verify with real pointer clicks**

Hash the Custom preset with text `hello` under MD5 twice in a row (click Hash, wait for it to
finish, click Hash again with the same text) — confirm **neither** history row gets the collision
flag (same input both times, same `id`, expected). Then hash the MD5 collision preset, then
immediately hash it again — still no flag (same input). Now: hash the MD5 collision preset once,
then switch input to Custom, type in ANY different text, hash it too — still no flag, different
digest. Finally, the real test: switch algorithm to MD5, hash the **collision preset**, then edit
custom text to literally retype ` ` differently — actually the cleanest real test is:
hash the collision preset (`digest 79054025...`), then check whether the plan's own trace shows a
matching pair exists anywhere reachable in the UI — since only ONE collision-preset entry exists
in `PRESETS`, getting two *different-content* entries with the same digest inside this page's
reachable inputs specifically requires Task 9's dedicated collision panel (both real messages,
different content, identical digest) — confirm Task 9 wires its two hashes through
`addHistoryEntry` too so this flag condition gets a real, true-positive exercise once Task 9 lands
(cross-reference in Task 9 Step 3).

- [ ] **Step 5: Commit**

```bash
git add public/crypto/hash/index.html
git commit -m "hash module: history log, content-hash IDs, collision highlight"
```

---

### Task 9: Collision demo secondary panel

**Files:**
- Modify: `public/crypto/hash/index.html`

**Interfaces:**
- Consumes: `md5WithTrace` (Task 1), `addHistoryEntry` (Task 8), `hexToBytes` (Task 1).
- Produces: nothing consumed by later tasks — this is the last content task before final
  integration (Task 10).

- [ ] **Step 1: Add the panel markup (collapsed by default) + toggle**

```html
<details class="collision-panel">
  <summary>MD5 collision demo — two different real messages, one digest</summary>
  <div class="collision-cols">
    <div class="collision-col">
      <div class="box-title">Message 1</div>
      <div id="collision-digest-1" class="h-digest">—</div>
    </div>
    <div class="collision-col">
      <div class="box-title">Message 2</div>
      <div id="collision-digest-2" class="h-digest">—</div>
    </div>
  </div>
  <button id="collision-run-btn">Hash both, live</button>
  <div id="collision-verdict"></div>
</details>
```

- [ ] **Step 2: Wire the run button**

```javascript
const COLLISION_MSG_1_HEX = 'd131dd02c5e6eec4693d9a0698aff95c2fcab58712467eab4004583eb8fb7f8955ad340609f4b30283e488832571415a085125e8f7cdc99fd91dbdf280373c5bd8823e3156348f5bae6dacd436c919c6dd53e2b487da03fd02396306d248cda0e99f33420f577ee8ce54b67080a80d1ec69821bcb6a8839396f9652b6ff72a70';
const COLLISION_MSG_2_HEX = 'd131dd02c5e6eec4693d9a0698aff95c2fcab50712467eab4004583eb8fb7f8955ad340609f4b30283e4888325f1415a085125e8f7cdc99fd91dbd7280373c5bd8823e3156348f5bae6dacd436c919c6dd53e23487da03fd02396306d248cda0e99f33420f577ee8ce54b67080280d1ec69821bcb6a8839396f965ab6ff72a70';

document.getElementById('collision-run-btn').onclick = () => {
  const b1 = hexToBytes(COLLISION_MSG_1_HEX), b2 = hexToBytes(COLLISION_MSG_2_HEX);
  const r1 = md5WithTrace(b1), r2 = md5WithTrace(b2);
  document.getElementById('collision-digest-1').textContent = r1.digest;
  document.getElementById('collision-digest-2').textContent = r2.digest;
  const verdict = document.getElementById('collision-verdict');
  verdict.textContent = r1.digest === r2.digest
    ? 'Identical. Two different real messages, the exact same MD5 output.'
    : 'unexpected mismatch — this should never happen with these two fixed messages';
  verdict.className = r1.digest === r2.digest ? 'verdict ok' : 'verdict no';
  addHistoryEntry('md5', r1.digest, b1);
  addHistoryEntry('md5', r2.digest, b2);
};
```

- [ ] **Step 3: CSS for the panel**

```css
.collision-panel{ margin-top:24px; border:1px solid var(--edge); border-radius:8px; padding:14px 18px; background:var(--panel); }
.collision-panel summary{ cursor:pointer; font-family:var(--mono); font-size:.8rem; color:var(--gold); }
.collision-cols{ display:flex; gap:20px; margin-top:12px; }
.collision-col{ flex:1; }
#collision-verdict.ok{ color:var(--ok); } #collision-verdict.no{ color:var(--accent); }
```

- [ ] **Step 4: Verify with real pointer clicks**

Load the page, confirm the collision panel is collapsed by default (no auto-run). Expand it,
click "Hash both, live" — confirm both digest fields show the identical
`79054025255fb1a26e4bc422aef54eb4` and the verdict reads the success message. Then scroll to the
history log (Task 8) and confirm **both** of the two new entries this click added are now flagged
with the collision highlight — this is the true-positive case Task 8 Step 4 flagged as needing
this task to actually exercise: same algorithm, same digest, genuinely different `id`s (different
underlying message bytes), so the flag condition fires correctly here where it didn't for
same-input re-hashes.

- [ ] **Step 5: Commit**

```bash
git add public/crypto/hash/index.html
git commit -m "hash module: collision demo panel, verified against history-log flag"
```

---

### Task 10: Full integration pass + spec conformance check

**Files:**
- Modify: `public/crypto/hash/index.html` (only if gaps are found)

**Interfaces:**
- Consumes: everything from Tasks 1-9.
- Produces: nothing — this is a verification-only task, closing the loop against
  `docs/superpowers/specs/2026-08-12-hash-visualization-design.md`.

- [ ] **Step 1: Re-read the design spec section by section, check each requirement against the
  running page**

Serve locally, open the page fresh (clear any leftover `localStorage`/state from prior manual
testing). Walk the spec top to bottom:
- Page layout row (input/algorithm/output) — present, arrows work, speed live-adjustable.
- Animation box never empty, idle diagram visible on load before any Hash click.
- MD5 diagram: real block count for a multi-block input (switch to the public-domain-text
  preset — should show more than 1 block, since 593 bytes / 64 ≈ 10 blocks), chain-arrow visibly
  distinct color, inner loop plays 16 real pulses per round (not 2).
- SHA-3 diagram: cube renders and rotates, real 24 pulses per hash, rate/capacity color split
  visible on the cube faces.
- 7 presets exactly, in the order the spec's Section 2 (Input) lists them, custom first.
- History log: 5-entry cap, newest-first, collision highlighting works (already proven in
  Task 8/9, just re-confirm here in the fully-integrated page).
- Restart-on-spam-click: click Hash repeatedly, fast, confirm it always ends on the LAST click's
  input/algorithm, never a stale earlier one.

- [ ] **Step 2: Cross-browser-safe check for BigInt and CSS 3D transform support**

This module leans on `BigInt` (SHA-3's 64-bit lanes) and CSS 3D transforms (the cube) — both are
long-standard in evergreen browsers, but confirm no console errors on load in whatever
Chrome/Chromium version Playwright or Chrome MCP is actually using for verification, since that's
the same rendering engine family school lab machines are likely to run.

- [ ] **Step 3: Fix any gaps found, then final commit**

```bash
git add public/crypto/hash/index.html
git commit -m "hash module: integration pass, spec conformance verified"
```

Do NOT run `npx wrangler deploy` — per Global Constraints, this module stays undeployed until
the user says go.
