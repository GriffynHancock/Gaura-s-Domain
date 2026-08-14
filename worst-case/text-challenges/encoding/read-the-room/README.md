> Presenter/solution reference — do not show to participants

# Read the Room (Encoding module, puzzle IX)

**Source:** real, fixed content extracted from `public/crypto/encoding/assets.js`
(key `i_b64`), cross-checked against `flags.i`. Not per-user randomized. Cross-checks
with `docs/superpowers/module2-solve-paths.md` (§IX), which agrees with the live source
on pipeline, flag and decoys.

**⚠ This puzzle was re-layered.** It used to be two layers (`base64 → atbash`). It is
now **three**: `base64 → rot47 → atbash`. If you are holding an older printout, the
blob, the pipeline and the intermediate text have all changed — the flag has not.

## Mechanism

Three layers. Both `atbash` and `rot47` are byte-wise involutions, so the blob was built
by applying the same pair in the mirror order: `blob = base64(rot47(atbash(plain)))`.
`\n` (0x0a) sits outside rot47's `[33,126]` range and rides through untouched, so the
dump keeps its line breaks at every layer.

The decoded dump is a fake packet capture salted with **unlabelled decoys**:

1. `auth_token: florg{...}` — plain text, flag-shaped but not the `flag{...}` format.
2. `trace=...` — a hex string; hex-decodes (no further step) to a `glaf{...}` decoy.
3. `ref=...` — a url-percent string; url-decodes (no further step) to a `glorf{...}` decoy.
4. `payload:` — the real flag, sitting in plain sight once all three layers are off.

Nothing labels any of them. Picking the real one is the puzzle; the live page has no hint
box on this card on purpose.

**Why rot47 is the outer layer and must not be swapped back.** atbash and rot47 do not
commute. The first shipped version was `base64(atbash(rot47(plain)))` — student order
`base64 → atbash → rot47` — and it had a structural near-miss: the natural two-layer
guess `base64 → rot47` then computes `rot47(atbash(rot47(plain)))`, and lowercase `a`–`o`
rot47 to `2`–`@`, which atbash leaves alone, so the second rot47 returns them *exactly*.
About 58% of the alphabet is invariant under the wrong order for **any** English payload,
so the wrong guess produces a near-readable fake flag. With rot47 outermost, that same
wrong guess stops cleanly at `atbash(plain)` — mirrored English that points *at* the
remaining atbash step. The asset builder asserts that `base64 → atbash → rot47` does
**not** recover the flag, so the check proves the intended order rather than passing by
luck.

## Solution

```python
import base64

def rot47(b):
    return bytes((c - 33 + 47) % 94 + 33 if 33 <= c <= 126 else c for c in b)

def atbash(b):
    return bytes(
        (ord('z') - (c - ord('a'))) if ord('a') <= c <= ord('z')
        else (ord('Z') - (c - ord('A'))) if ord('A') <= c <= ord('Z')
        else c for c in b)

raw = base64.b64decode(open('blob.txt').read())
print(atbash(rot47(raw)).decode())
```

Layer by layer, verified against the shipped `blob.txt`:

```
after base64                    after base64 → rot47
\\ IK<87:G _4dF \\              -- xzkgfiv 0c5u --
K78D08=AG>i F@=:EL>CIG\8:3N     zfgs_glpvm: uolit{mrxv-gib}
8:KIGlefeIe`eefJeGeFfcaHehfcfH  gizxv=676x61667y6v6u742w69747w
:GFlTefTeITeFTfaTeeTfJTeGTeF…   ivu=%67%6x%6u%72%66%7y%6v%6u%70%65%7w
<K3@=KHi                        kzbolzw:
F@KEL:GKH0G6G:30@C>G0FC:98N     uozt{ivzw_vevib_ormv_urihg}
\\ G>H =F IK<87:G \\            -- vmw lu xzkgfiv --
```

after `base64 → rot47 → atbash`:

```
-- capture 0x5f --
auth_token: florg{nice-try}
trace=676c61667b6e6f742d69747d
ref=%67%6c%6f%72%66%7b%6e%6f%70%65%7d
payload:
flag{read_every_line_first}
-- end of capture --
```

The `trace=` and `ref=` lines decode exactly as their own labels claim — no atbash or
rot47 involved once you are down to plain: `bytes.fromhex('676c61667b6e6f742d69747d')` →
`glaf{not-it}`, and `urllib.parse.unquote('%67%6c%6f%72%66%7b%6e%6f%70%65%7d')` →
`glorf{nope}`. Both are readable decoy tokens the moment the obvious decode is applied —
the trap is that they *look* like they need more work, not that they hide anything.

**Flag:** `flag{read_every_line_first}`

## Presenter notes

The middle layer is the teachable moment: `base64` alone lands on punctuation-heavy
gibberish (rot47's tell — printable ASCII, no `=`, lots of symbols), and `rot47` lands on
cleanly mirrored English (`uozt{…}` — atbash's tell). Each layer announces the next one if
you look at *what kind* of nonsense you're holding. After that the lesson is reading
carefully, not more crypto: three of the four flag-shaped strings in the dump are decoys.
