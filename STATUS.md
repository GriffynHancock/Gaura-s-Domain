# STATUS — Crypto 101 CTF prep

_Single source of truth. Updated as we go. Full plan: `docs/superpowers/specs/2026-06-24-crypto-curriculum-design.md`. Context: `CLAUDE.md`._

## In one line
Projected, presenter-led web modules (~60 min) teaching teenagers crypto before a national CTF.
Spine: **recognise → identify → decode/crack → submit.**

## Modules
| # | Module | State | URL / path |
|---|--------|-------|-----------|
| 1 | Encryption 101 — ROT / Caesar (+ Vigenère + Affine) | ✅ **live** | `ctf.sandhi.com.au/crypto/ceasar` |
| 2 | Encoding is not encryption | ✅ **live** | `ctf.sandhi.com.au/crypto/encoding` |
| 3 | Hashing | ✅ **live** | `ctf.sandhi.com.au/crypto/hash` |
| 4 | XOR | 🚧 **in progress** (demo+C1–C3 done, C4 left, not deployed) | `public/crypto/xor/` → `/crypto/xor/` |
| ★ | **Five Nights at Crypto's** (bonus, gated behind Module 2) | ✅ **live** (nights 1–3 real, 4–7 placeholders) | `ctf.sandhi.com.au/crypto/fnac` |
| — | Live Kali demo (CyberChef + archive crack) | ⬜ presenter prep | n/a |

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
WCAG 2.3.1's 3 flashes/second — worst constructible case measures 0 flashes/sec. It honours
`prefers-reduced-motion`. **This is safety-critical for a room of teenagers: do not weaken it.**

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

### Test suite — 16 scripts in `tools/`, run them all before merging anything
`test_md5_trace` · `test_keccak_trace` · `verify_task3_lane_grid` · `verify_task4_sha3_animation` ·
`verify_task5_md5_registers` · `verify_task6_block_stack` · `verify_task7_input_box` ·
`verify_task8_collision` · `verify_task9_full_integration` · `verify_task_wiggle_juice` ·
`verify_flash_safety` · `verify_sha3_aliasing` · `verify_step_through` · `verify_sha3_touch_drag` ·
`verify_pi_pacing`

The two `test_*` are pure Node (digest parity + trace schema). The rest are Playwright and need a
served page: `HASH_MODULE_URL="http://localhost:<port>/public/crypto/hash/"`. **Read the serving
gotcha in `CLAUDE.md` first** — testing a stale checkout has produced a convincing *fake* failure
more than once. `verify_flash_safety` is slow (~4 min) and is the one that must never be relaxed.

### Known gaps / deliberately parked
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
  warning.
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
**Only VIII has a hint box** — VI, VII and IX had theirs removed on purpose.
- **V's sting** (real cha-ching SFX, `chaching.mp3`) now fires only on the exact intended move:
  `pipeline === ['base64']` **and** the preview showing IMAGE. Any other route to the flag is silent.
- **VIII** gained a URL-encoded tail pad (`?q=%4e%60.ref=…`). Its blob used to end in a long run of `/` right
  after the flag-PNG hex, so scrolling the raw string to the bottom shouted "hex". The pad is not free — it
  passes through both decoders, so `url_pad()` pins three invariants (pad-char residue `R % 4 == 0`, `R <= 192`
  so the base64 face still lands on a 48×48 grid, and a hex tail of exactly `Rh//2` bytes). Current: `R=176`,
  74 bytes after the PNG's `IEND`. It also baits `url` as a third wrong answer.
- **IX is three layers: `base64 → rot47 → atbash`.** ⚠ **Do not reorder these back.** The first shipped version
  was `base64 → atbash → rot47`, and that order has a *structural* near-miss: the natural two-layer guess
  `base64 → rot47` then computes `rot47(atbash(rot47(plain)))`, and lowercase `a`–`o` rot47 to `2`–`@`, which
  atbash leaves untouched — so the second rot47 returns them exactly. ~58% of the alphabet is invariant under
  the wrong order for **any** English payload, meaning the wrong guess yields a near-readable fake flag. No
  amount of regenerating the blob fixes it; it is a property of the two ciphers, not of this plaintext. With
  rot47 outermost the same wrong guess stops cleanly at `atbash(plain)`, which points *at* the atbash tile.
  The builder asserts `base64 → atbash → rot47` does **not** solve, so the check proves the order.
Assets: `tools/build_base64_assets.py` (Pillow) → `public/crypto/encoding/assets.js`.
Solve-paths/authoring guide: `docs/superpowers/module2-solve-paths.md` (current — reflects all of the above).
Clearing every puzzle here sets the `ctf-fnac-unlocked` cookie and reveals the FNAC banner link.

