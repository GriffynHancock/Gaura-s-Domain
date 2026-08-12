> Presenter/solution reference — do not show to participants

# Bee Line (Caesar module, puzzle II)

**⚠ Worked-instance disclaimer:** the live site derives every student's shift from a
cookie hash (`ctf-uid`), so there's no single fixed ciphertext on the real page — each
student sees a different shift/scramble. This fallback fixes one concrete key
(shift = 3) for a printable, paper-solvable version. Mechanism and flag plaintext match
the live module exactly; only the key was invented here.

## Mechanism

Plain Caesar shift (same as puzzle I) — a second, slightly less trivial rep of the same
skill before the ramp gets harder.

## Worked solution

- Plaintext: `flag{Bee}`
- Key (shift): `3`
- Ciphertext: `cixd{Ybb}`

Verified programmatically:

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

assert shift('cixd{Ybb}', 3) == 'flag{Bee}'
```

**Flag:** `flag{Bee}`
