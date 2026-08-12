> Presenter/solution reference — do not show to participants

# Test Signal (Caesar module, puzzle I)

**⚠ Worked-instance disclaimer:** the live site (`ctf.sandhi.com.au/crypto/ceasar`) derives
every student's shift from a cookie hash (`ctf-uid` via FNV) and re-encodes the flag
client-side, so there is no single "the" ciphertext in the live page — every student sees
a different shift and a different scrambled string. This text-fallback version fixes one
concrete key (shift = 7) so it can be printed and solved on paper. The mechanism and the
flag plaintext are identical to the live module; only the key was invented for this file.

## Mechanism

Plain Caesar shift. Every letter of the plaintext is shifted *backward* by the key to
produce the ciphertext; the participant's job is to find the shift that, applied *forward*
to the ciphertext, produces readable text. Non-letters (`{`, `}`) pass through unchanged.

## Worked solution

- Plaintext: `flag{G}`
- Key (shift): `7`
- Ciphertext: `yetz{Z}`

Applying `+7` to each ciphertext letter (mod 26) recovers the plaintext:
`y+7=f`, `e+7=l`, `t+7=a`, `z+7=g`; `Z+7=G`.

Verified programmatically (Python, mirroring the page's own `rotByPos`/`encodeFor` JS):

```python
def shift(text, k):
    out = []
    for ch in text:
        if ch.isalpha():
            base = ord('A') if ch.isupper() else ord('a')
            out.append(chr((ord(ch) - base + k) % 26 + base))
        else:
            out.append(ch)
    return ''.join(out)

assert shift('yetz{Z}', 7) == 'flag{G}'
```

**Flag:** `flag{G}`

## Presenter notes

If running this as a paper fallback, brute-forcing all 26 shifts by hand (or with a
Caesar wheel / slide rule, same idea as the live page's dial) will surface the flag —
this is deliberately the easiest puzzle in the set (an opener).
