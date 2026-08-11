"""PNG chunk helpers for Five Nights at Crypto's asset generation.
Pure functions, no CLI — see build_fnac_assets.py for the orchestrator."""
import struct
import random
import io
import zlib
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
