# PCAN2026 Student Prep

Interactive **Crypto 101** teaching modules for Victorian TAFE students preparing for a
national CTF. Hosted at `ctf.sandhi.com.au/crypto/*`.

**→ [ctf.sandhi.com.au/crypto/](https://ctf.sandhi.com.au/crypto/)** — module directory, links to everything live below.

- **Module 1 — Caesar / ROT** · `public/crypto/ceasar/` — ring algebra, key vs cipher, Vigenère + Affine.
- **Module 2 — Encoding** · `public/crypto/encoding/` — base64/hex/url/rot, encoding ≠ encryption, 9-puzzle ramp.
- **Module 3 — Hashing** · `public/crypto/hash/` — avalanche effect, MD5 (Merkle–Damgård) vs SHA-3 (sponge) internals, real MD5 collision demo.
- **Module 4 — XOR** · `public/crypto/xor/` — keystream-reuse, brute force, crib-dragging (in progress, not deployed).
- **Bonus — Five Nights at Crypto's** · `public/crypto/fnac/` — haunted-house sequel track, unlocks after Encoding (in progress, not deployed).

See `CLAUDE.md` for conventions, local dev, and deploy. Design specs live under
`docs/superpowers/specs/`; implementation plans under `docs/superpowers/plans/`. Module 2's
per-puzzle solve paths and red-herring authoring guide is `docs/superpowers/module2-solve-paths.md`.

Module 2 and Module 3 assets are generated — edit `tools/build_base64_assets.py` /
`tools/build_hash_assets.py`, not their output files, and rebuild with
`.venv/bin/python tools/build_<name>_assets.py`.

`worst-case/` holds a paper/offline fallback (contains flags/answers — presenter eyes only):
a self-contained offline launcher script, plus every built challenge as text files in the
school's own past-PeCanCTF `challenge.yml` format.
