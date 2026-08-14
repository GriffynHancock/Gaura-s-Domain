# Next session queue — written 2026-08-15, reconciled against the code at the end of that session

Ordered by value. Everything here is specified enough to dispatch without re-deriving it.
Context: `STATUS.md`, `CLAUDE.md`, `.superpowers/sdd/AGENT-WORKING-AGREEMENT.md` (standing rules
for every agent dispatch), `docs/research/ctf-category-coverage.md` (what the real CTF contains).

**The one thing to read first:** XOR's C4 is unbuilt while `public/crypto/xor/index.html` declares
`FX_TOTAL = 4` against three cards, so XOR can never register complete — and FNAC's new gate needs
Caesar + XOR + Encoding complete. **FNAC is therefore konami-only right now**, and a student who
finishes everything buildable sees `XOR 3/4` on the locked screen forever. Item 5 fixes both.

---

## 0 / 0b / 0c — ALL DONE, landed in `6a56018`. Nothing to do here.

- **0. Affine y-scale off by default.** The pill is now a real toggle (`y auto` ⇄ `y N×`), and
  auto is the default: `Hu = HU_FIT(lapCount)`, so the frame hugs the picture with a constant gap
  below the last lap at every multiplier and no void. The old 160/240/400 preset cycle is gone.
- **0b. Input row's own number line.** Landed with it: the input row gets the same axis, per-integer
  ticks and labels as the output row, recoloured to `--nl-in` and drawn **upwards** (above the dots)
  so it never collides with the threads. No shadow sockets, deliberately — every input is always
  present, and empty sockets up there would imply the holes happen on both sides. `Y_ORIG` moved
  14 → 17 to leave room.
- **0c. Submit-button heights.** ⚠️ **The diagnosis in this file was half wrong** — worth knowing if
  a similar bug turns up. `padding: 0 18px` was *not* the cause; `align-items: center` on `.submit`
  was, and only on `encoding` and `xor`. Ceasar was already correct at 45/45. Fixed by deleting the
  `align-items` rather than padding around it, plus a `min-height: 44px` wrap-floor on all four.

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

**Status is better than it looks — read this before re-tuning anything.** The motion-blur work has
since landed (`d91ff23`), and while the full `verify_flash_safety.mjs` after-run never completed
(the agent hit a session limit; the "Flash-safety measured numbers" section of
`.superpowers/sdd/caesar-fnac/task-motion-blur-report.md` is empty), that work **did** measure this
exact failing case with a targeted probe, and the numbers are recorded in the page at the wipe:

- pre-change page, slider 78, the 3×3 unit the suite asserts: **0.0778–0.0886** (bound 0.07) — FAIL
- shipped build (fixed `SHA3_WIPE_ALPHA` + swept smear), same case: **0.046–0.049** — comfortably PASS

The reason is `SHA3_WIPE_ALPHA`: a constant wipe has no deep-trail-to-opaque seam to step across.
Note also that an intermediate configuration (opaque wipe + swept smear) measured **0–19
flashes/sec against a bound of 3** — the fixed translucent wipe is a photosensitivity control that
was reinstated *on measurement*, not a look. Do not delete it as vestigial.

**So the action is verification, not repair.** Run `node tools/run_suite.mjs --all` once (~6.5 min)
before the event. If it passes, close this item. If it still breaches, fix the animation, never the
bound. Do not start re-tuning on the strength of the old failing number.

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
  `.venv/bin/python tools/build_offline_launcher.py`. Its FNAC size exclusion was sized against a
  ~7 MB rationale that no longer holds: FNAC is now ~468 KB (bigger than the ~92 KB some notes
  quote, because of the intro-creep audio, but still nowhere near the exclusion's premise).
- Caesar's `REWARDS` map still points at placeholder rickrolls — `flag{affine_ace}` opens a rickroll.
- Caesar's static `.plate` ciphertexts for IV and VI still encode the retired `flag{Safe_Cracker}` /
  `flag{affine_code}` plaintexts. Overwritten at mount, so harmless at runtime, wrong in view-source.
- `fnac-assets/cats/` — ten source JPGs, unreferenced since the cat-photo night was retired.
  Author's call to delete.
- `verify_task4`'s π-persistence check is weaker than it reads — searches for *any* satisfying
  sample pair, so a revert-to-canonical after every π would pass it.
- **Which version is deployed is unresolved.** Two figures have been reported for what is live on
  `ctf.sandhi.com.au` — `0ecbf196` and `d1c2c1c0` (= commit `e3795f6`). The Cloudflare MCP is
  read-only and errored when asked; check the dashboard. Either way the live hash page predates the
  motion-blur work, and this branch (`feat/caesar-rewrite-fnac-nights`) is pushed but **not merged
  to master**.
- ~~FNAC docs stale~~ — `STATUS.md`'s FNAC section, `CLAUDE.md`, `README.md` and the `worst-case/`
  mirrors were all brought in line at the end of the 2026-08-15 session.

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
