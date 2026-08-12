> Presenter/solution reference — do not show to participants

# It's In The Metadata (Five Nights at Crypto's, Night 2)

**Source:** real, fixed content. Defined directly in `tools/build_fnac_assets.py`
(`NIGHT2_FLAG = 'flag{its_in_the_metadata}'`, `NIGHT2_HINTS = ["It's", "In The", "Meta", "Data"]`)
and confirmed by reading the actual generated PNGs at
`public/crypto/fnac/assets/night2/file-1.png` … `file-4.png`. Not per-user randomized.

**Attachments:** referenced by relative path in `challenge.yml`'s `files:` list (verified
resolvable from this folder), not copied.

## Mechanism

A deliberate "old trick doesn't work this time" lesson, following directly from Night 1
(Static):

- **All four files** have the raw-bytes-after-`IEND` trick from Night 1 present — but
  this time it's a **decoy**: every file's trailing bytes decode to the literal string
  `trolololo`, not a flag fragment. A student who only repeats the Night 1 technique
  gets trolled.
- **The real content lives in PNG text-chunk metadata** (`tEXt` chunks), not trailing
  bytes. Each of the four files carries a `Comment` field with one word/phrase of a
  hint, in order: `It's` / `In The` / `Meta` / `Data` — spelling out the lesson itself.
- **File 4 only** additionally carries a `Flag` metadata field containing the real flag
  directly: `flag{its_in_the_metadata}`.

## Solution

```
$ exiftool file-1.png file-2.png file-3.png file-4.png
# file-1.png: Comment: It's
# file-2.png: Comment: In The
# file-3.png: Comment: Meta
# file-4.png: Comment: Data
#              Flag: flag{its_in_the_metadata}
```

Verified directly against the shipped files (parsing PNG `tEXt` chunks):

```python
import pathlib, re
for i in range(1, 5):
    b = pathlib.Path(f'public/crypto/fnac/assets/night2/file-{i}.png').read_bytes()
    idx = b.find(b'IEND')
    assert b'trolololo' in b[idx+8:]        # decoy, present in all four
for m in re.finditer(b'tEXt', pathlib.Path('public/crypto/fnac/assets/night2/file-4.png').read_bytes()):
    pass  # file-4's tEXt chunks include both Comment: Data and Flag: flag{its_in_the_metadata}
```

**Flag:** `flag{its_in_the_metadata}`

## Presenter notes

The teaching point is explicit in the puzzle name: raw-bytes/trailing-data tricks (what
Night 1 taught) aren't the only place data hides, and here they're actively
misleading. `exiftool <file>` or any PNG metadata viewer surfaces the `tEXt` chunks
directly. If no metadata tool is available offline, PNG `tEXt` chunks are also visible
via a plain hex dump — they appear as readable ASCII near a chunk labelled `tEXt` (byte
sequence `74 45 58 74`) before the `IDAT`/`IEND` chunks.
