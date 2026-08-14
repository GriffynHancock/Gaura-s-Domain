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
- **Serve from the tree you're actually testing — verify it, don't assume it.** When working in a git
  worktree (`.worktrees/<name>/`), `python3 -m http.server` must be started from THAT worktree's root.
  A worktree is a second working tree of the same repo, so a server rooted in the main checkout serves
  a *different* `index.html` at an identical-looking URL, returns 200, and gives no hint anything is
  wrong. Worse, if the port is already taken by an older backgrounded server, the new one fails to bind
  (an error easily lost if you redirected output to a log) and your requests silently hit the OLD tree.
  This has burned several sessions, once producing a convincing *fake* test failure: the stale page
  lacked a debug field, so `undefined % 360` → `NaN`, and `new Set([NaN ×25]).size === 1` reported
  "only 1 distinct angle across 25 lanes" — a plausible wrong answer rather than a crash, which read
  exactly like a real regression. **Always confirm before trusting a result:**
  `curl -s "$URL/index.html" | md5` vs `md5 -q public/crypto/hash/index.html`.
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
- **Module 3 (Hashing, `public/crypto/hash/index.html`) has a 16-script test suite in `tools/` —
  run all of it before merging anything.** Two are pure Node (`test_md5_trace`, `test_keccak_trace`
  — digest parity against Node's own `crypto`); the rest are Playwright and need
  `HASH_MODULE_URL="http://localhost:<port>/public/crypto/hash/"`. See STATUS.md for the full list.
  Three things in that file are **not** ordinary code and must not be quietly weakened:
  - **`verify_flash_safety.mjs` and the photosensitivity governor.** The SHA-3 animation measures its
    own real flash pace and clamps luminance excursion under WCAG 2.3.1's 3-flashes-per-second bound.
    This is projected to a room of teenagers, any of whom may be photosensitive. Slow ~4 min; run it.
  - **The FIPS 202 sweep axes** (θ +x plane, χ −x per-row races, ρ along z per-lane, π x-y swirl,
    ι point at lane (0,0)). These are pinned by tests because getting one wrong teaches false
    structure. Note χ is +x, NOT y — a Keccak row is *indexed by* y but *runs along* x.
  - **π's non-interpenetration guarantee.** The painter's-algorithm depth sort is only correct
    because no two boxes ever co-locate mid-transit. Changing π's motion means re-proving minimum
    separation across all 24 π compositions, not eyeballing it — a pure radial path provably
    collides, and an earlier shelf scheme had a latent exact-collision from an unlucky quantum.
  The file is annotated throughout with `[EXACT]` / `[FAIRLY ACCURATE]` / `[ANALOGY]` tags marking
  which visuals are the real algorithm and which are teaching aids. Keep those honest when editing.
- **`public/crypto/encoding/assets.js` is GENERATED** by `tools/build_base64_assets.py` — edit the script, not the
  output. Run builders with `.venv/bin/python`. Confetti sprites: `tools/build_confetti.py` reads the repo-root
  `confetti/` drop folder → `public/crypto/encoding/confetti/*.png` + `manifest.js`.
- **`public/crypto/fnac/assets/**` is GENERATED** by `tools/build_fnac_assets.py` (+ `tools/fnac_png.py`).
  Two traps: (a) its `_clean()` **deletes** any file in a night's folder that the night no longer ships, so
  running it is destructive to anything else living there; (b) Night 2's puzzle *is* the bit-split convention,
  and the JS weave tool inside `public/crypto/fnac/index.html` must stay the **exact inverse** of
  `fnac_png.bit_split` — file-a = bits 6,4,2,0 of each source byte, file-b = bits 7,5,3,1, packed one nibble
  per source byte, MSB-first, in source order. Change one side and the page silently reassembles garbage, with
  no error anywhere. The builder also asserts an even-length source (odd lengths zero-pad the last nibble and
  lose the original length) and that `flag{` leaks into neither half.
- **Encoding challenge IX must stay `base64 → rot47 → atbash`, in that order.** With atbash outermost instead,
  the natural two-layer guess `base64 → rot47` computes `rot47(atbash(rot47(plain)))`; lowercase `a`–`o` rot47
  into characters atbash leaves untouched, so ~58% of the alphabet survives the *wrong* order and any English
  payload produces a near-readable fake flag. That is structural — regenerating the blob does not fix it.
  `tools/build_base64_assets.py` asserts the wrong order does not solve; don't relax that assert.
- **Caesar affine clues (`A_CLUES` in `public/crypto/ceasar/index.html`): no clue may name another surviving
  multiplier.** A stuck student types the number they can see. This is why 9 is "squares on a noughts-and-
  crosses grid" (not "three rows of three" — 3 is a live key) and why "a cat's lives" is banned (seven lives in
  Italian/Spanish/Greek/German/Turkish/Portuguese/Arabic, and 7 is live). Every value in `COPRIMES` needs an
  entry, clueable by a countable everyday fact any 15-year-old *anywhere* can count — no sports, films,
  currencies or local ages. Editing `COPRIMES` also rotates every existing student's challenge-VI key.
- **A flag or blob change is never confined to `public/`.** Each challenge is mirrored in
  `worst-case/text-challenges/<module>/<slug>/` (`challenge.yml` + `README.md` + sometimes a `blob.txt`), listed
  again in `worst-case/challenges-student-handout.md`, and baked into the generated
  `worst-case/launch_offline.py`. Those mirrors are the presenter's only fallback if the site is down on the
  day, and nothing tests them — they go stale silently. Change a flag, change all of it.
- **Victory confetti** is shared: `public/crypto/confetti/engine.js` (+ `manifest.js`, sprites).
  A page sets `window.FX_MODULE` (per-user signature seed) and `window.FX_TOTAL` (puzzle count),
  then calls `window.fxSolved(id)` per capture. The rain fires once **only when all puzzles in
  the module are solved** — module-completion reward, to make students tutor each other. Each
  user's effect is cookie-seeded (`ctf-uid`), unique per person and per module.
- **Repo IS under git now** (initialised 2026-06-25). Commit before large edits.

## Status
See `STATUS.md`.
