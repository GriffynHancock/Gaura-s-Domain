> Presenter/solution reference — do not show to participants

# Two Faces (Encoding module, puzzle VIII)

**Source:** real, fixed content extracted from `public/crypto/encoding/assets.js`
(key `two_faces`), cross-checked against `flags.two_faces`. Not per-user randomized.
This is a genuine dual-image polyglot — decoding the same string two different ways
produces two different real images.

## Mechanism

`blob.txt` is a hex dump of the flag PNG with decoy letters from outside the hex
alphabet (`[G-Zg-z+/]`) wedged in.

- **Decode as hex:** every non-hex character (the decoys) is stripped, reconstructing
  the flag PNG byte-exact.
- **Decode as base64:** every character is kept (they're all valid base64 alphabet).
  Viewing the resulting bytes as raw pixel data (rather than as a PNG file) paints a
  small trollface image — a joke picture, not the flag.

The two readings coexist because the decoy alphabet used shares no characters with the
hex alphabet (`0-9a-f`).

## Solution

```python
import re
blob = open('blob.txt').read()
hexonly = re.sub(r'[^0-9a-fA-F]', '', blob)
png_bytes = bytes.fromhex(hexonly)
open('flag.png', 'wb').write(png_bytes)
# open flag.png -> shows the literal text "flag{two_faces}"
```

Confirmed by rendering: decoding `blob.txt` as hex (stripping non-hex characters)
produces a valid PNG whose image is the text `flag{two_faces}`.

**Flag:** `flag{two_faces}`

## Presenter notes

The "obvious" method (base64 — the more commonly reached-for tile) gives a joke image;
the less-obvious method (hex) gives the real flag. The whole puzzle *is* the red herring:
tell participants explicitly to try both decodings on the same blob if they get stuck on
one producing nonsense.
