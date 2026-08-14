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


def bit_split(data: bytes) -> tuple:
    """Splits a file at the bit level into two halves (Night 2, "Raw Bit Weaving").

    Bits within a source byte are numbered 7 (MSB) .. 0 (LSB).
      half A collects the EVEN-indexed bits of each byte, in the order 6, 4, 2, 0
      half B collects the ODD-indexed  bits of each byte, in the order 7, 5, 3, 1

    Each source byte therefore contributes exactly one nibble (4 bits) to each
    half. Nibbles are packed MSB-first, in source order: source byte 0 becomes
    the HIGH nibble of output byte 0, source byte 1 the LOW nibble of output
    byte 0, source byte 2 the high nibble of output byte 1, and so on. Each half
    is therefore ceil(len/2) bytes. If the source length is odd the final output
    byte's LOW nibble is zero-padded (and the original length cannot be recovered
    from the halves alone — build_fnac_assets.py asserts an even-length source so
    the weave is an exact inverse).
    """
    a_bits, b_bits = [], []
    for byte in data:
        for bit in (6, 4, 2, 0):
            a_bits.append((byte >> bit) & 1)
        for bit in (7, 5, 3, 1):
            b_bits.append((byte >> bit) & 1)

    def pack(bits):
        # bits are already in emit order; pack 8 at a time, MSB-first.
        if len(bits) % 8:
            bits = bits + [0] * (8 - len(bits) % 8)
        return bytes(int(''.join(str(x) for x in bits[i:i + 8]), 2)
                     for i in range(0, len(bits), 8))

    return pack(a_bits), pack(b_bits)


def bit_weave(half_a: bytes, half_b: bytes) -> bytes:
    """Exact inverse of bit_split. Returns 2 * len(half_a) bytes; if the original
    source had an odd length, the caller must drop the final (zero-padded) byte."""
    if len(half_a) != len(half_b):
        raise ValueError(f'halves differ in length: {len(half_a)} vs {len(half_b)}')
    out = bytearray()
    for i in range(len(half_a) * 2):
        nib_a = (half_a[i // 2] >> 4) & 0xF if i % 2 == 0 else half_a[i // 2] & 0xF
        nib_b = (half_b[i // 2] >> 4) & 0xF if i % 2 == 0 else half_b[i // 2] & 0xF
        byte = 0
        for pos, bit in enumerate((6, 4, 2, 0)):
            byte |= ((nib_a >> (3 - pos)) & 1) << bit
        for pos, bit in enumerate((7, 5, 3, 1)):
            byte |= ((nib_b >> (3 - pos)) & 1) << bit
        out.append(byte)
    return bytes(out)


def xor_repeating(data: bytes, key: bytes) -> bytes:
    """Repeating-key XOR (Night 3). Its own inverse."""
    if not key:
        raise ValueError('empty key')
    return bytes(b ^ key[i % len(key)] for i, b in enumerate(data))


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
