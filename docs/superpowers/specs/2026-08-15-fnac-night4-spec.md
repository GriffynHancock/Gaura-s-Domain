# FNAC Night 4 — "You Spin Me Right Round"

Spec written 2026-08-15. Not built. Author's design, with the flag encoding reworked after the
original split was measured to be unsolvable.

## The mechanic

A passage of English text where **every whitespace-separated word is Caesar-shifted by its own
key**. The author's name for it is a "streamROT" cipher. The formal name is a polyalphabetic
cipher keyed per word rather than per letter, which is worth saying once because it means the
student has now done Caesar, Vigenère and this.

Naming: **do not call it ROT26.** Shifting by 26 is the identity, it does nothing. It is ROT-N over
a 26-letter alphabet, with N changing every word.

The intended solve is a short script: split on whitespace, try all 26 shifts per token, keep the
one that reads as English. That is about ten lines, and it is deliberately a small step up from
101 while sitting inside FNAC's "bring your own tools" framing.

## The flag, and why it is encoded this way

Flag: **`flag{anathemgoodbook}`** (the author's pun on Neal Stephenson's *Anathem*).

It is hidden about 75% of the way through the passage, as six ordinary-looking words, each carrying
its own shift like every other word:

```
flag  brace  anathem  good  book  brace
```

The solver decodes those six words like any others, sees `flag brace anathem good book brace`, and
reassembles `flag{anathemgoodbook}`. First `brace` is the opening one, second is the closing one.

**Braces are written as the word `brace`, never as `{` and `}`.** This was the author's call and it
is load-bearing for two reasons. Punctuation does not rotate, so a literal `{` would sit in the
ciphertext in plain sight and `grep '{'` would locate the flag instantly. And a chunk that is
mostly punctuation gives the brute force nothing to rank, so it breaks the solve as well as leaking
it.

### The measurement that settled this

The author's first split was `flag{ an athem goo dboo k}`, i.e. plausible word-sized chunks that do
not respect word boundaries. Measured against `/usr/share/dict/words`, per-chunk brute force gives:

| chunk | shifts yielding a dictionary word |
|---|---|
| `flag{` | 1 |
| `an` | 7 |
| `athem` | 0 |
| `goo` | 4 |
| `dboo` | 1, and it is **`tree`**, which is wrong |
| `k}` | 26 |

So the technique the whole night teaches produces nothing for the part that matters, and the solver
faces 26⁴ = 456,976 combinations with no way to rank them. Worse, `dboo` decodes to `tree` under one
shift, so a student's script prints a confident wrong answer. That is the failure mode to avoid.

Under the word-boundary encoding above, scored by English trigram frequency, the true answer ranks:

| chunk | in dictionary | rank of true answer |
|---|---|---|
| `flag` | yes | 2 / 26 |
| `brace` | yes | 1 / 26 |
| `anathem` | **no** | 1 / 26 |
| `good` | yes | 2 / 26 |
| `book` | yes | 1 / 26 |

`anathem` is not a dictionary word but still ranks first on trigram score, so the pun survives. A
dictionary-only script will miss that one chunk and a frequency-scoring script will not, which is a
fair thing for this night to teach.

## Source text

`night4-nonflag.txt` in the repo root, 78 words, 490 characters. **Do not read it into the page or
the spec; treat it as opaque input to the builder.**

Two properties to expect and not treat as bugs:
- It contains `,` `.` `—` `’` `“` `”`. None of these rotate. That is fine for ordinary words, and it
  is exactly why the flag must not use `{` `}`.
- 11 of its 78 words are two letters or shorter. Those have many valid readings each (`an` alone has
  7), so a per-word script will emit garbage for them and the reader resolves them from context.
  Expected, not a defect.

The builder should assert the flag words are absent from the source text before insertion, in the
same spirit as Night 2's asserts.

## Copy

Author's words. Title:

> You Spin Me Right Round

Subtitle, with the number filled in and spelling corrected:

> Fun fact, Caesar was stabbed 23 times before he ultimately perished from embarrassment. Every word
> in his last moments may have pointed in a different direction, the coward.

23 is the figure from Suetonius, and only one of the wounds was actually fatal, which is available if
the joke wants sharpening later.

Mark the block `<!-- copy: author -->`.

## The reward

On solve, `spinor.mp4` loops in the **bottom-left corner**, first 8 seconds only, chroma-keyed.

Verified facts about the asset (`fnac-assets/spinor.mp4`):
- 720×1280 portrait, 30fps, 12.5s, 1.6 MB, **has an audio track**.
- Already shot on pure green: the frame border sampled at 2s is `rgb(0,240,0)` across 100% of edge
  pixels. So it keys cleanly and no rotoscoping is needed.

Implementation notes:
- Key it per-pixel on a `<canvas>`, drawing the `<video>` each frame and zeroing alpha where the
  pixel is near `(0,240,0)`. A CSS-only approach cannot do this.
- **Must be muted** or it will not autoplay at all. It also should be muted regardless: an
  unexpected audio loop in the corner of a dark page is unpleasant.
- Loop the first 8s explicitly, do not let it run to 12.5s.
- Scale it down hard. It is portrait and 1280 tall; a corner ornament wants to be a few hundred
  pixels at most.
- **Photosensitivity: a spinning object looping forever is periodic motion on a `#000000` page.**
  Measure it with `tools/verify_fnac_flash_safety.mjs` before shipping, the same as the gate drop
  was. If the spin rate lands near the flash bound, slow the playback rate rather than dropping the
  effect.
- It is destined for a trophy room later, so build the keyed-video player as something reusable
  rather than inline in Night 4.

## Wiring

- `STAGES` entry `night4` goes `ready:false` → `ready:true`.
- **`FX_TOTAL` on FNAC goes 3 → 4.** It is hard-coded on purpose (see `CLAUDE.md`); this is exactly
  the bump that note is about, and forgetting it means FNAC can never report complete.
- Assets built by `tools/build_fnac_assets.py`. Remember `_clean()` deletes anything a night no
  longer ships, so add night 4's files to its keep-set.
- Add the flag to `worst-case/text-challenges/fnac/`. That mirror is already incomplete and stale;
  do not make it worse.

## Tests

Add to `tools/verify_fnac_module.mjs`:
- the night renders, has its download link, and accepts `flag{anathemgoodbook}`
- a wrong flag is still rejected
- the shipped ciphertext, decoded word-by-word with per-word brute force, actually yields the six
  flag words (i.e. assert the puzzle is solvable by the intended method, not just that the file exists)
- the literal string `flag{` does **not** appear in the ciphertext, and neither does `{` or `}`
- the reward video only appears after a solve

Assert the solvability property in the **builder** too, so a future text swap cannot silently break it.

## Open

- Whether `brace` reads clearly enough as "this is a curly brace" for a 15-year-old. The alternative
  is spelling it `openbrace` / `closebrace`, which is less elegant and no longer a dictionary word.
- Whether the reward video should carry sound behind a click, given it is muted by necessity on
  autoplay.
