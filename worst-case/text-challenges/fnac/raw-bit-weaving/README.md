> Presenter/solution reference — do not show to participants

# Raw Bit Weaving (Five Nights at Crypto's, Night 2)

**⚠ This night replaced an earlier one.** Night 2 used to be "It's In The Metadata"
(`flag{its_in_the_metadata}`, four PNGs with `tEXt` chunks). That puzzle and its assets
are gone. If you are holding an older printout, discard it.

**Source:** real, fixed content. Flag defined directly in `tools/build_fnac_assets.py`
(`NIGHT2_FLAG = b'flag{raw_bit_weaving}'`); the split/weave pair lives in
`tools/fnac_png.py` (`bit_split` / `bit_weave`). Confirmed by weaving the two actual
shipped halves back together and reading the result. Not per-user randomized — the same
two files for every student.

**Attachments:** referenced by relative path in `challenge.yml`'s `files:` list rather
than copied, to avoid duplicating binary assets:
`../../../../public/crypto/fnac/assets/night2/file-a.bin` and `file-b.bin` (verified
these paths resolve from this challenge folder). 1794 bytes each; woven source is 3588
bytes. They are deliberately `.bin`, not `.png` — neither half starts with a PNG
signature and neither will open as an image, which is the point.

## Mechanism

One source file (a rage-face PNG with the flag appended after its `IEND` chunk) was taken
apart **at the bit level**, not the byte level, into two halves:

- bits within a source byte are numbered 7 (MSB) … 0 (LSB);
- **half A** collects the EVEN-indexed bits of each byte, in the order 6, 4, 2, 0;
- **half B** collects the ODD-indexed bits, in the order 7, 5, 3, 1.

Each source byte therefore contributes exactly one nibble to each half. Nibbles are packed
**MSB-first, in source order**: source byte 0 becomes the HIGH nibble of output byte 0,
source byte 1 the LOW nibble of output byte 0, source byte 2 the high nibble of output
byte 1, and so on. Each half is `ceil(len/2)` bytes. (An odd-length source would zero-pad
the final low nibble and lose its original length; the builder asserts an even-length
source so the weave is an exact inverse.)

Because the split is per-bit, **neither half contains any recognisable structure** —
no PNG signature, no readable strings, and the builder asserts `flag{` appears in
neither. There is nothing to find until the file is whole again.

Once woven, the reassembled PNG carries the flag as plain ASCII **after the `IEND`
chunk** — the Night 1 trick, reused now that the file is back in one piece.

## Solution

```python
import pathlib

def bit_weave(half_a: bytes, half_b: bytes) -> bytes:
    assert len(half_a) == len(half_b)
    out = bytearray()
    for i in range(len(half_a) * 2):
        nib_a = (half_a[i // 2] >> 4) & 0xF if i % 2 == 0 else half_a[i // 2] & 0xF
        nib_b = (half_b[i // 2] >> 4) & 0xF if i % 2 == 0 else half_b[i // 2] & 0xF
        byte = 0
        for pos, bit in enumerate((6, 4, 2, 0)):
            byte |= ((nib_a >> (3 - pos)) & 1) << bit
        for pos, bit in enumerate((7, 5, 3, 1)):
            byte |= ((nib_b >> (3 - pos)) & 1) << bit
        out.append(byte)
    return bytes(out)

a = pathlib.Path('file-a.bin').read_bytes()
b = pathlib.Path('file-b.bin').read_bytes()
src = bit_weave(a, b)
pathlib.Path('recovered.png').write_bytes(src)      # opens: a rage face
print(src[src.find(b'IEND') + 8:])                  # ... flag{raw_bit_weaving} ...
```

Verified directly against the shipped halves: the woven output is 3588 bytes, starts with
the PNG signature `89 50 4E 47 0D 0A 1A 0A`, has its `IEND` marker at offset `0x0db6`, and
contains `flag{raw_bit_weaving}` at offset `0x0dd6` — inside the random padding that
follows `IEND`. `flag{` is absent from both halves.

**Flag:** `flag{raw_bit_weaving}`

## Presenter notes

The lesson is that "the file" and "the bytes on disk" are not the same thing: data can be
distributed across containers so that no container holds anything meaningful on its own.
This is the shape of secret-sharing and of striped storage, and it is why a hex dump of
either half looks like noise no matter how hard you stare.

Offline, there is no standard Kali tool for this — the interleave order is bespoke, so
the Python above *is* the tool. On the live site an on-page WEAVE tool does the same job
(drop both halves in), standing in for the script the way the other nights' tools stand in
for `xxd`/`exiftool`. Give students the bit order from the `challenge.yml` description; the
puzzle is reassembly and then remembering Night 1's trailing-bytes trick, not guessing an
undocumented bit permutation.
