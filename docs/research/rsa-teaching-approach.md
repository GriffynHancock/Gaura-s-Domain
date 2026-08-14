<!-- Research note, not shipped UI. -->
# Teaching RSA: recognition and tooling, not key exchange theory

Companion to `docs/research/ctf-category-coverage.md`, which found RSA is the single largest
content gap: zero coverage in this repo, two of nine 2025 crypto challenges (`rsa101`,
`incorrect-implementation-of-rsa`), one at the *intro* score tier (`extra.initial: 250`) alongside
already-taught topics. Sources read directly for this note: both 2025 challenges (GitHub,
`ECUComputingAndSecurity/PeCanCTF-2025-Public/crypto/`) and every 2023 crypto challenge directory
in `/Users/gaura/PCAN/2023/crypto/` — confirmed neither `unlucky-number` (ROT13-on-the-flag) nor
`subecsert-cryptosystem` (a bespoke cube-coordinate permutation cipher, ASD-authored) is RSA or
RSA-adjacent despite the names suggesting it; there is no 2023 RSA challenge. RSA's only CTF
presence in either year's primary sources is the two 2025 challenges above.

The author's framing, verbatim, drives every recommendation below:

> "im trying to instill more 'search for a riddle and a weird looking pattern' than 'know about
> key exchanges and real crypto'."

That means the deliverable is a **pattern-recognition + tool-reach reflex**, not an RSA course.
A student who can look at `n=`, `e=3`, `c=` and think *"small n → factordb; e=3 with no padding →
maybe a root; two n's → check gcd"* has the actual CTF skill. A student who can explain Euler's
totient but freezes at a `.py` file with `pow()` calls in it does not.

---

## 1. The minimum honest mathematical core

What a student needs to hold in their head, and nothing past it:

1. **Two locks, one key each way.** RSA has a public number pair `(n, e)` anyone can encrypt
   with, and a private number `d` only the key-holder can compute — but `d` is not secret by
   design, it's secret because computing it from `(n, e)` alone requires factoring `n`, and
   factoring is slow when `n` is the product of two large primes.
2. **`n` is a product of two primes, `p` and `q`, and nobody is supposed to know them
   individually — only their product `n`.** That's the entire security model in one sentence.
3. **Encryption is `c = m^e mod n`. Decryption is `m = c^d mod n`.** They don't need to know
   *why* this round-trips (that's the totient/Euler's-theorem part — see below, deliberately cut).
   They need to recognise the shape of the formula on sight, the same way they now recognise
   base64's `=` padding.
4. **If you *can* factor `n` back into `p` and `q`, you can compute `d` yourself, becoming the
   key-holder.** One formula, stated as a fact to plug numbers into, not derived:
   `d = pow(e, -1, (p-1)*(q-1))`. This is the entire "weak key falls" mechanism a student needs.
5. **Small numbers are the tell.** Real RSA uses primes hundreds of digits long — the reason
   factoring is slow is the primes are astronomically large, not that factoring is some
   fundamentally unbreakable mathematical wall. A challenge author who uses small primes has
   handed you the vulnerability directly, no cleverness required — you just need to *notice the
   size*.

**What to leave out, and why**, since the temptation is to teach these because they're
satisfying, not because the CTF skill needs them:

- **Euler's totient function / Euler's theorem**, i.e. *why* `m^(ed) mod n = m`. This is the
  actual mathematical heart of RSA and it is genuinely interesting — and it is exactly the kind
  of "real crypto" the author explicitly said to de-prioritise. A student can plug numbers into
  `pow(e, -1, phi)` without ever being told why it works, the same way they can use a wrench
  without a mechanical-engineering degree. Cutting this is the single biggest scope decision in
  this document.
- **Modular multiplicative inverses as a standalone concept** (extended Euclidean algorithm,
  etc.). Show the one line of Python that computes it (`pow(e, -1, phi)` — Python 3.8+ supports
  negative-exponent `pow` directly, third argument positional not keyword) and move on. Explaining
  *how* `pow(e, -1, m)` works
  internally is another full lesson worth of content for zero CTF payoff.
