# Five Nights at Crypto's — Design Spec

_Module 2.5 sequel page. Unlocks after Encoding (`/crypto/encoding`) is fully solved. Companion to
`STATUS.md` and `CLAUDE.md`. Written 2026-08-11._

## Overview

A themed continuation of the Encoding module: same underlying skills (decode pipelines, base64/hex,
now extended with binary/ASCII), but reframed as a haunted-house-styled bonus track with escalating
stages — **Night 1, Night 2, Night 3, Night 4, Night 5, Nightmare, Abyss** (7 total). Built to close
the "shape gap" identified by research into real past PeCan CTF challenges: file-delivered puzzles,
in-character flavour text, metadata as a real clue surface, and multi-file/multi-stage structure —
rather than single garbled strings in a text box.

**This spec covers Night 1–3 and the page shell in full. Night 4, Night 5, Nightmare, and Abyss are
placeholders** — visible as locked-looking stage cards with a "coming soon" treatment, no puzzle
content yet. They get their own design pass once content is decided.

## Access & progression

- **Module gate**: solving all 9 Encoding puzzles sets a second cookie flag (`ctf-fnac-unlocked=1`,
  alongside existing `ctf-uid`). The Encoding completion screen adds a link to `/crypto/fnac/`.
  Visiting without the flag shows a locked stub page, not content. (The flag being readable in
  devtools is an intentional easter egg for kids who look — noted, not a bug.)
- **All 7 stages are visible and attemptable from the start** — no sequential unlock. This is a
  deliberate departure from Encoding's puzzle ramp; it lets a group of students split up across
  nights instead of bottlenecking on one.
- **Flag submission**: one input box per night. Where a night's answer is composed of multiple
  pieces (Night 1), the box expects the pieces **assembled in the correct order** as a single
  string — order is part of the puzzle, not given.
- Own solved-state store (`ctf-solved:v2:fnac`), own confetti wiring (`FX_MODULE='fnac'`,
  `FX_TOTAL=7`, `fxSolved(id)` per stage) — same pattern as existing modules, so completion-tick,
  persistence, and the module-completion confetti "ate all 7" reward all just work by reusing the
  shared engine.

## Aesthetic shell

Deliberate skin departure from flat `warm-editorial-ui` — CLAUDE.md explicitly allows this when a
skin "genuinely fits the content," and a haunted-house bonus track for 2010-born teens is that case.

- Black page background, oxblood/amber accents survive as the only warm color notes in the dark.
- Each stage card gets a small **fixed random rotation** (a couple degrees, seeded off the card's
  own id so it's stable across reloads, not jittering/animating) — "slightly off" rather than glitchy.
- At least one panel on the page is **literally unstyled raw HTML** (browser default serif font,
  default blue links, no CSS at all) sitting inside the dark page like a corrupted fragment that
  didn't get the memo it's 2026.
- At least one puzzle lives inside a **Win95-chrome styled window** (title bar, inset borders,
  system font) — earmarked as the natural home for an in-world "found document" cipher spec in a
  later night (Nightmare/Abyss), per the real-corpus finding that formally-documented custom ciphers
  (the ASD Subecsert Cryptosystem) are a legitimate, well-regarded pattern, not something to avoid.
- Every stage — including trivial ones — opens with 2-4 sentences of in-character flavour text that
  also seeds the mechanic, matching the real-corpus finding that bare "decode this" framing is rare
  even in the easiest real PeCan challenges.

## Shared tooling (the architectural core)

Nights 1-3 all reduce to the same shape: *download a file, run it through a forensic tool, read what
falls out.* Rather than three bespoke puzzle UIs, this module ships **three small reusable tools**,
each standing in for a real tool a student would reach for on Kali — named as such in the UI, to
serve CLAUDE.md's tool-awareness goal directly:

1. **Raw Bytes Viewer** (stands in for `xxd`/hex editors) — drop a file in, see a hex dump with a
   toggleable ASCII column. Built by extending Module 2's existing hex/pipeline machinery with a
   file-drop input alongside its current clipboard-text input; the hex/ASCII tile logic is reused,
   not rebuilt.
2. **Metadata Viewer** (stands in for `exiftool`) — drop a file in, see its EXIF/PNG text-chunk
   fields laid out as a table.
3. **Bit-Plane / LSB Viewer** (stands in for `zsteg`/StegSolve) — drop an image in, toggle individual
   bit-planes or colour channels to reveal a hidden layer.

All three are framed in the UI as "here's what you'd run on Kali" call-outs, so the module teaches
tool names alongside mechanics.

## Night 1 — "Static"

**Flavour**: in-character cold-open framing TBD by content pass, but mechanically: the player is
told a signal is buried in noise.

**Mechanism**: two downloadable PNGs, each rendering as genuine visual white-noise static (real
random pixel data, not a placeholder image). Binary/ASCII join the existing encode/decode tile set
(direct continuation of Encoding's pipeline, per instruction) so the pipeline-builder UI itself
doesn't change shape, just gains tile types.

- Each PNG has a short run of flag-bearing bytes appended after its `IEND` chunk, padded on both
  sides with more random bytes so the flag bytes aren't simply "the whole tail" — the player has to
  scan the ASCII column of the Raw Bytes Viewer to spot the readable run inside the noise (mirrors
  the C1 "scan visually, don't just sort" lesson already established in the XOR module).
  Browsers/image viewers ignore trailing bytes after `IEND`, so the PNG still renders normally as
  static — the trick is invisible unless you go looking at the raw file.
- File A's trailing bytes decode to flag-part-A, File B's to flag-part-B. The two parts must be
  concatenated **in the right order** (which file is "first" isn't stated outright — a small
  in-fiction cue, e.g. filenames or flavour text, settles it) to form the submitted flag.

## Night 2 — "It's In The Metadata"

**Flavour**: same static-PNG surface as Night 1, presented as more of the same — the twist is the
technique, not the dressing.

**Mechanism**: four downloadable PNGs, visually near-identical to Night 1's (different random noise
seed each, so byte-diffing against Night 1's files doesn't shortcut anything). This time the Raw
Bytes Viewer is the decoy: every file's trailing-byte trick still exists, but decodes to `trolololo`
garbage instead of a real flag — a direct callback mocking Night 1's technique, telling the player
"not here anymore." The real payload lives in each file's **metadata** (PNG text chunk / EXIF comment
field), one taunt-word per file, found via the Metadata Viewer: **"It's" / "In The" / "Meta" /
"Data"**. The fourth file's metadata also carries the actual flag once the player has taken the hint
and is reading metadata instead of bytes.

