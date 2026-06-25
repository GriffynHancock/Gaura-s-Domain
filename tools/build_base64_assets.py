#!/usr/bin/env python3
"""Build precomputed assets for the Base64/encoding module (Module 2).

Reproducible: run with the project venv ->  .venv/bin/python tools/build_base64_assets.py
Outputs public/crypto/base64/assets.js  (window.ASSETS = {...}).

Pillow renders the raster images; everything else is stdlib.

Every puzzle's CORRECT decode pipeline is asserted to reproduce its flag before
assets.js is written. The decode filters below mirror the JS METHODS in index.html
byte-for-byte; if you change one, change the other.

See docs/superpowers/module2-solve-paths.md for the per-puzzle solve paths and where
red herrings live in each encoded string.
"""
import base64, io, json, os, re
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT  = os.path.join(ROOT, "public", "crypto", "base64", "assets.js")
OUTDIR = os.path.join(ROOT, "tools", "out")  # builder previews (gitignored)

# ----------------------------------------------------------------------------
# Decode filters — MUST match the JS METHODS in index.html exactly.
# Each takes bytes and returns bytes; best-effort, never raises.
# ----------------------------------------------------------------------------
def m_base64(b: bytes) -> bytes:
    t = re.sub(rb"[^A-Za-z0-9+/]", b"", b).decode("latin1")
    while len(t) % 4:
        t += "="
    try:
        return base64.b64decode(t)
    except Exception:
        return b""

def m_hex(b: bytes) -> bytes:
    t = re.sub(rb"[^0-9a-fA-F]", b"", b).decode("latin1")
    if len(t) % 2:
        t = t[:-1]
    return bytes(int(t[i:i+2], 16) for i in range(0, len(t), 2))

def m_rot13(b: bytes) -> bytes:
    out = bytearray()
    for c in b:
        if 65 <= c <= 90:
            out.append((c - 65 + 13) % 26 + 65)
        elif 97 <= c <= 122:
            out.append((c - 97 + 13) % 26 + 97)
        else:
            out.append(c)
    return bytes(out)

def m_rot47(b: bytes) -> bytes:
    out = bytearray()
    for c in b:
        out.append((c - 33 + 47) % 94 + 33 if 33 <= c <= 126 else c)
    return bytes(out)

def m_url(b: bytes) -> bytes:
    s = b.decode("latin1")
    out = bytearray()
    i = 0
    while i < len(s):
        if s[i] == "%" and re.match("^[0-9a-fA-F]{2}$", s[i+1:i+3]):
            out.append(int(s[i+1:i+3], 16)); i += 3
        else:
            out.append(ord(s[i]) & 255); i += 1
    return bytes(out)

def m_atbash(b: bytes) -> bytes:
    out = bytearray()
    for c in b:
        if 97 <= c <= 122:
            out.append(219 - c)
        elif 65 <= c <= 90:
            out.append(155 - c)
        else:
            out.append(c)
    return bytes(out)

def run_pipeline(blob: str, methods) -> bytes:
    b = blob.encode("latin1")
    for m in methods:
        b = {"base64": m_base64, "hex": m_hex, "rot13": m_rot13,
             "rot47": m_rot47, "url": m_url, "atbash": m_atbash}[m](b)
    return b

# ----------------------------------------------------------------------------
# Raster helpers
# ----------------------------------------------------------------------------
def png_bytes(img: Image.Image) -> bytes:
    b = io.BytesIO(); img.save(b, "PNG"); return b.getvalue()

def load_mono(size):
    for p in ("/System/Library/Fonts/Menlo.ttc",
              "/System/Library/Fonts/Monaco.ttf",
              "/System/Library/Fonts/SFNSMono.ttf"):
        try: return ImageFont.truetype(p, size)
        except Exception: pass
    return ImageFont.load_default()

def flag_bitmap(text):
    """A small B/W bitmap that literally reads the flag."""
    font = load_mono(15)
    tmp = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    l, t, r, b = tmp.textbbox((0, 0), text, font=font)
    w, h = (r - l) + 10, (b - t) + 8
    img = Image.new("RGB", (w, h), "white")
    d = ImageDraw.Draw(img)
    d.text((5 - l, 4 - t), text, fill="black", font=font)
    return img

def imposter():
    """Tiny red "imposter" sprite (32x32) for 'Among the Bytes'."""
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    red, dark, visor, glare = (193, 18, 31, 255), (142, 13, 22, 255), (155, 211, 232, 255), (230, 246, 255, 255)
    d.rectangle([6, 13, 9, 21], fill=dark)
    d.ellipse([9, 4, 23, 18], fill=red)
    d.rectangle([9, 11, 22, 27], fill=red)
    d.rectangle([9, 25, 13, 30], fill=red)
    d.rectangle([18, 25, 22, 30], fill=red)
    d.ellipse([14, 10, 24, 16], fill=visor)
    d.rectangle([21, 11, 22, 12], fill=glare)
    return img

