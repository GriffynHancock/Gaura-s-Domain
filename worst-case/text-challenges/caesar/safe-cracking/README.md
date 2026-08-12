> Presenter/solution reference — do not show to participants

# Safe Cracking (Caesar module, puzzle IV)

**⚠ Worked-instance disclaimer:** the live site derives every student's shift from a
cookie hash, so the real page has no single fixed ciphertext. This fallback fixes
shift = 19 as one concrete worked instance. Note: the live page's static placeholder
markup for this puzzle isn't self-consistent with its own "dial 20" label — this file's
ciphertext was generated fresh and independently verified against the flag below, not
lifted from that placeholder.

## Mechanism

Plain Caesar shift — last of the four single-dial warm-ups before the module moves to
Vigenère (puzzle V) and Affine (puzzle VI).

## Worked solution

- Plaintext: `flag{Safe_Cracker}`
- Key (shift): `19`
- Ciphertext: `mshn{Zhml_Jyhjrly}`

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

assert shift('mshn{Zhml_Jyhjrly}', 19) == 'flag{Safe_Cracker}'
```

**Flag:** `flag{Safe_Cracker}`
