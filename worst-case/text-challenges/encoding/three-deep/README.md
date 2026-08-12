> Presenter/solution reference — do not show to participants

# Three Deep (Encoding module, puzzle VII)

**Source:** real, fixed content extracted from `public/crypto/encoding/assets.js`
(key `g_b64`), cross-checked against `flags.g`. Not per-user randomized.

## Mechanism

Three layers: `base64(rot47(hex(flag)))`. ROT47 is an **involution** — applying it once
undoes it, so the same operation both built and peels this layer. CyberChef's "Magic"
auto-solve typically stalls here because ROT47 isn't in its default search set — this is
the puzzle where students are expected to peel by hand.

## Solution

```python
import base64

def rot47(s):
    out = []
    for ch in s:
        c = ord(ch)
        out.append(chr((c - 33 + 47) % 94 + 33) if 33 <= c <= 126 else ch)
    return ''.join(out)

layer1 = base64.b64decode('ZWVlNGVgZWZmM2ZjZWdmYWVkZWRkN2U0ZWBmaGVkZmFmYmQ3ZWNlZGVkZl9mNQ==').decode()
# 'eee4e`eff3fcegfaededd7e4e`fhedfafbd7ecededf_f5'
layer2 = rot47(layer1)
# '666c61677b74687265655f6c61796572735f646565707d'
flag = bytes.fromhex(layer2).decode()
# 'flag{three_layers_deep}'
```

**Flag:** `flag{three_layers_deep}`

## Presenter notes

Order is base64 → ROT47 → hex. Tell participants ROT47 leaves *printable* gibberish full
of punctuation (no `=`, unlike base64) — that visual tell is what should nudge them to
try it as the middle layer.
