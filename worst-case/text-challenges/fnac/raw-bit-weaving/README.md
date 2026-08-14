> Presenter/solution reference — do not show to participants

# Bit Weaving (Five Nights at Crypto's, Night 2)

**⚠ This night has been reworked twice — check what you are holding.**
It first replaced "It's In The Metadata" (`flag{its_in_the_metadata}`, four PNGs with
`tEXt` chunks). It was then reworked again: the flag changed from `flag{raw_bit_weaving}`
to **`flag{data_bender}`**, the files were renamed `file-a.bin`/`file-b.bin` →
`night2-a.bin`/`night2-b.bin`, and — the important part — **the flag moved out of the
bytes and into the picture**. Discard any older printout. The folder name here is left as
`raw-bit-weaving/` so old links keep working; the live title is **Night 2 · Bit Weaving**.

**Source:** real, fixed content. Flag defined directly in `tools/build_fnac_assets.py`
(`NIGHT2_FLAG = b'flag{data_bender}'`); the split/weave pair lives in `tools/fnac_png.py`
(`bit_split` / `bit_weave`). Confirmed by weaving the two actual shipped halves back
together and opening the result. Not per-user randomized — the same two files for every
student.

**Attachments:** referenced by relative path in `challenge.yml`'s `files:` list rather
than copied, to avoid duplicating binary assets:
`../../../../public/crypto/fnac/assets/night2/night2-a.bin` and `night2-b.bin` (verified
these paths resolve from this challenge folder). **2725 bytes each; woven source is 5450
bytes.** They are deliberately `.bin`, not `.png` — neither half starts with a PNG
signature and neither will open as an image, which is the point.

## Mechanism

One source file was taken apart **at the bit level**, not the byte level, into two halves:

- bits within a source byte are numbered 7 (MSB) … 0 (LSB);
- **half A** collects the EVEN-indexed bits of each byte, in the order 6, 4, 2, 0;
- **half B** collects the ODD-indexed bits, in the order 7, 5, 3, 1.

Each source byte therefore contributes exactly one nibble to each half. Nibbles are packed
**MSB-first, in source order**: source byte 0 becomes the HIGH nibble of output byte 0,
source byte 1 the LOW nibble of output byte 0, source byte 2 the high nibble of output
byte 1, and so on. Each half is `ceil(len/2)` bytes. (An odd-length source would zero-pad
the final low nibble and lose its original length; the builder pads the source to an even
length so the weave is an exact inverse, and asserts the round trip.)

Because the split is per-bit, **neither half contains any recognisable structure** — no
PNG signature, no readable strings.

**The flag is in the PICTURE, not in the bytes.** This is the change that makes this night
different from Night 1, and the thing to get right when presenting it. The source is a
rage-face PNG with `flag{data_bender}` *drawn into the bottom-left corner pixels* (on a
white plate, so no line-art stroke can sit under a glyph). The builder asserts that the
flag — and even a bare `flag{` — is absent as a byte string from the source and from both
halves. So `strings` on the correctly reassembled file finds no flag at all. It finds an
easter egg instead: an etymology-of-"hexadecimal" paragraph appended after the `IEND`
chunk, which is the *reward* for running `strings`, deliberately not the answer. A student
who reassembles the file correctly and then only greps it will conclude they got it wrong.
They have to open the image.

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

a = pathlib.Path('night2-a.bin').read_bytes()
b = pathlib.Path('night2-b.bin').read_bytes()
pathlib.Path('recovered.png').write_bytes(bit_weave(a, b))
# now OPEN recovered.png — the flag is printed in the bottom-left corner of the image.
```

Verified directly against the shipped halves: the woven output is **5450 bytes**, starts
with the PNG signature `89 50 4E 47 0D 0A 1A 0A`, has its `IEND` marker at offset
`0x13ea`, and `flag{` appears **nowhere** in it. Opening it shows a rage face with
`flag{data_bender}` printed across the bottom-left corner. The bytes after `IEND` are the
hexadecimal-etymology easter egg.

**Flag:** `flag{data_bender}`

## Presenter notes

Two lessons stacked. First: "the file" and "the bytes on disk" are not the same thing —
data can be distributed across containers so that no container holds anything meaningful
on its own. That is the shape of secret-sharing and of striped storage, and it is why a
hex dump of either half looks like noise no matter how hard you stare.

Second, and the reason for the rework: **not every payload is a string.** A generation
raised on `grep`/`strings` will reflexively search for `flag{` and conclude a file is
clean when the search comes back empty. Here the reassembly is provably correct and the
search still fails, because the answer is pixels. The easter egg is there so the search
isn't *unrewarded* — just not the answer.

There is no on-page tool for this any more: FNAC's helper widgets were all removed and the
module now assumes a commandline, so the Python above *is* the tool, offline and online
alike. There is no standard Kali utility for it either — the interleave order is bespoke.
Give students the bit order from the `challenge.yml` description; the puzzle is reassembly
and then thinking to *look* at what came out, not guessing an undocumented bit permutation.
