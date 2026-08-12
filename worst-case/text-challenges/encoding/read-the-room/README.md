> Presenter/solution reference — do not show to participants

# Read the Room (Encoding module, puzzle IX)

**Source:** real, fixed content extracted from `public/crypto/encoding/assets.js`
(key `i_b64`), cross-checked against `flags.i`. Not per-user randomized.

**⚠ Documentation staleness flag:** `docs/superpowers/module2-solve-paths.md` disagrees
with the live source in two places for this puzzle, and its own internal table
disagrees with its own per-puzzle notes:

- The doc's ramp-table row claims pipeline `base64` only, and flag
  `flag{read_to_the_very_end}`. That is **wrong** — the real pipeline is
  `base64 → atbash` (confirmed by the live page's own hint text, which says "it's a
  letter-mirror away from plain — try Atbash"), and the real flag is
  `flag{read_every_line_first}` (confirmed against `assets.js`'s `flags.i` and by
  decoding below).
- The doc's per-puzzle decoy list names `florg{that-isnt-a-flag}`,
  `trace=...`→`flag{no}`, `ref=...`→`flag`. The **actual decoded decoys** (verified
  below) are `florg{nice-try}` (plain), `trace=` → hex-decodes directly to
  `glaf{not-it}`, and `ref=` → url-decodes directly to `glorf{nope}` — matching
  `florg{}` / `glaf{}` / `glorf{}` as named in `STATUS.md`, not the doc's specific
  strings. Only the `payload:` line is atbash-shifted; `trace=`/`ref=` decode exactly
  as their own labels suggest (hex, url) with no atbash step involved.

This README uses the verified-real values. Flag it to whoever maintains
`module2-solve-paths.md`.

## Mechanism

Single base64 layer, but the decoded text is itself atbash-shifted (a letter mirror:
a↔z, b↔y, ...) and contains decoys mixed in with the real payload:

1. `florg{...}` — plain text, looks flag-shaped but is not the `flag{...}` format.
2. `trace=...` — a hex string; decodes (plain hex, no further step) to a `glaf{...}` decoy.
3. `ref=...` — a url-percent string; decodes (plain url-decode, no further step) to a
   `glorf{...}` decoy.
4. `payload:` — the real content, and the *only* line that's additionally atbash-shifted.

## Solution

```python
import base64

def atbash(s):
    out = []
    for ch in s:
        c = ord(ch)
        if 97 <= c <= 122: out.append(chr(219 - c))
        elif 65 <= c <= 90: out.append(chr(155 - c))
        else: out.append(ch)
    return ''.join(out)

raw = base64.b64decode(open('blob.txt').read()).decode()
print(raw)
```

Decoded base64 (before atbash) reads:

```
-- capture 0x5f --
auth_token: florg{nice-try}
trace=676c61667b6e6f742d69747d
ref=%67%6c%6f%72%66%7b%6e%6f%70%65%7d
payload:
uozt{ivzw_vevib_ormv_urihg}
-- end of capture --
```

Applying atbash to the `payload:` line: `atbash('uozt{ivzw_vevib_ormv_urihg}')` →
`'flag{read_every_line_first}'`.

The `trace=` and `ref=` lines are **not** atbash — they decode directly, exactly as
their own labels claim: `bytes.fromhex('676c61667b6e6f742d69747d')` → `glaf{not-it}`,
and `urllib.parse.unquote('%67%6c%6f%72%66%7b%6e%6f%70%65%7d')` → `glorf{nope}`. Both
are plain, readable decoy tokens the moment you apply the obvious decode — the trap is
that they *look* like they might need more work, not that they hide anything further.

**Flag:** `flag{read_every_line_first}`

## Presenter notes

The lesson is *reading carefully*, not extra crypto — the base64 layer is the only real
encoding step; everything after is about not grabbing the first flag-shaped string. The
`payload:` line is deliberately unlabelled as "atbash" — a careful student should notice
it looks like a letter-mirror of an English phrase.
