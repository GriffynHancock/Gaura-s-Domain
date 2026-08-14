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
- **Module 3 (Hashing, `public/crypto/hash/index.html`) has a 15-script test suite in `tools/`**, driven by
  `node tools/run_suite.mjs` (add `--all` for flash safety). Two are pure Node (`test_md5_trace`,
  `test_keccak_trace` — digest parity against Node's own `crypto`); the rest are Playwright and need
  `HASH_MODULE_URL="http://localhost:<port>/public/crypto/hash/"`. See STATUS.md for the full list.
  Run the ones your change can plausibly break — not the whole suite reflexively.
  FNAC has its own two scripts **outside** that runner (`verify_fnac_module.mjs`,
  `verify_fnac_flash_safety.mjs`, driven by `FNAC_MODULE_URL`) — `run_suite.mjs` will not run them for you.
  Three things in that file are **not** ordinary code and must not be quietly weakened:
  - **`verify_flash_safety.mjs` and the photosensitivity governor.** The SHA-3 animation measures its
    own real flash pace and clamps luminance excursion under WCAG 2.3.1's 3-flashes-per-second bound.
    This is projected to a room of teenagers, any of whom may be photosensitive.
    **It takes ~4 min, so run it only when the change can actually move a flash:** animation
    timing or pacing, the escalation/aliasing curves, per-frame colour or luminance, opacity or
    blur, the governor itself, or anything that alters how often the canvas repaints. Copy edits,
    layout, non-animated CSS, MD5-side register work and trace/digest changes do **not** need it.
    When in doubt about whether a change touches luminance-over-time, run it — but "I touched the
    hash page" is not by itself a reason.
  - **The FIPS 202 sweep axes** (θ +x plane, χ −x per-row races, ρ along z per-lane, π x-y swirl,
    ι point at lane (0,0)). These are pinned by tests because getting one wrong teaches false
    structure. Note χ is +x, NOT y — a Keccak row is *indexed by* y but *runs along* x.
  - **π's non-co-location guarantee.** State the depth-sort invariant precisely, because the loose
    version is wrong and will get "simplified" into a real bug: what the painter's algorithm needs
    is that **wherever two drawn footprints overlap, draw order agrees with occlusion** — *not*
    that footprints are disjoint. They never were: at lattice pitch 1.0 with 0.66 cubes there are
    already ~2200 overlapping pairs per frame under any off-square camera, which is precisely the
    situation a painter's algorithm exists to resolve. π's measured 0.055-world-unit minimum
    separation (`tools/verify_pi_pacing.mjs`) is the claim that no two boxes are ever exactly
    **co-located**, which is what makes the depth key a strict order rather than a tie. That is
    still load-bearing: changing π's motion means re-proving minimum separation across all 24 π
    compositions, not eyeballing it — a pure radial path provably collides, and an earlier shelf
    scheme had a latent exact-collision from an unlucky quantum. The swept motion-blur smear does
    not touch it (a smear changes what is painted, never where a box is).
  - **`SHA3_WIPE_ALPHA` is a photosensitivity control, not a look, and not the motion blur.**
    The motion blur is the per-object swept-silhouette smear; this is a separate fixed translucent
    full-canvas wipe applied while the controller runs, and it bounds how much a small patch of
    screen can change in one frame. It was deleted once as vestigial and **reinstated on
    measurement**: with an opaque wipe and the smear, the flash suite's fine probe measured
    **0–19 flashes/sec against a bound of 3**, and 0.094–0.103 excursion. Even with *no* smear an
    opaque wipe measures 0.087–0.090 — the animation's own motion already sits near WCAG's 0.10
    transition threshold, and the wipe is what holds it down. Tuning the smear cannot substitute.
    The measured table is in the page at the wipe. Don't remove it as redundant.
  The file is annotated throughout with `[EXACT]` / `[FAIRLY ACCURATE]` / `[ANALOGY]` tags marking
  which visuals are the real algorithm and which are teaching aids. Keep those honest when editing.
- **`public/crypto/encoding/assets.js` is GENERATED** by `tools/build_base64_assets.py` — edit the script, not the
  output. Run builders with `.venv/bin/python`. Confetti sprites: `tools/build_confetti.py` reads the repo-root
  `confetti/` drop folder → `public/crypto/encoding/confetti/*.png` + `manifest.js`.
- **`public/crypto/fnac/assets/**` is GENERATED** by `tools/build_fnac_assets.py` (+ `tools/fnac_png.py`).
  Three traps: (a) its `_clean()` **deletes** any file in a night's folder that the night no longer ships, so
  running it is destructive to anything else living there; (b) **Night 2's flag exists only as pixels** —
  `flag{data_bender}` is painted into the trollface's corner, and the builder asserts it is absent as a byte
  string from the source *and* from both halves, along with any bare `flag{`. So `strings`/`grep` on the
  correctly-woven file finds only the hexadecimal-etymology easter egg. If you ever "fix" this by appending
  the flag after `IEND`, you have deleted the puzzle; (c) the bit-split convention is Night 2's whole puzzle,
  and `bit_split`/`bit_weave` must stay exact inverses — half-a = bits 6,4,2,0 of each source byte, half-b =
  bits 7,5,3,1, packed one nibble per source byte, MSB-first, in source order, with an **even-length source**
  (odd lengths zero-pad the last nibble and lose the original length). The page no longer ships a WEAVE tool
  to keep in sync — the helper widgets were all removed and FNAC now assumes a commandline — so the only
  guard is the builder's own round-trip assert.
- **FNAC's gate deliberately ignores the old `ctf-fnac-unlocked` cookie.** That cookie meant "Encoding is
  done", which under the current rule (Caesar **and** XOR **and** Encoding) is one third of the requirement,
  so honouring it would grandfather people straight past two modules. It is not a bug and is not to be
  "restored". The konami bypass rides on its own cookie name (`ctf-fnac-bypass`) precisely so that ignoring
  the old one and keeping a permanent bypass can both hold. Completion is asked of the confetti engine
  (`fxModuleComplete`), the only thing that knows another module's puzzle count — which also means **a wrong
  `FX_TOTAL` on any beginner module silently locks FNAC** (XOR ships `FX_TOTAL=4` with three cards today,
  and that is exactly why FNAC is konami-only right now).
- **Encoding challenge IX must stay `base64 → rot47 → atbash`, in that order, and stay layered PER REGION.**
  Only the payload field is enciphered; the surrounding capture dump is plain, so base64 alone yields a
  readable dump rather than soup — that is what gives the student something to aim at. On the order: with
  atbash outermost, the natural two-layer guess `base64 → rot47` computes `rot47(atbash(rot47(plain)))`;
  lowercase `a`–`o` rot47 into characters atbash leaves untouched, so ~58% of the alphabet survives the
  *wrong* order and any English payload produces a near-readable fake flag. That is structural —
  regenerating the blob does not fix it. `tools/build_base64_assets.py` asserts the wrong order does not
  solve, and that no earlier layer contains `flag{...}` or even a bare `flag`; don't relax those asserts.
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
  user's effect is cookie-seeded (`ctf-uid`), unique per person and per module. A page with **no** puzzles
  sets `window.FX_NO_PUZZLES` (the hash module does) rather than leaving `FX_TOTAL` at 0 — "complete" must be
  declared, never inferred from a zero. The engine also mirrors completion into a shared
  `localStorage['ctf-complete:v1']` index and exposes `fxModuleComplete(id)` / `fxModuleProgress(id)`, which
  is how one page reads another's state; that index is what FNAC's gate is built on.
- **Repo IS under git now** (initialised 2026-06-25). Commit before large edits.

## Status
See `STATUS.md`.
