# STATUS — Crypto 101 CTF prep

_Single source of truth. Updated as we go. Full plan: `docs/superpowers/specs/2026-06-24-crypto-curriculum-design.md`. Context: `CLAUDE.md`._

## In one line
Projected, presenter-led web modules (~60 min) teaching teenagers crypto before a national CTF.
Spine: **recognise → identify → decode/crack → submit.**

## Modules
The directory renumbered to **101–105** on 2026-08-15 and is now the student-facing landing page
"Gaura's Domain" (`public/crypto/index.html`), not a dev page. Note XOR is **103** and Hashing is
**104**, the reverse of the old numbering that older notes still quote.

| # | Module | State | URL / path |
|---|--------|-------|-----------|
| 101 | Simplest Cryptography (Caesar / ROT, + Vigenère + Affine) | ✅ **live** | `ctf.sandhi.com.au/crypto/ceasar` |
| 102 | Common Encoding Schemes | ✅ **live** | `ctf.sandhi.com.au/crypto/encoding` |
| 103 | XOR & Binary | ✅ **live** (all 4 challenges) | `ctf.sandhi.com.au/crypto/xor` |
| 104 | Intro to Hashing | ✅ **live** | `ctf.sandhi.com.au/crypto/hash` |
| 105 | **5 Nights at Crypto's** (gated behind Caesar + XOR + Encoding) | ✅ **live** (nights 1–3 real, 4–7 placeholders) | `ctf.sandhi.com.au/crypto/fnac` |
| — | Live Kali demo (CyberChef + archive crack) | ⬜ presenter prep | n/a |

> ✅ **The old blocking fact is cleared.** XOR's C4 was built on 2026-08-15, so `FX_TOTAL = 4` now matches
> four real cards and XOR can register complete. FNAC's gate is therefore reachable by finishing the three
> beginner modules, not only by konami. FNAC's own `FX_TOTAL` was also wrong (7 against 3 real nights) and
> is now 3; raise it as each placeholder night ships.

## First live session — 2026-08-15
Ran ~1 hour with the real cohort. **Got through Caesar, XOR and Encoding only**, so three beginner modules
is the realistic hour. One student solved FNAC Night 1 and was close on Night 2. **Cribbing was the wall** —
people really struggled with it in XOR C2, which matters because C2, C3 and FNAC Night 3 all depend on it
landing. A reported "Night 2 is broken" turned out to be a student mixing Night 1 and Night 2 files; the
assets are correct and live matches local.

## Module 3 — Hashing (live, `/crypto/hash`)

**Current state.** An avalanche-effect + internals visualization, not a puzzle ramp — no scored
challenges yet (idea logged in `docs/ideas-backlog.md`). From-scratch, trace-instrumented MD5 and
SHA3-256/Keccak, both verified digest-for-digest against Node's `crypto` and Python's `hashlib`
across padding boundaries. **Not** `SubtleCrypto` — the Web Crypto API supports neither MD5 nor
SHA-3, and exposes only final digests, not the per-round internals the animation needs. The page
says so explicitly, with searchable keywords, so nobody concludes browsers lack real crypto.

One row: input (8 arrow-cycled presets incl. custom text, Cyrillic false-friend, whitespace-chips,
public-domain text, a 56-block cat photo, and both halves of the real Wang/Rescorla MD5 collision
pair) → algorithm toggle + Hash + live speed slider + step-through → output. Below: a per-algorithm
diagram, a history log (content-hash IDs, so re-hashing the same input never false-flags), and a
dedicated MD5 collision panel.

**MD5 side.** Merkle–Damgård chain with a live register view — A/B/C/D hex values, the active
F/G/H/I function highlighted, `M[g]`/`s[i]`/`K[i]`, and a step counter. Multi-block inputs render as
a Z-axis "deck of cards" stack with the real state hand-off between blocks (block N's actual final
A/B/C/D seeds block N+1 — not a hardcoded IV per card). The Pad box shows how many bytes of padding
were actually added; it never disappears, because Merkle–Damgård *always* pads.