## Bonus — Five Nights at Crypto's (live, `/crypto/fnac`)
File-forensics bonus module, deployed. **Gated:** the page renders only if the `ctf-fnac-unlocked` cookie is
set, which Module 2 sets on full completion (also set on load if Module 2 is already complete from a past
session — that was a real bug). A konami code unlocks it the same way. Seven stages; **nights 1–3 are real,
4–7 are placeholders** (`ready:false`, dimmed). `FX_TOTAL = 7`, so module-completion confetti cannot fire until
the placeholders become real. Each night ships an on-page tool standing in for a Kali utility.
- **Night 1 · Static** — two noise PNGs, flag halves appended after `IEND`. Tool: RAW BYTES (stands in for
  `xxd`). Flag `flag{tune_into_the_static}`.
- **Night 2 · Raw Bit Weaving** — a rage-face PNG (flag appended after `IEND`) split **at the bit level** into
  `file-a.bin` / `file-b.bin`, neither of which opens or contains `flag{`. Tools: RAW BYTES + WEAVE.
  Flag `flag{raw_bit_weaving}`, at offset `0x0dd6` of the 3588-byte reassembled file.
  **The split convention is the whole puzzle, and the in-page JS weave tool must stay the exact inverse of
  `fnac_png.bit_split`:** bits within a source byte are numbered 7 (MSB)…0 (LSB); **file-a takes the even bits
  in the order 6, 4, 2, 0**, **file-b the odd bits 7, 5, 3, 1**; each source byte thus contributes one nibble to
  each half; nibbles are packed **MSB-first in source order** (source byte 0 → high nibble of output byte 0,
  source byte 1 → low nibble of output byte 0, …); each half is `ceil(len/2)` bytes. An odd-length source
  zero-pads the final low nibble and loses its own length, so `build_fnac_assets.py` asserts an **even-length
  source** (tuned via `pad_after`) to keep the weave an exact inverse.
