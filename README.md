# PCAN2026 Student Prep

Interactive **Crypto 101** teaching modules for Victorian TAFE students preparing for a
national CTF. Hosted at `ctf.sandhi.com.au/crypto/*`.

- **Module 1 — Caesar / ROT** · `public/crypto/ceasar/` — ring algebra, key vs cipher.
- **Module 2 — Encoding** · `public/crypto/base64/` — base64/hex/url/rot, encoding ≠ encryption.

See `CLAUDE.md` for conventions, local dev, and deploy. Design specs live under
`docs/superpowers/specs/`; Module 2's per-puzzle solve paths and red-herring authoring
guide is `docs/superpowers/module2-solve-paths.md`.

Module 2 assets are generated — edit `tools/build_base64_assets.py`, not
`public/crypto/base64/assets.js`, and rebuild with `.venv/bin/python tools/build_base64_assets.py`.
