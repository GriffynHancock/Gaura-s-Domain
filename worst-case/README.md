# Worst-case fallback

Two independent fallback tiers, for if `ctf.sandhi.com.au` is unreachable on the day.

## Tier 1 — `launch_offline.py`: re-run the site locally, no internet needed

A single self-contained Python script (stdlib only — nothing to `pip install`, works with
whatever `python3` a stock Kali box already has). Core modules (Caesar, Encoding, XOR, shared
confetti engine, directory page — ~266 KB) are embedded directly in the file as base64, so
getting the site running again is: copy-paste this one file onto the machine, run it.

```
python3 launch_offline.py                                   # Caesar + Encoding + XOR
python3 launch_offline.py --src /path/to/full/ceasar-ctf    # + FNAC (photos too big to embed)
python3 launch_offline.py --port 9000                        # custom port (default 8787)
```

FNAC's real cat photos push it to ~7 MB — too large to trust as a single terminal/clipboard
paste in an actual emergency — so it's deliberately left out of the embedded bundle. `--src`
pulls it in from any already-present full copy of this repo (a laptop, a USB stick, whatever's
on hand).

**Regenerating it**: `launch_offline.py` is a generated file — never hand-edit it directly.
Edit `tools/build_offline_launcher.py` and rerun `.venv/bin/python tools/build_offline_launcher.py`.

## Tier 2 — `text-challenges/`: paper/text fallback if nothing runs at all

Every currently-built challenge (21 total across Caesar/Encoding/XOR/FNAC) as plain
`challenge.yml` + `README.md` files, in the same folder format as this school's actual past
PeCanCTF challenges (see `/Users/gaura/PCAN/2023/crypto/` and the
[PeCanCTF-2025-Public](https://github.com/ECUComputingAndSecurity/PeCanCTF-2025-Public) repo).
No web page, no server — read straight off a laptop or printed sheet if the whole stack is down.

**Contains answers.** See `text-challenges/README.md` for details — presenter eyes only, don't
hand this folder to students.

## Tier 2b — `challenges-student-handout.md`: the actual paper-safe handout

`text-challenges/*/challenge.yml` deliberately keeps a challenge's presented text and its
flag in the *same* file (matching the real PeCanCTF schema, for the presenter's own
grading/reference use). That makes those files unsafe to put in front of students or on a
shared screen — the flag is sitting right there in the same document a student would be
reading the puzzle from.

`challenges-student-handout.md` is the student-safe extract: title + puzzle text only, for
all 21 challenges, with zero flags/answers/solution hints (verified by grepping the file for
`flag{`, `florg{`, `glaf{`, `glorf{` and friends). Reach for this specifically in the
**pure-paper / screen-share sub-scenario** — nothing digital is running at all, so it's this
markdown file, printed or displayed, plus a `challenge.yml`'s `flags:` field (or the matching
`README.md`) open only on the presenter's own machine to check answers by hand.

This is separate from `launch_offline.py` (Tier 1): that script re-serves the actual live
site (Caesar/Encoding/XOR/FNAC as interactive pages), which never shows a flag value to the
person using it in the first place — its own UI already handles the presenter/student
boundary safely. The handout file exists only for the case where *that* also isn't an
option and the fallback is genuinely pen-and-paper.
