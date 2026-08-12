> Presenter/solution reference — do not show to participants

# Decode the Signal (Encoding module, puzzle I)

**Source:** real, fixed content extracted directly from `public/crypto/encoding/assets.js`
(key `a_b64`) and cross-checked against the flags table in the same file (key
`flags.a`). Not per-user randomized — every student on the live site sees this exact
string.

## Mechanism

Single-layer base64. Textbook example — mixed-case alphanumeric, `=` padding, length a
multiple of 4. Deliberately the cleanest intro to the tell.

## Solution

```
$ echo 'ZmxhZ3tiYXNlNjRfaXNfbm90X3NlY3JldH0=' | base64 -d
flag{base64_is_not_secret}
```

Verified: `base64.b64decode('ZmxhZ3tiYXNlNjRfaXNfbm90X3NlY3JldH0=')` → `b'flag{base64_is_not_secret}'`.

**Flag:** `flag{base64_is_not_secret}`
