# Module 2 (Encoding) — Revision Design

**Date:** 2026-06-25
**Module:** `public/crypto/base64/` (Module 02 · Encoding)
**Builder:** `tools/build_base64_assets.py` → generates `public/crypto/base64/assets.js`

## Goal

Make Module 2 harder to "shoulder-surf" and richer as a teaching ramp:

1. **Shuffle decode-method tiles** per puzzle, per page refresh, so students can't
   tell each other "just click the first one."
2. **Expand the method palette** with `rot47`, `url`, and `atbash` (red herrings +
   real methods).
3. **Add puzzles** that introduce each method cleanly, then mix and mislead — including
   a 3-layer puzzle and a dual-image polyglot.
4. **Fixed-size image previews** so a tiny bitmap scales up uniformly instead of
   showing a few pixels.
5. **A solve-process document** describing each puzzle's solve path and where red
   herrings can be injected into the encoded strings, for future authoring.

Reframing the pedagogy honestly (per instructor): *every decode output shown is real;
the multi-image polyglot is precomputed offline, not generated live.*

## Decode-method palette

Clickable tiles (order shuffled per card): `base64`, `hex`, `url`, `rot13`, `rot47`, `atbash`.

| Method | Role | Definition (must match JS + Python exactly) |
|--------|------|---------------------------------------------|
| base64 | real | strip `[^A-Za-z0-9+/]`, pad to %4, `atob` |
| hex    | real | strip `[^0-9a-fA-F]`, drop trailing odd nibble, pair → bytes |
| url    | real (early), distractor (later) | decode `%XX` → byte; leave other chars |
| rot47  | real | printable ASCII 33–126: `((c-33+47)%94)+33` |
| rot13  | **pure distractor** | letters rotated 13; never an answer |
| atbash | **pure distractor** | letters mirrored a↔z, A↔Z; never an answer |

All decoders are **best-effort and never throw** (existing convention): wrong input
yields nonsense bytes, not an error.

## Puzzle ramp (9 puzzles)

Method introductions come first and are made *obvious*; mixing and red herrings come later.

| # | Title | Correct pipeline | Teaching role | Source |
|---|-------|------------------|---------------|--------|
| 1 | Decode the Signal | `base64` | intro base64 — obvious `=` tell | existing `a` |
| 2 | Picture This | `base64` (view=image) | base64 again, new output type | existing `b` |
| 3 | Sixteen *(new)* | `hex` | intro hex — only `0-9a-f`, even length | new |
| 4 | Percent Sign *(new)* | `url` | intro url — obvious `%66%6c%61%67…` | new |
| 5 | Among the Bytes | `base64` (view=image) | image hides text after IEND | existing `c` (sting) |
| 6 | Order Matters | `base64 → hex` | mixing begins (2 layers) | existing `d` |
| 7 | Three Deep *(new)* | `base64 → rot47 → hex` | 3 layers; rot47 required | new |
| 8 | Two Faces *(new)* | `hex` → flag / `base64` → troll | dual-image polyglot (2nd-last) | new |
| 9 | *(new, last)* | `base64` | red herrings baked into the string | new |