# ----------------------------------------------------------------------------
# Two Faces — dual-image polyglot
#
# One blob S. `hex` strips every non-hex char -> reconstructs the flag PNG
# byte-exact. `base64` keeps every char (all in the base64 alphabet) and the
# IMAGE view paints the bytes as raw RGB: each base64 4-char group -> 3 bytes
# -> one pixel. Top rows draw a troll from decoy-only quads (decoys are in the
# base64 alphabet but NOT hex, so they vanish under `hex`); the bottom band
# carries the flag-PNG hex string (the only hex chars in S), padded with a
# non-hex decoy. Result: two real images from one blob.
# ----------------------------------------------------------------------------
B64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
# decoy chars: in the base64 alphabet but NOT hex digits ([0-9a-fA-F])
DECOY = "GHIJKLMNOPQRSTUVWXYZghijklmnopqrstuvwxyz+/"
assert all(c not in "0123456789abcdefABCDEF" for c in DECOY)
DECOY_VALS = sorted(B64_ALPHABET.index(c) for c in DECOY)
TROLL_SRC = os.path.join(ROOT, "tools", "assets", "trollface.png")

def quad_to_rgb(quad):
    """The RGB pixel that a 4-char base64 group paints (matches bytesCanvas)."""
    v0, v1, v2, v3 = (B64_ALPHABET.index(c) for c in quad)
    b0 = ((v0 << 2) | (v1 >> 4)) & 255
    b1 = (((v1 & 15) << 4) | (v2 >> 2)) & 255
    b2 = (((v2 & 3) << 6) | v3) & 255
    return (b0, b1, b2)

def darkest_decoy_quad():
    """The decoy-only 4-char group that paints the darkest reachable colour.

    base64 paints each group as one RGB pixel, but decoy chars can only encode a
    subset of 6-bit values, so we can't reach pure black — pick the darkest we can
    (used for the trollface's line art; the background uses '////' = white).
    """
    v0 = DECOY_VALS[0]                      # b0 = v0<<2|.. so smallest v0 -> darkest red channel
    best = None
    for v1 in DECOY_VALS:
        for v2 in DECOY_VALS:
            for v3 in DECOY_VALS:
                b0 = ((v0 << 2) | (v1 >> 4)) & 255
                b1 = (((v1 & 15) << 4) | (v2 >> 2)) & 255
                b2 = (((v2 & 3) << 6) | v3) & 255
                lum = 0.299 * b0 + 0.587 * b1 + 0.114 * b2
                if best is None or lum < best[0]:
                    best = (lum, "".join(B64_ALPHABET[v] for v in (v0, v1, v2, v3)))
    return best[1]

WHITE_QUAD = "////"                          # -> (255,255,255)
DARK_QUAD = darkest_decoy_quad()

def troll_mask(W, rows):
    """Downscale the real trollface to W x rows and return a per-pixel bool: True=line."""
    src = Image.open(TROLL_SRC).convert("RGBA")
    flat = Image.alpha_composite(Image.new("RGBA", src.size, (255, 255, 255, 255)), src)
    g = flat.convert("L").resize((W, rows), Image.LANCZOS)
    px = g.load()
    return [px[x, y] < 128 for y in range(rows) for x in range(W)]

