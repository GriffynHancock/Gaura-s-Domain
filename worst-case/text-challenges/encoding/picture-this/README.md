> Presenter/solution reference — do not show to participants

# Picture This (Encoding module, puzzle II)

**Source:** real, fixed content extracted from `public/crypto/encoding/assets.js`
(key `b_png`), cross-checked against `flags.b`. Not per-user randomized.

## Mechanism

Base64-encoded PNG. Decodes to a real B/W bitmap image that literally renders the flag
text — the "aha" is switching from a text view to an image view after decoding.

## Solution

```
$ base64 -d blob.txt > out.png
$ open out.png     # or any image viewer
```

Confirmed by rendering: the PNG shows the literal text `flag{wow!}`.

**Flag:** `flag{wow!}`

## Presenter notes

This is the one puzzle in the set where a plain-text terminal decode looks like garbage
binary — participants must actually open the decoded bytes as an image. If running fully
offline/paper-only, be ready to lend a machine that can decode-and-view for this one.
