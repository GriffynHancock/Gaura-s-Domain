#!/usr/bin/env python3
"""Generate Module 3 (Hashing) preset assets.
Run: .venv/bin/python tools/build_hash_assets.py"""
import pathlib
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'crypto' / 'hash' / 'assets'
CATS_SRC = ROOT / 'fnac-assets' / 'cats'
HASHTEXT_SRC = ROOT / 'hashtext.txt'


def build_cat_thumb():
    sources = sorted(p for p in CATS_SRC.iterdir() if p.suffix.lower() in ('.jpg', '.jpeg', '.png'))
    if not sources:
        raise SystemExit(f'no source photos found in {CATS_SRC}')
    img = Image.open(sources[0]).convert('RGB')
    # 128px + quality 85 (was 64px/q60, which produced a ~1.1KB / 17-block image that was both
    # too small to see in the preview and too visibly JPEG-mangled). Bigger bound and gentler
    # compression give a noticeably longer block chain to animate through, which is the point of
    # the preset — an image is the "look how much data goes in, same fixed digest out" example.
    img.thumbnail((128, 128))
    OUT.mkdir(parents=True, exist_ok=True)
    out_path = OUT / 'cat-thumb.jpg'
    img.save(out_path, 'JPEG', quality=85)
    print(f'cat thumbnail: {out_path} ({out_path.stat().st_size} bytes)')


def build_pubtext():
    if not HASHTEXT_SRC.exists():
        raise SystemExit(f'{HASHTEXT_SRC} not found — expected a user-supplied text file at the repo root')
    OUT.mkdir(parents=True, exist_ok=True)
    out_path = OUT / 'pubtext.txt'
    out_path.write_bytes(HASHTEXT_SRC.read_bytes())
    print(f'public-domain text: {out_path} ({out_path.stat().st_size} bytes)')


if __name__ == '__main__':
    build_cat_thumb()
    build_pubtext()
