"""Manual smoke test for fnac_png.py. Run: .venv/bin/python tools/verify_fnac_png.py"""
from PIL import Image
from fnac_png import make_noise_png, append_trailing_bytes, read_trailing_bytes, add_text_chunks, read_text_chunks, embed_lsb_message, extract_lsb_message

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
