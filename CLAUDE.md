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
  **Prefer Chrome MCP first**; if no browser extension is connected (common in background/subagent
  sessions), fall back to **Playwright — already installed as a project devDependency**
  (`npm install` in the repo root, `npx playwright install chromium` if browsers aren't present).
  Don't `npm install` it ad hoc into `$HOME` or elsewhere outside the repo — it's meant to stay
  installed here for every future agent to reuse, not be installed-then-uninstalled per session.
- **Python: always use the project venv** (`/Users/gaura/PCAN/ceasar-ctf/.venv/bin/python`). Global python on
  this Mac is broken (PEP-668, pending system reset) — do NOT `pip install` globally or `--break-system-packages`.
  Deps in `requirements.txt`. Asset build scripts live in `tools/` (e.g. `tools/build_base64_assets.py`).

## Working with the user
- **Never volunteer time/effort estimates** ("this will take X min", "this is cheap/expensive to build",
  session-time budgeting, etc.) unless explicitly asked. Just assess feasibility/scope and get on with it.

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
- **CSS 3D gotcha — `opacity`/`filter` silently flatten `transform-style:preserve-3d`.** Any element
  with `opacity < 1` or a non-`none` `filter` becomes a CSS "grouping property" trigger, which forces
  the element's *used* `transform-style` to `flat` — even though `getComputedStyle` still reports
  `preserve-3d` as declared, so this is easy to miss by inspection. Any `::before`/`::after` 3D faces
  on that element then render with zero real depth (they never got the parent's `preserve-3d`
  context), and the element visually reads as flat no matter how large the transform values are. Hit
  this building the SHA-3 hash-module's 25-lane cuboid grid (`public/crypto/hash/index.html`): `.lane`
  had `opacity:.92` and `filter:brightness(1)` for its pulse effect, which meant its pseudo-3D
  `::before`/`::after` faces were rendering completely flat (not just shallow) the whole time — the
  fix was moving the painted/opacity/filter-bearing visuals to leaf-level child elements and keeping
  the 3D-context parent element free of both properties.
- **Deploy quirk:** first `wrangler deploy` of a new worker can throw `code 10007` on the workers.dev subdomain
  step. Already mitigated by `"workers_dev": false` in `wrangler.jsonc` (we use a custom domain, not workers.dev).
- **Worker script + static assets, together:** once `wrangler.jsonc` has both a `main` script (`src/index.js`)
  and an `assets` block, requests that match an existing static file **bypass the Worker's `fetch` handler by
  default** — they're served directly, your code never runs. Need `assets.run_worker_first: true` to make every
  request (including ones that resolve to a real file) go through the Worker first — required if you want to
  mutate/inspect responses for existing pages (e.g. stamping a header on every page), not just for routes with
  no matching asset (e.g. a bare `/` redirect, which works either way since nothing there 404s into the worker).
- **Module 2 (Encoding) lives at `public/crypto/encoding/` → served at `/crypto/encoding/`**.
  Module 1 (Caesar) is `public/crypto/ceasar/` → `/crypto/ceasar/`.
- **`public/crypto/encoding/assets.js` is GENERATED** by `tools/build_base64_assets.py` — edit the script, not the
  output. Run builders with `.venv/bin/python`. Confetti sprites: `tools/build_confetti.py` reads the repo-root
  `confetti/` drop folder → `public/crypto/encoding/confetti/*.png` + `manifest.js`.
- **Victory confetti** is shared: `public/crypto/confetti/engine.js` (+ `manifest.js`, sprites).
  A page sets `window.FX_MODULE` (per-user signature seed) and `window.FX_TOTAL` (puzzle count),
  then calls `window.fxSolved(id)` per capture. The rain fires once **only when all puzzles in
  the module are solved** — module-completion reward, to make students tutor each other. Each
  user's effect is cookie-seeded (`ctf-uid`), unique per person and per module.
- **Repo IS under git now** (initialised 2026-06-25). Commit before large edits.

## Status
See `STATUS.md`.
