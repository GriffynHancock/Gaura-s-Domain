> Presenter/solution reference — do not show to participants

# Two Tones (Caesar module, puzzle V — Vigenère, 2-key alternating)

**⚠ Worked-instance disclaimer:** the live site derives both shifts (A and B) from a
cookie hash per student, so the real page has no single fixed ciphertext. This fallback
fixes A = 4, B = 11 as one concrete worked instance. Mechanism and flag plaintext match
the live module exactly.

## Mechanism

A 2-key alternating Vigenère. Two Caesar shifts, A and B, are applied alternately to
successive **letters** of the plaintext — the alternation counter only advances on
`[a-z]`/`[A-Z]` characters; `{`, `}`, `_` are passed through untouched and do **not**
consume a turn. This matters: hand-solving by literal character position (including
punctuation) gives the wrong answer.

Encoding direction: ciphertext letter = plaintext letter shifted *backward* by the
active key (A or B). Decoding (what the participant does): shift each ciphertext letter
*forward* by A or B, alternating, starting with A on the first letter.

## Worked solution

- Plaintext: `flag{two_tones}`
- Key A (odd letters — 1st, 3rd, 5th...): `4`
- Key B (even letters — 2nd, 4th, 6th...): `11`
- Ciphertext: `bawv{plk_ikcah}`

Letter-by-letter alternation (12 letters total, ignoring `{`, `_`, `}`):

| # | plaintext letter | dial | ciphertext letter |
|---|---|---|---|
| 1 | f | A | b |
| 2 | l | B | a |
| 3 | a | A | w |
| 4 | g | B | v |
| 5 | t | A | p |
| 6 | w | B | l |
| 7 | o | A | k |
| 8 | t | B | i |
| 9 | o | A | k |
| 10 | n | B | c |
| 11 | e | A | a |
| 12 | s | B | h |

Verified programmatically:

```python
def rot_by_pos(text, shifts):
    out, i = [], 0
    for ch in text:
        if ch.isalpha():
            base = ord('A') if ch.isupper() else ord('a')
            s = shifts[i % len(shifts)] % 26
            out.append(chr((ord(ch) - base + s) % 26 + base))
            i += 1
        else:
            out.append(ch)
    return ''.join(out)

assert rot_by_pos('bawv{plk_ikcah}', [4, 11]) == 'flag{two_tones}'
```

**Flag:** `flag{two_tones}`

## Presenter notes

If running on paper, give participants two Caesar wheels (or one wheel used twice) and
explicitly tell them the alternation skips punctuation — the live page's own hint text
says "dial A decodes the 1st, 3rd, 5th… letter", which is the same framing to use here.