**SHA-3 side — a Canvas 2D renderer, not CSS.** Three CSS-3D attempts failed for structural
reasons, not polish (see the CSS 3D gotcha in `CLAUDE.md`, plus `docs/research/3d-rendering-options.md`
for why Three.js/Zdog were weighed and declined). Now: 25 lanes × 8 sub-cubes = 200 closed boxes,
axonometric projection, painter's-algorithm depth sort, backface culling, DPR-aware, themed from the
page's own CSS custom properties. Starts **face-on** so it reads as the flat 5×5 grid of the printed
Keccak diagrams, then reveals its depth on drag (with a one-shot 5° scroll hint for anyone who
doesn't find it). Rate/capacity is drawn as 17 gold / 8 dark lanes at their real lane-aligned
boundary; capacity starts genuinely all-zero and visibly fills as data diffuses in — the sponge
lesson. Drag rotation is direct-manipulation on **both** axes for every pointer type.

**The phase controller** runs θ→ρ→π→χ→ι strictly sequentially, one at a time, with five colour-coded
indicator boxes. Each phase sweeps its **real FIPS 202 axis** — θ +x as a plane, χ −x as five
staggered per-row races, ρ along z per-lane, π an x-y swirl, ι a point at lane (0,0). (Note χ is +x,
not y: a Keccak row is *indexed by* y but *runs along* x. Nothing sweeps along y, because no Keccak
step propagates along y.) π transits in two stages — rows push radially out from the metacube
centre, then fall onto their destinations — with an 8.6° swirl on the outward direction because a
pure radial path provably collides (lane (1,3)→(3,1) runs straight through the centre where
(3,2)→(2,2) has landed). Lanes move in 5 groups keyed on source row, which is itself a fact about π:
it sends source row *y* into destination column *y*.

**Juice + safety.** Count-based multiplicative escalation (`1.1^n` for MD5, uncapped but contained),
per-card off-centre pivots, translation, reddening. **Temporal aliasing**: past a threshold, apparent
motion slows, freezes and reverses like a filmed wheel — geometry aliases early (calibrated so the
default slider is the peak), colour later, and the divergence is deliberate. A one-line on-page note
says outright that the reversal is a shutter illusion and SHA-3 never runs backwards.
A **photosensitivity governor** measures real flash pace and clamps luminance excursion under
WCAG 2.3.1's 3 flashes/second. Rate and red-flash bounds pass everywhere (0 flashes/sec); the
**luminance-excursion bound does not** — see the open item below. It honours `prefers-reduced-motion`.
**This is safety-critical for a room of teenagers: do not weaken it.**

**Motion blur — a per-object swept silhouette** (replaced the old accumulation wipe). Each box's smear is the
convex hull of its 8 projected corners now and a shutter ago, gradient-filled with the trapezoid coverage a
real shutter integrates, drawn inline in the existing painter's order immediately before the box itself.
Strength comes from **measured per-corner screen displacement**, so it scales with speed by construction —
which is what the old alpha wipe could not do, being frame-counted rather than time-counted. It measures
*apparent* motion (displacement is taken after projection, downstream of `sha3AliasWarp`), so at the aliasing
peak where the lattice appears to freeze the smear collapses with it: a strobe is a short shutter, and the two
effects agree about what is moving instead of fighting. Invalidation rule: **no previous frame, no smear** —
the stored corners are valid only while the controller is running, and are dropped by a stop, reset, resize,
theme change or camera drag. `SHA3_BLUR_ALPHA_FAST/_SLOW/_GOV`, the tail, the attack filter and `sha3.wipeA`
were **deleted**, not retuned. Cost: +1.1 to +1.3 ms on a 1.3 ms scene.

**`SHA3_WIPE_ALPHA` is a photosensitivity control, not a look.** While the controller runs, the canvas gets a
fixed translucent full-canvas wipe. It is not the motion blur (the swept smear is); it is a one-line temporal
low-pass bounding how much a small patch of screen can change in one frame, and it was **reinstated on
measurement** after being deleted along with the old speed-keyed blur. The numbers, at slider 100 on the flash
suite's 6×6 probe (93×60px patches, four times finer than WCAG's own unit):

| config | biggest single-frame excursion | flashes/s (bound 3) |
|---|---|---|
| old speed-keyed wipe, alpha 0.20–0.24 | 0.082–0.083 | 0 |
| opaque wipe, **no smear at all** | 0.087–0.090 | 0 |
| opaque wipe + swept smear | 0.094–0.103 | **0–19 (straddles)** |
| fixed 0.30 wipe + swept smear (shipped) | 0.086 | 0 |

i.e. the animation's own per-frame motion already sits near WCAG's 0.10 transition threshold at that
granularity and the wipe was silently holding it down. Deleting it as "vestigial now the smear exists"
measurably reintroduces a breach, and tuning the smear cannot fix it.

**Step-through** (tick box + STEP / AGAIN under the speed slider): SHA-3 steps one phase, MD5 one
trace event. SHA-3's AGAIN snapshots and restores state, because its phases mutate permanently
(π composes slots, ρ accumulates spin) — without that, "repeat" would silently advance.

Run durations: slider 1 ≈ 195s, 50 ≈ 8.1s, 100 ≈ 1.8s, plus a REAL TIME toggle that collapses a run
to ~22ms and displays the machine's measured per-block time (~1.8µs MD5, ~74µs SHA-3). That readout
carries an explicit "not a fair race" caveat — the gap is a JS BigInt artefact, not a property of the
algorithms.

**Source annotation.** The file carries a top-of-file explainer and consistent `[EXACT]` /
`[FAIRLY ACCURATE]` / `[ANALOGY]` tags throughout, so a reader can tell which visuals are the real
algorithm and which are teaching aids.

### Test suite — 15 scripts in `tools/`, run them all before merging anything
**Run them with `node tools/run_suite.mjs`** (`--list` for the groups). It parallelises the
state-only scripts, runs the pacing-sensitive ones one at a time so CPU contention cannot fake a
failure, and leaves out `verify_flash_safety` unless you pass `--all` — the fast gate is ~87s
against ~6.5 min for everything serially. Pass `--all` for any change that can move a flash
(animation timing, pacing, escalation/aliasing curves, per-frame colour, opacity/blur, the
governor, repaint cadence). Timings and reasoning: `docs/research/test-suite-speed-audit.md`.

`test_md5_trace` · `test_keccak_trace` · `verify_task3_lane_grid` · `verify_task4_sha3_animation` ·
`verify_task5_md5_registers` · `verify_task6_block_stack` · `verify_task7_input_box` ·
`verify_task8_collision` · `verify_task9_full_integration` · `verify_task_wiggle_juice` ·
`verify_flash_safety` · `verify_sha3_aliasing` · `verify_step_through` · `verify_sha3_touch_drag` ·
`verify_pi_pacing`

The two `test_*` are pure Node (digest parity + trace schema). The rest are Playwright and need a
served page: `HASH_MODULE_URL="http://localhost:<port>/public/crypto/hash/"`. **Read the serving
gotcha in `CLAUDE.md` first** — testing a stale checkout has produced a convincing *fake* failure
more than once. `verify_flash_safety` is slow (~4 min) and is the one that must never be relaxed.
`tools/assert_page_build.mjs` is the shared guard every Playwright script calls first: it asserts the served
page is the build the test was written against, so a server rooted in the wrong checkout fails loudly instead
of producing a plausible wrong answer.
Two further scripts sit **outside** `run_suite.mjs` and cover FNAC, not hashing —
`verify_fnac_module.mjs` and `verify_fnac_flash_safety.mjs`, both driven by `FNAC_MODULE_URL`.

