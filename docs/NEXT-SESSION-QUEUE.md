# Next session queue — written 2026-08-15 ~00:10, end of a long session

Ordered by value. Everything here is specified enough to dispatch without re-deriving it.
Context: `STATUS.md`, `CLAUDE.md`, `.superpowers/sdd/AGENT-WORKING-AGREEMENT.md` (standing rules
for every agent dispatch), `docs/research/ctf-category-coverage.md` (what the real CTF contains).

---

## 0. IMMEDIATE — affine y-scale should not be on by default
**Small, do it first.** In `public/crypto/ceasar/index.html`'s `buildNumberLine()`:

> "affine should still bottom out by default like it did before, the scaling behaviour should be a
> toggle where that y1.8x button is right now."

So: default view returns to the previous bottomed-out layout (output line at the bottom of the
frame, no void above it). The y-scaling becomes a **toggle** occupying the slot where the `y 1.8×`
button currently sits — off by default, on when you want to see the whole graph compressed.

Not done in-session only because another agent held that file at the time.

### 0b. Input row needs its own number line
> "there should be an identical (but recoloured) number line for the blue dots (above them) in
> affine."

The **output** row has a full 0–25 number line — axis, a tick and label per integer, hollow shadow
sockets showing the holes. The **input** row (the blue dots at `Y_ORIG`) has none: it is a bare
axis with 26 dots and no labels, so a student cannot read *which* input a thread came from.

Give the input row the same number line, recoloured to the input blue (`--nl-in`) — same axis,
same per-integer ticks and labels, positioned **above** the blue dots so it doesn't collide with
the threads dropping from them. It should read as the same object as the output line, which is
exactly the lesson: the same 26 slots go in as come out, and the map either fills them all or
doesn't. No shadow sockets on the input row — every input is always present; the holes are an
output-only phenomenon and drawing empty sockets up there would imply otherwise.

Do this in the same pass as item 0 (both are `buildNumberLine()` layout work).

### 0c. Submit buttons are systematically too short — diagnosed, one-pass fix
> "submit buttons are systematically too short btw"

**Cause found: every submit button has `padding: 0 18px` — zero vertical padding.** Their height
comes only from line-height, while the input sitting beside them has real vertical padding
(`11px 13px` and similar), so the button is visibly shorter than its own field on every page.

Same defect, four places:
- `public/crypto/encoding/index.html:139` — `.submit .check{… padding:0 18px}`
- `public/crypto/xor/index.html:225` — `.submit .check{… padding:0 18px}`
- `public/crypto/ceasar/index.html:361` — `.ubar button{… padding:0 18px}`
- `public/crypto/fnac/index.html` — `.flag-check`, inline `padding:0 16px`

Fix in one pass so they stay consistent: give real vertical padding (or `align-self:stretch` /
`min-height` matched to the adjacent input) so each button is exactly as tall as the field it sits
next to. Also take them to a **≥44px** touch target while you are there — the copy buttons on the
encoding page were bumped to 44×44 earlier for the same reason, so match that. Both themes, and
check at 360px that nothing wraps.

---

## 1. Rainbow-table challenge set for the hashing module
The author's design, near-verbatim — build to this, it is unusually complete.

**Why it matters:** `docs/research/ctf-category-coverage.md` scores hashing as *partial* — the
module teaches how MD5 and SHA-3 work internally but has **no hash identification or cracking**,
which is the inverse of what a CTF actually asks for. This closes that.

### Structure — 3 challenges, 3×3 option space
- A **table selector** and a **salt selector**, both dropdowns, sitting at the top of the rainbow
  table widget next to each other. Three tables × three salts = nine combinations.
- **Challenge 1** — solvable with the first table, no salt. Teaches the mechanic.
- **Challenge 2** — needs a *different* table (the third one). Teaches that a rainbow table only
  covers the passwords someone bothered to precompute.
- **Challenge 3** — needs a **salt** selected. Teaches what salting defeats and why it exists.

