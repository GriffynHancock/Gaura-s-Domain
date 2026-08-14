#!/usr/bin/env python3
"""Generate Five Nights at Crypto's puzzle assets.
Run: .venv/bin/python tools/build_fnac_assets.py

Idempotent: re-running reproduces byte-identical assets and clears the
files each night no longer ships."""
import io
import pathlib
import shutil
from PIL import Image, ImageDraw, ImageFont
from fnac_png import (make_noise_png, append_trailing_bytes,
                      bit_split, bit_weave, xor_repeating)

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'crypto' / 'fnac' / 'assets'
SRC = ROOT / 'fnac-assets'

NIGHT1_FLAG_A = 'flag{tune_into_'
NIGHT1_FLAG_B = 'the_static}'

# Night 2's flag is PAINTED INTO THE PIXELS, never appended as bytes: `strings` must not
# find it, the student has to weave the halves back and LOOK at the picture.
NIGHT2_FLAG = b'flag{data_bender}'
NIGHT2_SOURCE = ROOT / 'tools' / 'assets' / 'trollface.png'

# The reward for running `strings` on the woven Night 2 file: an etymology lecture, not a flag.
# UTF-8, with the Greek kept as Greek — the assert below proves the bytes round-trip.
NIGHT2_EASTER = (
    'The word hexadecimal is first recorded in 1952. It is macaronic in the sense that it '
    'combines Greek ἕξ (hex) "six" with Latinate -decimal. The all-Latin alternative '
    'sexadecimal (compare the word sexagesimal for base 60) is older, and sees at least '
    'occasional use from the late 19th century.\n'
    '  -- https://en.wikipedia.org/wiki/Hexadecimal\n'
).encode('utf-8')

NIGHT3_KEY = b'tung tung tung sahur'
# Sentence spacing here is load-bearing, not sloppy typing: every plaintext character sits at a
# fixed phase of the 20-byte key, and a handful of (character, phase) pairs XOR to CR/LF or to a
# byte >= 0x80. Both are asserted against below — CR/LF because a text-mode transfer could
# rewrite them AND because a real 0x0a would make the on-page ciphertext block render a line
# break the file doesn't have. The double spaces are the phase shifts that dodge those pairs;
# nudging a word here means re-running the asserts, not eyeballing it.
NIGHT3_PLAINTEXT = (b'flag{stop_scrolling}  It comes down the hall at 3am with a bat.  '
                    b'It always counts to three.  Put your phone down.  '
                    b'It does not hide its name. It shouts it, over and over.')
NIGHT3_HINT_SRC = SRC / 'night3' / 'Sahur2.webp'

# Intro creep sequence. Source names carry a space in the directory name and one file the user
# called a .jpg is really a .png — deployed copies are renamed to plain URL-safe names.
CREEP_SRC = SRC / 'intro creep'
CREEP_FILES = {
    'fnac-eyes.png': 'eyes.png',
    'fnac.mp3': 'scare.mp3',
    'light-flicker.mp3': 'flicker.mp3',
    'lights-on.mp3': 'lights-on.mp3',
}


def _clean(out: pathlib.Path, keep: set):
    """Remove files this night no longer ships (old puzzle assets)."""
    if not out.exists():
        return
    for p in sorted(out.iterdir()):
        if p.is_file() and p.name not in keep:
            p.unlink()
            print(f'  removed stale {p.relative_to(OUT)}')


def build_night1():
    out = OUT / 'night1'
    out.mkdir(parents=True, exist_ok=True)
    a = append_trailing_bytes(make_noise_png(48, 48, seed=101), NIGHT1_FLAG_A.encode(),
                               pad_before=24, pad_after=24, seed=102)
    (out / 'night1-a.png').write_bytes(a)
    b = append_trailing_bytes(make_noise_png(48, 48, seed=103), NIGHT1_FLAG_B.encode(),
                               pad_before=24, pad_after=24, seed=104)
    (out / 'night1-b.png').write_bytes(b)
    _clean(out, {'night1-a.png', 'night1-b.png'})
    print('night1: wrote night1-a.png, night1-b.png')


def night2_source_png() -> bytes:
    """The trollface with `flag{data_bender}` PAINTED into the bottom-left corner.

    The corner is opaque white line-art background (verified: alpha 255 across the region),
    but a white plate is drawn behind the text anyway so a stray eyebrow stroke can never
    sit under a glyph. Pillow's sized default font is an embedded TrueType, so this renders
    the same on any machine with the same Pillow — the builder stays reproducible."""
    img = Image.open(NIGHT2_SOURCE).convert('RGBA')
    draw = ImageDraw.Draw(img)
    font = ImageFont.load_default(size=13)
    text = NIGHT2_FLAG.decode()
    x, y = 6, img.height - 20
    box = draw.textbbox((x, y), text, font=font)
    draw.rectangle((box[0] - 3, box[1] - 2, box[2] + 3, box[3] + 2), fill=(255, 255, 255, 255))
    draw.text((x, y), text, font=font, fill=(0, 0, 0, 255))
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()