### Known gaps / deliberately parked
- ⚠️ **The photosensitivity governor's luminance-excursion bound is FAILING, and has been for a while.**
  `verify_flash_safety.mjs` reports `slider 78, 4 rate-blocks … biggest excursion 0.0778` (the coordinator
  measured 0.0886 on the same untouched page, so ~0.01 of run-to-run variance) against a **0.07** bound.
  Pre-existing; not caused by the blur work. Rate and red-flash assertions pass with 0 flashes counted.
  **Fix the animation, not the bound.**
  What is *not* known: a full `verify_flash_safety.mjs` run has never completed against the shipped
  blur+fixed-wipe build — the agent hit a session limit and the report's "Flash-safety measured numbers"
  section is empty. But the blur work *did* take a targeted measurement of exactly the failing case, recorded
  in the page: at the 3×3 unit the suite actually asserts, **slider 78 now measures 0.046–0.049**, because a
  constant wipe has no deep-trail-to-opaque seam to step across. So the likely state is "already fixed",
  and the honest state is "unverified". Run the suite once before the event and believe the run, not this
  paragraph.
- **Lane-grouping drift**: after round 0, a box's on-screen slot follows its own accumulated π-orbit
  while its *value* is applied by canonical index, so θ's plane-shake and χ's row-highlight can group
  boxes that aren't the true mathematical row/column. Tagged `[ANALOGY]` at those sites rather than
  claimed accurate. Worth a real fix.
- **The absorb padding lesson**: during absorb the one bright near-face cube is always x=1,y=3,z=7 =
  `0x80`, the multi-rate pad's terminating bit. Correct, and arguably the best incidental lesson on
  the page — but nothing tells the student that's what they're seeing.
- Evenness of π's group stagger is pinned at zero escalation; a long run's escalation pushes it back
  into the aliased region partway through (by design, but not "even for the whole run").
- `keccak256WithTrace` is misleadingly named — it computes real FIPS-202 SHA3-256, not pre-standard
  Keccak-256. Digests are correct; only the identifier is off.

### Build history (condensed)
Built 2026-08-12 via `docs/superpowers/plans/2026-08-12-hash-visualization.md` (10-task
subagent-driven build); final review caught a Critical SHA3-256 padding bug (`length % 136 === 135`).
Redesigned 2026-08-13 via `.../2026-08-12-hash-visualization-redesign.md` after the first visuals
were judged too thin; that review caught θ and ρ rendering *identically* — the redesign's headline
goal — plus a CSS `transition` shorthand silently killing pulse decay page-wide. Then an iterative
feedback loop through 2026-08-13/14 produced the Canvas rebuild, phase controller, aliasing, safety
governor, step-through and π pacing described above. Specs in `docs/superpowers/specs/`, supporting
research in `docs/research/`.

