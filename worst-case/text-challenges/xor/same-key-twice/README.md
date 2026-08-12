> Presenter/solution reference — do not show to participants

# Same Key Twice (XOR module, C3 — boss)

**Source:** real, fixed content extracted directly from `public/crypto/xor/index.html`
(`build(ctx)` for `id:'c3'`: `const p1='flag{same_key_twice}', p2='meet me by the docks!';`
`const key=toBytes('PURPLEHAZE');`). Not per-user randomized.

## Mechanism

Two messages encrypted with the same repeating key (`PURPLEHAZE`) — the classic
keystream-reuse mistake. The key is never given. Because XOR is its own inverse and the
key is identical for both:

```
c1 ⊕ c2 = (p1 ⊕ key) ⊕ (p2 ⊕ key) = p1 ⊕ p2
```

The key cancels entirely, leaving `p1 ⊕ p2` — no key needed at all. From there, a
**crib-drag**: guess a word likely to appear in one message (e.g. `flag{` at position 0,
or `the ` somewhere in the middle), XOR it against `p1⊕p2` at that position — if the
result reads as English, that's a slice of the *other* message. Extend the guess and
repeat until both messages are fully recovered.

## Solution

```python
c1 = bytes.fromhex('363933373736292c3f1a3b302b0f383221223f38')
c2 = bytes.fromhex('3d3037246c282d61383c70213a356c212722313671')
L = min(len(c1), len(c2))
xored = bytes(a ^ b for a, b in zip(c1[:L], c2[:L]))   # = p1 xor p2

# crib-drag: guess "flag{" at position 0
crib = b'flag{'
reveal = bytes(x ^ g for x, g in zip(xored[:len(crib)], crib))
print(reveal)   # b'meet ' -- message 2 starts "meet ..."

# extend the guess for message 2, drag it to peel message 1
crib2 = b'meet me by the docks!'
reveal2 = bytes(x ^ g for x, g in zip(xored[:len(crib2)], crib2))
print(reveal2)  # b'flag{same_key_twice}'
```

Verified: `p1 xor p2` computed directly from the two plaintexts matches `c1 xor c2`
computed from the two ciphertexts (confirming the key cancellation), and crib-dragging
`flag{` then `meet me by the docks!` recovers both original messages exactly.

**Flag:** `flag{same_key_twice}`
(message 2, recovered along the way, is `meet me by the docks!` — not itself a flag, but
needed to fully peel message 1)

## Presenter notes

This is the module's boss puzzle — the real one-time-pad-reuse break. On paper, give
participants both hex ciphertexts and a short crib list to try (`flag{`, `the `, common
short words) and have them compute the XOR-of-ciphertexts by hand or with a quick script,
then hand-slide the crib along the result.