def build_two_faces(flag_text):
    # 1-bit PNG keeps the flag image tiny -> short hex -> a thin data strip
    flag_png = png_bytes(flag_bitmap(flag_text).convert("1"))
    hexs = flag_png.hex()                     # lowercase 0-9a-f, even length

    W = 48
    total = W * W                             # 2304 px -> perfect square so JS round(sqrt)==48
    band_px = -(-len(hexs) // 4)              # ceil: pixels needed to carry the hex
    band_rows = -(-band_px // W)
    face_rows = W - band_rows
    if face_rows < 24:
        raise SystemExit(f"flag PNG too big for Two Faces grid: face_rows={face_rows}")

    mask = troll_mask(W, face_rows)           # real trollface, 2-tone
    chars = []
    for is_line in mask:                       # face pixels: 4 decoy chars -> exact colour
        chars.append(DARK_QUAD if is_line else WHITE_QUAD)
    chars = list("".join(chars))               # flatten to per-char
    chars.extend(hexs)                          # data strip: the flag hex, in order
    while len(chars) < total * 4:               # pad the rest of the strip white so it blends
        chars.append("/")
    S = "".join(chars)
    assert len(S) == total * 4

    # ---- verify both faces ----
    assert m_hex(S.encode("latin1")) == flag_png, "Two Faces: hex path != flag PNG"
    painted = m_base64(S.encode("latin1"))
    assert len(painted) == total * 3, "Two Faces: base64 path wrong length"

    # write a builder preview of the troll for a human/vision eyeball check
    os.makedirs(OUTDIR, exist_ok=True)
    timg = Image.new("RGB", (W, W))
    timg.putdata([(painted[i*3], painted[i*3+1], painted[i*3+2]) for i in range(total)])
    timg.resize((W * 6, W * 6), Image.NEAREST).save(os.path.join(OUTDIR, "two_faces_troll_preview.png"))
    return S, flag_text

# ----------------------------------------------------------------------------
def main():
    flags = {}

    # 1 — Decode the Signal: plain base64 (obvious '=' tell)
    a_plain = "flag{base64_is_not_secret}"
    a_b64 = base64.b64encode(a_plain.encode()).decode()
    flags["a"] = a_plain

    # 2 — Picture This: base64 of a flag bitmap
    b_flag = "flag{wow!}"
    b_png = base64.b64encode(png_bytes(flag_bitmap(b_flag))).decode()
    flags["b"] = b_flag

    # 5 — Among the Bytes: imposter PNG with a readable flag spliced after IEND
    c_flag = "flag{hidden_in_the_bytes}"
    c_bytes = png_bytes(imposter()) + b"\n----[ " + c_flag.encode() + b" ]----\n"
    c_b64 = base64.b64encode(c_bytes).decode()
    flags["c"] = c_flag

    # 6 — Order Matters: base64( hex( flag ) )  -> decode base64 then hex
    d_flag = "flag{peel_the_layers}"
    d_b64 = base64.b64encode(d_flag.encode().hex().encode()).decode()
    flags["d"] = d_flag

    # 3 — Sixteen: clean hex (only 0-9a-f)
    e_flag = "flag{hex_in_plain_sight}"
    e_hex = e_flag.encode().hex()
    flags["e"] = e_flag

    # 4 — Percent Sign: fully percent-encoded flag (obvious url)
    f_flag = "flag{percent_encoded}"
    f_url = "".join("%%%02x" % b for b in f_flag.encode())
    flags["f"] = f_flag

    # 7 — Three Deep: base64( rot47( hex( flag ) ) )  -> base64, rot47, hex
    g_flag = "flag{three_layers_deep}"
    g_hex = g_flag.encode().hex()
    g_rot = m_rot47(g_hex.encode()).decode("latin1")          # rot47 is an involution
    g_b64 = base64.b64encode(g_rot.encode("latin1")).decode()
    flags["g"] = g_flag

    # 8 — Two Faces: dual-image polyglot
    two_faces, tf_flag = build_two_faces("flag{two_faces}")
    flags["two_faces"] = tf_flag

    # 9 — final: one base64 layer, but the plaintext is a dump salted with UNLABELLED
    # decoys. florg{...} looks flag-ish but isn't the flag{...} format; the hex/url
    # look-alikes lead nowhere. Nothing tells you which is real — that's the puzzle.
    i_flag = "flag{read_every_line_first}"
    i_plain = ("-- capture 0x5f --\n"
               "auth_token: florg{that-isnt-a-flag}\n"
               "trace=666c61677b6e6f7d\n"
               "ref=%66%6c%61%67\n"
               "payload:\n"
               + i_flag + "\n"
               "-- end of capture --\n")
    i_b64 = base64.b64encode(i_plain.encode()).decode()
    flags["i"] = i_flag

    # ---- assert every correct pipeline reproduces its flag ----
    checks = [
        ("1 base64",        a_b64, ["base64"],                 a_plain),
        ("3 hex",           e_hex, ["hex"],                    e_flag),
        ("4 url",           f_url, ["url"],                    f_flag),
        ("6 base64>hex",    d_b64, ["base64", "hex"],          d_flag),
        ("7 base64>rot47>hex", g_b64, ["base64", "rot47", "hex"], g_flag),
        ("9 base64",        i_b64, ["base64"],                 None),   # flag is substring
    ]
    for name, blob, pipe, expect in checks:
        out = run_pipeline(blob, pipe).decode("latin1", "replace")
        if expect is not None:
            assert out == expect, f"{name}: got {out!r}"
        else:
            assert i_flag in out, f"{name}: flag not in {out!r}"
    # image puzzles: pipeline yields a PNG/marker
    assert m_base64(b_png.encode()).startswith(b"\x89PNG"), "2: not a PNG"
    assert c_flag.encode() in m_base64(c_b64.encode()), "5: flag not in bytes"
    assert m_hex(two_faces.encode("latin1")) == png_bytes(flag_bitmap("flag{two_faces}").convert("1")), "8 hex face"

    assets = {
        "a_b64": a_b64, "b_png": b_png, "c_b64": c_b64, "d_b64": d_b64,
        "e_hex": e_hex, "f_url": f_url, "g_b64": g_b64, "two_faces": two_faces,
        "i_b64": i_b64, "flags": flags,
    }
    with open(OUT, "w") as f:
        f.write("window.ASSETS=" + json.dumps(assets) + ";\n")

    print("wrote", OUT)
    for name, blob, pipe, _ in checks:
        print(f"  ok  {name}")
    print("  ok  2 base64>image, 5 spliced, 8 two-faces hex path")
    print("  troll preview ->", os.path.join(OUTDIR, "two_faces_troll_preview.png"))

if __name__ == "__main__":
    main()
