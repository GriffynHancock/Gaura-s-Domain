> Presenter/solution reference — do not show to participants

# Radio Tuning (Caesar module, puzzle III)

**⚠ Worked-instance disclaimer:** the live site derives every student's shift from a
cookie hash, so the real page has no single fixed ciphertext — each student sees a
different shift. This fallback fixes shift = 13 as one concrete worked instance
(ROT13, so it happens to be self-describing — worth noting to a presenter, not to
participants). Mechanism and flag plaintext match the live module exactly.

## Mechanism

Plain Caesar shift, same skill as puzzles I–II, now on a longer string with an
underscore separator (`_` passes through unshifted, same as `{`/`}`).

## Worked solution

- Plaintext: `flag{Caesar_Salad}`
- Key (shift): `13`
- Ciphertext: `synt{Pnrfne_Fnynq}`

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

assert shift('synt{Pnrfne_Fnynq}', 13) == 'flag{Caesar_Salad}'
```

**Flag:** `flag{Caesar_Salad}`

## Presenter notes

Because the key happens to be 13, this instance is ROT13 — mention that only if you want
to demonstrate the special case where the same shift both encodes and decodes. Don't lead
with it; the point of the puzzle is finding *any* shift by trial, not recognising ROT13
by sight.
