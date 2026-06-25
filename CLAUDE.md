# CLAUDE.md — Crypto 101 CTF prep

## What this is
A set of **interactive teaching modules** to give Victorian TAFE teenagers a working intro to
cryptography **before they compete in a national CTF**. Hosted at `ctf.sandhi.com.au/crypto/*`.
The first module (Caesar/ROT) lives at `/crypto/ceasar`.

## Audience — assume zero
Assume the room does **not** know what a flag is, what a CTF is, or what cryptography is.
Pitch to "phone-app / web-app native" teenagers, not to people who find radios or terminals familiar.

## Success criteria (what they leave with)
- See base64 (or similar) and think *"that's something encoded."*
- Recognise the shapes: encoding vs hashing vs encryption; secret / key / entropy.
- Have the instinct to reach for tools — e.g. ask an LLM to help run a password brute-force against
  OWASP Juice Shop on Kali in the school VMs.
- A **geometric/visual intuition** for how the machinery fits together.
- Practical CTF starter skills + awareness of the common Kali tools a crypto/web challenge uses.

We don't know the exact challenges, but they'll resemble well-documented CTF categories.

## Teaching philosophy (important)
- **Tactile-first, but tactile must *teach the machinery*, not just be novel.** A dial teaches ring
  algebra (mod-26 wrap) because you physically turn through the alphabet. Every interaction should
  leave an intuition about the intellectual structure underneath.
- Pick metaphors honestly — drop one if it implies something false (e.g. a "downhill flow" search-space
  visual wrongly implies a gradient you can follow; one-way functions have no slope).
- Concepts to cover: fundamentals (secret/key/entropy; algorithms where a key lets you *skip* the work;
  randomness as both tool and attack vector when insecure RNG is predictable), hashing (avalanche;
  hash collisions / rainbow tables against weak/old crypto), encoding (base64 ≠ encryption), and the
  Kali tools they'd actually use.

## Tech / conventions
- Static, dependency-free **single HTML file per module** under `public/crypto/<name>/index.html`.
- Hosted as a **Cloudflare Worker (assets-only, custom domain)**. Deploy:
  `cd /Users/gaura/PCAN/ceasar-ctf && npx wrangler deploy` (needs `wrangler login`; the Cloudflare MCP
  is read-only). Route is `ctf.sandhi.com.au` custom domain; `workers_dev:false`.
- **Design system:** invoke the `warm-editorial-ui` skill — Fraunces + Hanken Grotesk + JetBrains Mono,
  bone/oxblood/amber, light+dark. The Caesar module also has an analog-instrument skin; new modules
  should use the *flat* version of the system unless a skin genuinely fits the content.
- **Verify interactive UI with real pointer clicks** (Chrome MCP / Playwright), not synthetic events.
- **Python: always use the project venv** (`/Users/gaura/PCAN/ceasar-ctf/.venv/bin/python`). Global python on
  this Mac is broken (PEP-668, pending system reset) — do NOT `pip install` globally or `--break-system-packages`.
  Deps in `requirements.txt`. Asset build scripts live in `tools/` (e.g. `tools/build_base64_assets.py`).

## Local dev & gotchas (learned the hard way)
- **Serve locally:** `python3 -m http.server 8787` from the repo root, then open
  `http://localhost:8787/public/crypto/<name>/`. **Path quirk:** locally you need the `/public/` prefix; in
  production `public/` is the site root so the path is `/crypto/<name>/`. Don't be fooled by a local 404.
- **Browser caches the served file** during iteration — append a cache-buster (`?v=2`) when reloading to test edits.
- **Animation verification trap:** the Chrome-MCP/automation tab is *backgrounded*, so CSS transitions AND
  `requestAnimationFrame` are paused there. `getComputedStyle`/`getBoundingClientRect` then read the
  *pre-animation* value and look "stuck/broken" even when the code is correct. The **inline transform/style is the
  source of truth**; to verify a position, set `transition:none` first (or read the inline value), don't trust
  computed style of an animating element. (This cost two phantom-bug hunts.)
- **Deploy quirk:** first `wrangler deploy` of a new worker can throw `code 10007` on the workers.dev subdomain
  step. Already mitigated by `"workers_dev": false` in `wrangler.jsonc` (we use a custom domain, not workers.dev).
- **`public/crypto/base64/assets.js` is GENERATED** by `tools/build_base64_assets.py` — edit the script, not the
  output. Run builders with `.venv/bin/python`.
- **Repo is NOT under git** (no history/rollback). Consider `git init` before large edits.

## Status
See `STATUS.md`.
