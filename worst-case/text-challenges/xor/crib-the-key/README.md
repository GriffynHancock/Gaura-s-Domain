> Presenter/solution reference — do not show to participants

# Crib the Key (XOR module, C2)

**Source:** real, fixed content extracted directly from `public/crypto/xor/index.html`
(`build(ctx)` for `id:'c2'`: `const plain='flag{repeating_xor_key}', key='cat';`). Not
per-user randomized.

## Mechanism

Repeating-key XOR with a 3-byte key (`cat`), applied cyclically over the whole message.
Brute force is impractical (256³ combinations) — but every flag is known to start with
`flag{` (a "crib" — a known scrap of plaintext). Since
`ciphertext[i] ⊕ plaintext[i] = key[i mod len(key)]`, XOR-ing the crib against the start
of the ciphertext directly recovers key bytes — and because the key repeats, the
recovered bytes visibly repeat too (`c a t c a` → the word `cat`).

The live page notes CyberChef's built-in "XOR Brute Force" only searches 1–2 byte keys,
so this key length specifically dodges that shortcut and forces the crib approach.

## Solution

```python
cipher = bytes.fromhex('050d15041a0606111102151d0d062b1b0e063c0a111a1c')
crib = b'flag{'
recovered = bytes(c ^ p for c, p in zip(cipher, crib))
print(recovered)   # b'catca' -- key is 'cat', repeating

key = b'cat'
plain = bytes(c ^ key[i % len(key)] for i, c in enumerate(cipher))
print(plain)        # b'flag{repeating_xor_key}'
```

Verified: crib `flag{` XORed against the first 5 ciphertext bytes yields `catca` — the
key `cat` visibly repeating. Decrypting the full ciphertext with key `cat` recovers
`flag{repeating_xor_key}`.

**Flag:** `flag{repeating_xor_key}`
