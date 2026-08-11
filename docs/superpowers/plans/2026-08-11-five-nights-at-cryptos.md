# Five Nights at Crypto's Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Five Nights at Crypto's sequel page (Night 1-3 fully playable + placeholder stubs for Night 4/5/Nightmare/Abyss), unlocked after Module 2 (Encoding) is fully solved.

**Architecture:** A new standalone static module `public/crypto/fnac/index.html` (dependency-free, same convention as Caesar/Encoding), fed by precomputed PNG assets from a new Python build script (`tools/build_fnac_assets.py` + helper library `tools/fnac_png.py`). Three reusable forensic-tool widgets (Raw Bytes Viewer, Metadata Viewer, Bit-Plane/LSB Viewer) live inside the module's own script and are shared across Night 1-3's puzzle wiring. Module 2 gets a small addition wiring the unlock cookie + link.

**Tech Stack:** Vanilla HTML/CSS/JS (no build step, no bundler), Python 3 + Pillow for asset precompute (project venv only), shared confetti engine (`public/crypto/confetti/`).

## Global Constraints

- One static, dependency-free HTML file per module (`public/crypto/fnac/index.html`) — all JS inline, no external JS libs.
- Python asset-gen scripts run via `.venv/bin/python` only — never global python (broken on this machine, PEP-668).
- Decoders/parsers must **never throw** on malformed input — catch and show "couldn't read that" instead.
- Flag matching is case-insensitive, whitespace-trimmed, otherwise exact string match (matches Encoding/Caesar convention).
- Verify pure-logic code (PNG helpers, decode functions) with a standalone assert-based script before wiring UI — mirrors the project's existing "node-verify every attack before wiring UI" convention (here: `.venv/bin/python` for the Python side, a quick `node` snippet for the JS side where logic is non-trivial).
- Verify UI with real pointer clicks (Chrome MCP), never synthetic events.
- Reuse exact existing per-user helpers verbatim rather than reinventing them: `ctfUid()` (reads/creates the `ctf-uid` cookie) and `fnv(s)` (FNV-1a hash), both copied from `public/crypto/ceasar/index.html:675-682`.
- Confetti wiring follows the exact existing pattern from `public/crypto/encoding/index.html`: `window.FX_TOTAL = <n>` set before the confetti scripts load, `window.FX_MODULE='fnac'` set between `manifest.js` and `engine.js`, `window.fxSolved(id)` called on each capture, solved-state persisted at `localStorage['ctf-solved:v2:fnac']`.
- Flag strings baked into this plan (below) are drafts in the same spirit as the Caesar module's placeholder reward URLs — functional and shippable, swappable later without a redesign.

---

## File Structure

- **Create** `tools/fnac_png.py` — PNG chunk manipulation + LSB stego helpers (pure functions, no CLI).
- **Create** `tools/verify_fnac_png.py` — standalone assert-based smoke test for the above, run manually via `.venv/bin/python`.
- **Create** `tools/build_fnac_assets.py` — CLI that calls `fnac_png.py` to generate all Night 1-3 assets into `public/crypto/fnac/assets/`.
- **Create** `fnac-assets/cats/` — drop folder for real source cat photos (gitignored raw originals optional; mirrors the `confetti/` drop-folder convention already used by `tools/build_confetti.py`).
- **Create** `public/crypto/fnac/index.html` — the module itself: shell, aesthetic, 3 tool widgets, Night 1-3 wiring, Night 4/5/Nightmare/Abyss placeholder cards, confetti wiring.
- **Modify** `public/crypto/encoding/index.html` — set the `ctf-fnac-unlocked` cookie and reveal a link to `/crypto/fnac/` once all 9 puzzles are solved.

---

### Task 1: PNG helper library — noise generation, trailing-byte payloads, text-chunk metadata

**Files:**
- Create: `tools/fnac_png.py`
- Create: `tools/verify_fnac_png.py`

**Interfaces:**
- Produces: `make_noise_png(width: int, height: int, seed: int) -> bytes`, `append_trailing_bytes(png_bytes: bytes, payload: bytes, pad_before: int, pad_after: int, seed: int) -> bytes`, `read_trailing_bytes(png_bytes: bytes) -> bytes`, `add_text_chunks(png_bytes: bytes, fields: dict[str, str]) -> bytes`, `read_text_chunks(png_bytes: bytes) -> dict[str, str]` — all consumed by Task 3.

- [ ] **Step 1: Write `tools/fnac_png.py` with noise + trailing-bytes functions**

```python
"""PNG chunk helpers for Five Nights at Crypto's asset generation.
Pure functions, no CLI — see build_fnac_assets.py for the orchestrator."""
import struct
import random
import io
from PIL import Image

PNG_SIG = b'\x89PNG\r\n\x1a\n'


def make_noise_png(width: int, height: int, seed: int) -> bytes:
    """A PNG that renders as genuine random-pixel static."""
    rng = random.Random(seed)
    img = Image.new('RGB', (width, height))
    img.putdata([(rng.randrange(256), rng.randrange(256), rng.randrange(256))
                 for _ in range(width * height)])
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()


def append_trailing_bytes(png_bytes: bytes, payload: bytes, pad_before: int,
                           pad_after: int, seed: int) -> bytes:
    """Appends payload after IEND, buried in random padding on both sides.
    Browsers/image viewers ignore anything after IEND, so the image still
    renders as plain static — the trick only shows up in a raw byte dump."""
    rng = random.Random(seed)
    before = bytes(rng.randrange(256) for _ in range(pad_before))
    after = bytes(rng.randrange(256) for _ in range(pad_after))
    return png_bytes + before + payload + after


def read_trailing_bytes(png_bytes: bytes) -> bytes:
    """Everything in the file after the IEND chunk ends."""
    pos = len(PNG_SIG)
    while pos < len(png_bytes):
        length = struct.unpack('>I', png_bytes[pos:pos + 4])[0]
        ctype = png_bytes[pos + 4:pos + 8]
        chunk_end = pos + 12 + length
        if ctype == b'IEND':
            return png_bytes[chunk_end:]
        pos = chunk_end
    return b''
```

- [ ] **Step 2: Write `tools/verify_fnac_png.py` and run it to confirm it fails (function not yet fully exercised)**

```python
"""Manual smoke test for fnac_png.py. Run: .venv/bin/python tools/verify_fnac_png.py"""
from fnac_png import make_noise_png, append_trailing_bytes, read_trailing_bytes

png = make_noise_png(48, 48, seed=101)
tagged = append_trailing_bytes(png, b'flag{part}', pad_before=16, pad_after=16, seed=102)
tail = read_trailing_bytes(tagged)
assert tail[16:16 + len(b'flag{part}')] == b'flag{part}', tail
print('trailing-bytes round-trip OK')
```

