#!/usr/bin/env python3
"""Standardise the confetti sprite folder for the victory effects.

Reads the raw drop folder (repo-root /confetti, any format/size) and writes uniform
72x72 RGBA PNGs to public/encoding/confetti/, plus a manifest.js the page reads.
Also draws the among-us "suss" imposter sprite so it can rain as confetti.

Run with the project venv:  .venv/bin/python tools/build_confetti.py
"""
import os, re, json
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC  = os.path.join(ROOT, "confetti")
DST  = os.path.join(ROOT, "public", "encoding", "confetti")
SIZE = 72

def slug(name):
    stem = os.path.splitext(name)[0].lower()
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", stem)).strip("-")

def square(im):
    im = im.convert("RGBA")
    m = max(im.size)
    canvas = Image.new("RGBA", (m, m), (0, 0, 0, 0))
    canvas.paste(im, ((m - im.width) // 2, (m - im.height) // 2))
    return canvas.resize((SIZE, SIZE), Image.LANCZOS)

def imposter_sprite():
    """A chunky among-us 'suss' imposter, pixel-art scaled up."""
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    red, dark, visor, glare = (197, 22, 22, 255), (142, 13, 22, 255), (155, 211, 232, 255), (230, 246, 255, 255)
    d.rectangle([6, 13, 9, 21], fill=dark)
    d.ellipse([9, 4, 23, 18], fill=red)
    d.rectangle([9, 11, 22, 27], fill=red)
    d.rectangle([9, 25, 13, 30], fill=red)
    d.rectangle([18, 25, 22, 30], fill=red)
    d.ellipse([14, 10, 24, 16], fill=visor)
    d.rectangle([21, 11, 22, 12], fill=glare)
    return img.resize((SIZE, SIZE), Image.NEAREST)

def main():
    os.makedirs(DST, exist_ok=True)
    # clear old pngs so deletes in the source propagate
    for f in os.listdir(DST):
        if f.endswith(".png"):
            os.remove(os.path.join(DST, f))

    written = {}
    for name in sorted(os.listdir(SRC)):
        if name.startswith("."):
            continue
        try:
            im = Image.open(os.path.join(SRC, name))
        except Exception:
            print("  skip (not an image):", name); continue
        out = slug(name) + ".png"
        square(im).save(os.path.join(DST, out))
        written[out] = name  # later same-slug formats overwrite -> dedup

    # add the suss imposter
    imposter_sprite().save(os.path.join(DST, "suss-imposter.png"))
    written["suss-imposter.png"] = "(generated)"

    files = sorted(written)
    with open(os.path.join(DST, "manifest.js"), "w") as f:
        f.write("window.CONFETTI=" + json.dumps(files) + ";\n")

    print(f"wrote {len(files)} sprites -> {DST}")
    for f in files:
        print("  ", f)

if __name__ == "__main__":
    main()