def night2_source_bytes() -> bytes:
    """The exact byte string the two halves weave back into: the painted trollface PNG,
    followed (after IEND, where no decoder looks) by the hexadecimal-etymology easter egg.

    Padding is plain newlines rather than random bytes so the tail reads cleanly out of
    `strings` / `tail -c`, and the total is forced EVEN — bit_split/bit_weave is only an exact
    inverse for an even-length source."""
    png = night2_source_png()
    source = png + b'\n\n' + NIGHT2_EASTER
    if len(source) % 2:
        source += b'\n'
    return source


def build_night2():
    """Bit Weaving: one rage-face PNG is split at the bit level into two halves.
    See fnac_png.bit_split for the exact packing. pad_after is chosen so the source
    length is EVEN — each half is then exactly half the source and bit_weave is an
    exact inverse with no length ambiguity.

    The flag is in the PICTURE, not in the bytes: nothing here appends it, and the
    asserts below prove it is absent as a byte string from the source and both halves.
    Dumping strings gets you nothing; weaving and opening the PNG shows you the flag."""
    out = OUT / 'night2'
    out.mkdir(parents=True, exist_ok=True)
    source = night2_source_bytes()
    assert len(source) % 2 == 0, f'source must be even-length, got {len(source)}'
    assert NIGHT2_FLAG not in source, 'flag is a byte string in the source — it must be pixels only'
    assert b'flag{' not in source, "'flag{' appears as bytes in the source"
    assert NIGHT2_EASTER in source, 'the easter egg did not survive into the source'
    assert 'ἕξ' in source.decode('utf-8', 'replace'), 'the Greek did not round-trip as UTF-8'
    half_a, half_b = bit_split(source)
    assert bit_weave(half_a, half_b) == source, 'bit split/weave is not a round trip'
    assert b'flag{' not in half_a and b'flag{' not in half_b, 'flag leaked into a half'
    assert NIGHT2_FLAG not in half_a and NIGHT2_FLAG not in half_b
    (out / 'night2-a.bin').write_bytes(half_a)
    (out / 'night2-b.bin').write_bytes(half_b)
    _clean(out, {'night2-a.bin', 'night2-b.bin'})
    print(f'night2: wrote night2-a.bin, night2-b.bin ({len(half_a)} bytes each, '
          f'source {len(source)})')


def build_night3():
    """Tung Tung Tung Sahur: repeating-key XOR over a plaintext that begins with
    the flag, so a `flag{` crib at offset 0 recovers the first five key bytes."""
    out = OUT / 'night3'
    out.mkdir(parents=True, exist_ok=True)
    cipher = xor_repeating(NIGHT3_PLAINTEXT, NIGHT3_KEY)
    assert xor_repeating(cipher, NIGHT3_KEY) == NIGHT3_PLAINTEXT
    assert max(cipher) < 0x80, 'ciphertext must stay 7-bit'
    # CR/LF would be the one class of byte a text-mode transfer could rewrite;
    # the plaintext is worded to avoid producing them. NULs are unavoidable
    # (the flag repeats the key's own words) and transfer verbatim.
    assert 0x0a not in cipher and 0x0d not in cipher, 'ciphertext contains CR/LF'
    (out / 'night3-a.txt').write_bytes(cipher)
    hint = out / 'hint-sahur.webp'
    shutil.copyfile(NIGHT3_HINT_SRC, hint)
    _clean(out, {'night3-a.txt', 'hint-sahur.webp'})
    print(f'night3: wrote night3-a.txt ({len(cipher)} bytes), '
          f'hint-sahur.webp ({hint.stat().st_size} bytes)')


def build_creep():
    """Copy the intro-creep media out of `fnac-assets/intro creep/` (space in the name)
    to URL-safe filenames under the served assets directory. Plain copies — the page
    hard-cuts scare.mp3 at 7.8s in JS rather than depending on ffmpeg at build time."""
    out = OUT / 'creep'
    out.mkdir(parents=True, exist_ok=True)
    for src_name, dst_name in CREEP_FILES.items():
        shutil.copyfile(CREEP_SRC / src_name, out / dst_name)
    _clean(out, set(CREEP_FILES.values()))
    print('creep: wrote ' + ', '.join(sorted(CREEP_FILES.values())))


if __name__ == '__main__':
    build_night1()
    build_night2()
    build_night3()
    build_creep()
