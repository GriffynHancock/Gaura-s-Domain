> Presenter/solution reference — do not show to participants

# Brute Force (XOR module, C1)

**Source:** real, fixed content extracted directly from `public/crypto/xor/index.html`
(`build(ctx)` for `id:'c1'`: `const plain='flag{brute_force_me}', key=0x37;`). Not
per-user randomized — this exact plaintext/key is the same for every student on the
live site.

## Mechanism

Single-byte XOR key applied (repeating, trivially, since it's one byte) across the whole
message. Only 256 possible keys — exhaustive search always wins. On the live page, all
256 decodes are listed in **key order** (0x00→0xFF), not sorted by readability — spotting
the one that reads as English is the actual skill being tested, not a search algorithm
doing it for you.

**Decoy to flag (not test on participants, but know it):** the key `0x17` — exactly
`0x20` away from the real key `0x37` — decodes to `FLAG[BRUTE\x7fFORCE\x7fME]`: XOR by
`0x20` flips ASCII letter case, so this twin looks *almost* right (`FLAG[...]` in
uppercase with square brackets) but is garbled — `{`→`[`, `_`→`\x7f` (non-printable).
Real flags are lowercase `flag{...}`; that's the disambiguator.

## Solution

```python
cipher = bytes.fromhex('515b56504c5545424352685158455452685a524a')
for k in range(256):
    dec = bytes(b ^ k for b in cipher)
    if dec.startswith(b'flag{'):
        print(hex(k), dec)
        break
# -> 0x37 b'flag{brute_force_me}'
```

Verified: `key=0x37` decodes cleanly to `flag{brute_force_me}`; `key=0x17` (the `0x20`
twin) decodes to `FLAG[BRUTE\x7fFORCE\x7fME]` — printable-ish but wrong format.

**Flag:** `flag{brute_force_me}`

## Presenter notes

If running fully on paper, give participants a full ASCII table and let them try keys
by hand for a few, then hand out (or have them write) a quick brute-force script — the
whole point is demonstrating that a tiny keyspace (256) is trivial to exhaust.
