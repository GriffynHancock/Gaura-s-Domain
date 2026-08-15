# PCAN2026 Student Prep

Interactive **Crypto 101** teaching modules for Victorian TAFE students preparing for a
national CTF. Educational material for **PeCan+ 2026**. Hosted at `ctf.sandhi.com.au/crypto/*`.

**→ [ctf.sandhi.com.au/crypto/](https://ctf.sandhi.com.au/crypto/)** — module directory, links to everything live below.

- **Module 1 — Encryption 101 (Caesar / ROT)** · `public/crypto/ceasar/` — ring algebra, key vs cipher, Vigenère + Affine.
- **Module 2 — Encoding is not encryption** · `public/crypto/encoding/` — base64/hex/url/rot, encoding ≠ encryption, 9-puzzle ramp.
- **Module 3 — Hashing** · `public/crypto/hash/` — avalanche effect, MD5 (Merkle–Damgård) vs SHA-3 (sponge) internals, real MD5 collision demo. Both algorithms are complete from-scratch implementations running live in the browser (verified against Node's `crypto` and Python's `hashlib`), with a Canvas-2D render of Keccak's real 5×5×64 state and step-through controls. **Has a 15-script test suite in `tools/`, run via `node tools/run_suite.mjs`** — add `--all` for `verify_flash_safety.mjs` (photosensitivity limiter; see `CLAUDE.md`) whenever a change can move a flash.
- **Module 4 — XOR** · `public/crypto/xor/` — keystream reuse, brute force, cribbing. **Live**, all four challenges built: C1 brute force (1-byte key, `0x17` case-flip decoy), C2 cribbing (`cat`), C3 "Reuse, Recycle" (key reuse; the `flag{` crib sits at offset 18 so the drag is a real hunt, revealing `waltz`), C4 "Brute Force 2" (3-byte key `T4x`, three stacked single-byte knobs). Every byte display has a HEX/BINARY/TEXT toggle.
- **Bonus — Five Nights at Crypto's** · `public/crypto/fnac/` — haunted-house file-forensics track, **opens only once Caesar, XOR and Encoding are all complete**. No on-page helper tools: it assumes a commandline. **Live**; nights 1–3 real (trailing bytes / bit-level file splitting / repeating-key XOR), 4–7 placeholders. Has its own two test scripts (`tools/verify_fnac_module.mjs`, `tools/verify_fnac_flash_safety.mjs`) that `run_suite.mjs` does *not* run.

See `CLAUDE.md` for conventions, local dev, and deploy — and `STATUS.md` for current state and
what's outstanding. Design specs live under `docs/superpowers/specs/`; implementation plans under
`docs/superpowers/plans/`; supporting research (3D rendering options, game-feel/juice mechanics,
period desktop themes) under `docs/research/`; parked ideas in `docs/ideas-backlog.md`. Module 2's
per-puzzle solve paths and red-herring authoring guide is `docs/superpowers/module2-solve-paths.md`.

Module 2, Module 3 and FNAC assets are generated — edit `tools/build_base64_assets.py` /
`tools/build_hash_assets.py` / `tools/build_fnac_assets.py`, not their output files, and rebuild with
`.venv/bin/python tools/build_<name>_assets.py`.

`worst-case/` holds a paper/offline fallback (contains flags/answers — presenter eyes only):
a self-contained offline launcher script, plus all 21 built challenges as text files in the
school's own past-PeCanCTF `challenge.yml` format. Nothing tests those mirrors, so they go stale
silently — change a flag or a blob and you must change them too.

`master` is the trunk and is what's deployed — everything `STATUS.md` describes is on it, pushed to
`origin/master`. The old `feat/caesar-rewrite-fnac-nights` branch is fully contained in `master`
(0 commits ahead) and is retired; don't branch from it.