_Flagged assumption for review: I've put the real flag in file 4's metadata rather than splitting it
across all four fields — simpler to build and matches "single input box" for this night. If you
intended the flag itself split across the four metadata fields (mirroring Night 1's two-part
structure), say so and I'll change it before implementation._

## Night 3 — "10,000 Cats"

**Flavour**: a found photo, ordinary-looking, sourced from "one of those cat filler sites."

**Mechanism**: a real photograph (not synthetic test imagery) of a cat, sourced from a
placeholder/filler image site, carrying a genuine LSB-steganography payload extracted via the
Bit-Plane Viewer. **Ten variants are precomputed offline** (Python + Pillow, following the existing
`tools/build_base64_assets.py` pattern — a new `tools/build_fnac_assets.py`), each embedding the
same flag via a different real source photo. Each student is deterministically assigned one variant
via `ctf-uid` hashed mod 10, so everyone's file differs but the mechanic and difficulty are identical.
Source photos are supplied by you into a drop folder (same convention as `confetti/` for
`tools/build_confetti.py`) since they need to be real, not generated.

## Night 4 / Night 5 / Nightmare / Abyss — placeholders

Stage cards exist in the shell (locked/greyed "coming soon" look, matching the rotated-card
aesthetic so they don't look broken, just not-yet-open), wired into the same progression/confetti
system, but carry no puzzle content yet. `FX_TOTAL=7` is set now so the completion confetti condition
is correct once all seven are real; until then the module simply can't be "fully" completed, which
is fine — it's not deployed yet either.

## Asset generation pipeline

New script `tools/build_fnac_assets.py` (Pillow + a small PNG-chunk helper), run via
`.venv/bin/python`, producing:
- Night 1: 2 static PNGs with trailing flag-byte payloads.
- Night 2: 4 static PNGs (new noise seed) with metadata payloads.
- Night 3: 10 LSB-steganographed cat photo variants from supplied source images.

Mirrors the existing convention: script is the source of truth, output assets are committed generated
artifacts (like `public/crypto/encoding/assets.js`), never hand-edited.

## Error handling / edge cases
- Raw Bytes / Metadata / Bit-Plane viewers must never throw on a malformed/unexpected file drop —
  same "decoders never throw" rule as Module 2's pipeline tiles; show "couldn't read that" instead
  of a JS error.
- Flag input is case/whitespace-trimmed but otherwise exact-match, consistent with other modules.
- Locked-stage stub (module gate) and placeholder night cards must both render without JS errors even
  though they have no real interactive content yet.

## Testing / verification
- Each generated asset (2 + 4 + 10 files) gets a node/python round-trip check before UI wiring —
  "node-verify every attack before wiring UI," per existing project convention from the XOR module.
- UI verified with real pointer clicks (Chrome MCP), not synthetic events, per CLAUDE.md.
- Per-user Night 3 assignment spot-checked across a few different `ctf-uid` values to confirm the
  mod-10 distribution actually varies.

## Explicitly out of scope for this spec
- Hashing toy page and the XOR module rewrite — separate spec cycles, not covered here.
- Night 4/5/Nightmare/Abyss puzzle content — pending your write-up.
- Deployment — not deployed until user go, matching existing project convention for in-progress modules.
