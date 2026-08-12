> Presenter/solution reference — do not show to participants

# Among the Bytes (Encoding module, puzzle V)

**Source:** real, fixed content extracted from `public/crypto/encoding/assets.js`
(key `c_b64`), cross-checked against `flags.c`. Not per-user randomized. On the live
page this puzzle also plays a cha-ching audio "sting" the moment a real image is
detected in the decode pipeline — cosmetic, not reproduced here.

## Mechanism

Base64 of an "imposter" PNG image, plus a plain-text `----[ flag{...} ]----` string
appended **after** the PNG's `IEND` chunk (i.e. after the image data technically ends).
The image still renders normally in a viewer; the flag rides along as trailing bytes
that most people stop looking at once the picture appears.

## Solution

```
$ base64 -d blob.txt > out.png
$ open out.png                  # shows a small sprite — the misdirection
$ strings out.png | tail        # or just base64 -d blob.txt | strings
----[ flag{hidden_in_the_bytes} ]----
```

Verified: base64-decoding `blob.txt` gives PNG bytes; the bytes immediately following
the `IEND` chunk (`+8` for the chunk's CRC/length framing) are
`\n----[ flag{hidden_in_the_bytes} ]----\n`.

**Flag:** `flag{hidden_in_the_bytes}`

## Presenter notes

The lesson: file format headers/footers mark where a *parser* stops looking, not where
the *data* stops. A student who only opens the image will miss it; a student who dumps
the raw decoded bytes (or scrolls the text view on the live page) sees the flag
immediately after the visible sprite.