### The visual — this is the point of the thing
- The table **scrolls in its own window**, hashes flying past, until it finds the match.
- On a hit, the matching row is **brought up** alongside its plaintext (the flag).
- The row "magnetises" into place: it **overshoots slightly and draws back in**, with simple
  spring-like easing. Not a physics engine — an *analogue* of springiness. A critically-damped or
  lightly-underdamped ease is the right shape.
- Cells **flash as each option is tried**.
- Make it literally rainbow: **border colour cycling, or a colour change every ~5 rows**. The name
  should be doing visual work.

### Watch out
- ⚠️ **Photosensitivity.** Flashing cells at speed on the hash page is exactly what
  `verify_flash_safety.mjs` exists to police, and **that script currently FAILS on this branch**
  (see item 2). Design the flash pace deliberately — small cells rather than large areas, and
  measure it, don't assume.
- Reuse the module's real hash implementations; do not add a fake hash.
- The scroll-and-find animation must not become a fixed-length wait — a student who picked the
  wrong table should learn that fast.

---

## 2. ⚠️ The photosensitivity governor is FAILING on the hash page
Pre-existing, found by the test-speed audit, **not caused by any of this session's work**:

```
slider 78, 4 rate-blocks … biggest excursion was 0.0886   (limiter bound: 0.07)
```

Rate and red-flash bounds pass; it is the **luminance excursion** bound that is breached.
`CLAUDE.md` marks this as safety-critical and not to be weakened. **Fix the animation, not the
bound.** This module gets projected to a room of teenagers. Do this before the event.

The motion-blur work has since landed (`d91ff23`) and its **after** numbers were never measured —
the agent died on a session limit before that run, and the author chose to skip it rather than
spend four minutes. So the current state is: baseline breach 0.0778-0.0886 vs a 0.07 bound,
blur delta **unknown**. The blur's own report argues it should *lower* peak excursion (it removes
three single-frame luminance steps that were accumulation-wipe artefacts, and `plateau = w/(w+d)`
conserves energy — same light over more pixels at lower peak alpha), but that is an argument, not
a measurement. Run `verify_flash_safety.mjs` once before the event and fix the animation if it
still breaches.

---

## 3. RSA — the biggest content gap
`rsa101` sits in the **intro/easy** score tier of the 2025 event, alongside topics already taught,
and RSA appears **twice** that year. The challenge authors price it as entry-level; students will
walk into it expecting to solve it. There is currently **zero** RSA anywhere in the repo.

A research pass on how to visualise it was dispatched at the end of this session —
check for `docs/research/rsa-teaching-approach.md` before designing anything.

**The framing that should drive it** (author's own words, and they're right):
> "im trying to instill more 'search for a riddle and a weird looking pattern' than 'know about key
> exchanges and real crypto'."

For a CTF, the RSA skill is **not** understanding RSA. It is: recognising that you have been handed
`n`, `e`, `c`; noticing the *weakness* (n small enough to factor, e=3 with no padding, shared
primes across two keys, n reused); and knowing a tool exists. Teach the recognition and the tool
(`RsaCtfTool`, FactorDB, `openssl`), and teach only as much maths as makes the weakness legible.

## 4. Symbol-legend lookup ciphers — best effort-to-payoff on the list
**Four of nine** 2025 challenges were symbol-legend lookups: hieroglyph, Cistercian, music
notation, Bacon. Nothing in the repo covers them. The skill is exactly the author's stated goal —
"you've been handed a legend, now do careful lookup" — and it needs no new crypto machinery, just
a legend and a patient UI. Cheap to build, biggest single cluster in the most recent year.

## 5. XOR challenge C4 — still unbuilt, and now load-bearing
Spec: `docs/2026-06-26-module4-xor-spec.md` (v2, content already node-verified).
**It is now blocking**: the new FNAC gate requires Caesar + XOR + Encoding to be *completed*, so
if XOR cannot be finished, FNAC is unreachable except by Konami. Check the gate agent's report
(`.superpowers/sdd/caesar-fnac/task-gate-and-audio-report.md`) — it was told to verify this and
lead with it.

