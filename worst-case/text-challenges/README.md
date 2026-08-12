# Worst-Case Text Fallback — Crypto 101 CTF Prep

> ⚠ **This folder contains answers and flags. Presenter eyes only — do not hand this
> folder, or any file inside it, to students.**

## What this is

A plain-text, no-web-server-required fallback for the Crypto 101 CTF-prep session. If
both the live site (`ctf.sandhi.com.au/crypto/*`) **and** any local re-launch
(`python3 -m http.server`, etc.) fail on the day, every challenge in every built module
is reproduced here as a standalone folder — `challenge.yml` + `README.md` (+ any needed
data files) — matching the format the school's actual past CTF (PeCanCTF) used, so it's
immediately usable as printed handouts or a manual scoring sheet with no infrastructure
at all.

## Layout

One folder per challenge, kebab-case slug from the challenge's title:

```
worst-case/text-challenges/
├── caesar/       6 challenges  — single Caesar shift, Vigenère (2-key), Affine
├── encoding/     9 challenges  — base64, hex, url, layered encodings, decoys
├── xor/          3 challenges  — single-byte brute force, crib-the-key, keystream reuse
└── fnac/         3 challenges  — "Five Nights at Crypto's": trailing bytes, PNG
                                   metadata, LSB steganography
```

Each challenge folder has:
- `challenge.yml` — 2025 PeCanCTF schema (`name`, `author`, `category`, `description`
  with the puzzle inline, `flags:` as a list of `{type: static, data: case_insensitive,
  content: <flag>}` objects, plus scoring/`extra` fields).
- `README.md` — presenter/solution reference: mechanism, worked solution, the flag, and
  any judgement calls or caveats specific to that challenge. Starts with the same
  do-not-show-to-participants banner as this file.
- Occasionally a `blob.txt` (long encoded strings) or a `files:` reference to existing
  binary assets already in `public/crypto/<module>/assets/` (images aren't duplicated
  into this folder — see each README for exact paths).

## Two things every README explains, per-challenge

1. **Caesar module only:** the live page derives every student's key(s) from a
   per-visitor cookie hash, so there's no single fixed ciphertext to extract from the
   site. Each Caesar README documents a **freshly invented, programmatically verified**
   worked key/ciphertext instance instead — same mechanism and flag plaintext as the
   live page, different (but valid) key.
2. **Encoding, XOR, and FNAC:** these modules are **not** per-user randomized (FNAC
   Night 3's cover photo is the one exception — see its README), so every value in those
   READMEs was extracted directly from the live source (`assets.js`, module JS, or the
   asset-generation script) and independently re-decoded to confirm it produces the
   stated flag.

## Presenter quick-use

If everything digital is down: print the `challenge.yml`/`README.md` pairs (minus the
solution sections, if running it as a live competition rather than a lecture), hand out
the `description` block as the puzzle, and use each `flags:` entry to check submissions
by hand. If something digital is back up (a phone, one laptop), the worked Python
snippets in each README double as ready-made solve scripts.
