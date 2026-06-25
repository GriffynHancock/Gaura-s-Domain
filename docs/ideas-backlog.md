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
