# Crypto 101 CTF-prep — Curriculum Design

**Date:** 2026-06-24
**Status:** Umbrella spec. Each module gets its own spec + implementation plan when built.

> ⚠️ **User has reviewed only through Part 2 (Encoding/Base64).** Parts 3 (Hashing), 5 (Live demo) and Parked
> are provisional. **Module 1 & 2 are BUILT and live.** **Module 4 (XOR) is CONFIRMED** by the coordinator
> (build it by *providing* a key — see Part 4). Boss/advanced flags added later, also provisional.
> See `STATUS.md` for current build state and the "next up" decision (user's call).

## Context
Interactive teaching modules to give Victorian TAFE teenagers a working intro to cryptography
**before a national CTF**. Hosted at `ctf.sandhi.com.au/crypto/*`. Module 1 (ROT/Caesar) is live.

- **Audience:** assume zero. They don't know what a flag is, a CTF is, or cryptography is. Phone/web-app
  native — do **not** assume familiarity with files, terminals, radios.
- **Delivery:** **presenter-led**. ~**60 minutes**, single session. The site is a **projected visual aid**
  the presenter drives. Modules are lean on inline text, heavy on the tactile "aha".
- **Teaching philosophy:** tactile elements must *teach the underlying machinery*, not just be novel
  (a dial teaches the mod-26 ring because you turn through the alphabet). Drop any metaphor that implies
  something false.

## Success criteria
By the end, a student can:
- See base64/hex/etc. and think *"that's something encoded."*
- Hold the shapes apart: **encoding** (reversible, no key) vs **hashing** (one-way) vs **encryption** (key).
- Run the spine on a real challenge: **recognise → identify → decode/crack → submit.**
- Have the instinct to reach for tools (CyberChef, `hash-identifier`, `john`, an LLM) on the Kali school VMs.
- Carry a geometric/visual intuition for why each thing works.

## The spine (the one transferable idea)
> **recognise → identify → decode/crack → submit**
Most entry-level CTF "crypto" is really *encoding recognition*; identifying what something is matters more
than math. Every module reinforces this loop.

## Session arc (~60 min)
| # | Segment | Who | ~min |
|---|---------|-----|------|
| 0 | **Intro** — what a CTF is, `flag{...}`, the spine | presenter | 3 |
| 1 | **ROT / Caesar** (built) — key + alphabet ring | site | 8 |
| 2 | **Encoding / Base64** (build) — encoding ≠ encryption; bytes-as-image-or-text | site | 14 |
| 3 | **Hashing** (build) — one-way + avalanche + crack a weak hash | site | 12 |
| 4 | **XOR** (build) — bits as switches; msg ⊕ key | site | 12 |
| 5 | **Live demo** — CyberChef Magic + archive password crack | presenter on Kali | 9 |
| — | wrap / "now you do it" | presenter | 2 |

## Module briefs

### 1 · ROT / Caesar — BUILT & EXTENDED
Live at `/crypto/ceasar`. Now **6 puzzles**: 4 Caesar (single dial) + **Two Tones** (alternating Vigenère, 2 dials)
+ **Multiply & Slide** (Affine `a·x+b`, with a number-line stretch→wrap visual, cryptic riddle, Guardrail toggle).
**Per-user randomized keys** (cookie-seeded; flag re-encoded in-browser → everyone dials different numbers).
Bonus-flag → reward-URL unlocks. Shared victory-confetti (module-completion reward, replay + reset). See
`STATUS.md` and `docs/superpowers/specs/2026-06-25-caesar-extensions-design.md` for the full extended build.

### 2 · Encoding / Base64 — BUILT & LIVE (`/crypto/base64`)
**Goal:** the "that's encoded" instinct; encoding ≠ encryption; bytes are just bytes you can *view* different ways;
different encodings have tells (charset, base64's trailing `=`).
**Core mechanic (as built):** a **preview that toggles IMAGE ⇄ TEXT** (resizable), plus a click-to-build decode
pipeline of method tiles (**Base64 / Hex / ROT13**; empty pipeline = raw). **Decoders never throw** — a wrong
method yields *nonsense*, never an error: TEXT shows gibberish, IMAGE always paints the bytes as RGB pixels
(coherent only when the bytes really are the picture, **scrambled pixels** otherwise). Flag capture = type +
SUBMIT (no auto-grab button — removed per user). **Images tiny (≤32×32)** so TEXT stays short, except 2b (legible).
**Flags (progression):**
- **2a — base64 → flag.** Decode a base64 string → `flag{…}` plaintext. The plain "oh, that's encoded" beat.
- **2b — image *is* the flag.** Decode → a small **black-and-white bitmap that literally reads `flag{wow!}`**
  in the IMAGE view. (Sized for legibility, e.g. ~96×13 pixel-font, still small.)
- **2c — steg in the raw.** base64 → a tiny **red imposter** sprite (IMAGE view); but the TEXT/raw view of those
  bytes contains a hidden `flag{…}` (flag string appended to the byte stream). On decode, play the Among-Us
  imposter sting **once** (see Sound). Teaches `strings`/stego visually.
- **2d — wrong-order tells.** base64 → hex → string. Show the **invariants**: base64 vs hex use different
  character sets, base64 usually ends with `=`. Doing the steps in the wrong order yields nonsense. Then
  **introduce CyberChef** doing it automatically (copy-paste encouraged).
**Concept to land:** **obfuscation** (layered, reversible, no key — raises analyst cost; real malware:
`base64(xor(gzip(payload)))`, PowerShell `-EncodedCommand`) vs **encryption** (key → secrecy). Every layer is
visible *on purpose*; layering ≠ secret. (XOR layering removed from this module per review.)
**Sound:** 2c plays the imposter sting once per page load (guard flag; no re-trigger / spam). The real
Among-Us audio is **copyrighted** — ship with a short WebAudio-synth "sting" placeholder + a drop-in slot for
`imposter.mp3` that the presenter can supply locally. Do not download copyrighted audio.
**Tech / precompute:** static HTML; all client-side. **Python (Pillow)** precomputes: the 2b flag-text bitmap,
the 2c imposter sprite + appended-flag byte stream; embed as base64 in the page. Hex/base64 done live in JS.

### 3 · Hashing — BUILD
**Goal:** one-way; avalanche; passwords get hashed; weak/unsalted/common = already cracked.
**Mechanic:** type into a box → live fingerprint (SHA-256 via `crypto.subtle`). Change one character → the
whole hash churns (**avalanche**). Then a "crack" panel: enter/derive a weak **MD5** of a common password →
instant reverse-lookup against an **embedded precomputed table** → reveals the plaintext.
**Flag:** crack a given weak hash to recover a password/word that forms the flag.
**Concept:** one-way means easy forward, infeasible back — *unless* the input is guessable/common (dictionary/
rainbow). Salting defeats the table.
**Tech / precompute:** SHA-256 native in-browser; inline a tiny MD5; Python precomputes top-N password→md5
lookup JSON (kept small). Zero server compute — cheapest module to run.

### 4 · XOR — BUILD
**Goal:** XOR as the atom of "real" crypto; symmetric (same key undoes it); bits as physical switches.
**Mechanic:** two short bit-rows — **message** bits and **key** bits — and an output bulb that lights only
when *exactly one* input is on. Animate cell-by-cell. Then flip the output bits back to text. **Dual view:**
`"H" ⊕ key` shown as letters *and* as switch-rows simultaneously. First demo = **one character**; keep strings
tiny. Show that applying the same key again returns the original.
**Flag:** XOR a given short ciphertext with the key to read `flag{…}`.
**Concept:** unicode/ASCII → binary → per-bit XOR → back to text; reversibility of symmetric XOR.
**Interaction decision:** switch/bulb rows (NOT Minecraft redstone — charming but idiosyncratic and heavier).
**CONFIRMED** (course coordinator: important). XOR needs a key (second input). Plan: a **given short key**
(repeating-key XOR) and/or **single-byte** brute (0–255). Show the key as its own bit-row; same key undoes it.
Build after Module 3, or next if user prioritises.

### 5 · Live demo (presenter, Kali) — NOT a web module
- **CyberChef "Magic"** auto-detects + peels a chained encoding (ties to module 2's layered flag).
- **Archive password crack** — password-protected `.zip` → `zip2john` → `john` (or `fcrackzip`). A realistic
  *harder* flag for beginners; ties back to module 3 (it's a hash crack). Doubles as their first real terminal.
- (Optional) `strings file | grep flag` if not already obvious from module 2.

## Tech conventions
- One static, dependency-free **HTML file per module** at `public/crypto/<name>/index.html`. All logic client-side.
- Visual system: invoke the **`warm-editorial-ui`** skill (flat, non-skeuomorphic variant for the new modules).
- Heavy assets (glitch sprites, md5 table) **precomputed in Python**, embedded in-page.
- Hosting: Cloudflare Worker (assets-only, custom domain). Deploy `npx wrangler deploy` (needs `wrangler login`).
- **Verify interactive UI with real pointer clicks** (Chrome MCP / Playwright), not synthetic events.

## Build order
1. ~~ROT~~ ✅ built · 2. ~~Encoding / Base64~~ ✅ built & live.
Remaining (order = user's call, see STATUS): **XOR** (recommended next — confirmed, feeds keystream boss flag),
**Hashing**, then optional **boss flags**. Each: own spec → implementation plan → build → verify (real clicks) → deploy.

## Advanced / "boss" flags — for the rare prodigy (provisional)
Course coordinator wants a few genuinely hard flags for students who already out-know the presenter, kept as
clearly-marked **bonus** challenges that do NOT derail the beginner arc (separate section / "boss" cards the
presenter skips unless an advanced kid surfaces). Candidates that are *real* and within reach of a very sharp 16yo:
- **RSA with a weak modulus** — the *correct* version of the coordinator's "factor a big number" idea. **Note:
  factoring breaks RSA, NOT AES** (AES is symmetric, not factoring-based — worth saying out loud; a prodigy will
  notice). Use an `n` that's factorable: two close primes (Fermat factorisation) or a small/`factordb`-known `n`.
  Tools: Python + `sympy`. Solver writes ~10 lines to recover `d` and decrypt.
- **Keystream / one-time-pad reuse** — two messages XOR'd with the *same* keystream; XOR the ciphertexts and
  crib-drag a known word to recover both. Elegant, real, and the natural escalation of the XOR module.
- **Insecure PRNG prediction** — predict a "random" value from a weak generator (LCG, or reproduce a seeded RNG).
  This is the parked insecure-randomness idea promoted to a boss flag.
- (Stretch) hash length-extension; padding oracle — likely too much for the hour.
**Rejected:** the "photonic CPU breaks post-quantum crypto in linear time" magnum opus — it's fictional hardware
and teaches a falsehood (PQC isn't broken by "linear time"); a precocious student would see through it. The real
PQC story (lattices, why quantum breaks RSA/ECC but not AES-256/lattices) is a great *talk*, not a solvable flag.

### cryptopals
License is ambiguous — site states only: "Individual exercise submissions are owned by their author, and may or
may not be distributed under an open source license." So: **don't copy their prose or data files**; borrow the
*topics* (attacks/algorithms aren't copyrightable), build challenges from scratch, and **credit cryptopals**.
TODO: pull one approachable topic per set (8 sets) and adapt. Good beginner-reachable themes: single/repeating-key
XOR (set 1), ECB detection & cut-and-paste (set 2), CBC bitflipping / padding oracle (sets 2–3), MT19937 / stream
PRNG (set 3), length-extension (set 4), weak-`n` RSA (set 5), RSA padding/parity (set 6).

## Parked (future hobby build-out)
Standalone stego module, trapdoor/one-way "search space" visual (must be FLAT — no followable slope),
insecure-randomness/predictable-RNG demo, XOR/stego practice challenges, recap/quiz.
