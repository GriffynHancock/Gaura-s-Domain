# STATUS — Crypto 101 CTF prep

_Single source of truth. Updated as we go. Full plan: `docs/superpowers/specs/2026-06-24-crypto-curriculum-design.md`. Context: `CLAUDE.md`._

## In one line
Projected, presenter-led web modules (~60 min) teaching teenagers crypto before a national CTF.
Spine: **recognise → identify → decode/crack → submit.**

## Modules
| # | Module | State | URL / path |
|---|--------|-------|-----------|
| 1 | ROT / Caesar (+ Vigenère + Affine) | ✅ **live** | `ctf.sandhi.com.au/crypto/ceasar` |
| 2 | Encoding | ✅ **live** | `ctf.sandhi.com.au/crypto/encoding` |
| 3 | Hashing | ✅ **live** | `ctf.sandhi.com.au/crypto/hash` |
| 4 | XOR | 🚧 **in progress** (demo+C1–C3 done, C4 left, not deployed) | `public/crypto/xor/` → `/crypto/xor/` |
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

## Module 1 — Caesar set (live, `/crypto/ceasar`) — 6 puzzles
Dial instrument(s) + alphabet slide-rule + dark mode + solved-ticks. Ramp:
- I–IV **Caesar** (single shift dial) — easy openers.
- V **Two Tones** — alternating **Vigenère** (2 dials: odd/even letters). Forces you to line up an `f`.
- VI **Multiply & Slide** — **Affine** `a·x+b` (× dial + + dial). Genuinely hard without the riddle.
- (Three Wheel / Vigenère-3 was built then **removed** — didn't land.)
- **Per-user randomized answers**: every dial's key(s) derive from the `ctf-uid` cookie (FNV hash); the flag is
  re-encoded in-browser, so each student dials different numbers / sees different ciphertext (anti shoulder-surf).
  Flags (the plaintext, constant): `flag{G}`, `flag{Bee}`, `flag{Caesar_Salad}`, `flag{Safe_Cracker}`,
  `flag{two_tones}`, `flag{affine_code}`. The *keys* differ per user.
- **Affine number-line visual** (`buildNumberLine`): stretch ×a → fold every 26 → collapse to output line;
  coprime = clean fan, shared factor = oxblood `×N` collision rings = no inverse. Smoothing-follow animation
  (eases toward target each frame — no held-knob stutter). Owns the **riddle** (top-center, cryptically encodes
  this user's `a`) and the **Guardrail** toggle (top-right; off = hard mode, no collision warning).
- **Slide rule:** fluid percentage tape (1 alphabet window, 3-alphabet strip), CSS-transition slide, **seamless
  0↔25 wrap** (`setTape` repositions across identical copies invisibly).
- **Bonus unlocks:** solving VI reveals a bonus code (`flag{affine_ace}`) → UNLOCK panel maps codes → reward
  URLs (currently **placeholder rickrolls — swap real meme URLs** in `REWARDS`). Persisted in localStorage.

## Module 2 — Encoding (live, `/crypto/encoding`) — 9 puzzles
Click-to-build decode pipeline; **method tiles shuffle per card/refresh**; preview **TEXT ⇄ IMAGE** (resizable);
type-the-flag SUBMIT; solved-tick; dark mode; resizable blob window. Methods: `base64 hex url rot13 rot47 atbash`
(rot13/atbash pure distractors; url real in IV then distractor). Decoders never throw.
Ramp: I base64 · II base64→image · III hex · IV url · V image-hides-text (sting) · VI base64→hex ·
VII base64→rot47→hex (3-layer) · **VIII Two Faces** (one blob: `hex`→exact flag PNG, `base64`→painted trollface —
a real dual-image polyglot) · IX red-herring (`base64→atbash`; `florg{}`/`glaf{}`/`glorf{}` decoys).
Assets: `tools/build_base64_assets.py` (Pillow) → `public/crypto/encoding/assets.js`. Real cha-ching SFX
(`chaching.mp3`) on the V sting. Solve-paths/authoring guide: `docs/superpowers/module2-solve-paths.md`.

## Shared — victory confetti engine (`public/crypto/confetti/`)
`engine.js` + `manifest.js` + 20 meme sprites (incl. generated suss-imposter), built by `tools/build_confetti.py`.
Each user gets ONE signature effect per module (cookie-seeded, unique per person + per module). Confetti is the
**module-completion reward** — fires only once EVERY puzzle in the module is solved (drives tutoring). Progress
**persists** in `localStorage` (`ctf-solved:v2:<module>`); **★ REPLAY** button appears beside the theme toggle on
completion; two-step **RESET MODULE** button (below footer) clears a module's progress.

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

Then **Module 3 Hashing** (SHA-256 avalanche + crack weak MD5 via embedded table).

## Conventions
- One static HTML file per module under `public/crypto/<name>/`; all JS client-side; flat `warm-editorial-ui` skin.
- Deploy: `cd /Users/gaura/PCAN/ceasar-ctf && npx wrangler deploy` (needs `wrangler login`; CF MCP is read-only).
- Verify UI with **real pointer clicks** (Chrome MCP / Playwright), not synthetic events. Precompute heavy assets
  in Python (`.venv/bin/python` — global python is broken).
- Repo **is** under git now (init 2026-06-25). Commit before large edits.

## Open / todo

**Waiting on the user**
- [ ] **Multi-page feedback on the older modules** — the user said they were writing structured
      (XML-tagged) feedback on Modules 1/2/4. It had not arrived when the session ended. Ask for it.
- [ ] **Visual pass** — remove redundant inline text boxes, insert real presenter copy (Modules 1/2).
- [ ] **Swap placeholder reward URLs** (rickrolls) in the Caesar `REWARDS` map for real meme links.

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
