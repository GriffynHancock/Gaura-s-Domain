# Module 3 · Hashing — Visualization Design Spec

_Companion to `STATUS.md` and `CLAUDE.md`. Written 2026-08-12. Covers the teaching
visualization only — scored challenges are explicitly out of scope (see "Out of scope" below;
one candidate idea is logged separately in `docs/ideas-backlog.md`)._

## Overview

A single page, `public/crypto/hash/index.html` (served at `/crypto/hash/`), teaching three things
through one interactive visualization rather than three separate demos:

1. **Avalanche + fixed output length** — wildly different inputs (a single letter, a whole poem,
   an image, deliberately weird whitespace) all produce a completely different digest, but always
   the *same length* for a given algorithm.
2. **What a hash function's internals actually look like**, at a conceptual (not bit-exact) level —
   labeled stage boxes, nested boxes for internal repeated rounds, connecting arrows for data flow.
3. **Why some hash functions are considered broken and others aren't** — MD5 (Merkle–Damgård,
   real published collision) vs SHA-3 (sponge construction, structurally immune to the same class
   of attack), with the actual structural difference visually called out, not just asserted.

## Page layout

One row, three boxes side by side:

```
[  Input (custom + presets)  ]   [  Algorithm ◀▶ · Hash · speed  ]   [  Output  ]
```

