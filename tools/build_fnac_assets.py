#!/usr/bin/env python3
"""Generate Five Nights at Crypto's puzzle assets.
Run: .venv/bin/python tools/build_fnac_assets.py"""
import pathlib
from PIL import Image
from fnac_png import make_noise_png, append_trailing_bytes, add_text_chunks, embed_lsb_message

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'crypto' / 'fnac' / 'assets'

NIGHT1_FLAG_A = 'flag{tune_into_'
NIGHT1_FLAG_B = 'the_static}'
NIGHT2_FLAG = 'flag{its_in_the_metadata}'
NIGHT2_HINTS = ["It's", "In The", "Meta", "Data"]
CATS_SRC = ROOT / 'fnac-assets' / 'cats'
NIGHT3_FLAG = 'flag{ten_thousand_cats}'


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
    out = OUT / 'night2'
    out.mkdir(parents=True, exist_ok=True)
    for i, hint in enumerate(NIGHT2_HINTS, start=1):
        png = append_trailing_bytes(make_noise_png(48, 48, seed=200 + i), b'trolololo',
                                     pad_before=24, pad_after=24, seed=210 + i)
        fields = {'Comment': hint}
        if i == len(NIGHT2_HINTS):
            fields['Flag'] = NIGHT2_FLAG
        png = add_text_chunks(png, fields)
        (out / f'file-{i}.png').write_bytes(png)
    print(f'night2: wrote {len(NIGHT2_HINTS)} files')


def build_night3():
    out = OUT / 'night3'
    out.mkdir(parents=True, exist_ok=True)
    sources = sorted(p for p in CATS_SRC.iterdir() if p.suffix.lower() in ('.jpg', '.jpeg', '.png'))
    if len(sources) < 10:
        raise SystemExit(f'night3: need >=10 real cat photos in {CATS_SRC}, found {len(sources)}')
    for i, src in enumerate(sources[:10]):
        img = Image.open(src)
        stego = embed_lsb_message(img, NIGHT3_FLAG.encode())
        stego.save(out / f'cat-{i}.png')
    print('night3: wrote 10 variants')


if __name__ == '__main__':
    build_night1()
    build_night2()
    build_night3()