## Module 1 — Encryption 101 (live, `/crypto/ceasar`) — 6 puzzles
Titled **"Encryption 101"** (h1), kicker links back to Gaura's Domain. Opens with a plain-language framing of
what encryption is, an ℹ note on letters-as-numbers, and a highlighted call to action telling students they're
hunting a signal that reads `flag{`. Dial instrument(s) + alphabet slide-rule + dark mode + solved-ticks
("✓ captured" everywhere; the stamp reads "flag captured"). Ramp:
- I–IV **Caesar** (single shift dial) — easy openers. I is "I hope you know your alphabet".
- V **Two Tones** — alternating **Vigenère** (2 dials: odd/even letters). Forces you to line up an `f`.
- VI **Multiply & Slide** — **Affine** `a·x+b` (× STRETCH dial + + SHIFT dial). Genuinely hard without the riddle.
- (Three Wheel / Vigenère-3 was built then **removed** — didn't land.)
- **Per-user randomized answers**: every dial's key(s) derive from the `ctf-uid` cookie (FNV hash); the flag is
  re-encoded in-browser, so each student dials different numbers / sees different ciphertext (anti shoulder-surf).
  Flags (the plaintext, constant): `flag{G}`, `flag{Bee}`, `flag{Caesar_Salad}`, `flag{bored_yet}`,
  `flag{two_tones}`, `flag{affine_ace}`. The *keys* differ per user. (IV deliberately carries no `?` — `?`
  passes through `encodeFor` untouched and would sit in the ciphertext as a free structural crib.)
  ⚠ The static `.plate` ciphertexts checked into the HTML still encode the **old** IV/VI plaintexts. Harmless
  at runtime (overwritten at mount by `encodeFor`) but a view-source student reads a wrong answer. Still open.
- **`COPRIMES` is 8 values, not 11**: `[3,5,7,9,11,15,21,25]`. 17/19/23 are mathematically fine affine keys but
  were dropped because they have no clue a 15-year-old anywhere can count. Each value needs an `A_CLUES` entry,
  and the hard rule is that **no clue may name another surviving multiplier** — a stuck student types the number
  they can see. That rule is why "a cat's lives" is retired (a cat has *seven* lives in Italian, Spanish, Greek,
  German, Turkish, Portuguese and Arabic, and 7 is live) and why "three rows of three" became "squares on a
  noughts-and-crosses grid". Changing `COPRIMES` rotates every existing student's challenge-VI key.
- **Affine number-line visual** (`buildNumberLine`), rebuilt: blue input row → yellow stretch rows → green/red
  output row, arrowheads as reusable SVG `<marker>`s at the leading tip, collisions layering **additively**
  (multiply would vanish on the dark ground), and a full 0–25 output line with hollow "shadow" sockets so the
  *holes* a non-coprime `a` leaves are visible rather than implied. `a·x+b mod 26` sits under the line. New
  themed tokens including `--read-tick`; an `explainer` box covers modular arithmetic and injectivity.
  Owns the **riddle** (cryptically encodes this user's `a`) and the **Guardrail**, now folded into the verdict
  pill, colour-changing, **off by default but remembered** (`caesar-guardrail`) — off = hard mode, no collision
  warning. The **input row has the same number line as the output row**, recoloured to `--nl-in` and drawn
  *upwards* (ticks and labels above the dots) so it never collides with the threads — and deliberately with
  **no** shadow sockets, because every input is always present and empty sockets up there would imply the
  holes happen on both sides. That symmetry is the lesson: the same 26 slots go in as come out, and the map
  either fills them all or doesn't.
  The SVG sits in an **expandable window** (native CSS `resize` grabber, no extra chrome) with two modes.
  Default is `y auto`: `Hu = HU_FIT(lapCount)`, so the frame hugs the picture — constant gap below the last
  lap at every multiplier, no void. The footer pill toggles to a fixed window (`y N×`, `HU_FIXED` = 1× the lap
  zone) which the grabber then writes to; the mode is **not** persisted, by design. The pill exists because a
  CSS resize corner is close to unusable on a phone and this room is phone-native.
- **Slide rule:** fluid percentage tape (1 alphabet window, 3-alphabet strip), CSS-transition slide, **seamless
  0↔25 wrap** (`setTape` repositions across identical copies invisibly).
- **Bonus unlock:** VI's flag **is** the reward code. Nothing is printed on solve any more — the student keys
  `flag{affine_ace}` into the UNLOCK panel themselves, which maps codes → reward URLs (currently **placeholder
  rickrolls — swap real meme URLs** in `REWARDS`). Persisted in localStorage (`caesar-unlocks`).

## Module 2 — Encoding is not encryption (live, `/crypto/encoding`) — 9 puzzles
Titled **"Encoding is not ~~encryption~~"**. Click-to-build decode pipeline; **method tiles shuffle per
card/refresh**; preview **TEXT ⇄ IMAGE** (resizable) that **always starts on TEXT** — flipping to IMAGE is the
student's move to make; type-the-flag SUBMIT; solved-tick; dark mode; resizable blob window. Methods:
`base64 hex url rot13 rot47 atbash` (rot13 pure distractor; url real in IV then distractor). Decoders never throw.
Ramp: I base64 · II base64→image · III hex · IV url · V image-hides-text (sting) · VI base64→hex ·
VII base64→rot47→hex (3-layer) · **VIII Two Faces** (one blob: `hex`→flag PNG, `base64`→painted trollface —
a real dual-image polyglot) · IX red-herring (`florg{}`/`glaf{}`/`glorf{}` decoys).
**No puzzle has a hint box any more** — VI–IX were unhinted deliberately and VIII's (the last one) was
removed by the author too. There is no `hint` field and no `.cyber` box left in the page.
- **V's sting** (real cha-ching SFX, `chaching.mp3`) now fires only on the exact intended move:
  `pipeline === ['base64']` **and** the preview showing IMAGE. Any other route to the flag is silent.
- **VIII** gained a URL-encoded tail pad (`?q=%4e%60.ref=…`). Its blob used to end in a long run of `/` right
  after the flag-PNG hex, so scrolling the raw string to the bottom shouted "hex". The pad is not free — it
  passes through both decoders, so `url_pad()` pins three invariants (pad-char residue `R % 4 == 0`, `R <= 192`
  so the base64 face still lands on a 48×48 grid, and a hex tail of exactly `Rh//2` bytes). Current: `R=176`,
  74 bytes after the PNG's `IEND`. It also baits `url` as a third wrong answer.
- **IX is three layers, `base64 → rot47 → atbash`, layered PER-REGION rather than per-document** — that is the
  whole design. The blob is `base64(dump)` where the dump is **plain readable text** except for one field whose
  value is `rot47(atbash(flag))`. Three beats, each asserted by the builder:
  1. **base64 alone** → a readable capture dump. The `payload:` signpost and the three decoys are legible;
     only the payload *value* is visibly punctuation soup. (Before this, base64 alone produced whole-document
     soup, which reads as "wrong turn" and gives the student nothing to aim at.)
  2. **base64 → rot47** → rot47 is an involution, so the payload resolves to `atbash(flag)` =
     `uozt{ivzw_vevib_ormv_urihg}`: mirrored English in `flag{}` shape, i.e. a convincing *fourth decoy* that
     nonetheless points **at** the remaining atbash tile. That is the bamboozle — the correct next step looks
     like a dead end. (The surrounding dump is rot47 soup by now; expected, since the page applies each method
     to the whole blob and the student's eye is on the payload.) `\n` is outside rot47's `[33,126]` range, so
     the dump keeps its line breaks at every layer.
  3. **base64 → rot47 → atbash** → `flag{read_every_line_first}`, and **exactly one** `FLAG_RE` match.
  ⚠ **Do not reorder these back.** The mirror `base64 → atbash → rot47` shipped once and was reverted by
  author decision, for two reasons. Under the old whole-document layering it had a *structural* near-miss: the
  natural two-layer guess `base64 → rot47` computes `rot47(atbash(rot47(plain)))`, and lowercase `a`–`o` rot47
  to `2`–`@`, which atbash leaves untouched — so the second rot47 returns them exactly. ~58% of the alphabet is
  invariant under the wrong order for **any** English payload, so the wrong guess yields a near-readable fake
  flag; no amount of regenerating the blob fixes it, it is a property of the two ciphers. Per-region layering
  narrows where that can bite, but it is still pinned shut: the builder asserts that no earlier layer contains
  `flag{...}` **or even a bare `flag`**, and that `base64 → atbash → rot47` does *not* solve — so the checks
  prove the intended order rather than passing by luck. The order is also what *makes* beat 2: rot47-inside
  lands the payload on `atbash(flag)`; the mirror lands it on `rot47(flag)`, symbol soup that reads as a wrong
  turn rather than as a decoy.
Assets: `tools/build_base64_assets.py` (Pillow) → `public/crypto/encoding/assets.js`.
Solve-paths/authoring guide: `docs/superpowers/module2-solve-paths.md` (current — reflects all of the above).
Clearing every puzzle here reveals the FNAC banner link. It no longer writes a `ctf-fnac-unlocked` cookie —
that cookie is gone, and FNAC's gate now asks the confetti engine for all three beginner modules instead.

## Bonus — Five Nights at Crypto's (live, `/crypto/fnac`)
File-forensics bonus module, deployed. Seven stages; **nights 1–3 are real, 4–7 are placeholders**
(`ready:false`, dimmed). `FX_TOTAL = 3`, matching the real, solvable nights — hard-coded, not derived
from `STAGES.length` (which is 7), and must be raised by hand as each placeholder night goes live.

**No helper widgets any more.** The RAW BYTES / WEAVE / XOR BENCH tools were all deleted: this module now
assumes a commandline (`xxd`, `python`, CyberChef), so a night is **prose + files + a flag box** and nothing
else. That is a deliberate difficulty step, not an omission — the pitch is that by FNAC they should be
reaching for tools rather than being handed one.

**The gate is no longer a cookie.** It asks the shared confetti engine (`window.fxModuleComplete`), the only
thing that knows each module's puzzle count, and opens only when **Caesar, XOR and Encoding are all
complete**. The old `ctf-fnac-unlocked` cookie is deliberately **not** honoured — it meant "Encoding is done",
now one third of the requirement, so reading it would grandfather people past Caesar and XOR; stale copies are
inert. The konami bypass therefore rides on its own cookie name (`ctf-fnac-bypass`) that no old browser can
already be carrying. The locked screen lists all three with ✓ / `n/t` progress, and each unfinished module is a
link whose click also **repairs** that module's entry in the engine's cross-module index — which is how someone
who finished a module before the gate existed gets counted. See the ⚠️ at the top: XOR cannot currently be
completed, so in practice the gate is konami-only.

**The gate is an overlay, not a replacement.** It used to do `app.innerHTML = lockedMarkup()`; the module now
renders always and the locked board sits on top of it as a fixed panel, with `#app` marked `inert` and the
document scroll-locked while it is up. That is presentation, not protection — the flags are in the page source
either way. The reason for the change is that on the **first** load after all three beginner modules are done,
the board falls off: one top corner releases at random, it swings from the other as a compound pendulum, and
the second corner goes after one full swing plus a small random extra so it sometimes spins away. Clicking it
while it is loose adds an upward impulse plus a sideways one whose direction is a fresh coin flip, additive
and with no hit limit, so it can be juggled and can also be knocked off the side. It plays **once ever**
(`localStorage['ctf-fnac-reveal:v1']`, set the moment the first corner goes, because juggling has no end);
`prefers-reduced-motion` skips the physics; konami takes the board off with no animation. The whole drop
measures **0 WCAG flashes/sec** at every probe with a whole-screen excursion of 0.0010 — the board is `--panel`
over a `--bg` page, so board-to-module is a 0.0124 (4×4) / 0.0358 (8×8) worst-tile step against WCAG's 0.10
transition threshold, which is why juggling it at any speed still cannot produce a flash.
`verify_fnac_module.mjs` drives the simulation through `window.__reveal` rather than looking at pixels, and its
four "locked means zero `.stage` elements" assertions were rewritten (they pinned the old structure and would
have failed on a correctly locked page) to assert coverage, opacity, `inert`, scroll-lock and real Tab presses.

- **Night 1 · Meta Parts** — `night1-a.png` / `night1-b.png`, two noise PNGs with flag halves appended after
  `IEND`. Flag `flag{tune_into_the_static}` (unchanged from the old "Static" night; only the title and
  filenames moved).
- **Night 2 · Bit Weaving** — `night2-a.bin` / `night2-b.bin`, 2725 bytes each. Weave them and you get a
  trollface PNG followed (past `IEND`) by an etymology-of-"hexadecimal" easter egg. **The flag is in the
  PICTURE, not in the bytes**: `flag{data_bender}` is *painted into the bottom-left corner pixels* by the
  builder, which asserts it is absent as a byte string from the source and from both halves, and that
  `flag{` never appears either. `strings`/`grep` on the reassembled file therefore finds the easter egg and
  nothing else — you have to open the image. Flag `flag{data_bender}`.
  **The split convention is the whole puzzle** (`fnac_png.bit_split` / `bit_weave`): bits within a source byte
  are numbered 7 (MSB)…0 (LSB); **half a takes the even bits in the order 6, 4, 2, 0**, **half b the odd bits
  7, 5, 3, 1**; each source byte contributes one nibble to each half; nibbles are packed **MSB-first in source
  order** (source byte 0 → high nibble of output byte 0, source byte 1 → low nibble of output byte 0, …); each
  half is `ceil(len/2)` bytes. An odd-length source zero-pads the final low nibble and loses its own length,
  so the builder pads to an **even-length source** and asserts `bit_weave(bit_split(x)) == x`.
- **Night 3 · Triple T** — `night3-a.txt`, 86 bytes of repeating-key XOR, key `tung tung tung sahur`
  (20 bytes). Plaintext: `i said one more video three hours ago. its 3am now.   flag{stop_scrolling}  go to bed.`
  Flag `flag{stop_scrolling}`.
  **Rebuilt 2026-08-15 into a real crib-drag.** The flag now sits at **offset 54**, not 0. At 0 a `flag{`
  crib landed first try and there was nothing to search, so the night was a "guess the key" puzzle wearing
  a crib costume. 54 % 20 = **phase 14**, the phase where the crib recovers `" sahu"`, which the vendored
  `hint-sahur.webp` completes. Phase 15 (the full `sahur`) is **impossible** — the `l` of `flag` lands
  under the key's `a` and XORs to `0x0d`. Sweeping all 86 offsets gives exactly one meaningful hit.
  Any rewrite must keep `flag{` at an offset ≡ 14 (mod 20) and dodge every (character, key-phase) pair
  that XORs to CR/LF or ≥ `0x80`; the double spaces are those phase shifts. The builder asserts all of it,
  and `verify_fnac_module.mjs` now pins the new intent (it previously asserted the flag was **at offset 0**,
  i.e. it defended the broken design).
  The ciphertext is fetched as an `arrayBuffer` and latin-1 decoded, never `.text()`, so the block on
  screen is byte-for-byte the downloaded file. The brief closes on the author's line,
  "I toss and turn in my Crib, sleepless...".

**Intro scare sequence.** Fires at most once per person, on a 1-in-5 roll per visit, on the first *tap*
(a tap grants audio autoplay permission; a scroll does not). Flicker → dark hold → eyes → lights-on, with
trimmed audio (`flicker` / `scare` / `lights-on`). Typing **`scary`** arms the next click as a guaranteed
scare — and typing in a flag field never arms it, because someone entering a flag is not asking for a jump
scare. Photosensitivity: the page background is already `#000000`, so the excursion is inherently tiny, but it
is measured anyway by `tools/verify_fnac_flash_safety.mjs`. Every flicker cycle is **750 ms** (2.67
transitions/sec under this repo's conservative every-opposing-transition-counts convention); the first cut used
400 ms and *measured* 6/sec — the measurement set the number. Every held state is ≥ 330 ms so a ~30 Hz sampler
cannot miss an extreme. `prefers-reduced-motion` skips the flicker entirely.

Assets: `tools/build_fnac_assets.py` + `tools/fnac_png.py` → `public/crypto/fnac/assets/**`. The directory is
now ~468 KB, nearly all of it the three creep audio files — which the builder **trims with ffmpeg stream-copy**
(no re-encode, `-map_metadata -1 -fflags +bitexact` so re-runs are byte-identical) to exactly the span the page
actually plays, because everything past the JS hard-stop was being uploaded and pulled down by every student's
phone to be discarded. The builder is idempotent and its `_clean()` **deletes** any file a night no longer
ships. Source media live in the repo-root `fnac-assets/`; `fnac-assets/cats/` (10 JPGs) is unreferenced since
the Night 3 rewrite — left on disk pending a call.
Tests: `tools/verify_fnac_module.mjs` (end-to-end, real pointer/keystrokes, real autoplay policy) and
`tools/verify_fnac_flash_safety.mjs`. **Neither is in `run_suite.mjs`** — run them by hand with
`FNAC_MODULE_URL="http://localhost:<port>/public/crypto/fnac/"`.
Text fallbacks: `worst-case/text-challenges/fnac/{static,raw-bit-weaving,tung-tung-tung-sahur}/`.

## Shared — victory confetti engine (`public/crypto/confetti/`)
`engine.js` + `manifest.js` + 20 meme sprites (incl. generated suss-imposter), built by `tools/build_confetti.py`.
Each user gets ONE signature effect per module (cookie-seeded, unique per person + per module). Confetti is the
**module-completion reward** — fires only once EVERY puzzle in the module is solved (drives tutoring). Progress
**persists** in `localStorage` (`ctf-solved:v2:<module>`).

**Shared header button row — landed on all five pages** (`ceasar`, `encoding`, `hash`, `xor`, `fnac`): three
inline-SVG icon buttons in the kicker (reset module progress / replay confetti, locked→gold star once the
module is complete / theme), replacing the old bottom reset rows and the REPLAY button the engine used to
inject. The engine now exposes a **completion API** the pages drive instead: `fxIsComplete()`, `fxReplay()`,
`fxSolvedSet()`, `fxReset()`, plus an `FX_NO_PUZZLES` flag for pages with no puzzles at all (the hash module
sets it, so "complete" is declared rather than inferred from `FX_TOTAL === 0`).

**Cross-module completion index.** The engine also mirrors each module's completion into a shared
`localStorage['ctf-complete:v1']` index and exposes `fxModuleComplete(id)` / `fxModuleProgress(id)` — the
`{c,n,t}` a *different* page can read. This is what FNAC's gate is built on, and it is the only place that
knows any module's puzzle count.

## Module 103 · XOR & Binary — LIVE (`public/crypto/xor/index.html`)
Titled **"this xor that"**. Rebuilt end to end on 2026-08-15 against the author's dictated copy
(`docs/authors-original-copy.md`). Frame: *the keystream is the weakness.* Plain language
(encrypted/decrypted/lock/unlock, "scrambled message" — never cipher/plaintext/recovered).

Header explains binary place values (2⁰..2³, "no 8, yes 4, yes 2, no 1"); the info block opens with the
red ℹ glyph like its siblings and explains mixing/unmixing. **Every byte display on the page carries a
HEX / BINARY / TEXT toggle** via one shared `fmtToggle(el, bytes, render?, modes?)` helper.

- **Demo** (unscored) — gate toy + two-column LOCK/UNLOCK, single character, tap the red key bits.
  The truth table drops below the bit buttons at ≤430px. ✅
- **C1 · Brute Force** — 1-byte key `0x37`, flag `flag{brute_force_me}`. Reading order is hex dump →
  **apply-a-key box** → "try a few yourself, then brute force it" → BRUTE FORCE button → the 256 rows.
  The key box takes **a character or its hex**, each box mirroring the other (non-printable bytes render
  into the character box; the hex box stays authoritative). Rows fill with a per-row `animation-delay` of
  `k*10ms`, so all 256 land in ~2.56s, with a half-second heat fade; `prefers-reduced-motion` fills
  instantly. Rows stay in **key order — never sort by readability**. The `0x17` case-flip twin
  (`FLAG[BRUTE·FORCE·ME]`) is the deliberate decoy. No hint box, no crib filter, no decode animation. ✅
- **C2 · Crib the Key** — repeating key `cat`, flag `flag{repeating_xor_key}`. Crib starts empty. Cells
  stack **key / message / hex** top to bottom, key on red, message on light, with a static worked-example
  legend to the right of the crib box. No hint box. ✅
- **C3 · Reuse, Recycle** — key reuse. p1 `you got it right! flag{compost!}`, p2
  `waltzing matilda, waltzing matilda`, key `PURPLEHAZE`, flag **`flag{compost!}`**.
  **`build()` returns the flag explicitly, not `p1`** — p1 has an 18-character prefix and returning it
  would make the card unsolvable. That prefix is load-bearing: it puts `flag{` at **offset 18**, and
  `waltzing matilda, ` is also 18 characters, so the crib at 18 reveals **`waltz`** while offset 0 gives
  `hbx3f`, a visible dead end. A static K1/M1 ⊕ K1/M2 = M1/M2 diagram sits under the intro; the two
  scrambled boxes now stack with ⊕ and = into the combined box (the old COMBINE button is gone) and the
  crib-drag is always visible. ✅
  ⚠ **The hint still hands over the crib phrase** ("that runner-up's name — sung twice over. Type it into
  the crib and slide it along"), which skips the mechanism the offset was engineered to force. Flagged
  twice, not yet cut. The 1977 anthem facts in it are sourced and correct.
- **C4 · Brute Force 2** — 3-**byte** key **`T4x`** ("death and taxes" → singular → leetspeak), plain
  `the long key is really many tiny keys flag{stacked}`, flag `flag{stacked}`. Three knobs **stacked
  vertically**, one per key position, each with ±1/±16 steppers, a slider and a typed field; the three
  previews merged into one window above with a HEX/TEXT toggle; sliders carry the same red/yellow/green
  as the characters they control (`--k0/--k1/--k2`, lifted in dark theme for contrast). Node-verified:
  137,700 all-printable keys, **exactly one** letters-only key, `T4x` ranked #1. Known near-miss: `0x20`
  flips case, so `t4x` reads as near-English but its flag `fLag[stAckEd}` will not submit.
  **The copy says byte, not bit** — the author's dictation said "3 bit key", which would be 8
  possibilities; it is 3 bytes = 16,777,216, and the demo two cards earlier teaches that a letter is 8 bits. ✅

**Engine wiring:** `FX_MODULE='xor'`, `FX_TOTAL=4`, ids `c1`–`c4` in `VALID`, store `ctf-solved:v2:xor`.

⚠ **`worst-case/` has never had C4.** `worst-case/text-challenges/xor/` holds only `brute-force`,
`crib-the-key`, `same-key-twice`. C3's flag also changed (`flag{same_key_twice}` → `flag{compost!}`) and
its messages changed, so that mirror is now wrong as well as incomplete, and nothing tests it.

## Conventions
- One static HTML file per module under `public/crypto/<name>/`; all JS client-side; flat `warm-editorial-ui` skin.
- Deploy: `cd /Users/gaura/PCAN/ceasar-ctf && npx wrangler deploy` (needs `wrangler login`; CF MCP is read-only).
- Verify UI with **real pointer clicks** (Chrome MCP / Playwright), not synthetic events. Precompute heavy assets
  in Python (`.venv/bin/python` — global python is broken).
- Repo **is** under git now (init 2026-06-25). Commit before large edits.
- **Deploy state.** Production is `ctf.sandhi.com.au`. **`master` is the trunk, it is pushed, and it is what
  is deployed** — the old `feat/caesar-rewrite-fnac-nights` branch is fully contained in master (0 commits
  ahead) and retired. Everything in this file is live as of 2026-08-15.
  ⚠ **`npx wrangler deploy` ships the working tree, not `HEAD`.** Check `git status` before deploying, or a
  subagent's half-finished edit goes to production. Verify after deploying with
  `curl -sL https://ctf.sandhi.com.au/crypto/<mod>/ | md5` against `md5 -q public/crypto/<mod>/index.html`
  (a direct `.../index.html` fetch 307s to the trailing slash and returns an empty body, which looks like a
  failed deploy and isn't).
- **Writing copy: read `docs/voice-guide.md` first.** The author rejected a batch of AI prose on 2026-08-15.
  His verbatim dictation is `docs/authors-original-copy.md` (source of truth for voice) and
  `docs/prose-accounting.md` says which strings on each page are his and which are generated.

## Open / todo

**Waiting on the user**
- [x] ~~Multi-page feedback on the older modules~~ — it arrived and has been implemented across Modules 1
      and 2 (see those sections). XOR (Module 4) has not had a feedback pass.
- [x] ~~Visual pass on Modules 1/2~~ — substantially done: redundant inline text boxes removed, presenter
      copy written, affine number-line rebuilt, hint boxes pruned in Encoding.
- [ ] **Swap placeholder reward URLs** (rickrolls) in the Caesar `REWARDS` map for real meme links —
      **still placeholder.** `flag{affine_ace}` currently opens a rickroll.
- [ ] **Decide on `fnac-assets/cats/`** — 10 source JPGs, unreferenced since the Night 3 rewrite. Keep or delete.

**Housekeeping owed**
- [ ] **Regenerate `worst-case/launch_offline.py`** (`.venv/bin/python tools/build_offline_launcher.py`) — it
      embeds copies of the module pages and is stale for **every** page on this branch. The shared header row
      has now landed everywhere, so the blocker on this is gone: run it.
- [ ] **Refresh or placeholder the static `.plate` ciphertexts** for Caesar IV and VI — they still encode the
      retired `flag{Safe_Cracker}` / `flag{affine_code}` plaintexts (`zfua{Muzy_Wluweyl}`,
      `hlim{ihhwvc_saxc}`). Cosmetic (overwritten at mount by `encodeFor`) but wrong in view-source.
- [ ] The offline launcher still excludes FNAC on a ~7 MB size rationale that no longer holds. FNAC is now
      ~468 KB — bigger than the ~92 KB figure some older notes quote, because of the creep audio, but still
      two orders of magnitude under the number the exclusion was sized against.

**Next build work**
- [x] ~~**Module 4 XOR: build C4**~~ — built, reworked as "Brute Force 2" with key `T4x`, and **deployed**.
- [ ] ⚠️ **Cut the generated filler prose**, page by page, per `docs/prose-accounting.md`. The directory's five
      card blurbs and Caesar's call-to-action block are done. Still to go: Caesar's injective/number-line
      paragraphs, every caption on the hash page, XOR's labels and C2's CyberChef note, and **C3's hint, which
      gives away the crib phrase**. Most of it should be deleted rather than rewritten.
- [ ] **Rewrite FNAC Night 3's plaintext in the author's voice.** The current text is serviceable but was
      written to fit the offset maths, not chosen. Constraint: `flag{` at an offset ≡ 14 (mod 20), no
      (character, key-phase) pair XORing to CR/LF or ≥ `0x80`.
- [ ] **Encoding search-space info panel** and **FNAC physics unlock reveal** — both dispatched 2026-08-15,
      landing state unknown at the time of writing. Check `public/crypto/encoding/index.html` and
      `public/crypto/fnac/index.html` before rebuilding either.
- [ ] **Leaderboard** — wanted, with a complete/incomplete achievement card per module. **Blocked on
      architecture, not storage**: every flag is validated client-side and readable in page source, so a
      leaderboard on today's build is scoreable by view-source. Needs flags moved to server-side SHA-256
      comparison in the Worker first. D1 + `PRIMARY KEY (team, challenge)` + a Cloudflare rate-limit rule is
      the easy half. Note the design tension: confetti fires on module completion to drive tutoring, a
      leaderboard rewards speed and hoarding.
- [ ] **Decoding 102** — a follow-on module teaching `file` / magic bytes / `xxd` / `strings`. Logged in
      `docs/ideas-backlog.md` with the incident that motivated it.
- [ ] **Improve C2's cribbing explanation.** It was the wall in the first live session, and C3 and FNAC
      Night 3 both inherit the gap.
- [ ] **Desktop micro-themes for the Hashing page** — designed and researched, NOT built. Skin the
      MD5 panel as Windows 95 and the SHA-3 panel as Windows 7, framed by a fake Proxmox top bar, so
      "old and busted vs modern" lands without a word. Full specs incl. exact colours, bevel
      construction, fonts and legal analysis: `docs/research/theme-1995-desktop.md` and
      `theme-2015-desktop.md`. **Two decisions the user should make before building:** (a) the CS5
      keygen joke — research recommends keeping the pirated-CS5 gag but dropping the literal
      warez-tool depiction, since this is school-distributed material for minors; (b) the
      Half-Life 3 `.zip.exe` gag is a genuine double-extension social-engineering lesson and should
      probably be promoted from set dressing to a real callout.
- [ ] **FNAC "lens" floating tool** — brainstorm PARKED mid-design with only Section 1 approved.
      Resume from `docs/superpowers/specs/2026-08-12-fnac-lens-tool-design.md`, which lists exactly
      what's decided and what isn't. Don't restart the design from scratch.

**Hashing module — known gaps** (detail in the Module 3 section above)
- [ ] ⚠️ **Run `node tools/run_suite.mjs --all` once before the event.** The luminance-excursion bound was
      failing (0.0778–0.0886 vs 0.07) on the pre-blur page; a targeted probe on the shipped build reads
      0.046–0.049 on that exact case, but no full run has confirmed it. Believe the run.
- [ ] Lane-grouping drift after round 0 (currently tagged `[ANALOGY]` rather than claimed accurate).
- [ ] Surface the absorb-padding lesson — the lone bright cube is `0x80` and nothing says so.
- [ ] Optional: rename `keccak256WithTrace` (it computes SHA3-256, not pre-standard Keccak-256).

**Ideas parked in `docs/ideas-backlog.md`** (not scheduled)
- Trophy wall + rarity tiers; hash-of-file-as-key challenge; ρ-rotation-as-colour-gradient;
  the trollface → QR-polyglot → Snake puzzle box (needs its own research pass on whether a max-size
  QR can even carry a runnable Snake, and on making the win-condition key unforgeable).