- **Input box**: a free-type field is itself one of the arrow-cycled positions. Left/right arrows
  step through, in order: **custom (free-type)** → single letter `a` → its Cyrillic false friend
  `а` (U+0430 — visually identical, different code point, different bytes) → a short run of
  different Unicode whitespace characters (looks "empty," isn't) → the public-domain text preset
  (see Assets) → a small cat-photo thumbnail (see Assets) → the real MD5 collision message (see
  Collision demo). Whichever is active gets hashed when you hit Hash.
- **Middle box**: shows the current algorithm (`MD5` / `SHA-3`) with its own left/right arrows to
  switch; a **Hash** button; a speed control next to it. The speed control is read **live during
  playback**, not captured once at click time — dragging it mid-animation immediately changes
  pulse pacing.
- **Output box**: the resulting digest, labeled with its fixed bit length (128-bit / 32 hex chars
  for MD5, 256-bit / 64 hex chars for SHA3-256) so the "always the same length" point is
  reinforced every single time, regardless of which of the 7 wildly-different inputs produced it.

Below the row: the **animation box**, full width. Unlike a typical "click to reveal" demo, this
box is **never empty** — it shows the selected algorithm's full structural diagram at all times,
idle. Hitting Hash sends a light traveling through the existing diagram: each stage box brightens
on activation, then **decays gradually rather than snapping to black**, and a re-trigger tops
brightness back up from wherever it currently sits rather than resetting to 0 first — avoids any
strobe/flash discomfort and reads as "breathing" rather than blinking. Hitting Hash again while an
animation is already playing **hard-resets and restarts from frame 0** — no queueing, no async
state machine.

## Animation content

**MD5 diagram**: Pad → split into 512-bit blocks → per block (chained): 4 round-boxes, each
containing an inner loop that pulses its **real 16 repetitions** (not compressed — 16 is small
enough to show honestly with the top-up/decay pulse style) → output state. The **block-to-block
chaining arrow** — the entire 128-bit running state, passed in the clear from one block's output
straight into the next block's input — is visually called out (distinct color + short label) as
the structural weak point: it's exactly the mechanism a length-extension attack exploits, and it's
the "where MD5 gets it wrong, structurally" moment.

**SHA-3 diagram**: 2D boxes (pad, split into rate-sized blocks) → a **rotatable 3D cube**
representing the permutation state, color-coded so the outer/visible faces are the *rate* (the
part exposed to input/output) and an inner/hidden portion is the *capacity* (never exposed by
squeezing, which is exactly why SHA-3 doesn't have MD5's length-extension problem) → 2D boxes
(squeeze, output). The cube's real 24-round permutation plays at its **true count**, same
top-up/decay pulse style as MD5's inner loop. The cube is rotatable by cursor drag — implemented
with plain CSS 3D transforms (`rotateX`/`rotateY` driven by pointer-drag delta), no 3D library, no
literal quaternion math. This trades perfect gimbal-lock-free rotation for zero dependencies and
guaranteed compatibility, which is the right trade for a decorative/exploratory drag interaction.

**Connecting arrows** link every stage box in both diagrams, showing data-flow direction.

**State previews**: bit-exact rendering of the real intermediate value at every single stage isn't
practical or necessarily clearer — each active box instead shows a small abstracted "sample"
(a truncated hex snippet where cheap to compute, or a symbolic scramble swatch otherwise), enough
to sell "this is transforming right now" without claiming full bit-level accuracy everywhere.

## Collision demo

Two places, reinforcing each other:

1. **Folded into the main preset rotation** — the real published MD5 collision message (Wang,
   Feng, Lai, Yu 2004; the specific 128-byte pair reproduced on Wikipedia's MD5 article, digest
   `79054025255fb1a26e4bc422aef54eb`) is one of the 7 arrow-cycled input presets, hashable like
   any other input through the normal flow.
2. **A separate secondary panel**, toggled open (doesn't run automatically) — both real colliding
   messages hashed live, side by side, visibly converging on the identical digest. This is the
   dedicated "and here's what that structural weakness actually lets someone do" payoff, on top of
   the structural diagram's chaining-arrow callout.

## History log

Below the output box: the last 5 computed hashes, **newest on top**. Each entry stores an
**ID derived from a fast non-cryptographic hash of its raw input bytes** (reusing the FNV-style
approach already used elsewhere in this codebase for per-user key derivation — this ID is pure
bookkeeping, not part of the lesson, so it doesn't need to be cryptographically strong).

**Why content-derived, not a counter**: re-hashing the identical text (a preset re-visited, or the
custom field retyped with the same string) must produce the **same** ID both times — that's the
same input, same output, expected and boring, not a "collision." A counter/ratchet that bumps on
every submission regardless of content would falsely flag that case. Content-derived IDs avoid it
for free: **two history entries are flagged as a real collision (highlighted, flag-styled) iff
they share both algorithm and digest AND have different IDs** — i.e., genuinely different inputs
that happened to land on the same output. Hashing the MD5 collision preset alongside its pair (or
just re-visiting it after other presets) is exactly the case this is designed to catch and light
up, including outside the dedicated collision panel.

## Assets

- **Public-domain text preset**: sourced from a text file the user supplied directly at the repo
  root (`hashtext.txt`, 593 bytes) — its content is used as-is and was not reviewed as part of
  this design pass, per explicit instruction. Copied into the module's own asset folder at build
  time, unmodified.
- **Cat-photo preset**: a small build script downscales 1-2 cat photos to thumbnail size
  (order ~1-3 KB) specifically so this preset stays in the same "handful of message blocks" range
  as every other preset — no preset needs runtime block-count capping, because none of them are
  large enough to need it. (Source photos: reuse the existing `fnac-assets/cats/` originals rather
  than pulling new ones — this module doesn't depend on FNAC's LSB-steg output, just the same raw
  source images, kept as a separate small copy under this module's own assets.)
- **MD5 collision bytes**: embedded directly as a small hardcoded constant (256 bytes total across
  both messages) — small enough not to need a build step.

## Technical approach

- **Both algorithms get embedded pure-JS implementations**, instrumented with per-stage callbacks
  so the animation can hook real intermediate state. This is required regardless of what the
  browser's native `crypto.subtle.digest()` supports (it covers SHA-1/256/384/512 only — neither
  MD5 nor SHA-3 — but it's moot either way: a native black-box call couldn't be visualized
  step-by-step, so a from-scratch instrumented implementation was always necessary).
- **Everything computes live**, presets and free-typed input alike — hashing a few KB of text is
  instant in JS, so there's no need for a separate precomputed table that could drift from the
  real algorithm.
- **Verification**: both embedded implementations get checked against their official test vectors
  (MD5 against RFC 1321's own examples, SHA3-256 against NIST's published test vectors) before
  being wired into the animation, and the embedded MD5 collision pair gets verified to actually
  collide under this page's own implementation, not just cited from the literature.
- **Single dependency-free HTML file**, per project convention. Styled with the flat
  `warm-editorial-ui` skin (the project default for new modules — no thematic case for a skin
  departure here, unlike FNAC or Caesar).

## Out of scope

- Scored challenges. One candidate (hash-of-a-file-as-unlock-key) is logged in
  `docs/ideas-backlog.md`, deliberately not folded into this spec since it's a challenge-design
  question, not a teaching-visual one.
- Deployment — not deployed until user go, matching existing project convention for in-progress
  modules.
