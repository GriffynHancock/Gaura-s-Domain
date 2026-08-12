> Presenter/solution reference — do not show to participants

# Static (Five Nights at Crypto's, Night 1)

**Source:** real, fixed content. Flag halves defined directly in `tools/build_fnac_assets.py`
(`NIGHT1_FLAG_A = 'flag{tune_into_'`, `NIGHT1_FLAG_B = 'the_static}'`) and confirmed by
reading the trailing bytes of the actual generated PNGs at
`public/crypto/fnac/assets/night1/file-a.png` and `file-b.png`. Not per-user
randomized — same two files for every student.

**Attachments:** referenced by relative path in `challenge.yml`'s `files:` list rather
than copied, to avoid duplicating binary assets:
`../../../../public/crypto/fnac/assets/night1/file-a.png` and `file-b.png` (verified
these paths resolve from this challenge folder).

## Mechanism

Both PNGs are otherwise-normal noise images. Each has extra bytes appended after the
PNG's `IEND` chunk (the point where any PNG-aware tool considers the file "finished").
A `strings`/hex-dump/raw-bytes look past that point reveals plain ASCII text embedded
in random-looking padding — one half of the flag per file.

## Solution

```
$ strings file-a.png | tail
# ... noise ... flag{tune_into_ ... noise ...

$ strings file-b.png | tail
# ... noise ... the_static} ... noise ...
```

Concatenating the two fragments in file order: `flag{tune_into_` + `the_static}` =
`flag{tune_into_the_static}`.

Verified directly against the shipped files:

```python
import pathlib
a = pathlib.Path('public/crypto/fnac/assets/night1/file-a.png').read_bytes()
b = pathlib.Path('public/crypto/fnac/assets/night1/file-b.png').read_bytes()
assert b'flag{tune_into_' in a[a.find(b'IEND')+8:]
assert b'the_static}' in b[b.find(b'IEND')+8:]
```

**Flag:** `flag{tune_into_the_static}`

## Presenter notes

The lesson: a file format's "end of data" marker (`IEND` for PNG) is where a *parser*
stops, not necessarily where the *file* stops — extra bytes tacked on afterward are
still there for anyone who reads raw bytes instead of trusting the image viewer.
