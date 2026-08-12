# Hashing Module — Visualization Redesign (spec addendum)

_Supersedes the SHA-3 cube, MD5 diagram, input-box, collision-preset, and block-chaining sections
of `2026-08-12-hash-visualization-design.md`. Everything else in that spec (input presets list,
algorithm toggle, speed slider, history log, overall page layout/one-row structure) still stands
unchanged — this document only covers what changes._

## Why

The shipped module (`public/crypto/hash/index.html`, live at `/crypto/hash`) is functionally
correct — verified real MD5 (64-step Merkle–Damgård) and SHA3-256/Keccak-f[1600] (24-round sponge)
implementations, independently checked against Python's `hashlib` — but the visuals underneath
don't teach the real machinery:

- The SHA-3 "cube" is a single flat 90×90px panel with a diagonal gradient faking rate/capacity —
  reads as a flat plane, not a cuboid, and definitely not the 5×5 lane structure Keccak actually is.
- MD5's diagram is 4 static round-boxes + one loop dot — shows stage *names*, not the algorithm's
  actual per-step state.
- The animation's real 16-op (MD5) / 24-round (SHA-3) loop counts are correct in the trace data but
  perceptually read as "just a couple of pulses" — one dot re-pulsing in place many times looks
  like flicker, not like countable repetition.
- The input box shows only the selected preset's label text (e.g. "Letter: a"), never the actual
  resolved bytes/content.
- The MD5 collision preset shows one message with no indication of what it collides *with*.
- Multi-block MD5 chaining renders as a vertical list of block-groups joined by pill connectors —
  doesn't read as "the same running state carried forward," which is the actual lesson.

## Corrected fact: Keccak-f[1600] state geometry

**5×5×64** — 25 lanes, each 64 bits deep, 1600 bits total. (Not 16×16×4, which isn't a real Keccak
parameter — that's 1024 bits and doesn't correspond to anything in the spec.) Confirmed against
FIPS 202 §3.1 directly. This is the geometry every part of this redesign is built on.

FIPS 202's own "pieces of state" vocabulary is the design language used throughout:

| Piece | Shape | Which step operates on it |
|---|---|---|
| lane | 1×1×64 (25 of them) | ρ rotates each lane along z by its own fixed offset |
| slice | 5×5×1 (64 of them) | θ and χ both operate within a slice |
| row | 5×1×1 | χ (the only nonlinear step) self-mixes within a row |
| column | 1×5×1 | θ XORs column parities with two neighbor columns |

**Rate/capacity is lane-aligned for SHA3-256**: rate = 1088 bits = exactly 17 lanes, capacity =
512 bits = exactly 8 lanes. This is drawn as a static fact (17 of the 25 cuboids tinted gold, 8
tinted dark) rather than the diagonal gradient the current cube fakes across a single shape.

## SHA-3: 25-lane CSS-3D cuboid state

**Rendering approach (decided): 25 individual CSS-3D cuboid elements**, positioned in a real 5×5
grid with depth via CSS 3D transforms — same transform toolkit as the existing rotatable cube
(plain CSS, drag-rotation via pointer-delta accumulation, no 3D library, no quaternion math —
consistent with the project's stated "compat over correctness" call). Considered and rejected:
a canvas + hand-rolled projection renderer (more accurate, more headroom, but a real departure
from this module's plain-DOM convention — not justified when 25 DOM nodes render and animate
fine) and a lane-view/slice-view toggle (θ/χ read well in slice view but ρ, which moves bits
*along* z, reads badly in slice view — decided not worth building two renderers for one module).

Each round emits five distinct, individually-legible sub-animations (mapped onto the real θ/ρ/π/χ/ι
steps the existing `keccakF1600WithTrace` already computes — this is exposing existing internal
state for animation, not new crypto logic):

- **θ**: the 5 column-pairs adjacent to each lane briefly glow together (parity exchange between
  neighbor columns).
- **ρ**: each lane's surface stripe pattern twists by that lane's own fixed rotation offset (already
  computed by the implementation) — 25 lanes each moving a different amount is the single most
  visually distinct moment per round.
- **π**: lanes visibly slide/swap to their new grid position (the "Rubik's cube" move).
- **χ**: one row of 5 lanes highlights and self-mixes (the only nonlinear step).
- **ι**: only lane (0,0) flashes, tagged with that round's constant.

**Round counter** ("round 7 / 24") displayed next to the cuboid grid, updating live — this is the
direct fix for "only pulses twice": the trace already emits 24 real rounds, the problem was that a
single re-pulsing dot made 24 indistinguishable from 2. A visible counter plus lanes that visibly
move differently each round makes the repetition countable rather than just flickering.

## MD5: register-state view

Replace the 4-round-box + loop-dot diagram with a live register readout, drawn from the same
`md5WithTrace` implementation (trace schema extended to snapshot state per step, not new crypto):

- Four boxes — **A / B / C / D** — showing each 32-bit register's live hex value, updating every
  one of the 64 steps.
- The active nonlinear function this step — **F** (steps 0–15) / **G** (16–31) / **H** (32–47) /
  **I** (48–63) — highlighted. This alone teaches MD5's real 4-round structure better than 4 static
  boxes, since it's driven by the step index rather than asserted as a label.
- Which message word **M[g]** is being consumed this step (g's real per-round formula).
- The per-step shift amount **s[i]** and round constant **K[i]** (already computed by the existing
  implementation, just not currently surfaced to the UI).
- **Step counter** ("step 23 / 64"), same legibility role as SHA-3's round counter.

## Multi-block MD5 chaining: Z-axis stack

Replace the current vertical list of block-groups joined by pill-shaped connectors with blocks
stacked in front of each other along a Z-axis — like a deck of cards receding into the screen —
using the same CSS 3D transform toolkit as the cuboid grid. Each block's output A/B/C/D becomes the
next block's starting state, and that hand-off is what the depth-stacking is meant to make legible:
one running state carried forward through each card, not a list of separate stages.

## Small independent fixes (no open design question, ship regardless of the above)

- **Input box shows the actual resolved content**, not the preset's label. Text presets render
  their real text. The whitespace preset renders visible glyphs for whitespace characters (e.g.
  literal `\t` / `\n` tokens) since raw whitespace is invisible otherwise. Image/cat presets show a
  thumbnail + byte count. The collision preset shows its actual hex.
- **Collision preset splits into two selectable presets** — "Collision — message 1" and "Collision
  — message 2" — each annotated in the output area with "shares this digest with message 2 (or 1)"
  so what it's colliding *with* is explicit rather than implied by a single unlabeled message.

## Out of scope for this redesign

- Per-bit-level detail (showing all 1600 individual bits) — lane-level granularity only.
- Any change to the input preset list, algorithm toggle, speed slider, or history log — unchanged
  from the original spec.
- Canvas rendering — explicitly rejected above in favor of staying on the existing CSS-3D approach.
