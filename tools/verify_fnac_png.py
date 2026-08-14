"""Manual smoke test for fnac_png.py + the shipped FNAC assets.
Run: .venv/bin/python tools/verify_fnac_png.py"""
import pathlib
import random
from PIL import Image
from fnac_png import (make_noise_png, append_trailing_bytes, read_trailing_bytes,
                      add_text_chunks, read_text_chunks, embed_lsb_message,
                      extract_lsb_message, bit_split, bit_weave, xor_repeating)
import build_fnac_assets as B

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ROOT / 'public' / 'crypto' / 'fnac' / 'assets'
PNG_SIG = b'\x89PNG\r\n\x1a\n'

png = make_noise_png(48, 48, seed=101)
tagged = append_trailing_bytes(png, b'flag{part}', pad_before=16, pad_after=16, seed=102)
tail = read_trailing_bytes(tagged)
assert tail[16:16 + len(b'flag{part}')] == b'flag{part}', tail
print('trailing-bytes round-trip OK')

meta_png = add_text_chunks(png, {"Comment": "It's"})
assert read_text_chunks(meta_png)["Comment"] == "It's"
print('text-chunk round-trip OK')

carrier = Image.new('RGB', (64, 64))
carrier.putdata([(i % 256, (i * 7) % 256, (i * 13) % 256) for i in range(64 * 64)])
stego = embed_lsb_message(carrier, b'flag{test}')
assert extract_lsb_message(stego) == b'flag{test}'
print('lsb round-trip OK')

# ---- Night 2: bit split / weave ----
rng = random.Random(7)
for n in (0, 1, 2, 3, 16, 257, 1000):
    blob = bytes(rng.randrange(256) for _ in range(n))
    a, b = bit_split(blob)
    assert len(a) == len(b) == (n + 1) // 2, (n, len(a), len(b))
    woven = bit_weave(a, b)
    assert woven[:n] == blob, f'weave mismatch at n={n}'
    if n % 2:  # odd source: the padded tail byte is zero, original length is not recoverable
        assert len(woven) == n + 1 and woven[-1] == 0
print('bit split/weave round-trip OK (incl. odd-length zero-pad branch)')

# known-answer vector: 0b10110010 -> even bits (6,4,2,0)=0,1,0,0 ; odd bits (7,5,3,1)=1,1,0,1
ka_a, ka_b = bit_split(bytes([0b10110010]))
assert ka_a == bytes([0b0100_0000]) and ka_b == bytes([0b1101_0000]), (ka_a, ka_b)
print('bit split known-answer vector OK')

half_a = (ASSETS / 'night2' / 'file-a.bin').read_bytes()
half_b = (ASSETS / 'night2' / 'file-b.bin').read_bytes()
source = append_trailing_bytes(B.NIGHT2_SOURCE.read_bytes(), B.NIGHT2_FLAG,
                               pad_before=24, pad_after=25, seed=205)
assert bit_weave(half_a, half_b) == source, 'shipped halves do not weave back to the source'
assert source.startswith(PNG_SIG) and B.NIGHT2_FLAG in source
assert not half_a.startswith(PNG_SIG) and not half_b.startswith(PNG_SIG), 'a half looks like a PNG'
assert b'flag{' not in half_a, "'flag{' visible in half A"
assert b'flag{' not in half_b, "'flag{' visible in half B"
assert b'flag' not in half_a and b'flag' not in half_b
print(f'night2 shipped assets OK — weave is byte-identical to the {len(source)}-byte source, '
      f"no 'flag{{' in either half, neither half has a PNG signature")

# ---- Night 3: repeating-key XOR ----
cipher = (ASSETS / 'night3' / 'message.txt').read_bytes()
plain = xor_repeating(cipher, B.NIGHT3_KEY)
assert plain == B.NIGHT3_PLAINTEXT, plain
assert b'flag{tung_tung_tung_sahur}' in plain
assert xor_repeating(B.NIGHT3_PLAINTEXT[:5], cipher[:5]) == b'tung ', 'crib does not yield "tung "'
assert max(cipher) < 0x80 and 0x0a not in cipher and 0x0d not in cipher
assert (ASSETS / 'night3' / 'hint-sahur.webp').stat().st_size < 200_000
print(f'night3 shipped assets OK — {len(cipher)} ciphertext bytes decode to the plaintext, '
      f"crib 'flag{{' -> 'tung ', {cipher.count(0)} NUL bytes (all where plaintext == key)")
