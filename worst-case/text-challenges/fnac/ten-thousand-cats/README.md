> Presenter/solution reference — do not show to participants

# Ten Thousand Cats (Five Nights at Crypto's, Night 3)

**Source:** real, fixed content. Flag defined directly in `tools/build_fnac_assets.py`
(`NIGHT3_FLAG = 'flag{ten_thousand_cats}'`) and the embedding routine in
`tools/fnac_png.py` (`embed_lsb_message`). Confirmed by extracting the payload from an
actual shipped file.

**⚠ Per-student variant note:** on the live site, each student is assigned one of 10 real
cat photos (`cat-0.png` … `cat-9.png`, at `public/crypto/fnac/assets/night3/`) via
`fnv(UID + ':fnac:night3') % 10` — a different *cover image* per student, purely for
anti-shoulder-surfing. **All 10 variants carry the identical hidden flag payload** — the
mechanism and the flag are fixed; only the visible photo differs. This text fallback
attaches a single fixed variant (`cat-0.png`) since the live deployment's per-student
randomization can't be reproduced in a static file bundle.

**Attachments:** referenced by relative path in `challenge.yml`'s `files:` list
(verified resolvable from this folder), not copied.

## Mechanism

LSB (least-significant-bit) steganography in the image's **red channel only** — green
and blue are untouched, so a bit-plane viewer that only shows the red plane's LSB will
show a coherent embedded pattern next to channels that look like pure static.

Payload format: a 4-byte big-endian length prefix (how many payload bytes follow),
encoded 1 bit per pixel (LSB of red), row-major, followed by the ASCII flag bytes
encoded the same way. Tools that don't know to skip the length prefix (e.g. some
`zsteg`/`stegsolve` raw dumps) will show a few bytes of binary-looking junk *before* the
readable flag text — that's expected, not corruption.

## Solution

```python
from PIL import Image

def extract_lsb_message(img, max_len=4096):
    img = img.convert('RGB')
    pixels = list(img.getdata())
    length_bits = ''.join(str(p[0] & 1) for p in pixels[:32])
    length = min(int(length_bits, 2), max_len)
    need_bits = 32 + length * 8
    all_bits = ''.join(str(p[0] & 1) for p in pixels[:need_bits])
    payload_bits = all_bits[32:32 + length * 8]
    return bytes(int(payload_bits[i:i+8], 2) for i in range(0, len(payload_bits), 8))

img = Image.open('cat-0.png')
print(extract_lsb_message(img))   # b'flag{ten_thousand_cats}'
```

Verified directly against the shipped file `public/crypto/fnac/assets/night3/cat-0.png`
using the extraction logic above (mirroring `tools/fnac_png.py`'s
`extract_lsb_message`, the inverse of the embedding function used to build the assets):
output is exactly `flag{ten_thousand_cats}`.

**Flag:** `flag{ten_thousand_cats}`

## Presenter notes

If no LSB-extraction tool/script is available on the day, `zsteg` (Kali-preinstalled)
against the red channel, or any bit-plane viewer set to "red LSB", will make the pattern
visible without needing the length-prefix math — a presenter running this fully offline
should have the Python snippet above ready as a fallback either way.
