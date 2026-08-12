> Presenter/solution reference — do not show to participants

# Order Matters (Encoding module, puzzle VI)

**Source:** real, fixed content extracted from `public/crypto/encoding/assets.js`
(key `d_b64`), cross-checked against `flags.d`. Not per-user randomized. On the live
page, `rot13`/`atbash`/`url` are all offered as live tiles here and all produce garbage
— pure distractors for this puzzle specifically.

## Mechanism

Two layers: `base64(hex(flag))`. Base64-decoding first yields a pure `0-9a-f` string —
that's the tell that another layer (hex) is underneath. Applying the layers in the wrong
order (hex-then-base64) produces nonsense.

## Solution

```
$ echo 'NjY2YzYxNjc3YjcwNjU2NTZjNWY3NDY4NjU1ZjZjNjE3OTY1NzI3Mzdk' | base64 -d
666c61677b7065656c5f7468655f6c61796572737d
$ echo '666c61677b7065656c5f7468655f6c61796572737d' | xxd -r -p
flag{peel_the_layers}
```

Verified: base64-decode gives `666c61677b7065656c5f7468655f6c61796572737d`; hex-decode of
that gives `flag{peel_the_layers}`.

**Flag:** `flag{peel_the_layers}`