Run: `cd tools && ../.venv/bin/python verify_fnac_png.py`
Expected at this point: PASS (Step 1's implementation already covers this — this step exists to lock in the contract before Step 3 adds more surface area).

- [ ] **Step 3: Add text-chunk (metadata) functions to `tools/fnac_png.py`**

```python
import zlib


def add_text_chunks(png_bytes: bytes, fields: dict) -> bytes:
    """Inserts one tEXt chunk per (keyword, text) pair just before IEND."""
    pos = len(PNG_SIG)
    iend_pos = None
    while pos < len(png_bytes):
        length = struct.unpack('>I', png_bytes[pos:pos + 4])[0]
        ctype = png_bytes[pos + 4:pos + 8]
        if ctype == b'IEND':
            iend_pos = pos
            break
        pos += 12 + length
    chunks = b''
    for keyword, text in fields.items():
        data = keyword.encode('latin-1') + b'\x00' + text.encode('latin-1')
        crc = zlib.crc32(b'tEXt' + data) & 0xffffffff
        chunks += struct.pack('>I', len(data)) + b'tEXt' + data + struct.pack('>I', crc)
    return png_bytes[:iend_pos] + chunks + png_bytes[iend_pos:]


def read_text_chunks(png_bytes: bytes) -> dict:
    out = {}
    pos = len(PNG_SIG)
    while pos < len(png_bytes):
        length = struct.unpack('>I', png_bytes[pos:pos + 4])[0]
        ctype = png_bytes[pos + 4:pos + 8]
        cdata = png_bytes[pos + 8:pos + 8 + length]
        if ctype == b'tEXt':
            keyword, _, text = cdata.partition(b'\x00')
            out[keyword.decode('latin-1')] = text.decode('latin-1')
        pos += 12 + length
        if ctype == b'IEND':
            break
    return out
```

- [ ] **Step 4: Extend `tools/verify_fnac_png.py` to cover text chunks, then run it**

```python
from fnac_png import add_text_chunks, read_text_chunks

meta_png = add_text_chunks(png, {"Comment": "It's"})
assert read_text_chunks(meta_png)["Comment"] == "It's"
print('text-chunk round-trip OK')
```

Run: `cd tools && ../.venv/bin/python verify_fnac_png.py`
Expected: both `OK` lines print, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add tools/fnac_png.py tools/verify_fnac_png.py
git commit -m "feat(fnac): PNG noise/trailing-byte/text-chunk helpers"
```

---

### Task 2: LSB steganography embed/extract

**Files:**
- Modify: `tools/fnac_png.py`
- Modify: `tools/verify_fnac_png.py`

**Interfaces:**
- Consumes: nothing from Task 1 directly (independent function group in the same file).
- Produces: `embed_lsb_message(img: PIL.Image.Image, message: bytes) -> PIL.Image.Image`, `extract_lsb_message(img: PIL.Image.Image, max_len: int = 4096) -> bytes` — consumed by Task 4.

- [ ] **Step 1: Add LSB functions to `tools/fnac_png.py`**

```python
def embed_lsb_message(img: Image.Image, message: bytes) -> Image.Image:
    """Hides a length-prefixed message in the LSB of the red channel,
    one bit per pixel, row-major. Green/blue channels are untouched —
    they're the 'noise' a bit-plane viewer will show as pure static
    next to the R-channel plane that isn't."""
    img = img.convert('RGB')
    payload = struct.pack('>I', len(message)) + message
    bits = ''.join(f'{byte:08b}' for byte in payload)
    pixels = list(img.getdata())
    if len(bits) > len(pixels):
        raise ValueError(f'image too small for payload: need {len(bits)} pixels, have {len(pixels)}')
    out = []
    for i, (r, g, b) in enumerate(pixels):
        if i < len(bits):
            r = (r & ~1) | int(bits[i])
        out.append((r, g, b))
    img2 = Image.new('RGB', img.size)
    img2.putdata(out)
    return img2


def extract_lsb_message(img: Image.Image, max_len: int = 4096) -> bytes:
    img = img.convert('RGB')
    pixels = list(img.getdata())
    length_bits = ''.join(str(p[0] & 1) for p in pixels[:32])
    length = min(int(length_bits, 2), max_len)
    need_bits = 32 + length * 8
    all_bits = ''.join(str(p[0] & 1) for p in pixels[:need_bits])
    payload_bits = all_bits[32:32 + length * 8]
    return bytes(int(payload_bits[i:i + 8], 2) for i in range(0, len(payload_bits), 8))
```

- [ ] **Step 2: Extend `tools/verify_fnac_png.py` and run it**

```python
from PIL import Image
from fnac_png import embed_lsb_message, extract_lsb_message

carrier = Image.new('RGB', (64, 64))
carrier.putdata([(i % 256, (i * 7) % 256, (i * 13) % 256) for i in range(64 * 64)])
stego = embed_lsb_message(carrier, b'flag{test}')
assert extract_lsb_message(stego) == b'flag{test}'
print('lsb round-trip OK')
```

Run: `cd tools && ../.venv/bin/python verify_fnac_png.py`
Expected: all three `OK` lines print.

- [ ] **Step 3: Commit**

```bash
git add tools/fnac_png.py tools/verify_fnac_png.py
git commit -m "feat(fnac): LSB steganography embed/extract"
```

---

### Task 3: Night 1 & 2 asset generation

**Files:**
- Create: `tools/build_fnac_assets.py`

**Interfaces:**
- Consumes: `make_noise_png`, `append_trailing_bytes`, `add_text_chunks` from Task 1.
- Produces: `public/crypto/fnac/assets/night1/file-a.png`, `.../file-b.png`, `public/crypto/fnac/assets/night2/file-1.png`..`file-4.png` — consumed by Task 9 (Night 1 wiring) and Task 10 (Night 2 wiring) as static download links.
- Flags baked in (drafts, easily swapped later): Night 1 = `flag{tune_into_` + `the_static}` → combined `flag{tune_into_the_static}`. Night 2 = `flag{its_in_the_metadata}`, hint words in order `"It's"`, `"In The"`, `"Meta"`, `"Data"` in files 1-4's `Comment` field, real flag in file 4's `Flag` field, all four files' trailing-byte trick decodes to `trolololo` as the decoy callback to Night 1.

- [ ] **Step 1: Write `tools/build_fnac_assets.py` with `build_night1()` and `build_night2()`**

```python
#!/usr/bin/env python3
"""Generate Five Nights at Crypto's puzzle assets.
Run: .venv/bin/python tools/build_fnac_assets.py"""
import pathlib
from fnac_png import make_noise_png, append_trailing_bytes, add_text_chunks

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'crypto' / 'fnac' / 'assets'

NIGHT1_FLAG_A = 'flag{tune_into_'
NIGHT1_FLAG_B = 'the_static}'
NIGHT2_FLAG = 'flag{its_in_the_metadata}'
NIGHT2_HINTS = ["It's", "In The", "Meta", "Data"]


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


if __name__ == '__main__':
    build_night1()
    build_night2()
```

- [ ] **Step 2: Run it and verify output round-trips correctly**

Run: `.venv/bin/python tools/build_fnac_assets.py`
Expected: `night1: wrote file-a.png, file-b.png` and `night2: wrote 4 files`, and the files exist under `public/crypto/fnac/assets/night1/` and `.../night2/`.

Then verify the generated files actually decode correctly (this is the "read what falls out" check a student would do):

```bash
../.venv/bin/python -c "
from fnac_png import read_trailing_bytes, read_text_chunks
a = read_trailing_bytes(open('public/crypto/fnac/assets/night1/file-a.png','rb').read())
b = read_trailing_bytes(open('public/crypto/fnac/assets/night1/file-b.png','rb').read())
assert b'flag{tune_into_' in a and b'the_static}' in b
n2 = read_text_chunks(open('public/crypto/fnac/assets/night2/file-4.png','rb').read())
assert n2['Flag'] == 'flag{its_in_the_metadata}'
print('night1+night2 assets verified')
"
```
(run from `tools/`, or adjust the relative paths)

- [ ] **Step 3: Commit**

```bash
git add tools/build_fnac_assets.py public/crypto/fnac/assets/night1 public/crypto/fnac/assets/night2
git commit -m "feat(fnac): generate Night 1 & 2 assets"
```

---

### Task 4: Night 3 asset generation (LSB cat photos)

**Files:**
- Modify: `tools/build_fnac_assets.py`
- Create: `fnac-assets/cats/` (drop folder — needs 10 real photos supplied before this task can run to completion)

**Interfaces:**
- Consumes: `embed_lsb_message` from Task 2.
- Produces: `public/crypto/fnac/assets/night3/cat-0.png` .. `cat-9.png` — consumed by Task 11 (Night 3 wiring), which picks one per user via `fnv(UID) % 10`.

- [ ] **Step 1: Create the drop folder and a README explaining what goes in it**

```bash
mkdir -p fnac-assets/cats
```

Create `fnac-assets/cats/README.md`:

```markdown
# Night 3 source photos

Drop **10 real cat photos** here (jpg or png) before running
`tools/build_fnac_assets.py`. These need to be genuine photographs, not
synthetic/generated test images — the point of Night 3 is a real found
photo with real steganography in it, same as the corpus of real PeCan
challenges this module is modeled on. Filenames don't matter; the build
script picks the first 10 it finds, sorted.
```

This is a manual content-provisioning step (same pattern as the `confetti/` drop folder for `tools/build_confetti.py`) — the build script below will refuse to run without 10 source photos present, rather than silently generating with fewer or synthetic ones.

- [ ] **Step 2: Add `build_night3()` to `tools/build_fnac_assets.py`**

```python
from PIL import Image
from fnac_png import embed_lsb_message

CATS_SRC = ROOT / 'fnac-assets' / 'cats'
NIGHT3_FLAG = 'flag{ten_thousand_cats}'


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
```

- [ ] **Step 3: Run it (after photos are dropped in) and verify**

Run: `.venv/bin/python tools/build_fnac_assets.py`
Expected: `night3: wrote 10 variants`, 10 files under `public/crypto/fnac/assets/night3/`.

Verify extraction round-trips on the real output:

```bash
../.venv/bin/python -c "
from PIL import Image
from fnac_png import extract_lsb_message
for i in range(10):
    img = Image.open(f'public/crypto/fnac/assets/night3/cat-{i}.png')
    assert extract_lsb_message(img) == b'flag{ten_thousand_cats}', i
print('night3 assets verified')
"
```

- [ ] **Step 4: Commit**

```bash
git add tools/build_fnac_assets.py fnac-assets/cats/README.md public/crypto/fnac/assets/night3
git commit -m "feat(fnac): generate Night 3 LSB cat-photo assets"
```

_Note: if 10 real photos aren't available yet when this task is picked up, do Steps 1-2 (script + drop-folder scaffolding) and stop — Steps 3-4 need the actual photos supplied first. Don't substitute synthetic placeholder images; that defeats the point of the puzzle._

---

### Task 5: Page shell — aesthetic, cookie gate, stage card grid, placeholders

**Files:**
- Create: `public/crypto/fnac/index.html`

**Interfaces:**
- Produces: the page skeleton with a `<template id="stage">` (mirrors Encoding's `<template id="mod">` pattern), a `STAGES` array structure, `ctfUid()` and `fnv()` helpers, a `.locked` stub view — all consumed/extended by Tasks 6-11.

- [ ] **Step 1: Write the HTML shell with dark aesthetic and gate check**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Five Nights at Crypto's — Crypto 101 Bonus</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,900&family=Hanken+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#000000; --panel:#0d0c0a; --panel2:#141210; --edge:#2a2620;
    --ink:#e8e2d4; --dim:#7a7466;
    --accent:#b23a26; --gold:#c79338; --ok:#62ab77;
    --disp:"Fraunces",Georgia,serif; --ui:"Hanken Grotesk",system-ui,sans-serif;
    --mono:"JetBrains Mono",ui-monospace,Menlo,monospace;
  }
  *{box-sizing:border-box}
  body{margin:0; color:var(--ink); font-family:var(--ui); background:var(--bg); min-height:100vh; padding:40px 18px 90px}
  .wrap{max-width:780px; margin:0 auto}
  header{border-bottom:2px solid var(--edge); padding-bottom:18px; margin-bottom:26px}
  h1{font-family:var(--disp); font-weight:900; font-size:clamp(2.1rem,6.5vw,3.3rem); line-height:.96; margin:0; color:var(--ink)}
  h1 em{font-style:italic; font-weight:400; color:var(--accent)}
  header p{font-family:var(--disp); font-size:1.02rem; line-height:1.5; opacity:.8; margin:12px 0 0; max-width:56ch}

  .locked{font-family:var(--mono); font-size:.9rem; color:var(--dim); text-align:center; padding:80px 20px}

  .grid{display:grid; gap:18px}
  .stage{background:var(--panel); border:1px solid var(--edge); border-radius:8px; padding:20px 22px}
  .stage.placeholder{opacity:.45}
  .stage .lab{font-family:var(--mono); font-size:.66rem; letter-spacing:.2em; text-transform:uppercase; color:var(--gold)}
  .stage h2{font-family:var(--disp); font-size:1.4rem; margin:6px 0 10px}
  .raw-html{font-family:serif; color:#000; background:#fff; padding:16px; border:none}
</style>
</head>
<body>
<div class="wrap" id="app"></div>
<script>
function ctfUid(){
  const m=document.cookie.match(/(?:^|; )ctf-uid=([^;]+)/); if(m) return m[1];
  const v=Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
  document.cookie='ctf-uid='+v+';path=/;max-age=31536000;samesite=lax'; return v;
}
const fnv=s=>{ let h=2166136261>>>0; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; };
const UID=ctfUid();

function unlocked(){ return document.cookie.match(/(?:^|; )ctf-fnac-unlocked=1(?:;|$)/); }

const app = document.getElementById('app');
if(!unlocked()){
  app.innerHTML = '<div class="locked">nothing here yet.<br>finish <a href="../encoding/" style="color:var(--gold)">Module 2</a> first.</div>';
} else {
  renderModule();
}

function renderModule(){
  app.innerHTML = `
    <header>
      <h1>Five Nights at <em>Crypto's</em></h1>
      <p>You made it through. This part isn't graded like the rest — it's what's left running after
         hours. Same tools, worse lighting.</p>
    </header>
    <div class="raw-html"><p>visitor log — do not remove<br>everything past this point is off the books.</p></div>
    <div class="grid" id="stages"></div>
  `;
}
</script>
</body>
</html>
```

- [ ] **Step 2: Add the seeded-rotation helper and stage-card rendering with placeholders for Night 4/5/Nightmare/Abyss**

```html
<script>
// small deterministic rotation per stage id, stable across reloads — "slightly off," not jittery
function seededRotation(id){ return (fnv('rot:'+id) % 500) / 100 - 2.5; } // -2.5deg .. +2.5deg

const STAGES = [
  {id:'night1', title:'Night 1 · Static', ready:true},
  {id:'night2', title:"Night 2 · It's In The Metadata", ready:true},
  {id:'night3', title:'Night 3 · 10,000 Cats', ready:true},
  {id:'night4', title:'Night 4', ready:false},
  {id:'night5', title:'Night 5', ready:false},
  {id:'nightmare', title:'Nightmare', ready:false},
  {id:'abyss', title:'Abyss', ready:false},
];

function renderStages(){
  const wrap = document.getElementById('stages');
  STAGES.forEach(s=>{
    const el = document.createElement('div');
    el.className = 'stage' + (s.ready ? '' : ' placeholder');
    el.style.transform = `rotate(${seededRotation(s.id)}deg)`;
    el.id = 'stage-' + s.id;
    if(s.ready){
      el.innerHTML = `<div class="lab">${s.id}</div><h2>${s.title}</h2><div class="body"></div>`;
    } else {
      el.innerHTML = `<div class="lab">${s.id}</div><h2>${s.title}</h2><div class="body" style="font-family:var(--mono);font-size:.8rem;color:var(--dim)">not yet.</div>`;
    }
    wrap.appendChild(el);
  });
}
</script>
```

Modify `renderModule()` from Step 1 to call `renderStages()` at the end (after the template literal is assigned to `app.innerHTML`).

- [ ] **Step 3: Verify with real pointer clicks — locked stub**

Serve locally: `python3 -m http.server 8787` from repo root. Open `http://localhost:8787/public/crypto/fnac/?v=1` in a clean browser profile (no `ctf-fnac-unlocked` cookie set). Confirm the "nothing here yet" locked stub renders and the link to Module 2 works. Use Chrome MCP to click the link and confirm navigation.

- [ ] **Step 4: Verify with real pointer clicks — unlocked shell**

In the browser console (or via Chrome MCP `javascript_tool`), run `document.cookie='ctf-fnac-unlocked=1;path=/'` then reload. Confirm all 7 stage cards render, Night 1-3 show as active, Night 4/5/Nightmare/Abyss show as dimmed placeholders, and each card has a small visibly-different rotation.

- [ ] **Step 5: Commit**

```bash
git add public/crypto/fnac/index.html
git commit -m "feat(fnac): page shell, cookie gate, stage grid, placeholders"
```

---

### Task 6: Shared decode helpers + Raw Bytes Viewer

**Files:**
- Modify: `public/crypto/fnac/index.html`

**Interfaces:**
- Consumes: nothing external.
- Produces: `toBytes(str)->Uint8Array`, `toStr(bytes)->str`, `bytesToHexDump(bytes, bytesPerRow=16)->string`, `readFileAsBytes(file)->Promise<Uint8Array>`, `mountRawBytesViewer(container, onBytes)` — consumed by Task 9 (Night 1) and Task 10 (Night 2, decoy path).

- [ ] **Step 1: Add byte/hex helpers to the script**

```html
<script>
const toBytes = s => { const u=new Uint8Array(s.length); for(let i=0;i<s.length;i++) u[i]=s.charCodeAt(i)&255; return u; };
const toStr = b => { let s=''; for(let i=0;i<b.length;i++) s+=String.fromCharCode(b[i]); return s; };
const printable = s => s.replace(/[^\x20-\x7E\n]/g,'·');

function readFileAsBytes(file){
  return new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onload = ()=>resolve(new Uint8Array(r.result));
    r.onerror = ()=>reject(r.error);
    r.readAsArrayBuffer(file);
  });
}

function bytesToHexDump(bytes, bytesPerRow=16){
  let out = '';
  for(let row=0; row*bytesPerRow < bytes.length; row++){
    const start = row*bytesPerRow;
    const chunk = bytes.slice(start, start+bytesPerRow);
    const hex = Array.from(chunk).map(b=>b.toString(16).padStart(2,'0')).join(' ').padEnd(bytesPerRow*3-1,' ');
    const ascii = printable(toStr(chunk));
    out += start.toString(16).padStart(6,'0') + '  ' + hex + '  ' + ascii + '\n';
  }
  return out;
}
</script>
```

- [ ] **Step 2: Verify the hex-dump helper with a quick node check**

Run:
```bash
node -e "
function toStr(b){let s='';for(let i=0;i<b.length;i++)s+=String.fromCharCode(b[i]);return s;}
function printable(s){return s.replace(/[^\x20-\x7E\n]/g,'·');}
function bytesToHexDump(bytes, bytesPerRow=16){
  let out='';
  for(let row=0; row*bytesPerRow<bytes.length; row++){
    const start=row*bytesPerRow, chunk=bytes.slice(start,start+bytesPerRow);
    const hex=Array.from(chunk).map(b=>b.toString(16).padStart(2,'0')).join(' ').padEnd(bytesPerRow*3-1,' ');
    out += start.toString(16).padStart(6,'0')+'  '+hex+'  '+printable(toStr(chunk))+'\n';
  }
  return out;
}
const b = new Uint8Array([0x66,0x6c,0x61,0x67,0x7b,0x74,0x65,0x73,0x74,0x7d]);
console.log(bytesToHexDump(b));
"
```
Expected: one line, `000000  66 6c 61 67 7b 74 65 73 74 7d              flag{test}` (padding may vary slightly) — confirms offset/hex/ascii columns line up before this logic gets embedded in the page.

- [ ] **Step 3: Add the Raw Bytes Viewer widget (file-drop zone + hex dump render)**

```html
<style>
  .dropzone{font-family:var(--mono); font-size:.78rem; color:var(--dim); border:1px dashed var(--edge);
    border-radius:6px; padding:20px; text-align:center; cursor:pointer}
  .dropzone.over{border-color:var(--gold); color:var(--gold)}
  .hexdump{font-family:var(--mono); font-size:.72rem; line-height:1.5; color:var(--ink); background:#000;
    border:1px solid var(--edge); border-radius:5px; padding:12px; white-space:pre; overflow:auto; max-height:280px}
</style>
<script>
function mountRawBytesViewer(container, onBytes){
  container.innerHTML = `<div class="dropzone">drop a file here (stands in for <b>xxd</b>) — or click to choose</div><div class="hexdump" style="display:none"></div>`;
  const zone = container.querySelector('.dropzone');
  const dump = container.querySelector('.hexdump');
  const input = document.createElement('input'); input.type='file'; input.style.display='none';
  container.appendChild(input);

  async function handle(file){
    if(!file) return;
    try{
      const bytes = await readFileAsBytes(file);
      dump.style.display = 'block';
      dump.textContent = bytesToHexDump(bytes);
      if(onBytes) onBytes(bytes);
    }catch(e){
      dump.style.display = 'block';
      dump.textContent = "couldn't read that file.";
    }
  }
  zone.addEventListener('click', ()=>input.click());
  input.addEventListener('change', ()=>handle(input.files[0]));
  zone.addEventListener('dragover', e=>{ e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', ()=>zone.classList.remove('over'));
  zone.addEventListener('drop', e=>{ e.preventDefault(); zone.classList.remove('over'); handle(e.dataTransfer.files[0]); });
}
</script>
```

- [ ] **Step 4: Verify with real pointer clicks**

Add a temporary `<div id="test-raw"></div>` and `mountRawBytesViewer(document.getElementById('test-raw'))` call, reload with `?v=N`, use Chrome MCP to drag-and-drop (or click-to-choose) any small local file, confirm the hex dump renders with plausible offset/hex/ascii columns and doesn't throw on a non-PNG file. Remove the temporary test div/call afterward.

- [ ] **Step 5: Commit**

```bash
git add public/crypto/fnac/index.html
git commit -m "feat(fnac): shared byte helpers + Raw Bytes Viewer widget"
```

---

### Task 7: Metadata Viewer widget

**Files:**
- Modify: `public/crypto/fnac/index.html`

**Interfaces:**
- Consumes: `readFileAsBytes` from Task 6.
- Produces: `parsePngTextChunks(bytes)->{keyword:text}`, `mountMetadataViewer(container)` — consumed by Task 10 (Night 2).

- [ ] **Step 1: Add the JS PNG text-chunk parser (mirrors `fnac_png.read_text_chunks` in Python)**

```html
<script>
function parsePngTextChunks(bytes){
  const out = {};
  const sig = [0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A];
  for(let i=0;i<8;i++) if(bytes[i]!==sig[i]) return out; // not a PNG — return empty, never throw
  let pos = 8;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  while(pos + 8 <= bytes.length){
    const length = dv.getUint32(pos);
    const type = toStr(bytes.slice(pos+4,pos+8));
    const data = bytes.slice(pos+8, pos+8+length);
    if(type === 'tEXt'){
      const nul = data.indexOf(0);
      if(nul >= 0) out[toStr(data.slice(0,nul))] = toStr(data.slice(nul+1));
    }
    pos += 12 + length;
    if(type === 'IEND') break;
  }
  return out;
}
</script>
```

- [ ] **Step 2: Verify with a quick node round-trip against a real generated Night 2 asset**

Run: `node -e "console.log(require('fs').readFileSync('public/crypto/fnac/assets/night2/file-4.png').slice(0,4))"` first to confirm the file exists from Task 3, then check parsing manually via the browser console once wired (Step 4) rather than a pure-node check — `DataView`/`Uint8Array` from `fs.readFileSync` need a small adapter in node, and this parser is simple enough that the in-browser check in Step 4 is the real gate.

- [ ] **Step 3: Add the Metadata Viewer widget**

```html
<style>
  .meta-table{font-family:var(--mono); font-size:.76rem; color:var(--ink); background:#000;
    border:1px solid var(--edge); border-radius:5px; width:100%; border-collapse:collapse}
  .meta-table td{padding:6px 10px; border-bottom:1px solid var(--edge)}
  .meta-table td:first-child{color:var(--gold)}
</style>
<script>
function mountMetadataViewer(container){
  container.innerHTML = `<div class="dropzone">drop a file here (stands in for <b>exiftool</b>) — or click to choose</div><div></div>`;
  const zone = container.querySelector('.dropzone');
  const resultBox = container.querySelector('div:last-child');
  const input = document.createElement('input'); input.type='file'; input.style.display='none';
  container.appendChild(input);

  async function handle(file){
    if(!file) return;
    try{
      const bytes = await readFileAsBytes(file);
      const fields = parsePngTextChunks(bytes);
      const keys = Object.keys(fields);
      if(!keys.length){ resultBox.textContent = 'no text metadata found.'; return; }
      const table = document.createElement('table'); table.className='meta-table';
      keys.forEach(k=>{ const tr=document.createElement('tr');
        tr.innerHTML = `<td>${k}</td><td>${fields[k]}</td>`; table.appendChild(tr); });
      resultBox.innerHTML = ''; resultBox.appendChild(table);
    }catch(e){
      resultBox.textContent = "couldn't read that file.";
    }
  }
  zone.addEventListener('click', ()=>input.click());
  input.addEventListener('change', ()=>handle(input.files[0]));
  zone.addEventListener('dragover', e=>{ e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', ()=>zone.classList.remove('over'));
  zone.addEventListener('drop', e=>{ e.preventDefault(); zone.classList.remove('over'); handle(e.dataTransfer.files[0]); });
}
</script>
```

- [ ] **Step 4: Verify with real pointer clicks against the actual Night 2 asset**

Add a temporary `<div id="test-meta"></div>` + `mountMetadataViewer(document.getElementById('test-meta'))`, reload with `?v=N`, use Chrome MCP to drop `public/crypto/fnac/assets/night2/file-4.png` onto it (download it from the served page first, or reference the local file path in the OS file picker). Confirm the table shows `Comment: Data` and `Flag: flag{its_in_the_metadata}`. Remove the temporary test div/call afterward.

- [ ] **Step 5: Commit**

```bash
git add public/crypto/fnac/index.html
git commit -m "feat(fnac): Metadata Viewer widget"
```

---

### Task 8: Bit-Plane / LSB Viewer widget

**Files:**
- Modify: `public/crypto/fnac/index.html`

**Interfaces:**
- Consumes: `readFileAsBytes`, `printable`, `toStr` from Task 6.
- Produces: `extractLsbMessage(imageData)->Uint8Array`, `mountBitPlaneViewer(container)` — consumed by Task 11 (Night 3).

- [ ] **Step 1: Add the JS LSB extractor (mirrors `fnac_png.extract_lsb_message`)**

```html
<script>
function extractLsbMessage(imageData, maxLen=4096){
  const d = imageData.data; // RGBA, one pixel = 4 bytes, R channel is index 0 of each pixel
  const bit = i => d[i*4] & 1;
  let lengthBits = '';
  for(let i=0;i<32;i++) lengthBits += bit(i);
  const length = Math.min(parseInt(lengthBits,2) || 0, maxLen);
  const bytes = new Uint8Array(length);
  for(let by=0; by<length; by++){
    let byteBits = '';
    for(let bi=0; bi<8; bi++) byteBits += bit(32 + by*8 + bi);
    bytes[by] = parseInt(byteBits,2);
  }
  return bytes;
}
</script>
```

- [ ] **Step 2: Verify with a quick node check using a hand-built ImageData-shaped object**

Run:
```bash
node -e "
function extractLsbMessage(imageData, maxLen=4096){
  const d = imageData.data;
  const bit = i => d[i*4] & 1;
  let lengthBits=''; for(let i=0;i<32;i++) lengthBits+=bit(i);
  const length = Math.min(parseInt(lengthBits,2)||0, maxLen);
  const bytes = new Uint8Array(length);
  for(let by=0; by<length; by++){ let bb=''; for(let bi=0; bi<8; bi++) bb+=bit(32+by*8+bi); bytes[by]=parseInt(bb,2); }
  return bytes;
}
// build a fake 'flag{x}' payload (7 bytes) preceded by its 32-bit length, one bit per pixel R channel
const msg = Buffer.from('flag{x}');
const lenBits = msg.length.toString(2).padStart(32,'0');
const bits = lenBits + Array.from(msg).map(b=>b.toString(2).padStart(8,'0')).join('');
const data = new Uint8Array(bits.length*4);
for(let i=0;i<bits.length;i++) data[i*4] = parseInt(bits[i]);
console.log(Buffer.from(extractLsbMessage({data})).toString());
"
```
Expected: prints `flag{x}` — confirms the bit-order/length-prefix logic matches the Python encoder from Task 2 before it's wired to a real canvas.

- [ ] **Step 3: Add the Bit-Plane Viewer widget (canvas-based, auto-decodes on drop)**

```html
<style>
  .bp-canvas{image-rendering:pixelated; max-width:100%; border:1px solid var(--edge); border-radius:4px}
</style>
<script>
function mountBitPlaneViewer(container){
  container.innerHTML = `<div class="dropzone">drop an image here (stands in for <b>zsteg</b>) — or click to choose</div>
    <canvas class="bp-canvas" style="display:none"></canvas><div class="hexdump" style="display:none"></div>`;
  const zone = container.querySelector('.dropzone');
  const canvas = container.querySelector('canvas');
  const dump = container.querySelector('.hexdump');
  const input = document.createElement('input'); input.type='file'; input.style.display='none';
  container.appendChild(input);

  function handle(file){
    if(!file) return;
    const img = new Image();
    img.onload = ()=>{
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img,0,0);
      canvas.style.display = 'block';
      try{
        const imageData = ctx.getImageData(0,0,canvas.width,canvas.height);
        const bytes = extractLsbMessage(imageData);
        dump.style.display = 'block';
        dump.textContent = 'R-channel LSB, first bits: ' + printable(toStr(bytes));
      }catch(e){
        dump.style.display = 'block';
        dump.textContent = "couldn't read that image.";
      }
    };
    img.onerror = ()=>{ dump.style.display='block'; dump.textContent = "couldn't read that as an image."; };
    img.src = URL.createObjectURL(file);
  }
  zone.addEventListener('click', ()=>input.click());
  input.addEventListener('change', ()=>handle(input.files[0]));
  zone.addEventListener('dragover', e=>{ e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', ()=>zone.classList.remove('over'));
  zone.addEventListener('drop', e=>{ e.preventDefault(); zone.classList.remove('over'); handle(e.dataTransfer.files[0]); });
}
</script>
```

- [ ] **Step 4: Verify with real pointer clicks against a real Night 3 asset**

Add a temporary `<div id="test-bp"></div>` + `mountBitPlaneViewer(document.getElementById('test-bp'))`, reload with `?v=N`, use Chrome MCP to drop `public/crypto/fnac/assets/night3/cat-0.png` onto it. Confirm the canvas renders the cat photo and the readout below shows `flag{ten_thousand_cats}`. Remove the temporary test div/call afterward.

- [ ] **Step 5: Commit**

```bash
git add public/crypto/fnac/index.html
git commit -m "feat(fnac): Bit-Plane/LSB Viewer widget"
```

---

### Task 9: Night 1 puzzle wiring

**Files:**
- Modify: `public/crypto/fnac/index.html`

**Interfaces:**
- Consumes: `mountRawBytesViewer` from Task 6, `STAGES`/`renderStages` from Task 5.
- Produces: solved-state entry for `night1`, calls `window.fxSolved('night1')` on capture.

- [ ] **Step 1: Wire Night 1's stage body — two download links, two Raw Bytes Viewer instances, one flag input**

Replace the `night1` stage's placeholder body-building in `renderStages()` (from Task 5) with a dedicated builder function:

```html
<script>
function buildNight1(bodyEl){
  bodyEl.innerHTML = `
    <p style="font-family:var(--mono);font-size:.82rem;color:var(--dim)">
      Two files came off the same feed. Both look like dead air. Neither one is, quite.
    </p>
    <p><a href="assets/night1/file-a.png" download style="color:var(--gold)">↓ file-a.png</a>
       &nbsp; <a href="assets/night1/file-b.png" download style="color:var(--gold)">↓ file-b.png</a></p>
    <div class="tool-a" style="margin-top:10px"></div>
    <div class="tool-b" style="margin-top:10px"></div>
    <div class="submit" style="display:flex;gap:9px;margin-top:16px">
      <input class="flag-input" placeholder="assemble the two halves — flag{...}" style="flex:1;font-family:var(--mono);background:#000;color:var(--gold);border:1px solid var(--edge);border-radius:6px;padding:10px">
      <button class="flag-check" style="font-family:var(--mono);font-weight:700;background:var(--accent);color:#fff;border:none;border-radius:6px;padding:0 16px">SUBMIT</button>
    </div>
    <div class="verdict" style="font-family:var(--mono);font-size:.76rem;margin-top:8px"></div>
  `;
  mountRawBytesViewer(bodyEl.querySelector('.tool-a'));
  mountRawBytesViewer(bodyEl.querySelector('.tool-b'));
  wireFlagCheck(bodyEl, 'night1', 'flag{tune_into_the_static}');
}
</script>
```

- [ ] **Step 2: Add the shared `wireFlagCheck` helper (used by every night)**

```html
<script>
let storedFnacSolved = new Set();
try{ storedFnacSolved = new Set(JSON.parse(localStorage.getItem('ctf-solved:v2:fnac') || '[]')); }catch(e){}

function wireFlagCheck(bodyEl, stageId, answer){
  const input = bodyEl.querySelector('.flag-input');
  const verdict = bodyEl.querySelector('.verdict');
  const stageEl = document.getElementById('stage-' + stageId);
  function capture(){
    stageEl.classList.add('solved');
    verdict.textContent = 'correct — captured';
    verdict.style.color = 'var(--ok)';
    if(window.fxSolved) window.fxSolved(stageId);
  }
  function check(){
    const v = input.value.trim();
    if(v.toLowerCase() === answer.toLowerCase()) capture();
    else if(v){ verdict.textContent = 'not it.'; verdict.style.color = 'var(--accent)'; }
  }
  bodyEl.querySelector('.flag-check').onclick = check;
  input.addEventListener('keydown', e=>{ if(e.key==='Enter') check(); });
  if(storedFnacSolved.has(stageId)) capture();
}
</script>
```

- [ ] **Step 3: Call `buildNight1` from `renderStages()`**

In Task 5's `renderStages()`, change the `if(s.ready)` branch so that after setting `el.innerHTML`, it dispatches to a per-stage builder:

```javascript
if(s.ready){
  el.innerHTML = `<div class="lab">${s.id}</div><h2>${s.title}</h2><div class="body"></div>`;
  const body = el.querySelector('.body');
  if(s.id === 'night1') buildNight1(body);
  // night2 / night3 builders added in Tasks 10-11
}
```

- [ ] **Step 4: Verify with real pointer clicks**

Serve locally, set the unlock cookie (Task 5 Step 4 method), reload with `?v=N`. Use Chrome MCP to: download `file-a.png`, drag it onto the first Raw Bytes Viewer, confirm the hex dump appears with a spottable ASCII run; repeat for `file-b.png`; type `flag{tune_into_the_static}` into the input and click SUBMIT; confirm the stage shows solved and the flag persists across a reload.

- [ ] **Step 5: Commit**

```bash
git add public/crypto/fnac/index.html
git commit -m "feat(fnac): wire Night 1 puzzle"
```

---

### Task 10: Night 2 puzzle wiring

**Files:**
- Modify: `public/crypto/fnac/index.html`

**Interfaces:**
- Consumes: `mountRawBytesViewer` (Task 6), `mountMetadataViewer` (Task 7), `wireFlagCheck` (Task 9).
- Produces: solved-state entry for `night2`.

- [ ] **Step 1: Add `buildNight2`**

```html
<script>
function buildNight2(bodyEl){
  bodyEl.innerHTML = `
    <p style="font-family:var(--mono);font-size:.82rem;color:var(--dim)">
      Four more files. Same static. You already know how to read the bytes — try it, see what you get.
    </p>
    <p>${[1,2,3,4].map(i=>`<a href="assets/night2/file-${i}.png" download style="color:var(--gold);margin-right:10px">↓ file-${i}.png</a>`).join('')}</p>
    <div class="lab" style="font-family:var(--mono);font-size:.66rem;letter-spacing:.14em;color:var(--dim);margin-top:14px">RAW BYTES (the old way)</div>
    <div class="tool-raw"></div>
    <div class="lab" style="font-family:var(--mono);font-size:.66rem;letter-spacing:.14em;color:var(--dim);margin-top:14px">METADATA (try this instead)</div>
    <div class="tool-meta"></div>
    <div class="submit" style="display:flex;gap:9px;margin-top:16px">
      <input class="flag-input" placeholder="flag{...}" style="flex:1;font-family:var(--mono);background:#000;color:var(--gold);border:1px solid var(--edge);border-radius:6px;padding:10px">
      <button class="flag-check" style="font-family:var(--mono);font-weight:700;background:var(--accent);color:#fff;border:none;border-radius:6px;padding:0 16px">SUBMIT</button>
    </div>
    <div class="verdict" style="font-family:var(--mono);font-size:.76rem;margin-top:8px"></div>
  `;
  mountRawBytesViewer(bodyEl.querySelector('.tool-raw'));
  mountMetadataViewer(bodyEl.querySelector('.tool-meta'));
  wireFlagCheck(bodyEl, 'night2', 'flag{its_in_the_metadata}');
}
</script>
```

- [ ] **Step 2: Wire it into `renderStages()`**

```javascript
if(s.id === 'night2') buildNight2(body);
```

- [ ] **Step 3: Verify with real pointer clicks**

Reload with the unlock cookie set. Use Chrome MCP to: drop `file-1.png` onto the Raw Bytes tool, confirm the ASCII column shows `trolololo` garbage (the decoy); drop `file-4.png` onto the Metadata tool, confirm the table shows `Comment: Data` and `Flag: flag{its_in_the_metadata}`; submit the flag; confirm solved + persists on reload.

- [ ] **Step 4: Commit**

```bash
git add public/crypto/fnac/index.html
git commit -m "feat(fnac): wire Night 2 puzzle"
```

---

### Task 11: Night 3 puzzle wiring, module-wide confetti/reset wiring

**Files:**
- Modify: `public/crypto/fnac/index.html`

**Interfaces:**
- Consumes: `mountBitPlaneViewer` (Task 8), `wireFlagCheck` (Task 9), `fnv`/`UID` (Task 5).
- Produces: solved-state entry for `night3`; module-wide `window.FX_TOTAL`, `window.FX_MODULE`, confetti script includes; reset button.

- [ ] **Step 1: Add `buildNight3` with per-user variant selection**

```html
<script>
function buildNight3(bodyEl){
  const variant = fnv(UID + ':fnac:night3') % 10;
  bodyEl.innerHTML = `
    <p style="font-family:var(--mono);font-size:.82rem;color:var(--dim)">
      Somebody's been feeding a stray. The photo's ordinary. That's the point.
    </p>
    <p><a href="assets/night3/cat-${variant}.png" download style="color:var(--gold)">↓ cat-${variant}.png</a></p>
    <div class="tool-bp" style="margin-top:10px"></div>
    <div class="submit" style="display:flex;gap:9px;margin-top:16px">
      <input class="flag-input" placeholder="flag{...}" style="flex:1;font-family:var(--mono);background:#000;color:var(--gold);border:1px solid var(--edge);border-radius:6px;padding:10px">
      <button class="flag-check" style="font-family:var(--mono);font-weight:700;background:var(--accent);color:#fff;border:none;border-radius:6px;padding:0 16px">SUBMIT</button>
    </div>
    <div class="verdict" style="font-family:var(--mono);font-size:.76rem;margin-top:8px"></div>
  `;
  mountBitPlaneViewer(bodyEl.querySelector('.tool-bp'));
  wireFlagCheck(bodyEl, 'night3', 'flag{ten_thousand_cats}');
}
</script>
```

- [ ] **Step 2: Wire it into `renderStages()` and set `FX_TOTAL` before the confetti scripts load**

```javascript
if(s.id === 'night3') buildNight3(body);
```

Add near the top of the main script block (before any confetti includes): `window.FX_TOTAL = 7;` (matches `STAGES.length` — kept as a literal per the Encoding module's own convention of a plain assignment).

- [ ] **Step 3: Add the confetti includes and a reset button at the bottom of `<body>`, mirroring Encoding's exact pattern**

```html
<div class="reset-row" style="display:flex;justify-content:center;margin:48px 0 36px">
  <button id="reset-mod" style="font-family:var(--mono);font-size:.66rem;letter-spacing:.16em;cursor:pointer;color:var(--dim);background:none;border:1px solid var(--edge);border-radius:6px;padding:8px 14px">RESET MODULE</button>
</div>
<script>
(function(){
  const btn=document.getElementById('reset-mod'); if(!btn) return;
  let armed=false, t;
  btn.addEventListener('click', ()=>{
    if(!armed){ armed=true; btn.textContent='CONFIRM — ERASE PROGRESS?';
      t=setTimeout(()=>{ armed=false; btn.textContent='RESET MODULE'; }, 3500); }
    else { clearTimeout(t); if(window.fxReset) window.fxReset();
      try{ localStorage.removeItem('ctf-solved:v2:fnac'); }catch(e){} location.reload(); }
  });
})();
</script>
<script src="../confetti/manifest.js"></script>
<script>window.FX_MODULE='fnac';</script>
<script src="../confetti/engine.js"></script>
```

Note: `wireFlagCheck` (Task 9) needs to also push solved ids into `localStorage['ctf-solved:v2:fnac']` on capture, matching Encoding's pattern — add this line to `capture()` in `wireFlagCheck`:

```javascript
function capture(){
  stageEl.classList.add('solved');
  verdict.textContent = 'correct — captured';
  verdict.style.color = 'var(--ok)';
  storedFnacSolved.add(stageId);
  try{ localStorage.setItem('ctf-solved:v2:fnac', JSON.stringify([...storedFnacSolved])); }catch(e){}
  if(window.fxSolved) window.fxSolved(stageId);
}
```

- [ ] **Step 4: Verify with real pointer clicks**

Reload with unlock cookie set. Use Chrome MCP to: download the assigned `cat-N.png`, drop it on the Bit-Plane Viewer, confirm the readout shows `flag{ten_thousand_cats}`; submit; confirm solved. Then solve Night 1 and Night 2 too (already verified individually in Tasks 9-10) in the same session and confirm the module-completion confetti fires once all three real nights are solved (`FX_TOTAL=7` means it won't fire for real until placeholders become real — spot-check by temporarily setting `FX_TOTAL=3` in devtools console and re-solving, then revert).

- [ ] **Step 5: Confirm two different `ctf-uid` cookies get different Night 3 variants**

Via Chrome MCP `javascript_tool`, set `document.cookie='ctf-uid=testuser1;path=/'`, reload, note the assigned `cat-N.png`; repeat with `ctf-uid=testuser2`. Confirm the two indices differ (not guaranteed for every pair given mod-10, but should differ for at least a couple of tried values — if every value you try collides, re-check the `fnv` seed string for a bug before moving on).

- [ ] **Step 6: Commit**

```bash
git add public/crypto/fnac/index.html
git commit -m "feat(fnac): wire Night 3 puzzle, confetti/reset wiring"
```

---

### Task 12: Encoding module unlock hook

**Files:**
- Modify: `public/crypto/encoding/index.html:326` (the `capture()` function inside the `PUZZLES.forEach` loop)

**Interfaces:**
- Consumes: nothing new.
- Produces: sets `ctf-fnac-unlocked` cookie once the module is fully solved; adds a link element to the completion state.

- [ ] **Step 1: Add an "all solved" check and cookie-set + link reveal**

After the existing `PUZZLES.forEach(...)` block (around `public/crypto/encoding/index.html:347`, right after the loop closes), add:

```javascript
function checkFnacUnlock(){
  const solved = new Set(JSON.parse(localStorage.getItem('ctf-solved:v2:encoding') || '[]'));
  if(PUZZLES.every(p => solved.has(p.id))){
    document.cookie = 'ctf-fnac-unlocked=1;path=/;max-age=31536000;samesite=lax';
    if(!document.getElementById('fnac-link')){
      const a = document.createElement('a');
      a.id = 'fnac-link'; a.href = '../fnac/'; a.textContent = '→ something else woke up';
      a.style.cssText = 'display:block;text-align:center;font-family:var(--mono);font-size:.8rem;margin:20px 0;color:var(--accent)';
      document.querySelector('.wrap').insertBefore(a, document.querySelector('.reset-row'));
    }
  }
}
checkFnacUnlock();
```

This needs to also run on every `capture()` (not just page load), since the cookie should flip the moment the last puzzle is solved without a reload. Modify the existing `capture()` function (around line 326) to call it:

```javascript
function capture(){ node.classList.add('solved'); verdict.className='verdict ok'; verdict.textContent='correct — flag captured'; if(window.fxSolved) window.fxSolved(p.id); checkFnacUnlock(); }
```

- [ ] **Step 2: Verify with real pointer clicks**

Serve locally, open `/public/crypto/encoding/?v=N` with a clean localStorage, solve all 9 puzzles via Chrome MCP (or set `localStorage['ctf-solved:v2:encoding']` directly to all 9 ids and reload to fast-path this check), confirm the `→ something else woke up` link appears and `document.cookie` contains `ctf-fnac-unlocked=1`. Click the link, confirm it lands on the now-unlocked FNAC shell.

- [ ] **Step 3: Commit**

```bash
git add public/crypto/encoding/index.html
git commit -m "feat(encoding): unlock Five Nights at Crypto's on full completion"
```

---

### Task 13: Full end-to-end verification pass

**Files:** none (verification only)

- [ ] **Step 1: Fresh-profile walkthrough**

Using Chrome MCP with a clean cookie/localStorage state: open Encoding, solve all 9 puzzles via real pointer clicks, confirm the unlock link + cookie appear, click through to FNAC, solve Night 1/2/3 via real pointer clicks (download → drop on tool → read result → submit), confirm each stage's solved-tick and the shared confetti/reset behavior.

- [ ] **Step 2: Aesthetic check**

Confirm: black background, visibly different rotation per stage card, and the `.raw-html` visitor-log panel from Task 5 renders as genuinely unstyled (serif font, white background, no card chrome) against the black page.

- [ ] **Step 3: Reload/persistence check**

Reload mid-module after solving Night 1 only; confirm Night 1 shows solved and Night 2/3 remain unsolved (state persists correctly per-stage, not just module-wide).

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore(fnac): end-to-end verification pass"
```

(Only if Step 2 required an actual code change — otherwise this task produces no diff and there's nothing to commit.)

---

## Explicitly out of scope for this plan
- Night 4, Night 5, Nightmare, Abyss puzzle content — placeholder cards only (Task 5).
- The Win95-chrome styled window — per the spec, it's earmarked as the home for an in-world
  "found document" cipher spec on a *later* night (Nightmare/Abyss), not required for Night 1-3.
- Deployment (`npx wrangler deploy`) — not deployed until user go, per project convention.
- Hashing toy page and XOR module rewrite — separate plans.
