"""Manual smoke test for fnac_png.py + the shipped FNAC assets.
Run: .venv/bin/python tools/verify_fnac_png.py"""
import io
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

half_a = (ASSETS / 'night2' / 'night2-a.bin').read_bytes()
half_b = (ASSETS / 'night2' / 'night2-b.bin').read_bytes()
png = B.night2_source_png()
source = B.night2_source_bytes()
woven = bit_weave(half_a, half_b)
assert woven == source, 'shipped halves do not weave back to the source'
assert source.startswith(PNG_SIG)
assert not half_a.startswith(PNG_SIG) and not half_b.startswith(PNG_SIG), 'a half looks like a PNG'
for name, blob in (('source', source), ('half A', half_a), ('half B', half_b)):
    assert B.NIGHT2_FLAG not in blob, f'{name} carries the flag as a byte string'
    assert b'flag{' not in blob, f"'flag{{' visible in {name}"
    assert b'flag' not in blob, f"'flag' visible in {name}"

# the easter egg: what `strings` on the woven file actually gets you. Read back out of the
# WOVEN bytes (not the builder's variable) and decoded as UTF-8, so the Greek is proven to
# survive the split/weave round trip rather than assumed to.
tail = woven[woven.index(B.NIGHT2_EASTER):]
text = tail.decode('utf-8')
assert text.startswith('The word hexadecimal is first recorded in 1952.')
assert 'Greek ἕξ (hex) "six"' in text, text[:120]
assert 'en.wikipedia.org/wiki/Hexadecimal' in text
assert b'flag' not in tail
print(f'night2 easter egg OK — {len(B.NIGHT2_EASTER)} UTF-8 bytes after IEND survive the weave, '
      f'Greek intact: {text[text.index("Greek"):text.index("Greek")+18]}')

# the flag must be PIXELS: prove it survives a decode/re-encode of the woven image, which no
# byte-string search can tell you. Compared against a freshly drawn reference render.
woven_img = Image.open(io.BytesIO(woven)).convert('RGBA')
ref_img = Image.open(io.BytesIO(png)).convert('RGBA')
assert woven_img.size == ref_img.size
assert woven_img.tobytes() == ref_img.tobytes(), 'woven image pixels differ from the source render'
plain_img = Image.open(B.NIGHT2_SOURCE).convert('RGBA')
diff = [i for i, (p, q) in enumerate(zip(plain_img.tobytes(), ref_img.tobytes())) if p != q]
assert diff, 'nothing was painted onto the trollface — the flag is not in the pixels'
print(f'night2 shipped assets OK — weave is byte-identical to the {len(source)}-byte source, '
      f"no 'flag' bytes anywhere, {len(diff)} pixel-channel differences vs the unpainted "
      f'trollface (the flag is drawn into the image)')

# ---- Night 3: repeating-key XOR ----
cipher = (ASSETS / 'night3' / 'night3-a.txt').read_bytes()
plain = xor_repeating(cipher, B.NIGHT3_KEY)
assert plain == B.NIGHT3_PLAINTEXT, plain
assert plain.startswith(b'flag{stop_scrolling}'), 'flag is not at offset 0'
assert xor_repeating(B.NIGHT3_PLAINTEXT[:5], cipher[:5]) == b'tung ', 'crib does not yield "tung "'
assert max(cipher) < 0x80 and 0x0a not in cipher and 0x0d not in cipher
assert (ASSETS / 'night3' / 'hint-sahur.webp').stat().st_size < 200_000
partial = xor_repeating(cipher, b'tung ')
assert partial.startswith(b'flag{stop_scrol'), partial
print(f'night3 shipped assets OK — {len(cipher)} ciphertext bytes decode to the plaintext, '
      f"crib 'flag{{' -> 'tung ', {cipher.count(0)} NUL bytes (all where plaintext == key)")
print('night3 partial decode with the 5-byte crib key "tung " (what the student sees first):')
print('  ' + repr(partial))

# ---- intro creep media ----
creep = ASSETS / 'creep'
for name in ('eyes.png', 'scare.mp3', 'flicker.mp3', 'lights-on.mp3'):
    assert (creep / name).stat().st_size > 0, f'missing creep asset {name}'
eyes = Image.open(creep / 'eyes.png')
assert eyes.size == (652, 650), eyes.size
print(f'creep assets OK — eyes.png {eyes.size[0]}x{eyes.size[1]} {eyes.mode}, 3 audio files present')