## 6. Remaining coverage gaps (from `docs/research/ctf-category-coverage.md`)
EXIF-first workflow · bespoke-spec implementation · book cipher · endianness swap ·
Vigenère autokey variant · hash identification (partly closed by item 1).

## 7. Caesar copy rulings still awaiting the author
From `.superpowers/sdd/caesar-fnac/task-copy-audit-report.md` — all deliberately *not* applied:
- **U1** the "searched for the rest of time" opening vs. brute-forcing a 26-key cipher a minute later
- **U4** "invariants" as unglossed jargon in the first thing a novice reads
- **I1** whether to say outright that ROT13/ROT47/Atbash aren't really encodings
- U3's leftover: the clock metaphor says "keeps going from 0" and a real clock face has no 0
- Nitpicks: yellow vs amber wording · riddle phrasing · directory page module ordering
- **Approved but not yet applied:** remove `.nl-rowlbl` ("OUTPUT (A·X+B) MOD 26"), which duplicates
  `.nl-formula` directly above it in the same box.

## 8. Housekeeping
- **`worst-case/launch_offline.py` is stale** — Tier-1 offline fallback for the day, embeds copies
  of the module pages, and all of them changed. Rebuild:
  `.venv/bin/python tools/build_offline_launcher.py`. Its FNAC size exclusion (~7 MB rationale) no
  longer holds — FNAC is ~92 KB now.
- **FNAC docs are stale again** — `STATUS.md`'s FNAC section describes the pre-rework nights.
- `fnac-assets/cats/` — ten source JPGs, unreferenced since the 10,000 Cats night was retired.
  Author's call to delete.
- Caesar's `REWARDS` map still points at placeholder rickrolls.
- `verify_task4`'s π-persistence check is weaker than it reads — searches for *any* satisfying
  sample pair, so a revert-to-canonical after every π would pass it.
- Deployed: `ctf.sandhi.com.au`, version `d1c2c1c0` = commit `e3795f6`. The hash page in production
  predates the motion-blur work.

## 9. Extension ideas — parked, assessed in `docs/ideas-backlog.md`
Torus first (Z/26 × Z/26 already *is* challenge V's object; shows keyspace multiplying not adding).
Complex plane second (it's secretly the Hill cipher — a real bridge to block ciphers). The 1–100
dial needs a bigger alphabet or it silently repeats every 26. The spiral is dropped: it implies a
gradient, which is the exact false metaphor `CLAUDE.md` forbids.

---

## 1b. XOR — a long-crib challenge with a 2D crib window (author, 2026-08-15)
> "we should have a really long crib xor, so we should have another challenge... might even want
> one that lets you move the crib window up and down a line as well as left and right. maybe two
> stacked sliders? a big block of xor'd text."

A **large block** of repeating-key XOR ciphertext, rendered as a grid of lines, with a crib window
the student drags over it in **two dimensions**:
- **Horizontal slider** — the crib's offset within a line (the classic crib-drag, already taught by
  C2/C3).
- **Vertical slider** — which line the crib sits on.

Two stacked sliders is the author's suggested control; a draggable window over the block may read
better on a phone — decide on merit and say why.

**What the second axis actually teaches** (this is the reason it's worth building, and it should be
what the challenge is designed around): with a repeating key and a block laid out at the *right
line width*, the key aligns vertically — the same key byte lands in the same column on every line.
So sliding the crib **down** a line and finding it still fits is how a student *discovers* the key
length, rather than being told it. Choose the line width so this is true and discoverable, and make
the vertical alignment visible when they hit it.

Sequencing note: this is a **fifth** XOR challenge. **C4 is still unbuilt** (item 5) and the FNAC
gate now depends on XOR being completable, so build C4 first — or renumber deliberately.
