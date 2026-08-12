# Module 4 · XOR — Spec (v2, rebuilt after playtest)

**Path:** `public/crypto/xor/index.html` → `/crypto/xor/`. Static, flat `warm-editorial-ui` skin.
Audience 12–18, presenter-led/projected. Plain language: **encrypted / decrypted / lock / unlock /
scrambled message** — NOT "cipher/plaintext/recovered".

## Framing (the spine)
One story: **the keystream is the weakness.** XOR is a stream cipher — the key is just a mask of bytes,
applied bit-by-bit (key bit 1 ⇒ flip, key bit 0 ⇒ keep). Each challenge attacks a different keystream
flaw: tiny keyspace → known/periodic → reused. The closer deflates the mystique: a long XOR key was
never a "real" key, just a stack of single-byte keys. Sets up hashing/encryption modules.

## v1 failure (why this is a rebuild)
v1 challenges were demos in costume: C1 handed you the key (type it in), C2 *narrated* the crib insight,
C3 handed you the key word. The solver did no attack. v2 makes the solver **perform** each attack.
Advisor confirmed the brute→crib→break spine and these mechanics.

## Demo (unscored) — "Lock It, Unlock It"
- Gate toy: one bit ⊕ one bit, truth table highlights live row. Frame as "key 1 flips, key 0 keeps".
- Two columns. **Key on top**, result readout **on top, plain text, with TEXT|HEX toggle**.
  - ① LOCK: message bits **drop** into the encrypted row; key bits that are **on drop on top and flip**
    those bits → encrypted. Result **pipes** into column ②'s encrypted input.
  - ② UNLOCK: same animation, **same key**, encrypted → decrypted == original message.
- Single character (8 bits). Tap red key bits to change the key. Animation cell-by-cell (~110ms stagger).
- Honest model (advisor): key-bit-on flips the bit below; flip twice with same key = original. That *is* XOR.

## Challenge ladder — demo + 4 scored, `FX_TOTAL=4`
All ciphertext shown as **hex** (real-CTF format). Plaintext computed in-browser from plain+key at load,
so always self-consistent. **No answer pre-highlighted** anywhere. Node-verify each attack before UI.

### C1 · Brute Force — single-byte XOR, find the key
- Hidden 1-byte key. Solver brutes 0–255; 256 rows **sorted by printability score** (% letters+space),
  solver scans for the readable one and picks it. Byte-by-byte XOR animation plays on the chosen key.
- Verify: exactly one key (the real one) yields all/мostly-printable output; ideally unique top score.
- Lesson: keyspace can be tiny — exhaustive search wins.

### C2 · Crib the Key — repeating-key, known plaintext
- Key = short word, hidden, **length ≤ crib length** so the crib exposes the whole key.
- Solver knows flag starts `flag{`. XOR the crib against the ciphertext start → recovered bytes
  `C[i]⊕P[i] = K[i mod L]` **spell the repeating key word**. Solver reads the key off, applies it.
- Interactive: lay the crib over the bytes, each recovered key byte appears, the *repeat* is the aha.
- Lesson: a known scrap of message hands you the key. (Direct recovery — not "dragging".)

### C3 · Same Key Twice (A) — keystream reuse, the boss
- Two ciphertexts `c1,c2`, **same key, no key given**. `c1⊕c2 = p1⊕p2` (key cancels).
- Solver **crib-drags**: slide a guessed word (e.g. `the `, `flag{`) along `c1⊕c2`; where the XOR
  reads as English, that slice of the *other* plaintext is revealed → extend both. Same muscle as
  tuning the Caesar dials (slide to fit).
- Lesson: the key is just a mask; reuse cancels it; this is the real one-time-pad-reuse break.

### C4 · Long Key, Many Keys (B) — scaffolded repeating-key break
- One ciphertext, repeating key, **key length L given** (skip Hamming-distance detection).
- Solver splits ciphertext by position mod L → L independent single-byte ciphers; brute each column
  (reuses C1) → assemble the key word → decrypt. Plaintext long enough that each column is judgeable.
- Lesson: bytewise ⇒ a long XOR key is L single-byte keys in a trenchcoat. Not a "real" key.

## Component contract (unchanged from siblings)
Theme `caesar-theme`. Template cards, first open. `details.solved`. Flag check = case-insensitive
equality. Confetti: `FX_MODULE='xor'`, `FX_TOTAL=4`, `fxSolved(p.id)`; restore `ctf-solved:v2:xor`;
two-step RESET. Bottom includes confetti manifest/engine.

## Verify
Node-verify every attack (brute unique; crib spells key; reuse peels both; columns brute clean) BEFORE
UI. Then real pointer clicks (Playwright). Animation motion: eyeball (bg tab pauses rAF/transitions);
verify final state via inline values/logic. Serve `python3 -m http.server 8787`.

---

# HANDOFF — state as of 2026-06-26 (context about to clear)

## Where it stands
`public/crypto/xor/index.html` is a single static file. **Demo + C1 + C2 + C3 built & verified.**
**C4 is the only remaining build.** Nothing deployed — deploy (`npx wrangler deploy`) ONLY on the user's go.
Serve `python3 -m http.server 8787` → `http://localhost:8787/public/crypto/xor/?v=N` (bump N to bust cache).

