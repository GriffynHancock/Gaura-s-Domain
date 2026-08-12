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
