# Caesar Module — Multi-Knob Extensions + Bonus Unlocks (design)

**Date:** 2026-06-25
**Module:** `public/crypto/ceasar/index.html`

## Goal
Extend the Caesar module (single-shift dial × 4 puzzles) with harder, multi-knob ciphers
that are honest generalizations of Caesar, plus a bonus-flag → meme-URL reward system, to
keep 14–18 year olds engaged. Decisions already made with the user:
- Add **one Alternating-Vigenère** and **one Affine** 2-knob puzzle.
- Add a **3-knob Vigenère** capstone.
- Wire a **bonus-flag unlock** system with **placeholder** meme links (user swaps real URLs later).

## New cipher types

The page currently wires every `[data-puzzle]` with one dial; `render()` shows
`rot(cipher, shift)` and locks when `shift === key`. We generalise to **N knobs** and a
per-type decode function. Each puzzle declares its type and the winning knob values.

### V — Alternating Vigenère (2 knobs) · "Two Tones"
- Two shifts: knob A decodes letters at even letter-positions, knob B the odd ones.
- Decode: walk the ciphertext; for each **alphabetic** letter, apply `rot(c, shiftA|B)`
  by the parity of its letter-index; non-letters pass through. Lock when both match.
- Teaches: one shift isn't enough — a repeating key (length 2) is the polyalphabetic leap.

### VI — Affine (2 knobs) · "Multiply & Slide"
- Encode is `(a·x + b) mod 26`. Knob A picks the multiplier `a` from the 12 values
  coprime with 26 `{1,3,5,7,9,11,15,17,19,21,23,25}` (the dial snaps only to those —
  invalid `a` has no inverse, which is the lesson). Knob B is the shift `b` (0–25).
- Decode: `x = a⁻¹·(y − b) mod 26` (modular inverse precomputed). Lock when `a,b` match.
- Teaches: modular multiplication, and why some multipliers are illegal (no inverse).

### VII — Vigenère, key length 3 (3 knobs) · "Three Wheel"
- Three shifts repeating every 3 letters (a real keyword cipher with keyword length 3).
- Decode: i-th alphabetic letter uses `shift[i mod 3]`. Lock when all three match.
- Capstone: hardest, three dials, sets up "real" Vigenève keyword crypto.

## UI approach
- The deck currently has one `.gauge` (dial) + one `.entry` (number input). Generalise the
  per-puzzle init to build **K dials**, each a labelled shift dial (0–25), driven by the
  existing `buildKnob` SVG component — reused K times. Affine's multiplier dial is the same
  dial but snaps to the coprime set and shows the `a` value.
- Knob labels: Vigenère "A/B/C" (or "odd/even"), Affine "× (multiply)" and "+ (shift)".
- `render()` reads all K knob values, runs the type's decode into the readout, and locks
  when the value vector equals the key vector. Keep the lamp / `solved` / confetti hook
  (`window.fxVictory`) firing once on first full lock (reuse the `solvedOnce` guard).
- Slide-rule: keep for the shift dials it makes sense for; for Affine, the slide-rule
  alphabet alignment only reflects the shift part (or is hidden for that puzzle) — decided
  during build, kept simple.
- Decode helpers live in one place; each puzzle declares `type` + `keys[]` via data-attrs
  (e.g. `data-type="vig2" data-keys="3,16"`), so adding puzzles stays declarative.

## Bonus-flag → meme unlock
- A small **UNLOCK** panel near the footer: a text input + reveal area.
- A registry maps bonus codes → URLs, e.g. `{ "flag{...bonus...}": "https://…" }` with
  **placeholder** safe links for now (a known meme / rickroll). Entering a matching code
  reveals a clickable link (opens in a new tab) and a captured-style stamp.
- Where bonus codes come from: one or two puzzles reveal a **bonus flag** on solve (shown
  in a "bonus" line in the captured stamp). Students enter that flag in the UNLOCK box to
  get the reward. Codes are client-side (greppable) — fine for an easter egg, not a secret.
- Persist unlocked rewards in `localStorage` so they stay revealed on reload.

## Difficulty ramp (final roster)
I (ROT 5) · II (ROT 16) · III (ROT 13) · IV (ROT, dial) · **V Vig-2** · **VI Affine** ·
**VII Vig-3 capstone** · bonus unlocks throughout.

## Out of scope / later
- The trophy-wall / rarity tiers (already in `docs/ideas-backlog.md`).
- Real meme URLs (user supplies later; placeholders for now).
- No backend; codes and unlocks are client-side.

## Verification
- Build each new puzzle; solve each with real dial interaction (Chrome MCP), confirm the
  readout resolves to `flag{…}`, the lamp/solved state and confetti fire once.
- Confirm the bonus UNLOCK reveals the placeholder link and persists across reload.
