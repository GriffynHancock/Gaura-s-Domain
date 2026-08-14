> Presenter/solution reference — do not show to participants

# Safe Cracking (Caesar module, puzzle IV)

**⚠ Worked-instance disclaimer:** the live site derives every student's shift from a
cookie hash, so the real page has no single fixed ciphertext. This fallback fixes
shift = 15 as one concrete worked instance. The static ciphertext sitting in the live
page's checked-in markup is **not** a valid instance of anything — it is overwritten
client-side at mount by `encodeFor()` with the visitor's own key, and the checked-in
string still encodes an older plaintext. This file's ciphertext was generated fresh and
verified against the flag below, not lifted from that placeholder.

**⚠ Flag changed:** this puzzle used to be `flag{Safe_Cracker}`. It is now
`flag{bored_yet}` — the title stayed, the flag is the joke about being four single-dial
warm-ups deep. Note it is all-lowercase and carries no `?`: a `?` would pass through the
encoder untouched and sit visible in the ciphertext as a free structural crib, which is
exactly the invariant the module asks students to find for themselves.

## Mechanism

Plain Caesar shift — last of the four single-dial warm-ups before the module moves to
Vigenère (puzzle V) and Affine (puzzle VI).

## Worked solution

- Plaintext: `flag{bored_yet}`
- Key (shift): `15`
- Ciphertext: `qwlr{mzcpo_jpe}`

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

assert shift('qwlr{mzcpo_jpe}', 15) == 'flag{bored_yet}'
```

**Flag:** `flag{bored_yet}`
