> Presenter/solution reference — do not show to participants

# Sixteen (Encoding module, puzzle III)

**Source:** real, fixed content extracted from `public/crypto/encoding/assets.js`
(key `e_hex`), cross-checked against `flags.e`. Not per-user randomized.

## Mechanism

Single-layer hex encoding — clean intro, no other layers, no red herrings.

## Solution

```
$ echo '666c61677b6865785f696e5f706c61696e5f73696768747d' | xxd -r -p
flag{hex_in_plain_sight}
```

Verified: `bytes.fromhex('666c61677b6865785f696e5f706c61696e5f73696768747d')` →
`b'flag{hex_in_plain_sight}'`.

**Flag:** `flag{hex_in_plain_sight}`
