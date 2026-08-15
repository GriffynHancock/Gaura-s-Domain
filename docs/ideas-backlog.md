# Ideas backlog (not yet built)

## Trophy wall + rarity tiers (victory effects)
A "trophy wall" where students collect and show off the victory confetti effects they've
unlocked — framed as a rarity tier list, like Hypixel cosmetics or a Roblox
"definitely-not-gambling-for-children" loot game.

- Each victory effect (the confetti sprites in `tools/build_confetti.py` / `confetti/`) gets
  a **rarity tier** (common → legendary). Rarer effects drop less often / are harder to get.
- A page (or panel) shows the wall: unlocked effects lit up, locked ones as silhouettes —
  drives "I got the legendary suss imposter, what'd you get?" social pressure to solve more.
- Ties into the existing per-user cookie signature (`ctf-uid`): currently one signature
  effect per person/module. A trophy wall would mean unlocking MORE over time (per puzzle
  solved? per module? random drop on solve?). Decide the unlock economy when building.
- Open questions: where unlocks persist (cookie/localStorage vs real accounts), how rarity
  weights work, whether it's per-module or account-wide, and how to avoid actual
  gambling-y mechanics with minors.

Raised 2026-06-25 while building the encoding-module victory effects.

## Hash-of-file-as-key challenge (Module 3 · Hashing)
A challenge where the *hash of a file* is the key/answer needed to unlock something else —
e.g. hash a provided file (or the "correct" one out of several near-identical decoys) and use
the resulting digest as a password/key to open a follow-on artifact (a zip, a login, a folder).
Teaches hashes-as-fingerprints/integrity-check in a hands-on way, distinct from the
crack-a-weak-hash angle the avalanche/MD5-vs-SHA3 visualization page already covers.

- Could layer as a bonus/boss stage after the main Hashing visualization page, or live inside
  FNAC as a future Night given that module's found-file framing.
- Open questions: what the "unlock" actually gates (zip w/ password = hash? a follow-up page
  URL derived from the hash?), how many decoy files, which hash algorithm (probably match
  whatever the Hashing page settles on for its "modern" side, e.g. SHA-256/SHA-3).

Raised 2026-08-12 while brainstorming the Module 3 Hashing visualization design — deliberately
not folded into that spec, since it's a scored-challenge idea, not a teaching-visual one.

## SHA-3 ρ-rotation as a colour gradient (Module 3 · Hashing)
Instead of (or alongside) the per-lane tick-mark twist that currently represents ρ's rotation
offset, use a 2-5 colour gradient per lane to indicate rotation amount/direction — e.g. a hue
sweep proportional to each lane's real `KECCAK_RHO_OFFSETS[x][y]` value, so the amount of twist
reads as a colour shift rather than (or in addition to) a moving tick mark.

- User's own idea, explicitly deferred: "don't have to implement that this round just an idea."
- Natural companion to a separate, larger gap the advisor identified in the same conversation:
  the lane grid's rate/capacity tint is static (correctly — it's a structural fact, not
  something that changes), but nothing currently shows each lane's actual *content* changing
  round to round, which is the real, currently-missing signal. If that gets built (extending
  `keccakF1600WithTrace`'s per-round events to sample every lane's live value, not just the
  ι lane), a rotation-amount gradient would have a natural home layered on top of it —
  brightness/hue driven by real content, twist/gradient driven by real rotation offset.

Raised 2026-08-13 during hash-viz post-deploy feedback (SHA-3 animation pacing/legibility pass).

## Trollface folder → QR polyglot → Snake puzzle box (Module 3 · Hashing, or standalone)
A layered "demoscene puzzle box" challenge, spun out of the desktop-micro-theme idea (the 2015-era
desktop theme includes a `Trollface` folder icon as set dressing). Recorded 2026-08-13 as a
future research target — NOT being built in the current pass. The desktop theme should ship the
folder/icon and a placeholder flag in a filename so the hook exists to build on later.

Layers, outermost first:
1. **The folder opens** to a pack of downloadable trollface/rage-face images (fairly HD).
2. **Batch-processing puzzle:** each image carries a noise pattern; only when all of them are
   combined/stacked does the pattern resolve into a QR code. Forces students to write a batch
   process rather than eyeball one file — a real CTF skill.
3. **The QR code is a polyglot:** a max-size QR whose payload, when saved to disk, is itself a
   runnable file that a Chromium browser will execute.