## Code map (one file)
- `<style>` — all CSS. Reused warm-editorial tokens + bespoke: `.twocol/.col` (demo), `.result/.seg` (hex toggle),
  drop/flip/`@keyframes`, `.hexdump/.hx`, `.brutelist/.brow-key`, `.cribcalc/.cc` (C2), `.dragrow/.dc` + `.posr` (C3),
  `.cnote`.
- Demo: two IIFEs (`DEMO: atomic toy`, `DEMO: two-column lock/unlock`). The lock/unlock animation is the bit that
  got the most user iteration — read `lockReveal` (two passes), `fillPiped` (no-flicker cascade), `lock` (1 s beat).
- Challenge engine: `score()` (English-frequency, used by brute), `flagMark()`, the `VALID`/`STORE` stale-prune,
  `addCard({id,title,sub,intro,hint,build})`. Each challenge is one `addCard(...)`; `build(ctx)` injects bespoke
  HTML into `ctx.work`, wires it, and **returns the flag string** (the shell handles submit/verdict/solved/restore).

## Build C4 (the remaining task) — DECIDED WITH USER: 3-byte LIVE TUNER (not per-column brute lists)
`addCard({ id:'c4', title:'Long Key, Many Keys', sub:'repeating key, 3 bytes', ... })`. Content (node-verified —
must be an English sentence with spaces, not an underscore flag):
- plain `the long key is really many tiny keys flag{stacked}`, key `sun` (len **3, GIVEN**), flag `flag{stacked}`.

**Why NOT per-column brute lists:** a single position-column (every-3rd-char) is NOT human-readable, so "spot the
readable byte" is impossible by eye — only a frequency-scorer could pick it, which is the auto-solving the user had
us remove from C1. So judging on a column is dishonest/unsolvable.

**The tuner interaction (what to build):** three byte-pickers, one per key position (0,1,2) — each picker chooses a
byte 0–255 (a knob / number input / small slider; show as hex AND its character). The **whole message re-renders
live** under the assembled 3-byte key as each knob moves (`xorBytes(cipher, [b0,b1,b2])`, repeating). The student
tunes each knob until the FULL SENTENCE reads English — judging happens on the assembled, readable message, not on a
column. Optional helper: a per-column 256 list the student can consult, but the *verdict* is the live message. This
literally embodies the closing lesson: **a long XOR key = 3 independent single-byte knobs.** Flag = `flag{stacked}`.
Node-verify: the assembled message is fully readable ONLY at `[s,u,n]`; partial keys give partly-English text (good —
that's the feedback that guides tuning). `score()` may power an optional "is this knob right?" hint but must NOT be
the solver.

## UX decisions LOCKED with the user during playtest (do not regress)
- **Plain language only**: encrypted / decrypted / lock / unlock / "scrambled message". Never cipher/plaintext/recovered.
- **Never sort brute results by readability** — that solves it for them. Key order + a student-driven crib **filter**.
- **Nothing pre-highlighted** as the answer anywhere.
- C1: hex **and** text dump; key entered as char OR hex; the `0x37`/`0x17` case-flip **twin is a deliberate decoy**
  (flags are lowercase `flag{`) — taught, not hidden.
- C2: crib starts **empty** (student supplies `flag{`); includes the "CyberChef can't brute >2-byte keys" note.
- Demo: key on top; result on top in plain text + TEXT|HEX toggle; **two-pass** animation (write bits → pause →
  flip key-on bits), ~1 s beat before piping encrypted to column ②; cascade must not flicker.
- C3 boss does real **crib-dragging** (slide a guess); C1/C2 do direct recovery (C2 is direct read-off, not dragging).

## Verified content table (all proven in node before UI)
| # | plain (flag) | key | check |
|---|---|---|---|
| C1 | `flag{brute_force_me}` | `0x37` | real key reads; twin `0x17`→`FLAG[…]` decoy |
| C2 | `flag{repeating_xor_key}` | `cat` | `flag{` crib → `catca` |
| C3 | p1 `flag{same_key_twice}` / p2 `meet me by the docks!` | `PURPLEHAZE` (reused) | `c1⊕c2`, drag peels both |
| C4 | `the long key is really many tiny keys flag{stacked}` | `sun` (len given) | per-column brute → `sun` |

## Gotchas (bit us / will bite)
- Engine bakes store key `ctf-solved:v2:xor`; can't bump to v3 page-side. We **prune ids not in `VALID`** on load so
  a changed id-scheme can't ghost the completion confetti. If you add/rename challenge ids, update `VALID`.
- Automation tab (Playwright/Chrome MCP) **pauses rAF + CSS transitions** → you cannot *see* motion; verify final
  DOM/inline state and ASK THE USER to eyeball animation. `setTimeout` still fires (throttled), so staged reveals
  are testable by awaiting the total duration.
- `score()` must be English-frequency + hard non-printable penalty; a loose printability ratio fails (49 keys looked
  "printable" for C1; short columns mis-scored for C4). Use sentences-with-spaces for brute-able challenges.
- Python: `.venv/bin/python` only (global broken). Deploy custom-domain via `wrangler.jsonc` (`workers_dev:false`).

## Notes
- **C1 has NO decode animation** — the user judged the byte-by-byte animation nonsensical and had it removed. Do NOT
  re-add it. C1's `apply()` just renders the decoded text.
- `FX_TOTAL=4` while only C1–C3 exist means the **completion confetti cannot fire** on a C1–C3 playtest — that's
  expected, not a bug. It will fire once C4 lands and all four are solved.
