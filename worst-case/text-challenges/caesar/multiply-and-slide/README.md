> Presenter/solution reference — do not show to participants

# Multiply and Slide (Caesar module, puzzle VI — Affine cipher)

**⚠ Worked-instance disclaimer:** the live site derives `a` and `b` from a cookie hash
per student (`a` drawn from the fixed list of values coprime with 26, `b` from 0–25), so
the real page has no single fixed ciphertext. This fallback fixes `a = 5, b = 8` as one
concrete worked instance. Mechanism and flag plaintext match the live module exactly.
Solving this puzzle on the live site also reveals a bonus code (`flag{affine_ace}`) that
unlocks a reward link — that bonus mechanic is cosmetic to the live page and is **not**
reproduced in this paper fallback; only the main flag is scored here.

## Mechanism

Affine cipher: `y = (a·x + b) mod 26`, where `x` is the plaintext letter's index (a=0,
b=1, ... z=25) and `y` is the resulting ciphertext letter's index. `a` must be coprime
with 26 (i.e. not divisible by 2 or 13) or the mapping collides and can't be inverted —
the live page's valid multiplier set is `{3,5,7,9,11,15,17,19,21,23,25}` (1 excluded as
the trivial identity).

To decode, invert: `x = a⁻¹·(y − b) mod 26`, where `a⁻¹` is the modular inverse of `a`
mod 26.

## Worked solution

- Plaintext: `flag{affine_code}`
- Multiplier `a`: `5` (coprime with 26 — valid)
- Slide `b`: `8`
- Modular inverse: `a⁻¹ = 21` (since `5 × 21 = 105 = 4×26 + 1`)
- Ciphertext: `hlim{ihhwvc_saxc}`

Verified programmatically:

```python
def inv_mod(a, m=26):
    for x in range(1, m):
        if (a * x) % m == 1:
            return x

def affine_encode(text, a, b):
    out = []
    for ch in text:
        if ch.isalpha():
            base = ord('A') if ch.isupper() else ord('a')
            x = ord(ch) - base
            out.append(chr(((a * x + b) % 26) + base))
        else:
            out.append(ch)
    return ''.join(out)

def affine_decode(text, a, b):
    ai = inv_mod(a)
    out = []
    for ch in text:
        if ch.isalpha():
            base = ord('A') if ch.isupper() else ord('a')
            y = ord(ch) - base
            x = (ai * ((y - b) % 26)) % 26
            out.append(chr(x + base))
        else:
            out.append(ch)
    return ''.join(out)

assert affine_encode('flag{affine_code}', 5, 8) == 'hlim{ihhwvc_saxc}'
assert affine_decode('hlim{ihhwvc_saxc}', 5, 8) == 'flag{affine_code}'
```

**Flag:** `flag{affine_code}`

## Presenter notes

This is deliberately the hardest puzzle in the set — brute-forcing by hand means trying
every valid `a` (11 options) crossed with every `b` (26 options) unless you can spot `a`
some other way (the live page hides `a` behind a riddle). On paper, give participants the
valid-`a` list above so they aren't wasting time on non-coprime guesses that can never
decode cleanly.