- **Padding schemes (PKCS#1, OAEP) as taught content.** The second 2025 challenge exploits the
  *absence* of padding, so "no padding" needs to appear as a symptom to recognise (message
  small relative to `n`, so `m^e` never wraps), but the design and purpose of real padding
  schemes is out of scope — a sentence, not a section.
- **Key exchange (Diffie-Hellman, TLS handshakes, certificate chains).** Explicitly named by the
  author as the thing *not* to teach. RSA-as-used-in-a-CTF is a static number puzzle, not a
  protocol; don't let the module drift toward "how HTTPS works."
- **Digital signatures.** A legitimate RSA use case, unrelated to anything in the attack surface
  below. Skip entirely.
- **Chinese Remainder Theorem speedups, Miller-Rabin primality testing.** Implementation detail
  of how *real* RSA software generates keys efficiently — irrelevant to breaking a weak one.

---

## 2. The attack surface, ranked

Ranked by how often each actually appears in documented CTF writeups generally, and specifically
what the two primary-source challenges here demonstrate. Each entry: the tell, the tool, and
whether this repo's sources evidence it directly.

### 1. Small / factorable `n` — build this first
**Tell:** `n` is short enough to type, or just short enough that pasting it into a search box
feels plausible (roughly under 512 bits / ~155 decimal digits is the rule of thumb; in practice
CTF "weak" moduli are often far smaller — 20–40 digits). **Tool:** paste `n` into
**FactorDB** (factordb.com) — a public database of pre-factored composites that most weak CTF
moduli are already in, because someone solved that exact challenge before, or a generator with
a small search space landed on a modulus already catalogued. If FactorDB misses, `RsaCtfTool`
(github.com/RsaCtfTool/RsaCtfTool) runs dozens of factoring attacks automatically. **Evidenced
directly:** `rsa101` (2025, intro tier) is exactly this — README instructs students verbatim to
"input `n` into factordb.com to get the factors."

### 2. Small `e` with no padding — build this second
**Tell — the real one, per the source challenge, is a shape, not a size:** you're handed an
*array of many similar-magnitude numbers* — one per character — instead of one long ciphertext.
That's the actual "weird-looking pattern" the author's framing asks students to spot: real RSA
never sends a message one character at a time (message-space that small makes the whole scheme
pointless), so a column of dozens of same-sized values is itself the giveaway, visible before any
math. A bonus tell sits inside that array for a sharp-eyed student: because each character is
encrypted independently with no padding, *identical plaintext characters produce identical
ciphertext values* — repeats in the column (e.g. doubled letters, spaces) are spottable by eye,
a direct callback to Module 1's substitution-cipher pattern-matching instinct, and a second,
independent solve path that needs no exponent math at all. **Tool:** once you've noticed one
value is one character, you don't need `n`, `d`, or any key — take the integer `e`-th root of
each value (`gmpy2.iroot`, or a careful `round(c ** (1/e))`, watching the float-precision trap
below). **Evidenced directly, exactly:** `incorrect-implementation-of-rsa` (2025, standard tier)
ships `e=5` and a **60-element ciphertext array**, one value per character, solved with
`x ** (1/5)` per element, rounding to fix float imprecision (`112.00000000000003` → `112`).

### 3. Shared prime / common factor between two moduli
**Tell:** two (or more) public keys/moduli given in the same challenge — a strong signal the
challenge wants you to check whether they share a prime factor (a poor key-generation RNG can
reuse a prime across two "independent" keys). **Tool:** `gcd(n1, n2)` in one line of Python
(`math.gcd`) — if non-trivial, you've recovered a shared prime instantly, no factoring needed at
all. **Evidenced:** not present in either primary-source year, but this is a well-documented,
frequently recurring CTF pattern (multi-key RSA challenges are common enough that RsaCtfTool
has a dedicated multi-`n` mode) — worth teaching *because* it's cheap to demonstrate and likely
to recur even though it hasn't yet in this dataset.

### 4. Wiener's attack / small private exponent `d`
**Tell:** the challenge explicitly gives you `d` is small, or hints at "fast decryption," or a
CTF README name-drops "Wiener." **Tool:** RsaCtfTool's Wiener attack module, or a continued-
fraction script. **Rank:** lowest of the four — genuinely more advanced math (continued
fractions), not evidenced in either primary source, and the "recognise + reach for RsaCtfTool"
reflex covers it without a student needing to understand *why* it works. Worth **one sentence**
in the module ("if none of the above work, RsaCtfTool tries several more exotic attacks
automatically — Wiener's is one"), not a taught mechanic.

**Explicitly out of the ramp, mention only as flavour text if at all:** Bleichenbacher/padding-
oracle attacks (need a live oracle, not a static puzzle — wrong shape for this format entirely),
Coppersmith's attack (genuinely graduate-level number theory), fault injection.

---

## 3. Visualisation options, assessed honestly

The project's own rule: drop a metaphor the moment it implies something false. RSA is a magnet
for two specific bad metaphors, named up front so they don't creep in during design:

- **The padlock metaphor** ("anyone can *lock* the box, only you can *unlock* it"). This implies
  encryption and decryption are symmetric-feeling opposite actions on the same physical
  mechanism. They're not — `m^e mod n` and `c^d mod n` are the *same operation* (modular
  exponentiation) with a different exponent plugged in. A padlock has no equivalent of "the same
  mechanism run with a different number produces the inverse effect." Skip it, or if used at all,
  use it only as a one-sentence throwaway ("public key locks, private key unlocks") never as a
  built interactive.
- **"Multiplying is easy, factoring is hard" stated as settled fact.** It's true in practice and
  believed true in complexity theory, but it is an *unproven conjecture*, not a theorem — no
  polynomial-time factoring algorithm is known, but none is proven not to exist (this is exactly
  the flavour of overclaim the "no slope for one-way functions" note in `CLAUDE.md` already warns
  about, re-applied here). Phrase it as *"as far as anyone has ever found"* / *"nobody has found a
  fast way, but nobody's proven one is impossible either"* — never "impossible," never "proven."

Now the options, assessed:

### Factoring as a visible search — BUILD
**What it teaches:** trial division against a genuinely small `n` (say, under six digits) run
live in the browser, with a counter ticking through candidate divisors, makes the "small `n` is
findable, large `n` isn't" claim *felt* rather than asserted — the search visibly slows to a
crawl as digit count climbs even by a little, before the student ever sees a graph or a big-O
claim. **What it risks implying falsely:** almost nothing, if scoped honestly — trial division
*is* what actually happens (conceptually) for a weak `n`; just don't claim it's how real
factoring attacks work at scale (Pollard's rho, GNFS, etc. are what real tools use, and are out
of scope — a one-line footnote is enough: "real factoring tools are smarter than trying every
number, but the idea — brute-force search over a huge space — is the same shape"). **Verdict:
survives the honesty rule** — but the digit counts have to come from the real arithmetic, not
round numbers. Trial division only needs to reach `sqrt(n)`: an 8-digit `n` has `sqrt(n) ≈ 10^4`
(instant), and even a 12-digit `n` (`sqrt(n) ≈ 3×10^6`) is still sub-second in JS — no visible
contrast between those two. The slowdown only becomes *felt* once `sqrt(n)` passes roughly
`10^8`–`10^9`, which needs `n` around **17–19 digits** — past `Number`'s 2^53 (~16-digit) safe-
integer limit, so that run must be BigInt trial division, which is slower per-iteration too,
sharpening the contrast further. **Build it as: one `n` around 8 digits (near-instant) against
one `n` around 18 digits (visibly grinds, several seconds, BigInt loop)** — the one place in this
document where a number is load-bearing; re-measure against the actual browser loop before
shipping rather than trusting this estimate as final.

### Modular exponentiation as a wrap (dial/clock visual) — BUILD, reuse existing asset
**What it teaches:** `m^e mod n` is "multiply, then wrap around a dial of size `n`, repeatedly" —
this repo already has exactly this idiom in the Caesar module's alphabet dial (mod-26 wrap) and
the hash module's various avalanche visuals. Reusing that idiom for mod-`n` wrap (just a bigger
dial, or the same dial re-scaled) costs little and is *honest*: this is literally what modular
exponentiation is. **What it risks implying falsely:** almost nothing if kept to small `n` (dial
face has to stay legible — don't try to draw a 300-digit dial). The risk is scope creep into
animating the *repeated squaring* algorithm real software uses for speed (square-and-multiply) —
that's an implementation-efficiency detail, not conceptually necessary; skip animating it, just
show the wrap. **Verdict: survives. Build it, but keep it to the "this is why the answer is
smaller than you'd expect" demonstration, not a full repeated-squaring trace.**

### A key pair as "two doors" / two locks — DROP
**What it teaches:** superficially, "one key locks, the other unlocks," which is the padlock
metaphor in a different costume. It doesn't teach *anything* about factoring, moduli, or why a
weak key falls — the entire attack surface this module needs to build toward is invisible in
this metaphor, because "two doors" has no representation of `n` being factorable at all. It's
purely a decoration explaining public/private-key *existence*, not vulnerability. **What it
risks implying falsely:** that public and private keys are symmetric, interchangeable-feeling
objects (see padlock critique above) rather than one being derivable from the other given enough
work. **Verdict: drop.** This is the visualisation I'd cut despite it being the one that looks
most "impressive" in a demo reel — a nice two-panel door animation is exactly the kind of thing
that photographs well for a screenshot and teaches nothing about the actual CTF skill. Time spent
here is time not spent on the factoring-search visual, which teaches the real thing.

### `gcd`/shared-prime Venn-style visual (two circles overlapping = shared factor) — BUILD, cheap
**What it teaches:** two moduli sharing a prime factor is directly visualisable as literal
overlap — two number lines or set-like blobs with a highlighted common divisor popping out.
Honest because it's not a metaphor at all, it's just what `gcd > 1` *means*. **Verdict: build,
low cost, high payoff for attack #3** — this is likely the cheapest visual in the whole module
relative to what it teaches, since no wrap/dial machinery is needed, just "here are two numbers,
here's their gcd, watch it light up when it's not 1."

### A 3D "keyspace mountain" or gradient/difficulty-landscape visual — DROP (named explicitly per CLAUDE.md's own warning)
**What it teaches:** nothing safely. CLAUDE.md already flags this exact failure mode by name
("downhill flow" search-space visual wrongly implies a gradient you can follow — one-way
functions have no slope). Factoring `n` has no partial-credit gradient: you don't get "warmer" as
you approach the correct prime. Any landscape/heightmap treatment of the factoring search
implies exactly the false thing the project's own philosophy document warns against. **Verdict:
drop outright, don't build even a cut-down version.**

### Animating `RsaCtfTool`'s internal attack menu ("watch 12 attacks run in parallel") — DROP
**What it teaches:** looks impressive (a console-style multi-line log scrolling with attack
names ticking pass/fail) but teaches nothing the student can reconstruct themselves — it's a
demo of a tool's UI, not of a concept. The actual lesson ("a tool exists that tries many attacks
automatically so you don't have to know all of them") is delivered just as well, more honestly,
and far more cheaply by a single sentence plus a link, in the challenge's post-solve explainer.
**Verdict: drop.** Reserve build effort for the two visuals above that teach mechanism.

---

## 4. Concrete module sketch — `public/crypto/rsa/index.html`

Static, dependency-free, single HTML file, all JS inline, `warm-editorial-ui` skin (flat variant
— no reason for a bespoke skin here per CLAUDE.md's own guidance that skins are the exception,
not the default). BigInt is available in every evergreen browser and is required here — JS
`Number` loses precision above 2^53, and even a *small* CTF-style `n` (say 15–20 digits) exceeds
that. `pow()`-with-modulus needs a hand-rolled BigInt modexp (`function modpow(base, exp, mod)`
via repeated squaring). Checked directly: `public/crypto/hash/index.html` does use BigInt, but
only for fixed-width 64-bit Keccak lane operations (`rol64`, XOR/AND across `1n << BigInt(bitpos)`
lanes) — there is no general-purpose arbitrary-precision modexp helper there to reuse; this
module needs its own small `modpow(base, exp, mod)`, written fresh.

Ramp of scored challenges, mirroring the existing modules' shape (title card → interactive →
typed `flag{...}` capture, `window.fxSolved(id)` on each, victory confetti at module completion):

**C1 — "Same operation, different exponent."** No attack yet — just the modular-exponentiation
dial from §3, with a tiny hand-pickable `n` (two digits) so the student can watch `m^e mod n` and
`c^d mod n` land on the same wheel. Flag is handed over pre-decrypted as a worked example; the
"challenge" is turning the dial correctly to reach a target number, building the wrap intuition
before any attack is introduced. Low stakes, orientation only.

**C2 — Small `n`, FactorDB.** `rsa101`'s README (checked directly, both the rendered page and the
raw file) describes the solve method but the repo does not commit the actual `n`/`e`/ciphertext —
they're generated per-deployment, not in source control, so this module can't mirror its exact
modulus size and has to make its own reasoned choice rather than copy one. Recommendation: make
this puzzle's `n` **FactorDB-scale, not browser-factorable** (comfortably past the ~18-digit
threshold from §3 where in-browser trial division starts to grind) — that's the more honest
choice, because it forces the actual tool-literacy move (paste into factordb.com, don't hand-roll
a factoring loop) rather than letting a small in-page number quietly substitute for the real
workflow. The in-browser factoring visual from §3 stays in the module, but as a *separate*
C1-adjacent demonstration of *why* small `n` is unsafe, not as C2's own solve mechanism. Student
factors via FactorDB, computes `d = pow(e, -1, (p-1)*(q-1))`, decrypts with the provided modpow
helper or their own script, converts the resulting integer back to ASCII (`long_to_bytes`
equivalent — show the byte-chunking by hand once, since it's a genuine "oh, that's what that
means" moment: an integer's hex digits are just the flag's ASCII bytes concatenated). This
mirrors `rsa101`'s solve *method* faithfully even though its exact numbers are unrecoverable from
the primary source. **Build-time check, not optional:** whatever `n` is generated for this puzzle
must be pasted into factordb.com and confirmed to actually resolve *before* the module ships —
FactorDB auto-factors most numbers in the intended range but isn't guaranteed to for any specific
one, and an unsolvable-by-its-intended-route puzzle is worse than a slightly different `n` chosen
until one confirms.

**C3 — small `e`, no padding, one value per character.** Mirror the actual source shape, not a
simplified single-`c` version: ship `n` (large, ~600 digits in the source challenge, deliberately
*not needed* — a student learns "you were handed a number and don't have to use it" is itself a
real CTF lesson), `e` (5, or 3), and a **ciphertext as an array of ~40–60 values, one per
character**, not a single number. Two independent solve paths, both worth surfacing: (1) eyeball
the array for repeated values — identical plaintext characters (doubled letters, spaces) produce
identical ciphertext numbers with no padding, spottable before any math, a direct callback to
Module 1's substitution-pattern instinct; (2) take the integer `e`-th root of each value —
each per-character value stays small enough (`m^e` for a single ASCII byte, `e≤5` — nowhere near
`n`'s size) that no modular wraparound ever occurs, so no key or factoring is needed at all.
Flag the float-precision gotcha explicitly in the puzzle's hint text (`Math.round` /
integer nth-root, not naive `**`) since it's a real, instructive trap the 2025 challenge hit and
documented. This is `incorrect-implementation-of-rsa` faithfully mirrored.

**C4 — Two moduli, shared prime.** Given `(n1, e1, c1)` and `(n2, e2, c2)` generated with a
shared prime (deliberately, as the module's own "weak RNG" flavour text). Student computes
`gcd(n1, n2)` (one line, `BigInt` doesn't have a native gcd — worth a tiny helper), recovers both
factorisations at once, decrypts either. Pairs with the Venn/overlap visual from §3. This is the
one attack not evidenced in either primary source but cheap to build and a well-documented
recurring CTF pattern — good ramp position because it needs zero new visual machinery beyond C2's
existing modpow/decrypt plumbing.

**C5 (stretch, optional, cut first under time pressure) — "spot the smell" multiple choice.**
Four short scenario cards (small `n`; `e=65537` with real padding — i.e. the *secure*, do-nothing
case, included specifically so students learn what *doesn't* need an attack; two moduli; a
"`d` is suspiciously small" hint) — student picks which attack applies and which tool they'd
reach for, no computation required. This is the single cheapest way to reinforce "recognise the
weakness class" as a repeatable skill divorced from any one worked example, directly serving the
author's stated framing. If module scope needs trimming, cut C5 last (it's cheap) before cutting
C4 (it's the shared-prime pattern that's actually documented as recurring).

Each puzzle's post-solve panel should name the real tool a student would reach for outside this
sandbox (see §5) — the module's job is to make the in-browser exercise feel like a faithful
rehearsal of the real move, not a self-contained toy.

---

## 5. Tools a student should leave knowing

Ranked by where they fit in the ramp above:

1. **FactorDB (factordb.com)** — first tool named, first tool used (C2). Paste `n`, get factors
   if it's already catalogued (weak CTF moduli very often are, because someone solved this exact
   generator before). Free, no install, works from a phone browser — matches the "phone-app
   native" audience note in CLAUDE.md directly.
2. **RsaCtfTool** (github.com/RsaCtfTool/RsaCtfTool) — named from C2 onward as "what you'd run on
   the school Kali VM if FactorDB comes up empty." Runs dozens of attacks (small factors, Wiener,
   common modulus, Fermat, etc.) automatically against a given `n`/`e`/`c`. This is the single
   most important tool-literacy takeaway: *you don't need to know which attack applies, you need
   to know a tool exists that tries them all.* Directly serves the CLAUDE.md success criterion
   about reaching for tools rather than deriving from scratch.
