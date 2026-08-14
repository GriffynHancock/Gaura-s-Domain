> Presenter/solution reference — do not show to participants

# Tung Tung Tung Sahur (Five Nights at Crypto's, Night 3)

**⚠ This night replaced an earlier one.** Night 3 used to be "Ten Thousand Cats"
(`flag{ten_thousand_cats}`, LSB steganography in one of ten per-student cat photos).
That puzzle and its assets are gone, and with them the per-student cover-image variance —
**Night 3 is now identical for every student**. If you are holding an older printout,
discard it.

**Source:** real, fixed content. Key, plaintext and hint image all defined directly in
`tools/build_fnac_assets.py` (`NIGHT3_KEY = b'tung tung tung sahur'`,
`NIGHT3_PLAINTEXT`), XOR'd by `xor_repeating` in `tools/fnac_png.py`. Confirmed by
decrypting the actual shipped `message.txt`. Not per-user randomized.

**Attachments:** referenced by relative path in `challenge.yml`'s `files:` list (verified
resolvable from this folder), not copied:
`../../../../public/crypto/fnac/assets/night3/message.txt` (118 bytes) and
`hint-sahur.webp` (30968 bytes). **The hint image is part of the puzzle, not decoration** —
it is a picture of the meme character whose name *is* the key, and it is the only thing
that tells a student what words the recovered `tung ` fragment belongs to. Attach it.
`challenge.yml` also carries the ciphertext inline as a hex dump, because `message.txt`
contains NUL bytes and cannot survive being pasted as text.

## Mechanism

Repeating-key XOR — its own inverse. The 20-byte key `tung tung tung sahur` is cycled
over the plaintext, byte by byte.

The way in is a **crib**. The plaintext begins with the flag, so its first five bytes are
known to be `flag{`; XOR those against the first five ciphertext bytes and the first five
key bytes fall out as `tung `. From there the meme name (and the hint image) supplies the
rest of the key, and its 20-byte length is the last thing to pin down.

Two properties of this ciphertext are deliberate and worth not breaking if it is ever
rebuilt:

- **It stays 7-bit** (`max(cipher) < 0x80`) and contains **no CR or LF**, so it survives
  a text-mode transfer, a copy-paste, or a Windows/Unix line-ending rewrite unchanged.
- **It does contain NUL bytes** — nine of them. That is unavoidable: the flag repeats the
  key's own words, and a byte XOR'd with itself is zero. They transfer verbatim in
  binary, but they are why the paper fallback ships a hex dump rather than a text block.

## Solution

```python
import pathlib

def xor_repeating(data, key):
    return bytes(b ^ key[i % len(key)] for i, b in enumerate(data))

c = pathlib.Path('message.txt').read_bytes()

# step 1 — the crib: 'flag{' against the first five bytes
print(bytes(x ^ y for x, y in zip(c[:5], b'flag{')))   # b'tung '

# step 2 — the whole key, once you recognise the name
print(xor_repeating(c, b'tung tung tung sahur').decode())
```

Verified directly against the shipped file. Full plaintext:

```
flag{tung_tung_tung_sahur} A shape in the hallway, dragging a bat. It always counts to
three. Do not be here for four.
```

**Flag:** `flag{tung_tung_tung_sahur}`

## Presenter notes

This is the same lesson as the XOR module's "Crib the Key" (challenge 17), landing in a
file-forensics costume: a repeating key is only as strong as your ignorance of the
plaintext, and in a CTF you are never ignorant of the plaintext — you always know it
contains `flag{`.

Offline, `xortool` (Kali-preinstalled) or CyberChef's XOR Brute Force will both get there;
so will the five-line crib above, which is faster and actually teaches the mechanism. The
live site ships an on-page XOR BENCH tool that stands in for those. If a student recovers
`tung ` and stalls, show them the hint image — recognising the character is the intended
bridge from five bytes of key to twenty.
