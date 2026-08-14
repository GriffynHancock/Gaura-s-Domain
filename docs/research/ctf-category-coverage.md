<!-- Research note, not shipped UI. -->
# PeCanCTF crypto category map + current coverage

Catalogued from primary sources only: `/Users/gaura/PCAN/2023/crypto/` (10 challenge directories,
read in full — `challenge.yml`, READMEs, artefacts, both solution scripts) and
`github.com/ECUComputingAndSecurity/PeCanCTF-2025-Public/tree/main/crypto` (cloned locally, 9
challenge directories, read in full). **19 challenges catalogued: 10 (2023), 9 (2025).**

No prior write-up of this analysis exists in this repo — searched `docs/`, `.superpowers/sdd/**`,
`.remember/` and `git log`; the only hit was `.superpowers/sdd/caesar-fnac/coverage-checklist.md`,
which is a UI-instruction tracker for a different task, not a category audit. The "3/19 full, 8/19
partial, 8/19 gap" figure mentioned in the brief could not be found or reconciled — this report's
bucket count and split are built fresh from the primary sources and land differently (11 buckets,
not 19; see split below).

## One-screen summary

| Category | 2023 | 2025 | Challenges (name · points-tier) | Tool a student reaches for | Status |
|---|:-:|:-:|---|---|:-:|
| Classical shift ciphers (Caesar/ROT + variants) | ✅ | ✅ | `unlucky-number`·easy, `climbing`·std, `wise-words`·std | CyberChef, manual, dcode | **Full** |
| Polyalphabetic (Vigenère + variants) | ✅ | — | `leeroy`·std, `spilled-secrets`·std | CyberChef/dcode Vigenère solver | **Partial** |
| Layered / chained encoding pipelines | ✅ | ✅ | `double-trouble`·std, `multi-layer-cake`·std, `the-perfect-breakfast`·std, `that-s-not-my-unicode`·std | CyberChef (stacked recipe) | **Full** |
| XOR (single-byte, repeating-key, crib-drag, key reuse) | ✅ | — | `double-trouble`·std | CyberChef XOR Brute Force, xor.pw, python | **Full** |
| Hash work (identify/crack a real hash; construct a collision) | ✅ | ✅ | `WhoAmI`·std, `#InMyLibraryClashingEra`·std | hash-identifier, crackstation/`john`, python | **Partial** |
| Non-Latin / symbol-legend lookup ciphers | — | ✅ | `mysteries-of-the-tomb`, `that-s-not-my-unicode`, `sheet-music-cipher`, `the-perfect-breakfast` — all std, **4 of 9** | manual legend lookup, reverse image search | **Gap** |
| RSA | — | ✅ | `rsa101`·easy, `incorrect-implementation-of-rsa`·std | factordb, RsaCtfTool, python `pow`/`long_to_bytes` | **Gap** |
| EXIF-first workflow | — | ✅ | `sheet-music-cipher`, `that-s-not-my-unicode` | `exiftool` | **Gap** |
| Bespoke-spec implementation ("read a novel algorithm, code it, verify against test vectors") | ✅ | ✅ | `subecsert-cryptosystem`·std, `spilled-secrets`·std, `#InMyLibraryClashingEra`·std | python, careful reading | **Gap** |
| Book cipher (singleton) | ✅ | — | `lesson-learnt`·std | boxentriq, manual | **Gap** |
| Endianness / byte-order swap (singleton) | ✅ | — | `put-an-endian-to-my-misery`·easy | CyberChef, manual | **Gap** |

**Split: 3 full, 2 partial, 6 gap** (11 buckets; `lesson-learnt-2`'s what3words geolocation is
catalogued but excluded from the count — see note below).

**Cross-year recurrence — teach these first:** classical shift ciphers, layered/chained encoding,
and hash work all show up in *both* years. Polyalphabetic Vigenère is 2023-only but is what the
Caesar module already builds toward, so it's listed alongside the full-coverage shift bucket. XOR
is 2023-only on paper but is the strongest *existing* module in this repo regardless.

