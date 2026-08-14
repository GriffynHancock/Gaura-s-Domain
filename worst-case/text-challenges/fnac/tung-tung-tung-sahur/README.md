> Presenter/solution reference — do not show to participants

# Triple T (Five Nights at Crypto's, Night 3)

**⚠ This night has been reworked twice — check what you are holding.**
It first replaced "Ten Thousand Cats" (LSB steganography in one of ten per-student cat
photos), and with it went the per-student cover-image variance — **Night 3 is identical
for every student.** It was then reworked again: the on-page title is now **Night 3 ·
Triple T**, the file was renamed `message.txt` → `night3-a.txt` and is now **170 bytes**
(was 118), the plaintext was rewritten, and **the flag changed from
`flag{tung_tung_tung_sahur}` to `flag{stop_scrolling}`**. The key did *not* change. The
folder name here is left as `tung-tung-tung-sahur/` so old links keep working. Discard any
older printout.

**Source:** real, fixed content. Key, plaintext and hint image all defined directly in
`tools/build_fnac_assets.py` (`NIGHT3_KEY = b'tung tung tung sahur'`, `NIGHT3_PLAINTEXT`),
XOR'd by `xor_repeating` in `tools/fnac_png.py`. Confirmed by decrypting the actual
shipped `night3-a.txt`. Not per-user randomized.

**Attachments:** referenced by relative path in `challenge.yml`'s `files:` list (verified
resolvable from this folder), not copied:
`../../../../public/crypto/fnac/assets/night3/night3-a.txt` (170 bytes) and
`hint-sahur.webp` (30968 bytes). **The hint image is part of the puzzle, not decoration** —
it is a picture of the meme character whose name *is* the key, and it is the only thing
that tells a student what words the recovered `tung ` fragment belongs to. Attach it.
`challenge.yml` also carries the ciphertext inline as a hex dump, because `night3-a.txt`
contains NUL bytes and cannot survive being pasted as text.

## Mechanism

Repeating-key XOR — its own inverse. The 20-byte key `tung tung tung sahur` is cycled
over the plaintext, byte by byte.

The way in is a **crib**. The plaintext begins with the flag, so its first five bytes are
known to be `flag{`; XOR those against the first five ciphertext bytes and the first five
key bytes fall out as `tung `. From there the meme name (and the hint image) supplies the
rest of the key, and its 20-byte length is the last thing to pin down.

Note the misdirection, which is the point of the flag change: everything about this night
shouts *tung tung tung sahur* — the title, the hint image, the recovered key, the last
line of the plaintext. The obvious guess at the flag is the key itself. It isn't; the flag
is `flag{stop_scrolling}`, and the only way to get it is to actually decrypt the message
rather than to guess from the theme.

Three properties of this ciphertext are deliberate and worth not breaking if it is ever
rebuilt:

- **It stays 7-bit** (`max(cipher) < 0x80`) and contains **no CR or LF**, so it survives a
  text-mode transfer, a copy-paste, or a Windows/Unix line-ending rewrite unchanged — and
  so the on-page ciphertext block does not render a line break the file does not have.
- **It does contain NUL bytes** — fourteen of them. That is unavoidable: the plaintext
  repeats the key's own words, and a byte XOR'd with itself is zero. They transfer
  verbatim in binary, but they are why the paper fallback ships a hex dump rather than a
  text block.
- **The double spaces between sentences are load-bearing, not sloppy typing.** Every
  plaintext character sits at a fixed phase of the 20-byte key, and a handful of
  (character, phase) pairs XOR to CR/LF or to a byte ≥ `0x80`. The double spaces are the
  phase shifts that dodge those pairs. Nudging a word means re-running the builder's
  asserts, not eyeballing it.

## Solution

```python
import pathlib

def xor_repeating(data, key):
    return bytes(b ^ key[i % len(key)] for i, b in enumerate(data))

c = pathlib.Path('night3-a.txt').read_bytes()

# step 1 — the crib: 'flag{' against the first five bytes
print(bytes(x ^ y for x, y in zip(c[:5], b'flag{')))   # b'tung '

# step 2 — the whole key, once you recognise the name
print(xor_repeating(c, b'tung tung tung sahur').decode())
```

Verified directly against the shipped file. Full plaintext:

```
flag{stop_scrolling}  It comes down the hall at 3am with a bat.  It always counts to
three.  Put your phone down.  It does not hide its name. It shouts it, over and over.
```

**Flag:** `flag{stop_scrolling}`

## Presenter notes

This is the same lesson as the XOR module's "Crib the Key" (challenge 17), landing in a
file-forensics costume: a repeating key is only as strong as your ignorance of the
plaintext, and in a CTF you are never ignorant of the plaintext — you always know it
contains `flag{`.

Offline, `xortool` (Kali-preinstalled) or CyberChef's XOR Brute Force will both get there;
so will the five-line crib above, which is faster and actually teaches the mechanism. The
live site no longer ships an on-page XOR tool — FNAC's helper widgets were all removed and
the module now assumes a commandline — so the same script serves online and off. If a
student recovers `tung ` and stalls, show them the hint image: recognising the character is
the intended bridge from five bytes of key to twenty. If they then submit
`flag{tung_tung_tung_sahur}`, they have guessed instead of decrypting — send them back to
the message.