- **url** is the answer only in #4; in later puzzles it is a distractor.
- **rot13** and **atbash** are never answers anywhere.
- Each clean intro puzzle (#1, #3, #4) keeps the encoded string *unambiguous* — the
  blob screams its method. Red herrings appear from #6 onward, peaking at #9.

### Puzzle #9 — baked-in red herrings

A `base64` flag whose decoded text *also* contains misleading material, e.g.:
- a trailing decoy `flag{not_the_real_one}` before the real flag, or
- hex-looking / `%`-looking substrings that tempt a wrong second layer.

The point: teach students to read the whole output and ignore plausible-looking noise.
Exact red herrings are documented in the solve-paths doc so they can be tuned later.

## Two Faces — dual-image polyglot construction

One blob string `S`, two real decode paths to two different images.

- **`hex` path → exact flag PNG.** `S`'s hex characters (`[0-9a-f]`), in order, equal
  `flag_png.hex()`. The UI `hex` method strips every non-hex char, so decoy letters
  vanish and the flag PNG is reconstructed **byte-exact**. View=image renders the real PNG.
- **`base64` path → trollface.** `base64` keeps *all* of `S` (every char is in the
  base64 alphabet), groups 4→3 bytes. Those bytes are **not** a PNG, so the IMAGE view
  paints them as raw RGB via the existing `bytesCanvas`. The builder chooses the decoy
  characters so the painted pixels read as a troll.

**Decoy alphabet:** `[G-Zg-z+/]` — in the base64 alphabet but **not** hex, so `hex`
drops them while `base64` keeps them.

**Builder algorithm (`build_two_faces`):**
1. `flag_png = png_bytes(flag_bitmap("flag{two_faces}"))`; `hex_str = flag_png.hex()`.
2. Render a small troll target bitmap (≈24×24) → target RGB byte stream `T`.
3. Construct `S` left-to-right, emitting the chars of `hex_str` in order and inserting
   decoy chars between them. base64 reads `S` in 4-char groups → 3 output bytes each.
   For positions occupied by a (forced) hex char, the output bits are fixed; for decoy
   positions, pick the base64 char whose 6-bit value best matches the corresponding bits
   of the target byte in `T`. The troll is painted approximately, so best-effort suffices.
4. **Verify in the builder:** re-implement the UI `hex` and `base64` filters in Python,
   assert `hex(S) == flag_png` (exact), and render the `base64(S)`-painted pixels to a
   PNG file (`tools/out/two_faces_troll_preview.png`) for a human eyeball check.
5. **Fallback:** if the troll is unrecognizable, reduce the target to a blocky 2-tone
   16×16 troll and raise decoy density (more free bits per output byte). The flag path is
   unaffected (always exact).

Store `S` in `assets.js` as `two_faces` plus `flags.two_faces = "flag{two_faces}"`.

## Fixed-size image previews

Current behaviour scales canvas to `W*6` (cap 220) and `<img>` to 160/240px by size,
so tiny bitmaps look like a few pixels.

**Change:** render every image preview (real `<img>` and `bytesCanvas`) at a **fixed
display width** (e.g. 240px) with `image-rendering:pixelated`, height auto, capped by the
preview box height. Small bitmaps scale up crisp-blocky; large images fit the box. No
reflow between puzzles. Implementation: drop the per-image width logic; set width in CSS
(`.preview img, .preview canvas { width:240px; max-width:100%; image-rendering:pixelated }`)
and let the fixed-height resizable `.preview` box clip/scroll as today.

## Tile shuffling

In the per-card build loop, after cloning the template, collect the `.tile` nodes,
Fisher–Yates shuffle them, and re-append in shuffled order to `.tiles`. Each card
shuffles independently; a page refresh re-runs the build → re-shuffles. No persistence.

## Builder & asset changes

`tools/build_base64_assets.py` produces all blobs and a `flags` map. Additions:
- `c`/existing entries unchanged in spirit; keep `a`, `b`, `c`, `d`.
- New: `e_hex` (Sixteen), `f_url` (Percent Sign), `g_b64` (Three Deep, `base64(rot47(hex(flag)))`),
  `two_faces` (+ troll preview file), `i_b64` (red-herring final).
- Python re-implementations of `rot47`, `url`, `atbash`, `hex`, `base64` filters for
  round-trip asserts. Every puzzle's correct pipeline is asserted to reproduce its flag
  before `assets.js` is written.

## index.html changes

- Add `rot47`, `url`, `atbash` to `METHODS` (JS), matching Python exactly.
- Add the three new tiles to the template.
- Add tile shuffle in the build loop.
- Fixed-size preview CSS/JS.
- Extend `PUZZLES` array to the 9-puzzle roster with correct `view`/`sting`/`cyber` flags.
- Two Faces: default `view:'image'`; hint copy explains "same blob, two methods, two pictures."

## Solve-process document

New file `docs/superpowers/module2-solve-paths.md` (authoring guide, not student-facing):
per puzzle — the blob, the correct pipeline, the visual tells, the intended difficulty,
and **where red herrings can be injected into the encoded string** (e.g. decoy substrings,
misleading layer tells). This is the reference for tuning #9 and salting future puzzles.

## Verification

- Builder asserts every correct pipeline reproduces its flag; writes the troll preview PNG.
- Serve locally (`python3 -m http.server 8787`, open `/public/crypto/base64/?v=N`).
- **Verify each puzzle with real pointer clicks** (Chrome MCP / Playwright) per CLAUDE.md —
  build the pipeline, confirm preview + SUBMIT for all 9, confirm tiles shuffle on reload,
  confirm Two Faces shows flag under `hex` and troll under `base64`.

## Out of scope

- No changes to Module 1 (Caesar) or other modules.
- No live/runtime polyglot generation — all assets precomputed by the builder.
- No backend; module stays a single static HTML file + generated `assets.js`.