**Top gap: RSA.** Zero coverage in this repo, appears twice in the most recent year (2025), and
one of the two (`rsa101`) sits in the *easy* tier (`extra.initial: 250` — see difficulty note
below) alongside `unlucky-number` and `put-an-endian-to-my-misery`, both of which are covered. That
makes RSA the one gap that is both *likely to recur* and *treated as entry-level knowledge* by the
challenge authors, not an advanced topic.

---

## Difficulty signal used

`challenge.yml`'s `value` is a *decaying* dynamic score (drops as more teams solve), so the number
at rest is noisy. `extra.initial` — the score's starting point before any decay — is the more
honest per-challenge difficulty tell. Across both years it takes only two values: **250** (three
challenges: `put-an-endian-to-my-misery`, `unlucky-number`, `rsa101`) and **500** (everything
else). Read as a two-tier system: 250 = intro-tier, 500 = standard. Nothing in either year's crypto
category was scored above 500 — there is no "hard" tier in this data.

---

## Part 1 — category map, in detail

### Classical shift ciphers (Caesar/ROT + variants) — both years — FULL
- `unlucky-number` (2023, easy): flag ROT13'd wholesale — `crpna{...}` → `pecan{...}`.
  `challenge.yml`: *"Someone's gone and encrypted the flag with a ROTten unlucky number."*
- `climbing` (2023, std): a positional additive keystream, `ciphertext[i] = ord(plaintext[i]) + i`
  — effectively a Caesar shift whose amount climbs by one each character.
  `solution_do_not_distribute.py` confirms the exact formula and its inverse.
- `wise-words` (2025, std): the historical "Augustus cipher" — right shift of 1 that does **not**
  wrap (`Z`→`AA`, `Fwfo`→`Even`). `README.md`: *"a right shift of one, and it did not wrap around
  to the beginning of the alphabet."*

Tool: CyberChef ROT13/Caesar Bruteforce, dcode.fr, or manual alphabet counting.

### Polyalphabetic (Vigenère + variants) — 2023 — PARTIAL
- `leeroy` (2023, std): textbook Vigenère, key `JENKINS` (found from the "Leeroy Jenkins" WoW
  reference — *"my last name is the key"*), decrypted with CyberChef/dcode's Vigenère solver.
- `spilled-secrets` (2023, std): a bespoke cipher, "VIGISTEP," handed to solvers as a spec
  document (`vigistep.png`) that is **deliberately, partially redacted** ("spilt pixels"). It is
  Vigenère-like but the keyword mutates by one character every time it's reused — an autokey /
  running-key variant, not the fixed-keyword Vigenère the repo teaches. Read directly off the
  (redacted) spec image: *"changes this word by one character each time it's used. This ensures
  the ciphertext does not show plaintext characteristics."*

### Layered / chained encoding pipelines — both years — FULL
- `double-trouble` (2023, std): binary → ASCII text, which itself contains a hex blob and an
  in-band hint ("veXed... nOt yet oveR... C7F") pointing at an XOR with a repeated 3-char hex key,
  then hex → ASCII for the flag. `README.md` walks the whole chain.
- `multi-layer-cake` (2025, std): ROT13 → spelled-out hex digits ("seven b space seven nine...") →
  hex → ASCII.
- `the-perfect-breakfast` (2025, std): Bacon cipher (binary) → letters → base64 → flag.
- `that-s-not-my-unicode` (2025, std): Cistercian numeral glyphs → decimal codes → treated as
  Unicode code points → base64 string → decoded base64 → flag.

Tool: CyberChef's ability to stack recipe steps is the intended path in every 2025 README.

### XOR — 2023 — FULL
- `double-trouble`'s final step is exactly repeating-key XOR (see above): a 3-byte key `C7F`
  cycled across a 34-byte ciphertext.