3. **`openssl rsa` / `openssl asn1parse`** — worth one callout, not a puzzle: real-world RSA keys
   arrive as PEM files, and `openssl rsa -in key.pem -text -noout` dumps `n`, `e`, and (if it's a
   private key) `p`, `q`, `d` directly, no attack needed. Useful for the "the challenge just
   handed you a `.pem`, not raw numbers" case, which is common enough to be worth a sentence in
   the C2 or C3 hint text. (RsaCtfTool and `openssl rsa` both fit at the same ramp position,
   C2–C3; the order between the two doesn't matter much.)
4. **CyberChef, named for its limits, not its coverage.** CyberChef has no meaningful RSA
   support beyond generic base64/hex reformatting of key material — worth exactly one sentence,
   probably in a closing "what CyberChef *can't* do" note echoing the encoding module's own
   "base64 ≠ encryption" lesson: *"CyberChef is brilliant for encoding and classical ciphers; RSA
   is where you graduate to Python and dedicated tools."* This also reinforces the encoding vs
   encryption distinction that's already a named success criterion in CLAUDE.md.
5. **Python `pow(base, exp, mod)` and `Crypto.Util.number.long_to_bytes`** (or the hand-rolled
   BigInt equivalent used in-browser) — the actual mechanical skill under everything above.
   Worth surfacing as literal copy-pasteable snippets in each puzzle's solved-state panel, the
   same way other modules show the "here's the one-liner that would've solved this outside the
   browser" note.

---

## Recommended build order, if scope must be cut

C1 → C2 → C3 → C4 are the core four, faithfully covering both real 2025 challenges plus the
well-documented shared-modulus pattern. C5 is the cheapest add and the most direct expression of
the "recognise the riddle" framing, so keep it if there's any room at all; cut it first if not.
Do not cut C2 or C3 — they're the two exact challenges this project is behind on. Build the
factoring-search visual and the mod-exponentiation dial; skip the two-doors key-pair metaphor and
any landscape/gradient visual entirely, per §3.
