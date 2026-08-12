> Presenter/solution reference — do not show to participants

# Percent Sign (Encoding module, puzzle IV)

**Source:** real, fixed content extracted from `public/crypto/encoding/assets.js`
(key `f_url`), cross-checked against `flags.f`. Not per-user randomized. On the live
page this is the *last* puzzle where URL-encoding is a real, correct method — after
this it appears elsewhere purely as a distractor tile that produces no-ops.

## Mechanism

Single-layer URL/percent-encoding — every byte written as `%` + two hex digits.

## Solution

```python
import urllib.parse
urllib.parse.unquote('%66%6c%61%67%7b%70%65%72%63%65%6e%74%5f%65%6e%63%6f%64%65%64%7d')
# -> 'flag{percent_encoded}'
```

**Flag:** `flag{percent_encoded}`