4. **The runnable file is a game of Snake** on a small grid (8×8 suggested) that only releases its
   key/flag after a genuinely completed playthrough — the snake must eat enough fruit to max out
   the board. Since it's the student's own browser, they control execution speed, so the intended
   solve is writing a TAS (tool-assisted speedrun) / scripted perfect play rather than playing by
   hand. The flag surfaces on completion (printed, or via a browser warning, or by flipping a
   variable the player can then read).

Open questions for the research agent(s):
- **Is the QR-as-executable-polyglot actually feasible?** Max QR (version 40) holds ~2953 bytes
  binary / ~4296 alphanumeric. Is that enough for a self-contained Snake that Chromium will run?
  What file type — the user said "compiled ws file", which is ambiguous (WebAssembly `.wasm`?
  Windows Script `.ws`? a self-contained `.html`?). Determine what a Chromium browser will actually
  execute from a local file, and pick the format that makes the polyglot possible at all.
- **Can the win-condition key be made genuinely unforgeable** — i.e. derived from the game state
  such that you can't just read the flag out of the source without playing? (Deriving a decryption
  key from the sequence of moves / final board state, rather than an `if (won) print(flag)` that
  anyone can grep, is the interesting version. Note a determined student can always extract it from
  a local file — the goal is making playing-it easier than defeating-it, not real security.)
- Whether the noise-pattern-to-QR step should be steganographic (LSB) or something more visual.

Worth splitting into more than one research pass — the QR polyglot feasibility and the
tamper-resistant-win-condition design are fairly independent problems.

## Encryption 101 extensions — "vaguely related games after the lesson" (2026-08-14)

Author's brainstorm, with an assessment. **Not scheduled. Do not build without a design pass.**

### A. Torus — build this one first
`Z/26 × Z/26` **is** a discrete torus, and Caesar challenge V (two dials, odd letters / even
letters) is already a point on it. This isn't a metaphor being stretched onto the maths; it's the
correct object for the cipher that's already shipped.

What it teaches honestly:
- **Keyspace geometry.** One dial = 26 points on a circle. Two dials = 676 on a torus. Key length
  *multiplies*, it doesn't add — and that's the real reason long keys matter, made visible.
- **Why brute force gets hard**: you search a surface, not a line.
- **No false gradient.** A torus has no downhill. Contrast the spiral idea below.
- The natural close: "now imagine 16 dials — a 16-torus, which you cannot draw." The
  undrawability *is* the lesson.

Cheapest of the four, most honest, and it upgrades existing content rather than adding a new
concept.

### B. Complex plane — really the Hill cipher, and that's a feature
Two dials, real and imaginary. Complex multiplication = rotation + scale. On a finite set this is
Gaussian integers mod n, `Z[i]/(n)`; multiplying by `a+bi` is invertible iff the norm `a²+b²` is
coprime to n — so the existing guardrail lesson generalises exactly, with a richer condition.

The payoff: complex multiply *is* the 2×2 matrix `[[a,−b],[b,a]]`, so this is a special case of the
**Hill cipher** — matrix multiply mod 26, a real classical cipher and a real CTF category. Letters
pair into (x,y) points; the dials rotate and scale the whole lattice; you hunt the transform that
makes text readable. It's the genuine conceptual step from 1D substitution toward block ciphers.

### C. Big text, dial 1–100, chunks unlock on different combinations
Fun, but it has a bug as specified: **on a 26-letter alphabet a dial of 1–100 is 1–26 repeated
four times**, silently. Two ways out, and the second is better teaching:
1. Use a bigger alphabet — ROT47's 94 printable ASCII chars make 1–94 meaningful (and mod 94 =
   2×47 gives far more valid multipliers than mod 26).
2. Keep the dial at 100 and **show the collapse**: the readout says "key 73 = key 21". They
   discover that keyspace ≠ dial range themselves.

The chunks-unlock-separately mechanic is worth keeping either way — a multi-keyed document is a
real thing, and partial decryption is a real CTF experience.

### D. Complex exponent / spiral — drop it
A spiral that "lines up" as you slide implies a continuous approach to the answer: a gradient you
can follow. `CLAUDE.md`'s teaching rule names this exact failure (the downhill-flow search-space
visual). Modular arithmetic is not smooth — 25 and 1 are adjacent on the ring and far apart on the
number line — so this visual would teach the opposite of the truth. Beautiful, dishonest.
(Complex sine has the same objection.)

## FNAC gate / completion-accounting resilience (2026-08-15)

Deliberately NOT built now — user's call: too late to make the gate self-repairing, hard-coded
totals are fine, and the konami bypass covers a stuck student. Recorded so it isn't re-lost.

