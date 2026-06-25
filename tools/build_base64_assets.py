#!/usr/bin/env python3
"""Build precomputed assets for the Base64/encoding module (Module 2).

Reproducible: run with the project venv ->  .venv/bin/python tools/build_base64_assets.py
Outputs public/crypto/base64/assets.js  (window.ASSETS = {...}).

Pillow renders the two raster images; everything else is stdlib.
"""
import base64, io, json, os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT  = os.path.join(ROOT, "public", "crypto", "base64", "assets.js")

def png_bytes(img: Image.Image) -> bytes:
    b = io.BytesIO(); img.save(b, "PNG"); return b.getvalue()

def load_mono(size):
    for p in ("/System/Library/Fonts/Menlo.ttc",
              "/System/Library/Fonts/Monaco.ttf",
              "/System/Library/Fonts/SFNSMono.ttf"):
        try: return ImageFont.truetype(p, size)
        except Exception: pass
    return ImageFont.load_default()

# --- 2b: a small B/W bitmap that literally reads the flag ---
def flag_bitmap(text="flag{wow!}"):
    font = load_mono(15)
    tmp = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    l, t, r, b = tmp.textbbox((0, 0), text, font=font)
    w, h = (r - l) + 10, (b - t) + 8
    img = Image.new("RGB", (w, h), "white")
    d = ImageDraw.Draw(img)
    d.text((5 - l, 4 - t), text, fill="black", font=font)
    return img

# --- 2c: tiny red "imposter" sprite (32x32) ---
def imposter():
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    red, dark, visor, glare = (193, 18, 31, 255), (142, 13, 22, 255), (155, 211, 232, 255), (230, 246, 255, 255)
    d.rectangle([6, 13, 9, 21], fill=dark)        # backpack
    d.ellipse([9, 4, 23, 18], fill=red)           # dome top
    d.rectangle([9, 11, 22, 27], fill=red)        # torso
    d.rectangle([9, 25, 13, 30], fill=red)        # left leg
    d.rectangle([18, 25, 22, 30], fill=red)       # right leg
    d.ellipse([14, 10, 24, 16], fill=visor)       # visor
    d.rectangle([21, 11, 22, 12], fill=glare)     # glare
    return img

def main():
    # 2a: plain base64 of a flag (note the trailing '=' tell)
    a_plain = "flag{base64_is_not_secret}"
    a_b64 = base64.b64encode(a_plain.encode()).decode()

    # 2b
    b_png = base64.b64encode(png_bytes(flag_bitmap())).decode()

    # 2c: imposter PNG with a readable flag spliced in after IEND (still renders)
    c_flag = "flag{hidden_in_the_bytes}"
    c_bytes = png_bytes(imposter()) + b"\n----[ " + c_flag.encode() + b" ]----\n"
    c_b64 = base64.b64encode(c_bytes).decode()

    # 2d: layered  base64( hex( flag ) )  -> decode order is base64 then hex
    d_flag = "flag{peel_the_layers}"
    d_hex = d_flag.encode().hex()
    d_b64 = base64.b64encode(d_hex.encode()).decode()

    assets = {"a_b64": a_b64, "b_png": b_png, "c_b64": c_b64, "d_b64": d_b64, "d_hex": d_hex,
              "flags": {"a": a_plain, "b": "flag{wow!}", "c": c_flag, "d": d_flag}}
    with open(OUT, "w") as f:
        f.write("window.ASSETS=" + json.dumps(assets) + ";\n")
    print("wrote", OUT)
    print(" a:", a_plain, "->", a_b64)
    print(" b: flag{wow!} bitmap", len(base64.b64decode(b_png)), "bytes png")
    print(" c:", c_flag, "in", len(c_bytes), "bytes")
    print(" d:", d_flag, "-> hex", d_hex[:16] + "...", "-> base64")

if __name__ == "__main__":
    main()
