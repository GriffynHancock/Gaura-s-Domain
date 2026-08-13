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
