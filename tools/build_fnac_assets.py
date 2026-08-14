#!/usr/bin/env python3
"""Generate Five Nights at Crypto's puzzle assets.
Run: .venv/bin/python tools/build_fnac_assets.py

Idempotent: re-running reproduces byte-identical assets and clears the
files each night no longer ships."""
import pathlib
import shutil
from fnac_png import (make_noise_png, append_trailing_bytes,
                      bit_split, bit_weave, xor_repeating)

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'crypto' / 'fnac' / 'assets'
SRC = ROOT / 'fnac-assets'

NIGHT1_FLAG_A = 'flag{tune_into_'
NIGHT1_FLAG_B = 'the_static}'

NIGHT2_FLAG = b'flag{raw_bit_weaving}'
NIGHT2_SOURCE = ROOT / 'tools' / 'assets' / 'trollface.png'

NIGHT3_KEY = b'tung tung tung sahur'
NIGHT3_PLAINTEXT = (b'flag{tung_tung_tung_sahur} A shape in the hallway, dragging a bat. '
                    b'It always counts to three. Do not be here for four.')
NIGHT3_HINT_SRC = SRC / 'night3' / 'Sahur2.webp'


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
    (out / 'file-a.png').write_bytes(a)
    b = append_trailing_bytes(make_noise_png(48, 48, seed=103), NIGHT1_FLAG_B.encode(),
                               pad_before=24, pad_after=24, seed=104)
    (out / 'file-b.png').write_bytes(b)
    print('night1: wrote file-a.png, file-b.png')


def build_night2():
    """Raw Bit Weaving: one rage-face PNG (flag appended after IEND) is split at
    the bit level into two halves. See fnac_png.bit_split for the exact packing.
    pad_after is chosen so the source length is EVEN — each half is then exactly
    half the source and bit_weave is an exact inverse with no length ambiguity."""
    out = OUT / 'night2'
    out.mkdir(parents=True, exist_ok=True)
    png = NIGHT2_SOURCE.read_bytes()
    source = append_trailing_bytes(png, NIGHT2_FLAG, pad_before=24,
                                   pad_after=25, seed=205)
    assert len(source) % 2 == 0, f'source must be even-length, got {len(source)}'
    half_a, half_b = bit_split(source)
    assert bit_weave(half_a, half_b) == source, 'bit split/weave is not a round trip'
    assert b'flag{' not in half_a and b'flag{' not in half_b, 'flag leaked into a half'
    (out / 'file-a.bin').write_bytes(half_a)
    (out / 'file-b.bin').write_bytes(half_b)
    _clean(out, {'file-a.bin', 'file-b.bin'})
    print(f'night2: wrote file-a.bin, file-b.bin ({len(half_a)} bytes each, '
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
    (out / 'message.txt').write_bytes(cipher)
    hint = out / 'hint-sahur.webp'
    shutil.copyfile(NIGHT3_HINT_SRC, hint)
    _clean(out, {'message.txt', 'hint-sahur.webp'})
    print(f'night3: wrote message.txt ({len(cipher)} bytes), '
          f'hint-sahur.webp ({hint.stat().st_size} bytes)')


if __name__ == '__main__':
    build_night1()
    build_night2()
    build_night3()