- **Derive `FX_TOTAL` from each page's own puzzle registry instead of a hand-set constant.**
  Caesar and Encoding already do this correctly (`document.querySelectorAll('[data-puzzle]').length`
  and `PUZZLES.length` respectively — both audited and correct as of this pass). XOR and FNAC instead
  hard-code the number, and both have been wrong at least once as a direct result: XOR ships
  `FX_TOTAL=4` against 3 built cards (deliberate, C4 in progress) and FNAC shipped `FX_TOTAL=7`
  against 3 real nights (fixed this pass to `3`, but it's the same class of bug and will recur the
  same way each time a night/card count changes without the constant being touched by hand).
  A `STAGES.filter(s => s.ready).length` (FNAC) or a card-count derived from `addCard` registrations
  (XOR) would make this un-forgettable instead of relying on someone remembering to bump a comment.
- **No visibility into a wrong `FX_TOTAL` short of manual audit.** Nothing asserts, at build or test
  time, that `FX_TOTAL` matches the actually-solvable puzzle count on any page. A regression here is
  silent: the module just quietly never completes, and (for FNAC specifically) that silently locks
  a *different* module's students out of the bonus content, one layer removed from the bug. A cheap
  guard (a Playwright check per module: solve every real puzzle, assert `fxIsComplete()` becomes
  true) would catch this class of bug without needing dynamic derivation.
- **A module completed before the cross-module index existed isn't retroactively counted** until
  the student re-opens it (each visit repairs its own index entry). FNAC's locked screen links to
  each unfinished module so the repair is one click, not automatic — fine as a stopgap, but that
  extra click through a stale "not done yet" is unexplained to the student who hits it.
- **`ctf-complete:v1` has no versioning/migration story.** Worth a naming convention (like the
  solved-store's `:v2`) decided before a schema change is needed mid-event, not after.

Raised 2026-08-15 while auditing/fixing FX_TOTAL mismatches across all five crypto modules.

## Local/offline hosting for locked-down school networks — NOT NEEDED, recorded only

The school network blocks `ctf.sandhi.com.au`, so students reach the modules through the **Kali
VMs, which are hosted elsewhere and can get out to the internet**. The live site is therefore
reachable on the day and **no local deployment is required** — the author explicitly decided not
to build one (2026-08-15). This entry exists only so the reasoning isn't re-derived from scratch
if the situation changes.

If a local version is ever actually needed, the shape is deliberately boring:
- **No deployment machinery, no venv, no dependencies.** Every module is a static
  dependency-free HTML file, so `python3 -m http.server` served **from `public/`** is the whole
  thing — and serving from `public/` (not the repo root) makes the paths `/crypto/<name>/`,
  identical to production, dodging the `/public/` prefix quirk that bites during local dev.
- So the student-facing instruction collapses to: clone the repo, run one script, open the
  printed URL. A `serve.sh` wrapper that picks a free port and prints the URL is the only new
  artifact needed.
- **The one thing to check before trusting this**: whether the pages fetch anything off-machine
  (web fonts, any CDN asset). A page that hotlinks Google Fonts still *renders* offline but loses
  its typography, and on a network that blocks by domain it may hang on the request rather than
  fail fast. Verify with the network panel / an offline profile before promising it works.
- Unrelated to `worst-case/launch_offline.py`, which is the **presenter's** paper/offline fallback
  (embedded page copies + text challenges), not a student-facing server.

## Decoding 102 — teach `file` and friends

Raised 2026-08-15. A follow-on module for identifying what you are holding, rather than decoding it.
Core tool is `file` (magic-byte sniffing), which is the reflex a CTF player needs constantly and
which nothing in the current track teaches.

Why it earns a module rather than a footnote: during the first session a student's Night 2 attempt
looked broken, and the diagnosis needed exactly this skill. The output of a correct solve and an
incorrect one were both 5450 bytes, both unopenable by double-click (no extension), and visually
identical as "nothing happened". `file` separates them instantly:

    out_ab: data
    out_ba: PNG image data, 222 x 180, 8-bit/color RGBA, non-interlaced

(That particular incident turned out to be the student mixing Night 1 and Night 2 files, not a bug.
The assets are correct and the live copies match local. But the general failure mode stands: a
beginner cannot tell a correct binary result from a wrong one without a magic-byte check.)

Natural companions for the same module: `xxd`/`hexdump` for reading headers by eye, `strings`,
extension-vs-content mismatch (ties to FNAC's double-extension `.zip.exe` gag), and why trailing
bytes after `IEND` survive (ties to Night 1 and Night 2's easter egg).