This repo's `public/crypto/xor/index.html` already covers single-byte brute force (`.brutelist`,
"RUN ALL 256 KEYS"), crib-drag key recovery (`.cribcalc`, `.cribin` — "type the start you can
guess every flag has"), and keystream reuse via two-time-pad XOR (`C3 · SAME KEY TWICE`), plus
`public/crypto/fnac/` layers on repeating-key XOR with an embedded crib (Night 3, key `tung tung
tung sahur` found by cribbing `flag{`). This is broader and more hands-on than either year's actual
XOR challenge — solid overshoot, not a gap.

### Hash work — both years — PARTIAL
- `WhoAmI` (2023, std): `run.py` hashes guesses with **SHA3-512 + a salt** and prints a
  **truncated-then-padded SHA1** as a decoy (`3b1485d981724ce400375c951873e6888e549c5baa65103b0b42
  9361976774c0`, of which only the first 40 hex chars are real SHA1 — `README.md`: *"a simple SHA1
  hash but there has been some added extra characters to make it look like SHA2."*). The skill is
  spotting the true hash length/family under a disguise, then cracking it against a guessed
  plaintext ("Bruce Wayne") — hash *identification and cracking*, not internals.
- `#InMyLibraryClashingEra` (2025, std): a custom, deliberately weak hash function shipped inside
  a pyarmor-obfuscated script; the task is to *find a collision* yourself (README offers a
  pre-made collision or "deobfuscate the script... snoop through and collect the collision logic
  manually").

`public/crypto/hash/index.html` teaches MD5 and SHA3-256 **internals** (avalanche effect, and an
MD5 collision **panel that shows a canned, already-published collision pair**) — genuinely strong
material, but it doesn't put a student through *identifying* an unknown/disguised hash, *cracking*
one against a wordlist/guess, or *constructing* a collision themselves. Verified by reading the
module's own doc-comments (`#md5-block-chain`, `.history-row.collision` etc.) — the collision
feature is a demonstration, not an exercise with a solve action.

### Non-Latin / symbol-legend lookup ciphers — 2025 only — GAP (4 of 9 challenges this year)
- `mysteries-of-the-tomb`: Egyptian-hieroglyph-styled glyphs, decoded via a provided
  glyph-to-letter legend (`𓏏 𓉔 𓏼 ☥ 𓏺...` → `th3c1f3rof4nch`).
- `that-s-not-my-unicode`: Cistercian numerals — a real medieval single-glyph 4-digit numeral
  system, identified by reverse image search per the README, then converted to numbers.
- `sheet-music-cipher`: the "Bucking Cipher," a musical-notation substitution cipher, identified
  via an EXIF comment (`Software: Bucking Cipher Encrypter`) and decoded with a provided
  note-to-letter key image.
- `the-perfect-breakfast`: Bacon cipher, a 500-year-old binary-letter substitution ("fill in the
  word" hint on dcode.fr).

All four are the same underlying skill: recognise you're looking at a non-alphabetic symbol set,
find or receive a legend, and do character-by-character lookup — no computation, just pattern
matching against a reference table. None of this repo's modules currently ask a student to do that
(the `ceasar` module's substitution is all shift-based, computed rather than looked-up).

### RSA — 2025 only — GAP
- `rsa101` (easy tier): standard textbook RSA with small/weak primes. README: *"input `n` into
  factordb.com... recompute the private key... `private_key = pow(e, -1, (p-1)*(q-1))`... `message
  = pow(cipher_text, private_key, n)`"* then `long_to_bytes`.
- `incorrect-implementation-of-rsa` (std): custom RSA with `e=5` and no padding, where the message
  is small enough relative to `n` that `ciphertext = message^e` never wraps mod `n` — so plaintext
  is recovered by taking an integer 5th root of each ciphertext value, no key at all. README shows
  the exact `x ** (1/e)` Python one-liner and the float-precision gotcha it produces.

Nothing touching RSA exists anywhere in `public/crypto/`.

### EXIF-first workflow — 2025 only — GAP
- `sheet-music-cipher` and `that-s-not-my-unicode` both open with "download the .png, run
  `exiftool` on it" as the first, explicitly-scripted step in their READMEs, surfacing either a
  direct clue (`Software: Bucking Cipher Encrypter`) or a taunt that sends the solver toward
  reverse image search (`Comment: That's not Unicode is it?`).

Checked `public/crypto/fnac/index.html` directly (per the brief's instruction to verify against
files, not `STATUS.md`) since its Night 1 is titled "Meta Parts" and the working-agreement doc
claims fnac's nights "stand in for a Kali utility (xxd/exiftool/zsteg)." `grep -i "exif\|metadata\|
comment"` returns nothing in that file, and Night 1's actual brief text is *"sometimes you need to
concatenate evidence"* — it is a **file-concatenation** exercise (two PNG halves joined into one),
not an EXIF-reading one. So this is a genuine, unmitigated gap, not a mislabelled partial.

### Bespoke-spec implementation — both years — GAP
A cluster the challenge authors clearly like, distinct from any specific cipher family: hand the
solver a *novel* algorithm spec (sometimes damaged/obfuscated) plus one or more worked examples,
and require them to implement and run it correctly.
- `subecsert-cryptosystem` (2023, std): a full spec PDF (`subsert.pdf`) for a "3×3×3 cube"
  coordinate-permutation cipher — convert each letter to (X,Y,Z) cube coordinates, rotate Y by one
  position and Z by two positions across the message, map back to letters — with **three worked
  test vectors** (full cube tables + plaintext + ciphertext) to verify an implementation against.
- `spilled-secrets` (2023, std): the VIGISTEP spec (see Polyalphabetic above), handed over with
  large sections of the instructions image visually redacted, so part of the task is reconstructing
  the missing spec from what's legible plus the surviving ciphertext.
- `#InMyLibraryClashingEra` (2025, std): the weak-hash spec lives inside a pyarmor-obfuscated
  Python file the solver must either run as a black box or reverse-engineer.

Nothing in this repo currently walks a student through "read an unfamiliar spec carefully, code it
exactly, check it against test vectors" — every module teaches a *named, standard* algorithm.

### Book cipher — 2023 only — GAP (singleton)
- `lesson-learnt`: a sticky note reading references like `2:9`, `2:25`, `5:4` (confirmed by reading
  `sticky_note_numbers.jpg` directly) that index into `laptop_note.txt` as line:word coordinates —
  a classic book/running-key cipher using an in-fiction document as the key material.

### Endianness / byte-order swap — 2023 only — GAP (singleton)
- `put-an-endian-to-my-misery` (easy tier): the flag's characters are grouped into 4-byte words and
  each word's byte order is reversed (`acep_1{n4wl4g...` → un-swap in groups of 4 →
  `pecan{1_4lw4y5...`). README shows the manual regrouping method and notes CyberChef's
  "Swap Endianness" recipe does it in one step.

### Not crypto, catalogued for completeness
- `lesson-learnt-2` (2023, std, requires `lesson-learnt`): the three words recovered from the book
  cipher (`taming halves simple`) are a what3words geocode, resolved via what3words.com to a real
  place name ("Plumridge Lakes"). This is a geolocation/OSINT step chained onto a crypto challenge,
  not crypto itself — excluded from the full/partial/gap count above but listed here since it's a
  real, scored challenge in the primary source.

---

## Part 2 — coverage against what is actually shipped

Read directly from the module files on `feat/caesar-rewrite-fnac-nights` (not from `STATUS.md`,
per the brief).

| Module | File | What it actually teaches (verified by grep/read) | Verdict |
|---|---|---|---|
| `public/crypto/ceasar/` | `index.html` (1185 lines) | Caesar/ROT, alternating 2-key Vigenère (`MODULE V`), affine (`data-type="affine"`, coprime-with-26 multiplier logic, number-line visual) | **Full** for classical shift; **partial** for polyalphabetic (no autokey/running-key variant) |
| `public/crypto/encoding/` | `index.html` (507 lines) | base64/hex/URL/ROT13/ROT47/atbash as stackable pipeline stages (`pipeline` array, `.tile[data-m=...]`), explicit layered-decode challenges | **Full** for layered-encoding bucket |
| `public/crypto/xor/` | `index.html` (722 lines) | single-byte brute force (`RUN ALL 256 KEYS`), crib-drag (`.cribin`/`.cribcalc`), keystream reuse via two-time pad (`C3 · SAME KEY TWICE`) | **Full**, exceeds what either year's XOR challenge required |
| `public/crypto/hash/` | `index.html` (5512 lines) | MD5 + SHA3-256 **internals**, avalanche effect, a **canned/published** MD5 collision-pair viewer | **Partial** — no hash-ID/cracking exercise, no hands-on collision construction |
| `public/crypto/fnac/` | `index.html` (616 lines) | Night 1: raw file concatenation (no EXIF); Night 2: bit-level interleaving/weaving; Night 3: repeating-key XOR with an embeddable crib | Reinforces XOR coverage; **does not** cover EXIF despite the "Meta Parts" title |
| — (no module) | — | RSA | **Gap** |
| — (no module) | — | Non-Latin/symbol-legend lookup ciphers | **Gap** |
| — (no module) | — | EXIF-first workflow (`exiftool`) | **Gap** |
| — (no module) | — | Bespoke-spec implementation | **Gap** |
| — (no module) | — | Book cipher | **Gap** |
| — (no module) | — | Endianness swap | **Gap** |

---

## Part 3 — what to do about it

Ranked by (likelihood it appears again) × (cost to cover), using `extra.initial` as the recurrence
signal within 2025 (the more recent, and the one where the point-value tiers are legible).

1. **RSA — build it.** Two of nine 2025 crypto challenges, one at the intro-tier alongside already-
   covered topics. Cost is low: `rsa101`'s own solve path (factordb → `pow(e,-1,phi,n)` →
   `pow(c,d,n)` → `long_to_bytes`) is a complete, minimal teaching script already. A module
   mirroring it (small/weak primes, "look the number up," decrypt) would close the single largest
   gap in this report.

2. **EXIF-first workflow — cheap, worth adding.** Two of nine 2025 challenges open with "run
   `exiftool` on the image." This is also one of the CLAUDE.md success criteria verbatim ("Kali
   tools they'd actually use") and costs almost nothing: embed a comment/metadata field in a
   downloadable image somewhere (a new mini-step, or folded into `fnac`'s existing image assets)
   and tell students to check it before touching the pixels.

3. **Hash ID + cracking — small addition, not a rebuild.** `WhoAmI` and
   `#InMyLibraryClashingEra` both want "spot what hash this really is, then break it" rather than
   "watch how a hash works internally." The hash module is already the biggest file in the repo and
   already has hash-family material to build on; a short "here's a suspicious-looking hash, is it
   really SHA-256, or is it something shorter padded to look like one, crack it against a small
   wordlist" exercise would close this without a new module.

**Explicitly skip:**
- **Non-Latin/symbol-legend lookup ciphers** (hieroglyph/Cistercian/music/Bacon) — despite being
  4 of 9 challenges in 2025, each is a different one-off flavour of the same trivial skill (match
  symbol to legend). Building four distinct visual decoders for marginal pedagogical gain over
  "here's a lookup table, read it" is a poor return; if time allows, a single sentence in whichever
  module ships next ("sometimes the alphabet itself is the puzzle — read the legend they gave you")
  covers the concept without four builds.
- **Bespoke-spec implementation** (`subecsert-cryptosystem`, `spilled-secrets`,
  `#InMyLibraryClashingEra`) — recurs across both years at real point value, but the skill it
  teaches ("read carefully, code precisely, check against test vectors") is general programming
  discipline rather than a crypto concept, and building a good from-scratch spec-following exercise
  is the most expensive item on this list for what it teaches.
- **Book cipher** (`lesson-learnt`, 2023 singleton) — one occurrence in two years, skip.
- **Endianness swap** (`put-an-endian-to-my-misery`, 2023 singleton, easy tier) — one occurrence,
  and CyberChef's "Swap Endianness" recipe solves it in one click regardless of prep; skip.