- **Night 3 · Tung Tung Tung Sahur** — `message.txt`, 118 bytes of repeating-key XOR, key `tung tung tung sahur`
  (20 bytes). The plaintext starts with the flag, so a `flag{` crib at offset 0 recovers `tung ` and the
  vendored hint image (`hint-sahur.webp`, 31 KB, downloaded not hotlinked) supplies the rest of the name.
  Tool: XOR BENCH (stands in for `xortool`/CyberChef). Flag `flag{tung_tung_tung_sahur}`.
  The ciphertext is asserted 7-bit and CR/LF-free so it survives a text-mode transfer; it *does* contain nine
  NUL bytes (the flag repeats the key's own words) which transfer verbatim.
Assets: `tools/build_fnac_assets.py` + `tools/fnac_png.py` → `public/crypto/fnac/assets/**` (~60 KB total).
The builder is idempotent and its `_clean()` **deletes** any file a night no longer ships. Source images live in
the repo-root `fnac-assets/`; `fnac-assets/cats/` (10 JPGs) is now unreferenced — left on disk pending a call.
Text fallbacks: `worst-case/text-challenges/fnac/{static,raw-bit-weaving,tung-tung-tung-sahur}/`.

## Shared — victory confetti engine (`public/crypto/confetti/`)
`engine.js` + `manifest.js` + 20 meme sprites (incl. generated suss-imposter), built by `tools/build_confetti.py`.
Each user gets ONE signature effect per module (cookie-seeded, unique per person + per module). Confetti is the
**module-completion reward** — fires only once EVERY puzzle in the module is solved (drives tutoring). Progress
**persists** in `localStorage` (`ctf-solved:v2:<module>`); a two-step **RESET MODULE** control clears a module's
progress, and a replay control re-fires the effect once the module is complete.
⚠ **In flight:** those two controls are being migrated into a shared icon button row in the page header
(reset / confetti lock→star / theme, inline Lucide-style SVG, bottom reset rows deleted, engine gaining a
completion API instead of injecting its own REPLAY button). FNAC already has the new row; the other pages are
mid-migration. Re-check this paragraph against the pages once that lands.

## Module 4 · XOR — IN PROGRESS (`public/crypto/xor/index.html`)
**Full handoff + remaining work: `docs/2026-06-26-module4-xor-spec.md` (v2) — read it before touching this.**
Rebuilt from a v1 that was "demos in costume". Frame: *the keystream is the weakness.* Plain language
(encrypted/decrypted/lock/unlock, "scrambled message" — NOT cipher/plaintext). Local: `python3 -m http.server 8787`
→ `http://localhost:8787/public/crypto/xor/` (append `?v=N` to bust cache). **Not deployed yet — deploy only on user go.**

- **Demo** (unscored) — gate toy + two-column LOCK/UNLOCK. Key on top; result readout on top in plain text with
  TEXT|HEX toggle. Animation = two passes: message bits **drop in**, pause, key-on bits **flip**; encrypted result
  **pipes** to column ② after a 1 s beat; same key unlocks back. ✅ done+verified.
- **C1 · Brute Force** — 1-byte key hidden; 256 decodes listed **in key order (NOT sorted — spotting is the skill)**
  + a student-driven crib **filter**; hex+text dump; type key as char or hex. The `0x37`/`0x17` twin (XOR-by-`0x20`
  = case flip) is the **decoy lesson** (pick lowercase `flag{`). ✅ done+verified.
- **C2 · Crib the Key** — repeating key, hidden; student types the `flag{` crib, recovered bytes spell the repeat
  (`c a t c a` → `cat`); CyberChef-can't-do->2-byte-keys note. ✅ done+verified.
- **C3 · Same Key Twice** (boss) — two reused-key blobs; COMBINE cancels key → `m1⊕m2`; crib-drag slider reveals the
  other message; full sentence drag peels the flag. ✅ done+verified.
- **C4 · Long Key, Many Keys** — ⬜ **LAST TODO. Design decided: 3-byte LIVE TUNER** (three byte-knobs, whole
  message re-renders live, tune until the full sentence reads — NOT per-column brute lists, which can't be eyeballed).
  Content node-verified (see spec): plain `the long key is really many tiny keys flag{stacked}`, key `sun` (len 3,
  given), flag `flag{stacked}`. Embodies the lesson: a long key = 3 single-byte knobs.

**Engine wiring:** `FX_MODULE='xor'`, `FX_TOTAL=4`, `fxSolved(id)` per capture; engine bakes store key
`ctf-solved:v2:xor`. Card framework = `addCard({id,title,sub,intro,hint,build})`; `build(ctx)` wires bespoke body
into `ctx.work` and **returns the flag string**. IDs `c1`–`c4` in `const VALID`; stale ids are pruned on load
(can't bump store to v3 without editing the shared engine). **Node-verify every attack before wiring UI.**

## Conventions
- One static HTML file per module under `public/crypto/<name>/`; all JS client-side; flat `warm-editorial-ui` skin.
- Deploy: `cd /Users/gaura/PCAN/ceasar-ctf && npx wrangler deploy` (needs `wrangler login`; CF MCP is read-only).
- Verify UI with **real pointer clicks** (Chrome MCP / Playwright), not synthetic events. Precompute heavy assets
  in Python (`.venv/bin/python` — global python is broken).
- Repo **is** under git now (init 2026-06-25). Commit before large edits.

## Open / todo

**Waiting on the user**
- [x] ~~Multi-page feedback on the older modules~~ — it arrived and has been implemented across Modules 1
      and 2 (see those sections). XOR (Module 4) has not had a feedback pass.
- [x] ~~Visual pass on Modules 1/2~~ — substantially done: redundant inline text boxes removed, presenter
      copy written, affine number-line rebuilt, hint boxes pruned in Encoding.
- [ ] **Swap placeholder reward URLs** (rickrolls) in the Caesar `REWARDS` map for real meme links —
      **still placeholder.** `flag{affine_ace}` currently opens a rickroll.
- [ ] **Decide on `fnac-assets/cats/`** — 10 source JPGs, unreferenced since the Night 3 rewrite. Keep or delete.

**Housekeeping owed after the current branch**
- [ ] **Regenerate `worst-case/launch_offline.py`** (`.venv/bin/python tools/build_offline_launcher.py`) — it
      embeds copies of the module pages and is stale for every page rewritten on this branch. Run it once the
      shared header row has landed on all pages, not before.
- [ ] **Refresh or placeholder the static `.plate` ciphertexts** for Caesar IV and VI — they still encode the
      retired plaintexts. Cosmetic (overwritten at mount) but wrong in view-source.
- [ ] The offline launcher still excludes FNAC on a size rationale that no longer holds (~92 KB now, not 7 MB).

**Next build work**
- [ ] **Module 4 XOR: build C4** — the last challenge. Spec'd + content node-verified in
      `docs/2026-06-26-module4-xor-spec.md`. Then user playtest → deploy. XOR is still undeployed.
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
- [ ] Lane-grouping drift after round 0 (currently tagged `[ANALOGY]` rather than claimed accurate).
- [ ] Surface the absorb-padding lesson — the lone bright cube is `0x80` and nothing says so.
- [ ] Optional: rename `keccak256WithTrace` (it computes SHA3-256, not pre-standard Keccak-256).

**Ideas parked in `docs/ideas-backlog.md`** (not scheduled)
- Trophy wall + rarity tiers; hash-of-file-as-key challenge; ρ-rotation-as-colour-gradient;
  the trollface → QR-polyglot → Snake puzzle box (needs its own research pass on whether a max-size
  QR can even carry a runnable Snake, and on making the win-condition key unforgeable).
