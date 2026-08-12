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
| 3 | Hashing | ⬜ planned | `public/crypto/hash/` (planned) |
| 4 | XOR | 🚧 **in progress** (demo+C1–C3 done, C4 left, not deployed) | `public/crypto/xor/` → `/crypto/xor/` |
| — | Live Kali demo (CyberChef + archive crack) | ⬜ presenter prep | n/a |

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
- [ ] **User: visual pass** — remove redundant inline text boxes, insert real presenter copy across both modules.
- [ ] **User: swap placeholder reward URLs** (rickrolls) in the Caesar `REWARDS` map for real meme links.
- [ ] **Module 4 XOR: build C4** (last challenge — spec'd + content node-verified), then user playtest → deploy.
- [ ] Module 4: optional — make C1 byte-decode show the `⊕ key` step explicitly (user flagged, left for now).
- [ ] (Optional) richer trollface / tune the Two Faces polyglot target if desired.
